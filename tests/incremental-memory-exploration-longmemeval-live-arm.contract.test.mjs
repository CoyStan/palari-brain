import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  MEMORY_EXPLORATION_TOOLS,
} from '../src/index.mjs'
import {
  INCREMENTAL_LONGMEMEVAL_EXPLORATION_GENERATION,
  INCREMENTAL_LONGMEMEVAL_EXPLORATION_MAX_DISPOSITIONS,
  INCREMENTAL_LONGMEMEVAL_EXPLORATION_REDUCER_GENERATION,
  INCREMENTAL_LONGMEMEVAL_EXPLORATION_RESPONSE_SCHEMA,
  INCREMENTAL_LONGMEMEVAL_EXPLORATION_SYSTEM_INSTRUCTION,
  INCREMENTAL_LONGMEMEVAL_EXPLORATION_TOOL_CONFIG,
  INCREMENTAL_LONGMEMEVAL_EXPLORATION_TOOLS,
  runIncrementalLongMemEvalQuestionWithExploration,
} from '../evals/arms/incremental-memory-exploration-longmemeval-live-arm.mjs'
import {
  INCREMENTAL_LONGMEMEVAL_HARD_CAP_MODEL,
  runIncrementalLongMemEvalQuestionForScoring,
} from '../evals/arms/incremental-memory-longmemeval-live-arm.mjs'

const GOLD_ANSWER = 'ORBIT-7731'
const GOLD_SESSION_METADATA = 'DO-NOT-PRESEED-SESSION'

function fixture(interactions = 21, {
  questionId = 'incremental-exploration-fixture',
} = {}) {
  return {
    answer: GOLD_ANSWER,
    answerSessionIds: [GOLD_SESSION_METADATA],
    isAbstention: false,
    question: 'What is my emergency access value?',
    questionDate: '2026-02-28T00:00:00.000Z',
    questionId,
    questionType: 'single-session-user',
    sessions: Array.from({ length: interactions }, (_, index) => ({
      eventAt: new Date(
        Date.UTC(2026, 0, 1) + index * 86_400_000,
      ).toISOString(),
      sessionId: `session-${String(index + 1).padStart(3, '0')}`,
      turns: [
        {
          content: index === 5
            ? `Important: my emergency safe combination is ${GOLD_ANSWER}.`
            : `Ordinary durable message ${index + 1}.`,
          role: 'user',
        },
        {
          content: `Acknowledged message ${index + 1}.`,
          role: 'assistant',
        },
      ],
    })),
  }
}

function providerInput(body) {
  return JSON.parse(body.contents[0].parts[0].text).input
}

function noMemoryPayload(body) {
  const input = providerInput(body)
  return {
    actions: [],
    baseRevision: input.baseRevision,
    dispositions: input.evidence.map(({ id }) => ({
      evidenceId: id,
      outcome: 'no_memory',
    })),
  }
}

function usage() {
  return {
    geminiInputTokens: 10,
    geminiOutputTokens: 5,
    judgeInputTokens: 0,
    judgeOutputTokens: 0,
    usd: 0.000003,
  }
}

function writerResult(body, payload = noMemoryPayload(body)) {
  return {
    finishReason: 'STOP',
    modelVersion: INCREMENTAL_LONGMEMEVAL_HARD_CAP_MODEL,
    text: JSON.stringify(payload),
    usage: usage(),
    usageDetails: {
      candidateTokens: 5,
      thoughtTokens: 0,
    },
    validated: true,
  }
}

function nativeFunctionCall(name, args = {}, { id } = {}) {
  const functionCall = { args, name }
  if (id !== undefined) functionCall.id = id
  return functionCall
}

function functionCallsResult(functionCalls, {
  candidateParts,
} = {}) {
  return {
    candidateContent: {
      parts: candidateParts ??
        functionCalls.map((functionCall) => ({ functionCall })),
      role: 'model',
    },
    finishReason: 'STOP',
    functionCalls,
    modelVersion: INCREMENTAL_LONGMEMEVAL_HARD_CAP_MODEL,
    responseType: 'function_calls',
    text: null,
    usage: usage(),
    validated: true,
  }
}

function functionCallResult(name, args = {}, {
  id,
  thoughtSignature,
} = {}) {
  const functionCall = nativeFunctionCall(name, args, { id })
  const part = { functionCall }
  if (thoughtSignature !== undefined) {
    part.thoughtSignature = thoughtSignature
  }
  return functionCallsResult([functionCall], {
    candidateParts: [part],
  })
}

function finalTextResult(text) {
  return {
    candidateContent: {
      parts: [{ text }],
      role: 'model',
    },
    finishReason: 'STOP',
    functionCalls: [],
    modelVersion: INCREMENTAL_LONGMEMEVAL_HARD_CAP_MODEL,
    responseType: 'final_text',
    text,
    usage: usage(),
    validated: true,
  }
}

async function privateRoot(prefix) {
  return mkdtemp(join(tmpdir(), prefix))
}

test('opt-in exploration batches 20+tail and preserves miss, reword, read, and native history',
  async () => {
    const root = await privateRoot('palari-exploration-batch-')
    const writerEvidenceCounts = []
    const exploreBodies = []
    const checkpoints = []
    let exploreDispatch = 0
    try {
      const result =
        await runIncrementalLongMemEvalQuestionForScoring({
          async callGemini(request) {
            if (request.purpose === 'writer') {
              writerEvidenceCounts.push(
                providerInput(request.body).evidence.length,
              )
              assert.deepEqual(
                request.body.generationConfig,
                INCREMENTAL_LONGMEMEVAL_EXPLORATION_REDUCER_GENERATION,
              )
              return writerResult(request.body)
            }
            assert.equal(request.purpose, 'explore')
            exploreBodies.push(structuredClone(request.body))
            exploreDispatch += 1
            if (exploreDispatch === 1) {
              return functionCallResult(
                'memory_find',
                { phrase: 'locker code' },
                {
                  id: 'find-miss',
                  thoughtSignature: 'opaque-thought-signature-1',
                },
              )
            }
            if (exploreDispatch === 2) {
              const miss = request.body.contents.at(-1)
                .parts[0].functionResponse
              assert.equal(miss.id, 'find-miss')
              assert.equal(miss.response.matches.length, 0)
              return functionCallResult(
                'memory_find',
                { phrase: 'safe combination' },
                { id: 'find-hit' },
              )
            }
            if (exploreDispatch === 3) {
              const hit = request.body.contents.at(-1)
                .parts[0].functionResponse.response
              assert.equal(hit.matches.length, 1)
              return functionCallResult('memory_read', {
                evidenceIds: hit.matches.map(
                  ({ evidenceId }) => evidenceId,
                ),
              })
            }
            if (exploreDispatch === 4) {
              const read = request.body.contents.at(-1)
                .parts[0].functionResponse.response
              assert.match(read.messages[0].text, /ORBIT-7731/)
              return finalTextResult(
                `Your emergency access value is ${GOLD_ANSWER}.`,
              )
            }
            throw new Error('unexpected exploration dispatch')
          },
          instance: fixture(),
          mode: 'exploration',
          async onCheckpoint(checkpoint) {
            checkpoints.push(structuredClone(checkpoint))
          },
          workspaceDir: join(root, 'workspace'),
        })

      assert.equal(
        INCREMENTAL_LONGMEMEVAL_EXPLORATION_RESPONSE_SCHEMA
          .properties.dispositions.maxItems,
        INCREMENTAL_LONGMEMEVAL_EXPLORATION_MAX_DISPOSITIONS,
      )
      assert.deepEqual(writerEvidenceCounts, [40, 2])
      assert.equal(result.interactions, 21)
      assert.equal(result.canonicalRows, 42)
      assert.equal(result.logicalOperations.reducer, 2)
      assert.equal(result.tailDrain.applied, 1)
      assert.equal(result.digestStatus.pending, 0)
      assert.equal(result.digestStatus.ready, true)
      assert.equal(checkpoints.length, 21)
      assert.equal(checkpoints[18].digest.pending, 19)
      assert.equal(checkpoints[19].digest.pending, 0)
      assert.equal(checkpoints[20].digest.pending, 0)

      assert.equal(result.answer,
        `Your emergency access value is ${GOLD_ANSWER}.`)
      assert.deepEqual(
        result.toolTranscript.map(({ tool }) => tool),
        ['memory_find', 'memory_find', 'memory_read'],
      )
      assert.equal(result.toolTranscript[0].result.matches.length, 0)
      assert.equal(result.toolTranscript[1].result.matches.length, 1)
      assert.equal(result.toolTranscript[2].result.messages.length, 1)
      assert.deepEqual(
        result.toolTranscript.map(({ modelDispatch }) =>
          modelDispatch),
        [1, 2, 3],
      )
      assert.equal(result.explorationCalls, 3)
      assert.equal(result.explorationExhausted, false)
      assert.equal(result.modelTurns.length, 4)
      assert.ok(result.consultedEvidenceIds.length >= 1)

      const initial = exploreBodies[0]
      assert.deepEqual(initial.generationConfig,
        INCREMENTAL_LONGMEMEVAL_EXPLORATION_GENERATION)
      assert.equal(
        initial.systemInstruction.parts[0].text,
        INCREMENTAL_LONGMEMEVAL_EXPLORATION_SYSTEM_INSTRUCTION,
      )
      assert.deepEqual(
        initial.tools,
        INCREMENTAL_LONGMEMEVAL_EXPLORATION_TOOLS,
      )
      assert.deepEqual(
        initial.toolConfig,
        INCREMENTAL_LONGMEMEVAL_EXPLORATION_TOOL_CONFIG,
      )
      assert.equal(initial.contents.length, 1)
      assert.equal(
        initial.contents[0].parts[0].text,
        [
          'Question date: 2026-02-28T00:00:00.000Z',
          'Question: What is my emergency access value?',
        ].join('\n'),
      )
      const initialBytes = JSON.stringify(initial)
      assert.equal(initialBytes.includes(GOLD_ANSWER), false)
      assert.equal(initialBytes.includes(GOLD_SESSION_METADATA), false)
      assert.equal(initialBytes.includes('locker code'), false)
      assert.equal(initialBytes.includes('safe combination'), false)

      assert.deepEqual(
        exploreBodies[1].contents[1],
        exploreBodies[0].contents.length === 1
          ? result.modelTurns[0].candidateContent
          : null,
      )
      assert.equal(
        exploreBodies[1].contents[1]
          .parts[0].thoughtSignature,
        'opaque-thought-signature-1',
      )
      assert.equal(
        exploreBodies[1].contents[2]
          .parts[0].functionResponse.id,
        'find-miss',
      )
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

test('parallel calls execute in order and replay exact multipart content in one response content',
  async () => {
    const root = await privateRoot('palari-exploration-parallel-')
    const exploreBodies = []
    const firstCalls = [
      nativeFunctionCall(
        'memory_find',
        { phrase: 'locker code' },
        { id: 'parallel-miss' },
      ),
      nativeFunctionCall(
        'memory_find',
        { phrase: 'safe combination' },
        { id: 'parallel-hit' },
      ),
    ]
    const firstCandidateParts = [
      {
        partMetadata: { channel: 'orientation' },
        text: 'I will inspect both plausible phrasings.',
        thought: false,
        thoughtSignature: 'parallel-text-signature',
      },
      {
        functionCall: firstCalls[0],
        thoughtSignature: 'parallel-call-signature-a',
      },
      { text: 'The calls remain tool requests, not an answer.' },
      {
        functionCall: firstCalls[1],
        thoughtSignature: 'parallel-call-signature-b',
      },
    ]
    let exploreDispatch = 0
    try {
      const result =
        await runIncrementalLongMemEvalQuestionWithExploration({
          async callGemini(request) {
            if (request.purpose === 'writer') {
              return writerResult(request.body)
            }
            exploreBodies.push(structuredClone(request.body))
            exploreDispatch += 1
            if (exploreDispatch === 1) {
              return functionCallsResult(firstCalls, {
                candidateParts: firstCandidateParts,
              })
            }
            if (exploreDispatch === 2) {
              assert.deepEqual(
                request.body.contents[1],
                {
                  parts: firstCandidateParts,
                  role: 'model',
                },
              )
              const responseContent = request.body.contents[2]
              assert.equal(responseContent.role, 'user')
              assert.equal(responseContent.parts.length, 2)
              const [miss, hit] = responseContent.parts.map(
                (part) => part.functionResponse,
              )
              assert.equal(miss.id, 'parallel-miss')
              assert.equal(miss.name, 'memory_find')
              assert.equal(miss.response.matches.length, 0)
              assert.equal(hit.id, 'parallel-hit')
              assert.equal(hit.name, 'memory_find')
              assert.equal(hit.response.matches.length, 1)
              return functionCallResult('memory_read', {
                evidenceIds: hit.response.matches.map(
                  ({ evidenceId }) => evidenceId,
                ),
              }, { id: 'read-after-parallel' })
            }
            if (exploreDispatch === 3) {
              return finalTextResult(GOLD_ANSWER)
            }
            throw new Error('unexpected exploration dispatch')
          },
          instance: fixture(21, {
            questionId: 'parallel-exploration-fixture',
          }),
          workspaceDir: join(root, 'workspace'),
        })

      assert.equal(exploreBodies.length, 3)
      assert.equal(result.modelTurns.length, 3)
      assert.deepEqual(
        result.modelTurns[0].functionCalls,
        firstCalls,
      )
      assert.deepEqual(
        result.toolTranscript.map(({ tool, modelDispatch }) => [
          tool,
          modelDispatch,
        ]),
        [
          ['memory_find', 1],
          ['memory_find', 1],
          ['memory_read', 2],
        ],
      )
      assert.equal(result.toolTranscript[0].result.matches.length, 0)
      assert.equal(result.toolTranscript[1].result.matches.length, 1)
      assert.ok(result.consultedEvidenceIds.length >= 1)
      assert.equal(result.answer, GOLD_ANSWER)
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

test('timeline then session read is a second valid recovery route',
  async () => {
    const root = await privateRoot('palari-exploration-timeline-')
    let exploreDispatch = 0
    try {
      const result =
        await runIncrementalLongMemEvalQuestionWithExploration({
          async callGemini(request) {
            if (request.purpose === 'writer') {
              return writerResult(request.body)
            }
            exploreDispatch += 1
            if (exploreDispatch === 1) {
              return functionCallResult('memory_timeline', {})
            }
            if (exploreDispatch === 2) {
              const timeline = request.body.contents.at(-1)
                .parts[0].functionResponse.response
              assert.equal(timeline.totalSessions, 21)
              return functionCallResult('memory_read', {
                session: timeline.sessions[5].session,
              })
            }
            if (exploreDispatch === 3) {
              const read = request.body.contents.at(-1)
                .parts[0].functionResponse.response
              assert.match(read.messages[0].text, /safe combination/)
              return finalTextResult(GOLD_ANSWER)
            }
            throw new Error('unexpected exploration dispatch')
          },
          instance: fixture(21, {
            questionId: 'timeline-recovery-fixture',
          }),
          workspaceDir: join(root, 'workspace'),
        })

      assert.deepEqual(
        result.toolTranscript.map(({ tool }) => tool),
        ['memory_timeline', 'memory_read'],
      )
      assert.equal(result.explorationCalls, 2)
      assert.ok(result.consultedEvidenceIds.length >= 1)
      assert.equal(result.answer, GOLD_ANSWER)
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

test('six tools use seven model turns and a seventh request never causes dispatch eight',
  async () => {
    const root = await privateRoot('palari-exploration-ceiling-')
    const exploreBodies = []
    const progress = []
    try {
      await assert.rejects(
        runIncrementalLongMemEvalQuestionWithExploration({
          async callGemini(request) {
            if (request.purpose === 'writer') {
              return writerResult(request.body)
            }
            exploreBodies.push(structuredClone(request.body))
            return functionCallResult(
              'memory_timeline',
              {},
              { id: `timeline-${exploreBodies.length}` },
            )
          },
          instance: fixture(1, {
            questionId: 'exploration-ceiling-fixture',
          }),
          async onExplorationCheckpoint(checkpoint) {
            progress.push(structuredClone(checkpoint))
          },
          workspaceDir: join(root, 'workspace'),
        }),
        (error) =>
          error?.code ===
            'INCREMENTAL_EXPLORATION_BUDGET_EXHAUSTED',
      )
      assert.equal(exploreBodies.length, 7)
      assert.equal(exploreBodies[6].contents.length, 13)
      assert.equal(
        exploreBodies[6].contents
          .filter(({ role }) => role === 'user').length,
        7,
      )
      assert.equal(progress.length, 14)
      assert.deepEqual(
        progress.map(({ phase }) => phase),
        [
          'model_turn',
          'tool_batch',
          'model_turn',
          'tool_batch',
          'model_turn',
          'tool_batch',
          'model_turn',
          'tool_batch',
          'model_turn',
          'tool_batch',
          'model_turn',
          'tool_batch',
          'model_turn',
          'failure',
        ],
      )
      assert.equal(progress.at(-1).answerModelDispatches, 7)
      assert.equal(progress.at(-1).explorationCalls, 6)
      assert.equal(progress.at(-1).explorationExhausted, true)
      assert.equal(progress.at(-1).modelTurns.length, 7)
      assert.equal(progress.at(-1).toolTranscript.length, 6)
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

test('a parallel batch that exceeds the remaining tool budget executes none',
  async () => {
    const root = await privateRoot('palari-exploration-batch-cap-')
    const progress = []
    let exploreDispatches = 0
    const firstBatch = Array.from({ length: 5 }, (_, index) =>
      nativeFunctionCall(
        'memory_timeline',
        {},
        { id: `first-batch-${index + 1}` },
      ))
    const overBudgetBatch = [
      nativeFunctionCall(
        'memory_timeline',
        {},
        { id: 'over-budget-1' },
      ),
      nativeFunctionCall(
        'memory_timeline',
        {},
        { id: 'over-budget-2' },
      ),
    ]
    try {
      await assert.rejects(
        runIncrementalLongMemEvalQuestionWithExploration({
          async callGemini(request) {
            if (request.purpose === 'writer') {
              return writerResult(request.body)
            }
            exploreDispatches += 1
            return exploreDispatches === 1
              ? functionCallsResult(firstBatch)
              : functionCallsResult(overBudgetBatch)
          },
          instance: fixture(1, {
            questionId: 'parallel-batch-cap-fixture',
          }),
          async onExplorationCheckpoint(checkpoint) {
            progress.push(structuredClone(checkpoint))
          },
          workspaceDir: join(root, 'workspace'),
        }),
        (error) => {
          assert.equal(
            error?.code,
            'INCREMENTAL_EXPLORATION_BUDGET_EXHAUSTED',
          )
          assert.equal(
            error.explorationPartial.explorationCalls,
            5,
          )
          assert.equal(
            error.explorationPartial.explorationExhausted,
            true,
          )
          assert.deepEqual(
            error.explorationPartial.toolTranscript.map(
              ({ modelDispatch }) => modelDispatch,
            ),
            [1, 1, 1, 1, 1],
          )
          return true
        },
      )
      assert.equal(exploreDispatches, 2)
      assert.deepEqual(
        progress.map(({ phase, explorationCalls }) => [
          phase,
          explorationCalls,
        ]),
        [
          ['model_turn', 0],
          ['tool_batch', 5],
          ['model_turn', 5],
          ['failure', 5],
        ],
      )
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

test('six completed tools followed by text use exactly seven model dispatches',
  async () => {
    const root = await privateRoot('palari-exploration-six-tools-')
    let exploreDispatches = 0
    try {
      const result =
        await runIncrementalLongMemEvalQuestionWithExploration({
          async callGemini(request) {
            if (request.purpose === 'writer') {
              return writerResult(request.body)
            }
            exploreDispatches += 1
            return exploreDispatches <= 6
              ? functionCallResult(
                  'memory_timeline',
                  {},
                  { id: `timeline-${exploreDispatches}` },
                )
              : finalTextResult('Finished after six bounded looks.')
          },
          instance: fixture(1, {
            questionId: 'six-tool-success-fixture',
          }),
          workspaceDir: join(root, 'workspace'),
        })

      assert.equal(exploreDispatches, 7)
      assert.equal(result.explorationCalls, 6)
      assert.equal(result.explorationExhausted, false)
      assert.equal(result.modelTurns.length, 7)
      assert.equal(result.modelTurns.at(-1).responseType, 'final_text')
      assert.equal(result.logicalOperations.answerModel, 7)
      assert.equal(result.toolTranscript.length, 6)
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

test('a later model failure retains the last exact tool trace',
  async () => {
    const root = await privateRoot('palari-exploration-failure-trace-')
    const progress = []
    const transportFailure = new Error('synthetic second dispatch failure')
    transportFailure.code = 'SYNTHETIC_EXPLORATION_TRANSPORT_FAILURE'
    let exploreDispatches = 0
    try {
      await assert.rejects(
        runIncrementalLongMemEvalQuestionWithExploration({
          async callGemini(request) {
            if (request.purpose === 'writer') {
              return writerResult(request.body)
            }
            exploreDispatches += 1
            if (exploreDispatches === 1) {
              return functionCallResult(
                'memory_timeline',
                {},
                {
                  id: 'timeline-before-failure',
                  thoughtSignature: 'preserved-before-failure',
                },
              )
            }
            throw transportFailure
          },
          instance: fixture(1, {
            questionId: 'exploration-failure-trace-fixture',
          }),
          async onExplorationCheckpoint(checkpoint) {
            progress.push(structuredClone(checkpoint))
          },
          workspaceDir: join(root, 'workspace'),
        }),
        (error) => {
          assert.equal(error, transportFailure)
          assert.equal(
            error.explorationPartial.answerModelDispatches,
            2,
          )
          assert.equal(error.explorationPartial.explorationCalls, 1)
          assert.equal(
            error.explorationPartial.phase,
            'failure',
          )
          assert.equal(error.explorationPartial.modelTurns.length, 1)
          assert.equal(
            error.explorationPartial.toolTranscript.length,
            1,
          )
          return true
        },
      )
      assert.equal(exploreDispatches, 2)
      assert.deepEqual(
        progress.map(({ phase }) => phase),
        ['model_turn', 'tool_batch', 'failure'],
      )
      assert.equal(
        progress[0].modelTurns[0]
          .candidateContent.parts[0].thoughtSignature,
        'preserved-before-failure',
      )
      assert.equal(
        progress[1].toolTranscript[0].tool,
        'memory_timeline',
      )
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

test('a failing parallel tool batch checkpoints its executed prefix',
  async () => {
    const root = await privateRoot(
      'palari-exploration-parallel-failure-',
    )
    const progress = []
    let exploreDispatches = 0
    try {
      await assert.rejects(
        runIncrementalLongMemEvalQuestionWithExploration({
          async callGemini(request) {
            if (request.purpose === 'writer') {
              return writerResult(request.body)
            }
            exploreDispatches += 1
            return functionCallsResult([
              nativeFunctionCall(
                'memory_timeline',
                {},
                { id: 'parallel-prefix-success' },
              ),
              nativeFunctionCall(
                'memory_read',
                {},
                { id: 'parallel-second-fails' },
              ),
            ])
          },
          instance: fixture(1, {
            questionId: 'parallel-tool-failure-fixture',
          }),
          async onExplorationCheckpoint(checkpoint) {
            progress.push(structuredClone(checkpoint))
          },
          workspaceDir: join(root, 'workspace'),
        }),
        (error) => {
          assert.match(error?.message ?? '', /read requires/)
          assert.equal(
            error.explorationPartial.explorationCalls,
            1,
          )
          assert.equal(
            error.explorationPartial.toolTranscript[0].tool,
            'memory_timeline',
          )
          assert.equal(
            error.explorationPartial.toolTranscript[0]
              .modelDispatch,
            1,
          )
          assert.equal(error.explorationPartial.modelTurns.length, 1)
          assert.equal(error.explorationPartial.phase, 'failure')
          return true
        },
      )
      assert.equal(exploreDispatches, 1)
      assert.deepEqual(
        progress.map(({ phase, explorationCalls }) => [
          phase,
          explorationCalls,
        ]),
        [
          ['model_turn', 0],
          ['failure', 1],
        ],
      )
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

test('malformed, unknown, and contradictory call responses fail closed',
  async (t) => {
    const validCall = functionCallResult(
      'memory_timeline',
      {},
    )
    const cases = [
      {
        label: 'malformed',
        response: {
          ...validCall,
          candidateContent: {
            parts: [{}],
            role: 'model',
          },
        },
      },
      {
        label: 'unknown',
        response: functionCallResult(
          'memory_delete_everything',
          {},
        ),
      },
      {
        label: 'nonnull-call-text',
        response: {
          ...validCall,
          text: 'I also answered.',
        },
      },
    ]

    for (const [index, entry] of cases.entries()) {
      await t.test(entry.label, async () => {
        const root = await privateRoot(
          `palari-exploration-${entry.label}-`,
        )
        try {
          await assert.rejects(
            runIncrementalLongMemEvalQuestionWithExploration({
              async callGemini(request) {
                return request.purpose === 'writer'
                  ? writerResult(request.body)
                  : structuredClone(entry.response)
              },
              instance: fixture(1, {
                questionId:
                  `invalid-exploration-response-${index}`,
              }),
              workspaceDir: join(root, 'workspace'),
            }),
            (error) =>
              error?.code ===
                'INCREMENTAL_EXPLORATION_RESPONSE_INVALID',
          )
        } finally {
          await rm(root, { force: true, recursive: true })
        }
      })
    }
  })

test('one quarantined interaction is recorded as a miss without losing canonical replay',
  async () => {
    const root = await privateRoot('palari-exploration-quarantine-')
    let writerDispatch = 0
    try {
      const result =
        await runIncrementalLongMemEvalQuestionWithExploration({
          async callGemini(request) {
            if (request.purpose === 'explore') {
              return finalTextResult(
                'I could not recover that interaction from the digest.',
              )
            }
            writerDispatch += 1
            if (writerDispatch <= 2) {
              const input = providerInput(request.body)
              return writerResult(request.body, {
                baseRevision: input.baseRevision,
              })
            }
            return writerResult(request.body)
          },
          instance: fixture(2, {
            questionId: 'quarantine-exploration-fixture',
          }),
          workspaceDir: join(root, 'workspace'),
        })

      assert.equal(writerDispatch, 3)
      assert.equal(result.canonicalRows, 4)
      assert.equal(result.digestStatus.pending, 0)
      assert.equal(result.digestStatus.ready, true)
      assert.equal(result.digestStatus.status, 'ready_with_gaps')
      assert.equal(result.quarantineStats.count, 1)
      assert.equal(result.quarantineStats.predictionMiss, true)
      assert.equal(result.ingestionPredictionMiss, true)
      assert.equal(result.quarantinedUnits[0].unitOrder, 1)
      assert.deepEqual(
        result.reducerEvidence.map((event) => [
          event.dispatch,
          event.evidenceIds.length,
        ]),
        [
          [1, 4],
          [2, 2],
          [3, 2],
        ],
      )
      assert.deepEqual(
        result.interactionCheckpoints.at(-1).reducerEvents,
        result.reducerEvidence,
      )
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

test('Gemini declarations are an exact frozen mapping of product tools',
  () => {
    assert.equal(
      Object.isFrozen(INCREMENTAL_LONGMEMEVAL_EXPLORATION_TOOLS),
      true,
    )
    assert.deepEqual(
      INCREMENTAL_LONGMEMEVAL_EXPLORATION_TOOLS[0]
        .functionDeclarations,
      MEMORY_EXPLORATION_TOOLS.map((tool) => ({
        description: tool.description,
        name: tool.name,
        parameters: tool.parameters,
      })),
    )
    assert.deepEqual(
      INCREMENTAL_LONGMEMEVAL_EXPLORATION_TOOL_CONFIG,
      { functionCallingConfig: { mode: 'AUTO' } },
    )
  })

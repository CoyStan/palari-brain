import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  ACTIVE_MEMORY_MAX_ACTIONS,
  ACTIVE_MEMORY_MAX_BASIS,
} from '../src/index.mjs'
import {
  INCREMENTAL_LONGMEMEVAL_ANSWER_GENERATION,
  INCREMENTAL_LONGMEMEVAL_RESPONSE_SCHEMA,
  INCREMENTAL_LONGMEMEVAL_REDUCER_GENERATION,
  buildIncrementalLongMemEvalAnswerBody,
  buildIncrementalLongMemEvalReducerBody,
  incrementalLongMemEvalExchangePlan,
  incrementalLongMemEvalExchangeStats,
  runIncrementalLongMemEvalQuestion,
} from '../evals/arms/incremental-memory-longmemeval-live-arm.mjs'

const MODEL_VERSION = 'gemini-3.5-flash-lite'

function validated(text) {
  return {
    finishReason: 'STOP',
    modelVersion: MODEL_VERSION,
    text,
    usage: {
      geminiInputTokens: 10,
      geminiOutputTokens: 5,
      judgeInputTokens: 0,
      judgeOutputTokens: 0,
      usd: 0.0000155,
    },
    usageDetails: {
      candidateTokens: 5,
      thoughtTokens: 0,
    },
    validated: true,
  }
}

function fixture() {
  return {
    answer: 'mint tea',
    answerSessionIds: ['later-session'],
    isAbstention: false,
    question:
      'FINAL QUESTION SENTINEL: Which tea does the user prefer now?',
    questionDate: '2026-01-03T00:00:00.000Z',
    questionId: 'incremental-longmemeval-fixture',
    questionType: 'knowledge-update',
    // Deliberately reversed: the adapter must replay by eventAt, not array
    // position.
    sessions: [
      {
        eventAt: '2026-01-02T00:00:00.000Z',
        sessionId: 'later-session',
        turns: [
          { content: 'I now prefer mint tea.', role: 'user' },
          {
            content: 'I will use your updated preference.',
            role: 'assistant',
          },
        ],
      },
      {
        eventAt: '2026-01-01T00:00:00.000Z',
        sessionId: 'earlier-session',
        turns: [
          { content: 'I prefer black tea.', role: 'user' },
          {
            content: 'I will remember your tea preference.',
            role: 'assistant',
          },
        ],
      },
    ],
  }
}

function reducerPayload(body) {
  const providerInput = JSON.parse(body.contents[0].parts[0].text)
  const { baseRevision, evidence, prior } = providerInput.input
  const user = evidence.find((entry) => entry.speaker === 'user')
  const assistant = evidence.find(
    (entry) => entry.speaker === 'Palari',
  )
  assert.ok(user)
  assert.ok(assistant)
  const correction = prior.length > 0
  return {
    actions: [{
      basis: [
        {
          id: user.id,
          kind: 'evidence',
          quote: user.text,
        },
        ...(correction
          ? [{
              id: prior[0].id,
              kind: 'memory',
              quote: '',
            }]
          : []),
      ],
      epistemic: 'asserted',
      op: correction ? 'replace' : 'add',
      relation: correction ? 'supersedes' : null,
      statement: correction
        ? 'The user currently prefers mint tea.'
        : 'The user prefers black tea.',
      targetIds: correction ? [prior[0].id] : [],
      timeBasis: null,
      topic: correction ? prior[0].topic : 'tea preference',
    }],
    baseRevision,
    // The full schema must permit one exact disposition for both messages,
    // even though only the user's statement becomes active memory.
    dispositions: [
      {
        evidenceId: user.id,
        outcome: 'used',
      },
      {
        evidenceId: assistant.id,
        outcome: 'no_memory',
      },
    ],
  }
}

test('full reducer schema mirrors feasible host limits and no-store mapping',
  () => {
    const action = INCREMENTAL_LONGMEMEVAL_RESPONSE_SCHEMA
      .properties.actions
    assert.equal(action.maxItems, ACTIVE_MEMORY_MAX_ACTIONS)
    assert.equal(
      action.items.properties.basis.maxItems,
      ACTIVE_MEMORY_MAX_BASIS,
    )
    assert.equal(
      action.items.properties.targetIds.maxItems,
      ACTIVE_MEMORY_MAX_BASIS - 1,
    )
    assert.equal(
      INCREMENTAL_LONGMEMEVAL_RESPONSE_SCHEMA
        .properties.dispositions.maxItems,
      2,
    )
    assert.deepEqual(INCREMENTAL_LONGMEMEVAL_REDUCER_GENERATION, {
      maxOutputTokens: 2_000,
      responseFormat: {
        text: {
          mimeType: 'APPLICATION_JSON',
          schema: INCREMENTAL_LONGMEMEVAL_RESPONSE_SCHEMA,
        },
      },
      thinkingConfig: { thinkingLevel: 'MINIMAL' },
    })
    assert.deepEqual(INCREMENTAL_LONGMEMEVAL_ANSWER_GENERATION, {
      maxOutputTokens: 256,
      thinkingConfig: { thinkingLevel: 'MINIMAL' },
    })

    const malicious = {
      contractVersion: 'active-memory-reducer/v1',
      input: {
        baseRevision: 0,
        evidence: [],
        limits: {},
        prior: [],
      },
      systemInstructions: { MALICIOUS_SYSTEM_SENTINEL: true },
    }
    const reducer = buildIncrementalLongMemEvalReducerBody(malicious)
    assert.equal(reducer.store, false)
    assert.equal(
      JSON.stringify(reducer.systemInstruction).includes(
        'MALICIOUS_SYSTEM_SENTINEL',
      ),
      false,
    )
    assert.deepEqual(
      Object.keys(JSON.parse(
        reducer.contents[0].parts[0].text,
      )),
      ['contractVersion', 'input'],
    )
    const answer =
      buildIncrementalLongMemEvalAnswerBody('answer prompt')
    assert.equal(answer.store, false)
    assert.deepEqual(
      answer.generationConfig,
      INCREMENTAL_LONGMEMEVAL_ANSWER_GENERATION,
    )
  })

test('exchange metadata is chronological and deterministic', () => {
  const plan = incrementalLongMemEvalExchangePlan(fixture())
  const stats = incrementalLongMemEvalExchangeStats(fixture())
  assert.equal(Object.isFrozen(plan), true)
  assert.deepEqual(
    plan.map((exchange) => exchange.sessionId),
    ['earlier-session', 'later-session'],
  )
  assert.deepEqual(stats, {
    exchangePlanSha256:
      stats.exchangePlanSha256,
    interactions: 2,
    maximumInteractionChars: 57,
    rawTurns: 4,
    reducerLogicalRequests: 2,
    visibleChars: 112,
    visibleMessages: 4,
  })
  assert.match(stats.exchangePlanSha256, /^[a-f0-9]{64}$/)
})

test('chronological replay checkpoints every reduction and answers once',
  async () => {
    const root = await mkdtemp(
      join(tmpdir(), 'palari-incremental-longmemeval-'),
    )
    const calls = []
    const checkpoints = []
    try {
      const result = await runIncrementalLongMemEvalQuestion({
        async callGemini(request) {
          calls.push(structuredClone(request))
          if (request.purpose === 'answer') {
            return validated('You currently prefer mint tea.')
          }
          return validated(JSON.stringify(
            reducerPayload(request.body),
          ))
        },
        instance: fixture(),
        async onCheckpoint(checkpoint) {
          checkpoints.push(structuredClone(checkpoint))
        },
        workspaceDir: join(root, 'workspace'),
      })

      assert.deepEqual(
        calls.map((call) => [call.purpose, call.operationId]),
        [
          [
            'writer',
            'question:incremental-longmemeval-fixture:reducer:1',
          ],
          [
            'writer',
            'question:incremental-longmemeval-fixture:reducer:2',
          ],
          [
            'answer',
            'question:incremental-longmemeval-fixture:answer',
          ],
        ],
      )
      const firstInput = JSON.parse(
        calls[0].body.contents[0].parts[0].text,
      ).input
      const secondInput = JSON.parse(
        calls[1].body.contents[0].parts[0].text,
      ).input
      assert.equal(firstInput.baseRevision, 0)
      assert.deepEqual(
        firstInput.evidence.map((entry) => [
          entry.speaker,
          entry.text,
        ]),
        [
          ['user', 'I prefer black tea.'],
          [
            'Palari',
            'I will remember your tea preference.',
          ],
        ],
      )
      assert.equal(firstInput.prior.length, 0)
      assert.equal(secondInput.baseRevision, 1)
      assert.equal(secondInput.prior.length, 1)
      assert.deepEqual(
        secondInput.evidence.map((entry) => [
          entry.speaker,
          entry.text,
        ]),
        [
          ['user', 'I now prefer mint tea.'],
          [
            'Palari',
            'I will use your updated preference.',
          ],
        ],
      )
      for (const call of calls.filter((entry) =>
        entry.purpose === 'writer')) {
        assert.equal(
          call.body.contents[0].parts[0].text.includes(
            'FINAL QUESTION SENTINEL',
          ),
          false,
        )
      }
      assert.match(
        calls[2].body.contents[0].parts[0].text,
        /FINAL QUESTION SENTINEL/,
      )

      assert.equal(checkpoints.length, 2)
      assert.deepEqual(
        checkpoints.map((entry) => [
          entry.completedInteraction,
          entry.sessionId,
          entry.digest.digestRevision,
          entry.digest.pending,
        ]),
        [
          [1, 'earlier-session', 1, 0],
          [2, 'later-session', 2, 0],
        ],
      )
      for (const checkpoint of checkpoints) {
        assert.equal(checkpoint.status, 'completed')
        assert.equal(checkpoint.activeMemories.length, 1)
        assert.match(
          checkpoint.activeMemoriesSha256,
          /^[a-f0-9]{64}$/,
        )
        assert.match(
          checkpoint.reducerRequestSha256,
          /^[a-f0-9]{64}$/,
        )
        assert.match(
          checkpoint.reducerResponseSha256,
          /^[a-f0-9]{64}$/,
        )
        assert.ok(checkpoint.digestChars <= 24_000)
      }
      assert.match(
        checkpoints[0].activeMemories[0].statement,
        /black tea/i,
      )
      assert.match(
        checkpoints[1].activeMemories[0].statement,
        /mint tea/i,
      )
      assert.deepEqual(
        checkpoints[1].activeMemories[0].supports.map(
          (support) => support.quote,
        ),
        [
          'I prefer black tea.',
          'I now prefer mint tea.',
        ],
      )

      assert.equal(result.interactions, 2)
      assert.equal(result.rawTurns, 4)
      assert.equal(result.canonicalRows, 4)
      assert.deepEqual(result.logicalOperations, {
        answer: 1,
        reducer: 2,
        total: 3,
      })
      assert.equal(result.answerProviderCalled, true)
      assert.equal(result.briefing.mode, 'incremental_digest')
      assert.equal(result.briefing.status, 'included')
      assert.equal(result.briefing.complete, true)
      assert.match(result.answer, /mint tea/i)
      assert.equal(result.digestStatus.ready, true)
      assert.equal(result.digestStatus.pending, 0)
      assert.equal(result.interactionCheckpoints.length, 2)
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

test('first reducer failure stops before checkpoints, later turns, or answer',
  async () => {
    const root = await mkdtemp(
      join(tmpdir(), 'palari-incremental-stop-'),
    )
    let calls = 0
    let checkpoints = 0
    try {
      await assert.rejects(
        runIncrementalLongMemEvalQuestion({
          async callGemini() {
            calls += 1
            const error = new Error('synthetic provider failure')
            error.code = 'SYNTHETIC_PROVIDER_FAILURE'
            throw error
          },
          instance: fixture(),
          async onCheckpoint() {
            checkpoints += 1
          },
          workspaceDir: join(root, 'workspace'),
        }),
        (error) =>
          error?.code === 'SYNTHETIC_PROVIDER_FAILURE',
      )
      assert.equal(calls, 1)
      assert.equal(checkpoints, 0)
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

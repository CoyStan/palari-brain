import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  mkdtemp,
  rm,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  createActiveBrainMeteredTransport,
} from '../evals/active-brain-live-meter.mjs'
import {
  buildIncrementalLongMemEvalAnswerBody,
  buildIncrementalLongMemEvalReducerBody,
  INCREMENTAL_LONGMEMEVAL_ANSWER_GENERATION,
  INCREMENTAL_LONGMEMEVAL_MODEL,
  INCREMENTAL_LONGMEMEVAL_REDUCER_GENERATION,
  runIncrementalLongMemEvalQuestionForScoring,
} from '../evals/arms/incremental-memory-longmemeval-live-arm.mjs'
import {
  INCREMENTAL_LONGMEMEVAL_FRESH_SUBCAP_USD,
  INCREMENTAL_LONGMEMEVAL_GEMINI_LIMITS,
} from '../evals/incremental-longmemeval-live-config.mjs'
import {
  createIncrementalLongMemEvalGeminiTransport,
  INCREMENTAL_LONGMEMEVAL_GEMINI_CONTRACT,
} from '../evals/incremental-longmemeval-runtime.mjs'
import {
  buildIncrementalLongMemEvalJudgeBody,
  INCREMENTAL_LONGMEMEVAL_JUDGE_MODEL,
} from '../evals/incremental-longmemeval-judge.mjs'
import {
  createIncrementalLongMemEvalJudgeTransport,
} from '../evals/incremental-longmemeval-judge-transport.mjs'

const GEMINI_KEY = 'incremental-runtime-fake-gemini-key'
const OPENAI_KEY = 'incremental-runtime-fake-openai-key'

function geminiResponse(text) {
  return new Response(JSON.stringify({
    candidates: [{
      content: {
        parts: [{ text }],
        role: 'model',
      },
      finishReason: 'STOP',
    }],
    modelVersion: INCREMENTAL_LONGMEMEVAL_MODEL,
    usageMetadata: {
      candidatesTokenCount: 5,
      promptTokenCount: 20,
      serviceTier: 'standard',
      thoughtsTokenCount: 0,
      totalTokenCount: 25,
    },
  }), {
    headers: { 'content-type': 'application/json' },
    status: 200,
  })
}

function reducerBody() {
  return buildIncrementalLongMemEvalReducerBody({
    contractVersion: 'active-memory-reducer/v1',
    input: {
      baseRevision: 0,
      evidence: [],
      limits: {},
      prior: [],
    },
  })
}

function integrationInstance() {
  return {
    answer: 'mint tea',
    answerSessionIds: ['later-session'],
    isAbstention: false,
    question: 'Which tea does the user prefer now?',
    questionDate: '2026-01-03T00:00:00.000Z',
    questionId: 'offline-integration-question',
    questionType: 'knowledge-update',
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

function reducerCompletion(body) {
  const providerInput = JSON.parse(body.contents[0].parts[0].text)
  const { baseRevision, evidence, prior } = providerInput.input
  const user = evidence.find((entry) => entry.speaker === 'user')
  const assistant = evidence.find((entry) => entry.speaker === 'Palari')
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

function emptyReducerCompletion(body) {
  const providerInput = JSON.parse(body.contents[0].parts[0].text)
  return {
    actions: [],
    baseRevision: providerInput.input.baseRevision,
    dispositions: providerInput.input.evidence.map((entry) => ({
      evidenceId: entry.id,
      outcome: 'no_memory',
    })),
  }
}

function judgeResponse() {
  return new Response(JSON.stringify({
    choices: [{
      finish_reason: 'stop',
      index: 0,
      message: {
        content: 'yes',
        role: 'assistant',
      },
    }],
    model: INCREMENTAL_LONGMEMEVAL_JUDGE_MODEL,
    service_tier: 'default',
    usage: {
      completion_tokens: 1,
      prompt_tokens: 125,
      prompt_tokens_details: { cached_tokens: 0 },
      total_tokens: 126,
    },
  }), {
    headers: { 'content-type': 'application/json' },
    status: 200,
  })
}

test('incremental runtime composition import is inert', () => {
  const imported = spawnSync(process.execPath, [
    '--input-type=module',
    '--eval',
    [
      'globalThis.fetch=()=>{throw new Error("network on import")}',
      'await import("./evals/incremental-longmemeval-runtime.mjs")',
      'process.stdout.write("inert")',
    ].join(';'),
  ], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
  })
  assert.equal(imported.status, 0, imported.stderr)
  assert.equal(imported.stdout, 'inert')
})

test('runtime composition owns every frozen provider binding', () => {
  assert.equal(Object.isFrozen(INCREMENTAL_LONGMEMEVAL_GEMINI_CONTRACT), true)
  assert.deepEqual(
    Object.keys(INCREMENTAL_LONGMEMEVAL_GEMINI_CONTRACT).sort(),
    [
      'answerGeneration',
      'geminiModel',
      'writerGeneration',
    ],
  )
  assert.strictEqual(
    INCREMENTAL_LONGMEMEVAL_GEMINI_CONTRACT.answerGeneration,
    INCREMENTAL_LONGMEMEVAL_ANSWER_GENERATION,
  )
  assert.equal(
    INCREMENTAL_LONGMEMEVAL_GEMINI_CONTRACT.geminiModel,
    INCREMENTAL_LONGMEMEVAL_MODEL,
  )
  assert.strictEqual(
    INCREMENTAL_LONGMEMEVAL_GEMINI_CONTRACT.writerGeneration,
    INCREMENTAL_LONGMEMEVAL_REDUCER_GENERATION,
  )
  assert.equal(
    Object.values(INCREMENTAL_LONGMEMEVAL_GEMINI_CONTRACT)
      .includes(undefined),
    false,
  )
})

test('real meter fails closed when any composition binding is absent',
  async () => {
    const root = await mkdtemp(join(
      tmpdir(),
      'palari-incremental-runtime-missing-',
    ))
    try {
      const complete = {
        ...INCREMENTAL_LONGMEMEVAL_GEMINI_CONTRACT,
        capUsd: INCREMENTAL_LONGMEMEVAL_FRESH_SUBCAP_USD,
        fetchImpl: async () => {
          throw new Error('fetch must not run')
        },
        geminiApiKey: GEMINI_KEY,
        journalPath: join(root, 'meter.jsonl'),
        limits: INCREMENTAL_LONGMEMEVAL_GEMINI_LIMITS,
        openaiApiKey: OPENAI_KEY,
        transcriptDirectory: join(root, 'transcripts'),
      }
      for (const binding of [
        'answerGeneration',
        'geminiModel',
        'writerGeneration',
      ]) {
        const options = { ...complete }
        delete options[binding]
        await assert.rejects(
          createActiveBrainMeteredTransport(options),
          (error) => error?.code === 'ACTIVE_CONFIGURATION_MISSING',
          binding,
        )
      }
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

test('shared seam drives the real meter through writer and answer fake HTTP',
  async () => {
    const root = await mkdtemp(join(
      tmpdir(),
      'palari-incremental-runtime-real-',
    ))
    const requests = []
    let transport
    try {
      transport = await createIncrementalLongMemEvalGeminiTransport({
        capUsd: INCREMENTAL_LONGMEMEVAL_FRESH_SUBCAP_USD,
        async fetchImpl(url, init) {
          requests.push({
            body: JSON.parse(init.body),
            headers: { ...init.headers },
            method: init.method,
            url: String(url),
          })
          return geminiResponse(requests.length === 1
            ? JSON.stringify({
                actions: [],
                baseRevision: 0,
                dispositions: [],
              })
            : 'No current memory answers the question.')
        },
        geminiApiKey: GEMINI_KEY,
        journalPath: join(root, 'meter.jsonl'),
        limits: INCREMENTAL_LONGMEMEVAL_GEMINI_LIMITS,
        retryJitterImpl: () => 0,
        transcriptDirectory: join(root, 'transcripts'),
      })
      const writer = await transport.callGemini({
        body: reducerBody(),
        cellId: 'offline-writer',
        operationId: 'offline-writer:1',
        purpose: 'writer',
      })
      const answer = await transport.callGemini({
        body: buildIncrementalLongMemEvalAnswerBody(
          'Answer from the supplied digest.',
        ),
        cellId: 'offline-answer',
        operationId: 'offline-answer:1',
        purpose: 'answer',
      })
      const snapshot = await transport.snapshot()
      const verified = await transport.verify()

      assert.equal(Object.isFrozen(transport), true)
      assert.equal(Object.hasOwn(transport, 'callJudge'), false)
      assert.equal(writer.validated, true)
      assert.equal(answer.validated, true)
      assert.equal(requests.length, 2)
      for (const request of requests) {
        assert.equal(request.method, 'POST')
        assert.equal(
          request.url,
          `https://generativelanguage.googleapis.com/v1beta/models/${INCREMENTAL_LONGMEMEVAL_MODEL}:generateContent`,
        )
        assert.deepEqual(
          Object.keys(request.headers).sort(),
          ['content-type', 'x-goog-api-key'],
        )
        assert.equal(request.headers['x-goog-api-key'], GEMINI_KEY)
        assert.equal(request.body.store, false)
      }
      assert.deepEqual(
        requests[0].body.generationConfig,
        INCREMENTAL_LONGMEMEVAL_REDUCER_GENERATION,
      )
      assert.ok(requests[0].body.systemInstruction)
      assert.deepEqual(
        requests[1].body.generationConfig,
        INCREMENTAL_LONGMEMEVAL_ANSWER_GENERATION,
      )
      assert.equal(
        Object.hasOwn(requests[1].body, 'systemInstruction'),
        false,
      )
      assert.equal(snapshot.attempts, 2)
      assert.deepEqual(snapshot.logicalRequests, {
        answer: 1,
        writer: 1,
      })
      assert.equal(verified.ledger.attempts, 2)
      assert.equal(verified.transcripts.attempts, 2)
    } finally {
      transport?.closeNetworkGuard()
      await rm(root, { force: true, recursive: true })
    }
  })

test('shared seam forbids a retry after one retryable fake response',
  async () => {
    const root = await mkdtemp(join(
      tmpdir(),
      'palari-incremental-runtime-retry-',
    ))
    let calls = 0
    let transport
    try {
      transport = await createIncrementalLongMemEvalGeminiTransport({
        capUsd: INCREMENTAL_LONGMEMEVAL_FRESH_SUBCAP_USD,
        async fetchImpl() {
          calls += 1
          return new Response(JSON.stringify({
            error: { status: 'RESOURCE_EXHAUSTED' },
          }), {
            headers: { 'content-type': 'application/json' },
            status: 429,
          })
        },
        geminiApiKey: GEMINI_KEY,
        journalPath: join(root, 'meter.jsonl'),
        limits: INCREMENTAL_LONGMEMEVAL_GEMINI_LIMITS,
        retryJitterImpl: () => 0,
        transcriptDirectory: join(root, 'transcripts'),
      })
      await assert.rejects(
        transport.callGemini({
          body: reducerBody(),
          cellId: 'offline-retry',
          operationId: 'offline-retry:1',
          purpose: 'writer',
        }),
        (error) =>
          error?.code === 'INCREMENTAL_LONGMEMEVAL_RETRY_FORBIDDEN',
      )
      const snapshot = await transport.snapshot()
      const verified = await transport.verify()
      assert.equal(calls, 1)
      assert.equal(snapshot.attempts, 1)
      assert.deepEqual(snapshot.logicalRequests, { writer: 1 })
      assert.ok(snapshot.uncertain.usd > 0)
      assert.equal(verified.ledger.attempts, 1)
      assert.equal(verified.transcripts.attempts, 1)
    } finally {
      transport?.closeNetworkGuard()
      await rm(root, { force: true, recursive: true })
    }
  })

test('honest absence crosses the real Gemini and judge meters without an answer call',
  async () => {
    const root = await mkdtemp(join(
      tmpdir(),
      'palari-incremental-runtime-empty-chain-',
    ))
    const instance = integrationInstance()
    let geminiCalls = 0
    let answerCalls = 0
    let judgeCalls = 0
    let gemini
    try {
      gemini = await createIncrementalLongMemEvalGeminiTransport({
        capUsd: INCREMENTAL_LONGMEMEVAL_FRESH_SUBCAP_USD,
        async fetchImpl(_url, init) {
          geminiCalls += 1
          const body = JSON.parse(init.body)
          if (!body.systemInstruction) {
            answerCalls += 1
            throw new Error('empty memory must not call the answer model')
          }
          return geminiResponse(JSON.stringify(emptyReducerCompletion(body)))
        },
        geminiApiKey: GEMINI_KEY,
        journalPath: join(root, 'gemini-meter.jsonl'),
        limits: INCREMENTAL_LONGMEMEVAL_GEMINI_LIMITS,
        retryJitterImpl: () => 0,
        transcriptDirectory: join(root, 'gemini-transcripts'),
      })
      const armResult =
        await runIncrementalLongMemEvalQuestionForScoring({
          callGemini: gemini.callGemini,
          instance,
          workspaceDir: join(root, 'workspace'),
        })
      const judge =
        await createIncrementalLongMemEvalJudgeTransport({
          cumulativeCapUsd: 8,
          fetchImpl: async () => {
            judgeCalls += 1
            return judgeResponse()
          },
          freshSubcapUsd: INCREMENTAL_LONGMEMEVAL_FRESH_SUBCAP_USD,
          getFreshAccountedUsd: async () =>
            (await gemini.snapshot()).accounted.usd,
          meterPath: join(root, 'judge-meter.json'),
          openaiApiKey: OPENAI_KEY,
          openingAccountedUsd: 0,
          transcriptDirectory: join(root, 'judge-transcripts'),
        })
      const judged = await judge.callJudge({
        body: buildIncrementalLongMemEvalJudgeBody(
          instance,
          armResult.answer,
        ),
        cellId: instance.questionId,
        operationId: `${instance.questionId}:empty-judge`,
      })
      const [geminiEvidence, judgeEvidence] = await Promise.all([
        gemini.verify(),
        judge.verify(),
      ])

      assert.equal(geminiCalls, 2)
      assert.equal(answerCalls, 0)
      assert.equal(judgeCalls, 1)
      assert.equal(armResult.answerProviderCalled, false)
      assert.deepEqual(armResult.logicalOperations, {
        answer: 0,
        reducer: 2,
        total: 2,
      })
      assert.match(armResult.answer, /no stored memories/i)
      assert.equal(judged.validated, true)
      assert.equal(geminiEvidence.ledger.attempts, 2)
      assert.equal(geminiEvidence.transcripts.attempts, 2)
      assert.equal(judgeEvidence.snapshot.attempts, 1)
      assert.equal(judgeEvidence.snapshot.state, 'terminal')
    } finally {
      gemini?.closeNetworkGuard()
      await rm(root, { force: true, recursive: true })
    }
  })

test('real arm, Gemini meter, and judge meter compose through fake HTTP',
  async () => {
    const root = await mkdtemp(join(
      tmpdir(),
      'palari-incremental-runtime-chain-',
    ))
    const instance = integrationInstance()
    const checkpoints = []
    let geminiCalls = 0
    let judgeCalls = 0
    let gemini
    try {
      gemini = await createIncrementalLongMemEvalGeminiTransport({
        capUsd: INCREMENTAL_LONGMEMEVAL_FRESH_SUBCAP_USD,
        async fetchImpl(_url, init) {
          geminiCalls += 1
          const body = JSON.parse(init.body)
          return geminiResponse(
            body.systemInstruction
              ? JSON.stringify(reducerCompletion(body))
              : 'The user currently prefers mint tea.',
          )
        },
        geminiApiKey: GEMINI_KEY,
        journalPath: join(root, 'gemini-meter.jsonl'),
        limits: INCREMENTAL_LONGMEMEVAL_GEMINI_LIMITS,
        retryJitterImpl: () => 0,
        transcriptDirectory: join(root, 'gemini-transcripts'),
      })
      const armResult =
        await runIncrementalLongMemEvalQuestionForScoring({
          callGemini: gemini.callGemini,
          instance,
          async onCheckpoint(checkpoint) {
            checkpoints.push(checkpoint)
          },
          workspaceDir: join(root, 'workspace'),
        })
      const judge =
        await createIncrementalLongMemEvalJudgeTransport({
          cumulativeCapUsd: 8,
          fetchImpl: async (_url, init) => {
            judgeCalls += 1
            const body = JSON.parse(init.body)
            assert.equal(body.store, false)
            assert.equal(body.service_tier, 'default')
            return judgeResponse()
          },
          freshSubcapUsd: INCREMENTAL_LONGMEMEVAL_FRESH_SUBCAP_USD,
          getFreshAccountedUsd: async () =>
            (await gemini.snapshot()).accounted.usd,
          meterPath: join(root, 'judge-meter.json'),
          openaiApiKey: OPENAI_KEY,
          openingAccountedUsd: 0,
          transcriptDirectory: join(root, 'judge-transcripts'),
        })
      const judged = await judge.callJudge({
        body: buildIncrementalLongMemEvalJudgeBody(
          instance,
          armResult.answer,
        ),
        cellId: instance.questionId,
        operationId: `${instance.questionId}:judge`,
      })
      const [geminiEvidence, judgeEvidence] = await Promise.all([
        gemini.verify(),
        judge.verify(),
      ])

      assert.equal(geminiCalls, 3)
      assert.equal(judgeCalls, 1)
      assert.equal(checkpoints.length, 2)
      assert.deepEqual(armResult.logicalOperations, {
        answer: 1,
        reducer: 2,
        total: 3,
      })
      assert.equal(armResult.answerProviderCalled, true)
      assert.match(armResult.answer, /mint tea/i)
      assert.equal(judged.validated, true)
      assert.equal(judged.text, 'yes')
      assert.equal(geminiEvidence.ledger.attempts, 3)
      assert.equal(geminiEvidence.transcripts.attempts, 3)
      assert.equal(judgeEvidence.snapshot.attempts, 1)
      assert.equal(judgeEvidence.snapshot.state, 'terminal')
    } finally {
      gemini?.closeNetworkGuard()
      await rm(root, { force: true, recursive: true })
    }
  })

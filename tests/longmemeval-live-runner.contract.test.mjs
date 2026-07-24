import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, open, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

import {
  J4_FIRST_TRANCHE_QUESTION_IDS,
  J4_PROPOSED_TRANCHE_GATES,
  J4_V3_COMPATIBILITY_SMOKE_STATS,
  SEALED_U8_QUESTION_IDS,
} from '../evals/longmemeval-plan.mjs'
import {
  buildJ4AnswerBody,
  buildJ4AnswerPrompt,
  buildJ4WriterBody,
  J4_CARRIED_ACCOUNTED_USD,
  J4_GEMINI_MODEL,
  J4_LIVE_RUN_ID,
  J4_PREDECESSOR_CHAIN,
  J4_TRANCHE_1_LIMITS,
  j4ExecutionQuestionIds,
} from '../evals/longmemeval-live-config.mjs'
import {
  acquireJ4RunLock,
  assertJ4LiveRunOpen,
  assertValidatedJ4JudgeResponse,
  assertJ4Checkpoint,
  assertJ4GitCutPoint,
  assertJ4LivePopulation,
  atomicWriteJ4,
  auditJ4TrackedFiles,
  buildJ4Checkpoint,
  buildJ4ImmutableIdentity,
  buildJ4JudgeBody,
  buildJ4QuestionResult,
  collectJ4PrivateArtifacts,
  executeJ4AuthorizedTranche,
  main,
  parseJ4LiveArgs,
  planJ4Invocation,
  runJ4SmokeSuite,
  verifyJ4ArtifactManifest,
  verifyJ4PredecessorBundle,
} from '../evals/run-longmemeval-live.mjs'

const TYPES = [
  'knowledge-update',
  'multi-session',
  'single-session-assistant',
  'single-session-preference',
  'single-session-user',
  'temporal-reasoning',
]
const OPENING_ACCOUNTED_USD = J4_CARRIED_ACCOUNTED_USD
const SMOKE_WRITER_TURN = {
  assistantMessage: 'Understood.',
  palariId: 'palari-longmemeval-j4',
  palariName: 'Palari',
  sourceMessageId: 'j4-smoke:0',
  sourceTexts: [],
  userId: 'user-longmemeval-j4',
  userMessage: 'I was diagnosed with asthma in 2014.',
  userName: 'user',
}
const SMOKE_ANSWER_PROMPT = buildJ4AnswerPrompt({
  facts: '[2014] The user was diagnosed with asthma.',
  question: 'What condition was I diagnosed with in 2014?',
  questionDate: '2026-07-24T00:00:00.000Z',
})
const VALID_MEMORY_JSON = JSON.stringify({
  memories: [{
    confidence: 0.9,
    content: 'The user was diagnosed with asthma in 2014.',
    fictional: false,
    importance: 0.8,
    keywords: ['asthma', 'diagnosis', '2014'],
    shared: false,
    sourceKind: 'user_message',
    type: 'life_event',
  }],
})

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function providerTextChars(body = {}) {
  return [
    ...(body.systemInstruction?.parts ?? []),
    ...(body.contents ?? []).flatMap((content) => content?.parts ?? []),
  ].reduce(
    (count, part) => count + String(part?.text ?? '').length,
    0,
  )
}

function syntheticPredecessorChain() {
  return structuredClone(J4_PREDECESSOR_CHAIN)
}

function syntheticPopulation() {
  const ids = j4ExecutionQuestionIds()
  const sentinelTypes = [
    'knowledge-update',
    'single-session-preference',
    'single-session-assistant',
    'temporal-reasoning',
    'multi-session',
  ]
  const remaining = {
    'knowledge-update': 9,
    'multi-session': 9,
    'single-session-assistant': 9,
    'single-session-preference': 9,
    'single-session-user': 10,
    'temporal-reasoning': 9,
  }
  const tailTypes = []
  for (const type of TYPES) {
    tailTypes.push(...Array.from({ length: remaining[type] }, () => type))
  }
  const types = [...sentinelTypes, ...tailTypes]
  const executionOrder = ids.map((questionId, index) => ({
    answer: `reference ${index + 1}`,
    answerSessionIds: [`session-${index + 1}`],
    isAbstention: index === 4,
    question: `question ${index + 1}`,
    questionDate: '2026-07-23T00:00:00.000Z',
    questionId,
    questionType: types[index],
    sessions: [{
      eventAt: '2026-07-22T00:00:00.000Z',
      sessionId: `session-${index + 1}`,
      turns: [
        { content: `remember ${index + 1}`, role: 'user' },
        { content: 'Understood.', role: 'assistant' },
      ],
    }],
  }))
  return {
    executionOrder,
    tranches: J4_PROPOSED_TRANCHE_GATES.map((gate, index) => ({
      ...gate,
      index: index + 1,
      questionIds: executionOrder
        .slice(
          gate.cumulativeQuestions - gate.questions,
          gate.cumulativeQuestions,
        )
        .map((entry) => entry.questionId),
    })),
  }
}

function predictions(population) {
  return {
    predictions: population.executionOrder.map((instance, index) => ({
      basisCode: 'synthetic-test',
      isAbstention: instance.isAbstention,
      ordinal: index + 1,
      predictedFailureStage: 'answer',
      predictedOfficialCorrect: false,
      questionId: instance.questionId,
      questionType: instance.questionType,
    })),
  }
}

function config() {
  return {
    artifacts: [
      { path: 'evals/run-longmemeval-live.mjs', sha256: 'a'.repeat(64) },
    ],
    models: {
      answer: J4_GEMINI_MODEL,
      judge: 'gpt-4o-2024-08-06',
      writer: J4_GEMINI_MODEL,
    },
    population: {
      executionOrderSha256: 'b'.repeat(64),
      trancheManifestSha256: 'c'.repeat(64),
    },
    predecessorChain: syntheticPredecessorChain(),
    predictions: {
      path: 'evals/predictions/j4-test.json',
    },
    runId: J4_LIVE_RUN_ID,
    tranches: J4_PROPOSED_TRANCHE_GATES,
  }
}

function identity(active = config()) {
  return buildJ4ImmutableIdentity({
    config: active,
    configSha256: 'd'.repeat(64),
    datasetSha256: 'e'.repeat(64),
    predictionsSha256: 'f'.repeat(64),
  })
}

function authority({
  cap = 2.5,
  from = 0,
  target = 5,
} = {}) {
  return {
    cumulativeCapUsd: cap,
    cumulativeQuestions: target,
    fromCumulativeQuestions: from,
    previousCheckpointSha256: from === 0 ? null : '9'.repeat(64),
    runId: J4_LIVE_RUN_ID,
  }
}

function meterSnapshot(state = {}) {
  const usage = {
    geminiInputTokens: 0,
    geminiOutputTokens: 0,
    judgeInputTokens: 0,
    judgeOutputTokens: 0,
    usd: 0,
  }
  return {
    accounted: { ...usage, ...state.accounted },
    attempts: state.attempts ?? 0,
    logicalRequests: { ...state.logicalRequests },
    measured: { ...usage, ...state.measured },
    retries: [...(state.retries ?? [])],
    sequence: state.sequence ?? 0,
    uncertain: { ...usage, ...state.uncertain },
  }
}

function validGeminiResponse(
  text = '{"memories":[]}',
  modelVersion = J4_GEMINI_MODEL,
) {
  return {
    finishReason: 'STOP',
    modelVersion,
    text,
    usage: {
      geminiInputTokens: 10,
      geminiOutputTokens: 1,
      judgeInputTokens: 0,
      judgeOutputTokens: 0,
      usd: 0.0000055,
    },
    usageDetails: {
      candidateTokens: 1,
      thoughtTokens: 0,
    },
    validated: true,
  }
}

function validJudgeResponse(text = 'no') {
  return {
    finishReason: 'stop',
    modelVersion: 'gpt-4o-2024-08-06',
    text,
    usage: {
      geminiInputTokens: 0,
      geminiOutputTokens: 0,
      judgeInputTokens: 10,
      judgeOutputTokens: 1,
      usd: 0.000035,
    },
    usageDetails: {},
    validated: true,
  }
}

async function makePaths(root) {
  const runDir = join(root, 'run')
  await mkdir(runDir, { recursive: true, mode: 0o700 })
  return {
    artifactManifestPath: join(runDir, 'artifact-manifest.json'),
    checkpointPath: join(runDir, 'checkpoint.json'),
    ledgerPath: join(runDir, 'meter.jsonl'),
    reportJsonPath: join(runDir, 'report.json'),
    reportMarkdownPath: join(runDir, 'report.md'),
    runDir,
    transcriptDirectory: join(runDir, 'transcripts'),
  }
}

async function makePredecessorChainBundle(root) {
  const specs = [
    {
      currentRunAccountedUsd: 0.0004494,
      failedQuestionOrdinal: null,
      geminiInputTokens: 498,
      geminiOutputTokens: 120,
      runId: 'j4-longmemeval-s60-v1',
      smokeLogicalOperations: 0,
      smokeStatus: 'failed',
    },
    {
      currentRunAccountedUsd: 0.0146198,
      failedQuestionOrdinal: 1,
      geminiInputTokens: 32_066,
      geminiOutputTokens: 2_000,
      runId: 'j4-longmemeval-s60-v2',
      smokeLogicalOperations: 1,
      smokeStatus: 'completed',
    },
  ]
  const zero = {
    geminiInputTokens: 0,
    geminiOutputTokens: 0,
    judgeInputTokens: 0,
    judgeOutputTokens: 0,
    usd: 0,
  }
  const runs = []
  const paths = []
  let openingAccountedUsd = 0

  for (const [index, spec] of specs.entries()) {
    const privateRoot = `evals/results/${spec.runId}`
    const runDir = join(root, privateRoot)
    const trackedRoot = join(root, 'evals', 'live-runs')
    const predictionsRoot = join(root, 'evals', 'predictions')
    await Promise.all([
      mkdir(runDir, { recursive: true, mode: 0o700 }),
      mkdir(trackedRoot, { recursive: true, mode: 0o700 }),
      mkdir(predictionsRoot, { recursive: true, mode: 0o700 }),
    ])

    const configPath = `evals/live-runs/${spec.runId}.json`
    const authorityPath = `evals/live-runs/${spec.runId}.authority.json`
    const predictionsPath = index === 0
      ? 'evals/predictions/j4-longmemeval-s60.json'
      : `evals/predictions/${spec.runId}.json`
    const configText = `synthetic config ${spec.runId}\n`
    const authorityText = `synthetic authority ${spec.runId}\n`
    const predictionsText = `synthetic predictions ${spec.runId}\n`
    await Promise.all([
      atomicWriteJ4(join(root, configPath), configText),
      atomicWriteJ4(join(root, authorityPath), authorityText),
      atomicWriteJ4(join(root, predictionsPath), predictionsText),
    ])
    const tracked = {
      authorityPath,
      authoritySha256: sha256(authorityText),
      configPath,
      configSha256: sha256(configText),
      predictionsPath,
      predictionsSha256: sha256(predictionsText),
    }

    const usage = {
      geminiInputTokens: spec.geminiInputTokens,
      geminiOutputTokens: spec.geminiOutputTokens,
      judgeInputTokens: 0,
      judgeOutputTokens: 0,
      usd: spec.currentRunAccountedUsd,
    }
    const operationId = `${spec.runId}:gemini-writer`
    const requestSha256 = sha256(`${spec.runId}:request`)
    const transcriptStartedSha256 = sha256(`${spec.runId}:started`)
    const transcriptSha256 = sha256(`${spec.runId}:terminal`)
    const transcriptFile = `${spec.runId}-attempt-1.json`
    const meterText = [
      {
        attempt: 1,
        attemptId: `${operationId}:attempt:1`,
        cellId: `${spec.runId}:cell`,
        endpoint: 'gemini-generate-content',
        model: J4_GEMINI_MODEL,
        operationId,
        provider: 'gemini',
        purpose: 'writer',
        requestSha256,
        reservation: usage,
        schemaVersion: 1,
        sequence: 1,
        transcriptFile,
        transcriptStartedSha256,
        type: 'attempt_started',
      },
      {
        attemptId: `${operationId}:attempt:1`,
        modelVersion: J4_GEMINI_MODEL,
        operationId,
        outcome: 'success',
        requestSha256,
        retryable: false,
        schemaVersion: 1,
        sequence: 2,
        transcriptFile,
        transcriptSha256,
        type: 'attempt_terminal',
        usage,
        usageDetails: {
          cachedInputTokens: 0,
          candidateTokens: spec.geminiOutputTokens,
          thoughtTokens: 0,
        },
      },
    ].map((event) => JSON.stringify(event)).join('\n') + '\n'
    const meterPath = join(runDir, 'meter.jsonl')
    await atomicWriteJ4(meterPath, meterText)

    const identity = {
      configSha256: tracked.configSha256,
      predictionsSha256: tracked.predictionsSha256,
      runId: spec.runId,
    }
    let predecessorAudit
    if (index > 0) {
      const prior = runs[index - 1]
      identity.openingAccountedUsd = openingAccountedUsd
      identity.predecessor = {
        accountedUsd: prior.currentRunAccountedUsd,
        artifactManifestSha256:
          prior.private.artifactManifestSha256,
        checkpointSha256: prior.private.checkpointSha256,
        meterSha256: prior.private.meterSha256,
        runId: prior.runId,
      }
      predecessorAudit = { ...identity.predecessor }
    }
    const checkpoint = {
      identity,
      invocations: [{ authoritySha256: tracked.authoritySha256 }],
      meter: {
        accounted: usage,
        attempts: 1,
        logicalRequests: { writer: 1 },
        measured: usage,
        retries: [],
        sequence: 2,
        uncertain: zero,
      },
      questions: Array.from({ length: 60 }, (_, questionIndex) => ({
        ordinal: questionIndex + 1,
        status: questionIndex + 1 === spec.failedQuestionOrdinal
          ? 'failed'
          : 'pending',
      })),
      schemaVersion: 1,
      smoke: {
        logicalOperations: spec.smokeLogicalOperations,
        status: spec.smokeStatus,
      },
      status: 'failed',
    }
    if (predecessorAudit) checkpoint.predecessorAudit = predecessorAudit
    const checkpointText = `${JSON.stringify(checkpoint, null, 2)}\n`
    const checkpointPath = join(runDir, 'checkpoint.json')
    await atomicWriteJ4(checkpointPath, checkpointText)

    const artifacts = [
      {
        bytes: Buffer.byteLength(checkpointText),
        mode: '600',
        path: 'checkpoint.json',
        sha256: sha256(checkpointText),
      },
      {
        bytes: Buffer.byteLength(meterText),
        mode: '600',
        path: 'meter.jsonl',
        sha256: sha256(meterText),
      },
    ]
    const manifestText = `${JSON.stringify({
      artifacts,
      generatedAt: '2026-07-24T00:00:00.000Z',
      runId: spec.runId,
      schemaVersion: 1,
    }, null, 2)}\n`
    const manifestPath = join(runDir, 'artifact-manifest.json')
    await atomicWriteJ4(manifestPath, manifestText)
    const descriptor = {
      attempts: 1,
      completedQuestions: 0,
      currentRunAccountedUsd: spec.currentRunAccountedUsd,
      failedQuestionOrdinal: spec.failedQuestionOrdinal,
      logicalRequests: { writer: 1 },
      openingAccountedUsd,
      private: {
        artifactManifestPath: `${privateRoot}/artifact-manifest.json`,
        artifactManifestSha256: sha256(manifestText),
        checkpointPath: `${privateRoot}/checkpoint.json`,
        checkpointSha256: sha256(checkpointText),
        meterPath: `${privateRoot}/meter.jsonl`,
        meterSha256: sha256(meterText),
      },
      runId: spec.runId,
      smokeLogicalOperations: spec.smokeLogicalOperations,
      smokeStatus: spec.smokeStatus,
      status: 'failed',
      tracked,
    }
    runs.push(descriptor)
    paths.push({ checkpointPath, manifestPath, meterPath, runDir })
    openingAccountedUsd = Number((
      openingAccountedUsd + spec.currentRunAccountedUsd
    ).toFixed(12))
  }
  return {
    chain: {
      openingAccountedUsd,
      runs,
    },
    paths,
  }
}

function fakeTransport({ judgeText = 'no' } = {}) {
  const state = meterSnapshot()
  let answerCalls = 0
  let judgeCalls = 0
  let writerCalls = 0
  const addUsage = (usage) => {
    state.attempts += 1
    state.sequence += 2
    for (const field of Object.keys(state.accounted)) {
      state.accounted[field] += usage[field]
      state.measured[field] += usage[field]
    }
  }
  return {
    async callGemini(request) {
      assert.ok(['answer', 'writer'].includes(request.purpose))
      if (request.purpose === 'writer') writerCalls += 1
      else answerCalls += 1
      state.logicalRequests[request.purpose] =
        (state.logicalRequests[request.purpose] ?? 0) + 1
      const response = validGeminiResponse(
        request.purpose === 'writer'
          ? VALID_MEMORY_JSON
          : request.operationId === 'smoke:gemini-answer'
            ? 'You were diagnosed with asthma.'
            : 'synthetic answer',
      )
      addUsage(response.usage)
      return response
    },
    async callJudge({ body }) {
      judgeCalls += 1
      assert.equal(body.model, 'gpt-4o-2024-08-06')
      state.logicalRequests.judge =
        (state.logicalRequests.judge ?? 0) + 1
      const response = validJudgeResponse(judgeText)
      addUsage(response.usage)
      return response
    },
    counts() {
      return { answerCalls, judgeCalls, writerCalls }
    },
    closeNetworkGuard() {},
    installNetworkGuard() {},
    async snapshot() {
      return structuredClone(state)
    },
    async verify() {
      return {
        ledger: structuredClone(state),
        transcripts: { attempts: state.attempts },
      }
    },
  }
}

async function runFakeQuestion({
  callGemini,
  instance,
  workspaceDir,
}, {
  memoryRows = 1,
} = {}) {
  await mkdir(workspaceDir, { recursive: true, mode: 0o700 })
  await callGemini({
    body: {},
    cellId: instance.questionId,
    operationId: `question:${instance.questionId}:writer:test`,
    purpose: 'writer',
  })
  await callGemini({
    body: {},
    cellId: instance.questionId,
    operationId: `question:${instance.questionId}:answer`,
    purpose: 'answer',
  })
  return fakeArmResult(instance, { memoryRows })
}

function fakeArmResult(instance, { memoryRows = 1 } = {}) {
  return {
    answer: `wrong answer for ${instance.questionId}`,
    answerModelVersion: J4_GEMINI_MODEL,
    briefing: {
      chars: 10,
      includedMemoryIds: ['memory-1'],
      includedSourceSessionIds: [instance.answerSessionIds[0]],
      status: 'included',
      totalCandidates: 1,
    },
    ingest: {
      memoriesWritten: memoryRows,
      memoryRows,
      sessions: 1,
      storedSourceSessionIds: memoryRows
        ? [instance.answerSessionIds[0]]
        : [],
      turns: 1,
    },
    promptSha256: '1'.repeat(64),
    retrieval: {
      answerSessionIds: instance.answerSessionIds,
      at5: instance.isAbstention
        ? null
        : { all: true, expected: 1, hit: true, matched: 1 },
      at10: instance.isAbstention
        ? null
        : { all: true, expected: 1, hit: true, matched: 1 },
      sourceSessionIds: [instance.answerSessionIds[0]],
    },
  }
}

test('runner import is inert and all v1-v3 identities are terminal', () => {
  for (const runId of [
    'j4-longmemeval-s60-v1',
    'j4-longmemeval-s60-v2',
    J4_LIVE_RUN_ID,
  ]) {
    assert.equal(parseJ4LiveArgs(['--run', runId]), runId)
    assert.throws(
      () => assertJ4LiveRunOpen(runId),
      (error) => error.code === 'J4_RUN_TERMINAL',
    )
  }
  assert.throws(
    () => parseJ4LiveArgs([]),
    (error) => error.code === 'RUN_ID_REQUIRED',
  )
})

test('population helper pins canonical S-60 order, exact sentinels, strata, and U8 seal', () => {
  const population = syntheticPopulation()
  const validated = assertJ4LivePopulation(population)
  assert.deepEqual(validated.firstFive, J4_FIRST_TRANCHE_QUESTION_IDS)
  assert.ok(validated.questionIds.every(
    (questionId) => !SEALED_U8_QUESTION_IDS.includes(questionId),
  ))
  assert.deepEqual(
    Object.values(validated.byType),
    [10, 10, 10, 10, 10, 10],
  )
  const sealed = structuredClone(population)
  sealed.executionOrder[0].questionId = SEALED_U8_QUESTION_IDS[0]
  assert.throws(
    () => assertJ4LivePopulation(sealed),
    (error) => ['POPULATION_ORDER', 'POPULATION_SEAL'].includes(error.code),
  )
  const wrongSentinel = structuredClone(population)
  wrongSentinel.executionOrder[0].questionType = 'multi-session'
  assert.throws(
    () => assertJ4LivePopulation(wrongSentinel),
    (error) => error.code === 'TRANCHE_ONE_SENTINELS',
  )
})

test('immutable evaluation identity excludes administrative head and tranche authority', () => {
  const active = config()
  const first = identity(active)
  const second = identity(active)
  assert.deepEqual(first, second)
  assert.equal(first.administrativeHead, undefined)
  assert.equal(first.authoritySha256, undefined)
  assert.equal(first.openingAccountedUsd, OPENING_ACCOUNTED_USD)
  assert.deepEqual(first.predecessorChain, active.predecessorChain)
})

test('checkpoint and invocation plan require a contiguous prefix and exact from boundary', () => {
  const population = syntheticPopulation()
  const active = config()
  const immutable = identity(active)
  const checkpoint = buildJ4Checkpoint({
    identity: immutable,
    population,
    predictions: predictions(population),
  })
  assert.equal(assertJ4Checkpoint({
    checkpoint,
    identity: immutable,
    population,
  }).completed, 0)
  const planned = planJ4Invocation({
    authority: authority(),
    checkpoint,
    config: active,
  })
  assert.equal(planned.questions.length, 5)
  assert.deepEqual(planned.questionIds, J4_FIRST_TRANCHE_QUESTION_IDS)
  assert.throws(
    () => planJ4Invocation({
      authority: authority({ from: 5 }),
      checkpoint,
      config: active,
    }),
    (error) => error.code === 'AUTHORITY_FROM_BOUNDARY',
  )
  assert.throws(
    () => planJ4Invocation({
      authority: {
        ...authority(),
        previousCheckpointSha256: '1'.repeat(64),
      },
      checkpoint,
      config: active,
    }),
    (error) => error.code === 'AUTHORITY_PREDECESSOR',
  )
  checkpoint.questions[0].status = 'in_progress'
  assert.throws(
    () => assertJ4Checkpoint({
      checkpoint,
      identity: immutable,
      population,
    }),
    (error) => error.code === 'CHECKPOINT_TERMINAL_QUESTION',
  )
})

test('later authority advances one tranche only and pins the exact prior checkpoint', () => {
  const population = syntheticPopulation()
  const active = config()
  const checkpoint = buildJ4Checkpoint({
    identity: identity(active),
    population,
    predictions: predictions(population),
  })
  for (const cell of checkpoint.questions.slice(0, 5)) {
    cell.status = 'completed'
  }
  const priorHash = '9'.repeat(64)
  const nextAuthority = authority({
    cap: 7.5,
    from: 5,
    target: 15,
  })
  const planned = planJ4Invocation({
    authority: nextAuthority,
    checkpoint,
    checkpointSha256: priorHash,
    config: active,
  })
  assert.equal(planned.completedBefore, 5)
  assert.equal(planned.questions.length, 10)
  assert.throws(
    () => planJ4Invocation({
      authority: nextAuthority,
      checkpoint,
      checkpointSha256: '8'.repeat(64),
      config: active,
    }),
    (error) => error.code === 'AUTHORITY_PREDECESSOR',
  )
  assert.throws(
    () => planJ4Invocation({
      authority: {
        ...nextAuthority,
        cumulativeCapUsd: 12.5,
        cumulativeQuestions: 25,
      },
      checkpoint,
      checkpointSha256: priorHash,
      config: active,
    }),
    (error) => error.code === 'AUTHORITY_SCOPE',
  )
})

test('git cut-point helper requires clean synchronized main, ignored results, and tracked pins', () => {
  const valid = {
    artifactPaths: ['evals/a.mjs'],
    authorityPath: 'evals/live-runs/authority.json',
    branch: 'main',
    head: 'abc',
    ignored: true,
    originMain: 'abc',
    statusText: '',
    trackedPaths: ['evals/a.mjs', 'evals/live-runs/authority.json'],
  }
  assert.deepEqual(
    assertJ4GitCutPoint(valid),
    { administrativeHead: 'abc' },
  )
  assert.throws(
    () => assertJ4GitCutPoint({ ...valid, statusText: '?? stray' }),
    (error) => error.code === 'DIRTY_WORKTREE',
  )
  assert.throws(
    () => assertJ4GitCutPoint({ ...valid, originMain: 'other' }),
    (error) => error.code === 'UNPUSHED_MAIN',
  )
})

test('compatibility smoke uses exact production writer and answer bodies', async () => {
  const calls = []
  const result = await runJ4SmokeSuite({
    async callGemini(request) {
      calls.push(request)
      return validGeminiResponse(
        request.purpose === 'writer'
          ? VALID_MEMORY_JSON
          : 'You were diagnosed with asthma.',
      )
    },
  })
  assert.equal(calls.length, 2)
  assert.equal(calls[0].operationId, 'smoke:gemini-writer')
  assert.equal(calls[0].purpose, 'writer')
  assert.equal(calls[0].cellId, 'j4-compatibility-smoke-writer')
  assert.deepEqual(calls[0].body, buildJ4WriterBody(SMOKE_WRITER_TURN))
  assert.equal(
    providerTextChars(calls[0].body),
    J4_V3_COMPATIBILITY_SMOKE_STATS.writerRequestContentChars,
  )
  assert.equal(calls[1].operationId, 'smoke:gemini-answer')
  assert.equal(calls[1].purpose, 'answer')
  assert.equal(calls[1].cellId, 'j4-compatibility-smoke-answer')
  assert.deepEqual(
    calls[1].body,
    buildJ4AnswerBody(SMOKE_ANSWER_PROMPT),
  )
  assert.equal(
    JSON.stringify(calls[1].body).length,
    J4_V3_COMPATIBILITY_SMOKE_STATS.answerRequestBodyChars,
  )
  assert.equal(result.geminiModelVersion, J4_GEMINI_MODEL)
  assert.equal(result.logicalOperations, 2)
})

test('compatibility smoke rejects empty, unrelated, health-typed, and bad-source memories', async () => {
  const memory = JSON.parse(VALID_MEMORY_JSON).memories[0]
  const cases = [
    { memories: [] },
    {
      memories: [{
        ...memory,
        content: 'The user prefers coffee.',
        keywords: ['coffee'],
        type: 'preference',
      }],
    },
    { memories: [{ ...memory, type: 'health' }] },
    { memories: [{ ...memory, sourceKind: 'direct_user' }] },
    { memories: [{ ...memory, sourceKind: 'source_document' }] },
  ]
  for (const payload of cases) {
    let calls = 0
    await assert.rejects(
      runJ4SmokeSuite({
        async callGemini() {
          calls += 1
          return validGeminiResponse(JSON.stringify(payload))
        },
      }),
      (error) => [
        'EXTRACTION_PAYLOAD_INVALID',
        'SMOKE_WRITER_SEMANTICS',
      ].includes(error.code),
    )
    assert.equal(calls, 1, 'bad writer output must stop before answer smoke')
  }
})

test('compatibility smoke does not require one particular canonical memory type', async () => {
  const memory = JSON.parse(VALID_MEMORY_JSON).memories[0]
  for (const type of ['entity', 'life_event', 'recent_life']) {
    const result = await runJ4SmokeSuite({
      async callGemini({ purpose }) {
        return validGeminiResponse(
          purpose === 'writer'
            ? JSON.stringify({ memories: [{ ...memory, type }] })
            : 'You were diagnosed with asthma.',
        )
      },
    })
    assert.equal(result.logicalOperations, 2)
  }
})

test('compatibility smoke rejects empty answers and model-version drift', async () => {
  await assert.rejects(
    runJ4SmokeSuite({
      async callGemini({ purpose }) {
        return validGeminiResponse(
          purpose === 'writer' ? VALID_MEMORY_JSON : '   ',
        )
      },
    }),
    (error) => error.code === 'GEMINI_RESULT_UNVALIDATED',
  )

  await assert.rejects(
    runJ4SmokeSuite({
      async callGemini({ purpose }) {
        return validGeminiResponse(
          purpose === 'writer'
            ? VALID_MEMORY_JSON
            : 'You were diagnosed with asthma.',
          purpose === 'writer'
            ? `${J4_GEMINI_MODEL}-001`
            : J4_GEMINI_MODEL,
        )
      },
    }),
    (error) => error.code === 'SMOKE_MODEL_VERSION',
  )

  await assert.rejects(
    runJ4SmokeSuite({
      async callGemini({ purpose }) {
        return validGeminiResponse(
          purpose === 'writer'
            ? VALID_MEMORY_JSON
            : 'I do not know.',
        )
      },
    }),
    (error) => error.code === 'SMOKE_ANSWER_SEMANTICS',
  )
})

test('judge request remains official and wrong answers are findings, not runner errors', () => {
  const instance = syntheticPopulation().executionOrder[0]
  const body = buildJ4JudgeBody(instance, 'wrong')
  assert.deepEqual(
    {
      max_tokens: body.max_tokens,
      model: body.model,
      n: body.n,
      temperature: body.temperature,
    },
    {
      max_tokens: 10,
      model: 'gpt-4o-2024-08-06',
      n: 1,
      temperature: 0,
    },
  )
  const result = buildJ4QuestionResult({
    armResult: fakeArmResult(instance),
    instance,
    judgeResponse: {
      modelVersion: 'gpt-4o-2024-08-06',
      text: 'no',
    },
    prediction: predictions(syntheticPopulation()).predictions[0],
  })
  assert.equal(result.judge.correct, false)
  assert.equal(result.observedFailureStage, 'answer')
  const validatedJudge = validJudgeResponse()
  assert.equal(
    assertValidatedJ4JudgeResponse(validatedJudge),
    validatedJudge,
  )
  assert.throws(
    () => assertValidatedJ4JudgeResponse({
      modelVersion: 'gpt-4o-2024-08-06',
      text: 'no',
    }),
    (error) => error.code === 'JUDGE_RESULT_UNVALIDATED',
  )

  const partialArm = fakeArmResult(instance)
  partialArm.retrieval.at10 = {
    all: false,
    expected: 2,
    hit: true,
    matched: 1,
  }
  const partial = buildJ4QuestionResult({
    armResult: partialArm,
    instance,
    judgeResponse: {
      modelVersion: 'gpt-4o-2024-08-06',
      text: 'no',
    },
    prediction: predictions(syntheticPopulation()).predictions[0],
  })
  assert.equal(partial.observedFailureStage, 'retrieval')

  const permissive = buildJ4QuestionResult({
    armResult: fakeArmResult(instance),
    instance,
    judgeResponse: {
      modelVersion: 'gpt-4o-2024-08-06',
      text: 'not yes',
    },
    prediction: predictions(syntheticPopulation()).predictions[0],
  })
  assert.equal(
    permissive.judge.correct,
    true,
    'upstream contains-yes parser remains deliberately permissive',
  )
})

test('authorized first tranche executes five wrong answers, checkpoints each, and cannot reach question 6', async () => {
  const root = await mkdtemp(join(tmpdir(), 'palari-j4-runner-five-'))
  const paths = await makePaths(root)
  const population = syntheticPopulation()
  const active = config()
  const immutable = identity(active)
  const checkpoint = buildJ4Checkpoint({
    identity: immutable,
    population,
    predictions: predictions(population),
  })
  const transport = fakeTransport({ judgeText: 'no' })
  const executed = []
  try {
    const outcome = await executeJ4AuthorizedTranche({
      administrativeHead: 'admin-head-one',
      authority: authority(),
      authoritySha256: '2'.repeat(64),
      checkpoint,
      config: active,
      forbiddenSecrets: ['test-gemini-key', 'test-openai-key'],
      identity: immutable,
      paths,
      population,
      async runQuestion(options) {
        const { instance } = options
        executed.push(instance.questionId)
        return runFakeQuestion(options)
      },
      transport,
    })
    assert.deepEqual(executed, J4_FIRST_TRANCHE_QUESTION_IDS)
    assert.equal(outcome.checkpoint.status, 'paused')
    assert.equal(
      outcome.checkpoint.pauseReason,
      'FOUNDER_REVIEW_REQUIRED',
    )
    assert.ok(outcome.checkpoint.questions.slice(0, 5).every(
      (cell) => cell.status === 'completed',
    ))
    assert.equal(outcome.checkpoint.questions[5].status, 'pending')
    assert.equal(outcome.report.officialAccuracy.correct, 0)
    assert.equal(outcome.report.officialAccuracy.total, 5)
    assert.ok(outcome.report.missesFirst.every((result) =>
      result.meter.logicalRequests.writer === 1 &&
      result.meter.logicalRequests.answer === 1 &&
      result.meter.logicalRequests.judge === 1 &&
      result.meter.attempts === 3 &&
      result.meter.sequence === 6))
    const counts = transport.counts()
    assert.deepEqual(counts, {
      answerCalls: J4_TRANCHE_1_LIMITS.maxLogicalRequests.answer,
      judgeCalls: J4_TRANCHE_1_LIMITS.maxLogicalRequests.judge,
      writerCalls: 6,
    })
    await verifyJ4ArtifactManifest(paths.runDir)
  } finally {
    await rm(root, { force: true, recursive: true })
  }
})

test('zero admitted memory pauses after the completed answerable question without reroll', async () => {
  const root = await mkdtemp(join(tmpdir(), 'palari-j4-runner-zero-'))
  const paths = await makePaths(root)
  const population = syntheticPopulation()
  const active = config()
  const immutable = identity(active)
  const checkpoint = buildJ4Checkpoint({
    identity: immutable,
    population,
    predictions: predictions(population),
  })
  const transport = fakeTransport({ judgeText: 'no' })
  const executed = []
  try {
    const outcome = await executeJ4AuthorizedTranche({
      administrativeHead: 'admin-head-one',
      authority: authority(),
      authoritySha256: '3'.repeat(64),
      checkpoint,
      config: active,
      forbiddenSecrets: ['test-gemini-key', 'test-openai-key'],
      identity: immutable,
      paths,
      population,
      async runQuestion(options) {
        const { instance } = options
        executed.push(instance.questionId)
        return runFakeQuestion(options, { memoryRows: 0 })
      },
      transport,
    })
    assert.deepEqual(executed, [J4_FIRST_TRANCHE_QUESTION_IDS[0]])
    assert.equal(outcome.checkpoint.status, 'paused')
    assert.equal(outcome.checkpoint.pauseReason, 'ZERO_ADMITTED_MEMORIES')
    assert.equal(outcome.checkpoint.questions[0].status, 'completed')
    assert.equal(outcome.checkpoint.questions[1].status, 'pending')
  } finally {
    await rm(root, { force: true, recursive: true })
  }
})

test('exclusive lock and private artifact audit enforce modes and reject secrets', async () => {
  const root = await mkdtemp(join(tmpdir(), 'palari-j4-private-'))
  const lockPath = join(root, 'run.lock')
  const runDir = join(root, 'run')
  await mkdir(runDir, { mode: 0o700 })
  const lock = await acquireJ4RunLock(lockPath)
  try {
    assert.equal((await stat(lockPath)).mode & 0o777, 0o600)
    await assert.rejects(
      acquireJ4RunLock(lockPath),
      (error) => error.code === 'RUN_LOCKED',
    )
    await atomicWriteJ4(join(runDir, 'safe.json'), '{"safe":true}\n')
    const safe = await collectJ4PrivateArtifacts(runDir, {
      forbiddenSecrets: ['never-write-this-key'],
    })
    assert.equal(safe.length, 1)

    const secret = 'local-test-secret-value'
    const handle = await open(join(runDir, 'unsafe.txt'), 'wx', 0o600)
    await handle.writeFile(secret)
    await handle.close()
    await assert.rejects(
      collectJ4PrivateArtifacts(runDir, {
        forbiddenSecrets: [secret],
      }),
      (error) => error.code === 'SECRET_ARTIFACT',
    )
  } finally {
    await lock.release()
    await rm(root, { force: true, recursive: true })
  }
})

test('replacement preflight verifies both terminal predecessors and their exact spend sum', async () => {
  const root = await mkdtemp(join(tmpdir(), 'palari-j4-predecessor-'))
  try {
    const fixture = await makePredecessorChainBundle(root)
    const evidence = await verifyJ4PredecessorBundle({
      predecessorChain: fixture.chain,
      repoRoot: root,
    })
    assert.equal(evidence.accountedUsd, OPENING_ACCOUNTED_USD)
    assert.equal(evidence.measuredUsd, OPENING_ACCOUNTED_USD)
    assert.deepEqual(
      evidence.runs.map((run) => ({
        completedQuestions: run.completedQuestions,
        currentRunAccountedUsd: run.currentRunAccountedUsd,
        runId: run.runId,
        status: run.status,
      })),
      [
        {
          completedQuestions: 0,
          currentRunAccountedUsd: 0.0004494,
          runId: 'j4-longmemeval-s60-v1',
          status: 'failed',
        },
        {
          completedQuestions: 0,
          currentRunAccountedUsd: 0.0146198,
          runId: 'j4-longmemeval-s60-v2',
          status: 'failed',
        },
      ],
    )

    await atomicWriteJ4(
      fixture.paths[1].checkpointPath,
      `${await readFile(fixture.paths[1].checkpointPath, 'utf8')} `,
    )
    await assert.rejects(
      verifyJ4PredecessorBundle({
        predecessorChain: fixture.chain,
        repoRoot: root,
      }),
      (error) => error.code === 'PREDECESSOR_HASH_MISMATCH',
    )
  } finally {
    await rm(root, { force: true, recursive: true })
  }
})

test('replacement preflight rejects nonterminal metadata and unsafe predecessor paths', async () => {
  const root = await mkdtemp(join(tmpdir(), 'palari-j4-predecessor-bad-'))
  try {
    const fixture = await makePredecessorChainBundle(root)
    const nonterminal = structuredClone(fixture.chain)
    nonterminal.runs[1].completedQuestions = 1
    await assert.rejects(
      verifyJ4PredecessorBundle({
        predecessorChain: nonterminal,
        repoRoot: root,
      }),
      (error) => error.code === 'PREDECESSOR_SCHEMA',
    )
    const unsafe = structuredClone(fixture.chain)
    unsafe.runs[0].private.checkpointPath = '../checkpoint.json'
    await assert.rejects(
      verifyJ4PredecessorBundle({
        predecessorChain: unsafe,
        repoRoot: root,
      }),
      (error) => error.code === 'PREDECESSOR_PATH_INVALID',
    )
  } finally {
    await rm(root, { force: true, recursive: true })
  }
})

test('tracked-file audit rejects captured credentials and credential-shaped values', async () => {
  const root = await mkdtemp(join(tmpdir(), 'palari-j4-tracked-audit-'))
  try {
    await atomicWriteJ4(join(root, 'safe.txt'), 'ordinary tracked text\n')
    const audit = await auditJ4TrackedFiles({
      forbiddenSecrets: ['captured-test-key'],
      repoRoot: root,
      trackedPaths: ['safe.txt'],
    })
    assert.equal(audit.files, 1)

    await atomicWriteJ4(
      join(root, 'captured.txt'),
      'captured-test-key\n',
    )
    await assert.rejects(
      auditJ4TrackedFiles({
        forbiddenSecrets: ['captured-test-key'],
        repoRoot: root,
        trackedPaths: ['safe.txt', 'captured.txt'],
      }),
      (error) => error.code === 'SECRET_ARTIFACT',
    )

    await atomicWriteJ4(
      join(root, 'shaped.txt'),
      `${['AI', 'za0123456789abcdefghijklmnop'].join('')}\n`,
    )
    await assert.rejects(
      auditJ4TrackedFiles({
        repoRoot: root,
        trackedPaths: ['safe.txt', 'shaped.txt'],
      }),
      (error) => error.code === 'CREDENTIAL_PATTERN_ARTIFACT',
    )
  } finally {
    await rm(root, { force: true, recursive: true })
  }
})

test('main and CLI refuse all v1-v3 identities before dependencies or credentials', async () => {
  let dependencyReads = 0
  let secretReads = 0
  const dependencies = new Proxy({}, {
    get() {
      dependencyReads += 1
      throw new Error('terminal guard read a dependency')
    },
  })
  const env = {}
  Object.defineProperties(env, {
    GEMINI_API_KEY: {
      enumerable: true,
      get() {
        secretReads += 1
        throw new Error('terminal guard read GEMINI_API_KEY')
      },
    },
    OPENAI_API_KEY: {
      enumerable: true,
      get() {
        secretReads += 1
        throw new Error('terminal guard read OPENAI_API_KEY')
      },
    },
  })

  for (const runId of [
    'j4-longmemeval-s60-v1',
    'j4-longmemeval-s60-v2',
    J4_LIVE_RUN_ID,
  ]) {
    await assert.rejects(
      main({
        args: ['--run', runId],
        dependencies,
        env,
        repoRoot: '/definitely/not/a/j4/repository',
      }),
      (error) => error.code === 'J4_RUN_TERMINAL',
    )
  }
  assert.equal(dependencyReads, 0)
  assert.equal(secretReads, 0)

  const cli = spawnSync(
    process.execPath,
    [
      fileURLToPath(
        new URL('../evals/run-longmemeval-live.mjs', import.meta.url),
      ),
      '--run',
      J4_LIVE_RUN_ID,
    ],
    {
      encoding: 'utf8',
      env: { PATH: process.env.PATH },
    },
  )
  assert.equal(cli.status, 1)
  assert.match(cli.stderr, /J4_RUN_TERMINAL: .* terminal/i)
  assert.doesNotMatch(cli.stderr, /dataset|credential|api.?key/i)
})

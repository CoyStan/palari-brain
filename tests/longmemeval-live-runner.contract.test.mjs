import { mkdtemp, mkdir, open, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  J4_FIRST_TRANCHE_QUESTION_IDS,
  J4_PROPOSED_TRANCHE_GATES,
  SEALED_U8_QUESTION_IDS,
} from '../evals/longmemeval-plan.mjs'
import {
  J4_GEMINI_MODEL,
  J4_LIVE_RUN_ID,
  j4ExecutionQuestionIds,
  j4LimitsForCumulativeQuestions,
} from '../evals/longmemeval-live-config.mjs'
import {
  J4_DENY_GEMINI_KEY,
  J4_DENY_OPENAI_KEY,
  J4_GOOGLE_CREDENTIAL_ALIASES,
  acquireJ4RunLock,
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
} from '../evals/run-longmemeval-live.mjs'

const TYPES = [
  'knowledge-update',
  'multi-session',
  'single-session-assistant',
  'single-session-preference',
  'single-session-user',
  'temporal-reasoning',
]

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

function validGeminiResponse(text = '{"memories":[]}') {
  return {
    finishReason: 'STOP',
    modelVersion: J4_GEMINI_MODEL,
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
          ? '{"memories":[]}'
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

function fakeMainDependencies({
  meterFactory,
  population = syntheticPopulation(),
  runQuestion = runFakeQuestion,
} = {}) {
  const active = config()
  return {
    async auditTrackedFiles() {
      return {
        files: 84,
        trackedPathsSha256: '7'.repeat(64),
      }
    },
    async createMeteredTransport(options) {
      return meterFactory(options)
    },
    async inspectGitCutPoint() {
      return { administrativeHead: 'admin-main-head' }
    },
    async loadAuthority() {
      return {
        authority: authority(),
        authorityPath:
          `evals/live-runs/${J4_LIVE_RUN_ID}.authority.json`,
        authoritySha256: '8'.repeat(64),
      }
    },
    async loadConfig() {
      return {
        config: active,
        configPath: `evals/live-runs/${J4_LIVE_RUN_ID}.json`,
        configSha256: 'd'.repeat(64),
        predictions: predictions(population),
        predictionsSha256: 'f'.repeat(64),
      }
    },
    log() {},
    preparePopulation() {
      return {
        ...population,
        manifest: {
          datasetSha256: 'e'.repeat(64),
        },
      }
    },
    async readFile() {
      return Buffer.from('synthetic canonical dataset')
    },
    runQuestion,
  }
}

function fakeMainEnvironment() {
  return {
    GEMINI_API_KEY: 'runner-test-gemini-key',
    GOOGLE_API_KEY: 'runner-test-shadow-google-key',
    OPENAI_API_KEY: 'runner-test-openai-key',
    PALARI_J4_CONFIRM_SPEND: '1',
    PALARI_J4_CUMULATIVE_QUESTIONS: '5',
    PALARI_J4_SPEND_CAP_USD: '2.5',
  }
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

test('runner import is inert and CLI run identity is exact', () => {
  assert.equal(
    parseJ4LiveArgs(['--run', J4_LIVE_RUN_ID]),
    J4_LIVE_RUN_ID,
  )
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

test('compatibility smoke is exactly one metered Gemini JSON-writer request', async () => {
  const calls = []
  const result = await runJ4SmokeSuite({
    async callGemini(request) {
      calls.push(request)
      return validGeminiResponse()
    },
  })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].operationId, 'smoke:gemini-writer')
  assert.equal(calls[0].purpose, 'writer')
  assert.equal(result.logicalOperations, 1)
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
    assert.deepEqual(
      transport.counts(),
      { answerCalls: 5, judgeCalls: 5, writerCalls: 6 },
    )
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

test('main passes frozen limits, scrubs provider aliases, and stops at five', async () => {
  const root = await mkdtemp(join(tmpdir(), 'palari-j4-main-five-'))
  const env = fakeMainEnvironment()
  const transport = fakeTransport()
  let meterOptions
  const dependencies = fakeMainDependencies({
    meterFactory(options) {
      meterOptions = options
      return transport
    },
  })
  try {
    const outcome = await main({
      args: ['--run', J4_LIVE_RUN_ID],
      dependencies,
      env,
      repoRoot: root,
    })
    assert.deepEqual(
      meterOptions.limits,
      j4LimitsForCumulativeQuestions(5),
    )
    assert.equal(outcome.report.completedQuestions, 5)
    assert.equal(outcome.checkpoint.questions[5].status, 'pending')
    for (const name of J4_GOOGLE_CREDENTIAL_ALIASES) {
      assert.equal(env[name], J4_DENY_GEMINI_KEY)
    }
    assert.equal(env.OPENAI_API_KEY, J4_DENY_OPENAI_KEY)
    await verifyJ4ArtifactManifest(
      join(root, 'evals', 'results', J4_LIVE_RUN_ID),
    )
  } finally {
    await rm(root, { force: true, recursive: true })
  }
})

test('main rejects a checkpointless stale run directory before key capture', async () => {
  const root = await mkdtemp(join(tmpdir(), 'palari-j4-main-stale-'))
  const runDir = join(root, 'evals', 'results', J4_LIVE_RUN_ID)
  await mkdir(runDir, { recursive: true, mode: 0o700 })
  let secretReads = 0
  const env = {
    PALARI_J4_CONFIRM_SPEND: '1',
    PALARI_J4_CUMULATIVE_QUESTIONS: '5',
    PALARI_J4_SPEND_CAP_USD: '2.5',
  }
  Object.defineProperties(env, {
    GEMINI_API_KEY: {
      enumerable: true,
      get() {
        secretReads += 1
        return 'must-not-be-read'
      },
    },
    OPENAI_API_KEY: {
      enumerable: true,
      get() {
        secretReads += 1
        return 'must-not-be-read'
      },
    },
  })
  try {
    await assert.rejects(
      main({
        args: ['--run', J4_LIVE_RUN_ID],
        dependencies: fakeMainDependencies(),
        env,
        repoRoot: root,
      }),
      (error) => error.code === 'STALE_RUN_DIRECTORY',
    )
    assert.equal(secretReads, 0)
  } finally {
    await rm(root, { force: true, recursive: true })
  }
})

test('operational failure preserves a terminal private report and manifest', async () => {
  const root = await mkdtemp(join(tmpdir(), 'palari-j4-main-failure-'))
  const transport = fakeTransport()
  transport.callJudge = async () => ({
    modelVersion: 'gpt-4o-2024-08-06',
    text: 'no',
  })
  try {
    await assert.rejects(
      main({
        args: ['--run', J4_LIVE_RUN_ID],
        dependencies: fakeMainDependencies({
          meterFactory() {
            return transport
          },
        }),
        env: fakeMainEnvironment(),
        repoRoot: root,
      }),
      (error) => error.code === 'JUDGE_RESULT_UNVALIDATED',
    )
    const runDir = join(root, 'evals', 'results', J4_LIVE_RUN_ID)
    const checkpoint = JSON.parse(
      await readFile(join(runDir, 'checkpoint.json'), 'utf8'),
    )
    assert.equal(checkpoint.status, 'failed')
    assert.equal(checkpoint.questions[0].status, 'failed')
    const report = JSON.parse(
      await readFile(join(runDir, 'report.json'), 'utf8'),
    )
    assert.equal(report.status, 'failed')
    await verifyJ4ArtifactManifest(runDir)
  } finally {
    await rm(root, { force: true, recursive: true })
  }
})

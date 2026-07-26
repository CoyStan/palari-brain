// One-shot founder-gated runner for one LongMemEval question through Palari's
// incremental active-memory path.
//
// Exact scope: 243 sequential Gemini reducer calls, one Gemini answer, one
// stateless official-compatible OpenAI judge, then a mandatory stop before
// question 2. Every dispatched operation is terminal; no retry or resume.

import {
  access,
  chmod,
  lstat,
  mkdir,
  readFile,
} from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  createActiveBrainMeteredTransport,
  J4LiveError,
  reconcileJ4Ledger,
} from './active-brain-live-meter.mjs'
import {
  incrementalLongMemEvalExchangeStats,
  runIncrementalLongMemEvalQuestion,
} from './arms/incremental-memory-longmemeval-live-arm.mjs'
import {
  buildIncrementalLongMemEvalJudgeBody,
  reserveIncrementalLongMemEvalJudge,
} from './incremental-longmemeval-judge.mjs'
import {
  createIncrementalLongMemEvalJudgeTransport,
} from './incremental-longmemeval-judge-transport.mjs'
import * as liveConfig from './incremental-longmemeval-live-config.mjs'
import * as smokeConfig from './incremental-memory-smoke-config.mjs'
import {
  parseLongMemEvalJudgeLabel,
} from './longmemeval-judge.mjs'
import {
  prepareJ4PinnedS60,
  SEALED_U8_QUESTION_IDS,
} from './longmemeval-plan.mjs'
import {
  verifyIncrementalMemorySmokePredecessor,
} from './run-incremental-memory-smoke.mjs'
import {
  acquireJ4RunLock,
  atomicWriteJ4,
  auditJ4TrackedFiles,
  collectJ4PrivateArtifacts,
  inspectJ4GitCutPoint,
  J4_DENY_GEMINI_KEY,
  J4_DENY_OPENAI_KEY,
  J4_GOOGLE_CREDENTIAL_ALIASES,
  verifyJ4ArtifactManifest,
} from './run-longmemeval-live.mjs'

const here = dirname(fileURLToPath(import.meta.url))
export const INCREMENTAL_LONGMEMEVAL_REPO_ROOT = dirname(here)

// The post-run seal adds the run ID. At the preparation cut this must remain
// empty so exactly one clean, pushed invocation is possible.
export const INCREMENTAL_LONGMEMEVAL_TERMINAL_RUN_IDS =
  Object.freeze([])
const terminalRunIds = new Set(
  INCREMENTAL_LONGMEMEVAL_TERMINAL_RUN_IDS,
)

function stable(value) {
  if (Array.isArray(value)) return value.map(stable)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, stable(value[key])]),
  )
}

function sameJson(left, right) {
  return JSON.stringify(stable(left)) === JSON.stringify(stable(right))
}

function sameUsd(left, right) {
  return Number.isFinite(Number(left)) &&
    Number.isFinite(Number(right)) &&
    Math.abs(Number(left) - Number(right)) <= 1e-12
}

function isoNow(now = () => new Date().toISOString()) {
  const value = String(now())
  if (!value || Number.isNaN(Date.parse(value))) {
    throw new J4LiveError(
      'CLOCK_INVALID',
      'Incremental LongMemEval clock must return an ISO timestamp.',
    )
  }
  return value
}

async function exists(path) {
  try {
    await access(path)
    return true
  } catch (error) {
    if (error?.code === 'ENOENT') return false
    throw error
  }
}

async function sha256File(path) {
  return liveConfig.incrementalLongMemEvalSha256(
    await readFile(path),
  )
}

function sanitizedError(error, secrets = []) {
  let message = String(
    error?.message ?? 'Incremental LongMemEval live run failed.',
  )
  for (const secret of secrets) {
    if (secret) message = message.replaceAll(secret, '[REDACTED_SECRET]')
  }
  return {
    code: String(
      error?.code ?? error?.name ?? 'INCREMENTAL_LONGMEMEVAL_FAILURE',
    ).slice(0, 100),
    message: message.slice(0, 320),
  }
}

export function parseIncrementalLongMemEvalArgs(args = []) {
  if (args.length !== 2 ||
    args[0] !== '--run' ||
    args[1] !== liveConfig.INCREMENTAL_LONGMEMEVAL_RUN_ID) {
    throw new J4LiveError(
      'RUN_ID_REQUIRED',
      'Invoke the incremental LongMemEval runner with its exact frozen run ID.',
    )
  }
  return args[1]
}

export function assertIncrementalLongMemEvalOpen(runId) {
  if (terminalRunIds.has(runId)) {
    throw new J4LiveError(
      'J4_RUN_TERMINAL',
      `J4 run ${runId} is terminal and cannot be resumed or rerolled.`,
    )
  }
  if (runId === liveConfig.INCREMENTAL_LONGMEMEVAL_RUN_ID) {
    return runId
  }
  throw new J4LiveError(
    'RUN_ID_REQUIRED',
    'No matching incremental LongMemEval identity is configured.',
  )
}

export async function denyIncrementalLongMemEvalRetry() {
  throw new J4LiveError(
    'INCREMENTAL_LONGMEMEVAL_RETRY_FORBIDDEN',
    'This identity permits one physical dispatch per logical operation.',
  )
}

export function incrementalLongMemEvalResultPaths(
  repoRoot = INCREMENTAL_LONGMEMEVAL_REPO_ROOT,
) {
  const resultsRoot = resolve(
    repoRoot,
    liveConfig.INCREMENTAL_LONGMEMEVAL_RESULTS_ROOT,
  )
  const runDir = join(
    resultsRoot,
    liveConfig.INCREMENTAL_LONGMEMEVAL_RUN_ID,
  )
  const transcriptsDir = join(runDir, 'transcripts')
  return {
    answerResultPath: join(runDir, 'answer-result.json'),
    artifactManifestPath: join(runDir, 'artifact-manifest.json'),
    checkpointPath: join(runDir, 'checkpoint.json'),
    checkpointsDir: join(runDir, 'interaction-checkpoints'),
    geminiLedgerPath: join(runDir, 'gemini-meter.jsonl'),
    geminiTranscriptsDir: join(transcriptsDir, 'gemini'),
    judgeMeterPath: join(runDir, 'judge-meter.json'),
    judgeTranscriptsDir: join(transcriptsDir, 'openai'),
    lockPath: join(
      resultsRoot,
      `${liveConfig.INCREMENTAL_LONGMEMEVAL_RUN_ID}.lock`,
    ),
    questionResultPath: join(runDir, 'question-result.json'),
    reportJsonPath: join(runDir, 'report.json'),
    reportMarkdownPath: join(runDir, 'report.md'),
    resultsRoot,
    runDir,
    transcriptsDir,
    workspaceDir: join(runDir, 'workspace'),
  }
}

export async function auditIncrementalLongMemEvalTrackedArtifacts({
  config,
  repoRoot,
} = {}) {
  const root = resolve(repoRoot)
  const seen = new Set()
  for (const artifact of config?.artifacts ?? []) {
    const path = resolve(root, artifact.path)
    const repositoryPath = relative(root, path)
    if (!repositoryPath ||
      repositoryPath.startsWith('..') ||
      path !== resolve(root, repositoryPath) ||
      seen.has(repositoryPath)) {
      throw new J4LiveError(
        'INCREMENTAL_ARTIFACT_PATH',
        'Runtime artifact paths must be unique and repository-relative.',
      )
    }
    seen.add(repositoryPath)
    const metadata = await lstat(path)
    if (!metadata.isFile() ||
      metadata.isSymbolicLink() ||
      await sha256File(path) !== artifact.sha256) {
      throw new J4LiveError(
        'INCREMENTAL_ARTIFACT_CHANGED',
        `Incremental LongMemEval artifact changed: ${repositoryPath}.`,
      )
    }
  }
  const required = [
    'evals/active-brain-live-meter.mjs',
    'evals/arms/incremental-memory-longmemeval-live-arm.mjs',
    'evals/incremental-longmemeval-judge-transport.mjs',
    'evals/incremental-longmemeval-judge.mjs',
    'evals/incremental-longmemeval-live-config.mjs',
    'evals/live-transcript.mjs',
    'evals/longmemeval-judge.mjs',
    'evals/longmemeval-plan.mjs',
    'evals/run-incremental-longmemeval-live.mjs',
    'evals/run-incremental-memory-smoke.mjs',
    'evals/run-longmemeval-live.mjs',
    'src/brain.mjs',
    'src/memory-digest-store.mjs',
    'src/memory-reducer.mjs',
  ]
  if (required.some((path) => !seen.has(path))) {
    throw new J4LiveError(
      'INCREMENTAL_ARTIFACT_INCOMPLETE',
      'Incremental LongMemEval runtime closure is not fully pinned.',
    )
  }
  return {
    artifacts: seen.size,
    artifactSetSha256:
      liveConfig.incrementalLongMemEvalSha256(
        JSON.stringify(config.artifacts),
      ),
  }
}

export async function verifyIncrementalLongMemEvalPredecessor({
  config,
  repoRoot,
} = {}) {
  const predecessor = config?.predecessor
  if (!sameJson(
    predecessor,
    liveConfig.INCREMENTAL_LONGMEMEVAL_PREDECESSOR,
  )) {
    throw new J4LiveError(
      'INCREMENTAL_PREDECESSOR_SCHEMA',
      'Incremental LongMemEval predecessor descriptor changed.',
    )
  }
  const oldLoaded =
    await smokeConfig.loadIncrementalMemorySmokeConfig({ repoRoot })
  const oldAuthority =
    await smokeConfig.loadIncrementalMemorySmokeAuthority({ repoRoot })
  if (oldLoaded.configSha256 !== predecessor.tracked.config.sha256 ||
    oldLoaded.predictionsSha256 !==
      predecessor.tracked.predictions.sha256 ||
    oldAuthority.authoritySha256 !==
      predecessor.tracked.authority.sha256) {
    throw new J4LiveError(
      'INCREMENTAL_PREDECESSOR_TRACKED',
      'Incremental smoke tracked identity changed.',
    )
  }
  for (const entry of [
    predecessor.sealedRunner,
    ...Object.values(predecessor.tracked),
  ]) {
    if (await sha256File(resolve(repoRoot, entry.path)) !==
      entry.sha256) {
      throw new J4LiveError(
        'INCREMENTAL_PREDECESSOR_HASH',
        'Incremental smoke tracked evidence changed.',
      )
    }
  }
  for (const entry of Object.values(predecessor.private)) {
    const path = resolve(repoRoot, entry.path)
    const metadata = await lstat(path)
    if (!metadata.isFile() ||
      metadata.isSymbolicLink() ||
      (metadata.mode & 0o777) !== 0o600 ||
      await sha256File(path) !== entry.sha256) {
      throw new J4LiveError(
        'INCREMENTAL_PREDECESSOR_HASH',
        'Incremental smoke private evidence changed.',
      )
    }
  }
  const priorChain =
    await verifyIncrementalMemorySmokePredecessor({
      config: oldLoaded.config,
      repoRoot,
    })
  if (!sameUsd(
    priorChain.accountedUsd,
    predecessor.openingAccountedUsd,
  )) {
    throw new J4LiveError(
      'INCREMENTAL_PREDECESSOR_CHAIN',
      'Incremental smoke opening spend no longer reconciles.',
    )
  }
  await verifyJ4ArtifactManifest(resolve(
    repoRoot,
    `evals/results/${predecessor.runId}`,
  ))
  const checkpoint = JSON.parse(await readFile(
    resolve(repoRoot, predecessor.private.checkpoint.path),
    'utf8',
  ))
  const meter = await reconcileJ4Ledger(
    resolve(repoRoot, predecessor.private.meter.path),
    {
      capUsd: smokeConfig.INCREMENTAL_MEMORY_SMOKE_FRESH_SUBCAP_USD,
      limits: smokeConfig.INCREMENTAL_MEMORY_SMOKE_LIMITS,
    },
  )
  if (checkpoint.status !== predecessor.status ||
    checkpoint.identity?.runId !== predecessor.runId ||
    checkpoint.identity?.configSha256 !==
      predecessor.tracked.config.sha256 ||
    checkpoint.identity?.authoritySha256 !==
      predecessor.tracked.authority.sha256 ||
    checkpoint.identity?.predictionsSha256 !==
      predecessor.tracked.predictions.sha256 ||
    checkpoint.trackedSecretAudit?.administrativeHead !==
      predecessor.administrativeHead ||
    meter.attempts !== predecessor.attempts ||
    meter.retries.length !== 0 ||
    !sameJson(meter.logicalRequests, predecessor.logicalRequests) ||
    !sameUsd(meter.accounted.usd, predecessor.currentRunAccountedUsd) ||
    !sameUsd(meter.measured.usd, predecessor.currentRunMeasuredUsd) ||
    !sameUsd(meter.uncertain.usd, predecessor.currentRunUncertainUsd)) {
    throw new J4LiveError(
      'INCREMENTAL_PREDECESSOR_TERMINAL',
      'Incremental smoke terminal profile changed.',
    )
  }
  const accountedUsd = Number((
    priorChain.accountedUsd + meter.accounted.usd
  ).toFixed(12))
  const measuredUsd = Number((
    priorChain.measuredUsd + meter.measured.usd
  ).toFixed(12))
  const uncertainUsd = Number((
    priorChain.uncertainUsd + meter.uncertain.usd
  ).toFixed(12))
  if (!sameUsd(accountedUsd, predecessor.cumulativeAccountedUsd) ||
    !sameUsd(measuredUsd, predecessor.cumulativeMeasuredUsd) ||
    !sameUsd(uncertainUsd, predecessor.cumulativeUncertainUsd)) {
    throw new J4LiveError(
      'INCREMENTAL_PREDECESSOR_SPEND',
      'Incremental smoke cumulative spend no longer reconciles.',
    )
  }
  return {
    accountedUsd,
    checkpointSha256: predecessor.private.checkpoint.sha256,
    manifestSha256: predecessor.private.manifest.sha256,
    measuredUsd,
    meterSha256: predecessor.private.meter.sha256,
    runId: predecessor.runId,
    uncertainUsd,
  }
}

export function incrementalLongMemEvalPopulation(prepared = {}) {
  const instance = prepared?.executionOrder?.[0]
  const stats = incrementalLongMemEvalExchangeStats(instance)
  const executionOrderSha256 =
    liveConfig.incrementalLongMemEvalSha256(
      (prepared?.executionOrder ?? [])
        .map((entry) => entry.questionId)
        .join('\n'),
    )
  if (prepared?.manifest?.datasetSha256 !==
      liveConfig.INCREMENTAL_LONGMEMEVAL_DATASET.sha256 ||
    executionOrderSha256 !==
      liveConfig.INCREMENTAL_LONGMEMEVAL_DATASET
        .stagedExecutionOrderSha256 ||
    instance?.questionId !==
      liveConfig.INCREMENTAL_LONGMEMEVAL_QUESTION_ID ||
    SEALED_U8_QUESTION_IDS.includes(instance?.questionId) ||
    instance?.questionType !==
      liveConfig.INCREMENTAL_LONGMEMEVAL_POPULATION.questionType ||
    instance?.isAbstention !== false ||
    instance?.questionDate !==
      liveConfig.INCREMENTAL_LONGMEMEVAL_POPULATION.questionDate ||
    instance?.sessions?.length !==
      liveConfig.INCREMENTAL_LONGMEMEVAL_POPULATION.sessions ||
    instance?.question?.length !==
      liveConfig.INCREMENTAL_LONGMEMEVAL_POPULATION.questionCharacters ||
    String(instance?.answer ?? '').length !==
      liveConfig.INCREMENTAL_LONGMEMEVAL_POPULATION.answerCharacters ||
    !sameJson(stats, {
      exchangePlanSha256:
        liveConfig.INCREMENTAL_LONGMEMEVAL_POPULATION
          .exchangePlanSha256,
      interactions:
        liveConfig.INCREMENTAL_LONGMEMEVAL_POPULATION.interactions,
      maximumInteractionChars:
        liveConfig.INCREMENTAL_LONGMEMEVAL_POPULATION
          .maximumInteractionCharacters,
      rawTurns:
        liveConfig.INCREMENTAL_LONGMEMEVAL_POPULATION.rawTurns,
      reducerLogicalRequests:
        liveConfig.INCREMENTAL_LONGMEMEVAL_POPULATION.interactions,
      visibleChars:
        liveConfig.INCREMENTAL_LONGMEMEVAL_POPULATION
          .visibleCharacters,
      visibleMessages:
        liveConfig.INCREMENTAL_LONGMEMEVAL_POPULATION.visibleMessages,
    })) {
    throw new J4LiveError(
      'INCREMENTAL_POPULATION_CHANGED',
      'The one-question incremental population changed.',
    )
  }
  return { instance, stats }
}

function buildIdentity({
  artifactAudit,
  authoritySha256,
  config,
  configSha256,
  predictionsSha256,
}) {
  return {
    artifactSetSha256: artifactAudit.artifactSetSha256,
    authoritySha256,
    configSha256,
    datasetSha256:
      liveConfig.INCREMENTAL_LONGMEMEVAL_DATASET.sha256,
    models: { ...config.models },
    openingAccountedUsd:
      liveConfig.INCREMENTAL_LONGMEMEVAL_OPENING_ACCOUNTED_USD,
    predictionsSha256,
    productCommit: config.productCommit,
    questionId: liveConfig.INCREMENTAL_LONGMEMEVAL_QUESTION_ID,
    runDate: config.runDate,
    runId: config.runId,
    schemaVersion: 1,
  }
}

function initialCheckpoint({
  identity,
  population,
  predecessorAudit,
  predictions,
}) {
  return {
    answer: {
      completedAt: null,
      resultFile: null,
      resultSha256: null,
      status: 'pending',
    },
    events: [],
    identity,
    interactions: [],
    invocations: [],
    judge: {
      completedAt: null,
      correct: null,
      status: 'pending',
    },
    meter: {
      gemini: null,
      judge: null,
    },
    population,
    predecessorAudit,
    predictions: predictions.predictions.map((entry) => ({
      id: entry.id,
      predicted: entry.predicted,
      statement: entry.statement,
    })),
    question: {
      completedAt: null,
      questionId: identity.questionId,
      resultFile: null,
      resultSha256: null,
      startedAt: null,
      status: 'pending',
    },
    schemaVersion: 1,
    status: 'ready',
  }
}

async function writeCheckpoint(path, checkpoint) {
  await atomicWriteJ4(path, `${JSON.stringify(checkpoint, null, 2)}\n`)
}

function assertGeminiMeter(snapshot, {
  answer = 0,
  reducers,
} = {}) {
  const expectedLogical = {
    ...(reducers ? { writer: reducers } : {}),
    ...(answer ? { answer } : {}),
  }
  if (!sameJson(snapshot?.logicalRequests ?? {}, expectedLogical) ||
    snapshot?.attempts !== reducers + answer ||
    snapshot?.retries?.length !== 0 ||
    Number(snapshot?.accounted?.judgeInputTokens ?? 0) !== 0 ||
    Number(snapshot?.accounted?.judgeOutputTokens ?? 0) !== 0 ||
    Number(snapshot?.accounted?.geminiInputTokens ?? 0) >
      liveConfig.INCREMENTAL_LONGMEMEVAL_GEMINI_LIMITS
        .maxTokens.geminiInput ||
    Number(snapshot?.accounted?.geminiOutputTokens ?? 0) >
      liveConfig.INCREMENTAL_LONGMEMEVAL_GEMINI_LIMITS
        .maxTokens.geminiOutputIncludingThinking ||
    Number(snapshot?.accounted?.usd ?? 0) >
      liveConfig.INCREMENTAL_LONGMEMEVAL_FRESH_SUBCAP_USD + 1e-12 ||
    !sameUsd(
      snapshot?.accounted?.usd,
      Number(snapshot?.measured?.usd ?? 0) +
        Number(snapshot?.uncertain?.usd ?? 0),
    )) {
    throw new J4LiveError(
      'INCREMENTAL_GEMINI_METER',
      'Gemini meter differs from the exact no-retry incremental prefix.',
    )
  }
  return snapshot
}

function spendFromEvidence({ gemini, judge, predecessor }) {
  const judgeAccounted = Number(
    judge?.terminal?.accountedUsd ?? 0,
  )
  const judgeMeasured = Number(
    judge?.terminal?.measured?.usd ?? 0,
  )
  const judgeUncertain = Number(
    judge?.terminal?.uncertain?.usd ?? 0,
  )
  const freshAccountedUsd = Number((
    Number(gemini?.accounted?.usd ?? 0) + judgeAccounted
  ).toFixed(12))
  const freshMeasuredUsd = Number((
    Number(gemini?.measured?.usd ?? 0) + judgeMeasured
  ).toFixed(12))
  const freshUncertainUsd = Number((
    Number(gemini?.uncertain?.usd ?? 0) + judgeUncertain
  ).toFixed(12))
  return {
    cumulativeAccountedUsd: Number((
      predecessor.accountedUsd + freshAccountedUsd
    ).toFixed(12)),
    cumulativeMeasuredUsd: Number((
      predecessor.measuredUsd + freshMeasuredUsd
    ).toFixed(12)),
    cumulativeUncertainUsd: Number((
      predecessor.uncertainUsd + freshUncertainUsd
    ).toFixed(12)),
    freshAccountedUsd,
    freshMeasuredUsd,
    freshUncertainUsd,
  }
}

export function gradeIncrementalLongMemEvalPredictions({
  checkpoint,
  reportIsPrivate = true,
} = {}) {
  const gemini = checkpoint?.meter?.gemini
  const judge = checkpoint?.meter?.judge
  const spend = checkpoint?.spend
  const observations = {
    ALL_INTERACTIONS_REDUCED:
      checkpoint?.interactions?.length === 243 &&
      checkpoint?.interactions?.every((entry, index) =>
        entry.ordinal === index + 1 &&
        entry.status === 'completed'),
    DIGEST_READY_AND_BOUNDED:
      checkpoint?.answer?.digestReady === true &&
      checkpoint?.answer?.digestPending === 0 &&
      checkpoint?.answer?.digestItems <= 64 &&
      checkpoint?.answer?.digestChars <= 24_000,
    EXACT_Q1_ONLY:
      checkpoint?.question?.questionId ===
        liveConfig.INCREMENTAL_LONGMEMEVAL_QUESTION_ID &&
      checkpoint?.invocations?.length === 1,
    INCREMENTAL_BOUNDARY_HELD:
      checkpoint?.interactions?.length === 243 &&
      checkpoint?.interactions?.every((entry) =>
        /^[a-f0-9]{64}$/.test(entry.reducerRequestSha256 ?? '')),
    NO_RETRY:
      gemini?.attempts === 244 &&
      gemini?.retries?.length === 0 &&
      judge?.attempt === 1,
    OFFICIAL_JUDGE_CORRECT:
      checkpoint?.judge?.correct === true,
    ONE_DIGEST_ANSWER:
      checkpoint?.answer?.status === 'completed' &&
      gemini?.logicalRequests?.answer === 1,
    PRIVATE_AND_TERMINAL:
      reportIsPrivate === true &&
      ['complete', 'failed'].includes(checkpoint?.status),
    SPEND_WITHIN_ENVELOPE:
      Number(spend?.freshAccountedUsd) <=
        liveConfig.INCREMENTAL_LONGMEMEVAL_COST_ENVELOPE
          .freshMaximumUsd + 1e-12 &&
      Number(spend?.cumulativeAccountedUsd) <
        liveConfig.INCREMENTAL_LONGMEMEVAL_CUMULATIVE_CAP_USD,
  }
  return liveConfig.INCREMENTAL_LONGMEMEVAL_EXPECTED_PREDICTIONS
    .map((prediction) => {
      const observed = observations[prediction.id]
      return {
        id: prediction.id,
        outcome: observed === true
          ? 'hit'
          : observed === false
            ? 'miss'
            : 'not_observed',
        predicted: prediction.predicted,
        statement: prediction.statement,
      }
    })
    .sort((left, right) => {
      const rank = { miss: 0, not_observed: 1, hit: 2 }
      return rank[left.outcome] - rank[right.outcome]
    })
}

function buildPrivateReport(checkpoint) {
  return {
    disclaimer:
      'Private one-question LongMemEval evidence; do not commit or publish scores, answers, transcripts, or raw benchmark content.',
    answer: checkpoint.answer,
    grades: gradeIncrementalLongMemEvalPredictions({ checkpoint }),
    interactions: {
      completed: checkpoint.interactions.length,
      expected: 243,
    },
    judge: checkpoint.judge,
    meter: checkpoint.meter,
    predecessor: checkpoint.predecessorAudit,
    question: checkpoint.question,
    runId: checkpoint.identity.runId,
    schemaVersion: 1,
    spend: checkpoint.spend,
    status: checkpoint.status,
  }
}

function renderPrivateReport(report) {
  const grades = report.grades.map((grade) =>
    `- ${grade.outcome.toUpperCase()} ${grade.id}: ${grade.statement}`)
  return [
    '# Incremental LongMemEval private live report',
    '',
    `> ${report.disclaimer}`,
    '',
    `- Status: ${report.status}`,
    `- Question: ${report.question.questionId}`,
    `- Completed interactions: ${report.interactions.completed}/${report.interactions.expected}`,
    `- Reducer calls: ${report.meter.gemini?.logicalRequests?.writer ?? 0}`,
    `- Answer calls: ${report.meter.gemini?.logicalRequests?.answer ?? 0}`,
    `- Judge calls: ${report.meter.judge?.attempt ?? 0}`,
    `- Retries: ${report.meter.gemini?.retries?.length ?? 0}`,
    `- Official judge correct: ${report.judge.correct}`,
    `- Fresh accounted spend: $${Number(report.spend.freshAccountedUsd).toFixed(7)}`,
    `- Cumulative accounted spend: $${Number(report.spend.cumulativeAccountedUsd).toFixed(7)}`,
    '',
    '## Prediction grade (misses first)',
    '',
    ...grades,
    '',
  ].join('\n')
}

async function writeTerminalBundle({
  checkpoint,
  forbiddenSecrets,
  judgeTransport,
  now,
  paths,
  transport,
}) {
  if (transport) {
    const verified = await transport.verify()
    checkpoint.meter.gemini = verified.ledger
    checkpoint.geminiTranscriptAudit = verified.transcripts
  }
  if (judgeTransport) {
    const snapshot = await judgeTransport.snapshot()
    if (snapshot.attempts === 1) {
      const verified = await judgeTransport.verify()
      checkpoint.meter.judge = verified.meter
      checkpoint.judgeTranscriptAudit = {
        attempts: 1,
        transcript: verified.transcript,
      }
    } else {
      checkpoint.meter.judge = null
    }
  }
  checkpoint.spend = spendFromEvidence({
    gemini: checkpoint.meter.gemini,
    judge: checkpoint.meter.judge,
    predecessor: checkpoint.predecessorAudit,
  })
  const report = buildPrivateReport(checkpoint)
  await atomicWriteJ4(
    paths.reportJsonPath,
    `${JSON.stringify(report, null, 2)}\n`,
  )
  await atomicWriteJ4(
    paths.reportMarkdownPath,
    renderPrivateReport(report),
  )
  await writeCheckpoint(paths.checkpointPath, checkpoint)
  const artifacts = await collectJ4PrivateArtifacts(paths.runDir, {
    forbiddenSecrets,
  })
  await atomicWriteJ4(
    paths.artifactManifestPath,
    `${JSON.stringify({
      artifacts,
      generatedAt: isoNow(now),
      runId: checkpoint.identity.runId,
      schemaVersion: 1,
    }, null, 2)}\n`,
  )
  await verifyJ4ArtifactManifest(paths.runDir)
  return report
}

export async function main({
  args = process.argv.slice(2),
  dependencies = {},
  env = process.env,
  repoRoot = INCREMENTAL_LONGMEMEVAL_REPO_ROOT,
} = {}) {
  const runId = parseIncrementalLongMemEvalArgs(args)

  // Terminal denial deliberately precedes dependencies, files, results, data,
  // credentials, or network.
  assertIncrementalLongMemEvalOpen(runId)

  const loadConfig = dependencies.loadConfig ??
    liveConfig.loadIncrementalLongMemEvalConfig
  const loadAuthority = dependencies.loadAuthority ??
    liveConfig.loadIncrementalLongMemEvalAuthority
  const auditArtifacts = dependencies.auditArtifacts ??
    auditIncrementalLongMemEvalTrackedArtifacts
  const inspectGit = dependencies.inspectGitCutPoint ??
    inspectJ4GitCutPoint
  const verifyPredecessor = dependencies.verifyPredecessor ??
    verifyIncrementalLongMemEvalPredecessor
  const preparePopulation = dependencies.preparePopulation ??
    prepareJ4PinnedS60
  const selectPopulation = dependencies.selectPopulation ??
    incrementalLongMemEvalPopulation
  const assertEnvironment = dependencies.assertEnvironment ??
    liveConfig.assertIncrementalLongMemEvalEnvironment
  const auditTracked = dependencies.auditTrackedFiles ??
    auditJ4TrackedFiles
  const meterFactory = dependencies.createMeteredTransport ??
    createActiveBrainMeteredTransport
  const runQuestion = dependencies.runQuestion ??
    runIncrementalLongMemEvalQuestion
  const judgeFactory = dependencies.createJudgeTransport ??
    createIncrementalLongMemEvalJudgeTransport
  const read = dependencies.readFile ?? readFile
  const pathExists = dependencies.exists ?? exists
  const capturedFetch = dependencies.fetchImpl ?? globalThis.fetch
  const now = dependencies.now ?? (() => new Date().toISOString())
  const log = dependencies.log ?? console.log
  const paths = incrementalLongMemEvalResultPaths(repoRoot)

  const loaded = await loadConfig({ repoRoot })
  const loadedAuthority = await loadAuthority({ repoRoot })
  const artifactAudit = await auditArtifacts({
    config: loaded.config,
    repoRoot,
  })
  const repositoryPath = (path) =>
    relative(repoRoot, resolve(repoRoot, path))
  const artifactPaths = [...new Set([
    ...loaded.config.artifacts.map((entry) => entry.path),
    repositoryPath(loaded.configPath),
    repositoryPath(loaded.predictionsPath),
  ])]
  const authorityPath = repositoryPath(
    loadedAuthority.authorityPath,
  )
  const git = await inspectGit({
    artifactPaths,
    authorityPath,
    env,
    repoRoot,
    runDir: paths.runDir,
  })
  const lock = await acquireJ4RunLock(paths.lockPath)
  let previousUmask
  let judgeTransport
  let transport
  let checkpoint
  let population
  let secrets = []
  try {
    if (await pathExists(paths.runDir)) {
      throw new J4LiveError(
        'INCREMENTAL_RUN_ALREADY_EXISTS',
        'Incremental LongMemEval refuses to resume, replace, or overlay.',
      )
    }
    const predecessorAudit = await verifyPredecessor({
      config: loaded.config,
      repoRoot,
    })
    if (!sameUsd(
      predecessorAudit.accountedUsd,
      liveConfig.INCREMENTAL_LONGMEMEVAL_OPENING_ACCOUNTED_USD,
    )) {
      throw new J4LiveError(
        'INCREMENTAL_OPENING_SPEND',
        'Incremental LongMemEval has the wrong opening spend.',
      )
    }
    const raw = await read(resolve(
      repoRoot,
      loaded.config.dataset.path,
    ))
    population = selectPopulation(
      await preparePopulation({ raw }),
    )

    // Credentials are read only after tracked, predecessor, spend, and dataset
    // verification succeeds.
    const runtime = assertEnvironment(
      env,
      loaded.config,
      loadedAuthority.authority,
    )
    secrets = [runtime.geminiApiKey, runtime.openaiApiKey]
    const trackedSecretAudit = await auditTracked({
      env,
      forbiddenSecrets: secrets,
      repoRoot,
    })
    for (const name of J4_GOOGLE_CREDENTIAL_ALIASES) {
      env[name] = J4_DENY_GEMINI_KEY
    }
    env.OPENAI_API_KEY = J4_DENY_OPENAI_KEY

    previousUmask = process.umask(0o077)
    for (const directory of [
      paths.runDir,
      paths.checkpointsDir,
      paths.geminiTranscriptsDir,
      paths.judgeTranscriptsDir,
      paths.workspaceDir,
    ]) {
      await mkdir(directory, { recursive: true, mode: 0o700 })
      await chmod(directory, 0o700)
    }

    const identity = buildIdentity({
      artifactAudit,
      authoritySha256: loadedAuthority.authoritySha256,
      config: loaded.config,
      configSha256: loaded.configSha256,
      predictionsSha256: loaded.predictionsSha256,
    })
    checkpoint = initialCheckpoint({
      identity,
      population: {
        ...liveConfig.INCREMENTAL_LONGMEMEVAL_POPULATION,
      },
      predecessorAudit: {
        ...predecessorAudit,
        completedAt: isoNow(now),
      },
      predictions: loaded.predictions,
    })
    checkpoint.trackedSecretAudit = {
      ...trackedSecretAudit,
      administrativeHead: git.administrativeHead,
      completedAt: isoNow(now),
    }
    checkpoint.invocations.push({
      administrativeHead: git.administrativeHead,
      answerOperations: 1,
      cumulativeCapUsd: runtime.cumulativeCapUsd,
      freshSubcapUsd: runtime.freshSubcapUsd,
      judgeOperations: 1,
      openingAccountedUsd: predecessorAudit.accountedUsd,
      questionIds: [population.instance.questionId],
      reducerOperations: population.stats.interactions,
      startedAt: isoNow(now),
    })
    checkpoint.question.startedAt = isoNow(now)
    checkpoint.question.status = 'in_progress'
    checkpoint.status = 'running'
    await writeCheckpoint(paths.checkpointPath, checkpoint)

    transport = await meterFactory({
      answerGeneration:
        liveConfig.INCREMENTAL_LONGMEMEVAL_ANSWER_GENERATION,
      capUsd: liveConfig.INCREMENTAL_LONGMEMEVAL_FRESH_SUBCAP_USD,
      fetchImpl: capturedFetch,
      geminiApiKey: runtime.geminiApiKey,
      geminiModel: runtime.model,
      journalPath: paths.geminiLedgerPath,
      limits: liveConfig.INCREMENTAL_LONGMEMEVAL_GEMINI_LIMITS,
      openaiApiKey: J4_DENY_OPENAI_KEY,
      transcriptDirectory: paths.geminiTranscriptsDir,
      waitImpl: denyIncrementalLongMemEvalRetry,
      writerGeneration:
        liveConfig.INCREMENTAL_LONGMEMEVAL_REDUCER_GENERATION,
    })
    judgeTransport = await judgeFactory({
      cumulativeCapUsd:
        liveConfig.INCREMENTAL_LONGMEMEVAL_CUMULATIVE_CAP_USD,
      fetchImpl: capturedFetch,
      freshSubcapUsd:
        liveConfig.INCREMENTAL_LONGMEMEVAL_FRESH_SUBCAP_USD,
      getFreshAccountedUsd: async () =>
        (await transport.snapshot()).accounted.usd,
      meterPath: paths.judgeMeterPath,
      openaiApiKey: runtime.openaiApiKey,
      openingAccountedUsd: predecessorAudit.accountedUsd,
      transcriptDirectory: paths.judgeTranscriptsDir,
    })
    transport.installNetworkGuard()

    const armResult = await runQuestion({
      callGemini: transport.callGemini,
      instance: population.instance,
      onCheckpoint: async (interaction) => {
        const ordinal = checkpoint.interactions.length + 1
        if (interaction.completedInteraction !== ordinal ||
          ordinal > population.stats.interactions) {
          throw new J4LiveError(
            'INCREMENTAL_CHECKPOINT_ORDER',
            'Interaction checkpoint is duplicated or out of order.',
          )
        }
        const meter = assertGeminiMeter(
          await transport.snapshot(),
          { answer: 0, reducers: ordinal },
        )
        const record = {
          ...interaction,
          capturedAt: isoNow(now),
          meter,
          questionId: population.instance.questionId,
          schemaVersion: 1,
        }
        const text = `${JSON.stringify(record, null, 2)}\n`
        const file = join(
          'interaction-checkpoints',
          `${String(ordinal).padStart(3, '0')}.json`,
        )
        await atomicWriteJ4(join(paths.runDir, file), text)
        checkpoint.interactions.push({
          activeMemoriesSha256: interaction.activeMemoriesSha256,
          completedAt: record.capturedAt,
          digestChars: interaction.digestChars,
          file,
          ordinal,
          reducerRequestSha256:
            interaction.reducerRequestSha256,
          reducerResponseSha256:
            interaction.reducerResponseSha256,
          sha256:
            liveConfig.incrementalLongMemEvalSha256(text),
          sourceMessageId: interaction.sourceMessageId,
          status: 'completed',
        })
        checkpoint.meter.gemini = meter
        checkpoint.events.push({
          ordinal,
          status: 'interaction_completed',
          timestamp: record.capturedAt,
        })
        await writeCheckpoint(paths.checkpointPath, checkpoint)
      },
      workspaceDir: paths.workspaceDir,
    })
    const gemini = assertGeminiMeter(
      await transport.snapshot(),
      { answer: 1, reducers: 243 },
    )
    if (armResult.questionId !== population.instance.questionId ||
      armResult.interactions !== 243 ||
      armResult.rawTurns !== 484 ||
      armResult.exchangePlanSha256 !==
        population.stats.exchangePlanSha256 ||
      armResult.interactionCheckpoints.length !== 243 ||
      armResult.logicalOperations?.reducer !== 243 ||
      armResult.logicalOperations?.answer !== 1 ||
      armResult.answerProviderCalled !== true ||
      armResult.briefing?.mode !== 'incremental_digest' ||
      armResult.briefing?.complete !== true ||
      armResult.digestStatus?.ready !== true ||
      armResult.digestStatus?.pending !== 0 ||
      armResult.answer.length > 4_096) {
      throw new J4LiveError(
        'INCREMENTAL_ARM_RESULT',
        'Incremental arm result differs from the frozen one-question scope.',
      )
    }
    const durableArmResult = {
      ...armResult,
      interactionCheckpoints: undefined,
    }
    const answerText =
      `${JSON.stringify(durableArmResult, null, 2)}\n`
    await atomicWriteJ4(paths.answerResultPath, answerText)
    checkpoint.answer = {
      completedAt: isoNow(now),
      digestChars: armResult.interactionCheckpoints.at(-1).digestChars,
      digestItems: armResult.activeMemories.length,
      digestPending: armResult.digestStatus.pending,
      digestReady: armResult.digestStatus.ready,
      resultFile: relative(paths.runDir, paths.answerResultPath),
      resultSha256:
        liveConfig.incrementalLongMemEvalSha256(answerText),
      status: 'completed',
    }
    checkpoint.meter.gemini = gemini
    checkpoint.events.push({
      status: 'answer_completed',
      timestamp: checkpoint.answer.completedAt,
    })
    await writeCheckpoint(paths.checkpointPath, checkpoint)

    const judgeBody = buildIncrementalLongMemEvalJudgeBody(
      population.instance,
      armResult.answer,
    )
    const judgeReservation =
      reserveIncrementalLongMemEvalJudge(judgeBody)
    if (judgeReservation.judgeInputTokens >
        liveConfig.INCREMENTAL_LONGMEMEVAL_JUDGE_LIMITS
          .maxInputTokens ||
      judgeReservation.judgeOutputTokens !==
        liveConfig.INCREMENTAL_LONGMEMEVAL_JUDGE_LIMITS
          .maxOutputTokens) {
      throw new J4LiveError(
        'INCREMENTAL_JUDGE_RESERVATION',
        'Exact judge request exceeds its frozen envelope.',
      )
    }
    checkpoint.judge.status = 'in_progress'
    await writeCheckpoint(paths.checkpointPath, checkpoint)
    const judgeResponse = await judgeTransport.callJudge({
      body: judgeBody,
      cellId: population.instance.questionId,
      operationId:
        `question:${population.instance.questionId}:incremental:judge`,
    })
    if (judgeResponse.validated !== true) {
      throw new J4LiveError(
        'INCREMENTAL_JUDGE_RESULT',
        'Incremental judge result is not provider-validated.',
      )
    }
    checkpoint.meter.judge = judgeResponse.meter
    checkpoint.judge = {
      completedAt: isoNow(now),
      correct: parseLongMemEvalJudgeLabel(judgeResponse.text),
      modelVersion: judgeResponse.modelVersion,
      serviceTier: judgeResponse.serviceTier,
      status: 'completed',
    }
    checkpoint.question.completedAt = checkpoint.judge.completedAt
    checkpoint.question.status = 'completed'
    checkpoint.completedAt = checkpoint.judge.completedAt
    checkpoint.status = 'complete'
    checkpoint.events.push({
      status: 'judge_completed',
      timestamp: checkpoint.judge.completedAt,
    })
    checkpoint.spend = spendFromEvidence({
      gemini,
      judge: judgeResponse.meter,
      predecessor: predecessorAudit,
    })
    if (checkpoint.spend.freshAccountedUsd >
        liveConfig.INCREMENTAL_LONGMEMEVAL_COST_ENVELOPE
          .freshMaximumUsd + 1e-12 ||
      checkpoint.spend.cumulativeAccountedUsd >=
        liveConfig.INCREMENTAL_LONGMEMEVAL_CUMULATIVE_CAP_USD) {
      throw new J4LiveError(
        'INCREMENTAL_SPEND_ENVELOPE',
        'Measured run exceeded its conservative frozen envelope.',
      )
    }
    const result = {
      answer: armResult.answer,
      correct: checkpoint.judge.correct,
      judge: {
        finishReason: judgeResponse.finishReason,
        measured: judgeResponse.measured,
        modelVersion: judgeResponse.modelVersion,
        serviceTier: judgeResponse.serviceTier,
        text: judgeResponse.text,
      },
      memory: {
        activeMemories: armResult.activeMemories,
        activeMemoriesSha256: armResult.activeMemoriesSha256,
        briefing: armResult.briefing,
        canonicalRows: armResult.canonicalRows,
        digestStatus: armResult.digestStatus,
      },
      population: {
        interactions: armResult.interactions,
        questionId: armResult.questionId,
        rawTurns: armResult.rawTurns,
      },
      schemaVersion: 1,
    }
    const resultText = `${JSON.stringify(result, null, 2)}\n`
    await atomicWriteJ4(paths.questionResultPath, resultText)
    checkpoint.question.resultFile =
      relative(paths.runDir, paths.questionResultPath)
    checkpoint.question.resultSha256 =
      liveConfig.incrementalLongMemEvalSha256(resultText)
    const invocation = checkpoint.invocations.at(-1)
    invocation.completedAt = checkpoint.completedAt
    invocation.completedQuestions = 1
    invocation.question2Started = false
    const report = await writeTerminalBundle({
      checkpoint,
      forbiddenSecrets: secrets,
      judgeTransport,
      now,
      paths,
      transport,
    })
    log(
      `Incremental LongMemEval stopped after its one-question boundary; ` +
      `private report: ${paths.reportMarkdownPath}`,
    )
    return { checkpoint, report, result }
  } catch (error) {
    if (checkpoint) {
      checkpoint.status = 'failed'
      checkpoint.failedAt ??= isoNow(now)
      checkpoint.failure ??= sanitizedError(error, secrets)
      if (checkpoint.question.status === 'in_progress') {
        checkpoint.question.status = 'failed'
        checkpoint.question.completedAt = checkpoint.failedAt
      }
      if (checkpoint.answer.status === 'pending' &&
        checkpoint.interactions.length < 243) {
        checkpoint.answer.status = 'not_reached'
      }
      if (checkpoint.judge.status === 'pending' &&
        checkpoint.answer.status !== 'completed') {
        checkpoint.judge.status = 'not_reached'
      } else if (checkpoint.judge.status === 'in_progress') {
        checkpoint.judge.status = 'failed'
        checkpoint.judge.completedAt = checkpoint.failedAt
      }
      const invocation = checkpoint.invocations.at(-1)
      if (invocation) {
        invocation.completedAt ??= checkpoint.failedAt
        invocation.completedQuestions = 0
        invocation.question2Started = false
      }
      if (transport) {
        checkpoint.meter.gemini = await transport.snapshot()
          .catch(() => checkpoint.meter.gemini)
      }
      if (judgeTransport) {
        const judgeSnapshot = await judgeTransport.snapshot()
          .catch(() => null)
        if (judgeSnapshot?.attempts === 1) {
          checkpoint.meter.judge = await judgeTransport.verify()
            .then((verified) => verified.meter)
            .catch(() => checkpoint.meter.judge)
        }
      }
      checkpoint.spend = spendFromEvidence({
        gemini: checkpoint.meter.gemini,
        judge: checkpoint.meter.judge,
        predecessor: checkpoint.predecessorAudit,
      })
      await writeTerminalBundle({
        checkpoint,
        forbiddenSecrets: secrets,
        judgeTransport,
        now,
        paths,
        transport,
      }).catch(async (bundleError) => {
        checkpoint.failureBundle =
          sanitizedError(bundleError, secrets)
        await writeCheckpoint(paths.checkpointPath, checkpoint)
          .catch(() => {})
      })
    }
    throw error
  } finally {
    transport?.closeNetworkGuard()
    if (previousUmask !== undefined) process.umask(previousUmask)
    await lock.release()
  }
}

const invoked = process.argv[1] ? resolve(process.argv[1]) : ''
if (invoked === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(
      `${error?.code ?? 'INCREMENTAL_LONGMEMEVAL_FAILED'}: ` +
      `${error?.message ?? 'Incremental LongMemEval live run failed.'}`,
    )
    process.exitCode = 1
  })
}

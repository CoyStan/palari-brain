// Founder-gated one-shot runner for autonomous journal exploration on exactly
// LongMemEval-S ordinal 1. Importing this file is inert. A successful run does
// 243 canonical ingests with cadence-20 reduction, at most six model-chosen
// memory tool calls, one final answer, one official judge call, then stops.

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
  INCREMENTAL_LONGMEMEVAL_EXPLORATION_GENERATION,
  INCREMENTAL_LONGMEMEVAL_EXPLORATION_BATCH_INTERACTIONS,
  INCREMENTAL_LONGMEMEVAL_EXPLORATION_MAX_MODEL_DISPATCHES,
  INCREMENTAL_LONGMEMEVAL_EXPLORATION_MAX_REDUCER_DISPATCHES,
  INCREMENTAL_LONGMEMEVAL_EXPLORATION_MAX_TOOL_CALLS,
  INCREMENTAL_LONGMEMEVAL_EXPLORATION_REDUCE_EVERY,
  INCREMENTAL_LONGMEMEVAL_EXPLORATION_REDUCER_GENERATION,
  INCREMENTAL_LONGMEMEVAL_EXPLORATION_SYSTEM_INSTRUCTION,
  INCREMENTAL_LONGMEMEVAL_EXPLORATION_TOOL_CONFIG,
  INCREMENTAL_LONGMEMEVAL_EXPLORATION_TOOLS,
} from './arms/incremental-memory-exploration-longmemeval-live-arm.mjs'
import {
  incrementalLongMemEvalExchangeStats,
  runIncrementalLongMemEvalQuestionForScoring,
} from './arms/incremental-memory-longmemeval-live-arm.mjs'
import * as liveConfig from './exploration-longmemeval-live-config.mjs'
import {
  gradeExplorationLongMemEvalPredictionsFromEvidence,
} from './exploration-longmemeval-prediction-oracle.mjs'
import {
  createIncrementalLongMemEvalCheckpointJournal,
} from './incremental-longmemeval-checkpoint-journal.mjs'
import {
  buildIncrementalLongMemEvalJudgeBody,
} from './incremental-longmemeval-judge.mjs'
import {
  createIncrementalLongMemEvalJudgeTransport,
} from './incremental-longmemeval-judge-transport.mjs'
import {
  createIncrementalLongMemEvalGeminiTransport,
} from './incremental-longmemeval-runtime.mjs'
import {
  parseLongMemEvalJudgeLabel,
} from './longmemeval-judge.mjs'
import {
  prepareJ4PinnedS60,
  SEALED_U8_QUESTION_IDS,
} from './longmemeval-plan.mjs'
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
export const EXPLORATION_LONGMEMEVAL_REPO_ROOT = dirname(here)
export const EXPLORATION_LONGMEMEVAL_RESULTS_ROOT = 'evals/results'

// Preparation state: the post-run seal adds this run ID. Keeping this empty
// is what permits one clean invocation after the separate cap confirmation.
export const EXPLORATION_LONGMEMEVAL_TERMINAL_RUN_IDS =
  Object.freeze([])
const terminalRunIds = new Set(
  EXPLORATION_LONGMEMEVAL_TERMINAL_RUN_IDS,
)

const PREDECESSOR = Object.freeze({
  authority: Object.freeze({
    path:
      'evals/live-runs/j4-active-brain-incremental-longmemeval-q1-v1.authority.json',
    sha256:
      'fd1ea14932633b3716668a6f16e400b2ed412277bd6f2acc58a1d05fe4467967',
  }),
  checkpoint: Object.freeze({
    path:
      'evals/results/j4-active-brain-incremental-longmemeval-q1-v1/checkpoint.json',
    sha256:
      '84b272bcb231292a8d540abf0526e5d2a43094c05e3d7230f8eb59efe3bdbd40',
  }),
  config: Object.freeze({
    path:
      'evals/live-runs/j4-active-brain-incremental-longmemeval-q1-v1.json',
    sha256:
      '16fab020b245e96a34a472606faa1b7414006ee41cf7bf2d3f5ed24db81aac5e',
  }),
  manifest: Object.freeze({
    path:
      'evals/results/j4-active-brain-incremental-longmemeval-q1-v1/artifact-manifest.json',
    sha256:
      '1897dd1c0d643478793f7b201c1fb748e424403bb8dd738b66cdee08f9c8d499',
  }),
  predictions: Object.freeze({
    path:
      'evals/predictions/j4-active-brain-incremental-longmemeval-q1-v1.json',
    sha256:
      '6bf388c9898cd1198af75252f7b46f9c7554c19532d92f15bb093cd1361a72b0',
  }),
  runId: 'j4-active-brain-incremental-longmemeval-q1-v1',
  runner: Object.freeze({
    path: 'evals/run-incremental-longmemeval-live.mjs',
    sha256:
      '3c444aaa9341feeeacac146d07026d7aec4034b3980a2e7f3d9b6861e88df0c3',
  }),
  status: 'failed',
})

export class ExplorationLongMemEvalLiveError extends Error {
  constructor(code, message, { cause } = {}) {
    super(message, cause ? { cause } : undefined)
    this.name = 'ExplorationLongMemEvalLiveError'
    this.code = code
  }
}

function sameUsd(left, right) {
  return Number.isFinite(Number(left)) &&
    Number.isFinite(Number(right)) &&
    Math.abs(Number(left) - Number(right)) <= 1e-12
}

function isoNow(now = () => new Date().toISOString()) {
  const value = String(now())
  if (!value || Number.isNaN(Date.parse(value))) {
    throw new ExplorationLongMemEvalLiveError(
      'CLOCK_INVALID',
      'Exploration clock must return an ISO timestamp.',
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
  return liveConfig.explorationLongMemEvalSha256(
    await readFile(path),
  )
}

function sanitizedError(error, secrets = []) {
  let message = String(
    error?.message ?? 'Exploration LongMemEval live run failed.',
  )
  for (const secret of secrets) {
    if (secret) {
      message = message.replaceAll(secret, '[REDACTED_SECRET]')
    }
  }
  return {
    code: String(
      error?.code ?? error?.name ?? 'EXPLORATION_LIVE_FAILURE',
    ).slice(0, 100),
    message: message.slice(0, 400),
  }
}

export function parseExplorationLongMemEvalArgs(args = []) {
  if (args.length !== 2 ||
    args[0] !== '--run' ||
    args[1] !== liveConfig.EXPLORATION_LONGMEMEVAL_RUN_ID) {
    throw new ExplorationLongMemEvalLiveError(
      'RUN_ID_REQUIRED',
      'Invoke the exploration runner with its exact frozen run ID.',
    )
  }
  return args[1]
}

export function assertExplorationLongMemEvalOpen(runId) {
  if (terminalRunIds.has(runId)) {
    throw new ExplorationLongMemEvalLiveError(
      'J4_RUN_TERMINAL',
      `J4 run ${runId} is terminal and cannot be resumed or rerolled.`,
    )
  }
  if (runId !== liveConfig.EXPLORATION_LONGMEMEVAL_RUN_ID) {
    throw new ExplorationLongMemEvalLiveError(
      'RUN_ID_REQUIRED',
      'No matching exploration identity is configured.',
    )
  }
  return runId
}

function assertDispatchAuthority(authority) {
  if (authority?.runId !==
      liveConfig.EXPLORATION_LONGMEMEVAL_RUN_ID ||
    authority?.dispatchAuthorized !== true ||
    authority?.exactCapConfirmationRequired !== false) {
    throw new ExplorationLongMemEvalLiveError(
      'FOUNDER_CAP_CONFIRMATION_REQUIRED',
      'The exact fresh hard cap must be confirmed before any credential is inspected.',
    )
  }
}

export function explorationLongMemEvalResultPaths(
  repoRoot = EXPLORATION_LONGMEMEVAL_REPO_ROOT,
) {
  const resultsRoot = resolve(
    repoRoot,
    EXPLORATION_LONGMEMEVAL_RESULTS_ROOT,
  )
  const runDir = join(
    resultsRoot,
    liveConfig.EXPLORATION_LONGMEMEVAL_RUN_ID,
  )
  const checkpointDirectory =
    join(runDir, 'interaction-checkpoints')
  const transcriptsDir = join(runDir, 'transcripts')
  return {
    artifactManifestPath:
      join(runDir, 'artifact-manifest.json'),
    checkpointAggregatePath:
      join(checkpointDirectory, 'checkpoint.json'),
    checkpointDirectory,
    explorationCheckpointPath:
      join(runDir, 'exploration-checkpoint.json'),
    geminiJournalPath: join(runDir, 'gemini-meter.jsonl'),
    geminiTranscriptsDir: join(transcriptsDir, 'gemini'),
    instancePath: join(runDir, 'instance.json'),
    judgeMeterPath: join(runDir, 'judge-meter.json'),
    judgeTranscriptsDir: join(transcriptsDir, 'openai'),
    lockPath: join(
      resultsRoot,
      `${liveConfig.EXPLORATION_LONGMEMEVAL_RUN_ID}.lock`,
    ),
    questionResultPath: join(runDir, 'question-result.json'),
    reportJsonPath: join(runDir, 'report.json'),
    reportMarkdownPath: join(runDir, 'report.md'),
    resultsRoot,
    runDir,
    runStatePath: join(runDir, 'run-state.json'),
    transcriptsDir,
    workspaceDir: join(runDir, 'workspace'),
  }
}

export async function auditExplorationLongMemEvalTrackedArtifacts({
  config,
  repoRoot,
} = {}) {
  const root = resolve(repoRoot)
  const seen = new Set()
  if (!Array.isArray(config?.artifacts)) {
    throw new ExplorationLongMemEvalLiveError(
      'ARTIFACT_HASHES_PENDING',
      'Exploration runtime artifacts are not frozen.',
    )
  }
  for (const artifact of config.artifacts) {
    const path = resolve(root, artifact.path)
    const repositoryPath = relative(root, path)
    if (!repositoryPath ||
      repositoryPath.startsWith('..') ||
      path !== resolve(root, repositoryPath) ||
      seen.has(repositoryPath)) {
      throw new ExplorationLongMemEvalLiveError(
        'ARTIFACT_PATH_INVALID',
        'Runtime artifact paths must be unique and repository-relative.',
      )
    }
    seen.add(repositoryPath)
    const metadata = await lstat(path)
    if (!metadata.isFile() ||
      metadata.isSymbolicLink() ||
      await sha256File(path) !== artifact.sha256) {
      throw new ExplorationLongMemEvalLiveError(
        'ARTIFACT_CHANGED',
        `Exploration artifact changed: ${repositoryPath}.`,
      )
    }
  }
  const required = [
    'evals/arms/incremental-memory-exploration-longmemeval-live-arm.mjs',
    'evals/exploration-longmemeval-live-config.mjs',
    'evals/exploration-longmemeval-prediction-oracle.mjs',
    'evals/incremental-longmemeval-checkpoint-journal.mjs',
    'evals/incremental-longmemeval-hard-cap-gemini.mjs',
    'evals/incremental-longmemeval-judge-transport.mjs',
    'evals/incremental-longmemeval-runtime.mjs',
    'evals/run-exploration-longmemeval-live.mjs',
    'src/brain.mjs',
    'src/memory-exploration.mjs',
  ]
  if (required.some((path) => !seen.has(path))) {
    throw new ExplorationLongMemEvalLiveError(
      'ARTIFACT_SET_INCOMPLETE',
      'The exploration runtime import closure is not fully pinned.',
    )
  }
  return {
    artifactSetSha256:
      liveConfig.explorationLongMemEvalSha256(
        JSON.stringify(config.artifacts),
      ),
    artifacts: seen.size,
  }
}

export async function verifyExplorationLongMemEvalPredecessor({
  repoRoot = EXPLORATION_LONGMEMEVAL_REPO_ROOT,
} = {}) {
  for (const entry of [
    PREDECESSOR.authority,
    PREDECESSOR.checkpoint,
    PREDECESSOR.config,
    PREDECESSOR.manifest,
    PREDECESSOR.predictions,
    PREDECESSOR.runner,
  ]) {
    if (await sha256File(resolve(repoRoot, entry.path)) !==
      entry.sha256) {
      throw new ExplorationLongMemEvalLiveError(
        'PREDECESSOR_CHANGED',
        `Sealed predecessor changed: ${entry.path}.`,
      )
    }
  }
  await verifyJ4ArtifactManifest(resolve(
    repoRoot,
    `evals/results/${PREDECESSOR.runId}`,
  ))
  const checkpoint = JSON.parse(await readFile(
    resolve(repoRoot, PREDECESSOR.checkpoint.path),
    'utf8',
  ))
  if (checkpoint.status !== PREDECESSOR.status ||
    checkpoint.identity?.runId !== PREDECESSOR.runId ||
    checkpoint.interactions?.length !== 0 ||
    checkpoint.meter?.gemini !== null ||
    checkpoint.meter?.judge !== null ||
    !sameUsd(checkpoint.spend?.freshAccountedUsd, 0) ||
    checkpoint.invocations?.[0]?.question2Started !== false) {
    throw new ExplorationLongMemEvalLiveError(
      'PREDECESSOR_STATE_CHANGED',
      'Sealed zero-dispatch predecessor state changed.',
    )
  }
  return {
    ...liveConfig.EXPLORATION_LONGMEMEVAL_OPENING_SPEND,
    checkpointSha256: PREDECESSOR.checkpoint.sha256,
    manifestSha256: PREDECESSOR.manifest.sha256,
    runId: PREDECESSOR.runId,
  }
}

export function explorationLongMemEvalPopulation(prepared = {}) {
  const instance = prepared?.executionOrder?.[0]
  const normalized = `${JSON.stringify(instance, null, 2)}\n`
  const stats = incrementalLongMemEvalExchangeStats(instance)
  if (prepared?.manifest?.datasetSha256 !==
      liveConfig.EXPLORATION_LONGMEMEVAL_DATASET.sha256 ||
    instance?.questionId !==
      liveConfig.EXPLORATION_LONGMEMEVAL_QUESTION_ID ||
    SEALED_U8_QUESTION_IDS.includes(instance?.questionId) ||
    instance?.sessions?.length !==
      liveConfig.EXPLORATION_LONGMEMEVAL_POPULATION.sessions ||
    Buffer.byteLength(normalized) !==
      liveConfig.EXPLORATION_LONGMEMEVAL_INSTANCE.normalizedBytes ||
    liveConfig.explorationLongMemEvalSha256(normalized) !==
      liveConfig.EXPLORATION_LONGMEMEVAL_INSTANCE
        .normalizedSha256 ||
    stats.exchangePlanSha256 !==
      liveConfig.EXPLORATION_LONGMEMEVAL_POPULATION
        .exchangePlanSha256 ||
    stats.interactions !==
      liveConfig.EXPLORATION_LONGMEMEVAL_POPULATION.interactions ||
    stats.rawTurns !==
      liveConfig.EXPLORATION_LONGMEMEVAL_POPULATION.visibleMessages ||
    stats.visibleChars !==
      liveConfig.EXPLORATION_LONGMEMEVAL_POPULATION
        .visibleCharacters ||
    stats.visibleMessages !==
      liveConfig.EXPLORATION_LONGMEMEVAL_POPULATION.visibleMessages) {
    throw new ExplorationLongMemEvalLiveError(
      'POPULATION_CHANGED',
      'The exact one-question exploration population changed.',
    )
  }
  return { instance, normalized, stats }
}

function initialRunState({
  artifactAudit,
  loaded,
  predecessor,
  population,
  startedAt,
}) {
  return {
    answer: {
      status: 'pending',
    },
    completedAt: null,
    exploration: {
      checkpointFile: null,
      checkpointSha256: null,
      modelDispatches: 0,
      status: 'pending',
      toolCalls: 0,
    },
    failure: null,
    identity: {
      artifactSetSha256: artifactAudit.artifactSetSha256,
      authoritySha256: loaded.authoritySha256,
      configSha256: loaded.configSha256,
      datasetSha256:
        liveConfig.EXPLORATION_LONGMEMEVAL_DATASET.sha256,
      models: { ...loaded.config.models },
      openingAccountedUsd:
        liveConfig.EXPLORATION_LONGMEMEVAL_OPENING_SPEND
          .accountedUsd,
      predictionsSha256: loaded.predictionsSha256,
      productCommit: loaded.config.productCommit,
      questionId:
        liveConfig.EXPLORATION_LONGMEMEVAL_QUESTION_ID,
      runDate: loaded.config.runDate,
      runId: loaded.config.runId,
      schemaVersion: 1,
    },
    ingestion: {
      interactionsCompleted: 0,
      reducerDispatches: 0,
      status: 'pending',
    },
    invocations: [{
      completedQuestions: 0,
      cumulativeCapUsd:
        liveConfig.EXPLORATION_LONGMEMEVAL_HARD_CAP
          .cumulativeCapUsd,
      freshSubcapUsd:
        liveConfig.EXPLORATION_LONGMEMEVAL_HARD_CAP
          .freshSubcapUsd,
      judgeOperations: 1,
      maximumExplorationModelDispatches:
        liveConfig.EXPLORATION_LONGMEMEVAL_SCOPE
          .maximumExplorationModelDispatches,
      maximumExplorationToolCalls:
        liveConfig.EXPLORATION_LONGMEMEVAL_SCOPE
          .maximumExplorationToolCalls,
      maximumReducerDispatches:
        liveConfig.EXPLORATION_LONGMEMEVAL_SCOPE
          .maximumReducerDispatches,
      question2Started: false,
      questionIds: [
        liveConfig.EXPLORATION_LONGMEMEVAL_QUESTION_ID,
      ],
      reduceEvery:
        liveConfig.EXPLORATION_LONGMEMEVAL_SCOPE.reduceEvery,
      startedAt,
    }],
    judge: {
      correct: null,
      status: 'pending',
    },
    meter: {
      gemini: null,
      judge: null,
    },
    population: {
      ...liveConfig.EXPLORATION_LONGMEMEVAL_POPULATION,
      normalizedInstanceSha256:
        liveConfig.EXPLORATION_LONGMEMEVAL_INSTANCE
          .normalizedSha256,
    },
    predecessor,
    predictions:
      loaded.predictions.predictions.map((entry) => ({
        ...entry,
      })),
    question: {
      questionId: population.instance.questionId,
      question2Started: false,
      resultFile: null,
      resultSha256: null,
      status: 'pending',
    },
    schemaVersion: 1,
    spend: null,
    startedAt,
    status: 'ready',
  }
}

async function writeJson(path, value) {
  const text = `${JSON.stringify(value, null, 2)}\n`
  await atomicWriteJ4(path, text)
  return liveConfig.explorationLongMemEvalSha256(text)
}

function freshGeminiAccounted(snapshot) {
  const value = Number((
    Number(snapshot?.accounted?.usd ?? 0) -
      liveConfig.EXPLORATION_LONGMEMEVAL_OPENING_SPEND
        .accountedUsd
  ).toFixed(12))
  if (!Number.isFinite(value) || value < -1e-12) {
    throw new ExplorationLongMemEvalLiveError(
      'GEMINI_SPEND_INVALID',
      'Gemini accounted spend is below the frozen opening balance.',
    )
  }
  return Math.max(0, value)
}

function assertSuccessfulGeminiPrefix(snapshot, armResult) {
  const writers = armResult?.logicalOperations?.reducer
  const explores = armResult?.logicalOperations?.answerModel
  const attempts = writers + explores
  if (!Number.isSafeInteger(writers) ||
    writers < 1 ||
    writers >
      liveConfig.EXPLORATION_LONGMEMEVAL_SCOPE
        .maximumReducerDispatches ||
    !Number.isSafeInteger(explores) ||
    explores < 1 ||
    explores >
      liveConfig.EXPLORATION_LONGMEMEVAL_SCOPE
        .maximumExplorationModelDispatches ||
    snapshot?.logicalRequests?.writer !== writers ||
    snapshot?.logicalRequests?.explore !== explores ||
    snapshot?.attempts !== attempts ||
    snapshot?.sequence !== attempts * 2 ||
    snapshot?.terminal !== null ||
    freshGeminiAccounted(snapshot) >
      liveConfig.EXPLORATION_LONGMEMEVAL_HARD_CAP
        .freshSubcapUsd + 1e-12) {
    throw new ExplorationLongMemEvalLiveError(
      'GEMINI_PREFIX_INVALID',
      'Gemini meter differs from the exact no-retry reducer/exploration prefix.',
    )
  }
  return snapshot
}

function spendFromEvidence({ gemini, judge }) {
  const freshGemini = gemini
    ? freshGeminiAccounted(gemini)
    : 0
  const judgeAccounted = Number(judge?.accountedUsd ?? 0)
  const freshAccountedUsd = Number((
    freshGemini + judgeAccounted
  ).toFixed(12))
  const freshMeasuredUsd = Number((
    Number(gemini?.measured?.usd ?? 0) +
      Number(judge?.measured?.usd ?? 0)
  ).toFixed(12))
  const freshUncertainUsd = Number((
    Number(gemini?.uncertain?.usd ?? 0) +
      Number(judge?.uncertain?.usd ?? 0)
  ).toFixed(12))
  const opening =
    liveConfig.EXPLORATION_LONGMEMEVAL_OPENING_SPEND
  return {
    cumulativeAccountedUsd: Number((
      opening.accountedUsd + freshAccountedUsd
    ).toFixed(12)),
    cumulativeMeasuredUsd: Number((
      opening.measuredUsd + freshMeasuredUsd
    ).toFixed(12)),
    cumulativeUncertainUsd: Number((
      opening.uncertainUsd + freshUncertainUsd
    ).toFixed(12)),
    freshAccountedUsd,
    freshMeasuredUsd,
    freshUncertainUsd,
    openingAccountedUsd: opening.accountedUsd,
  }
}

function buildPrivateReport({ grade, runState }) {
  return {
    disclaimer:
      'Private one-question evidence. Do not commit or publish answers, scores, transcripts, tool results, or benchmark content.',
    grades: grade.grades,
    observations: grade.observations,
    runId: runState.identity.runId,
    schemaVersion: 1,
    spend: runState.spend,
    status: runState.status,
    summary: grade.computed,
  }
}

function renderPrivateReport(report) {
  return [
    '# Autonomous exploration private live report',
    '',
    `> ${report.disclaimer}`,
    '',
    `- Status: ${report.status}`,
    `- Fresh accounted spend: $${Number(
      report.spend?.freshAccountedUsd ?? 0,
    ).toFixed(7)}`,
    `- Cumulative accounted spend: $${Number(
      report.spend?.cumulativeAccountedUsd ??
        liveConfig.EXPLORATION_LONGMEMEVAL_OPENING_SPEND
          .accountedUsd,
    ).toFixed(7)}`,
    `- Reducer dispatches: ${
      report.summary.reducerDispatches ?? 0}`,
    `- Exploration model dispatches: ${
      report.summary.explorationModelDispatches ?? 0}`,
    `- Exploration tool calls: ${
      report.summary.explorationToolCalls ?? 0}`,
    `- Judge completed: ${report.summary.judgeCompleted}`,
    '',
    '## Prediction grade (misses first)',
    '',
    ...report.grades.map((grade) =>
      `- ${grade.outcome.toUpperCase()} ${grade.id}: ${grade.statement}`),
    '',
  ].join('\n')
}

async function snapshotJudge(judgeTransport) {
  if (!judgeTransport) {
    return {
      accountedUsd: 0,
      attempts: 0,
      measured: null,
      operationId: null,
      state: 'not_dispatched',
      uncertain: null,
    }
  }
  return judgeTransport.snapshot()
}

async function writeTerminalBundle({
  armResult,
  checkpointJournal,
  explorationCheckpoint,
  forbiddenSecrets,
  judgeTransport,
  now,
  paths,
  runState,
  transport,
}) {
  let geminiSnapshot = runState.meter.gemini
  if (transport) {
    const verified = await transport.verify()
    geminiSnapshot = verified.meter
    runState.geminiTranscriptAudit = verified.transcripts
  }
  const judgeSnapshot = await snapshotJudge(judgeTransport)
  if (judgeTransport && judgeSnapshot.attempts === 1) {
    const verified = await judgeTransport.verify()
    runState.judgeTranscriptAudit = verified.transcript
    runState.meter.judge = verified.meter
  }
  runState.meter.gemini = geminiSnapshot
  runState.spend = spendFromEvidence({
    gemini: geminiSnapshot,
    judge: runState.meter.judge?.terminal ?? judgeSnapshot,
  })
  const aggregate = checkpointJournal
    ? checkpointJournal.snapshot()
    : {
        checkpoints: [],
        completedInteraction: 0,
        lastReceiptSha256: null,
        questionId:
          liveConfig.EXPLORATION_LONGMEMEVAL_QUESTION_ID,
        receiptManifest: [],
        runId: liveConfig.EXPLORATION_LONGMEMEVAL_RUN_ID,
        schemaVersion:
          'palari-incremental-checkpoint-aggregate/v1',
      }
  const grade =
    gradeExplorationLongMemEvalPredictionsFromEvidence({
      evidence: {
        checkpointAggregate: aggregate,
        explorationCheckpoint,
        geminiSnapshot,
        judgeSnapshot,
        result: armResult,
        runState,
      },
      predictions: runState.predictions,
    })
  runState.grades = grade.grades
  const report = buildPrivateReport({ grade, runState })
  await writeJson(paths.runStatePath, runState)
  await writeJson(paths.reportJsonPath, report)
  await atomicWriteJ4(
    paths.reportMarkdownPath,
    renderPrivateReport(report),
  )
  const artifacts = await collectJ4PrivateArtifacts(paths.runDir, {
    forbiddenSecrets,
  })
  await writeJson(paths.artifactManifestPath, {
    artifacts,
    generatedAt: isoNow(now),
    runId: runState.identity.runId,
    schemaVersion: 1,
  })
  await verifyJ4ArtifactManifest(paths.runDir)
  return { grade, report }
}

export async function main({
  args = process.argv.slice(2),
  dependencies = {},
  env = process.env,
  repoRoot = EXPLORATION_LONGMEMEVAL_REPO_ROOT,
} = {}) {
  const runId = parseExplorationLongMemEvalArgs(args)

  // Sealing denial is deliberately before dependencies, files, credentials,
  // result paths, dataset access, or network.
  assertExplorationLongMemEvalOpen(runId)

  const loadContract = dependencies.loadContract ??
    liveConfig.loadExplorationLongMemEvalContract
  const loaded = await loadContract({ repoRoot })

  // This separate authority check is deliberately before any environment
  // field is read. The tracked preparation authority stops here.
  assertDispatchAuthority(loaded.authority)

  const auditArtifacts = dependencies.auditArtifacts ??
    auditExplorationLongMemEvalTrackedArtifacts
  const inspectGit = dependencies.inspectGitCutPoint ??
    inspectJ4GitCutPoint
  const verifyPredecessor = dependencies.verifyPredecessor ??
    verifyExplorationLongMemEvalPredecessor
  const preparePopulation = dependencies.preparePopulation ??
    prepareJ4PinnedS60
  const selectPopulation = dependencies.selectPopulation ??
    explorationLongMemEvalPopulation
  const assertEnvironment = dependencies.assertEnvironment ??
    liveConfig.assertExplorationLongMemEvalEnvironment
  const auditTracked = dependencies.auditTrackedFiles ??
    auditJ4TrackedFiles
  const createGemini = dependencies.createGeminiTransport ??
    createIncrementalLongMemEvalGeminiTransport
  const createJudge = dependencies.createJudgeTransport ??
    createIncrementalLongMemEvalJudgeTransport
  const createCheckpointJournal =
    dependencies.createCheckpointJournal ??
      createIncrementalLongMemEvalCheckpointJournal
  const runQuestion = dependencies.runQuestion ??
    runIncrementalLongMemEvalQuestionForScoring
  const read = dependencies.readFile ?? readFile
  const pathExists = dependencies.exists ?? exists
  const capturedFetch = dependencies.fetchImpl ?? globalThis.fetch
  const now = dependencies.now ?? (() => new Date().toISOString())
  const log = dependencies.log ?? console.log
  const paths = explorationLongMemEvalResultPaths(repoRoot)

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
  const git = await inspectGit({
    artifactPaths,
    authorityPath: repositoryPath(loaded.authorityPath),
    env,
    repoRoot,
    runDir: paths.runDir,
  })
  const lock = await acquireJ4RunLock(paths.lockPath)
  let armResult = null
  let checkpointJournal
  let explorationCheckpoint = null
  let judgeTransport
  let previousUmask
  let runState
  let secrets = []
  let transport
  try {
    if (await pathExists(paths.runDir)) {
      throw new ExplorationLongMemEvalLiveError(
        'RUN_ALREADY_EXISTS',
        'Exploration run refuses to resume, replace, or overlay.',
      )
    }
    const predecessor = await verifyPredecessor({ repoRoot })
    if (!sameUsd(
      predecessor.accountedUsd,
      liveConfig.EXPLORATION_LONGMEMEVAL_OPENING_SPEND
        .accountedUsd,
    )) {
      throw new ExplorationLongMemEvalLiveError(
        'OPENING_SPEND_CHANGED',
        'The sealed predecessor no longer reconciles to opening spend.',
      )
    }
    const raw = await read(resolve(
      repoRoot,
      loaded.config.dataset.path,
    ))
    const population = selectPopulation(
      await preparePopulation({ raw }),
    )

    // Credentials are inspected only after tracked artifacts, Git cut,
    // predecessor evidence, dataset, and exact population all verify.
    const runtime = assertEnvironment(
      env,
      loaded.config,
      loaded.authority,
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
      paths.checkpointDirectory,
      paths.geminiTranscriptsDir,
      paths.judgeTranscriptsDir,
      paths.workspaceDir,
    ]) {
      await mkdir(directory, { recursive: true, mode: 0o700 })
      await chmod(directory, 0o700)
    }
    await atomicWriteJ4(paths.instancePath, population.normalized)

    const startedAt = isoNow(now)
    runState = initialRunState({
      artifactAudit,
      loaded,
      population,
      predecessor,
      startedAt,
    })
    runState.git = {
      administrativeHead: git.administrativeHead,
      trackedSecretAudit,
    }
    runState.question.status = 'running'
    runState.ingestion.status = 'running'
    runState.status = 'running'
    await writeJson(paths.runStatePath, runState)

    checkpointJournal = await createCheckpointJournal({
      directory: paths.checkpointDirectory,
      questionId: population.instance.questionId,
      runId,
    })
    transport = await createGemini({
      cumulativeCapUsd:
        liveConfig.EXPLORATION_LONGMEMEVAL_HARD_CAP
          .cumulativeCapUsd,
      explorationGeneration:
        INCREMENTAL_LONGMEMEVAL_EXPLORATION_GENERATION,
      explorationSystemInstruction:
        INCREMENTAL_LONGMEMEVAL_EXPLORATION_SYSTEM_INSTRUCTION,
      explorationToolConfig:
        INCREMENTAL_LONGMEMEVAL_EXPLORATION_TOOL_CONFIG,
      explorationTools:
        INCREMENTAL_LONGMEMEVAL_EXPLORATION_TOOLS,
      fetchImpl: capturedFetch,
      freshSubcapUsd:
        liveConfig.EXPLORATION_LONGMEMEVAL_HARD_CAP
          .freshSubcapUsd,
      geminiApiKey: runtime.geminiApiKey,
      journalPath: paths.geminiJournalPath,
      openingAccountedUsd:
        liveConfig.EXPLORATION_LONGMEMEVAL_OPENING_SPEND
          .accountedUsd,
      transcriptDirectory: paths.geminiTranscriptsDir,
      writerGeneration:
        INCREMENTAL_LONGMEMEVAL_EXPLORATION_REDUCER_GENERATION,
    })
    judgeTransport = await createJudge({
      cumulativeCapUsd:
        liveConfig.EXPLORATION_LONGMEMEVAL_HARD_CAP
          .cumulativeCapUsd,
      fetchImpl: capturedFetch,
      freshSubcapUsd:
        liveConfig.EXPLORATION_LONGMEMEVAL_HARD_CAP
          .freshSubcapUsd,
      getFreshAccountedUsd: async () =>
        freshGeminiAccounted(await transport.snapshot()),
      meterPath: paths.judgeMeterPath,
      openaiApiKey: runtime.openaiApiKey,
      openingAccountedUsd:
        liveConfig.EXPLORATION_LONGMEMEVAL_OPENING_SPEND
          .accountedUsd,
      transcriptDirectory: paths.judgeTranscriptsDir,
    })
    transport.installNetworkGuard()

    armResult = await runQuestion({
      callGemini: transport.callGemini,
      instance: population.instance,
      maxAnswerModelDispatches:
        INCREMENTAL_LONGMEMEVAL_EXPLORATION_MAX_MODEL_DISPATCHES,
      maxExplorationCalls:
        INCREMENTAL_LONGMEMEVAL_EXPLORATION_MAX_TOOL_CALLS,
      maxInteractionsPerCall:
        INCREMENTAL_LONGMEMEVAL_EXPLORATION_BATCH_INTERACTIONS,
      maxReducerDispatches:
        INCREMENTAL_LONGMEMEVAL_EXPLORATION_MAX_REDUCER_DISPATCHES,
      mode: 'exploration',
      onCheckpoint: async (checkpoint) => {
        await checkpointJournal.onCheckpoint(checkpoint)
        runState.ingestion.interactionsCompleted =
          checkpoint.completedInteraction
        runState.ingestion.reducerDispatches =
          checkpoint.reducerDispatches
        runState.ingestion.status =
          checkpoint.completedInteraction ===
            liveConfig.EXPLORATION_LONGMEMEVAL_POPULATION
              .interactions
            ? 'complete'
            : 'running'
        runState.meter.gemini = await transport.snapshot()
        await writeJson(paths.runStatePath, runState)
      },
      onExplorationCheckpoint: async (checkpoint) => {
        explorationCheckpoint = checkpoint
        const hash = await writeJson(
          paths.explorationCheckpointPath,
          checkpoint,
        )
        runState.exploration = {
          checkpointFile: relative(
            paths.runDir,
            paths.explorationCheckpointPath,
          ),
          checkpointSha256: hash,
          modelDispatches: checkpoint.answerModelDispatches,
          status: checkpoint.explorationExhausted
            ? 'exhausted'
            : 'running',
          toolCalls: checkpoint.explorationCalls,
        }
        runState.meter.gemini = await transport.snapshot()
        await writeJson(paths.runStatePath, runState)
      },
      reduceEvery:
        INCREMENTAL_LONGMEMEVAL_EXPLORATION_REDUCE_EVERY,
      workspaceDir: paths.workspaceDir,
    })
    const geminiSnapshot = assertSuccessfulGeminiPrefix(
      await transport.snapshot(),
      armResult,
    )
    if (armResult.questionId !==
        liveConfig.EXPLORATION_LONGMEMEVAL_QUESTION_ID ||
      armResult.interactions !==
        liveConfig.EXPLORATION_LONGMEMEVAL_POPULATION
          .interactions ||
      armResult.rawTurns !==
        liveConfig.EXPLORATION_LONGMEMEVAL_POPULATION
          .visibleMessages ||
      armResult.exchangePlanSha256 !==
        liveConfig.EXPLORATION_LONGMEMEVAL_POPULATION
          .exchangePlanSha256 ||
      armResult.logicalOperations?.reducer >
        liveConfig.EXPLORATION_LONGMEMEVAL_SCOPE
          .maximumReducerDispatches ||
      armResult.logicalOperations?.answerModel >
        liveConfig.EXPLORATION_LONGMEMEVAL_SCOPE
          .maximumExplorationModelDispatches ||
      armResult.explorationCalls >
        liveConfig.EXPLORATION_LONGMEMEVAL_SCOPE
          .maximumExplorationToolCalls ||
      armResult.answerProviderCalled !== true ||
      !armResult.answer?.trim() ||
      armResult.answer.length > 4_096) {
      throw new ExplorationLongMemEvalLiveError(
        'ARM_RESULT_INVALID',
        'Exploration arm result differs from its one-question contract.',
      )
    }
    const durableArmResult = {
      ...armResult,
      interactionCheckpoints: undefined,
    }
    const questionResult = {
      arm: durableArmResult,
      judge: null,
      schemaVersion: 1,
    }
    const answerResultSha256 = await writeJson(
      paths.questionResultPath,
      questionResult,
    )
    runState.answer = {
      consultedEvidenceIds:
        [...armResult.consultedEvidenceIds],
      status: 'complete',
    }
    runState.exploration.status = 'complete'
    runState.meter.gemini = geminiSnapshot
    runState.question.resultFile = relative(
      paths.runDir,
      paths.questionResultPath,
    )
    runState.question.resultSha256 = answerResultSha256
    runState.question.status = 'answer_complete'
    await writeJson(paths.runStatePath, runState)

    runState.judge.status = 'running'
    await writeJson(paths.runStatePath, runState)
    const judgeResponse = await judgeTransport.callJudge({
      body: buildIncrementalLongMemEvalJudgeBody(
        population.instance,
        armResult.answer,
      ),
      cellId: population.instance.questionId,
      operationId:
        `question:${population.instance.questionId}:exploration:judge`,
    })
    if (judgeResponse.validated !== true) {
      throw new ExplorationLongMemEvalLiveError(
        'JUDGE_RESULT_INVALID',
        'Official judge result was not provider-validated.',
      )
    }
    const correct =
      parseLongMemEvalJudgeLabel(judgeResponse.text)
    questionResult.judge = {
      correct,
      finishReason: judgeResponse.finishReason,
      measured: judgeResponse.measured,
      modelVersion: judgeResponse.modelVersion,
      operationId:
        `question:${population.instance.questionId}:exploration:judge`,
      serviceTier: judgeResponse.serviceTier,
      text: judgeResponse.text,
    }
    const resultSha256 = await writeJson(
      paths.questionResultPath,
      questionResult,
    )
    const completedAt = isoNow(now)
    runState.judge = {
      correct,
      modelVersion: judgeResponse.modelVersion,
      status: 'complete',
    }
    runState.question = {
      completedAt,
      question2Started: false,
      questionId: population.instance.questionId,
      resultFile: relative(
        paths.runDir,
        paths.questionResultPath,
      ),
      resultSha256,
      status: 'complete',
    }
    runState.invocations[0].completedAt = completedAt
    runState.invocations[0].completedQuestions = 1
    runState.completedAt = completedAt
    runState.status = 'complete'
    runState.meter.gemini = geminiSnapshot
    runState.meter.judge = judgeResponse.meter
    runState.spend = spendFromEvidence({
      gemini: geminiSnapshot,
      judge: judgeResponse.meter.terminal,
    })
    if (runState.spend.freshAccountedUsd >
        liveConfig.EXPLORATION_LONGMEMEVAL_HARD_CAP
          .freshSubcapUsd + 1e-12 ||
      runState.spend.cumulativeAccountedUsd >
        liveConfig.EXPLORATION_LONGMEMEVAL_HARD_CAP
          .cumulativeCapUsd + 1e-12) {
      throw new ExplorationLongMemEvalLiveError(
        'SPEND_CAP_EXCEEDED',
        'Reconciled exploration spend exceeds a frozen cap.',
      )
    }
    const terminal = await writeTerminalBundle({
      armResult: durableArmResult,
      checkpointJournal,
      explorationCheckpoint,
      forbiddenSecrets: secrets,
      judgeTransport,
      now,
      paths,
      runState,
      transport,
    })
    log(
      'Autonomous exploration stopped after LongMemEval-S ordinal 1; ' +
      `private report: ${paths.reportMarkdownPath}`,
    )
    return {
      grade: terminal.grade,
      report: terminal.report,
      result: questionResult,
      runState,
    }
  } catch (error) {
    if (runState) {
      if (error?.explorationPartial) {
        explorationCheckpoint = error.explorationPartial
        const hash = await writeJson(
          paths.explorationCheckpointPath,
          explorationCheckpoint,
        ).catch(() => null)
        if (hash) {
          runState.exploration.checkpointFile = relative(
            paths.runDir,
            paths.explorationCheckpointPath,
          )
          runState.exploration.checkpointSha256 = hash
          runState.exploration.modelDispatches =
            explorationCheckpoint.answerModelDispatches
          runState.exploration.toolCalls =
            explorationCheckpoint.explorationCalls
        }
      }
      const failedAt = isoNow(now)
      runState.completedAt = failedAt
      runState.failure = sanitizedError(error, secrets)
      runState.status = 'failed'
      runState.question.status = 'failed'
      runState.question.completedAt = failedAt
      runState.question.question2Started = false
      runState.invocations[0].completedAt = failedAt
      runState.invocations[0].completedQuestions = 0
      runState.invocations[0].question2Started = false
      if (runState.answer.status === 'pending') {
        runState.answer.status = 'not_reached'
      }
      if (runState.judge.status === 'pending') {
        runState.judge.status = 'not_reached'
      } else if (runState.judge.status === 'running') {
        runState.judge.status = 'failed'
      }
      if (transport) {
        runState.meter.gemini = await transport.snapshot()
          .catch(() => runState.meter.gemini)
      }
      const judgeSnapshot = await snapshotJudge(judgeTransport)
        .catch(() => null)
      runState.spend = spendFromEvidence({
        gemini: runState.meter.gemini,
        judge: judgeSnapshot,
      })
      await writeTerminalBundle({
        armResult,
        checkpointJournal,
        explorationCheckpoint,
        forbiddenSecrets: secrets,
        judgeTransport,
        now,
        paths,
        runState,
        transport,
      }).catch(async (bundleError) => {
        runState.failureBundle =
          sanitizedError(bundleError, secrets)
        await writeJson(paths.runStatePath, runState)
          .catch(() => {})
      })
    }
    throw error
  } finally {
    transport?.closeNetworkGuard()
    if (previousUmask !== undefined) {
      process.umask(previousUmask)
    }
    await lock.release()
  }
}

const invoked = process.argv[1] ? resolve(process.argv[1]) : ''
if (invoked === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(
      `${error?.code ?? 'EXPLORATION_LONGMEMEVAL_FAILED'}: ` +
      `${error?.message ?? 'Exploration LongMemEval live run failed.'}`,
    )
    process.exitCode = 1
  })
}

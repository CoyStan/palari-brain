// One-shot founder-gated runner for the recurrent active-memory smoke.
//
// Scope: two metered Gemini reducer calls followed by one metered Gemini
// answer call. No dataset, benchmark, judge, comparison arm, or continuation.

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
} from './active-brain-live-meter.mjs'
import {
  runIncrementalMemoryLiveSmoke,
} from './arms/incremental-memory-live-smoke.mjs'
import * as smokeConfig from './incremental-memory-smoke-config.mjs'
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
export const INCREMENTAL_MEMORY_SMOKE_REPO_ROOT = dirname(here)

// The post-run seal commit adds the run ID. Before execution this must remain
// empty so the exact pushed preparation cut can run once.
export const INCREMENTAL_MEMORY_SMOKE_TERMINAL_RUN_IDS =
  Object.freeze([])

const terminalRunIds = new Set(
  INCREMENTAL_MEMORY_SMOKE_TERMINAL_RUN_IDS,
)

function sameUsd(left, right) {
  return Number.isFinite(Number(left)) &&
    Number.isFinite(Number(right)) &&
    Math.abs(Number(left) - Number(right)) <= 1e-12
}

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

function isoNow(now = () => new Date().toISOString()) {
  const value = String(now())
  if (!value || Number.isNaN(Date.parse(value))) {
    throw new J4LiveError(
      'CLOCK_INVALID',
      'Incremental-memory runner clock must return an ISO timestamp.',
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
  return smokeConfig.incrementalMemorySmokeSha256(
    await readFile(path),
  )
}

function sanitizedError(error, secrets = []) {
  let message = String(
    error?.message ?? 'Incremental-memory live smoke failed.',
  )
  for (const secret of secrets) {
    if (secret) message = message.replaceAll(secret, '[REDACTED_SECRET]')
  }
  return {
    code: String(
      error?.code ?? error?.name ?? 'INCREMENTAL_SMOKE_FAILURE',
    ).slice(0, 80),
    message: message.slice(0, 240),
  }
}

export function parseIncrementalMemorySmokeArgs(args = []) {
  if (args.length !== 2 ||
    args[0] !== '--run' ||
    args[1] !== smokeConfig.INCREMENTAL_MEMORY_SMOKE_RUN_ID) {
    throw new J4LiveError(
      'RUN_ID_REQUIRED',
      'Invoke the incremental-memory runner with its exact frozen run ID.',
    )
  }
  return args[1]
}

export function assertIncrementalMemorySmokeOpen(runId) {
  if (terminalRunIds.has(runId)) {
    throw new J4LiveError(
      'J4_RUN_TERMINAL',
      `J4 run ${runId} is terminal and cannot be resumed or rerolled.`,
    )
  }
  if (runId === smokeConfig.INCREMENTAL_MEMORY_SMOKE_RUN_ID) {
    return runId
  }
  throw new J4LiveError(
    'RUN_ID_REQUIRED',
    'No matching incremental-memory smoke identity is configured.',
  )
}

export async function denyIncrementalMemorySmokeRetry() {
  throw new J4LiveError(
    'SMOKE_RETRY_FORBIDDEN',
    'This smoke permits one physical dispatch per logical operation.',
  )
}

export function incrementalMemorySmokeResultPaths(
  repoRoot = INCREMENTAL_MEMORY_SMOKE_REPO_ROOT,
) {
  const resultsRoot = resolve(
    repoRoot,
    smokeConfig.INCREMENTAL_MEMORY_SMOKE_RESULTS_ROOT,
  )
  const runDir = join(
    resultsRoot,
    smokeConfig.INCREMENTAL_MEMORY_SMOKE_RUN_ID,
  )
  return {
    artifactManifestPath: join(runDir, 'artifact-manifest.json'),
    checkpointPath: join(runDir, 'checkpoint.json'),
    ledgerPath: join(runDir, 'meter.jsonl'),
    lockPath: join(
      resultsRoot,
      `${smokeConfig.INCREMENTAL_MEMORY_SMOKE_RUN_ID}.lock`,
    ),
    reportJsonPath: join(runDir, 'report.json'),
    reportMarkdownPath: join(runDir, 'report.md'),
    resultPath: join(runDir, 'smoke-result.json'),
    resultsRoot,
    runDir,
    transcriptDirectory: join(runDir, 'transcripts'),
    workspaceDir: join(runDir, 'smoke-workspace'),
  }
}

export async function auditIncrementalMemoryTrackedArtifacts({
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
        'SMOKE_ARTIFACT_PATH',
        'Incremental-memory artifact paths must be unique and repository-relative.',
      )
    }
    seen.add(repositoryPath)
    const metadata = await lstat(path)
    if (!metadata.isFile() ||
      await sha256File(path) !== artifact.sha256) {
      throw new J4LiveError(
        'SMOKE_ARTIFACT_CHANGED',
        `Incremental-memory artifact changed: ${repositoryPath}.`,
      )
    }
  }
  const required = [
    'evals/active-brain-live-meter.mjs',
    'evals/arms/incremental-memory-live-smoke.mjs',
    'evals/incremental-memory-smoke-config.mjs',
    'evals/run-incremental-memory-smoke.mjs',
    'src/brain.mjs',
    'src/memory-digest-store.mjs',
    'src/memory-reducer.mjs',
  ]
  if (required.some((path) => !seen.has(path))) {
    throw new J4LiveError(
      'SMOKE_ARTIFACT_INCOMPLETE',
      'Incremental-memory runtime closure is not fully pinned.',
    )
  }
  return {
    artifacts: seen.size,
    artifactSetSha256:
      smokeConfig.incrementalMemorySmokeSha256(
        JSON.stringify(config.artifacts),
      ),
  }
}

export async function verifyIncrementalMemorySmokePredecessor({
  config,
  repoRoot,
} = {}) {
  const predecessor = config?.predecessor
  if (!sameJson(
    predecessor,
    smokeConfig.INCREMENTAL_MEMORY_SMOKE_PREDECESSOR,
  )) {
    throw new J4LiveError(
      'SMOKE_PREDECESSOR_SCHEMA',
      'Incremental-memory predecessor descriptor changed.',
    )
  }

  for (const entry of [
    ...Object.values(predecessor.tracked),
    predecessor.sealedRunner,
  ]) {
    if (await sha256File(resolve(repoRoot, entry.path)) !==
      entry.sha256) {
      throw new J4LiveError(
        'SMOKE_PREDECESSOR_HASH',
        'Canonical-capacity tracked evidence changed.',
      )
    }
  }
  for (const entry of Object.values(predecessor.private)) {
    const path = resolve(repoRoot, entry.path)
    const metadata = await lstat(path)
    if (!metadata.isFile() ||
      (metadata.mode & 0o777) !== 0o600 ||
      await sha256File(path) !== entry.sha256) {
      throw new J4LiveError(
        'SMOKE_PREDECESSOR_HASH',
        'Canonical-capacity private evidence changed.',
      )
    }
  }
  await verifyJ4ArtifactManifest(resolve(
    repoRoot,
    `evals/results/${predecessor.runId}`,
  ))
  const checkpoint = JSON.parse(await readFile(
    resolve(repoRoot, predecessor.private.checkpoint.path),
    'utf8',
  ))
  if (checkpoint.identity?.runId !== predecessor.runId ||
    checkpoint.identity?.configSha256 !==
      predecessor.tracked.config.sha256 ||
    checkpoint.identity?.authoritySha256 !==
      predecessor.tracked.authority.sha256 ||
    checkpoint.identity?.predictionsSha256 !==
      predecessor.tracked.predictions.sha256 ||
    checkpoint.status !== predecessor.status ||
    checkpoint.pauseReason !== 'MEMORY_CAPACITY_EXCEEDED' ||
    checkpoint.meter?.attempts !== predecessor.attempts ||
    !sameJson(
      checkpoint.meter?.logicalRequests,
      predecessor.logicalRequests,
    ) ||
    !sameUsd(
      checkpoint.meter?.accounted?.usd,
      predecessor.currentRunAccountedUsd,
    ) ||
    !sameUsd(
      checkpoint.meter?.measured?.usd,
      predecessor.currentRunMeasuredUsd,
    ) ||
    !sameUsd(
      checkpoint.meter?.uncertain?.usd,
      predecessor.currentRunUncertainUsd,
    ) ||
    !sameUsd(
      checkpoint.predecessorAudit?.accountedUsd,
      predecessor.openingAccountedUsd,
    ) ||
    checkpoint.trackedSecretAudit?.administrativeHead !==
      predecessor.administrativeHead) {
    throw new J4LiveError(
      'SMOKE_PREDECESSOR_CHECKPOINT',
      'Canonical-capacity checkpoint differs from its terminal profile.',
    )
  }
  const accountedUsd = Number((
    Number(checkpoint.predecessorAudit.accountedUsd) +
    Number(checkpoint.meter.accounted.usd)
  ).toFixed(12))
  const measuredUsd = Number((
    Number(checkpoint.predecessorAudit.measuredUsd) +
    Number(checkpoint.meter.measured.usd)
  ).toFixed(12))
  const uncertainUsd = Number((
    Number(checkpoint.predecessorAudit.uncertainUsd) +
    Number(checkpoint.meter.uncertain.usd)
  ).toFixed(12))
  if (!sameUsd(accountedUsd, predecessor.cumulativeAccountedUsd) ||
    !sameUsd(measuredUsd, predecessor.cumulativeMeasuredUsd) ||
    !sameUsd(uncertainUsd, predecessor.cumulativeUncertainUsd)) {
    throw new J4LiveError(
      'SMOKE_PREDECESSOR_SPEND',
      'Canonical-capacity cumulative spend does not reconcile.',
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
    model: smokeConfig.INCREMENTAL_MEMORY_SMOKE_MODEL,
    openingAccountedUsd:
      smokeConfig.INCREMENTAL_MEMORY_SMOKE_OPENING_ACCOUNTED_USD,
    predictionsSha256,
    productCommit: config.productCommit,
    runDate: config.runDate,
    runId: config.runId,
    schemaVersion: 1,
  }
}

function initialCheckpoint({ identity, predecessorAudit }) {
  return {
    events: [],
    identity,
    invocations: [],
    meter: null,
    predecessorAudit,
    schemaVersion: 1,
    smoke: {
      completedAt: null,
      operations: [],
      resultFile: null,
      resultSha256: null,
      startedAt: null,
      status: 'pending',
    },
    status: 'ready',
  }
}

function assertSuccessMeter(meter) {
  const logical = meter?.logicalRequests ?? {}
  const sections = [
    meter?.accounted,
    meter?.measured,
    meter?.uncertain,
  ]
  if (!sameJson(logical, { answer: 1, writer: 2 }) ||
    meter.attempts !== 3 + meter.retries.length ||
    meter.accounted.usd >
      smokeConfig.INCREMENTAL_MEMORY_SMOKE_FRESH_SUBCAP_USD +
        1e-12 ||
    !sameUsd(
      meter.accounted.usd,
      meter.measured.usd + meter.uncertain.usd,
    ) ||
    sections.some((section) =>
      Number(section?.judgeInputTokens ?? 0) !== 0 ||
      Number(section?.judgeOutputTokens ?? 0) !== 0)) {
    throw new J4LiveError(
      'SMOKE_METER_CARDINALITY',
      'Incremental-memory meter differs from two reducers plus one answer.',
    )
  }
  return meter
}

async function writeCheckpoint(path, checkpoint) {
  await atomicWriteJ4(path, `${JSON.stringify(checkpoint, null, 2)}\n`)
}

export function gradeIncrementalMemorySmokePredictions({
  checkpoint,
  result,
}) {
  const checkpointObservations = Object.assign(
    {},
    ...(checkpoint.smoke?.operations ?? [])
      .map((entry) => entry.observations ?? {}),
  )
  const observations = {
    ...checkpointObservations,
    ...(result?.observations ?? {}),
  }
  const meter = checkpoint.meter
  const writerRequests = Number(meter?.logicalRequests?.writer ?? 0)
  const answerRequests = Number(meter?.logicalRequests?.answer ?? 0)
  if (checkpoint.status === 'failed') {
    if (writerRequests >= 1 &&
      observations.firstReducerValid === undefined) {
      observations.firstReducerValid = false
      observations.oatMemoryAdded ??= false
    }
    if (writerRequests >= 2) {
      observations.secondRequestIsIncremental ??= true
      observations.almondSupersedesOat ??= false
      observations.correctionLineageSurvives ??= false
    }
    if (answerRequests >= 1 ||
      checkpoint.failure?.code === 'ANSWER_NOT_CALLED') {
      observations.answerUsesIncrementalDigest ??= false
    }
  }
  if (Array.isArray(meter?.retries) && meter.retries.length > 0) {
    observations.threeCallBoundaryNoRetries = false
  } else if (checkpoint.status === 'complete') {
    observations.threeCallBoundaryNoRetries =
      sameJson(meter?.logicalRequests, { answer: 1, writer: 2 }) &&
      meter?.attempts === 3
  } else if (checkpoint.status === 'failed') {
    observations.threeCallBoundaryNoRetries = false
  }
  if (checkpoint.identity &&
    Number(meter?.logicalRequests?.judge ?? 0) === 0 &&
    Number(meter?.accounted?.judgeInputTokens ?? 0) === 0 &&
    Number(meter?.accounted?.judgeOutputTokens ?? 0) === 0) {
    observations.noExternalEvalSurface ??= true
  }
  const evidenceById = {
    ALMOND_SUPERSEDES_OAT: observations.almondSupersedesOat,
    ANSWER_USES_INCREMENTAL_DIGEST:
      observations.answerUsesIncrementalDigest,
    CORRECTION_LINEAGE_SURVIVES:
      observations.correctionLineageSurvives,
    FIRST_REDUCER_VALID: observations.firstReducerValid,
    NO_EXTERNAL_EVAL_SURFACE: observations.noExternalEvalSurface,
    OAT_MEMORY_ADDED: observations.oatMemoryAdded,
    SECOND_REQUEST_IS_INCREMENTAL:
      observations.secondRequestIsIncremental,
    THREE_CALL_BOUNDARY_NO_RETRIES:
      observations.threeCallBoundaryNoRetries,
  }
  return smokeConfig.INCREMENTAL_MEMORY_SMOKE_EXPECTED_PREDICTIONS
    .map((prediction) => {
      const observed = evidenceById[prediction.id]
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

function buildPrivateReport({ checkpoint, result }) {
  const meter = checkpoint.meter
  return {
    disclaimer:
      'Private compatibility evidence. No dataset, benchmark question, judge, or comparison arm ran.',
    grades: gradeIncrementalMemorySmokePredictions({
      checkpoint,
      result,
    }),
    meter,
    modelVersion: result?.modelVersion ??
      meter?.geminiModelVersion ?? null,
    predecessor: checkpoint.predecessorAudit,
    result,
    retries: meter?.retries ?? [],
    runId: checkpoint.identity.runId,
    schemaVersion: 1,
    spend: {
      cumulativeAccountedUsd: Number((
        checkpoint.predecessorAudit.accountedUsd +
        Number(meter?.accounted?.usd ?? 0)
      ).toFixed(12)),
      cumulativeMeasuredUsd: Number((
        checkpoint.predecessorAudit.measuredUsd +
        Number(meter?.measured?.usd ?? 0)
      ).toFixed(12)),
      cumulativeUncertainUsd: Number((
        checkpoint.predecessorAudit.uncertainUsd +
        Number(meter?.uncertain?.usd ?? 0)
      ).toFixed(12)),
      freshAccountedUsd: Number(meter?.accounted?.usd ?? 0),
      freshMeasuredUsd: Number(meter?.measured?.usd ?? 0),
      freshUncertainUsd: Number(meter?.uncertain?.usd ?? 0),
    },
    status: checkpoint.status,
  }
}

function renderPrivateReport(report) {
  const missesFirst = report.grades.map((grade) =>
    `- ${grade.outcome.toUpperCase()} ${grade.id}: ${grade.statement}`)
  return [
    '# Incremental-memory private live smoke',
    '',
    `> ${report.disclaimer}`,
    '',
    `- Status: ${report.status}`,
    `- Reducer calls: ${report.meter?.logicalRequests?.writer ?? 0}`,
    `- Answer calls: ${report.meter?.logicalRequests?.answer ?? 0}`,
    '- Dataset reads: 0',
    '- Benchmark questions: 0',
    '- Judge calls: 0',
    `- Attempts: ${report.meter?.attempts ?? 0}`,
    `- Retries: ${report.retries.length}`,
    `- Fresh accounted spend: $${report.spend.freshAccountedUsd.toFixed(7)}`,
    `- Cumulative accounted spend: $${report.spend.cumulativeAccountedUsd.toFixed(7)}`,
    '',
    '## Prediction grade (misses first)',
    '',
    ...missesFirst,
    '',
  ].join('\n')
}

async function writeTerminalBundle({
  checkpoint,
  forbiddenSecrets,
  now,
  paths,
  result,
  transport,
}) {
  if (transport) {
    const verified = await transport.verify()
    checkpoint.meter = verified.ledger
    checkpoint.transcriptAudit = verified.transcripts
  }
  const report = buildPrivateReport({ checkpoint, result })
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
  repoRoot = INCREMENTAL_MEMORY_SMOKE_REPO_ROOT,
} = {}) {
  const runId = parseIncrementalMemorySmokeArgs(args)

  // This denial is deliberately before dependencies, files, results, or keys.
  assertIncrementalMemorySmokeOpen(runId)

  const loadConfig = dependencies.loadConfig ??
    smokeConfig.loadIncrementalMemorySmokeConfig
  const loadAuthority = dependencies.loadAuthority ??
    smokeConfig.loadIncrementalMemorySmokeAuthority
  const auditArtifacts = dependencies.auditArtifacts ??
    auditIncrementalMemoryTrackedArtifacts
  const inspectGit = dependencies.inspectGitCutPoint ??
    inspectJ4GitCutPoint
  const verifyPredecessor = dependencies.verifyPredecessor ??
    verifyIncrementalMemorySmokePredecessor
  const assertEnvironment = dependencies.assertEnvironment ??
    smokeConfig.assertIncrementalMemorySmokeEnvironment
  const auditTracked = dependencies.auditTrackedFiles ??
    auditJ4TrackedFiles
  const meterFactory = dependencies.createMeteredTransport ??
    createActiveBrainMeteredTransport
  const runSmoke = dependencies.runSmoke ??
    runIncrementalMemoryLiveSmoke
  const pathExists = dependencies.exists ?? exists
  const now = dependencies.now ?? (() => new Date().toISOString())
  const log = dependencies.log ?? console.log
  const paths = incrementalMemorySmokeResultPaths(repoRoot)

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
  let transport
  let checkpoint
  let result = null
  let secrets = []
  try {
    if (await pathExists(paths.runDir)) {
      throw new J4LiveError(
        'SMOKE_RUN_ALREADY_EXISTS',
        'Incremental-memory smoke refuses to resume, replace, or overlay.',
      )
    }
    const predecessorAudit = await verifyPredecessor({
      config: loaded.config,
      repoRoot,
    })
    if (!sameUsd(
      predecessorAudit.accountedUsd,
      smokeConfig.INCREMENTAL_MEMORY_SMOKE_OPENING_ACCOUNTED_USD,
    )) {
      throw new J4LiveError(
        'SMOKE_OPENING_SPEND',
        'Incremental-memory smoke has the wrong opening spend.',
      )
    }

    // This is the first point where the Gemini credential may be read.
    const runtime = assertEnvironment(
      env,
      loaded.config,
      loadedAuthority.authority,
    )
    secrets = [runtime.geminiApiKey, J4_DENY_OPENAI_KEY]
    const trackedSecretAudit = await auditTracked({
      env,
      forbiddenSecrets: [runtime.geminiApiKey],
      repoRoot,
    })
    for (const name of J4_GOOGLE_CREDENTIAL_ALIASES) {
      env[name] = J4_DENY_GEMINI_KEY
    }
    env.OPENAI_API_KEY = J4_DENY_OPENAI_KEY

    previousUmask = process.umask(0o077)
    await mkdir(paths.runDir, { recursive: true, mode: 0o700 })
    await chmod(paths.runDir, 0o700)
    await mkdir(paths.transcriptDirectory, {
      recursive: true,
      mode: 0o700,
    })
    await chmod(paths.transcriptDirectory, 0o700)

    const identity = buildIdentity({
      artifactAudit,
      authoritySha256: loadedAuthority.authoritySha256,
      config: loaded.config,
      configSha256: loaded.configSha256,
      predictionsSha256: loaded.predictionsSha256,
    })
    checkpoint = initialCheckpoint({
      identity,
      predecessorAudit: {
        ...predecessorAudit,
        completedAt: isoNow(now),
      },
    })
    checkpoint.trackedSecretAudit = {
      ...trackedSecretAudit,
      administrativeHead: git.administrativeHead,
      completedAt: isoNow(now),
    }
    checkpoint.invocations.push({
      administrativeHead: git.administrativeHead,
      answerOperations: 1,
      benchmarkQuestions: 0,
      cumulativeCapUsd: runtime.cumulativeCapUsd,
      freshSubcapUsd: runtime.freshSubcapUsd,
      logicalOperations: 3,
      openingAccountedUsd: predecessorAudit.accountedUsd,
      reducerOperations: 2,
      startedAt: isoNow(now),
    })
    await writeCheckpoint(paths.checkpointPath, checkpoint)

    transport = await meterFactory({
      answerGeneration:
        smokeConfig.INCREMENTAL_MEMORY_ANSWER_GENERATION,
      capUsd: smokeConfig.INCREMENTAL_MEMORY_SMOKE_FRESH_SUBCAP_USD,
      geminiApiKey: runtime.geminiApiKey,
      geminiModel: runtime.model,
      journalPath: paths.ledgerPath,
      limits: smokeConfig.INCREMENTAL_MEMORY_SMOKE_LIMITS,
      openaiApiKey: J4_DENY_OPENAI_KEY,
      transcriptDirectory: paths.transcriptDirectory,
      waitImpl: denyIncrementalMemorySmokeRetry,
      writerGeneration:
        smokeConfig.INCREMENTAL_MEMORY_REDUCER_GENERATION,
    })
    transport.installNetworkGuard()

    checkpoint.status = 'running'
    checkpoint.smoke.status = 'in_progress'
    checkpoint.smoke.startedAt = isoNow(now)
    checkpoint.events.push({
      status: 'smoke_in_progress',
      timestamp: checkpoint.smoke.startedAt,
    })
    await writeCheckpoint(paths.checkpointPath, checkpoint)

    result = await runSmoke({
      callGemini: transport.callGemini,
      onOperation: async ({ observations, operation }) => {
        checkpoint.smoke.operations.push({
          completedAt: isoNow(now),
          observations: { ...(observations ?? {}) },
          operation,
        })
        checkpoint.meter = await transport.snapshot()
        checkpoint.events.push({
          operation,
          status: 'operation_completed',
          timestamp: isoNow(now),
        })
        await writeCheckpoint(paths.checkpointPath, checkpoint)
      },
      workspaceDir: paths.workspaceDir,
    })
    const verified = await transport.verify()
    checkpoint.meter = assertSuccessMeter(verified.ledger)
    checkpoint.transcriptAudit = verified.transcripts
    if (result.logicalOperations !== 3 ||
      result.modelVersion !== checkpoint.meter.geminiModelVersion ||
      !sameJson(
        checkpoint.smoke.operations.map((entry) => entry.operation),
        ['reducer-1', 'reducer-2', 'answer'],
      )) {
      throw new J4LiveError(
        'SMOKE_RESULT_INVALID',
        'Incremental-memory result differs from its three-operation scope.',
      )
    }

    const resultText = `${JSON.stringify(result, null, 2)}\n`
    await atomicWriteJ4(paths.resultPath, resultText)
    checkpoint.smoke = {
      ...checkpoint.smoke,
      completedAt: isoNow(now),
      resultFile: relative(paths.runDir, paths.resultPath),
      resultSha256:
        smokeConfig.incrementalMemorySmokeSha256(resultText),
      status: 'completed',
    }
    checkpoint.status = 'complete'
    checkpoint.completedAt = checkpoint.smoke.completedAt
    checkpoint.events.push({
      status: 'smoke_completed',
      timestamp: checkpoint.smoke.completedAt,
    })
    const invocation = checkpoint.invocations.at(-1)
    invocation.completedAt = checkpoint.smoke.completedAt
    invocation.completedOperations = 3
    const report = await writeTerminalBundle({
      checkpoint,
      forbiddenSecrets: secrets,
      now,
      paths,
      result,
      transport,
    })
    log(
      `Incremental-memory smoke complete; private report: ` +
      `${paths.reportMarkdownPath}`,
    )
    return { checkpoint, report, result }
  } catch (error) {
    if (checkpoint) {
      checkpoint.status = 'failed'
      checkpoint.failedAt ??= isoNow(now)
      checkpoint.failure ??= sanitizedError(error, secrets)
      if (checkpoint.smoke?.status === 'in_progress') {
        checkpoint.smoke.status = 'failed'
        checkpoint.smoke.failedAt = checkpoint.failedAt
      }
      const invocation = checkpoint.invocations.at(-1)
      if (invocation) {
        invocation.completedAt ??= checkpoint.failedAt
        invocation.completedOperations =
          checkpoint.smoke?.operations?.length ?? 0
      }
      if (transport) {
        checkpoint.meter = await transport.snapshot()
          .catch(() => checkpoint.meter)
      }
      await writeTerminalBundle({
        checkpoint,
        forbiddenSecrets: secrets,
        now,
        paths,
        result,
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
      `${error?.code ?? 'INCREMENTAL_SMOKE_FAILED'}: ` +
      `${error?.message ?? 'Incremental-memory live smoke failed.'}`,
    )
    process.exitCode = 1
  })
}

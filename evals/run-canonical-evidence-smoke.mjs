// One-shot founder-gated runner for the canonical-evidence role smoke.
//
// Scope is deliberately smaller than LongMemEval: no dataset, benchmark
// question, judge, or OpenAI credential is loaded. The only permitted live
// operations are one Gemini writer request and one Gemini answer request.

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
  ACTIVE_BRAIN_PREDECESSOR_CHAIN,
} from './active-brain-live-config.mjs'
import {
  createActiveBrainMeteredTransport,
  J4LiveError,
} from './active-brain-live-meter.mjs'
import {
  runCanonicalEvidenceLiveSmoke,
} from './arms/canonical-evidence-live-smoke.mjs'
import * as smokeConfig from './canonical-evidence-smoke-config.mjs'
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
import {
  verifyActiveBrainFiveRunPredecessor,
} from './run-active-brain-live.mjs'

const here = dirname(fileURLToPath(import.meta.url))
export const CANONICAL_EVIDENCE_SMOKE_REPO_ROOT = dirname(here)

// This array is populated in the post-run seal commit. The terminal check is
// intentionally the first operation after parsing the exact run ID.
export const CANONICAL_EVIDENCE_SMOKE_TERMINAL_RUN_IDS =
  Object.freeze([])

const terminalRunIds = new Set(
  CANONICAL_EVIDENCE_SMOKE_TERMINAL_RUN_IDS,
)

function sameUsd(left, right) {
  return Number.isFinite(Number(left)) &&
    Number.isFinite(Number(right)) &&
    Math.abs(Number(left) - Number(right)) <= 1e-12
}

function sameJson(left, right) {
  const stable = (value) => {
    if (Array.isArray(value)) return value.map(stable)
    if (!value || typeof value !== 'object') return value
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [
        key,
        stable(value[key]),
      ]),
    )
  }
  return JSON.stringify(stable(left)) === JSON.stringify(stable(right))
}

function isoNow(now = () => new Date().toISOString()) {
  const value = String(now())
  if (!value || Number.isNaN(Date.parse(value))) {
    throw new J4LiveError(
      'CLOCK_INVALID',
      'Canonical evidence runner clock must return an ISO timestamp.',
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
  return smokeConfig.canonicalEvidenceSmokeSha256(
    await readFile(path),
  )
}

function sanitizedError(error, secrets = []) {
  let message = String(
    error?.message ?? 'Canonical evidence live smoke failed.',
  )
  for (const secret of secrets) {
    if (secret) message = message.replaceAll(secret, '[REDACTED_SECRET]')
  }
  return {
    code: String(
      error?.code ?? error?.name ?? 'CANONICAL_SMOKE_FAILURE',
    ).slice(0, 80),
    message: message.slice(0, 240),
  }
}

export function parseCanonicalEvidenceSmokeArgs(args = []) {
  if (args.length !== 2 ||
    args[0] !== '--run' ||
    args[1] !== smokeConfig.CANONICAL_EVIDENCE_SMOKE_RUN_ID) {
    throw new J4LiveError(
      'RUN_ID_REQUIRED',
      'Invoke the canonical evidence runner with its exact frozen run ID.',
    )
  }
  return args[1]
}

export function assertCanonicalEvidenceSmokeOpen(runId) {
  if (terminalRunIds.has(runId)) {
    throw new J4LiveError(
      'J4_RUN_TERMINAL',
      `J4 run ${runId} is terminal and cannot be resumed or rerolled.`,
    )
  }
  if (runId === smokeConfig.CANONICAL_EVIDENCE_SMOKE_RUN_ID) {
    return runId
  }
  throw new J4LiveError(
    'RUN_ID_REQUIRED',
    'No matching canonical evidence smoke identity is configured.',
  )
}

export function canonicalEvidenceSmokeResultPaths(
  repoRoot = CANONICAL_EVIDENCE_SMOKE_REPO_ROOT,
) {
  const resultsRoot = resolve(
    repoRoot,
    smokeConfig.CANONICAL_EVIDENCE_SMOKE_RESULTS_ROOT,
  )
  const runDir = join(
    resultsRoot,
    smokeConfig.CANONICAL_EVIDENCE_SMOKE_RUN_ID,
  )
  return {
    artifactManifestPath: join(runDir, 'artifact-manifest.json'),
    checkpointPath: join(runDir, 'checkpoint.json'),
    ledgerPath: join(runDir, 'meter.jsonl'),
    lockPath: join(
      resultsRoot,
      `${smokeConfig.CANONICAL_EVIDENCE_SMOKE_RUN_ID}.lock`,
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

export async function auditCanonicalEvidenceTrackedArtifacts({
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
        'Canonical evidence artifact paths must be unique and repository-relative.',
      )
    }
    seen.add(repositoryPath)
    const metadata = await lstat(path)
    if (!metadata.isFile() ||
      await sha256File(path) !== artifact.sha256) {
      throw new J4LiveError(
        'SMOKE_ARTIFACT_CHANGED',
        `Canonical evidence artifact changed: ${repositoryPath}.`,
      )
    }
  }
  return {
    artifacts: seen.size,
    artifactSetSha256:
      smokeConfig.canonicalEvidenceSmokeSha256(
        JSON.stringify(config.artifacts),
      ),
  }
}

function activeV1Descriptor(config) {
  const predecessor = config?.predecessor
  if (!predecessor ||
    predecessor.runId !== 'j4-active-brain-first5-v1' ||
    predecessor.administrativeHead !==
      '451ee460a4b06c12149172b9838680fbfeecb9bc' ||
    !sameUsd(
      predecessor.openingAccountedUsd,
      0.7721877,
    ) ||
    !sameUsd(
      predecessor.currentRunAccountedUsd,
      0.0003118,
    ) ||
    !sameUsd(
      predecessor.cumulativeAccountedUsd,
      smokeConfig.CANONICAL_EVIDENCE_SMOKE_OPENING_ACCOUNTED_USD,
    ) ||
    !sameUsd(
      predecessor.cumulativeMeasuredUsd,
      smokeConfig.CANONICAL_EVIDENCE_SMOKE_OPENING_MEASURED_USD,
    ) ||
    !sameUsd(
      predecessor.cumulativeUncertainUsd,
      smokeConfig.CANONICAL_EVIDENCE_SMOKE_OPENING_UNCERTAIN_USD,
    )) {
    throw new J4LiveError(
      'SMOKE_PREDECESSOR_SCHEMA',
      'Canonical evidence predecessor spend or identity changed.',
    )
  }
  return predecessor
}

export async function verifyCanonicalEvidenceSmokePredecessor({
  config,
  repoRoot,
} = {}) {
  const predecessor = activeV1Descriptor(config)
  const v1ThroughV5 = await verifyActiveBrainFiveRunPredecessor({
    predecessorChain: ACTIVE_BRAIN_PREDECESSOR_CHAIN,
    repoRoot,
  })
  if (!sameUsd(v1ThroughV5.accountedUsd, 0.7721877) ||
    !sameUsd(v1ThroughV5.measuredUsd, 0.7696867) ||
    !sameUsd(v1ThroughV5.uncertainUsd, 0.002501)) {
    throw new J4LiveError(
      'SMOKE_PREDECESSOR_SPEND',
      'Canonical evidence V1-V5 spend no longer reconciles.',
    )
  }

  for (const entry of [
    predecessor.tracked.config,
    predecessor.tracked.authority,
    predecessor.tracked.predictions,
  ]) {
    if (await sha256File(resolve(repoRoot, entry.path)) !==
      entry.sha256) {
      throw new J4LiveError(
        'SMOKE_PREDECESSOR_HASH',
        'Active-v1 tracked evidence changed.',
      )
    }
  }
  for (const entry of [
    predecessor.private.manifest,
    predecessor.private.checkpoint,
    predecessor.private.meter,
  ]) {
    const path = resolve(repoRoot, entry.path)
    const metadata = await lstat(path)
    if (!metadata.isFile() ||
      (metadata.mode & 0o777) !== 0o600 ||
      await sha256File(path) !== entry.sha256) {
      throw new J4LiveError(
        'SMOKE_PREDECESSOR_HASH',
        'Active-v1 private evidence changed.',
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
    checkpoint.identity?.predictionsSha256 !==
      predecessor.tracked.predictions.sha256 ||
    checkpoint.status !== 'failed' ||
    checkpoint.failure?.code !== 'ROLE_SMOKE_FAILED' ||
    checkpoint.smoke?.status !== 'failed' ||
    checkpoint.questions?.length !== 5 ||
    checkpoint.questions.some((cell) => cell.status !== 'pending') ||
    checkpoint.meter?.attempts !== 2 ||
    !sameJson(checkpoint.meter?.logicalRequests, {
      answer: 1,
      writer: 1,
    }) ||
    checkpoint.meter?.retries?.length !== 0 ||
    !sameUsd(
      checkpoint.meter?.accounted?.usd,
      predecessor.currentRunAccountedUsd,
    ) ||
    !sameUsd(
      checkpoint.meter?.measured?.usd,
      predecessor.currentRunAccountedUsd,
    ) ||
    !sameUsd(checkpoint.meter?.uncertain?.usd, 0) ||
    checkpoint.trackedSecretAudits?.[0]?.administrativeHead !==
      predecessor.administrativeHead) {
    throw new J4LiveError(
      'SMOKE_PREDECESSOR_CHECKPOINT',
      'Active-v1 checkpoint differs from its terminal profile.',
    )
  }
  const cumulativeAccountedUsd = Number((
    v1ThroughV5.accountedUsd +
    checkpoint.meter.accounted.usd
  ).toFixed(12))
  const cumulativeMeasuredUsd = Number((
    v1ThroughV5.measuredUsd +
    checkpoint.meter.measured.usd
  ).toFixed(12))
  const cumulativeUncertainUsd = Number((
    v1ThroughV5.uncertainUsd +
    checkpoint.meter.uncertain.usd
  ).toFixed(12))
  if (!sameUsd(
    cumulativeAccountedUsd,
    predecessor.cumulativeAccountedUsd,
  ) ||
    !sameUsd(
      cumulativeMeasuredUsd,
      predecessor.cumulativeMeasuredUsd,
    ) ||
    !sameUsd(
      cumulativeUncertainUsd,
      predecessor.cumulativeUncertainUsd,
    ) ||
    !sameUsd(
      smokeConfig.CANONICAL_EVIDENCE_SMOKE_CUMULATIVE_CAP_USD -
        cumulativeAccountedUsd,
      smokeConfig.CANONICAL_EVIDENCE_SMOKE_AVAILABLE_USD,
    )) {
    throw new J4LiveError(
      'SMOKE_PREDECESSOR_SPEND',
      'Active-v1 cumulative spend does not leave the frozen remainder.',
    )
  }
  return {
    accountedUsd: cumulativeAccountedUsd,
    activeV1CheckpointSha256:
      predecessor.private.checkpoint.sha256,
    activeV1ManifestSha256:
      predecessor.private.manifest.sha256,
    activeV1MeterSha256:
      predecessor.private.meter.sha256,
    measuredUsd: cumulativeMeasuredUsd,
    runId: predecessor.runId,
    uncertainUsd: cumulativeUncertainUsd,
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
    model: smokeConfig.CANONICAL_EVIDENCE_SMOKE_GEMINI_MODEL,
    openingAccountedUsd:
      smokeConfig.CANONICAL_EVIDENCE_SMOKE_OPENING_ACCOUNTED_USD,
    predictionsSha256,
    productCommit: config.productCommit,
    runDate: config.runDate,
    runId: config.runId,
    schemaVersion: 1,
  }
}

function zeroSmokeCheckpoint({ identity, predecessorAudit }) {
  return {
    events: [],
    identity,
    invocations: [],
    meter: null,
    predecessorAudit,
    questions: [],
    schemaVersion: 1,
    smoke: {
      completedAt: null,
      logicalOperations: 0,
      resultFile: null,
      resultSha256: null,
      startedAt: null,
      status: 'pending',
    },
    status: 'ready',
  }
}

function assertSmokeMeter(meter) {
  const logical = meter?.logicalRequests ?? {}
  if (logical.writer !== 1 ||
    logical.answer !== 1 ||
    Object.hasOwn(logical, 'judge') ||
    meter.attempts !== 2 + meter.retries.length ||
    meter.accounted.usd >
      smokeConfig.CANONICAL_EVIDENCE_SMOKE_FRESH_SUBCAP_USD +
        1e-12 ||
    !sameUsd(
      meter.accounted.usd,
      meter.measured.usd + meter.uncertain.usd,
    )) {
    throw new J4LiveError(
      'SMOKE_METER_CARDINALITY',
      'Canonical evidence smoke meter differs from writer plus answer.',
    )
  }
  return meter
}

async function writeCheckpoint(path, checkpoint) {
  await atomicWriteJ4(path, `${JSON.stringify(checkpoint, null, 2)}\n`)
}

function buildPrivateReport({ checkpoint, result }) {
  const fresh = checkpoint.meter
  return {
    disclaimer:
      'Private smoke evidence. No benchmark question or score was run.',
    logicalOperations: checkpoint.smoke.logicalOperations,
    meter: fresh,
    modelVersion: result?.answerModelVersion ?? null,
    predecessor: checkpoint.predecessorAudit,
    retries: fresh?.retries ?? [],
    runId: checkpoint.identity.runId,
    schemaVersion: 1,
    smoke: result,
    spend: {
      cumulativeAccountedUsd: Number((
        checkpoint.predecessorAudit.accountedUsd +
        Number(fresh?.accounted?.usd ?? 0)
      ).toFixed(12)),
      cumulativeMeasuredUsd: Number((
        checkpoint.predecessorAudit.measuredUsd +
        Number(fresh?.measured?.usd ?? 0)
      ).toFixed(12)),
      cumulativeUncertainUsd: Number((
        checkpoint.predecessorAudit.uncertainUsd +
        Number(fresh?.uncertain?.usd ?? 0)
      ).toFixed(12)),
      freshAccountedUsd: Number(fresh?.accounted?.usd ?? 0),
      freshMeasuredUsd: Number(fresh?.measured?.usd ?? 0),
      freshUncertainUsd: Number(fresh?.uncertain?.usd ?? 0),
    },
    status: checkpoint.status,
  }
}

function renderPrivateReport(report) {
  return [
    '# Canonical evidence private role smoke',
    '',
    `> ${report.disclaimer}`,
    '',
    `- Status: ${report.status}`,
    `- Live operations: ${report.logicalOperations}`,
    `- Writer calls: ${report.meter?.logicalRequests?.writer ?? 0}`,
    `- Answer calls: ${report.meter?.logicalRequests?.answer ?? 0}`,
    '- Benchmark questions: 0',
    `- Fresh accounted spend: $${report.spend.freshAccountedUsd.toFixed(7)}`,
    `- Cumulative accounted spend: $${report.spend.cumulativeAccountedUsd.toFixed(7)}`,
    `- Retries: ${report.retries.length}`,
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
  repoRoot = CANONICAL_EVIDENCE_SMOKE_REPO_ROOT,
} = {}) {
  const runId = parseCanonicalEvidenceSmokeArgs(args)

  // Terminal identities fail before dependencies, files, results, or keys.
  assertCanonicalEvidenceSmokeOpen(runId)

  const loadConfig = dependencies.loadConfig ??
    smokeConfig.loadCanonicalEvidenceSmokeConfig
  const loadAuthority = dependencies.loadAuthority ??
    smokeConfig.loadCanonicalEvidenceSmokeAuthority
  const auditArtifacts = dependencies.auditArtifacts ??
    auditCanonicalEvidenceTrackedArtifacts
  const inspectGit = dependencies.inspectGitCutPoint ??
    inspectJ4GitCutPoint
  const verifyPredecessor = dependencies.verifyPredecessor ??
    verifyCanonicalEvidenceSmokePredecessor
  const assertEnvironment = dependencies.assertEnvironment ??
    smokeConfig.assertCanonicalEvidenceSmokeEnvironment
  const auditTracked = dependencies.auditTrackedFiles ??
    auditJ4TrackedFiles
  const meterFactory = dependencies.createMeteredTransport ??
    createActiveBrainMeteredTransport
  const runSmoke = dependencies.runSmoke ??
    runCanonicalEvidenceLiveSmoke
  const pathExists = dependencies.exists ?? exists
  const now = dependencies.now ?? (() => new Date().toISOString())
  const log = dependencies.log ?? console.log
  const paths = canonicalEvidenceSmokeResultPaths(repoRoot)

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
        'Canonical evidence smoke refuses to resume, replace, or overlay.',
      )
    }
    const predecessorAudit = await verifyPredecessor({
      config: loaded.config,
      repoRoot,
    })
    if (!sameUsd(
      predecessorAudit.accountedUsd,
      smokeConfig.CANONICAL_EVIDENCE_SMOKE_OPENING_ACCOUNTED_USD,
    )) {
      throw new J4LiveError(
        'SMOKE_OPENING_SPEND',
        'Canonical evidence smoke has the wrong opening spend.',
      )
    }

    // This is the first point at which the Gemini key may be read.
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
    checkpoint = zeroSmokeCheckpoint({
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
      benchmarkQuestions: 0,
      cumulativeCapUsd: runtime.cumulativeCapUsd,
      freshSubcapUsd: runtime.freshSubcapUsd,
      logicalOperations: 2,
      openingAccountedUsd: predecessorAudit.accountedUsd,
      startedAt: isoNow(now),
    })
    await writeCheckpoint(paths.checkpointPath, checkpoint)

    transport = await meterFactory({
      answerGeneration:
        smokeConfig.CANONICAL_EVIDENCE_SMOKE_ANSWER_GENERATION,
      capUsd: smokeConfig.CANONICAL_EVIDENCE_SMOKE_FRESH_SUBCAP_USD,
      geminiApiKey: runtime.geminiApiKey,
      geminiModel: runtime.model,
      journalPath: paths.ledgerPath,
      limits: smokeConfig.CANONICAL_EVIDENCE_SMOKE_LIMITS,
      // The mature meter has a judge method, but this fixed denial value is
      // never read from an environment, sent, or exposed by this runner.
      openaiApiKey: J4_DENY_OPENAI_KEY,
      transcriptDirectory: paths.transcriptDirectory,
      writerGeneration:
        smokeConfig.CANONICAL_EVIDENCE_SMOKE_WRITER_GENERATION,
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
      workspaceDir: paths.workspaceDir,
    })
    const verified = await transport.verify()
    checkpoint.meter = assertSmokeMeter(verified.ledger)
    checkpoint.transcriptAudit = verified.transcripts
    if (result.logicalOperations !== 2 ||
      result.writerModelVersion !==
        checkpoint.meter.geminiModelVersion ||
      result.answerModelVersion !==
        checkpoint.meter.geminiModelVersion) {
      throw new J4LiveError(
        'SMOKE_RESULT_INVALID',
        'Canonical evidence smoke result differs from its metered calls.',
      )
    }
    const resultText = `${JSON.stringify(result, null, 2)}\n`
    await atomicWriteJ4(paths.resultPath, resultText)
    checkpoint.smoke = {
      completedAt: isoNow(now),
      logicalOperations: 2,
      resultFile: relative(paths.runDir, paths.resultPath),
      resultSha256:
        smokeConfig.canonicalEvidenceSmokeSha256(resultText),
      startedAt: checkpoint.smoke.startedAt,
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
    invocation.completedQuestions = 0
    const report = await writeTerminalBundle({
      checkpoint,
      forbiddenSecrets: secrets,
      now,
      paths,
      result,
      transport,
    })
    log(
      `Canonical evidence smoke complete; private report: ` +
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
        invocation.completedQuestions = 0
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
      `${error?.code ?? 'CANONICAL_SMOKE_FAILED'}: ` +
      `${error?.message ?? 'Canonical evidence live smoke failed.'}`,
    )
    process.exitCode = 1
  })
}

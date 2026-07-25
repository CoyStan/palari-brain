// Fresh founder-gated LongMemEval runner for the active Palari Brain.
//
// This file deliberately does not reuse the terminal v1-v5 product arm.
// It reuses only the generic evidence, budget, checkpoint, and provider
// transport controls. Importing it is inert.

import {
  access,
  chmod,
  lstat,
  mkdir,
  readFile,
} from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import * as activeConfig from './active-brain-live-config.mjs'
import {
  activeBrainLongMemEvalExchanges,
  runActiveBrainLongMemEvalQuestion,
  runActiveBrainRoleSmoke,
} from './arms/active-brain-longmemeval-live-arm.mjs'
import {
  createActiveBrainMeteredTransport,
  J4LiveError,
} from './active-brain-live-meter.mjs'
import {
  LONGMEMEVAL_JUDGE_MODEL,
  parseLongMemEvalJudgeLabel,
} from './longmemeval-judge.mjs'
import {
  acquireJ4RunLock,
  assertValidatedJ4JudgeResponse,
  atomicWriteJ4,
  auditJ4TrackedFiles,
  buildJ4JudgeBody,
  buildJ4PrivateReport,
  collectJ4PrivateArtifacts,
  inspectJ4GitCutPoint,
  J4_DENY_GEMINI_KEY,
  J4_DENY_OPENAI_KEY,
  J4_GOOGLE_CREDENTIAL_ALIASES,
  verifyJ4ArtifactManifest,
  verifyJ4PredecessorBundle,
} from './run-longmemeval-live.mjs'
import {
  J4_FIRST_TRANCHE_QUESTION_IDS,
  prepareJ4PinnedS60,
  SEALED_U8_QUESTION_IDS,
} from './longmemeval-plan.mjs'

const here = dirname(fileURLToPath(import.meta.url))
export const ACTIVE_BRAIN_REPO_ROOT = dirname(here)

export const ACTIVE_BRAIN_TERMINAL_RUN_IDS = Object.freeze([
  'j4-longmemeval-s60-v1',
  'j4-longmemeval-s60-v2',
  'j4-longmemeval-s60-v3',
  'j4-longmemeval-s60-v4',
  'j4-longmemeval-s60-v5',
  'j4-active-brain-first5-v1',
])

const terminalRunIds = new Set(ACTIVE_BRAIN_TERMINAL_RUN_IDS)

function sameJson(left, right) {
  return activeConfig.stableActiveBrainStringify(left) ===
    activeConfig.stableActiveBrainStringify(right)
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
      'Active Brain runner clock must return an ISO-compatible timestamp.',
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

async function writeCheckpoint(path, checkpoint) {
  await atomicWriteJ4(path, `${JSON.stringify(checkpoint, null, 2)}\n`)
}

function sanitizedError(error, forbiddenSecrets = []) {
  let message = String(error?.message ?? 'Active Brain live runner failed.')
  for (const secret of forbiddenSecrets) {
    if (secret) message = message.replaceAll(secret, '[REDACTED_SECRET]')
  }
  return {
    code: String(
      error?.code ?? error?.name ?? 'ACTIVE_BRAIN_LIVE_FAILURE',
    ).slice(0, 80),
    message: message.slice(0, 240),
  }
}

export function parseActiveBrainLiveArgs(args = []) {
  if (args.length !== 2 ||
    args[0] !== '--run' ||
    (!terminalRunIds.has(args[1]) &&
      args[1] !== activeConfig.ACTIVE_BRAIN_LIVE_RUN_ID)) {
    throw new J4LiveError(
      'RUN_ID_REQUIRED',
      'Invoke the active-brain live runner with its exact frozen run ID.',
    )
  }
  return args[1]
}

export function assertActiveBrainLiveRunOpen(runId) {
  if (terminalRunIds.has(runId)) {
    throw new J4LiveError(
      'J4_RUN_TERMINAL',
      `J4 run ${runId} is terminal and cannot be resumed or rerolled.`,
    )
  }
  if (runId === activeConfig.ACTIVE_BRAIN_LIVE_RUN_ID) return runId
  throw new J4LiveError(
    'RUN_ID_REQUIRED',
    'No matching unsealed active-brain live identity is configured.',
  )
}

export function activeBrainFirstFivePopulation(prepared = {}) {
  if (!Array.isArray(prepared.executionOrder) ||
    prepared.executionOrder.length !== 60 ||
    !prepared.manifest?.datasetSha256) {
    throw new J4LiveError(
      'POPULATION_COUNT',
      'Active Brain requires the canonical 60-question prepared population.',
    )
  }
  const executionOrder = prepared.executionOrder.slice(0, 5)
  const questionIds = executionOrder.map((entry) => entry?.questionId)
  if (!sameJson(questionIds, J4_FIRST_TRANCHE_QUESTION_IDS)) {
    throw new J4LiveError(
      'FIRST_FIVE_MISMATCH',
      'Active Brain first-five order differs from the frozen J4 sentinels.',
    )
  }
  const sealed = new Set(SEALED_U8_QUESTION_IDS)
  if (questionIds.some((questionId) => sealed.has(questionId))) {
    throw new J4LiveError(
      'SEALED_U8_QUESTION',
      'Active Brain first five intersects the sealed U8 population.',
    )
  }
  return {
    ...prepared,
    executionOrder,
  }
}

export function countActiveBrainWriterRequests(instance = {}) {
  return activeBrainLongMemEvalExchanges(instance).length
}

export async function runActiveBrainCompatibilitySmoke(options = {}) {
  const result = await runActiveBrainRoleSmoke(options)
  const geminiModelVersion = String(result.writerModelVersion ?? '').trim()
  if (!geminiModelVersion ||
    result.providerCalled !== true ||
    result.briefing?.complete !== true) {
    throw new J4LiveError(
      'ACTIVE_BRAIN_SMOKE_INVALID',
      'Active Brain compatibility smoke lacks complete writer/answer evidence.',
    )
  }
  return {
    geminiModelVersion,
    logicalOperations: 2,
  }
}

export function activeBrainResultPaths(
  repoRoot = ACTIVE_BRAIN_REPO_ROOT,
) {
  const resultsRoot = resolve(
    repoRoot,
    activeConfig.ACTIVE_BRAIN_LIVE_RESULTS_ROOT,
  )
  const runDir = join(
    resultsRoot,
    activeConfig.ACTIVE_BRAIN_LIVE_RUN_ID,
  )
  return {
    artifactManifestPath: join(runDir, 'artifact-manifest.json'),
    checkpointPath: join(runDir, 'checkpoint.json'),
    ledgerPath: join(runDir, 'meter.jsonl'),
    lockPath: join(
      resultsRoot,
      `${activeConfig.ACTIVE_BRAIN_LIVE_RUN_ID}.lock`,
    ),
    reportJsonPath: join(runDir, 'report.json'),
    reportMarkdownPath: join(runDir, 'report.md'),
    resultsRoot,
    runDir,
    transcriptDirectory: join(runDir, 'transcripts'),
  }
}

function assertFiveRunPredecessorChain(predecessorChain) {
  if (!predecessorChain ||
    !Array.isArray(predecessorChain.runs) ||
    predecessorChain.runs.length !== 5 ||
    predecessorChain.runs.at(-1)?.runId !==
      'j4-longmemeval-s60-v5') {
    throw new J4LiveError(
      'PREDECESSOR_SCHEMA',
      'Active Brain requires the exact terminal J4 v1-v5 chain.',
    )
  }
  return predecessorChain
}

export function buildActiveBrainIdentity({
  config,
  configSha256,
  datasetSha256,
  predictionsSha256,
} = {}) {
  const hashes = [configSha256, datasetSha256, predictionsSha256]
  const promptHashes = Object.values(config?.prompts ?? {})
  if (!config ||
    hashes.some((value) =>
      !/^[a-f0-9]{64}$/.test(String(value ?? ''))) ||
    promptHashes.length < 1 ||
    promptHashes.some((value) =>
      !/^[a-f0-9]{64}$/.test(String(value ?? ''))) ||
    !config.models ||
    typeof config.models !== 'object' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(String(config.runDate ?? '')) ||
    !Array.isArray(config.artifacts) ||
    !Number.isFinite(config.predecessorChain?.openingAccountedUsd)) {
    throw new J4LiveError(
      'ACTIVE_IDENTITY_INPUT',
      'Active Brain identity requires frozen config, dataset, and predictions.',
    )
  }
  const artifacts = config.artifacts.map((entry) => ({
    path: entry.path,
    sha256: entry.sha256,
  }))
  return {
    artifactSetSha256:
      activeConfig.activeBrainSha256(JSON.stringify(artifacts)),
    configSha256,
    datasetSha256,
    models: cloneJson(config.models),
    openingAccountedUsd: config.predecessorChain.openingAccountedUsd,
    predecessorChain: cloneJson(config.predecessorChain),
    predictionsSha256,
    provenance: {
      configSha256,
      datasetSha256,
      models: cloneJson(config.models),
      predictionsSha256,
      promptContractSha256: cloneJson(config.prompts),
      runDate: config.runDate,
    },
    questionIdsSha256: config.population.questionIdsSha256,
    runId: config.runId,
    schemaVersion: 1,
  }
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value))
}

export function buildActiveBrainCheckpoint({
  identity,
  population,
  predictions,
} = {}) {
  if (!identity ||
    !Array.isArray(population?.executionOrder) ||
    population.executionOrder.length !== 5 ||
    !Array.isArray(predictions?.predictions) ||
    predictions.predictions.length !== 5) {
    throw new J4LiveError(
      'ACTIVE_CHECKPOINT_INPUT',
      'Active Brain checkpoint requires the exact five-question plan.',
    )
  }
  const predictionById = new Map(
    predictions.predictions.map((entry) => [entry.questionId, entry]),
  )
  return {
    events: [],
    identity: cloneJson(identity),
    invocations: [],
    meter: null,
    questions: population.executionOrder.map((instance, index) => ({
      isAbstention: instance.isAbstention,
      ordinal: index + 1,
      prediction: cloneJson(predictionById.get(instance.questionId)),
      questionId: instance.questionId,
      questionType: instance.questionType,
      resultFile: null,
      resultSha256: null,
      status: 'pending',
      workspace: join(
        'workspaces',
        `${String(index + 1).padStart(2, '0')}-${instance.questionId}`,
      ),
    })),
    schemaVersion: 1,
    smoke: {
      completedAt: null,
      geminiModelVersion: null,
      logicalOperations: 0,
      startedAt: null,
      status: 'pending',
    },
    status: 'ready',
  }
}

function assertActiveAuthority(authority, checkpoint, config) {
  if (!authority ||
    authority.runId !== config.runId ||
    authority.fromCumulativeQuestions !== 0 ||
    authority.previousCheckpointSha256 !== null ||
    authority.cumulativeQuestions !== 5 ||
    authority.cumulativeCapUsd !== 7 ||
    checkpoint.questions.length !== 5 ||
    checkpoint.questions.some((cell) => cell.status !== 'pending') ||
    config.tranches.length !== 1 ||
    config.tranches[0].questions !== 5) {
    throw new J4LiveError(
      'ACTIVE_AUTHORITY_SCOPE',
      'Active Brain authority must select one fresh five-question run.',
    )
  }
}

async function sha256File(path) {
  return activeConfig.activeBrainSha256(await readFile(path))
}

export async function verifyActiveBrainFiveRunPredecessor({
  predecessorChain,
  repoRoot,
} = {}) {
  const chain = assertFiveRunPredecessorChain(predecessorChain)
  const v5 = chain.runs[4]
  const firstFourChain = {
    openingAccountedUsd: v5.openingAccountedUsd,
    runs: chain.runs.slice(0, 4),
  }
  const firstFour = await verifyJ4PredecessorBundle({
    predecessorChain: firstFourChain,
    repoRoot,
  })
  const trackedEntries = Object.entries({
    authority: [
      v5.tracked.authorityPath,
      v5.tracked.authoritySha256,
    ],
    config: [v5.tracked.configPath, v5.tracked.configSha256],
    predictions: [
      v5.tracked.predictionsPath,
      v5.tracked.predictionsSha256,
    ],
  })
  for (const [label, [path, expected]] of trackedEntries) {
    if (await sha256File(resolve(repoRoot, path)) !== expected) {
      throw new J4LiveError(
        'ACTIVE_PREDECESSOR_HASH',
        `Terminal V5 ${label} bytes changed.`,
      )
    }
  }
  const privateEntries = Object.entries({
    manifest: [
      v5.private.artifactManifestPath,
      v5.private.artifactManifestSha256,
    ],
    checkpoint: [
      v5.private.checkpointPath,
      v5.private.checkpointSha256,
    ],
    meter: [v5.private.meterPath, v5.private.meterSha256],
  })
  for (const [label, [path, expected]] of privateEntries) {
    const absolute = resolve(repoRoot, path)
    const metadata = await lstat(absolute)
    if (!metadata.isFile() ||
      (metadata.mode & 0o777) !== 0o600 ||
      await sha256File(absolute) !== expected) {
      throw new J4LiveError(
        'ACTIVE_PREDECESSOR_HASH',
        `Terminal V5 ${label} evidence changed.`,
      )
    }
  }
  await verifyJ4ArtifactManifest(resolve(
    repoRoot,
    `evals/results/${v5.runId}`,
  ))
  const checkpoint = JSON.parse(await readFile(
    resolve(repoRoot, v5.private.checkpointPath),
    'utf8',
  ))
  const completed = checkpoint.questions?.filter((cell) =>
    cell.status === 'completed').length
  const pending = checkpoint.questions?.filter((cell) =>
    cell.status === 'pending').length
  if (checkpoint.identity?.runId !== v5.runId ||
    checkpoint.status !== 'paused' ||
    checkpoint.smoke?.status !== 'completed' ||
    Number(checkpoint.smoke?.logicalOperations) !==
      v5.smokeLogicalOperations ||
    completed !== 5 ||
    pending !== 55 ||
    checkpoint.meter?.attempts !== v5.attempts ||
    !sameJson(
      checkpoint.meter?.logicalRequests,
      v5.logicalRequests,
    ) ||
    !sameUsd(
      checkpoint.meter?.accounted?.usd,
      v5.currentRunAccountedUsd,
    ) ||
    !sameUsd(
      checkpoint.predecessorAudit?.accountedUsd,
      firstFour.accountedUsd,
    ) ||
    !sameUsd(v5.openingAccountedUsd, firstFour.accountedUsd)) {
    throw new J4LiveError(
      'ACTIVE_PREDECESSOR_CHECKPOINT',
      'Terminal V5 checkpoint differs from its frozen profile.',
    )
  }
  const v5Measured = Number(checkpoint.meter.measured?.usd)
  const v5Uncertain = Number(checkpoint.meter.uncertain?.usd)
  const accountedUsd =
    Number((firstFour.accountedUsd +
      v5.currentRunAccountedUsd).toFixed(12))
  const measuredUsd =
    Number((firstFour.measuredUsd + v5Measured).toFixed(12))
  const uncertainUsd =
    Number((firstFour.uncertainUsd + v5Uncertain).toFixed(12))
  if (!sameUsd(accountedUsd, chain.openingAccountedUsd) ||
    !sameUsd(measuredUsd + uncertainUsd, accountedUsd)) {
    throw new J4LiveError(
      'ACTIVE_PREDECESSOR_SPEND',
      'V1-V5 measured and uncertain spend does not reconcile.',
    )
  }
  return {
    accountedUsd,
    measuredUsd,
    runs: [...firstFour.runs, {
      accountedUsd,
      checkpointSha256: v5.private.checkpointSha256,
      completedQuestions: 5,
      currentRunAccountedUsd: v5.currentRunAccountedUsd,
      measuredUsd,
      runId: v5.runId,
      uncertainUsd,
    }],
    uncertainUsd,
  }
}

const usageFields = Object.freeze([
  'geminiInputTokens',
  'geminiOutputTokens',
  'judgeInputTokens',
  'judgeOutputTokens',
  'usd',
])

function usageDelta(after = {}, before = {}) {
  return Object.fromEntries(usageFields.map((field) => [
    field,
    Number(after[field] ?? 0) - Number(before[field] ?? 0),
  ]))
}

function questionMeterEvidence(before, after) {
  const purposeNames = new Set([
    ...Object.keys(before.logicalRequests ?? {}),
    ...Object.keys(after.logicalRequests ?? {}),
  ])
  return {
    accountedDelta: usageDelta(after.accounted, before.accounted),
    attempts: Number(after.attempts ?? 0) - Number(before.attempts ?? 0),
    cumulativeAccounted: cloneJson(after.accounted),
    cumulativeMeasured: cloneJson(after.measured),
    logicalRequests: Object.fromEntries(
      [...purposeNames].sort().map((purpose) => [
        purpose,
        Number(after.logicalRequests?.[purpose] ?? 0) -
          Number(before.logicalRequests?.[purpose] ?? 0),
      ]),
    ),
    measuredDelta: usageDelta(after.measured, before.measured),
    retries: (after.retries ?? []).slice((before.retries ?? []).length),
    sequence: Number(after.sequence ?? 0) - Number(before.sequence ?? 0),
    uncertainDelta: usageDelta(after.uncertain, before.uncertain),
  }
}

function assertQuestionMeterEvidence({
  evidence,
  expectedAnswerRequests,
  expectedWriterRequests,
  freshCapUsd,
}) {
  const logical = evidence.logicalRequests
  const total =
    Number(logical.writer ?? 0) +
    Number(logical.answer ?? 0) +
    Number(logical.judge ?? 0)
  if (Number(logical.writer ?? 0) !== expectedWriterRequests ||
    Number(logical.answer ?? 0) !== expectedAnswerRequests ||
    Number(logical.judge ?? 0) !== 1 ||
    evidence.attempts !== total + evidence.retries.length ||
    evidence.sequence !== evidence.attempts * 2) {
    throw new J4LiveError(
      'ACTIVE_QUESTION_CARDINALITY',
      'Active Brain question request or retry counts differ.',
    )
  }
  for (const field of usageFields) {
    const accounted = Number(evidence.accountedDelta[field])
    const measured = Number(evidence.measuredDelta[field])
    const uncertain = Number(evidence.uncertainDelta[field])
    if (![accounted, measured, uncertain].every((value) =>
      Number.isFinite(value) && value >= 0) ||
      Math.abs(accounted - measured - uncertain) > 1e-9) {
      throw new J4LiveError(
        'ACTIVE_QUESTION_USAGE',
        'Active Brain question usage does not reconcile.',
      )
    }
  }
  if (evidence.measuredDelta.geminiInputTokens <= 0 ||
    evidence.measuredDelta.geminiOutputTokens <= 0 ||
    evidence.measuredDelta.judgeInputTokens <= 0 ||
    evidence.measuredDelta.judgeOutputTokens <= 0 ||
    evidence.cumulativeAccounted.usd > freshCapUsd + 1e-12) {
    throw new J4LiveError(
      'ACTIVE_QUESTION_USAGE',
      'Active Brain question lacks measured usage or exceeds its cap.',
    )
  }
  return evidence
}

function observedFailureStage(instance, armResult, correct) {
  if (correct) return 'none'
  if (armResult.briefing?.status === 'capacity_exceeded') {
    return 'capacity'
  }
  if (!instance.isAbstention &&
    (Number(armResult.ingest?.memoryRows ?? 0) === 0 ||
      armResult.retrieval?.complete?.all !== true)) {
    return 'write'
  }
  return 'answer'
}

function buildQuestionResult({
  armResult,
  instance,
  judgeResponse,
  meter,
  prediction,
  provenance,
}) {
  const correct = parseLongMemEvalJudgeLabel(judgeResponse.text)
  const failureStage = observedFailureStage(
    instance,
    armResult,
    correct,
  )
  return {
    answer: armResult.answer,
    answerModelVersion: armResult.answerModelVersion,
    briefing: armResult.briefing,
    ingest: armResult.ingest,
    isAbstention: instance.isAbstention,
    judge: {
      correct,
      modelVersion: judgeResponse.modelVersion,
      response: judgeResponse.text,
    },
    memoryEvidence: armResult.memoryEvidence,
    meter,
    observedFailureStage: failureStage,
    prediction: {
      matched:
        prediction.predictedOfficialCorrect === correct &&
        prediction.predictedFailureStage === failureStage,
      predictedFailureStage: prediction.predictedFailureStage,
      predictedOfficialCorrect: prediction.predictedOfficialCorrect,
    },
    provenance: cloneJson(provenance),
    promptSha256: armResult.promptSha256,
    providerCalled: armResult.providerCalled,
    questionId: instance.questionId,
    questionType: instance.questionType,
    retrieval: armResult.retrieval,
    schemaVersion: 1,
    sourceCoverage: armResult.sourceCoverage,
  }
}

function checkpointEvent(checkpoint, status, timestamp, questionId = null) {
  checkpoint.events.push({ questionId, status, timestamp })
}

async function validateCompletedResults(checkpoint, population, runDir) {
  const results = []
  for (let index = 0; index < checkpoint.questions.length; index += 1) {
    const cell = checkpoint.questions[index]
    if (cell.status !== 'completed') continue
    const text = await readFile(join(runDir, cell.resultFile), 'utf8')
    if (activeConfig.activeBrainSha256(text) !== cell.resultSha256) {
      throw new J4LiveError(
        'ACTIVE_RESULT_HASH',
        'Active Brain result differs from its checkpoint hash.',
      )
    }
    const result = JSON.parse(text)
    const instance = population.executionOrder[index]
    if (result.schemaVersion !== 1 ||
      result.questionId !== instance.questionId ||
      result.questionType !== instance.questionType ||
      !sameJson(result.provenance, checkpoint.identity.provenance) ||
      typeof result.judge?.correct !== 'boolean') {
      throw new J4LiveError(
        'ACTIVE_RESULT_SCHEMA',
        'Active Brain result differs from its frozen question.',
      )
    }
    results.push(result)
  }
  return results
}

function renderActiveReport(report) {
  const lines = [
    '# Active Palari Brain private LongMemEval report',
    '',
    `> ${report.disclaimer}`,
    '',
    `- Status: ${report.status}`,
    `- Completed questions: ${report.completedQuestions}`,
    `- Preliminary official accuracy: ${report.officialAccuracy.correct}/${report.officialAccuracy.total}`,
    `- Combined accounted spend: $${report.spend.combinedAccountedUsd.toFixed(7)}`,
    `- Combined measured spend: $${report.spend.combinedMeasuredUsd.toFixed(7)}`,
    `- Provider retries: ${report.meter?.retries?.length ?? 0}`,
    `- Run date: ${report.provenance.runDate}`,
    `- Dataset SHA-256: ${report.provenance.datasetSha256}`,
    `- Config SHA-256: ${report.provenance.configSha256}`,
    `- Predictions SHA-256: ${report.provenance.predictionsSha256}`,
    '',
    '## Misses first',
    '',
  ]
  const misses = report.missesFirst.filter((entry) => !entry.judge.correct)
  if (!misses.length) lines.push('- None.')
  for (const result of misses) {
    lines.push(
      `- ${result.questionId} (${result.questionType}) — ` +
      result.observedFailureStage,
    )
  }
  lines.push('', '## Correct completed questions', '')
  const correct = report.missesFirst.filter((entry) => entry.judge.correct)
  if (!correct.length) lines.push('- None.')
  for (const result of correct) {
    lines.push(`- ${result.questionId} (${result.questionType})`)
  }
  return `${lines.join('\n')}\n`
}

export async function writeActiveBrainTerminalArtifacts({
  checkpoint,
  forbiddenSecrets,
  paths,
  population,
  transport,
}) {
  const verified = await transport.verify()
  const meter = verified.ledger
  checkpoint.meter = meter
  checkpoint.transcriptAudit = verified.transcripts
  const results = await validateCompletedResults(
    checkpoint,
    population,
    paths.runDir,
  )
  const report = {
    ...buildJ4PrivateReport({ checkpoint, meter, results }),
    provenance: cloneJson(checkpoint.identity.provenance),
  }
  const reportJson = `${JSON.stringify(report, null, 2)}\n`
  const reportMarkdown = renderActiveReport(report)
  await atomicWriteJ4(paths.reportJsonPath, reportJson)
  await atomicWriteJ4(paths.reportMarkdownPath, reportMarkdown)
  checkpoint.report = {
    json: relative(paths.runDir, paths.reportJsonPath),
    jsonSha256: activeConfig.activeBrainSha256(reportJson),
    markdown: relative(paths.runDir, paths.reportMarkdownPath),
    markdownSha256: activeConfig.activeBrainSha256(reportMarkdown),
  }
  await writeCheckpoint(paths.checkpointPath, checkpoint)
  const artifacts = await collectJ4PrivateArtifacts(paths.runDir, {
    forbiddenSecrets,
  })
  await atomicWriteJ4(
    paths.artifactManifestPath,
    `${JSON.stringify({
      artifacts,
      generatedAt: new Date().toISOString(),
      runId: checkpoint.identity.runId,
      schemaVersion: 1,
    }, null, 2)}\n`,
  )
  return report
}

export async function executeActiveBrainFirstFive({
  administrativeHead,
  authority,
  authoritySha256,
  checkpoint,
  config,
  forbiddenSecrets,
  identity,
  now = () => new Date().toISOString(),
  paths,
  population,
  runQuestion = runActiveBrainLongMemEvalQuestion,
  runSmoke = runActiveBrainCompatibilitySmoke,
  transport,
}) {
  assertActiveAuthority(authority, checkpoint, config)
  checkpoint.invocations.push({
    administrativeHead,
    authoritySha256,
    availableCurrentRunCapUsd:
      authority.cumulativeCapUsd - identity.openingAccountedUsd,
    capUsd: authority.cumulativeCapUsd,
    openingAccountedUsd: identity.openingAccountedUsd,
    startedAt: isoNow(now),
    targetQuestions: 5,
  })
  checkpoint.status = 'running'
  await writeCheckpoint(paths.checkpointPath, checkpoint)

  checkpoint.smoke.status = 'in_progress'
  checkpoint.smoke.startedAt = isoNow(now)
  checkpointEvent(
    checkpoint,
    'smoke_in_progress',
    checkpoint.smoke.startedAt,
  )
  await writeCheckpoint(paths.checkpointPath, checkpoint)
  try {
    const smoke = await runSmoke({
      callGemini: transport.callGemini,
      workspaceDir: join(paths.runDir, 'smoke-workspace'),
    })
    const verified = await transport.verify()
    checkpoint.meter = verified.ledger
    checkpoint.smoke = {
      ...checkpoint.smoke,
      ...smoke,
      completedAt: isoNow(now),
      status: 'completed',
    }
    checkpointEvent(
      checkpoint,
      'smoke_completed',
      checkpoint.smoke.completedAt,
    )
    await writeCheckpoint(paths.checkpointPath, checkpoint)
    await collectJ4PrivateArtifacts(paths.runDir, { forbiddenSecrets })
  } catch (error) {
    checkpoint.smoke.status = 'failed'
    checkpoint.smoke.failedAt = isoNow(now)
    checkpoint.status = 'failed'
    checkpoint.failure = sanitizedError(error, forbiddenSecrets)
    await writeCheckpoint(paths.checkpointPath, checkpoint)
    throw error
  }

  for (let index = 0; index < 5; index += 1) {
    const cell = checkpoint.questions[index]
    const instance = population.executionOrder[index]
    if (cell.status !== 'pending' ||
      instance.questionId !== cell.questionId) {
      throw new J4LiveError(
        'ACTIVE_QUESTION_NOT_PENDING',
        'Active Brain refuses to rerun or reorder a question.',
      )
    }
    const workspaceDir = join(paths.runDir, cell.workspace)
    if (await exists(workspaceDir)) {
      throw new J4LiveError(
        'ACTIVE_STALE_WORKSPACE',
        'Active Brain pending question already has a workspace.',
      )
    }
    cell.status = 'in_progress'
    cell.startedAt = isoNow(now)
    checkpointEvent(
      checkpoint,
      'in_progress',
      cell.startedAt,
      cell.questionId,
    )
    const meterBefore = await transport.snapshot()
    checkpoint.meter = meterBefore
    await writeCheckpoint(paths.checkpointPath, checkpoint)
    try {
      const armResult = await runQuestion({
        callGemini: transport.callGemini,
        instance,
        workspaceDir,
      })
      if (armResult.providerCalled &&
        armResult.answerModelVersion !==
          checkpoint.smoke.geminiModelVersion) {
        throw new J4LiveError(
          'ACTIVE_MODEL_VERSION',
          'Active Brain answer modelVersion differs from its smoke.',
        )
      }
      const judgeResponse = assertValidatedJ4JudgeResponse(
        await transport.callJudge({
          body: buildJ4JudgeBody(instance, armResult.answer),
          cellId: instance.questionId,
          model: LONGMEMEVAL_JUDGE_MODEL,
          operationId: `question:${instance.questionId}:judge`,
          purpose: 'judge',
        }),
      )
      const meterAfter = await transport.snapshot()
      const evidence = assertQuestionMeterEvidence({
        evidence: questionMeterEvidence(meterBefore, meterAfter),
        expectedAnswerRequests: armResult.providerCalled ? 1 : 0,
        expectedWriterRequests:
          countActiveBrainWriterRequests(instance),
        freshCapUsd: activeConfig.ACTIVE_BRAIN_FRESH_METER_CAP_USD,
      })
      if (Number(armResult.ingest?.exchanges) !==
        countActiveBrainWriterRequests(instance)) {
        throw new J4LiveError(
          'ACTIVE_WRITER_CARDINALITY',
          'Active Brain observations differ from canonical exchanges.',
        )
      }
      const result = buildQuestionResult({
        armResult,
        instance,
        judgeResponse,
        meter: evidence,
        prediction: cell.prediction,
        provenance: checkpoint.identity.provenance,
      })
      const resultFile = join(
        'questions',
        `${String(cell.ordinal).padStart(2, '0')}-${cell.questionId}.json`,
      )
      const resultText = `${JSON.stringify(result, null, 2)}\n`
      await atomicWriteJ4(join(paths.runDir, resultFile), resultText)
      cell.resultFile = resultFile
      cell.resultSha256 = activeConfig.activeBrainSha256(resultText)
      checkpoint.meter = meterAfter
      await writeCheckpoint(paths.checkpointPath, checkpoint)
      await transport.verify()
      await collectJ4PrivateArtifacts(paths.runDir, { forbiddenSecrets })
      cell.completedAt = isoNow(now)
      cell.status = 'completed'
      checkpointEvent(
        checkpoint,
        'completed',
        cell.completedAt,
        cell.questionId,
      )
      checkpoint.meter = await transport.snapshot()
      await writeCheckpoint(paths.checkpointPath, checkpoint)

      if (!instance.isAbstention &&
        (Number(result.ingest?.memoryRows ?? 0) === 0 ||
          result.briefing?.status === 'capacity_exceeded')) {
        checkpoint.pauseReason =
          result.briefing?.status === 'capacity_exceeded'
            ? 'MEMORY_CAPACITY_EXCEEDED'
            : 'ZERO_ADMITTED_MEMORIES'
        checkpoint.status = 'paused'
        checkpoint.pausedAt = isoNow(now)
        break
      }
    } catch (error) {
      cell.status = 'failed'
      cell.failedAt = isoNow(now)
      cell.error = sanitizedError(error, forbiddenSecrets)
      checkpoint.failure = cell.error
      checkpoint.status = 'failed'
      checkpoint.meter =
        await transport.snapshot().catch(() => checkpoint.meter)
      checkpointEvent(
        checkpoint,
        'failed',
        cell.failedAt,
        cell.questionId,
      )
      await writeCheckpoint(paths.checkpointPath, checkpoint)
      throw error
    }
  }
  if (checkpoint.status === 'running') {
    if (checkpoint.questions.some((cell) =>
      cell.status !== 'completed')) {
      throw new J4LiveError(
        'ACTIVE_BOUNDARY_MISSED',
        'Active Brain did not complete its exact five-question boundary.',
      )
    }
    checkpoint.status = 'complete'
    checkpoint.pauseReason = null
    checkpoint.completedAt = isoNow(now)
  }
  const invocation = checkpoint.invocations.at(-1)
  invocation.completedAt = isoNow(now)
  invocation.completedQuestions = checkpoint.questions.filter((cell) =>
    cell.status === 'completed').length
  const report = await writeActiveBrainTerminalArtifacts({
    checkpoint,
    forbiddenSecrets,
    paths,
    population,
    transport,
  })
  return { checkpoint, report }
}

export async function main({
  args = process.argv.slice(2),
  dependencies = {},
  env = process.env,
  repoRoot = ACTIVE_BRAIN_REPO_ROOT,
} = {}) {
  const runId = parseActiveBrainLiveArgs(args)

  // Historical identities must fail before dependencies, files, or secrets.
  assertActiveBrainLiveRunOpen(runId)

  const read = dependencies.readFile ?? readFile
  const preparePopulation =
    dependencies.preparePopulation ?? prepareJ4PinnedS60
  const loadConfig =
    dependencies.loadConfig ?? activeConfig.loadActiveBrainLiveConfig
  const loadAuthority =
    dependencies.loadAuthority ?? activeConfig.loadActiveBrainLiveAuthority
  const inspectGit =
    dependencies.inspectGitCutPoint ?? inspectJ4GitCutPoint
  const assertEnvironment =
    dependencies.assertEnvironment ??
    activeConfig.assertActiveBrainLiveEnvironment
  const meterFactory =
    dependencies.createMeteredTransport ??
    createActiveBrainMeteredTransport
  const auditTrackedFiles =
    dependencies.auditTrackedFiles ?? auditJ4TrackedFiles
  const verifyPredecessor =
    dependencies.verifyPredecessor ??
    verifyActiveBrainFiveRunPredecessor
  const runQuestion =
    dependencies.runQuestion ?? runActiveBrainLongMemEvalQuestion
  const runSmoke =
    dependencies.runSmoke ?? runActiveBrainCompatibilitySmoke
  const executeTranche =
    dependencies.executeTranche ?? executeActiveBrainFirstFive
  const writeTerminalArtifacts =
    dependencies.writeTerminalArtifacts ??
    writeActiveBrainTerminalArtifacts
  const pathExists = dependencies.exists ?? exists
  const log = dependencies.log ?? console.log

  const paths = activeBrainResultPaths(repoRoot)

  // Canonical data, tracked configuration, git state, authority, and all five
  // predecessor bundles are verified before either credential is read.
  const rawDataset = await read(
    resolve(repoRoot, 'data/longmemeval_s_cleaned.json'),
  )
  const population = activeBrainFirstFivePopulation(
    preparePopulation({ raw: rawDataset }),
  )
  const loaded = await loadConfig({ repoRoot })
  const loadedAuthority = await loadAuthority({ repoRoot })
  const identity = buildActiveBrainIdentity({
    config: loaded.config,
    configSha256: loaded.configSha256,
    datasetSha256: population.manifest.datasetSha256,
    predictionsSha256: loaded.predictionsSha256,
  })
  const repositoryPath = (path) =>
    relative(repoRoot, resolve(repoRoot, path))
  const artifactPaths = [...new Set([
    ...loaded.config.artifacts.map((entry) => entry.path),
    loaded.configPath,
    loaded.config.predictions.path,
  ].map(repositoryPath))]
  const authorityPath = repositoryPath(loadedAuthority.authorityPath)
  const git = await inspectGit({
    artifactPaths,
    authorityPath,
    env,
    repoRoot,
    runDir: paths.runDir,
  })
  const lock = await acquireJ4RunLock(paths.lockPath)
  let previousUmask
  try {
    if (await pathExists(paths.runDir)) {
      throw new J4LiveError(
        'ACTIVE_RUN_ALREADY_EXISTS',
        'Active Brain refuses to resume, replace, or overlay this run.',
      )
    }
    const checkpoint = buildActiveBrainCheckpoint({
      identity,
      population,
      predictions: loaded.predictions,
    })
    assertActiveAuthority(
      loadedAuthority.authority,
      checkpoint,
      loaded.config,
    )
    const predecessorChain = assertFiveRunPredecessorChain(
      loaded.config.predecessorChain,
    )
    const predecessorAudit = await verifyPredecessor({
      predecessorChain,
      repoRoot,
    })
    if (!sameUsd(
      predecessorAudit.accountedUsd,
      checkpoint.identity.openingAccountedUsd,
    )) {
      throw new J4LiveError(
        'PREDECESSOR_OPENING_SPEND_MISMATCH',
        'Active Brain predecessor spend differs from immutable opening spend.',
      )
    }
    checkpoint.predecessorAudit = {
      ...predecessorAudit,
      completedAt: isoNow(),
    }

    // This is the first point at which either provider key may be read.
    const runtime = assertEnvironment(
      env,
      loaded.config,
      loadedAuthority.authority,
    )
    const secrets = [runtime.geminiApiKey, runtime.openaiApiKey]
    for (const name of J4_GOOGLE_CREDENTIAL_ALIASES) {
      env[name] = J4_DENY_GEMINI_KEY
    }
    env.OPENAI_API_KEY = J4_DENY_OPENAI_KEY
    const trackedSecretAudit = await auditTrackedFiles({
      env,
      forbiddenSecrets: secrets,
      repoRoot,
    })
    checkpoint.trackedSecretAudits = [{
      ...trackedSecretAudit,
      administrativeHead: git.administrativeHead,
      completedAt: isoNow(),
    }]

    previousUmask = process.umask(0o077)
    await mkdir(paths.runDir, { recursive: true, mode: 0o700 })
    await chmod(paths.runDir, 0o700)
    await mkdir(paths.transcriptDirectory, {
      recursive: true,
      mode: 0o700,
    })
    await chmod(paths.transcriptDirectory, 0o700)
    await writeCheckpoint(paths.checkpointPath, checkpoint)

    const availableCurrentRunCapUsd =
      runtime.capUsd - predecessorAudit.accountedUsd
    if (!Number.isFinite(availableCurrentRunCapUsd) ||
      availableCurrentRunCapUsd <= 0 ||
      !sameUsd(
        availableCurrentRunCapUsd,
        activeConfig.ACTIVE_BRAIN_FRESH_METER_CAP_USD,
      )) {
      throw new J4LiveError(
        'PREDECESSOR_SPEND_CAP',
        'Active Brain predecessor spend leaves the wrong fresh meter cap.',
      )
    }
    const transport = await meterFactory({
      capUsd: availableCurrentRunCapUsd,
      answerGeneration:
        activeConfig.ACTIVE_BRAIN_ANSWER_GENERATION,
      geminiApiKey: runtime.geminiApiKey,
      geminiModel: activeConfig.ACTIVE_BRAIN_GEMINI_MODEL,
      writerGeneration:
        activeConfig.ACTIVE_BRAIN_WRITER_GENERATION,
      journalPath: paths.ledgerPath,
      limits: activeConfig.ACTIVE_BRAIN_FIRST5_LIMITS,
      openaiApiKey: runtime.openaiApiKey,
      transcriptDirectory: paths.transcriptDirectory,
    })
    transport.installNetworkGuard()
    try {
      const execution = await executeTranche({
        administrativeHead: git.administrativeHead,
        authority: loadedAuthority.authority,
        authoritySha256: loadedAuthority.authoritySha256,
        checkpoint,
        config: loaded.config,
        forbiddenSecrets: secrets,
        identity,
        paths,
        population,
        runQuestion,
        runSmoke,
        transport,
      })
      log(
        `Active Brain completed ${execution.report.completedQuestions} ` +
        `questions; private report: ${paths.reportMarkdownPath}`,
      )
      return execution
    } catch (error) {
      checkpoint.status = 'failed'
      checkpoint.failure ??= sanitizedError(error, secrets)
      checkpoint.failedAt ??= isoNow()
      const currentInvocation = checkpoint.invocations.at(-1)
      if (currentInvocation) {
        currentInvocation.completedAt ??= checkpoint.failedAt
        currentInvocation.completedQuestions ??=
          checkpoint.questions.filter((cell) =>
            cell.status === 'completed').length
      }
      try {
        await writeTerminalArtifacts({
          checkpoint,
          forbiddenSecrets: secrets,
          paths,
          population,
          transport,
        })
      } catch (bundleError) {
        checkpoint.failureBundle =
          sanitizedError(bundleError, secrets)
        await writeCheckpoint(paths.checkpointPath, checkpoint)
          .catch(() => {})
      }
      throw error
    } finally {
      transport.closeNetworkGuard()
    }
  } finally {
    if (previousUmask !== undefined) process.umask(previousUmask)
    await lock.release()
  }
}

const invoked = process.argv[1] ? resolve(process.argv[1]) : ''
if (invoked === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(
      `${error?.code ?? 'ACTIVE_BRAIN_LIVE_FAILED'}: ` +
      `${error?.message ?? 'Active Brain live run failed.'}`,
    )
    process.exitCode = 1
  })
}

// One-shot founder-gated LongMemEval runner for canonical dialogue evidence.
//
// The optional writer is disabled. Every visible user/Palari message is
// stored locally by the host, and the only permitted live operations are an
// answer call when the complete briefing fits plus one official judge call
// for every attempted question. The first capacity refusal is graded,
// checkpointed, and then stops the run before the next question.

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
  runCanonicalFirst5LongMemEvalQuestion,
} from './arms/canonical-first5-live-arm.mjs'
import * as first5Config from './canonical-first5-live-config.mjs'
import {
  loadCanonicalEvidenceSmokeConfig,
} from './canonical-evidence-smoke-config.mjs'
import {
  parseLongMemEvalJudgeLabel,
} from './longmemeval-judge.mjs'
import {
  J4_FIRST_TRANCHE_QUESTION_IDS,
  prepareJ4PinnedS60,
  SEALED_U8_QUESTION_IDS,
} from './longmemeval-plan.mjs'
import {
  acquireJ4RunLock,
  assertValidatedJ4JudgeResponse,
  atomicWriteJ4,
  auditJ4TrackedFiles,
  buildJ4JudgeBody,
  buildJ4QuestionMeterEvidence,
  collectJ4PrivateArtifacts,
  inspectJ4GitCutPoint,
  J4_DENY_GEMINI_KEY,
  J4_DENY_OPENAI_KEY,
  J4_GOOGLE_CREDENTIAL_ALIASES,
  verifyJ4ArtifactManifest,
} from './run-longmemeval-live.mjs'
import {
  verifyCanonicalEvidenceSmokePredecessor,
} from './run-canonical-evidence-smoke.mjs'

const here = dirname(fileURLToPath(import.meta.url))
export const CANONICAL_FIRST5_REPO_ROOT = dirname(here)
export const CANONICAL_FIRST5_RUN_ID =
  first5Config.CANONICAL_FIRST5_RUN_ID ??
  'j4-active-brain-canonical-first5-v1'

// Populated only in the post-run seal commit. Keeping this separate from the
// frozen run configuration makes the terminal runner hash the second seal.
export const CANONICAL_FIRST5_TERMINAL_RUN_IDS = Object.freeze([])
const terminalRunIds = new Set(CANONICAL_FIRST5_TERMINAL_RUN_IDS)

const EXPECTED_PREDECESSOR = Object.freeze({
  administrativeHead:
    '5bd8a27350145480a5ee9656d240b5147fb652b1',
  cumulativeAccountedUsd: 0.7727998,
  cumulativeMeasuredUsd: 0.7702988,
  cumulativeUncertainUsd: 0.002501,
  currentRunAccountedUsd: 0.0003003,
  openingAccountedUsd: 0.7724995,
  private: Object.freeze({
    checkpoint: Object.freeze({
      path:
        'evals/results/j4-active-brain-canonical-smoke-v1/checkpoint.json',
      sha256:
        '093c6c3b8aa57c8465b62624593434a4bfc86d8143b15878dfe76cd479911046',
    }),
    manifest: Object.freeze({
      path:
        'evals/results/j4-active-brain-canonical-smoke-v1/artifact-manifest.json',
      sha256:
        'be1eac7ffa17653df5a720bfb4bf2eaef05ae477df7d2f9bcf2e4c77b9644b56',
    }),
    meter: Object.freeze({
      path:
        'evals/results/j4-active-brain-canonical-smoke-v1/meter.jsonl',
      sha256:
        '234073fef643402ba4ad7d7a999b96c2684f5ed9010baed0206d4f44d52f50f1',
    }),
  }),
  runId: 'j4-active-brain-canonical-smoke-v1',
  tracked: Object.freeze({
    authority: Object.freeze({
      path:
        'evals/live-runs/j4-active-brain-canonical-smoke-v1.authority.json',
      sha256:
        'c70f45de2d3efdeceaab7008d1c6d6e5a34c8f8bebb77d7074d861aaa8d7357f',
    }),
    config: Object.freeze({
      path: 'evals/live-runs/j4-active-brain-canonical-smoke-v1.json',
      sha256:
        '28419934b34635770474aa61e156c8d2038c4a89dd858554f5029d1ce22b502c',
    }),
    predictions: Object.freeze({
      path:
        'evals/predictions/j4-active-brain-canonical-smoke-v1.json',
      sha256:
        '1d840005849d3c58a6f523fa8cff66ba2a2fcefaf409ab1b24cb611c2a89ab2c',
    }),
  }),
})

const usageFields = Object.freeze([
  'geminiInputTokens',
  'geminiOutputTokens',
  'judgeInputTokens',
  'judgeOutputTokens',
  'usd',
])

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

function sha256(value) {
  const helper =
    first5Config.canonicalFirst5Sha256 ??
    first5Config.canonicalFirst5LiveSha256
  if (typeof helper !== 'function') {
    throw new J4LiveError(
      'FIRST5_CONFIG_INTERFACE',
      'Canonical first-five config does not expose its SHA-256 helper.',
    )
  }
  return helper(value)
}

function isoNow(now = () => new Date().toISOString()) {
  const value = String(now())
  if (!value || Number.isNaN(Date.parse(value))) {
    throw new J4LiveError(
      'CLOCK_INVALID',
      'Canonical first-five clock must return an ISO timestamp.',
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
  return sha256(await readFile(path))
}

function sanitizedError(error, secrets = []) {
  let message = String(
    error?.message ?? 'Canonical first-five run failed.',
  )
  for (const secret of secrets) {
    if (secret) message = message.replaceAll(secret, '[REDACTED_SECRET]')
  }
  return {
    code: String(
      error?.code ?? error?.name ?? 'CANONICAL_FIRST5_FAILURE',
    ).slice(0, 80),
    message: message.slice(0, 240),
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function configValue(name, fallback) {
  return first5Config[name] ?? fallback
}

export function parseCanonicalFirst5Args(args = []) {
  if (args.length !== 2 ||
    args[0] !== '--run' ||
    args[1] !== CANONICAL_FIRST5_RUN_ID) {
    throw new J4LiveError(
      'RUN_ID_REQUIRED',
      'Invoke the canonical first-five runner with its exact frozen run ID.',
    )
  }
  return args[1]
}

export function assertCanonicalFirst5Open(runId) {
  if (terminalRunIds.has(runId)) {
    throw new J4LiveError(
      'J4_RUN_TERMINAL',
      `J4 run ${runId} is terminal and cannot be resumed or rerolled.`,
    )
  }
  if (runId === CANONICAL_FIRST5_RUN_ID) return runId
  throw new J4LiveError(
    'RUN_ID_REQUIRED',
    'No matching unsealed canonical first-five identity is configured.',
  )
}

export function canonicalFirst5ResultPaths(
  repoRoot = CANONICAL_FIRST5_REPO_ROOT,
) {
  const resultsRoot = resolve(
    repoRoot,
    configValue('CANONICAL_FIRST5_RESULTS_ROOT', 'evals/results'),
  )
  const runDir = join(resultsRoot, CANONICAL_FIRST5_RUN_ID)
  return {
    artifactManifestPath: join(runDir, 'artifact-manifest.json'),
    checkpointPath: join(runDir, 'checkpoint.json'),
    ledgerPath: join(runDir, 'meter.jsonl'),
    lockPath: join(resultsRoot, `${CANONICAL_FIRST5_RUN_ID}.lock`),
    questionsDir: join(runDir, 'questions'),
    reportJsonPath: join(runDir, 'report.json'),
    reportMarkdownPath: join(runDir, 'report.md'),
    resultsRoot,
    runDir,
    transcriptDirectory: join(runDir, 'transcripts'),
    workspacesDir: join(runDir, 'workspaces'),
  }
}

export function canonicalFirstFivePopulation(prepared = {}) {
  if (!Array.isArray(prepared.executionOrder) ||
    prepared.executionOrder.length !== 60 ||
    !prepared.manifest?.datasetSha256) {
    throw new J4LiveError(
      'POPULATION_COUNT',
      'Canonical first-five requires the validated S-60 population.',
    )
  }
  const executionOrder = prepared.executionOrder.slice(0, 5)
  const questionIds = executionOrder.map((entry) => entry?.questionId)
  if (!sameJson(questionIds, J4_FIRST_TRANCHE_QUESTION_IDS)) {
    throw new J4LiveError(
      'FIRST_FIVE_MISMATCH',
      'Canonical first-five order differs from the frozen sentinels.',
    )
  }
  const sealed = new Set(SEALED_U8_QUESTION_IDS)
  if (questionIds.some((questionId) => sealed.has(questionId))) {
    throw new J4LiveError(
      'SEALED_U8_QUESTION',
      'Canonical first-five intersects the sealed U8 population.',
    )
  }
  return { ...prepared, executionOrder }
}

export function createCanonicalFirst5GeminiCaller(callGemini) {
  if (typeof callGemini !== 'function') {
    throw new TypeError('Canonical first-five requires a Gemini caller.')
  }
  return async (request = {}) => {
    if (request.purpose === 'writer') {
      throw new J4LiveError(
        'WRITER_DISABLED',
        'Canonical first-five never dispatches the optional writer.',
      )
    }
    if (request.purpose !== 'answer') {
      throw new J4LiveError(
        'GEMINI_PURPOSE_DENIED',
        'Canonical first-five permits Gemini only for answers.',
      )
    }
    return callGemini(request)
  }
}

export async function auditCanonicalFirst5TrackedArtifacts({
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
        'FIRST5_ARTIFACT_PATH',
        'Canonical first-five artifact paths must be unique and local.',
      )
    }
    seen.add(repositoryPath)
    const metadata = await lstat(path)
    if (!metadata.isFile() ||
      await sha256File(path) !== artifact.sha256) {
      throw new J4LiveError(
        'FIRST5_ARTIFACT_CHANGED',
        `Canonical first-five artifact changed: ${repositoryPath}.`,
      )
    }
  }
  return {
    artifacts: seen.size,
    artifactSetSha256: sha256(JSON.stringify(config.artifacts)),
  }
}

function exactPredecessorDescriptor(config = {}) {
  const predecessor = config.predecessor
  if (!predecessor ||
    predecessor.runId !== EXPECTED_PREDECESSOR.runId ||
    predecessor.administrativeHead !==
      EXPECTED_PREDECESSOR.administrativeHead ||
    !sameUsd(
      predecessor.openingAccountedUsd,
      EXPECTED_PREDECESSOR.openingAccountedUsd,
    ) ||
    !sameUsd(
      predecessor.currentRunAccountedUsd,
      EXPECTED_PREDECESSOR.currentRunAccountedUsd,
    ) ||
    !sameUsd(
      predecessor.cumulativeAccountedUsd,
      EXPECTED_PREDECESSOR.cumulativeAccountedUsd,
    ) ||
    !sameUsd(
      predecessor.cumulativeMeasuredUsd,
      EXPECTED_PREDECESSOR.cumulativeMeasuredUsd,
    ) ||
    !sameUsd(
      predecessor.cumulativeUncertainUsd,
      EXPECTED_PREDECESSOR.cumulativeUncertainUsd,
    ) ||
    !sameJson(predecessor.tracked, EXPECTED_PREDECESSOR.tracked) ||
    !sameJson(predecessor.private, EXPECTED_PREDECESSOR.private)) {
    throw new J4LiveError(
      'FIRST5_PREDECESSOR_SCHEMA',
      'Canonical smoke predecessor identity, hashes, or spend changed.',
    )
  }
  return predecessor
}

export async function verifyCanonicalFirst5Predecessor({
  config,
  repoRoot,
} = {}) {
  const predecessor = exactPredecessorDescriptor(config)
  const oldSmoke = await loadCanonicalEvidenceSmokeConfig({ repoRoot })
  const deeper = await verifyCanonicalEvidenceSmokePredecessor({
    config: oldSmoke.config,
    repoRoot,
  })
  if (!sameUsd(
    deeper.accountedUsd,
    EXPECTED_PREDECESSOR.openingAccountedUsd,
  ) ||
    !sameUsd(
      deeper.measuredUsd,
      EXPECTED_PREDECESSOR.cumulativeMeasuredUsd -
        EXPECTED_PREDECESSOR.currentRunAccountedUsd,
    ) ||
    !sameUsd(
      deeper.uncertainUsd,
      EXPECTED_PREDECESSOR.cumulativeUncertainUsd,
    )) {
    throw new J4LiveError(
      'FIRST5_DEEP_PREDECESSOR',
      'The active-v1 and deeper J4 chain no longer reconciles.',
    )
  }

  for (const entry of Object.values(predecessor.tracked)) {
    if (await sha256File(resolve(repoRoot, entry.path)) !==
      entry.sha256) {
      throw new J4LiveError(
        'FIRST5_PREDECESSOR_HASH',
        'Canonical smoke tracked evidence changed.',
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
        'FIRST5_PREDECESSOR_HASH',
        'Canonical smoke private evidence changed.',
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
    checkpoint.status !== 'complete' ||
    checkpoint.questions?.length !== 0 ||
    checkpoint.smoke?.status !== 'completed' ||
    checkpoint.smoke?.logicalOperations !== 2 ||
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
    checkpoint.trackedSecretAudit?.administrativeHead !==
      predecessor.administrativeHead) {
    throw new J4LiveError(
      'FIRST5_PREDECESSOR_CHECKPOINT',
      'Canonical smoke checkpoint differs from its terminal profile.',
    )
  }
  const accountedUsd = Number((
    deeper.accountedUsd + checkpoint.meter.accounted.usd
  ).toFixed(12))
  const measuredUsd = Number((
    deeper.measuredUsd + checkpoint.meter.measured.usd
  ).toFixed(12))
  const uncertainUsd = Number((
    deeper.uncertainUsd + checkpoint.meter.uncertain.usd
  ).toFixed(12))
  if (!sameUsd(
    accountedUsd,
    predecessor.cumulativeAccountedUsd,
  ) ||
    !sameUsd(measuredUsd, predecessor.cumulativeMeasuredUsd) ||
    !sameUsd(uncertainUsd, predecessor.cumulativeUncertainUsd)) {
    throw new J4LiveError(
      'FIRST5_PREDECESSOR_SPEND',
      'Canonical smoke cumulative spend does not reconcile.',
    )
  }
  return {
    accountedUsd,
    canonicalSmokeCheckpointSha256:
      predecessor.private.checkpoint.sha256,
    canonicalSmokeManifestSha256:
      predecessor.private.manifest.sha256,
    canonicalSmokeMeterSha256:
      predecessor.private.meter.sha256,
    measuredUsd,
    runId: predecessor.runId,
    uncertainUsd,
  }
}

export function buildCanonicalFirst5Identity({
  artifactAudit,
  authoritySha256,
  config,
  configSha256,
  datasetSha256,
  predictionsSha256,
} = {}) {
  for (const value of [
    authoritySha256,
    configSha256,
    datasetSha256,
    predictionsSha256,
  ]) {
    if (!/^[a-f0-9]{64}$/.test(String(value ?? ''))) {
      throw new J4LiveError(
        'FIRST5_IDENTITY_HASH',
        'Canonical first-five identity requires exact SHA-256 values.',
      )
    }
  }
  return {
    artifactSetSha256: artifactAudit.artifactSetSha256,
    authoritySha256,
    configSha256,
    datasetSha256,
    models: clone(config.models),
    openingAccountedUsd:
      Number(config.predecessor.cumulativeAccountedUsd),
    predictionsSha256,
    productCommit: config.productCommit,
    provenance: {
      configSha256,
      datasetSha256,
      models: clone(config.models),
      predictionsSha256,
      promptContractSha256: clone(config.prompts),
      runDate: config.runDate,
    },
    questionIdsSha256: config.population.questionIdsSha256,
    runDate: config.runDate,
    runId: config.runId,
    schemaVersion: 1,
  }
}

export function buildCanonicalFirst5Checkpoint({
  identity,
  population,
  predictions,
  predecessorAudit,
} = {}) {
  if (!identity ||
    !Array.isArray(population?.executionOrder) ||
    population.executionOrder.length !== 5 ||
    !Array.isArray(predictions?.predictions) ||
    predictions.predictions.length !== 5) {
    throw new J4LiveError(
      'FIRST5_CHECKPOINT_INPUT',
      'Canonical first-five checkpoint requires five frozen questions.',
    )
  }
  const predictionById = new Map(
    predictions.predictions.map((entry) => [entry.questionId, entry]),
  )
  const questions = population.executionOrder.map((instance, index) => {
    const prediction = predictionById.get(instance.questionId)
    if (!prediction) {
      throw new J4LiveError(
        'FIRST5_PREDICTION_MISSING',
        'A frozen first-five question has no FINAL prediction.',
      )
    }
    return {
      isAbstention: instance.isAbstention,
      ordinal: index + 1,
      prediction: clone(prediction),
      questionId: instance.questionId,
      questionType: instance.questionType,
      resultFile: null,
      resultSha256: null,
      status: 'pending',
      workspace: join(
        'workspaces',
        `${String(index + 1).padStart(2, '0')}-${instance.questionId}`,
      ),
    }
  })
  return {
    events: [],
    identity,
    invocations: [],
    meter: null,
    predecessorAudit,
    questions,
    schemaVersion: 1,
    status: 'ready',
  }
}

function assertAuthority(authority, config) {
  if (!authority ||
    authority.runId !== config.runId ||
    Number(authority.cumulativeCapUsd) !== 7 ||
    Number(authority.freshSubcapUsd) !== 1 ||
    Number(authority.questions) !== 5 ||
    authority.writerEnabled !== false) {
    throw new J4LiveError(
      'FIRST5_AUTHORITY',
      'Canonical first-five authority differs from the founder GO.',
    )
  }
  return authority
}

function assertQuestionMeter({
  evidence,
  providerCalled,
  freshCapUsd,
}) {
  const logical = evidence.logicalRequests ?? {}
  const answerCalls = providerCalled ? 1 : 0
  const logicalTotal =
    Number(logical.answer ?? 0) +
    Number(logical.judge ?? 0) +
    Number(logical.writer ?? 0)
  if (Number(logical.writer ?? 0) !== 0 ||
    Number(logical.answer ?? 0) !== answerCalls ||
    Number(logical.judge ?? 0) !== 1 ||
    evidence.attempts !== logicalTotal + evidence.retries.length ||
    evidence.sequence !== evidence.attempts * 2) {
    throw new J4LiveError(
      'FIRST5_QUESTION_CARDINALITY',
      'Canonical question call or retry cardinality differs.',
    )
  }
  for (const field of usageFields) {
    const accounted = Number(evidence.accountedDelta?.[field])
    const measured = Number(evidence.measuredDelta?.[field])
    const uncertain = Number(evidence.uncertainDelta?.[field])
    if (![accounted, measured, uncertain].every((value) =>
      Number.isFinite(value) && value >= 0) ||
      Math.abs(accounted - measured - uncertain) > 1e-12) {
      throw new J4LiveError(
        'FIRST5_QUESTION_USAGE',
        'Canonical question usage does not reconcile.',
      )
    }
  }
  if ((providerCalled &&
      (evidence.measuredDelta.geminiInputTokens <= 0 ||
        evidence.measuredDelta.geminiOutputTokens <= 0)) ||
    (!providerCalled &&
      (evidence.accountedDelta.geminiInputTokens !== 0 ||
        evidence.accountedDelta.geminiOutputTokens !== 0)) ||
    evidence.measuredDelta.judgeInputTokens <= 0 ||
    evidence.measuredDelta.judgeOutputTokens <= 0 ||
    !Number.isFinite(evidence.cumulativeAccounted?.usd) ||
    evidence.cumulativeAccounted.usd > freshCapUsd + 1e-12) {
    throw new J4LiveError(
      'FIRST5_QUESTION_USAGE',
      'Canonical question provider usage or cap differs.',
    )
  }
  return evidence
}

function observedFailureStage(instance, armResult, correct) {
  if (armResult.briefing?.status === 'capacity_exceeded') {
    return 'capacity'
  }
  if (correct) return 'none'
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
    answerRequestSha256: armResult.answerRequestSha256,
    briefing: armResult.briefing,
    exchangePlanSha256: armResult.exchangePlanSha256,
    ingest: armResult.ingest,
    isAbstention: instance.isAbstention,
    judge: {
      correct,
      modelVersion: judgeResponse.modelVersion,
      response: judgeResponse.text,
    },
    memoryEvidence: armResult.memoryEvidence,
    memoryEvidenceSha256: armResult.memoryEvidenceSha256,
    meter,
    observedFailureStage: failureStage,
    prediction: {
      matched:
        prediction.predictedOfficialCorrect === correct &&
        prediction.predictedFailureStage === failureStage,
      predictedFailureStage: prediction.predictedFailureStage,
      predictedOfficialCorrect: prediction.predictedOfficialCorrect,
    },
    promptSha256: armResult.promptSha256,
    provenance: clone(provenance),
    providerCalled: armResult.providerCalled,
    questionId: instance.questionId,
    questionType: instance.questionType,
    retrieval: armResult.retrieval,
    schemaVersion: 1,
    sourceCoverage: armResult.sourceCoverage,
    writerProviderCalls: armResult.writerProviderCalls,
  }
}

async function writeCheckpoint(path, checkpoint) {
  await atomicWriteJ4(path, `${JSON.stringify(checkpoint, null, 2)}\n`)
}

async function validateCompletedResults(checkpoint, population, runDir) {
  const results = []
  for (let index = 0; index < checkpoint.questions.length; index += 1) {
    const cell = checkpoint.questions[index]
    if (cell.status !== 'completed') continue
    const text = await readFile(join(runDir, cell.resultFile), 'utf8')
    if (sha256(text) !== cell.resultSha256) {
      throw new J4LiveError(
        'FIRST5_RESULT_HASH',
        'Canonical result differs from its checkpoint hash.',
      )
    }
    const result = JSON.parse(text)
    const instance = population.executionOrder[index]
    if (result.schemaVersion !== 1 ||
      result.questionId !== instance.questionId ||
      result.questionType !== instance.questionType ||
      !sameJson(result.provenance, checkpoint.identity.provenance) ||
      result.writerProviderCalls !== 0 ||
      typeof result.judge?.correct !== 'boolean') {
      throw new J4LiveError(
        'FIRST5_RESULT_SCHEMA',
        'Canonical result differs from its frozen question.',
      )
    }
    results.push(result)
  }
  return results
}

function buildPrivateReport({ checkpoint, meter, results }) {
  const correct = results.filter((entry) => entry.judge.correct).length
  const missesFirst = [...results].sort((left, right) =>
    Number(left.judge.correct) - Number(right.judge.correct) ||
    left.questionId.localeCompare(right.questionId))
  return {
    completedQuestions: results.length,
    disclaimer:
      'Private diagnostic prefix; non-representative and not publishable.',
    meter,
    missesFirst,
    officialAccuracy: { correct, total: results.length },
    predecessor: checkpoint.predecessorAudit,
    predictionMisses: results.filter((entry) =>
      !entry.prediction.matched),
    provenance: clone(checkpoint.identity.provenance),
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
    writerProviderCalls:
      Number(meter?.logicalRequests?.writer ?? 0),
  }
}

function renderPrivateReport(report) {
  const lines = [
    '# Canonical Palari private LongMemEval prefix',
    '',
    `> ${report.disclaimer}`,
    '',
    `- Status: ${report.status}`,
    `- Completed questions: ${report.completedQuestions}`,
    `- Preliminary official accuracy: ${report.officialAccuracy.correct}/${report.officialAccuracy.total}`,
    `- Writer provider calls: ${report.writerProviderCalls}`,
    `- Answer provider calls: ${report.meter?.logicalRequests?.answer ?? 0}`,
    `- Judge calls: ${report.meter?.logicalRequests?.judge ?? 0}`,
    `- Fresh accounted spend: $${report.spend.freshAccountedUsd.toFixed(7)}`,
    `- Cumulative accounted spend: $${report.spend.cumulativeAccountedUsd.toFixed(7)}`,
    `- Retries: ${report.meter?.retries?.length ?? 0}`,
    '',
    '## Misses first',
    '',
  ]
  if (!report.missesFirst.length) lines.push('- None.')
  for (const result of report.missesFirst) {
    lines.push(
      `- ${result.questionId} (${result.questionType}) — ` +
      `${result.judge.correct ? 'correct' : result.observedFailureStage}`,
    )
  }
  return `${lines.join('\n')}\n`
}

export async function writeCanonicalFirst5TerminalArtifacts({
  checkpoint,
  forbiddenSecrets,
  now,
  paths,
  population,
  transport,
}) {
  const verified = await transport.verify()
  checkpoint.meter = verified.ledger
  checkpoint.transcriptAudit = verified.transcripts
  const results = await validateCompletedResults(
    checkpoint,
    population,
    paths.runDir,
  )
  const report = buildPrivateReport({
    checkpoint,
    meter: verified.ledger,
    results,
  })
  const reportJson = `${JSON.stringify(report, null, 2)}\n`
  const reportMarkdown = renderPrivateReport(report)
  await atomicWriteJ4(paths.reportJsonPath, reportJson)
  await atomicWriteJ4(paths.reportMarkdownPath, reportMarkdown)
  checkpoint.report = {
    json: relative(paths.runDir, paths.reportJsonPath),
    jsonSha256: sha256(reportJson),
    markdown: relative(paths.runDir, paths.reportMarkdownPath),
    markdownSha256: sha256(reportMarkdown),
  }
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

async function writeCanonicalFirst5UnmeteredFailureArtifacts({
  checkpoint,
  forbiddenSecrets,
  now,
  paths,
}) {
  const report = buildPrivateReport({
    checkpoint,
    meter: checkpoint.meter,
    results: [],
  })
  const reportJson = `${JSON.stringify(report, null, 2)}\n`
  const reportMarkdown = renderPrivateReport(report)
  await atomicWriteJ4(paths.reportJsonPath, reportJson)
  await atomicWriteJ4(paths.reportMarkdownPath, reportMarkdown)
  checkpoint.report = {
    json: relative(paths.runDir, paths.reportJsonPath),
    jsonSha256: sha256(reportJson),
    markdown: relative(paths.runDir, paths.reportMarkdownPath),
    markdownSha256: sha256(reportMarkdown),
  }
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

export async function executeCanonicalFirstFive({
  administrativeHead,
  authority,
  authoritySha256,
  checkpoint,
  config,
  forbiddenSecrets,
  now = () => new Date().toISOString(),
  paths,
  population,
  runQuestion = runCanonicalFirst5LongMemEvalQuestion,
  transport,
}) {
  assertAuthority(authority, config)
  checkpoint.invocations.push({
    administrativeHead,
    authoritySha256,
    cumulativeCapUsd: authority.cumulativeCapUsd,
    freshSubcapUsd: authority.freshSubcapUsd,
    openingAccountedUsd: checkpoint.predecessorAudit.accountedUsd,
    startedAt: isoNow(now),
    targetQuestions: 5,
    writerEnabled: false,
  })
  checkpoint.status = 'running'
  await writeCheckpoint(paths.checkpointPath, checkpoint)

  const callGemini = createCanonicalFirst5GeminiCaller(
    transport.callGemini,
  )
  for (let index = 0; index < 5; index += 1) {
    const cell = checkpoint.questions[index]
    const instance = population.executionOrder[index]
    if (cell.status !== 'pending' ||
      cell.questionId !== instance.questionId) {
      throw new J4LiveError(
        'FIRST5_QUESTION_NOT_PENDING',
        'Canonical first-five refuses a rerun or reordered question.',
      )
    }
    const workspaceDir = join(paths.runDir, cell.workspace)
    if (await exists(workspaceDir)) {
      throw new J4LiveError(
        'FIRST5_STALE_WORKSPACE',
        'A pending canonical question already has a workspace.',
      )
    }
    cell.status = 'in_progress'
    cell.startedAt = isoNow(now)
    checkpoint.events.push({
      questionId: cell.questionId,
      status: 'in_progress',
      timestamp: cell.startedAt,
    })
    const meterBefore = await transport.snapshot()
    checkpoint.meter = meterBefore
    await writeCheckpoint(paths.checkpointPath, checkpoint)

    const armResult = await runQuestion({
      callGemini,
      instance,
      workspaceDir,
    })
    if (armResult.writerProviderCalls !== 0 ||
      armResult.providerCalled !== armResult.answerProviderCalled ||
      (!armResult.providerCalled &&
        (armResult.answerModelVersion !== null ||
          armResult.answerRequestSha256 !== null ||
          armResult.promptSha256 !== null))) {
      throw new J4LiveError(
        'FIRST5_ARM_RESULT',
        'Canonical first-five arm exposed a writer or invalid answer state.',
      )
    }
    const judgeResponse = assertValidatedJ4JudgeResponse(
      await transport.callJudge({
        body: buildJ4JudgeBody(instance, armResult.answer),
        cellId: instance.questionId,
        model: configValue(
          'CANONICAL_FIRST5_JUDGE_MODEL',
          'gpt-4o-2024-08-06',
        ),
        operationId: `question:${instance.questionId}:judge`,
        purpose: 'judge',
      }),
    )
    const meterAfter = await transport.snapshot()
    const meterEvidence = assertQuestionMeter({
      evidence: buildJ4QuestionMeterEvidence(
        meterBefore,
        meterAfter,
      ),
      freshCapUsd: authority.freshSubcapUsd,
      providerCalled: armResult.providerCalled,
    })
    if (armResult.providerCalled &&
      armResult.answerModelVersion !==
        meterAfter.geminiModelVersion) {
      throw new J4LiveError(
        'FIRST5_MODEL_VERSION',
        'Canonical answer modelVersion differs from its metered snapshot.',
      )
    }
    const result = buildQuestionResult({
      armResult,
      instance,
      judgeResponse,
      meter: meterEvidence,
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
    cell.resultSha256 = sha256(resultText)
    checkpoint.meter = meterAfter
    await writeCheckpoint(paths.checkpointPath, checkpoint)
    await transport.verify()
    await collectJ4PrivateArtifacts(paths.runDir, { forbiddenSecrets })
    cell.completedAt = isoNow(now)
    cell.status = 'completed'
    checkpoint.events.push({
      questionId: cell.questionId,
      status: 'completed',
      timestamp: cell.completedAt,
    })
    checkpoint.meter = await transport.snapshot()
    await writeCheckpoint(paths.checkpointPath, checkpoint)

    if (result.briefing?.status === 'capacity_exceeded') {
      checkpoint.pauseReason = 'MEMORY_CAPACITY_EXCEEDED'
      checkpoint.status = 'paused'
      checkpoint.pausedAt = isoNow(now)
      break
    }
  }
  if (checkpoint.questions.every((cell) =>
    cell.status === 'completed')) {
    checkpoint.status = 'complete'
    checkpoint.completedAt = isoNow(now)
  }
  const invocation = checkpoint.invocations.at(-1)
  invocation.completedAt =
    checkpoint.completedAt ?? checkpoint.pausedAt ?? isoNow(now)
  invocation.completedQuestions = checkpoint.questions.filter(
    (cell) => cell.status === 'completed',
  ).length
  const report = await writeCanonicalFirst5TerminalArtifacts({
    checkpoint,
    forbiddenSecrets,
    now,
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
  repoRoot = CANONICAL_FIRST5_REPO_ROOT,
} = {}) {
  const runId = parseCanonicalFirst5Args(args)

  // This must remain before dependency, file, result, or environment access.
  assertCanonicalFirst5Open(runId)

  const loadConfig = dependencies.loadConfig ??
    first5Config.loadCanonicalFirst5Config ??
    first5Config.loadCanonicalFirst5LiveConfig
  const loadAuthority = dependencies.loadAuthority ??
    first5Config.loadCanonicalFirst5Authority ??
    first5Config.loadCanonicalFirst5LiveAuthority
  const assertEnvironment = dependencies.assertEnvironment ??
    first5Config.assertCanonicalFirst5Environment ??
    first5Config.assertCanonicalFirst5LiveEnvironment
  if ([loadConfig, loadAuthority, assertEnvironment].some(
    (entry) => typeof entry !== 'function')) {
    throw new J4LiveError(
      'FIRST5_CONFIG_INTERFACE',
      'Canonical first-five config interface is incomplete.',
    )
  }
  const auditArtifacts = dependencies.auditArtifacts ??
    auditCanonicalFirst5TrackedArtifacts
  const inspectGit = dependencies.inspectGitCutPoint ??
    inspectJ4GitCutPoint
  const verifyPredecessor = dependencies.verifyPredecessor ??
    verifyCanonicalFirst5Predecessor
  const auditTracked = dependencies.auditTrackedFiles ??
    auditJ4TrackedFiles
  const meterFactory = dependencies.createMeteredTransport ??
    createActiveBrainMeteredTransport
  const preparePopulation = dependencies.preparePopulation ??
    prepareJ4PinnedS60
  const runQuestion = dependencies.runQuestion ??
    runCanonicalFirst5LongMemEvalQuestion
  const read = dependencies.readFile ?? readFile
  const pathExists = dependencies.exists ?? exists
  const now = dependencies.now ?? (() => new Date().toISOString())
  const log = dependencies.log ?? console.log
  const paths = canonicalFirst5ResultPaths(repoRoot)

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
  let population
  let secrets = []
  try {
    if (await pathExists(paths.runDir)) {
      throw new J4LiveError(
        'FIRST5_RUN_ALREADY_EXISTS',
        'Canonical first-five refuses to resume, replace, or overlay.',
      )
    }

    // Complete tracked/private/deep spend verification precedes key access.
    const predecessorAudit = await verifyPredecessor({
      config: loaded.config,
      repoRoot,
    })
    if (!sameUsd(
      predecessorAudit.accountedUsd,
      configValue('CANONICAL_FIRST5_OPENING_ACCOUNTED_USD', 0.7727998),
    )) {
      throw new J4LiveError(
        'FIRST5_OPENING_SPEND',
        'Canonical first-five has the wrong opening spend.',
      )
    }

    const raw = await read(resolve(
      repoRoot,
      loaded.config.dataset.path,
    ))
    population = canonicalFirstFivePopulation(
      await preparePopulation({ raw }),
    )
    if (population.manifest.datasetSha256 !==
      loaded.config.dataset.sha256) {
      throw new J4LiveError(
        'FIRST5_DATASET_HASH',
        'Canonical first-five dataset differs from its frozen identity.',
      )
    }

    // Provider credentials may be read only after predecessor and dataset
    // validation have completed.
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
    await mkdir(paths.runDir, { recursive: true, mode: 0o700 })
    await chmod(paths.runDir, 0o700)
    for (const directory of [
      paths.questionsDir,
      paths.transcriptDirectory,
      paths.workspacesDir,
    ]) {
      await mkdir(directory, { recursive: true, mode: 0o700 })
      await chmod(directory, 0o700)
    }

    const identity = buildCanonicalFirst5Identity({
      artifactAudit,
      authoritySha256: loadedAuthority.authoritySha256,
      config: loaded.config,
      configSha256: loaded.configSha256,
      datasetSha256: population.manifest.datasetSha256,
      predictionsSha256: loaded.predictionsSha256,
    })
    checkpoint = buildCanonicalFirst5Checkpoint({
      identity,
      population,
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
    await writeCheckpoint(paths.checkpointPath, checkpoint)

    const answerGeneration = configValue(
      'CANONICAL_FIRST5_ANSWER_GENERATION',
      loaded.config.generation?.answer,
    )
    const writerGeneration = configValue(
      'CANONICAL_FIRST5_WRITER_DENIAL_GENERATION',
      configValue(
        'CANONICAL_FIRST5_WRITER_GENERATION',
        loaded.config.generation?.writer,
      ),
    )
    const limits = configValue(
      'CANONICAL_FIRST5_LIMITS',
      loaded.config.limits,
    )
    const freshSubcapUsd = configValue(
      'CANONICAL_FIRST5_FRESH_SUBCAP_USD',
      1,
    )
    transport = await meterFactory({
      answerGeneration,
      capUsd: freshSubcapUsd,
      geminiApiKey: runtime.geminiApiKey,
      geminiModel: runtime.model,
      journalPath: paths.ledgerPath,
      limits,
      openaiApiKey: runtime.openaiApiKey,
      transcriptDirectory: paths.transcriptDirectory,
      writerGeneration,
    })
    transport.installNetworkGuard()

    const execution = await executeCanonicalFirstFive({
      administrativeHead: git.administrativeHead,
      authority: loadedAuthority.authority,
      authoritySha256: loadedAuthority.authoritySha256,
      checkpoint,
      config: loaded.config,
      forbiddenSecrets: secrets,
      now,
      paths,
      population,
      runQuestion,
      transport,
    })
    log(
      `Canonical first-five stopped at its contracted boundary; ` +
      `private report: ${paths.reportMarkdownPath}`,
    )
    return { ...execution, population }
  } catch (error) {
    if (checkpoint && population) {
      checkpoint.status = 'failed'
      checkpoint.failedAt ??= isoNow(now)
      checkpoint.failure ??= sanitizedError(error, secrets)
      for (const cell of checkpoint.questions) {
        if (cell.status === 'in_progress') {
          cell.status = 'failed'
          cell.failedAt = checkpoint.failedAt
          cell.error = checkpoint.failure
        }
      }
      const invocation = checkpoint.invocations.at(-1)
      if (invocation) {
        invocation.completedAt ??= checkpoint.failedAt
        invocation.completedQuestions = checkpoint.questions.filter(
          (cell) => cell.status === 'completed',
        ).length
      }
      if (transport) {
        checkpoint.meter = await transport.snapshot()
          .catch(() => checkpoint.meter)
      }
      await writeCheckpoint(paths.checkpointPath, checkpoint)
        .catch(() => {})
      const bundle = transport
        ? writeCanonicalFirst5TerminalArtifacts({
            checkpoint,
            forbiddenSecrets: secrets,
            now,
            paths,
            population,
            transport,
          })
        : writeCanonicalFirst5UnmeteredFailureArtifacts({
            checkpoint,
            forbiddenSecrets: secrets,
            now,
            paths,
          })
      await bundle.catch(async (bundleError) => {
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
      `${error?.code ?? 'CANONICAL_FIRST5_FAILED'}: ` +
      `${error?.message ?? 'Canonical first-five run failed.'}`,
    )
    process.exitCode = 1
  })
}

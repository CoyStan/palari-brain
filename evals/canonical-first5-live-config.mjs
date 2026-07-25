// Frozen contract surface for the founder-authorized canonical-evidence
// first-five LongMemEval run.
//
// Importing this module is inert. It reads no files, credentials, result
// directories, or network resources. The optional writer is denied by the
// authority and runner; WRITER_DENIAL_GENERATION exists only because the
// shared historical meter requires a positive writer-generation shape.

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { buildAnswerPrompt } from '../src/brain.mjs'
import {
  buildStatementExtractionRequest,
} from '../src/statement-extraction.mjs'
import {
  LONGMEMEVAL_JUDGE_MODEL,
  LONGMEMEVAL_JUDGE_REQUEST,
  longMemEvalJudgeProvenance,
} from './longmemeval-judge.mjs'
import {
  J4_FIRST_TRANCHE_QUESTION_IDS,
  J4_S_DATASET_CONTRACT,
  SEALED_U8_QUESTION_IDS,
} from './longmemeval-plan.mjs'

export const CANONICAL_FIRST5_RUN_ID =
  'j4-active-brain-canonical-first5-v1'
export const CANONICAL_FIRST5_RUN_DATE = '2026-07-25'
export const CANONICAL_FIRST5_PRODUCT_COMMIT =
  '2aca0a7e1797bb293f535f9f85905334117fbd4b'
export const CANONICAL_FIRST5_CONFIG_PATH =
  `evals/live-runs/${CANONICAL_FIRST5_RUN_ID}.json`
export const CANONICAL_FIRST5_AUTHORITY_PATH =
  `evals/live-runs/${CANONICAL_FIRST5_RUN_ID}.authority.json`
export const CANONICAL_FIRST5_PREDICTIONS_PATH =
  `evals/predictions/${CANONICAL_FIRST5_RUN_ID}.json`
export const CANONICAL_FIRST5_RESULTS_ROOT = 'evals/results'
export const CANONICAL_FIRST5_DECISION_ENTRY =
  'FOUNDER GO — J4.2K-C1 canonical first-five benchmark'

export const CANONICAL_FIRST5_GEMINI_MODEL =
  'gemini-3.5-flash-lite'
export const CANONICAL_FIRST5_JUDGE_MODEL =
  LONGMEMEVAL_JUDGE_MODEL
export const CANONICAL_FIRST5_MAX_CHARS = 100_000
export const CANONICAL_FIRST5_ANSWER_GENERATION = deepFreeze({
  maxOutputTokens: 256,
  thinkingConfig: { thinkingLevel: 'MINIMAL' },
})

const technicalWriterRequest = buildStatementExtractionRequest({
  turn: {
    assistantMessage: '',
    userMessage: '',
  },
})

export const CANONICAL_FIRST5_WRITER_DENIAL_GENERATION = deepFreeze(
  structuredClone(technicalWriterRequest.generationConfig),
)

export const CANONICAL_FIRST5_CUMULATIVE_CAP_USD = 7
export const CANONICAL_FIRST5_FRESH_SUBCAP_USD = 1
export const CANONICAL_FIRST5_OPENING_ACCOUNTED_USD = 0.7727998
export const CANONICAL_FIRST5_OPENING_MEASURED_USD = 0.7702988
export const CANONICAL_FIRST5_OPENING_UNCERTAIN_USD = 0.002501
export const CANONICAL_FIRST5_AVAILABLE_USD = 6.2272002

export const CANONICAL_FIRST5_PRICES_USD_PER_TOKEN = deepFreeze({
  geminiInput: 0.30 / 1_000_000,
  geminiOutputIncludingThinking: 2.50 / 1_000_000,
  judgeInput: 2.50 / 1_000_000,
  judgeOutput: 10.00 / 1_000_000,
})

// The token envelope costs at most $0.8948 at the frozen prices. The nested
// $1 meter is still authoritative and may stop before any request whose exact
// request-body reservation would cross it.
export const CANONICAL_FIRST5_LIMITS = deepFreeze({
  maxAttempts: 40,
  maxLogicalRequests: {
    answer: 5,
    judge: 5,
    // Technical compatibility only. The effective writer allowance is zero.
    writer: 1,
  },
  maxResponseBytes: 4 * 1024 * 1024,
  maxTokens: {
    geminiInput: 2_100_000,
    geminiOutputIncludingThinking: 5_120,
    judgeInput: 100_000,
    judgeOutput: 200,
  },
  requestTimeoutMs: 60_000,
  retryLimit: 3,
})

export const CANONICAL_FIRST5_COST_ESTIMATE = deepFreeze({
  capacityBoundary: {
    answerLogicalRequests: 0,
    judgeLogicalRequests: 1,
    judgeRequestBytes: 712,
    judgeRequestSha256:
      'd08e0f97aaa96f58f6e0a3e7067d7b18ec13c23b1123fc51a4326d59b0e300ce',
    maximumAttempts: 4,
    maximumRetryReservationUsd: 0.01264,
    oneAttemptReservation: {
      judgeInputTokens: 1_224,
      judgeOutputTokens: 10,
      usd: 0.00316,
    },
    ordinal: 1,
    questionId: '08e075c7',
    writerLogicalRequests: 0,
  },
  maximumTokenEnvelope: {
    geminiInputTokens:
      CANONICAL_FIRST5_LIMITS.maxTokens.geminiInput,
    geminiOutputIncludingThinkingTokens:
      CANONICAL_FIRST5_LIMITS.maxTokens
        .geminiOutputIncludingThinking,
    judgeInputTokens:
      CANONICAL_FIRST5_LIMITS.maxTokens.judgeInput,
    judgeOutputTokens:
      CANONICAL_FIRST5_LIMITS.maxTokens.judgeOutput,
    usd: 0.8948,
  },
})

export const CANONICAL_FIRST5_METER_COMPATIBILITY = deepFreeze({
  effectiveWriterLogicalRequests: 0,
  reason:
    'The shared sealed meter schema requires positive logical ceilings; the runner denies writer purpose before transport.',
  runnerMustDenyPurpose: 'writer',
  technicalWriterLogicalRequests: 1,
})

export const CANONICAL_FIRST5_POPULATION = deepFreeze({
  questionIds: [...J4_FIRST_TRANCHE_QUESTION_IDS],
  questionIdsSha256:
    '15653437520a8373805ded273d28bab901d04d3711c1c9ab7968b11e44ff746f',
  questions: 5,
  sealedQuestionIds: [...SEALED_U8_QUESTION_IDS],
})

export const CANONICAL_FIRST5_CAPACITY_ORACLE = deepFreeze({
  datasetSha256: J4_S_DATASET_CONTRACT.sha256,
  maxChars: CANONICAL_FIRST5_MAX_CHARS,
  method:
    'current product canonical replay plus complete-scoped briefing preflight; no provider or judge call',
  productCommit: CANONICAL_FIRST5_PRODUCT_COMMIT,
  rows: [
    {
      canonicalRows: 484,
      expectedExecution: 'execute',
      ordinal: 1,
      questionId: '08e075c7',
      requiredChars: 633_063,
    },
    {
      canonicalRows: 481,
      expectedExecution: 'not_reached',
      ordinal: 2,
      questionId: '09d032c9',
      requiredChars: 615_373,
    },
    {
      canonicalRows: 509,
      expectedExecution: 'not_reached',
      ordinal: 3,
      questionId: '16c90bf4',
      requiredChars: 634_907,
    },
    {
      canonicalRows: 445,
      expectedExecution: 'not_reached',
      ordinal: 4,
      questionId: '5e1b23de',
      requiredChars: 608_623,
    },
    {
      canonicalRows: 479,
      expectedExecution: 'not_reached',
      ordinal: 5,
      questionId: '80ec1f4f_abs',
      requiredChars: 622_274,
    },
  ],
  stopAtFirstCapacity: true,
})

export const CANONICAL_FIRST5_PREDECESSOR = deepFreeze({
  administrativeHead:
    '5bd8a27350145480a5ee9656d240b5147fb652b1',
  attempts: 2,
  benchmarkQuestions: 0,
  cumulativeAccountedUsd:
    CANONICAL_FIRST5_OPENING_ACCOUNTED_USD,
  cumulativeMeasuredUsd:
    CANONICAL_FIRST5_OPENING_MEASURED_USD,
  cumulativeUncertainUsd:
    CANONICAL_FIRST5_OPENING_UNCERTAIN_USD,
  currentRunAccountedUsd: 0.0003003,
  currentRunMeasuredUsd: 0.0003003,
  currentRunUncertainUsd: 0,
  logicalRequests: {
    answer: 1,
    writer: 1,
  },
  openingAccountedUsd: 0.7724995,
  private: {
    checkpoint: {
      path:
        'evals/results/j4-active-brain-canonical-smoke-v1/checkpoint.json',
      sha256:
        '093c6c3b8aa57c8465b62624593434a4bfc86d8143b15878dfe76cd479911046',
    },
    manifest: {
      path:
        'evals/results/j4-active-brain-canonical-smoke-v1/artifact-manifest.json',
      sha256:
        'be1eac7ffa17653df5a720bfb4bf2eaef05ae477df7d2f9bcf2e4c77b9644b56',
    },
    meter: {
      path:
        'evals/results/j4-active-brain-canonical-smoke-v1/meter.jsonl',
      sha256:
        '234073fef643402ba4ad7d7a999b96c2684f5ed9010baed0206d4f44d52f50f1',
    },
  },
  productCommit: CANONICAL_FIRST5_PRODUCT_COMMIT,
  retries: 0,
  runId: 'j4-active-brain-canonical-smoke-v1',
  sealedRunner: {
    path: 'evals/run-canonical-evidence-smoke.mjs',
    preRunSha256:
      '1a770ef53e4b4042db7fd52ae41fe379090b0175d9fcd91b69ebbc182a351f34',
    sha256:
      '2814b772c33e52fd5347d2bc7d983c2977b4f3b478cd221b680495f2e10ba5dc',
  },
  sealCommit:
    '5f22a9689532948c0356f01b473043df64270ccc',
  status: 'complete',
  tracked: {
    authority: {
      path:
        'evals/live-runs/j4-active-brain-canonical-smoke-v1.authority.json',
      sha256:
        'c70f45de2d3efdeceaab7008d1c6d6e5a34c8f8bebb77d7074d861aaa8d7357f',
    },
    config: {
      path:
        'evals/live-runs/j4-active-brain-canonical-smoke-v1.json',
      sha256:
        '28419934b34635770474aa61e156c8d2038c4a89dd858554f5029d1ce22b502c',
    },
    predictions: {
      path:
        'evals/predictions/j4-active-brain-canonical-smoke-v1.json',
      sha256:
        '1d840005849d3c58a6f523fa8cff66ba2a2fcefaf409ab1b24cb611c2a89ab2c',
    },
  },
})

export const CANONICAL_FIRST5_EXPECTED_PREDICTIONS = deepFreeze(
  CANONICAL_FIRST5_CAPACITY_ORACLE.rows.map((row, index) => ({
    capacityOracle: {
      canonicalRows: row.canonicalRows,
      maxChars: CANONICAL_FIRST5_MAX_CHARS,
      requiredChars: row.requiredChars,
    },
    expectedExecution: row.expectedExecution,
    isAbstention: row.questionId.endsWith('_abs'),
    ordinal: row.ordinal,
    predictedFailureStage: index === 0 ? 'capacity' : 'not_reached',
    predictedOfficialCorrect: index === 0 ? false : null,
    questionId: row.questionId,
    questionType: [
      'knowledge-update',
      'single-session-preference',
      'single-session-assistant',
      'temporal-reasoning',
      'multi-session',
    ][index],
  })),
)

export const CANONICAL_FIRST5_PREDICTION_ROWS_SHA256 =
  canonicalFirst5Sha256(JSON.stringify(
    CANONICAL_FIRST5_EXPECTED_PREDICTIONS,
  ))

export class CanonicalFirst5ConfigError extends Error {
  constructor(code, message, { cause } = {}) {
    super(message, cause ? { cause } : undefined)
    this.name = 'CanonicalFirst5ConfigError'
    this.code = code
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value
  }
  for (const child of Object.values(value)) deepFreeze(child)
  return Object.freeze(value)
}

export function canonicalFirst5Sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [
      key,
      stableValue(value[key]),
    ]),
  )
}

function sameJson(left, right) {
  return JSON.stringify(stableValue(left)) ===
    JSON.stringify(stableValue(right))
}

function sameUsd(left, right) {
  return Number.isFinite(Number(left)) &&
    Number.isFinite(Number(right)) &&
    Math.abs(Number(left) - Number(right)) <= 1e-12
}

function assertHash(value, label) {
  if (!/^[a-f0-9]{64}$/.test(String(value ?? ''))) {
    throw new CanonicalFirst5ConfigError(
      'CONFIG_HASH_INVALID',
      `${label} must be one lowercase SHA-256.`,
    )
  }
}

function assertSafeRepositoryPath(path, label) {
  if (typeof path !== 'string' ||
    !path ||
    path.startsWith('/') ||
    path.split('/').includes('..')) {
    throw new CanonicalFirst5ConfigError(
      'CONFIG_PATH_INVALID',
      `${label} must be a safe repository-relative path.`,
    )
  }
}

export function canonicalFirst5AnswerContractSha256() {
  return canonicalFirst5Sha256(buildAnswerPrompt({
    briefingText: '{MEMORY_BRIEFING}',
    question: '{QUESTION}',
    questionDate: '{QUESTION_DATE}',
  }))
}

function expectedScope() {
  return {
    answerOperationsMax: 5,
    benchmarkQuestions: 5,
    datasetLoaded: true,
    judgeOperationsMax: 5,
    stopAtFirstCapacity: true,
    writerOperations: 0,
  }
}

function expectedModels() {
  return {
    answer: CANONICAL_FIRST5_GEMINI_MODEL,
    judge: CANONICAL_FIRST5_JUDGE_MODEL,
    writer: null,
  }
}

function expectedGeneration() {
  return {
    answerMaxOutputTokens:
      CANONICAL_FIRST5_ANSWER_GENERATION.maxOutputTokens,
    judgeMaxTokens: LONGMEMEVAL_JUDGE_REQUEST.maxTokens,
    judgeN: LONGMEMEVAL_JUDGE_REQUEST.n,
    judgeTemperature: LONGMEMEVAL_JUDGE_REQUEST.temperature,
    thinkingLevel:
      CANONICAL_FIRST5_ANSWER_GENERATION
        .thinkingConfig.thinkingLevel,
    writerDenied: true,
  }
}

function expectedSpend() {
  return {
    availableUnderCumulativeCapUsd:
      CANONICAL_FIRST5_AVAILABLE_USD,
    cumulativeCapUsd: CANONICAL_FIRST5_CUMULATIVE_CAP_USD,
    freshSubcapUsd: CANONICAL_FIRST5_FRESH_SUBCAP_USD,
    estimate: CANONICAL_FIRST5_COST_ESTIMATE,
    maximumPostRunAccountedUsd:
      CANONICAL_FIRST5_OPENING_ACCOUNTED_USD +
      CANONICAL_FIRST5_FRESH_SUBCAP_USD,
    openingAccountedUsd:
      CANONICAL_FIRST5_OPENING_ACCOUNTED_USD,
    openingMeasuredUsd:
      CANONICAL_FIRST5_OPENING_MEASURED_USD,
    openingUncertainUsd:
      CANONICAL_FIRST5_OPENING_UNCERTAIN_USD,
    pricesUsdPerToken:
      CANONICAL_FIRST5_PRICES_USD_PER_TOKEN,
  }
}

export function buildCanonicalFirst5Config({
  artifacts,
  predictionsSha256,
} = {}) {
  const config = {
    artifacts: structuredClone(artifacts ?? []),
    capacityOracle:
      structuredClone(CANONICAL_FIRST5_CAPACITY_ORACLE),
    dataset: {
      path: 'data/longmemeval_s_cleaned.json',
      sha256: J4_S_DATASET_CONTRACT.sha256,
    },
    generation: expectedGeneration(),
    limits: structuredClone(CANONICAL_FIRST5_LIMITS),
    meterCompatibility:
      structuredClone(CANONICAL_FIRST5_METER_COMPATIBILITY),
    models: expectedModels(),
    population: structuredClone(CANONICAL_FIRST5_POPULATION),
    predecessor:
      structuredClone(CANONICAL_FIRST5_PREDECESSOR),
    predictions: {
      path: CANONICAL_FIRST5_PREDICTIONS_PATH,
      sha256: predictionsSha256,
    },
    pricesUsdPerToken:
      structuredClone(CANONICAL_FIRST5_PRICES_USD_PER_TOKEN),
    productCommit: CANONICAL_FIRST5_PRODUCT_COMMIT,
    prompts: {
      answerContractSha256:
        canonicalFirst5AnswerContractSha256(),
      judgeSourceSha256:
        longMemEvalJudgeProvenance.sourceSha256,
      writer: null,
    },
    runDate: CANONICAL_FIRST5_RUN_DATE,
    runId: CANONICAL_FIRST5_RUN_ID,
    schemaVersion: 1,
    scope: expectedScope(),
    spend: expectedSpend(),
  }
  return validateCanonicalFirst5Config(config)
}

export function validateCanonicalFirst5Predictions(value) {
  if (!value ||
    value.schemaVersion !== 1 ||
    value.runId !== CANONICAL_FIRST5_RUN_ID ||
    value.status !== 'FINAL' ||
    value.frozenAt !== CANONICAL_FIRST5_RUN_DATE ||
    !sameJson(value.decisionReference, {
      cumulativeHardCapUsd:
        CANONICAL_FIRST5_CUMULATIVE_CAP_USD,
      date: CANONICAL_FIRST5_RUN_DATE,
      document: 'docs/DECISIONS.md',
      entry: CANONICAL_FIRST5_DECISION_ENTRY,
      freshSubcapUsd: CANONICAL_FIRST5_FRESH_SUBCAP_USD,
      questions: 5,
    }) ||
    !sameJson(value.models, expectedModels()) ||
    !sameJson(value.population, {
      questionIds: CANONICAL_FIRST5_POPULATION.questionIds,
      questionIdsSha256:
        CANONICAL_FIRST5_POPULATION.questionIdsSha256,
      questions: 5,
    }) ||
    !sameJson(value.predictions, CANONICAL_FIRST5_EXPECTED_PREDICTIONS) ||
    value.rowArraySha256 !==
      CANONICAL_FIRST5_PREDICTION_ROWS_SHA256 ||
    canonicalFirst5Sha256(JSON.stringify(value.predictions)) !==
      CANONICAL_FIRST5_PREDICTION_ROWS_SHA256 ||
    !sameJson(value.expectedBoundary, {
      answerLogicalRequests: 0,
      completedQuestions: 1,
      judgeLogicalRequests: 1,
      pendingQuestions: 4,
      stopAfterOrdinal: 1,
      stopReason: 'MEMORY_CAPACITY_EXCEEDED',
      writerLogicalRequests: 0,
    }) ||
    !sameJson(value.priorPredictionsRemainImmutable, {
      activeFirst5Sha256:
        'b40c573ac81054976ce39f314783f2abd2b31fe9098918b0942de4b99bb60bdb',
      canonicalSmokeSha256:
        '1d840005849d3c58a6f523fa8cff66ba2a2fcefaf409ab1b24cb611c2a89ab2c',
    })) {
    throw new CanonicalFirst5ConfigError(
      'PREDICTIONS_SCHEMA_INVALID',
      'Canonical first-five FINAL predictions differ from the frozen contract.',
    )
  }
  return value
}

export function validateCanonicalFirst5Authority(authority) {
  const expected = {
    answerOperationsMax: 5,
    benchmarkQuestions: 5,
    cumulativeCapUsd: CANONICAL_FIRST5_CUMULATIVE_CAP_USD,
    cumulativeQuestions: 5,
    decisionReference:
      `docs/DECISIONS.md — ${CANONICAL_FIRST5_DECISION_ENTRY}`,
    founderGoDate: CANONICAL_FIRST5_RUN_DATE,
    freshSubcapUsd: CANONICAL_FIRST5_FRESH_SUBCAP_USD,
    fromCumulativeQuestions: 0,
    judgeOperationsMax: 5,
    predecessorCheckpointSha256:
      CANONICAL_FIRST5_PREDECESSOR.private.checkpoint.sha256,
    predecessorRunId: CANONICAL_FIRST5_PREDECESSOR.runId,
    previousCheckpointSha256: null,
    questions: 5,
    runId: CANONICAL_FIRST5_RUN_ID,
    schemaVersion: 1,
    scope: 'canonical-first-five-no-writer',
    stopAtFirstCapacity: true,
    writerEnabled: false,
    writerOperations: 0,
  }
  if (!sameJson(authority, expected)) {
    throw new CanonicalFirst5ConfigError(
      'AUTHORITY_SCHEMA_INVALID',
      'Canonical first-five authority differs from the founder GO.',
    )
  }
  return authority
}

export function validateCanonicalFirst5Config(config) {
  if (!config ||
    config.schemaVersion !== 1 ||
    config.runId !== CANONICAL_FIRST5_RUN_ID ||
    config.runDate !== CANONICAL_FIRST5_RUN_DATE ||
    config.productCommit !== CANONICAL_FIRST5_PRODUCT_COMMIT ||
    !sameJson(config.dataset, {
      path: 'data/longmemeval_s_cleaned.json',
      sha256: J4_S_DATASET_CONTRACT.sha256,
    }) ||
    !sameJson(config.scope, expectedScope()) ||
    !sameJson(config.models, expectedModels()) ||
    !sameJson(config.generation, expectedGeneration()) ||
    !sameJson(config.population, CANONICAL_FIRST5_POPULATION) ||
    !sameJson(config.capacityOracle, CANONICAL_FIRST5_CAPACITY_ORACLE) ||
    !sameJson(config.limits, CANONICAL_FIRST5_LIMITS) ||
    !sameJson(
      config.meterCompatibility,
      CANONICAL_FIRST5_METER_COMPATIBILITY,
    ) ||
    !sameJson(
      config.pricesUsdPerToken,
      CANONICAL_FIRST5_PRICES_USD_PER_TOKEN,
    ) ||
    !sameJson(config.spend, expectedSpend()) ||
    !sameJson(config.predecessor, CANONICAL_FIRST5_PREDECESSOR) ||
    !sameJson(config.prompts, {
      answerContractSha256:
        canonicalFirst5AnswerContractSha256(),
      judgeSourceSha256:
        longMemEvalJudgeProvenance.sourceSha256,
      writer: null,
    }) ||
    config.predictions?.path !==
      CANONICAL_FIRST5_PREDICTIONS_PATH) {
    throw new CanonicalFirst5ConfigError(
      'CONFIG_SCHEMA_INVALID',
      'Canonical first-five config differs from its frozen scope.',
    )
  }
  assertHash(config.predictions.sha256, 'Predictions hash')
  if (!Array.isArray(config.artifacts) ||
    config.artifacts.length < 1) {
    throw new CanonicalFirst5ConfigError(
      'CONFIG_ARTIFACTS_INVALID',
      'Canonical first-five config must pin its runtime artifacts.',
    )
  }
  const paths = new Set()
  for (const artifact of config.artifacts) {
    assertSafeRepositoryPath(artifact?.path, 'Artifact path')
    assertHash(artifact?.sha256, `Artifact ${artifact?.path} hash`)
    if (paths.has(artifact.path)) {
      throw new CanonicalFirst5ConfigError(
        'CONFIG_ARTIFACTS_INVALID',
        'Canonical first-five artifact paths must be unique.',
      )
    }
    paths.add(artifact.path)
  }
  return config
}

export async function loadCanonicalFirst5LiveConfig({
  configPath = CANONICAL_FIRST5_CONFIG_PATH,
  repoRoot,
} = {}) {
  if (!repoRoot) {
    throw new CanonicalFirst5ConfigError(
      'CONFIG_REPO_ROOT',
      'Canonical first-five config loading requires a repository root.',
    )
  }
  const root = resolve(repoRoot)
  const configBytes = await readFile(resolve(root, configPath))
  let config
  try {
    config = validateCanonicalFirst5Config(JSON.parse(configBytes))
  } catch (error) {
    if (error instanceof CanonicalFirst5ConfigError) throw error
    throw new CanonicalFirst5ConfigError(
      'CONFIG_JSON_INVALID',
      'Canonical first-five config is not valid JSON.',
      { cause: error },
    )
  }
  const predictionsBytes = await readFile(
    resolve(root, config.predictions.path),
  )
  const predictionsSha256 =
    canonicalFirst5Sha256(predictionsBytes)
  if (predictionsSha256 !== config.predictions.sha256) {
    throw new CanonicalFirst5ConfigError(
      'PREDICTIONS_CHANGED',
      'Canonical first-five FINAL predictions changed after freezing.',
    )
  }
  let predictions
  try {
    predictions = validateCanonicalFirst5Predictions(
      JSON.parse(predictionsBytes),
    )
  } catch (error) {
    if (error instanceof CanonicalFirst5ConfigError) throw error
    throw new CanonicalFirst5ConfigError(
      'PREDICTIONS_JSON_INVALID',
      'Canonical first-five predictions are not valid JSON.',
      { cause: error },
    )
  }
  return deepFreeze({
    config,
    configPath,
    configSha256: canonicalFirst5Sha256(configBytes),
    predictions,
    predictionsPath: config.predictions.path,
    predictionsSha256,
  })
}

export async function loadCanonicalFirst5LiveAuthority({
  authorityPath = CANONICAL_FIRST5_AUTHORITY_PATH,
  repoRoot,
} = {}) {
  if (!repoRoot) {
    throw new CanonicalFirst5ConfigError(
      'AUTHORITY_REPO_ROOT',
      'Canonical first-five authority loading requires a repository root.',
    )
  }
  const authorityBytes = await readFile(
    resolve(repoRoot, authorityPath),
  )
  let authority
  try {
    authority = validateCanonicalFirst5Authority(
      JSON.parse(authorityBytes),
    )
  } catch (error) {
    if (error instanceof CanonicalFirst5ConfigError) throw error
    throw new CanonicalFirst5ConfigError(
      'AUTHORITY_JSON_INVALID',
      'Canonical first-five authority is not valid JSON.',
      { cause: error },
    )
  }
  return deepFreeze({
    authority,
    authorityPath,
    authoritySha256:
      canonicalFirst5Sha256(authorityBytes),
  })
}

export function assertCanonicalFirst5Environment(
  env,
  config,
  authority,
) {
  if (env.PALARI_CANONICAL_FIRST5_CONFIRM_SPEND !== '1' ||
    Number(
      env.PALARI_CANONICAL_FIRST5_CUMULATIVE_CAP_USD,
    ) !== CANONICAL_FIRST5_CUMULATIVE_CAP_USD ||
    Number(
      env.PALARI_CANONICAL_FIRST5_FRESH_SUBCAP_USD,
    ) !== CANONICAL_FIRST5_FRESH_SUBCAP_USD ||
    Number(
      env.PALARI_CANONICAL_FIRST5_CUMULATIVE_QUESTIONS,
    ) !== 5 ||
    env.PALARI_CANONICAL_FIRST5_MODEL !==
      CANONICAL_FIRST5_GEMINI_MODEL ||
    config?.runId !== CANONICAL_FIRST5_RUN_ID ||
    authority?.runId !== CANONICAL_FIRST5_RUN_ID) {
    throw new CanonicalFirst5ConfigError(
      'LIVE_CONFIRMATION_MISSING',
      'Canonical first-five execution requires its exact founder confirmations.',
    )
  }
  const geminiApiKey = String(env.GEMINI_API_KEY ?? '').trim()
  const openaiApiKey = String(env.OPENAI_API_KEY ?? '').trim()
  if (!geminiApiKey) {
    throw new CanonicalFirst5ConfigError(
      'GEMINI_KEY_MISSING',
      'Canonical first-five execution requires GEMINI_API_KEY.',
    )
  }
  if (!openaiApiKey) {
    throw new CanonicalFirst5ConfigError(
      'OPENAI_KEY_MISSING',
      'Canonical first-five execution requires OPENAI_API_KEY.',
    )
  }
  return {
    cumulativeCapUsd:
      CANONICAL_FIRST5_CUMULATIVE_CAP_USD,
    cumulativeQuestions: 5,
    freshSubcapUsd: CANONICAL_FIRST5_FRESH_SUBCAP_USD,
    geminiApiKey,
    model: CANONICAL_FIRST5_GEMINI_MODEL,
    openaiApiKey,
  }
}

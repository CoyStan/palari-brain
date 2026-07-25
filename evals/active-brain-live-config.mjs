// Frozen configuration surface for the founder-gated active Palari Brain
// first-five measurement. Importing this module is inert: it reads no files,
// credentials, result directories, or network resources.

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { buildAnswerPrompt } from '../src/brain.mjs'
import {
  buildStatementExtractionRequest,
  MEMORY_STATEMENT_RESPONSE_MIME_TYPE,
  MEMORY_STATEMENT_RESPONSE_SCHEMA,
} from '../src/statement-extraction.mjs'
import {
  J4_PREDECESSOR_CHAIN,
  J4_REQUIRED_ARTIFACT_PATHS,
} from './longmemeval-live-config.mjs'
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

export const ACTIVE_BRAIN_LIVE_RUN_ID = 'j4-active-brain-first5-v1'
export const ACTIVE_BRAIN_LIVE_CONFIG_PATH =
  `evals/live-runs/${ACTIVE_BRAIN_LIVE_RUN_ID}.json`
export const ACTIVE_BRAIN_LIVE_AUTHORITY_PATH =
  `evals/live-runs/${ACTIVE_BRAIN_LIVE_RUN_ID}.authority.json`
export const ACTIVE_BRAIN_LIVE_PREDICTIONS_PATH =
  `evals/predictions/${ACTIVE_BRAIN_LIVE_RUN_ID}.json`
export const ACTIVE_BRAIN_LIVE_RESULTS_ROOT = 'evals/results'
export const ACTIVE_BRAIN_RESULTS_ROOT = ACTIVE_BRAIN_LIVE_RESULTS_ROOT
export const ACTIVE_BRAIN_GEMINI_MODEL = 'gemini-3.5-flash-lite'
export const ACTIVE_BRAIN_RUN_DATE = '2026-07-25'
export const ACTIVE_BRAIN_PRODUCT_MAX_CHARS = 100_000
export const ACTIVE_BRAIN_WRITER_MAX_OUTPUT_TOKENS = 2_000
export const ACTIVE_BRAIN_ANSWER_MAX_OUTPUT_TOKENS = 256
export const ACTIVE_BRAIN_CARRIED_ACCOUNTED_USD = 0.7721877
export const ACTIVE_BRAIN_CARRIED_MEASURED_USD = 0.7696867
export const ACTIVE_BRAIN_CARRIED_UNCERTAIN_USD = 0.002501
export const ACTIVE_BRAIN_FRESH_METER_CAP_USD = 6.2278123
export const ACTIVE_BRAIN_PREDICTION_ROWS_SHA256 =
  '6e2d9c0427a80de4b23cac76df008fd5857c704b0a8ba1f5523b91ff44f51265'
export const ACTIVE_BRAIN_QUESTION_IDS_SHA256 =
  '15653437520a8373805ded273d28bab901d04d3711c1c9ab7968b11e44ff746f'
export const ACTIVE_BRAIN_STATEMENT_SCHEMA_SHA256 =
  '70f10c289c58a406140020d36aaa231f882ab92e2db91b711c670a445f54b64c'

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value
  }
  for (const child of Object.values(value)) deepFreeze(child)
  return Object.freeze(value)
}

export function activeBrainSha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, stableValue(value[key])]),
  )
}

export function stableActiveBrainStringify(value) {
  return JSON.stringify(stableValue(value))
}

export const ACTIVE_BRAIN_WRITER_GENERATION = deepFreeze({
  maxOutputTokens: ACTIVE_BRAIN_WRITER_MAX_OUTPUT_TOKENS,
  responseFormat: {
    text: {
      mimeType: MEMORY_STATEMENT_RESPONSE_MIME_TYPE,
      schema: MEMORY_STATEMENT_RESPONSE_SCHEMA,
    },
  },
  thinkingConfig: { thinkingLevel: 'MINIMAL' },
})

export const ACTIVE_BRAIN_ANSWER_GENERATION = deepFreeze({
  maxOutputTokens: ACTIVE_BRAIN_ANSWER_MAX_OUTPUT_TOKENS,
  thinkingConfig: { thinkingLevel: 'MINIMAL' },
})

export const ACTIVE_BRAIN_PRICES_USD_PER_TOKEN = deepFreeze({
  geminiInput: 0.30 / 1_000_000,
  geminiOutputIncludingThinking: 2.50 / 1_000_000,
  judgeInput: 2.50 / 1_000_000,
  judgeOutput: 10.00 / 1_000_000,
})

export const ACTIVE_BRAIN_TRANCHES = deepFreeze([{
  cumulativeCapUsd: 7,
  cumulativeQuestions: 5,
  questions: 5,
}])

export const ACTIVE_BRAIN_LIMITS = deepFreeze({
  cumulativeCapUsd: 7,
  cumulativeQuestions: 5,
  meter: {
    maxAttempts: 4_876,
    maxLogicalRequests: {
      answer: 6,
      judge: 5,
      writer: 1_208,
    },
    maxTokens: {
      geminiInput: 23_333_333,
      geminiOutputIncludingThinking: 2_800_000,
      judgeInput: 2_800_000,
      judgeOutput: 700_000,
    },
    maxResponseBytes: 4 * 1024 * 1024,
    requestTimeoutMs: 60_000,
    retryLimit: 3,
  },
})

export const ACTIVE_BRAIN_CUMULATIVE_LIMITS = deepFreeze([
  ACTIVE_BRAIN_LIMITS,
])

export const ACTIVE_BRAIN_FIRST5_LIMITS = ACTIVE_BRAIN_LIMITS.meter

export function activeBrainLimitsForCumulativeQuestions(value) {
  const entry = ACTIVE_BRAIN_CUMULATIVE_LIMITS.find(
    (candidate) => candidate.cumulativeQuestions === Number(value),
  )
  if (!entry) {
    throw new ActiveBrainConfigError(
      'LIMITS_GATE_INVALID',
      'The active-brain run has no frozen limits for that boundary.',
    )
  }
  return entry.meter
}

const v5Descriptor = deepFreeze({
  attempts: 1_203,
  completedQuestions: 5,
  currentRunAccountedUsd: 0.5769756,
  failedQuestionOrdinal: null,
  logicalRequests: {
    answer: 6,
    judge: 5,
    writer: 1_192,
  },
  openingAccountedUsd: 0.1952121,
  private: {
    artifactManifestPath:
      'evals/results/j4-longmemeval-s60-v5/artifact-manifest.json',
    artifactManifestSha256:
      '22250ab01b8202319dd54d739561ef54d1b3685efb8e5fae8aed92d3d9dba1d6',
    checkpointPath:
      'evals/results/j4-longmemeval-s60-v5/checkpoint.json',
    checkpointSha256:
      'bc46d9272f1d788fb06b826a6219c8448b19b0f361aaa0c9d9b68bd53fca8805',
    meterPath: 'evals/results/j4-longmemeval-s60-v5/meter.jsonl',
    meterSha256:
      '22d8d51dd9844409ed6f4640c81903f6916b5cff325ee4561b4e4d94cdb0abe8',
  },
  runId: 'j4-longmemeval-s60-v5',
  smokeLogicalOperations: 2,
  smokeStatus: 'completed',
  status: 'paused',
  tracked: {
    authorityPath:
      'evals/live-runs/j4-longmemeval-s60-v5.authority.json',
    authoritySha256:
      '0f0ce76625a2e9e16bd3fbd171bb08568e88111811ad4d2fadd5f5889e1f45ba',
    configPath: 'evals/live-runs/j4-longmemeval-s60-v5.json',
    configSha256:
      '7319f3ae754eaca9935f70c8a2e8a66ccfde949a02729e7662d1d71f89bc4f3f',
    predictionsPath:
      'evals/predictions/j4-longmemeval-s60-v5.json',
    predictionsSha256:
      '9adbc808c93fda63397ac7b304af7347443ca2940adf722d231c60165f08e7d6',
  },
})

export const ACTIVE_BRAIN_PREDECESSOR_CHAIN = deepFreeze({
  openingAccountedUsd: ACTIVE_BRAIN_CARRIED_ACCOUNTED_USD,
  runs: [...J4_PREDECESSOR_CHAIN.runs, v5Descriptor],
})

export const ACTIVE_BRAIN_COST_ESTIMATE = deepFreeze({
  capUsd: 7,
  carriedAccountedUsd: ACTIVE_BRAIN_CARRIED_ACCOUNTED_USD,
  carriedMeasuredUsd: ACTIVE_BRAIN_CARRIED_MEASURED_USD,
  carriedUncertainUsd: ACTIVE_BRAIN_CARRIED_UNCERTAIN_USD,
  expected: {
    freshUsd: 0.90525,
    cumulativeUsd: 1.6774377,
    tokens: {
      geminiInput: 1_500_000,
      geminiOutputIncludingThinking: 179_400,
      judgeInput: 2_500,
      judgeOutput: 50,
    },
  },
  conservative: {
    freshUsd: 6.65434,
    cumulativeUsd: 7.4265277,
    exceedsFreshMeterByUsd: 0.4265277,
    tokens: {
      geminiInput: 2_000_000,
      geminiOutputIncludingThinking: 2_417_536,
      judgeInput: 4_000,
      judgeOutput: 50,
    },
  },
  freshMeterCapUsd: ACTIVE_BRAIN_FRESH_METER_CAP_USD,
  capMayStopEarly: true,
  methodVersion: 'active-brain-first5-complete-context-v1',
  requestStats: {
    benchmarkWriterRequests: 1_207,
    compatibilitySmokeWriterRequests: 1,
    rawTurns: 2_398,
    questions: 5,
    sessions: 232,
    serializedWriterBodyChars: 4_627_564,
    serializedWriterBodyBytes: 4_628_234,
    writerLogicalRequestLimit: 1_208,
    productMaxChars: ACTIVE_BRAIN_PRODUCT_MAX_CHARS,
  },
})

export const ACTIVE_BRAIN_REQUIRED_ARTIFACT_PATHS = Object.freeze(
  [...new Set([
    ...J4_REQUIRED_ARTIFACT_PATHS,
    'evals/active-brain-live-config.mjs',
    'evals/active-brain-live-meter.mjs',
    'evals/arms/active-brain-longmemeval-live-arm.mjs',
    'evals/run-active-brain-live.mjs',
    'src/brain.mjs',
    'src/index.mjs',
    'src/statement-extraction.mjs',
  ])].sort(),
)

export function activeBrainWriterContractSha256() {
  const request = buildStatementExtractionRequest({
    turn: {
      assistantMessage: '',
      userMessage: '',
    },
  })
  return activeBrainSha256(JSON.stringify({
    generationConfig: request.generationConfig,
    systemInstruction: request.systemInstruction,
  }))
}

export function activeBrainAnswerContractSha256() {
  return activeBrainSha256(buildAnswerPrompt({
    briefingText: '{MEMORY_BRIEFING}',
    question: '{QUESTION}',
    questionDate: '{QUESTION_DATE}',
  }))
}

export class ActiveBrainConfigError extends Error {
  constructor(code, message, { cause } = {}) {
    super(message, cause ? { cause } : undefined)
    this.name = 'ActiveBrainConfigError'
    this.code = code
  }
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ActiveBrainConfigError(
      'CONFIG_SCHEMA',
      `${label} must be an object.`,
    )
  }
}

function assertExactKeys(value, keys, label) {
  assertPlainObject(value, label)
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new ActiveBrainConfigError(
      'CONFIG_SCHEMA',
      `${label} keys differ from the frozen schema.`,
    )
  }
}

function assertEqual(actual, expected, label) {
  if (stableActiveBrainStringify(actual) !==
    stableActiveBrainStringify(expected)) {
    throw new ActiveBrainConfigError(
      'CONFIG_MISMATCH',
      `${label} differs from the frozen active-brain contract.`,
    )
  }
}

function assertSha256(value, label) {
  if (!/^[a-f0-9]{64}$/.test(String(value ?? ''))) {
    throw new ActiveBrainConfigError(
      'CONFIG_SCHEMA',
      `${label} must be one SHA-256.`,
    )
  }
}

function expectedPredictionPromptConfig() {
  return {
    answer: {
      maxChars: ACTIVE_BRAIN_PRODUCT_MAX_CHARS,
      maxOutputTokens: ACTIVE_BRAIN_ANSWER_MAX_OUTPUT_TOKENS,
      memorySet: 'complete-scoped-or-refuse',
      store: false,
      thinkingLevel: 'MINIMAL',
    },
    judge: {
      parser: 'official-response-contains-yes',
      unchanged: true,
    },
    writer: {
      evidenceFields: ['userMessage', 'palariMessage'],
      hostAssignedSourceKinds: ['user_message', 'assistant_message'],
      maxOutputTokens: ACTIVE_BRAIN_WRITER_MAX_OUTPUT_TOKENS,
      responseFormat: 'APPLICATION_JSON+json-schema',
      schemaSha256: ACTIVE_BRAIN_STATEMENT_SCHEMA_SHA256,
      store: false,
      thinkingLevel: 'MINIMAL',
    },
  }
}

function validatePredictions(value) {
  assertExactKeys(value, [
    'basisDefinitions',
    'decisionReference',
    'frozenAt',
    'method',
    'models',
    'population',
    'predictions',
    'promptConfig',
    'rowArraySha256',
    'runId',
    'schemaVersion',
    'status',
    'summary',
  ], 'active-brain predictions')
  assertEqual(value.schemaVersion, 1, 'prediction schema version')
  assertEqual(value.runId, ACTIVE_BRAIN_LIVE_RUN_ID, 'prediction run ID')
  assertEqual(value.status, 'FINAL', 'prediction status')
  assertEqual(value.frozenAt, ACTIVE_BRAIN_RUN_DATE, 'prediction freeze date')
  assertEqual(value.decisionReference, {
    cumulativeHardCapUsd: 7,
    date: ACTIVE_BRAIN_RUN_DATE,
    document: 'docs/DECISIONS.md',
    entry: 'FOUNDER GO — J4.2K active first-five live measurement',
    questions: 5,
  }, 'prediction decision reference')
  assertEqual(value.models, {
    answer: ACTIVE_BRAIN_GEMINI_MODEL,
    judge: LONGMEMEVAL_JUDGE_MODEL,
    writer: ACTIVE_BRAIN_GEMINI_MODEL,
  }, 'prediction models')
  assertEqual(
    value.promptConfig,
    expectedPredictionPromptConfig(),
    'prediction prompt configuration',
  )
  assertEqual(value.population, {
    questionIdsSha256: ACTIVE_BRAIN_QUESTION_IDS_SHA256,
    questions: 5,
  }, 'prediction population')
  assertEqual(value.method, {
    finalizedBeforeProviderCalls: true,
    hypotheses: [
      'exact durable quotes admit ordinary user statements without English regex policy',
      'Palari statements remain available with assistant provenance',
      'complete scoped recall removes lexical relevance misses',
      'speaker chronology gives the answer model all correction and temporal evidence',
      'complete context permits an evidence-bounded abstention',
    ],
    note:
      'These five outcomes are newly preregistered for the changed active J4.2K path after reviewing predecessor failure categories. They do not alter, regrade, import, replace, or combine any V5 result.',
  }, 'prediction method')
  assertEqual(value.basisDefinitions, {
    CHRONOLOGY_COMPLETE:
      'Exact quotes preserve the successive user statements and complete recall presents them in evidence chronology.',
    USER_PREFERENCE_EXACT_QUOTE:
      'The durable user preference can be selected as an exact user quote and cannot be lost through lexical query mismatch.',
    ASSISTANT_PROVENANCE_EXACT_QUOTE:
      'The required Palari statement can be selected verbatim, stored as assistant_message, and recalled without being recast as a user fact.',
    TEMPORAL_COMPLETE_CONTEXT:
      'Every admitted event remains in the complete chronological briefing so the answer model receives the full temporal evidence.',
    ABSTENTION_COMPLETE_CONTEXT:
      'The complete scoped set contains nearby evidence but not the asked target, allowing the answer model to state insufficiency.',
  }, 'prediction basis definitions')
  if (!Array.isArray(value.predictions) || value.predictions.length !== 5) {
    throw new ActiveBrainConfigError(
      'PREDICTIONS_SCHEMA',
      'Active-brain predictions must contain exactly five ordered rows.',
    )
  }
  assertEqual(
    value.predictions.map((row) => row?.questionId),
    J4_FIRST_TRANCHE_QUESTION_IDS,
    'prediction question order',
  )
  for (let index = 0; index < value.predictions.length; index += 1) {
    const row = value.predictions[index]
    assertExactKeys(row, [
      'basisCode',
      'isAbstention',
      'ordinal',
      'predictedFailureStage',
      'predictedOfficialCorrect',
      'questionId',
      'questionType',
    ], `active-brain prediction ${index + 1}`)
    if (row.ordinal !== index + 1 ||
      row.predictedOfficialCorrect !== true ||
      row.predictedFailureStage !== 'none' ||
      row.isAbstention !== row.questionId.endsWith('_abs') ||
      !Object.hasOwn(value.basisDefinitions, row.basisCode)) {
      throw new ActiveBrainConfigError(
        'PREDICTIONS_SCHEMA',
        `Active-brain prediction ${index + 1} is inconsistent.`,
      )
    }
  }
  assertEqual(value.summary, {
    byType: {
      'knowledge-update': '1/1',
      'multi-session': '1/1',
      'single-session-assistant': '1/1',
      'single-session-preference': '1/1',
      'temporal-reasoning': '1/1',
    },
    failureStages: {
      answer: 0,
      capacity: 0,
      write: 0,
    },
    predictedCorrect: 5,
    predictedIncorrect: 0,
  }, 'prediction summary')
  assertEqual(
    activeBrainSha256(JSON.stringify(value.predictions)),
    ACTIVE_BRAIN_PREDICTION_ROWS_SHA256,
    'prediction row-array hash',
  )
  assertEqual(
    value.rowArraySha256,
    ACTIVE_BRAIN_PREDICTION_ROWS_SHA256,
    'declared prediction row-array hash',
  )
  return value
}

function validateConfig(config) {
  assertExactKeys(config, [
    'artifacts',
    'costEstimate',
    'dataset',
    'generation',
    'limits',
    'models',
    'population',
    'predecessorChain',
    'predictions',
    'pricesUsdPerToken',
    'product',
    'prompts',
    'runDate',
    'runId',
    'schemaVersion',
    'tranches',
  ], 'active-brain live config')
  assertEqual(config.schemaVersion, 1, 'config schema version')
  assertEqual(config.runId, ACTIVE_BRAIN_LIVE_RUN_ID, 'config run ID')
  assertEqual(config.runDate, ACTIVE_BRAIN_RUN_DATE, 'config run date')
  assertEqual(config.dataset, {
    path: 'data/longmemeval_s_cleaned.json',
    sha256: J4_S_DATASET_CONTRACT.sha256,
  }, 'dataset identity')
  assertEqual(config.models, {
    answer: ACTIVE_BRAIN_GEMINI_MODEL,
    judge: LONGMEMEVAL_JUDGE_MODEL,
    writer: ACTIVE_BRAIN_GEMINI_MODEL,
  }, 'provider models')
  assertEqual(config.generation, {
    answerMaxOutputTokens: ACTIVE_BRAIN_ANSWER_MAX_OUTPUT_TOKENS,
    judgeMaxTokens: LONGMEMEVAL_JUDGE_REQUEST.maxTokens,
    judgeN: LONGMEMEVAL_JUDGE_REQUEST.n,
    judgeTemperature: LONGMEMEVAL_JUDGE_REQUEST.temperature,
    thinkingLevel: 'MINIMAL',
    writerMaxOutputTokens: ACTIVE_BRAIN_WRITER_MAX_OUTPUT_TOKENS,
  }, 'generation settings')
  assertEqual(config.product, {
    admission: 'exact_quote_host_role',
    maxChars: ACTIVE_BRAIN_PRODUCT_MAX_CHARS,
    recall: 'complete_scoped_set',
  }, 'active product settings')
  assertEqual(config.population, {
    questionIds: J4_FIRST_TRANCHE_QUESTION_IDS,
    questionIdsSha256: ACTIVE_BRAIN_QUESTION_IDS_SHA256,
    questions: 5,
    sealedQuestionIds: SEALED_U8_QUESTION_IDS,
  }, 'population contract')
  assertEqual(config.tranches, ACTIVE_BRAIN_TRANCHES, 'tranche contract')
  assertEqual(
    config.limits,
    ACTIVE_BRAIN_CUMULATIVE_LIMITS,
    'meter limits',
  )
  assertEqual(
    config.pricesUsdPerToken,
    ACTIVE_BRAIN_PRICES_USD_PER_TOKEN,
    'provider prices',
  )
  assertEqual(
    config.costEstimate,
    ACTIVE_BRAIN_COST_ESTIMATE,
    'cost estimate',
  )
  assertEqual(
    config.predecessorChain,
    ACTIVE_BRAIN_PREDECESSOR_CHAIN,
    'predecessor chain',
  )
  assertEqual(config.prompts, {
    answerContractSha256: activeBrainAnswerContractSha256(),
    judgeSourceSha256: longMemEvalJudgeProvenance.sourceSha256,
    statementWriterContractSha256: activeBrainWriterContractSha256(),
    statementWriterSchemaSha256: ACTIVE_BRAIN_STATEMENT_SCHEMA_SHA256,
  }, 'prompt contracts')
  assertExactKeys(
    config.predictions,
    ['path', 'sha256'],
    'prediction reference',
  )
  assertEqual(
    config.predictions.path,
    ACTIVE_BRAIN_LIVE_PREDICTIONS_PATH,
    'prediction path',
  )
  assertSha256(config.predictions.sha256, 'prediction hash')
  if (!Array.isArray(config.artifacts) ||
    config.artifacts.length !== ACTIVE_BRAIN_REQUIRED_ARTIFACT_PATHS.length) {
    throw new ActiveBrainConfigError(
      'CONFIG_SCHEMA',
      'Active-brain artifacts must pin the exact implementation closure.',
    )
  }
  const paths = []
  for (const artifact of config.artifacts) {
    assertExactKeys(artifact, ['path', 'sha256'], 'implementation artifact')
    if (typeof artifact.path !== 'string' ||
      !artifact.path ||
      artifact.path.startsWith('/') ||
      artifact.path.split('/').includes('..') ||
      paths.includes(artifact.path)) {
      throw new ActiveBrainConfigError(
        'CONFIG_SCHEMA',
        'Artifact paths must be unique safe repository-relative paths.',
      )
    }
    assertSha256(artifact.sha256, `artifact ${artifact.path} hash`)
    paths.push(artifact.path)
  }
  assertEqual(
    [...paths].sort(),
    [...ACTIVE_BRAIN_REQUIRED_ARTIFACT_PATHS].sort(),
    'implementation artifact paths',
  )
  return config
}

export async function loadActiveBrainLiveConfig({
  configPath = ACTIVE_BRAIN_LIVE_CONFIG_PATH,
  repoRoot,
} = {}) {
  if (!repoRoot) {
    throw new ActiveBrainConfigError(
      'CONFIG_REPO_ROOT',
      'Active-brain config loading requires the repository root.',
    )
  }
  const root = resolve(repoRoot)
  const configText = await readFile(resolve(root, configPath), 'utf8')
  let config
  try {
    config = validateConfig(JSON.parse(configText))
  } catch (error) {
    if (error instanceof ActiveBrainConfigError) throw error
    throw new ActiveBrainConfigError(
      'CONFIG_JSON',
      'Active-brain live config is not valid JSON.',
      { cause: error },
    )
  }
  const predictionsText = await readFile(
    resolve(root, config.predictions.path),
    'utf8',
  )
  if (activeBrainSha256(predictionsText) !== config.predictions.sha256) {
    throw new ActiveBrainConfigError(
      'PREDICTIONS_HASH',
      'Active-brain FINAL predictions differ from their frozen hash.',
    )
  }
  let predictions
  try {
    predictions = validatePredictions(JSON.parse(predictionsText))
  } catch (error) {
    if (error instanceof ActiveBrainConfigError) throw error
    throw new ActiveBrainConfigError(
      'PREDICTIONS_JSON',
      'Active-brain FINAL predictions are not valid JSON.',
      { cause: error },
    )
  }
  for (const artifact of config.artifacts) {
    const bytes = await readFile(resolve(root, artifact.path))
    if (activeBrainSha256(bytes) !== artifact.sha256) {
      throw new ActiveBrainConfigError(
        'ARTIFACT_HASH',
        `Tracked active-brain artifact changed: ${artifact.path}.`,
      )
    }
  }
  return deepFreeze({
    config,
    configPath,
    configSha256: activeBrainSha256(configText),
    predictions,
    predictionsSha256: activeBrainSha256(predictionsText),
  })
}

export async function loadActiveBrainLiveAuthority({
  authorityPath = ACTIVE_BRAIN_LIVE_AUTHORITY_PATH,
  repoRoot,
} = {}) {
  if (!repoRoot) {
    throw new ActiveBrainConfigError(
      'AUTHORITY_REPO_ROOT',
      'Active-brain authority loading requires the repository root.',
    )
  }
  const text = await readFile(resolve(repoRoot, authorityPath), 'utf8')
  let authority
  try {
    authority = JSON.parse(text)
  } catch (error) {
    throw new ActiveBrainConfigError(
      'AUTHORITY_JSON',
      'Active-brain authority is not valid JSON.',
      { cause: error },
    )
  }
  assertExactKeys(authority, [
    'cumulativeCapUsd',
    'cumulativeQuestions',
    'decisionReference',
    'founderGoDate',
    'fromCumulativeQuestions',
    'previousCheckpointSha256',
    'runId',
    'schemaVersion',
  ], 'active-brain authority')
  assertEqual(authority, {
    cumulativeCapUsd: 7,
    cumulativeQuestions: 5,
    decisionReference:
      'docs/DECISIONS.md — FOUNDER GO — J4.2K active first-five live measurement',
    founderGoDate: ACTIVE_BRAIN_RUN_DATE,
    fromCumulativeQuestions: 0,
    previousCheckpointSha256: null,
    runId: ACTIVE_BRAIN_LIVE_RUN_ID,
    schemaVersion: 1,
  }, 'active-brain authority')
  return deepFreeze({
    authority,
    authorityPath,
    authoritySha256: activeBrainSha256(text),
  })
}

export function assertActiveBrainLiveEnvironment(
  env,
  config,
  authority,
) {
  if (env.PALARI_ACTIVE_CONFIRM_SPEND !== '1') {
    throw new ActiveBrainConfigError(
      'SPEND_NOT_CONFIRMED',
      'PALARI_ACTIVE_CONFIRM_SPEND must equal 1.',
    )
  }
  const cumulativeQuestions = Number(
    env.PALARI_ACTIVE_CUMULATIVE_QUESTIONS,
  )
  const capUsd = Number(env.PALARI_ACTIVE_SPEND_CAP_USD)
  if (cumulativeQuestions !== 5 ||
    capUsd !== 7 ||
    !config?.tranches?.some((entry) =>
      entry.cumulativeQuestions === cumulativeQuestions &&
      entry.cumulativeCapUsd === capUsd) ||
    authority?.runId !== ACTIVE_BRAIN_LIVE_RUN_ID ||
    authority?.cumulativeQuestions !== cumulativeQuestions ||
    authority?.cumulativeCapUsd !== capUsd) {
    throw new ActiveBrainConfigError(
      'TRANCHE_NOT_AUTHORIZED',
      'Runtime boundary does not match the active-brain founder authority.',
    )
  }
  const geminiApiKey = String(env.GEMINI_API_KEY ?? '').trim()
  const openaiApiKey = String(env.OPENAI_API_KEY ?? '').trim()
  if (!geminiApiKey) {
    throw new ActiveBrainConfigError(
      'NO_GEMINI_KEY',
      'GEMINI_API_KEY is absent.',
    )
  }
  if (!openaiApiKey) {
    throw new ActiveBrainConfigError(
      'NO_OPENAI_KEY',
      'OPENAI_API_KEY is absent.',
    )
  }
  return {
    capUsd,
    cumulativeQuestions,
    geminiApiKey,
    openaiApiKey,
  }
}

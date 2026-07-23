// Frozen configuration surface for the founder-gated J4 LongMemEval run.
//
// Importing this module is inert: it reads no credentials, opens no files, and
// performs no network work. The runner explicitly loads and verifies the
// tracked config only after canonical dataset validation.

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { buildMemoryExtractionRequest } from '../src/memory-extraction.mjs'
import {
  LONGMEMEVAL_JUDGE_MODEL,
  LONGMEMEVAL_JUDGE_REQUEST,
  longMemEvalJudgeProvenance,
} from './longmemeval-judge.mjs'
import {
  J4_FIRST_TRANCHE_QUESTION_IDS,
  J4_GEMINI_GENERATION_LIMITS,
  J4_PROPOSED_TRANCHE_GATES,
  J4_PUBLIC_SAMPLE_QUESTION_IDS,
  J4_S_DATASET_CONTRACT,
  J4_STAGED_EXECUTION_ORDER_SHA256,
  J4_STAGED_TRANCHE_MANIFEST_SHA256,
  SEALED_U8_QUESTION_IDS,
} from './longmemeval-plan.mjs'

export const J4_LIVE_RUN_ID = 'j4-longmemeval-s60-v2'
export const J4_LIVE_CONFIG_PATH =
  `evals/live-runs/${J4_LIVE_RUN_ID}.json`
export const J4_LIVE_AUTHORITY_PATH =
  `evals/live-runs/${J4_LIVE_RUN_ID}.authority.json`
export const J4_LIVE_PREDICTIONS_PATH =
  `evals/predictions/${J4_LIVE_RUN_ID}.json`
export const J4_GEMINI_MODEL = 'gemini-3.5-flash-lite'
export const J4_LIVE_RESULTS_ROOT = 'evals/results'
export const J4_CARRIED_ACCOUNTED_USD = 0.0004494
export const J4_FRESH_METER_CAP_USD = 2.4995506
export const J4_REPLACEMENT_PREDECESSOR = Object.freeze({
  accountedUsd: J4_CARRIED_ACCOUNTED_USD,
  artifactManifestPath:
    'evals/results/j4-longmemeval-s60-v1/artifact-manifest.json',
  artifactManifestSha256:
    '271c9685ffdd15392d71452a4d7e223958e340266b89d983402d02bced8448ad',
  checkpointPath:
    'evals/results/j4-longmemeval-s60-v1/checkpoint.json',
  checkpointSha256:
    'f985bdd31e43ca6c9bc4e02c03864f9431e7a72953daba456a3aefaea8cfa215',
  completedQuestions: 0,
  meterPath: 'evals/results/j4-longmemeval-s60-v1/meter.jsonl',
  meterSha256:
    'e819c456ddf40de85ea73706087fd208f38653a7e597967f0500242c50ba6a90',
  runId: 'j4-longmemeval-s60-v1',
  status: 'failed',
})
export const J4_PREDICTION_ROWS_SHA256 =
  '12eabc841b63aac5164e828d64bd0e118750337192e3b5984f7d7a3924272351'
export const J4_REQUIRED_ARTIFACT_PATHS = Object.freeze([
  'evals/arms/kernel-longmemeval-live-arm.mjs',
  'evals/live-transcript.mjs',
  'evals/longmemeval-judge.mjs',
  'evals/longmemeval-live-config.mjs',
  'evals/longmemeval-live-meter.mjs',
  'evals/longmemeval-plan.mjs',
  'evals/run-longmemeval-live.mjs',
  'src/adapter.mjs',
  'src/gate.mjs',
  'src/gemini.mjs',
  'src/longmemeval.mjs',
  'src/memory-briefing.mjs',
  'src/memory-extraction.mjs',
  'src/memory-store.mjs',
  'src/recall.mjs',
  'src/routing-budgets.mjs',
  'src/store.mjs',
  'src/util.mjs',
  'src/v05-memory-extraction.mjs',
])
export const J4_RETRY_LIMIT = 3
export const J4_REQUEST_TIMEOUT_MS = 60_000
export const J4_MAX_RESPONSE_BYTES = 4 * 1024 * 1024
export const J4_PRICES_USD_PER_TOKEN = Object.freeze({
  geminiInput: 0.30 / 1_000_000,
  geminiOutputIncludingThinking: 2.50 / 1_000_000,
  judgeInput: 2.50 / 1_000_000,
  judgeOutput: 10.00 / 1_000_000,
})

function cumulativeLimits({
  cumulativeCapUsd,
  cumulativeQuestions,
  maxAttempts,
  answer,
  judge,
  writer,
}) {
  return Object.freeze({
    cumulativeCapUsd,
    cumulativeQuestions,
    meter: Object.freeze({
      maxAttempts,
      maxLogicalRequests: Object.freeze({ answer, judge, writer }),
      maxTokens: Object.freeze({
        geminiInput: Math.floor(cumulativeCapUsd * 1_000_000 / 0.30),
        geminiOutputIncludingThinking: Math.floor(
          cumulativeCapUsd * 1_000_000 / 2.50,
        ),
        judgeInput: Math.floor(cumulativeCapUsd * 1_000_000 / 2.50),
        judgeOutput: Math.floor(cumulativeCapUsd * 1_000_000 / 10.00),
      }),
      maxResponseBytes: J4_MAX_RESPONSE_BYTES,
      requestTimeoutMs: J4_REQUEST_TIMEOUT_MS,
      retryLimit: J4_RETRY_LIMIT,
    }),
  })
}

// The one compatibility smoke is a Gemini writer request. These immutable
// rows allow later founder-authorized tranches to reuse the exact evaluation
// bytes while keeping every cumulative request/token ceiling finite.
export const J4_CUMULATIVE_LIMITS = Object.freeze([
  cumulativeLimits({
    answer: 5,
    cumulativeCapUsd: 2.5,
    cumulativeQuestions: 5,
    judge: 5,
    maxAttempts: 4_808,
    writer: 1_192,
  }),
  cumulativeLimits({
    answer: 15,
    cumulativeCapUsd: 7.5,
    cumulativeQuestions: 15,
    judge: 15,
    maxAttempts: 14_472,
    writer: 3_588,
  }),
  cumulativeLimits({
    answer: 25,
    cumulativeCapUsd: 12.5,
    cumulativeQuestions: 25,
    judge: 25,
    maxAttempts: 24_628,
    writer: 6_107,
  }),
  cumulativeLimits({
    answer: 35,
    cumulativeCapUsd: 17.5,
    cumulativeQuestions: 35,
    judge: 35,
    maxAttempts: 34_516,
    writer: 8_559,
  }),
  cumulativeLimits({
    answer: 45,
    cumulativeCapUsd: 22.5,
    cumulativeQuestions: 45,
    judge: 45,
    maxAttempts: 44_416,
    writer: 11_014,
  }),
  cumulativeLimits({
    answer: 55,
    cumulativeCapUsd: 27.5,
    cumulativeQuestions: 55,
    judge: 55,
    maxAttempts: 54_136,
    writer: 13_424,
  }),
  cumulativeLimits({
    answer: 60,
    cumulativeCapUsd: 30,
    cumulativeQuestions: 60,
    judge: 60,
    maxAttempts: 59_088,
    writer: 14_652,
  }),
])

export const J4_TRANCHE_1_LIMITS = J4_CUMULATIVE_LIMITS[0].meter

export function j4LimitsForCumulativeQuestions(value) {
  const found = J4_CUMULATIVE_LIMITS.find(
    (entry) => entry.cumulativeQuestions === Number(value),
  )
  if (!found) {
    throw new J4ConfigError(
      'LIMITS_GATE_INVALID',
      'J4 has no frozen limits for that cumulative boundary.',
    )
  }
  return found.meter
}

export const J4_GEMINI_WRITER_GENERATION = Object.freeze({
  maxOutputTokens: J4_GEMINI_GENERATION_LIMITS.writerMaxOutputTokens,
  responseMimeType: 'application/json',
  thinkingConfig: Object.freeze({ thinkingLevel: 'MINIMAL' }),
})

export const J4_GEMINI_ANSWER_GENERATION = Object.freeze({
  maxOutputTokens: J4_GEMINI_GENERATION_LIMITS.answerMaxOutputTokens,
  thinkingConfig: Object.freeze({ thinkingLevel: 'MINIMAL' }),
})

export const J4_OFFICIAL_FACT_TEMPLATE = [
  'I will give you several facts extracted from history chats between you and a user. Please answer the question based on the relevant facts.',
  '',
  '',
  'History Chats:',
  '',
  '{}',
  '',
  'Current Date: {}',
  'Question: {}',
  'Answer:',
].join('\n')

export class J4ConfigError extends Error {
  constructor(code, message, { cause } = {}) {
    super(message, cause ? { cause } : undefined)
    this.name = 'J4ConfigError'
    this.code = code
  }
}

export function j4Sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function formatTemplate(template, values) {
  let index = 0
  const output = template.replaceAll('{}', () => String(values[index++] ?? ''))
  if (index !== values.length) {
    throw new J4ConfigError(
      'ANSWER_TEMPLATE_ARITY',
      'J4 answer template/value arity mismatch.',
    )
  }
  return output
}

export function formatJ4QuestionDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new J4ConfigError(
      'QUESTION_DATE_INVALID',
      'J4 question date must be a valid timestamp.',
    )
  }
  return date.toISOString().slice(0, 10).replaceAll('-', '/')
}

export function buildJ4AnswerPrompt({
  facts = '',
  question = '',
  questionDate,
} = {}) {
  return formatTemplate(J4_OFFICIAL_FACT_TEMPLATE, [
    String(facts),
    formatJ4QuestionDate(questionDate),
    String(question),
  ])
}

export function buildJ4WriterBody(turn = {}) {
  const request = buildMemoryExtractionRequest({ turn })
  return {
    contents: request.contents,
    generationConfig: {
      maxOutputTokens: J4_GEMINI_WRITER_GENERATION.maxOutputTokens,
      responseMimeType: J4_GEMINI_WRITER_GENERATION.responseMimeType,
      thinkingConfig: {
        thinkingLevel:
          J4_GEMINI_WRITER_GENERATION.thinkingConfig.thinkingLevel,
      },
    },
    systemInstruction: request.systemInstruction,
  }
}

export function buildJ4AnswerBody(prompt, {
  generation = J4_GEMINI_ANSWER_GENERATION,
} = {}) {
  return {
    contents: [{
      parts: [{ text: String(prompt) }],
      role: 'user',
    }],
    generationConfig: {
      maxOutputTokens: generation.maxOutputTokens,
      thinkingConfig: {
        thinkingLevel: generation.thinkingConfig.thinkingLevel,
      },
    },
  }
}

export function j4ExtractionPromptSha256() {
  const body = buildJ4WriterBody({
    assistantMessage: '',
    palariId: 'palari-longmemeval-j4',
    palariName: 'Palari',
    sourceMessageId: 'session:0',
    sourceTexts: [],
    userId: 'user-longmemeval-j4',
    userMessage: '',
    userName: 'user',
  })
  return j4Sha256(JSON.stringify({
    generationConfig: body.generationConfig,
    systemInstruction: body.systemInstruction,
  }))
}

export function j4ExecutionQuestionIds() {
  const sentinels = new Set(J4_FIRST_TRANCHE_QUESTION_IDS)
  return [
    ...J4_FIRST_TRANCHE_QUESTION_IDS,
    ...J4_PUBLIC_SAMPLE_QUESTION_IDS
      .filter((questionId) => !sentinels.has(questionId))
      .sort(),
  ]
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new J4ConfigError('CONFIG_SCHEMA', `${label} must be an object.`)
  }
}

function assertExactKeys(value, keys, label) {
  assertPlainObject(value, label)
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new J4ConfigError(
      'CONFIG_SCHEMA',
      `${label} keys differ from the frozen schema.`,
    )
  }
}

function assertEqual(actual, expected, label) {
  if (stableStringify(actual) !== stableStringify(expected)) {
    throw new J4ConfigError(
      'CONFIG_MISMATCH',
      `${label} differs from the frozen J4 contract.`,
    )
  }
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableValue(value[key])]),
  )
}

export function stableStringify(value) {
  return JSON.stringify(stableValue(value))
}

function assertSha(value, label) {
  if (!/^[a-f0-9]{64}$/.test(String(value ?? ''))) {
    throw new J4ConfigError('CONFIG_SCHEMA', `${label} must be one SHA-256.`)
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  for (const child of Object.values(value)) deepFreeze(child)
  return Object.freeze(value)
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
  ], 'J4 predictions')
  assertEqual(value.schemaVersion, 1, 'prediction schema version')
  assertEqual(value.status, 'FINAL', 'prediction status')
  assertEqual(value.runId, J4_LIVE_RUN_ID, 'prediction run ID')
  assertEqual(value.models, {
    answer: J4_GEMINI_MODEL,
    judge: LONGMEMEVAL_JUDGE_MODEL,
    writer: J4_GEMINI_MODEL,
  }, 'prediction models')
  assertEqual(value.promptConfig, {
    answer: {
      chainOfThought: false,
      maxOutputTokens: J4_GEMINI_GENERATION_LIMITS.answerMaxOutputTokens,
      template: 'official-longmemeval-fact-memory',
      thinkingLevel: J4_GEMINI_GENERATION_LIMITS.thinkingLevel,
    },
    judge: {
      parser: 'official-response-contains-yes',
      unchanged: true,
    },
    writer: {
      maxOutputTokens: J4_GEMINI_GENERATION_LIMITS.writerMaxOutputTokens,
      sourceKindVocabulary: [
        'user_message',
        'source_document',
        'tool_output',
        'web_result',
      ],
      thinkingLevel: J4_GEMINI_GENERATION_LIMITS.thinkingLevel,
    },
  }, 'prediction prompt config')
  assertEqual(value.decisionReference, {
    cumulativeHardCapUsd: 2.5,
    date: '2026-07-23',
    document: 'docs/DECISIONS.md',
    entry: 'FOUNDER GO — J4 replacement run',
    questions: 5,
  }, 'prediction founder decision reference')
  if (value.method?.finalizedBeforeProviderCalls !== true) {
    throw new J4ConfigError(
      'PREDICTIONS_SCHEMA',
      'J4 predictions must state that they were finalized before calls.',
    )
  }
  assertPlainObject(value.population, 'prediction population')
  assertEqual(
    value.population.executionOrderSha256,
    J4_STAGED_EXECUTION_ORDER_SHA256,
    'prediction execution-order hash',
  )
  assertEqual(value.population.questions, 60, 'prediction question count')
  assertEqual(
    value.population.selectedQuestionIdsSha256,
    'c720306125284ae03813ed131a044cd6b22d5301ad817da2907a6043768baa3a',
    'prediction selected-ID hash',
  )
  assertPlainObject(value.basisDefinitions, 'prediction basis definitions')
  if (!Array.isArray(value.predictions)) {
    throw new J4ConfigError(
      'PREDICTIONS_SCHEMA',
      'J4 predictions must contain an ordered predictions array.',
    )
  }
  const expectedIds = j4ExecutionQuestionIds()
  const actualIds = value.predictions.map((entry) => entry?.questionId)
  assertEqual(actualIds, expectedIds, 'prediction question order')
  if (new Set(actualIds).size !== expectedIds.length) {
    throw new J4ConfigError(
      'PREDICTIONS_SCHEMA',
      'J4 prediction question IDs must be unique.',
    )
  }
  for (let index = 0; index < value.predictions.length; index += 1) {
    const entry = value.predictions[index]
    assertExactKeys(entry, [
      'basisCode',
      'isAbstention',
      'ordinal',
      'predictedFailureStage',
      'predictedOfficialCorrect',
      'questionId',
      'questionType',
    ], `J4 prediction ${index + 1}`)
    assertEqual(entry.ordinal, index + 1, `prediction ${index + 1} ordinal`)
    if (typeof entry.predictedOfficialCorrect !== 'boolean') {
      throw new J4ConfigError(
        'PREDICTIONS_SCHEMA',
        `Prediction ${index + 1} must predict a Boolean official outcome.`,
      )
    }
    if (!['answer', 'none', 'retrieval', 'write'].includes(
      entry.predictedFailureStage,
    )) {
      throw new J4ConfigError(
        'PREDICTIONS_SCHEMA',
        `Prediction ${index + 1} has an invalid failure stage.`,
      )
    }
    if (entry.isAbstention !== entry.questionId.endsWith('_abs') ||
      entry.predictedOfficialCorrect !==
        (entry.predictedFailureStage === 'none') ||
      typeof entry.questionType !== 'string' ||
      !Object.hasOwn(value.basisDefinitions, entry.basisCode)) {
      throw new J4ConfigError(
        'PREDICTIONS_SCHEMA',
        `Prediction ${index + 1} has inconsistent metadata or basis.`,
      )
    }
  }
  assertEqual(
    j4Sha256(JSON.stringify(value.predictions)),
    J4_PREDICTION_ROWS_SHA256,
    'prediction row-array hash',
  )
  assertEqual(
    value.rowArraySha256,
    J4_PREDICTION_ROWS_SHA256,
    'declared prediction row-array hash',
  )
  assertPlainObject(value.decisionReference, 'prediction decision reference')
  assertPlainObject(value.method, 'prediction method')
  assertPlainObject(value.promptConfig, 'prediction prompt config')
  assertPlainObject(value.summary, 'prediction summary')
  assertEqual(value.summary, {
    byType: {
      'knowledge-update': '9/10',
      'multi-session': '6/10',
      'single-session-assistant': '0/10',
      'single-session-preference': '4/10',
      'single-session-user': '10/10',
      'temporal-reasoning': '7/10',
    },
    failureStages: {
      answer: 0,
      retrieval: 16,
      write: 8,
    },
    predictedCorrect: 36,
    predictedIncorrect: 24,
  }, 'prediction summary')
  assertEqual(value.method, {
    finalizedBeforeProviderCalls: true,
    hypotheses: [
      'direct-user write boundary',
      'lexical FTS recall with a five-term query limit and no stemming',
    ],
    note:
      'Prediction rows were finalized before any J4 provider call and reviewed byte-for-byte unchanged before the v2 replacement run after the vocabulary-only sourceKind prompt fix.',
  }, 'prediction method')
  return value
}

function validateConfig(config) {
  assertExactKeys(config, [
    'artifacts',
    'dataset',
    'generation',
    'limits',
    'models',
    'population',
    'predecessor',
    'predictions',
    'pricesUsdPerToken',
    'prompts',
    'runDate',
    'runId',
    'schemaVersion',
    'tranches',
  ], 'J4 live config')
  assertEqual(config.schemaVersion, 1, 'config schema version')
  assertEqual(config.runId, J4_LIVE_RUN_ID, 'config run ID')
  assertEqual(config.runDate, '2026-07-23', 'config run date')
  assertEqual(config.dataset, {
    path: 'data/longmemeval_s_cleaned.json',
    sha256: J4_S_DATASET_CONTRACT.sha256,
  }, 'dataset identity')
  assertEqual(config.models, {
    answer: J4_GEMINI_MODEL,
    judge: LONGMEMEVAL_JUDGE_MODEL,
    writer: J4_GEMINI_MODEL,
  }, 'provider models')
  assertEqual(config.generation, {
    answerMaxOutputTokens:
      J4_GEMINI_GENERATION_LIMITS.answerMaxOutputTokens,
    judgeMaxTokens: LONGMEMEVAL_JUDGE_REQUEST.maxTokens,
    judgeN: LONGMEMEVAL_JUDGE_REQUEST.n,
    judgeTemperature: LONGMEMEVAL_JUDGE_REQUEST.temperature,
    thinkingLevel: J4_GEMINI_GENERATION_LIMITS.thinkingLevel,
    writerMaxOutputTokens:
      J4_GEMINI_GENERATION_LIMITS.writerMaxOutputTokens,
  }, 'generation settings')
  assertEqual(config.limits, J4_CUMULATIVE_LIMITS, 'cumulative hard limits')
  assertEqual(
    config.pricesUsdPerToken,
    J4_PRICES_USD_PER_TOKEN,
    'provider prices',
  )
  assertEqual(config.population, {
    executionOrderSha256: J4_STAGED_EXECUTION_ORDER_SHA256,
    questions: 60,
    sealedQuestionIds: SEALED_U8_QUESTION_IDS,
    trancheManifestSha256: J4_STAGED_TRANCHE_MANIFEST_SHA256,
  }, 'population contract')
  assertEqual(
    config.predecessor,
    J4_REPLACEMENT_PREDECESSOR,
    'replacement predecessor and carried spend',
  )
  assertEqual(config.tranches, J4_PROPOSED_TRANCHE_GATES, 'tranche gates')
  assertEqual(config.prompts, {
    answerTemplateSha256: j4Sha256(J4_OFFICIAL_FACT_TEMPLATE),
    extractionPromptSha256: j4ExtractionPromptSha256(),
    judgeSourceSha256: longMemEvalJudgeProvenance.sourceSha256,
  }, 'prompt hashes')
  assertExactKeys(
    config.predictions,
    ['path', 'sha256'],
    'prediction reference',
  )
  assertSha(config.predictions.sha256, 'prediction hash')
  if (config.predictions.path !== J4_LIVE_PREDICTIONS_PATH) {
    throw new J4ConfigError(
      'CONFIG_MISMATCH',
      'J4 config prediction path differs from the frozen contract.',
    )
  }
  if (!Array.isArray(config.artifacts) || config.artifacts.length < 1) {
    throw new J4ConfigError(
      'CONFIG_SCHEMA',
      'J4 config must hash-pin its tracked implementation artifacts.',
    )
  }
  const paths = new Set()
  for (const artifact of config.artifacts) {
    assertExactKeys(artifact, ['path', 'sha256'], 'J4 artifact')
    if (typeof artifact.path !== 'string' ||
      !artifact.path ||
      artifact.path.startsWith('/') ||
      artifact.path.split('/').includes('..') ||
      paths.has(artifact.path)) {
      throw new J4ConfigError(
        'CONFIG_SCHEMA',
        'J4 artifact paths must be unique safe repository-relative paths.',
      )
    }
    assertSha(artifact.sha256, `artifact ${artifact.path} hash`)
    paths.add(artifact.path)
  }
  assertEqual(
    [...paths].sort(),
    [...J4_REQUIRED_ARTIFACT_PATHS].sort(),
    'tracked evaluation artifact paths',
  )
  return config
}

export async function loadJ4LiveConfig({
  configPath = J4_LIVE_CONFIG_PATH,
  repoRoot,
} = {}) {
  if (!repoRoot) {
    throw new J4ConfigError(
      'CONFIG_REPO_ROOT',
      'J4 config loading requires the repository root.',
    )
  }
  const root = resolve(repoRoot)
  const configText = await readFile(resolve(root, configPath), 'utf8')
  let config
  try {
    config = validateConfig(JSON.parse(configText))
  } catch (error) {
    if (error instanceof J4ConfigError) throw error
    throw new J4ConfigError(
      'CONFIG_JSON',
      'J4 live config is not valid JSON.',
      { cause: error },
    )
  }
  const predictionsText = await readFile(
    resolve(root, config.predictions.path),
    'utf8',
  )
  if (j4Sha256(predictionsText) !== config.predictions.sha256) {
    throw new J4ConfigError(
      'PREDICTIONS_HASH',
      'J4 FINAL predictions differ from their frozen hash.',
    )
  }
  let predictions
  try {
    predictions = validatePredictions(JSON.parse(predictionsText))
  } catch (error) {
    if (error instanceof J4ConfigError) throw error
    throw new J4ConfigError(
      'PREDICTIONS_JSON',
      'J4 FINAL predictions are not valid JSON.',
      { cause: error },
    )
  }
  for (const artifact of config.artifacts) {
    const text = await readFile(resolve(root, artifact.path))
    if (j4Sha256(text) !== artifact.sha256) {
      throw new J4ConfigError(
        'ARTIFACT_HASH',
        `J4 tracked artifact changed: ${artifact.path}.`,
      )
    }
  }
  return deepFreeze({
    config,
    configPath,
    configSha256: j4Sha256(configText),
    predictions,
    predictionsSha256: j4Sha256(predictionsText),
  })
}

export async function loadJ4LiveAuthority({
  authorityPath = J4_LIVE_AUTHORITY_PATH,
  repoRoot,
} = {}) {
  if (!repoRoot) {
    throw new J4ConfigError(
      'AUTHORITY_REPO_ROOT',
      'J4 authority loading requires the repository root.',
    )
  }
  const text = await readFile(resolve(repoRoot, authorityPath), 'utf8')
  let authority
  try {
    authority = JSON.parse(text)
  } catch (error) {
    throw new J4ConfigError(
      'AUTHORITY_JSON',
      'J4 live authority is not valid JSON.',
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
  ], 'J4 live authority')
  assertEqual(authority.schemaVersion, 1, 'authority schema version')
  assertEqual(authority.runId, J4_LIVE_RUN_ID, 'authority run ID')
  const gateIndex = J4_PROPOSED_TRANCHE_GATES.findIndex((entry) =>
    entry.cumulativeQuestions === authority.cumulativeQuestions &&
    entry.cumulativeCapUsd === authority.cumulativeCapUsd)
  if (gateIndex < 0) {
    throw new J4ConfigError(
      'AUTHORITY_GATE_INVALID',
      'J4 authority is not one frozen tranche gate.',
    )
  }
  const expectedFrom = gateIndex === 0
    ? 0
    : J4_PROPOSED_TRANCHE_GATES[gateIndex - 1].cumulativeQuestions
  if (authority.fromCumulativeQuestions !== expectedFrom ||
    (expectedFrom === 0 && authority.previousCheckpointSha256 !== null) ||
    (expectedFrom > 0 &&
      !/^[a-f0-9]{64}$/.test(authority.previousCheckpointSha256 ?? ''))) {
    throw new J4ConfigError(
      'AUTHORITY_PREDECESSOR_INVALID',
      'J4 authority must name the immediately preceding checkpoint boundary.',
    )
  }
  if (typeof authority.founderGoDate !== 'string' ||
    typeof authority.decisionReference !== 'string' ||
    !authority.founderGoDate ||
    !authority.decisionReference) {
    throw new J4ConfigError(
      'AUTHORITY_SCHEMA',
      'J4 authority must identify the founder GO and decision record.',
    )
  }
  return deepFreeze({
    authority,
    authorityPath,
    authoritySha256: j4Sha256(text),
  })
}

export function assertJ4LiveEnvironment(env, config, authority) {
  if (env.PALARI_J4_CONFIRM_SPEND !== '1') {
    throw new J4ConfigError(
      'SPEND_NOT_CONFIRMED',
      'PALARI_J4_CONFIRM_SPEND must equal 1.',
    )
  }
  const cumulativeQuestions = Number(env.PALARI_J4_CUMULATIVE_QUESTIONS)
  const capUsd = Number(env.PALARI_J4_SPEND_CAP_USD)
  const gate = config.tranches.find((entry) =>
    entry.cumulativeQuestions === cumulativeQuestions &&
    entry.cumulativeCapUsd === capUsd)
  if (!gate) {
    throw new J4ConfigError(
      'TRANCHE_AUTHORITY_MISMATCH',
      'J4 question boundary and cumulative cap are not one frozen gate.',
    )
  }
  if (!authority ||
    authority.runId !== J4_LIVE_RUN_ID ||
    authority.cumulativeQuestions !== cumulativeQuestions ||
    authority.cumulativeCapUsd !== capUsd) {
    throw new J4ConfigError(
      'TRANCHE_NOT_AUTHORIZED',
      'The runtime boundary does not match the current founder authority.',
    )
  }
  const geminiApiKey = String(env.GEMINI_API_KEY ?? '').trim()
  const openaiApiKey = String(env.OPENAI_API_KEY ?? '').trim()
  if (!geminiApiKey) {
    throw new J4ConfigError('NO_GEMINI_KEY', 'GEMINI_API_KEY is absent.')
  }
  if (!openaiApiKey) {
    throw new J4ConfigError('NO_OPENAI_KEY', 'OPENAI_API_KEY is absent.')
  }
  return {
    capUsd,
    cumulativeQuestions,
    geminiApiKey,
    openaiApiKey,
  }
}

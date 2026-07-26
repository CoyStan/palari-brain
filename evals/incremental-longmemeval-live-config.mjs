// Frozen configuration for one founder-authorized LongMemEval question on
// Palari's incremental active-memory path. Importing this module is inert.

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import {
  INCREMENTAL_LONGMEMEVAL_ANSWER_GENERATION,
  INCREMENTAL_LONGMEMEVAL_MODEL,
  INCREMENTAL_LONGMEMEVAL_REDUCER_GENERATION,
  INCREMENTAL_LONGMEMEVAL_RESPONSE_SCHEMA,
} from './arms/incremental-memory-longmemeval-live-arm.mjs'
import {
  INCREMENTAL_LONGMEMEVAL_JUDGE_MODEL,
  INCREMENTAL_LONGMEMEVAL_JUDGE_REQUEST,
} from './incremental-longmemeval-judge.mjs'
import {
  J4_FIRST_TRANCHE_QUESTION_IDS,
  J4_STAGED_EXECUTION_ORDER_SHA256,
} from './longmemeval-plan.mjs'

export const INCREMENTAL_LONGMEMEVAL_RUN_ID =
  'j4-active-brain-incremental-longmemeval-q1-v1'
export const INCREMENTAL_LONGMEMEVAL_RUN_DATE = '2026-07-26'
export const INCREMENTAL_LONGMEMEVAL_PRODUCT_COMMIT =
  '9b9ac02f9f6b89ee4457e837161c8eed30701eb9'
export const INCREMENTAL_LONGMEMEVAL_CONFIG_PATH =
  `evals/live-runs/${INCREMENTAL_LONGMEMEVAL_RUN_ID}.json`
export const INCREMENTAL_LONGMEMEVAL_AUTHORITY_PATH =
  `evals/live-runs/${INCREMENTAL_LONGMEMEVAL_RUN_ID}.authority.json`
export const INCREMENTAL_LONGMEMEVAL_PREDICTIONS_PATH =
  `evals/predictions/${INCREMENTAL_LONGMEMEVAL_RUN_ID}.json`
export const INCREMENTAL_LONGMEMEVAL_RESULTS_ROOT = 'evals/results'

export const INCREMENTAL_LONGMEMEVAL_QUESTION_ID =
  J4_FIRST_TRANCHE_QUESTION_IDS[0]
export const INCREMENTAL_LONGMEMEVAL_DATASET = Object.freeze({
  path: 'data/longmemeval_s_cleaned.json',
  sha256:
    'd6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442',
  stagedExecutionOrderSha256: J4_STAGED_EXECUTION_ORDER_SHA256,
})
export const INCREMENTAL_LONGMEMEVAL_POPULATION = Object.freeze({
  answerCharacters: 8,
  exchangePlanSha256:
    '8441628945e6f6b0685f3b67ef6413a4a249ece8bbc9509af75e6849531c8be3',
  interactions: 243,
  isAbstention: false,
  maximumInteractionCharacters: 14_155,
  questionCharacters: 46,
  questionDate: '2023-09-04T17:07:00.000Z',
  questionId: INCREMENTAL_LONGMEMEVAL_QUESTION_ID,
  questionType: 'knowledge-update',
  rawTurns: 484,
  sessions: 45,
  visibleCharacters: 497_983,
  visibleMessages: 484,
})

export const INCREMENTAL_LONGMEMEVAL_CUMULATIVE_CAP_USD = 8
export const INCREMENTAL_LONGMEMEVAL_FRESH_SUBCAP_USD = 7.1
export const INCREMENTAL_LONGMEMEVAL_OPENING_ACCOUNTED_USD =
  0.7761082
export const INCREMENTAL_LONGMEMEVAL_OPENING_MEASURED_USD =
  0.7736072
export const INCREMENTAL_LONGMEMEVAL_OPENING_UNCERTAIN_USD =
  0.002501
export const INCREMENTAL_LONGMEMEVAL_AVAILABLE_USD = 7.2238918

export const INCREMENTAL_LONGMEMEVAL_PRICES_USD_PER_TOKEN =
  Object.freeze({
    geminiInput: 0.30 / 1_000_000,
    geminiOutputIncludingThinking: 2.50 / 1_000_000,
    judgeInputHighestSynchronousTier: 4.25 / 1_000_000,
    judgeInputMeasuredDefault: 2.50 / 1_000_000,
    judgeOutputHighestSynchronousTier: 17.00 / 1_000_000,
    judgeOutputMeasuredDefault: 10.00 / 1_000_000,
  })

// The reused Gemini meter has historical writer/judge field names. Reducers
// use its writer slot; the separate stateless judge transport uses the one
// real judge operation. The retryLimit field remains a compatibility value,
// while a runner-owned wait guard forbids every second physical dispatch.
export const INCREMENTAL_LONGMEMEVAL_GEMINI_LIMITS = Object.freeze({
  maxAttempts: 244,
  maxLogicalRequests: Object.freeze({
    answer: 1,
    judge: 1,
    writer: 243,
  }),
  maxResponseBytes: 4 * 1024 * 1024,
  maxTokens: Object.freeze({
    geminiInput: 19_342_276,
    geminiOutputIncludingThinking: 486_256,
    judgeInput: 1,
    judgeOutput: 1,
  }),
  requestTimeoutMs: 60_000,
  retryLimit: 3,
})

export const INCREMENTAL_LONGMEMEVAL_JUDGE_LIMITS = Object.freeze({
  maxHypothesisCharacters: 4_096,
  maxInputTokens: 13_413,
  maxOutputTokens: 10,
  maxResponseBytes: 4 * 1024 * 1024,
  requestTimeoutMs: 60_000,
})

export const INCREMENTAL_LONGMEMEVAL_COST_ENVELOPE =
  Object.freeze({
    cumulativeMaximumUsd: 7.8516063,
    freshMaximumUsd: 7.0754981,
    gemini: Object.freeze({
      answerInputTokens: 75_489,
      answerOutputTokens: 256,
      inputUsd: 5.8026828,
      outputUsd: 1.21564,
      reducerBaseBodyBytes: 1_718_371,
      reducerInputTokens: 19_266_787,
      reducerOutputTokens: 486_000,
      totalInputTokens: 19_342_276,
      totalOutputTokens: 486_256,
      usd: 7.0183228,
    }),
    judge: Object.freeze({
      inputTokens: 13_413,
      outputTokens: 10,
      reservationTier: 'priority',
      usd: 0.05717525,
    }),
    maximumPhysicalDispatches: 245,
    method:
      'For each of 243 reducers: exact final-schema empty-prior body bytes plus 512 protocol tokens and up to 72,000 additional serialized bytes for the bounded prior digest; then one 75,489-token answer reserve and one 13,413/10-token judge reserve priced at the highest documented synchronous tier.',
    noRetries: true,
  })

export const INCREMENTAL_LONGMEMEVAL_PREDECESSOR =
  Object.freeze({
    administrativeHead:
      'b647abfb895e492397094cab07307f9a3f526ebc',
    attempts: 3,
    cumulativeAccountedUsd:
      INCREMENTAL_LONGMEMEVAL_OPENING_ACCOUNTED_USD,
    cumulativeMeasuredUsd:
      INCREMENTAL_LONGMEMEVAL_OPENING_MEASURED_USD,
    cumulativeUncertainUsd:
      INCREMENTAL_LONGMEMEVAL_OPENING_UNCERTAIN_USD,
    currentRunAccountedUsd: 0.0029759,
    currentRunMeasuredUsd: 0.0029759,
    currentRunUncertainUsd: 0,
    logicalRequests: Object.freeze({
      answer: 1,
      writer: 2,
    }),
    openingAccountedUsd: 0.7731323,
    private: Object.freeze({
      checkpoint: Object.freeze({
        path:
          'evals/results/j4-active-brain-incremental-smoke-v1/checkpoint.json',
        sha256:
          'befe23fc79690c4eacdf29719b8c168be2caccb46116fb0daf955a1226d3096e',
      }),
      manifest: Object.freeze({
        path:
          'evals/results/j4-active-brain-incremental-smoke-v1/artifact-manifest.json',
        sha256:
          '2b31e82694032790bff2d2d94e0f82b9ce1f0c8b72dc0965086cabbf5f8f3c74',
      }),
      meter: Object.freeze({
        path:
          'evals/results/j4-active-brain-incremental-smoke-v1/meter.jsonl',
        sha256:
          '4d74652698a947f75e1cb7dd2379e70f9f4d384721f08330efd0f05afb02032d',
      }),
    }),
    runId: 'j4-active-brain-incremental-smoke-v1',
    sealCommit:
      '465fd91a95506e8ce5076a09c80d0415e67a4a2e',
    sealedRunner: Object.freeze({
      path: 'evals/run-incremental-memory-smoke.mjs',
      sha256:
        'e2141f68b78164a1c906c2918a0b12a3156acc1475e3e50bb45c073e2328d000',
    }),
    status: 'complete',
    tracked: Object.freeze({
      authority: Object.freeze({
        path:
          'evals/live-runs/j4-active-brain-incremental-smoke-v1.authority.json',
        sha256:
          'ae3cd7e30a40a377cda3c8f7a3833f6744d7a025bfecb92226d9dcf9baf3b5a5',
      }),
      config: Object.freeze({
        path:
          'evals/live-runs/j4-active-brain-incremental-smoke-v1.json',
        sha256:
          '503d45de64f66c2fe2acd5023c52d34cb9ca340dd73449401c2334a6f6d4ee58',
      }),
      predictions: Object.freeze({
        path:
          'evals/predictions/j4-active-brain-incremental-smoke-v1.json',
        sha256:
          'bf1162053712cbba4df7936aaa146045eacdc6c205895952c832e049dfdd73bf',
      }),
    }),
  })

export const INCREMENTAL_LONGMEMEVAL_EXPECTED_PREDICTIONS =
  Object.freeze([
    Object.freeze({
      id: 'EXACT_Q1_ONLY',
      predicted: true,
      statement:
        'The identity selects only S-60 ordinal 1, 08e075c7, and never starts question 2.',
    }),
    Object.freeze({
      id: 'ALL_INTERACTIONS_REDUCED',
      predicted: true,
      statement:
        'All 243 chronological interactions complete one reducer operation and one durable checkpoint each.',
    }),
    Object.freeze({
      id: 'INCREMENTAL_BOUNDARY_HELD',
      predicted: true,
      statement:
        'Every reducer receives only the bounded prior digest and its one current interaction, never the final question or full journal.',
    }),
    Object.freeze({
      id: 'DIGEST_READY_AND_BOUNDED',
      predicted: true,
      statement:
        'After interaction 243 the digest is ready, has no pending work, and remains within 64 items and 24,000 serialized characters.',
    }),
    Object.freeze({
      id: 'ONE_DIGEST_ANSWER',
      predicted: true,
      statement:
        'Exactly one Gemini answer operation runs from the complete incremental digest.',
    }),
    Object.freeze({
      id: 'OFFICIAL_JUDGE_CORRECT',
      predicted: true,
      statement:
        'The unchanged official-compatible LongMemEval judge marks Palari’s answer correct.',
    }),
    Object.freeze({
      id: 'NO_RETRY',
      predicted: true,
      statement:
        'Healthy execution uses 243 reducer, one answer, and one judge dispatch with zero retry.',
    }),
    Object.freeze({
      id: 'SPEND_WITHIN_ENVELOPE',
      predicted: true,
      statement:
        'Fresh accounted spend remains at or below $7.0754981 and cumulative accounted spend remains below $8.00.',
    }),
    Object.freeze({
      id: 'PRIVATE_AND_TERMINAL',
      predicted: true,
      statement:
        'Raw input, output, transcripts, score, and checkpoints remain gitignored; the identity stops terminally before any later question.',
    }),
  ])

export class IncrementalLongMemEvalConfigError extends Error {
  constructor(code, message, { cause } = {}) {
    super(message, cause ? { cause } : undefined)
    this.name = 'IncrementalLongMemEvalConfigError'
    this.code = code
  }
}

export function incrementalLongMemEvalSha256(value) {
  return createHash('sha256').update(value).digest('hex')
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

function sameUsd(left, right) {
  return Number.isFinite(Number(left)) &&
    Number.isFinite(Number(right)) &&
    Math.abs(Number(left) - Number(right)) <= 1e-12
}

function hashJson(value) {
  return incrementalLongMemEvalSha256(JSON.stringify(value))
}

export const INCREMENTAL_LONGMEMEVAL_PROMPT_CONTRACT =
  Object.freeze({
    answerGenerationSha256:
      hashJson(INCREMENTAL_LONGMEMEVAL_ANSWER_GENERATION),
    judgeRequestSha256:
      hashJson(INCREMENTAL_LONGMEMEVAL_JUDGE_REQUEST),
    reducerGenerationSha256:
      hashJson(INCREMENTAL_LONGMEMEVAL_REDUCER_GENERATION),
    responseSchemaSha256:
      hashJson(INCREMENTAL_LONGMEMEVAL_RESPONSE_SCHEMA),
  })

function assertHash(value, label) {
  if (!/^[a-f0-9]{64}$/.test(String(value ?? ''))) {
    throw new IncrementalLongMemEvalConfigError(
      'CONFIG_HASH_INVALID',
      `${label} must be one lowercase SHA-256.`,
    )
  }
}

function assertConfig(config) {
  if (!config ||
    config.schemaVersion !== 1 ||
    config.runId !== INCREMENTAL_LONGMEMEVAL_RUN_ID ||
    config.runDate !== INCREMENTAL_LONGMEMEVAL_RUN_DATE ||
    config.productCommit !== INCREMENTAL_LONGMEMEVAL_PRODUCT_COMMIT ||
    !sameJson(config.scope, {
      answerOperations: 1,
      benchmarkQuestions: 1,
      comparisonOperations: 0,
      judgeOperations: 1,
      maximumPhysicalDispatches: 245,
      questionIds: [INCREMENTAL_LONGMEMEVAL_QUESTION_ID],
      reducerOperations: 243,
      retryDispatches: 0,
    }) ||
    !sameJson(config.models, {
      answer: INCREMENTAL_LONGMEMEVAL_MODEL,
      judge: INCREMENTAL_LONGMEMEVAL_JUDGE_MODEL,
      reducer: INCREMENTAL_LONGMEMEVAL_MODEL,
    }) ||
    !sameJson(config.generation, {
      answerMaxOutputTokens:
        INCREMENTAL_LONGMEMEVAL_ANSWER_GENERATION.maxOutputTokens,
      judge: INCREMENTAL_LONGMEMEVAL_JUDGE_REQUEST,
      reducerMaxOutputTokens:
        INCREMENTAL_LONGMEMEVAL_REDUCER_GENERATION.maxOutputTokens,
      reducerResponseMimeType:
        INCREMENTAL_LONGMEMEVAL_REDUCER_GENERATION
          .responseFormat.text.mimeType,
      reducerResponseSchemaSha256:
        INCREMENTAL_LONGMEMEVAL_PROMPT_CONTRACT.responseSchemaSha256,
      thinkingLevel:
        INCREMENTAL_LONGMEMEVAL_REDUCER_GENERATION
          .thinkingConfig.thinkingLevel,
    }) ||
    !sameJson(config.dataset, INCREMENTAL_LONGMEMEVAL_DATASET) ||
    !sameJson(config.population, INCREMENTAL_LONGMEMEVAL_POPULATION) ||
    !sameJson(config.geminiLimits, INCREMENTAL_LONGMEMEVAL_GEMINI_LIMITS) ||
    !sameJson(config.judgeLimits, INCREMENTAL_LONGMEMEVAL_JUDGE_LIMITS) ||
    !sameJson(config.costEnvelope, INCREMENTAL_LONGMEMEVAL_COST_ENVELOPE) ||
    !sameJson(config.promptContract, INCREMENTAL_LONGMEMEVAL_PROMPT_CONTRACT) ||
    !sameJson(config.predecessor, INCREMENTAL_LONGMEMEVAL_PREDECESSOR) ||
    !sameUsd(
      config.spend?.cumulativeCapUsd,
      INCREMENTAL_LONGMEMEVAL_CUMULATIVE_CAP_USD,
    ) ||
    !sameUsd(
      config.spend?.freshSubcapUsd,
      INCREMENTAL_LONGMEMEVAL_FRESH_SUBCAP_USD,
    ) ||
    !sameUsd(
      config.spend?.openingAccountedUsd,
      INCREMENTAL_LONGMEMEVAL_OPENING_ACCOUNTED_USD,
    ) ||
    !sameUsd(
      config.spend?.openingMeasuredUsd,
      INCREMENTAL_LONGMEMEVAL_OPENING_MEASURED_USD,
    ) ||
    !sameUsd(
      config.spend?.openingUncertainUsd,
      INCREMENTAL_LONGMEMEVAL_OPENING_UNCERTAIN_USD,
    ) ||
    !sameUsd(
      config.spend?.availableUsd,
      INCREMENTAL_LONGMEMEVAL_AVAILABLE_USD,
    ) ||
    !sameJson(
      config.spend?.pricesUsdPerToken,
      INCREMENTAL_LONGMEMEVAL_PRICES_USD_PER_TOKEN,
    ) ||
    !Array.isArray(config.artifacts) ||
    config.artifacts.length < 1 ||
    config.artifacts.some((entry) => {
      try {
        assertHash(entry?.sha256, 'Artifact hash')
      } catch {
        return true
      }
      return typeof entry?.path !== 'string' || !entry.path
    }) ||
    config.predictions?.path !==
      INCREMENTAL_LONGMEMEVAL_PREDICTIONS_PATH) {
    throw new IncrementalLongMemEvalConfigError(
      'CONFIG_SCHEMA_INVALID',
      'Incremental LongMemEval config differs from its frozen scope.',
    )
  }
  assertHash(config.predictions.sha256, 'Predictions hash')
  return config
}

function assertAuthority(authority) {
  if (!authority ||
    authority.schemaVersion !== 1 ||
    authority.runId !== INCREMENTAL_LONGMEMEVAL_RUN_ID ||
    authority.scope !== 'one-incremental-longmemeval-question-only' ||
    !sameJson(authority.providers, ['gemini', 'openai']) ||
    !sameJson(authority.models, {
      answer: INCREMENTAL_LONGMEMEVAL_MODEL,
      judge: INCREMENTAL_LONGMEMEVAL_JUDGE_MODEL,
      reducer: INCREMENTAL_LONGMEMEVAL_MODEL,
    }) ||
    !sameJson(
      authority.questionIds,
      [INCREMENTAL_LONGMEMEVAL_QUESTION_ID],
    ) ||
    authority.reducerOperations !== 243 ||
    authority.answerOperations !== 1 ||
    authority.judgeOperations !== 1 ||
    authority.maximumPhysicalDispatches !== 245 ||
    authority.retryDispatches !== 0 ||
    authority.comparisonOperations !== 0 ||
    authority.question2Allowed !== false ||
    authority.publish !== false ||
    !sameUsd(
      authority.cumulativeCapUsd,
      INCREMENTAL_LONGMEMEVAL_CUMULATIVE_CAP_USD,
    ) ||
    !sameUsd(
      authority.freshSubcapUsd,
      INCREMENTAL_LONGMEMEVAL_FRESH_SUBCAP_USD,
    )) {
    throw new IncrementalLongMemEvalConfigError(
      'AUTHORITY_SCHEMA_INVALID',
      'Authority does not permit exactly one incremental benchmark question.',
    )
  }
  return authority
}

export async function loadIncrementalLongMemEvalConfig({
  repoRoot,
} = {}) {
  const configPath = resolve(repoRoot, INCREMENTAL_LONGMEMEVAL_CONFIG_PATH)
  const predictionsPath = resolve(
    repoRoot,
    INCREMENTAL_LONGMEMEVAL_PREDICTIONS_PATH,
  )
  const [configBytes, predictionsBytes] = await Promise.all([
    readFile(configPath),
    readFile(predictionsPath),
  ])
  let config
  let predictions
  try {
    config = assertConfig(JSON.parse(configBytes))
    predictions = JSON.parse(predictionsBytes)
  } catch (error) {
    if (error instanceof IncrementalLongMemEvalConfigError) throw error
    throw new IncrementalLongMemEvalConfigError(
      'CONFIG_JSON_INVALID',
      'Incremental LongMemEval config or predictions are invalid JSON.',
      { cause: error },
    )
  }
  const predictionsSha256 =
    incrementalLongMemEvalSha256(predictionsBytes)
  if (predictions.status !== 'FINAL' ||
    predictions.runId !== INCREMENTAL_LONGMEMEVAL_RUN_ID ||
    predictions.productCommit !== INCREMENTAL_LONGMEMEVAL_PRODUCT_COMMIT ||
    predictions.noReroll !== true ||
    !sameJson(
      predictions.predictions,
      INCREMENTAL_LONGMEMEVAL_EXPECTED_PREDICTIONS,
    ) ||
    predictionsSha256 !== config.predictions.sha256) {
    throw new IncrementalLongMemEvalConfigError(
      'PREDICTIONS_CHANGED',
      'Incremental LongMemEval FINAL predictions changed after freezing.',
    )
  }
  return {
    config,
    configPath,
    configSha256: incrementalLongMemEvalSha256(configBytes),
    predictions,
    predictionsPath,
    predictionsSha256,
  }
}

export async function loadIncrementalLongMemEvalAuthority({
  repoRoot,
} = {}) {
  const authorityPath = resolve(
    repoRoot,
    INCREMENTAL_LONGMEMEVAL_AUTHORITY_PATH,
  )
  const authorityBytes = await readFile(authorityPath)
  let authority
  try {
    authority = assertAuthority(JSON.parse(authorityBytes))
  } catch (error) {
    if (error instanceof IncrementalLongMemEvalConfigError) throw error
    throw new IncrementalLongMemEvalConfigError(
      'AUTHORITY_JSON_INVALID',
      'Incremental LongMemEval authority is invalid JSON.',
      { cause: error },
    )
  }
  return {
    authority,
    authorityPath,
    authoritySha256:
      incrementalLongMemEvalSha256(authorityBytes),
  }
}

export function assertIncrementalLongMemEvalEnvironment(
  env,
  config,
  authority,
) {
  if (env.PALARI_INCREMENTAL_LONGMEMEVAL_CONFIRM_SPEND !== '1' ||
    Number(env.PALARI_INCREMENTAL_LONGMEMEVAL_CUMULATIVE_CAP_USD) !==
      INCREMENTAL_LONGMEMEVAL_CUMULATIVE_CAP_USD ||
    Number(env.PALARI_INCREMENTAL_LONGMEMEVAL_FRESH_SUBCAP_USD) !==
      INCREMENTAL_LONGMEMEVAL_FRESH_SUBCAP_USD ||
    env.PALARI_INCREMENTAL_LONGMEMEVAL_MODEL !==
      INCREMENTAL_LONGMEMEVAL_MODEL ||
    authority.runId !== config.runId) {
    throw new IncrementalLongMemEvalConfigError(
      'LIVE_CONFIRMATION_MISSING',
      'Incremental LongMemEval requires exact spend and model confirmations.',
    )
  }
  const geminiApiKey = String(env.GEMINI_API_KEY ?? '').trim()
  const openaiApiKey = String(env.OPENAI_API_KEY ?? '').trim()
  if (!geminiApiKey) {
    throw new IncrementalLongMemEvalConfigError(
      'GEMINI_KEY_MISSING',
      'Incremental LongMemEval requires GEMINI_API_KEY.',
    )
  }
  if (!openaiApiKey) {
    throw new IncrementalLongMemEvalConfigError(
      'OPENAI_KEY_MISSING',
      'Incremental LongMemEval requires OPENAI_API_KEY.',
    )
  }
  return {
    cumulativeCapUsd: INCREMENTAL_LONGMEMEVAL_CUMULATIVE_CAP_USD,
    freshSubcapUsd: INCREMENTAL_LONGMEMEVAL_FRESH_SUBCAP_USD,
    geminiApiKey,
    model: INCREMENTAL_LONGMEMEVAL_MODEL,
    openaiApiKey,
  }
}

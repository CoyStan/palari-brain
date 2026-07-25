// Frozen configuration for the founder-authorized recurrent-reducer smoke.
// Importing this module is inert: it reads no files, credentials, results, or
// network resources.

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import {
  INCREMENTAL_MEMORY_ANSWER_GENERATION,
  INCREMENTAL_MEMORY_REDUCER_GENERATION,
  INCREMENTAL_MEMORY_RESPONSE_SCHEMA,
  INCREMENTAL_MEMORY_SMOKE_FIXTURE,
  INCREMENTAL_MEMORY_SMOKE_MODEL,
} from './arms/incremental-memory-live-smoke.mjs'

export {
  INCREMENTAL_MEMORY_ANSWER_GENERATION,
  INCREMENTAL_MEMORY_REDUCER_GENERATION,
}

export const INCREMENTAL_MEMORY_SMOKE_RUN_ID =
  'j4-active-brain-incremental-smoke-v1'
export const INCREMENTAL_MEMORY_SMOKE_RUN_DATE = '2026-07-25'
export const INCREMENTAL_MEMORY_SMOKE_PRODUCT_COMMIT =
  '9b9ac02f9f6b89ee4457e837161c8eed30701eb9'
export const INCREMENTAL_MEMORY_SMOKE_CONFIG_PATH =
  `evals/live-runs/${INCREMENTAL_MEMORY_SMOKE_RUN_ID}.json`
export const INCREMENTAL_MEMORY_SMOKE_AUTHORITY_PATH =
  `evals/live-runs/${INCREMENTAL_MEMORY_SMOKE_RUN_ID}.authority.json`
export const INCREMENTAL_MEMORY_SMOKE_PREDICTIONS_PATH =
  `evals/predictions/${INCREMENTAL_MEMORY_SMOKE_RUN_ID}.json`
export const INCREMENTAL_MEMORY_SMOKE_RESULTS_ROOT = 'evals/results'

export const INCREMENTAL_MEMORY_SMOKE_CUMULATIVE_CAP_USD = 7
export const INCREMENTAL_MEMORY_SMOKE_OPENING_ACCOUNTED_USD =
  0.7731323
export const INCREMENTAL_MEMORY_SMOKE_OPENING_MEASURED_USD =
  0.7706313
export const INCREMENTAL_MEMORY_SMOKE_OPENING_UNCERTAIN_USD =
  0.002501
export const INCREMENTAL_MEMORY_SMOKE_AVAILABLE_USD = 6.2268677
export const INCREMENTAL_MEMORY_SMOKE_FRESH_SUBCAP_USD = 0.1

export const INCREMENTAL_MEMORY_SMOKE_PRICES_USD_PER_TOKEN =
  Object.freeze({
    geminiInput: 0.30 / 1_000_000,
    geminiOutputIncludingThinking: 2.50 / 1_000_000,
  })

export const INCREMENTAL_MEMORY_SMOKE_LIMITS = Object.freeze({
  maxAttempts: 3,
  maxLogicalRequests: Object.freeze({
    answer: 1,
    judge: 1,
    writer: 2,
  }),
  maxResponseBytes: 4 * 1024 * 1024,
  maxTokens: Object.freeze({
    geminiInput: 27_875,
    geminiOutputIncludingThinking: 4_256,
    judgeInput: 1,
    judgeOutput: 1,
  }),
  requestTimeoutMs: 60_000,
  retryLimit: 3,
})

export const INCREMENTAL_MEMORY_SMOKE_RESERVATION_ENVELOPE =
  Object.freeze({
    allThreeAttemptsUsd: 0.0190025,
    method:
      'local serialized-byte meter bound over the exact fixture, one action per reduction, worst JSON escaping for host-sized generated topic/statement fields, and at most two active answer items; one physical dispatch per logical request and retry wait fails closed',
    operations: Object.freeze([
      Object.freeze({
        maximumRequestBytes: 4_591,
        maximumReservationUsd: 0.0065309,
        maxOutputTokens: 2_000,
        operation: 'reducer-1',
      }),
      Object.freeze({
        maximumRequestBytes: 9_297,
        maximumReservationUsd: 0.0079427,
        maxOutputTokens: 2_000,
        operation: 'reducer-2',
      }),
      Object.freeze({
        maximumRequestBytes: 12_451,
        maximumReservationUsd: 0.0045289,
        maxOutputTokens: 256,
        operation: 'answer',
      }),
    ]),
  })

export const INCREMENTAL_MEMORY_SMOKE_PREDECESSOR =
  Object.freeze({
    administrativeHead:
      '1a5ad547bfd3dbb21f061f2a647ea0576b79e2ec',
    attempts: 1,
    cumulativeAccountedUsd:
      INCREMENTAL_MEMORY_SMOKE_OPENING_ACCOUNTED_USD,
    cumulativeMeasuredUsd:
      INCREMENTAL_MEMORY_SMOKE_OPENING_MEASURED_USD,
    cumulativeUncertainUsd:
      INCREMENTAL_MEMORY_SMOKE_OPENING_UNCERTAIN_USD,
    currentRunAccountedUsd: 0.0003325,
    currentRunMeasuredUsd: 0.0003325,
    currentRunUncertainUsd: 0,
    logicalRequests: Object.freeze({ judge: 1 }),
    openingAccountedUsd: 0.7727998,
    private: Object.freeze({
      checkpoint: Object.freeze({
        path:
          'evals/results/j4-active-brain-canonical-first5-v1/checkpoint.json',
        sha256:
          '2f195d952a29cc87455dd89cdfdc2be640581960bdd891a0ce9ce322716a24db',
      }),
      manifest: Object.freeze({
        path:
          'evals/results/j4-active-brain-canonical-first5-v1/artifact-manifest.json',
        sha256:
          '5764d7e71f4d22060b29c54b67150f90b5ba86057d4130413af59633a905e235',
      }),
      meter: Object.freeze({
        path:
          'evals/results/j4-active-brain-canonical-first5-v1/meter.jsonl',
        sha256:
          '0c1d2a74644869fb6bae6b25b64620086d51acbef9c10237f7bd4b1a6aa6d2ec',
      }),
    }),
    runId: 'j4-active-brain-canonical-first5-v1',
    sealCommit:
      '9a13ceadb8d0974f642376e3a88e57d9293db399',
    sealedRunner: Object.freeze({
      path: 'evals/run-canonical-first5-live.mjs',
      sha256:
        '21f7372e20caec896a3a1734d7db5ef5001220c74fca9ed2b5a0ac6b4cdf407b',
    }),
    status: 'paused',
    tracked: Object.freeze({
      authority: Object.freeze({
        path:
          'evals/live-runs/j4-active-brain-canonical-first5-v1.authority.json',
        sha256:
          '9174c598821ae7987a7add3265d66576dd2acf067b05774d43f86dc89d6a3ebd',
      }),
      config: Object.freeze({
        path:
          'evals/live-runs/j4-active-brain-canonical-first5-v1.json',
        sha256:
          '10233b2b92dc9d339a0e70bdd5c231af8b9be948f1d798439b735ee68f498efa',
      }),
      predictions: Object.freeze({
        path:
          'evals/predictions/j4-active-brain-canonical-first5-v1.json',
        sha256:
          'c2a8fcd19d92a1f54b54c99b8737ab11a8b3a327326130e2991622866120b1bd',
      }),
    }),
  })

export const INCREMENTAL_MEMORY_SMOKE_EXPECTED_PREDICTIONS =
  Object.freeze([
    Object.freeze({
      id: 'FIRST_REDUCER_VALID',
      predicted: true,
      statement:
        'Turn 1 receives a provider-valid and host-valid reducer response.',
    }),
    Object.freeze({
      id: 'OAT_MEMORY_ADDED',
      predicted: true,
      statement:
        'After the first turn, active memory has one user item supported by the exact oat-milk quote.',
    }),
    Object.freeze({
      id: 'SECOND_REQUEST_IS_INCREMENTAL',
      predicted: true,
      statement:
        'Turn 2 receives only the bounded prior digest and exact current evidence, with no full journal, source text, or answer question.',
    }),
    Object.freeze({
      id: 'ALMOND_SUPERSEDES_OAT',
      predicted: true,
      statement:
        'The second reduction replaces the first item with one current almond-milk preference.',
    }),
    Object.freeze({
      id: 'CORRECTION_LINEAGE_SURVIVES',
      predicted: true,
      statement:
        'The surviving item carries the exact oat and almond quotes in chronological order.',
    }),
    Object.freeze({
      id: 'ANSWER_USES_INCREMENTAL_DIGEST',
      predicted: true,
      statement:
        'The answer sees one ready incremental digest item and states almond as the current preference.',
    }),
    Object.freeze({
      id: 'THREE_CALL_BOUNDARY_NO_RETRIES',
      predicted: true,
      statement:
        'Healthy execution makes two reducer requests and one answer request, three attempts total, with no retry.',
    }),
    Object.freeze({
      id: 'NO_EXTERNAL_EVAL_SURFACE',
      predicted: true,
      statement:
        'The run reads no dataset and makes no benchmark, judge, OpenAI, comparison-arm, or publication operation.',
    }),
  ])

export class IncrementalMemorySmokeConfigError extends Error {
  constructor(code, message, { cause } = {}) {
    super(message, cause ? { cause } : undefined)
    this.name = 'IncrementalMemorySmokeConfigError'
    this.code = code
  }
}

export function incrementalMemorySmokeSha256(value) {
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
  return incrementalMemorySmokeSha256(JSON.stringify(value))
}

export const INCREMENTAL_MEMORY_SMOKE_PROMPT_CONTRACT =
  Object.freeze({
    answerGenerationSha256:
      hashJson(INCREMENTAL_MEMORY_ANSWER_GENERATION),
    fixtureSha256: hashJson(INCREMENTAL_MEMORY_SMOKE_FIXTURE),
    providerMapping:
      'trusted reducer rules in systemInstruction; contractVersion plus bounded input in one untrusted user JSON turn; product-built answer prompt in one user turn',
    reducerGenerationSha256:
      hashJson(INCREMENTAL_MEMORY_REDUCER_GENERATION),
    responseSchemaSha256:
      hashJson(INCREMENTAL_MEMORY_RESPONSE_SCHEMA),
  })

function assertHash(value, label) {
  if (!/^[a-f0-9]{64}$/.test(String(value ?? ''))) {
    throw new IncrementalMemorySmokeConfigError(
      'CONFIG_HASH_INVALID',
      `${label} must be one lowercase SHA-256.`,
    )
  }
}

function assertConfig(config) {
  if (!config ||
    config.schemaVersion !== 1 ||
    config.runId !== INCREMENTAL_MEMORY_SMOKE_RUN_ID ||
    config.runDate !== INCREMENTAL_MEMORY_SMOKE_RUN_DATE ||
    config.productCommit !==
      INCREMENTAL_MEMORY_SMOKE_PRODUCT_COMMIT ||
    !sameJson(config.scope, {
      answerOperations: 1,
      benchmarkQuestions: 0,
      datasetLoaded: false,
      judgeOperations: 0,
      logicalOperations: 3,
      reducerOperations: 2,
    }) ||
    !sameJson(config.models, {
      answer: INCREMENTAL_MEMORY_SMOKE_MODEL,
      reducer: INCREMENTAL_MEMORY_SMOKE_MODEL,
    }) ||
    !sameJson(config.generation, {
      answerMaxOutputTokens: 256,
      reducerMaxOutputTokens: 2_000,
      reducerResponseFormat: 'APPLICATION_JSON+json-schema',
      thinkingLevel: 'MINIMAL',
    }) ||
    !sameJson(config.fixture, INCREMENTAL_MEMORY_SMOKE_FIXTURE) ||
    !sameJson(config.limits, INCREMENTAL_MEMORY_SMOKE_LIMITS) ||
    !sameJson(
      config.reservationEnvelope,
      INCREMENTAL_MEMORY_SMOKE_RESERVATION_ENVELOPE,
    ) ||
    !sameJson(
      config.promptContract,
      INCREMENTAL_MEMORY_SMOKE_PROMPT_CONTRACT,
    ) ||
    !sameJson(
      config.predecessor,
      INCREMENTAL_MEMORY_SMOKE_PREDECESSOR,
    ) ||
    !sameUsd(
      config.spend?.cumulativeCapUsd,
      INCREMENTAL_MEMORY_SMOKE_CUMULATIVE_CAP_USD,
    ) ||
    !sameUsd(
      config.spend?.openingAccountedUsd,
      INCREMENTAL_MEMORY_SMOKE_OPENING_ACCOUNTED_USD,
    ) ||
    !sameUsd(
      config.spend?.openingMeasuredUsd,
      INCREMENTAL_MEMORY_SMOKE_OPENING_MEASURED_USD,
    ) ||
    !sameUsd(
      config.spend?.openingUncertainUsd,
      INCREMENTAL_MEMORY_SMOKE_OPENING_UNCERTAIN_USD,
    ) ||
    !sameUsd(
      config.spend?.availableUsd,
      INCREMENTAL_MEMORY_SMOKE_AVAILABLE_USD,
    ) ||
    !sameUsd(
      config.spend?.freshSubcapUsd,
      INCREMENTAL_MEMORY_SMOKE_FRESH_SUBCAP_USD,
    ) ||
    !sameJson(
      config.spend?.pricesUsdPerToken,
      INCREMENTAL_MEMORY_SMOKE_PRICES_USD_PER_TOKEN,
    ) ||
    config.meterCompatibility?.effectiveReducerOperations !== 2 ||
    config.meterCompatibility?.technicalPurpose !== 'writer' ||
    config.meterCompatibility?.effectiveJudgeOperations !== 0 ||
    config.meterCompatibility?.maximumPhysicalDispatches !== 3 ||
    config.meterCompatibility?.retryDispatches !== 0 ||
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
      INCREMENTAL_MEMORY_SMOKE_PREDICTIONS_PATH) {
    throw new IncrementalMemorySmokeConfigError(
      'CONFIG_SCHEMA_INVALID',
      'Incremental-memory smoke config differs from its frozen scope.',
    )
  }
  assertHash(config.predictions.sha256, 'Predictions hash')
  return config
}

function assertAuthority(authority) {
  if (!authority ||
    authority.schemaVersion !== 1 ||
    authority.runId !== INCREMENTAL_MEMORY_SMOKE_RUN_ID ||
    authority.scope !== 'two-reducer-one-answer-smoke-only' ||
    authority.provider !== 'gemini' ||
    authority.model !== INCREMENTAL_MEMORY_SMOKE_MODEL ||
    authority.reducerOperations !== 2 ||
    authority.answerOperations !== 1 ||
    authority.logicalOperations !== 3 ||
    authority.maximumPhysicalDispatches !== 3 ||
    authority.retryDispatches !== 0 ||
    authority.datasetLoaded !== false ||
    authority.benchmarkQuestions !== 0 ||
    authority.judgeOperations !== 0 ||
    authority.comparisonOperations !== 0 ||
    authority.publish !== false ||
    !sameUsd(
      authority.cumulativeCapUsd,
      INCREMENTAL_MEMORY_SMOKE_CUMULATIVE_CAP_USD,
    ) ||
    !sameUsd(
      authority.freshSubcapUsd,
      INCREMENTAL_MEMORY_SMOKE_FRESH_SUBCAP_USD,
    )) {
    throw new IncrementalMemorySmokeConfigError(
      'AUTHORITY_SCHEMA_INVALID',
      'Incremental-memory authority does not permit exactly this smoke.',
    )
  }
  return authority
}

export async function loadIncrementalMemorySmokeConfig({
  repoRoot,
} = {}) {
  const configPath = resolve(
    repoRoot,
    INCREMENTAL_MEMORY_SMOKE_CONFIG_PATH,
  )
  const predictionsPath = resolve(
    repoRoot,
    INCREMENTAL_MEMORY_SMOKE_PREDICTIONS_PATH,
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
    if (error instanceof IncrementalMemorySmokeConfigError) throw error
    throw new IncrementalMemorySmokeConfigError(
      'CONFIG_JSON_INVALID',
      'Incremental-memory config or predictions are invalid JSON.',
      { cause: error },
    )
  }
  const predictionsSha256 =
    incrementalMemorySmokeSha256(predictionsBytes)
  if (predictions.status !== 'FINAL' ||
    predictions.runId !== INCREMENTAL_MEMORY_SMOKE_RUN_ID ||
    !sameJson(
      predictions.predictions,
      INCREMENTAL_MEMORY_SMOKE_EXPECTED_PREDICTIONS,
    ) ||
    predictionsSha256 !== config.predictions.sha256) {
    throw new IncrementalMemorySmokeConfigError(
      'PREDICTIONS_CHANGED',
      'Incremental-memory FINAL predictions changed after freezing.',
    )
  }
  return {
    config,
    configPath,
    configSha256: incrementalMemorySmokeSha256(configBytes),
    predictions,
    predictionsPath,
    predictionsSha256,
  }
}

export async function loadIncrementalMemorySmokeAuthority({
  repoRoot,
} = {}) {
  const authorityPath = resolve(
    repoRoot,
    INCREMENTAL_MEMORY_SMOKE_AUTHORITY_PATH,
  )
  const authorityBytes = await readFile(authorityPath)
  let authority
  try {
    authority = assertAuthority(JSON.parse(authorityBytes))
  } catch (error) {
    if (error instanceof IncrementalMemorySmokeConfigError) throw error
    throw new IncrementalMemorySmokeConfigError(
      'AUTHORITY_JSON_INVALID',
      'Incremental-memory authority is invalid JSON.',
      { cause: error },
    )
  }
  return {
    authority,
    authorityPath,
    authoritySha256:
      incrementalMemorySmokeSha256(authorityBytes),
  }
}

export function assertIncrementalMemorySmokeEnvironment(
  env,
  config,
  authority,
) {
  if (env.PALARI_INCREMENTAL_SMOKE_CONFIRM_SPEND !== '1' ||
    Number(env.PALARI_INCREMENTAL_SMOKE_CUMULATIVE_CAP_USD) !==
      INCREMENTAL_MEMORY_SMOKE_CUMULATIVE_CAP_USD ||
    Number(env.PALARI_INCREMENTAL_SMOKE_FRESH_SUBCAP_USD) !==
      INCREMENTAL_MEMORY_SMOKE_FRESH_SUBCAP_USD ||
    env.PALARI_INCREMENTAL_SMOKE_MODEL !==
      INCREMENTAL_MEMORY_SMOKE_MODEL ||
    authority.runId !== config.runId) {
    throw new IncrementalMemorySmokeConfigError(
      'LIVE_CONFIRMATION_MISSING',
      'Incremental-memory smoke requires its exact spend and model confirmations.',
    )
  }
  const geminiApiKey = String(env.GEMINI_API_KEY ?? '').trim()
  if (!geminiApiKey) {
    throw new IncrementalMemorySmokeConfigError(
      'GEMINI_KEY_MISSING',
      'Incremental-memory smoke requires GEMINI_API_KEY.',
    )
  }
  return {
    cumulativeCapUsd:
      INCREMENTAL_MEMORY_SMOKE_CUMULATIVE_CAP_USD,
    freshSubcapUsd:
      INCREMENTAL_MEMORY_SMOKE_FRESH_SUBCAP_USD,
    geminiApiKey,
    model: INCREMENTAL_MEMORY_SMOKE_MODEL,
  }
}

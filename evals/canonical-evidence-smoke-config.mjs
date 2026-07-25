// Frozen configuration surface for the fresh canonical-evidence live smoke.
// Importing this module is inert: it does not read files, credentials, or
// result directories and cannot dispatch provider work.

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import {
  buildStatementExtractionRequest,
} from '../src/statement-extraction.mjs'
import {
  CANONICAL_EVIDENCE_SMOKE_ANSWER_GENERATION as
    CANONICAL_EVIDENCE_ANSWER_GENERATION,
  CANONICAL_EVIDENCE_SMOKE_MODEL,
} from './arms/canonical-evidence-live-smoke.mjs'

export const CANONICAL_EVIDENCE_SMOKE_RUN_ID =
  'j4-active-brain-canonical-smoke-v1'
export const CANONICAL_EVIDENCE_SMOKE_RUN_DATE = '2026-07-25'
export const CANONICAL_EVIDENCE_SMOKE_PRODUCT_COMMIT =
  '2aca0a7e1797bb293f535f9f85905334117fbd4b'
export const CANONICAL_EVIDENCE_SMOKE_CONFIG_PATH =
  `evals/live-runs/${CANONICAL_EVIDENCE_SMOKE_RUN_ID}.json`
export const CANONICAL_EVIDENCE_SMOKE_AUTHORITY_PATH =
  `evals/live-runs/${CANONICAL_EVIDENCE_SMOKE_RUN_ID}.authority.json`
export const CANONICAL_EVIDENCE_SMOKE_PREDICTIONS_PATH =
  `evals/predictions/${CANONICAL_EVIDENCE_SMOKE_RUN_ID}.json`
export const CANONICAL_EVIDENCE_SMOKE_RESULTS_ROOT = 'evals/results'
export const CANONICAL_EVIDENCE_SMOKE_CUMULATIVE_CAP_USD = 7
export const CANONICAL_EVIDENCE_SMOKE_OPENING_ACCOUNTED_USD =
  0.7724995
export const CANONICAL_EVIDENCE_SMOKE_OPENING_MEASURED_USD =
  0.7699985
export const CANONICAL_EVIDENCE_SMOKE_OPENING_UNCERTAIN_USD =
  0.002501
export const CANONICAL_EVIDENCE_SMOKE_AVAILABLE_USD = 6.2275005
export const CANONICAL_EVIDENCE_SMOKE_FRESH_SUBCAP_USD = 0.03
export const CANONICAL_EVIDENCE_SMOKE_ONE_ATTEMPT_RESERVATION_USD =
  0.0070647
export const CANONICAL_EVIDENCE_SMOKE_ALL_ATTEMPTS_RESERVATION_USD =
  0.0282588
export const CANONICAL_EVIDENCE_SMOKE_GEMINI_MODEL =
  CANONICAL_EVIDENCE_SMOKE_MODEL
export const CANONICAL_EVIDENCE_SMOKE_ANSWER_GENERATION =
  CANONICAL_EVIDENCE_ANSWER_GENERATION

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value
  }
  for (const child of Object.values(value)) deepFreeze(child)
  return Object.freeze(value)
}

const writerRequest = buildStatementExtractionRequest({
  turn: {
    assistantMessage: '',
    userMessage: '',
  },
})

export const CANONICAL_EVIDENCE_SMOKE_WRITER_GENERATION = deepFreeze(
  structuredClone(writerRequest.generationConfig),
)

export const CANONICAL_EVIDENCE_SMOKE_LIMITS = deepFreeze({
  maxAttempts: 8,
  maxLogicalRequests: {
    answer: 1,
    judge: 1,
    writer: 1,
  },
  maxResponseBytes: 4 * 1024 * 1024,
  maxTokens: {
    geminiInput: 20_000,
    geminiOutputIncludingThinking: 10_000,
    judgeInput: 1,
    judgeOutput: 1,
  },
  requestTimeoutMs: 60_000,
  retryLimit: 3,
})

export class CanonicalEvidenceSmokeConfigError extends Error {
  constructor(code, message, { cause } = {}) {
    super(message, cause ? { cause } : undefined)
    this.name = 'CanonicalEvidenceSmokeConfigError'
    this.code = code
  }
}

export function canonicalEvidenceSmokeSha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

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

function assertHash(value, label) {
  if (!/^[a-f0-9]{64}$/.test(String(value ?? ''))) {
    throw new CanonicalEvidenceSmokeConfigError(
      'CONFIG_HASH_INVALID',
      `${label} must be one lowercase SHA-256.`,
    )
  }
}

function assertConfig(config) {
  if (!config ||
    config.schemaVersion !== 1 ||
    config.runId !== CANONICAL_EVIDENCE_SMOKE_RUN_ID ||
    config.runDate !== CANONICAL_EVIDENCE_SMOKE_RUN_DATE ||
    config.productCommit !==
      CANONICAL_EVIDENCE_SMOKE_PRODUCT_COMMIT ||
    !sameJson(config.scope, {
      answerOperations: 1,
      benchmarkQuestions: 0,
      datasetLoaded: false,
      judgeOperations: 0,
      logicalOperations: 2,
      provider: 'gemini',
      writerOperations: 1,
    }) ||
    !sameJson(config.models, {
      answer: CANONICAL_EVIDENCE_SMOKE_GEMINI_MODEL,
      writer: CANONICAL_EVIDENCE_SMOKE_GEMINI_MODEL,
    }) ||
    !sameJson(config.generation, {
      answerMaxOutputTokens: 256,
      thinkingLevel: 'MINIMAL',
      writerMaxOutputTokens: 2_000,
      writerResponseFormat: 'APPLICATION_JSON+json-schema',
    }) ||
    !sameJson(
      config.limits,
      CANONICAL_EVIDENCE_SMOKE_LIMITS,
    ) ||
    !sameUsd(
      config.spend?.cumulativeCapUsd,
      CANONICAL_EVIDENCE_SMOKE_CUMULATIVE_CAP_USD,
    ) ||
    !sameUsd(
      config.spend?.openingAccountedUsd,
      CANONICAL_EVIDENCE_SMOKE_OPENING_ACCOUNTED_USD,
    ) ||
    !sameUsd(
      config.spend?.openingMeasuredUsd,
      CANONICAL_EVIDENCE_SMOKE_OPENING_MEASURED_USD,
    ) ||
    !sameUsd(
      config.spend?.openingUncertainUsd,
      CANONICAL_EVIDENCE_SMOKE_OPENING_UNCERTAIN_USD,
    ) ||
    !sameUsd(
      config.spend?.availableUsd,
      CANONICAL_EVIDENCE_SMOKE_AVAILABLE_USD,
    ) ||
    !sameUsd(
      config.spend?.freshSubcapUsd,
      CANONICAL_EVIDENCE_SMOKE_FRESH_SUBCAP_USD,
    ) ||
    !sameUsd(
      config.spend?.oneAttemptReservationUsd,
      CANONICAL_EVIDENCE_SMOKE_ONE_ATTEMPT_RESERVATION_USD,
    ) ||
    !sameUsd(
      config.spend?.allEightAttemptsReservationUsd,
      CANONICAL_EVIDENCE_SMOKE_ALL_ATTEMPTS_RESERVATION_USD,
    ) ||
    !sameJson(config.spend?.pricesUsdPerToken, {
      geminiInput: 0.30 / 1_000_000,
      geminiOutputIncludingThinking: 2.50 / 1_000_000,
    }) ||
    !sameJson(config.prompts, {
      answerProviderMapping:
        'product-built policy, memory JSONL, and question are delimiter-separated in one Gemini user-content prompt',
      fixtureAnswerBodySha256:
        '4ec10745fb488badb00a64d0f3f0c3f1851ac51c99e9fd09d321bb75308bc42e',
      fixtureWriterBodySha256:
        '56fb693f4f3091758cc0806cec5212d4d8cf661e440a00a83889f953d4b1b0d2',
      statementWriterContractSha256:
        '7fae19cfd9923c1a85e5a9e6e0ae6b7f3a96932fd98bb3812633f13555c967ab',
    }) ||
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
      CANONICAL_EVIDENCE_SMOKE_PREDICTIONS_PATH) {
    throw new CanonicalEvidenceSmokeConfigError(
      'CONFIG_SCHEMA_INVALID',
      'Canonical evidence smoke config differs from its frozen scope.',
    )
  }
  assertHash(config.predictions.sha256, 'Predictions hash')
  return config
}

function assertAuthority(authority) {
  if (!authority ||
    authority.schemaVersion !== 1 ||
    authority.runId !== CANONICAL_EVIDENCE_SMOKE_RUN_ID ||
    authority.scope !== 'writer-and-answer-smoke-only' ||
    authority.benchmarkQuestions !== 0 ||
    authority.logicalOperations !== 2 ||
    !sameUsd(
      authority.cumulativeCapUsd,
      CANONICAL_EVIDENCE_SMOKE_CUMULATIVE_CAP_USD,
    ) ||
    !sameUsd(
      authority.freshSubcapUsd,
      CANONICAL_EVIDENCE_SMOKE_FRESH_SUBCAP_USD,
    )) {
    throw new CanonicalEvidenceSmokeConfigError(
      'AUTHORITY_SCHEMA_INVALID',
      'Canonical evidence authority does not permit exactly one smoke.',
    )
  }
  return authority
}

export async function loadCanonicalEvidenceSmokeConfig({
  repoRoot,
} = {}) {
  const configPath = resolve(
    repoRoot,
    CANONICAL_EVIDENCE_SMOKE_CONFIG_PATH,
  )
  const predictionsPath = resolve(
    repoRoot,
    CANONICAL_EVIDENCE_SMOKE_PREDICTIONS_PATH,
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
    if (error instanceof CanonicalEvidenceSmokeConfigError) throw error
    throw new CanonicalEvidenceSmokeConfigError(
      'CONFIG_JSON_INVALID',
      'Canonical evidence config or predictions are invalid JSON.',
      { cause: error },
    )
  }
  const predictionsSha256 =
    canonicalEvidenceSmokeSha256(predictionsBytes)
  if (predictions.status !== 'FINAL' ||
    predictions.runId !== CANONICAL_EVIDENCE_SMOKE_RUN_ID ||
    predictionsSha256 !== config.predictions.sha256) {
    throw new CanonicalEvidenceSmokeConfigError(
      'PREDICTIONS_CHANGED',
      'Canonical evidence FINAL predictions changed after freezing.',
    )
  }
  return {
    config,
    configPath,
    configSha256: canonicalEvidenceSmokeSha256(configBytes),
    predictions,
    predictionsPath,
    predictionsSha256,
  }
}

export async function loadCanonicalEvidenceSmokeAuthority({
  repoRoot,
} = {}) {
  const authorityPath = resolve(
    repoRoot,
    CANONICAL_EVIDENCE_SMOKE_AUTHORITY_PATH,
  )
  const authorityBytes = await readFile(authorityPath)
  let authority
  try {
    authority = assertAuthority(JSON.parse(authorityBytes))
  } catch (error) {
    if (error instanceof CanonicalEvidenceSmokeConfigError) throw error
    throw new CanonicalEvidenceSmokeConfigError(
      'AUTHORITY_JSON_INVALID',
      'Canonical evidence authority is invalid JSON.',
      { cause: error },
    )
  }
  return {
    authority,
    authorityPath,
    authoritySha256:
      canonicalEvidenceSmokeSha256(authorityBytes),
  }
}

export function assertCanonicalEvidenceSmokeEnvironment(
  env,
  config,
  authority,
) {
  if (env.PALARI_CANONICAL_SMOKE_CONFIRM_SPEND !== '1' ||
    Number(env.PALARI_CANONICAL_SMOKE_CUMULATIVE_CAP_USD) !==
      CANONICAL_EVIDENCE_SMOKE_CUMULATIVE_CAP_USD ||
    env.PALARI_CANONICAL_SMOKE_MODEL !==
      CANONICAL_EVIDENCE_SMOKE_GEMINI_MODEL ||
    authority.runId !== config.runId) {
    throw new CanonicalEvidenceSmokeConfigError(
      'LIVE_CONFIRMATION_MISSING',
      'Canonical evidence smoke requires its exact spend and model confirmations.',
    )
  }
  const geminiApiKey = String(env.GEMINI_API_KEY ?? '').trim()
  if (!geminiApiKey) {
    throw new CanonicalEvidenceSmokeConfigError(
      'GEMINI_KEY_MISSING',
      'Canonical evidence smoke requires GEMINI_API_KEY.',
    )
  }
  return {
    cumulativeCapUsd:
      CANONICAL_EVIDENCE_SMOKE_CUMULATIVE_CAP_USD,
    freshSubcapUsd: CANONICAL_EVIDENCE_SMOKE_FRESH_SUBCAP_USD,
    geminiApiKey,
    model: CANONICAL_EVIDENCE_SMOKE_GEMINI_MODEL,
  }
}

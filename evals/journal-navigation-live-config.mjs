// Frozen contract for the smoke-first autonomous journal-navigation run.
//
// Importing this module is inert. It reads tracked JSON only when
// loadJournalNavigationLiveContract is called, and it never reads credentials.

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import {
  INCREMENTAL_HARD_CAP_GEMINI_LIMITS,
  INCREMENTAL_HARD_CAP_GEMINI_MODEL,
  INCREMENTAL_HARD_CAP_GEMINI_PENDING_RESERVATION_USD,
  INCREMENTAL_HARD_CAP_GEMINI_PRICES_USD_PER_MILLION,
} from './incremental-longmemeval-hard-cap-gemini.mjs'
import {
  INCREMENTAL_LONGMEMEVAL_JUDGE_CONTEXT_TOKENS,
  INCREMENTAL_LONGMEMEVAL_JUDGE_MODEL,
  INCREMENTAL_LONGMEMEVAL_JUDGE_PRICING,
  INCREMENTAL_LONGMEMEVAL_JUDGE_REQUEST,
} from './incremental-longmemeval-judge.mjs'

export const JOURNAL_NAVIGATION_LIVE_RUN_ID =
  'j4-journal-navigation-longmemeval-q1-v1'
export const JOURNAL_NAVIGATION_LIVE_RUN_DATE = '2026-07-27'
export const JOURNAL_NAVIGATION_LIVE_PRODUCT_COMMIT =
  'ffe9a8b1c729bc864790554a0dc579d82191760b'
export const JOURNAL_NAVIGATION_LIVE_QUESTION_ID = '08e075c7'

export const JOURNAL_NAVIGATION_LIVE_CONFIG_PATH =
  `evals/live-runs/${JOURNAL_NAVIGATION_LIVE_RUN_ID}.json`
export const JOURNAL_NAVIGATION_LIVE_AUTHORITY_PATH =
  `evals/live-runs/${JOURNAL_NAVIGATION_LIVE_RUN_ID}.authority.json`
export const JOURNAL_NAVIGATION_LIVE_PREDICTIONS_PATH =
  `evals/predictions/${JOURNAL_NAVIGATION_LIVE_RUN_ID}.json`

export const JOURNAL_NAVIGATION_LIVE_DATASET = Object.freeze({
  path: 'data/longmemeval_s_cleaned.json',
  sha256:
    'd6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442',
})

export const JOURNAL_NAVIGATION_LIVE_POPULATION = Object.freeze({
  canonicalRows: 484,
  interactions: 243,
  questionId: JOURNAL_NAVIGATION_LIVE_QUESTION_ID,
  sessions: 45,
  visibleCharacters: 497_983,
  visibleMessages: 484,
})

export const JOURNAL_NAVIGATION_LIVE_MODELS = Object.freeze({
  exploration: INCREMENTAL_HARD_CAP_GEMINI_MODEL,
  judge: INCREMENTAL_LONGMEMEVAL_JUDGE_MODEL,
  smokeReducer: INCREMENTAL_HARD_CAP_GEMINI_MODEL,
})

export const JOURNAL_NAVIGATION_LIVE_SCOPE = Object.freeze({
  benchmarkQuestions: 1,
  comparisonOperations: 0,
  judgeOperations: 1,
  mainMaximumGeminiDispatches: 7,
  mainMaximumToolCalls: 6,
  mainProviderReducerDispatches: 0,
  maximumPhysicalProviderDispatches: 11,
  question2Allowed: false,
  questionIds: Object.freeze([JOURNAL_NAVIGATION_LIVE_QUESTION_ID]),
  smokeGeminiDispatches: 3,
  smokeLocalToolExecutions: 1,
  transportRetryDispatches: 0,
})

export const JOURNAL_NAVIGATION_LIVE_OPENING_SPEND = Object.freeze({
  accountedUsd: 1.0120378,
  measuredUsd: 0.7736072,
  uncertainUsd: 0.2384306,
})

const successMaximum = (outputTokens) =>
  Number(((
    INCREMENTAL_HARD_CAP_GEMINI_LIMITS.inputTokens *
      INCREMENTAL_HARD_CAP_GEMINI_PRICES_USD_PER_MILLION.standardInput +
    outputTokens *
      INCREMENTAL_HARD_CAP_GEMINI_PRICES_USD_PER_MILLION.standardOutput
  ) / 1_000_000).toFixed(12))

const writerSuccessMaximumUsd = successMaximum(2_000)
const explorationSuccessMaximumUsd = successMaximum(256)
const judgePendingReservationUsd = Number((
  INCREMENTAL_LONGMEMEVAL_JUDGE_CONTEXT_TOKENS *
    INCREMENTAL_LONGMEMEVAL_JUDGE_PRICING.reservationHighestTier.input +
  INCREMENTAL_LONGMEMEVAL_JUDGE_REQUEST.maxTokens *
    INCREMENTAL_LONGMEMEVAL_JUDGE_PRICING.reservationHighestTier.output
).toFixed(12))
const smokeSuccessfulMaximumUsd = Number((
  writerSuccessMaximumUsd + 2 * explorationSuccessMaximumUsd
).toFixed(12))
const geminiSuccessfulMaximumUsd = Number((
  writerSuccessMaximumUsd + 9 * explorationSuccessMaximumUsd
).toFixed(12))
const freshSubcapUsd = Number((
  geminiSuccessfulMaximumUsd + judgePendingReservationUsd
).toFixed(12))

export const JOURNAL_NAVIGATION_LIVE_HARD_CAP = Object.freeze({
  cumulativeCapUsd: 8,
  explorationSuccessMaximumUsd,
  freshSubcapUsd,
  geminiPendingReservationUsd:
    INCREMENTAL_HARD_CAP_GEMINI_PENDING_RESERVATION_USD,
  geminiSuccessfulMaximumUsd,
  judgePendingReservationUsd,
  projectedCumulativeMaximumUsd: Number((
    JOURNAL_NAVIGATION_LIVE_OPENING_SPEND.accountedUsd +
      freshSubcapUsd
  ).toFixed(12)),
  smokeMeasuredPassExclusiveUsd: 0.01,
  smokePendingReservationsUsd: Number((
    3 * INCREMENTAL_HARD_CAP_GEMINI_PENDING_RESERVATION_USD
  ).toFixed(12)),
  smokeSuccessfulMaximumUsd,
  writerSuccessMaximumUsd,
})

export const JOURNAL_NAVIGATION_EXPECTED_PREDICTIONS =
  Object.freeze([
    {
      id: 'SMOKE_THREE_GEMINI_CALLS',
      predicted: true,
      statement:
        'Compatibility smoke completes exactly one reducer, one tool-selection, and one answer-continuation Gemini call.',
    },
    {
      id: 'SMOKE_NO_RETRIES',
      predicted: true,
      statement:
        'Compatibility smoke uses zero retry dispatches.',
    },
    {
      id: 'SMOKE_MEASURED_UNDER_ONE_CENT',
      predicted: true,
      statement:
        'Successful compatibility-smoke measured spend is below $0.01.',
    },
    {
      id: 'SMOKE_REDUCER_READY',
      predicted: true,
      statement:
        'The lean reducer stores one grounded user fact and leaves a ready digest with no pending or blocked work.',
    },
    {
      id: 'SMOKE_NAVIGATION_ROUND_TRIP',
      predicted: true,
      statement:
        'The smoke issues one seeded memory_find call, receives the expected canonical evidence, and answers from it.',
    },
    {
      id: 'SMOKE_PRECEDES_DATASET',
      predicted: true,
      statement:
        'The smoke pass receipt is durably verified before the benchmark dataset is parsed.',
    },
    {
      id: 'INGESTION_COMPLETES',
      predicted: true,
      statement:
        'Ingestion completes: 243 interactions, 484 canonical rows, a ready empty digest, and zero provider reducer calls.',
    },
    {
      id: 'MEMORY_FIND_USED',
      predicted: true,
      statement: 'The model issues at least one memory_find call.',
    },
    {
      id: 'FIRST_CHOICE_FIND_MISSES',
      predicted: true,
      statement:
        "The model's first-choice phrase MISSES (returns zero matches) at least once.",
    },
    {
      id: 'RECOVERS_AFTER_MISS',
      predicted: true,
      statement:
        'The model recovers after a miss — by rewording, or by using memory_timeline + memory_read — rather than giving up.',
    },
    {
      id: 'GROUNDED_FINAL_ANSWER',
      predicted: true,
      statement:
        'The final answer is grounded in at least one message in consultedEvidenceIds.',
    },
    {
      id: 'EXPLORATION_WITHIN_BUDGET',
      predicted: true,
      statement:
        'Total exploration calls <= 6; the budget is not exhausted.',
    },
  ])

export class JournalNavigationLiveConfigError extends Error {
  constructor(code, message, { cause } = {}) {
    super(message, cause ? { cause } : undefined)
    this.name = 'JournalNavigationLiveConfigError'
    this.code = code
  }
}

function clone(value) {
  return structuredClone(value)
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function validSha256(value) {
  return /^[a-f0-9]{64}$/u.test(String(value ?? ''))
}

function nonEmpty(value) {
  return typeof value === 'string' && value.length > 0
}

function sameUsd(left, right) {
  return Number.isFinite(Number(left)) &&
    Number.isFinite(Number(right)) &&
    Math.abs(Number(left) - Number(right)) <= 1e-12
}

export function journalNavigationLiveSha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function assertPredictions(predictions) {
  if (!predictions ||
    predictions.schemaVersion !== 1 ||
    predictions.status !== 'FINAL' ||
    predictions.runId !== JOURNAL_NAVIGATION_LIVE_RUN_ID ||
    predictions.recordedAt !== JOURNAL_NAVIGATION_LIVE_RUN_DATE ||
    predictions.productCommit !==
      JOURNAL_NAVIGATION_LIVE_PRODUCT_COMMIT ||
    predictions.questionId !==
      JOURNAL_NAVIGATION_LIVE_QUESTION_ID ||
    !sameJson(predictions.models, JOURNAL_NAVIGATION_LIVE_MODELS) ||
    predictions.noReroll !== true ||
    !sameJson(
      predictions.predictions,
      JOURNAL_NAVIGATION_EXPECTED_PREDICTIONS,
    )) {
    throw new JournalNavigationLiveConfigError(
      'PREDICTIONS_CHANGED',
      'Journal-navigation FINAL predictions changed.',
    )
  }
  return predictions
}

function assertAuthority(authority) {
  const coherentGate =
    (authority?.dispatchAuthorized === false &&
      authority?.exactCapConfirmationRequired === true) ||
    (authority?.dispatchAuthorized === true &&
      authority?.exactCapConfirmationRequired === false)
  if (!authority ||
    authority.schemaVersion !== 1 ||
    authority.runId !== JOURNAL_NAVIGATION_LIVE_RUN_ID ||
    !nonEmpty(authority.founderAuthorization) ||
    authority.scope !==
      'three-call-smoke-then-one-navigation-question' ||
    authority.preRunPreparationAuthorized !== true ||
    !coherentGate ||
    !sameJson(authority.providers, ['gemini', 'openai']) ||
    !sameJson(authority.models, JOURNAL_NAVIGATION_LIVE_MODELS) ||
    !sameJson(
      authority.questionIds,
      [JOURNAL_NAVIGATION_LIVE_QUESTION_ID],
    ) ||
    authority.smokeGeminiDispatches !== 3 ||
    authority.mainMaximumGeminiDispatches !== 7 ||
    authority.mainMaximumToolCalls !== 6 ||
    authority.mainProviderReducerDispatches !== 0 ||
    authority.judgeOperations !== 1 ||
    authority.maximumPhysicalProviderDispatches !== 11 ||
    authority.transportRetryDispatches !== 0 ||
    authority.question2Allowed !== false ||
    authority.publish !== false ||
    !sameUsd(
      authority.cumulativeCapUsd,
      JOURNAL_NAVIGATION_LIVE_HARD_CAP.cumulativeCapUsd,
    ) ||
    !sameUsd(
      authority.freshSubcapUsd,
      JOURNAL_NAVIGATION_LIVE_HARD_CAP.freshSubcapUsd,
    )) {
    throw new JournalNavigationLiveConfigError(
      'AUTHORITY_CHANGED',
      'Journal-navigation authority differs from the frozen gate.',
    )
  }
  return authority
}

function assertConfig(config) {
  const artifactsValid =
    Array.isArray(config?.artifacts) &&
    config.artifacts.length >= 1 &&
    config.artifacts.every((entry) =>
      nonEmpty(entry?.path) && validSha256(entry?.sha256))
  if (!config ||
    config.schemaVersion !== 1 ||
    config.runId !== JOURNAL_NAVIGATION_LIVE_RUN_ID ||
    config.runDate !== JOURNAL_NAVIGATION_LIVE_RUN_DATE ||
    config.productCommit !== JOURNAL_NAVIGATION_LIVE_PRODUCT_COMMIT ||
    !sameJson(config.dataset, JOURNAL_NAVIGATION_LIVE_DATASET) ||
    !sameJson(config.population, JOURNAL_NAVIGATION_LIVE_POPULATION) ||
    !sameJson(config.models, JOURNAL_NAVIGATION_LIVE_MODELS) ||
    !sameJson(config.scope, JOURNAL_NAVIGATION_LIVE_SCOPE) ||
    !sameJson(config.spend?.opening, JOURNAL_NAVIGATION_LIVE_OPENING_SPEND) ||
    !sameJson(config.spend?.hardCap, JOURNAL_NAVIGATION_LIVE_HARD_CAP) ||
    config.predictions?.path !==
      JOURNAL_NAVIGATION_LIVE_PREDICTIONS_PATH ||
    !validSha256(config.predictions?.sha256) ||
    config.authority?.path !==
      JOURNAL_NAVIGATION_LIVE_AUTHORITY_PATH ||
    !sameJson(config.executionLaw, {
      datasetParsedOnlyAfterVerifiedSmoke: true,
      noReroll: true,
      publish: false,
      resultsGitignored: true,
      stopBeforeQuestion2: true,
      transportRetries: 0,
    }) ||
    !artifactsValid) {
    throw new JournalNavigationLiveConfigError(
      'CONFIG_CHANGED',
      'Journal-navigation config differs from the frozen contract.',
    )
  }
  return config
}

export async function loadJournalNavigationLiveContract({
  repoRoot = process.cwd(),
} = {}) {
  const configPath = resolve(
    repoRoot,
    JOURNAL_NAVIGATION_LIVE_CONFIG_PATH,
  )
  const authorityPath = resolve(
    repoRoot,
    JOURNAL_NAVIGATION_LIVE_AUTHORITY_PATH,
  )
  const predictionsPath = resolve(
    repoRoot,
    JOURNAL_NAVIGATION_LIVE_PREDICTIONS_PATH,
  )
  const [configBytes, authorityBytes, predictionsBytes] = await Promise.all([
    readFile(configPath),
    readFile(authorityPath),
    readFile(predictionsPath),
  ])
  let config
  let authority
  let predictions
  try {
    config = JSON.parse(configBytes)
    authority = JSON.parse(authorityBytes)
    predictions = JSON.parse(predictionsBytes)
  } catch (cause) {
    throw new JournalNavigationLiveConfigError(
      'CONTRACT_JSON_INVALID',
      'Journal-navigation contract JSON is invalid.',
      { cause },
    )
  }
  assertConfig(config)
  assertAuthority(authority)
  assertPredictions(predictions)
  const predictionsSha256 =
    journalNavigationLiveSha256(predictionsBytes)
  if (predictionsSha256 !== config.predictions.sha256) {
    throw new JournalNavigationLiveConfigError(
      'PREDICTIONS_HASH_MISMATCH',
      'Journal-navigation prediction bytes differ from the config hash.',
    )
  }
  return {
    authority: clone(authority),
    authorityPath,
    authoritySha256: journalNavigationLiveSha256(authorityBytes),
    config: clone(config),
    configPath,
    configSha256: journalNavigationLiveSha256(configBytes),
    predictions: clone(predictions),
    predictionsPath,
    predictionsSha256,
  }
}

export function assertJournalNavigationLiveEnvironment(
  env,
  config,
  authority,
) {
  assertAuthority(authority)
  assertConfig(config)
  if (!authority.dispatchAuthorized ||
    authority.exactCapConfirmationRequired) {
    throw new JournalNavigationLiveConfigError(
      'FOUNDER_CAP_CONFIRMATION_REQUIRED',
      'The exact fresh subcap requires founder confirmation before credentials or dispatch.',
    )
  }
  if (env.PALARI_JOURNAL_NAVIGATION_CONFIRM_SPEND !== '1' ||
    env.PALARI_JOURNAL_NAVIGATION_RUN_ID !==
      JOURNAL_NAVIGATION_LIVE_RUN_ID ||
    env.PALARI_JOURNAL_NAVIGATION_MODEL !==
      INCREMENTAL_HARD_CAP_GEMINI_MODEL ||
    Number(env.PALARI_JOURNAL_NAVIGATION_CUMULATIVE_CAP_USD) !==
      JOURNAL_NAVIGATION_LIVE_HARD_CAP.cumulativeCapUsd ||
    Number(env.PALARI_JOURNAL_NAVIGATION_FRESH_SUBCAP_USD) !==
      JOURNAL_NAVIGATION_LIVE_HARD_CAP.freshSubcapUsd) {
    throw new JournalNavigationLiveConfigError(
      'LIVE_CONFIRMATION_MISSING',
      'Execution requires the exact run, model, and cap confirmations.',
    )
  }
  const geminiApiKey = String(env.GEMINI_API_KEY ?? '').trim()
  const openaiApiKey = String(env.OPENAI_API_KEY ?? '').trim()
  if (!geminiApiKey || !openaiApiKey) {
    throw new JournalNavigationLiveConfigError(
      'CREDENTIAL_MISSING',
      'Execution requires both GEMINI_API_KEY and OPENAI_API_KEY.',
    )
  }
  return {
    cumulativeCapUsd:
      JOURNAL_NAVIGATION_LIVE_HARD_CAP.cumulativeCapUsd,
    freshSubcapUsd:
      JOURNAL_NAVIGATION_LIVE_HARD_CAP.freshSubcapUsd,
    geminiApiKey,
    openaiApiKey,
    runId: JOURNAL_NAVIGATION_LIVE_RUN_ID,
  }
}

// Frozen contract for the repairing smoke-first journal-navigation successor.
//
// Importing this module is inert. It reads tracked JSON only when
// loadJournalNavigationLiveContract is called, and it never reads credentials.
// The v2 config remains byte-identical because its terminal contract still
// verifies the exact pre-run runtime that produced the sealed v2 evidence.

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import {
  JOURNAL_NAVIGATION_EXPECTED_PREDICTIONS as V2_EXPECTED_PREDICTIONS,
  JOURNAL_NAVIGATION_LIVE_DATASET as V2_DATASET,
  JOURNAL_NAVIGATION_LIVE_HARD_CAP as V2_HARD_CAP,
  JOURNAL_NAVIGATION_LIVE_MODELS as V2_MODELS,
  JOURNAL_NAVIGATION_LIVE_POPULATION as V2_POPULATION,
  journalNavigationLiveSha256,
} from './journal-navigation-live-config.mjs'

export const JOURNAL_NAVIGATION_LIVE_RUN_ID =
  'j4-journal-navigation-longmemeval-q1-v3'
export const JOURNAL_NAVIGATION_LIVE_RUN_DATE = '2026-07-27'
export const JOURNAL_NAVIGATION_LIVE_PRODUCT_COMMIT =
  'f1e587a9476d0c35c1437a12384b7f67844db52a'
export const JOURNAL_NAVIGATION_LIVE_QUESTION_ID = '08e075c7'

export const JOURNAL_NAVIGATION_LIVE_CONFIG_PATH =
  `evals/live-runs/${JOURNAL_NAVIGATION_LIVE_RUN_ID}.json`
export const JOURNAL_NAVIGATION_LIVE_AUTHORITY_PATH =
  `evals/live-runs/${JOURNAL_NAVIGATION_LIVE_RUN_ID}.authority.json`
export const JOURNAL_NAVIGATION_LIVE_PREDICTIONS_PATH =
  `evals/predictions/${JOURNAL_NAVIGATION_LIVE_RUN_ID}.json`

export const JOURNAL_NAVIGATION_LIVE_DATASET = V2_DATASET
export const JOURNAL_NAVIGATION_LIVE_POPULATION = V2_POPULATION
export const JOURNAL_NAVIGATION_LIVE_MODELS = V2_MODELS

export const JOURNAL_NAVIGATION_LIVE_SCOPE = Object.freeze({
  benchmarkQuestions: 1,
  comparisonOperations: 0,
  judgeOperations: 1,
  mainMaximumGeminiDispatches: 7,
  mainMaximumToolCalls: 6,
  mainProviderReducerDispatches: 0,
  maximumPhysicalProviderDispatches: 12,
  question2Allowed: false,
  questionIds: Object.freeze([JOURNAL_NAVIGATION_LIVE_QUESTION_ID]),
  smokeLocalToolExecutions: 1,
  smokeMaximumGeminiDispatches: 4,
  smokeMaximumReducerDispatches: 2,
  smokeMinimumGeminiDispatches: 3,
  smokeReducerMaxRepairs: 1,
  transportRetryDispatches: 0,
})

// This is the exact cumulative v1+v2 terminal spend. The v2 uncertainty is
// retained rather than silently replaced with its smaller measured spend.
export const JOURNAL_NAVIGATION_LIVE_OPENING_SPEND = Object.freeze({
  accountedUsd: 1.2481707,
  measuredUsd: 0.7738105,
  uncertainUsd: 0.4743602,
})

const writerSuccessMaximumUsd = V2_HARD_CAP.writerSuccessMaximumUsd
const explorationSuccessMaximumUsd =
  V2_HARD_CAP.explorationSuccessMaximumUsd
const judgePendingReservationUsd = V2_HARD_CAP.judgePendingReservationUsd
const geminiPendingReservationUsd =
  V2_HARD_CAP.geminiPendingReservationUsd
const smokeSuccessfulMaximumUsd = Number((
  V2_HARD_CAP.smokeSuccessfulMaximumUsd + writerSuccessMaximumUsd
).toFixed(12))
const geminiSuccessfulMaximumUsd = Number((
  V2_HARD_CAP.geminiSuccessfulMaximumUsd + writerSuccessMaximumUsd
).toFixed(12))
const freshSubcapUsd = Number((
  geminiSuccessfulMaximumUsd + judgePendingReservationUsd
).toFixed(12))

export const JOURNAL_NAVIGATION_LIVE_HARD_CAP = Object.freeze({
  cumulativeCapUsd: 8,
  explorationSuccessMaximumUsd,
  freshSubcapUsd,
  geminiPendingReservationUsd,
  geminiSuccessfulMaximumUsd,
  judgePendingReservationUsd,
  projectedCumulativeMaximumUsd: Number((
    JOURNAL_NAVIGATION_LIVE_OPENING_SPEND.accountedUsd +
      freshSubcapUsd
  ).toFixed(12)),
  smokeMeasuredPassExclusiveUsd: 0.01,
  smokePendingReservationsUsd: Number((
    JOURNAL_NAVIGATION_LIVE_SCOPE.smokeMaximumGeminiDispatches *
      geminiPendingReservationUsd
  ).toFixed(12)),
  smokeSuccessfulMaximumUsd,
  writerSuccessMaximumUsd,
})

// The outcome predictions remain unchanged. V3 predicts that the reducer's
// first proposal will be valid (three smoke calls), while allowing one
// separately metered repair if that prediction misses.
export const JOURNAL_NAVIGATION_EXPECTED_PREDICTIONS =
  V2_EXPECTED_PREDICTIONS

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
      'Journal-navigation v3 FINAL predictions changed.',
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
      'repairing-smoke-then-one-navigation-question' ||
    authority.preRunPreparationAuthorized !== true ||
    !coherentGate ||
    !sameJson(authority.providers, ['gemini', 'openai']) ||
    !sameJson(authority.models, JOURNAL_NAVIGATION_LIVE_MODELS) ||
    !sameJson(
      authority.questionIds,
      [JOURNAL_NAVIGATION_LIVE_QUESTION_ID],
    ) ||
    authority.smokeMinimumGeminiDispatches !== 3 ||
    authority.smokeMaximumGeminiDispatches !== 4 ||
    authority.smokeMaximumReducerDispatches !== 2 ||
    authority.smokeReducerMaxRepairs !== 1 ||
    authority.mainMaximumGeminiDispatches !== 7 ||
    authority.mainMaximumToolCalls !== 6 ||
    authority.mainProviderReducerDispatches !== 0 ||
    authority.judgeOperations !== 1 ||
    authority.maximumPhysicalProviderDispatches !== 12 ||
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
      'Journal-navigation v3 authority differs from the frozen gate.',
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
      emptyProviderResponseCode: 'LEAN_REDUCER_EMPTY_RESPONSE',
      noReroll: true,
      publish: false,
      reducerMaxRepairs: 1,
      resultsGitignored: true,
      stopBeforeQuestion2: true,
      transportRetries: 0,
    }) ||
    !artifactsValid) {
    throw new JournalNavigationLiveConfigError(
      'CONFIG_CHANGED',
      'Journal-navigation v3 config differs from the frozen contract.',
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
      'Journal-navigation v3 contract JSON is invalid.',
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
      'Journal-navigation v3 prediction bytes differ from the config hash.',
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
      'The exact v3 fresh subcap requires founder confirmation before credentials or dispatch.',
    )
  }
  if (env.PALARI_JOURNAL_NAVIGATION_CONFIRM_SPEND !== '1' ||
    env.PALARI_JOURNAL_NAVIGATION_RUN_ID !==
      JOURNAL_NAVIGATION_LIVE_RUN_ID ||
    env.PALARI_JOURNAL_NAVIGATION_MODEL !==
      JOURNAL_NAVIGATION_LIVE_MODELS.exploration ||
    Number(env.PALARI_JOURNAL_NAVIGATION_CUMULATIVE_CAP_USD) !==
      JOURNAL_NAVIGATION_LIVE_HARD_CAP.cumulativeCapUsd ||
    Number(env.PALARI_JOURNAL_NAVIGATION_FRESH_SUBCAP_USD) !==
      JOURNAL_NAVIGATION_LIVE_HARD_CAP.freshSubcapUsd) {
    throw new JournalNavigationLiveConfigError(
      'LIVE_CONFIRMATION_MISSING',
      'Execution requires the exact v3 run, model, and cap confirmations.',
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

// Frozen configuration contract for the founder-approved, not-yet-dispatched
// one-question LongMemEval exploration run. Importing this module is inert:
// it reads no files, credentials, dataset, result path, or network resource.

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
import {
  MEMORY_EXPLORATION_TOOLS,
} from '../src/memory-exploration.mjs'

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value
  }
  for (const child of Object.values(value)) deepFreeze(child)
  return Object.freeze(value)
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

function nonEmptyString(value) {
  return typeof value === 'string' && Boolean(value.trim())
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function validSha256(value) {
  return /^[a-f0-9]{64}$/.test(String(value ?? ''))
}

export const EXPLORATION_LONGMEMEVAL_RUN_ID =
  'j4-active-brain-exploration-longmemeval-q1-v1'
export const EXPLORATION_LONGMEMEVAL_RUN_DATE = '2026-07-26'
export const EXPLORATION_LONGMEMEVAL_PRODUCT_COMMIT =
  'e46a65c13bb48c04a005490f200a071ad8d79dee'
export const EXPLORATION_LONGMEMEVAL_QUESTION_ID = '08e075c7'

export const EXPLORATION_LONGMEMEVAL_CONFIG_PATH =
  `evals/live-runs/${EXPLORATION_LONGMEMEVAL_RUN_ID}.json`
export const EXPLORATION_LONGMEMEVAL_AUTHORITY_PATH =
  `evals/live-runs/${EXPLORATION_LONGMEMEVAL_RUN_ID}.authority.json`
export const EXPLORATION_LONGMEMEVAL_PREDICTIONS_PATH =
  `evals/predictions/${EXPLORATION_LONGMEMEVAL_RUN_ID}.json`

export const EXPLORATION_LONGMEMEVAL_DATASET = deepFreeze({
  path: 'data/longmemeval_s_cleaned.json',
  sha256:
    'd6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442',
})

export const EXPLORATION_LONGMEMEVAL_INSTANCE = deepFreeze({
  executionNormalizedBytes: 558_706,
  executionNormalizedSha256:
    'd44a4d388a0398f89c4d8af1452fe6b53ce16066a77d4430ad8136f916a0716e',
  normalizedFormat: 'JSON.stringify(instance, null, 2) + newline',
  pseudonymization:
    'All session IDs replaced by chronological session-NNN aliases before replay.',
  questionId: EXPLORATION_LONGMEMEVAL_QUESTION_ID,
  rawNormalizedBytes: 558_824,
  rawNormalizedSha256:
    '7caf1c76b67ece61d747e829eb3b13bb3046d1101ae4320460cd7fdd2e817fb2',
})

export const EXPLORATION_LONGMEMEVAL_POPULATION = deepFreeze({
  exchangePlanSha256:
    'ea5f7094851ed15d8a958f448b6787bb93366caa73206935cac57a8d833eb9be',
  interactions: 243,
  rawExchangePlanSha256:
    '8441628945e6f6b0685f3b67ef6413a4a249ece8bbc9509af75e6849531c8be3',
  sessions: 45,
  visibleCharacters: 497_983,
  visibleMessages: 484,
})

export const EXPLORATION_LONGMEMEVAL_MODELS = deepFreeze({
  exploration: INCREMENTAL_HARD_CAP_GEMINI_MODEL,
  judge: INCREMENTAL_LONGMEMEVAL_JUDGE_MODEL,
  reducer: INCREMENTAL_HARD_CAP_GEMINI_MODEL,
})

export const EXPLORATION_LONGMEMEVAL_SCOPE = deepFreeze({
  batchIsolationAllowed: true,
  benchmarkQuestions: 1,
  comparisonOperations: 0,
  judgeOperations: 1,
  maxInteractionsPerReducerCall: 20,
  maximumExplorationModelDispatches: 7,
  maximumExplorationToolCalls: 6,
  maximumPhysicalDispatches: 35,
  maximumReducerDispatches: 27,
  question2Allowed: false,
  questionIds: [EXPLORATION_LONGMEMEVAL_QUESTION_ID],
  reduceEvery: 20,
  transportRetryDispatches: 0,
})

export const EXPLORATION_LONGMEMEVAL_POLICY = deepFreeze({
  exactFindOnly: true,
  modelChoosesSearchPhrases: true,
  preseededSearchPhrase: false,
  tools: MEMORY_EXPLORATION_TOOLS.map(({ name }) => name),
})

export const EXPLORATION_LONGMEMEVAL_OPENING_SPEND = deepFreeze({
  accountedUsd: 0.7761082,
  measuredUsd: 0.7736072,
  uncertainUsd: 0.002501,
})

export const EXPLORATION_LONGMEMEVAL_EXPECTED_COST = deepFreeze({
  freshUsd: 0.0660333,
  guarantee: false,
  ingestion: {
    inputPriceUsdPerMillion: 0.10,
    inputTokenHeuristic: 276_556,
    inputUsd: 0.0276556,
    outputPriceUsdPerMillion: 0.40,
    outputTokens: 50_000,
    outputUsd: 0.02,
    protocolTokensPerDispatch: 512,
    reducerDispatches: 25,
    serializedRequestBytes: 1_054_988,
    serializedRequestBytesByDispatch: [
      40_869,
      41_954,
      41_518,
      43_088,
      43_331,
      42_426,
      41_082,
      43_472,
      43_894,
      43_359,
      43_803,
      42_099,
      40_777,
      41_832,
      41_869,
      43_371,
      40_744,
      40_153,
      42_503,
      43_188,
      43_191,
      41_772,
      41_874,
      42_926,
      39_893,
    ],
    sumPerDispatchCeilBytesDivFour: 263_756,
    usd: 0.0476556,
  },
  judge: {
    hypothesisCharacters: 1_024,
    inputPriceUsdPerMillion: 2.50,
    inputTokenHeuristic: 931,
    outputPriceUsdPerMillion: 10,
    outputTokens: 10,
    protocolTokens: 512,
    serializedBodyBytes: 1_676,
    usd: 0.0024275,
  },
  method:
    'Expected USD uses the deterministic stand-in reducer over the pseudonymized ordinal-1 cadence-20 execution, measured serialized request shapes, bytes/4 plus 512-token heuristics, full configured output allowances, bounded exploration-result assumptions, and Standard prices. It is an estimate, not the provider-window hard-cap proof.',
  exploration: {
    baseSerializedBytesPerTurn: 22_000,
    inputPriceUsdPerMillion: 0.10,
    inputTokenHeuristic: 152_334,
    modelDispatches: 7,
    outputPriceUsdPerMillion: 0.40,
    outputTokens: 1_792,
    protocolTokensPerDispatch: 512,
    serializedBytesAcrossTurns: 595_000,
    toolExchangeSerializedBytes: 21_000,
    toolHistoryTriangularSum: 21,
    usd: 0.0159502,
  },
})

const reducerSuccessMaximumUsd = Number(((
  INCREMENTAL_HARD_CAP_GEMINI_LIMITS.inputTokens *
    INCREMENTAL_HARD_CAP_GEMINI_PRICES_USD_PER_MILLION.standardInput +
  2_000 *
    INCREMENTAL_HARD_CAP_GEMINI_PRICES_USD_PER_MILLION.standardOutput
) / 1_000_000).toFixed(12))

const explorationSuccessMaximumUsd = Number(((
  INCREMENTAL_HARD_CAP_GEMINI_LIMITS.inputTokens *
    INCREMENTAL_HARD_CAP_GEMINI_PRICES_USD_PER_MILLION.standardInput +
  256 *
    INCREMENTAL_HARD_CAP_GEMINI_PRICES_USD_PER_MILLION.standardOutput
) / 1_000_000).toFixed(12))

const judgePendingReservationUsd = Number((
  INCREMENTAL_LONGMEMEVAL_JUDGE_CONTEXT_TOKENS *
    INCREMENTAL_LONGMEMEVAL_JUDGE_PRICING.reservationHighestTier.input +
  INCREMENTAL_LONGMEMEVAL_JUDGE_REQUEST.maxTokens *
    INCREMENTAL_LONGMEMEVAL_JUDGE_PRICING.reservationHighestTier.output
).toFixed(12))

const freshHardCapUsd = Number((
  EXPLORATION_LONGMEMEVAL_SCOPE.maximumReducerDispatches *
    reducerSuccessMaximumUsd +
  EXPLORATION_LONGMEMEVAL_SCOPE.maximumExplorationModelDispatches *
    explorationSuccessMaximumUsd +
  judgePendingReservationUsd
).toFixed(12))

export const EXPLORATION_LONGMEMEVAL_HARD_CAP = deepFreeze({
  cumulativeCapUsd: 8,
  explorationSuccessMaximumUsd,
  freshSubcapUsd: freshHardCapUsd,
  geminiPendingReservationUsd:
    INCREMENTAL_HARD_CAP_GEMINI_PENDING_RESERVATION_USD,
  judgePendingReservationUsd,
  projectedCumulativeMaximumUsd: Number((
    EXPLORATION_LONGMEMEVAL_OPENING_SPEND.accountedUsd +
      freshHardCapUsd
  ).toFixed(12)),
  reducerSuccessMaximumUsd,
})

export const EXPLORATION_LONGMEMEVAL_ARTIFACTS_PENDING = deepFreeze({
  entries: [],
  reason:
    'Root must replace this placeholder with exact runtime artifact paths and SHA-256 values after every implementation byte settles.',
  status: 'PENDING_RUNTIME_ARTIFACT_HASHES',
})

export const EXPLORATION_LONGMEMEVAL_EXPECTED_PREDICTIONS =
  deepFreeze([
    {
      id: 'INGESTION_COMPLETES',
      predicted: true,
      statement:
        'Ingestion completes: 243 interactions, 0 quarantined, digest ready.',
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

export class ExplorationLongMemEvalConfigError extends Error {
  constructor(code, message, { cause } = {}) {
    super(message, cause ? { cause } : undefined)
    this.name = 'ExplorationLongMemEvalConfigError'
    this.code = code
  }
}

function assertArtifacts(artifacts, { allowPendingArtifacts }) {
  if (sameJson(
    artifacts,
    EXPLORATION_LONGMEMEVAL_ARTIFACTS_PENDING,
  )) {
    if (!allowPendingArtifacts) {
      throw new ExplorationLongMemEvalConfigError(
        'ARTIFACT_HASHES_PENDING',
        'Exploration runtime artifact hashes have not been frozen.',
      )
    }
    return
  }
  if (!Array.isArray(artifacts) ||
    artifacts.length < 1 ||
    artifacts.some((entry) =>
      !nonEmptyString(entry?.path) || !validSha256(entry?.sha256))) {
    throw new ExplorationLongMemEvalConfigError(
      'ARTIFACTS_INVALID',
      'Exploration artifacts must be a non-empty path/SHA-256 array.',
    )
  }
}

function assertConfig(config, { allowPendingArtifacts = false } = {}) {
  if (!config ||
    config.schemaVersion !== 1 ||
    config.runId !== EXPLORATION_LONGMEMEVAL_RUN_ID ||
    config.runDate !== EXPLORATION_LONGMEMEVAL_RUN_DATE ||
    config.productCommit !== EXPLORATION_LONGMEMEVAL_PRODUCT_COMMIT ||
    !sameJson(config.dataset, EXPLORATION_LONGMEMEVAL_DATASET) ||
    !sameJson(config.instance, EXPLORATION_LONGMEMEVAL_INSTANCE) ||
    !sameJson(config.population, EXPLORATION_LONGMEMEVAL_POPULATION) ||
    !sameJson(config.models, EXPLORATION_LONGMEMEVAL_MODELS) ||
    !sameJson(config.scope, EXPLORATION_LONGMEMEVAL_SCOPE) ||
    !sameJson(
      config.explorationPolicy,
      EXPLORATION_LONGMEMEVAL_POLICY,
    ) ||
    !sameJson(
      config.generation,
      {
        explorationMaxOutputTokens: 256,
        judge: INCREMENTAL_LONGMEMEVAL_JUDGE_REQUEST,
        reducerMaxOutputTokens: 2_000,
        thinkingBudget: 0,
      },
    ) ||
    !sameJson(
      config.spend?.opening,
      EXPLORATION_LONGMEMEVAL_OPENING_SPEND,
    ) ||
    !sameJson(
      config.spend?.expected,
      EXPLORATION_LONGMEMEVAL_EXPECTED_COST,
    ) ||
    !sameJson(
      config.spend?.hardCap,
      EXPLORATION_LONGMEMEVAL_HARD_CAP,
    ) ||
    config.predictions?.path !==
      EXPLORATION_LONGMEMEVAL_PREDICTIONS_PATH ||
    !validSha256(config.predictions?.sha256) ||
    config.authority?.path !==
      EXPLORATION_LONGMEMEVAL_AUTHORITY_PATH ||
    !sameJson(config.executionLaw, {
      checkpointEveryCanonicalInteraction: true,
      noReroll: true,
      providerJournalEveryDispatch: true,
      publish: false,
      resultsGitignored: true,
      stopBeforeQuestion2: true,
    })) {
    throw new ExplorationLongMemEvalConfigError(
      'CONFIG_SCHEMA_INVALID',
      'Exploration config differs from its exact one-question contract.',
    )
  }
  assertArtifacts(config.artifacts, { allowPendingArtifacts })
  return config
}

function assertPredictions(predictions) {
  if (!predictions ||
    predictions.schemaVersion !== 1 ||
    predictions.status !== 'FINAL' ||
    predictions.runId !== EXPLORATION_LONGMEMEVAL_RUN_ID ||
    predictions.recordedAt !== EXPLORATION_LONGMEMEVAL_RUN_DATE ||
    predictions.productCommit !==
      EXPLORATION_LONGMEMEVAL_PRODUCT_COMMIT ||
    predictions.questionId !== EXPLORATION_LONGMEMEVAL_QUESTION_ID ||
    !sameJson(predictions.models, EXPLORATION_LONGMEMEVAL_MODELS) ||
    predictions.noReroll !== true ||
    !sameJson(
      predictions.predictions,
      EXPLORATION_LONGMEMEVAL_EXPECTED_PREDICTIONS,
    )) {
    throw new ExplorationLongMemEvalConfigError(
      'PREDICTIONS_CHANGED',
      'Exploration FINAL predictions differ from the founder preregistration.',
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
    authority.runId !== EXPLORATION_LONGMEMEVAL_RUN_ID ||
    !nonEmptyString(authority.founderAuthorization) ||
    authority.scope !== 'one-exploration-longmemeval-question-only' ||
    authority.preRunPreparationAuthorized !== true ||
    !coherentGate ||
    !sameJson(authority.providers, ['gemini', 'openai']) ||
    !sameJson(authority.models, EXPLORATION_LONGMEMEVAL_MODELS) ||
    !sameJson(
      authority.questionIds,
      [EXPLORATION_LONGMEMEVAL_QUESTION_ID],
    ) ||
    authority.reduceEvery !==
      EXPLORATION_LONGMEMEVAL_SCOPE.reduceEvery ||
    authority.maxInteractionsPerReducerCall !==
      EXPLORATION_LONGMEMEVAL_SCOPE.maxInteractionsPerReducerCall ||
    authority.maximumReducerDispatches !==
      EXPLORATION_LONGMEMEVAL_SCOPE.maximumReducerDispatches ||
    authority.maximumExplorationToolCalls !==
      EXPLORATION_LONGMEMEVAL_SCOPE.maximumExplorationToolCalls ||
    authority.maximumExplorationModelDispatches !==
      EXPLORATION_LONGMEMEVAL_SCOPE.maximumExplorationModelDispatches ||
    authority.judgeOperations !== 1 ||
    authority.maximumPhysicalDispatches !==
      EXPLORATION_LONGMEMEVAL_SCOPE.maximumPhysicalDispatches ||
    authority.batchIsolationAllowed !== true ||
    authority.transportRetryDispatches !== 0 ||
    authority.comparisonOperations !== 0 ||
    authority.question2Allowed !== false ||
    !sameUsd(
      authority.cumulativeCapUsd,
      EXPLORATION_LONGMEMEVAL_HARD_CAP.cumulativeCapUsd,
    ) ||
    !sameUsd(
      authority.freshSubcapUsd,
      EXPLORATION_LONGMEMEVAL_HARD_CAP.freshSubcapUsd,
    ) ||
    authority.publish !== false) {
    throw new ExplorationLongMemEvalConfigError(
      'AUTHORITY_SCHEMA_INVALID',
      'Exploration authority differs from its exact one-question gate.',
    )
  }
  return authority
}

export function explorationLongMemEvalSha256(value) {
  return sha256(value)
}

export async function loadExplorationLongMemEvalContract({
  allowPendingArtifacts = false,
  repoRoot = process.cwd(),
} = {}) {
  const configPath = resolve(repoRoot, EXPLORATION_LONGMEMEVAL_CONFIG_PATH)
  const predictionsPath = resolve(
    repoRoot,
    EXPLORATION_LONGMEMEVAL_PREDICTIONS_PATH,
  )
  const authorityPath = resolve(
    repoRoot,
    EXPLORATION_LONGMEMEVAL_AUTHORITY_PATH,
  )
  const [configBytes, predictionsBytes, authorityBytes] = await Promise.all([
    readFile(configPath),
    readFile(predictionsPath),
    readFile(authorityPath),
  ])
  let config
  let predictions
  let authority
  try {
    config = JSON.parse(configBytes)
    predictions = JSON.parse(predictionsBytes)
    authority = JSON.parse(authorityBytes)
  } catch (error) {
    throw new ExplorationLongMemEvalConfigError(
      'CONTRACT_JSON_INVALID',
      'Exploration config, predictions, or authority is invalid JSON.',
      { cause: error },
    )
  }
  assertConfig(config, { allowPendingArtifacts })
  assertPredictions(predictions)
  assertAuthority(authority)
  const predictionsSha256 = sha256(predictionsBytes)
  if (predictionsSha256 !== config.predictions.sha256) {
    throw new ExplorationLongMemEvalConfigError(
      'PREDICTIONS_HASH_MISMATCH',
      'Exploration prediction bytes differ from the config hash.',
    )
  }
  return {
    authority,
    authorityPath,
    authoritySha256: sha256(authorityBytes),
    config,
    configPath,
    configSha256: sha256(configBytes),
    predictions,
    predictionsPath,
    predictionsSha256,
  }
}

// Credential fields are deliberately read last. With the tracked pending
// authority this function refuses before it inspects any key-bearing field.
export function assertExplorationLongMemEvalEnvironment(
  env,
  config,
  authority,
) {
  assertAuthority(authority)
  if (!authority.dispatchAuthorized ||
    authority.exactCapConfirmationRequired) {
    throw new ExplorationLongMemEvalConfigError(
      'FOUNDER_CAP_CONFIRMATION_REQUIRED',
      'The exact $4.1316452 fresh cap requires founder confirmation before credentials or dispatch.',
    )
  }
  assertConfig(config)
  if (authority.runId !== config.runId ||
    env.PALARI_EXPLORATION_LONGMEMEVAL_CONFIRM_SPEND !== '1' ||
    env.PALARI_EXPLORATION_LONGMEMEVAL_RUN_ID !==
      EXPLORATION_LONGMEMEVAL_RUN_ID ||
    env.PALARI_EXPLORATION_LONGMEMEVAL_MODEL !==
      INCREMENTAL_HARD_CAP_GEMINI_MODEL ||
    Number(
      env.PALARI_EXPLORATION_LONGMEMEVAL_CUMULATIVE_CAP_USD,
    ) !== EXPLORATION_LONGMEMEVAL_HARD_CAP.cumulativeCapUsd ||
    Number(
      env.PALARI_EXPLORATION_LONGMEMEVAL_FRESH_SUBCAP_USD,
    ) !== EXPLORATION_LONGMEMEVAL_HARD_CAP.freshSubcapUsd) {
    throw new ExplorationLongMemEvalConfigError(
      'LIVE_CONFIRMATION_MISSING',
      'Exploration execution requires exact run, model, and cap confirmations.',
    )
  }
  const geminiApiKey = String(env.GEMINI_API_KEY ?? '').trim()
  const openaiApiKey = String(env.OPENAI_API_KEY ?? '').trim()
  if (!geminiApiKey) {
    throw new ExplorationLongMemEvalConfigError(
      'GEMINI_KEY_MISSING',
      'Exploration execution requires GEMINI_API_KEY.',
    )
  }
  if (!openaiApiKey) {
    throw new ExplorationLongMemEvalConfigError(
      'OPENAI_KEY_MISSING',
      'Exploration execution requires OPENAI_API_KEY.',
    )
  }
  return {
    cumulativeCapUsd:
      EXPLORATION_LONGMEMEVAL_HARD_CAP.cumulativeCapUsd,
    freshSubcapUsd: EXPLORATION_LONGMEMEVAL_HARD_CAP.freshSubcapUsd,
    geminiApiKey,
    model: INCREMENTAL_HARD_CAP_GEMINI_MODEL,
    openaiApiKey,
    runId: EXPLORATION_LONGMEMEVAL_RUN_ID,
  }
}

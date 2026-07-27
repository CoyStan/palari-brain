// Pure prediction grader for the smoke-first journal-navigation experiment.
//
// The compatibility smoke and the benchmark navigation result are separate
// evidence domains on purpose. In particular, the seeded smoke lookup must
// never satisfy a prediction about the model's autonomous benchmark lookup.
// Callers provide the immutable FINAL prediction rows and raw observations;
// this module derives every outcome mechanically and performs no I/O.

const SMOKE_PREDICTION_IDS = Object.freeze([
  'SMOKE_THREE_GEMINI_CALLS',
  'SMOKE_NO_RETRIES',
  'SMOKE_MEASURED_UNDER_ONE_CENT',
  'SMOKE_REDUCER_READY',
  'SMOKE_NAVIGATION_ROUND_TRIP',
  'SMOKE_PRECEDES_DATASET',
])

const NAVIGATION_PREDICTION_IDS = Object.freeze([
  'INGESTION_COMPLETES',
  'MEMORY_FIND_USED',
  'FIRST_CHOICE_FIND_MISSES',
  'RECOVERS_AFTER_MISS',
  'GROUNDED_FINAL_ANSWER',
  'EXPLORATION_WITHIN_BUDGET',
])

export const JOURNAL_NAVIGATION_PREDICTION_IDS = Object.freeze([
  ...SMOKE_PREDICTION_IDS,
  ...NAVIGATION_PREDICTION_IDS,
])

const PREDICTION_ID_SET =
  new Set(JOURNAL_NAVIGATION_PREDICTION_IDS)
const OUTCOME_RANK = Object.freeze({
  miss: 0,
  hit: 1,
})

export class JournalNavigationPredictionOracleError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'JournalNavigationPredictionOracleError'
    this.code = code
  }
}

function reject(code, message) {
  throw new JournalNavigationPredictionOracleError(code, message)
}

function isObject(value) {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
}

function finiteNonNegative(value) {
  return Number.isFinite(value) && value >= 0
}

function snapshotCount(snapshot, key) {
  const value = snapshot?.logicalRequests?.[key] ?? 0
  return Number.isSafeInteger(value) && value >= 0
    ? value
    : Number.NaN
}

function snapshotAttempts(snapshot) {
  return Number.isSafeInteger(snapshot?.attempts) &&
      snapshot.attempts >= 0
    ? snapshot.attempts
    : Number.NaN
}

function snapshotMeasuredUsd(snapshot) {
  const value = snapshot?.measured?.usd
  return finiteNonNegative(value) ? value : Number.NaN
}

function meterDelta(meter) {
  const before = meter?.smokeBefore
  const after = meter?.smokeAfter
  const attempts =
    snapshotAttempts(after) - snapshotAttempts(before)
  const writer =
    snapshotCount(after, 'writer') -
    snapshotCount(before, 'writer')
  const explore =
    snapshotCount(after, 'explore') -
    snapshotCount(before, 'explore')
  const measuredUsd = Number((
    snapshotMeasuredUsd(after) -
    snapshotMeasuredUsd(before)
  ).toFixed(12))
  return {
    attempts,
    explore,
    logicalRequests: writer + explore,
    measuredUsd,
    retries: attempts - writer - explore,
    writer,
  }
}

function successfulSmokeCalls(smoke) {
  const expectedPurposes = ['writer', 'explore', 'explore']
  return Array.isArray(smoke?.calls) &&
    smoke.calls.length === expectedPurposes.length &&
    smoke.calls.every((call, index) =>
      isObject(call) &&
      call.provider === 'gemini' &&
      call.purpose === expectedPurposes[index] &&
      call.status === 'success' &&
      call.physicalCall === index + 1)
}

function smokeReducerReady(smoke) {
  const reducer = smoke?.reducer
  const digest = reducer?.digest
  return isObject(reducer) &&
    isObject(digest) &&
    digest.ready === true &&
    digest.status === 'ready' &&
    digest.pending === 0 &&
    digest.blocked === 0 &&
    reducer.digestItems === 1
}

function resultEvidenceIds(result) {
  if (Array.isArray(result?.matches)) {
    return result.matches
      .map(({ evidenceId }) => evidenceId)
      .filter((value) =>
        typeof value === 'string' && Boolean(value))
  }
  if (Array.isArray(result?.messages)) {
    return result.messages
      .map(({ evidenceId }) => evidenceId)
      .filter((value) =>
        typeof value === 'string' && Boolean(value))
  }
  return []
}

function findAttempt(call) {
  return call?.tool === 'memory_find' &&
    isObject(call?.input) &&
    typeof call.input.phrase === 'string' &&
    Boolean(call.input.phrase)
}

function successfulFind(call) {
  return findAttempt(call) &&
    call?.outcome === 'success' &&
    Array.isArray(call?.result?.matches)
}

function smokeRoundTrip(smoke) {
  const exploration = smoke?.exploration
  const calls = exploration?.toolCalls
  const expectedEvidenceId = exploration?.expectedEvidenceId
  const opaqueToken = exploration?.opaqueToken
  const answer = exploration?.answer
  return isObject(exploration) &&
    exploration.modelDispatches === 2 &&
    Array.isArray(calls) &&
    calls.length === 1 &&
    successfulFind(calls[0]) &&
    resultEvidenceIds(calls[0].result)
      .includes(expectedEvidenceId) &&
    Array.isArray(exploration.consultedEvidenceIds) &&
    exploration.consultedEvidenceIds.includes(expectedEvidenceId) &&
    typeof expectedEvidenceId === 'string' &&
    Boolean(expectedEvidenceId) &&
    typeof opaqueToken === 'string' &&
    Boolean(opaqueToken) &&
    typeof answer === 'string' &&
    answer.includes(opaqueToken)
}

function smokePrecedesDataset(smoke) {
  const events = smoke?.phaseEvents
  if (!Array.isArray(events)) return false
  const receiptIndexes = []
  const datasetIndexes = []
  for (const [index, event] of events.entries()) {
    if (event?.type === 'smoke_receipt' &&
      event.status === 'passed') {
      receiptIndexes.push(index)
    }
    if (event?.type === 'dataset_loaded') {
      datasetIndexes.push(index)
    }
  }
  return receiptIndexes.length === 1 &&
    datasetIndexes.length === 1 &&
    receiptIndexes[0] < datasetIndexes[0] &&
    events.slice(0, receiptIndexes[0] + 1)
      .every((event) => event?.datasetLoaded === false)
}

function navigationResult(navigation) {
  return isObject(navigation?.result)
    ? navigation.result
    : navigation
}

function mainToolTranscript(navigation) {
  const result = navigationResult(navigation)
  return Array.isArray(result?.providerToolTranscript)
    ? result.providerToolTranscript
    : []
}

function toolCallObservation(call) {
  const input = isObject(call?.input)
    ? Object.freeze({ ...call.input })
    : null
  return Object.freeze({
    errorCode:
      typeof call?.error?.code === 'string'
        ? call.error.code
        : '',
    input,
    outcome: String(call?.outcome ?? ''),
    returnedEvidenceIds:
      Object.freeze(resultEvidenceIds(call?.result)),
    tool: String(call?.tool ?? ''),
  })
}

function firstFind(transcript) {
  return transcript.find(findAttempt)
}

function findMiss(call) {
  return successfulFind(call) &&
    call.result.matches.length === 0
}

function callHasEvidence(call) {
  return call?.outcome === 'success' &&
    resultEvidenceIds(call?.result).length > 0
}

function consultedEvidenceIsReturned(result, transcript) {
  const consulted = result?.consultedEvidenceIds
  if (!Array.isArray(consulted) ||
    consulted.length < 1 ||
    consulted.some((value) =>
      typeof value !== 'string' || !value)) {
    return false
  }
  const returned = new Set(
    transcript.flatMap((call) =>
      call?.outcome === 'success'
        ? resultEvidenceIds(call?.result)
        : []),
  )
  return consulted.every((evidenceId) => returned.has(evidenceId))
}

function recoveryAfterMiss(transcript) {
  const missIndex = transcript.findIndex(findMiss)
  if (missIndex < 0) return false
  const miss = transcript[missIndex]
  const later = transcript.slice(missIndex + 1)
  const rewordedFind = later.some((call) =>
    successfulFind(call) &&
    call.input.phrase !== miss.input.phrase &&
    callHasEvidence(call))
  const timelineIndex = later.findIndex((call) =>
    call?.tool === 'memory_timeline' &&
    call?.outcome === 'success')
  const timelineThenRead = timelineIndex >= 0 &&
    later.slice(timelineIndex + 1).some((call) =>
      call?.tool === 'memory_read' && callHasEvidence(call))
  return rewordedFind || timelineThenRead
}

function ingestionReady(navigation) {
  const result = navigationResult(navigation)
  const digest = result?.digest
  return isObject(result) &&
    result.exchanges === 243 &&
    result.canonicalRows === 484 &&
    result.externalReducerCalls === 0 &&
    result.digestItems === 0 &&
    isObject(digest) &&
    digest.ready === true &&
    digest.status === 'ready' &&
    digest.pending === 0 &&
    digest.blocked === 0
}

function judgeObservation(judge) {
  const label = String(judge?.label ?? '')
  return {
    completed:
      judge?.attempts === 1 &&
      judge?.status === 'complete',
    correct:
      judge?.attempts === 1 &&
      judge?.status === 'complete' &&
      (judge?.correct === true || label.toLowerCase() === 'yes'),
    label,
  }
}

function validatePredictions(predictions) {
  if (!Array.isArray(predictions) ||
    predictions.length !==
      JOURNAL_NAVIGATION_PREDICTION_IDS.length ||
    new Set(predictions.map(({ id }) => id)).size !==
      JOURNAL_NAVIGATION_PREDICTION_IDS.length ||
    predictions.some((prediction) =>
      !PREDICTION_ID_SET.has(prediction?.id) ||
      typeof prediction.predicted !== 'boolean' ||
      typeof prediction.statement !== 'string' ||
      !prediction.statement.trim())) {
    reject(
      'PREDICTIONS_INVALID',
      'FINAL predictions must contain every supported ID exactly once.',
    )
  }
}

export function auditJournalNavigationPredictionEvidence({
  judge,
  meter,
  navigation,
  smoke,
} = {}) {
  const delta = meterDelta(meter)
  const callsValid = successfulSmokeCalls(smoke)
  const transcript = mainToolTranscript(navigation)
  const mainFind = firstFind(transcript)
  const result = navigationResult(navigation)
  const toolAttempts = result?.toolAttempts
  const observations = Object.freeze({
    SMOKE_THREE_GEMINI_CALLS:
      callsValid &&
      delta.attempts === 3 &&
      delta.writer === 1 &&
      delta.explore === 2,
    SMOKE_NO_RETRIES:
      callsValid &&
      delta.logicalRequests === 3 &&
      delta.retries === 0,
    SMOKE_MEASURED_UNDER_ONE_CENT:
      finiteNonNegative(delta.measuredUsd) &&
      delta.measuredUsd < 0.01,
    SMOKE_REDUCER_READY: smokeReducerReady(smoke),
    SMOKE_NAVIGATION_ROUND_TRIP: smokeRoundTrip(smoke),
    SMOKE_PRECEDES_DATASET: smokePrecedesDataset(smoke),
    INGESTION_COMPLETES: ingestionReady(navigation),
    MEMORY_FIND_USED: transcript.some(findAttempt),
    FIRST_CHOICE_FIND_MISSES: findMiss(mainFind),
    RECOVERS_AFTER_MISS: recoveryAfterMiss(transcript),
    GROUNDED_FINAL_ANSWER:
      consultedEvidenceIsReturned(result, transcript),
    EXPLORATION_WITHIN_BUDGET:
      Number.isSafeInteger(toolAttempts) &&
      toolAttempts >= 0 &&
      toolAttempts <= 6 &&
      result?.toolAttemptBudgetExhausted === false &&
      result?.explorationExhausted === false,
  })
  return Object.freeze({
    computed: Object.freeze({
      judge: Object.freeze(judgeObservation(judge)),
      navigation: Object.freeze({
        canonicalRows: result?.canonicalRows ?? null,
        consultedEvidenceIds:
          Array.isArray(result?.consultedEvidenceIds)
            ? Object.freeze([...result.consultedEvidenceIds])
            : Object.freeze([]),
        digestItems: result?.digestItems ?? null,
        exchanges: result?.exchanges ?? null,
        externalReducerCalls:
          result?.externalReducerCalls ?? null,
        findPhrases: Object.freeze(
          transcript
            .filter(successfulFind)
            .map(({ input }) => input.phrase),
        ),
        toolAttempts:
          Number.isSafeInteger(toolAttempts)
            ? toolAttempts
            : null,
        toolCalls: Object.freeze(
          transcript.map(toolCallObservation),
        ),
      }),
      smoke: Object.freeze({
        calls: callsValid ? 3 : 0,
        digestItems: smoke?.reducer?.digestItems ?? null,
        expectedEvidenceId:
          smoke?.exploration?.expectedEvidenceId ?? null,
        exploreRequests:
          Number.isFinite(delta.explore) ? delta.explore : null,
        measuredUsd:
          Number.isFinite(delta.measuredUsd)
            ? delta.measuredUsd
            : null,
        retries:
          Number.isFinite(delta.retries) ? delta.retries : null,
        writerRequests:
          Number.isFinite(delta.writer) ? delta.writer : null,
      }),
    }),
    observations,
  })
}

export function gradeJournalNavigationPredictionsFromEvidence({
  evidence,
  predictions,
} = {}) {
  validatePredictions(predictions)
  const { computed, observations } =
    auditJournalNavigationPredictionEvidence(evidence)
  const grades = predictions
    .map((prediction, index) => {
      const observed = observations[prediction.id]
      return {
        id: prediction.id,
        index,
        observed,
        outcome:
          observed === prediction.predicted ? 'hit' : 'miss',
        predicted: prediction.predicted,
        statement: prediction.statement,
      }
    })
    .sort((left, right) =>
      OUTCOME_RANK[left.outcome] -
        OUTCOME_RANK[right.outcome] ||
      left.index - right.index)
    .map(({ index: _index, ...grade }) =>
      Object.freeze(grade))
  return Object.freeze({
    computed,
    grades: Object.freeze(grades),
    observations,
  })
}

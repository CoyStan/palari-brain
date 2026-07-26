// Evidence-only grader for the one-question autonomous memory-exploration
// run. It derives every prediction from the arm's durable result, the
// immutable interaction-checkpoint aggregate, and provider meter evidence.
// Callers cannot supply outcome booleans.

import {
  EXPLORATION_LONGMEMEVAL_EXPECTED_PREDICTIONS,
  EXPLORATION_LONGMEMEVAL_HARD_CAP,
  EXPLORATION_LONGMEMEVAL_MODELS,
  EXPLORATION_LONGMEMEVAL_OPENING_SPEND,
  EXPLORATION_LONGMEMEVAL_POPULATION,
  EXPLORATION_LONGMEMEVAL_QUESTION_ID,
  EXPLORATION_LONGMEMEVAL_RUN_ID,
  EXPLORATION_LONGMEMEVAL_SCOPE,
} from './exploration-longmemeval-live-config.mjs'

const OUTCOME_RANK = Object.freeze({
  miss: 0,
  not_observed: 1,
  hit: 2,
})
const PREDICTION_IDS = new Set(
  EXPLORATION_LONGMEMEVAL_EXPECTED_PREDICTIONS
    .map(({ id }) => id),
)
const TOOL_NAMES = new Set([
  'memory_find',
  'memory_read',
  'memory_timeline',
])
const USD_TOLERANCE = 1e-12

export class ExplorationLongMemEvalPredictionOracleError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'ExplorationLongMemEvalPredictionOracleError'
    this.code = code
  }
}

function reject(code, message) {
  throw new ExplorationLongMemEvalPredictionOracleError(code, message)
}

function isObject(value) {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
}

function finiteNonNegative(value) {
  return Number.isFinite(value) && value >= 0
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function sortedUnique(values) {
  return [...new Set(values.map(String))].sort()
}

function resultEvidenceRows(entry) {
  if (entry.tool === 'memory_find') {
    return Array.isArray(entry.result?.matches)
      ? entry.result.matches
      : null
  }
  if (entry.tool === 'memory_read') {
    return Array.isArray(entry.result?.messages)
      ? entry.result.messages
      : null
  }
  return entry.tool === 'memory_timeline' ? [] : null
}

function resultEvidenceIds(entry) {
  return resultEvidenceRows(entry)?.map(({ evidenceId }) => evidenceId) ??
    null
}

function validToolTranscript(value) {
  if (!Array.isArray(value) ||
    value.length > EXPLORATION_LONGMEMEVAL_SCOPE
      .maximumExplorationToolCalls) {
    return false
  }
  return value.every((entry) => {
    if (!isObject(entry) ||
      !TOOL_NAMES.has(entry.tool) ||
      !isObject(entry.input) ||
      !isObject(entry.result) ||
      entry.result.operation !== entry.tool ||
      !Number.isSafeInteger(entry.modelDispatch) ||
      entry.modelDispatch < 1) {
      return false
    }
    const evidenceRows = resultEvidenceRows(entry)
    return evidenceRows !== null &&
      evidenceRows.every((row) =>
        isObject(row) &&
        typeof row.evidenceId === 'string' &&
        Boolean(row.evidenceId) &&
        typeof row.session === 'string' &&
        Boolean(row.session))
  })
}

function validModelTurn(value, index) {
  const parts = value?.candidateContent?.parts
  if (!isObject(value) ||
    value.dispatch !== index + 1 ||
    value.operationId !==
      `question:${EXPLORATION_LONGMEMEVAL_QUESTION_ID}:explore:${index + 1}` ||
    value.modelVersion !==
      EXPLORATION_LONGMEMEVAL_MODELS.exploration ||
    !/^[a-f0-9]{64}$/.test(value.requestSha256 ?? '') ||
    !['final_text', 'function_calls'].includes(value.responseType) ||
    !Array.isArray(value.functionCalls) ||
    value.candidateContent?.role !== 'model' ||
    !Array.isArray(parts) ||
    parts.length < 1) {
    return false
  }
  const candidateFunctionCalls = parts
    .filter((part) => Object.hasOwn(part ?? {}, 'functionCall'))
    .map(({ functionCall }) => functionCall)
  if (value.responseType === 'function_calls') {
    return value.functionCalls.length >= 1 &&
      value.functionCalls.every((functionCall) =>
        isObject(functionCall) &&
        TOOL_NAMES.has(functionCall.name) &&
        isObject(functionCall.args)) &&
      sameJson(candidateFunctionCalls, value.functionCalls) &&
      value.text === null
  }
  const candidateText = parts
    .filter((part) => part?.thought !== true)
    .map((part) => part?.text ?? '')
    .join('')
    .trim()
  return value.functionCalls.length === 0 &&
    typeof value.text === 'string' &&
    Boolean(value.text.trim()) &&
    candidateText === value.text
}

function modelTranscriptEvidence({
  finalAnswer,
  partial,
  result,
  toolTranscript,
}) {
  const turns = finalAnswer
    ? result.modelTurns
    : partial?.modelTurns
  if (!Array.isArray(turns) ||
    !turns.every(validModelTurn) ||
    turns.length < 1 ||
    turns.length >
      EXPLORATION_LONGMEMEVAL_SCOPE
        .maximumExplorationModelDispatches) {
    return { coherent: false, turns: [] }
  }
  const calls = turns.flatMap((turn) =>
    turn.functionCalls.map((functionCall) => ({
      functionCall,
      modelDispatch: turn.dispatch,
    })))
  const executedCallsMatch = toolTranscript.every((entry, index) =>
    calls[index]?.modelDispatch === entry.modelDispatch &&
    calls[index]?.functionCall?.name === entry.tool &&
    sameJson(calls[index]?.functionCall?.args, entry.input))
  const successfulFinal = !finalAnswer ||
    (turns.at(-1)?.responseType === 'final_text' &&
      turns.at(-1)?.text === result.answer &&
      calls.length === toolTranscript.length)
  const partialPrefix = finalAnswer ||
    calls.length === toolTranscript.length ||
    calls.length > toolTranscript.length
  return {
    coherent:
      executedCallsMatch && successfulFinal && partialPrefix,
    turns,
  }
}

function checkpointEvidence(aggregate) {
  const checkpoints = aggregate?.checkpoints
  const manifest = aggregate?.receiptManifest
  const coherent = isObject(aggregate) &&
    aggregate.runId === EXPLORATION_LONGMEMEVAL_RUN_ID &&
    aggregate.questionId === EXPLORATION_LONGMEMEVAL_QUESTION_ID &&
    aggregate.completedInteraction ===
      EXPLORATION_LONGMEMEVAL_POPULATION.interactions &&
    Array.isArray(checkpoints) &&
    checkpoints.length === aggregate.completedInteraction &&
    Array.isArray(manifest) &&
    manifest.length === aggregate.completedInteraction &&
    checkpoints.every((checkpoint, index) =>
      isObject(checkpoint) &&
      checkpoint.status === 'completed' &&
      checkpoint.completedInteraction === index + 1 &&
      checkpoint.unitOrder === index + 1 &&
      checkpoint.interactionCount ===
        aggregate.completedInteraction) &&
    manifest.every((entry, index) =>
      entry?.ordinal === index + 1 &&
      entry?.filename ===
        `interaction-${String(index + 1).padStart(6, '0')}.receipt.json` &&
      /^[a-f0-9]{64}$/.test(entry?.checkpointSha256 ?? '') &&
      /^[a-f0-9]{64}$/.test(entry?.receiptSha256 ?? '')) &&
    aggregate.lastReceiptSha256 ===
      manifest.at(-1)?.receiptSha256
  return {
    coherent,
    final: coherent ? checkpoints.at(-1) : null,
  }
}

function geminiEvidence(snapshot, {
  finalAnswer,
  modelTurns,
  toolCalls,
}) {
  const writers = Number(snapshot?.logicalRequests?.writer ?? 0)
  const explores = Number(snapshot?.logicalRequests?.explore ?? 0)
  const expectedAttempts = writers + explores
  const completedPrefix = snapshot?.terminal === null
    ? snapshot.attempts === expectedAttempts &&
      snapshot.sequence === expectedAttempts * 2
    : snapshot?.attempts >= expectedAttempts &&
      snapshot?.sequence >= expectedAttempts * 2
  return {
    coherent:
      isObject(snapshot) &&
      Number.isSafeInteger(writers) &&
      writers >= 1 &&
      writers <=
        EXPLORATION_LONGMEMEVAL_SCOPE.maximumReducerDispatches &&
      Number.isSafeInteger(explores) &&
      explores >= 1 &&
      explores <=
        EXPLORATION_LONGMEMEVAL_SCOPE
          .maximumExplorationModelDispatches &&
      explores >= modelTurns &&
      explores <= modelTurns + 1 &&
      (!finalAnswer || explores === modelTurns) &&
      completedPrefix &&
      finiteNonNegative(snapshot.accounted?.usd) &&
      finiteNonNegative(snapshot.measured?.usd) &&
      finiteNonNegative(snapshot.uncertain?.usd) &&
      Number((
        snapshot.accounted.usd -
        EXPLORATION_LONGMEMEVAL_OPENING_SPEND.accountedUsd
      ).toFixed(12)) >= -USD_TOLERANCE &&
      Number((
        snapshot.accounted.usd -
        EXPLORATION_LONGMEMEVAL_OPENING_SPEND.accountedUsd
      ).toFixed(12)) <=
        EXPLORATION_LONGMEMEVAL_HARD_CAP.freshSubcapUsd +
          USD_TOLERANCE,
    explores,
    writers,
  }
}

function reducerEvidence({
  checkpointAggregate,
  finalAnswer,
  gemini,
  result,
}) {
  const events = finalAnswer
    ? result.reducerEvidence
    : checkpointAggregate?.checkpoints?.flatMap(
      ({ reducerEvents }) =>
        Array.isArray(reducerEvents) ? reducerEvents : [],
    )
  const coherent = Array.isArray(events) &&
    events.length === gemini.writers &&
    events.every((entry, index) =>
      entry?.dispatch === index + 1 &&
      entry?.operationId ===
        `question:${EXPLORATION_LONGMEMEVAL_QUESTION_ID}:reducer:${index + 1}` &&
      entry?.status === 'validated' &&
      entry?.modelVersion ===
        EXPLORATION_LONGMEMEVAL_MODELS.reducer &&
      /^[a-f0-9]{64}$/.test(entry?.requestSha256 ?? '') &&
      /^[a-f0-9]{64}$/.test(entry?.responseSha256 ?? '') &&
      Array.isArray(entry?.evidenceIds) &&
      entry.evidenceIds.length >= 1 &&
      entry.evidenceIds.length <= 40)
  return {
    coherent,
    events: coherent ? events : [],
  }
}

function answerSessionSet(runState) {
  const values = runState?.oracle?.answerSessionIds
  if (!Array.isArray(values) ||
    values.length < 1 ||
    values.some((value) =>
      typeof value !== 'string' || !value) ||
    new Set(values).size !== values.length) {
    return null
  }
  return new Set(values)
}

function hasAnswerSessionRow(entry, answerSessions) {
  const rows = resultEvidenceRows(entry)
  return Array.isArray(rows) &&
    rows.some(({ session }) => answerSessions.has(session))
}

function recoveredAfterFirstMiss(transcript, answerSessions) {
  const firstFindIndex = transcript.findIndex(
    ({ tool }) => tool === 'memory_find',
  )
  if (!answerSessions ||
    firstFindIndex < 0 ||
    transcript[firstFindIndex].result.matches.length !== 0) {
    return false
  }
  const firstPhrase = String(
    transcript[firstFindIndex].input.phrase ?? '',
  )
  const firstDispatch =
    transcript[firstFindIndex].modelDispatch
  const later = transcript.slice(firstFindIndex + 1)
  const rewordedHit = later.some((entry) =>
    entry.modelDispatch > firstDispatch &&
    entry.tool === 'memory_find' &&
    String(entry.input.phrase ?? '') !== firstPhrase &&
    hasAnswerSessionRow(entry, answerSessions))
  const timelineIndex = later.findIndex(
    ({ modelDispatch, result, tool }) =>
      modelDispatch > firstDispatch &&
      tool === 'memory_timeline' &&
      Array.isArray(result?.sessions) &&
      result.sessions.some(({ session }) =>
        answerSessions.has(session)),
  )
  const navigatedHit = timelineIndex >= 0 &&
    later.slice(timelineIndex + 1).some((entry) =>
      entry.modelDispatch >
        later[timelineIndex].modelDispatch &&
      entry.tool === 'memory_read' &&
      hasAnswerSessionRow(entry, answerSessions))
  return rewordedHit || navigatedHit
}

function consultedEvidenceIsExact(
  result,
  transcript,
  answerSessions,
) {
  if (!Array.isArray(result?.consultedEvidenceIds) ||
    result.consultedEvidenceIds.length < 1 ||
    !answerSessions ||
    result.consultedEvidenceIds.some((id) =>
      typeof id !== 'string' || !id)) {
    return false
  }
  const returned = transcript.flatMap(
    (entry) => resultEvidenceIds(entry),
  )
  const exactConsultedSet = sameJson(
    sortedUnique(result.consultedEvidenceIds),
    sortedUnique(returned),
  )
  const answerEvidenceIds = transcript.flatMap((entry) =>
    (resultEvidenceRows(entry) ?? [])
      .filter(({ session }) => answerSessions.has(session))
      .map(({ evidenceId }) => evidenceId))
  return exactConsultedSet &&
    answerEvidenceIds.some((evidenceId) =>
      result.consultedEvidenceIds.includes(evidenceId))
}

function runStateIsOneQuestion(runState) {
  const invocation = runState?.invocations?.[0]
  return isObject(runState) &&
    runState.identity?.questionId ===
      EXPLORATION_LONGMEMEVAL_QUESTION_ID &&
    runState.question?.questionId ===
      EXPLORATION_LONGMEMEVAL_QUESTION_ID &&
    Array.isArray(runState.invocations) &&
    runState.invocations.length === 1 &&
    sameJson(
      invocation?.questionIds,
      [EXPLORATION_LONGMEMEVAL_QUESTION_ID],
    ) &&
    invocation?.question2Started === false
}

export function auditExplorationLongMemEvalPredictionEvidence({
  checkpointAggregate,
  explorationCheckpoint,
  geminiSnapshot,
  judgeSnapshot,
  result,
  runState,
} = {}) {
  if (!isObject(runState) ||
    (result !== null && result !== undefined && !isObject(result)) ||
    (explorationCheckpoint !== null &&
      explorationCheckpoint !== undefined &&
      !isObject(explorationCheckpoint))) {
    reject(
      'EVIDENCE_INVALID',
      'Exploration grading requires raw run-state and optional result/checkpoint objects.',
    )
  }
  const finalAnswer = isObject(result)
  const partial = isObject(explorationCheckpoint)
    ? explorationCheckpoint
    : null
  const transcript = finalAnswer
    ? result.toolTranscript
    : partial?.toolTranscript
  const transcriptCoherent = validToolTranscript(transcript)
  const toolCalls = transcriptCoherent ? transcript.length : Number.NaN
  const modelTranscript = transcriptCoherent
    ? modelTranscriptEvidence({
        finalAnswer,
        partial,
        result,
        toolTranscript: transcript,
      })
    : { coherent: false, turns: [] }
  const modelTurns = modelTranscript.turns.length
  const checkpoint = checkpointEvidence(checkpointAggregate)
  const gemini = geminiEvidence(geminiSnapshot, {
    finalAnswer,
    modelTurns,
    toolCalls,
  })
  const findCalls = transcriptCoherent
    ? transcript.filter(({ tool }) => tool === 'memory_find')
    : []
  const finalDigest = checkpoint.final?.digest
  const answerSessions = answerSessionSet(runState)
  const reducers = reducerEvidence({
    checkpointAggregate,
    finalAnswer,
    gemini,
    result,
  })
  const ingestionCompletes =
    checkpoint.coherent &&
    gemini.coherent &&
    reducers.coherent &&
    gemini.writers >= 1 &&
    gemini.writers <=
      EXPLORATION_LONGMEMEVAL_SCOPE.maximumReducerDispatches &&
    finalDigest?.ready === true &&
    finalDigest?.pending === 0 &&
    Array.isArray(checkpoint.final?.quarantinedUnits) &&
    checkpoint.final.quarantinedUnits.length === 0 &&
    (!finalAnswer ||
      (result.questionId === EXPLORATION_LONGMEMEVAL_QUESTION_ID &&
        result.exchangePlanSha256 ===
          EXPLORATION_LONGMEMEVAL_POPULATION.exchangePlanSha256 &&
        result.interactions ===
          checkpointAggregate.completedInteraction &&
        result.logicalOperations?.reducer === gemini.writers &&
        Array.isArray(result.quarantinedUnits) &&
        result.quarantinedUnits.length === 0 &&
        result.quarantineStats?.count === 0 &&
        result.quarantineStats?.predictionMiss === false &&
        result.digestStatus?.ready === true &&
        result.digestStatus?.pending === 0))
  const firstChoiceMisses =
    transcriptCoherent &&
    modelTranscript.coherent &&
    findCalls.length > 0 &&
    findCalls[0].result.matches.length === 0
  const grounded =
    finalAnswer &&
    transcriptCoherent &&
    modelTranscript.coherent &&
    typeof result.answer === 'string' &&
    Boolean(result.answer.trim()) &&
    result.answerProviderCalled === true &&
    consultedEvidenceIsExact(
      result,
      transcript,
      answerSessions,
    )
  const oneQuestion = runStateIsOneQuestion(runState)
  const observedExplorationCalls = finalAnswer
    ? result.explorationCalls
    : partial?.explorationCalls
  const observedExhausted = finalAnswer
    ? result.explorationExhausted
    : partial?.explorationExhausted
  const judgeCompleted = judgeSnapshot?.attempts === 1 &&
    judgeSnapshot?.state === 'terminal' &&
    finiteNonNegative(judgeSnapshot?.accountedUsd)
  const observations = Object.freeze({
    EXPLORATION_WITHIN_BUDGET:
      oneQuestion &&
      transcriptCoherent &&
      modelTranscript.coherent &&
      gemini.coherent &&
      observedExplorationCalls === toolCalls &&
      toolCalls <=
        EXPLORATION_LONGMEMEVAL_SCOPE.maximumExplorationToolCalls &&
      observedExhausted === false,
    FIRST_CHOICE_FIND_MISSES: firstChoiceMisses,
    GROUNDED_FINAL_ANSWER: grounded,
    INGESTION_COMPLETES: ingestionCompletes,
    MEMORY_FIND_USED:
      transcriptCoherent &&
      modelTranscript.coherent &&
      findCalls.length >= 1,
    RECOVERS_AFTER_MISS:
      transcriptCoherent &&
      modelTranscript.coherent &&
      recoveredAfterFirstMiss(transcript, answerSessions),
  })
  return Object.freeze({
    computed: Object.freeze({
      consultedEvidenceIds:
        Array.isArray(result?.consultedEvidenceIds)
          ? [...result.consultedEvidenceIds]
          : [],
      explorationModelDispatches: gemini.explores,
      explorationToolCalls:
        Number.isFinite(toolCalls) ? toolCalls : null,
      reducerDispatches: gemini.writers,
      judgeCompleted,
      freshGeminiAccountedUsd:
        finiteNonNegative(geminiSnapshot?.accounted?.usd)
          ? Number((
              geminiSnapshot.accounted.usd -
              EXPLORATION_LONGMEMEVAL_OPENING_SPEND.accountedUsd
            ).toFixed(12))
          : null,
      toolSequence: transcriptCoherent
        ? transcript.map(({ input, result: toolResult, tool }) => ({
            input,
            result: toolResult,
            tool,
          }))
        : [],
      modelTurns: modelTranscript.coherent
        ? modelTranscript.turns
        : [],
    }),
    observations,
  })
}

export function gradeExplorationLongMemEvalPredictionsFromEvidence({
  evidence,
  predictions =
    EXPLORATION_LONGMEMEVAL_EXPECTED_PREDICTIONS,
} = {}) {
  if (!Array.isArray(predictions) ||
    predictions.length !== PREDICTION_IDS.size ||
    new Set(predictions.map(({ id }) => id)).size !==
      PREDICTION_IDS.size ||
    predictions.some((prediction) =>
      !PREDICTION_IDS.has(prediction?.id) ||
      typeof prediction.predicted !== 'boolean' ||
      typeof prediction.statement !== 'string' ||
      !prediction.statement)) {
    reject(
      'PREDICTIONS_INVALID',
      'Predictions must contain every supported ID exactly once.',
    )
  }
  const { computed, observations } =
    auditExplorationLongMemEvalPredictionEvidence(evidence)
  const grades = predictions
    .map((prediction) => {
      const observed = observations[prediction.id]
      return Object.freeze({
        id: prediction.id,
        observed,
        outcome: typeof observed !== 'boolean'
          ? 'not_observed'
          : observed === prediction.predicted
            ? 'hit'
            : 'miss',
        predicted: prediction.predicted,
        statement: prediction.statement,
      })
    })
    .sort((left, right) =>
      OUTCOME_RANK[left.outcome] - OUTCOME_RANK[right.outcome])
  return Object.freeze({
    computed,
    grades: Object.freeze(grades),
    observations,
  })
}

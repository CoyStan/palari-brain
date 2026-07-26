import assert from 'node:assert/strict'
import test from 'node:test'

import {
  EXPLORATION_LONGMEMEVAL_EXPECTED_PREDICTIONS,
  EXPLORATION_LONGMEMEVAL_MODELS,
  EXPLORATION_LONGMEMEVAL_OPENING_SPEND,
  EXPLORATION_LONGMEMEVAL_POPULATION,
  EXPLORATION_LONGMEMEVAL_QUESTION_ID,
  EXPLORATION_LONGMEMEVAL_RUN_ID,
} from '../evals/exploration-longmemeval-live-config.mjs'
import {
  ExplorationLongMemEvalPredictionOracleError,
  auditExplorationLongMemEvalPredictionEvidence,
  gradeExplorationLongMemEvalPredictionsFromEvidence,
} from '../evals/exploration-longmemeval-prediction-oracle.mjs'

const HASH = 'a'.repeat(64)

function functionTurn(dispatch, name, args) {
  const functionCall = { args, name }
  return {
    candidateContent: {
      parts: [{ functionCall }],
      role: 'model',
    },
    dispatch,
    functionCalls: [functionCall],
    modelVersion: EXPLORATION_LONGMEMEVAL_MODELS.exploration,
    operationId:
      `question:${EXPLORATION_LONGMEMEVAL_QUESTION_ID}:explore:${dispatch}`,
    requestSha256: HASH,
    responseType: 'function_calls',
    text: null,
  }
}

function finalTurn(dispatch, text) {
  return {
    candidateContent: {
      parts: [{ text }],
      role: 'model',
    },
    dispatch,
    functionCalls: [],
    modelVersion: EXPLORATION_LONGMEMEVAL_MODELS.exploration,
    operationId:
      `question:${EXPLORATION_LONGMEMEVAL_QUESTION_ID}:explore:${dispatch}`,
    requestSha256: HASH,
    responseType: 'final_text',
    text,
  }
}

function checkpointAggregate() {
  const checkpoints = Array.from({ length: 243 }, (_, index) => ({
    completedInteraction: index + 1,
    digest: {
      pending: index === 242 ? 0 : 1,
      ready: index === 242,
    },
    interactionCount: 243,
    quarantinedUnits: [],
    status: 'completed',
    unitOrder: index + 1,
  }))
  const receiptManifest = checkpoints.map((_, index) => ({
    checkpointSha256: HASH,
    filename:
      `interaction-${String(index + 1).padStart(6, '0')}.receipt.json`,
    ordinal: index + 1,
    receiptSha256: HASH,
  }))
  return {
    checkpoints,
    completedInteraction: 243,
    lastReceiptSha256: HASH,
    questionId: EXPLORATION_LONGMEMEVAL_QUESTION_ID,
    receiptManifest,
    runId: EXPLORATION_LONGMEMEVAL_RUN_ID,
    schemaVersion: 'palari-incremental-checkpoint-aggregate/v1',
  }
}

function evidence() {
  return {
    checkpointAggregate: checkpointAggregate(),
    geminiSnapshot: {
      accounted: {
        usd:
          EXPLORATION_LONGMEMEVAL_OPENING_SPEND.accountedUsd +
          0.01,
      },
      attempts: 30,
      logicalRequests: {
        explore: 3,
        writer: 27,
      },
      measured: { usd: 0.01 },
      sequence: 60,
      terminal: null,
      uncertain: { usd: 0 },
    },
    result: {
      answer: 'You recorded that the answer was violet.',
      answerProviderCalled: true,
      consultedEvidenceIds: ['evidence-1'],
      digestStatus: { pending: 0, ready: true },
      exchangePlanSha256:
        EXPLORATION_LONGMEMEVAL_POPULATION.exchangePlanSha256,
      explorationCalls: 2,
      explorationExhausted: false,
      interactions: 243,
      logicalOperations: {
        answerModel: 3,
        provider: 30,
        reducer: 27,
        tools: 2,
      },
      quarantineStats: {
        categories: [],
        count: 0,
        predictionMiss: false,
      },
      quarantinedUnits: [],
      questionId: EXPLORATION_LONGMEMEVAL_QUESTION_ID,
      reducerEvidence: Array.from({ length: 27 }, (_, index) => ({
        dispatch: index + 1,
        errorCategory: null,
        evidenceIds: [`evidence-${index + 1}`],
        modelVersion: EXPLORATION_LONGMEMEVAL_MODELS.reducer,
        operationId:
          `question:${EXPLORATION_LONGMEMEVAL_QUESTION_ID}:reducer:${index + 1}`,
        requestSha256: HASH,
        responseSha256: HASH,
        status: 'validated',
      })),
      modelTurns: [
        functionTurn(1, 'memory_find', {
          phrase: 'wrong wording',
        }),
        functionTurn(2, 'memory_find', { phrase: 'violet' }),
        finalTurn(
          3,
          'You recorded that the answer was violet.',
        ),
      ],
      toolTranscript: [
        {
          input: { phrase: 'wrong wording' },
          result: {
            chars: 0,
            matches: [],
            operation: 'memory_find',
            phrase: 'wrong wording',
            truncated: false,
          },
          modelDispatch: 1,
          tool: 'memory_find',
        },
        {
          input: { phrase: 'violet' },
          result: {
            chars: 100,
            matches: [{
              evidenceId: 'evidence-1',
              session: 'answer-session',
              snippet: 'The answer was violet.',
            }],
            operation: 'memory_find',
            phrase: 'violet',
            truncated: false,
          },
          modelDispatch: 2,
          tool: 'memory_find',
        },
      ],
    },
    runState: {
      identity: {
        questionId: EXPLORATION_LONGMEMEVAL_QUESTION_ID,
        runId: EXPLORATION_LONGMEMEVAL_RUN_ID,
      },
      invocations: [{
        question2Started: false,
        questionIds: [EXPLORATION_LONGMEMEVAL_QUESTION_ID],
      }],
      oracle: {
        answerSessionIds: ['answer-session'],
      },
      question: {
        questionId: EXPLORATION_LONGMEMEVAL_QUESTION_ID,
      },
      status: 'complete',
    },
  }
}

test('six predictions are derived from raw evidence and all hit',
  () => {
    const grade =
      gradeExplorationLongMemEvalPredictionsFromEvidence({
        evidence: evidence(),
      })
    assert.equal(grade.grades.length, 6)
    assert.equal(
      grade.grades.every(({ outcome }) => outcome === 'hit'),
      true,
    )
    assert.deepEqual(
      grade.computed.toolSequence.map(({ input, tool }) => ({
        input,
        tool,
      })),
      [
        {
          input: { phrase: 'wrong wording' },
          tool: 'memory_find',
        },
        {
          input: { phrase: 'violet' },
          tool: 'memory_find',
        },
      ],
    )
    assert.equal(grade.computed.explorationModelDispatches, 3)
    assert.equal(grade.computed.reducerDispatches, 27)
  })

test('a first exact-search hit and no recovery are misses, sorted first',
  () => {
    const raw = evidence()
    raw.result.toolTranscript[0].result.matches = [{
      evidenceId: 'evidence-1',
      session: 'answer-session',
    }]
    raw.result.toolTranscript.splice(1)
    raw.result.modelTurns = [
      functionTurn(1, 'memory_find', {
        phrase: 'wrong wording',
      }),
      finalTurn(
        2,
        'You recorded that the answer was violet.',
      ),
    ]
    raw.result.explorationCalls = 1
    raw.result.logicalOperations.answerModel = 2
    raw.geminiSnapshot.logicalRequests.explore = 2
    raw.geminiSnapshot.attempts = 29
    raw.geminiSnapshot.sequence = 58
    const grade =
      gradeExplorationLongMemEvalPredictionsFromEvidence({
        evidence: raw,
      })
    assert.deepEqual(
      grade.grades.slice(0, 2).map(({ id, outcome }) => ({
        id,
        outcome,
      })),
      [
        {
          id: 'FIRST_CHOICE_FIND_MISSES',
          outcome: 'miss',
        },
        {
          id: 'RECOVERS_AFTER_MISS',
          outcome: 'miss',
        },
      ],
    )
  })

test('grounding requires consulted IDs to equal tool-returned evidence',
  () => {
    const raw = evidence()
    raw.result.consultedEvidenceIds.push('caller-invented-id')
    const audit =
      auditExplorationLongMemEvalPredictionEvidence(raw)
    assert.equal(audit.observations.GROUNDED_FINAL_ANSWER, false)
    assert.equal(audit.observations.RECOVERS_AFTER_MISS, true)
  })

test('an irrelevant hit is neither answer recovery nor grounding', () => {
  const raw = evidence()
  raw.result.toolTranscript[1].result.matches[0].session =
    'irrelevant-session'
  const audit =
    auditExplorationLongMemEvalPredictionEvidence(raw)
  assert.equal(audit.observations.RECOVERS_AFTER_MISS, false)
  assert.equal(audit.observations.GROUNDED_FINAL_ANSWER, false)
})

test('recovery can navigate timeline then read a non-empty session',
  () => {
    const raw = evidence()
    raw.result.toolTranscript = [
      raw.result.toolTranscript[0],
      {
        input: {},
        result: {
          operation: 'memory_timeline',
          sessions: [{ session: 'answer-session' }],
          totalMessages: 2,
          totalSessions: 1,
        },
        modelDispatch: 2,
        tool: 'memory_timeline',
      },
      {
        input: { session: 'answer-session' },
        result: {
          chars: 50,
          messages: [{
            evidenceId: 'evidence-1',
            session: 'answer-session',
            text: 'The answer was violet.',
          }],
          operation: 'memory_read',
          truncated: false,
        },
        modelDispatch: 3,
        tool: 'memory_read',
      },
    ]
    raw.result.modelTurns = [
      functionTurn(1, 'memory_find', {
        phrase: 'wrong wording',
      }),
      functionTurn(2, 'memory_timeline', {}),
      functionTurn(3, 'memory_read', {
        session: 'answer-session',
      }),
      finalTurn(
        4,
        'You recorded that the answer was violet.',
      ),
    ]
    raw.result.explorationCalls = 3
    raw.result.logicalOperations.answerModel = 4
    raw.geminiSnapshot.logicalRequests.explore = 4
    raw.geminiSnapshot.attempts = 31
    raw.geminiSnapshot.sequence = 62
    const audit =
      auditExplorationLongMemEvalPredictionEvidence(raw)
    assert.equal(audit.observations.RECOVERS_AFTER_MISS, true)
    assert.equal(audit.observations.GROUNDED_FINAL_ANSWER, true)
  })

test('prediction input cannot omit or rename a frozen row', () => {
  assert.throws(
    () => gradeExplorationLongMemEvalPredictionsFromEvidence({
      evidence: evidence(),
      predictions:
        EXPLORATION_LONGMEMEVAL_EXPECTED_PREDICTIONS.slice(1),
    }),
    (error) =>
      error instanceof
        ExplorationLongMemEvalPredictionOracleError &&
      error.code === 'PREDICTIONS_INVALID',
  )
})

test('tool evidence cannot be detached from the model function call',
  () => {
    const raw = evidence()
    raw.result.modelTurns[0].functionCalls[0].args.phrase =
      'different model phrase'
    raw.result.modelTurns[0]
      .candidateContent.parts[0].functionCall.args.phrase =
        'different model phrase'
    const audit =
      auditExplorationLongMemEvalPredictionEvidence(raw)
    assert.equal(audit.observations.MEMORY_FIND_USED, false)
    assert.equal(
      audit.observations.FIRST_CHOICE_FIND_MISSES,
      false,
    )
    assert.equal(audit.computed.modelTurns.length, 0)
  })

test('a durable partial trace grades search behavior before an answer',
  () => {
    const raw = evidence()
    raw.explorationCheckpoint = {
      answerModelDispatches: 2,
      explorationCalls: 2,
      explorationExhausted: false,
      modelTurns: raw.result.modelTurns.slice(0, 2),
      phase: 'tool_result',
      questionId: EXPLORATION_LONGMEMEVAL_QUESTION_ID,
      toolTranscript: raw.result.toolTranscript,
    }
    raw.result = null
    raw.geminiSnapshot.logicalRequests.explore = 2
    raw.geminiSnapshot.attempts = 29
    raw.geminiSnapshot.sequence = 58
    const grade =
      gradeExplorationLongMemEvalPredictionsFromEvidence({
        evidence: raw,
      })
    const byId = new Map(
      grade.grades.map((entry) => [entry.id, entry]),
    )
    assert.equal(byId.get('MEMORY_FIND_USED').outcome, 'hit')
    assert.equal(
      byId.get('FIRST_CHOICE_FIND_MISSES').outcome,
      'hit',
    )
    assert.equal(byId.get('RECOVERS_AFTER_MISS').outcome, 'hit')
    // Recovery is observable from the tool prefix even though grounding is
    // not: a final answer never completed.
    assert.equal(
      byId.get('EXPLORATION_WITHIN_BUDGET').outcome,
      'hit',
    )
    assert.equal(
      byId.get('GROUNDED_FINAL_ANSWER').outcome,
      'miss',
    )
  })

test('a simultaneous parallel hit is not recovery from a miss', () => {
  const raw = evidence()
  const missCall = {
    args: { phrase: 'wrong wording' },
    name: 'memory_find',
  }
  const hitCall = {
    args: { phrase: 'violet' },
    name: 'memory_find',
  }
  raw.result.modelTurns = [{
    candidateContent: {
      parts: [
        { functionCall: missCall },
        { functionCall: hitCall },
      ],
      role: 'model',
    },
    dispatch: 1,
    functionCalls: [missCall, hitCall],
    modelVersion: EXPLORATION_LONGMEMEVAL_MODELS.exploration,
    operationId:
      `question:${EXPLORATION_LONGMEMEVAL_QUESTION_ID}:explore:1`,
    requestSha256: HASH,
    responseType: 'function_calls',
    text: null,
  }, finalTurn(
    2,
    'You recorded that the answer was violet.',
  )]
  raw.result.toolTranscript[1].modelDispatch = 1
  raw.result.logicalOperations.answerModel = 2
  raw.geminiSnapshot.logicalRequests.explore = 2
  raw.geminiSnapshot.attempts = 29
  raw.geminiSnapshot.sequence = 58
  const audit =
    auditExplorationLongMemEvalPredictionEvidence(raw)
  assert.equal(
    audit.observations.FIRST_CHOICE_FIND_MISSES,
    true,
  )
  assert.equal(audit.observations.MEMORY_FIND_USED, true)
  assert.equal(audit.observations.GROUNDED_FINAL_ANSWER, true)
  assert.equal(
    audit.observations.EXPLORATION_WITHIN_BUDGET,
    true,
  )
  assert.equal(audit.observations.RECOVERS_AFTER_MISS, false)
})

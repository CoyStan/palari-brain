import assert from 'node:assert/strict'
import test from 'node:test'

import {
  JournalNavigationPredictionOracleError,
  JOURNAL_NAVIGATION_PREDICTION_IDS,
  auditJournalNavigationPredictionEvidence,
  gradeJournalNavigationPredictionsFromEvidence,
} from '../evals/journal-navigation-prediction-oracle.mjs'

const OPAQUE_TOKEN = 'SMOKE-ORBIT-7731'
const SMOKE_EVIDENCE_ID = 'smoke-evidence-1'

function predictions() {
  return JOURNAL_NAVIGATION_PREDICTION_IDS.map((id) => ({
    id,
    predicted: true,
    statement: `FINAL prediction for ${id}.`,
  }))
}

function snapshot({
  attempts,
  explore,
  measuredUsd,
  writer,
}) {
  return {
    attempts,
    logicalRequests: { explore, writer },
    measured: { usd: measuredUsd },
  }
}

function smokeEvidence() {
  return {
    calls: [
      {
        physicalCall: 1,
        provider: 'gemini',
        purpose: 'writer',
        status: 'success',
      },
      {
        physicalCall: 2,
        provider: 'gemini',
        purpose: 'explore',
        status: 'success',
      },
      {
        physicalCall: 3,
        provider: 'gemini',
        purpose: 'explore',
        status: 'success',
      },
    ],
    exploration: {
      answer: `The recorded value is ${OPAQUE_TOKEN}.`,
      consultedEvidenceIds: [SMOKE_EVIDENCE_ID],
      expectedEvidenceId: SMOKE_EVIDENCE_ID,
      modelDispatches: 2,
      opaqueToken: OPAQUE_TOKEN,
      toolCalls: [{
        input: { phrase: 'compatibility token' },
        outcome: 'success',
        result: {
          matches: [{
            evidenceId: SMOKE_EVIDENCE_ID,
            text: `The value is ${OPAQUE_TOKEN}.`,
          }],
          operation: 'memory_find',
        },
        tool: 'memory_find',
      }],
    },
    phaseEvents: [
      {
        datasetLoaded: false,
        status: 'started',
        type: 'smoke_started',
      },
      {
        datasetLoaded: false,
        status: 'passed',
        type: 'smoke_receipt',
      },
      {
        datasetLoaded: true,
        status: 'complete',
        type: 'dataset_loaded',
      },
    ],
    reducer: {
      digest: {
        blocked: 0,
        pending: 0,
        ready: true,
        status: 'ready',
      },
      digestItems: 1,
    },
  }
}

function navigationEvidence() {
  return {
    answer: 'The user recorded that the value was violet.',
    canonicalRows: 484,
    consultedEvidenceIds: ['main-evidence-1'],
    digest: {
      blocked: 0,
      pending: 0,
      ready: true,
      status: 'ready',
    },
    digestItems: 0,
    exchanges: 243,
    explorationExhausted: false,
    externalReducerCalls: 0,
    providerToolTranscript: [
      {
        input: { phrase: 'wrong wording' },
        outcome: 'success',
        result: {
          matches: [],
          operation: 'memory_find',
        },
        tool: 'memory_find',
      },
      {
        input: { phrase: 'violet' },
        outcome: 'success',
        result: {
          matches: [{
            evidenceId: 'main-evidence-1',
            text: 'The value was violet.',
          }],
          operation: 'memory_find',
        },
        tool: 'memory_find',
      },
    ],
    toolAttemptBudgetExhausted: false,
    toolAttempts: 2,
  }
}

function evidence() {
  return {
    judge: {
      attempts: 1,
      correct: true,
      label: 'yes',
      status: 'complete',
    },
    meter: {
      smokeAfter: snapshot({
        attempts: 3,
        explore: 2,
        measuredUsd: 0.004,
        writer: 1,
      }),
      smokeBefore: snapshot({
        attempts: 0,
        explore: 0,
        measuredUsd: 0,
        writer: 0,
      }),
    },
    navigation: navigationEvidence(),
    smoke: smokeEvidence(),
  }
}

test('all smoke and autonomous-navigation predictions can hit',
  () => {
    const grade =
      gradeJournalNavigationPredictionsFromEvidence({
        evidence: evidence(),
        predictions: predictions(),
      })
    assert.equal(grade.grades.length, 12)
    assert.equal(
      grade.grades.every(({ outcome }) => outcome === 'hit'),
      true,
    )
    assert.deepEqual(
      grade.computed.navigation.findPhrases,
      ['wrong wording', 'violet'],
    )
    assert.deepEqual(
      grade.computed.navigation.toolCalls,
      [
        {
          errorCode: '',
          input: { phrase: 'wrong wording' },
          outcome: 'success',
          returnedEvidenceIds: [],
          tool: 'memory_find',
        },
        {
          errorCode: '',
          input: { phrase: 'violet' },
          outcome: 'success',
          returnedEvidenceIds: ['main-evidence-1'],
          tool: 'memory_find',
        },
      ],
    )
    assert.deepEqual(grade.computed.smoke, {
      calls: 3,
      digestItems: 1,
      expectedEvidenceId: SMOKE_EVIDENCE_ID,
      exploreRequests: 2,
      measuredUsd: 0.004,
      retries: 0,
      writerRequests: 1,
    })
    assert.deepEqual(grade.computed.judge, {
      completed: true,
      correct: true,
      label: 'yes',
    })
  })

test('misses are deterministic and sorted before hits', () => {
  const raw = evidence()
  raw.meter.smokeAfter.measured.usd = 0.01
  raw.navigation.providerToolTranscript = [
    raw.navigation.providerToolTranscript[1],
  ]
  raw.navigation.toolAttempts = 1

  const grade =
    gradeJournalNavigationPredictionsFromEvidence({
      evidence: raw,
      predictions: predictions(),
    })
  assert.deepEqual(
    grade.grades
      .filter(({ outcome }) => outcome === 'miss')
      .map(({ id }) => id),
    [
      'SMOKE_MEASURED_UNDER_ONE_CENT',
      'FIRST_CHOICE_FIND_MISSES',
      'RECOVERS_AFTER_MISS',
    ],
  )
  const firstHit = grade.grades.findIndex(
    ({ outcome }) => outcome === 'hit',
  )
  assert.ok(firstHit >= 0)
  assert.equal(
    grade.grades.slice(0, firstHit)
      .every(({ outcome }) => outcome === 'miss'),
    true,
  )
})

test('the seeded smoke lookup never counts as a main lookup',
  () => {
    const raw = evidence()
    raw.navigation.providerToolTranscript = []
    raw.navigation.toolAttempts = 0
    raw.navigation.consultedEvidenceIds = []
    const audit =
      auditJournalNavigationPredictionEvidence(raw)

    assert.equal(
      audit.observations.SMOKE_NAVIGATION_ROUND_TRIP,
      true,
    )
    assert.equal(audit.observations.MEMORY_FIND_USED, false)
    assert.equal(
      audit.observations.FIRST_CHOICE_FIND_MISSES,
      false,
    )
    assert.equal(
      audit.observations.RECOVERS_AFTER_MISS,
      false,
    )
    assert.equal(
      audit.observations.GROUNDED_FINAL_ANSWER,
      false,
    )
  })

test('FINAL rows cannot omit or rename a supported prediction',
  () => {
    assert.throws(
      () => gradeJournalNavigationPredictionsFromEvidence({
        evidence: evidence(),
        predictions: predictions().slice(1),
      }),
      (error) =>
        error instanceof JournalNavigationPredictionOracleError &&
        error.code === 'PREDICTIONS_INVALID',
    )
  })

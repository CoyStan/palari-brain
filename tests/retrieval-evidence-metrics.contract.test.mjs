import assert from 'node:assert/strict'
import test from 'node:test'

import {
  measureRetrievalEvidence,
} from '../evals/retrieval-evidence-metrics.mjs'

function trace(selectedEvidenceIds = ['e2']) {
  return {
    answerCommitted: true,
    retrievalTranscript: [{
      result: {
        messages: [
          { evidenceId: 'e1', session: 's1', text: 'First fact.' },
          { evidenceId: 'e2', session: 's2', text: 'Second fact.' },
        ],
      },
      tool: 'memory_read',
    }],
    selectedEvidenceIds,
  }
}

test('five retrieval/use metrics remain distinct and judged labels stay judged', () => {
  const measured = measureRetrievalEvidence({
    equivalentFactJudgments: [
      { factId: 'f1', recalled: true, rationale: 'Same user fact.' },
      { factId: 'f2', recalled: false, rationale: 'Different fact.' },
    ],
    expectedEvidenceIds: ['e1', 'missing-span'],
    expectedSessionIds: ['s2', 'missing-session'],
    materialUseJudgments: [{
      evidenceId: 'e2',
      materiallyUsed: false,
      rationale: 'Selected and cited, but answer would be unchanged without it.',
    }],
    trace: trace(),
  })

  assert.deepEqual(
    Object.keys(measured),
    [
      'sessionRecall',
      'exactSpanRecall',
      'equivalentFactRecall',
      'selectedEvidence',
      'materiallyUsedEvidence',
    ],
  )
  assert.deepEqual(
    [
      measured.sessionRecall.found,
      measured.exactSpanRecall.found,
      measured.equivalentFactRecall.found,
      measured.selectedEvidence.selected,
      measured.materiallyUsedEvidence.used,
    ],
    [1, 1, 1, 1, 0],
  )
  assert.equal(measured.equivalentFactRecall.judged, true)
  assert.equal(measured.materiallyUsedEvidence.judged, true)
  assert.ok(measured.equivalentFactRecall.labels.every((label) =>
    label.labelAuthority === 'judge'))
  assert.ok(measured.materiallyUsedEvidence.labels.every((label) =>
    label.labelAuthority === 'judge'))
  assert.ok(Object.isFrozen(measured))
})

test('changing one judged surface cannot silently regrade another', () => {
  const shared = {
    equivalentFactJudgments: [{ factId: 'f1', recalled: false }],
    expectedEvidenceIds: ['e1'],
    expectedSessionIds: ['s1'],
    trace: trace(),
  }
  const notUsed = measureRetrievalEvidence({
    ...shared,
    materialUseJudgments: [{ evidenceId: 'e2', materiallyUsed: false }],
  })
  const used = measureRetrievalEvidence({
    ...shared,
    materialUseJudgments: [{ evidenceId: 'e2', materiallyUsed: true }],
  })
  assert.deepEqual(notUsed.sessionRecall, used.sessionRecall)
  assert.deepEqual(notUsed.exactSpanRecall, used.exactSpanRecall)
  assert.deepEqual(notUsed.equivalentFactRecall, used.equivalentFactRecall)
  assert.deepEqual(notUsed.selectedEvidence, used.selectedEvidence)
  assert.equal(notUsed.materiallyUsedEvidence.used, 0)
  assert.equal(used.materiallyUsedEvidence.used, 1)
})

test('metrics reject canonicalized judgments and unsupported use claims', () => {
  assert.throws(
    () => measureRetrievalEvidence({
      materialUseJudgments: [{
        canonicalTruth: true,
        evidenceId: 'e2',
        materiallyUsed: true,
      }],
      trace: trace(),
    }),
    (error) => error.code === 'RETRIEVAL_EVIDENCE_METRIC_INVALID',
  )
  assert.throws(
    () => measureRetrievalEvidence({
      materialUseJudgments: [{
        evidenceId: 'e1',
        materiallyUsed: true,
      }],
      trace: trace(),
    }),
    /must first be selected/,
  )
})

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  evaluateLocatorQuality,
} from '../evals/locator-quality-evaluation.mjs'

function vector(seed, dimensions = 64) {
  return Array.from({ length: dimensions }, (_, index) =>
    Math.sin((seed + 1) * (index + 1) * 0.173) +
      Math.cos((seed + 3) * (index + 1) * 0.119))
}

test('quality comparison exact-ranks private locator candidates', () => {
  const records = Array.from({ length: 30 }, (_, index) => ({
    id: `record-${index}`,
    text: `synthetic record ${index}`,
  }))
  const recordVectors = records.map((_, index) => vector(index))
  const queries = [0, 7, 14].map((target, index) => ({
    family: index % 2 ? 'zero-overlap' : 'shared-token',
    id: `query-${index}`,
    targetId: `record-${target}`,
    text: `synthetic query ${index}`,
  }))
  const queryVectors = [recordVectors[0], recordVectors[7], recordVectors[14]]

  const result = evaluateLocatorQuality({
    locatorConfigs: [{ bands: 8, bitsPerBand: 8, label: 'focused' }],
    queries,
    queryVectors,
    records,
    recordVectors,
    tiers: [20, 30],
    topK: 5,
  })

  assert.equal(result.mode, 'diagnostic-not-a-benchmark')
  assert.equal(result.dimensions, 64)
  assert.equal(result.topK, 5)
  assert.deepEqual(result.tiers.map(({ tierSize }) => tierSize), [20, 30])
  for (const tier of result.tiers) {
    assert.equal(tier.exact.quality.all.targetRecall, 1)
    assert.equal(tier.locators[0].quality.all.exactHitRetention, 1)
    assert.equal(tier.locators[0].quality.all.targetRecall, 1)
    assert.ok(tier.locators[0].quality.all.meanCandidates < tier.tierSize)
    assert.ok(tier.locators[0].quality.all.exactTop20CandidateRecall > 0)
    assert.equal(tier.locators[0].stats.entries, tier.tierSize)
  }
})

test('quality comparison fails when a tier lacks labeled ground truth', () => {
  assert.throws(() => evaluateLocatorQuality({
    locatorConfigs: [{ bands: 8, bitsPerBand: 8 }],
    queries: [{ family: 'shared', id: 'q', targetId: 'later' }],
    queryVectors: [vector(2)],
    records: [{ id: 'early' }, { id: 'later' }],
    recordVectors: [vector(1), vector(2)],
    tiers: [1],
  }), /does not contain target later/)
})

test('candidate coverage and compact rerank fidelity are measured separately', () => {
  let ids = []
  const result = evaluateLocatorQuality({
    locatorConfigs: [{ label: 'all candidates' }],
    locatorFactory: () => ({
      locate: () => [...ids],
      replace: (_scope, entries) => {
        ids = entries.map(({ evidenceId }) => evidenceId)
      },
      stats: () => ({ entries: ids.length }),
    }),
    queries: [{ family: 'compact', id: 'q', targetId: 'a' }],
    queryVectors: [[1, 0]],
    records: [{ id: 'a' }, { id: 'b' }],
    recordVectors: [[1, 0], [0, 1]],
    rerankQueryVectors: [[1, 0]],
    rerankRecordVectors: [[0, 1], [1, 0]],
    tiers: [2],
    topK: 1,
  })

  const quality = result.tiers[0].locators[0].quality.all
  assert.equal(result.rerankDimensions, 2)
  assert.equal(quality.exactTop20CandidateRecall, 1)
  assert.equal(quality.exactTop20RerankRecall, 0)
  assert.equal(quality.exactHitRetention, 0)
  assert.equal(result.tiers[0].locators[0].passesReviewThresholds, false)
})

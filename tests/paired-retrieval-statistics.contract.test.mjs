import assert from 'node:assert/strict'
import { test } from 'node:test'
import { partitionQueriesByFact, pairedFactRecall } from '../evals/paired-retrieval-statistics.mjs'
import { evaluateLocatorQuality } from '../evals/locator-quality-evaluation.mjs'

test('development and holdout partition facts, keeping query variants together', () => {
  const queries = Array.from({ length: 10 }, (_, index) => ({ id: `q${index}`, targetId: `f${Math.floor(index / 2)}` }))
  const split = partitionQueriesByFact(queries, { holdoutFraction: 0.4, seed: 'test' })
  assert.equal(split.holdout.length, 4)
  assert.equal(split.development.length, 6)
  const selectedFacts = indices => new Set(indices.map(i => queries[i].targetId))
  const holdout = selectedFacts(split.holdout)
  for (const fact of selectedFacts(split.development)) assert.equal(holdout.has(fact), false)
  assert.deepEqual(partitionQueriesByFact(queries, { holdoutFraction: 0.4, seed: 'test' }), split)
  const reversed = [...queries].reverse()
  const again = partitionQueriesByFact(reversed, { holdoutFraction: 0.4, seed: 'test' })
  assert.deepEqual(new Set(again.holdout.map(i => reversed[i].targetId)), holdout)
})
test('paired bootstrap resamples whole facts and distinguishes recall from retention', () => {
  const observations = [
    { factId: 'a', exactTargetHit: true, targetHit: false },
    { factId: 'a', exactTargetHit: true, targetHit: false },
    { factId: 'b', exactTargetHit: true, targetHit: true },
    { factId: 'b', exactTargetHit: false, targetHit: true },
  ]
  const stats = pairedFactRecall(observations, { resamples: 1000, seed: 7 })
  assert.equal(stats.facts, 2)
  assert.equal(stats.queries, 4)
  assert.equal(stats.exactRecall.estimate, 0.75)
  assert.equal(stats.locatorRecall.estimate, 0.5)
  assert.equal(stats.recallDifference.estimate, -0.25)
  assert.equal(stats.exactHitRetention.estimate, 1 / 3)
  assert.deepEqual(stats.recallDifference.interval95, [-1, 0.5])
  assert.deepEqual(stats, pairedFactRecall(observations, { resamples: 1000, seed: 7 }))
  // Repeating every variant adds no independent facts or narrower intervals.
  const repeated = pairedFactRecall([...observations, ...observations], { resamples: 1000, seed: 7 })
  assert.deepEqual(repeated.recallDifference.interval95, stats.recallDifference.interval95)
})
test('insufficient facts and zero exact hits do not produce misleading intervals', () => {
  const one = pairedFactRecall([{ factId: 'a', exactTargetHit: false, targetHit: true }])
  assert.equal(one.locatorRecall.interval95, null)
  assert.equal(one.exactHitRetention.estimate, null)
  const none = pairedFactRecall([
    { factId: 'a', exactTargetHit: false, targetHit: false },
    { factId: 'b', exactTargetHit: false, targetHit: true },
  ])
  assert.equal(none.exactHitRetention.interval95, null)
  assert.equal(none.exactHitRetention.validResamples, 0)
  assert.throws(() => partitionQueriesByFact([{ id: 'q', targetId: 'one' }]), /two.*facts/i)
  assert.throws(() => pairedFactRecall([{ factId: 'a', exactTargetHit: 1, targetHit: true }]), /boolean/i)
})
test('locator evaluation selects aligned holdout queries and reports paired uncertainty', () => {
  const queries = Array.from({ length: 8 }, (_, i) => ({ id: `q${i}`, family: 'fixture', targetId: `r${Math.floor(i / 2)}` }))
  const records = Array.from({ length: 4 }, (_, i) => ({ id: `r${i}` }))
  const recordVectors = records.map((_, i) => records.map((_, j) => Number(i === j)))
  const result = evaluateLocatorQuality({ records, queries, recordVectors,
    queryVectors: queries.map(q => recordVectors[Number(q.targetId.slice(1))]),
    tiers: [4], topK: 1, locatorConfigs: [{}],
    locatorFactory: () => ({ replace() {}, locate: () => records.map(r => r.id), stats: () => ({}) }),
    queryPartition: { subset: 'holdout', holdoutFraction: 0.5, seed: 'test' },
  })
  assert.equal(result.tiers[0].exact.quality.all.queries, 4)
  assert.equal(result.tiers[0].exact.quality.all.targetRecall, 1)
  assert.equal(result.tiers[0].locators[0].uncertainty.facts, 2)
  assert.equal(result.queryPartition.subset, 'holdout')
})

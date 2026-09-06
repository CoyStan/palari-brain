import assert from 'node:assert/strict'
import { test } from 'node:test'
import { reciprocalRankFuse } from '../src/retrieval-answer.mjs'
const rows = (...ids) => ids.map(evidenceId => ({ evidenceId }))
const familyWeights = { ranked: 1, semantic: 1 }
test('repeated query variants cannot multiply a retrieval family vote', () => {
  const lists = [{ surface: 'semantic', rows: rows('a') }, { surface: 'ranked', rows: rows('b', 'a') }]
  const before = reciprocalRankFuse(lists, { familyWeights })
  const after = reciprocalRankFuse([...lists,
    { surface: 'ranked:variant1', rows: rows('b') },
    { surface: 'ranked:variant2', rows: rows('b') }], { familyWeights })
  assert.deepEqual(after.map(({ evidenceId, rrfScore }) => ({ evidenceId, rrfScore })),
    before.map(({ evidenceId, rrfScore }) => ({ evidenceId, rrfScore })))
  assert.equal(after[0].evidenceId, 'a')
})
test('distinct facets can contribute complementary evidence within one family', () => {
  const fused = reciprocalRankFuse([
    { surface: 'ranked:facet-a', rows: rows('a', 'a') },
    { surface: 'ranked:facet-b', rows: rows('b') },
    { surface: 'semantic', rows: rows('c') },
  ], { familyWeights })
  assert.deepEqual(fused.map(row => row.evidenceId), ['a', 'b', 'c'])
  for (const entry of fused) assert.equal(entry.rrfScore, 1 / 61)
})
test('legacy fusion remains additive and invalid family weights reject', () => {
  const lists = [{ surface: 'ranked:a', rows: rows('x') }, { surface: 'ranked:b', rows: rows('x') }]
  assert.equal(reciprocalRankFuse(lists)[0].rrfScore, 2 / 61)
  assert.throws(() => reciprocalRankFuse(lists, { familyWeights: { ranked: -1 } }), /weight/i)
})

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { boundedTopK } from '../src/top-k.mjs'
const compare = (a, b) => b.score - a.score || a.time - b.time

test('bounded top-k preserves descending relevance and stable chronological ties', () => {
  const rows = [
    { id: 'late', score: 1, time: 3 }, { id: 'first-tie', score: 1, time: 1 },
    { id: 'best', score: 2, time: 5 }, { id: 'second-tie', score: 1, time: 1 },
    { id: 'negative', score: -1, time: 0 },
  ]
  assert.deepEqual(boundedTopK(rows, 3, compare).map(row => row.id), ['best', 'first-tie', 'second-tie'])
  assert.equal(rows[0].id, 'late')
})
test('bounded selection agrees with independent full sorting across adversarial inputs', () => {
  let state = 12345
  const random = () => (state = Math.imul(state, 1664525) + 1013904223 >>> 0)
  for (const n of [0, 1, 2, 21, 200, 1000]) {
    const rows = Array.from({ length: n }, (_, id) => ({ id, score: random() % 13 - 6, time: random() % 7 }))
    for (const input of [rows, [...rows].sort(compare), [...rows].sort(compare).reverse()]) {
      for (const k of [0, 1, 20, 200, n + 1]) {
        assert.deepEqual(boundedTopK(input.values(), k, compare), [...input].sort(compare).slice(0, k))
      }
    }
  }
})
test('invalid top-k bounds reject rather than returning an accidental ranking', () => {
  for (const k of [-1, NaN, 1.5, Infinity]) assert.throws(() => boundedTopK([], k, compare), /limit/)
})

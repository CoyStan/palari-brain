#!/usr/bin/env node
// Provider-free ranking-only diagnostic. Excludes SQLite/vector decoding and
// cosine scoring; timings cannot be interpreted as end-to-end recall latency.
import assert from 'node:assert/strict'
import { boundedTopK } from '../src/top-k.mjs'
let state = 12345
const values = Array.from({ length: 100_000 }, (_, id) => ({ id,
  score: (state = Math.imul(state, 1664525) + 1013904223 >>> 0) / 2 ** 32,
}))
const compare = (a, b) => b.score - a.score || a.id - b.id
const expected = [...values].sort(compare).slice(0, 20)
const measurements = []
for (const [method, select] of [
  ['full-sort', () => [...values].sort(compare).slice(0, 20)],
  ['bounded-heap', () => boundedTopK(values, 20, compare)],
]) {
  const samples = []
  for (let i = 0; i < 21; i++) {
    const start = performance.now()
    const actual = select()
    const elapsed = performance.now() - start
    assert.deepEqual(actual, expected)
    if (i) samples.push(elapsed)
  }
  samples.sort((a, b) => a - b)
  measurements.push({ method, medianMs: samples[10], p95Ms: samples[18] })
}
console.log(JSON.stringify({ diagnostic: 'ranking-only', rows: values.length,
  limit: 20, parity: true, providerCalls: 0, measurements }, null, 2))

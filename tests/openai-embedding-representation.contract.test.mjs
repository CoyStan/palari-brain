import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createShortenedOpenAIHnswLocator,
  shortenOpenAIEmbedding,
} from '../evals/openai-embedding-representation.mjs'

const SCOPE = Object.freeze({ palariId: 'shortened', userId: 'owner' })

test('manual OpenAI shortening takes a normalized finite prefix', () => {
  const shortened = shortenOpenAIEmbedding([3, 4, 12], 2, {
    sourceDimensions: 3,
  })
  assert.ok(shortened instanceof Float32Array)
  assert.deepEqual([...shortened], [0.6000000238418579, 0.800000011920929])
  assert.throws(
    () => shortenOpenAIEmbedding([1, 0, Number.NaN], 2),
    /finite numbers/,
  )
  assert.throws(
    () => shortenOpenAIEmbedding([0, 0, 1], 2),
    /nonzero finite norm/,
  )
  assert.throws(
    () => shortenOpenAIEmbedding([1, 0], 3),
    /dimensions must be an integer from 1 to 2/,
  )
})

test('shortened HNSW searches prefixes but keeps full-vector lifecycle inputs', () => {
  const locator = createShortenedOpenAIHnswLocator({
    candidateLimit: 1,
    connectivity: 8,
    dimensions: 2,
    expansionAdd: 32,
    expansionSearch: 32,
    quantization: 'i8',
    sourceDimensions: 4,
  })
  locator.replace(SCOPE, [
    { evidenceId: 'prefix-x', vector: [1, 0, 0, 100] },
    { evidenceId: 'prefix-y', vector: [0, 1, 100, 0] },
  ])
  assert.deepEqual(locator.locate(SCOPE, [1, 0, -100, 0]), ['prefix-x'])
  assert.deepEqual(locator.upsert(SCOPE, {
    evidenceId: 'prefix-x',
    vector: [0, 1, 0, 100],
  }), { inserted: false, updated: true })
  assert.equal(locator.locate(SCOPE, [1, 0, -100, 0])[0], 'prefix-y')
  assert.equal(locator.remove(SCOPE, 'prefix-y'), true)
  assert.equal(locator.stats(SCOPE).dimensions, 2)
  assert.equal(locator.stats(SCOPE).sourceDimensions, 4)
  assert.equal(locator.stats(SCOPE).transform, 'openai-prefix-l2')
})

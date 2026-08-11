import assert from 'node:assert/strict'
import { rm } from 'node:fs/promises'
import test from 'node:test'

import {
  openContentAddressedEmbeddingCache,
} from '../evals/content-addressed-embedding-cache.mjs'
import { resolveAlphaFilePath } from '../evals/run-alpha-memory-debug.mjs'
import {
  SCALE05_DIMENSIONS,
  SCALE05_MODEL,
  scale05EmbeddingCacheNamespace,
} from '../evals/run-openai-locator-quality.mjs'
import {
  loadScale05CachedVectors,
} from '../evals/scale05-cached-vectors.mjs'

const CORPUS = Object.freeze({
  queries: Object.freeze([{ text: 'cached query' }]),
  records: Object.freeze([{ text: 'cached record' }]),
})

test('shared SCALE-05 cache access fails closed on misses and resumes on hits', async (t) => {
  const relativePath = `.palari-alpha/scale05-cache-contract-${process.pid}.sqlite`
  const path = resolveAlphaFilePath(relativePath, 'cachePath')
  t.after(() => Promise.all([
    rm(path, { force: true }),
    rm(`${path}-shm`, { force: true }),
    rm(`${path}-wal`, { force: true }),
  ]))

  await assert.rejects(
    loadScale05CachedVectors({
      cachePath: relativePath,
      caller: 'CACHE-CONTRACT',
      corpus: CORPUS,
    }),
    /CACHE-CONTRACT cache miss: provider access is disabled/,
  )

  const cache = await openContentAddressedEmbeddingCache({
    embed: async (texts) => texts.map((_, index) =>
      Array.from({ length: SCALE05_DIMENSIONS }, (__, dimension) =>
        dimension === index ? 1 : 0)),
    namespace: scale05EmbeddingCacheNamespace({
      dimensions: SCALE05_DIMENSIONS,
      model: SCALE05_MODEL,
    }),
    path,
  })
  await cache.embed([
    ...CORPUS.records.map(({ text }) => text),
    ...CORPUS.queries.map(({ text }) => text),
  ])
  cache.close()

  const loaded = await loadScale05CachedVectors({
    cachePath: relativePath,
    caller: 'CACHE-CONTRACT',
    corpus: CORPUS,
  })
  assert.deepEqual(loaded.cache, {
    hits: 2,
    misses: 0,
    providerInputs: 0,
    writes: 0,
  })
  assert.equal(loaded.recordVectors.length, 1)
  assert.equal(loaded.queryVectors.length, 1)
  assert.equal(loaded.recordVectors[0].length, SCALE05_DIMENSIONS)
})

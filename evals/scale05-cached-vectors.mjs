// Shared provider-free access to the complete SCALE-05 embedding cache.

import { openContentAddressedEmbeddingCache } from './content-addressed-embedding-cache.mjs'
import {
  SCALE05_DIMENSIONS,
  SCALE05_MODEL,
  scale05EmbeddingCacheNamespace,
} from './run-openai-locator-quality.mjs'
import { resolveAlphaFilePath } from './run-alpha-memory-debug.mjs'

export const SCALE05_CACHE_PATH =
  '.palari-alpha/scale05-openai-embeddings.sqlite'

export async function loadScale05CachedVectors({
  cachePath = SCALE05_CACHE_PATH,
  caller,
  corpus,
} = {}) {
  const label = String(caller ?? '').trim()
  if (!label) throw new TypeError('caller is required.')
  if (!Array.isArray(corpus?.records) || !Array.isArray(corpus?.queries)) {
    throw new TypeError('corpus records and queries are required.')
  }
  const cache = await openContentAddressedEmbeddingCache({
    embed: async () => {
      throw new Error(`${label} cache miss: provider access is disabled.`)
    },
    namespace: scale05EmbeddingCacheNamespace({
      dimensions: SCALE05_DIMENSIONS,
      model: SCALE05_MODEL,
    }),
    path: resolveAlphaFilePath(cachePath, 'cachePath'),
  })
  let vectors
  let cacheStats
  try {
    vectors = await cache.embed([
      ...corpus.records.map(({ text }) => text),
      ...corpus.queries.map(({ text }) => text),
    ])
    cacheStats = cache.stats
  } finally {
    cache.close()
  }
  return Object.freeze({
    cache: cacheStats,
    queryVectors: vectors.slice(corpus.records.length),
    recordVectors: vectors.slice(0, corpus.records.length),
  })
}

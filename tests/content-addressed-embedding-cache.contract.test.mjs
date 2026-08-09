import assert from 'node:assert/strict'
import { readFile, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'

import {
  contentAddressedEmbeddingKey,
  openContentAddressedEmbeddingCache,
} from '../evals/content-addressed-embedding-cache.mjs'

async function temporaryCache(name = 'vectors.sqlite') {
  const directory = await mkdtemp(join(tmpdir(), 'palari-embedding-cache-'))
  return join(directory, name)
}

test('keys bind schema, namespace, and exact UTF-8 content deterministically', () => {
  const first = contentAddressedEmbeddingKey({ namespace: 'model-a', text: 'café' })
  assert.equal(first, contentAddressedEmbeddingKey({
    namespace: 'model-a',
    text: 'café',
  }))
  assert.notEqual(first, contentAddressedEmbeddingKey({
    namespace: 'model-b',
    text: 'café',
  }))
  assert.notEqual(first, contentAddressedEmbeddingKey({
    namespace: 'model-a',
    text: 'cafe',
  }))
  assert.match(first, /^[a-f0-9]{64}$/u)
})

test('cache deduplicates misses while preserving input order and vectors', async () => {
  const path = await temporaryCache()
  const calls = []
  const cache = await openContentAddressedEmbeddingCache({
    path,
    namespace: 'gemini-embedding-001|similarity|chunk-8000|mean-v1',
    embed: async (texts) => {
      calls.push([...texts])
      return texts.map((text) => [text.length, text.charCodeAt(0)])
    },
  })
  const input = ['beta', 'alpha', 'beta']
  const before = [...input]
  assert.deepEqual(await cache.embed(input), [
    [4, 98],
    [5, 97],
    [4, 98],
  ])
  assert.deepEqual(await cache.embed(['alpha', 'beta']), [
    [5, 97],
    [4, 98],
  ])
  assert.deepEqual(input, before)
  assert.deepEqual(calls, [['beta', 'alpha']])
  assert.deepEqual(cache.stats, {
    hits: 2,
    misses: 3,
    providerInputs: 2,
    writes: 2,
  })
  cache.close()
})

test('durable hits resume without provider access and store no source text', async () => {
  const path = await temporaryCache()
  const namespace = 'private-eval-model-v1'
  const secretText = 'exact private canonical memory 6d3c86c1'
  const first = await openContentAddressedEmbeddingCache({
    path,
    namespace,
    embed: async () => [[0.25, -0.75]],
  })
  assert.deepEqual(await first.embed([secretText]), [[0.25, -0.75]])
  first.close()

  const bytes = await readFile(path)
  assert.equal(bytes.includes(Buffer.from(secretText)), false)
  const resumed = await openContentAddressedEmbeddingCache({
    path,
    namespace,
    embed: async () => {
      throw new Error('provider must not run for a durable hit')
    },
  })
  assert.deepEqual(await resumed.embed([secretText]), [[0.25, -0.75]])
  assert.deepEqual(resumed.stats, {
    hits: 1,
    misses: 0,
    providerInputs: 0,
    writes: 0,
  })
  resumed.close()
})

test('namespace changes cannot reuse another embedding configuration', async () => {
  const path = await temporaryCache()
  const first = await openContentAddressedEmbeddingCache({
    path,
    namespace: 'model-a',
    embed: async () => [[1]],
  })
  await first.embed(['shared exact text'])
  first.close()
  let calls = 0
  const second = await openContentAddressedEmbeddingCache({
    path,
    namespace: 'model-b',
    embed: async () => {
      calls += 1
      return [[2]]
    },
  })
  assert.deepEqual(await second.embed(['shared exact text']), [[2]])
  assert.equal(calls, 1)
  second.close()
})

test('corrupt vectors fail closed instead of falling through to a provider', async () => {
  const path = await temporaryCache()
  const namespace = 'model-a'
  const cache = await openContentAddressedEmbeddingCache({
    path,
    namespace,
    embed: async () => [[1, 2]],
  })
  await cache.embed(['text'])
  cache.close()
  const database = new DatabaseSync(path)
  database.prepare('UPDATE embedding_cache SET vector = ?').run(Buffer.from([0]))
  database.close()
  let calls = 0
  const corrupted = await openContentAddressedEmbeddingCache({
    path,
    namespace,
    embed: async () => {
      calls += 1
      return [[3, 4]]
    },
  })
  await assert.rejects(corrupted.embed(['text']), /cache entry is corrupt/iu)
  assert.equal(calls, 0)
  corrupted.close()
})

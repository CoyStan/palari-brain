import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { createUsearchHnswLocator } from '../evals/usearch-hnsw-locator.mjs'

const SCOPE = Object.freeze({ palariId: 'hnsw-palari', userId: 'hnsw-user' })
const OTHER_SCOPE = Object.freeze({
  palariId: 'hnsw-palari',
  userId: 'other-user',
})

function locator(candidateLimit = 2, quantization = 'f32') {
  return createUsearchHnswLocator({
    candidateLimit,
    connectivity: 8,
    dimensions: 4,
    expansionAdd: 32,
    expansionSearch: 32,
    quantization,
  })
}

test('USearch HNSW returns IDs only from its independently indexed scope', () => {
  const index = locator(1)
  index.upsert(SCOPE, { evidenceId: 'own', vector: [1, 0, 0, 0] })
  index.upsert(OTHER_SCOPE, { evidenceId: 'other', vector: [1, 0, 0, 0] })

  assert.deepEqual(index.locate(SCOPE, [1, 0, 0, 0]), ['own'])
  assert.deepEqual(index.locate(OTHER_SCOPE, [1, 0, 0, 0]), ['other'])
  assert.equal(index.stats(SCOPE).entries, 1)
  assert.equal(index.stats(SCOPE).strategy, 'usearch-hnsw-f32-m8-ef32-k1')
})

test('USearch HNSW batch build, correction, and exact deletion stay synchronized', () => {
  const index = locator(2)
  index.replace(SCOPE, [
    { evidenceId: 'correctable', vector: [1, 0, 0, 0] },
    { evidenceId: 'competitor', vector: [0.9, 0.1, 0, 0] },
  ])
  assert.equal(index.locate(SCOPE, [1, 0, 0, 0])[0], 'correctable')

  assert.deepEqual(index.upsert(SCOPE, {
    evidenceId: 'correctable',
    vector: [0, 1, 0, 0],
  }), { inserted: false, updated: true })
  assert.equal(index.locate(SCOPE, [1, 0, 0, 0])[0], 'competitor')
  assert.equal(index.locate(SCOPE, [0, 1, 0, 0])[0], 'correctable')

  assert.equal(index.remove(SCOPE, 'correctable'), true)
  assert.equal(index.remove(SCOPE, 'correctable'), false)
  assert.ok(!index.locate(SCOPE, [0, 1, 0, 0]).includes('correctable'))
})

test('persisted HNSW reloads with canonical IDs and rejects another scope', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'palari-usearch-'))
  t.after(() => rm(directory, { force: true, recursive: true }))
  const path = join(directory, 'index.usearch')
  const original = locator(2)
  original.replace(SCOPE, [
    { evidenceId: 'alpha', vector: [1, 0, 0, 0] },
    { evidenceId: 'beta', vector: [0, 1, 0, 0] },
  ])
  original.save(SCOPE, path)

  const restored = locator(2)
  restored.load(SCOPE, { evidenceIds: ['alpha', 'beta'], path })
  assert.deepEqual(
    restored.locate(SCOPE, [1, 0, 0, 0]),
    original.locate(SCOPE, [1, 0, 0, 0]),
  )
  assert.throws(
    () => locator(2).load(OTHER_SCOPE, {
      evidenceIds: ['alpha', 'beta'],
      path,
    }),
    /not bound to this scope/,
  )
})

test('USearch HNSW fails closed on malformed entries and vector dimensions', () => {
  const index = locator()
  assert.throws(() => index.replace(SCOPE, [
    { evidenceId: 'duplicate', vector: [1, 0, 0, 0] },
    { evidenceId: 'duplicate', vector: [0, 1, 0, 0] },
  ]), /unique evidence IDs/)
  assert.throws(() => index.upsert(SCOPE, {
    evidenceId: 'wrong-dimensions',
    vector: [1, 0],
  }), /4 dimensions/)
  assert.throws(() => index.locate(SCOPE, [1, 0, Number.NaN, 0]),
    /finite numbers/)
  assert.throws(() => locator(2, 'b1'), /quantization must be one of/)
})

test('f32, bf16, and i8 preserve correction and deletion lifecycle behavior', () => {
  for (const quantization of ['f32', 'bf16', 'i8']) {
    const index = locator(2, quantization)
    index.replace(SCOPE, [
      { evidenceId: 'moving', vector: [1, 0, 0, 0] },
      { evidenceId: 'stable', vector: [0, 1, 0, 0] },
    ])
    assert.equal(index.locate(SCOPE, [1, 0, 0, 0])[0], 'moving')
    index.upsert(SCOPE, { evidenceId: 'moving', vector: [0, 0, 1, 0] })
    assert.equal(index.locate(SCOPE, [0, 0, 1, 0])[0], 'moving')
    assert.equal(index.remove(SCOPE, 'moving'), true)
    assert.ok(!index.locate(SCOPE, [0, 0, 1, 0]).includes('moving'))
    assert.equal(index.stats(SCOPE).quantization, quantization)
  }
})

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createDerivedVectorLocator,
} from '../evals/derived-vector-locator.mjs'

const SCOPE = Object.freeze({
  palariId: 'locator-palari',
  userId: 'locator-user',
})
const OTHER_SCOPE = Object.freeze({
  palariId: 'locator-palari',
  userId: 'other-user',
})

function fixtureVector(dimensions = 128) {
  return Array.from({ length: dimensions }, (_, index) =>
    Math.sin((index + 1) * 1.61803398875) +
      Math.cos((index + 1) * 0.70710678118))
}

test('derived locator returns IDs only inside the requested scope', () => {
  const locator = createDerivedVectorLocator()
  const vector = fixtureVector()

  locator.upsert(SCOPE, { evidenceId: 'own', vector })
  locator.upsert(OTHER_SCOPE, { evidenceId: 'other', vector })

  assert.deepEqual(locator.locate(SCOPE, vector), ['own'])
  assert.deepEqual(locator.locate(OTHER_SCOPE, vector), ['other'])
  assert.deepEqual(locator.stats(SCOPE), {
    bands: 8,
    bitsPerBand: 8,
    bucketReferences: 8,
    dimensions: 128,
    entries: 1,
    logicalSketchBytes: 8,
    strategy: 'sparse-sign-64/8x8',
  })
})

test('derived locator moves an updated ID and removes a deleted ID', () => {
  const locator = createDerivedVectorLocator()
  const original = fixtureVector(256)
  const corrected = original.map((value) => -value)

  assert.deepEqual(locator.upsert(SCOPE, {
    evidenceId: 'correctable',
    vector: original,
  }), { inserted: true, updated: false })
  assert.ok(locator.locate(SCOPE, original).includes('correctable'))

  assert.deepEqual(locator.upsert(SCOPE, {
    evidenceId: 'correctable',
    vector: corrected,
  }), { inserted: false, updated: true })
  assert.ok(!locator.locate(SCOPE, original).includes('correctable'))
  assert.ok(locator.locate(SCOPE, corrected).includes('correctable'))

  assert.equal(locator.remove(SCOPE, 'correctable'), true)
  assert.equal(locator.remove(SCOPE, 'correctable'), false)
  assert.deepEqual(locator.locate(SCOPE, corrected), [])
})

test('derived locator rejects corrupt or dimension-inconsistent vectors', () => {
  const locator = createDerivedVectorLocator()
  locator.upsert(SCOPE, { evidenceId: 'valid', vector: fixtureVector(64) })

  assert.throws(
    () => locator.upsert(SCOPE, {
      evidenceId: 'wrong-dimensions',
      vector: fixtureVector(32),
    }),
    /64 dimensions/,
  )
  assert.throws(
    () => locator.locate(SCOPE, [1, Number.NaN]),
    /finite numbers/,
  )
  assert.throws(
    () => createDerivedVectorLocator({ bands: 1, bitsPerBand: 33 }),
    /at most 32/,
  )
})

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createLocatorQualityCorpus,
  DEFAULT_LOCATOR_CORPUS_SIZE,
  DEFAULT_LOCATOR_MINIMUM_TIER,
} from '../evals/locator-quality-corpus.mjs'

test('SCALE-05 corpus is deterministic, diverse, unique, and fully labeled', () => {
  const first = createLocatorQualityCorpus()
  const second = createLocatorQualityCorpus()

  assert.deepEqual(first, second)
  assert.equal(first.licence, 'MIT repository-owned synthetic text')
  assert.equal(first.records.length, DEFAULT_LOCATOR_CORPUS_SIZE)
  assert.equal(first.queries.length, 50)
  assert.equal(new Set(first.records.map(({ id }) => id)).size, first.records.length)
  assert.equal(new Set(first.records.map(({ text }) => text)).size, first.records.length)
  assert.equal(new Set(first.queries.map(({ id }) => id)).size, first.queries.length)
  assert.equal(first.records.filter(({ kind }) => kind === 'target').length, 25)
  assert.ok(new Set(first.records.map(({ domain }) => domain)).size >= 20)

  const firstTierIds = new Set(first.records
    .slice(0, DEFAULT_LOCATOR_MINIMUM_TIER)
    .map(({ id }) => id))
  assert.ok(first.queries.every(({ targetId }) => firstTierIds.has(targetId)))
  assert.deepEqual(
    [...new Set(first.queries.map(({ family }) => family))].sort(),
    ['shared-token', 'zero-overlap'],
  )
})

test('SCALE-05 corpus rejects sizes that cannot contain the labeled design', () => {
  assert.throws(
    () => createLocatorQualityCorpus({ minimumTier: 40, size: 100 }),
    /too small/,
  )
  assert.throws(
    () => createLocatorQualityCorpus({ minimumTier: 2_000, size: 1_000 }),
    /must not exceed/,
  )
})

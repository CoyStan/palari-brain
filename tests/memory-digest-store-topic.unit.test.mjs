// Unit tests — digest topic normalization (src/memory-digest-store.mjs).
//
// The digest store is the SQLite reduction ledger, driven end to end by the
// incremental-memory live arms. Its topic normalizer, though, is a pure
// comparison key: replace/forget decisions and topic dedupe hinge on two
// topic strings collapsing to the same value under Unicode NFC folding,
// whitespace flattening, and case folding. This test pins that key so a
// spacing or accent-composition difference can never silently split one
// topic into two.
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DEFAULT_REDUCTION_MAX_ATTEMPTS,
  DETERMINISTIC_REDUCTION_FAILURES,
  normalizedDigestTopic,
} from '../src/memory-digest-store.mjs'

test('reduction retry policy constants are stable', () => {
  assert.equal(DEFAULT_REDUCTION_MAX_ATTEMPTS, 3)
  assert.deepEqual([...DETERMINISTIC_REDUCTION_FAILURES], ['REDUCER_INPUT_CAPACITY'])
  assert.ok(Object.isFrozen(DETERMINISTIC_REDUCTION_FAILURES))
})

test('topic normalization lower-cases, trims, and collapses whitespace', () => {
  assert.equal(normalizedDigestTopic('  Coffee   Preferences\t'), 'coffee preferences')
  assert.equal(normalizedDigestTopic('WEEKEND\nPLANS'), 'weekend plans')
  assert.equal(normalizedDigestTopic('already-normal'), 'already-normal')
})

test('nullish input normalizes to the empty string', () => {
  assert.equal(normalizedDigestTopic(null), '')
  assert.equal(normalizedDigestTopic(undefined), '')
  assert.equal(normalizedDigestTopic('   '), '')
})

test('NFC folding makes composed and decomposed accents compare equal', () => {
  const composed = 'Café' // é as a single codepoint (U+00E9)
  const decomposed = 'Cafe\u0301' // e + combining acute accent
  assert.notEqual(composed, decomposed)
  assert.equal(normalizedDigestTopic(composed), normalizedDigestTopic(decomposed))
  assert.equal(normalizedDigestTopic(decomposed), 'café')
})

test('non-string input is coerced before normalization', () => {
  assert.equal(normalizedDigestTopic(42), '42')
})

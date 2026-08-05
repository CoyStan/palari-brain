// Unit tests — ranked dialogue query construction (src/memory-search.mjs).
//
// The FTS5-backed ranked search needs a SQLite build with FTS5 and is covered
// by the live retrieval arms. Its query-construction helpers, however, are
// pure string transforms: they decide which query words survive stopwording,
// deduplication, and the eight-term cap, and how those terms become a safe
// FTS5 MATCH expression. Pinning them here keeps the "index locates, never
// is, evidence" boundary honest without a database.
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DIALOGUE_SEARCH_MAX_TERMS,
  DIALOGUE_SEARCH_TOKENIZER,
  rankedDialogueQuery,
  rankedDialogueQueryTerms,
} from '../src/memory-search.mjs'

test('exported constants match the documented FTS configuration', () => {
  assert.equal(DIALOGUE_SEARCH_MAX_TERMS, 8)
  assert.equal(DIALOGUE_SEARCH_TOKENIZER, 'porter unicode61 remove_diacritics 2')
})

test('query terms drop stopwords and keep content words, lowercased', () => {
  assert.deepEqual(rankedDialogueQueryTerms('Where is my spare key?'), ['spare', 'key'])
  assert.deepEqual(rankedDialogueQueryTerms('COFFEE Beans'), ['coffee', 'beans'])
})

test('a phrase with no rankable content returns no terms', () => {
  assert.deepEqual(rankedDialogueQueryTerms('the a of in on at'), [])
  assert.deepEqual(rankedDialogueQueryTerms(''), [])
  assert.deepEqual(rankedDialogueQueryTerms(null), [])
  assert.deepEqual(rankedDialogueQueryTerms(undefined), [])
})

test('repeated words collapse to a single term preserving first-seen order', () => {
  assert.deepEqual(rankedDialogueQueryTerms('coffee coffee beans coffee'), ['coffee', 'beans'])
})

test('query terms are capped at DIALOGUE_SEARCH_MAX_TERMS', () => {
  const phrase = 'alpha bravo charlie delta echo foxtrot golf hotel india juliet'
  const terms = rankedDialogueQueryTerms(phrase)
  assert.equal(terms.length, DIALOGUE_SEARCH_MAX_TERMS)
  assert.deepEqual(terms, ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel'])
})

test('rankedDialogueQuery ORs quoted terms and escapes embedded quotes', () => {
  assert.equal(rankedDialogueQuery([]), '')
  assert.equal(rankedDialogueQuery(['key']), '"key"')
  assert.equal(rankedDialogueQuery(['spare', 'key']), '"spare" OR "key"')
  // A double quote in a term is doubled so the MATCH string stays balanced.
  assert.equal(rankedDialogueQuery(['a"b']), '"a""b"')
})

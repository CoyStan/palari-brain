// Unit tests — canonical dialogue text guard (src/dialogue-evidence.mjs).
//
// The dialogue gate is SQLite-backed and exercised by the live journal arms.
// Its round-trip text guard is the one pure invariant the whole journal rests
// on: canonical evidence must be losslessly storable and retrievable, so any
// text carrying a NUL or an unpaired surrogate is rejected at the door rather
// than silently corrupting a stored quote. These tests fix that guard and the
// frozen source-kind set without opening a store.
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  dialogueSourceKinds,
  roundTrippableDialogueText,
} from '../src/dialogue-evidence.mjs'

test('dialogueSourceKinds is the frozen user/assistant pair', () => {
  assert.deepEqual([...dialogueSourceKinds], ['user_message', 'assistant_message'])
  assert.ok(Object.isFrozen(dialogueSourceKinds))
})

test('well-formed text passes through unchanged', () => {
  for (const value of ['hello', 'café ☕ 你好', 'line one\nline two', '😀 pair']) {
    assert.equal(roundTrippableDialogueText(value), value)
  }
})

test('nullish and non-string inputs are coerced to strings', () => {
  assert.equal(roundTrippableDialogueText(null), '')
  assert.equal(roundTrippableDialogueText(undefined), '')
  assert.equal(roundTrippableDialogueText(''), '')
  assert.equal(roundTrippableDialogueText(123), '123')
  assert.equal(roundTrippableDialogueText(true), 'true')
})

test('a NUL byte is rejected with the round-trip error code', () => {
  assert.throws(
    () => roundTrippableDialogueText('before\u0000after'),
    (error) => {
      assert.ok(error instanceof TypeError)
      assert.equal(error.code, 'TEXT_NOT_ROUND_TRIPPABLE')
      return true
    },
  )
})

test('unpaired surrogates are rejected in both directions', () => {
  // A lone high surrogate and a lone low surrogate are each not round-trippable.
  assert.throws(() => roundTrippableDialogueText('lonely \uD800 high'), { code: 'TEXT_NOT_ROUND_TRIPPABLE' })
  assert.throws(() => roundTrippableDialogueText('lonely \uDC00 low'), { code: 'TEXT_NOT_ROUND_TRIPPABLE' })
  // A properly paired surrogate (a single astral codepoint) is fine.
  assert.equal(roundTrippableDialogueText('\uD83D\uDE00'), '😀')
})

test('the label argument is surfaced in the rejection message', () => {
  assert.throws(
    () => roundTrippableDialogueText('x\u0000y', 'quote'),
    /^TypeError: quote must be well-formed Unicode without U\+0000\.$/,
  )
})

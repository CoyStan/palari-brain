// Kernel-internal helpers shared by more than one module.
//
// Nothing here makes a policy decision: these are the small, exact primitives
// (hashing, clock reading, scope normalization, text round-tripping, key
// checks, host-derived speaker) that several modules previously each carried
// their own identical copy of. `util.mjs` stays reserved for code vendored
// verbatim from palari-v05 per docs/SOURCE-MAP.md, so shared kernel code lives
// here instead.

import { createHash } from 'node:crypto'

export function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value
  }
  for (const child of Object.values(value)) deepFreeze(child)
  return Object.freeze(value)
}

export function isWellFormedText(value) {
  if (typeof value.isWellFormed === 'function') return value.isWellFormed()
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index)
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1)
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false
      index += 1
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return false
    }
  }
  return true
}

// Canonical evidence must survive a storage round trip byte for byte, so
// U+0000 and lone surrogates are rejected at the boundary rather than stored.
export function roundTrippableText(value, label = 'text') {
  const text = String(value ?? '')
  if (text.includes('\u0000') || !isWellFormedText(text)) {
    const error = new TypeError(
      `${label} must be well-formed Unicode without U+0000.`,
    )
    error.code = 'TEXT_NOT_ROUND_TRIPPABLE'
    throw error
  }
  return text
}

export function normalizedScope({ palariId, userId } = {}) {
  const scope = {
    palariId: roundTrippableText(palariId, 'palariId').trim(),
    userId: roundTrippableText(userId, 'userId').trim(),
  }
  if (!scope.palariId) throw new TypeError('palariId is required.')
  if (!scope.userId) throw new TypeError('userId is required.')
  return scope
}

export function sha256Hex(value) {
  return createHash('sha256').update(String(value)).digest('hex')
}

export function sha256Fields(values) {
  return sha256Hex(JSON.stringify(values.map((value) => String(value))))
}

export function isoNowFromClock(clock) {
  const value = clock()
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new TypeError('clock must return a valid timestamp.')
  }
  return date.toISOString()
}

// True only when `value`'s own keys are exactly `expected` — no extras, none
// missing. Callers own the error they raise, because their contracts differ.
export function hasExactKeys(value, expected) {
  const actual = Object.keys(value).sort()
  const wanted = [...expected].sort()
  return actual.length === wanted.length &&
    actual.every((key, index) => key === wanted[index])
}

// Speaker is host-derived from the recorded source kind; a model never names
// it. An unknown kind is corruption, not a defaultable value.
export function canonicalSpeaker(sourceKind, message) {
  if (sourceKind === 'user_message') return 'user'
  if (sourceKind === 'assistant_message') return 'Palari'
  throw new TypeError(message)
}

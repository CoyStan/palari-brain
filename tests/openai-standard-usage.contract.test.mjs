import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  OPENAI_STANDARD_RESERVATION_POLICIES,
} from '../evals/openai-input-reservation.mjs'
import {
  settleOpenAIStandardUsage,
} from '../evals/openai-standard-usage.mjs'

function usage(overrides = {}) {
  return {
    input_tokens: 2_142,
    input_tokens_details: {
      cache_write_tokens: 2_139,
      cached_tokens: 0,
    },
    output_tokens: 40,
    output_tokens_details: { reasoning_tokens: 8 },
    total_tokens: 2_182,
    ...overrides,
  }
}

test('sanitized BRN-0026 HTTP-200 usage settles exactly through public short', () => {
  const source = usage()
  const before = structuredClone(source)
  const settled = settleOpenAIStandardUsage({
    contextBand: 'short',
    model: 'gpt-5.6-luna',
    usage: source,
  })

  assert.equal(settled.policyId,
    OPENAI_STANDARD_RESERVATION_POLICIES['gpt-5.6-luna'].id)
  assert.equal(settled.contextBand, 'short')
  assert.equal(settled.inputTokens, 2_142)
  assert.equal(settled.cachedInputTokens, 0)
  assert.equal(settled.cacheWriteTokens, 2_139)
  assert.equal(settled.outputTokens, 40)
  assert.equal(settled.reasoningTokens, 8)
  assert.equal(settled.measuredPicodollars, '476400000')
  assert.equal(settled.measuredUsdDecimal, '0.0004764')
  assert.equal(Object.getPrototypeOf(settled), null)
  assert.equal(Object.isFrozen(settled), true)
  assert.deepEqual(source, before)
})

test('public bands use the pinned Luna and Sol Standard rates', () => {
  const fixtures = [
    ['gpt-5.6-luna', 'short', '0.0004764'],
    ['gpt-5.6-luna', 'long', '0.0009288'],
    ['gpt-5.6-sol', 'short', '0.01191'],
    ['gpt-5.6-sol', 'long', '0.02322'],
  ]
  for (const [model, contextBand, expected] of fixtures) {
    assert.equal(settleOpenAIStandardUsage({
      contextBand,
      model,
      usage: usage(),
    }).measuredUsdDecimal, expected)
  }
})

test('legacy internal context labels fail before settlement', () => {
  for (const contextBand of ['shortContext', 'longContext']) {
    assert.throws(() => settleOpenAIStandardUsage({
      contextBand,
      model: 'gpt-5.6-luna',
      usage: usage(),
    }), /contextBand must be short or long/u)
  }
})

test('unknown model and malformed or impossible usage fail closed', () => {
  const cases = [
    { model: 'gpt-5.6-terra', usage: usage() },
    { model: 'gpt-5.6-luna', usage: { ...usage(), input_tokens: '2142' } },
    { model: 'gpt-5.6-luna', usage: { ...usage(), total_tokens: 2_181 } },
    { model: 'gpt-5.6-luna', usage: usage({
      input_tokens_details: {
        cache_write_tokens: 0,
        cached_tokens: 2_143,
      },
    }) },
    { model: 'gpt-5.6-luna', usage: usage({
      input_tokens_details: {
        cache_write_tokens: 2_143,
        cached_tokens: 0,
      },
    }) },
    { model: 'gpt-5.6-luna', usage: usage({
      output_tokens_details: { reasoning_tokens: 41 },
    }) },
    { model: 'gpt-5.6-luna', usage: { ...usage(), future_field: true } },
    { model: 'gpt-5.6-luna', usage: usage({
      input_tokens_details: {
        cache_write_tokens: 2_139,
        cached_tokens: 0,
        future_field: true,
      },
    }) },
  ]
  for (const fixture of cases) {
    assert.throws(() => settleOpenAIStandardUsage({
      contextBand: 'short',
      ...fixture,
    }), TypeError)
  }
})

test('accessors, proxies, and later source mutation cannot enter settlement', () => {
  const accessor = usage()
  Object.defineProperty(accessor, 'input_tokens', {
    enumerable: true,
    get: () => 2_142,
  })
  assert.throws(() => settleOpenAIStandardUsage({
    contextBand: 'short',
    model: 'gpt-5.6-luna',
    usage: accessor,
  }), /data field/u)
  assert.throws(() => settleOpenAIStandardUsage({
    contextBand: 'short',
    model: 'gpt-5.6-luna',
    usage: new Proxy(usage(), {}),
  }), /plain object/u)

  const source = usage()
  const settled = settleOpenAIStandardUsage({
    contextBand: 'short',
    model: 'gpt-5.6-luna',
    usage: source,
  })
  source.input_tokens = 1
  assert.equal(settled.inputTokens, 2_142)
  assert.equal(settled.measuredUsdDecimal, '0.0004764')
})

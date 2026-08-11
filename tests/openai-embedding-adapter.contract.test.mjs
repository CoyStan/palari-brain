import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createCappedOpenAIEmbeddingAdapter,
  estimateEmbeddingTokenUpperBound,
} from '../evals/openai-embedding-adapter.mjs'

function memoryBudgetStore(opening = 0) {
  let accounted = opening
  const calls = { reserve: [], settle: [] }
  return {
    calls,
    async load() { return accounted },
    async reserve(amount, cap) {
      calls.reserve.push({ amount, cap })
      if (accounted + amount > cap + 1e-9) return null
      accounted += amount
      return accounted
    },
    async settle(reserved, actual) {
      calls.settle.push({ actual, reserved })
      accounted = Math.round((accounted - reserved + actual) * 1e12) / 1e12
      return accounted
    },
    get accounted() { return accounted },
  }
}

function response(payload, { headers = {}, status = 200 } = {}) {
  return new Response(JSON.stringify(payload), {
    headers: { 'content-type': 'application/json', ...headers },
    status,
  })
}

test('adapter batches in order, paces, reserves, and settles reported usage', async () => {
  const budgetStore = memoryBudgetStore()
  const paced = []
  const requests = []
  const adapter = createCappedOpenAIEmbeddingAdapter({
    apiKey: 'test-only-key',
    budgetStore,
    dimensions: 2,
    fetchImpl: async (url, init) => {
      const body = JSON.parse(init.body)
      requests.push({ body, headers: init.headers, url })
      return response({
        data: body.input.map((_, index) => ({
          embedding: [index + 0.25, index + 0.75],
          index: body.input.length - index - 1,
        })).reverse(),
        usage: { total_tokens: body.input.length * 2 },
      }, {
        headers: {
          'x-ratelimit-limit-requests': '3000',
          'x-ratelimit-limit-tokens': '1000000',
          'x-ratelimit-remaining-requests': '2999',
          'x-ratelimit-remaining-tokens': '999990',
        },
      })
    },
    maxBatchInputs: 2,
    maxBatchTokenUnits: 1_000,
    maxDollar: 1,
    model: 'text-embedding-3-small',
    pacer: { async pace(units) { paced.push(units) } },
    priceUsdPerMillionTokens: 1_000,
  })

  assert.deepEqual(await adapter.embed(['one', 'two', 'three']), [
    [1.25, 1.75],
    [0.25, 0.75],
    [0.25, 0.75],
  ])
  assert.equal(requests.length, 2)
  assert.deepEqual(requests.map(({ body }) => body.input), [
    ['one', 'two'],
    ['three'],
  ])
  assert.ok(requests.every(({ body }) =>
    body.model === 'text-embedding-3-small' &&
      body.dimensions === 2 && body.encoding_format === 'float'))
  assert.ok(requests.every(({ headers }) =>
    headers.Authorization === 'Bearer test-only-key'))
  assert.deepEqual(paced, [
    estimateEmbeddingTokenUpperBound(['one', 'two']),
    estimateEmbeddingTokenUpperBound(['three']),
  ])
  assert.equal(budgetStore.calls.reserve.length, 2)
  assert.equal(budgetStore.calls.settle.length, 2)
  assert.deepEqual(adapter.stats.lastRateLimit, {
    limitRequests: 3000,
    limitTokens: 1_000_000,
    remainingRequests: 2999,
    remainingTokens: 999_990,
  })
  assert.equal(adapter.stats.requests, 2)
  assert.equal(adapter.stats.providerInputs, 3)
  assert.equal(adapter.stats.totalTokens, 6)
  assert.equal(adapter.stats.costUsd, 0.006)
  assert.equal(adapter.stats.accountedUsd, 0.006)
})

test('adapter stops before fetch when the aggregate cap cannot reserve a batch', async () => {
  const budgetStore = memoryBudgetStore(0.009)
  let fetches = 0
  const adapter = createCappedOpenAIEmbeddingAdapter({
    apiKey: 'test-only-key',
    budgetStore,
    dimensions: 2,
    fetchImpl: async () => { fetches += 1 },
    maxDollar: 0.01,
    priceUsdPerMillionTokens: 1_000,
  })

  await assert.rejects(adapter.embed(['this reservation is larger']),
    /would exceed the aggregate/)
  assert.equal(fetches, 0)
  assert.equal(budgetStore.accounted, 0.009)
})

test('failed dispatch keeps its reservation and never exposes echoed text', async () => {
  const budgetStore = memoryBudgetStore()
  const secret = 'private input that must not appear in the error'
  const adapter = createCappedOpenAIEmbeddingAdapter({
    apiKey: 'test-only-key',
    budgetStore,
    dimensions: 2,
    fetchImpl: async () => response({
      error: { code: 'rate_limit_exceeded', message: `echo ${secret}` },
    }, {
      headers: { 'x-request-id': 'req_safe-123' },
      status: 429,
    }),
    maxDollar: 1,
    priceUsdPerMillionTokens: 1_000,
  })

  await assert.rejects(adapter.embed([secret]), (error) => {
    assert.match(error.message, /HTTP 429/)
    assert.match(error.message, /rate_limit_exceeded/)
    assert.match(error.message, /req_safe-123/)
    assert.equal(error.message.includes(secret), false)
    return true
  })
  assert.equal(budgetStore.calls.settle.length, 0)
  assert.ok(budgetStore.accounted > 0)
})

test('usage above the reservation fails closed and retains the reservation', async () => {
  const budgetStore = memoryBudgetStore()
  const adapter = createCappedOpenAIEmbeddingAdapter({
    apiKey: 'test-only-key',
    budgetStore,
    dimensions: 2,
    fetchImpl: async () => response({
      data: [{ embedding: [0.1, 0.2], index: 0 }],
      usage: { total_tokens: 100_000 },
    }),
    maxDollar: 1,
    priceUsdPerMillionTokens: 1,
  })

  await assert.rejects(adapter.embed(['tiny']), /above the conservative reservation/)
  assert.equal(budgetStore.calls.settle.length, 0)
  assert.ok(budgetStore.accounted > 0)
})

import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  parseOpenAILocatorQualityArgs,
  runOpenAILocatorQuality,
  SCALE05_APPROVED_CAP_USD,
} from '../evals/run-openai-locator-quality.mjs'

function memoryBudgetStore() {
  let accounted = 0
  return {
    async load() { return accounted },
    async reserve(amount, cap) {
      if (accounted + amount > cap + 1e-9) return null
      accounted = Math.round((accounted + amount) * 1e12) / 1e12
      return accounted
    },
    async settle(reserved, actual) {
      accounted = Math.round((accounted - reserved + actual) * 1e12) / 1e12
      return accounted
    },
  }
}

test('SCALE-05 CLI requires reviewed pricing and cannot exceed approved cap', () => {
  assert.throws(() => parseOpenAILocatorQualityArgs([
    '--max-dollar', '1',
  ]), /--price-per-million is required/)
  assert.throws(() => parseOpenAILocatorQualityArgs([
    '--max-dollar', String(SCALE05_APPROVED_CAP_USD + 0.01),
    '--price-per-million', '0.02',
  ]), /founder-approved/)
  assert.deepEqual(parseOpenAILocatorQualityArgs([
    '--preflight-only',
    '--max-dollar', '1',
    '--price-per-million', '0.02',
    '--max-requests-per-minute', '75',
    '--max-token-units-per-minute', '40000',
  ]), {
    maxDollar: 1,
    maxRequestsPerMinute: 75,
    maxTokenUnitsPerMinute: 40_000,
    preflightOnly: true,
    priceUsdPerMillionTokens: 0.02,
  })
})

test('preflight sends two cached inputs and reports no text or vectors', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'palari-openai-preflight-'))
  const cachePath = join(directory, 'vectors.sqlite')
  const budgetStore = memoryBudgetStore()
  let fetches = 0
  const fetchImpl = async (_url, init) => {
    fetches += 1
    const body = JSON.parse(init.body)
    return new Response(JSON.stringify({
      data: body.input.map((_, index) => ({
        embedding: Array.from({ length: 8 }, (__, dimension) =>
          (index + 1) * (dimension + 1) / 100),
        index,
      })),
      usage: { total_tokens: 12 },
    }), {
      headers: {
        'content-type': 'application/json',
        'x-ratelimit-limit-requests': '3000',
        'x-ratelimit-limit-tokens': '1000000',
      },
    })
  }
  const common = {
    apiKey: 'test-only-key',
    budgetStore,
    cachePath,
    dimensions: 8,
    maxDollar: 1,
    pacer: { async pace() {}, stats: {} },
    preflightOnly: true,
    priceUsdPerMillionTokens: 0.02,
    writeResult: false,
  }

  const first = await runOpenAILocatorQuality({ ...common, fetchImpl })
  assert.equal(first.phase, 'preflight')
  assert.equal(first.vectorCount, 2)
  assert.equal(first.provider.providerInputs, 2)
  assert.equal(first.cache.writes, 2)
  assert.equal(JSON.stringify(first).includes('spare key'), false)
  assert.equal(Object.hasOwn(first, 'vectors'), false)

  const second = await runOpenAILocatorQuality({
    ...common,
    fetchImpl: async () => { throw new Error('cache miss') },
  })
  assert.equal(fetches, 1)
  assert.equal(second.provider.requests, 0)
  assert.equal(second.cache.hits, 2)
  assert.equal(second.budget.accountedUsd, first.budget.accountedUsd)
})

// Pure, provider-free settlement of validated OpenAI Responses usage at the
// pinned Standard/default rates owned by the reservation policy.

import { types as utilTypes } from 'node:util'

import {
  OPENAI_STANDARD_RESERVATION_POLICIES,
} from './openai-input-reservation.mjs'

const bigintFrom = BigInt
const numberIsFinite = Number.isFinite
const numberIsSafeInteger = Number.isSafeInteger
const objectCreate = Object.create
const objectFreeze = Object.freeze
const objectGetOwnPropertyDescriptors = Object.getOwnPropertyDescriptors
const objectGetPrototypeOf = Object.getPrototypeOf
const objectHasOwn = Object.hasOwn
const objectPrototype = Object.prototype
const reflectOwnKeys = Reflect.ownKeys
const stringFrom = String
const stringPadStart = Function.prototype.call.bind(String.prototype.padStart)
const stringSlice = Function.prototype.call.bind(String.prototype.slice)
const utilIsProxy = utilTypes.isProxy

const PICODOLLARS_PER_DOLLAR = 1_000_000_000_000n
const PICODOLLARS_PER_TOKEN_PER_CENT_PER_MILLION = 10_000n
const GPT_5_6_CACHE_WRITE_RATE_NUMERATOR = 5n
const GPT_5_6_CACHE_WRITE_RATE_DENOMINATOR = 4n

function fail(message) {
  throw new TypeError(`OpenAI Standard usage settlement: ${message}`)
}

function record(entries) {
  const value = objectCreate(null)
  for (const [key, entry] of entries) value[key] = entry
  return value
}

function exactDataRecord(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
    utilIsProxy(value) || objectGetPrototypeOf(value) !== objectPrototype) {
    fail(`${label} must be a plain object.`)
  }
  const ownKeys = reflectOwnKeys(value)
  if (ownKeys.length !== keys.length ||
    keys.some((key) => !objectHasOwn(value, key))) {
    fail(`${label} fields differ from the contract.`)
  }
  const descriptors = objectGetOwnPropertyDescriptors(value)
  const snapshot = record([])
  for (const key of keys) {
    const descriptor = descriptors[key]
    if (!descriptor || !objectHasOwn(descriptor, 'value') ||
      descriptor.enumerable !== true) {
      fail(`${label}.${key} must be an enumerable data field.`)
    }
    snapshot[key] = descriptor.value
  }
  return snapshot
}

function nonNegativeSafeInteger(value, label) {
  if (!numberIsSafeInteger(value) || value < 0) {
    fail(`${label} must be a non-negative safe integer.`)
  }
  return value
}

function centsPerMillion(value, label) {
  const cents = value * 100
  if (!numberIsFinite(value) || value < 0 || !numberIsSafeInteger(cents)) {
    fail(`${label} is not pinned to exact cents.`)
  }
  return cents
}

function usdDecimal(picodollars) {
  const whole = picodollars / PICODOLLARS_PER_DOLLAR
  let fraction = stringPadStart(stringFrom(
    picodollars % PICODOLLARS_PER_DOLLAR,
  ), 12, '0')
  while (fraction.length > 0 && fraction[fraction.length - 1] === '0') {
    fraction = stringSlice(fraction, 0, -1)
  }
  return fraction ? `${whole}.${fraction}` : `${whole}`
}

export function settleOpenAIStandardUsage({
  contextBand,
  model,
  usage,
} = {}) {
  if (typeof model !== 'string' ||
    !objectHasOwn(OPENAI_STANDARD_RESERVATION_POLICIES, model)) {
    fail('model must have one exact pinned Standard policy.')
  }
  if (contextBand !== 'short' && contextBand !== 'long') {
    fail('contextBand must be short or long.')
  }
  const policy = OPENAI_STANDARD_RESERVATION_POLICIES[model]
  const rates = policy.measuredStandard?.[contextBand]
  if (!rates) fail('model and contextBand have no pinned Standard rates.')

  const accepted = exactDataRecord(usage, [
    'input_tokens',
    'input_tokens_details',
    'output_tokens',
    'output_tokens_details',
    'total_tokens',
  ], 'usage')
  const inputDetails = exactDataRecord(
    accepted.input_tokens_details,
    ['cache_write_tokens', 'cached_tokens'],
    'usage.input_tokens_details',
  )
  const outputDetails = exactDataRecord(
    accepted.output_tokens_details,
    ['reasoning_tokens'],
    'usage.output_tokens_details',
  )
  const inputTokens = nonNegativeSafeInteger(
    accepted.input_tokens,
    'usage.input_tokens',
  )
  const cachedInputTokens = nonNegativeSafeInteger(
    inputDetails.cached_tokens,
    'usage.input_tokens_details.cached_tokens',
  )
  const cacheWriteTokens = nonNegativeSafeInteger(
    inputDetails.cache_write_tokens,
    'usage.input_tokens_details.cache_write_tokens',
  )
  const outputTokens = nonNegativeSafeInteger(
    accepted.output_tokens,
    'usage.output_tokens',
  )
  const reasoningTokens = nonNegativeSafeInteger(
    outputDetails.reasoning_tokens,
    'usage.output_tokens_details.reasoning_tokens',
  )
  const totalTokens = nonNegativeSafeInteger(
    accepted.total_tokens,
    'usage.total_tokens',
  )
  if (inputTokens < 1 ||
    cachedInputTokens + cacheWriteTokens > inputTokens ||
    reasoningTokens > outputTokens || totalTokens !== inputTokens + outputTokens) {
    fail('usage token relationships are inconsistent.')
  }

  const uncachedInputTokens = inputTokens - cachedInputTokens -
    cacheWriteTokens
  const inputCents = centsPerMillion(
    rates.inputUsdPerMillion,
    'input rate',
  )
  const cachedInputCents = centsPerMillion(
    rates.cachedInputUsdPerMillion,
    'cached-input rate',
  )
  const outputCents = centsPerMillion(
    rates.outputUsdPerMillion,
    'output rate',
  )
  const cacheWriteCentsNumerator = bigintFrom(inputCents) *
    GPT_5_6_CACHE_WRITE_RATE_NUMERATOR
  if (cacheWriteCentsNumerator % GPT_5_6_CACHE_WRITE_RATE_DENOMINATOR !== 0n) {
    fail('cache-write rate is not pinned to exact cents.')
  }
  const cacheWriteCents = cacheWriteCentsNumerator /
    GPT_5_6_CACHE_WRITE_RATE_DENOMINATOR
  const uncachedInputPicodollars = bigintFrom(uncachedInputTokens) *
    bigintFrom(inputCents) * PICODOLLARS_PER_TOKEN_PER_CENT_PER_MILLION
  const cachedInputPicodollars = bigintFrom(cachedInputTokens) *
    bigintFrom(cachedInputCents) *
    PICODOLLARS_PER_TOKEN_PER_CENT_PER_MILLION
  const cacheWritePicodollars = bigintFrom(cacheWriteTokens) *
    cacheWriteCents * PICODOLLARS_PER_TOKEN_PER_CENT_PER_MILLION
  const outputPicodollars = bigintFrom(outputTokens) *
    bigintFrom(outputCents) * PICODOLLARS_PER_TOKEN_PER_CENT_PER_MILLION
  const measuredPicodollars = uncachedInputPicodollars +
    cachedInputPicodollars + cacheWritePicodollars + outputPicodollars

  return objectFreeze(record([
    ['source', 'openai-responses-usage'],
    ['policyId', policy.id],
    ['model', model],
    ['serviceTier', 'default'],
    ['contextBand', contextBand],
    ['inputTokens', inputTokens],
    ['cachedInputTokens', cachedInputTokens],
    ['cacheWriteTokens', cacheWriteTokens],
    ['uncachedInputTokens', uncachedInputTokens],
    ['outputTokens', outputTokens],
    ['reasoningTokens', reasoningTokens],
    ['totalTokens', totalTokens],
    ['inputUsdPerMillion', rates.inputUsdPerMillion],
    ['cachedInputUsdPerMillion', rates.cachedInputUsdPerMillion],
    ['cacheWriteUsdPerMillion', Number(cacheWriteCents) / 100],
    ['outputUsdPerMillion', rates.outputUsdPerMillion],
    ['uncachedInputPicodollars', stringFrom(uncachedInputPicodollars)],
    ['cachedInputPicodollars', stringFrom(cachedInputPicodollars)],
    ['cacheWritePicodollars', stringFrom(cacheWritePicodollars)],
    ['outputPicodollars', stringFrom(outputPicodollars)],
    ['measuredPicodollars', stringFrom(measuredPicodollars)],
    ['measuredUsdDecimal', usdDecimal(measuredPicodollars)],
  ]))
}

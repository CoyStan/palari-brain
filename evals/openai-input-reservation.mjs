// Provider-free primitives for counting and reserving structured OpenAI
// Responses inputs. This module deliberately owns no transport, credential,
// retry, meter, or fallback-after-dispatch behavior.

import { types as utilTypes } from 'node:util'

const arrayIsArray = Array.isArray
const arrayPrototype = Array.prototype
const bigintFrom = BigInt
const bufferByteLength = Buffer.byteLength
const jsonStringify = JSON.stringify
const numberIsFinite = Number.isFinite
const numberIsSafeInteger = Number.isSafeInteger
const objectCreate = Object.create
const objectFreeze = Object.freeze
const objectGetOwnPropertyDescriptors = Object.getOwnPropertyDescriptors
const objectGetPrototypeOf = Object.getPrototypeOf
const objectHasOwn = Object.hasOwn
const objectPrototype = Object.prototype
const objectSetPrototypeOf = Object.setPrototypeOf
const reflectOwnKeys = Reflect.ownKeys
const stringFrom = String
const stringPadStart = Function.prototype.call.bind(String.prototype.padStart)
const stringSlice = Function.prototype.call.bind(String.prototype.slice)
const utilIsProxy = utilTypes.isProxy
const weakSetAdd = Function.prototype.call.bind(WeakSet.prototype.add)
const weakSetHas = Function.prototype.call.bind(WeakSet.prototype.has)

const PICODOLLARS_PER_DOLLAR = 1_000_000_000_000n
const PICODOLLARS_PER_TOKEN_PER_CENT_PER_MILLION = 10_000n
const acceptedCountRecords = new WeakSet()

function fail(message) {
  throw new TypeError(`OpenAI input reservation: ${message}`)
}

function nullArray() {
  return objectSetPrototypeOf([], null)
}

function nullRecord() {
  return objectCreate(null)
}

function record(entries) {
  const value = nullRecord()
  for (let index = 0; index < entries.length; index += 1) {
    value[entries[index][0]] = entries[index][1]
  }
  return value
}

function seenContains(seen, value) {
  for (let index = 0; index < seen.length; index += 1) {
    if (seen[index] === value) return true
  }
  return false
}

function snapshotJson(value, seen = nullArray(), label = 'body') {
  if (value === null || typeof value === 'string' ||
    typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!numberIsFinite(value)) fail(`${label} contains a non-finite number.`)
    return value
  }
  if (!value || typeof value !== 'object') {
    fail(`${label} contains non-JSON data.`)
  }
  if (utilIsProxy(value)) fail(`${label} must not be a Proxy.`)
  if (seenContains(seen, value)) fail(`${label} contains a cycle.`)
  seen[seen.length] = value

  const descriptors = objectGetOwnPropertyDescriptors(value)
  const ownKeys = reflectOwnKeys(value)
  let snapshot
  if (arrayIsArray(value)) {
    const prototype = objectGetPrototypeOf(value)
    if (prototype !== arrayPrototype && prototype !== null) {
      fail(`${label} has a non-standard array prototype.`)
    }
    const length = descriptors.length?.value
    if (!numberIsSafeInteger(length) || length < 0 ||
      ownKeys.length !== length + 1 || ownKeys[length] !== 'length') {
      fail(`${label} must be a dense plain array.`)
    }
    snapshot = nullArray()
    for (let index = 0; index < length; index += 1) {
      if (ownKeys[index] !== `${index}`) {
        fail(`${label} must be a dense plain array.`)
      }
      const descriptor = descriptors[index]
      if (!descriptor || !objectHasOwn(descriptor, 'value') ||
        descriptor.enumerable !== true) {
        fail(`${label}[${index}] must be an enumerable data field.`)
      }
      snapshot[index] = snapshotJson(
        descriptor.value,
        seen,
        `${label}[${index}]`,
      )
    }
  } else {
    const prototype = objectGetPrototypeOf(value)
    if (prototype !== objectPrototype && prototype !== null) {
      fail(`${label} must be a plain object.`)
    }
    snapshot = nullRecord()
    for (let index = 0; index < ownKeys.length; index += 1) {
      const key = ownKeys[index]
      if (typeof key !== 'string') fail(`${label} must not have symbol keys.`)
      const descriptor = descriptors[key]
      if (!descriptor || !objectHasOwn(descriptor, 'value') ||
        descriptor.enumerable !== true) {
        fail(`${label}.${key} must be an enumerable data field.`)
      }
      snapshot[key] = snapshotJson(
        descriptor.value,
        seen,
        `${label}.${key}`,
      )
    }
  }
  seen.length -= 1
  return snapshot
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object') return value
  const descriptors = objectGetOwnPropertyDescriptors(value)
  const keys = reflectOwnKeys(value)
  for (let index = 0; index < keys.length; index += 1) {
    const descriptor = descriptors[keys[index]]
    if (descriptor && objectHasOwn(descriptor, 'value')) {
      deepFreeze(descriptor.value)
    }
  }
  return objectFreeze(value)
}

function exactKeys(value, expected, label) {
  const keys = reflectOwnKeys(value)
  if (keys.length !== expected.length) {
    fail(`${label} fields differ from the contract.`)
  }
  for (let index = 0; index < expected.length; index += 1) {
    if (!objectHasOwn(value, expected[index])) {
      fail(`${label} fields differ from the contract.`)
    }
  }
}

function positiveSafeInteger(value, label) {
  if (!numberIsSafeInteger(value) || value < 1) {
    fail(`${label} must be a positive safe integer.`)
  }
  return value
}

export function parseOpenAIInputCountResponse(response) {
  if (!response || typeof response !== 'object' || arrayIsArray(response)) {
    fail('count response must be a plain object.')
  }
  if (utilIsProxy(response)) fail('count response must not be a Proxy.')
  const prototype = objectGetPrototypeOf(response)
  if (prototype !== objectPrototype && prototype !== null) {
    fail('count response must be a plain object.')
  }
  const descriptors = objectGetOwnPropertyDescriptors(response)
  exactKeys(response, ['object', 'input_tokens'], 'count response')
  const objectDescriptor = descriptors.object
  const countDescriptor = descriptors.input_tokens
  if (!objectDescriptor || !objectHasOwn(objectDescriptor, 'value') ||
    objectDescriptor.enumerable !== true || !countDescriptor ||
    !objectHasOwn(countDescriptor, 'value') ||
    countDescriptor.enumerable !== true) {
    fail('count response fields must be enumerable data fields.')
  }
  if (objectDescriptor.value !== 'response.input_tokens') {
    fail('count response object type differs from response.input_tokens.')
  }
  const parsed = deepFreeze(record([
    ['source', 'openai-responses-input-count'],
    ['inputTokens', positiveSafeInteger(
      countDescriptor.value,
      'input_tokens',
    )],
  ]))
  weakSetAdd(acceptedCountRecords, parsed)
  return parsed
}

export function createOpenAIInputCounter({ invoke } = {}) {
  if (typeof invoke !== 'function') {
    fail('counter requires one injected invoke function.')
  }
  return objectFreeze(async function countOpenAIInput(body) {
    const immutableBody = deepFreeze(snapshotJson(body))
    const response = await invoke(immutableBody)
    return parseOpenAIInputCountResponse(response)
  })
}

export const OPENAI_SOL_STANDARD_RESERVATION_POLICY = deepFreeze(record([
  ['id', 'openai-gpt-5.6-sol-standard-2026-08-05'],
  ['longContextThresholdInputTokens', 272_000],
  ['shortContext', record([
    ['highestInputUsdPerMillion', 6.25],
    ['outputUsdPerMillion', 30],
  ])],
  ['longContext', record([
    ['highestInputUsdPerMillion', 12.5],
    ['outputUsdPerMillion', 45],
  ])],
]))

export const OPENAI_LUNA_STANDARD_RESERVATION_POLICY = deepFreeze(record([
  ['id', 'openai-gpt-5.6-luna-standard-2026-08-06'],
  ['longContextThresholdInputTokens', 272_000],
  ['shortContext', record([
    ['highestInputUsdPerMillion', 0.25],
    ['outputUsdPerMillion', 1.2],
  ])],
  ['longContext', record([
    ['highestInputUsdPerMillion', 0.5],
    ['outputUsdPerMillion', 1.8],
  ])],
]))

export const OPENAI_STANDARD_RESERVATION_POLICIES = deepFreeze(record([
  ['gpt-5.6-luna', OPENAI_LUNA_STANDARD_RESERVATION_POLICY],
  ['gpt-5.6-sol', OPENAI_SOL_STANDARD_RESERVATION_POLICY],
]))

const RATE_CENTS_PER_MILLION = deepFreeze(record([
  ['gpt-5.6-luna', record([
    ['shortContext', record([
      ['input', 25],
      ['output', 120],
    ])],
    ['longContext', record([
      ['input', 50],
      ['output', 180],
    ])],
  ])],
  ['gpt-5.6-sol', record([
    ['shortContext', record([
      ['input', 625],
      ['output', 3_000],
    ])],
    ['longContext', record([
      ['input', 1_250],
      ['output', 4_500],
    ])],
  ])],
]))

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

function reserve({ inputUnits, maxOutputTokens, source, band, model }) {
  positiveSafeInteger(inputUnits, 'input units')
  positiveSafeInteger(maxOutputTokens, 'maxOutputTokens')
  const policy = OPENAI_STANDARD_RESERVATION_POLICIES[model]
  const modelRates = RATE_CENTS_PER_MILLION[model]
  if (!policy || !modelRates) fail('model has no pinned Standard policy.')
  const rates = modelRates[band]
  const inputPicodollars = bigintFrom(inputUnits) *
    bigintFrom(rates.input) * PICODOLLARS_PER_TOKEN_PER_CENT_PER_MILLION
  const outputPicodollars = bigintFrom(maxOutputTokens) *
    bigintFrom(rates.output) * PICODOLLARS_PER_TOKEN_PER_CENT_PER_MILLION
  const reservedPicodollars = inputPicodollars + outputPicodollars
  const reservedUsdDecimal = usdDecimal(reservedPicodollars)
  return deepFreeze(record([
    ['source', source],
    ['policyId', policy.id],
    ['model', model],
    ['serviceTier', 'default'],
    ['contextBand', band === 'shortContext' ? 'short' : 'long'],
    ['inputUnits', inputUnits],
    ['maxOutputTokens', maxOutputTokens],
    ['inputUsdPerMillion', rates.input / 100],
    ['outputUsdPerMillion', rates.output / 100],
    ['inputPicodollars', stringFrom(inputPicodollars)],
    ['outputPicodollars', stringFrom(outputPicodollars)],
    ['reservedPicodollars', stringFrom(reservedPicodollars)],
    ['reservedUsdDecimal', reservedUsdDecimal],
  ]))
}

export function reserveOpenAIResponseFromExactCount({
  count,
  maxOutputTokens,
} = {}) {
  return reserveOpenAIStandardResponseFromExactCount({
    count,
    maxOutputTokens,
    model: 'gpt-5.6-sol',
  })
}

export function reserveOpenAIStandardResponseFromExactCount({
  count,
  maxOutputTokens,
  model,
} = {}) {
  if (!count || typeof count !== 'object' ||
    !weakSetHas(acceptedCountRecords, count)) {
    fail('count must be the validated record returned by this module.')
  }
  if (typeof model !== 'string' ||
    !objectHasOwn(OPENAI_STANDARD_RESERVATION_POLICIES, model)) {
    fail('model must have one exact pinned Standard policy.')
  }
  const inputTokens = count.inputTokens
  const policy = OPENAI_STANDARD_RESERVATION_POLICIES[model]
  const band = inputTokens > policy.longContextThresholdInputTokens
    ? 'longContext'
    : 'shortContext'
  return reserve({
    inputUnits: inputTokens,
    maxOutputTokens,
    source: 'provider-input-count',
    band,
    model,
  })
}

export function reserveOpenAIResponseFromUtf8Bytes({
  bodyText,
  maxOutputTokens,
} = {}) {
  if (typeof bodyText !== 'string' || bodyText.length < 1) {
    fail('bodyText must be a non-empty serialized request string.')
  }
  const inputBytes = bufferByteLength(bodyText, 'utf8')
  return reserve({
    inputUnits: inputBytes,
    maxOutputTokens,
    source: 'utf8-byte-fallback',
    band: 'longContext',
    model: 'gpt-5.6-sol',
  })
}

export function snapshotOpenAIResponseBody(body) {
  const snapshot = deepFreeze(snapshotJson(body))
  return deepFreeze(record([
    ['body', snapshot],
    ['bodyText', jsonStringify(snapshot)],
  ]))
}

// Provider-neutral orchestration for governed OpenAI Responses evaluations.
// Callers own credentials, network transports, durable ledgers, hard caps,
// settlement, and terminal sealing. This boundary owns ordering and one-shot
// operation semantics only.

import { createHash } from 'node:crypto'

import {
  createOpenAIInputCounter,
  reserveOpenAIStandardResponseFromExactCount,
  snapshotOpenAIResponseBody,
} from './openai-input-reservation.mjs'

const bigintFrom = BigInt
const bufferByteLength = Buffer.byteLength
const functionCall = Function.prototype.call
const functionBind = Function.prototype.bind
const jsonStringify = JSON.stringify
const numberIsSafeInteger = Number.isSafeInteger
const objectFreeze = Object.freeze
const objectGetPrototypeOf = Object.getPrototypeOf
const objectHasOwn = Object.hasOwn
const bindCall = functionCall.bind(functionBind, functionCall)
const hashPrototype = objectGetPrototypeOf(createHash('sha256'))
const hashDigest = bindCall(hashPrototype.digest)
const hashUpdate = bindCall(hashPrototype.update)
const regexpTest = bindCall(RegExp.prototype.test)
const setAdd = bindCall(Set.prototype.add)
const setHas = bindCall(Set.prototype.has)
const stringTrim = bindCall(String.prototype.trim)

const POSITIVE_DECIMAL_PATTERN = /^[1-9][0-9]*$/u

const SUPPORTED_MODELS = objectFreeze(new Set([
  'gpt-5.6-luna',
  'gpt-5.6-sol',
]))

export class OpenAICountedResponsesError extends Error {
  constructor(code, message, { cause } = {}) {
    super(message, cause ? { cause } : undefined)
    this.code = code
    this.name = 'OpenAICountedResponsesError'
  }
}

function fail(code, message) {
  throw new OpenAICountedResponsesError(code, message)
}

function sha256(value) {
  const hash = createHash('sha256')
  hashUpdate(hash, value)
  return hashDigest(hash, 'hex')
}

function dependency(value, label) {
  if (typeof value !== 'function') {
    fail('DEPENDENCY_INVALID', `${label} must be a function.`)
  }
  return value
}

function operation(value) {
  if (typeof value !== 'string' || value.length < 1 ||
    bufferByteLength(value, 'utf8') > 200 || stringTrim(value) !== value) {
    fail(
      'OPERATION_ID_INVALID',
      'operationId must be a trimmed non-empty string of at most 200 bytes.',
    )
  }
  return value
}

function positivePicodollars(value) {
  if (typeof value !== 'string' || !regexpTest(POSITIVE_DECIMAL_PATTERN, value)) {
    fail(
      'COUNT_RESERVATION_INVALID',
      'countAttemptPicodollars must be a positive decimal integer string.',
    )
  }
  try {
    if (bigintFrom(value) < 1n) throw new Error('non-positive')
  } catch {
    fail(
      'COUNT_RESERVATION_INVALID',
      'countAttemptPicodollars must be a positive decimal integer string.',
    )
  }
  return value
}

function validateBody(body) {
  const wire = snapshotOpenAIResponseBody(body)
  const exact = wire.body
  if (typeof exact.model !== 'string' || !setHas(SUPPORTED_MODELS, exact.model)) {
    fail('MODEL_INVALID', 'body.model must be gpt-5.6-luna or gpt-5.6-sol.')
  }
  if (exact.service_tier !== 'default') {
    fail('SERVICE_TIER_INVALID', 'body.service_tier must be default.')
  }
  if (exact.store !== false) {
    fail('STORE_INVALID', 'body.store must be false.')
  }
  if (!objectHasOwn(exact, 'max_output_tokens') ||
    !numberIsSafeInteger(exact.max_output_tokens) ||
    exact.max_output_tokens < 1) {
    fail(
      'OUTPUT_LIMIT_INVALID',
      'body.max_output_tokens must be a positive safe integer.',
    )
  }
  return wire
}

function countAttemptPlan({
  bodySha256,
  countAttemptPicodollars,
  model,
  operationId,
}) {
  return objectFreeze({
    billingTreatment: 'unknown-uncertain',
    bodySha256,
    model,
    operationId,
    reservedPicodollars: countAttemptPicodollars,
    surface: 'openai-responses-input-count',
  })
}

function responsePlan({ bodySha256, count, operationId, reservation }) {
  return objectFreeze({
    bodySha256,
    contextBand: reservation.contextBand,
    exactInputTokens: count.inputTokens,
    maxOutputTokens: reservation.maxOutputTokens,
    model: reservation.model,
    operationId,
    policyId: reservation.policyId,
    reservedPicodollars: reservation.reservedPicodollars,
    reservedUsdDecimal: reservation.reservedUsdDecimal,
    serviceTier: reservation.serviceTier,
    surface: 'openai-responses-generation',
  })
}

export function createExactCountedOpenAIResponsesEvaluator({
  beginCountReservation,
  beginResponseReservation,
  invokeCount,
  invokeResponse,
} = {}) {
  const reserveCount = dependency(
    beginCountReservation,
    'beginCountReservation',
  )
  const reserveResponse = dependency(
    beginResponseReservation,
    'beginResponseReservation',
  )
  const countTransport = dependency(invokeCount, 'invokeCount')
  const responseTransport = dependency(invokeResponse, 'invokeResponse')
  const consumedOperations = new Set()

  return objectFreeze(async function invokeExactCountedResponse({
    body,
    countAttemptPicodollars,
    operationId,
  } = {}) {
    const acceptedOperation = operation(operationId)
    if (setHas(consumedOperations, acceptedOperation)) {
      fail('OPERATION_CONSUMED', 'operationId has already been consumed.')
    }

    const wire = validateBody(body)
    const acceptedCountAllowance = positivePicodollars(
      countAttemptPicodollars,
    )
    setAdd(consumedOperations, acceptedOperation)

    const bodySha256 = sha256(wire.bodyText)
    const countPlan = countAttemptPlan({
      bodySha256,
      countAttemptPicodollars: acceptedCountAllowance,
      model: wire.body.model,
      operationId: acceptedOperation,
    })
    await reserveCount(countPlan)

    let countInvocations = 0
    const counter = createOpenAIInputCounter({
      invoke: async (countBody) => {
        countInvocations += 1
        if (countInvocations !== 1 ||
          jsonStringify(countBody) !== wire.bodyText) {
          fail(
            'COUNT_WIRE_INVALID',
            'count transport must receive the exact body exactly once.',
          )
        }
        return countTransport(objectFreeze({
          body: countBody,
          bodySha256,
          operationId: acceptedOperation,
        }))
      },
    })
    const count = await counter(wire.body)
    const reservation = reserveOpenAIStandardResponseFromExactCount({
      count,
      maxOutputTokens: wire.body.max_output_tokens,
      model: wire.body.model,
    })
    const generationPlan = responsePlan({
      bodySha256,
      count,
      operationId: acceptedOperation,
      reservation,
    })
    await reserveResponse(generationPlan)

    let responseInvocations = 0
    responseInvocations += 1
    const response = await responseTransport(objectFreeze({
      body: wire.body,
      bodySha256,
      exactInputTokens: count.inputTokens,
      operationId: acceptedOperation,
      reservation,
    }))

    const audit = objectFreeze({
      bodySha256,
      countAttempt: countPlan,
      countInvocations,
      exactInputTokens: count.inputTokens,
      generation: generationPlan,
      operationId: acceptedOperation,
      responseInvocations,
    })
    return objectFreeze({ audit, response })
  })
}

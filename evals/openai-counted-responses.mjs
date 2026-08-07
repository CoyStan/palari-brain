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
const objectKeys = Object.keys
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

// POST /v1/responses/input_tokens has an endpoint-specific request schema.
// These are the documented count fields used by the frozen evaluation body.
// Do not expand this list from the broader Responses create schema.
const COUNT_BODY_FIELDS = objectFreeze(new Set([
  'input',
  'instructions',
  'model',
  'parallel_tool_calls',
  'reasoning',
  'tool_choice',
  'tools',
]))

// These fields affect generation or response handling, but are not accepted
// by the frozen input-count endpoint contract. Every other top-level field is
// rejected so provider schema drift cannot silently change what is counted.
const GENERATION_ONLY_FIELDS = objectFreeze(new Set([
  'include',
  'max_output_tokens',
  'service_tier',
  'store',
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

export function projectOpenAIResponsesInputCountBody(body) {
  const generationWire = snapshotOpenAIResponseBody(body)
  const projected = Object.create(null)
  for (const key of objectKeys(generationWire.body)) {
    if (setHas(COUNT_BODY_FIELDS, key)) {
      projected[key] = generationWire.body[key]
    } else if (!setHas(GENERATION_ONLY_FIELDS, key)) {
      fail(
        'COUNT_FIELD_UNKNOWN',
        `body.${key} is not classified for the input-count endpoint.`,
      )
    }
  }
  for (const required of ['input', 'instructions', 'model']) {
    if (!objectHasOwn(projected, required)) {
      fail(
        'COUNT_FIELD_REQUIRED',
        `body.${required} is required by the frozen count projection.`,
      )
    }
  }
  return snapshotOpenAIResponseBody(projected)
}

function countAttemptPlan({
  countBodySha256,
  countAttemptPicodollars,
  generationBodySha256,
  model,
  operationId,
}) {
  return objectFreeze({
    billingTreatment: 'unknown-uncertain',
    countBodySha256,
    generationBodySha256,
    model,
    operationId,
    reservedPicodollars: countAttemptPicodollars,
    surface: 'openai-responses-input-count',
  })
}

function responsePlan({
  countBodySha256,
  count,
  generationBodySha256,
  operationId,
  reservation,
}) {
  return objectFreeze({
    countBodySha256,
    contextBand: reservation.contextBand,
    exactInputTokens: count.inputTokens,
    generationBodySha256,
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
    const countWire = projectOpenAIResponsesInputCountBody(wire.body)
    const acceptedCountAllowance = positivePicodollars(
      countAttemptPicodollars,
    )
    setAdd(consumedOperations, acceptedOperation)

    const generationBodySha256 = sha256(wire.bodyText)
    const countBodySha256 = sha256(countWire.bodyText)
    const countPlan = countAttemptPlan({
      countBodySha256,
      countAttemptPicodollars: acceptedCountAllowance,
      generationBodySha256,
      model: wire.body.model,
      operationId: acceptedOperation,
    })
    await reserveCount(countPlan)

    let countInvocations = 0
    const counter = createOpenAIInputCounter({
      invoke: async (countBody) => {
        countInvocations += 1
        if (countInvocations !== 1 ||
          jsonStringify(countBody) !== countWire.bodyText ||
          sha256(wire.bodyText) !== generationBodySha256) {
          fail(
            'COUNT_WIRE_INVALID',
            'count transport must receive the projected body exactly once.',
          )
        }
        return countTransport(objectFreeze({
          body: countBody,
          countBodySha256,
          generationBodySha256,
          operationId: acceptedOperation,
        }))
      },
    })
    const count = await counter(countWire.body)
    const reservation = reserveOpenAIStandardResponseFromExactCount({
      count,
      maxOutputTokens: wire.body.max_output_tokens,
      model: wire.body.model,
    })
    const generationPlan = responsePlan({
      countBodySha256,
      count,
      generationBodySha256,
      operationId: acceptedOperation,
      reservation,
    })
    await reserveResponse(generationPlan)

    let responseInvocations = 0
    responseInvocations += 1
    if (sha256(wire.bodyText) !== generationBodySha256) {
      fail('GENERATION_WIRE_DRIFT', 'generation body changed after counting.')
    }
    const response = await responseTransport(objectFreeze({
      body: wire.body,
      countBodySha256,
      exactInputTokens: count.inputTokens,
      generationBodySha256,
      operationId: acceptedOperation,
      reservation,
    }))

    const audit = objectFreeze({
      countBodySha256,
      countAttempt: countPlan,
      countInvocations,
      exactInputTokens: count.inputTokens,
      generationBodySha256,
      generation: generationPlan,
      operationId: acceptedOperation,
      responseInvocations,
    })
    return objectFreeze({ audit, response })
  })
}

import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  OPENAI_SOL_STANDARD_RESERVATION_POLICY,
  createOpenAIInputCounter,
  parseOpenAIInputCountResponse,
  reserveOpenAIResponseFromExactCount,
  reserveOpenAIResponseFromUtf8Bytes,
  snapshotOpenAIResponseBody,
} from '../evals/openai-input-reservation.mjs'

function assertDeepFrozen(value) {
  if (!value || typeof value !== 'object') return
  assert.equal(Object.isFrozen(value), true)
  for (const child of Object.values(value)) assertDeepFrozen(child)
}

function sampleBody(text = 'Use the supplied memory.') {
  return {
    model: 'gpt-5.6-sol',
    instructions: 'Answer with cited evidence.',
    input: [{ role: 'user', content: [{ type: 'input_text', text }] }],
    tools: [{
      type: 'function',
      name: 'memory_read',
      description: 'Read canonical evidence.',
      strict: true,
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
        additionalProperties: false,
      },
    }],
    max_output_tokens: 512,
    store: false,
    service_tier: 'default',
  }
}

function acceptedCount(inputTokens) {
  return parseOpenAIInputCountResponse({
    object: 'response.input_tokens',
    input_tokens: inputTokens,
  })
}

test('counter passes an immutable independent exact body to injected transport', async () => {
  const callerBody = sampleBody()
  const callerText = JSON.stringify(callerBody)
  let received
  const count = createOpenAIInputCounter({
    async invoke(body) {
      received = body
      assertDeepFrozen(body)
      assert.equal(JSON.stringify(body), callerText)
      assert.throws(() => {
        body.input[0].role = 'assistant'
      }, TypeError)
      return { object: 'response.input_tokens', input_tokens: 6_885 }
    },
  })

  const result = await count(callerBody)
  assert.notEqual(received, callerBody)
  assert.notEqual(received.input, callerBody.input)
  assert.equal(Object.getPrototypeOf(result), null)
  assert.equal(result.source, 'openai-responses-input-count')
  assert.equal(result.inputTokens, 6_885)
  assertDeepFrozen(result)
  assert.equal(callerBody.input[0].role, 'user')
})

test('count response parser fails five malformed classes closed', () => {
  const malformed = [
    { object: 'response.input_tokens' },
    { object: 'response.input_tokens', input_tokens: '6885' },
    Object.defineProperty(
      { object: 'response.input_tokens' },
      'input_tokens',
      { enumerable: true, get: () => 6_885 },
    ),
    { object: 'response.input_tokens', input_tokens: 1.5 },
    { object: 'response.input_tokens', input_tokens: 0 },
    { object: 'response.input_tokens', input_tokens: -1 },
    { object: 'response.input_tokens', input_tokens: Number.MAX_SAFE_INTEGER + 1 },
  ]
  for (const response of malformed) {
    assert.throws(() => parseOpenAIInputCountResponse(response), TypeError)
  }
  assert.throws(() => parseOpenAIInputCountResponse({
    object: 'response.input_tokens',
    input_tokens: 6_885,
    undocumented: true,
  }), TypeError)
})

test('counter transport failure is terminal and never invokes a fallback', async () => {
  let calls = 0
  const expected = new Error('transport uncertain')
  const count = createOpenAIInputCounter({
    async invoke() {
      calls += 1
      throw expected
    },
  })
  await assert.rejects(count(sampleBody()), (error) => error === expected)
  assert.equal(calls, 1)
})

test('body snapshot rejects accessors, cycles, sparse arrays, and mutation', () => {
  const accessor = sampleBody()
  Object.defineProperty(accessor, 'model', {
    enumerable: true,
    get: () => 'gpt-5.6-sol',
  })
  assert.throws(() => snapshotOpenAIResponseBody(accessor), /data field/u)

  const cyclic = sampleBody()
  cyclic.loop = cyclic
  assert.throws(() => snapshotOpenAIResponseBody(cyclic), /cycle/u)

  const sparse = sampleBody()
  sparse.input = new Array(2)
  sparse.input[1] = { role: 'user' }
  assert.throws(() => snapshotOpenAIResponseBody(sparse), /dense/u)

  const source = sampleBody()
  const snapshot = snapshotOpenAIResponseBody(source)
  source.model = 'changed-after-snapshot'
  assert.equal(snapshot.body.model, 'gpt-5.6-sol')
  assert.equal(JSON.parse(snapshot.bodyText).model, 'gpt-5.6-sol')
  assertDeepFrozen(snapshot)
})

test('exact reservation selects the pinned short and long Standard bands', () => {
  assertDeepFrozen(OPENAI_SOL_STANDARD_RESERVATION_POLICY)
  const short = reserveOpenAIResponseFromExactCount({
    count: acceptedCount(272_000),
    maxOutputTokens: 512,
  })
  const long = reserveOpenAIResponseFromExactCount({
    count: acceptedCount(272_001),
    maxOutputTokens: 512,
  })
  assert.equal(short.contextBand, 'short')
  assert.equal(short.inputUsdPerMillion, 6.25)
  assert.equal(short.outputUsdPerMillion, 30)
  assert.equal(long.contextBand, 'long')
  assert.equal(long.inputUsdPerMillion, 12.5)
  assert.equal(long.outputUsdPerMillion, 45)
  assert.equal(short.maxOutputTokens, long.maxOutputTokens)
  assert.equal(
    BigInt(short.reservedPicodollars),
    BigInt(short.inputPicodollars) + BigInt(short.outputPicodollars),
  )
  assertDeepFrozen(short)
  assertDeepFrozen(long)
})

test('UTF-8 fallback charges bytes at highest rates and full output', () => {
  const bodyText = JSON.stringify({ input: 'café 東京 🔋' })
  const reservation = reserveOpenAIResponseFromUtf8Bytes({
    bodyText,
    maxOutputTokens: 512,
  })
  assert.equal(reservation.source, 'utf8-byte-fallback')
  assert.equal(reservation.inputUnits, Buffer.byteLength(bodyText, 'utf8'))
  assert.equal(reservation.contextBand, 'long')
  assert.equal(reservation.inputUsdPerMillion, 12.5)
  assert.equal(reservation.outputUsdPerMillion, 45)
  const expected = BigInt(reservation.inputUnits) * 1_250n * 10_000n +
    512n * 4_500n * 10_000n
  assert.equal(BigInt(reservation.reservedPicodollars), expected)
})

test('fixed synthetic bank is at least three times tighter with exact counts', () => {
  const bank = [
    { body: sampleBody('x'.repeat(30_000)), exact: 6_885 },
    { body: sampleBody('東京の記憶'.repeat(3_500)), exact: 5_400 },
    { body: sampleBody(JSON.stringify(sampleBody()).repeat(35)), exact: 4_200 },
  ]
  for (const fixture of bank) {
    const wire = snapshotOpenAIResponseBody(fixture.body)
    const exact = reserveOpenAIResponseFromExactCount({
      count: acceptedCount(fixture.exact),
      maxOutputTokens: 512,
    })
    const fallback = reserveOpenAIResponseFromUtf8Bytes({
      bodyText: wire.bodyText,
      maxOutputTokens: 512,
    })
    assert.equal(exact.maxOutputTokens, fallback.maxOutputTokens)
    assert.ok(
      BigInt(fallback.reservedPicodollars) >=
        3n * BigInt(exact.reservedPicodollars),
      `${fallback.reservedUsdDecimal} was not 3x ${exact.reservedUsdDecimal}`,
    )
  }
})

test('reservation requires the module-validated count record', () => {
  for (const count of [
    undefined,
    null,
    '1',
    { source: 'openai-responses-input-count', inputTokens: 1 },
    Object.freeze(Object.assign(Object.create(null), {
      source: 'openai-responses-input-count',
      inputTokens: 1,
    })),
  ]) {
    assert.throws(() => reserveOpenAIResponseFromExactCount({
      count,
      maxOutputTokens: 512,
    }), TypeError)
  }
  assert.throws(() => reserveOpenAIResponseFromExactCount({
    count: acceptedCount(1),
    maxOutputTokens: '512',
  }), TypeError)
  assert.throws(() => reserveOpenAIResponseFromUtf8Bytes({
    bodyText: '',
    maxOutputTokens: 512,
  }), TypeError)
  assert.throws(() => reserveOpenAIResponseFromUtf8Bytes({
    bodyText: '{}',
    maxOutputTokens: '512',
  }), TypeError)
})

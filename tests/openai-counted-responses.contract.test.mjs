import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

import {
  OpenAICountedResponsesError,
  createExactCountedOpenAIResponsesEvaluator,
} from '../evals/openai-counted-responses.mjs'

function body(model = 'gpt-5.6-luna') {
  return {
    model,
    instructions: 'Use exact cited memory evidence.',
    input: [{
      role: 'user',
      content: [{ type: 'input_text', text: 'What should I pack?' }],
    }],
    tools: [{
      type: 'function',
      name: 'memory_read',
      description: 'Read one canonical memory.',
      strict: true,
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
        additionalProperties: false,
      },
    }],
    max_output_tokens: 512,
    service_tier: 'default',
    store: false,
  }
}

function dependencies(overrides = {}) {
  const events = []
  const seen = {}
  const values = {
    async beginCountReservation(plan) {
      events.push('reserve-count')
      seen.countPlan = plan
    },
    async invokeCount(request) {
      events.push('count')
      seen.countRequest = request
      return { object: 'response.input_tokens', input_tokens: 1_000 }
    },
    async beginResponseReservation(plan) {
      events.push('reserve-response')
      seen.responsePlan = plan
    },
    async invokeResponse(request) {
      events.push('response')
      seen.responseRequest = request
      return { id: 'response-1', usage: { input_tokens: 1_000 } }
    },
    ...overrides,
  }
  return { events, seen, values }
}

function create(overrides) {
  const run = dependencies(overrides)
  return {
    ...run,
    invoke: createExactCountedOpenAIResponsesEvaluator(run.values),
  }
}

test('durable count and exact generation reservations strictly precede transports', async () => {
  const run = create()
  const source = body()
  const sourceText = JSON.stringify(source)
  const terminal = await run.invoke({
    body: source,
    countAttemptPicodollars: '50000000000',
    operationId: 'question-11-answer-1',
  })

  assert.deepEqual(run.events, [
    'reserve-count',
    'count',
    'reserve-response',
    'response',
  ])
  assert.equal(JSON.stringify(run.seen.countRequest.body), sourceText)
  assert.equal(JSON.stringify(run.seen.responseRequest.body), sourceText)
  assert.equal(run.seen.countPlan.bodySha256, run.seen.responsePlan.bodySha256)
  assert.equal(run.seen.countPlan.billingTreatment, 'unknown-uncertain')
  assert.equal(run.seen.countPlan.reservedPicodollars, '50000000000')
  assert.equal(run.seen.responsePlan.exactInputTokens, 1_000)
  assert.equal(run.seen.responsePlan.model, 'gpt-5.6-luna')
  assert.equal(run.seen.responsePlan.reservedUsdDecimal, '0.0008644')
  assert.equal(terminal.audit.countInvocations, 1)
  assert.equal(terminal.audit.responseInvocations, 1)
  assert.equal(terminal.response.id, 'response-1')
  assert.equal(Object.isFrozen(terminal), true)
  assert.equal(Object.isFrozen(terminal.audit), true)
  assert.equal(Object.isFrozen(terminal.audit.countAttempt), true)
  assert.equal(Object.isFrozen(terminal.audit.generation), true)
  assert.equal(source.model, 'gpt-5.6-luna')
})

test('both transports receive immutable independent snapshots', async () => {
  const source = body()
  const original = JSON.stringify(source)
  const run = create({
    async beginCountReservation(plan) {
      assert.throws(() => { plan.model = 'changed' }, TypeError)
      source.model = 'changed-after-snapshot'
    },
    async invokeCount(request) {
      assert.equal(JSON.stringify(request.body), original)
      assert.throws(() => { request.body.model = 'changed' }, TypeError)
      return { object: 'response.input_tokens', input_tokens: 1_000 }
    },
    async beginResponseReservation(plan) {
      assert.throws(() => { plan.exactInputTokens = 0 }, TypeError)
    },
    async invokeResponse(request) {
      assert.equal(JSON.stringify(request.body), original)
      assert.throws(() => { request.body.input[0].role = 'assistant' }, TypeError)
      return { ok: true }
    },
  })
  await run.invoke({
    body: source,
    countAttemptPicodollars: '1',
    operationId: 'immutable-operation',
  })
})

test('operation IDs are consumed before reservation and cannot be reused', async () => {
  let reservations = 0
  const run = create({
    async beginCountReservation() {
      reservations += 1
      if (reservations === 1) throw new Error('durable ledger unavailable')
    },
  })
  const args = {
    body: body(),
    countAttemptPicodollars: '1',
    operationId: 'single-use',
  }
  await assert.rejects(run.invoke(args), /durable ledger unavailable/u)
  await assert.rejects(
    run.invoke(args),
    (error) => error instanceof OpenAICountedResponsesError &&
      error.code === 'OPERATION_CONSUMED',
  )
  assert.equal(reservations, 1)
  assert.deepEqual(run.events, [])
})

test('count failures and malformed responses never reach generation', async () => {
  for (const invokeCount of [
    async () => { throw new Error('count transport uncertain') },
    async () => ({ object: 'response.input_tokens', input_tokens: '1000' }),
  ]) {
    let responses = 0
    const run = create({
      invokeCount,
      async invokeResponse() { responses += 1 },
    })
    await assert.rejects(run.invoke({
      body: body(),
      countAttemptPicodollars: '1',
      operationId: 'count-failure',
    }))
    assert.equal(responses, 0)
  }
})

test('generation reservation failure consumes count but prevents generation', async () => {
  let countCalls = 0
  let responseCalls = 0
  const run = create({
    async invokeCount() {
      countCalls += 1
      return { object: 'response.input_tokens', input_tokens: 1_000 }
    },
    async beginResponseReservation() {
      throw new Error('cap exceeded')
    },
    async invokeResponse() { responseCalls += 1 },
  })
  await assert.rejects(run.invoke({
    body: body(),
    countAttemptPicodollars: '1',
    operationId: 'cap-stop',
  }), /cap exceeded/u)
  assert.equal(countCalls, 1)
  assert.equal(responseCalls, 0)
})

test('generation transport failure dispatches once and never retries', async () => {
  let responseCalls = 0
  const expected = new Error('generation uncertain')
  const run = create({
    async invokeResponse() {
      responseCalls += 1
      throw expected
    },
  })
  await assert.rejects(run.invoke({
    body: body(),
    countAttemptPicodollars: '1',
    operationId: 'generation-failure',
  }), (error) => error === expected)
  assert.equal(responseCalls, 1)
})

test('Luna long context and Sol compatibility preserve pinned math', async () => {
  for (const fixture of [
    { model: 'gpt-5.6-luna', count: 300_000, usd: '0.1509216' },
    { model: 'gpt-5.6-sol', count: 1_000, usd: '0.02161' },
  ]) {
    let plan
    const run = create({
      async invokeCount() {
        return {
          object: 'response.input_tokens',
          input_tokens: fixture.count,
        }
      },
      async beginResponseReservation(value) { plan = value },
    })
    await run.invoke({
      body: body(fixture.model),
      countAttemptPicodollars: '1',
      operationId: `policy-${fixture.model}`,
    })
    assert.equal(plan.reservedUsdDecimal, fixture.usd)
  }
})

test('invalid operation, allowance, model, tier, store, and output fail pre-dispatch', async () => {
  const mutations = [
    { operationId: ' bad', countAttemptPicodollars: '1', body: body() },
    { operationId: 'bad-allowance', countAttemptPicodollars: '0', body: body() },
    { operationId: 'bad-model', countAttemptPicodollars: '1', body: body('gpt-5.6-terra') },
    { operationId: 'bad-tier', countAttemptPicodollars: '1', body: { ...body(), service_tier: 'fast' } },
    { operationId: 'bad-store', countAttemptPicodollars: '1', body: { ...body(), store: true } },
    { operationId: 'bad-output', countAttemptPicodollars: '1', body: { ...body(), max_output_tokens: 0 } },
  ]
  for (const args of mutations) {
    const run = create()
    await assert.rejects(run.invoke(args), OpenAICountedResponsesError)
    assert.deepEqual(run.events, [])
  }
})

test('captured crypto methods keep body hashes authentic after prototype poisoning', async () => {
  const source = body()
  const expected = createHash('sha256')
    .update(JSON.stringify(source))
    .digest('hex')
  const hashPrototype = Object.getPrototypeOf(createHash('sha256'))
  const originalUpdate = hashPrototype.update
  const originalDigest = hashPrototype.digest
  try {
    hashPrototype.update = function poisonedUpdate() { return this }
    hashPrototype.digest = () => 'a'.repeat(64)
    const run = create()
    const terminal = await run.invoke({
      body: source,
      countAttemptPicodollars: '1',
      operationId: 'authentic-hash',
    })
    assert.equal(terminal.audit.bodySha256, expected)
    assert.notEqual(terminal.audit.bodySha256, 'a'.repeat(64))
    assert.equal(run.seen.countPlan.bodySha256, expected)
    assert.equal(run.seen.responsePlan.bodySha256, expected)
  } finally {
    hashPrototype.update = originalUpdate
    hashPrototype.digest = originalDigest
  }
})

test('captured decimal validation rejects signed allowance after prototype poisoning', async () => {
  const originalTest = RegExp.prototype.test
  try {
    RegExp.prototype.test = () => true
    const run = create()
    await assert.rejects(
      run.invoke({
        body: body(),
        countAttemptPicodollars: '+1',
        operationId: 'signed-allowance',
      }),
      (error) => error instanceof OpenAICountedResponsesError &&
        error.code === 'COUNT_RESERVATION_INVALID',
    )
    assert.deepEqual(run.events, [])
  } finally {
    RegExp.prototype.test = originalTest
  }
})

test('operation ID limit is enforced in UTF-8 bytes before dispatch', async () => {
  const run = create()
  await assert.rejects(
    run.invoke({
      body: body(),
      countAttemptPicodollars: '1',
      operationId: '界'.repeat(100),
    }),
    (error) => error instanceof OpenAICountedResponsesError &&
      error.code === 'OPERATION_ID_INVALID',
  )
  assert.deepEqual(run.events, [])
})

test('factory requires every injected ledger and transport dependency', () => {
  for (const missing of [
    'beginCountReservation',
    'beginResponseReservation',
    'invokeCount',
    'invokeResponse',
  ]) {
    const values = dependencies().values
    values[missing] = null
    assert.throws(
      () => createExactCountedOpenAIResponsesEvaluator(values),
      OpenAICountedResponsesError,
    )
  }
})

test('integration module owns no environment, credential, filesystem, or network client', async () => {
  const source = await readFile(
    new URL('../evals/openai-counted-responses.mjs', import.meta.url),
    'utf8',
  )
  for (const forbidden of [
    'process.env',
    'OPENAI_API_KEY',
    'node:fs',
    'globalThis.fetch',
    'api.openai.com',
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden)
  }
})

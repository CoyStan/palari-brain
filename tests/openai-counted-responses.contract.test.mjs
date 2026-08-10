import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

import {
  MEMORY_ANSWER_RECOMMENDED_MAX_OUTPUT_TOKENS,
  MEMORY_RETRIEVAL_INSTRUCTIONS,
  MEMORY_RETRIEVAL_TOOLS,
  memoryAnswerSystemInstruction,
} from '../src/index.mjs'
import { createOpenAIRetrievalProvider } from '../src/openai.mjs'
import {
  MEMORY_RETRIEVAL_FINALIZATION_INSTRUCTIONS,
} from '../src/retrieval-answer.mjs'
import {
  OpenAICountedResponsesError,
  createExactCountedOpenAIResponsesEvaluator,
  projectOpenAIResponsesInputCountBody,
} from '../evals/openai-counted-responses.mjs'

const BRN0025_COMPATIBILITY_TRANSCRIPT_SHA256 =
  '1aa4e36c8cfb15713fd41724c084d7403fc47de10987a813216647507cf9b24e'
const BRN0025_COMPATIBILITY_GENERATION_SHA256 =
  '978a57073547d04b61d5b0813e5db2faef797cc33b6a477b047d1eded41850d8'
const BRN0025_COMPATIBILITY_COUNT_SHA256 =
  'd77ba2aaa9521a0c3445ca73e1112955e7bc26fd5eb61a1dd5dd7ce76561838d'
const BRN0025_COMPATIBILITY_GENERATION_BYTES = 11_593
const BRN0025_COMPATIBILITY_COUNT_BYTES = 11_488
const ACTIVE_ANSWER_WIRE_GENERATION_BYTES = 12_016
const ACTIVE_ANSWER_WIRE_GENERATION_SHA256 =
  'f11d91947c70e2704b18ceb4159aa2ba2d1aa69ee7cd051e96b6c34ccbd9a4c6'
const ACTIVE_ANSWER_WIRE_COUNT_BYTES = 11_911
const ACTIVE_ANSWER_WIRE_COUNT_SHA256 =
  '1ca7da65c501e9c07618b8f0620f39fac2921d5eade97f7ad819737349c507c0'
const BRN0025_OBSERVED_400 = Object.freeze({
  bodySha256: BRN0025_COMPATIBILITY_GENERATION_SHA256,
  error: Object.freeze({
    code: 'unknown_parameter',
    message: "Unknown parameter: 'include'.",
    param: 'include',
    type: 'invalid_request_error',
  }),
  status: 400,
  transcriptSha256: BRN0025_COMPATIBILITY_TRANSCRIPT_SHA256,
})

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

async function activeAnswerWireBody() {
  const stop = new Error('captured active answer wire body')
  let captured
  const provider = createOpenAIRetrievalProvider({
    async invoke({ body: request }) {
      captured = { ...request, service_tier: 'default' }
      throw stop
    },
    maxModelDispatches: 7,
    model: 'gpt-5.6-luna',
    reasoningEffort: 'low',
  })
  await assert.rejects(provider({
    answerEvidenceCount: () => 0,
    answerInstructions: MEMORY_RETRIEVAL_INSTRUCTIONS,
    async commitAnswer() {},
    memoryText: '',
    maxRetrievalCalls: 4,
    maxRetrievalPlanningCalls: 1,
    questionText: [
      'Question date: 2026-07-30T00:01:00.000Z',
      'Question: Use memory_search to find the stored compatibility color. What is it?',
    ].join('\n'),
    recommendedMaxOutputTokens: MEMORY_ANSWER_RECOMMENDED_MAX_OUTPUT_TOKENS,
    retrievalFinalizationInstructions:
      MEMORY_RETRIEVAL_FINALIZATION_INSTRUCTIONS,
    retrievalTools: MEMORY_RETRIEVAL_TOOLS,
    async retrieve() {},
    systemInstruction: memoryAnswerSystemInstruction,
  }), (error) => error === stop)
  return captured
}

function body(model = 'gpt-5.6-luna') {
  return {
    include: ['reasoning.encrypted_content'],
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
    parallel_tool_calls: false,
    reasoning: { effort: 'low' },
    tool_choice: 'auto',
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
  const projectedText = JSON.stringify(
    projectOpenAIResponsesInputCountBody(source).body,
  )
  assert.equal(JSON.stringify(run.seen.countRequest.body), projectedText)
  assert.equal(JSON.stringify(run.seen.responseRequest.body), sourceText)
  assert.notEqual(
    run.seen.countPlan.countBodySha256,
    run.seen.countPlan.generationBodySha256,
  )
  assert.equal(
    run.seen.countPlan.countBodySha256,
    run.seen.responsePlan.countBodySha256,
  )
  assert.equal(
    run.seen.countPlan.generationBodySha256,
    run.seen.responsePlan.generationBodySha256,
  )
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
      assert.deepEqual(Object.keys(request.body), [
        'model',
        'instructions',
        'input',
        'tools',
        'parallel_tool_calls',
        'reasoning',
        'tool_choice',
      ])
      assert.equal(request.body.include, undefined)
      assert.equal(request.body.max_output_tokens, undefined)
      assert.equal(request.body.service_tier, undefined)
      assert.equal(request.body.store, undefined)
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

test('BRN-0025 body projects only documented count fields without nested drift', () => {
  const source = body()
  const original = JSON.stringify(source)
  const wire = projectOpenAIResponsesInputCountBody(source)

  assert.deepEqual(Object.keys(wire.body), [
    'model',
    'instructions',
    'input',
    'tools',
    'parallel_tool_calls',
    'reasoning',
    'tool_choice',
  ])
  for (const key of [
    'input',
    'instructions',
    'model',
    'parallel_tool_calls',
    'reasoning',
    'tool_choice',
    'tools',
  ]) {
    assert.equal(JSON.stringify(wire.body[key]), JSON.stringify(source[key]))
  }
  for (const key of [
    'include',
    'max_output_tokens',
    'service_tier',
    'store',
  ]) {
    assert.equal(Object.hasOwn(wire.body, key), false)
  }
  assert.equal(JSON.stringify(source), original)
  assert.equal(Object.isFrozen(wire.body), true)
  assert.equal(Object.isFrozen(wire.body.input[0].content), true)
})

test('observed include 400 is repaired while unknown fields fail closed', async () => {
  const observedError = {
    error: {
      code: 'unknown_parameter',
      message: "Unknown parameter: 'include'.",
      param: 'include',
      type: 'invalid_request_error',
    },
  }
  const run = create({
    async invokeCount(request) {
      assert.equal(Object.hasOwn(request.body, observedError.error.param), false)
      return { object: 'response.input_tokens', input_tokens: 1_000 }
    },
  })
  await run.invoke({
    body: body(),
    countAttemptPicodollars: '1',
    operationId: 'repaired-include-400',
  })

  const unknown = create()
  await assert.rejects(
    unknown.invoke({
      body: { ...body(), undocumented_future_field: true },
      countAttemptPicodollars: '1',
      operationId: 'unknown-count-field',
    }),
    (error) => error instanceof OpenAICountedResponsesError &&
      error.code === 'COUNT_FIELD_UNKNOWN',
  )
  assert.deepEqual(unknown.events, [])
})

test('active answer wire projects once without rewriting consumed BRN-0025 pins', async () => {
  const source = await activeAnswerWireBody()
  const generationText = JSON.stringify(source)
  const projection = projectOpenAIResponsesInputCountBody(source)
  const original = structuredClone(source)

  assert.equal(Buffer.byteLength(generationText),
    ACTIVE_ANSWER_WIRE_GENERATION_BYTES)
  assert.equal(sha256(generationText),
    ACTIVE_ANSWER_WIRE_GENERATION_SHA256)
  assert.equal(Buffer.byteLength(projection.bodyText),
    ACTIVE_ANSWER_WIRE_COUNT_BYTES)
  assert.equal(sha256(projection.bodyText), ACTIVE_ANSWER_WIRE_COUNT_SHA256)
  assert.equal(BRN0025_COMPATIBILITY_GENERATION_BYTES, 11_593)
  assert.equal(BRN0025_COMPATIBILITY_COUNT_BYTES, 11_488)
  assert.equal(source.tools.length, 7)
  assert.deepEqual(source.tools.map(({ name }) => name), [
    'memory_timeline',
    'memory_read',
    'memory_find',
    'memory_plan',
    'memory_search',
    'memory_graph',
    'palari_answer_commit',
  ])
  assert.deepEqual(BRN0025_OBSERVED_400, {
    bodySha256: BRN0025_COMPATIBILITY_GENERATION_SHA256,
    error: {
      code: 'unknown_parameter',
      message: "Unknown parameter: 'include'.",
      param: 'include',
      type: 'invalid_request_error',
    },
    status: 400,
    transcriptSha256: BRN0025_COMPATIBILITY_TRANSCRIPT_SHA256,
  })
  for (const key of [
    'input',
    'instructions',
    'model',
    'parallel_tool_calls',
    'reasoning',
    'tool_choice',
    'tools',
  ]) {
    assert.equal(
      JSON.stringify(projection.body[key]),
      JSON.stringify(source[key]),
      key,
    )
  }
  for (const key of [
    'include',
    'max_output_tokens',
    'service_tier',
    'store',
  ]) {
    assert.equal(Object.hasOwn(projection.body, key), false, key)
  }

  let countCalls = 0
  let generationCalls = 0
  const run = create({
    async invokeCount(request) {
      countCalls += 1
      assert.equal(JSON.stringify(request.body), projection.bodyText)
      assert.equal(request.countBodySha256,
        ACTIVE_ANSWER_WIRE_COUNT_SHA256)
      assert.equal(request.generationBodySha256,
        ACTIVE_ANSWER_WIRE_GENERATION_SHA256)
      return { object: 'response.input_tokens', input_tokens: 2_766 }
    },
    async invokeResponse(request) {
      generationCalls += 1
      assert.equal(JSON.stringify(request.body), generationText)
      assert.equal(request.countBodySha256,
        ACTIVE_ANSWER_WIRE_COUNT_SHA256)
      assert.equal(request.generationBodySha256,
        ACTIVE_ANSWER_WIRE_GENERATION_SHA256)
      return { id: 'exact-compatibility-generation' }
    },
  })
  const terminal = await run.invoke({
    body: source,
    countAttemptPicodollars: '50000000000',
    operationId: 'exact-brn0025-compatibility',
  })
  assert.equal(countCalls, 1)
  assert.equal(generationCalls, 1)
  assert.equal(terminal.audit.countBodySha256,
    ACTIVE_ANSWER_WIRE_COUNT_SHA256)
  assert.equal(terminal.audit.generationBodySha256,
    ACTIVE_ANSWER_WIRE_GENERATION_SHA256)
  assert.deepEqual(source, original)
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
  const expectedCount = createHash('sha256')
    .update(projectOpenAIResponsesInputCountBody(source).bodyText)
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
    assert.equal(terminal.audit.generationBodySha256, expected)
    assert.equal(terminal.audit.countBodySha256, expectedCount)
    assert.notEqual(terminal.audit.generationBodySha256, 'a'.repeat(64))
    assert.equal(run.seen.countPlan.generationBodySha256, expected)
    assert.equal(run.seen.responsePlan.generationBodySha256, expected)
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

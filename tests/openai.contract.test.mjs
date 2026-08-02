import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  MEMORY_RETRIEVAL_TOOLS,
  answerWithRetrieval,
  buildMemoryReductionRequest,
  createPalariBrain,
  ingestChatTurn,
} from '../src/index.mjs'
import {
  OPENAI_DEFAULT_REASONING_EFFORT,
  OPENAI_GRAPH_RESPONSE_SCHEMA,
  OPENAI_LUNA_MODEL,
  OPENAI_MEMORY_REDUCER_RESPONSE_SCHEMA,
  OPENAI_RESPONSES_URL,
  OpenAIResponsesError,
  buildOpenAIFunctionTools,
  buildOpenAIResponsesRequest,
  buildOpenAIStructuredOutputBody,
  createOpenAIGraphExtractor,
  createOpenAIMemoryReducer,
  createOpenAIRetrievalProvider,
  createOpenAIResponsesTransport,
} from '../src/openai.mjs'

function completedText(text) {
  return {
    output: [{
      content: [{ text, type: 'output_text' }],
      role: 'assistant',
      type: 'message',
    }],
    status: 'completed',
  }
}

function completedCall({
  arguments: args = '{}',
  callId = 'call_1',
  name = 'memory_timeline',
} = {}) {
  return {
    output: [{
      content: [],
      encrypted_content: 'encrypted_reasoning_fixture',
      id: 'rs_1',
      summary: [],
      type: 'reasoning',
    }, {
      arguments: args,
      call_id: callId,
      id: 'fc_1',
      name,
      type: 'function_call',
    }],
    status: 'completed',
  }
}

function answerSession(overrides = {}) {
  return {
    answerInstructions: 'Use only supplied memory.',
    memoryText: 'Digest: user likes tea.',
    questionText: 'Question: What does the user like?',
    recommendedMaxOutputTokens: 512,
    retrievalTools: MEMORY_RETRIEVAL_TOOLS,
    async retrieve() {
      return { sessions: [] }
    },
    systemInstruction: 'You answer memory questions.',
    ...overrides,
  }
}

function reductionRequest() {
  return buildMemoryReductionRequest({
    baseRevision: 0,
    evidence: [{
      id: 'evidence-1',
      observedAt: '2026-08-02T00:00:00.000Z',
      speaker: 'user',
      text: 'I like jasmine tea.',
    }],
    prior: [],
  })
}

function reducerProposal(quote = 'I like jasmine tea.') {
  return {
    actions: [{
      basis: [{
        id: 'evidence-1',
        kind: 'evidence',
        quote,
      }],
      epistemic: 'asserted',
      op: 'add',
      relation: null,
      statement: 'The user likes jasmine tea.',
      targetIds: [],
      timeBasis: null,
      topic: 'tea preference',
    }],
    baseRevision: 0,
    dispositions: [{
      evidenceId: 'evidence-1',
      outcome: 'used',
    }],
  }
}

test('OpenAI adapter imports inertly with the documented Luna binding', () => {
  assert.equal(OPENAI_LUNA_MODEL, 'gpt-5.6-luna')
  assert.equal(OPENAI_RESPONSES_URL, 'https://api.openai.com/v1/responses')
  assert.equal(OPENAI_DEFAULT_REASONING_EFFORT, 'low')
})

test('OpenAI function mapping preserves provider-neutral schemas', () => {
  const canonical = structuredClone(MEMORY_RETRIEVAL_TOOLS)
  const mapped = buildOpenAIFunctionTools(MEMORY_RETRIEVAL_TOOLS)
  const read = mapped.find(({ name }) => name === 'memory_read')

  assert.deepEqual(MEMORY_RETRIEVAL_TOOLS, canonical)
  assert.equal(mapped.length, MEMORY_RETRIEVAL_TOOLS.length)
  assert.ok(mapped.every(({ strict, type }) =>
    strict === false && type === 'function'))
  assert.notEqual(
    read.parameters,
    MEMORY_RETRIEVAL_TOOLS.find(({ name }) => name === 'memory_read')
      .parameters,
  )
  assert.deepEqual(
    read.parameters,
    MEMORY_RETRIEVAL_TOOLS.find(({ name }) => name === 'memory_read')
      .parameters,
  )
  assert.equal(read.parameters.anyOf.length, 2)
  assert.throws(() => buildOpenAIFunctionTools([]), /non-empty array/)
})

test('OpenAI request keeps the key in one header and enforces no-store', () => {
  const apiKey = 'offline-openai-key-value'
  const body = {
    input: 'hello',
    model: OPENAI_LUNA_MODEL,
    store: false,
  }
  const request = buildOpenAIResponsesRequest({ apiKey, body })

  assert.equal(request.url, OPENAI_RESPONSES_URL)
  assert.equal(request.init.method, 'POST')
  assert.equal(request.init.headers.authorization, `Bearer ${apiKey}`)
  assert.equal(request.init.headers['content-type'], 'application/json')
  assert.equal(request.url.includes(apiKey), false)
  assert.equal(request.init.body.includes(apiKey), false)
  assert.deepEqual(JSON.parse(request.init.body), body)
  assert.throws(
    () => buildOpenAIResponsesRequest({
      apiKey,
      body: { model: OPENAI_LUNA_MODEL, store: true },
    }),
    /store to false/,
  )
})

test('OpenAI transport is one-shot, bounded, and does not echo credentials',
  async () => {
    const apiKey = 'offline-transport-secret'
    const calls = []
    const transport = createOpenAIResponsesTransport({
      apiKey,
      async fetchImpl(url, init) {
        calls.push({ init, url })
        return {
          headers: { get: () => 'req_test' },
          ok: true,
          status: 200,
          async text() {
            return JSON.stringify(completedText('ok'))
          },
        }
      },
    })
    const response = await transport({
      body: { input: 'hello', model: OPENAI_LUNA_MODEL, store: false },
    })

    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, OPENAI_RESPONSES_URL)
    assert.equal(calls[0].init.headers.authorization, `Bearer ${apiKey}`)
    assert.equal(response.output[0].content[0].text, 'ok')

    const failed = createOpenAIResponsesTransport({
      apiKey,
      async fetchImpl() {
        throw new Error(`request contained ${apiKey}`)
      },
    })
    await assert.rejects(
      failed({
        body: { input: 'hello', model: OPENAI_LUNA_MODEL, store: false },
      }),
      (error) => {
        assert.equal(error.code, 'OPENAI_TRANSPORT_FAILED')
        assert.equal(String(error).includes(apiKey), false)
        assert.equal(error.cause, undefined)
        return true
      },
    )

    assert.throws(
      () => createOpenAIResponsesTransport({
        apiKey,
        maxResponseBytes: 4 * 1024 * 1024 + 1,
      }),
      /maxResponseBytes cannot exceed 4194304/,
    )

    const oversized = createOpenAIResponsesTransport({
      apiKey,
      async fetchImpl() {
        let read = false
        return {
          body: {
            getReader() {
              return {
                async cancel() {},
                async read() {
                  if (read) return { done: true }
                  read = true
                  return {
                    done: false,
                    value: new TextEncoder().encode('12345'),
                  }
                },
              }
            },
          },
          ok: true,
          status: 200,
        }
      },
      maxResponseBytes: 4,
    })
    await assert.rejects(
      oversized({
        body: { input: 'hello', model: OPENAI_LUNA_MODEL, store: false },
      }),
      (error) => error.code === 'OPENAI_RESPONSE_TOO_LARGE',
    )
  })

test('retrieval provider preserves reasoning and tool output across Responses',
  async () => {
    const bodies = []
    const retrievals = []
    const provider = createOpenAIRetrievalProvider({
      async invoke({ body }) {
        bodies.push(body)
        return bodies.length === 1
          ? completedCall({
              arguments: '{"limit":2}',
              name: 'memory_timeline',
            })
          : completedText('The user likes jasmine tea.')
      },
    })
    const result = await provider(answerSession({
      async retrieve(request) {
        retrievals.push(request)
        return { sessions: [{ id: 'session-1' }] }
      },
    }))

    assert.deepEqual(result, {
      abstained: false,
      text: 'The user likes jasmine tea.',
    })
    assert.deepEqual(retrievals, [{
      input: { limit: 2 },
      tool: 'memory_timeline',
    }])
    assert.equal(bodies.length, 2)
    assert.equal(bodies[0].model, OPENAI_LUNA_MODEL)
    assert.equal(bodies[0].store, false)
    assert.deepEqual(bodies[0].reasoning, { effort: 'low' })
    assert.deepEqual(bodies[0].include, ['reasoning.encrypted_content'])
    assert.equal(bodies[0].parallel_tool_calls, false)
    assert.equal(bodies[0].tools.length, MEMORY_RETRIEVAL_TOOLS.length)
    assert.deepEqual(bodies[1].input.slice(1, 3),
      completedCall({
        arguments: '{"limit":2}',
        name: 'memory_timeline',
      }).output)
    assert.equal(
      bodies[1].input[1].encrypted_content,
      'encrypted_reasoning_fixture',
    )
    assert.deepEqual(bodies[1].input[3], {
      call_id: 'call_1',
      output: JSON.stringify({ sessions: [{ id: 'session-1' }] }),
      type: 'function_call_output',
    })
  })

test('OpenAI retrieval provider composes with the real bounded answer path',
  async (t) => {
    const root = await mkdtemp(join(tmpdir(), 'palari-openai-answer-'))
    const brain = await createPalariBrain({
      memoryEnabled: true,
      statePath: join(root, 'state.json'),
      workspaceId: 'openai-answer',
    })
    t.after(async () => {
      brain.close()
      await rm(root, { force: true, recursive: true })
    })
    const scope = { palariId: 'palari', userId: 'user' }
    await ingestChatTurn(brain, {
      ...scope,
      assistantMessage: 'I will remember that.',
      eventAt: '2026-08-02T00:00:00.000Z',
      retention: 'durable',
      sourceMessageId: 'tea:0',
      userMessage: 'I like jasmine tea.',
    })
    let dispatches = 0
    const provider = createOpenAIRetrievalProvider({
      async invoke() {
        dispatches += 1
        return dispatches === 1
          ? completedCall({
              arguments: '{"phrase":"jasmine"}',
              name: 'memory_find',
            })
          : completedText('You like jasmine tea.')
      },
    })

    const result = await answerWithRetrieval(brain, {
      ...scope,
      provider,
      question: 'Which tea do I like?',
    })
    assert.equal(result.answer, 'You like jasmine tea.')
    assert.equal(result.retrievalCalls, 1)
    assert.equal(result.consultedEvidenceIds.length, 1)
    assert.equal(result.retrievalTranscript[0].tool, 'memory_find')
  })

test('retrieval provider fails closed on unknown calls, refusals, and caps',
  async () => {
    let retrieveCalls = 0
    const unknown = createOpenAIRetrievalProvider({
      async invoke() {
        return completedCall({ name: 'delete_everything' })
      },
    })
    await assert.rejects(
      unknown(answerSession({
        async retrieve() {
          retrieveCalls += 1
        },
      })),
      (error) => error.code === 'OPENAI_FUNCTION_UNKNOWN',
    )
    assert.equal(retrieveCalls, 0)

    const refusal = createOpenAIRetrievalProvider({
      async invoke() {
        return {
          output: [{
            content: [{ refusal: 'no', type: 'refusal' }],
            role: 'assistant',
            type: 'message',
          }],
          status: 'completed',
        }
      },
    })
    await assert.rejects(
      refusal(answerSession()),
      (error) => error.code === 'OPENAI_RESPONSE_REFUSED',
    )

    const capped = createOpenAIRetrievalProvider({
      async invoke() {
        return completedCall()
      },
      maxModelDispatches: 1,
    })
    await assert.rejects(
      capped(answerSession()),
      (error) => error.code === 'OPENAI_MODEL_DISPATCH_BUDGET_EXHAUSTED',
    )
    assert.throws(
      () => createOpenAIRetrievalProvider({
        async invoke() {},
        maxModelDispatches: 8,
      }),
      /maxModelDispatches cannot exceed 7/,
    )

    const malformed = createOpenAIRetrievalProvider({
      async invoke() {
        return completedCall({ arguments: '{' })
      },
    })
    await assert.rejects(
      malformed(answerSession()),
      (error) => error.code === 'OPENAI_FUNCTION_ARGUMENTS_INVALID',
    )

    const incomplete = createOpenAIRetrievalProvider({
      async invoke() {
        return {
          incomplete_details: { reason: 'max_output_tokens' },
          output: [],
          status: 'incomplete',
        }
      },
    })
    await assert.rejects(
      incomplete(answerSession()),
      (error) => error.code === 'OPENAI_RESPONSE_INCOMPLETE',
    )

    const empty = createOpenAIRetrievalProvider({
      async invoke() {
        return { output: [], status: 'completed' }
      },
    })
    await assert.rejects(
      empty(answerSession()),
      (error) => error.code === 'OPENAI_RESPONSE_TEXT_MISSING',
    )
  })

test('structured output wire uses strict root-object JSON schema', () => {
  const body = buildOpenAIStructuredOutputBody({
    input: { hello: 'world' },
    instructions: 'Return the object.',
    maxOutputTokens: 100,
    name: 'test_schema',
    schema: {
      additionalProperties: false,
      properties: { answer: { type: 'string' } },
      required: ['answer'],
      type: 'object',
    },
  })

  assert.equal(body.model, OPENAI_LUNA_MODEL)
  assert.equal(body.store, false)
  assert.deepEqual(body.reasoning, { effort: 'low' })
  assert.equal(body.text.format.type, 'json_schema')
  assert.equal(body.text.format.strict, true)
  assert.equal(body.text.format.schema.type, 'object')
  assert.deepEqual(JSON.parse(body.input[0].content), { hello: 'world' })
  assert.throws(
    () => buildOpenAIStructuredOutputBody({
      input: {},
      instructions: 'x',
      maxOutputTokens: 1,
      name: 'bad name',
      schema: { type: 'object' },
    }),
    /schema name is invalid/,
  )
})

test('OpenAI reducer uses host normalization and one distinct repair',
  async () => {
    const calls = []
    const repairs = []
    const reducer = createOpenAIMemoryReducer({
      async invoke({ attempt, body }) {
        calls.push({ attempt, body })
        return completedText(JSON.stringify(
          attempt === 0
            ? reducerProposal('I like tea.')
            : reducerProposal(),
        ))
      },
      onRepair(event) {
        repairs.push(event)
      },
    })
    const result = await reducer({
      request: reductionRequest(),
      unit: { id: 'unit-1' },
    })

    assert.equal(calls.length, 2)
    assert.deepEqual(calls.map(({ attempt }) => attempt), [0, 1])
    assert.notDeepEqual(calls[0].body.input, calls[1].body.input)
    const repairInput = JSON.parse(calls[1].body.input[0].content)
    assert.match(repairInput.rejection.reason, /exact contiguous quote/)
    assert.equal(repairInput.rejectedResponse.includes('I like tea.'), true)
    assert.equal(repairs.length, 1)
    assert.equal(result.actions[0].basis[0].quote, 'I like jasmine tea.')
    assert.equal(calls[0].body.text.format.strict, true)
    assert.deepEqual(
      calls[0].body.text.format.schema,
      OPENAI_MEMORY_REDUCER_RESPONSE_SCHEMA,
    )
  })

test('OpenAI reducer composes with canonical ingest and host admission',
  async (t) => {
    const root = await mkdtemp(join(tmpdir(), 'palari-openai-reducer-'))
    const reducer = createOpenAIMemoryReducer({
      async invoke({ body }) {
        const request = JSON.parse(body.input[0].content)
        const [evidence] = request.input.evidence
        return completedText(JSON.stringify({
          actions: [{
            basis: [{
              id: evidence.id,
              kind: 'evidence',
              quote: evidence.text,
            }],
            epistemic: 'asserted',
            op: 'add',
            relation: null,
            statement: 'The user likes jasmine tea.',
            targetIds: [],
            timeBasis: null,
            topic: 'tea preference',
          }],
          baseRevision: request.input.baseRevision,
          dispositions: [{
            evidenceId: evidence.id,
            outcome: 'used',
          }],
        }))
      },
    })
    const brain = await createPalariBrain({
      memoryEnabled: true,
      statePath: join(root, 'state.json'),
      workspaceId: 'openai-reducer',
    })
    t.after(async () => {
      brain.close()
      await rm(root, { force: true, recursive: true })
    })
    const scope = { palariId: 'palari', userId: 'user' }
    const result = await ingestChatTurn(brain, {
      ...scope,
      assistantMessage: '',
      eventAt: '2026-08-02T00:00:00.000Z',
      retention: 'durable',
      sourceMessageId: 'tea:0',
      userMessage: 'I like jasmine tea.',
    }, {
      reducer,
      reducerId: 'openai:gpt-5.6-luna:active-memory-reducer/v1',
    })

    assert.equal(result.reduction.status, 'completed')
    const digest = brain.readReadyDigest(scope)
    assert.equal(digest.memories.length, 1)
    assert.equal(
      digest.memories[0].statement,
      'The user likes jasmine tea.',
    )
    assert.equal(
      digest.memories[0].supports[0].quote,
      'I like jasmine tea.',
    )
  })

test('OpenAI reducer marks provider failures terminal and never retries',
  async () => {
    let calls = 0
    const reducer = createOpenAIMemoryReducer({
      async invoke() {
        calls += 1
        throw new OpenAIResponsesError('OPENAI_HTTP_ERROR', 'HTTP 401.')
      },
    })
    await assert.rejects(
      reducer({ request: reductionRequest() }),
      (error) => error.code === 'OPENAI_HTTP_ERROR',
    )
    assert.equal(calls, 1)
    assert.throws(
      () => createOpenAIMemoryReducer({
        async invoke() {},
        maxRepairs: 2,
      }),
      /maxRepairs cannot exceed 1/,
    )
  })

test('structured adapters reject incomplete, empty, and malformed output',
  async () => {
    const reducer = createOpenAIMemoryReducer({
      async invoke() {
        return {
          incomplete_details: { reason: 'max_output_tokens' },
          output: [],
          status: 'incomplete',
        }
      },
    })
    await assert.rejects(
      reducer({ request: reductionRequest() }),
      (error) => error.code === 'OPENAI_RESPONSE_INCOMPLETE',
    )

    const emptyGraph = createOpenAIGraphExtractor({
      async invoke() {
        return { output: [], status: 'completed' }
      },
    })
    await assert.rejects(
      emptyGraph({
        evidence: [{ ref: 'e0', speaker: 'user', text: 'Evidence.' }],
      }),
      (error) => error.code === 'OPENAI_RESPONSE_TEXT_MISSING',
    )

    const malformedGraph = createOpenAIGraphExtractor({
      async invoke() {
        return completedText('{')
      },
    })
    await assert.rejects(
      malformedGraph({
        evidence: [{ ref: 'e0', speaker: 'user', text: 'Evidence.' }],
      }),
      (error) => error.code === 'OPENAI_GRAPH_PROPOSAL_INVALID',
    )
  })

test('OpenAI graph extractor admits only exact quoted evidence through host',
  async (t) => {
    const root = await mkdtemp(join(tmpdir(), 'palari-openai-graph-'))
    const graphExtractor = createOpenAIGraphExtractor({
      async invoke({ body }) {
        assert.equal(body.model, OPENAI_LUNA_MODEL)
        assert.equal(body.store, false)
        assert.equal(body.text.format.strict, true)
        assert.deepEqual(
          body.text.format.schema,
          OPENAI_GRAPH_RESPONSE_SCHEMA,
        )
        const { evidence } = JSON.parse(body.input[0].content)
        return completedText(JSON.stringify({
          assertions: [{
            evidenceRef: evidence[0].ref,
            object: 'shelf seven',
            predicate: 'keeps notebook on',
            quote: 'Alice keeps the indigo notebook on shelf seven.',
            subject: 'Alice',
            timeQuote: '',
          }],
        }))
      },
    })
    const brain = await createPalariBrain({
      graphExtractor,
      memoryEnabled: true,
      statePath: join(root, 'state.json'),
      workspaceId: 'openai-graph',
    })
    t.after(async () => {
      brain.close()
      await rm(root, { force: true, recursive: true })
    })
    const scope = { palariId: 'palari', userId: 'user' }
    await ingestChatTurn(brain, {
      ...scope,
      assistantMessage: 'Recorded.',
      eventAt: '2026-08-02T00:00:00.000Z',
      retention: 'durable',
      sourceMessageId: 'session:0',
      userMessage: 'Alice keeps the indigo notebook on shelf seven.',
    })

    assert.equal(await brain.indexGraph(scope), 1)
    const graph = brain.exploreGraph(scope, { entity: 'Alice' })
    assert.equal(graph.edges.length, 1)
    assert.equal(graph.edges[0].quote,
      'Alice keeps the indigo notebook on shelf seven.')
  })

test('OpenAI graph extractor rejects fabricated quotes before admission',
  async () => {
    const extractor = createOpenAIGraphExtractor({
      async invoke() {
        return completedText(JSON.stringify({
          assertions: [{
            evidenceRef: 'e0',
            object: 'shelf seven',
            predicate: 'keeps notebook on',
            quote: 'Alice owns a notebook.',
            subject: 'Alice',
            timeQuote: '',
          }],
        }))
      },
    })
    await assert.rejects(
      extractor({
        evidence: [{
          ref: 'e0',
          speaker: 'user',
          text: 'Alice keeps the indigo notebook on shelf seven.',
        }],
      }),
      (error) => error.code === 'OPENAI_GRAPH_PROPOSAL_INVALID',
    )
  })

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
  OPENAI_ANSWER_COMMIT_TOOL_NAME,
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

function completedCommit(proposal, options = {}) {
  return completedCall({
    arguments: JSON.stringify(proposal),
    name: OPENAI_ANSWER_COMMIT_TOOL_NAME,
    ...options,
  })
}

function answerSession(overrides = {}) {
  return {
    answerEvidenceCount() {
      return 0
    },
    answerInstructions: 'Use only supplied memory.',
    memoryText: 'Digest: user likes tea.',
    maxRetrievalCalls: 4,
    questionText: 'Question: What does the user like?',
    recommendedMaxOutputTokens: 512,
    retrievalTools: MEMORY_RETRIEVAL_TOOLS,
    retrievalFinalizationInstructions:
      'Retrieval is complete. Answer from evidence or say stored evidence is insufficient.',
    commitAnswer(proposal) {
      return Object.freeze(structuredClone(proposal))
    },
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

test('retrieval provider accepts one bounded active answer ceiling override',
  async () => {
    let observed
    const provider = createOpenAIRetrievalProvider({
      maxOutputTokens: 1_024,
      async invoke({ body }) {
        observed = body.max_output_tokens
        return completedText('A concise recommendation.')
      },
    })

    assert.deepEqual(
      await provider(answerSession()),
      { abstained: false, text: 'A concise recommendation.' },
    )
    assert.equal(observed, 1_024)
    assert.throws(
      () => createOpenAIRetrievalProvider({
        invoke: async () => completedText('unused'),
        maxOutputTokens: 4_097,
      }),
      /cannot exceed 4096/,
    )
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
    assert.equal(bodies[0].tools.length, MEMORY_RETRIEVAL_TOOLS.length + 1)
    assert.equal(
      bodies[0].tools.at(-1).name,
      OPENAI_ANSWER_COMMIT_TOOL_NAME,
    )
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

test('OpenAI answer commitment wire distinguishes use, non-use, and temporary inference',
  async () => {
    let body
    const provider = createOpenAIRetrievalProvider({
      async invoke(request) {
        body = request.body
        return completedText('No memory was needed.')
      },
    })
    await provider(answerSession())
    const commit = body.tools.find((tool) =>
      tool.name === OPENAI_ANSWER_COMMIT_TOOL_NAME)
    assert.deepEqual(commit.parameters.required, [
      'abstained',
      'bases',
      'temporaryInferences',
      'text',
    ])
    assert.deepEqual(commit.parameters.properties.bases.items.required, [
      'evidenceId',
      'quote',
      'consequence_for_answer',
      'not_used_reason',
    ])
    assert.deepEqual(
      commit.parameters.properties.temporaryInferences.items.properties
        .revisable.enum,
      [true],
    )
    assert.match(commit.description, /not every retrieved row/i)
    assert.match(commit.description, /temporary/i)
  })

test('OpenAI adds exhaustive enumeration only for an enumeration answer session',
  async () => {
    let body
    const provider = createOpenAIRetrievalProvider({
      async invoke(request) {
        body = request.body
        return completedText('No stored evidence was found.')
      },
    })
    await provider(answerSession({ answerEnumerationRequired: true }))
    const commit = body.tools.find((tool) =>
      tool.name === OPENAI_ANSWER_COMMIT_TOOL_NAME)
    assert.ok(commit.parameters.required.includes('enumeration'))
    assert.deepEqual(
      commit.parameters.properties.enumeration.properties.items.items
        .properties.disposition.enum,
      ['included', 'excluded', 'ambiguous'],
    )
    assert.deepEqual(
      commit.parameters.properties.enumeration.required,
      ['items', 'referencedCount', 'includedCount', 'ambiguousCount'],
    )
    assert.equal(
      commit.parameters.properties.enumeration.properties.items.minItems,
      0,
    )
    assert.match(commit.description, /every distinct candidate/i)
  })

test('one memory plan preserves all four retrieval calls in the OpenAI loop',
  async () => {
    const bodies = []
    const retrievals = []
    const provider = createOpenAIRetrievalProvider({
      async invoke({ body }) {
        bodies.push(body)
        if (bodies.length === 1) {
          return completedCall({
            arguments: JSON.stringify({
              anchor_event: 'a later purchase',
              category: 'purchase history',
              relation: 'before',
              time_range: { after: null, before: null },
            }),
            name: 'memory_plan',
          })
        }
        return bodies.length <= 5
          ? completedCall({ callId: `call_${bodies.length}` })
          : completedText('Stored evidence is insufficient.')
      },
    })
    const result = await provider(answerSession({
      async retrieve(request) {
        retrievals.push(request)
        return request.tool === 'memory_plan'
          ? { countsAgainstRetrievalBudget: false, operation: 'memory_plan' }
          : { sessions: [] }
      },
    }))
    assert.equal(result.text, 'Stored evidence is insufficient.')
    assert.deepEqual(
      retrievals.map((request) => request.tool),
      [
        'memory_plan',
        'memory_timeline',
        'memory_timeline',
        'memory_timeline',
        'memory_timeline',
      ],
    )
    assert.equal(bodies.length, 6)
    assert.equal(bodies[5].tool_choice, 'none')
  })

test('retrieval provider commits cited evidence without another model dispatch',
  async () => {
    const bodies = []
    let evidenceCount = 0
    let retrievals = 0
    const proposal = {
      abstained: false,
      bases: [{
        evidenceId: 'evidence-cedar',
        quote: 'cedar cabinet',
      }],
      text: 'The apron is in the cedar cabinet.',
    }
    const committed = Object.freeze(structuredClone(proposal))
    const provider = createOpenAIRetrievalProvider({
      async invoke({ body }) {
        bodies.push(body)
        return bodies.length === 1
          ? completedCall({
              arguments: '{"phrase":"workshop apron"}',
              name: 'memory_search',
            })
          : completedCommit(proposal)
      },
    })
    const result = await provider(answerSession({
      answerEvidenceCount() {
        return evidenceCount
      },
      commitAnswer(received) {
        assert.deepEqual(received, proposal)
        return committed
      },
      async retrieve() {
        retrievals += 1
        evidenceCount = 1
        return {
          matches: [{
            evidenceId: 'evidence-cedar',
            text: 'The workshop apron is in the cedar cabinet.',
          }],
        }
      },
    }))

    assert.equal(result, committed)
    assert.equal(retrievals, 1)
    assert.equal(bodies.length, 2)
    assert.equal(bodies[1].tool_choice, 'auto')
    assert.equal(bodies[1].tools.length, MEMORY_RETRIEVAL_TOOLS.length + 1)
  })

test('raw post-retrieval text gets one forced cited-commit repair',
  async () => {
    const bodies = []
    let evidenceCount = 0
    const proposal = {
      abstained: false,
      bases: [{ evidenceId: 'evidence-1', quote: 'green tool chest' }],
      text: 'It is in the green tool chest.',
    }
    const provider = createOpenAIRetrievalProvider({
      async invoke({ body }) {
        bodies.push(body)
        if (bodies.length === 1) {
          return completedCall({
            arguments: '{"phrase":"spare gauge"}',
            name: 'memory_search',
          })
        }
        if (bodies.length === 2) return completedText('Uncited raw answer.')
        return completedCommit(proposal)
      },
    })
    const result = await provider(answerSession({
      answerEvidenceCount: () => evidenceCount,
      commitAnswer: (received) => Object.freeze(received),
      async retrieve() {
        evidenceCount = 1
        return {
          matches: [{
            evidenceId: 'evidence-1',
            text: 'The spare gauge is in the green tool chest.',
          }],
        }
      },
    }))

    assert.deepEqual(result, proposal)
    assert.equal(bodies.length, 3)
    assert.deepEqual(bodies[2].tool_choice, {
      name: OPENAI_ANSWER_COMMIT_TOOL_NAME,
      type: 'function',
    })
    assert.deepEqual(
      bodies[2].tools.map(({ name }) => name),
      [OPENAI_ANSWER_COMMIT_TOOL_NAME],
    )
    assert.match(bodies[2].instructions, /No memory tool is available/)
    assert.ok(bodies[2].input.some((item) =>
      item.role === 'user' && /raw message cannot be accepted/.test(item.content)))
  })

test('invalid commitment gets one repair and a second invalid result is terminal',
  async () => {
    for (const repaired of [true, false]) {
      const bodies = []
      let evidenceCount = 0
      let commits = 0
      const invalid = {
        abstained: false,
        bases: [{ evidenceId: 'unknown', quote: 'fabricated quote' }],
        text: 'Unsupported answer.',
      }
      const valid = {
        abstained: true,
        bases: [{ evidenceId: 'evidence-2', quote: 'yellow raincoat' }],
        text: 'The returned memory is about a yellow raincoat, not the requested item.',
      }
      const provider = createOpenAIRetrievalProvider({
        async invoke({ body }) {
          bodies.push(body)
          if (bodies.length === 1) return completedCall()
          if (bodies.length === 2) {
            return completedCommit(invalid, { callId: 'call_invalid' })
          }
          return completedCommit(repaired ? valid : invalid, { callId: 'call_3' })
        },
      })
      const operation = provider(answerSession({
        answerEvidenceCount: () => evidenceCount,
        commitAnswer(proposal) {
          commits += 1
          if (proposal.bases[0].evidenceId !== 'evidence-2') {
            const error = new TypeError('Basis evidence ID was not returned.')
            error.code = 'MEMORY_ANSWER_COMMITMENT_INVALID'
            throw error
          }
          return Object.freeze(proposal)
        },
        async retrieve() {
          evidenceCount = 1
          return {
            messages: [{
              evidenceId: 'evidence-2',
              text: 'I packed a yellow raincoat.',
            }],
          }
        },
      }))
      if (repaired) {
        assert.deepEqual(await operation, valid)
      } else {
        await assert.rejects(operation,
          (error) => error.code === 'OPENAI_ANSWER_COMMIT_REPAIR_FAILED')
      }
      assert.equal(bodies.length, 3)
      assert.equal(commits, 2)
      assert.deepEqual(bodies[2].tool_choice, {
        name: OPENAI_ANSWER_COMMIT_TOOL_NAME,
        type: 'function',
      })
      const rejection = bodies[2].input.find((item) =>
        item.type === 'function_call_output' &&
        item.call_id === 'call_invalid')
      assert.match(JSON.parse(rejection.output).rejection, /not returned/)
    }
  })

test('non-empty fourth retrieval forces only commitment without spending a fifth memory call',
  async () => {
    const bodies = []
    let evidenceCount = 0
    let retrievals = 0
    const proposal = {
      abstained: false,
      bases: [{ evidenceId: 'evidence-final', quote: 'violet folder' }],
      text: 'The record points to the violet folder.',
    }
    const provider = createOpenAIRetrievalProvider({
      async invoke({ body }) {
        bodies.push(body)
        return bodies.length <= 4
          ? completedCall({ callId: `call_${bodies.length}` })
          : completedCommit(proposal, { callId: 'call_commit' })
      },
    })
    const result = await provider(answerSession({
      answerEvidenceCount: () => evidenceCount,
      commitAnswer: (received) => Object.freeze(received),
      async retrieve() {
        retrievals += 1
        evidenceCount = 1
        return {
          messages: [{
            evidenceId: 'evidence-final',
            text: 'The warranty record is in the violet folder.',
          }],
        }
      },
    }))

    assert.deepEqual(result, proposal)
    assert.equal(retrievals, 4)
    assert.equal(bodies.length, 5)
    assert.deepEqual(bodies[4].tool_choice, {
      name: OPENAI_ANSWER_COMMIT_TOOL_NAME,
      type: 'function',
    })
    assert.deepEqual(
      bodies[4].tools.map(({ name }) => name),
      [OPENAI_ANSWER_COMMIT_TOOL_NAME],
    )
  })

test('retrieval provider forces one tool-disabled finalization after four calls',
  async () => {
    for (const finalText of [
      'The stored evidence says the user likes jasmine tea.',
      'I do not have enough stored evidence to answer that.',
    ]) {
      const bodies = []
      const retrievals = []
      const provider = createOpenAIRetrievalProvider({
        async invoke({ body }) {
          bodies.push(body)
          const dispatch = bodies.length
          return dispatch <= 4
            ? completedCall({
                arguments: JSON.stringify({ phrase: `query-${dispatch}` }),
                callId: `call_${dispatch}`,
                name: 'memory_search',
              })
            : completedText(finalText)
        },
      })

      const result = await provider(answerSession({
        async retrieve(request) {
          retrievals.push(request)
          return { matches: [], operation: 'memory_search' }
        },
      }))

      assert.equal(result.text, finalText)
      assert.equal(bodies.length, 5)
      assert.equal(retrievals.length, 4)
      assert.ok(bodies.slice(0, 4).every((body) =>
        body.tool_choice === 'auto' &&
        body.tools.length === MEMORY_RETRIEVAL_TOOLS.length + 1))
      assert.equal(bodies[4].tool_choice, 'none')
      assert.equal(Object.hasOwn(bodies[4], 'tools'), false)
      assert.match(bodies[4].instructions, /Retrieval is complete/)
      assert.match(bodies[4].instructions, /stored evidence is insufficient/)
      assert.equal(
        bodies[4].input.filter((item) =>
          item.type === 'function_call_output').length,
        4,
      )
      assert.equal(
        bodies[4].input.filter((item) =>
          item.type === 'reasoning' &&
          item.encrypted_content === 'encrypted_reasoning_fixture').length,
        4,
      )
    }
  })

test('retrieval provider preserves early answers from zero through three calls',
  async () => {
    for (let answerAfter = 0; answerAfter <= 3; answerAfter += 1) {
      const bodies = []
      let retrievals = 0
      const provider = createOpenAIRetrievalProvider({
        async invoke({ body }) {
          bodies.push(body)
          return bodies.length <= answerAfter
            ? completedCall({ callId: `call_${bodies.length}` })
            : completedText(`answered-after-${answerAfter}`)
        },
      })
      const result = await provider(answerSession({
        async retrieve() {
          retrievals += 1
          return { sessions: [] }
        },
      }))
      assert.equal(result.text, `answered-after-${answerAfter}`)
      assert.equal(retrievals, answerAfter)
      assert.equal(bodies.length, answerAfter + 1)
      assert.ok(bodies.every((body) => body.tool_choice === 'auto'))
    }

    let zeroBudgetBody
    const zeroBudget = createOpenAIRetrievalProvider({
      async invoke({ body }) {
        zeroBudgetBody = body
        return completedText('No retrieval was permitted.')
      },
    })
    const result = await zeroBudget(answerSession({
      maxRetrievalCalls: 0,
      retrievalFinalizationInstructions: '',
    }))
    assert.equal(result.text, 'No retrieval was permitted.')
    assert.equal(zeroBudgetBody.tool_choice, 'none')
    assert.equal(Object.hasOwn(zeroBudgetBody, 'tools'), false)
    assert.match(zeroBudgetBody.instructions, /not proof that an event did not happen/i)
  })

test('retrieval finalization cannot call tools or overflow the host budget',
  async () => {
    let dispatches = 0
    let retrievals = 0
    const toolCallingFinalization = createOpenAIRetrievalProvider({
      async invoke() {
        dispatches += 1
        return completedCall({
          callId: `call_${dispatches}`,
          name: 'memory_timeline',
        })
      },
    })
    await assert.rejects(
      toolCallingFinalization(answerSession({
        async retrieve() {
          retrievals += 1
          return { sessions: [] }
        },
      })),
      (error) => error.code === 'OPENAI_FINALIZATION_TOOL_CALL',
    )
    assert.equal(dispatches, 5)
    assert.equal(retrievals, 4)

    let overflowRetrievals = 0
    const overflow = createOpenAIRetrievalProvider({
      async invoke() {
        return {
          output: [
            ...completedCall({ callId: 'call_a' }).output,
            completedCall({ callId: 'call_b' }).output[1],
            completedCall({ callId: 'call_c' }).output[1],
            completedCall({ callId: 'call_d' }).output[1],
            completedCall({ callId: 'call_e' }).output[1],
          ],
          status: 'completed',
        }
      },
    })
    await assert.rejects(
      overflow(answerSession({
        async retrieve() {
          overflowRetrievals += 1
          return { sessions: [] }
        },
      })),
      (error) => error.code === 'OPENAI_RETRIEVAL_CALL_BUDGET_EXCEEDED',
    )
    assert.equal(overflowRetrievals, 0)

    let emptyDispatches = 0
    const emptyFinalization = createOpenAIRetrievalProvider({
      async invoke() {
        emptyDispatches += 1
        return emptyDispatches <= 4
          ? completedCall({ callId: `call_${emptyDispatches}` })
          : { output: [], status: 'completed' }
      },
    })
    await assert.rejects(
      emptyFinalization(answerSession()),
      (error) => error.code === 'OPENAI_RESPONSE_TEXT_MISSING',
    )
    assert.equal(emptyDispatches, 5)

    const raised = createOpenAIRetrievalProvider({ async invoke() {} })
    await assert.rejects(
      raised(answerSession({ maxRetrievalCalls: 5 })),
      /maxRetrievalCalls cannot exceed 4/,
    )
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
      async invoke({ body }) {
        dispatches += 1
        if (dispatches === 1) {
          return completedCall({
            arguments: '{"phrase":"jasmine"}',
            name: 'memory_find',
          })
        }
        const retrievalOutput = body.input.find((item) =>
          item.type === 'function_call_output')
        const found = JSON.parse(retrievalOutput.output)
        return completedCommit({
          abstained: false,
          bases: [{
            evidenceId: found.matches[0].evidenceId,
            quote: found.matches[0].snippet,
          }],
          text: 'You like jasmine tea.',
        })
      },
    })

    const result = await answerWithRetrieval(brain, {
      ...scope,
      provider,
      question: 'Which tea do I like?',
    })
    assert.equal(result.answer, 'You like jasmine tea.')
    assert.equal(result.answerCommitted, true)
    assert.equal(result.answerEvidence.length, 1)
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

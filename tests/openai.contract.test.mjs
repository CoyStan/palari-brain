import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  MEMORY_ANSWER_CONFIRMATION_TOOLS,
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

function evidenceAnswer(text, entries) {
  return {
    abstained: false,
    bases: entries.map(({ row, used = true }) => ({
      consequence_for_answer: used ? 'This determines the answer.' : '',
      evidenceId: row.evidenceId,
      not_used_reason: used ? '' : 'This was superseded by newer evidence.',
      quote: row.text,
    })),
    temporaryInferences: [],
    text,
  }
}

function numberedEvidenceAnswer(text, entries) {
  return {
    abstained: false,
    bases: entries.map(({ row, used = true }, index) => ({
      disposition: used ? 'used' : 'not_used',
      memoryNumber: row.memoryNumber ?? index + 1,
      rationale: used
        ? 'This determines the answer.'
        : 'This was superseded by newer evidence.',
    })),
    temporaryInferences: [],
    text,
  }
}

function recommendationAnswer(text, rows) {
  return {
    abstained: false,
    supportingEvidenceIds: rows.map((row) => row.evidenceId),
    text,
  }
}

function numberedRecommendationAnswer(text, rows) {
  return {
    abstained: false,
    supportingMemoryNumbers: rows.map((row, index) =>
      row.memoryNumber ?? index + 1),
    text,
  }
}

function priorMemoryNumber(body, evidenceId) {
  const context = JSON.parse(body.input[0].content.split('\n\n')[0])
  const row = context.previouslyReturnedEvidence.find((candidate) =>
    candidate.evidenceId === evidenceId)
  assert.ok(row, `Missing prior evidence ${evidenceId}`)
  return row.memoryNumber
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
    const observed = []
    const provider = createOpenAIRetrievalProvider({
      maxOutputTokens: 5_120,
      async invoke({ body }) {
        observed.push(body.max_output_tokens)
        return completedText('A concise recommendation.')
      },
    })

    assert.deepEqual(
      await provider(answerSession()),
      { abstained: false, text: 'A concise recommendation.' },
    )
    assert.deepEqual(observed, [5_120])
    assert.throws(
      () => createOpenAIRetrievalProvider({
        invoke: async () => completedText('unused'),
        maxOutputTokens: 5_121,
      }),
      /cannot exceed 5120/,
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
      'memoryNumber',
      'disposition',
      'rationale',
    ])
    const commitSchema = JSON.stringify(commit.parameters)
    assert.ok(!commitSchema.includes('evidenceId'))
    assert.ok(!commitSchema.includes('quote'))
    assert.deepEqual(
      commit.parameters.properties.bases.items.properties.disposition.enum,
      ['used', 'not_used'],
    )
    assert.ok(commit.parameters.properties.temporaryInferences.items.required
      .includes('provenanceMemoryNumbers'))
    assert.deepEqual(
      commit.parameters.properties.temporaryInferences.items.properties
        .revisable.enum,
      [true],
    )
    assert.match(commit.description, /not every retrieved row/i)
    assert.match(commit.description, /temporary/i)
  })

test('OpenAI binds stable memory numbers across all answer commitment surfaces',
  async () => {
    const bodies = []
    let evidenceCount = 0
    let retrievalRound = 0
    const provider = createOpenAIRetrievalProvider({
      async invoke({ body }) {
        bodies.push(body)
        if (bodies.length === 1) {
          return completedCall({
            arguments: '{"phrase":"alpha beta"}',
            name: 'memory_search',
          })
        }
        if (bodies.length === 2) {
          const found = JSON.parse(body.input.at(-1).output)
          assert.deepEqual(
            found.matches.map((row) => row.memoryNumber ?? null),
            [1, 2, 1, null],
          )
          return completedCall({
            arguments: '{"phrase":"alpha gamma"}',
            callId: 'second-search',
            name: 'memory_search',
          })
        }
        const second = JSON.parse(body.input.at(-1).output)
        assert.deepEqual(
          second.matches.map((row) => row.memoryNumber),
          [1, 3],
        )
        return completedCommit({
          abstained: false,
          bases: [{
            disposition: 'used',
            memoryNumber: 1,
            rationale: 'Alpha is included.',
          }],
          enumeration: {
            ambiguousCount: 0,
            includedCount: 1,
            items: [{
              action: 'Use beta.',
              disposition: 'included',
              label: 'Beta',
              memoryNumber: 2,
              reason: 'It is directly supported.',
            }],
            referencedCount: 1,
          },
          temporaryInferences: [{
            consequence_for_answer: 'The memories may be related.',
            provenanceMemoryNumbers: [1, 3],
            revisable: true,
            statement: 'Alpha and gamma may form one plan.',
          }],
          text: 'Use alpha and beta.',
        })
      },
    })
    const result = await provider(answerSession({
      answerEnumerationRequired: true,
      answerEvidenceCount: () => evidenceCount,
      commitAnswer(proposal) {
        assert.equal(proposal.bases[0].evidenceId, 'opaque-alpha')
        assert.equal(proposal.bases[0].quote, 'Alpha memory.')
        assert.equal(proposal.bases[0].consequence_for_answer,
          'Alpha is included.')
        assert.equal(proposal.bases[0].not_used_reason, '')
        assert.equal(proposal.enumeration.items[0].evidenceId, 'opaque-beta')
        assert.equal(proposal.enumeration.items[0].quote, 'Beta memory.')
        assert.deepEqual(
          proposal.temporaryInferences[0].provenanceEvidenceIds,
          ['opaque-alpha', 'opaque-gamma'],
        )
        return Object.freeze(proposal)
      },
      async retrieve() {
        retrievalRound += 1
        evidenceCount = retrievalRound === 1 ? 2 : 3
        return retrievalRound === 1
          ? {
              matches: [
                { evidenceId: 'opaque-alpha', text: 'Alpha memory.' },
                { evidenceId: 'opaque-beta', text: 'Beta memory.' },
                { evidenceId: 'opaque-alpha', text: 'Alpha memory.' },
                { evidenceId: 'metadata-only' },
              ],
            }
          : {
              matches: [
                { evidenceId: 'opaque-alpha', text: 'Alpha memory.' },
                { evidenceId: 'opaque-gamma', text: 'Gamma memory.' },
              ],
            }
      },
    }))

    assert.equal(result.text, 'Use alpha and beta.')
    assert.equal(bodies.length, 3)
  })

test('OpenAI rejects provider-authored quotes and repairs with host-owned text',
  async () => {
    const bodies = []
    let evidenceCount = 0
    const row = {
      evidenceId: 'opaque-host-bound',
      text: 'The spare key is inside the blue drawer.',
    }
    const valid = numberedEvidenceAnswer(
      'The spare key is inside the blue drawer.',
      [{ row }],
    )
    const stale = structuredClone(valid)
    stale.bases[0].quote = 'provider-authored copy'
    const provider = createOpenAIRetrievalProvider({
      async invoke({ body }) {
        bodies.push(body)
        if (bodies.length === 1) return completedCall()
        return completedCommit(bodies.length === 2 ? stale : valid, {
          callId: bodies.length === 2 ? 'stale-quote' : 'repaired-commit',
        })
      },
    })
    const result = await provider(answerSession({
      answerEvidenceCount: () => evidenceCount,
      commitAnswer(proposal) {
        assert.equal(proposal.bases[0].evidenceId, row.evidenceId)
        assert.equal(proposal.bases[0].quote, row.text)
        return Object.freeze(proposal)
      },
      async retrieve() {
        evidenceCount = 1
        return { matches: [row] }
      },
    }))

    assert.equal(result.text, 'The spare key is inside the blue drawer.')
    assert.equal(bodies.length, 3)
    const rejection = bodies[2].input.find((item) =>
      item.type === 'function_call_output' && item.call_id === 'stale-quote')
    assert.match(
      JSON.parse(rejection.output).rejection,
      /memoryNumber, disposition, and rationale/,
    )
  })

test('OpenAI translates recommendation memory numbers to host evidence IDs',
  async () => {
    let evidenceCount = 0
    const row = { evidenceId: 'opaque-preference', text: 'Prefer the Nova.' }
    let dispatch = 0
    const provider = createOpenAIRetrievalProvider({
      async invoke() {
        dispatch += 1
        return dispatch === 1
          ? completedCall({ name: 'memory_search' })
          : completedCommit({
              abstained: false,
              supportingMemoryNumbers: [1],
              text: 'Choose the Nova.',
            })
      },
    })
    const result = await provider(answerSession({
      answerEvidenceCount: () => evidenceCount,
      answerSupportingEvidenceOnly: true,
      commitAnswer(proposal) {
        assert.deepEqual(proposal.supportingEvidenceIds, [row.evidenceId])
        return Object.freeze(proposal)
      },
      async retrieve() {
        evidenceCount = 1
        return { matches: [row] }
      },
    }))

    assert.equal(result.text, 'Choose the Nova.')
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
    assert.match(commit.description, /excluded only when direct evidence/i)
    assert.match(commit.description, /simultaneously asserts an outstanding action/i)
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
    const row = {
      evidenceId: 'evidence-cedar',
      text: 'The workshop apron is in the cedar cabinet.',
    }
    const proposal = evidenceAnswer(
      'The apron is in the cedar cabinet.',
      [{ row }],
    )
    const wireProposal = numberedEvidenceAnswer(proposal.text, [{ row }])
    const committed = Object.freeze(structuredClone(proposal))
    const provider = createOpenAIRetrievalProvider({
      async invoke({ body }) {
        bodies.push(body)
        return bodies.length === 1
          ? completedCall({
              arguments: '{"phrase":"workshop apron"}',
              name: 'memory_search',
            })
          : completedCommit(wireProposal)
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
          matches: [row],
        }
      },
    }))

    assert.equal(result, committed)
    assert.equal(retrievals, 1)
    assert.equal(bodies.length, 2)
    const returned = JSON.parse(bodies[1].input.at(-1).output)
    assert.equal(returned.matches[0].memoryNumber, 1)
    assert.equal(returned.matches[0].evidenceId, 'evidence-cedar')
    assert.equal(bodies[1].tool_choice, 'auto')
    assert.equal(bodies[1].tools.length, MEMORY_RETRIEVAL_TOOLS.length + 1)
  })

test('raw post-retrieval text gets one forced cited-commit repair',
  async () => {
    const bodies = []
    let evidenceCount = 0
    const row = {
      evidenceId: 'evidence-1',
      text: 'The spare gauge is in the green tool chest.',
    }
    const proposal = evidenceAnswer(
      'It is in the green tool chest.',
      [{ row }],
    )
    const wireProposal = numberedEvidenceAnswer(proposal.text, [{ row }])
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
        return completedCommit(wireProposal)
      },
    })
    const result = await provider(answerSession({
      answerEvidenceCount: () => evidenceCount,
      commitAnswer: (received) => Object.freeze(received),
      async retrieve() {
        evidenceCount = 1
        return {
          matches: [row],
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
      const row = {
        evidenceId: 'evidence-2',
        text: 'I packed a yellow raincoat.',
      }
      const invalid = numberedEvidenceAnswer('Unsupported answer.', [{
        row: { memoryNumber: 2 },
      }])
      const valid = numberedEvidenceAnswer(
        'The returned memory is about a yellow raincoat, not the requested item.',
        [{ row, used: false }],
      )
      const validHost = evidenceAnswer(valid.text, [{ row, used: false }])
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
        assert.deepEqual(await operation, validHost)
      } else {
        await assert.rejects(operation,
          (error) => error.code === 'OPENAI_ANSWER_COMMIT_REPAIR_FAILED')
      }
      assert.equal(bodies.length, 3)
      assert.equal(commits, repaired ? 1 : 0)
      assert.deepEqual(bodies[2].tool_choice, {
        name: OPENAI_ANSWER_COMMIT_TOOL_NAME,
        type: 'function',
      })
      const rejection = bodies[2].input.find((item) =>
        item.type === 'function_call_output' &&
        item.call_id === 'call_invalid')
      assert.match(JSON.parse(rejection.output).rejection, /memoryNumber.*shown/)
    }
  })

test('confirmation rejection reopens retrieval instead of forcing commit repair',
  async () => {
    const bodies = []
    let searched = false
    const row = { evidenceId: 'evidence-1', text: 'violet folder' }
    const proposal = evidenceAnswer(
      'The key is in the violet folder.',
      [{ row }],
    )
    const wireProposal = numberedEvidenceAnswer(proposal.text, [{ row }])
    const provider = createOpenAIRetrievalProvider({
      async invoke({ body }) {
        bodies.push(body)
        if (bodies.length === 1) {
          return completedCommit(wireProposal, { callId: 'premature_commit' })
        }
        if (bodies.length === 2) {
          return completedCall({
            arguments: '{"phrase":"missing or conflicting key location"}',
            callId: 'confirmation_search',
            name: 'memory_search',
          })
        }
        return completedCommit(wireProposal, { callId: 'closed_commit' })
      },
    })
    const result = await provider(answerSession({
      answerEvidenceCount: () => 1,
      answerPriorEvidence: [row],
      commitAnswer(received) {
        if (!searched) {
          const error = new TypeError('Search unseen memory before commit.')
          error.code = 'MEMORY_ANSWER_CONFIRMATION_REQUIRED'
          throw error
        }
        return Object.freeze(received)
      },
      maxRetrievalCalls: 2,
      async retrieve() {
        searched = true
        return { matches: [] }
      },
    }))

    assert.deepEqual(result, proposal)
    assert.equal(bodies.length, 3)
    assert.equal(bodies[1].tool_choice, 'auto')
    assert.ok(bodies[1].tools.some(({ name }) => name === 'memory_search'))
    assert.ok(bodies[1].input.some((item) =>
      item.type === 'function_call_output' &&
      item.call_id === 'premature_commit' &&
      /Search unseen memory/.test(JSON.parse(item.output).rejection)))
  })

test('confirmation candidate review is ephemeral and remains available after the final search',
  async () => {
    const bodies = []
    let searches = 0
    let reviews = 0
    let closed = false
    const row = { evidenceId: 'evidence-1', text: 'violet folder' }
    const proposal = evidenceAnswer(
      'The key is in the violet folder.',
      [{ row }],
    )
    const wireProposal = numberedEvidenceAnswer(proposal.text, [{ row }])
    const provider = createOpenAIRetrievalProvider({
      async invoke({ body }) {
        bodies.push(body)
        if (bodies.length === 1 || bodies.length === 3) {
          return completedCall({
            arguments: JSON.stringify({ phrase: `query-${bodies.length}` }),
            callId: `search-${bodies.length}`,
            name: 'memory_search',
          })
        }
        if (bodies.length === 2 || bodies.length === 4) {
          return completedCall({
            arguments: JSON.stringify({
              assessments: [{
                disposition: bodies.length === 2 ? 'material' : 'not_used',
                reason: 'Host-test classification.',
              }],
            }),
            callId: `review-${bodies.length}`,
            name: 'memory_candidate_review',
          })
        }
        return completedCommit(wireProposal, { callId: 'closed-commit' })
      },
    })
    const result = await provider(answerSession({
      answerConfirmationClosed: () => closed,
      answerEvidenceCount: () => 1,
      answerPriorEvidence: [row],
      maxRetrievalCalls: 2,
      retrievalTools: MEMORY_ANSWER_CONFIRMATION_TOOLS,
      async retrieve({ tool }) {
        if (tool === 'memory_search') {
          searches += 1
          return {
            matches: [{
              candidateNumber: 1,
              evidenceId: `candidate-${searches}`,
              text: `candidate text ${searches}`,
            }],
          }
        }
        reviews += 1
        closed = reviews === 2
        return { closed, continueSearch: !closed }
      },
    }))

    assert.deepEqual(result, proposal)
    assert.equal(searches, 2)
    assert.equal(reviews, 2)
    assert.equal(bodies.length, 5)
    assert.deepEqual(
      bodies[3].tools.map(({ name }) => name),
      ['memory_candidate_review', OPENAI_ANSWER_COMMIT_TOOL_NAME],
    )
    assert.deepEqual(bodies[4].tool_choice, {
      name: OPENAI_ANSWER_COMMIT_TOOL_NAME,
      type: 'function',
    })
  })

test('confirmation returns a host-validated bounded answer at its emergency limit',
  async () => {
    const bodies = []
    let searches = 0
    let reviews = 0
    let boundedCommits = 0
    const row = { evidenceId: 'evidence-1', text: 'four devices' }
    const proposal = evidenceAnswer('You use four devices.', [{ row }])
    const wireProposal = numberedEvidenceAnswer(proposal.text, [{ row }])
    const provider = createOpenAIRetrievalProvider({
      async invoke({ body }) {
        bodies.push(body)
        if (bodies.length === 1 || bodies.length === 3) {
          return completedCall({
            arguments: JSON.stringify({ phrase: `query-${bodies.length}` }),
            callId: `search-${bodies.length}`,
            name: 'memory_search',
          })
        }
        if (bodies.length === 2 || bodies.length === 4) {
          return completedCall({
            arguments: JSON.stringify({
              findings: [{
                candidateNumber: 1,
                reason: 'This changes the answer.',
              }],
            }),
            callId: `review-${bodies.length}`,
            name: 'memory_candidate_review',
          })
        }
        return completedCommit(wireProposal, { callId: 'bounded-commit' })
      },
    })
    const result = await provider(answerSession({
      answerConfirmationClosed: () => false,
      answerEvidenceCount: () => 1,
      answerPriorEvidence: [row],
      commitAnswer() {
        const error = new TypeError('Continue confirmation.')
        error.code = 'MEMORY_ANSWER_CONFIRMATION_REQUIRED'
        throw error
      },
      commitIncompleteAnswer(received) {
        boundedCommits += 1
        return Object.freeze(received)
      },
      maxRetrievalCalls: 2,
      retrievalTools: MEMORY_ANSWER_CONFIRMATION_TOOLS,
      async retrieve({ tool }) {
        if (tool === 'memory_search') searches += 1
        else reviews += 1
        return tool === 'memory_search'
          ? {
              matches: [{
                candidateNumber: 1,
                evidenceId: `candidate-${searches}`,
                text: `candidate text ${searches}`,
              }],
            }
          : { closed: false, continueSearch: true }
      },
    }))

    assert.deepEqual(result, proposal)
    assert.equal(searches, 2)
    assert.equal(reviews, 2)
    assert.equal(boundedCommits, 1)
    assert.equal(bodies.length, 5)
  })

test('real confirmation reviews the last page after a premature bounded commit',
  async (t) => {
    const root = await mkdtemp(join(tmpdir(), 'palari-openai-confirmation-'))
    const brain = await createPalariBrain({
      memoryEnabled: true,
      statePath: join(root, 'state.json'),
      workspaceId: 'openai-confirmation',
    })
    t.after(async () => {
      brain.close()
      await rm(root, { force: true, recursive: true })
    })
    const scope = { palariId: 'palari', userId: 'user' }
    for (const [sourceMessageId, eventAt, userMessage] of [
      ['project-old:0', '2026-01-01T00:00:00.000Z',
        'The project codename was Cedar.'],
      ['project-new:0', '2026-02-01T00:00:00.000Z',
        'The project codename is now Juniper.'],
    ]) {
      await ingestChatTurn(brain, {
        ...scope,
        assistantMessage: 'Recorded.',
        eventAt,
        retention: 'durable',
        sourceMessageId,
        userMessage,
      })
    }
    let oldRow
    const initialProvider = async ({ commitAnswer, retrieve }) => {
      const found = await retrieve({
        input: { before: '2026-01-31T23:59:59.999Z', phrase: 'codename Cedar' },
        tool: 'memory_search',
      })
      oldRow = found.matches.find((row) =>
        row.speaker === 'user' && row.text.includes('Cedar'))
      return commitAnswer(evidenceAnswer('The codename was Cedar.', [
        { row: oldRow },
      ]))
    }
    let dispatch = 0
    let newRow
    const confirmationProvider = createOpenAIRetrievalProvider({
      async invoke({ body }) {
        dispatch += 1
        if (dispatch === 1) {
          const context = JSON.parse(body.input[0].content.split('\n\n')[0])
          assert.equal(
            context.previouslyReturnedEvidence[0].evidenceId,
            oldRow.evidenceId,
          )
          assert.equal(
            context.previouslyReturnedEvidence[0].memoryNumber,
            1,
          )
          return completedCall({
            arguments: '{"phrase":"current project codename Juniper"}',
            callId: 'last-search',
            name: 'memory_search',
          })
        }
        if (dispatch === 2) {
          const output = body.input.find((item) =>
            item.type === 'function_call_output' &&
            item.call_id === 'last-search')
          const found = JSON.parse(output.output)
          newRow = found.matches.find((row) =>
            row.speaker === 'user' && row.text.includes('Juniper'))
          assert.equal(newRow.candidateNumber, 1)
          assert.equal(newRow.memoryNumber, 2)
          return completedCommit(numberedEvidenceAnswer(
            'The current codename is Juniper.',
            [{ row: oldRow, used: false }, { row: newRow }],
          ), { callId: 'premature-bounded-commit' })
        }
        if (dispatch === 3) {
          assert.ok(body.input.some((item) =>
            item.type === 'function_call_output' &&
            item.call_id === 'premature-bounded-commit' &&
            /fully assessed latest page/.test(
              JSON.parse(item.output).rejection,
            )))
          return completedCall({
            arguments: JSON.stringify({
              findings: [{
                candidateNumber: newRow.candidateNumber,
                reason: 'This newer user statement changes the answer.',
              }],
            }),
            callId: 'last-review',
            name: 'memory_candidate_review',
          })
        }
        return completedCommit(numberedEvidenceAnswer(
          'The current codename is Juniper.',
          [{ row: oldRow, used: false }, { row: newRow }],
        ), { callId: 'reviewed-bounded-commit' })
      },
    })

    const result = await answerWithRetrieval(brain, {
      ...scope,
      confirmationProvider,
      maxConfirmationRetrievalCalls: 1,
      provider: initialProvider,
      question: 'What is the current project codename?',
    })
    assert.equal(dispatch, 4)
    assert.equal(result.answer, 'The current codename is Juniper.')
    assert.equal(result.answerConfirmation.status, 'bounded_incomplete')
    assert.equal(result.answerConfirmation.reviewCalls, 1)
  })

test('real bounded confirmation repairs one malformed final commitment',
  async (t) => {
    const root = await mkdtemp(join(tmpdir(), 'palari-openai-bounded-repair-'))
    const brain = await createPalariBrain({
      memoryEnabled: true,
      statePath: join(root, 'state.json'),
      workspaceId: 'openai-bounded-repair',
    })
    t.after(async () => {
      brain.close()
      await rm(root, { force: true, recursive: true })
    })
    const scope = { palariId: 'palari', userId: 'user' }
    for (const [sourceMessageId, eventAt, userMessage] of [
      ['repair-old:0', '2026-01-01T00:00:00.000Z',
        'My preferred notebook was the Atlas.'],
      ['repair-new:0', '2026-02-01T00:00:00.000Z',
        'My preferred notebook is now the Nova.'],
    ]) {
      await ingestChatTurn(brain, {
        ...scope,
        assistantMessage: 'Recorded.',
        eventAt,
        retention: 'durable',
        sourceMessageId,
        userMessage,
      })
    }
    let oldRow
    const initialProvider = async ({ commitAnswer, retrieve }) => {
      const found = await retrieve({
        input: { before: '2026-01-31T23:59:59.999Z', phrase: 'notebook Atlas' },
        tool: 'memory_search',
      })
      oldRow = found.matches.find((row) =>
        row.speaker === 'user' && row.text.includes('Atlas'))
      return commitAnswer(evidenceAnswer('You preferred the Atlas.', [
        { row: oldRow },
      ]))
    }
    let dispatch = 0
    let newRow
    const confirmationProvider = createOpenAIRetrievalProvider({
      async invoke({ body }) {
        dispatch += 1
        if (dispatch === 1) {
          oldRow = {
            ...oldRow,
            memoryNumber: priorMemoryNumber(body, oldRow.evidenceId),
          }
          return completedCall({
            arguments: '{"phrase":"current preferred notebook Nova"}',
            callId: 'repair-search',
            name: 'memory_search',
          })
        }
        if (dispatch === 2) {
          const output = body.input.find((item) =>
            item.type === 'function_call_output' &&
            item.call_id === 'repair-search')
          const found = JSON.parse(output.output)
          newRow = found.matches.find((row) =>
            row.speaker === 'user' && row.text.includes('Nova'))
          return completedCall({
            arguments: JSON.stringify({
              findings: [{
                candidateNumber: newRow.candidateNumber,
                reason: 'This is the newer direct preference.',
              }],
            }),
            callId: 'repair-review',
            name: 'memory_candidate_review',
          })
        }
        if (dispatch === 3) {
          return completedCommit(numberedEvidenceAnswer(
            'You now prefer the Nova.',
            [{ row: oldRow, used: false }, {
              row: { memoryNumber: 99, text: 'Invented.' },
            }],
          ), { callId: 'malformed-bounded-commit' })
        }
        assert.deepEqual(body.tool_choice, {
          name: OPENAI_ANSWER_COMMIT_TOOL_NAME,
          type: 'function',
        })
        assert.ok(body.input.some((item) =>
          item.type === 'function_call_output' &&
          item.call_id === 'malformed-bounded-commit' &&
          /memoryNumber.*shown/.test(
            JSON.parse(item.output).rejection,
          )))
        return completedCommit(numberedEvidenceAnswer(
          'You now prefer the Nova.',
          [{ row: oldRow, used: false }, { row: newRow }],
        ), { callId: 'repaired-bounded-commit' })
      },
    })

    const result = await answerWithRetrieval(brain, {
      ...scope,
      confirmationProvider,
      maxConfirmationRetrievalCalls: 1,
      provider: initialProvider,
      question: 'Which notebook do I currently prefer?',
    })
    assert.equal(dispatch, 4)
    assert.equal(result.answer, 'You now prefer the Nova.')
    assert.equal(result.answerConfirmation.status, 'bounded_incomplete')
    assert.equal(result.answerConfirmation.reviewCalls, 1)
  })

test('real recommendation confirmation cannot close while omitting material evidence',
  async (t) => {
    const root = await mkdtemp(join(tmpdir(), 'palari-openai-recommendation-'))
    const brain = await createPalariBrain({
      memoryEnabled: true,
      statePath: join(root, 'state.json'),
      workspaceId: 'openai-recommendation',
    })
    t.after(async () => {
      brain.close()
      await rm(root, { force: true, recursive: true })
    })
    const scope = { palariId: 'palari', userId: 'user' }
    for (const [sourceMessageId, eventAt, userMessage] of [
      ['recommend-old:0', '2026-01-01T00:00:00.000Z',
        'My preferred notebook was the Atlas.'],
      ['recommend-new:0', '2026-02-01T00:00:00.000Z',
        'My preferred notebook is now the Nova.'],
    ]) {
      await ingestChatTurn(brain, {
        ...scope,
        assistantMessage: 'Recorded.',
        eventAt,
        retention: 'durable',
        sourceMessageId,
        userMessage,
      })
    }
    let oldRow
    const initialProvider = async ({ commitAnswer, retrieve }) => {
      const found = await retrieve({
        input: { before: '2026-01-31T23:59:59.999Z', phrase: 'notebook Atlas' },
        tool: 'memory_search',
      })
      oldRow = found.matches.find((row) =>
        row.speaker === 'user' && row.text.includes('Atlas'))
      return commitAnswer(recommendationAnswer(
        'Choose the Atlas.',
        [oldRow],
      ))
    }
    Object.defineProperty(initialProvider, 'requiresEvidenceCommitment', {
      value: true,
    })
    let dispatch = 0
    let newRow
    const confirmationProvider = createOpenAIRetrievalProvider({
      async invoke({ body }) {
        dispatch += 1
        if (dispatch === 1 || dispatch === 3) {
          if (dispatch === 1) {
            oldRow = {
              ...oldRow,
              memoryNumber: priorMemoryNumber(body, oldRow.evidenceId),
            }
          }
          return completedCall({
            arguments: '{"phrase":"current preferred notebook Nova"}',
            callId: `recommend-search-${dispatch}`,
            name: 'memory_search',
          })
        }
        if (dispatch === 2) {
          const output = body.input.find((item) =>
            item.type === 'function_call_output' &&
            item.call_id === 'recommend-search-1')
          const found = JSON.parse(output.output)
          newRow = found.matches.find((row) =>
            row.speaker === 'user' && row.text.includes('Nova'))
          return completedCall({
            arguments: JSON.stringify({
              findings: [{
                candidateNumber: newRow.candidateNumber,
                reason: 'This newer preference changes the recommendation.',
              }],
            }),
            callId: 'recommend-review',
            name: 'memory_candidate_review',
          })
        }
        if (dispatch === 4) {
          return completedCommit(numberedRecommendationAnswer(
            'Choose the Atlas.',
            [oldRow],
          ), { callId: 'stale-recommendation' })
        }
        assert.deepEqual(body.tool_choice, {
          name: OPENAI_ANSWER_COMMIT_TOOL_NAME,
          type: 'function',
        })
        const rejection = body.input.find((item) =>
          item.type === 'function_call_output' &&
          item.call_id === 'stale-recommendation')
        const rejectionText = JSON.parse(rejection.output).rejection
        assert.match(rejectionText, /omitted a previously material returned memory/)
        assert.doesNotMatch(rejectionText, /supportingEvidenceIds/)
        assert.ok(!rejectionText.includes(newRow.evidenceId))
        return completedCommit(numberedRecommendationAnswer(
          'Choose the Nova.',
          [newRow],
        ), { callId: 'corrected-recommendation' })
      },
    })

    const result = await answerWithRetrieval(brain, {
      ...scope,
      compositionMode: 'recommend',
      confirmationProvider,
      maxConfirmationRetrievalCalls: 2,
      provider: initialProvider,
      question: 'Which notebook should I choose?',
    })
    assert.equal(dispatch, 5)
    assert.equal(result.answer, 'Choose the Nova.')
    assert.equal(
      result.answerConfirmation.status,
      'closed_no_new_material_information',
    )
    assert.deepEqual(result.selectedEvidenceIds, [
      newRow.evidenceId,
    ])
  })

test('bounded recommendation confirmation cannot omit material evidence',
  async (t) => {
    const root = await mkdtemp(join(tmpdir(), 'palari-openai-bounded-recommend-'))
    const brain = await createPalariBrain({
      memoryEnabled: true,
      statePath: join(root, 'state.json'),
      workspaceId: 'openai-bounded-recommendation',
    })
    t.after(async () => {
      brain.close()
      await rm(root, { force: true, recursive: true })
    })
    const scope = { palariId: 'palari', userId: 'user' }
    for (const [sourceMessageId, eventAt, userMessage] of [
      ['bounded-recommend-old:0', '2026-01-01T00:00:00.000Z',
        'My preferred notebook was the Atlas.'],
      ['bounded-recommend-new:0', '2026-02-01T00:00:00.000Z',
        'My preferred notebook is now the Nova.'],
    ]) {
      await ingestChatTurn(brain, {
        ...scope,
        assistantMessage: 'Recorded.',
        eventAt,
        retention: 'durable',
        sourceMessageId,
        userMessage,
      })
    }
    let oldRow
    const initialProvider = async ({ commitAnswer, retrieve }) => {
      const found = await retrieve({
        input: { before: '2026-01-31T23:59:59.999Z', phrase: 'notebook Atlas' },
        tool: 'memory_search',
      })
      oldRow = found.matches.find((row) =>
        row.speaker === 'user' && row.text.includes('Atlas'))
      return commitAnswer(recommendationAnswer(
        'Choose the Atlas.',
        [oldRow],
      ))
    }
    Object.defineProperty(initialProvider, 'requiresEvidenceCommitment', {
      value: true,
    })
    let dispatch = 0
    let newRow
    const confirmationProvider = createOpenAIRetrievalProvider({
      async invoke({ body }) {
        dispatch += 1
        if (dispatch === 1) {
          oldRow = {
            ...oldRow,
            memoryNumber: priorMemoryNumber(body, oldRow.evidenceId),
          }
          return completedCall({
            arguments: '{"phrase":"current preferred notebook Nova"}',
            callId: 'bounded-recommend-search',
            name: 'memory_search',
          })
        }
        if (dispatch === 2) {
          const output = body.input.find((item) =>
            item.type === 'function_call_output' &&
            item.call_id === 'bounded-recommend-search')
          const found = JSON.parse(output.output)
          newRow = found.matches.find((row) =>
            row.speaker === 'user' && row.text.includes('Nova'))
          return completedCall({
            arguments: JSON.stringify({
              findings: [{
                candidateNumber: newRow.candidateNumber,
                reason: 'This newer preference changes the recommendation.',
              }],
            }),
            callId: 'bounded-recommend-review',
            name: 'memory_candidate_review',
          })
        }
        if (dispatch === 3) {
          return completedCommit(numberedRecommendationAnswer(
            'Choose the Atlas.',
            [oldRow],
          ), { callId: 'stale-bounded-recommendation' })
        }
        assert.deepEqual(body.tool_choice, {
          name: OPENAI_ANSWER_COMMIT_TOOL_NAME,
          type: 'function',
        })
        const rejection = body.input.find((item) =>
          item.type === 'function_call_output' &&
          item.call_id === 'stale-bounded-recommendation')
        const rejectionText = JSON.parse(rejection.output).rejection
        assert.match(rejectionText, /omitted a previously material returned memory/)
        assert.doesNotMatch(rejectionText, /supportingEvidenceIds/)
        assert.ok(!rejectionText.includes(newRow.evidenceId))
        return completedCommit(numberedRecommendationAnswer(
          'Choose the Nova.',
          [newRow],
        ), { callId: 'corrected-bounded-recommendation' })
      },
    })

    const result = await answerWithRetrieval(brain, {
      ...scope,
      compositionMode: 'recommend',
      confirmationProvider,
      maxConfirmationRetrievalCalls: 1,
      provider: initialProvider,
      question: 'Which notebook should I choose?',
    })
    assert.equal(dispatch, 4)
    assert.equal(result.answer, 'Choose the Nova.')
    assert.equal(result.answerConfirmation.status, 'bounded_incomplete')
    assert.deepEqual(result.selectedEvidenceIds, [
      newRow.evidenceId,
    ])
  })

test('non-empty fourth retrieval forces only commitment without spending a fifth memory call',
  async () => {
    const bodies = []
    let evidenceCount = 0
    let retrievals = 0
    const row = {
      evidenceId: 'evidence-final',
      text: 'The warranty record is in the violet folder.',
    }
    const proposal = evidenceAnswer(
      'The record points to the violet folder.',
      [{ row }],
    )
    const wireProposal = numberedEvidenceAnswer(proposal.text, [{ row }])
    const provider = createOpenAIRetrievalProvider({
      async invoke({ body }) {
        bodies.push(body)
        return bodies.length <= 4
          ? completedCall({ callId: `call_${bodies.length}` })
          : completedCommit(wireProposal, { callId: 'call_commit' })
      },
    })
    const result = await provider(answerSession({
      answerEvidenceCount: () => evidenceCount,
      commitAnswer: (received) => Object.freeze(received),
      async retrieve() {
        retrievals += 1
        evidenceCount = 1
        return {
          messages: [row],
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

test('dispatch exhaustion reserves bounded answer closure instead of dropping the result',
  async () => {
    const bodies = []
    let retrievals = 0
    const provider = createOpenAIRetrievalProvider({
      maxModelDispatches: 1,
      async invoke({ body }) {
        bodies.push(body)
        return bodies.length === 1
          ? completedCall({
              arguments: '{"phrase":"tea"}',
              callId: 'search-before-cap',
              name: 'memory_search',
            })
          : completedText('The information collected so far is insufficient.')
      },
    })

    const result = await provider(answerSession({
      async retrieve() {
        retrievals += 1
        return { matches: [] }
      },
    }))

    assert.equal(result.text,
      'The information collected so far is insufficient.')
    assert.equal(retrievals, 1)
    assert.equal(bodies.length, 2)
    assert.equal(bodies[1].tool_choice, 'none')
    assert.equal(Object.hasOwn(bodies[1], 'tools'), false)
    assert.match(bodies[1].instructions, /Retrieval is complete/)
  })

test('dispatch closure reviews only a pending page then commits bounded-incomplete',
  async () => {
    const bodies = []
    const row = {
      evidenceId: 'prior-evidence',
      text: 'The stored preference is jasmine tea.',
    }
    const proposal = evidenceAnswer('The user prefers jasmine tea.', [{ row }])
    const wireProposal = numberedEvidenceAnswer(proposal.text, [{ row }])
    let incompleteCommits = 0
    let reviews = 0
    let searches = 0
    const provider = createOpenAIRetrievalProvider({
      maxModelDispatches: 1,
      async invoke({ body }) {
        bodies.push(body)
        if (bodies.length === 1) {
          return completedCall({
            arguments: '{"phrase":"current tea preference"}',
            callId: 'confirmation-search',
            name: 'memory_search',
          })
        }
        if (bodies.length === 2) {
          return completedCall({
            arguments: '{"findings":[]}',
            callId: 'confirmation-review',
            name: 'memory_candidate_review',
          })
        }
        return completedCommit(wireProposal, { callId: 'bounded-commit' })
      },
    })

    const result = await provider(answerSession({
      answerConfirmationClosed: () => false,
      answerEvidenceCount: () => 1,
      answerPriorEvidence: [row],
      commitAnswer() {
        const error = new TypeError('Confirmation is bounded but incomplete.')
        error.code = 'MEMORY_ANSWER_CONFIRMATION_REQUIRED'
        throw error
      },
      commitIncompleteAnswer(received) {
        incompleteCommits += 1
        return Object.freeze(received)
      },
      maxRetrievalCalls: 1,
      retrievalTools: MEMORY_ANSWER_CONFIRMATION_TOOLS,
      async retrieve({ tool }) {
        if (tool === 'memory_search') {
          searches += 1
          return { matches: [{
            candidateNumber: 1,
            evidenceId: 'confirmation-candidate',
            text: 'No newer tea preference was recorded.',
          }] }
        }
        reviews += 1
        return { closed: false, continueSearch: true }
      },
    }))

    assert.deepEqual(result, proposal)
    assert.equal(searches, 1)
    assert.equal(reviews, 1)
    assert.equal(incompleteCommits, 1)
    assert.equal(bodies.length, 3)
    assert.deepEqual(
      bodies[1].tools.map(({ name }) => name),
      ['memory_candidate_review', OPENAI_ANSWER_COMMIT_TOOL_NAME],
    )
    assert.deepEqual(bodies[2].tool_choice, {
      name: OPENAI_ANSWER_COMMIT_TOOL_NAME,
      type: 'function',
    })
    assert.deepEqual(
      bodies[2].tools.map(({ name }) => name),
      [OPENAI_ANSWER_COMMIT_TOOL_NAME],
    )
  })

test('dispatch closure preserves one host commitment repair without reopening retrieval',
  async () => {
    const bodies = []
    let evidenceCount = 0
    const row = {
      evidenceId: 'tea-evidence',
      text: 'The user likes jasmine tea.',
    }
    const proposal = evidenceAnswer('The user likes jasmine tea.', [{ row }])
    const wireProposal = numberedEvidenceAnswer(proposal.text, [{ row }])
    const provider = createOpenAIRetrievalProvider({
      maxModelDispatches: 1,
      async invoke({ body }) {
        bodies.push(body)
        if (bodies.length === 1) {
          return completedCall({
            arguments: '{"phrase":"tea"}',
            callId: 'search-before-repair',
            name: 'memory_search',
          })
        }
        if (bodies.length === 2) {
          return completedCommit({
            ...wireProposal,
            bases: [{
              disposition: 'used',
              memoryNumber: 99,
              rationale: 'This determines the answer.',
            }],
          }, { callId: 'invalid-closure-commit' })
        }
        return completedCommit(wireProposal, {
          callId: 'repaired-closure-commit',
        })
      },
    })

    const result = await provider(answerSession({
      answerEvidenceCount: () => evidenceCount,
      commitAnswer(received) {
        return Object.freeze(received)
      },
      async retrieve() {
        evidenceCount = 1
        return { matches: [row] }
      },
    }))

    assert.deepEqual(result, proposal)
    assert.equal(bodies.length, 3)
    assert.ok(bodies.slice(1).every((body) =>
      body.tools.length === 1 &&
      body.tools[0].name === OPENAI_ANSWER_COMMIT_TOOL_NAME))
    assert.match(
      JSON.stringify(bodies[2].input),
      /must be an answer-local memoryNumber already shown/,
    )
  })

test('dispatch closure rejects mixed non-offered and unknown tools without repair',
  async (t) => {
    for (const forbiddenName of ['memory_search', 'not_a_real_tool']) {
      await t.test(forbiddenName, async () => {
        const bodies = []
        let evidenceCount = 0
        let retrievals = 0
        const row = {
          evidenceId: 'tea-evidence',
          text: 'The user likes jasmine tea.',
        }
        const wireProposal = numberedEvidenceAnswer(
          'The user likes jasmine tea.',
          [{ row }],
        )
        const provider = createOpenAIRetrievalProvider({
          maxModelDispatches: 1,
          async invoke({ body }) {
            bodies.push(body)
            if (bodies.length === 1) {
              return completedCall({
                arguments: '{"phrase":"tea"}',
                callId: 'search-before-closure',
                name: 'memory_search',
              })
            }
            const response = completedCommit(wireProposal, {
              callId: 'mixed-commit',
            })
            response.output.push(completedCall({
              arguments: forbiddenName === 'memory_search'
                ? '{"phrase":"forbidden new search"}'
                : '{}',
              callId: 'mixed-forbidden-tool',
              name: forbiddenName,
            }).output[1])
            return response
          },
        })

        await assert.rejects(
          provider(answerSession({
            answerEvidenceCount: () => evidenceCount,
            async retrieve() {
              retrievals += 1
              evidenceCount = 1
              return { matches: [row] }
            },
          })),
          (error) => error.code === 'OPENAI_FUNCTION_UNKNOWN',
        )
        assert.equal(bodies.length, 2)
        assert.equal(retrievals, 1)
      })
    }
  })

test('dispatch closure remains terminal after its two physical calls',
  async () => {
    const bodies = []
    const row = {
      evidenceId: 'prior-evidence',
      text: 'The stored preference is jasmine tea.',
    }
    const wireProposal = numberedEvidenceAnswer(
      'The user prefers jasmine tea.',
      [{ row }],
    )
    const provider = createOpenAIRetrievalProvider({
      maxModelDispatches: 1,
      async invoke({ body }) {
        bodies.push(body)
        if (bodies.length === 1) {
          return completedCall({
            arguments: '{"phrase":"current tea preference"}',
            callId: 'confirmation-search',
            name: 'memory_search',
          })
        }
        if (bodies.length === 2) {
          return completedCall({
            arguments: '{"findings":[]}',
            callId: 'confirmation-review',
            name: 'memory_candidate_review',
          })
        }
        return completedCommit(wireProposal, { callId: 'bounded-commit' })
      },
    })
    const confirmationRequired = () => {
      const error = new TypeError('A newer commitment is still required.')
      error.code = 'MEMORY_ANSWER_CONFIRMATION_REQUIRED'
      throw error
    }

    await assert.rejects(
      provider(answerSession({
        answerConfirmationClosed: () => false,
        answerEvidenceCount: () => 1,
        answerPriorEvidence: [row],
        commitAnswer: confirmationRequired,
        commitIncompleteAnswer: confirmationRequired,
        maxRetrievalCalls: 1,
        retrievalTools: MEMORY_ANSWER_CONFIRMATION_TOOLS,
        async retrieve({ tool }) {
          return tool === 'memory_search'
            ? { matches: [{
                candidateNumber: 1,
                evidenceId: 'confirmation-candidate',
                text: 'A candidate was returned.',
              }] }
            : { closed: false, continueSearch: true }
        },
      })),
      (error) => error.code === 'OPENAI_MODEL_DISPATCH_BUDGET_EXHAUSTED',
    )
    assert.equal(bodies.length, 3)
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
            disposition: 'used',
            memoryNumber: found.matches[0].memoryNumber,
            rationale: 'This determines the answer.',
          }],
          temporaryInferences: [],
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
      (error) => error.code === 'OPENAI_FUNCTION_UNKNOWN',
    )
    assert.throws(
      () => createOpenAIRetrievalProvider({
        async invoke() {},
        maxModelDispatches: 12,
      }),
      /maxModelDispatches cannot exceed 11/,
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

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  JOURNAL_NAVIGATION_INSTRUCTIONS,
  JOURNAL_NAVIGATION_TOOLS,
} from '../evals/arms/journal-navigation-arm.mjs'
import {
  JOURNAL_NAVIGATION_GEMINI_GENERATION,
  JOURNAL_NAVIGATION_GEMINI_MAX_MODEL_DISPATCHES,
  JOURNAL_NAVIGATION_GEMINI_MAX_TOOL_CALLS,
  JOURNAL_NAVIGATION_GEMINI_SMOKE_PHRASE,
  JOURNAL_NAVIGATION_GEMINI_SMOKE_TOKEN,
  JOURNAL_NAVIGATION_GEMINI_SYSTEM_INSTRUCTION,
  JOURNAL_NAVIGATION_GEMINI_TOOL_CONFIG,
  JOURNAL_NAVIGATION_GEMINI_TOOLS,
  assertJournalNavigationGeminiResponse,
  buildJournalNavigationGeminiInitialBody,
  buildJournalNavigationGeminiNextBody,
  createJournalNavigationGeminiAnswerProvider,
  runJournalNavigationGeminiCompatibilitySmoke,
} from '../evals/arms/journal-navigation-gemini-live-adapter.mjs'
import {
  memoryAnswerSystemInstruction,
} from '../src/index.mjs'

const MODEL = 'gemini-test-model'

function functionResult(functionCalls, candidateParts) {
  return {
    candidateContent: {
      parts: candidateParts ??
        functionCalls.map((functionCall) => ({ functionCall })),
      role: 'model',
    },
    finishReason: 'STOP',
    functionCalls,
    modelVersion: MODEL,
    responseType: 'function_calls',
    text: null,
    validated: true,
  }
}

function finalResult(text) {
  return {
    candidateContent: {
      parts: [{ text }],
      role: 'model',
    },
    finishReason: 'STOP',
    functionCalls: [],
    modelVersion: MODEL,
    responseType: 'final_text',
    text,
    validated: true,
  }
}

function providerContext(overrides = {}) {
  return {
    explore: async () => ({ operation: 'memory_timeline', sessions: [] }),
    explorationInstructions: JOURNAL_NAVIGATION_INSTRUCTIONS,
    explorationTools: JOURNAL_NAVIGATION_TOOLS,
    memoryText: '',
    questionText: 'Question: What did I say?',
    systemInstruction: memoryAnswerSystemInstruction,
    ...overrides,
  }
}

test('Gemini navigation mapping is one small frozen AUTO contract', () => {
  assert.deepEqual(JOURNAL_NAVIGATION_GEMINI_GENERATION, {
    candidateCount: 1,
    maxOutputTokens: 256,
    thinkingConfig: { thinkingBudget: 0 },
  })
  assert.equal(JOURNAL_NAVIGATION_GEMINI_MAX_MODEL_DISPATCHES, 7)
  assert.equal(JOURNAL_NAVIGATION_GEMINI_MAX_TOOL_CALLS, 6)
  assert.deepEqual(JOURNAL_NAVIGATION_GEMINI_TOOL_CONFIG, {
    functionCallingConfig: { mode: 'AUTO' },
  })
  assert.equal(
    JOURNAL_NAVIGATION_GEMINI_SYSTEM_INSTRUCTION,
    [memoryAnswerSystemInstruction, JOURNAL_NAVIGATION_INSTRUCTIONS]
      .join('\n\n'),
  )
  assert.deepEqual(
    JOURNAL_NAVIGATION_GEMINI_TOOLS[0].functionDeclarations
      .map(({ name }) => name),
    ['memory_timeline', 'memory_find', 'memory_read'],
  )
  assert.deepEqual(
    JOURNAL_NAVIGATION_GEMINI_TOOLS[0].functionDeclarations[0]
      .parameters,
    { properties: {}, type: 'object' },
  )
  assert.ok(Object.isFrozen(JOURNAL_NAVIGATION_GEMINI_GENERATION))
  assert.ok(Object.isFrozen(JOURNAL_NAVIGATION_GEMINI_TOOLS))

  const body = buildJournalNavigationGeminiInitialBody({
    memoryText: 'EMPTY DIGEST',
    questionText: 'Question: What is my access value?',
  })
  assert.deepEqual(body, {
    contents: [{
      parts: [{
        text: 'EMPTY DIGEST\n\nQuestion: What is my access value?',
      }],
      role: 'user',
    }],
    generationConfig: JOURNAL_NAVIGATION_GEMINI_GENERATION,
    store: false,
    systemInstruction: {
      parts: [{ text: JOURNAL_NAVIGATION_GEMINI_SYSTEM_INSTRUCTION }],
    },
    toolConfig: JOURNAL_NAVIGATION_GEMINI_TOOL_CONFIG,
    tools: JOURNAL_NAVIGATION_GEMINI_TOOLS,
  })
  assert.equal(JSON.stringify(body).includes('reference answer'), false)
  assert.equal(JSON.stringify(body).includes('answer_session'), false)
})

test('continuation preserves exact model content and ordered optional IDs',
  () => {
    const initial = buildJournalNavigationGeminiInitialBody({
      questionText: 'Question: locate it.',
    })
    const calls = [
      {
        args: { phrase: 'safe combination' },
        id: 'call-1',
        name: 'memory_find',
      },
      {
        args: {},
        name: 'memory_timeline',
      },
    ]
    const candidateContent = {
      parts: [
        {
          text: 'I will inspect memory.',
          thoughtSignature: 'opaque-text-signature',
        },
        {
          functionCall: calls[0],
          thoughtSignature: 'opaque-find-signature',
        },
        {
          functionCall: calls[1],
          thoughtSignature: 'opaque-timeline-signature',
        },
      ],
      role: 'model',
    }
    const results = [
      { matches: [], operation: 'memory_find' },
      { operation: 'memory_timeline', sessions: [] },
    ]
    const next = buildJournalNavigationGeminiNextBody({
      candidateContent,
      functionCalls: calls,
      previousBody: initial,
      toolResults: results,
    })

    assert.deepEqual(next.contents[1], candidateContent)
    assert.deepEqual(next.contents[2], {
      parts: [
        {
          functionResponse: {
            id: 'call-1',
            name: 'memory_find',
            response: results[0],
          },
        },
        {
          functionResponse: {
            name: 'memory_timeline',
            response: results[1],
          },
        },
      ],
      role: 'user',
    })
    assert.equal(
      next.contents[1].parts[1].thoughtSignature,
      'opaque-find-signature',
    )
    assert.equal(initial.contents.length, 1)
  })

test('validated response cannot disagree with its exact candidate content',
  () => {
    const call = {
      args: { phrase: 'safe combination' },
      name: 'memory_find',
    }
    const functionResponse = functionResult([call])
    assert.equal(
      assertJournalNavigationGeminiResponse(functionResponse, MODEL),
      functionResponse,
    )
    const finalResponse = finalResult('The value is ORBIT-7731.')
    assert.equal(
      assertJournalNavigationGeminiResponse(finalResponse, MODEL),
      finalResponse,
    )
    assert.throws(
      () => assertJournalNavigationGeminiResponse({
        ...functionResponse,
        functionCalls: [{
          args: { phrase: 'different' },
          name: 'memory_find',
        }],
      }, MODEL),
      /altered or omitted/,
    )
    assert.throws(
      () => assertJournalNavigationGeminiResponse({
        ...finalResponse,
        validated: false,
      }, MODEL),
      /unvalidated/,
    )
    assert.throws(
      () => assertJournalNavigationGeminiResponse(
        finalResponse,
        'wrong-model',
      ),
      /unvalidated/,
    )
  })

test('answer provider executes one bounded native loop without losing signatures',
  async () => {
    const requests = []
    const operationDispatches = []
    const toolRequests = []
    const functionCall = {
      args: { phrase: 'safe combination' },
      id: 'provider-call-1',
      name: 'memory_find',
    }
    const candidateContent = {
      parts: [{
        functionCall,
        thoughtSignature: 'opaque-provider-signature',
      }],
      role: 'model',
    }
    const provider = createJournalNavigationGeminiAnswerProvider({
      async callGemini(request) {
        requests.push(structuredClone(request))
        if (requests.length === 1) {
          return functionResult([functionCall], candidateContent.parts)
        }
        assert.deepEqual(
          request.body.contents[1],
          candidateContent,
        )
        assert.deepEqual(
          request.body.contents[2].parts[0].functionResponse,
          {
            id: 'provider-call-1',
            name: 'memory_find',
            response: {
              matches: [{ evidenceId: 'evidence-1' }],
              operation: 'memory_find',
            },
          },
        )
        return finalResult('The value is ORBIT-7731.')
      },
      cellId: 'question-1',
      expectedModel: MODEL,
      operationIdFactory(dispatch) {
        operationDispatches.push(dispatch)
        return `question-1:explore:${dispatch}`
      },
    })

    const answer = await provider(providerContext({
      async explore(request) {
        toolRequests.push(structuredClone(request))
        return {
          matches: [{ evidenceId: 'evidence-1' }],
          operation: 'memory_find',
        }
      },
    }))
    assert.deepEqual(answer, { text: 'The value is ORBIT-7731.' })
    assert.deepEqual(operationDispatches, [1, 2])
    assert.deepEqual(toolRequests, [{
      input: { phrase: 'safe combination' },
      tool: 'memory_find',
    }])
    assert.deepEqual(
      requests.map(({ operationId, purpose }) => ({
        operationId,
        purpose,
      })),
      [
        {
          operationId: 'question-1:explore:1',
          purpose: 'explore',
        },
        {
          operationId: 'question-1:explore:2',
          purpose: 'explore',
        },
      ],
    )
  })

test('answer provider refuses oversized tool batches before host execution',
  async () => {
    const calls = Array.from({ length: 7 }, (_, index) => ({
      args: {},
      id: `call-${index + 1}`,
      name: 'memory_timeline',
    }))
    let hostExecutions = 0
    const provider = createJournalNavigationGeminiAnswerProvider({
      callGemini: async () => functionResult(calls),
      cellId: 'budget-check',
      expectedModel: MODEL,
      operationIdFactory: (dispatch) => `budget-check:${dispatch}`,
    })
    await assert.rejects(
      provider(providerContext({
        async explore() {
          hostExecutions += 1
          return { operation: 'memory_timeline', sessions: [] }
        },
      })),
      (error) => error.code === 'NAVIGATION_BUDGET_EXHAUSTED',
    )
    assert.equal(hostExecutions, 0)
  })

test('compatibility smoke requires one find turn followed by exact token',
  async () => {
    const requests = []
    const smoke = await runJournalNavigationGeminiCompatibilitySmoke({
      async callGemini(request) {
        requests.push(structuredClone(request))
        if (requests.length === 1) {
          assert.equal(
            JSON.stringify(request.body)
              .includes(JOURNAL_NAVIGATION_GEMINI_SMOKE_TOKEN),
            false,
          )
          return functionResult([{
            args: { phrase: JOURNAL_NAVIGATION_GEMINI_SMOKE_PHRASE },
            id: 'smoke-call-1',
            name: 'memory_find',
          }])
        }
        assert.match(
          JSON.stringify(request.body.contents.at(-1)),
          new RegExp(JOURNAL_NAVIGATION_GEMINI_SMOKE_TOKEN),
        )
        return finalResult(JOURNAL_NAVIGATION_GEMINI_SMOKE_TOKEN)
      },
      cellId: 'compatibility-smoke',
      expectedModel: MODEL,
      operationIdFactory: (dispatch) =>
        `compatibility-smoke:explore:${dispatch}`,
    })

    assert.deepEqual(smoke, {
      modelDispatches: 2,
      text: JOURNAL_NAVIGATION_GEMINI_SMOKE_TOKEN,
      toolCalls: [{
        input: { phrase: JOURNAL_NAVIGATION_GEMINI_SMOKE_PHRASE },
        tool: 'memory_find',
      }],
    })
    assert.equal(requests.length, 2)
    assert.throws(
      () => createJournalNavigationGeminiAnswerProvider({
        callGemini: async () => finalResult('unused'),
        cellId: 'duplicate-operation',
        expectedModel: MODEL,
      }),
      /operationIdFactory/,
    )
  })

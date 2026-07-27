// Minimal Gemini-native adapter for the journal-navigation arm.
//
// This module maps the provider-neutral answer session onto the already
// metered hard-cap Gemini transport. It owns no credentials, network access,
// retry policy, dataset knowledge, or scoring logic.

import {
  memoryAnswerSystemInstruction,
} from '../../src/index.mjs'
import {
  JOURNAL_NAVIGATION_INSTRUCTIONS,
  JOURNAL_NAVIGATION_TOOLS,
} from './journal-navigation-arm.mjs'

export const JOURNAL_NAVIGATION_GEMINI_MAX_MODEL_DISPATCHES = 7
export const JOURNAL_NAVIGATION_GEMINI_MAX_TOOL_CALLS = 6

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value
  }
  for (const child of Object.values(value)) deepFreeze(child)
  return Object.freeze(value)
}

function clone(value) {
  return structuredClone(value)
}

function plainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function exactKeys(value, expected) {
  return plainObject(value) &&
    sameJson(Object.keys(value).sort(), [...expected].sort())
}

function nonEmpty(value, label) {
  const text = String(value ?? '').trim()
  if (!text) throw new TypeError(`${label} must be a non-empty string.`)
  return text
}

function adapterError(code, message) {
  const error = new Error(message)
  error.name = 'JournalNavigationGeminiAdapterError'
  error.code = code
  return error
}

export const JOURNAL_NAVIGATION_GEMINI_GENERATION = deepFreeze({
  candidateCount: 1,
  maxOutputTokens: 256,
  thinkingConfig: {
    thinkingBudget: 0,
  },
})

export const JOURNAL_NAVIGATION_GEMINI_SYSTEM_INSTRUCTION = [
  memoryAnswerSystemInstruction,
  JOURNAL_NAVIGATION_INSTRUCTIONS,
].join('\n\n')

export const JOURNAL_NAVIGATION_GEMINI_TOOLS = deepFreeze([{
  functionDeclarations: JOURNAL_NAVIGATION_TOOLS.map((tool) => ({
    description: tool.description,
    name: tool.name,
    // Gemini requires an object schema even for a no-argument function.
    parameters: clone(tool.parameters ?? {
      properties: {},
      type: 'object',
    }),
  })),
}])

export const JOURNAL_NAVIGATION_GEMINI_TOOL_CONFIG = deepFreeze({
  functionCallingConfig: {
    mode: 'AUTO',
  },
})

function navigationBody(contents) {
  return {
    contents: clone(contents),
    generationConfig: clone(JOURNAL_NAVIGATION_GEMINI_GENERATION),
    store: false,
    systemInstruction: {
      parts: [{
        text: JOURNAL_NAVIGATION_GEMINI_SYSTEM_INSTRUCTION,
      }],
    },
    toolConfig: clone(JOURNAL_NAVIGATION_GEMINI_TOOL_CONFIG),
    tools: clone(JOURNAL_NAVIGATION_GEMINI_TOOLS),
  }
}

export function buildJournalNavigationGeminiInitialBody({
  memoryText,
  questionText,
} = {}) {
  const question = nonEmpty(questionText, 'questionText')
  const text = [String(memoryText ?? ''), question]
    .filter(Boolean)
    .join('\n\n')
  return navigationBody([{
    parts: [{ text }],
    role: 'user',
  }])
}

const TOOL_NAMES = new Set(
  JOURNAL_NAVIGATION_TOOLS.map(({ name }) => name),
)

function assertFunctionCall(value) {
  const expectedKeys = Object.hasOwn(value ?? {}, 'id')
    ? ['args', 'id', 'name']
    : ['args', 'name']
  if (!plainObject(value) ||
    !sameJson(Object.keys(value).sort(), expectedKeys) ||
    !TOOL_NAMES.has(value.name) ||
    !plainObject(value.args) ||
    (Object.hasOwn(value, 'id') &&
      (typeof value.id !== 'string' || !value.id.trim()))) {
    throw adapterError(
      'NAVIGATION_FUNCTION_CALL_INVALID',
      'Gemini returned an unknown or malformed journal function call.',
    )
  }
}

function candidateParts(candidateContent) {
  if (!exactKeys(candidateContent, ['parts', 'role']) ||
    candidateContent.role !== 'model' ||
    !Array.isArray(candidateContent.parts) ||
    candidateContent.parts.length < 1) {
    throw adapterError(
      'NAVIGATION_RESPONSE_INVALID',
      'Gemini returned malformed journal-navigation content.',
    )
  }

  const functionCalls = []
  const visibleText = []
  for (const part of candidateContent.parts) {
    if (!plainObject(part)) {
      throw adapterError(
        'NAVIGATION_RESPONSE_INVALID',
        'Gemini returned a malformed journal-navigation part.',
      )
    }
    if (Object.hasOwn(part, 'functionCall')) {
      const expectedPartKeys = Object.hasOwn(part, 'thoughtSignature')
        ? ['functionCall', 'thoughtSignature']
        : ['functionCall']
      assertFunctionCall(part.functionCall)
      if (!sameJson(Object.keys(part).sort(), expectedPartKeys) ||
        (Object.hasOwn(part, 'thoughtSignature') &&
          (typeof part.thoughtSignature !== 'string' ||
            !part.thoughtSignature.trim()))) {
        throw adapterError(
          'NAVIGATION_RESPONSE_INVALID',
          'Gemini returned a malformed journal function-call part.',
        )
      }
      functionCalls.push(clone(part.functionCall))
      continue
    }

    if (typeof part.text !== 'string' ||
      (Object.hasOwn(part, 'thought') && part.thought !== false) ||
      (Object.hasOwn(part, 'thoughtSignature') &&
        (typeof part.thoughtSignature !== 'string' ||
          !part.thoughtSignature.trim())) ||
      (Object.hasOwn(part, 'partMetadata') &&
        !plainObject(part.partMetadata)) ||
      Object.keys(part).some((key) => ![
        'partMetadata',
        'text',
        'thought',
        'thoughtSignature',
      ].includes(key))) {
      throw adapterError(
        'NAVIGATION_RESPONSE_INVALID',
        'Gemini returned a malformed journal-navigation text part.',
      )
    }
    visibleText.push(part.text)
  }
  return {
    functionCalls,
    visibleText: visibleText.join('').trim(),
  }
}

export function assertJournalNavigationGeminiResponse(
  response,
  expectedModel,
) {
  const model = nonEmpty(expectedModel, 'expectedModel')
  if (response?.validated !== true ||
    response.finishReason !== 'STOP' ||
    response.modelVersion !== model ||
    !['final_text', 'function_calls'].includes(response.responseType) ||
    !Array.isArray(response.functionCalls)) {
    throw adapterError(
      'NAVIGATION_RESPONSE_INVALID',
      'Gemini returned an unvalidated journal-navigation response.',
    )
  }

  const candidate = candidateParts(response.candidateContent)
  if (response.responseType === 'function_calls') {
    for (const functionCall of response.functionCalls) {
      assertFunctionCall(functionCall)
    }
    if (response.text !== null ||
      response.functionCalls.length < 1 ||
      !sameJson(candidate.functionCalls, response.functionCalls)) {
      throw adapterError(
        'NAVIGATION_RESPONSE_INVALID',
        'Gemini altered or omitted a journal function-call batch.',
      )
    }
  } else if (response.functionCalls.length !== 0 ||
    candidate.functionCalls.length !== 0 ||
    typeof response.text !== 'string' ||
    !response.text.trim() ||
    candidate.visibleText !== response.text) {
    throw adapterError(
      'NAVIGATION_RESPONSE_INVALID',
      'Gemini returned malformed final journal-navigation text.',
    )
  }
  return response
}

export function buildJournalNavigationGeminiNextBody({
  candidateContent,
  functionCalls,
  previousBody,
  toolResults,
} = {}) {
  if (!plainObject(previousBody) ||
    !Array.isArray(previousBody.contents) ||
    !Array.isArray(functionCalls) ||
    functionCalls.length < 1 ||
    !Array.isArray(toolResults) ||
    toolResults.length !== functionCalls.length) {
    throw new TypeError(
      'A continuation requires one result for every ordered function call.',
    )
  }
  const candidate = candidateParts(candidateContent)
  if (!sameJson(candidate.functionCalls, functionCalls)) {
    throw new TypeError(
      'Continuation calls must match the exact candidate content.',
    )
  }
  for (const result of toolResults) {
    if (!plainObject(result)) {
      throw new TypeError(
        'Every journal function response must be an object.',
      )
    }
  }

  const responseContent = {
    parts: functionCalls.map((functionCall, index) => {
      const functionResponse = {
        name: functionCall.name,
        response: clone(toolResults[index]),
      }
      if (Object.hasOwn(functionCall, 'id')) {
        functionResponse.id = functionCall.id
      }
      return { functionResponse }
    }),
    role: 'user',
  }
  return {
    ...clone(previousBody),
    contents: [
      ...clone(previousBody.contents),
      clone(candidateContent),
      responseContent,
    ],
  }
}

export function createJournalNavigationGeminiAnswerProvider({
  callGemini,
  cellId,
  expectedModel,
  operationIdFactory,
} = {}) {
  if (typeof callGemini !== 'function') {
    throw new TypeError('A metered callGemini function is required.')
  }
  const cell = nonEmpty(cellId, 'cellId')
  const model = nonEmpty(expectedModel, 'expectedModel')
  if (typeof operationIdFactory !== 'function') {
    throw new TypeError('An operationIdFactory function is required.')
  }

  return async function journalNavigationGeminiAnswerProvider({
    explore,
    explorationInstructions,
    explorationTools,
    memoryText,
    questionText,
    systemInstruction,
  } = {}) {
    if (typeof explore !== 'function' ||
      systemInstruction !== memoryAnswerSystemInstruction ||
      explorationInstructions !== JOURNAL_NAVIGATION_INSTRUCTIONS ||
      !sameJson(explorationTools, JOURNAL_NAVIGATION_TOOLS)) {
      throw adapterError(
        'NAVIGATION_PRODUCT_BOUNDARY_CHANGED',
        'The product journal-navigation contract changed before Gemini mapping.',
      )
    }

    let body = buildJournalNavigationGeminiInitialBody({
      memoryText,
      questionText,
    })
    let toolCalls = 0
    const operationIds = new Set()

    for (let dispatch = 1;
      dispatch <= JOURNAL_NAVIGATION_GEMINI_MAX_MODEL_DISPATCHES;
      dispatch += 1) {
      const operationId = nonEmpty(
        operationIdFactory(dispatch),
        `operationId for dispatch ${dispatch}`,
      )
      if (operationIds.has(operationId)) {
        throw adapterError(
          'NAVIGATION_OPERATION_ID_REUSED',
          'Each Gemini model dispatch requires a fresh operationId.',
        )
      }
      operationIds.add(operationId)

      const response = assertJournalNavigationGeminiResponse(
        await callGemini({
          body: clone(body),
          cellId: cell,
          operationId,
          purpose: 'explore',
        }),
        model,
      )
      if (response.responseType === 'final_text') {
        return { text: response.text }
      }

      const remaining =
        JOURNAL_NAVIGATION_GEMINI_MAX_TOOL_CALLS - toolCalls
      if (dispatch === JOURNAL_NAVIGATION_GEMINI_MAX_MODEL_DISPATCHES ||
        response.functionCalls.length > remaining) {
        throw adapterError(
          'NAVIGATION_BUDGET_EXHAUSTED',
          'Gemini requested journal tools outside the frozen call budget.',
        )
      }

      const functionCalls = clone(response.functionCalls)
      const toolResults = []
      for (const functionCall of functionCalls) {
        const result = await explore({
          input: clone(functionCall.args),
          tool: functionCall.name,
        })
        if (!plainObject(result) || result.exhausted === true) {
          throw adapterError(
            'NAVIGATION_TOOL_RESULT_INVALID',
            'Journal exploration returned an invalid or exhausted result.',
          )
        }
        toolResults.push(clone(result))
      }
      toolCalls += functionCalls.length
      body = buildJournalNavigationGeminiNextBody({
        candidateContent: response.candidateContent,
        functionCalls,
        previousBody: body,
        toolResults,
      })
    }

    throw adapterError(
      'NAVIGATION_BUDGET_EXHAUSTED',
      'Gemini did not answer within the frozen model-dispatch budget.',
    )
  }
}

export const JOURNAL_NAVIGATION_GEMINI_SMOKE_PHRASE =
  'compatibility token'
export const JOURNAL_NAVIGATION_GEMINI_SMOKE_TOKEN =
  'PALARI-COMPAT-7319'

export async function runJournalNavigationGeminiCompatibilitySmoke({
  callGemini,
  cellId,
  expectedModel,
  operationIdFactory,
  providerContext,
} = {}) {
  let modelDispatches = 0
  const toolCalls = []
  const toolResults = []
  const provider = createJournalNavigationGeminiAnswerProvider({
    async callGemini(request) {
      modelDispatches += 1
      if (modelDispatches > 2) {
        throw adapterError(
          'NAVIGATION_SMOKE_INVALID',
          'Compatibility smoke attempted more than two model dispatches.',
        )
      }
      return callGemini(request)
    },
    cellId,
    expectedModel,
    operationIdFactory,
  })
  const context = providerContext ?? {}
  const hostExplore = typeof context.explore === 'function'
    ? context.explore
    : async () => ({
        chars: 96,
        matches: [{
          evidenceId: 'compatibility-smoke:evidence:1',
          matchOffset: 4,
          observedAt: '2026-07-27T00:00:00.000Z',
          session: 'compatibility-smoke',
          snippet:
            `The compatibility token is ${JOURNAL_NAVIGATION_GEMINI_SMOKE_TOKEN}.`,
          snippetIsPartial: false,
          sourceKind: 'user_message',
          speaker: 'user',
        }],
        operation: 'memory_find',
        phrase: JOURNAL_NAVIGATION_GEMINI_SMOKE_PHRASE,
        truncated: false,
      })
  const result = await provider({
    async explore(request) {
      toolCalls.push(clone(request))
      if (toolCalls.length !== 1 ||
        request.tool !== 'memory_find' ||
        !sameJson(request.input, {
          phrase: JOURNAL_NAVIGATION_GEMINI_SMOKE_PHRASE,
        })) {
        throw adapterError(
          'NAVIGATION_SMOKE_INVALID',
          'Compatibility smoke requires exactly one prescribed memory_find call.',
        )
      }
      const toolResult = await hostExplore(request)
      const matches = toolResult?.matches
      if (!plainObject(toolResult) ||
        toolResult.operation !== 'memory_find' ||
        !Array.isArray(matches) ||
        matches.length !== 1 ||
        typeof matches[0]?.evidenceId !== 'string' ||
        !matches[0].evidenceId ||
        !String(matches[0]?.snippet ?? '')
          .includes(JOURNAL_NAVIGATION_GEMINI_SMOKE_TOKEN)) {
        throw adapterError(
          'NAVIGATION_SMOKE_INVALID',
          'Compatibility smoke did not receive its one canonical canary row.',
        )
      }
      toolResults.push(clone(toolResult))
      return toolResult
    },
    explorationInstructions:
      context.explorationInstructions ??
        JOURNAL_NAVIGATION_INSTRUCTIONS,
    explorationTools:
      context.explorationTools ?? JOURNAL_NAVIGATION_TOOLS,
    memoryText: String(context.memoryText ?? ''),
    questionText: [
      'Compatibility smoke only.',
      `Call memory_find exactly once with phrase "${JOURNAL_NAVIGATION_GEMINI_SMOKE_PHRASE}".`,
      'After its result, answer with exactly the compatibility-token value returned by memory_find and no other text.',
    ].join('\n'),
    systemInstruction:
      context.systemInstruction ?? memoryAnswerSystemInstruction,
  })

  if (modelDispatches !== 2 ||
    toolCalls.length !== 1 ||
    toolResults.length !== 1 ||
    result.text !== JOURNAL_NAVIGATION_GEMINI_SMOKE_TOKEN) {
    throw adapterError(
      'NAVIGATION_SMOKE_INVALID',
      'Compatibility smoke did not complete one tool turn and one exact answer turn.',
    )
  }
  return {
    modelDispatches,
    text: result.text,
    toolCalls: clone(toolCalls),
  }
}

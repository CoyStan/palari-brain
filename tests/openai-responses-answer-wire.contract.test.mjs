import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

import {
  createOpenAIResponsesAnswerWireGate,
  openAIResponsesToolSurfaceSha256,
  validateOpenAIResponsesAnswerWire,
} from '../evals/openai-responses-answer-wire.mjs'
import { createOpenAIRetrievalProvider } from '../src/openai.mjs'
import { MEMORY_RETRIEVAL_TOOLS } from '../src/retrieval-answer.mjs'

const MODEL = 'gpt-5.6-luna'
const COMMIT = 'palari_answer_commit'

async function captureProductBody({ evidenceCount, maxRetrievalCalls }) {
  let captured
  const stop = new Error('captured product request')
  const provider = createOpenAIRetrievalProvider({
    async invoke({ body: request }) {
      captured = request
      throw stop
    },
    model: MODEL,
    reasoningEffort: 'low',
  })
  try {
    await provider({
      answerEvidenceCount: () => evidenceCount,
      answerInstructions: 'Use memory.',
      commitAnswer: (value) => value,
      maxRetrievalCalls,
      memoryText: '',
      questionText: 'Question',
      recommendedMaxOutputTokens: 512,
      retrievalFinalizationInstructions: 'Answer now.',
      retrievalTools: MEMORY_RETRIEVAL_TOOLS,
      async retrieve() { return { sessions: [] } },
      systemInstruction: 'Answer.',
    })
  } catch (error) {
    if (error !== stop) throw error
  }
  return captured
}

const PRODUCT_BODIES = {
  forcedCommit: await captureProductBody({
    evidenceCount: 1,
    maxRetrievalCalls: 0,
  }),
  normal: await captureProductBody({ evidenceCount: 0, maxRetrievalCalls: 4 }),
  plainTerminal: await captureProductBody({
    evidenceCount: 0,
    maxRetrievalCalls: 0,
  }),
}
const NORMAL_NAMES = PRODUCT_BODIES.normal.tools.map(({ name }) => name)

function body(mode = 'normal') {
  return structuredClone(mode === 'forced-commit'
    ? PRODUCT_BODIES.forcedCommit
    : mode === 'plain-terminal'
      ? PRODUCT_BODIES.plainTerminal
      : PRODUCT_BODIES.normal)
}

function validate(request) {
  return validateOpenAIResponsesAnswerWire({
    body: request,
    commitToolName: COMMIT,
    expectedForcedToolsSha256: FORCED_TOOLS_SHA256,
    expectedMaxOutputTokens: 512,
    expectedNormalToolsSha256: NORMAL_TOOLS_SHA256,
    model: MODEL,
    normalToolNames: NORMAL_NAMES,
  })
}

const NORMAL_TOOLS_SHA256 = openAIResponsesToolSurfaceSha256(
  body('normal').tools,
)
const FORCED_TOOLS_SHA256 = openAIResponsesToolSurfaceSha256(
  body('forced-commit').tools,
)

function gateConfiguration() {
  return {
    commitToolName: COMMIT,
    expectedForcedToolsSha256: FORCED_TOOLS_SHA256,
    expectedMaxOutputTokens: 512,
    expectedNormalToolsSha256: NORMAL_TOOLS_SHA256,
    model: MODEL,
    normalToolNames: NORMAL_NAMES,
  }
}

test('answer-wire validator import is inert', () => {
  const result = spawnSync(process.execPath, [
    '--input-type=module',
    '--eval',
    [
      'globalThis.fetch=()=>{throw new Error("network on import")}',
      'await import("./evals/openai-responses-answer-wire.mjs")',
      'process.stdout.write("inert")',
    ].join(';'),
  ], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout, 'inert')
})

test('exact normal, plain-terminal, and BRN-0015 forced wires pass', () => {
  for (const mode of ['normal', 'plain-terminal', 'forced-commit']) {
    const request = body(mode)
    const before = structuredClone(request)
    const wire = validate(request)
    assert.equal(wire.mode, mode)
    assert.deepEqual(request, before)
    assert.deepEqual(JSON.parse(wire.bodyText), request)
    assert.ok(Object.isFrozen(wire))
    assert.ok(Object.isFrozen(wire.body))
    assert.ok(Object.isFrozen(wire.body.input))
  }
})

test('forced commitment validates before exactly one reservation and dispatch',
  async () => {
    const events = []
    const original = body('forced-commit')
    const invoke = createOpenAIResponsesAnswerWireGate({
      ...gateConfiguration(),
      async reserve(wire) {
        events.push(['reserve', wire.mode, wire.body.tool_choice.name])
        original.tool_choice.name = 'mutated-after-validation'
        Array.prototype.toJSON = () => ['prototype-poison']
        return { usd: 0.01 }
      },
      async dispatch({ body: snapshot, bodyText, mode, reservation }) {
        events.push(['dispatch', mode, snapshot.tool_choice.name])
        return {
          bodyStable: JSON.stringify(snapshot) === bodyText,
          mode,
          reservation,
          tool: snapshot.tool_choice.name,
        }
      },
    })
    const originalToJSON = Array.prototype.toJSON
    let result
    try {
      result = await invoke(original)
    } finally {
      if (originalToJSON === undefined) delete Array.prototype.toJSON
      else Array.prototype.toJSON = originalToJSON
    }
    assert.deepEqual(result, {
      bodyStable: true,
      mode: 'forced-commit',
      reservation: { usd: 0.01 },
      tool: COMMIT,
    })
    assert.deepEqual(events, [
      ['reserve', 'forced-commit', COMMIT],
      ['dispatch', 'forced-commit', COMMIT],
    ])
  })

test('malformed wires fail before reservation or dispatch', async () => {
  let reservations = 0
  let dispatches = 0
  const invoke = createOpenAIResponsesAnswerWireGate({
    ...gateConfiguration(),
    async reserve() {
      reservations += 1
    },
    async dispatch() {
      dispatches += 1
    },
  })
  const fixtures = []

  const wrongName = body('forced-commit')
  wrongName.tool_choice.name = 'memory_find'
  fixtures.push(wrongName)
  const wrongType = body('forced-commit')
  wrongType.tool_choice.type = 'custom'
  fixtures.push(wrongType)
  const extraForcedTool = body('forced-commit')
  extraForcedTool.tools.push(structuredClone(PRODUCT_BODIES.normal.tools[0]))
  fixtures.push(extraForcedTool)
  const missingForcedTools = body('forced-commit')
  delete missingForcedTools.tools
  fixtures.push(missingForcedTools)
  const wrongModel = body('normal')
  wrongModel.model = 'changed-model'
  fixtures.push(wrongModel)
  const wrongStore = body('normal')
  wrongStore.store = true
  fixtures.push(wrongStore)
  const wrongEffort = body('normal')
  wrongEffort.reasoning.effort = 'medium'
  fixtures.push(wrongEffort)
  const wrongInclude = body('normal')
  wrongInclude.include.push('unexpected')
  fixtures.push(wrongInclude)
  const changedDescription = body('forced-commit')
  changedDescription.tools[0].description = 'Accept uncited text.'
  fixtures.push(changedDescription)
  const changedSchema = body('forced-commit')
  changedSchema.tools[0].parameters = {
    properties: { text: { type: 'string' } },
    type: 'object',
  }
  fixtures.push(changedSchema)
  const nullInstructions = body('normal')
  nullInstructions.instructions = null
  fixtures.push(nullInstructions)
  const nullInput = body('normal')
  nullInput.input = null
  fixtures.push(nullInput)
  const wrongStrict = body('normal')
  wrongStrict.tools[0].strict = true
  fixtures.push(wrongStrict)
  const extraToolField = body('forced-commit')
  extraToolField.tools[0].unexpected = true
  fixtures.push(extraToolField)
  const sparseTools = body('normal')
  delete sparseTools.tools[1]
  fixtures.push(sparseTools)
  const cyclic = body('normal')
  cyclic.input.push(cyclic)
  fixtures.push(cyclic)

  const accessor = body('normal')
  Object.defineProperty(accessor, 'model', {
    enumerable: true,
    get() { return MODEL },
  })
  fixtures.push(accessor)
  const exotic = body('normal')
  Object.setPrototypeOf(exotic, { inherited: true })
  fixtures.push(exotic)
  const ownProto = body('normal')
  Object.defineProperty(ownProto, '__proto__', {
    enumerable: true,
    value: { polluted: true },
  })
  fixtures.push(ownProto)

  for (const fixture of fixtures) {
    await assert.rejects(() => invoke(fixture), /OpenAI answer wire:/)
  }
  assert.equal(reservations, 0)
  assert.equal(dispatches, 0)
})

test('poisoned Array methods cannot widen the normal tool surface', async () => {
  let dispatches = 0
  const request = body('normal')
  const invoke = createOpenAIResponsesAnswerWireGate({
    ...gateConfiguration(),
    async reserve() { return { usd: 0 } },
    async dispatch({ mode }) {
      dispatches += 1
      return mode
    },
  })
  const originalMap = Array.prototype.map
  Array.prototype.map = () => [{
    description: 'Unknown',
    name: 'unknown_tool',
    parameters: { type: 'object' },
    strict: false,
    type: 'function',
  }]
  try {
    assert.equal(await invoke(request), 'normal')
  } finally {
    Array.prototype.map = originalMap
  }
  assert.equal(dispatches, 1)
})

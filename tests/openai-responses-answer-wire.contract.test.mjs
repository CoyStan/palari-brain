import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

import {
  createOpenAIResponsesAnswerWireGate,
  validateOpenAIResponsesAnswerWire,
} from '../evals/openai-responses-answer-wire.mjs'

const MODEL = 'gpt-5.6-luna'
const COMMIT = 'palari_answer_commit'
const NORMAL_NAMES = [
  'memory_status',
  'memory_timeline',
  'memory_search',
  'memory_read',
  'memory_find',
  COMMIT,
]

function tool(name) {
  return {
    description: `${name} fixture`,
    name,
    parameters: { additionalProperties: false, type: 'object' },
    strict: name === COMMIT,
    type: 'function',
  }
}

function body(mode = 'normal') {
  const common = {
    include: ['reasoning.encrypted_content'],
    input: [{ content: 'Question', role: 'user' }],
    instructions: 'Use memory and commit cited answers.',
    max_output_tokens: 512,
    model: MODEL,
    parallel_tool_calls: false,
    reasoning: { effort: 'low' },
    store: false,
  }
  if (mode === 'plain-terminal') {
    return { ...common, tool_choice: 'none' }
  }
  if (mode === 'forced-commit') {
    return {
      ...common,
      tool_choice: { name: COMMIT, type: 'function' },
      tools: [tool(COMMIT)],
    }
  }
  return {
    ...common,
    tool_choice: 'auto',
    tools: NORMAL_NAMES.map(tool),
  }
}

function validate(request) {
  return validateOpenAIResponsesAnswerWire({
    body: request,
    commitToolName: COMMIT,
    expectedMaxOutputTokens: 512,
    model: MODEL,
    normalToolNames: NORMAL_NAMES,
  })
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
      commitToolName: COMMIT,
      expectedMaxOutputTokens: 512,
      model: MODEL,
      normalToolNames: NORMAL_NAMES,
      async reserve(wire) {
        events.push(['reserve', wire.mode, wire.body.tool_choice.name])
        original.tool_choice.name = 'mutated-after-validation'
        return { usd: 0.01 }
      },
      async dispatch({ body: snapshot, mode, reservation }) {
        events.push(['dispatch', mode, snapshot.tool_choice.name])
        return { mode, reservation, tool: snapshot.tool_choice.name }
      },
    })
    const result = await invoke(original)
    assert.deepEqual(result, {
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
    commitToolName: COMMIT,
    expectedMaxOutputTokens: 512,
    model: MODEL,
    normalToolNames: NORMAL_NAMES,
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
  extraForcedTool.tools.push(tool('memory_find'))
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

  for (const fixture of fixtures) {
    await assert.rejects(() => invoke(fixture), /OpenAI answer wire:/)
  }
  assert.equal(reservations, 0)
  assert.equal(dispatches, 0)
})

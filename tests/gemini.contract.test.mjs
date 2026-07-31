import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MEMORY_RETRIEVAL_TOOLS,
} from '../src/index.mjs'
import {
  buildGeminiFunctionTools,
  buildGeminiGenerateRequest,
} from '../src/gemini.mjs'

test('Gemini mapping preserves root-property anyOf as raw JSON Schema',
  () => {
    const read = MEMORY_RETRIEVAL_TOOLS.find(({ name }) =>
      name === 'memory_read')
    const canonical = structuredClone(read.parameters)
    const mapped = buildGeminiFunctionTools([read])
    const declaration = mapped[0].functionDeclarations[0]
    const wireSchema = declaration.parametersJsonSchema

    assert.deepEqual(read.parameters, canonical)
    assert.equal(Object.hasOwn(declaration, 'parameters'), false)
    assert.notEqual(wireSchema, read.parameters)
    assert.deepEqual(wireSchema, canonical)
    assert.deepEqual(wireSchema.properties, canonical.properties)
    assert.deepEqual(
      wireSchema.anyOf.map(({ required }) => required),
      [['evidenceIds'], ['session']],
    )
    assert.deepEqual(
      wireSchema.anyOf.map((branch) =>
        Object.hasOwn(branch, 'properties')),
      [false, false],
    )
    assert.equal(wireSchema.type, 'object')
  })

test('Gemini tool mapping uses raw JSON Schema without mutation',
  () => {
    const canonical = structuredClone(MEMORY_RETRIEVAL_TOOLS)
    const mapped = buildGeminiFunctionTools(MEMORY_RETRIEVAL_TOOLS)
    const declarations = mapped[0].functionDeclarations

    assert.deepEqual(MEMORY_RETRIEVAL_TOOLS, canonical)
    assert.deepEqual(
      declarations.map(({ name }) => name),
      MEMORY_RETRIEVAL_TOOLS.map(({ name }) => name),
    )
    assert.deepEqual(
      declarations.find(({ name }) => name === 'memory_timeline')
        .parametersJsonSchema,
      MEMORY_RETRIEVAL_TOOLS[0].parameters,
    )
    assert.equal(
      declarations.find(({ name }) => name === 'memory_read')
        .parametersJsonSchema.anyOf.length,
      2,
    )
    assert.ok(declarations.every((declaration) =>
      !Object.hasOwn(declaration, 'parameters')))
  })

test('Gemini tool mapping supplies an object schema and fails closed', () => {
  const [mapped] = buildGeminiFunctionTools([{ name: 'ping' }])
  assert.deepEqual(
    mapped.functionDeclarations[0].parametersJsonSchema,
    { properties: {}, type: 'object' },
  )
  assert.throws(
    () => buildGeminiFunctionTools([{
      name: 'bad',
      parameters: [],
    }]),
    /parametersJsonSchema must be an object schema/,
  )
  assert.throws(() => buildGeminiFunctionTools([]), /non-empty array/)
})

test('Gemini REST wire uses parametersJsonSchema, never legacy parameters',
  () => {
    const tools = buildGeminiFunctionTools(MEMORY_RETRIEVAL_TOOLS)
    const request = buildGeminiGenerateRequest({
      apiKey: 'offline-test-key',
      body: { contents: [], tools },
      model: 'offline-test-model',
    })
    const wire = JSON.parse(request.init.body)
    const declarations = wire.tools[0].functionDeclarations
    const read = declarations.find(({ name }) => name === 'memory_read')

    assert.equal(Object.hasOwn(read, 'parameters'), false)
    assert.deepEqual(
      read.parametersJsonSchema,
      MEMORY_RETRIEVAL_TOOLS.find(({ name }) =>
        name === 'memory_read').parameters,
    )
    assert.equal(read.parametersJsonSchema.type, 'object')
    assert.equal(read.parametersJsonSchema.anyOf.length, 2)
  })

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MEMORY_RETRIEVAL_TOOLS,
} from '../src/index.mjs'
import {
  buildGeminiFunctionTools,
  lowerGeminiFunctionParameters,
} from '../src/gemini.mjs'

test('Gemini lowering preserves a root-property anyOf with branch-local selectors',
  () => {
    const read = MEMORY_RETRIEVAL_TOOLS.find(({ name }) =>
      name === 'memory_read')
    const canonical = structuredClone(read.parameters)
    const lowered = lowerGeminiFunctionParameters(read.parameters)

    assert.deepEqual(read.parameters, canonical)
    assert.notEqual(lowered, read.parameters)
    assert.deepEqual(lowered.properties, canonical.properties)
    assert.deepEqual(
      lowered.anyOf.map(({ required }) => required),
      [['evidenceIds'], ['session']],
    )
    assert.deepEqual(
      lowered.anyOf.map(({ properties }) => Object.keys(properties)),
      [['evidenceIds'], ['session']],
    )
    assert.deepEqual(
      lowered.anyOf[0].properties.evidenceIds,
      canonical.properties.evidenceIds,
    )
    assert.deepEqual(
      lowered.anyOf[1].properties.session,
      canonical.properties.session,
    )
    assert.equal(Object.hasOwn(lowered, 'anyOf'), true)
  })

test('Gemini tool mapping lowers all retrieval declarations without mutation',
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
        .parameters,
      MEMORY_RETRIEVAL_TOOLS[0].parameters,
    )
    assert.equal(
      declarations.find(({ name }) => name === 'memory_read')
        .parameters.anyOf.length,
      2,
    )
  })

test('Gemini lowering fails closed on undefined branch requirements', () => {
  assert.throws(
    () => lowerGeminiFunctionParameters({
      anyOf: [{ required: ['missing'], type: 'object' }],
      properties: {},
      type: 'object',
    }),
    /requires undefined property missing/,
  )
  assert.throws(() => buildGeminiFunctionTools([]), /non-empty array/)
})

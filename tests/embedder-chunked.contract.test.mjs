import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createChunkedEmbedder } from '../src/embedder.mjs'

test('long canonical texts become bounded chunks and one normalized vector',
  async () => {
    const calls = []
    const embedder = createChunkedEmbedder({
      maxChunkChars: 4,
      embed: async (chunks) => {
        calls.push([...chunks])
        return chunks.map((chunk) => [chunk.length, 1])
      },
    })

    const vectors = await embedder(['abcdefghij', 'xy'])

    assert.deepEqual(calls, [['abcd', 'efgh', 'ij', 'xy']])
    assert.equal(vectors.length, 2)
    assert.ok(Math.abs(vectors[0][0] - (10 / 3) / Math.hypot(10 / 3, 1)) < 1e-12)
    assert.ok(Math.abs(vectors[0][1] - 1 / Math.hypot(10 / 3, 1)) < 1e-12)
    assert.deepEqual(vectors[1], [2 / Math.sqrt(5), 1 / Math.sqrt(5)])
  })

test('chunk order preserves canonical input order without mutating inputs',
  async () => {
    const texts = ['12345', 'abcde']
    const before = [...texts]
    const embedder = createChunkedEmbedder({
      maxChunkChars: 3,
      embed: async (chunks) => chunks.map((chunk, index) => [index + 1, 1]),
    })

    const vectors = await embedder(texts)

    assert.deepEqual(texts, before)
    assert.equal(vectors.length, texts.length)
    assert.ok(vectors[0][0] < vectors[1][0])
  })

test('configuration and canonical inputs are bounded explicitly', async () => {
  assert.throws(() => createChunkedEmbedder(), /requires embed/)
  assert.throws(
    () => createChunkedEmbedder({ embed: async () => [], maxChunkChars: 0 }),
    /positive safe integer/,
  )
  const embedder = createChunkedEmbedder({
    embed: async () => [],
    maxChunkChars: 4,
  })
  await assert.rejects(embedder([]), /non-empty text array/)
  await assert.rejects(embedder(['  ']), /non-empty string/)
})

test('provider vector count, dimensions, values, and magnitude are validated',
  async () => {
    const make = (embed) => createChunkedEmbedder({ embed, maxChunkChars: 2 })
    await assert.rejects(make(async () => [])(['abcd']), /one vector per derived chunk/)
    await assert.rejects(
      make(async () => [[1, 2], [1]])(['abcd']),
      /share one dimension/,
    )
    await assert.rejects(
      make(async () => [[1, 2], [Number.NaN, 1]])(['abcd']),
      /must be finite/,
    )
    await assert.rejects(
      make(async () => [[1, 0], [-1, 0]])(['abcd']),
      /finite magnitude/,
    )
  })

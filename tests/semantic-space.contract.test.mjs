import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createPalariBrain, ingestChatTurn } from '../src/index.mjs'
const scope = { palariId: 'space', userId: 'alice' }
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'palari-space-'))
  const brains = []
  t.after(async () => { for (const b of brains) b.close(); await rm(root, { force: true, recursive: true }) })
  return async options => {
    const brain = await createPalariBrain({ memoryEnabled: true, workspaceId: 'space',
      statePath: join(root, 'state.json'), ...options })
    brains.push(brain)
    return brain
  }
}
async function seed(brain) {
  await ingestChatTurn(brain, { ...scope, retention: 'durable', sourceMessageId: 'space:1',
    eventAt: '2025-01-01T00:00:00.000Z', userMessage: 'The key is in the pot.', assistantMessage: 'Noted.' })
}
test('query dimensions and Float32 values must match the stored vector space', async t => {
  const open = await fixture(t)
  let vector = [1, 100]
  const brain = await open({ embedder: async texts => texts.map(() => vector) })
  await seed(brain)
  await brain.indexSemantic(scope)
  for (vector of [[1], [NaN, 1], [Infinity, 1], [1e40, 1]]) {
    await assert.rejects(brain.exploreSemantic(scope, { phrase: 'key' }), /vector|dimension|finite/i)
  }
})
test('a changed embedding ID rebuilds same-dimensional stored vectors', async t => {
  const open = await fixture(t)
  const first = await open({ embeddingId: 'model-a/preprocess-v1/2d', embedder: async texts => texts.map(() => [1, 0]) })
  await seed(first)
  await first.indexSemantic(scope)
  const second = await open({ embeddingId: 'model-b/preprocess-v1/2d', embedder: async texts => texts.map(() => [0, 1]) })
  const found = await second.exploreSemantic(scope, { phrase: 'key' })
  assert.equal(found[0].similarity, 1)
  const restarted = await open({ embeddingId: 'model-b/preprocess-v1/2d', embedder: async texts => {
    assert.deepEqual(texts, ['query-only'])
    return [[0, 1]]
  } })
  assert.equal((await restarted.exploreSemantic(scope, { phrase: 'query-only' }))[0].similarity, 1)
})
test('query embedding cannot cross an asynchronous embedding configuration change', async t => {
  const open = await fixture(t)
  let onQuery = null
  const first = await open({ embeddingId: 'a', embedder: async texts => {
    if (onQuery) { const callback = onQuery; onQuery = null; await callback() }
    return texts.map(() => [1, 0])
  } })
  await seed(first)
  await first.indexSemantic(scope)
  const second = await open({ embeddingId: 'b', embedder: async texts => texts.map(() => [0, 1]) })
  onQuery = () => second.indexSemantic(scope)
  await assert.rejects(first.exploreSemantic(scope, { phrase: 'key' }), /configuration.*changed/i)
})

test('an old indexing batch cannot overwrite a newer configuration', async t => {
  const open = await fixture(t)
  let second
  const first = await open({ embeddingId: 'a', embedder: async texts => {
    await second.indexSemantic(scope)
    return texts.map(() => [1, 0])
  } })
  await seed(first)
  second = await open({ embeddingId: 'b', embedder: async texts => texts.map(() => [0, 1]) })
  await assert.rejects(first.indexSemantic(scope), /configuration.*changed/i)
  assert.equal((await second.exploreSemantic(scope, { phrase: 'key' }))[0].similarity, 1)
})

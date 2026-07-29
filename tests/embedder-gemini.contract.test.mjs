import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { createPalariBrain, ingestChatTurn } from '../src/index.mjs'
import {
  buildGeminiEmbedBatches,
  createGeminiEmbedder,
  GEMINI_EMBEDDER_BATCH_LIMIT,
  GEMINI_EMBEDDER_MODEL,
  GEMINI_EMBEDDER_TASK_TYPE,
  normalizeGeminiEmbedResponse,
} from '../evals/arms/embedder-gemini.mjs'

test('batches carry the frozen model, symmetric task type, and cap', () => {
  const texts = Array.from({ length: 250 }, (_, i) => `text ${i}`)
  const batches = buildGeminiEmbedBatches(texts)
  assert.deepEqual(
    batches.map((batch) => batch.texts.length),
    [100, 100, 50],
  )
  assert.equal(GEMINI_EMBEDDER_BATCH_LIMIT, 100)
  for (const { body, texts: chunk } of batches) {
    assert.equal(body.requests.length, chunk.length)
    for (const [index, request] of body.requests.entries()) {
      assert.equal(request.model, `models/${GEMINI_EMBEDDER_MODEL}`)
      // ONE embed function serves both stored rows and lookup queries, so
      // the task type must be symmetric or cosine ranking quietly degrades.
      assert.equal(request.taskType, GEMINI_EMBEDDER_TASK_TYPE)
      assert.equal(request.content.parts[0].text, chunk[index])
    }
  }
})

test('input validation refuses empty and oversized texts', () => {
  assert.throws(() => buildGeminiEmbedBatches([]))
  assert.throws(() => buildGeminiEmbedBatches(['ok', '   ']))
  assert.throws(() => buildGeminiEmbedBatches(['x'.repeat(8_001)]))
})

test('response normalization is strict and fail-closed', () => {
  const good = {
    embeddings: [{ values: [1, 0] }, { values: [0, 1] }],
  }
  assert.deepEqual(
    normalizeGeminiEmbedResponse(good, 2),
    [[1, 0], [0, 1]],
  )
  const rejects = (response, expected, code) => {
    assert.throws(
      () => normalizeGeminiEmbedResponse(response, expected),
      (error) => error.code === code,
    )
  }
  // No embeddings at all: a provider fault, classified separately.
  rejects({ embeddings: [] }, 1, 'GEMINI_EMBEDDER_EMPTY_RESPONSE')
  rejects({}, 1, 'GEMINI_EMBEDDER_EMPTY_RESPONSE')
  // Count mismatch: positional correlation is the only check available.
  rejects(good, 3, 'GEMINI_EMBEDDER_RESPONSE_INVALID')
  // Torn batch: inconsistent dimensions.
  rejects({
    embeddings: [{ values: [1, 0] }, { values: [1] }],
  }, 2, 'GEMINI_EMBEDDER_RESPONSE_INVALID')
  // Non-finite values cannot enter the vector table.
  rejects({
    embeddings: [{ values: [1, 'wat'] }],
  }, 1, 'GEMINI_EMBEDDER_RESPONSE_INVALID')
})

test('embedding order matches text order across batch boundaries',
  async () => {
    const dispatched = []
    const embed = createGeminiEmbedder({
      batchLimit: 2,
      invoke: async ({ batch, body }) => {
        dispatched.push(batch)
        return {
          embeddings: body.requests.map((request) => ({
            // Encode the text's own number so order errors are visible.
            values: [Number(request.content.parts[0].text.slice(5)), 1],
          })),
        }
      },
    })
    const vectors = await embed(['text 0', 'text 1', 'text 2', 'text 3',
      'text 4'])
    assert.deepEqual(dispatched, [0, 1, 2])
    assert.deepEqual(vectors.map((vector) => vector[0]), [0, 1, 2, 3, 4])
  })

test('a mid-run fault fails the whole call, never a torn result',
  async () => {
    const embed = createGeminiEmbedder({
      batchLimit: 1,
      invoke: async ({ batch, body }) => {
        if (batch === 1) throw new Error('boom')
        return {
          embeddings: body.requests.map(() => ({ values: [1, 0] })),
        }
      },
    })
    await assert.rejects(embed(['a', 'b']), /boom/)
  })

test('the adapter satisfies the brain embedder contract end to end',
  async (t) => {
    // Fake provider embeds by topic so cosine has something to rank: the
    // planted fact and the zero-overlap question share a direction no other
    // row has. The adapter's job — batching, order, normalization — is what
    // is under test; the vectors just need to be deterministic.
    const topical = (text) => [
      /key|pot|flat|apartment|get into/i.test(text) ? 1 : 0,
      /wifi|password|router/i.test(text) ? 1 : 0,
      /sister|ana|weekend/i.test(text) ? 1 : 0,
      1,
    ]
    const embedder = createGeminiEmbedder({
      invoke: async ({ body }) => ({
        embeddings: body.requests.map((request) => ({
          values: topical(request.content.parts[0].text),
        })),
      }),
    })
    const root = await mkdtemp(join(tmpdir(), 'palari-embed-gemini-'))
    const brain = await createPalariBrain({
      embedder,
      memoryEnabled: true,
      statePath: join(root, 'workspace-state.json'),
      workspaceId: 'embed-gemini',
    })
    t.after(async () => {
      brain.close()
      await rm(root, { force: true, recursive: true })
    })
    const scope = { palariId: 'p-embed', userId: 'u-embed' }
    const seed = [
      'I keep the spare key inside the blue ceramic pot on the balcony.',
      'The wifi password at the cabin is trout-river-42.',
      'My sister Ana visits every other weekend.',
    ]
    for (const [index, userMessage] of seed.entries()) {
      await ingestChatTurn(brain, {
        assistantMessage: 'Noted.',
        eventAt: `2026-01-0${index + 1}T00:00:00.000Z`,
        palariId: scope.palariId,
        retention: 'durable',
        sourceMessageId: `sess-e:${index}`,
        userId: scope.userId,
        userMessage,
      })
    }
    // The scale probe's exact lexical boundary: zero shared vocabulary.
    const found = await brain.exploreSemantic(scope, {
      phrase: 'how do I get into my flat',
    })
    assert.ok(found.length >= 1)
    assert.match(found[0].text, /blue ceramic pot/)
    assert.equal(found[0].speaker, 'user')
  })

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DEFAULT_TRANSFORMERS_RERANKER_MODEL,
  TRANSFORMERS_RERANKER_LIMITS,
  TRANSFORMERS_RERANKER_MODELS,
  createTransformersReranker,
} from '../src/reranker-transformers.mjs'

const expectedModels = {
  'cross-encoder/ms-marco-MiniLM-L6-v2': {
    dtype: 'fp32', license: 'Apache-2.0',
    revision: 'c5ee24cb16019beea0893ab7796b1df96625c6b8',
  },
  'cross-encoder/ms-marco-MiniLM-L12-v2': {
    dtype: 'fp32', license: 'Apache-2.0',
    revision: '7b0235231ca2674cb8ca8f022859a6eba2b1c968',
  },
  'mixedbread-ai/mxbai-rerank-xsmall-v1': {
    dtype: 'fp32', license: 'Apache-2.0',
    revision: 'b5c6e9da73abc3711f593f705371cdbe9e0fe422',
  },
  'cross-encoder/ettin-reranker-17m-v1': {
    dtype: 'fp32', language: 'en', license: 'Apache-2.0',
    revision: '9e4aa35321a6dd1a43ca313f500c4b4f7cfb5cc6',
  },
}

function fakeRuntime({ logits = [[0.1], [0.9]] } = {}) {
  const calls = { classifier: [], factory: [], tokenizer: [] }
  const tokenizer = async (...args) => {
    calls.tokenizer.push(args)
    return { input_ids: 'encoded' }
  }
  const classifier = async (input) => {
    calls.classifier.push(input)
    return { logits: { tolist: () => logits } }
  }
  return {
    calls,
    runtime: {
      AutoModelForSequenceClassification: {
        async from_pretrained(...args) {
          calls.factory.push(['model', ...args])
          return classifier
        },
      },
      AutoTokenizer: {
        async from_pretrained(...args) {
          calls.factory.push(['tokenizer', ...args])
          return tokenizer
        },
      },
    },
  }
}

test('model allowlist pins exact licensed revisions', () => {
  assert.equal(
    DEFAULT_TRANSFORMERS_RERANKER_MODEL,
    'cross-encoder/ms-marco-MiniLM-L6-v2',
  )
  assert.deepEqual(TRANSFORMERS_RERANKER_MODELS, expectedModels)
  assert.deepEqual(TRANSFORMERS_RERANKER_LIMITS, {
    candidates: 50,
    documentChars: 100_000,
    queryChars: 500,
  })
  assert.throws(
    () => createTransformersReranker({ modelId: 'latest' }),
    /Unsupported reranker model/,
  )
  assert.equal(createTransformersReranker().model.id,
    DEFAULT_TRANSFORMERS_RERANKER_MODEL)
})

test('adapter is lazy, pinned, pair-batched, and loads exactly once',
  async () => {
    const fake = fakeRuntime()
    let loads = 0
    const rerank = createTransformersReranker({
      cacheDir: '/private/cache',
      loadRuntime: async () => {
        loads += 1
        return fake.runtime
      },
      modelId: 'cross-encoder/ms-marco-MiniLM-L6-v2',
    })
    assert.equal(loads, 0)
    assert.deepEqual(await rerank('which note?', ['first', 'second']), [0.1, 0.9])
    assert.deepEqual(await rerank('which note?', ['first', 'second']), [0.1, 0.9])
    assert.equal(loads, 1)
    assert.equal(fake.calls.factory.length, 2)
    for (const [, id, options] of fake.calls.factory) {
      assert.equal(id, 'cross-encoder/ms-marco-MiniLM-L6-v2')
      assert.equal(options.revision, expectedModels[id].revision)
      assert.equal(options.cache_dir, '/private/cache')
    }
    assert.equal(fake.calls.factory[0][2].dtype, undefined)
    assert.equal(fake.calls.factory[1][2].dtype, 'fp32')
    assert.deepEqual(fake.calls.tokenizer[0], [
      ['which note?', 'which note?'],
      {
        padding: true,
        text_pair: ['first', 'second'],
        truncation: true,
      },
    ])
  })

test('adapter rejects overbounds and malformed runtime outputs', async () => {
  const rerank = createTransformersReranker({
    loadRuntime: async () => fakeRuntime().runtime,
    modelId: 'cross-encoder/ms-marco-MiniLM-L6-v2',
  })
  await assert.rejects(() => rerank('', ['a']), /non-empty/)
  await assert.rejects(
    () => rerank('q'.repeat(501), ['a']),
    /at most 500/,
  )
  await assert.rejects(
    () => rerank('q', Array(51).fill('a')),
    /at most 50/,
  )
  await assert.rejects(
    () => rerank('q', ['x'.repeat(100_001)]),
    /at most 100000/,
  )
  const wrongLength = createTransformersReranker({
    loadRuntime: async () => fakeRuntime({ logits: [[1]] }).runtime,
    modelId: 'cross-encoder/ms-marco-MiniLM-L6-v2',
  })
  await assert.rejects(
    () => wrongLength('q', ['a', 'b']),
    /invalid logits batch/,
  )
  const nonfinite = createTransformersReranker({
    loadRuntime: async () => fakeRuntime({ logits: [[NaN]] }).runtime,
    modelId: 'cross-encoder/ms-marco-MiniLM-L6-v2',
  })
  await assert.rejects(() => nonfinite('q', ['a']), /nonfinite logit/)
})

test('empty candidates do not load the optional runtime', async () => {
  let loaded = false
  const rerank = createTransformersReranker({
    loadRuntime: async () => {
      loaded = true
      return fakeRuntime().runtime
    },
    modelId: 'cross-encoder/ms-marco-MiniLM-L6-v2',
  })
  assert.deepEqual(await rerank('query', []), [])
  assert.equal(loaded, false)
})

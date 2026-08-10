import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DEFAULT_TRANSFORMERS_RERANKER_MODEL,
  RERANKER_EXECUTION_LIMITS,
  TRANSFORMERS_RERANKER_LIMITS,
  TRANSFORMERS_RERANKER_MODELS,
  createTransformersReranker,
  planRerankerBatches,
  runBatchedReranker,
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
    unsupportedReason:
      'The official ONNX export requires a separate Sentence Transformers modular head.',
  },
}

function fakeRuntime({ logits = [[0.1], [0.9]] } = {}) {
  const calls = {
    classifier: [],
    disposedInputs: 0,
    disposedModels: 0,
    disposedOutputs: 0,
    factory: [],
    tokenizer: [],
  }
  const tokenizer = async (...args) => {
    calls.tokenizer.push(args)
    return {
      documents: args[1].text_pair,
      input_ids: {
        dispose() { calls.disposedInputs += 1 },
      },
    }
  }
  tokenizer.encode = (_query, { text_pair: document }) =>
    Array(Math.max(3, document.length + 2)).fill(1)
  const classifier = async (input) => {
    calls.classifier.push(input)
    return {
      logits: {
        dispose() { calls.disposedOutputs += 1 },
        tolist: () => logits.slice(0, input.documents.length),
      },
    }
  }
  classifier.dispose = () => { calls.disposedModels += 1 }
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
  assert.deepEqual(RERANKER_EXECUTION_LIMITS, {
    maxBatchSize: 8,
    maxPaddedTokenWork: 2 ** 24,
    transformersMaxTokens: 512,
  })
  assert.throws(
    () => createTransformersReranker({ modelId: 'latest' }),
    /Unsupported reranker model/,
  )
  assert.equal(createTransformersReranker().model.id,
    DEFAULT_TRANSFORMERS_RERANKER_MODEL)
  assert.throws(
    () => createTransformersReranker({
      modelId: 'cross-encoder/ettin-reranker-17m-v1',
    }),
    (error) => error?.code === 'RERANKER_MODEL_UNSUPPORTED',
  )
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
        max_length: 512,
        padding: true,
        text_pair: ['first', 'second'],
        truncation: true,
      },
    ])
    assert.equal(fake.calls.disposedInputs, 2)
    assert.equal(fake.calls.disposedOutputs, 2)
  })

test('quadratic scheduler buckets stably and reports over-target singletons', () => {
  assert.deepEqual(
    planRerankerBatches([20, 5, 100, 6], {
      maxBatchSize: 2,
      maxPaddedTokenWork: 500,
    }),
    [
      {
        indexes: [1, 3],
        overTarget: false,
        paddedTokens: 6,
        paddedTokenWork: 72,
        size: 2,
      },
      {
        indexes: [0],
        overTarget: false,
        paddedTokens: 20,
        paddedTokenWork: 400,
        size: 1,
      },
      {
        indexes: [2],
        overTarget: true,
        paddedTokens: 100,
        paddedTokenWork: 10_000,
        size: 1,
      },
    ],
  )
})

test('adapter microbatches, restores order, serializes calls, and closes once',
  async () => {
    const fake = fakeRuntime({
      logits: [[0], [0]],
    })
    let active = 0
    let maximumActive = 0
    fake.runtime.AutoModelForSequenceClassification.from_pretrained =
      async (...args) => {
        fake.calls.factory.push(['model', ...args])
        const classifier = async (input) => {
          fake.calls.classifier.push(input)
          active += 1
          maximumActive = Math.max(maximumActive, active)
          await new Promise((resolve) => setImmediate(resolve))
          active -= 1
          return {
            logits: {
              dispose() { fake.calls.disposedOutputs += 1 },
              tolist: () => input.documents.map((document) => [document.length]),
            },
          }
        }
        classifier.dispose = () => { fake.calls.disposedModels += 1 }
        return classifier
      }
    const metrics = []
    const rerank = createTransformersReranker({
      loadRuntime: async () => fake.runtime,
      maxBatchSize: 2,
      maxPaddedTokenWork: 500,
      onMetrics(value) {
        metrics.push(value)
        throw new Error('diagnostic observer failed')
      },
    })
    const documents = ['long-value', 'x', 'medium']
    const [first, second] = await Promise.all([
      rerank('q', documents),
      rerank('q', documents),
    ])
    assert.deepEqual(first, documents.map((value) => value.length))
    assert.deepEqual(second, first)
    assert.equal(maximumActive, 1)
    assert.equal(fake.calls.classifier.length, 4)
    assert.equal(fake.calls.disposedInputs, 4)
    assert.equal(fake.calls.disposedOutputs, 4)
    assert.equal(metrics.length, 2)
    assert.ok(metrics.every(({ candidateCount }) => candidateCount === 3))
    assert.ok(metrics.every((value) =>
      JSON.stringify(value).includes('long-value') === false))
    await rerank.close()
    await rerank.close()
    assert.equal(fake.calls.disposedModels, 1)
    await assert.rejects(
      () => rerank('q', ['x']),
      (error) => error?.code === 'RERANKER_CLOSED',
    )
  })

test('microbatch cleanup covers inference, scoring, and disposal failures',
  async () => {
    const disposed = { inputs: 0, outputs: 0 }
    const tokenizer = async () => ({
      input_ids: { dispose() { disposed.inputs += 1 } },
    })
    tokenizer.encode = () => [1, 2, 3]
    const common = {
      documents: ['document'],
      maxTokens: 512,
      query: 'query',
      tokenizer,
    }
    await assert.rejects(
      () => runBatchedReranker({
        ...common,
        async infer() { throw new Error('native inference failed') },
        score() { return [1] },
      }),
      /native inference failed/,
    )
    assert.deepEqual(disposed, { inputs: 1, outputs: 0 })

    await assert.rejects(
      () => runBatchedReranker({
        ...common,
        async infer() {
          return { logits: { dispose() { disposed.outputs += 1 } } }
        },
        score() { throw new Error('head scoring failed') },
      }),
      /head scoring failed/,
    )
    assert.deepEqual(disposed, { inputs: 2, outputs: 1 })

    const brokenTokenizer = async () => {
      throw new Error('tokenization failed')
    }
    brokenTokenizer.encode = () => [1, 2, 3]
    await assert.rejects(
      () => runBatchedReranker({
        ...common,
        async infer() { return {} },
        score() { return [1] },
        tokenizer: brokenTokenizer,
      }),
      /tokenization failed/,
    )
    assert.deepEqual(disposed, { inputs: 2, outputs: 1 })

    await assert.rejects(
      () => runBatchedReranker({
        ...common,
        async infer() {
          return { logits: { dispose() { disposed.outputs += 1 } } }
        },
        score() { return [1] },
        tokenizer: Object.assign(async () => ({
          input_ids: {
            dispose() {
              disposed.inputs += 1
              throw new Error('input release failed')
            },
          },
        }), { encode: () => [1, 2, 3] }),
      }),
      (error) => error?.code === 'RERANKER_DISPOSAL_FAILED',
    )
    assert.deepEqual(disposed, { inputs: 3, outputs: 2 })
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

// Optional local cross-encoder adapter. The inference runtime is deliberately
// not a Palari dependency: consumers choose, install, and audit it separately.

import { performance } from 'node:perf_hooks'

export const TRANSFORMERS_RERANKER_LIMITS = Object.freeze({
  candidates: 50,
  documentChars: 100_000,
  queryChars: 500,
})

export const RERANKER_EXECUTION_LIMITS = Object.freeze({
  maxBatchSize: 8,
  maxPaddedTokenWork: 2 ** 24,
  transformersMaxTokens: 512,
})

async function rollbackLoadedComponents(components, loadFailure) {
  try {
    await disposeComponents(components)
  } catch (rollbackFailure) {
    const error = new AggregateError(
      [loadFailure, rollbackFailure],
      'Reranker load failed and component rollback was incomplete.',
    )
    error.code = 'RERANKER_LOAD_ROLLBACK_FAILED'
    throw error
  }
  throw loadFailure
}

export async function loadRerankerComponents(loaders, assemble) {
  if (!Array.isArray(loaders) || loaders.length < 1 ||
    loaders.some((loader) => typeof loader !== 'function') ||
    typeof assemble !== 'function') {
    throw new TypeError('Reranker component loaders and assembler are required.')
  }
  const settled = await Promise.allSettled(loaders.map((loader) =>
    Promise.resolve().then(loader)))
  const fulfilled = settled
    .filter(({ status }) => status === 'fulfilled')
    .map(({ value }) => value)
  const rejected = settled.find(({ status }) => status === 'rejected')
  if (rejected) {
    return rollbackLoadedComponents(fulfilled, rejected.reason)
  }
  const values = settled.map(({ value }) => value)
  try {
    return await assemble(values)
  } catch (error) {
    return rollbackLoadedComponents(values, error)
  }
}

export const TRANSFORMERS_RERANKER_MODELS = Object.freeze({
  'cross-encoder/ms-marco-MiniLM-L6-v2': Object.freeze({
    dtype: 'fp32',
    license: 'Apache-2.0',
    revision: 'c5ee24cb16019beea0893ab7796b1df96625c6b8',
  }),
  'cross-encoder/ms-marco-MiniLM-L12-v2': Object.freeze({
    dtype: 'fp32',
    license: 'Apache-2.0',
    revision: '7b0235231ca2674cb8ca8f022859a6eba2b1c968',
  }),
  'mixedbread-ai/mxbai-rerank-xsmall-v1': Object.freeze({
    dtype: 'fp32',
    license: 'Apache-2.0',
    revision: 'b5c6e9da73abc3711f593f705371cdbe9e0fe422',
  }),
  'cross-encoder/ettin-reranker-17m-v1': Object.freeze({
    dtype: 'fp32',
    language: 'en',
    license: 'Apache-2.0',
    revision: '9e4aa35321a6dd1a43ca313f500c4b4f7cfb5cc6',
    unsupportedReason:
      'The official ONNX export requires a separate Sentence Transformers modular head.',
  }),
})

// Selected by the preregistered BRN-0008 Pareto rule: eligible at 13/15
// top-1 and the fastest nondominated model at 44.63 warm ms/case.
export const DEFAULT_TRANSFORMERS_RERANKER_MODEL =
  'cross-encoder/ms-marco-MiniLM-L6-v2'

function boundedText(value, label, maximum) {
  if (typeof value !== 'string' || value.length < 1) {
    throw new TypeError(`${label} must be a non-empty string.`)
  }
  if (value.length > maximum) {
    throw new TypeError(`${label} must be at most ${maximum} characters.`)
  }
  return value
}

async function defaultRuntimeLoader() {
  try {
    return await import('@huggingface/transformers')
  } catch (error) {
    const failure = new Error(
      'The optional @huggingface/transformers runtime is not installed. ' +
      'Install and audit it in the consuming application, or provide loadRuntime.',
      { cause: error },
    )
    failure.code = 'RERANKER_RUNTIME_MISSING'
    throw failure
  }
}

function logitsToScores(logits, expected) {
  const rows = typeof logits?.tolist === 'function'
    ? logits.tolist()
    : logits
  if (!Array.isArray(rows) || rows.length !== expected) {
    throw new TypeError('Reranker runtime returned an invalid logits batch.')
  }
  return rows.map((row) => {
    const values = Array.isArray(row) ? row : [row]
    const score = values.at(-1)
    if (typeof score !== 'number' || !Number.isFinite(score)) {
      throw new TypeError('Reranker runtime returned a nonfinite logit.')
    }
    return score
  })
}

function positiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TypeError(`${label} must be a positive safe integer.`)
  }
  return value
}

function pairTokenLength(tokenizer, query, document, maxTokens) {
  if (typeof tokenizer?.encode !== 'function') {
    throw new TypeError('Reranker tokenizer must expose synchronous encode().')
  }
  const tokens = tokenizer.encode(query, {
    add_special_tokens: true,
    text_pair: document,
  })
  if (!Array.isArray(tokens) || tokens.length < 1) {
    throw new TypeError('Reranker tokenizer returned an invalid pair encoding.')
  }
  return Math.min(tokens.length, maxTokens)
}

export function planRerankerBatches(pairTokenLengths, {
  maxBatchSize = RERANKER_EXECUTION_LIMITS.maxBatchSize,
  maxPaddedTokenWork = RERANKER_EXECUTION_LIMITS.maxPaddedTokenWork,
} = {}) {
  if (!Array.isArray(pairTokenLengths) || pairTokenLengths.length < 1) {
    throw new TypeError('pairTokenLengths must be a non-empty array.')
  }
  positiveInteger(maxBatchSize, 'maxBatchSize')
  positiveInteger(maxPaddedTokenWork, 'maxPaddedTokenWork')
  const pending = pairTokenLengths.map((tokens, index) => ({
    index,
    tokens: positiveInteger(tokens, `pairTokenLengths[${index}]`),
  })).sort((left, right) => left.tokens - right.tokens || left.index - right.index)
  const batches = []
  let current = []
  const flush = () => {
    if (current.length === 0) return
    const paddedTokens = current.at(-1).tokens
    const paddedTokenWork = current.length * paddedTokens ** 2
    batches.push(Object.freeze({
      indexes: Object.freeze(current.map(({ index }) => index)),
      overTarget: paddedTokenWork > maxPaddedTokenWork,
      paddedTokens,
      paddedTokenWork,
      size: current.length,
    }))
    current = []
  }
  for (const item of pending) {
    const paddedTokens = item.tokens
    const nextSize = current.length + 1
    if (current.length > 0 && (nextSize > maxBatchSize ||
      nextSize * paddedTokens ** 2 > maxPaddedTokenWork)) {
      flush()
    }
    current.push(item)
  }
  flush()
  return Object.freeze(batches)
}

async function disposeValue(value, seen, failures) {
  if ((typeof value !== 'object' && typeof value !== 'function') ||
    value === null || seen.has(value)) return
  seen.add(value)
  if (typeof value.dispose === 'function') {
    try {
      await value.dispose()
    } catch (error) {
      failures.push(error)
    }
    return
  }
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return
  if (Array.isArray(value)) {
    for (const child of value) await disposeValue(child, seen, failures)
    return
  }
  for (const child of Object.values(value)) {
    await disposeValue(child, seen, failures)
  }
}

export async function disposeRerankerValues(...values) {
  const failures = []
  const seen = new Set()
  for (const value of values) await disposeValue(value, seen, failures)
  if (failures.length > 0) {
    const error = new AggregateError(
      failures,
      'Reranker tensor disposal failed.',
    )
    error.code = 'RERANKER_DISPOSAL_FAILED'
    throw error
  }
}

function emitMetrics(callback, metrics) {
  if (!callback) return
  try {
    Promise.resolve(callback(metrics)).catch(() => {})
  } catch {
    // Diagnostics must never change scoring behavior.
  }
}

export async function runBatchedReranker({
  documents,
  infer,
  maxBatchSize = RERANKER_EXECUTION_LIMITS.maxBatchSize,
  maxPaddedTokenWork = RERANKER_EXECUTION_LIMITS.maxPaddedTokenWork,
  maxTokens,
  onMetrics,
  query,
  score,
  tokenizer,
}) {
  positiveInteger(maxTokens, 'maxTokens')
  if (!Array.isArray(documents) || documents.length < 1 ||
    typeof infer !== 'function' || typeof score !== 'function') {
    throw new TypeError('A non-empty document batch, infer, and score are required.')
  }
  const lengths = documents.map((document) =>
    pairTokenLength(tokenizer, query, document, maxTokens))
  const batches = planRerankerBatches(lengths, {
    maxBatchSize,
    maxPaddedTokenWork,
  })
  const scores = Array(documents.length)
  const started = performance.now()
  const rssBefore = process.memoryUsage().rss
  let failureCode = null
  try {
    for (const batch of batches) {
      const batchDocuments = batch.indexes.map((index) => documents[index])
      let encoded
      let output
      let failure
      try {
        encoded = await tokenizer(
          batchDocuments.map(() => query),
          {
            max_length: maxTokens,
            padding: true,
            text_pair: batchDocuments,
            truncation: true,
          },
        )
        output = await infer(encoded)
        const batchScores = score(output, batch.size)
        if (!Array.isArray(batchScores) || batchScores.length !== batch.size ||
          batchScores.some((value) =>
            typeof value !== 'number' || !Number.isFinite(value))) {
          throw new TypeError(
            'Reranker runtime must return one finite score per microbatch item.',
          )
        }
        for (let index = 0; index < batch.size; index += 1) {
          scores[batch.indexes[index]] = batchScores[index]
        }
      } catch (error) {
        failure = error
        throw error
      } finally {
        try {
          await disposeRerankerValues(output, encoded)
        } catch (error) {
          if (!failure) throw error
        }
      }
    }
    return scores
  } catch (error) {
    failureCode = error?.code === 'RERANKER_DISPOSAL_FAILED'
      ? 'RERANKER_DISPOSAL_FAILED'
      : 'RERANKER_FAILED'
    throw error
  } finally {
    const metrics = Object.freeze({
      batchCount: batches.length,
      batches: Object.freeze(batches.map((batch) => Object.freeze({
        overTarget: batch.overTarget,
        paddedTokens: batch.paddedTokens,
        paddedTokenWork: batch.paddedTokenWork,
        size: batch.size,
      }))),
      candidateCount: documents.length,
      durationMs: performance.now() - started,
      failureCode,
      maxPairTokens: Math.max(...lengths),
      maxRss: process.resourceUsage().maxRSS * 1_024,
      maxTokens,
      minPairTokens: Math.min(...lengths),
      rssAfter: process.memoryUsage().rss,
      rssBefore,
      status: failureCode === null ? 'completed' : 'failed',
    })
    emitMetrics(onMetrics, metrics)
  }
}

function closedFailure() {
  const error = new Error('Reranker is closed.')
  error.code = 'RERANKER_CLOSED'
  return error
}

async function disposeComponents(components) {
  const failures = []
  const seen = new Set()
  for (const component of components) {
    if ((typeof component !== 'object' && typeof component !== 'function') ||
      component === null || seen.has(component)) continue
    seen.add(component)
    const dispose = typeof component.dispose === 'function'
      ? component.dispose
      : typeof component.release === 'function'
      ? component.release
      : null
    if (!dispose) continue
    try {
      await dispose.call(component)
    } catch (error) {
      failures.push(error)
    }
  }
  if (failures.length > 0) {
    const error = new AggregateError(failures, 'Reranker close failed.')
    error.code = 'RERANKER_CLOSE_FAILED'
    throw error
  }
}

export function createRerankerLifecycle(load, components) {
  let closed = false
  let closing
  let queue = Promise.resolve()
  const enqueue = (operation) => {
    if (closed) return Promise.reject(closedFailure())
    const result = queue.then(operation, operation)
    queue = result.catch(() => {})
    return result
  }
  const warm = () => enqueue(load)
  const close = () => {
    if (closing) return closing
    closed = true
    closing = queue.then(async () => {
      let loaded
      try {
        loaded = await components()
      } catch {
        return
      }
      await disposeComponents(loaded)
    })
    queue = closing.catch(() => {})
    return closing
  }
  return Object.freeze({ close, enqueue, warm })
}

export function createTransformersReranker({
  cacheDir,
  loadRuntime = defaultRuntimeLoader,
  maxBatchSize = RERANKER_EXECUTION_LIMITS.maxBatchSize,
  maxPaddedTokenWork = RERANKER_EXECUTION_LIMITS.maxPaddedTokenWork,
  modelId = DEFAULT_TRANSFORMERS_RERANKER_MODEL,
  onMetrics,
} = {}) {
  const model = TRANSFORMERS_RERANKER_MODELS[modelId]
  if (!model) {
    throw new TypeError(`Unsupported reranker model: ${String(modelId)}`)
  }
  if (model.unsupportedReason) {
    const failure = new Error(model.unsupportedReason)
    failure.code = 'RERANKER_MODEL_UNSUPPORTED'
    throw failure
  }
  if (cacheDir !== undefined &&
    (typeof cacheDir !== 'string' || cacheDir.length < 1)) {
    throw new TypeError('cacheDir must be a non-empty string when provided.')
  }
  if (typeof loadRuntime !== 'function') {
    throw new TypeError('loadRuntime must be a function.')
  }
  positiveInteger(maxBatchSize, 'maxBatchSize')
  positiveInteger(maxPaddedTokenWork, 'maxPaddedTokenWork')
  if (onMetrics !== undefined && typeof onMetrics !== 'function') {
    throw new TypeError('onMetrics must be a function when provided.')
  }

  let loading
  const load = async () => {
    if (!loading) {
      loading = (async () => {
        const runtime = await loadRuntime()
        const tokenizerFactory = runtime?.AutoTokenizer?.from_pretrained
        const modelFactory =
          runtime?.AutoModelForSequenceClassification?.from_pretrained
        if (typeof tokenizerFactory !== 'function' ||
          typeof modelFactory !== 'function') {
          throw new TypeError(
            'Reranker runtime must expose tokenizer and sequence-classifier factories.',
          )
        }
        const options = {
          ...(cacheDir ? { cache_dir: cacheDir } : {}),
          revision: model.revision,
        }
        return loadRerankerComponents([
          () => runtime.AutoTokenizer.from_pretrained(modelId, options),
          () => runtime.AutoModelForSequenceClassification.from_pretrained(
            modelId,
            {
              ...options,
              dtype: model.dtype,
            },
          ),
        ], ([tokenizer, classifier]) => {
          if (typeof tokenizer !== 'function' ||
            typeof classifier !== 'function') {
            throw new TypeError(
              'Reranker runtime loaded invalid model components.',
            )
          }
          return { classifier, tokenizer }
        })
      })()
    }
    return loading
  }

  const lifecycle = createRerankerLifecycle(
    load,
    async () => {
      if (!loading) return []
      const loaded = await loading
      return [loaded.classifier, loaded.tokenizer]
    },
  )

  const rerank = async (query, candidateTexts) => {
    const normalizedQuery = boundedText(
      query,
      'query',
      TRANSFORMERS_RERANKER_LIMITS.queryChars,
    )
    if (!Array.isArray(candidateTexts)) {
      throw new TypeError('candidateTexts must be an array.')
    }
    if (candidateTexts.length > TRANSFORMERS_RERANKER_LIMITS.candidates) {
      throw new TypeError(
        `candidateTexts may contain at most ` +
        `${TRANSFORMERS_RERANKER_LIMITS.candidates} entries.`,
      )
    }
    const documents = candidateTexts.map((text, index) => boundedText(
      text,
      `candidateTexts[${index}]`,
      TRANSFORMERS_RERANKER_LIMITS.documentChars,
    ))
    return lifecycle.enqueue(async () => {
      if (documents.length === 0) return []
      const { classifier, tokenizer } = await load()
      return runBatchedReranker({
        documents,
        infer: classifier,
        maxBatchSize,
        maxPaddedTokenWork,
        maxTokens: RERANKER_EXECUTION_LIMITS.transformersMaxTokens,
        onMetrics,
        query: normalizedQuery,
        score: (output, expected) => logitsToScores(output?.logits, expected),
        tokenizer,
      })
    })
  }

  Object.defineProperties(rerank, {
    close: { value: lifecycle.close },
    model: { value: Object.freeze({ id: modelId, ...model }) },
    warm: { value: lifecycle.warm },
  })
  return Object.freeze(rerank)
}

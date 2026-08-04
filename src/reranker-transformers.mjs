// Optional local cross-encoder adapter. The inference runtime is deliberately
// not a Palari dependency: consumers choose, install, and audit it separately.

export const TRANSFORMERS_RERANKER_LIMITS = Object.freeze({
  candidates: 50,
  documentChars: 100_000,
  queryChars: 500,
})

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

export function createTransformersReranker({
  cacheDir,
  loadRuntime = defaultRuntimeLoader,
  modelId = DEFAULT_TRANSFORMERS_RERANKER_MODEL,
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
        const [tokenizer, classifier] = await Promise.all([
          runtime.AutoTokenizer.from_pretrained(modelId, options),
          runtime.AutoModelForSequenceClassification.from_pretrained(modelId, {
            ...options,
            dtype: model.dtype,
          }),
        ])
        if (typeof tokenizer !== 'function' || typeof classifier !== 'function') {
          throw new TypeError('Reranker runtime loaded invalid model components.')
        }
        return { classifier, tokenizer }
      })()
    }
    return loading
  }

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
    if (candidateTexts.length === 0) return []
    const documents = candidateTexts.map((text, index) => boundedText(
      text,
      `candidateTexts[${index}]`,
      TRANSFORMERS_RERANKER_LIMITS.documentChars,
    ))
    const { classifier, tokenizer } = await load()
    const encoded = await tokenizer(
      documents.map(() => normalizedQuery),
      {
        padding: true,
        text_pair: documents,
        truncation: true,
      },
    )
    const output = await classifier(encoded)
    return logitsToScores(output?.logits, documents.length)
  }

  Object.defineProperties(rerank, {
    model: { value: Object.freeze({ id: modelId, ...model }) },
    warm: { value: load },
  })
  return Object.freeze(rerank)
}

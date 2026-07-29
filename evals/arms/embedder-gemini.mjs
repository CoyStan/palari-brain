// Gemini adapter for the pluggable embedder.
//
// `src/memory-semantic.mjs` accepts any `embed(texts) -> number[][]`
// function; ONE function embeds both stored journal rows and lookup
// queries (see `semanticFindEvidence`), so the task type must be symmetric
// — SEMANTIC_SIMILARITY — or documents and queries would live in different
// regions of the embedding space and cosine ranking would quietly degrade.
//
// This module owns request building, batching, and strict response
// normalization, all offline-testable with a fake `invoke`. It owns no
// credentials, network access, retry policy, or meter: `invoke({ batch,
// body, model })` is the caller's metered dispatch to the Gemini
// `batchEmbedContents` endpoint, and live dispatch is founder-gated in the
// keyed session.
//
// Determinism note for consumers: a vector index built by one embedding
// model is only comparable to queries embedded by the same model. Changing
// GEMINI_EMBEDDER_MODEL means the derived vector table must be rebuilt —
// it is derived data, so nothing canonical is lost.

export const GEMINI_EMBEDDER_MODEL = 'gemini-embedding-001'
export const GEMINI_EMBEDDER_TASK_TYPE = 'SEMANTIC_SIMILARITY'
// The provider caps one batchEmbedContents call at 100 requests.
export const GEMINI_EMBEDDER_BATCH_LIMIT = 100
export const GEMINI_EMBEDDER_MAX_TEXT_CHARS = 8_000

export class GeminiEmbedderResponseError extends Error {
  constructor(message) {
    super(message)
    this.name = 'GeminiEmbedderResponseError'
    this.code = 'GEMINI_EMBEDDER_RESPONSE_INVALID'
  }
}

// A successful HTTP response with no embeddings has nothing in it to
// correct; classified as a provider fault, never retried here.
export class GeminiEmbedderEmptyResponseError extends Error {
  constructor(message) {
    super(message)
    this.name = 'GeminiEmbedderEmptyResponseError'
    this.code = 'GEMINI_EMBEDDER_EMPTY_RESPONSE'
  }
}

function invalid(message) {
  throw new GeminiEmbedderResponseError(message)
}

function normalizedTexts(texts) {
  if (!Array.isArray(texts) || !texts.length) {
    throw new TypeError('embed requires a non-empty array of texts.')
  }
  return texts.map((text, index) => {
    const value = String(text ?? '')
    if (!value.trim()) {
      throw new TypeError(`texts[${index}] must be a non-empty string.`)
    }
    // Bounded like every other outbound payload: a runaway row must fail
    // loudly on the host, not silently truncate inside the provider.
    if (value.length > GEMINI_EMBEDDER_MAX_TEXT_CHARS) {
      throw new TypeError(
        `texts[${index}] exceeds ${GEMINI_EMBEDDER_MAX_TEXT_CHARS} characters.`,
      )
    }
    return value
  })
}

// One batchEmbedContents body per chunk of at most `batchLimit` texts.
export function buildGeminiEmbedBatches(texts, {
  batchLimit = GEMINI_EMBEDDER_BATCH_LIMIT,
  model = GEMINI_EMBEDDER_MODEL,
} = {}) {
  if (!Number.isSafeInteger(batchLimit) || batchLimit < 1) {
    throw new TypeError('batchLimit must be a positive safe integer.')
  }
  const normalized = normalizedTexts(texts)
  const batches = []
  for (let start = 0; start < normalized.length; start += batchLimit) {
    const chunk = normalized.slice(start, start + batchLimit)
    batches.push({
      body: {
        requests: chunk.map((text) => ({
          content: { parts: [{ text }] },
          model: `models/${model}`,
          taskType: GEMINI_EMBEDDER_TASK_TYPE,
        })),
      },
      texts: chunk,
    })
  }
  return batches
}

// Strict normalization of one batchEmbedContents response: exactly one
// finite-valued vector per requested text, all sharing one dimension.
// Order is positional per the API contract, and the vector count is the
// only correlation the host can verify — so it is verified.
export function normalizeGeminiEmbedResponse(response, expectedCount) {
  const embeddings = response?.embeddings
  if (!Array.isArray(embeddings) || !embeddings.length) {
    throw new GeminiEmbedderEmptyResponseError(
      'The provider returned no embeddings for a non-empty batch.',
    )
  }
  if (embeddings.length !== expectedCount) {
    invalid(`Expected ${expectedCount} embeddings, ` +
      `received ${embeddings.length}.`)
  }
  let dims = null
  return embeddings.map((entry, index) => {
    const values = entry?.values
    if (!Array.isArray(values) || !values.length) {
      invalid(`embeddings[${index}] has no values array.`)
    }
    if (dims === null) dims = values.length
    if (values.length !== dims) {
      invalid(`embeddings[${index}] has ${values.length} dimensions; ` +
        `the batch started with ${dims}.`)
    }
    return values.map((value, position) => {
      const number = Number(value)
      if (!Number.isFinite(number)) {
        invalid(`embeddings[${index}].values[${position}] is not finite.`)
      }
      return number
    })
  })
}

// The pluggable embedder `createPalariBrain({ embedder })` expects.
// Batches run sequentially: embedding order must match text order, and a
// mid-run fault must fail the whole call rather than return a torn result.
export function createGeminiEmbedder({
  batchLimit = GEMINI_EMBEDDER_BATCH_LIMIT,
  invoke,
  model = GEMINI_EMBEDDER_MODEL,
} = {}) {
  if (typeof invoke !== 'function') {
    throw new TypeError('createGeminiEmbedder requires invoke.')
  }

  return async function geminiEmbed(texts) {
    const batches = buildGeminiEmbedBatches(texts, { batchLimit, model })
    const vectors = []
    for (const [batch, { body, texts: chunk }] of batches.entries()) {
      const response = await invoke({ batch, body, model })
      vectors.push(...normalizeGeminiEmbedResponse(response, chunk.length))
    }
    return vectors
  }
}

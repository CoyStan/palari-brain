// Provider-neutral long-text composition for embedding adapters with a
// per-input character limit. Canonical evidence remains whole in storage;
// only the derived embedding request is chunked. Chunk vectors are averaged
// and normalized back to exactly one vector per canonical input.

function positiveSafeInteger(value, label) {
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < 1) {
    throw new TypeError(`${label} must be a positive safe integer.`)
  }
  return number
}

function normalizedTexts(texts) {
  if (!Array.isArray(texts) || texts.length === 0) {
    throw new TypeError('chunked embedder requires a non-empty text array.')
  }
  return texts.map((text, index) => {
    const value = String(text ?? '')
    if (!value.trim()) {
      throw new TypeError(`texts[${index}] must be a non-empty string.`)
    }
    return value
  })
}

function finiteVector(vector, index, dimensions) {
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new TypeError(`embedding[${index}] must be a non-empty vector.`)
  }
  if (dimensions !== null && vector.length !== dimensions) {
    throw new TypeError('embedding vectors must share one dimension.')
  }
  return vector.map((value, position) => {
    const number = Number(value)
    if (!Number.isFinite(number)) {
      throw new TypeError(
        `embedding[${index}][${position}] must be finite.`,
      )
    }
    return number
  })
}

function normalizedMean(vectors, dimensions) {
  const mean = Array(dimensions).fill(0)
  for (const vector of vectors) {
    for (let index = 0; index < dimensions; index += 1) {
      mean[index] += vector[index] / vectors.length
    }
  }
  const magnitude = Math.sqrt(
    mean.reduce((sum, value) => sum + value * value, 0),
  )
  if (!Number.isFinite(magnitude) || magnitude <= 0) {
    throw new TypeError('averaged embedding must have finite magnitude.')
  }
  return mean.map((value) => value / magnitude)
}

export function createChunkedEmbedder({ embed, maxChunkChars } = {}) {
  if (typeof embed !== 'function') {
    throw new TypeError('createChunkedEmbedder requires embed.')
  }
  const maximum = positiveSafeInteger(maxChunkChars, 'maxChunkChars')

  return async function chunkedEmbed(rawTexts) {
    const texts = normalizedTexts(rawTexts)
    const chunks = []
    const owners = []
    for (const [owner, text] of texts.entries()) {
      for (let start = 0; start < text.length; start += maximum) {
        chunks.push(text.slice(start, start + maximum))
        owners.push(owner)
      }
    }

    const rawVectors = await embed(chunks)
    if (!Array.isArray(rawVectors) || rawVectors.length !== chunks.length) {
      throw new TypeError('embed must return one vector per derived chunk.')
    }
    let dimensions = null
    const vectors = rawVectors.map((vector, index) => {
      const normalized = finiteVector(vector, index, dimensions)
      dimensions ??= normalized.length
      return normalized
    })
    const grouped = texts.map(() => [])
    for (const [index, vector] of vectors.entries()) {
      grouped[owners[index]].push(vector)
    }
    return grouped.map((owned) => normalizedMean(owned, dimensions))
  }
}

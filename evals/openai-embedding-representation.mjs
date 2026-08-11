// Evaluation-only representation transform for OpenAI third-generation
// embeddings. OpenAI documents prefix shortening followed by L2 normalization
// when changing dimensions after an embedding has already been generated.

import { createUsearchHnswLocator } from './usearch-hnsw-locator.mjs'

function positiveInteger(value, label, maximum = Number.MAX_SAFE_INTEGER) {
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < 1 || number > maximum) {
    throw new TypeError(`${label} must be an integer from 1 to ${maximum}.`)
  }
  return number
}

export function shortenOpenAIEmbedding(vectorInput, dimensionsInput, {
  sourceDimensions,
} = {}) {
  if (!Array.isArray(vectorInput) && !ArrayBuffer.isView(vectorInput)) {
    throw new TypeError('embedding must contain finite numbers.')
  }
  const expected = positiveInteger(
    sourceDimensions ?? vectorInput.length,
    'sourceDimensions',
    65_536,
  )
  if (vectorInput.length !== expected) {
    throw new TypeError(`embedding must contain ${expected} dimensions.`)
  }
  const dimensions = positiveInteger(dimensionsInput, 'dimensions', expected)
  const shortened = new Float32Array(dimensions)
  let normSquared = 0
  for (let index = 0; index < expected; index += 1) {
    const value = Number(vectorInput[index])
    if (!Number.isFinite(value)) {
      throw new TypeError('embedding must contain finite numbers.')
    }
    if (index < dimensions) {
      shortened[index] = value
      normSquared += value * value
    }
  }
  if (!(normSquared > 0) || !Number.isFinite(normSquared)) {
    throw new TypeError('shortened embedding must have a nonzero finite norm.')
  }
  const norm = Math.sqrt(normSquared)
  for (let index = 0; index < shortened.length; index += 1) {
    shortened[index] /= norm
  }
  return shortened
}

export function createShortenedOpenAIHnswLocator({
  dimensions,
  sourceDimensions,
  ...hnswConfig
} = {}) {
  const source = positiveInteger(sourceDimensions, 'sourceDimensions', 65_536)
  const shortenedDimensions = positiveInteger(dimensions, 'dimensions', source)
  const locator = createUsearchHnswLocator({
    ...hnswConfig,
    dimensions: shortenedDimensions,
  })
  const shorten = (vector) => shortenOpenAIEmbedding(
    vector,
    shortenedDimensions,
    { sourceDimensions: source },
  )
  const stats = (scope) => Object.freeze({
    ...locator.stats(scope),
    sourceDimensions: source,
    transform: 'openai-prefix-l2',
  })

  return Object.freeze({
    load: (scope, options) => {
      locator.load(scope, options)
      return stats(scope)
    },
    locate: (scope, vector) => locator.locate(scope, shorten(vector)),
    remove: (...args) => locator.remove(...args),
    replace: (scope, entries) => {
      locator.replace(scope, Array.isArray(entries)
        ? entries.map((entry) => ({
            ...entry,
            vector: shorten(entry?.vector),
          }))
        : entries)
      return stats(scope)
    },
    save: (...args) => locator.save(...args),
    stats,
    upsert: (scope, entry) => locator.upsert(scope, {
      ...entry,
      vector: shorten(entry?.vector),
    }),
  })
}

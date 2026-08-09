// Evaluation-only, opt-in reuse of derived embedding vectors. The cache never
// stores canonical text or provenance and cannot locate memory: callers must
// already possess the exact scoped text before a vector can be returned.

import { createHash } from 'node:crypto'
import { chmod, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const CACHE_SCHEMA = 'palari-content-addressed-embedding/v1'

function normalizedNamespace(value) {
  const namespace = String(value ?? '').trim()
  if (!namespace || namespace.length > 1_024) {
    throw new TypeError('embedding cache namespace must contain 1-1024 characters.')
  }
  return namespace
}

function normalizedTexts(values) {
  if (!Array.isArray(values) || values.length < 1) {
    throw new TypeError('cached embed requires a non-empty text array.')
  }
  return values.map((value, index) => {
    const text = String(value ?? '')
    if (!text.trim()) {
      throw new TypeError(`texts[${index}] must be a non-empty string.`)
    }
    return text
  })
}
function finiteVector(value, label) {
  if (!Array.isArray(value) || value.length < 1) {
    throw new TypeError(`${label} must be a non-empty vector.`)
  }
  return value.map((entry, index) => {
    const number = Number(entry)
    if (!Number.isFinite(number)) {
      throw new TypeError(`${label}[${index}] must be finite.`)
    }
    return number
  })
}

function encodeVector(vector) {
  const bytes = Buffer.allocUnsafe(vector.length * 8)
  for (const [index, value] of vector.entries()) {
    bytes.writeDoubleLE(value, index * 8)
  }
  return bytes
}

function decodeVector(blob, dims) {
  const bytes = Buffer.from(blob ?? [])
  if (!Number.isSafeInteger(dims) || dims < 1 || bytes.length !== dims * 8) {
    throw new Error('Embedding cache entry is corrupt.')
  }
  const vector = []
  for (let index = 0; index < dims; index += 1) {
    const value = bytes.readDoubleLE(index * 8)
    if (!Number.isFinite(value)) {
      throw new Error('Embedding cache entry is corrupt.')
    }
    vector.push(value)
  }
  return vector
}

export function contentAddressedEmbeddingKey({ namespace, text } = {}) {
  const scopedNamespace = normalizedNamespace(namespace)
  const content = String(text ?? '')
  if (!content.trim()) {
    throw new TypeError('embedding cache key text must be non-empty.')
  }
  return createHash('sha256')
    .update(CACHE_SCHEMA)
    .update('\0')
    .update(scopedNamespace)
    .update('\0')
    .update(content, 'utf8')
    .digest('hex')
}

export async function openContentAddressedEmbeddingCache({
  embed,
  namespace,
  path,
} = {}) {
  if (typeof embed !== 'function') {
    throw new TypeError('embedding cache requires embed.')
  }
  const scopedNamespace = normalizedNamespace(namespace)
  if (typeof path !== 'string' || !path.trim()) {
    throw new TypeError('embedding cache requires a database path.')
  }
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  const database = new DatabaseSync(path)
  await chmod(path, 0o600)
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = FULL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS embedding_cache (
      cache_key TEXT PRIMARY KEY,
      namespace TEXT NOT NULL,
      input_bytes INTEGER NOT NULL,
      dims INTEGER NOT NULL,
      vector BLOB NOT NULL
    ) STRICT;
  `)
  const find = database.prepare(`
    SELECT namespace, input_bytes, dims, vector
    FROM embedding_cache
    WHERE cache_key = ?
  `)
  const insert = database.prepare(`
    INSERT OR IGNORE INTO embedding_cache
      (cache_key, namespace, input_bytes, dims, vector)
    VALUES (?, ?, ?, ?, ?)
  `)
  let closed = false
  let hits = 0
  let misses = 0
  let providerInputs = 0
  let writes = 0

  const cachedEmbed = async (rawTexts) => {
    if (closed) throw new Error('Embedding cache is closed.')
    const texts = normalizedTexts(rawTexts)
    const output = Array(texts.length)
    const missing = new Map()
    for (const [index, text] of texts.entries()) {
      const cacheKey = contentAddressedEmbeddingKey({
        namespace: scopedNamespace,
        text,
      })
      const inputBytes = Buffer.byteLength(text, 'utf8')
      const found = find.get(cacheKey)
      if (found) {
        if (found.namespace !== scopedNamespace ||
          found.input_bytes !== inputBytes) {
          throw new Error('Embedding cache entry is corrupt.')
        }
        output[index] = decodeVector(found.vector, found.dims)
        hits += 1
        continue
      }
      misses += 1
      const prior = missing.get(cacheKey)
      if (prior) {
        prior.indexes.push(index)
      } else {
        missing.set(cacheKey, { cacheKey, indexes: [index], inputBytes, text })
      }
    }
    if (missing.size > 0) {
      const entries = [...missing.values()]
      const vectors = await embed(entries.map(({ text }) => text))
      if (!Array.isArray(vectors) || vectors.length !== entries.length) {
        throw new TypeError('embed must return one vector per cache miss.')
      }
      const accepted = vectors.map((vector, index) =>
        finiteVector(vector, `embedding[${index}]`))
      providerInputs += entries.length
      database.exec('BEGIN IMMEDIATE')
      try {
        for (const [index, entry] of entries.entries()) {
          const vector = accepted[index]
          insert.run(
            entry.cacheKey,
            scopedNamespace,
            entry.inputBytes,
            vector.length,
            encodeVector(vector),
          )
          writes += 1
          for (const outputIndex of entry.indexes) {
            output[outputIndex] = [...vector]
          }
        }
        database.exec('COMMIT')
      } catch (error) {
        database.exec('ROLLBACK')
        throw error
      }
    }
    return output
  }

  return Object.freeze({
    close() {
      if (closed) return
      database.exec('PRAGMA wal_checkpoint(TRUNCATE)')
      database.close()
      closed = true
    },
    embed: cachedEmbed,
    get stats() {
      return Object.freeze({ hits, misses, providerInputs, writes })
    },
  })
}

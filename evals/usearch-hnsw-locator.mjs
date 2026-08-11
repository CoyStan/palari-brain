// Evaluation-only USearch HNSW locator. Each caller scope owns a separate
// derived index. It returns evidence IDs only; callers must reread scoped
// canonical vectors and exact-rank the candidate set.

import { createHash } from 'node:crypto'

import { Index } from 'usearch'

const KEY_MASK = (1n << 63n) - 1n
const KEY_SCHEMA = 'palari-usearch-hnsw-key/v1'

function positiveInteger(value, label, maximum = Number.MAX_SAFE_INTEGER) {
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < 1 || number > maximum) {
    throw new TypeError(`${label} must be an integer from 1 to ${maximum}.`)
  }
  return number
}

function normalizedScope(scope = {}) {
  const palariId = String(scope.palariId ?? '').trim()
  const userId = String(scope.userId ?? '').trim()
  if (!palariId) throw new TypeError('palariId is required.')
  if (!userId) throw new TypeError('userId is required.')
  return Object.freeze({
    key: JSON.stringify([palariId, userId]),
    palariId,
    userId,
  })
}

function normalizedEvidenceId(value) {
  const evidenceId = String(value ?? '').trim()
  if (!evidenceId) throw new TypeError('evidenceId is required.')
  return evidenceId
}

function finiteVector(value, dimensions, label = 'vector') {
  if (!Array.isArray(value) && !ArrayBuffer.isView(value)) {
    throw new TypeError(`${label} must contain finite numbers.`)
  }
  if (value.length !== dimensions) {
    throw new TypeError(`${label} must contain ${dimensions} dimensions.`)
  }
  const vector = Float32Array.from(value, Number)
  if (vector.some((entry) => !Number.isFinite(entry))) {
    throw new TypeError(`${label} must contain finite numbers.`)
  }
  return vector
}

function evidenceKey(scope, evidenceId) {
  const digest = createHash('sha256')
    .update(KEY_SCHEMA)
    .update('\0')
    .update(scope.palariId)
    .update('\0')
    .update(scope.userId)
    .update('\0')
    .update(evidenceId)
    .digest()
  const key = digest.readBigUInt64LE(0) & KEY_MASK
  return key === 0n ? 1n : key
}

export function createUsearchHnswLocator({
  candidateLimit = 80,
  connectivity = 16,
  dimensions,
  expansionAdd = 128,
  expansionSearch = 128,
} = {}) {
  const vectorDimensions = positiveInteger(dimensions, 'dimensions', 65_536)
  const candidates = positiveInteger(candidateLimit, 'candidateLimit', 10_000)
  const connections = positiveInteger(connectivity, 'connectivity', 1_024)
  const addExpansion = positiveInteger(expansionAdd, 'expansionAdd', 100_000)
  const searchExpansion = positiveInteger(
    expansionSearch,
    'expansionSearch',
    100_000,
  )
  const scopes = new Map()

  function newState() {
    return {
      idToKey: new Map(),
      index: new Index({
        connectivity: connections,
        dimensions: vectorDimensions,
        expansion_add: addExpansion,
        expansion_search: searchExpansion,
        metric: 'cos',
        multi: false,
        quantization: 'f32',
      }),
      keyToId: new Map(),
    }
  }

  function bind(state, scope, evidenceId) {
    const key = evidenceKey(scope, evidenceId)
    const collision = state.keyToId.get(key)
    if (collision && collision !== evidenceId) {
      throw new Error('derived HNSW evidence-key collision.')
    }
    state.idToKey.set(evidenceId, key)
    state.keyToId.set(key, evidenceId)
    return key
  }

  function statsFor(state) {
    const entries = state?.index.size() ?? 0
    return Object.freeze({
      candidateLimit: candidates,
      connectivity: connections,
      dimensions: state ? vectorDimensions : null,
      entries,
      expansionAdd: addExpansion,
      expansionSearch: searchExpansion,
      logicalKeyBytes: entries * BigUint64Array.BYTES_PER_ELEMENT,
      metric: 'cos',
      quantization: 'f32',
      strategy: `usearch-hnsw-m${connections}-ef${searchExpansion}-k${candidates}`,
    })
  }

  return Object.freeze({
    load(scopeInput, { evidenceIds, path } = {}) {
      const scope = normalizedScope(scopeInput)
      if (!Array.isArray(evidenceIds) || evidenceIds.length < 1) {
        throw new TypeError('evidenceIds must be a non-empty array.')
      }
      if (typeof path !== 'string' || !path.trim()) {
        throw new TypeError('path is required.')
      }
      const state = newState()
      state.index.load(path)
      const ids = evidenceIds.map(normalizedEvidenceId)
      if (new Set(ids).size !== ids.length || state.index.size() !== ids.length) {
        throw new Error('persisted HNSW evidence binding does not match index size.')
      }
      for (const evidenceId of ids) {
        const key = bind(state, scope, evidenceId)
        if (!state.index.contains(key)) {
          throw new Error('persisted HNSW index is not bound to this scope.')
        }
      }
      scopes.set(scope.key, state)
      return statsFor(state)
    },

    locate(scopeInput, vectorInput) {
      const scope = normalizedScope(scopeInput)
      const vector = finiteVector(vectorInput, vectorDimensions)
      const state = scopes.get(scope.key)
      if (!state?.index.size()) return []
      const result = state.index.search(
        vector,
        Math.min(candidates, state.index.size()),
        1,
      )
      return [...result.keys].map((key) => {
        const evidenceId = state.keyToId.get(key)
        if (!evidenceId) throw new Error('HNSW returned an unbound evidence key.')
        return evidenceId
      })
    },

    remove(scopeInput, evidenceIdInput) {
      const scope = normalizedScope(scopeInput)
      const evidenceId = normalizedEvidenceId(evidenceIdInput)
      const state = scopes.get(scope.key)
      const key = state?.idToKey.get(evidenceId)
      if (!state || key === undefined) return false
      if (state.index.remove(key) !== 1) {
        throw new Error('HNSW index failed to remove a bound evidence key.')
      }
      state.idToKey.delete(evidenceId)
      state.keyToId.delete(key)
      if (!state.index.size()) scopes.delete(scope.key)
      return true
    },

    replace(scopeInput, entries) {
      const scope = normalizedScope(scopeInput)
      if (!Array.isArray(entries) || entries.length < 1) {
        throw new TypeError('entries must be a non-empty array.')
      }
      const state = newState()
      const keys = new BigUint64Array(entries.length)
      const vectors = new Float32Array(entries.length * vectorDimensions)
      for (const [index, entry] of entries.entries()) {
        const evidenceId = normalizedEvidenceId(entry?.evidenceId)
        if (state.idToKey.has(evidenceId)) {
          throw new TypeError('entries must contain unique evidence IDs.')
        }
        keys[index] = bind(state, scope, evidenceId)
        vectors.set(
          finiteVector(entry?.vector, vectorDimensions, `entries[${index}].vector`),
          index * vectorDimensions,
        )
      }
      // Keep diagnostic builds reproducible. USearch's automatic parallel
      // insertion can produce slightly different HNSW graphs between runs.
      state.index.add(keys, vectors, 1)
      scopes.set(scope.key, state)
      return statsFor(state)
    },

    save(scopeInput, path) {
      const scope = normalizedScope(scopeInput)
      const state = scopes.get(scope.key)
      if (!state) throw new Error('scope has no HNSW index to save.')
      if (typeof path !== 'string' || !path.trim()) {
        throw new TypeError('path is required.')
      }
      state.index.save(path)
    },

    stats(scopeInput) {
      const scope = normalizedScope(scopeInput)
      return statsFor(scopes.get(scope.key))
    },

    upsert(scopeInput, { evidenceId: evidenceIdInput, vector: input } = {}) {
      const scope = normalizedScope(scopeInput)
      const evidenceId = normalizedEvidenceId(evidenceIdInput)
      const vector = finiteVector(input, vectorDimensions)
      const state = scopes.get(scope.key) ?? newState()
      const priorKey = state.idToKey.get(evidenceId)
      const updated = priorKey !== undefined
      if (updated && state.index.remove(priorKey) !== 1) {
        throw new Error('HNSW index failed to replace a bound evidence key.')
      }
      const key = bind(state, scope, evidenceId)
      state.index.add(key, vector, 1)
      scopes.set(scope.key, state)
      return Object.freeze({ inserted: !updated, updated })
    },
  })
}

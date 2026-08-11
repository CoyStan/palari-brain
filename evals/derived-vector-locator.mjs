// Evaluation-only candidate locator for SCALE-04.
//
// The locator is deliberately small and disposable: a 64-bit sparse sign
// sketch is split into eight bands, and matching bands return evidence IDs.
// It never returns evidence and never outranks canonical vectors. A caller
// must reread the scoped vector rows and apply exact cosine ranking. This file
// is excluded from the release package and is not a runtime integration.

import { performance } from 'node:perf_hooks'
import { DatabaseSync } from 'node:sqlite'

const DEFAULT_BANDS = 8
const DEFAULT_BITS_PER_BAND = 8
const DEFAULT_PROJECTION_LANES = 4
const DEFAULT_SEED = 0x9e3779b9
const CANDIDATE_READ_BATCH = 500
const MAX_BAND_BITS = 32
const MAX_SKETCH_BITS = 64
const VECTOR_TABLE = 'dialogue_evidence_vectors'

function positiveInteger(value, label) {
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < 1) {
    throw new TypeError(`${label} must be a positive integer.`)
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

function finiteVector(value, label = 'vector') {
  if (!Array.isArray(value) && !ArrayBuffer.isView(value)) {
    throw new TypeError(`${label} must contain finite numbers.`)
  }
  const vector = Float32Array.from(value, Number)
  if (!vector.length || vector.some((item) => !Number.isFinite(item))) {
    throw new TypeError(`${label} must contain finite numbers.`)
  }
  return vector
}

function mix32(input) {
  let value = input >>> 0
  value ^= value >>> 16
  value = Math.imul(value, 0x7feb352d)
  value ^= value >>> 15
  value = Math.imul(value, 0x846ca68b)
  value ^= value >>> 16
  return value >>> 0
}

function sparseSignSketch(vector, {
  projectionLanes,
  seed,
  sketchBits,
}) {
  const sums = new Float64Array(sketchBits)
  for (let index = 0; index < vector.length; index += 1) {
    let state = mix32(
      seed ^ Math.imul(index + 1, 0x85ebca6b),
    )
    for (let lane = 0; lane < projectionLanes; lane += 1) {
      state = mix32(state ^ Math.imul(lane + 1, 0xc2b2ae35))
      const projection = state % sketchBits
      const sign = (state & 0x80000000) === 0 ? 1 : -1
      sums[projection] += sign * vector[index]
    }
  }
  let sketch = 0n
  for (let bit = 0; bit < sketchBits; bit += 1) {
    if (sums[bit] >= 0) sketch |= 1n << BigInt(bit)
  }
  return sketch
}

function sketchBands(sketch, bands, bitsPerBand) {
  const mask = (1n << BigInt(bitsPerBand)) - 1n
  return Array.from({ length: bands }, (_, band) => Number(
    (sketch >> BigInt(band * bitsPerBand)) & mask,
  ))
}

export function createDerivedVectorLocator({
  bands = DEFAULT_BANDS,
  bitsPerBand = DEFAULT_BITS_PER_BAND,
  projectionLanes = DEFAULT_PROJECTION_LANES,
  seed = DEFAULT_SEED,
} = {}) {
  const bandCount = positiveInteger(bands, 'bands')
  const bandBits = positiveInteger(bitsPerBand, 'bitsPerBand')
  const lanes = positiveInteger(projectionLanes, 'projectionLanes')
  const sketchBits = bandCount * bandBits
  if (bandBits > MAX_BAND_BITS) {
    throw new TypeError(`bitsPerBand must be at most ${MAX_BAND_BITS}.`)
  }
  if (sketchBits > MAX_SKETCH_BITS) {
    throw new TypeError(`bands * bitsPerBand must be at most 64.`)
  }
  const normalizedSeed = Number(seed) >>> 0
  const scopes = new Map()
  const strategy = `sparse-sign-${sketchBits}/${bandCount}x${bandBits}`

  function createScopeState() {
    return {
      buckets: Array.from({ length: bandCount }, () => new Map()),
      dimensions: null,
      entries: new Map(),
    }
  }

  function removeEntry(state, evidenceId) {
    const entry = state.entries.get(evidenceId)
    if (!entry) return false
    for (const [band, key] of entry.keys.entries()) {
      const bucket = state.buckets[band].get(key)
      bucket.delete(evidenceId)
      if (!bucket.size) state.buckets[band].delete(key)
    }
    state.entries.delete(evidenceId)
    return true
  }

  function keysFor(vector) {
    return sketchBands(sparseSignSketch(vector, {
      projectionLanes: lanes,
      seed: normalizedSeed,
      sketchBits,
    }), bandCount, bandBits)
  }

  return Object.freeze({
    locate(scopeInput, vectorInput) {
      const scope = normalizedScope(scopeInput)
      const vector = finiteVector(vectorInput)
      const state = scopes.get(scope.key)
      if (!state) return []
      if (vector.length !== state.dimensions) {
        throw new TypeError(
          `vector must contain ${state.dimensions} dimensions.`,
        )
      }
      const candidates = new Set()
      for (const [band, key] of keysFor(vector).entries()) {
        for (const evidenceId of state.buckets[band].get(key) ?? []) {
          candidates.add(evidenceId)
        }
      }
      return [...candidates].sort((left, right) => left.localeCompare(right))
    },

    remove(scopeInput, evidenceIdInput) {
      const scope = normalizedScope(scopeInput)
      const evidenceId = normalizedEvidenceId(evidenceIdInput)
      const state = scopes.get(scope.key)
      if (!state || !removeEntry(state, evidenceId)) return false
      if (!state.entries.size) scopes.delete(scope.key)
      return true
    },

    stats(scopeInput) {
      const scope = normalizedScope(scopeInput)
      const state = scopes.get(scope.key)
      const entries = state?.entries.size ?? 0
      return Object.freeze({
        bands: bandCount,
        bitsPerBand: bandBits,
        bucketReferences: entries * bandCount,
        dimensions: state?.dimensions ?? null,
        entries,
        logicalSketchBytes: entries * Math.ceil(sketchBits / 8),
        strategy,
      })
    },

    upsert(scopeInput, { evidenceId: evidenceIdInput, vector: input } = {}) {
      const scope = normalizedScope(scopeInput)
      const evidenceId = normalizedEvidenceId(evidenceIdInput)
      const vector = finiteVector(input)
      const state = scopes.get(scope.key) ?? createScopeState()
      if (state.dimensions !== null && vector.length !== state.dimensions) {
        throw new TypeError(
          `vector must contain ${state.dimensions} dimensions.`,
        )
      }
      const updated = state.entries.has(evidenceId)
      if (updated) removeEntry(state, evidenceId)
      const keys = keysFor(vector)
      for (const [band, key] of keys.entries()) {
        const bucket = state.buckets[band].get(key) ?? new Set()
        bucket.add(evidenceId)
        state.buckets[band].set(key, bucket)
      }
      state.dimensions = vector.length
      state.entries.set(evidenceId, { keys })
      scopes.set(scope.key, state)
      return Object.freeze({ inserted: !updated, updated })
    },
  })
}

function vectorFromBlob(blob) {
  const bytes = blob instanceof Uint8Array ? blob : new Uint8Array(blob)
  if (!bytes.byteLength || bytes.byteLength % Float32Array.BYTES_PER_ELEMENT) {
    throw new TypeError('stored vector must be a non-empty Float32 payload.')
  }
  return new Float32Array(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  )
}

function cosine(left, right) {
  let dot = 0
  let leftNorm = 0
  let rightNorm = 0
  const length = Math.min(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    dot += left[index] * right[index]
    leftNorm += left[index] * left[index]
    rightNorm += right[index] * right[index]
  }
  const scale = Math.sqrt(leftNorm) * Math.sqrt(rightNorm)
  return scale > 0 ? dot / scale : 0
}

function boundedLimit(value = 20) {
  const limit = positiveInteger(value, 'limit')
  return Math.min(limit, 200)
}

// Build one read-only locator snapshot from the same scoped vector rows used
// by the exact semantic surface. Search rereads only candidate vectors and
// returns canonical journal fields after exact scoring. A stale ID fails
// closed because the scoped SQL join cannot return deleted or moved evidence.
export function openDerivedVectorSnapshot({
  databasePath,
  locatorOptions,
  scope: scopeInput,
} = {}) {
  const path = String(databasePath ?? '').trim()
  if (!path) throw new TypeError('databasePath is required.')
  const scope = normalizedScope(scopeInput)
  const started = performance.now()
  const database = new DatabaseSync(path, { readOnly: true })
  let open = true
  try {
    const locator = createDerivedVectorLocator(locatorOptions)
    const vectorRows = database.prepare(`
      SELECT e.id AS evidence_id, v.vector
      FROM dialogue_evidence e
      JOIN ${VECTOR_TABLE} v ON v.evidence_id = e.id
      WHERE e.palari_id = ? AND e.user_id = ?
    `)
    for (const row of vectorRows.iterate(scope.palariId, scope.userId)) {
      locator.upsert(scope, {
        evidenceId: row.evidence_id,
        vector: vectorFromBlob(row.vector),
      })
    }
    const stats = Object.freeze({
      ...locator.stats(scope),
      buildMs: performance.now() - started,
    })

    return Object.freeze({
      close() {
        if (!open) return
        database.close()
        open = false
      },
      search(vectorInput, { limit: limitInput = 20 } = {}) {
        if (!open) throw new Error('Derived vector snapshot is closed.')
        const vector = finiteVector(vectorInput, 'query vector')
        const ids = locator.locate(scope, vector)
        if (!ids.length) {
          return Object.freeze({
            candidateCount: 0,
            matches: Object.freeze([]),
            scoredCount: 0,
          })
        }
        const candidates = []
        for (let start = 0; start < ids.length;
          start += CANDIDATE_READ_BATCH) {
          const batch = ids.slice(start, start + CANDIDATE_READ_BATCH)
          const placeholders = batch.map(() => '?').join(', ')
          candidates.push(...database.prepare(`
            SELECT
              e.id AS evidence_id,
              e.content,
              e.event_at,
              e.dialogue_order,
              e.palari_id,
              e.source_kind,
              e.source_message_id,
              e.user_id,
              v.vector
            FROM dialogue_evidence e
            JOIN ${VECTOR_TABLE} v ON v.evidence_id = e.id
            WHERE e.palari_id = ? AND e.user_id = ?
              AND e.id IN (${placeholders})
          `).all(scope.palariId, scope.userId, ...batch))
        }
        const matches = candidates
          .map((row) => ({
            row,
            similarity: cosine(vector, vectorFromBlob(row.vector)),
          }))
          .sort((left, right) =>
            right.similarity - left.similarity ||
            String(left.row.event_at).localeCompare(
              String(right.row.event_at),
            ) ||
            Number(left.row.dialogue_order) -
              Number(right.row.dialogue_order))
          .slice(0, boundedLimit(limitInput))
          .map(({ row, similarity }) => Object.freeze({
            dialogueOrder: Number(row.dialogue_order),
            evidenceId: row.evidence_id,
            observedAt: row.event_at,
            palariId: row.palari_id,
            similarity,
            sourceKind: row.source_kind,
            sourceMessageId: row.source_message_id,
            text: row.content,
            userId: row.user_id,
          }))
        return Object.freeze({
          candidateCount: ids.length,
          matches: Object.freeze(matches),
          scoredCount: candidates.length,
        })
      },
      stats,
    })
  } catch (error) {
    if (open) database.close()
    throw error
  }
}

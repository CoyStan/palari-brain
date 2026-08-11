// Private, disposable HNSW acceleration for semantic retrieval.
//
// SQLite vectors and canonical dialogue remain the only source of truth.
// This module owns version-bound USearch snapshots, returns derived locator
// keys only, and treats every native, filesystem, binding, or corruption
// failure as an exact-search fallback. Nothing here is a public API.

import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import {
  chmod,
  mkdir,
  rename,
  rm,
  stat,
} from 'node:fs/promises'
import { basename, join } from 'node:path'

export const SEMANTIC_HNSW_DIMENSIONS = 512
export const SEMANTIC_HNSW_MINIMUM_ROWS = 5_000

const CANDIDATE_LIMIT = 160
const CONNECTIVITY = 16
const EXPANSION_ADD = 256
const EXPANSION_SEARCH = 256
const FORMAT = 'palari-semantic-hnsw-512d-i8-groups/v1'
const KEY_MASK = (1n << 63n) - 1n
const KEY_SCHEMA = 'palari-semantic-vector-group-key/v1'
const MAX_APPROXIMATE_RESULT_LIMIT = 20
const SNAPSHOT_NAME = /^[a-f0-9]{32}-r\d+-[a-f0-9-]{36}\.usearch$/u

function scopeIdentity(scope = {}) {
  const palariId = String(scope.palariId ?? '').trim()
  const userId = String(scope.userId ?? '').trim()
  if (!palariId || !userId) throw new TypeError('A complete scope is required.')
  return Object.freeze({
    key: JSON.stringify([palariId, userId]),
    palariId,
    userId,
  })
}

export function semanticVectorLocatorKey(scopeInput, vectorInput) {
  const scope = scopeIdentity(scopeInput)
  if (!Array.isArray(vectorInput) && !ArrayBuffer.isView(vectorInput)) {
    throw new TypeError('vector must contain finite numbers.')
  }
  const vector = Float32Array.from(vectorInput, Number)
  if (!vector.length || vector.some((value) => !Number.isFinite(value))) {
    throw new TypeError('vector must contain finite numbers.')
  }
  const bytes = new Uint8Array(vector.buffer)
  const digest = createHash('sha256')
    .update(KEY_SCHEMA)
    .update('\0')
    .update(scope.palariId)
    .update('\0')
    .update(scope.userId)
    .update('\0')
    .update(String(vector.length))
    .update('\0')
    .update(bytes)
    .digest()
  const key = digest.readBigUInt64LE(0) & KEY_MASK
  return (key === 0n ? 1n : key).toString(16).padStart(16, '0')
}

function vectorFromBlob(blob) {
  const bytes = blob instanceof Uint8Array ? blob : new Uint8Array(blob)
  return new Float32Array(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  )
}

function projectedVector(vectorInput, sourceDimensions) {
  const vector = ArrayBuffer.isView(vectorInput)
    ? vectorInput
    : Float32Array.from(vectorInput ?? [], Number)
  if (
    vector.length !== sourceDimensions ||
    sourceDimensions < SEMANTIC_HNSW_DIMENSIONS
  ) return null
  const projected = new Float32Array(SEMANTIC_HNSW_DIMENSIONS)
  let squaredNorm = 0
  for (let index = 0; index < projected.length; index += 1) {
    const value = Number(vector[index])
    if (!Number.isFinite(value)) return null
    projected[index] = value
    squaredNorm += value * value
  }
  if (!(squaredNorm > 0) || !Number.isFinite(squaredNorm)) return null
  const norm = Math.sqrt(squaredNorm)
  for (let index = 0; index < projected.length; index += 1) {
    projected[index] /= norm
  }
  return projected
}

function indexOptions() {
  return {
    connectivity: CONNECTIVITY,
    dimensions: SEMANTIC_HNSW_DIMENSIONS,
    expansion_add: EXPANSION_ADD,
    expansion_search: EXPANSION_SEARCH,
    metric: 'cos',
    multi: false,
    quantization: 'i8',
  }
}

function revisionFor(db, scope) {
  return Number(db.prepare(`
    SELECT revision
    FROM dialogue_evidence_vector_scope_versions
    WHERE palari_id = ? AND user_id = ?
  `).get(scope.palariId, scope.userId)?.revision ?? 0)
}

function missingVisibleVector(db, scope, visibleStatementsSql) {
  return Boolean(db.prepare(`
    WITH visible AS (${visibleStatementsSql})
    SELECT 1 AS missing
    FROM dialogue_evidence_vector_pending pending
    JOIN visible ON visible.id = pending.evidence_id
    WHERE pending.palari_id = ? AND pending.user_id = ?
    LIMIT 1
  `).get(
    scope.palariId,
    scope.userId,
    scope.palariId,
    scope.userId,
  )?.missing)
}

function scopeSummary(db, scope, visibleStatementsSql) {
  const row = db.prepare(`
    WITH visible AS (${visibleStatementsSql})
    SELECT
      COUNT(*) AS entries,
      MIN(v.dims) AS minimum_dimensions,
      MAX(v.dims) AS maximum_dimensions
    FROM visible
    JOIN dialogue_evidence_vectors v ON v.evidence_id = visible.id
  `).get(scope.palariId, scope.userId)
  return Object.freeze({
    entries: Number(row?.entries ?? 0),
    maximumDimensions: Number(row?.maximum_dimensions ?? 0),
    minimumDimensions: Number(row?.minimum_dimensions ?? 0),
  })
}

function readBoundSnapshot(db, scope, visibleStatementsSql, { vectors = false } = {}) {
  let transactionOpen = true
  db.exec('BEGIN')
  try {
    const revision = revisionFor(db, scope)
    const missing = missingVisibleVector(db, scope, visibleStatementsSql)
    const summary = scopeSummary(db, scope, visibleStatementsSql)
    const rows = vectors && !missing
      ? db.prepare(`
          WITH visible AS (${visibleStatementsSql})
          SELECT v.dims, v.locator_key, v.vector
          FROM visible
          JOIN dialogue_evidence_vectors v ON v.evidence_id = visible.id
          ORDER BY visible.id ASC
        `).all(scope.palariId, scope.userId)
      : []
    db.exec('COMMIT')
    transactionOpen = false
    return Object.freeze({ missing, revision, rows, summary })
  } catch (error) {
    if (transactionOpen) db.exec('ROLLBACK')
    throw error
  }
}

function snapshotMetadata(db, scope) {
  return db.prepare(`
    SELECT *
    FROM dialogue_evidence_hnsw_snapshots
    WHERE palari_id = ? AND user_id = ?
  `).get(scope.palariId, scope.userId)
}

function metadataMatchesRevision(metadata, revision, minimumRows) {
  return Boolean(
    metadata &&
    String(metadata.format) === FORMAT &&
    Number(metadata.revision) === revision &&
    Number(metadata.entries) >= minimumRows &&
    Number(metadata.index_entries) > 0 &&
    Number(metadata.source_dims) >= SEMANTIC_HNSW_DIMENSIONS,
  )
}

async function sha256File(path) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

function safeSnapshotPath(root, fileName) {
  const name = String(fileName ?? '')
  if (basename(name) !== name || !SNAPSHOT_NAME.test(name)) {
    throw new Error('Derived HNSW snapshot name is invalid.')
  }
  return join(root, name)
}

function scopeFilePrefix(scope) {
  return createHash('sha256')
    .update(FORMAT)
    .update('\0')
    .update(scope.palariId)
    .update('\0')
    .update(scope.userId)
    .digest('hex')
    .slice(0, 32)
}

function keyFromHex(value) {
  const text = String(value ?? '')
  if (!/^[a-f0-9]{16}$/u.test(text)) {
    throw new Error('Derived HNSW locator key is invalid.')
  }
  return BigInt(`0x${text}`)
}

function hexFromKey(value) {
  return BigInt(value).toString(16).padStart(16, '0')
}

function stateMatchesRevision(state, revision) {
  return Boolean(state && state.revision === revision)
}

export function createSemanticHnsw({
  dbPath,
  importUsearch = () => import('usearch'),
  minimumRows = SEMANTIC_HNSW_MINIMUM_ROWS,
} = {}) {
  const threshold = Number(minimumRows)
  if (!Number.isSafeInteger(threshold) || threshold < 1) {
    throw new TypeError('minimumRows must be a positive integer.')
  }
  const usablePath = typeof dbPath === 'string' && dbPath && dbPath !== ':memory:'
  const root = usablePath ? `${dbPath}.semantic-hnsw` : null
  const states = new Map()
  let nativeModulePromise = null
  let nativeUnavailable = false

  async function nativeModule() {
    if (nativeUnavailable) return null
    nativeModulePromise ??= Promise.resolve().then(importUsearch)
    try {
      const loaded = await nativeModulePromise
      if (typeof loaded?.Index !== 'function') throw new Error('Index missing.')
      return loaded
    } catch {
      nativeUnavailable = true
      return null
    }
  }

  async function deactivate(db, scope, metadata) {
    db.prepare(`
      DELETE FROM dialogue_evidence_hnsw_snapshots
      WHERE palari_id = ? AND user_id = ? AND file_name = ?
    `).run(scope.palariId, scope.userId, String(metadata.file_name))
    states.delete(scope.key)
    try {
      await rm(safeSnapshotPath(root, metadata.file_name), { force: true })
    } catch {
      // The SQLite binding is already gone. An unreadable orphan is harmless.
    }
  }

  async function loadState(metadata, Index) {
    const path = safeSnapshotPath(root, metadata.file_name)
    const file = await stat(path)
    if (
      file.size !== Number(metadata.file_bytes) ||
      await sha256File(path) !== String(metadata.file_sha256)
    ) throw new Error('Derived HNSW snapshot checksum mismatch.')
    const index = new Index(indexOptions())
    index.load(path)
    if (index.size() !== Number(metadata.index_entries)) {
      throw new Error('Derived HNSW snapshot size mismatch.')
    }
    return {
      evidenceEntries: Number(metadata.entries),
      index,
      indexEntries: Number(metadata.index_entries),
      revision: Number(metadata.revision),
      sourceDimensions: Number(metadata.source_dims),
    }
  }

  async function activateBuild(
    db,
    scope,
    snapshot,
    visibleStatementsSql,
    built,
  ) {
    let transactionOpen = true
    let activated = false
    let prior = null
    db.exec('BEGIN IMMEDIATE')
    try {
      const current = Object.freeze({
        missing: missingVisibleVector(db, scope, visibleStatementsSql),
        revision: revisionFor(db, scope),
        summary: scopeSummary(db, scope, visibleStatementsSql),
      })
      if (
        !current.missing &&
        current.revision === snapshot.revision &&
        current.summary.entries === snapshot.summary.entries &&
        current.summary.minimumDimensions === snapshot.summary.minimumDimensions &&
        current.summary.maximumDimensions === snapshot.summary.maximumDimensions
      ) {
        prior = snapshotMetadata(db, scope)
        db.prepare(`
          INSERT INTO dialogue_evidence_hnsw_snapshots (
            palari_id,
            user_id,
            revision,
            entries,
            index_entries,
            source_dims,
            format,
            file_name,
            file_bytes,
            file_sha256
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (palari_id, user_id) DO UPDATE SET
            revision = excluded.revision,
            entries = excluded.entries,
            index_entries = excluded.index_entries,
            source_dims = excluded.source_dims,
            format = excluded.format,
            file_name = excluded.file_name,
            file_bytes = excluded.file_bytes,
            file_sha256 = excluded.file_sha256
        `).run(
          scope.palariId,
          scope.userId,
          snapshot.revision,
          snapshot.summary.entries,
          built.indexEntries,
          snapshot.summary.minimumDimensions,
          FORMAT,
          built.fileName,
          built.fileBytes,
          built.fileSha256,
        )
        activated = true
      }
      db.exec('COMMIT')
      transactionOpen = false
    } catch (error) {
      if (transactionOpen) db.exec('ROLLBACK')
      throw error
    }
    if (!activated) {
      await rm(built.path, { force: true })
      return false
    }
    if (prior?.file_name && prior.file_name !== built.fileName) {
      try {
        await rm(safeSnapshotPath(root, prior.file_name), { force: true })
      } catch {
        // Old snapshots are derived cache files; a leftover is safe.
      }
    }
    return true
  }

  async function buildState(db, scope, visibleStatementsSql, Index) {
    const snapshot = readBoundSnapshot(
      db,
      scope,
      visibleStatementsSql,
      { vectors: true },
    )
    if (
      snapshot.missing ||
      snapshot.summary.entries < threshold ||
      snapshot.summary.minimumDimensions < SEMANTIC_HNSW_DIMENSIONS ||
      snapshot.summary.minimumDimensions !== snapshot.summary.maximumDimensions ||
      snapshot.rows.length !== snapshot.summary.entries
    ) return null

    const groups = new Map()
    for (const row of snapshot.rows) {
      const key = String(row.locator_key ?? '')
      const vector = vectorFromBlob(row.vector)
      const existing = groups.get(key)
      if (existing) {
        if (
          Number(row.dims) !== existing.dimensions ||
          vector.length !== existing.vector.length ||
          vector.some((value, index) => value !== existing.vector[index])
        ) throw new Error('Derived HNSW vector-key collision.')
        continue
      }
      groups.set(key, {
        dimensions: Number(row.dims),
        vector,
      })
    }
    const keys = new BigUint64Array(groups.size)
    const vectors = new Float32Array(
      groups.size * SEMANTIC_HNSW_DIMENSIONS,
    )
    let position = 0
    for (const [key, group] of groups) {
      const projected = projectedVector(
        group.vector,
        group.dimensions,
      )
      if (!projected) return null
      keys[position] = keyFromHex(key)
      vectors.set(projected, position * SEMANTIC_HNSW_DIMENSIONS)
      position += 1
    }
    const index = new Index(indexOptions())
    index.add(keys, vectors, 1)
    if (index.size() !== groups.size) return null

    await mkdir(root, { mode: 0o700, recursive: true })
    await chmod(root, 0o700)
    const fileName = `${scopeFilePrefix(scope)}-r${snapshot.revision}-` +
      `${randomUUID()}.usearch`
    const path = safeSnapshotPath(root, fileName)
    const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`
    try {
      index.save(temporaryPath)
      await chmod(temporaryPath, 0o600)
      await rename(temporaryPath, path)
      const file = await stat(path)
      const built = {
        fileBytes: file.size,
        fileName,
        fileSha256: await sha256File(path),
        indexEntries: groups.size,
        path,
      }
      if (!await activateBuild(
        db,
        scope,
        snapshot,
        visibleStatementsSql,
        built,
      )) return null
      return {
        evidenceEntries: snapshot.summary.entries,
        index,
        indexEntries: groups.size,
        revision: snapshot.revision,
        sourceDimensions: snapshot.summary.minimumDimensions,
      }
    } catch {
      await rm(temporaryPath, { force: true })
      await rm(path, { force: true })
      return null
    }
  }

  return Object.freeze({
    async candidateKeys(db, {
      limit,
      queryVectors,
      scope: scopeInput,
      visibleStatementsSql,
    } = {}) {
      if (!root || !Array.isArray(queryVectors)) return null
      const resultLimit = Math.max(1, Math.min(Number(limit) || 20, 200))
      if (resultLimit > MAX_APPROXIMATE_RESULT_LIMIT) return null
      const scope = scopeIdentity(scopeInput)
      const revision = revisionFor(db, scope)
      let state = states.get(scope.key)
      if (!stateMatchesRevision(state, revision)) {
        state = null
        const metadata = snapshotMetadata(db, scope)
        let snapshot = null
        if (!metadataMatchesRevision(metadata, revision, threshold)) {
          snapshot = readBoundSnapshot(db, scope, visibleStatementsSql)
          if (
            snapshot.missing ||
            snapshot.summary.entries < threshold ||
            snapshot.summary.minimumDimensions < SEMANTIC_HNSW_DIMENSIONS ||
            snapshot.summary.minimumDimensions !==
              snapshot.summary.maximumDimensions
          ) {
            if (metadata) await deactivate(db, scope, metadata)
            return null
          }
        }
        const native = await nativeModule()
        if (!native) return null
        if (metadataMatchesRevision(metadata, revision, threshold)) {
          try {
            state = await loadState(metadata, native.Index)
          } catch {
            await deactivate(db, scope, metadata)
            return null
          }
        } else {
          state = await buildState(
            db,
            scope,
            visibleStatementsSql,
            native.Index,
          )
        }
        if (!state) return null
        states.set(scope.key, state)
      }

      const queries = queryVectors.map((vector) =>
        projectedVector(vector, state.sourceDimensions))
      if (queries.some((vector) => vector === null)) return null

      const candidates = Math.min(CANDIDATE_LIMIT, state.indexEntries)
      return Object.freeze({
        candidateKeys: queries.map((query) => [
          ...state.index.search(query, candidates, 1).keys,
        ].map(hexFromKey)),
        revision: state.revision,
        sourceDimensions: state.sourceDimensions,
      })
    },

    close() {
      states.clear()
    },
  })
}

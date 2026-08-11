// Semantic finding aid over the canonical dialogue journal.
//
// THE SAME LAW AS RANKED SEARCH: an index may LOCATE evidence; it may never
// BE evidence. Vectors are derived data over journal rows. Whatever cosine
// similarity surfaces, the thing returned is the canonical row — host
// speaker, host time, byte-exact text — inside the caller's visible scope.
// Nothing model-written is stored as memory, and deleting a journal row
// removes its vector by trigger.
//
// WHY THIS EXISTS: the scale probe measured the lexical boundary exactly.
// At 5,000 messages, ranked BM25 with stemming recovers 25/25 planted facts
// asked with shared-vocabulary paraphrases — and 0/25 asked with
// zero-overlap wording ("how do I get into my flat" vs "the spare key is in
// the ceramic pot"). Bridging that gap requires meaning, which requires an
// embedding model.
//
// The embedder is therefore PLUGGABLE and OPTIONAL: `embed(texts) ->
// number[][]`, supplied by the product (Gemini, OpenAI, or local). Without
// one, nothing here runs, nothing dials out, and the system behaves exactly
// as before — no key, no spend, no surprise network calls. Determinism note:
// results are a pure function of the stored vectors; the same journal
// embedded by the same model yields the same ranking, with chronology
// breaking ties.

const VECTOR_TABLE = 'dialogue_evidence_vectors'
const VECTOR_PENDING_TABLE = 'dialogue_evidence_vector_pending'
const MAX_SEMANTIC_BATCH_PHRASES = 16
const DEFAULT_SEMANTIC_CATCH_UP_ROWS = 64
const MAX_SEMANTIC_CATCH_UP_ROWS = 200

// Internal identity used by the answer orchestrator. The public error still
// has a stable string code; the symbol prevents an unrelated embedder error
// with the same text/code from being mistaken for safe fallback.
export const SEMANTIC_INDEX_CATCHING_UP = Symbol(
  'semantic-index-catching-up',
)

function ensureSemanticIndex(db) {
  const table = db.prepare(`
    SELECT 1 AS present
    FROM sqlite_master
    WHERE type = 'table' AND name = ?
  `)
  const needsSeed = !table.get(VECTOR_TABLE)?.present ||
    !table.get(VECTOR_PENDING_TABLE)?.present
  if (needsSeed) db.exec('BEGIN IMMEDIATE')
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS ${VECTOR_TABLE} (
        evidence_id TEXT PRIMARY KEY,
        dims INTEGER NOT NULL,
        vector BLOB NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ${VECTOR_PENDING_TABLE} (
        evidence_id TEXT PRIMARY KEY,
        palari_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        dialogue_order INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS ${VECTOR_PENDING_TABLE}_scope_order
        ON ${VECTOR_PENDING_TABLE} (
          palari_id,
          user_id,
          dialogue_order,
          evidence_id
        );
      CREATE TRIGGER IF NOT EXISTS ${VECTOR_TABLE}_ad
      AFTER DELETE ON dialogue_evidence BEGIN
        DELETE FROM ${VECTOR_TABLE} WHERE evidence_id = old.id;
      END;
      CREATE TRIGGER IF NOT EXISTS ${VECTOR_TABLE}_au
      AFTER UPDATE OF content ON dialogue_evidence BEGIN
        DELETE FROM ${VECTOR_TABLE} WHERE evidence_id = old.id;
      END;
      CREATE TRIGGER IF NOT EXISTS ${VECTOR_PENDING_TABLE}_ai
      AFTER INSERT ON dialogue_evidence BEGIN
        INSERT OR REPLACE INTO ${VECTOR_PENDING_TABLE}
          (evidence_id, palari_id, user_id, dialogue_order)
        VALUES (new.id, new.palari_id, new.user_id, new.dialogue_order);
      END;
      CREATE TRIGGER IF NOT EXISTS ${VECTOR_PENDING_TABLE}_au
      AFTER UPDATE OF content, palari_id, user_id, dialogue_order
      ON dialogue_evidence BEGIN
        INSERT OR REPLACE INTO ${VECTOR_PENDING_TABLE}
          (evidence_id, palari_id, user_id, dialogue_order)
        VALUES (new.id, new.palari_id, new.user_id, new.dialogue_order);
      END;
      CREATE TRIGGER IF NOT EXISTS ${VECTOR_PENDING_TABLE}_ad
      AFTER DELETE ON dialogue_evidence BEGIN
        DELETE FROM ${VECTOR_PENDING_TABLE} WHERE evidence_id = old.id;
      END;
    `)
    if (needsSeed) {
      db.exec(`
        INSERT OR IGNORE INTO ${VECTOR_PENDING_TABLE} (
          evidence_id,
          palari_id,
          user_id,
          dialogue_order
        )
        SELECT
          e.id,
          e.palari_id,
          e.user_id,
          e.dialogue_order
        FROM dialogue_evidence e
        LEFT JOIN ${VECTOR_TABLE} v ON v.evidence_id = e.id
        WHERE v.evidence_id IS NULL;
      `)
      db.exec('COMMIT')
    }
  } catch (error) {
    if (needsSeed) db.exec('ROLLBACK')
    throw error
  }
}

function toBlob(vector) {
  const floats = Float32Array.from(vector, Number)
  return new Uint8Array(floats.buffer.slice(0))
}

function fromBlob(blob) {
  const bytes = blob instanceof Uint8Array ? blob : new Uint8Array(blob)
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

function assertVectors(vectors, expected, label) {
  if (!Array.isArray(vectors) || vectors.length !== expected) {
    throw new TypeError(
      `${label} must return one vector per input text.`,
    )
  }
}

function boundedCatchUpRows(value = DEFAULT_SEMANTIC_CATCH_UP_ROWS) {
  const rows = Number(value)
  if (!Number.isSafeInteger(rows) || rows < 1 ||
    rows > MAX_SEMANTIC_CATCH_UP_ROWS) {
    throw new TypeError(
      `batchSize must be an integer from 1 to ` +
        `${MAX_SEMANTIC_CATCH_UP_ROWS}.`,
    )
  }
  return rows
}

function indexProgress(indexed, complete) {
  return Object.freeze({
    complete,
    indexed,
    operation: 'memory_semantic_index',
    status: complete ? 'ready' : 'catching_up',
  })
}

function hasMissingVectors(db, { scope, visibleStatementsSql }) {
  return Boolean(db.prepare(`
    WITH visible AS (${visibleStatementsSql})
    SELECT 1 AS missing
    FROM ${VECTOR_PENDING_TABLE} pending
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

// Index at most one bounded batch of visible journal rows. Repeating this
// explicit maintenance operation drains a historical backlog; a query also
// performs at most one such batch before deciding whether its scoped bank is
// complete. The pending table is a small, rebuildable checkpoint: it is
// seeded once for old databases and maintained alongside evidence by trigger.
export async function indexEvidenceVectors(db, {
  batchSize = DEFAULT_SEMANTIC_CATCH_UP_ROWS,
  embed,
  scope,
  visibleStatementsSql,
}) {
  if (typeof embed !== 'function') {
    throw new TypeError('indexEvidenceVectors requires an embed function.')
  }
  ensureSemanticIndex(db)
  const limit = boundedCatchUpRows(batchSize)
  const missing = db.prepare(`
    WITH visible AS (${visibleStatementsSql})
    SELECT visible.id, visible.content
    FROM ${VECTOR_PENDING_TABLE} pending
    JOIN visible ON visible.id = pending.evidence_id
    WHERE pending.palari_id = ? AND pending.user_id = ?
    ORDER BY
      pending.dialogue_order ASC,
      pending.evidence_id ASC
    LIMIT ?
  `).all(
    scope.palariId,
    scope.userId,
    scope.palariId,
    scope.userId,
    limit,
  )
  if (!missing.length) return indexProgress(0, true)

  const vectors = await embed(missing.map((row) => String(row.content)))
  assertVectors(vectors, missing.length, 'embed')
  const insert = db.prepare(`
    INSERT OR REPLACE INTO ${VECTOR_TABLE} (evidence_id, dims, vector)
    VALUES (?, ?, ?)
  `)
  const current = db.prepare(`
    SELECT content
    FROM dialogue_evidence
    WHERE id = ?
  `)
  const remove = db.prepare(`
    DELETE FROM ${VECTOR_PENDING_TABLE}
    WHERE evidence_id = ?
  `)
  let indexed = 0
  db.exec('BEGIN IMMEDIATE')
  try {
    for (const [index, row] of missing.entries()) {
      const present = current.get(row.id)
      if (!present || String(present.content) !== String(row.content)) continue
      if (remove.run(row.id).changes !== 1) continue
      insert.run(row.id, vectors[index].length, toBlob(vectors[index]))
      indexed += 1
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
  return indexProgress(
    indexed,
    !hasMissingVectors(db, { scope, visibleStatementsSql }),
  )
}

function catchingUp(progress) {
  const error = new Error(
    'Semantic index is catching up. Retry later or call indexSemantic(); ' +
      'scoped exact/ranked retrieval remains available.',
  )
  error.code = 'SEMANTIC_INDEX_CATCHING_UP'
  Object.defineProperty(error, SEMANTIC_INDEX_CATCHING_UP, { value: true })
  Object.defineProperty(error, 'semanticIndex', {
    enumerable: true,
    value: progress,
  })
  return error
}

// Cosine top-k over the caller's visible rows, returned as canonical rows
// with a similarity score. Brute force is deliberate: at chat-history scale
// (thousands to low hundreds of thousands of rows) a linear scan in
// milliseconds beats carrying an ANN dependency, and it is exactly
// reproducible.
export async function semanticFindEvidenceBatch(db, {
  embed,
  limit = 20,
  phrases,
  scope,
  visibleStatementsSql,
}) {
  if (typeof embed !== 'function') {
    throw new TypeError(
      'semanticFindEvidenceBatch requires an embed function.',
    )
  }
  if (!Array.isArray(phrases) || phrases.length < 1 ||
    phrases.length > MAX_SEMANTIC_BATCH_PHRASES) {
    throw new TypeError(
      `semanticFindEvidenceBatch requires 1 to ` +
        `${MAX_SEMANTIC_BATCH_PHRASES} phrases.`,
    )
  }
  const needles = phrases.map((phrase, index) => {
    const needle = String(phrase ?? '').trim()
    if (!needle) {
      throw new TypeError(
        `semanticFindEvidenceBatch phrase ${index} must be non-empty.`,
      )
    }
    return needle
  })
  const progress = await indexEvidenceVectors(db, {
    embed,
    scope,
    visibleStatementsSql,
  })
  if (!progress.complete) throw catchingUp(progress)
  const queryVectors = await embed(needles)
  assertVectors(queryVectors, needles.length, 'embed')
  for (let index = 0; index < queryVectors.length; index += 1) {
    if (!queryVectors[index]?.length) {
      throw new TypeError(
        `embed returned no vector for query ${index}.`,
      )
    }
  }
  // Query embedding is asynchronous, so a canonical write may land after the
  // first completeness check. Pin the final check and vector read to one WAL
  // snapshot; a successful result then covers that complete scoped snapshot.
  let rows
  let transactionOpen = true
  db.exec('BEGIN')
  try {
    if (hasMissingVectors(db, { scope, visibleStatementsSql })) {
      db.exec('ROLLBACK')
      transactionOpen = false
      throw catchingUp(indexProgress(progress.indexed, false))
    }
    rows = db.prepare(`
      WITH visible AS (${visibleStatementsSql})
      SELECT visible.*, v.vector AS semantic_vector
      FROM visible
      JOIN ${VECTOR_TABLE} v ON v.evidence_id = visible.id
    `).all(scope.palariId, scope.userId)
    db.exec('COMMIT')
    transactionOpen = false
  } catch (error) {
    if (transactionOpen) db.exec('ROLLBACK')
    throw error
  }
  const vectorRows = rows.map((row) => ({
    row,
    vector: fromBlob(row.semantic_vector),
  }))
  const boundedLimit = Math.max(1, Math.min(Number(limit) || 20, 200))
  return queryVectors.map((queryVector) => {
    const query = Float32Array.from(queryVector, Number)
    return vectorRows
      .map(({ row, vector }) => ({
        row,
        similarity: cosine(query, vector),
      }))
      .sort((left, right) =>
        right.similarity - left.similarity ||
        String(left.row.event_at).localeCompare(String(right.row.event_at)) ||
        Number(left.row.dialogue_order) - Number(right.row.dialogue_order))
      .slice(0, boundedLimit)
      .map(({ row, similarity }) => {
        const { semantic_vector: _vector, ...canonical } = row
        return { ...canonical, similarity }
      })
  })
}

export async function semanticFindEvidence(db, options = {}) {
  const [rows] = await semanticFindEvidenceBatch(db, {
    ...options,
    phrases: [options.phrase],
  })
  return rows
}

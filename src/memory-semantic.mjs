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
const MAX_SEMANTIC_BATCH_PHRASES = 16

function ensureSemanticIndex(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${VECTOR_TABLE} (
      evidence_id TEXT PRIMARY KEY,
      dims INTEGER NOT NULL,
      vector BLOB NOT NULL
    );
    CREATE TRIGGER IF NOT EXISTS ${VECTOR_TABLE}_ad
    AFTER DELETE ON dialogue_evidence BEGIN
      DELETE FROM ${VECTOR_TABLE} WHERE evidence_id = old.id;
    END;
    CREATE TRIGGER IF NOT EXISTS ${VECTOR_TABLE}_au
    AFTER UPDATE OF content ON dialogue_evidence BEGIN
      DELETE FROM ${VECTOR_TABLE} WHERE evidence_id = old.id;
    END;
  `)
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

// Embed every visible journal row that has no vector yet. Incremental and
// idempotent: steady-state cost is one SELECT. Batching is the embedder's
// concern; this passes at most `batchSize` texts per call.
async function indexEvidenceVectors(db, {
  batchSize = 64,
  embed,
  scope,
  visibleStatementsSql,
}) {
  if (typeof embed !== 'function') {
    throw new TypeError('indexEvidenceVectors requires an embed function.')
  }
  ensureSemanticIndex(db)
  let indexed = 0
  for (;;) {
    const missing = db.prepare(`
      WITH visible AS (${visibleStatementsSql})
      SELECT visible.id, visible.content
      FROM visible
      LEFT JOIN ${VECTOR_TABLE} v ON v.evidence_id = visible.id
      WHERE v.evidence_id IS NULL
      LIMIT ?
    `).all(scope.palariId, scope.userId, batchSize)
    if (!missing.length) return indexed
    const vectors = await embed(missing.map((row) => String(row.content)))
    assertVectors(vectors, missing.length, 'embed')
    const insert = db.prepare(`
      INSERT OR REPLACE INTO ${VECTOR_TABLE} (evidence_id, dims, vector)
      VALUES (?, ?, ?)
    `)
    for (const [index, row] of missing.entries()) {
      insert.run(row.id, vectors[index].length, toBlob(vectors[index]))
    }
    indexed += missing.length
  }
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
  await indexEvidenceVectors(db, { embed, scope, visibleStatementsSql })
  const queryVectors = await embed(needles)
  assertVectors(queryVectors, needles.length, 'embed')
  for (let index = 0; index < queryVectors.length; index += 1) {
    if (!queryVectors[index]?.length) {
      throw new TypeError(
        `embed returned no vector for query ${index}.`,
      )
    }
  }
  const rows = db.prepare(`
    WITH visible AS (${visibleStatementsSql})
    SELECT visible.*, v.vector AS semantic_vector
    FROM visible
    JOIN ${VECTOR_TABLE} v ON v.evidence_id = visible.id
  `).all(scope.palariId, scope.userId)
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

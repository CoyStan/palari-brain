// A Graphiti-style temporal graph as a DERIVED VIEW over the journal.
//
// WHAT IS BORROWED AND WHAT IS CORRECTED
//
// Borrowed from the temporal-knowledge-graph school (Graphiti/Zep):
// relations as first-class rows, chronology on every edge, provenance from
// each edge back to the episode that produced it, incremental extraction,
// multi-hop lookup ("which hospital does my sister's doctor work at?").
//
// Corrected to Palari's law — an index may LOCATE evidence; it may never BE
// evidence:
//
//   - Every edge carries an exact, host-verified quote from one canonical
//     journal row. A fabricated or paraphrased quote is refused at
//     admission, and a quote in negated/conditional/quoted-speech/pasted
//     context is refused by the same guard the digest uses.
//   - Speaker and time are stamped from the journal row. The extractor
//     model proposes only (subject, predicate, object, quote).
//   - VALIDITY IS COMPUTED, NEVER STORED. Graphiti asks a model to decide
//     when an old fact is invalidated; that is testimony. Here, edges are
//     immutable observations, and a query marks the newest edge per
//     (speaker, subject, predicate) as `latestForPredicate` — chronology
//     exposed, truth left to the consumer, exactly like the correction case
//     of the trust benchmark.
//   - Deleting a journal row deletes its edges by trigger, and because
//     validity is computed, deleting a correction resurrects the prior
//     statement automatically — the graph always equals a pure function of
//     the surviving journal.
//   - The whole view is rebuildable from scratch at any time.
//
// The extractor is PLUGGABLE and OPTIONAL, like the embedder: without one,
// extraction refuses loudly, queries return what was admitted, and nothing
// dials out.
//
//   extractor({ evidence: [{ ref, speaker, text }] })
//     -> { assertions: [{ evidenceRef, object, predicate, quote, subject }] }

import { createHash } from 'node:crypto'

import { analyzeQuoteContext } from './quote-context.mjs'

export const GRAPH_MAX_ASSERTIONS_PER_BATCH = 16
export const GRAPH_MAX_ENTITY_CHARS = 120
export const GRAPH_MAX_PREDICATE_CHARS = 60
export const GRAPH_MAX_QUOTE_CHARS = 500
export const GRAPH_MAX_HOPS = 3

export function graphKey(value) {
  return String(value ?? '')
    .normalize('NFC')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLowerCase()
}

function invalid(message) {
  const error = new TypeError(message)
  error.code = 'GRAPH_ASSERTION_INVALID'
  throw error
}

function boundedText(value, label, maxChars) {
  const text = String(value ?? '').trim()
  if (!text) invalid(`${label} must be a non-empty string.`)
  if (text.length > maxChars) {
    invalid(`${label} exceeds ${maxChars} characters.`)
  }
  return text
}

export function ensureGraphSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS dialogue_graph_edges (
      id TEXT PRIMARY KEY,
      palari_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      subject TEXT NOT NULL,
      subject_key TEXT NOT NULL,
      predicate TEXT NOT NULL,
      predicate_key TEXT NOT NULL,
      object TEXT NOT NULL,
      object_key TEXT NOT NULL,
      speaker TEXT NOT NULL,
      evidence_id TEXT NOT NULL,
      quote TEXT NOT NULL,
      observed_at TEXT NOT NULL,
      dialogue_order INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS dialogue_graph_subject
      ON dialogue_graph_edges (palari_id, user_id, subject_key);
    CREATE INDEX IF NOT EXISTS dialogue_graph_object
      ON dialogue_graph_edges (palari_id, user_id, object_key);
    CREATE TABLE IF NOT EXISTS dialogue_graph_extracted (
      evidence_id TEXT PRIMARY KEY
    );
    CREATE TRIGGER IF NOT EXISTS dialogue_graph_edges_ad
    AFTER DELETE ON dialogue_evidence BEGIN
      DELETE FROM dialogue_graph_edges WHERE evidence_id = old.id;
      DELETE FROM dialogue_graph_extracted WHERE evidence_id = old.id;
    END;
  `)
}

// Host admission for one batch of proposed assertions against the evidence
// rows the extractor was shown. Everything checkable is checked here; what
// cannot be checked (whether the triple is a fair reading of the quote) is
// bounded by the quote riding along on every edge, visible to any consumer.
export function admitGraphAssertions(db, scope, proposals, evidenceRows) {
  ensureGraphSchema(db)
  const byRef = new Map(evidenceRows.map((row, index) => [
    `e${index}`,
    row,
  ]))
  if (!Array.isArray(proposals)) invalid('assertions must be an array.')
  if (proposals.length > GRAPH_MAX_ASSERTIONS_PER_BATCH) {
    invalid(`assertions exceeds ${GRAPH_MAX_ASSERTIONS_PER_BATCH} items.`)
  }
  const insert = db.prepare(`
    INSERT OR IGNORE INTO dialogue_graph_edges (
      id, palari_id, user_id,
      subject, subject_key, predicate, predicate_key, object, object_key,
      speaker, evidence_id, quote, observed_at, dialogue_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  let admitted = 0
  for (const [index, proposal] of proposals.entries()) {
    const label = `assertions[${index}]`
    const evidence = byRef.get(String(proposal?.evidenceRef ?? ''))
    if (!evidence) invalid(`${label}.evidenceRef is unknown.`)
    const subject = boundedText(
      proposal.subject, `${label}.subject`, GRAPH_MAX_ENTITY_CHARS)
    const predicate = boundedText(
      proposal.predicate, `${label}.predicate`, GRAPH_MAX_PREDICATE_CHARS)
    const object = boundedText(
      proposal.object, `${label}.object`, GRAPH_MAX_ENTITY_CHARS)
    const quote = boundedText(
      proposal.quote, `${label}.quote`, GRAPH_MAX_QUOTE_CHARS)
    if (!String(evidence.content).includes(quote)) {
      invalid(`${label}.quote is not an exact contiguous quote ` +
        `from its evidence.`)
    }
    const context = analyzeQuoteContext(String(evidence.content), quote)
    if (!context.clean) {
      invalid(`${label}.quote sits in ${context.reasons.join(' and ')} ` +
        `context; widen the quote to include the qualifying words.`)
    }
    const speaker = evidence.source_kind === 'user_message'
      ? 'user'
      : 'Palari'
    const id = `edge_${createHash('sha256').update(JSON.stringify([
      scope.palariId, scope.userId,
      graphKey(subject), graphKey(predicate), graphKey(object),
      evidence.id, quote,
    ])).digest('hex')}`
    insert.run(
      id, scope.palariId, scope.userId,
      subject, graphKey(subject),
      predicate, graphKey(predicate),
      object, graphKey(object),
      speaker, String(evidence.id), quote,
      String(evidence.event_at), Number(evidence.dialogue_order),
    )
    admitted += 1
  }
  return admitted
}

// Incremental extraction over journal rows not yet visited. A row is marked
// visited even when it yields no assertions, so steady state costs one
// SELECT. Rebuild-from-scratch = DELETE both graph tables and re-run.
export async function extractGraph(db, scope, {
  batchSize = 20,
  extractor,
  maxBatches = 25,
  visibleStatementsSql,
}) {
  if (typeof extractor !== 'function') {
    throw new TypeError('extractGraph requires an extractor function.')
  }
  ensureGraphSchema(db)
  let admitted = 0
  for (let batch = 0; batch < maxBatches; batch += 1) {
    const rows = db.prepare(`
      WITH visible AS (${visibleStatementsSql})
      SELECT visible.*
      FROM visible
      LEFT JOIN dialogue_graph_extracted x ON x.evidence_id = visible.id
      WHERE x.evidence_id IS NULL
      ORDER BY visible.event_at ASC, visible.dialogue_order ASC
      LIMIT ?
    `).all(scope.palariId, scope.userId, batchSize)
    if (!rows.length) break
    const proposal = await extractor({
      evidence: rows.map((row, index) => ({
        ref: `e${index}`,
        speaker: row.source_kind === 'user_message' ? 'user' : 'Palari',
        text: String(row.content),
      })),
    })
    admitted += admitGraphAssertions(
      db, scope, proposal?.assertions ?? [], rows)
    const mark = db.prepare(
      'INSERT OR IGNORE INTO dialogue_graph_extracted VALUES (?)')
    for (const row of rows) mark.run(String(row.id))
  }
  return admitted
}

function edgeShape(row, latestKeys) {
  const key = `${row.speaker} ${row.subject_key} ${row.predicate_key}`
  return {
    evidenceId: row.evidence_id,
    latestForPredicate: latestKeys.get(key) === row.id,
    object: row.object,
    observedAt: row.observed_at,
    predicate: row.predicate,
    quote: row.quote,
    speaker: row.speaker,
    subject: row.subject,
  }
}

// Multi-hop lookup from a named entity. Pure SQL + BFS, no model, so it is
// deterministic and can run without any extractor configured. Chronology is
// exposed on every edge; `latestForPredicate` marks the newest observation
// per (speaker, subject, predicate) so a consumer can prefer the current
// value without the graph ever deciding truth.
export function graphFind(db, scope, {
  entity,
  hops = 1,
  limit = 50,
} = {}) {
  ensureGraphSchema(db)
  const startKey = graphKey(entity)
  if (!startKey) invalid('graphFind requires an entity.')
  const depth = Math.max(1, Math.min(Number(hops) || 1, GRAPH_MAX_HOPS))
  const cap = Math.max(1, Math.min(Number(limit) || 50, 200))

  const seenKeys = new Set([startKey])
  const seenEdges = new Map()
  let frontier = [startKey]
  for (let hop = 0; hop < depth && frontier.length; hop += 1) {
    const next = new Set()
    for (const key of frontier) {
      const rows = db.prepare(`
        SELECT * FROM dialogue_graph_edges
        WHERE palari_id = ? AND user_id = ?
          AND (subject_key = ? OR object_key = ?)
        ORDER BY observed_at ASC, dialogue_order ASC
      `).all(scope.palariId, scope.userId, key, key)
      for (const row of rows) {
        seenEdges.set(row.id, row)
        for (const neighbour of [row.subject_key, row.object_key]) {
          if (!seenKeys.has(neighbour)) {
            seenKeys.add(neighbour)
            next.add(neighbour)
          }
        }
      }
    }
    frontier = [...next]
  }

  const ordered = [...seenEdges.values()].sort((left, right) =>
    String(left.observed_at).localeCompare(String(right.observed_at)) ||
    Number(left.dialogue_order) - Number(right.dialogue_order))
  const latestKeys = new Map()
  for (const row of ordered) {
    latestKeys.set(
      `${row.speaker} ${row.subject_key} ${row.predicate_key}`,
      row.id,
    )
  }
  const edges = ordered.slice(0, cap).map((row) =>
    edgeShape(row, latestKeys))
  return {
    edges,
    entity: String(entity),
    hops: depth,
    operation: 'memory_graph',
    truncated: ordered.length > cap,
  }
}

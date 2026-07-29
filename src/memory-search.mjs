// Ranked lexical search over the canonical dialogue journal.
//
// THE RULE THIS MODULE LIVES UNDER
//
// An index may LOCATE evidence; it may never BE evidence. Everything returned
// here is a canonical journal row — host-recorded speaker, time, order, and
// byte-exact text — reached through the same visible-statements scope filter
// as exact exploration. The ranking is a finding aid layered on top of the
// journal; nothing model-written is indexed, stored, or returned, so a ranked
// hit carries exactly the same provenance as an exact one.
//
// Why this exists: `memory_find` is exact substring matching. It is
// deterministic and auditable, and it fails the most common real question —
// the user asks with different words than they originally spoke ("where is
// my spare key?" vs "I keep the spare key in the blue pot"). Ranked mode
// tokenizes the query, drops stopwords, and lets SQLite FTS5/BM25 order the
// journal rows that share those terms. Same corpus in, same order out: BM25
// is a pure function of the stored text, and ties break on chronology, so a
// ranked consultation is still reproducible.
//
// This mirrors the established `memory_fts` idiom in `memory-store.mjs`
// (same tokenizer, same trigger shape) applied to `dialogue_evidence`.

import {
  extractMemoryQueryKeywords,
} from './memory-store.mjs'

export const DIALOGUE_SEARCH_MAX_TERMS = 8

// Porter stemming on top of the same unicode folding the memory FTS uses.
// The asker says "hiding", the journal says "hid the spare key": stemming
// folds both to one term at index AND query time, which is the cheapest
// real recall win available without any model. Stemming never changes what
// a hit IS — still a canonical row — only how it is found.
export const DIALOGUE_SEARCH_TOKENIZER =
  'porter unicode61 remove_diacritics 2'

function ftsTerm(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

// Query terms after normalization and stopwording. An empty result means the
// phrase has no rankable content (all stopwords, or too short) — callers fall
// back to exact matching rather than guessing.
export function rankedDialogueQueryTerms(phrase) {
  return extractMemoryQueryKeywords(phrase, {
    limit: DIALOGUE_SEARCH_MAX_TERMS,
  })
}

export function rankedDialogueQuery(terms) {
  return terms.map(ftsTerm).join(' OR ')
}

// Idempotent: creates the index, the keep-in-sync triggers, and backfills any
// journal rows written before the index existed. Safe to call before every
// ranked search; SQLite makes the steady-state calls cheap no-ops. The index
// is derived data, so a tokenizer upgrade simply drops and rebuilds it from
// the journal — nothing canonical is touched.
export function ensureDialogueSearchIndex(db) {
  const existing = db.prepare(`
    SELECT sql FROM sqlite_master
    WHERE type = 'table' AND name = 'dialogue_evidence_fts'
  `).get()
  if (existing && !String(existing.sql).includes('porter')) {
    db.exec(`
      DROP TRIGGER IF EXISTS dialogue_evidence_fts_ai;
      DROP TRIGGER IF EXISTS dialogue_evidence_fts_ad;
      DROP TRIGGER IF EXISTS dialogue_evidence_fts_au;
      DROP TABLE dialogue_evidence_fts;
    `)
  }
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS dialogue_evidence_fts USING fts5(
      evidence_id UNINDEXED,
      content,
      tokenize = '${DIALOGUE_SEARCH_TOKENIZER}'
    );
    CREATE TRIGGER IF NOT EXISTS dialogue_evidence_fts_ai
    AFTER INSERT ON dialogue_evidence BEGIN
      INSERT INTO dialogue_evidence_fts(rowid, evidence_id, content)
      VALUES (new.rowid, new.id, new.content);
    END;
    CREATE TRIGGER IF NOT EXISTS dialogue_evidence_fts_ad
    AFTER DELETE ON dialogue_evidence BEGIN
      DELETE FROM dialogue_evidence_fts WHERE rowid = old.rowid;
    END;
    CREATE TRIGGER IF NOT EXISTS dialogue_evidence_fts_au
    AFTER UPDATE OF content ON dialogue_evidence BEGIN
      DELETE FROM dialogue_evidence_fts WHERE rowid = old.rowid;
      INSERT INTO dialogue_evidence_fts(rowid, evidence_id, content)
      VALUES (new.rowid, new.id, new.content);
    END;
  `)
  db.prepare(`
    INSERT INTO dialogue_evidence_fts(rowid, evidence_id, content)
    SELECT e.rowid, e.id, e.content
    FROM dialogue_evidence e
    WHERE e.rowid NOT IN (SELECT rowid FROM dialogue_evidence_fts)
  `).run()
}

// Ranked rows in the same shape the exact path produces, restricted to the
// same visible scope. Deleted journal rows can never appear: the tombstone
// trigger removes them from the index, and the visible-statements join would
// exclude them regardless — two independent walls.
export function searchDialogueEvidenceRanked(db, {
  limit,
  phrase,
  scope,
  visibleStatementsSql,
}) {
  const terms = rankedDialogueQueryTerms(phrase)
  if (!terms.length) return { rows: [], terms }
  ensureDialogueSearchIndex(db)
  const rows = db.prepare(`
    WITH visible AS (${visibleStatementsSql}),
    hits AS (
      SELECT evidence_id, bm25(dialogue_evidence_fts) AS search_rank
      FROM dialogue_evidence_fts
      WHERE dialogue_evidence_fts MATCH ?
    )
    SELECT visible.*, hits.search_rank
    FROM visible
    JOIN hits ON hits.evidence_id = visible.id
    ORDER BY hits.search_rank ASC, visible.event_at ASC,
      visible.dialogue_order ASC
    LIMIT ?
  `).all(
    scope.palariId,
    scope.userId,
    rankedDialogueQuery(terms),
    limit,
  )
  return { rows, terms }
}

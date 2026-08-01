// Deletion requests with an honesty report.
//
// `forgetMemories` deletes exactly the rows the caller names. Real deletion
// requests arrive as language, not IDs: "forget what I told you about
// Lexapro." This module turns the phrase into candidate rows using the same
// finding aids retrieval uses (exact substring + ranked BM25), widens every
// hit to its whole turn — the assistant reply usually echoes what the user
// said, and a deletion that leaves the echo standing has not deleted — and
// then, after the deletion runs, RE-PROBES the journal and reports what
// still mentions the subject.
//
// The re-probe is the honest part. It searches surviving rows three ways:
// with the request phrase exactly, with the request phrase's ranked terms,
// and with terms drawn from the text that was just deleted — so a
// paraphrase that never used the requested word ("the little white pill")
// is still surfaced whenever it shares any content term with the deleted
// evidence. What the probes cannot see, they cannot report: a paraphrase
// with zero lexical overlap survives silently, which is exactly the lexical
// boundary the semantic seam exists for. The report never claims "clean" —
// it lists what it found and lets the caller read the residual rows.
//
// Deletion itself is not duplicated here. Candidates flow into the existing
// `forgetById` path, so tombstones, sibling cleanup, digest invalidation,
// and the FTS/vector/graph delete triggers all fire exactly as they do for
// an ID-addressed deletion.

import { extractMemoryQueryKeywords } from './memory-store.mjs'
import {
  rankedDialogueQueryTerms,
  searchDialogueEvidenceRanked,
} from './memory-search.mjs'

export const FORGET_MAX_PHRASE_CHARS = 200
export const FORGET_CANDIDATE_LIMIT = 200
export const FORGET_RESIDUAL_LIMIT = 20
const RESIDUAL_SNIPPET_CHARS = 160
const DELETED_CONTENT_TERM_LIMIT = 12

function normalizedPhrase(phrase) {
  const needle = String(phrase ?? '').trim()
  if (!needle) throw new TypeError('forget requires a phrase.')
  if (needle.length > FORGET_MAX_PHRASE_CHARS) {
    throw new TypeError(
      `phrase must be at most ${FORGET_MAX_PHRASE_CHARS} characters.`,
    )
  }
  return needle
}

function speakerOf(sourceKind) {
  return sourceKind === 'user_message' ? 'user' : 'Palari'
}

// A turn writes `<base>:user` and `<base>:assistant` rows. Given either
// role's source_message_id, name both so the whole exchange is deleted.
function turnRoleMessageIds(sourceMessageId) {
  const text = String(sourceMessageId ?? '')
  const cut = text.lastIndexOf(':')
  const suffix = cut < 0 ? '' : text.slice(cut + 1)
  if (suffix !== 'user' && suffix !== 'assistant') return [text]
  const base = text.slice(0, cut)
  return [`${base}:user`, `${base}:assistant`]
}

function snippetAround(text, needles, chars = RESIDUAL_SNIPPET_CHARS) {
  const lowered = text.toLowerCase()
  let at = -1
  for (const needle of needles) {
    const index = lowered.indexOf(String(needle).toLowerCase())
    if (index >= 0 && (at < 0 || index < at)) at = index
  }
  if (at < 0) at = 0
  const start = Math.max(0, at - Math.floor(chars / 2))
  return text.slice(start, start + chars)
}

// Locate every visible row the phrase can reach — exact substring hits
// plus ranked (stemmed BM25) hits — then widen each hit to its whole turn.
// Returns the rows' contents alongside the IDs: the residual probe needs
// the deleted text's own vocabulary, and after deletion it is gone.
export function collectForgetCandidates(db, scope, {
  limit = FORGET_CANDIDATE_LIMIT,
  phrase,
  visibleStatementsSql,
}) {
  const needle = normalizedPhrase(phrase)
  const exact = db.prepare(`
    WITH visible AS (${visibleStatementsSql})
    SELECT id, source_message_id, content
    FROM visible
    WHERE instr(lower(content), lower(?)) > 0
    ORDER BY event_at ASC, dialogue_order ASC
    LIMIT ?
  `).all(scope.palariId, scope.userId, needle, limit)
  const ranked = searchDialogueEvidenceRanked(db, {
    limit,
    phrase: needle,
    scope,
    visibleStatementsSql,
  })

  const hits = new Map()
  for (const row of [...exact, ...ranked.rows]) {
    hits.set(String(row.id), row)
  }

  // Widen to turns: any row sharing a hit's turn base is a candidate, so
  // the assistant's echo of a user statement (and vice versa) goes too.
  const messageIds = new Set()
  for (const row of hits.values()) {
    for (const id of turnRoleMessageIds(row.source_message_id)) {
      messageIds.add(id)
    }
  }
  const evidenceIds = new Set(hits.keys())
  const contents = [...hits.values()].map((row) => String(row.content))
  if (messageIds.size) {
    const ids = [...messageIds]
    const placeholders = ids.map(() => '?').join(', ')
    const siblings = db.prepare(`
      WITH visible AS (${visibleStatementsSql})
      SELECT id, content
      FROM visible
      WHERE source_message_id IN (${placeholders})
    `).all(scope.palariId, scope.userId, ...ids)
    for (const row of siblings) {
      if (evidenceIds.has(String(row.id))) continue
      evidenceIds.add(String(row.id))
      contents.push(String(row.content))
    }
  }
  return {
    contents,
    evidenceIds: [...evidenceIds],
    phrase: needle,
    terms: ranked.terms,
  }
}

// After deletion: what still mentions the subject? Probes surviving rows
// with the request phrase (exact), the request's ranked terms, and terms
// taken from the deleted text itself — the last is what catches a
// paraphrase that shares any word with what was deleted. Every entry is a
// canonical row reference the caller can read in full.
export function residualMentions(db, scope, {
  deletedContents = [],
  limit = FORGET_RESIDUAL_LIMIT,
  phrase,
  visibleStatementsSql,
}) {
  const needle = normalizedPhrase(phrase)
  const found = new Map()

  const admit = (row, matchedVia, needles) => {
    const id = String(row.id)
    if (found.has(id)) return
    found.set(id, {
      ...(row.author_id === undefined || row.author_id === null
        ? {}
        : { authorId: String(row.author_id) }),
      evidenceId: id,
      matchedVia,
      observedAt: String(row.event_at),
      snippet: snippetAround(String(row.content), needles),
      speaker: speakerOf(row.source_kind),
    })
  }

  const exact = db.prepare(`
    WITH visible AS (${visibleStatementsSql})
    SELECT *
    FROM visible
    WHERE instr(lower(content), lower(?)) > 0
    ORDER BY event_at ASC, dialogue_order ASC
    LIMIT ?
  `).all(scope.palariId, scope.userId, needle, limit)
  for (const row of exact) admit(row, 'exact', [needle])

  const requestTerms = rankedDialogueQueryTerms(needle)
  if (requestTerms.length) {
    const ranked = searchDialogueEvidenceRanked(db, {
      limit,
      phrase: needle,
      scope,
      visibleStatementsSql,
    })
    for (const row of ranked.rows) admit(row, 'request_terms', requestTerms)
  }

  // Vocabulary of the deleted rows, minus the request's own terms — those
  // probes already ran. Any surviving row sharing one of these words was
  // in conversation with what was deleted.
  const requestTermSet = new Set(requestTerms)
  const deletedTerms = extractMemoryQueryKeywords(
    deletedContents.join(' '),
    { limit: DELETED_CONTENT_TERM_LIMIT },
  ).filter((term) => !requestTermSet.has(term))
  if (deletedTerms.length) {
    const ranked = searchDialogueEvidenceRanked(db, {
      limit,
      phrase: deletedTerms.join(' '),
      scope,
      visibleStatementsSql,
    })
    for (const row of ranked.rows) {
      admit(row, 'deleted_content_terms', deletedTerms)
    }
  }

  return [...found.values()]
    .sort((left, right) =>
      left.observedAt.localeCompare(right.observedAt) ||
      left.evidenceId.localeCompare(right.evidenceId))
    .slice(0, limit)
}

// Active-only canonical dialogue persistence.
//
// Complete visible user/Palari messages live here so an optional model writer
// cannot decide which evidence survives. New derived annotations also stay
// outside the extracted v0.5 memories/FTS tables.

import { createHash } from 'node:crypto'

import { createMemoryDigestStore } from './memory-digest-store.mjs'
import { createMemoryExplorer } from './memory-exploration.mjs'
import { statementQuoteOrigins } from './statement-extraction.mjs'

export const dialogueSourceKinds = Object.freeze([
  'user_message',
  'assistant_message',
])

function isWellFormedText(value) {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index)
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1)
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false
      index += 1
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return false
    }
  }
  return true
}

export function roundTrippableDialogueText(value, label = 'text') {
  const text = String(value ?? '')
  if (text.includes('\u0000') || !isWellFormedText(text)) {
    const error = new TypeError(
      `${label} must be well-formed Unicode without U+0000.`,
    )
    error.code = 'TEXT_NOT_ROUND_TRIPPABLE'
    throw error
  }
  return text
}

const canonicalEvidenceKind = 'canonical_message'
const legacyEvidenceKind = 'legacy_selected_quote'
const migrationId = 'CDX-M3-CANONICAL-DIALOGUE'

function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex')
}

function sha256Fields(values) {
  return sha256(JSON.stringify(values.map((value) => String(value))))
}

function isoNow(clock) {
  const value = clock()
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new TypeError('clock must return a valid timestamp.')
  }
  return date.toISOString()
}

function normalizedScope({ palariId, userId } = {}) {
  const scope = {
    palariId: roundTrippableDialogueText(palariId, 'palariId').trim(),
    userId: roundTrippableDialogueText(userId, 'userId').trim(),
  }
  if (!scope.palariId) throw new TypeError('palariId is required.')
  if (!scope.userId) throw new TypeError('userId is required.')
  return scope
}

function normalizedEventAt(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new TypeError('eventAt must be a valid timestamp.')
  }
  return date.toISOString()
}

function roleSourceMessageId(base, sourceKind) {
  const suffix = sourceKind === 'assistant_message' ? 'assistant' : 'user'
  return `${base}:${suffix}`
}

function turnId({ palariId, sourceMessageId, userId }) {
  return `turn_${sha256Fields([
    palariId,
    userId,
    sourceMessageId,
  ])}`
}

function evidenceId({
  palariId,
  sourceKind,
  sourceMessageId,
  userId,
}) {
  return `dialogue_${sha256Fields([
    palariId,
    userId,
    sourceMessageId,
    sourceKind,
  ])}`
}

function annotationId(evidenceIdValue, quote) {
  return `annotation_${sha256Fields([
    evidenceIdValue,
    quote,
  ])}`
}

function legacyEvidenceId(memoryId) {
  return `legacy_quote_${sha256(memoryId)}`
}

function tombstoneId({
  palariId,
  sourceKind,
  sourceMessageId,
  userId,
}) {
  return `dialogue_forgotten_${sha256Fields([
    palariId,
    userId,
    sourceMessageId,
    sourceKind,
  ])}`
}

function quoteOffset(message, quote) {
  const offset = String(message ?? '').indexOf(String(quote ?? ''))
  return offset < 0 ? Number.MAX_SAFE_INTEGER : offset
}

function evidenceRow(row) {
  return {
    ...row,
    extractor: row.evidence_kind === legacyEvidenceKind
      ? String(row.legacy_extractor ?? '')
      : '',
    fictional: row.evidence_kind === legacyEvidenceKind
      ? Number(row.legacy_fictional ?? 0)
      : 0,
    record_kind: row.evidence_kind,
    type: row.evidence_kind === legacyEvidenceKind
      ? String(row.legacy_type ?? '')
      : '',
    valid_from: row.event_at,
  }
}

function annotationRow(row) {
  return {
    ...row,
    content: row.quote,
    dialogue_order: row.evidence_dialogue_order,
    palari_id: row.evidence_palari_id,
    source_kind: row.evidence_source_kind,
    source_message_id: row.evidence_source_message_id,
    user_id: row.evidence_user_id,
    valid_from: row.evidence_event_at,
  }
}

function selectEvidenceById(db, id) {
  return db.prepare(`
    SELECT
      e.*,
      (
        SELECT m.extractor
        FROM memories m
        WHERE m.evidence_id = e.id
        ORDER BY m.rowid ASC
        LIMIT 1
      ) AS legacy_extractor,
      (
        SELECT m.fictional
        FROM memories m
        WHERE m.evidence_id = e.id
        ORDER BY m.rowid ASC
        LIMIT 1
      ) AS legacy_fictional,
      (
        SELECT m.type
        FROM memories m
        WHERE m.evidence_id = e.id
        ORDER BY m.rowid ASC
        LIMIT 1
      ) AS legacy_type
    FROM dialogue_evidence e
    WHERE e.id = ?
  `).get(id)
}

function selectAnnotationById(db, id) {
  return db.prepare(`
    SELECT
      a.*,
      e.palari_id AS evidence_palari_id,
      e.user_id AS evidence_user_id,
      e.source_message_id AS evidence_source_message_id,
      e.source_kind AS evidence_source_kind,
      e.event_at AS evidence_event_at,
      e.dialogue_order AS evidence_dialogue_order
    FROM dialogue_annotations a
    JOIN dialogue_evidence e ON e.id = a.evidence_id
    WHERE a.id = ?
  `).get(id)
}

function ensureActiveSchema(store, clock) {
  if (!store?.enabled) return
  store.db.exec('BEGIN IMMEDIATE')
  try {
    const memoryColumns = new Set(
      store.db.prepare('PRAGMA table_info(memories)').all()
        .map((column) => String(column.name)),
    )
    if (!memoryColumns.has('source_kind')) {
      store.db.exec('ALTER TABLE memories ADD COLUMN source_kind TEXT')
    }
    if (!memoryColumns.has('extractor')) {
      store.db.exec('ALTER TABLE memories ADD COLUMN extractor TEXT')
    }
    if (!memoryColumns.has('dialogue_order')) {
      store.db.exec('ALTER TABLE memories ADD COLUMN dialogue_order INTEGER')
    }
    if (!memoryColumns.has('evidence_id')) {
      store.db.exec('ALTER TABLE memories ADD COLUMN evidence_id TEXT')
    }

    store.db.exec(`
      CREATE TABLE IF NOT EXISTS dialogue_turns (
        id TEXT PRIMARY KEY,
        palari_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        source_message_id TEXT NOT NULL,
        event_at TEXT NOT NULL,
        user_present INTEGER NOT NULL CHECK (user_present IN (0, 1)),
        assistant_present INTEGER NOT NULL CHECK (
          assistant_present IN (0, 1)
        ),
        user_sha256 TEXT,
        assistant_sha256 TEXT,
        created_at TEXT NOT NULL,
        UNIQUE (palari_id, user_id, source_message_id)
      );

      CREATE TABLE IF NOT EXISTS dialogue_evidence (
        id TEXT PRIMARY KEY,
        turn_id TEXT,
        palari_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        source_message_id TEXT NOT NULL,
        source_kind TEXT NOT NULL CHECK (
          source_kind IN ('user_message', 'assistant_message')
        ),
        content TEXT NOT NULL,
        content_sha256 TEXT NOT NULL,
        event_at TEXT NOT NULL,
        dialogue_order INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        evidence_kind TEXT NOT NULL CHECK (
          evidence_kind IN ('canonical_message', 'legacy_selected_quote')
        ),
        FOREIGN KEY (turn_id) REFERENCES dialogue_turns(id)
      );

      CREATE UNIQUE INDEX IF NOT EXISTS dialogue_evidence_canonical_identity
        ON dialogue_evidence (
          palari_id,
          user_id,
          source_message_id,
          source_kind
        )
        WHERE evidence_kind = 'canonical_message';

      CREATE INDEX IF NOT EXISTS dialogue_evidence_scope_order
        ON dialogue_evidence (
          palari_id,
          user_id,
          event_at,
          dialogue_order
        );

      CREATE INDEX IF NOT EXISTS dialogue_evidence_scope_dialogue_order
        ON dialogue_evidence (
          palari_id,
          user_id,
          dialogue_order
        );

      CREATE INDEX IF NOT EXISTS dialogue_evidence_source_identity
        ON dialogue_evidence (
          palari_id,
          user_id,
          source_message_id,
          source_kind,
          evidence_kind
        );

      CREATE TABLE IF NOT EXISTS dialogue_evidence_tombstones (
        id TEXT PRIMARY KEY,
        palari_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        source_message_id TEXT NOT NULL,
        source_kind TEXT NOT NULL CHECK (
          source_kind IN ('user_message', 'assistant_message')
        ),
        forgotten_at TEXT NOT NULL,
        UNIQUE (
          palari_id,
          user_id,
          source_message_id,
          source_kind
        )
      );

      CREATE TABLE IF NOT EXISTS dialogue_annotations (
        id TEXT PRIMARY KEY,
        evidence_id TEXT NOT NULL,
        quote TEXT NOT NULL,
        type TEXT NOT NULL,
        importance REAL NOT NULL,
        confidence REAL NOT NULL,
        fictional INTEGER NOT NULL CHECK (fictional IN (0, 1)),
        extractor TEXT NOT NULL,
        quote_order INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (evidence_id, quote),
        FOREIGN KEY (evidence_id) REFERENCES dialogue_evidence(id)
          ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS dialogue_annotations_evidence_idx
        ON dialogue_annotations (evidence_id, quote_order);

      CREATE INDEX IF NOT EXISTS memories_evidence_id_idx
        ON memories (evidence_id);

      -- Chronology ordinals are allocated from a per-scope high-water mark,
      -- never from MAX(dialogue_order). Deleting the newest message must not
      -- free its ordinal for reuse: a reused ordinal would let a later
      -- message tie an earlier one under the (event_at, dialogue_order)
      -- comparator that supersession and digest lineage depend on.
      CREATE TABLE IF NOT EXISTS dialogue_scope_counters (
        palari_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        next_dialogue_order INTEGER NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (palari_id, user_id)
      );
    `)

    // Existing databases seed their watermark once, from the highest ordinal
    // ever observed in live evidence.
    store.db.exec(`
      INSERT OR IGNORE INTO dialogue_scope_counters (
        palari_id,
        user_id,
        next_dialogue_order,
        updated_at
      )
      SELECT
        palari_id,
        user_id,
        MAX(dialogue_order) + 1,
        MIN(created_at)
      FROM dialogue_evidence
      GROUP BY palari_id, user_id
    `)

    const migration = store.db.prepare(
      'SELECT id FROM memory_migrations WHERE id = ?',
    ).get(migrationId)
    if (!migration) {
      const unsupportedLegacy = store.db.prepare(`
        SELECT id
        FROM memories
        WHERE source_kind IN ('user_message', 'assistant_message')
          AND user_id IS NOT NULL
          AND valid_until IS NULL
          AND evidence_id IS NULL
          AND (
            instr(CAST(id AS BLOB), X'00') > 0
            OR instr(CAST(content AS BLOB), X'00') > 0
            OR instr(CAST(palari_id AS BLOB), X'00') > 0
            OR instr(CAST(user_id AS BLOB), X'00') > 0
            OR instr(CAST(COALESCE(source_message_id, '') AS BLOB), X'00') > 0
            OR instr(CAST(COALESCE(extractor, '') AS BLOB), X'00') > 0
            OR instr(CAST(COALESCE(valid_from, '') AS BLOB), X'00') > 0
            OR instr(CAST(COALESCE(created_at, '') AS BLOB), X'00') > 0
          )
        LIMIT 1
      `).get()
      if (unsupportedLegacy) {
        const error = new Error(
          'Legacy dialogue text contains unsupported U+0000 bytes.',
        )
        error.code = 'LEGACY_TEXT_NOT_ROUND_TRIPPABLE'
        throw error
      }
      const legacyRows = store.db.prepare(`
        SELECT rowid AS legacy_rowid, *
        FROM memories
        WHERE source_kind IN ('user_message', 'assistant_message')
          AND user_id IS NOT NULL
          AND valid_until IS NULL
          AND evidence_id IS NULL
        ORDER BY rowid ASC
      `).all()
      const insertLegacy = store.db.prepare(`
        INSERT OR IGNORE INTO dialogue_evidence (
          id,
          turn_id,
          palari_id,
          user_id,
          source_message_id,
          source_kind,
          content,
          content_sha256,
          event_at,
          dialogue_order,
          created_at,
          evidence_kind
        ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      const linkLegacy = store.db.prepare(
        'UPDATE memories SET evidence_id = ? WHERE id = ?',
      )
      for (const row of legacyRows) {
        const id = legacyEvidenceId(row.id)
        insertLegacy.run(
          id,
          row.palari_id,
          row.user_id,
          row.source_message_id || `legacy:${row.id}`,
          row.source_kind,
          row.content,
          sha256(row.content),
          row.valid_from || row.created_at,
          Number.isSafeInteger(row.dialogue_order)
            ? row.dialogue_order
            : Number(row.legacy_rowid),
          row.created_at,
          legacyEvidenceKind,
        )
        linkLegacy.run(id, row.id)
      }
      store.db.prepare(
        'INSERT INTO memory_migrations(id, applied_at) VALUES (?, ?)',
      ).run(migrationId, isoNow(clock))
    }
    store.db.prepare(
      'INSERT OR IGNORE INTO memory_migrations(id, applied_at) VALUES (?, ?)',
    ).run('CDX-M2-ROLE-QUOTES', isoNow(clock))
    store.db.exec('COMMIT')
  } catch (error) {
    store.db.exec('ROLLBACK')
    throw error
  }
}

export function createDialogueGate(store, {
  auditLog,
  clock = () => new Date(),
} = {}) {
  ensureActiveSchema(store, clock)
  const digest = createMemoryDigestStore(store, { clock })

  // Monotonic per-scope chronology ordinal. The watermark only ever moves
  // forward, so an ordinal freed by deletion is never handed out again and
  // two live rows can never tie on (event_at, dialogue_order).
  function allocateDialogueOrder(scope) {
    const now = isoNow(clock)
    store.db.prepare(`
      INSERT INTO dialogue_scope_counters (
        palari_id,
        user_id,
        next_dialogue_order,
        updated_at
      ) VALUES (?, ?, 0, ?)
      ON CONFLICT (palari_id, user_id) DO NOTHING
    `).run(scope.palariId, scope.userId, now)
    const allocated = store.db.prepare(`
      UPDATE dialogue_scope_counters
      SET
        next_dialogue_order = next_dialogue_order + 1,
        updated_at = ?
      WHERE palari_id = ? AND user_id = ?
      RETURNING next_dialogue_order - 1 AS value
    `).get(now, scope.palariId, scope.userId)
    const value = Number(allocated?.value)
    if (!Number.isSafeInteger(value) || value < 0) {
      const error = new Error('Dialogue chronology counter is unusable.')
      error.code = 'DIALOGUE_ORDER_UNAVAILABLE'
      throw error
    }
    return value
  }

  const visibleStatementsSql = `
    SELECT
      e.*,
      (
        SELECT m.extractor
        FROM memories m
        WHERE m.evidence_id = e.id
        ORDER BY m.rowid ASC
        LIMIT 1
      ) AS legacy_extractor,
      (
        SELECT m.fictional
        FROM memories m
        WHERE m.evidence_id = e.id
        ORDER BY m.rowid ASC
        LIMIT 1
      ) AS legacy_fictional,
      (
        SELECT m.type
        FROM memories m
        WHERE m.evidence_id = e.id
        ORDER BY m.rowid ASC
        LIMIT 1
      ) AS legacy_type
    FROM dialogue_evidence e
    WHERE e.palari_id = ?
      AND e.user_id = ?
      AND (
        e.evidence_kind = 'canonical_message'
        OR NOT EXISTS (
          SELECT 1
          FROM dialogue_evidence canonical
          WHERE canonical.palari_id = e.palari_id
            AND canonical.user_id = e.user_id
            AND canonical.source_message_id = e.source_message_id
            AND canonical.source_kind = e.source_kind
            AND canonical.evidence_kind = 'canonical_message'
        )
      )
  `
  const explorer = createMemoryExplorer(store, {
    auditLog,
    visibleStatementsSql,
  })

  const visibleStatementsOrderSql = `
    ORDER BY event_at ASC, dialogue_order ASC, created_at ASC, id ASC
  `

  function listStatements(scopeInput) {
    if (!store?.enabled) return []
    const scope = normalizedScope(scopeInput)
    return store.db.prepare(
      `${visibleStatementsSql} ${visibleStatementsOrderSql}`,
    ).all(scope.palariId, scope.userId).map(evidenceRow)
  }

  function listStatementsForBriefing(scopeInput, {
    maxChars,
  } = {}) {
    if (!store?.enabled) {
      return {
        lowerBoundChars: 0,
        statements: [],
        totalCandidates: 0,
      }
    }
    const scope = normalizedScope(scopeInput)
    const limit = Number(maxChars)
    if (!Number.isFinite(limit) || limit < 1) {
      throw new TypeError('maxChars must be a positive number.')
    }
    store.db.exec('BEGIN')
    try {
      const measurement = store.db.prepare(`
        WITH visible AS (${visibleStatementsSql})
        SELECT
          COUNT(*) AS total_candidates,
          COALESCE(SUM(
            -- Every rendered JSONL row has at least 160 fixed ASCII
            -- characters; 128 remains a strict conservative lower bound.
            128
            + MAX(
              length(COALESCE(id, '')),
              (length(CAST(COALESCE(id, '') AS BLOB)) + 3) / 4
            )
            + MAX(
              length(COALESCE(content, '')),
              (length(CAST(COALESCE(content, '') AS BLOB)) + 3) / 4
            )
            + MAX(
              length(COALESCE(event_at, '')),
              (length(CAST(COALESCE(event_at, '') AS BLOB)) + 3) / 4
            )
            + MAX(
              length(COALESCE(evidence_kind, '')),
              (length(CAST(COALESCE(evidence_kind, '') AS BLOB)) + 3) / 4
            )
            + MAX(
              length(COALESCE(legacy_extractor, '')),
              (length(CAST(COALESCE(legacy_extractor, '') AS BLOB)) + 3) / 4
            )
            + MAX(
              length(COALESCE(legacy_type, '')),
              (length(CAST(COALESCE(legacy_type, '') AS BLOB)) + 3) / 4
            )
            + MAX(
              length(COALESCE(source_kind, '')),
              (length(CAST(COALESCE(source_kind, '') AS BLOB)) + 3) / 4
            )
            + MAX(
              length(COALESCE(source_message_id, '')),
              (
                length(CAST(COALESCE(source_message_id, '') AS BLOB)) + 3
              ) / 4
            )
          ), 0) AS lower_bound_chars
        FROM visible
      `).get(scope.palariId, scope.userId)
      const lowerBoundChars = Number(measurement?.lower_bound_chars ?? 0)
      const totalCandidates = Number(measurement?.total_candidates ?? 0)
      const statements = lowerBoundChars > limit
        ? null
        : store.db.prepare(
          `${visibleStatementsSql} ${visibleStatementsOrderSql}`,
        ).all(scope.palariId, scope.userId).map(evidenceRow)
      store.db.exec('COMMIT')
      return {
        lowerBoundChars,
        statements,
        totalCandidates,
      }
    } catch (error) {
      store.db.exec('ROLLBACK')
      throw error
    }
  }

  function listIndexEntries(scopeInput) {
    if (!store?.enabled) return []
    const scope = normalizedScope(scopeInput)
    return store.db.prepare(`
      SELECT
        a.*,
        e.palari_id AS evidence_palari_id,
        e.user_id AS evidence_user_id,
        e.source_message_id AS evidence_source_message_id,
        e.source_kind AS evidence_source_kind,
        e.event_at AS evidence_event_at,
        e.dialogue_order AS evidence_dialogue_order
      FROM dialogue_annotations a
      JOIN dialogue_evidence e ON e.id = a.evidence_id
      WHERE e.palari_id = ? AND e.user_id = ?
      ORDER BY
        e.event_at ASC,
        e.dialogue_order ASC,
        a.quote_order ASC,
        a.created_at ASC,
        a.id ASC
    `).all(scope.palariId, scope.userId).map(annotationRow)
  }

  function promoteLegacyEvidence(canonical, fullContent) {
    const legacy = store.db.prepare(`
      SELECT id
      FROM dialogue_evidence
      WHERE palari_id = ?
        AND user_id = ?
        AND source_message_id = ?
        AND source_kind = ?
        AND evidence_kind = 'legacy_selected_quote'
    `).all(
      canonical.palari_id,
      canonical.user_id,
      canonical.source_message_id,
      canonical.source_kind,
    )
    for (const legacyRow of legacy) {
      const memories = store.db.prepare(`
        SELECT *
        FROM memories
        WHERE evidence_id = ? AND valid_until IS NULL
        ORDER BY rowid ASC
      `).all(legacyRow.id)
      for (const memory of memories) {
        if (!String(fullContent).includes(String(memory.content))) {
          const error = new Error(
            `Legacy quote conflicts with ${canonical.source_message_id}.`,
          )
          error.code = 'LEGACY_SOURCE_CONFLICT'
          throw error
        }
        const id = annotationId(canonical.id, memory.content)
        store.db.prepare(`
          INSERT OR IGNORE INTO dialogue_annotations (
            id,
            evidence_id,
            quote,
            type,
            importance,
            confidence,
            fictional,
            extractor,
            quote_order,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          canonical.id,
          memory.content,
          memory.type,
          memory.importance,
          memory.confidence,
          memory.fictional,
          memory.extractor || 'legacy-unidentified',
          Number(memory.dialogue_order ?? canonical.dialogue_order),
          memory.created_at,
        )
      }
      store.db.prepare('DELETE FROM memories WHERE evidence_id = ?')
        .run(legacyRow.id)
      store.db.prepare('DELETE FROM dialogue_evidence WHERE id = ?')
        .run(legacyRow.id)
    }
  }

  function appendEvidence(turn) {
    const scope = normalizedScope(turn)
    const eventAt = normalizedEventAt(turn.eventAt)
    const sourceMessageId = roundTrippableDialogueText(
      turn.sourceMessageId,
      'sourceMessageId',
    ).trim()
    if (!sourceMessageId) throw new TypeError('sourceMessageId is required.')
    const roles = [
      {
        content: roundTrippableDialogueText(
          turn.userMessage,
          'userMessage',
        ),
        sourceKind: 'user_message',
      },
      {
        content: roundTrippableDialogueText(
          turn.assistantMessage,
          'assistantMessage',
        ),
        sourceKind: 'assistant_message',
      },
    ].map((role) => ({
      ...role,
      present: Boolean(role.content.trim()),
      sha256: role.content.trim() ? sha256(role.content) : null,
    }))
    const user = roles[0]
    const assistant = roles[1]
    const identity = turnId({
      ...scope,
      sourceMessageId,
    })

    const written = []
    const existing = []
    const outcomes = []
    store.db.exec('BEGIN IMMEDIATE')
    try {
      const manifest = store.db.prepare(`
        SELECT *
        FROM dialogue_turns
        WHERE palari_id = ? AND user_id = ? AND source_message_id = ?
      `).get(scope.palariId, scope.userId, sourceMessageId)
      if (manifest) {
        if (
          manifest.id !== identity ||
          manifest.event_at !== eventAt ||
          Boolean(manifest.user_present) !== user.present ||
          Boolean(manifest.assistant_present) !== assistant.present ||
          (manifest.user_sha256 ?? null) !== user.sha256 ||
          (manifest.assistant_sha256 ?? null) !== assistant.sha256
        ) {
          const error = new Error(
            `Canonical dialogue identity conflict at ${sourceMessageId}.`,
          )
          error.code = 'SOURCE_MESSAGE_CONFLICT'
          throw error
        }
      } else {
        store.db.prepare(`
          INSERT INTO dialogue_turns (
            id,
            palari_id,
            user_id,
            source_message_id,
            event_at,
            user_present,
            assistant_present,
            user_sha256,
            assistant_sha256,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          identity,
          scope.palariId,
          scope.userId,
          sourceMessageId,
          eventAt,
          user.present ? 1 : 0,
          assistant.present ? 1 : 0,
          user.sha256,
          assistant.sha256,
          isoNow(clock),
        )
      }

      for (const role of roles.filter((entry) => entry.present)) {
        const roleMessageId = roleSourceMessageId(
          sourceMessageId,
          role.sourceKind,
        )
        const id = evidenceId({
          palariId: scope.palariId,
          sourceKind: role.sourceKind,
          sourceMessageId: roleMessageId,
          userId: scope.userId,
        })
        const forgotten = store.db.prepare(`
          SELECT id
          FROM dialogue_evidence_tombstones
          WHERE palari_id = ?
            AND user_id = ?
            AND source_message_id = ?
            AND source_kind = ?
        `).get(
          scope.palariId,
          scope.userId,
          roleMessageId,
          role.sourceKind,
        )
        if (forgotten) {
          outcomes.push(`forgotten_${role.sourceKind}`)
          continue
        }
        const present = store.db.prepare(`
          SELECT *
          FROM dialogue_evidence
          WHERE palari_id = ?
            AND user_id = ?
            AND source_message_id = ?
            AND source_kind = ?
            AND evidence_kind = 'canonical_message'
          LIMIT 1
        `).get(
          scope.palariId,
          scope.userId,
          roleMessageId,
          role.sourceKind,
        )
        if (present) {
          if (
            present.id !== id ||
            present.turn_id !== identity ||
            present.content !== role.content ||
            present.content_sha256 !== role.sha256 ||
            present.event_at !== eventAt
          ) {
            const error = new Error(
              `Canonical dialogue identity conflict at ${roleMessageId}.`,
            )
            error.code = 'SOURCE_MESSAGE_CONFLICT'
            throw error
          }
          promoteLegacyEvidence(present, role.content)
          existing.push(evidenceRow(present))
          outcomes.push(`already_present_${role.sourceKind}`)
          continue
        }
        if (manifest) {
          outcomes.push(`forgotten_${role.sourceKind}`)
          continue
        }
        store.db.prepare(`
          INSERT INTO dialogue_evidence (
            id,
            turn_id,
            palari_id,
            user_id,
            source_message_id,
            source_kind,
            content,
            content_sha256,
            event_at,
            dialogue_order,
            created_at,
            evidence_kind
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          identity,
          scope.palariId,
          scope.userId,
          roleMessageId,
          role.sourceKind,
          role.content,
          role.sha256,
          eventAt,
          allocateDialogueOrder(scope),
          isoNow(clock),
          canonicalEvidenceKind,
        )
        const inserted = selectEvidenceById(store.db, id)
        promoteLegacyEvidence(inserted, role.content)
        written.push(evidenceRow(inserted))
        outcomes.push(`inserted_${role.sourceKind}`)
      }
      digest.queueTurn(scope, identity)
      store.db.exec('COMMIT')
    } catch (error) {
      store.db.exec('ROLLBACK')
      throw error
    }
    return { existing, outcomes, written }
  }

  function appendCandidates(candidates, turn, {
    extractorId,
  }) {
    const scope = normalizedScope(turn)
    const sourceMessageId = roundTrippableDialogueText(
      turn.sourceMessageId,
      'sourceMessageId',
    ).trim()
    if (!sourceMessageId) throw new TypeError('sourceMessageId is required.')
    const evidenceByKind = new Map()
    for (const sourceKind of dialogueSourceKinds) {
      const row = store.db.prepare(`
        SELECT *
        FROM dialogue_evidence
        WHERE palari_id = ?
          AND user_id = ?
          AND source_message_id = ?
          AND source_kind = ?
          AND evidence_kind = 'canonical_message'
        LIMIT 1
      `).get(
        scope.palariId,
        scope.userId,
        roleSourceMessageId(sourceMessageId, sourceKind),
        sourceKind,
      )
      if (row) evidenceByKind.set(sourceKind, row)
    }

    const writes = []
    let candidateOrder = 0
    const outcomes = []
    for (const candidate of candidates) {
      const origins = statementQuoteOrigins(candidate, turn)
      if (!origins.length) {
        outcomes.push('dropped_quote_not_in_dialogue')
        continue
      }
      for (const sourceKind of origins) {
        const evidence = evidenceByKind.get(sourceKind)
        if (!evidence) {
          outcomes.push('dropped_origin_not_retained')
          continue
        }
        writes.push({
          candidate,
          candidateOrder,
          evidence,
          quoteOffset: quoteOffset(
            sourceKind === 'assistant_message'
              ? turn.assistantMessage
              : turn.userMessage,
            candidate.quote,
          ),
          sourceKind,
        })
      }
      candidateOrder += 1
    }
    writes.sort((left, right) => {
      const roleDelta =
        dialogueSourceKinds.indexOf(left.sourceKind) -
        dialogueSourceKinds.indexOf(right.sourceKind)
      if (roleDelta) return roleDelta
      const offsetDelta = left.quoteOffset - right.quoteOffset
      if (offsetDelta) return offsetDelta
      return left.candidateOrder - right.candidateOrder
    })

    const written = []
    const existing = []
    store.db.exec('BEGIN IMMEDIATE')
    try {
      for (let index = 0; index < writes.length; index += 1) {
        const write = writes[index]
        const id = annotationId(write.evidence.id, write.candidate.quote)
        const present = selectAnnotationById(store.db, id)
        if (present) {
          existing.push(annotationRow(present))
          outcomes.push(`already_indexed_${write.sourceKind}`)
          continue
        }
        store.db.prepare(`
          INSERT INTO dialogue_annotations (
            id,
            evidence_id,
            quote,
            type,
            importance,
            confidence,
            fictional,
            extractor,
            quote_order,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          write.evidence.id,
          write.candidate.quote,
          write.candidate.type,
          write.candidate.importance,
          write.candidate.confidence,
          write.candidate.fictional ? 1 : 0,
          extractorId,
          index,
          isoNow(clock),
        )
        written.push(annotationRow(selectAnnotationById(store.db, id)))
        outcomes.push(`indexed_${write.sourceKind}`)
      }
      store.db.exec('COMMIT')
    } catch (error) {
      store.db.exec('ROLLBACK')
      throw error
    }
    return { existing, outcomes, written }
  }

  function forgetById(ids, scopeInput) {
    const requested = [...new Set(
      (Array.isArray(ids) ? ids : [ids])
        .map((id) =>
          roundTrippableDialogueText(id, 'evidence ID').trim())
        .filter(Boolean),
    )]
    if (!store?.enabled) {
      return {
        deleted: [],
        deletedCount: 0,
        deletedIndexIds: [],
        skippedCount: requested.length,
      }
    }
    const scope = normalizedScope(scopeInput)
    const evidenceIds = new Set()
    const acceptedSelectors = new Set()
    const deletedIndexIds = []
    store.db.exec('BEGIN IMMEDIATE')
    try {
      for (const id of requested) {
        const evidence = store.db.prepare(`
          SELECT id
          FROM dialogue_evidence
          WHERE id = ? AND palari_id = ? AND user_id = ?
        `).get(id, scope.palariId, scope.userId)
        if (evidence) {
          evidenceIds.add(evidence.id)
          acceptedSelectors.add(id)
          continue
        }
        const annotation = store.db.prepare(`
          SELECT a.evidence_id
          FROM dialogue_annotations a
          JOIN dialogue_evidence e ON e.id = a.evidence_id
          WHERE a.id = ? AND e.palari_id = ? AND e.user_id = ?
        `).get(id, scope.palariId, scope.userId)
        if (annotation?.evidence_id) {
          evidenceIds.add(annotation.evidence_id)
          acceptedSelectors.add(id)
          continue
        }
        const legacyIndex = store.db.prepare(`
          SELECT m.evidence_id
          FROM memories m
          JOIN dialogue_evidence e ON e.id = m.evidence_id
          WHERE m.id = ? AND e.palari_id = ? AND e.user_id = ?
        `).get(id, scope.palariId, scope.userId)
        if (legacyIndex?.evidence_id) {
          evidenceIds.add(legacyIndex.evidence_id)
          acceptedSelectors.add(id)
        }
      }

      const identities = new Map()
      for (const id of evidenceIds) {
        const evidence = store.db.prepare(`
          SELECT source_kind, source_message_id
          FROM dialogue_evidence
          WHERE id = ? AND palari_id = ? AND user_id = ?
        `).get(id, scope.palariId, scope.userId)
        if (!evidence) continue
        identities.set(
          JSON.stringify([
            evidence.source_kind,
            evidence.source_message_id,
          ]),
          evidence,
        )
      }

      const deleted = []
      for (const evidence of identities.values()) {
        store.db.prepare(`
          INSERT OR IGNORE INTO dialogue_evidence_tombstones (
            id,
            palari_id,
            user_id,
            source_message_id,
            source_kind,
            forgotten_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          tombstoneId({
            palariId: scope.palariId,
            sourceKind: evidence.source_kind,
            sourceMessageId: evidence.source_message_id,
            userId: scope.userId,
          }),
          scope.palariId,
          scope.userId,
          evidence.source_message_id,
          evidence.source_kind,
          isoNow(clock),
        )
        const siblings = store.db.prepare(`
          SELECT id
          FROM dialogue_evidence
          WHERE palari_id = ?
            AND user_id = ?
            AND source_message_id = ?
            AND source_kind = ?
        `).all(
          scope.palariId,
          scope.userId,
          evidence.source_message_id,
          evidence.source_kind,
        )
        for (const sibling of siblings) {
          const annotationRows = store.db.prepare(
            'SELECT id FROM dialogue_annotations WHERE evidence_id = ?',
          ).all(sibling.id)
          const legacyRows = store.db.prepare(
            'SELECT id FROM memories WHERE evidence_id = ?',
          ).all(sibling.id)
          deletedIndexIds.push(
            ...annotationRows.map((row) => row.id),
            ...legacyRows.map((row) => row.id),
          )
          store.db.prepare(
            'DELETE FROM memories WHERE evidence_id = ?',
          ).run(sibling.id)
          const result = store.db.prepare(`
            DELETE FROM dialogue_evidence
            WHERE id = ? AND palari_id = ? AND user_id = ?
          `).run(sibling.id, scope.palariId, scope.userId)
          if (result.changes > 0) deleted.push(sibling.id)
        }
      }
      const digestInvalidation = deleted.length
        ? digest.invalidateAfterDeletion(scope)
        : {
            invalidatedItems: 0,
            pending: digest.status(scope).pending,
            sourceRevision: digest.status(scope).sourceRevision,
          }
      store.db.exec('COMMIT')
      return {
        deleted,
        deletedCount: deleted.length,
        digestInvalidatedItems: digestInvalidation.invalidatedItems,
        reductionPending: digestInvalidation.pending,
        deletedIndexIds,
        skippedCount: requested.length - acceptedSelectors.size,
      }
    } catch (error) {
      store.db.exec('ROLLBACK')
      throw error
    }
  }

  return Object.freeze({
    appendCandidates,
    appendEvidence,
    applyReduction: digest.applyReduction,
    digestFreshness: digest.freshness,
    digestStatus: digest.status,
    forgetById,
    listActiveMemories: digest.listMemories,
    listIndexEntries,
    exploreFind: (scope, options) =>
      explorer.find(normalizedScope(scope), options),
    exploreRead: (scope, options) =>
      explorer.read(normalizedScope(scope), options),
    exploreTimeline: (scope, options) =>
      explorer.timeline(normalizedScope(scope), options),
    listBlockedReductions: digest.listBlocked,
    listPendingReductions: digest.listPending,
    readReadyDigest: digest.readReadyDigest,
    listStatements,
    listStatementsForBriefing,
    markReductionFailure: digest.markFailure,
    prepareOldestReduction: digest.prepareOldest,
    requeueBlockedReductions: digest.requeueBlocked,
  })
}

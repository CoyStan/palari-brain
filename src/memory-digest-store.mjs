// Ordered, bounded derived memory over the canonical dialogue journal.
//
// This module never decides what is durable and never mutates canonical
// evidence. The dialogue gate owns both entry points: it queues reduction
// work in the canonical write transaction, then applies a model proposal in
// a separate compare-and-swap transaction.

import { createHash } from 'node:crypto'

import {
  ACTIVE_MEMORY_MAX_BASIS,
  ACTIVE_MEMORY_MAX_DIGEST_CHARS,
  ACTIVE_MEMORY_MAX_ITEMS,
  ACTIVE_MEMORY_REDUCER_VERSION,
  renderActiveMemoryDigest,
} from './memory-reducer.mjs'

const migrationId = 'CDX-M4-INCREMENTAL-DIGEST'

function sha256Fields(values) {
  return createHash('sha256')
    .update(JSON.stringify(values.map((value) => String(value))))
    .digest('hex')
}

function isoNow(clock) {
  const value = clock()
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new TypeError('clock must return a valid timestamp.')
  }
  return date.toISOString()
}

function roundTrippableText(value, label) {
  const text = String(value ?? '')
  if (text.includes('\u0000') || !text.isWellFormed()) {
    const error = new TypeError(
      `${label} must be well-formed Unicode without U+0000.`,
    )
    error.code = 'TEXT_NOT_ROUND_TRIPPABLE'
    throw error
  }
  return text
}

function normalizedScope({ palariId, userId } = {}) {
  const scope = {
    palariId: roundTrippableText(palariId, 'palariId').trim(),
    userId: roundTrippableText(userId, 'userId').trim(),
  }
  if (!scope.palariId) throw new TypeError('palariId is required.')
  if (!scope.userId) throw new TypeError('userId is required.')
  return scope
}

function ensureState(db, scope, now) {
  db.prepare(`
    INSERT OR IGNORE INTO dialogue_digest_state (
      palari_id,
      user_id,
      source_revision,
      built_from_revision,
      digest_revision,
      reducer_id,
      contract_version,
      created_at,
      updated_at
    ) VALUES (?, ?, 0, 0, 0, NULL, NULL, ?, ?)
  `).run(scope.palariId, scope.userId, now, now)
  return db.prepare(`
    SELECT *
    FROM dialogue_digest_state
    WHERE palari_id = ? AND user_id = ?
  `).get(scope.palariId, scope.userId)
}

function unitHasEvidenceSql(alias = 'u') {
  return `
    (
      (
        ${alias}.turn_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM dialogue_evidence e
          WHERE e.turn_id = ${alias}.turn_id
            AND e.palari_id = ${alias}.palari_id
            AND e.user_id = ${alias}.user_id
            AND e.evidence_kind = 'canonical_message'
        )
      )
      OR
      (
        ${alias}.legacy_evidence_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM dialogue_evidence e
          WHERE e.id = ${alias}.legacy_evidence_id
            AND e.palari_id = ${alias}.palari_id
            AND e.user_id = ${alias}.user_id
        )
      )
    )
  `
}

function seedUnit(db, scope, {
  legacyEvidenceId = null,
  turnId = null,
}, now) {
  const present = turnId
    ? db.prepare(
      'SELECT unit_order FROM dialogue_reduction_units WHERE turn_id = ?',
    ).get(turnId)
    : db.prepare(`
      SELECT unit_order
      FROM dialogue_reduction_units
      WHERE legacy_evidence_id = ?
    `).get(legacyEvidenceId)
  if (present) return false
  const state = ensureState(db, scope, now)
  const sourceRevision = Number(state.source_revision) + 1
  db.prepare(`
    UPDATE dialogue_digest_state
    SET source_revision = ?, updated_at = ?
    WHERE palari_id = ? AND user_id = ?
  `).run(
    sourceRevision,
    now,
    scope.palariId,
    scope.userId,
  )
  db.prepare(`
    INSERT INTO dialogue_reduction_units (
      palari_id,
      user_id,
      turn_id,
      legacy_evidence_id,
      source_revision,
      status,
      attempts,
      last_error_category,
      applied_at,
      created_at
    ) VALUES (?, ?, ?, ?, ?, 'pending', 0, NULL, NULL, ?)
  `).run(
    scope.palariId,
    scope.userId,
    turnId,
    legacyEvidenceId,
    sourceRevision,
    now,
  )
  return true
}

function seedExistingEvidence(db, clock) {
  const existing = db.prepare(
    'SELECT id FROM memory_migrations WHERE id = ?',
  ).get(migrationId)
  if (existing) return
  const units = db.prepare(`
    SELECT
      e.palari_id,
      e.user_id,
      e.turn_id,
      NULL AS legacy_evidence_id,
      MIN(e.event_at) AS event_at,
      MIN(e.dialogue_order) AS dialogue_order,
      MIN(e.id) AS stable_id
    FROM dialogue_evidence e
    WHERE e.evidence_kind = 'canonical_message'
      AND e.turn_id IS NOT NULL
    GROUP BY e.palari_id, e.user_id, e.turn_id

    UNION ALL

    SELECT
      e.palari_id,
      e.user_id,
      NULL AS turn_id,
      e.id AS legacy_evidence_id,
      e.event_at,
      e.dialogue_order,
      e.id AS stable_id
    FROM dialogue_evidence e
    WHERE e.turn_id IS NULL

    ORDER BY
      palari_id ASC,
      user_id ASC,
      event_at ASC,
      dialogue_order ASC,
      stable_id ASC
  `).all()
  for (const unit of units) {
    seedUnit(
      db,
      {
        palariId: unit.palari_id,
        userId: unit.user_id,
      },
      {
        legacyEvidenceId: unit.legacy_evidence_id,
        turnId: unit.turn_id,
      },
      isoNow(clock),
    )
  }
  db.prepare(
    'INSERT INTO memory_migrations(id, applied_at) VALUES (?, ?)',
  ).run(migrationId, isoNow(clock))
}

export function ensureMemoryDigestSchema(store, {
  clock = () => new Date(),
} = {}) {
  if (!store?.enabled) return
  store.db.exec('BEGIN IMMEDIATE')
  try {
    store.db.exec(`
      CREATE TABLE IF NOT EXISTS dialogue_digest_state (
        palari_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        source_revision INTEGER NOT NULL DEFAULT 0,
        built_from_revision INTEGER NOT NULL DEFAULT 0,
        digest_revision INTEGER NOT NULL DEFAULT 0,
        reducer_id TEXT,
        contract_version TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (palari_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS dialogue_reduction_units (
        unit_order INTEGER PRIMARY KEY AUTOINCREMENT,
        palari_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        turn_id TEXT,
        legacy_evidence_id TEXT,
        source_revision INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending', 'applied')),
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error_category TEXT,
        applied_at TEXT,
        created_at TEXT NOT NULL,
        CHECK (
          (turn_id IS NOT NULL AND legacy_evidence_id IS NULL)
          OR
          (turn_id IS NULL AND legacy_evidence_id IS NOT NULL)
        )
      );

      CREATE UNIQUE INDEX IF NOT EXISTS dialogue_reduction_turn_identity
        ON dialogue_reduction_units (turn_id)
        WHERE turn_id IS NOT NULL;

      CREATE UNIQUE INDEX IF NOT EXISTS dialogue_reduction_legacy_identity
        ON dialogue_reduction_units (legacy_evidence_id)
        WHERE legacy_evidence_id IS NOT NULL;

      CREATE INDEX IF NOT EXISTS dialogue_reduction_scope_queue
        ON dialogue_reduction_units (
          palari_id,
          user_id,
          status,
          unit_order
        );

      CREATE TABLE IF NOT EXISTS dialogue_digest_items (
        id TEXT PRIMARY KEY,
        palari_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        topic TEXT NOT NULL,
        statement TEXT NOT NULL,
        speaker TEXT NOT NULL CHECK (speaker IN ('user', 'Palari')),
        epistemic TEXT NOT NULL CHECK (
          epistemic IN ('asserted', 'uncertain', 'unknown')
        ),
        observed_at TEXT NOT NULL,
        observed_order INTEGER NOT NULL,
        time_evidence_id TEXT,
        time_quote TEXT,
        anchor_at TEXT,
        reducer_id TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS dialogue_digest_items_scope
        ON dialogue_digest_items (palari_id, user_id, id);

      CREATE TABLE IF NOT EXISTS dialogue_digest_basis (
        item_id TEXT NOT NULL,
        evidence_id TEXT NOT NULL,
        quote TEXT NOT NULL,
        basis_order INTEGER NOT NULL,
        PRIMARY KEY (item_id, evidence_id, quote),
        FOREIGN KEY (item_id) REFERENCES dialogue_digest_items(id)
          ON DELETE CASCADE,
        FOREIGN KEY (evidence_id) REFERENCES dialogue_evidence(id)
          ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS dialogue_digest_basis_evidence
        ON dialogue_digest_basis (evidence_id, item_id);

    `)
    const stateColumns = new Set(
      store.db.prepare('PRAGMA table_info(dialogue_digest_state)').all()
        .map((column) => String(column.name)),
    )
    if (!stateColumns.has('contract_version')) {
      store.db.exec(
        'ALTER TABLE dialogue_digest_state ADD COLUMN contract_version TEXT',
      )
    }
    seedExistingEvidence(store.db, clock)
    store.db.exec('COMMIT')
  } catch (error) {
    store.db.exec('ROLLBACK')
    throw error
  }
}

function evidenceSpeaker(sourceKind) {
  if (sourceKind === 'user_message') return 'user'
  if (sourceKind === 'assistant_message') return 'Palari'
  throw new TypeError('Digest evidence has an invalid source kind.')
}

function selectEvidence(db, evidenceId, scope) {
  return db.prepare(`
    SELECT *
    FROM dialogue_evidence
    WHERE id = ? AND palari_id = ? AND user_id = ?
  `).get(evidenceId, scope.palariId, scope.userId)
}

function listItemBasis(db, itemId, scope) {
  return db.prepare(`
    SELECT
      b.evidence_id,
      b.quote,
      b.basis_order,
      e.source_kind,
      e.source_message_id,
      e.event_at,
      e.dialogue_order
    FROM dialogue_digest_basis b
    JOIN dialogue_evidence e ON e.id = b.evidence_id
    JOIN dialogue_digest_items i ON i.id = b.item_id
    WHERE b.item_id = ?
      AND i.palari_id = ?
      AND i.user_id = ?
    ORDER BY b.basis_order ASC, b.evidence_id ASC, b.quote ASC
  `).all(itemId, scope.palariId, scope.userId)
}

function itemRow(db, row, scope) {
  const supports = listItemBasis(db, row.id, scope).map((basis) => ({
    evidenceId: basis.evidence_id,
    observedAt: basis.event_at,
    quote: basis.quote,
    sourceMessageId: basis.source_message_id,
    speaker: evidenceSpeaker(basis.source_kind),
  }))
  return {
    anchorAt: row.anchor_at ?? null,
    createdAt: row.created_at,
    epistemic: row.epistemic,
    id: row.id,
    observedAt: row.observed_at,
    reducerId: row.reducer_id,
    speaker: row.speaker,
    statement: row.statement,
    supports,
    timeBasis: row.time_evidence_id
      ? {
          anchorAt: row.anchor_at,
          evidenceId: row.time_evidence_id,
          quote: row.time_quote,
        }
      : null,
    topic: row.topic,
  }
}

function listMemoriesFromDb(db, scope) {
  return db.prepare(`
    SELECT *
    FROM dialogue_digest_items
    WHERE palari_id = ? AND user_id = ?
    ORDER BY observed_at ASC, observed_order ASC, created_at ASC, id ASC
  `).all(scope.palariId, scope.userId)
    .map((row) => itemRow(db, row, scope))
}

function stateStatus(db, scope) {
  const state = db.prepare(`
    SELECT *
    FROM dialogue_digest_state
    WHERE palari_id = ? AND user_id = ?
  `).get(scope.palariId, scope.userId)
  const canonicalRows = Number(db.prepare(`
    SELECT COUNT(*) AS count
    FROM dialogue_evidence
    WHERE palari_id = ? AND user_id = ?
  `).get(scope.palariId, scope.userId)?.count ?? 0)
  if (!state) {
    return {
      builtFromRevision: 0,
      canonicalRows,
      contractVersion: null,
      digestRevision: 0,
      pending: canonicalRows ? 1 : 0,
      ready: canonicalRows === 0,
      reducerId: null,
      sourceRevision: canonicalRows ? 1 : 0,
      status: canonicalRows ? 'pending' : 'empty',
    }
  }
  const pending = Number(db.prepare(`
    SELECT COUNT(*) AS count
    FROM dialogue_reduction_units
    WHERE palari_id = ? AND user_id = ? AND status = 'pending'
  `).get(scope.palariId, scope.userId)?.count ?? 0)
  const sourceRevision = Number(state.source_revision)
  const builtFromRevision = Number(state.built_from_revision)
  const contractVersion = state.contract_version ?? null
  const contractMatches = state.reducer_id
    ? contractVersion === ACTIVE_MEMORY_REDUCER_VERSION
    : contractVersion === null
  const ready =
    pending === 0 &&
    sourceRevision === builtFromRevision &&
    contractMatches
  return {
    builtFromRevision,
    canonicalRows,
    contractVersion,
    digestRevision: Number(state.digest_revision),
    pending,
    ready,
    reducerId: state.reducer_id ?? null,
    sourceRevision,
    status: !contractMatches
      ? 'contract_mismatch'
      : ready ? 'ready' : 'pending',
  }
}

function pendingUnitEvidence(db, unit) {
  if (unit.turn_id) {
    return db.prepare(`
      SELECT *
      FROM dialogue_evidence
      WHERE turn_id = ?
        AND palari_id = ?
        AND user_id = ?
        AND evidence_kind = 'canonical_message'
      ORDER BY event_at ASC, dialogue_order ASC, created_at ASC, id ASC
    `).all(unit.turn_id, unit.palari_id, unit.user_id)
  }
  return db.prepare(`
    SELECT *
    FROM dialogue_evidence
    WHERE id = ? AND palari_id = ? AND user_id = ?
  `).all(
    unit.legacy_evidence_id,
    unit.palari_id,
    unit.user_id,
  )
}

function priorForRequest(items) {
  return items.map((item) => ({
    epistemic: item.epistemic,
    id: item.id,
    observedAt: item.observedAt,
    speaker: item.speaker,
    statement: item.statement,
    timeBasis: item.timeBasis,
    topic: item.topic,
  }))
}

function evidenceForRequest(rows) {
  return rows.map((row) => ({
    id: row.id,
    observedAt: row.event_at,
    speaker: evidenceSpeaker(row.source_kind),
    text: row.content,
  }))
}

function compareEvidence(left, right) {
  const timeDelta =
    new Date(left.event_at).getTime() - new Date(right.event_at).getTime()
  if (timeDelta) return timeDelta
  return Number(left.dialogue_order) - Number(right.dialogue_order)
}

function exactEvidenceSupport(db, scope, basis) {
  const evidence = selectEvidence(db, basis.id, scope)
  if (!evidence || !String(evidence.content).includes(basis.quote)) {
    const error = new Error(
      `Reducer support does not match canonical evidence ${basis.id}.`,
    )
    error.code = 'REDUCER_EVIDENCE_MISMATCH'
    throw error
  }
  return {
    evidence,
    evidenceId: evidence.id,
    quote: basis.quote,
  }
}

function priorMemorySupport(db, scope, memoryId) {
  const item = db.prepare(`
    SELECT *
    FROM dialogue_digest_items
    WHERE id = ? AND palari_id = ? AND user_id = ?
  `).get(memoryId, scope.palariId, scope.userId)
  if (!item) {
    const error = new Error(`Reducer cited unknown memory ${memoryId}.`)
    error.code = 'REDUCER_MEMORY_MISMATCH'
    throw error
  }
  return {
    item,
    supports: listItemBasis(db, memoryId, scope).map((basis) => ({
      evidence: selectEvidence(db, basis.evidence_id, scope),
      evidenceId: basis.evidence_id,
      quote: basis.quote,
    })),
  }
}

function uniqueSupports(supports) {
  const unique = new Map()
  for (const support of supports) {
    if (!support.evidence) {
      const error = new Error('Reducer lineage references deleted evidence.')
      error.code = 'REDUCER_EVIDENCE_MISMATCH'
      throw error
    }
    const key = JSON.stringify([support.evidenceId, support.quote])
    if (!unique.has(key)) unique.set(key, support)
  }
  const values = [...unique.values()]
  if (values.length > ACTIVE_MEMORY_MAX_BASIS) {
    const error = new Error('Reducer item exceeds the evidence-basis limit.')
    error.code = 'REDUCER_BASIS_CAPACITY'
    throw error
  }
  return values
}

function actionMaterial(db, scope, action, currentEvidenceIds) {
  const supports = []
  const memoryBasis = []
  for (const basis of action.basis) {
    if (basis.kind === 'evidence') {
      if (!currentEvidenceIds.has(basis.id)) {
        const error = new Error(
          'Reducer cited canonical evidence outside the current unit.',
        )
        error.code = 'REDUCER_EVIDENCE_MISMATCH'
        throw error
      }
      supports.push(exactEvidenceSupport(db, scope, basis))
    } else {
      const prior = priorMemorySupport(db, scope, basis.id)
      memoryBasis.push(prior.item)
      supports.push(...prior.supports)
    }
  }
  const timeBasis = action.timeBasis
    ? exactEvidenceSupport(db, scope, {
        id: action.timeBasis.evidenceId,
        quote: action.timeBasis.quote,
      })
    : null
  if (timeBasis) {
    if (!currentEvidenceIds.has(timeBasis.evidenceId)) {
      const error = new Error(
        'Reducer time basis is outside the current unit.',
      )
      error.code = 'REDUCER_TIME_BASIS_MISMATCH'
      throw error
    }
    supports.push(timeBasis)
  }
  const unique = uniqueSupports(supports)
  const speakers = new Set(
    unique.map((support) =>
      evidenceSpeaker(support.evidence.source_kind)),
  )
  if (speakers.size !== 1) {
    const error = new Error(
      'One digest item cannot combine user and Palari authority.',
    )
    error.code = 'REDUCER_SPEAKER_CONFLICT'
    throw error
  }
  const evidenceSorted = unique
    .map((support) => support.evidence)
    .sort(compareEvidence)
  const latest = evidenceSorted.at(-1)
  return {
    anchorAt: timeBasis?.evidence.event_at ?? null,
    memoryBasis,
    observedAt: latest.event_at,
    observedOrder: Number(latest.dialogue_order),
    speaker: [...speakers][0],
    supports: unique,
    timeEvidenceId: timeBasis?.evidenceId ?? null,
    timeQuote: timeBasis?.quote ?? null,
  }
}

function memoryId(scope, action, material) {
  return `digest_${sha256Fields([
    scope.palariId,
    scope.userId,
    action.topic,
    action.statement,
    material.speaker,
    action.epistemic,
    ...material.supports.flatMap((support) => [
      support.evidenceId,
      support.quote,
    ]),
  ])}`
}

function renderedDigestChars(items) {
  return renderActiveMemoryDigest(items).text.length
}

export function createMemoryDigestStore(store, {
  clock = () => new Date(),
} = {}) {
  ensureMemoryDigestSchema(store, { clock })

  function queueTurn(scopeInput, turnId) {
    if (!store?.enabled) return false
    const scope = normalizedScope(scopeInput)
    const present = store.db.prepare(`
      SELECT 1
      FROM dialogue_evidence
      WHERE turn_id = ?
        AND palari_id = ?
        AND user_id = ?
        AND evidence_kind = 'canonical_message'
      LIMIT 1
    `).get(turnId, scope.palariId, scope.userId)
    if (!present) return false
    return seedUnit(
      store.db,
      scope,
      { turnId },
      isoNow(clock),
    )
  }

  function listMemories(scopeInput) {
    if (!store?.enabled) return []
    return listMemoriesFromDb(store.db, normalizedScope(scopeInput))
  }

  function status(scopeInput) {
    if (!store?.enabled) {
      return {
        builtFromRevision: 0,
        canonicalRows: 0,
        contractVersion: null,
        digestRevision: 0,
        pending: 0,
        ready: true,
        reducerId: null,
        sourceRevision: 0,
        status: 'empty',
      }
    }
    return stateStatus(store.db, normalizedScope(scopeInput))
  }

  function readReadyDigest(scopeInput) {
    if (!store?.enabled) {
      return {
        memories: [],
        status: status(scopeInput),
      }
    }
    const scope = normalizedScope(scopeInput)
    store.db.exec('BEGIN')
    try {
      const digestStatus = stateStatus(store.db, scope)
      const memories = digestStatus.ready && digestStatus.reducerId
        ? listMemoriesFromDb(store.db, scope)
        : null
      store.db.exec('COMMIT')
      return {
        memories,
        status: digestStatus,
      }
    } catch (error) {
      store.db.exec('ROLLBACK')
      throw error
    }
  }

  function listPending(scopeInput) {
    if (!store?.enabled) return []
    const scope = normalizedScope(scopeInput)
    return store.db.prepare(`
      SELECT
        unit_order,
        source_revision,
        status,
        attempts,
        last_error_category,
        turn_id,
        legacy_evidence_id,
        created_at
      FROM dialogue_reduction_units
      WHERE palari_id = ? AND user_id = ? AND status = 'pending'
      ORDER BY unit_order ASC
    `).all(scope.palariId, scope.userId).map((row) => ({
      attempts: Number(row.attempts),
      createdAt: row.created_at,
      lastErrorCategory: row.last_error_category ?? null,
      legacyEvidenceId: row.legacy_evidence_id ?? null,
      sourceRevision: Number(row.source_revision),
      status: row.status,
      turnId: row.turn_id ?? null,
      unitOrder: Number(row.unit_order),
    }))
  }

  function prepareOldest(scopeInput, reducerId) {
    if (!store?.enabled) return null
    const scope = normalizedScope(scopeInput)
    store.db.exec('BEGIN IMMEDIATE')
    try {
      const unit = store.db.prepare(`
        SELECT *
        FROM dialogue_reduction_units
        WHERE palari_id = ? AND user_id = ? AND status = 'pending'
        ORDER BY unit_order ASC
        LIMIT 1
      `).get(scope.palariId, scope.userId)
      if (!unit) {
        store.db.exec('COMMIT')
        return null
      }

      const normalizedReducerId = roundTrippableText(
        reducerId,
        'reducerId',
      ).trim()
      if (
        !normalizedReducerId ||
        normalizedReducerId === 'unidentified-reducer'
      ) {
        const error = new TypeError(
          'An explicit, versioned reducerId is required.',
        )
        error.code = 'REDUCER_ID_REQUIRED'
        throw error
      }

      const now = isoNow(clock)
      let state = ensureState(store.db, scope, now)
      if (state.reducer_id && state.reducer_id !== normalizedReducerId) {
        const error = new Error(
          `Reducer identity is already ${state.reducer_id}.`,
        )
        error.code = 'REDUCER_ID_CONFLICT'
        throw error
      }
      if (
        state.contract_version &&
        state.contract_version !== ACTIVE_MEMORY_REDUCER_VERSION
      ) {
        const error = new Error(
          `Reducer contract is already ${state.contract_version}.`,
        )
        error.code = 'REDUCER_CONTRACT_CONFLICT'
        throw error
      }
      if (
        (state.reducer_id && !state.contract_version) ||
        (!state.reducer_id && state.contract_version)
      ) {
        const error = new Error('Reducer identity provenance is incomplete.')
        error.code = 'REDUCER_CONTRACT_CONFLICT'
        throw error
      }

      if (!state.reducer_id) {
        store.db.prepare(`
          UPDATE dialogue_digest_state
          SET reducer_id = ?, contract_version = ?, updated_at = ?
          WHERE palari_id = ?
            AND user_id = ?
            AND reducer_id IS NULL
            AND contract_version IS NULL
        `).run(
          normalizedReducerId,
          ACTIVE_MEMORY_REDUCER_VERSION,
          now,
          scope.palariId,
          scope.userId,
        )
        state = store.db.prepare(`
          SELECT *
          FROM dialogue_digest_state
          WHERE palari_id = ? AND user_id = ?
        `).get(scope.palariId, scope.userId)
        if (
          state.reducer_id !== normalizedReducerId ||
          state.contract_version !== ACTIVE_MEMORY_REDUCER_VERSION
        ) {
          const error = new Error('Reducer identity claim conflicted.')
          error.code = 'REDUCER_ID_CONFLICT'
          throw error
        }
      }

      const evidenceRows = pendingUnitEvidence(store.db, unit)
      if (!evidenceRows.length) {
        const error = new Error(
          'Pending reduction unit has no live evidence.',
        )
        error.code = 'REDUCER_UNIT_EMPTY'
        throw error
      }
      const prior = listMemoriesFromDb(store.db, scope)
      const prepared = Object.freeze({
        baseRevision: Number(state.digest_revision),
        contractVersion: ACTIVE_MEMORY_REDUCER_VERSION,
        evidence: evidenceForRequest(evidenceRows),
        evidenceIds: Object.freeze(
          evidenceRows.map((row) => String(row.id)),
        ),
        prior: priorForRequest(prior),
        priorIds: Object.freeze(prior.map((item) => item.id)),
        reducerId: normalizedReducerId,
        scope: Object.freeze(scope),
        sourceRevision: Number(state.source_revision),
        unitOrder: Number(unit.unit_order),
      })
      store.db.exec('COMMIT')
      return prepared
    } catch (error) {
      store.db.exec('ROLLBACK')
      throw error
    }
  }

  function markFailure(prepared, category) {
    if (!store?.enabled || !prepared) return
    let safeCategory = 'reducer_error'
    try {
      safeCategory = roundTrippableText(
        category ?? safeCategory,
        'reducer error category',
      ).slice(0, 120)
    } catch {
      // The diagnostic must not become a second storage failure.
    }
    store.db.prepare(`
      UPDATE dialogue_reduction_units
      SET
        attempts = attempts + 1,
        last_error_category = ?
      WHERE unit_order = ?
        AND palari_id = ?
        AND user_id = ?
        AND status = 'pending'
    `).run(
      safeCategory,
      prepared.unitOrder,
      prepared.scope.palariId,
      prepared.scope.userId,
    )
  }

  function applyReduction(prepared, normalized) {
    const scope = normalizedScope(prepared?.scope)
    const now = isoNow(clock)
    store.db.exec('BEGIN IMMEDIATE')
    try {
      const state = store.db.prepare(`
        SELECT *
        FROM dialogue_digest_state
        WHERE palari_id = ? AND user_id = ?
      `).get(scope.palariId, scope.userId)
      if (
        !state ||
        Number(state.digest_revision) !== prepared.baseRevision
      ) {
        const error = new Error('Reducer base revision is stale.')
        error.code = 'REDUCER_STATE_CONFLICT'
        throw error
      }
      if (state.reducer_id !== prepared.reducerId) {
        const error = new Error('Reducer identity changed during reduction.')
        error.code = 'REDUCER_ID_CONFLICT'
        throw error
      }
      if (
        prepared.contractVersion !== ACTIVE_MEMORY_REDUCER_VERSION ||
        state.contract_version !== ACTIVE_MEMORY_REDUCER_VERSION
      ) {
        const error = new Error(
          'Reducer contract changed during reduction.',
        )
        error.code = 'REDUCER_CONTRACT_CONFLICT'
        throw error
      }
      const unit = store.db.prepare(`
        SELECT *
        FROM dialogue_reduction_units
        WHERE unit_order = ?
          AND palari_id = ?
          AND user_id = ?
          AND status = 'pending'
      `).get(
        prepared.unitOrder,
        scope.palariId,
        scope.userId,
      )
      const oldest = store.db.prepare(`
        SELECT unit_order
        FROM dialogue_reduction_units
        WHERE palari_id = ? AND user_id = ? AND status = 'pending'
        ORDER BY unit_order ASC
        LIMIT 1
      `).get(scope.palariId, scope.userId)
      if (!unit || Number(oldest?.unit_order) !== prepared.unitOrder) {
        const error = new Error('Reducer unit is no longer the queue head.')
        error.code = 'REDUCER_STATE_CONFLICT'
        throw error
      }
      const liveUnitIds = new Set(
        pendingUnitEvidence(store.db, unit).map((row) => String(row.id)),
      )
      if (
        liveUnitIds.size !== prepared.evidenceIds.length ||
        prepared.evidenceIds.some((id) => !liveUnitIds.has(id))
      ) {
        const error = new Error('Reducer unit evidence changed.')
        error.code = 'REDUCER_STATE_CONFLICT'
        throw error
      }

      const currentEvidenceIds = new Set(prepared.evidenceIds)
      const targetIds = new Set()
      const newItems = []
      for (const action of normalized.actions) {
        for (const targetId of action.targetIds) {
          if (targetIds.has(targetId)) {
            const error = new Error(
              `Reducer replaces ${targetId} more than once.`,
            )
            error.code = 'REDUCER_TARGET_CONFLICT'
            throw error
          }
          targetIds.add(targetId)
        }
        const material = actionMaterial(
          store.db,
          scope,
          action,
          currentEvidenceIds,
        )
        const targets = action.targetIds.map((targetId) =>
          store.db.prepare(`
            SELECT *
            FROM dialogue_digest_items
            WHERE id = ? AND palari_id = ? AND user_id = ?
          `).get(targetId, scope.palariId, scope.userId))
        if (targets.some((target) => !target)) {
          const error = new Error('Reducer replacement target is not active.')
          error.code = 'REDUCER_MEMORY_MISMATCH'
          throw error
        }
        if (
          targets.some((target) => target.speaker !== material.speaker)
        ) {
          const error = new Error(
            'Reducer cannot replace memory owned by another speaker.',
          )
          error.code = 'REDUCER_SPEAKER_CONFLICT'
          throw error
        }
        if (action.op === 'replace' && action.relation === 'supersedes') {
          const target = targets[0]
          if (targets.length !== 1 || target.topic !== action.topic) {
            const error = new Error(
              'Supersession requires one same-topic target.',
            )
            error.code = 'REDUCER_SUPERSESSION_INVALID'
            throw error
          }
          const latestTarget = {
            dialogue_order: target.observed_order,
            event_at: target.observed_at,
          }
          const currentRows = prepared.evidenceIds
            .map((id) => selectEvidence(store.db, id, scope))
            .filter((row) =>
              row && evidenceSpeaker(row.source_kind) === material.speaker)
            .sort(compareEvidence)
          if (
            !currentRows.length ||
            compareEvidence(currentRows.at(-1), latestTarget) <= 0
          ) {
            const error = new Error(
              'Older evidence cannot supersede newer memory.',
            )
            error.code = 'REDUCER_SUPERSESSION_INVALID'
            throw error
          }
        }
        const id = memoryId(scope, action, material)
        newItems.push({
          ...material,
          action,
          id,
        })
      }

      for (const targetId of targetIds) {
        store.db.prepare(
          'DELETE FROM dialogue_digest_items WHERE id = ?',
        ).run(targetId)
      }
      for (const item of newItems) {
        const collision = store.db.prepare(
          'SELECT id FROM dialogue_digest_items WHERE id = ?',
        ).get(item.id)
        if (collision) {
          const error = new Error('Reducer produced a duplicate digest item.')
          error.code = 'REDUCER_DUPLICATE_ITEM'
          throw error
        }
        store.db.prepare(`
          INSERT INTO dialogue_digest_items (
            id,
            palari_id,
            user_id,
            topic,
            statement,
            speaker,
            epistemic,
            observed_at,
            observed_order,
            time_evidence_id,
            time_quote,
            anchor_at,
            reducer_id,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          item.id,
          scope.palariId,
          scope.userId,
          item.action.topic,
          item.action.statement,
          item.speaker,
          item.action.epistemic,
          item.observedAt,
          item.observedOrder,
          item.timeEvidenceId,
          item.timeQuote,
          item.anchorAt,
          prepared.reducerId,
          now,
        )
        for (let index = 0; index < item.supports.length; index += 1) {
          const support = item.supports[index]
          store.db.prepare(`
            INSERT INTO dialogue_digest_basis (
              item_id,
              evidence_id,
              quote,
              basis_order
            ) VALUES (?, ?, ?, ?)
          `).run(
            item.id,
            support.evidenceId,
            support.quote,
            index,
          )
        }
      }
      const completeItems = listMemoriesFromDb(store.db, scope)
      if (completeItems.length > ACTIVE_MEMORY_MAX_ITEMS) {
        const error = new Error('Reducer state exceeds the item limit.')
        error.code = 'REDUCER_DIGEST_CAPACITY'
        throw error
      }
      const digestChars = renderedDigestChars(completeItems)
      if (digestChars > ACTIVE_MEMORY_MAX_DIGEST_CHARS) {
        const error = new Error('Reducer state exceeds the digest limit.')
        error.code = 'REDUCER_DIGEST_CAPACITY'
        throw error
      }

      const nextDigestRevision = Number(state.digest_revision) + 1
      store.db.prepare(`
        UPDATE dialogue_reduction_units
        SET
          status = 'applied',
          attempts = attempts + 1,
          last_error_category = NULL,
          applied_at = ?
        WHERE unit_order = ?
      `).run(now, prepared.unitOrder)
      const pending = Number(store.db.prepare(`
        SELECT COUNT(*) AS count
        FROM dialogue_reduction_units
        WHERE palari_id = ? AND user_id = ? AND status = 'pending'
      `).get(scope.palariId, scope.userId)?.count ?? 0)
      store.db.prepare(`
        UPDATE dialogue_digest_state
        SET
          built_from_revision = ?,
          digest_revision = ?,
          reducer_id = ?,
          contract_version = ?,
          updated_at = ?
        WHERE palari_id = ? AND user_id = ?
      `).run(
        pending === 0
          ? Number(state.source_revision)
          : Number(state.built_from_revision),
        nextDigestRevision,
        prepared.reducerId,
        ACTIVE_MEMORY_REDUCER_VERSION,
        now,
        scope.palariId,
        scope.userId,
      )
      store.db.exec('COMMIT')
      return {
        appliedActions: normalized.actions.length,
        digestChars,
        digestRevision: nextDigestRevision,
        itemCount: completeItems.length,
        pending,
        status: 'completed',
        unitOrder: prepared.unitOrder,
      }
    } catch (error) {
      store.db.exec('ROLLBACK')
      throw error
    }
  }

  function invalidateAfterDeletion(scopeInput) {
    if (!store?.enabled) {
      return {
        invalidatedItems: 0,
        pending: 0,
        sourceRevision: 0,
      }
    }
    const scope = normalizedScope(scopeInput)
    const now = isoNow(clock)
    const state = ensureState(store.db, scope, now)
    const invalidatedItems = Number(store.db.prepare(`
      SELECT COUNT(*) AS count
      FROM dialogue_digest_items
      WHERE palari_id = ? AND user_id = ?
    `).get(scope.palariId, scope.userId)?.count ?? 0)
    store.db.prepare(`
      DELETE FROM dialogue_digest_items
      WHERE palari_id = ? AND user_id = ?
    `).run(scope.palariId, scope.userId)
    store.db.prepare(`
      DELETE FROM dialogue_reduction_units AS u
      WHERE u.palari_id = ?
        AND u.user_id = ?
        AND NOT ${unitHasEvidenceSql('u')}
    `).run(scope.palariId, scope.userId)
    store.db.prepare(`
      UPDATE dialogue_reduction_units
      SET
        status = 'pending',
        attempts = 0,
        last_error_category = NULL,
        applied_at = NULL
      WHERE palari_id = ? AND user_id = ?
    `).run(scope.palariId, scope.userId)
    const pending = Number(store.db.prepare(`
      SELECT COUNT(*) AS count
      FROM dialogue_reduction_units
      WHERE palari_id = ? AND user_id = ? AND status = 'pending'
    `).get(scope.palariId, scope.userId)?.count ?? 0)
    const sourceRevision = Number(state.source_revision) + 1
    store.db.prepare(`
      UPDATE dialogue_digest_state
      SET
        source_revision = ?,
        built_from_revision = ?,
        digest_revision = digest_revision + 1,
        updated_at = ?
      WHERE palari_id = ? AND user_id = ?
    `).run(
      sourceRevision,
      pending === 0
        ? sourceRevision
        : Number(state.built_from_revision),
      now,
      scope.palariId,
      scope.userId,
    )
    return {
      invalidatedItems,
      pending,
      sourceRevision,
    }
  }

  return Object.freeze({
    applyReduction,
    invalidateAfterDeletion,
    listMemories,
    listPending,
    markFailure,
    prepareOldest,
    queueTurn,
    readReadyDigest,
    status,
  })
}

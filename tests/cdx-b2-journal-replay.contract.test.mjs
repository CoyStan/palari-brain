// V2-M2-B Task 4 — checkpoint-derived journal replay and honest blind spots.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  GovernedMemoryError,
  advanceCdxB2HeadInTransaction,
  appendCdxB2TailInTransaction,
  bootstrapCdxB2InTransaction,
  verifyCdxB2InTransaction,
} from '../src/cdx-b2-journal.mjs'
import { createMutationCoordinator } from '../src/mutation-coordinator.mjs'
import {
  B2_AUTHORITY_LEDGER_ID,
  B2_WORKSPACE_ID,
  b2Identifier,
  createB2Tail,
  createCdxM1Fixture,
  readB2Rows,
  seedB2Link,
  seedB2Memory,
} from './helpers/cdx-b2-fixtures.mjs'

const IDS = Object.freeze({
  erasedCurrent: b2Identifier('mem_', 201),
  erasedEnded: b2Identifier('mem_', 202),
  retainedCurrent: b2Identifier('mem_', 203),
  retainedEnded: b2Identifier('mem_', 204),
  linkedFrom: b2Identifier('mem_', 205),
  linkedTo: b2Identifier('mem_', 206),
  missing: b2Identifier('mem_', 299),
  link: b2Identifier('lnk_', 201),
  legacy: 'legacy-payload-column-free-id-can-contain-arbitrary-text',
})

function bootstrap(db) {
  return createMutationCoordinator(db).run((lease) =>
    bootstrapCdxB2InTransaction(
      lease,
      db,
      { workspaceId: B2_WORKSPACE_ID },
    ))
}

function verify(db) {
  return createMutationCoordinator(db).run((lease) =>
    verifyCdxB2InTransaction(lease, db))
}

function seedReplayProjection(db) {
  seedB2Memory(db, {
    id: IDS.erasedCurrent,
    // A permanent-class preference atom and an ended transient atom below
    // prove that neither CDX type nor validity class affects eligibility.
    memoryType: 'preference',
  })
  seedB2Memory(db, {
    id: IDS.erasedEnded,
    memoryType: 'recent_life',
    validUntil: '2026-07-21T10:30:00.000Z',
  })
  seedB2Memory(db, {
    id: IDS.retainedCurrent,
    memoryType: 'project',
  })
  seedB2Memory(db, {
    id: IDS.retainedEnded,
    memoryType: 'working',
    validUntil: '2026-07-21T10:30:00.000Z',
  })
  seedB2Memory(db, {
    id: IDS.linkedFrom,
    memoryType: 'entity',
  })
  seedB2Memory(db, {
    id: IDS.linkedTo,
    memoryType: 'life_event',
  })
  seedB2Memory(db, {
    id: IDS.legacy,
    memoryType: 'opinion',
    userId: null,
  })
  seedB2Link(db, {
    id: IDS.link,
    fromMemoryId: IDS.linkedFrom,
    toMemoryId: IDS.linkedTo,
  })
}

function createReplayFixture() {
  const fixture = createCdxM1Fixture(0, { withRows: false })
  seedReplayProjection(fixture.db)
  const initial = bootstrap(fixture.db)
  return { fixture, initial }
}

function commitTail(db, state, options) {
  const tail = createB2Tail(state, options)
  const next = createMutationCoordinator(db).run((lease) => {
    assert.equal(
      appendCdxB2TailInTransaction(lease, db, tail),
      undefined,
    )
    if (tail.decision.outcome === 'applied') {
      const result = db.prepare(
        'DELETE FROM main.memories WHERE id = ?',
      ).run(tail.decision.target_id)
      assert.equal(result.changes, 1)
    }
    return advanceCdxB2HeadInTransaction(
      lease,
      db,
      tail.decision.sequence,
    )
  })
  return { state: next, tail }
}

function buildReplayHistory(db, initial) {
  const first = commitTail(db, initial, {
    sequence: 1,
    targetId: IDS.erasedCurrent,
    outcome: 'applied',
    reasonCode: null,
    observedAt: '2026-07-21T10:02:00.000Z',
  })
  const second = commitTail(db, first.state, {
    sequence: 2,
    targetId: IDS.missing,
    outcome: 'refused',
    reasonCode: 'missing_target',
    // Equality is intentionally legal under the nondecreasing clock law.
    observedAt: '2026-07-21T10:02:00.000Z',
  })
  const third = commitTail(db, second.state, {
    sequence: 3,
    targetId: IDS.erasedEnded,
    outcome: 'applied',
    reasonCode: null,
    observedAt: '2026-07-21T10:02:30.000Z',
  })
  return third.state
}

function assertGovernedCode(code) {
  return (error) => {
    assert.equal(error instanceof GovernedMemoryError, true)
    assert.equal(error.code, code)
    return true
  }
}

test('M2-B-04 replay reduces historical applied targets from the checkpoint rather than current CDX', () => {
  const { fixture, initial } = createReplayFixture()
  try {
    const finalState = buildReplayHistory(fixture.db, initial)
    assert.equal(finalState.headMutationSequence, 3)
    assert.equal(finalState.lastObservedAt, '2026-07-21T10:02:30.000Z')
    assert.equal(finalState.authorityLedgerId, B2_AUTHORITY_LEDGER_ID)
    assert.deepEqual(verify(fixture.db), finalState)

    const remaining = fixture.db.prepare(`
      SELECT id, palari_id, user_id, type, shared,
        CASE WHEN valid_until IS NULL THEN 'current' ELSE 'ended' END
          AS validity_state
      FROM main.memories
      ORDER BY id COLLATE BINARY
    `).all().map((row) => ({ ...row }))
    assert.deepEqual(
      remaining.map(({ id }) => id),
      [
        IDS.legacy,
        IDS.retainedCurrent,
        IDS.retainedEnded,
        IDS.linkedFrom,
        IDS.linkedTo,
      ].sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right))),
    )
    assert.deepEqual(
      fixture.db.prepare(`
        SELECT id, from_memory_id, to_memory_id
        FROM main.memory_links
        ORDER BY id COLLATE BINARY
      `).all().map((row) => ({ ...row })),
      [{
        id: IDS.link,
        from_memory_id: IDS.linkedFrom,
        to_memory_id: IDS.linkedTo,
      }],
    )
    assert.deepEqual(
      fixture.db.prepare(`
        SELECT memory_id FROM main.memory_fts
        ORDER BY memory_id COLLATE BINARY
      `).all().map(({ memory_id: id }) => id),
      remaining.map(({ id }) => id),
    )
    assert.equal(
      readB2Rows(fixture.db).cdx_b2_legacy_checkpoint.some(
        ({ entity_id: id }) => id === IDS.legacy,
      ),
      true,
    )
    // These identifiers are synthetic and have no external-ledger witness.
    // Successful verification demonstrates the explicit authenticity nonclaim.
    assert.equal(
      readB2Rows(fixture.db).cdx_b2_decisions.every(
        ({ authority_ledger_id: id }) => id === B2_AUTHORITY_LEDGER_ID,
      ),
      true,
    )
  } finally {
    fixture.close()
  }
})

test('M2-B-04 verifier intentionally accepts every documented payload and metadata blind spot', () => {
  const { fixture, initial } = createReplayFixture()
  try {
    const expected = buildReplayHistory(fixture.db, initial)
    fixture.db.prepare(`
      UPDATE main.memories SET
        content = ?,
        keywords = ?,
        content_hash = ?,
        importance = ?,
        confidence = ?,
        fictional = ?,
        access_count = ?,
        last_accessed = ?,
        last_decayed_at = ?,
        acquisition_mode = ?,
        created_by_pipeline = ?,
        source_message_id = ?,
        source_kind = ?,
        extractor = ?,
        created_at = ?,
        valid_from = ?
      WHERE id = ?
    `).run(
      'changed content outside B2',
      'changed keywords outside B2',
      'changed-content-hash-outside-b2',
      0.125,
      0.375,
      1,
      91,
      '2026-07-21T10:40:00.000Z',
      '2026-07-21T10:41:00.000Z',
      'summarized',
      1,
      'changed-source-message',
      'changed-source-kind',
      'changed-extractor',
      '2026-07-21T10:42:00.000Z',
      '2026-07-21T10:43:00.000Z',
      IDS.retainedCurrent,
    )
    fixture.db.prepare(`
      UPDATE main.memories
      SET valid_until = ?
      WHERE id = ?
    `).run('2026-07-21T10:59:00.000Z', IDS.retainedEnded)
    fixture.db.prepare(`
      UPDATE main.memory_links
      SET relation = ?, created_at = ?
      WHERE id = ?
    `).run(
      'changed-relation-outside-b2',
      '2026-07-21T10:44:00.000Z',
      IDS.link,
    )

    // Replace a retained rowid while preserving the full A2 projection.
    const legacy = fixture.db.prepare(`
      SELECT rowid, id, palari_id, content, keywords
      FROM main.memories WHERE id = ?
    `).get(IDS.legacy)
    const replacementRowid = fixture.db.prepare(
      'SELECT max(rowid) + 100 AS value FROM main.memories',
    ).get().value
    fixture.db.prepare(
      'DELETE FROM main.memory_fts WHERE rowid = ?',
    ).run(legacy.rowid)
    fixture.db.prepare(
      'UPDATE main.memories SET rowid = ? WHERE id = ?',
    ).run(replacementRowid, IDS.legacy)
    fixture.db.prepare(`
      INSERT INTO main.memory_fts(
        rowid, memory_id, palari_id, content, keywords
      ) VALUES (?, ?, ?, ?, ?)
    `).run(
      replacementRowid,
      legacy.id,
      legacy.palari_id,
      legacy.content,
      legacy.keywords,
    )

    assert.deepEqual(verify(fixture.db), expected)
  } finally {
    fixture.close()
  }
})

test('M2-B-04 checked projection mutations fail while exact omitted-value changes do not', async (t) => {
  const cases = [
    ['palari scope', (db) => db.prepare(
      'UPDATE main.memories SET palari_id = ? WHERE id = ?',
    ).run('other-palari', IDS.retainedCurrent)],
    ['nullable user scope', (db) => db.prepare(
      'UPDATE main.memories SET user_id = NULL WHERE id = ?',
    ).run(IDS.retainedCurrent)],
    ['memory type', (db) => db.prepare(
      'UPDATE main.memories SET type = ? WHERE id = ?',
    ).run('opinion', IDS.retainedCurrent)],
    ['shared bit', (db) => db.prepare(
      'UPDATE main.memories SET shared = 1 WHERE id = ?',
    ).run(IDS.retainedCurrent)],
    ['validity class', (db) => db.prepare(
      'UPDATE main.memories SET valid_until = ? WHERE id = ?',
    ).run('2026-07-21T11:00:00.000Z', IDS.retainedCurrent)],
    ['link id', (db) => db.prepare(
      'UPDATE main.memory_links SET id = ? WHERE id = ?',
    ).run(b2Identifier('lnk_', 999), IDS.link)],
    ['link endpoint', (db) => db.prepare(
      'UPDATE main.memory_links SET to_memory_id = ? WHERE id = ?',
    ).run(IDS.retainedCurrent, IDS.link)],
    ['FTS membership', (db) => db.prepare(
      'DELETE FROM main.memory_fts WHERE memory_id = ?',
    ).run(IDS.retainedCurrent)],
  ]

  for (const [label, mutate] of cases) {
    await t.test(label, () => {
      const { fixture, initial } = createReplayFixture()
      try {
        buildReplayHistory(fixture.db, initial)
        mutate(fixture.db)
        assert.throws(
          () => verify(fixture.db),
          assertGovernedCode('governance_projection_invalid'),
        )
      } finally {
        fixture.close()
      }
    })
  }

  await t.test('reinserted erased id', () => {
    const { fixture, initial } = createReplayFixture()
    try {
      buildReplayHistory(fixture.db, initial)
      seedB2Memory(fixture.db, { id: IDS.erasedCurrent })
      assert.throws(
        () => verify(fixture.db),
        assertGovernedCode('governance_projection_invalid'),
      )
    } finally {
      fixture.close()
    }
  })

  await t.test('deleted retained memory', () => {
    const { fixture, initial } = createReplayFixture()
    try {
      buildReplayHistory(fixture.db, initial)
      fixture.db.prepare(
        'DELETE FROM main.memories WHERE id = ?',
      ).run(IDS.retainedCurrent)
      assert.throws(
        () => verify(fixture.db),
        assertGovernedCode('governance_projection_invalid'),
      )
    } finally {
      fixture.close()
    }
  })
})

test('M2-B-04 pending tails and projection/head failures never become a verified history', () => {
  const { fixture, initial } = createReplayFixture()
  try {
    const pending = createB2Tail(initial, {
      sequence: 1,
      targetId: IDS.missing,
      outcome: 'refused',
      reasonCode: 'missing_target',
    })
    createMutationCoordinator(fixture.db).run((lease) => {
      appendCdxB2TailInTransaction(lease, fixture.db, pending)
    })
    assert.throws(
      () => verify(fixture.db),
      assertGovernedCode('governance_journal_invalid'),
    )
  } finally {
    fixture.close()
  }

  const appliedFixture = createReplayFixture()
  try {
    const tail = createB2Tail(appliedFixture.initial, {
      sequence: 1,
      targetId: IDS.erasedCurrent,
      outcome: 'applied',
      reasonCode: null,
    })
    assert.throws(
      () => createMutationCoordinator(appliedFixture.fixture.db).run((lease) => {
        appendCdxB2TailInTransaction(lease, appliedFixture.fixture.db, tail)
        advanceCdxB2HeadInTransaction(lease, appliedFixture.fixture.db, 1)
      }),
      (error) => (
        error instanceof GovernedMemoryError &&
        (
          error.code === 'governance_projection_invalid' ||
          error.code === 'governance_journal_invalid'
        )
      ),
    )
    assert.equal(
      appliedFixture.fixture.db.prepare(
        'SELECT count(*) AS count FROM main.cdx_b2_decisions',
      ).get().count,
      0,
    )
    assert.equal(
      appliedFixture.fixture.db.prepare(
        'SELECT count(*) AS count FROM main.memories WHERE id = ?',
      ).get(IDS.erasedCurrent).count,
      1,
    )
  } finally {
    appliedFixture.fixture.close()
  }
})

test('M2-B-04 an outer failure rolls decision, effects, projection, and head back together', () => {
  const { fixture, initial } = createReplayFixture()
  try {
    const beforeB2 = readB2Rows(fixture.db)
    const beforeMemory = fixture.db.prepare(`
      SELECT id FROM main.memories ORDER BY id COLLATE BINARY
    `).all().map(({ id }) => id)
    const tail = createB2Tail(initial, {
      sequence: 1,
      targetId: IDS.erasedCurrent,
      outcome: 'applied',
      reasonCode: null,
    })
    const forced = new Error('forced post-head rollback')
    assert.throws(
      () => createMutationCoordinator(fixture.db).run((lease) => {
        appendCdxB2TailInTransaction(lease, fixture.db, tail)
        fixture.db.prepare(
          'DELETE FROM main.memories WHERE id = ?',
        ).run(IDS.erasedCurrent)
        advanceCdxB2HeadInTransaction(lease, fixture.db, 1)
        throw forced
      }),
      (error) => error === forced,
    )
    assert.deepEqual(readB2Rows(fixture.db), beforeB2)
    assert.deepEqual(
      fixture.db.prepare(`
        SELECT id FROM main.memories ORDER BY id COLLATE BINARY
      `).all().map(({ id }) => id),
      beforeMemory,
    )
    assert.deepEqual(verify(fixture.db), initial)
  } finally {
    fixture.close()
  }
})

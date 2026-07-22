// V2-M2-B Task 3 — exact B2 bootstrap/checkpoint contract.

import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { test } from 'node:test'

import {
  GovernedMemoryError,
  advanceCdxB2HeadInTransaction,
  appendCdxB2TailInTransaction,
  bootstrapCdxB2InTransaction,
  verifyCdxB2InTransaction,
} from '../src/cdx-b2-journal.mjs'
import {
  CDX_B2_CREATE_STATEMENTS,
  CDX_B2_KERNEL_CONFIG_HASH,
} from '../src/cdx-b2-schema.mjs'
import { createMutationCoordinator } from '../src/mutation-coordinator.mjs'
import { createKernelStore } from '../src/store.mjs'
import {
  B2_MEMORY_IDS,
  B2_PAYLOAD_CANARIES,
  B2_ROW_TIME,
  B2_WORKSPACE_ID,
  b2Inventory,
  b2ScalarStrings,
  b2ScalarValues,
  createCdxM1Fixture,
  expectedCheckpointRows,
  migrationRows,
  readB2Rows,
  seedHistoricalCdxSchema,
} from './helpers/cdx-b2-fixtures.mjs'

const JOURNAL_EXPORTS_AT_TASK_4 = Object.freeze([
  'GovernedMemoryError',
  'advanceCdxB2HeadInTransaction',
  'appendCdxB2TailInTransaction',
  'bootstrapCdxB2InTransaction',
  'verifyCdxB2InTransaction',
])

const ERROR_PAIRS = Object.freeze({
  governance_invalid_argument: 'A valid governed memory argument is required.',
  governance_connection_invalid: 'The governed memory connection is unavailable.',
  governance_transaction_required: 'A coordinator-owned governed mutation transaction is required.',
  governance_schema_invalid: 'The CDX-B2 schema is invalid.',
  governance_migration_invalid: 'The CDX-B2 migration state is invalid.',
  governance_config_invalid: 'The CDX-B2 kernel configuration is invalid.',
  governance_meta_invalid: 'The CDX-B2 metadata is invalid.',
  governance_checkpoint_invalid: 'The CDX-B2 legacy checkpoint is invalid.',
  governance_journal_invalid: 'The CDX-B2 journal is invalid.',
  governance_projection_invalid: 'The CDX-M1 projection does not match the CDX-B2 journal.',
  governance_clock_invalid: 'The governed memory observation clock moved backward.',
  governance_identifier_collision: 'A generated governed memory identifier already exists.',
  governance_state_closed: 'The governed memory bridge is closed.',
  governance_state_poisoned: 'The governed memory bridge is poisoned and must be discarded.',
  governance_internal_invariant: 'The governed memory kernel invariant failed.',
})

function bootstrap(db, input = { workspaceId: B2_WORKSPACE_ID }) {
  return createMutationCoordinator(db).run((lease) =>
    bootstrapCdxB2InTransaction(lease, db, input))
}

function verify(db) {
  return createMutationCoordinator(db).run((lease) =>
    verifyCdxB2InTransaction(lease, db))
}

function assertTask3State(value, expected = {}) {
  assert.equal(Object.getPrototypeOf(value), null)
  assert.equal(Object.isFrozen(value), true)
  assert.deepEqual(Reflect.ownKeys(value), [
    'streamId',
    'headMutationSequence',
    'lastObservedAt',
    'authorityLedgerId',
    'checkpointMemoryCount',
    'checkpointLinkCount',
  ])
  assert.match(value.streamId, /^b2s_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  assert.equal(value.headMutationSequence, 0)
  assert.equal(value.lastObservedAt, null)
  assert.equal(value.authorityLedgerId, null)
  assert.equal(value.checkpointMemoryCount, expected.memoryCount ?? 3)
  assert.equal(value.checkpointLinkCount, expected.linkCount ?? 2)
}

function assertGovernedCode(expectedCode) {
  return (error) => {
    assert.equal(error instanceof GovernedMemoryError, true)
    assert.equal(error.name, 'GovernedMemoryError')
    assert.equal(error.code, expectedCode)
    assert.equal(error.message, ERROR_PAIRS[expectedCode])
    return true
  }
}

test('M2-B-04 journal exposes exactly five truthful operations and the closed governed error class', async () => {
  const namespace = await import('../src/cdx-b2-journal.mjs')
  assert.deepEqual(Object.keys(namespace), JOURNAL_EXPORTS_AT_TASK_4)

  const cause = new Error('identity cause')
  for (const [code, message] of Object.entries(ERROR_PAIRS)) {
    const error = new GovernedMemoryError(code, message, cause)
    assert.equal(error instanceof Error, true)
    assert.equal(error instanceof GovernedMemoryError, true)
    assert.equal(error.name, 'GovernedMemoryError')
    assert.equal(error.message, message)
    assert.equal(error.cause, cause)
    assert.deepEqual(Object.keys(error), ['code'])
    assert.equal(error.code, code)
    assert.equal(Object.getOwnPropertyDescriptor(error, 'code').writable, false)
  }
  assert.throws(
    () => new GovernedMemoryError('not-governed', 'message'),
    { name: 'TypeError', message: 'Unknown governed memory error code.' },
  )
  assert.throws(
    () => new GovernedMemoryError('governance_schema_invalid', ''),
    {
      name: 'TypeError',
      message: 'Governed memory error message must be a non-empty string.',
    },
  )
})

test('M2-B-03 lease and connection validation precede bootstrap input inspection', () => {
  const fixture = createCdxM1Fixture(0, { withRows: false })
  try {
    const poisonInput = Object.defineProperty({}, 'workspaceId', {
      get() {
        throw new Error('input accessor must not run')
      },
    })
    assert.throws(
      () => bootstrapCdxB2InTransaction({}, fixture.db, poisonInput),
      (error) => error?.code === 'mutation_invalid_argument',
    )
    assert.throws(
      () => appendCdxB2TailInTransaction({}, fixture.db, poisonInput),
      (error) => error?.code === 'mutation_invalid_argument',
    )
    assert.throws(
      () => advanceCdxB2HeadInTransaction({}, fixture.db, poisonInput),
      (error) => error?.code === 'mutation_invalid_argument',
    )

    const coordinator = createMutationCoordinator(fixture.db)
    const invalidInputs = [
      null,
      {},
      { workspaceId: '' },
      { workspaceId: B2_WORKSPACE_ID, extra: true },
      Object.defineProperty({}, 'workspaceId', { get: () => B2_WORKSPACE_ID }),
      new Proxy({ workspaceId: B2_WORKSPACE_ID }, {}),
    ]
    for (const input of invalidInputs) {
      assert.throws(
        () => coordinator.run((lease) =>
          bootstrapCdxB2InTransaction(lease, fixture.db, input)),
        assertGovernedCode('governance_invalid_argument'),
      )
    }
  } finally {
    fixture.close()
  }
})

for (const orderIndex of [0, 1, 2]) {
  test(`M2-B-03 snapshots exact nonempty CDX order ${orderIndex} atomically in BINARY blocks`, () => {
    const fixture = createCdxM1Fixture(orderIndex)
    try {
      const state = bootstrap(fixture.db)
      assertTask3State(state)

      const rows = readB2Rows(fixture.db)
      assert.equal(rows.cdx_b2_meta.length, 1)
      const meta = rows.cdx_b2_meta[0]
      assert.equal(meta.stream_id, state.streamId)
      assert.equal(meta.workspace_id, B2_WORKSPACE_ID)
      assert.equal(meta.schema_version, 'CDX-B2')
      assert.equal(meta.head_mutation_sequence, 0)
      assert.equal(meta.checkpoint_memory_count, 3)
      assert.equal(meta.checkpoint_link_count, 2)
      assert.equal(meta.legacy_schema_variant, `cdx_m1_order_${orderIndex}`)
      assert.equal(meta.kernel_config_hash, CDX_B2_KERNEL_CONFIG_HASH)
      assert.equal(rows.cdx_b2_decisions.length, 0)
      assert.equal(rows.cdx_b2_effects.length, 0)
      assert.deepEqual(
        rows.cdx_b2_legacy_checkpoint,
        expectedCheckpointRows(state.streamId),
      )
      assert.deepEqual(
        migrationRows(fixture.db).map((row) => row.id),
        ['CDX-B2', 'CDX-M0', 'CDX-M1'],
      )
      assert.equal(
        migrationRows(fixture.db)[0].applied_at,
        meta.checkpoint_at,
      )

      const verified = verify(fixture.db)
      assert.deepEqual(verified, state)

      // query_only is a native SQLite falsifier that the verify-only branch
      // performs no DDL, DML, structural repair, or control-plane mutation.
      const coordinator = createMutationCoordinator(fixture.db)
      const reopened = coordinator.run((lease) => {
        fixture.db.exec('PRAGMA query_only = ON')
        return bootstrapCdxB2InTransaction(
          lease,
          fixture.db,
          { workspaceId: B2_WORKSPACE_ID },
        )
      })
      fixture.db.exec('PRAGMA query_only = OFF')
      assert.deepEqual(reopened, state)
      assert.deepEqual(readB2Rows(fixture.db), rows)
    } finally {
      if (fixture.db.isOpen) fixture.db.exec('PRAGMA query_only = OFF')
      fixture.close()
    }
  })
}

test('M2-B-03 empty CDX produces an exact zero-row immutable checkpoint', () => {
  const fixture = createCdxM1Fixture(0, { withRows: false })
  try {
    const state = bootstrap(fixture.db)
    assertTask3State(state, { memoryCount: 0, linkCount: 0 })
    assert.deepEqual(readB2Rows(fixture.db).cdx_b2_legacy_checkpoint, [])
    assert.deepEqual(verify(fixture.db), state)
  } finally {
    fixture.close()
  }
})

test('M2-B-03 checkpoint excludes payload-bearing columns without a whole-file claim', () => {
  const fixture = createCdxM1Fixture(0)
  try {
    const state = bootstrap(fixture.db)
    const before = readB2Rows(fixture.db).cdx_b2_legacy_checkpoint
    const scalars = b2ScalarStrings(fixture.db)
    for (const canary of B2_PAYLOAD_CANARIES) {
      assert.equal(scalars.includes(canary), false, canary)
    }
    for (const excluded of [
      B2_ROW_TIME,
      'extracted',
      'external_source',
      'user_message',
      'test-extractor',
      'second-excluded-content-canary',
      'second-excluded-keywords-canary',
      'second-excluded-hash-canary',
      'third-excluded-content-canary',
      'third-excluded-keywords-canary',
      'third-excluded-source-message-canary',
      'third-excluded-hash-canary',
      'second-link-relation-canary',
    ]) {
      assert.equal(scalars.includes(excluded), false, excluded)
    }
    const scalarValues = b2ScalarValues(fixture.db)
    for (const excludedNumber of [17, 0.625, 0.875]) {
      assert.equal(scalarValues.includes(excludedNumber), false)
    }

    // Closed/numeric and nullable payload fields cannot safely carry unique
    // string canaries. Mutate every excluded class and prove the descriptor
    // checkpoint itself remains byte-for-byte identical.
    fixture.db.exec('PRAGMA ignore_check_constraints = ON')
    fixture.db.prepare(`
      UPDATE memories SET
        content = ?, keywords = ?, importance = ?, valid_from = ?,
        valid_until = ?, access_count = ?, last_accessed = ?, created_at = ?,
        confidence = ?, acquisition_mode = ?, created_by_pipeline = ?,
        fictional = ?, last_decayed_at = ?, source_message_id = ?,
        content_hash = ?, source_kind = ?, extractor = ?
      WHERE id = ?
    `).run(
      'alternate-content', 'alternate-keywords', -7.25,
      'alternate-valid-from', 'alternate-valid-until', 991,
      'alternate-last-accessed', 'alternate-created-at', -3.5,
      'alternate-acquisition', 7, 9, 'alternate-last-decayed',
      'alternate-source-message', 'alternate-content-hash',
      'alternate-source-kind', 'alternate-extractor', B2_MEMORY_IDS[0],
    )
    fixture.db.prepare(`
      UPDATE memory_links SET relation = ?, created_at = ? WHERE id = ?
    `).run('alternate-relation', 'alternate-link-created-at',
      'lnk_00000000-0000-4000-8000-000000000001')
    fixture.db.exec('PRAGMA ignore_check_constraints = OFF')

    assert.deepEqual(
      readB2Rows(fixture.db).cdx_b2_legacy_checkpoint,
      before,
    )
    assert.equal(state.checkpointMemoryCount, 3)
  } finally {
    fixture.close()
  }
})

function expectAbsentCandidateRejection(setup, expectedCode) {
  const fixture = createCdxM1Fixture(0, { withRows: false })
  try {
    setup(fixture.db)
    const before = b2Inventory(fixture.db)
    const beforeMigrations = migrationRows(fixture.db)
    assert.throws(() => bootstrap(fixture.db), assertGovernedCode(expectedCode))
    assert.deepEqual(b2Inventory(fixture.db), before)
    assert.deepEqual(migrationRows(fixture.db), beforeMigrations)
  } finally {
    fixture.close()
  }
}

test('M2-B-03 marker/schema mismatch, partial, extra, and case-spoofed B2 states are never repaired', () => {
  expectAbsentCandidateRejection(
    (db) => db.prepare(
      "INSERT INTO memory_migrations(id, applied_at) VALUES ('CDX-B2', ?)",
    ).run('2026-07-21T10:01:00.000Z'),
    'governance_migration_invalid',
  )
  expectAbsentCandidateRejection(
    (db) => db.exec(CDX_B2_CREATE_STATEMENTS[0]),
    'governance_schema_invalid',
  )
  expectAbsentCandidateRejection(
    (db) => {
      for (const statement of CDX_B2_CREATE_STATEMENTS) db.exec(statement)
    },
    'governance_migration_invalid',
  )
  expectAbsentCandidateRejection(
    (db) => db.exec('CREATE TABLE main.cdx_b2_intruder (id INTEGER)'),
    'governance_schema_invalid',
  )
  expectAbsentCandidateRejection(
    (db) => db.exec(CDX_B2_CREATE_STATEMENTS[0].replace(
      'main.cdx_b2_meta',
      'main.CDX_B2_META',
    )),
    'governance_schema_invalid',
  )
})

test('M2-B-03 partial B2 prevents otherwise-permitted historical M0/M1 repair', () => {
  const directory = mkdtempSync(join(tmpdir(), 'brain-b2-no-repair-'))
  const db = new DatabaseSync(join(directory, 'memory.sqlite'))
  try {
    seedHistoricalCdxSchema(db, 2)
    db.exec(CDX_B2_CREATE_STATEMENTS[0])
    const beforeColumns = db.prepare(
      "SELECT name FROM pragma_table_xinfo('memories') ORDER BY cid",
    ).all().map((row) => row.name)
    const beforeB2 = b2Inventory(db)

    assert.throws(
      () => bootstrap(db),
      assertGovernedCode('governance_schema_invalid'),
    )
    assert.deepEqual(
      db.prepare(
        "SELECT name FROM pragma_table_xinfo('memories') ORDER BY cid",
      ).all().map((row) => row.name),
      beforeColumns,
    )
    assert.deepEqual(migrationRows(db), [])
    assert.deepEqual(b2Inventory(db), beforeB2)
  } finally {
    if (db.isOpen) db.close()
    rmSync(directory, { force: true, recursive: true })
  }
})

function rewriteStoredSql(db, objectName, before, after) {
  db.exec('PRAGMA writable_schema = ON')
  const result = db.prepare(`
    UPDATE sqlite_schema
    SET sql = replace(sql, ?, ?)
    WHERE name = ?
  `).run(before, after, objectName)
  assert.equal(result.changes, 1)
  const version = db.prepare('PRAGMA schema_version').get().schema_version
  db.exec(`PRAGMA schema_version = ${version + 1}`)
  db.exec('PRAGMA writable_schema = OFF')
}

test('M2-B-03 verifier rejects altered SQL, TEMP triggers, wrong PRAGMAs, meta drift, and live projection drift', () => {
  const cases = [
    {
      code: 'governance_schema_invalid',
      mutate(db) {
        rewriteStoredSql(
          db,
          'cdx_b2_decisions_no_update',
          'BEFORE UPDATE',
          'BEFORE  UPDATE',
        )
      },
    },
    {
      code: 'governance_schema_invalid',
      mutate(db) {
        db.exec(`
          CREATE TEMP TRIGGER temp_b2_intruder
          BEFORE INSERT ON main.cdx_b2_decisions
          BEGIN SELECT 1; END
        `)
      },
    },
    {
      code: 'governance_config_invalid',
      mutateInLease(db) {
        db.exec('PRAGMA trusted_schema = ON')
      },
    },
    {
      code: 'governance_config_invalid',
      mutate(db) {
        const advance = CDX_B2_CREATE_STATEMENTS.find((sql) =>
          sql.startsWith('CREATE TRIGGER main.cdx_b2_meta_advance_guard'))
        assert.equal(typeof advance, 'string')
        db.exec('DROP TRIGGER cdx_b2_meta_advance_guard')
        db.exec('PRAGMA ignore_check_constraints = ON')
        db.exec("UPDATE cdx_b2_meta SET kernel_config_hash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'")
        db.exec('PRAGMA ignore_check_constraints = OFF')
        db.exec(advance)
      },
    },
    {
      code: 'governance_projection_invalid',
      mutate(db) {
        db.prepare('DELETE FROM memory_fts WHERE memory_id = ?').run(B2_MEMORY_IDS[0])
      },
    },
  ]

  for (const entry of cases) {
    const fixture = createCdxM1Fixture(0)
    try {
      bootstrap(fixture.db)
      if (entry.mutate !== undefined) entry.mutate(fixture.db)
      if (entry.mutateInLease === undefined) {
        assert.throws(() => verify(fixture.db), assertGovernedCode(entry.code))
      } else {
        const coordinator = createMutationCoordinator(fixture.db)
        assert.throws(() => coordinator.run((lease) => {
          entry.mutateInLease(fixture.db)
          return verifyCdxB2InTransaction(lease, fixture.db)
        }), assertGovernedCode(entry.code))
      }
    } finally {
      fixture.close()
    }
  }
})

function createCdxTempShadows(db) {
  db.exec(`
    CREATE TEMP VIEW memory_migrations AS
      SELECT * FROM main.memory_migrations;
    CREATE TEMP VIEW memories AS
      SELECT _rowid_ AS rowid, * FROM main.memories;
    CREATE TEMP VIEW memory_links AS
      SELECT * FROM main.memory_links;
    CREATE TEMP VIEW memory_fts AS
      SELECT
        _rowid_ AS rowid,
        id AS memory_id,
        palari_id,
        content,
        keywords
      FROM main.memories;
    CREATE TEMP VIEW memory_fts_config AS
      SELECT * FROM main.memory_fts_config;
  `)
}

test('M2-B-03 repair, snapshot, and verification remain main-scoped under TEMP shadows', () => {
  const complete = createCdxM1Fixture(0)
  try {
    bootstrap(complete.db)
    complete.db.prepare(
      'DELETE FROM main.memory_fts WHERE memory_id = ?',
    ).run(B2_MEMORY_IDS[0])
    assert.throws(
      () => verify(complete.db),
      assertGovernedCode('governance_projection_invalid'),
    )
    createCdxTempShadows(complete.db)
    assert.throws(
      () => verify(complete.db),
      assertGovernedCode('governance_projection_invalid'),
    )
  } finally {
    complete.close()
  }

  const freshDirectory = mkdtempSync(join(tmpdir(), 'brain-b2-main-create-'))
  const freshDb = new DatabaseSync(join(freshDirectory, 'memory.sqlite'))
  try {
    freshDb.exec(`
      CREATE TEMP TABLE memory_migrations(rogue TEXT);
      CREATE TEMP TABLE memories(rogue TEXT);
      CREATE TEMP TABLE memory_links(rogue TEXT);
      CREATE TEMP TABLE memory_fts(rogue TEXT);
      CREATE TEMP TABLE memory_fts_config(rogue TEXT);
    `)
    const state = bootstrap(freshDb)
    assertTask3State(state, { memoryCount: 0, linkCount: 0 })
    assert.deepEqual(
      migrationRows(freshDb).map(({ id }) => id),
      ['CDX-B2', 'CDX-M0', 'CDX-M1'],
    )
    assert.deepEqual(verify(freshDb), state)
  } finally {
    if (freshDb.isOpen) freshDb.close()
    rmSync(freshDirectory, { force: true, recursive: true })
  }

  const directory = mkdtempSync(join(tmpdir(), 'brain-b2-main-scope-'))
  const db = new DatabaseSync(join(directory, 'memory.sqlite'))
  try {
    seedHistoricalCdxSchema(db, 2)
    createCdxTempShadows(db)
    const state = bootstrap(db)
    assertTask3State(state, { memoryCount: 0, linkCount: 0 })
    assert.deepEqual(
      migrationRows(db).map(({ id }) => id),
      ['CDX-B2', 'CDX-M0', 'CDX-M1'],
    )
    assert.deepEqual(verify(db), state)
  } finally {
    if (db.isOpen) db.close()
    rmSync(directory, { force: true, recursive: true })
  }
})

test('M2-B-03 checkpoint immutability triggers reject raw update and delete', () => {
  const fixture = createCdxM1Fixture(0)
  try {
    bootstrap(fixture.db)
    assert.throws(
      () => fixture.db.exec(`
        UPDATE cdx_b2_legacy_checkpoint
        SET entity_id = entity_id
        WHERE checkpoint_ordinal = 1
      `),
      /cdx_b2_checkpoint_no_update/,
    )
    assert.throws(
      () => fixture.db.exec(`
        DELETE FROM cdx_b2_legacy_checkpoint
        WHERE checkpoint_ordinal = 1
      `),
      /cdx_b2_checkpoint_no_delete/,
    )
  } finally {
    fixture.close()
  }
})

const DECISION_INSERT_SQL = `
  INSERT INTO cdx_b2_decisions(
    sequence, stream_id, decision_id, patch_id, operation, patch_kind,
    patch_source, patch_priority, target_kind, target_id, visibility,
    authority_profile, authority_kind, authority_id, authority_ledger_id,
    authority_event_id, capability_id, palari_id, user_id, evidence_kind,
    evidence_strength, evidence_at, issued_at, effective_at, observed_at,
    expires_at, outcome, reason_code, failed_condition_mask, resolution,
    effect_count, kernel_config_hash
  ) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?, ?, ?, ?, ?
  )
`

function decisionValues(meta, sequence, ledgerId) {
  const digit = String(sequence)
  const uuid = `00000000-0000-4000-8000-00000000000${digit}`
  const observed = `2026-07-21T11:0${sequence}:00.000Z`
  return [
    sequence,
    meta.stream_id,
    `b2d_${uuid}`,
    `b2p_${uuid}`,
    'atom_erase',
    'ratify',
    'ratified_user',
    'provenance',
    'memory.atom',
    `mem_10000000-0000-4000-8000-00000000000${digit}`,
    'ledger',
    'host-checked-external-grant-v1',
    'user',
    'user-b2',
    ledgerId,
    `agr_${uuid}`,
    `cap_${uuid}`,
    'palari-b2',
    'user-b2',
    'ratified_user',
    1.0,
    observed,
    observed,
    observed,
    observed,
    '2026-07-21T12:00:00.000Z',
    'refused',
    'missing_target',
    0,
    'kept',
    0,
    meta.kernel_config_hash,
  ]
}

test('M2-B-03 schema binds the first committed ledger and rejects a reopened different ledger', () => {
  const fixture = createCdxM1Fixture(0, { withRows: false })
  try {
    bootstrap(fixture.db)
    const meta = fixture.db.prepare(
      'SELECT * FROM cdx_b2_meta WHERE singleton = 1',
    ).get()
    const ledgerA = 'led_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const ledgerB = 'led_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

    createMutationCoordinator(fixture.db).run(() => {
      fixture.db.prepare(DECISION_INSERT_SQL).run(
        ...decisionValues(meta, 1, ledgerA),
      )
      fixture.db.exec(`
        UPDATE cdx_b2_meta
        SET head_mutation_sequence = 1
        WHERE singleton = 1
      `)
    })
    assert.equal(
      fixture.db.prepare(
        'SELECT head_mutation_sequence FROM cdx_b2_meta',
      ).get().head_mutation_sequence,
      1,
    )

    assert.throws(
      () => createMutationCoordinator(fixture.db).run(() => {
        fixture.db.prepare(DECISION_INSERT_SQL).run(
          ...decisionValues(meta, 2, ledgerB),
        )
      }),
      /cdx_b2_decision_next_sequence/,
    )
    assert.equal(
      fixture.db.prepare('SELECT count(*) AS count FROM cdx_b2_decisions').get().count,
      1,
    )

    const rollback = new Error('roll back same-ledger probe')
    assert.throws(
      () => createMutationCoordinator(fixture.db).run(() => {
        fixture.db.prepare(DECISION_INSERT_SQL).run(
          ...decisionValues(meta, 2, ledgerA),
        )
        throw rollback
      }),
      (error) => error === rollback,
    )
    assert.equal(
      fixture.db.prepare('SELECT count(*) AS count FROM cdx_b2_decisions').get().count,
      1,
    )
  } finally {
    fixture.close()
  }
})

test('M2-B-03 a forced outer failure rolls back B2 and permitted ordinary M0/M1 completion together', () => {
  const directory = mkdtempSync(join(tmpdir(), 'brain-b2-atomic-repair-'))
  const dbPath = join(directory, 'memory.sqlite')
  const db = new DatabaseSync(dbPath)
  try {
    // A certified historical pre-fictional layout is missing the ordinary M1
    // additions and both markers. Bootstrap may repair it, but only inside
    // the same A1 transaction as the complete B2 checkpoint.
    seedHistoricalCdxSchema(db, 2)
    const before = db.prepare(
      'SELECT name FROM pragma_table_xinfo(\'memories\') ORDER BY cid',
    ).all().map((row) => row.name)
    const forced = new Error('forced post-bootstrap rollback')
    assert.throws(
      () => createMutationCoordinator(db).run((lease) => {
        bootstrapCdxB2InTransaction(
          lease,
          db,
          { workspaceId: B2_WORKSPACE_ID },
        )
        throw forced
      }),
      (error) => error === forced,
    )
    assert.deepEqual(b2Inventory(db), [])
    assert.deepEqual(migrationRows(db), [])
    assert.deepEqual(
      db.prepare(
        'SELECT name FROM pragma_table_xinfo(\'memories\') ORDER BY cid',
      ).all().map((row) => row.name),
      before,
    )
  } finally {
    if (db.isOpen) db.close()
    rmSync(directory, { force: true, recursive: true })
  }
})

test('M2-B-05 governed runtime accepts the exact three-row set and rejects B2 intruders', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'brain-b2-old-a2-open-'))
  const options = {
    memoryEnabled: true,
    memoryRootDir: directory,
    workspaceId: 'b2-old-a2-open',
  }
  let initial
  let db
  let dbPath
  try {
    initial = await createKernelStore(options)
    dbPath = initial.dbPath
    initial.close()
    initial = undefined

    db = new DatabaseSync(dbPath)
    assert.deepEqual(
      migrationRows(db).map((row) => row.id),
      ['CDX-B2', 'CDX-M0', 'CDX-M1'],
    )
    db.close()
    db = undefined

    initial = await createKernelStore(options)
    initial.close()
    initial = undefined

    db = new DatabaseSync(dbPath)
    db.exec(`
      CREATE INDEX main.unprefixed_b2_intruder
      ON cdx_b2_meta(workspace_id)
    `)
    db.close()
    db = undefined
    await assert.rejects(
      createKernelStore(options),
      (error) => {
        assert.equal(error?.code, 'governance_schema_invalid')
        return true
      },
    )

    db = new DatabaseSync(dbPath)
    db.exec('DROP INDEX main.unprefixed_b2_intruder')
    db.exec(`
      CREATE TABLE main.b2_fk_intruder(
        stream_id TEXT REFERENCES cdx_b2_meta(stream_id)
      )
    `)
    db.close()
    db = undefined
    await assert.rejects(
      createKernelStore(options),
      (error) => {
        assert.equal(error?.code, 'governance_schema_invalid')
        return true
      },
    )
  } finally {
    if (db?.isOpen) db.close()
    if (initial !== undefined) initial.close()
    rmSync(directory, { force: true, recursive: true })
  }
})

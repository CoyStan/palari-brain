// V2-M2-B Task 4 — complete stored-history and corruption falsifiers.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  GovernedMemoryError,
  advanceCdxB2HeadInTransaction,
  appendCdxB2TailInTransaction,
  bootstrapCdxB2InTransaction,
  verifyCdxB2InTransaction,
} from '../src/cdx-b2-journal.mjs'
import {
  CDX_B2_CREATE_STATEMENTS,
  CDX_B2_MANIFEST,
} from '../src/cdx-b2-schema.mjs'
import { createMutationCoordinator } from '../src/mutation-coordinator.mjs'
import {
  B2_MEMORY_IDS,
  B2_WORKSPACE_ID,
  b2Identifier,
  createB2Tail,
  createCdxM1Fixture,
  seedB2Memory,
} from './helpers/cdx-b2-fixtures.mjs'

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

function appendAndAdvance(db, tail, { erase = false } = {}) {
  return createMutationCoordinator(db).run((lease) => {
    appendCdxB2TailInTransaction(lease, db, tail)
    if (erase) {
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
}

function createRefusedHistory() {
  const fixture = createCdxM1Fixture(0)
  const initial = bootstrap(fixture.db)
  const tail = createB2Tail(initial, {
    sequence: 1,
    targetId: b2Identifier('mem_', 901),
    outcome: 'refused',
    reasonCode: 'missing_target',
  })
  const state = appendAndAdvance(fixture.db, tail)
  return { fixture, initial, state, tail }
}

function createAppliedHistory() {
  const fixture = createCdxM1Fixture(0, { withRows: false })
  const targetId = b2Identifier('mem_', 801)
  seedB2Memory(fixture.db, { id: targetId })
  const initial = bootstrap(fixture.db)
  const tail = createB2Tail(initial, {
    sequence: 1,
    targetId,
    outcome: 'applied',
    reasonCode: null,
  })
  const state = appendAndAdvance(fixture.db, tail, { erase: true })
  return { fixture, initial, state, tail, targetId }
}

function triggerStatement(name) {
  const prefix = `CREATE TRIGGER main.${name}`
  const statement = CDX_B2_CREATE_STATEMENTS.find((sql) =>
    sql.startsWith(prefix))
  assert.equal(typeof statement, 'string', `missing ${name}`)
  return statement
}

function corruptOneRow(db, table, guard, assignment, value, where) {
  db.exec('PRAGMA foreign_keys = OFF')
  db.exec(`DROP TRIGGER main.${guard}`)
  db.exec('PRAGMA ignore_check_constraints = ON')
  const result = db.prepare(`
    UPDATE main.${table}
    SET ${assignment} = ?
    WHERE ${where}
  `).run(value)
  assert.equal(result.changes, 1)
  db.exec('PRAGMA ignore_check_constraints = OFF')
  db.exec(triggerStatement(guard))
  db.exec('PRAGMA foreign_keys = ON')
}

function assertGovernedFailure(error) {
  assert.equal(error instanceof GovernedMemoryError, true)
  assert.match(error.code, /^governance_/)
  return true
}

function assertGovernedCode(code) {
  return (error) => {
    assert.equal(error instanceof GovernedMemoryError, true)
    assert.equal(error.code, code)
    return true
  }
}

function runLayoutMutationChild() {
  const childPath = fileURLToPath(new URL(
    './fixtures/cdx-b2-layout-mutation-child.mjs',
    import.meta.url,
  ))
  const result = spawnSync(process.execPath, [childPath], {
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  })
  assert.equal(
    result.status,
    0,
    `layout mutation child failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  )
  return JSON.parse(result.stdout)
}

const META_MUTATIONS = Object.freeze([
  ['singleton', 2],
  ['schema_version', 'CDX-B2-mutated'],
  ['kernel_profile', 'mutated-kernel'],
  ['projection_profile', 'mutated-projection'],
  ['authority_profile', 'mutated-authority'],
  ['stream_id', 'b2s_10000000-0000-4000-8000-000000000991'],
  ['head_mutation_sequence', 2],
  ['workspace_id', 'Invalid Workspace'],
  ['checkpoint_id', 'invalid-checkpoint-id'],
  ['checkpoint_at', '2026-07-21T10:00:01.000Z'],
  ['checkpoint_memory_count', 4],
  ['checkpoint_link_count', 3],
  ['baseline_disposition', 'mutated'],
  ['legacy_schema_variant', 'mutated-layout'],
  ['kernel_version', 'mutated-version'],
  ['kernel_source_commit', 'mutated-commit'],
  ['kernel_source_blob', 'mutated-blob'],
  ['kernel_config_hash', 'a'.repeat(64)],
])

const CHECKPOINT_MUTATIONS = Object.freeze([
  ['checkpoint_ordinal', 99],
  ['stream_id', 'b2s_10000000-0000-4000-8000-000000000992'],
  ['entity_kind', 'link'],
  ['entity_id', 'mutated-entity-id'],
  ['palari_id', null],
  ['user_id', 'mutated-user'],
  ['memory_type', 'mutated-type'],
  ['shared', 2],
  ['validity_state', 'mutated-validity'],
  ['from_memory_id', B2_MEMORY_IDS[1]],
  ['to_memory_id', B2_MEMORY_IDS[2]],
])

const DECISION_MUTATIONS = Object.freeze([
  ['sequence', 7],
  ['stream_id', 'b2s_10000000-0000-4000-8000-000000000993'],
  ['decision_id', 'invalid-decision-id'],
  ['patch_id', 'invalid-patch-id'],
  ['operation', 'mutated-operation'],
  ['patch_kind', 'mutated-kind'],
  ['patch_source', 'mutated-source'],
  ['patch_priority', 'mutated-priority'],
  ['target_kind', 'mutated-target-kind'],
  ['target_id', 'invalid-target-id'],
  ['visibility', 'mutated-visibility'],
  ['authority_profile', 'mutated-authority-profile'],
  ['authority_kind', 'mutated-authority-kind'],
  ['authority_id', 'other-user'],
  ['authority_ledger_id', 'invalid-ledger-id'],
  ['authority_event_id', 'invalid-event-id'],
  ['capability_id', 'invalid-capability-id'],
  ['palari_id', 'Invalid-Palari'],
  ['user_id', 'Invalid-User'],
  ['evidence_kind', 'mutated-evidence'],
  ['evidence_strength', 0.5],
  ['evidence_at', 'invalid-evidence-time'],
  ['issued_at', 'invalid-issued-time'],
  ['effective_at', 'invalid-effective-time'],
  ['observed_at', 'invalid-observed-time'],
  ['expires_at', 'invalid-expiry-time'],
  ['outcome', 'applied'],
  ['reason_code', 'scope_mismatch'],
  ['failed_condition_mask', 1],
  ['resolution', 'dropped'],
  ['effect_count', 2],
  ['kernel_config_hash', 'a'.repeat(64)],
])

const EFFECT_MUTATIONS = Object.freeze([
  ['decision_sequence', 7],
  ['effect_ordinal', 7],
  ['effect_kind', 'mutated-effect-kind'],
  ['object_id', 'invalid-object-id'],
])

test('M2-B-04 complete verifier rejects an invariant-breaking mutation of every persisted B2 field', async (t) => {
  for (const [field, value] of META_MUTATIONS) {
    await t.test(`meta.${field}`, () => {
      const { fixture } = createRefusedHistory()
      try {
        corruptOneRow(
          fixture.db,
          'cdx_b2_meta',
          'cdx_b2_meta_advance_guard',
          field,
          value,
          'singleton = 1',
        )
        assert.throws(() => verify(fixture.db), assertGovernedFailure)
      } finally {
        fixture.close()
      }
    })
  }

  for (const [field, value] of CHECKPOINT_MUTATIONS) {
    await t.test(`checkpoint.${field}`, () => {
      const { fixture } = createRefusedHistory()
      try {
        corruptOneRow(
          fixture.db,
          'cdx_b2_legacy_checkpoint',
          'cdx_b2_checkpoint_no_update',
          field,
          value,
          'checkpoint_ordinal = 1',
        )
        assert.throws(() => verify(fixture.db), assertGovernedFailure)
      } finally {
        fixture.close()
      }
    })
  }

  for (const [field, value] of DECISION_MUTATIONS) {
    await t.test(`decision.${field}`, () => {
      const { fixture } = createRefusedHistory()
      try {
        corruptOneRow(
          fixture.db,
          'cdx_b2_decisions',
          'cdx_b2_decisions_no_update',
          field,
          value,
          'sequence = 1',
        )
        assert.throws(() => verify(fixture.db), assertGovernedFailure)
      } finally {
        fixture.close()
      }
    })
  }

  for (const [field, value] of EFFECT_MUTATIONS) {
    await t.test(`effect.${field}`, () => {
      const { fixture } = createAppliedHistory()
      try {
        corruptOneRow(
          fixture.db,
          'cdx_b2_effects',
          'cdx_b2_effects_no_update',
          field,
          value,
          'effect_ordinal = 0',
        )
        assert.throws(() => verify(fixture.db), assertGovernedFailure)
      } finally {
        fixture.close()
      }
    })
  }
})

function spoofStoredSql(db, name) {
  db.exec('PRAGMA writable_schema = ON')
  const result = db.prepare(`
    UPDATE main.sqlite_schema
    SET sql = sql || ' /* m2-b-04-mutated */'
    WHERE name = ? AND sql IS NOT NULL
  `).run(name)
  assert.equal(result.changes, 1)
  const version = db.prepare('PRAGMA schema_version').get().schema_version
  db.exec(`PRAGMA schema_version = ${version + 1}`)
  db.exec('PRAGMA writable_schema = OFF')
}

test('M2-B-04 every named B2 table, index, and trigger SQL mutation fails in layout before use', async (t) => {
  for (const object of CDX_B2_MANIFEST.objects) {
    await t.test(`${object.type}:${object.name}`, () => {
      const fixture = createCdxM1Fixture(0, { withRows: false })
      try {
        bootstrap(fixture.db)
        spoofStoredSql(fixture.db, object.name)
        assert.throws(
          () => verify(fixture.db),
          assertGovernedCode('governance_schema_invalid'),
        )
      } finally {
        fixture.close()
      }
    })
  }
})

test('M2-B-04 every index-list, index-xinfo, and FK verifier branch fails on a mutated native row', () => {
  const indexNames = [
    'sqlite_autoindex_cdx_b2_meta_1',
    'sqlite_autoindex_cdx_b2_meta_2',
    'sqlite_autoindex_cdx_b2_legacy_checkpoint_1',
    'cdx_b2_applied_erase_target_unique',
    'sqlite_autoindex_cdx_b2_decisions_1',
    'sqlite_autoindex_cdx_b2_decisions_2',
    'sqlite_autoindex_cdx_b2_decisions_3',
    'sqlite_autoindex_cdx_b2_decisions_4',
    'sqlite_autoindex_cdx_b2_effects_1',
  ]
  const expectedLabels = []
  for (const name of indexNames) {
    expectedLabels.push(`index-list:${name}`)
    expectedLabels.push(`index-xinfo:${name}`)
  }
  expectedLabels.push(
    'foreign-key:cdx_b2_legacy_checkpoint:stream_id',
    'foreign-key:cdx_b2_decisions:stream_id',
    'foreign-key:cdx_b2_effects:decision_sequence',
  )

  const results = runLayoutMutationChild()
  assert.deepEqual(results.map(({ label }) => label), expectedLabels)
  for (const result of results) {
    assert.equal(result.matchCount, 1, `${result.label}: mutation count`)
    assert.equal(
      result.code,
      'governance_schema_invalid',
      `${result.label}: error code`,
    )
  }
})

test('M2-B-04 raw immutability guards reject update/delete on all four B2 tables', () => {
  const { fixture } = createAppliedHistory()
  try {
    const probes = [
      [
        'UPDATE main.cdx_b2_meta SET stream_id = stream_id WHERE singleton = 1',
        /cdx_b2_meta_advance_guard/,
      ],
      [
        'DELETE FROM main.cdx_b2_meta WHERE singleton = 1',
        /cdx_b2_meta_no_delete/,
      ],
      [
        'UPDATE main.cdx_b2_legacy_checkpoint SET entity_id = entity_id WHERE checkpoint_ordinal = 1',
        /cdx_b2_checkpoint_no_update/,
      ],
      [
        'DELETE FROM main.cdx_b2_legacy_checkpoint WHERE checkpoint_ordinal = 1',
        /cdx_b2_checkpoint_no_delete/,
      ],
      [
        'UPDATE main.cdx_b2_decisions SET decision_id = decision_id WHERE sequence = 1',
        /cdx_b2_decisions_no_update/,
      ],
      [
        'DELETE FROM main.cdx_b2_decisions WHERE sequence = 1',
        /cdx_b2_decisions_no_delete/,
      ],
      [
        'UPDATE main.cdx_b2_effects SET object_id = object_id WHERE decision_sequence = 1',
        /cdx_b2_effects_no_update/,
      ],
      [
        'DELETE FROM main.cdx_b2_effects WHERE decision_sequence = 1',
        /cdx_b2_effects_no_delete/,
      ],
    ]
    for (const [sql, pattern] of probes) {
      assert.throws(() => fixture.db.exec(sql), pattern)
    }
  } finally {
    fixture.close()
  }
})

test('M2-B-04 committed unheaded tail, missing tail, and config drift all fail closed', () => {
  const fixture = createCdxM1Fixture(0, { withRows: false })
  try {
    const state = bootstrap(fixture.db)
    const tail = createB2Tail(state, {
      targetId: b2Identifier('mem_', 997),
      outcome: 'refused',
      reasonCode: 'missing_target',
    })
    createMutationCoordinator(fixture.db).run((lease) => {
      appendCdxB2TailInTransaction(lease, fixture.db, tail)
    })
    assert.throws(
      () => verify(fixture.db),
      assertGovernedCode('governance_journal_invalid'),
    )
  } finally {
    fixture.close()
  }

  const missing = createCdxM1Fixture(0, { withRows: false })
  try {
    bootstrap(missing.db)
    corruptOneRow(
      missing.db,
      'cdx_b2_meta',
      'cdx_b2_meta_advance_guard',
      'head_mutation_sequence',
      1,
      'singleton = 1',
    )
    assert.throws(
      () => verify(missing.db),
      assertGovernedCode('governance_journal_invalid'),
    )
  } finally {
    missing.close()
  }

  const config = createRefusedHistory()
  try {
    corruptOneRow(
      config.fixture.db,
      'cdx_b2_decisions',
      'cdx_b2_decisions_no_update',
      'kernel_config_hash',
      'a'.repeat(64),
      'sequence = 1',
    )
    assert.throws(
      () => verify(config.fixture.db),
      assertGovernedCode('governance_journal_invalid'),
    )
  } finally {
    config.fixture.close()
  }
})

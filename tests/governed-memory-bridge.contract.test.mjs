// V2-M2-B Task 5 — governed production bridge and ratified erasure.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import * as bridgeModule from '../src/governed-memory-bridge.mjs'
import { GovernedMemoryError as JournalGovernedMemoryError } from '../src/cdx-b2-journal.mjs'
import { initializeMemoryBundle } from '../src/memory-bundle-apply.mjs'
import {
  MemoryAuthorityError,
  createMemoryAuthorityRoot,
  issueMemoryAuthorityGrant,
} from '../src/memory-authority.mjs'
import {
  B2_DECISION_KEYS,
  B2_EFFECT_KEYS,
  B2_KERNEL_CONFIG_HASH,
  b2Identifier,
  createCdxM1Fixture,
  migrationRows,
  readB2Rows,
  seedB2Link,
  seedB2Memory,
} from './helpers/cdx-b2-fixtures.mjs'

const {
  GovernedMemoryError,
  createGovernedMemoryBridge,
} = bridgeModule

const WORKSPACE_ID = 'bridge-workspace'
const PALARI_ID = 'palari_bridge'
const USER_ID = 'user_bridge'
const LEDGER_ID = b2Identifier('led_', 501)
const EVIDENCE_AT = '2000-01-01T00:00:00.000Z'
const EXPIRES_AT = '2999-01-01T00:00:00.000Z'

const MEMORY_KEYS = Object.freeze([
  'id',
  'palari_id',
  'user_id',
  'type',
  'content',
  'keywords',
  'importance',
  'valid_from',
  'valid_until',
  'access_count',
  'last_accessed',
  'created_at',
  'shared',
  'confidence',
  'acquisition_mode',
  'created_by_pipeline',
  'fictional',
  'last_decayed_at',
  'source_message_id',
  'content_hash',
  'source_kind',
  'extractor',
])

const STATIC_REFUSALS = Object.freeze([
  Object.freeze([
    'legacy_proposal',
    Object.freeze({
      outcome: 'rejected',
      reasons: Object.freeze(['governance_refused']),
    }),
  ]),
  Object.freeze([
    'legacy_forget_topic',
    Object.freeze({ count: 0, deleted: Object.freeze([]) }),
  ]),
  Object.freeze([
    'legacy_record_recall_inclusion',
    Object.freeze({ touched: Object.freeze([]), touchedCount: 0 }),
  ]),
  Object.freeze([
    'legacy_run_lifecycle',
    Object.freeze({ decayed: 0, deleted: 0, skipped: 0, touched: 0 }),
  ]),
])

function rootInput(checkGrantActive = () => true) {
  return {
    workspaceId: WORKSPACE_ID,
    palariId: PALARI_ID,
    userId: USER_ID,
    authorityLedgerId: LEDGER_ID,
    checkGrantActive,
  }
}

function grantInput(targetId, ordinal) {
  return {
    authorityEventId: b2Identifier('agr_', ordinal),
    capabilityId: b2Identifier('cap_', ordinal),
    evidenceAt: EVIDENCE_AT,
    expiresAt: EXPIRES_AT,
    targetId,
    verb: 'erase_atom',
  }
}

function bridgeInput(authorityRoot) {
  return { workspaceId: WORKSPACE_ID, authorityRoot }
}

function createTrapValue() {
  let calls = 0
  const trap = function trap() {
    calls += 1
    throw new Error('caller trap must not run')
  }
  return {
    get calls() {
      return calls
    },
    value: new Proxy({}, {
      get: trap,
      getOwnPropertyDescriptor: trap,
      getPrototypeOf: trap,
      ownKeys: trap,
    }),
  }
}

function scalar(db, sql, parameter) {
  return db.prepare(sql).get(parameter).value
}

function snapshotB1(db) {
  return {
    atoms: db.prepare(`
      SELECT * FROM main.memory_bundle_atoms ORDER BY memory_id COLLATE BINARY
    `).all(),
    events: db.prepare(`
      SELECT * FROM main.memory_bundle_events ORDER BY sequence
    `).all(),
    meta: db.prepare(`
      SELECT * FROM main.memory_bundle_meta ORDER BY singleton
    `).all(),
  }
}

function assertCanonicalTimestamp(value) {
  assert.equal(typeof value, 'string')
  assert.equal(new Date(Date.parse(value)).toISOString(), value)
}

function assertAuthorityCode(callback, code) {
  assert.throws(callback, (error) => {
    assert.equal(error instanceof MemoryAuthorityError, true)
    assert.equal(error.name, 'MemoryAuthorityError')
    assert.equal(error.code, code)
    return true
  })
}

function assertBurnedWithoutCallerCapture(
  bridge,
  grant,
  expectedDecisionCount = 1,
  db,
) {
  const hostileId = createTrapValue()
  const hostileOptions = createTrapValue()
  assertAuthorityCode(
    () => bridge.erase(hostileId.value, hostileOptions.value, grant),
    'authority_grant_unavailable',
  )
  assert.equal(hostileId.calls, 0)
  assert.equal(hostileOptions.calls, 0)
  assert.equal(
    db.prepare('SELECT count(*) AS value FROM main.cdx_b2_decisions').get().value,
    expectedDecisionCount,
  )
}

function assertDecision(
  fixture,
  {
    activity,
    effectCount,
    outcome,
    reasonCode,
    targetId,
  },
) {
  const rows = readB2Rows(fixture.db)
  assert.equal(rows.cdx_b2_meta.length, 1)
  assert.equal(rows.cdx_b2_meta[0].head_mutation_sequence, 1)
  assert.equal(rows.cdx_b2_decisions.length, 1)
  assert.equal(rows.cdx_b2_effects.length, effectCount)

  const decision = rows.cdx_b2_decisions[0]
  assert.deepEqual(Object.keys(decision), B2_DECISION_KEYS)
  assert.equal(decision.sequence, 1)
  assert.equal(decision.stream_id, rows.cdx_b2_meta[0].stream_id)
  assert.match(
    decision.decision_id,
    /^b2d_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  )
  assert.match(
    decision.patch_id,
    /^b2p_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  )
  assert.equal(decision.operation, 'atom_erase')
  assert.equal(decision.patch_kind, 'ratify')
  assert.equal(decision.patch_source, 'ratified_user')
  assert.equal(decision.patch_priority, 'provenance')
  assert.equal(decision.target_kind, 'memory.atom')
  assert.equal(decision.target_id, targetId)
  assert.equal(decision.visibility, 'ledger')
  assert.equal(decision.authority_profile, 'host-checked-external-grant-v1')
  assert.equal(decision.authority_kind, 'user')
  assert.equal(decision.authority_id, USER_ID)
  assert.equal(decision.authority_ledger_id, LEDGER_ID)
  assert.equal(decision.authority_event_id, activity.authorityEventId)
  assert.equal(decision.capability_id, activity.capabilityId)
  assert.equal(decision.palari_id, PALARI_ID)
  assert.equal(decision.user_id, USER_ID)
  assert.equal(decision.evidence_kind, 'ratified_user')
  assert.equal(decision.evidence_strength, 1)
  assert.equal(decision.evidence_at, EVIDENCE_AT)
  assert.equal(decision.issued_at, activity.issuedAt)
  assert.equal(decision.effective_at, decision.observed_at)
  assertCanonicalTimestamp(decision.observed_at)
  assert.equal(decision.expires_at, EXPIRES_AT)
  assert.equal(decision.outcome, outcome)
  assert.equal(decision.reason_code, reasonCode)
  assert.equal(decision.failed_condition_mask, 0)
  assert.equal(decision.resolution, 'kept')
  assert.equal(decision.effect_count, effectCount)
  assert.equal(decision.kernel_config_hash, B2_KERNEL_CONFIG_HASH)
  assert.ok(decision.evidence_at <= decision.issued_at)
  assert.ok(decision.issued_at <= decision.observed_at)
  assert.ok(decision.observed_at < decision.expires_at)
  return { decision, rows }
}

function createBoundScenario({ seed } = {}) {
  const fixture = createCdxM1Fixture(0, { withRows: false })
  if (seed !== undefined) seed(fixture.db)
  let activity = null
  const root = createMemoryAuthorityRoot(rootInput((value) => {
    activity = value
    return true
  }))
  let bridge
  try {
    bridge = createGovernedMemoryBridge(fixture.db, bridgeInput(root))
  } catch (error) {
    fixture.close()
    throw error
  }
  return {
    bridge,
    fixture,
    root,
    activity() {
      return activity
    },
    close() {
      try {
        bridge.close()
      } finally {
        fixture.close()
      }
    },
  }
}

test('M2-B-05 bridge module and returned capability surfaces are exact', () => {
  assert.deepEqual(Object.keys(bridgeModule), [
    'GovernedMemoryError',
    'createGovernedMemoryBridge',
  ])
  assert.equal(GovernedMemoryError, JournalGovernedMemoryError)

  const fixture = createCdxM1Fixture(0, { withRows: false })
  let bridge
  try {
    bridge = createGovernedMemoryBridge(fixture.db, bridgeInput(undefined))
    assert.equal(Object.getPrototypeOf(bridge), Object.prototype)
    assert.equal(Object.isFrozen(bridge), true)
    assert.deepEqual(Reflect.ownKeys(bridge), ['close', 'erase', 'refuse'])
    for (const key of Reflect.ownKeys(bridge)) {
      assert.deepEqual(Object.getOwnPropertyDescriptor(bridge, key), {
        value: bridge[key],
        enumerable: true,
        configurable: false,
        writable: false,
      })
      assert.equal(typeof bridge[key], 'function')
    }

    for (const [routeKind, expected] of STATIC_REFUSALS) {
      assert.deepEqual(Reflect.apply(bridge.refuse, null, [routeKind]), expected)
    }
    assert.throws(
      () => bridge.refuse('legacy_delete_memory'),
      (error) => error instanceof GovernedMemoryError &&
        error.code === 'governance_invalid_argument',
    )
    assert.equal(readB2Rows(fixture.db).cdx_b2_decisions.length, 0)
  } finally {
    if (bridge !== undefined) bridge.close()
    fixture.close()
  }
})

test('M2-B-05 construction atomically bootstraps B2, binds one root, and close retires it', () => {
  const scenario = createBoundScenario()
  try {
    const rows = readB2Rows(scenario.fixture.db)
    assert.equal(rows.cdx_b2_meta.length, 1)
    assert.equal(rows.cdx_b2_meta[0].workspace_id, WORKSPACE_ID)
    assert.equal(rows.cdx_b2_meta[0].head_mutation_sequence, 0)
    assert.equal(rows.cdx_b2_meta[0].checkpoint_memory_count, 0)
    assert.equal(rows.cdx_b2_meta[0].checkpoint_link_count, 0)
    assert.deepEqual(rows.cdx_b2_decisions, [])
    assert.deepEqual(rows.cdx_b2_effects, [])
    assert.deepEqual(
      migrationRows(scenario.fixture.db).map((row) => row.id),
      ['CDX-B2', 'CDX-M0', 'CDX-M1'],
    )

    const grant = issueMemoryAuthorityGrant(
      scenario.root,
      grantInput(b2Identifier('mem_', 510), 510),
    )
    assert.equal(Object.getPrototypeOf(grant), null)
    assert.deepEqual(Reflect.ownKeys(grant), [])

    const detachedClose = scenario.bridge.close
    assert.equal(Reflect.apply(detachedClose, { wrong: 'receiver' }, []), undefined)
    assert.equal(detachedClose(), undefined)
    assertAuthorityCode(
      () => issueMemoryAuthorityGrant(
        scenario.root,
        grantInput(b2Identifier('mem_', 511), 511),
      ),
      'authority_root_revoked',
    )
    assert.throws(
      () => scenario.bridge.erase('ignored', undefined, grant),
      (error) => error?.code === 'legacy_store_closed',
    )
  } finally {
    scenario.close()
  }
})

test('M2-B-05 rootless and bound missing-authority refusal is trap-free and writes no decision', () => {
  for (const withRoot of [false, true]) {
    const fixture = createCdxM1Fixture(0, { withRows: false })
    const root = withRoot ? createMemoryAuthorityRoot(rootInput()) : undefined
    let bridge
    try {
      bridge = createGovernedMemoryBridge(fixture.db, bridgeInput(root))
      const hostileId = createTrapValue()
      const hostileOptions = createTrapValue()
      assert.deepEqual(
        bridge.erase(hostileId.value, hostileOptions.value, undefined),
        { deleted: false, reason: 'governance_refused' },
      )
      assert.equal(hostileId.calls, 0)
      assert.equal(hostileOptions.calls, 0)
      assert.equal(readB2Rows(fixture.db).cdx_b2_decisions.length, 0)
      assert.equal(readB2Rows(fixture.db).cdx_b2_effects.length, 0)
    } finally {
      if (bridge !== undefined) bridge.close()
      fixture.close()
    }
  }
})

test('M2-B-05 one ratified private zero-link erasure co-commits exact receipts and projection', () => {
  const targetId = b2Identifier('mem_', 520)
  const scenario = createBoundScenario({
    seed(db) {
      seedB2Memory(db, {
        id: targetId,
        palariId: PALARI_ID,
        userId: USER_ID,
        memoryType: 'preference',
        content: 'detached applied result',
        keywords: 'detached applied',
        shared: 0,
      })
    },
  })
  try {
    const grant = issueMemoryAuthorityGrant(
      scenario.root,
      grantInput(targetId, 520),
    )
    const result = scenario.bridge.erase(
      targetId,
      { actor: 'explicit_user_action' },
      grant,
    )
    assert.deepEqual(Object.keys(result), ['deleted', 'memory', 'reason'])
    assert.equal(result.deleted, true)
    assert.equal(result.reason, 'deleted')
    assert.deepEqual(Object.keys(result.memory), MEMORY_KEYS)
    assert.equal(result.memory.id, targetId)
    assert.equal(result.memory.palari_id, PALARI_ID)
    assert.equal(result.memory.user_id, USER_ID)
    assert.equal(result.memory.content, 'detached applied result')

    const { decision, rows } = assertDecision(scenario.fixture, {
      activity: scenario.activity(),
      effectCount: 2,
      outcome: 'applied',
      reasonCode: null,
      targetId,
    })
    assert.deepEqual(rows.cdx_b2_effects, [
      {
        decision_sequence: decision.sequence,
        effect_ordinal: 0,
        effect_kind: 'projection_atom_erased',
        object_id: targetId,
      },
      {
        decision_sequence: decision.sequence,
        effect_ordinal: 1,
        effect_kind: 'projection_fts_erased',
        object_id: targetId,
      },
    ])
    for (const effect of rows.cdx_b2_effects) {
      assert.deepEqual(Object.keys(effect), B2_EFFECT_KEYS)
    }
    assert.equal(
      scalar(
        scenario.fixture.db,
        'SELECT count(*) AS value FROM main.memories WHERE id = ?',
        targetId,
      ),
      0,
    )
    assert.equal(
      scalar(
        scenario.fixture.db,
        'SELECT count(*) AS value FROM main.memory_fts WHERE memory_id = ?',
        targetId,
      ),
      0,
    )
    assert.equal(result.memory.content, 'detached applied result')
    assertBurnedWithoutCallerCapture(
      scenario.bridge,
      grant,
      1,
      scenario.fixture.db,
    )
  } finally {
    scenario.close()
  }
})

test('M2-B-05 valid B2 erasure leaves initialized B1 table rows unchanged', () => {
  const targetId = b2Identifier('mem_', 521)
  const scenario = createBoundScenario({
    seed(db) {
      seedB2Memory(db, {
        id: targetId,
        palariId: PALARI_ID,
        userId: USER_ID,
        memoryType: 'preference',
        content: 'B1 coexistence erasure canary',
        keywords: 'b1 coexistence canary',
        shared: 0,
      })
    },
  })
  try {
    assert.equal(initializeMemoryBundle(scenario.fixture.db, {
      clock: () => new Date('2026-07-22T00:00:00.000Z'),
      idFactory: () => '00000000-0000-4000-8000-000000000521',
    }), undefined)
    const b1Before = snapshotB1(scenario.fixture.db)
    const grant = issueMemoryAuthorityGrant(
      scenario.root,
      grantInput(targetId, 521),
    )
    assert.equal(
      scenario.bridge.erase(targetId, undefined, grant).deleted,
      true,
    )
    assert.deepEqual(snapshotB1(scenario.fixture.db), b1Before)
    assert.equal(
      scalar(
        scenario.fixture.db,
        'SELECT count(*) AS value FROM main.memories WHERE id = ?',
        targetId,
      ),
      0,
    )
    assertDecision(scenario.fixture, {
      activity: scenario.activity(),
      effectCount: 2,
      outcome: 'applied',
      reasonCode: null,
      targetId,
    })
  } finally {
    scenario.close()
  }
})

test('M2-B-05 a valid grant commits missing-target refusal, burns, and stays effect-free', () => {
  const targetId = b2Identifier('mem_', 530)
  const scenario = createBoundScenario()
  try {
    const grant = issueMemoryAuthorityGrant(
      scenario.root,
      grantInput(targetId, 530),
    )
    assert.deepEqual(
      scenario.bridge.erase(targetId, undefined, grant),
      { deleted: false, reason: 'not_found' },
    )
    assertDecision(scenario.fixture, {
      activity: scenario.activity(),
      effectCount: 0,
      outcome: 'refused',
      reasonCode: 'missing_target',
      targetId,
    })
    assertBurnedWithoutCallerCapture(
      scenario.bridge,
      grant,
      1,
      scenario.fixture.db,
    )
  } finally {
    scenario.close()
  }
})

for (const refusal of [
  {
    name: 'scope',
    ordinal: 540,
    reasonCode: 'scope_mismatch',
    seed(db, targetId) {
      seedB2Memory(db, {
        id: targetId,
        palariId: 'other_palari',
        userId: USER_ID,
        shared: 0,
      })
    },
  },
  {
    name: 'shared',
    ordinal: 550,
    reasonCode: 'shared_scope_unsealed',
    seed(db, targetId) {
      seedB2Memory(db, {
        id: targetId,
        palariId: PALARI_ID,
        userId: USER_ID,
        shared: 1,
      })
    },
  },
  {
    name: 'incident-link',
    ordinal: 560,
    reasonCode: 'incident_edges_unemittable',
    seed(db, targetId) {
      const otherId = b2Identifier('mem_', 561)
      seedB2Memory(db, {
        id: targetId,
        palariId: PALARI_ID,
        userId: USER_ID,
        shared: 0,
      })
      seedB2Memory(db, {
        id: otherId,
        palariId: PALARI_ID,
        userId: USER_ID,
        shared: 0,
      })
      seedB2Link(db, {
        id: b2Identifier('lnk_', 560),
        fromMemoryId: targetId,
        toMemoryId: otherId,
        relation: 'bridge-refusal-canary',
      })
    },
  },
]) {
  test(`M2-B-05 a valid grant commits ${refusal.name} refusal without projection effects`, () => {
    const targetId = b2Identifier('mem_', refusal.ordinal)
    const scenario = createBoundScenario({
      seed(db) {
        refusal.seed(db, targetId)
      },
    })
    try {
      const linksBefore = scenario.fixture.db.prepare(`
        SELECT id, from_memory_id, to_memory_id, relation, created_at
        FROM main.memory_links
        ORDER BY id COLLATE BINARY
      `).all().map((row) => ({ ...row }))
      const grant = issueMemoryAuthorityGrant(
        scenario.root,
        grantInput(targetId, refusal.ordinal),
      )
      assert.deepEqual(
        scenario.bridge.erase(
          targetId,
          { actor: 'explicit_user_action' },
          grant,
        ),
        { deleted: false, reason: 'governance_refused' },
      )
      assertDecision(scenario.fixture, {
        activity: scenario.activity(),
        effectCount: 0,
        outcome: 'refused',
        reasonCode: refusal.reasonCode,
        targetId,
      })
      assert.equal(
        scalar(
          scenario.fixture.db,
          'SELECT count(*) AS value FROM main.memories WHERE id = ?',
          targetId,
        ),
        1,
      )
      assert.equal(
        scalar(
          scenario.fixture.db,
          'SELECT count(*) AS value FROM main.memory_fts WHERE memory_id = ?',
          targetId,
        ),
        1,
      )
      assert.deepEqual(
        scenario.fixture.db.prepare(`
          SELECT id, from_memory_id, to_memory_id, relation, created_at
          FROM main.memory_links
          ORDER BY id COLLATE BINARY
        `).all().map((row) => ({ ...row })),
        linksBefore,
      )
      assertBurnedWithoutCallerCapture(
        scenario.bridge,
        grant,
        1,
        scenario.fixture.db,
      )
    } finally {
      scenario.close()
    }
  })
}

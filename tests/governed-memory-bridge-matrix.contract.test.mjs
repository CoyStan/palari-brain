// V2-M2-B Task 5 — target, capture, and caller-label production matrix.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  GovernedMemoryError,
  createGovernedMemoryBridge,
} from '../src/governed-memory-bridge.mjs'
import {
  MemoryAuthorityError,
  createMemoryAuthorityRoot,
  issueMemoryAuthorityGrant,
} from '../src/memory-authority.mjs'
import {
  b2Identifier,
  createCdxM1Fixture,
  readB2Rows,
  seedB2Link,
  seedB2Memory,
} from './helpers/cdx-b2-fixtures.mjs'

const WORKSPACE_ID = 'bridge-matrix-workspace'
const PALARI_ID = 'palari_matrix'
const USER_ID = 'user_matrix'
const OTHER_PALARI_ID = 'other_palari'
const OTHER_USER_ID = 'other_user'
const LEDGER_ID = b2Identifier('led_', 901)
const EVIDENCE_AT = '2000-01-01T00:00:00.000Z'
const EXPIRES_AT = '2999-01-01T00:00:00.000Z'
const ENDED_AT = '2026-07-22T10:00:00.000Z'

const ACTORS = Object.freeze([
  'explicit_user_action',
  'background_extraction',
  'session_summary',
  'lifecycle_job',
])

const PARTITIONS = Object.freeze([
  Object.freeze({ name: 'permanent', type: 'preference' }),
  Object.freeze({ name: 'transient', type: 'working' }),
])

const VALIDITIES = Object.freeze([
  Object.freeze({ name: 'current', validUntil: null }),
  Object.freeze({ name: 'ended', validUntil: ENDED_AT }),
])

const SCOPES = Object.freeze([
  Object.freeze({
    name: 'own-private',
    palariId: PALARI_ID,
    reason: null,
    shared: 0,
    userId: USER_ID,
  }),
  Object.freeze({
    name: 'general',
    palariId: PALARI_ID,
    reason: 'scope_mismatch',
    shared: 0,
    userId: null,
  }),
  Object.freeze({
    name: 'shared',
    palariId: PALARI_ID,
    reason: 'shared_scope_unsealed',
    shared: 1,
    userId: USER_ID,
  }),
  Object.freeze({
    name: 'cross-user',
    palariId: PALARI_ID,
    reason: 'scope_mismatch',
    shared: 0,
    userId: OTHER_USER_ID,
  }),
  Object.freeze({
    name: 'cross-palari',
    palariId: OTHER_PALARI_ID,
    reason: 'scope_mismatch',
    shared: 0,
    userId: USER_ID,
  }),
])

function rootInput(checkGrantActive, ledgerId = LEDGER_ID) {
  return {
    workspaceId: WORKSPACE_ID,
    palariId: PALARI_ID,
    userId: USER_ID,
    authorityLedgerId: ledgerId,
    checkGrantActive,
  }
}

function grantInput(targetId, ordinal) {
  return {
    authorityEventId: b2Identifier('agr_', 3000 + ordinal),
    capabilityId: b2Identifier('cap_', 3000 + ordinal),
    evidenceAt: EVIDENCE_AT,
    expiresAt: EXPIRES_AT,
    targetId,
    verb: 'erase_atom',
  }
}

function createBridge(db, root) {
  return createGovernedMemoryBridge(db, {
    workspaceId: WORKSPACE_ID,
    authorityRoot: root,
  })
}

function closeScenario(bridge, fixture) {
  try {
    if (bridge !== undefined) bridge.close()
  } finally {
    fixture.close()
  }
}

function count(db, table) {
  return db.prepare(`SELECT count(*) AS value FROM main.${table}`).get().value
}

function targetCount(db, table, targetId) {
  const column = table === 'memories' ? 'id' : 'memory_id'
  return db.prepare(
    `SELECT count(*) AS value FROM main.${table} WHERE ${column} = ?`,
  ).get(targetId).value
}

function linkRows(db) {
  return db.prepare(`
    SELECT id, from_memory_id, to_memory_id, relation, created_at
    FROM main.memory_links
    ORDER BY id COLLATE BINARY
  `).all().map((row) => ({ ...row }))
}

function captureError(callback) {
  try {
    callback()
    return null
  } catch (error) {
    return error
  }
}

function assertAuthorityCode(error, code) {
  assert.equal(error instanceof MemoryAuthorityError, true)
  assert.equal(error.name, 'MemoryAuthorityError')
  assert.equal(error.code, code)
}

function matrixCases() {
  const result = []
  let ordinal = 1
  for (const partition of PARTITIONS) {
    for (const validity of VALIDITIES) {
      for (const scope of SCOPES) {
        for (const linkCount of [0, 1]) {
          const applied = scope.name === 'own-private' && linkCount === 0
          result.push(Object.freeze({
            actor: ACTORS[(ordinal - 1) % ACTORS.length],
            applied,
            id: b2Identifier('mem_', 1000 + ordinal),
            linkCount,
            ordinal,
            partition,
            reason: applied
              ? null
              : scope.reason ?? 'incident_edges_unemittable',
            scope,
            validity,
          }))
          ordinal += 1
        }
      }
    }
  }
  return result
}

test('M2-B-05 permanent/transient target cross-product commits only exact own-private zero-link leaves', () => {
  const cases = matrixCases()
  assert.equal(cases.length, 40)
  const fixture = createCdxM1Fixture(0, { withRows: false })
  const ownAnchor = b2Identifier('mem_', 1901)
  const otherPalariAnchor = b2Identifier('mem_', 1902)
  seedB2Memory(fixture.db, {
    id: ownAnchor,
    memoryType: 'working',
    palariId: PALARI_ID,
    userId: USER_ID,
  })
  seedB2Memory(fixture.db, {
    id: otherPalariAnchor,
    memoryType: 'working',
    palariId: OTHER_PALARI_ID,
    userId: USER_ID,
  })
  for (const entry of cases) {
    seedB2Memory(fixture.db, {
      content: `matrix ${entry.partition.name} ${entry.validity.name} ${entry.scope.name} links-${entry.linkCount}`,
      id: entry.id,
      memoryType: entry.partition.type,
      palariId: entry.scope.palariId,
      shared: entry.scope.shared,
      userId: entry.scope.userId,
      validUntil: entry.validity.validUntil,
    })
    if (entry.linkCount === 1) {
      seedB2Link(fixture.db, {
        fromMemoryId: entry.id,
        id: b2Identifier('lnk_', 2000 + entry.ordinal),
        relation: `matrix-${entry.scope.name}`,
        toMemoryId: entry.scope.palariId === OTHER_PALARI_ID
          ? otherPalariAnchor
          : ownAnchor,
      })
    }
  }

  const activities = []
  const root = createMemoryAuthorityRoot(rootInput((activity) => {
    activities.push(activity)
    return true
  }))
  let bridge
  const grants = []
  const results = []
  let ignoredGetterCalls = 0
  try {
    bridge = createBridge(fixture.db, root)
    const linksBefore = linkRows(fixture.db)

    for (const entry of cases) {
      const input = grantInput(entry.id, entry.ordinal)
      const grant = issueMemoryAuthorityGrant(root, input)
      grants.push(grant)
      const options = { actor: entry.actor }
      for (const key of ['policy', 'confidence', 'source', 'time']) {
        Object.defineProperty(options, key, {
          enumerable: true,
          get() {
            ignoredGetterCalls += 1
            throw new Error(`ignored caller label was observed: ${key}`)
          },
        })
      }
      const idValue = entry.ordinal % 2 === 0
        ? `  ${entry.id}  `
        : entry.id
      const operationResult = bridge.erase(idValue, options, grant)
      results.push(operationResult)
      assert.deepEqual(
        operationResult,
        entry.applied
          ? {
              deleted: true,
              memory: operationResult.memory,
              reason: 'deleted',
            }
          : { deleted: false, reason: 'governance_refused' },
        `${entry.partition.name}/${entry.validity.name}/${entry.scope.name}/${entry.linkCount}`,
      )
      if (entry.applied) {
        assert.equal(operationResult.memory.id, entry.id)
        assert.equal(operationResult.memory.type, entry.partition.type)
        assert.equal(
          operationResult.memory.valid_until,
          entry.validity.validUntil,
        )
      }
    }

    assert.equal(ignoredGetterCalls, 0)
    assert.equal(activities.length, cases.length)
    assert.deepEqual(
      [...new Set(cases.map((entry) => entry.actor))].sort(),
      [...ACTORS].sort(),
    )

    const rows = readB2Rows(fixture.db)
    assert.equal(rows.cdx_b2_meta[0].head_mutation_sequence, cases.length)
    assert.equal(rows.cdx_b2_decisions.length, cases.length)
    assert.equal(rows.cdx_b2_effects.length, 8)
    assert.equal(rows.cdx_b2_meta[0].checkpoint_memory_count, 42)
    assert.equal(rows.cdx_b2_meta[0].checkpoint_link_count, 20)

    const expectedEffects = []
    let lastObservedAt = null
    for (let index = 0; index < cases.length; index += 1) {
      const entry = cases[index]
      const decision = rows.cdx_b2_decisions[index]
      const activity = activities[index]
      assert.equal(decision.sequence, index + 1)
      assert.equal(decision.target_id, entry.id)
      assert.equal(decision.outcome, entry.applied ? 'applied' : 'refused')
      assert.equal(decision.reason_code, entry.reason)
      assert.equal(decision.effect_count, entry.applied ? 2 : 0)
      assert.equal(decision.patch_kind, 'ratify')
      assert.equal(decision.patch_source, 'ratified_user')
      assert.equal(decision.patch_priority, 'provenance')
      assert.equal(decision.operation, 'atom_erase')
      assert.equal(decision.target_kind, 'memory.atom')
      assert.equal(decision.visibility, 'ledger')
      assert.equal(decision.evidence_kind, 'ratified_user')
      assert.equal(decision.evidence_strength, 1)
      assert.equal(decision.failed_condition_mask, 0)
      assert.equal(decision.resolution, 'kept')
      assert.equal(decision.authority_ledger_id, LEDGER_ID)
      assert.equal(decision.authority_event_id, activity.authorityEventId)
      assert.equal(decision.capability_id, activity.capabilityId)
      assert.equal(decision.evidence_at, EVIDENCE_AT)
      assert.equal(decision.issued_at, activity.issuedAt)
      assert.equal(decision.effective_at, decision.observed_at)
      assert.equal(decision.expires_at, EXPIRES_AT)
      if (lastObservedAt !== null) {
        assert.ok(lastObservedAt <= decision.observed_at)
      }
      lastObservedAt = decision.observed_at

      assert.equal(activities[index].targetId, entry.id)
      assert.equal(activities[index].authorityEventId, decision.authority_event_id)
      assert.equal(activities[index].capabilityId, decision.capability_id)
      if (entry.applied) {
        expectedEffects.push(
          {
            decision_sequence: decision.sequence,
            effect_ordinal: 0,
            effect_kind: 'projection_atom_erased',
            object_id: entry.id,
          },
          {
            decision_sequence: decision.sequence,
            effect_ordinal: 1,
            effect_kind: 'projection_fts_erased',
            object_id: entry.id,
          },
        )
      }
      assert.equal(
        targetCount(fixture.db, 'memories', entry.id),
        entry.applied ? 0 : 1,
      )
      assert.equal(
        targetCount(fixture.db, 'memory_fts', entry.id),
        entry.applied ? 0 : 1,
      )
    }
    assert.deepEqual(rows.cdx_b2_effects, expectedEffects)
    assert.deepEqual(linkRows(fixture.db), linksBefore)

    const reasonCounts = rows.cdx_b2_decisions.reduce((counts, decision) => {
      const key = decision.reason_code ?? 'applied'
      counts[key] = (counts[key] ?? 0) + 1
      return counts
    }, {})
    assert.deepEqual(reasonCounts, {
      applied: 4,
      incident_edges_unemittable: 4,
      scope_mismatch: 24,
      shared_scope_unsealed: 8,
    })

    let callerTrapCount = 0
    const hostile = new Proxy({}, {
      get() {
        callerTrapCount += 1
        throw new Error('burned-grant caller trap')
      },
      getOwnPropertyDescriptor() {
        callerTrapCount += 1
        throw new Error('burned-grant caller trap')
      },
      getPrototypeOf() {
        callerTrapCount += 1
        throw new Error('burned-grant caller trap')
      },
      ownKeys() {
        callerTrapCount += 1
        throw new Error('burned-grant caller trap')
      },
    })
    for (const grant of grants) {
      assert.throws(
        () => bridge.erase(hostile, hostile, grant),
        (error) => error instanceof MemoryAuthorityError &&
          error.code === 'authority_grant_unavailable',
      )
    }
    assert.equal(callerTrapCount, 0)
    assert.equal(count(fixture.db, 'cdx_b2_decisions'), cases.length)
  } finally {
    closeScenario(bridge, fixture)
  }
})

test('M2-B-05 zero or duplicate FTS membership is corruption, never a committed target refusal', async (t) => {
  for (const kind of ['zero', 'duplicate']) {
    await t.test(kind, () => {
      const fixture = createCdxM1Fixture(0, { withRows: false })
      const targetId = b2Identifier('mem_', kind === 'zero' ? 4101 : 4102)
      seedB2Memory(fixture.db, {
        id: targetId,
        memoryType: 'preference',
        palariId: PALARI_ID,
        shared: 0,
        userId: USER_ID,
      })
      let activityCalls = 0
      const root = createMemoryAuthorityRoot(rootInput(() => {
        activityCalls += 1
        return true
      }))
      let bridge
      try {
        bridge = createBridge(fixture.db, root)
        if (kind === 'zero') {
          fixture.db.prepare(
            'DELETE FROM main.memory_fts WHERE memory_id = ?',
          ).run(targetId)
        } else {
          const row = fixture.db.prepare(`
            SELECT rowid, id, palari_id, content, keywords
            FROM main.memories
            WHERE id = ?
          `).get(targetId)
          const rowid = fixture.db.prepare(
            'SELECT max(rowid) + 1000 AS value FROM main.memories',
          ).get().value
          fixture.db.prepare(`
            INSERT INTO main.memory_fts(
              rowid, memory_id, palari_id, content, keywords
            ) VALUES (?, ?, ?, ?, ?)
          `).run(
            rowid,
            row.id,
            row.palari_id,
            row.content,
            row.keywords,
          )
        }
        const expectedFtsCount = kind === 'zero' ? 0 : 2
        assert.equal(
          targetCount(fixture.db, 'memory_fts', targetId),
          expectedFtsCount,
        )
        const grant = issueMemoryAuthorityGrant(
          root,
          grantInput(targetId, kind === 'zero' ? 1101 : 1102),
        )
        assert.throws(
          () => bridge.erase(targetId, undefined, grant),
          (error) => error instanceof GovernedMemoryError &&
            error.code === 'governance_projection_invalid',
        )
        assert.equal(activityCalls, 1)
        assert.equal(count(fixture.db, 'cdx_b2_decisions'), 0)
        assert.equal(count(fixture.db, 'cdx_b2_effects'), 0)
        assert.equal(
          fixture.db.prepare(`
            SELECT head_mutation_sequence AS value
            FROM main.cdx_b2_meta
            WHERE singleton = 1
          `).get().value,
          0,
        )
        assert.equal(targetCount(fixture.db, 'memories', targetId), 1)
        assert.equal(
          targetCount(fixture.db, 'memory_fts', targetId),
          expectedFtsCount,
        )
        assert.throws(
          () => bridge.refuse('legacy_proposal'),
          (error) => error instanceof GovernedMemoryError &&
            error.code === 'governance_state_poisoned',
        )
        assert.throws(
          () => issueMemoryAuthorityGrant(root, grantInput(targetId, 1199)),
          (error) => error instanceof MemoryAuthorityError &&
            error.code === 'authority_root_revoked',
        )
      } finally {
        closeScenario(bridge, fixture)
      }
    })
  }
})

test('M2-B-05 reservation precedes caller capture and capture completes before the activity predicate', () => {
  const fixture = createCdxM1Fixture(0, { withRows: false })
  const targetId = b2Identifier('mem_', 4201)
  seedB2Memory(fixture.db, {
    id: targetId,
    memoryType: 'preference',
    palariId: PALARI_ID,
    shared: 0,
    userId: USER_ID,
  })
  const events = []
  const root = createMemoryAuthorityRoot(rootInput(() => {
    events.push('predicate')
    return true
  }))
  let bridge
  try {
    bridge = createBridge(fixture.db, root)
    const grant = issueMemoryAuthorityGrant(root, grantInput(targetId, 1201))
    let nestedCallerTraps = 0
    const nestedHostile = new Proxy({}, {
      get() {
        nestedCallerTraps += 1
        throw new Error('reserved nested caller trap')
      },
      getOwnPropertyDescriptor() {
        nestedCallerTraps += 1
        throw new Error('reserved nested caller trap')
      },
      getPrototypeOf() {
        nestedCallerTraps += 1
        throw new Error('reserved nested caller trap')
      },
      ownKeys() {
        nestedCallerTraps += 1
        throw new Error('reserved nested caller trap')
      },
    })
    const actor = {
      toString() {
        events.push('actor')
        const nested = captureError(() => {
          bridge.erase(nestedHostile, nestedHostile, grant)
        })
        events.push(`nested:${nested?.code}`)
        return 'explicit_user_action'
      },
    }
    const id = {
      toString() {
        events.push('id')
        return targetId
      },
    }
    const result = bridge.erase(id, { actor }, grant)
    assert.equal(result.deleted, true)
    assert.equal(result.memory.id, targetId)
    assert.deepEqual(events, [
      'actor',
      'nested:authority_grant_unavailable',
      'id',
      'predicate',
    ])
    assert.equal(nestedCallerTraps, 0)
    assert.equal(count(fixture.db, 'cdx_b2_decisions'), 1)
  } finally {
    closeScenario(bridge, fixture)
  }
})

test('M2-B-05 capture throw and predicate throw each release the same grant for an explicit retry', async (t) => {
  await t.test('capture throw', () => {
    const fixture = createCdxM1Fixture(0, { withRows: false })
    const targetId = b2Identifier('mem_', 4301)
    seedB2Memory(fixture.db, {
      id: targetId,
      memoryType: 'working',
      palariId: PALARI_ID,
      shared: 0,
      userId: USER_ID,
    })
    const events = []
    const root = createMemoryAuthorityRoot(rootInput(() => {
      events.push('predicate')
      return true
    }))
    let bridge
    try {
      bridge = createBridge(fixture.db, root)
      const grant = issueMemoryAuthorityGrant(root, grantInput(targetId, 1301))
      const captureFailure = new Error('capture identity')
      const actor = {
        toString() {
          events.push('actor')
          return 'explicit_user_action'
        },
      }
      const id = {
        toString() {
          events.push('id')
          throw captureFailure
        },
      }
      const error = captureError(() => bridge.erase(id, { actor }, grant))
      assert.equal(error, captureFailure)
      assert.deepEqual(events, ['actor', 'id'])
      assert.equal(count(fixture.db, 'cdx_b2_decisions'), 0)
      const result = bridge.erase(
        targetId,
        { actor: 'explicit_user_action' },
        grant,
      )
      assert.equal(result.deleted, true)
      assert.deepEqual(events, ['actor', 'id', 'predicate'])
      assert.equal(count(fixture.db, 'cdx_b2_decisions'), 1)
    } finally {
      closeScenario(bridge, fixture)
    }
  })

  await t.test('predicate throw', () => {
    const fixture = createCdxM1Fixture(0, { withRows: false })
    const targetId = b2Identifier('mem_', 4302)
    seedB2Memory(fixture.db, {
      id: targetId,
      memoryType: 'preference',
      palariId: PALARI_ID,
      shared: 0,
      userId: USER_ID,
    })
    const events = []
    const predicateFailure = new Error('predicate identity')
    let predicateCalls = 0
    const root = createMemoryAuthorityRoot(rootInput(() => {
      predicateCalls += 1
      events.push('predicate')
      if (predicateCalls === 1) throw predicateFailure
      return true
    }))
    let bridge
    try {
      bridge = createBridge(fixture.db, root)
      const grant = issueMemoryAuthorityGrant(root, grantInput(targetId, 1302))
      const actor = {
        toString() {
          events.push('actor')
          return 'explicit_user_action'
        },
      }
      const id = {
        toString() {
          events.push('id')
          return targetId
        },
      }
      const firstError = captureError(() => bridge.erase(id, { actor }, grant))
      assertAuthorityCode(firstError, 'authority_ledger_unavailable')
      assert.equal(Object.hasOwn(firstError, 'cause'), true)
      assert.equal(firstError.cause, predicateFailure)
      assert.deepEqual(events, ['actor', 'id', 'predicate'])
      assert.equal(count(fixture.db, 'cdx_b2_decisions'), 0)

      const result = bridge.erase(id, { actor }, grant)
      assert.equal(result.deleted, true)
      assert.deepEqual(events, [
        'actor',
        'id',
        'predicate',
        'actor',
        'id',
        'predicate',
      ])
      assert.equal(count(fixture.db, 'cdx_b2_decisions'), 1)
    } finally {
      closeScenario(bridge, fixture)
    }
  })
})

// V2-M2-B Task 4 — append-only B2 journal/reducer transition contract.

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
  B2_DECISION_KEYS,
  B2_DECISION_TIMES,
  B2_EFFECT_KEYS,
  B2_KERNEL_CONFIG_HASH,
  B2_WORKSPACE_ID,
  b2Identifier,
  createB2Decision,
  createB2Effects,
  createB2Tail,
  createCdxM1Fixture,
  readB2Rows,
  seedB2Link,
  seedB2Memory,
} from './helpers/cdx-b2-fixtures.mjs'

const TARGETS = Object.freeze({
  missing: b2Identifier('mem_', 700),
  scope: b2Identifier('mem_', 701),
  shared: b2Identifier('mem_', 702),
  incident: b2Identifier('mem_', 703),
  anchor: b2Identifier('mem_', 704),
  applied: b2Identifier('mem_', 705),
  scopeSharedIncident: b2Identifier('mem_', 706),
  sharedIncident: b2Identifier('mem_', 707),
  precedenceIncident: b2Identifier('mem_', 708),
  precedenceAnchor: b2Identifier('mem_', 709),
})

function runMutation(db, callback) {
  return createMutationCoordinator(db).run(callback)
}

function bootstrap(db) {
  return runMutation(db, (lease) => bootstrapCdxB2InTransaction(
    lease,
    db,
    { workspaceId: B2_WORKSPACE_ID },
  ))
}

function verify(db) {
  return runMutation(db, (lease) => verifyCdxB2InTransaction(lease, db))
}

function assertGovernedCode(expectedCode) {
  return (error) => {
    assert.equal(error instanceof GovernedMemoryError, true)
    assert.equal(error.code, expectedCode)
    return true
  }
}

function replaceOrdered(record, keys, changes = {}) {
  const result = {}
  for (const key of keys) {
    result[key] = Object.hasOwn(changes, key) ? changes[key] : record[key]
  }
  return Object.freeze(result)
}

function omitOrdered(record, keys, omittedKey) {
  const result = {}
  for (const key of keys) {
    if (key !== omittedKey) result[key] = record[key]
  }
  return Object.freeze(result)
}

function projectionRows(db) {
  return {
    memories: db.prepare(`
      SELECT * FROM main.memories ORDER BY id COLLATE BINARY
    `).all().map((row) => ({ ...row })),
    links: db.prepare(`
      SELECT * FROM main.memory_links ORDER BY id COLLATE BINARY
    `).all().map((row) => ({ ...row })),
    fts: db.prepare(`
      SELECT rowid, memory_id, palari_id, content, keywords
      FROM main.memory_fts
      ORDER BY rowid
    `).all().map((row) => ({ ...row })),
  }
}

function assertTask4State(state, expected) {
  assert.equal(Object.getPrototypeOf(state), null)
  assert.equal(Object.isFrozen(state), true)
  assert.deepEqual(Reflect.ownKeys(state), [
    'streamId',
    'headMutationSequence',
    'lastObservedAt',
    'authorityLedgerId',
    'checkpointMemoryCount',
    'checkpointLinkCount',
  ])
  assert.equal(state.headMutationSequence, expected.head)
  assert.equal(state.lastObservedAt, expected.observedAt)
  assert.equal(state.authorityLedgerId, expected.ledgerId)
  assert.equal(state.checkpointMemoryCount, expected.memoryCount)
  assert.equal(state.checkpointLinkCount, expected.linkCount)
}

function createEmptyJournalFixture() {
  const fixture = createCdxM1Fixture(0, { withRows: false })
  const state = bootstrap(fixture.db)
  return { fixture, state }
}

function createTransitionFixture() {
  const fixture = createCdxM1Fixture(0, { withRows: false })
  seedB2Memory(fixture.db, {
    id: TARGETS.scope,
    palariId: 'palari-other',
    userId: 'user-other',
  })
  seedB2Memory(fixture.db, { id: TARGETS.shared, shared: 1 })
  seedB2Memory(fixture.db, { id: TARGETS.incident })
  seedB2Memory(fixture.db, { id: TARGETS.anchor })
  seedB2Link(fixture.db, {
    id: b2Identifier('lnk_', 703),
    fromMemoryId: TARGETS.incident,
    toMemoryId: TARGETS.anchor,
  })
  // Eligibility deliberately ignores both legacy type and validity class.
  seedB2Memory(fixture.db, {
    id: TARGETS.applied,
    memoryType: 'project',
    validUntil: '2026-07-21T10:00:00.000Z',
  })
  const state = bootstrap(fixture.db)
  return { fixture, state }
}

function createPrecedenceFixture() {
  const fixture = createCdxM1Fixture(0, { withRows: false })
  seedB2Memory(fixture.db, {
    id: TARGETS.scopeSharedIncident,
    palariId: 'palari-other',
    userId: 'user-other',
    shared: 1,
  })
  seedB2Memory(fixture.db, { id: TARGETS.sharedIncident, shared: 1 })
  seedB2Memory(fixture.db, { id: TARGETS.precedenceIncident })
  seedB2Memory(fixture.db, { id: TARGETS.precedenceAnchor })
  for (const [offset, targetId] of [
    [0, TARGETS.scopeSharedIncident],
    [1, TARGETS.sharedIncident],
    [2, TARGETS.precedenceIncident],
  ]) {
    seedB2Link(fixture.db, {
      id: b2Identifier('lnk_', 706 + offset),
      fromMemoryId: targetId,
      toMemoryId: TARGETS.precedenceAnchor,
    })
  }
  const state = bootstrap(fixture.db)
  return { fixture, state }
}

function appendRejected(db, input, expectedCode = 'governance_journal_invalid') {
  const before = readB2Rows(db)
  assert.throws(
    () => runMutation(db, (lease) =>
      appendCdxB2TailInTransaction(lease, db, input)),
    assertGovernedCode(expectedCode),
  )
  assert.deepEqual(readB2Rows(db), before)
}

function insertRawDecision(db, decision) {
  const columns = B2_DECISION_KEYS.join(', ')
  const placeholders = B2_DECISION_KEYS.map(() => '?').join(', ')
  return db.prepare(`
    INSERT INTO main.cdx_b2_decisions(${columns})
    VALUES (${placeholders})
  `).run(...B2_DECISION_KEYS.map((key) => decision[key]))
}

test('M2-B-04 fixture records pin exact decision/effect xinfo order and deep-frozen effects', () => {
  const state = { streamId: b2Identifier('b2s_', 1) }
  const decision = createB2Decision(state, {
    outcome: 'applied',
    targetId: TARGETS.applied,
  })
  const effects = createB2Effects(decision)
  const tail = createB2Tail(state, { decision, effects })

  assert.deepEqual(Reflect.ownKeys(tail), ['decision', 'effects'])
  assert.equal(Object.isFrozen(tail), true)
  assert.deepEqual(Reflect.ownKeys(decision), B2_DECISION_KEYS)
  assert.equal(Object.isFrozen(decision), true)
  assert.equal(Object.isFrozen(effects), true)
  assert.equal(Object.isFrozen(effects[0]), true)
  assert.equal(Object.isFrozen(effects[1]), true)
  assert.deepEqual(Reflect.ownKeys(effects[0]), B2_EFFECT_KEYS)
  assert.deepEqual(Reflect.ownKeys(effects[1]), B2_EFFECT_KEYS)
  assert.deepEqual(effects.map((effect) => effect.effect_ordinal), [0, 1])
  assert.deepEqual(effects.map((effect) => effect.effect_kind), [
    'projection_atom_erased',
    'projection_fts_erased',
  ])
})

test('M2-B-04 append rejects hostile or inexact tail records before writing', () => {
  const { fixture, state } = createEmptyJournalFixture()
  try {
    const valid = createB2Tail(state, { targetId: TARGETS.missing })
    const reversedDecision = {}
    for (const key of [...B2_DECISION_KEYS].reverse()) {
      reversedDecision[key] = valid.decision[key]
    }
    Object.freeze(reversedDecision)
    const extraDecision = { ...valid.decision, extra: true }
    Object.freeze(extraDecision)
    const accessorDecision = {}
    for (const key of B2_DECISION_KEYS) {
      if (key === 'target_id') {
        Object.defineProperty(accessorDecision, key, {
          enumerable: true,
          get() {
            throw new Error('decision accessor must not run')
          },
        })
      } else {
        Object.defineProperty(accessorDecision, key, {
          enumerable: true,
          value: valid.decision[key],
        })
      }
    }
    Object.freeze(accessorDecision)
    const reorderedEffect = Object.freeze({
      object_id: TARGETS.missing,
      effect_kind: 'projection_atom_erased',
      effect_ordinal: 0,
      decision_sequence: 1,
    })

    const cases = [
      null,
      {},
      { decision: valid.decision },
      { decision: valid.decision, effects: valid.effects, extra: true },
      new Proxy(valid, {}),
      Object.freeze({
        decision: new Proxy(valid.decision, {}),
        effects: valid.effects,
      }),
      Object.freeze({
        decision: omitOrdered(valid.decision, B2_DECISION_KEYS, 'target_id'),
        effects: valid.effects,
      }),
      Object.freeze({ decision: extraDecision, effects: valid.effects }),
      Object.freeze({ decision: reversedDecision, effects: valid.effects }),
      Object.freeze({ decision: accessorDecision, effects: valid.effects }),
      Object.freeze({ decision: valid.decision, effects: [] }),
      Object.freeze({
        decision: valid.decision,
        effects: Object.freeze([Object.freeze({
          decision_sequence: 1,
          effect_ordinal: 0,
          effect_kind: 'projection_atom_erased',
          object_id: TARGETS.missing,
        })]),
      }),
      Object.freeze({
        decision: valid.decision,
        effects: Object.freeze([reorderedEffect]),
      }),
      Object.freeze({
        decision: valid.decision,
        effects: Object.freeze(new Proxy([], {})),
      }),
    ]

    for (const input of cases) {
      appendRejected(fixture.db, input, 'governance_invalid_argument')
    }
  } finally {
    fixture.close()
  }
})

test('M2-B-04 exact patch hashing ignores inherited toJSON after import', () => {
  const { fixture, state } = createEmptyJournalFixture()
  const tail = createB2Tail(state, { targetId: TARGETS.missing })
  const prior = Object.getOwnPropertyDescriptor(Object.prototype, 'toJSON')
  let calls = 0
  let committed
  try {
    Object.defineProperty(Object.prototype, 'toJSON', {
      configurable: true,
      value() {
        calls += 1
        throw new Error('inherited toJSON must not run')
      },
    })
    committed = runMutation(fixture.db, (lease) => {
      appendCdxB2TailInTransaction(lease, fixture.db, tail)
      return advanceCdxB2HeadInTransaction(lease, fixture.db, 1)
    })
  } finally {
    if (prior === undefined) Reflect.deleteProperty(Object.prototype, 'toJSON')
    else Object.defineProperty(Object.prototype, 'toJSON', prior)
    fixture.close()
  }
  assert.equal(calls, 0)
  assert.equal(committed.headMutationSequence, 1)
})

test('M2-B-04 classifier precedence survives overlapping refusal conditions', () => {
  const { fixture, state } = createPrecedenceFixture()
  try {
    const before = projectionRows(fixture.db)
    const specifications = [
      {
        targetId: TARGETS.missing,
        palariId: 'palari-other',
        userId: 'user-other',
        reasonCode: 'missing_target',
      },
      {
        targetId: TARGETS.scopeSharedIncident,
        reasonCode: 'scope_mismatch',
      },
      {
        targetId: TARGETS.sharedIncident,
        reasonCode: 'shared_scope_unsealed',
      },
      {
        targetId: TARGETS.precedenceIncident,
        reasonCode: 'incident_edges_unemittable',
      },
    ]

    for (let index = 0; index < specifications.length; index += 1) {
      const decision = createB2Decision(state, {
        ...specifications[index],
        sequence: index + 1,
        outcome: 'refused',
      })
      runMutation(fixture.db, (lease) => {
        appendCdxB2TailInTransaction(
          lease,
          fixture.db,
          createB2Tail(state, { decision }),
        )
        advanceCdxB2HeadInTransaction(lease, fixture.db, index + 1)
      })
    }

    assert.deepEqual(projectionRows(fixture.db), before)
    assert.deepEqual(
      readB2Rows(fixture.db).cdx_b2_decisions.map((row) => row.reason_code),
      specifications.map(({ reasonCode }) => reasonCode),
    )
  } finally {
    fixture.close()
  }
})

test('M2-B-04 records all four first-match refusals then applies one ended project erasure', () => {
  const { fixture, state } = createTransitionFixture()
  try {
    const specifications = [
      [TARGETS.missing, 'refused', 'missing_target'],
      [TARGETS.scope, 'refused', 'scope_mismatch'],
      [TARGETS.shared, 'refused', 'shared_scope_unsealed'],
      [TARGETS.incident, 'refused', 'incident_edges_unemittable'],
      [TARGETS.applied, 'applied', null],
    ]
    const expectedDecisions = []
    const expectedEffects = []
    const linksBefore = projectionRows(fixture.db).links

    for (let index = 0; index < specifications.length; index += 1) {
      const sequence = index + 1
      const [targetId, outcome, reasonCode] = specifications[index]
      const decision = createB2Decision(state, {
        sequence,
        targetId,
        outcome,
        reasonCode,
      })
      const effects = createB2Effects(decision)
      const projectionBeforeAppend = projectionRows(fixture.db)

      const returned = runMutation(fixture.db, (lease) => {
        assert.equal(
          appendCdxB2TailInTransaction(
            lease,
            fixture.db,
            createB2Tail(state, { decision, effects }),
          ),
          undefined,
        )
        assert.deepEqual(projectionRows(fixture.db), projectionBeforeAppend)
        assert.equal(
          fixture.db.prepare(
            'SELECT head_mutation_sequence FROM main.cdx_b2_meta',
          ).get().head_mutation_sequence,
          sequence - 1,
        )

        if (outcome === 'applied') {
          const deletion = fixture.db.prepare(
            'DELETE FROM main.memories WHERE id = ?',
          ).run(targetId)
          assert.equal(deletion.changes, 1)
          assert.equal(
            fixture.db.prepare(
              'SELECT count(*) AS count FROM main.memory_fts WHERE memory_id = ?',
            ).get(targetId).count,
            0,
          )
        }
        const projectionBeforeAdvance = projectionRows(fixture.db)
        const nextState = advanceCdxB2HeadInTransaction(
          lease,
          fixture.db,
          sequence,
        )
        assert.deepEqual(projectionRows(fixture.db), projectionBeforeAdvance)
        return nextState
      })

      assertTask4State(returned, {
        head: sequence,
        observedAt: B2_DECISION_TIMES.observedAt,
        ledgerId: B2_AUTHORITY_LEDGER_ID,
        memoryCount: 5,
        linkCount: 1,
      })
      expectedDecisions.push({ ...decision })
      for (const effect of effects) expectedEffects.push({ ...effect })
      const rows = readB2Rows(fixture.db)
      assert.deepEqual(rows.cdx_b2_decisions, expectedDecisions)
      assert.deepEqual(rows.cdx_b2_effects, expectedEffects)
      assert.deepEqual(verify(fixture.db), returned)
    }

    assert.deepEqual(projectionRows(fixture.db).links, linksBefore)
    assert.equal(
      fixture.db.prepare(
        'SELECT count(*) AS count FROM main.memories WHERE id = ?',
      ).get(TARGETS.applied).count,
      0,
    )
  } finally {
    fixture.close()
  }
})

test('M2-B-04 equal observed time passes but a decreasing positive-tail time fails', () => {
  const { fixture, state } = createEmptyJournalFixture()
  try {
    const first = createB2Tail(state, {
      sequence: 1,
      targetId: TARGETS.missing,
    })
    const equal = createB2Tail(state, {
      sequence: 2,
      targetId: TARGETS.missing,
    })
    runMutation(fixture.db, (lease) => {
      appendCdxB2TailInTransaction(lease, fixture.db, first)
      advanceCdxB2HeadInTransaction(lease, fixture.db, 1)
    })
    runMutation(fixture.db, (lease) => {
      appendCdxB2TailInTransaction(lease, fixture.db, equal)
      advanceCdxB2HeadInTransaction(lease, fixture.db, 2)
    })
    assert.equal(verify(fixture.db).lastObservedAt, B2_DECISION_TIMES.observedAt)

    const decreasing = createB2Tail(state, {
      sequence: 3,
      targetId: TARGETS.missing,
      evidenceAt: '2026-07-21T09:58:00.000Z',
      issuedAt: '2026-07-21T09:59:00.000Z',
      observedAt: '2026-07-21T10:01:59.999Z',
    })
    appendRejected(fixture.db, decreasing, 'governance_clock_invalid')
    assert.equal(verify(fixture.db).headMutationSequence, 2)
  } finally {
    fixture.close()
  }
})

test('M2-B-04 decision UUID, literal, time, outcome, and config matrices fail atomically', () => {
  const { fixture, state } = createEmptyJournalFixture()
  try {
    const valid = createB2Decision(state, { targetId: TARGETS.missing })
    const mutations = [
      ['sequence-zero', { sequence: 0 }],
      ['wrong-stream', { stream_id: b2Identifier('b2s_', 999) }],
      ['decision-uuid', { decision_id: 'b2d_not-a-uuid' }],
      ['patch-uuid', { patch_id: 'b2p_10000000-0000-3000-8000-000000000001' }],
      ['target-uuid', { target_id: 'mem_10000000-0000-4000-7000-000000000001' }],
      ['ledger-uuid', { authority_ledger_id: 'led_not-a-uuid' }],
      ['event-uuid', { authority_event_id: 'agr_not-a-uuid' }],
      ['capability-uuid', { capability_id: 'cap_not-a-uuid' }],
      ['operation', { operation: 'memory_delete' }],
      ['patch-kind', { patch_kind: 'demote' }],
      ['patch-source', { patch_source: 'operator' }],
      ['patch-priority', { patch_priority: 'repair' }],
      ['target-kind', { target_kind: 'memory' }],
      ['visibility', { visibility: 'reason_only' }],
      ['authority-profile', { authority_profile: 'other' }],
      ['authority-kind', { authority_kind: 'operator' }],
      ['authority-id', { authority_id: 'different-user' }],
      ['evidence-kind', { evidence_kind: 'operator' }],
      ['evidence-strength', { evidence_strength: 0.9 }],
      ['timestamp-grammar', { evidence_at: '2026-07-21T10:00:00Z' }],
      ['evidence-after-issue', {
        evidence_at: '2026-07-21T10:01:00.001Z',
      }],
      ['issue-after-observation', {
        issued_at: '2026-07-21T10:02:00.001Z',
      }],
      ['effective-differs', {
        effective_at: '2026-07-21T10:01:59.999Z',
      }],
      ['expiry-equality', {
        expires_at: B2_DECISION_TIMES.observedAt,
      }],
      ['outcome', { outcome: 'pending' }],
      ['unknown-reason', { reason_code: 'unregistered_reason' }],
      ['reason-matrix', { reason_code: 'scope_mismatch' }],
      ['failed-mask', { failed_condition_mask: 1 }],
      ['resolution', { resolution: 'dropped' }],
      ['effect-count', { effect_count: 2 }],
      ['config-hash', { kernel_config_hash: '0'.repeat(64) }],
    ]

    for (const [label, changes] of mutations) {
      const decision = replaceOrdered(valid, B2_DECISION_KEYS, changes)
      assert.deepEqual(Reflect.ownKeys(decision), B2_DECISION_KEYS, label)
      appendRejected(
        fixture.db,
        Object.freeze({ decision, effects: Object.freeze([]) }),
      )
    }
    assert.equal(B2_KERNEL_CONFIG_HASH, valid.kernel_config_hash)
  } finally {
    fixture.close()
  }
})

test('M2-B-04 effect cardinality, order, kind, sequence, and target matrices fail atomically', () => {
  const cases = [
    ['zero-effects', (decision) => Object.freeze([])],
    ['wrong-sequence', (decision) => createB2Effects(decision, { sequence: 2 })],
    ['wrong-target', (decision) => createB2Effects(decision, {
      targetId: TARGETS.missing,
    })],
    ['wrong-first-ordinal', (decision) => createB2Effects(decision, {
      firstOrdinal: 1,
    })],
    ['wrong-second-ordinal', (decision) => createB2Effects(decision, {
      secondOrdinal: 0,
    })],
    ['wrong-first-kind', (decision) => createB2Effects(decision, {
      firstKind: 'projection_fts_erased',
    })],
    ['wrong-second-kind', (decision) => createB2Effects(decision, {
      secondKind: 'projection_atom_erased',
    })],
  ]

  for (const [label, effectsFactory] of cases) {
    const fixture = createCdxM1Fixture(0, { withRows: false })
    try {
      seedB2Memory(fixture.db, { id: TARGETS.applied })
      const state = bootstrap(fixture.db)
      const decision = createB2Decision(state, {
        outcome: 'applied',
        targetId: TARGETS.applied,
      })
      const effects = effectsFactory(decision)
      assert.equal(Object.isFrozen(effects), true, label)
      appendRejected(
        fixture.db,
        Object.freeze({ decision, effects }),
      )
    } finally {
      fixture.close()
    }
  }

  const { fixture, state } = createEmptyJournalFixture()
  try {
    const refusal = createB2Decision(state, { targetId: TARGETS.missing })
    const fabricatedEffects = Object.freeze([
      Object.freeze({
        decision_sequence: 1,
        effect_ordinal: 0,
        effect_kind: 'projection_atom_erased',
        object_id: TARGETS.missing,
      }),
      Object.freeze({
        decision_sequence: 1,
        effect_ordinal: 1,
        effect_kind: 'projection_fts_erased',
        object_id: TARGETS.missing,
      }),
    ])
    appendRejected(
      fixture.db,
      Object.freeze({ decision: refusal, effects: fabricatedEffects }),
    )
  } finally {
    fixture.close()
  }
})

test('M2-B-04 wrong transition reason never records a decision', () => {
  const cases = [
    ['missing_target', 'scope_mismatch', null],
    ['scope_mismatch', 'missing_target', {
      id: TARGETS.scope,
      palariId: 'palari-other',
      userId: 'user-other',
    }],
    ['shared_scope_unsealed', 'incident_edges_unemittable', {
      id: TARGETS.shared,
      shared: 1,
    }],
    ['applied', 'missing_target', { id: TARGETS.applied }],
  ]

  for (const [actual, recorded, memory] of cases) {
    const fixture = createCdxM1Fixture(0, { withRows: false })
    try {
      if (memory !== null) seedB2Memory(fixture.db, memory)
      const state = bootstrap(fixture.db)
      const decision = createB2Decision(state, {
        targetId: memory?.id ?? TARGETS.missing,
        reasonCode: recorded,
      })
      appendRejected(fixture.db, createB2Tail(state, { decision }))
      assert.equal(readB2Rows(fixture.db).cdx_b2_decisions.length, 0, actual)
    } finally {
      fixture.close()
    }
  }
})

test('M2-B-04 repeated refusals are allowed but event, capability, and ledger reuse rules are exact', () => {
  const { fixture, state } = createEmptyJournalFixture()
  try {
    const first = createB2Decision(state, {
      sequence: 1,
      targetId: TARGETS.missing,
    })
    const second = createB2Decision(state, {
      sequence: 2,
      targetId: TARGETS.missing,
    })
    runMutation(fixture.db, (lease) => {
      appendCdxB2TailInTransaction(
        lease,
        fixture.db,
        createB2Tail(state, { decision: first }),
      )
      advanceCdxB2HeadInTransaction(lease, fixture.db, 1)
    })
    runMutation(fixture.db, (lease) => {
      appendCdxB2TailInTransaction(
        lease,
        fixture.db,
        createB2Tail(state, { decision: second }),
      )
      advanceCdxB2HeadInTransaction(lease, fixture.db, 2)
    })
    assert.deepEqual(
      readB2Rows(fixture.db).cdx_b2_decisions.map((row) => row.target_id),
      [TARGETS.missing, TARGETS.missing],
    )

    for (const [changes, expectedCode] of [
      [{ authority_event_id: first.authority_event_id }, 'governance_journal_invalid'],
      [{ capability_id: first.capability_id }, 'governance_journal_invalid'],
      [{ authority_ledger_id: b2Identifier('led_', 2) }, 'governance_journal_invalid'],
      [{ decision_id: first.decision_id }, 'governance_identifier_collision'],
      [{ patch_id: first.patch_id }, 'governance_identifier_collision'],
    ]) {
      const third = replaceOrdered(
        createB2Decision(state, {
          sequence: 3,
          targetId: TARGETS.missing,
        }),
        B2_DECISION_KEYS,
        changes,
      )
      appendRejected(
        fixture.db,
        Object.freeze({ decision: third, effects: Object.freeze([]) }),
        expectedCode,
      )
    }
    assert.equal(verify(fixture.db).headMutationSequence, 2)
  } finally {
    fixture.close()
  }
})

test('M2-B-04 the partial index independently forbids a second applied target', () => {
  const fixture = createCdxM1Fixture(0, { withRows: false })
  try {
    seedB2Memory(fixture.db, { id: TARGETS.applied })
    const state = bootstrap(fixture.db)
    const first = createB2Decision(state, {
      sequence: 1,
      targetId: TARGETS.applied,
      outcome: 'applied',
    })
    runMutation(fixture.db, (lease) => {
      appendCdxB2TailInTransaction(
        lease,
        fixture.db,
        createB2Tail(state, { decision: first }),
      )
      fixture.db.prepare('DELETE FROM main.memories WHERE id = ?').run(
        TARGETS.applied,
      )
      advanceCdxB2HeadInTransaction(lease, fixture.db, 1)
    })

    // Deliberately bypass the supported verifier to isolate the SQL partial
    // unique index. Reintroducing the checkpoint target is itself projection
    // drift, so a supported append would fail even earlier.
    seedB2Memory(fixture.db, { id: TARGETS.applied })
    const duplicate = createB2Decision(state, {
      sequence: 2,
      targetId: TARGETS.applied,
      outcome: 'applied',
    })
    assert.throws(
      () => insertRawDecision(fixture.db, duplicate),
      /UNIQUE constraint failed: cdx_b2_decisions\.target_id/,
    )
  } finally {
    fixture.close()
  }
})

test('M2-B-04 gaps, absent/wrong heads, and a committed unheaded tail fail closed', () => {
  {
    const { fixture, state } = createEmptyJournalFixture()
    try {
      appendRejected(fixture.db, createB2Tail(state, {
        sequence: 2,
        targetId: TARGETS.missing,
      }))
      assert.throws(
        () => runMutation(fixture.db, (lease) =>
          advanceCdxB2HeadInTransaction(lease, fixture.db, 1)),
        assertGovernedCode('governance_journal_invalid'),
      )
    } finally {
      fixture.close()
    }
  }

  {
    const { fixture, state } = createEmptyJournalFixture()
    try {
      const before = readB2Rows(fixture.db)
      assert.throws(
        () => runMutation(fixture.db, (lease) => {
          appendCdxB2TailInTransaction(
            lease,
            fixture.db,
            createB2Tail(state, { targetId: TARGETS.missing }),
          )
          return advanceCdxB2HeadInTransaction(lease, fixture.db, 2)
        }),
        assertGovernedCode('governance_journal_invalid'),
      )
      assert.deepEqual(readB2Rows(fixture.db), before)
    } finally {
      fixture.close()
    }
  }

  {
    const { fixture, state } = createEmptyJournalFixture()
    try {
      assert.equal(
        runMutation(fixture.db, (lease) => appendCdxB2TailInTransaction(
          lease,
          fixture.db,
          createB2Tail(state, { targetId: TARGETS.missing }),
        )),
        undefined,
      )
      assert.equal(readB2Rows(fixture.db).cdx_b2_decisions.length, 1)
      assert.equal(
        readB2Rows(fixture.db).cdx_b2_meta[0].head_mutation_sequence,
        0,
      )
      assert.throws(
        () => verify(fixture.db),
        assertGovernedCode('governance_journal_invalid'),
      )
    } finally {
      fixture.close()
    }
  }
})

test('M2-B-04 advance accepts only a safe positive integer', () => {
  const { fixture } = createEmptyJournalFixture()
  try {
    for (const sequence of [
      undefined,
      null,
      0,
      -1,
      1.5,
      Number.MAX_SAFE_INTEGER + 1,
      '1',
      1n,
      {},
    ]) {
      assert.throws(
        () => runMutation(fixture.db, (lease) =>
          advanceCdxB2HeadInTransaction(lease, fixture.db, sequence)),
        assertGovernedCode('governance_invalid_argument'),
      )
    }
    assert.equal(verify(fixture.db).headMutationSequence, 0)
  } finally {
    fixture.close()
  }
})

test('M2-B-04 outer rollback proves append/advance are transaction-neutral and do no CDX DML', () => {
  const { fixture, state } = createEmptyJournalFixture()
  try {
    const beforeB2 = readB2Rows(fixture.db)
    const beforeProjection = projectionRows(fixture.db)
    const sentinel = new Error('force parent A1 rollback')
    assert.throws(
      () => runMutation(fixture.db, (lease) => {
        appendCdxB2TailInTransaction(
          lease,
          fixture.db,
          createB2Tail(state, { targetId: TARGETS.missing }),
        )
        throw sentinel
      }),
      (error) => error === sentinel,
    )
    assert.deepEqual(readB2Rows(fixture.db), beforeB2)
    assert.deepEqual(projectionRows(fixture.db), beforeProjection)

    assert.throws(
      () => runMutation(fixture.db, (lease) => {
        appendCdxB2TailInTransaction(
          lease,
          fixture.db,
          createB2Tail(state, { targetId: TARGETS.missing }),
        )
        advanceCdxB2HeadInTransaction(lease, fixture.db, 1)
        throw sentinel
      }),
      (error) => error === sentinel,
    )
    assert.deepEqual(readB2Rows(fixture.db), beforeB2)
    assert.deepEqual(projectionRows(fixture.db), beforeProjection)
    assertTask4State(verify(fixture.db), {
      head: 0,
      observedAt: null,
      ledgerId: null,
      memoryCount: 0,
      linkCount: 0,
    })
  } finally {
    fixture.close()
  }
})

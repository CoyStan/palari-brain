// U4 contract tests — admission gate (KERNEL-API §4; contract C2/C3/C5/C6/C7; GAP-1..4).
// Bounded U4 law: candidate write shortcuts fail; a gated candidate write passes.
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { DatabaseSync } from 'node:sqlite'

import { createKernelStore } from '../src/store.mjs'
import {
  acquisitionModes,
  externalMemorySourceKinds,
  memoryAddWriters,
  memoryMutationActors,
  memoryTypes,
  permanentMemoryTypes,
  transientMemoryTypes,
} from '../src/store.mjs'
import * as gateModule from '../src/gate.mjs'
import {
  admissionPolicyDefaults,
  assertGatedStoreCapability,
  createAdmissionPolicy,
  createGatedStore,
  createMemoryGate,
  proposeExtractedMemoryCandidate,
} from '../src/gate.mjs'

const tempDirs = []
async function tempDir() {
  const dir = await mkdtemp(join(tmpdir(), 'brain-kernel-gate-'))
  tempDirs.push(dir)
  return dir
}
after(async () => {
  await Promise.all(tempDirs.splice(0).map((d) => rm(d, { force: true, recursive: true })))
})

const FIXED_NOW = new Date('2026-07-18T12:00:00.000Z')
const EVENT_AT = '2026-05-02T09:30:00.000Z' // deliberately far from FIXED_NOW

async function openGated(workspaceId = 'contract-gate') {
  const root = await tempDir()
  const store = await createKernelStore({
    clock: () => FIXED_NOW,
    memoryEnabled: true,
    statePath: join(root, 'workspace-state.json'),
    workspaceId,
  })
  const gated = createGatedStore(store)
  return { gated, store }
}

function inspectDatabase(dbPath, callback) {
  const db = new DatabaseSync(dbPath, { readOnly: true })
  try {
    return callback(db)
  } finally {
    db.close()
  }
}

function assertGovernanceRefused(result) {
  assert.deepEqual(result, {
    outcome: 'rejected',
    reasons: ['governance_refused'],
  })
}

function assertNoGovernedMutation(store) {
  inspectDatabase(store.dbPath, (db) => {
    assert.equal(db.prepare(
      'SELECT count(*) AS count FROM main.memories',
    ).get().count, 0)
    assert.equal(db.prepare(
      'SELECT count(*) AS count FROM main.memory_links',
    ).get().count, 0)
    assert.equal(db.prepare(
      'SELECT count(*) AS count FROM main.cdx_b2_decisions',
    ).get().count, 0)
  })
}

const SCOPE = { palari_id: 'palari-a', user_id: 'user-1' }

function userProposal(overrides = {}) {
  return {
    kind: 'promote',
    op: 'add',
    provenance: { sourceKind: 'user_message', writer: 'explicit_user_action' },
    record: {
      confidence: 0.9,
      content: 'Working note: draft the U8 cost estimate before Friday.',
      keywords: ['cost', 'estimate'],
      type: 'working',
      ...SCOPE,
    },
    ...overrides,
  }
}

const BASE_KEYS = [
  'close',
  'config',
  'dbPath',
  'enabled',
  'getMemoryById',
  'listMemories',
  'publicStatus',
  'recallMemories',
  'searchMemories',
  'status',
]

const GATED_KEYS = [
  'close',
  'config',
  'dbPath',
  'deleteMemory',
  'enabled',
  'getMemoryById',
  'listMemories',
  'propose',
  'publicStatus',
  'recallMemories',
  'recordRecallInclusion',
  'runLifecycleJobs',
  'searchMemories',
  'status',
  'topicForget',
]

const POLICY_KEYS = ['demote', 'promote', 'permanent', 'ratify']
const POLICY_ORDER_ERROR =
  'Admission thresholds must keep order demote < promote < permanent < ratify.'

function assertFrozenOrdinarySurface(value, expectedKeys) {
  assert.equal(Object.getPrototypeOf(value), Object.prototype)
  assert.deepEqual(Reflect.ownKeys(value), expectedKeys)
  assert.equal(Object.isFrozen(value), true)
  for (const key of expectedKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    assert.equal('value' in descriptor, true, `${String(key)} is a data property`)
    assert.equal(descriptor.enumerable, true, `${String(key)} is enumerable`)
    assert.equal(descriptor.configurable, false, `${String(key)} is non-configurable`)
    assert.equal(descriptor.writable, false, `${String(key)} is non-writable`)
  }
}

function assertPolicySnapshot(value, expected) {
  assertFrozenOrdinarySurface(value, POLICY_KEYS)
  assert.deepEqual(value, expected)
  for (const key of POLICY_KEYS) assert.equal(typeof value[key], 'number')
}

function assertLegacyCode(code) {
  return (error) => error?.code === code
}

function hostileProxy(counter) {
  return new Proxy({}, {
    defineProperty() { counter.count += 1; throw new Error('proxy define trap ran') },
    get() { counter.count += 1; throw new Error('proxy get trap ran') },
    getOwnPropertyDescriptor() {
      counter.count += 1
      throw new Error('proxy descriptor trap ran')
    },
    getPrototypeOf() { counter.count += 1; throw new Error('proxy prototype trap ran') },
    has() { counter.count += 1; throw new Error('proxy has trap ran') },
    ownKeys() { counter.count += 1; throw new Error('proxy keys trap ran') },
    set() { counter.count += 1; throw new Error('proxy set trap ran') },
  })
}

test('A2 gate namespace and admission policy snapshot are exact', () => {
  assert.deepEqual(Object.keys(gateModule).sort(), [
    'admissionPolicyDefaults',
    'assertGatedStoreCapability',
    'createAdmissionPolicy',
    'createGatedStore',
    'createMemoryGate',
    'proposeExtractedMemoryCandidate',
  ])
  const expected = {
    demote: 0,
    promote: 0.25,
    permanent: 0.6,
    ratify: 0.75,
  }
  assertPolicySnapshot(admissionPolicyDefaults, expected)
  const fromUndefined = createAdmissionPolicy(undefined)
  const fromNull = createAdmissionPolicy(null)
  assertPolicySnapshot(fromUndefined, expected)
  assertPolicySnapshot(fromNull, expected)
  assert.notEqual(fromUndefined, admissionPolicyDefaults)
  assert.notEqual(fromNull, admissionPolicyDefaults)
  assert.notEqual(fromUndefined, fromNull)
})

test('policy capture rejects wrong types and Proxies without traps', () => {
  for (const invalid of [
    false,
    0,
    1n,
    '',
    Symbol('policy'),
    () => {},
  ]) {
    assert.throws(
      () => createAdmissionPolicy(invalid),
      assertLegacyCode('legacy_invalid_argument'),
    )
  }

  const counter = { count: 0 }
  assert.throws(
    () => createAdmissionPolicy(hostileProxy(counter)),
    assertLegacyCode('legacy_invalid_argument'),
  )
  assert.equal(counter.count, 0)

  assertPolicySnapshot(createAdmissionPolicy([]), admissionPolicyDefaults)
  assertPolicySnapshot(createAdmissionPolicy(new Date(0)), admissionPolicyDefaults)
  assertPolicySnapshot(
    createAdmissionPolicy(Object.create(null)),
    admissionPolicyDefaults,
  )
})

test('policy capture ignores every nonparticipating property without invoking getters', () => {
  let ignoredReads = 0
  const symbol = Symbol('ignored-policy-symbol')
  const prototype = {}
  Object.defineProperty(prototype, 'demote', {
    enumerable: true,
    get() {
      ignoredReads += 1
      throw new Error('inherited getter ran')
    },
  })
  const overrides = Object.create(prototype)
  Object.defineProperties(overrides, {
    extra: {
      enumerable: true,
      get() {
        ignoredReads += 1
        throw new Error('extra getter ran')
      },
    },
    promote: {
      enumerable: false,
      get() {
        ignoredReads += 1
        throw new Error('non-enumerable getter ran')
      },
    },
  })
  Object.defineProperty(overrides, symbol, {
    enumerable: true,
    get() {
      ignoredReads += 1
      throw new Error('symbol getter ran')
    },
  })

  assertPolicySnapshot(createAdmissionPolicy(overrides), admissionPolicyDefaults)
  assert.equal(ignoredReads, 0)
})

test('policy accessors and Number coercions run once each in canonical order', () => {
  const events = []
  const values = [-1, 0, 1, 2]
  const overrides = {}
  for (let index = 0; index < POLICY_KEYS.length; index += 1) {
    const key = POLICY_KEYS[index]
    Object.defineProperty(overrides, key, {
      enumerable: true,
      get() {
        assert.equal(this, overrides)
        events.push(`get:${key}`)
        const coercible = {
          [Symbol.toPrimitive](hint) {
            assert.equal(this, coercible)
            assert.equal(hint, 'number')
            events.push(`number:${key}`)
            return values[index]
          },
        }
        return coercible
      },
    })
  }

  assertPolicySnapshot(createAdmissionPolicy(overrides), {
    demote: -1,
    promote: 0,
    permanent: 1,
    ratify: 2,
  })
  assert.deepEqual(events, [
    'get:demote',
    'number:demote',
    'get:promote',
    'number:promote',
    'get:permanent',
    'number:permanent',
    'get:ratify',
    'number:ratify',
  ])

  const accessorFailure = new Error('accessor identity')
  const accessor = {}
  Object.defineProperty(accessor, 'demote', {
    enumerable: true,
    get() { throw accessorFailure },
  })
  assert.throws(() => createAdmissionPolicy(accessor), (error) => error === accessorFailure)

  const coercionFailure = new Error('coercion identity')
  const coercion = {
    demote: {
      [Symbol.toPrimitive]() { throw coercionFailure },
    },
  }
  assert.throws(() => createAdmissionPolicy(coercion), (error) => error === coercionFailure)
})

test('policy primitive conversion, finite/order checks, and unbounded values are exact', () => {
  assertPolicySnapshot(createAdmissionPolicy({
    demote: null,
    permanent: '2.5',
    promote: true,
    ratify: 4n,
  }), {
    demote: 0,
    promote: 1,
    permanent: 2.5,
    ratify: 4,
  })
  assertPolicySnapshot(createAdmissionPolicy({
    demote: false,
    permanent: 2,
    promote: 1,
    ratify: 3,
  }), {
    demote: 0,
    promote: 1,
    permanent: 2,
    ratify: 3,
  })

  assertPolicySnapshot(createAdmissionPolicy({
    demote: -1_000_000,
    permanent: 50,
    promote: -25,
    ratify: 1_000_000,
  }), {
    demote: -1_000_000,
    promote: -25,
    permanent: 50,
    ratify: 1_000_000,
  })

  const assertOrderError = (overrides) => assert.throws(
    () => createAdmissionPolicy(overrides),
    (error) =>
      error?.constructor === Error &&
      error.message === POLICY_ORDER_ERROR &&
      error.code === undefined,
  )
  assert.throws(
    () => createAdmissionPolicy({ demote: undefined }),
    (error) => error?.constructor === Error && error.message === POLICY_ORDER_ERROR,
  )
  for (const key of POLICY_KEYS) {
    for (const invalid of [NaN, Infinity, -Infinity]) {
      assertOrderError({ [key]: invalid })
    }
  }
  for (const invalidOrder of [
    { demote: 0.25 },
    { promote: 0 },
    { permanent: 0.25 },
    { ratify: 0.6 },
    { demote: 4, promote: 3, permanent: 2, ratify: 1 },
  ]) assertOrderError(invalidOrder)

  const mutable = { demote: -1, promote: 0, permanent: 1, ratify: 2 }
  const snapshot = createAdmissionPolicy(mutable)
  mutable.demote = -100
  mutable.promote = 100
  assertPolicySnapshot(snapshot, {
    demote: -1,
    promote: 0,
    permanent: 1,
    ratify: 2,
  })
})

test('gate construction rechecks base liveness after policy caller code', async () => {
  const root = await tempDir()
  const base = await createKernelStore({
    clock: () => FIXED_NOW,
    memoryEnabled: true,
    statePath: join(root, 'workspace-state.json'),
    workspaceId: 'policy-reentrant-close',
  })
  let reads = 0
  const policy = {
    permanent: 0.6,
    promote: 0.25,
    ratify: 0.75,
  }
  Object.defineProperty(policy, 'demote', {
    enumerable: true,
    get() {
      reads += 1
      base.close()
      return 0
    },
  })

  assert.throws(
    () => createGatedStore(base, { policy }),
    (error) =>
      error?.code === 'legacy_store_closed' &&
      error.message === 'The memory store is closed.',
  )
  assert.equal(reads, 1)
  assert.equal(base.status().status, 'closed')
})

test('enabled base, gate, and gated surfaces are exact frozen branded capabilities', async () => {
  const root = await tempDir()
  const base = await createKernelStore({
    clock: () => FIXED_NOW,
    memoryEnabled: true,
    statePath: join(root, 'workspace-state.json'),
    workspaceId: 'exact-enabled-surfaces',
  })
  const mutablePolicy = {
    demote: 0,
    promote: 0.25,
    permanent: 0.6,
    ratify: 0.75,
  }
  const gate = createMemoryGate(base, { policy: mutablePolicy })
  const gated = createGatedStore(base, { policy: mutablePolicy })

  assertFrozenOrdinarySurface(base, BASE_KEYS)
  assertFrozenOrdinarySurface(gate, ['policy', 'propose'])
  assertPolicySnapshot(gate.policy, admissionPolicyDefaults)
  assert.notEqual(gate.policy, admissionPolicyDefaults)
  assertFrozenOrdinarySurface(gated, GATED_KEYS)
  assert.equal(assertGatedStoreCapability(gated), undefined)
  assert.equal(gated.close, base.close)
  assert.equal(gated.config, base.config)
  assert.equal(gated.dbPath, base.dbPath)
  assert.equal(gated.enabled, true)
  for (const forbidden of [
    'addMemory',
    'applyEffect',
    'coordinator',
    'db',
    'effect',
    'initializeSchema',
    'insertMemory',
    'lease',
    'plan',
    'router',
    'schema',
    'supersedeMemory',
    'transaction',
  ]) {
    assert.equal(forbidden in base, false)
    assert.equal(forbidden in gated, false)
  }

  mutablePolicy.promote = 0.95
  mutablePolicy.permanent = 0.96
  mutablePolicy.ratify = 0.97
  assertPolicySnapshot(gate.policy, admissionPolicyDefaults)
  assertGovernanceRefused(gate.propose(userProposal({
    record: { ...userProposal().record, confidence: 0.5 },
  })))
  assertNoGovernedMutation(base)

  gated.close()
})

test('base/gated brand checks reject raw, duck, wrong-kind, and Proxy values trap-free', async () => {
  const { gated, store: base } = await openGated('capability-rejection')
  const gate = createMemoryGate(base)
  const raw = new DatabaseSync(':memory:')
  const counter = { count: 0 }
  const proxy = hostileProxy(counter)
  const duck = {
    close() {},
    enabled: true,
    status() { return { status: 'enabled' } },
  }

  try {
    for (const invalidBase of [raw, duck, gate, gated, proxy]) {
      assert.throws(
        () => createMemoryGate(invalidBase),
        assertLegacyCode('legacy_invalid_capability'),
      )
      assert.throws(
        () => createGatedStore(invalidBase),
        assertLegacyCode('legacy_invalid_capability'),
      )
    }
    for (const invalidGated of [raw, duck, gate, base, proxy, { ...gated }]) {
      assert.throws(
        () => assertGatedStoreCapability(invalidGated),
        assertLegacyCode('legacy_invalid_capability'),
      )
      assert.throws(
        () => proposeExtractedMemoryCandidate(invalidGated, proxy),
        assertLegacyCode('legacy_invalid_capability'),
      )
    }
    assert.equal(counter.count, 0)
  } finally {
    raw.close()
    gated.close()
  }
})

test('enabled close is synchronous, receiver-independent, idempotent, and fails closed before input', async () => {
  const { gated, store: base } = await openGated('enabled-close-law')
  const gate = createMemoryGate(base)
  const counter = { count: 0 }
  const hostile = hostileProxy(counter)
  const detachedClose = gated.close

  assert.equal(Reflect.apply(detachedClose, hostile, []), undefined)
  assert.equal(base.status().status, 'closed')
  assert.equal(gated.status().status, 'closed')
  assert.equal(base.publicStatus().status, 'closed')
  assert.equal(gated.publicStatus().status, 'closed')
  assert.equal(Reflect.apply(detachedClose, null, []), undefined)
  assert.equal(base.close(), undefined)

  const closedOperations = [
    () => base.getMemoryById(hostile),
    () => base.listMemories(hostile),
    () => base.recallMemories(hostile, hostile),
    () => base.searchMemories(hostile, hostile),
    () => gated.getMemoryById(hostile),
    () => gated.listMemories(hostile),
    () => gate.propose(hostile),
    () => gated.propose(hostile),
    () => gated.recallMemories(hostile, hostile),
    () => gated.searchMemories(hostile, hostile),
    () => gated.deleteMemory(hostile, hostile),
    () => gated.recordRecallInclusion(hostile, hostile),
    () => gated.runLifecycleJobs(hostile),
    () => gated.topicForget(hostile, hostile, hostile),
    () => proposeExtractedMemoryCandidate(gated, hostile),
  ]
  for (const operation of closedOperations) {
    assert.throws(operation, assertLegacyCode('legacy_store_closed'))
  }
  assert.throws(
    () => assertGatedStoreCapability(gated),
    assertLegacyCode('legacy_store_closed'),
  )
  assert.throws(
    () => createMemoryGate(base),
    assertLegacyCode('legacy_store_closed'),
  )
  assert.throws(
    () => createGatedStore(base),
    assertLegacyCode('legacy_store_closed'),
  )
  assert.equal(counter.count, 0)
})

test('disabled base/gate/gated surfaces stay exact and inert before and after close', async () => {
  const base = await createKernelStore({ memoryEnabled: false })
  const gate = createMemoryGate(base)
  const gated = createGatedStore(base)
  const counter = { count: 0 }
  const hostile = hostileProxy(counter)

  assertFrozenOrdinarySurface(base, BASE_KEYS)
  assertFrozenOrdinarySurface(gate, ['policy', 'propose'])
  assertPolicySnapshot(gate.policy, admissionPolicyDefaults)
  assertFrozenOrdinarySurface(gated, GATED_KEYS)
  assert.equal(base.enabled, false)
  assert.equal(base.dbPath, null)
  assert.equal(assertGatedStoreCapability(gated), undefined)

  function assertInert() {
    assert.equal(base.getMemoryById(hostile), null)
    assert.deepEqual(base.listMemories(hostile), [])
    assert.deepEqual(base.searchMemories(hostile, hostile), [])
    assert.deepEqual(base.recallMemories(hostile, hostile), {
      directCount: 0,
      keywords: [],
      latencyMs: 0,
      memories: [],
      totalCandidates: 0,
    })
    assert.equal(gated.getMemoryById(hostile), null)
    assert.deepEqual(gated.listMemories(hostile), [])
    assert.deepEqual(gated.searchMemories(hostile, hostile), [])
    assert.deepEqual(gated.recallMemories(hostile, hostile), {
      directCount: 0,
      keywords: [],
      latencyMs: 0,
      memories: [],
      totalCandidates: 0,
    })
    assert.deepEqual(gate.propose(hostile), {
      outcome: 'rejected',
      reasons: ['memory_disabled'],
    })
    assert.deepEqual(gated.propose(hostile), {
      outcome: 'rejected',
      reasons: ['memory_disabled'],
    })
    assert.deepEqual(proposeExtractedMemoryCandidate(gated, hostile), {
      outcome: 'rejected',
      reasons: ['memory_disabled'],
    })
    assert.deepEqual(gated.deleteMemory(hostile, hostile), {
      deleted: false,
      reason: 'memory_disabled',
    })
    assert.deepEqual(gated.topicForget(hostile, hostile, hostile), {
      count: 0,
      deleted: [],
    })
    assert.deepEqual(gated.recordRecallInclusion(hostile, hostile), {
      touched: [],
      touchedCount: 0,
    })
    assert.deepEqual(gated.runLifecycleJobs(hostile), {
      decayed: 0,
      deleted: 0,
      skipped: 0,
      touched: 0,
    })
  }

  assertInert()
  assert.equal(counter.count, 0)
  const detachedClose = gated.close
  assert.equal(Reflect.apply(detachedClose, hostile, []), undefined)
  assert.equal(base.status().status, 'closed')
  assert.equal(gated.status().status, 'closed')
  assert.equal(base.publicStatus().status, 'closed')
  assert.equal(gated.publicStatus().status, 'closed')
  assert.equal(Reflect.apply(detachedClose, null, []), undefined)
  assert.equal(assertGatedStoreCapability(gated), undefined)
  assertInert()
  assert.equal(counter.count, 0)
})

test('exported compatibility collections cannot mutate private runtime admission', async () => {
  const collections = [
    acquisitionModes,
    externalMemorySourceKinds,
    memoryAddWriters,
    memoryMutationActors,
    memoryTypes,
    permanentMemoryTypes,
    transientMemoryTypes,
  ]
  for (const collection of collections) {
    assert.equal(collection instanceof Set, true)
    assert.equal(Object.isFrozen(collection), true)
    assert.deepEqual(Reflect.ownKeys(collection), [])
    for (const method of ['add', 'delete', 'clear']) {
      assert.equal(collection[method], undefined)
      assert.equal(method in collection, false)
    }
    assert.throws(
      () => Set.prototype.add.call(collection, 'rogue'),
      TypeError,
    )
    assert.throws(
      () => Set.prototype.delete.call(collection, 'explicit_user_action'),
      TypeError,
    )
    assert.throws(() => Set.prototype.clear.call(collection), TypeError)
    assert.equal(Reflect.set(collection, 'rogue', true), false)
    assert.throws(
      () => Object.defineProperty(collection, 'rogue', { value: true }),
      TypeError,
    )
  }

  assert.equal(memoryTypes.has('rogue_type'), false)
  assert.equal(memoryAddWriters.has('rogue_writer'), false)
  assert.equal(memoryMutationActors.has('rogue_actor'), false)
  assert.equal(externalMemorySourceKinds.has('rogue_source'), false)

  const { gated, store } = await openGated('private-admission-sets')
  try {
    const invalidType = gated.propose(userProposal({
      kind: 'permanent',
      record: { ...userProposal().record, type: 'rogue_type' },
    }))
    assertGovernanceRefused(invalidType)

    const invalidWriter = gated.propose(userProposal({
      provenance: { sourceKind: 'user_message', writer: 'rogue_writer' },
    }))
    assertGovernanceRefused(invalidWriter)

    const invalidSource = gated.propose(userProposal({
      provenance: {
        sourceKind: 'rogue_source',
        writer: 'explicit_user_action',
      },
    }))
    assertGovernanceRefused(invalidSource)

    assert.deepEqual(
      gated.deleteMemory('missing', { actor: 'rogue_actor' }),
      { deleted: false, reason: 'governance_refused' },
    )

    assertGovernanceRefused(gated.propose(userProposal({
      record: {
        ...userProposal().record,
        content: 'Private admission snapshots remain unchanged.',
      },
    })))
    assertNoGovernedMutation(store)
  } finally {
    gated.close()
  }
})

test('unsupported proposals refuse before inspecting kind, op, or nested structure', async () => {
  const { gated, store } = await openGated('proposal-structure')
  assertGovernanceRefused(gated.propose())
  assertGovernanceRefused(gated.propose(null))
  for (const kind of ['toString', 'constructor', '__proto__']) {
    const proposal = Object.create(null)
    proposal.kind = kind
    assertGovernanceRefused(gated.propose(proposal))
  }
  assertGovernanceRefused(gated.propose({ kind: 'promote', op: null }))

  let ignoredReads = 0
  const add = userProposal()
  Object.defineProperties(add, {
    extra: { enumerable: true, get() { ignoredReads += 1; return 'ignored' } },
    scope: { enumerable: true, get() { ignoredReads += 1; return {} } },
    target: { enumerable: true, get() { ignoredReads += 1; return 'ignored' } },
  })
  assertGovernanceRefused(gated.propose(add))
  assert.equal(ignoredReads, 0)

  const recordAccessor = {
    kind: 'promote',
    provenance: { sourceKind: 'user_message', writer: 'explicit_user_action' },
  }
  Object.defineProperty(recordAccessor, 'record', {
    enumerable: true,
    get() { throw new Error('known accessor must not run') },
  })
  assertGovernanceRefused(gated.propose(recordAccessor))
  assertNoGovernedMutation(store)
})

test('gated capability rejects spoofs; enabled close wins before hostile input', async () => {
  assert.throws(
    () => assertGatedStoreCapability({ enabled: true }),
    (error) => error?.code === 'legacy_invalid_capability',
  )
  const { gated } = await openGated('closed-precedence')
  gated.close()
  const hostile = new Proxy({}, {
    get() { throw new Error('proposal trap ran') },
  })
  assert.throws(
    () => gated.propose(hostile),
    (error) => error?.code === 'legacy_store_closed',
  )
})

test('bounded U4 law: candidate add/supersede shortcuts are absent (partial C5)', async () => {
  const { gated } = await openGated()
  for (const method of ['addMemory', 'supersedeMemory', 'insertMemory']) {
    assert.equal(gated[method], undefined, `${method} must not exist on the gated surface`)
    assert.throws(() => gated[method]({}), TypeError, `calling ${method} fails`)
  }
  assert.equal(gated.db, undefined, 'raw db handle is not exposed')
  assert.ok(Object.isFrozen(gated), 'gated surface is frozen')
})

test('bounded U4 law: a gated candidate is refused without CDX or B2 mutation', async () => {
  const { gated, store } = await openGated()
  const result = gated.propose(userProposal())
  assertGovernanceRefused(result)
  assertNoGovernedMutation(store)
})

test('CDX-M1 and CDX-B2 migrations are recorded before publication', async () => {
  const { store } = await openGated()
  const rows = inspectDatabase(store.dbPath, (db) =>
    db.prepare('SELECT id FROM memory_migrations ORDER BY id').all()
      .map(({ id }) => id))
  assert.deepEqual(rows, ['CDX-B2', 'CDX-M0', 'CDX-M1'])
})

test('unsupported proposal refusal does not infer authority from provenance fields', async () => {
  const { gated, store } = await openGated()
  const noSource = gated.propose(userProposal({ provenance: { writer: 'explicit_user_action' } }))
  assertGovernanceRefused(noSource)
  const noWriter = gated.propose(userProposal({ provenance: { sourceKind: 'user_message' } }))
  assertGovernanceRefused(noWriter)
  assertNoGovernedMutation(store)
})

test('unsupported extraction proposals refuse regardless of event time or extractor', async () => {
  const { gated, store } = await openGated()
  const base = userProposal({
    provenance: { sourceKind: 'user_message', writer: 'background_extraction' },
  })
  const noEvent = gated.propose(base)
  assertGovernanceRefused(noEvent)

  const noExtractor = gated.propose({
    ...base,
    provenance: { ...base.provenance, eventAt: EVENT_AT },
  })
  assertGovernanceRefused(noExtractor)

  const ok = gated.propose({
    ...base,
    provenance: { ...base.provenance, eventAt: EVENT_AT, extractor: 'stub-extractor-v1' },
  })
  assertGovernanceRefused(ok)
  assertNoGovernedMutation(store)
})

test('policy threshold order remains exact but cannot authorize unsupported proposals', async () => {
  const { gated, store } = await openGated()
  const d = admissionPolicyDefaults
  assert.ok(d.demote < d.promote && d.promote < d.permanent && d.permanent < d.ratify)
  assert.throws(() => createAdmissionPolicy({ demote: 0.9 }), /order/i, 'disordered policy refused')

  // same evidence: enough for a transient promote, not enough for a permanent
  const midConfidence = (d.promote + d.permanent) / 2
  const permanentTry = gated.propose(userProposal({
    kind: 'permanent',
    record: { ...userProposal().record, confidence: midConfidence, type: 'preference' },
  }))
  assertGovernanceRefused(permanentTry)
  const promoteTry = gated.propose(userProposal({
    record: { ...userProposal().record, confidence: midConfidence },
  }))
  assertGovernanceRefused(promoteTry)
  assertNoGovernedMutation(store)
})

test('type partition labels cannot authorize an unsupported proposal', async () => {
  const { gated, store } = await openGated()
  const promotePermanent = gated.propose(userProposal({
    kind: 'promote',
    record: { ...userProposal().record, type: 'preference' },
  }))
  assertGovernanceRefused(promotePermanent)
  const permanentTransient = gated.propose(userProposal({
    kind: 'permanent',
    record: { ...userProposal().record, type: 'working' },
  }))
  assertGovernanceRefused(permanentTransient)
  assertNoGovernedMutation(store)
})

test('external source labels cannot mint authority or write a memory (C7)', async () => {
  const { gated, store } = await openGated()
  // baseline law inherited: external sourceKind only via background_extraction
  const externalDirect = gated.propose(userProposal({
    provenance: { sourceKind: 'source_document', writer: 'explicit_user_action' },
  }))
  assertGovernanceRefused(externalDirect)

  const externalExtracted = gated.propose(userProposal({
    provenance: {
      eventAt: EVENT_AT,
      extractor: 'stub-extractor-v1',
      sourceKind: 'source_document',
      writer: 'background_extraction',
    },
  }))
  assertGovernanceRefused(externalExtracted)
  assertNoGovernedMutation(store)
})

test('supersession proposals are refused before memory or link mutation (C3)', async () => {
  const { gated, store } = await openGated()
  const v1 = gated.propose(userProposal({
    kind: 'permanent',
    record: { ...userProposal().record, confidence: 0.9, content: 'Prefers tea over coffee.', keywords: ['tea'], type: 'preference' },
  }))
  assertGovernanceRefused(v1)
  const v2 = gated.propose({
    kind: 'permanent',
    op: 'supersede',
    provenance: { sourceKind: 'user_message', writer: 'explicit_user_action' },
    record: { ...userProposal().record, confidence: 0.9, content: 'Prefers coffee now — switched in May.', keywords: ['coffee'], type: 'preference' },
    target: 'untrusted_supersession_target',
  })
  assertGovernanceRefused(v2)
  assertNoGovernedMutation(store)
})

test('cross-partition supersession labels remain unable to authorize mutation', async () => {
  const { gated, store } = await openGated()
  const perm = gated.propose(userProposal({
    kind: 'permanent',
    record: { ...userProposal().record, confidence: 0.9, content: 'Values pre-commitment.', type: 'opinion' },
  }))
  assertGovernanceRefused(perm)
  const crossPartition = gated.propose({
    kind: 'promote',
    op: 'supersede',
    provenance: { sourceKind: 'user_message', writer: 'explicit_user_action' },
    record: { ...userProposal().record, content: 'Transient note trying to overwrite an opinion.', type: 'working' },
    target: 'untrusted_cross_partition_target',
  })
  assertGovernanceRefused(crossPartition)
  assertNoGovernedMutation(store)
})

test('repeated unsupported candidates remain refusals rather than duplicate writes', async () => {
  const { gated, store } = await openGated()
  const first = gated.propose(userProposal())
  assertGovernanceRefused(first)
  const second = gated.propose(userProposal())
  assertGovernanceRefused(second)
  assertNoGovernedMutation(store)
})

test('demotion and transient-delete proposal labels are both refused without mutation', async () => {
  const { gated, store } = await openGated()
  const note = gated.propose(userProposal())
  assertGovernanceRefused(note)
  const demoted = gated.propose({
    kind: 'demote',
    op: 'end_validity',
    provenance: { actor: 'lifecycle_job' },
    target: 'untrusted_demote_target',
  })
  assertGovernanceRefused(demoted)

  const perm = gated.propose(userProposal({
    kind: 'permanent',
    record: { ...userProposal().record, confidence: 0.9, content: 'Permanent: sister lives in Oaxaca.', type: 'relationship' },
  }))
  assertGovernanceRefused(perm)
  const badDelete = gated.propose({
    kind: 'demote',
    op: 'delete_transient',
    provenance: { actor: 'lifecycle_job' },
    target: 'untrusted_permanent_target',
  })
  assertGovernanceRefused(badDelete)
  assertNoGovernedMutation(store)
})

test('sharing remains unregistered for both pipeline and user-labelled ratification', async () => {
  const { gated, store } = await openGated()
  const note = gated.propose(userProposal({
    kind: 'permanent',
    record: { ...userProposal().record, confidence: 0.9, content: 'Speaks Spanish and Nahuatl.', type: 'entity' },
  }))
  assertGovernanceRefused(note)
  const pipelineShare = gated.propose({
    kind: 'ratify',
    op: 'share',
    provenance: { eventAt: EVENT_AT, extractor: 'stub-extractor-v1', sourceKind: 'user_message', writer: 'background_extraction' },
    target: 'untrusted_share_target',
  })
  assertGovernanceRefused(pipelineShare)

  const userShare = gated.propose({
    kind: 'ratify',
    op: 'share',
    provenance: { sourceKind: 'user_message', writer: 'explicit_user_action' },
    target: 'untrusted_share_target',
  })
  assertGovernanceRefused(userShare)
  assertNoGovernedMutation(store)
})

test('ownership adapters retain exact governed refusal and inert result shapes (C17/C18)', async () => {
  const { gated, store } = await openGated()
  const note = gated.propose(userProposal())
  assertGovernanceRefused(note)
  const forgotten = gated.topicForget('estimate', { palariId: SCOPE.palari_id, userId: SCOPE.user_id }, { actor: 'explicit_user_action' })
  assert.deepEqual(forgotten, { count: 0, deleted: [] })
  assert.deepEqual(gated.recordRecallInclusion(['missing']), {
    touched: [],
    touchedCount: 0,
  })
  assert.deepEqual(gated.runLifecycleJobs({}), {
    decayed: 0,
    deleted: 0,
    skipped: 0,
    touched: 0,
  })
  assertNoGovernedMutation(store)
})

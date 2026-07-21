import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import * as publicAuthority from '../src/memory-authority.mjs'
import * as authorityRuntime from '../src/memory-authority-runtime.mjs'

const {
  MemoryAuthorityError,
  authorizeMemoryAuthorityReservation,
  bindMemoryAuthorityRoot,
  burnMemoryAuthorityReservation,
  createMemoryAuthorityRoot,
  issueMemoryAuthorityGrant,
  preflightMemoryAuthorityRoot,
  releaseMemoryAuthorityReservation,
  reserveMemoryAuthorityGrant,
  retireMemoryAuthorityAudience,
  revokeMemoryAuthorityGrant,
  revokeMemoryAuthorityRoot,
} = authorityRuntime

const PUBLIC_EXPORTS = Object.freeze([
  'MemoryAuthorityError',
  'createMemoryAuthorityRoot',
  'issueMemoryAuthorityGrant',
  'revokeMemoryAuthorityGrant',
  'revokeMemoryAuthorityRoot',
])

const INTERNAL_EXPORTS = Object.freeze([
  ...PUBLIC_EXPORTS,
  'authorizeMemoryAuthorityReservation',
  'bindMemoryAuthorityRoot',
  'burnMemoryAuthorityReservation',
  'preflightMemoryAuthorityRoot',
  'releaseMemoryAuthorityReservation',
  'reserveMemoryAuthorityGrant',
  'retireMemoryAuthorityAudience',
].sort())

const AUTHORITY_ERRORS = Object.freeze({
  authority_invalid_argument:
    'A valid memory authority argument is required.',
  authority_root_invalid:
    'A module-issued memory authority root is required.',
  authority_root_revoked:
    'The memory authority root has been revoked.',
  authority_root_unbound:
    'The memory authority root is not bound to a live store generation.',
  authority_root_busy:
    'The memory authority root is already bound to a store generation.',
  authority_scope_mismatch:
    'The memory authority scope does not match the store audience.',
  authority_grant_invalid:
    'A module-issued memory authority grant is required.',
  authority_grant_unavailable:
    'The memory authority grant is no longer available.',
  authority_grant_expired:
    'The memory authority grant has expired.',
  authority_grant_mismatch:
    'The memory authority grant does not authorize this target and verb.',
  authority_clock_invalid:
    'The native authority clock is invalid or moved backward.',
  authority_ledger_unavailable:
    'The external authority grant is not active at use time.',
  authority_ledger_protocol:
    'The authority activity check must return a primitive boolean synchronously.',
})

const ROOT_KEYS = Object.freeze([
  'workspaceId',
  'palariId',
  'userId',
  'authorityLedgerId',
  'checkGrantActive',
])

const GRANT_KEYS = Object.freeze([
  'authorityEventId',
  'capabilityId',
  'evidenceAt',
  'expiresAt',
  'targetId',
  'verb',
])

const CALLBACK_KEYS = Object.freeze([
  'authorityProfile',
  'authorityLedgerId',
  'authorityEventId',
  'capabilityId',
  'workspaceId',
  'palariId',
  'userId',
  'targetId',
  'verb',
  'evidenceAt',
  'issuedAt',
  'expiresAt',
])

const SNAPSHOT_KEYS = Object.freeze([
  'authorityProfile',
  'authorityKind',
  'authorityId',
  'authorityLedgerId',
  'authorityEventId',
  'capabilityId',
  'workspaceId',
  'palariId',
  'userId',
  'targetId',
  'verb',
  'evidenceKind',
  'evidenceStrength',
  'evidenceAt',
  'issuedAt',
  'effectiveAt',
  'observedAt',
  'expiresAt',
])

const WORKSPACE_ID = 'workspace-a'
const PALARI_ID = 'palari_a'
const USER_ID = 'user_a'
const LEDGER_ID = 'led_00000000-0000-4000-8000-000000000001'
const OTHER_LEDGER_ID = 'led_00000000-0000-4000-8000-000000000002'
const TARGET_ID = 'mem_00000000-0000-4000-8000-000000000003'
const OTHER_TARGET_ID = 'mem_00000000-0000-4000-8000-000000000004'
const EVIDENCE_AT = '2000-01-01T00:00:00.000Z'
const EXPIRES_AT = '2999-01-01T00:00:00.000Z'
const THROW_NATIVE_CLOCK = Symbol('throw native clock')

let freshImportOrdinal = 0

function authorityEventId(ordinal = 1) {
  return `agr_00000000-0000-4000-8000-${String(ordinal).padStart(12, '0')}`
}

function capabilityId(ordinal = 1) {
  return `cap_00000000-0000-4000-8000-${String(ordinal).padStart(12, '0')}`
}

function rootInput(overrides = {}) {
  return {
    workspaceId: WORKSPACE_ID,
    palariId: PALARI_ID,
    userId: USER_ID,
    authorityLedgerId: LEDGER_ID,
    checkGrantActive: () => true,
    ...overrides,
  }
}

function grantInput(ordinal = 1, overrides = {}) {
  return {
    authorityEventId: authorityEventId(ordinal),
    capabilityId: capabilityId(ordinal),
    evidenceAt: EVIDENCE_AT,
    expiresAt: EXPIRES_AT,
    targetId: TARGET_ID,
    verb: 'erase_atom',
    ...overrides,
  }
}

function nullRecord(record) {
  return Object.assign(Object.create(null), record)
}

function makeBound(
  runtime = authorityRuntime,
  {
    checkGrantActive = () => true,
    establishedAuthorityLedgerId = undefined,
    grantOverrides = {},
    ledgerId = LEDGER_ID,
    ordinal = 1,
    palariId = PALARI_ID,
    userId = USER_ID,
    workspaceId = WORKSPACE_ID,
  } = {},
) {
  const root = runtime.createMemoryAuthorityRoot(rootInput({
    authorityLedgerId: ledgerId,
    checkGrantActive,
    palariId,
    userId,
    workspaceId,
  }))
  assert.equal(runtime.preflightMemoryAuthorityRoot(root, workspaceId), undefined)
  const audience = runtime.bindMemoryAuthorityRoot(
    root,
    workspaceId,
    establishedAuthorityLedgerId,
  )
  const grant = runtime.issueMemoryAuthorityGrant(
    root,
    grantInput(ordinal, grantOverrides),
  )
  return { audience, grant, root }
}

function assertCarrier(value) {
  assert.equal(Object.getPrototypeOf(value), null)
  assert.equal(Object.isFrozen(value), true)
  assert.equal(Object.isExtensible(value), false)
  assert.deepEqual(Reflect.ownKeys(value), [])
  assert.deepEqual(Object.keys(value), [])
  assert.equal(JSON.stringify(value), '{}')
}

function assertAuthorityError(callback, code, options = {}) {
  const {
    ErrorClass = MemoryAuthorityError,
    cause,
    causePresent = false,
  } = options
  let captured
  assert.throws(callback, (error) => {
    captured = error
    assert.equal(error instanceof ErrorClass, true)
    assert.equal(Object.getPrototypeOf(error), ErrorClass.prototype)
    assert.equal(error.name, 'MemoryAuthorityError')
    assert.equal(error.code, code)
    assert.equal(error.message, AUTHORITY_ERRORS[code])
    assert.deepEqual(Object.keys(error), ['code'])
    assert.deepEqual(Object.getOwnPropertyDescriptor(error, 'code'), {
      value: code,
      enumerable: true,
      configurable: false,
      writable: false,
    })
    assert.equal(Object.getOwnPropertyDescriptor(error, 'message').enumerable, false)
    assert.equal(Object.getOwnPropertyDescriptor(error, 'name').enumerable, false)
    assert.equal(Object.hasOwn(error, 'cause'), causePresent)
    if (causePresent) {
      assert.deepEqual(Object.getOwnPropertyDescriptor(error, 'cause'), {
        value: cause,
        enumerable: false,
        configurable: true,
        writable: true,
      })
    }
    return true
  })
  return captured
}

function makeTrapProxy(target = {}) {
  const calls = []
  const trap = function trap(...parameters) {
    calls.push(parameters)
    throw new Error('proxy trap must not run')
  }
  return {
    calls,
    proxy: new Proxy(target, {
      apply: trap,
      construct: trap,
      defineProperty: trap,
      deleteProperty: trap,
      get: trap,
      getOwnPropertyDescriptor: trap,
      getPrototypeOf: trap,
      has: trap,
      ownKeys: trap,
      set: trap,
    }),
  }
}

function ownAccessorRecord(record, key, getter) {
  const copy = { ...record }
  Object.defineProperty(copy, key, {
    enumerable: true,
    configurable: true,
    get: getter,
  })
  return copy
}

async function importRuntimeWithClock(readings) {
  const descriptor = Object.getOwnPropertyDescriptor(Date, 'now')
  let callCount = 0
  const fakeNow = () => {
    const index = Math.min(callCount, readings.length - 1)
    callCount += 1
    const reading = readings[index]
    if (reading === THROW_NATIVE_CLOCK) {
      throw new Error('instrumented native clock throw')
    }
    return reading
  }
  Object.defineProperty(Date, 'now', { ...descriptor, value: fakeNow })
  try {
    freshImportOrdinal += 1
    const runtime = await import(
      `../src/memory-authority-runtime.mjs?authority-clock=${freshImportOrdinal}`
    )
    return { getCallCount: () => callCount, runtime }
  } finally {
    Object.defineProperty(Date, 'now', descriptor)
  }
}

test('M2-B-01 public and internal namespaces are exact and identity-preserving', () => {
  assert.deepEqual(Object.keys(publicAuthority), PUBLIC_EXPORTS)
  assert.deepEqual(Object.keys(authorityRuntime).sort(), INTERNAL_EXPORTS)
  assert.equal(Object.keys(publicAuthority).includes('default'), false)
  assert.equal(Object.keys(authorityRuntime).includes('default'), false)
  for (const name of PUBLIC_EXPORTS) {
    assert.equal(publicAuthority[name], authorityRuntime[name], name)
  }
})

test('M2-B-01 MemoryAuthorityError has the closed code, shape, and cause law', () => {
  for (const [code, message] of Object.entries(AUTHORITY_ERRORS)) {
    const error = new MemoryAuthorityError(code, message)
    assert.equal(error instanceof Error, true)
    assert.equal(error instanceof MemoryAuthorityError, true)
    assert.equal(error.name, 'MemoryAuthorityError')
    assert.equal(error.message, message)
    assert.equal(error.code, code)
    assert.deepEqual(Object.keys(error), ['code'])
    assert.equal(Object.hasOwn(error, 'cause'), false)
    assert.deepEqual(Object.getOwnPropertyDescriptor(error, 'code'), {
      value: code,
      enumerable: true,
      configurable: false,
      writable: false,
    })
    assert.throws(() => { error.code = 'authority_invalid_argument' }, TypeError)
  }

  for (const cause of [undefined, null, Object.freeze({ marker: 'cause' })]) {
    const error = new MemoryAuthorityError(
      'authority_ledger_unavailable',
      'cause present',
      cause,
    )
    assert.equal(Object.hasOwn(error, 'cause'), true)
    assert.equal(error.cause, cause)
    assert.deepEqual(Object.getOwnPropertyDescriptor(error, 'cause'), {
      value: cause,
      enumerable: false,
      configurable: true,
      writable: true,
    })
  }

  for (const code of [undefined, null, '', 'authority_unknown', {}, new String('authority_root_invalid')]) {
    assert.throws(
      () => new MemoryAuthorityError(code, 'message'),
      {
        name: 'TypeError',
        message: 'Unknown memory authority error code.',
      },
    )
  }
  for (const message of [undefined, null, '', 0, {}, new String('message')]) {
    assert.throws(
      () => new MemoryAuthorityError('authority_invalid_argument', message),
      {
        name: 'TypeError',
        message: 'Memory authority error message must be a non-empty string.',
      },
    )
  }
})

test('M2-B-01 roots are frozen opaque brands that cloning cannot preserve', () => {
  assert.deepEqual(Reflect.ownKeys(rootInput()), ROOT_KEYS)
  const root = createMemoryAuthorityRoot(rootInput())
  assertCarrier(root)
  assert.equal(preflightMemoryAuthorityRoot(root, WORKSPACE_ID), undefined)

  for (const clone of [
    {},
    Object.create(null),
    JSON.parse(JSON.stringify(root)),
    structuredClone(root),
  ]) {
    assertAuthorityError(
      () => preflightMemoryAuthorityRoot(clone, WORKSPACE_ID),
      'authority_root_invalid',
    )
  }

  const wrapped = makeTrapProxy(root)
  assertAuthorityError(
    () => preflightMemoryAuthorityRoot(wrapped.proxy, WORKSPACE_ID),
    'authority_root_invalid',
  )
  assert.equal(wrapped.calls.length, 0)
})

test('M2-B-01 exact input keys are unordered and data properties need not enumerate', () => {
  const rootValues = rootInput()
  const reorderedRoot = Object.create(null)
  for (const key of [...ROOT_KEYS].reverse()) {
    Object.defineProperty(reorderedRoot, key, {
      value: rootValues[key],
      enumerable: false,
      configurable: false,
      writable: false,
    })
  }
  const root = createMemoryAuthorityRoot(reorderedRoot)
  const audience = bindMemoryAuthorityRoot(root, WORKSPACE_ID, undefined)

  const grantValues = grantInput()
  const reorderedGrant = Object.create(null)
  for (const key of [...GRANT_KEYS].reverse()) {
    Object.defineProperty(reorderedGrant, key, {
      value: grantValues[key],
      enumerable: false,
      configurable: false,
      writable: false,
    })
  }
  const grant = issueMemoryAuthorityGrant(root, reorderedGrant)
  assertCarrier(grant)
  assertCarrier(reserveMemoryAuthorityGrant(audience, grant))
})

test('M2-B-01 create-root rejects non-exact records without traps or coercion', () => {
  const recordProxy = makeTrapProxy(rootInput())
  assertAuthorityError(
    () => createMemoryAuthorityRoot(recordProxy.proxy),
    'authority_invalid_argument',
  )
  assert.equal(recordProxy.calls.length, 0)

  for (const value of [null, undefined, [], new Date(), Object.create({})]) {
    assertAuthorityError(
      () => createMemoryAuthorityRoot(value),
      'authority_invalid_argument',
    )
  }

  const missing = rootInput()
  delete missing.userId
  const extra = { ...rootInput(), extra: true }
  const symbolic = { ...rootInput(), [Symbol('extra')]: true }
  const inherited = Object.create({ workspaceId: WORKSPACE_ID })
  Object.assign(inherited, rootInput())
  delete inherited.workspaceId
  for (const value of [missing, extra, symbolic, inherited]) {
    assertAuthorityError(
      () => createMemoryAuthorityRoot(value),
      'authority_invalid_argument',
    )
  }

  let getterCalls = 0
  const accessor = ownAccessorRecord(
    rootInput(),
    'checkGrantActive',
    () => {
      getterCalls += 1
      return () => true
    },
  )
  assertAuthorityError(
    () => createMemoryAuthorityRoot(accessor),
    'authority_invalid_argument',
  )
  assert.equal(getterCalls, 0)

  let coercionCalls = 0
  const coercible = {
    toString() {
      coercionCalls += 1
      return WORKSPACE_ID
    },
  }
  assertAuthorityError(
    () => createMemoryAuthorityRoot(rootInput({ workspaceId: coercible })),
    'authority_invalid_argument',
  )
  assert.equal(coercionCalls, 0)
})

test('M2-B-01 root scalar grammar includes the exact workspace boundary', () => {
  const validWorkspaces = [
    'a',
    'a-b',
    'a'.repeat(48),
    `${'a'.repeat(47)}-`,
  ]
  for (const workspaceId of validWorkspaces) {
    assertCarrier(createMemoryAuthorityRoot(rootInput({ workspaceId })))
  }

  const invalidRootFields = [
    ['workspaceId', ''],
    ['workspaceId', '-a'],
    ['workspaceId', 'a-'],
    ['workspaceId', 'a--b'],
    ['workspaceId', 'A'],
    ['workspaceId', 'a_b'],
    ['workspaceId', 'a'.repeat(49)],
    ['palariId', ''],
    ['palariId', '1palari'],
    ['palariId', 'Palari'],
    ['palariId', `p${'a'.repeat(64)}`],
    ['userId', 'user-a!'],
    ['authorityLedgerId', 'LED_00000000-0000-4000-8000-000000000001'],
    ['authorityLedgerId', 'led_00000000-0000-5000-8000-000000000001'],
    ['authorityLedgerId', 'led_00000000-0000-4000-7000-000000000001'],
    ['authorityLedgerId', 'led_00000000-0000-4000-8000-00000000000A'],
  ]
  for (const [key, value] of invalidRootFields) {
    assertAuthorityError(
      () => createMemoryAuthorityRoot(rootInput({ [key]: value })),
      'authority_invalid_argument',
    )
  }
})

test('M2-B-01 predicate capture accepts functions/classes/bounds, rejects proxies', () => {
  let originalCalls = 0
  let replacementCalls = 0
  const input = rootInput({
    checkGrantActive() {
      originalCalls += 1
      return true
    },
  })
  const root = createMemoryAuthorityRoot(input)
  input.checkGrantActive = () => {
    replacementCalls += 1
    return true
  }
  const audience = bindMemoryAuthorityRoot(root, WORKSPACE_ID, undefined)
  const grant = issueMemoryAuthorityGrant(root, grantInput())
  const reservation = reserveMemoryAuthorityGrant(audience, grant)
  authorizeMemoryAuthorityReservation(reservation, TARGET_ID, 'erase_atom')
  assert.equal(originalCalls, 1)
  assert.equal(replacementCalls, 0)

  class AcceptedUntilApply {}
  assertCarrier(createMemoryAuthorityRoot(rootInput({
    checkGrantActive: AcceptedUntilApply,
  })))

  const receiver = Object.freeze({ receiver: true })
  function ordinary() { return this === receiver }
  assertCarrier(createMemoryAuthorityRoot(rootInput({
    checkGrantActive: ordinary.bind(receiver),
  })))

  const proxiedFunction = makeTrapProxy(() => true)
  assertAuthorityError(
    () => createMemoryAuthorityRoot(rootInput({
      checkGrantActive: proxiedFunction.proxy,
    })),
    'authority_invalid_argument',
  )
  assert.equal(proxiedFunction.calls.length, 0)

  for (const value of [undefined, null, true, {}, /x/]) {
    assertAuthorityError(
      () => createMemoryAuthorityRoot(rootInput({ checkGrantActive: value })),
      'authority_invalid_argument',
    )
  }
})

test('M2-B-01 root and grant records are captured once by immutable scalar value', () => {
  let callbackRecord
  const originalCallback = (record) => {
    callbackRecord = record
    return true
  }
  const rootSource = rootInput({ checkGrantActive: originalCallback })
  const root = createMemoryAuthorityRoot(rootSource)

  rootSource.workspaceId = 'changed-workspace'
  rootSource.palariId = 'changed_palari'
  rootSource.userId = 'changed_user'
  rootSource.authorityLedgerId = OTHER_LEDGER_ID
  rootSource.checkGrantActive = () => false

  const audience = bindMemoryAuthorityRoot(root, WORKSPACE_ID, undefined)
  const grantSource = grantInput()
  const grant = issueMemoryAuthorityGrant(root, grantSource)
  grantSource.authorityEventId = authorityEventId(999)
  grantSource.capabilityId = capabilityId(999)
  grantSource.evidenceAt = '2001-01-01T00:00:00.000Z'
  grantSource.expiresAt = '2002-01-01T00:00:00.000Z'
  grantSource.targetId = OTHER_TARGET_ID
  grantSource.verb = 'changed'

  const reservation = reserveMemoryAuthorityGrant(audience, grant)
  const snapshot = authorizeMemoryAuthorityReservation(
    reservation,
    TARGET_ID,
    'erase_atom',
  )
  assert.equal(callbackRecord.workspaceId, WORKSPACE_ID)
  assert.equal(callbackRecord.palariId, PALARI_ID)
  assert.equal(callbackRecord.userId, USER_ID)
  assert.equal(callbackRecord.authorityLedgerId, LEDGER_ID)
  assert.equal(callbackRecord.authorityEventId, authorityEventId(1))
  assert.equal(callbackRecord.capabilityId, capabilityId(1))
  assert.equal(callbackRecord.evidenceAt, EVIDENCE_AT)
  assert.equal(callbackRecord.expiresAt, EXPIRES_AT)
  assert.equal(callbackRecord.targetId, TARGET_ID)
  assert.equal(callbackRecord.verb, 'erase_atom')
  assert.equal(snapshot.authorityId, USER_ID)
})

test('M2-B-01 preflight is non-mutating and pins exact precedence', () => {
  const invalidProxy = makeTrapProxy({})
  assertAuthorityError(
    () => preflightMemoryAuthorityRoot(invalidProxy.proxy, {}),
    'authority_root_invalid',
  )
  assert.equal(invalidProxy.calls.length, 0)

  const root = createMemoryAuthorityRoot(rootInput())
  assert.equal(preflightMemoryAuthorityRoot(root, WORKSPACE_ID), undefined)
  assert.equal(preflightMemoryAuthorityRoot(root, WORKSPACE_ID), undefined)
  assertAuthorityError(
    () => issueMemoryAuthorityGrant(root, makeTrapProxy(grantInput()).proxy),
    'authority_root_unbound',
  )
  const audience = bindMemoryAuthorityRoot(root, WORKSPACE_ID, undefined)
  assertCarrier(audience)
  assertAuthorityError(
    () => preflightMemoryAuthorityRoot(root, {}),
    'authority_root_busy',
  )

  const revoked = createMemoryAuthorityRoot(rootInput())
  assert.equal(revokeMemoryAuthorityRoot(revoked), undefined)
  assertAuthorityError(
    () => preflightMemoryAuthorityRoot(revoked, {}),
    'authority_root_revoked',
  )

  const unbound = createMemoryAuthorityRoot(rootInput())
  assertAuthorityError(
    () => preflightMemoryAuthorityRoot(unbound, {}),
    'authority_invalid_argument',
  )
  assertAuthorityError(
    () => preflightMemoryAuthorityRoot(unbound, 'other-workspace'),
    'authority_scope_mismatch',
  )
})

test('M2-B-01 binding enforces one generation and established-ledger identity', () => {
  const zeroHeadRoot = createMemoryAuthorityRoot(rootInput())
  const zeroHeadAudience = bindMemoryAuthorityRoot(
    zeroHeadRoot,
    WORKSPACE_ID,
    undefined,
  )
  assertCarrier(zeroHeadAudience)
  assertAuthorityError(
    () => bindMemoryAuthorityRoot(zeroHeadRoot, WORKSPACE_ID, undefined),
    'authority_root_busy',
  )

  const continuedRoot = createMemoryAuthorityRoot(rootInput())
  assertCarrier(bindMemoryAuthorityRoot(
    continuedRoot,
    WORKSPACE_ID,
    LEDGER_ID,
  ))

  const mismatchRoot = createMemoryAuthorityRoot(rootInput())
  assertAuthorityError(
    () => bindMemoryAuthorityRoot(
      mismatchRoot,
      WORKSPACE_ID,
      OTHER_LEDGER_ID,
    ),
    'authority_scope_mismatch',
  )
  assertCarrier(bindMemoryAuthorityRoot(
    mismatchRoot,
    WORKSPACE_ID,
    LEDGER_ID,
  ))

  for (const established of [null, '', {}, OTHER_TARGET_ID]) {
    const root = createMemoryAuthorityRoot(rootInput())
    assertAuthorityError(
      () => bindMemoryAuthorityRoot(root, WORKSPACE_ID, established),
      'authority_invalid_argument',
    )
  }

  const orderingRoot = createMemoryAuthorityRoot(rootInput())
  assertAuthorityError(
    () => bindMemoryAuthorityRoot(orderingRoot, 'other-workspace', null),
    'authority_scope_mismatch',
  )
})

test('M2-B-01 retiring a generation is synchronous, final, and idempotent', () => {
  const { audience, grant, root } = makeBound()
  const reservation = reserveMemoryAuthorityGrant(audience, grant)
  assert.equal(retireMemoryAuthorityAudience(audience), undefined)
  assert.equal(retireMemoryAuthorityAudience(audience), undefined)
  assert.equal(releaseMemoryAuthorityReservation(reservation), undefined)
  assertAuthorityError(
    () => reserveMemoryAuthorityGrant(audience, grant),
    'authority_grant_unavailable',
  )
  assertAuthorityError(
    () => issueMemoryAuthorityGrant(root, grantInput(2)),
    'authority_root_revoked',
  )
  assertAuthorityError(
    () => bindMemoryAuthorityRoot(root, WORKSPACE_ID, LEDGER_ID),
    'authority_root_revoked',
  )

  const reopenedRoot = createMemoryAuthorityRoot(rootInput())
  const reopenedAudience = bindMemoryAuthorityRoot(
    reopenedRoot,
    WORKSPACE_ID,
    LEDGER_ID,
  )
  assertCarrier(reopenedAudience)
  assert.notEqual(reopenedAudience, audience)

  const freshZeroHeadRoot = createMemoryAuthorityRoot(rootInput({
    authorityLedgerId: OTHER_LEDGER_ID,
  }))
  assertCarrier(bindMemoryAuthorityRoot(
    freshZeroHeadRoot,
    WORKSPACE_ID,
    undefined,
  ))
})

test('M2-B-01 grants require exact ordinary records and scalar grammar', () => {
  assert.deepEqual(Reflect.ownKeys(grantInput()), GRANT_KEYS)
  const { root } = makeBound()
  const proxy = makeTrapProxy(grantInput())
  assertAuthorityError(
    () => issueMemoryAuthorityGrant(root, proxy.proxy),
    'authority_invalid_argument',
  )
  assert.equal(proxy.calls.length, 0)

  const missing = grantInput()
  delete missing.targetId
  const extra = { ...grantInput(), extra: true }
  const symbolic = { ...grantInput(), [Symbol('extra')]: true }
  const inherited = Object.create({ verb: 'erase_atom' })
  Object.assign(inherited, grantInput())
  delete inherited.verb
  let getterCalls = 0
  const accessor = ownAccessorRecord(grantInput(), 'targetId', () => {
    getterCalls += 1
    return TARGET_ID
  })
  for (const value of [missing, extra, symbolic, inherited, accessor]) {
    assertAuthorityError(
      () => issueMemoryAuthorityGrant(root, value),
      'authority_invalid_argument',
    )
  }
  assert.equal(getterCalls, 0)

  const invalidFields = [
    ['authorityEventId', 'cap_00000000-0000-4000-8000-000000000001'],
    ['authorityEventId', 'agr_00000000-0000-5000-8000-000000000001'],
    ['capabilityId', 'cap_00000000-0000-4000-7000-000000000001'],
    ['capabilityId', 'cap_00000000-0000-4000-8000-00000000000A'],
    ['targetId', 'mem_00000000-0000-5000-8000-000000000003'],
    ['targetId', new String(TARGET_ID)],
    ['verb', 'delete'],
    ['verb', new String('erase_atom')],
    ['evidenceAt', '2000-01-01T00:00:00Z'],
    ['evidenceAt', '2000-01-01T00:00:00.000+00:00'],
    ['evidenceAt', '2000-02-30T00:00:00.000Z'],
    ['expiresAt', 'not-a-timestamp'],
  ]
  let ordinal = 100
  for (const [key, value] of invalidFields) {
    assertAuthorityError(
      () => issueMemoryAuthorityGrant(
        root,
        grantInput(ordinal, { [key]: value }),
      ),
      'authority_invalid_argument',
    )
    ordinal += 1
  }

  assertCarrier(issueMemoryAuthorityGrant(
    root,
    nullRecord(grantInput(ordinal)),
  ))
})

test('M2-B-01 issuance captures native time, chronology, and identifier non-reuse', async () => {
  const issuedAt = Date.parse('2026-07-21T10:00:00.000Z')
  const { getCallCount, runtime } = await importRuntimeWithClock([
    issuedAt,
    issuedAt + 1,
  ])
  const { root } = makeBound(runtime, {
    grantOverrides: {
      evidenceAt: '2026-07-21T09:59:59.999Z',
      expiresAt: '2026-07-21T10:00:01.000Z',
    },
  })
  assert.equal(getCallCount(), 1)

  assertAuthorityError(
    () => runtime.issueMemoryAuthorityGrant(root, grantInput(2, {
      authorityEventId: authorityEventId(1),
      evidenceAt: '2026-07-21T09:59:59.999Z',
      expiresAt: '2026-07-21T10:00:01.000Z',
    })),
    'authority_invalid_argument',
    { ErrorClass: runtime.MemoryAuthorityError },
  )
  assert.equal(getCallCount(), 1, 'reuse wins before native clock sampling')

  assertAuthorityError(
    () => runtime.issueMemoryAuthorityGrant(root, grantInput(3, {
      capabilityId: capabilityId(1),
      evidenceAt: '2026-07-21T09:59:59.999Z',
      expiresAt: '2026-07-21T10:00:01.000Z',
    })),
    'authority_invalid_argument',
    { ErrorClass: runtime.MemoryAuthorityError },
  )
  assert.equal(getCallCount(), 1)
})

test('M2-B-01 failed chronology does not reserve identifiers', async () => {
  const issuedAt = Date.parse('2026-07-21T10:00:00.000Z')
  const { runtime } = await importRuntimeWithClock([issuedAt, issuedAt])
  const root = runtime.createMemoryAuthorityRoot(rootInput())
  runtime.bindMemoryAuthorityRoot(root, WORKSPACE_ID, undefined)
  const input = grantInput(1, {
    evidenceAt: '2026-07-21T10:00:00.001Z',
    expiresAt: '2026-07-21T10:00:01.000Z',
  })
  assertAuthorityError(
    () => runtime.issueMemoryAuthorityGrant(root, input),
    'authority_invalid_argument',
    { ErrorClass: runtime.MemoryAuthorityError },
  )
  assertCarrier(runtime.issueMemoryAuthorityGrant(root, {
    ...input,
    evidenceAt: '2026-07-21T10:00:00.000Z',
  }))

  const expiryRoot = runtime.createMemoryAuthorityRoot(rootInput({
    authorityLedgerId: OTHER_LEDGER_ID,
  }))
  runtime.bindMemoryAuthorityRoot(expiryRoot, WORKSPACE_ID, undefined)
  const expiryInput = grantInput(2, {
    evidenceAt: '2026-07-21T10:00:00.000Z',
    expiresAt: '2026-07-21T10:00:00.000Z',
  })
  assertAuthorityError(
    () => runtime.issueMemoryAuthorityGrant(expiryRoot, expiryInput),
    'authority_invalid_argument',
    { ErrorClass: runtime.MemoryAuthorityError },
  )
  assertCarrier(runtime.issueMemoryAuthorityGrant(expiryRoot, {
    ...expiryInput,
    expiresAt: '2026-07-21T10:00:00.001Z',
  }))
})

test('M2-B-01 grants are opaque brands with exact revoke ownership', () => {
  const first = makeBound()
  const second = makeBound(authorityRuntime, {
    ledgerId: OTHER_LEDGER_ID,
    ordinal: 2,
  })
  assertCarrier(first.grant)
  assertAuthorityError(
    () => preflightMemoryAuthorityRoot(first.grant, WORKSPACE_ID),
    'authority_root_invalid',
  )
  assertAuthorityError(
    () => revokeMemoryAuthorityGrant(first.root, first.root),
    'authority_grant_invalid',
  )
  assertAuthorityError(
    () => reserveMemoryAuthorityGrant(first.audience, first.root),
    'authority_grant_invalid',
  )

  for (const clone of [
    {},
    Object.create(null),
    JSON.parse(JSON.stringify(first.grant)),
    structuredClone(first.grant),
  ]) {
    assertAuthorityError(
      () => revokeMemoryAuthorityGrant(first.root, clone),
      'authority_grant_invalid',
    )
  }

  const rootProxy = makeTrapProxy(first.root)
  const grantProxy = makeTrapProxy(first.grant)
  assertAuthorityError(
    () => revokeMemoryAuthorityGrant(rootProxy.proxy, grantProxy.proxy),
    'authority_root_invalid',
  )
  assert.equal(rootProxy.calls.length, 0)
  assert.equal(grantProxy.calls.length, 0)
  assertAuthorityError(
    () => revokeMemoryAuthorityGrant(first.root, grantProxy.proxy),
    'authority_grant_invalid',
  )
  assert.equal(grantProxy.calls.length, 0)
  assertAuthorityError(
    () => revokeMemoryAuthorityGrant(second.root, first.grant),
    'authority_scope_mismatch',
  )

  assert.equal(revokeMemoryAuthorityGrant(first.root, first.grant), undefined)
  assert.equal(revokeMemoryAuthorityGrant(first.root, first.grant), undefined)
  assertAuthorityError(
    () => reserveMemoryAuthorityGrant(first.audience, first.grant),
    'authority_grant_unavailable',
  )
  assert.equal(revokeMemoryAuthorityRoot(first.root), undefined)
  assert.equal(revokeMemoryAuthorityGrant(first.root, first.grant), undefined)
  assert.equal(revokeMemoryAuthorityRoot(first.root), undefined)
})

test('M2-B-01 audiences and reservations are opaque private brands', () => {
  const { audience, grant } = makeBound()
  assertCarrier(audience)
  const reservation = reserveMemoryAuthorityGrant(audience, grant)
  assertCarrier(reservation)

  for (const value of [{}, Object.create(null), structuredClone(audience)]) {
    assertAuthorityError(
      () => retireMemoryAuthorityAudience(value),
      'authority_invalid_argument',
    )
  }
  for (const value of [{}, Object.create(null), structuredClone(reservation)]) {
    assertAuthorityError(
      () => releaseMemoryAuthorityReservation(value),
      'authority_invalid_argument',
    )
    assertAuthorityError(
      () => burnMemoryAuthorityReservation(value),
      'authority_invalid_argument',
    )
    assertAuthorityError(
      () => authorizeMemoryAuthorityReservation(
        value,
        TARGET_ID,
        'erase_atom',
      ),
      'authority_invalid_argument',
    )
  }

  const audienceProxy = makeTrapProxy(audience)
  assertAuthorityError(
    () => retireMemoryAuthorityAudience(audienceProxy.proxy),
    'authority_invalid_argument',
  )
  assert.equal(audienceProxy.calls.length, 0)

  const reservationProxy = makeTrapProxy(reservation)
  assertAuthorityError(
    () => releaseMemoryAuthorityReservation(reservationProxy.proxy),
    'authority_invalid_argument',
  )
  assertAuthorityError(
    () => burnMemoryAuthorityReservation(reservationProxy.proxy),
    'authority_invalid_argument',
  )
  assert.equal(reservationProxy.calls.length, 0)
  assert.equal(releaseMemoryAuthorityReservation(reservation), undefined)
})

test('M2-B-01 reservation is exclusive before caller capture and releases conditionally', () => {
  const { audience, grant } = makeBound()
  const reservation = reserveMemoryAuthorityGrant(audience, grant)
  const callerThrow = new Error('caller getter throw')
  const caller = {}
  Object.defineProperty(caller, 'targetId', {
    get() {
      assertAuthorityError(
        () => reserveMemoryAuthorityGrant(audience, grant),
        'authority_grant_unavailable',
      )
      throw callerThrow
    },
  })
  assert.throws(() => caller.targetId, (error) => error === callerThrow)
  assert.equal(releaseMemoryAuthorityReservation(reservation), undefined)
  const retry = reserveMemoryAuthorityGrant(audience, grant)
  assertCarrier(retry)
  assert.equal(releaseMemoryAuthorityReservation(retry), undefined)
})

test('M2-B-01 wrong audience and target/verb mismatches fail closed', () => {
  const first = makeBound()
  const second = makeBound(authorityRuntime, {
    ledgerId: OTHER_LEDGER_ID,
    ordinal: 2,
  })
  assertAuthorityError(
    () => reserveMemoryAuthorityGrant(second.audience, first.grant),
    'authority_scope_mismatch',
  )

  let callbackCalls = 0
  const bound = makeBound(authorityRuntime, {
    checkGrantActive: () => {
      callbackCalls += 1
      return true
    },
    ordinal: 3,
  })
  let reservation = reserveMemoryAuthorityGrant(bound.audience, bound.grant)
  assertAuthorityError(
    () => authorizeMemoryAuthorityReservation(
      reservation,
      OTHER_TARGET_ID,
      'erase_atom',
    ),
    'authority_grant_mismatch',
  )
  assert.equal(callbackCalls, 0)

  reservation = reserveMemoryAuthorityGrant(bound.audience, bound.grant)
  assertAuthorityError(
    () => authorizeMemoryAuthorityReservation(
      reservation,
      TARGET_ID,
      'delete',
    ),
    'authority_grant_mismatch',
  )
  assert.equal(callbackCalls, 0)

  reservation = reserveMemoryAuthorityGrant(bound.audience, bound.grant)
  assert.equal(
    authorizeMemoryAuthorityReservation(
      reservation,
      TARGET_ID,
      'erase_atom',
    ).targetId,
    TARGET_ID,
  )
  assert.equal(callbackCalls, 1)
})

test('M2-B-01 terminal grant state wins before foreign-audience mismatch', () => {
  const foreign = makeBound(authorityRuntime, {
    ledgerId: OTHER_LEDGER_ID,
    ordinal: 90,
  })

  const reserved = makeBound(authorityRuntime, { ordinal: 91 })
  const reservedToken = reserveMemoryAuthorityGrant(
    reserved.audience,
    reserved.grant,
  )
  assertAuthorityError(
    () => reserveMemoryAuthorityGrant(foreign.audience, reserved.grant),
    'authority_grant_unavailable',
  )
  releaseMemoryAuthorityReservation(reservedToken)

  const revoked = makeBound(authorityRuntime, { ordinal: 92 })
  revokeMemoryAuthorityGrant(revoked.root, revoked.grant)
  assertAuthorityError(
    () => reserveMemoryAuthorityGrant(foreign.audience, revoked.grant),
    'authority_grant_unavailable',
  )

  const burned = makeBound(authorityRuntime, { ordinal: 93 })
  const burnedToken = reserveMemoryAuthorityGrant(
    burned.audience,
    burned.grant,
  )
  authorizeMemoryAuthorityReservation(
    burnedToken,
    TARGET_ID,
    'erase_atom',
  )
  burnMemoryAuthorityReservation(burnedToken)
  assertAuthorityError(
    () => reserveMemoryAuthorityGrant(foreign.audience, burned.grant),
    'authority_grant_unavailable',
  )

  const retired = makeBound(authorityRuntime, { ordinal: 94 })
  retireMemoryAuthorityAudience(retired.audience)
  assertAuthorityError(
    () => reserveMemoryAuthorityGrant(foreign.audience, retired.grant),
    'authority_grant_unavailable',
  )
})

test('M2-B-01 use callback receives one exact frozen tuple and strict undefined receiver', () => {
  let callbackCalls = 0
  let observedThis = 'unset'
  let callbackRecord
  const checkGrantActive = function checkGrantActive(record) {
    'use strict'
    callbackCalls += 1
    observedThis = this
    callbackRecord = record
    return true
  }
  const { audience, grant } = makeBound(authorityRuntime, {
    checkGrantActive,
  })
  const reservation = reserveMemoryAuthorityGrant(audience, grant)
  const snapshot = authorizeMemoryAuthorityReservation(
    reservation,
    TARGET_ID,
    'erase_atom',
  )

  assert.equal(callbackCalls, 1)
  assert.equal(observedThis, undefined)
  assert.equal(Object.getPrototypeOf(callbackRecord), null)
  assert.equal(Object.isFrozen(callbackRecord), true)
  assert.deepEqual(Reflect.ownKeys(callbackRecord), CALLBACK_KEYS)
  assert.deepEqual(callbackRecord, nullRecord({
    authorityProfile: 'host-checked-external-grant-v1',
    authorityLedgerId: LEDGER_ID,
    authorityEventId: authorityEventId(1),
    capabilityId: capabilityId(1),
    workspaceId: WORKSPACE_ID,
    palariId: PALARI_ID,
    userId: USER_ID,
    targetId: TARGET_ID,
    verb: 'erase_atom',
    evidenceAt: EVIDENCE_AT,
    issuedAt: callbackRecord.issuedAt,
    expiresAt: EXPIRES_AT,
  }))
  for (const key of CALLBACK_KEYS) {
    const descriptor = Object.getOwnPropertyDescriptor(callbackRecord, key)
    assert.equal(descriptor.enumerable, true)
    assert.equal(descriptor.configurable, false)
    assert.equal(descriptor.writable, false)
  }

  assert.equal(Object.getPrototypeOf(snapshot), null)
  assert.equal(Object.isFrozen(snapshot), true)
  assert.deepEqual(Reflect.ownKeys(snapshot), SNAPSHOT_KEYS)
  assert.deepEqual(snapshot, nullRecord({
    authorityProfile: 'host-checked-external-grant-v1',
    authorityKind: 'user',
    authorityId: USER_ID,
    authorityLedgerId: LEDGER_ID,
    authorityEventId: authorityEventId(1),
    capabilityId: capabilityId(1),
    workspaceId: WORKSPACE_ID,
    palariId: PALARI_ID,
    userId: USER_ID,
    targetId: TARGET_ID,
    verb: 'erase_atom',
    evidenceKind: 'ratified_user',
    evidenceStrength: 1.0,
    evidenceAt: EVIDENCE_AT,
    issuedAt: callbackRecord.issuedAt,
    effectiveAt: snapshot.observedAt,
    observedAt: snapshot.observedAt,
    expiresAt: EXPIRES_AT,
  }))
  assert.equal('root' in snapshot, false)
  assert.equal('grant' in snapshot, false)
  assert.equal('reservation' in snapshot, false)
  assert.equal('checkGrantActive' in snapshot, false)
})

test('M2-B-01 bound predicate keeps its receiver instead of the supplied undefined', () => {
  const receiver = Object.freeze({ marker: 'bound receiver' })
  let observedThis
  function checkGrantActive() {
    observedThis = this
    return true
  }
  const bound = makeBound(authorityRuntime, {
    checkGrantActive: checkGrantActive.bind(receiver),
  })
  const reservation = reserveMemoryAuthorityGrant(bound.audience, bound.grant)
  authorizeMemoryAuthorityReservation(reservation, TARGET_ID, 'erase_atom')
  assert.equal(observedThis, receiver)
})

test('M2-B-01 sloppy and bound-Proxy predicates retain ECMAScript receiver law', () => {
  let sloppyThis
  const sloppyPredicate = Function(
    'observe',
    'return function () { observe(this); return true }',
  )((value) => { sloppyThis = value })
  const sloppy = makeBound(authorityRuntime, {
    checkGrantActive: sloppyPredicate,
    ordinal: 95,
  })
  let reservation = reserveMemoryAuthorityGrant(
    sloppy.audience,
    sloppy.grant,
  )
  authorizeMemoryAuthorityReservation(reservation, TARGET_ID, 'erase_atom')
  assert.equal(sloppyThis, globalThis)

  const receiver = Object.freeze({ marker: 'proxy-bound receiver' })
  let applyCalls = 0
  let proxyThis
  const target = function target() {
    proxyThis = this
    return true
  }
  const proxy = new Proxy(target, {
    apply(innerTarget, thisArgument, parameters) {
      applyCalls += 1
      return Reflect.apply(innerTarget, thisArgument, parameters)
    },
  })
  const boundProxy = Function.prototype.bind.call(proxy, receiver)
  const wrapped = makeBound(authorityRuntime, {
    checkGrantActive: boundProxy,
    ordinal: 96,
  })
  reservation = reserveMemoryAuthorityGrant(wrapped.audience, wrapped.grant)
  authorizeMemoryAuthorityReservation(reservation, TARGET_ID, 'erase_atom')
  assert.equal(applyCalls, 1)
  assert.equal(proxyThis, receiver)
})

for (const thrownValue of [undefined, null]) {
  test(`M2-B-01 callback throw ${String(thrownValue)} preserves cause presence`, () => {
    let callbackCalls = 0
    const bound = makeBound(authorityRuntime, {
      checkGrantActive: () => {
        callbackCalls += 1
        throw thrownValue
      },
    })
    let reservation = reserveMemoryAuthorityGrant(bound.audience, bound.grant)
    assertAuthorityError(
      () => authorizeMemoryAuthorityReservation(
        reservation,
        TARGET_ID,
        'erase_atom',
      ),
      'authority_ledger_unavailable',
      { cause: thrownValue, causePresent: true },
    )
    reservation = reserveMemoryAuthorityGrant(bound.audience, bound.grant)
    assertAuthorityError(
      () => authorizeMemoryAuthorityReservation(
        reservation,
        TARGET_ID,
        'erase_atom',
      ),
      'authority_ledger_unavailable',
      { cause: thrownValue, causePresent: true },
    )
    assert.equal(callbackCalls, 2, 'a proven no-use callback throw releases')
  })
}

test('M2-B-01 callback throw identity is preserved and an accepted class fails at apply', () => {
  const primary = Object.freeze({ marker: 'predicate primary' })
  const throwing = makeBound(authorityRuntime, {
    checkGrantActive: () => { throw primary },
  })
  let reservation = reserveMemoryAuthorityGrant(
    throwing.audience,
    throwing.grant,
  )
  assertAuthorityError(
    () => authorizeMemoryAuthorityReservation(
      reservation,
      TARGET_ID,
      'erase_atom',
    ),
    'authority_ledger_unavailable',
    { cause: primary, causePresent: true },
  )

  class PredicateClass {}
  const classBound = makeBound(authorityRuntime, {
    checkGrantActive: PredicateClass,
    ordinal: 2,
  })
  reservation = reserveMemoryAuthorityGrant(
    classBound.audience,
    classBound.grant,
  )
  let captured
  assert.throws(
    () => authorizeMemoryAuthorityReservation(
      reservation,
      TARGET_ID,
      'erase_atom',
    ),
    (error) => {
      captured = error
      return error?.code === 'authority_ledger_unavailable'
    },
  )
  assert.equal(captured instanceof MemoryAuthorityError, true)
  assert.equal(Object.hasOwn(captured, 'cause'), true)
  assert.equal(captured.cause instanceof TypeError, true)
})

test('M2-B-01 false revokes, while non-boolean protocol failures retire all grants', () => {
  const inactive = makeBound(authorityRuntime, {
    checkGrantActive: () => false,
  })
  let reservation = reserveMemoryAuthorityGrant(
    inactive.audience,
    inactive.grant,
  )
  assertAuthorityError(
    () => authorizeMemoryAuthorityReservation(
      reservation,
      TARGET_ID,
      'erase_atom',
    ),
    'authority_ledger_unavailable',
  )
  assertAuthorityError(
    () => reserveMemoryAuthorityGrant(inactive.audience, inactive.grant),
    'authority_grant_unavailable',
  )

  let thenReads = 0
  const thenable = Object.create(null)
  Object.defineProperty(thenable, 'then', {
    get() {
      thenReads += 1
      throw new Error('then must not be inspected')
    },
  })
  const protocol = makeBound(authorityRuntime, {
    checkGrantActive: () => thenable,
    ordinal: 2,
  })
  const sibling = issueMemoryAuthorityGrant(protocol.root, grantInput(3))
  reservation = reserveMemoryAuthorityGrant(protocol.audience, protocol.grant)
  assertAuthorityError(
    () => authorizeMemoryAuthorityReservation(
      reservation,
      TARGET_ID,
      'erase_atom',
    ),
    'authority_ledger_protocol',
  )
  assert.equal(thenReads, 0)
  assertAuthorityError(
    () => reserveMemoryAuthorityGrant(protocol.audience, sibling),
    'authority_grant_unavailable',
  )
})

test('M2-B-01 same-grant callback reentry cannot consume the reservation', () => {
  let audience
  let grant
  let reentryError
  const checkGrantActive = () => {
    reentryError = assertAuthorityError(
      () => reserveMemoryAuthorityGrant(audience, grant),
      'authority_grant_unavailable',
    )
    return true
  }
  const bound = makeBound(authorityRuntime, { checkGrantActive })
  audience = bound.audience
  grant = bound.grant
  const reservation = reserveMemoryAuthorityGrant(audience, grant)
  const snapshot = authorizeMemoryAuthorityReservation(
    reservation,
    TARGET_ID,
    'erase_atom',
  )
  assert.equal(reentryError.code, 'authority_grant_unavailable')
  assert.equal(snapshot.targetId, TARGET_ID)
})

test('M2-B-01 callback-time root, grant, and audience retirement win postcheck', () => {
  let rootBound
  rootBound = makeBound(authorityRuntime, {
    checkGrantActive: () => {
      revokeMemoryAuthorityRoot(rootBound.root)
      return true
    },
  })
  let reservation = reserveMemoryAuthorityGrant(
    rootBound.audience,
    rootBound.grant,
  )
  assertAuthorityError(
    () => authorizeMemoryAuthorityReservation(
      reservation,
      TARGET_ID,
      'erase_atom',
    ),
    'authority_root_revoked',
  )

  let grantBound
  grantBound = makeBound(authorityRuntime, {
    checkGrantActive: () => {
      revokeMemoryAuthorityGrant(grantBound.root, grantBound.grant)
      return true
    },
    ordinal: 2,
  })
  reservation = reserveMemoryAuthorityGrant(
    grantBound.audience,
    grantBound.grant,
  )
  assertAuthorityError(
    () => authorizeMemoryAuthorityReservation(
      reservation,
      TARGET_ID,
      'erase_atom',
    ),
    'authority_grant_unavailable',
  )

  let audienceBound
  audienceBound = makeBound(authorityRuntime, {
    checkGrantActive: () => {
      retireMemoryAuthorityAudience(audienceBound.audience)
      return true
    },
    ordinal: 3,
  })
  reservation = reserveMemoryAuthorityGrant(
    audienceBound.audience,
    audienceBound.grant,
  )
  assertAuthorityError(
    () => authorizeMemoryAuthorityReservation(
      reservation,
      TARGET_ID,
      'erase_atom',
    ),
    'authority_root_revoked',
  )
})

test('M2-B-01 post-callback local state suppresses callback outcome and cause', () => {
  const callbackCause = Object.freeze({ marker: 'suppressed callback cause' })

  let rootBound
  rootBound = makeBound(authorityRuntime, {
    checkGrantActive: () => {
      revokeMemoryAuthorityRoot(rootBound.root)
      throw callbackCause
    },
    ordinal: 97,
  })
  let reservation = reserveMemoryAuthorityGrant(
    rootBound.audience,
    rootBound.grant,
  )
  assertAuthorityError(
    () => authorizeMemoryAuthorityReservation(
      reservation,
      TARGET_ID,
      'erase_atom',
    ),
    'authority_root_revoked',
  )

  let grantBound
  grantBound = makeBound(authorityRuntime, {
    checkGrantActive: () => {
      revokeMemoryAuthorityGrant(grantBound.root, grantBound.grant)
      return false
    },
    ordinal: 98,
  })
  reservation = reserveMemoryAuthorityGrant(
    grantBound.audience,
    grantBound.grant,
  )
  assertAuthorityError(
    () => authorizeMemoryAuthorityReservation(
      reservation,
      TARGET_ID,
      'erase_atom',
    ),
    'authority_grant_unavailable',
  )

  let audienceBound
  audienceBound = makeBound(authorityRuntime, {
    checkGrantActive: () => {
      retireMemoryAuthorityAudience(audienceBound.audience)
      return Promise.resolve(true)
    },
    ordinal: 99,
  })
  reservation = reserveMemoryAuthorityGrant(
    audienceBound.audience,
    audienceBound.grant,
  )
  assertAuthorityError(
    () => authorizeMemoryAuthorityReservation(
      reservation,
      TARGET_ID,
      'erase_atom',
    ),
    'authority_root_revoked',
  )
})

test('M2-B-01 invalid and decreasing issuance clocks retire without coercion', async () => {
  const issuedAt = Date.parse('2026-07-21T10:00:00.000Z')
  let coercionCalls = 0
  const coercible = Object.freeze({
    valueOf() {
      coercionCalls += 1
      return issuedAt
    },
  })
  const invalidReadings = [
    THROW_NATIVE_CLOCK,
    '1784628000000',
    Number.POSITIVE_INFINITY,
    issuedAt + 0.5,
    8_640_000_000_000_000,
    coercible,
  ]

  for (const reading of invalidReadings) {
    const { runtime } = await importRuntimeWithClock([reading])
    const root = runtime.createMemoryAuthorityRoot(rootInput())
    runtime.bindMemoryAuthorityRoot(root, WORKSPACE_ID, undefined)
    assertAuthorityError(
      () => runtime.issueMemoryAuthorityGrant(root, grantInput(1, {
        evidenceAt: '2026-07-21T09:59:59.999Z',
        expiresAt: '2026-07-21T10:00:01.000Z',
      })),
      'authority_clock_invalid',
      { ErrorClass: runtime.MemoryAuthorityError },
    )
    assertAuthorityError(
      () => runtime.preflightMemoryAuthorityRoot(root, WORKSPACE_ID),
      'authority_root_revoked',
      { ErrorClass: runtime.MemoryAuthorityError },
    )
  }
  assert.equal(coercionCalls, 0)

  const { runtime } = await importRuntimeWithClock([
    issuedAt + 1,
    issuedAt,
  ])
  const root = runtime.createMemoryAuthorityRoot(rootInput())
  runtime.bindMemoryAuthorityRoot(root, WORKSPACE_ID, undefined)
  runtime.issueMemoryAuthorityGrant(root, grantInput(1, {
    evidenceAt: '2026-07-21T09:59:59.999Z',
    expiresAt: '2026-07-21T10:00:01.000Z',
  }))
  assertAuthorityError(
    () => runtime.issueMemoryAuthorityGrant(root, grantInput(2, {
      evidenceAt: '2026-07-21T09:59:59.999Z',
      expiresAt: '2026-07-21T10:00:01.000Z',
    })),
    'authority_clock_invalid',
    { ErrorClass: runtime.MemoryAuthorityError },
  )
})

test('M2-B-01 valid samples advance high-water before chronology and expiry fail', async () => {
  const issuedAt = Date.parse('2026-07-21T10:00:00.000Z')
  let instrumented = await importRuntimeWithClock([
    issuedAt + 2,
    issuedAt + 1,
  ])
  let root = instrumented.runtime.createMemoryAuthorityRoot(rootInput())
  instrumented.runtime.bindMemoryAuthorityRoot(root, WORKSPACE_ID, undefined)
  assertAuthorityError(
    () => instrumented.runtime.issueMemoryAuthorityGrant(root, grantInput(1, {
      evidenceAt: '2026-07-21T10:00:00.003Z',
      expiresAt: '2026-07-21T10:00:01.000Z',
    })),
    'authority_invalid_argument',
    { ErrorClass: instrumented.runtime.MemoryAuthorityError },
  )
  assertAuthorityError(
    () => instrumented.runtime.issueMemoryAuthorityGrant(root, grantInput(1, {
      evidenceAt: '2026-07-21T09:59:59.999Z',
      expiresAt: '2026-07-21T10:00:01.000Z',
    })),
    'authority_clock_invalid',
    { ErrorClass: instrumented.runtime.MemoryAuthorityError },
  )

  const expiresAt = issuedAt + 2
  instrumented = await importRuntimeWithClock([
    issuedAt,
    expiresAt,
    issuedAt + 1,
  ])
  const bound = makeBound(instrumented.runtime, {
    grantOverrides: {
      evidenceAt: '2026-07-21T09:59:59.999Z',
      expiresAt: '2026-07-21T10:00:00.002Z',
    },
  })
  const reservation = instrumented.runtime.reserveMemoryAuthorityGrant(
    bound.audience,
    bound.grant,
  )
  assertAuthorityError(
    () => instrumented.runtime.authorizeMemoryAuthorityReservation(
      reservation,
      TARGET_ID,
      'erase_atom',
    ),
    'authority_grant_expired',
    { ErrorClass: instrumented.runtime.MemoryAuthorityError },
  )
  assertAuthorityError(
    () => instrumented.runtime.issueMemoryAuthorityGrant(
      bound.root,
      grantInput(2, {
        evidenceAt: '2026-07-21T09:59:59.999Z',
        expiresAt: '2026-07-21T10:00:01.000Z',
      }),
    ),
    'authority_clock_invalid',
    { ErrorClass: instrumented.runtime.MemoryAuthorityError },
  )
})

test('M2-B-01 only primitive true samples observed time exactly once', async () => {
  const issuedAt = Date.parse('2026-07-21T10:00:00.000Z')
  const observedAt = issuedAt + 1
  const commonGrant = {
    evidenceAt: '2026-07-21T09:59:59.999Z',
    expiresAt: '2026-07-21T10:00:01.000Z',
  }
  const predicateFailure = new Error('predicate failed')
  const scenarios = [
    {
      callback: () => false,
      code: 'authority_ledger_unavailable',
    },
    {
      callback: () => { throw predicateFailure },
      cause: predicateFailure,
      code: 'authority_ledger_unavailable',
    },
    {
      callback: () => Object.create(null),
      code: 'authority_ledger_protocol',
    },
  ]

  let ordinal = 120
  for (const scenario of scenarios) {
    const { getCallCount, runtime } = await importRuntimeWithClock([
      issuedAt,
      observedAt,
    ])
    let callbackCalls = 0
    const bound = makeBound(runtime, {
      checkGrantActive: (...parameters) => {
        callbackCalls += 1
        return scenario.callback(...parameters)
      },
      grantOverrides: commonGrant,
      ordinal,
    })
    const reservation = runtime.reserveMemoryAuthorityGrant(
      bound.audience,
      bound.grant,
    )
    assertAuthorityError(
      () => runtime.authorizeMemoryAuthorityReservation(
        reservation,
        TARGET_ID,
        'erase_atom',
      ),
      scenario.code,
      {
        ErrorClass: runtime.MemoryAuthorityError,
        cause: scenario.cause,
        causePresent: Object.hasOwn(scenario, 'cause'),
      },
    )
    assert.equal(callbackCalls, 1)
    assert.equal(getCallCount(), 1)
    ordinal += 1
  }

  const mismatch = await importRuntimeWithClock([issuedAt, observedAt])
  let mismatchCallbackCalls = 0
  const mismatchBound = makeBound(mismatch.runtime, {
    checkGrantActive: () => {
      mismatchCallbackCalls += 1
      return true
    },
    grantOverrides: commonGrant,
    ordinal: 123,
  })
  let reservation = mismatch.runtime.reserveMemoryAuthorityGrant(
    mismatchBound.audience,
    mismatchBound.grant,
  )
  assertAuthorityError(
    () => mismatch.runtime.authorizeMemoryAuthorityReservation(
      reservation,
      OTHER_TARGET_ID,
      'erase_atom',
    ),
    'authority_grant_mismatch',
    { ErrorClass: mismatch.runtime.MemoryAuthorityError },
  )
  assert.equal(mismatchCallbackCalls, 0)
  assert.equal(mismatch.getCallCount(), 1)

  const success = await importRuntimeWithClock([issuedAt, observedAt])
  let successCallbackCalls = 0
  const successBound = makeBound(success.runtime, {
    checkGrantActive: () => {
      successCallbackCalls += 1
      return true
    },
    grantOverrides: commonGrant,
    ordinal: 124,
  })
  reservation = success.runtime.reserveMemoryAuthorityGrant(
    successBound.audience,
    successBound.grant,
  )
  success.runtime.authorizeMemoryAuthorityReservation(
    reservation,
    TARGET_ID,
    'erase_atom',
  )
  assert.equal(successCallbackCalls, 1)
  assert.equal(success.getCallCount(), 2)
})

test('M2-B-01 native clock allows equality and derives observed/effective time', async () => {
  const reading = Date.parse('2026-07-21T10:00:00.000Z')
  const { runtime } = await importRuntimeWithClock([reading, reading])
  const bound = makeBound(runtime, {
    grantOverrides: {
      evidenceAt: '2026-07-21T09:59:59.999Z',
      expiresAt: '2026-07-21T10:00:00.001Z',
    },
  })
  const reservation = runtime.reserveMemoryAuthorityGrant(
    bound.audience,
    bound.grant,
  )
  const snapshot = runtime.authorizeMemoryAuthorityReservation(
    reservation,
    TARGET_ID,
    'erase_atom',
  )
  assert.equal(snapshot.issuedAt, '2026-07-21T10:00:00.000Z')
  assert.equal(snapshot.observedAt, '2026-07-21T10:00:00.000Z')
  assert.equal(snapshot.effectiveAt, snapshot.observedAt)
})

test('M2-B-01 expiry equality is terminal and clock failure wins over expiry', async () => {
  const issuedAt = Date.parse('2026-07-21T10:00:00.000Z')
  const expiresAt = Date.parse('2026-07-21T10:00:00.001Z')
  let instrumented = await importRuntimeWithClock([issuedAt, expiresAt])
  let bound = makeBound(instrumented.runtime, {
    grantOverrides: {
      evidenceAt: '2026-07-21T09:59:59.999Z',
      expiresAt: '2026-07-21T10:00:00.001Z',
    },
  })
  let reservation = instrumented.runtime.reserveMemoryAuthorityGrant(
    bound.audience,
    bound.grant,
  )
  assertAuthorityError(
    () => instrumented.runtime.authorizeMemoryAuthorityReservation(
      reservation,
      TARGET_ID,
      'erase_atom',
    ),
    'authority_grant_expired',
    { ErrorClass: instrumented.runtime.MemoryAuthorityError },
  )
  assertAuthorityError(
    () => instrumented.runtime.reserveMemoryAuthorityGrant(
      bound.audience,
      bound.grant,
    ),
    'authority_grant_expired',
    { ErrorClass: instrumented.runtime.MemoryAuthorityError },
  )
  const foreignRoot = instrumented.runtime.createMemoryAuthorityRoot(rootInput({
    authorityLedgerId: OTHER_LEDGER_ID,
  }))
  const foreignAudience = instrumented.runtime.bindMemoryAuthorityRoot(
    foreignRoot,
    WORKSPACE_ID,
    undefined,
  )
  instrumented.runtime.revokeMemoryAuthorityGrant(bound.root, bound.grant)
  assertAuthorityError(
    () => instrumented.runtime.reserveMemoryAuthorityGrant(
      foreignAudience,
      bound.grant,
    ),
    'authority_grant_expired',
    { ErrorClass: instrumented.runtime.MemoryAuthorityError },
  )

  const laterHighWater = Date.parse('2026-07-21T10:00:00.002Z')
  instrumented = await importRuntimeWithClock([
    issuedAt,
    laterHighWater,
    expiresAt,
  ])
  bound = makeBound(instrumented.runtime, {
    grantOverrides: {
      evidenceAt: '2026-07-21T09:59:59.999Z',
      expiresAt: '2026-07-21T10:00:00.001Z',
    },
  })
  instrumented.runtime.issueMemoryAuthorityGrant(bound.root, grantInput(2, {
    evidenceAt: '2026-07-21T10:00:00.002Z',
    expiresAt: '2026-07-21T10:00:01.000Z',
  }))
  reservation = instrumented.runtime.reserveMemoryAuthorityGrant(
    bound.audience,
    bound.grant,
  )
  assertAuthorityError(
    () => instrumented.runtime.authorizeMemoryAuthorityReservation(
      reservation,
      TARGET_ID,
      'erase_atom',
    ),
    'authority_clock_invalid',
    { ErrorClass: instrumented.runtime.MemoryAuthorityError },
  )
  assertAuthorityError(
    () => instrumented.runtime.issueMemoryAuthorityGrant(
      bound.root,
      grantInput(2),
    ),
    'authority_root_revoked',
    { ErrorClass: instrumented.runtime.MemoryAuthorityError },
  )
})

test('M2-B-01 invalid native clock permanently retires root and generation', async () => {
  const issuedAt = Date.parse('2026-07-21T10:00:00.000Z')
  const { runtime } = await importRuntimeWithClock([issuedAt, Number.NaN])
  const bound = makeBound(runtime, {
    grantOverrides: {
      evidenceAt: '2026-07-21T09:59:59.999Z',
      expiresAt: '2026-07-21T10:00:01.000Z',
    },
  })
  const reservation = runtime.reserveMemoryAuthorityGrant(
    bound.audience,
    bound.grant,
  )
  assertAuthorityError(
    () => runtime.authorizeMemoryAuthorityReservation(
      reservation,
      TARGET_ID,
      'erase_atom',
    ),
    'authority_clock_invalid',
    { ErrorClass: runtime.MemoryAuthorityError },
  )
  assertAuthorityError(
    () => runtime.preflightMemoryAuthorityRoot(bound.root, WORKSPACE_ID),
    'authority_root_revoked',
    { ErrorClass: runtime.MemoryAuthorityError },
  )
})

test('M2-B-01 release, burn, and retire have exact one-decision semantics', () => {
  let retryChecks = 0
  const released = makeBound(authorityRuntime, {
    checkGrantActive: () => {
      retryChecks += 1
      return true
    },
  })
  const firstReservation = reserveMemoryAuthorityGrant(
    released.audience,
    released.grant,
  )
  assert.equal(releaseMemoryAuthorityReservation(firstReservation), undefined)
  const laterReservation = reserveMemoryAuthorityGrant(
    released.audience,
    released.grant,
  )
  assertAuthorityError(
    () => burnMemoryAuthorityReservation(firstReservation),
    'authority_invalid_argument',
  )
  assert.equal(releaseMemoryAuthorityReservation(firstReservation), undefined)
  authorizeMemoryAuthorityReservation(
    laterReservation,
    TARGET_ID,
    'erase_atom',
  )
  assert.equal(releaseMemoryAuthorityReservation(laterReservation), undefined)
  const retryReservation = reserveMemoryAuthorityGrant(
    released.audience,
    released.grant,
  )
  authorizeMemoryAuthorityReservation(
    retryReservation,
    TARGET_ID,
    'erase_atom',
  )
  assertAuthorityError(
    () => authorizeMemoryAuthorityReservation(
      retryReservation,
      TARGET_ID,
      'erase_atom',
    ),
    'authority_grant_unavailable',
  )
  assert.equal(retryChecks, 2)
  assert.equal(releaseMemoryAuthorityReservation(retryReservation), undefined)

  const premature = makeBound(authorityRuntime, { ordinal: 125 })
  const prematureReservation = reserveMemoryAuthorityGrant(
    premature.audience,
    premature.grant,
  )
  assertAuthorityError(
    () => burnMemoryAuthorityReservation(prematureReservation),
    'authority_invalid_argument',
  )
  assert.equal(
    releaseMemoryAuthorityReservation(prematureReservation),
    undefined,
  )

  const burned = makeBound(authorityRuntime, { ordinal: 2 })
  const burnedReservation = reserveMemoryAuthorityGrant(
    burned.audience,
    burned.grant,
  )
  authorizeMemoryAuthorityReservation(
    burnedReservation,
    TARGET_ID,
    'erase_atom',
  )
  assert.equal(burnMemoryAuthorityReservation(burnedReservation), undefined)
  assert.equal(burnMemoryAuthorityReservation(burnedReservation), undefined)
  assert.equal(releaseMemoryAuthorityReservation(burnedReservation), undefined)
  assertAuthorityError(
    () => reserveMemoryAuthorityGrant(burned.audience, burned.grant),
    'authority_grant_unavailable',
  )

  const retired = makeBound(authorityRuntime, { ordinal: 3 })
  const retiredReservation = reserveMemoryAuthorityGrant(
    retired.audience,
    retired.grant,
  )
  authorizeMemoryAuthorityReservation(
    retiredReservation,
    TARGET_ID,
    'erase_atom',
  )
  assert.equal(retireMemoryAuthorityAudience(retired.audience), undefined)
  assert.equal(releaseMemoryAuthorityReservation(retiredReservation), undefined)
  assertAuthorityError(
    () => reserveMemoryAuthorityGrant(retired.audience, retired.grant),
    'authority_grant_unavailable',
  )
})

test('M2-B-01 proposal and model-facing sources cannot import or export authority', () => {
  const producerFiles = [
    'adapter.mjs',
    'gate.mjs',
    'gemini.mjs',
    'longmemeval.mjs',
    'memory-briefing.mjs',
    'memory-extraction.mjs',
    'recall.mjs',
    'slice.mjs',
  ]
  const forbiddenNames = [
    'MemoryAuthorityError',
    'createMemoryAuthorityRoot',
    'issueMemoryAuthorityGrant',
    'revokeMemoryAuthorityGrant',
    'revokeMemoryAuthorityRoot',
    'preflightMemoryAuthorityRoot',
    'bindMemoryAuthorityRoot',
    'reserveMemoryAuthorityGrant',
    'authorizeMemoryAuthorityReservation',
    'releaseMemoryAuthorityReservation',
    'burnMemoryAuthorityReservation',
    'retireMemoryAuthorityAudience',
  ]
  for (const file of producerFiles) {
    const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /from\s+['"]\.\/memory-authority(?:-runtime)?\.mjs['"]/)
    for (const name of forbiddenNames) {
      assert.equal(source.includes(name), false, `${file} discloses ${name}`)
    }
  }

  const storeSource = readFileSync(
    new URL('../src/store.mjs', import.meta.url),
    'utf8',
  )
  for (const name of forbiddenNames) {
    assert.equal(storeSource.includes(name), false, `store.mjs discloses ${name}`)
  }
})

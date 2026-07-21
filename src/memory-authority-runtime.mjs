// V2-M2-B process-local memory authority runtime.
//
// This module implements the exact host-checked-external-grant-v1 authority
// surface sealed in docs/MEMORY-AUTHORITY-CONTRACT.md. Authority carriers are
// deliberately empty: all identity and lifecycle state remains in private
// WeakMaps and cannot survive cloning or serialization.

import { types as utilTypes } from 'node:util'

const reflectApply = Reflect.apply
const reflectConstruct = Reflect.construct
const reflectDefineProperty = Reflect.defineProperty
const reflectGetOwnPropertyDescriptor = Reflect.getOwnPropertyDescriptor
const reflectGetPrototypeOf = Reflect.getPrototypeOf
const reflectOwnKeys = Reflect.ownKeys
const objectCreate = Object.create
const objectFreeze = Object.freeze
const objectHasOwnProperty = Object.prototype.hasOwnProperty
const objectPrototype = Object.prototype
const arrayPush = Array.prototype.push
const numberIsFinite = Number.isFinite
const numberIsInteger = Number.isInteger
const regexpTest = RegExp.prototype.test
const setAdd = Set.prototype.add
const setHas = Set.prototype.has
const stringIncludes = String.prototype.includes
const stringSlice = String.prototype.slice
const weakMapGet = WeakMap.prototype.get
const weakMapSet = WeakMap.prototype.set
const dateNow = Date.now
const dateParse = Date.parse
const dateToISOString = Date.prototype.toISOString
const nativeDate = Date
const nativeError = Error
const nativeSet = Set
const nativeTypeError = TypeError
const isProxy = utilTypes.isProxy

const AUTHORITY_PROFILE = 'host-checked-external-grant-v1'
const ERASE_ATOM = 'erase_atom'

const ERROR_MESSAGES = objectFreeze({
  __proto__: null,
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

const ERROR_CODE_SET = new nativeSet()
const errorCodes = reflectOwnKeys(ERROR_MESSAGES)
for (let index = 0; index < errorCodes.length; index += 1) {
  reflectApply(setAdd, ERROR_CODE_SET, [errorCodes[index]])
}

const ROOT_INPUT_KEYS = objectFreeze([
  'workspaceId',
  'palariId',
  'userId',
  'authorityLedgerId',
  'checkGrantActive',
])

const GRANT_INPUT_KEYS = objectFreeze([
  'authorityEventId',
  'capabilityId',
  'evidenceAt',
  'expiresAt',
  'targetId',
  'verb',
])

const WORKSPACE_PATTERN = /^[a-z0-9][a-z0-9-]*$/
const WORKSPACE_FINAL_PATTERN = /[a-z0-9]$/
const PALARI_USER_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/
const UUID_V4_BODY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

const rootStates = new WeakMap()
const audienceStates = new WeakMap()
const grantStates = new WeakMap()
const reservationStates = new WeakMap()

function throwNativeTypeError(message) {
  throw reflectConstruct(nativeTypeError, [message])
}

export class MemoryAuthorityError extends nativeError {
  constructor(code, message, cause) {
    if (
      typeof code !== 'string' ||
      !reflectApply(setHas, ERROR_CODE_SET, [code])
    ) {
      throwNativeTypeError('Unknown memory authority error code.')
    }
    if (typeof message !== 'string' || message === '') {
      throwNativeTypeError(
        'Memory authority error message must be a non-empty string.',
      )
    }

    const hasCause = arguments.length >= 3
    const error = reflectConstruct(
      nativeError,
      hasCause
        ? [message, { __proto__: null, cause }]
        : [message],
      memoryAuthorityErrorNewTarget,
    )
    reflectApply(reflectDefineProperty, undefined, [error, 'name', {
      __proto__: null,
      value: 'MemoryAuthorityError',
      enumerable: false,
      configurable: true,
      writable: true,
    }])
    reflectApply(reflectDefineProperty, undefined, [error, 'code', {
      __proto__: null,
      value: code,
      enumerable: true,
      configurable: false,
      writable: false,
    }])
    return error
  }
}

const memoryAuthorityErrorNewTarget = MemoryAuthorityError

function authorityFailure(code) {
  return reflectConstruct(MemoryAuthorityError, [code, ERROR_MESSAGES[code]])
}

function authorityFailureWithCause(code, cause) {
  return reflectConstruct(MemoryAuthorityError, [
    code,
    ERROR_MESSAGES[code],
    cause,
  ])
}

function isExpectedKey(key, expectedKeys) {
  for (let index = 0; index < expectedKeys.length; index += 1) {
    if (key === expectedKeys[index]) return true
  }
  return false
}

function captureExactRecord(input, expectedKeys) {
  if (reflectApply(isProxy, undefined, [input])) return undefined
  if (input === null || typeof input !== 'object') return undefined

  let prototype
  let ownKeys
  try {
    prototype = reflectApply(reflectGetPrototypeOf, undefined, [input])
    ownKeys = reflectApply(reflectOwnKeys, undefined, [input])
  } catch {
    return undefined
  }
  if (prototype !== objectPrototype && prototype !== null) return undefined
  if (ownKeys.length !== expectedKeys.length) return undefined
  for (let index = 0; index < ownKeys.length; index += 1) {
    const key = ownKeys[index]
    if (typeof key !== 'string' || !isExpectedKey(key, expectedKeys)) {
      return undefined
    }
  }

  const captured = objectCreate(null)
  for (let index = 0; index < expectedKeys.length; index += 1) {
    const key = expectedKeys[index]
    let descriptor
    try {
      descriptor = reflectApply(
        reflectGetOwnPropertyDescriptor,
        undefined,
        [input, key],
      )
    } catch {
      return undefined
    }
    if (
      descriptor === undefined ||
      !reflectApply(objectHasOwnProperty, descriptor, ['value'])
    ) {
      return undefined
    }
    captured[key] = descriptor.value
  }
  return captured
}

function matches(pattern, value) {
  return reflectApply(regexpTest, pattern, [value])
}

function isWorkspaceId(value) {
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > 48 ||
    !matches(WORKSPACE_PATTERN, value) ||
    reflectApply(stringIncludes, value, ['--'])
  ) {
    return false
  }
  if (value.length === 48) return true
  return matches(WORKSPACE_FINAL_PATTERN, value)
}

function isPalariOrUserId(value) {
  return typeof value === 'string' && matches(PALARI_USER_PATTERN, value)
}

function isPrefixedUuidV4(value, prefix) {
  return (
    typeof value === 'string' &&
    value.length === prefix.length + 36 &&
    reflectApply(stringSlice, value, [0, prefix.length]) === prefix &&
    matches(
      UUID_V4_BODY_PATTERN,
      reflectApply(stringSlice, value, [prefix.length]),
    )
  )
}

function millisecondsToTimestamp(milliseconds) {
  try {
    const value = reflectConstruct(nativeDate, [milliseconds])
    const timestamp = reflectApply(dateToISOString, value, [])
    return typeof timestamp === 'string' && timestamp.length === 24
      ? timestamp
      : undefined
  } catch {
    return undefined
  }
}

function parseCanonicalTimestamp(value) {
  if (typeof value !== 'string' || value.length !== 24) return undefined
  let milliseconds
  try {
    milliseconds = reflectApply(dateParse, nativeDate, [value])
  } catch {
    return undefined
  }
  if (!reflectApply(numberIsFinite, undefined, [milliseconds])) {
    return undefined
  }
  return millisecondsToTimestamp(milliseconds) === value
    ? milliseconds
    : undefined
}

function makeCarrier(states, state) {
  const carrier = objectCreate(null)
  reflectApply(weakMapSet, states, [carrier, state])
  return objectFreeze(carrier)
}

function getRootState(root) {
  return reflectApply(weakMapGet, rootStates, [root])
}

function getAudienceState(audience) {
  return reflectApply(weakMapGet, audienceStates, [audience])
}

function getGrantState(grant) {
  return reflectApply(weakMapGet, grantStates, [grant])
}

function getReservationState(reservation) {
  return reflectApply(weakMapGet, reservationStates, [reservation])
}

function assertRootBrand(root) {
  const state = getRootState(root)
  if (state === undefined) {
    throw authorityFailure('authority_root_invalid')
  }
  return state
}

function assertAudienceBrand(audience) {
  const state = getAudienceState(audience)
  if (state === undefined) {
    throw authorityFailure('authority_invalid_argument')
  }
  return state
}

function assertGrantBrand(grant) {
  const state = getGrantState(grant)
  if (state === undefined) {
    throw authorityFailure('authority_grant_invalid')
  }
  return state
}

function assertReservationBrand(reservation) {
  const state = getReservationState(reservation)
  if (state === undefined) {
    throw authorityFailure('authority_invalid_argument')
  }
  return state
}

function endGrantReservation(grantState, terminalState) {
  const reservationState = grantState.reservationState
  grantState.status = terminalState
  grantState.reservationState = undefined
  if (reservationState !== undefined) {
    reservationState.phase = terminalState
  }
}

function retireRootState(rootState) {
  if (rootState.status === 'retired') return
  rootState.status = 'retired'
  if (rootState.audienceState !== undefined) {
    rootState.audienceState.live = false
  }
  for (let index = 0; index < rootState.grants.length; index += 1) {
    const grantState = rootState.grants[index]
    if (grantState.status === 'available' || grantState.status === 'reserved') {
      endGrantReservation(grantState, 'retired')
    }
  }
}

function sampleNativeClock(rootState) {
  let milliseconds
  try {
    milliseconds = reflectApply(dateNow, nativeDate, [])
  } catch {
    retireRootState(rootState)
    throw authorityFailure('authority_clock_invalid')
  }
  if (
    typeof milliseconds !== 'number' ||
    !reflectApply(numberIsFinite, undefined, [milliseconds]) ||
    !reflectApply(numberIsInteger, undefined, [milliseconds]) ||
    (
      rootState.clockHighWater !== undefined &&
      milliseconds < rootState.clockHighWater
    )
  ) {
    retireRootState(rootState)
    throw authorityFailure('authority_clock_invalid')
  }

  const timestamp = millisecondsToTimestamp(milliseconds)
  if (timestamp === undefined) {
    retireRootState(rootState)
    throw authorityFailure('authority_clock_invalid')
  }
  rootState.clockHighWater = milliseconds
  return { __proto__: null, milliseconds, timestamp }
}

function conditionalRelease(reservationState) {
  const { audienceState, grantState, rootState } = reservationState
  if (
    rootState.status === 'live' &&
    rootState.audienceState === audienceState &&
    audienceState.live === true &&
    grantState.audienceState === audienceState &&
    grantState.status === 'reserved' &&
    grantState.reservationState === reservationState &&
    (
      reservationState.phase === 'reserved' ||
      reservationState.phase === 'checking' ||
      reservationState.phase === 'authorized'
    )
  ) {
    grantState.status = 'available'
    grantState.reservationState = undefined
    reservationState.phase = 'released'
  }
}

function assertReservationUseState(reservationState, expectedPhase) {
  const { audienceState, grantState, rootState } = reservationState
  if (rootState.status === 'retired') {
    throw authorityFailure('authority_root_revoked')
  }
  if (
    rootState.status !== 'live' ||
    rootState.audienceState !== audienceState ||
    audienceState.live !== true ||
    grantState.audienceState !== audienceState
  ) {
    throw authorityFailure('authority_scope_mismatch')
  }
  if (grantState.status === 'expired') {
    throw authorityFailure('authority_grant_expired')
  }
  if (
    grantState.status !== 'reserved' ||
    grantState.reservationState !== reservationState ||
    reservationState.phase !== expectedPhase
  ) {
    throw authorityFailure('authority_grant_unavailable')
  }
}

function makeActivityRecord(grantState) {
  const { rootState } = grantState
  return objectFreeze({
    __proto__: null,
    authorityProfile: AUTHORITY_PROFILE,
    authorityLedgerId: rootState.authorityLedgerId,
    authorityEventId: grantState.authorityEventId,
    capabilityId: grantState.capabilityId,
    workspaceId: rootState.workspaceId,
    palariId: rootState.palariId,
    userId: rootState.userId,
    targetId: grantState.targetId,
    verb: ERASE_ATOM,
    evidenceAt: grantState.evidenceAt,
    issuedAt: grantState.issuedAt,
    expiresAt: grantState.expiresAt,
  })
}

function makeAuthorizationSnapshot(grantState, observedAt) {
  const { rootState } = grantState
  return objectFreeze({
    __proto__: null,
    authorityProfile: AUTHORITY_PROFILE,
    authorityKind: 'user',
    authorityId: rootState.userId,
    authorityLedgerId: rootState.authorityLedgerId,
    authorityEventId: grantState.authorityEventId,
    capabilityId: grantState.capabilityId,
    workspaceId: rootState.workspaceId,
    palariId: rootState.palariId,
    userId: rootState.userId,
    targetId: grantState.targetId,
    verb: ERASE_ATOM,
    evidenceKind: 'ratified_user',
    evidenceStrength: 1.0,
    evidenceAt: grantState.evidenceAt,
    issuedAt: grantState.issuedAt,
    effectiveAt: observedAt,
    observedAt,
    expiresAt: grantState.expiresAt,
  })
}

export function createMemoryAuthorityRoot(input) {
  const captured = captureExactRecord(input, ROOT_INPUT_KEYS)
  if (
    captured === undefined ||
    !isWorkspaceId(captured.workspaceId) ||
    !isPalariOrUserId(captured.palariId) ||
    !isPalariOrUserId(captured.userId) ||
    !isPrefixedUuidV4(captured.authorityLedgerId, 'led_') ||
    typeof captured.checkGrantActive !== 'function' ||
    reflectApply(isProxy, undefined, [captured.checkGrantActive])
  ) {
    throw authorityFailure('authority_invalid_argument')
  }

  const state = {
    __proto__: null,
    workspaceId: captured.workspaceId,
    palariId: captured.palariId,
    userId: captured.userId,
    authorityLedgerId: captured.authorityLedgerId,
    checkGrantActive: captured.checkGrantActive,
    status: 'unbound',
    audienceState: undefined,
    clockHighWater: undefined,
    authorityEventIds: new nativeSet(),
    capabilityIds: new nativeSet(),
    grants: [],
  }
  const root = makeCarrier(rootStates, state)
  state.root = root
  return root
}

export function preflightMemoryAuthorityRoot(root, workspaceId) {
  const state = assertRootBrand(root)
  if (state.status === 'retired') {
    throw authorityFailure('authority_root_revoked')
  }
  if (state.status === 'live') {
    throw authorityFailure('authority_root_busy')
  }
  if (!isWorkspaceId(workspaceId)) {
    throw authorityFailure('authority_invalid_argument')
  }
  if (workspaceId !== state.workspaceId) {
    throw authorityFailure('authority_scope_mismatch')
  }
  return undefined
}

export function bindMemoryAuthorityRoot(
  root,
  workspaceId,
  establishedAuthorityLedgerId,
) {
  const state = assertRootBrand(root)
  if (state.status === 'retired') {
    throw authorityFailure('authority_root_revoked')
  }
  if (state.status === 'live') {
    throw authorityFailure('authority_root_busy')
  }
  if (!isWorkspaceId(workspaceId)) {
    throw authorityFailure('authority_invalid_argument')
  }
  if (workspaceId !== state.workspaceId) {
    throw authorityFailure('authority_scope_mismatch')
  }
  if (
    establishedAuthorityLedgerId !== undefined &&
    !isPrefixedUuidV4(establishedAuthorityLedgerId, 'led_')
  ) {
    throw authorityFailure('authority_invalid_argument')
  }
  if (
    establishedAuthorityLedgerId !== undefined &&
    establishedAuthorityLedgerId !== state.authorityLedgerId
  ) {
    throw authorityFailure('authority_scope_mismatch')
  }

  const audienceState = {
    __proto__: null,
    rootState: state,
    live: true,
  }
  const audience = makeCarrier(audienceStates, audienceState)
  audienceState.audience = audience
  state.audienceState = audienceState
  state.status = 'live'
  return audience
}

export function retireMemoryAuthorityAudience(audience) {
  const state = assertAudienceBrand(audience)
  retireRootState(state.rootState)
  return undefined
}

export function issueMemoryAuthorityGrant(root, input) {
  const rootState = assertRootBrand(root)
  if (rootState.status === 'retired') {
    throw authorityFailure('authority_root_revoked')
  }
  if (rootState.status !== 'live') {
    throw authorityFailure('authority_root_unbound')
  }

  const captured = captureExactRecord(input, GRANT_INPUT_KEYS)
  if (captured === undefined) {
    throw authorityFailure('authority_invalid_argument')
  }
  if (!isPrefixedUuidV4(captured.authorityEventId, 'agr_')) {
    throw authorityFailure('authority_invalid_argument')
  }
  if (!isPrefixedUuidV4(captured.capabilityId, 'cap_')) {
    throw authorityFailure('authority_invalid_argument')
  }
  const evidenceAtMilliseconds = parseCanonicalTimestamp(captured.evidenceAt)
  if (evidenceAtMilliseconds === undefined) {
    throw authorityFailure('authority_invalid_argument')
  }
  const expiresAtMilliseconds = parseCanonicalTimestamp(captured.expiresAt)
  if (expiresAtMilliseconds === undefined) {
    throw authorityFailure('authority_invalid_argument')
  }
  if (!isPrefixedUuidV4(captured.targetId, 'mem_')) {
    throw authorityFailure('authority_invalid_argument')
  }
  if (captured.verb !== ERASE_ATOM) {
    throw authorityFailure('authority_invalid_argument')
  }

  const audienceState = rootState.audienceState
  if (
    rootState.status === 'retired' ||
    audienceState === undefined ||
    audienceState.live !== true
  ) {
    throw authorityFailure('authority_root_revoked')
  }
  if (
    reflectApply(setHas, rootState.authorityEventIds, [
      captured.authorityEventId,
    ]) ||
    reflectApply(setHas, rootState.capabilityIds, [captured.capabilityId])
  ) {
    throw authorityFailure('authority_invalid_argument')
  }

  const issued = sampleNativeClock(rootState)
  if (
    evidenceAtMilliseconds > issued.milliseconds ||
    issued.milliseconds >= expiresAtMilliseconds
  ) {
    throw authorityFailure('authority_invalid_argument')
  }

  const grantState = {
    __proto__: null,
    rootState,
    audienceState,
    authorityEventId: captured.authorityEventId,
    capabilityId: captured.capabilityId,
    evidenceAt: captured.evidenceAt,
    evidenceAtMilliseconds,
    issuedAt: issued.timestamp,
    issuedAtMilliseconds: issued.milliseconds,
    expiresAt: captured.expiresAt,
    expiresAtMilliseconds,
    targetId: captured.targetId,
    status: 'available',
    reservationState: undefined,
  }
  const grant = makeCarrier(grantStates, grantState)
  grantState.grant = grant
  reflectApply(setAdd, rootState.authorityEventIds, [
    captured.authorityEventId,
  ])
  reflectApply(setAdd, rootState.capabilityIds, [captured.capabilityId])
  reflectApply(arrayPush, rootState.grants, [grantState])
  return grant
}

export function revokeMemoryAuthorityGrant(root, grant) {
  const rootState = assertRootBrand(root)
  const grantState = assertGrantBrand(grant)
  if (grantState.rootState !== rootState) {
    throw authorityFailure('authority_scope_mismatch')
  }
  if (grantState.status === 'available' || grantState.status === 'reserved') {
    endGrantReservation(grantState, 'revoked')
  }
  return undefined
}

export function revokeMemoryAuthorityRoot(root) {
  const state = assertRootBrand(root)
  retireRootState(state)
  return undefined
}

export function reserveMemoryAuthorityGrant(audience, grant) {
  const audienceState = assertAudienceBrand(audience)
  const grantState = assertGrantBrand(grant)
  if (grantState.status === 'expired') {
    throw authorityFailure('authority_grant_expired')
  }
  if (grantState.status !== 'available') {
    throw authorityFailure('authority_grant_unavailable')
  }
  if (
    audienceState.live !== true ||
    grantState.audienceState !== audienceState ||
    grantState.rootState.status !== 'live' ||
    grantState.rootState.audienceState !== audienceState
  ) {
    throw authorityFailure('authority_scope_mismatch')
  }

  const reservationState = {
    __proto__: null,
    rootState: grantState.rootState,
    audienceState,
    grantState,
    phase: 'reserved',
  }
  const reservation = makeCarrier(reservationStates, reservationState)
  reservationState.reservation = reservation
  grantState.status = 'reserved'
  grantState.reservationState = reservationState
  return reservation
}

export function authorizeMemoryAuthorityReservation(
  reservation,
  targetId,
  verb,
) {
  const reservationState = assertReservationBrand(reservation)
  assertReservationUseState(reservationState, 'reserved')
  const { grantState, rootState } = reservationState

  if (targetId !== grantState.targetId || verb !== ERASE_ATOM) {
    conditionalRelease(reservationState)
    throw authorityFailure('authority_grant_mismatch')
  }

  reservationState.phase = 'checking'
  const activityRecord = makeActivityRecord(grantState)
  let callbackThrew = false
  let callbackReturnValue
  let callbackThrownValue
  try {
    callbackReturnValue = reflectApply(
      rootState.checkGrantActive,
      undefined,
      [activityRecord],
    )
  } catch (error) {
    callbackThrew = true
    callbackThrownValue = error
  }

  assertReservationUseState(reservationState, 'checking')

  if (callbackThrew) {
    conditionalRelease(reservationState)
    throw authorityFailureWithCause(
      'authority_ledger_unavailable',
      callbackThrownValue,
    )
  }
  if (callbackReturnValue === false) {
    endGrantReservation(grantState, 'revoked')
    throw authorityFailure('authority_ledger_unavailable')
  }
  if (callbackReturnValue !== true) {
    retireRootState(rootState)
    throw authorityFailure('authority_ledger_protocol')
  }

  const observed = sampleNativeClock(rootState)
  if (observed.milliseconds >= grantState.expiresAtMilliseconds) {
    endGrantReservation(grantState, 'expired')
    throw authorityFailure('authority_grant_expired')
  }
  if (observed.milliseconds < grantState.issuedAtMilliseconds) {
    retireRootState(rootState)
    throw authorityFailure('authority_clock_invalid')
  }

  reservationState.phase = 'authorized'
  return makeAuthorizationSnapshot(grantState, observed.timestamp)
}

export function releaseMemoryAuthorityReservation(reservation) {
  const state = assertReservationBrand(reservation)
  conditionalRelease(state)
  return undefined
}

export function burnMemoryAuthorityReservation(reservation) {
  const state = assertReservationBrand(reservation)
  const { grantState } = state
  if (
    state.phase === 'burned' &&
    grantState.status === 'burned' &&
    grantState.burnedReservationState === state
  ) {
    return undefined
  }
  if (
    grantState.status !== 'reserved' ||
    grantState.reservationState !== state ||
    state.phase !== 'authorized'
  ) {
    throw authorityFailure('authority_invalid_argument')
  }
  grantState.status = 'burned'
  grantState.reservationState = undefined
  grantState.burnedReservationState = state
  state.phase = 'burned'
  return undefined
}

// V2-M2-B governed memory bridge.
//
// The bridge is the sole production owner of the V2-M2-A1 mutation
// coordinator. It co-commits the exact CDX-B2 decision/effect tail with the
// one ratified CDX-M1 erasure projection sealed by
// docs/GOVERNED-MUTATION-BRIDGE-CONTRACT.md. The local Admit/Resolve functions
// below are mechanically adapted from the same pinned FB1-4 patch-kernel blob
// used independently by src/cdx-b2-journal.mjs:
// df4de5f00ae88ba670305f9b2bb699441cc5b234 at governing commit
// c9af823c7dee29d29fd937d44527f3b78d8d3845.

import { createHash, randomUUID } from 'node:crypto'
import { DatabaseSync, StatementSync } from 'node:sqlite'
import { types as utilTypes } from 'node:util'

import {
  GovernedMemoryError,
  advanceCdxB2HeadInTransaction,
  appendCdxB2TailInTransaction,
  bootstrapCdxB2InTransaction,
  verifyCdxB2InTransaction,
} from './cdx-b2-journal.mjs'
import { CDX_B2_KERNEL_CONFIG_HASH } from './cdx-b2-schema.mjs'
import { evaluateGovernedMutationDisposition } from './governed-mutation-dispositions.mjs'
import {
  MemoryAuthorityError,
  authorizeMemoryAuthorityReservation,
  bindMemoryAuthorityRoot,
  burnMemoryAuthorityReservation,
  preflightMemoryAuthorityRoot,
  releaseMemoryAuthorityReservation,
  reserveMemoryAuthorityGrant,
  retireMemoryAuthorityAudience,
} from './memory-authority-runtime.mjs'
import {
  LegacyMutationError,
  applyGovernedErasureProjectionInTransaction,
  prepareGovernedErasureProjectionInTransaction,
} from './legacy-mutation-router.mjs'
import {
  MemoryMutationError,
  createMutationCoordinator,
} from './mutation-coordinator.mjs'

const reflectApply = Reflect.apply
const reflectConstruct = Reflect.construct
const reflectDefineProperty = Reflect.defineProperty
const reflectGetOwnPropertyDescriptor = Reflect.getOwnPropertyDescriptor
const reflectGetPrototypeOf = Reflect.getPrototypeOf
const reflectOwnKeys = Reflect.ownKeys
const objectCreate = Object.create
const objectFreeze = Object.freeze
const objectHasOwnProperty = Object.prototype.hasOwnProperty
const objectIs = Object.is
const objectIsFrozen = Object.isFrozen
const objectPrototype = Object.prototype
const arrayIncludes = Array.prototype.includes
const arrayIsArray = Array.isArray
const arrayPush = Array.prototype.push
const arraySlice = Array.prototype.slice
const arraySort = Array.prototype.sort
const dateParse = Date.parse
const mapGet = Map.prototype.get
const mapSet = Map.prototype.set
const mathMax = Math.max
const numberIsFinite = Number.isFinite
const numberIsNaN = Number.isNaN
const numberIsSafeInteger = Number.isSafeInteger
const regexpTest = RegExp.prototype.test
const setHas = Set.prototype.has
const stringIncludes = String.prototype.includes
const stringStartsWith = String.prototype.startsWith
const stringTrim = String.prototype.trim
const nativeError = Error
const nativeMap = Map
const nativeNumber = Number
const nativeRandomUUID = randomUUID
const nativeSet = Set
const nativeString = String
const jsonStringify = JSON.stringify
const isProxy = utilTypes.isProxy
const nativeCreateHash = createHash

const databasePrepare = DatabaseSync.prototype.prepare
const statementAll = StatementSync.prototype.all
const statementGet = StatementSync.prototype.get
const statementSetReadBigInts = StatementSync.prototype.setReadBigInts
const statementSetReturnArrays = StatementSync.prototype.setReturnArrays

const hashProbe = reflectApply(nativeCreateHash, undefined, ['sha256'])
const hashPrototype = reflectGetPrototypeOf(hashProbe)
const hashUpdate = reflectGetOwnPropertyDescriptor(hashPrototype, 'update').value
const hashDigest = reflectGetOwnPropertyDescriptor(hashPrototype, 'digest').value
reflectApply(hashDigest, hashProbe, ['hex'])

const governedMemoryErrorPrototype = GovernedMemoryError.prototype
const memoryAuthorityErrorPrototype = MemoryAuthorityError.prototype
const memoryMutationErrorPrototype = MemoryMutationError.prototype
const legacyMutationErrorPrototype = LegacyMutationError.prototype

const GOVERNED_ERROR_MESSAGES = objectFreeze({
  __proto__: null,
  governance_invalid_argument:
    'A valid governed memory argument is required.',
  governance_connection_invalid:
    'The governed memory connection is unavailable.',
  governance_transaction_required:
    'A coordinator-owned governed mutation transaction is required.',
  governance_schema_invalid: 'The CDX-B2 schema is invalid.',
  governance_migration_invalid: 'The CDX-B2 migration state is invalid.',
  governance_config_invalid:
    'The CDX-B2 kernel configuration is invalid.',
  governance_meta_invalid: 'The CDX-B2 metadata is invalid.',
  governance_checkpoint_invalid:
    'The CDX-B2 legacy checkpoint is invalid.',
  governance_journal_invalid: 'The CDX-B2 journal is invalid.',
  governance_projection_invalid:
    'The CDX-M1 projection does not match the CDX-B2 journal.',
  governance_clock_invalid:
    'The governed memory observation clock moved backward.',
  governance_identifier_collision:
    'A generated governed memory identifier already exists.',
  governance_state_closed: 'The governed memory bridge is closed.',
  governance_state_poisoned:
    'The governed memory bridge is poisoned and must be discarded.',
  governance_internal_invariant:
    'The governed memory kernel invariant failed.',
})

const AUTHORITY_ERROR_MESSAGES = objectFreeze({
  __proto__: null,
  authority_root_revoked:
    'The memory authority root has been revoked.',
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

const LEGACY_ERROR_MESSAGES = objectFreeze({
  __proto__: null,
  legacy_invalid_argument: 'A valid legacy mutation argument is required.',
  legacy_store_closed: 'The memory store is closed.',
})

const BRIDGE_INPUT_KEYS = objectFreeze(['workspaceId', 'authorityRoot'])
const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const ACTORS = new nativeSet([
  'background_extraction',
  'explicit_user_action',
  'session_summary',
  'lifecycle_job',
])
const ACTOR_CLASSES = (() => {
  const result = new nativeMap()
  reflectApply(mapSet, result, [
    'background_extraction',
    'actor_background_extraction',
  ])
  reflectApply(mapSet, result, [
    'explicit_user_action',
    'actor_explicit_user',
  ])
  reflectApply(mapSet, result, ['session_summary', 'actor_session_summary'])
  reflectApply(mapSet, result, ['lifecycle_job', 'actor_lifecycle_job'])
  return result
})()
const PERMANENT_TYPES = new nativeSet([
  'relationship',
  'preference',
  'opinion',
  'entity',
  'life_event',
])

const MEMORY_KEYS = objectFreeze([
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
const LINK_KEYS = objectFreeze([
  'id',
  'from_memory_id',
  'to_memory_id',
  'relation',
  'created_at',
])

const MEMORY_BY_ID_SQL = `
  SELECT
    id,
    palari_id,
    user_id,
    type,
    content,
    keywords,
    importance,
    valid_from,
    valid_until,
    access_count,
    last_accessed,
    created_at,
    shared,
    confidence,
    acquisition_mode,
    created_by_pipeline,
    fictional,
    last_decayed_at,
    source_message_id,
    content_hash,
    source_kind,
    extractor
  FROM main.memories
  WHERE id = ?
`

const LINK_SNAPSHOT_SQL = `
  SELECT id, from_memory_id, to_memory_id, relation, created_at
  FROM main.memory_links
  ORDER BY id COLLATE BINARY
`

function hasOwnData(descriptor) {
  return descriptor !== undefined && reflectApply(
    objectHasOwnProperty,
    descriptor,
    ['value'],
  )
}

function defineData(target, key, value, frozen = false) {
  reflectApply(reflectDefineProperty, undefined, [target, key, {
    __proto__: null,
    value,
    enumerable: true,
    configurable: !frozen,
    writable: !frozen,
  }])
}

function frozenNullRecord(entries) {
  const result = objectCreate(null)
  for (let index = 0; index < entries.length; index += 1) {
    defineData(result, entries[index][0], entries[index][1], true)
  }
  return reflectApply(objectFreeze, undefined, [result])
}

function governedFailure(code, cause) {
  return reflectConstruct(
    GovernedMemoryError,
    cause === undefined
      ? [code, GOVERNED_ERROR_MESSAGES[code]]
      : [code, GOVERNED_ERROR_MESSAGES[code], cause],
  )
}

function authorityFailure(code) {
  return reflectConstruct(MemoryAuthorityError, [
    code,
    AUTHORITY_ERROR_MESSAGES[code],
  ])
}

function legacyFailure(code) {
  return reflectConstruct(LegacyMutationError, [
    code,
    LEGACY_ERROR_MESSAGES[code],
  ])
}

function isOrdinaryRecord(value) {
  if (
    value === null ||
    typeof value !== 'object' ||
    reflectApply(isProxy, undefined, [value])
  ) return false
  const prototype = reflectApply(reflectGetPrototypeOf, undefined, [value])
  return prototype === objectPrototype || prototype === null
}

function isExpectedKey(key, keys) {
  for (let index = 0; index < keys.length; index += 1) {
    if (key === keys[index]) return true
  }
  return false
}

function captureExactRecord(input, keys, code = 'governance_invalid_argument') {
  if (!isOrdinaryRecord(input)) throw governedFailure(code)
  const ownKeys = reflectApply(reflectOwnKeys, undefined, [input])
  if (ownKeys.length !== keys.length) throw governedFailure(code)
  for (let index = 0; index < ownKeys.length; index += 1) {
    if (
      typeof ownKeys[index] !== 'string' ||
      !isExpectedKey(ownKeys[index], keys)
    ) throw governedFailure(code)
  }
  const result = objectCreate(null)
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index]
    const descriptor = reflectApply(
      reflectGetOwnPropertyDescriptor,
      undefined,
      [input, key],
    )
    if (!hasOwnData(descriptor)) throw governedFailure(code)
    defineData(result, key, descriptor.value, true)
  }
  return reflectApply(objectFreeze, undefined, [result])
}

function exactErrorCode(value, prototype) {
  if (
    value === null ||
    typeof value !== 'object' ||
    reflectApply(isProxy, undefined, [value])
  ) return undefined
  let actualPrototype
  try {
    actualPrototype = reflectApply(reflectGetPrototypeOf, undefined, [value])
  } catch {
    return undefined
  }
  if (actualPrototype !== prototype) return undefined
  const descriptor = reflectApply(
    reflectGetOwnPropertyDescriptor,
    undefined,
    [value, 'code'],
  )
  return hasOwnData(descriptor) && typeof descriptor.value === 'string'
    ? descriptor.value
    : undefined
}

function matchesExactFrozenNullRecord(value, expectedEntries) {
  if (
    value === null ||
    typeof value !== 'object' ||
    reflectApply(isProxy, undefined, [value])
  ) return false
  let prototype
  let ownKeys
  try {
    prototype = reflectApply(reflectGetPrototypeOf, undefined, [value])
    ownKeys = reflectApply(reflectOwnKeys, undefined, [value])
  } catch {
    return false
  }
  if (
    prototype !== null ||
    !reflectApply(objectIsFrozen, undefined, [value]) ||
    ownKeys.length !== expectedEntries.length
  ) return false
  for (let index = 0; index < expectedEntries.length; index += 1) {
    const expected = expectedEntries[index]
    if (ownKeys[index] !== expected[0]) return false
    const descriptor = reflectApply(
      reflectGetOwnPropertyDescriptor,
      undefined,
      [value, expected[0]],
    )
    if (
      !hasOwnData(descriptor) ||
      descriptor.enumerable !== true ||
      descriptor.configurable !== false ||
      descriptor.writable !== false ||
      !reflectApply(objectIs, undefined, [descriptor.value, expected[1]])
    ) return false
  }
  return true
}

function evaluateErasureRow(obligationId, input) {
  try {
    return reflectApply(evaluateGovernedMutationDisposition, undefined, [
      obligationId,
      input,
    ])
  } catch (error) {
    throw governedFailure('governance_internal_invariant', error)
  }
}

function requireErasureStage(input, expectedEntries) {
  const entry = evaluateErasureRow('D-01', input)
  if (!matchesExactFrozenNullRecord(entry, expectedEntries)) {
    throw governedFailure('governance_internal_invariant')
  }
}

function consumeAbsentAuthorityDisposition() {
  requireErasureStage(
    frozenNullRecord([
      ['authorityPreflightOutcome', 'absent'],
    ]),
    [
      ['action', 'RETURN'],
      ['disposition', 'REFUSE'],
      ['outcome', 'refused'],
      ['reason', 'authority_required'],
      ['recordingMode', 'pre_gate_no_journal'],
      ['routeKind', 'legacy_delete_memory'],
      ['publicResultShape', '{deleted:false,reason:"governance_refused"}'],
    ],
  )
}

function consumePreflightAuthorityThrowDisposition(code) {
  requireErasureStage(
    frozenNullRecord([
      ['authorityPreflightOutcome', code],
    ]),
    [
      ['action', 'THROW'],
      ['disposition', 'REFUSE'],
      ['errorName', 'MemoryAuthorityError'],
      ['errorCode', code],
      ['errorMessage', AUTHORITY_ERROR_MESSAGES[code]],
      ['recordingMode', 'pre_gate_no_journal'],
    ],
  )
}

function consumeCaptureRethrowDisposition() {
  requireErasureStage(
    frozenNullRecord([
      ['authorityPreflightOutcome', 'ready'],
      ['syntaxValid', false],
    ]),
    [
      ['action', 'RETHROW'],
      ['disposition', 'REFUSE'],
      ['reason', 'capture_failed'],
      ['recordingMode', 'pre_gate_no_journal'],
      ['preserveCapturedErrorByIdentity', true],
    ],
  )
}

function consumeUseThrowDisposition(code) {
  const legacyClosed = code === 'legacy_store_closed'
  requireErasureStage(
    frozenNullRecord([
      ['authorityPreflightOutcome', 'ready'],
      ['syntaxValid', true],
      ['authorityUseOutcome', code],
    ]),
    [
      ['action', 'THROW'],
      ['disposition', 'REFUSE'],
      ['errorName', legacyClosed
        ? 'LegacyMutationError'
        : 'MemoryAuthorityError'],
      ['errorCode', code],
      ['errorMessage', legacyClosed
        ? LEGACY_ERROR_MESSAGES.legacy_store_closed
        : AUTHORITY_ERROR_MESSAGES[code]],
      ['recordingMode', 'pre_gate_no_journal'],
    ],
  )
}

function isPreflightAuthorityErrorCode(code) {
  return code === 'authority_grant_invalid' ||
    code === 'authority_grant_unavailable' ||
    code === 'authority_grant_expired' ||
    code === 'authority_scope_mismatch'
}

function isUseAuthorityErrorCode(code) {
  return code === 'authority_root_revoked' ||
    code === 'authority_scope_mismatch' ||
    code === 'authority_grant_expired' ||
    code === 'authority_grant_unavailable' ||
    code === 'authority_grant_mismatch' ||
    code === 'authority_ledger_unavailable' ||
    code === 'authority_ledger_protocol' ||
    code === 'authority_clock_invalid'
}

function prepareStatement(db, sql) {
  const statement = reflectApply(databasePrepare, db, [sql])
  reflectApply(statementSetReadBigInts, statement, [false])
  reflectApply(statementSetReturnArrays, statement, [false])
  return statement
}

function copyExactNativeRow(row, keys, errorCode) {
  if (
    row === null ||
    typeof row !== 'object' ||
    reflectApply(isProxy, undefined, [row])
  ) throw governedFailure(errorCode)
  const ownKeys = reflectApply(reflectOwnKeys, undefined, [row])
  if (ownKeys.length !== keys.length) throw governedFailure(errorCode)
  const result = {}
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index]
    if (ownKeys[index] !== key) throw governedFailure(errorCode)
    const descriptor = reflectApply(
      reflectGetOwnPropertyDescriptor,
      undefined,
      [row, key],
    )
    if (!hasOwnData(descriptor)) throw governedFailure(errorCode)
    defineData(result, key, descriptor.value)
  }
  return result
}

function readExactRow(db, sql, parameters, keys, errorCode) {
  const statement = prepareStatement(db, sql)
  const row = reflectApply(statementGet, statement, parameters)
  return row === undefined
    ? null
    : copyExactNativeRow(row, keys, errorCode)
}

function readExactRows(db, sql, parameters, keys, errorCode) {
  const statement = prepareStatement(db, sql)
  const source = reflectApply(statementAll, statement, parameters)
  if (
    !reflectApply(arrayIsArray, undefined, [source]) ||
    reflectApply(isProxy, undefined, [source])
  ) throw governedFailure(errorCode)
  const ownKeys = reflectApply(reflectOwnKeys, undefined, [source])
  const lengthDescriptor = reflectApply(
    reflectGetOwnPropertyDescriptor,
    undefined,
    [source, 'length'],
  )
  if (
    !hasOwnData(lengthDescriptor) ||
    !reflectApply(numberIsSafeInteger, undefined, [lengthDescriptor.value]) ||
    lengthDescriptor.value < 0 ||
    ownKeys.length !== lengthDescriptor.value + 1 ||
    ownKeys[ownKeys.length - 1] !== 'length'
  ) throw governedFailure(errorCode)
  const result = []
  for (let index = 0; index < lengthDescriptor.value; index += 1) {
    const key = reflectApply(nativeString, undefined, [index])
    const descriptor = reflectApply(
      reflectGetOwnPropertyDescriptor,
      undefined,
      [source, key],
    )
    if (ownKeys[index] !== key || !hasOwnData(descriptor)) {
      throw governedFailure(errorCode)
    }
    reflectApply(arrayPush, result, [
      copyExactNativeRow(descriptor.value, keys, errorCode),
    ])
  }
  return result
}

function readCount(db, sql, parameters, errorCode) {
  const row = readExactRow(db, sql, parameters, ['value'], errorCode)
  if (
    row === null ||
    !reflectApply(numberIsSafeInteger, undefined, [row.value]) ||
    row.value < 0
  ) throw governedFailure(errorCode)
  return row.value
}

function copyDataRecord(source, keys) {
  const result = {}
  for (let index = 0; index < keys.length; index += 1) {
    defineData(result, keys[index], source[keys[index]])
  }
  return result
}

function rowsEqual(left, right, keys) {
  if (left === null || right === null) return left === right
  for (let index = 0; index < keys.length; index += 1) {
    if (!reflectApply(objectIs, undefined, [
      left[keys[index]],
      right[keys[index]],
    ])) return false
  }
  return true
}

function rowArraysEqual(left, right, keys) {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (!rowsEqual(left[index], right[index], keys)) return false
  }
  return true
}

// Complete local FB1-4 Admit/Resolve implementation. The journal independently
// recomputes these same results from persisted decision columns.
const REFERENCE_PATCH_KINDS = objectFreeze([
  'audit', 'conf', 'demote', 'emit', 'obligate', 'pause', 'perm', 'promote',
  'ratify', 'resume', 'scope_expand', 'trace', 'write',
])
const REFERENCE_PATCH_VISIBILITIES = objectFreeze([
  'reason_only', 'ledger', 'user_visible', 'external',
])
const REFERENCE_PATCH_PRIORITIES = objectFreeze([
  'promotion', 'confidence', 'repair', 'provenance', 'permission', 'safety',
])
const REFERENCE_PATCH_SOURCES = objectFreeze([
  'g_audit', 'g_conf', 'g_demote', 'g_obligate', 'g_perm', 'g_promote',
  'operator', 'peer_palari', 'ratified_user',
])
const REFERENCE_PRIORITY_MAP = (() => {
  const result = new nativeMap()
  const rows = [
    ['audit|g_audit', 'safety'],
    ['conf|g_conf', 'confidence'],
    ['demote|g_demote', 'repair'],
    ['obligate|g_obligate', 'provenance'],
    ['perm|g_perm', 'permission'],
    ['promote|g_promote', 'promotion'],
    ['ratify|operator', 'provenance'],
    ['ratify|ratified_user', 'provenance'],
    ['scope_expand|ratified_user', 'permission'],
    ['trace|g_audit', 'promotion'],
  ]
  for (let index = 0; index < rows.length; index += 1) {
    reflectApply(mapSet, result, [rows[index][0], rows[index][1]])
  }
  return result
})()
const REFERENCE_THETA_EVIDENCE = (() => {
  const result = new nativeMap()
  const rows = [
    ['audit', 0.9], ['conf', 0.3], ['demote', 0.55], ['emit', 0.5],
    ['obligate', 0.65], ['pause', 0.5], ['perm', 0.85], ['promote', 0.65],
    ['ratify', 1], ['resume', 0.5], ['scope_expand', 0.85], ['trace', 0],
    ['write', 0.5],
  ]
  for (let index = 0; index < rows.length; index += 1) {
    reflectApply(mapSet, result, [rows[index][0], rows[index][1]])
  }
  return result
})()
const REFERENCE_SOURCE_RANK = (() => {
  const result = new nativeMap()
  const rows = [
    ['g_audit', 4], ['g_conf', 3], ['g_demote', 3], ['g_obligate', 3],
    ['g_perm', 3], ['g_promote', 3], ['operator', 6], ['peer_palari', 1],
    ['ratified_user', 5],
  ]
  for (let index = 0; index < rows.length; index += 1) {
    reflectApply(mapSet, result, [rows[index][0], rows[index][1]])
  }
  return result
})()
const REFERENCE_EXCLUSIVE_KINDS = new nativeSet([
  'conf', 'perm', 'promote', 'write',
])

function referenceText(value) {
  const text = reflectApply(nativeString, undefined, [value ?? ''])
  return reflectApply(stringTrim, text, [])
}

function referencePriorityFor(kind, source) {
  return reflectApply(mapGet, REFERENCE_PRIORITY_MAP, [`${kind}|${source}`])
}

function referenceVisibilityFloor(visibility) {
  for (let index = 0; index < REFERENCE_PATCH_VISIBILITIES.length; index += 1) {
    if (REFERENCE_PATCH_VISIBILITIES[index] === visibility) return index
  }
  return 0
}

function referenceAdmitPatch(patch, context) {
  const failed = []
  const isObject = patch && typeof patch === 'object' && !arrayIsArray(patch)
  const kindOk = isObject && reflectApply(
    arrayIncludes,
    REFERENCE_PATCH_KINDS,
    [patch.kind],
  )
  if (!kindOk) reflectApply(arrayPush, failed, ['C1_kind'])
  const targetOk = !!(
    isObject &&
    patch.target &&
    typeof patch.target === 'object' &&
    referenceText(patch.target.slot) &&
    reflectApply(
      arrayIncludes,
      REFERENCE_PATCH_VISIBILITIES,
      [patch.target.visibility],
    )
  )
  if (!targetOk) reflectApply(arrayPush, failed, ['C2_target'])
  const sourceOk = isObject && reflectApply(
    arrayIncludes,
    REFERENCE_PATCH_SOURCES,
    [patch.source],
  )
  if (!sourceOk) reflectApply(arrayPush, failed, ['C3_source'])
  const mapped = kindOk && sourceOk
    ? referencePriorityFor(patch.kind, patch.source)
    : undefined
  if (mapped === undefined) reflectApply(arrayPush, failed, ['C4_map_covers'])
  if (mapped === undefined || patch.priority !== mapped) {
    reflectApply(arrayPush, failed, ['C5_priority_matches'])
  }
  const nowMs = reflectApply(dateParse, undefined, [context.now])
  const notBefore = patch.validity?.notBefore
    ? reflectApply(dateParse, undefined, [patch.validity.notBefore])
    : -Infinity
  const notAfter = patch.validity?.notAfter
    ? reflectApply(dateParse, undefined, [patch.validity.notAfter])
    : Infinity
  if (!(
    reflectApply(numberIsFinite, undefined, [nowMs]) &&
    nowMs >= notBefore &&
    nowMs <= notAfter
  )) reflectApply(arrayPush, failed, ['C6_valid_now'])
  const strength = reflectApply(nativeNumber, undefined, [
    patch.provenance?.strength,
  ])
  const theta = kindOk
    ? reflectApply(mapGet, REFERENCE_THETA_EVIDENCE, [patch.kind])
    : Infinity
  if (!(reflectApply(numberIsFinite, undefined, [strength]) && strength >= theta)) {
    reflectApply(arrayPush, failed, ['C7_evidence'])
  }
  const floor = targetOk
    ? referenceVisibilityFloor(patch.target.visibility)
    : Infinity
  const proposedRank = reflectApply(nativeNumber, undefined, [patch.permRank])
  const permRank = reflectApply(numberIsFinite, undefined, [proposedRank])
    ? proposedRank
    : floor
  if (!(permRank <= context.trustRank && floor <= permRank)) {
    reflectApply(arrayPush, failed, ['C8_trust_scope'])
  }
  return { admitted: failed.length === 0, failedConditions: failed }
}

function referencePatchHash(patch) {
  const stable = frozenNullRecord([
    ['id', patch.id],
    ['kind', patch.kind],
    ['payload', patch.payload],
    ['slot', patch.target?.slot],
    ['source', patch.source],
    ['timestamp', patch.provenance?.timestamp],
  ])
  const bytes = reflectApply(jsonStringify, undefined, [stable])
  const hash = reflectApply(nativeCreateHash, undefined, ['sha256'])
  reflectApply(hashUpdate, hash, [bytes])
  return reflectApply(hashDigest, hash, ['hex'])
}

function referenceSourceRank(source) {
  return reflectApply(mapGet, REFERENCE_SOURCE_RANK, [source]) ?? 0
}

function referencePatchesConflict(left, right) {
  if (!left || !right || left.id === right.id) return false
  const explicit = (
    arrayIsArray(left.conflictsWith) &&
    reflectApply(arrayIncludes, left.conflictsWith, [right.id])
  ) || (
    arrayIsArray(right.conflictsWith) &&
    reflectApply(arrayIncludes, right.conflictsWith, [left.id])
  )
  if (explicit) return true
  if (left.target?.slot !== right.target?.slot) return false
  if (
    (left.kind === 'promote' && right.kind === 'demote') ||
    (left.kind === 'demote' && right.kind === 'promote')
  ) return true
  if (
    left.kind === right.kind &&
    reflectApply(setHas, REFERENCE_EXCLUSIVE_KINDS, [left.kind])
  ) {
    return reflectApply(jsonStringify, undefined, [left.payload]) !==
      reflectApply(jsonStringify, undefined, [right.payload])
  }
  return false
}

function referencePatchKey(patch, context) {
  const parsedTimestamp = reflectApply(
    dateParse,
    undefined,
    [patch?.provenance?.timestamp ?? ''],
  )
  const timestampMs = reflectApply(numberIsNaN, undefined, [parsedTimestamp])
    ? 0
    : parsedTimestamp || 0
  const parsedNow = reflectApply(dateParse, undefined, [context.now])
  const nowMs = reflectApply(numberIsNaN, undefined, [parsedNow])
    ? 0
    : parsedNow || 0
  const freshness = -reflectApply(mathMax, undefined, [0, nowMs - timestampMs])
  const strength = reflectApply(nativeNumber, undefined, [
    patch?.provenance?.strength,
  ]) || 0
  let priorityRank = -1
  for (let index = 0; index < REFERENCE_PATCH_PRIORITIES.length; index += 1) {
    if (REFERENCE_PATCH_PRIORITIES[index] === patch.priority) {
      priorityRank = index
      break
    }
  }
  return [
    priorityRank,
    strength,
    freshness,
    referenceSourceRank(patch.source),
    timestampMs,
    referencePatchHash(patch),
  ]
}

function referenceComparePatchKeysDesc(left, right) {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] === right[index]) continue
    if (typeof left[index] === 'string') return left[index] < right[index] ? 1 : -1
    return right[index] - left[index]
  }
  return 0
}

function referenceResolvePatches(admitted, context) {
  const sorted = reflectApply(arraySlice, admitted, [])
  reflectApply(arraySort, sorted, [
    (left, right) => referenceComparePatchKeysDesc(
      referencePatchKey(left, context),
      referencePatchKey(right, context),
    ),
  ])
  const kept = []
  const dropped = []
  for (let index = 0; index < sorted.length; index += 1) {
    const patch = sorted[index]
    let defeater
    for (let keptIndex = 0; keptIndex < kept.length; keptIndex += 1) {
      if (referencePatchesConflict(kept[keptIndex], patch)) {
        defeater = kept[keptIndex]
        break
      }
    }
    if (defeater === undefined) reflectApply(arrayPush, kept, [patch])
    else reflectApply(arrayPush, dropped, [{ defeatedBy: defeater.id, patch }])
  }
  return { dropped, kept }
}

function canonicalPatch(patchId, targetId, authorization) {
  const patch = frozenNullRecord([
    ['id', patchId],
    ['kind', 'ratify'],
    ['target', frozenNullRecord([
      ['slot', `mem/${targetId}`],
      ['visibility', 'ledger'],
    ])],
    ['source', 'ratified_user'],
    ['priority', 'provenance'],
    ['payload', frozenNullRecord([
      ['operation', 'erase_owned_atom@1'],
      ['atomId', targetId],
    ])],
    ['provenance', frozenNullRecord([
      ['strength', 1],
      ['timestamp', authorization.evidenceAt],
      ['evidence', objectFreeze([authorization.authorityEventId])],
    ])],
    ['validity', frozenNullRecord([
      ['notBefore', authorization.issuedAt],
      ['notAfter', authorization.expiresAt],
    ])],
    ['permRank', 1],
    ['conflictsWith', objectFreeze([])],
  ])
  const context = frozenNullRecord([
    ['now', authorization.observedAt],
    ['trustRank', 1],
  ])
  let admission
  let resolution
  try {
    admission = referenceAdmitPatch(patch, context)
    resolution = referenceResolvePatches([patch], context)
  } catch (error) {
    throw governedFailure('governance_internal_invariant', error)
  }
  if (
    admission.admitted !== true ||
    admission.failedConditions.length !== 0 ||
    resolution.kept.length !== 1 ||
    resolution.kept[0] !== patch ||
    resolution.dropped.length !== 0
  ) throw governedFailure('governance_internal_invariant')
  return patch
}

function generateIdentifier(prefix) {
  let uuid
  try {
    uuid = reflectApply(nativeRandomUUID, undefined, [])
  } catch (error) {
    throw governedFailure('governance_internal_invariant', error)
  }
  if (
    typeof uuid !== 'string' ||
    !reflectApply(regexpTest, UUID_V4_PATTERN, [uuid])
  ) throw governedFailure('governance_internal_invariant')
  return `${prefix}${uuid}`
}

function assertGeneratedIdentifiersAvailable(db, decisionId, patchId) {
  const count = readCount(
    db,
    `SELECT count(*) AS value
       FROM main.cdx_b2_decisions
      WHERE decision_id = ? OR patch_id = ?`,
    [decisionId, patchId],
    'governance_journal_invalid',
  )
  if (count !== 0) throw governedFailure('governance_identifier_collision')
}

function historicalNonceExists(db, authorization) {
  return readCount(
    db,
    `SELECT count(*) AS value
       FROM main.cdx_b2_decisions
      WHERE authority_event_id = ? OR capability_id = ?`,
    [authorization.authorityEventId, authorization.capabilityId],
    'governance_journal_invalid',
  ) !== 0
}

function readProjectionState(db, targetId) {
  const target = readExactRow(
    db,
    MEMORY_BY_ID_SQL,
    [targetId],
    MEMORY_KEYS,
    'governance_projection_invalid',
  )
  const ftsCount = readCount(
    db,
    `SELECT count(*) AS value
       FROM main.memory_fts
      WHERE memory_id = ?`,
    [targetId],
    'governance_projection_invalid',
  )
  if ((target === null && ftsCount !== 0) || (target !== null && ftsCount !== 1)) {
    throw governedFailure('governance_projection_invalid')
  }
  const links = readExactRows(
    db,
    LINK_SNAPSHOT_SQL,
    [],
    LINK_KEYS,
    'governance_projection_invalid',
  )
  let incidentLinkCount = 0
  for (let index = 0; index < links.length; index += 1) {
    if (
      links[index].from_memory_id === targetId ||
      links[index].to_memory_id === targetId
    ) incidentLinkCount += 1
  }
  return { target, ftsCount, incidentLinkCount, links }
}

function scopeClass(target, authorization) {
  const samePalari = target.palari_id === authorization.palariId
  const general = target.user_id === null
  const sameUser = target.user_id === authorization.userId
  const suffix = target.shared === 1 ? 'shared' : 'private'
  if (samePalari) {
    if (general) return 'same_palari_general'
    if (sameUser) return `same_palari_same_user_${suffix}`
    return `same_palari_cross_user_${suffix}`
  }
  if (general) return 'cross_palari_general'
  if (sameUser) return `cross_palari_same_user_${suffix}`
  return `cross_palari_cross_user_${suffix}`
}

function targetBranch(targetScopeClass, incidentLinkCount) {
  let family
  if (targetScopeClass === 'same_palari_same_user_private') {
    family = 'private_same_scope'
  } else if (targetScopeClass === 'same_palari_same_user_shared') {
    family = 'shared'
  } else if (reflectApply(stringIncludes, targetScopeClass, ['general'])) {
    family = 'general'
  } else if (reflectApply(stringStartsWith, targetScopeClass, [
    'same_palari_cross_user_',
  ])) {
    family = 'cross_user'
  } else if (reflectApply(stringStartsWith, targetScopeClass, [
    'cross_palari_',
  ])) {
    family = 'cross_palari'
  } else {
    throw governedFailure('governance_internal_invariant')
  }
  return `target_${family}_${incidentLinkCount === 0 ? 'zero_links' : 'with_links'}`
}

function evaluateErasureDisposition(projection, captured, authorization) {
  const target = projection.target
  const targetScopeClass = target === null
    ? null
    : scopeClass(target, authorization)
  const branch = target === null
    ? null
    : targetBranch(targetScopeClass, projection.incidentLinkCount)
  const compatibilityOutcome = target === null ? 'not_found' : 'deleted'
  const input = frozenNullRecord([
    ['authorityPreflightOutcome', 'ready'],
    ['authorityUseOutcome', 'valid'],
    ['compatibilityOutcome', compatibilityOutcome],
    ['syntaxValid', true],
    ['projectionVerified', true],
    ['idClass', 'normalized_target_id'],
    ['targetMatchesGrant', true],
    ['actorClass', captured.actorClass],
    ['targetExists', target !== null],
    ['legacyType', target === null ? null : target.type],
    ['validityClass', target === null
      ? null
      : target.valid_until === null ? 'current' : 'ended'],
    ['scopeClass', targetScopeClass],
    ['sharedFlag', target === null ? null : `shared_${target.shared}`],
    ['incidentLinkCount', projection.incidentLinkCount],
    ['targetBranch', branch],
  ])
  let entry
  try {
    entry = evaluateErasureRow('D-01', input)
    if (entry.action === 'CONTINUE') {
      const expected = target !== null && reflectApply(
        setHas,
        PERMANENT_TYPES,
        [target.type],
      ) ? 'D-02' : 'D-03'
      if (
        !arrayIsArray(entry.next) ||
        entry.next.length !== 1 ||
        entry.next[0] !== expected
      ) throw governedFailure('governance_internal_invariant')
      entry = evaluateErasureRow(expected, input)
    }
    const exactTerminal = entry.disposition === 'MAP'
      ? matchesExactFrozenNullRecord(entry, [
        ['action', 'TERMINAL'],
        ['disposition', 'MAP'],
        ['outcome', 'applied'],
        ['reason', null],
        ['recordingMode', 'decision_and_effects'],
      ])
      : (
        entry.disposition === 'REFUSE' &&
        (
          entry.reason === 'missing_target' ||
          entry.reason === 'scope_mismatch' ||
          entry.reason === 'shared_scope_unsealed' ||
          entry.reason === 'incident_edges_unemittable'
        ) &&
        matchesExactFrozenNullRecord(entry, [
          ['action', 'TERMINAL'],
          ['disposition', 'REFUSE'],
          ['outcome', 'refused'],
          ['reason', entry.reason],
          ['recordingMode', 'decision_only'],
        ])
      )
    if (!exactTerminal) throw governedFailure('governance_internal_invariant')
  } catch (error) {
    if (
      exactErrorCode(error, governedMemoryErrorPrototype) ===
      'governance_internal_invariant'
    ) throw error
    throw governedFailure('governance_internal_invariant', error)
  }
  return entry
}

function makeDecision(
  verification,
  authorization,
  targetId,
  decisionId,
  patchId,
  disposition,
) {
  const effectCount = disposition.outcome === 'applied' ? 2 : 0
  return frozenNullRecord([
    ['sequence', verification.headMutationSequence + 1],
    ['stream_id', verification.streamId],
    ['decision_id', decisionId],
    ['patch_id', patchId],
    ['operation', 'atom_erase'],
    ['patch_kind', 'ratify'],
    ['patch_source', 'ratified_user'],
    ['patch_priority', 'provenance'],
    ['target_kind', 'memory.atom'],
    ['target_id', targetId],
    ['visibility', 'ledger'],
    ['authority_profile', authorization.authorityProfile],
    ['authority_kind', authorization.authorityKind],
    ['authority_id', authorization.authorityId],
    ['authority_ledger_id', authorization.authorityLedgerId],
    ['authority_event_id', authorization.authorityEventId],
    ['capability_id', authorization.capabilityId],
    ['palari_id', authorization.palariId],
    ['user_id', authorization.userId],
    ['evidence_kind', authorization.evidenceKind],
    ['evidence_strength', authorization.evidenceStrength],
    ['evidence_at', authorization.evidenceAt],
    ['issued_at', authorization.issuedAt],
    ['effective_at', authorization.effectiveAt],
    ['observed_at', authorization.observedAt],
    ['expires_at', authorization.expiresAt],
    ['outcome', disposition.outcome],
    ['reason_code', disposition.reason],
    ['failed_condition_mask', 0],
    ['resolution', 'kept'],
    ['effect_count', effectCount],
    ['kernel_config_hash', CDX_B2_KERNEL_CONFIG_HASH],
  ])
}

function makeEffects(decision) {
  if (decision.outcome !== 'applied') return objectFreeze([])
  return objectFreeze([
    frozenNullRecord([
      ['decision_sequence', decision.sequence],
      ['effect_ordinal', 0],
      ['effect_kind', 'projection_atom_erased'],
      ['object_id', decision.target_id],
    ]),
    frozenNullRecord([
      ['decision_sequence', decision.sequence],
      ['effect_ordinal', 1],
      ['effect_kind', 'projection_fts_erased'],
      ['object_id', decision.target_id],
    ]),
  ])
}

function translateProjectionFailure(error) {
  const code = exactErrorCode(error, legacyMutationErrorPrototype)
  if (code === 'legacy_effect_cardinality') {
    throw governedFailure('governance_projection_invalid', error)
  }
  if (
    code === 'legacy_effect_invalid' ||
    code === 'legacy_plan_invalid' ||
    code === 'legacy_plan_stale' ||
    code === 'legacy_plan_applied'
  ) throw governedFailure('governance_internal_invariant', error)
  throw error
}

function prepareProjectionToken(lease, db, captured, authorization) {
  const input = frozenNullRecord([
    ['id', captured.id],
    ['palariId', authorization.palariId],
    ['userId', authorization.userId],
  ])
  try {
    return reflectApply(
      prepareGovernedErasureProjectionInTransaction,
      undefined,
      [lease, db, input],
    )
  } catch (error) {
    translateProjectionFailure(error)
  }
}

function applyProjectionToken(lease, db, token) {
  try {
    return reflectApply(
      applyGovernedErasureProjectionInTransaction,
      undefined,
      [lease, db, token],
    )
  } catch (error) {
    translateProjectionFailure(error)
  }
}

function assertPostconditions(db, projection, decision) {
  const after = readProjectionState(db, decision.target_id)
  if (!rowArraysEqual(projection.links, after.links, LINK_KEYS)) {
    throw governedFailure('governance_projection_invalid')
  }
  if (decision.outcome === 'applied') {
    if (after.target !== null || after.ftsCount !== 0) {
      throw governedFailure('governance_projection_invalid')
    }
    return
  }
  if (
    !rowsEqual(projection.target, after.target, MEMORY_KEYS) ||
    projection.ftsCount !== after.ftsCount
  ) throw governedFailure('governance_projection_invalid')
}

function captureOptionalActor(options) {
  if (options === undefined) return undefined
  if (!isOrdinaryRecord(options)) throw legacyFailure('legacy_invalid_argument')
  const descriptor = reflectApply(
    reflectGetOwnPropertyDescriptor,
    undefined,
    [options, 'actor'],
  )
  if (descriptor === undefined) return undefined
  if (!hasOwnData(descriptor)) throw legacyFailure('legacy_invalid_argument')
  return descriptor.value
}

function captureDeleteInput(idValue, options) {
  const actorValue = captureOptionalActor(options)
  const actor = reflectApply(
    stringTrim,
    reflectApply(nativeString, undefined, [
      actorValue ?? 'explicit_user_action',
    ]),
    [],
  )
  if (!reflectApply(setHas, ACTORS, [actor])) {
    throw reflectConstruct(nativeError, [
      `Unauthorized memory mutation actor "${actor || 'missing'}".`,
    ])
  }
  const id = reflectApply(
    stringTrim,
    reflectApply(nativeString, undefined, [idValue ?? '']),
    [],
  )
  return frozenNullRecord([
    ['id', id],
    ['actor', actor],
    ['actorClass', reflectApply(mapGet, ACTOR_CLASSES, [actor])],
  ])
}

function assertBridgeOpen(state) {
  if (state.closed === true) throw legacyFailure('legacy_store_closed')
  if (state.poisoned === true) {
    throw governedFailure('governance_state_poisoned')
  }
}

function retireAuthority(state, poison) {
  if (poison) state.poisoned = true
  if (state.audience !== undefined && state.authorityRetired !== true) {
    state.authorityRetired = true
    reflectApply(retireMemoryAuthorityAudience, undefined, [state.audience])
  }
}

function throwPoisonedInvariant(state, error) {
  retireAuthority(state, true)
  if (
    exactErrorCode(error, governedMemoryErrorPrototype) ===
    'governance_internal_invariant'
  ) throw error
  throw governedFailure('governance_internal_invariant', error)
}

function settleA1Failure(state, reservation, error, markers) {
  const mutationCode = exactErrorCode(error, memoryMutationErrorPrototype)
  if (mutationCode !== undefined) {
    if (
      mutationCode === 'mutation_invalid_argument' ||
      mutationCode === 'mutation_connection_policy' ||
      mutationCode === 'mutation_busy' ||
      mutationCode === 'mutation_async_apply' ||
      mutationCode === 'mutation_commit_failed'
    ) {
      reflectApply(releaseMemoryAuthorityReservation, undefined, [reservation])
    } else {
      retireAuthority(state, true)
    }
    throw error
  }

  if (error === markers.ledgerRaceError) {
    retireAuthority(state, false)
    throw error
  }
  if (error === markers.historicalReuseError) {
    reflectApply(burnMemoryAuthorityReservation, undefined, [reservation])
    throw error
  }

  const governedCode = exactErrorCode(error, governedMemoryErrorPrototype)
  if (governedCode !== undefined) {
    if (governedCode === 'governance_identifier_collision') {
      reflectApply(releaseMemoryAuthorityReservation, undefined, [reservation])
      throw error
    }
    let exposed = error
    if (governedCode === 'governance_invalid_argument') {
      exposed = governedFailure('governance_internal_invariant', error)
    }
    retireAuthority(state, true)
    throw exposed
  }

  // A callback-native or otherwise unclassified projection error reached no
  // commit and A1 proved rollback. It remains retryable and keeps identity.
  reflectApply(releaseMemoryAuthorityReservation, undefined, [reservation])
  throw error
}

function staticRefusal(routeKind) {
  switch (routeKind) {
    case 'legacy_proposal':
      return { outcome: 'rejected', reasons: ['governance_refused'] }
    case 'legacy_forget_topic':
      return { count: 0, deleted: [] }
    case 'legacy_record_recall_inclusion':
      return { touched: [], touchedCount: 0 }
    case 'legacy_run_lifecycle':
      return { decayed: 0, deleted: 0, skipped: 0, touched: 0 }
    default:
      throw governedFailure('governance_invalid_argument')
  }
}

export { GovernedMemoryError }

export function createGovernedMemoryBridge(db, input) {
  const capturedInput = captureExactRecord(input, BRIDGE_INPUT_KEYS)
  if (capturedInput.authorityRoot !== undefined) {
    reflectApply(preflightMemoryAuthorityRoot, undefined, [
      capturedInput.authorityRoot,
      capturedInput.workspaceId,
    ])
  }

  const coordinator = reflectApply(createMutationCoordinator, undefined, [db])
  const verification = coordinator.run((lease) =>
    bootstrapCdxB2InTransaction(lease, db, frozenNullRecord([
      ['workspaceId', capturedInput.workspaceId],
    ])))
  const audience = capturedInput.authorityRoot === undefined
    ? undefined
    : reflectApply(bindMemoryAuthorityRoot, undefined, [
      capturedInput.authorityRoot,
      capturedInput.workspaceId,
      verification.authorityLedgerId === null
        ? undefined
        : verification.authorityLedgerId,
    ])
  const state = {
    audience,
    authorityRetired: false,
    closed: false,
    coordinator,
    db,
    poisoned: false,
  }

  const close = function close() {
    if (state.closed === true) return undefined
    state.closed = true
    retireAuthority(state, false)
    return undefined
  }

  const refuse = function refuse(routeKind) {
    assertBridgeOpen(state)
    return staticRefusal(routeKind)
  }

  const erase = function erase(idValue, options, authorityGrant) {
    assertBridgeOpen(state)
    if (state.audience === undefined || authorityGrant === undefined) {
      try {
        consumeAbsentAuthorityDisposition()
      } catch (error) {
        throwPoisonedInvariant(state, error)
      }
      return { deleted: false, reason: 'governance_refused' }
    }

    let reservation
    try {
      reservation = reflectApply(
        reserveMemoryAuthorityGrant,
        undefined,
        [state.audience, authorityGrant],
      )
    } catch (error) {
      const code = exactErrorCode(error, memoryAuthorityErrorPrototype)
      if (!isPreflightAuthorityErrorCode(code)) {
        throwPoisonedInvariant(state, error)
      }
      try {
        consumePreflightAuthorityThrowDisposition(code)
      } catch (stageError) {
        throwPoisonedInvariant(state, stageError)
      }
      throw error
    }
    let captured
    try {
      captured = captureDeleteInput(idValue, options)
    } catch (error) {
      try {
        consumeCaptureRethrowDisposition()
      } catch (stageError) {
        throwPoisonedInvariant(state, stageError)
      }
      reflectApply(releaseMemoryAuthorityReservation, undefined, [reservation])
      throw error
    }

    let authorization
    try {
      assertBridgeOpen(state)
      authorization = reflectApply(
        authorizeMemoryAuthorityReservation,
        undefined,
        [reservation, captured.id, 'erase_atom'],
      )
      assertBridgeOpen(state)
    } catch (error) {
      let exposed = error
      if (
        state.closed === true &&
        exactErrorCode(error, legacyMutationErrorPrototype) !==
          'legacy_store_closed'
      ) exposed = legacyFailure('legacy_store_closed')
      const legacyCode = exactErrorCode(exposed, legacyMutationErrorPrototype)
      const authorityCode = exactErrorCode(
        exposed,
        memoryAuthorityErrorPrototype,
      )
      try {
        if (legacyCode === 'legacy_store_closed') {
          consumeUseThrowDisposition(legacyCode)
        } else if (isUseAuthorityErrorCode(authorityCode)) {
          consumeUseThrowDisposition(authorityCode)
        } else {
          const governedCode = exactErrorCode(
            exposed,
            governedMemoryErrorPrototype,
          )
          if (governedCode === 'governance_state_poisoned') {
            reflectApply(
              releaseMemoryAuthorityReservation,
              undefined,
              [reservation],
            )
            throw exposed
          }
          throwPoisonedInvariant(state, exposed)
        }
      } catch (stageError) {
        if (stageError === exposed) throw stageError
        throwPoisonedInvariant(state, stageError)
      }
      reflectApply(releaseMemoryAuthorityReservation, undefined, [reservation])
      throw exposed
    }

    const markers = {
      historicalReuseError: undefined,
      ledgerRaceError: undefined,
    }
    let resultKind
    let resultMemory
    try {
      state.coordinator.run((lease) => {
        const before = verifyCdxB2InTransaction(lease, state.db)

        if (
          before.headMutationSequence > 0 &&
          before.authorityLedgerId !== authorization.authorityLedgerId
        ) {
          const error = authorityFailure('authority_scope_mismatch')
          markers.ledgerRaceError = error
          throw error
        }

        const observedMilliseconds = reflectApply(
          dateParse,
          undefined,
          [authorization.observedAt],
        )
        const tailMilliseconds = before.lastObservedAt === null
          ? null
          : reflectApply(dateParse, undefined, [before.lastObservedAt])
        if (
          !reflectApply(numberIsFinite, undefined, [observedMilliseconds]) ||
          (
            tailMilliseconds !== null &&
            !reflectApply(numberIsFinite, undefined, [tailMilliseconds])
          )
        ) throw governedFailure('governance_internal_invariant')
        if (
          tailMilliseconds !== null &&
          observedMilliseconds < tailMilliseconds
        ) throw governedFailure('governance_clock_invalid')

        if (historicalNonceExists(state.db, authorization)) {
          const error = authorityFailure('authority_grant_unavailable')
          markers.historicalReuseError = error
          throw error
        }

        const decisionId = generateIdentifier('b2d_')
        const patchId = generateIdentifier('b2p_')
        assertGeneratedIdentifiersAvailable(state.db, decisionId, patchId)
        canonicalPatch(patchId, captured.id, authorization)

        const projection = readProjectionState(state.db, captured.id)
        const disposition = evaluateErasureDisposition(
          projection,
          captured,
          authorization,
        )
        const projectionToken = disposition.outcome === 'applied'
          ? prepareProjectionToken(lease, state.db, captured, authorization)
          : null
        const decision = makeDecision(
          before,
          authorization,
          captured.id,
          decisionId,
          patchId,
          disposition,
        )
        const effects = makeEffects(decision)
        const plan = frozenNullRecord([
          ['decision', decision],
          ['effects', effects],
          ['projectionToken', projectionToken],
        ])

        appendCdxB2TailInTransaction(lease, state.db, frozenNullRecord([
          ['decision', plan.decision],
          ['effects', plan.effects],
        ]))
        if (plan.projectionToken !== null) {
          const applied = applyProjectionToken(
            lease,
            state.db,
            plan.projectionToken,
          )
          if (applied !== undefined) {
            throw governedFailure('governance_internal_invariant')
          }
        }
        assertPostconditions(state.db, projection, plan.decision)
        const after = advanceCdxB2HeadInTransaction(
          lease,
          state.db,
          plan.decision.sequence,
        )
        if (
          after.streamId !== before.streamId ||
          after.headMutationSequence !== plan.decision.sequence ||
          after.lastObservedAt !== authorization.observedAt ||
          after.authorityLedgerId !== authorization.authorityLedgerId
        ) throw governedFailure('governance_journal_invalid')

        resultKind = disposition.reason ?? 'applied'
        resultMemory = projection.target
        return undefined
      })
    } catch (error) {
      settleA1Failure(state, reservation, error, markers)
    }

    reflectApply(burnMemoryAuthorityReservation, undefined, [reservation])
    if (resultKind === 'applied') {
      return {
        deleted: true,
        memory: copyDataRecord(resultMemory, MEMORY_KEYS),
        reason: 'deleted',
      }
    }
    if (resultKind === 'missing_target') {
      return { deleted: false, reason: 'not_found' }
    }
    return { deleted: false, reason: 'governance_refused' }
  }

  return reflectApply(objectFreeze, undefined, [{ close, erase, refuse }])
}

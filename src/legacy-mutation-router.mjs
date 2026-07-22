// V2-M2-A2 legacy CDX-M1 mutation router.
//
// Compatibility behavior is copied from the extracted Palari v05 stores at
// source commit 190a4ad2f8d5187f5f21222048dd11efb2ad9991:
//   apps/palari-local-workbench/scripts/workspace-backend/memory-store.mjs
//     upstream blob 4f67d0fe96dd; local pre-A2 blob
//     64e647232facc8682c86386cf9d98770193416e2
//   apps/palari-local-workbench/scripts/workspace-backend/memory-extraction.mjs
//     upstream blob d8367ceb900c; local pre-A2 blob
//     eb8336ca92d8add299a5b89e1dffe81b153a3f71
// Intentional deltas and the exact compatibility law are sealed in
// docs/LEGACY-MUTATION-ROUTING-CONTRACT.md. This module does not establish
// authority, admission, canonical state, a journal, or a source of truth.

import { createHash, randomUUID } from 'node:crypto'
import { DatabaseSync, StatementSync } from 'node:sqlite'
import { TextEncoder, types as utilTypes } from 'node:util'

import { assertActiveMutationLease } from './mutation-coordinator.mjs'

const reflectApply = Reflect.apply
const reflectConstruct = Reflect.construct
const reflectDefineProperty = Reflect.defineProperty
const reflectGetOwnPropertyDescriptor = Reflect.getOwnPropertyDescriptor
const reflectGetPrototypeOf = Reflect.getPrototypeOf
const reflectOwnKeys = Reflect.ownKeys
const objectFreeze = Object.freeze
const objectHasOwnProperty = Object.prototype.hasOwnProperty
const objectPrototype = Object.prototype
const arrayIsArray = Array.isArray
const arrayJoin = Array.prototype.join
const arrayPush = Array.prototype.push
const arraySort = Array.prototype.sort
const numberIsFinite = Number.isFinite
const numberIsSafeInteger = Number.isSafeInteger
const numberIsNaN = Number.isNaN
const numberMaxSafeInteger = Number.MAX_SAFE_INTEGER
const mathFloor = Math.floor
const mathMax = Math.max
const mathMin = Math.min
const stringTrim = String.prototype.trim
const stringNormalize = String.prototype.normalize
const stringReplace = String.prototype.replace
const stringSlice = String.prototype.slice
const stringSplit = String.prototype.split
const stringToLowerCase = String.prototype.toLowerCase
const stringEndsWith = String.prototype.endsWith
const regexpTest = RegExp.prototype.test
const setAdd = Set.prototype.add
const setForEach = Set.prototype.forEach
const setHas = Set.prototype.has
const setSize = reflectGetOwnPropertyDescriptor(Set.prototype, 'size').get
const mapForEach = Map.prototype.forEach
const mapGet = Map.prototype.get
const mapHas = Map.prototype.has
const mapSet = Map.prototype.set
const weakMapGet = WeakMap.prototype.get
const weakMapSet = WeakMap.prototype.set
const dateParse = Date.parse
const dateGetTime = Date.prototype.getTime
const dateToISOString = Date.prototype.toISOString
const nativeDate = Date
const nativeError = Error
const nativeRangeError = RangeError
const nativeTypeError = TypeError
const nativeNumber = Number
const nativeString = String
const nativeCreateHash = createHash
const nativeRandomUUID = randomUUID
const nativeMap = Map
const nativeSet = Set
const nativeTextEncoder = TextEncoder
const isProxy = utilTypes.isProxy
const textEncoderEncode = TextEncoder.prototype.encode
const binaryTextEncoder = reflectConstruct(nativeTextEncoder, [])

const databasePrepare = DatabaseSync.prototype.prepare
const statementAll = StatementSync.prototype.all
const statementGet = StatementSync.prototype.get
const statementRun = StatementSync.prototype.run
const statementSetReadBigInts = StatementSync.prototype.setReadBigInts
const statementSetReturnArrays = StatementSync.prototype.setReturnArrays

const { databaseIsOpen } = (() => {
  const probe = reflectConstruct(DatabaseSync, [':memory:', { open: false }])
  return {
    databaseIsOpen: reflectGetOwnPropertyDescriptor(probe, 'isOpen').get,
  }
})()

const hashProbe = reflectApply(nativeCreateHash, undefined, ['sha256'])
const hashPrototype = reflectGetPrototypeOf(hashProbe)
const hashUpdate = reflectGetOwnPropertyDescriptor(hashPrototype, 'update').value
const hashDigest = reflectGetOwnPropertyDescriptor(hashPrototype, 'digest').value
reflectApply(hashDigest, hashProbe, ['hex'])

const ERROR_PAIRS = objectFreeze({
  legacy_invalid_argument: 'A valid legacy mutation argument is required.',
  legacy_invalid_capability: 'A supported branded memory capability is required.',
  legacy_store_closed: 'The memory store is closed.',
  legacy_manager_closed: 'The workspace memory manager is closed.',
  legacy_plan_invalid: 'A router-issued legacy mutation plan is required.',
  legacy_plan_stale: 'The legacy mutation plan is stale for this transaction.',
  legacy_plan_applied: 'The legacy mutation plan has already been consumed.',
  legacy_effect_invalid: 'A valid legacy mutation effect is required.',
  legacy_effect_cardinality: 'A legacy mutation effect changed an unexpected number of rows.',
  legacy_schema_invalid: 'The CDX-M1 runtime schema does not match the required manifest.',
  legacy_store_open: 'The memory database has a supported live or blocked connection.',
  legacy_path_invalid: 'A valid memory database path is required.',
  legacy_terminal_storage_refused: 'Terminal deletion of a governed memory store is refused.',
})
const ERROR_CODE_SET = new Set(reflectOwnKeys(ERROR_PAIRS))

function throwNativeTypeError(message) {
  throw reflectConstruct(nativeTypeError, [message])
}

export class LegacyMutationError extends Error {
  constructor(code, message, cause) {
    if (
      typeof code !== 'string' ||
      !reflectApply(setHas, ERROR_CODE_SET, [code])
    ) {
      throwNativeTypeError('Unknown legacy mutation error code.')
    }
    if (typeof message !== 'string' || message === '') {
      throwNativeTypeError(
        'Legacy mutation error message must be a non-empty string.',
      )
    }
    const error = reflectConstruct(
      nativeError,
      cause === undefined
        ? [message]
        : [message, { __proto__: null, cause }],
      legacyMutationErrorNewTarget,
    )
    reflectApply(reflectDefineProperty, undefined, [error, 'name', {
      __proto__: null,
      value: 'LegacyMutationError',
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

const legacyMutationErrorNewTarget = LegacyMutationError

function legacyFailure(code, cause) {
  return reflectConstruct(
    LegacyMutationError,
    cause === undefined
      ? [code, ERROR_PAIRS[code]]
      : [code, ERROR_PAIRS[code], cause],
  )
}

export const legacyMutationIntentKinds = objectFreeze([
  'legacy_proposal',
  'legacy_delete_memory',
  'legacy_forget_topic',
  'legacy_record_recall_inclusion',
  'legacy_run_lifecycle',
])

export const legacyMutationEffectKinds = objectFreeze([
  'cdx_memory_insert',
  'cdx_memory_end_validity',
  'cdx_memory_set_shared',
  'cdx_memory_set_importance',
  'cdx_memory_touch',
  'cdx_memory_decay',
  'cdx_memory_delete',
  'cdx_link_insert',
])

const intentKindSet = new Set(legacyMutationIntentKinds)
const effectKindSet = new Set(legacyMutationEffectKinds)
const planOutcomeSet = new Set([
  'rejected',
  'inserted',
  'duplicate_bumped',
  'superseded',
  'demoted',
  'ratified',
  'deleted',
  'not_found',
  'permanent_type_protected',
  'topic_forgotten',
  'recall_recorded',
  'lifecycle_ran',
])
const permanentTypeSet = new Set([
  'relationship',
  'preference',
  'opinion',
  'entity',
  'life_event',
])
const transientTypeSet = new Set([
  'working',
  'project',
  'recent_life',
  'session_summary',
])
const memoryTypeSet = new Set([...permanentTypeSet, ...transientTypeSet])
const acquisitionModeSet = new Set([
  'direct',
  'told_to_me',
  'extracted',
  'summarized',
])
const writerSet = new Set([
  'background_extraction',
  'explicit_user_action',
  'session_summary',
])
const actorSet = new Set([...writerSet, 'lifecycle_job'])
const externalSourceKindSet = new Set([
  'source_document',
  'tool_output',
  'web_result',
])
const proposalProducerSet = new Set([
  'explicit_proposal',
  'extraction_candidate',
])
const proposalKindOps = new Map([
  ['demote', new Set(['end_validity', 'delete_transient'])],
  ['permanent', new Set(['add', 'supersede'])],
  ['promote', new Set(['add', 'supersede'])],
  ['ratify', new Set(['share'])],
])

const POLICY_KEYS = objectFreeze([
  'demote',
  'promote',
  'permanent',
  'ratify',
])
const DEFAULT_POLICY = objectFreeze({
  demote: 0,
  promote: 0.25,
  permanent: 0.6,
  ratify: 0.75,
})
const PROVENANCE_KEYS = objectFreeze([
  'actor',
  'eventAt',
  'extractor',
  'sourceKind',
  'sourceMessageId',
  'writer',
])
const RECORD_KEYS = objectFreeze([
  'id',
  'palari_id',
  'user_id',
  'type',
  'content',
  'keywords',
  'importance',
  'valid_from',
  'valid_until',
  'last_accessed',
  'created_at',
  'shared',
  'confidence',
  'acquisition_mode',
  'fictional',
  'last_decayed_at',
  'source_message_id',
  'content_hash',
])
const ROW_KEYS = objectFreeze([
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
const PROPOSAL_INPUT_KEYS = objectFreeze([
  'intentKind',
  'op',
  'policy',
  'producer',
  'proposalKind',
  'provenance',
  'record',
  'scope',
  'target',
])
const PROPOSAL_CAPTURE_KEYS = objectFreeze([
  'intentKind',
  'nativeWallTime',
  'op',
  'policy',
  'producer',
  'proposalKind',
  'provenance',
  'record',
  'scope',
  'storeTime',
  'target',
])
const DELETE_KEYS = objectFreeze(['intentKind', 'actor', 'id'])
const TOPIC_KEYS = objectFreeze([
  'intentKind',
  'actor',
  'palariId',
  'query',
  'userId',
])
const RECALL_INPUT_KEYS = objectFreeze([
  'intentKind',
  'actor',
  'bumpAmount',
  'memoryIds',
])
const RECALL_CAPTURE_KEYS = objectFreeze([
  'intentKind',
  'actor',
  'bumpAmount',
  'memoryIds',
  'storeTime',
])
const LIFECYCLE_KEYS = objectFreeze(['intentKind', 'now', 'palariId'])
const GOVERNED_ERASURE_PROJECTION_INPUT_KEYS = objectFreeze([
  'id',
  'palariId',
  'userId',
])
const GOVERNED_ERASURE_PROJECTION_COUNT_KEYS = objectFreeze([
  'target_count',
  'fts_count',
  'link_count',
])
const GOVERNED_TARGET_ID_PATTERN =
  /^mem_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const GOVERNED_SCOPE_ID_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/

const invalidContentHash = objectFreeze({ invalidContentHash: true })
const capturedStates = new WeakMap()
const planStates = new WeakMap()
const governedErasureProjectionTokenStates = new WeakMap()

function isOrdinaryRecord(value) {
  if (
    value === null ||
    typeof value !== 'object' ||
    reflectApply(isProxy, undefined, [value])
  ) {
    return false
  }
  const prototype = reflectApply(reflectGetPrototypeOf, undefined, [value])
  return prototype === objectPrototype || prototype === null
}

function ownData(value, key, { absent = null, rejectAccessor = true } = {}) {
  const descriptor = reflectApply(
    reflectGetOwnPropertyDescriptor,
    undefined,
    [value, key],
  )
  if (descriptor === undefined) return absent
  if (!reflectApply(objectHasOwnProperty, descriptor, ['value'])) {
    if (rejectAccessor) throw legacyFailure('legacy_invalid_argument')
    return absent
  }
  return descriptor.value
}

function defineData(target, key, value) {
  reflectApply(reflectDefineProperty, undefined, [target, key, {
    __proto__: null,
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  }])
}

function assertExactOwnDataRecord(value, keys) {
  if (!isOrdinaryRecord(value)) {
    throw legacyFailure('legacy_invalid_argument')
  }
  const ownKeys = reflectApply(reflectOwnKeys, undefined, [value])
  if (ownKeys.length !== keys.length) {
    throw legacyFailure('legacy_invalid_argument')
  }
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index]
    if (ownKeys[index] !== key) throw legacyFailure('legacy_invalid_argument')
    ownData(value, key)
  }
}

function readKnownRecord(value, keys, { defaultEmpty = true } = {}) {
  if (value === undefined && defaultEmpty) value = {}
  assertExactOwnDataRecord(value, keys)
  const result = {}
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index]
    defineData(result, key, ownData(value, key))
  }
  return result
}

function freezeRecord(value) {
  return reflectApply(objectFreeze, undefined, [value])
}

function deepFreeze(value) {
  if (value === null || typeof value !== 'object') return value
  const keys = reflectApply(reflectOwnKeys, undefined, [value])
  for (let index = 0; index < keys.length; index += 1) {
    const descriptor = reflectApply(
      reflectGetOwnPropertyDescriptor,
      undefined,
      [value, keys[index]],
    )
    if (
      descriptor !== undefined &&
      reflectApply(objectHasOwnProperty, descriptor, ['value'])
    ) {
      deepFreeze(descriptor.value)
    }
  }
  return freezeRecord(value)
}

function trimString(value) {
  return reflectApply(stringTrim, reflectApply(nativeString, undefined, [value]), [])
}

function nullableText(value) {
  const normalized = trimString(value ?? '')
  return normalized || null
}

function finiteNumber(value, fallback) {
  const numeric = reflectApply(nativeNumber, undefined, [value])
  if (!reflectApply(numberIsFinite, undefined, [numeric])) return fallback
  // SQLite REAL affinity does not preserve JavaScript's signed-zero bit. Keep
  // planned/public rows identical to their persisted projection by selecting
  // one canonical representation before the plan is materialized.
  return numeric === 0 ? 0 : numeric
}

function normalizeActor(value, fallback) {
  const actor = trimString(value ?? fallback)
  if (!reflectApply(setHas, actorSet, [actor])) {
    throw reflectConstruct(nativeError, [
      `Unauthorized memory mutation actor "${actor || 'missing'}".`,
    ])
  }
  return actor
}

function normalizeIso(value) {
  const date = reflectConstruct(nativeDate, [value])
  return reflectApply(dateToISOString, date, [])
}

function nativeWallIso() {
  const date = reflectConstruct(nativeDate, [])
  return reflectApply(dateToISOString, date, [])
}

function assertDatabaseLive(db) {
  let open
  try {
    open = reflectApply(databaseIsOpen, db, [])
  } catch (error) {
    throw legacyFailure('legacy_store_closed', error)
  }
  if (open !== true) throw legacyFailure('legacy_store_closed')
}

function prepareStatement(db, sql) {
  const statement = reflectApply(databasePrepare, db, [sql])
  reflectApply(statementSetReadBigInts, statement, [false])
  reflectApply(statementSetReturnArrays, statement, [false])
  return statement
}

function statementGetRow(db, sql, params = []) {
  const statement = prepareStatement(db, sql)
  return reflectApply(statementGet, statement, params)
}

function statementAllRows(db, sql, params = []) {
  const statement = prepareStatement(db, sql)
  const nativeRows = reflectApply(statementAll, statement, params)
  if (
    !arrayIsArray(nativeRows) ||
    reflectApply(isProxy, undefined, [nativeRows])
  ) throw legacyFailure('legacy_plan_invalid')
  const keys = reflectApply(reflectOwnKeys, undefined, [nativeRows])
  if (
    !reflectApply(numberIsSafeInteger, undefined, [nativeRows.length]) ||
    keys.length !== nativeRows.length + 1 ||
    keys[keys.length - 1] !== 'length'
  ) throw legacyFailure('legacy_plan_invalid')
  const rows = []
  for (let index = 0; index < nativeRows.length; index += 1) {
    const key = reflectApply(nativeString, undefined, [index])
    const descriptor = reflectApply(
      reflectGetOwnPropertyDescriptor,
      undefined,
      [nativeRows, key],
    )
    if (
      keys[index] !== key ||
      descriptor === undefined ||
      !reflectApply(objectHasOwnProperty, descriptor, ['value'])
    ) throw legacyFailure('legacy_plan_invalid')
    reflectApply(arrayPush, rows, [descriptor.value])
  }
  return rows
}

function statementRunOne(db, sql, params) {
  const statement = prepareStatement(db, sql)
  const result = reflectApply(statementRun, statement, params)
  let changes
  if (result !== null && typeof result === 'object') {
    const descriptor = reflectApply(
      reflectGetOwnPropertyDescriptor,
      undefined,
      [result, 'changes'],
    )
    if (
      descriptor !== undefined &&
      reflectApply(objectHasOwnProperty, descriptor, ['value'])
    ) {
      changes = descriptor.value
    }
  }
  if (typeof changes !== 'number' || changes !== 1) {
    throw legacyFailure('legacy_effect_cardinality')
  }
}

const ROW_PROJECTION = ROW_KEYS.map((key) => `m.${key} AS ${key}`).join(', ')

function copyNativeRecord(nativeRow, keys) {
  if (
    nativeRow === null ||
    typeof nativeRow !== 'object' ||
    reflectApply(isProxy, undefined, [nativeRow])
  ) throw legacyFailure('legacy_plan_invalid')
  const result = {}
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index]
    const descriptor = reflectApply(
      reflectGetOwnPropertyDescriptor,
      undefined,
      [nativeRow, key],
    )
    if (
      descriptor === undefined ||
      !reflectApply(objectHasOwnProperty, descriptor, ['value'])
    ) {
      throw legacyFailure('legacy_plan_invalid')
    }
    defineData(result, key, descriptor.value)
  }
  if (keys === ROW_KEYS && !validateRow(result)) {
    throw legacyFailure('legacy_plan_invalid')
  }
  return result
}

function memoryById(db, id) {
  const row = statementGetRow(
    db,
    `SELECT ${ROW_PROJECTION} FROM main.memories AS m WHERE m.id = ?`,
    [id],
  )
  return row === undefined ? null : copyNativeRecord(row, ROW_KEYS)
}

function capturedHash(parts) {
  const hash = reflectApply(nativeCreateHash, undefined, ['sha256'])
  reflectApply(hashUpdate, hash, [reflectApply(arrayJoin, parts, ['\u001f'])])
  return reflectApply(hashDigest, hash, ['hex'])
}

function normalizeForShingles(value) {
  let normalized = reflectApply(nativeString, undefined, [value ?? ''])
  normalized = reflectApply(stringNormalize, normalized, ['NFKD'])
  normalized = reflectApply(stringReplace, normalized, [/\p{Diacritic}/gu, ''])
  normalized = reflectApply(stringToLowerCase, normalized, [])
  normalized = reflectApply(stringReplace, normalized, [/[^a-z0-9]+/g, ' '])
  return reflectApply(stringTrim, normalized, [])
}

function trigramShingles(value) {
  const normalized = normalizeForShingles(value)
  if (!normalized) return reflectConstruct(nativeSet, [])
  const padded = `  ${normalized}  `
  const shingles = reflectConstruct(nativeSet, [])
  for (let index = 0; index <= padded.length - 3; index += 1) {
    reflectApply(setAdd, shingles, [
      reflectApply(stringSlice, padded, [index, index + 3]),
    ])
  }
  return shingles
}

function trigramSimilarity(left, right) {
  const leftShingles = trigramShingles(left)
  const rightShingles = trigramShingles(right)
  const leftSize = reflectApply(setSize, leftShingles, [])
  const rightSize = reflectApply(setSize, rightShingles, [])
  if (!leftSize && !rightSize) return 1
  if (!leftSize || !rightSize) return 0
  let intersection = 0
  const unionSet = reflectConstruct(nativeSet, [])
  reflectApply(setForEach, leftShingles, [(shingle) => {
    reflectApply(setAdd, unionSet, [shingle])
    if (reflectApply(setHas, rightShingles, [shingle])) intersection += 1
  }])
  reflectApply(setForEach, rightShingles, [(shingle) => {
    reflectApply(setAdd, unionSet, [shingle])
  }])
  const union = reflectApply(setSize, unionSet, [])
  return union ? intersection / union : 0
}

function binaryAscending(left, right) {
  const leftBytes = reflectApply(textEncoderEncode, binaryTextEncoder, [left])
  const rightBytes = reflectApply(textEncoderEncode, binaryTextEncoder, [right])
  const length = mathMin(leftBytes.length, rightBytes.length)
  for (let index = 0; index < length; index += 1) {
    if (leftBytes[index] < rightBytes[index]) return -1
    if (leftBytes[index] > rightBytes[index]) return 1
  }
  return leftBytes.length < rightBytes.length
    ? -1
    : leftBytes.length > rightBytes.length
      ? 1
      : 0
}

function compareDuplicate(left, right) {
  if (left.similarity !== right.similarity) {
    return right.similarity - left.similarity
  }
  if (left.memory.importance !== right.memory.importance) {
    return right.memory.importance - left.memory.importance
  }
  const created = binaryAscending(
    right.memory.created_at,
    left.memory.created_at,
  )
  if (created !== 0) return created
  return binaryAscending(left.memory.id, right.memory.id)
}

const transientDetailPattern =
  /\b(?:temporary|temporarily|one[-\s]?time|single[-\s]?use|today\s+only|for\s+today|this\s+session(?:\s+only)?|this\s+conversation(?:\s+only)?|until\s+tomorrow|expires?\s+(?:today|tonight|tomorrow)|door\s+(?:code|pin|password|passcode)|entry\s+(?:code|pin|password|passcode)|access\s+(?:code|pin|password|passcode)|alarm\s+(?:code|pin)|lock\s+(?:code|pin)|gate\s+(?:code|pin)|verification\s+code|security\s+code|otp|2fa|mfa)\b|\b(?:code|pin|passcode)\s*(?:is|=|:)\s*["']?\d{3,12}\b|\b(?:door|entry|access|alarm|lock|gate)\s+\d{3,12}\b|\b\d{3,12}\s+(?:door|entry|access|alarm|lock|gate)\b/i
const explicitContradictionPattern =
  /\b(no longer|not anymore|does not|do not|never|instead of|changed from)\b/i
const preferenceStopWords = new Set([
  'user', 'mira', 'owner', 'preference', 'preferences', 'prefer', 'prefers',
  'preferred', 'like', 'likes', 'love', 'loves', 'want', 'wants', 'morning',
  'afternoon', 'evening', 'night', 'daily', 'weekly', 'monday', 'tuesday',
  'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'concise',
  'careful', 'short', 'long',
])

function preferenceTopicTokens(value, keywords = []) {
  const source = reflectApply(nativeString, undefined, [value ?? ''])
  const values = reflectApply(stringSplit, source, [/[^A-Za-z0-9]+/])
  if (arrayIsArray(keywords)) {
    for (let index = 0; index < keywords.length; index += 1) {
      reflectApply(arrayPush, values, [keywords[index]])
    }
  }
  const result = reflectConstruct(nativeSet, [])
  for (let index = 0; index < values.length; index += 1) {
    let token = reflectApply(stringToLowerCase, trimString(values[index]), [])
    if (
      token.length <= 2 ||
      reflectApply(setHas, preferenceStopWords, [token])
    ) continue
    if (
      token.length > 4 &&
      reflectApply(stringEndsWith, token, ['s'])
    ) token = reflectApply(stringSlice, token, [0, -1])
    reflectApply(setAdd, result, [token])
  }
  return result
}

function preferenceTopicOverlap(left, right) {
  const leftTokens = preferenceTopicTokens(left.content, left.keywords)
  const rightTokens = preferenceTopicTokens(right.content, right.keywords)
  if (
    !reflectApply(setSize, leftTokens, []) ||
    !reflectApply(setSize, rightTokens, [])
  ) return 0
  let shared = 0
  reflectApply(setForEach, leftTokens, [(token) => {
    if (reflectApply(setHas, rightTokens, [token])) shared += 1
  }])
  return shared
}

function isPermanent(type) {
  return reflectApply(setHas, permanentTypeSet, [type])
}

function partitionOf(type) {
  if (reflectApply(setHas, permanentTypeSet, [type])) return 'permanent'
  if (reflectApply(setHas, transientTypeSet, [type])) return 'transient'
  return null
}

function rejected(reasons) {
  const copy = []
  for (let index = 0; index < reasons.length; index += 1) {
    reflectApply(arrayPush, copy, [reasons[index]])
  }
  return { outcome: 'rejected', reasons: copy }
}

function capturePolicy(value) {
  if (value === undefined) value = DEFAULT_POLICY
  const raw = readKnownRecord(value, POLICY_KEYS, { defaultEmpty: false })
  const policy = {
    demote: raw.demote,
    promote: raw.promote,
    permanent: raw.permanent,
    ratify: raw.ratify,
  }
  for (let index = 0; index < POLICY_KEYS.length; index += 1) {
    const numeric = policy[POLICY_KEYS[index]]
    if (typeof numeric !== 'number' || !numberIsFinite(numeric)) {
      throw legacyFailure('legacy_invalid_argument')
    }
  }
  if (!(policy.demote < policy.promote &&
      policy.promote < policy.permanent &&
      policy.permanent < policy.ratify)) {
    throw legacyFailure('legacy_invalid_argument')
  }
  return freezeRecord(policy)
}

function emptyProvenance() {
  return freezeRecord({
    actor: null,
    eventAt: null,
    extractor: null,
    sourceKind: null,
    sourceMessageId: null,
    writer: null,
  })
}

function emptyRecord() {
  return freezeRecord({
    id: null,
    palari_id: null,
    user_id: null,
    type: null,
    content: null,
    keywords: null,
    importance: null,
    valid_from: null,
    valid_until: null,
    last_accessed: null,
    created_at: null,
    shared: null,
    confidence: null,
    acquisition_mode: null,
    fictional: null,
    last_decayed_at: null,
    source_message_id: null,
    content_hash: null,
  })
}

function normalizeKeywordsOnce(value, marker) {
  const rawValues = arrayIsArray(value) ? value : [value]
  const converted = []
  for (let index = 0; index < rawValues.length; index += 1) {
    const raw = rawValues[index]
    if (marker !== null && !raw) continue
    const text = trimString(raw ?? '')
    if (text) reflectApply(arrayPush, converted, [text])
  }
  const ordinary = reflectApply(arrayJoin, converted, [' '])
  const marked = marker === null
    ? ordinary
    : (() => {
      const markedValues = []
      for (let index = 0; index < converted.length; index += 1) {
        reflectApply(arrayPush, markedValues, [converted[index]])
      }
      reflectApply(arrayPush, markedValues, [marker])
      return reflectApply(arrayJoin, markedValues, [' '])
    })()
  return { ordinary, marked, topicKeywords: converted }
}

function normalizeProposalValues(rawRecord, rawProvenance, confidence, op) {
  const writer = rawProvenance.writer
  const sourceKind = rawProvenance.sourceKind
  const id = trimString(rawRecord.id ?? '')
  const palariWasNullish = rawRecord.palari_id === null || rawRecord.palari_id === undefined
  const palariId = trimString(rawRecord.palari_id ?? '')
  const userWasNullish = rawRecord.user_id === null || rawRecord.user_id === undefined
  const userId = nullableText(rawRecord.user_id)
  const type = rawRecord.type
  const content = trimString(rawRecord.content ?? '')
  const marker = op === 'add' && sourceKind !== 'user_message'
    ? `source:${sourceKind}`
    : null
  const keywordVariants = normalizeKeywordsOnce(rawRecord.keywords, marker)
  const importance = finiteNumber(rawRecord.importance, 0.5)
  let validFrom = rawRecord.valid_from
  if (validFrom !== null && validFrom !== undefined && typeof validFrom !== 'string') {
    throw legacyFailure('legacy_invalid_argument')
  }
  validFrom ??= null
  const validUntil = nullableText(rawRecord.valid_until)
  const lastAccessed = nullableText(rawRecord.last_accessed)
  let createdAt = rawRecord.created_at
  if (createdAt !== null && createdAt !== undefined && typeof createdAt !== 'string') {
    throw legacyFailure('legacy_invalid_argument')
  }
  createdAt ??= null
  const shared = rawRecord.shared ? 1 : 0
  const acquisition = trimString(
    rawRecord.acquisition_mode ??
      (writer === 'session_summary'
        ? 'summarized'
        : writer === 'background_extraction'
          ? 'extracted'
          : 'direct'),
  ) || 'direct'
  const fictional = rawRecord.fictional ? 1 : 0
  const lastDecayedAt = nullableText(rawRecord.last_decayed_at)
  const recordSourceMessageWasNullish =
    rawRecord.source_message_id === null ||
    rawRecord.source_message_id === undefined
  const recordSourceMessageId = nullableText(rawRecord.source_message_id)
  let contentHash = rawRecord.content_hash
  if (contentHash === null || contentHash === undefined) contentHash = null
  else if (typeof contentHash !== 'string') contentHash = invalidContentHash

  const actor = rawProvenance.actor === null || rawProvenance.actor === undefined
    ? null
    : trimString(rawProvenance.actor)
  let eventAt = rawProvenance.eventAt
  if (eventAt !== null && eventAt !== undefined && typeof eventAt !== 'string') {
    throw legacyFailure('legacy_invalid_argument')
  }
  eventAt ??= null
  let extractor = rawProvenance.extractor
  if (extractor !== null && extractor !== undefined && typeof extractor !== 'string') {
    throw legacyFailure('legacy_invalid_argument')
  }
  extractor ??= null
  const sourceMessageId = nullableText(rawProvenance.sourceMessageId)

  return {
    provenance: freezeRecord({
      actor,
      eventAt,
      extractor,
      sourceKind,
      sourceMessageId,
      writer,
    }),
    record: freezeRecord({
      id,
      palari_id: palariId,
      user_id: userId,
      type,
      content,
      keywords: op === 'add' ? keywordVariants.marked : keywordVariants.ordinary,
      importance,
      valid_from: validFrom,
      valid_until: validUntil,
      last_accessed: lastAccessed,
      created_at: createdAt,
      shared,
      confidence,
      acquisition_mode: acquisition,
      fictional,
      last_decayed_at: lastDecayedAt,
      source_message_id: recordSourceMessageId,
      content_hash: contentHash,
    }),
    privateValues: {
      addKeywords: sourceKind === 'user_message'
        ? keywordVariants.ordinary
        : marker === null
          ? keywordVariants.ordinary
          : keywordVariants.marked,
      supersedeKeywords: keywordVariants.ordinary,
      palariWasNullish,
      recordSourceMessageId,
      addSourceMessageId: recordSourceMessageWasNullish
        ? sourceMessageId
        : recordSourceMessageId,
      provenanceSourceMessageId: sourceMessageId,
      topicKeywords: keywordVariants.topicKeywords,
      userWasNullish,
    },
  }
}

function captureProposal(intent, clock, db) {
  assertExactOwnDataRecord(intent, PROPOSAL_INPUT_KEYS)
  const proposalKind = ownData(intent, 'proposalKind')
  const producer = ownData(intent, 'producer')
  const rawOp = ownData(intent, 'op', { absent: undefined })
  const op = rawOp === undefined ? 'add' : rawOp
  const knownOps = reflectApply(mapGet, proposalKindOps, [proposalKind])

  let pureResult = null
  if (knownOps === undefined) pureResult = rejected(['invalid_kind'])
  else if (!reflectApply(setHas, knownOps, [op])) pureResult = rejected(['invalid_op'])

  const policy = pureResult === null
    ? capturePolicy(ownData(intent, 'policy', { absent: undefined }))
    : DEFAULT_POLICY
  let provenance = emptyProvenance()
  let record = emptyRecord()
  let scope = freezeRecord({ palariId: null, userId: null })
  let target = null
  let nativeWallTime = null
  let storeTime = null
  let privateValues = {}

  if (pureResult === null) {
    if (!reflectApply(setHas, proposalProducerSet, [producer])) {
      throw legacyFailure('legacy_invalid_argument')
    }
    if (producer === 'extraction_candidate' && op !== 'add') {
      throw legacyFailure('legacy_invalid_argument')
    }
    const needsRecord = proposalKind === 'promote' || proposalKind === 'permanent'
    const rawProvenance = readKnownRecord(
      ownData(intent, 'provenance', { absent: undefined }),
      PROVENANCE_KEYS,
    )
    const rawRecord = needsRecord
      ? readKnownRecord(
        ownData(intent, 'record', { absent: undefined }),
        RECORD_KEYS,
      )
      : null

    if (proposalKind === 'demote') {
      const actor = rawProvenance.actor ?? rawProvenance.writer
      if (!reflectApply(setHas, actorSet, [actor])) pureResult = rejected(['invalid_actor'])
      else {
        const eventAt = rawProvenance.eventAt
        if (eventAt !== null && eventAt !== undefined && typeof eventAt !== 'string') {
          throw legacyFailure('legacy_invalid_argument')
        }
        provenance = freezeRecord({
          actor,
          eventAt: eventAt ?? null,
          extractor: null,
          sourceKind: null,
          sourceMessageId: null,
          writer: typeof rawProvenance.writer === 'string'
            ? rawProvenance.writer
            : null,
        })
      }
    } else if (proposalKind === 'ratify') {
      if (rawProvenance.writer !== 'explicit_user_action') {
        pureResult = rejected(['ratify_requires_user'])
      } else {
        provenance = freezeRecord({
          actor: typeof rawProvenance.actor === 'string'
            ? rawProvenance.actor
            : null,
          eventAt: null,
          extractor: null,
          sourceKind: null,
          sourceMessageId: null,
          writer: rawProvenance.writer,
        })
      }
    } else {
      const reasons = []
      const writer = rawProvenance.writer
      const sourceKind = rawProvenance.sourceKind
      if (!writer) reflectApply(arrayPush, reasons, ['writer_required'])
      else if (!reflectApply(setHas, writerSet, [writer])) {
        reflectApply(arrayPush, reasons, ['invalid_writer'])
      }
      if (!sourceKind) reflectApply(arrayPush, reasons, ['source_kind_required'])
      else if (
        sourceKind !== 'user_message' &&
        !reflectApply(setHas, externalSourceKindSet, [sourceKind])
      ) {
        reflectApply(arrayPush, reasons, ['invalid_source_kind'])
      }
      if (
        sourceKind &&
        reflectApply(setHas, externalSourceKindSet, [sourceKind]) &&
        writer !== 'background_extraction'
      ) {
        reflectApply(arrayPush, reasons, ['external_requires_extraction'])
      }
      if (writer === 'background_extraction' || writer === 'session_summary') {
        if (!rawProvenance.eventAt) {
          reflectApply(arrayPush, reasons, ['event_time_required'])
        }
      }
      if (writer === 'background_extraction' && !rawProvenance.extractor) {
        reflectApply(arrayPush, reasons, ['extractor_required'])
      }
      const partition = partitionOf(rawRecord.type)
      if (proposalKind === 'promote' && partition !== 'transient') {
        reflectApply(arrayPush, reasons, ['kind_type_mismatch'])
      }
      if (proposalKind === 'permanent' && partition !== 'permanent') {
        reflectApply(arrayPush, reasons, ['kind_type_mismatch'])
      }
      const confidence = finiteNumber(rawRecord.confidence, 0.5)
      if (confidence < policy[proposalKind]) {
        reflectApply(arrayPush, reasons, ['below_threshold'])
      }
      if (
        rawProvenance.eventAt !== null &&
        rawProvenance.eventAt !== undefined &&
        typeof rawProvenance.eventAt !== 'string'
      ) {
        throw legacyFailure('legacy_invalid_argument')
      }
      if (
        rawProvenance.extractor !== null &&
        rawProvenance.extractor !== undefined &&
        typeof rawProvenance.extractor !== 'string'
      ) {
        throw legacyFailure('legacy_invalid_argument')
      }
      if (reasons.length > 0) pureResult = rejected(reasons)
      else {
        const normalized = normalizeProposalValues(
          rawRecord,
          rawProvenance,
          confidence,
          op,
        )
        provenance = normalized.provenance
        record = normalized.record
        privateValues = normalized.privateValues
      }
    }

    if (pureResult === null) {
      if (producer === 'extraction_candidate') {
        if (proposalKind !== 'promote' && proposalKind !== 'permanent') {
          throw legacyFailure('legacy_invalid_argument')
        }
        const rawScope = readKnownRecord(
          ownData(intent, 'scope', { absent: undefined }),
          ['palariId', 'userId'],
        )
        scope = freezeRecord({
          palariId: trimString(rawScope.palariId ?? ''),
          userId: reflectApply(nativeString, undefined, [rawScope.userId ?? '']),
        })
      }
      const targetConsuming = producer === 'explicit_proposal' && (
        op === 'supersede' ||
        op === 'end_validity' ||
        op === 'delete_transient' ||
        op === 'share'
      )
      if (targetConsuming) target = trimString(ownData(intent, 'target') ?? '')

      if (proposalKind === 'demote' && op === 'end_validity') {
        const eventAt = provenance.eventAt
        if (eventAt !== null && eventAt !== undefined) {
          if (typeof eventAt !== 'string') {
            throw legacyFailure('legacy_invalid_argument')
          }
          nativeWallTime = eventAt
        } else {
          nativeWallTime = nativeWallIso()
        }
      } else if (
        proposalKind === 'promote' ||
        proposalKind === 'permanent'
      ) {
        storeTime = normalizeIso(reflectApply(clock, undefined, []))
        assertDatabaseLive(db)
      }
    }
  }

  const captured = deepFreeze({
    intentKind: 'legacy_proposal',
    nativeWallTime,
    op: typeof op === 'string' ? op : null,
    policy,
    producer: reflectApply(setHas, proposalProducerSet, [producer]) ? producer : null,
    proposalKind: typeof proposalKind === 'string' ? proposalKind : null,
    provenance,
    record,
    scope,
    storeTime,
    target,
  })
  return { captured, privateValues, pureResult }
}

function captureDelete(intent) {
  assertExactOwnDataRecord(intent, DELETE_KEYS)
  const actor = normalizeActor(ownData(intent, 'actor'), 'explicit_user_action')
  const id = trimString(ownData(intent, 'id') ?? '')
  return {
    captured: freezeRecord({ intentKind: 'legacy_delete_memory', actor, id }),
    privateValues: {},
    pureResult: null,
  }
}

function captureTopic(intent) {
  assertExactOwnDataRecord(intent, TOPIC_KEYS)
  const actor = normalizeActor(ownData(intent, 'actor'), 'explicit_user_action')
  const query = trimString(ownData(intent, 'query') ?? '')
  const palariId = trimString(ownData(intent, 'palariId') ?? '')
  const userId = trimString(ownData(intent, 'userId') ?? '')
  const pureResult = query === '' || palariId === ''
    ? { count: 0, deleted: [] }
    : null
  return {
    captured: freezeRecord({
      intentKind: 'legacy_forget_topic',
      actor,
      palariId,
      query,
      userId,
    }),
    privateValues: {},
    pureResult,
  }
}

function captureRecall(intent, clock, db) {
  assertExactOwnDataRecord(intent, RECALL_INPUT_KEYS)
  const actor = normalizeActor(ownData(intent, 'actor'), 'lifecycle_job')
  const bumpAmount = finiteNumber(ownData(intent, 'bumpAmount'), 0.05)
  const supplied = ownData(intent, 'memoryIds')
  const rawIds = arrayIsArray(supplied) ? supplied : [supplied]
  const memoryIds = []
  const seen = reflectConstruct(nativeSet, [])
  for (let index = 0; index < rawIds.length; index += 1) {
    const id = trimString(rawIds[index] ?? '')
    if (!id || reflectApply(setHas, seen, [id])) continue
    reflectApply(setAdd, seen, [id])
    reflectApply(arrayPush, memoryIds, [id])
  }
  let storeTime = null
  let pureResult = null
  if (memoryIds.length === 0) {
    pureResult = { touched: [], touchedCount: 0 }
  } else {
    storeTime = normalizeIso(reflectApply(clock, undefined, []))
    assertDatabaseLive(db)
  }
  return {
    captured: deepFreeze({
      intentKind: 'legacy_record_recall_inclusion',
      actor,
      bumpAmount,
      memoryIds,
      storeTime,
    }),
    privateValues: {},
    pureResult,
  }
}

function captureLifecycle(intent, clock, db) {
  assertExactOwnDataRecord(intent, LIFECYCLE_KEYS)
  const palariId = trimString(ownData(intent, 'palariId') ?? '')
  const suppliedNow = ownData(intent, 'now', { absent: undefined })
  const clockValue = suppliedNow === undefined
    ? reflectApply(clock, undefined, [])
    : suppliedNow
  const date = reflectConstruct(nativeDate, [clockValue])
  const nowMs = reflectApply(dateGetTime, date, [])
  if (!reflectApply(numberIsFinite, undefined, [nowMs])) {
    throw reflectConstruct(nativeRangeError, ['Invalid time value'])
  }
  const now = reflectApply(dateToISOString, date, [])
  assertDatabaseLive(db)
  return {
    captured: freezeRecord({
      intentKind: 'legacy_run_lifecycle',
      now,
      palariId,
    }),
    privateValues: { nowMs },
    pureResult: null,
  }
}

function validateCapturedShape(captured) {
  const state = reflectApply(weakMapGet, capturedStates, [captured])
  if (state === undefined) throw legacyFailure('legacy_invalid_argument')
  return state
}

function effect(kind, values) {
  return { kind, ...values }
}

function makePlan(routerState, lease, captured, outcome, effects, result) {
  const draft = {
    version: 'CDX-M1-legacy-plan@1',
    intentKind: captured.intentKind,
    outcome,
    effects,
    result,
  }
  if (!validatePlanDraft(draft)) throw legacyFailure('legacy_plan_invalid')
  const plan = deepFreeze(draft)
  reflectApply(weakMapSet, planStates, [plan, {
    db: routerState.db,
    lease,
    router: routerState,
    state: 'fresh',
  }])
  return plan
}

function postImportance(row, importance) {
  return {
    ...row,
    importance,
  }
}

function postEndValidity(row, validUntil) {
  return {
    ...row,
    valid_until: validUntil,
  }
}

function postShared(row) {
  return {
    ...row,
    shared: 1,
  }
}

function duplicateCandidates(db, record) {
  if (!record.palari_id) return []
  const rows = statementAllRows(
    db,
    `SELECT ${ROW_PROJECTION}
       FROM main.memories AS m
      WHERE m.palari_id = ?
        AND m.type = ?
        AND m.valid_until IS NULL`,
    [record.palari_id, record.type],
  )
  const candidates = []
  for (let index = 0; index < rows.length; index += 1) {
    const memory = copyNativeRecord(rows[index], ROW_KEYS)
    const similarity = trigramSimilarity(memory.content, record.content)
    if (similarity >= 0.85) {
      reflectApply(arrayPush, candidates, [{ memory, similarity }])
    }
  }
  reflectApply(arraySort, candidates, [compareDuplicate])
  return candidates
}

function contradictionCandidates(db, captured, captureState) {
  const rows = statementAllRows(
    db,
    `SELECT ${ROW_PROJECTION}
       FROM main.memories AS m
      WHERE m.palari_id = ?
        AND m.type = ?
        AND m.valid_until IS NULL
        AND (m.user_id = ? OR m.user_id IS NULL OR m.shared = 1)`,
    [
      captured.scope.palariId,
      captured.record.type,
      captured.scope.userId,
    ],
  )
  const memories = []
  for (let index = 0; index < rows.length; index += 1) {
    reflectApply(arrayPush, memories, [copyNativeRecord(rows[index], ROW_KEYS)])
  }
  if (reflectApply(regexpTest, explicitContradictionPattern, [captured.record.content])) {
    const candidates = []
    for (let index = 0; index < memories.length; index += 1) {
      const memory = memories[index]
      const similarity = trigramSimilarity(memory.content, captured.record.content)
      if (similarity >= 0.35) {
        reflectApply(arrayPush, candidates, [{ memory, similarity }])
      }
    }
    reflectApply(arraySort, candidates, [compareDuplicate])
    if (candidates.length > 0) return candidates[0].memory
  }
  if (captured.record.type !== 'preference') return null
  const candidates = []
  for (let index = 0; index < memories.length; index += 1) {
    const memory = memories[index]
    if (reflectApply(regexpTest, transientDetailPattern, [memory.content])) continue
    const topicOverlap = preferenceTopicOverlap({
      content: captured.record.content,
      keywords: captureState.privateValues.topicKeywords,
    }, memory)
    if (topicOverlap <= 0) continue
    const similarity = trigramSimilarity(memory.content, captured.record.content)
    if (similarity >= 0.85) continue
    reflectApply(arrayPush, candidates, [{
      memory,
      score: topicOverlap + similarity,
      similarity,
    }])
  }
  reflectApply(arraySort, candidates, [(left, right) => {
    if (left.score !== right.score) return right.score - left.score
    if (left.memory.importance !== right.memory.importance) {
      return right.memory.importance - left.memory.importance
    }
    const created = binaryAscending(
      right.memory.created_at,
      left.memory.created_at,
    )
    if (created !== 0) return created
    return binaryAscending(left.memory.id, right.memory.id)
  }])
  return candidates.length > 0 ? candidates[0].memory : null
}

function normalizeInsertRow(captured, captureState, mode, existing = null) {
  const record = captured.record
  if (!record.palari_id && mode !== 'supersede') {
    throw reflectConstruct(nativeError, ['Memory palari_id is required.'])
  }
  const palariId = mode === 'supersede'
    ? captureState.privateValues.palariWasNullish
      ? existing.palari_id
      : record.palari_id
    : record.palari_id
  const userId = mode === 'supersede'
    ? captureState.privateValues.userWasNullish
      ? existing.user_id
      : record.user_id
    : record.user_id
  if (!palariId) throw reflectConstruct(nativeError, ['Memory palari_id is required.'])
  if (!record.content) throw reflectConstruct(nativeError, ['Memory content is required.'])
  if (!reflectApply(setHas, acquisitionModeSet, [record.acquisition_mode])) {
    throw reflectConstruct(nativeError, [
      `Unsupported memory acquisition mode "${record.acquisition_mode}".`,
    ])
  }
  if (record.content_hash === invalidContentHash) {
    throw legacyFailure('legacy_invalid_argument')
  }
  const id = record.id || `mem_${reflectApply(nativeRandomUUID, undefined, [])}`
  const keywords = mode === 'supersede'
    ? captureState.privateValues.supersedeKeywords
    : captureState.privateValues.addKeywords
  const sourceMessageId = mode === 'supersede'
    ? captureState.privateValues.recordSourceMessageId
    : captureState.privateValues.addSourceMessageId
  const validFrom = record.valid_from ?? captured.provenance.eventAt ?? captured.storeTime
  const createdAt = record.created_at ?? captured.storeTime
  const contentHash = record.content_hash ?? capturedHash([
    palariId,
    userId ?? '',
    record.type,
    record.content,
    keywords,
  ])
  return {
    id,
    palari_id: palariId,
    user_id: userId,
    type: record.type,
    content: record.content,
    keywords,
    importance: record.importance,
    valid_from: validFrom,
    valid_until: record.valid_until,
    access_count: 0,
    last_accessed: record.last_accessed,
    created_at: createdAt,
    shared: record.shared,
    confidence: record.confidence,
    acquisition_mode: record.acquisition_mode,
    created_by_pipeline: captured.provenance.writer === 'explicit_user_action' ? 0 : 1,
    fictional: record.fictional,
    last_decayed_at: record.last_decayed_at,
    source_message_id: sourceMessageId,
    content_hash: contentHash,
    source_kind: captured.provenance.sourceKind,
    extractor: captured.provenance.extractor,
  }
}

function supersedePlan(routerState, lease, captured, captureState, existing) {
  if (partitionOf(captured.record.type) !== partitionOf(existing.type)) {
    return makePlan(
      routerState,
      lease,
      captured,
      'rejected',
      [],
      rejected(['type_partition_mismatch']),
    )
  }
  const row = normalizeInsertRow(captured, captureState, 'supersede', existing)
  const link = {
    id: `link_${row.id}_${existing.id}_supersedes`,
    from_memory_id: row.id,
    to_memory_id: existing.id,
    relation: 'supersedes',
    created_at: captured.storeTime,
  }
  const effects = [
    effect('cdx_memory_end_validity', {
      id: existing.id,
      validUntil: captured.storeTime,
    }),
    effect('cdx_memory_insert', { row }),
    effect('cdx_link_insert', { link }),
  ]
  return makePlan(
    routerState,
    lease,
    captured,
    'superseded',
    effects,
    {
      link,
      memory: row,
      outcome: 'superseded',
      reasons: [],
      superseded: existing,
    },
  )
}

function resolveProposal(routerState, lease, captured, captureState) {
  if (captureState.pureResult !== null) {
    return makePlan(
      routerState,
      lease,
      captured,
      'rejected',
      [],
      captureState.pureResult,
    )
  }
  if (captured.proposalKind === 'demote') {
    const existing = memoryById(routerState.db, captured.target)
    if (existing === null) {
      return makePlan(routerState, lease, captured, 'rejected', [], rejected(['missing_target']))
    }
    if (captured.op === 'delete_transient') {
      if (isPermanent(existing.type)) {
        return makePlan(routerState, lease, captured, 'rejected', [], rejected(['not_transient']))
      }
      return makePlan(
        routerState,
        lease,
        captured,
        'demoted',
        [effect('cdx_memory_delete', { id: existing.id })],
        { deletedId: existing.id, outcome: 'demoted', reasons: [] },
      )
    }
    const memory = postEndValidity(existing, captured.nativeWallTime)
    return makePlan(
      routerState,
      lease,
      captured,
      'demoted',
      [effect('cdx_memory_end_validity', {
        id: existing.id,
        validUntil: captured.nativeWallTime,
      })],
      { memory, outcome: 'demoted', reasons: [] },
    )
  }
  if (captured.proposalKind === 'ratify') {
    const existing = memoryById(routerState.db, captured.target)
    if (existing === null) {
      return makePlan(routerState, lease, captured, 'rejected', [], rejected(['missing_target']))
    }
    const memory = postShared(existing)
    return makePlan(
      routerState,
      lease,
      captured,
      'ratified',
      [effect('cdx_memory_set_shared', { id: existing.id })],
      { memory, outcome: 'ratified', reasons: [] },
    )
  }

  if (captured.producer === 'extraction_candidate') {
    const contradiction = contradictionCandidates(
      routerState.db,
      captured,
      captureState,
    )
    if (contradiction !== null) {
      return supersedePlan(
        routerState,
        lease,
        captured,
        captureState,
        contradiction,
      )
    }
  }

  if (captured.op === 'supersede') {
    const existing = memoryById(routerState.db, captured.target)
    if (existing === null) {
      return makePlan(routerState, lease, captured, 'rejected', [], rejected(['missing_target']))
    }
    return supersedePlan(
      routerState,
      lease,
      captured,
      captureState,
      existing,
    )
  }

  const duplicates = duplicateCandidates(routerState.db, captured.record)
  if (duplicates.length > 0) {
    const duplicate = duplicates[0]
    const importance = mathMin(
      1,
      mathMax(0, nativeNumber(duplicate.memory.importance ?? 0) + 0.05),
    )
    const memory = postImportance(duplicate.memory, importance)
    return makePlan(
      routerState,
      lease,
      captured,
      'duplicate_bumped',
      [effect('cdx_memory_set_importance', {
        id: duplicate.memory.id,
        importance,
      })],
      {
        memory,
        outcome: 'duplicate_bumped',
        similarity: duplicate.similarity,
        reasons: [],
      },
    )
  }
  const row = normalizeInsertRow(captured, captureState, 'add')
  return makePlan(
    routerState,
    lease,
    captured,
    'inserted',
    [effect('cdx_memory_insert', { row })],
    { memory: row, outcome: 'inserted', reasons: [] },
  )
}

function resolveDelete(routerState, lease, captured) {
  const memory = memoryById(routerState.db, captured.id)
  if (memory === null) {
    return makePlan(
      routerState,
      lease,
      captured,
      'not_found',
      [],
      { deleted: false, reason: 'not_found' },
    )
  }
  if (isPermanent(memory.type) && captured.actor !== 'explicit_user_action') {
    return makePlan(
      routerState,
      lease,
      captured,
      'permanent_type_protected',
      [],
      { deleted: false, memory, reason: 'permanent_type_protected' },
    )
  }
  return makePlan(
    routerState,
    lease,
    captured,
    'deleted',
    [effect('cdx_memory_delete', { id: memory.id })],
    { deleted: true, memory, reason: 'deleted' },
  )
}

function resolveTopic(routerState, lease, captured) {
  const rows = statementAllRows(
    routerState.db,
    `SELECT ${ROW_PROJECTION}
       FROM main.memory_fts
       JOIN main.memories AS m ON m.id = main.memory_fts.memory_id
      WHERE memory_fts MATCH ?
        AND m.palari_id = ?
        AND m.valid_until IS NULL
        AND (? = '' OR m.user_id = ? OR m.user_id IS NULL OR m.shared = 1)`,
    [captured.query, captured.palariId, captured.userId, captured.userId],
  )
  const byId = reflectConstruct(nativeMap, [])
  for (let index = 0; index < rows.length; index += 1) {
    const memory = copyNativeRecord(rows[index], ROW_KEYS)
    if (!reflectApply(mapHas, byId, [memory.id])) {
      reflectApply(mapSet, byId, [memory.id, memory])
    }
  }
  const deleted = []
  reflectApply(mapForEach, byId, [(memory) => {
    if (isPermanent(memory.type) && captured.actor !== 'explicit_user_action') return
    reflectApply(arrayPush, deleted, [memory.id])
  }])
  reflectApply(arraySort, deleted, [binaryAscending])
  const effects = []
  for (let index = 0; index < deleted.length; index += 1) {
    reflectApply(arrayPush, effects, [
      effect('cdx_memory_delete', { id: deleted[index] }),
    ])
  }
  return makePlan(
    routerState,
    lease,
    captured,
    'topic_forgotten',
    effects,
    { count: deleted.length, deleted },
  )
}

function resolveRecall(routerState, lease, captured) {
  const rows = []
  for (let index = 0; index < captured.memoryIds.length; index += 1) {
    const row = memoryById(routerState.db, captured.memoryIds[index])
    if (row !== null) reflectApply(arrayPush, rows, [row])
  }
  for (let index = 0; index < rows.length; index += 1) {
    if (rows[index].access_count === numberMaxSafeInteger) {
      throw reflectConstruct(nativeRangeError, [
        'Memory access_count cannot be incremented safely.',
      ])
    }
  }
  const effects = []
  const touched = []
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    const importance = mathMin(
      1,
      mathMax(0, nativeNumber(row.importance ?? 0) + captured.bumpAmount),
    )
    reflectApply(arrayPush, effects, [effect('cdx_memory_touch', {
      id: row.id,
      lastAccessed: captured.storeTime,
    })])
    reflectApply(arrayPush, effects, [effect('cdx_memory_set_importance', {
      id: row.id,
      importance,
    })])
    reflectApply(arrayPush, touched, [{ id: row.id, importance }])
  }
  return makePlan(
    routerState,
    lease,
    captured,
    'recall_recorded',
    effects,
    { touched, touchedCount: touched.length },
  )
}

function resolveLifecycle(routerState, lease, captured, captureState) {
  const transientTypes = [
    'working',
    'project',
    'recent_life',
    'session_summary',
  ]
  const placeholderValues = []
  for (let index = 0; index < transientTypes.length; index += 1) {
    reflectApply(arrayPush, placeholderValues, ['?'])
  }
  const placeholders = reflectApply(arrayJoin, placeholderValues, [', '])
  const params = []
  if (captured.palariId) reflectApply(arrayPush, params, [captured.palariId])
  for (let index = 0; index < transientTypes.length; index += 1) {
    reflectApply(arrayPush, params, [transientTypes[index]])
  }
  const nativeRows = statementAllRows(
    routerState.db,
    `SELECT ${ROW_PROJECTION}
       FROM main.memories AS m
      WHERE m.valid_until IS NULL
        ${captured.palariId ? 'AND m.palari_id = ?' : ''}
        AND m.type IN (${placeholders})
      ORDER BY m.created_at ASC, m.id COLLATE BINARY ASC`,
    params,
  )
  const rows = []
  for (let index = 0; index < nativeRows.length; index += 1) {
    reflectApply(arrayPush, rows, [copyNativeRecord(nativeRows[index], ROW_KEYS)])
  }
  const effects = []
  const result = { decayed: 0, deleted: 0, skipped: 0, touched: 0 }
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    const reference = row.last_decayed_at ?? row.created_at
    const referenceMs = reflectApply(dateParse, nativeDate, [reference])
    const ageDays = reflectApply(numberIsNaN, undefined, [referenceMs])
      ? 365
      : mathMax(0, (captureState.privateValues.nowMs - referenceMs) / 86400000)
    const windows = mathFloor(ageDays / 14)
    if (windows < 1) {
      result.skipped += 1
      continue
    }
    const importance = mathMax(
      0,
      nativeNumber(row.importance ?? 0) - (0.1 * windows),
    )
    if (importance <= 0.1) {
      reflectApply(arrayPush, effects, [effect('cdx_memory_delete', { id: row.id })])
      result.deleted += 1
    } else {
      reflectApply(arrayPush, effects, [effect('cdx_memory_decay', {
        id: row.id,
        importance,
        lastDecayedAt: captured.now,
      })])
      result.decayed += 1
    }
  }
  result.touched = result.decayed + result.deleted
  return makePlan(
    routerState,
    lease,
    captured,
    'lifecycle_ran',
    effects,
    result,
  )
}

function validateRow(row) {
  if (!isOrdinaryRecord(row)) return false
  const keys = reflectApply(reflectOwnKeys, undefined, [row])
  if (keys.length !== ROW_KEYS.length) return false
  for (let index = 0; index < ROW_KEYS.length; index += 1) {
    if (keys[index] !== ROW_KEYS[index]) return false
    const descriptor = reflectApply(
      reflectGetOwnPropertyDescriptor,
      undefined,
      [row, ROW_KEYS[index]],
    )
    if (
      descriptor === undefined ||
      !reflectApply(objectHasOwnProperty, descriptor, ['value'])
    ) return false
  }
  const requiredStrings = [
    'id', 'palari_id', 'type', 'content', 'keywords', 'valid_from',
    'created_at', 'acquisition_mode', 'content_hash',
  ]
  for (let index = 0; index < requiredStrings.length; index += 1) {
    if (typeof row[requiredStrings[index]] !== 'string') return false
  }
  const nullableStrings = [
    'user_id', 'valid_until', 'last_accessed', 'last_decayed_at',
    'source_message_id', 'source_kind', 'extractor',
  ]
  for (let index = 0; index < nullableStrings.length; index += 1) {
    const value = row[nullableStrings[index]]
    if (value !== null && typeof value !== 'string') return false
  }
  if (!numberIsFinite(row.importance) || !numberIsFinite(row.confidence)) return false
  if (!numberIsSafeInteger(row.access_count) || row.access_count < 0) return false
  const booleanKeys = ['shared', 'created_by_pipeline', 'fictional']
  for (let index = 0; index < booleanKeys.length; index += 1) {
    const key = booleanKeys[index]
    if (row[key] !== 0 && row[key] !== 1) return false
  }
  return true
}

function validateLink(link) {
  if (!isOrdinaryRecord(link)) return false
  const keys = reflectApply(reflectOwnKeys, undefined, [link])
  if (keys.length !== LINK_KEYS.length) return false
  for (let index = 0; index < LINK_KEYS.length; index += 1) {
    const key = LINK_KEYS[index]
    if (keys[index] !== key) return false
    const descriptor = reflectApply(
      reflectGetOwnPropertyDescriptor,
      undefined,
      [link, key],
    )
    if (
      descriptor === undefined ||
      !reflectApply(objectHasOwnProperty, descriptor, ['value']) ||
      typeof descriptor.value !== 'string'
    ) return false
  }
  return true
}

function hasExactOwnDataKeys(value, expected) {
  if (!isOrdinaryRecord(value)) return false
  const keys = reflectApply(reflectOwnKeys, undefined, [value])
  if (keys.length !== expected.length) return false
  for (let index = 0; index < expected.length; index += 1) {
    if (keys[index] !== expected[index]) return false
    const descriptor = reflectApply(
      reflectGetOwnPropertyDescriptor,
      undefined,
      [value, expected[index]],
    )
    if (
      descriptor === undefined ||
      !reflectApply(objectHasOwnProperty, descriptor, ['value'])
    ) return false
  }
  return true
}

function validateDenseArray(value, itemValidator) {
  if (!arrayIsArray(value) || reflectApply(isProxy, undefined, [value])) {
    return false
  }
  const keys = reflectApply(reflectOwnKeys, undefined, [value])
  if (keys.length !== value.length + 1 || keys[keys.length - 1] !== 'length') {
    return false
  }
  for (let index = 0; index < value.length; index += 1) {
    const key = reflectApply(nativeString, undefined, [index])
    if (keys[index] !== key) return false
    const descriptor = reflectApply(
      reflectGetOwnPropertyDescriptor,
      undefined,
      [value, key],
    )
    if (
      descriptor === undefined ||
      !reflectApply(objectHasOwnProperty, descriptor, ['value']) ||
      !itemValidator(descriptor.value, index)
    ) return false
  }
  return true
}

function validateReasons(value, { empty = false } = {}) {
  return validateDenseArray(value, (reason) => typeof reason === 'string') &&
    (!empty || value.length === 0)
}

function validateTouched(value) {
  return validateDenseArray(value, (entry) => (
    hasExactOwnDataKeys(entry, ['id', 'importance']) &&
    typeof entry.id === 'string' &&
    reflectApply(numberIsFinite, undefined, [entry.importance])
  ))
}

function validateDeletedIds(value) {
  return validateDenseArray(value, (id) => typeof id === 'string')
}

function effectKindsAre(effects, expected) {
  if (effects.length !== expected.length) return false
  for (let index = 0; index < expected.length; index += 1) {
    if (effects[index].kind !== expected[index]) return false
  }
  return true
}

function validatePlanResult(outcome, result, effects) {
  switch (outcome) {
    case 'rejected':
      return hasExactOwnDataKeys(result, ['outcome', 'reasons']) &&
        result.outcome === 'rejected' &&
        validateReasons(result.reasons) &&
        effects.length === 0
    case 'inserted':
      return hasExactOwnDataKeys(result, ['memory', 'outcome', 'reasons']) &&
        validateRow(result.memory) &&
        result.outcome === 'inserted' &&
        validateReasons(result.reasons, { empty: true }) &&
        effectKindsAre(effects, ['cdx_memory_insert'])
    case 'duplicate_bumped':
      return hasExactOwnDataKeys(
        result,
        ['memory', 'outcome', 'similarity', 'reasons'],
      ) &&
        validateRow(result.memory) &&
        result.outcome === 'duplicate_bumped' &&
        reflectApply(numberIsFinite, undefined, [result.similarity]) &&
        validateReasons(result.reasons, { empty: true }) &&
        effectKindsAre(effects, ['cdx_memory_set_importance'])
    case 'superseded':
      return hasExactOwnDataKeys(
        result,
        ['link', 'memory', 'outcome', 'reasons', 'superseded'],
      ) &&
        validateLink(result.link) &&
        validateRow(result.memory) &&
        result.outcome === 'superseded' &&
        validateReasons(result.reasons, { empty: true }) &&
        validateRow(result.superseded) &&
        effectKindsAre(effects, [
          'cdx_memory_end_validity',
          'cdx_memory_insert',
          'cdx_link_insert',
        ])
    case 'demoted': {
      const endValidity = hasExactOwnDataKeys(
        result,
        ['memory', 'outcome', 'reasons'],
      ) && validateRow(result.memory) &&
        effectKindsAre(effects, ['cdx_memory_end_validity'])
      const deleted = hasExactOwnDataKeys(
        result,
        ['deletedId', 'outcome', 'reasons'],
      ) && typeof result.deletedId === 'string' &&
        effectKindsAre(effects, ['cdx_memory_delete'])
      return (endValidity || deleted) &&
        result.outcome === 'demoted' &&
        validateReasons(result.reasons, { empty: true })
    }
    case 'ratified':
      return hasExactOwnDataKeys(result, ['memory', 'outcome', 'reasons']) &&
        validateRow(result.memory) &&
        result.outcome === 'ratified' &&
        validateReasons(result.reasons, { empty: true }) &&
        effectKindsAre(effects, ['cdx_memory_set_shared'])
    case 'deleted':
      return hasExactOwnDataKeys(result, ['deleted', 'memory', 'reason']) &&
        result.deleted === true &&
        validateRow(result.memory) &&
        result.reason === 'deleted' &&
        effectKindsAre(effects, ['cdx_memory_delete'])
    case 'not_found':
      return hasExactOwnDataKeys(result, ['deleted', 'reason']) &&
        result.deleted === false &&
        result.reason === 'not_found' &&
        effects.length === 0
    case 'permanent_type_protected':
      return hasExactOwnDataKeys(result, ['deleted', 'memory', 'reason']) &&
        result.deleted === false &&
        validateRow(result.memory) &&
        result.reason === 'permanent_type_protected' &&
        effects.length === 0
    case 'topic_forgotten':
      return hasExactOwnDataKeys(result, ['count', 'deleted']) &&
        reflectApply(numberIsSafeInteger, undefined, [result.count]) &&
        result.count >= 0 &&
        validateDeletedIds(result.deleted) &&
        result.count === result.deleted.length &&
        validateDenseArray(effects, (entry) => (
          validateEffect(entry) && entry.kind === 'cdx_memory_delete'
        ))
    case 'recall_recorded':
      return hasExactOwnDataKeys(result, ['touched', 'touchedCount']) &&
        validateTouched(result.touched) &&
        reflectApply(numberIsSafeInteger, undefined, [result.touchedCount]) &&
        result.touchedCount === result.touched.length &&
        validateDenseArray(effects, (entry, index) => (
          validateEffect(entry) &&
          entry.kind === (
            index % 2 === 0
              ? 'cdx_memory_touch'
              : 'cdx_memory_set_importance'
          )
        )) && effects.length === result.touchedCount * 2
    case 'lifecycle_ran': {
      if (!hasExactOwnDataKeys(
        result,
        ['decayed', 'deleted', 'skipped', 'touched'],
      )) return false
      const counts = [
        result.decayed,
        result.deleted,
        result.skipped,
        result.touched,
      ]
      for (let index = 0; index < counts.length; index += 1) {
        if (
          !reflectApply(numberIsSafeInteger, undefined, [counts[index]]) ||
          counts[index] < 0
        ) return false
      }
      if (result.touched !== result.decayed + result.deleted) return false
      let decayed = 0
      let deleted = 0
      if (!validateDenseArray(effects, (entry) => {
        if (!validateEffect(entry)) return false
        if (entry.kind === 'cdx_memory_decay') decayed += 1
        else if (entry.kind === 'cdx_memory_delete') deleted += 1
        else return false
        return true
      })) return false
      return decayed === result.decayed && deleted === result.deleted
    }
  }
  return false
}

function validateEffect(effectValue) {
  if (!isOrdinaryRecord(effectValue)) return false
  const kind = ownData(effectValue, 'kind', { rejectAccessor: false })
  if (!reflectApply(setHas, effectKindSet, [kind])) return false
  const expected = {
    cdx_memory_insert: ['kind', 'row'],
    cdx_memory_end_validity: ['kind', 'id', 'validUntil'],
    cdx_memory_set_shared: ['kind', 'id'],
    cdx_memory_set_importance: ['kind', 'id', 'importance'],
    cdx_memory_touch: ['kind', 'id', 'lastAccessed'],
    cdx_memory_decay: ['kind', 'id', 'importance', 'lastDecayedAt'],
    cdx_memory_delete: ['kind', 'id'],
    cdx_link_insert: ['kind', 'link'],
  }[kind]
  const keys = reflectApply(reflectOwnKeys, undefined, [effectValue])
  if (keys.length !== expected.length) return false
  for (let index = 0; index < expected.length; index += 1) {
    if (keys[index] !== expected[index]) return false
    const descriptor = reflectApply(
      reflectGetOwnPropertyDescriptor,
      undefined,
      [effectValue, expected[index]],
    )
    if (
      descriptor === undefined ||
      !reflectApply(objectHasOwnProperty, descriptor, ['value'])
    ) return false
  }
  if (kind === 'cdx_memory_insert') return validateRow(effectValue.row)
  if (kind === 'cdx_link_insert') return validateLink(effectValue.link)
  if (typeof effectValue.id !== 'string') return false
  if (kind === 'cdx_memory_end_validity' && typeof effectValue.validUntil !== 'string') return false
  if (kind === 'cdx_memory_touch' && typeof effectValue.lastAccessed !== 'string') return false
  if (
    (kind === 'cdx_memory_set_importance' || kind === 'cdx_memory_decay') &&
    !numberIsFinite(effectValue.importance)
  ) return false
  if (kind === 'cdx_memory_decay' && typeof effectValue.lastDecayedAt !== 'string') return false
  return true
}

function validatePlanDraft(plan) {
  if (!hasExactOwnDataKeys(
    plan,
    ['version', 'intentKind', 'outcome', 'effects', 'result'],
  )) return false
  if (
    plan.version !== 'CDX-M1-legacy-plan@1' ||
    !reflectApply(setHas, intentKindSet, [plan.intentKind]) ||
    !reflectApply(setHas, planOutcomeSet, [plan.outcome]) ||
    !validateDenseArray(plan.effects, (entry) => validateEffect(entry))
  ) return false
  const allowed = {
    legacy_proposal: [
      'rejected',
      'inserted',
      'duplicate_bumped',
      'superseded',
      'demoted',
      'ratified',
    ],
    legacy_delete_memory: [
      'deleted',
      'not_found',
      'permanent_type_protected',
    ],
    legacy_forget_topic: ['topic_forgotten'],
    legacy_record_recall_inclusion: ['recall_recorded'],
    legacy_run_lifecycle: ['lifecycle_ran'],
  }[plan.intentKind]
  let outcomeAllowed = false
  for (let index = 0; index < allowed.length; index += 1) {
    if (allowed[index] === plan.outcome) {
      outcomeAllowed = true
      break
    }
  }
  return outcomeAllowed && validatePlanResult(
    plan.outcome,
    plan.result,
    plan.effects,
  )
}

export function applyLegacyMutationEffectInTransaction(lease, db, effectValue) {
  assertActiveMutationLease(lease, db)
  if (!validateEffect(effectValue)) throw legacyFailure('legacy_effect_invalid')
  switch (effectValue.kind) {
    case 'cdx_memory_insert': {
      const row = effectValue.row
      statementRunOne(
        db,
        `INSERT INTO main.memories (
          id, palari_id, user_id, type, content, keywords, importance,
          valid_from, valid_until, access_count, last_accessed, created_at,
          shared, confidence, acquisition_mode, created_by_pipeline,
          fictional, last_decayed_at, source_message_id, content_hash,
          source_kind, extractor
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        (() => {
          const values = []
          for (let index = 0; index < ROW_KEYS.length; index += 1) {
            reflectApply(arrayPush, values, [row[ROW_KEYS[index]]])
          }
          return values
        })(),
      )
      break
    }
    case 'cdx_memory_end_validity':
      statementRunOne(
        db,
        'UPDATE main.memories SET valid_until = ? WHERE id = ?',
        [effectValue.validUntil, effectValue.id],
      )
      break
    case 'cdx_memory_set_shared':
      statementRunOne(
        db,
        'UPDATE main.memories SET shared = 1 WHERE id = ?',
        [effectValue.id],
      )
      break
    case 'cdx_memory_set_importance':
      statementRunOne(
        db,
        'UPDATE main.memories SET importance = ? WHERE id = ?',
        [effectValue.importance, effectValue.id],
      )
      break
    case 'cdx_memory_touch':
      statementRunOne(
        db,
        `UPDATE main.memories
            SET access_count = access_count + 1,
                last_accessed = ?
          WHERE id = ?
            AND access_count < ${numberMaxSafeInteger}`,
        [effectValue.lastAccessed, effectValue.id],
      )
      break
    case 'cdx_memory_decay':
      statementRunOne(
        db,
        `UPDATE main.memories
            SET importance = ?, last_decayed_at = ?
          WHERE id = ?`,
        [effectValue.importance, effectValue.lastDecayedAt, effectValue.id],
      )
      break
    case 'cdx_memory_delete':
      statementRunOne(
        db,
        'DELETE FROM main.memories WHERE id = ?',
        [effectValue.id],
      )
      break
    case 'cdx_link_insert': {
      const link = effectValue.link
      statementRunOne(
        db,
        `INSERT INTO main.memory_links (
          id, from_memory_id, to_memory_id, relation, created_at
        ) VALUES (?, ?, ?, ?, ?)`,
        (() => {
          const values = []
          for (let index = 0; index < LINK_KEYS.length; index += 1) {
            reflectApply(arrayPush, values, [link[LINK_KEYS[index]]])
          }
          return values
        })(),
      )
      break
    }
  }
}

function captureGovernedErasureProjectionInput(input) {
  if (!isOrdinaryRecord(input)) {
    throw legacyFailure('legacy_effect_invalid')
  }
  const keys = reflectApply(reflectOwnKeys, undefined, [input])
  if (keys.length !== GOVERNED_ERASURE_PROJECTION_INPUT_KEYS.length) {
    throw legacyFailure('legacy_effect_invalid')
  }
  const values = []
  for (
    let index = 0;
    index < GOVERNED_ERASURE_PROJECTION_INPUT_KEYS.length;
    index += 1
  ) {
    const key = GOVERNED_ERASURE_PROJECTION_INPUT_KEYS[index]
    if (keys[index] !== key) throw legacyFailure('legacy_effect_invalid')
    const descriptor = reflectApply(
      reflectGetOwnPropertyDescriptor,
      undefined,
      [input, key],
    )
    if (
      descriptor === undefined ||
      !reflectApply(objectHasOwnProperty, descriptor, ['value']) ||
      typeof descriptor.value !== 'string'
    ) {
      throw legacyFailure('legacy_effect_invalid')
    }
    reflectApply(arrayPush, values, [descriptor.value])
  }
  const id = values[0]
  const palariId = values[1]
  const userId = values[2]
  if (
    !reflectApply(regexpTest, GOVERNED_TARGET_ID_PATTERN, [id]) ||
    !reflectApply(regexpTest, GOVERNED_SCOPE_ID_PATTERN, [palariId]) ||
    !reflectApply(regexpTest, GOVERNED_SCOPE_ID_PATTERN, [userId])
  ) {
    throw legacyFailure('legacy_effect_invalid')
  }
  return { id, palariId, userId }
}

function readGovernedErasureProjectionCounts(db, input) {
  const row = statementGetRow(
    db,
    `SELECT
       (SELECT COUNT(*)
          FROM main.memories
         WHERE id = ?
           AND palari_id = ?
           AND user_id = ?
           AND shared = 0) AS target_count,
       (SELECT COUNT(*)
          FROM main.memory_fts
         WHERE memory_id = ?) AS fts_count,
       (SELECT COUNT(*)
          FROM main.memory_links
         WHERE from_memory_id = ? OR to_memory_id = ?) AS link_count`,
    [
      input.id,
      input.palariId,
      input.userId,
      input.id,
      input.id,
      input.id,
    ],
  )
  if (
    row === null ||
    typeof row !== 'object' ||
    reflectApply(isProxy, undefined, [row])
  ) {
    throw legacyFailure('legacy_effect_cardinality')
  }
  const keys = reflectApply(reflectOwnKeys, undefined, [row])
  if (keys.length !== GOVERNED_ERASURE_PROJECTION_COUNT_KEYS.length) {
    throw legacyFailure('legacy_effect_cardinality')
  }
  const counts = []
  for (
    let index = 0;
    index < GOVERNED_ERASURE_PROJECTION_COUNT_KEYS.length;
    index += 1
  ) {
    const key = GOVERNED_ERASURE_PROJECTION_COUNT_KEYS[index]
    const descriptor = reflectApply(
      reflectGetOwnPropertyDescriptor,
      undefined,
      [row, key],
    )
    if (
      keys[index] !== key ||
      descriptor === undefined ||
      !reflectApply(objectHasOwnProperty, descriptor, ['value']) ||
      !reflectApply(numberIsSafeInteger, undefined, [descriptor.value]) ||
      descriptor.value < 0
    ) {
      throw legacyFailure('legacy_effect_cardinality')
    }
    reflectApply(arrayPush, counts, [descriptor.value])
  }
  return counts
}

export function prepareGovernedErasureProjectionInTransaction(
  lease,
  db,
  input,
) {
  assertActiveMutationLease(lease, db)
  const captured = captureGovernedErasureProjectionInput(input)
  const counts = readGovernedErasureProjectionCounts(db, captured)
  const targetCount = counts[0]
  const ftsCount = counts[1]
  const linkCount = counts[2]
  if (targetCount !== 1 || ftsCount !== 1 || linkCount !== 0) {
    throw legacyFailure('legacy_effect_cardinality')
  }
  const token = freezeRecord({ __proto__: null })
  reflectApply(weakMapSet, governedErasureProjectionTokenStates, [token, {
    db,
    id: captured.id,
    lease,
    state: 'ready',
  }])
  return token
}

export function applyGovernedErasureProjectionInTransaction(lease, db, token) {
  assertActiveMutationLease(lease, db)
  const state = reflectApply(
    weakMapGet,
    governedErasureProjectionTokenStates,
    [token],
  )
  if (state === undefined) throw legacyFailure('legacy_plan_invalid')
  if (state.db !== db || state.lease !== lease) {
    throw legacyFailure('legacy_plan_stale')
  }
  if (state.state !== 'ready') throw legacyFailure('legacy_plan_applied')
  state.state = 'consumed'
  statementRunOne(
    db,
    'DELETE FROM main.memories WHERE id = ?',
    [state.id],
  )
}

function captureRouterOptions(options) {
  if (options === undefined) return () => reflectConstruct(nativeDate, [])
  if (!isOrdinaryRecord(options)) throw legacyFailure('legacy_invalid_argument')
  const keys = reflectApply(reflectOwnKeys, undefined, [options])
  if (keys.length === 0) return () => reflectConstruct(nativeDate, [])
  if (keys.length !== 1 || keys[0] !== 'clock') {
    throw legacyFailure('legacy_invalid_argument')
  }
  const descriptor = reflectGetOwnPropertyDescriptor(options, 'clock')
  if (!reflectApply(objectHasOwnProperty, descriptor, ['value'])) {
    throw legacyFailure('legacy_invalid_argument')
  }
  if (typeof descriptor.value !== 'function') {
    throw legacyFailure('legacy_invalid_argument')
  }
  return descriptor.value
}

export function createLegacyMutationRouter(db, options = undefined) {
  const clock = captureRouterOptions(options)
  const routerState = { db, router: null }

  const capture = function capture(intent) {
    const existingState = reflectApply(weakMapGet, capturedStates, [intent])
    if (existingState !== undefined) {
      if (existingState.router !== routerState) {
        throw legacyFailure('legacy_invalid_argument')
      }
      return intent
    }
    if (!isOrdinaryRecord(intent)) throw legacyFailure('legacy_invalid_argument')
    const intentKind = ownData(intent, 'intentKind')
    if (
      typeof intentKind !== 'string' ||
      !reflectApply(setHas, intentKindSet, [intentKind])
    ) {
      throw legacyFailure('legacy_invalid_argument')
    }
    let capturedState
    switch (intentKind) {
      case 'legacy_proposal':
        capturedState = captureProposal(intent, clock, db)
        break
      case 'legacy_delete_memory':
        capturedState = captureDelete(intent)
        break
      case 'legacy_forget_topic':
        capturedState = captureTopic(intent)
        break
      case 'legacy_record_recall_inclusion':
        capturedState = captureRecall(intent, clock, db)
        break
      case 'legacy_run_lifecycle':
        capturedState = captureLifecycle(intent, clock, db)
        break
    }
    reflectApply(weakMapSet, capturedStates, [capturedState.captured, {
      ...capturedState,
      router: routerState,
    }])
    return capturedState.captured
  }

  const resolve = function resolve(lease, captured) {
    assertActiveMutationLease(lease, db)
    const captureState = validateCapturedShape(captured)
    if (captureState.router !== routerState) {
      throw legacyFailure('legacy_invalid_argument')
    }
    switch (captured.intentKind) {
      case 'legacy_proposal':
        return resolveProposal(routerState, lease, captured, captureState)
      case 'legacy_delete_memory':
        return resolveDelete(routerState, lease, captured)
      case 'legacy_forget_topic':
        return resolveTopic(routerState, lease, captured)
      case 'legacy_record_recall_inclusion':
        return resolveRecall(routerState, lease, captured)
      case 'legacy_run_lifecycle':
        return resolveLifecycle(routerState, lease, captured, captureState)
    }
  }

  const apply = function apply(lease, plan) {
    assertActiveMutationLease(lease, db)
    const state = reflectApply(weakMapGet, planStates, [plan])
    if (state === undefined) throw legacyFailure('legacy_plan_invalid')
    if (
      state.router !== routerState ||
      state.db !== db ||
      state.lease !== lease
    ) {
      throw legacyFailure('legacy_plan_stale')
    }
    if (state.state === 'consumed') throw legacyFailure('legacy_plan_applied')
    state.state = 'consumed'
    for (let index = 0; index < plan.effects.length; index += 1) {
      applyLegacyMutationEffectInTransaction(lease, db, plan.effects[index])
    }
  }

  const router = freezeRecord({ apply, capture, resolve })
  routerState.router = router
  return router
}

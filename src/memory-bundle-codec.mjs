import { hash as nativeHash } from 'node:crypto'

import {
  memoryBundleFailure,
  preserveMemoryBundleError,
} from './memory-bundle-errors.mjs'
import {
  constructNativeDate,
  isAbsolutePath,
  isProxyValue,
  nativeDateToISOString,
} from './memory-bundle-runtime.mjs'

const reflectApply = Reflect.apply
const reflectConstruct = Reflect.construct
const reflectDefineProperty = Reflect.defineProperty
const reflectGetOwnPropertyDescriptor = Reflect.getOwnPropertyDescriptor
const reflectGetPrototypeOf = Reflect.getPrototypeOf
const reflectOwnKeys = Reflect.ownKeys

const arrayIsArray = Array.isArray
const arrayPrototype = Array.prototype
const objectPrototype = Object.prototype
const objectHasOwnProperty = Object.prototype.hasOwnProperty
const objectIs = Object.is
const numberIsFinite = Number.isFinite
const numberIsSafeInteger = Number.isSafeInteger
const numberToString = Number.prototype.toString
const stringCharCodeAt = String.prototype.charCodeAt
const stringIndexOf = String.prototype.indexOf
const stringSlice = String.prototype.slice
const stringStartsWith = String.prototype.startsWith
const regexpExec = RegExp.prototype.exec
const jsonParse = JSON.parse
const jsonStringify = JSON.stringify
const nativeMap = Map
const mapGet = Map.prototype.get
const mapSet = Map.prototype.set
const cryptoHash = nativeHash

const IDENTITY_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const CHECKSUM_PATTERN = /^[0-9a-f]{64}$/

const MEMORY_TYPES = [
  'relationship',
  'preference',
  'opinion',
  'entity',
  'life_event',
  'working',
  'project',
  'recent_life',
  'session_summary',
]
const PERMANENT_MEMORY_TYPES = [
  'relationship',
  'preference',
  'opinion',
  'entity',
  'life_event',
]
const TRANSIENT_MEMORY_TYPES = [
  'working',
  'project',
  'recent_life',
  'session_summary',
]
const PROPOSAL_KINDS = ['promote', 'permanent', 'demote']
const OPERATIONS = ['create', 'delete']
const OUTCOMES = ['applied', 'refused']
const REFUSAL_REASONS = [
  'below_threshold',
  'duplicate_current',
  'missing_target',
  'unauthorized',
  'unsupported',
]
const CREATE_REFUSAL_REASONS = [
  'below_threshold',
  'duplicate_current',
  'unauthorized',
  'unsupported',
]
const DELETE_REFUSAL_REASONS = [
  'missing_target',
  'unauthorized',
  'unsupported',
]

const INITIALIZER_OPTION_KEYS = ['clock', 'idFactory']
const OPEN_OPTION_KEYS = ['dbPath']
const APPLY_ENVELOPE_KEYS = ['expectedHead', 'decision', 'atom']
const EXPECTED_HEAD_KEYS = ['streamId', 'sequence']
const DECISION_KEYS = [
  'decisionId',
  'proposalId',
  'proposalKind',
  'operation',
  'outcome',
  'reasonCode',
  'scope',
  'authority',
  'evidenceKind',
  'memoryId',
  'memoryType',
  'effectiveAt',
  'observedAt',
]
const SCOPE_KEYS = ['palariId', 'userId']
const AUTHORITY_KEYS = ['kind', 'authorityId']
const INPUT_ATOM_KEYS = [
  'content',
  'keywords',
  'initialImportance',
  'confidence',
  'provenanceKind',
  'sourceMessageId',
  'fictional',
]
const CANONICAL_ATOM_KEYS = [
  'memoryId',
  'streamId',
  'createdSequence',
  'palariId',
  'userId',
  'type',
  'content',
  'keywords',
  'initialImportance',
  'confidence',
  'provenanceKind',
  'sourceMessageId',
  'validFrom',
  'createdAt',
  'fictional',
]
const ATOM_ROW_KEYS = [
  'memory_id',
  'stream_id',
  'created_sequence',
  'palari_id',
  'user_id',
  'type',
  'content',
  'keywords_json',
  'initial_importance',
  'confidence',
  'provenance_kind',
  'source_message_id',
  'valid_from',
  'created_at',
  'fictional',
  'content_checksum',
]
const EVENT_ROW_KEYS = [
  'sequence',
  'stream_id',
  'decision_id',
  'proposal_id',
  'proposal_kind',
  'operation',
  'outcome',
  'reason_code',
  'palari_id',
  'user_id',
  'authority_kind',
  'authority_id',
  'evidence_kind',
  'memory_id',
  'memory_type',
  'effective_at',
  'observed_at',
]

const ATOM_CHECKSUM_DOMAIN = 'palari-memory-bundle-atom-v1\0'
const ATOM_CHECKSUM_TAG = 'palari.memory-bundle-atom@1'
const POLICY_AUTHORITY_ID = 'palari-kernel-admission@1'

function fail(code, message) {
  throw memoryBundleFailure(code, message)
}

function hasOwn(object, key) {
  return reflectApply(objectHasOwnProperty, object, [key])
}

function defineData(object, key, value) {
  reflectApply(reflectDefineProperty, undefined, [object, key, {
    __proto__: null,
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  }])
}

function includesExact(values, candidate) {
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] === candidate) return true
  }
  return false
}

function matchesPattern(pattern, value) {
  return reflectApply(regexpExec, pattern, [value]) !== null
}

function snapshotDescriptors(value, ownKeys) {
  const descriptors = reflectConstruct(nativeMap, [])
  for (let index = 0; index < ownKeys.length; index += 1) {
    const key = ownKeys[index]
    const descriptor = reflectApply(
      reflectGetOwnPropertyDescriptor,
      undefined,
      [value, key],
    )
    reflectApply(mapSet, descriptors, [key, descriptor])
  }
  return descriptors
}

function captureRecord(
  value,
  keys,
  code,
  message,
  allowSubset,
  requiredPrototype,
) {
  try {
    if (isProxyValue(value)) fail(code, `${message} It must not be a Proxy.`)
    if (
      value === null ||
      typeof value !== 'object' ||
      reflectApply(arrayIsArray, undefined, [value]) ||
      reflectApply(reflectGetPrototypeOf, undefined, [value]) !== requiredPrototype
    ) {
      fail(code, message)
    }

    const ownKeys = reflectApply(reflectOwnKeys, undefined, [value])
    const descriptors = snapshotDescriptors(value, ownKeys)
    if (
      (!allowSubset && ownKeys.length !== keys.length) ||
      (allowSubset && ownKeys.length > keys.length)
    ) {
      fail(code, message)
    }

    for (let index = 0; index < ownKeys.length; index += 1) {
      const key = ownKeys[index]
      if (typeof key !== 'string' || !includesExact(keys, key)) {
        fail(code, message)
      }
      const descriptor = reflectApply(mapGet, descriptors, [key])
      if (
        descriptor === undefined ||
        descriptor.enumerable !== true ||
        !hasOwn(descriptor, 'value')
      ) {
        fail(code, message)
      }
    }

    const captured = {}
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index]
      const descriptor = reflectApply(mapGet, descriptors, [key])
      if (descriptor === undefined) {
        if (allowSubset) continue
        fail(code, message)
      }
      defineData(captured, key, descriptor.value)
    }
    return captured
  } catch (error) {
    throw preserveMemoryBundleError(error, code, message)
  }
}

function captureSqliteRow(value, keys, code, message) {
  return captureRecord(value, keys, code, message, false, null)
}

function validateSafeInteger(value, minimum, code, label) {
  if (
    typeof value !== 'number' ||
    !reflectApply(numberIsSafeInteger, undefined, [value]) ||
    value < minimum
  ) {
    fail(code, `${label} must be a safe integer greater than or equal to ${minimum}.`)
  }
  return value
}

function validateFiniteUnitNumber(value, code, label) {
  if (
    typeof value !== 'number' ||
    !reflectApply(numberIsFinite, undefined, [value]) ||
    reflectApply(objectIs, undefined, [value, -0]) ||
    value < 0 ||
    value > 1
  ) {
    fail(code, `${label} must be a finite number in [0,1] and must not be negative zero.`)
  }
  return value
}

function validateUnicodeScalarString(value, code, label, allowEmpty = true) {
  if (typeof value !== 'string' || (!allowEmpty && value.length === 0)) {
    fail(code, `${label} must be ${allowEmpty ? 'a string' : 'a non-empty string'}.`)
  }

  for (let index = 0; index < value.length; index += 1) {
    const unit = reflectApply(stringCharCodeAt, value, [index])
    if (unit >= 0xd800 && unit <= 0xdbff) {
      if (index + 1 >= value.length) {
        fail(code, `${label} must contain only Unicode scalar values.`)
      }
      const next = reflectApply(stringCharCodeAt, value, [index + 1])
      if (next < 0xdc00 || next > 0xdfff) {
        fail(code, `${label} must contain only Unicode scalar values.`)
      }
      index += 1
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      fail(code, `${label} must contain only Unicode scalar values.`)
    }
  }
  return value
}

function codePointAtScalar(value, index) {
  const first = reflectApply(stringCharCodeAt, value, [index])
  if (first < 0xd800 || first > 0xdbff) {
    return { codePoint: first, width: 1 }
  }
  const second = reflectApply(stringCharCodeAt, value, [index + 1])
  return {
    codePoint: ((first - 0xd800) * 0x400) + second - 0xdc00 + 0x10000,
    width: 2,
  }
}

function replaceCapturedValue(record, key, value) {
  reflectApply(reflectDefineProperty, undefined, [record, key, {
    __proto__: null,
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  }])
}

function validatePrimitiveToken(value, allowed, code, label) {
  if (typeof value !== 'string' || !includesExact(allowed, value)) {
    fail(code, `${label} is not supported.`)
  }
  return value
}

function validateCanonicalAtom(atom) {
  validatePrefixedUuidV4(atom.memoryId, 'mem_', 'bundle_invalid_atom')
  validatePrefixedUuidV4(atom.streamId, 'str_', 'bundle_invalid_atom')
  validateSafeInteger(
    atom.createdSequence,
    1,
    'bundle_invalid_atom',
    'Atom createdSequence',
  )
  validateIdentity(atom.palariId, 'bundle_invalid_atom')
  validateIdentity(atom.userId, 'bundle_invalid_atom')
  validateMemoryType(atom.type, 'bundle_invalid_atom')
  validateUnicodeScalarString(atom.content, 'bundle_invalid_atom', 'Atom content')
  validateFiniteUnitNumber(
    atom.initialImportance,
    'bundle_invalid_atom',
    'Atom initialImportance',
  )
  validateFiniteUnitNumber(
    atom.confidence,
    'bundle_invalid_atom',
    'Atom confidence',
  )
  if (atom.provenanceKind !== 'direct_user_message') {
    fail('bundle_invalid_atom', 'Atom provenanceKind is invalid.')
  }
  if (atom.sourceMessageId !== null) {
    validatePrefixedUuidV4(
      atom.sourceMessageId,
      'msg_',
      'bundle_invalid_atom',
    )
  }
  validateTimestamp(atom.validFrom, 'bundle_invalid_atom')
  validateTimestamp(atom.createdAt, 'bundle_invalid_atom')
  if (atom.validFrom > atom.createdAt) {
    fail('bundle_invalid_atom', 'Atom validFrom must not exceed createdAt.')
  }
  if (typeof atom.fictional !== 'boolean') {
    fail('bundle_invalid_atom', 'Atom fictional must be a boolean.')
  }

  const keywords = captureKeywords(atom.keywords)
  replaceCapturedValue(atom, 'keywords', keywords)
  return atom
}

function captureCanonicalAtom(value) {
  return validateCanonicalAtom(captureRecord(
    value,
    CANONICAL_ATOM_KEYS,
    'bundle_invalid_atom',
    'A canonical atom exact-shape object is required.',
    false,
    objectPrototype,
  ))
}

function stringifyCanonicalJson(value) {
  if (reflectApply(arrayIsArray, undefined, [value])) {
    let result = '['
    for (let index = 0; index < value.length; index += 1) {
      if (index !== 0) result += ','
      result += stringifyCanonicalJson(value[index])
    }
    return `${result}]`
  }
  return reflectApply(jsonStringify, undefined, [value])
}

function buildChecksumArray(atom) {
  const values = [
    ATOM_CHECKSUM_TAG,
    atom.memoryId,
    atom.streamId,
    atom.createdSequence,
    atom.palariId,
    atom.userId,
    atom.type,
    atom.content,
    atom.keywords,
    atom.initialImportance,
    atom.confidence,
    atom.provenanceKind,
    atom.sourceMessageId,
    atom.validFrom,
    atom.createdAt,
    atom.fictional,
  ]
  return values
}

function computeCapturedAtomChecksum(atom) {
  try {
    const input = ATOM_CHECKSUM_DOMAIN + stringifyCanonicalJson(
      buildChecksumArray(atom),
    )
    return reflectApply(cryptoHash, undefined, ['sha256', input, 'hex'])
  } catch (error) {
    throw preserveMemoryBundleError(
      error,
      'bundle_invalid_atom',
      'The canonical atom could not be checksummed.',
    )
  }
}

function buildAtomRow(atom, checksum) {
  const row = {}
  defineData(row, 'memory_id', atom.memoryId)
  defineData(row, 'stream_id', atom.streamId)
  defineData(row, 'created_sequence', atom.createdSequence)
  defineData(row, 'palari_id', atom.palariId)
  defineData(row, 'user_id', atom.userId)
  defineData(row, 'type', atom.type)
  defineData(row, 'content', atom.content)
  defineData(row, 'keywords_json', stringifyCanonicalJson(atom.keywords))
  defineData(row, 'initial_importance', atom.initialImportance)
  defineData(row, 'confidence', atom.confidence)
  defineData(row, 'provenance_kind', atom.provenanceKind)
  defineData(row, 'source_message_id', atom.sourceMessageId)
  defineData(row, 'valid_from', atom.validFrom)
  defineData(row, 'created_at', atom.createdAt)
  defineData(row, 'fictional', atom.fictional ? 1 : 0)
  defineData(row, 'content_checksum', checksum)
  return row
}

function buildDecodedAtom(atom, checksum) {
  const decoded = {}
  for (let index = 0; index < CANONICAL_ATOM_KEYS.length; index += 1) {
    const key = CANONICAL_ATOM_KEYS[index]
    defineData(decoded, key, atom[key])
  }
  defineData(decoded, 'contentChecksum', checksum)
  return decoded
}

function validateProposalPartition(proposalKind, memoryType) {
  if (
    (proposalKind === 'permanent' && includesExact(PERMANENT_MEMORY_TYPES, memoryType)) ||
    (proposalKind === 'promote' && includesExact(TRANSIENT_MEMORY_TYPES, memoryType))
  ) {
    return
  }
  fail('bundle_invalid_decision', 'Proposal kind does not match memory type.')
}

function validateEventMatrix(event) {
  const createApplied =
    event.operation === 'create' &&
    event.outcome === 'applied' &&
    event.reasonCode === null &&
    event.memoryId !== null &&
    event.memoryType !== null &&
    (event.proposalKind === 'promote' || event.proposalKind === 'permanent')
  if (createApplied) {
    validateProposalPartition(event.proposalKind, event.memoryType)
    return 'user'
  }

  const createRefused =
    event.operation === 'create' &&
    event.outcome === 'refused' &&
    includesExact(CREATE_REFUSAL_REASONS, event.reasonCode) &&
    event.memoryId === null &&
    event.memoryType !== null &&
    (event.proposalKind === 'promote' || event.proposalKind === 'permanent')
  if (createRefused) {
    validateProposalPartition(event.proposalKind, event.memoryType)
    return 'policy'
  }

  const deleteApplied =
    event.proposalKind === 'demote' &&
    event.operation === 'delete' &&
    event.outcome === 'applied' &&
    event.reasonCode === null &&
    event.memoryId !== null &&
    event.memoryType === null
  if (deleteApplied) return 'user'

  const deleteRefused =
    event.proposalKind === 'demote' &&
    event.operation === 'delete' &&
    event.outcome === 'refused' &&
    includesExact(DELETE_REFUSAL_REASONS, event.reasonCode) &&
    event.memoryId !== null &&
    event.memoryType === null
  if (deleteRefused) return 'policy'

  fail('bundle_invalid_decision', 'Persisted event does not match the decision matrix.')
}

function validateEventAuthority(event, requiredKind) {
  if (event.authorityKind !== 'user' && event.authorityKind !== 'policy') {
    fail('bundle_invalid_decision', 'Persisted event authority kind is invalid.')
  }
  if (typeof event.authorityId !== 'string') {
    fail('bundle_invalid_decision', 'Persisted event authority id is invalid.')
  }

  if (event.authorityKind === 'user') {
    validateIdentity(event.authorityId, 'bundle_invalid_decision')
  }

  if (event.authorityKind !== requiredKind) {
    fail('bundle_unauthorized', 'Persisted event authority kind is not authorized.')
  }
  if (
    (requiredKind === 'user' && event.authorityId !== event.userId) ||
    (requiredKind === 'policy' && event.authorityId !== POLICY_AUTHORITY_ID)
  ) {
    fail('bundle_unauthorized', 'Persisted event authority id is not authorized.')
  }
}

function buildDecodedEvent(row) {
  const event = {}
  defineData(event, 'sequence', row.sequence)
  defineData(event, 'streamId', row.stream_id)
  defineData(event, 'decisionId', row.decision_id)
  defineData(event, 'proposalId', row.proposal_id)
  defineData(event, 'proposalKind', row.proposal_kind)
  defineData(event, 'operation', row.operation)
  defineData(event, 'outcome', row.outcome)
  defineData(event, 'reasonCode', row.reason_code)
  defineData(event, 'palariId', row.palari_id)
  defineData(event, 'userId', row.user_id)
  defineData(event, 'authorityKind', row.authority_kind)
  defineData(event, 'authorityId', row.authority_id)
  defineData(event, 'evidenceKind', row.evidence_kind)
  defineData(event, 'memoryId', row.memory_id)
  defineData(event, 'memoryType', row.memory_type)
  defineData(event, 'effectiveAt', row.effective_at)
  defineData(event, 'observedAt', row.observed_at)
  return event
}

export function captureInitializerOptions(value) {
  const options = captureRecord(
    value,
    INITIALIZER_OPTION_KEYS,
    'bundle_invalid_argument',
    'Initializer options must be a plain exact-shape object.',
    true,
    objectPrototype,
  )
  for (let index = 0; index < INITIALIZER_OPTION_KEYS.length; index += 1) {
    const key = INITIALIZER_OPTION_KEYS[index]
    if (hasOwn(options, key) && typeof options[key] !== 'function') {
      fail('bundle_invalid_argument', `Initializer option ${key} must be a function.`)
    }
  }
  return options
}

export function captureOpenOptions(value) {
  const options = captureRecord(
    value,
    OPEN_OPTION_KEYS,
    'bundle_invalid_argument',
    'Public-open options must be a plain exact-shape object.',
    false,
    objectPrototype,
  )
  const dbPath = options.dbPath
  if (
    typeof dbPath !== 'string' ||
    dbPath.length === 0 ||
    reflectApply(stringIndexOf, dbPath, ['\0']) !== -1 ||
    !isAbsolutePath(dbPath)
  ) {
    fail('bundle_invalid_argument', 'dbPath must be a non-empty absolute path without NUL.')
  }
  return options
}

export function captureApplyEnvelope(value) {
  const envelope = captureRecord(
    value,
    APPLY_ENVELOPE_KEYS,
    'bundle_invalid_argument',
    'Apply input must be a plain exact-shape object.',
    false,
    objectPrototype,
  )
  const expectedHead = captureRecord(
    envelope.expectedHead,
    EXPECTED_HEAD_KEYS,
    'bundle_invalid_argument',
    'expectedHead must be a plain exact-shape object.',
    false,
    objectPrototype,
  )
  validatePrefixedUuidV4(
    expectedHead.streamId,
    'str_',
    'bundle_invalid_argument',
  )
  validateSafeInteger(
    expectedHead.sequence,
    0,
    'bundle_invalid_argument',
    'expectedHead.sequence',
  )
  replaceCapturedValue(envelope, 'expectedHead', expectedHead)
  return envelope
}

export function captureDecision(value) {
  return captureRecord(
    value,
    DECISION_KEYS,
    'bundle_invalid_decision',
    'decision must be a plain exact-shape object.',
    false,
    objectPrototype,
  )
}

export function captureScope(value) {
  return captureRecord(
    value,
    SCOPE_KEYS,
    'bundle_invalid_decision',
    'decision.scope must be a plain exact-shape object.',
    false,
    objectPrototype,
  )
}

export function captureAuthority(value) {
  return captureRecord(
    value,
    AUTHORITY_KEYS,
    'bundle_invalid_decision',
    'decision.authority must be a plain exact-shape object.',
    false,
    objectPrototype,
  )
}

export function captureAtom(value) {
  if (value === null) return null
  return captureRecord(
    value,
    INPUT_ATOM_KEYS,
    'bundle_invalid_atom',
    'atom must be null or a plain exact-shape object.',
    false,
    objectPrototype,
  )
}

export function captureKeywords(value) {
  const code = 'bundle_invalid_atom'
  const message = 'keywords must be a dense canonical ordinary array.'
  try {
    if (isProxyValue(value)) fail(code, `${message} It must not be a Proxy.`)
    if (
      !reflectApply(arrayIsArray, undefined, [value]) ||
      reflectApply(reflectGetPrototypeOf, undefined, [value]) !== arrayPrototype
    ) {
      fail(code, message)
    }

    const ownKeys = reflectApply(reflectOwnKeys, undefined, [value])
    const descriptors = snapshotDescriptors(value, ownKeys)
    const lengthDescriptor = reflectApply(mapGet, descriptors, ['length'])
    if (
      lengthDescriptor === undefined ||
      !hasOwn(lengthDescriptor, 'value') ||
      lengthDescriptor.writable !== true ||
      lengthDescriptor.enumerable !== false ||
      lengthDescriptor.configurable !== false ||
      !reflectApply(numberIsSafeInteger, undefined, [lengthDescriptor.value]) ||
      lengthDescriptor.value < 0 ||
      ownKeys.length !== lengthDescriptor.value + 1
    ) {
      fail(code, message)
    }

    const length = lengthDescriptor.value
    const captured = []
    let previous
    for (let index = 0; index < length; index += 1) {
      const key = reflectApply(numberToString, index, [])
      const descriptor = reflectApply(mapGet, descriptors, [key])
      if (
        descriptor === undefined ||
        descriptor.enumerable !== true ||
        !hasOwn(descriptor, 'value')
      ) {
        fail(code, message)
      }
      const keyword = validateUnicodeScalarString(
        descriptor.value,
        code,
        `keywords[${key}]`,
        false,
      )
      if (
        index !== 0 &&
        compareUnicodeScalarStrings(previous, keyword) >= 0
      ) {
        fail(code, 'keywords must be strictly increasing without duplicates.')
      }
      defineData(captured, key, keyword)
      previous = keyword
    }
    return captured
  } catch (error) {
    throw preserveMemoryBundleError(error, code, message)
  }
}

export function validateIdentity(value, code = 'bundle_invalid_decision') {
  if (
    typeof value !== 'string' ||
    !matchesPattern(IDENTITY_PATTERN, value)
  ) {
    fail(code, 'Identity must match the bounded ASCII identity grammar.')
  }
  return value
}

export function validatePrefixedUuidV4(
  value,
  prefix,
  code = 'bundle_invalid_decision',
) {
  if (
    typeof value !== 'string' ||
    typeof prefix !== 'string' ||
    !reflectApply(stringStartsWith, value, [prefix])
  ) {
    fail(code, 'Identifier must use the required UUID-v4 prefix.')
  }
  const uuid = reflectApply(stringSlice, value, [prefix.length])
  if (!matchesPattern(UUID_V4_PATTERN, uuid)) {
    fail(code, 'Identifier must contain a lowercase RFC 4122 UUIDv4.')
  }
  return value
}

export function validateTimestamp(value, code = 'bundle_invalid_decision') {
  if (
    typeof value !== 'string' ||
    !matchesPattern(TIMESTAMP_PATTERN, value)
  ) {
    fail(code, 'Timestamp must use the exact UTC millisecond form.')
  }
  try {
    const date = constructNativeDate([value])
    if (nativeDateToISOString(date) !== value) {
      fail(code, 'Timestamp must round trip through the intrinsic Date parser.')
    }
  } catch (error) {
    throw preserveMemoryBundleError(
      error,
      code,
      'Timestamp must be an exact calendar-valid UTC instant.',
    )
  }
  return value
}

export function validateMemoryType(value, code = 'bundle_invalid_decision') {
  if (typeof value !== 'string' || !includesExact(MEMORY_TYPES, value)) {
    fail(code, 'Memory type is not supported.')
  }
  return value
}

export function compareUnicodeScalarStrings(left, right) {
  validateUnicodeScalarString(left, 'bundle_invalid_atom', 'Left string')
  validateUnicodeScalarString(right, 'bundle_invalid_atom', 'Right string')

  let leftIndex = 0
  let rightIndex = 0
  while (leftIndex < left.length && rightIndex < right.length) {
    const leftValue = codePointAtScalar(left, leftIndex)
    const rightValue = codePointAtScalar(right, rightIndex)
    if (leftValue.codePoint < rightValue.codePoint) return -1
    if (leftValue.codePoint > rightValue.codePoint) return 1
    leftIndex += leftValue.width
    rightIndex += rightValue.width
  }
  if (leftIndex < left.length) return 1
  if (rightIndex < right.length) return -1
  return 0
}

export function computeMemoryBundleAtomChecksum(atom) {
  return computeCapturedAtomChecksum(captureCanonicalAtom(atom))
}

export function encodeAtomRow(atom) {
  const captured = captureCanonicalAtom(atom)
  return buildAtomRow(captured, computeCapturedAtomChecksum(captured))
}

export function decodeAtomRow(value) {
  const row = captureSqliteRow(
    value,
    ATOM_ROW_KEYS,
    'bundle_invalid_atom',
    'Persisted atom row shape is invalid.',
  )
  if (typeof row.keywords_json !== 'string') {
    fail('bundle_invalid_atom', 'Persisted keywords_json must be a string.')
  }

  let parsedKeywords
  try {
    parsedKeywords = reflectApply(jsonParse, undefined, [row.keywords_json])
  } catch (error) {
    throw memoryBundleFailure(
      'bundle_invalid_atom',
      'Persisted keywords_json is not valid JSON.',
      error,
    )
  }
  const keywords = captureKeywords(parsedKeywords)
  if (stringifyCanonicalJson(keywords) !== row.keywords_json) {
    fail('bundle_invalid_atom', 'Persisted keywords_json is not canonical.')
  }
  if (row.fictional !== 0 && row.fictional !== 1) {
    fail('bundle_invalid_atom', 'Persisted fictional must be integer 0 or 1.')
  }

  const atom = captureCanonicalAtom({
    memoryId: row.memory_id,
    streamId: row.stream_id,
    createdSequence: row.created_sequence,
    palariId: row.palari_id,
    userId: row.user_id,
    type: row.type,
    content: row.content,
    keywords,
    initialImportance: row.initial_importance,
    confidence: row.confidence,
    provenanceKind: row.provenance_kind,
    sourceMessageId: row.source_message_id,
    validFrom: row.valid_from,
    createdAt: row.created_at,
    fictional: row.fictional === 1,
  })
  if (
    typeof row.content_checksum !== 'string' ||
    !matchesPattern(CHECKSUM_PATTERN, row.content_checksum) ||
    computeCapturedAtomChecksum(atom) !== row.content_checksum
  ) {
    fail('bundle_invalid_atom', 'Persisted atom checksum is invalid.')
  }
  return buildDecodedAtom(atom, row.content_checksum)
}

export function decodeEventRow(value) {
  const row = captureSqliteRow(
    value,
    EVENT_ROW_KEYS,
    'bundle_invalid_decision',
    'Persisted event row shape is invalid.',
  )
  const event = buildDecodedEvent(row)

  validateSafeInteger(
    event.sequence,
    1,
    'bundle_invalid_decision',
    'Event sequence',
  )
  validatePrefixedUuidV4(event.streamId, 'str_', 'bundle_invalid_decision')
  validatePrefixedUuidV4(event.decisionId, 'dec_', 'bundle_invalid_decision')
  validatePrefixedUuidV4(event.proposalId, 'prp_', 'bundle_invalid_decision')
  validatePrimitiveToken(
    event.proposalKind,
    PROPOSAL_KINDS,
    'bundle_invalid_decision',
    'Proposal kind',
  )
  validatePrimitiveToken(
    event.operation,
    OPERATIONS,
    'bundle_invalid_decision',
    'Operation',
  )
  validatePrimitiveToken(
    event.outcome,
    OUTCOMES,
    'bundle_invalid_decision',
    'Outcome',
  )
  if (
    event.reasonCode !== null &&
    (typeof event.reasonCode !== 'string' ||
      !includesExact(REFUSAL_REASONS, event.reasonCode))
  ) {
    fail('bundle_invalid_decision', 'Reason code is invalid.')
  }
  validateIdentity(event.palariId, 'bundle_invalid_decision')
  validateIdentity(event.userId, 'bundle_invalid_decision')
  if (event.evidenceKind !== 'direct_user_message') {
    fail('bundle_invalid_decision', 'Evidence kind is invalid.')
  }
  if (event.memoryId !== null) {
    validatePrefixedUuidV4(event.memoryId, 'mem_', 'bundle_invalid_decision')
  }
  if (event.memoryType !== null) {
    validateMemoryType(event.memoryType, 'bundle_invalid_decision')
  }
  validateTimestamp(event.effectiveAt, 'bundle_invalid_decision')
  validateTimestamp(event.observedAt, 'bundle_invalid_decision')
  if (event.effectiveAt > event.observedAt) {
    fail('bundle_invalid_decision', 'effectiveAt must not exceed observedAt.')
  }

  const requiredAuthority = validateEventMatrix(event)
  validateEventAuthority(event, requiredAuthority)
  return event
}

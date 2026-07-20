import {
  captureApplyEnvelope,
  captureAtom,
  captureAuthority,
  captureDecision,
  captureInitializerOptions,
  captureKeywords,
  captureScope,
  encodeAtomRow,
  validateInputAtomScalars,
  validatePrefixedUuidV4,
  validateResolvedAuthority,
  validateResolvedDecisionWithoutAuthority,
  validateTimestamp,
} from './memory-bundle-codec.mjs'
import {
  MemoryBundleError,
  memoryBundleFailure,
  preserveMemoryBundleError,
} from './memory-bundle-errors.mjs'
import {
  captureDatabaseOpenState,
  constructNativeDate,
  execDatabase,
  generateRandomUuid,
  hasAsciiCaseInsensitivePrefix,
  invokeFunction,
  isNativeSqliteBusyOrLocked,
  nativeDateToISOString,
  prepareRowStatement,
  readDatabaseTransactionState,
  statementAll,
  statementRun,
} from './memory-bundle-runtime.mjs'
import {
  MEMORY_BUNDLE_OBJECTS,
  MEMORY_BUNDLE_SCHEMA_VERSION,
} from './memory-bundle-schema.mjs'
import {
  assertBorrowedBundleConnection,
  configureOwnedBundleConnection,
  rejectCanonicalTempTriggers,
  verifyMemoryBundleState,
} from './memory-bundle-verify.mjs'

const reflectApply = Reflect.apply
const reflectDefineProperty = Reflect.defineProperty
const reflectGetOwnPropertyDescriptor = Reflect.getOwnPropertyDescriptor
const objectHasOwnProperty = Object.prototype.hasOwnProperty
const mapGet = Map.prototype.get
const mapHas = Map.prototype.has
const setHas = Set.prototype.has
const numberMaxSafeInteger = Number.MAX_SAFE_INTEGER

const APPLICATION_OBJECT_PREFIX = 'memory_bundle_'

const INITIALIZER_STORAGE_MESSAGE =
  'Memory bundle initialization failed because storage could not be accessed.'
const INITIALIZER_BUSY_MESSAGE =
  'The memory bundle database is busy or locked.'
const INITIALIZER_ROLLBACK_MESSAGE =
  'Memory bundle initialization rollback failed.'
const APPLY_STORAGE_MESSAGE =
  'Memory bundle apply failed because storage could not be accessed.'
const APPLY_BUSY_MESSAGE = 'The memory bundle database is busy or locked.'

function defaultClock() {
  return constructNativeDate([])
}

function defaultIdFactory() {
  return generateRandomUuid()
}

function mapInitializerFailure(error) {
  const preserved = preserveMemoryBundleError(
    error,
    'bundle_storage_error',
    INITIALIZER_STORAGE_MESSAGE,
  )
  if (preserved === error) return preserved
  if (isNativeSqliteBusyOrLocked(error)) {
    return memoryBundleFailure(
      'bundle_busy',
      INITIALIZER_BUSY_MESSAGE,
      error,
    )
  }
  return preserved
}

function rollbackAndThrow(db, error) {
  const primary = mapInitializerFailure(error)
  try {
    if (readDatabaseTransactionState(db) === true) {
      execDatabase(db, 'ROLLBACK')
    }
  } catch (rollbackError) {
    throw memoryBundleFailure(
      'bundle_storage_error',
      INITIALIZER_ROLLBACK_MESSAGE,
      rollbackError,
    )
  }
  throw primary
}

function readApplicationObjectInventory(db) {
  const statement = prepareRowStatement(db, `
    SELECT type, name
    FROM main.sqlite_schema
  `)
  const rows = statementAll(statement, [])
  const candidates = []
  for (let index = 0; index < rows.length; index += 1) {
    if (!hasAsciiCaseInsensitivePrefix(
      rows[index].name,
      APPLICATION_OBJECT_PREFIX,
    )) {
      continue
    }
    reflectApply(reflectDefineProperty, undefined, [
      candidates,
      candidates.length,
      {
        __proto__: null,
        value: rows[index],
        enumerable: true,
        configurable: true,
        writable: true,
      },
    ])
  }
  return candidates
}

function invokeInitializerClock(clock) {
  let result
  try {
    result = invokeFunction(clock)
  } catch (error) {
    throw memoryBundleFailure(
      'bundle_invalid_argument',
      'The initializer clock callback failed.',
      error,
    )
  }

  let timestamp
  try {
    timestamp = nativeDateToISOString(result)
  } catch (error) {
    throw memoryBundleFailure(
      'bundle_invalid_argument',
      'The initializer clock must return a valid native Date.',
      error,
    )
  }
  return validateTimestamp(timestamp, 'bundle_invalid_argument')
}

function invokeInitializerIdFactory(idFactory) {
  let uuid
  try {
    uuid = invokeFunction(idFactory)
  } catch (error) {
    throw memoryBundleFailure(
      'bundle_invalid_argument',
      'The initializer idFactory callback failed.',
      error,
    )
  }
  if (typeof uuid !== 'string') {
    throw memoryBundleFailure(
      'bundle_invalid_argument',
      'The initializer idFactory must return an unprefixed UUIDv4 string.',
    )
  }
  const streamId = `str_${uuid}`
  validatePrefixedUuidV4(
    streamId,
    'str_',
    'bundle_invalid_argument',
  )
  return streamId
}

function createFreshMemoryBundle(db, clock, idFactory) {
  const createdAt = invokeInitializerClock(clock)
  const streamId = invokeInitializerIdFactory(idFactory)

  for (let index = 0; index < MEMORY_BUNDLE_OBJECTS.length; index += 1) {
    execDatabase(db, MEMORY_BUNDLE_OBJECTS[index].executionSql)
  }

  const insertMeta = prepareRowStatement(db, `
    INSERT INTO main.memory_bundle_meta (
      singleton, schema_version, stream_id, head_sequence, created_at
    ) VALUES (1, ?, ?, 0, ?)
  `)
  statementRun(insertMeta, [
    MEMORY_BUNDLE_SCHEMA_VERSION,
    streamId,
    createdAt,
  ])
}

function mapApplyFailure(error) {
  const preserved = preserveMemoryBundleError(
    error,
    'bundle_storage_error',
    APPLY_STORAGE_MESSAGE,
  )
  if (preserved === error) return preserved
  if (isNativeSqliteBusyOrLocked(error)) {
    return memoryBundleFailure('bundle_busy', APPLY_BUSY_MESSAGE, error)
  }
  return preserved
}

function validateProspectiveTransition(state, decision, scope) {
  if (
    state.lastObservedAt !== null &&
    decision.observedAt < state.lastObservedAt
  ) {
    throw memoryBundleFailure(
      'bundle_invalid_transition',
      'The prospective observed time decreases.',
    )
  }
  if (state.checkpoint.sequence === numberMaxSafeInteger) {
    throw memoryBundleFailure(
      'bundle_invalid_transition',
      'The memory bundle sequence cannot advance safely.',
    )
  }
  if (decision.outcome === 'refused') return

  if (decision.operation === 'create') {
    if (reflectApply(mapHas, state.retainedByMemoryId, [decision.memoryId])) {
      throw memoryBundleFailure(
        'bundle_id_reuse',
        'The prospective create reuses a retained memory id.',
      )
    }
    return
  }

  const retained = reflectApply(
    mapGet,
    state.retainedByMemoryId,
    [decision.memoryId],
  )
  if (retained === undefined) {
    throw memoryBundleFailure(
      'bundle_invalid_transition',
      'The prospective delete has no retained create.',
    )
  }
  if (
    retained.palariId !== scope.palariId ||
    retained.userId !== scope.userId
  ) {
    throw memoryBundleFailure(
      'bundle_unauthorized',
      'The prospective delete crosses retained scope.',
    )
  }
  if (retained.status === 'deleted') {
    throw memoryBundleFailure(
      'bundle_invalid_transition',
      'The prospective delete targets an already-deleted memory.',
    )
  }
}

function requireSingleMutation(result, message) {
  const descriptor = reflectApply(
    reflectGetOwnPropertyDescriptor,
    undefined,
    [result, 'changes'],
  )
  if (
    descriptor === undefined ||
    !reflectApply(objectHasOwnProperty, descriptor, ['value']) ||
    descriptor.value !== 1
  ) {
    throw memoryBundleFailure('bundle_storage_error', message)
  }
}

function insertResolvedEvent(db, staged) {
  const statement = prepareRowStatement(db, `
    INSERT INTO main.memory_bundle_events (
      sequence, stream_id, decision_id, proposal_id, proposal_kind,
      operation, outcome, reason_code, palari_id, user_id,
      authority_kind, authority_id, evidence_kind, memory_id, memory_type,
      effective_at, observed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const result = statementRun(statement, [
    staged.nextSequence,
    staged.state.checkpoint.streamId,
    staged.decision.decisionId,
    staged.decision.proposalId,
    staged.decision.proposalKind,
    staged.decision.operation,
    staged.decision.outcome,
    staged.decision.reasonCode,
    staged.scope.palariId,
    staged.scope.userId,
    staged.authority.kind,
    staged.authority.authorityId,
    staged.decision.evidenceKind,
    staged.decision.memoryId,
    staged.decision.memoryType,
    staged.decision.effectiveAt,
    staged.decision.observedAt,
  ])
  requireSingleMutation(result, 'The resolved event was not inserted exactly once.')
}

function insertResolvedAtom(db, row) {
  const statement = prepareRowStatement(db, `
    INSERT INTO main.memory_bundle_atoms (
      memory_id, stream_id, created_sequence, palari_id, user_id, type,
      content, keywords_json, initial_importance, confidence,
      provenance_kind, source_message_id, valid_from, created_at, fictional,
      content_checksum
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const result = statementRun(statement, [
    row.memory_id,
    row.stream_id,
    row.created_sequence,
    row.palari_id,
    row.user_id,
    row.type,
    row.content,
    row.keywords_json,
    row.initial_importance,
    row.confidence,
    row.provenance_kind,
    row.source_message_id,
    row.valid_from,
    row.created_at,
    row.fictional,
    row.content_checksum,
  ])
  requireSingleMutation(result, 'The resolved atom was not inserted exactly once.')
}

function deleteResolvedAtom(db, memoryId) {
  const statement = prepareRowStatement(db, `
    DELETE FROM main.memory_bundle_atoms
    WHERE memory_id = ?
  `)
  const result = statementRun(statement, [memoryId])
  requireSingleMutation(result, 'The resolved atom was not deleted exactly once.')
}

function advanceResolvedHead(db, staged) {
  const statement = prepareRowStatement(db, `
    UPDATE main.memory_bundle_meta
    SET head_sequence = ?
    WHERE singleton = 1
      AND stream_id = ?
      AND head_sequence = ?
  `)
  const result = statementRun(statement, [
    staged.nextSequence,
    staged.state.checkpoint.streamId,
    staged.state.checkpoint.sequence,
  ])
  requireSingleMutation(result, 'The memory bundle head was not advanced exactly once.')
}

function applyStagedMutation(db, staged) {
  insertResolvedEvent(db, staged)
  if (staged.atomRow !== null) {
    insertResolvedAtom(db, staged.atomRow)
  } else if (
    staged.decision.operation === 'delete' &&
    staged.decision.outcome === 'applied'
  ) {
    deleteResolvedAtom(db, staged.decision.memoryId)
  }
  advanceResolvedHead(db, staged)
}

function stageResolvedApply(db, input) {
  const isOpen = captureDatabaseOpenState(db)
  if (isOpen !== true) {
    throw memoryBundleFailure(
      'bundle_connection_invalid',
      'The DatabaseSync connection must be open.',
    )
  }
  if (readDatabaseTransactionState(db) !== true) {
    throw memoryBundleFailure(
      'bundle_not_in_transaction',
      'Apply requires an active caller-owned transaction.',
    )
  }

  assertBorrowedBundleConnection(db)
  rejectCanonicalTempTriggers(db)
  const state = verifyMemoryBundleState(db)
  const envelope = captureApplyEnvelope(input)
  if (
    envelope.expectedHead.streamId !== state.checkpoint.streamId ||
    envelope.expectedHead.sequence !== state.checkpoint.sequence
  ) {
    throw memoryBundleFailure(
      'bundle_head_conflict',
      'The expected bundle head does not match the verified head.',
    )
  }

  const decision = captureDecision(envelope.decision)
  const scope = captureScope(decision.scope)
  const authority = captureAuthority(decision.authority)
  const atom = captureAtom(envelope.atom)
  const requiredAuthority = validateResolvedDecisionWithoutAuthority(
    decision,
    scope,
    atom,
  )

  if (reflectApply(setHas, state.seenDecisionIds, [decision.decisionId])) {
    throw memoryBundleFailure(
      'bundle_duplicate_decision_id',
      'The decision id is already retained.',
    )
  }
  if (reflectApply(setHas, state.seenProposalIds, [decision.proposalId])) {
    throw memoryBundleFailure(
      'bundle_duplicate_proposal_id',
      'The proposal id is already retained.',
    )
  }

  validateResolvedAuthority(
    authority,
    requiredAuthority,
    scope.userId,
  )
  let keywords = null
  let canonicalAtom = null
  if (atom !== null) {
    validateInputAtomScalars(atom)
    keywords = captureKeywords(atom.keywords)
    canonicalAtom = {
      memoryId: decision.memoryId,
      streamId: state.checkpoint.streamId,
      createdSequence: state.checkpoint.sequence + 1,
      palariId: scope.palariId,
      userId: scope.userId,
      type: decision.memoryType,
      content: atom.content,
      keywords,
      initialImportance: atom.initialImportance,
      confidence: atom.confidence,
      provenanceKind: atom.provenanceKind,
      sourceMessageId: atom.sourceMessageId,
      validFrom: decision.effectiveAt,
      createdAt: decision.observedAt,
      fictional: atom.fictional,
    }
  }
  validateProspectiveTransition(state, decision, scope)
  const nextSequence = state.checkpoint.sequence + 1
  const atomRow = canonicalAtom === null ? null : encodeAtomRow(canonicalAtom)
  return {
    state,
    decision,
    scope,
    authority,
    nextSequence,
    atomRow,
  }
}

export { MemoryBundleError }

export function initializeMemoryBundle(db, options = {}) {
  const isOpen = captureDatabaseOpenState(db)
  const capturedOptions = captureInitializerOptions(options)
  const clock = reflectApply(objectHasOwnProperty, capturedOptions, ['clock'])
    ? capturedOptions.clock
    : defaultClock
  const idFactory = reflectApply(
    objectHasOwnProperty,
    capturedOptions,
    ['idFactory'],
  )
    ? capturedOptions.idFactory
    : defaultIdFactory

  if (isOpen !== true) {
    throw memoryBundleFailure(
      'bundle_connection_invalid',
      'The DatabaseSync connection must be open.',
    )
  }
  if (readDatabaseTransactionState(db) === true) {
    throw memoryBundleFailure(
      'bundle_connection_invalid',
      'Initialization requires a connection outside a transaction.',
    )
  }

  try {
    configureOwnedBundleConnection(db)
    rejectCanonicalTempTriggers(db)
  } catch (error) {
    throw mapInitializerFailure(error)
  }

  try {
    execDatabase(db, 'BEGIN')
    const inventory = readApplicationObjectInventory(db)
    if (inventory.length !== 0) {
      verifyMemoryBundleState(db)
      execDatabase(db, 'COMMIT')
      return undefined
    }
    execDatabase(db, 'COMMIT')
  } catch (error) {
    rollbackAndThrow(db, error)
  }

  try {
    execDatabase(db, 'BEGIN IMMEDIATE')
    const inventory = readApplicationObjectInventory(db)
    if (inventory.length === 0) {
      createFreshMemoryBundle(db, clock, idFactory)
    }
    verifyMemoryBundleState(db)
    execDatabase(db, 'COMMIT')
    return undefined
  } catch (error) {
    rollbackAndThrow(db, error)
  }
}

export function applyResolvedDecisionInTransaction(db, input) {
  try {
    const staged = stageResolvedApply(db, input)
    applyStagedMutation(db, staged)
    return undefined
  } catch (error) {
    throw mapApplyFailure(error)
  }
}

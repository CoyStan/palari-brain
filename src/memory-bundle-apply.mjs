import {
  captureApplyEnvelope,
  captureAtom,
  captureAuthority,
  captureDecision,
  captureInitializerOptions,
  captureKeywords,
  captureScope,
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
  if (atom !== null) {
    validateInputAtomScalars(atom)
    keywords = captureKeywords(atom.keywords)
  }
  validateProspectiveTransition(state, decision, scope)
  return { state, decision, scope, authority, atom, keywords }
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
    stageResolvedApply(db, input)
    return undefined
  } catch (error) {
    throw mapApplyFailure(error)
  }
}

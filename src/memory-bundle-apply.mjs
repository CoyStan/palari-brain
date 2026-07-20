import {
  captureInitializerOptions,
  validatePrefixedUuidV4,
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
  configureOwnedBundleConnection,
  rejectCanonicalTempTriggers,
  verifyMemoryBundleState,
} from './memory-bundle-verify.mjs'

const reflectApply = Reflect.apply
const reflectDefineProperty = Reflect.defineProperty
const objectHasOwnProperty = Object.prototype.hasOwnProperty

const APPLICATION_OBJECT_PREFIX = 'memory_bundle_'

const INITIALIZER_STORAGE_MESSAGE =
  'Memory bundle initialization failed because storage could not be accessed.'
const INITIALIZER_BUSY_MESSAGE =
  'The memory bundle database is busy or locked.'
const INITIALIZER_ROLLBACK_MESSAGE =
  'Memory bundle initialization rollback failed.'

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

export function applyResolvedDecisionInTransaction() {
  throw new MemoryBundleError('bundle_invalid_argument', 'A DatabaseSync connection is required.')
}

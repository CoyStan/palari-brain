import { captureOpenOptions } from './memory-bundle-codec.mjs'
import {
  memoryBundleFailure,
  preserveMemoryBundleError,
} from './memory-bundle-errors.mjs'
import {
  closeDatabase,
  constructDatabase,
  convertPathToReadWriteFileHref,
  execDatabase,
  isNativeSqliteBusyOrLocked,
  prepareRowStatement,
  readDatabaseTransactionState,
  statementGet,
} from './memory-bundle-runtime.mjs'
import { MEMORY_BUNDLE_CAPABILITIES } from './memory-bundle-schema.mjs'
import {
  configureOwnedBundleConnection,
  verifyMemoryBundleState,
} from './memory-bundle-verify.mjs'

const objectFreeze = Object.freeze

function mapOwnedFailure(error, message) {
  const preserved = preserveMemoryBundleError(
    error,
    'bundle_storage_error',
    message,
  )
  if (preserved === error) return preserved
  if (isNativeSqliteBusyOrLocked(error)) {
    return memoryBundleFailure(
      'bundle_busy',
      'The memory bundle database is busy or locked.',
      error,
    )
  }
  return preserved
}

function mapCleanupFailure(error, message) {
  return memoryBundleFailure('bundle_storage_error', message, error)
}

function rollbackAfterFailure(db) {
  try {
    if (readDatabaseTransactionState(db) === true) {
      execDatabase(db, 'ROLLBACK')
    }
    return undefined
  } catch (error) {
    return mapCleanupFailure(
      error,
      'The memory bundle read transaction could not be rolled back.',
    )
  }
}

function closeAfterFailure(db) {
  try {
    closeDatabase(db)
    return undefined
  } catch (error) {
    return mapCleanupFailure(
      error,
      'The memory bundle database connection could not be closed.',
    )
  }
}

function throwOpenFailure(db, error, message) {
  const primary = mapOwnedFailure(error, message)
  const rollbackFailure = rollbackAfterFailure(db)
  const closeFailure = closeAfterFailure(db)
  throw rollbackFailure ?? closeFailure ?? primary
}

function runVerifiedReadTransaction(db, projector) {
  execDatabase(db, 'BEGIN')
  const verified = verifyMemoryBundleState(db)
  execDatabase(db, 'COMMIT')
  return projector(verified)
}

function recoverExistingDatabase(dbPath) {
  const recoveryHref = convertPathToReadWriteFileHref(dbPath)
  const db = constructDatabase([
    recoveryHref,
    { readOnly: false, timeout: 0 },
  ])

  try {
    configureOwnedBundleConnection(db)
    execDatabase(db, 'BEGIN')
    const statement = prepareRowStatement(
      db,
      'SELECT 1 FROM main.sqlite_schema LIMIT 1',
    )
    statementGet(statement, [])
    execDatabase(db, 'COMMIT')
  } catch (error) {
    throwOpenFailure(
      db,
      error,
      'The memory bundle recovery connection failed.',
    )
  }

  try {
    closeDatabase(db)
  } catch (error) {
    throw mapCleanupFailure(
      error,
      'The memory bundle recovery connection could not be closed.',
    )
  }
}

function makeCheckpoint(verified) {
  return {
    streamId: verified.checkpoint.streamId,
    sequence: verified.checkpoint.sequence,
  }
}

function makeVerification(verified) {
  return {
    checkpoint: makeCheckpoint(verified),
    capabilities: MEMORY_BUNDLE_CAPABILITIES,
  }
}

function makeReplay(verified) {
  return {
    checkpoint: makeCheckpoint(verified),
    memories: verified.memories,
    capabilities: MEMORY_BUNDLE_CAPABILITIES,
  }
}

function openVerifiedHandle(dbPath) {
  const db = constructDatabase([
    dbPath,
    { readOnly: true, timeout: 0 },
  ])

  try {
    configureOwnedBundleConnection(db)
    runVerifiedReadTransaction(db, () => undefined)
  } catch (error) {
    throwOpenFailure(
      db,
      error,
      'The memory bundle read-only connection could not be opened.',
    )
  }

  let state = 'open'
  let poisonCloseFailed = false

  function throwClosed() {
    throw memoryBundleFailure(
      'bundle_closed',
      'The memory bundle handle is closed.',
    )
  }

  function runHandleRead(projector) {
    if (state !== 'open') throwClosed()
    try {
      return runVerifiedReadTransaction(db, projector)
    } catch (error) {
      const primary = mapOwnedFailure(
        error,
        'The memory bundle read failed.',
      )
      const rollbackFailure = rollbackAfterFailure(db)
      if (rollbackFailure === undefined) throw primary

      state = 'poisoned'
      const poisonCloseFailure = closeAfterFailure(db)
      poisonCloseFailed = poisonCloseFailure !== undefined
      throw rollbackFailure
    }
  }

  function verify() {
    return runHandleRead(makeVerification)
  }

  function replay() {
    return runHandleRead(makeReplay)
  }

  function close() {
    if (state === 'closed') return undefined
    if (state === 'poisoned' && poisonCloseFailed === false) {
      state = 'closed'
      return undefined
    }

    try {
      closeDatabase(db)
    } catch (error) {
      throw mapCleanupFailure(
        error,
        'The memory bundle database connection could not be closed.',
      )
    }
    state = 'closed'
    poisonCloseFailed = false
    return undefined
  }

  return objectFreeze({
    verify,
    replay,
    capabilities: MEMORY_BUNDLE_CAPABILITIES,
    close,
  })
}

export function openMemoryBundle(options) {
  const { dbPath } = captureOpenOptions(options)
  try {
    recoverExistingDatabase(dbPath)
  } catch (error) {
    throw mapOwnedFailure(
      error,
      'The memory bundle recovery connection could not be opened.',
    )
  }

  try {
    return openVerifiedHandle(dbPath)
  } catch (error) {
    throw mapOwnedFailure(
      error,
      'The memory bundle read-only connection could not be opened.',
    )
  }
}

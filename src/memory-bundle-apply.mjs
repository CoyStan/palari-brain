import {
  MemoryBundleError,
  memoryBundleFailure,
} from './memory-bundle-errors.mjs'
import {
  assertOpenDatabaseSync,
  readDatabaseTransactionState,
} from './memory-bundle-runtime.mjs'

export { MemoryBundleError }

export function initializeMemoryBundle(db) {
  assertOpenDatabaseSync(db)
  if (readDatabaseTransactionState(db) === true) {
    throw memoryBundleFailure(
      'bundle_connection_invalid',
      'Initialization requires a connection outside a transaction.',
    )
  }
  throw memoryBundleFailure(
    'bundle_layout_invalid',
    'Memory bundle schema initialization is not implemented yet.',
  )
}

export function applyResolvedDecisionInTransaction() {
  throw new MemoryBundleError('bundle_invalid_argument', 'A DatabaseSync connection is required.')
}

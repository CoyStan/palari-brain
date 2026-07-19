import { MemoryBundleError } from './memory-bundle-errors.mjs'

export { MemoryBundleError }

export function initializeMemoryBundle() {
  throw new MemoryBundleError('bundle_invalid_argument', 'A DatabaseSync connection is required.')
}

export function applyResolvedDecisionInTransaction() {
  throw new MemoryBundleError('bundle_invalid_argument', 'A DatabaseSync connection is required.')
}

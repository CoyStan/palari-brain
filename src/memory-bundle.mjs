import { MemoryBundleError } from './memory-bundle-errors.mjs'

export function openMemoryBundle() {
  throw new MemoryBundleError('bundle_invalid_argument', 'An exact dbPath options object is required.')
}

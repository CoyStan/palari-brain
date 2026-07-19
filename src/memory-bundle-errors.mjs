export const BUNDLE_ERROR_CODES = Object.freeze([
  'bundle_invalid_argument',
  'bundle_busy',
  'bundle_layout_invalid',
  'bundle_schema_unsupported',
  'bundle_connection_invalid',
  'bundle_not_in_transaction',
  'bundle_invalid_decision',
  'bundle_duplicate_decision_id',
  'bundle_duplicate_proposal_id',
  'bundle_invalid_atom',
  'bundle_invalid_transition',
  'bundle_head_conflict',
  'bundle_meta_mismatch',
  'bundle_missing_atom',
  'bundle_orphan_atom',
  'bundle_id_reuse',
  'bundle_unauthorized',
  'bundle_storage_error',
  'bundle_closed',
])

const BUNDLE_ERROR_CODE_SET = new Set(BUNDLE_ERROR_CODES)
const MEMORY_BUNDLE_ERROR_INSTANCES = new WeakSet()
const reflectApply = Reflect.apply
const weakSetAdd = WeakSet.prototype.add
const weakSetHas = WeakSet.prototype.has

export class MemoryBundleError extends Error {
  constructor(code, message, options = {}) {
    if (!BUNDLE_ERROR_CODE_SET.has(code)) {
      throw new TypeError(`Unknown memory bundle error code: ${String(code)}`)
    }
    super(message, options.cause === undefined ? undefined : { cause: options.cause })
    reflectApply(weakSetAdd, MEMORY_BUNDLE_ERROR_INSTANCES, [this])
    Object.defineProperty(this, 'name', {
      value: 'MemoryBundleError',
      enumerable: false,
      configurable: true,
      writable: true,
    })
    Object.defineProperty(this, 'code', {
      value: code,
      enumerable: true,
      configurable: false,
      writable: false,
    })
  }
}

export function memoryBundleFailure(code, message, cause) {
  return new MemoryBundleError(code, message, cause === undefined ? {} : { cause })
}

export function preserveMemoryBundleError(error, code, message) {
  if (reflectApply(weakSetHas, MEMORY_BUNDLE_ERROR_INSTANCES, [error])) {
    return error
  }
  return memoryBundleFailure(code, message, error)
}

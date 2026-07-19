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
const reflectConstruct = Reflect.construct
const reflectGetOwnPropertyDescriptor = Reflect.getOwnPropertyDescriptor
const objectDefineProperty = Object.defineProperty
const objectHasOwnProperty = Object.prototype.hasOwnProperty
const setHas = Set.prototype.has
const weakSetAdd = WeakSet.prototype.add
const weakSetHas = WeakSet.prototype.has
const nativeString = String
const nativeTypeError = TypeError

function readOwnDataCause(options) {
  if (
    options === null ||
    (typeof options !== 'object' && typeof options !== 'function')
  ) {
    return undefined
  }

  const descriptor = reflectApply(
    reflectGetOwnPropertyDescriptor,
    undefined,
    [options, 'cause'],
  )
  if (
    descriptor === undefined ||
    !reflectApply(objectHasOwnProperty, descriptor, ['value'])
  ) {
    return undefined
  }
  return descriptor.value
}

export class MemoryBundleError extends Error {
  constructor(code, message, options = {}) {
    if (!reflectApply(setHas, BUNDLE_ERROR_CODE_SET, [code])) {
      const renderedCode = reflectApply(nativeString, undefined, [code])
      throw reflectConstruct(nativeTypeError, [
        `Unknown memory bundle error code: ${renderedCode}`,
      ])
    }
    const cause = readOwnDataCause(options)
    super(message, cause === undefined ? undefined : { cause })
    reflectApply(objectDefineProperty, undefined, [this, 'name', {
      value: 'MemoryBundleError',
      enumerable: false,
      configurable: true,
      writable: true,
    }])
    reflectApply(objectDefineProperty, undefined, [this, 'code', {
      value: code,
      enumerable: true,
      configurable: false,
      writable: false,
    }])
    reflectApply(weakSetAdd, MEMORY_BUNDLE_ERROR_INSTANCES, [this])
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

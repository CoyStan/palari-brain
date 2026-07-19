import { types as utilTypes } from 'node:util'

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
const isProxy = utilTypes.isProxy
const nativeString = String
const nativeTypeError = TypeError
const INVALID_CODE_NON_PRIMITIVE_RENDERING = '<non-primitive>'
const INVALID_MESSAGE_DIAGNOSTIC =
  'Memory bundle error message must be a non-empty string.'

function throwNativeTypeError(message) {
  throw reflectConstruct(nativeTypeError, [message])
}

function renderInvalidCode(code) {
  if (
    typeof code === 'function' ||
    (typeof code === 'object' && code !== null)
  ) {
    return INVALID_CODE_NON_PRIMITIVE_RENDERING
  }
  return reflectApply(nativeString, undefined, [code])
}

function readOwnDataCause(options) {
  if (reflectApply(isProxy, undefined, [options])) return undefined
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
      throwNativeTypeError(
        `Unknown memory bundle error code: ${renderInvalidCode(code)}`,
      )
    }
    if (typeof message !== 'string' || message === '') {
      throwNativeTypeError(INVALID_MESSAGE_DIAGNOSTIC)
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

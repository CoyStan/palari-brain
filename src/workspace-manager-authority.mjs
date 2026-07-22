// V2-M2-B manager-only authority-provider capture boundary.
//
// The public store/manager module must not import or name the authority
// runtime. This narrow internal adapter performs the one construction-time
// provider check required by docs/MEMORY-AUTHORITY-CONTRACT.md and returns
// only the already-supplied provider (or undefined), never a root or grant.

import { types as utilTypes } from 'node:util'

import { MemoryAuthorityError } from './memory-authority-runtime.mjs'

const reflectApply = Reflect.apply
const reflectConstruct = Reflect.construct
const reflectGetOwnPropertyDescriptor = Reflect.getOwnPropertyDescriptor
const objectHasOwn = Object.hasOwn
const isProxy = utilTypes.isProxy

function authorityInvalidArgument() {
  return reflectConstruct(MemoryAuthorityError, [
    'authority_invalid_argument',
    'A valid memory authority argument is required.',
  ])
}

export function captureWorkspaceAuthorityProvider(options) {
  const descriptor = reflectApply(
    reflectGetOwnPropertyDescriptor,
    undefined,
    [options, 'authorityRootForWorkspace'],
  )
  if (descriptor === undefined) return undefined
  if (!reflectApply(objectHasOwn, undefined, [descriptor, 'value'])) {
    throw authorityInvalidArgument()
  }
  const provider = descriptor.value
  if (provider === undefined) return undefined
  if (
    typeof provider !== 'function' ||
    reflectApply(isProxy, undefined, [provider])
  ) throw authorityInvalidArgument()
  return provider
}

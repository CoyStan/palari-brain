// Supported CDX-M1 store boundary — V2-M2-A2.
//
// The native connection, bootstrap owner, coordinator, router, lease, plans,
// and semantic DML remain private to kernel-store-runtime/router. This module
// publishes only the safe base factory, gated workspace manager, compatibility
// value sets/helpers, and serialized terminal file-deletion door.

import { dirname, resolve } from 'node:path'
import { types as utilTypes } from 'node:util'

import {
  createAdmissionPolicy,
  createGatedStore,
} from './gate.mjs'
import {
  acquisitionModes,
  createKernelStoreRuntime,
  deleteKernelStoreRuntimeFile,
  externalMemorySourceKinds,
  extractMemoryQueryKeywords,
  memoryAddWriters,
  memoryFtsTokenizer,
  memoryMutationActors,
  memoryStoreSchemaVersion,
  memoryTypes,
  permanentMemoryTypes,
  probeMemorySqliteDriver,
  transientMemoryTypes,
  workspaceMemoryDbPath,
} from './kernel-store-runtime.mjs'
import { LegacyMutationError } from './legacy-mutation-router.mjs'

const reflectApply = Reflect.apply
const reflectConstruct = Reflect.construct
const arrayPush = Array.prototype.push
const arraySort = Array.prototype.sort
const mapClear = Map.prototype.clear
const mapDelete = Map.prototype.delete
const mapForEach = Map.prototype.forEach
const mapGet = Map.prototype.get
const mapSet = Map.prototype.set
const objectFreeze = Object.freeze
const regexpTest = RegExp.prototype.test
const stringReplace = String.prototype.replace
const stringSlice = String.prototype.slice
const stringToLowerCase = String.prototype.toLowerCase
const stringTrim = String.prototype.trim
const symbolIterator = Symbol.iterator
const isProxy = utilTypes.isProxy
const nativeAggregateError = AggregateError
const nativeBoolean = Boolean
const nativeMap = Map
const nativeString = String
const pathDirname = dirname
const pathResolve = resolve

function aggregateErrors(values) {
  let index = 0
  const iterator = {
    next() {
      if (index >= values.length) return { done: true, value: undefined }
      const value = values[index]
      index += 1
      return { done: false, value }
    },
  }
  const iterable = {
    [symbolIterator]() {
      return iterator
    },
  }
  return reflectConstruct(nativeAggregateError, [iterable])
}

function normalizeWorkspaceId(value) {
  let normalized = reflectApply(nativeString, undefined, [value ?? ''])
  normalized = reflectApply(stringTrim, normalized, [])
  normalized = reflectApply(stringToLowerCase, normalized, [])
  normalized = reflectApply(stringReplace, normalized, [/[^a-z0-9]+/g, '-'])
  normalized = reflectApply(stringReplace, normalized, [/^-|-$/g, ''])
  normalized = reflectApply(stringSlice, normalized, [0, 48])
  return normalized || 'workspace'
}

function booleanEnvironmentValue(value) {
  let normalized = reflectApply(nativeString, undefined, [value ?? ''])
  normalized = reflectApply(stringTrim, normalized, [])
  return reflectApply(regexpTest, /^(1|true|yes)$/i, [normalized])
}

function managerClosedFailure() {
  return reflectConstruct(LegacyMutationError, [
    'legacy_manager_closed',
    'The workspace memory manager is closed.',
  ])
}

function captureManagerOptions(options) {
  const source = options ?? {}
  if (
    source === null ||
    typeof source !== 'object' ||
    reflectApply(isProxy, undefined, [source])
  ) {
    throw reflectConstruct(LegacyMutationError, [
      'legacy_invalid_argument',
      'A valid legacy mutation argument is required.',
    ])
  }
  const clock = source.clock
  const env = source.env
  const memoryEnabled = source.memoryEnabled
  const rawMemoryRootDir = source.memoryRootDir
  const policy = createAdmissionPolicy(source.policy)
  const publicDemo = source.publicDemo
  const rawStatePath = source.statePath
  return objectFreeze({
    clock,
    env,
    memoryEnabled,
    memoryRootDir: rawMemoryRootDir,
    policy,
    publicDemo,
    statePath: rawStatePath,
  })
}

function captureManagerPath(options, enabled) {
  if (!enabled) {
    return objectFreeze({ memoryRootDir: null, statePath: null })
  }
  const memoryRootDir = options.memoryRootDir
  const statePath = options.statePath
  if (!memoryRootDir && !statePath) {
    return objectFreeze({ memoryRootDir, statePath })
  }
  // Ask the established path helper to select its primary-root or lazy
  // state-path fallback exactly once, then retain only the resulting root.
  // A truthy root whose string form is empty still wins and therefore maps to
  // the current directory; an unused statePath is never coerced.
  const probePath = workspaceMemoryDbPath({
    memoryRootDir,
    statePath,
    workspaceId: 'manager-path-probe',
  })
  return objectFreeze({
    memoryRootDir: reflectApply(pathResolve, undefined, [
      reflectApply(pathDirname, undefined, [probePath]),
    ]),
    statePath: null,
  })
}

function managerConfig(options) {
  const env = options.env ?? process.env
  const requested = options.memoryEnabled === undefined
    ? booleanEnvironmentValue(env.PALARI_MEMORY)
    : reflectApply(nativeBoolean, undefined, [options.memoryEnabled])
  const publicDemo = reflectApply(nativeBoolean, undefined, [options.publicDemo])
  return objectFreeze({
    disabledReason: publicDemo
      ? 'public_demo_hard_off'
      : requested
        ? ''
        : 'flag_off',
    enabled: requested && !publicDemo,
    publicDemo,
    requested,
  })
}

function compareBinary(left, right) {
  if (left.workspaceId < right.workspaceId) return -1
  if (left.workspaceId > right.workspaceId) return 1
  return 0
}

export async function createKernelStore(options = {}) {
  return createKernelStoreRuntime(options)
}

export const deleteKernelStoreFile = deleteKernelStoreRuntimeFile

export function createWorkspaceMemoryManager(options = {}) {
  const captured = captureManagerOptions(options)
  const config = managerConfig(captured)
  const capturedPath = captureManagerPath(captured, config.enabled)
  const probe = config.enabled ? probeMemorySqliteDriver() : null
  const entries = new nativeMap()
  const state = {
    closePromise: null,
    phase: 'open',
  }

  function publicStatus() {
    if (!config.enabled) {
      return {
        db: 'not_created',
        enabled: false,
        reason: config.disabledReason,
        requested: config.requested,
        status: state.phase === 'open' ? 'disabled' : 'closed',
      }
    }
    return {
      db: 'per_workspace_sqlite',
      driver: probe.driver,
      enabled: true,
      fts5: probe.fts5 ? 'available' : 'unavailable',
      status: state.phase === 'open'
        ? probe.fts5 && probe.bilingualRoundTrip
          ? 'ready'
          : 'blocked'
        : 'closed',
      tokenizer: memoryFtsTokenizer,
    }
  }

  function beginCreation(workspaceId) {
    const entry = {
      failureKind: null,
      flight: null,
      handle: null,
      workspaceId,
    }
    reflectApply(mapSet, entries, [workspaceId, entry])

    const flight = (async () => {
      let base
      try {
        // Publish the flight before native creation begins. Manager path and
        // policy inputs were already detached at construction.
        await undefined
        base = await createKernelStoreRuntime({
          clock: captured.clock,
          env: captured.env,
          memoryEnabled: config.enabled,
          memoryRootDir: capturedPath.memoryRootDir,
          publicDemo: false,
          statePath: capturedPath.statePath,
          workspaceId,
        })
        const gated = createGatedStore(base, { policy: captured.policy })
        if (state.phase === 'open') {
          entry.handle = gated
          entry.flight = null
          return gated
        }

        try {
          gated.close()
        } catch (error) {
          entry.failureKind = 'late_close_failure'
          throw error
        }
        entry.failureKind = 'manager_closed'
        throw managerClosedFailure()
      } catch (error) {
        if (entry.handle === null && entry.failureKind === null) {
          entry.failureKind = 'creation_failure'
          if (base !== undefined) {
            try {
              base.close()
            } catch (closeError) {
              entry.failureKind = 'late_close_failure'
              throw closeError
            }
          }
        }
        if (state.phase === 'open') {
          const current = reflectApply(mapGet, entries, [workspaceId])
          if (current === entry) reflectApply(mapDelete, entries, [workspaceId])
        }
        throw error
      }
    })()
    entry.flight = flight
    return flight
  }

  async function forWorkspace(workspaceIdValue) {
    if (state.phase !== 'open') throw managerClosedFailure()
    const workspaceId = normalizeWorkspaceId(workspaceIdValue)
    if (state.phase !== 'open') throw managerClosedFailure()
    const existing = reflectApply(mapGet, entries, [workspaceId])
    if (existing !== undefined) {
      if (
        existing.handle !== null &&
        existing.handle.status().status !== 'closed'
      ) return existing.handle
      if (existing.flight !== null) return existing.flight
      reflectApply(mapDelete, entries, [workspaceId])
    }
    return beginCreation(workspaceId)
  }

  function close() {
    if (state.closePromise !== null) return state.closePromise
    state.phase = 'closing'
    state.closePromise = (async () => {
      const ordered = []
      reflectApply(mapForEach, entries, [(entry) => {
        reflectApply(arrayPush, ordered, [entry])
      }])
      reflectApply(arraySort, ordered, [compareBinary])
      const failures = []
      for (let index = 0; index < ordered.length; index += 1) {
        const entry = ordered[index]
        if (entry.handle !== null) {
          try {
            entry.handle.close()
          } catch (error) {
            reflectApply(arrayPush, failures, [error])
          }
          continue
        }
        if (entry.flight !== null) {
          try {
            await entry.flight
          } catch (error) {
            if (entry.failureKind === 'late_close_failure') {
              reflectApply(arrayPush, failures, [error])
            }
          }
        }
      }
      reflectApply(mapClear, entries, [])
      state.phase = 'closed'
      if (failures.length === 1) throw failures[0]
      if (failures.length > 1) {
        throw aggregateErrors(failures)
      }
    })()
    return state.closePromise
  }

  return objectFreeze({
    close,
    config,
    forWorkspace,
    publicStatus,
  })
}

export {
  acquisitionModes,
  externalMemorySourceKinds,
  extractMemoryQueryKeywords,
  memoryAddWriters,
  memoryFtsTokenizer,
  memoryMutationActors,
  memoryStoreSchemaVersion,
  memoryTypes,
  permanentMemoryTypes,
  probeMemorySqliteDriver,
  transientMemoryTypes,
  workspaceMemoryDbPath,
}

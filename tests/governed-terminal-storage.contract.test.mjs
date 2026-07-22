// V2-M2-B Task 6 — unconditional terminal-storage refusal.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire, syncBuiltinESMExports } from 'node:module'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { LegacyMutationError } from '../src/legacy-mutation-router.mjs'

const require = createRequire(import.meta.url)
const runtimePath = fileURLToPath(new URL(
  '../src/kernel-store-runtime.mjs',
  import.meta.url,
))
const routerPath = fileURLToPath(new URL(
  '../src/legacy-mutation-router.mjs',
  import.meta.url,
))
const storePath = fileURLToPath(new URL('../src/store.mjs', import.meta.url))

const EXPECTED_LEGACY_ERROR_PAIRS = Object.freeze([
  ['legacy_invalid_argument', 'A valid legacy mutation argument is required.'],
  ['legacy_invalid_capability', 'A supported branded memory capability is required.'],
  ['legacy_store_closed', 'The memory store is closed.'],
  ['legacy_manager_closed', 'The workspace memory manager is closed.'],
  ['legacy_plan_invalid', 'A router-issued legacy mutation plan is required.'],
  ['legacy_plan_stale', 'The legacy mutation plan is stale for this transaction.'],
  ['legacy_plan_applied', 'The legacy mutation plan has already been consumed.'],
  ['legacy_effect_invalid', 'A valid legacy mutation effect is required.'],
  ['legacy_effect_cardinality', 'A legacy mutation effect changed an unexpected number of rows.'],
  ['legacy_schema_invalid', 'The CDX-M1 runtime schema does not match the required manifest.'],
  ['legacy_store_open', 'The memory database has a supported live or blocked connection.'],
  ['legacy_path_invalid', 'A valid memory database path is required.'],
  [
    'legacy_terminal_storage_refused',
    'Terminal deletion of a governed memory store is refused.',
  ],
])

const TERMINAL_CODE = EXPECTED_LEGACY_ERROR_PAIRS[12][0]
const TERMINAL_MESSAGE = EXPECTED_LEGACY_ERROR_PAIRS[12][1]

function replaceFunctions(target, names, calls, category) {
  const originals = new Map()
  for (const name of names) {
    originals.set(name, target[name])
    target[name] = function instrumentedTerminalDependency(...args) {
      calls.push({ args, category, name })
      throw new Error(`${category}.${name} must remain unreachable`)
    }
  }
  return () => {
    for (const [name, value] of originals) target[name] = value
  }
}

function assertTerminalReason(error, LegacyMutationError) {
  assert.ok(error instanceof Error)
  assert.ok(error instanceof LegacyMutationError)
  assert.equal(error.name, 'LegacyMutationError')
  assert.equal(error.code, TERMINAL_CODE)
  assert.equal(error.message, TERMINAL_MESSAGE)
  assert.equal(Object.hasOwn(error, 'cause'), false)
  assert.deepEqual(Object.keys(error), ['code'])
  assert.deepEqual(Object.getOwnPropertyDescriptor(error, 'code'), {
    value: TERMINAL_CODE,
    writable: false,
    enumerable: true,
    configurable: false,
  })
}

test('M2-B-06 terminal refusal is immediate, zero-observation, and one exact public alias', async () => {
  const fsPromises = require('node:fs/promises')
  const filesystemCalls = []
  const restoreFs = replaceFunctions(
    fsPromises,
    ['lstat', 'mkdir', 'realpath', 'rm'],
    filesystemCalls,
    'fs',
  )
  syncBuiltinESMExports()

  let runtime
  let store
  try {
    runtime = await import('../src/kernel-store-runtime.mjs')
    store = await import('../src/store.mjs')
  } finally {
    restoreFs()
    syncBuiltinESMExports()
  }

  filesystemCalls.length = 0
  assert.equal(
    store.deleteKernelStoreFile,
    runtime.deleteKernelStoreRuntimeFile,
    'the public terminal export must remain the direct runtime alias',
  )

  let optionObservations = 0
  const hostileRecord = {}
  for (const key of [
    'memoryEnabled',
    'memoryRootDir',
    'statePath',
    'workspaceId',
  ]) {
    Object.defineProperty(hostileRecord, key, {
      get() {
        optionObservations += 1
        throw new Error(`terminal option ${key} was observed`)
      },
    })
  }
  const hostileProxy = new Proxy(Object.create(null), {
    get() {
      optionObservations += 1
      throw new Error('terminal proxy get trap ran')
    },
    getOwnPropertyDescriptor() {
      optionObservations += 1
      throw new Error('terminal proxy descriptor trap ran')
    },
    getPrototypeOf() {
      optionObservations += 1
      throw new Error('terminal proxy prototype trap ran')
    },
    has() {
      optionObservations += 1
      throw new Error('terminal proxy has trap ran')
    },
    ownKeys() {
      optionObservations += 1
      throw new Error('terminal proxy ownKeys trap ran')
    },
  })
  const cases = [
    ['F-01', hostileRecord],
    ['F-02', undefined],
    ['F-03', hostileProxy],
  ]
  const surfaces = [
    ['runtime', runtime.deleteKernelStoreRuntimeFile],
    ['public', store.deleteKernelStoreFile],
  ]

  const originalPromiseReject = Promise.reject
  let promiseRejectCalls = 0
  Promise.reject = function poisonedPromiseReject() {
    promiseRejectCalls += 1
    throw new Error('live Promise.reject dispatch ran')
  }
  try {
    for (const [obligationId, input] of cases) {
      for (const [surface, refusal] of surfaces) {
        let returned
        assert.doesNotThrow(() => {
          returned = refusal(input)
        })
        assert.equal(returned instanceof Promise, true)
        assert.equal(Object.getPrototypeOf(returned), Promise.prototype)

        const order = []
        let reason
        const observed = returned.then(
          () => assert.fail(`${surface} ${obligationId} unexpectedly resolved`),
          (error) => {
            reason = error
            order.push('rejected')
          },
        )
        queueMicrotask(() => order.push('sentinel'))
        await observed
        assert.deepEqual(
          order,
          ['rejected', 'sentinel'],
          `${surface} ${obligationId} did not reject before a later turn`,
        )
        assertTerminalReason(reason, LegacyMutationError)
      }
    }
  } finally {
    Promise.reject = originalPromiseReject
  }

  assert.equal(optionObservations, 0)
  assert.equal(promiseRejectCalls, 0)
  assert.deepEqual(filesystemCalls, [])
})

test('M2-B-06 legacy terminal error is the sole thirteenth pair and rm is removed', () => {
  const routerSource = readFileSync(routerPath, 'utf8')
  const pairBlock = routerSource.match(
    /const ERROR_PAIRS = objectFreeze\(\{\n([\s\S]*?)\n\}\)/,
  )
  assert.ok(pairBlock, 'legacy error pair registry is missing')
  const sourcePairs = [...pairBlock[1].matchAll(
    /^\s{2}(legacy_[a-z_]+): '([^']+)',?$/gm,
  )].map((match) => [match[1], match[2]])
  assert.deepEqual(sourcePairs, EXPECTED_LEGACY_ERROR_PAIRS)

  const cause = Object.freeze({ marker: 'terminal-error-cause' })
  for (const [code, message] of EXPECTED_LEGACY_ERROR_PAIRS) {
    const error = new LegacyMutationError(code, message, cause)
    assert.ok(error instanceof Error)
    assert.ok(error instanceof LegacyMutationError)
    assert.equal(error.name, 'LegacyMutationError')
    assert.equal(error.code, code)
    assert.equal(error.message, message)
    assert.equal(error.cause, cause)
    assert.deepEqual(Object.keys(error), ['code'])
  }
  assert.throws(
    () => new LegacyMutationError(
      'legacy_fourteenth_error',
      'A fourteenth legacy error must remain impossible.',
    ),
    {
      name: 'TypeError',
      message: 'Unknown legacy mutation error code.',
    },
  )

  const runtimeSource = readFileSync(runtimePath, 'utf8')
  assert.doesNotMatch(
    runtimeSource,
    /import\s*\{[^}]*\brm\b[^}]*\}\s*from\s*'node:fs\/promises'/s,
  )
  assert.doesNotMatch(runtimeSource, /\bfsRm\b/)
  const terminalStart = runtimeSource.indexOf(
    'export async function deleteKernelStoreRuntimeFile',
  )
  const terminalEnd = runtimeSource.indexOf(
    'export function probeMemorySqliteDriver',
    terminalStart,
  )
  assert.notEqual(terminalStart, -1)
  assert.notEqual(terminalEnd, -1)
  const terminalSource = runtimeSource.slice(terminalStart, terminalEnd)
  assert.doesNotMatch(
    terminalSource,
    /captureStoreOptions|captureMemoryPathCandidate|canonicalMemoryPath|registryEntry|queuePathOperation|path(?:Basename|Dirname|Resolve)|fs(?:Lstat|Mkdir|Realpath|Rm)|\b(?:lstat|mkdir|realpath|rm)\b/,
  )

  const storeSource = readFileSync(storePath, 'utf8')
  assert.match(
    storeSource,
    /export const deleteKernelStoreFile = deleteKernelStoreRuntimeFile/,
  )
})

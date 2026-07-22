// V2-M2-B Task 5 — governed bridge production runtime wiring.

import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { createGatedStore } from '../src/gate.mjs'
import {
  createMemoryAuthorityRoot,
  issueMemoryAuthorityGrant,
} from '../src/memory-authority.mjs'
import * as runtime from '../src/kernel-store-runtime.mjs'
import { createKernelStore } from '../src/store.mjs'

const WORKSPACE_ID = 'runtime-bridge-workspace'
const PALARI_ID = 'palari_runtime'
const USER_ID = 'user_runtime'

function identifier(prefix, ordinal) {
  return `${prefix}20000000-0000-4000-8000-${String(ordinal).padStart(12, '0')}`
}

function rootInput(overrides = {}) {
  return {
    workspaceId: WORKSPACE_ID,
    palariId: PALARI_ID,
    userId: USER_ID,
    authorityLedgerId: identifier('led_', 1),
    checkGrantActive: () => true,
    ...overrides,
  }
}

function grantInput(targetId, ordinal) {
  return {
    authorityEventId: identifier('agr_', ordinal),
    capabilityId: identifier('cap_', ordinal),
    evidenceAt: '2000-01-01T00:00:00.000Z',
    expiresAt: '2999-01-01T00:00:00.000Z',
    targetId,
    verb: 'erase_atom',
  }
}

function temporaryRoot() {
  return mkdtempSync(join(tmpdir(), 'brain-governed-runtime-'))
}

test('M2-B-05 runtime namespace replaces the historical execution door exactly', () => {
  assert.deepEqual(Object.keys(runtime), [
    'acquisitionModes',
    'assertKernelStoreCapability',
    'createKernelStoreRuntime',
    'deleteKernelStoreRuntimeFile',
    'executeGovernedStoreIntent',
    'externalMemorySourceKinds',
    'extractMemoryQueryKeywords',
    'memoryAddWriters',
    'memoryFtsTokenizer',
    'memoryMutationActors',
    'memoryStoreSchemaVersion',
    'memoryTypes',
    'permanentMemoryTypes',
    'probeMemorySqliteDriver',
    'transientMemoryTypes',
    'trigramShingleSimilarity',
    'workspaceMemoryDbPath',
  ])
  assert.equal('executeLegacyStoreIntent' in runtime, false)
})

test('M2-B-05 direct runtime observes authority only after enabled path capture', async () => {
  let authorityReads = 0
  const disabledOptions = {
    memoryEnabled: false,
  }
  Object.defineProperty(disabledOptions, 'authorityRoot', {
    get() {
      authorityReads += 1
      throw new Error('disabled authority getter ran')
    },
  })
  const disabled = await createKernelStore(disabledOptions)
  try {
    assert.equal(disabled.enabled, false)
    assert.equal(authorityReads, 0)
  } finally {
    disabled.close()
  }

  const pathFailure = new Error('path conversion wins')
  const enabledOptions = {
    memoryEnabled: true,
    memoryRootDir: {
      toString() {
        throw pathFailure
      },
    },
    workspaceId: WORKSPACE_ID,
  }
  Object.defineProperty(enabledOptions, 'authorityRoot', {
    get() {
      authorityReads += 1
      throw new Error('authority getter ran before path failure')
    },
  })
  await assert.rejects(createKernelStore(enabledOptions), (error) => {
    assert.equal(error.code, 'legacy_path_invalid')
    assert.equal(error.cause, pathFailure)
    return true
  })
  assert.equal(authorityReads, 0)

  const directory = temporaryRoot()
  try {
    let accessorCalls = 0
    const accessorOptions = {
      memoryEnabled: true,
      memoryRootDir: directory,
      workspaceId: WORKSPACE_ID,
    }
    Object.defineProperty(accessorOptions, 'authorityRoot', {
      get() {
        accessorCalls += 1
        return undefined
      },
    })
    await assert.rejects(createKernelStore(accessorOptions), (error) => {
      assert.equal(error.code, 'authority_root_invalid')
      return true
    })
    assert.equal(accessorCalls, 0)
  } finally {
    rmSync(directory, { force: true, recursive: true })
  }
})

test('M2-B-05 direct store binds authority and routes raw deletion only through the bridge', async () => {
  const directory = temporaryRoot()
  const root = createMemoryAuthorityRoot(rootInput())
  let base
  try {
    base = await createKernelStore({
      memoryEnabled: true,
      memoryRootDir: directory,
      workspaceId: WORKSPACE_ID,
      authorityRoot: root,
    })
    const gated = createGatedStore(base)
    const targetId = identifier('mem_', 10)
    const grant = issueMemoryAuthorityGrant(root, grantInput(targetId, 10))
    assert.deepEqual(
      gated.deleteMemory(targetId, undefined, grant),
      { deleted: false, reason: 'not_found' },
    )

    const hostile = new Proxy({}, {
      get() {
        throw new Error('rootless input was inspected')
      },
      getOwnPropertyDescriptor() {
        throw new Error('rootless input was inspected')
      },
      getPrototypeOf() {
        throw new Error('rootless input was inspected')
      },
      ownKeys() {
        throw new Error('rootless input was inspected')
      },
    })
    assert.deepEqual(
      gated.deleteMemory(hostile, hostile, undefined),
      { deleted: false, reason: 'governance_refused' },
    )
    assert.deepEqual(
      gated.propose(hostile),
      { outcome: 'rejected', reasons: ['governance_refused'] },
    )
  } finally {
    if (base !== undefined) base.close()
    rmSync(directory, { force: true, recursive: true })
  }
})

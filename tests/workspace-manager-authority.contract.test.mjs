import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  MemoryAuthorityError,
  createMemoryAuthorityRoot,
  issueMemoryAuthorityGrant,
} from '../src/memory-authority.mjs'
import {
  createWorkspaceMemoryManager,
  workspaceMemoryDbPath,
} from '../src/store.mjs'
import * as providerCapture from '../src/workspace-manager-authority.mjs'

let identifierOrdinal = 1

function identifier(prefix) {
  const suffix = String(identifierOrdinal).padStart(12, '0')
  identifierOrdinal += 1
  return `${prefix}00000000-0000-4000-8000-${suffix}`
}

async function temporaryDirectory(t, label) {
  const directory = await mkdtemp(join(tmpdir(), label))
  t.after(async () => {
    await rm(directory, { force: true, recursive: true })
  })
  return directory
}

function authorityRoot(workspaceId) {
  return createMemoryAuthorityRoot({
    workspaceId,
    palariId: 'palari_manager',
    userId: 'user_manager',
    authorityLedgerId: identifier('led_'),
    checkGrantActive() {
      return true
    },
  })
}

function grantInput() {
  return {
    authorityEventId: identifier('agr_'),
    capabilityId: identifier('cap_'),
    evidenceAt: '2026-07-21T00:00:00.000Z',
    expiresAt: '2027-07-21T00:00:00.000Z',
    targetId: identifier('mem_'),
    verb: 'erase_atom',
  }
}

function assertAuthorityFailure(error, code) {
  assert.equal(error instanceof MemoryAuthorityError, true)
  assert.equal(error.name, 'MemoryAuthorityError')
  assert.equal(error.code, code)
  return true
}

function assertNoAuthorityIdentity(carrier, provider, root) {
  for (const key of Reflect.ownKeys(carrier)) {
    const value = Reflect.getOwnPropertyDescriptor(carrier, key)?.value
    assert.notEqual(value, provider)
    assert.notEqual(value, root)
  }
  assert.equal(Object.hasOwn(carrier, 'authorityRoot'), false)
  assert.equal(Object.hasOwn(carrier, 'authorityRootForWorkspace'), false)
}

test('M2-B-06 manager authority adapter has one exact internal export', () => {
  assert.deepEqual(Object.keys(providerCapture), [
    'captureWorkspaceAuthorityProvider',
  ])
})

test('M2-B-06 manager captures only a trusted own provider after enabled path work', async (t) => {
  const directory = await temporaryDirectory(t, 'brain-manager-authority-capture-')
  const pathEvents = []
  let accessorCalls = 0
  const accessorOptions = {
    memoryEnabled: true,
    memoryRootDir: {
      toString() {
        pathEvents.push('path')
        return directory
      },
    },
  }
  Object.defineProperty(accessorOptions, 'authorityRootForWorkspace', {
    get() {
      accessorCalls += 1
      throw new Error('provider accessor must not run')
    },
  })
  assert.throws(
    () => createWorkspaceMemoryManager(accessorOptions),
    (error) => assertAuthorityFailure(error, 'authority_invalid_argument'),
  )
  assert.deepEqual(pathEvents, ['path'])
  assert.equal(accessorCalls, 0)

  const earlierPathFailure = new Error('earlier path coercion')
  let suppressedAccessorCalls = 0
  const pathFailureOptions = {
    memoryEnabled: true,
    memoryRootDir: {
      toString() {
        throw earlierPathFailure
      },
    },
  }
  Object.defineProperty(pathFailureOptions, 'authorityRootForWorkspace', {
    get() {
      suppressedAccessorCalls += 1
      throw new Error('late provider accessor')
    },
  })
  assert.throws(
    () => createWorkspaceMemoryManager(pathFailureOptions),
    (error) => error === earlierPathFailure,
  )
  assert.equal(suppressedAccessorCalls, 0)

  const configurationFailure = new Error('earlier configuration failure')
  let invalidProviderApplyCalls = 0
  const lateInvalidProvider = new Proxy(function lateProvider() {}, {
    apply() {
      invalidProviderApplyCalls += 1
      throw new Error('invalid provider apply')
    },
  })
  const throwingEnvironment = {}
  Object.defineProperty(throwingEnvironment, 'PALARI_MEMORY', {
    get() {
      throw configurationFailure
    },
  })
  assert.throws(
    () => createWorkspaceMemoryManager({
      env: throwingEnvironment,
      memoryRootDir: directory,
      authorityRootForWorkspace: lateInvalidProvider,
    }),
    (error) => error === configurationFailure,
  )
  assert.equal(invalidProviderApplyCalls, 0)

  let disabledPathCalls = 0
  let disabledAccessorCalls = 0
  const disabledOptions = {
    memoryEnabled: false,
    memoryRootDir: {
      toString() {
        disabledPathCalls += 1
        throw new Error('disabled path')
      },
    },
  }
  Object.defineProperty(disabledOptions, 'authorityRootForWorkspace', {
    get() {
      disabledAccessorCalls += 1
      throw new Error('disabled provider')
    },
  })
  const disabled = createWorkspaceMemoryManager(disabledOptions)
  const disabledHandle = await disabled.forWorkspace('disabled workspace')
  assert.equal(disabledHandle.enabled, false)
  assert.equal(disabledPathCalls, 0)
  assert.equal(disabledAccessorCalls, 0)
  await disabled.close()

  let proxyApplyCalls = 0
  const proxiedProvider = new Proxy(function proxiedProviderTarget() {}, {
    apply() {
      proxyApplyCalls += 1
      throw new Error('proxy apply')
    },
  })
  for (const invalidProvider of [null, {}, proxiedProvider]) {
    assert.throws(
      () => createWorkspaceMemoryManager({
        memoryEnabled: true,
        memoryRootDir: directory,
        authorityRootForWorkspace: invalidProvider,
      }),
      (error) => assertAuthorityFailure(error, 'authority_invalid_argument'),
    )
  }
  assert.equal(proxyApplyCalls, 0)

  let inheritedCalls = 0
  const inheritedOptions = Object.create({
    authorityRootForWorkspace() {
      inheritedCalls += 1
      throw new Error('inherited provider')
    },
  })
  inheritedOptions.memoryEnabled = true
  inheritedOptions.memoryRootDir = directory
  const inheritedManager = createWorkspaceMemoryManager(inheritedOptions)
  const inheritedHandle = await inheritedManager.forWorkspace('inherited')
  assert.equal(inheritedCalls, 0)
  inheritedHandle.close()
  await inheritedManager.close()

  let classCalls = 0
  class ProviderClass {
    constructor() {
      classCalls += 1
    }
  }
  const classManager = createWorkspaceMemoryManager({
    memoryEnabled: true,
    memoryRootDir: directory,
    authorityRootForWorkspace: ProviderClass,
  })
  const classPath = workspaceMemoryDbPath({
    memoryRootDir: directory,
    workspaceId: 'class-provider',
  })
  await assert.rejects(
    classManager.forWorkspace('class provider'),
    (error) => error instanceof TypeError,
  )
  assert.equal(classCalls, 0)
  assert.equal(existsSync(classPath), false)
  await classManager.close()

  const boundReceiver = { calls: 0 }
  const boundProvider = function boundProviderTarget(workspaceId) {
    assert.equal(this, boundReceiver)
    this.calls += 1
    return authorityRoot(workspaceId)
  }.bind(boundReceiver)
  const boundManager = createWorkspaceMemoryManager({
    memoryEnabled: true,
    memoryRootDir: directory,
    authorityRootForWorkspace: boundProvider,
  })
  const boundHandle = await boundManager.forWorkspace('bound-provider')
  assert.equal(boundReceiver.calls, 1)
  boundHandle.close()
  await boundManager.close()
})

test('M2-B-06 manager calls a captured provider once per new normalized generation and discloses neither value', async (t) => {
  const directory = await temporaryDirectory(t, 'brain-manager-authority-generation-')
  const calls = []
  const roots = []
  let replacementCalls = 0
  const options = {
    memoryEnabled: true,
    memoryRootDir: directory,
    authorityRootForWorkspace: function provider(workspaceId, extra) {
      assert.equal(this, undefined)
      assert.equal(arguments.length, 1)
      assert.equal(extra, undefined)
      calls.push(workspaceId)
      const root = authorityRoot(workspaceId)
      roots.push(root)
      return root
    },
  }
  const capturedProvider = options.authorityRootForWorkspace
  const manager = createWorkspaceMemoryManager(options)
  options.authorityRootForWorkspace = function replacementProvider() {
    replacementCalls += 1
    throw new Error('mutated provider must stay detached')
  }
  assert.equal(calls.length, 0)

  const workspaceFailure = new Error('workspace normalization failure')
  await assert.rejects(
    manager.forWorkspace({
      toString() {
        throw workspaceFailure
      },
    }),
    (error) => error === workspaceFailure,
  )
  assert.equal(calls.length, 0)

  const firstFlight = manager.forWorkspace('  Shared WORKSPACE!!  ')
  const secondFlight = manager.forWorkspace('shared-workspace')
  assert.equal(calls.length, 0)
  const [first, second] = await Promise.all([firstFlight, secondFlight])
  assert.equal(first, second)
  assert.deepEqual(calls, ['shared-workspace'])
  assert.equal(replacementCalls, 0)
  assert.doesNotThrow(() => issueMemoryAuthorityGrant(roots[0], grantInput()))

  const cached = await manager.forWorkspace('shared workspace')
  assert.equal(cached, first)
  assert.deepEqual(calls, ['shared-workspace'])

  for (const carrier of [
    manager,
    manager.config,
    manager.publicStatus(),
    first,
    first.config,
    first.publicStatus(),
    first.status(),
  ]) assertNoAuthorityIdentity(carrier, capturedProvider, roots[0])

  first.close()
  assert.throws(
    () => issueMemoryAuthorityGrant(roots[0], grantInput()),
    (error) => assertAuthorityFailure(error, 'authority_root_revoked'),
  )

  const reopened = await manager.forWorkspace('shared-workspace')
  assert.notEqual(reopened, first)
  assert.deepEqual(calls, ['shared-workspace', 'shared-workspace'])
  assert.equal(replacementCalls, 0)
  assert.doesNotThrow(() => issueMemoryAuthorityGrant(roots[1], grantInput()))
  await manager.close()
  assert.equal(reopened.status().status, 'closed')
  assert.throws(
    () => issueMemoryAuthorityGrant(roots[1], grantInput()),
    (error) => assertAuthorityFailure(error, 'authority_root_revoked'),
  )
})

test('M2-B-06 provider returns are synchronously preflighted and failed flights call it anew', async (t) => {
  const directory = await temporaryDirectory(t, 'brain-manager-authority-retry-')
  const thenFailure = new Error('then must not be inspected')
  let thenReads = 0
  const thenable = {}
  Object.defineProperty(thenable, 'then', {
    get() {
      thenReads += 1
      throw thenFailure
    },
  })
  const providerFailure = new Error('provider failure')
  const returns = [
    thenable,
    Promise.resolve(undefined),
    providerFailure,
  ]
  const calls = []
  const roots = []
  const manager = createWorkspaceMemoryManager({
    memoryEnabled: true,
    memoryRootDir: directory,
    authorityRootForWorkspace: function provider(workspaceId) {
      assert.equal(this, undefined)
      calls.push(workspaceId)
      const next = returns[calls.length - 1]
      if (next === providerFailure) throw next
      if (next !== undefined) return next
      const root = authorityRoot(workspaceId)
      roots.push(root)
      return root
    },
  })
  const dbPath = workspaceMemoryDbPath({
    memoryRootDir: directory,
    workspaceId: 'retry-workspace',
  })

  const failedPair = await Promise.allSettled([
    manager.forWorkspace('Retry Workspace'),
    manager.forWorkspace('retry-workspace'),
  ])
  assert.equal(calls.length, 1)
  assert.equal(failedPair[0].status, 'rejected')
  assert.equal(failedPair[1].status, 'rejected')
  assert.equal(failedPair[0].reason, failedPair[1].reason)
  assertAuthorityFailure(failedPair[0].reason, 'authority_root_invalid')
  assert.equal(thenReads, 0)
  assert.equal(existsSync(dbPath), false)

  await assert.rejects(
    manager.forWorkspace('retry-workspace'),
    (error) => assertAuthorityFailure(error, 'authority_root_invalid'),
  )
  assert.equal(calls.length, 2)
  assert.equal(existsSync(dbPath), false)

  await assert.rejects(
    manager.forWorkspace('retry-workspace'),
    (error) => error === providerFailure,
  )
  assert.equal(calls.length, 3)
  assert.equal(existsSync(dbPath), false)

  const handle = await manager.forWorkspace('retry-workspace')
  assert.equal(calls.length, 4)
  assert.deepEqual(calls, [
    'retry-workspace',
    'retry-workspace',
    'retry-workspace',
    'retry-workspace',
  ])
  assert.doesNotThrow(() => issueMemoryAuthorityGrant(roots[0], grantInput()))
  handle.close()
  await manager.close()
})

test('M2-B-06 a close race publishes no handle and retires the provider root', async (t) => {
  const directory = await temporaryDirectory(t, 'brain-manager-authority-race-')
  const workspaceId = 'close-race'
  const dbPath = workspaceMemoryDbPath({
    memoryRootDir: directory,
    workspaceId,
  })
  let providerCalls = 0
  let root
  const manager = createWorkspaceMemoryManager({
    memoryEnabled: true,
    memoryRootDir: directory,
    authorityRootForWorkspace: function provider(actualWorkspaceId) {
      assert.equal(this, undefined)
      assert.equal(actualWorkspaceId, workspaceId)
      assert.equal(existsSync(dbPath), false)
      providerCalls += 1
      root = authorityRoot(actualWorkspaceId)
      return root
    },
  })

  const flight = manager.forWorkspace('Close Race')
  assert.equal(providerCalls, 0)
  const closeA = manager.close()
  const closeB = manager.close()
  assert.equal(closeA, closeB)
  await assert.rejects(
    flight,
    (error) => error.code === 'legacy_manager_closed',
  )
  await closeA
  assert.equal(providerCalls, 1)
  assert.throws(
    () => issueMemoryAuthorityGrant(root, grantInput()),
    (error) => assertAuthorityFailure(error, 'authority_root_revoked'),
  )

  let workspaceCoercions = 0
  await assert.rejects(
    manager.forWorkspace({
      toString() {
        workspaceCoercions += 1
        throw new Error('closed workspace coercion')
      },
    }),
    (error) => error.code === 'legacy_manager_closed',
  )
  assert.equal(workspaceCoercions, 0)
  assert.equal(providerCalls, 1)
})

test('M2-B-06 a post-bind handle-construction failure retires the root before retry', async (t) => {
  const directory = await temporaryDirectory(t, 'brain-manager-authority-publication-')
  const authorityUrl = new URL('../src/memory-authority.mjs', import.meta.url).href
  const runtimeUrl = new URL('../src/kernel-store-runtime.mjs', import.meta.url).href
  const storeUrl = new URL('../src/store.mjs', import.meta.url).href
  const source = `
    import assert from 'node:assert/strict'
    import { registerHooks } from 'node:module'

    const authorityUrl = ${JSON.stringify(authorityUrl)}
    const runtimeUrl = ${JSON.stringify(runtimeUrl)}
    const storeUrl = ${JSON.stringify(storeUrl)}
    const directory = ${JSON.stringify(directory)}
    const publicationFailure = new Error('post-bind handle construction')
    let constructionCalls = 0
    globalThis.__m2bFailAfterHandleConstruction = function failAfterHandle() {
      constructionCalls += 1
      if (constructionCalls === 1) throw publicationFailure
    }

    registerHooks({
      load(url, context, nextLoad) {
        const loaded = nextLoad(url, context)
        if (url.split('?')[0] !== runtimeUrl) return loaded
        let runtimeSource = typeof loaded.source === 'string'
          ? loaded.source
          : Buffer.from(loaded.source).toString('utf8')
        const needle =
          '    const handle = createBaseHandle(state)\\n' +
          '    state.handle = handle\\n' +
          '    entry.liveCount += 1\\n'
        if (!runtimeSource.includes(needle)) {
          throw new Error('post-bind construction instrumentation needle missing')
        }
        runtimeSource = runtimeSource.replace(
          needle,
          '    const handle = createBaseHandle(state)\\n' +
          '    globalThis.__m2bFailAfterHandleConstruction()\\n' +
          '    state.handle = handle\\n' +
          '    entry.liveCount += 1\\n',
        )
        return { ...loaded, source: runtimeSource }
      },
    })

    const authority = await import(authorityUrl)
    const store = await import(storeUrl + '?m2b-manager-publication')
    let ordinal = 1
    function identifier(prefix) {
      const suffix = String(ordinal).padStart(12, '0')
      ordinal += 1
      return prefix + '00000000-0000-4000-8000-' + suffix
    }
    function rootFor(workspaceId) {
      return authority.createMemoryAuthorityRoot({
        workspaceId,
        palariId: 'palari_publication',
        userId: 'user_publication',
        authorityLedgerId: identifier('led_'),
        checkGrantActive() { return true },
      })
    }
    function grantInput() {
      return {
        authorityEventId: identifier('agr_'),
        capabilityId: identifier('cap_'),
        evidenceAt: '2026-07-21T00:00:00.000Z',
        expiresAt: '2027-07-21T00:00:00.000Z',
        targetId: identifier('mem_'),
        verb: 'erase_atom',
      }
    }

    const roots = []
    let providerCalls = 0
    const manager = store.createWorkspaceMemoryManager({
      memoryEnabled: true,
      memoryRootDir: directory,
      authorityRootForWorkspace(workspaceId) {
        providerCalls += 1
        const root = rootFor(workspaceId)
        roots.push(root)
        return root
      },
    })

    await assert.rejects(
      manager.forWorkspace('publication failure'),
      (error) => error === publicationFailure,
    )
    assert.equal(providerCalls, 1)
    assert.throws(
      () => authority.issueMemoryAuthorityGrant(roots[0], grantInput()),
      (error) => error.code === 'authority_root_revoked',
    )

    const handle = await manager.forWorkspace('publication failure')
    assert.equal(providerCalls, 2)
    assert.doesNotThrow(
      () => authority.issueMemoryAuthorityGrant(roots[1], grantInput()),
    )
    await manager.close()
    assert.equal(handle.status().status, 'closed')
    assert.throws(
      () => authority.issueMemoryAuthorityGrant(roots[1], grantInput()),
      (error) => error.code === 'authority_root_revoked',
    )
    assert.equal(constructionCalls, 2)
    process.stdout.write('PASS')
  `
  const child = spawnSync(
    process.execPath,
    ['--no-warnings', '--input-type=module', '--eval', source],
    { cwd: directory, encoding: 'utf8', timeout: 30_000 },
  )
  assert.equal(
    child.status,
    0,
    `publication child failed\nstdout:\n${child.stdout}\nstderr:\n${child.stderr}`,
  )
  assert.equal(child.stdout, 'PASS')
})

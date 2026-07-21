import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { access, mkdtemp, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { after, test } from 'node:test'

import * as runtimeModule from '../src/kernel-store-runtime.mjs'
import * as storeModule from '../src/store.mjs'
import { createGatedStore } from '../src/gate.mjs'
import {
  createKernelStore,
  createWorkspaceMemoryManager,
  deleteKernelStoreFile,
  memoryTypes,
} from '../src/store.mjs'

const tempDirectories = []

async function temporaryDirectory(prefix = 'brain-a2-runtime-') {
  const directory = await mkdtemp(join(tmpdir(), prefix))
  tempDirectories.push(directory)
  return directory
}

after(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(
    directory,
    { force: true, recursive: true },
  )))
})

const FIXED_NOW = new Date('2026-07-21T12:00:00.000Z')
const CANONICAL_MEMORY_KEYS = [
  'id',
  'palari_id',
  'user_id',
  'type',
  'content',
  'keywords',
  'importance',
  'valid_from',
  'valid_until',
  'access_count',
  'last_accessed',
  'created_at',
  'shared',
  'confidence',
  'acquisition_mode',
  'created_by_pipeline',
  'fictional',
  'last_decayed_at',
  'source_message_id',
  'content_hash',
  'source_kind',
  'extractor',
]

async function openBase(directory, workspaceId = 'contract') {
  return createKernelStore({
    clock: () => FIXED_NOW,
    memoryEnabled: true,
    memoryRootDir: directory,
    workspaceId,
  })
}

function proposeFixture(gated, overrides = {}) {
  return gated.propose({
    kind: 'permanent',
    provenance: {
      sourceKind: 'user_message',
      writer: 'explicit_user_action',
    },
    record: {
      confidence: 0.9,
      content: 'A2 routes every supported mutation through one coordinator.',
      importance: 0.8,
      keywords: ['routing', 'coordinator'],
      palari_id: 'palari-a',
      type: 'preference',
      user_id: 'user-a',
      ...overrides,
    },
  })
}

async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

function a2InstrumentationChildMain(payload) {
  const apply = Reflect.apply
  const construct = Reflect.construct
  const defineProperty = Object.defineProperty
  const getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor
  const nativeDbClose = NativeDatabaseSync.prototype.close
  const nativeDbExec = NativeDatabaseSync.prototype.exec
  const nativeDbPrepare = NativeDatabaseSync.prototype.prepare
  const nativeStatementAll = NativeStatementSync.prototype.all
  const nativeStatementGet = NativeStatementSync.prototype.get
  const nativeStatementRun = NativeStatementSync.prototype.run
  const nativeStatementSetReadBigInts =
    NativeStatementSync.prototype.setReadBigInts
  const nativeStatementSetReturnArrays =
    NativeStatementSync.prototype.setReturnArrays
  const accessorProbe = new NativeDatabaseSync(':memory:', { open: false })
  const nativeIsOpen = getOwnPropertyDescriptor(accessorProbe, 'isOpen').get
  const nativeIsTransaction = getOwnPropertyDescriptor(
    accessorProbe,
    'isTransaction',
  ).get
  const databaseRecords = new WeakMap()
  const statementRecords = new WeakMap()
  const errorLabels = new WeakMap()
  const errorsByLabel = new Map()
  const operationalRecords = []
  let activeScenario = null

  function stableError(label) {
    let error = errorsByLabel.get(label)
    if (error === undefined) {
      error = new Error(`injected ${label}`)
      error.code = 'ERR_SQLITE_ERROR'
      errorsByLabel.set(label, error)
      errorLabels.set(error, label)
    }
    return error
  }

  function armPause(scenario, kind, pathPart) {
    let release
    let reached
    scenario.fsPause = {
      kind,
      pathPart,
      released: new Promise((resolve) => { release = resolve }),
      used: false,
    }
    scenario.pauseReached = new Promise((resolve) => { reached = resolve })
    scenario.releasePause = release
    scenario.markPauseReached = reached
  }

  async function pauseFilesystemOperation(kind, pathValue) {
    const scenario = activeScenario
    const pause = scenario?.fsPause
    if (
      scenario?.enabled !== true || pause === undefined || pause.used ||
      pause.kind !== kind || !String(pathValue).includes(pause.pathPart)
    ) return
    pause.used = true
    scenario.markPauseReached()
    await pause.released
  }

  async function instrumentedMkdir(...args) {
    await pauseFilesystemOperation('mkdir', args[0])
    return apply(NativeFsPromises.mkdir, undefined, args)
  }

  async function instrumentedLstat(...args) {
    await pauseFilesystemOperation('lstat', args[0])
    return apply(NativeFsPromises.lstat, undefined, args)
  }

  async function instrumentedRealpath(...args) {
    await pauseFilesystemOperation('realpath', args[0])
    return apply(NativeFsPromises.realpath, undefined, args)
  }

  async function instrumentedRm(...args) {
    const scenario = activeScenario
    const pathValue = String(args[0])
    scenario?.rmCalls?.push(pathValue)
    await pauseFilesystemOperation('rm', pathValue)
    if (
      scenario?.enabled && scenario.rmFailure !== undefined &&
      !scenario.rmFailure.used && pathValue.endsWith(scenario.rmFailure.suffix)
    ) {
      scenario.rmFailure.used = true
      throw stableError(scenario.rmFailure.label)
    }
    return apply(NativeFsPromises.rm, undefined, args)
  }

  function nativeState(record) {
    let open
    let transaction
    try {
      open = apply(nativeIsOpen, record.target, [])
    } catch {
      open = null
    }
    try {
      transaction = apply(nativeIsTransaction, record.target, [])
    } catch {
      transaction = null
    }
    return { open, transaction }
  }

  function normalizeSql(sql) {
    return String(sql).trim().replace(/\s+/g, ' ')
  }

  function tokenForError(error) {
    return errorLabels.get(error) ?? error?.code ?? error?.message ?? String(error)
  }

  function serializeError(error) {
    return {
      name: error?.name ?? null,
      code: error?.code ?? null,
      message: error?.message ?? String(error),
      label: errorLabels.get(error) ?? null,
      cause: error?.cause === undefined ? null : tokenForError(error.cause),
      errors: error instanceof AggregateError
        ? error.errors.map(tokenForError)
        : null,
    }
  }

  function scenarioForNewConnection(args) {
    if (
      activeScenario === null ||
      activeScenario.enabled !== true ||
      args[1]?.open === false ||
      args[0] === ':memory:' ||
      activeScenario.connectionAssigned
    ) return null
    activeScenario.connectionAssigned = true
    return activeScenario
  }

  function recordStateRead(scenario, event) {
    if (scenario !== null) scenario.stateReads.push(event)
  }

  function injectedStateValue(record, key) {
    const scenario = record.scenario
    if (key === 'open') {
      if (record.closeReturned && scenario?.closeProof !== undefined) {
        const proof = scenario.closeProof
        if (proof.throw !== undefined) throw stableError(proof.throw)
        if (Object.hasOwn(proof, 'value')) return proof.value
      }
      record.statePair += 1
      record.stateOverride = scenario?.stateOverrides?.[record.statePair] ?? null
    }
    const override = record.stateOverride
    const throwLabel = override?.[`${key}Throw`]
    if (throwLabel !== undefined) {
      recordStateRead(scenario, {
        key,
        pair: record.statePair,
        threw: throwLabel,
      })
      throw stableError(throwLabel)
    }
    const valueKey = `${key}Value`
    let value
    if (override !== null && Object.hasOwn(override, valueKey)) {
      value = override[valueKey]
    } else {
      const getter = key === 'open' ? nativeIsOpen : nativeIsTransaction
      value = apply(getter, record.target, [])
    }
    recordStateRead(scenario, { key, pair: record.statePair, value })
    if (key === 'transaction') record.stateOverride = null
    return value
  }

  function makeDatabaseWrapper(target, args) {
    const wrapper = Object.create(InstrumentedDatabaseSync.prototype)
    const scenario = scenarioForNewConnection(args)
    const record = {
      args,
      closeReturned: false,
      operationOrdinal: 0,
      scenario,
      stateOverride: null,
      statePair: 0,
      target,
    }
    databaseRecords.set(wrapper, record)
    if (args[1]?.open !== false && args[0] !== ':memory:') {
      operationalRecords.push(record)
      if (scenario !== null) scenario.constructCount += 1
    }
    defineProperty(wrapper, 'isOpen', {
      configurable: true,
      enumerable: true,
      get() {
        return injectedStateValue(databaseRecords.get(this), 'open')
      },
    })
    defineProperty(wrapper, 'isTransaction', {
      configurable: true,
      enumerable: true,
      get() {
        return injectedStateValue(databaseRecords.get(this), 'transaction')
      },
    })
    return wrapper
  }

  function operationDescriptor(operation, sql) {
    return sql === undefined
      ? operation
      : `${operation}:${normalizeSql(sql)}`
  }

  function beforeOperation(record, operation, sql) {
    const scenario = record.scenario
    if (scenario === null) return
    const ordinal = record.operationOrdinal
    record.operationOrdinal += 1
    const descriptor = operationDescriptor(operation, sql)
    scenario.operations.push(descriptor)
    if (
      scenario.enabled &&
      scenario.autoRollbackMatch !== undefined &&
      descriptor.includes(scenario.autoRollbackMatch) &&
      !scenario.primaryInjected
    ) {
      scenario.primaryInjected = true
      scenario.injectedState = nativeState(record)
      apply(nativeDbExec, record.target, ['ROLLBACK'])
      throw stableError(scenario.primaryLabel)
    }
    if (
      scenario.enabled &&
      scenario.primaryMatch !== undefined &&
      descriptor.includes(scenario.primaryMatch) &&
      !scenario.primaryInjected
    ) {
      scenario.primaryInjected = true
      scenario.injectedState = nativeState(record)
      throw stableError(scenario.primaryLabel)
    }
    if (
      scenario.enabled &&
      scenario.failOrdinal === ordinal &&
      !scenario.primaryInjected
    ) {
      scenario.primaryInjected = true
      scenario.injectedState = nativeState(record)
      throw stableError(scenario.primaryLabel)
    }
  }

  class InstrumentedDatabaseSync {
    constructor(...args) {
      if (
        activeScenario?.enabled &&
        activeScenario.nativeOpenFailure !== undefined &&
        !activeScenario.nativeOpenFailure.used &&
        args[1]?.open !== false && args[0] !== ':memory:'
      ) {
        activeScenario.nativeOpenFailure.used = true
        activeScenario.nativeOpenAttempts += 1
        throw stableError(activeScenario.nativeOpenFailure.label)
      }
      const target = construct(NativeDatabaseSync, args)
      return makeDatabaseWrapper(target, args)
    }
  }

  class InstrumentedStatementSync {}

  InstrumentedDatabaseSync.prototype.exec = function exec(sql) {
    const record = databaseRecords.get(this)
    const normalized = normalizeSql(sql)
    beforeOperation(record, 'exec', normalized)
    const scenario = record.scenario
    if (
      scenario?.enabled && normalized === 'ROLLBACK' &&
      scenario.rollbackThrow !== undefined
    ) {
      scenario.rollbackCalls.push('throw')
      throw stableError(scenario.rollbackThrow)
    }
    if (normalized === 'ROLLBACK') scenario?.rollbackCalls.push('return')
    if (
      scenario?.enabled && normalized === 'COMMIT' &&
      scenario.commitMode === 'return-active'
    ) return undefined
    if (
      scenario?.enabled && normalized === scenario.controlThrow?.sql &&
      scenario.controlThrow.timing === 'before'
    ) throw stableError(scenario.controlThrow.label)
    const result = apply(nativeDbExec, record.target, [sql])
    if (
      scenario?.enabled && normalized === scenario.controlThrow?.sql &&
      scenario.controlThrow.timing === 'after'
    ) throw stableError(scenario.controlThrow.label)
    return result
  }

  InstrumentedDatabaseSync.prototype.prepare = function prepare(sql) {
    const record = databaseRecords.get(this)
    beforeOperation(record, 'prepare', sql)
    const target = apply(nativeDbPrepare, record.target, [sql])
    const wrapper = Object.create(InstrumentedStatementSync.prototype)
    statementRecords.set(wrapper, { database: record, sql, target })
    return wrapper
  }

  InstrumentedDatabaseSync.prototype.close = function close() {
    const record = databaseRecords.get(this)
    const scenario = record.scenario
    const closeTraceScenario = scenario ?? (
      activeScenario?.managerCloseFailures === undefined
        ? null
        : activeScenario
    )
    closeTraceScenario?.closeCalls.push(String(record.args[0]))
    const managerLabel = activeScenario?.managerCloseFailures?.find(
      ({ pathPart }) => String(record.args[0]).includes(pathPart),
    )
    if (managerLabel !== undefined) throw stableError(managerLabel.label)
    if (scenario?.enabled && scenario.closeThrow !== undefined) {
      throw stableError(scenario.closeThrow)
    }
    const result = apply(nativeDbClose, record.target, [])
    record.closeReturned = true
    return result
  }

  function statementOperation(wrapper, operation, args, nativeMethod) {
    const statement = statementRecords.get(wrapper)
    beforeOperation(statement.database, operation, statement.sql)
    let result = apply(nativeMethod, statement.target, args)
    const scenario = statement.database.scenario
    if (
      operation === 'get' &&
      scenario?.enabled &&
      scenario.rowMismatch === true &&
      !scenario.rowMismatchUsed &&
      normalizeSql(statement.sql) === 'PRAGMA foreign_keys'
    ) {
      scenario.rowMismatchUsed = true
      result = { foreign_keys: 0 }
    }
    return result
  }

  InstrumentedStatementSync.prototype.all = function all(...args) {
    return statementOperation(this, 'all', args, nativeStatementAll)
  }
  InstrumentedStatementSync.prototype.get = function get(...args) {
    return statementOperation(this, 'get', args, nativeStatementGet)
  }
  InstrumentedStatementSync.prototype.run = function run(...args) {
    return statementOperation(this, 'run', args, nativeStatementRun)
  }
  InstrumentedStatementSync.prototype.setReadBigInts =
    function setReadBigInts(...args) {
      return statementOperation(
        this,
        'setReadBigInts',
        args,
        nativeStatementSetReadBigInts,
      )
    }
  InstrumentedStatementSync.prototype.setReturnArrays =
    function setReturnArrays(...args) {
      return statementOperation(
        this,
        'setReturnArrays',
        args,
        nativeStatementSetReturnArrays,
      )
    }

  globalThis.__a2InstrumentedSqlite = Object.freeze({
    DatabaseSync: InstrumentedDatabaseSync,
    StatementSync: InstrumentedStatementSync,
  })
  globalThis.__a2ConstructionHook = function constructionHook(stage) {
    if (
      activeScenario?.enabled &&
      activeScenario.constructionStage === stage
    ) {
      activeScenario.constructionCalls.push(stage)
      throw stableError(activeScenario.primaryLabel)
    }
  }
  globalThis.__a2ManagerPublicationHook = async function managerPublicationHook() {
    if (
      activeScenario?.enabled &&
      activeScenario.publicationPause === true &&
      !activeScenario.publicationPauseUsed
    ) {
      activeScenario.publicationPauseUsed = true
      activeScenario.markPauseReached()
      await activeScenario.fsPause.released
    }
    if (
      activeScenario?.enabled &&
      activeScenario.publicationFailure !== undefined &&
      !activeScenario.publicationFailure.used
    ) {
      activeScenario.publicationFailure.used = true
      throw stableError(activeScenario.publicationFailure.label)
    }
  }

  const sqliteUrl = 'palari-a2-instrumented:sqlite'
  const sqliteSource =
    'export const DatabaseSync = globalThis.__a2InstrumentedSqlite.DatabaseSync\n' +
    'export const StatementSync = globalThis.__a2InstrumentedSqlite.StatementSync\n'
  globalThis.__a2InstrumentedFsPromises = Object.freeze({
    lstat: instrumentedLstat,
    mkdir: instrumentedMkdir,
    realpath: instrumentedRealpath,
    rm: instrumentedRm,
  })
  const fsPromisesUrl = 'palari-a2-instrumented:fs-promises'
  const fsPromisesSource =
    'export const lstat = globalThis.__a2InstrumentedFsPromises.lstat\n' +
    'export const mkdir = globalThis.__a2InstrumentedFsPromises.mkdir\n' +
    'export const realpath = globalThis.__a2InstrumentedFsPromises.realpath\n' +
    'export const rm = globalThis.__a2InstrumentedFsPromises.rm\n'
  const runtimeBaseUrl = payload.runtimeUrl.split('?')[0]
  const storeBaseUrl = payload.storeUrl.split('?')[0]

  function insertAfter(source, needle, insertion) {
    if (!source.includes(needle)) {
      throw new Error(`instrumentation needle missing: ${needle}`)
    }
    return source.replace(needle, `${needle}${insertion}`)
  }

  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === 'node:sqlite') {
        return { shortCircuit: true, url: sqliteUrl }
      }
      if (specifier === 'node:fs/promises') {
        return { shortCircuit: true, url: fsPromisesUrl }
      }
      return nextResolve(specifier, context)
    },
    load(url, context, nextLoad) {
      if (url === sqliteUrl) {
        return {
          format: 'module',
          shortCircuit: true,
          source: sqliteSource,
        }
      }
      if (url === fsPromisesUrl) {
        return {
          format: 'module',
          shortCircuit: true,
          source: fsPromisesSource,
        }
      }
      const loaded = nextLoad(url, context)
      if (url.split('?')[0] === storeBaseUrl) {
        let source = typeof loaded.source === 'string'
          ? loaded.source
          : Buffer.from(loaded.source).toString('utf8')
        const gatedNeedle =
          '        const gated = createGatedStore(base, { policy: captured.policy })\n'
        if (!source.includes(gatedNeedle)) {
          throw new Error('manager publication instrumentation needle missing')
        }
        source = source.replace(
          gatedNeedle,
          "        await globalThis.__a2ManagerPublicationHook?.()\n" + gatedNeedle,
        )
        return { ...loaded, source }
      }
      if (url.split('?')[0] !== runtimeBaseUrl) return loaded
      let source = typeof loaded.source === 'string'
        ? loaded.source
        : Buffer.from(loaded.source).toString('utf8')
      source = insertAfter(
        source,
        '    const userClock = options.clock\n',
        "    globalThis.__a2ConstructionHook?.('coordinator')\n",
      )
      source = insertAfter(
        source,
        '    const router = createLegacyMutationRouter(\n' +
          '      db,\n' +
          '      userClock === undefined ? {} : { clock: userClock },\n' +
          '    )\n',
        "    globalThis.__a2ConstructionHook?.('router')\n" +
          "    globalThis.__a2ConstructionHook?.('registry-entry')\n",
      )
      source = insertAfter(
        source,
        '    const handle = createBaseHandle(state)\n',
        "    globalThis.__a2ConstructionHook?.('handle')\n",
      )
      return { ...loaded, source }
    },
  })

  function makeScenario(overrides = {}) {
    return {
      closeCalls: [],
      connectionAssigned: false,
      constructCount: 0,
      constructionCalls: [],
      enabled: true,
      injectedState: null,
      nativeOpenAttempts: 0,
      operations: [],
      primaryInjected: false,
      primaryLabel: 'primary',
      rmCalls: [],
      rollbackCalls: [],
      stateOverrides: {},
      stateReads: [],
      ...overrides,
    }
  }

  function optionsFor(workspaceId) {
    return {
      clock: () => new Date('2026-07-21T12:00:00.000Z'),
      memoryEnabled: true,
      memoryRootDir: payload.directory,
      workspaceId,
    }
  }

  async function importRuntime(tag) {
    return import(`${payload.runtimeUrl}?a2-instrumentation=${tag}`)
  }

  async function assertFreshOpen(runtime, options, violations, label) {
    try {
      const fresh = await runtime.createKernelStoreRuntime(options)
      fresh.close()
    } catch (error) {
      violations.push(`${label}: fresh open failed: ${tokenForError(error)}`)
    }
  }

  async function assertPoisoned(runtime, options, scenario, violations, label) {
    const before = operationalRecords.length
    try {
      await runtime.createKernelStoreRuntime(options)
      violations.push(`${label}: poisoned open unexpectedly succeeded`)
    } catch (error) {
      if (error?.code !== 'legacy_store_open') {
        violations.push(`${label}: poisoned open returned ${tokenForError(error)}`)
      }
    }
    try {
      await runtime.deleteKernelStoreRuntimeFile(options)
      violations.push(`${label}: poisoned delete unexpectedly succeeded`)
    } catch (error) {
      if (error?.code !== 'legacy_store_open') {
        violations.push(`${label}: poisoned delete returned ${tokenForError(error)}`)
      }
    }
    if (operationalRecords.length !== before) {
      violations.push(`${label}: poison allowed native reconstruction`)
    }
    if (scenario.constructCount !== 1) {
      violations.push(`${label}: unexpected primary construct count`)
    }
  }

  function errorTokens(error) {
    return error instanceof AggregateError
      ? error.errors.map(tokenForError)
      : [tokenForError(error)]
  }

  async function runOperationalMatrix() {
    const violations = []
    const baseline = makeScenario()
    activeScenario = baseline
    const baselineRuntime = await importRuntime('operational-baseline')
    const baselineOptions = optionsFor('operation-baseline')
    const baselineHandle = await baselineRuntime.createKernelStoreRuntime(
      baselineOptions,
    )
    baseline.enabled = false
    baselineHandle.close()
    const operations = baseline.operations.slice()
    if (operations.length < 50) {
      violations.push(`baseline exposed only ${operations.length} operations`)
    }

    for (let ordinal = 0; ordinal < operations.length; ordinal += 1) {
      const label = `operation-${ordinal}`
      const scenario = makeScenario({ failOrdinal: ordinal, primaryLabel: label })
      activeScenario = scenario
      const runtime = await importRuntime(`operation-${ordinal}`)
      const options = optionsFor(`operation-${ordinal}`)
      let caught
      let escapedHandle
      try {
        escapedHandle = await runtime.createKernelStoreRuntime(options)
      } catch (error) {
        caught = error
      }
      scenario.enabled = false
      if (escapedHandle !== undefined) {
        violations.push(`${label}: a handle escaped`)
        escapedHandle.close()
      }
      if (caught !== stableError(label)) {
        violations.push(
          `${label}: primary identity changed to ${tokenForError(caught)}`,
        )
      }
      if (scenario.closeCalls.length !== 1) {
        violations.push(`${label}: close count ${scenario.closeCalls.length}`)
      }
      const expectedRollback = scenario.injectedState?.transaction === true ? 1 : 0
      if (scenario.rollbackCalls.length !== expectedRollback) {
        violations.push(
          `${label}: rollback count ${scenario.rollbackCalls.length}, expected ${expectedRollback}`,
        )
      }
      await assertFreshOpen(runtime, options, violations, label)
    }

    return {
      firstOperations: operations.slice(0, 4),
      lastOperations: operations.slice(-4),
      operationCount: operations.length,
      violations,
    }
  }

  async function runOneFailureCase(definition, index) {
    const scenario = makeScenario(definition.scenario)
    activeScenario = scenario
    const runtime = await importRuntime(`state-${index}-${definition.name}`)
    const options = optionsFor(`state-${index}`)
    let caught
    let escapedHandle
    try {
      escapedHandle = await runtime.createKernelStoreRuntime(options)
    } catch (error) {
      caught = error
    }
    scenario.enabled = false
    const violations = []
    if (escapedHandle !== undefined) {
      violations.push('a handle escaped')
      escapedHandle.close()
    }
    const actualTokens = errorTokens(caught)
    if (JSON.stringify(actualTokens) !== JSON.stringify(definition.tokens)) {
      violations.push(
        `error order ${JSON.stringify(actualTokens)} != ${JSON.stringify(definition.tokens)}`,
      )
    }
    const classifiedPrimary = caught instanceof AggregateError
      ? caught.errors[0]
      : caught
    if (
      definition.cause !== undefined &&
      tokenForError(classifiedPrimary?.cause) !== definition.cause
    ) {
      violations.push(
        `cause ${tokenForError(classifiedPrimary?.cause)} != ${definition.cause}`,
      )
    }
    if (scenario.rollbackCalls.length !== definition.rollbackCount) {
      violations.push(
        `rollback count ${scenario.rollbackCalls.length} != ${definition.rollbackCount}`,
      )
    }
    if (scenario.closeCalls.length !== 1) {
      violations.push(`close count ${scenario.closeCalls.length} != 1`)
    }
    if (definition.poisoned) {
      await assertPoisoned(
        runtime,
        options,
        scenario,
        violations,
        definition.name,
      )
    } else {
      await assertFreshOpen(runtime, options, violations, definition.name)
    }
    return {
      error: serializeError(caught),
      name: definition.name,
      stateReads: scenario.stateReads,
      violations,
    }
  }

  async function runStateMatrix() {
    const primary = 'primary'
    const schema = 'legacy_schema_invalid'
    const invalidState = 'Bootstrap transaction state is invalid.'
    const badRollback = 'Bootstrap rollback did not end the transaction.'
    const badClose = 'Bootstrap close did not close the connection.'
    const postBeginFailure = {
      primaryLabel: primary,
      primaryMatch: 'prepare:SELECT type, name, tbl_name, sql',
    }
    const definitions = [
      {
        name: 'oracle-mismatch',
        scenario: { rowMismatch: true },
        tokens: [schema], rollbackCount: 0, poisoned: false,
      },
      {
        name: 'initial-active',
        scenario: {
          stateOverrides: {
            1: { openValue: true, transactionValue: true },
          },
        },
        tokens: [schema], rollbackCount: 0, poisoned: false,
      },
      {
        name: 'initial-getter-throw',
        scenario: { stateOverrides: { 1: { openThrow: 'initial-getter' } } },
        tokens: [schema], cause: 'initial-getter', rollbackCount: 0, poisoned: true,
      },
      {
        name: 'initial-nonboolean',
        scenario: { stateOverrides: { 1: { openValue: 'yes' } } },
        tokens: [schema], rollbackCount: 0, poisoned: true,
      },
      {
        name: 'begin-returned-inactive',
        scenario: {
          stateOverrides: {
            2: { openValue: true, transactionValue: false },
          },
        },
        tokens: [schema], rollbackCount: 0, poisoned: false,
      },
      {
        name: 'begin-returned-impossible',
        scenario: {
          stateOverrides: {
            2: { openValue: false, transactionValue: true },
          },
        },
        tokens: [schema, invalidState], rollbackCount: 0, poisoned: true,
      },
      {
        name: 'post-begin-transaction-getter-throw',
        scenario: {
          stateOverrides: {
            2: { openValue: true, transactionThrow: 'post-begin-getter' },
          },
        },
        tokens: [schema, 'post-begin-getter'], cause: 'post-begin-getter',
        rollbackCount: 0, poisoned: true,
      },
      {
        name: 'post-begin-transaction-nonboolean',
        scenario: {
          stateOverrides: {
            2: { openValue: true, transactionValue: 'active' },
          },
        },
        tokens: [schema, invalidState], rollbackCount: 0, poisoned: true,
      },
      {
        name: 'pre-commit-returned-inactive',
        scenario: {
          stateOverrides: {
            3: { openValue: true, transactionValue: false },
          },
        },
        tokens: [schema], rollbackCount: 0, poisoned: false,
      },
      {
        name: 'commit-returned-active',
        scenario: { commitMode: 'return-active' },
        tokens: [schema], rollbackCount: 1, poisoned: false,
      },
      {
        name: 'commit-returned-closed',
        scenario: {
          stateOverrides: {
            4: { openValue: false, transactionValue: false },
          },
        },
        tokens: [schema], rollbackCount: 0, poisoned: false,
      },
      {
        name: 'commit-throw-active',
        scenario: {
          controlThrow: { label: primary, sql: 'COMMIT', timing: 'before' },
        },
        tokens: [primary], rollbackCount: 1, poisoned: false,
      },
      {
        name: 'commit-throw-inactive',
        scenario: {
          controlThrow: { label: primary, sql: 'COMMIT', timing: 'after' },
        },
        tokens: [primary], rollbackCount: 0, poisoned: false,
      },
      {
        name: 'commit-throw-unreadable',
        scenario: {
          controlThrow: { label: primary, sql: 'COMMIT', timing: 'before' },
          stateOverrides: { 4: { openThrow: 'state-inspection' } },
        },
        tokens: [primary, 'state-inspection'], rollbackCount: 0, poisoned: true,
      },
      {
        name: 'commit-throw-nonboolean',
        scenario: {
          controlThrow: { label: primary, sql: 'COMMIT', timing: 'before' },
          stateOverrides: { 4: { openValue: 1 } },
        },
        tokens: [primary, invalidState], rollbackCount: 0, poisoned: true,
      },
      {
        name: 'post-stage-auto-rollback',
        scenario: {
          autoRollbackMatch: 'prepare:SELECT type, name, tbl_name, sql',
          primaryLabel: primary,
        },
        tokens: [primary], rollbackCount: 0, poisoned: false,
      },
      {
        name: 'rollback-command-throw',
        scenario: {
          ...postBeginFailure,
          rollbackThrow: 'rollback-cleanup',
        },
        tokens: [primary, 'rollback-cleanup'], rollbackCount: 1, poisoned: true,
      },
      {
        name: 'rollback-returned-closed',
        scenario: {
          ...postBeginFailure,
          stateOverrides: {
            4: { openValue: false, transactionValue: false },
          },
        },
        tokens: [primary, badRollback], rollbackCount: 1, poisoned: true,
      },
      {
        name: 'rollback-returned-active',
        scenario: {
          ...postBeginFailure,
          stateOverrides: {
            4: { openValue: true, transactionValue: true },
          },
        },
        tokens: [primary, badRollback], rollbackCount: 1, poisoned: true,
      },
      {
        name: 'rollback-proof-getter-throw',
        scenario: {
          ...postBeginFailure,
          stateOverrides: { 4: { openThrow: 'rollback-proof' } },
        },
        tokens: [primary, 'rollback-proof'], rollbackCount: 1, poisoned: true,
      },
      {
        name: 'close-command-throw',
        scenario: { ...postBeginFailure, closeThrow: 'close-cleanup' },
        tokens: [primary, 'close-cleanup'], rollbackCount: 1, poisoned: true,
      },
      {
        name: 'close-returned-open',
        scenario: { ...postBeginFailure, closeProof: { value: true } },
        tokens: [primary, badClose], rollbackCount: 1, poisoned: true,
      },
      {
        name: 'close-proof-getter-throw',
        scenario: {
          ...postBeginFailure,
          closeProof: { throw: 'close-proof' },
        },
        tokens: [primary, 'close-proof'], rollbackCount: 1, poisoned: true,
      },
      {
        name: 'inspection-and-close-order',
        scenario: {
          closeThrow: 'close-cleanup',
          controlThrow: { label: primary, sql: 'COMMIT', timing: 'before' },
          stateOverrides: { 4: { openThrow: 'state-inspection' } },
        },
        tokens: [primary, 'state-inspection', 'close-cleanup'],
        rollbackCount: 0, poisoned: true,
      },
      {
        name: 'rollback-and-close-order',
        scenario: {
          ...postBeginFailure,
          closeThrow: 'close-cleanup',
          rollbackThrow: 'rollback-cleanup',
        },
        tokens: [primary, 'rollback-cleanup', 'close-cleanup'],
        rollbackCount: 1, poisoned: true,
      },
    ]
    for (const stage of ['coordinator', 'router', 'registry-entry', 'handle']) {
      definitions.push({
        name: `post-commit-${stage}`,
        scenario: { constructionStage: stage, primaryLabel: stage },
        tokens: [stage], rollbackCount: 0, poisoned: false,
      })
    }
    definitions.push({
      name: 'post-commit-handle-close-failure',
      scenario: {
        closeThrow: 'close-cleanup',
        constructionStage: 'handle',
        primaryLabel: 'handle',
      },
      tokens: ['handle', 'close-cleanup'], rollbackCount: 0, poisoned: true,
    })

    const cases = []
    for (let index = 0; index < definitions.length; index += 1) {
      cases.push(await runOneFailureCase(definitions[index], index))
    }
    return {
      caseCount: cases.length,
      failures: cases.filter((entry) => entry.violations.length !== 0),
    }
  }

  async function runManagerCloseMatrix() {
    const violations = []
    const scenario = makeScenario({
      connectionAssigned: true,
      managerCloseFailures: [
        { label: 'close-alpha', pathPart: 'alpha.memory.sqlite' },
        { label: 'close-zeta', pathPart: 'zeta.memory.sqlite' },
      ],
    })
    activeScenario = scenario
    const store = await import(`${payload.storeUrl}?a2-manager-close`)
    const manager = store.createWorkspaceMemoryManager({
      memoryEnabled: true,
      memoryRootDir: payload.directory,
    })
    const zeta = await manager.forWorkspace('zeta')
    const alpha = await manager.forWorkspace('alpha')
    const middle = await manager.forWorkspace('middle')
    const nativeArrayIterator = Array.prototype[Symbol.iterator]
    Array.prototype[Symbol.iterator] = function poisonedArrayIterator() {
      throw new Error('manager AggregateError used live array iteration')
    }
    const closeA = manager.close()
    const closeB = manager.close()
    if (closeA !== closeB) violations.push('manager close promise identity changed')
    let caught
    try {
      await closeA
    } catch (error) {
      caught = error
    } finally {
      Array.prototype[Symbol.iterator] = nativeArrayIterator
    }
    const tokens = errorTokens(caught)
    if (JSON.stringify(tokens) !== JSON.stringify(['close-alpha', 'close-zeta'])) {
      violations.push(`manager error order ${JSON.stringify(tokens)}`)
    }
    const closeOrder = scenario.closeCalls
      .filter((path) => path.includes('.memory.sqlite'))
      .map((path) => path.slice(path.lastIndexOf('/') + 1))
    if (
      JSON.stringify(closeOrder) !==
      JSON.stringify(['alpha.memory.sqlite', 'middle.memory.sqlite', 'zeta.memory.sqlite'])
    ) violations.push(`manager close order ${JSON.stringify(closeOrder)}`)
    if (
      alpha.status().status !== 'closed' ||
      middle.status().status !== 'closed' ||
      zeta.status().status !== 'closed'
    ) violations.push('manager did not revoke every handle')
    try {
      await manager.forWorkspace('later')
      violations.push('manager accepted a workspace after failed close')
    } catch (error) {
      if (error?.code !== 'legacy_manager_closed') {
        violations.push(`manager closed precedence ${tokenForError(error)}`)
      }
    }
    for (const workspaceId of ['alpha', 'zeta']) {
      try {
        await store.deleteKernelStoreFile({
          memoryRootDir: payload.directory,
          workspaceId,
        })
        violations.push(`${workspaceId}: deletion followed failed close`)
      } catch (error) {
        if (error?.code !== 'legacy_store_open') {
          violations.push(`${workspaceId}: deletion returned ${tokenForError(error)}`)
        }
      }
    }
    try {
      await store.deleteKernelStoreFile({
        memoryRootDir: payload.directory,
        workspaceId: 'middle',
      })
    } catch (error) {
      violations.push(`middle: deletion after successful close failed: ${tokenForError(error)}`)
    }
    return { closeOrder, error: serializeError(caught), violations }
  }

  async function runManagerFailureAndRaceMatrix() {
    const violations = []
    const store = await import(`${payload.storeUrl}?a2-manager-races`)

    {
      const scenario = makeScenario({
        nativeOpenFailure: { label: 'manager-open-failure', used: false },
      })
      activeScenario = scenario
      const manager = store.createWorkspaceMemoryManager({
        memoryEnabled: true,
        memoryRootDir: payload.directory,
      })
      const first = manager.forWorkspace('open-failure')
      const second = manager.forWorkspace('open-failure')
      const settled = await Promise.allSettled([first, second])
      if (
        settled[0].status !== 'rejected' || settled[1].status !== 'rejected' ||
        settled[0].reason !== stableError('manager-open-failure') ||
        settled[1].reason !== stableError('manager-open-failure')
      ) violations.push('native-open failure identity did not reach every waiter')
      if (scenario.closeCalls.length !== 0) {
        violations.push('native-open rejection attempted native close')
      }
      const retryScenario = makeScenario()
      activeScenario = retryScenario
      const reopened = await manager.forWorkspace('open-failure')
      if (reopened.status().status !== 'enabled') {
        violations.push('native-open failure cache entry was not reopenable')
      }
      reopened.close()
      await manager.close()
    }

    {
      const scenario = makeScenario({
        publicationFailure: { label: 'publication-failure', used: false },
      })
      activeScenario = scenario
      const manager = store.createWorkspaceMemoryManager({
        memoryEnabled: true,
        memoryRootDir: payload.directory,
      })
      const first = manager.forWorkspace('publication-failure')
      const second = manager.forWorkspace('publication-failure')
      const settled = await Promise.allSettled([first, second])
      if (
        settled[0].status !== 'rejected' || settled[1].status !== 'rejected' ||
        settled[0].reason !== stableError('publication-failure') ||
        settled[1].reason !== stableError('publication-failure')
      ) violations.push('publication failure identity did not reach every waiter')
      if (scenario.closeCalls.length !== 1) {
        violations.push(`publication failure close count ${scenario.closeCalls.length}`)
      }
      const retryScenario = makeScenario()
      activeScenario = retryScenario
      const reopened = await manager.forWorkspace('publication-failure')
      if (reopened.status().status !== 'enabled') {
        violations.push('publication failure cache entry was not reopenable')
      }
      reopened.close()
      await manager.close()
    }

    async function runLateCase(definition) {
      const scenario = makeScenario(definition.scenario)
      if (definition.pause === 'realpath') {
        armPause(scenario, 'realpath', payload.directory)
      } else {
        armPause(scenario, 'publication', '')
        scenario.publicationPause = true
      }
      activeScenario = scenario
      const manager = store.createWorkspaceMemoryManager({
        memoryEnabled: true,
        memoryRootDir: payload.directory,
      })
      const first = manager.forWorkspace(definition.workspaceId)
      const second = manager.forWorkspace(definition.workspaceId)
      await scenario.pauseReached
      const closeA = manager.close()
      const closeB = manager.close()
      if (closeA !== closeB) {
        violations.push(`${definition.name}: close promise identity changed`)
      }
      try {
        await manager.forWorkspace('after-closing')
        violations.push(`${definition.name}: manager accepted during closing`)
      } catch (error) {
        if (error?.code !== 'legacy_manager_closed') {
          violations.push(`${definition.name}: closing precedence ${tokenForError(error)}`)
        }
      }
      scenario.releasePause()
      const waiters = await Promise.allSettled([first, second])
      let closeError
      try {
        await closeA
      } catch (error) {
        closeError = error
      }
      const expectedReason = definition.waiterLabel === 'legacy_manager_closed'
        ? null
        : stableError(definition.waiterLabel)
      for (const waiter of waiters) {
        if (waiter.status !== 'rejected') {
          violations.push(`${definition.name}: a late handle escaped`)
          continue
        }
        if (
          expectedReason === null
            ? waiter.reason?.code !== 'legacy_manager_closed'
            : waiter.reason !== expectedReason
        ) {
          violations.push(
            `${definition.name}: waiter reason ${tokenForError(waiter.reason)}`,
          )
        }
      }
      if (
        waiters[0].status === 'rejected' && waiters[1].status === 'rejected' &&
        waiters[0].reason !== waiters[1].reason
      ) violations.push(`${definition.name}: waiters did not share failure identity`)
      if (
        definition.closeLabel === null
          ? closeError !== undefined
          : closeError !== stableError(definition.closeLabel)
      ) violations.push(`${definition.name}: manager close settlement identity changed`)
      if (scenario.closeCalls.length !== definition.closeCount) {
        violations.push(
          `${definition.name}: native close count ${scenario.closeCalls.length}`,
        )
      }
      const fileOptions = {
        memoryEnabled: true,
        memoryRootDir: payload.directory,
        workspaceId: definition.workspaceId,
      }
      if (definition.poisoned) {
        const before = operationalRecords.length
        for (const operation of ['open', 'delete']) {
          try {
            if (operation === 'open') {
              await store.createKernelStore(fileOptions)
            } else {
              await store.deleteKernelStoreFile(fileOptions)
            }
            violations.push(`${definition.name}: poisoned ${operation} succeeded`)
          } catch (error) {
            if (error?.code !== 'legacy_store_open') {
              violations.push(
                `${definition.name}: poisoned ${operation} ${tokenForError(error)}`,
              )
            }
          }
        }
        if (operationalRecords.length !== before) {
          violations.push(`${definition.name}: poison reconstructed SQLite`)
        }
      } else {
        try {
          await store.deleteKernelStoreFile(fileOptions)
        } catch (error) {
          violations.push(`${definition.name}: cleanup delete ${tokenForError(error)}`)
        }
      }
    }

    await runLateCase({
      closeCount: 0,
      closeLabel: null,
      name: 'late-native-open-rejection',
      pause: 'realpath',
      poisoned: false,
      scenario: {
        nativeOpenFailure: { label: 'late-open-failure', used: false },
      },
      waiterLabel: 'late-open-failure',
      workspaceId: 'late-open-failure',
    })
    await runLateCase({
      closeCount: 1,
      closeLabel: null,
      name: 'late-successful-publication',
      pause: 'publication',
      poisoned: false,
      scenario: {},
      waiterLabel: 'legacy_manager_closed',
      workspaceId: 'late-publication-success',
    })
    await runLateCase({
      closeCount: 1,
      closeLabel: 'late-close-failure',
      name: 'late-publication-close-failure',
      pause: 'publication',
      poisoned: true,
      scenario: { closeThrow: 'late-close-failure' },
      waiterLabel: 'late-close-failure',
      workspaceId: 'late-publication-close-failure',
    })

    return { violations }
  }

  async function runDirectCloseAndAliasMatrix() {
    const violations = []
    const runtime = await importRuntime('direct-close-aliases')
    const realRoot = `${payload.directory}/real-root`
    const aliasRoot = `${payload.directory}/alias-root`
    await NativeFsPromises.mkdir(realRoot, { recursive: true })
    await NativeFsPromises.symlink(realRoot, aliasRoot, 'dir')

    {
      const scenario = makeScenario({ closeThrow: 'direct-close-failure' })
      activeScenario = scenario
      const options = {
        memoryEnabled: true,
        memoryRootDir: realRoot,
        workspaceId: 'poisoned-alias',
      }
      const base = await runtime.createKernelStoreRuntime(options)
      let firstCloseError
      try {
        base.close()
      } catch (error) {
        firstCloseError = error
      }
      if (firstCloseError !== stableError('direct-close-failure')) {
        violations.push('direct close failure identity changed')
      }
      if (base.close() !== undefined || scenario.closeCalls.length !== 1) {
        violations.push('failed direct close was not idempotently revoked')
      }
      if (base.status().status !== 'closed') {
        violations.push('failed direct close did not revoke the handle')
      }
      try {
        base.listMemories()
        violations.push('revoked handle remained readable')
      } catch (error) {
        if (error?.code !== 'legacy_store_closed') {
          violations.push(`revoked read returned ${tokenForError(error)}`)
        }
      }
      const originalCwd = process.cwd()
      const aliases = [
        {
          memoryEnabled: true,
          memoryRootDir: realRoot,
          workspaceId: 'poisoned-alias',
        },
        {
          memoryEnabled: true,
          memoryRootDir: aliasRoot,
          workspaceId: 'poisoned-alias',
        },
      ]
      process.chdir(payload.directory)
      aliases.push({
        memoryEnabled: true,
        memoryRootDir: 'alias-root',
        workspaceId: 'poisoned-alias',
      })
      const before = operationalRecords.length
      try {
        for (const alias of aliases) {
          for (const operation of ['open', 'delete']) {
            try {
              if (operation === 'open') {
                await runtime.createKernelStoreRuntime(alias)
              } else {
                await runtime.deleteKernelStoreRuntimeFile(alias)
              }
              violations.push(`poisoned alias ${operation} succeeded`)
            } catch (error) {
              if (error?.code !== 'legacy_store_open') {
                violations.push(`poisoned alias ${operation} ${tokenForError(error)}`)
              }
            }
          }
        }
      } finally {
        process.chdir(originalCwd)
      }
      if (operationalRecords.length !== before) {
        violations.push('poisoned alias reached native construction')
      }
      if (scenario.rmCalls.length !== 0) {
        violations.push('poisoned alias attempted filesystem removal')
      }
      try {
        await NativeFsPromises.access(base.dbPath)
      } catch {
        violations.push('failed direct close unlinked the live database')
      }
      scenario.enabled = false
    }

    {
      const scenario = makeScenario()
      activeScenario = scenario
      const options = {
        memoryEnabled: true,
        memoryRootDir: realRoot,
        workspaceId: 'close-once',
      }
      const base = await runtime.createKernelStoreRuntime(options)
      if (base.close() !== undefined || base.close() !== undefined) {
        violations.push('successful close did not remain idempotent')
      }
      if (scenario.closeCalls.length !== 1) {
        violations.push(`successful close count ${scenario.closeCalls.length}`)
      }
      try {
        await runtime.deleteKernelStoreRuntimeFile(options)
      } catch (error) {
        violations.push(`successful release remained blocked: ${tokenForError(error)}`)
      }
    }

    {
      const scenario = makeScenario()
      activeScenario = scenario
      const originalCwd = process.cwd()
      process.chdir(payload.directory)
      const relativeOptions = {
        memoryEnabled: true,
        memoryRootDir: 'alias-root',
        workspaceId: 'relative-alias',
      }
      const absoluteOptions = {
        memoryEnabled: true,
        memoryRootDir: realRoot,
        workspaceId: 'relative-alias',
      }
      try {
        const base = await runtime.createKernelStoreRuntime(relativeOptions)
        try {
          await runtime.deleteKernelStoreRuntimeFile(absoluteOptions)
          violations.push('absolute alias deleted a relative live handle')
        } catch (error) {
          if (error?.code !== 'legacy_store_open') {
            violations.push(`relative/absolute alias refusal ${tokenForError(error)}`)
          }
        }
        base.close()
        await runtime.deleteKernelStoreRuntimeFile(absoluteOptions)
      } finally {
        process.chdir(originalCwd)
      }
    }

    return { violations }
  }

  async function runDeletionAndQueueMatrix() {
    const violations = []
    const runtime = await importRuntime('deletion-queue')

    {
      const scenario = makeScenario()
      activeScenario = scenario
      const options = optionsFor('artifact-delete')
      const base = await runtime.createKernelStoreRuntime(options)
      const dbPath = base.dbPath
      base.close()
      const artifacts = [dbPath, `${dbPath}-wal`, `${dbPath}-shm`, `${dbPath}-journal`]
      for (let index = 1; index < artifacts.length; index += 1) {
        await NativeFsPromises.writeFile(artifacts[index], `artifact-${index}`)
      }
      const deleted = await runtime.deleteKernelStoreRuntimeFile(options)
      if (deleted.removed !== true || deleted.dbPath !== dbPath) {
        violations.push('artifact deletion returned a false success shape')
      }
      for (const artifact of artifacts) {
        try {
          await NativeFsPromises.access(artifact)
          violations.push(`artifact survived deletion: ${artifact}`)
        } catch (error) {
          if (error?.code !== 'ENOENT') throw error
        }
      }
      const fresh = await runtime.createKernelStoreRuntime(options)
      if (fresh.listMemories().length !== 0) {
        violations.push('fresh reopen after terminal deletion retained rows')
      }
      fresh.close()
      await runtime.deleteKernelStoreRuntimeFile(options)
    }

    {
      const scenario = makeScenario({
        rmFailure: { label: 'remove-failure', suffix: '-shm', used: false },
      })
      activeScenario = scenario
      const options = optionsFor('remove-failure')
      const base = await runtime.createKernelStoreRuntime(options)
      const dbPath = base.dbPath
      base.close()
      const artifacts = [dbPath, `${dbPath}-wal`, `${dbPath}-shm`, `${dbPath}-journal`]
      for (let index = 1; index < artifacts.length; index += 1) {
        await NativeFsPromises.writeFile(artifacts[index], `artifact-${index}`)
      }
      let caught
      let returned
      try {
        returned = await runtime.deleteKernelStoreRuntimeFile(options)
      } catch (error) {
        caught = error
      }
      if (caught !== stableError('remove-failure') || returned !== undefined) {
        violations.push(`removal failure identity/result ${tokenForError(caught)}`)
      }
      const firstCalls = scenario.rmCalls.slice()
      if (
        firstCalls.length !== 3 ||
        firstCalls[0] !== dbPath || firstCalls[1] !== `${dbPath}-wal` ||
        firstCalls[2] !== `${dbPath}-shm`
      ) violations.push(`removal failure order ${JSON.stringify(firstCalls)}`)
      for (const [artifact, shouldExist] of [
        [dbPath, false],
        [`${dbPath}-wal`, false],
        [`${dbPath}-shm`, true],
        [`${dbPath}-journal`, true],
      ]) {
        let present = true
        try {
          await NativeFsPromises.access(artifact)
        } catch (error) {
          if (error?.code !== 'ENOENT') throw error
          present = false
        }
        if (present !== shouldExist) {
          violations.push(`removal failure artifact state ${artifact}: ${present}`)
        }
      }
      await runtime.deleteKernelStoreRuntimeFile(options)
    }

    {
      const scenario = makeScenario()
      activeScenario = scenario
      const serializedOptions = optionsFor('serialized')
      const independentOptions = optionsFor('independent')
      const seed = await runtime.createKernelStoreRuntime(serializedOptions)
      seed.close()
      armPause(scenario, 'rm', 'serialized.memory.sqlite')
      const deletion = runtime.deleteKernelStoreRuntimeFile(serializedOptions)
      await scenario.pauseReached
      const samePathCreation = runtime.createKernelStoreRuntime(serializedOptions)
      let samePathSettled = false
      samePathCreation.then(
        () => { samePathSettled = true },
        () => { samePathSettled = true },
      )
      const independentCreation = runtime.createKernelStoreRuntime(independentOptions)
      let independentTimeout
      let independent
      try {
        independent = await Promise.race([
          independentCreation,
          new Promise((_, reject) => {
            independentTimeout = setTimeout(
              () => reject(new Error('independent path was blocked')),
              2_000,
            )
          }),
        ])
      } finally {
        clearTimeout(independentTimeout)
      }
      if (samePathSettled) {
        violations.push('same-path create escaped before deletion finished')
      }
      independent.close()
      scenario.releasePause()
      const deleted = await deletion
      const samePath = await samePathCreation
      if (deleted.removed !== true || samePath.status().status !== 'enabled') {
        violations.push('serialized delete/create settlement was invalid')
      }
      samePath.close()
      await runtime.deleteKernelStoreRuntimeFile(serializedOptions)
      await runtime.deleteKernelStoreRuntimeFile(independentOptions)
    }

    return { violations }
  }

  async function run() {
    if (payload.mode === 'operations') return runOperationalMatrix()
    if (payload.mode === 'states') return runStateMatrix()
    if (payload.mode === 'manager') return runManagerCloseMatrix()
    if (payload.mode === 'manager-races') return runManagerFailureAndRaceMatrix()
    if (payload.mode === 'direct-lifecycle') return runDirectCloseAndAliasMatrix()
    if (payload.mode === 'deletion-queue') return runDeletionAndQueueMatrix()
    throw new Error(`unknown instrumentation mode: ${payload.mode}`)
  }

  return run().finally(() => {
    for (const record of operationalRecords) {
      try {
        if (apply(nativeIsOpen, record.target, [])) {
          apply(nativeDbClose, record.target, [])
        }
      } catch {
        // Best-effort child cleanup after assertions are captured.
      }
    }
  })
}

function runA2Instrumentation(mode, directory, timeout = 120_000) {
  const payload = {
    directory,
    mode,
    runtimeUrl: new URL('../src/kernel-store-runtime.mjs', import.meta.url).href,
    storeUrl: new URL('../src/store.mjs', import.meta.url).href,
  }
  const source = `
    import { registerHooks } from 'node:module'
    import * as NativeFsPromises from 'node:fs/promises'
    import {
      DatabaseSync as NativeDatabaseSync,
      StatementSync as NativeStatementSync,
    } from 'node:sqlite'
    const payload = ${JSON.stringify(payload)}
    try {
      const result = await (${a2InstrumentationChildMain.toString()})(payload)
      process.stdout.write(JSON.stringify(result))
    } catch (error) {
      process.stderr.write(String(error && error.stack ? error.stack : error))
      process.exitCode = 1
    }
  `
  const child = spawnSync(
    process.execPath,
    ['--no-warnings', '--input-type=module', '--eval', source],
    { encoding: 'utf8', timeout },
  )
  assert.equal(
    child.status,
    0,
    `${mode} instrumentation child failed\nstdout:\n${child.stdout}\nstderr:\n${child.stderr}`,
  )
  return JSON.parse(child.stdout)
}

function seedHistoricalSchema(dbPath, history) {
  const db = new DatabaseSync(dbPath)
  const prefix = `CREATE TABLE memories (
      id TEXT PRIMARY KEY,
      palari_id TEXT NOT NULL,
      user_id TEXT,
      type TEXT NOT NULL CHECK (type IN (
        'relationship',
        'preference',
        'opinion',
        'entity',
        'life_event',
        'working',
        'project',
        'recent_life',
        'session_summary'
      )),
      content TEXT NOT NULL,
      keywords TEXT NOT NULL DEFAULT '',
      importance REAL NOT NULL DEFAULT 0.5,
      valid_from TEXT NOT NULL,
      valid_until TEXT,
      access_count INTEGER NOT NULL DEFAULT 0,
      last_accessed TEXT,
      created_at TEXT NOT NULL,
      shared INTEGER NOT NULL DEFAULT 0 CHECK (shared IN (0, 1)),
      confidence REAL NOT NULL DEFAULT 0.5,
      acquisition_mode TEXT NOT NULL DEFAULT 'direct' CHECK (acquisition_mode IN (
        'direct',
        'told_to_me',
        'extracted',
        'summarized'
      )),
      created_by_pipeline INTEGER NOT NULL DEFAULT 0 CHECK (created_by_pipeline IN (0, 1)),`
  const tails = {
    current: `      fictional INTEGER NOT NULL DEFAULT 0 CHECK (fictional IN (0, 1)),
      last_decayed_at TEXT,
      source_message_id TEXT,
      content_hash TEXT NOT NULL
    )`,
    post_fictional: `      fictional INTEGER NOT NULL DEFAULT 0 CHECK (fictional IN (0, 1)),
      source_message_id TEXT,
      content_hash TEXT NOT NULL
    )`,
    pre_fictional: `      source_message_id TEXT,
      content_hash TEXT NOT NULL
    )`,
  }
  db.exec(`
    CREATE TABLE memory_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
    ${prefix}
${tails[history]};
    CREATE INDEX memories_scope_idx
      ON memories (palari_id, user_id, shared, valid_until, type);
    CREATE INDEX memories_content_hash_idx
      ON memories (palari_id, content_hash);
    CREATE TABLE memory_links (
      id TEXT PRIMARY KEY,
      from_memory_id TEXT NOT NULL,
      to_memory_id TEXT NOT NULL,
      relation TEXT NOT NULL DEFAULT 'associated',
      created_at TEXT NOT NULL,
      FOREIGN KEY (from_memory_id) REFERENCES memories(id) ON DELETE CASCADE,
      FOREIGN KEY (to_memory_id) REFERENCES memories(id) ON DELETE CASCADE,
      CHECK (from_memory_id <> to_memory_id)
    );
    CREATE INDEX memory_links_from_idx ON memory_links (from_memory_id);
    CREATE INDEX memory_links_to_idx ON memory_links (to_memory_id);
    CREATE VIRTUAL TABLE memory_fts USING fts5(
      memory_id UNINDEXED,
      palari_id UNINDEXED,
      content,
      keywords,
      tokenize = 'unicode61 remove_diacritics 2'
    );
    CREATE TRIGGER memories_ai AFTER INSERT ON memories BEGIN
      INSERT INTO memory_fts(rowid, memory_id, palari_id, content, keywords)
      VALUES (new.rowid, new.id, new.palari_id, new.content, new.keywords);
    END;
    CREATE TRIGGER memories_ad AFTER DELETE ON memories BEGIN
      DELETE FROM memory_fts WHERE rowid = old.rowid;
    END;
    CREATE TRIGGER memories_au AFTER UPDATE OF content, keywords, palari_id ON memories BEGIN
      DELETE FROM memory_fts WHERE rowid = old.rowid;
      INSERT INTO memory_fts(rowid, memory_id, palari_id, content, keywords)
      VALUES (new.rowid, new.id, new.palari_id, new.content, new.keywords);
    END;
  `)
  if (history === 'pre_fictional') {
    db.exec('ALTER TABLE memories ADD COLUMN fictional INTEGER NOT NULL DEFAULT 0 CHECK (fictional IN (0, 1))')
  }
  if (history !== 'current') {
    db.exec('ALTER TABLE memories ADD COLUMN last_decayed_at TEXT')
  }
  db.exec('ALTER TABLE memories ADD COLUMN source_kind TEXT')
  db.exec('ALTER TABLE memories ADD COLUMN extractor TEXT')
  const migration = db.prepare(`
    INSERT INTO memory_migrations(id, applied_at) VALUES (?, ?)
  `)
  migration.run('CDX-M0', '2026-07-21T00:00:00.000Z')
  migration.run('CDX-M1', '2026-07-21T00:00:01.000Z')
  db.close()
}

test('M2-A2-04 runtime/store namespaces and immutable compatibility sets are exact', () => {
  assert.deepEqual(Object.keys(runtimeModule).sort(), [
    'acquisitionModes',
    'assertKernelStoreCapability',
    'createKernelStoreRuntime',
    'deleteKernelStoreRuntimeFile',
    'executeLegacyStoreIntent',
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
  assert.deepEqual(Object.keys(storeModule).sort(), [
    'acquisitionModes',
    'createKernelStore',
    'createWorkspaceMemoryManager',
    'deleteKernelStoreFile',
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
    'workspaceMemoryDbPath',
  ])

  assert.equal(memoryTypes instanceof Set, true)
  assert.equal(Object.isFrozen(memoryTypes), true)
  assert.deepEqual(Reflect.ownKeys(memoryTypes), [])
  assert.equal(memoryTypes.add, undefined)
  assert.equal('add' in memoryTypes, false)
  assert.throws(() => Set.prototype.add.call(memoryTypes, 'rogue'), TypeError)
  assert.equal(memoryTypes.has('preference'), true)
  assert.equal(memoryTypes.has('rogue'), false)
})

test('M2-A2-04 safe base is exact, read-only, branded, and projects canonical rows', async () => {
  const directory = await temporaryDirectory()
  const base = await openBase(directory)
  assert.equal(Object.isFrozen(base), true)
  assert.deepEqual(Reflect.ownKeys(base), [
    'close',
    'config',
    'dbPath',
    'enabled',
    'getMemoryById',
    'listMemories',
    'publicStatus',
    'recallMemories',
    'searchMemories',
    'status',
  ])
  for (const forbidden of [
    'db', 'initializeSchema', 'insertMemory', 'addMemory', 'supersedeMemory',
    'addMemoryLink', 'touchMemory', 'bumpImportance', 'deleteMemory',
  ]) assert.equal(forbidden in base, false)
  assert.equal(runtimeModule.assertKernelStoreCapability(base), base)
  assert.throws(
    () => runtimeModule.assertKernelStoreCapability({ ...base }),
    (error) => error.code === 'legacy_invalid_capability',
  )

  const gated = createGatedStore(base)
  const result = proposeFixture(gated)
  assert.equal(result.outcome, 'inserted')
  const first = base.getMemoryById(result.memory.id)
  const second = base.getMemoryById(result.memory.id)
  assert.deepEqual(Object.keys(first), CANONICAL_MEMORY_KEYS)
  assert.notEqual(first, second)
  first.content = 'caller-local mutation'
  assert.notEqual(base.getMemoryById(result.memory.id).content, first.content)
  gated.close()
  assert.equal(base.status().status, 'closed')
  assert.throws(
    () => base.getMemoryById(result.memory.id),
    (error) => error.code === 'legacy_store_closed',
  )
})

test('M2-A2-04 disabled base remains inert before and after close', async () => {
  const base = await createKernelStore({ memoryEnabled: false })
  const gated = createGatedStore(base)
  assert.deepEqual(Reflect.ownKeys(base), [
    'close', 'config', 'dbPath', 'enabled', 'getMemoryById', 'listMemories',
    'publicStatus', 'recallMemories', 'searchMemories', 'status',
  ])
  assert.equal(base.dbPath, null)
  assert.equal(base.enabled, false)
  assert.equal(base.getMemoryById(new Proxy({}, {})), null)
  assert.deepEqual(base.listMemories(new Proxy({}, {})), [])
  assert.deepEqual(gated.deleteMemory(new Proxy({}, {})), {
    deleted: false,
    reason: 'memory_disabled',
  })
  base.close()
  assert.equal(base.status().status, 'closed')
  assert.deepEqual(base.recallMemories(new Proxy({}, {})), {
    directCount: 0,
    keywords: [],
    latencyMs: 0,
    memories: [],
    totalCandidates: 0,
  })
  assert.deepEqual(gated.topicForget(new Proxy({}, {})), {
    count: 0,
    deleted: [],
  })
})

test('M2-A2-04 recall validates time before SQLite but skips it for empty scope', async () => {
  const directory = await temporaryDirectory()
  const base = await openBase(directory)
  let inspected = 0
  const empty = base.recallMemories('anything', {
    palariId: '',
    get now() {
      inspected += 1
      throw new Error('must not inspect empty-scope now')
    },
  })
  assert.equal(inspected, 0)
  assert.equal(empty.totalCandidates, 0)
  assert.throws(
    () => base.recallMemories('anything', {
      now: 'not-a-date',
      palariId: 'palari-a',
    }),
    (error) => error instanceof RangeError && error.message === 'Invalid time value',
  )
  base.close()
})

test('M2-A2-06 terminal deletion refuses live handles and removes after close', async () => {
  const directory = await temporaryDirectory()
  const options = {
    memoryEnabled: true,
    memoryRootDir: directory,
    workspaceId: 'terminal-delete',
  }
  const base = await createKernelStore(options)
  assert.equal(await exists(base.dbPath), true)
  await assert.rejects(
    deleteKernelStoreFile(options),
    (error) => error.code === 'legacy_store_open',
  )
  base.close()
  const deleted = await deleteKernelStoreFile(options)
  assert.deepEqual(Object.keys(deleted), ['dbPath', 'removed'])
  assert.equal(deleted.removed, true)
  assert.equal(await exists(deleted.dbPath), false)
})

test('M2-A2-06 direct create and delete reject proxies without invoking traps', async () => {
  let trapCalls = 0
  const options = new Proxy({}, {
    get() {
      trapCalls += 1
      throw new Error('proxy option trap must remain unreachable')
    },
  })
  await assert.rejects(
    createKernelStore(options),
    (error) => error.code === 'legacy_path_invalid',
  )
  await assert.rejects(
    deleteKernelStoreFile(options),
    (error) => error.code === 'legacy_path_invalid',
  )
  assert.equal(trapCalls, 0)
})

test('M2-A2-06 directory symlink aliases share canonical path and live count', async () => {
  const directory = await temporaryDirectory()
  const realRoot = join(directory, 'real')
  const aliasRoot = join(directory, 'alias')
  const seed = await openBase(realRoot, 'seed-directory')
  seed.close()
  await symlink(realRoot, aliasRoot, 'dir')

  const alias = await createKernelStore({
    memoryEnabled: true,
    memoryRootDir: aliasRoot,
    workspaceId: 'same-path',
  })
  assert.equal(alias.dbPath, join(realRoot, 'same-path.memory.sqlite'))
  await assert.rejects(
    deleteKernelStoreFile({
      memoryRootDir: realRoot,
      workspaceId: 'same-path',
    }),
    (error) => error.code === 'legacy_store_open',
  )
  alias.close()
  await deleteKernelStoreFile({
    memoryRootDir: aliasRoot,
    workspaceId: 'same-path',
  })
})

test('M2-A2-06 direct opens are distinct and deletion waits for every handle', async () => {
  const directory = await temporaryDirectory()
  const options = {
    memoryEnabled: true,
    memoryRootDir: directory,
    workspaceId: 'two-direct-handles',
  }
  const [first, second] = await Promise.all([
    createKernelStore(options),
    createKernelStore(options),
  ])
  assert.notEqual(first, second)
  assert.equal(first.dbPath, second.dbPath)
  first.close()
  await assert.rejects(
    deleteKernelStoreFile(options),
    (error) => error.code === 'legacy_store_open',
  )
  second.close()
  const [deletedFirst, deletedSecond] = await Promise.all([
    deleteKernelStoreFile(options),
    deleteKernelStoreFile(options),
  ])
  assert.equal(deletedFirst.removed, true)
  assert.equal(deletedSecond.removed, true)
})

test('M2-A2-06 an existing main-file symlink is rejected before native open', async () => {
  const directory = await temporaryDirectory()
  const targetPath = join(directory, 'target.sqlite')
  const target = new DatabaseSync(targetPath)
  target.close()
  const linkedPath = join(directory, 'linked.memory.sqlite')
  await symlink(targetPath, linkedPath, 'file')
  await assert.rejects(
    createKernelStore({
      memoryEnabled: true,
      memoryRootDir: directory,
      workspaceId: 'linked',
    }),
    (error) => error.code === 'legacy_path_invalid',
  )
})

test('M2-A2-04 unknown persisted trigger fails the runtime manifest', async () => {
  const directory = await temporaryDirectory()
  const base = await openBase(directory, 'invalid-trigger')
  const dbPath = base.dbPath
  base.close()

  const db = new DatabaseSync(dbPath)
  db.exec(`
    CREATE TABLE unrelated(value TEXT);
    CREATE TRIGGER unknown_runtime_trigger
    AFTER INSERT ON unrelated BEGIN
      SELECT 1;
    END;
  `)
  db.close()

  await assert.rejects(
    openBase(directory, 'invalid-trigger'),
    (error) => error.code === 'legacy_schema_invalid',
  )
  const deleted = await deleteKernelStoreFile({
    memoryRootDir: directory,
    workspaceId: 'invalid-trigger',
  })
  assert.equal(deleted.removed, true, 'failed bootstrap closed its native handle')
})

test('M2-A2-04 all three historical memories column orders migrate and project identically', async () => {
  const directory = await temporaryDirectory()
  const histories = [
    ['current', [
      'created_by_pipeline', 'fictional', 'last_decayed_at',
      'source_message_id', 'content_hash', 'source_kind', 'extractor',
    ]],
    ['post-fictional', [
      'created_by_pipeline', 'fictional', 'source_message_id', 'content_hash',
      'last_decayed_at', 'source_kind', 'extractor',
    ]],
    ['pre-fictional', [
      'created_by_pipeline', 'source_message_id', 'content_hash', 'fictional',
      'last_decayed_at', 'source_kind', 'extractor',
    ]],
  ]
  for (let index = 0; index < histories.length; index += 1) {
    const [workspaceId, expectedTail] = histories[index]
    seedHistoricalSchema(
      join(directory, `${workspaceId}.memory.sqlite`),
      workspaceId === 'current' ? 'current' : workspaceId.replace('-', '_'),
    )
    const base = await openBase(directory, workspaceId)
    assert.deepEqual(base.listMemories({ palariId: 'palari-a' }), [])
    const dbPath = base.dbPath
    base.close()
    const inspection = new DatabaseSync(dbPath)
    const names = inspection.prepare('PRAGMA table_xinfo(memories)').all()
      .map((row) => row.name)
    inspection.close()
    assert.deepEqual(names.slice(15), expectedTail)
  }
})

test('M2-A2-04 manifest rejects external-to-CDX and CDX-to-unrelated foreign keys', async () => {
  const directory = await temporaryDirectory()

  const external = await openBase(directory, 'external-fk')
  const externalPath = external.dbPath
  external.close()
  const externalDb = new DatabaseSync(externalPath)
  externalDb.exec(`
    CREATE TABLE external_reference(
      memory_id TEXT REFERENCES memories(id)
    )
  `)
  externalDb.close()
  await assert.rejects(
    openBase(directory, 'external-fk'),
    (error) => error.code === 'legacy_schema_invalid',
  )

  const cdx = await openBase(directory, 'cdx-fk')
  const cdxPath = cdx.dbPath
  cdx.close()
  const cdxDb = new DatabaseSync(cdxPath)
  cdxDb.exec(`
    PRAGMA foreign_keys = OFF;
    CREATE TABLE unrelated_migration(id TEXT PRIMARY KEY);
    INSERT INTO unrelated_migration(id) VALUES ('CDX-M0'), ('CDX-M1');
    DROP TABLE memory_migrations;
    CREATE TABLE memory_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL,
      FOREIGN KEY (id) REFERENCES unrelated_migration(id)
    );
    INSERT INTO memory_migrations(id, applied_at) VALUES
      ('CDX-M0', '2026-07-21T00:00:00.000Z'),
      ('CDX-M1', '2026-07-21T00:00:01.000Z');
  `)
  cdxDb.close()
  await assert.rejects(
    openBase(directory, 'cdx-fk'),
    (error) => error.code === 'legacy_schema_invalid',
  )
})

test('M2-A2-04 row oracle rejects unsafe access counts but permits mismatching hashes', async () => {
  const directory = await temporaryDirectory()
  const base = await openBase(directory, 'row-oracle')
  const gated = createGatedStore(base)
  const applied = proposeFixture(gated, { content_hash: 'caller-mismatch' })
  assert.equal(applied.memory.content_hash, 'caller-mismatch')
  const dbPath = base.dbPath
  gated.close()

  const accepted = await openBase(directory, 'row-oracle')
  assert.equal(accepted.getMemoryById(applied.memory.id).content_hash, 'caller-mismatch')
  accepted.close()

  const raw = new DatabaseSync(dbPath)
  raw.exec('PRAGMA ignore_check_constraints = ON')
  raw.prepare('UPDATE memories SET access_count = -1 WHERE id = ?')
    .run(applied.memory.id)
  raw.close()
  await assert.rejects(
    openBase(directory, 'row-oracle'),
    (error) => error.code === 'legacy_schema_invalid',
  )
})

test('M2-A2-05 manager single-flights gated handles and closes once', async () => {
  const directory = await temporaryDirectory()
  const manager = createWorkspaceMemoryManager({
    memoryEnabled: true,
    memoryRootDir: directory,
  })
  assert.equal(Object.isFrozen(manager), true)
  assert.deepEqual(Reflect.ownKeys(manager), [
    'close', 'config', 'forWorkspace', 'publicStatus',
  ])
  const [first, second] = await Promise.all([
    manager.forWorkspace('shared'),
    manager.forWorkspace('shared'),
  ])
  assert.equal(first, second)
  assert.equal(typeof first.propose, 'function')
  const closeA = manager.close()
  const closeB = manager.close()
  assert.equal(closeA, closeB)
  await closeA
  assert.equal(first.status().status, 'closed')
  await assert.rejects(
    manager.forWorkspace('later'),
    (error) => error.code === 'legacy_manager_closed',
  )
})

test('M2-A2-05 manager close wins an in-flight creation and revokes it before exposure', async () => {
  const directory = await temporaryDirectory()
  const manager = createWorkspaceMemoryManager({
    memoryEnabled: true,
    memoryRootDir: directory,
  })
  const flight = manager.forWorkspace('close-race')
  const closing = manager.close()
  await assert.rejects(
    flight,
    (error) => error.code === 'legacy_manager_closed',
  )
  await closing
  await deleteKernelStoreFile({
    memoryRootDir: directory,
    workspaceId: 'close-race',
  })
})

test('M2-A2-04 post-import prototype poisoning cannot redirect native/read dispatch', async () => {
  const directory = await temporaryDirectory('brain-a2-poison-')
  const storeUrl = new URL('../src/store.mjs', import.meta.url).href
  const gateUrl = new URL('../src/gate.mjs', import.meta.url).href
  const routerUrl = new URL('../src/legacy-mutation-router.mjs', import.meta.url).href
  const source = `
    const storeModule = await import(${JSON.stringify(storeUrl)})
    const gateModule = await import(${JSON.stringify(gateUrl)})
    const routerModule = await import(${JSON.stringify(routerUrl)})
    const sqliteModule = await import('node:sqlite')
    const { syncBuiltinESMExports } = await import('node:module')
    const pathModule = (await import('node:path')).default
    const poison = function poison() { throw new Error('poisoned prototype dispatch') }
    for (const name of ['push','join','map','slice','sort']) Array.prototype[name] = poison
    for (const name of ['add','has','forEach','values']) Set.prototype[name] = poison
    Set.prototype[Symbol.iterator] = poison
    for (const name of ['forEach','get','set','values']) Map.prototype[name] = poison
    for (const name of ['replace','startsWith','endsWith','trim','split','normalize','toLowerCase','charCodeAt','slice']) {
      String.prototype[name] = poison
    }
    for (const name of ['close','exec','prepare']) sqliteModule.DatabaseSync.prototype[name] = poison
    for (const name of ['all','get','run','setReadBigInts','setReturnArrays']) {
      sqliteModule.StatementSync.prototype[name] = poison
    }
    for (const name of ['id','rank','rpath','via_memory_id','via_relation','activationScore']) {
      Object.defineProperty(Object.prototype, name, {
        configurable: true,
        set: poison,
      })
    }
    for (const name of ['basename','dirname','resolve']) pathModule[name] = poison
    syncBuiltinESMExports()
    globalThis.Map = poison
    globalThis.Promise = poison
    globalThis.Boolean = poison
    Array.prototype[Symbol.iterator] = poison
    Object.defineProperty(routerModule.LegacyMutationError, Symbol.hasInstance, {
      configurable: true,
      value() { return true },
    })
    try {
      const options = {
        clock: () => new Date('2026-07-21T12:00:00.000Z'),
        memoryEnabled: true,
        memoryRootDir: process.argv[1],
        workspaceId: 'poisoned runtime',
      }
      const base = await storeModule.createKernelStore(options)
      const gated = gateModule.createGatedStore(base)
      const applied = gated.propose({
        kind: 'permanent',
        provenance: { sourceKind: 'user_message', writer: 'explicit_user_action' },
        record: {
          confidence: 0.9,
          content: 'Captured dispatch survives prototype poisoning.',
          keywords: ['captured', 'dispatch'],
          palari_id: 'palari-a',
          type: 'preference',
          user_id: 'user-a',
        },
      })
      const row = base.getMemoryById(applied.memory.id)
      const hits = base.searchMemories('captured', { palariId: 'palari-a', userId: 'user-a' })
      const recalled = base.recallMemories('captured', {
        now: '2026-07-22T12:00:00.000Z',
        palariId: 'palari-a',
        userId: 'user-a',
      })
      if (!row || hits.length !== 1 || recalled.memories.length !== 1) {
        throw new Error('poisoned-dispatch result mismatch')
      }
      gated.close()
      process.stdout.write('PASS')
    } catch (error) {
      process.stderr.write(String(error && error.stack ? error.stack : error))
      process.exitCode = 1
    }
  `
  const child = spawnSync(
    process.execPath,
    ['--no-warnings', '--input-type=module', '--eval', source, directory],
    { encoding: 'utf8', timeout: 30_000 },
  )
  assert.equal(
    child.status,
    0,
    `poisoning child failed\nstdout:\n${child.stdout}\nstderr:\n${child.stderr}`,
  )
  assert.equal(child.stdout, 'PASS')
})

test('M2-A2-04 every captured post-open bootstrap operation fails closed and is reusable', async () => {
  const directory = await temporaryDirectory('brain-a2-bootstrap-operations-')
  const result = runA2Instrumentation('operations', directory)
  assert.equal(result.operationCount >= 50, true)
  assert.deepEqual(result.violations, [])
})

test('M2-A2-04 bootstrap state, cleanup, poison, and post-commit construction matrix is exact', async () => {
  const directory = await temporaryDirectory('brain-a2-bootstrap-states-')
  const result = runA2Instrumentation('states', directory)
  assert.equal(result.caseCount, 30)
  assert.deepEqual(result.failures, [])
})

test('M2-A2-05 manager aggregates native close failures in normalized workspace order', async () => {
  const directory = await temporaryDirectory('brain-a2-manager-close-')
  const result = runA2Instrumentation('manager', directory)
  assert.deepEqual(result.closeOrder, [
    'alpha.memory.sqlite',
    'middle.memory.sqlite',
    'zeta.memory.sqlite',
  ])
  assert.deepEqual(result.error.errors, ['close-alpha', 'close-zeta'])
  assert.deepEqual(result.violations, [])
})

test('M2-A2-05 manager evicts failed flights and linearizes every close race', async () => {
  const directory = await temporaryDirectory('brain-a2-manager-races-')
  const result = runA2Instrumentation('manager-races', directory)
  assert.deepEqual(result.violations, [])
})

test('M2-A2-05 manager publishes its flight before reentrant workspace coercion', async () => {
  const directory = await temporaryDirectory('brain-a2-manager-reentrant-')
  const manager = createWorkspaceMemoryManager({
    memoryEnabled: true,
    memoryRootDir: directory,
  })
  let nestedFlight
  let reentered = false
  let signalReentry
  const reentry = new Promise((resolve) => {
    signalReentry = resolve
  })
  const workspaceValue = {
    toString() {
      if (!reentered) {
        reentered = true
        nestedFlight = manager.forWorkspace('same workspace')
        signalReentry()
      }
      return 'same workspace'
    },
  }

  let outerHandle
  let nestedHandle
  try {
    const outerFlight = manager.forWorkspace(workspaceValue)
    await reentry
    ;[outerHandle, nestedHandle] = await Promise.all([
      outerFlight,
      nestedFlight,
    ])
    assert.equal(outerHandle, nestedHandle)
    await manager.close()
    assert.equal(outerHandle.status().status, 'closed')
    await deleteKernelStoreFile({
      memoryRootDir: directory,
      workspaceId: 'same workspace',
    })
  } finally {
    try {
      outerHandle?.close()
    } finally {
      if (nestedHandle !== outerHandle) nestedHandle?.close()
      await manager.close().catch(() => undefined)
    }
  }
})

test('M2-A2-05 manager snapshots its path once and detaches later mutable changes', async () => {
  const firstDirectory = await temporaryDirectory('brain-a2-manager-path-first-')
  const secondDirectory = await temporaryDirectory('brain-a2-manager-path-second-')
  let currentDirectory = firstDirectory
  let coercions = 0
  const rootValue = {
    toString() {
      coercions += 1
      return currentDirectory
    },
  }
  const manager = createWorkspaceMemoryManager({
    memoryEnabled: true,
    memoryRootDir: rootValue,
  })
  assert.equal(coercions, 1)

  const first = await manager.forWorkspace('detached path')
  const firstPath = first.dbPath
  first.close()
  currentDirectory = secondDirectory
  const reopened = await manager.forWorkspace('detached path')
  assert.equal(reopened.dbPath, firstPath)
  assert.equal(reopened.dbPath.startsWith(firstDirectory), true)
  assert.equal(reopened.dbPath.startsWith(secondDirectory), false)
  assert.equal(coercions, 1)
  await manager.close()
  await deleteKernelStoreFile({
    memoryRootDir: firstDirectory,
    workspaceId: 'detached path',
  })
})

test('M2-A2-05 manager snapshots only the selected lazy path branch', async () => {
  const directory = await temporaryDirectory('brain-a2-manager-path-branch-')
  const storeUrl = new URL('../src/store.mjs', import.meta.url).href
  const source = `
    const store = await import(${JSON.stringify(storeUrl)})
    const { mkdir } = await import('node:fs/promises')
    const { join, resolve } = await import('node:path')
    let rootCalls = 0
    let stateCalls = 0
    const root = {
      toString() {
        rootCalls += 1
        return ''
      },
    }
    const statePath = {
      toString() {
        stateCalls += 1
        throw new Error('unused statePath coercion')
      },
    }
    const manager = store.createWorkspaceMemoryManager({
      memoryEnabled: true,
      memoryRootDir: root,
      statePath,
    })
    const handle = await manager.forWorkspace('same workspace')
    const expected = resolve('same-workspace.memory.sqlite')
    if (handle.dbPath !== expected || rootCalls !== 1 || stateCalls !== 0) {
      throw new Error(JSON.stringify({
        actual: handle.dbPath,
        expected,
        rootCalls,
        stateCalls,
      }))
    }
    await manager.close()

    const firstDirectory = resolve('first-cwd')
    const secondDirectory = resolve('second-cwd')
    await mkdir(firstDirectory)
    await mkdir(secondDirectory)
    process.chdir(firstDirectory)
    const relativeManager = store.createWorkspaceMemoryManager({
      memoryEnabled: true,
      memoryRootDir: 'relative-root',
    })
    const first = await relativeManager.forWorkspace('relative workspace')
    const firstPath = first.dbPath
    first.close()
    process.chdir(secondDirectory)
    const reopened = await relativeManager.forWorkspace('relative workspace')
    if (
      reopened.dbPath !== firstPath ||
      reopened.dbPath !== join(firstDirectory, 'relative-root', 'relative-workspace.memory.sqlite')
    ) {
      throw new Error(JSON.stringify({
        firstPath,
        reopenedPath: reopened.dbPath,
      }))
    }
    await relativeManager.close()
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
    `path-branch child failed\nstdout:\n${child.stdout}\nstderr:\n${child.stderr}`,
  )
  assert.equal(child.stdout, 'PASS')

  let unusedPathCoercions = 0
  const unusedPath = {
    toString() {
      unusedPathCoercions += 1
      throw new Error('disabled manager path must stay untouched')
    },
  }
  for (const managerOptions of [
    { memoryEnabled: false },
    { memoryEnabled: true, publicDemo: true },
  ]) {
    const manager = createWorkspaceMemoryManager({
      ...managerOptions,
      memoryRootDir: unusedPath,
      statePath: unusedPath,
    })
    const gated = await manager.forWorkspace('disabled path')
    assert.equal(gated.enabled, false)
    await manager.close()
  }
  assert.equal(unusedPathCoercions, 0)
})

test('M2-A2-06 direct close is release-once and poison closes every canonical alias', async () => {
  const directory = await temporaryDirectory('brain-a2-close-aliases-')
  const result = runA2Instrumentation('direct-lifecycle', directory)
  assert.deepEqual(result.violations, [])
})

test('M2-A2-06 deletion owns four artifacts, preserves native failure, and serializes by path', async () => {
  const directory = await temporaryDirectory('brain-a2-deletion-queue-')
  const result = runA2Instrumentation('deletion-queue', directory)
  assert.deepEqual(result.violations, [])
})

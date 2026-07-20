import { mkdtempSync, rmSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  DatabaseSync as NativeDatabaseSync,
  StatementSync as NativeStatementSync,
} from 'node:sqlite'

const trace = []
const databaseTargets = new WeakMap()
const statementTargets = new WeakMap()
let accessorPoisonEnabled = false
let currentAccessorCase
let beforeExecHook
let beforePrepareHook
let afterExecHook
let afterConstructHook
let beforeCloseHook

function sqliteOperationName(key) {
  return typeof key === 'symbol' ? String(key) : key
}

function callableOwnOperationNames(prototype) {
  const operations = []
  for (const key of Reflect.ownKeys(prototype)) {
    if (key === 'constructor') continue
    const descriptor = Object.getOwnPropertyDescriptor(prototype, key)
    if (descriptor !== undefined && typeof descriptor.value === 'function') {
      operations.push(sqliteOperationName(key))
    }
  }
  return operations
}

function nativeOwnAccessorEntries(value) {
  const entries = []
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor !== undefined && typeof descriptor.get === 'function') {
      entries.push({
        key,
        operation: `get:${sqliteOperationName(key)}`,
        descriptor,
        getter: descriptor.get,
      })
    }
  }
  return entries
}

const nativeDatabaseMethodEntries = []
for (const key of Reflect.ownKeys(NativeDatabaseSync.prototype)) {
  if (key === 'constructor') continue
  const descriptor = Object.getOwnPropertyDescriptor(
    NativeDatabaseSync.prototype,
    key,
  )
  if (descriptor === undefined || typeof descriptor.value !== 'function') {
    continue
  }
  nativeDatabaseMethodEntries.push({
    key,
    operation: sqliteOperationName(key),
    descriptor,
    method: descriptor.value,
  })
}

function requireNativeDatabaseMethod(key) {
  const entry = nativeDatabaseMethodEntries.find((candidate) =>
    candidate.key === key)
  if (entry === undefined) {
    throw new Error(`Missing native DatabaseSync method: ${String(key)}`)
  }
  return entry.method
}

const nativeStatementMethodEntries = []
for (const key of Reflect.ownKeys(NativeStatementSync.prototype)) {
  if (key === 'constructor') continue
  const descriptor = Object.getOwnPropertyDescriptor(
    NativeStatementSync.prototype,
    key,
  )
  if (descriptor === undefined || typeof descriptor.value !== 'function') {
    continue
  }
  nativeStatementMethodEntries.push({
    key,
    operation: sqliteOperationName(key),
    descriptor,
    method: descriptor.value,
  })
}

function requireNativeStatementMethod(key) {
  const entry = nativeStatementMethodEntries.find((candidate) =>
    candidate.key === key)
  if (entry === undefined) {
    throw new Error(`Missing native StatementSync method: ${String(key)}`)
  }
  return entry.method
}

const nativeDatabaseExec = requireNativeDatabaseMethod('exec')
const nativeDatabasePrepare = requireNativeDatabaseMethod('prepare')
const nativeDatabaseClose = requireNativeDatabaseMethod('close')
const nativeStatementGet = requireNativeStatementMethod('get')
const nativeStatementAll = requireNativeStatementMethod('all')

const nativeDatabaseAccessorProbe = new NativeDatabaseSync(':memory:', {
  open: false,
})
const nativeDatabaseAccessorEntries = nativeOwnAccessorEntries(
  nativeDatabaseAccessorProbe,
)
const nativeStatementAccessorProbeDatabase = new NativeDatabaseSync(':memory:')
const nativeStatementAccessorProbe = Reflect.apply(
  nativeDatabasePrepare,
  nativeStatementAccessorProbeDatabase,
  ['SELECT 1'],
)
const nativeStatementAccessorEntries = nativeOwnAccessorEntries(
  nativeStatementAccessorProbe,
)
Reflect.apply(nativeDatabaseClose, nativeStatementAccessorProbeDatabase, [])

function requireNativeDatabaseAccessor(key) {
  const entry = nativeDatabaseAccessorEntries.find((candidate) =>
    candidate.key === key)
  if (entry === undefined) {
    throw new Error(`Missing native DatabaseSync accessor: ${String(key)}`)
  }
  return entry.getter
}

const nativeDatabaseIsTransaction = requireNativeDatabaseAccessor(
  'isTransaction',
)
const nativeDatabaseIsOpen = requireNativeDatabaseAccessor('isOpen')

function unwrapDatabase(value) {
  return databaseTargets.get(value) ?? value
}

function unwrapStatement(value) {
  return statementTargets.get(value) ?? value
}

function recordDynamicDatabaseAccessor(operation) {
  if (currentAccessorCase !== undefined) {
    currentAccessorCase.dynamicDatabaseAccessorCallCount += 1
    currentAccessorCase.dynamicDatabaseAccessorOperations.push(operation)
  }
  throw new Error(`dynamic verifier database accessor poison ran: ${operation}`)
}

function recordDynamicStatementAccessor(operation) {
  if (currentAccessorCase !== undefined) {
    currentAccessorCase.dynamicStatementAccessorCallCount += 1
    currentAccessorCase.dynamicStatementAccessorOperations.push(operation)
  }
  throw new Error(`dynamic verifier statement accessor poison ran: ${operation}`)
}

function wrapDatabase(target) {
  const proxy = new Proxy(target, {
    get(nativeTarget, key, receiver) {
      const accessor = nativeDatabaseAccessorEntries.find((candidate) =>
        candidate.key === key)
      if (accessor !== undefined) {
        if (accessorPoisonEnabled) {
          return recordDynamicDatabaseAccessor(accessor.operation)
        }
        return Reflect.apply(accessor.getter, nativeTarget, [])
      }
      return Reflect.get(nativeTarget, key, receiver)
    },
  })
  databaseTargets.set(proxy, target)
  return proxy
}

class InstrumentedStatementSync {}

function wrapStatement(target) {
  const wrapper = Object.create(InstrumentedStatementSync.prototype)
  statementTargets.set(wrapper, target)
  for (const { key, operation, descriptor, getter } of nativeStatementAccessorEntries) {
    Object.defineProperty(wrapper, key, {
      ...descriptor,
      get() {
        if (accessorPoisonEnabled) {
          return recordDynamicStatementAccessor(operation)
        }
        return Reflect.apply(getter, target, [])
      },
    })
  }
  return wrapper
}

class InstrumentedDatabaseSync extends NativeDatabaseSync {
  constructor(...args) {
    trace.push({ operation: 'construct', args })
    super(...args)
    if (afterConstructHook !== undefined) {
      afterConstructHook({ target: this, args })
    }
    if (args[1]?.open === false) {
      const probe = {}
      for (const {
        key,
        operation,
        descriptor,
        getter,
      } of nativeDatabaseAccessorEntries) {
        Object.defineProperty(probe, key, {
          ...descriptor,
          get() {
            trace.push({
              kind: 'database-accessor',
              operation,
              dispatch: 'captured',
            })
            return Reflect.apply(getter, unwrapDatabase(this), [])
          },
        })
      }
      return probe
    }
    return wrapDatabase(this)
  }
}

for (const { key, operation, descriptor, method } of nativeDatabaseMethodEntries) {
  Object.defineProperty(InstrumentedDatabaseSync.prototype, key, {
    ...descriptor,
    value(...args) {
      if (operation === 'exec' || operation === 'prepare') {
        trace.push({ operation, sql: args[0] })
      } else if (args.length === 0) {
        trace.push({ operation })
      } else {
        trace.push({ operation, argumentCount: args.length })
      }
      const nativeTarget = unwrapDatabase(this)
      if (operation === 'exec' && beforeExecHook !== undefined) {
        beforeExecHook({ target: nativeTarget, sql: args[0] })
      }
      if (operation === 'prepare' && beforePrepareHook !== undefined) {
        beforePrepareHook({ target: nativeTarget, sql: args[0] })
      }
      if (operation === 'close' && beforeCloseHook !== undefined) {
        beforeCloseHook({ target: nativeTarget })
      }
      const result = Reflect.apply(method, nativeTarget, args)
      if (operation === 'exec' && afterExecHook !== undefined) {
        afterExecHook({ target: nativeTarget, sql: args[0] })
      }
      return operation === 'prepare' ? wrapStatement(result) : result
    },
  })
}

for (const { key, operation, descriptor, method } of nativeStatementMethodEntries) {
  Object.defineProperty(InstrumentedStatementSync.prototype, key, {
    ...descriptor,
    value(...args) {
      if (operation === 'setReadBigInts' || operation === 'setReturnArrays') {
        trace.push({ operation, value: args[0] })
      } else {
        trace.push({ operation, parameters: args })
      }
      return Reflect.apply(method, unwrapStatement(this), args)
    },
  })
}

Object.defineProperty(globalThis, '__palariMemoryBundleSqlite', {
  value: Object.freeze({
    DatabaseSync: InstrumentedDatabaseSync,
    StatementSync: InstrumentedStatementSync,
  }),
  enumerable: false,
  configurable: false,
  writable: false,
})

const SYNTHETIC_SQLITE_URL = 'palari-memory-bundle:node-sqlite'
const SYNTHETIC_SQLITE_SOURCE =
  'export const DatabaseSync = globalThis.__palariMemoryBundleSqlite.DatabaseSync\n' +
  'export const StatementSync = globalThis.__palariMemoryBundleSqlite.StatementSync\n'

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'node:sqlite') {
      return { url: SYNTHETIC_SQLITE_URL, shortCircuit: true }
    }
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (url === SYNTHETIC_SQLITE_URL) {
      return {
        format: 'module',
        source: SYNTHETIC_SQLITE_SOURCE,
        shortCircuit: true,
      }
    }
    return nextLoad(url, context)
  },
})

function serializeError(error) {
  if (error === null || error === undefined) return null
  return {
    name: error?.name ?? null,
    code: error?.code ?? null,
    message: error?.message ?? String(error),
    causeMessage: error?.cause?.message ?? null,
  }
}

function injectedSqliteFailure(label, errcode) {
  const error = new Error(`injected ${label} failure`)
  error.code = 'ERR_SQLITE_ERROR'
  error.errcode = errcode
  return error
}

function readNativeConnectionState(target) {
  let isOpen = null
  let isTransaction = null
  try {
    isOpen = Reflect.apply(nativeDatabaseIsOpen, target, [])
  } catch {
    // The scenario records null if a particular SQLite build rejects the getter.
  }
  try {
    isTransaction = Reflect.apply(nativeDatabaseIsTransaction, target, [])
  } catch {
    // The scenario records null if a particular SQLite build rejects the getter.
  }
  return { isOpen, isTransaction }
}

function isTransactionControl(sql) {
  return (
    sql === 'BEGIN' ||
    sql === 'BEGIN IMMEDIATE' ||
    sql === 'COMMIT' ||
    sql === 'ROLLBACK'
  )
}

const scenarios = {
  async 'M1-02-native-capture'() {
    const runtime = await import('../../src/memory-bundle-runtime.mjs')
    const getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor
    const defineProperty = Object.defineProperty
    const databaseMethodDescriptors = nativeDatabaseMethodEntries.map(
      ({ key }) => [
        key,
        getOwnPropertyDescriptor(InstrumentedDatabaseSync.prototype, key),
      ],
    )
    const statementMethodDescriptors = nativeStatementMethodEntries.map(
      ({ key }) => [
        key,
        getOwnPropertyDescriptor(InstrumentedStatementSync.prototype, key),
      ],
    )
    let dynamicDatabaseDispatchCallCount = 0
    let dynamicStatementDispatchCallCount = 0
    let row
    let rows

    function dynamicDatabaseDispatchPoison() {
      dynamicDatabaseDispatchCallCount += 1
      throw new Error('dynamic database dispatch poison ran')
    }

    function dynamicStatementDispatchPoison() {
      dynamicStatementDispatchCallCount += 1
      throw new Error('dynamic statement dispatch poison ran')
    }

    try {
      for (const [key, descriptor] of databaseMethodDescriptors) {
        defineProperty(InstrumentedDatabaseSync.prototype, key, {
          ...descriptor,
          value: dynamicDatabaseDispatchPoison,
        })
      }
      for (const [key, descriptor] of statementMethodDescriptors) {
        defineProperty(InstrumentedStatementSync.prototype, key, {
          ...descriptor,
          value: dynamicStatementDispatchPoison,
        })
      }

      const db = runtime.constructDatabase([':memory:'])
      try {
        runtime.execDatabase(
          db,
          'CREATE TABLE capture_probe (id INTEGER PRIMARY KEY, value TEXT NOT NULL)',
        )
        const insert = runtime.prepareRowStatement(
          db,
          'INSERT INTO capture_probe (id, value) VALUES (?, ?)',
        )
        runtime.statementRun(insert, [7, 'seven'])
        const get = runtime.prepareRowStatement(
          db,
          'SELECT value FROM capture_probe WHERE id = ?',
        )
        row = runtime.statementGet(get, [7])
        const all = runtime.prepareRowStatement(
          db,
          'SELECT id, value FROM capture_probe ORDER BY id',
        )
        rows = runtime.statementAll(all, [])
      } finally {
        runtime.closeDatabase(db)
      }
    } finally {
      for (const [key, descriptor] of databaseMethodDescriptors) {
        defineProperty(InstrumentedDatabaseSync.prototype, key, descriptor)
      }
      for (const [key, descriptor] of statementMethodDescriptors) {
        defineProperty(InstrumentedStatementSync.prototype, key, descriptor)
      }
    }

    return {
      trace,
      row,
      rows,
      dynamicDatabaseDispatchCallCount,
      dynamicStatementDispatchCallCount,
    }
  },

  async 'M1-07-initializer-race-window'() {
    const fixtures = await import('../helpers/memory-bundle-fixtures.mjs')
    const apply = await import('../../src/memory-bundle-apply.mjs')
    const directory = mkdtempSync(join(tmpdir(), 'palari-m107-race-'))
    const openConnections = []
    const blockingConnections = []

    function readNativeRows(target, sql) {
      const statement = Reflect.apply(nativeDatabasePrepare, target, [sql])
      return Reflect.apply(nativeStatementAll, statement, [])
    }

    function transactionControls() {
      const controls = []
      for (const entry of trace) {
        if (entry.operation !== 'exec' || typeof entry.sql !== 'string') continue
        const sql = entry.sql.trim()
        if (
          sql === 'BEGIN' ||
          sql === 'COMMIT' ||
          sql === 'BEGIN IMMEDIATE' ||
          sql === 'ROLLBACK'
        ) {
          controls.push(sql)
        }
      }
      return controls
    }

    function runRaceCase(name, raceAction) {
      const dbPath = join(directory, `${name}.sqlite`)
      const wrapped = new InstrumentedDatabaseSync(dbPath)
      const target = unwrapDatabase(wrapped)
      openConnections.push(target)
      let raceFired = false
      const callbackCalls = []
      let returned
      let error = null

      afterExecHook = ({ target: hookTarget, sql }) => {
        if (
          hookTarget === target &&
          raceFired === false &&
          typeof sql === 'string' &&
          sql.trim() === 'COMMIT'
        ) {
          raceFired = true
          raceAction(dbPath)
        }
      }
      trace.length = 0
      try {
        returned = apply.initializeMemoryBundle(target, {
          clock: function clock() {
            callbackCalls.push({
              callback: 'clock',
              thisIsUndefined: this === undefined,
              argumentCount: arguments.length,
            })
            return new Date('2026-07-20T12:34:56.789Z')
          },
          idFactory: function idFactory() {
            callbackCalls.push({
              callback: 'idFactory',
              thisIsUndefined: this === undefined,
              argumentCount: arguments.length,
            })
            return '00000000-0000-4000-8000-000000000707'
          },
        })
      } catch (caught) {
        error = {
          name: caught?.name ?? null,
          code: caught?.code ?? null,
          message: caught?.message ?? String(caught),
        }
      } finally {
        afterExecHook = undefined
      }

      const controls = transactionControls()
      const objects = readNativeRows(target, `
        SELECT type, name
        FROM main.sqlite_schema
        WHERE name GLOB 'memory_bundle_*'
        ORDER BY name COLLATE BINARY
      `)
      let hasMeta = false
      for (const object of objects) {
        if (object.type === 'table' && object.name === 'memory_bundle_meta') {
          hasMeta = true
          break
        }
      }
      const semanticCounts = hasMeta
        ? readNativeRows(target, `
            SELECT
              (SELECT head_sequence
               FROM main.memory_bundle_meta
               WHERE singleton = 1) AS headSequence,
              (SELECT count(*) FROM main.memory_bundle_events) AS eventCount,
              (SELECT count(*) FROM main.memory_bundle_atoms) AS atomCount
          `)[0]
        : null
      const isTransaction = Reflect.apply(nativeDatabaseIsTransaction, target, [])
      if (isTransaction) Reflect.apply(nativeDatabaseExec, target, ['ROLLBACK'])
      Reflect.apply(nativeDatabaseClose, target, [])
      openConnections.pop()

      return {
        returnedUndefined: returned === undefined && error === null,
        error,
        raceFired,
        callbackCalls,
        transactionControls: controls,
        objects,
        semanticCounts,
        isTransactionAfter: isTransaction,
      }
    }

    function runExistingCase() {
      const dbPath = join(directory, 'existing.sqlite')
      const wrapped = new InstrumentedDatabaseSync(dbPath)
      const target = unwrapDatabase(wrapped)
      openConnections.push(target)
      fixtures.createM105Bundle(target)
      const callbackCalls = []
      let returned
      let error = null

      trace.length = 0
      try {
        returned = apply.initializeMemoryBundle(target, {
          clock() {
            callbackCalls.push('clock')
            throw new Error('existing clock must not run')
          },
          idFactory() {
            callbackCalls.push('idFactory')
            throw new Error('existing idFactory must not run')
          },
        })
      } catch (caught) {
        error = {
          name: caught?.name ?? null,
          code: caught?.code ?? null,
          message: caught?.message ?? String(caught),
        }
      }

      const controls = transactionControls()
      const objects = readNativeRows(target, `
        SELECT type, name
        FROM main.sqlite_schema
        WHERE name GLOB 'memory_bundle_*'
        ORDER BY name COLLATE BINARY
      `)
      const isTransaction = Reflect.apply(nativeDatabaseIsTransaction, target, [])
      if (isTransaction) Reflect.apply(nativeDatabaseExec, target, ['ROLLBACK'])
      Reflect.apply(nativeDatabaseClose, target, [])
      openConnections.pop()

      return {
        returnedUndefined: returned === undefined && error === null,
        error,
        callbackCalls,
        transactionControls: controls,
        objects,
        isTransactionAfter: isTransaction,
      }
    }

    try {
      const existing = runExistingCase()
      const complete = runRaceCase('complete', (dbPath) => {
        const contender = new NativeDatabaseSync(dbPath)
        try {
          fixtures.createM105Bundle(contender)
        } finally {
          Reflect.apply(nativeDatabaseClose, contender, [])
        }
      })
      const semanticallyInvalid = runRaceCase('semantically-invalid', (dbPath) => {
        const contender = new NativeDatabaseSync(dbPath)
        try {
          fixtures.createM105Bundle(contender, {
            meta: { head_sequence: 1 },
            beforeTriggers(db) {
              fixtures.insertM105EventRow(db)
            },
          })
        } finally {
          Reflect.apply(nativeDatabaseClose, contender, [])
        }
      })
      const partial = runRaceCase('partial', (dbPath) => {
        const contender = new NativeDatabaseSync(dbPath)
        try {
          Reflect.apply(nativeDatabaseExec, contender, [
            'CREATE TABLE main.memory_bundle_unknown (id INTEGER)',
          ])
        } finally {
          Reflect.apply(nativeDatabaseClose, contender, [])
        }
      })
      const busy = runRaceCase('busy', (dbPath) => {
        const blocker = new NativeDatabaseSync(dbPath)
        blockingConnections.push(blocker)
        Reflect.apply(nativeDatabaseExec, blocker, [
          'PRAGMA busy_timeout=0; BEGIN IMMEDIATE;',
        ])
      })
      const absent = runRaceCase('absent', () => {})
      return { existing, complete, semanticallyInvalid, partial, busy, absent }
    } finally {
      afterExecHook = undefined
      for (const connection of openConnections) {
        if (Reflect.apply(nativeDatabaseIsTransaction, connection, [])) {
          Reflect.apply(nativeDatabaseExec, connection, ['ROLLBACK'])
        }
        Reflect.apply(nativeDatabaseClose, connection, [])
      }
      for (const connection of blockingConnections) {
        if (Reflect.apply(nativeDatabaseIsTransaction, connection, [])) {
          Reflect.apply(nativeDatabaseExec, connection, ['ROLLBACK'])
        }
        Reflect.apply(nativeDatabaseClose, connection, [])
      }
      rmSync(directory, { recursive: true, force: true })
    }
  },

  async 'M1-07-initializer-rollback-precedence'() {
    const apply = await import('../../src/memory-bundle-apply.mjs')

    function transactionControls() {
      const controls = []
      for (const entry of trace) {
        if (entry.operation !== 'exec' || typeof entry.sql !== 'string') continue
        const sql = entry.sql.trim()
        if (
          sql === 'BEGIN' ||
          sql === 'COMMIT' ||
          sql === 'BEGIN IMMEDIATE' ||
          sql === 'ROLLBACK'
        ) {
          controls.push(sql)
        }
      }
      return controls
    }

    function runCleanupCase(name, rollbackFails) {
      const wrapped = new InstrumentedDatabaseSync(':memory:')
      const target = unwrapDatabase(wrapped)
      const callbackCalls = []
      let primaryFailureSeen = false
      let error = null

      beforeExecHook = ({ target: hookTarget, sql }) => {
        if (hookTarget !== target || typeof sql !== 'string') return
        const trimmed = sql.trim()
        if (
          name === 'ddl' &&
          trimmed.startsWith('CREATE TABLE main.memory_bundle_events')
        ) {
          primaryFailureSeen = true
          throw new Error('injected DDL failure')
        }
        if (rollbackFails && primaryFailureSeen && trimmed === 'ROLLBACK') {
          throw new Error('injected rollback failure')
        }
      }

      trace.length = 0
      try {
        apply.initializeMemoryBundle(target, {
          clock: function clock() {
            callbackCalls.push({
              callback: 'clock',
              thisIsUndefined: this === undefined,
              argumentCount: arguments.length,
            })
            if (name === 'callback') {
              primaryFailureSeen = true
              throw new Error('injected callback failure')
            }
            return new Date('2026-07-20T12:34:56.789Z')
          },
          idFactory: function idFactory() {
            callbackCalls.push({
              callback: 'idFactory',
              thisIsUndefined: this === undefined,
              argumentCount: arguments.length,
            })
            return '00000000-0000-4000-8000-000000000708'
          },
        })
      } catch (caught) {
        error = {
          name: caught?.name ?? null,
          code: caught?.code ?? null,
          message: caught?.message ?? String(caught),
        }
      } finally {
        beforeExecHook = undefined
      }

      const controls = transactionControls()
      const transactionRemainedOpen = Reflect.apply(
        nativeDatabaseIsTransaction,
        target,
        [],
      )
      if (transactionRemainedOpen) {
        Reflect.apply(nativeDatabaseExec, target, ['ROLLBACK'])
      }
      const objects = (() => {
        const statement = Reflect.apply(nativeDatabasePrepare, target, [`
          SELECT type, name
          FROM main.sqlite_schema
          WHERE name GLOB 'memory_bundle_*'
          ORDER BY name COLLATE BINARY
        `])
        return Reflect.apply(nativeStatementAll, statement, [])
      })()
      Reflect.apply(nativeDatabaseClose, target, [])

      return {
        error,
        primaryFailureSeen,
        callbackCalls,
        transactionControls: controls,
        transactionRemainedOpen,
        objectsAfterNativeCleanup: objects,
      }
    }

    try {
      return {
        callback: runCleanupCase('callback', true),
        ddl: runCleanupCase('ddl', true),
        ddlRollback: runCleanupCase('ddl', false),
      }
    } finally {
      beforeExecHook = undefined
    }
  },

  async 'M1-07-initializer-setup-error-precedence'() {
    const apply = await import('../../src/memory-bundle-apply.mjs')
    const wrapped = new InstrumentedDatabaseSync(':memory:')
    const target = unwrapDatabase(wrapped)
    let injectedFailureSeen = false
    let callbackCalls = 0
    let error = null

    beforeExecHook = ({ target: hookTarget, sql }) => {
      if (
        hookTarget === target &&
        injectedFailureSeen === false &&
        typeof sql === 'string' &&
        sql.includes('PRAGMA foreign_keys=ON')
      ) {
        injectedFailureSeen = true
        const injected = new Error('injected setup I/O failure')
        injected.code = 'ERR_SQLITE_ERROR'
        injected.errcode = 10
        throw injected
      }
    }

    trace.length = 0
    try {
      apply.initializeMemoryBundle(target, {
        clock() {
          callbackCalls += 1
          return new Date('2026-07-20T12:34:56.789Z')
        },
        idFactory() {
          callbackCalls += 1
          return '00000000-0000-4000-8000-000000000709'
        },
      })
    } catch (caught) {
      error = {
        name: caught?.name ?? null,
        code: caught?.code ?? null,
        message: caught?.message ?? String(caught),
      }
    } finally {
      beforeExecHook = undefined
    }

    const transactionControls = trace
      .filter((entry) =>
        entry.operation === 'exec' &&
        typeof entry.sql === 'string' &&
        ['BEGIN', 'COMMIT', 'BEGIN IMMEDIATE', 'ROLLBACK'].includes(
          entry.sql.trim(),
        ))
      .map((entry) => entry.sql.trim())
    const transactionRemainedOpen = Reflect.apply(
      nativeDatabaseIsTransaction,
      target,
      [],
    )
    const statement = Reflect.apply(nativeDatabasePrepare, target, [`
      SELECT type, name
      FROM main.sqlite_schema
      WHERE name GLOB 'memory_bundle_*'
      ORDER BY name COLLATE BINARY
    `])
    const objects = Reflect.apply(nativeStatementAll, statement, [])
    Reflect.apply(nativeDatabaseClose, target, [])

    return {
      error,
      injectedFailureSeen,
      callbackCalls,
      transactionControls,
      transactionRemainedOpen,
      objects,
    }
  },

  async 'M1-07-initializer-pretransaction-native-failures'() {
    const apply = await import('../../src/memory-bundle-apply.mjs')
    const specifications = [
      { phase: 'configuration', name: 'busy', errcode: 5 },
      { phase: 'configuration', name: 'extended-locked', errcode: 262 },
      { phase: 'configuration', name: 'io', errcode: 10 },
      { phase: 'temp-inventory', name: 'busy', errcode: 5 },
      { phase: 'temp-inventory', name: 'extended-locked', errcode: 262 },
      { phase: 'temp-inventory', name: 'io', errcode: 10 },
    ]
    const results = {}

    for (const specification of specifications) {
      const wrapped = new InstrumentedDatabaseSync(':memory:')
      const target = unwrapDatabase(wrapped)
      let injectedFailureCount = 0
      let callbackCalls = 0
      let error = null

      function injectNativeFailure() {
        injectedFailureCount += 1
        const injected = new Error(
          `injected ${specification.phase} ${specification.name} failure`,
        )
        injected.code = 'ERR_SQLITE_ERROR'
        injected.errcode = specification.errcode
        throw injected
      }

      beforeExecHook = ({ target: hookTarget, sql }) => {
        if (
          specification.phase === 'configuration' &&
          hookTarget === target &&
          injectedFailureCount === 0 &&
          typeof sql === 'string' &&
          sql.includes('PRAGMA foreign_keys=ON')
        ) {
          injectNativeFailure()
        }
      }
      beforePrepareHook = ({ target: hookTarget, sql }) => {
        if (
          specification.phase === 'temp-inventory' &&
          hookTarget === target &&
          injectedFailureCount === 0 &&
          typeof sql === 'string' &&
          sql.includes('FROM temp.sqlite_schema')
        ) {
          injectNativeFailure()
        }
      }

      trace.length = 0
      try {
        apply.initializeMemoryBundle(target, {
          clock() {
            callbackCalls += 1
            return new Date('2026-07-20T12:34:56.789Z')
          },
          idFactory() {
            callbackCalls += 1
            return '00000000-0000-4000-8000-000000000711'
          },
        })
      } catch (caught) {
        error = {
          name: caught?.name ?? null,
          code: caught?.code ?? null,
          message: caught?.message ?? String(caught),
        }
      } finally {
        beforeExecHook = undefined
        beforePrepareHook = undefined
      }

      const transactionControls = trace
        .filter((entry) =>
          entry.operation === 'exec' &&
          typeof entry.sql === 'string' &&
          ['BEGIN', 'COMMIT', 'BEGIN IMMEDIATE', 'ROLLBACK'].includes(
            entry.sql.trim(),
          ))
        .map((entry) => entry.sql.trim())
      const transactionRemainedOpen = Reflect.apply(
        nativeDatabaseIsTransaction,
        target,
        [],
      )
      const statement = Reflect.apply(nativeDatabasePrepare, target, [`
        SELECT type, name
        FROM main.sqlite_schema
        WHERE name GLOB 'memory_bundle_*'
        ORDER BY name COLLATE BINARY
      `])
      const objects = Reflect.apply(nativeStatementAll, statement, [])
      Reflect.apply(nativeDatabaseClose, target, [])

      results[`${specification.phase}:${specification.name}`] = {
        error,
        injectedFailureCount,
        callbackCalls,
        transactionControls,
        transactionRemainedOpen,
        objects,
      }
    }

    beforeExecHook = undefined
    beforePrepareHook = undefined
    return results
  },

  async 'M1-06-verifier-read-only-dispatch'() {
    const fixtures = await import('../helpers/memory-bundle-fixtures.mjs')
    const directory = mkdtempSync(join(tmpdir(), 'palari-m106-read-only-'))
    const refusedEvents = [
      fixtures.makeM104EventRow({
        sequence: 1,
        decision_id: 'dec_00000000-0000-4000-8000-000000001301',
        proposal_id: 'prp_00000000-0000-4000-8000-000000001401',
        outcome: 'refused',
        reason_code: 'below_threshold',
        authority_kind: 'policy',
        authority_id: 'palari-kernel-admission@1',
        memory_id: null,
        effective_at: '2026-07-18T12:01:00.000Z',
        observed_at: '2026-07-18T12:01:00.000Z',
      }),
      fixtures.makeM104EventRow({
        sequence: 2,
        decision_id: 'dec_00000000-0000-4000-8000-000000001302',
        proposal_id: 'prp_00000000-0000-4000-8000-000000001402',
        outcome: 'refused',
        reason_code: 'below_threshold',
        authority_kind: 'policy',
        authority_id: 'palari-kernel-admission@1',
        memory_id: null,
        effective_at: '2026-07-18T12:02:00.000Z',
        observed_at: '2026-07-18T12:02:00.000Z',
      }),
    ]
    const variants = [
      { name: 'empty', setupOptions: {} },
      { name: 'active', setupOptions: { seedActive: true } },
      {
        name: 'refused',
        setupOptions: {
          meta: { head_sequence: refusedEvents.length },
          beforeTriggers(connection) {
            for (const event of refusedEvents) {
              fixtures.insertM105EventRow(connection, event)
            }
          },
        },
      },
      {
        name: 'active-inside-transaction',
        setupOptions: { seedActive: true },
        beginTransaction: true,
        verificationCalls: 2,
      },
    ]
    const setups = []
    const connections = []

    try {
      for (const variant of variants) {
        const dbPath = join(directory, `${variant.name}.sqlite`)
        let setup = new NativeDatabaseSync(dbPath)
        setups.push(setup)
        fixtures.createM105Bundle(setup, variant.setupOptions)
        Reflect.apply(nativeDatabaseClose, setup, [])
        setups.pop()
        setup = undefined
        variant.dbPath = dbPath
      }

      const verifier = await import(
        `../../src/memory-bundle-verify.mjs?m106-read-only=${Date.now()}`
      )
      const runtime = await import('../../src/memory-bundle-runtime.mjs')
      for (const variant of variants) {
        const db = new InstrumentedDatabaseSync(variant.dbPath, {
          readOnly: true,
          timeout: 0,
        })
        const nativeTarget = unwrapDatabase(db)
        const connectionConstruction = trace[trace.length - 1]
        if (variant.beginTransaction === true) {
          Reflect.apply(nativeDatabaseExec, nativeTarget, ['BEGIN'])
        }
        connections.push({
          ...variant,
          db,
          nativeTarget,
          connectionConstruction,
        })
        trace.length = 0
      }

      const databaseMethodDescriptors = nativeDatabaseMethodEntries.map(
        ({ key, operation }) => [
          key,
          operation,
          Object.getOwnPropertyDescriptor(InstrumentedDatabaseSync.prototype, key),
        ],
      )
      const statementMethodDescriptors = nativeStatementMethodEntries.map(
        ({ key, operation }) => [
          key,
          operation,
          Object.getOwnPropertyDescriptor(InstrumentedStatementSync.prototype, key),
        ],
      )
      const poisonedStatementOperations = []
      const cases = []
      let currentCase

      function dynamicDatabaseDispatchPoison(operation) {
        return function poisonDatabaseDispatch() {
          currentCase.dynamicDatabaseDispatchCallCount += 1
          currentCase.dynamicDatabaseDispatchOperations.push(operation)
          throw new Error(
            `dynamic verifier database dispatch poison ran: ${operation}`,
          )
        }
      }

      function dynamicStatementDispatchPoison(operation) {
        return function poisonStatementDispatch() {
          currentCase.dynamicStatementDispatchCallCount += 1
          currentCase.dynamicStatementDispatchOperations.push(operation)
          throw new Error(
            `dynamic verifier statement dispatch poison ran: ${operation}`,
          )
        }
      }

      try {
        accessorPoisonEnabled = true
        for (const [key, operation, descriptor] of databaseMethodDescriptors) {
          Object.defineProperty(InstrumentedDatabaseSync.prototype, key, {
            ...descriptor,
            value: dynamicDatabaseDispatchPoison(operation),
          })
        }
        for (const [key, operation, descriptor] of statementMethodDescriptors) {
          Object.defineProperty(InstrumentedStatementSync.prototype, key, {
            ...descriptor,
            value: dynamicStatementDispatchPoison(operation),
          })
          poisonedStatementOperations.push(operation)
        }

        for (const connection of connections) {
          const caseResult = {
            name: connection.name,
            connectionConstruction: connection.connectionConstruction,
            calls: [],
          }
          const verificationCalls = connection.verificationCalls ?? 1
          for (let callIndex = 0; callIndex < verificationCalls; callIndex += 1) {
            currentCase = {
              call: callIndex + 1,
              dynamicDatabaseDispatchCallCount: 0,
              dynamicDatabaseDispatchOperations: [],
              dynamicStatementDispatchCallCount: 0,
              dynamicStatementDispatchOperations: [],
              dynamicDatabaseAccessorCallCount: 0,
              dynamicDatabaseAccessorOperations: [],
              dynamicStatementAccessorCallCount: 0,
              dynamicStatementAccessorOperations: [],
            }
            currentAccessorCase = currentCase
            trace.length = 0
            runtime.assertOpenDatabaseSync(connection.nativeTarget)
            currentCase.isTransactionBefore = runtime.readDatabaseTransactionState(
              connection.db,
            )
            let state
            let verificationError = null
            try {
              state = verifier.verifyMemoryBundleState(connection.db)
            } catch (error) {
              verificationError = {
                name: error?.name ?? null,
                code: error?.code ?? null,
                message: error?.message ?? String(error),
              }
            }
            currentCase.isTransactionAfter = runtime.readDatabaseTransactionState(
              connection.db,
            )
            currentCase.trace = trace.slice()
            currentCase.checkpoint = state?.checkpoint ?? null
            currentCase.state = state === undefined
              ? null
              : {
                  memoryIds: state.memories.map(({ memoryId }) => memoryId),
                  retained: [...state.retainedByMemoryId].map(
                    ([memoryId, retained]) => [memoryId, retained.status],
                  ),
                  seenDecisionIds: [...state.seenDecisionIds],
                  seenProposalIds: [...state.seenProposalIds],
                  lastObservedAt: state.lastObservedAt,
                }
            currentCase.verificationError = verificationError
            caseResult.calls.push(currentCase)
            currentCase = undefined
            currentAccessorCase = undefined
          }
          cases.push(caseResult)
        }
      } finally {
        accessorPoisonEnabled = false
        currentAccessorCase = undefined
        for (const [key, , descriptor] of databaseMethodDescriptors) {
          Object.defineProperty(InstrumentedDatabaseSync.prototype, key, descriptor)
        }
        for (const [key, , descriptor] of statementMethodDescriptors) {
          Object.defineProperty(InstrumentedStatementSync.prototype, key, descriptor)
        }
      }

      for (let index = 0; index < connections.length; index += 1) {
        const connection = connections[index]
        const caseResult = cases[index]
        caseResult.cleanupTransactionBefore = Reflect.apply(
          nativeDatabaseIsTransaction,
          connection.nativeTarget,
          [],
        )
        caseResult.cleanupOperation = null
        if (
          connection.beginTransaction === true &&
          caseResult.cleanupTransactionBefore === true
        ) {
          Reflect.apply(nativeDatabaseExec, connection.nativeTarget, ['ROLLBACK'])
          caseResult.cleanupOperation = 'ROLLBACK'
        }
        caseResult.cleanupTransactionAfter = Reflect.apply(
          nativeDatabaseIsTransaction,
          connection.nativeTarget,
          [],
        )
      }

      for (let index = 0; index < connections.length; index += 1) {
        let oracleFunctionPersisted = false
        try {
          const statement = Reflect.apply(
            nativeDatabasePrepare,
            connections[index].nativeTarget,
            ['SELECT m106_oracle_gap() AS value'],
          )
          Reflect.apply(nativeStatementGet, statement, [])
          oracleFunctionPersisted = true
        } catch {
          // The verification window must not register this caller-local function.
        }
        cases[index].oracleFunctionPersisted = oracleFunctionPersisted
      }

      return {
        cases,
        databasePrototypeOperations: nativeDatabaseMethodEntries.map(
          ({ operation }) => operation,
        ),
        poisonedDatabaseOperations: databaseMethodDescriptors.map(
          ([, operation]) => operation,
        ),
        databaseOwnAccessorOperations: nativeDatabaseAccessorEntries.map(
          ({ operation }) => operation,
        ),
        capturedDatabaseAccessorOperations: nativeDatabaseAccessorEntries.map(
          ({ operation }) => operation,
        ),
        poisonedDatabaseAccessorOperations: nativeDatabaseAccessorEntries.map(
          ({ operation }) => operation,
        ),
        databaseAccessorBoundary: 'constructor-probe-and-native-target-proxy',
        statementPrototypeOperations: nativeStatementMethodEntries.map(
          ({ operation }) => operation,
        ),
        wrappedStatementOperations: callableOwnOperationNames(
          InstrumentedStatementSync.prototype,
        ),
        poisonedStatementOperations,
        statementOwnAccessorOperations: nativeStatementAccessorEntries.map(
          ({ operation }) => operation,
        ),
        wrappedStatementAccessorOperations: nativeStatementAccessorEntries.map(
          ({ operation }) => operation,
        ),
        poisonedStatementAccessorOperations: nativeStatementAccessorEntries.map(
          ({ operation }) => operation,
        ),
        statementAccessorBoundary: 'prepare-time-native-target-wrapper',
      }
    } finally {
      for (const setup of setups) {
        Reflect.apply(nativeDatabaseClose, setup, [])
      }
      for (const { nativeTarget } of connections) {
        Reflect.apply(nativeDatabaseClose, nativeTarget, [])
      }
      rmSync(directory, { recursive: true, force: true })
    }
  },

  async 'M1-10-public-open-sequence'() {
    const fixtures = await import('../helpers/memory-bundle-fixtures.mjs')
    const directory = mkdtempSync(join(tmpdir(), 'palari-m110-open-sequence-'))
    const dbPath = join(directory, 'bundle # % ? é 東京.sqlite')
    const setup = new NativeDatabaseSync(dbPath)
    fixtures.createM105Bundle(setup, { seedActive: true })
    Reflect.apply(nativeDatabaseClose, setup, [])

    const operationalConnections = []
    let handle
    afterConstructHook = ({ target, args }) => {
      if (args[1]?.open === false) return
      operationalConnections.push({
        target,
        args,
        kind: args[1]?.readOnly === true ? 'final' : 'recovery',
      })
    }

    try {
      trace.length = 0
      const publicModule = await import(
        `../../src/memory-bundle.mjs?m110-open-sequence=${Date.now()}`
      )
      const malformedOptions = [
        undefined,
        {},
        { dbPath: 'relative.sqlite' },
        new Proxy(
          { dbPath },
          {
            get() {
              throw new Error('malformed options receiver trap ran')
            },
          },
        ),
      ]
      const malformedResults = []
      for (const options of malformedOptions) {
        const constructorsBefore = trace.filter(
          ({ operation }) => operation === 'construct',
        ).length
        let error = null
        try {
          publicModule.openMemoryBundle(options)
        } catch (caught) {
          error = serializeError(caught)
        }
        const constructorsAfter = trace.filter(
          ({ operation }) => operation === 'construct',
        ).length
        malformedResults.push({
          error,
          operationalConstructorDelta: constructorsAfter - constructorsBefore,
        })
      }
      const constructorsBeforeValidOpen = trace.filter(
        ({ operation }) => operation === 'construct',
      ).length
      handle = publicModule.openMemoryBundle({ dbPath })
      const openTrace = trace.slice()
      const constructions = openTrace
        .filter(({ operation }) => operation === 'construct')
        .map(({ args }) => args)

      const milestones = []
      let currentKind = null
      for (const entry of openTrace) {
        if (entry.operation === 'construct') {
          if (entry.args[1]?.open === false) {
            milestones.push('probe:construct')
            continue
          }
          currentKind = entry.args[1]?.readOnly === true ? 'final' : 'recovery'
          milestones.push(`${currentKind}:construct`)
          continue
        }
        if (entry.operation === 'exec' && typeof entry.sql === 'string') {
          const sql = entry.sql.trim()
          if (isTransactionControl(sql)) milestones.push(`${currentKind}:${sql}`)
          continue
        }
        if (
          entry.operation === 'prepare' &&
          entry.sql === 'SELECT 1 FROM main.sqlite_schema LIMIT 1'
        ) {
          milestones.push('recovery:schema-read')
          continue
        }
        if (entry.operation === 'close') milestones.push(`${currentKind}:close`)
      }

      const recoveryProbeIndex = openTrace.findIndex((entry) =>
        entry.operation === 'prepare' &&
        entry.sql === 'SELECT 1 FROM main.sqlite_schema LIMIT 1')
      const recoveryProbeWindow = openTrace.slice(
        recoveryProbeIndex,
        recoveryProbeIndex + 4,
      )
      const pragmaConfigurations = { recovery: [], final: [] }
      const pragmaReadbacks = { recovery: [], final: [] }
      const applicationMutationSql = []
      let tracedKind = null
      for (let index = 0; index < openTrace.length; index += 1) {
        const entry = openTrace[index]
        if (entry.operation === 'construct' && entry.args[1]?.open !== false) {
          tracedKind = entry.args[1]?.readOnly === true ? 'final' : 'recovery'
          continue
        }
        if (tracedKind === null) continue
        if (entry.operation === 'exec' && typeof entry.sql === 'string') {
          const statements = entry.sql
            .split(';')
            .map((statement) => statement.trim())
            .filter((statement) => statement.length !== 0)
          for (const statement of statements) {
            if (statement.startsWith('PRAGMA ')) {
              pragmaConfigurations[tracedKind].push(statement)
            }
            if (
              /^(?:INSERT|UPDATE|DELETE|REPLACE|CREATE|DROP|ALTER|VACUUM|ATTACH|DETACH)\b/i.test(
                statement,
              )
            ) {
              applicationMutationSql.push({ kind: tracedKind, sql: statement })
            }
          }
          continue
        }
        if (entry.operation !== 'prepare' || typeof entry.sql !== 'string') {
          continue
        }
        if (
          /^PRAGMA (?:foreign_keys|busy_timeout|recursive_triggers|ignore_check_constraints)$/.test(
            entry.sql,
          )
        ) {
          pragmaReadbacks[tracedKind].push(
            openTrace.slice(index, index + 4),
          )
        }
        if (
          /^(?:INSERT|UPDATE|DELETE|REPLACE|CREATE|DROP|ALTER|VACUUM|ATTACH|DETACH)\b/i.test(
            entry.sql.trim(),
          )
        ) {
          applicationMutationSql.push({ kind: tracedKind, sql: entry.sql })
        }
      }
      const beforeHandleClose = operationalConnections.map(
        ({ args, kind, target }) => ({
          args,
          kind,
          ...readNativeConnectionState(target),
        }),
      )
      const capabilitiesShared =
        handle.capabilities === handle.verify().capabilities &&
        handle.capabilities === handle.replay().capabilities
      const closeReturnedUndefined = handle.close() === undefined
      const afterHandleClose = operationalConnections.map(
        ({ kind, target }) => ({
          kind,
          ...readNativeConnectionState(target),
        }),
      )

      return {
        dbPath,
        malformedResults,
        constructorsBeforeValidOpen,
        constructions,
        milestones,
        recoveryProbeWindow,
        pragmaConfigurations,
        pragmaReadbacks,
        applicationMutationSql,
        beforeHandleClose,
        afterHandleClose,
        capabilitiesShared,
        closeReturnedUndefined,
      }
    } finally {
      afterConstructHook = undefined
      beforeExecHook = undefined
      beforePrepareHook = undefined
      beforeCloseHook = undefined
      if (handle !== undefined) {
        try {
          handle.close()
        } catch {
          // Native cleanup below is the final fixture safety net.
        }
      }
      for (const { target } of operationalConnections) {
        const state = readNativeConnectionState(target)
        if (state.isOpen === true) {
          if (state.isTransaction === true) {
            Reflect.apply(nativeDatabaseExec, target, ['ROLLBACK'])
          }
          Reflect.apply(nativeDatabaseClose, target, [])
        }
      }
      rmSync(directory, { recursive: true, force: true })
    }
  },

  async 'M1-10-open-cleanup-precedence'() {
    const fixtures = await import('../helpers/memory-bundle-fixtures.mjs')
    const publicModule = await import(
      `../../src/memory-bundle.mjs?m110-open-cleanup=${Date.now()}`
    )
    const directory = mkdtempSync(join(tmpdir(), 'palari-m110-open-cleanup-'))

    function runOpenCase(name, specification = {}) {
      const dbPath = join(directory, `${name}.sqlite`)
      const setup = new NativeDatabaseSync(dbPath)
      if (specification.semanticInvalid === true) {
        fixtures.createM105Bundle(setup, {
          meta: { head_sequence: 1 },
          beforeTriggers(connection) {
            fixtures.insertM105EventRow(connection)
          },
        })
      } else {
        fixtures.createM105Bundle(setup, { seedActive: true })
      }
      Reflect.apply(nativeDatabaseClose, setup, [])

      const records = []
      const recordsByTarget = new Map()
      const faultOrder = []
      let configurationFailureCount = 0
      let primaryFailureCount = 0
      let commitFailureCount = 0
      let rollbackFailureCount = 0
      let closeFailureCount = 0
      let returnedHandle
      let error = null

      afterConstructHook = ({ target, args }) => {
        if (args[1]?.open === false) return
        const record = {
          target,
          args,
          kind: args[1]?.readOnly === true ? 'final' : 'recovery',
          transactionControls: [],
          closeAttempts: 0,
        }
        records.push(record)
        recordsByTarget.set(target, record)
      }
      beforePrepareHook = ({ target, sql }) => {
        const record = recordsByTarget.get(target)
        if (record === undefined || primaryFailureCount !== 0) return
        const recoveryRead =
          record.kind === 'recovery' &&
          specification.primaryFailure === 'recovery-read' &&
          sql === 'SELECT 1 FROM main.sqlite_schema LIMIT 1'
        const finalRead =
          record.kind === 'final' &&
          specification.primaryFailure === 'final-read' &&
          typeof sql === 'string' &&
          sql.includes("WHERE name = 'memory_bundle_meta'")
        if (!recoveryRead && !finalRead) return
        primaryFailureCount += 1
        faultOrder.push(`${record.kind}:primary`)
        throw injectedSqliteFailure(`${record.kind} primary`, 5)
      }
      beforeExecHook = ({ target, sql }) => {
        const record = recordsByTarget.get(target)
        if (record === undefined || typeof sql !== 'string') return
        const control = sql.trim()
        if (
          specification.configurationFailure === record.kind &&
          configurationFailureCount === 0 &&
          control.includes('PRAGMA foreign_keys=ON')
        ) {
          configurationFailureCount += 1
          faultOrder.push(`${record.kind}:configuration`)
          throw injectedSqliteFailure(`${record.kind} configuration`, 10)
        }
        if (isTransactionControl(control)) {
          record.transactionControls.push(control)
        }
        if (
          control === 'COMMIT' &&
          specification.commitFailure === record.kind &&
          commitFailureCount === 0
        ) {
          commitFailureCount += 1
          faultOrder.push(`${record.kind}:commit`)
          throw injectedSqliteFailure(`${record.kind} commit`, 6)
        }
        if (
          control === 'ROLLBACK' &&
          specification.rollbackFailure === record.kind &&
          rollbackFailureCount === 0
        ) {
          rollbackFailureCount += 1
          faultOrder.push(`${record.kind}:rollback`)
          throw injectedSqliteFailure(`${record.kind} rollback`, 10)
        }
      }
      beforeCloseHook = ({ target }) => {
        const record = recordsByTarget.get(target)
        if (record === undefined) return
        record.closeAttempts += 1
        if (
          specification.closeFailure === record.kind &&
          closeFailureCount === 0
        ) {
          closeFailureCount += 1
          faultOrder.push(`${record.kind}:close`)
          throw injectedSqliteFailure(`${record.kind} close`, 10)
        }
      }

      trace.length = 0
      try {
        returnedHandle = publicModule.openMemoryBundle({ dbPath })
      } catch (caught) {
        error = serializeError(caught)
      }

      const connectionStates = records.map((record) => ({
        kind: record.kind,
        args: record.args,
        transactionControls: record.transactionControls,
        closeAttempts: record.closeAttempts,
        ...readNativeConnectionState(record.target),
      }))

      afterConstructHook = undefined
      beforeExecHook = undefined
      beforePrepareHook = undefined
      beforeCloseHook = undefined
      if (returnedHandle !== undefined) {
        try {
          returnedHandle.close()
        } catch {
          // An unexpected returned handle is reported and cleaned natively below.
        }
      }
      for (const record of records) {
        const state = readNativeConnectionState(record.target)
        if (state.isOpen === true) {
          if (state.isTransaction === true) {
            Reflect.apply(nativeDatabaseExec, record.target, ['ROLLBACK'])
          }
          Reflect.apply(nativeDatabaseClose, record.target, [])
        }
      }

      return {
        returnedHandle: returnedHandle !== undefined,
        error,
        faultOrder,
        configurationFailureCount,
        primaryFailureCount,
        commitFailureCount,
        rollbackFailureCount,
        closeFailureCount,
        connectionStates,
      }
    }

    try {
      return {
        recoveryConfiguration: runOpenCase('recovery-configuration', {
          configurationFailure: 'recovery',
        }),
        finalConfiguration: runOpenCase('final-configuration', {
          configurationFailure: 'final',
        }),
        recoveryReadBusy: runOpenCase('recovery-read-busy', {
          primaryFailure: 'recovery-read',
        }),
        recoveryCommitBusy: runOpenCase('recovery-commit-busy', {
          commitFailure: 'recovery',
        }),
        recoveryCloseBeatsPrimary: runOpenCase(
          'recovery-close-beats-primary',
          {
            primaryFailure: 'recovery-read',
            closeFailure: 'recovery',
          },
        ),
        recoveryRollbackBeatsClose: runOpenCase(
          'recovery-rollback-beats-close',
          {
            primaryFailure: 'recovery-read',
            rollbackFailure: 'recovery',
            closeFailure: 'recovery',
          },
        ),
        recoveryPostCommitClose: runOpenCase('recovery-post-commit-close', {
          closeFailure: 'recovery',
        }),
        finalSemantic: runOpenCase('final-semantic', {
          semanticInvalid: true,
        }),
        finalCommitBusy: runOpenCase('final-commit-busy', {
          commitFailure: 'final',
        }),
        finalCloseBeatsPrimary: runOpenCase('final-close-beats-primary', {
          primaryFailure: 'final-read',
          closeFailure: 'final',
        }),
        finalRollbackBeatsClose: runOpenCase(
          'final-rollback-beats-close',
          {
            primaryFailure: 'final-read',
            rollbackFailure: 'final',
            closeFailure: 'final',
          },
        ),
      }
    } finally {
      afterConstructHook = undefined
      beforeExecHook = undefined
      beforePrepareHook = undefined
      beforeCloseHook = undefined
      rmSync(directory, { recursive: true, force: true })
    }
  },

  async 'M1-10-handle-cleanup-precedence'() {
    const fixtures = await import('../helpers/memory-bundle-fixtures.mjs')
    const publicModule = await import(
      `../../src/memory-bundle.mjs?m110-handle-cleanup=${Date.now()}`
    )
    const directory = mkdtempSync(join(tmpdir(), 'palari-m110-handle-cleanup-'))

    function captureCall(callback) {
      try {
        const returned = callback()
        return { returnedUndefined: returned === undefined, error: null }
      } catch (error) {
        return { returnedUndefined: false, error: serializeError(error) }
      }
    }

    function runHandleCase(name, mode) {
      const dbPath = join(directory, `${name}.sqlite`)
      const setup = new NativeDatabaseSync(dbPath)
      fixtures.createM105Bundle(setup, { seedActive: true })
      Reflect.apply(nativeDatabaseClose, setup, [])

      const operationalConnections = []
      afterConstructHook = ({ target, args }) => {
        if (args[1]?.open === false) return
        operationalConnections.push({
          target,
          kind: args[1]?.readOnly === true ? 'final' : 'recovery',
        })
      }
      const handle = publicModule.openMemoryBundle({ dbPath })
      const finalTarget = operationalConnections.find(
        ({ kind }) => kind === 'final',
      ).target
      const originalCapabilities = handle.capabilities
      const transactionControls = []
      const faultOrder = []
      let primaryFailureCount = 0
      let commitFailureCount = 0
      let rollbackFailureCount = 0
      let closeAttempts = 0
      let closeFailureCount = 0

      beforePrepareHook = ({ target, sql }) => {
        if (
          target === finalTarget &&
          (mode === 'read-primary' ||
            mode === 'poison-close-succeeds' ||
            mode === 'poison-close-retries') &&
          primaryFailureCount === 0 &&
          typeof sql === 'string' &&
          sql.includes("WHERE name = 'memory_bundle_meta'")
        ) {
          primaryFailureCount += 1
          faultOrder.push('primary')
          throw injectedSqliteFailure('handle primary', 5)
        }
      }
      beforeExecHook = ({ target, sql }) => {
        if (target !== finalTarget || typeof sql !== 'string') return
        const control = sql.trim()
        if (isTransactionControl(control)) transactionControls.push(control)
        if (
          mode === 'commit-primary' &&
          control === 'COMMIT' &&
          commitFailureCount === 0
        ) {
          commitFailureCount += 1
          faultOrder.push('commit')
          throw injectedSqliteFailure('handle commit', 5)
        }
        if (
          (mode === 'poison-close-succeeds' ||
            mode === 'poison-close-retries') &&
          control === 'ROLLBACK' &&
          rollbackFailureCount === 0
        ) {
          rollbackFailureCount += 1
          faultOrder.push('rollback')
          throw injectedSqliteFailure('handle rollback', 10)
        }
      }
      beforeCloseHook = ({ target }) => {
        if (target !== finalTarget) return
        closeAttempts += 1
        if (
          (mode === 'ordinary-close-retry' ||
            mode === 'poison-close-retries') &&
          closeFailureCount === 0
        ) {
          closeFailureCount += 1
          faultOrder.push('close')
          throw injectedSqliteFailure('handle close', 10)
        }
      }

      trace.length = 0
      const result = {
        mode,
        first: null,
        recoveryRead: null,
        closedVerify: null,
        closedReplay: null,
        closeResults: [],
      }

      if (mode === 'read-primary') {
        result.first = captureCall(() => handle.verify())
        result.recoveryRead = captureCall(() => handle.replay())
        result.closeResults.push(captureCall(() => handle.close()))
      } else if (mode === 'commit-primary') {
        result.first = captureCall(() => handle.replay())
        result.recoveryRead = captureCall(() => handle.verify())
        result.closeResults.push(captureCall(() => handle.close()))
      } else if (
        mode === 'poison-close-succeeds' ||
        mode === 'poison-close-retries'
      ) {
        result.first = captureCall(() => handle.verify())
        const beforeClosedReads = trace.length
        result.closedVerify = captureCall(() => handle.verify())
        result.closedReplay = captureCall(() => handle.replay())
        result.closedReadSqliteCalls = trace.length - beforeClosedReads
        result.closeResults.push(captureCall(() => handle.close()))
        result.closeResults.push(captureCall(() => handle.close()))
      } else {
        result.first = captureCall(() => handle.close())
        result.recoveryRead = captureCall(() => handle.verify())
        result.closeResults.push(captureCall(() => handle.close()))
        result.closeResults.push(captureCall(() => handle.close()))
      }

      const beforePostCloseReads = trace.length
      if (result.closedVerify === null) {
        result.closedVerify = captureCall(() => handle.verify())
        result.closedReplay = captureCall(() => handle.replay())
        result.closedReadSqliteCalls = trace.length - beforePostCloseReads
      }
      result.capabilitiesSame =
        handle.capabilities === originalCapabilities &&
        Object.isFrozen(handle.capabilities)
      result.transactionControls = transactionControls
      result.faultOrder = faultOrder
      result.primaryFailureCount = primaryFailureCount
      result.commitFailureCount = commitFailureCount
      result.rollbackFailureCount = rollbackFailureCount
      result.closeAttempts = closeAttempts
      result.closeFailureCount = closeFailureCount
      Object.assign(result, readNativeConnectionState(finalTarget))

      afterConstructHook = undefined
      beforeExecHook = undefined
      beforePrepareHook = undefined
      beforeCloseHook = undefined
      const finalState = readNativeConnectionState(finalTarget)
      if (finalState.isOpen === true) {
        if (finalState.isTransaction === true) {
          Reflect.apply(nativeDatabaseExec, finalTarget, ['ROLLBACK'])
        }
        Reflect.apply(nativeDatabaseClose, finalTarget, [])
      }
      return result
    }

    try {
      return {
        readPrimary: runHandleCase('read-primary', 'read-primary'),
        commitPrimary: runHandleCase('commit-primary', 'commit-primary'),
        poisonCloseSucceeds: runHandleCase(
          'poison-close-succeeds',
          'poison-close-succeeds',
        ),
        poisonCloseRetries: runHandleCase(
          'poison-close-retries',
          'poison-close-retries',
        ),
        ordinaryCloseRetry: runHandleCase(
          'ordinary-close-retry',
          'ordinary-close-retry',
        ),
      }
    } finally {
      afterConstructHook = undefined
      beforeExecHook = undefined
      beforePrepareHook = undefined
      beforeCloseHook = undefined
      rmSync(directory, { recursive: true, force: true })
    }
  },
}

try {
  const scenario = scenarios[process.argv[2]]
  if (scenario === undefined) {
    throw new Error(`Unknown instrumentation scenario: ${String(process.argv[2])}`)
  }
  const result = await scenario()
  process.stdout.write(`${JSON.stringify(result)}\n`)
} catch (error) {
  process.stderr.write(`${error?.stack ?? String(error)}\n`)
  process.exitCode = 1
}

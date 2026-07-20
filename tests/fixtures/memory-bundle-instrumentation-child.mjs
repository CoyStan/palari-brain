import { mkdtempSync, rmSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  DatabaseSync as NativeDatabaseSync,
  StatementSync as NativeStatementSync,
} from 'node:sqlite'

const trace = []

function sqliteOperationName(key) {
  return typeof key === 'symbol' ? String(key) : key
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

const nativeDatabaseExec = requireNativeDatabaseMethod('exec')
const nativeDatabasePrepare = requireNativeDatabaseMethod('prepare')
const nativeDatabaseClose = requireNativeDatabaseMethod('close')
const nativeStatementGet = NativeStatementSync.prototype.get
const nativeStatementAll = NativeStatementSync.prototype.all
const nativeStatementRun = NativeStatementSync.prototype.run
const nativeStatementSetReadBigInts = NativeStatementSync.prototype.setReadBigInts
const nativeStatementSetReturnArrays = NativeStatementSync.prototype.setReturnArrays

class InstrumentedDatabaseSync extends NativeDatabaseSync {
  constructor(...args) {
    trace.push({ operation: 'construct', args })
    super(...args)
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
      return Reflect.apply(method, this, args)
    },
  })
}

class InstrumentedStatementSync {
  get(...parameters) {
    trace.push({ operation: 'get', parameters })
    return Reflect.apply(nativeStatementGet, this, parameters)
  }

  all(...parameters) {
    trace.push({ operation: 'all', parameters })
    return Reflect.apply(nativeStatementAll, this, parameters)
  }

  run(...parameters) {
    trace.push({ operation: 'run', parameters })
    return Reflect.apply(nativeStatementRun, this, parameters)
  }

  setReadBigInts(value) {
    trace.push({ operation: 'setReadBigInts', value })
    return Reflect.apply(nativeStatementSetReadBigInts, this, [value])
  }

  setReturnArrays(value) {
    trace.push({ operation: 'setReturnArrays', value })
    return Reflect.apply(nativeStatementSetReturnArrays, this, [value])
  }
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
    const statementMethodDescriptors = [
      [
        'get',
        getOwnPropertyDescriptor(InstrumentedStatementSync.prototype, 'get'),
      ],
      [
        'all',
        getOwnPropertyDescriptor(InstrumentedStatementSync.prototype, 'all'),
      ],
      [
        'run',
        getOwnPropertyDescriptor(InstrumentedStatementSync.prototype, 'run'),
      ],
      [
        'setReadBigInts',
        getOwnPropertyDescriptor(
          InstrumentedStatementSync.prototype,
          'setReadBigInts',
        ),
      ],
      [
        'setReturnArrays',
        getOwnPropertyDescriptor(
          InstrumentedStatementSync.prototype,
          'setReturnArrays',
        ),
      ],
    ]
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

  async 'M1-06-verifier-read-only-dispatch'() {
    const fixtures = await import('../helpers/memory-bundle-fixtures.mjs')
    const directory = mkdtempSync(join(tmpdir(), 'palari-m106-read-only-'))
    const dbPath = join(directory, 'bundle.sqlite')
    let setup
    let db

    try {
      setup = new NativeDatabaseSync(dbPath)
      fixtures.createM105Bundle(setup, { seedActive: true })
      Reflect.apply(nativeDatabaseClose, setup, [])
      setup = undefined

      const verifier = await import(
        `../../src/memory-bundle-verify.mjs?m106-read-only=${Date.now()}`
      )
      db = new InstrumentedDatabaseSync(dbPath, {
        readOnly: true,
        timeout: 0,
      })
      const connectionConstruction = trace[trace.length - 1]
      trace.length = 0

      const databaseMethodDescriptors = nativeDatabaseMethodEntries.map(
        ({ key, operation }) => [
          key,
          operation,
          Object.getOwnPropertyDescriptor(InstrumentedDatabaseSync.prototype, key),
        ],
      )
      const statementMethodDescriptors = [
        'get',
        'all',
        'run',
        'setReadBigInts',
        'setReturnArrays',
      ].map((key) => [
        key,
        Object.getOwnPropertyDescriptor(NativeStatementSync.prototype, key),
      ])
      let dynamicDatabaseDispatchCallCount = 0
      const dynamicDatabaseDispatchOperations = []
      let dynamicStatementDispatchCallCount = 0
      let state
      let verificationError = null

      function dynamicDatabaseDispatchPoison(operation) {
        return function poisonDatabaseDispatch() {
          dynamicDatabaseDispatchCallCount += 1
          dynamicDatabaseDispatchOperations.push(operation)
          throw new Error(
            `dynamic verifier database dispatch poison ran: ${operation}`,
          )
        }
      }

      function dynamicStatementDispatchPoison() {
        dynamicStatementDispatchCallCount += 1
        throw new Error('dynamic verifier statement dispatch poison ran')
      }

      try {
        for (const [key, operation, descriptor] of databaseMethodDescriptors) {
          Object.defineProperty(InstrumentedDatabaseSync.prototype, key, {
            ...descriptor,
            value: dynamicDatabaseDispatchPoison(operation),
          })
        }
        for (const [key, descriptor] of statementMethodDescriptors) {
          Object.defineProperty(NativeStatementSync.prototype, key, {
            ...descriptor,
            value: dynamicStatementDispatchPoison,
          })
        }

        try {
          state = verifier.verifyMemoryBundleState(db)
        } catch (error) {
          verificationError = {
            name: error?.name ?? null,
            code: error?.code ?? null,
            message: error?.message ?? String(error),
          }
        }
      } finally {
        for (const [key, , descriptor] of databaseMethodDescriptors) {
          Object.defineProperty(InstrumentedDatabaseSync.prototype, key, descriptor)
        }
        for (const [key, descriptor] of statementMethodDescriptors) {
          Object.defineProperty(NativeStatementSync.prototype, key, descriptor)
        }
      }

      const verificationTrace = trace.slice()
      let oracleFunctionPersisted = false
      try {
        const statement = Reflect.apply(nativeDatabasePrepare, db, [
          'SELECT m106_oracle_gap() AS value',
        ])
        Reflect.apply(nativeStatementGet, statement, [])
        oracleFunctionPersisted = true
      } catch {
        // The verification window must not register this caller-local function.
      }

      return {
        connectionConstruction,
        trace: verificationTrace,
        checkpoint: state?.checkpoint ?? null,
        verificationError,
        isTransactionAfter: db.isTransaction,
        databasePrototypeOperations: nativeDatabaseMethodEntries.map(
          ({ operation }) => operation,
        ),
        poisonedDatabaseOperations: databaseMethodDescriptors.map(
          ([, operation]) => operation,
        ),
        dynamicDatabaseDispatchCallCount,
        dynamicDatabaseDispatchOperations,
        dynamicStatementDispatchCallCount,
        oracleFunctionPersisted,
      }
    } finally {
      if (setup !== undefined) Reflect.apply(nativeDatabaseClose, setup, [])
      if (db !== undefined) Reflect.apply(nativeDatabaseClose, db, [])
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

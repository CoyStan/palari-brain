import { registerHooks } from 'node:module'
import {
  DatabaseSync as NativeDatabaseSync,
  StatementSync as NativeStatementSync,
} from 'node:sqlite'

const trace = []

const nativeDatabaseExec = NativeDatabaseSync.prototype.exec
const nativeDatabasePrepare = NativeDatabaseSync.prototype.prepare
const nativeDatabaseClose = NativeDatabaseSync.prototype.close
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

  exec(sql) {
    trace.push({ operation: 'exec', sql })
    return Reflect.apply(nativeDatabaseExec, this, [sql])
  }

  prepare(sql) {
    trace.push({ operation: 'prepare', sql })
    return Reflect.apply(nativeDatabasePrepare, this, [sql])
  }

  close() {
    trace.push({ operation: 'close' })
    return Reflect.apply(nativeDatabaseClose, this, [])
  }
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
    const databaseMethodDescriptors = [
      [
        'exec',
        getOwnPropertyDescriptor(InstrumentedDatabaseSync.prototype, 'exec'),
      ],
      [
        'prepare',
        getOwnPropertyDescriptor(
          InstrumentedDatabaseSync.prototype,
          'prepare',
        ),
      ],
      [
        'close',
        getOwnPropertyDescriptor(InstrumentedDatabaseSync.prototype, 'close'),
      ],
    ]
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

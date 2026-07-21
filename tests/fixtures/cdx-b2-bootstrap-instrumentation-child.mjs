import cryptoModule from 'node:crypto'
import { registerHooks, syncBuiltinESMExports } from 'node:module'
import {
  DatabaseSync as NativeDatabaseSync,
  StatementSync as NativeStatementSync,
} from 'node:sqlite'

const nativeReflectApply = Reflect.apply
const nativeDate = Date
const nativeDatabaseExec = NativeDatabaseSync.prototype.exec
const nativeDatabasePrepare = NativeDatabaseSync.prototype.prepare
const nativeDatabaseClose = NativeDatabaseSync.prototype.close
const nativeStatementMethods = new Map()
for (const key of Reflect.ownKeys(NativeStatementSync.prototype)) {
  if (key === 'constructor') continue
  const descriptor = Object.getOwnPropertyDescriptor(
    NativeStatementSync.prototype,
    key,
  )
  if (descriptor !== undefined && typeof descriptor.value === 'function') {
    nativeStatementMethods.set(key, { descriptor, method: descriptor.value })
  }
}

const accessorProbe = new NativeDatabaseSync(':memory:', { open: false })
const nativeDatabaseIsTransaction = Object.getOwnPropertyDescriptor(
  accessorProbe,
  'isTransaction',
).get
const nativeDatabaseIsOpen = Object.getOwnPropertyDescriptor(
  accessorProbe,
  'isOpen',
).get

const FIXED_CHECKPOINT_AT = '2026-07-21T10:05:00.000Z'
const FIXED_UUIDS = Object.freeze([
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000102',
])

const monitor = {
  callbackCounts: { clock: 0, uuid: 0 },
  callbacksForbidden: false,
  classificationInventory: false,
  classificationMarker: false,
  clockOrdinal: 0,
  commitNativeCompleted: false,
  enabled: false,
  failAfterCommit: false,
  failClockOrdinal: null,
  failCommit: false,
  failOrdinal: null,
  failSnapshot: null,
  failUuidOrdinal: null,
  failVerifyReadOrdinal: null,
  injected: null,
  markerCompleted: false,
  mutationOrdinal: 0,
  mutations: [],
  repairStarted: false,
  salient: [],
  snapshotLinks: false,
  snapshotMemories: false,
  sqlCall: 0,
  uuidOrdinal: 0,
  verifyReadOrdinal: 0,
  verifyReads: [],
  verificationStarted: false,
  writes: [],
}

function normalizeSql(sql) {
  return sql.trim().replace(/\s+/g, ' ')
}

function serializeError(error) {
  if (error === null || error === undefined) return null
  return {
    name: error?.name ?? null,
    code: error?.code ?? null,
    message: error?.message ?? String(error),
    causeName: error?.cause?.name ?? null,
    causeCode: error?.cause?.code ?? null,
    causeMessage: error?.cause?.message ?? null,
  }
}

function injectedFailure(label) {
  const error = new Error(`injected ${label} failure`)
  error.code = 'ERR_SQLITE_ERROR'
  error.errcode = 1
  return error
}

function throwInjectedFailure(label) {
  monitor.injected = label
  throw injectedFailure(label)
}

function resetMonitor(options = {}) {
  monitor.callbackCounts = { clock: 0, uuid: 0 }
  monitor.callbacksForbidden = options.callbacksForbidden === true
  monitor.classificationInventory = false
  monitor.classificationMarker = false
  monitor.clockOrdinal = 0
  monitor.commitNativeCompleted = false
  monitor.enabled = true
  monitor.failAfterCommit = options.failAfterCommit === true
  monitor.failClockOrdinal = options.failClockOrdinal ?? null
  monitor.failCommit = options.failCommit === true
  monitor.failOrdinal = options.failOrdinal ?? null
  monitor.failSnapshot = options.failSnapshot ?? null
  monitor.failUuidOrdinal = options.failUuidOrdinal ?? null
  monitor.failVerifyReadOrdinal = options.failVerifyReadOrdinal ?? null
  monitor.injected = null
  monitor.markerCompleted = false
  monitor.mutationOrdinal = 0
  monitor.mutations = []
  monitor.repairStarted = false
  monitor.salient = []
  monitor.snapshotLinks = false
  monitor.snapshotMemories = false
  monitor.sqlCall = 0
  monitor.uuidOrdinal = 0
  monitor.verifyReadOrdinal = 0
  monitor.verifyReads = []
  monitor.verificationStarted = false
  monitor.writes = []
}

function snapshotMonitor() {
  return {
    callbackCounts: { ...monitor.callbackCounts },
    commitNativeCompleted: monitor.commitNativeCompleted,
    injected: monitor.injected,
    mutations: monitor.mutations.map((entry) => ({ ...entry })),
    salient: [...monitor.salient],
    verifyReads: monitor.verifyReads.map((entry) => ({ ...entry })),
    writes: [...monitor.writes],
  }
}

function stopMonitor() {
  monitor.enabled = false
}

function noteRepair(normalized, parameters) {
  if (monitor.repairStarted) return
  const migrationId = parameters[0]
  if (
    /\bCREATE TABLE IF NOT EXISTS (?:main\.)?memory_migrations\b/i.test(
      normalized,
    ) ||
    /\bALTER TABLE (?:main\.)?memories ADD COLUMN\b/i.test(normalized) ||
    (
      /\bINSERT OR IGNORE INTO (?:main\.)?memory_migrations\b/i.test(
        normalized,
      ) &&
      (migrationId === 'CDX-M0' || migrationId === 'CDX-M1')
    )
  ) {
    monitor.repairStarted = true
    monitor.salient.push('repair:start')
  }
}

function noteRead(normalized, parameters) {
  if (
    !monitor.classificationInventory &&
    /\bFROM main\.sqlite_schema\b/i.test(normalized)
  ) {
    monitor.classificationInventory = true
    monitor.salient.push('classify:b2-inventory')
  }

  if (
    !monitor.classificationMarker &&
    monitor.classificationInventory &&
    /\bFROM (?:main\.)?memory_migrations\b/i.test(normalized)
  ) {
    monitor.classificationMarker = true
    monitor.salient.push('classify:b2-marker')
  }

  if (
    !monitor.snapshotMemories &&
    /^SELECT id, palari_id\b/i.test(normalized) &&
    /\bFROM (?:main\.)?memories\b/i.test(normalized) &&
    /\bORDER BY id COLLATE BINARY\b/i.test(normalized) &&
    /\bpalari_id\b/i.test(normalized) &&
    /\bshared\b/i.test(normalized) &&
    /\bvalid_until\b/i.test(normalized) &&
    !/\bcontent\b/i.test(normalized)
  ) {
    monitor.snapshotMemories = true
    monitor.salient.push('snapshot:memories')
    if (monitor.failSnapshot === 'memories') {
      throwInjectedFailure('snapshot memories')
    }
  }

  if (
    !monitor.snapshotLinks &&
    /^SELECT id, from_memory_id, to_memory_id\b/i.test(normalized) &&
    /\bFROM (?:main\.)?memory_links\b/i.test(normalized) &&
    /\bORDER BY id COLLATE BINARY\b/i.test(normalized) &&
    /\bfrom_memory_id\b/i.test(normalized) &&
    /\bto_memory_id\b/i.test(normalized) &&
    !/\brelation\b/i.test(normalized)
  ) {
    monitor.snapshotLinks = true
    monitor.salient.push('snapshot:links')
    if (monitor.failSnapshot === 'links') {
      throwInjectedFailure('snapshot links')
    }
  }

  // Some implementations bind the marker id instead of embedding it. Reading
  // all migration rows is still the marker inspection when it is the first
  // migration read after the B2 inventory.
  if (
    !monitor.classificationMarker &&
    monitor.classificationInventory &&
    parameters.includes('CDX-B2')
  ) {
    monitor.classificationMarker = true
    monitor.salient.push('classify:b2-marker')
  }
}

function noteVerifyRead(operation, normalized) {
  if (
    !monitor.markerCompleted ||
    (operation !== 'get' && operation !== 'all')
  ) return
  const ordinal = monitor.verifyReadOrdinal
  monitor.verifyReadOrdinal += 1
  monitor.verifyReads.push({ operation, ordinal, sql: normalized })
  monitor.salient.push(`verify-read:${ordinal}`)
  if (monitor.failVerifyReadOrdinal === ordinal) {
    throwInjectedFailure(`verification read ${ordinal}`)
  }
}

function b2CreateNames(normalized) {
  const names = []
  const pattern = /\bCREATE\s+(?:UNIQUE\s+)?(?:TABLE|INDEX|TRIGGER)\s+main\.(cdx_b2_[a-z0-9_]+)/gi
  for (const match of normalized.matchAll(pattern)) names.push(match[1])
  return names
}

function mutationLabels(normalized, parameters) {
  const labels = b2CreateNames(normalized).map((name) => `create:${name}`)
  if (/^INSERT INTO (?:main\.)?cdx_b2_meta\b/i.test(normalized)) {
    labels.push('insert:meta')
  }
  if (/^INSERT INTO (?:main\.)?cdx_b2_legacy_checkpoint\b/i.test(normalized)) {
    labels.push(
      `insert:checkpoint:${String(parameters[0])}:${String(parameters[2])}`,
    )
  }
  if (
    /^INSERT INTO (?:main\.)?memory_migrations\b/i.test(normalized) &&
    (
      parameters[0] === 'CDX-B2' ||
      /VALUES\s*\(\s*'CDX-B2'/i.test(normalized)
    )
  ) {
    labels.push('insert:marker')
  }
  return labels
}

function beforeSql(operation, sql, parameters = []) {
  if (!monitor.enabled) return null
  const normalized = normalizeSql(sql)
  const call = monitor.sqlCall
  monitor.sqlCall += 1

  if (monitor.markerCompleted && !monitor.verificationStarted) {
    monitor.verificationStarted = true
    monitor.salient.push('verify:start')
  }

  if (operation === 'exec' && normalized === 'COMMIT') {
    monitor.salient.push('control:COMMIT')
    if (monitor.failCommit) throwInjectedFailure('COMMIT')
  } else if (operation === 'exec' && normalized === 'ROLLBACK') {
    monitor.salient.push('control:ROLLBACK')
  }

  if (/^(?:CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|REPLACE)\b/i.test(normalized)) {
    monitor.writes.push(normalized)
  }

  if (operation === 'get' || operation === 'all') {
    noteVerifyRead(operation, normalized)
    noteRead(normalized, parameters)
  }
  if (operation === 'exec' || operation === 'run') {
    noteRepair(normalized, parameters)
  }

  const labels =
    operation === 'exec' || operation === 'run'
      ? mutationLabels(normalized, parameters)
      : []
  let marker = false
  for (const label of labels) {
    const ordinal = monitor.mutationOrdinal
    monitor.mutationOrdinal += 1
    monitor.mutations.push({ call, label, ordinal })
    monitor.salient.push(label)
    if (label === 'insert:marker') marker = true
    if (monitor.failOrdinal === ordinal) {
      throwInjectedFailure(`mutation ordinal ${ordinal}:${label}`)
    }
  }
  return { marker }
}

function afterSql(record) {
  if (record?.marker === true) monitor.markerCompleted = true
}

const statementTargets = new WeakMap()

class InstrumentedStatementSync {}

for (const [key, { descriptor, method }] of nativeStatementMethods) {
  Object.defineProperty(InstrumentedStatementSync.prototype, key, {
    ...descriptor,
    value(...parameters) {
      const record = beforeSql(String(key), statementTargets.get(this).sql,
        parameters)
      const result = nativeReflectApply(
        method,
        statementTargets.get(this).target,
        parameters,
      )
      afterSql(record)
      return result
    },
  })
}

function wrapStatement(target, sql) {
  const wrapper = Object.create(InstrumentedStatementSync.prototype)
  statementTargets.set(wrapper, { sql, target })
  return wrapper
}

class InstrumentedDatabaseSync extends NativeDatabaseSync {
  exec(sql) {
    const record = beforeSql('exec', sql, [])
    const result = nativeReflectApply(nativeDatabaseExec, this, [sql])
    afterSql(record)
    if (monitor.enabled && normalizeSql(sql) === 'COMMIT') {
      monitor.commitNativeCompleted = true
      if (monitor.failAfterCommit) {
        throwInjectedFailure('post-native COMMIT')
      }
    }
    return result
  }

  prepare(sql) {
    const target = nativeReflectApply(nativeDatabasePrepare, this, [sql])
    return wrapStatement(target, sql)
  }

  close() {
    return nativeReflectApply(nativeDatabaseClose, this, [])
  }
}

Object.defineProperty(globalThis, '__cdxB2InstrumentedSqlite', {
  value: Object.freeze({
    DatabaseSync: InstrumentedDatabaseSync,
    StatementSync: InstrumentedStatementSync,
  }),
  configurable: false,
  enumerable: false,
  writable: false,
})

const SQLITE_URL = 'palari-cdx-b2:node-sqlite'
const SQLITE_SOURCE =
  'export const DatabaseSync = globalThis.__cdxB2InstrumentedSqlite.DatabaseSync\n' +
  'export const StatementSync = globalThis.__cdxB2InstrumentedSqlite.StatementSync\n'

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'node:sqlite') {
      return { shortCircuit: true, url: SQLITE_URL }
    }
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (url === SQLITE_URL) {
      return { format: 'module', shortCircuit: true, source: SQLITE_SOURCE }
    }
    return nextLoad(url, context)
  },
})

class InstrumentedDate extends nativeDate {
  constructor(...parameters) {
    if (parameters.length === 0 && monitor.enabled) {
      monitor.callbackCounts.clock += 1
      const ordinal = monitor.clockOrdinal
      monitor.clockOrdinal += 1
      monitor.salient.push(
        ordinal === 0
          ? 'callback:clock:a2-m0'
          : ordinal === 1
            ? 'callback:clock:a2-m1'
            : ordinal === 2
              ? 'callback:clock:checkpoint'
              : `callback:clock:${ordinal + 1}`,
      )
      if (monitor.callbacksForbidden || monitor.failClockOrdinal === ordinal) {
        throwInjectedFailure(`clock callback ${ordinal}`)
      }
      super(FIXED_CHECKPOINT_AT)
      return
    }
    super(...parameters)
  }

  static now() {
    if (monitor.enabled) {
      monitor.callbackCounts.clock += 1
      const ordinal = monitor.clockOrdinal
      monitor.clockOrdinal += 1
      monitor.salient.push(
        ordinal === 0
          ? 'callback:clock:a2-m0'
          : ordinal === 1
            ? 'callback:clock:a2-m1'
            : ordinal === 2
              ? 'callback:clock:checkpoint'
              : `callback:clock:${ordinal + 1}`,
      )
      if (monitor.callbacksForbidden || monitor.failClockOrdinal === ordinal) {
        throwInjectedFailure(`clock callback ${ordinal}`)
      }
      return nativeDate.parse(FIXED_CHECKPOINT_AT)
    }
    return nativeDate.now()
  }
}

globalThis.Date = InstrumentedDate

const cryptoRandomUuidDescriptor = Object.getOwnPropertyDescriptor(
  cryptoModule,
  'randomUUID',
)
Object.defineProperty(cryptoModule, 'randomUUID', {
  ...cryptoRandomUuidDescriptor,
  value() {
    if (!monitor.enabled) {
      return nativeReflectApply(cryptoRandomUuidDescriptor.value, undefined, [])
    }
    monitor.callbackCounts.uuid += 1
    const ordinal = monitor.uuidOrdinal
    monitor.uuidOrdinal += 1
    monitor.salient.push(
      ordinal === 0
        ? 'callback:uuid:stream'
        : ordinal === 1
          ? 'callback:uuid:checkpoint'
          : `callback:uuid:${ordinal + 1}`,
    )
    if (monitor.callbacksForbidden || monitor.failUuidOrdinal === ordinal) {
      throwInjectedFailure(`UUID callback ${ordinal}`)
    }
    return FIXED_UUIDS[ordinal] ??
      `00000000-0000-4000-8000-${String(ordinal + 101).padStart(12, '0')}`
  },
})
syncBuiltinESMExports()

const fixtures = await import('../helpers/cdx-b2-fixtures.mjs')
const journal = await import('../../src/cdx-b2-journal.mjs')
const coordinatorModule = await import('../../src/mutation-coordinator.mjs')

const {
  B2_WORKSPACE_ID,
  b2Inventory,
  migrationRows,
  readB2Rows,
  seedCdxM1Schema,
  seedHistoricalCdxSchema,
} = fixtures
const { bootstrapCdxB2InTransaction } = journal
const { createMutationCoordinator } = coordinatorModule

function nativeTransaction(db) {
  return nativeReflectApply(nativeDatabaseIsTransaction, db, [])
}

function nativeOpen(db) {
  return nativeReflectApply(nativeDatabaseIsOpen, db, [])
}

function closeDatabase(db) {
  if (!nativeOpen(db)) return
  if (nativeTransaction(db)) nativeReflectApply(nativeDatabaseExec, db, ['ROLLBACK'])
  nativeReflectApply(nativeDatabaseClose, db, [])
}

function rows(db, sql, parameters = []) {
  const statement = nativeReflectApply(nativeDatabasePrepare, db, [sql])
  return nativeReflectApply(
    NativeStatementSync.prototype.all,
    statement,
    parameters,
  ).map((row) => ({ ...row }))
}

function row(db, sql, parameters = []) {
  const statement = nativeReflectApply(nativeDatabasePrepare, db, [sql])
  const value = nativeReflectApply(
    NativeStatementSync.prototype.get,
    statement,
    parameters,
  )
  return value === undefined ? null : { ...value }
}

function durableSnapshot(db) {
  return {
    fts: rows(db, `
      SELECT rowid, memory_id, palari_id, content, keywords
      FROM main.memory_fts ORDER BY rowid
    `),
    links: rows(db, 'SELECT * FROM main.memory_links ORDER BY id COLLATE BINARY'),
    memories: rows(db, 'SELECT * FROM main.memories ORDER BY id COLLATE BINARY'),
    migrations: rows(
      db,
      'SELECT id, applied_at FROM main.memory_migrations ORDER BY id COLLATE BINARY',
    ),
    schema: rows(db, `
      SELECT type, name, tbl_name, sql
      FROM main.sqlite_schema
      ORDER BY type COLLATE BINARY, name COLLATE BINARY
    `),
    xinfo: rows(db, 'PRAGMA main.table_xinfo(memories)'),
  }
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function absentB2State(db) {
  return {
    inventoryCount: b2Inventory(db).length,
    markerCount: row(
      db,
      "SELECT count(*) AS count FROM main.memory_migrations WHERE id='CDX-B2'",
    ).count,
  }
}

function runBootstrap(coordinator, db, options = {}) {
  let result
  let error = null
  resetMonitor(options)
  try {
    result = coordinator.run((lease) => {
      const state = bootstrapCdxB2InTransaction(
        lease,
        db,
        { workspaceId: B2_WORKSPACE_ID },
      )
      if (options.failCallback === true) {
        throwInjectedFailure('outer callback')
      }
      return state
    })
  } catch (caught) {
    error = serializeError(caught)
  }
  const instrumentation = snapshotMonitor()
  stopMonitor()
  return { error, instrumentation, result }
}

function completeDatabase() {
  const db = new InstrumentedDatabaseSync(':memory:')
  seedCdxM1Schema(db, 0)
  return db
}

function compactState(state) {
  if (state === undefined) return null
  return {
    streamId: state.streamId,
    headMutationSequence: state.headMutationSequence,
    lastObservedAt: state.lastObservedAt,
    authorityLedgerId: state.authorityLedgerId,
    checkpointMemoryCount: state.checkpointMemoryCount,
    checkpointLinkCount: state.checkpointLinkCount,
  }
}

function runNewBootstrapTrace() {
  const db = completeDatabase()
  try {
    const coordinator = createMutationCoordinator(db)
    const attempt = runBootstrap(coordinator, db)
    return {
      error: attempt.error,
      state: compactState(attempt.result),
      transactionInactive: nativeTransaction(db) === false,
      ...attempt.instrumentation,
    }
  } finally {
    closeDatabase(db)
  }
}

function runReopen() {
  const db = completeDatabase()
  try {
    const coordinator = createMutationCoordinator(db)
    const initialized = runBootstrap(coordinator, db)
    if (initialized.error !== null) {
      return {
        initializationError: initialized.error,
        reopenError: null,
        firstState: compactState(initialized.result),
        reopenedState: null,
        rowsUnchanged: false,
        transactionInactive: nativeTransaction(db) === false,
        callbackCounts: { clock: 0, uuid: 0 },
        mutations: [],
        salient: [],
        writes: [],
      }
    }
    const rowsBefore = readB2Rows(db)
    const reopened = runBootstrap(coordinator, db, { callbacksForbidden: true })
    return {
      initializationError: initialized.error,
      reopenError: reopened.error,
      firstState: compactState(initialized.result),
      reopenedState: compactState(reopened.result),
      rowsUnchanged: sameValue(readB2Rows(db), rowsBefore),
      transactionInactive: nativeTransaction(db) === false,
      ...reopened.instrumentation,
    }
  } finally {
    closeDatabase(db)
  }
}

function runFailureCase(definition) {
  const db = completeDatabase()
  try {
    const coordinator = createMutationCoordinator(db)
    const before = durableSnapshot(db)
    const failed = runBootstrap(coordinator, db, definition.options)
    const absent = absentB2State(db)
    const unchanged = sameValue(durableSnapshot(db), before)
    const transactionInactive = nativeTransaction(db) === false
    const retry = runBootstrap(coordinator, db)
    return {
      label: definition.label,
      error: failed.error,
      callbackCounts: failed.instrumentation.callbackCounts,
      failedMutations: failed.instrumentation.mutations.map(({ label }) => label),
      failedSalient: failed.instrumentation.salient,
      failedVerifyReads: failed.instrumentation.verifyReads,
      injected: failed.instrumentation.injected,
      inventoryCount: absent.inventoryCount,
      markerCount: absent.markerCount,
      retryError: retry.error,
      retryState: compactState(retry.result),
      transactionInactive,
      unchanged,
    }
  } finally {
    closeDatabase(db)
  }
}

function runFailureMatrix(expectedMutations) {
  const results = []
  for (let ordinal = 0; ordinal < expectedMutations.length; ordinal += 1) {
    results.push(runFailureCase({
      label: `mutation:${ordinal}:${expectedMutations[ordinal].label}`,
      options: { failOrdinal: ordinal },
    }))
  }
  results.push(runFailureCase({
    label: 'outer-callback',
    options: { failCallback: true },
  }))
  results.push(runFailureCase({
    label: 'commit',
    options: { failCommit: true },
  }))
  return results
}

function runBoundaryFailureMatrix() {
  return [
    runFailureCase({
      label: 'snapshot:memories',
      options: { failSnapshot: 'memories' },
    }),
    runFailureCase({
      label: 'snapshot:links',
      options: { failSnapshot: 'links' },
    }),
    runFailureCase({
      label: 'callback:clock:checkpoint',
      options: { failClockOrdinal: 2 },
    }),
    runFailureCase({
      label: 'callback:uuid:stream',
      options: { failUuidOrdinal: 0 },
    }),
    runFailureCase({
      label: 'callback:uuid:checkpoint',
      options: { failUuidOrdinal: 1 },
    }),
  ]
}

function runVerifyReadFailureMatrix(verifyReads) {
  return verifyReads.map((target) => ({
    ...runFailureCase({
      label: `verify-read:${target.ordinal}`,
      options: { failVerifyReadOrdinal: target.ordinal },
    }),
    target,
  }))
}

function runPostCommitUncertainty() {
  const db = completeDatabase()
  try {
    const coordinator = createMutationCoordinator(db)
    const uncertain = runBootstrap(coordinator, db, { failAfterCommit: true })
    const committedRows = readB2Rows(db)
    const inventory = b2Inventory(db)
    const markerCount = row(
      db,
      "SELECT count(*) AS count FROM main.memory_migrations WHERE id='CDX-B2'",
    ).count

    let poisonedError = null
    try {
      coordinator.run(() => null)
    } catch (caught) {
      poisonedError = serializeError(caught)
    }

    const replacement = createMutationCoordinator(db)
    const reopened = runBootstrap(replacement, db, { callbacksForbidden: true })
    return {
      callbackCounts: reopened.instrumentation.callbackCounts,
      commitNativeCompleted: uncertain.instrumentation.commitNativeCompleted,
      error: uncertain.error,
      injected: uncertain.instrumentation.injected,
      inventoryNames: inventory.map(({ name }) => name),
      markerCount,
      poisonedError,
      reopenError: reopened.error,
      reopenedState: compactState(reopened.result),
      rowCounts: Object.fromEntries(
        Object.entries(committedRows).map(([name, values]) => [name, values.length]),
      ),
      rowsUnchanged: sameValue(readB2Rows(db), committedRows),
      transactionInactive: nativeTransaction(db) === false,
      writes: reopened.instrumentation.writes,
    }
  } finally {
    closeDatabase(db)
  }
}

function runHistoricalRepairRollback() {
  const db = new InstrumentedDatabaseSync(':memory:')
  seedHistoricalCdxSchema(db, 2)
  try {
    const coordinator = createMutationCoordinator(db)
    const before = durableSnapshot(db)
    const failed = runBootstrap(coordinator, db, { failCallback: true })
    const absent = absentB2State(db)
    const afterFailureColumns = rows(
      db,
      'PRAGMA main.table_xinfo(memories)',
    ).map(({ name }) => name)
    const migrationsAfterFailure = migrationRows(db).map(({ id }) => id)
    const repairRolledBack = sameValue(durableSnapshot(db), before)
    const retry = runBootstrap(coordinator, db)
    const meta = retry.error === null
      ? row(
          db,
          'SELECT legacy_schema_variant FROM main.cdx_b2_meta WHERE singleton=1',
        )
      : null
    return {
      error: failed.error,
      inventoryCount: absent.inventoryCount,
      markerCount: absent.markerCount,
      migrationsAfterFailure,
      repairRolledBack,
      columnsAfterFailure: afterFailureColumns,
      retryError: retry.error,
      retryState: compactState(retry.result),
      retryVariant: meta?.legacy_schema_variant ?? null,
      transactionInactive: nativeTransaction(db) === false,
    }
  } finally {
    closeDatabase(db)
  }
}

if (process.argv[2] !== 'task-3') {
  throw new Error(`Unknown CDX-B2 instrumentation scenario: ${process.argv[2]}`)
}

const newBootstrap = runNewBootstrapTrace()
const result = {
  newBootstrap,
  reopen: runReopen(),
  boundaryFailureMatrix: runBoundaryFailureMatrix(),
  failureMatrix: runFailureMatrix(newBootstrap.mutations),
  historicalRepair: runHistoricalRepairRollback(),
  postCommitUncertainty: runPostCommitUncertainty(),
  verifyReadFailureMatrix: runVerifyReadFailureMatrix(newBootstrap.verifyReads),
}
process.stdout.write(`${JSON.stringify(result)}\n`)

// V2-M2-B Task 5 — clean-realm bridge fault/race instrumentation.

import cryptoModule from 'node:crypto'
import { syncBuiltinESMExports } from 'node:module'
import { DatabaseSync, StatementSync } from 'node:sqlite'

import {
  B2_WORKSPACE_ID,
  b2Identifier,
  createCdxM1Fixture,
  seedB2Memory,
} from '../helpers/cdx-b2-fixtures.mjs'

if (process.argv[2] !== 'task-5') {
  throw new Error(`Unknown governed bridge instrumentation mode: ${process.argv[2]}`)
}

const nativeReflectApply = Reflect.apply
const nativeDate = Date
const nativeDatabaseExec = DatabaseSync.prototype.exec
const nativeDatabasePrepare = DatabaseSync.prototype.prepare
const nativeDatabaseClose = DatabaseSync.prototype.close
const nativeStatementAll = StatementSync.prototype.all
const nativeStatementGet = StatementSync.prototype.get
const nativeStatementRun = StatementSync.prototype.run

const databaseProbe = new DatabaseSync(':memory:', { open: false })
const nativeDatabaseIsOpen = Object.getOwnPropertyDescriptor(
  databaseProbe,
  'isOpen',
).get
const nativeDatabaseIsTransaction = Object.getOwnPropertyDescriptor(
  databaseProbe,
  'isTransaction',
).get

const TARGET_ID = b2Identifier('mem_', 501)
const LEDGER_A = b2Identifier('led_', 601)
const LEDGER_B = b2Identifier('led_', 602)
const EVIDENCE_AT = '2026-07-21T09:30:00.000Z'
const EXPIRES_AT = '2026-07-21T11:00:00.000Z'
const CHECKPOINT_AT = '2026-07-21T10:00:00.000Z'
const ISSUE_AT = '2026-07-21T10:00:00.000Z'
const OBSERVED_AT = '2026-07-21T10:01:00.000Z'
const RETRY_AT = '2026-07-21T10:02:00.000Z'

const statementSql = new WeakMap()
let clockReadings = [nativeDate.parse(ISSUE_AT)]
let clockIndex = 0
let uuidCount = 0

const monitor = {
  beforeCommitHook: null,
  controls: [],
  enabled: false,
  faultLabel: null,
  fired: false,
  injected: null,
  writes: [],
}

function normalizeSql(sql) {
  return String(sql).replace(/\s+/g, ' ').trim()
}

function setClock(readings) {
  clockReadings = readings.map((value) => nativeDate.parse(value))
  clockIndex = 0
}

class InstrumentedDate extends nativeDate {
  constructor(...parameters) {
    if (parameters.length === 0) {
      super(CHECKPOINT_AT)
      return
    }
    super(...parameters)
  }

  static now() {
    const index = Math.min(clockIndex, clockReadings.length - 1)
    clockIndex += 1
    return clockReadings[index]
  }
}

globalThis.Date = InstrumentedDate

Object.defineProperty(cryptoModule, 'randomUUID', {
  ...Object.getOwnPropertyDescriptor(cryptoModule, 'randomUUID'),
  value() {
    uuidCount += 1
    return `20000000-0000-4000-8000-${String(uuidCount).padStart(12, '0')}`
  },
})
syncBuiltinESMExports()

function classifyWrite(sql, parameters) {
  if (/^INSERT INTO main\.cdx_b2_decisions\(/.test(sql)) {
    return 'decision-insert'
  }
  if (/^INSERT INTO main\.cdx_b2_effects\(/.test(sql)) {
    return `effect-insert-${parameters[1]}`
  }
  if (/^DELETE FROM main\.memories WHERE id = \?$/.test(sql)) {
    return 'projection-delete'
  }
  if (/^UPDATE main\.cdx_b2_meta SET head_mutation_sequence = \?/.test(sql)) {
    return 'head-update'
  }
  return null
}

DatabaseSync.prototype.exec = function instrumentedExec(sql) {
  const normalized = normalizeSql(sql)
  if (monitor.enabled && [
    'BEGIN IMMEDIATE',
    'COMMIT',
    'ROLLBACK',
  ].includes(normalized)) {
    monitor.controls.push(normalized)
  }

  if (monitor.enabled && normalized === 'COMMIT') {
    if (monitor.beforeCommitHook !== null) {
      const hook = monitor.beforeCommitHook
      monitor.beforeCommitHook = null
      hook()
    }
    if (monitor.faultLabel === 'commit-before' && monitor.fired === false) {
      monitor.fired = true
      throw monitor.injected
    }
    const result = nativeReflectApply(nativeDatabaseExec, this, [sql])
    if (monitor.faultLabel === 'commit-after' && monitor.fired === false) {
      monitor.fired = true
      throw monitor.injected
    }
    return result
  }

  return nativeReflectApply(nativeDatabaseExec, this, [sql])
}

DatabaseSync.prototype.prepare = function instrumentedPrepare(sql) {
  const statement = nativeReflectApply(nativeDatabasePrepare, this, [sql])
  statementSql.set(statement, normalizeSql(sql))
  return statement
}

StatementSync.prototype.all = function instrumentedAll(...parameters) {
  return nativeReflectApply(nativeStatementAll, this, parameters)
}

StatementSync.prototype.get = function instrumentedGet(...parameters) {
  return nativeReflectApply(nativeStatementGet, this, parameters)
}

StatementSync.prototype.run = function instrumentedRun(...parameters) {
  const sql = statementSql.get(this)
  const label = classifyWrite(sql, parameters)
  if (monitor.enabled && label !== null) {
    monitor.writes.push(label)
  }
  const result = nativeReflectApply(nativeStatementRun, this, parameters)
  if (
    monitor.enabled &&
    label !== null &&
    monitor.faultLabel === label &&
    monitor.fired === false
  ) {
    monitor.fired = true
    throw monitor.injected
  }
  return result
}

const authority = await import('../../src/memory-authority.mjs')
const bridgeModule = await import('../../src/governed-memory-bridge.mjs')

const {
  createMemoryAuthorityRoot,
  issueMemoryAuthorityGrant,
} = authority
const { createGovernedMemoryBridge } = bridgeModule

function startMonitor({ faultLabel = null, beforeCommitHook = null } = {}) {
  monitor.beforeCommitHook = beforeCommitHook
  monitor.controls = []
  monitor.enabled = true
  monitor.faultLabel = faultLabel
  monitor.fired = false
  monitor.injected = faultLabel === null
    ? null
    : new Error(`injected bridge fault: ${faultLabel}`)
  monitor.writes = []
}

function stopMonitor() {
  const result = {
    controls: [...monitor.controls],
    fired: monitor.fired,
    injected: monitor.injected,
    writes: [...monitor.writes],
  }
  monitor.beforeCommitHook = null
  monitor.enabled = false
  monitor.faultLabel = null
  monitor.injected = null
  return result
}

function nativeOpen(db) {
  return nativeReflectApply(nativeDatabaseIsOpen, db, [])
}

function nativeTransaction(db) {
  return nativeReflectApply(nativeDatabaseIsTransaction, db, [])
}

function closeDatabase(db) {
  if (!nativeOpen(db)) return
  if (nativeTransaction(db)) {
    nativeReflectApply(nativeDatabaseExec, db, ['ROLLBACK'])
  }
  nativeReflectApply(nativeDatabaseClose, db, [])
}

function nativeGet(db, sql, parameters = []) {
  const statement = nativeReflectApply(nativeDatabasePrepare, db, [sql])
  return nativeReflectApply(nativeStatementGet, statement, parameters)
}

function nativeAll(db, sql, parameters = []) {
  const statement = nativeReflectApply(nativeDatabasePrepare, db, [sql])
  return nativeReflectApply(nativeStatementAll, statement, parameters)
}

function snapshotState(db) {
  const effects = nativeAll(db, `
    SELECT effect_ordinal, effect_kind
    FROM main.cdx_b2_effects
    ORDER BY decision_sequence, effect_ordinal
  `).map((row) => ({
    effectKind: row.effect_kind,
    effectOrdinal: row.effect_ordinal,
  }))
  const reasons = nativeAll(db, `
    SELECT reason_code
    FROM main.cdx_b2_decisions
    ORDER BY sequence
  `).map((row) => row.reason_code)
  return {
    decisionCount: nativeGet(
      db,
      'SELECT count(*) AS count FROM main.cdx_b2_decisions',
    ).count,
    effectCount: nativeGet(
      db,
      'SELECT count(*) AS count FROM main.cdx_b2_effects',
    ).count,
    effects,
    ftsCount: nativeGet(
      db,
      'SELECT count(*) AS count FROM main.memory_fts WHERE memory_id = ?',
      [TARGET_ID],
    ).count,
    head: nativeGet(
      db,
      'SELECT head_mutation_sequence AS head FROM main.cdx_b2_meta WHERE singleton = 1',
    ).head,
    memoryCount: nativeGet(
      db,
      'SELECT count(*) AS count FROM main.memories WHERE id = ?',
      [TARGET_ID],
    ).count,
    reasons,
  }
}

function captureThrown(callback) {
  try {
    callback()
    return null
  } catch (error) {
    return error
  }
}

function summarizeError(error, injected = null) {
  if (error === null) return null
  return {
    code: error?.code ?? null,
    isInjected: error === injected,
    message: error?.message ?? null,
    name: error?.name ?? null,
  }
}

function rootInput(ledgerId, activity) {
  return {
    workspaceId: B2_WORKSPACE_ID,
    palariId: 'palari-b2',
    userId: 'user-b2',
    authorityLedgerId: ledgerId,
    checkGrantActive() {
      activity.calls += 1
      return true
    },
  }
}

function grantInput(ordinal) {
  return {
    authorityEventId: b2Identifier('agr_', 700 + ordinal),
    capabilityId: b2Identifier('cap_', 700 + ordinal),
    evidenceAt: EVIDENCE_AT,
    expiresAt: EXPIRES_AT,
    targetId: TARGET_ID,
    verb: 'erase_atom',
  }
}

function makeRoot(ledgerId, activity) {
  return createMemoryAuthorityRoot(rootInput(ledgerId, activity))
}

function issueGrant(root, ordinal) {
  return issueMemoryAuthorityGrant(root, grantInput(ordinal))
}

function createSeededFixture() {
  const fixture = createCdxM1Fixture(0, { withRows: false })
  seedB2Memory(fixture.db, {
    id: TARGET_ID,
    memoryType: 'preference',
    palariId: 'palari-b2',
    shared: 0,
    userId: 'user-b2',
    validUntil: null,
  })
  return fixture
}

function createBridge(db, root) {
  return createGovernedMemoryBridge(db, {
    workspaceId: B2_WORKSPACE_ID,
    authorityRoot: root,
  })
}

function erase(bridge, grant) {
  return bridge.erase(
    TARGET_ID,
    { actor: 'explicit_user_action' },
    grant,
  )
}

function summarizeResult(value) {
  if (value === null || value === undefined) return value
  const result = {
    deleted: value.deleted,
    reason: value.reason,
  }
  if (value.memory !== undefined) result.targetId = value.memory.id
  return result
}

function rootIssueCode(root, ordinal) {
  const error = captureThrown(() => issueGrant(root, ordinal))
  return error?.code ?? null
}

function bridgePoisonCode(bridge) {
  const error = captureThrown(() => bridge.refuse('legacy_proposal'))
  return error?.code ?? null
}

function closeBridge(bridge) {
  if (bridge === null || bridge === undefined) return
  try {
    bridge.close()
  } catch {}
}

function runRollbackOrdinal(label, ordinal) {
  setClock([ISSUE_AT, OBSERVED_AT, RETRY_AT, RETRY_AT])
  const fixture = createSeededFixture()
  const activity = { calls: 0 }
  const root = makeRoot(LEDGER_A, activity)
  const bridge = createBridge(fixture.db, root)
  const grant = issueGrant(root, ordinal)
  let observer
  try {
    startMonitor({ faultLabel: label })
    const error = captureThrown(() => erase(bridge, grant))
    const trace = stopMonitor()
    observer = new DatabaseSync(fixture.dbPath)
    const afterFailure = snapshotState(observer)

    let retryResult = null
    let afterRetry = null
    if (label === 'projection-delete') {
      retryResult = summarizeResult(erase(bridge, grant))
      afterRetry = snapshotState(observer)
    }

    return {
      activityCalls: activity.calls,
      afterFailure,
      afterRetry,
      controls: trace.controls,
      error: summarizeError(error, trace.injected),
      fired: trace.fired,
      label,
      poisonCode: bridgePoisonCode(bridge),
      retryResult,
      rootIssueCode: rootIssueCode(root, 100 + ordinal),
      targetId: TARGET_ID,
      transactionInactive: nativeTransaction(fixture.db) === false,
      writes: trace.writes,
    }
  } finally {
    if (monitor.enabled) stopMonitor()
    closeBridge(bridge)
    if (observer !== undefined) closeDatabase(observer)
    fixture.close()
  }
}

function runCommitKnownFailed() {
  setClock([ISSUE_AT, OBSERVED_AT, RETRY_AT, RETRY_AT])
  const fixture = createSeededFixture()
  const activity = { calls: 0 }
  const root = makeRoot(LEDGER_A, activity)
  const bridge = createBridge(fixture.db, root)
  const grant = issueGrant(root, 20)
  let observer
  try {
    startMonitor({ faultLabel: 'commit-before' })
    const error = captureThrown(() => erase(bridge, grant))
    const trace = stopMonitor()
    observer = new DatabaseSync(fixture.dbPath)
    const afterFailure = snapshotState(observer)
    const retryResult = summarizeResult(erase(bridge, grant))
    const afterRetry = snapshotState(observer)
    return {
      activityCalls: activity.calls,
      afterFailure,
      afterRetry,
      controls: trace.controls,
      error: summarizeError(error, trace.injected),
      poisonCode: bridgePoisonCode(bridge),
      retryResult,
      rootIssueCode: rootIssueCode(root, 120),
      targetId: TARGET_ID,
      transactionInactive: nativeTransaction(fixture.db) === false,
    }
  } finally {
    if (monitor.enabled) stopMonitor()
    closeBridge(bridge)
    if (observer !== undefined) closeDatabase(observer)
    fixture.close()
  }
}

function runCommitUnknown() {
  setClock([ISSUE_AT, OBSERVED_AT])
  const fixture = createSeededFixture()
  const activity = { calls: 0 }
  const root = makeRoot(LEDGER_A, activity)
  const bridge = createBridge(fixture.db, root)
  const grant = issueGrant(root, 21)
  let observer
  try {
    startMonitor({ faultLabel: 'commit-after' })
    const error = captureThrown(() => erase(bridge, grant))
    const trace = stopMonitor()
    observer = new DatabaseSync(fixture.dbPath)
    return {
      activityCalls: activity.calls,
      afterFailure: snapshotState(observer),
      controls: trace.controls,
      error: summarizeError(error, trace.injected),
      poisonCode: bridgePoisonCode(bridge),
      rootIssueCode: rootIssueCode(root, 121),
      transactionInactive: nativeTransaction(fixture.db) === false,
    }
  } finally {
    if (monitor.enabled) stopMonitor()
    closeBridge(bridge)
    if (observer !== undefined) closeDatabase(observer)
    fixture.close()
  }
}

function runLowerPersistedClock() {
  setClock([
    '2026-07-21T10:00:00.000Z',
    '2026-07-21T10:10:00.000Z',
  ])
  const fixture = createSeededFixture()
  const firstActivity = { calls: 0 }
  const firstRoot = makeRoot(LEDGER_A, firstActivity)
  const firstBridge = createBridge(fixture.db, firstRoot)
  const firstGrant = issueGrant(firstRoot, 30)
  let secondDb
  let secondBridge
  try {
    erase(firstBridge, firstGrant)
    const before = snapshotState(fixture.db)
    closeBridge(firstBridge)
    closeDatabase(fixture.db)

    setClock([
      '2026-07-21T10:04:00.000Z',
      '2026-07-21T10:05:00.000Z',
    ])
    secondDb = new DatabaseSync(fixture.dbPath)
    const secondActivity = { calls: 0 }
    const secondRoot = makeRoot(LEDGER_A, secondActivity)
    secondBridge = createBridge(secondDb, secondRoot)
    const secondGrant = issueGrant(secondRoot, 31)
    const uuidBefore = uuidCount
    startMonitor()
    const error = captureThrown(() => erase(secondBridge, secondGrant))
    const trace = stopMonitor()
    return {
      after: snapshotState(secondDb),
      before,
      controls: trace.controls,
      error: summarizeError(error),
      poisonCode: bridgePoisonCode(secondBridge),
      rootIssueCode: rootIssueCode(secondRoot, 131),
      transactionInactive: nativeTransaction(secondDb) === false,
      uuidDelta: uuidCount - uuidBefore,
    }
  } finally {
    if (monitor.enabled) stopMonitor()
    closeBridge(secondBridge)
    if (secondDb !== undefined) closeDatabase(secondDb)
    fixture.close()
  }
}

function runDifferentLedgerRace() {
  setClock([
    '2026-07-21T10:00:00.000Z',
    '2026-07-21T10:01:00.000Z',
    '2026-07-21T10:03:00.000Z',
    '2026-07-21T10:02:00.000Z',
  ])
  const fixture = createSeededFixture()
  const firstActivity = { calls: 0 }
  const secondActivity = { calls: 0 }
  const firstRoot = makeRoot(LEDGER_A, firstActivity)
  const secondRoot = makeRoot(LEDGER_B, secondActivity)
  const firstBridge = createBridge(fixture.db, firstRoot)
  const secondDb = new DatabaseSync(fixture.dbPath)
  const secondBridge = createBridge(secondDb, secondRoot)
  const firstGrant = issueGrant(firstRoot, 40)
  const secondGrant = issueGrant(secondRoot, 41)
  try {
    erase(firstBridge, firstGrant)
    const before = snapshotState(secondDb)
    const uuidBefore = uuidCount
    startMonitor()
    const error = captureThrown(() => erase(secondBridge, secondGrant))
    const trace = stopMonitor()
    let bridgeReadResult = null
    const bridgeReadError = captureThrown(() => {
      bridgeReadResult = secondBridge.refuse('legacy_proposal')
    })
    return {
      after: snapshotState(secondDb),
      before,
      bridgeReadErrorCode: bridgeReadError?.code ?? null,
      bridgeReadResult,
      controls: trace.controls,
      error: summarizeError(error),
      rootIssueCode: rootIssueCode(secondRoot, 141),
      transactionInactive: nativeTransaction(secondDb) === false,
      uuidDelta: uuidCount - uuidBefore,
    }
  } finally {
    if (monitor.enabled) stopMonitor()
    closeBridge(secondBridge)
    closeBridge(firstBridge)
    closeDatabase(secondDb)
    fixture.close()
  }
}

function runSameLedgerBusyVisibility() {
  setClock([
    '2026-07-21T10:00:00.000Z',
    '2026-07-21T10:01:00.000Z',
    '2026-07-21T10:02:00.000Z',
    '2026-07-21T10:03:00.000Z',
    '2026-07-21T10:04:00.000Z',
    '2026-07-21T10:04:00.000Z',
  ])
  const fixture = createSeededFixture()
  const firstActivity = { calls: 0 }
  const secondActivity = { calls: 0 }
  const firstRoot = makeRoot(LEDGER_A, firstActivity)
  const secondRoot = makeRoot(LEDGER_A, secondActivity)
  const firstBridge = createBridge(fixture.db, firstRoot)
  const secondDb = new DatabaseSync(fixture.dbPath)
  const secondBridge = createBridge(secondDb, secondRoot)
  const firstGrant = issueGrant(firstRoot, 50)
  const secondGrant = issueGrant(secondRoot, 51)
  let hookCalls = 0
  let writerBeforeCommit
  let observerBeforeCommit
  let observerAfterBusy
  let busyError
  try {
    startMonitor({
      beforeCommitHook() {
        hookCalls += 1
        writerBeforeCommit = snapshotState(fixture.db)
        observerBeforeCommit = snapshotState(secondDb)
        busyError = captureThrown(() => erase(secondBridge, secondGrant))
        observerAfterBusy = snapshotState(secondDb)
      },
    })
    const firstResult = summarizeResult(erase(firstBridge, firstGrant))
    stopMonitor()
    const observerAfterCommit = snapshotState(secondDb)
    const retryResult = summarizeResult(erase(secondBridge, secondGrant))
    const finalState = snapshotState(secondDb)
    return {
      activityCalls: {
        first: firstActivity.calls,
        second: secondActivity.calls,
      },
      busyError: summarizeError(busyError),
      finalState,
      firstResult,
      hookCalls,
      observerAfterBusy,
      observerAfterCommit,
      observerBeforeCommit,
      retryResult,
      secondRootIssueCode: rootIssueCode(secondRoot, 151),
      targetId: TARGET_ID,
      writerBeforeCommit,
    }
  } finally {
    if (monitor.enabled) stopMonitor()
    closeBridge(secondBridge)
    closeBridge(firstBridge)
    closeDatabase(secondDb)
    fixture.close()
  }
}

const rollbackOrdinals = [
  'decision-insert',
  'effect-insert-0',
  'effect-insert-1',
  'projection-delete',
  'head-update',
].map((label, index) => runRollbackOrdinal(label, index + 1))

const output = {
  rollbackOrdinals,
  commitKnownFailed: runCommitKnownFailed(),
  commitUnknown: runCommitUnknown(),
  lowerPersistedClock: runLowerPersistedClock(),
  differentLedgerRace: runDifferentLedgerRace(),
  sameLedgerBusyVisibility: runSameLedgerBusyVisibility(),
}

process.stdout.write(`${JSON.stringify(output)}\n`)

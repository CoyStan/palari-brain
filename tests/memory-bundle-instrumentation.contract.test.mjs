import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const CHILD_PATH = fileURLToPath(
  new URL('./fixtures/memory-bundle-instrumentation-child.mjs', import.meta.url),
)

function runScenario(name) {
  const child = spawnSync(process.execPath, [CHILD_PATH, name], {
    encoding: 'utf8',
  })
  assert.equal(
    child.status,
    0,
    `instrumentation child failed\nstdout:\n${child.stdout}\nstderr:\n${child.stderr}`,
  )
  const lines = child.stdout.trim().split('\n')
  assert.equal(lines.length, 1)
  return JSON.parse(lines[0])
}

test('M1-02 captures one unopened probe before all native dispatch paths', () => {
  const {
    trace,
    row,
    rows,
    dynamicDatabaseDispatchCallCount,
    dynamicStatementDispatchCallCount,
  } = runScenario('M1-02-native-capture')

  assert.deepEqual(trace, [
    {
      operation: 'construct',
      args: [':memory:', { open: false }],
    },
    {
      operation: 'construct',
      args: [':memory:'],
    },
    {
      operation: 'exec',
      sql: 'CREATE TABLE capture_probe (id INTEGER PRIMARY KEY, value TEXT NOT NULL)',
    },
    {
      operation: 'prepare',
      sql: 'INSERT INTO capture_probe (id, value) VALUES (?, ?)',
    },
    {
      operation: 'setReadBigInts',
      value: false,
    },
    {
      operation: 'setReturnArrays',
      value: false,
    },
    {
      operation: 'run',
      parameters: [7, 'seven'],
    },
    {
      operation: 'prepare',
      sql: 'SELECT value FROM capture_probe WHERE id = ?',
    },
    {
      operation: 'setReadBigInts',
      value: false,
    },
    {
      operation: 'setReturnArrays',
      value: false,
    },
    {
      operation: 'get',
      parameters: [7],
    },
    {
      operation: 'prepare',
      sql: 'SELECT id, value FROM capture_probe ORDER BY id',
    },
    {
      operation: 'setReadBigInts',
      value: false,
    },
    {
      operation: 'setReturnArrays',
      value: false,
    },
    {
      operation: 'all',
      parameters: [],
    },
    {
      operation: 'close',
    },
  ])
  assert.deepEqual(row, { value: 'seven' })
  assert.deepEqual(rows, [{ id: 7, value: 'seven' }])
  assert.equal(dynamicDatabaseDispatchCallCount, 0)
  assert.equal(dynamicStatementDispatchCallCount, 0)
})

test('M1-07 re-inventories exactly after read COMMIT and resolves existing, raced, busy, and absent states', () => {
  const {
    existing,
    complete,
    semanticallyInvalid,
    partial,
    busy,
    absent,
  } = runScenario(
    'M1-07-initializer-race-window',
  )

  assert.equal(existing.returnedUndefined, true)
  assert.equal(existing.error, null)
  assert.deepEqual(existing.callbackCalls, [])
  assert.deepEqual(existing.transactionControls, ['BEGIN', 'COMMIT'])
  assert.equal(existing.objects.length, 13)
  assert.equal(existing.isTransactionAfter, false)

  assert.equal(complete.returnedUndefined, true)
  assert.equal(complete.error, null)
  assert.equal(complete.raceFired, true)
  assert.deepEqual(complete.callbackCalls, [])
  assert.deepEqual(complete.transactionControls, [
    'BEGIN',
    'COMMIT',
    'BEGIN IMMEDIATE',
    'COMMIT',
  ])
  assert.equal(complete.objects.length, 13)
  assert.equal(complete.isTransactionAfter, false)

  assert.equal(semanticallyInvalid.returnedUndefined, false)
  assert.equal(semanticallyInvalid.error?.name, 'MemoryBundleError')
  assert.equal(semanticallyInvalid.error?.code, 'bundle_missing_atom')
  assert.equal(semanticallyInvalid.raceFired, true)
  assert.deepEqual(semanticallyInvalid.callbackCalls, [])
  assert.deepEqual(semanticallyInvalid.transactionControls, [
    'BEGIN',
    'COMMIT',
    'BEGIN IMMEDIATE',
    'ROLLBACK',
  ])
  assert.equal(semanticallyInvalid.objects.length, 13)
  assert.deepEqual(semanticallyInvalid.semanticCounts, {
    headSequence: 1,
    eventCount: 1,
    atomCount: 0,
  })
  assert.equal(semanticallyInvalid.isTransactionAfter, false)

  assert.equal(partial.returnedUndefined, false)
  assert.equal(partial.error?.name, 'MemoryBundleError')
  assert.equal(partial.error?.code, 'bundle_layout_invalid')
  assert.equal(partial.raceFired, true)
  assert.deepEqual(partial.callbackCalls, [])
  assert.deepEqual(partial.transactionControls, [
    'BEGIN',
    'COMMIT',
    'BEGIN IMMEDIATE',
    'ROLLBACK',
  ])
  assert.deepEqual(partial.objects, [
    { type: 'table', name: 'memory_bundle_unknown' },
  ])
  assert.equal(partial.isTransactionAfter, false)

  assert.equal(busy.returnedUndefined, false)
  assert.equal(busy.error?.name, 'MemoryBundleError')
  assert.equal(busy.error?.code, 'bundle_busy')
  assert.equal(busy.raceFired, true)
  assert.deepEqual(busy.callbackCalls, [])
  assert.deepEqual(busy.transactionControls, [
    'BEGIN',
    'COMMIT',
    'BEGIN IMMEDIATE',
  ])
  assert.deepEqual(busy.objects, [])
  assert.equal(busy.isTransactionAfter, false)

  assert.equal(absent.returnedUndefined, true)
  assert.equal(absent.error, null)
  assert.equal(absent.raceFired, true)
  assert.deepEqual(absent.callbackCalls, [
    { callback: 'clock', thisIsUndefined: true, argumentCount: 0 },
    { callback: 'idFactory', thisIsUndefined: true, argumentCount: 0 },
  ])
  assert.deepEqual(absent.transactionControls, [
    'BEGIN',
    'COMMIT',
    'BEGIN IMMEDIATE',
    'COMMIT',
  ])
  assert.equal(absent.objects.length, 13)
  assert.equal(absent.isTransactionAfter, false)

  for (const state of [complete, semanticallyInvalid, partial, absent]) {
    assert.equal(
      state.transactionControls.filter((sql) => sql === 'BEGIN IMMEDIATE').length,
      1,
    )
    assert.deepEqual(state.transactionControls.slice(0, 3), [
      'BEGIN',
      'COMMIT',
      'BEGIN IMMEDIATE',
    ])
  }
})

test('M1-07 rollback failure replaces callback and DDL primary failures with bundle_storage_error', () => {
  const results = runScenario('M1-07-initializer-rollback-precedence')

  for (const name of ['callback', 'ddl']) {
    const result = results[name]
    assert.equal(result.error?.name, 'MemoryBundleError', name)
    assert.equal(result.error?.code, 'bundle_storage_error', name)
    assert.equal(result.primaryFailureSeen, true, name)
    assert.deepEqual(result.transactionControls, [
      'BEGIN',
      'COMMIT',
      'BEGIN IMMEDIATE',
      'ROLLBACK',
    ], name)
    assert.equal(result.transactionRemainedOpen, true, name)
    assert.deepEqual(result.objectsAfterNativeCleanup, [], name)
  }

  assert.deepEqual(results.callback.callbackCalls, [
    { callback: 'clock', thisIsUndefined: true, argumentCount: 0 },
  ])
  assert.deepEqual(results.ddl.callbackCalls, [
    { callback: 'clock', thisIsUndefined: true, argumentCount: 0 },
    { callback: 'idFactory', thisIsUndefined: true, argumentCount: 0 },
  ])

  assert.equal(results.ddlRollback.error?.name, 'MemoryBundleError')
  assert.equal(results.ddlRollback.error?.code, 'bundle_storage_error')
  assert.equal(results.ddlRollback.primaryFailureSeen, true)
  assert.deepEqual(results.ddlRollback.callbackCalls, [
    { callback: 'clock', thisIsUndefined: true, argumentCount: 0 },
    { callback: 'idFactory', thisIsUndefined: true, argumentCount: 0 },
  ])
  assert.deepEqual(results.ddlRollback.transactionControls, [
    'BEGIN',
    'COMMIT',
    'BEGIN IMMEDIATE',
    'ROLLBACK',
  ])
  assert.equal(results.ddlRollback.transactionRemainedOpen, false)
  assert.deepEqual(results.ddlRollback.objectsAfterNativeCleanup, [])
})

test('M1-07 non-busy native setup failures map to bundle_storage_error before transactions or callbacks', () => {
  const result = runScenario('M1-07-initializer-setup-error-precedence')

  assert.equal(result.error?.name, 'MemoryBundleError')
  assert.equal(result.error?.code, 'bundle_storage_error')
  assert.equal(result.injectedFailureSeen, true)
  assert.equal(result.callbackCalls, 0)
  assert.deepEqual(result.transactionControls, [])
  assert.equal(result.transactionRemainedOpen, false)
  assert.deepEqual(result.objects, [])
})

test('M1-07 pre-transaction native failures preserve busy, locked, and storage classification', () => {
  const results = runScenario(
    'M1-07-initializer-pretransaction-native-failures',
  )
  const expectedCodes = {
    busy: 'bundle_busy',
    'extended-locked': 'bundle_busy',
    io: 'bundle_storage_error',
  }

  for (const phase of ['configuration', 'temp-inventory']) {
    for (const name of ['busy', 'extended-locked', 'io']) {
      const result = results[`${phase}:${name}`]
      assert.equal(result.error?.name, 'MemoryBundleError', `${phase}:${name}`)
      assert.equal(result.error?.code, expectedCodes[name], `${phase}:${name}`)
      assert.equal(result.injectedFailureCount, 1, `${phase}:${name}`)
      assert.equal(result.callbackCalls, 0, `${phase}:${name}`)
      assert.deepEqual(result.transactionControls, [], `${phase}:${name}`)
      assert.equal(result.transactionRemainedOpen, false, `${phase}:${name}`)
      assert.deepEqual(result.objects, [], `${phase}:${name}`)
    }
  }
})

test('M1-10 public open uses one create-disabled recovery connection before the owned read-only connection', () => {
  const result = runScenario('M1-10-public-open-sequence')
  const recoveryUrl = pathToFileURL(result.dbPath)
  recoveryUrl.searchParams.set('mode', 'rw')

  assert.equal(result.constructorsBeforeValidOpen, 1)
  for (const malformed of result.malformedResults) {
    assert.equal(malformed.error?.name, 'MemoryBundleError')
    assert.equal(malformed.error?.code, 'bundle_invalid_argument')
    assert.equal(malformed.operationalConstructorDelta, 0)
  }
  assert.deepEqual(result.constructions, [
    [':memory:', { open: false }],
    [recoveryUrl.href, { readOnly: false, timeout: 0 }],
    [result.dbPath, { readOnly: true, timeout: 0 }],
  ])
  assert.deepEqual(result.milestones, [
    'probe:construct',
    'recovery:construct',
    'recovery:BEGIN',
    'recovery:schema-read',
    'recovery:COMMIT',
    'recovery:close',
    'final:construct',
    'final:BEGIN',
    'final:COMMIT',
  ])
  assert.deepEqual(result.recoveryProbeWindow, [
    {
      operation: 'prepare',
      sql: 'SELECT 1 FROM main.sqlite_schema LIMIT 1',
    },
    { operation: 'setReadBigInts', value: false },
    { operation: 'setReturnArrays', value: false },
    { operation: 'get', parameters: [] },
  ])
  const requiredPragmaConfiguration = [
    'PRAGMA foreign_keys=ON',
    'PRAGMA busy_timeout=0',
    'PRAGMA recursive_triggers=ON',
    'PRAGMA ignore_check_constraints=OFF',
  ]
  const requiredPragmaReadbacks = [
    'foreign_keys',
    'busy_timeout',
    'recursive_triggers',
    'ignore_check_constraints',
  ].map((name) => [
    { operation: 'prepare', sql: `PRAGMA ${name}` },
    { operation: 'setReadBigInts', value: false },
    { operation: 'setReturnArrays', value: false },
    { operation: 'all', parameters: [] },
  ])
  assert.deepEqual(result.pragmaConfigurations, {
    recovery: requiredPragmaConfiguration,
    final: requiredPragmaConfiguration,
  })
  assert.deepEqual(result.pragmaReadbacks, {
    recovery: requiredPragmaReadbacks,
    final: requiredPragmaReadbacks,
  })
  assert.deepEqual(result.applicationMutationSql, [])
  assert.deepEqual(
    result.beforeHandleClose.map(({ kind, isOpen, isTransaction }) => ({
      kind,
      isOpen,
      isTransaction,
    })),
    [
      { kind: 'recovery', isOpen: false, isTransaction: null },
      { kind: 'final', isOpen: true, isTransaction: false },
    ],
  )
  assert.deepEqual(result.afterHandleClose, [
    { kind: 'recovery', isOpen: false, isTransaction: null },
    { kind: 'final', isOpen: false, isTransaction: null },
  ])
  assert.equal(result.capabilitiesShared, true)
  assert.equal(result.closeReturnedUndefined, true)
})

test('M1-10 failed opens clean every constructed connection with rollback then close precedence', () => {
  const results = runScenario('M1-10-open-cleanup-precedence')

  for (const [name, result] of Object.entries(results)) {
    assert.equal(result.returnedHandle, false, name)
    assert.equal(result.error?.name, 'MemoryBundleError', name)
  }

  const recoveryConfiguration = results.recoveryConfiguration
  assert.equal(recoveryConfiguration.error?.code, 'bundle_storage_error')
  assert.deepEqual(recoveryConfiguration.faultOrder, [
    'recovery:configuration',
  ])
  assert.equal(recoveryConfiguration.configurationFailureCount, 1)
  assert.equal(recoveryConfiguration.connectionStates.length, 1)
  assert.deepEqual(
    recoveryConfiguration.connectionStates[0].transactionControls,
    [],
  )
  assert.equal(recoveryConfiguration.connectionStates[0].closeAttempts, 1)
  assert.equal(recoveryConfiguration.connectionStates[0].isOpen, false)

  const finalConfiguration = results.finalConfiguration
  assert.equal(finalConfiguration.error?.code, 'bundle_storage_error')
  assert.deepEqual(finalConfiguration.faultOrder, ['final:configuration'])
  assert.equal(finalConfiguration.configurationFailureCount, 1)
  assert.equal(finalConfiguration.connectionStates.length, 2)
  assert.deepEqual(
    finalConfiguration.connectionStates.map(
      ({ kind, transactionControls, closeAttempts, isOpen }) => ({
        kind,
        transactionControls,
        closeAttempts,
        isOpen,
      }),
    ),
    [
      {
        kind: 'recovery',
        transactionControls: ['BEGIN', 'COMMIT'],
        closeAttempts: 1,
        isOpen: false,
      },
      {
        kind: 'final',
        transactionControls: [],
        closeAttempts: 1,
        isOpen: false,
      },
    ],
  )

  const recoveryRead = results.recoveryReadBusy
  assert.equal(recoveryRead.returnedHandle, false)
  assert.equal(recoveryRead.error?.name, 'MemoryBundleError')
  assert.equal(recoveryRead.error?.code, 'bundle_busy')
  assert.deepEqual(recoveryRead.faultOrder, ['recovery:primary'])
  assert.equal(recoveryRead.connectionStates.length, 1)
  assert.deepEqual(recoveryRead.connectionStates[0].transactionControls, [
    'BEGIN',
    'ROLLBACK',
  ])
  assert.equal(recoveryRead.connectionStates[0].closeAttempts, 1)
  assert.equal(recoveryRead.connectionStates[0].isOpen, false)

  const recoveryCommit = results.recoveryCommitBusy
  assert.equal(recoveryCommit.error?.code, 'bundle_busy')
  assert.deepEqual(recoveryCommit.faultOrder, ['recovery:commit'])
  assert.equal(recoveryCommit.connectionStates.length, 1)
  assert.deepEqual(recoveryCommit.connectionStates[0].transactionControls, [
    'BEGIN',
    'COMMIT',
    'ROLLBACK',
  ])
  assert.equal(recoveryCommit.connectionStates[0].closeAttempts, 1)
  assert.equal(recoveryCommit.connectionStates[0].isOpen, false)

  const closeWins = results.recoveryCloseBeatsPrimary
  assert.equal(closeWins.error?.code, 'bundle_storage_error')
  assert.equal(closeWins.error?.causeMessage, 'injected recovery close failure')
  assert.deepEqual(closeWins.faultOrder, [
    'recovery:primary',
    'recovery:close',
  ])
  assert.equal(closeWins.connectionStates.length, 1)
  assert.deepEqual(closeWins.connectionStates[0].transactionControls, [
    'BEGIN',
    'ROLLBACK',
  ])
  assert.equal(closeWins.connectionStates[0].closeAttempts, 1)
  assert.equal(closeWins.connectionStates[0].isOpen, true)
  assert.equal(closeWins.connectionStates[0].isTransaction, false)

  const rollbackWins = results.recoveryRollbackBeatsClose
  assert.equal(rollbackWins.error?.code, 'bundle_storage_error')
  assert.equal(
    rollbackWins.error?.causeMessage,
    'injected recovery rollback failure',
  )
  assert.deepEqual(rollbackWins.faultOrder, [
    'recovery:primary',
    'recovery:rollback',
    'recovery:close',
  ])
  assert.equal(rollbackWins.connectionStates.length, 1)
  assert.deepEqual(rollbackWins.connectionStates[0].transactionControls, [
    'BEGIN',
    'ROLLBACK',
  ])
  assert.equal(rollbackWins.connectionStates[0].closeAttempts, 1)
  assert.equal(rollbackWins.connectionStates[0].isOpen, true)
  assert.equal(rollbackWins.connectionStates[0].isTransaction, true)

  const postCommitClose = results.recoveryPostCommitClose
  assert.equal(postCommitClose.error?.code, 'bundle_storage_error')
  assert.deepEqual(postCommitClose.faultOrder, ['recovery:close'])
  assert.equal(postCommitClose.connectionStates.length, 1)
  assert.deepEqual(postCommitClose.connectionStates[0].transactionControls, [
    'BEGIN',
    'COMMIT',
  ])
  assert.equal(postCommitClose.connectionStates[0].closeAttempts, 1)

  const semantic = results.finalSemantic
  assert.equal(semantic.error?.code, 'bundle_missing_atom')
  assert.equal(semantic.connectionStates.length, 2)
  assert.deepEqual(
    semantic.connectionStates.map(
      ({ kind, transactionControls, closeAttempts, isOpen }) => ({
        kind,
        transactionControls,
        closeAttempts,
        isOpen,
      }),
    ),
    [
      {
        kind: 'recovery',
        transactionControls: ['BEGIN', 'COMMIT'],
        closeAttempts: 1,
        isOpen: false,
      },
      {
        kind: 'final',
        transactionControls: ['BEGIN', 'ROLLBACK'],
        closeAttempts: 1,
        isOpen: false,
      },
    ],
  )

  const finalCommit = results.finalCommitBusy
  assert.equal(finalCommit.error?.code, 'bundle_busy')
  assert.deepEqual(finalCommit.faultOrder, ['final:commit'])
  assert.equal(finalCommit.connectionStates.length, 2)
  assert.deepEqual(finalCommit.connectionStates[1].transactionControls, [
    'BEGIN',
    'COMMIT',
    'ROLLBACK',
  ])
  assert.equal(finalCommit.connectionStates[1].closeAttempts, 1)
  assert.equal(finalCommit.connectionStates[1].isOpen, false)

  const finalClose = results.finalCloseBeatsPrimary
  assert.equal(finalClose.error?.code, 'bundle_storage_error')
  assert.equal(finalClose.error?.causeMessage, 'injected final close failure')
  assert.deepEqual(finalClose.faultOrder, ['final:primary', 'final:close'])
  assert.equal(finalClose.connectionStates.length, 2)
  assert.equal(finalClose.connectionStates[0].isOpen, false)
  assert.deepEqual(finalClose.connectionStates[1].transactionControls, [
    'BEGIN',
    'ROLLBACK',
  ])
  assert.equal(finalClose.connectionStates[1].closeAttempts, 1)
  assert.equal(finalClose.connectionStates[1].isOpen, true)
  assert.equal(finalClose.connectionStates[1].isTransaction, false)

  const finalRollback = results.finalRollbackBeatsClose
  assert.equal(finalRollback.error?.code, 'bundle_storage_error')
  assert.equal(
    finalRollback.error?.causeMessage,
    'injected final rollback failure',
  )
  assert.deepEqual(finalRollback.faultOrder, [
    'final:primary',
    'final:rollback',
    'final:close',
  ])
  assert.equal(finalRollback.connectionStates.length, 2)
  assert.equal(finalRollback.connectionStates[0].isOpen, false)
  assert.deepEqual(finalRollback.connectionStates[1].transactionControls, [
    'BEGIN',
    'ROLLBACK',
  ])
  assert.equal(finalRollback.connectionStates[1].closeAttempts, 1)
  assert.equal(finalRollback.connectionStates[1].isOpen, true)
  assert.equal(finalRollback.connectionStates[1].isTransaction, true)
})

test('M1-10 handle reads rollback failures, poison safely, and preserve retryable close state', () => {
  const results = runScenario('M1-10-handle-cleanup-precedence')

  for (const result of Object.values(results)) {
    assert.equal(result.capabilitiesSame, true, result.mode)
    assert.equal(
      result.closedVerify.error?.name,
      'MemoryBundleError',
      result.mode,
    )
    assert.equal(result.closedVerify.error?.code, 'bundle_closed', result.mode)
    assert.equal(
      result.closedReplay.error?.name,
      'MemoryBundleError',
      result.mode,
    )
    assert.equal(result.closedReplay.error?.code, 'bundle_closed', result.mode)
    assert.equal(result.closedReadSqliteCalls, 0, result.mode)
    assert.equal(result.isOpen, false, result.mode)
  }

  assert.equal(results.readPrimary.first.error?.code, 'bundle_busy')
  assert.equal(results.readPrimary.first.error?.name, 'MemoryBundleError')
  assert.equal(results.readPrimary.recoveryRead.error, null)
  assert.equal(results.readPrimary.recoveryRead.returnedUndefined, false)
  assert.deepEqual(results.readPrimary.transactionControls, [
    'BEGIN',
    'ROLLBACK',
    'BEGIN',
    'COMMIT',
  ])
  assert.deepEqual(results.readPrimary.faultOrder, ['primary'])
  assert.equal(results.readPrimary.closeAttempts, 1)

  assert.equal(results.commitPrimary.first.error?.code, 'bundle_busy')
  assert.equal(results.commitPrimary.first.error?.name, 'MemoryBundleError')
  assert.equal(results.commitPrimary.recoveryRead.error, null)
  assert.equal(results.commitPrimary.recoveryRead.returnedUndefined, false)
  assert.deepEqual(results.commitPrimary.transactionControls, [
    'BEGIN',
    'COMMIT',
    'ROLLBACK',
    'BEGIN',
    'COMMIT',
  ])
  assert.deepEqual(results.commitPrimary.faultOrder, ['commit'])
  assert.equal(results.commitPrimary.closeAttempts, 1)

  const poisonClosed = results.poisonCloseSucceeds
  assert.equal(poisonClosed.first.error?.name, 'MemoryBundleError')
  assert.equal(poisonClosed.first.error?.code, 'bundle_storage_error')
  assert.equal(
    poisonClosed.first.error?.causeMessage,
    'injected handle rollback failure',
  )
  assert.deepEqual(poisonClosed.transactionControls, ['BEGIN', 'ROLLBACK'])
  assert.deepEqual(poisonClosed.faultOrder, ['primary', 'rollback'])
  assert.equal(poisonClosed.closeAttempts, 1)
  assert.equal(poisonClosed.closeFailureCount, 0)
  assert.equal(poisonClosed.closeResults[0].error, null)
  assert.equal(poisonClosed.closeResults[0].returnedUndefined, true)
  assert.equal(poisonClosed.closeResults[1].error, null)
  assert.equal(poisonClosed.closeResults[1].returnedUndefined, true)

  const poisonRetry = results.poisonCloseRetries
  assert.equal(poisonRetry.first.error?.name, 'MemoryBundleError')
  assert.equal(poisonRetry.first.error?.code, 'bundle_storage_error')
  assert.equal(
    poisonRetry.first.error?.causeMessage,
    'injected handle rollback failure',
  )
  assert.deepEqual(poisonRetry.transactionControls, ['BEGIN', 'ROLLBACK'])
  assert.deepEqual(poisonRetry.faultOrder, ['primary', 'rollback', 'close'])
  assert.equal(poisonRetry.closeAttempts, 2)
  assert.equal(poisonRetry.closeFailureCount, 1)
  assert.equal(poisonRetry.closeResults[0].error, null)
  assert.equal(poisonRetry.closeResults[0].returnedUndefined, true)
  assert.equal(poisonRetry.closeResults[1].error, null)
  assert.equal(poisonRetry.closeResults[1].returnedUndefined, true)

  const ordinary = results.ordinaryCloseRetry
  assert.equal(ordinary.first.error?.name, 'MemoryBundleError')
  assert.equal(ordinary.first.error?.code, 'bundle_storage_error')
  assert.equal(
    ordinary.first.error?.causeMessage,
    'injected handle close failure',
  )
  assert.equal(ordinary.recoveryRead.error, null)
  assert.equal(ordinary.recoveryRead.returnedUndefined, false)
  assert.deepEqual(ordinary.transactionControls, ['BEGIN', 'COMMIT'])
  assert.deepEqual(ordinary.faultOrder, ['close'])
  assert.equal(ordinary.closeAttempts, 2)
  assert.equal(ordinary.closeFailureCount, 1)
  assert.equal(ordinary.closeResults[0].error, null)
  assert.equal(ordinary.closeResults[0].returnedUndefined, true)
  assert.equal(ordinary.closeResults[1].error, null)
  assert.equal(ordinary.closeResults[1].returnedUndefined, true)
})

test('M1-11 captures every native dispatch boundary before later poisoning', () => {
  const result = runScenario('M1-11-captured-dispatch-end-to-end')

  assert.equal(result.operationError, null)
  assert.deepEqual(result.poisonCalls, {
    databasePrototype: 0,
    statementPrototype: 0,
    databaseInstance: 0,
    statementInstance: 0,
    reflectApply: 0,
    reflectConstruct: 0,
    date: 0,
    pathIsAbsolute: 0,
    cryptoRandomUuid: 0,
  })

  assert.equal(result.databasePrototypePoisonCount, 3)
  assert.equal(result.statementPrototypePoisonCount, 5)
  assert.equal(result.importedBindingsReplaced, true)
  assert.equal(result.operationalConnectionCount, 2)
  assert.equal(result.databaseInstancePoisonCount, 9)
  assert.ok(result.statementInstancePoisonCount > 0)
  assert.equal(result.statementInstancePoisonCount % 5, 0)

  for (const operation of ['exec', 'prepare', 'close']) {
    assert.ok(result.operationCounts[operation] > 0, operation)
    assert.equal(
      result.capturedDispatchCounts[operation],
      result.operationCounts[operation],
      operation,
    )
  }
  for (const operation of [
    'get',
    'all',
    'run',
    'setReadBigInts',
    'setReturnArrays',
  ]) {
    assert.ok(result.operationCounts[operation] > 0, operation)
    assert.equal(
      result.capturedDispatchCounts[operation],
      result.operationCounts[operation],
      operation,
    )
  }
  assert.equal(result.capturedDispatchCounts.pathIsAbsolute, 1)
  assert.equal(result.capturedDispatchCounts.cryptoRandomUuid, 1)
  assert.equal(
    result.capturedConstructionCounts.database,
    result.operationCounts.construct,
  )
  assert.equal(result.capturedConstructionCounts.date, 29)
  assert.equal(result.moduleCaptureDatabaseConstructCount, 1)
  assert.equal(result.operationCounts.construct, 2)

  assert.equal(result.borrowedStartedAsSubclass, true)
  assert.equal(result.initializeReturnedUndefined, true)
  assert.equal(result.borrowedPrototypeChanged, true)
  assert.equal(result.applyReturnedUndefined, true)
  assert.equal(result.borrowedCloseReturnedUndefined, true)
  assert.equal(result.publicCloseReturnedUndefined, true)

  assert.match(
    result.initializedMeta.stream_id,
    /^str_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  )
  assert.equal(result.initializedMeta.head_sequence, 0)
  assert.match(
    result.initializedMeta.created_at,
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
  )
  assert.deepEqual(result.checkpoint, {
    streamId: result.initializedMeta.stream_id,
    sequence: 1,
  })
  assert.deepEqual(result.replayMemoryIds, [
    'mem_00000000-0000-4000-8000-000000000004',
  ])
})

test('M1-11 normalizes every row read across all constructor row modes', () => {
  const { moduleProbeConstructions, results } = runScenario('M1-11-row-modes')
  const expectedModes = [
    { name: 'default', rowOptions: null },
    { name: 'readBigInts', rowOptions: { readBigInts: true } },
    { name: 'returnArrays', rowOptions: { returnArrays: true } },
    {
      name: 'both',
      rowOptions: { readBigInts: true, returnArrays: true },
    },
  ]
  const phases = [
    'initialize',
    'apply',
    'recovery',
    'finalOpen',
    'verify',
    'replay',
  ]

  function assertNormalizedReadWindows(windows, label) {
    assert.ok(windows.length > 0, `${label}: no prepared row reads observed`)
    for (let index = 0; index < windows.length; index += 1) {
      const { sql, operations } = windows[index]
      assert.equal(typeof sql, 'string', `${label}:${index}: SQL`)
      assert.ok(sql.length > 0, `${label}:${index}: empty SQL`)
      assert.ok(operations.length > 0, `${label}:${index}: empty trace window`)
      const terminal = operations[operations.length - 1]
      assert.ok(
        terminal.operation === 'get' || terminal.operation === 'all',
        `${label}:${index}: missing get/all terminal`,
      )
      assert.deepEqual(
        operations,
        [
          { operation: 'setReadBigInts', value: false },
          { operation: 'setReturnArrays', value: false },
          { operation: terminal.operation, parameters: [] },
        ],
        `${label}:${index}`,
      )
    }
  }

  assert.deepEqual(moduleProbeConstructions, [
    [':memory:', { open: false }],
  ])
  assert.deepEqual(
    results.map(({ name, rowOptions }) => ({ name, rowOptions })),
    expectedModes,
  )

  const baseline = results[0]
  for (let index = 0; index < results.length; index += 1) {
    const result = results[index]
    const expected = expectedModes[index]
    const expectedOperationalOptions = expected.rowOptions ?? {}

    assert.equal(result.operationError, null, result.name)
    assert.equal(result.initializeReturnedUndefined, true, result.name)
    assert.equal(result.applyReturnedUndefined, true, result.name)
    assert.equal(result.publicCloseReturnedUndefined, true, result.name)
    assert.equal(result.writerConstruction[0].endsWith(`${result.name}.sqlite`), true)
    if (expected.rowOptions === null) {
      assert.equal(result.writerConstruction.length, 1, result.name)
    } else {
      assert.deepEqual(
        result.writerConstruction,
        [result.writerConstruction[0], expected.rowOptions],
        result.name,
      )
    }
    assert.equal(result.publicConstructions.length, 2, result.name)
    assert.deepEqual(
      result.publicConstructions.map((args) => args[1]),
      [
        {
          readOnly: false,
          timeout: 0,
          ...expectedOperationalOptions,
        },
        {
          readOnly: true,
          timeout: 0,
          ...expectedOperationalOptions,
        },
      ],
      result.name,
    )

    for (const phase of phases) {
      assertNormalizedReadWindows(
        result.readWindows[phase],
        `${result.name}:${phase}`,
      )
      if (index !== 0) {
        assert.deepEqual(
          result.readWindows[phase],
          baseline.readWindows[phase],
          `${result.name}:${phase}: default-mode trace parity`,
        )
      }
    }

    assert.deepEqual(result.verification, baseline.verification, result.name)
    assert.deepEqual(result.replay, baseline.replay, result.name)
  }

  assert.deepEqual(baseline.verification.checkpoint, {
    streamId: 'str_00000000-0000-4000-8000-000000000001',
    sequence: 1,
  })
  assert.deepEqual(baseline.replay.checkpoint, baseline.verification.checkpoint)
  assert.deepEqual(
    baseline.replay.memories.map(({ memoryId }) => memoryId),
    ['mem_00000000-0000-4000-8000-000000000004'],
  )
})

test('M1-11 seals critical initializer, public-open, and cleanup subsequences', () => {
  const initializer = runScenario('M1-07-initializer-race-window')
  const publicOpen = runScenario('M1-10-public-open-sequence')
  const openFailures = runScenario('M1-10-open-cleanup-precedence')
  const handleFailures = runScenario('M1-10-handle-cleanup-precedence')

  const allWindow = (role) => [
    `prepare:${role}`,
    'statement:setReadBigInts(false)',
    'statement:setReturnArrays(false)',
    'statement:all/0',
  ]
  const getWindow = (role) => [
    `prepare:${role}`,
    'statement:setReadBigInts(false)',
    'statement:setReturnArrays(false)',
    'statement:get/0',
  ]
  const configured = [
    'exec:configure',
    ...allWindow('pragma:foreign_keys'),
    ...allWindow('pragma:busy_timeout'),
    ...allWindow('pragma:recursive_triggers'),
    ...allWindow('pragma:ignore_check_constraints'),
  ]
  const borrowedPrefix = [
    ...configured,
    ...allWindow('temp-triggers'),
  ]
  const inventory = allWindow('application-inventory')
  const verified = [
    ...allWindow('verify-meta-table'),
    ...allWindow('verify-meta-preflight'),
    ...allWindow('verify-atoms'),
  ]
  const recoveryBeforeCommit = [
    'construct:recovery',
    ...configured,
    'exec:control:BEGIN',
    ...getWindow('recovery-schema'),
    'exec:control:COMMIT',
  ]
  const recoverySuccess = [...recoveryBeforeCommit, 'close']
  const finalBeforeCommit = [
    'construct:final',
    ...configured,
    'exec:control:BEGIN',
    ...verified,
  ]
  const initializedObjects = [
    'memory_bundle_meta',
    'memory_bundle_events',
    'memory_bundle_atoms',
    'memory_bundle_applied_create_memory_unique',
    'memory_bundle_applied_delete_memory_unique',
    'memory_bundle_events_no_update',
    'memory_bundle_events_no_delete',
    'memory_bundle_event_next_sequence',
    'memory_bundle_atoms_no_update',
    'memory_bundle_atom_insert_guard',
    'memory_bundle_atom_delete_guard',
    'memory_bundle_meta_no_delete',
    'memory_bundle_meta_advance_guard',
  ].map((name) => `exec:ddl:${name}`)

  assert.deepEqual(initializer.existing.orderedCalls, [
    ...borrowedPrefix,
    'exec:control:BEGIN',
    ...inventory,
    ...verified,
    'exec:control:COMMIT',
  ])
  assert.deepEqual(initializer.complete.orderedCalls, [
    ...borrowedPrefix,
    'exec:control:BEGIN',
    ...inventory,
    'exec:control:COMMIT',
    'exec:control:BEGIN IMMEDIATE',
    ...inventory,
    ...verified,
    'exec:control:COMMIT',
  ])
  assert.deepEqual(initializer.partial.orderedCalls, [
    ...borrowedPrefix,
    'exec:control:BEGIN',
    ...inventory,
    'exec:control:COMMIT',
    'exec:control:BEGIN IMMEDIATE',
    ...inventory,
    ...allWindow('verify-meta-table'),
    'exec:control:ROLLBACK',
  ])
  assert.deepEqual(initializer.absent.orderedCalls, [
    ...borrowedPrefix,
    'exec:control:BEGIN',
    ...inventory,
    'exec:control:COMMIT',
    'exec:control:BEGIN IMMEDIATE',
    ...inventory,
    'callback:clock',
    'callback:idFactory',
    ...initializedObjects,
    'prepare:insert-meta',
    'statement:setReadBigInts(false)',
    'statement:setReturnArrays(false)',
    'statement:run/3',
    ...verified,
    'exec:control:COMMIT',
  ])

  assert.equal(publicOpen.constructorsBeforeValidOpen, 1)
  for (const malformed of publicOpen.malformedResults) {
    assert.equal(malformed.error?.code, 'bundle_invalid_argument')
    assert.equal(malformed.operationalConstructorDelta, 0)
  }
  const recoveryUrl = pathToFileURL(publicOpen.dbPath)
  recoveryUrl.searchParams.set('mode', 'rw')
  assert.deepEqual(publicOpen.constructions, [
    [':memory:', { open: false }],
    [recoveryUrl.href, { readOnly: false, timeout: 0 }],
    [publicOpen.dbPath, { readOnly: true, timeout: 0 }],
  ])
  assert.deepEqual(publicOpen.orderedCalls, [
    'construct:probe',
    ...recoverySuccess,
    ...finalBeforeCommit,
    'exec:control:COMMIT',
  ])

  const commitFailure = openFailures.recoveryCommitBusy
  assert.equal(commitFailure.error?.code, 'bundle_busy')
  assert.deepEqual(commitFailure.faultOrder, ['recovery:commit'])
  assert.equal(commitFailure.connectionStates.length, 1)
  assert.deepEqual(commitFailure.orderedCalls, [
    ...recoveryBeforeCommit,
    'exec:control:ROLLBACK',
    'close',
  ])

  const closeFailure = openFailures.recoveryPostCommitClose
  assert.equal(closeFailure.error?.code, 'bundle_storage_error')
  assert.deepEqual(closeFailure.faultOrder, ['recovery:close'])
  assert.equal(closeFailure.connectionStates.length, 1)
  assert.deepEqual(closeFailure.orderedCalls, recoverySuccess)

  const finalFailure = openFailures.finalSemantic
  assert.equal(finalFailure.error?.code, 'bundle_missing_atom')
  assert.equal(finalFailure.connectionStates.length, 2)
  assert.deepEqual(finalFailure.orderedCalls, [
    ...recoverySuccess,
    ...finalBeforeCommit,
    'exec:control:ROLLBACK',
    'close',
  ])

  const poison = handleFailures.poisonCloseSucceeds
  assert.equal(poison.first.error?.code, 'bundle_storage_error')
  assert.equal(
    poison.first.error?.causeMessage,
    'injected handle rollback failure',
  )
  assert.equal(poison.closeFailureCount, 0)
  assert.equal(poison.closeAttempts, 1)
  assert.equal(poison.closedReadSqliteCalls, 0)
  assert.deepEqual(poison.orderedCalls, [
    'exec:control:BEGIN',
    'prepare:verify-meta-table',
    'exec:control:ROLLBACK',
    'close',
  ])
})

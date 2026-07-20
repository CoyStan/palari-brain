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

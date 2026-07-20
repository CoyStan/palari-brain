import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

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

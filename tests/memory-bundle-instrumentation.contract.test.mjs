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

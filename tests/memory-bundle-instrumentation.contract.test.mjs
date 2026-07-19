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

test('M1-02 captures one unopened probe before normalized row dispatch', () => {
  const { trace, row } = runScenario('M1-02-native-capture')

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
      operation: 'prepare',
      sql: 'SELECT 1 AS value',
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
      parameters: [],
    },
    {
      operation: 'close',
    },
  ])
  assert.deepEqual(row, { value: 1 })
})

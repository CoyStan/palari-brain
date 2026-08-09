import assert from 'node:assert/strict'
import test from 'node:test'

import { createRollingTokenPacer } from '../evals/rolling-token-pacer.mjs'

test('rolling token pacer admits within the window and waits before overflow', async () => {
  let now = 1_000
  const delays = []
  const pacer = createRollingTokenPacer({
    clock: () => now,
    maxUnits: 100,
    wait: async (delay) => {
      delays.push(delay)
      now += delay
    },
    windowMs: 1_000,
  })
  await pacer.pace(60)
  await pacer.pace(40)
  await pacer.pace(20)
  assert.deepEqual(delays, [1_000])
  assert.deepEqual(pacer.stats, {
    admittedUnits: 120,
    waitedMs: 1_000,
    waits: 1,
  })
})

test('one oversized dispatch is allowed only into an empty window', async () => {
  let now = 0
  const pacer = createRollingTokenPacer({
    clock: () => now,
    maxUnits: 10,
    wait: async (delay) => { now += delay },
    windowMs: 100,
  })
  await pacer.pace(20)
  await pacer.pace(1)
  assert.deepEqual(pacer.stats, {
    admittedUnits: 21,
    waitedMs: 100,
    waits: 1,
  })
})

test('invalid pacing inputs fail before waiting', async () => {
  assert.throws(() => createRollingTokenPacer(), /maxUnits/u)
  const pacer = createRollingTokenPacer({ maxUnits: 1 })
  await assert.rejects(pacer.pace(0), /positive safe integer/u)
})

import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { utimesSync, writeFileSync } from 'node:fs'
import { access, mkdtemp, readFile, unlink, utimes, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  createFileRollingTokenPacer,
  createRollingTokenPacer,
} from '../evals/rolling-token-pacer.mjs'

function childResult(child) {
  return new Promise((resolve, reject) => {
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', reject)
    child.on('close', (status) => resolve({ status, stderr, stdout }))
  })
}

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
  assert.throws(() => createFileRollingTokenPacer({
    lockRetryMs: 101,
    maxRequests: 1,
    maxUnits: 1,
    statePath: '/tmp/not-opened-pacer-state',
    windowMs: 100,
  }), /must not exceed windowMs/u)
})

test('file pacers serialize concurrent unit admission through one state path', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'palari-shared-pacer-'))
  const statePath = path.join(directory, 'pacer.json')
  let now = 1_000
  const waits = []
  const options = {
    clock: () => now,
    lockRetryMs: 1,
    maxRequests: 10,
    maxUnits: 100,
    statePath,
    wait: async (delay) => {
      if (delay === 1) {
        await new Promise((resolve) => setImmediate(resolve))
        return
      }
      waits.push(delay)
      now += delay
    },
    windowMs: 1_000,
  }
  const first = createFileRollingTokenPacer(options)
  const second = createFileRollingTokenPacer(options)
  await Promise.all([first.pace(60), second.pace(60)])
  assert.deepEqual(waits, [1_000])
  assert.equal(first.stats.admittedUnits + second.stats.admittedUnits, 120)
  const state = JSON.parse(await readFile(statePath, 'utf8'))
  assert.deepEqual(state, {
    schema: 'palari-shared-rolling-pacer/v1',
    policy: { maxRequests: 10, maxUnits: 100, windowMs: 1_000 },
    events: [{ at: 2_000, units: 60 }],
  })
})

test('separate processes share one atomic rolling ceiling', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'palari-process-pacer-'))
  const statePath = path.join(directory, 'pacer.json')
  const startPath = path.join(directory, 'start')
  const moduleUrl = new URL('../evals/rolling-token-pacer.mjs', import.meta.url).href
  const worker = `
    import { existsSync, writeFileSync } from 'node:fs'
    import { setTimeout as delay } from 'node:timers/promises'
    import { createFileRollingTokenPacer } from ${JSON.stringify(moduleUrl)}
    const [statePath, startPath, readyPath] = process.argv.slice(1)
    writeFileSync(readyPath, 'ready', { mode: 0o600 })
    while (!existsSync(startPath)) await delay(2)
    const pacer = createFileRollingTokenPacer({
      maxRequests: 3,
      maxUnits: 100,
      statePath,
      windowMs: 200,
    })
    await pacer.pace(40)
    process.stdout.write(JSON.stringify(pacer.stats))
  `
  const runs = Array.from({ length: 6 }, (_, index) => childResult(spawn(process.execPath, [
    '--input-type=module',
    '--eval', worker,
    statePath,
    startPath,
    path.join(directory, `ready-${index}`),
  ], { stdio: ['ignore', 'pipe', 'pipe'] })))
  const readyDeadline = Date.now() + 5_000
  for (;;) {
    const ready = await Promise.all(Array.from({ length: 6 }, async (_, index) => {
      try {
        await access(path.join(directory, `ready-${index}`))
        return true
      } catch {
        return false
      }
    }))
    if (ready.every(Boolean)) break
    if (Date.now() >= readyDeadline) assert.fail('pacer workers did not become ready.')
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  await writeFile(startPath, 'start')
  const results = await Promise.all(runs)
  assert.ok(results.every(({ status }) => status === 0), JSON.stringify(results))
  const stats = results.map(({ stdout }) => JSON.parse(stdout))
  assert.ok(stats.reduce((sum, item) => sum + item.waits, 0) >= 4)
  const state = JSON.parse(await readFile(statePath, 'utf8'))
  assert.ok(state.events.length <= 2)
  assert.ok(state.events.reduce((sum, event) => sum + event.units, 0) <= 100)
})

test('file pacers share a request ceiling but different paths are independent', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'palari-request-pacer-'))
  let now = 0
  const delays = []
  const make = (name) => createFileRollingTokenPacer({
    clock: () => now,
    maxRequests: 1,
    maxUnits: 1_000,
    statePath: path.join(directory, `${name}.json`),
    wait: async (delay) => {
      delays.push(delay)
      now += delay
    },
    windowMs: 100,
  })
  const first = make('shared')
  const second = make('shared')
  const independent = make('independent')
  await first.pace(1)
  await independent.pace(2_000)
  await second.pace(1)
  assert.deepEqual(delays, [100])
  assert.equal(second.stats.waits, 1)
  assert.equal(independent.stats.waits, 0)
})

test('file pacer state is content-free and corrupted state fails closed', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'palari-pacer-state-'))
  const statePath = path.join(directory, 'pacer.json')
  const pacer = createFileRollingTokenPacer({
    maxRequests: 2,
    maxUnits: 100,
    statePath,
  })
  await pacer.pace(25)
  const raw = await readFile(statePath, 'utf8')
  assert.deepEqual(Object.keys(JSON.parse(raw)).sort(), ['events', 'policy', 'schema'])
  assert.equal(raw.includes('prompt'), false)
  assert.equal(raw.includes('response'), false)

  await writeFile(statePath, '{not-json')
  await assert.rejects(pacer.pace(1), /state is invalid/u)

  const secret = 'SYNTHETIC-REQUEST-CONTENT'
  const malformedStates = [
    {
      schema: 'palari-shared-rolling-pacer/v1',
      policy: { maxRequests: 2, maxUnits: 100, windowMs: 60_000 },
      events: [{ at: Date.now(), units: 1, prompt: secret }],
    },
    {
      schema: 'palari-shared-rolling-pacer/v1',
      policy: { maxRequests: 2, maxUnits: 100, windowMs: 60_000, prompt: secret },
      events: [],
    },
    {
      schema: 'palari-shared-rolling-pacer/v1',
      policy: { maxRequests: 2, maxUnits: 100, windowMs: 60_000 },
      events: [],
      prompt: secret,
    },
  ]
  for (const malformed of malformedStates) {
    const before = `${JSON.stringify(malformed)}\n`
    await writeFile(statePath, before)
    await assert.rejects(pacer.pace(1), /state is invalid/u)
    assert.equal(await readFile(statePath, 'utf8'), before)
  }
})

test('file pacers fail closed when one state path receives a different policy', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'palari-pacer-policy-'))
  const statePath = path.join(directory, 'pacer.json')
  await createFileRollingTokenPacer({
    maxRequests: 2,
    maxUnits: 100,
    statePath,
  }).pace(1)
  const mismatched = createFileRollingTokenPacer({
    maxRequests: 3,
    maxUnits: 100,
    statePath,
  })
  await assert.rejects(mismatched.pace(1), /state is invalid/u)
})

test('file pacer recovers a dead stale lock but never steals a live lock', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'palari-pacer-lock-'))
  const statePath = path.join(directory, 'pacer.json')
  const lockPath = `${statePath}.lock`
  const old = new Date(Date.now() - 60_000)
  await writeFile(lockPath, `${JSON.stringify({
    schema: 'palari-shared-rolling-pacer/v1',
    pid: 2_147_483_647,
    token: 'dead-owner',
  })}\n`)
  await utimes(lockPath, old, old)
  const recovered = createFileRollingTokenPacer({
    lockStaleMs: 10,
    maxRequests: 1,
    maxUnits: 1,
    statePath,
  })
  await recovered.pace(1)
  assert.equal(recovered.stats.lockWaits, 0)

  const liveStatePath = path.join(directory, 'live-pacer.json')
  const liveLockPath = `${liveStatePath}.lock`
  await writeFile(liveLockPath, `${JSON.stringify({
    schema: 'palari-shared-rolling-pacer/v1',
    pid: process.pid,
    token: 'live-owner',
  })}\n`)
  await utimes(liveLockPath, old, old)
  let released = false
  const guarded = createFileRollingTokenPacer({
    lockRetryMs: 1,
    lockStaleMs: 10,
    maxRequests: 2,
    maxUnits: 2,
    statePath: liveStatePath,
    wait: async () => {
      released = true
      await unlink(liveLockPath)
    },
  })
  await guarded.pace(1)
  assert.equal(released, true)
  assert.equal(guarded.stats.lockWaits, 1)
})

test('stale recovery rechecks same-inode owner bytes before unlinking', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'palari-pacer-lock-race-'))
  const statePath = path.join(directory, 'pacer.json')
  const lockPath = `${statePath}.lock`
  const deadPid = 2_147_483_647
  const old = new Date(Date.now() - 60_000)
  await writeFile(lockPath, `${JSON.stringify({
    schema: 'palari-shared-rolling-pacer/v1',
    pid: deadPid,
    token: 'dead-owner',
  })}\n`)
  await utimes(lockPath, old, old)
  const originalKill = process.kill
  let replaced = false
  process.kill = (pid, signal) => {
    if (pid === deadPid && signal === 0 && !replaced) {
      replaced = true
      writeFileSync(lockPath, `${JSON.stringify({
        schema: 'palari-shared-rolling-pacer/v1',
        pid: process.pid,
        token: 'new-live-owner',
      })}\n`)
      utimesSync(lockPath, old, old)
      const error = new Error('dead synthetic owner')
      error.code = 'ESRCH'
      throw error
    }
    return originalKill(pid, signal)
  }
  let liveLockObserved = false
  try {
    const pacer = createFileRollingTokenPacer({
      lockRetryMs: 1,
      lockStaleMs: 10,
      maxRequests: 1,
      maxUnits: 1,
      statePath,
      wait: async () => {
        const owner = JSON.parse(await readFile(lockPath, 'utf8'))
        liveLockObserved = owner.token === 'new-live-owner'
        await unlink(lockPath)
      },
    })
    await pacer.pace(1)
    assert.equal(pacer.stats.lockWaits, 1)
  } finally {
    process.kill = originalKill
  }
  assert.equal(replaced, true)
  assert.equal(liveLockObserved, true)
})

test('atomic stale recovery preserves a live replacement after its final check', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'palari-pacer-final-race-'))
  const statePath = path.join(directory, 'pacer.json')
  const lockPath = `${statePath}.lock`
  const deadPid = 2_147_483_647
  const old = new Date(Date.now() - 60_000)
  await writeFile(lockPath, `${JSON.stringify({
    schema: 'palari-shared-rolling-pacer/v1',
    pid: deadPid,
    token: 'dead-owner',
  })}\n`)
  await utimes(lockPath, old, old)
  const originalKill = process.kill
  let deadChecks = 0
  process.kill = (pid, signal) => {
    if (pid === deadPid && signal === 0) {
      deadChecks += 1
      if (deadChecks === 2) {
        writeFileSync(lockPath, `${JSON.stringify({
          schema: 'palari-shared-rolling-pacer/v1',
          pid: process.pid,
          token: 'late-live-owner',
        })}\n`)
      }
      const error = new Error('dead synthetic owner')
      error.code = 'ESRCH'
      throw error
    }
    return originalKill(pid, signal)
  }
  let liveLockObserved = false
  try {
    const pacer = createFileRollingTokenPacer({
      lockRetryMs: 1,
      lockStaleMs: 10,
      maxRequests: 1,
      maxUnits: 1,
      statePath,
      wait: async () => {
        const owner = JSON.parse(await readFile(lockPath, 'utf8'))
        liveLockObserved = owner.token === 'late-live-owner'
        await unlink(lockPath)
      },
    })
    await pacer.pace(1)
    assert.equal(pacer.stats.lockWaits, 1)
  } finally {
    process.kill = originalKill
  }
  assert.equal(deadChecks, 2)
  assert.equal(liveLockObserved, true)
})

test('two stale recoverers serialize before both admissions', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'palari-pacer-recoverers-'))
  const statePath = path.join(directory, 'pacer.json')
  const lockPath = `${statePath}.lock`
  const old = new Date(Date.now() - 60_000)
  await writeFile(lockPath, `${JSON.stringify({
    schema: 'palari-shared-rolling-pacer/v1',
    pid: 2_147_483_647,
    token: 'dead-owner',
  })}\n`)
  await utimes(lockPath, old, old)
  const options = {
    lockRetryMs: 1,
    lockStaleMs: 10,
    maxRequests: 2,
    maxUnits: 2,
    statePath,
    wait: async () => new Promise((resolve) => setImmediate(resolve)),
  }
  const first = createFileRollingTokenPacer(options)
  const second = createFileRollingTokenPacer(options)
  await Promise.all([first.pace(1), second.pace(1)])
  const state = JSON.parse(await readFile(statePath, 'utf8'))
  assert.equal(state.events.length, 2)
  assert.equal(state.events.reduce((sum, event) => sum + event.units, 0), 2)
})

// Provider-neutral rolling-window pacing. This changes dispatch timing only;
// it never retries, rewrites, or inspects a provider response.

import { randomUUID } from 'node:crypto'
import { mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const SHARED_SCHEMA = 'palari-shared-rolling-pacer/v1'

function positiveSafeInteger(value, label) {
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < 1) {
    throw new TypeError(`${label} must be a positive safe integer.`)
  }
  return number
}

function defaultWait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

export function createRollingTokenPacer({
  clock = Date.now,
  maxUnits,
  wait = defaultWait,
  windowMs = 60_000,
} = {}) {
  const maximum = positiveSafeInteger(maxUnits, 'maxUnits')
  const window = positiveSafeInteger(windowMs, 'windowMs')
  if (typeof clock !== 'function' || typeof wait !== 'function') {
    throw new TypeError('rolling token pacer requires clock and wait functions.')
  }
  const events = []
  let waits = 0
  let waitedMs = 0
  let admittedUnits = 0

  function prune(now) {
    while (events.length > 0 && now - events[0].at >= window) {
      events.shift()
    }
  }

  return Object.freeze({
    async pace(rawUnits) {
      const units = positiveSafeInteger(rawUnits, 'units')
      for (;;) {
        const now = Number(clock())
        if (!Number.isFinite(now)) throw new TypeError('clock must be finite.')
        prune(now)
        const active = events.reduce((sum, event) => sum + event.units, 0)
        if (events.length === 0 || active + units <= maximum) {
          events.push({ at: now, units })
          admittedUnits += units
          return
        }
        const delay = Math.max(1, events[0].at + window - now)
        if (delay > window) {
          throw new Error('rolling token pacer computed an invalid wait.')
        }
        waits += 1
        waitedMs += delay
        await wait(delay)
      }
    },
    get stats() {
      return Object.freeze({ admittedUnits, waitedMs, waits })
    },
  })
}

export function createFileRollingTokenPacer({
  clock = Date.now,
  lockRetryMs = 10,
  lockStaleMs = 30_000,
  maxRequests,
  maxUnits,
  statePath,
  wait = defaultWait,
  windowMs = 60_000,
} = {}) {
  const maximum = positiveSafeInteger(maxUnits, 'maxUnits')
  const requests = positiveSafeInteger(maxRequests, 'maxRequests')
  const window = positiveSafeInteger(windowMs, 'windowMs')
  const retry = positiveSafeInteger(lockRetryMs, 'lockRetryMs')
  const stale = positiveSafeInteger(lockStaleMs, 'lockStaleMs')
  if (typeof statePath !== 'string' || !statePath.trim()) {
    throw new TypeError('statePath must be a non-empty string.')
  }
  if (typeof clock !== 'function' || typeof wait !== 'function') {
    throw new TypeError('file rolling pacer requires clock and wait functions.')
  }
  const resolvedStatePath = statePath.trim()
  const lockPath = `${resolvedStatePath}.lock`
  const policy = Object.freeze({ maxRequests: requests, maxUnits: maximum, windowMs: window })
  let admittedUnits = 0
  let admittedRequests = 0
  let waitedMs = 0
  let waits = 0
  let lockWaitedMs = 0
  let lockWaits = 0

  function ownerIsAlive(pid) {
    if (!Number.isSafeInteger(pid) || pid < 1) return false
    try {
      process.kill(pid, 0)
      return true
    } catch (error) {
      if (error?.code === 'ESRCH') return false
      if (error?.code === 'EPERM') return true
      throw error
    }
  }

  async function readLock() {
    let handle
    try {
      handle = await open(lockPath, 'r')
      const info = await handle.stat()
      let owner = null
      try {
        owner = JSON.parse(await handle.readFile('utf8'))
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error
      }
      if (owner?.schema !== SHARED_SCHEMA ||
          !Number.isSafeInteger(owner.pid) || owner.pid < 1 ||
          typeof owner.token !== 'string' || !owner.token) {
        return { info, owner: null }
      }
      return { info, owner }
    } catch (error) {
      if (error?.code === 'ENOENT') return null
      throw error
    } finally {
      await handle?.close()
    }
  }

  async function acquire() {
    await mkdir(dirname(resolvedStatePath), { recursive: true })
    for (;;) {
      const token = randomUUID()
      try {
        const handle = await open(lockPath, 'wx', 0o600)
        try {
          await handle.writeFile(`${JSON.stringify({
            schema: SHARED_SCHEMA,
            pid: process.pid,
            token,
          })}\n`, 'utf8')
          await handle.sync()
          return { handle, token }
        } catch (error) {
          await handle.close().catch(() => {})
          await unlink(lockPath).catch(() => {})
          throw error
        }
      } catch (error) {
        if (error?.code !== 'EEXIST') throw error
        const observed = await readLock()
        if (!observed) continue
        if (Date.now() - observed.info.mtimeMs >= stale &&
            !ownerIsAlive(observed.owner?.pid)) {
          const current = await readLock()
          if (current && current.info.ino === observed.info.ino &&
              current.info.dev === observed.info.dev) {
            await unlink(lockPath).catch((unlinkError) => {
              if (unlinkError?.code !== 'ENOENT') throw unlinkError
            })
            continue
          }
        }
        lockWaits += 1
        lockWaitedMs += retry
        await wait(retry)
      }
    }
  }

  async function release({ handle, token }) {
    await handle.close()
    const current = await readLock()
    if (current?.owner?.token !== token) {
      throw new Error('shared rolling pacer lock ownership changed.')
    }
    await unlink(lockPath).catch((error) => {
      if (error?.code !== 'ENOENT') throw error
    })
  }

  async function load() {
    try {
      const parsed = JSON.parse(await readFile(resolvedStatePath, 'utf8'))
      if (parsed?.schema !== SHARED_SCHEMA || !Array.isArray(parsed.events) ||
        parsed.policy?.maxRequests !== policy.maxRequests ||
        parsed.policy?.maxUnits !== policy.maxUnits ||
        parsed.policy?.windowMs !== policy.windowMs ||
        parsed.events.some((event) => !Number.isFinite(event?.at) ||
          !Number.isSafeInteger(event?.units) || event.units < 1)) {
        throw new Error('shared rolling pacer state is invalid.')
      }
      return parsed.events
    } catch (error) {
      if (error?.code === 'ENOENT') return []
      if (error instanceof SyntaxError) {
        throw new Error('shared rolling pacer state is invalid.')
      }
      throw error
    }
  }

  async function save(events) {
    const temporary = `${resolvedStatePath}.tmp-${process.pid}-${randomUUID()}`
    await writeFile(temporary, `${JSON.stringify({
      schema: SHARED_SCHEMA,
      policy,
      events,
    })}\n`, {
      encoding: 'utf8', mode: 0o600,
    })
    await rename(temporary, resolvedStatePath)
  }

  return Object.freeze({
    async pace(rawUnits) {
      const units = positiveSafeInteger(rawUnits, 'units')
      for (;;) {
        const handle = await acquire()
        let delay = 0
        try {
          const now = Number(clock())
          if (!Number.isFinite(now)) throw new TypeError('clock must be finite.')
          const events = (await load()).filter((event) => now - event.at < window)
          const activeUnits = events.reduce((sum, event) => sum + event.units, 0)
          if (events.length === 0 ||
            (events.length < requests && activeUnits + units <= maximum)) {
            events.push({ at: now, units })
            await save(events)
            admittedUnits += units
            admittedRequests += 1
            return
          }
          delay = Math.max(1, events[0].at + window - now)
          if (delay > window) throw new Error('file rolling pacer computed an invalid wait.')
        } finally {
          await release(handle)
        }
        waits += 1
        waitedMs += delay
        await wait(delay)
      }
    },
    get stats() {
      return Object.freeze({
        admittedRequests, admittedUnits, lockWaitedMs, lockWaits, waitedMs, waits,
      })
    },
  })
}

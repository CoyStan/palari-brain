// Provider-neutral rolling-window pacing. This changes dispatch timing only;
// it never retries, rewrites, or inspects a provider response.

import { randomUUID } from 'node:crypto'
import { link, mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const SHARED_SCHEMA = 'palari-shared-rolling-pacer/v1'

function exactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const actual = Object.keys(value).sort()
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
}

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
  if (retry > window) {
    throw new TypeError('lockRetryMs must not exceed windowMs.')
  }
  if (typeof statePath !== 'string' || !statePath.trim()) {
    throw new TypeError('statePath must be a non-empty string.')
  }
  if (typeof clock !== 'function' || typeof wait !== 'function') {
    throw new TypeError('file rolling pacer requires clock and wait functions.')
  }
  const resolvedStatePath = statePath.trim()
  const lockPath = `${resolvedStatePath}.lock`
  const recoveryPath = `${lockPath}.recovery`
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

  async function readOwned(path) {
    let handle
    try {
      handle = await open(path, 'r')
      const info = await handle.stat()
      const raw = await handle.readFile('utf8')
      let owner = null
      try {
        owner = JSON.parse(raw)
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error
      }
      if (!exactKeys(owner, ['pid', 'schema', 'token']) ||
          owner.schema !== SHARED_SCHEMA ||
          !Number.isSafeInteger(owner.pid) || owner.pid < 1 ||
          typeof owner.token !== 'string' || !owner.token) {
        return { info, owner: null, raw }
      }
      return { info, owner, raw }
    } catch (error) {
      if (error?.code === 'ENOENT') return null
      throw error
    } finally {
      await handle?.close()
    }
  }

  async function publishOwned(path) {
    const token = randomUUID()
    const temporary = `${path}.candidate-${process.pid}-${token}`
    let handle
    try {
      handle = await open(temporary, 'wx', 0o600)
      try {
        await handle.writeFile(`${JSON.stringify({
          schema: SHARED_SCHEMA,
          pid: process.pid,
          token,
        })}\n`, 'utf8')
        await handle.sync()
      } finally {
        await handle.close()
        handle = null
      }
      try {
        await link(temporary, path)
      } catch (error) {
        if (error?.code === 'EEXIST') return null
        throw error
      }
      return { temporary, token }
    } finally {
      await handle?.close().catch(() => {})
      // A failed removal after publication leaves only a content-free hard
      // link. The owner receives its path, and release tries once more.
      await unlink(temporary).catch(() => {})
    }
  }

  async function releaseOwned(path, ownership) {
    const current = await readOwned(path)
    if (current?.owner?.token !== ownership.token) {
      throw new Error('shared rolling pacer lock ownership changed.')
    }
    await unlink(path)
    await unlink(ownership.temporary).catch(() => {})
  }

  async function acquire() {
    await mkdir(dirname(resolvedStatePath), { recursive: true })
    for (;;) {
      const existingRecovery = await readOwned(recoveryPath)
      if (existingRecovery) {
        if (Date.now() - existingRecovery.info.mtimeMs >= stale &&
            !ownerIsAlive(existingRecovery.owner?.pid)) {
          throw new Error('shared rolling pacer recovery claim is abandoned.')
        }
        lockWaits += 1
        lockWaitedMs += retry
        await wait(retry)
        continue
      }

      const ownership = await publishOwned(lockPath)
      if (ownership) return ownership

      const observed = await readOwned(lockPath)
      if (!observed) continue
      if (Date.now() - observed.info.mtimeMs >= stale &&
          !ownerIsAlive(observed.owner?.pid)) {
        const recovery = await publishOwned(recoveryPath)
        if (!recovery) {
          const activeRecovery = await readOwned(recoveryPath)
          if (!activeRecovery) continue
          if (Date.now() - activeRecovery.info.mtimeMs >= stale &&
              !ownerIsAlive(activeRecovery.owner?.pid)) {
            throw new Error('shared rolling pacer recovery claim is abandoned.')
          }
          lockWaits += 1
          lockWaitedMs += retry
          await wait(retry)
          continue
        }
        try {
          const quarantine = `${lockPath}.stale-${recovery.token}`
          let moved = false
          try {
            await rename(lockPath, quarantine)
            moved = true
          } catch (error) {
            if (error?.code !== 'ENOENT') throw error
          }
          if (moved) {
            try {
              const captured = await readOwned(quarantine)
              const isObservedDeadLock = captured &&
                captured.info.ino === observed.info.ino &&
                captured.info.dev === observed.info.dev &&
                captured.raw === observed.raw &&
                Date.now() - captured.info.mtimeMs >= stale &&
                !ownerIsAlive(captured.owner?.pid)
              if (!isObservedDeadLock) {
                await link(quarantine, lockPath).catch((error) => {
                  if (error?.code !== 'EEXIST') throw error
                })
              }
              await unlink(quarantine)
            } catch (error) {
              await link(quarantine, lockPath).catch((error) => {
                if (error?.code !== 'EEXIST') throw error
              })
              await unlink(quarantine).catch(() => {})
              throw error
            }
          }
        } finally {
          await releaseOwned(recoveryPath, recovery)
        }
        continue
      }
      lockWaits += 1
      lockWaitedMs += retry
      await wait(retry)
    }
  }

  async function release(ownership) {
    await releaseOwned(lockPath, ownership)
  }

  async function load() {
    try {
      const parsed = JSON.parse(await readFile(resolvedStatePath, 'utf8'))
      if (!exactKeys(parsed, ['events', 'policy', 'schema']) ||
        parsed.schema !== SHARED_SCHEMA || !Array.isArray(parsed.events) ||
        !exactKeys(parsed.policy, ['maxRequests', 'maxUnits', 'windowMs']) ||
        parsed.policy?.maxRequests !== policy.maxRequests ||
        parsed.policy?.maxUnits !== policy.maxUnits ||
        parsed.policy?.windowMs !== policy.windowMs ||
        parsed.events.length > requests ||
        parsed.events.some((event) => !exactKeys(event, ['at', 'units']) ||
          !Number.isFinite(event.at) ||
          !Number.isSafeInteger(event.units) || event.units < 1)) {
        throw new Error('shared rolling pacer state is invalid.')
      }
      return parsed.events.map(({ at, units }) => ({ at, units }))
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

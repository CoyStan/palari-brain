// Provider-neutral rolling-window pacing. This changes dispatch timing only;
// it never retries, rewrites, or inspects a provider response.

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

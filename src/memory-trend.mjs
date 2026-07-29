// Computed trends over host timestamps.
//
// Adapted from Hindsight's observation trends — the one part of its reflect
// subsystem that is genuinely algorithmic. Hindsight attaches trends to
// model-written "observations" whose supporting quotes are requested in a
// schema description but never verified; Palari attaches trends to groups
// of host-verified facts, and the trend itself is a pure function of the
// host's own chronology. No model is consulted, so a trend can be wrong
// only if the calendar is.
//
// Classification, given the observation timestamps of one recurring fact
// group (for example every edge of "user — mentions — deadline stress"):
//
//   new           all observations inside the recent window
//   strengthening denser recently than historically
//   weakening     sparser recently than historically
//   stable        present both recently and historically, similar density
//   stale         nothing in the recent window at all

export const TREND_RECENT_DAYS = 30
export const TREND_OLD_DAYS = 90

const DAY_MS = 24 * 60 * 60 * 1000

export function computeTrend(timestamps, {
  now = new Date(),
  oldDays = TREND_OLD_DAYS,
  recentDays = TREND_RECENT_DAYS,
} = {}) {
  const reference = now instanceof Date ? now.getTime() : Date.parse(now)
  if (Number.isNaN(reference)) {
    throw new TypeError('computeTrend requires a valid reference time.')
  }
  const parsed = (timestamps ?? [])
    .map((value) => Date.parse(value))
    .filter((value) => !Number.isNaN(value))
  if (!parsed.length) return 'stale'

  const recentCutoff = reference - recentDays * DAY_MS
  const oldCutoff = reference - oldDays * DAY_MS
  const recent = parsed.filter((value) => value >= recentCutoff).length
  const older = parsed.length - recent

  if (recent === 0) return 'stale'
  if (older === 0) return 'new'

  // Rate comparison rather than raw counts: the historical window is longer,
  // so counts alone would call every long-running topic "weakening".
  const historicalSpanDays = Math.max(
    1,
    (recentCutoff - Math.min(...parsed, oldCutoff)) / DAY_MS,
  )
  const recentRate = recent / recentDays
  const olderRate = older / historicalSpanDays
  if (recentRate >= olderRate * 2) return 'strengthening'
  if (recentRate * 2 <= olderRate) return 'weakening'
  return 'stable'
}

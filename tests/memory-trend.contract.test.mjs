import assert from 'node:assert/strict'
import test from 'node:test'

import { computeTrend } from '../src/memory-trend.mjs'

const NOW = new Date('2026-07-01T00:00:00.000Z')

function daysAgo(days) {
  return new Date(NOW.getTime() - days * 86_400_000).toISOString()
}

test('trend classification is a pure function of chronology', () => {
  // All recent -> new.
  assert.equal(
    computeTrend([daysAgo(2), daysAgo(9), daysAgo(20)], { now: NOW }),
    'new',
  )
  // Nothing recent -> stale.
  assert.equal(
    computeTrend([daysAgo(200), daysAgo(120), daysAgo(95)], { now: NOW }),
    'stale',
  )
  // Dense recently vs sparse history -> strengthening.
  assert.equal(
    computeTrend(
      [daysAgo(300), daysAgo(5), daysAgo(10), daysAgo(15), daysAgo(25)],
      { now: NOW },
    ),
    'strengthening',
  )
  // Dense history, one recent straggler -> weakening.
  assert.equal(
    computeTrend(
      [40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 28].map(daysAgo),
      { now: NOW },
    ),
    'weakening',
  )
  // Similar rates in both windows -> stable.
  assert.equal(
    computeTrend(
      [5, 15, 25, 40, 55, 70, 85].map(daysAgo),
      { now: NOW },
    ),
    'stable',
  )
  // Degenerate inputs.
  assert.equal(computeTrend([], { now: NOW }), 'stale')
  assert.equal(computeTrend(['not a date'], { now: NOW }), 'stale')
  assert.throws(() => computeTrend([daysAgo(1)], { now: 'garbage' }))
})

test('determinism: same timestamps, same reference, same trend', () => {
  const stamps = [3, 8, 33, 61, 88].map(daysAgo)
  assert.equal(
    computeTrend(stamps, { now: NOW }),
    computeTrend([...stamps].reverse(), { now: NOW }),
  )
})

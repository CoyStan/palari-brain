import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ACTIVE_MEMORY_MAX_DIGEST_CHARS,
  ACTIVE_MEMORY_MAX_ITEMS,
} from '../src/index.mjs'
import {
  benchTopic,
  offlineBenchReducer,
  runOfflineMemoryBench,
  syntheticPopulation,
} from '../evals/offline-memory-bench.mjs'
import { parseBenchArgs } from '../evals/run-offline-memory-bench.mjs'

test('the bench runs offline with no provider and no credential', async () => {
  const result = await runOfflineMemoryBench({
    interactionLimit: 12,
    population: syntheticPopulation({ interactions: 12 }),
  })
  assert.equal(result.processed, 12)
  assert.equal(result.canonicalRows, 24)
  // Every interaction reduced; nothing stalled at this length.
  assert.equal(result.reductionsApplied, 12)
  assert.equal(result.pending, 0)
  assert.deepEqual(result.blocked, [])
  assert.equal(result.digestReady, true)
  assert.equal(result.digestStatus, 'ready')
  assert.ok(result.digestItems > 0)
  assert.ok(result.digestItems <= ACTIVE_MEMORY_MAX_ITEMS)
  assert.ok(result.digestChars <= ACTIVE_MEMORY_MAX_DIGEST_CHARS)
})

test('the bench reports the capacity wall instead of hiding it', async () => {
  // Long enough to exhaust the character budget. The point of the bench is
  // that this is visible and attributed, not silent.
  const result = await runOfflineMemoryBench({
    population: syntheticPopulation({ interactions: 120 }),
  })
  assert.ok(result.digestChars <= ACTIVE_MEMORY_MAX_DIGEST_CHARS)
  assert.equal(result.failures.REDUCER_DIGEST_CAPACITY > 0, true)
  assert.ok(result.blocked.length > 0)
  assert.ok(result.blocked.every(
    (unit) => unit.category === 'REDUCER_DIGEST_CAPACITY',
  ))
  // The character cap binds long before the advertised item ceiling.
  assert.ok(
    result.digestItems < ACTIVE_MEMORY_MAX_ITEMS,
    'the 64-item ceiling is not what limits this digest',
  )
  // Canonical dialogue is never lost to a reduction failure.
  assert.equal(result.canonicalRows, 240)
})

test('the deterministic reducer honours the reduction contract', () => {
  const request = {
    input: {
      baseRevision: 3,
      evidence: [
        {
          id: 'dialogue_user',
          observedAt: '2026-07-26T10:00:00.000Z',
          speaker: 'user',
          text: 'My allergy is to shellfish and it is severe.',
        },
        {
          id: 'dialogue_palari',
          observedAt: '2026-07-26T10:00:00.000Z',
          speaker: 'Palari',
          text: 'Recorded your shellfish allergy as severe.',
        },
      ],
      limits: {},
      prior: [],
      utilization: {
        digestChars: 0,
        digestCharsRemaining: ACTIVE_MEMORY_MAX_DIGEST_CHARS,
        items: 0,
        itemsRemaining: ACTIVE_MEMORY_MAX_ITEMS,
      },
    },
  }
  const payload = offlineBenchReducer({ request })
  assert.equal(payload.baseRevision, 3)
  // Exactly one disposition per evidence item.
  assert.deepEqual(
    payload.dispositions.map((entry) => entry.evidenceId),
    ['dialogue_user', 'dialogue_palari'],
  )
  for (const action of payload.actions) {
    // Speaker purity: one action never mixes user and Palari evidence.
    const speakers = new Set(action.basis
      .filter((basis) => basis.kind === 'evidence')
      .map((basis) => request.input.evidence
        .find((entry) => entry.id === basis.id).speaker))
    assert.equal(speakers.size, 1)
    // Every evidence quote is an exact contiguous substring.
    for (const basis of action.basis.filter((b) => b.kind === 'evidence')) {
      const source = request.input.evidence
        .find((entry) => entry.id === basis.id).text
      assert.ok(source.includes(basis.quote))
    }
  }
})

test('bench topics are deterministic and bounded', () => {
  assert.equal(benchTopic('About my commute route: revision 4 now.'),
    benchTopic('About my commute route: revision 9 now.'))
  assert.equal(benchTopic(''), 'general')
  assert.ok(benchTopic('x'.repeat(400)).length <= 120)
})

test('bench arguments parse without reaching for a dataset by default', () => {
  assert.deepEqual(parseBenchArgs([]), {
    dataset: false,
    limit: Number.POSITIVE_INFINITY,
    questionId: '08e075c7',
  })
  assert.equal(parseBenchArgs(['--dataset']).dataset, true)
  // Naming a question implies the real dataset.
  assert.deepEqual(parseBenchArgs(['--question', 'abc123']), {
    dataset: true,
    limit: Number.POSITIVE_INFINITY,
    questionId: 'abc123',
  })
  assert.equal(parseBenchArgs(['--limit', '25']).limit, 25)
  assert.throws(() => parseBenchArgs(['--limit', '0']), /positive integer/)
  assert.throws(() => parseBenchArgs(['--nope']), /Unknown argument/)
})

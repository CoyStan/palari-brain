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

test('a long conversation reduces completely and stays inside both caps',
  async () => {
    // 240 interactions with recurring subjects, so the same facts are
    // corrected far more than the 16-support lineage limit allows an item
    // to accumulate. Before lean digest records and lineage shedding this
    // stalled after 33 of 240 with 69 units quarantined.
    const result = await runOfflineMemoryBench({
      population: syntheticPopulation({ interactions: 240 }),
    })
    assert.equal(result.processed, 240)
    assert.equal(result.reductionsApplied, 240)
    assert.equal(result.pending, 0)
    assert.deepEqual(result.blocked, [])
    assert.deepEqual(result.failures, {})
    assert.equal(result.digestReady, true)
    assert.equal(result.digestStatus, 'ready')

    // Inside both limits, with the character budget no longer the binding
    // constraint at this item count.
    assert.ok(result.digestItems <= ACTIVE_MEMORY_MAX_ITEMS)
    assert.ok(result.digestChars <= ACTIVE_MEMORY_MAX_DIGEST_CHARS)
    assert.ok(
      result.digestChars < ACTIVE_MEMORY_MAX_DIGEST_CHARS / 2,
      'lean records should leave real headroom, not just squeak under',
    )

    // The memory layer must actually shrink the conversation to earn its
    // place. Full provenance rendering achieved only 1.4x.
    assert.ok(
      result.canonicalChars / result.digestChars > 4,
      'digest must be materially smaller than the canonical text',
    )

    // Recall serves the digest itself, not the canonical fallback.
    assert.equal(result.briefingMode, 'incremental_digest')

    // The fact a later question would need is still supported.
    assert.equal(result.retention.checked, 1)
    assert.equal(result.retention.retained, 1)

    // Canonical dialogue is complete regardless.
    assert.equal(result.canonicalRows, 480)
  })

test('correcting one fact more than the lineage limit sheds oldest support',
  async () => {
    // The same topic every interaction: one item, corrected 40 times. The
    // 16-support cap used to fail the whole reduction at correction 17.
    const exchanges = Array.from({ length: 40 }, (unused, index) => ({
      assistantMessage: '',
      // Strictly increasing: a correction must be newer than what it
      // supersedes, so the clock may never wrap.
      eventAt: new Date(
        Date.UTC(2025, 0, 1) + index * 3_600_000,
      ).toISOString(),
      hasAnswer: false,
      representedTurns: 1,
      sourceMessageId: `lineage:${index}`,
      userMessage: `About my commute route: revision ${index} is current.`,
    }))
    const result = await runOfflineMemoryBench({
      population: {
        exchanges,
        label: 'single-topic-corrections',
        questionId: 'lineage-0001',
      },
    })
    assert.equal(result.reductionsApplied, 40)
    assert.deepEqual(result.blocked, [])
    assert.deepEqual(result.failures, {})
    // One topic collapses to one item, whose lineage is capped, not failed.
    assert.equal(result.digestItems, 1)
    assert.ok(result.maxSupportsPerItem <= 16)
    // Every message is still in the lossless journal.
    assert.equal(result.canonicalRows, 40)
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
    reduceEvery: 1,
  })
  assert.equal(parseBenchArgs(['--dataset']).dataset, true)
  // Naming a question implies the real dataset.
  assert.deepEqual(parseBenchArgs(['--question', 'abc123']), {
    dataset: true,
    limit: Number.POSITIVE_INFINITY,
    questionId: 'abc123',
    reduceEvery: 1,
  })
  assert.equal(parseBenchArgs(['--reduce-every', '20']).reduceEvery, 20)
  assert.throws(
    () => parseBenchArgs(['--reduce-every', '0']),
    /positive integer/,
  )
  assert.equal(parseBenchArgs(['--limit', '25']).limit, 25)
  assert.throws(() => parseBenchArgs(['--limit', '0']), /positive integer/)
  assert.throws(() => parseBenchArgs(['--nope']), /Unknown argument/)
})

test('batching cuts provider calls, and the bench shows what it costs',
  async () => {
    const population = syntheticPopulation({ interactions: 240 })
    const everyMessage = await runOfflineMemoryBench({
      population,
      reduceEvery: 1,
    })
    const batched = await runOfflineMemoryBench({
      population,
      reduceEvery: 20,
    })

    // One reducer request per message is the expensive default.
    assert.equal(everyMessage.reducerCalls, 240)
    // Batching consolidates a span of dialogue into a few facts per call.
    assert.ok(
      batched.reducerCalls * 10 < everyMessage.reducerCalls,
      `expected a large saving, got ${batched.reducerCalls} vs 240`,
    )

    // Both must still complete: batching may not trade correctness for cost.
    for (const result of [everyMessage, batched]) {
      assert.equal(result.pending, 0)
      assert.deepEqual(result.blocked, [])
      assert.equal(result.digestReady, true)
      assert.equal(result.canonicalRows, 480)
    }

    // The honest cost, measured rather than assumed: consolidating a wide
    // span makes a rare one-off fact more likely to be summarised away.
    // Recovering it is what memory exploration is for.
    assert.equal(everyMessage.retention.retained, 1)
    assert.equal(batched.retention.retained, 0)
  })

test('a failing interaction inside a batch is isolated, not blamed on the batch',
  async () => {
    // Batch reduction must not let one bad interaction quarantine the 19
    // innocent ones queued alongside it.
    const exchanges = Array.from({ length: 6 }, (unused, index) => ({
      assistantMessage: '',
      eventAt: new Date(Date.UTC(2025, 0, 1) + index * 3_600_000)
        .toISOString(),
      hasAnswer: false,
      representedTurns: 1,
      sourceMessageId: `batch:${index}`,
      userMessage: index === 3
        // Too large to render into any request: a deterministic failure.
        ? `oversized ${'x'.repeat(45_000)}`
        : `About my commute route: revision ${index} is current.`,
    }))
    const result = await runOfflineMemoryBench({
      population: {
        exchanges,
        label: 'poison-in-batch',
        questionId: 'batch-0001',
      },
      reduceEvery: 6,
    })
    // Exactly the one poison interaction is quarantined.
    assert.equal(result.blocked.length, 1)
    assert.deepEqual(
      result.blocked.map((unit) => unit.category),
      ['REDUCER_INPUT_CAPACITY'],
    )
    // Everything else got through, and nothing is left stuck.
    assert.equal(result.pending, 0)
    assert.ok(result.digestItems > 0)
    assert.equal(result.canonicalRows, 6)
  })

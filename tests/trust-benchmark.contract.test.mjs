import assert from 'node:assert/strict'
import test from 'node:test'

import {
  runTrustBenchmark,
  TRUST_BENCHMARK_CASES,
} from '../evals/trust-benchmark.mjs'
import {
  createPalariTrustAdapter,
} from '../evals/arms/palari-trust-adapter.mjs'
import { parseTrustBenchmarkArgs } from '../evals/run-trust-benchmark.mjs'

test('palari passes all five pre-registered trust cases', async () => {
  const report = await runTrustBenchmark(createPalariTrustAdapter())
  assert.equal(report.total, 5)
  assert.deepEqual(
    report.results.map((result) => [result.id, result.pass]),
    [
      ['paraphrased-recall', true],
      ['correction-chronology', true],
      ['verified-deletion', true],
      ['source-boundary', true],
      ['scope-isolation', true],
    ],
    JSON.stringify(report.results, null, 1),
  )
})

test('the deletion case has teeth: without the forget it fails', async () => {
  // A deletion case that would pass even when nothing was deleted proves
  // nothing. Drop the forget step and the same probes must find the fact.
  const original = TRUST_BENCHMARK_CASES
    .find((entry) => entry.id === 'verified-deletion')
  const withoutForget = {
    ...original,
    script: original.script.filter((step) => step.kind !== 'forget'),
  }
  const report = await runTrustBenchmark(createPalariTrustAdapter(), {
    cases: [withoutForget],
  })
  assert.equal(report.results[0].pass, false)
})

test('the isolation case has teeth: the owner can retrieve the fact',
  async () => {
    const original = TRUST_BENCHMARK_CASES
      .find((entry) => entry.id === 'scope-isolation')
    const asOwner = {
      ...original,
      script: original.script.map((step) =>
        step.kind === 'retrieve' ? { ...step, scope: 'A' } : step),
      // Same probes, asked by the fact's owner: now they MUST hit.
      score(observations) {
        const items = [
          ...(observations.get('question') ?? []),
          ...(observations.get('direct') ?? []),
        ]
        const hits = items.filter((item) =>
          String(item.text).includes('Riverdale'))
        return { detail: `${hits.length} owner hits`, pass: hits.length > 0 }
      },
    }
    const report = await runTrustBenchmark(createPalariTrustAdapter(), {
      cases: [asOwner],
    })
    assert.equal(report.results[0].pass, true)
  })

// A deliberately untrustworthy framework: one global store, document text
// ingested as if the user said it, deletion only hides the derived note
// while the transcript stays searchable. This is the failure shape the
// benchmark exists to catch — if this adapter passed, the benchmark would
// be decoration.
function createLeakyAdapter() {
  return {
    name: 'leaky-strawman',
    async open() {
      return { rows: [] }
    },
    async ingest(session, { eventAt, turn }) {
      const texts = [
        turn.user,
        ...(turn.sourceTexts ?? []),
      ].filter(Boolean)
      for (const text of texts) {
        session.rows.push({
          deletedNote: false,
          eventAt,
          speaker: 'user',
          text,
        })
      }
    },
    async forget(session, { containing }) {
      for (const row of session.rows) {
        if (row.text.includes(containing)) row.deletedNote = true
      }
    },
    async retrieve(session, { question }) {
      const terms = question.toLowerCase().split(/\s+/).filter(Boolean)
      return session.rows
        .filter((row) => terms.some((term) =>
          row.text.toLowerCase().includes(term)))
        .map((row) => ({
          observedAt: row.eventAt,
          origin: row.deletedNote ? 'journal' : 'memory',
          speaker: row.speaker,
          superseded: false,
          text: row.text,
        }))
    },
    async close() {},
  }
}

test('a leaky framework fails deletion, source boundary, and isolation',
  async () => {
    const report = await runTrustBenchmark(createLeakyAdapter())
    const byId = new Map(report.results.map((result) => [result.id, result]))
    assert.equal(byId.get('verified-deletion').pass, false)
    assert.equal(byId.get('source-boundary').pass, false)
    assert.equal(byId.get('scope-isolation').pass, false)
    assert.ok(report.passed < report.total)
  })

test('case ids are stable and match the pre-registered prediction set', () => {
  assert.deepEqual(
    TRUST_BENCHMARK_CASES.map((entry) => entry.id),
    [
      'paraphrased-recall',
      'correction-chronology',
      'verified-deletion',
      'source-boundary',
      'scope-isolation',
    ],
  )
  for (const benchmarkCase of TRUST_BENCHMARK_CASES) {
    assert.ok(Object.isFrozen(benchmarkCase))
    assert.ok(Object.isFrozen(benchmarkCase.script))
  }
})

test('the runner refuses malformed adapters and unknown flags', async () => {
  await assert.rejects(
    runTrustBenchmark({ open() {} }),
    TypeError,
  )
  assert.deepEqual(parseTrustBenchmarkArgs([]), { adapter: null })
  assert.deepEqual(
    parseTrustBenchmarkArgs(['--adapter', './x.mjs']),
    { adapter: './x.mjs' },
  )
  assert.throws(() => parseTrustBenchmarkArgs(['--framework', 'x']), TypeError)
})

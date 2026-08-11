import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createSyntheticScaleEmbedder,
  estimateLifetimeEnvelope,
  runScaleCurve,
} from '../evals/run-scale-probe.mjs'

test('100M lifetime-token envelope keeps tokens, messages, and chunks distinct', () => {
  const envelope = estimateLifetimeEnvelope()

  assert.equal(envelope.lifetimeTokens, 100_000_000)
  assert.deepEqual(envelope.messageTokens, [50, 200])
  assert.deepEqual(envelope.messageVectors, {
    max: 2_000_000,
    min: 500_000,
  })
  assert.deepEqual(envelope.chunkTokens, [256, 512])
  assert.deepEqual(envelope.chunkVectors, {
    max: 390_625,
    min: 195_313,
  })
})

test('scale curve measures the workspace database and latency tail offline', async () => {
  const lines = []
  const report = await runScaleCurve({
    log: (line) => lines.push(line),
    tiers: [50],
  })
  const [measurement] = report.measurements

  assert.equal(measurement.messages, 100)
  assert.equal(measurement.sharedTokenRecall, '25/25')
  assert.equal(measurement.zeroOverlapRecall, '0/25')
  assert.ok(measurement.dbBytes > 0)
  assert.ok(measurement.dbMb > 0)
  assert.ok(measurement.dbBytesPerMessage > 0)
  assert.ok(measurement.contentCharsPerMessage > 0)
  assert.ok(measurement.sharedP95Ms >= measurement.sharedMedianMs)
  assert.ok(measurement.zeroP95Ms >= measurement.zeroMedianMs)
  assert.match(lines[0], /100,000,000-token lifetime envelope/)
  assert.ok(lines.some((line) => line.includes('storage:')))
})

test('synthetic vectors exercise semantic capacity without claiming quality', async () => {
  const lines = []
  const report = await runScaleCurve({
    embedder: createSyntheticScaleEmbedder({ dimensions: 16 }),
    log: (line) => lines.push(line),
    semanticLabel: 'synthetic 16d capacity fixture; recall is plumbing-only',
    tiers: [50],
  })
  const [measurement] = report.measurements

  assert.equal(measurement.semanticSharedRecall, '25/25')
  assert.equal(measurement.semanticZeroRecall, '25/25')
  assert.ok(measurement.vectorIndexMs >= 0)
  assert.ok(measurement.vectorIndexMsPerMessage >= 0)
  assert.equal(measurement.vectorRowsIndexed, measurement.messages)
  assert.ok(measurement.vectorIndexCalls >= 2)
  assert.ok(measurement.semanticSharedP95Ms >=
    measurement.semanticSharedMedianMs)
  assert.ok(measurement.semanticZeroP95Ms >= measurement.semanticZeroMedianMs)
  assert.ok(lines.some((line) => line.includes('recall is plumbing-only')))
})

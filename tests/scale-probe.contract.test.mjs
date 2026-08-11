import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DEFAULT_EXACT_SCAN_DIMENSIONS,
  createSyntheticScaleEmbedder,
  estimateExactScanEnvelope,
  estimateLifetimeEnvelope,
  runScaleCurve,
  runSemanticScanMatrix,
  summarizeExactScanThreshold,
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

test('exact-scan envelope reports bytes and component visits without latency extrapolation',
  () => {
    assert.deepEqual(DEFAULT_EXACT_SCAN_DIMENSIONS, [384, 768, 1_536])
    const envelope = estimateExactScanEnvelope({ dimensions: [384, 1_536] })

    assert.deepEqual(envelope, {
      floatBytes: 4,
      lifetimeTokens: 100_000_000,
      messageTokens: [50, 200],
      messageVectors: {
        max: 2_000_000,
        min: 500_000,
      },
      scans: [
        {
          dimensions: 384,
          rawVectorBytes: {
            max: 3_072_000_000,
            min: 768_000_000,
          },
          vectorComponents: {
            max: 768_000_000,
            min: 192_000_000,
          },
        },
        {
          dimensions: 1_536,
          rawVectorBytes: {
            max: 12_288_000_000,
            min: 3_072_000_000,
          },
          vectorComponents: {
            max: 3_072_000_000,
            min: 768_000_000,
          },
        },
      ],
    })
    assert.equal(Object.hasOwn(envelope.scans[0], 'estimatedLatencyMs'), false)
  })

test('exact-scan review threshold is observed per dimension, not universal', () => {
  const threshold = summarizeExactScanThreshold([
    {
      messages: 1_000,
      semanticSharedP95Ms: 70,
      semanticZeroP95Ms: 90,
      vectorDimensions: 384,
    },
    {
      messages: 5_000,
      semanticSharedP95Ms: 110,
      semanticZeroP95Ms: 120,
      vectorDimensions: 384,
    },
    {
      messages: 1_000,
      semanticSharedP95Ms: 60,
      semanticZeroP95Ms: 80,
      vectorDimensions: 768,
    },
    {
      messages: 5_000,
      semanticSharedP95Ms: 90,
      semanticZeroP95Ms: 95,
      vectorDimensions: 768,
    },
  ], { p95BudgetMs: 100 })

  assert.deepEqual(threshold, {
    byDimension: [
      {
        dimensions: 384,
        firstObservedOverBudgetMessages: 5_000,
        firstObservedP95Ms: 120,
        lastObservedWithinBudgetMessages: 1_000,
        measuredThroughMessages: 5_000,
        status: 'comparison_justified',
      },
      {
        dimensions: 768,
        firstObservedOverBudgetMessages: null,
        firstObservedP95Ms: null,
        lastObservedWithinBudgetMessages: 5_000,
        measuredThroughMessages: 5_000,
        status: 'not_observed',
      },
    ],
    p95BudgetMs: 100,
    status: 'comparison_justified',
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

test('dimension matrix measures the real exact surface and labels its review budget',
  async () => {
    const lines = []
    const report = await runSemanticScanMatrix({
      dimensions: [8, 16],
      log: (line) => lines.push(line),
      p95BudgetMs: 1_000_000,
      tiers: [50],
    })

    assert.deepEqual(
      report.measurements.map((cell) => [
        cell.messages,
        cell.vectorDimensions,
        cell.vectorComponents,
        cell.rawVectorBytes,
      ]),
      [
        [100, 8, 800, 3_200],
        [100, 16, 1_600, 6_400],
      ],
    )
    assert.ok(report.measurements.every((cell) =>
      cell.semanticSharedRecall === '25/25' &&
      cell.semanticZeroRecall === '25/25' &&
      cell.exactScanP95Ms >= 0 &&
      cell.reviewBudgetExceeded === false))
    assert.equal(report.threshold.status, 'not_observed')
    assert.ok(lines.some((line) =>
      line.includes('diagnostic assumption, not a product SLO')))
    assert.ok(lines.some((line) => line.includes('component visits/query')))
  })

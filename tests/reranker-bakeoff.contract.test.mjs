import assert from 'node:assert/strict'
import test from 'node:test'

import { RERANKER_BANK } from '../evals/reranker-bank.mjs'
import {
  RERANKER_SELECTION_RULE,
  bankHash,
  baselineMetrics,
  main,
  scoreRanks,
} from '../evals/run-reranker-bakeoff.mjs'

test('synthetic bank is fixed, heterogeneous, and benchmark-independent', () => {
  assert.equal(RERANKER_BANK.length, 16)
  assert.equal(new Set(RERANKER_BANK.map((entry) => entry.id)).size, 16)
  assert.deepEqual(
    [...new Set(RERANKER_BANK.map((entry) => entry.category))].sort(),
    [
      'conflict', 'correction', 'honest-absence', 'lexical-distractor',
      'possession', 'preference', 'prior-advice', 'temporal',
    ],
  )
  assert.equal(RERANKER_BANK.filter((entry) =>
    entry.relevantIds.length === 0).length, 1)
  const serialized = JSON.stringify(RERANKER_BANK).toLowerCase()
  assert.doesNotMatch(serialized, /battery|power bank|1568498a|09d032c9/)
  assert.match(bankHash(), /^[0-9a-f]{64}$/)
})

test('metrics use positive cases and the frozen return cutoff', () => {
  assert.deepEqual(scoreRanks([1, 2, 6], 3), {
    mrr: (1 + 0.5 + 1 / 6) / 3,
    recallAtCutoff: 2 / 3,
    top1: 1 / 3,
  })
  const baseline = baselineMetrics()
  assert.equal(baseline.ranks.length, 15)
  assert.equal(baseline.top1, 0)
  assert.equal(baseline.recallAtCutoff, 1)
  assert.equal(RERANKER_SELECTION_RULE.minimumTop1, 0.8)
})

test('verification is import-safe and scoring flags fail closed', async () => {
  const verified = await main(['--verify'])
  assert.equal(verified.bankCases, 16)
  await assert.rejects(() => main([]), /Choose --verify or --run/)
  await assert.rejects(
    () => main(['--verify', '--model', 'x']),
    /accepts no scoring arguments/,
  )
  await assert.rejects(
    () => main(['--run', '--model', 'x']),
    /frozen --model/,
  )
})

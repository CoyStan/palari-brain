// U8-prep contract tests — live-slice planning logic (no live calls).
// The runner itself is FOUNDER GATED; what is tested here is the
// deterministic, spend-free planning surface: slice selection, cost
// accounting, and the guard that refuses live runs without explicit
// founder confirmation.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { loadLongMemEvalInstances } from '../src/longmemeval.mjs'
import {
  assertLiveRunAllowed,
  estimateSliceTokens,
  selectSlice,
} from '../src/slice.mjs'

async function fixtures() {
  const raw = await readFile(new URL('./fixtures/longmemeval-mini.json', import.meta.url), 'utf8')
  return loadLongMemEvalInstances(raw)
}

test('selectSlice: deterministic, stratified by question_type, includes abstention when present', async () => {
  const instances = await fixtures()
  const a = selectSlice(instances, { size: 3 })
  const b = selectSlice([...instances].reverse(), { size: 3 })
  assert.deepEqual(a.map((i) => i.questionId), b.map((i) => i.questionId), 'input order does not change the slice')
  assert.equal(a.length, 3)
  const types = new Set(a.map((i) => i.questionType))
  assert.ok(types.size >= 2, 'stratified across types')
  assert.ok(a.some((i) => i.isAbstention), 'abstention case included when available')
})

test('selectSlice: size larger than pool returns the whole pool, no invention', async () => {
  const instances = await fixtures()
  const slice = selectSlice(instances, { size: 10 })
  assert.equal(slice.length, 3)
})

test('estimateSliceTokens: counts sessions, turns, and chars into token estimates', async () => {
  const instances = await fixtures()
  const est = estimateSliceTokens(instances)
  assert.equal(est.questions, 3)
  assert.equal(est.sessions, 6)
  assert.ok(est.userTurns >= 6, 'user turns counted')
  assert.ok(est.historyChars > 0)
  assert.ok(est.estIngestInputTokens > 0, 'extraction input estimated')
  assert.ok(est.estAnswerInputTokens > 0, 'answer input estimated')
})

test('assertLiveRunAllowed: refuses without explicit founder confirmation and key', () => {
  assert.throws(() => assertLiveRunAllowed({}), /FOUNDER GATE/i)
  assert.throws(() => assertLiveRunAllowed({ PALARI_CONFIRM_SPEND: '1' }), /key/i)
  assert.throws(() => assertLiveRunAllowed({ GEMINI_API_KEY: 'k' }), /FOUNDER GATE/i)
  const ok = assertLiveRunAllowed({ GEMINI_API_KEY: 'k', PALARI_CONFIRM_SPEND: '1' })
  assert.equal(ok.provider, 'gemini')
  const anthropic = assertLiveRunAllowed({ ANTHROPIC_API_KEY: 'k', PALARI_CONFIRM_SPEND: '1' })
  assert.equal(anthropic.provider, 'anthropic')
})

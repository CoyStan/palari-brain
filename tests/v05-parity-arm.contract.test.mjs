// A1.2 deployed-path contrast, CORRECTED per Amendment A2: production
// v05 ingests chat turns through the preserved v05 extraction module, so the
// source boundary and contradiction
// supersession run there too. With the arm routed through the real
// deployed path, v05-current-memory remains at 42/44 with the same two
// historical findings. The governed kernel additionally denies inferred
// sharing, so its current dry score is intentionally one point lower. The
// kernel's upgrade value is therefore not raw dry-probe wins: it is the
// typed admission gate closing the raw-door writer class, eventAt
// evidence-time provenance (v05 stamps wall clock), and briefing v1
// attribution — none of which these behavior probes observe.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

import { loadJourneyBankFile } from '../evals/journey-bank.mjs'
import { runBank } from '../evals/harness.mjs'
import { createV05ParityArm } from '../evals/arms/v05-parity-arm.mjs'

const BANK_URL = new URL('../evals/journeys.json', import.meta.url)
const V05_EXTRACTION_URL =
  new URL('../src/v05-memory-extraction.mjs', import.meta.url)

function probe(arm, journeyId, probeId) {
  return arm.journeys
    .find((journey) => journey.journeyId === journeyId)
    ?.probes.find((result) => result.probeId === probeId)
}

test('v05 extraction comparator remains pinned to the preserved baseline bytes', async () => {
  const source = await readFile(V05_EXTRACTION_URL)
  assert.equal(
    createHash('sha256').update(source).digest('hex'),
    '770889c34c02a4c1f9162318c2b32786f6922ff288924627d681a10f92561a9f',
  )
})

test('v05 current-memory preserves the deployed 42/44 baseline', async () => {
  const bank = await loadJourneyBankFile(BANK_URL)
  const report = await runBank([createV05ParityArm()], bank)
  assert.equal(report.arms.length, 1)
  const arm = report.arms[0]
  assert.equal(arm.name, 'v05-current-memory')
  assert.equal(arm.summary.totalProbes, 44)
  assert.equal(arm.summary.passedProbes, 42)
  assert.equal(arm.summary.failedProbes, 2)

  const findingIds = arm.summary.findings
    .map((finding) => `${finding.journeyId}:${finding.probeId}`)
    .sort()
  assert.deepEqual(findingIds, [
    'conflict-cities-05:p2',
    'correction-espresso-04:p2',
  ])
  assert.ok(arm.summary.findings.every((finding) => finding.knownFinding),
    'both failures are the same documented findings the kernel carries')

  // Supersession runs in the deployed extraction pass: the current-value
  // probe answers cortado without leaking the corrected flat white.
  assert.equal(probe(arm, 'correction-espresso-04', 'p1').pass, true)
  assert.doesNotMatch(probe(arm, 'correction-espresso-04', 'p1').answer, /flat white/i)

  // The injection source boundary also runs in the deployed pass: the
  // poisoned candidates are dropped before the raw door, exactly one
  // legitimate write lands in vault-09 and none in onboarding-10.
  assert.equal(probe(arm, 'inject-vault-09', '_written').answer, 'written=1')
  assert.equal(probe(arm, 'inject-vault-09', 'p1').pass, true)
  assert.equal(probe(arm, 'inject-onboarding-10', '_written').answer, 'written=0')
  assert.equal(probe(arm, 'inject-onboarding-10', 'p1').pass, true)

  // Raw storage still scopes reads by user and Palari.
  assert.equal(probe(arm, 'isolation-accountant-07', 'p2').pass, true)
  assert.equal(probe(arm, 'palari-scoping-17', 'p2').pass, true)
})

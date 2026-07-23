// A1.2 deployed-path contrast, CORRECTED per Amendment A2: production
// v05 ingests chat turns through runMemoryExtractionPass (byte-identical
// file in v05 main), so the source boundary and contradiction
// supersession run there too. With the arm routed through the real
// deployed path, v05-current-memory TIES the kernel on dry behavior
// probes at 42/44, failing only the same two known findings. The
// kernel's upgrade value is therefore NOT dry-probe wins: it is the
// typed admission gate closing the raw-door writer class, eventAt
// evidence-time provenance (v05 stamps wall clock), and briefing v1
// attribution — none of which these behavior probes observe.
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { loadJourneyBankFile } from '../evals/journey-bank.mjs'
import { runBank } from '../evals/harness.mjs'
import { createV05ParityArm } from '../evals/arms/v05-parity-arm.mjs'

const BANK_URL = new URL('../evals/journeys.json', import.meta.url)

function probe(arm, journeyId, probeId) {
  return arm.journeys
    .find((journey) => journey.journeyId === journeyId)
    ?.probes.find((result) => result.probeId === probeId)
}

test('v05 current-memory (deployed extraction path) ties the kernel at 42/44', async () => {
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

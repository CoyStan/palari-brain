// J1 contract: the journey bank validates against its schema, and the
// kernel reference arm's dry baseline is pinned — 26/28 probes pass
// with exactly two KNOWN findings (temporal-history recall; plain
// conflicting re-assertions both briefed). A change to either number
// is a behavior change and must be a deliberate finding, not noise.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { loadJourneyBank, loadJourneyBankFile, validateJourney, journeyCategories } from '../evals/journey-bank.mjs'
import { runBank } from '../evals/harness.mjs'
import { createKernelArm } from '../evals/arms/kernel-arm.mjs'

const BANK_URL = new URL('../evals/journeys.json', import.meta.url)

function minimalJourney(overrides = {}) {
  return {
    id: 'j-min',
    title: 't',
    category: 'preference',
    workspace: { palariId: 'p', userId: 'u' },
    sessions: [{
      sessionId: 's1',
      eventAt: '2026-01-01T00:00:00.000Z',
      turns: [{ role: 'user', content: 'I prefer tea.' }],
    }],
    probes: [{
      id: 'p1',
      question: 'What do I prefer?',
      questionDate: '2026-02-01T00:00:00.000Z',
      expect: 'answer',
      mustContain: ['tea'],
      dimension: 'usefulness',
    }],
    ...overrides,
  }
}

test('journey bank loads, validates, and covers the charter categories', async () => {
  const bank = await loadJourneyBankFile(BANK_URL)
  assert.equal(bank.version, 1)
  assert.equal(bank.journeys.length, 11, 'seeded bank size')
  const categories = new Set(bank.journeys.map((j) => j.category))
  for (const required of ['preference', 'correction', 'conflict', 'forgetting', 'isolation', 'injection', 'multi-session']) {
    assert.ok(categories.has(required), `category ${required} present`)
  }
  for (const c of categories) assert.ok(journeyCategories.has(c))
  const probeCount = bank.journeys.reduce((n, j) => n + j.probes.length, 0)
  assert.equal(probeCount, 17, 'seeded probe count')
  assert.ok(bank.journeys.every((j) => Number.isInteger(j.expectTotalWritten)),
    'every seeded journey pins its written count (vacuity guard)')
})

test('validator rejects malformed journeys', async () => {
  assert.throws(() => validateJourney(minimalJourney({ category: 'vibes' })), /unknown category/)
  assert.throws(() => loadJourneyBank({ version: 1, journeys: [minimalJourney(), minimalJourney()] }), /duplicate journey id/)
  assert.throws(() => validateJourney(minimalJourney({
    probes: [{ id: 'p1', question: 'q?', questionDate: '2026-02-01T00:00:00.000Z', expect: 'abstain', mustContain: ['x'], dimension: 'usefulness' }],
  })), /abstain probes cannot require mustContain/)
  assert.throws(() => validateJourney(minimalJourney({
    directives: [{ type: 'forget', afterSession: 'nope', topic: 't' }],
  })), /afterSession nope unknown/)
  assert.throws(() => validateJourney(minimalJourney({ expectTotalWritten: -1 })), /expectTotalWritten/)
  assert.throws(() => loadJourneyBank({ version: 2, journeys: [minimalJourney()] }), /version must be 1/)
})

test('kernel reference arm: dry baseline is 26/28 with exactly the two known findings', async () => {
  const raw = await readFile(BANK_URL, 'utf8')
  const bank = loadJourneyBank(raw)
  const report = await runBank([createKernelArm()], bank)
  assert.equal(report.arms.length, 1)
  const arm = report.arms[0]
  assert.equal(arm.name, 'palari-brain-kernel')
  assert.equal(arm.summary.totalProbes, 28, '17 probes + 11 written-count checks')
  assert.equal(arm.summary.passedProbes, 26)
  assert.equal(arm.summary.failedProbes, 2)
  const findingIds = arm.summary.findings
    .map((f) => `${f.journeyId}:${f.probeId}`)
    .sort()
  assert.deepEqual(findingIds, ['conflict-cities-05:p2', 'correction-espresso-04:p2'])
  assert.ok(arm.summary.findings.every((f) => f.knownFinding),
    'every failure is a documented finding, never an unexplained regression')
  // Behavior worth pinning by name: injection drops kept the vault
  // password and the document-set name out of the store entirely.
  const inject = arm.journeys.find((j) => j.journeyId === 'inject-vault-09')
  assert.ok(inject.probes.every((p) => p.pass))
})

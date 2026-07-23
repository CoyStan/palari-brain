// J1 contract: the journey bank validates against its schema, and the
// kernel reference arm's dry baseline is pinned — 41/44 probes pass
// after background extraction was mechanically denied sharing authority.
// A change to this number is a deliberate finding, not noise.
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
  assert.equal(bank.journeys.length, 17, 'extended bank size')
  const categories = new Set(bank.journeys.map((j) => j.category))
  for (const required of ['preference', 'correction', 'conflict', 'forgetting', 'isolation', 'injection', 'multi-session']) {
    assert.ok(categories.has(required), `category ${required} present`)
  }
  for (const c of categories) assert.ok(journeyCategories.has(c))
  const probeCount = bank.journeys.reduce((n, j) => n + j.probes.length, 0)
  assert.equal(probeCount, 27, 'extended probe count')
  assert.ok(bank.journeys.every((j) => Number.isInteger(j.expectTotalWritten)),
    'every journey pins its written count (vacuity guard)')
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
  assert.throws(() => validateJourney(minimalJourney({
    sessions: [{
      sessionId: 's1',
      eventAt: '2026-01-01T00:00:00.000Z',
      turns: [{ role: 'user', content: 'I prefer tea.', asPalariId: '' }],
    }],
  })), /turn asPalariId must be a non-empty string/)
  assert.throws(() => validateJourney(minimalJourney({
    probes: [{
      id: 'p1',
      question: 'What do I prefer?',
      questionDate: '2026-02-01T00:00:00.000Z',
      expect: 'answer',
      dimension: 'usefulness',
      asUserId: ' ',
    }],
  })), /probe p1: asUserId must be a non-empty string/)
  assert.throws(() => validateJourney(minimalJourney({
    sessions: [{
      sessionId: 's1',
      eventAt: '2026-01-01T00:00:00.000Z',
      turns: [{ role: 'assistant', content: 'Tea noted.', asUserId: 'user-b' }],
    }],
  })), /actor overrides only on user turns/)
  assert.throws(() => loadJourneyBank({ version: 2, journeys: [minimalJourney()] }), /version must be 1/)
})

test('kernel reference arm: dry baseline is 41/44 with the authority finding', async () => {
  const raw = await readFile(BANK_URL, 'utf8')
  const bank = loadJourneyBank(raw)
  const report = await runBank([createKernelArm()], bank)
  assert.equal(report.arms.length, 1)
  const arm = report.arms[0]
  assert.equal(arm.name, 'palari-brain-kernel')
  assert.equal(arm.summary.totalProbes, 44, '27 probes + 17 written-count checks')
  assert.equal(arm.summary.passedProbes, 41)
  assert.equal(arm.summary.failedProbes, 3)
  const findingIds = arm.summary.findings
    .map((f) => `${f.journeyId}:${f.probeId}`)
    .sort()
  assert.deepEqual(findingIds, [
    'conflict-cities-05:p2',
    'correction-espresso-04:p2',
    'shared-standup-08:p1',
  ])
  assert.ok(
    arm.summary.findings
      .filter((finding) => finding.journeyId !== 'shared-standup-08')
      .every((finding) => finding.knownFinding),
    'the two frozen bank findings remain documented',
  )
  assert.deepEqual(
    arm.summary.findings
      .find((finding) => finding.journeyId === 'shared-standup-08')
      ?.reasons,
    ['expected an answer', 'missing "9:30"'],
    'background extraction cannot exercise explicit-user sharing authority',
  )
  // Behavior worth pinning by name: injection drops kept the vault
  // password and the document-set name out of the store entirely.
  const inject = arm.journeys.find((j) => j.journeyId === 'inject-vault-09')
  assert.ok(inject.probes.every((p) => p.pass))
})

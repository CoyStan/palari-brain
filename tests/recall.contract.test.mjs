// U5 contract tests — recall + briefing v1 (KERNEL-API §6; contract C7/C9/C10/C11/C12/C14/C15/C16).
// Completion law: recall tests green against fixture memories.
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { createKernelStore } from '../src/store.mjs'
import { createGatedStore } from '../src/gate.mjs'
import {
  briefingDiagnostics,
  buildBriefingV1,
  confidenceBucket,
  recallAndBrief,
} from '../src/recall.mjs'

const tempDirs = []
async function tempDir() {
  const dir = await mkdtemp(join(tmpdir(), 'brain-kernel-recall-'))
  tempDirs.push(dir)
  return dir
}
after(async () => {
  await Promise.all(tempDirs.splice(0).map((d) => rm(d, { force: true, recursive: true })))
})

const FIXED_NOW = new Date('2026-07-18T12:00:00.000Z')
const EVENT_AT = '2026-05-02T09:30:00.000Z'
const SCOPE = { palariId: 'palari-a', userId: 'user-1' }

async function openFixtureStore() {
  const root = await tempDir()
  const store = await createKernelStore({
    clock: () => FIXED_NOW,
    memoryEnabled: true,
    statePath: join(root, 'workspace-state.json'),
    workspaceId: 'contract-recall',
  })
  const gated = createGatedStore(store)
  return { gated, store }
}

const USER_PROV = { sourceKind: 'user_message', writer: 'explicit_user_action' }

function seedFixtures(gated) {
  const out = {}
  out.preference = gated.propose({
    kind: 'permanent',
    op: 'add',
    provenance: USER_PROV,
    record: {
      confidence: 0.9, content: 'Prefers macroeconomic briefs before espresso.', importance: 0.9,
      keywords: ['macroeconomic', 'espresso'], palari_id: SCOPE.palariId, type: 'preference', user_id: SCOPE.userId,
    },
  })
  out.extracted = gated.propose({
    kind: 'permanent',
    op: 'add',
    provenance: { eventAt: EVENT_AT, extractor: 'stub-extractor-v1', sourceKind: 'user_message', writer: 'background_extraction' },
    record: {
      confidence: 0.8, content: 'Sister moved to Oaxaca in spring.', importance: 0.7,
      keywords: ['oaxaca', 'sister'], palari_id: SCOPE.palariId, type: 'life_event', user_id: SCOPE.userId,
    },
  })
  out.webDerived = gated.propose({
    kind: 'promote',
    op: 'add',
    provenance: { eventAt: EVENT_AT, extractor: 'stub-extractor-v1', sourceKind: 'web_result', writer: 'background_extraction' },
    record: {
      confidence: 0.5, content: 'The espresso machine model was recalled by its maker.', importance: 0.6,
      keywords: ['espresso', 'recall-notice'], palari_id: SCOPE.palariId, type: 'working', user_id: SCOPE.userId,
    },
  })
  out.otherUserPrivate = gated.propose({
    kind: 'promote',
    op: 'add',
    provenance: USER_PROV,
    record: {
      confidence: 0.9, content: 'user-2 private espresso stash location.', importance: 0.9,
      keywords: ['espresso'], palari_id: SCOPE.palariId, type: 'working', user_id: 'user-2',
    },
  })
  for (const [name, r] of Object.entries(out)) {
    assert.notEqual(r.outcome, 'rejected', `fixture ${name} must land: ${r.reasons}`)
  }
  return out
}

test('recall: FTS hits against fixtures, scoped, budgeted, measured (C9/C10)', async () => {
  const { gated } = await openFixtureStore()
  const fx = seedFixtures(gated)
  const recall = gated.recallMemories('espresso preferences', {
    contextBudget: 12, now: FIXED_NOW, palariId: SCOPE.palariId, userId: SCOPE.userId,
  })
  const ids = recall.memories.map((m) => m.id)
  assert.ok(ids.includes(fx.preference.memory.id), 'direct FTS hit recalled')
  assert.ok(ids.includes(fx.webDerived.memory.id), 'transient FTS hit recalled')
  assert.ok(!ids.includes(fx.otherUserPrivate.memory.id), 'other user private excluded (C9)')
  assert.ok(recall.memories.length <= 12, 'context budget respected')
  assert.ok(Number.isFinite(recall.latencyMs) && recall.totalCandidates >= recall.memories.length, 'measured, not presumed')
})

test('recall: superseded values are not confidently recalled (C15)', async () => {
  const { gated } = await openFixtureStore()
  const v1 = gated.propose({
    kind: 'permanent', op: 'add', provenance: USER_PROV,
    record: { confidence: 0.9, content: 'Favorite conference is Jackson Hole.', keywords: ['conference'], palari_id: SCOPE.palariId, type: 'preference', user_id: SCOPE.userId },
  })
  const v2 = gated.propose({
    kind: 'permanent', op: 'supersede', provenance: USER_PROV, target: v1.memory.id,
    record: { confidence: 0.9, content: 'Favorite conference is now Lindau.', keywords: ['conference'], palari_id: SCOPE.palariId, type: 'preference', user_id: SCOPE.userId },
  })
  assert.equal(v2.outcome, 'superseded')
  const recall = gated.recallMemories('favorite conference', {
    contextBudget: 12, now: FIXED_NOW, palariId: SCOPE.palariId, userId: SCOPE.userId,
  })
  const ids = recall.memories.map((m) => m.id)
  assert.ok(ids.includes(v2.memory.id), 'newer value recalled')
  assert.ok(!ids.includes(v1.memory.id), 'superseded value absent from default recall')
})

test('briefing v1: per-memory line carries timestamp, attribution, confidence bucket (C12)', async () => {
  const { gated } = await openFixtureStore()
  const fx = seedFixtures(gated)
  const recall = gated.recallMemories('espresso oaxaca', {
    contextBudget: 12, now: FIXED_NOW, palariId: SCOPE.palariId, userId: SCOPE.userId,
  })
  const briefing = buildBriefingV1({ now: FIXED_NOW, recall })
  assert.equal(briefing.status, 'included')
  assert.ok(briefing.text.length > 0)

  const extractedLine = briefing.text.split('\n').find((l) => l.includes('Oaxaca'))
  assert.ok(extractedLine, 'extracted memory briefed')
  assert.ok(extractedLine.includes('2026-05-02'), 'event-time shown')
  assert.ok(extractedLine.includes('observed 2026-07-18'), 'observed-time shown when it differs (C12)')
  assert.ok(extractedLine.includes('confidence high'), 'confidence as bucket, not decimal')

  const userLine = briefing.text.split('\n').find((l) => l.includes('macroeconomic'))
  assert.ok(userLine.includes('from user'), 'session/source attribution present')
  assert.ok(!userLine.includes('observed'), 'no observed-time when times coincide')

  // C7: external-origin memories show origin at the surface
  const webLine = briefing.text.split('\n').find((l) => l.includes('recalled by its maker'))
  assert.ok(webLine, 'web-derived memory briefed')
  assert.ok(webLine.includes('origin web_result'), 'external origin surfaced')

  // labeled as evidence, never authority (C11)
  assert.match(briefing.text.split('\n')[1] ?? '', /untrusted evidence/i)
  assert.equal(briefing.included.length, briefing.text.split('\n').filter((l) => l.startsWith('- ')).length)
})

test('confidence buckets are stable kernel vocabulary', () => {
  assert.equal(confidenceBucket(0.9), 'high')
  assert.equal(confidenceBucket(0.6), 'medium')
  assert.equal(confidenceBucket(0.2), 'low')
})

test('honesty: empty recall yields an explicit absence briefing, never invention (C14/C16)', async () => {
  const { gated } = await openFixtureStore()
  const recall = gated.recallMemories('completely unknown topic zanzibar', {
    contextBudget: 12, now: FIXED_NOW, palariId: SCOPE.palariId, userId: SCOPE.userId,
  })
  assert.equal(recall.memories.length, 0)
  const briefing = buildBriefingV1({ now: FIXED_NOW, recall })
  assert.equal(briefing.status, 'empty')
  assert.match(briefing.text, /no stored memories match/i, 'absence stated plainly')
  assert.equal(briefing.included.length, 0)
})

test('C16 property: every briefed content line maps to a stored row', async () => {
  const { gated, store } = await openFixtureStore()
  seedFixtures(gated)
  const recall = gated.recallMemories('espresso oaxaca macroeconomic', {
    contextBudget: 12, now: FIXED_NOW, palariId: SCOPE.palariId, userId: SCOPE.userId,
  })
  const briefing = buildBriefingV1({ now: FIXED_NOW, recall })
  for (const entry of briefing.included) {
    const row = store.getMemoryById(entry.id)
    assert.ok(row, `briefed id ${entry.id} exists in store`)
    assert.ok(entry.content.startsWith(row.content.slice(0, 40)), 'briefed content derives from the stored row')
  }
})

test('recallAndBrief: orchestration records inclusion and reports measurement (C10)', async () => {
  const { gated, store } = await openFixtureStore()
  const fx = seedFixtures(gated)
  const result = recallAndBrief(gated, 'espresso preferences', SCOPE, { maxChars: 1800, now: FIXED_NOW })
  assert.equal(result.status, 'included')
  assert.ok(result.included.length >= 1)
  assert.ok(Number.isFinite(result.latencyMs))
  assert.ok(result.totalCandidates >= result.included.length)
  assert.ok(result.recallInclusionTouched >= 1, 'inclusion telemetry recorded')
  const touched = store.getMemoryById(fx.preference.memory.id)
  assert.ok(touched.last_accessed, 'included memory access recorded (needle survival measured)')
})

test('recallAndBrief: disabled or absent memory reports honestly instead of briefing (C14)', async () => {
  const root = await tempDir()
  const disabledBase = await createKernelStore({
    memoryEnabled: false,
    statePath: join(root, 'workspace-state.json'),
    workspaceId: 'disabled-recall',
  })
  const disabled = createGatedStore(disabledBase)
  const result = recallAndBrief(disabled, 'anything', SCOPE, { now: FIXED_NOW })
  assert.equal(result.status, 'disabled')
  assert.equal(result.included.length, 0)
})

test('recallAndBrief rejects arbitrary recall/inclusion-shaped sinks before calling them', () => {
  let called = false
  const duck = {
    publicStatus() {
      called = true
      return { enabled: true }
    },
    recallMemories() {
      called = true
      return { latencyMs: 0, memories: [], totalCandidates: 0 }
    },
    recordRecallInclusion() {
      called = true
      return { touched: [], touchedCount: 0 }
    },
  }
  assert.throws(
    () => recallAndBrief(duck, 'anything', SCOPE, { now: FIXED_NOW }),
    (error) => error?.code === 'legacy_invalid_capability',
  )
  assert.equal(called, false)
})

test('needle survival is measurable: briefing presence in a final prompt is a number, not a hope (C10)', async () => {
  const { gated } = await openFixtureStore()
  seedFixtures(gated)
  const result = recallAndBrief(gated, 'espresso', SCOPE, { now: FIXED_NOW })
  const prompt = `System preamble\n${result.text}\nUser question: what do I drink?`
  const diag = briefingDiagnostics({ briefingText: result.text, promptText: prompt })
  assert.ok(diag.memoryBriefingTokenShare > 0 && diag.memoryBriefingTokenShare < 1)
  assert.ok(diag.promptEstimatedTokens > diag.memoryBriefingEstimatedTokens)
})

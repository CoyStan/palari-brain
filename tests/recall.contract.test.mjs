// U5 contract tests — recall + briefing v1 (KERNEL-API §6; contract C7/C9/C10/C11/C12/C14/C15/C16).
// Completion law: recall tests green against fixture memories.
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { DatabaseSync } from 'node:sqlite'

import { createKernelStore, workspaceMemoryDbPath } from '../src/store.mjs'
import { createGatedStore } from '../src/gate.mjs'
import {
  briefingDiagnostics,
  buildBriefingV1,
  confidenceBucket,
  recallAndBrief,
} from '../src/recall.mjs'
import {
  seedB2Link,
  seedB2Memory,
  seedCdxM1Schema,
} from './helpers/cdx-b2-fixtures.mjs'

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

async function openFixtureStore(seed = undefined) {
  const root = await tempDir()
  const options = {
    clock: () => FIXED_NOW,
    memoryEnabled: true,
    statePath: join(root, 'workspace-state.json'),
    workspaceId: 'contract-recall',
  }
  if (seed !== undefined) {
    const dbPath = workspaceMemoryDbPath(options)
    await mkdir(dirname(dbPath), { recursive: true })
    const db = new DatabaseSync(dbPath)
    try {
      seedCdxM1Schema(db, 0, { withRows: false })
      seed(db)
    } finally {
      db.close()
    }
  }
  const store = await createKernelStore(options)
  const gated = createGatedStore(store)
  return { gated, store }
}

const FIXTURE_IDS = Object.freeze({
  extracted: 'historical_oaxaca',
  otherUserPrivate: 'historical_other_private',
  preference: 'historical_preference',
  webDerived: 'historical_web_result',
})

function seedFixtures(db) {
  const rows = [
    {
      acquisitionMode: 'direct',
      confidence: 0.9,
      content: 'Prefers macroeconomic briefs before espresso.',
      createdByPipeline: 0,
      id: FIXTURE_IDS.preference,
      importance: 0.9,
      keywords: 'macroeconomic espresso',
      memoryType: 'preference',
      sourceKind: 'user_message',
      userId: SCOPE.userId,
      validFrom: FIXED_NOW.toISOString(),
    },
    {
      acquisitionMode: 'extracted',
      confidence: 0.8,
      content: 'Sister moved to Oaxaca in spring.',
      createdByPipeline: 1,
      extractor: 'stub-extractor-v1',
      id: FIXTURE_IDS.extracted,
      importance: 0.7,
      keywords: 'oaxaca sister',
      memoryType: 'life_event',
      sourceKind: 'user_message',
      userId: SCOPE.userId,
      validFrom: EVENT_AT,
    },
    {
      acquisitionMode: 'extracted',
      confidence: 0.5,
      content: 'The espresso machine model was recalled by its maker.',
      createdByPipeline: 1,
      extractor: 'stub-extractor-v1',
      id: FIXTURE_IDS.webDerived,
      importance: 0.6,
      keywords: 'espresso recall-notice',
      memoryType: 'working',
      sourceKind: 'web_result',
      userId: SCOPE.userId,
      validFrom: EVENT_AT,
    },
    {
      acquisitionMode: 'direct',
      confidence: 0.9,
      content: 'user-2 private espresso stash location.',
      createdByPipeline: 0,
      id: FIXTURE_IDS.otherUserPrivate,
      importance: 0.9,
      keywords: 'espresso',
      memoryType: 'working',
      sourceKind: 'user_message',
      userId: 'user-2',
      validFrom: FIXED_NOW.toISOString(),
    },
  ]
  const update = db.prepare(`
    UPDATE main.memories
       SET importance = ?, confidence = ?, acquisition_mode = ?,
           created_by_pipeline = ?, source_kind = ?, extractor = ?
     WHERE id = ?
  `)
  for (const row of rows) {
    seedB2Memory(db, {
      content: row.content,
      createdAt: FIXED_NOW.toISOString(),
      id: row.id,
      keywords: row.keywords,
      memoryType: row.memoryType,
      palariId: SCOPE.palariId,
      userId: row.userId,
      validFrom: row.validFrom,
    })
    update.run(
      row.importance,
      row.confidence,
      row.acquisitionMode,
      row.createdByPipeline,
      row.sourceKind,
      row.extractor ?? null,
      row.id,
    )
  }
}

test('recall: FTS hits against fixtures, scoped, budgeted, measured (C9/C10)', async () => {
  const { gated } = await openFixtureStore(seedFixtures)
  const recall = gated.recallMemories('espresso preferences', {
    contextBudget: 12, now: FIXED_NOW, palariId: SCOPE.palariId, userId: SCOPE.userId,
  })
  const ids = recall.memories.map((m) => m.id)
  assert.ok(ids.includes(FIXTURE_IDS.preference), 'direct FTS hit recalled')
  assert.ok(ids.includes(FIXTURE_IDS.webDerived), 'transient FTS hit recalled')
  assert.ok(!ids.includes(FIXTURE_IDS.otherUserPrivate), 'other user private excluded (C9)')
  assert.ok(recall.memories.length <= 12, 'context budget respected')
  assert.ok(Number.isFinite(recall.latencyMs) && recall.totalCandidates >= recall.memories.length, 'measured, not presumed')
})

test('recall: superseded values are not confidently recalled (C15)', async () => {
  const oldId = 'historical_conference_old'
  const newId = 'historical_conference_new'
  const { gated } = await openFixtureStore((db) => {
    seedB2Memory(db, {
      content: 'Favorite conference is Jackson Hole.',
      id: oldId,
      keywords: 'conference',
      palariId: SCOPE.palariId,
      userId: SCOPE.userId,
      validFrom: EVENT_AT,
      validUntil: '2026-06-01T00:00:00.000Z',
    })
    seedB2Memory(db, {
      content: 'Favorite conference is now Lindau.',
      id: newId,
      keywords: 'conference',
      palariId: SCOPE.palariId,
      userId: SCOPE.userId,
      validFrom: '2026-06-01T00:00:00.000Z',
    })
    seedB2Link(db, {
      fromMemoryId: newId,
      id: 'historical_conference_supersedes',
      relation: 'supersedes',
      toMemoryId: oldId,
    })
  })
  const recall = gated.recallMemories('favorite conference', {
    contextBudget: 12, now: FIXED_NOW, palariId: SCOPE.palariId, userId: SCOPE.userId,
  })
  const ids = recall.memories.map((m) => m.id)
  assert.ok(ids.includes(newId), 'newer value recalled')
  assert.ok(!ids.includes(oldId), 'superseded value absent from default recall')
})

test('briefing v1: per-memory line carries timestamp, attribution, confidence bucket (C12)', async () => {
  const { gated } = await openFixtureStore(seedFixtures)
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
  const { gated, store } = await openFixtureStore(seedFixtures)
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

test('recallAndBrief: orchestration reports measurement while governed inclusion telemetry is inert (C10)', async () => {
  const { gated, store } = await openFixtureStore(seedFixtures)
  const result = recallAndBrief(gated, 'espresso preferences', SCOPE, { maxChars: 1800, now: FIXED_NOW })
  assert.equal(result.status, 'included')
  assert.ok(result.included.length >= 1)
  assert.ok(Number.isFinite(result.latencyMs))
  assert.ok(result.totalCandidates >= result.included.length)
  assert.equal(result.recallInclusionTouched, 0)
  const untouched = store.getMemoryById(FIXTURE_IDS.preference)
  assert.equal(untouched.last_accessed, null)
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
  const { gated } = await openFixtureStore(seedFixtures)
  const result = recallAndBrief(gated, 'espresso', SCOPE, { now: FIXED_NOW })
  const prompt = `System preamble\n${result.text}\nUser question: what do I drink?`
  const diag = briefingDiagnostics({ briefingText: result.text, promptText: prompt })
  assert.ok(diag.memoryBriefingTokenShare > 0 && diag.memoryBriefingTokenShare < 1)
  assert.ok(diag.promptEstimatedTokens > diag.memoryBriefingEstimatedTokens)
})

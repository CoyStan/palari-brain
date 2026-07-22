// U3 contract tests — store + schema + FTS (KERNEL-API §3, contract C1/C9/C17/C18/C19).
// Zero-dependency: node:test + node:assert. Run: npm test (node --test tests/).
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, access } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import {
  createKernelStore,
  deleteKernelStoreFile,
  permanentMemoryTypes,
  transientMemoryTypes,
} from '../src/store.mjs'

const tempDirs = []
async function tempDir() {
  const dir = await mkdtemp(join(tmpdir(), 'brain-kernel-store-'))
  tempDirs.push(dir)
  return dir
}
after(async () => {
  await Promise.all(tempDirs.splice(0).map((d) => rm(d, { force: true, recursive: true })))
})

const FIXED_NOW = new Date('2026-07-18T12:00:00.000Z')

async function openStore(workspaceId = 'contract-store') {
  const root = await tempDir()
  return createKernelStore({
    clock: () => FIXED_NOW,
    memoryEnabled: true,
    statePath: join(root, 'workspace-state.json'),
    workspaceId,
  })
}

const USER_WRITE = { sourceKind: 'user_message', writer: 'explicit_user_action' }

function addFixture(store, overrides = {}, writeOptions = USER_WRITE) {
  return store.addMemory({
    confidence: 0.9,
    content: 'Quetzali prefers pre-registered predictions before any scoring run.',
    importance: 0.8,
    keywords: ['predictions', 'preregistration'],
    palari_id: 'palari-a',
    type: 'preference',
    user_id: 'user-1',
    ...overrides,
  }, writeOptions)
}

async function pathExists(p) {
  try { await access(p); return true } catch { return false }
}

test('create: gated add inserts an atom with provenance and content hash (C1)', async () => {
  const store = await openStore()
  const result = addFixture(store)
  assert.equal(result.outcome, 'inserted')
  const row = store.getMemoryById(result.memory.id)
  assert.ok(row, 'row readable by id')
  assert.equal(row.palari_id, 'palari-a')
  assert.equal(row.user_id, 'user-1')
  assert.equal(row.type, 'preference')
  assert.equal(row.acquisition_mode, 'direct') // explicit_user_action => direct
  assert.equal(Boolean(row.created_by_pipeline), false)
  assert.ok(row.content_hash, 'content hash recorded')
  assert.ok(row.valid_from, 'validity start stamped')
  assert.equal(row.valid_until, null)
  store.close()
})

test('create: unauthorized writer is rejected (baseline write door)', async () => {
  const store = await openStore()
  assert.throws(() => addFixture(store, {}, { sourceKind: 'user_message', writer: 'rogue_pipeline' }))
  store.close()
})

test('type partition: permanent and transient sets are disjoint and cover schema types (C1)', () => {
  for (const t of permanentMemoryTypes) assert.ok(!transientMemoryTypes.has(t))
  assert.ok(permanentMemoryTypes.has('preference'))
  assert.ok(transientMemoryTypes.has('working'))
})

test('FTS + palari scoping: search finds by keyword only inside the palari scope (C9)', async () => {
  const store = await openStore()
  addFixture(store)
  const hits = store.searchMemories('predictions', { palariId: 'palari-a', userId: 'user-1' })
  assert.equal(hits.length, 1)
  const wrongPalari = store.searchMemories('predictions', { palariId: 'palari-b', userId: 'user-1' })
  assert.equal(wrongPalari.length, 0)
  // mandatory predicate: recall without palariId returns empty, never leaks
  const noScope = store.recallMemories('predictions', { now: FIXED_NOW, palariId: '', userId: 'user-1' })
  assert.equal(noScope.memories.length, 0)
  assert.equal(noScope.totalCandidates, 0)
  store.close()
})

test('user scoping: own + general + shared are visible; another user’s private row is not (C9)', async () => {
  const store = await openStore()
  addFixture(store, { content: 'user-1 private: prefers espresso before analysis.', keywords: ['espresso'] })
  addFixture(store, { content: 'general: the workspace tracks espresso stock.', keywords: ['espresso'], user_id: null })
  addFixture(store, { content: 'user-2 shared: espresso machine fixed on Tuesday.', keywords: ['espresso'], shared: true, user_id: 'user-2' })
  addFixture(store, { content: 'user-2 private: espresso budget worries.', keywords: ['espresso'], user_id: 'user-2' })

  const forUser1 = store.searchMemories('espresso', { palariId: 'palari-a', userId: 'user-1' })
  const contents = forUser1.map((r) => r.content).sort()
  assert.equal(forUser1.length, 3, 'own + general + shared visible')
  assert.ok(!contents.some((c) => c.includes('user-2 private')), 'other user’s private row invisible')
  store.close()
})

test('delete: removes the row and leaves no FTS or link residue (C17)', async () => {
  const store = await openStore()
  const a = addFixture(store)
  const b = addFixture(store, { content: 'Linked note about prediction discipline.', keywords: ['predictions'] })
  store.addMemoryLink({ fromMemoryId: a.memory.id, toMemoryId: b.memory.id })

  const del = store.deleteMemory(a.memory.id, { actor: 'explicit_user_action' })
  assert.ok(del)
  assert.equal(store.getMemoryById(a.memory.id), null)
  // FTS residue-free: raw FTS table has no row for the deleted id
  const ftsRows = store.db.prepare('SELECT memory_id FROM memory_fts WHERE memory_id = ?').all(a.memory.id)
  assert.equal(ftsRows.length, 0, 'no FTS residue')
  // link residue-free: cascade removed the link
  const linkRows = store.db.prepare('SELECT id FROM memory_links WHERE from_memory_id = ? OR to_memory_id = ?').all(a.memory.id, a.memory.id)
  assert.equal(linkRows.length, 0, 'no link residue')
  store.close()
})

test('topic-forget: removes matching rows visible to the requesting scope only (C18)', async () => {
  const store = await openStore()
  const mine = addFixture(store, { content: 'user-1: the tax filing deadline moved.', keywords: ['tax', 'filing'] })
  const general = addFixture(store, { content: 'general: tax season notes for the workspace.', keywords: ['tax'], user_id: null })
  const theirs = addFixture(store, { content: 'user-2 private: tax anxiety journaling.', keywords: ['tax'], user_id: 'user-2' })
  const offTopic = addFixture(store, { content: 'user-1: prefers walking meetings.', keywords: ['walking'] })
  const otherPalari = addFixture(store, { content: 'palari-b: tax memo elsewhere.', keywords: ['tax'], palari_id: 'palari-b' })

  const result = store.topicForget('tax', { palariId: 'palari-a', userId: 'user-1' }, { actor: 'explicit_user_action' })
  const deletedIds = result.deleted.sort()
  assert.deepEqual(deletedIds, [mine.memory.id, general.memory.id].sort(), 'own + general matching rows removed')
  assert.equal(store.getMemoryById(theirs.memory.id)?.content?.includes('user-2 private'), true, 'other user’s private row survives')
  assert.ok(store.getMemoryById(offTopic.memory.id), 'off-topic row survives')
  assert.ok(store.getMemoryById(otherPalari.memory.id), 'other palari untouched')
  // residue-free for the forgotten rows
  for (const id of deletedIds) {
    assert.equal(store.db.prepare('SELECT memory_id FROM memory_fts WHERE memory_id = ?').all(id).length, 0)
  }
  store.close()
})

test('ownership: one SQLite file per workspace; deletable as a unit (C19)', async () => {
  const root = await tempDir()
  const statePath = join(root, 'workspace-state.json')
  const store = await createKernelStore({
    clock: () => FIXED_NOW,
    memoryEnabled: true,
    statePath,
    workspaceId: 'ownership-check',
  })
  addFixture(store)
  assert.ok(store.dbPath.endsWith('ownership-check.memory.sqlite'))
  assert.ok(await pathExists(store.dbPath), 'store is a real file on disk')
  store.close()
  await deleteKernelStoreFile({ statePath, workspaceId: 'ownership-check' })
  assert.equal(await pathExists(store.dbPath), false, 'whole store deletable as a unit')
})

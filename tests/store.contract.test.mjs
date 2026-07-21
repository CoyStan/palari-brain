// CDX-M1 safe store contract after V2-M2-A2 routing.
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, access } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { DatabaseSync } from 'node:sqlite'

import { createGatedStore } from '../src/gate.mjs'
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
  await Promise.all(tempDirs.splice(0).map((directory) =>
    rm(directory, { force: true, recursive: true })))
})

const FIXED_NOW = new Date('2026-07-18T12:00:00.000Z')

async function openStore(workspaceId = 'contract-store') {
  const root = await tempDir()
  const base = await createKernelStore({
    clock: () => FIXED_NOW,
    memoryEnabled: true,
    statePath: join(root, 'workspace-state.json'),
    workspaceId,
  })
  return { base, gated: createGatedStore(base), root }
}

function addFixture(gated, overrides = {}) {
  const record = {
    confidence: 0.9,
    content: 'Quetzali prefers pre-registered predictions before any scoring run.',
    importance: 0.8,
    keywords: ['predictions', 'preregistration'],
    palari_id: 'palari-a',
    type: 'preference',
    user_id: 'user-1',
    ...overrides,
  }
  return gated.propose({
    kind: permanentMemoryTypes.has(record.type) ? 'permanent' : 'promote',
    op: 'add',
    provenance: { sourceKind: 'user_message', writer: 'explicit_user_action' },
    record,
  })
}

function inspectDatabase(dbPath, callback) {
  const db = new DatabaseSync(dbPath, { readOnly: true })
  try {
    return callback(db)
  } finally {
    db.close()
  }
}

async function pathExists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

test('safe base exposes exact read-only surface; gated add lands provenance and hash', async () => {
  const { base, gated } = await openStore()
  assert.deepEqual(Object.keys(base), [
    'close',
    'config',
    'dbPath',
    'enabled',
    'getMemoryById',
    'listMemories',
    'publicStatus',
    'recallMemories',
    'searchMemories',
    'status',
  ])
  for (const forbidden of [
    'addMemory',
    'addMemoryLink',
    'bumpImportance',
    'db',
    'initializeSchema',
    'insertMemory',
    'supersedeMemory',
    'touchMemory',
  ]) {
    assert.equal(base[forbidden], undefined, `${forbidden} is not exposed`)
  }
  assert.ok(Object.isFrozen(base))

  const result = addFixture(gated)
  assert.equal(result.outcome, 'inserted')
  const row = base.getMemoryById(result.memory.id)
  assert.equal(row.palari_id, 'palari-a')
  assert.equal(row.user_id, 'user-1')
  assert.equal(row.type, 'preference')
  assert.equal(row.acquisition_mode, 'direct')
  assert.equal(row.created_by_pipeline, 0)
  assert.equal(row.source_kind, 'user_message')
  assert.equal(row.extractor, null)
  assert.ok(row.content_hash)
  assert.ok(row.valid_from)
  assert.equal(row.valid_until, null)
  gated.close()
})

test('type partition exports are immutable, disjoint, and cover schema types', () => {
  for (const type of permanentMemoryTypes) assert.ok(!transientMemoryTypes.has(type))
  assert.ok(permanentMemoryTypes.has('preference'))
  assert.ok(transientMemoryTypes.has('working'))
  assert.equal(permanentMemoryTypes.add, undefined)
  assert.equal(transientMemoryTypes.delete, undefined)
})

test('FTS and Palari scope remain exact through safe reads', async () => {
  const { base, gated } = await openStore()
  addFixture(gated)
  const hits = base.searchMemories('predictions', {
    palariId: 'palari-a',
    userId: 'user-1',
  })
  assert.equal(hits.length, 1)
  assert.equal(base.searchMemories('predictions', {
    palariId: 'palari-b',
    userId: 'user-1',
  }).length, 0)
  const noScope = base.recallMemories('predictions', {
    now: FIXED_NOW,
    palariId: '',
    userId: 'user-1',
  })
  assert.equal(noScope.memories.length, 0)
  assert.equal(noScope.totalCandidates, 0)
  gated.close()
})

test('user scope preserves own + general + shared and hides other private rows', async () => {
  const { base, gated } = await openStore()
  addFixture(gated, {
    content: 'user-1 private: prefers espresso before analysis.',
    keywords: ['espresso'],
  })
  addFixture(gated, {
    content: 'general: the workspace tracks espresso stock.',
    keywords: ['espresso'],
    user_id: null,
  })
  addFixture(gated, {
    content: 'user-2 shared: espresso machine fixed on Tuesday.',
    keywords: ['espresso'],
    shared: true,
    user_id: 'user-2',
  })
  addFixture(gated, {
    content: 'user-2 private: espresso budget worries.',
    keywords: ['espresso'],
    user_id: 'user-2',
  })

  const rows = base.searchMemories('espresso', {
    palariId: 'palari-a',
    userId: 'user-1',
  })
  assert.equal(rows.length, 3)
  assert.ok(!rows.some(({ content }) => content.includes('user-2 private')))
  gated.close()
})

test('routed delete removes memory, FTS row, and supersession-link cascade', async () => {
  const { base, gated } = await openStore()
  const first = addFixture(gated, {
    content: 'The first deletion-cascade preference.',
    id: 'delete_cascade_old',
  })
  const second = gated.propose({
    kind: 'permanent',
    op: 'supersede',
    provenance: { sourceKind: 'user_message', writer: 'explicit_user_action' },
    record: {
      confidence: 0.9,
      content: 'The replacement deletion-cascade preference.',
      id: 'delete_cascade_new',
      palari_id: 'palari-a',
      type: 'preference',
      user_id: 'user-1',
    },
    target: first.memory.id,
  })
  assert.equal(second.outcome, 'superseded')

  const deleted = gated.deleteMemory(first.memory.id, {
    actor: 'explicit_user_action',
  })
  assert.deepEqual(
    { deleted: deleted.deleted, reason: deleted.reason },
    { deleted: true, reason: 'deleted' },
  )
  assert.equal(base.getMemoryById(first.memory.id), null)
  inspectDatabase(base.dbPath, (db) => {
    assert.equal(db.prepare(
      'SELECT count(*) AS count FROM main.memory_fts WHERE memory_id = ?',
    ).get(first.memory.id).count, 0)
    assert.equal(db.prepare(`
      SELECT count(*) AS count
      FROM main.memory_links
      WHERE from_memory_id = ? OR to_memory_id = ?
    `).get(first.memory.id, first.memory.id).count, 0)
  })
  gated.close()
})

test('atomic topic forget removes only visible matching rows', async () => {
  const { base, gated } = await openStore()
  const mine = addFixture(gated, {
    content: 'user-1: the tax filing deadline moved.',
    keywords: ['tax', 'filing'],
  })
  const general = addFixture(gated, {
    content: 'general: tax season notes for the workspace.',
    keywords: ['tax'],
    user_id: null,
  })
  const theirs = addFixture(gated, {
    content: 'user-2 private: tax anxiety journaling.',
    keywords: ['tax'],
    user_id: 'user-2',
  })
  const offTopic = addFixture(gated, {
    content: 'user-1: prefers walking meetings.',
    keywords: ['walking'],
  })
  const otherPalari = addFixture(gated, {
    content: 'palari-b: tax memo elsewhere.',
    keywords: ['tax'],
    palari_id: 'palari-b',
  })

  const result = gated.topicForget(
    'tax',
    { palariId: 'palari-a', userId: 'user-1' },
    { actor: 'explicit_user_action' },
  )
  assert.deepEqual(
    result.deleted.toSorted(),
    [mine.memory.id, general.memory.id].toSorted(),
  )
  assert.equal(result.count, 2)
  assert.ok(base.getMemoryById(theirs.memory.id))
  assert.ok(base.getMemoryById(offTopic.memory.id))
  assert.ok(base.getMemoryById(otherPalari.memory.id))
  gated.close()
})

test('CDX-M0/M1 bootstrap is complete before handle publication', async () => {
  const { base, gated } = await openStore()
  const rows = inspectDatabase(base.dbPath, (db) => db.prepare(
    'SELECT id FROM main.memory_migrations ORDER BY id',
  ).all().map(({ id }) => id))
  assert.deepEqual(rows, ['CDX-M0', 'CDX-M1'])
  gated.close()
})

test('one workspace file is deleted only after the safe handle closes', async () => {
  const root = await tempDir()
  const statePath = join(root, 'workspace-state.json')
  const base = await createKernelStore({
    clock: () => FIXED_NOW,
    memoryEnabled: true,
    statePath,
    workspaceId: 'ownership-check',
  })
  const gated = createGatedStore(base)
  addFixture(gated)
  assert.ok(base.dbPath.endsWith('ownership-check.memory.sqlite'))
  assert.ok(await pathExists(base.dbPath))
  await assert.rejects(
    deleteKernelStoreFile({ statePath, workspaceId: 'ownership-check' }),
    (error) => error?.code === 'legacy_store_open',
  )
  gated.close()
  assert.deepEqual(
    await deleteKernelStoreFile({ statePath, workspaceId: 'ownership-check' }),
    { dbPath: base.dbPath, removed: true },
  )
  assert.equal(await pathExists(base.dbPath), false)
})

test('enabled reads recheck liveness after every caller-controlled capture phase', async () => {
  const cases = [
    {
      invoke(base) {
        return base.getMemoryById({
          toString() {
            base.close()
            return 'missing'
          },
        })
      },
      label: 'getMemoryById id coercion',
    },
    {
      invoke(base) {
        return base.listMemories({
          palariId: {
            toString() {
              base.close()
              return 'palari-a'
            },
          },
          userId: 'user-1',
        })
      },
      label: 'listMemories scope coercion',
    },
    {
      invoke(base) {
        return base.searchMemories({
          toString() {
            base.close()
            return ''
          },
        }, { palariId: 'palari-a' })
      },
      label: 'searchMemories early-return query coercion',
    },
    {
      invoke(base) {
        return base.recallMemories({
          toString() {
            base.close()
            return 'predictions'
          },
        }, {
          now: FIXED_NOW,
          palariId: 'palari-a',
          userId: 'user-1',
        })
      },
      label: 'recallMemories query coercion',
    },
    {
      invoke(base) {
        return base.recallMemories('ignored', {
          palariId: {
            toString() {
              base.close()
              return ''
            },
          },
          userId: 'user-1',
        })
      },
      label: 'recallMemories empty-scope early return',
    },
  ]

  for (const { invoke, label } of cases) {
    const { base } = await openStore(`read-close-${label}`)
    assert.throws(
      () => invoke(base),
      (error) => error?.code === 'legacy_store_closed',
      label,
    )
  }
})

// CDX-M1 safe store contract after V2-M2-A2 routing.
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, access, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { DatabaseSync } from 'node:sqlite'

import { createGatedStore } from '../src/gate.mjs'
import {
  createKernelStore,
  deleteKernelStoreFile,
  permanentMemoryTypes,
  transientMemoryTypes,
  workspaceMemoryDbPath,
} from '../src/store.mjs'
import {
  seedB2Link,
  seedB2Memory,
  seedCdxM1Schema,
} from './helpers/cdx-b2-fixtures.mjs'

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

async function openStore(workspaceId = 'contract-store', seed = undefined) {
  const root = await tempDir()
  const options = {
    clock: () => FIXED_NOW,
    memoryEnabled: true,
    statePath: join(root, 'workspace-state.json'),
    workspaceId,
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
  const base = await createKernelStore(options)
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

test('safe base exposes exact read-only surface; unsupported gated add is refused without a write', async () => {
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
  assert.deepEqual(result, {
    outcome: 'rejected',
    reasons: ['governance_refused'],
  })
  assert.deepEqual(base.listMemories({ palariId: 'palari-a' }), [])
  inspectDatabase(base.dbPath, (db) => {
    assert.equal(db.prepare(
      'SELECT count(*) AS count FROM main.memories',
    ).get().count, 0)
    assert.equal(db.prepare(
      'SELECT count(*) AS count FROM main.cdx_b2_decisions',
    ).get().count, 0)
  })
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
  const { base, gated } = await openStore('fts-read-scope', (db) => {
    seedB2Memory(db, {
      content: 'Quetzali prefers pre-registered predictions before scoring.',
      id: 'historical_predictions',
      keywords: 'predictions preregistration',
      palariId: 'palari-a',
      userId: 'user-1',
    })
  })
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
  const { base, gated } = await openStore('historical-user-scope', (db) => {
    const rows = [
      ['own-private', 'user-1 private: prefers espresso before analysis.', 'user-1', 0],
      ['general', 'general: the workspace tracks espresso stock.', null, 0],
      ['other-shared', 'user-2 shared: espresso machine fixed on Tuesday.', 'user-2', 1],
      ['other-private', 'user-2 private: espresso budget worries.', 'user-2', 0],
    ]
    for (const [id, content, userId, shared] of rows) {
      seedB2Memory(db, {
        content,
        id,
        keywords: 'espresso',
        palariId: 'palari-a',
        shared,
        userId,
      })
      if (userId === null) {
        db.prepare('UPDATE main.memories SET user_id = NULL WHERE id = ?')
          .run(id)
      }
    }
  })

  const rows = base.searchMemories('espresso', {
    palariId: 'palari-a',
    userId: 'user-1',
  })
  assert.equal(rows.length, 3)
  assert.ok(!rows.some(({ content }) => content.includes('user-2 private')))
  gated.close()
})

test('ungranted routed delete is refused and preserves memory, FTS, links, and B2 head', async () => {
  const { base, gated } = await openStore('refused-delete', (db) => {
    seedB2Memory(db, {
      content: 'The first deletion-cascade preference.',
      id: 'delete_cascade_old',
      keywords: 'deletion cascade',
      palariId: 'palari-a',
      userId: 'user-1',
    })
    seedB2Memory(db, {
      content: 'The replacement deletion-cascade preference.',
      id: 'delete_cascade_new',
      keywords: 'deletion cascade',
      palariId: 'palari-a',
      userId: 'user-1',
    })
    seedB2Link(db, {
      fromMemoryId: 'delete_cascade_new',
      id: 'delete_cascade_link',
      relation: 'supersedes',
      toMemoryId: 'delete_cascade_old',
    })
  })

  const deleted = gated.deleteMemory('delete_cascade_old', {
    actor: 'explicit_user_action',
  })
  assert.deepEqual(deleted, {
    deleted: false,
    reason: 'governance_refused',
  })
  assert.ok(base.getMemoryById('delete_cascade_old'))
  inspectDatabase(base.dbPath, (db) => {
    assert.equal(db.prepare(
      'SELECT count(*) AS count FROM main.memory_fts WHERE memory_id = ?',
    ).get('delete_cascade_old').count, 1)
    assert.equal(db.prepare(`
      SELECT count(*) AS count
      FROM main.memory_links
      WHERE from_memory_id = ? OR to_memory_id = ?
    `).get('delete_cascade_old', 'delete_cascade_old').count, 1)
    assert.equal(db.prepare(
      'SELECT count(*) AS count FROM main.cdx_b2_decisions',
    ).get().count, 0)
  })
  gated.close()
})

test('topic forget returns its inert refusal shape and preserves every checkpoint row', async () => {
  const ids = ['mine', 'general', 'theirs', 'off-topic', 'other-palari']
  const { base, gated } = await openStore('refused-topic-forget', (db) => {
    const rows = [
      ['mine', 'user-1: the tax filing deadline moved.', 'tax filing', 'palari-a', 'user-1'],
      ['general', 'general: tax season notes for the workspace.', 'tax', 'palari-a', null],
      ['theirs', 'user-2 private: tax anxiety journaling.', 'tax', 'palari-a', 'user-2'],
      ['off-topic', 'user-1: prefers walking meetings.', 'walking', 'palari-a', 'user-1'],
      ['other-palari', 'palari-b: tax memo elsewhere.', 'tax', 'palari-b', 'user-1'],
    ]
    for (const [id, content, keywords, palariId, userId] of rows) {
      seedB2Memory(db, { content, id, keywords, palariId, userId })
    }
  })

  const result = gated.topicForget(
    'tax',
    { palariId: 'palari-a', userId: 'user-1' },
    { actor: 'explicit_user_action' },
  )
  assert.deepEqual(result, { count: 0, deleted: [] })
  for (const id of ids) assert.ok(base.getMemoryById(id))
  inspectDatabase(base.dbPath, (db) => {
    assert.equal(db.prepare(
      'SELECT count(*) AS count FROM main.cdx_b2_decisions',
    ).get().count, 0)
  })
  gated.close()
})

test('CDX-M0/M1/B2 bootstrap is complete before handle publication', async () => {
  const { base, gated } = await openStore()
  const rows = inspectDatabase(base.dbPath, (db) => db.prepare(
    'SELECT id FROM main.memory_migrations ORDER BY id',
  ).all().map(({ id }) => id))
  assert.deepEqual(rows, ['CDX-B2', 'CDX-M0', 'CDX-M1'])
  gated.close()
})

test('terminal workspace deletion is refused before and after safe-handle close', async () => {
  const root = await tempDir()
  const statePath = join(root, 'workspace-state.json')
  const base = await createKernelStore({
    clock: () => FIXED_NOW,
    memoryEnabled: true,
    statePath,
    workspaceId: 'ownership-check',
  })
  const gated = createGatedStore(base)
  assert.ok(base.dbPath.endsWith('ownership-check.memory.sqlite'))
  assert.ok(await pathExists(base.dbPath))
  await assert.rejects(
    deleteKernelStoreFile({ statePath, workspaceId: 'ownership-check' }),
    (error) => error?.code === 'legacy_terminal_storage_refused',
  )
  gated.close()
  await assert.rejects(
    deleteKernelStoreFile({ statePath, workspaceId: 'ownership-check' }),
    (error) => error?.code === 'legacy_terminal_storage_refused',
  )
  assert.equal(await pathExists(base.dbPath), true)
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

import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { test } from 'node:test'

import {
  applyResolvedDecisionInTransaction,
  initializeMemoryBundle,
} from '../src/memory-bundle-apply.mjs'
import {
  assertActiveMutationLease,
  createMutationCoordinator,
} from '../src/mutation-coordinator.mjs'
import { applyLegacyMutationEffectInTransaction } from '../src/legacy-mutation-router.mjs'
import { createKernelStore } from '../src/store.mjs'
import {
  M1_04_IDS,
  makeM104ApplyEnvelope,
} from './helpers/memory-bundle-fixtures.mjs'

const BUNDLE_CREATED_AT = '2026-07-18T11:58:00.000Z'
const BUNDLE_STREAM_UUID = M1_04_IDS.streamId.slice('str_'.length)
const FIXED_CDX_NOW = new Date('2026-07-18T12:00:00.000Z')

const CDX_ROW = Object.freeze({
  id: M1_04_IDS.memoryId,
  palari_id: 'palari-a',
  user_id: 'user-1',
  type: 'preference',
  content: 'Prefers tea.\nSays "no sugar".',
  keywords: 'no sugar tea',
  importance: 0.75,
  valid_from: '2026-07-18T11:59:00.000Z',
  valid_until: null,
  access_count: 0,
  last_accessed: null,
  created_at: '2026-07-18T12:00:00.000Z',
  shared: 0,
  confidence: 0.875,
  acquisition_mode: 'direct',
  created_by_pipeline: 0,
  fictional: 0,
  last_decayed_at: null,
  source_message_id: null,
  content_hash: '0000000000000000000000000000000000000000000000000000000000000000',
  source_kind: 'user_message',
  extractor: null,
})

const CDX_INSERT_EFFECT = Object.freeze({
  kind: 'cdx_memory_insert',
  row: CDX_ROW,
})

function readCompositionState(db) {
  const meta = db.prepare(`
    SELECT stream_id, head_sequence
    FROM main.memory_bundle_meta
    WHERE singleton = 1
  `).get()
  return {
    atomIds: db.prepare(`
      SELECT memory_id
      FROM main.memory_bundle_atoms
      ORDER BY memory_id COLLATE BINARY
    `).all().map((row) => row.memory_id),
    eventIds: db.prepare(`
      SELECT decision_id
      FROM main.memory_bundle_events
      ORDER BY sequence
    `).all().map((row) => row.decision_id),
    ftsMatchIds: db.prepare(`
      SELECT memory_id
      FROM main.memory_fts
      WHERE memory_fts MATCH 'tea'
      ORDER BY memory_id COLLATE BINARY
    `).all().map((row) => row.memory_id),
    ftsRows: db.prepare(`
      SELECT memory_id, content, keywords
      FROM main.memory_fts
      ORDER BY memory_id COLLATE BINARY
    `).all().map((row) => ({ ...row })),
    head: {
      sequence: meta.head_sequence,
      streamId: meta.stream_id,
    },
    memoryRows: db.prepare(`
      SELECT id, palari_id, user_id, type, content
      FROM main.memories
      ORDER BY id COLLATE BINARY
    `).all().map((row) => ({ ...row })),
  }
}

function expectedEmptyState() {
  return {
    atomIds: [],
    eventIds: [],
    ftsMatchIds: [],
    ftsRows: [],
    head: { sequence: 0, streamId: M1_04_IDS.streamId },
    memoryRows: [],
  }
}

function expectedAppliedState() {
  return {
    atomIds: [M1_04_IDS.memoryId],
    eventIds: [M1_04_IDS.decisionId],
    ftsMatchIds: [M1_04_IDS.memoryId],
    ftsRows: [{
      memory_id: M1_04_IDS.memoryId,
      content: CDX_ROW.content,
      keywords: 'no sugar tea',
    }],
    head: { sequence: 1, streamId: M1_04_IDS.streamId },
    memoryRows: [{
      id: M1_04_IDS.memoryId,
      palari_id: 'palari-a',
      user_id: 'user-1',
      type: 'preference',
      content: CDX_ROW.content,
    }],
  }
}

async function withCompositionFixture(prefix, callback) {
  const directory = mkdtempSync(join(tmpdir(), prefix))
  let db
  let observer
  let bootstrap
  try {
    bootstrap = await createKernelStore({
      clock: () => FIXED_CDX_NOW,
      memoryEnabled: true,
      statePath: join(directory, 'workspace-state.json'),
      workspaceId: 'm2-a1-composition',
    })
    const dbPath = bootstrap.dbPath
    assert.equal(bootstrap.close(), undefined)
    bootstrap = undefined

    db = new DatabaseSync(dbPath)
    assert.equal(initializeMemoryBundle(db, {
      clock: () => new Date(BUNDLE_CREATED_AT),
      idFactory: () => BUNDLE_STREAM_UUID,
    }), undefined)
    observer = new DatabaseSync(dbPath, { readOnly: true })
    observer.exec('PRAGMA busy_timeout = 0')
    assert.deepEqual(readCompositionState(db), expectedEmptyState())
    assert.deepEqual(readCompositionState(observer), expectedEmptyState())
    await callback({ db, observer })
  } finally {
    try {
      if (observer?.isOpen) observer.close()
    } finally {
      try {
        if (db?.isOpen) {
          try {
            if (db.isTransaction) db.exec('ROLLBACK')
          } finally {
            if (db.isOpen) db.close()
          }
        }
      } finally {
        try {
          if (bootstrap !== undefined) bootstrap.close()
        } finally {
          rmSync(directory, { recursive: true, force: true })
        }
      }
    }
  }
}

test('M2-A1-04 real B1 and CDX effects become visible together after commit', async () => {
  await withCompositionFixture(
    'palari-m2-a1-composition-commit-',
    ({ db, observer }) => {
      const coordinator = createMutationCoordinator(db)
      const expectedResult = { outcome: 'co-committed' }
      const result = coordinator.run((lease) => {
        assert.equal(assertActiveMutationLease(lease, db), undefined)
        assert.equal(
          applyResolvedDecisionInTransaction(
            db,
            makeM104ApplyEnvelope(),
          ),
          undefined,
        )
        assert.equal(
          applyLegacyMutationEffectInTransaction(
            lease,
            db,
            CDX_INSERT_EFFECT,
          ),
          undefined,
        )
        assert.deepEqual(readCompositionState(db), expectedAppliedState())
        assert.deepEqual(
          readCompositionState(observer),
          expectedEmptyState(),
          'the observer sees neither uncommitted mutation surface',
        )
        return expectedResult
      })

      assert.equal(result, expectedResult)
      assert.equal(db.isTransaction, false)
      const committed = readCompositionState(observer)
      assert.deepEqual(committed, expectedAppliedState())
      assert.deepEqual(readCompositionState(db), committed)
    },
  )
})

test('M2-A1-04 forced failure rolls back real B1 and CDX effects together', async () => {
  await withCompositionFixture(
    'palari-m2-a1-composition-rollback-',
    ({ db, observer }) => {
      const coordinator = createMutationCoordinator(db)
      const primary = new Error('forced composition rollback')

      assert.throws(() => coordinator.run((lease) => {
        assert.equal(assertActiveMutationLease(lease, db), undefined)
        assert.equal(
          applyResolvedDecisionInTransaction(
            db,
            makeM104ApplyEnvelope(),
          ),
          undefined,
        )
        assert.equal(
          applyLegacyMutationEffectInTransaction(
            lease,
            db,
            CDX_INSERT_EFFECT,
          ),
          undefined,
        )
        assert.deepEqual(readCompositionState(db), expectedAppliedState())
        assert.deepEqual(readCompositionState(observer), expectedEmptyState())
        throw primary
      }), (error) => error === primary)

      assert.equal(db.isTransaction, false)
      assert.deepEqual(readCompositionState(db), expectedEmptyState())
      assert.deepEqual(readCompositionState(observer), expectedEmptyState())
      assert.equal(coordinator.run(() => 'reusable'), 'reusable')
    },
  )
})

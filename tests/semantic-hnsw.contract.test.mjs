import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'

import {
  createSemanticHnsw,
  semanticVectorLocatorKey,
} from '../src/semantic-hnsw.mjs'
import {
  indexEvidenceVectors,
  semanticFindEvidenceBatch,
} from '../src/memory-semantic.mjs'

const SCOPE = Object.freeze({ palariId: 'hnsw-runtime', userId: 'user-a' })
const OTHER_SCOPE = Object.freeze({
  palariId: 'hnsw-runtime',
  userId: 'user-b',
})
const VISIBLE_SQL = `
  SELECT *
  FROM dialogue_evidence
  WHERE palari_id = ? AND user_id = ?
`

const SEMANTIC_VISIBLE_SQL = `
  SELECT *
  FROM dialogue_evidence
  WHERE palari_id = ? AND user_id = ?
`

function vector(axis) {
  const result = new Float32Array(512)
  result[axis] = 1
  return result
}

function blob(value) {
  return new Uint8Array(value.buffer.slice(0))
}

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'palari-semantic-hnsw-'))
  const dbPath = join(root, 'memory.sqlite')
  const db = new DatabaseSync(dbPath)
  t.after(async () => {
    db.close()
    await rm(root, { force: true, recursive: true })
  })
  db.exec(`
    CREATE TABLE dialogue_evidence (
      id TEXT PRIMARY KEY,
      palari_id TEXT NOT NULL,
      user_id TEXT NOT NULL
    );
    CREATE TABLE dialogue_evidence_vectors (
      evidence_id TEXT PRIMARY KEY,
      dims INTEGER NOT NULL,
      vector BLOB NOT NULL,
      locator_key TEXT
    );
    CREATE TABLE dialogue_evidence_vector_pending (
      evidence_id TEXT PRIMARY KEY,
      palari_id TEXT NOT NULL,
      user_id TEXT NOT NULL
    );
    CREATE TABLE dialogue_evidence_vector_scope_versions (
      palari_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      revision INTEGER NOT NULL,
      PRIMARY KEY (palari_id, user_id)
    );
    CREATE TABLE dialogue_evidence_hnsw_snapshots (
      palari_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      revision INTEGER NOT NULL,
      entries INTEGER NOT NULL,
      index_entries INTEGER NOT NULL,
      source_dims INTEGER NOT NULL,
      format TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_bytes INTEGER NOT NULL,
      file_sha256 TEXT NOT NULL,
      PRIMARY KEY (palari_id, user_id)
    );
  `)
  db.prepare(`
    INSERT INTO dialogue_evidence_vector_scope_versions
      (palari_id, user_id, revision)
    VALUES (?, ?, 0)
  `).run(SCOPE.palariId, SCOPE.userId)
  const evidence = db.prepare(`
    INSERT INTO dialogue_evidence (id, palari_id, user_id)
    VALUES (?, ?, ?)
  `)
  const vectors = db.prepare(`
    INSERT INTO dialogue_evidence_vectors
      (evidence_id, dims, vector, locator_key)
    VALUES (?, 512, ?, ?)
  `)
  for (const [id, axis] of [
    ['alpha', 0],
    ['alpha-copy', 0],
    ['beta', 1],
    ['gamma', 2],
  ]) {
    evidence.run(id, SCOPE.palariId, SCOPE.userId)
    vectors.run(
      id,
      blob(vector(axis)),
      semanticVectorLocatorKey(SCOPE, vector(axis)),
    )
  }
  return { db, dbPath, root }
}

function conceptEmbed(texts) {
  return Promise.resolve(texts.map((text) => {
    const normalized = String(text).toLowerCase()
    const axis = normalized.includes('moved')
      ? 3
      : normalized.includes('alpha')
        ? 0
        : normalized.includes('beta')
          ? 1
          : 2
    return [...vector(axis)]
  }))
}

async function semanticFixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'palari-semantic-runtime-'))
  const dbPath = join(root, 'memory.sqlite')
  const db = new DatabaseSync(dbPath)
  t.after(async () => {
    db.close()
    await rm(root, { force: true, recursive: true })
  })
  db.exec(`
    CREATE TABLE dialogue_evidence (
      id TEXT PRIMARY KEY,
      palari_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      event_at TEXT NOT NULL,
      dialogue_order INTEGER NOT NULL
    );
  `)
  const insert = db.prepare(`
    INSERT INTO dialogue_evidence (
      id,
      palari_id,
      user_id,
      content,
      event_at,
      dialogue_order
    ) VALUES (?, ?, ?, ?, ?, ?)
  `)
  for (const [order, [id, content]] of [
    ['alpha', 'The alpha memory.'],
    ['beta', 'The beta memory.'],
    ['beta-copy', 'The beta memory.'],
    ['gamma', 'The gamma memory.'],
  ].entries()) {
    insert.run(
      id,
      SCOPE.palariId,
      SCOPE.userId,
      content,
      `2026-08-11T00:00:0${order}.000Z`,
      order,
    )
  }
  assert.deepEqual(await indexEvidenceVectors(db, {
    batchSize: 10,
    embed: conceptEmbed,
    scope: SCOPE,
    visibleStatementsSql: SEMANTIC_VISIBLE_SQL,
  }), {
    complete: true,
    indexed: 4,
    operation: 'memory_semantic_index',
    status: 'ready',
  })
  return { db, dbPath }
}

test('runtime locator keys are deterministic and scope-bound', () => {
  assert.equal(
    semanticVectorLocatorKey(SCOPE, vector(0)),
    semanticVectorLocatorKey(SCOPE, vector(0)),
  )
  assert.notEqual(
    semanticVectorLocatorKey(SCOPE, vector(0)),
    semanticVectorLocatorKey(OTHER_SCOPE, vector(0)),
  )
})

test('runtime HNSW atomically persists and reloads a version-bound snapshot',
  async (t) => {
    const { db, dbPath, root } = await fixture(t)
    const first = createSemanticHnsw({ dbPath, minimumRows: 2 })
    const initial = await first.candidateKeys(db, {
      limit: 20,
      queryVectors: [vector(0)],
      scope: SCOPE,
      visibleStatementsSql: VISIBLE_SQL,
    })
    assert.ok(initial.candidateKeys[0].includes(
      semanticVectorLocatorKey(SCOPE, vector(0)),
    ))
    const metadata = db.prepare(`
      SELECT * FROM dialogue_evidence_hnsw_snapshots
    `).get()
    assert.equal(metadata.entries, 4)
    assert.equal(metadata.index_entries, 3)
    const path = join(`${dbPath}.semantic-hnsw`, metadata.file_name)
    assert.equal((await stat(`${dbPath}.semantic-hnsw`)).mode & 0o777, 0o700)
    assert.equal((await stat(path)).mode & 0o777, 0o600)
    assert.equal((await readFile(path)).length, metadata.file_bytes)

    first.close()
    const restored = createSemanticHnsw({ dbPath, minimumRows: 2 })
    const reloaded = await restored.candidateKeys(db, {
      limit: 20,
      queryVectors: [vector(0)],
      scope: SCOPE,
      visibleStatementsSql: VISIBLE_SQL,
    })
    assert.deepEqual(reloaded.candidateKeys, initial.candidateKeys)
    assert.equal(reloaded.revision, 0)
    restored.close()
    assert.ok(root)
  })

test('corrupt snapshots and unavailable native bindings fail to exact fallback',
  async (t) => {
    const { db, dbPath } = await fixture(t)
    const original = createSemanticHnsw({ dbPath, minimumRows: 2 })
    assert.ok(await original.candidateKeys(db, {
      limit: 20,
      queryVectors: [vector(0)],
      scope: SCOPE,
      visibleStatementsSql: VISIBLE_SQL,
    }))
    original.close()
    const metadata = db.prepare(`
      SELECT * FROM dialogue_evidence_hnsw_snapshots
    `).get()
    await writeFile(
      join(`${dbPath}.semantic-hnsw`, metadata.file_name),
      'corrupt',
    )

    const corrupt = createSemanticHnsw({ dbPath, minimumRows: 2 })
    assert.equal(await corrupt.candidateKeys(db, {
      limit: 20,
      queryVectors: [vector(0)],
      scope: SCOPE,
      visibleStatementsSql: VISIBLE_SQL,
    }), null)
    assert.equal(db.prepare(`
      SELECT 1 FROM dialogue_evidence_hnsw_snapshots
    `).get(), undefined)

    let importAttempts = 0
    const unavailable = createSemanticHnsw({
      dbPath,
      importUsearch: async () => {
        importAttempts += 1
        throw new Error('unsupported platform')
      },
      minimumRows: 2,
    })
    const request = {
      limit: 20,
      queryVectors: [vector(0)],
      scope: SCOPE,
      visibleStatementsSql: VISIBLE_SQL,
    }
    assert.equal(await unavailable.candidateKeys(db, request), null)
    assert.equal(await unavailable.candidateKeys(db, request), null)
    assert.equal(importAttempts, 1)
  })

test('small scopes take the exact path without loading a native module',
  async (t) => {
    const { db, dbPath } = await fixture(t)
    let importAttempts = 0
    const locator = createSemanticHnsw({
      dbPath,
      importUsearch: async () => {
        importAttempts += 1
        throw new Error('must remain lazy')
      },
      minimumRows: 5,
    })
    assert.equal(await locator.candidateKeys(db, {
      limit: 20,
      queryVectors: [vector(0)],
      scope: SCOPE,
      visibleStatementsSql: VISIBLE_SQL,
    }), null)
    assert.equal(importAttempts, 0)
  })

test('semantic runtime reranks scoped candidates and rebuilds after correction and delete',
  async (t) => {
    const { db, dbPath } = await semanticFixture(t)
    let locator = createSemanticHnsw({ dbPath, minimumRows: 2 })
    const search = async (phrase) => semanticFindEvidenceBatch(db, {
      embed: conceptEmbed,
      limit: 2,
      locator,
      phrases: [phrase],
      scope: SCOPE,
      visibleStatementsSql: SEMANTIC_VISIBLE_SQL,
    })

    assert.equal((await search('find alpha'))[0][0].id, 'alpha')
    const initial = db.prepare(`
      SELECT * FROM dialogue_evidence_hnsw_snapshots
    `).get()
    assert.equal(initial.revision, 0)

    locator.close()
    locator = createSemanticHnsw({ dbPath, minimumRows: 2 })
    assert.equal((await search('find alpha'))[0][0].id, 'alpha')
    assert.equal(db.prepare(`
      SELECT file_name FROM dialogue_evidence_hnsw_snapshots
    `).get().file_name, initial.file_name)

    db.prepare(`
      UPDATE dialogue_evidence
      SET content = 'The alpha memory moved.'
      WHERE id = 'alpha'
    `).run()
    assert.equal((await search('find moved'))[0][0].id, 'alpha')
    const corrected = db.prepare(`
      SELECT * FROM dialogue_evidence_hnsw_snapshots
    `).get()
    assert.equal(corrected.revision, 1)
    assert.notEqual(corrected.file_name, initial.file_name)

    db.prepare(`DELETE FROM dialogue_evidence WHERE id = 'alpha'`).run()
    assert.notEqual((await search('find moved'))[0][0].id, 'alpha')
    const deleted = db.prepare(`
      SELECT * FROM dialogue_evidence_hnsw_snapshots
    `).get()
    assert.equal(deleted.revision, 2)
    assert.notEqual(deleted.file_name, corrected.file_name)
    locator.close()
  })

test('semantic runtime keeps exact results when the optional accelerator is absent',
  async (t) => {
    const { db, dbPath } = await semanticFixture(t)
    const locator = createSemanticHnsw({
      dbPath,
      importUsearch: async () => {
        throw new Error('not installed')
      },
      minimumRows: 2,
    })
    const [rows] = await semanticFindEvidenceBatch(db, {
      embed: conceptEmbed,
      limit: 2,
      locator,
      phrases: ['find alpha'],
      scope: SCOPE,
      visibleStatementsSql: SEMANTIC_VISIBLE_SQL,
    })
    assert.equal(rows[0].id, 'alpha')
    assert.equal(db.prepare(`
      SELECT 1 FROM dialogue_evidence_hnsw_snapshots
    `).get(), undefined)
  })

test('a revision change after candidate planning rejects the stale shortlist',
  async (t) => {
    const { db } = await semanticFixture(t)
    let candidateCalls = 0
    const locator = {
      async candidateKeys() {
        candidateCalls += 1
        db.prepare(`
          UPDATE dialogue_evidence
          SET content = 'The gamma memory moved.'
          WHERE id = 'gamma'
        `).run()
        assert.equal((await indexEvidenceVectors(db, {
          batchSize: 10,
          embed: conceptEmbed,
          scope: SCOPE,
          visibleStatementsSql: SEMANTIC_VISIBLE_SQL,
        })).complete, true)
        return {
          candidateKeys: [[semanticVectorLocatorKey(SCOPE, vector(1))]],
          revision: 0,
          sourceDimensions: 512,
        }
      },
    }
    const [rows] = await semanticFindEvidenceBatch(db, {
      embed: conceptEmbed,
      limit: 2,
      locator,
      phrases: ['find alpha'],
      scope: SCOPE,
      visibleStatementsSql: SEMANTIC_VISIBLE_SQL,
    })
    assert.equal(candidateCalls, 1)
    assert.equal(rows[0].id, 'alpha')
    assert.equal(db.prepare(`
      SELECT revision
      FROM dialogue_evidence_vector_scope_versions
      WHERE palari_id = ? AND user_id = ?
    `).get(SCOPE.palariId, SCOPE.userId).revision, 1)
  })

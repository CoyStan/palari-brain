import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import { createChunkedEmbedder } from '../src/embedder.mjs'
import { semanticFindEvidenceBatch } from '../src/memory-semantic.mjs'
const scope = { palariId: 'chunks', userId: 'alice' }
const visibleStatementsSql = 'SELECT * FROM dialogue_evidence WHERE palari_id = ? AND user_id = ?'
const embed = async texts => texts.map(text => text === 'K' ? [1, 0] : text === 'D' ? [0.8, 0.6] : [0, 1])
function fixture(t) {
  const db = new DatabaseSync(':memory:')
  t.after(() => db.close())
  db.exec(`CREATE TABLE dialogue_evidence (id TEXT PRIMARY KEY, palari_id TEXT, user_id TEXT,
    content TEXT, event_at TEXT, dialogue_order INTEGER)`)
  const insert = db.prepare('INSERT INTO dialogue_evidence VALUES (?, ?, ?, ?, ?, ?)')
  insert.run('long', 'chunks', 'alice', 'KXXXXXXXXX', '2025-01-01', 1)
  insert.run('distractor', 'chunks', 'alice', 'D', '2025-01-02', 2)
  insert.run('foreign', 'chunks', 'bob', 'K', '2024-01-01', 1)
  return db
}
async function search(db, adapter, extra = {}) {
  const [rows] = await semanticFindEvidenceBatch(db, {
    embed: adapter, scope, visibleStatementsSql, phrases: ['K'], limit: 1, ...extra,
  })
  return rows
}
test('opt-in max chunk retrieval recovers a diluted fact with canonical text', async t => {
  const db = fixture(t)
  const mean = createChunkedEmbedder({ embed, maxChunkChars: 1 })
  assert.equal((await search(db, mean))[0].id, 'distractor')
  const chunks = createChunkedEmbedder({ embed, maxChunkChars: 1, retrieval: 'max', embeddingId: 'fixture-v1' })
  const rows = await search(db, chunks)
  assert.equal(rows[0].id, 'long')
  assert.equal(rows[0].content, 'KXXXXXXXXX')
  assert.equal(rows[0].similarity, 1)
  assert.equal(rows.length, 1)
})
test('chunk vectors follow correction, deletion, scope and date eligibility', async t => {
  const db = fixture(t)
  const chunks = createChunkedEmbedder({ embed, maxChunkChars: 1, retrieval: 'max' })
  assert.equal((await search(db, chunks))[0].id, 'long')
  assert.equal((await search(db, chunks, { after: '2025-01-02' }))[0].id, 'distractor')
  db.prepare("UPDATE dialogue_evidence SET content = 'XXXXXXXXXX' WHERE id = 'long'").run()
  assert.equal((await search(db, chunks))[0].id, 'distractor')
  db.prepare("DELETE FROM dialogue_evidence WHERE id = 'distractor'").run()
  const rows = await search(db, chunks)
  assert.equal(rows[0].id, 'long')
  assert.equal(rows[0].similarity, 0)
  assert.equal(db.prepare("SELECT count(*) AS n FROM dialogue_evidence_chunk_vectors WHERE evidence_id = 'distractor'").get().n, 0)
})

test('chunk settings remain part of identity when a host ID is supplied', async t => {
  const db = fixture(t)
  const first = createChunkedEmbedder({ embed, maxChunkChars: 1, retrieval: 'max' })
  assert.equal((await search(db, first, { embeddingId: 'host-v1' }))[0].id, 'long')
  const second = createChunkedEmbedder({ embed, maxChunkChars: 2, retrieval: 'max' })
  assert.equal((await search(db, second, { embeddingId: 'host-v1' }))[0].id, 'distractor')
})
test('a recreated chunk adapter reuses persisted derived vectors', async t => {
  const db = fixture(t)
  await search(db, createChunkedEmbedder({ embed, maxChunkChars: 1, retrieval: 'max' }))
  const recreated = createChunkedEmbedder({ maxChunkChars: 1, retrieval: 'max',
    embed: async texts => { assert.deepEqual(texts, ['K']); return [[1, 0]] } })
  assert.equal((await search(db, recreated))[0].id, 'long')
})

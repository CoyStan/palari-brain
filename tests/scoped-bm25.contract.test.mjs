import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import { searchDialogueEvidenceRanked } from '../src/memory-search.mjs'
const scope = { palariId: 'math', userId: 'alice' }
function fixture(t) {
  const db = new DatabaseSync(':memory:')
  t.after(() => db.close())
  db.exec('CREATE TABLE dialogue_evidence (id TEXT PRIMARY KEY, content TEXT, palari_id TEXT, user_id TEXT, event_at TEXT, dialogue_order INTEGER)')
  const insert = db.prepare('INSERT INTO dialogue_evidence VALUES (?, ?, ?, ?, ?, ?)')
  insert.run('a', 'alpha', 'math', 'alice', '2025', 1)
  insert.run('b', 'beta', 'math', 'alice', '2025', 2)
  return { db, insert }
}
function search(db, visibleStatementsSql = 'SELECT * FROM dialogue_evidence WHERE palari_id = ? AND user_id = ?') {
  return searchDialogueEvidenceRanked(db, { phrase: 'alpha beta', limit: 2, scope, visibleStatementsSql }).rows
    .map(row => ({ id: row.id, score: row.search_rank }))
}
test('foreign documents cannot change visible BM25 scores or ordering', t => {
  const { db, insert } = fixture(t)
  const before = search(db)
  for (let i = 0; i < 100; i++) insert.run(`foreign:${i}`, 'alpha', 'math', 'bob', '2025', i + 3)
  assert.deepEqual(search(db), before)
  db.prepare("UPDATE dialogue_evidence SET content = 'beta beta beta' WHERE user_id = 'bob'").run()
  assert.deepEqual(search(db), before)
})
test('invisible same-scope rows do not contribute to BM25 statistics', t => {
  const { db, insert } = fixture(t)
  const visible = "SELECT * FROM dialogue_evidence WHERE palari_id = ? AND user_id = ? AND id IN ('a', 'b')"
  const before = search(db, visible)
  for (let i = 0; i < 100; i++) insert.run(`hidden:${i}`, 'alpha', 'math', 'alice', '2025', i + 3)
  assert.deepEqual(search(db, visible), before)
})
test('scoped scoring agrees with isolated SQLite BM25 and follows corrections/deletion', t => {
  const { db } = fixture(t)
  db.exec("CREATE VIRTUAL TABLE reference USING fts5(content, tokenize='porter unicode61 remove_diacritics 2'); INSERT INTO reference VALUES ('alpha'), ('beta')")
  const expected = db.prepare("SELECT bm25(reference) AS score FROM reference WHERE reference MATCH '\"alpha\" OR \"beta\"'").all().map(row => row.score)
  assert.deepEqual(search(db).map(row => row.score), expected)
  db.prepare("UPDATE dialogue_evidence SET content = 'gamma' WHERE id = 'a'").run()
  assert.deepEqual(search(db).map(row => row.id), ['b'])
  db.prepare("DELETE FROM dialogue_evidence WHERE id = 'b'").run()
  assert.deepEqual(search(db), [])
})
test('temporary scoring cleans up after errors and preserves caller transactions', t => {
  const { db, insert } = fixture(t)
  db.exec('BEGIN')
  insert.run('c', 'alpha', 'math', 'alice', '2025', 3)
  assert.throws(() => search(db, 'SELECT * FROM missing_table WHERE palari_id = ? AND user_id = ?'), /missing_table/)
  assert.equal(db.prepare("SELECT count(*) AS n FROM sqlite_temp_master WHERE name LIKE 'palari_scoped_dialogue_fts%'").get().n, 0)
  assert.equal(db.prepare("SELECT count(*) AS n FROM dialogue_evidence WHERE id = 'c'").get().n, 1)
  assert.equal(search(db).length, 2)
  db.exec('ROLLBACK')
  assert.equal(db.prepare("SELECT count(*) AS n FROM dialogue_evidence WHERE id = 'c'").get().n, 0)
})

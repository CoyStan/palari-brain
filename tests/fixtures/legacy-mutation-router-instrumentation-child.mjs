import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { createRequire, syncBuiltinESMExports } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync, StatementSync } from 'node:sqlite'

const mode = process.argv[2]
const nativeString = String
let stringCalls = 0
const trace = []
const statementSql = new WeakMap()
const originalPrepare = DatabaseSync.prototype.prepare
const originalGet = StatementSync.prototype.get
const originalAll = StatementSync.prototype.all
const originalRun = StatementSync.prototype.run

if (mode === 'phases' || mode === 'cardinality' || mode === 'visibility') {
  DatabaseSync.prototype.prepare = function instrumentedPrepare(sql) {
    const statement = Reflect.apply(originalPrepare, this, [sql])
    statementSql.set(statement, sql)
    trace.push({ operation: 'prepare', sql })
    return statement
  }
  StatementSync.prototype.get = function instrumentedGet(...params) {
    trace.push({ operation: 'get', params, sql: statementSql.get(this) })
    return Reflect.apply(originalGet, this, params)
  }
  StatementSync.prototype.all = function instrumentedAll(...params) {
    trace.push({ operation: 'all', params, sql: statementSql.get(this) })
    return Reflect.apply(originalAll, this, params)
  }
  StatementSync.prototype.run = function instrumentedRun(...params) {
    const sql = statementSql.get(this)
    trace.push({ operation: 'run', params, sql })
    const result = Reflect.apply(originalRun, this, params)
    if (
      mode === 'visibility' &&
      /^(?:\s*INSERT INTO main\.(?:memories|memory_links)|\s*UPDATE main\.memories)\b/.test(sql) &&
      globalThis.visibilityObserver
    ) {
      const observer = globalThis.visibilityObserver
      let competingWrite
      try {
        observer.prepare('UPDATE memories SET importance=0.1 WHERE id=?')
          .run('visibility-old')
        competingWrite = 'landed'
      } catch (error) {
        competingWrite = error.code
      }
      globalThis.visibilityObservations.push({
        competingWrite,
        linkCount: observer.prepare(
          'SELECT COUNT(*) count FROM memory_links WHERE id=?',
        ).get('link_visibility-new_visibility-old_supersedes').count,
        newCount: observer.prepare(
          'SELECT COUNT(*) count FROM memories WHERE id=?',
        ).get('visibility-new').count,
        oldValidUntil: observer.prepare(
          'SELECT valid_until FROM memories WHERE id=?',
        ).get('visibility-old').valid_until,
      })
    }
    if (
      mode === 'cardinality' &&
      ((globalThis.cardinalityTarget === 'memory' && /^\s*INSERT INTO main\.memories\b/.test(sql)) ||
       (globalThis.cardinalityTarget === 'link' && /^\s*INSERT INTO main\.memory_links\b/.test(sql)))
    ) {
      return { ...result, changes: globalThis.cardinalityChanges }
    }
    return result
  }
}

if (mode === 'keywords') {
  function InstrumentedString(value) {
    stringCalls += 1
    return nativeString(value)
  }
  InstrumentedString.prototype = nativeString.prototype
  globalThis.String = InstrumentedString
}

const {
  createLegacyMutationRouter,
} = await import('../../src/legacy-mutation-router.mjs')
const {
  createMutationCoordinator,
} = await import('../../src/mutation-coordinator.mjs')

if (mode === 'phases' || mode === 'cardinality' || mode === 'visibility') {
  DatabaseSync.prototype.prepare = originalPrepare
  StatementSync.prototype.get = originalGet
  StatementSync.prototype.all = originalAll
  StatementSync.prototype.run = originalRun
}

function createDatabase(path = ':memory:') {
  const db = new DatabaseSync(path)
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE main.memories (
      id TEXT PRIMARY KEY,
      palari_id TEXT NOT NULL,
      user_id TEXT,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      keywords TEXT NOT NULL DEFAULT '',
      importance REAL NOT NULL DEFAULT 0.5,
      valid_from TEXT NOT NULL,
      valid_until TEXT,
      access_count INTEGER NOT NULL DEFAULT 0,
      last_accessed TEXT,
      created_at TEXT NOT NULL,
      shared INTEGER NOT NULL DEFAULT 0,
      confidence REAL NOT NULL DEFAULT 0.5,
      acquisition_mode TEXT NOT NULL DEFAULT 'direct',
      created_by_pipeline INTEGER NOT NULL DEFAULT 0,
      fictional INTEGER NOT NULL DEFAULT 0,
      last_decayed_at TEXT,
      source_message_id TEXT,
      content_hash TEXT NOT NULL,
      source_kind TEXT,
      extractor TEXT
    );
    CREATE TABLE main.memory_links (
      id TEXT PRIMARY KEY,
      from_memory_id TEXT NOT NULL,
      to_memory_id TEXT NOT NULL,
      relation TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (from_memory_id) REFERENCES memories(id) ON DELETE CASCADE,
      FOREIGN KEY (to_memory_id) REFERENCES memories(id) ON DELETE CASCADE
    );
    CREATE VIRTUAL TABLE main.memory_fts USING fts5(
      memory_id UNINDEXED,
      palari_id UNINDEXED,
      content,
      keywords
    );
    CREATE TRIGGER main.memories_ai AFTER INSERT ON memories BEGIN
      INSERT INTO memory_fts(rowid,memory_id,palari_id,content,keywords)
      VALUES(new.rowid,new.id,new.palari_id,new.content,new.keywords);
    END;
    CREATE TRIGGER main.memories_ad AFTER DELETE ON memories BEGIN
      DELETE FROM memory_fts WHERE rowid = old.rowid;
    END;
  `)
  return db
}

const policy = {
  demote: 0,
  promote: 0.25,
  permanent: 0.6,
  ratify: 0.75,
}

function envelope(keywords, id = 'fixed-id') {
  return {
    intentKind: 'legacy_proposal',
    op: 'add',
    policy,
    producer: 'explicit_proposal',
    proposalKind: 'permanent',
    provenance: {
      actor: null,
      eventAt: '2026-01-14T00:00:00.000Z',
      extractor: 'extractor-a',
      sourceKind: 'source_document',
      sourceMessageId: 'msg-a',
      writer: 'background_extraction',
    },
    record: {
      id,
      palari_id: 'palari-a',
      user_id: 'user-a',
      type: 'preference',
      content: 'User prefers tea',
      keywords,
      importance: 0.6,
      valid_from: null,
      valid_until: null,
      last_accessed: null,
      created_at: null,
      shared: false,
      confidence: 0.9,
      acquisition_mode: null,
      fictional: false,
      last_decayed_at: null,
      source_message_id: null,
      content_hash: null,
    },
    scope: { palariId: null, userId: null },
    target: null,
  }
}

const visibilityDirectory = mode === 'visibility'
  ? mkdtempSync(join(tmpdir(), 'palari-router-visibility-'))
  : null
const db = createDatabase(
  visibilityDirectory === null
    ? ':memory:'
    : join(visibilityDirectory, 'memory.sqlite'),
)
let visibilityObserver = null
try {
  let clockCalls = 0
  const router = createLegacyMutationRouter(db, {
    clock: () => {
      clockCalls += 1
      return '2026-01-15T00:00:00.000Z'
    },
  })
  if (mode === 'keywords') {
    stringCalls = 0
    router.capture(envelope(['x'], 'first'))
    const oneKeywordCalls = stringCalls
    stringCalls = 0
    const captured = router.capture(envelope([0, false, 'x'], 'second'))
    assert.equal(stringCalls, oneKeywordCalls)
    assert.equal(captured.record.keywords, 'x source:source_document')
  } else if (mode === 'crypto') {
    const require = createRequire(import.meta.url)
    const crypto = require('node:crypto')
    const savedCreateHash = crypto.createHash
    crypto.randomUUID = () => 'tampered-id'
    crypto.createHash = () => {
      throw new Error('live createHash dispatch')
    }
    syncBuiltinESMExports()
    const result = router.execute(envelope(['tea'], null))
    assert.match(result.memory.id, /^mem_[0-9a-f-]{36}$/)
    assert.notEqual(result.memory.id, 'mem_tampered-id')
    const expected = savedCreateHash('sha256')
      .update([
        'palari-a',
        'user-a',
        'preference',
        'User prefers tea',
        'tea source:source_document',
      ].join('\u001f'))
      .digest('hex')
    assert.equal(result.memory.content_hash, expected)
  } else if (mode === 'phases') {
    const coordinator = createMutationCoordinator(db)
    trace.length = 0
    const captured = router.capture(envelope(['tea'], 'phase-id'))
    assert.equal(clockCalls, 1)
    assert.deepEqual(trace, [], 'capture performed SQLite work')

    const savedPrepare = DatabaseSync.prototype.prepare
    const savedGet = StatementSync.prototype.get
    const savedAll = StatementSync.prototype.all
    const savedRun = StatementSync.prototype.run
    DatabaseSync.prototype.prepare = () => { throw new Error('live prepare') }
    StatementSync.prototype.get = () => { throw new Error('live get') }
    StatementSync.prototype.all = () => { throw new Error('live all') }
    StatementSync.prototype.run = () => { throw new Error('live run') }
    try {
      coordinator.run((lease) => {
        trace.length = 0
        const plan = router.resolve(lease, captured)
        assert.ok(trace.length > 0)
        assert.equal(trace.some(({ operation }) => operation === 'run'), false)
        assert.equal(trace.every(({ sql }) => /^\s*SELECT\b/i.test(sql)), true)
        assert.equal(clockCalls, 1)

        trace.length = 0
        router.apply(lease, plan)
        assert.ok(trace.length > 0)
        assert.equal(
          trace.some(({ operation }) => operation === 'get' || operation === 'all'),
          false,
        )
        assert.equal(
          trace.filter(({ operation }) => operation === 'run').length,
          1,
        )
        assert.equal(
          trace.every(({ sql }) => /^\s*INSERT INTO main\.memories\b/i.test(sql)),
          true,
        )
        assert.equal(clockCalls, 1)
      })
    } finally {
      DatabaseSync.prototype.prepare = savedPrepare
      StatementSync.prototype.get = savedGet
      StatementSync.prototype.all = savedAll
      StatementSync.prototype.run = savedRun
    }
    assert.equal(
      db.prepare('SELECT COUNT(*) count FROM memories WHERE id=?').get('phase-id').count,
      1,
    )
  } else if (mode === 'cardinality') {
    globalThis.cardinalityTarget = 'memory'
    for (const [index, changes] of [0, 2, '1', null, undefined].entries()) {
      globalThis.cardinalityChanges = changes
      const id = `cardinality-memory-${index}`
      assert.throws(() => router.execute(envelope(['tea'], id)), {
        code: 'legacy_effect_cardinality',
      })
      assert.equal(
        db.prepare('SELECT COUNT(*) count FROM memories WHERE id=?').get(id).count,
        0,
      )
      assert.equal(
        db.prepare('SELECT COUNT(*) count FROM memory_fts WHERE memory_id=?')
          .get(id).count,
        0,
      )
    }

    db.prepare(`INSERT INTO memories (
      id,palari_id,user_id,type,content,keywords,importance,valid_from,
      valid_until,access_count,last_accessed,created_at,shared,confidence,
      acquisition_mode,created_by_pipeline,fictional,last_decayed_at,
      source_message_id,content_hash,source_kind,extractor
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      'cardinality-old', 'palari-a', 'user-a', 'preference',
      'old cardinality content', 'old', 0.5, '2025-01-01T00:00:00.000Z',
      null, 0, null, '2025-01-01T00:00:00.000Z', 0, 0.8, 'direct', 0,
      0, null, null, 'old-hash', 'user_message', null,
    )
    globalThis.cardinalityTarget = 'link'
    globalThis.cardinalityChanges = 0
    const supersede = envelope(['new'], 'cardinality-new')
    supersede.op = 'supersede'
    supersede.target = 'cardinality-old'
    supersede.record.content = 'new cardinality content'
    assert.throws(() => router.execute(supersede), {
      code: 'legacy_effect_cardinality',
    })
    assert.equal(
      db.prepare('SELECT valid_until FROM memories WHERE id=?')
        .get('cardinality-old').valid_until,
      null,
    )
    assert.equal(
      db.prepare('SELECT COUNT(*) count FROM memories WHERE id=?')
        .get('cardinality-new').count,
      0,
    )
    assert.equal(
      db.prepare('SELECT COUNT(*) count FROM memory_fts WHERE memory_id=?')
        .get('cardinality-new').count,
      0,
    )
    assert.equal(db.prepare('SELECT COUNT(*) count FROM memory_links').get().count, 0)
  } else if (mode === 'visibility') {
    visibilityObserver = new DatabaseSync(join(visibilityDirectory, 'memory.sqlite'))
    visibilityObserver.exec('PRAGMA busy_timeout = 0')
    globalThis.visibilityObserver = visibilityObserver
    globalThis.visibilityObservations = []
    db.prepare(`INSERT INTO memories (
      id,palari_id,user_id,type,content,keywords,importance,valid_from,
      valid_until,access_count,last_accessed,created_at,shared,confidence,
      acquisition_mode,created_by_pipeline,fictional,last_decayed_at,
      source_message_id,content_hash,source_kind,extractor
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      'visibility-old', 'palari-a', 'user-a', 'preference',
      'old visibility content', 'old', 0.5, '2025-01-01T00:00:00.000Z',
      null, 0, null, '2025-01-01T00:00:00.000Z', 0, 0.8, 'direct', 0,
      0, null, null, 'old-hash', 'user_message', null,
    )
    const supersede = envelope(['new'], 'visibility-new')
    supersede.op = 'supersede'
    supersede.target = 'visibility-old'
    supersede.record.content = 'new visibility content'
    const result = router.execute(supersede)
    assert.equal(result.outcome, 'superseded')
    assert.equal(globalThis.visibilityObservations.length, 3)
    for (const observation of globalThis.visibilityObservations) {
      assert.deepEqual(observation, {
        competingWrite: 'ERR_SQLITE_ERROR',
        linkCount: 0,
        newCount: 0,
        oldValidUntil: null,
      })
    }
    assert.equal(
      visibilityObserver.prepare('SELECT valid_until FROM memories WHERE id=?')
        .get('visibility-old').valid_until,
      '2026-01-15T00:00:00.000Z',
    )
    assert.equal(
      visibilityObserver.prepare('SELECT COUNT(*) count FROM memories WHERE id=?')
        .get('visibility-new').count,
      1,
    )
    assert.equal(
      visibilityObserver.prepare('SELECT COUNT(*) count FROM memory_links WHERE id=?')
        .get('link_visibility-new_visibility-old_supersedes').count,
      1,
    )
  } else {
    throw new Error(`Unknown instrumentation mode: ${mode}`)
  }
} finally {
  if (visibilityObserver?.isOpen) visibilityObserver.close()
  db.close()
  if (visibilityDirectory !== null) {
    rmSync(visibilityDirectory, { recursive: true, force: true })
  }
}

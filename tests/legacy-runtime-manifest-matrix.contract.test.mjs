// V2-M2-A2 Task 4 — independent runtime-manifest and read-shape matrix.
//
// Every mutation in this file is made through a test-owned SQLite connection
// while no supported runtime handle is live. Runtime acceptance/refusal is
// observed only through the public store API; no native production handle is
// exposed or borrowed.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { after, test } from 'node:test'

import {
  createKernelStore,
  deleteKernelStoreFile,
  workspaceMemoryDbPath,
} from '../src/store.mjs'
import { bootstrapCdxB2InTransaction } from '../src/cdx-b2-journal.mjs'
import { createMutationCoordinator } from '../src/mutation-coordinator.mjs'

const temporaryDirectories = []

async function temporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), 'brain-a2-manifest-'))
  temporaryDirectories.push(directory)
  return directory
}

after(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(
    directory,
    { force: true, recursive: true },
  )))
})

const FIXED_NOW = new Date('2026-07-21T12:00:00.000Z')
const ROW_TIME = '2026-07-20T12:00:00.000Z'

const CANONICAL_MEMORY_KEYS = [
  'id',
  'palari_id',
  'user_id',
  'type',
  'content',
  'keywords',
  'importance',
  'valid_from',
  'valid_until',
  'access_count',
  'last_accessed',
  'created_at',
  'shared',
  'confidence',
  'acquisition_mode',
  'created_by_pipeline',
  'fictional',
  'last_decayed_at',
  'source_message_id',
  'content_hash',
  'source_kind',
  'extractor',
]

const SEARCH_MEMORY_KEYS = [
  'id',
  'palari_id',
  'user_id',
  'type',
  'content',
  'keywords',
  'importance',
  'valid_from',
  'valid_until',
  'access_count',
  'last_accessed',
  'created_at',
  'shared',
  'confidence',
  'acquisition_mode',
  'created_by_pipeline',
  'fictional',
  'source_message_id',
  'content_hash',
  'rank',
]

const RECALL_MEMORY_KEYS = [
  ...CANONICAL_MEMORY_KEYS,
  'rank',
  'rpath',
  'via_memory_id',
  'via_relation',
  'activationScore',
]

const MEMORY_INSERT_SQL = `
  INSERT INTO memories(
    id, palari_id, user_id, type, content, keywords, importance,
    valid_from, valid_until, access_count, last_accessed, created_at,
    shared, confidence, acquisition_mode, created_by_pipeline, fictional,
    last_decayed_at, source_message_id, content_hash, source_kind, extractor
  ) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
  )
`

function optionsFor(directory, workspaceId) {
  return {
    clock: () => FIXED_NOW,
    memoryEnabled: true,
    memoryRootDir: directory,
    workspaceId,
  }
}

function seedValidMemory(db, id = 'mem_manifest_matrix') {
  db.prepare(MEMORY_INSERT_SQL).run(
    id,
    'palari-matrix',
    'user-matrix',
    'working',
    `Runtime manifest matrix content ${id}`,
    'runtime,manifest,matrix',
    0.7,
    ROW_TIME,
    null,
    2,
    ROW_TIME,
    ROW_TIME,
    0,
    0.8,
    'direct',
    0,
    0,
    null,
    'source-message-matrix',
    `hash-${id}`,
    'user_message',
    null,
  )
}

function seedValidLink(
  db,
  id = 'link_manifest_matrix',
  fromId = 'mem_manifest_matrix',
  toId = 'mem_manifest_matrix_2',
) {
  db.prepare(`
    INSERT INTO memory_links(
      id, from_memory_id, to_memory_id, relation, created_at
    ) VALUES (?, ?, ?, ?, ?)
  `).run(id, fromId, toId, 'associated', ROW_TIME)
}

function withIndependentDatabase(dbPath, callback) {
  const db = new DatabaseSync(dbPath)
  try {
    return callback(db)
  } finally {
    db.close()
  }
}

function assertSchemaInvalid(error) {
  return error?.code === 'legacy_schema_invalid'
}

function rewriteStoredSql(db, name, before, after) {
  db.exec('PRAGMA writable_schema = ON')
  const result = db.prepare(`
    UPDATE sqlite_schema
    SET sql = replace(sql, ?, ?)
    WHERE name = ?
  `).run(before, after, name)
  assert.equal(result.changes, 1)
  const version = db.prepare('PRAGMA schema_version').get().schema_version
  db.exec(`PRAGMA schema_version = ${version + 1}`)
  db.exec('PRAGMA writable_schema = OFF')
}

async function expectManifestRejection(
  directory,
  workspaceId,
  mutate,
  predicate = assertSchemaInvalid,
) {
  const options = optionsFor(directory, workspaceId)
  const initial = await createKernelStore(options)
  const dbPath = initial.dbPath
  initial.close()
  withIndependentDatabase(dbPath, mutate)

  let escaped
  try {
    escaped = await createKernelStore(options)
    assert.fail(`manifest mutation ${workspaceId} unexpectedly opened`)
  } catch (error) {
    assert.equal(
      predicate(error),
      true,
      `${workspaceId} rejected with ${error?.code ?? error?.message}`,
    )
  } finally {
    if (escaped !== undefined) escaped.close()
  }
  const removed = await deleteKernelStoreFile(options)
  assert.equal(removed.removed, true)
}

async function expectManifestAcceptance(directory, workspaceId, mutate) {
  const options = optionsFor(directory, workspaceId)
  const initial = await createKernelStore(options)
  const dbPath = initial.dbPath
  initial.close()
  withIndependentDatabase(dbPath, mutate)
  const reopened = await createKernelStore(options)
  assert.equal(reopened.status().status, 'enabled')
  reopened.close()
  await deleteKernelStoreFile(options)
}

function seedHistoricalSchema(
  dbPath,
  history,
  { schemaTransform = (sql) => sql, withRow = false } = {},
) {
  const db = new DatabaseSync(dbPath)
  const prefix = `CREATE TABLE memories (
      id TEXT PRIMARY KEY,
      palari_id TEXT NOT NULL,
      user_id TEXT,
      type TEXT NOT NULL CHECK (type IN (
        'relationship',
        'preference',
        'opinion',
        'entity',
        'life_event',
        'working',
        'project',
        'recent_life',
        'session_summary'
      )),
      content TEXT NOT NULL,
      keywords TEXT NOT NULL DEFAULT '',
      importance REAL NOT NULL DEFAULT 0.5,
      valid_from TEXT NOT NULL,
      valid_until TEXT,
      access_count INTEGER NOT NULL DEFAULT 0,
      last_accessed TEXT,
      created_at TEXT NOT NULL,
      shared INTEGER NOT NULL DEFAULT 0 CHECK (shared IN (0, 1)),
      confidence REAL NOT NULL DEFAULT 0.5,
      acquisition_mode TEXT NOT NULL DEFAULT 'direct' CHECK (acquisition_mode IN (
        'direct',
        'told_to_me',
        'extracted',
        'summarized'
      )),
      created_by_pipeline INTEGER NOT NULL DEFAULT 0 CHECK (created_by_pipeline IN (0, 1)),`
  const tails = {
    current: `      fictional INTEGER NOT NULL DEFAULT 0 CHECK (fictional IN (0, 1)),
      last_decayed_at TEXT,
      source_message_id TEXT,
      content_hash TEXT NOT NULL
    )`,
    fourth_order: `      last_decayed_at TEXT,
      fictional INTEGER NOT NULL DEFAULT 0 CHECK (fictional IN (0, 1)),
      source_message_id TEXT,
      content_hash TEXT NOT NULL
    )`,
    post_fictional: `      fictional INTEGER NOT NULL DEFAULT 0 CHECK (fictional IN (0, 1)),
      source_message_id TEXT,
      content_hash TEXT NOT NULL
    )`,
    pre_fictional: `      source_message_id TEXT,
      content_hash TEXT NOT NULL
    )`,
  }
  if (!(history in tails)) throw new Error(`unknown history ${history}`)
  const schemaSql = `
    CREATE TABLE memory_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
    ${prefix}
${tails[history]};
    CREATE INDEX memories_scope_idx
      ON memories (palari_id, user_id, shared, valid_until, type);
    CREATE INDEX memories_content_hash_idx
      ON memories (palari_id, content_hash);
    CREATE TABLE memory_links (
      id TEXT PRIMARY KEY,
      from_memory_id TEXT NOT NULL,
      to_memory_id TEXT NOT NULL,
      relation TEXT NOT NULL DEFAULT 'associated',
      created_at TEXT NOT NULL,
      FOREIGN KEY (from_memory_id) REFERENCES memories(id) ON DELETE CASCADE,
      FOREIGN KEY (to_memory_id) REFERENCES memories(id) ON DELETE CASCADE,
      CHECK (from_memory_id <> to_memory_id)
    );
    CREATE INDEX memory_links_from_idx ON memory_links (from_memory_id);
    CREATE INDEX memory_links_to_idx ON memory_links (to_memory_id);
    CREATE VIRTUAL TABLE memory_fts USING fts5(
      memory_id UNINDEXED,
      palari_id UNINDEXED,
      content,
      keywords,
      tokenize = 'unicode61 remove_diacritics 2'
    );
    CREATE TRIGGER memories_ai AFTER INSERT ON memories BEGIN
      INSERT INTO memory_fts(rowid, memory_id, palari_id, content, keywords)
      VALUES (new.rowid, new.id, new.palari_id, new.content, new.keywords);
    END;
    CREATE TRIGGER memories_ad AFTER DELETE ON memories BEGIN
      DELETE FROM memory_fts WHERE rowid = old.rowid;
    END;
    CREATE TRIGGER memories_au AFTER UPDATE OF content, keywords, palari_id ON memories BEGIN
      DELETE FROM memory_fts WHERE rowid = old.rowid;
      INSERT INTO memory_fts(rowid, memory_id, palari_id, content, keywords)
      VALUES (new.rowid, new.id, new.palari_id, new.content, new.keywords);
    END;
  `
  db.exec(schemaTransform(schemaSql))
  if (history === 'pre_fictional') {
    db.exec('ALTER TABLE memories ADD COLUMN fictional INTEGER NOT NULL DEFAULT 0 CHECK (fictional IN (0, 1))')
  }
  if (history === 'pre_fictional' || history === 'post_fictional') {
    db.exec('ALTER TABLE memories ADD COLUMN last_decayed_at TEXT')
  }
  db.exec('ALTER TABLE memories ADD COLUMN source_kind TEXT')
  db.exec('ALTER TABLE memories ADD COLUMN extractor TEXT')
  const migration = db.prepare(`
    INSERT INTO memory_migrations(id, applied_at) VALUES (?, ?)
  `)
  migration.run('CDX-M0', '2026-07-21T00:00:00.000Z')
  migration.run('CDX-M1', '2026-07-21T00:00:01.000Z')
  if (withRow) seedValidMemory(db)
  db.close()
}

function runInstrumentedManifestOpen(directory, workspaceId, mode) {
  const payload = {
    mode,
    options: optionsFor(directory, workspaceId),
    storeUrl: new URL('../src/store.mjs', import.meta.url).href,
  }
  const source = `
    import { registerHooks } from 'node:module'
    import {
      DatabaseSync as NativeDatabaseSync,
      StatementSync as NativeStatementSync,
    } from 'node:sqlite'

    const payload = ${JSON.stringify(payload)}
    const apply = Reflect.apply
    const construct = Reflect.construct
    const defineProperty = Object.defineProperty
    const getDescriptor = Object.getOwnPropertyDescriptor
    const nativeClose = NativeDatabaseSync.prototype.close
    const nativeExec = NativeDatabaseSync.prototype.exec
    const nativePrepare = NativeDatabaseSync.prototype.prepare
    const nativeAll = NativeStatementSync.prototype.all
    const nativeGet = NativeStatementSync.prototype.get
    const nativeRun = NativeStatementSync.prototype.run
    const nativeSetReadBigInts = NativeStatementSync.prototype.setReadBigInts
    const nativeSetReturnArrays = NativeStatementSync.prototype.setReturnArrays
    const probe = new NativeDatabaseSync(':memory:', { open: false })
    const nativeIsOpen = getDescriptor(probe, 'isOpen').get
    const nativeIsTransaction = getDescriptor(probe, 'isTransaction').get
    const databases = new WeakMap()
    const statements = new WeakMap()
    let operationalAssigned = false

    function normalized(sql) {
      return String(sql).trim().replace(/\\s+/g, ' ')
    }

    class InstrumentedDatabaseSync {
      constructor(...args) {
        const target = construct(NativeDatabaseSync, args)
        const wrapper = Object.create(InstrumentedDatabaseSync.prototype)
        const operational =
          args[0] !== ':memory:' && args[1]?.open !== false && !operationalAssigned
        if (operational) operationalAssigned = true
        databases.set(wrapper, { operational, target })
        defineProperty(wrapper, 'isOpen', {
          configurable: true,
          enumerable: true,
          get() {
            return apply(nativeIsOpen, databases.get(this).target, [])
          },
        })
        defineProperty(wrapper, 'isTransaction', {
          configurable: true,
          enumerable: true,
          get() {
            return apply(nativeIsTransaction, databases.get(this).target, [])
          },
        })
        if (operational && payload.mode === 'temp-trigger') {
          apply(nativeExec, target, [
            'CREATE TEMP TRIGGER rogue_temp_manifest_trigger ' +
            'AFTER INSERT ON memories BEGIN SELECT 1; END',
          ])
        }
        if (operational && payload.mode === 'b2-fk-temp-shadow') {
          apply(nativeExec, target, [
            'CREATE TEMP TABLE b2_fk_intruder(stream_id TEXT)',
          ])
        }
        return wrapper
      }
    }

    class InstrumentedStatementSync {}

    InstrumentedDatabaseSync.prototype.close = function close() {
      return apply(nativeClose, databases.get(this).target, [])
    }
    InstrumentedDatabaseSync.prototype.exec = function exec(sql) {
      return apply(nativeExec, databases.get(this).target, [sql])
    }
    InstrumentedDatabaseSync.prototype.prepare = function prepare(sql) {
      const database = databases.get(this)
      const target = apply(nativePrepare, database.target, [sql])
      const wrapper = Object.create(InstrumentedStatementSync.prototype)
      statements.set(wrapper, {
        operational: database.operational,
        sql: normalized(sql),
        target,
      })
      return wrapper
    }

    InstrumentedStatementSync.prototype.setReadBigInts = function setReadBigInts(value) {
      return apply(nativeSetReadBigInts, statements.get(this).target, [value])
    }
    InstrumentedStatementSync.prototype.setReturnArrays = function setReturnArrays(value) {
      return apply(nativeSetReturnArrays, statements.get(this).target, [value])
    }
    InstrumentedStatementSync.prototype.all = function all(...args) {
      const record = statements.get(this)
      if (
        record.operational && payload.mode === 'quick-check' &&
        record.sql === 'PRAGMA main.quick_check'
      ) return [{ quick_check: 'injected-not-ok' }]
      return apply(nativeAll, record.target, args)
    }
    InstrumentedStatementSync.prototype.get = function get(...args) {
      const record = statements.get(this)
      const pragma = {
        'pragma-busy-timeout': ['PRAGMA busy_timeout', 'timeout', 1],
        'pragma-foreign-keys': ['PRAGMA foreign_keys', 'foreign_keys', 0],
        'pragma-ignore-checks': [
          'PRAGMA ignore_check_constraints',
          'ignore_check_constraints',
          1,
        ],
        'pragma-recursive-triggers': [
          'PRAGMA recursive_triggers',
          'recursive_triggers',
          0,
        ],
        'pragma-trusted-schema': ['PRAGMA trusted_schema', 'trusted_schema', 1],
      }[payload.mode]
      if (record.operational && pragma !== undefined && record.sql === pragma[0]) {
        return { [pragma[1]]: pragma[2] }
      }
      return apply(nativeGet, record.target, args)
    }
    InstrumentedStatementSync.prototype.run = function run(...args) {
      const record = statements.get(this)
      if (
        record.operational && payload.mode === 'fts-integrity-command' &&
        record.sql === "INSERT INTO memory_fts(memory_fts) VALUES ('integrity-check')"
      ) {
        const error = new Error('injected FTS integrity command failure')
        error.code = 'ERR_MATRIX_FTS_INTEGRITY'
        throw error
      }
      return apply(nativeRun, record.target, args)
    }

    globalThis.__matrixSqlite = Object.freeze({
      DatabaseSync: InstrumentedDatabaseSync,
      StatementSync: InstrumentedStatementSync,
    })
    const sqliteUrl = 'palari-a2-manifest-matrix:sqlite'
    registerHooks({
      resolve(specifier, context, nextResolve) {
        if (specifier === 'node:sqlite') {
          return { shortCircuit: true, url: sqliteUrl }
        }
        return nextResolve(specifier, context)
      },
      load(url, context, nextLoad) {
        if (url === sqliteUrl) {
          return {
            format: 'module',
            shortCircuit: true,
            source:
              'export const DatabaseSync = globalThis.__matrixSqlite.DatabaseSync\\n' +
              'export const StatementSync = globalThis.__matrixSqlite.StatementSync\\n',
          }
        }
        return nextLoad(url, context)
      },
    })

    try {
      const store = await import(payload.storeUrl + '?manifest=' + payload.mode)
      const handle = await store.createKernelStore(payload.options)
      handle.close()
      process.stdout.write(JSON.stringify({ code: 'OPENED', message: null }))
    } catch (error) {
      const result = {
        code: error?.code ?? null,
        message: error?.message ?? String(error),
      }
      if (payload.mode === 'b2-fk-temp-shadow') {
        const stack = error?.stack ?? ''
        result.stage = stack.includes('verifyLegacyB2AllowlistState')
          ? 'b2-allowlist'
          : stack.includes('verifyMigrations')
            ? 'migration'
            : 'other'
      }
      process.stdout.write(JSON.stringify(result))
    }
  `
  const child = spawnSync(
    process.execPath,
    ['--no-warnings', '--input-type=module', '--eval', source],
    { encoding: 'utf8', timeout: 30_000 },
  )
  assert.equal(
    child.status,
    0,
    `instrumented ${mode} failed\nstdout:\n${child.stdout}\nstderr:\n${child.stderr}`,
  )
  return JSON.parse(child.stdout)
}

test('M2-A2-04 all three historical physical orders expose identical exact read shapes', async (t) => {
  const directory = await temporaryDirectory()
  const histories = [
    ['current', CANONICAL_MEMORY_KEYS],
    ['post_fictional', [
      ...CANONICAL_MEMORY_KEYS.slice(0, 16),
      'fictional',
      'source_message_id',
      'content_hash',
      'last_decayed_at',
      'source_kind',
      'extractor',
    ]],
    ['pre_fictional', [
      ...CANONICAL_MEMORY_KEYS.slice(0, 16),
      'source_message_id',
      'content_hash',
      'fictional',
      'last_decayed_at',
      'source_kind',
      'extractor',
    ]],
  ]

  for (const [history, physicalOrder] of histories) {
    await t.test(history, async () => {
      const workspaceId = `shape-${history}`
      const options = optionsFor(directory, workspaceId)
      const dbPath = workspaceMemoryDbPath(options)
      seedHistoricalSchema(dbPath, history, { withRow: true })

      const base = await createKernelStore(options)
      assert.equal(base.dbPath, dbPath)

      const listed = base.listMemories({
        palariId: 'palari-matrix',
        userId: 'user-matrix',
      })
      assert.equal(listed.length, 1)
      assert.deepEqual(Reflect.ownKeys(listed[0]), CANONICAL_MEMORY_KEYS)

      const searched = base.searchMemories('runtime manifest matrix', {
        palariId: 'palari-matrix',
        userId: 'user-matrix',
      })
      assert.equal(searched.length, 1)
      assert.deepEqual(Reflect.ownKeys(searched[0]), SEARCH_MEMORY_KEYS)
      assert.equal(Number.isFinite(searched[0].rank), true)

      const recalled = base.recallMemories('runtime manifest matrix', {
        now: FIXED_NOW,
        palariId: 'palari-matrix',
        userId: 'user-matrix',
      })
      assert.deepEqual(Reflect.ownKeys(recalled), [
        'directCount',
        'keywords',
        'latencyMs',
        'memories',
        'totalCandidates',
      ])
      assert.equal(recalled.memories.length, 1)
      assert.deepEqual(Reflect.ownKeys(recalled.memories[0]), RECALL_MEMORY_KEYS)
      assert.equal(Number.isFinite(recalled.memories[0].activationScore), true)

      base.close()
      withIndependentDatabase(dbPath, (db) => {
        const names = db.prepare('PRAGMA main.table_xinfo(memories)').all()
          .map((row) => row.name)
        assert.deepEqual(names, physicalOrder)
      })
      await deleteKernelStoreFile(options)
    })
  }
})

test('M2-A2-04 table, FTS/shadow/config, index, and autoindex mutations fail closed', async (t) => {
  const directory = await temporaryDirectory()
  const cases = [
    ['memory-extra-column', (db) => {
      db.exec('ALTER TABLE memories ADD COLUMN rogue_manifest_column TEXT')
    }],
    ['reserved-fts-shadow-name', (db) => {
      db.exec('CREATE TABLE memory_fts_rogue(value TEXT)')
    }],
    ['fts-config-extra-key', (db) => {
      db.prepare('INSERT INTO memory_fts_config(k, v) VALUES (?, ?)')
        .run('rogue', 1)
    }],
    ['fts-config-missing-version', (db) => {
      db.exec("DELETE FROM memory_fts_config WHERE k = 'version'")
    }, (error) =>
      error?.code === 'legacy_schema_invalid' ||
      error?.code === 'ERR_SQLITE_ERROR'],
    ['fts-config-wrong-version', (db) => {
      db.exec("UPDATE memory_fts_config SET v = 5 WHERE k = 'version'")
    }],
    ['fts-config-wrong-type', (db) => {
      db.exec("UPDATE memory_fts_config SET v = '4' WHERE k = 'version'")
    }],
    ['fts-shadow-xinfo', (db) => {
      db.exec('ALTER TABLE memory_fts_content ADD COLUMN c4')
    }],
    ['fts-tokenizer', (db) => {
      db.exec(`
        DROP TRIGGER memories_ai;
        DROP TRIGGER memories_ad;
        DROP TRIGGER memories_au;
        DROP TABLE memory_fts;
        CREATE VIRTUAL TABLE memory_fts USING fts5(
          memory_id UNINDEXED,
          palari_id UNINDEXED,
          content,
          keywords,
          tokenize = 'unicode61 remove_diacritics 1'
        );
        CREATE TRIGGER memories_ai AFTER INSERT ON memories BEGIN
          INSERT INTO memory_fts(rowid, memory_id, palari_id, content, keywords)
          VALUES (new.rowid, new.id, new.palari_id, new.content, new.keywords);
        END;
        CREATE TRIGGER memories_ad AFTER DELETE ON memories BEGIN
          DELETE FROM memory_fts WHERE rowid = old.rowid;
        END;
        CREATE TRIGGER memories_au AFTER UPDATE OF content, keywords, palari_id ON memories BEGIN
          DELETE FROM memory_fts WHERE rowid = old.rowid;
          INSERT INTO memory_fts(rowid, memory_id, palari_id, content, keywords)
          VALUES (new.rowid, new.id, new.palari_id, new.content, new.keywords);
        END;
      `)
    }],
    ['extra-cdx-index', (db) => {
      db.exec('CREATE INDEX rogue_memories_index ON memories(content)')
    }],
    ['descending-index-xinfo', (db) => {
      db.exec(`
        DROP INDEX memories_content_hash_idx;
        CREATE INDEX memories_content_hash_idx
          ON memories(palari_id DESC, content_hash)
      `)
    }],
    ['unique-index-list', (db) => {
      db.exec(`
        DROP INDEX memories_scope_idx;
        CREATE UNIQUE INDEX memories_scope_idx
          ON memories(palari_id, user_id, shared, valid_until, type)
      `)
    }],
    ['migration-autoindex-origin', (db) => {
      db.exec(`
        ALTER TABLE memory_migrations RENAME TO old_migrations;
        CREATE TABLE memory_migrations(
          id TEXT UNIQUE,
          applied_at TEXT NOT NULL
        );
        INSERT INTO memory_migrations(id, applied_at)
          SELECT id, applied_at FROM old_migrations;
        DROP TABLE old_migrations;
      `)
    }],
  ]

  for (const [name, mutate, predicate] of cases) {
    await t.test(name, () => expectManifestRejection(
      directory,
      `objects-${name}`,
      mutate,
      predicate,
    ))
  }
})

test('M2-A2-04 trigger inventory pins exact CDX and B1 name/target/body triples', async (t) => {
  const directory = await temporaryDirectory()
  const rejected = [
    ['unknown-main-trigger', (db) => {
      db.exec(`
        CREATE TABLE unrelated_trigger_target(value TEXT);
        CREATE TRIGGER unknown_runtime_trigger
        AFTER INSERT ON unrelated_trigger_target BEGIN SELECT 1; END;
      `)
    }],
    ['changed-cdx-trigger-body', (db) => {
      db.exec(`
        DROP TRIGGER memories_ai;
        CREATE TRIGGER memories_ai AFTER INSERT ON memories BEGIN SELECT 1; END;
      `)
    }],
    ['case-variant-cdx-trigger', (db) => {
      db.exec(`
        DROP TRIGGER memories_ai;
        CREATE TRIGGER Memories_ai AFTER INSERT ON memories BEGIN
          INSERT INTO memory_fts(rowid, memory_id, palari_id, content, keywords)
          VALUES (new.rowid, new.id, new.palari_id, new.content, new.keywords);
        END;
      `)
    }],
    ['wrong-b1-trigger-body', (db) => {
      db.exec(`
        CREATE TABLE memory_bundle_meta(singleton INTEGER);
        CREATE TRIGGER memory_bundle_meta_no_delete
        BEFORE DELETE ON memory_bundle_meta BEGIN SELECT 1; END;
      `)
    }],
    ['wrong-b1-trigger-target', (db) => {
      db.exec(`
        CREATE TABLE memory_bundle_meta(singleton INTEGER);
        CREATE TABLE unrelated_b1_target(singleton INTEGER);
        CREATE TRIGGER memory_bundle_meta_no_delete
        BEFORE DELETE ON unrelated_b1_target
        BEGIN SELECT RAISE(ABORT, 'memory_bundle_meta_required'); END;
      `)
    }],
  ]

  for (const [name, mutate] of rejected) {
    await t.test(name, () => expectManifestRejection(
      directory,
      `trigger-${name}`,
      mutate,
    ))
  }

  await t.test('one exact partial B1 trigger triple is accepted', () =>
    expectManifestAcceptance(directory, 'trigger-exact-b1', (db) => {
      db.exec('CREATE TABLE memory_bundle_meta(singleton INTEGER)')
      db.exec(
        'CREATE TRIGGER memory_bundle_meta_no_delete\n' +
        'BEFORE DELETE ON memory_bundle_meta\n' +
        "BEGIN SELECT RAISE(ABORT, 'memory_bundle_meta_required'); END;",
      )
    }))
})

test('M2-A2-04 FK and migration manifests reject every representative drift family', async (t) => {
  const directory = await temporaryDirectory()
  const cases = [
    ['external-fk-into-cdx', (db) => {
      db.exec(`
        CREATE TABLE external_reference(
          memory_id TEXT REFERENCES memories(id)
        )
      `)
    }],
    ['wrong-link-fk-action', (db) => {
      db.exec(`
        DROP INDEX memory_links_from_idx;
        DROP INDEX memory_links_to_idx;
        DROP TABLE memory_links;
        CREATE TABLE memory_links (
          id TEXT PRIMARY KEY,
          from_memory_id TEXT NOT NULL,
          to_memory_id TEXT NOT NULL,
          relation TEXT NOT NULL DEFAULT 'associated',
          created_at TEXT NOT NULL,
          FOREIGN KEY (from_memory_id) REFERENCES memories(id) ON DELETE RESTRICT,
          FOREIGN KEY (to_memory_id) REFERENCES memories(id) ON DELETE CASCADE,
          CHECK (from_memory_id <> to_memory_id)
        );
        CREATE INDEX memory_links_from_idx ON memory_links(from_memory_id);
        CREATE INDEX memory_links_to_idx ON memory_links(to_memory_id);
      `)
    }],
    ['extra-fk-on-cdx-table', (db) => {
      db.exec(`
        ALTER TABLE memory_migrations RENAME TO old_migrations;
        CREATE TABLE unrelated_migration(id TEXT PRIMARY KEY);
        INSERT INTO unrelated_migration(id) VALUES ('CDX-M0'), ('CDX-M1');
        CREATE TABLE memory_migrations(
          id TEXT PRIMARY KEY REFERENCES unrelated_migration(id),
          applied_at TEXT NOT NULL
        );
        INSERT INTO memory_migrations(id, applied_at)
          SELECT id, applied_at FROM old_migrations;
        DROP TABLE old_migrations;
      `)
    }],
    ['migration-extra-row', (db) => {
      db.prepare('INSERT INTO memory_migrations(id, applied_at) VALUES (?, ?)')
        .run('CDX-ROGUE', ROW_TIME)
    }],
    ['migration-malformed-time', (db) => {
      db.exec("UPDATE memory_migrations SET applied_at = 'not-an-iso-time' WHERE id = 'CDX-M1'")
    }],
    ['migration-nontext-time', (db) => {
      db.exec("UPDATE memory_migrations SET applied_at = 7 WHERE id = 'CDX-M1'")
    }],
    ['migration-case-id', (db) => {
      db.exec(`
        DELETE FROM memory_migrations WHERE id = 'CDX-M1';
        INSERT INTO memory_migrations(id, applied_at)
          VALUES ('cdx-m1', '2026-07-21T00:00:01.000Z');
      `)
    }],
  ]

  for (const [name, mutate] of cases) {
    await t.test(name, () => expectManifestRejection(
      directory,
      `fk-migration-${name}`,
      mutate,
    ))
  }
})

test('M2-A2-04 nonhistorical order, constraint, and case variants are refused', async (t) => {
  const directory = await temporaryDirectory()

  await t.test('fourth physical memories order', async () => {
    const workspaceId = 'variant-fourth-order'
    const options = optionsFor(directory, workspaceId)
    seedHistoricalSchema(workspaceMemoryDbPath(options), 'fourth_order')
    await assert.rejects(createKernelStore(options), assertSchemaInvalid)
    await deleteKernelStoreFile(options)
  })

  const caseSeeds = [
    ['case-memory-migrations-table', (sql) => sql.replace(
      'CREATE TABLE memory_migrations',
      'CREATE TABLE Memory_Migrations',
    )],
    ['case-memories-table', (sql) => sql.replace(
      'CREATE TABLE memories',
      'CREATE TABLE Memories',
    )],
    ['case-memory-links-table', (sql) => sql.replace(
      'CREATE TABLE memory_links',
      'CREATE TABLE Memory_Links',
    )],
    ['case-fts-virtual-and-shadows', (sql) => sql.replace(
      'CREATE VIRTUAL TABLE memory_fts',
      'CREATE VIRTUAL TABLE Memory_Fts',
    )],
  ]
  for (const [name, schemaTransform] of caseSeeds) {
    await t.test(name, async () => {
      const options = optionsFor(directory, `variant-${name}`)
      seedHistoricalSchema(
        workspaceMemoryDbPath(options),
        'current',
        { schemaTransform },
      )
      await assert.rejects(createKernelStore(options), assertSchemaInvalid)
      await deleteKernelStoreFile(options)
    })
  }

  const mutations = [
    ['memory-check-constraint', (db) => rewriteStoredSql(
      db,
      'memories',
      'CHECK (shared IN (0, 1))',
      'CHECK (shared IN (0, 1, 2))',
    )],
    ['link-check-constraint', (db) => rewriteStoredSql(
      db,
      'memory_links',
      'CHECK (from_memory_id <> to_memory_id)',
      'CHECK (from_memory_id IS NOT to_memory_id)',
    )],
    ['case-explicit-index', (db) => {
      db.exec(`
        DROP INDEX memories_scope_idx;
        CREATE INDEX Memories_scope_idx
          ON memories(palari_id, user_id, shared, valid_until, type)
      `)
    }],
  ]

  for (const [name, mutate] of mutations) {
    await t.test(name, () => expectManifestRejection(
      directory,
      `variant-${name}`,
      mutate,
    ))
  }
})

test('M2-A2-04 FK check, quick check, FTS parity, and FTS integrity reject corruption', async (t) => {
  const directory = await temporaryDirectory()
  const cases = [
    ['foreign-key-check', (db) => {
      db.exec('PRAGMA foreign_keys = OFF')
      db.prepare(`
        INSERT INTO memory_links(
          id, from_memory_id, to_memory_id, relation, created_at
        ) VALUES (?, ?, ?, ?, ?)
      `).run('dangling-link', 'missing-a', 'missing-b', 'associated', ROW_TIME)
    }, assertSchemaInvalid],
    ['fts-parity-missing', (db) => {
      seedValidMemory(db)
      db.exec("DELETE FROM memory_fts WHERE memory_id = 'mem_manifest_matrix'")
    }, assertSchemaInvalid],
    ['fts-parity-extra', (db) => {
      db.prepare(`
        INSERT INTO memory_fts(rowid, memory_id, palari_id, content, keywords)
        VALUES (?, ?, ?, ?, ?)
      `).run(99_999, 'fts-extra', 'palari-matrix', 'fts extra row', 'fts,extra')
    }, assertSchemaInvalid],
    ['quick-check-page-alias', (db) => {
      db.exec('CREATE TABLE quick_check_probe(value TEXT)')
      db.exec('PRAGMA writable_schema = ON')
      const memoryRoot = db.prepare(`
        SELECT rootpage FROM sqlite_schema WHERE name = 'memories'
      `).get().rootpage
      db.prepare(`
        UPDATE sqlite_schema SET rootpage = ? WHERE name = 'quick_check_probe'
      `).run(memoryRoot)
      const version = db.prepare('PRAGMA schema_version').get().schema_version
      db.exec(`PRAGMA schema_version = ${version + 1}`)
      db.exec('PRAGMA writable_schema = OFF')
    }, (error) =>
      error?.code === 'legacy_schema_invalid' ||
      error?.code === 'ERR_SQLITE_CORRUPT'],
    ['fts-integrity-shadow-block', (db) => {
      seedValidMemory(db)
      db.exec(`
        UPDATE memory_fts_data
        SET block = X'00'
        WHERE id = (SELECT id FROM memory_fts_data ORDER BY id LIMIT 1)
      `)
    }, (error) =>
      error?.code === 'legacy_schema_invalid' ||
      error?.code === 'ERR_SQLITE_CORRUPT' ||
      error?.code === 'ERR_SQLITE_ERROR'],
  ]

  for (const [name, mutate, predicate] of cases) {
    await t.test(name, () => expectManifestRejection(
      directory,
      `integrity-${name}`,
      mutate,
      predicate,
    ))
  }
})

test('M2-A2-04 connection policy, TEMP trigger, quick-check, and FTS command readbacks are enforced', async (t) => {
  const directory = await temporaryDirectory()
  const modes = [
    'pragma-foreign-keys',
    'pragma-busy-timeout',
    'pragma-recursive-triggers',
    'pragma-ignore-checks',
    'pragma-trusted-schema',
    'temp-trigger',
    'quick-check',
    'fts-integrity-command',
  ]

  for (const mode of modes) {
    await t.test(mode, async () => {
      const workspaceId = `instrumented-${mode}`
      const options = optionsFor(directory, workspaceId)
      const initial = await createKernelStore(options)
      initial.close()

      const result = runInstrumentedManifestOpen(directory, workspaceId, mode)
      if (mode === 'fts-integrity-command') {
        assert.deepEqual(result, {
          code: 'ERR_MATRIX_FTS_INTEGRITY',
          message: 'injected FTS integrity command failure',
        })
      } else {
        assert.equal(result.code, 'legacy_schema_invalid')
      }
      await deleteKernelStoreFile(options)
    })
  }
})

test('M2-B-03 historical opener main-scopes the B2 FK allowlist under a TEMP same-name shadow', async () => {
  const directory = await temporaryDirectory()
  const workspaceId = 'b2-fk-temp-shadow'
  const options = optionsFor(directory, workspaceId)
  const initial = await createKernelStore(options)
  const dbPath = initial.dbPath
  initial.close()

  const db = new DatabaseSync(dbPath)
  try {
    createMutationCoordinator(db).run((lease) =>
      bootstrapCdxB2InTransaction(lease, db, { workspaceId }))
    db.exec(`
      CREATE TABLE main.b2_fk_intruder(
        stream_id TEXT REFERENCES cdx_b2_meta(stream_id)
      )
    `)
  } finally {
    db.close()
  }

  assert.deepEqual(
    runInstrumentedManifestOpen(directory, workspaceId, 'b2-fk-temp-shadow'),
    {
      code: 'legacy_schema_invalid',
      message: 'The CDX-M1 runtime schema does not match the required manifest.',
      stage: 'b2-allowlist',
    },
  )
  await deleteKernelStoreFile(options)
})

test('M2-A2-04 non-STRICT memory row oracle rejects every scalar type/domain family', async (t) => {
  const directory = await temporaryDirectory()
  const cases = [
    ['id-null', "UPDATE memories SET id = NULL WHERE id = 'mem_manifest_matrix'"],
    ['palari-blob', "UPDATE memories SET palari_id = X'01'"],
    ['user-blob', "UPDATE memories SET user_id = X'01'"],
    ['type-blob', "UPDATE memories SET type = X'01'"],
    ['type-domain', "UPDATE memories SET type = 'rogue_type'"],
    ['content-blob', "UPDATE memories SET content = X'01'"],
    ['keywords-blob', "UPDATE memories SET keywords = X'01'"],
    ['valid-from-blob', "UPDATE memories SET valid_from = X'01'"],
    ['valid-until-blob', "UPDATE memories SET valid_until = X'01'"],
    ['last-accessed-blob', "UPDATE memories SET last_accessed = X'01'"],
    ['created-at-blob', "UPDATE memories SET created_at = X'01'"],
    ['last-decayed-blob', "UPDATE memories SET last_decayed_at = X'01'"],
    ['source-message-blob', "UPDATE memories SET source_message_id = X'01'"],
    ['content-hash-blob', "UPDATE memories SET content_hash = X'01'"],
    ['source-kind-blob', "UPDATE memories SET source_kind = X'01'"],
    ['extractor-blob', "UPDATE memories SET extractor = X'01'"],
    ['acquisition-blob', "UPDATE memories SET acquisition_mode = X'01'"],
    ['acquisition-domain', "UPDATE memories SET acquisition_mode = 'rogue_mode'"],
    ['importance-text', "UPDATE memories SET importance = 'oops'"],
    ['importance-infinite', 'UPDATE memories SET importance = 1e999'],
    ['confidence-text', "UPDATE memories SET confidence = 'oops'"],
    ['confidence-infinite', 'UPDATE memories SET confidence = -1e999'],
    ['access-text', "UPDATE memories SET access_count = 'oops'"],
    ['access-real', 'UPDATE memories SET access_count = 1.5'],
    ['access-negative', 'UPDATE memories SET access_count = -1'],
    ['access-unsafe', 'UPDATE memories SET access_count = 9007199254740992'],
    ['shared-type', "UPDATE memories SET shared = 'oops'"],
    ['shared-domain', 'UPDATE memories SET shared = 2'],
    ['pipeline-type', "UPDATE memories SET created_by_pipeline = 'oops'"],
    ['pipeline-domain', 'UPDATE memories SET created_by_pipeline = 2'],
    ['fictional-type', "UPDATE memories SET fictional = 'oops'"],
    ['fictional-domain', 'UPDATE memories SET fictional = 2'],
  ]

  for (const [name, sql] of cases) {
    await t.test(name, () => expectManifestRejection(
      directory,
      `memory-row-${name}`,
      (db) => {
        seedValidMemory(db)
        db.exec('PRAGMA foreign_keys = OFF')
        db.exec('PRAGMA ignore_check_constraints = ON')
        db.exec(sql)
      },
    ))
  }
})

test('M2-A2-04 non-STRICT link row oracle rejects every scalar type/domain family', async (t) => {
  const directory = await temporaryDirectory()
  const cases = [
    ['id-null', "UPDATE memory_links SET id = NULL WHERE id = 'link_manifest_matrix'"],
    ['from-blob', "UPDATE memory_links SET from_memory_id = X'01'"],
    ['to-blob', "UPDATE memory_links SET to_memory_id = X'01'"],
    ['relation-blob', "UPDATE memory_links SET relation = X'01'"],
    ['created-at-blob', "UPDATE memory_links SET created_at = X'01'"],
    ['self-link', 'UPDATE memory_links SET to_memory_id = from_memory_id'],
  ]

  for (const [name, sql] of cases) {
    await t.test(name, () => expectManifestRejection(
      directory,
      `link-row-${name}`,
      (db) => {
        seedValidMemory(db)
        seedValidMemory(db, 'mem_manifest_matrix_2')
        seedValidLink(db)
        db.exec('PRAGMA foreign_keys = OFF')
        db.exec('PRAGMA ignore_check_constraints = ON')
        db.exec(sql)
      },
    ))
  }
})

test('M2-A2-04 supplied mismatching content hashes remain accepted compatibility data', async () => {
  const directory = await temporaryDirectory()
  const workspaceId = 'row-mismatching-hash-accepted'
  const options = optionsFor(directory, workspaceId)
  const initial = await createKernelStore(options)
  const dbPath = initial.dbPath
  initial.close()
  withIndependentDatabase(dbPath, (db) => seedValidMemory(db))

  const reopened = await createKernelStore(options)
  assert.equal(
    reopened.getMemoryById('mem_manifest_matrix').content_hash,
    'hash-mem_manifest_matrix',
  )
  reopened.close()
  await deleteKernelStoreFile(options)
})

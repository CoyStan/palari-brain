// Independent Task 3 fixtures for the certified CDX-M1 layouts consumed by
// the CDX-B2 bootstrap. These literals intentionally do not import production
// schema constants.

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export const B2_WORKSPACE_ID = 'b2-checkpoint-workspace'
export const B2_ROW_TIME = '2026-07-21T10:00:00.000Z'

export const B2_MEMORY_IDS = Object.freeze([
  'mem_00000000-0000-4000-8000-000000000001',
  'mem_00000000-0000-4000-8000-000000000002',
  'mem_00000000-0000-4000-8000-000000000003',
])

export const B2_LINK_IDS = Object.freeze([
  'lnk_00000000-0000-4000-8000-000000000001',
  'lnk_00000000-0000-4000-8000-000000000002',
])

export const B2_PAYLOAD_CANARIES = Object.freeze([
  'canary-content-b2-excluded',
  'canary-keywords-b2-excluded',
  'canary-importance-b2-excluded',
  'canary-valid-from-b2-excluded',
  'canary-valid-until-b2-excluded',
  'canary-access-count-b2-excluded',
  'canary-last-accessed-b2-excluded',
  'canary-created-at-b2-excluded',
  'canary-confidence-b2-excluded',
  'canary-acquisition-mode-b2-excluded',
  'canary-pipeline-b2-excluded',
  'canary-fictional-b2-excluded',
  'canary-last-decayed-b2-excluded',
  'canary-source-message-b2-excluded',
  'canary-content-hash-b2-excluded',
  'canary-source-kind-b2-excluded',
  'canary-extractor-b2-excluded',
  'canary-link-relation-b2-excluded',
  'canary-link-created-at-b2-excluded',
])

const MEMORY_PREFIX = `CREATE TABLE memories (
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

const MEMORY_TAILS = Object.freeze([
  `      fictional INTEGER NOT NULL DEFAULT 0 CHECK (fictional IN (0, 1)),
      last_decayed_at TEXT,
      source_message_id TEXT,
      content_hash TEXT NOT NULL
    )`,
  `      fictional INTEGER NOT NULL DEFAULT 0 CHECK (fictional IN (0, 1)),
      source_message_id TEXT,
      content_hash TEXT NOT NULL
    )`,
  `      source_message_id TEXT,
      content_hash TEXT NOT NULL
    )`,
])

function initialSchemaSql(orderIndex) {
  if (![0, 1, 2].includes(orderIndex)) {
    throw new Error(`Unknown CDX-M1 physical order: ${orderIndex}`)
  }
  return `
    CREATE TABLE memory_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
    ${MEMORY_PREFIX}
${MEMORY_TAILS[orderIndex]};
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
}

export function seedCdxM1Schema(db, orderIndex, { withRows = true } = {}) {
  db.exec(initialSchemaSql(orderIndex))
  if (orderIndex === 2) {
    db.exec(
      'ALTER TABLE memories ADD COLUMN fictional INTEGER NOT NULL DEFAULT 0 CHECK (fictional IN (0, 1))',
    )
  }
  if (orderIndex === 1 || orderIndex === 2) {
    db.exec('ALTER TABLE memories ADD COLUMN last_decayed_at TEXT')
  }
  db.exec('ALTER TABLE memories ADD COLUMN source_kind TEXT')
  db.exec('ALTER TABLE memories ADD COLUMN extractor TEXT')

  const migration = db.prepare(
    'INSERT INTO memory_migrations(id, applied_at) VALUES (?, ?)',
  )
  migration.run('CDX-M0', '2026-07-21T09:58:00.000Z')
  migration.run('CDX-M1', '2026-07-21T09:59:00.000Z')
  if (withRows) seedCheckpointRows(db)
}

export function seedHistoricalCdxSchema(db, orderIndex) {
  db.exec(initialSchemaSql(orderIndex))
}

export function seedCheckpointRows(db) {
  const insert = db.prepare(`
    INSERT INTO memories(
      id, palari_id, user_id, type, content, keywords, importance,
      valid_from, valid_until, access_count, last_accessed, created_at,
      shared, confidence, acquisition_mode, created_by_pipeline, fictional,
      last_decayed_at, source_message_id, content_hash, source_kind, extractor
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `)

  // Deliberately insert out of BINARY order. The checkpoint must sort it.
  insert.run(
    B2_MEMORY_IDS[2],
    'palari-b2',
    'user-b2',
    'working',
    B2_PAYLOAD_CANARIES[0],
    B2_PAYLOAD_CANARIES[1],
    0.625,
    B2_ROW_TIME,
    null,
    17,
    B2_ROW_TIME,
    B2_ROW_TIME,
    1,
    0.875,
    'direct',
    1,
    1,
    B2_ROW_TIME,
    B2_PAYLOAD_CANARIES[13],
    B2_PAYLOAD_CANARIES[14],
    B2_PAYLOAD_CANARIES[15],
    B2_PAYLOAD_CANARIES[16],
  )
  insert.run(
    B2_MEMORY_IDS[0],
    'palari-b2',
    null,
    'preference',
    'second-excluded-content-canary',
    'second-excluded-keywords-canary',
    0.5,
    B2_ROW_TIME,
    null,
    0,
    null,
    B2_ROW_TIME,
    0,
    0.75,
    'direct',
    0,
    0,
    null,
    null,
    'second-excluded-hash-canary',
    'user_message',
    null,
  )
  insert.run(
    B2_MEMORY_IDS[1],
    'palari-b2',
    'user-b2',
    'project',
    'third-excluded-content-canary',
    'third-excluded-keywords-canary',
    0.9,
    B2_ROW_TIME,
    B2_ROW_TIME,
    3,
    B2_ROW_TIME,
    B2_ROW_TIME,
    0,
    0.9,
    'extracted',
    0,
    0,
    null,
    'third-excluded-source-message-canary',
    'third-excluded-hash-canary',
    'external_source',
    'test-extractor',
  )

  const link = db.prepare(`
    INSERT INTO memory_links(
      id, from_memory_id, to_memory_id, relation, created_at
    ) VALUES (?, ?, ?, ?, ?)
  `)
  link.run(
    B2_LINK_IDS[1],
    B2_MEMORY_IDS[1],
    B2_MEMORY_IDS[2],
    B2_PAYLOAD_CANARIES[17],
    B2_ROW_TIME,
  )
  link.run(
    B2_LINK_IDS[0],
    B2_MEMORY_IDS[0],
    B2_MEMORY_IDS[1],
    'second-link-relation-canary',
    B2_PAYLOAD_CANARIES[18],
  )
}

export function createCdxM1Fixture(orderIndex, options = {}) {
  const directory = mkdtempSync(join(tmpdir(), `brain-b2-order-${orderIndex}-`))
  const dbPath = join(directory, 'memory.sqlite')
  const db = new DatabaseSync(dbPath)
  seedCdxM1Schema(db, orderIndex, options)
  return {
    db,
    dbPath,
    directory,
    close() {
      try {
        if (db.isOpen) db.close()
      } finally {
        rmSync(directory, { force: true, recursive: true })
      }
    },
  }
}

export function readB2Rows(db) {
  const names = [
    'cdx_b2_meta',
    'cdx_b2_legacy_checkpoint',
    'cdx_b2_decisions',
    'cdx_b2_effects',
  ]
  const result = Object.create(null)
  for (const name of names) {
    result[name] = db.prepare(
      `SELECT * FROM main.${name} ORDER BY rowid`,
    ).all().map((row) => ({ ...row }))
  }
  return result
}

export function b2Inventory(db) {
  return db.prepare(`
    SELECT type, name, tbl_name, sql
    FROM main.sqlite_schema
    WHERE lower(name) LIKE 'cdx_b2_%'
    ORDER BY name COLLATE BINARY
  `).all().map((row) => ({ ...row }))
}

export function b2ScalarStrings(db) {
  return b2ScalarValues(db).filter((value) => typeof value === 'string')
}

export function b2ScalarValues(db) {
  const scalars = []
  for (const rows of Object.values(readB2Rows(db))) {
    for (const row of rows) {
      for (const value of Object.values(row)) {
        scalars.push(value)
      }
    }
  }
  return scalars
}

export function migrationRows(db) {
  return db.prepare(`
    SELECT id, applied_at
    FROM main.memory_migrations
    ORDER BY id COLLATE BINARY
  `).all().map((row) => ({ ...row }))
}

export function expectedCheckpointRows(streamId) {
  return [
    {
      checkpoint_ordinal: 1,
      stream_id: streamId,
      entity_kind: 'memory',
      entity_id: B2_MEMORY_IDS[0],
      palari_id: 'palari-b2',
      user_id: null,
      memory_type: 'preference',
      shared: 0,
      validity_state: 'current',
      from_memory_id: null,
      to_memory_id: null,
    },
    {
      checkpoint_ordinal: 2,
      stream_id: streamId,
      entity_kind: 'memory',
      entity_id: B2_MEMORY_IDS[1],
      palari_id: 'palari-b2',
      user_id: 'user-b2',
      memory_type: 'project',
      shared: 0,
      validity_state: 'ended',
      from_memory_id: null,
      to_memory_id: null,
    },
    {
      checkpoint_ordinal: 3,
      stream_id: streamId,
      entity_kind: 'memory',
      entity_id: B2_MEMORY_IDS[2],
      palari_id: 'palari-b2',
      user_id: 'user-b2',
      memory_type: 'working',
      shared: 1,
      validity_state: 'current',
      from_memory_id: null,
      to_memory_id: null,
    },
    {
      checkpoint_ordinal: 4,
      stream_id: streamId,
      entity_kind: 'link',
      entity_id: B2_LINK_IDS[0],
      palari_id: null,
      user_id: null,
      memory_type: null,
      shared: null,
      validity_state: null,
      from_memory_id: B2_MEMORY_IDS[0],
      to_memory_id: B2_MEMORY_IDS[1],
    },
    {
      checkpoint_ordinal: 5,
      stream_id: streamId,
      entity_kind: 'link',
      entity_id: B2_LINK_IDS[1],
      palari_id: null,
      user_id: null,
      memory_type: null,
      shared: null,
      validity_state: null,
      from_memory_id: B2_MEMORY_IDS[1],
      to_memory_id: B2_MEMORY_IDS[2],
    },
  ]
}

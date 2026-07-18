// Extracted from palari-v05 @ 190a4ad2f8d5187f5f21222048dd11efb2ad9991
//   apps/palari-local-workbench/scripts/workspace-backend/memory-store.mjs
//   (blob 4f67d0fe96dd, 1112 lines) — verbatim except one severed
//   import: './shared.mjs' -> './util.mjs' (vendored booleanEnv,
//   slugify; see docs/SOURCE-MAP.md severance ledger).
// Baseline behavior preserved bugs-and-all per charter; divergences
// happen only via recorded kernel migrations (docs/KERNEL-API.md §7).
// U3, Fable 5, 2026-07-18.
import { createHash, randomUUID } from 'node:crypto'
import { access, mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import { performance } from 'node:perf_hooks'

import { booleanEnv, slugify } from './util.mjs'

const require = createRequire(import.meta.url)

export const memoryStoreSchemaVersion = 'CDX-M0'
export const memoryFtsTokenizer = 'unicode61 remove_diacritics 2'
export const permanentMemoryTypes = new Set([
  'relationship',
  'preference',
  'opinion',
  'entity',
  'life_event',
])
export const transientMemoryTypes = new Set([
  'working',
  'project',
  'recent_life',
  'session_summary',
])
export const memoryTypes = new Set([...permanentMemoryTypes, ...transientMemoryTypes])
export const acquisitionModes = new Set(['direct', 'told_to_me', 'extracted', 'summarized'])
export const memoryAddWriters = new Set([
  'background_extraction',
  'explicit_user_action',
  'session_summary',
])
export const memoryMutationActors = new Set([
  ...memoryAddWriters,
  'lifecycle_job',
])
export const externalMemorySourceKinds = new Set([
  'source_document',
  'tool_output',
  'web_result',
])
const memoryStopWords = new Set([
  'the',
  'a',
  'an',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'could',
  'should',
  'may',
  'might',
  'can',
  'shall',
  'to',
  'of',
  'in',
  'for',
  'on',
  'with',
  'at',
  'by',
  'from',
  'as',
  'into',
  'about',
  'this',
  'that',
  'it',
  'its',
  'not',
  'but',
  'and',
  'or',
  'if',
  'then',
  'so',
  'what',
  'which',
  'who',
  'how',
  'when',
  'where',
  'why',
  'my',
  'your',
  'me',
  'you',
  'we',
  'they',
  'i',
])

function isoNow(clock = () => new Date()) {
  const value = clock()
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function normalizeMemoryId(value) {
  const normalized = String(value ?? '').trim()
  return normalized || `mem_${randomUUID()}`
}

function normalizeMemoryType(value) {
  const normalized = String(value ?? '').trim()
  if (!memoryTypes.has(normalized)) {
    throw new Error(`Unsupported memory type "${normalized}".`)
  }
  return normalized
}

function normalizeAcquisitionMode(value) {
  const normalized = String(value ?? '').trim() || 'direct'
  if (!acquisitionModes.has(normalized)) {
    throw new Error(`Unsupported memory acquisition mode "${normalized}".`)
  }
  return normalized
}

function normalizeMemoryAddWriter(value) {
  const normalized = String(value ?? '').trim()
  if (!memoryAddWriters.has(normalized)) {
    throw new Error(`Unauthorized memory writer "${normalized || 'missing'}".`)
  }
  return normalized
}

function normalizeMemoryMutationActor(value) {
  const normalized = String(value ?? '').trim()
  if (!memoryMutationActors.has(normalized)) {
    throw new Error(`Unauthorized memory mutation actor "${normalized || 'missing'}".`)
  }
  return normalized
}

function normalizeSourceKind(value) {
  return String(value ?? 'user_message').trim() || 'user_message'
}

function assertMemoryAddAuthorized(options = {}) {
  const writer = normalizeMemoryAddWriter(options.writer)
  const sourceKind = normalizeSourceKind(options.sourceKind)
  if (externalMemorySourceKinds.has(sourceKind) && writer !== 'background_extraction') {
    throw new Error('External/source/tool/web content cannot directly create a memory row.')
  }
  return { sourceKind, writer }
}

function normalizeForShingles(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function trigramShingles(value) {
  const normalized = normalizeForShingles(value)
  if (!normalized) return new Set()
  const padded = `  ${normalized}  `
  const shingles = new Set()
  for (let index = 0; index <= padded.length - 3; index += 1) {
    shingles.add(padded.slice(index, index + 3))
  }
  return shingles
}

export function trigramShingleSimilarity(left, right) {
  const leftShingles = trigramShingles(left)
  const rightShingles = trigramShingles(right)
  if (!leftShingles.size && !rightShingles.size) return 1
  if (!leftShingles.size || !rightShingles.size) return 0
  let intersection = 0
  for (const shingle of leftShingles) {
    if (rightShingles.has(shingle)) intersection += 1
  }
  const union = new Set([...leftShingles, ...rightShingles]).size
  return union ? intersection / union : 0
}

export function extractMemoryQueryKeywords(text, { limit = 5 } = {}) {
  const keywords = []
  const seen = new Set()
  for (const raw of String(text ?? '').split(/\s+/)) {
    const normalized = normalizeForShingles(raw)
    if (normalized.length <= 2 || memoryStopWords.has(normalized)) continue
    if (seen.has(normalized)) continue
    seen.add(normalized)
    keywords.push(normalized)
    if (keywords.length >= limit) break
  }
  return keywords
}

function ftsTerm(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

function ftsQueryForKeywords(keywords) {
  return keywords.map(ftsTerm).join(' OR ')
}

function ageDays(value, nowMs) {
  const timestamp = Date.parse(value ?? '')
  if (Number.isNaN(timestamp)) return 365
  return Math.max(0, (nowMs - timestamp) / (24 * 60 * 60 * 1000))
}

function memoryActivationScore(row, nowMs) {
  const importance = Number(row.importance) || 0
  const recency = 1 / (1 + ageDays(row.last_accessed ?? row.created_at, nowMs))
  const access = Math.min(0.2, (Number(row.access_count) || 0) / 100)
  return importance + recency + access
}

function scopedMemoryPredicate(alias = 'm') {
  return `
    ${alias}.palari_id = ?
    AND ${alias}.valid_until IS NULL
    AND (? = '' OR ${alias}.user_id = ? OR ${alias}.user_id IS NULL OR ${alias}.shared = 1)
  `
}

function normalizeWorkspaceId(value) {
  return slugify(value, 'workspace')
}

function numberOrDefault(value, fallback) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function nullableText(value) {
  const normalized = String(value ?? '').trim()
  return normalized || null
}

function memoryContentHash(record) {
  return createHash('sha256')
    .update([
      String(record.palari_id ?? ''),
      String(record.user_id ?? ''),
      String(record.type ?? ''),
      String(record.content ?? ''),
      String(record.keywords ?? ''),
    ].join('\u001f'))
    .digest('hex')
}

export function resolvePalariMemoryConfig({
  env = process.env,
  memoryEnabled = undefined,
  publicDemo = false,
} = {}) {
  const requested = memoryEnabled === undefined
    ? booleanEnv(env.PALARI_MEMORY)
    : Boolean(memoryEnabled)
  const disabledReason = publicDemo
    ? 'public_demo_hard_off'
    : requested
      ? ''
      : 'flag_off'
  return {
    disabledReason,
    enabled: requested && !publicDemo,
    publicDemo: Boolean(publicDemo),
    requested,
  }
}

export function workspaceMemoryDbPath({ memoryRootDir = '', statePath = '', workspaceId }) {
  const safeWorkspaceId = normalizeWorkspaceId(workspaceId)
  const root = memoryRootDir || join(dirname(statePath), 'palari-memory')
  return join(root, `${safeWorkspaceId}.memory.sqlite`)
}

export async function pathExists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export async function deleteWorkspaceMemoryDatabase(options = {}) {
  const dbPath = workspaceMemoryDbPath(options)
  await Promise.all([
    rm(dbPath, { force: true }),
    rm(`${dbPath}-shm`, { force: true }),
    rm(`${dbPath}-wal`, { force: true }),
  ])
  return { dbPath, removed: true }
}

export function probeMemorySqliteDriver() {
  const probe = {
    bilingualRoundTrip: false,
    driver: 'node:sqlite',
    fts5: false,
    status: 'unavailable',
    tokenizer: memoryFtsTokenizer,
  }
  let db = null
  try {
    const { DatabaseSync } = require('node:sqlite')
    db = new DatabaseSync(':memory:')
    db.exec(`CREATE VIRTUAL TABLE memory_probe_fts USING fts5(content, tokenize = '${memoryFtsTokenizer}')`)
    db.prepare('INSERT INTO memory_probe_fts(content) VALUES (?)').run('Fundación Norte')
    const row = db.prepare(
      'SELECT content FROM memory_probe_fts WHERE memory_probe_fts MATCH ? LIMIT 1',
    ).get('fundacion')
    probe.fts5 = true
    probe.bilingualRoundTrip = row?.content === 'Fundación Norte'
    probe.status = probe.bilingualRoundTrip ? 'available' : 'tokenizer_mismatch'
  } catch (error) {
    probe.errorCategory = error?.code ? String(error.code) : 'sqlite_probe_failed'
    probe.status = 'unavailable'
  } finally {
    db?.close()
  }
  return probe
}

function initializeMemorySchema(db) {
  db.exec('PRAGMA foreign_keys = ON')
  db.exec(`
    CREATE TABLE IF NOT EXISTS memory_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    -- v04 spec §2.1 and §2.20: v2 memory tuple plus cheap v3 provenance
    -- columns; v05 keeps plain English names and one workspace DB file.
    CREATE TABLE IF NOT EXISTS memories (
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
      created_by_pipeline INTEGER NOT NULL DEFAULT 0 CHECK (created_by_pipeline IN (0, 1)),
      fictional INTEGER NOT NULL DEFAULT 0 CHECK (fictional IN (0, 1)),
      last_decayed_at TEXT,
      source_message_id TEXT,
      content_hash TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS memories_scope_idx
      ON memories (palari_id, user_id, shared, valid_until, type);
    CREATE INDEX IF NOT EXISTS memories_content_hash_idx
      ON memories (palari_id, content_hash);

    -- v04 spec §2.13 and §3.2: one-hop bidirectional walk over memory links.
    CREATE TABLE IF NOT EXISTS memory_links (
      id TEXT PRIMARY KEY,
      from_memory_id TEXT NOT NULL,
      to_memory_id TEXT NOT NULL,
      relation TEXT NOT NULL DEFAULT 'associated',
      created_at TEXT NOT NULL,
      FOREIGN KEY (from_memory_id) REFERENCES memories(id) ON DELETE CASCADE,
      FOREIGN KEY (to_memory_id) REFERENCES memories(id) ON DELETE CASCADE,
      CHECK (from_memory_id <> to_memory_id)
    );
    CREATE INDEX IF NOT EXISTS memory_links_from_idx ON memory_links (from_memory_id);
    CREATE INDEX IF NOT EXISTS memory_links_to_idx ON memory_links (to_memory_id);

    -- v04 spec §2.20 and §3.2: FTS5 over content || keywords, no embeddings.
    CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
      memory_id UNINDEXED,
      palari_id UNINDEXED,
      content,
      keywords,
      tokenize = '${memoryFtsTokenizer}'
    );

    CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
      INSERT INTO memory_fts(rowid, memory_id, palari_id, content, keywords)
      VALUES (new.rowid, new.id, new.palari_id, new.content, new.keywords);
    END;
    CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
      DELETE FROM memory_fts WHERE rowid = old.rowid;
    END;
    CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE OF content, keywords, palari_id ON memories BEGIN
      DELETE FROM memory_fts WHERE rowid = old.rowid;
      INSERT INTO memory_fts(rowid, memory_id, palari_id, content, keywords)
      VALUES (new.rowid, new.id, new.palari_id, new.content, new.keywords);
    END;
  `)
  db.prepare(`
    INSERT OR IGNORE INTO memory_migrations(id, applied_at)
    VALUES (?, ?)
  `).run(memoryStoreSchemaVersion, new Date().toISOString())
  try {
    db.exec('ALTER TABLE memories ADD COLUMN fictional INTEGER NOT NULL DEFAULT 0 CHECK (fictional IN (0, 1))')
  } catch (error) {
    if (!/duplicate column/i.test(String(error?.message ?? ''))) {
      throw error
    }
  }
  try {
    db.exec('ALTER TABLE memories ADD COLUMN last_decayed_at TEXT')
  } catch (error) {
    if (!/duplicate column/i.test(String(error?.message ?? ''))) {
      throw error
    }
  }
}

function memoryById(db, id) {
  return db.prepare('SELECT * FROM memories WHERE id = ?').get(id) ?? null
}

function memoryRowsForPalari(db, { palariId, userId = '' } = {}) {
  return db.prepare(`
    SELECT * FROM memories
    WHERE ${scopedMemoryPredicate('memories')}
    ORDER BY importance DESC, created_at DESC
  `).all(palariId, String(userId ?? '').trim(), String(userId ?? '').trim())
}

function currentTransientMemoryRows(db, palariId = '') {
  const normalizedPalariId = String(palariId ?? '').trim()
  const params = transientMemoryTypes.size
    ? [...transientMemoryTypes]
    : ['working']
  const placeholders = params.map(() => '?').join(', ')
  return db.prepare(`
    SELECT * FROM memories
    WHERE valid_until IS NULL
      ${normalizedPalariId ? 'AND palari_id = ?' : ''}
      AND type IN (${placeholders})
    ORDER BY created_at ASC
  `).all(...(normalizedPalariId ? [normalizedPalariId, ...params] : params))
}

function decayWindowCount(row = {}, now = new Date()) {
  const reference = row.last_decayed_at ?? row.created_at
  return Math.floor(ageDays(reference, now instanceof Date ? now.getTime() : new Date(now).getTime()) / 14)
}

function insertMemoryRow(db, record = {}, options = {}) {
  const now = isoNow(options.clock)
  const normalized = {
    acquisition_mode: normalizeAcquisitionMode(record.acquisition_mode),
    confidence: numberOrDefault(record.confidence, 0.5),
    content: String(record.content ?? '').trim(),
    created_at: record.created_at ?? now,
    created_by_pipeline: record.created_by_pipeline ? 1 : 0,
    fictional: record.fictional ? 1 : 0,
    id: normalizeMemoryId(record.id),
    importance: numberOrDefault(record.importance, 0.5),
    keywords: Array.isArray(record.keywords)
      ? record.keywords.map((entry) => String(entry ?? '').trim()).filter(Boolean).join(' ')
      : String(record.keywords ?? '').trim(),
    last_accessed: nullableText(record.last_accessed),
    last_decayed_at: nullableText(record.last_decayed_at),
    palari_id: String(record.palari_id ?? '').trim(),
    shared: record.shared ? 1 : 0,
    source_message_id: nullableText(record.source_message_id),
    type: normalizeMemoryType(record.type ?? 'working'),
    user_id: nullableText(record.user_id),
    valid_from: record.valid_from ?? now,
    valid_until: nullableText(record.valid_until),
  }
  if (!normalized.palari_id) throw new Error('Memory palari_id is required.')
  if (!normalized.content) throw new Error('Memory content is required.')
  normalized.content_hash = record.content_hash ?? memoryContentHash(normalized)
  db.prepare(`
    INSERT INTO memories (
      id,
      palari_id,
      user_id,
      type,
      content,
      keywords,
      importance,
      valid_from,
      valid_until,
      access_count,
      last_accessed,
      created_at,
      shared,
      confidence,
      acquisition_mode,
      created_by_pipeline,
      fictional,
      last_decayed_at,
      source_message_id,
      content_hash
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    normalized.id,
    normalized.palari_id,
    normalized.user_id,
    normalized.type,
    normalized.content,
    normalized.keywords,
    normalized.importance,
    normalized.valid_from,
    normalized.valid_until,
    normalized.last_accessed,
    normalized.created_at,
    normalized.shared,
    normalized.confidence,
    normalized.acquisition_mode,
    normalized.created_by_pipeline,
    normalized.fictional,
    normalized.last_decayed_at,
    normalized.source_message_id,
    normalized.content_hash,
  )
  return normalized
}

function findSimilarCurrentMemory(db, record, threshold = 0.85) {
  const palariId = String(record.palari_id ?? '').trim()
  if (!palariId) return null
  const candidates = db.prepare(`
    SELECT * FROM memories
    WHERE palari_id = ?
      AND type = ?
      AND valid_until IS NULL
  `).all(palariId, normalizeMemoryType(record.type ?? 'working'))
  let best = null
  for (const candidate of candidates) {
    const similarity = trigramShingleSimilarity(candidate.content, record.content)
    if (similarity >= threshold && (!best || similarity > best.similarity)) {
      best = { memory: candidate, similarity }
    }
  }
  return best
}

function queryFtsRows(db, { ftsLimit, palariId, query, userId }) {
  const keywords = extractMemoryQueryKeywords(query)
  if (!keywords.length) return { keywords, rows: [] }
  const ftsQuery = ftsQueryForKeywords(keywords)
  const rows = db.prepare(`
    SELECT
      m.*,
      bm25(memory_fts) AS rank,
      'fts' AS rpath,
      NULL AS via_memory_id,
      NULL AS via_relation
    FROM memory_fts
    JOIN memories m ON m.id = memory_fts.memory_id
    WHERE memory_fts MATCH ?
      AND ${scopedMemoryPredicate('m')}
    ORDER BY rank ASC, m.importance DESC
    LIMIT ?
  `).all(ftsQuery, palariId, userId, userId, ftsLimit)
  return { keywords, rows }
}

function queryLinkedRows(db, { ftsRows, linkLimit, palariId, userId }) {
  const ids = ftsRows.map((row) => row.id)
  if (!ids.length || linkLimit <= 0) return []
  const placeholders = ids.map(() => '?').join(', ')
  return db.prepare(`
    SELECT
      m.*,
      NULL AS rank,
      'link_walk' AS rpath,
      CASE
        WHEN l.from_memory_id IN (${placeholders}) THEN l.from_memory_id
        ELSE l.to_memory_id
      END AS via_memory_id,
      l.relation AS via_relation
    FROM memory_links l
    JOIN memories m
      ON m.id = CASE
        WHEN l.from_memory_id IN (${placeholders}) THEN l.to_memory_id
        ELSE l.from_memory_id
      END
    WHERE (
      l.from_memory_id IN (${placeholders})
      OR l.to_memory_id IN (${placeholders})
    )
      AND ${scopedMemoryPredicate('m')}
    LIMIT ?
  `).all(
    ...ids,
    ...ids,
    ...ids,
    ...ids,
    palariId,
    userId,
    userId,
    linkLimit,
  )
}

function queryStandingRows(db, { palariId, userId }) {
  const scopedArgs = [palariId, userId, userId]
  const relationshipRows = db.prepare(`
    SELECT m.*, NULL AS rank, 'standing' AS rpath, NULL AS via_memory_id, NULL AS via_relation
    FROM memories m
    WHERE ${scopedMemoryPredicate('m')}
      AND m.type IN ('preference', 'relationship')
    ORDER BY m.importance DESC, m.access_count DESC
    LIMIT 6
  `).all(...scopedArgs)
  const summaryRows = db.prepare(`
    SELECT m.*, NULL AS rank, 'summary' AS rpath, NULL AS via_memory_id, NULL AS via_relation
    FROM memories m
    WHERE ${scopedMemoryPredicate('m')}
      AND m.type = 'session_summary'
    ORDER BY m.created_at DESC
    LIMIT 1
  `).all(...scopedArgs)
  const recentRows = db.prepare(`
    SELECT m.*, NULL AS rank, 'recent' AS rpath, NULL AS via_memory_id, NULL AS via_relation
    FROM memories m
    WHERE ${scopedMemoryPredicate('m')}
      AND m.type IN ('working', 'project', 'recent_life')
    ORDER BY COALESCE(m.last_accessed, m.created_at) DESC
    LIMIT 6
  `).all(...scopedArgs)
  return [...relationshipRows, ...summaryRows, ...recentRows]
}

function dedupRecallRows(rows, nowMs) {
  const byId = new Map()
  const rpathPriority = {
    fts: 0,
    link_walk: 1,
    summary: 2,
    recent: 3,
    standing: 4,
  }
  for (const row of rows) {
    const score = memoryActivationScore(row, nowMs)
    const existing = byId.get(row.id)
    if (
      !existing ||
      rpathPriority[row.rpath] < rpathPriority[existing.rpath] ||
      score > existing.activationScore
    ) {
      byId.set(row.id, {
        ...row,
        activationScore: score,
      })
    }
  }
  return [...byId.values()].sort((left, right) => {
    const priorityDelta = rpathPriority[left.rpath] - rpathPriority[right.rpath]
    if (priorityDelta) return priorityDelta
    if (left.rank !== null && right.rank !== null && left.rank !== right.rank) {
      return left.rank - right.rank
    }
    return right.activationScore - left.activationScore
  })
}

function disabledMemoryStore(config) {
  return {
    close() {},
    config,
    dbPath: null,
    enabled: false,
    insertMemory() {
      throw new Error(`Palari memory is disabled (${config.disabledReason}).`)
    },
    publicStatus() {
      return {
        db: 'not_created',
        enabled: false,
        reason: config.disabledReason,
        requested: config.requested,
        status: 'disabled',
      }
    },
    searchMemories() {
      return []
    },
    status() {
      return {
        ...this.publicStatus(),
        driver: null,
        fts5: null,
      }
    },
  }
}

export async function createPalariMemoryStore(options = {}) {
  const config = resolvePalariMemoryConfig(options)
  if (!config.enabled) {
    return disabledMemoryStore(config)
  }
  const probe = probeMemorySqliteDriver()
  if (!probe.fts5 || !probe.bilingualRoundTrip) {
    throw new Error('Palari memory requires node:sqlite with FTS5 unicode61 remove_diacritics 2.')
  }
  if (!options.statePath && !options.memoryRootDir) {
    throw new Error('Palari memory requires a statePath or memoryRootDir.')
  }
  const dbPath = workspaceMemoryDbPath(options)
  await mkdir(dirname(dbPath), { recursive: true })
  const { DatabaseSync } = require('node:sqlite')
  const db = new DatabaseSync(dbPath)
  initializeMemorySchema(db)

  return {
    close() {
      db.close()
    },
    config,
    db,
    dbPath,
    enabled: true,
    initializeSchema() {
      initializeMemorySchema(db)
    },
    insertMemory(record = {}) {
      return insertMemoryRow(db, record, options)
    },
    addMemory(record = {}, writeOptions = {}) {
      const { sourceKind, writer } = assertMemoryAddAuthorized(writeOptions)
      const baseRecord = {
        ...record,
        acquisition_mode:
          record.acquisition_mode ??
          (writer === 'session_summary'
            ? 'summarized'
            : writer === 'background_extraction'
              ? 'extracted'
              : 'direct'),
        created_by_pipeline: writer !== 'explicit_user_action',
        source_message_id: record.source_message_id ?? writeOptions.sourceMessageId ?? null,
      }
      if (sourceKind !== 'user_message') {
        baseRecord.keywords = [
          baseRecord.keywords,
          `source:${sourceKind}`,
        ].flat().filter(Boolean)
      }
      const similar = findSimilarCurrentMemory(db, baseRecord, writeOptions.similarityThreshold ?? 0.85)
      if (similar) {
        const bumped = this.bumpImportance(similar.memory.id, 0.05, {
          actor: writer,
          reason: 'duplicate_insert',
        })
        return {
          memory: bumped.memory,
          outcome: 'duplicate_bumped',
          similarity: similar.similarity,
        }
      }
      const memory = insertMemoryRow(db, baseRecord, options)
      return { memory, outcome: 'inserted' }
    },
    addMemoryLink({ fromMemoryId, id = '', relation = 'associated', toMemoryId } = {}) {
      const from = memoryById(db, fromMemoryId)
      const to = memoryById(db, toMemoryId)
      if (!from || !to) {
        throw new Error('Both memory link endpoints must exist.')
      }
      if (from.palari_id !== to.palari_id) {
        throw new Error('Cross-Palari memory links are rejected.')
      }
      const now = isoNow(options.clock)
      const link = {
        created_at: now,
        from_memory_id: from.id,
        id: normalizeMemoryId(id || `link_${from.id}_${to.id}_${relation}`),
        relation: String(relation ?? 'associated').trim() || 'associated',
        to_memory_id: to.id,
      }
      db.prepare(`
        INSERT INTO memory_links(id, from_memory_id, to_memory_id, relation, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(link.id, link.from_memory_id, link.to_memory_id, link.relation, link.created_at)
      return link
    },
    bumpImportance(id, amount = 0.05, mutationOptions = {}) {
      normalizeMemoryMutationActor(mutationOptions.actor ?? 'explicit_user_action')
      const delta = numberOrDefault(amount, 0)
      const row = memoryById(db, id)
      if (!row) return { memory: null, updated: false }
      const nextImportance = Math.max(0, Math.min(1, Number(row.importance ?? 0) + delta))
      db.prepare('UPDATE memories SET importance = ? WHERE id = ?').run(nextImportance, id)
      return { memory: memoryById(db, id), updated: true }
    },
    deleteMemory(id, mutationOptions = {}) {
      const actor = normalizeMemoryMutationActor(mutationOptions.actor ?? 'explicit_user_action')
      const row = memoryById(db, id)
      if (!row) return { deleted: false, reason: 'not_found' }
      if (permanentMemoryTypes.has(row.type) && actor !== 'explicit_user_action') {
        return { deleted: false, memory: row, reason: 'permanent_type_protected' }
      }
      const result = db.prepare('DELETE FROM memories WHERE id = ?').run(id)
      return {
        deleted: result.changes > 0,
        memory: row,
        reason: result.changes > 0 ? 'deleted' : 'not_found',
      }
    },
    getMemoryById(id) {
      return memoryById(db, id)
    },
    listMemories({ palariId, userId = '' } = {}) {
      return memoryRowsForPalari(db, {
        palariId: String(palariId ?? '').trim(),
        userId: String(userId ?? '').trim(),
      })
    },
    recallMemories(query, {
      contextBudget = 20,
      ftsLimit = 20,
      linkCap = 40,
      now = new Date(),
      palariId,
      userId = '',
    } = {}) {
      const startedAt = performance.now()
      const normalizedPalariId = String(palariId ?? '').trim()
      const normalizedUserId = String(userId ?? '').trim()
      if (!normalizedPalariId) {
        return {
          directCount: 0,
          keywords: [],
          latencyMs: Math.max(0, performance.now() - startedAt),
          memories: [],
          totalCandidates: 0,
        }
      }
      // v04 spec §3.2: FTS5 top-k, one-hop bidirectional walk, dedup,
      // importance/recency ordering, cap at context budget.
      const { keywords, rows: ftsRows } = queryFtsRows(db, {
        ftsLimit,
        palariId: normalizedPalariId,
        query,
        userId: normalizedUserId,
      })
      const linkLimit = Math.max(0, linkCap - ftsRows.length)
      const linkedRows = queryLinkedRows(db, {
        ftsRows,
        linkLimit,
        palariId: normalizedPalariId,
        userId: normalizedUserId,
      })
      const standingRows = queryStandingRows(db, {
        palariId: normalizedPalariId,
        userId: normalizedUserId,
      })
      const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime()
      const memories = dedupRecallRows([...ftsRows, ...linkedRows, ...standingRows], nowMs)
        .slice(0, Math.max(1, Number(contextBudget) || 20))
      return {
        directCount: ftsRows.length,
        keywords,
        latencyMs: Math.max(0, performance.now() - startedAt),
        memories,
        totalCandidates: ftsRows.length + linkedRows.length + standingRows.length,
      }
    },
    supersedeMemory(existingId, record = {}, writeOptions = {}) {
      const { writer } = assertMemoryAddAuthorized(writeOptions)
      const existing = memoryById(db, existingId)
      if (!existing) {
        throw new Error('Cannot supersede a missing memory.')
      }
      const now = isoNow(options.clock)
      db.exec('BEGIN')
      try {
        db.prepare('UPDATE memories SET valid_until = ? WHERE id = ?').run(now, existingId)
        const memory = insertMemoryRow(db, {
          ...record,
          acquisition_mode:
            record.acquisition_mode ??
            (writer === 'session_summary'
              ? 'summarized'
              : writer === 'background_extraction'
                ? 'extracted'
                : 'direct'),
          created_by_pipeline: writer !== 'explicit_user_action',
          palari_id: record.palari_id ?? existing.palari_id,
          type: record.type ?? existing.type,
          user_id: record.user_id ?? existing.user_id,
          valid_from: record.valid_from ?? now,
        }, options)
        const link = {
          created_at: now,
          from_memory_id: memory.id,
          id: normalizeMemoryId(`link_${memory.id}_${existing.id}_supersedes`),
          relation: 'supersedes',
          to_memory_id: existing.id,
        }
        db.prepare(`
          INSERT INTO memory_links(id, from_memory_id, to_memory_id, relation, created_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(link.id, link.from_memory_id, link.to_memory_id, link.relation, link.created_at)
        db.exec('COMMIT')
        return { link, memory, superseded: existing }
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }
    },
    touchMemory(id, mutationOptions = {}) {
      normalizeMemoryMutationActor(mutationOptions.actor ?? 'explicit_user_action')
      const now = isoNow(options.clock)
      const result = db.prepare(`
        UPDATE memories
        SET access_count = access_count + 1,
            last_accessed = ?
        WHERE id = ?
      `).run(now, id)
      return { memory: memoryById(db, id), updated: result.changes > 0 }
    },
    recordRecallInclusion(memoryIds = [], mutationOptions = {}) {
      const actor = normalizeMemoryMutationActor(mutationOptions.actor ?? 'lifecycle_job')
      const bumpAmount = numberOrDefault(mutationOptions.bumpAmount, 0.05)
      const ids = [...new Set(
        (Array.isArray(memoryIds) ? memoryIds : [memoryIds])
          .map((id) => String(id ?? '').trim())
          .filter(Boolean),
      )]
      const touched = []
      for (const id of ids) {
        const touch = this.touchMemory(id, { actor })
        if (!touch.updated) continue
        const bump = this.bumpImportance(id, bumpAmount, {
          actor,
          reason: 'recall_inclusion',
        })
        touched.push({
          id,
          importance: bump.memory?.importance ?? touch.memory?.importance,
        })
      }
      return {
        touched,
        touchedCount: touched.length,
      }
    },
    runLifecycleJobs({ palariId = '', now = isoNow(options.clock) } = {}) {
      const nowIso = now instanceof Date ? now.toISOString() : new Date(now).toISOString()
      const nowDate = new Date(nowIso)
      const rows = currentTransientMemoryRows(db, palariId)
      const summary = {
        decayed: 0,
        deleted: 0,
        skipped: 0,
        touched: 0,
      }
      // v04 memory spec §2.20: transient memories decay on a deterministic
      // clock; permanent types are outside lifecycle deletion.
      for (const row of rows) {
        const windows = decayWindowCount(row, nowDate)
        if (windows < 1) {
          summary.skipped += 1
          continue
        }
        const nextImportance = Math.max(0, Number(row.importance ?? 0) - (0.1 * windows))
        if (nextImportance <= 0.1) {
          const deleted = this.deleteMemory(row.id, { actor: 'lifecycle_job' })
          if (deleted.deleted) summary.deleted += 1
          else summary.skipped += 1
          continue
        }
        db.prepare(`
          UPDATE memories
          SET importance = ?,
              last_decayed_at = ?
          WHERE id = ?
        `).run(nextImportance, nowIso, row.id)
        summary.decayed += 1
      }
      summary.touched = summary.decayed + summary.deleted
      return summary
    },
    publicStatus() {
      return {
        db: 'per_workspace_sqlite',
        driver: probe.driver,
        enabled: true,
        fts5: probe.fts5 ? 'available' : 'unavailable',
        status: 'enabled',
        tokenizer: memoryFtsTokenizer,
      }
    },
    searchMemories(query, { limit = 20, palariId, userId = '' } = {}) {
      const normalizedQuery = String(query ?? '').trim()
      const normalizedPalariId = String(palariId ?? '').trim()
      if (!normalizedQuery || !normalizedPalariId) return []
      return db.prepare(`
        SELECT
          m.id,
          m.palari_id,
          m.user_id,
          m.type,
          m.content,
          m.keywords,
          m.importance,
          m.valid_from,
          m.valid_until,
          m.access_count,
          m.last_accessed,
          m.created_at,
          m.shared,
          m.confidence,
          m.acquisition_mode,
          m.created_by_pipeline,
          m.fictional,
          m.source_message_id,
          m.content_hash,
          bm25(memory_fts) AS rank
        FROM memory_fts
        JOIN memories m ON m.id = memory_fts.memory_id
        WHERE memory_fts MATCH ?
          AND ${scopedMemoryPredicate('m')}
        ORDER BY rank ASC, m.importance DESC
        LIMIT ?
      `).all(
        normalizedQuery,
        normalizedPalariId,
        String(userId ?? '').trim(),
        String(userId ?? '').trim(),
        Math.max(1, Number(limit) || 20),
      )
    },
    status() {
      return {
        ...this.publicStatus(),
        dbPath,
        probe,
      }
    },
  }
}

export function createWorkspaceMemoryManager(options = {}) {
  const config = resolvePalariMemoryConfig(options)
  const probe = config.enabled ? probeMemorySqliteDriver() : null
  const stores = new Map()
  return {
    async close() {
      for (const store of stores.values()) {
        store.close()
      }
      stores.clear()
    },
    config,
    async forWorkspace(workspaceId) {
      if (!config.enabled) {
        return disabledMemoryStore(config)
      }
      const normalizedWorkspaceId = normalizeWorkspaceId(workspaceId)
      if (!stores.has(normalizedWorkspaceId)) {
        stores.set(normalizedWorkspaceId, await createPalariMemoryStore({
          ...options,
          memoryEnabled: true,
          publicDemo: false,
          workspaceId: normalizedWorkspaceId,
        }))
      }
      return stores.get(normalizedWorkspaceId)
    },
    publicStatus() {
      if (!config.enabled) {
        return disabledMemoryStore(config).publicStatus()
      }
      return {
        db: 'per_workspace_sqlite',
        driver: probe.driver,
        enabled: true,
        fts5: probe.fts5 ? 'available' : 'unavailable',
        status: probe.fts5 && probe.bilingualRoundTrip ? 'ready' : 'blocked',
        tokenizer: memoryFtsTokenizer,
      }
    },
  }
}

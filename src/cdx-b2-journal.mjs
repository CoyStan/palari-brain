// V2-M2-B Task 3 CDX-B2 bootstrap journal.
//
// The private CDX-M0/M1 completion and manifest-verification core is
// mechanically adapted from src/kernel-store-runtime.mjs at A2 implementation
// commit e6bbc519b6b140bde3f2afc3bfc497cb937478c9, certification hardening
// d419fefdfb782da28ef20a9d46437cad12c313e1, and certified cut point
// 53e5b0357f83be7700a32458d38922cb7777a66e (identical runtime blob
// 9352dc8ab74216a3924a12a760d3db25c552f652). Its upstream Palari v05
// provenance remains commit 190a4ad2f8d5187f5f21222048dd11efb2ad9991.
//
// Intentional M2-B deltas are limited to lease-bound transaction neutrality,
// explicit main-schema qualification, B2-aware inventory/migration
// verification, read-only FTS parity checks, the exact B2 checkpoint
// bootstrap, and GovernedMemoryError classification. This Task 3 cut point
// accepts only a head-zero journal; Task 4 extends the same verifier with
// positive-tail reduction and adds append/advance operations.

import { randomUUID } from 'node:crypto'
import { DatabaseSync, StatementSync } from 'node:sqlite'
import { types as utilTypes } from 'node:util'

import {
  MEMORY_BUNDLE_OBJECTS,
  MEMORY_BUNDLE_TRIGGER_TARGETS,
  normalizeMemoryBundleSql,
} from './memory-bundle-schema.mjs'
import { assertActiveMutationLease } from './mutation-coordinator.mjs'
import {
  CDX_B2_CREATE_STATEMENTS,
  CDX_B2_KERNEL_CONFIG_HASH,
  CDX_B2_MANIFEST,
  CDX_B2_REQUIRED_PRAGMAS,
  normalizeCdxB2Sql,
} from './cdx-b2-schema.mjs'

const reflectApply = Reflect.apply
const reflectConstruct = Reflect.construct
const reflectDefineProperty = Reflect.defineProperty
const reflectGetOwnPropertyDescriptor = Reflect.getOwnPropertyDescriptor
const reflectGetPrototypeOf = Reflect.getPrototypeOf
const reflectOwnKeys = Reflect.ownKeys
const objectCreate = Object.create
const objectFreeze = Object.freeze
const objectHasOwnProperty = Object.prototype.hasOwnProperty
const objectIs = Object.is
const objectKeys = Object.keys
const objectPrototype = Object.prototype
const arrayIsArray = Array.isArray
const arraySlice = Array.prototype.slice
const dateParse = Date.parse
const dateToISOString = Date.prototype.toISOString
const mapGet = Map.prototype.get
const mapSet = Map.prototype.set
const mapSize = reflectGetOwnPropertyDescriptor(Map.prototype, 'size').get
const numberIsFinite = Number.isFinite
const numberIsSafeInteger = Number.isSafeInteger
const numberMaxSafeInteger = Number.MAX_SAFE_INTEGER
const setAdd = Set.prototype.add
const setHas = Set.prototype.has
const stringCharCodeAt = String.prototype.charCodeAt
const stringFromCharCode = String.fromCharCode
const stringIncludes = String.prototype.includes
const stringSlice = String.prototype.slice
const stringStartsWith = String.prototype.startsWith
const weakSetAdd = WeakSet.prototype.add
const weakSetHas = WeakSet.prototype.has
const isProxy = utilTypes.isProxy

const nativeDate = Date
const nativeError = Error
const nativeMap = Map
const nativeRandomUUID = randomUUID
const nativeSet = Set
const nativeString = String
const nativeTypeError = TypeError
const nativeWeakSet = WeakSet

const databaseExec = DatabaseSync.prototype.exec
const databasePrepare = DatabaseSync.prototype.prepare
const statementAll = StatementSync.prototype.all
const statementGet = StatementSync.prototype.get
const statementRun = StatementSync.prototype.run
const statementSetReadBigInts = StatementSync.prototype.setReadBigInts
const statementSetReturnArrays = StatementSync.prototype.setReturnArrays

const GOVERNED_ERROR_MESSAGES = objectFreeze({
  governance_invalid_argument: 'A valid governed memory argument is required.',
  governance_connection_invalid: 'The governed memory connection is unavailable.',
  governance_transaction_required: 'A coordinator-owned governed mutation transaction is required.',
  governance_schema_invalid: 'The CDX-B2 schema is invalid.',
  governance_migration_invalid: 'The CDX-B2 migration state is invalid.',
  governance_config_invalid: 'The CDX-B2 kernel configuration is invalid.',
  governance_meta_invalid: 'The CDX-B2 metadata is invalid.',
  governance_checkpoint_invalid: 'The CDX-B2 legacy checkpoint is invalid.',
  governance_journal_invalid: 'The CDX-B2 journal is invalid.',
  governance_projection_invalid: 'The CDX-M1 projection does not match the CDX-B2 journal.',
  governance_clock_invalid: 'The governed memory observation clock moved backward.',
  governance_identifier_collision: 'A generated governed memory identifier already exists.',
  governance_state_closed: 'The governed memory bridge is closed.',
  governance_state_poisoned: 'The governed memory bridge is poisoned and must be discarded.',
  governance_internal_invariant: 'The governed memory kernel invariant failed.',
})
const GOVERNED_ERROR_CODES = new nativeSet()
const governedErrorCodes = objectKeys(GOVERNED_ERROR_MESSAGES)
for (let index = 0; index < governedErrorCodes.length; index += 1) {
  reflectApply(setAdd, GOVERNED_ERROR_CODES, [governedErrorCodes[index]])
}
const governedErrors = new nativeWeakSet()

function throwNativeTypeError(message) {
  throw reflectConstruct(nativeTypeError, [message])
}

export class GovernedMemoryError extends Error {
  constructor(code, message, cause) {
    if (
      typeof code !== 'string' ||
      !reflectApply(setHas, GOVERNED_ERROR_CODES, [code])
    ) throwNativeTypeError('Unknown governed memory error code.')
    if (typeof message !== 'string' || message === '') {
      throwNativeTypeError(
        'Governed memory error message must be a non-empty string.',
      )
    }
    const error = reflectConstruct(
      nativeError,
      cause === undefined
        ? [message]
        : [message, { __proto__: null, cause }],
      governedMemoryErrorNewTarget,
    )
    reflectApply(reflectDefineProperty, undefined, [error, 'name', {
      __proto__: null,
      value: 'GovernedMemoryError',
      enumerable: false,
      configurable: true,
      writable: true,
    }])
    reflectApply(reflectDefineProperty, undefined, [error, 'code', {
      __proto__: null,
      value: code,
      enumerable: true,
      configurable: false,
      writable: false,
    }])
    reflectApply(weakSetAdd, governedErrors, [error])
    return error
  }
}

const governedMemoryErrorNewTarget = GovernedMemoryError

function governedFailure(code, cause) {
  return reflectConstruct(
    GovernedMemoryError,
    cause === undefined
      ? [code, GOVERNED_ERROR_MESSAGES[code]]
      : [code, GOVERNED_ERROR_MESSAGES[code], cause],
  )
}

function isGovernedFailure(value) {
  return (
    value !== null &&
    (typeof value === 'object' || typeof value === 'function') &&
    reflectApply(weakSetHas, governedErrors, [value])
  )
}

function runGovernedPhase(code, callback) {
  try {
    return reflectApply(callback, undefined, [])
  } catch (error) {
    if (isGovernedFailure(error)) throw error
    throw governedFailure(code, error)
  }
}

function appendValue(target, value) {
  const key = reflectApply(nativeString, undefined, [target.length])
  reflectApply(reflectDefineProperty, undefined, [target, key, {
    __proto__: null,
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  }])
}

function hasOwn(target, key) {
  return reflectApply(objectHasOwnProperty, target, [key])
}

function execDatabase(db, sql) {
  return reflectApply(databaseExec, db, [sql])
}

function prepareRowStatement(db, sql) {
  const statement = reflectApply(databasePrepare, db, [sql])
  reflectApply(statementSetReadBigInts, statement, [false])
  reflectApply(statementSetReturnArrays, statement, [false])
  return statement
}

function invalidNativeRow() {
  return reflectConstruct(nativeError, [
    'SQLite returned a row that is not an own-data record.',
  ])
}

function defineMutableData(target, key, value) {
  reflectApply(reflectDefineProperty, undefined, [target, key, {
    __proto__: null,
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  }])
}

function copyNativeRow(source) {
  if (
    source === null ||
    typeof source !== 'object' ||
    reflectApply(isProxy, undefined, [source])
  ) throw invalidNativeRow()
  const keys = reflectOwnKeys(source)
  const target = {}
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index]
    if (typeof key !== 'string') throw invalidNativeRow()
    const descriptor = reflectGetOwnPropertyDescriptor(source, key)
    if (descriptor === undefined || !hasOwn(descriptor, 'value')) {
      throw invalidNativeRow()
    }
    defineMutableData(target, key, descriptor.value)
  }
  return target
}

function copyNativeRows(source) {
  if (!arrayIsArray(source) || reflectApply(isProxy, undefined, [source])) {
    throw invalidNativeRow()
  }
  const keys = reflectOwnKeys(source)
  const lengthDescriptor = reflectGetOwnPropertyDescriptor(source, 'length')
  if (
    lengthDescriptor === undefined ||
    !hasOwn(lengthDescriptor, 'value') ||
    !numberIsSafeInteger(lengthDescriptor.value) ||
    lengthDescriptor.value < 0 ||
    keys.length !== lengthDescriptor.value + 1 ||
    keys[keys.length - 1] !== 'length'
  ) throw invalidNativeRow()
  const rows = []
  for (let index = 0; index < lengthDescriptor.value; index += 1) {
    const key = reflectApply(nativeString, undefined, [index])
    const descriptor = reflectGetOwnPropertyDescriptor(source, key)
    if (
      keys[index] !== key ||
      descriptor === undefined ||
      !hasOwn(descriptor, 'value')
    ) throw invalidNativeRow()
    appendValue(rows, copyNativeRow(descriptor.value))
  }
  return rows
}

function readRows(db, sql, parameters = []) {
  const statement = prepareRowStatement(db, sql)
  return copyNativeRows(reflectApply(statementAll, statement, parameters))
}

function readRow(db, sql, parameters = []) {
  const statement = prepareRowStatement(db, sql)
  const row = reflectApply(statementGet, statement, parameters)
  return row === undefined ? null : copyNativeRow(row)
}

function runStatement(db, sql, parameters = []) {
  const statement = reflectApply(databasePrepare, db, [sql])
  return reflectApply(statementRun, statement, parameters)
}

function readScalar(db, sql) {
  const row = readRow(db, sql)
  if (row === null) return undefined
  const keys = reflectOwnKeys(row)
  if (keys.length !== 1 || typeof keys[0] !== 'string') return undefined
  return row[keys[0]]
}

function nativeIsoNow() {
  const value = reflectConstruct(nativeDate, [])
  return reflectApply(dateToISOString, value, [])
}

function asciiFold(value) {
  if (typeof value !== 'string') return null
  let result = ''
  for (let index = 0; index < value.length; index += 1) {
    let unit = reflectApply(stringCharCodeAt, value, [index])
    if (unit >= 0x41 && unit <= 0x5a) unit += 0x20
    result += reflectApply(stringFromCharCode, undefined, [unit])
  }
  return result
}

function valuesEqual(left, right) {
  return reflectApply(objectIs, undefined, [left, right])
}

function isCanonicalTimestamp(value) {
  if (typeof value !== 'string' || value.length !== 24) return false
  const parsed = reflectApply(dateParse, nativeDate, [value])
  if (!numberIsFinite(parsed)) return false
  const date = reflectConstruct(nativeDate, [parsed])
  return reflectApply(dateToISOString, date, []) === value
}

function isWorkspaceId(value) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 48) {
    return false
  }
  const first = reflectApply(stringCharCodeAt, value, [0])
  if (!(
    (first >= 0x61 && first <= 0x7a) ||
    (first >= 0x30 && first <= 0x39)
  )) return false
  for (let index = 0; index < value.length; index += 1) {
    const unit = reflectApply(stringCharCodeAt, value, [index])
    if (!(
      (unit >= 0x61 && unit <= 0x7a) ||
      (unit >= 0x30 && unit <= 0x39) ||
      unit === 0x2d
    )) return false
  }
  if (reflectApply(stringIncludes, value, ['--'])) return false
  if (value.length !== 48) {
    const last = reflectApply(stringCharCodeAt, value, [value.length - 1])
    if (!(
      (last >= 0x61 && last <= 0x7a) ||
      (last >= 0x30 && last <= 0x39)
    )) return false
  }
  return true
}

function isOrdinaryRecord(value) {
  if (
    value === null ||
    typeof value !== 'object' ||
    reflectApply(isProxy, undefined, [value])
  ) return false
  const prototype = reflectGetPrototypeOf(value)
  return prototype === null || prototype === objectPrototype
}

function captureBootstrapInput(input) {
  if (!isOrdinaryRecord(input)) throw governedFailure('governance_invalid_argument')
  const keys = reflectOwnKeys(input)
  if (keys.length !== 1 || keys[0] !== 'workspaceId') {
    throw governedFailure('governance_invalid_argument')
  }
  const descriptor = reflectGetOwnPropertyDescriptor(input, 'workspaceId')
  if (
    descriptor === undefined ||
    !hasOwn(descriptor, 'value') ||
    !isWorkspaceId(descriptor.value)
  ) throw governedFailure('governance_invalid_argument')
  return descriptor.value
}

const MEMORY_FTS_TOKENIZER = 'unicode61 remove_diacritics 2'

// Every created object is explicitly main-scoped. SQLite requires DML inside
// a non-TEMP trigger body to use unqualified table names; because each trigger
// itself is created in main, those body references resolve within main.
const CDX_M0_SCHEMA_SQL = `
    CREATE TABLE IF NOT EXISTS main.memory_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS main.memories (
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

    CREATE INDEX IF NOT EXISTS main.memories_scope_idx
      ON memories (palari_id, user_id, shared, valid_until, type);
    CREATE INDEX IF NOT EXISTS main.memories_content_hash_idx
      ON memories (palari_id, content_hash);

    CREATE TABLE IF NOT EXISTS main.memory_links (
      id TEXT PRIMARY KEY,
      from_memory_id TEXT NOT NULL,
      to_memory_id TEXT NOT NULL,
      relation TEXT NOT NULL DEFAULT 'associated',
      created_at TEXT NOT NULL,
      FOREIGN KEY (from_memory_id) REFERENCES memories(id) ON DELETE CASCADE,
      FOREIGN KEY (to_memory_id) REFERENCES memories(id) ON DELETE CASCADE,
      CHECK (from_memory_id <> to_memory_id)
    );
    CREATE INDEX IF NOT EXISTS main.memory_links_from_idx ON memory_links (from_memory_id);
    CREATE INDEX IF NOT EXISTS main.memory_links_to_idx ON memory_links (to_memory_id);

    CREATE VIRTUAL TABLE IF NOT EXISTS main.memory_fts USING fts5(
      memory_id UNINDEXED,
      palari_id UNINDEXED,
      content,
      keywords,
      tokenize = '${MEMORY_FTS_TOKENIZER}'
    );

    CREATE TRIGGER IF NOT EXISTS main.memories_ai AFTER INSERT ON memories BEGIN
      INSERT INTO memory_fts(rowid, memory_id, palari_id, content, keywords)
      VALUES (new.rowid, new.id, new.palari_id, new.content, new.keywords);
    END;
    CREATE TRIGGER IF NOT EXISTS main.memories_ad AFTER DELETE ON memories BEGIN
      DELETE FROM memory_fts WHERE rowid = old.rowid;
    END;
    CREATE TRIGGER IF NOT EXISTS main.memories_au AFTER UPDATE OF content, keywords, palari_id ON memories BEGIN
      DELETE FROM memory_fts WHERE rowid = old.rowid;
      INSERT INTO memory_fts(rowid, memory_id, palari_id, content, keywords)
      VALUES (new.rowid, new.id, new.palari_id, new.content, new.keywords);
    END;
  `

const MEMORIES_SQL_PREFIX = `CREATE TABLE memories (
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

const MEMORIES_SQL_VARIANTS = objectFreeze([
  `${MEMORIES_SQL_PREFIX}
      fictional INTEGER NOT NULL DEFAULT 0 CHECK (fictional IN (0, 1)),
      last_decayed_at TEXT,
      source_message_id TEXT,
      content_hash TEXT NOT NULL
    , source_kind TEXT, extractor TEXT)`,
  `${MEMORIES_SQL_PREFIX}
      fictional INTEGER NOT NULL DEFAULT 0 CHECK (fictional IN (0, 1)),
      source_message_id TEXT,
      content_hash TEXT NOT NULL
    , last_decayed_at TEXT, source_kind TEXT, extractor TEXT)`,
  `${MEMORIES_SQL_PREFIX}
      source_message_id TEXT,
      content_hash TEXT NOT NULL
    , fictional INTEGER NOT NULL DEFAULT 0 CHECK (fictional IN (0, 1)), last_decayed_at TEXT, source_kind TEXT, extractor TEXT)`,
])

// sqlite_schema stores these canonical object definitions without the `main.`
// execution qualifier; they are verification oracles, never execution SQL.
const PERSISTED_SQL = objectFreeze({
  memory_migrations: `CREATE TABLE memory_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )`,
  memory_links: `CREATE TABLE memory_links (
      id TEXT PRIMARY KEY,
      from_memory_id TEXT NOT NULL,
      to_memory_id TEXT NOT NULL,
      relation TEXT NOT NULL DEFAULT 'associated',
      created_at TEXT NOT NULL,
      FOREIGN KEY (from_memory_id) REFERENCES memories(id) ON DELETE CASCADE,
      FOREIGN KEY (to_memory_id) REFERENCES memories(id) ON DELETE CASCADE,
      CHECK (from_memory_id <> to_memory_id)
    )`,
  memories_scope_idx: `CREATE INDEX memories_scope_idx
      ON memories (palari_id, user_id, shared, valid_until, type)`,
  memories_content_hash_idx: `CREATE INDEX memories_content_hash_idx
      ON memories (palari_id, content_hash)`,
  memory_links_from_idx: 'CREATE INDEX memory_links_from_idx ON memory_links (from_memory_id)',
  memory_links_to_idx: 'CREATE INDEX memory_links_to_idx ON memory_links (to_memory_id)',
  memory_fts: `CREATE VIRTUAL TABLE memory_fts USING fts5(
      memory_id UNINDEXED,
      palari_id UNINDEXED,
      content,
      keywords,
      tokenize = 'unicode61 remove_diacritics 2'
    )`,
  memory_fts_config: "CREATE TABLE 'memory_fts_config'(k PRIMARY KEY, v) WITHOUT ROWID",
  memory_fts_content: "CREATE TABLE 'memory_fts_content'(id INTEGER PRIMARY KEY, c0, c1, c2, c3)",
  memory_fts_data: "CREATE TABLE 'memory_fts_data'(id INTEGER PRIMARY KEY, block BLOB)",
  memory_fts_docsize: "CREATE TABLE 'memory_fts_docsize'(id INTEGER PRIMARY KEY, sz BLOB)",
  memory_fts_idx: "CREATE TABLE 'memory_fts_idx'(segid, term, pgno, PRIMARY KEY(segid, term)) WITHOUT ROWID",
  memories_ai: `CREATE TRIGGER memories_ai AFTER INSERT ON memories BEGIN
      INSERT INTO memory_fts(rowid, memory_id, palari_id, content, keywords)
      VALUES (new.rowid, new.id, new.palari_id, new.content, new.keywords);
    END`,
  memories_ad: `CREATE TRIGGER memories_ad AFTER DELETE ON memories BEGIN
      DELETE FROM memory_fts WHERE rowid = old.rowid;
    END`,
  memories_au: `CREATE TRIGGER memories_au AFTER UPDATE OF content, keywords, palari_id ON memories BEGIN
      DELETE FROM memory_fts WHERE rowid = old.rowid;
      INSERT INTO memory_fts(rowid, memory_id, palari_id, content, keywords)
      VALUES (new.rowid, new.id, new.palari_id, new.content, new.keywords);
    END`,
})

const CANONICAL_MEMORY_KEYS = objectFreeze([
  'id', 'palari_id', 'user_id', 'type', 'content', 'keywords', 'importance',
  'valid_from', 'valid_until', 'access_count', 'last_accessed', 'created_at',
  'shared', 'confidence', 'acquisition_mode', 'created_by_pipeline',
  'fictional', 'last_decayed_at', 'source_message_id', 'content_hash',
  'source_kind', 'extractor',
])

const MEMORY_COLUMN_DESCRIPTOR = objectFreeze({
  id: objectFreeze(['TEXT', 0, null, 1, 0]),
  palari_id: objectFreeze(['TEXT', 1, null, 0, 0]),
  user_id: objectFreeze(['TEXT', 0, null, 0, 0]),
  type: objectFreeze(['TEXT', 1, null, 0, 0]),
  content: objectFreeze(['TEXT', 1, null, 0, 0]),
  keywords: objectFreeze(['TEXT', 1, "''", 0, 0]),
  importance: objectFreeze(['REAL', 1, '0.5', 0, 0]),
  valid_from: objectFreeze(['TEXT', 1, null, 0, 0]),
  valid_until: objectFreeze(['TEXT', 0, null, 0, 0]),
  access_count: objectFreeze(['INTEGER', 1, '0', 0, 0]),
  last_accessed: objectFreeze(['TEXT', 0, null, 0, 0]),
  created_at: objectFreeze(['TEXT', 1, null, 0, 0]),
  shared: objectFreeze(['INTEGER', 1, '0', 0, 0]),
  confidence: objectFreeze(['REAL', 1, '0.5', 0, 0]),
  acquisition_mode: objectFreeze(['TEXT', 1, "'direct'", 0, 0]),
  created_by_pipeline: objectFreeze(['INTEGER', 1, '0', 0, 0]),
  fictional: objectFreeze(['INTEGER', 1, '0', 0, 0]),
  last_decayed_at: objectFreeze(['TEXT', 0, null, 0, 0]),
  source_message_id: objectFreeze(['TEXT', 0, null, 0, 0]),
  content_hash: objectFreeze(['TEXT', 1, null, 0, 0]),
  source_kind: objectFreeze(['TEXT', 0, null, 0, 0]),
  extractor: objectFreeze(['TEXT', 0, null, 0, 0]),
})

const MEMORY_PHYSICAL_ORDERS = objectFreeze([
  objectFreeze([...CANONICAL_MEMORY_KEYS]),
  objectFreeze([
    ...reflectApply(arraySlice, CANONICAL_MEMORY_KEYS, [0, 16]),
    'fictional', 'source_message_id', 'content_hash', 'last_decayed_at',
    'source_kind', 'extractor',
  ]),
  objectFreeze([
    ...reflectApply(arraySlice, CANONICAL_MEMORY_KEYS, [0, 16]),
    'source_message_id', 'content_hash', 'fictional', 'last_decayed_at',
    'source_kind', 'extractor',
  ]),
])

const TABLE_XINFO_MANIFEST = objectFreeze({
  memory_migrations: objectFreeze([
    objectFreeze(['id', 'TEXT', 0, null, 1, 0]),
    objectFreeze(['applied_at', 'TEXT', 1, null, 0, 0]),
  ]),
  memory_links: objectFreeze([
    objectFreeze(['id', 'TEXT', 0, null, 1, 0]),
    objectFreeze(['from_memory_id', 'TEXT', 1, null, 0, 0]),
    objectFreeze(['to_memory_id', 'TEXT', 1, null, 0, 0]),
    objectFreeze(['relation', 'TEXT', 1, "'associated'", 0, 0]),
    objectFreeze(['created_at', 'TEXT', 1, null, 0, 0]),
  ]),
  memory_fts: objectFreeze([
    objectFreeze(['memory_id', '', 0, null, 0, 0]),
    objectFreeze(['palari_id', '', 0, null, 0, 0]),
    objectFreeze(['content', '', 0, null, 0, 0]),
    objectFreeze(['keywords', '', 0, null, 0, 0]),
    objectFreeze(['memory_fts', '', 0, null, 0, 1]),
    objectFreeze(['rank', '', 0, null, 0, 1]),
  ]),
  memory_fts_config: objectFreeze([
    objectFreeze(['k', '', 1, null, 1, 0]),
    objectFreeze(['v', '', 0, null, 0, 0]),
  ]),
  memory_fts_content: objectFreeze([
    objectFreeze(['id', 'INTEGER', 0, null, 1, 0]),
    objectFreeze(['c0', '', 0, null, 0, 0]),
    objectFreeze(['c1', '', 0, null, 0, 0]),
    objectFreeze(['c2', '', 0, null, 0, 0]),
    objectFreeze(['c3', '', 0, null, 0, 0]),
  ]),
  memory_fts_data: objectFreeze([
    objectFreeze(['id', 'INTEGER', 0, null, 1, 0]),
    objectFreeze(['block', 'BLOB', 0, null, 0, 0]),
  ]),
  memory_fts_docsize: objectFreeze([
    objectFreeze(['id', 'INTEGER', 0, null, 1, 0]),
    objectFreeze(['sz', 'BLOB', 0, null, 0, 0]),
  ]),
  memory_fts_idx: objectFreeze([
    objectFreeze(['segid', '', 1, null, 1, 0]),
    objectFreeze(['term', '', 1, null, 2, 0]),
    objectFreeze(['pgno', '', 0, null, 0, 0]),
  ]),
})

const CDX_SCHEMA_NAMES = objectFreeze([
  'memory_migrations',
  'memories',
  'memory_links',
  'memory_fts',
  'memory_fts_config',
  'memory_fts_content',
  'memory_fts_data',
  'memory_fts_docsize',
  'memory_fts_idx',
  'memories_scope_idx',
  'memories_content_hash_idx',
  'memory_links_from_idx',
  'memory_links_to_idx',
  'sqlite_autoindex_memory_migrations_1',
  'sqlite_autoindex_memories_1',
  'sqlite_autoindex_memory_links_1',
  'memories_ai',
  'memories_ad',
  'memories_au',
])
const cdxSchemaNameSet = new nativeSet(CDX_SCHEMA_NAMES)
const cdxSchemaFoldedSet = new nativeSet()
for (let index = 0; index < CDX_SCHEMA_NAMES.length; index += 1) {
  reflectApply(setAdd, cdxSchemaFoldedSet, [asciiFold(CDX_SCHEMA_NAMES[index])])
}
const CDX_TABLE_NAMES = objectFreeze([
  'memory_migrations',
  'memories',
  'memory_links',
  'memory_fts',
  'memory_fts_config',
  'memory_fts_content',
  'memory_fts_data',
  'memory_fts_docsize',
  'memory_fts_idx',
])
const cdxTableNameSet = new nativeSet(CDX_TABLE_NAMES)

const B1_TRIGGER_SQL = (() => {
  const result = new nativeMap()
  for (let index = 0; index < MEMORY_BUNDLE_OBJECTS.length; index += 1) {
    const object = MEMORY_BUNDLE_OBJECTS[index]
    if (object.type !== 'trigger') continue
    reflectApply(mapSet, result, [
      object.name,
      normalizeMemoryBundleSql(object.persistedSql),
    ])
  }
  return result
})()

const B1_TRIGGER_TARGETS = (() => {
  const result = new nativeMap()
  for (let index = 0; index < MEMORY_BUNDLE_TRIGGER_TARGETS.length; index += 1) {
    const target = MEMORY_BUNDLE_TRIGGER_TARGETS[index]
    reflectApply(mapSet, result, [target.name, target.table])
  }
  return result
})()

const B2_ASSOCIATED_NAME_SET = new nativeSet()
for (let index = 0; index < CDX_B2_MANIFEST.caseFoldedNames.length; index += 1) {
  reflectApply(setAdd, B2_ASSOCIATED_NAME_SET, [
    CDX_B2_MANIFEST.caseFoldedNames[index],
  ])
}
const B2_TABLE_NAMES = objectFreeze([
  'cdx_b2_meta',
  'cdx_b2_legacy_checkpoint',
  'cdx_b2_decisions',
  'cdx_b2_effects',
])
const B2_TABLE_NAME_SET = new nativeSet()
for (let index = 0; index < B2_TABLE_NAMES.length; index += 1) {
  reflectApply(setAdd, B2_TABLE_NAME_SET, [B2_TABLE_NAMES[index]])
}

const B2_TRIGGER_SQL = (() => {
  const result = new nativeMap()
  for (let index = 0; index < CDX_B2_MANIFEST.objects.length; index += 1) {
    const object = CDX_B2_MANIFEST.objects[index]
    if (object.type !== 'trigger') continue
    reflectApply(mapSet, result, [object.name, object.persistedSql])
  }
  return result
})()

const B2_TRIGGER_TARGETS = (() => {
  const result = new nativeMap()
  for (let index = 0; index < CDX_B2_MANIFEST.triggerTargets.length; index += 1) {
    const target = CDX_B2_MANIFEST.triggerTargets[index]
    reflectApply(mapSet, result, [target.name, target.table])
  }
  return result
})()

function hasColumn(db, name) {
  const rows = readRows(db, 'PRAGMA main.table_xinfo(memories)')
  for (let index = 0; index < rows.length; index += 1) {
    if (rows[index].name === name) return true
  }
  return false
}

function completeA2Schema(db) {
  execDatabase(db, CDX_M0_SCHEMA_SQL)
  const additions = [
    ['fictional', 'ALTER TABLE main.memories ADD COLUMN fictional INTEGER NOT NULL DEFAULT 0 CHECK (fictional IN (0, 1))'],
    ['last_decayed_at', 'ALTER TABLE main.memories ADD COLUMN last_decayed_at TEXT'],
    ['source_kind', 'ALTER TABLE main.memories ADD COLUMN source_kind TEXT'],
    ['extractor', 'ALTER TABLE main.memories ADD COLUMN extractor TEXT'],
  ]
  for (let index = 0; index < additions.length; index += 1) {
    if (!hasColumn(db, additions[index][0])) {
      execDatabase(db, additions[index][1])
    }
  }
  runStatement(
    db,
    'INSERT OR IGNORE INTO main.memory_migrations(id, applied_at) VALUES (?, ?)',
    ['CDX-M0', nativeIsoNow()],
  )
  runStatement(
    db,
    'INSERT OR IGNORE INTO main.memory_migrations(id, applied_at) VALUES (?, ?)',
    ['CDX-M1', nativeIsoNow()],
  )
}

function verifyXinfoRows(rows, expected) {
  if (rows.length !== expected.length) return false
  for (let index = 0; index < expected.length; index += 1) {
    const row = rows[index]
    const tuple = expected[index]
    if (
      row.cid !== index ||
      row.name !== tuple[0] ||
      row.type !== tuple[1] ||
      row.notnull !== tuple[2] ||
      !valuesEqual(row.dflt_value, tuple[3]) ||
      row.pk !== tuple[4] ||
      row.hidden !== tuple[5]
    ) return false
  }
  return true
}

function verifyMemoryXinfo(rows) {
  for (
    let orderIndex = 0;
    orderIndex < MEMORY_PHYSICAL_ORDERS.length;
    orderIndex += 1
  ) {
    const order = MEMORY_PHYSICAL_ORDERS[orderIndex]
    if (rows.length !== order.length) continue
    let matches = true
    for (let index = 0; index < order.length; index += 1) {
      const row = rows[index]
      const name = order[index]
      const descriptor = MEMORY_COLUMN_DESCRIPTOR[name]
      if (
        row.cid !== index ||
        row.name !== name ||
        row.type !== descriptor[0] ||
        row.notnull !== descriptor[1] ||
        !valuesEqual(row.dflt_value, descriptor[2]) ||
        row.pk !== descriptor[3] ||
        row.hidden !== descriptor[4]
      ) {
        matches = false
        break
      }
    }
    if (matches) return orderIndex
  }
  return -1
}

function normalizeA2Sql(value) {
  if (typeof value !== 'string') return null
  return normalizeMemoryBundleSql(value)
}

function verifyRequiredPragmas(db) {
  for (let index = 0; index < CDX_B2_REQUIRED_PRAGMAS.length; index += 1) {
    const policy = CDX_B2_REQUIRED_PRAGMAS[index]
    if (readScalar(db, policy.readSql) !== policy.value) {
      throw governedFailure('governance_config_invalid')
    }
  }
}

function expectedTrigger(name, includeB2) {
  if (name === 'memories_ai' || name === 'memories_ad' || name === 'memories_au') {
    return {
      sql: normalizeA2Sql(PERSISTED_SQL[name]),
      table: 'memories',
      normalizer: normalizeA2Sql,
    }
  }
  const b1Sql = reflectApply(mapGet, B1_TRIGGER_SQL, [name])
  const b1Table = reflectApply(mapGet, B1_TRIGGER_TARGETS, [name])
  if (b1Sql !== undefined && b1Table !== undefined) {
    return { sql: b1Sql, table: b1Table, normalizer: normalizeA2Sql }
  }
  if (includeB2) {
    const b2Sql = reflectApply(mapGet, B2_TRIGGER_SQL, [name])
    const b2Table = reflectApply(mapGet, B2_TRIGGER_TARGETS, [name])
    if (b2Sql !== undefined && b2Table !== undefined) {
      return { sql: b2Sql, table: b2Table, normalizer: normalizeCdxB2Sql }
    }
  }
  return null
}

function verifyTriggerInventory(db, includeB2) {
  if (
    readRows(
      db,
      "SELECT name FROM temp.sqlite_schema WHERE type = 'trigger'",
    ).length !== 0
  ) throw governedFailure('governance_schema_invalid')
  const rows = readRows(db, `
    SELECT name, tbl_name, sql
    FROM main.sqlite_schema
    WHERE type = 'trigger'
    ORDER BY name COLLATE BINARY
  `)
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    const expected = expectedTrigger(row.name, includeB2)
    if (
      expected === null ||
      row.tbl_name !== expected.table ||
      expected.normalizer(row.sql) !== expected.sql
    ) throw governedFailure('governance_schema_invalid')
  }
}

function schemaRowMap(rows) {
  const result = new nativeMap()
  for (let index = 0; index < rows.length; index += 1) {
    reflectApply(mapSet, result, [rows[index].name, rows[index]])
  }
  return result
}

function verifyA2StoredObject(row, expectedType, expectedTable, expectedSql) {
  if (
    row === undefined ||
    row.type !== expectedType ||
    row.tbl_name !== expectedTable ||
    normalizeA2Sql(row.sql) !== normalizeA2Sql(expectedSql)
  ) throw governedFailure('governance_schema_invalid')
}

function verifyA2SchemaInventory(db, includeB2) {
  const rows = readRows(db, `
    SELECT type, name, tbl_name, sql
    FROM main.sqlite_schema
    ORDER BY name COLLATE BINARY
  `)
  const byName = schemaRowMap(rows)
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    const folded = asciiFold(row.name)
    if (
      reflectApply(setHas, cdxSchemaFoldedSet, [folded]) &&
      !reflectApply(setHas, cdxSchemaNameSet, [row.name])
    ) throw governedFailure('governance_schema_invalid')
    if (
      folded !== null &&
      reflectApply(stringStartsWith, folded, ['memory_fts_']) &&
      !reflectApply(setHas, cdxSchemaNameSet, [row.name])
    ) throw governedFailure('governance_schema_invalid')
    if (
      row.type === 'index' &&
      reflectApply(setHas, cdxTableNameSet, [row.tbl_name]) &&
      !reflectApply(setHas, cdxSchemaNameSet, [row.name])
    ) throw governedFailure('governance_schema_invalid')
  }

  verifyA2StoredObject(
    reflectApply(mapGet, byName, ['memory_migrations']),
    'table',
    'memory_migrations',
    PERSISTED_SQL.memory_migrations,
  )
  verifyA2StoredObject(
    reflectApply(mapGet, byName, ['memory_links']),
    'table',
    'memory_links',
    PERSISTED_SQL.memory_links,
  )

  const memoryRow = reflectApply(mapGet, byName, ['memories'])
  if (
    memoryRow === undefined ||
    memoryRow.type !== 'table' ||
    memoryRow.tbl_name !== 'memories'
  ) throw governedFailure('governance_schema_invalid')
  const normalizedMemorySql = normalizeA2Sql(memoryRow.sql)
  let memorySqlVariant = -1
  for (let index = 0; index < MEMORIES_SQL_VARIANTS.length; index += 1) {
    if (normalizedMemorySql === normalizeA2Sql(MEMORIES_SQL_VARIANTS[index])) {
      memorySqlVariant = index
      break
    }
  }
  if (memorySqlVariant === -1) throw governedFailure('governance_schema_invalid')

  const exactObjects = [
    ['memories_scope_idx', 'index', 'memories'],
    ['memories_content_hash_idx', 'index', 'memories'],
    ['memory_links_from_idx', 'index', 'memory_links'],
    ['memory_links_to_idx', 'index', 'memory_links'],
    ['memory_fts', 'table', 'memory_fts'],
    ['memory_fts_config', 'table', 'memory_fts_config'],
    ['memory_fts_content', 'table', 'memory_fts_content'],
    ['memory_fts_data', 'table', 'memory_fts_data'],
    ['memory_fts_docsize', 'table', 'memory_fts_docsize'],
    ['memory_fts_idx', 'table', 'memory_fts_idx'],
    ['memories_ai', 'trigger', 'memories'],
    ['memories_ad', 'trigger', 'memories'],
    ['memories_au', 'trigger', 'memories'],
  ]
  for (let index = 0; index < exactObjects.length; index += 1) {
    const tuple = exactObjects[index]
    verifyA2StoredObject(
      reflectApply(mapGet, byName, [tuple[0]]),
      tuple[1],
      tuple[2],
      PERSISTED_SQL[tuple[0]],
    )
  }

  const autoindexes = [
    ['sqlite_autoindex_memory_migrations_1', 'memory_migrations'],
    ['sqlite_autoindex_memories_1', 'memories'],
    ['sqlite_autoindex_memory_links_1', 'memory_links'],
  ]
  for (let index = 0; index < autoindexes.length; index += 1) {
    const tuple = autoindexes[index]
    const row = reflectApply(mapGet, byName, [tuple[0]])
    if (
      row === undefined ||
      row.type !== 'index' ||
      row.tbl_name !== tuple[1] ||
      row.sql !== null
    ) throw governedFailure('governance_schema_invalid')
  }

  verifyTriggerInventory(db, includeB2)

  const memoryXinfo = readRows(db, 'PRAGMA main.table_xinfo(memories)')
  const xinfoVariant = verifyMemoryXinfo(memoryXinfo)
  if (xinfoVariant === -1 || xinfoVariant !== memorySqlVariant) {
    throw governedFailure('governance_schema_invalid')
  }
  const xinfoTables = objectKeys(TABLE_XINFO_MANIFEST)
  for (let index = 0; index < xinfoTables.length; index += 1) {
    const table = xinfoTables[index]
    if (!verifyXinfoRows(
      readRows(db, `PRAGMA main.table_xinfo(${table})`),
      TABLE_XINFO_MANIFEST[table],
    )) throw governedFailure('governance_schema_invalid')
  }
  return { memoryVariant: memorySqlVariant, memoryXinfo }
}

function indexListMap(db, table) {
  const rows = readRows(db, `PRAGMA main.index_list(${table})`)
  const result = new nativeMap()
  for (let index = 0; index < rows.length; index += 1) {
    reflectApply(mapSet, result, [rows[index].name, rows[index]])
  }
  return { map: result, rows }
}

function verifyIndexList(db, table, expected) {
  const actual = indexListMap(db, table)
  if (actual.rows.length !== expected.length) {
    throw governedFailure('governance_schema_invalid')
  }
  for (let index = 0; index < expected.length; index += 1) {
    const tuple = expected[index]
    const row = reflectApply(mapGet, actual.map, [tuple[0]])
    if (
      row === undefined ||
      row.unique !== tuple[1] ||
      row.origin !== tuple[2] ||
      row.partial !== tuple[3]
    ) throw governedFailure('governance_schema_invalid')
  }
}

function verifyIndexXinfo(db, name, expected) {
  const rows = readRows(db, `PRAGMA main.index_xinfo(${name})`)
  if (rows.length !== expected.length) {
    throw governedFailure('governance_schema_invalid')
  }
  for (let index = 0; index < expected.length; index += 1) {
    const row = rows[index]
    const tuple = expected[index]
    if (
      row.seqno !== index ||
      row.cid !== tuple[0] ||
      row.name !== tuple[1] ||
      row.desc !== tuple[2] ||
      row.coll !== tuple[3] ||
      row.key !== tuple[4]
    ) throw governedFailure('governance_schema_invalid')
  }
}

function indexRows(...columns) {
  const rows = []
  for (let index = 0; index < columns.length; index += 1) {
    appendValue(rows, [columns[index][0], columns[index][1], 0, 'BINARY', 1])
  }
  appendValue(rows, [-1, null, 0, 'BINARY', 0])
  return rows
}

function verifyA2Indexes(db, memoryXinfo) {
  verifyIndexList(db, 'memory_migrations', [
    ['sqlite_autoindex_memory_migrations_1', 1, 'pk', 0],
  ])
  verifyIndexList(db, 'memories', [
    ['memories_content_hash_idx', 0, 'c', 0],
    ['memories_scope_idx', 0, 'c', 0],
    ['sqlite_autoindex_memories_1', 1, 'pk', 0],
  ])
  verifyIndexList(db, 'memory_links', [
    ['memory_links_to_idx', 0, 'c', 0],
    ['memory_links_from_idx', 0, 'c', 0],
    ['sqlite_autoindex_memory_links_1', 1, 'pk', 0],
  ])
  verifyIndexList(db, 'memory_fts', [])
  verifyIndexList(db, 'memory_fts_content', [])
  verifyIndexList(db, 'memory_fts_data', [])
  verifyIndexList(db, 'memory_fts_docsize', [])
  verifyIndexList(db, 'memory_fts_config', [
    ['sqlite_autoindex_memory_fts_config_1', 1, 'pk', 0],
  ])
  verifyIndexList(db, 'memory_fts_idx', [
    ['sqlite_autoindex_memory_fts_idx_1', 1, 'pk', 0],
  ])

  const cid = new nativeMap()
  for (let index = 0; index < memoryXinfo.length; index += 1) {
    reflectApply(mapSet, cid, [memoryXinfo[index].name, memoryXinfo[index].cid])
  }
  verifyIndexXinfo(db, 'memories_scope_idx', indexRows(
    [reflectApply(mapGet, cid, ['palari_id']), 'palari_id'],
    [reflectApply(mapGet, cid, ['user_id']), 'user_id'],
    [reflectApply(mapGet, cid, ['shared']), 'shared'],
    [reflectApply(mapGet, cid, ['valid_until']), 'valid_until'],
    [reflectApply(mapGet, cid, ['type']), 'type'],
  ))
  verifyIndexXinfo(db, 'memories_content_hash_idx', indexRows(
    [reflectApply(mapGet, cid, ['palari_id']), 'palari_id'],
    [reflectApply(mapGet, cid, ['content_hash']), 'content_hash'],
  ))
  verifyIndexXinfo(db, 'sqlite_autoindex_memories_1', indexRows([0, 'id']))
  verifyIndexXinfo(db, 'memory_links_from_idx', indexRows([1, 'from_memory_id']))
  verifyIndexXinfo(db, 'memory_links_to_idx', indexRows([2, 'to_memory_id']))
  verifyIndexXinfo(db, 'sqlite_autoindex_memory_links_1', indexRows([0, 'id']))
  verifyIndexXinfo(db, 'sqlite_autoindex_memory_migrations_1', indexRows([0, 'id']))
  verifyIndexXinfo(db, 'sqlite_autoindex_memory_fts_config_1', [
    [0, 'k', 0, 'BINARY', 1],
    [1, 'v', 0, 'BINARY', 0],
  ])
  verifyIndexXinfo(db, 'sqlite_autoindex_memory_fts_idx_1', [
    [0, 'segid', 0, 'BINARY', 1],
    [1, 'term', 0, 'BINARY', 1],
    [2, 'pgno', 0, 'BINARY', 0],
  ])
}

function verifyA2ForeignKeys(db) {
  const links = readRows(db, 'PRAGMA main.foreign_key_list(memory_links)')
  if (links.length !== 2) throw governedFailure('governance_schema_invalid')
  const seen = new nativeSet()
  for (let index = 0; index < links.length; index += 1) {
    const row = links[index]
    if (
      row.table !== 'memories' ||
      row.to !== 'id' ||
      row.on_update !== 'NO ACTION' ||
      row.on_delete !== 'CASCADE' ||
      row.match !== 'NONE' ||
      (row.from !== 'from_memory_id' && row.from !== 'to_memory_id')
    ) throw governedFailure('governance_schema_invalid')
    reflectApply(setAdd, seen, [row.from])
  }
  if (
    !reflectApply(setHas, seen, ['from_memory_id']) ||
    !reflectApply(setHas, seen, ['to_memory_id'])
  ) throw governedFailure('governance_schema_invalid')

  const ordinaryTables = readRows(db, `
    SELECT name FROM main.sqlite_schema
    WHERE type = 'table'
    ORDER BY name COLLATE BINARY
  `)
  for (let index = 0; index < ordinaryTables.length; index += 1) {
    const table = ordinaryTables[index].name
    const fks = readRows(
      db,
      'SELECT "table" FROM pragma_foreign_key_list(?, ?)',
      [table, 'main'],
    )
    if (
      table !== 'memory_links' &&
      reflectApply(setHas, cdxTableNameSet, [table]) &&
      fks.length !== 0
    ) throw governedFailure('governance_schema_invalid')
    for (let fkIndex = 0; fkIndex < fks.length; fkIndex += 1) {
      if (
        table !== 'memory_links' &&
        reflectApply(setHas, cdxTableNameSet, [fks[fkIndex].table])
      ) throw governedFailure('governance_schema_invalid')
    }
  }
}

function verifyMigrations(db, includeB2, checkpointAt = undefined) {
  const rows = readRows(db, `
    SELECT id, applied_at, typeof(applied_at) AS applied_type
    FROM main.memory_migrations
    ORDER BY id COLLATE BINARY
  `)
  const expectedLength = includeB2 ? 3 : 2
  if (
    rows.length !== expectedLength ||
    (
      includeB2 &&
      (
        rows[0].id !== 'CDX-B2' ||
        rows[1].id !== 'CDX-M0' ||
        rows[2].id !== 'CDX-M1'
      )
    ) ||
    (
      !includeB2 &&
      (rows[0].id !== 'CDX-M0' || rows[1].id !== 'CDX-M1')
    )
  ) throw governedFailure('governance_migration_invalid')
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    if (row.applied_type !== 'text' || !isCanonicalTimestamp(row.applied_at)) {
      throw governedFailure('governance_migration_invalid')
    }
  }
  if (includeB2 && checkpointAt !== undefined && rows[0].applied_at !== checkpointAt) {
    throw governedFailure('governance_migration_invalid')
  }
}

function verifyA2DataShapes(db) {
  const invalidMemory = readRow(db, `
    SELECT id FROM main.memories
    WHERE typeof(id) <> 'text'
       OR typeof(palari_id) <> 'text'
       OR typeof(type) <> 'text'
       OR typeof(content) <> 'text'
       OR typeof(keywords) <> 'text'
       OR typeof(valid_from) <> 'text'
       OR typeof(created_at) <> 'text'
       OR typeof(content_hash) <> 'text'
       OR typeof(acquisition_mode) <> 'text'
       OR (user_id IS NOT NULL AND typeof(user_id) <> 'text')
       OR (valid_until IS NOT NULL AND typeof(valid_until) <> 'text')
       OR (last_accessed IS NOT NULL AND typeof(last_accessed) <> 'text')
       OR (last_decayed_at IS NOT NULL AND typeof(last_decayed_at) <> 'text')
       OR (source_message_id IS NOT NULL AND typeof(source_message_id) <> 'text')
       OR (source_kind IS NOT NULL AND typeof(source_kind) <> 'text')
       OR (extractor IS NOT NULL AND typeof(extractor) <> 'text')
       OR typeof(importance) NOT IN ('integer','real')
       OR NOT (importance >= -1.7976931348623157e308 AND importance <= 1.7976931348623157e308)
       OR typeof(confidence) NOT IN ('integer','real')
       OR NOT (confidence >= -1.7976931348623157e308 AND confidence <= 1.7976931348623157e308)
       OR typeof(access_count) <> 'integer'
       OR access_count < 0 OR access_count > 9007199254740991
       OR typeof(shared) <> 'integer' OR shared NOT IN (0,1)
       OR typeof(created_by_pipeline) <> 'integer' OR created_by_pipeline NOT IN (0,1)
       OR typeof(fictional) <> 'integer' OR fictional NOT IN (0,1)
       OR type NOT IN (
         'relationship','preference','opinion','entity','life_event',
         'working','project','recent_life','session_summary'
       )
       OR acquisition_mode NOT IN ('direct','told_to_me','extracted','summarized')
    LIMIT 1
  `)
  if (invalidMemory !== null) throw governedFailure('governance_schema_invalid')

  const invalidLink = readRow(db, `
    SELECT id FROM main.memory_links
    WHERE typeof(id) <> 'text'
       OR typeof(from_memory_id) <> 'text'
       OR typeof(to_memory_id) <> 'text'
       OR typeof(relation) <> 'text'
       OR typeof(created_at) <> 'text'
       OR from_memory_id = to_memory_id
    LIMIT 1
  `)
  if (invalidLink !== null) throw governedFailure('governance_schema_invalid')
}

function verifyQuickCheck(db) {
  const quick = readRows(db, 'PRAGMA main.quick_check')
  if (
    quick.length !== 1 ||
    reflectOwnKeys(quick[0]).length !== 1 ||
    quick[0][reflectOwnKeys(quick[0])[0]] !== 'ok'
  ) throw governedFailure('governance_schema_invalid')
}

function verifyA2ProjectionParity(db) {
  if (
    readRows(db, 'PRAGMA main.foreign_key_check(memory_links)').length !== 0
  ) throw governedFailure('governance_projection_invalid')
  if (readRows(db, `
    SELECT rowid, id, palari_id, content, keywords FROM main.memories
    EXCEPT
    SELECT rowid, memory_id, palari_id, content, keywords FROM main.memory_fts
  `).length !== 0) throw governedFailure('governance_projection_invalid')
  if (readRows(db, `
    SELECT rowid, memory_id, palari_id, content, keywords FROM main.memory_fts
    EXCEPT
    SELECT rowid, id, palari_id, content, keywords FROM main.memories
  `).length !== 0) throw governedFailure('governance_projection_invalid')
}

function verifyA2Manifest(
  db,
  includeB2,
  includeMigration = true,
  includeProjection = true,
) {
  verifyRequiredPragmas(db)
  const inventory = verifyA2SchemaInventory(db, includeB2)
  verifyA2Indexes(db, inventory.memoryXinfo)
  verifyA2ForeignKeys(db)
  if (includeMigration) verifyMigrations(db, includeB2)
  verifyA2DataShapes(db)
  const configRows = readRows(db, 'SELECT k, v FROM main.memory_fts_config')
  if (
    configRows.length !== 1 ||
    configRows[0].k !== 'version' ||
    configRows[0].v !== 4
  ) throw governedFailure('governance_schema_invalid')
  if (includeProjection) {
    verifyQuickCheck(db)
    verifyA2ProjectionParity(db)
  }
  return inventory.memoryVariant
}

function isB2AssociatedName(name) {
  const folded = asciiFold(name)
  return (
    folded !== null &&
    (
      reflectApply(stringStartsWith, folded, ['cdx_b2_']) ||
      reflectApply(stringStartsWith, folded, ['sqlite_autoindex_cdx_b2_'])
    )
  )
}

function readSchemaRows(db) {
  return readRows(db, `
    SELECT type, name, tbl_name, sql
    FROM main.sqlite_schema
    ORDER BY name COLLATE BINARY
  `)
}

function readB2Markers(db, schemaRows) {
  let hasExactMigrationsTable = false
  for (let index = 0; index < schemaRows.length; index += 1) {
    const row = schemaRows[index]
    if (
      row.type === 'table' &&
      row.name === 'memory_migrations' &&
      row.tbl_name === 'memory_migrations'
    ) {
      hasExactMigrationsTable = true
      break
    }
  }
  if (!hasExactMigrationsTable) return []
  const rows = readRows(db, `
    SELECT id, applied_at, typeof(applied_at) AS applied_type
    FROM main.memory_migrations
    ORDER BY id COLLATE BINARY
  `)
  const markers = []
  for (let index = 0; index < rows.length; index += 1) {
    if (asciiFold(rows[index].id) === 'cdx-b2') appendValue(markers, rows[index])
  }
  return markers
}

function classifyB2State(db) {
  const schemaRows = readSchemaRows(db)
  let associatedCount = 0
  let exactAssociatedCount = 0
  for (let index = 0; index < schemaRows.length; index += 1) {
    if (isB2AssociatedName(schemaRows[index].name)) {
      associatedCount += 1
      if (
        reflectApply(setHas, B2_ASSOCIATED_NAME_SET, [schemaRows[index].name])
      ) exactAssociatedCount += 1
    }
  }
  const markers = readB2Markers(db, schemaRows)
  if (associatedCount === 0 && markers.length === 0) {
    return { kind: 'absent' }
  }
  if (associatedCount === 0) {
    throw governedFailure('governance_migration_invalid')
  }
  if (markers.length === 0) {
    if (
      associatedCount === CDX_B2_MANIFEST.caseFoldedNames.length &&
      exactAssociatedCount === associatedCount
    ) throw governedFailure('governance_migration_invalid')
    throw governedFailure('governance_schema_invalid')
  }
  if (markers.length !== 1 || markers[0].id !== 'CDX-B2') {
    throw governedFailure('governance_migration_invalid')
  }
  return { kind: 'complete-candidate' }
}

function compareManifestRows(actual, expected, fields, code = 'governance_schema_invalid') {
  if (actual.length !== expected.length) throw governedFailure(code)
  for (let index = 0; index < expected.length; index += 1) {
    for (let fieldIndex = 0; fieldIndex < fields.length; fieldIndex += 1) {
      const field = fields[fieldIndex]
      if (!valuesEqual(actual[index][field], expected[index][field])) {
        throw governedFailure(code)
      }
    }
  }
}

function verifyB2ObjectInventory(db) {
  const rows = readSchemaRows(db)
  const byName = schemaRowMap(rows)
  let associatedCount = 0
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    if (isB2AssociatedName(row.name)) {
      associatedCount += 1
      const folded = asciiFold(row.name)
      if (
        row.name !== folded ||
        !reflectApply(setHas, B2_ASSOCIATED_NAME_SET, [folded])
      ) throw governedFailure('governance_schema_invalid')
    }
    if (
      (row.type === 'index' || row.type === 'trigger') &&
      reflectApply(setHas, B2_TABLE_NAME_SET, [row.tbl_name]) &&
      !reflectApply(setHas, B2_ASSOCIATED_NAME_SET, [row.name])
    ) throw governedFailure('governance_schema_invalid')
  }
  if (
    associatedCount !==
      CDX_B2_MANIFEST.objects.length + CDX_B2_MANIFEST.autoindexes.length
  ) throw governedFailure('governance_schema_invalid')

  for (let index = 0; index < CDX_B2_MANIFEST.objects.length; index += 1) {
    const expected = CDX_B2_MANIFEST.objects[index]
    const row = reflectApply(mapGet, byName, [expected.name])
    if (
      row === undefined ||
      row.type !== expected.type ||
      row.tbl_name !== expected.table ||
      typeof row.sql !== 'string' ||
      normalizeCdxB2Sql(row.sql) !== expected.persistedSql
    ) throw governedFailure('governance_schema_invalid')
  }
  for (let index = 0; index < CDX_B2_MANIFEST.autoindexes.length; index += 1) {
    const expected = CDX_B2_MANIFEST.autoindexes[index]
    const row = reflectApply(mapGet, byName, [expected.name])
    if (
      row === undefined ||
      row.type !== 'index' ||
      row.tbl_name !== expected.table ||
      row.sql !== null
    ) throw governedFailure('governance_schema_invalid')
  }
}

function verifyB2Tables(db) {
  const tableList = readRows(db, 'PRAGMA main.table_list')
  const relevant = new nativeMap()
  for (let index = 0; index < tableList.length; index += 1) {
    const row = tableList[index]
    if (reflectApply(setHas, B2_TABLE_NAME_SET, [row.name])) {
      if (reflectApply(mapGet, relevant, [row.name]) !== undefined) {
        throw governedFailure('governance_schema_invalid')
      }
      reflectApply(mapSet, relevant, [row.name, row])
    }
  }
  for (let index = 0; index < CDX_B2_MANIFEST.tableXinfo.length; index += 1) {
    const expected = CDX_B2_MANIFEST.tableXinfo[index]
    const tableRow = reflectApply(mapGet, relevant, [expected.table])
    if (
      tableRow === undefined ||
      tableRow.schema !== 'main' ||
      tableRow.type !== 'table' ||
      tableRow.ncol !== expected.rows.length ||
      tableRow.wr !== expected.wr ||
      tableRow.strict !== expected.strict
    ) throw governedFailure('governance_schema_invalid')
    const xinfo = readRows(db, `PRAGMA main.table_xinfo(${expected.table})`)
    compareManifestRows(xinfo, expected.rows, [
      'cid', 'name', 'type', 'notnull', 'dflt_value', 'pk', 'hidden',
    ])
  }
  if (
    reflectApply(mapSize, relevant, []) !== CDX_B2_MANIFEST.tableXinfo.length
  ) {
    throw governedFailure('governance_schema_invalid')
  }
}

function verifyB2Indexes(db) {
  for (let index = 0; index < CDX_B2_MANIFEST.indexLists.length; index += 1) {
    const expected = CDX_B2_MANIFEST.indexLists[index]
    const rows = readRows(db, `PRAGMA main.index_list(${expected.table})`)
    compareManifestRows(rows, expected.rows, [
      'seq', 'name', 'unique', 'origin', 'partial',
    ])
  }
  for (let index = 0; index < CDX_B2_MANIFEST.indexXinfo.length; index += 1) {
    const expected = CDX_B2_MANIFEST.indexXinfo[index]
    const rows = readRows(db, `PRAGMA main.index_xinfo(${expected.name})`)
    compareManifestRows(rows, expected.rows, [
      'seqno', 'cid', 'name', 'desc', 'coll', 'key',
    ])
  }
}

function verifyB2ForeignKeys(db) {
  for (let index = 0; index < CDX_B2_MANIFEST.foreignKeys.length; index += 1) {
    const expected = CDX_B2_MANIFEST.foreignKeys[index]
    const rows = readRows(db, `PRAGMA main.foreign_key_list(${expected.table})`)
    compareManifestRows(rows, expected.rows, [
      'id', 'seq', 'table', 'from', 'to', 'on_update', 'on_delete', 'match',
    ])
  }

  const tables = readRows(db, `
    SELECT name FROM main.sqlite_schema
    WHERE type = 'table'
    ORDER BY name COLLATE BINARY
  `)
  for (let index = 0; index < tables.length; index += 1) {
    const table = tables[index].name
    const sourceIsB2 = reflectApply(setHas, B2_TABLE_NAME_SET, [table])
    const rows = readRows(
      db,
      'SELECT "table" FROM pragma_foreign_key_list(?, ?)',
      [table, 'main'],
    )
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const target = rows[rowIndex].table
      const targetFolded = asciiFold(target)
      const targetIsB2 = (
        reflectApply(setHas, B2_TABLE_NAME_SET, [target]) ||
        (
          targetFolded !== null &&
          reflectApply(stringStartsWith, targetFolded, ['cdx_b2_'])
        )
      )
      if (sourceIsB2 !== targetIsB2) {
        throw governedFailure('governance_schema_invalid')
      }
    }
  }
  if (readRows(db, 'PRAGMA main.foreign_key_check').length !== 0) {
    throw governedFailure('governance_schema_invalid')
  }
}

function verifyB2Layout(db) {
  verifyB2ObjectInventory(db)
  verifyTriggerInventory(db, true)
  verifyB2Tables(db)
  verifyB2Indexes(db)
  verifyB2ForeignKeys(db)
  verifyQuickCheck(db)
}

function isPrefixedUuidV4(value, prefix) {
  if (
    typeof value !== 'string' ||
    value.length !== 40 ||
    reflectApply(stringSlice, value, [0, 4]) !== prefix ||
    value[12] !== '-' ||
    value[17] !== '-' ||
    value[22] !== '-' ||
    value[27] !== '-' ||
    value[18] !== '4' ||
    !(
      value[23] === '8' ||
      value[23] === '9' ||
      value[23] === 'a' ||
      value[23] === 'b'
    )
  ) return false
  for (let index = 4; index < value.length; index += 1) {
    if (index === 12 || index === 17 || index === 22 || index === 27) continue
    const unit = reflectApply(stringCharCodeAt, value, [index])
    if (!(
      (unit >= 0x30 && unit <= 0x39) ||
      (unit >= 0x61 && unit <= 0x66)
    )) return false
  }
  return true
}

function verifyMeta(db, memoryVariant, expectedWorkspaceId = undefined) {
  const rows = readRows(db, `
    SELECT * FROM main.cdx_b2_meta
    ORDER BY singleton
  `)
  if (rows.length !== 1) throw governedFailure('governance_meta_invalid')
  const row = rows[0]
  const expectedVariant = `cdx_m1_order_${memoryVariant}`
  if (
    row.singleton !== 1 ||
    row.schema_version !== 'CDX-B2' ||
    row.kernel_profile !== 'FB1-4.ratified-erasure-apply-v1' ||
    row.projection_profile !== 'CDX-M1-runtime@1' ||
    row.authority_profile !== 'host-checked-external-grant-v1' ||
    !isPrefixedUuidV4(row.stream_id, 'b2s_') ||
    !numberIsSafeInteger(row.head_mutation_sequence) ||
    row.head_mutation_sequence < 0 ||
    !isWorkspaceId(row.workspace_id) ||
    (
      expectedWorkspaceId !== undefined &&
      row.workspace_id !== expectedWorkspaceId
    ) ||
    !isPrefixedUuidV4(row.checkpoint_id, 'b2c_') ||
    !isCanonicalTimestamp(row.checkpoint_at) ||
    !numberIsSafeInteger(row.checkpoint_memory_count) ||
    row.checkpoint_memory_count < 0 ||
    !numberIsSafeInteger(row.checkpoint_link_count) ||
    row.checkpoint_link_count < 0 ||
    row.checkpoint_memory_count >
      numberMaxSafeInteger - row.checkpoint_link_count ||
    row.baseline_disposition !== 'unadjudicated' ||
    row.legacy_schema_variant !== expectedVariant ||
    row.kernel_version !== 'FB1-4.patch-kernel-v1' ||
    row.kernel_source_commit !== 'c9af823c7dee29d29fd937d44527f3b78d8d3845' ||
    row.kernel_source_blob !== 'df4de5f00ae88ba670305f9b2bb699441cc5b234'
  ) throw governedFailure('governance_meta_invalid')
  if (row.kernel_config_hash !== CDX_B2_KERNEL_CONFIG_HASH) {
    throw governedFailure('governance_config_invalid')
  }
  if (row.head_mutation_sequence !== 0) {
    throw governedFailure('governance_journal_invalid')
  }
  return row
}

const MEMORY_TYPES = objectFreeze([
  'relationship',
  'preference',
  'opinion',
  'entity',
  'life_event',
  'working',
  'project',
  'recent_life',
  'session_summary',
])
const MEMORY_TYPE_SET = new nativeSet()
for (let index = 0; index < MEMORY_TYPES.length; index += 1) {
  reflectApply(setAdd, MEMORY_TYPE_SET, [MEMORY_TYPES[index]])
}

function isNullableString(value) {
  return value === null || typeof value === 'string'
}

function readCheckpointRows(db) {
  return readRows(db, `
    SELECT
      checkpoint_ordinal,
      stream_id,
      entity_kind,
      entity_id,
      palari_id,
      user_id,
      memory_type,
      shared,
      validity_state,
      from_memory_id,
      to_memory_id
    FROM main.cdx_b2_legacy_checkpoint
    ORDER BY checkpoint_ordinal
  `)
}

function verifyCheckpoint(db, meta) {
  const rows = readCheckpointRows(db)
  const expectedCount =
    meta.checkpoint_memory_count + meta.checkpoint_link_count
  if (rows.length !== expectedCount) {
    throw governedFailure('governance_checkpoint_invalid')
  }

  const memoryIds = new nativeSet()
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    if (
      row.checkpoint_ordinal !== index + 1 ||
      row.stream_id !== meta.stream_id ||
      typeof row.entity_id !== 'string'
    ) throw governedFailure('governance_checkpoint_invalid')
    if (index < meta.checkpoint_memory_count) {
      if (
        row.entity_kind !== 'memory' ||
        typeof row.palari_id !== 'string' ||
        !isNullableString(row.user_id) ||
        !reflectApply(setHas, MEMORY_TYPE_SET, [row.memory_type]) ||
        (row.shared !== 0 && row.shared !== 1) ||
        (row.validity_state !== 'current' && row.validity_state !== 'ended') ||
        row.from_memory_id !== null ||
        row.to_memory_id !== null
      ) throw governedFailure('governance_checkpoint_invalid')
      reflectApply(setAdd, memoryIds, [row.entity_id])
    } else if (
      row.entity_kind !== 'link' ||
      row.palari_id !== null ||
      row.user_id !== null ||
      row.memory_type !== null ||
      row.shared !== null ||
      row.validity_state !== null ||
      typeof row.from_memory_id !== 'string' ||
      typeof row.to_memory_id !== 'string' ||
      row.from_memory_id === row.to_memory_id
    ) throw governedFailure('governance_checkpoint_invalid')
  }

  for (
    let index = meta.checkpoint_memory_count;
    index < rows.length;
    index += 1
  ) {
    const row = rows[index]
    if (
      !reflectApply(setHas, memoryIds, [row.from_memory_id]) ||
      !reflectApply(setHas, memoryIds, [row.to_memory_id])
    ) throw governedFailure('governance_checkpoint_invalid')
  }

  const memoryOrder = readRows(db, `
    SELECT checkpoint_ordinal, entity_id
    FROM main.cdx_b2_legacy_checkpoint
    WHERE entity_kind = 'memory'
    ORDER BY entity_id COLLATE BINARY
  `)
  if (memoryOrder.length !== meta.checkpoint_memory_count) {
    throw governedFailure('governance_checkpoint_invalid')
  }
  for (let index = 0; index < memoryOrder.length; index += 1) {
    if (memoryOrder[index].checkpoint_ordinal !== index + 1) {
      throw governedFailure('governance_checkpoint_invalid')
    }
  }
  const linkOrder = readRows(db, `
    SELECT checkpoint_ordinal, entity_id
    FROM main.cdx_b2_legacy_checkpoint
    WHERE entity_kind = 'link'
    ORDER BY entity_id COLLATE BINARY
  `)
  if (linkOrder.length !== meta.checkpoint_link_count) {
    throw governedFailure('governance_checkpoint_invalid')
  }
  for (let index = 0; index < linkOrder.length; index += 1) {
    if (
      linkOrder[index].checkpoint_ordinal !==
        meta.checkpoint_memory_count + index + 1
    ) throw governedFailure('governance_checkpoint_invalid')
  }
  return rows
}

function verifyEmptyJournal(db) {
  if (readRows(db, 'SELECT sequence FROM main.cdx_b2_decisions').length !== 0) {
    throw governedFailure('governance_journal_invalid')
  }
  if (
    readRows(
      db,
      'SELECT decision_sequence FROM main.cdx_b2_effects',
    ).length !== 0
  ) throw governedFailure('governance_journal_invalid')
}

function verifyCheckpointProjection(db, meta, checkpointRows) {
  const memories = readRows(db, `
    SELECT
      id AS entity_id,
      palari_id,
      user_id,
      type AS memory_type,
      shared,
      CASE WHEN valid_until IS NULL THEN 'current' ELSE 'ended' END
        AS validity_state
    FROM main.memories
    ORDER BY id COLLATE BINARY
  `)
  const links = readRows(db, `
    SELECT
      id AS entity_id,
      from_memory_id,
      to_memory_id
    FROM main.memory_links
    ORDER BY id COLLATE BINARY
  `)
  if (
    memories.length !== meta.checkpoint_memory_count ||
    links.length !== meta.checkpoint_link_count
  ) throw governedFailure('governance_projection_invalid')
  for (let index = 0; index < memories.length; index += 1) {
    const checkpoint = checkpointRows[index]
    const memory = memories[index]
    if (
      checkpoint.entity_kind !== 'memory' ||
      checkpoint.entity_id !== memory.entity_id ||
      checkpoint.palari_id !== memory.palari_id ||
      checkpoint.user_id !== memory.user_id ||
      checkpoint.memory_type !== memory.memory_type ||
      checkpoint.shared !== memory.shared ||
      checkpoint.validity_state !== memory.validity_state
    ) throw governedFailure('governance_projection_invalid')
  }
  for (let index = 0; index < links.length; index += 1) {
    const checkpoint = checkpointRows[meta.checkpoint_memory_count + index]
    const link = links[index]
    if (
      checkpoint.entity_kind !== 'link' ||
      checkpoint.entity_id !== link.entity_id ||
      checkpoint.from_memory_id !== link.from_memory_id ||
      checkpoint.to_memory_id !== link.to_memory_id
    ) throw governedFailure('governance_projection_invalid')
  }
  verifyA2ProjectionParity(db)
}

function frozenVerificationState(meta) {
  const state = objectCreate(null)
  const entries = [
    ['streamId', meta.stream_id],
    ['headMutationSequence', meta.head_mutation_sequence],
    ['lastObservedAt', null],
    ['authorityLedgerId', null],
    ['checkpointMemoryCount', meta.checkpoint_memory_count],
    ['checkpointLinkCount', meta.checkpoint_link_count],
  ]
  for (let index = 0; index < entries.length; index += 1) {
    reflectApply(reflectDefineProperty, undefined, [state, entries[index][0], {
      __proto__: null,
      value: entries[index][1],
      enumerable: true,
      configurable: false,
      writable: false,
    }])
  }
  return reflectApply(objectFreeze, undefined, [state])
}

function verifyTask3State(db, expectedWorkspaceId = undefined) {
  const memoryVariant = runGovernedPhase(
    'governance_schema_invalid',
    () => verifyA2Manifest(db, true, false, false),
  )
  runGovernedPhase('governance_schema_invalid', () => verifyB2Layout(db))
  const meta = runGovernedPhase(
    'governance_meta_invalid',
    () => verifyMeta(db, memoryVariant, expectedWorkspaceId),
  )
  runGovernedPhase(
    'governance_migration_invalid',
    () => verifyMigrations(db, true, meta.checkpoint_at),
  )
  const checkpointRows = runGovernedPhase(
    'governance_checkpoint_invalid',
    () => verifyCheckpoint(db, meta),
  )
  runGovernedPhase('governance_journal_invalid', () => verifyEmptyJournal(db))
  runGovernedPhase(
    'governance_projection_invalid',
    () => verifyCheckpointProjection(db, meta, checkpointRows),
  )
  return frozenVerificationState(meta)
}

function snapshotLegacyProjection(db) {
  const memories = readRows(db, `
    SELECT
      id,
      palari_id,
      user_id,
      type,
      shared,
      CASE WHEN valid_until IS NULL THEN 'current' ELSE 'ended' END
        AS validity_state
    FROM main.memories
    ORDER BY id COLLATE BINARY
  `)
  const links = readRows(db, `
    SELECT id, from_memory_id, to_memory_id
    FROM main.memory_links
    ORDER BY id COLLATE BINARY
  `)
  if (
    !numberIsSafeInteger(memories.length) ||
    !numberIsSafeInteger(links.length) ||
    memories.length > numberMaxSafeInteger - links.length
  ) throw governedFailure('governance_checkpoint_invalid')
  return { links, memories }
}

function generateIdentifier(prefix) {
  const uuid = reflectApply(nativeRandomUUID, undefined, [])
  const value = `${prefix}${uuid}`
  if (!isPrefixedUuidV4(value, prefix)) {
    throw governedFailure('governance_internal_invariant')
  }
  return value
}

function requireOneChange(result, code) {
  if (
    result === null ||
    typeof result !== 'object' ||
    reflectApply(isProxy, undefined, [result])
  ) throw governedFailure(code)
  const descriptor = reflectGetOwnPropertyDescriptor(result, 'changes')
  if (
    descriptor === undefined ||
    !hasOwn(descriptor, 'value') ||
    descriptor.value !== 1
  ) throw governedFailure(code)
}

function createB2Objects(db) {
  if (CDX_B2_CREATE_STATEMENTS.length !== 16) {
    throw governedFailure('governance_internal_invariant')
  }
  for (let index = 0; index < CDX_B2_CREATE_STATEMENTS.length; index += 1) {
    execDatabase(db, CDX_B2_CREATE_STATEMENTS[index])
  }
}

function verifyGeneratedIdsAvailable(db, streamId, checkpointId) {
  const row = readRow(db, `
    SELECT singleton
    FROM main.cdx_b2_meta
    WHERE stream_id = ? OR checkpoint_id = ?
    LIMIT 1
  `, [streamId, checkpointId])
  if (row !== null) throw governedFailure('governance_identifier_collision')
}

function insertMeta(
  db,
  workspaceId,
  memoryVariant,
  snapshot,
  streamId,
  checkpointId,
  checkpointAt,
) {
  const result = runStatement(db, `
    INSERT INTO main.cdx_b2_meta(
      singleton,
      schema_version,
      kernel_profile,
      projection_profile,
      authority_profile,
      stream_id,
      head_mutation_sequence,
      workspace_id,
      checkpoint_id,
      checkpoint_at,
      checkpoint_memory_count,
      checkpoint_link_count,
      baseline_disposition,
      legacy_schema_variant,
      kernel_version,
      kernel_source_commit,
      kernel_source_blob,
      kernel_config_hash
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    1,
    'CDX-B2',
    'FB1-4.ratified-erasure-apply-v1',
    'CDX-M1-runtime@1',
    'host-checked-external-grant-v1',
    streamId,
    0,
    workspaceId,
    checkpointId,
    checkpointAt,
    snapshot.memories.length,
    snapshot.links.length,
    'unadjudicated',
    `cdx_m1_order_${memoryVariant}`,
    'FB1-4.patch-kernel-v1',
    'c9af823c7dee29d29fd937d44527f3b78d8d3845',
    'df4de5f00ae88ba670305f9b2bb699441cc5b234',
    CDX_B2_KERNEL_CONFIG_HASH,
  ])
  requireOneChange(result, 'governance_meta_invalid')
}

const CHECKPOINT_INSERT_SQL = `
  INSERT INTO main.cdx_b2_legacy_checkpoint(
    checkpoint_ordinal,
    stream_id,
    entity_kind,
    entity_id,
    palari_id,
    user_id,
    memory_type,
    shared,
    validity_state,
    from_memory_id,
    to_memory_id
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`

function insertCheckpoint(db, snapshot, streamId) {
  let ordinal = 1
  for (let index = 0; index < snapshot.memories.length; index += 1) {
    const memory = snapshot.memories[index]
    const result = runStatement(db, CHECKPOINT_INSERT_SQL, [
      ordinal,
      streamId,
      'memory',
      memory.id,
      memory.palari_id,
      memory.user_id,
      memory.type,
      memory.shared,
      memory.validity_state,
      null,
      null,
    ])
    requireOneChange(result, 'governance_checkpoint_invalid')
    ordinal += 1
  }
  for (let index = 0; index < snapshot.links.length; index += 1) {
    const link = snapshot.links[index]
    const result = runStatement(db, CHECKPOINT_INSERT_SQL, [
      ordinal,
      streamId,
      'link',
      link.id,
      null,
      null,
      null,
      null,
      null,
      link.from_memory_id,
      link.to_memory_id,
    ])
    requireOneChange(result, 'governance_checkpoint_invalid')
    ordinal += 1
  }
}

function insertB2Marker(db, checkpointAt) {
  const result = runStatement(db, `
    INSERT INTO main.memory_migrations(id, applied_at)
    VALUES ('CDX-B2', ?)
  `, [checkpointAt])
  requireOneChange(result, 'governance_migration_invalid')
}

export function bootstrapCdxB2InTransaction(lease, db, input) {
  assertActiveMutationLease(lease, db)
  const workspaceId = captureBootstrapInput(input)
  const classification = runGovernedPhase(
    'governance_schema_invalid',
    () => classifyB2State(db),
  )
  if (classification.kind === 'complete-candidate') {
    return verifyTask3State(db, workspaceId)
  }

  runGovernedPhase('governance_schema_invalid', () => {
    verifyTriggerInventory(db, false)
    completeA2Schema(db)
  })
  const memoryVariant = runGovernedPhase(
    'governance_schema_invalid',
    () => verifyA2Manifest(db, false),
  )
  const snapshot = runGovernedPhase(
    'governance_projection_invalid',
    () => snapshotLegacyProjection(db),
  )

  const checkpointAt = runGovernedPhase('governance_clock_invalid', () => {
    const value = nativeIsoNow()
    if (!isCanonicalTimestamp(value)) {
      throw governedFailure('governance_clock_invalid')
    }
    return value
  })
  const streamId = runGovernedPhase(
    'governance_internal_invariant',
    () => generateIdentifier('b2s_'),
  )
  const checkpointId = runGovernedPhase(
    'governance_internal_invariant',
    () => generateIdentifier('b2c_'),
  )

  runGovernedPhase('governance_schema_invalid', () => createB2Objects(db))
  runGovernedPhase('governance_identifier_collision', () => {
    verifyGeneratedIdsAvailable(db, streamId, checkpointId)
  })
  runGovernedPhase('governance_meta_invalid', () => {
    insertMeta(
      db,
      workspaceId,
      memoryVariant,
      snapshot,
      streamId,
      checkpointId,
      checkpointAt,
    )
  })
  runGovernedPhase(
    'governance_checkpoint_invalid',
    () => insertCheckpoint(db, snapshot, streamId),
  )
  runGovernedPhase(
    'governance_migration_invalid',
    () => insertB2Marker(db, checkpointAt),
  )
  return verifyTask3State(db, workspaceId)
}

export function verifyCdxB2InTransaction(lease, db) {
  assertActiveMutationLease(lease, db)
  const classification = runGovernedPhase(
    'governance_schema_invalid',
    () => classifyB2State(db),
  )
  if (classification.kind !== 'complete-candidate') {
    throw governedFailure('governance_migration_invalid')
  }
  return verifyTask3State(db)
}

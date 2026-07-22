// V2-M2-B governed CDX-M1 native runtime.
//
// Copied behavior is traced to
// apps/palari-local-workbench/scripts/workspace-backend/memory-store.mjs at
// palari-v05 190a4ad2f8d5187f5f21222048dd11efb2ad9991 (blob
// 4f67d0fe96dd), severed locally at 1d65bb0 (blob
// 64e647232facc8682c86386cf9d98770193416e2). Copied regions are the CDX-M0
// schema, workspace/config normalization, FTS/read paths, recall ranking, and
// query helpers. Intentional A2 deltas: this module constructs
// DatabaseSync directly, completes CDX-M1 before publication, verifies the
// closed CDX-M1-runtime@1 manifest, captures native dispatch, and exposes
// branded reads only. M2-B constructs the governed bridge, bootstraps and
// verifies B2 before handle publication, routes the one supported ratified
// erasure through it, refuses every other semantic route, and refuses terminal
// storage deletion. The extracted src/memory-store.mjs is never imported and
// remains dormant provenance evidence.

import { mkdir, lstat, realpath } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { DatabaseSync, StatementSync } from 'node:sqlite'
import { types as utilTypes } from 'node:util'

import {
  CDX_B2_MANIFEST,
  normalizeCdxB2Sql,
} from './cdx-b2-schema.mjs'
import {
  MEMORY_BUNDLE_OBJECTS,
  MEMORY_BUNDLE_TRIGGER_TARGETS,
  normalizeMemoryBundleSql,
} from './memory-bundle-schema.mjs'
import {
  LegacyMutationError,
} from './legacy-mutation-router.mjs'
import {
  createGovernedMemoryBridge,
  GovernedMemoryError,
} from './governed-memory-bridge.mjs'
import {
  preflightMemoryAuthorityRoot,
} from './memory-authority-runtime.mjs'

const reflectApply = Reflect.apply
const reflectConstruct = Reflect.construct
const reflectDefineProperty = Reflect.defineProperty
const reflectGetOwnPropertyDescriptor = Reflect.getOwnPropertyDescriptor
const reflectOwnKeys = Reflect.ownKeys
const arrayIsArray = Array.isArray
const arrayJoin = Array.prototype.join
const arrayPush = Array.prototype.push
const arraySlice = Array.prototype.slice
const arraySort = Array.prototype.sort
const dateGetTime = Date.prototype.getTime
const dateParse = Date.parse
const dateToISOString = Date.prototype.toISOString
const mapDelete = Map.prototype.delete
const mapForEach = Map.prototype.forEach
const mapGet = Map.prototype.get
const mapHas = Map.prototype.has
const mapSet = Map.prototype.set
const mathMax = Math.max
const mathMin = Math.min
const numberIsFinite = Number.isFinite
const numberIsNaN = Number.isNaN
const numberIsSafeInteger = Number.isSafeInteger
const objectFreeze = Object.freeze
const objectGetPrototypeOf = Object.getPrototypeOf
const objectHasOwn = Object.hasOwn
const objectIs = Object.is
const objectKeys = Object.keys
const objectPrototype = Object.prototype
const regexpTest = RegExp.prototype.test
const setAdd = Set.prototype.add
const setEntries = Set.prototype.entries
const setForEach = Set.prototype.forEach
const setHas = Set.prototype.has
const setKeys = Set.prototype.keys
const setValues = Set.prototype.values
const setSize = reflectGetOwnPropertyDescriptor(Set.prototype, 'size').get
const stringCharCodeAt = String.prototype.charCodeAt
const stringEndsWith = String.prototype.endsWith
const stringFromCharCode = String.fromCharCode
const stringNormalize = String.prototype.normalize
const stringReplace = String.prototype.replace
const stringSlice = String.prototype.slice
const stringSplit = String.prototype.split
const stringStartsWith = String.prototype.startsWith
const stringToLowerCase = String.prototype.toLowerCase
const stringTrim = String.prototype.trim
const symbolIterator = Symbol.iterator
const weakMapGet = WeakMap.prototype.get
const weakMapSet = WeakMap.prototype.set
const promiseThen = Promise.prototype.then
const promiseResolve = Promise.resolve
const isProxy = utilTypes.isProxy

const nativeAggregateError = AggregateError
const nativeBoolean = Boolean
const nativeDate = Date
const nativeDatabaseSync = DatabaseSync
const nativeError = Error
const nativeMap = Map
const nativeNumber = Number
const nativePromise = Promise
const nativeProxy = Proxy
const nativeRangeError = RangeError
const nativeSet = Set
const nativeString = String
const fsLstat = lstat
const fsMkdir = mkdir
const fsRealpath = realpath
const pathBasename = basename
const pathDirname = dirname
const pathResolve = resolve

const FILE_TYPE_MASK = fsConstants.S_IFMT
const SYMBOLIC_LINK_TYPE = fsConstants.S_IFLNK

const databaseClose = nativeDatabaseSync.prototype.close
const databaseExec = nativeDatabaseSync.prototype.exec
const databasePrepare = nativeDatabaseSync.prototype.prepare
const statementAll = StatementSync.prototype.all
const statementGet = StatementSync.prototype.get
const statementRun = StatementSync.prototype.run
const statementSetReadBigInts = StatementSync.prototype.setReadBigInts
const statementSetReturnArrays = StatementSync.prototype.setReturnArrays
const performanceNow = performance.now

const { databaseIsOpen, databaseIsTransaction } = (() => {
  const probe = reflectConstruct(nativeDatabaseSync, [':memory:', { open: false }])
  return {
    databaseIsOpen: reflectGetOwnPropertyDescriptor(probe, 'isOpen').get,
    databaseIsTransaction: reflectGetOwnPropertyDescriptor(
      probe,
      'isTransaction',
    ).get,
  }
})()

export const memoryStoreSchemaVersion = 'CDX-M0'
export const memoryFtsTokenizer = 'unicode61 remove_diacritics 2'

const PERMANENT_MEMORY_TYPE_VALUES = objectFreeze([
  'relationship',
  'preference',
  'opinion',
  'entity',
  'life_event',
])
const TRANSIENT_MEMORY_TYPE_VALUES = objectFreeze([
  'working',
  'project',
  'recent_life',
  'session_summary',
])
const MEMORY_TYPE_VALUES = objectFreeze([
  ...PERMANENT_MEMORY_TYPE_VALUES,
  ...TRANSIENT_MEMORY_TYPE_VALUES,
])
const ACQUISITION_MODE_VALUES = objectFreeze([
  'direct',
  'told_to_me',
  'extracted',
  'summarized',
])
const MEMORY_ADD_WRITER_VALUES = objectFreeze([
  'background_extraction',
  'explicit_user_action',
  'session_summary',
])
const MEMORY_MUTATION_ACTOR_VALUES = objectFreeze([
  ...MEMORY_ADD_WRITER_VALUES,
  'lifecycle_job',
])
const EXTERNAL_SOURCE_KIND_VALUES = objectFreeze([
  'source_document',
  'tool_output',
  'web_result',
])

const permanentMemoryTypeSet = new nativeSet(PERMANENT_MEMORY_TYPE_VALUES)
const transientMemoryTypeSet = new nativeSet(TRANSIENT_MEMORY_TYPE_VALUES)
const memoryTypeSet = new nativeSet(MEMORY_TYPE_VALUES)
const acquisitionModeSet = new nativeSet(ACQUISITION_MODE_VALUES)
const memoryAddWriterSet = new nativeSet(MEMORY_ADD_WRITER_VALUES)
const memoryMutationActorSet = new nativeSet(MEMORY_MUTATION_ACTOR_VALUES)
const externalSourceKindSet = new nativeSet(EXTERNAL_SOURCE_KIND_VALUES)

function readonlySet(values) {
  const target = new nativeSet(values)
  let proxy
  const hasValue = function has(value) {
    return reflectApply(setHas, target, [value])
  }
  const valuesIterator = function valuesIterator() {
    return reflectApply(setValues, target, [])
  }
  const keysIterator = function keysIterator() {
    return reflectApply(setKeys, target, [])
  }
  const entriesIterator = function entriesIterator() {
    return reflectApply(setEntries, target, [])
  }
  const forEachValue = function forEach(callback, thisArg) {
    if (typeof callback !== 'function') {
      return reflectApply(setForEach, target, [callback, thisArg])
    }
    return reflectApply(setForEach, target, [function each(value) {
      return reflectApply(callback, thisArg, [value, value, proxy])
    }])
  }
  proxy = new nativeProxy(target, {
    get(set, property) {
      if (property === 'add' || property === 'delete' || property === 'clear') {
        return undefined
      }
      if (property === 'size') return reflectApply(setSize, set, [])
      if (property === 'has') return hasValue
      if (property === 'values' || property === symbolIterator) {
        return valuesIterator
      }
      if (property === 'keys') return keysIterator
      if (property === 'entries') return entriesIterator
      if (property === 'forEach') return forEachValue
      if (property === Symbol.toStringTag) return 'Set'
      return undefined
    },
    has(_set, property) {
      if (property === 'add' || property === 'delete' || property === 'clear') {
        return false
      }
      return (
        property === 'size' || property === 'has' || property === 'values' ||
        property === 'keys' || property === 'entries' ||
        property === 'forEach' || property === symbolIterator ||
        property === Symbol.toStringTag
      )
    },
  })
  return objectFreeze(proxy)
}

export const permanentMemoryTypes = readonlySet(PERMANENT_MEMORY_TYPE_VALUES)
export const transientMemoryTypes = readonlySet(TRANSIENT_MEMORY_TYPE_VALUES)
export const memoryTypes = readonlySet(MEMORY_TYPE_VALUES)
export const acquisitionModes = readonlySet(ACQUISITION_MODE_VALUES)
export const memoryAddWriters = readonlySet(MEMORY_ADD_WRITER_VALUES)
export const memoryMutationActors = readonlySet(MEMORY_MUTATION_ACTOR_VALUES)
export const externalMemorySourceKinds = readonlySet(
  EXTERNAL_SOURCE_KIND_VALUES,
)

const memoryStopWords = new nativeSet([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has',
  'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may',
  'might', 'can', 'shall', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
  'from', 'as', 'into', 'about', 'this', 'that', 'it', 'its', 'not', 'but',
  'and', 'or', 'if', 'then', 'so', 'what', 'which', 'who', 'how', 'when',
  'where', 'why', 'my', 'your', 'me', 'you', 'we', 'they', 'i',
])

function toString(value) {
  return reflectApply(nativeString, undefined, [value])
}

function appendValue(array, value) {
  reflectApply(arrayPush, array, [value])
}

function appendValues(target, source) {
  for (let index = 0; index < source.length; index += 1) {
    appendValue(target, source[index])
  }
  return target
}

function aggregateErrors(values) {
  let index = 0
  const iterator = {
    next() {
      if (index >= values.length) return { done: true, value: undefined }
      const value = values[index]
      index += 1
      return { done: false, value }
    },
  }
  const iterable = {
    [symbolIterator]() {
      return iterator
    },
  }
  return reflectConstruct(nativeAggregateError, [iterable])
}

function copyArray(source) {
  const target = []
  return appendValues(target, source)
}

function trimString(value) {
  return reflectApply(stringTrim, toString(value), [])
}

function normalizeForShingles(value) {
  let normalized = reflectApply(stringNormalize, toString(value ?? ''), ['NFKD'])
  normalized = reflectApply(stringReplace, normalized, [/\p{Diacritic}/gu, ''])
  normalized = reflectApply(stringToLowerCase, normalized, [])
  normalized = reflectApply(stringReplace, normalized, [/[^a-z0-9]+/g, ' '])
  return reflectApply(stringTrim, normalized, [])
}

function trigramShingles(value) {
  const normalized = normalizeForShingles(value)
  if (normalized === '') return new nativeSet()
  const padded = `  ${normalized}  `
  const shingles = new nativeSet()
  for (let index = 0; index <= padded.length - 3; index += 1) {
    reflectApply(setAdd, shingles, [
      reflectApply(stringSlice, padded, [index, index + 3]),
    ])
  }
  return shingles
}

export function trigramShingleSimilarity(left, right) {
  const leftShingles = trigramShingles(left)
  const rightShingles = trigramShingles(right)
  const leftSize = reflectApply(setSize, leftShingles, [])
  const rightSize = reflectApply(setSize, rightShingles, [])
  if (leftSize === 0 && rightSize === 0) return 1
  if (leftSize === 0 || rightSize === 0) return 0
  let intersection = 0
  const unionSet = new nativeSet()
  reflectApply(setForEach, leftShingles, [(shingle) => {
    if (reflectApply(setHas, rightShingles, [shingle])) intersection += 1
    reflectApply(setAdd, unionSet, [shingle])
  }])
  reflectApply(setForEach, rightShingles, [(shingle) => {
    reflectApply(setAdd, unionSet, [shingle])
  }])
  const union = reflectApply(setSize, unionSet, [])
  return union === 0 ? 0 : intersection / union
}

export function extractMemoryQueryKeywords(text, options = {}) {
  const limit = options?.limit === undefined ? 5 : options.limit
  const keywords = []
  const seen = new nativeSet()
  const parts = reflectApply(stringSplit, toString(text ?? ''), [/\s+/])
  for (let index = 0; index < parts.length; index += 1) {
    const normalized = normalizeForShingles(parts[index])
    if (
      normalized.length <= 2 ||
      reflectApply(setHas, memoryStopWords, [normalized]) ||
      reflectApply(setHas, seen, [normalized])
    ) continue
    reflectApply(setAdd, seen, [normalized])
    appendValue(keywords, normalized)
    if (keywords.length >= limit) break
  }
  return keywords
}

function normalizeWorkspaceId(value) {
  let normalized = trimString(value ?? '')
  normalized = reflectApply(stringToLowerCase, normalized, [])
  normalized = reflectApply(stringReplace, normalized, [/[^a-z0-9]+/g, '-'])
  normalized = reflectApply(stringReplace, normalized, [/^-|-$/g, ''])
  normalized = reflectApply(stringSlice, normalized, [0, 48])
  return normalized || 'workspace'
}

function booleanEnvironmentValue(value) {
  return reflectApply(regexpTest, /^(1|true|yes)$/i, [trimString(value ?? '')])
}

function joinPath(leftValue, rightValue) {
  const left = toString(leftValue)
  const right = toString(rightValue)
  if (left === '') return right
  if (right === '') return left
  const leftHasSlash = reflectApply(stringEndsWith, left, ['/'])
  const rightStartsSlash = right[0] === '/'
  if (leftHasSlash && rightStartsSlash) {
    return left + reflectApply(stringSlice, right, [1])
  }
  if (leftHasSlash || rightStartsSlash) return left + right
  return `${left}/${right}`
}

function resolveMemoryConfig(options = {}) {
  const env = options?.env ?? process.env
  const memoryEnabled = options?.memoryEnabled
  const publicDemo = options?.publicDemo ?? false
  const requested = memoryEnabled === undefined
    ? booleanEnvironmentValue(env.PALARI_MEMORY)
    : reflectApply(nativeBoolean, undefined, [memoryEnabled])
  const disabledReason = publicDemo
    ? 'public_demo_hard_off'
    : requested
      ? ''
      : 'flag_off'
  return objectFreeze({
    disabledReason,
    enabled: requested && !publicDemo,
    publicDemo: reflectApply(nativeBoolean, undefined, [publicDemo]),
    requested,
  })
}

export function workspaceMemoryDbPath(options = {}) {
  const memoryRootDir = options?.memoryRootDir ?? ''
  const statePath = options?.statePath ?? ''
  const safeWorkspaceId = normalizeWorkspaceId(options?.workspaceId)
  const root = memoryRootDir || joinPath(pathDirname(statePath), 'palari-memory')
  return joinPath(root, `${safeWorkspaceId}.memory.sqlite`)
}

function legacyFailure(code, message, cause) {
  return reflectConstruct(
    LegacyMutationError,
    cause === undefined ? [code, message] : [code, message, cause],
  )
}

function invalidPath(cause) {
  return legacyFailure(
    'legacy_path_invalid',
    'A valid memory database path is required.',
    cause,
  )
}

function storeOpenFailure() {
  return legacyFailure(
    'legacy_store_open',
    'The memory database has a supported live or blocked connection.',
  )
}

function storeClosedFailure() {
  return legacyFailure(
    'legacy_store_closed',
    'The memory store is closed.',
  )
}

function invalidCapability() {
  return legacyFailure(
    'legacy_invalid_capability',
    'A supported branded memory capability is required.',
  )
}

function schemaInvalid(cause) {
  return legacyFailure(
    'legacy_schema_invalid',
    'The CDX-M1 runtime schema does not match the required manifest.',
    cause,
  )
}

const pathRegistry = new nativeMap()

function registryEntry(dbPath) {
  let entry = reflectApply(mapGet, pathRegistry, [dbPath])
  if (entry === undefined) {
    entry = {
      dbPath,
      liveCount: 0,
      pendingCount: 0,
      poisoned: false,
      tail: reflectApply(promiseResolve, nativePromise, []),
    }
    reflectApply(mapSet, pathRegistry, [dbPath, entry])
  }
  return entry
}

function reclaimRegistryEntry(entry) {
  if (
    entry.liveCount === 0 &&
    entry.pendingCount === 0 &&
    !entry.poisoned &&
    reflectApply(mapGet, pathRegistry, [entry.dbPath]) === entry
  ) {
    reflectApply(mapDelete, pathRegistry, [entry.dbPath])
  }
}

function queuePathOperation(entry, operation) {
  entry.pendingCount += 1
  const result = reflectApply(promiseThen, entry.tail, [operation, operation])
  entry.tail = reflectApply(promiseThen, result, [
    () => {
      entry.pendingCount -= 1
      reclaimRegistryEntry(entry)
    },
    () => {
      entry.pendingCount -= 1
      reclaimRegistryEntry(entry)
    },
  ])
  return result
}

function captureMemoryPathCandidate(options) {
  const statePath = options.statePath
  const memoryRootDir = options.memoryRootDir
  if (!statePath && !memoryRootDir) throw invalidPath()

  try {
    const workspaceId = normalizeWorkspaceId(options.workspaceId)
    const candidate = pathResolve(workspaceMemoryDbPath({
      memoryRootDir,
      statePath,
      workspaceId,
    }))
    return objectFreeze({ candidate, workspaceId })
  } catch (error) {
    throw invalidPath(error)
  }
}

async function canonicalMemoryPath(candidate) {
  const parent = pathDirname(candidate)
  await fsMkdir(parent, { recursive: true })
  const realParent = await fsRealpath(parent)
  const canonical = joinPath(realParent, pathBasename(candidate))
  let stat
  try {
    stat = await fsLstat(canonical)
  } catch (error) {
    let code
    if (
      error !== null && typeof error === 'object' &&
      !reflectApply(isProxy, undefined, [error])
    ) {
      const descriptor = reflectGetOwnPropertyDescriptor(error, 'code')
      if (descriptor !== undefined && objectHasOwn(descriptor, 'value')) {
        code = descriptor.value
      }
    }
    if (code === 'ENOENT') return canonical
    throw error
  }
  if ((stat.mode & FILE_TYPE_MASK) === SYMBOLIC_LINK_TYPE) throw invalidPath()
  return canonical
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
    if (
      descriptor === undefined ||
      !objectHasOwn(descriptor, 'value')
    ) throw invalidNativeRow()
    defineMutableData(target, key, descriptor.value)
  }
  return target
}

function copyNativeRows(source) {
  if (
    !arrayIsArray(source) ||
    reflectApply(isProxy, undefined, [source])
  ) throw invalidNativeRow()
  const keys = reflectOwnKeys(source)
  const lengthDescriptor = reflectGetOwnPropertyDescriptor(source, 'length')
  if (
    lengthDescriptor === undefined ||
    !objectHasOwn(lengthDescriptor, 'value') ||
    !numberIsSafeInteger(lengthDescriptor.value) ||
    lengthDescriptor.value < 0 ||
    keys.length !== lengthDescriptor.value + 1 ||
    keys[keys.length - 1] !== 'length'
  ) throw invalidNativeRow()
  const rows = []
  for (let index = 0; index < lengthDescriptor.value; index += 1) {
    const key = toString(index)
    const descriptor = reflectGetOwnPropertyDescriptor(source, key)
    if (
      keys[index] !== key ||
      descriptor === undefined ||
      !objectHasOwn(descriptor, 'value')
    ) throw invalidNativeRow()
    appendValue(rows, copyNativeRow(descriptor.value))
  }
  return rows
}

function readRows(db, sql, parameters = []) {
  const statement = prepareRowStatement(db, sql)
  const nativeRows = reflectApply(statementAll, statement, parameters)
  return copyNativeRows(nativeRows)
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

function readNativeState(db) {
  return {
    open: reflectApply(databaseIsOpen, db, []),
    transaction: reflectApply(databaseIsTransaction, db, []),
  }
}

function nativeIsoNow() {
  const value = reflectConstruct(nativeDate, [])
  return reflectApply(dateToISOString, value, [])
}

function readScalar(db, sql) {
  const row = readRow(db, sql)
  if (row === null) return undefined
  const keys = reflectOwnKeys(row)
  if (keys.length !== 1 || typeof keys[0] !== 'string') return undefined
  return row[keys[0]]
}

const CONNECTION_POLICY = objectFreeze([
  objectFreeze({ set: 'PRAGMA foreign_keys = ON', read: 'PRAGMA foreign_keys', value: 1 }),
  objectFreeze({ set: 'PRAGMA busy_timeout = 0', read: 'PRAGMA busy_timeout', value: 0 }),
  objectFreeze({ set: 'PRAGMA recursive_triggers = ON', read: 'PRAGMA recursive_triggers', value: 1 }),
  objectFreeze({ set: 'PRAGMA ignore_check_constraints = OFF', read: 'PRAGMA ignore_check_constraints', value: 0 }),
  objectFreeze({ set: 'PRAGMA trusted_schema = OFF', read: 'PRAGMA trusted_schema', value: 0 }),
])

function configureConnectionPolicy(db) {
  for (let index = 0; index < CONNECTION_POLICY.length; index += 1) {
    execDatabase(db, CONNECTION_POLICY[index].set)
  }
  for (let index = 0; index < CONNECTION_POLICY.length; index += 1) {
    const policy = CONNECTION_POLICY[index]
    if (readScalar(db, policy.read) !== policy.value) throw schemaInvalid()
  }
}

const CDX_M0_SCHEMA_SQL = `
    CREATE TABLE IF NOT EXISTS memory_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

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
])
const CANONICAL_MEMORY_COLUMNS = reflectApply(
  arrayJoin,
  CANONICAL_MEMORY_KEYS,
  [', '],
)
const qualifiedMemoryColumns = []
for (let index = 0; index < CANONICAL_MEMORY_KEYS.length; index += 1) {
  appendValue(qualifiedMemoryColumns, `m.${CANONICAL_MEMORY_KEYS[index]}`)
}
const QUALIFIED_CANONICAL_MEMORY_COLUMNS = reflectApply(
  arrayJoin,
  qualifiedMemoryColumns,
  [', '],
)

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

function hasColumn(db, name) {
  const rows = readRows(db, 'PRAGMA main.table_xinfo(memories)')
  for (let index = 0; index < rows.length; index += 1) {
    if (rows[index].name === name) return true
  }
  return false
}

function completeSchema(db) {
  execDatabase(db, CDX_M0_SCHEMA_SQL)
  const additions = [
    ['fictional', 'ALTER TABLE memories ADD COLUMN fictional INTEGER NOT NULL DEFAULT 0 CHECK (fictional IN (0, 1))'],
    ['last_decayed_at', 'ALTER TABLE memories ADD COLUMN last_decayed_at TEXT'],
    ['source_kind', 'ALTER TABLE memories ADD COLUMN source_kind TEXT'],
    ['extractor', 'ALTER TABLE memories ADD COLUMN extractor TEXT'],
  ]
  for (let index = 0; index < additions.length; index += 1) {
    if (!hasColumn(db, additions[index][0])) {
      execDatabase(db, additions[index][1])
    }
  }
  const appliedAtM0 = nativeIsoNow()
  runStatement(
    db,
    'INSERT OR IGNORE INTO memory_migrations(id, applied_at) VALUES (?, ?)',
    ['CDX-M0', appliedAtM0],
  )
  const appliedAtM1 = nativeIsoNow()
  runStatement(
    db,
    'INSERT OR IGNORE INTO memory_migrations(id, applied_at) VALUES (?, ?)',
    ['CDX-M1', appliedAtM1],
  )
}

function valuesEqual(left, right) {
  return reflectApply(objectIs, undefined, [left, right])
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
  for (let orderIndex = 0; orderIndex < MEMORY_PHYSICAL_ORDERS.length; orderIndex += 1) {
    const order = MEMORY_PHYSICAL_ORDERS[orderIndex]
    if (rows.length !== order.length) continue
    let matches = true
    for (let index = 0; index < order.length; index += 1) {
      const row = rows[index]
      const name = order[index]
      const descriptor = MEMORY_COLUMN_DESCRIPTOR[name]
      if (
        row.cid !== index || row.name !== name || row.type !== descriptor[0] ||
        row.notnull !== descriptor[1] ||
        !valuesEqual(row.dflt_value, descriptor[2]) ||
        row.pk !== descriptor[3] || row.hidden !== descriptor[4]
      ) {
        matches = false
        break
      }
    }
    if (matches) return orderIndex
  }
  return -1
}

function normalizeSql(value) {
  if (typeof value !== 'string') return null
  return normalizeMemoryBundleSql(value)
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
const cdxSchemaFoldedValues = []
for (let index = 0; index < CDX_SCHEMA_NAMES.length; index += 1) {
  appendValue(cdxSchemaFoldedValues, asciiFold(CDX_SCHEMA_NAMES[index]))
}
const cdxSchemaFoldedSet = new nativeSet(cdxSchemaFoldedValues)
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
    reflectApply(mapSet, result, [object.name, normalizeSql(object.persistedSql)])
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
  for (
    let index = 0;
    index < CDX_B2_MANIFEST.triggerTargets.length;
    index += 1
  ) {
    const target = CDX_B2_MANIFEST.triggerTargets[index]
    reflectApply(mapSet, result, [target.name, target.table])
  }
  return result
})()
const B2_SCHEMA_ROWS = (() => {
  const result = new nativeMap()
  for (let index = 0; index < CDX_B2_MANIFEST.objects.length; index += 1) {
    const object = CDX_B2_MANIFEST.objects[index]
    reflectApply(mapSet, result, [object.name, objectFreeze({
      sql: object.persistedSql,
      table: object.table,
      type: object.type,
    })])
  }
  for (let index = 0; index < CDX_B2_MANIFEST.autoindexes.length; index += 1) {
    const autoindex = CDX_B2_MANIFEST.autoindexes[index]
    reflectApply(mapSet, result, [autoindex.name, objectFreeze({
      sql: null,
      table: autoindex.table,
      type: 'index',
    })])
  }
  return result
})()
const B2_TABLE_NAME_SET = (() => {
  const result = new nativeSet()
  for (let index = 0; index < CDX_B2_MANIFEST.objects.length; index += 1) {
    const object = CDX_B2_MANIFEST.objects[index]
    if (object.type === 'table') {
      reflectApply(setAdd, result, [object.name])
    }
  }
  return result
})()

function isLegacyB2AssociatedName(name) {
  const folded = asciiFold(name)
  return (
    folded !== null &&
    (
      reflectApply(stringStartsWith, folded, ['cdx_b2_']) ||
      reflectApply(stringStartsWith, folded, [
        'sqlite_autoindex_cdx_b2_',
      ])
    )
  )
}

function verifyLegacyB2AllowlistState(db) {
  const schemaRows = readRows(db, `
    SELECT type, name, tbl_name, sql
    FROM main.sqlite_schema
    ORDER BY name COLLATE BINARY
  `)
  const b2Rows = []
  let hasMigrationTable = false
  for (let index = 0; index < schemaRows.length; index += 1) {
    const row = schemaRows[index]
    if (row.type === 'table' && row.name === 'memory_migrations') {
      hasMigrationTable = true
    }
    const namedForB2 = isLegacyB2AssociatedName(row.name)
    const targetsB2 = isLegacyB2AssociatedName(row.tbl_name)
    if (
      (row.type === 'index' || row.type === 'trigger') &&
      targetsB2 &&
      reflectApply(mapGet, B2_SCHEMA_ROWS, [row.name]) === undefined
    ) throw schemaInvalid()
    if (namedForB2) appendValue(b2Rows, row)
  }

  let markerCount = 0
  if (hasMigrationTable) {
    try {
      markerCount = readScalar(db, `
        SELECT count(*)
        FROM main.memory_migrations
        WHERE id = 'CDX-B2'
      `)
    } catch (error) {
      throw schemaInvalid(error)
    }
  }

  if (b2Rows.length === 0 && markerCount === 0) return
  if (
    markerCount !== 1 ||
    b2Rows.length !== CDX_B2_MANIFEST.caseFoldedNames.length
  ) throw schemaInvalid()

  for (let index = 0; index < b2Rows.length; index += 1) {
    const row = b2Rows[index]
    const expected = reflectApply(mapGet, B2_SCHEMA_ROWS, [row.name])
    if (
      expected === undefined ||
      row.type !== expected.type ||
      row.tbl_name !== expected.table ||
      (
        expected.sql === null
          ? row.sql !== null
          : (
              typeof row.sql !== 'string' ||
              normalizeCdxB2Sql(row.sql) !== expected.sql
            )
      )
    ) throw schemaInvalid()
  }

  const tables = readRows(db, `
    SELECT name FROM main.sqlite_schema
    WHERE type = 'table'
    ORDER BY name COLLATE BINARY
  `)
  for (let index = 0; index < tables.length; index += 1) {
    const table = tables[index].name
    const sourceIsB2 = reflectApply(setHas, B2_TABLE_NAME_SET, [table])
    const foreignKeys = readRows(
      db,
      'SELECT "table" FROM pragma_foreign_key_list(?, ?)',
      [table, 'main'],
    )
    for (let fkIndex = 0; fkIndex < foreignKeys.length; fkIndex += 1) {
      const target = foreignKeys[fkIndex].table
      const targetIsB2 = (
        reflectApply(setHas, B2_TABLE_NAME_SET, [target]) ||
        isLegacyB2AssociatedName(target)
      )
      if (sourceIsB2 !== targetIsB2) throw schemaInvalid()
    }
  }
}

function verifyAllowedCoexistingTrigger(row) {
  let expectedSql
  let expectedTarget
  let actualSql
  if (
    row.name === 'memories_ai' ||
    row.name === 'memories_ad' ||
    row.name === 'memories_au'
  ) {
    expectedSql = normalizeSql(PERSISTED_SQL[row.name])
    expectedTarget = 'memories'
    actualSql = normalizeSql(row.sql)
  } else {
    expectedSql = reflectApply(mapGet, B1_TRIGGER_SQL, [row.name])
    expectedTarget = reflectApply(mapGet, B1_TRIGGER_TARGETS, [row.name])
    actualSql = normalizeSql(row.sql)
    if (expectedSql === undefined && expectedTarget === undefined) {
      expectedSql = reflectApply(mapGet, B2_TRIGGER_SQL, [row.name])
      expectedTarget = reflectApply(mapGet, B2_TRIGGER_TARGETS, [row.name])
      actualSql = typeof row.sql === 'string'
        ? normalizeCdxB2Sql(row.sql)
        : null
    }
  }
  if (
    expectedSql === undefined || expectedTarget === undefined ||
    row.tbl_name !== expectedTarget || actualSql !== expectedSql
  ) throw schemaInvalid()
}

function verifyBootstrapTriggerPreflight(db) {
  verifyLegacyB2AllowlistState(db)
  if (readRows(db, "SELECT name FROM temp.sqlite_schema WHERE type = 'trigger'").length !== 0) {
    throw schemaInvalid()
  }
  const rows = readRows(db, `
    SELECT name, tbl_name, sql
    FROM main.sqlite_schema
    WHERE type = 'trigger'
    ORDER BY name COLLATE BINARY
  `)
  for (let index = 0; index < rows.length; index += 1) {
    verifyAllowedCoexistingTrigger(rows[index])
  }
}

function schemaRowMap(rows) {
  const result = new nativeMap()
  for (let index = 0; index < rows.length; index += 1) {
    reflectApply(mapSet, result, [rows[index].name, rows[index]])
  }
  return result
}

function verifyStoredObject(row, expectedType, expectedTable, expectedSql) {
  if (
    row === undefined ||
    row.type !== expectedType ||
    row.tbl_name !== expectedTable ||
    normalizeSql(row.sql) !== normalizeSql(expectedSql)
  ) throw schemaInvalid()
}

function verifySchemaInventory(db) {
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
    ) throw schemaInvalid()
    if (
      folded !== null &&
      reflectApply(stringStartsWith, folded, ['memory_fts_']) &&
      !reflectApply(setHas, cdxSchemaNameSet, [row.name])
    ) throw schemaInvalid()
    if (
      row.type === 'index' &&
      reflectApply(setHas, cdxTableNameSet, [row.tbl_name]) &&
      !reflectApply(setHas, cdxSchemaNameSet, [row.name])
    ) throw schemaInvalid()
  }

  verifyStoredObject(
    reflectApply(mapGet, byName, ['memory_migrations']),
    'table',
    'memory_migrations',
    PERSISTED_SQL.memory_migrations,
  )
  verifyStoredObject(
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
  ) throw schemaInvalid()
  const normalizedMemorySql = normalizeSql(memoryRow.sql)
  let memorySqlVariant = -1
  for (let index = 0; index < MEMORIES_SQL_VARIANTS.length; index += 1) {
    if (normalizedMemorySql === normalizeSql(MEMORIES_SQL_VARIANTS[index])) {
      memorySqlVariant = index
      break
    }
  }
  if (memorySqlVariant === -1) throw schemaInvalid()

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
    const name = tuple[0]
    const type = tuple[1]
    const table = tuple[2]
    verifyStoredObject(
      reflectApply(mapGet, byName, [name]),
      type,
      table,
      PERSISTED_SQL[name],
    )
  }

  const autoindexes = [
    ['sqlite_autoindex_memory_migrations_1', 'memory_migrations'],
    ['sqlite_autoindex_memories_1', 'memories'],
    ['sqlite_autoindex_memory_links_1', 'memory_links'],
  ]
  for (let index = 0; index < autoindexes.length; index += 1) {
    const tuple = autoindexes[index]
    const name = tuple[0]
    const table = tuple[1]
    const row = reflectApply(mapGet, byName, [name])
    if (
      row === undefined || row.type !== 'index' || row.tbl_name !== table ||
      row.sql !== null
    ) throw schemaInvalid()
  }

  const triggerRows = readRows(db, `
    SELECT name, tbl_name, sql
    FROM main.sqlite_schema
    WHERE type = 'trigger'
    ORDER BY name COLLATE BINARY
  `)
  for (let index = 0; index < triggerRows.length; index += 1) {
    const row = triggerRows[index]
    if (row.name === 'memories_ai' || row.name === 'memories_ad' || row.name === 'memories_au') {
      continue
    }
    verifyAllowedCoexistingTrigger(row)
  }
  if (readRows(db, "SELECT name FROM temp.sqlite_schema WHERE type = 'trigger'").length !== 0) {
    throw schemaInvalid()
  }

  const memoryXinfo = readRows(db, 'PRAGMA main.table_xinfo(memories)')
  const xinfoVariant = verifyMemoryXinfo(memoryXinfo)
  if (xinfoVariant === -1 || xinfoVariant !== memorySqlVariant) {
    throw schemaInvalid()
  }
  const xinfoTables = objectKeys(TABLE_XINFO_MANIFEST)
  for (let index = 0; index < xinfoTables.length; index += 1) {
    const table = xinfoTables[index]
    if (!verifyXinfoRows(
      readRows(db, `PRAGMA main.table_xinfo(${table})`),
      TABLE_XINFO_MANIFEST[table],
    )) throw schemaInvalid()
  }

  return memoryXinfo
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
  if (actual.rows.length !== expected.length) throw schemaInvalid()
  for (let index = 0; index < expected.length; index += 1) {
    const tuple = expected[index]
    const name = tuple[0]
    const unique = tuple[1]
    const origin = tuple[2]
    const partial = tuple[3]
    const row = reflectApply(mapGet, actual.map, [name])
    if (
      row === undefined || row.unique !== unique || row.origin !== origin ||
      row.partial !== partial
    ) throw schemaInvalid()
  }
}

function verifyIndexXinfo(db, name, expected) {
  const rows = readRows(db, `PRAGMA main.index_xinfo(${name})`)
  if (rows.length !== expected.length) throw schemaInvalid()
  for (let index = 0; index < expected.length; index += 1) {
    const row = rows[index]
    const tuple = expected[index]
    if (
      row.seqno !== index || row.cid !== tuple[0] || row.name !== tuple[1] ||
      row.desc !== tuple[2] || row.coll !== tuple[3] || row.key !== tuple[4]
    ) throw schemaInvalid()
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

function verifyIndexes(db, memoryXinfo) {
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

function verifyForeignKeys(db) {
  const links = readRows(db, 'PRAGMA main.foreign_key_list(memory_links)')
  if (links.length !== 2) throw schemaInvalid()
  const seen = new nativeSet()
  for (let index = 0; index < links.length; index += 1) {
    const row = links[index]
    if (
      row.table !== 'memories' || row.to !== 'id' ||
      row.on_update !== 'NO ACTION' || row.on_delete !== 'CASCADE' ||
      row.match !== 'NONE' ||
      (row.from !== 'from_memory_id' && row.from !== 'to_memory_id')
    ) throw schemaInvalid()
    reflectApply(setAdd, seen, [row.from])
  }
  if (
    !reflectApply(setHas, seen, ['from_memory_id']) ||
    !reflectApply(setHas, seen, ['to_memory_id'])
  ) throw schemaInvalid()

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
    ) throw schemaInvalid()
    for (let fkIndex = 0; fkIndex < fks.length; fkIndex += 1) {
      if (
        table !== 'memory_links' &&
        reflectApply(setHas, cdxTableNameSet, [fks[fkIndex].table])
      ) throw schemaInvalid()
    }
  }
}

function verifyMigrations(db) {
  const rows = readRows(db, `
    SELECT id, applied_at, typeof(applied_at) AS applied_type
    FROM memory_migrations
    ORDER BY id COLLATE BINARY
  `)
  if (
    rows.length !== 2 || rows[0].id !== 'CDX-M0' || rows[1].id !== 'CDX-M1'
  ) throw schemaInvalid()
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    if (row.applied_type !== 'text') throw schemaInvalid()
    const parsed = reflectApply(dateParse, nativeDate, [row.applied_at])
    if (!numberIsFinite(parsed)) throw schemaInvalid()
    const date = reflectConstruct(nativeDate, [parsed])
    if (reflectApply(dateToISOString, date, []) !== row.applied_at) {
      throw schemaInvalid()
    }
  }
}

function verifyDataShapes(db) {
  const invalidMemory = readRow(db, `
    SELECT id FROM memories
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
  if (invalidMemory !== null) throw schemaInvalid()

  const invalidLink = readRow(db, `
    SELECT id FROM memory_links
    WHERE typeof(id) <> 'text'
       OR typeof(from_memory_id) <> 'text'
       OR typeof(to_memory_id) <> 'text'
       OR typeof(relation) <> 'text'
       OR typeof(created_at) <> 'text'
       OR from_memory_id = to_memory_id
    LIMIT 1
  `)
  if (invalidLink !== null) throw schemaInvalid()
}

function verifyIntegrity(db) {
  if (readRows(db, 'PRAGMA main.foreign_key_check(memory_links)').length !== 0) {
    throw schemaInvalid()
  }
  const quick = readRows(db, 'PRAGMA main.quick_check')
  if (
    quick.length !== 1 || reflectOwnKeys(quick[0]).length !== 1 ||
    quick[0][reflectOwnKeys(quick[0])[0]] !== 'ok'
  ) throw schemaInvalid()

  if (readRows(db, `
    SELECT rowid, id, palari_id, content, keywords FROM memories
    EXCEPT
    SELECT rowid, memory_id, palari_id, content, keywords FROM memory_fts
  `).length !== 0) throw schemaInvalid()
  if (readRows(db, `
    SELECT rowid, memory_id, palari_id, content, keywords FROM memory_fts
    EXCEPT
    SELECT rowid, id, palari_id, content, keywords FROM memories
  `).length !== 0) throw schemaInvalid()

  execDatabase(db, 'SAVEPOINT cdx_m1_runtime_fts_verify')
  let commandFailure
  try {
    runStatement(
      db,
      "INSERT INTO memory_fts(memory_fts) VALUES ('integrity-check')",
    )
  } catch (error) {
    commandFailure = error
  }
  let cleanupFailure
  try {
    execDatabase(db, 'ROLLBACK TO cdx_m1_runtime_fts_verify')
    execDatabase(db, 'RELEASE cdx_m1_runtime_fts_verify')
  } catch (error) {
    cleanupFailure = error
  }
  if (commandFailure !== undefined && cleanupFailure !== undefined) {
    throw aggregateErrors([commandFailure, cleanupFailure])
  }
  if (commandFailure !== undefined) throw commandFailure
  if (cleanupFailure !== undefined) throw cleanupFailure
}

function verifyRuntimeManifest(db) {
  for (let index = 0; index < CONNECTION_POLICY.length; index += 1) {
    const policy = CONNECTION_POLICY[index]
    if (readScalar(db, policy.read) !== policy.value) throw schemaInvalid()
  }
  const memoryXinfo = verifySchemaInventory(db)
  verifyIndexes(db, memoryXinfo)
  verifyForeignKeys(db)
  verifyMigrations(db)
  verifyDataShapes(db)
  const configRows = readRows(db, 'SELECT k, v FROM memory_fts_config')
  if (
    configRows.length !== 1 || configRows[0].k !== 'version' ||
    configRows[0].v !== 4
  ) throw schemaInvalid()
  verifyIntegrity(db)
}

function bootstrapStateError() {
  return reflectConstruct(nativeError, ['Bootstrap transaction state is invalid.'])
}

function rollbackStateError() {
  return reflectConstruct(nativeError, [
    'Bootstrap rollback did not end the transaction.',
  ])
}

function closeStateError() {
  return reflectConstruct(nativeError, [
    'Bootstrap close did not close the connection.',
  ])
}

function proveBootstrapState(db, expectedOpen, expectedTransaction, owner) {
  let state
  try {
    state = readNativeState(db)
  } catch (error) {
    owner.failureState = { kind: 'unreadable', error }
    owner.poison = true
    throw schemaInvalid(error)
  }
  if (
    typeof state.open !== 'boolean' ||
    typeof state.transaction !== 'boolean'
  ) {
    owner.failureState = { kind: 'invalid' }
    owner.poison = true
    throw schemaInvalid()
  }
  if (
    state.open !== expectedOpen ||
    state.transaction !== expectedTransaction
  ) {
    owner.failureState = { kind: 'state', ...state }
    if (state.open === false && state.transaction === true) owner.poison = true
    throw schemaInvalid()
  }
  owner.failureState = null
  return state
}

function inspectFailureState(db, owner) {
  if (owner.failureState !== null) return owner.failureState
  try {
    const state = readNativeState(db)
    if (
      typeof state.open !== 'boolean' ||
      typeof state.transaction !== 'boolean'
    ) return { kind: 'invalid' }
    return { kind: 'state', ...state }
  } catch (error) {
    return { kind: 'unreadable', error }
  }
}

function cleanupFailedBootstrap(db, owner, primary, entry) {
  const cleanup = []
  if (owner.beginIssued && !owner.commitProven && !owner.preBeginFailure) {
    const state = inspectFailureState(db, owner)
    let requiresRollback = false
    if (state.kind === 'unreadable') {
      appendValue(cleanup, state.error)
      owner.poison = true
    } else if (state.kind === 'invalid') {
      appendValue(cleanup, bootstrapStateError())
      owner.poison = true
    } else if (state.open === true && state.transaction === true) {
      requiresRollback = true
    } else if (
      !(
        (state.open === true && state.transaction === false) ||
        (state.open === false && state.transaction === false)
      )
    ) {
      appendValue(cleanup, bootstrapStateError())
      owner.poison = true
    }

    if (requiresRollback) {
      let rollbackReturned = false
      try {
        execDatabase(db, 'ROLLBACK')
        rollbackReturned = true
        const stateAfterRollback = readNativeState(db)
        if (
          stateAfterRollback.open !== true ||
          stateAfterRollback.transaction !== false ||
          typeof stateAfterRollback.open !== 'boolean' ||
          typeof stateAfterRollback.transaction !== 'boolean'
        ) throw rollbackStateError()
      } catch (error) {
        appendValue(cleanup, error)
        owner.poison = true
      }
      if (!rollbackReturned) owner.poison = true
    }
  }

  try {
    reflectApply(databaseClose, db, [])
    let open
    try {
      open = reflectApply(databaseIsOpen, db, [])
    } catch (error) {
      appendValue(cleanup, error)
      owner.poison = true
      open = false
    }
    if (open !== false) {
      appendValue(cleanup, closeStateError())
      owner.poison = true
    }
  } catch (error) {
    appendValue(cleanup, error)
    owner.poison = true
  }

  if (owner.poison) entry.poisoned = true
  if (cleanup.length === 0) throw primary
  const errors = [primary]
  appendValues(errors, cleanup)
  throw aggregateErrors(errors)
}

function closeFailedConstruction(db, primary, entry) {
  try {
    reflectApply(databaseClose, db, [])
    if (reflectApply(databaseIsOpen, db, []) !== false) {
      throw closeStateError()
    }
  } catch (closeError) {
    entry.poisoned = true
    throw aggregateErrors([primary, closeError])
  }
  throw primary
}

function bootstrapAndConstruct(
  dbPath,
  entry,
  config,
  workspaceId,
  authorityRoot,
) {
  let db
  let bridge
  try {
    db = reflectConstruct(nativeDatabaseSync, [dbPath])
  } catch (error) {
    throw error
  }

  try {
    bridge = createGovernedMemoryBridge(db, {
      workspaceId,
      authorityRoot,
    })
    const state = {
      bridge,
      closed: false,
      config,
      db,
      dbPath,
      enabled: true,
      entry,
      probe: objectFreeze({
        bilingualRoundTrip: true,
        driver: 'node:sqlite',
        fts5: true,
        status: 'available',
        tokenizer: memoryFtsTokenizer,
      }),
    }
    const handle = createBaseHandle(state)
    state.handle = handle
    entry.liveCount += 1
    return handle
  } catch (primary) {
    if (bridge !== undefined) bridge.close()
    closeFailedConstruction(db, primary, entry)
  }
}

const baseStates = new WeakMap()

function requireBaseState(value) {
  if (
    value === null ||
    (typeof value !== 'object' && typeof value !== 'function') ||
    reflectApply(isProxy, undefined, [value])
  ) throw invalidCapability()
  const state = reflectApply(weakMapGet, baseStates, [value])
  if (state === undefined) throw invalidCapability()
  return state
}

export function assertKernelStoreCapability(value) {
  requireBaseState(value)
  return value
}

function assertEnabledOpen(state) {
  if (state.closed) throw storeClosedFailure()
}

function emptyRecallResult() {
  return {
    directCount: 0,
    keywords: [],
    latencyMs: 0,
    memories: [],
    totalCandidates: 0,
  }
}

function publicStatusFor(state) {
  if (!state.enabled) {
    return {
      db: 'not_created',
      enabled: false,
      reason: state.config.disabledReason,
      requested: state.config.requested,
      status: state.closed ? 'closed' : 'disabled',
    }
  }
  return {
    db: 'per_workspace_sqlite',
    driver: 'node:sqlite',
    enabled: true,
    fts5: 'available',
    status: state.closed ? 'closed' : 'enabled',
    tokenizer: memoryFtsTokenizer,
  }
}

function statusFor(state) {
  if (!state.enabled) {
    return {
      ...publicStatusFor(state),
      driver: null,
      fts5: null,
    }
  }
  return {
    ...publicStatusFor(state),
    dbPath: state.dbPath,
    probe: state.probe,
  }
}

function closeBaseState(state) {
  if (state.closed) return
  state.closed = true
  if (!state.enabled) return
  let closed = false
  try {
    state.bridge.close()
    reflectApply(databaseClose, state.db, [])
    const open = reflectApply(databaseIsOpen, state.db, [])
    if (open !== false) throw closeStateError()
    closed = true
  } catch (error) {
    state.entry.poisoned = true
    throw error
  } finally {
    if (closed) {
      state.entry.liveCount -= 1
      reclaimRegistryEntry(state.entry)
    }
  }
}

function projectRow(source, keys) {
  if (source === null) return null
  const target = {}
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index]
    const descriptor = reflectGetOwnPropertyDescriptor(source, key)
    if (
      descriptor === undefined ||
      !objectHasOwn(descriptor, 'value')
    ) throw invalidNativeRow()
    defineMutableData(target, key, descriptor.value)
  }
  return target
}

function projectRows(sources, keys) {
  const rows = []
  for (let index = 0; index < sources.length; index += 1) {
    appendValue(rows, projectRow(sources[index], keys))
  }
  return rows
}

function ftsTerm(value) {
  return `"${reflectApply(
    stringReplace,
    toString(value ?? ''),
    [/"/g, '""'],
  )}"`
}

function ftsQueryForKeywords(keywords) {
  const terms = []
  for (let index = 0; index < keywords.length; index += 1) {
    appendValue(terms, ftsTerm(keywords[index]))
  }
  return reflectApply(arrayJoin, terms, [' OR '])
}

function scopedMemoryPredicate(alias = 'm') {
  return `
    ${alias}.palari_id = ?
    AND ${alias}.valid_until IS NULL
    AND (? = '' OR ${alias}.user_id = ? OR ${alias}.user_id IS NULL OR ${alias}.shared = 1)
  `
}

const SEARCH_MEMORY_KEYS = objectFreeze([
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
])
const RECALL_MEMORY_KEYS = objectFreeze([
  ...CANONICAL_MEMORY_KEYS,
  'rank',
  'rpath',
  'via_memory_id',
  'via_relation',
  'activationScore',
])

function getMemoryById(state, id) {
  assertEnabledOpen(state)
  const normalizedId = trimString(id ?? '')
  assertEnabledOpen(state)
  const row = readRow(
    state.db,
    `SELECT ${CANONICAL_MEMORY_COLUMNS} FROM memories WHERE id = ?`,
    [normalizedId],
  )
  return projectRow(row, CANONICAL_MEMORY_KEYS)
}

function listMemories(state, options) {
  assertEnabledOpen(state)
  const input = options ?? {}
  const palariId = trimString(input.palariId ?? '')
  const userId = trimString(input.userId ?? '')
  assertEnabledOpen(state)
  const rows = readRows(state.db, `
    SELECT ${CANONICAL_MEMORY_COLUMNS}
    FROM memories
    WHERE ${scopedMemoryPredicate('memories')}
    ORDER BY importance DESC, created_at DESC
  `, [palariId, userId, userId])
  return projectRows(rows, CANONICAL_MEMORY_KEYS)
}

function searchMemories(state, query, options) {
  assertEnabledOpen(state)
  const input = options ?? {}
  const normalizedQuery = trimString(query ?? '')
  const palariId = trimString(input.palariId ?? '')
  assertEnabledOpen(state)
  if (normalizedQuery === '' || palariId === '') return []
  const userId = trimString(input.userId ?? '')
  const limitNumber = reflectApply(nativeNumber, undefined, [input.limit])
  const limit = mathMax(1, limitNumber || 20)
  assertEnabledOpen(state)
  const rows = readRows(state.db, `
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
  `, [normalizedQuery, palariId, userId, userId, limit])
  return projectRows(rows, SEARCH_MEMORY_KEYS)
}

function queryFtsRows(db, { ftsLimit, keywords, palariId, userId }) {
  if (keywords.length === 0) return { keywords, rows: [] }
  const ftsQuery = ftsQueryForKeywords(keywords)
  const rows = readRows(db, `
    SELECT
      ${QUALIFIED_CANONICAL_MEMORY_COLUMNS},
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
  `, [ftsQuery, palariId, userId, userId, ftsLimit])
  return { keywords, rows }
}

function queryLinkedRows(db, { ftsRows, linkLimit, palariId, userId }) {
  const ids = []
  for (let index = 0; index < ftsRows.length; index += 1) {
    appendValue(ids, ftsRows[index].id)
  }
  if (ids.length === 0 || linkLimit <= 0) return []
  const placeholderValues = []
  for (let index = 0; index < ids.length; index += 1) {
    appendValue(placeholderValues, '?')
  }
  const placeholders = reflectApply(arrayJoin, placeholderValues, [', '])
  const parameters = []
  appendValues(parameters, ids)
  appendValues(parameters, ids)
  appendValues(parameters, ids)
  appendValues(parameters, ids)
  appendValue(parameters, palariId)
  appendValue(parameters, userId)
  appendValue(parameters, userId)
  appendValue(parameters, linkLimit)
  return readRows(db, `
    SELECT
      ${QUALIFIED_CANONICAL_MEMORY_COLUMNS},
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
  `, parameters)
}

function queryStandingRows(db, { palariId, userId }) {
  const scopedArgs = [palariId, userId, userId]
  const projection = QUALIFIED_CANONICAL_MEMORY_COLUMNS
  const relationshipRows = readRows(db, `
    SELECT ${projection}, NULL AS rank, 'standing' AS rpath,
      NULL AS via_memory_id, NULL AS via_relation
    FROM memories m
    WHERE ${scopedMemoryPredicate('m')}
      AND m.type IN ('preference', 'relationship')
    ORDER BY m.importance DESC, m.access_count DESC
    LIMIT 6
  `, scopedArgs)
  const summaryRows = readRows(db, `
    SELECT ${projection}, NULL AS rank, 'summary' AS rpath,
      NULL AS via_memory_id, NULL AS via_relation
    FROM memories m
    WHERE ${scopedMemoryPredicate('m')}
      AND m.type = 'session_summary'
    ORDER BY m.created_at DESC
    LIMIT 1
  `, scopedArgs)
  const recentRows = readRows(db, `
    SELECT ${projection}, NULL AS rank, 'recent' AS rpath,
      NULL AS via_memory_id, NULL AS via_relation
    FROM memories m
    WHERE ${scopedMemoryPredicate('m')}
      AND m.type IN ('working', 'project', 'recent_life')
    ORDER BY COALESCE(m.last_accessed, m.created_at) DESC
    LIMIT 6
  `, scopedArgs)
  const result = []
  appendValues(result, relationshipRows)
  appendValues(result, summaryRows)
  appendValues(result, recentRows)
  return result
}

function activationAgeDays(value, nowMs) {
  const timestamp = reflectApply(dateParse, nativeDate, [value ?? ''])
  if (numberIsNaN(timestamp)) return 365
  return mathMax(0, (nowMs - timestamp) / 86400000)
}

function activationScore(row, nowMs) {
  const age = activationAgeDays(row.last_accessed ?? row.created_at, nowMs)
  return (
    reflectApply(nativeNumber, undefined, [row.importance]) +
    (1 / (1 + age)) +
    mathMin(
      0.2,
      reflectApply(nativeNumber, undefined, [row.access_count]) / 100,
    )
  )
}

function dedupRecallRows(rows, nowMs) {
  const byId = new nativeMap()
  const priority = objectFreeze({
    fts: 0,
    link_walk: 1,
    summary: 2,
    recent: 3,
    standing: 4,
  })
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    const score = activationScore(row, nowMs)
    const existing = reflectApply(mapGet, byId, [row.id])
    if (
      existing === undefined ||
      priority[row.rpath] < priority[existing.rpath] ||
      score > existing.activationScore
    ) {
      const projected = projectRow(row, CANONICAL_MEMORY_KEYS)
      defineMutableData(projected, 'rank', row.rank === null ? null : row.rank)
      defineMutableData(projected, 'rpath', row.rpath)
      defineMutableData(projected, 'via_memory_id', row.via_memory_id)
      defineMutableData(projected, 'via_relation', row.via_relation)
      defineMutableData(projected, 'activationScore', score)
      reflectApply(mapSet, byId, [row.id, projected])
    }
  }
  const result = []
  reflectApply(mapForEach, byId, [(value) => {
    appendValue(result, value)
  }])
  reflectApply(arraySort, result, [(left, right) => {
    const priorityDelta = priority[left.rpath] - priority[right.rpath]
    if (priorityDelta !== 0) return priorityDelta
    if (
      left.rank !== null && right.rank !== null && left.rank !== right.rank
    ) return left.rank - right.rank
    return right.activationScore - left.activationScore
  }])
  return result
}

function recallNowMs(input) {
  const supplied = objectHasOwn(input, 'now') ? input.now : undefined
  let date
  if (supplied === undefined) {
    date = reflectConstruct(nativeDate, [])
  } else {
    date = reflectConstruct(nativeDate, [supplied])
  }
  const milliseconds = reflectApply(dateGetTime, date, [])
  if (!numberIsFinite(milliseconds)) {
    throw reflectConstruct(nativeRangeError, ['Invalid time value'])
  }
  return milliseconds
}

function elapsedSince(startedAt) {
  const endedAt = reflectApply(performanceNow, performance, [])
  return mathMax(0, endedAt - startedAt)
}

function recallMemories(state, query, options) {
  assertEnabledOpen(state)
  const startedAt = reflectApply(performanceNow, performance, [])
  const input = options ?? {}
  const palariId = trimString(input.palariId ?? '')
  const userId = trimString(input.userId ?? '')
  assertEnabledOpen(state)
  if (palariId === '') {
    return {
      directCount: 0,
      keywords: [],
      latencyMs: elapsedSince(startedAt),
      memories: [],
      totalCandidates: 0,
    }
  }
  const nowMs = recallNowMs(input)
  const ftsLimitNumber = reflectApply(nativeNumber, undefined, [input.ftsLimit])
  const ftsLimit = ftsLimitNumber || 20
  const linkCapNumber = reflectApply(nativeNumber, undefined, [input.linkCap])
  const linkCap = linkCapNumber || 40
  const contextNumber = reflectApply(nativeNumber, undefined, [input.contextBudget])
  const contextBudget = mathMax(1, contextNumber || 20)
  const queryKeywords = extractMemoryQueryKeywords(query)
  assertEnabledOpen(state)
  const { keywords, rows: ftsRows } = queryFtsRows(state.db, {
    ftsLimit,
    keywords: queryKeywords,
    palariId,
    userId,
  })
  const linkedRows = queryLinkedRows(state.db, {
    ftsRows,
    linkLimit: mathMax(0, linkCap - ftsRows.length),
    palariId,
    userId,
  })
  const standingRows = queryStandingRows(state.db, { palariId, userId })
  const candidates = []
  appendValues(candidates, ftsRows)
  appendValues(candidates, linkedRows)
  appendValues(candidates, standingRows)
  const deduped = dedupRecallRows(candidates, nowMs)
  const memories = reflectApply(arraySlice, deduped, [0, contextBudget])
  return {
    directCount: ftsRows.length,
    keywords: copyArray(keywords),
    latencyMs: elapsedSince(startedAt),
    memories: projectRows(memories, RECALL_MEMORY_KEYS),
    totalCandidates: candidates.length,
  }
}

function createBaseHandle(state) {
  const close = function close() {
    return closeBaseState(state)
  }
  const getById = function getMemoryByIdBound(id) {
    if (!state.enabled) return null
    return getMemoryById(state, id)
  }
  const list = function listMemoriesBound(options) {
    if (!state.enabled) return []
    return listMemories(state, options)
  }
  const publicStatus = function publicStatus() {
    return publicStatusFor(state)
  }
  const recall = function recallMemoriesBound(query, options) {
    if (!state.enabled) return emptyRecallResult()
    return recallMemories(state, query, options)
  }
  const search = function searchMemoriesBound(query, options) {
    if (!state.enabled) return []
    return searchMemories(state, query, options)
  }
  const status = function status() {
    return statusFor(state)
  }
  const handle = {
    close,
    config: state.config,
    dbPath: state.dbPath,
    enabled: state.enabled,
    getMemoryById: getById,
    listMemories: list,
    publicStatus,
    recallMemories: recall,
    searchMemories: search,
    status,
  }
  reflectApply(weakMapSet, baseStates, [handle, state])
  return objectFreeze(handle)
}

function disabledBaseHandle(config) {
  const state = {
    bridge: null,
    closed: false,
    config,
    db: null,
    dbPath: null,
    enabled: false,
    entry: null,
    probe: null,
  }
  const handle = createBaseHandle(state)
  state.handle = handle
  return handle
}

function governedInvalidArgument() {
  return reflectConstruct(GovernedMemoryError, [
    'governance_invalid_argument',
    'A valid governed memory argument is required.',
  ])
}

function captureGovernedDeleteInput(input) {
  if (
    input === null ||
    typeof input !== 'object' ||
    reflectApply(isProxy, undefined, [input])
  ) throw governedInvalidArgument()
  const prototype = reflectApply(objectGetPrototypeOf, undefined, [input])
  if (prototype !== objectPrototype && prototype !== null) {
    throw governedInvalidArgument()
  }
  const keys = reflectApply(reflectOwnKeys, undefined, [input])
  const expected = ['id', 'options', 'authorityGrant']
  if (keys.length !== expected.length) throw governedInvalidArgument()
  const values = []
  for (let index = 0; index < expected.length; index += 1) {
    if (keys[index] !== expected[index]) throw governedInvalidArgument()
    const descriptor = reflectGetOwnPropertyDescriptor(input, expected[index])
    if (descriptor === undefined || !objectHasOwn(descriptor, 'value')) {
      throw governedInvalidArgument()
    }
    appendValue(values, descriptor.value)
  }
  return values
}

export function executeGovernedStoreIntent(base, routeKind, input) {
  const state = requireBaseState(base)
  if (!state.enabled || state.closed) throw storeClosedFailure()
  assertEnabledOpen(state)
  if (routeKind === 'legacy_delete_memory') {
    const values = captureGovernedDeleteInput(input)
    return state.bridge.erase(values[0], values[1], values[2])
  }
  if (input !== undefined) throw governedInvalidArgument()
  return state.bridge.refuse(routeKind)
}

function captureStoreOptions(options) {
  const source = options ?? {}
  if (
    source === null ||
    typeof source !== 'object' ||
    reflectApply(isProxy, undefined, [source])
  ) throw invalidPath()
  return objectFreeze({
    clock: source.clock,
    env: source.env,
    memoryEnabled: source.memoryEnabled,
    memoryRootDir: source.memoryRootDir,
    publicDemo: source.publicDemo,
    statePath: source.statePath,
    workspaceId: source.workspaceId,
  })
}

export async function createKernelStoreRuntime(options = {}) {
  const captured = captureStoreOptions(options)
  const config = resolveMemoryConfig(captured)
  if (!config.enabled) return disabledBaseHandle(config)
  const pathCandidate = captureMemoryPathCandidate(captured)
  const { candidate, workspaceId } = pathCandidate
  const source = options ?? {}
  const authorityDescriptor = reflectGetOwnPropertyDescriptor(
    source,
    'authorityRoot',
  )
  let authorityRoot
  if (authorityDescriptor !== undefined) {
    if (!objectHasOwn(authorityDescriptor, 'value')) {
      preflightMemoryAuthorityRoot(undefined, workspaceId)
    }
    authorityRoot = authorityDescriptor.value
    if (authorityRoot !== undefined) {
      preflightMemoryAuthorityRoot(authorityRoot, workspaceId)
    }
  }
  const dbPath = await canonicalMemoryPath(candidate)
  const entry = registryEntry(dbPath)
  return queuePathOperation(entry, () => {
    if (entry.poisoned) throw storeOpenFailure()
    return bootstrapAndConstruct(
      dbPath,
      entry,
      config,
      workspaceId,
      authorityRoot,
    )
  })
}

export async function deleteKernelStoreRuntimeFile() {
  throw reflectConstruct(LegacyMutationError, [
    'legacy_terminal_storage_refused',
    'Terminal deletion of a governed memory store is refused.',
  ])
}

export function probeMemorySqliteDriver() {
  const probe = {
    bilingualRoundTrip: false,
    driver: 'node:sqlite',
    fts5: false,
    status: 'unavailable',
    tokenizer: memoryFtsTokenizer,
  }
  let db
  try {
    db = reflectConstruct(nativeDatabaseSync, [':memory:'])
    execDatabase(
      db,
      `CREATE VIRTUAL TABLE memory_probe_fts USING fts5(
        content,
        tokenize = '${memoryFtsTokenizer}'
      )`,
    )
    runStatement(db, 'INSERT INTO memory_probe_fts(content) VALUES (?)', [
      'Fundación Norte',
    ])
    const row = readRow(
      db,
      'SELECT content FROM memory_probe_fts WHERE memory_probe_fts MATCH ? LIMIT 1',
      ['fundacion'],
    )
    probe.fts5 = true
    probe.bilingualRoundTrip = row?.content === 'Fundación Norte'
    probe.status = probe.bilingualRoundTrip
      ? 'available'
      : 'tokenizer_mismatch'
  } catch (error) {
    probe.errorCategory = error?.code
      ? toString(error.code)
      : 'sqlite_probe_failed'
    probe.status = 'unavailable'
  } finally {
    if (db !== undefined) {
      try {
        reflectApply(databaseClose, db, [])
      } catch {
        probe.status = 'unavailable'
      }
    }
  }
  return probe
}

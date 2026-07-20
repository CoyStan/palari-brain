import {
  decodeAtomRow,
  decodeEventRow,
  validatePrefixedUuidV4,
  validateTimestamp,
} from './memory-bundle-codec.mjs'
import {
  memoryBundleFailure,
  preserveMemoryBundleError,
} from './memory-bundle-errors.mjs'
import {
  execDatabase,
  hasAsciiCaseInsensitivePrefix,
  isNativeSqliteBusyOrLocked,
  prepareRowStatement,
  statementAll,
} from './memory-bundle-runtime.mjs'
import {
  MEMORY_BUNDLE_AUTOINDEXES,
  MEMORY_BUNDLE_FOREIGN_KEY_LIST,
  MEMORY_BUNDLE_INDEX_LIST,
  MEMORY_BUNDLE_INDEX_XINFO,
  MEMORY_BUNDLE_OBJECTS,
  MEMORY_BUNDLE_REQUIRED_PRAGMAS,
  MEMORY_BUNDLE_SCHEMA_VERSION,
  MEMORY_BUNDLE_TABLE_XINFO,
  MEMORY_BUNDLE_TRIGGER_TARGETS,
  normalizeMemoryBundleSql,
} from './memory-bundle-schema.mjs'

const reflectApply = Reflect.apply
const reflectConstruct = Reflect.construct
const reflectDefineProperty = Reflect.defineProperty
const reflectOwnKeys = Reflect.ownKeys
const arraySort = Array.prototype.sort
const numberIsSafeInteger = Number.isSafeInteger
const objectIs = Object.is
const stringCharCodeAt = String.prototype.charCodeAt
const stringFromCharCode = String.fromCharCode
const nativeMap = Map
const nativeSet = Set
const mapGet = Map.prototype.get
const mapHas = Map.prototype.has
const mapSet = Map.prototype.set
const setAdd = Set.prototype.add
const setHas = Set.prototype.has

const CANONICAL_TABLES = Object.freeze([
  'memory_bundle_meta',
  'memory_bundle_events',
  'memory_bundle_atoms',
])
const AUTOINDEX_PREFIX = 'sqlite_autoindex_memory_bundle_'
const AUTOINDEX_TABLES = Object.freeze({
  sqlite_autoindex_memory_bundle_meta_1: 'memory_bundle_meta',
  sqlite_autoindex_memory_bundle_events_1: 'memory_bundle_events',
  sqlite_autoindex_memory_bundle_events_2: 'memory_bundle_events',
  sqlite_autoindex_memory_bundle_atoms_1: 'memory_bundle_atoms',
  sqlite_autoindex_memory_bundle_atoms_2: 'memory_bundle_atoms',
})
const FOREIGN_KEY_SORT_KEYS = Object.freeze([
  'table',
  'from',
  'to',
  'on_update',
  'on_delete',
  'match',
])

function fail(code, message) {
  throw memoryBundleFailure(code, message)
}

function readRows(db, sql) {
  const statement = prepareRowStatement(db, sql)
  return statementAll(statement, [])
}

function compareCodeUnits(left, right) {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function compareNumericField(field) {
  return (left, right) => left[field] - right[field]
}

function compareForeignKeys(left, right) {
  for (let index = 0; index < FOREIGN_KEY_SORT_KEYS.length; index += 1) {
    const key = FOREIGN_KEY_SORT_KEYS[index]
    const comparison = compareCodeUnits(left[key], right[key])
    if (comparison !== 0) return comparison
  }
  return 0
}

function appendValue(values, value) {
  reflectApply(reflectDefineProperty, undefined, [values, values.length, {
    __proto__: null,
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  }])
}

function sortRows(rows, comparator) {
  reflectApply(arraySort, rows, [comparator])
  return rows
}

function containsExact(values, candidate) {
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] === candidate) return true
  }
  return false
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

function hasExactOwnKey(record, key) {
  const keys = reflectOwnKeys(record)
  for (let index = 0; index < keys.length; index += 1) {
    if (keys[index] === key) return true
  }
  return false
}

function recordsEqual(actual, expected) {
  if (
    actual === null ||
    expected === null ||
    typeof actual !== 'object' ||
    typeof expected !== 'object'
  ) {
    return reflectApply(objectIs, undefined, [actual, expected])
  }

  const actualKeys = reflectOwnKeys(actual)
  const expectedKeys = reflectOwnKeys(expected)
  if (actualKeys.length !== expectedKeys.length) return false
  for (let index = 0; index < expectedKeys.length; index += 1) {
    const key = expectedKeys[index]
    if (!hasExactOwnKey(actual, key)) return false
    if (!reflectApply(objectIs, undefined, [actual[key], expected[key]])) {
      return false
    }
  }
  return true
}

function rowArraysEqual(actual, expected) {
  if (actual.length !== expected.length) return false
  for (let index = 0; index < expected.length; index += 1) {
    if (!recordsEqual(actual[index], expected[index])) return false
  }
  return true
}

function projectRows(rows, droppedKeys) {
  const projected = []
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const source = rows[rowIndex]
    const keys = reflectOwnKeys(source)
    const target = { __proto__: null }
    for (let keyIndex = 0; keyIndex < keys.length; keyIndex += 1) {
      const key = keys[keyIndex]
      if (containsExact(droppedKeys, key)) continue
      target[key] = source[key]
    }
    appendValue(projected, target)
  }
  return projected
}

function soleRowValue(rows) {
  if (rows.length !== 1) return undefined
  const keys = reflectOwnKeys(rows[0])
  if (keys.length !== 1) return undefined
  return rows[0][keys[0]]
}

function guardedFailure(error, fallbackCode, fallbackMessage) {
  const preserved = preserveMemoryBundleError(
    error,
    fallbackCode,
    fallbackMessage,
  )
  if (preserved === error) return preserved
  if (isNativeSqliteBusyOrLocked(error)) {
    return memoryBundleFailure(
      'bundle_busy',
      'The memory bundle database is busy or locked.',
      error,
    )
  }
  return preserved
}

function layoutGuard(callback, message) {
  try {
    return callback()
  } catch (error) {
    throw guardedFailure(error, 'bundle_layout_invalid', message)
  }
}

function storageGuard(callback, message) {
  try {
    return callback()
  } catch (error) {
    throw guardedFailure(error, 'bundle_storage_error', message)
  }
}

function readRequiredPragma(db, name) {
  const rows = readRows(db, `PRAGMA ${name}`)
  return soleRowValue(rows)
}

function assertRequiredPragmas(db) {
  const names = reflectOwnKeys(MEMORY_BUNDLE_REQUIRED_PRAGMAS)
  for (let index = 0; index < names.length; index += 1) {
    const name = names[index]
    if (readRequiredPragma(db, name) !== MEMORY_BUNDLE_REQUIRED_PRAGMAS[name]) {
      fail(
        'bundle_connection_invalid',
        `The connection PRAGMA ${name} does not match the bundle policy.`,
      )
    }
  }
}

export function configureOwnedBundleConnection(db) {
  try {
    execDatabase(db, `
      PRAGMA foreign_keys=ON;
      PRAGMA busy_timeout=0;
      PRAGMA recursive_triggers=ON;
      PRAGMA ignore_check_constraints=OFF;
    `)
    assertRequiredPragmas(db)
  } catch (error) {
    throw guardedFailure(
      error,
      'bundle_storage_error',
      'The owned bundle connection could not be configured.',
    )
  }
}

export function assertBorrowedBundleConnection(db) {
  try {
    assertRequiredPragmas(db)
  } catch (error) {
    throw guardedFailure(
      error,
      'bundle_storage_error',
      'The borrowed bundle connection does not match the required policy.',
    )
  }
}

export function rejectCanonicalTempTriggers(db) {
  try {
    const rows = readRows(db, `
      SELECT name, tbl_name
      FROM temp.sqlite_schema
      WHERE type = 'trigger'
      ORDER BY name COLLATE BINARY
    `)
    for (let index = 0; index < rows.length; index += 1) {
      const foldedTarget = asciiFold(rows[index].tbl_name)
      if (foldedTarget === null || containsExact(CANONICAL_TABLES, foldedTarget)) {
        fail(
          'bundle_connection_invalid',
          'A TEMP trigger targets a canonical memory bundle table.',
        )
      }
    }
  } catch (error) {
    throw guardedFailure(
      error,
      'bundle_storage_error',
      'TEMP trigger state could not be accepted.',
    )
  }
}

function requireMetaTable(db) {
  const rows = readRows(db, `
    SELECT type
    FROM main.sqlite_schema
    WHERE name = 'memory_bundle_meta'
    ORDER BY type COLLATE BINARY
  `)
  if (rows.length !== 1 || rows[0].type !== 'table') {
    fail('bundle_layout_invalid', 'The canonical meta table is missing.')
  }
}

function readMetaPreflight(db) {
  const rows = readRows(db, `
    SELECT singleton, schema_version
    FROM main.memory_bundle_meta
    WHERE singleton = 1
  `)
  if (rows.length !== 1 || rows[0].singleton !== 1) {
    fail(
      'bundle_layout_invalid',
      'The canonical meta singleton is missing or duplicated.',
    )
  }
  return rows[0]
}

function readSchemaInventory(db) {
  const rows = readRows(db, `
    SELECT type, name, tbl_name, sql
    FROM main.sqlite_schema
  `)
  const candidates = []
  for (let index = 0; index < rows.length; index += 1) {
    if (
      hasAsciiCaseInsensitivePrefix(rows[index].name, 'memory_bundle_') ||
      hasAsciiCaseInsensitivePrefix(
        rows[index].name,
        'sqlite_autoindex_memory_bundle_',
      )
    ) {
      appendValue(candidates, rows[index])
    }
  }
  return sortRows(
    candidates,
    (left, right) => compareCodeUnits(left.name, right.name),
  )
}

function verifyObjectInventory(rows) {
  const applicationRows = []
  const autoindexRows = []
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    if (hasAsciiCaseInsensitivePrefix(row.name, AUTOINDEX_PREFIX)) {
      appendValue(autoindexRows, {
        type: row.type,
        name: row.name,
        table: row.tbl_name,
        sql: row.sql,
      })
    } else {
      appendValue(applicationRows, { type: row.type, name: row.name })
    }
  }

  const expectedApplications = []
  for (let index = 0; index < MEMORY_BUNDLE_OBJECTS.length; index += 1) {
    const { type, name } = MEMORY_BUNDLE_OBJECTS[index]
    appendValue(expectedApplications, { type, name })
  }
  sortRows(expectedApplications, (left, right) => compareCodeUnits(left.name, right.name))

  const expectedAutoindexes = []
  for (let index = 0; index < MEMORY_BUNDLE_AUTOINDEXES.length; index += 1) {
    const name = MEMORY_BUNDLE_AUTOINDEXES[index].name
    appendValue(expectedAutoindexes, {
      type: 'index',
      name,
      table: AUTOINDEX_TABLES[name],
      sql: null,
    })
  }
  sortRows(expectedAutoindexes, (left, right) => compareCodeUnits(left.name, right.name))

  if (
    !rowArraysEqual(applicationRows, expectedApplications) ||
    !rowArraysEqual(autoindexRows, expectedAutoindexes)
  ) {
    fail('bundle_layout_invalid', 'The main bundle object inventory is invalid.')
  }
}

function verifyTriggerTargets(db) {
  const rows = readRows(db, `
    SELECT name, tbl_name
    FROM main.sqlite_schema
    WHERE type = 'trigger'
    ORDER BY name COLLATE BINARY
  `)
  const actual = []
  for (let index = 0; index < rows.length; index += 1) {
    const table = asciiFold(rows[index].tbl_name)
    if (table !== null && containsExact(CANONICAL_TABLES, table)) {
      appendValue(actual, { name: rows[index].name, table })
    }
  }
  if (!rowArraysEqual(actual, MEMORY_BUNDLE_TRIGGER_TARGETS)) {
    fail(
      'bundle_layout_invalid',
      'The canonical main trigger target inventory is invalid.',
    )
  }
}

function findInventoryRow(rows, name) {
  for (let index = 0; index < rows.length; index += 1) {
    if (rows[index].name === name) return rows[index]
  }
  return undefined
}

function verifyStoredSql(inventoryRows) {
  const entries = []
  for (let index = 0; index < MEMORY_BUNDLE_OBJECTS.length; index += 1) {
    appendValue(entries, MEMORY_BUNDLE_OBJECTS[index])
  }
  sortRows(entries, (left, right) => compareCodeUnits(left.name, right.name))

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]
    const row = findInventoryRow(inventoryRows, entry.name)
    if (
      row === undefined ||
      typeof row.sql !== 'string' ||
      normalizeMemoryBundleSql(row.sql) !==
        normalizeMemoryBundleSql(entry.persistedSql)
    ) {
      fail('bundle_layout_invalid', `Stored SQL for ${entry.name} is invalid.`)
    }
  }
}

function verifyPragmaManifest(db) {
  for (let index = 0; index < CANONICAL_TABLES.length; index += 1) {
    const table = CANONICAL_TABLES[index]
    const tableXinfo = projectRows(
      readRows(db, `PRAGMA main.table_xinfo(${table})`),
      [],
    )
    sortRows(tableXinfo, compareNumericField('cid'))
    if (!rowArraysEqual(tableXinfo, MEMORY_BUNDLE_TABLE_XINFO[table])) {
      fail('bundle_layout_invalid', `table_xinfo for ${table} is invalid.`)
    }

    const indexList = projectRows(
      readRows(db, `PRAGMA main.index_list(${table})`),
      ['seq'],
    )
    sortRows(indexList, (left, right) => compareCodeUnits(left.name, right.name))
    if (!rowArraysEqual(indexList, MEMORY_BUNDLE_INDEX_LIST[table])) {
      fail('bundle_layout_invalid', `index_list for ${table} is invalid.`)
    }

    const foreignKeys = projectRows(
      readRows(db, `PRAGMA main.foreign_key_list(${table})`),
      ['id', 'seq'],
    )
    sortRows(foreignKeys, compareForeignKeys)
    if (!rowArraysEqual(foreignKeys, MEMORY_BUNDLE_FOREIGN_KEY_LIST[table])) {
      fail('bundle_layout_invalid', `foreign_key_list for ${table} is invalid.`)
    }
  }

  const indexNames = reflectOwnKeys(MEMORY_BUNDLE_INDEX_XINFO)
  sortRows(indexNames, compareCodeUnits)
  for (let index = 0; index < indexNames.length; index += 1) {
    const name = indexNames[index]
    const indexXinfo = projectRows(
      readRows(db, `PRAGMA main.index_xinfo(${name})`),
      [],
    )
    sortRows(indexXinfo, compareNumericField('seqno'))
    if (!rowArraysEqual(indexXinfo, MEMORY_BUNDLE_INDEX_XINFO[name])) {
      fail('bundle_layout_invalid', `index_xinfo for ${name} is invalid.`)
    }
  }
}

function verifyIntegrityChecks(db) {
  if (readRows(db, 'PRAGMA main.foreign_key_check').length !== 0) {
    fail('bundle_layout_invalid', 'The bundle has foreign-key violations.')
  }
  const quickRows = readRows(db, 'PRAGMA main.quick_check')
  if (soleRowValue(quickRows) !== 'ok') {
    fail('bundle_layout_invalid', 'The bundle quick check is not clean.')
  }
}

function readAndValidateMeta(db) {
  const rows = storageGuard(
    () => readRows(db, `
      SELECT singleton, schema_version, stream_id, head_sequence, created_at
      FROM main.memory_bundle_meta
      WHERE singleton = 1
    `),
    'The canonical meta row could not be read.',
  )
  if (rows.length !== 1) {
    fail('bundle_meta_mismatch', 'The canonical meta singleton is invalid.')
  }
  const row = rows[0]
  if (
    row.singleton !== 1 ||
    row.schema_version !== MEMORY_BUNDLE_SCHEMA_VERSION
  ) {
    fail('bundle_meta_mismatch', 'The canonical meta identity is invalid.')
  }
  validatePrefixedUuidV4(row.stream_id, 'str_', 'bundle_meta_mismatch')
  if (
    typeof row.head_sequence !== 'number' ||
    !reflectApply(numberIsSafeInteger, undefined, [row.head_sequence]) ||
    row.head_sequence < 0
  ) {
    fail('bundle_meta_mismatch', 'The canonical meta head is invalid.')
  }
  validateTimestamp(row.created_at, 'bundle_meta_mismatch')
  return {
    streamId: row.stream_id,
    headSequence: row.head_sequence,
  }
}

function readEventRows(db) {
  return storageGuard(
    () => readRows(db, `
      SELECT
        sequence, stream_id, decision_id, proposal_id, proposal_kind,
        operation, outcome, reason_code, palari_id, user_id,
        authority_kind, authority_id, evidence_kind, memory_id, memory_type,
        effective_at, observed_at
      FROM main.memory_bundle_events
      ORDER BY sequence ASC
    `),
    'Canonical event rows could not be read.',
  )
}

function readAtomRows(db) {
  return storageGuard(
    () => readRows(db, `
      SELECT
        memory_id, stream_id, created_sequence, palari_id, user_id, type,
        content, keywords_json, initial_importance, confidence,
        provenance_kind, source_message_id, valid_from, created_at, fictional,
        content_checksum
      FROM main.memory_bundle_atoms
      ORDER BY memory_id COLLATE BINARY
    `),
    'Canonical atom rows could not be read.',
  )
}

function validateEventSequences(rows, headSequence) {
  if (rows.length !== headSequence) {
    fail('bundle_meta_mismatch', 'The event sequence does not match the meta head.')
  }
  for (let index = 0; index < rows.length; index += 1) {
    const sequence = rows[index].sequence
    if (
      typeof sequence !== 'number' ||
      !reflectApply(numberIsSafeInteger, undefined, [sequence]) ||
      sequence !== index + 1
    ) {
      fail('bundle_meta_mismatch', 'The event sequence is not contiguous.')
    }
  }
}

function validateAtomCorrespondence(atom, createEvent, streamId) {
  if (
    atom.memoryId !== createEvent.memoryId ||
    atom.streamId !== streamId ||
    atom.streamId !== createEvent.streamId ||
    atom.createdSequence !== createEvent.sequence ||
    atom.palariId !== createEvent.palariId ||
    atom.userId !== createEvent.userId ||
    atom.type !== createEvent.memoryType ||
    atom.validFrom !== createEvent.effectiveAt ||
    atom.createdAt !== createEvent.observedAt
  ) {
    fail('bundle_invalid_atom', 'The canonical atom does not match its create event.')
  }
}

function reduceVerifiedEvents(eventRows, meta) {
  const retainedByMemoryId = reflectConstruct(nativeMap, [])
  const seenDecisionIds = reflectConstruct(nativeSet, [])
  const seenProposalIds = reflectConstruct(nativeSet, [])
  const createdMemoryIds = []
  let lastObservedAt = null

  const events = []
  for (let index = 0; index < eventRows.length; index += 1) {
    const event = decodeEventRow(eventRows[index], false)
    if (event.streamId !== meta.streamId) {
      fail('bundle_meta_mismatch', 'An event stream does not match the meta stream.')
    }
    if (reflectApply(setHas, seenDecisionIds, [event.decisionId])) {
      fail('bundle_invalid_decision', 'A persisted decision id is duplicated.')
    }
    if (reflectApply(setHas, seenProposalIds, [event.proposalId])) {
      fail('bundle_invalid_decision', 'A persisted proposal id is duplicated.')
    }
    reflectApply(setAdd, seenDecisionIds, [event.decisionId])
    reflectApply(setAdd, seenProposalIds, [event.proposalId])
    appendValue(events, event)
  }

  for (let index = 0; index < eventRows.length; index += 1) {
    decodeEventRow(eventRows[index])
  }

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index]
    if (lastObservedAt !== null && event.observedAt < lastObservedAt) {
      fail('bundle_invalid_transition', 'Persisted observed time decreases.')
    }
    lastObservedAt = event.observedAt
  }

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index]
    if (event.outcome === 'refused') continue
    if (event.operation === 'create') {
      if (reflectApply(mapHas, retainedByMemoryId, [event.memoryId])) {
        fail('bundle_id_reuse', 'A persisted memory id is reused.')
      }
      const retained = {
        palariId: event.palariId,
        userId: event.userId,
        status: 'active',
        createEvent: event,
      }
      reflectApply(mapSet, retainedByMemoryId, [event.memoryId, retained])
      appendValue(createdMemoryIds, event.memoryId)
      continue
    }

    const retained = reflectApply(mapGet, retainedByMemoryId, [event.memoryId])
    if (retained === undefined) {
      fail('bundle_invalid_transition', 'A persisted delete has no prior create.')
    }
    if (
      retained.palariId !== event.palariId ||
      retained.userId !== event.userId
    ) {
      fail('bundle_unauthorized', 'A persisted delete crosses retained scope.')
    }
    if (retained.status === 'deleted') {
      fail('bundle_invalid_transition', 'A persisted memory is deleted twice.')
    }
    retained.status = 'deleted'
  }

  return {
    retainedByMemoryId,
    seenDecisionIds,
    seenProposalIds,
    createdMemoryIds,
    lastObservedAt,
  }
}

function verifyAndMaterializeAtoms(atomRows, eventState, meta) {
  const expectedActiveIds = []
  for (let index = 0; index < eventState.createdMemoryIds.length; index += 1) {
    const memoryId = eventState.createdMemoryIds[index]
    const retained = reflectApply(
      mapGet,
      eventState.retainedByMemoryId,
      [memoryId],
    )
    if (retained.status === 'active') appendValue(expectedActiveIds, memoryId)
  }
  sortRows(expectedActiveIds, compareCodeUnits)

  const capturedAtoms = []
  const actualIds = []
  for (let index = 0; index < atomRows.length; index += 1) {
    const captured = decodeAtomRow(atomRows[index], false)
    appendValue(capturedAtoms, captured)
    appendValue(actualIds, captured.atom.memoryId)
  }

  let expectedIndex = 0
  let actualIndex = 0
  while (
    expectedIndex < expectedActiveIds.length &&
    actualIndex < actualIds.length
  ) {
    const expectedId = expectedActiveIds[expectedIndex]
    const actualId = actualIds[actualIndex]
    const comparison = compareCodeUnits(expectedId, actualId)
    if (comparison < 0) {
      fail('bundle_missing_atom', 'An active memory is missing its atom.')
    }
    if (comparison > 0) {
      fail('bundle_orphan_atom', 'An atom has no active create event.')
    }
    const retained = reflectApply(
      mapGet,
      eventState.retainedByMemoryId,
      [expectedId],
    )
    validateAtomCorrespondence(
      capturedAtoms[actualIndex].atom,
      retained.createEvent,
      meta.streamId,
    )
    expectedIndex += 1
    actualIndex += 1
  }
  if (expectedIndex < expectedActiveIds.length) {
    fail('bundle_missing_atom', 'An active memory is missing its atom.')
  }
  if (actualIndex < actualIds.length) {
    fail('bundle_orphan_atom', 'An atom has no active create event.')
  }

  const memories = []
  for (let index = 0; index < capturedAtoms.length; index += 1) {
    appendValue(
      memories,
      reflectApply(capturedAtoms[index].materialize, undefined, []),
    )
  }
  return memories
}

export function verifyMemoryBundleState(db) {
  layoutGuard(
    () => requireMetaTable(db),
    'The canonical meta object could not be located.',
  )
  const preflight = layoutGuard(
    () => readMetaPreflight(db),
    'The canonical meta preflight is unreadable.',
  )
  if (preflight.schema_version !== MEMORY_BUNDLE_SCHEMA_VERSION) {
    fail(
      'bundle_schema_unsupported',
      'The memory bundle schema version is not supported.',
    )
  }

  const inventoryRows = layoutGuard(
    () => {
      const rows = readSchemaInventory(db)
      verifyObjectInventory(rows)
      return rows
    },
    'The canonical object inventory is invalid.',
  )
  layoutGuard(
    () => verifyTriggerTargets(db),
    'The canonical trigger target inventory is invalid.',
  )
  layoutGuard(
    () => verifyStoredSql(inventoryRows),
    'Stored canonical SQL is invalid.',
  )
  layoutGuard(
    () => verifyPragmaManifest(db),
    'The projected canonical schema is invalid.',
  )
  layoutGuard(
    () => verifyIntegrityChecks(db),
    'The canonical bundle integrity checks failed.',
  )

  const meta = readAndValidateMeta(db)
  const eventRows = readEventRows(db)
  validateEventSequences(eventRows, meta.headSequence)
  const eventState = reduceVerifiedEvents(eventRows, meta)
  const atomRows = readAtomRows(db)
  const memories = verifyAndMaterializeAtoms(atomRows, eventState, meta)
  const lastSequence = eventRows.length === 0
    ? 0
    : eventRows[eventRows.length - 1].sequence
  if (meta.headSequence !== lastSequence) {
    fail('bundle_meta_mismatch', 'The canonical meta head does not match events.')
  }
  return {
    checkpoint: {
      streamId: meta.streamId,
      sequence: meta.headSequence,
    },
    memories,
    retainedByMemoryId: eventState.retainedByMemoryId,
    seenDecisionIds: eventState.seenDecisionIds,
    seenProposalIds: eventState.seenProposalIds,
    lastObservedAt: eventState.lastObservedAt,
  }
}

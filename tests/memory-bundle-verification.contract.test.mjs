import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { test } from 'node:test'

import * as schemaModule from '../src/memory-bundle-schema.mjs'
import {
  EXPECTED_AUTOINDEX_NAMES,
  EXPECTED_CAPABILITIES,
  EXPECTED_FOREIGN_KEY_LIST,
  EXPECTED_INDEX_LIST,
  EXPECTED_INDEX_XINFO,
  EXPECTED_OBJECTS,
  EXPECTED_PERSISTED_SQL,
  EXPECTED_REQUIRED_PRAGMAS,
  EXPECTED_TABLE_XINFO,
  EXPECTED_TRIGGER_TARGETS,
} from './helpers/memory-bundle-fixtures.mjs'

const TABLE_NAMES = [
  'memory_bundle_meta',
  'memory_bundle_events',
  'memory_bundle_atoms',
]

function normalizeExpectedSql(sql) {
  let normalized = sql.replaceAll('\r\n', '\n').replace(/^[\t\n\v\f\r ]+|[\t\n\v\f\r ]+$/g, '')
  normalized = normalized.replace(/;[\t\n\v\f\r ]*$/, '')
  return normalized.replace(/[\t\n\v\f\r ]+$/g, '')
}

function expectedExecutionSql(type, name) {
  const persistedSql = EXPECTED_PERSISTED_SQL[name]
  if (type === 'table') {
    return persistedSql.replace(`CREATE TABLE ${name}`, `CREATE TABLE main.${name}`)
  }
  if (type === 'index') {
    return persistedSql.replace(
      `CREATE UNIQUE INDEX ${name}`,
      `CREATE UNIQUE INDEX main.${name}`,
    )
  }
  return persistedSql.replace(
    `CREATE TRIGGER ${name}`,
    `CREATE TRIGGER main.${name}`,
  )
}

function compareBinary(left, right) {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function compareForeignKeyTuple(left, right) {
  const keys = ['table', 'from', 'to', 'on_update', 'on_delete', 'match']
  for (const key of keys) {
    const comparison = compareBinary(left[key], right[key])
    if (comparison !== 0) return comparison
  }
  return 0
}

function projectTableXinfo(rows) {
  return rows.map(({ cid, name, type, notnull, dflt_value, pk, hidden }) => ({
    cid,
    name,
    type,
    notnull,
    dflt_value,
    pk,
    hidden,
  }))
}

function projectIndexList(rows) {
  return rows
    .map(({ name, unique, origin, partial }) => ({
      name,
      unique,
      origin,
      partial,
    }))
    .sort((left, right) => compareBinary(left.name, right.name))
}

function projectIndexXinfo(rows) {
  return rows.map(({ seqno, cid, name, desc, coll, key }) => ({
    seqno,
    cid,
    name,
    desc,
    coll,
    key,
  }))
}

function projectForeignKeyList(rows) {
  return rows
    .map(({ table, from, to, on_update, on_delete, match }) => ({
      table,
      from,
      to,
      on_update,
      on_delete,
      match,
    }))
    .sort(compareForeignKeyTuple)
}

function assertDeepFrozen(value) {
  assert.ok(Object.isFrozen(value))
  for (const child of Object.values(value)) {
    if (child !== null && typeof child === 'object') assertDeepFrozen(child)
  }
}

test('M1-03 pins the exact frozen private manifest constants', async () => {
  assert.deepEqual(Object.keys(schemaModule).sort(), [
    'MEMORY_BUNDLE_AUTOINDEXES',
    'MEMORY_BUNDLE_CAPABILITIES',
    'MEMORY_BUNDLE_OBJECTS',
    'MEMORY_BUNDLE_REQUIRED_PRAGMAS',
    'MEMORY_BUNDLE_SCHEMA_VERSION',
    'MEMORY_BUNDLE_TRIGGER_TARGETS',
    'normalizeMemoryBundleSql',
  ])
  assert.equal(schemaModule.MEMORY_BUNDLE_SCHEMA_VERSION, 'CDX-B1')
  assert.deepEqual(schemaModule.MEMORY_BUNDLE_CAPABILITIES, EXPECTED_CAPABILITIES)
  assert.deepEqual(Object.keys(schemaModule.MEMORY_BUNDLE_CAPABILITIES), [
    'sourceOfTruth',
    'physicalDeletion',
    'deletionProvable',
    'signed',
    'cryptographicAudit',
    'externalAnchorRequired',
  ])
  assert.deepEqual(
    Object.values(schemaModule.MEMORY_BUNDLE_CAPABILITIES),
    [false, false, false, false, false, false],
  )
  assertDeepFrozen(schemaModule.MEMORY_BUNDLE_CAPABILITIES)
  const reimported = await import('../src/memory-bundle-schema.mjs')
  assert.equal(
    reimported.MEMORY_BUNDLE_CAPABILITIES,
    schemaModule.MEMORY_BUNDLE_CAPABILITIES,
  )

  assert.equal(schemaModule.MEMORY_BUNDLE_OBJECTS.length, 13)
  assert.deepEqual(
    schemaModule.MEMORY_BUNDLE_OBJECTS.map(({ type, name }) => ({ type, name })),
    EXPECTED_OBJECTS,
  )
  assert.deepEqual(
    schemaModule.MEMORY_BUNDLE_OBJECTS.reduce(
      (counts, { type }) => ({ ...counts, [type]: counts[type] + 1 }),
      { table: 0, index: 0, trigger: 0 },
    ),
    { table: 3, index: 2, trigger: 8 },
  )
  assertDeepFrozen(schemaModule.MEMORY_BUNDLE_OBJECTS)
  for (const entry of schemaModule.MEMORY_BUNDLE_OBJECTS) {
    assert.deepEqual(Object.keys(entry), [
      'type',
      'name',
      'executionSql',
      'persistedSql',
    ])
    assert.equal(entry.persistedSql, EXPECTED_PERSISTED_SQL[entry.name])
    assert.equal(entry.executionSql, expectedExecutionSql(entry.type, entry.name))
  }

  assert.deepEqual(
    schemaModule.MEMORY_BUNDLE_AUTOINDEXES.map(({ name }) => name),
    EXPECTED_AUTOINDEX_NAMES,
  )
  assert.equal(schemaModule.MEMORY_BUNDLE_AUTOINDEXES.length, 5)
  for (const entry of schemaModule.MEMORY_BUNDLE_AUTOINDEXES) {
    assert.deepEqual(Object.keys(entry), ['name', 'indexXinfo'])
    assert.deepEqual(entry.indexXinfo, EXPECTED_INDEX_XINFO[entry.name])
  }
  assertDeepFrozen(schemaModule.MEMORY_BUNDLE_AUTOINDEXES)

  assert.deepEqual(
    schemaModule.MEMORY_BUNDLE_TRIGGER_TARGETS,
    EXPECTED_TRIGGER_TARGETS,
  )
  assert.equal(schemaModule.MEMORY_BUNDLE_TRIGGER_TARGETS.length, 8)
  assertDeepFrozen(schemaModule.MEMORY_BUNDLE_TRIGGER_TARGETS)

  assert.deepEqual(
    schemaModule.MEMORY_BUNDLE_REQUIRED_PRAGMAS,
    EXPECTED_REQUIRED_PRAGMAS,
  )
  assertDeepFrozen(schemaModule.MEMORY_BUNDLE_REQUIRED_PRAGMAS)
})

test('M1-03 normalizes only CRLF, outer ASCII whitespace, and one trailing semicolon', () => {
  const { normalizeMemoryBundleSql } = schemaModule
  assert.equal(normalizeMemoryBundleSql('\r\n \tSELECT  1;\r\n'), 'SELECT  1')
  assert.equal(normalizeMemoryBundleSql('SELECT\r\n1'), 'SELECT\n1')
  assert.equal(normalizeMemoryBundleSql('\v\fSELECT 1\r\t'), 'SELECT 1')
  assert.equal(normalizeMemoryBundleSql('SELECT 1;; \t'), 'SELECT 1;')
  assert.equal(
    normalizeMemoryBundleSql('SELECT  1\nFROM\tthing'),
    'SELECT  1\nFROM\tthing',
  )
  assert.equal(normalizeMemoryBundleSql('SELECT\r1'), 'SELECT\r1')
  assert.equal(
    normalizeMemoryBundleSql(' SELECT 1; '),
    ' SELECT 1; ',
  )
})

test('M1-03 executes all objects into main under TEMP and attached shadows', () => {
  const db = new DatabaseSync(':memory:')
  try {
    db.exec("ATTACH DATABASE ':memory:' AS attached_shadow")
    for (const { name } of EXPECTED_OBJECTS) {
      db.exec(`CREATE TEMP TABLE "${name}" (shadow_value TEXT)`)
      db.exec(`CREATE TABLE attached_shadow."${name}" (shadow_value TEXT)`)
    }

    for (const { executionSql } of schemaModule.MEMORY_BUNDLE_OBJECTS) {
      db.exec(executionSql)
    }

    const applicationRows = db.prepare(`
      SELECT type, name, tbl_name, sql
      FROM main.sqlite_schema
      WHERE name GLOB 'memory_bundle_*'
      ORDER BY type, name
    `).all()
    assert.equal(applicationRows.length, 13)
    assert.deepEqual(
      applicationRows.map(({ type, name }) => ({ type, name })),
      [...EXPECTED_OBJECTS].sort((left, right) => {
        const typeComparison = compareBinary(left.type, right.type)
        return typeComparison || compareBinary(left.name, right.name)
      }),
    )
    for (const row of applicationRows) {
      assert.equal(
        normalizeExpectedSql(row.sql),
        normalizeExpectedSql(EXPECTED_PERSISTED_SQL[row.name]),
      )
    }

    const tempShadows = db
      .prepare(`
        SELECT name
        FROM temp.sqlite_schema
        WHERE type = 'table' AND name GLOB 'memory_bundle_*'
        ORDER BY name
      `)
      .all()
      .map(({ name }) => ({ name }))
    const attachedShadows = db
      .prepare(`
        SELECT name
        FROM attached_shadow.sqlite_schema
        WHERE type = 'table' AND name GLOB 'memory_bundle_*'
        ORDER BY name
      `)
      .all()
      .map(({ name }) => ({ name }))
    const expectedShadowNames = EXPECTED_OBJECTS.map(({ name }) => name)
      .sort(compareBinary)
      .map((name) => ({ name }))
    assert.deepEqual(tempShadows, expectedShadowNames)
    assert.deepEqual(attachedShadows, expectedShadowNames)

    const observedColumnCounts = []
    for (const table of TABLE_NAMES) {
      const tableXinfo = projectTableXinfo(
        db.prepare(`PRAGMA main.table_xinfo(${table})`).all(),
      )
      observedColumnCounts.push(tableXinfo.length)
      assert.deepEqual(tableXinfo, EXPECTED_TABLE_XINFO[table])
      assert.ok(tableXinfo.every(({ dflt_value }) => dflt_value === null))

      const indexList = db.prepare(`PRAGMA main.index_list(${table})`).all()
      assert.deepEqual(projectIndexList(indexList), EXPECTED_INDEX_LIST[table])

      const foreignKeyList = db
        .prepare(`PRAGMA main.foreign_key_list(${table})`)
        .all()
      assert.deepEqual(
        projectForeignKeyList(foreignKeyList),
        EXPECTED_FOREIGN_KEY_LIST[table],
      )
    }

    assert.deepEqual(observedColumnCounts, [5, 17, 16])
    for (const [index, expected] of Object.entries(EXPECTED_INDEX_XINFO)) {
      const actual = projectIndexXinfo(
        db.prepare(`PRAGMA main.index_xinfo(${index})`).all(),
      )
      assert.deepEqual(actual, expected)
    }

    const triggerTargets = applicationRows
      .filter(({ type }) => type === 'trigger')
      .map(({ name, tbl_name: table }) => ({ name, table }))
      .sort((left, right) => compareBinary(left.name, right.name))
    assert.deepEqual(triggerTargets, EXPECTED_TRIGGER_TARGETS)

    const eventColumns = db
      .prepare('PRAGMA main.table_xinfo(memory_bundle_events)')
      .all()
      .map(({ name }) => name)
    assert.deepEqual(
      eventColumns,
      EXPECTED_TABLE_XINFO.memory_bundle_events.map(({ name }) => name),
    )
    for (const name of eventColumns) {
      assert.doesNotMatch(
        name,
        /content|keyword|source_?message|free_?text|extractor|model|checksum/i,
      )
    }
  } finally {
    db.close()
  }
})

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { hash as nativeHash } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync, StatementSync } from 'node:sqlite'
import { test } from 'node:test'

import * as codecModule from '../src/memory-bundle-codec.mjs'
import * as schemaModule from '../src/memory-bundle-schema.mjs'
import * as verifyModule from '../src/memory-bundle-verify.mjs'
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
  M1_04_IDS,
  M1_05_META,
  createM105Bundle,
  insertM105AtomRow,
  insertM105EventRow,
  makeM104AtomRow,
  makeM104CanonicalAtom,
  makeM104EventRow,
  spoofM105StoredSql,
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
    'MEMORY_BUNDLE_FOREIGN_KEY_LIST',
    'MEMORY_BUNDLE_INDEX_LIST',
    'MEMORY_BUNDLE_INDEX_XINFO',
    'MEMORY_BUNDLE_OBJECTS',
    'MEMORY_BUNDLE_REQUIRED_PRAGMAS',
    'MEMORY_BUNDLE_SCHEMA_VERSION',
    'MEMORY_BUNDLE_TABLE_XINFO',
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
  assert.deepEqual(schemaModule.MEMORY_BUNDLE_TABLE_XINFO, EXPECTED_TABLE_XINFO)
  assert.deepEqual(schemaModule.MEMORY_BUNDLE_INDEX_LIST, EXPECTED_INDEX_LIST)
  assert.deepEqual(schemaModule.MEMORY_BUNDLE_INDEX_XINFO, EXPECTED_INDEX_XINFO)
  assert.deepEqual(
    schemaModule.MEMORY_BUNDLE_FOREIGN_KEY_LIST,
    EXPECTED_FOREIGN_KEY_LIST,
  )
  assertDeepFrozen(schemaModule.MEMORY_BUNDLE_TABLE_XINFO)
  assertDeepFrozen(schemaModule.MEMORY_BUNDLE_INDEX_LIST)
  assertDeepFrozen(schemaModule.MEMORY_BUNDLE_INDEX_XINFO)
  assertDeepFrozen(schemaModule.MEMORY_BUNDLE_FOREIGN_KEY_LIST)
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

function assertM104BundleCode(callback, expectedCode) {
  assert.throws(callback, (error) => {
    assert.equal(error?.code, expectedCode)
    return true
  })
}

function makeM104RowTrapProxy(value, counter) {
  const trap = () => {
    counter.count += 1
    throw new Error('row Proxy trap ran')
  }
  return new Proxy(value, {
    get: trap,
    getPrototypeOf: trap,
    ownKeys: trap,
    getOwnPropertyDescriptor: trap,
  })
}

function cloneM104NullRow(value) {
  return Object.defineProperties(
    Object.create(null),
    Object.getOwnPropertyDescriptors(value),
  )
}

const M1_04_ATOM_CHECKSUM =
  '7b73a4dd7913043b54961fb0d97ac3a09ba433f744ce5162b0d9af6224b21ab8'

test('M1-04 encodes the exact persisted atom row and decodes the exact replay shape', () => {
  const atom = makeM104CanonicalAtom()
  const row = codecModule.encodeAtomRow(atom)
  assert.equal(Object.getPrototypeOf(row), Object.prototype)
  assert.deepEqual(row, { ...makeM104AtomRow() })
  assert.deepEqual(Object.keys(row), [
    'memory_id',
    'stream_id',
    'created_sequence',
    'palari_id',
    'user_id',
    'type',
    'content',
    'keywords_json',
    'initial_importance',
    'confidence',
    'provenance_kind',
    'source_message_id',
    'valid_from',
    'created_at',
    'fictional',
    'content_checksum',
  ])
  assert.equal(row.keywords_json, '["no sugar","tea"]')
  assert.equal(row.fictional, 0)
  assert.equal(row.content_checksum, M1_04_ATOM_CHECKSUM)

  const decoded = codecModule.decodeAtomRow(makeM104AtomRow())
  assert.equal(Object.getPrototypeOf(decoded), Object.prototype)
  assert.equal(Object.getPrototypeOf(decoded.keywords), Array.prototype)
  assert.deepEqual(Object.keys(decoded), [
    'memoryId',
    'streamId',
    'createdSequence',
    'palariId',
    'userId',
    'type',
    'content',
    'keywords',
    'initialImportance',
    'confidence',
    'provenanceKind',
    'sourceMessageId',
    'validFrom',
    'createdAt',
    'fictional',
    'contentChecksum',
  ])
  assert.deepEqual(decoded, {
    ...atom,
    keywords: ['no sugar', 'tea'],
    contentChecksum: M1_04_ATOM_CHECKSUM,
  })
})

test('M1-04 atom row decoding rejects Proxies and exact-shape defects without traps or getters', () => {
  for (const revoked of [false, true]) {
    const counter = { count: 0 }
    let proxy
    if (revoked) {
      const revocable = Proxy.revocable(makeM104AtomRow(), {
        get() {
          counter.count += 1
          throw new Error('revoked row trap ran')
        },
      })
      proxy = revocable.proxy
      revocable.revoke()
    } else {
      proxy = makeM104RowTrapProxy(makeM104AtomRow(), counter)
    }
    assertM104BundleCode(
      () => codecModule.decodeAtomRow(proxy),
      'bundle_invalid_atom',
    )
    assert.equal(counter.count, 0)
  }

  const ordinaryPrototype = { ...makeM104AtomRow() }
  assertM104BundleCode(
    () => codecModule.decodeAtomRow(ordinaryPrototype),
    'bundle_invalid_atom',
  )
  assertM104BundleCode(
    () => codecModule.decodeAtomRow([]),
    'bundle_invalid_atom',
  )

  const missing = cloneM104NullRow(makeM104AtomRow())
  Reflect.deleteProperty(missing, 'content')
  assertM104BundleCode(
    () => codecModule.decodeAtomRow(missing),
    'bundle_invalid_atom',
  )
  const extra = cloneM104NullRow(makeM104AtomRow())
  extra.extra = true
  assertM104BundleCode(
    () => codecModule.decodeAtomRow(extra),
    'bundle_invalid_atom',
  )
  const symbolic = cloneM104NullRow(makeM104AtomRow())
  symbolic[Symbol('extra')] = true
  assertM104BundleCode(
    () => codecModule.decodeAtomRow(symbolic),
    'bundle_invalid_atom',
  )
  const accessor = cloneM104NullRow(makeM104AtomRow())
  let getterCalls = 0
  Object.defineProperty(accessor, 'content', {
    enumerable: true,
    configurable: true,
    get() {
      getterCalls += 1
      throw new Error('row getter ran')
    },
  })
  assertM104BundleCode(
    () => codecModule.decodeAtomRow(accessor),
    'bundle_invalid_atom',
  )
  assert.equal(getterCalls, 0)
  const nonEnumerable = cloneM104NullRow(makeM104AtomRow())
  Object.defineProperty(nonEnumerable, 'content', {
    ...Object.getOwnPropertyDescriptor(nonEnumerable, 'content'),
    enumerable: false,
  })
  assertM104BundleCode(
    () => codecModule.decodeAtomRow(nonEnumerable),
    'bundle_invalid_atom',
  )
})

test('M1-04 atom row decoding requires canonical keyword JSON, Unicode, numbers, booleans, and checksum', () => {
  for (const keywords_json of [
    '["no sugar", "tea"]',
    '["tea","no sugar"]',
    '["tea","tea"]',
    '["no sugar","\\u0074ea"]',
    '[""]',
    '["\\ud800"]',
    '{}',
    'not-json',
  ]) {
    assertM104BundleCode(
      () => codecModule.decodeAtomRow(makeM104AtomRow({ keywords_json })),
      'bundle_invalid_atom',
    )
  }
  for (const content of ['bad\uD800', 'bad\uDC00']) {
    assertM104BundleCode(
      () => codecModule.decodeAtomRow(makeM104AtomRow({ content })),
      'bundle_invalid_atom',
    )
  }
  for (const [field, values] of [
    ['initial_importance', [-0, NaN, Infinity, -0.01, 1.01]],
    ['confidence', [-0, NaN, -Infinity, -0.01, 1.01]],
  ]) {
    for (const value of values) {
      assertM104BundleCode(
        () => codecModule.decodeAtomRow(makeM104AtomRow({ [field]: value })),
        'bundle_invalid_atom',
      )
    }
  }
  for (const fictional of [false, true, -1, 2, '0']) {
    assertM104BundleCode(
      () => codecModule.decodeAtomRow(makeM104AtomRow({ fictional })),
      'bundle_invalid_atom',
    )
  }
  for (const content_checksum of [
    M1_04_ATOM_CHECKSUM.toUpperCase(),
    M1_04_ATOM_CHECKSUM.slice(1),
    `${M1_04_ATOM_CHECKSUM.slice(0, -1)}0`,
  ]) {
    assertM104BundleCode(
      () => codecModule.decodeAtomRow(makeM104AtomRow({ content_checksum })),
      'bundle_invalid_atom',
    )
  }
})

test('M1-04 atom encode and decode reject every strict scalar family without coercion', () => {
  const atomCases = [
    { memoryId: 'mem_00000000-0000-5000-8000-000000000004' },
    { streamId: 'str_00000000-0000-4000-7000-000000000001' },
    { createdSequence: 0 },
    { palariId: 'Palari-A' },
    { userId: '' },
    { type: 'unknown' },
    { provenanceKind: 'summary' },
    { sourceMessageId: 'msg_00000000-0000-5000-8000-000000000005' },
    { validFrom: '2026-02-30T00:00:00.000Z' },
    { createdAt: '2026-07-18T12:00:00Z' },
    { fictional: 0 },
  ]
  for (const overrides of atomCases) {
    assertM104BundleCode(
      () => codecModule.encodeAtomRow(makeM104CanonicalAtom(overrides)),
      'bundle_invalid_atom',
    )
  }

  let coercionCalls = 0
  const coercion = {
    valueOf() {
      coercionCalls += 1
      throw new Error('row coercion ran')
    },
    toString() {
      coercionCalls += 1
      throw new Error('row coercion ran')
    },
  }
  assertM104BundleCode(
    () => codecModule.encodeAtomRow(makeM104CanonicalAtom({
      initialImportance: coercion,
    })),
    'bundle_invalid_atom',
  )
  assertM104BundleCode(
    () => codecModule.decodeAtomRow(makeM104AtomRow({
      created_sequence: coercion,
    })),
    'bundle_invalid_atom',
  )
  assert.equal(coercionCalls, 0)
})

test('M1-04 decodes exact persisted event rows for all four matrix cases', () => {
  const rows = [
    makeM104EventRow(),
    makeM104EventRow({
      outcome: 'refused',
      reason_code: 'below_threshold',
      authority_kind: 'policy',
      authority_id: 'palari-kernel-admission@1',
      memory_id: null,
    }),
    makeM104EventRow({
      proposal_kind: 'demote',
      operation: 'delete',
      memory_type: null,
    }),
    makeM104EventRow({
      proposal_kind: 'demote',
      operation: 'delete',
      outcome: 'refused',
      reason_code: 'missing_target',
      authority_kind: 'policy',
      authority_id: 'palari-kernel-admission@1',
      memory_type: null,
    }),
  ]

  for (const row of rows) {
    const decoded = codecModule.decodeEventRow(row)
    assert.equal(Object.getPrototypeOf(decoded), Object.prototype)
    assert.deepEqual(Object.keys(decoded), [
      'sequence',
      'streamId',
      'decisionId',
      'proposalId',
      'proposalKind',
      'operation',
      'outcome',
      'reasonCode',
      'palariId',
      'userId',
      'authorityKind',
      'authorityId',
      'evidenceKind',
      'memoryId',
      'memoryType',
      'effectiveAt',
      'observedAt',
    ])
    assert.equal(decoded.sequence, row.sequence)
    assert.equal(decoded.streamId, row.stream_id)
    assert.equal(decoded.decisionId, row.decision_id)
    assert.equal(decoded.proposalId, row.proposal_id)
    assert.equal(decoded.proposalKind, row.proposal_kind)
    assert.equal(decoded.operation, row.operation)
    assert.equal(decoded.outcome, row.outcome)
    assert.equal(decoded.reasonCode, row.reason_code)
    assert.equal(decoded.palariId, row.palari_id)
    assert.equal(decoded.userId, row.user_id)
    assert.equal(decoded.authorityKind, row.authority_kind)
    assert.equal(decoded.authorityId, row.authority_id)
    assert.equal(decoded.evidenceKind, row.evidence_kind)
    assert.equal(decoded.memoryId, row.memory_id)
    assert.equal(decoded.memoryType, row.memory_type)
    assert.equal(decoded.effectiveAt, row.effective_at)
    assert.equal(decoded.observedAt, row.observed_at)
  }
})

test('M1-04 event row decoding is Proxy-first, exact-shape, scalar-strict, and matrix-aware', () => {
  for (const revoked of [false, true]) {
    const counter = { count: 0 }
    let proxy
    if (revoked) {
      const revocable = Proxy.revocable(makeM104EventRow(), {
        ownKeys() {
          counter.count += 1
          throw new Error('revoked event trap ran')
        },
      })
      proxy = revocable.proxy
      revocable.revoke()
    } else {
      proxy = makeM104RowTrapProxy(makeM104EventRow(), counter)
    }
    assertM104BundleCode(
      () => codecModule.decodeEventRow(proxy),
      'bundle_invalid_decision',
    )
    assert.equal(counter.count, 0)
  }

  const malformedRows = [
    { sequence: 0 },
    { stream_id: M1_04_IDS.streamId.replace('str_', 'mem_') },
    { decision_id: M1_04_IDS.decisionId.toUpperCase() },
    { proposal_id: 'prp_00000000-0000-5000-8000-000000000003' },
    { proposal_kind: 'unknown' },
    { operation: 'update' },
    { outcome: 'ignored' },
    { reason_code: 'free_text' },
    { palari_id: 'Palari-A' },
    { user_id: '' },
    { evidence_kind: 'assistant_message' },
    { memory_id: null },
    { memory_type: null },
    { effective_at: '2026-02-30T00:00:00.000Z' },
    { observed_at: '2026-07-18T12:00:00Z' },
    { effective_at: '2026-07-18T12:00:00.001Z' },
  ]
  for (const overrides of malformedRows) {
    assertM104BundleCode(
      () => codecModule.decodeEventRow(makeM104EventRow(overrides)),
      'bundle_invalid_decision',
    )
  }

  assertM104BundleCode(
    () => codecModule.decodeEventRow(makeM104EventRow({ authority_id: 'user-2' })),
    'bundle_unauthorized',
  )
  assertM104BundleCode(
    () => codecModule.decodeEventRow(makeM104EventRow({
      outcome: 'refused',
      reason_code: 'below_threshold',
      authority_kind: 'policy',
      authority_id: 'other-policy',
      memory_id: null,
    })),
    'bundle_unauthorized',
  )

  assertM104BundleCode(
    () => codecModule.decodeEventRow({ ...makeM104EventRow() }),
    'bundle_invalid_decision',
  )
  assertM104BundleCode(
    () => codecModule.decodeEventRow([]),
    'bundle_invalid_decision',
  )

  const missing = cloneM104NullRow(makeM104EventRow())
  Reflect.deleteProperty(missing, 'decision_id')
  assertM104BundleCode(
    () => codecModule.decodeEventRow(missing),
    'bundle_invalid_decision',
  )
  const extra = cloneM104NullRow(makeM104EventRow())
  extra.payload = 'forbidden'
  assertM104BundleCode(
    () => codecModule.decodeEventRow(extra),
    'bundle_invalid_decision',
  )
  const symbolic = cloneM104NullRow(makeM104EventRow())
  symbolic[Symbol('extra')] = true
  assertM104BundleCode(
    () => codecModule.decodeEventRow(symbolic),
    'bundle_invalid_decision',
  )
  const accessor = cloneM104NullRow(makeM104EventRow())
  let getterCalls = 0
  Object.defineProperty(accessor, 'decision_id', {
    enumerable: true,
    configurable: true,
    get() {
      getterCalls += 1
      throw new Error('event getter ran')
    },
  })
  assertM104BundleCode(
    () => codecModule.decodeEventRow(accessor),
    'bundle_invalid_decision',
  )
  assert.equal(getterCalls, 0)

  const nonEnumerable = cloneM104NullRow(makeM104EventRow())
  Object.defineProperty(nonEnumerable, 'decision_id', {
    ...Object.getOwnPropertyDescriptor(nonEnumerable, 'decision_id'),
    enumerable: false,
  })
  assertM104BundleCode(
    () => codecModule.decodeEventRow(nonEnumerable),
    'bundle_invalid_decision',
  )
})

test('M1-04 event row decoding never coerces persisted scalar values', () => {
  let coercionCalls = 0
  const coercion = {
    valueOf() {
      coercionCalls += 1
      throw new Error('event coercion ran')
    },
    toString() {
      coercionCalls += 1
      throw new Error('event coercion ran')
    },
  }
  for (const field of ['sequence', 'stream_id', 'effective_at']) {
    assertM104BundleCode(
      () => codecModule.decodeEventRow(makeM104EventRow({ [field]: coercion })),
      'bundle_invalid_decision',
    )
  }
  assert.equal(coercionCalls, 0)
})

function assertM105BundleCode(callback, expectedCode) {
  assert.throws(callback, (error) => {
    assert.equal(error?.code, expectedCode)
    return true
  })
}

function readM105SingleValue(db, sql) {
  const row = db.prepare(sql).get()
  const values = Object.values(row)
  assert.equal(values.length, 1)
  return values[0]
}

function readM105Pragmas(db) {
  return {
    foreign_keys: readM105SingleValue(db, 'PRAGMA foreign_keys'),
    busy_timeout: readM105SingleValue(db, 'PRAGMA busy_timeout'),
    recursive_triggers: readM105SingleValue(db, 'PRAGMA recursive_triggers'),
    ignore_check_constraints: readM105SingleValue(
      db,
      'PRAGMA ignore_check_constraints',
    ),
  }
}

function withM105Database(callback, options) {
  const db = options === undefined
    ? new DatabaseSync(':memory:')
    : new DatabaseSync(':memory:', options)
  try {
    return callback(db)
  } finally {
    db.close()
  }
}

function makeM105SqlOverride(name, search, replacement) {
  return {
    [name]: EXPECTED_PERSISTED_SQL[name].replace(search, replacement),
  }
}

function snapshotM105CanonicalRows(db) {
  return {
    meta: db.prepare(`
      SELECT singleton, schema_version, stream_id, head_sequence, created_at
      FROM main.memory_bundle_meta
      ORDER BY singleton
    `).all(),
    events: db.prepare(`
      SELECT * FROM main.memory_bundle_events ORDER BY sequence
    `).all(),
    atoms: db.prepare(`
      SELECT * FROM main.memory_bundle_atoms ORDER BY memory_id COLLATE BINARY
    `).all(),
  }
}

function captureM105Outcome(callback) {
  try {
    return { value: callback(), error: undefined }
  } catch (error) {
    return { value: undefined, error }
  }
}

function withM105DescriptorReplacements(replacements, callback) {
  const originals = replacements.map(([target, key]) => ({
    target,
    key,
    descriptor: Object.getOwnPropertyDescriptor(target, key),
  }))
  let result
  let callbackError
  try {
    for (let index = 0; index < replacements.length; index += 1) {
      const [target, key, descriptor] = replacements[index]
      Object.defineProperty(target, key, descriptor)
    }
    result = callback()
  } catch (error) {
    callbackError = error
  } finally {
    for (let index = 0; index < originals.length; index += 1) {
      const { target, key, descriptor } = originals[index]
      if (descriptor === undefined) {
        Reflect.deleteProperty(target, key)
      } else {
        Object.defineProperty(target, key, descriptor)
      }
    }
  }

  for (let index = 0; index < originals.length; index += 1) {
    const { target, key, descriptor } = originals[index]
    assert.deepEqual(Object.getOwnPropertyDescriptor(target, key), descriptor)
  }
  if (callbackError !== undefined) throw callbackError
  return result
}

function withM105FilePath(prefix, callback) {
  const directory = mkdtempSync(join(tmpdir(), prefix))
  const dbPath = join(directory, 'bundle.sqlite')
  try {
    return callback(dbPath)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

test('M1-05 exposes exactly the four private verifier interfaces', () => {
  assert.deepEqual(Object.keys(verifyModule).sort(), [
    'assertBorrowedBundleConnection',
    'configureOwnedBundleConnection',
    'rejectCanonicalTempTriggers',
    'verifyMemoryBundleState',
  ])
})

test('M1-05 owned connections set exactly four PRAGMAs without changing journal mode', () => {
  withM105Database((db) => {
    db.exec(`
      PRAGMA foreign_keys=OFF;
      PRAGMA busy_timeout=23;
      PRAGMA recursive_triggers=OFF;
      PRAGMA ignore_check_constraints=ON;
    `)
    const journalMode = readM105SingleValue(db, 'PRAGMA journal_mode')

    assert.equal(verifyModule.configureOwnedBundleConnection(db), undefined)
    assert.deepEqual(readM105Pragmas(db), EXPECTED_REQUIRED_PRAGMAS)
    assert.equal(readM105SingleValue(db, 'PRAGMA journal_mode'), journalMode)
    assert.equal(db.isTransaction, false)
  })
})

test('M1-05 borrowed connections verify every PRAGMA without mutation', () => {
  const wrongValues = {
    foreign_keys: 0,
    busy_timeout: 17,
    recursive_triggers: 0,
    ignore_check_constraints: 1,
  }

  for (const [wrongName, wrongValue] of Object.entries(wrongValues)) {
    withM105Database((db) => {
      db.exec(`
        PRAGMA foreign_keys=ON;
        PRAGMA busy_timeout=0;
        PRAGMA recursive_triggers=ON;
        PRAGMA ignore_check_constraints=OFF;
        PRAGMA ${wrongName}=${wrongValue};
      `)
      const before = readM105Pragmas(db)
      const journalMode = readM105SingleValue(db, 'PRAGMA journal_mode')
      assertM105BundleCode(
        () => verifyModule.assertBorrowedBundleConnection(db),
        'bundle_connection_invalid',
      )
      assert.deepEqual(readM105Pragmas(db), before)
      assert.equal(readM105SingleValue(db, 'PRAGMA journal_mode'), journalMode)
    })
  }

  withM105Database((db) => {
    db.exec(`
      PRAGMA foreign_keys=ON;
      PRAGMA busy_timeout=0;
      PRAGMA recursive_triggers=ON;
      PRAGMA ignore_check_constraints=OFF;
    `)
    assert.equal(verifyModule.assertBorrowedBundleConnection(db), undefined)
    assert.deepEqual(readM105Pragmas(db), EXPECTED_REQUIRED_PRAGMAS)
  })
})

test('M1-05 rejects ASCII-folded canonical TEMP trigger targets including TEMP shadows', () => {
  withM105Database((db) => {
    createM105Bundle(db)
    db.exec(`
      CREATE TEMP TRIGGER canonical_main_target
      BEFORE INSERT ON main.memory_bundle_events
      BEGIN SELECT 1; END;
    `)
    assertM105BundleCode(
      () => verifyModule.rejectCanonicalTempTriggers(db),
      'bundle_connection_invalid',
    )
  })

  withM105Database((db) => {
    db.exec(`
      CREATE TEMP TABLE MEMORY_BUNDLE_ATOMS (value TEXT);
      CREATE TEMP TRIGGER canonical_shadow_target
      BEFORE INSERT ON MEMORY_BUNDLE_ATOMS
      BEGIN SELECT 1; END;
    `)
    assertM105BundleCode(
      () => verifyModule.rejectCanonicalTempTriggers(db),
      'bundle_connection_invalid',
    )
  })
})

test('M1-05 permits unrelated TEMP triggers plus attached and unrelated main objects', () => {
  withM105Database((db) => {
    createM105Bundle(db)
    db.exec(`
      CREATE TEMP TABLE unrelated_temp (value TEXT);
      CREATE TEMP TRIGGER unrelated_temp_trigger
      BEFORE INSERT ON unrelated_temp
      BEGIN SELECT 1; END;
      CREATE TABLE main.unrelated_main (value TEXT);
      CREATE TRIGGER main.unrelated_main_trigger
      BEFORE INSERT ON unrelated_main
      BEGIN SELECT 1; END;
      ATTACH DATABASE ':memory:' AS attached_probe;
      CREATE TABLE attached_probe.memory_bundle_events (value TEXT);
      CREATE TRIGGER attached_probe.attached_canonical_name
      BEFORE INSERT ON memory_bundle_events
      BEGIN SELECT 1; END;
      CREATE TEMP TABLE memory_bundle_meta (shadow_value TEXT);
      CREATE TABLE attached_probe.memory_bundle_meta (shadow_value TEXT);
    `)
    const journalMode = readM105SingleValue(db, 'PRAGMA journal_mode')

    assert.equal(verifyModule.rejectCanonicalTempTriggers(db), undefined)
    assert.deepEqual(
      verifyModule.verifyMemoryBundleState(db).checkpoint,
      { streamId: M1_04_IDS.streamId, sequence: 0 },
    )
    assert.equal(readM105SingleValue(db, 'PRAGMA journal_mode'), journalMode)
  })
})

test('M1-05 verifies an empty bundle read-only with the exact private state shape', () => {
  withM105Database((db) => {
    createM105Bundle(db)
    const beforeRows = snapshotM105CanonicalRows(db)
    const beforeChanges = readM105SingleValue(db, 'SELECT total_changes()')
    const beforeSchemaVersion = readM105SingleValue(db, 'PRAGMA main.schema_version')
    const journalMode = readM105SingleValue(db, 'PRAGMA journal_mode')

    const state = verifyModule.verifyMemoryBundleState(db)

    assert.deepEqual(Object.keys(state), [
      'checkpoint',
      'memories',
      'retainedByMemoryId',
      'seenDecisionIds',
      'seenProposalIds',
      'lastObservedAt',
    ])
    assert.deepEqual(state.checkpoint, {
      streamId: M1_04_IDS.streamId,
      sequence: 0,
    })
    assert.deepEqual(state.memories, [])
    assert.ok(state.retainedByMemoryId instanceof Map)
    assert.deepEqual([...state.retainedByMemoryId], [])
    assert.ok(state.seenDecisionIds instanceof Set)
    assert.deepEqual([...state.seenDecisionIds], [])
    assert.ok(state.seenProposalIds instanceof Set)
    assert.deepEqual([...state.seenProposalIds], [])
    assert.equal(state.lastObservedAt, null)
    assert.deepEqual(snapshotM105CanonicalRows(db), beforeRows)
    assert.equal(readM105SingleValue(db, 'SELECT total_changes()'), beforeChanges)
    assert.equal(
      readM105SingleValue(db, 'PRAGMA main.schema_version'),
      beforeSchemaVersion,
    )
    assert.equal(readM105SingleValue(db, 'PRAGMA journal_mode'), journalMode)
    assert.equal(db.isTransaction, false)
  })
})

test('M1-05 returns exact verified reducer state for an active canonical memory', () => {
  withM105Database((db) => {
    createM105Bundle(db, { seedActive: true })

    const state = verifyModule.verifyMemoryBundleState(db)

    assert.deepEqual(state.checkpoint, {
      streamId: M1_04_IDS.streamId,
      sequence: 1,
    })
    assert.deepEqual(state.memories, [codecModule.decodeAtomRow(makeM104AtomRow())])
    assert.deepEqual([...state.retainedByMemoryId], [[
      M1_04_IDS.memoryId,
      {
        palariId: 'palari-a',
        userId: 'user-1',
        status: 'active',
        createEvent: expectedM106CreateEvent(),
      },
    ]])
    assert.deepEqual([...state.seenDecisionIds], [M1_04_IDS.decisionId])
    assert.deepEqual([...state.seenProposalIds], [M1_04_IDS.proposalId])
    assert.equal(state.lastObservedAt, '2026-07-18T12:00:00.000Z')
  })
})

test('M1-05 classifies missing and wrong-type meta before all later checks', () => {
  withM105Database((db) => {
    assertM105BundleCode(
      () => verifyModule.verifyMemoryBundleState(db),
      'bundle_layout_invalid',
    )
  })

  withM105Database((db) => {
    db.exec(`
      CREATE VIEW main.memory_bundle_meta AS
      SELECT 1 AS singleton, 'CDX-B1' AS schema_version;
    `)
    assertM105BundleCode(
      () => verifyModule.verifyMemoryBundleState(db),
      'bundle_layout_invalid',
    )
  })
})

test('M1-05 classifies unreadable and non-singleton meta preflight as layout invalid', () => {
  withM105Database((db) => {
    db.exec('CREATE TABLE main.memory_bundle_meta (other TEXT)')
    assertM105BundleCode(
      () => verifyModule.verifyMemoryBundleState(db),
      'bundle_layout_invalid',
    )
  })

  for (const rowCount of [0, 2]) {
    withM105Database((db) => {
      db.exec(`
        CREATE TABLE main.memory_bundle_meta (
          singleton INTEGER,
          schema_version TEXT
        );
      `)
      for (let index = 0; index < rowCount; index += 1) {
        db.exec(`
          INSERT INTO main.memory_bundle_meta VALUES (1, 'CDX-B1');
        `)
      }
      assertM105BundleCode(
        () => verifyModule.verifyMemoryBundleState(db),
        'bundle_layout_invalid',
      )
    })
  }
})

test('M1-05 unsupported schema wins before CDX-B1 inventory and integrity assumptions', () => {
  withM105Database((db) => {
    createM105Bundle(db, {
      meta: { schema_version: 'CDX-B2' },
    })
    db.exec('CREATE TABLE main.memory_bundle_extra (value TEXT)')
    assert.notEqual(
      readM105SingleValue(db, 'PRAGMA main.quick_check'),
      'ok',
    )
    assertM105BundleCode(
      () => verifyModule.verifyMemoryBundleState(db),
      'bundle_schema_unsupported',
    )
  })
})

test('M1-05 enforces exact application and autoindex inventories first', () => {
  withM105Database((db) => {
    createM105Bundle(db)
    db.exec('CREATE TABLE main.memory_bundle_extra (value TEXT)')
    assertM105BundleCode(
      () => verifyModule.verifyMemoryBundleState(db),
      'bundle_layout_invalid',
    )
  })

  withM105Database((db) => {
    createM105Bundle(db, {
      objectSqlOverrides: makeM105SqlOverride(
        'memory_bundle_meta',
        'stream_id TEXT NOT NULL UNIQUE',
        'stream_id TEXT NOT NULL',
      ),
    })
    assertM105BundleCode(
      () => verifyModule.verifyMemoryBundleState(db),
      'bundle_layout_invalid',
    )
  })

  for (const mutation of [
    "tbl_name = 'unrelated_table'",
    "sql = 'CREATE UNIQUE INDEX unexpected_autoindex_sql ON memory_bundle_meta(stream_id)'",
  ]) {
    withM105Database((db) => {
      createM105Bundle(db)
      db.exec('PRAGMA writable_schema=ON')
      try {
        db.exec(`
          UPDATE main.sqlite_schema
          SET ${mutation}
          WHERE name = 'sqlite_autoindex_memory_bundle_meta_1';
        `)
      } finally {
        db.exec('PRAGMA writable_schema=OFF')
      }
      assertM105BundleCode(
        () => verifyModule.verifyMemoryBundleState(db),
        'bundle_layout_invalid',
      )
    })
  }
})

test('M1-05 enforces exact canonical main trigger-target pairs and arbitrary names', () => {
  withM105Database((db) => {
    createM105Bundle(db)
    db.exec(`
      CREATE TRIGGER main.arbitrary_canonical_target
      BEFORE INSERT ON memory_bundle_events
      BEGIN SELECT 1; END;
    `)
    assertM105BundleCode(
      () => verifyModule.verifyMemoryBundleState(db),
      'bundle_layout_invalid',
    )
  })

  withM105Database((db) => {
    createM105Bundle(db)
    db.exec(`
      DROP TRIGGER main.memory_bundle_events_no_update;
      CREATE TABLE main.trigger_retarget_probe (value TEXT);
      CREATE TRIGGER main.memory_bundle_events_no_update
      BEFORE UPDATE ON trigger_retarget_probe
      BEGIN SELECT 1; END;
    `)
    assertM105BundleCode(
      () => verifyModule.verifyMemoryBundleState(db),
      'bundle_layout_invalid',
    )
  })
})

test('M1-05 compares normalized stored SQL only with persistedSql', () => {
  withM105Database((db) => {
    createM105Bundle(db, {
      objectSqlOverrides: makeM105SqlOverride(
        'memory_bundle_meta',
        'singleton INTEGER',
        'singleton  INTEGER',
      ),
    })
    assertM105BundleCode(
      () => verifyModule.verifyMemoryBundleState(db),
      'bundle_layout_invalid',
    )
  })
})

test('M1-05 compares exact table index and foreign-key PRAGMA projections', () => {
  withM105Database((db) => {
    createM105Bundle(db, {
      objectSqlOverrides: makeM105SqlOverride(
        'memory_bundle_meta',
        '  created_at TEXT NOT NULL\n) STRICT;',
        '  created_at TEXT NOT NULL,\n  extra TEXT\n) STRICT;',
      ),
    })
    spoofM105StoredSql(
      db,
      'memory_bundle_meta',
      EXPECTED_PERSISTED_SQL.memory_bundle_meta,
    )
    assertM105BundleCode(
      () => verifyModule.verifyMemoryBundleState(db),
      'bundle_layout_invalid',
    )
  })

  withM105Database((db) => {
    createM105Bundle(db)
    db.exec(`
      CREATE INDEX main.unrelated_projection_index
      ON memory_bundle_events(sequence);
    `)
    assertM105BundleCode(
      () => verifyModule.verifyMemoryBundleState(db),
      'bundle_layout_invalid',
    )
  })

  withM105Database((db) => {
    createM105Bundle(db, {
      objectSqlOverrides: makeM105SqlOverride(
        'memory_bundle_applied_create_memory_unique',
        'ON memory_bundle_events(memory_id)',
        'ON memory_bundle_events(memory_id DESC)',
      ),
    })
    spoofM105StoredSql(
      db,
      'memory_bundle_applied_create_memory_unique',
      EXPECTED_PERSISTED_SQL.memory_bundle_applied_create_memory_unique,
    )
    assertM105BundleCode(
      () => verifyModule.verifyMemoryBundleState(db),
      'bundle_layout_invalid',
    )
  })

  withM105Database((db) => {
    createM105Bundle(db, {
      objectSqlOverrides: makeM105SqlOverride(
        'memory_bundle_events',
        'FOREIGN KEY (stream_id) REFERENCES memory_bundle_meta(stream_id),',
        'FOREIGN KEY (stream_id) REFERENCES memory_bundle_meta(stream_id) ON DELETE CASCADE,',
      ),
    })
    spoofM105StoredSql(
      db,
      'memory_bundle_events',
      EXPECTED_PERSISTED_SQL.memory_bundle_events,
    )
    assertM105BundleCode(
      () => verifyModule.verifyMemoryBundleState(db),
      'bundle_layout_invalid',
    )
  })
})

test('M1-05 requires empty foreign_key_check and a real one-row ok quick_check', () => {
  withM105Database((db) => {
    createM105Bundle(db, {
      meta: { head_sequence: 1 },
      beforeTriggers(connection) {
        insertM105EventRow(connection, makeM104EventRow({
          stream_id: 'str_00000000-0000-4000-8000-000000000099',
        }))
      },
    })
    assert.ok(db.prepare('PRAGMA main.foreign_key_check').all().length > 0)
    assertM105BundleCode(
      () => verifyModule.verifyMemoryBundleState(db),
      'bundle_layout_invalid',
    )
  })

  withM105Database((db) => {
    createM105Bundle(db)
    db.exec('PRAGMA ignore_check_constraints=ON')
    try {
      db.prepare(`
        INSERT INTO main.memory_bundle_meta (
          singleton, schema_version, stream_id, head_sequence, created_at
        ) VALUES (2, 'CDX-B1', ?, 0, ?)
      `).run(
        'str_00000000-0000-4000-8000-000000000099',
        M1_05_META.created_at,
      )
    } finally {
      db.exec('PRAGMA ignore_check_constraints=OFF')
    }

    const quickRows = db.prepare('PRAGMA main.quick_check').all()
    assert.equal(quickRows.length, 1)
    assert.notEqual(Object.values(quickRows[0])[0], 'ok')
    assert.equal(
      readM105SingleValue(db, 'PRAGMA ignore_check_constraints'),
      0,
    )
    assertM105BundleCode(
      () => verifyModule.verifyMemoryBundleState(db),
      'bundle_layout_invalid',
    )
  })
})

test('M1-05 layout and integrity failures win before meta semantic interpretation', () => {
  withM105Database((db) => {
    createM105Bundle(db, {
      meta: { created_at: 'not-a-time' },
    })
    db.exec('CREATE TABLE main.memory_bundle_extra (value TEXT)')
    assertM105BundleCode(
      () => verifyModule.verifyMemoryBundleState(db),
      'bundle_layout_invalid',
    )
  })

  withM105Database((db) => {
    createM105Bundle(db, {
      meta: { created_at: 'not-a-time' },
    })
    db.exec('PRAGMA ignore_check_constraints=ON')
    try {
      db.prepare(`
        INSERT INTO main.memory_bundle_meta (
          singleton, schema_version, stream_id, head_sequence, created_at
        ) VALUES (2, 'CDX-B1', ?, 0, ?)
      `).run(
        'str_00000000-0000-4000-8000-000000000099',
        M1_05_META.created_at,
      )
    } finally {
      db.exec('PRAGMA ignore_check_constraints=OFF')
    }
    assert.notEqual(
      readM105SingleValue(db, 'PRAGMA main.quick_check'),
      'ok',
    )
    assertM105BundleCode(
      () => verifyModule.verifyMemoryBundleState(db),
      'bundle_layout_invalid',
    )
  })
})

test('M1-05 maps remaining meta identity time and head defects to meta mismatch', () => {
  const cases = [
    { stream_id: 'not-a-stream' },
    { created_at: 'not-a-time' },
    { head_sequence: 1 },
  ]
  for (const meta of cases) {
    withM105Database((db) => {
      createM105Bundle(db, { meta })
      assertM105BundleCode(
        () => verifyModule.verifyMemoryBundleState(db),
        'bundle_meta_mismatch',
      )
    })
  }
})

test('M1-05 validates all event rows before observed-time and transition reduction', () => {
  withM105Database((db) => {
    createM105Bundle(db, {
      meta: { head_sequence: 3 },
      beforeTriggers(connection) {
        insertM105EventRow(connection, makeM104EventRow({
          sequence: 1,
          decision_id: 'dec_00000000-0000-4000-8000-000000000011',
          proposal_id: 'prp_00000000-0000-4000-8000-000000000012',
          outcome: 'refused',
          reason_code: 'below_threshold',
          authority_kind: 'policy',
          authority_id: 'palari-kernel-admission@1',
          memory_id: null,
        }))
        insertM105EventRow(connection, makeM104EventRow({
          sequence: 2,
          decision_id: 'dec_00000000-0000-4000-8000-000000000021',
          proposal_id: 'prp_00000000-0000-4000-8000-000000000022',
          outcome: 'refused',
          reason_code: 'below_threshold',
          authority_kind: 'policy',
          authority_id: 'palari-kernel-admission@1',
          memory_id: null,
          effective_at: '2026-07-18T10:59:00.000Z',
          observed_at: '2026-07-18T11:00:00.000Z',
        }))
        insertM105EventRow(connection, makeM104EventRow({
          sequence: 3,
          decision_id: 'not-a-decision-id',
          proposal_id: 'prp_00000000-0000-4000-8000-000000000032',
          outcome: 'refused',
          reason_code: 'below_threshold',
          authority_kind: 'policy',
          authority_id: 'palari-kernel-admission@1',
          memory_id: null,
          observed_at: '2026-07-18T13:00:00.000Z',
        }))
      },
    })
    assert.equal(readM105SingleValue(db, 'PRAGMA main.quick_check'), 'ok')
    assertM105BundleCode(
      () => verifyModule.verifyMemoryBundleState(db),
      'bundle_invalid_decision',
    )
  })
})

test('M1-05 ignores later array and SQL-normalization intrinsic replacement', () => {
  withM105Database((db) => {
    createM105Bundle(db, { seedActive: true })
    const targets = [
      [Array.prototype, 'push'],
      [Array.prototype, 'sort'],
      [String.prototype, 'replace'],
      [String.prototype, 'replaceAll'],
    ]
    const descriptors = targets.map(([target, name]) => [
      target,
      name,
      Object.getOwnPropertyDescriptor(target, name),
    ])
    const poison = () => {
      throw new Error('late verifier intrinsic poison ran')
    }
    let state
    let capturedError
    try {
      for (const [target, name, descriptor] of descriptors) {
        Object.defineProperty(target, name, { ...descriptor, value: poison })
      }
      state = verifyModule.verifyMemoryBundleState(db)
    } catch (error) {
      capturedError = error
    } finally {
      for (const [target, name, descriptor] of descriptors) {
        Object.defineProperty(target, name, descriptor)
      }
    }
    if (capturedError !== undefined) throw capturedError
    assert.deepEqual(state.checkpoint, {
      streamId: M1_04_IDS.streamId,
      sequence: 1,
    })
    assert.equal(state.memories.length, 1)
  })
})

test('M1-05 projection comparison bypasses later inherited setters', () => {
  withM105Database((db) => {
    createM105Bundle(db)
    const descriptor = Object.getOwnPropertyDescriptor(Object.prototype, 'cid')
    let setterCalls = 0
    let state
    let capturedError
    try {
      Object.defineProperty(Object.prototype, 'cid', {
        configurable: true,
        set() {
          setterCalls += 1
          throw new Error('inherited projection setter ran')
        },
      })
      state = verifyModule.verifyMemoryBundleState(db)
    } catch (error) {
      capturedError = error
    } finally {
      if (descriptor === undefined) {
        Reflect.deleteProperty(Object.prototype, 'cid')
      } else {
        Object.defineProperty(Object.prototype, 'cid', descriptor)
      }
    }
    if (capturedError !== undefined) throw capturedError
    assert.equal(setterCalls, 0)
    assert.deepEqual(state.checkpoint, {
      streamId: M1_04_IDS.streamId,
      sequence: 0,
    })
  })
})

test('M1-05 uses captured normalized row dispatch under hostile row modes and shadows', () => {
  withM105Database((db) => {
    createM105Bundle(db, { seedActive: true })
    db.exec(`
      CREATE TEMP TABLE memory_bundle_events (shadow_value TEXT);
      ATTACH DATABASE ':memory:' AS attached_shadow;
      CREATE TABLE attached_shadow.memory_bundle_atoms (shadow_value TEXT);
    `)

    const databasePrepareDescriptor = Object.getOwnPropertyDescriptor(
      DatabaseSync.prototype,
      'prepare',
    )
    const statementDescriptors = new Map(
      ['get', 'all', 'setReadBigInts', 'setReturnArrays'].map((name) => [
        name,
        Object.getOwnPropertyDescriptor(StatementSync.prototype, name),
      ]),
    )
    const poison = () => {
      throw new Error('dynamic SQLite dispatch poison ran')
    }
    try {
      Object.defineProperty(DatabaseSync.prototype, 'prepare', {
        ...databasePrepareDescriptor,
        value: poison,
      })
      Object.defineProperty(db, 'prepare', {
        value: poison,
        configurable: true,
      })
      for (const [name, descriptor] of statementDescriptors) {
        Object.defineProperty(StatementSync.prototype, name, {
          ...descriptor,
          value: poison,
        })
      }

      const state = verifyModule.verifyMemoryBundleState(db)
      assert.deepEqual(state.checkpoint, {
        streamId: M1_04_IDS.streamId,
        sequence: 1,
      })
      assert.equal(state.memories.length, 1)
    } finally {
      Reflect.deleteProperty(db, 'prepare')
      Object.defineProperty(
        DatabaseSync.prototype,
        'prepare',
        databasePrepareDescriptor,
      )
      for (const [name, descriptor] of statementDescriptors) {
        Object.defineProperty(StatementSync.prototype, name, descriptor)
      }
    }
  }, { readBigInts: true, returnArrays: true })
})

test('M1-05 SQL normalization ignores forged RegExp and String @@replace hooks', () => {
  withM105Database((validDb) => {
    createM105Bundle(validDb)
    withM105Database((alteredDb) => {
      createM105Bundle(alteredDb, {
        objectSqlOverrides: makeM105SqlOverride(
          'memory_bundle_events_no_update',
          "BEGIN SELECT RAISE(ABORT, 'memory_bundle_events_append_only'); END;",
          'BEGIN SELECT 1; END;',
        ),
      })

      let regexpReplaceCalls = 0
      let stringReplaceCalls = 0
      let replaceMethodCalls = 0
      let replaceAllMethodCalls = 0
      const regexpDescriptor = Object.getOwnPropertyDescriptor(
        RegExp.prototype,
        Symbol.replace,
      )
      const replaceDescriptor = Object.getOwnPropertyDescriptor(
        String.prototype,
        'replace',
      )
      const replaceAllDescriptor = Object.getOwnPropertyDescriptor(
        String.prototype,
        'replaceAll',
      )
      const outcomes = withM105DescriptorReplacements([
        [RegExp.prototype, Symbol.replace, {
          ...regexpDescriptor,
          value() {
            regexpReplaceCalls += 1
            return 'forged-normalized-sql'
          },
        }],
        [String.prototype, Symbol.replace, {
          configurable: true,
          enumerable: false,
          writable: true,
          value() {
            stringReplaceCalls += 1
            return 'forged-normalized-sql'
          },
        }],
        [String.prototype, 'replace', {
          ...replaceDescriptor,
          value() {
            replaceMethodCalls += 1
            throw new Error('late String.prototype.replace ran')
          },
        }],
        [String.prototype, 'replaceAll', {
          ...replaceAllDescriptor,
          value() {
            replaceAllMethodCalls += 1
            throw new Error('late String.prototype.replaceAll ran')
          },
        }],
      ], () => ({
        valid: captureM105Outcome(
          () => verifyModule.verifyMemoryBundleState(validDb),
        ),
        altered: captureM105Outcome(
          () => verifyModule.verifyMemoryBundleState(alteredDb),
        ),
      }))

      if (outcomes.valid.error !== undefined) throw outcomes.valid.error
      assert.deepEqual(outcomes.valid.value.checkpoint, {
        streamId: M1_04_IDS.streamId,
        sequence: 0,
      })
      assert.equal(outcomes.altered.value, undefined)
      assert.equal(outcomes.altered.error?.code, 'bundle_layout_invalid')
      assert.equal(regexpReplaceCalls, 0)
      assert.equal(stringReplaceCalls, 0)
      assert.equal(replaceMethodCalls, 0)
      assert.equal(replaceAllMethodCalls, 0)
    })
  })
})

test('M1-05 SQL normalization ignores a throwing String @@replace hook', () => {
  withM105Database((db) => {
    createM105Bundle(db)
    let replacementCalls = 0
    const outcome = withM105DescriptorReplacements([
      [String.prototype, Symbol.replace, {
        configurable: true,
        enumerable: false,
        writable: true,
        value() {
          replacementCalls += 1
          throw new Error('late String @@replace ran')
        },
      }],
    ], () => captureM105Outcome(
      () => verifyModule.verifyMemoryBundleState(db),
    ))

    if (outcome.error !== undefined) throw outcome.error
    assert.deepEqual(outcome.value.checkpoint, {
      streamId: M1_04_IDS.streamId,
      sequence: 0,
    })
    assert.equal(replacementCalls, 0)
  })
})

test('M1-05 SQL normalization ignores a throwing RegExp @@replace hook', () => {
  withM105Database((db) => {
    createM105Bundle(db)
    let replacementCalls = 0
    const descriptor = Object.getOwnPropertyDescriptor(
      RegExp.prototype,
      Symbol.replace,
    )
    const outcome = withM105DescriptorReplacements([
      [RegExp.prototype, Symbol.replace, {
        ...descriptor,
        value() {
          replacementCalls += 1
          throw new Error('late RegExp @@replace ran')
        },
      }],
    ], () => captureM105Outcome(
      () => verifyModule.verifyMemoryBundleState(db),
    ))

    if (outcome.error !== undefined) throw outcome.error
    assert.deepEqual(outcome.value.checkpoint, {
      streamId: M1_04_IDS.streamId,
      sequence: 0,
    })
    assert.equal(replacementCalls, 0)
  })
})

test('M1-05 builds structural projection arrays without inherited numeric setters', () => {
  withM105Database((db) => {
    createM105Bundle(db)
    let setterCalls = 0
    const throwingSetter = {
      configurable: true,
      enumerable: false,
      set() {
        setterCalls += 1
        throw new Error('inherited array numeric setter ran')
      },
    }
    const outcome = withM105DescriptorReplacements([
      [Array.prototype, '0', throwingSetter],
      [Array.prototype, '1', throwingSetter],
    ], () => captureM105Outcome(
      () => verifyModule.verifyMemoryBundleState(db),
    ))

    if (outcome.error !== undefined) throw outcome.error
    assert.deepEqual(outcome.value.checkpoint, {
      streamId: M1_04_IDS.streamId,
      sequence: 0,
    })
    assert.deepEqual(outcome.value.memories, [])
    assert.equal(setterCalls, 0)
  })
})

test('M1-05 builds active verified state arrays without inherited numeric setters', () => {
  withM105Database((db) => {
    createM105Bundle(db, { seedActive: true })
    let setterCalls = 0
    const throwingSetter = {
      configurable: true,
      enumerable: false,
      set() {
        setterCalls += 1
        throw new Error('inherited active-state numeric setter ran')
      },
    }
    const outcome = withM105DescriptorReplacements([
      [Array.prototype, '0', throwingSetter],
      [Array.prototype, '1', throwingSetter],
    ], () => captureM105Outcome(
      () => verifyModule.verifyMemoryBundleState(db),
    ))

    if (outcome.error !== undefined) throw outcome.error
    assert.deepEqual(outcome.value.checkpoint, {
      streamId: M1_04_IDS.streamId,
      sequence: 1,
    })
    assert.equal(outcome.value.memories.length, 1)
    assert.deepEqual([...outcome.value.retainedByMemoryId], [[
      M1_04_IDS.memoryId,
      {
        palariId: 'palari-a',
        userId: 'user-1',
        status: 'active',
        createEvent: expectedM106CreateEvent(),
      },
    ]])
    assert.equal(setterCalls, 0)
  })
})

test('M1-05 maps native SQLITE_BUSY from the first verifier read to bundle_busy', () => {
  withM105FilePath('palari-m105-busy-', (dbPath) => {
    const setup = new DatabaseSync(dbPath)
    let beforeRows
    try {
      createM105Bundle(setup, { seedActive: true })
      beforeRows = snapshotM105CanonicalRows(setup)
    } finally {
      setup.close()
    }

    const reader = new DatabaseSync(dbPath)
    const blocker = new DatabaseSync(dbPath)
    try {
      reader.exec('PRAGMA busy_timeout=0; BEGIN;')
      blocker.exec('PRAGMA busy_timeout=0; BEGIN EXCLUSIVE;')
      const outcome = captureM105Outcome(
        () => verifyModule.verifyMemoryBundleState(reader),
      )
      assert.equal(outcome.value, undefined)
      assert.equal(outcome.error?.code, 'bundle_busy')
      assert.equal(outcome.error?.cause?.code, 'ERR_SQLITE_ERROR')
      assert.equal(outcome.error?.cause?.errcode, 5)
      assert.equal(outcome.error?.cause?.errstr, 'database is locked')
      assert.equal(reader.isTransaction, true)

      blocker.exec('ROLLBACK')
      reader.exec('ROLLBACK')
      const healthyState = verifyModule.verifyMemoryBundleState(reader)
      assert.deepEqual(healthyState.checkpoint, {
        streamId: M1_04_IDS.streamId,
        sequence: 1,
      })
      assert.deepEqual(snapshotM105CanonicalRows(reader), beforeRows)
    } finally {
      if (blocker.isTransaction) blocker.exec('ROLLBACK')
      if (reader.isTransaction) reader.exec('ROLLBACK')
      blocker.close()
      reader.close()
    }
  })
})

test('M1-05 maps native extended SQLITE_LOCKED from a verifier read to bundle_busy', () => {
  withM105FilePath('palari-m105-locked-', (dbPath) => {
    const uri = `file:${dbPath}?cache=shared`
    const setup = new DatabaseSync(uri)
    let beforeRows
    try {
      createM105Bundle(setup)
      beforeRows = snapshotM105CanonicalRows(setup)
    } finally {
      setup.close()
    }

    const blocker = new DatabaseSync(uri)
    const reader = new DatabaseSync(uri)
    try {
      blocker.exec(`
        PRAGMA busy_timeout=0;
        BEGIN IMMEDIATE;
        UPDATE main.memory_bundle_meta
        SET head_sequence = head_sequence
        WHERE singleton = 99;
      `)
      reader.exec('PRAGMA busy_timeout=0;')
      const outcome = captureM105Outcome(
        () => verifyModule.verifyMemoryBundleState(reader),
      )
      assert.equal(outcome.value, undefined)
      assert.equal(outcome.error?.code, 'bundle_busy')
      assert.equal(outcome.error?.cause?.code, 'ERR_SQLITE_ERROR')
      assert.equal(outcome.error?.cause?.errcode, 262)
      assert.equal(outcome.error?.cause?.errcode & 0xff, 6)
      assert.equal(outcome.error?.cause?.errstr, 'database table is locked')

      blocker.exec('ROLLBACK')
      const healthyState = verifyModule.verifyMemoryBundleState(reader)
      assert.deepEqual(healthyState.checkpoint, {
        streamId: M1_04_IDS.streamId,
        sequence: 0,
      })
      assert.deepEqual(snapshotM105CanonicalRows(reader), beforeRows)
    } finally {
      if (reader.isTransaction) reader.exec('ROLLBACK')
      if (blocker.isTransaction) blocker.exec('ROLLBACK')
      reader.close()
      blocker.close()
    }
  })
})

test('M1-05 validates every event non-authority field before any event authority', () => {
  withM105Database((db) => {
    createM105Bundle(db, {
      meta: { head_sequence: 2 },
      objectSqlOverrides: makeM105SqlOverride(
        'memory_bundle_events',
        'AND authority_id = user_id\n      AND memory_id IS NOT NULL',
        "AND authority_id <> ''\n      AND memory_id IS NOT NULL",
      ),
      beforeTriggers(connection) {
        insertM105EventRow(connection, makeM104EventRow({
          authority_id: 'user-2',
        }))
        insertM105EventRow(connection, makeM104EventRow({
          sequence: 2,
          decision_id: 'not-a-decision-id',
          proposal_id: 'prp_00000000-0000-4000-8000-000000000012',
          outcome: 'refused',
          reason_code: 'below_threshold',
          authority_kind: 'policy',
          authority_id: 'palari-kernel-admission@1',
          memory_id: null,
          effective_at: '2026-07-18T12:59:00.000Z',
          observed_at: '2026-07-18T13:00:00.000Z',
        }))
      },
    })
    spoofM105StoredSql(
      db,
      'memory_bundle_events',
      EXPECTED_PERSISTED_SQL.memory_bundle_events,
    )
    assert.equal(readM105SingleValue(db, 'PRAGMA main.quick_check'), 'ok')
    assertM105BundleCode(
      () => verifyModule.verifyMemoryBundleState(db),
      'bundle_invalid_decision',
    )
  })
})

test('M1-05 refused events update observations and seen ids without reducer effects', () => {
  withM105Database((db) => {
    const refused = makeM104EventRow({
      outcome: 'refused',
      reason_code: 'below_threshold',
      authority_kind: 'policy',
      authority_id: 'palari-kernel-admission@1',
      memory_id: null,
    })
    createM105Bundle(db, {
      meta: { head_sequence: 1 },
      beforeTriggers(connection) {
        insertM105EventRow(connection, refused)
      },
    })

    const state = verifyModule.verifyMemoryBundleState(db)
    assert.deepEqual(state.checkpoint, {
      streamId: M1_04_IDS.streamId,
      sequence: 1,
    })
    assert.deepEqual(state.memories, [])
    assert.deepEqual([...state.retainedByMemoryId], [])
    assert.deepEqual([...state.seenDecisionIds], [refused.decision_id])
    assert.deepEqual([...state.seenProposalIds], [refused.proposal_id])
    assert.equal(state.lastObservedAt, refused.observed_at)
  })
})

test('M1-05 deleted memories remain retained with original scope and no atom', () => {
  withM105Database((db) => {
    createM105Bundle(db, {
      meta: { head_sequence: 2 },
      beforeTriggers(connection) {
        insertM105EventRow(connection)
        insertM105EventRow(connection, makeM104EventRow({
          sequence: 2,
          decision_id: 'dec_00000000-0000-4000-8000-000000000011',
          proposal_id: 'prp_00000000-0000-4000-8000-000000000012',
          proposal_kind: 'demote',
          operation: 'delete',
          memory_type: null,
          effective_at: '2026-07-18T12:59:00.000Z',
          observed_at: '2026-07-18T13:00:00.000Z',
        }))
      },
    })

    const state = verifyModule.verifyMemoryBundleState(db)
    assert.deepEqual(state.memories, [])
    assert.deepEqual([...state.retainedByMemoryId], [[
      M1_04_IDS.memoryId,
      {
        palariId: 'palari-a',
        userId: 'user-1',
        status: 'deleted',
        createEvent: expectedM106CreateEvent(),
      },
    ]])
    assert.equal(state.lastObservedAt, '2026-07-18T13:00:00.000Z')
  })
})

test('M1-05 retained-scope mismatch wins before already-deleted state', () => {
  withM105Database((db) => {
    createM105Bundle(db, {
      meta: { head_sequence: 3 },
      objectSqlOverrides: makeM105SqlOverride(
        'memory_bundle_applied_delete_memory_unique',
        "WHERE operation = 'delete' AND outcome = 'applied';",
        "WHERE operation = 'delete' AND outcome = 'applied' AND sequence < 3;",
      ),
      beforeTriggers(connection) {
        insertM105EventRow(connection)
        insertM105EventRow(connection, makeM104EventRow({
          sequence: 2,
          decision_id: 'dec_00000000-0000-4000-8000-000000000011',
          proposal_id: 'prp_00000000-0000-4000-8000-000000000012',
          proposal_kind: 'demote',
          operation: 'delete',
          memory_type: null,
          effective_at: '2026-07-18T12:59:00.000Z',
          observed_at: '2026-07-18T13:00:00.000Z',
        }))
        insertM105EventRow(connection, makeM104EventRow({
          sequence: 3,
          decision_id: 'dec_00000000-0000-4000-8000-000000000021',
          proposal_id: 'prp_00000000-0000-4000-8000-000000000022',
          proposal_kind: 'demote',
          operation: 'delete',
          user_id: 'user-2',
          authority_id: 'user-2',
          memory_type: null,
          effective_at: '2026-07-18T13:59:00.000Z',
          observed_at: '2026-07-18T14:00:00.000Z',
        }))
      },
    })
    spoofM105StoredSql(
      db,
      'memory_bundle_applied_delete_memory_unique',
      EXPECTED_PERSISTED_SQL.memory_bundle_applied_delete_memory_unique,
    )
    assert.equal(readM105SingleValue(db, 'PRAGMA main.quick_check'), 'ok')
    assertM105BundleCode(
      () => verifyModule.verifyMemoryBundleState(db),
      'bundle_unauthorized',
    )
  })
})

test('M1-05 decreasing observed time wins before retained-scope transition checks', () => {
  withM105Database((db) => {
    createM105Bundle(db, {
      meta: { head_sequence: 2 },
      beforeTriggers(connection) {
        insertM105EventRow(connection)
        insertM105EventRow(connection, makeM104EventRow({
          sequence: 2,
          decision_id: 'dec_00000000-0000-4000-8000-000000000011',
          proposal_id: 'prp_00000000-0000-4000-8000-000000000012',
          proposal_kind: 'demote',
          operation: 'delete',
          user_id: 'user-2',
          authority_id: 'user-2',
          memory_type: null,
          effective_at: '2026-07-18T10:59:00.000Z',
          observed_at: '2026-07-18T11:00:00.000Z',
        }))
      },
    })
    assertM105BundleCode(
      () => verifyModule.verifyMemoryBundleState(db),
      'bundle_invalid_transition',
    )
  })
})

test('M1-05 missing and orphan atom precedence follows the sorted id merge', () => {
  const laterMemoryId = 'mem_00000000-0000-4000-8000-000000000006'

  withM105Database((db) => {
    createM105Bundle(db, {
      meta: { head_sequence: 1 },
      beforeTriggers(connection) {
        insertM105EventRow(connection)
        insertM105AtomRow(connection, codecModule.encodeAtomRow(
          makeM104CanonicalAtom({ memoryId: laterMemoryId }),
        ))
      },
    })
    assertM105BundleCode(
      () => verifyModule.verifyMemoryBundleState(db),
      'bundle_missing_atom',
    )
  })

  withM105Database((db) => {
    createM105Bundle(db, {
      meta: { head_sequence: 1 },
      beforeTriggers(connection) {
        insertM105EventRow(connection, makeM104EventRow({
          memory_id: laterMemoryId,
        }))
        insertM105AtomRow(connection)
      },
    })
    assertM105BundleCode(
      () => verifyModule.verifyMemoryBundleState(db),
      'bundle_orphan_atom',
    )
  })
})

const M1_06_REPLAY_KEYS = [
  'memoryId',
  'streamId',
  'createdSequence',
  'palariId',
  'userId',
  'type',
  'content',
  'keywords',
  'initialImportance',
  'confidence',
  'provenanceKind',
  'sourceMessageId',
  'validFrom',
  'createdAt',
  'fictional',
  'contentChecksum',
]
const M1_06_ATOM_CHECKSUM_DOMAIN = 'palari-memory-bundle-atom-v1\0'
const M1_06_ATOM_CHECKSUM_TAG = 'palari.memory-bundle-atom@1'

function m106Id(prefix, value) {
  return `${prefix}_00000000-0000-4000-8000-${value
    .toString(16)
    .padStart(12, '0')}`
}

function m106Timestamp(sequence, minuteOffset = 0) {
  return new Date(Date.UTC(2026, 6, 18, 12, sequence + minuteOffset, 0))
    .toISOString()
}

function makeM106EventRow(overrides = {}) {
  return Object.assign(Object.create(null), {
    sequence: 1,
    stream_id: M1_04_IDS.streamId,
    decision_id: M1_04_IDS.decisionId,
    proposal_id: M1_04_IDS.proposalId,
    proposal_kind: 'permanent',
    operation: 'create',
    outcome: 'applied',
    reason_code: null,
    palari_id: 'palari-a',
    user_id: 'user-1',
    authority_kind: 'user',
    authority_id: 'user-1',
    evidence_kind: 'direct_user_message',
    memory_id: M1_04_IDS.memoryId,
    memory_type: 'preference',
    effective_at: '2026-07-18T11:59:00.000Z',
    observed_at: '2026-07-18T12:00:00.000Z',
  }, overrides)
}

function makeM106CreateEventRow(sequence, memoryId, overrides = {}) {
  const observedAt = m106Timestamp(sequence)
  return makeM106EventRow({
    sequence,
    decision_id: m106Id('dec', 0x100 + sequence),
    proposal_id: m106Id('prp', 0x200 + sequence),
    memory_id: memoryId,
    effective_at: observedAt,
    observed_at: observedAt,
    ...overrides,
  })
}

function makeM106DeleteEventRow(sequence, memoryId, overrides = {}) {
  const observedAt = m106Timestamp(sequence)
  return makeM106EventRow({
    sequence,
    decision_id: m106Id('dec', 0x300 + sequence),
    proposal_id: m106Id('prp', 0x400 + sequence),
    proposal_kind: 'demote',
    operation: 'delete',
    memory_id: memoryId,
    memory_type: null,
    effective_at: observedAt,
    observed_at: observedAt,
    ...overrides,
  })
}

function makeM106RefusedCreateEventRow(sequence, overrides = {}) {
  const observedAt = m106Timestamp(sequence)
  return makeM106EventRow({
    sequence,
    decision_id: m106Id('dec', 0x500 + sequence),
    proposal_id: m106Id('prp', 0x600 + sequence),
    outcome: 'refused',
    reason_code: 'below_threshold',
    authority_kind: 'policy',
    authority_id: 'palari-kernel-admission@1',
    memory_id: null,
    effective_at: observedAt,
    observed_at: observedAt,
    ...overrides,
  })
}

function makeM106RefusedDeleteEventRow(sequence, memoryId, overrides = {}) {
  const observedAt = m106Timestamp(sequence)
  return makeM106EventRow({
    sequence,
    decision_id: m106Id('dec', 0x700 + sequence),
    proposal_id: m106Id('prp', 0x800 + sequence),
    proposal_kind: 'demote',
    operation: 'delete',
    outcome: 'refused',
    reason_code: 'missing_target',
    authority_kind: 'policy',
    authority_id: 'palari-kernel-admission@1',
    memory_id: memoryId,
    memory_type: null,
    effective_at: observedAt,
    observed_at: observedAt,
    ...overrides,
  })
}

function expectedM106CreateEvent(overrides = {}) {
  return Object.assign({
    sequence: 1,
    streamId: M1_04_IDS.streamId,
    decisionId: M1_04_IDS.decisionId,
    proposalId: M1_04_IDS.proposalId,
    proposalKind: 'permanent',
    operation: 'create',
    outcome: 'applied',
    reasonCode: null,
    palariId: 'palari-a',
    userId: 'user-1',
    authorityKind: 'user',
    authorityId: 'user-1',
    evidenceKind: 'direct_user_message',
    memoryId: M1_04_IDS.memoryId,
    memoryType: 'preference',
    effectiveAt: '2026-07-18T11:59:00.000Z',
    observedAt: '2026-07-18T12:00:00.000Z',
  }, overrides)
}

function makeM106CanonicalAtom(event, overrides = {}) {
  return Object.assign({
    memoryId: event.memory_id,
    streamId: event.stream_id,
    createdSequence: event.sequence,
    palariId: event.palari_id,
    userId: event.user_id,
    type: event.memory_type ?? 'preference',
    content: `Canonical content for ${event.memory_id}.`,
    keywords: ['canonical', 'memory'],
    initialImportance: 0.75,
    confidence: 0.875,
    provenanceKind: 'direct_user_message',
    sourceMessageId: null,
    validFrom: event.effective_at,
    createdAt: event.observed_at,
    fictional: false,
  }, overrides)
}

function computeM106AtomChecksum(atom) {
  const values = [
    M1_06_ATOM_CHECKSUM_TAG,
    atom.memoryId,
    atom.streamId,
    atom.createdSequence,
    atom.palariId,
    atom.userId,
    atom.type,
    atom.content,
    atom.keywords,
    atom.initialImportance,
    atom.confidence,
    atom.provenanceKind,
    atom.sourceMessageId,
    atom.validFrom,
    atom.createdAt,
    atom.fictional,
  ]
  return nativeHash(
    'sha256',
    M1_06_ATOM_CHECKSUM_DOMAIN + JSON.stringify(values),
    'hex',
  )
}

function makeM106AtomRow(event, atomOverrides = {}, rowOverrides = {}) {
  const atom = makeM106CanonicalAtom(event, atomOverrides)
  return Object.assign(Object.create(null), {
    memory_id: atom.memoryId,
    stream_id: atom.streamId,
    created_sequence: atom.createdSequence,
    palari_id: atom.palariId,
    user_id: atom.userId,
    type: atom.type,
    content: atom.content,
    keywords_json: JSON.stringify(atom.keywords),
    initial_importance: atom.initialImportance,
    confidence: atom.confidence,
    provenance_kind: atom.provenanceKind,
    source_message_id: atom.sourceMessageId,
    valid_from: atom.validFrom,
    created_at: atom.createdAt,
    fictional: atom.fictional ? 1 : 0,
    content_checksum: computeM106AtomChecksum(atom),
  }, rowOverrides)
}

function expectedM106ReplayMemory(event, atomOverrides = {}) {
  const atom = makeM106CanonicalAtom(event, atomOverrides)
  return {
    ...atom,
    keywords: [...atom.keywords],
    contentChecksum: computeM106AtomChecksum(atom),
  }
}

function createM106SemanticBundle(db, events, atoms = [], options = {}) {
  createM105Bundle(db, {
    meta: {
      head_sequence: options.headSequence ?? events.length,
      ...(options.meta ?? {}),
    },
    objectSqlOverrides: options.objectSqlOverrides,
    beforeTriggers(connection) {
      for (const event of events) insertM105EventRow(connection, event)
      for (const atom of atoms) insertM105AtomRow(connection, atom)
    },
  })
  for (const name of options.spoofStoredSqlNames ?? []) {
    spoofM105StoredSql(db, name, EXPECTED_PERSISTED_SQL[name])
  }
}

function runM106InstrumentedScenario(name) {
  const fixtureUrl = new URL(
    './helpers/memory-bundle-fixtures.mjs',
    import.meta.url,
  ).href
  const codecUrl = new URL('../src/memory-bundle-codec.mjs', import.meta.url).href
  const verifierUrl = new URL('../src/memory-bundle-verify.mjs', import.meta.url).href
  const source = `
    import { DatabaseSync, StatementSync } from 'node:sqlite'

    const scenario = process.env.PALARI_M106_SCENARIO
    const statementSql = new WeakMap()
    const databasePrepareDescriptor = Object.getOwnPropertyDescriptor(
      DatabaseSync.prototype,
      'prepare',
    )
    const statementAllDescriptor = Object.getOwnPropertyDescriptor(
      StatementSync.prototype,
      'all',
    )
    const nativePrepare = databasePrepareDescriptor.value
    const nativeAll = statementAllDescriptor.value
    let eventRows = []
    let atomRows = []
    let atomReadCount = 0
    let headSequence = 0

    function normalizeSql(sql) {
      return sql.replace(/\\s+/g, ' ').trim()
    }

    Object.defineProperty(DatabaseSync.prototype, 'prepare', {
      ...databasePrepareDescriptor,
      value(sql) {
        const statement = Reflect.apply(nativePrepare, this, [sql])
        statementSql.set(statement, normalizeSql(sql))
        return statement
      },
    })
    Object.defineProperty(StatementSync.prototype, 'all', {
      ...statementAllDescriptor,
      value(...parameters) {
        const sql = statementSql.get(this)
        if (sql?.includes('FROM main.memory_bundle_events')) return eventRows
        if (sql?.includes('FROM main.memory_bundle_atoms')) {
          atomReadCount += 1
          if (scenario === 'atom-read-transition') {
            throw new Error('instrumented atom read failure')
          }
          return atomRows
        }
        return Reflect.apply(nativeAll, this, parameters)
      },
    })

    let db
    try {
      const fixtures = await import(${JSON.stringify(fixtureUrl)})
      const codec = await import(${JSON.stringify(codecUrl)})
      const verify = await import(${JSON.stringify(`${verifierUrl}?m106-instrumented`)})

      function refused(sequence, overrides = {}) {
        const minute = String(sequence).padStart(2, '0')
        return fixtures.makeM104EventRow({
          sequence,
          decision_id: 'dec_00000000-0000-4000-8000-' +
            String(100 + sequence).padStart(12, '0'),
          proposal_id: 'prp_00000000-0000-4000-8000-' +
            String(200 + sequence).padStart(12, '0'),
          outcome: 'refused',
          reason_code: 'below_threshold',
          authority_kind: 'policy',
          authority_id: 'palari-kernel-admission@1',
          memory_id: null,
          effective_at: '2026-07-18T12:' + minute + ':00.000Z',
          observed_at: '2026-07-18T12:' + minute + ':00.000Z',
          ...overrides,
        })
      }

      if (scenario === 'sequence-start') {
        headSequence = 1
        eventRows = [refused(2)]
      } else if (scenario === 'sequence-gap') {
        headSequence = 2
        eventRows = [refused(1), refused(3)]
      } else if (scenario === 'sequence-reordered') {
        headSequence = 2
        eventRows = [refused(2), refused(1)]
      } else if (scenario === 'sequence-unsafe') {
        headSequence = 1
        eventRows = [refused(Number.MAX_SAFE_INTEGER + 1)]
      } else if (scenario === 'sequence-fractional') {
        headSequence = 1
        eventRows = [refused(1.5)]
      } else if (scenario === 'constant-stream') {
        headSequence = 1
        eventRows = [refused(1, {
          stream_id: 'str_00000000-0000-4000-8000-000000000099',
        })]
      } else if (scenario === 'duplicate-both') {
        headSequence = 2
        const first = refused(1)
        eventRows = [first, refused(2, {
          decision_id: first.decision_id,
          proposal_id: first.proposal_id,
        })]
      } else if (scenario === 'duplicate-proposal') {
        headSequence = 2
        const first = refused(1)
        eventRows = [first, refused(2, {
          proposal_id: first.proposal_id,
        })]
      } else if (scenario === 'atom-read-transition') {
        headSequence = 1
        eventRows = [fixtures.makeM104EventRow({
          proposal_kind: 'demote',
          operation: 'delete',
          memory_type: null,
        })]
      } else if (scenario === 'atom-row-shape') {
        const row = Object.assign(
          Object.create(null),
          codec.encodeAtomRow(fixtures.makeM104CanonicalAtom()),
        )
        row.extra = true
        atomRows = [row]
      } else if (scenario === 'atom-stream-correspondence') {
        headSequence = 1
        eventRows = [fixtures.makeM104EventRow()]
        atomRows = [Object.assign(
          Object.create(null),
          codec.encodeAtomRow(fixtures.makeM104CanonicalAtom({
            streamId: 'str_00000000-0000-4000-8000-000000000099',
          })),
        )]
      } else {
        throw new Error('unknown M1-06 instrumented scenario: ' + scenario)
      }

      db = new DatabaseSync(':memory:')
      fixtures.createM105Bundle(db, {
        meta: { head_sequence: headSequence },
      })
      let value
      let error
      try {
        value = verify.verifyMemoryBundleState(db)
      } catch (caught) {
        error = caught
      }
      process.stdout.write(JSON.stringify({
        returned: value !== undefined,
        code: error?.code ?? null,
        message: error?.message ?? null,
        atomReadCount,
      }) + '\\n')
    } finally {
      if (db !== undefined) db.close()
      Object.defineProperty(
        DatabaseSync.prototype,
        'prepare',
        databasePrepareDescriptor,
      )
      Object.defineProperty(
        StatementSync.prototype,
        'all',
        statementAllDescriptor,
      )
    }
  `
  const child = spawnSync(
    process.execPath,
    ['--input-type=module', '--eval', source],
    {
      encoding: 'utf8',
      env: { ...process.env, PALARI_M106_SCENARIO: name },
    },
  )
  assert.equal(
    child.status,
    0,
    `M1-06 instrumentation failed\nstdout:\n${child.stdout}\nstderr:\n${child.stderr}`,
  )
  const lines = child.stdout.trim().split('\n')
  assert.equal(lines.length, 1)
  return JSON.parse(lines[0])
}

function assertM106ReplayDescriptors(memory) {
  assert.equal(Object.getPrototypeOf(memory), Object.prototype)
  assert.deepEqual(Reflect.ownKeys(memory), M1_06_REPLAY_KEYS)
  for (const key of M1_06_REPLAY_KEYS) {
    const descriptor = Object.getOwnPropertyDescriptor(memory, key)
    assert.equal(descriptor?.enumerable, true)
    assert.ok(Object.hasOwn(descriptor, 'value'))
  }
  assert.equal(Object.getPrototypeOf(memory.keywords), Array.prototype)
  assert.equal(typeof memory.fictional, 'boolean')
}

test('M1-06 retains the original applied create event on an active memory', () => {
  withM105Database((db) => {
    createM105Bundle(db, { seedActive: true })
    const state = verifyModule.verifyMemoryBundleState(db)
    const retained = state.retainedByMemoryId.get(M1_04_IDS.memoryId)

    assert.deepEqual(Object.keys(retained), [
      'palariId',
      'userId',
      'status',
      'createEvent',
    ])
    assert.deepEqual(retained, {
      palariId: 'palari-a',
      userId: 'user-1',
      status: 'active',
      createEvent: expectedM106CreateEvent(),
    })
  })
})

test('M1-06 retains the original applied create event after deletion', () => {
  withM105Database((db) => {
    const create = makeM106EventRow()
    const deletion = makeM106DeleteEventRow(2, create.memory_id, {
      effective_at: '2026-07-18T13:00:00.000Z',
      observed_at: '2026-07-18T13:00:00.000Z',
    })
    createM106SemanticBundle(db, [create, deletion])

    const retained = verifyModule.verifyMemoryBundleState(db)
      .retainedByMemoryId.get(create.memory_id)
    assert.deepEqual(retained, {
      palariId: 'palari-a',
      userId: 'user-1',
      status: 'deleted',
      createEvent: expectedM106CreateEvent(),
    })
  })
})

test('M1-06 completes transition reduction before attempting atom reads', () => {
  const result = runM106InstrumentedScenario('atom-read-transition')
  assert.equal(result.returned, false)
  assert.equal(result.code, 'bundle_invalid_transition')
  assert.equal(result.atomReadCount, 0)
})

test('M1-06 requires exact safe-integer sequences 1 through head including empty head', () => {
  withM105Database((db) => {
    createM106SemanticBundle(db, [])
    const state = verifyModule.verifyMemoryBundleState(db)
    assert.deepEqual(state.checkpoint, {
      streamId: M1_04_IDS.streamId,
      sequence: 0,
    })
  })

  withM105Database((db) => {
    const events = [
      makeM106RefusedCreateEventRow(1),
      makeM106RefusedDeleteEventRow(2, m106Id('mem', 0x901)),
    ]
    createM106SemanticBundle(db, events)
    const state = verifyModule.verifyMemoryBundleState(db)
    assert.deepEqual(state.checkpoint, {
      streamId: M1_04_IDS.streamId,
      sequence: 2,
    })
    assert.equal(state.lastObservedAt, events[1].observed_at)
  })

  withM105Database((db) => {
    createM106SemanticBundle(db, [], [], { headSequence: 1 })
    assertM105BundleCode(
      () => verifyModule.verifyMemoryBundleState(db),
      'bundle_meta_mismatch',
    )
  })

  for (const scenario of [
    'sequence-start',
    'sequence-gap',
    'sequence-reordered',
    'sequence-unsafe',
    'sequence-fractional',
  ]) {
    const result = runM106InstrumentedScenario(scenario)
    assert.equal(result.returned, false, scenario)
    assert.equal(result.code, 'bundle_meta_mismatch', scenario)
    assert.equal(result.atomReadCount, 0, scenario)
  }
})

test('M1-06 requires one constant stream and persisted id uniqueness', () => {
  const wrongStream = runM106InstrumentedScenario('constant-stream')
  assert.equal(wrongStream.code, 'bundle_meta_mismatch')
  assert.equal(wrongStream.atomReadCount, 0)

  const duplicateBoth = runM106InstrumentedScenario('duplicate-both')
  assert.equal(duplicateBoth.code, 'bundle_invalid_decision')
  assert.match(duplicateBoth.message, /decision id/i)
  assert.equal(duplicateBoth.atomReadCount, 0)

  const duplicateProposal = runM106InstrumentedScenario('duplicate-proposal')
  assert.equal(duplicateProposal.code, 'bundle_invalid_decision')
  assert.match(duplicateProposal.message, /proposal id/i)
  assert.equal(duplicateProposal.atomReadCount, 0)
})

test('M1-06 refused delete has no reducer effect while ids and time advance', () => {
  withM105Database((db) => {
    const create = makeM106CreateEventRow(1, m106Id('mem', 0x910))
    const refused = makeM106RefusedDeleteEventRow(2, create.memory_id, {
      reason_code: 'unauthorized',
    })
    const atom = makeM106AtomRow(create)
    createM106SemanticBundle(db, [create, refused], [atom])

    const state = verifyModule.verifyMemoryBundleState(db)
    assert.equal(state.retainedByMemoryId.get(create.memory_id).status, 'active')
    assert.deepEqual(state.memories, [expectedM106ReplayMemory(create)])
    assert.deepEqual([...state.seenDecisionIds], [
      create.decision_id,
      refused.decision_id,
    ])
    assert.deepEqual([...state.seenProposalIds], [
      create.proposal_id,
      refused.proposal_id,
    ])
    assert.equal(state.lastObservedAt, refused.observed_at)
  })
})

test('M1-06 rejects missing create, double delete, and active or deleted id reuse', () => {
  withM105Database((db) => {
    const memoryId = m106Id('mem', 0x920)
    createM106SemanticBundle(db, [makeM106DeleteEventRow(1, memoryId)])
    assertM105BundleCode(
      () => verifyModule.verifyMemoryBundleState(db),
      'bundle_invalid_transition',
    )
  })

  withM105Database((db) => {
    const memoryId = m106Id('mem', 0x921)
    const indexName = 'memory_bundle_applied_delete_memory_unique'
    const objectSqlOverrides = makeM105SqlOverride(
      indexName,
      "WHERE operation = 'delete' AND outcome = 'applied';",
      "WHERE operation = 'delete' AND outcome = 'applied' AND sequence < 3;",
    )
    createM106SemanticBundle(db, [
      makeM106CreateEventRow(1, memoryId),
      makeM106DeleteEventRow(2, memoryId),
      makeM106DeleteEventRow(3, memoryId),
    ], [], {
      objectSqlOverrides,
      spoofStoredSqlNames: [indexName],
    })
    assertM105BundleCode(
      () => verifyModule.verifyMemoryBundleState(db),
      'bundle_invalid_transition',
    )
  })

  for (const deletedFirst of [false, true]) {
    withM105Database((db) => {
      const memoryId = m106Id('mem', deletedFirst ? 0x923 : 0x922)
      const indexName = 'memory_bundle_applied_create_memory_unique'
      const reuseSequence = deletedFirst ? 3 : 2
      const objectSqlOverrides = makeM105SqlOverride(
        indexName,
        "WHERE operation = 'create' AND outcome = 'applied';",
        `WHERE operation = 'create' AND outcome = 'applied' AND sequence < ${reuseSequence};`,
      )
      const events = [makeM106CreateEventRow(1, memoryId)]
      if (deletedFirst) events.push(makeM106DeleteEventRow(2, memoryId))
      events.push(makeM106CreateEventRow(reuseSequence, memoryId))
      createM106SemanticBundle(db, events, [], {
        objectSqlOverrides,
        spoofStoredSqlNames: [indexName],
      })
      assertM105BundleCode(
        () => verifyModule.verifyMemoryBundleState(db),
        'bundle_id_reuse',
      )
    })
  }
})

test('M1-06 preserves time, retained-scope, and transition-before-atom precedence', () => {
  withM105Database((db) => {
    const memoryId = m106Id('mem', 0x930)
    createM106SemanticBundle(db, [
      makeM106CreateEventRow(1, memoryId),
      makeM106DeleteEventRow(2, memoryId, {
        user_id: 'user-2',
        authority_id: 'user-2',
        effective_at: m106Timestamp(0),
        observed_at: m106Timestamp(0),
      }),
    ])
    assertM105BundleCode(
      () => verifyModule.verifyMemoryBundleState(db),
      'bundle_invalid_transition',
    )
  })

  withM105Database((db) => {
    const memoryId = m106Id('mem', 0x931)
    const indexName = 'memory_bundle_applied_delete_memory_unique'
    const objectSqlOverrides = makeM105SqlOverride(
      indexName,
      "WHERE operation = 'delete' AND outcome = 'applied';",
      "WHERE operation = 'delete' AND outcome = 'applied' AND sequence < 3;",
    )
    createM106SemanticBundle(db, [
      makeM106CreateEventRow(1, memoryId),
      makeM106DeleteEventRow(2, memoryId),
      makeM106DeleteEventRow(3, memoryId, {
        user_id: 'user-2',
        authority_id: 'user-2',
      }),
    ], [], {
      objectSqlOverrides,
      spoofStoredSqlNames: [indexName],
    })
    assertM105BundleCode(
      () => verifyModule.verifyMemoryBundleState(db),
      'bundle_unauthorized',
    )
  })

  withM105Database((db) => {
    const memoryId = m106Id('mem', 0x932)
    createM106SemanticBundle(db, [
      makeM106CreateEventRow(1, memoryId),
      makeM106DeleteEventRow(2, memoryId, {
        user_id: 'user-2',
        authority_id: 'user-2',
      }),
    ])
    assertM105BundleCode(
      () => verifyModule.verifyMemoryBundleState(db),
      'bundle_unauthorized',
    )
  })
})

test('M1-06 validates every canonical atom before merge correspondence', () => {
  const expectedMemoryId = m106Id('mem', 0x940)
  const actualMemoryId = m106Id('mem', 0x942)
  const create = makeM106CreateEventRow(1, expectedMemoryId)
  const backing = makeM106RefusedDeleteEventRow(2, actualMemoryId)
  const malformedRows = [
    makeM106AtomRow(backing, { memoryId: actualMemoryId }, {
      keywords_json: '["memory", "canonical"]',
    }),
    makeM106AtomRow(backing, {
      memoryId: actualMemoryId,
      sourceMessageId: 'not-a-message-id',
    }),
    makeM106AtomRow(backing, { memoryId: actualMemoryId }, {
      content_checksum: '0'.repeat(64),
    }),
  ]

  for (const atom of malformedRows) {
    withM105Database((db) => {
      createM106SemanticBundle(db, [create, backing], [atom])
      assertM105BundleCode(
        () => verifyModule.verifyMemoryBundleState(db),
        'bundle_invalid_atom',
      )
    })
  }

  const shapeResult = runM106InstrumentedScenario('atom-row-shape')
  assert.equal(shapeResult.code, 'bundle_invalid_atom')
})

test('M1-06 checks every equal-id event and atom correspondence field', () => {
  const streamResult = runM106InstrumentedScenario('atom-stream-correspondence')
  assert.equal(streamResult.code, 'bundle_invalid_atom')

  const cases = [
    {
      label: 'created sequence',
      atomOverrides: { createdSequence: 2 },
      withBackingEvent: true,
    },
    { label: 'Palari scope', atomOverrides: { palariId: 'palari-b' } },
    { label: 'user scope', atomOverrides: { userId: 'user-2' } },
    { label: 'memory type', atomOverrides: { type: 'opinion' } },
    {
      label: 'valid/effective time',
      atomOverrides: { validFrom: m106Timestamp(0) },
    },
    {
      label: 'created/observed time',
      atomOverrides: { createdAt: m106Timestamp(2) },
    },
  ]

  for (let index = 0; index < cases.length; index += 1) {
    const { label, atomOverrides, withBackingEvent } = cases[index]
    withM105Database((db) => {
      const create = makeM106CreateEventRow(1, m106Id('mem', 0x950 + index))
      const events = [create]
      if (withBackingEvent) events.push(makeM106RefusedCreateEventRow(2))
      createM106SemanticBundle(db, events, [makeM106AtomRow(
        create,
        atomOverrides,
      )])
      assert.throws(
        () => verifyModule.verifyMemoryBundleState(db),
        (error) => {
          assert.equal(error?.code, 'bundle_invalid_atom', label)
          return true
        },
      )
    })
  }
})

test('M1-06 classifies missing, orphan, deleted, and remaining merge tails', () => {
  withM105Database((db) => {
    const create = makeM106CreateEventRow(1, m106Id('mem', 0x960))
    createM106SemanticBundle(db, [create])
    assertM105BundleCode(
      () => verifyModule.verifyMemoryBundleState(db),
      'bundle_missing_atom',
    )
  })

  withM105Database((db) => {
    const memoryId = m106Id('mem', 0x961)
    const refused = makeM106RefusedDeleteEventRow(1, memoryId)
    createM106SemanticBundle(db, [refused], [makeM106AtomRow(refused)])
    assertM105BundleCode(
      () => verifyModule.verifyMemoryBundleState(db),
      'bundle_orphan_atom',
    )
  })

  withM105Database((db) => {
    const create = makeM106CreateEventRow(1, m106Id('mem', 0x962))
    const deletion = makeM106DeleteEventRow(2, create.memory_id)
    createM106SemanticBundle(db, [create, deletion], [makeM106AtomRow(create)])
    assertM105BundleCode(
      () => verifyModule.verifyMemoryBundleState(db),
      'bundle_orphan_atom',
    )
  })

  withM105Database((db) => {
    const first = makeM106CreateEventRow(1, m106Id('mem', 0x963))
    const second = makeM106CreateEventRow(2, m106Id('mem', 0x964))
    createM106SemanticBundle(db, [first, second], [makeM106AtomRow(first)])
    assertM105BundleCode(
      () => verifyModule.verifyMemoryBundleState(db),
      'bundle_missing_atom',
    )
  })

  withM105Database((db) => {
    const create = makeM106CreateEventRow(1, m106Id('mem', 0x965))
    const orphanId = m106Id('mem', 0x966)
    const refused = makeM106RefusedDeleteEventRow(2, orphanId)
    createM106SemanticBundle(db, [create, refused], [
      makeM106AtomRow(create),
      makeM106AtomRow(refused),
    ])
    assertM105BundleCode(
      () => verifyModule.verifyMemoryBundleState(db),
      'bundle_orphan_atom',
    )
  })
})

test('M1-06 chooses the deterministic first unequal id across multiple defects', () => {
  withM105Database((db) => {
    const expectedFirst = makeM106CreateEventRow(1, m106Id('mem', 0x970))
    const expectedSecond = makeM106CreateEventRow(2, m106Id('mem', 0x974))
    const actualFirst = makeM106RefusedDeleteEventRow(3, m106Id('mem', 0x972))
    const actualSecond = makeM106RefusedDeleteEventRow(4, m106Id('mem', 0x976))
    createM106SemanticBundle(
      db,
      [expectedFirst, expectedSecond, actualFirst, actualSecond],
      [makeM106AtomRow(actualFirst), makeM106AtomRow(actualSecond)],
    )
    assertM105BundleCode(
      () => verifyModule.verifyMemoryBundleState(db),
      'bundle_missing_atom',
    )
  })

  withM105Database((db) => {
    const expectedFirst = makeM106CreateEventRow(1, m106Id('mem', 0x982))
    const expectedSecond = makeM106CreateEventRow(2, m106Id('mem', 0x986))
    const actualFirst = makeM106RefusedDeleteEventRow(3, m106Id('mem', 0x980))
    const actualSecond = makeM106RefusedDeleteEventRow(4, m106Id('mem', 0x984))
    createM106SemanticBundle(
      db,
      [expectedFirst, expectedSecond, actualFirst, actualSecond],
      [makeM106AtomRow(actualFirst), makeM106AtomRow(actualSecond)],
    )
    assertM105BundleCode(
      () => verifyModule.verifyMemoryBundleState(db),
      'bundle_orphan_atom',
    )
  })
})

test('M1-06 returns BINARY-sorted exact fresh replay memories with isolation', async () => {
  const localeCompareDescriptor = Object.getOwnPropertyDescriptor(
    String.prototype,
    'localeCompare',
  )
  let localeCompareCalls = 0
  let freshVerifier
  try {
    Object.defineProperty(String.prototype, 'localeCompare', {
      ...localeCompareDescriptor,
      value() {
        localeCompareCalls += 1
        throw new Error('localeCompare must not order replay')
      },
    })
    freshVerifier = await import(
      `../src/memory-bundle-verify.mjs?m106-binary=${Date.now()}`
    )
  } finally {
    Object.defineProperty(
      String.prototype,
      'localeCompare',
      localeCompareDescriptor,
    )
  }

  withM105Database((db) => {
    const memoryIds = [
      m106Id('mem', 0x99f),
      m106Id('mem', 0x991),
      m106Id('mem', 0x99a),
    ]
    const events = memoryIds.map((memoryId, index) =>
      makeM106CreateEventRow(index + 1, memoryId))
    const atomOverrides = [
      { keywords: ['alpha', 'tea'], fictional: false },
      { keywords: ['beta', 'tea'], fictional: true },
      { keywords: ['gamma', 'tea'], fictional: false },
    ]
    const atoms = events.map((event, index) =>
      makeM106AtomRow(event, atomOverrides[index]))
    createM106SemanticBundle(db, events, atoms)

    const first = freshVerifier.verifyMemoryBundleState(db)
    const second = freshVerifier.verifyMemoryBundleState(db)
    const expectedOrder = [...memoryIds].sort(compareBinary)
    const expectedById = new Map(events.map((event, index) => [
      event.memory_id,
      expectedM106ReplayMemory(event, atomOverrides[index]),
    ]))
    const expectedMemories = expectedOrder.map((memoryId) =>
      expectedById.get(memoryId))

    assert.equal(localeCompareCalls, 0)
    assert.deepEqual(first.memories.map(({ memoryId }) => memoryId), expectedOrder)
    assert.deepEqual(first.memories, expectedMemories)
    assert.deepEqual(second, first)
    assert.notStrictEqual(second, first)
    assert.notStrictEqual(second.checkpoint, first.checkpoint)
    assert.notStrictEqual(second.memories, first.memories)
    assert.notStrictEqual(second.retainedByMemoryId, first.retainedByMemoryId)
    assert.notStrictEqual(second.seenDecisionIds, first.seenDecisionIds)
    assert.notStrictEqual(second.seenProposalIds, first.seenProposalIds)
    for (let index = 0; index < first.memories.length; index += 1) {
      assertM106ReplayDescriptors(first.memories[index])
      assert.notStrictEqual(second.memories[index], first.memories[index])
      assert.notStrictEqual(
        second.memories[index].keywords,
        first.memories[index].keywords,
      )
    }

    first.checkpoint.sequence = 999
    first.memories[0].content = 'mutated content'
    first.memories[0].keywords.push('zzzz')
    first.retainedByMemoryId.clear()
    first.seenDecisionIds.clear()
    first.seenProposalIds.clear()

    const third = freshVerifier.verifyMemoryBundleState(db)
    assert.deepEqual(third.memories, expectedMemories)
    assert.deepEqual(third.checkpoint, {
      streamId: M1_04_IDS.streamId,
      sequence: 3,
    })
    assert.equal(third.retainedByMemoryId.size, 3)
    assert.equal(third.seenDecisionIds.size, 3)
    assert.equal(third.seenProposalIds.size, 3)
  })
})

import assert from 'node:assert/strict'
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
      { palariId: 'palari-a', userId: 'user-1', status: 'active' },
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

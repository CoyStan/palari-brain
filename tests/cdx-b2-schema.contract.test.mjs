import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import * as schemaModule from '../src/cdx-b2-schema.mjs'

const MODULE_URL = new URL('../src/cdx-b2-schema.mjs', import.meta.url)
const MODULE_PATH = fileURLToPath(MODULE_URL)
const DOCUMENT_PATH = fileURLToPath(
  new URL('../docs/CDX-B2-SCHEMA-CONTRACT.md', import.meta.url),
)
const DOCUMENT_SOURCE = readFileSync(DOCUMENT_PATH, 'utf8')
const FENCE = String.fromCharCode(96).repeat(3)
const EXPECTED_CONFIG_HASH =
  'e1ded27e33516d73c60da1f4a4c9cb0767b1bb0b1482e78b429449ec7c0b07f4'
const EXPECTED_DOCUMENT_HASH =
  '84f01ae2b5bdf084cacf27b8d6e6d3a611852094e985c36aaa18bba8baa2813e'

function extractMarked(source, begin, end) {
  const start = source.indexOf(begin)
  assert.notEqual(start, -1, 'missing begin marker')
  const finish = source.indexOf(end, start + begin.length)
  assert.notEqual(finish, -1, 'missing end marker')
  return source.slice(start + begin.length, finish)
}

function extractSqlFenceAfter(heading) {
  const headingAt = DOCUMENT_SOURCE.indexOf(heading)
  assert.notEqual(headingAt, -1, 'missing SQL heading')
  const marker = FENCE + 'sql\n'
  const start = DOCUMENT_SOURCE.indexOf(marker, headingAt)
  assert.notEqual(start, -1, 'missing SQL fence')
  const contentAt = start + marker.length
  const finish = DOCUMENT_SOURCE.indexOf('\n' + FENCE, contentAt)
  assert.notEqual(finish, -1, 'unterminated SQL fence')
  return DOCUMENT_SOURCE.slice(contentAt, finish)
}

function splitCreateStatements(sql) {
  const starts = [
    ...sql.matchAll(/^CREATE (?:TABLE|UNIQUE INDEX|TRIGGER) /gm),
  ]
  return starts.map((match, index) =>
    sql.slice(match.index, starts[index + 1]?.index ?? sql.length).trim()
  )
}

function describeStatement(sql) {
  const match = /^CREATE (TABLE|UNIQUE INDEX|TRIGGER) ([a-z0-9_]+)/.exec(sql)
  assert.ok(match, 'unrecognized reviewed statement')
  const kind = match[1]
  const name = match[2]
  const type = kind === 'UNIQUE INDEX' ? 'index' : kind.toLowerCase()
  let table = name
  if (type === 'index') {
    table = /\nON ([a-z0-9_]+)/.exec(sql)[1]
  } else if (type === 'trigger') {
    table = /\nBEFORE (?:DELETE|UPDATE|INSERT) ON ([a-z0-9_]+)/.exec(sql)[1]
  }
  return { type, name, table }
}

function qualifyCreatedName(sql, name) {
  const offset = sql.indexOf(name)
  assert.notEqual(offset, -1)
  return sql.slice(0, offset) + 'main.' + sql.slice(offset)
}

function normalizeExpectedSql(sql) {
  let normalized = sql
    .replaceAll('\r\n', '\n')
    .replace(/^[\t\n\v\f\r ]+|[\t\n\v\f\r ]+$/g, '')
  if (normalized.endsWith(';')) {
    normalized = normalized
      .slice(0, -1)
      .replace(/[\t\n\v\f\r ]+$/g, '')
  }
  return normalized
}

function toPlain(value) {
  return JSON.parse(JSON.stringify(value))
}

function assertRecord(value, keys) {
  assert.equal(Object.getPrototypeOf(value), null)
  assert.deepEqual(Reflect.ownKeys(value), keys)
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    assert.ok(Object.hasOwn(descriptor, 'value'))
    assert.equal(Object.hasOwn(descriptor, 'get'), false)
    assert.equal(Object.hasOwn(descriptor, 'set'), false)
  }
}

function assertFrozenDataTree(value) {
  if (value === null || typeof value !== 'object') return
  assert.equal(Object.isFrozen(value), true)
  if (!Array.isArray(value)) {
    assert.equal(Object.getPrototypeOf(value), null)
  }
  for (const key of Reflect.ownKeys(value)) {
    assertFrozenDataTree(value[key])
  }
}

function projectRows(rows, keys) {
  return rows.map((row) =>
    Object.fromEntries(keys.map((key) => [key, row[key]]))
  )
}

function asciiFold(value) {
  let result = ''
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index)
    result += String.fromCharCode(
      unit >= 0x41 && unit <= 0x5a ? unit + 0x20 : unit,
    )
  }
  return result
}

function compareBinary(left, right) {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function readPragmaScalar(db, sql) {
  const row = db.prepare(sql).get()
  const keys = Reflect.ownKeys(row)
  assert.equal(keys.length, 1)
  return row[keys[0]]
}

const EXPECTED_CONFIG = extractMarked(
  DOCUMENT_SOURCE,
  '<!-- KERNEL_CONFIG_JSON_BEGIN -->\n' + FENCE + 'json\n',
  '\n' + FENCE + '\n<!-- KERNEL_CONFIG_JSON_END -->',
)
const EXPECTED_PERSISTED_STATEMENTS = [
  ...splitCreateStatements(extractSqlFenceAfter('## 2. Exact persisted DDL')),
  ...splitCreateStatements(extractSqlFenceAfter('## 3. Exact trigger SQL')),
]
const EXPECTED_SPECS = EXPECTED_PERSISTED_STATEMENTS.map(describeStatement)
const EXPECTED_EXECUTION_STATEMENTS = EXPECTED_PERSISTED_STATEMENTS.map(
  (sql, index) => qualifyCreatedName(sql, EXPECTED_SPECS[index].name),
)
const EXPECTED_AUTOINDEXES = [
  {
    name: 'sqlite_autoindex_cdx_b2_meta_1',
    table: 'cdx_b2_meta',
  },
  {
    name: 'sqlite_autoindex_cdx_b2_meta_2',
    table: 'cdx_b2_meta',
  },
  {
    name: 'sqlite_autoindex_cdx_b2_legacy_checkpoint_1',
    table: 'cdx_b2_legacy_checkpoint',
  },
  {
    name: 'sqlite_autoindex_cdx_b2_decisions_1',
    table: 'cdx_b2_decisions',
  },
  {
    name: 'sqlite_autoindex_cdx_b2_decisions_2',
    table: 'cdx_b2_decisions',
  },
  {
    name: 'sqlite_autoindex_cdx_b2_decisions_3',
    table: 'cdx_b2_decisions',
  },
  {
    name: 'sqlite_autoindex_cdx_b2_decisions_4',
    table: 'cdx_b2_decisions',
  },
  {
    name: 'sqlite_autoindex_cdx_b2_effects_1',
    table: 'cdx_b2_effects',
  },
]
const EXPECTED_INDEX_XINFO_ORDER = [
  ...EXPECTED_AUTOINDEXES.slice(0, 7).map(({ name }) => name),
  'cdx_b2_applied_erase_target_unique',
  EXPECTED_AUTOINDEXES[7].name,
]
const EXPECTED_PRAGMAS = [
  {
    name: 'foreign_keys',
    setSql: 'PRAGMA foreign_keys = ON',
    readSql: 'PRAGMA foreign_keys',
    value: 1,
  },
  {
    name: 'busy_timeout',
    setSql: 'PRAGMA busy_timeout = 0',
    readSql: 'PRAGMA busy_timeout',
    value: 0,
  },
  {
    name: 'recursive_triggers',
    setSql: 'PRAGMA recursive_triggers = ON',
    readSql: 'PRAGMA recursive_triggers',
    value: 1,
  },
  {
    name: 'ignore_check_constraints',
    setSql: 'PRAGMA ignore_check_constraints = OFF',
    readSql: 'PRAGMA ignore_check_constraints',
    value: 0,
  },
  {
    name: 'trusted_schema',
    setSql: 'PRAGMA trusted_schema = OFF',
    readSql: 'PRAGMA trusted_schema',
    value: 0,
  },
]

test('M2-B-03 pins the exact dependency-leaf namespace, config, SQL, and frozen representations', async () => {
  assert.deepEqual(Object.keys(schemaModule).sort(), [
    'CDX_B2_CREATE_STATEMENTS',
    'CDX_B2_KERNEL_CONFIG_HASH',
    'CDX_B2_KERNEL_CONFIG_JSON',
    'CDX_B2_MANIFEST',
    'CDX_B2_REQUIRED_PRAGMAS',
    'normalizeCdxB2Sql',
  ])

  assert.equal(schemaModule.CDX_B2_KERNEL_CONFIG_JSON, EXPECTED_CONFIG)
  assert.equal(Buffer.byteLength(EXPECTED_CONFIG, 'utf8'), 5704)
  assert.doesNotMatch(EXPECTED_CONFIG, /[^\x00-\x7f]/u)
  assert.equal(JSON.stringify(JSON.parse(EXPECTED_CONFIG)), EXPECTED_CONFIG)
  assert.equal(
    createHash('sha256').update(EXPECTED_CONFIG, 'utf8').digest('hex'),
    EXPECTED_CONFIG_HASH,
  )
  assert.equal(schemaModule.CDX_B2_KERNEL_CONFIG_HASH, EXPECTED_CONFIG_HASH)

  assert.equal(
    createHash('sha256').update(DOCUMENT_SOURCE, 'utf8').digest('hex'),
    EXPECTED_DOCUMENT_HASH,
  )
  assert.equal(EXPECTED_PERSISTED_STATEMENTS.length, 16)
  assert.deepEqual(
    [...schemaModule.CDX_B2_CREATE_STATEMENTS],
    EXPECTED_EXECUTION_STATEMENTS,
  )
  assert.equal(Object.isFrozen(schemaModule.CDX_B2_CREATE_STATEMENTS), true)

  for (
    let index = 0;
    index < schemaModule.CDX_B2_CREATE_STATEMENTS.length;
    index += 1
  ) {
    const statement = schemaModule.CDX_B2_CREATE_STATEMENTS[index]
    assert.equal(typeof statement, 'string')
    assert.equal(statement.endsWith(';'), true)
    assert.equal(statement.endsWith(';;'), false)
    assert.equal(statement.match(/\bmain\./g)?.length, 1)
  }

  const manifest = schemaModule.CDX_B2_MANIFEST
  assertRecord(manifest, [
    'schemaVersion',
    'schemaDocumentSha256',
    'objects',
    'autoindexes',
    'tableXinfo',
    'indexLists',
    'indexXinfo',
    'foreignKeys',
    'triggerTargets',
    'caseFoldedNames',
  ])
  assert.equal(manifest.schemaVersion, 'CDX-B2')
  assert.equal(manifest.schemaDocumentSha256, EXPECTED_DOCUMENT_HASH)
  assert.equal(manifest.objects.length, 16)
  assert.deepEqual(
    toPlain(manifest.objects),
    EXPECTED_SPECS.map((spec, index) => ({
      ...spec,
      executionSql: EXPECTED_EXECUTION_STATEMENTS[index],
      persistedSql: normalizeExpectedSql(
        EXPECTED_PERSISTED_STATEMENTS[index],
      ),
    })),
  )
  assert.deepEqual(
    manifest.objects.reduce(
      (counts, object) => {
        counts[object.type] += 1
        return counts
      },
      { table: 0, index: 0, trigger: 0 },
    ),
    { table: 4, index: 1, trigger: 11 },
  )
  for (let index = 0; index < manifest.objects.length; index += 1) {
    const object = manifest.objects[index]
    assertRecord(object, [
      'type',
      'name',
      'table',
      'executionSql',
      'persistedSql',
    ])
    assert.equal(
      object.executionSql,
      schemaModule.CDX_B2_CREATE_STATEMENTS[index],
    )
    assert.equal(
      object.persistedSql,
      normalizeExpectedSql(EXPECTED_PERSISTED_STATEMENTS[index]),
    )
  }

  assert.deepEqual(toPlain(manifest.autoindexes), EXPECTED_AUTOINDEXES)
  for (const entry of manifest.autoindexes) {
    assertRecord(entry, ['name', 'table'])
  }
  for (const entry of manifest.tableXinfo) {
    assertRecord(entry, ['table', 'strict', 'wr', 'rows'])
    assert.equal(entry.strict, 1)
    assert.equal(entry.wr, 0)
    for (const row of entry.rows) {
      assertRecord(row, [
        'cid',
        'name',
        'type',
        'notnull',
        'dflt_value',
        'pk',
        'hidden',
      ])
    }
  }
  for (const entry of manifest.indexLists) {
    assertRecord(entry, ['table', 'rows'])
    for (const row of entry.rows) {
      assertRecord(row, ['seq', 'name', 'unique', 'origin', 'partial'])
    }
  }
  assert.deepEqual(
    manifest.indexXinfo.map(({ name }) => name),
    EXPECTED_INDEX_XINFO_ORDER,
  )
  for (const entry of manifest.indexXinfo) {
    assertRecord(entry, ['name', 'rows'])
    for (const row of entry.rows) {
      assertRecord(row, ['seqno', 'cid', 'name', 'desc', 'coll', 'key'])
    }
  }
  for (const entry of manifest.foreignKeys) {
    assertRecord(entry, ['table', 'rows'])
    for (const row of entry.rows) {
      assertRecord(row, [
        'id',
        'seq',
        'table',
        'from',
        'to',
        'on_update',
        'on_delete',
        'match',
      ])
    }
  }
  for (const entry of manifest.triggerTargets) {
    assertRecord(entry, ['name', 'table'])
  }
  assert.deepEqual(
    [...manifest.caseFoldedNames],
    [
      ...EXPECTED_SPECS.map(({ name }) => asciiFold(name)),
      ...EXPECTED_AUTOINDEXES.map(({ name }) => asciiFold(name)),
    ].sort(compareBinary),
  )
  assertFrozenDataTree(manifest)

  assert.deepEqual(
    toPlain(schemaModule.CDX_B2_REQUIRED_PRAGMAS),
    EXPECTED_PRAGMAS,
  )
  for (const pragma of schemaModule.CDX_B2_REQUIRED_PRAGMAS) {
    assertRecord(pragma, ['name', 'setSql', 'readSql', 'value'])
  }
  assertFrozenDataTree(schemaModule.CDX_B2_REQUIRED_PRAGMAS)

  const source = readFileSync(MODULE_PATH, 'utf8')
  assert.deepEqual(
    [
      ...source.matchAll(
        /^\s*import\s+(?:[^'"]+?\s+from\s+)?['"]([^'"]+)['"];?\s*$/gm,
      ),
    ].map((match) => match[1]),
    [],
  )
  for (const forbidden of [
    'node:',
    'readFileSync',
    'writeFileSync',
    'DatabaseSync',
    'fetch(',
    'process.',
  ]) {
    assert.equal(source.includes(forbidden), false)
  }

  const isolated = await import(
    new URL('../src/cdx-b2-schema.mjs?m2-b-03-isolation', import.meta.url)
  )
  assert.notEqual(isolated.CDX_B2_MANIFEST, manifest)
  assert.deepEqual(toPlain(isolated.CDX_B2_MANIFEST), toPlain(manifest))
  assert.deepEqual(
    [...isolated.CDX_B2_CREATE_STATEMENTS],
    [...schemaModule.CDX_B2_CREATE_STATEMENTS],
  )
})

test('M2-B-03 normalizes only the reviewed primitive-string operations', () => {
  const { normalizeCdxB2Sql } = schemaModule

  assert.equal(normalizeCdxB2Sql('\r\n \tSELECT  1;\r\n'), 'SELECT  1')
  assert.equal(normalizeCdxB2Sql('SELECT\r\n1'), 'SELECT\n1')
  assert.equal(normalizeCdxB2Sql('\v\fSELECT 1\r\t'), 'SELECT 1')
  assert.equal(normalizeCdxB2Sql('SELECT 1;; \t'), 'SELECT 1;')
  assert.equal(
    normalizeCdxB2Sql('SELECT  1\nFROM\tthing'),
    'SELECT  1\nFROM\tthing',
  )
  assert.equal(normalizeCdxB2Sql('SELECT\r1'), 'SELECT\r1')
  assert.equal(
    normalizeCdxB2Sql('\u00a0SELECT 1;\u00a0'),
    '\u00a0SELECT 1;\u00a0',
  )
  assert.equal(normalizeCdxB2Sql('\t\u00a0SELECT 1;\u00a0 '), '\u00a0SELECT 1;\u00a0')
  assert.equal(normalizeCdxB2Sql('\r\n;\r\n'), '')
  assert.equal(normalizeCdxB2Sql('\t\n\v\f\r '), '')

  for (const value of [
    undefined,
    null,
    true,
    1,
    1n,
    Symbol('sql'),
    new String('SELECT 1'),
    [],
    {},
    () => 'SELECT 1',
  ]) {
    assert.throws(() => normalizeCdxB2Sql(value), TypeError)
  }

  let observations = 0
  const proxy = new Proxy({}, {
    get() {
      observations += 1
      throw new Error('input was observed')
    },
  })
  assert.throws(() => normalizeCdxB2Sql(proxy), TypeError)
  assert.equal(observations, 0)

  const originalCharCodeAt = String.prototype.charCodeAt
  const originalSlice = String.prototype.slice
  try {
    String.prototype.charCodeAt = () => {
      throw new Error('live charCodeAt')
    }
    String.prototype.slice = () => {
      throw new Error('live slice')
    }
    assert.equal(normalizeCdxB2Sql(' \r\nSELECT 1; '), 'SELECT 1')
  } finally {
    String.prototype.charCodeAt = originalCharCodeAt
    String.prototype.slice = originalSlice
  }
})

test('M2-B-03 executes the exact main-qualified DDL and matches every SQLite manifest', () => {
  assert.equal(process.versions.sqlite, '3.51.2')
  const db = new DatabaseSync(':memory:')
  try {
    for (const pragma of schemaModule.CDX_B2_REQUIRED_PRAGMAS) {
      db.exec(pragma.setSql)
      assert.equal(readPragmaScalar(db, pragma.readSql), pragma.value)
    }

    db.exec("ATTACH DATABASE ':memory:' AS attached_shadow")
    for (const { name } of EXPECTED_SPECS) {
      db.exec('CREATE TEMP TABLE "' + name + '" (shadow_value TEXT)')
      db.exec(
        'CREATE TABLE attached_shadow."' + name + '" (shadow_value TEXT)',
      )
    }
    for (const statement of schemaModule.CDX_B2_CREATE_STATEMENTS) {
      db.exec(statement)
    }

    const expectedShadowNames = EXPECTED_SPECS
      .map(({ name }) => name)
      .sort(compareBinary)
    for (const schema of ['temp', 'attached_shadow']) {
      assert.deepEqual(
        db.prepare(
          'SELECT name FROM ' + schema + '.sqlite_schema ' +
          "WHERE type = 'table' AND name GLOB 'cdx_b2_*' " +
          'ORDER BY name COLLATE BINARY',
        ).all().map(({ name }) => name),
        expectedShadowNames,
      )
    }

    const applicationRows = db.prepare(
      'SELECT type, name, tbl_name, sql FROM main.sqlite_schema ' +
      "WHERE name GLOB 'cdx_b2_*' AND sql IS NOT NULL " +
      'ORDER BY type COLLATE BINARY, name COLLATE BINARY',
    ).all()
    const expectedInventory = EXPECTED_SPECS
      .map(({ type, name, table }) => ({ type, name, table }))
      .sort((left, right) =>
        compareBinary(left.type, right.type) ||
        compareBinary(left.name, right.name)
      )
    assert.deepEqual(
      applicationRows.map(({ type, name, tbl_name }) => ({
        type,
        name,
        table: tbl_name,
      })),
      expectedInventory,
    )
    const objectByName = new Map(
      schemaModule.CDX_B2_MANIFEST.objects.map((object) => [
        object.name,
        object,
      ]),
    )
    for (const row of applicationRows) {
      const expected = objectByName.get(row.name)
      assert.equal(row.tbl_name, expected.table)
      assert.equal(normalizeExpectedSql(row.sql), expected.persistedSql)
    }

    const autoindexRows = db.prepare(
      'SELECT name, tbl_name, sql FROM main.sqlite_schema ' +
      "WHERE name GLOB 'sqlite_autoindex_cdx_b2_*' " +
      'ORDER BY name COLLATE BINARY',
    ).all()
    assert.deepEqual(
      autoindexRows.map(({ name, tbl_name }) => ({
        name,
        table: tbl_name,
      })),
      [...EXPECTED_AUTOINDEXES].sort((left, right) =>
        compareBinary(left.name, right.name)
      ),
    )
    for (const row of autoindexRows) assert.equal(row.sql, null)

    const actualTableXinfo = schemaModule.CDX_B2_MANIFEST.tableXinfo.map(
      ({ table }) => {
        const tableRow = db
          .prepare('PRAGMA main.table_list')
          .all()
          .find((row) => row.name === table)
        return {
          table,
          strict: tableRow.strict,
          wr: tableRow.wr,
          rows: projectRows(
            db.prepare('PRAGMA main.table_xinfo(' + table + ')').all(),
            ['cid', 'name', 'type', 'notnull', 'dflt_value', 'pk', 'hidden'],
          ),
        }
      },
    )
    assert.deepEqual(
      actualTableXinfo,
      toPlain(schemaModule.CDX_B2_MANIFEST.tableXinfo),
    )

    const actualIndexLists = schemaModule.CDX_B2_MANIFEST.indexLists.map(
      ({ table }) => ({
        table,
        rows: projectRows(
          db.prepare('PRAGMA main.index_list(' + table + ')').all(),
          ['seq', 'name', 'unique', 'origin', 'partial'],
        ),
      }),
    )
    assert.deepEqual(
      actualIndexLists,
      toPlain(schemaModule.CDX_B2_MANIFEST.indexLists),
    )

    const actualIndexXinfo = schemaModule.CDX_B2_MANIFEST.indexXinfo.map(
      ({ name }) => ({
        name,
        rows: projectRows(
          db.prepare('PRAGMA main.index_xinfo(' + name + ')').all(),
          ['seqno', 'cid', 'name', 'desc', 'coll', 'key'],
        ),
      }),
    )
    assert.deepEqual(
      actualIndexXinfo,
      toPlain(schemaModule.CDX_B2_MANIFEST.indexXinfo),
    )

    const actualForeignKeys = schemaModule.CDX_B2_MANIFEST.foreignKeys.map(
      ({ table }) => ({
        table,
        rows: projectRows(
          db.prepare('PRAGMA main.foreign_key_list(' + table + ')').all(),
          [
            'id',
            'seq',
            'table',
            'from',
            'to',
            'on_update',
            'on_delete',
            'match',
          ],
        ),
      }),
    )
    assert.deepEqual(
      actualForeignKeys,
      toPlain(schemaModule.CDX_B2_MANIFEST.foreignKeys),
    )
    assert.equal(
      actualForeignKeys.reduce((count, entry) => count + entry.rows.length, 0),
      3,
    )

    const triggerTargets = db.prepare(
      "SELECT name, tbl_name FROM main.sqlite_schema WHERE type = 'trigger' " +
      "AND name GLOB 'cdx_b2_*' ORDER BY name COLLATE BINARY",
    ).all().map(({ name, tbl_name }) => ({ name, table: tbl_name }))
    assert.deepEqual(
      triggerTargets,
      toPlain(schemaModule.CDX_B2_MANIFEST.triggerTargets),
    )
    for (const object of schemaModule.CDX_B2_MANIFEST.objects) {
      if (object.type !== 'trigger') continue
      const body = object.persistedSql.slice(object.persistedSql.indexOf('BEGIN'))
      assert.doesNotMatch(body, /\b(?:INSERT|UPDATE|DELETE)\b/)
    }

    const foldedNames = db.prepare(
      'SELECT name FROM main.sqlite_schema ' +
      "WHERE name GLOB 'cdx_b2_*' " +
      "OR name GLOB 'sqlite_autoindex_cdx_b2_*' " +
      'ORDER BY name COLLATE BINARY',
    ).all().map(({ name }) => asciiFold(name)).sort(compareBinary)
    assert.deepEqual(
      foldedNames,
      [...schemaModule.CDX_B2_MANIFEST.caseFoldedNames],
    )
    assert.equal(new Set(foldedNames).size, foldedNames.length)

    assert.deepEqual(db.prepare('PRAGMA main.foreign_key_check').all(), [])
    assert.deepEqual(
      db.prepare('PRAGMA main.quick_check').all().map((row) => row.quick_check),
      ['ok'],
    )
  } finally {
    db.close()
  }
})

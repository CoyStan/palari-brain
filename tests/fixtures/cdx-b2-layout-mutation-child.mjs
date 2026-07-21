// Isolated Task 4 verifier-branch falsifier. SQLite's stored SQL and native
// schema remain exact; one native PRAGMA result is changed only after a clean
// bootstrap so each index-list/index-xinfo/FK comparison is exercised.

import { DatabaseSync, StatementSync } from 'node:sqlite'

const nativePrepare = DatabaseSync.prototype.prepare
const nativeAll = StatementSync.prototype.all
const statementSql = new WeakMap()
let activeScenario = null
let matchCount = 0

function normalizeSql(sql) {
  return sql.replace(/\s+/g, ' ').trim()
}

DatabaseSync.prototype.prepare = function instrumentedPrepare(sql) {
  const statement = Reflect.apply(nativePrepare, this, [sql])
  statementSql.set(statement, normalizeSql(sql))
  return statement
}

StatementSync.prototype.all = function instrumentedAll(...parameters) {
  const rows = Reflect.apply(nativeAll, this, parameters)
  if (
    activeScenario === null ||
    statementSql.get(this) !== activeScenario.sql
  ) return rows

  matchCount += 1
  if (activeScenario.kind === 'index-list') {
    const row = rows.find((candidate) =>
      candidate.name === activeScenario.objectName)
    if (row === undefined) throw new Error('Index-list mutation row missing.')
    Reflect.defineProperty(row, 'unique', {
      value: row.unique === 1 ? 0 : 1,
      enumerable: true,
      configurable: true,
      writable: true,
    })
  } else if (activeScenario.kind === 'index-xinfo') {
    if (rows.length === 0) throw new Error('Index-xinfo mutation row missing.')
    Reflect.defineProperty(rows[0], 'coll', {
      value: rows[0].coll === 'BINARY' ? 'NOCASE' : 'BINARY',
      enumerable: true,
      configurable: true,
      writable: true,
    })
  } else if (activeScenario.kind === 'foreign-key') {
    const row = rows.find((candidate) =>
      candidate.from === activeScenario.from)
    if (row === undefined) throw new Error('Foreign-key mutation row missing.')
    Reflect.defineProperty(row, 'to', {
      value: `${row.to}_mutated`,
      enumerable: true,
      configurable: true,
      writable: true,
    })
  } else {
    throw new Error('Unknown layout mutation scenario.')
  }
  return rows
}

const INDEXES = Object.freeze([
  ['cdx_b2_meta', 'sqlite_autoindex_cdx_b2_meta_1'],
  ['cdx_b2_meta', 'sqlite_autoindex_cdx_b2_meta_2'],
  [
    'cdx_b2_legacy_checkpoint',
    'sqlite_autoindex_cdx_b2_legacy_checkpoint_1',
  ],
  ['cdx_b2_decisions', 'cdx_b2_applied_erase_target_unique'],
  ['cdx_b2_decisions', 'sqlite_autoindex_cdx_b2_decisions_1'],
  ['cdx_b2_decisions', 'sqlite_autoindex_cdx_b2_decisions_2'],
  ['cdx_b2_decisions', 'sqlite_autoindex_cdx_b2_decisions_3'],
  ['cdx_b2_decisions', 'sqlite_autoindex_cdx_b2_decisions_4'],
  ['cdx_b2_effects', 'sqlite_autoindex_cdx_b2_effects_1'],
])

const scenarios = []
for (const [table, objectName] of INDEXES) {
  scenarios.push(Object.freeze({
    kind: 'index-list',
    label: `index-list:${objectName}`,
    objectName,
    sql: `PRAGMA main.index_list(${table})`,
  }))
  scenarios.push(Object.freeze({
    kind: 'index-xinfo',
    label: `index-xinfo:${objectName}`,
    sql: `PRAGMA main.index_xinfo(${objectName})`,
  }))
}
for (const [table, from] of [
  ['cdx_b2_legacy_checkpoint', 'stream_id'],
  ['cdx_b2_decisions', 'stream_id'],
  ['cdx_b2_effects', 'decision_sequence'],
]) {
  scenarios.push(Object.freeze({
    from,
    kind: 'foreign-key',
    label: `foreign-key:${table}:${from}`,
    sql: `PRAGMA main.foreign_key_list(${table})`,
  }))
}

const {
  B2_WORKSPACE_ID,
  createCdxM1Fixture,
} = await import('../helpers/cdx-b2-fixtures.mjs')
const { createMutationCoordinator } = await import(
  '../../src/mutation-coordinator.mjs'
)
const {
  bootstrapCdxB2InTransaction,
  verifyCdxB2InTransaction,
} = await import('../../src/cdx-b2-journal.mjs')

const results = []
for (const scenario of scenarios) {
  const fixture = createCdxM1Fixture(0, { withRows: false })
  try {
    createMutationCoordinator(fixture.db).run((lease) =>
      bootstrapCdxB2InTransaction(
        lease,
        fixture.db,
        { workspaceId: B2_WORKSPACE_ID },
      ))
    activeScenario = scenario
    matchCount = 0
    let code = null
    try {
      createMutationCoordinator(fixture.db).run((lease) =>
        verifyCdxB2InTransaction(lease, fixture.db))
    } catch (error) {
      code = error?.code ?? null
    }
    results.push({ code, label: scenario.label, matchCount })
  } finally {
    activeScenario = null
    fixture.close()
  }
}

process.stdout.write(JSON.stringify(results))

import crypto from 'node:crypto'
import { syncBuiltinESMExports } from 'node:module'
import { DatabaseSync, StatementSync } from 'node:sqlite'

import {
  B2_WORKSPACE_ID,
  b2Identifier,
  createB2Decision,
  createB2Tail,
  createCdxM1Fixture,
  seedB2Memory,
} from '../helpers/cdx-b2-fixtures.mjs'

const nativeCreateHash = crypto.createHash
const nativeDatabaseExec = DatabaseSync.prototype.exec
const nativeDatabasePrepare = DatabaseSync.prototype.prepare
const nativeStatementAll = StatementSync.prototype.all
const nativeStatementGet = StatementSync.prototype.get
const nativeStatementRun = StatementSync.prototype.run
const nativeHashProbe = nativeCreateHash('sha256')
const hashPrototype = Object.getPrototypeOf(nativeHashProbe)
const nativeHashUpdate = hashPrototype.update
const nativeHashDigest = hashPrototype.digest
nativeHashDigest.call(nativeHashProbe, 'hex')

const statementSql = new WeakMap()
const hashState = new WeakMap()
const traces = []
let activePhase = null
let nextHashId = 1

function recordSql(operation, sql, parameters) {
  if (activePhase === null || typeof sql !== 'string') return
  const normalized = sql.replace(/\s+/g, ' ').trim()
  if (!/(?:^|;)\s*(?:BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE|INSERT|UPDATE|DELETE|REPLACE)\b/i.test(normalized)) {
    return
  }
  traces.push({
    kind: 'sql',
    operation,
    parameters,
    phase: activePhase,
    sql: normalized,
  })
}

DatabaseSync.prototype.exec = function instrumentedExec(sql) {
  recordSql('exec', sql, [])
  return Reflect.apply(nativeDatabaseExec, this, [sql])
}

DatabaseSync.prototype.prepare = function instrumentedPrepare(sql) {
  const statement = Reflect.apply(nativeDatabasePrepare, this, [sql])
  statementSql.set(statement, sql)
  return statement
}

StatementSync.prototype.all = function instrumentedAll(...parameters) {
  recordSql('all', statementSql.get(this), parameters)
  return Reflect.apply(nativeStatementAll, this, parameters)
}

StatementSync.prototype.get = function instrumentedGet(...parameters) {
  recordSql('get', statementSql.get(this), parameters)
  return Reflect.apply(nativeStatementGet, this, parameters)
}

StatementSync.prototype.run = function instrumentedRun(...parameters) {
  recordSql('run', statementSql.get(this), parameters)
  return Reflect.apply(nativeStatementRun, this, parameters)
}

hashPrototype.update = function instrumentedHashUpdate(value, encoding) {
  const state = hashState.get(this)
  if (activePhase !== null && state !== undefined) {
    traces.push({
      algorithm: state.algorithm,
      bytes: typeof value === 'string'
        ? value
        : Buffer.from(value).toString('base64'),
      encoding: encoding ?? null,
      hashId: state.hashId,
      inputKind: typeof value === 'string' ? 'string' : 'base64',
      kind: 'hash-update',
      phase: activePhase,
    })
  }
  return Reflect.apply(nativeHashUpdate, this, [value, encoding])
}

hashPrototype.digest = function instrumentedHashDigest(encoding) {
  const state = hashState.get(this)
  const value = Reflect.apply(nativeHashDigest, this, [encoding])
  if (activePhase !== null && state !== undefined) {
    traces.push({
      algorithm: state.algorithm,
      encoding: encoding ?? null,
      hashId: state.hashId,
      kind: 'hash-digest',
      output: typeof value === 'string'
        ? value
        : Buffer.from(value).toString('base64'),
      phase: activePhase,
    })
  }
  return value
}

crypto.createHash = function instrumentedCreateHash(algorithm, options) {
  const hash = Reflect.apply(nativeCreateHash, this, [algorithm, options])
  const state = { algorithm, hashId: nextHashId }
  nextHashId += 1
  hashState.set(hash, state)
  if (activePhase !== null) {
    traces.push({
      algorithm,
      hashId: state.hashId,
      kind: 'hash-create',
      phase: activePhase,
    })
  }
  return hash
}
syncBuiltinESMExports()

const journal = await import('../../src/cdx-b2-journal.mjs')
const { createMutationCoordinator } = await import(
  '../../src/mutation-coordinator.mjs'
)

function traced(phase, callback) {
  if (activePhase !== null) throw new Error('Nested instrumentation phase.')
  activePhase = phase
  try {
    return callback()
  } finally {
    activePhase = null
  }
}

function runMutation(db, callback) {
  return createMutationCoordinator(db).run(callback)
}

const appliedTarget = b2Identifier('mem_', 801)
const missingTarget = b2Identifier('mem_', 802)
const fixture = createCdxM1Fixture(0, { withRows: false })

try {
  seedB2Memory(fixture.db, {
    id: appliedTarget,
    memoryType: 'project',
    validUntil: '2026-07-21T10:00:00.000Z',
  })
  const initial = runMutation(fixture.db, (lease) =>
    journal.bootstrapCdxB2InTransaction(
      lease,
      fixture.db,
      { workspaceId: B2_WORKSPACE_ID },
    ))
  const refusal = createB2Decision(initial, {
    sequence: 1,
    targetId: missingTarget,
  })
  const applied = createB2Decision(initial, {
    outcome: 'applied',
    sequence: 2,
    targetId: appliedTarget,
  })

  const afterRefusal = runMutation(fixture.db, (lease) => {
    traced('refusal-append', () =>
      journal.appendCdxB2TailInTransaction(
        lease,
        fixture.db,
        createB2Tail(initial, { decision: refusal }),
      ))
    return traced('refusal-advance', () =>
      journal.advanceCdxB2HeadInTransaction(lease, fixture.db, 1))
  })

  const afterApplied = runMutation(fixture.db, (lease) => {
    traced('applied-append', () =>
      journal.appendCdxB2TailInTransaction(
        lease,
        fixture.db,
        createB2Tail(initial, { decision: applied }),
      ))
    const deleted = fixture.db.prepare(
      'DELETE FROM main.memories WHERE id = ?',
    ).run(appliedTarget)
    if (deleted.changes !== 1) throw new Error('Fixture projection delete failed.')
    return traced('applied-advance', () =>
      journal.advanceCdxB2HeadInTransaction(lease, fixture.db, 2))
  })

  const verified = runMutation(fixture.db, (lease) =>
    traced('final-verify', () =>
      journal.verifyCdxB2InTransaction(lease, fixture.db)))

  process.stdout.write(JSON.stringify({
    decisions: [
      {
        evidenceAt: refusal.evidence_at,
        patchId: refusal.patch_id,
        targetId: refusal.target_id,
      },
      {
        evidenceAt: applied.evidence_at,
        patchId: applied.patch_id,
        targetId: applied.target_id,
      },
    ],
    states: {
      afterApplied,
      afterRefusal,
      verified,
    },
    traces,
  }))
} finally {
  fixture.close()
}

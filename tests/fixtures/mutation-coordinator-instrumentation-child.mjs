import { DatabaseSync, StatementSync } from 'node:sqlite'

const scenario = process.argv[2]
if (scenario !== 'failure-matrix') {
  throw new Error(`Unknown mutation coordinator scenario: ${scenario}`)
}

const nativeReflectApply = Reflect.apply
const nativeReflectGetOwnPropertyDescriptor = Reflect.getOwnPropertyDescriptor
const nativeDatabaseExec = DatabaseSync.prototype.exec
const nativeDatabasePrepare = DatabaseSync.prototype.prepare
const nativeDatabaseClose = DatabaseSync.prototype.close
const nativeStatementGet = StatementSync.prototype.get
const nativeStatementSetReadBigInts = StatementSync.prototype.setReadBigInts
const nativeStatementSetReturnArrays = StatementSync.prototype.setReturnArrays
const nativeArrayIteratorDescriptor = nativeReflectGetOwnPropertyDescriptor(
  Array.prototype,
  Symbol.iterator,
)
const databaseExecDescriptor = nativeReflectGetOwnPropertyDescriptor(
  DatabaseSync.prototype,
  'exec',
)
const databasePrepareDescriptor = nativeReflectGetOwnPropertyDescriptor(
  DatabaseSync.prototype,
  'prepare',
)
const statementGetDescriptor = nativeReflectGetOwnPropertyDescriptor(
  StatementSync.prototype,
  'get',
)
const statementBigIntDescriptor = nativeReflectGetOwnPropertyDescriptor(
  StatementSync.prototype,
  'setReadBigInts',
)
const statementArrayDescriptor = nativeReflectGetOwnPropertyDescriptor(
  StatementSync.prototype,
  'setReturnArrays',
)

const accessorProbe = new DatabaseSync(':memory:', { open: false })
const nativeDatabaseIsOpen = nativeReflectGetOwnPropertyDescriptor(
  accessorProbe,
  'isOpen',
).get
const nativeDatabaseIsTransaction = nativeReflectGetOwnPropertyDescriptor(
  accessorProbe,
  'isTransaction',
).get

let currentCase = ''
let caseState
let failTransactionGetter = false
const statementSql = new WeakMap()

function instrumentedGetOwnPropertyDescriptor(target, key) {
  const descriptor = nativeReflectGetOwnPropertyDescriptor(target, key)
  if (
    descriptor === undefined ||
    (key !== 'isOpen' && key !== 'isTransaction') ||
    typeof descriptor.get !== 'function'
  ) {
    return descriptor
  }
  const nativeGetter = descriptor.get
  return {
    ...descriptor,
    get() {
      if (key === 'isOpen') caseState.accessorReads.open += 1
      else {
        caseState.accessorReads.transaction += 1
        if (failTransactionGetter) throw caseState.stateFailure
      }
      return nativeReflectApply(nativeGetter, this, [])
    },
  }
}

function instrumentedPrepare(sql) {
  const statement = nativeReflectApply(nativeDatabasePrepare, this, [sql])
  statementSql.set(statement, sql)
  caseState.trace.push({ operation: 'prepare', sql })
  return statement
}

function instrumentedStatementGet(...parameters) {
  const sql = statementSql.get(this)
  caseState.trace.push({ operation: 'get', sql })
  if (
    currentCase === 'policy-read-mismatch' &&
    caseState.fired !== true &&
    sql === 'PRAGMA foreign_keys'
  ) {
    caseState.fired = true
    return { foreign_keys: 0 }
  }
  return nativeReflectApply(nativeStatementGet, this, parameters)
}

function instrumentedSetReadBigInts(value) {
  caseState.trace.push({ operation: 'setReadBigInts', value })
  return nativeReflectApply(nativeStatementSetReadBigInts, this, [value])
}

function instrumentedSetReturnArrays(value) {
  caseState.trace.push({ operation: 'setReturnArrays', value })
  return nativeReflectApply(nativeStatementSetReturnArrays, this, [value])
}

function instrumentedExec(sql) {
  caseState.trace.push({ operation: 'exec', sql })

  if (
    currentCase === 'policy-exec-failure' &&
    caseState.fired !== true &&
    sql === 'PRAGMA foreign_keys = ON'
  ) {
    caseState.fired = true
    throw caseState.policyFailure
  }

  if (sql === 'BEGIN IMMEDIATE') {
    if (
      (currentCase === 'begin-active-throw' ||
        currentCase === 'begin-active-rollback-fails') &&
      caseState.fired !== true
    ) {
      caseState.fired = true
      nativeReflectApply(nativeDatabaseExec, this, [sql])
      throw caseState.beginFailure
    }
    if (currentCase === 'begin-busy-inactive' && caseState.fired !== true) {
      caseState.fired = true
      throw caseState.busyFailure
    }
    if (currentCase === 'begin-returned-inactive' && caseState.fired !== true) {
      caseState.fired = true
      return undefined
    }
    if (currentCase === 'begin-unreadable' && caseState.fired !== true) {
      caseState.fired = true
      failTransactionGetter = true
      throw caseState.busyFailure
    }
  }

  if (sql === 'COMMIT') {
    if (currentCase === 'commit-after-commit-throw') {
      nativeReflectApply(nativeDatabaseExec, this, [sql])
      throw caseState.commitFailure
    }
    if (currentCase === 'postcommit-active') return undefined
    if (currentCase === 'postcommit-unreadable') {
      const result = nativeReflectApply(nativeDatabaseExec, this, [sql])
      failTransactionGetter = true
      return result
    }
    if (currentCase === 'commit-active-rollback-fails') {
      throw caseState.commitFailure
    }
  }

  if (sql === 'ROLLBACK') {
    if (currentCase === 'postimport-array-iterator-poison') {
      nativeReflectApply(nativeDatabaseExec, this, [sql])
      throw caseState.rollbackFailure
    }
    if (currentCase === 'rollback-throws-undefined') {
      nativeReflectApply(nativeDatabaseExec, this, [sql])
      throw undefined
    }
    if (
      currentCase === 'rollback-throws' ||
      currentCase === 'ownership-rollback-fails' ||
      currentCase === 'commit-active-rollback-fails' ||
      currentCase === 'begin-active-rollback-fails'
    ) {
      throw caseState.rollbackFailure
    }
    if (currentCase === 'rollback-swallowed') return undefined
    if (currentCase === 'rollback-state-unreadable') {
      const result = nativeReflectApply(nativeDatabaseExec, this, [sql])
      failTransactionGetter = true
      return result
    }
  }

  return nativeReflectApply(nativeDatabaseExec, this, [sql])
}

Reflect.getOwnPropertyDescriptor = instrumentedGetOwnPropertyDescriptor
Object.defineProperty(DatabaseSync.prototype, 'exec', {
  ...databaseExecDescriptor,
  value: instrumentedExec,
})
Object.defineProperty(DatabaseSync.prototype, 'prepare', {
  ...databasePrepareDescriptor,
  value: instrumentedPrepare,
})
Object.defineProperty(StatementSync.prototype, 'get', {
  ...statementGetDescriptor,
  value: instrumentedStatementGet,
})
Object.defineProperty(StatementSync.prototype, 'setReadBigInts', {
  ...statementBigIntDescriptor,
  value: instrumentedSetReadBigInts,
})
Object.defineProperty(StatementSync.prototype, 'setReturnArrays', {
  ...statementArrayDescriptor,
  value: instrumentedSetReturnArrays,
})

// The coordinator captures the wrappers above. Restore the realm immediately
// afterward so the harness itself always uses saved native operations.
caseState = {
  accessorReads: { open: 0, transaction: 0 },
  stateFailure: new Error('bootstrap state failure'),
  trace: [],
}
const mutationModule = await import(
  `../../src/mutation-coordinator.mjs?instrumentation=${Date.now()}`
)
Reflect.getOwnPropertyDescriptor = nativeReflectGetOwnPropertyDescriptor
Object.defineProperty(DatabaseSync.prototype, 'exec', databaseExecDescriptor)
Object.defineProperty(DatabaseSync.prototype, 'prepare', databasePrepareDescriptor)
Object.defineProperty(StatementSync.prototype, 'get', statementGetDescriptor)
Object.defineProperty(StatementSync.prototype, 'setReadBigInts', statementBigIntDescriptor)
Object.defineProperty(StatementSync.prototype, 'setReturnArrays', statementArrayDescriptor)

const {
  assertActiveMutationLease,
  createMutationCoordinator,
} = mutationModule

function nativeExec(db, sql) {
  return nativeReflectApply(nativeDatabaseExec, db, [sql])
}

function nativeTransaction(db) {
  return nativeReflectApply(nativeDatabaseIsTransaction, db, [])
}

function nativeOpen(db) {
  return nativeReflectApply(nativeDatabaseIsOpen, db, [])
}

function nativeClose(db) {
  if (!nativeOpen(db)) return
  if (nativeTransaction(db)) nativeExec(db, 'ROLLBACK')
  nativeReflectApply(nativeDatabaseClose, db, [])
}

function captureError(callback) {
  try {
    callback()
    return null
  } catch (error) {
    return error
  }
}

function summarizeError(error, identities = {}) {
  const aggregate = error?.cause
  const errors = aggregate?.errors
  return {
    code: error?.code ?? null,
    name: error?.name ?? null,
    causeName: aggregate?.name ?? null,
    aggregateLength: Array.isArray(errors) ? errors.length : null,
    firstIsPrimary:
      Array.isArray(errors) && identities.primary !== undefined
        ? errors[0] === identities.primary
        : null,
    secondIsCleanup:
      Array.isArray(errors) && identities.cleanup !== undefined
        ? errors[1] === identities.cleanup
        : null,
    firstCode: Array.isArray(errors) ? errors[0]?.code ?? null : null,
    firstCauseIsBeginFailure:
      Array.isArray(errors) && identities.begin !== undefined
        ? errors[0]?.cause === identities.begin
        : null,
    firstCauseIsCommitFailure:
      Array.isArray(errors) && identities.commit !== undefined
        ? errors[0]?.cause === identities.commit
        : null,
    secondMessage: Array.isArray(errors) ? errors[1]?.message ?? null : null,
    nativeAggregate: aggregate instanceof AggregateError,
    nativeSecondError:
      Array.isArray(errors) && errors.length > 1
        ? errors[1] instanceof Error
        : null,
    secondIsUndefined:
      Array.isArray(errors) && errors.length > 1
        ? errors[1] === undefined
        : null,
  }
}

function freshCaseState() {
  return {
    accessorReads: { open: 0, transaction: 0 },
    beginFailure: new Error('injected begin failure'),
    busyFailure: Object.assign(new Error('injected busy state failure'), {
      code: 'ERR_SQLITE_ERROR',
      errcode: 5,
    }),
    callbackPrimary: new Error('injected callback primary'),
    commitFailure: new Error('injected commit failure'),
    fired: false,
    policyFailure: new Error('injected policy failure'),
    rollbackFailure: new Error('injected rollback failure'),
    stateFailure: new Error('injected state inspection failure'),
    trace: [],
    arrayIteratorCalls: 0,
    callbackCalls: 0,
  }
}

function runFailureCase(name) {
  currentCase = name
  caseState = freshCaseState()
  failTransactionGetter = false
  const db = new DatabaseSync(':memory:')
  const wrongDb = new DatabaseSync(':memory:')
  nativeExec(db, 'CREATE TABLE failure_probe (value TEXT NOT NULL)')
  const coordinator = createMutationCoordinator(db)
  let recordedOwnershipFailure
  let error
  let successResult = null

  if (name === 'postimport-array-iterator-poison') {
    nativeExec(db, `
      PRAGMA foreign_keys = OFF;
      PRAGMA busy_timeout = 37;
      PRAGMA recursive_triggers = OFF;
      PRAGMA ignore_check_constraints = ON;
      PRAGMA trusted_schema = ON;
    `)
    Object.defineProperty(Array.prototype, Symbol.iterator, {
      ...nativeArrayIteratorDescriptor,
      value: function* poisonedArrayIterator() {
        caseState.arrayIteratorCalls += 1
      },
    })
    try {
      error = captureError(() => coordinator.run(() => {
        caseState.callbackCalls += 1
        nativeExec(db, "INSERT INTO failure_probe(value) VALUES ('partial')")
        throw caseState.callbackPrimary
      }))
    } finally {
      Object.defineProperty(
        Array.prototype,
        Symbol.iterator,
        nativeArrayIteratorDescriptor,
      )
    }
  } else if (name === 'success-trace') {
    error = captureError(() => {
      successResult = coordinator.run(() => {
        caseState.callbackCalls += 1
        caseState.trace.push({ operation: 'callback' })
        return 'success-result'
      })
    })
  } else if (name === 'policy-exec-failure' || name === 'policy-read-mismatch') {
    error = captureError(() => coordinator.run(() => {
      caseState.callbackCalls += 1
      return 'not-called'
    }))
  } else if (
    name === 'begin-active-throw' ||
    name === 'begin-active-rollback-fails' ||
    name === 'begin-busy-inactive' ||
    name === 'begin-returned-inactive' ||
    name === 'begin-unreadable'
  ) {
    error = captureError(() => coordinator.run(() => {
      caseState.callbackCalls += 1
      return 'not-called'
    }))
  } else if (name === 'lease-state-unreadable') {
    error = captureError(() => coordinator.run((lease) => {
      caseState.callbackCalls += 1
      failTransactionGetter = true
      assertActiveMutationLease(lease, db)
    }))
  } else if (name === 'state-unreadable-after-callback') {
    error = captureError(() => coordinator.run(() => {
      caseState.callbackCalls += 1
      nativeExec(db, "INSERT INTO failure_probe(value) VALUES ('partial')")
      failTransactionGetter = true
      return 'not-committed'
    }))
  } else if (name === 'ownership-rollback-fails') {
    error = captureError(() => coordinator.run((lease) => {
      caseState.callbackCalls += 1
      nativeExec(db, "INSERT INTO failure_probe(value) VALUES ('partial')")
      try {
        assertActiveMutationLease(lease, wrongDb)
      } catch (ownershipFailure) {
        recordedOwnershipFailure = ownershipFailure
      }
      return 'not-committed'
    }))
  } else if (
    name === 'rollback-throws' ||
    name === 'rollback-throws-undefined' ||
    name === 'rollback-swallowed' ||
    name === 'rollback-state-unreadable'
  ) {
    error = captureError(() => coordinator.run(() => {
      caseState.callbackCalls += 1
      nativeExec(db, "INSERT INTO failure_probe(value) VALUES ('partial')")
      throw caseState.callbackPrimary
    }))
  } else {
    error = captureError(() => coordinator.run(() => {
      caseState.callbackCalls += 1
      nativeExec(db, "INSERT INTO failure_probe(value) VALUES ('effect')")
      return 'not-exposed'
    }))
  }

  const firstRunTransactionControls = caseState.trace
    .filter((entry) =>
      entry.operation === 'exec' &&
      ['BEGIN IMMEDIATE', 'COMMIT', 'ROLLBACK'].includes(entry.sql))
    .map((entry) => entry.sql)
  const poisonExpected = ![
    'success-trace',
    'policy-exec-failure',
    'policy-read-mismatch',
    'begin-active-throw',
    'begin-busy-inactive',
  ].includes(name)
  let reusable = null
  let poisonCode = null
  let poisonReadDelta = null
  let poisonTraceDelta = null
  if (poisonExpected) {
    const readsBefore = {
      ...caseState.accessorReads,
    }
    const traceLengthBefore = caseState.trace.length
    const poisonError = captureError(() => coordinator.run(null))
    poisonCode = poisonError?.code ?? null
    poisonTraceDelta = caseState.trace.length - traceLengthBefore
    poisonReadDelta =
      caseState.accessorReads.open - readsBefore.open +
      caseState.accessorReads.transaction - readsBefore.transaction
  } else if (name !== 'success-trace') {
    failTransactionGetter = false
    reusable = captureError(() => coordinator.run(() => 'reused')) === null
  }

  const transactionBeforeCleanup = nativeTransaction(db)
  const rowCountBeforeCleanup = nativeReflectApply(
    nativeStatementGet,
    nativeReflectApply(nativeDatabasePrepare, db, [
      'SELECT count(*) AS count FROM failure_probe',
    ]),
    [],
  ).count

  const summary = {
    ...summarizeError(error, {
      primary:
        name === 'ownership-rollback-fails'
          ? recordedOwnershipFailure
          : caseState.callbackPrimary,
      cleanup:
        name === 'rollback-state-unreadable'
          ? caseState.stateFailure
          : caseState.rollbackFailure,
      begin: caseState.beginFailure,
      commit: caseState.commitFailure,
    }),
    accessorReads: { ...caseState.accessorReads },
    arrayIteratorCalls: caseState.arrayIteratorCalls,
    callbackCalls: caseState.callbackCalls,
    firstRunTransactionControls,
    poisonCode,
    poisonReadDelta,
    poisonTraceDelta,
    reusable,
    successResult,
    policyValues: {
      busyTimeout: nativeReflectApply(
        nativeStatementGet,
        nativeReflectApply(nativeDatabasePrepare, db, ['PRAGMA busy_timeout']),
        [],
      ).timeout,
      foreignKeys: nativeReflectApply(
        nativeStatementGet,
        nativeReflectApply(nativeDatabasePrepare, db, ['PRAGMA foreign_keys']),
        [],
      ).foreign_keys,
      ignoreCheckConstraints: nativeReflectApply(
        nativeStatementGet,
        nativeReflectApply(nativeDatabasePrepare, db, [
          'PRAGMA ignore_check_constraints',
        ]),
        [],
      ).ignore_check_constraints,
      recursiveTriggers: nativeReflectApply(
        nativeStatementGet,
        nativeReflectApply(nativeDatabasePrepare, db, [
          'PRAGMA recursive_triggers',
        ]),
        [],
      ).recursive_triggers,
      trustedSchema: nativeReflectApply(
        nativeStatementGet,
        nativeReflectApply(nativeDatabasePrepare, db, ['PRAGMA trusted_schema']),
        [],
      ).trusted_schema,
    },
    rowCountBeforeCleanup,
    transactionBeforeCleanup,
    transactionControls: caseState.trace
      .filter((entry) =>
        entry.operation === 'exec' &&
        ['BEGIN IMMEDIATE', 'COMMIT', 'ROLLBACK'].includes(entry.sql))
      .map((entry) => entry.sql),
    successSequence: caseState.trace
      .filter((entry) =>
        entry.operation === 'callback' ||
        (entry.operation === 'exec' &&
          ['BEGIN IMMEDIATE', 'COMMIT', 'ROLLBACK'].includes(entry.sql)))
      .map((entry) => entry.operation === 'callback' ? 'callback' : entry.sql),
  }

  failTransactionGetter = false
  nativeClose(wrongDb)
  nativeClose(db)
  return summary
}

const caseNames = [
  'success-trace',
  'policy-exec-failure',
  'policy-read-mismatch',
  'begin-active-throw',
  'begin-active-rollback-fails',
  'begin-busy-inactive',
  'begin-returned-inactive',
  'begin-unreadable',
  'lease-state-unreadable',
  'state-unreadable-after-callback',
  'commit-after-commit-throw',
  'postcommit-active',
  'postcommit-unreadable',
  'postimport-array-iterator-poison',
  'rollback-throws',
  'rollback-throws-undefined',
  'rollback-swallowed',
  'rollback-state-unreadable',
  'ownership-rollback-fails',
  'commit-active-rollback-fails',
]

const results = {}
for (const name of caseNames) results[name] = runFailureCase(name)
process.stdout.write(`${JSON.stringify(results)}\n`)

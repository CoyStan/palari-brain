import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync, StatementSync } from 'node:sqlite'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import * as mutationModule from '../src/mutation-coordinator.mjs'
import {
  assertActiveMutationLease,
  createMutationCoordinator,
  MemoryMutationError,
} from '../src/mutation-coordinator.mjs'

const reflectApply = Reflect.apply
const nativeDatabaseExec = DatabaseSync.prototype.exec
const nativeDatabaseClose = DatabaseSync.prototype.close
const accessorProbe = new DatabaseSync(':memory:', { open: false })
const nativeDatabaseIsOpen = Object.getOwnPropertyDescriptor(
  accessorProbe,
  'isOpen',
).get
const nativeDatabaseIsTransaction = Object.getOwnPropertyDescriptor(
  accessorProbe,
  'isTransaction',
).get
const INSTRUMENTATION_CHILD_PATH = fileURLToPath(new URL(
  './fixtures/mutation-coordinator-instrumentation-child.mjs',
  import.meta.url,
))

const ERROR_CODES = Object.freeze([
  'mutation_invalid_argument',
  'mutation_connection_invalid',
  'mutation_connection_policy',
  'mutation_transaction_active',
  'mutation_busy',
  'mutation_begin_failed',
  'mutation_async_apply',
  'mutation_transaction_ownership_lost',
  'mutation_commit_failed',
  'mutation_commit_outcome_unknown',
  'mutation_cleanup_failed',
  'mutation_poisoned',
])

function readOpen(db) {
  return reflectApply(nativeDatabaseIsOpen, db, [])
}

function readTransaction(db) {
  return reflectApply(nativeDatabaseIsTransaction, db, [])
}

function nativeExec(db, sql) {
  return reflectApply(nativeDatabaseExec, db, [sql])
}

function nativeClose(db) {
  if (readOpen(db) !== true) return
  try {
    if (readTransaction(db) === true) nativeExec(db, 'ROLLBACK')
  } catch {
    // A closed/poisoned fixture is intentionally not recoverable here.
  }
  if (readOpen(db) === true) reflectApply(nativeDatabaseClose, db, [])
}

function withFilePair(prefix, callback) {
  const directory = mkdtempSync(join(tmpdir(), prefix))
  const dbPath = join(directory, 'workspace.sqlite')
  const owner = new DatabaseSync(dbPath)
  const observer = new DatabaseSync(dbPath)
  try {
    return callback({ dbPath, observer, owner })
  } finally {
    nativeClose(observer)
    nativeClose(owner)
    rmSync(directory, { recursive: true, force: true })
  }
}

function readSinglePragma(db, name) {
  const row = db.prepare(`PRAGMA ${name}`).get()
  const keys = Reflect.ownKeys(row)
  assert.equal(keys.length, 1, `single PRAGMA column: ${name}`)
  return row[keys[0]]
}

function assertMutationCode(callback, expectedCode) {
  let captured
  assert.throws(callback, (error) => {
    captured = error
    assert.equal(error instanceof MemoryMutationError, true)
    assert.equal(Object.getPrototypeOf(error), MemoryMutationError.prototype)
    assert.equal(error.name, 'MemoryMutationError')
    assert.equal(typeof error.message, 'string')
    assert.notEqual(error.message, '')
    assert.equal(error.code, expectedCode)
    assert.deepEqual(Object.keys(error), ['code'])
    assert.deepEqual(Object.getOwnPropertyDescriptor(error, 'code'), {
      value: expectedCode,
      enumerable: true,
      configurable: false,
      writable: false,
    })
    return true
  })
  return captured
}

function runInstrumentationScenario(name) {
  const child = spawnSync(process.execPath, [INSTRUMENTATION_CHILD_PATH, name], {
    encoding: 'utf8',
  })
  assert.equal(
    child.status,
    0,
    `instrumentation child failed\nstdout:\n${child.stdout}\nstderr:\n${child.stderr}`,
  )
  const lines = child.stdout.trim().split('\n')
  assert.equal(lines.length, 1)
  return JSON.parse(lines[0])
}

function makeTrapProxy(target = {}) {
  const counter = { count: 0 }
  const fail = () => {
    counter.count += 1
    throw new Error('proxy trap must not run')
  }
  const proxy = new Proxy(target, {
    defineProperty: fail,
    deleteProperty: fail,
    get: fail,
    getOwnPropertyDescriptor: fail,
    getPrototypeOf: fail,
    has: fail,
    ownKeys: fail,
    set: fail,
  })
  return { counter, proxy }
}

test('M2-A1-01 exact namespace and closed MemoryMutationError constructor', () => {
  assert.deepEqual(Object.keys(mutationModule).sort(), [
    'MemoryMutationError',
    'assertActiveMutationLease',
    'createMutationCoordinator',
  ])

  for (const code of ERROR_CODES) {
    const error = new MemoryMutationError(code, `message:${code}`)
    assert.equal(Object.getPrototypeOf(error), MemoryMutationError.prototype)
    assert.equal(error instanceof MemoryMutationError, true)
    assert.equal(error.name, 'MemoryMutationError')
    assert.equal(error.message, `message:${code}`)
    assert.equal(error.code, code)
    assert.deepEqual(Object.keys(error), ['code'])
    assert.deepEqual(Object.getOwnPropertyDescriptor(error, 'code'), {
      value: code,
      enumerable: true,
      configurable: false,
      writable: false,
    })
    assert.equal(
      Object.getOwnPropertyDescriptor(error, 'message').enumerable,
      false,
    )
    assert.equal(Object.hasOwn(error, 'cause'), false)
    assert.equal(
      Object.hasOwn(new MemoryMutationError(code, 'explicit undefined', undefined), 'cause'),
      false,
    )
    assert.throws(() => {
      error.code = 'mutation_busy'
    }, TypeError)
  }

  const cause = { marker: 'cause' }
  const caused = new MemoryMutationError(
    'mutation_begin_failed',
    'begin failed',
    cause,
  )
  assert.equal(caused.cause, cause)
  assert.deepEqual(Object.getOwnPropertyDescriptor(caused, 'cause'), {
    value: cause,
    enumerable: false,
    configurable: true,
    writable: true,
  })

  const revocableCause = Proxy.revocable({}, {})
  revocableCause.revoke()
  for (const preservedCause of [null, revocableCause.proxy]) {
    const error = new MemoryMutationError(
      'mutation_begin_failed',
      'preserved cause',
      preservedCause,
    )
    assert.equal(error.cause, preservedCause)
  }

  for (const code of [
    undefined,
    null,
    '',
    'mutation_unknown',
    new String('mutation_busy'),
    {},
  ]) {
    assert.throws(() => new MemoryMutationError(code, 'message'), TypeError)
  }
  for (const message of [undefined, null, '', new String('message'), {}]) {
    assert.throws(
      () => new MemoryMutationError('mutation_busy', message),
      TypeError,
    )
  }
})

test('M2-A1-01 factory returns an exact frozen coordinator record', () => {
  const db = new DatabaseSync(':memory:')
  try {
    const coordinator = createMutationCoordinator(db)
    assert.equal(Object.getPrototypeOf(coordinator), Object.prototype)
    assert.equal(Object.isFrozen(coordinator), true)
    assert.equal(Object.isExtensible(coordinator), false)
    assert.deepEqual(Reflect.ownKeys(coordinator), ['run'])
    assert.deepEqual(Object.keys(coordinator), ['run'])
    assert.equal(typeof coordinator.run, 'function')
    assert.deepEqual(Object.getOwnPropertyDescriptor(coordinator, 'run'), {
      value: coordinator.run,
      enumerable: true,
      configurable: false,
      writable: false,
    })
  } finally {
    nativeClose(db)
  }
})

test('M2-A1-02 coordinator issues one opaque active lease and retires it', () => {
  const db = new DatabaseSync(':memory:')
  try {
    const coordinator = createMutationCoordinator(db)
    const expectedResult = { committed: true }
    let capturedLease
    let previousLease
    const result = coordinator.run(function coordinatorCallback(lease) {
      assert.equal(this, undefined)
      assert.equal(arguments.length, 1)
      assert.equal(Object.isFrozen(lease), true)
      assert.deepEqual(Reflect.ownKeys(lease), [])
      assert.equal(Object.hasOwn(lease, 'db'), false)
      assert.equal(assertActiveMutationLease(lease, db), undefined)
      capturedLease = lease
      return expectedResult
    })
    assert.equal(result, expectedResult)
    assert.equal(readTransaction(db), false)

    assertMutationCode(
      () => assertActiveMutationLease(capturedLease, db),
      'mutation_transaction_ownership_lost',
    )
    assert.equal(coordinator.run(() => 7), 7, 'stale use does not poison')

    coordinator.run((lease) => {
      previousLease = lease
    })
    assert.notEqual(previousLease, capturedLease, 'every run gets a fresh lease')

    assertMutationCode(
      () => assertActiveMutationLease(capturedLease, {}),
      'mutation_transaction_ownership_lost',
    )
    assert.equal(coordinator.run(() => 8), 8, 'stale classification wins')
  } finally {
    nativeClose(db)
  }
})

test('M2-A1-02 sets all five PRAGMAs and exposes results only after commit', () => {
  withFilePair('palari-m2-a1-success-', ({ observer, owner }) => {
    nativeExec(owner, `
      PRAGMA foreign_keys = OFF;
      PRAGMA busy_timeout = 37;
      PRAGMA recursive_triggers = OFF;
      PRAGMA ignore_check_constraints = ON;
      PRAGMA trusted_schema = ON;
      CREATE TABLE visibility_probe (value TEXT NOT NULL);
    `)
    const coordinator = createMutationCoordinator(owner)
    const expected = { value: 'committed-result' }
    let callbackReturned = false

    const actual = coordinator.run((lease) => {
      assert.equal(assertActiveMutationLease(lease, owner), undefined)
      assert.equal(readTransaction(owner), true)
      assert.equal(readSinglePragma(owner, 'foreign_keys'), 1)
      assert.equal(readSinglePragma(owner, 'busy_timeout'), 0)
      assert.equal(readSinglePragma(owner, 'recursive_triggers'), 1)
      assert.equal(readSinglePragma(owner, 'ignore_check_constraints'), 0)
      assert.equal(readSinglePragma(owner, 'trusted_schema'), 0)
      owner.prepare(
        "INSERT INTO visibility_probe(value) VALUES ('uncommitted')",
      ).run()
      assert.equal(
        observer.prepare('SELECT count(*) AS count FROM visibility_probe').get().count,
        0,
      )
      callbackReturned = true
      return expected
    })

    assert.equal(callbackReturned, true)
    assert.equal(actual, expected)
    assert.equal(readTransaction(owner), false)
    assert.equal(
      observer.prepare('SELECT count(*) AS count FROM visibility_probe').get().count,
      1,
    )
  })
})

test('M2-A1-02 callback throw rolls back and preserves exact primary identity', () => {
  const db = new DatabaseSync(':memory:')
  try {
    nativeExec(db, 'CREATE TABLE rollback_probe (value TEXT NOT NULL)')
    const coordinator = createMutationCoordinator(db)
    const primary = new Error('callback primary')
    assert.throws(() => coordinator.run(() => {
      nativeExec(db, "INSERT INTO rollback_probe(value) VALUES ('partial')")
      throw primary
    }), (error) => error === primary)
    assert.equal(readTransaction(db), false)
    assert.equal(
      db.prepare('SELECT count(*) AS count FROM rollback_probe').get().count,
      0,
    )
    assert.equal(coordinator.run(() => 'reusable'), 'reusable')
  } finally {
    nativeClose(db)
  }
})

for (const asyncKind of ['promise', 'thenable']) {
  test(`M2-A1-02 ${asyncKind} callback result rolls back without invoking then`, () => {
    const db = new DatabaseSync(':memory:')
    try {
      nativeExec(db, 'CREATE TABLE async_probe (value TEXT NOT NULL)')
      const coordinator = createMutationCoordinator(db)
      let thenCalls = 0
      assertMutationCode(() => coordinator.run(() => {
        nativeExec(db, "INSERT INTO async_probe(value) VALUES ('partial')")
        if (asyncKind === 'promise') return Promise.resolve('later')
        return {
          then() {
            thenCalls += 1
          },
        }
      }), 'mutation_async_apply')
      assert.equal(thenCalls, 0)
      assert.equal(readTransaction(db), false)
      assert.equal(
        db.prepare('SELECT count(*) AS count FROM async_probe').get().count,
        0,
      )
      assert.equal(coordinator.run(() => 'reusable'), 'reusable')
    } finally {
      nativeClose(db)
    }
  })
}

test('M2-A1-02 rejects caller transactions and synchronous re-entry without ownership', () => {
  const db = new DatabaseSync(':memory:')
  try {
    const coordinator = createMutationCoordinator(db)
    nativeExec(db, 'BEGIN')
    let callbackCalls = 0
    assertMutationCode(() => coordinator.run(() => {
      callbackCalls += 1
    }), 'mutation_transaction_active')
    assert.equal(callbackCalls, 0)
    assert.equal(readTransaction(db), true)
    nativeExec(db, 'ROLLBACK')

    const outer = coordinator.run(() => {
      assertMutationCode(() => coordinator.run(() => {
        callbackCalls += 1
      }), 'mutation_transaction_active')
      assert.equal(readTransaction(db), true)
      return 'outer'
    })
    assert.equal(outer, 'outer')
    assert.equal(callbackCalls, 0)
    assert.equal(readTransaction(db), false)
  } finally {
    nativeClose(db)
  }
})

test('M2-A1-02 held write lock is fail-fast busy, unretried, and reusable', () => {
  withFilePair('palari-m2-a1-busy-', ({ observer: blocker, owner }) => {
    const coordinator = createMutationCoordinator(owner)
    nativeExec(blocker, 'PRAGMA busy_timeout = 0; BEGIN IMMEDIATE')
    let callbackCalls = 0
    const startedAt = performance.now()
    assertMutationCode(() => coordinator.run(() => {
      callbackCalls += 1
    }), 'mutation_busy')
    const elapsedMs = performance.now() - startedAt
    assert.equal(callbackCalls, 0)
    assert.equal(readTransaction(owner), false)
    assert.ok(elapsedMs < 500, `busy must be fail-fast, observed ${elapsedMs}ms`)
    nativeExec(blocker, 'ROLLBACK')
    assert.equal(coordinator.run(() => 'after-lock'), 'after-lock')
  })
})

test('M2-A1-02 non-busy BEGIN failure does not invoke callback and is reusable', () => {
  const db = new DatabaseSync(':memory:')
  try {
    const coordinator = createMutationCoordinator(db)
    nativeExec(db, 'PRAGMA query_only = ON')
    let callbackCalls = 0
    assertMutationCode(() => coordinator.run(() => {
      callbackCalls += 1
    }), 'mutation_begin_failed')
    assert.equal(callbackCalls, 0)
    assert.equal(readTransaction(db), false)
    nativeExec(db, 'PRAGMA query_only = OFF')
    assert.equal(coordinator.run(() => 'after-readonly'), 'after-readonly')
  } finally {
    nativeClose(db)
  }
})

test('M2-A1-02 pinned runtime cannot identify replacement transactions', () => {
  const db = new DatabaseSync(':memory:')
  try {
    nativeExec(db, 'BEGIN IMMEDIATE')
    assert.equal(readTransaction(db), true)
    nativeExec(db, 'COMMIT; BEGIN IMMEDIATE')
    assert.equal(readTransaction(db), true)
    nativeExec(db, 'ROLLBACK')

    nativeExec(db, 'BEGIN IMMEDIATE')
    assert.equal(readTransaction(db), true)
    nativeExec(db, 'ROLLBACK; BEGIN IMMEDIATE')
    assert.equal(readTransaction(db), true)
    nativeExec(db, 'ROLLBACK')
  } finally {
    nativeClose(db)
  }
})

test('M2-A1-01 unknown lease wins before database inspection', () => {
  const { counter, proxy } = makeTrapProxy()
  assertMutationCode(
    () => assertActiveMutationLease({}, proxy),
    'mutation_invalid_argument',
  )
  assert.equal(counter.count, 0)
  assertMutationCode(
    () => assertActiveMutationLease(null, proxy),
    'mutation_invalid_argument',
  )
  assert.equal(counter.count, 0)
})

for (const laterOutcome of ['return', 'throw', 'promise', 'throwing_then']) {
  test(`M2-A1-03 active lease misuse poisons and wins over later ${laterOutcome}`, () => {
    const db = new DatabaseSync(':memory:')
    const wrongDb = new DatabaseSync(':memory:')
    const nonNative = makeTrapProxy()
    try {
      nativeExec(db, 'CREATE TABLE lease_probe (value TEXT NOT NULL)')
      const coordinator = createMutationCoordinator(db)
      const laterFailure = new Error('later callback failure')
      let ownershipFailure
      let thenGetterCalls = 0

      const thrown = assertMutationCode(() => coordinator.run((lease) => {
        assert.equal(assertActiveMutationLease(lease, db), undefined)
        nativeExec(db, "INSERT INTO lease_probe(value) VALUES ('uncommitted')")
        try {
          assertActiveMutationLease(
            lease,
            laterOutcome === 'throw' || laterOutcome === 'throwing_then'
              ? wrongDb
              : nonNative.proxy,
          )
        } catch (error) {
          ownershipFailure = error
        }
        if (laterOutcome === 'throw') throw laterFailure
        if (laterOutcome === 'promise') return Promise.resolve('must not win')
        if (laterOutcome === 'throwing_then') {
          return Object.defineProperty({}, 'then', {
            get() {
              thenGetterCalls += 1
              throw new Error('then getter must not run')
            },
          })
        }
        return 'must not commit'
      }), 'mutation_transaction_ownership_lost')

      assert.equal(thrown, ownershipFailure)
      assert.equal(nonNative.counter.count, 0)
      assert.equal(thenGetterCalls, 0)
      assert.equal(readTransaction(db), false)
      assert.equal(
        db.prepare('SELECT count(*) AS count FROM lease_probe').get().count,
        0,
      )
      nativeClose(db)
      assertMutationCode(() => coordinator.run(null), 'mutation_poisoned')
    } finally {
      nativeClose(wrongDb)
      nativeClose(db)
    }
  })
}

test('M2-A1-03 active lease misuse inside a then getter wins before commit', () => {
  const db = new DatabaseSync(':memory:')
  const wrongDb = new DatabaseSync(':memory:')
  try {
    nativeExec(db, 'CREATE TABLE lease_getter_probe (value TEXT NOT NULL)')
    const coordinator = createMutationCoordinator(db)
    let ownershipFailure
    let getterCalls = 0

    const thrown = assertMutationCode(() => coordinator.run((lease) => {
      nativeExec(
        db,
        "INSERT INTO lease_getter_probe(value) VALUES ('uncommitted')",
      )
      return Object.defineProperty({}, 'then', {
        get() {
          getterCalls += 1
          try {
            assertActiveMutationLease(lease, wrongDb)
          } catch (error) {
            ownershipFailure = error
          }
          return undefined
        },
      })
    }), 'mutation_transaction_ownership_lost')

    assert.equal(getterCalls, 1)
    assert.equal(thrown, ownershipFailure)
    assert.equal(readTransaction(db), false)
    assert.equal(
      db.prepare(
        'SELECT count(*) AS count FROM lease_getter_probe',
      ).get().count,
      0,
    )
    assertMutationCode(() => coordinator.run(null), 'mutation_poisoned')
  } finally {
    nativeClose(wrongDb)
    nativeClose(db)
  }
})

test('M2-A1-03 deferred-FK commit failure rolls back and remains reusable', () => {
  const db = new DatabaseSync(':memory:')
  try {
    nativeExec(db, `
      CREATE TABLE commit_parent (id INTEGER PRIMARY KEY);
      CREATE TABLE commit_child (
        parent_id INTEGER NOT NULL,
        FOREIGN KEY (parent_id) REFERENCES commit_parent(id)
          DEFERRABLE INITIALLY DEFERRED
      );
    `)
    const coordinator = createMutationCoordinator(db)
    const failure = assertMutationCode(() => coordinator.run(() => {
      nativeExec(db, 'INSERT INTO commit_child(parent_id) VALUES (404)')
      return 'must not escape'
    }), 'mutation_commit_failed')
    assert.equal(failure.cause?.code, 'ERR_SQLITE_ERROR')
    assert.equal(readTransaction(db), false)
    assert.equal(
      db.prepare('SELECT count(*) AS count FROM commit_child').get().count,
      0,
    )
    assert.equal(coordinator.run(() => 'reusable'), 'reusable')
  } finally {
    nativeClose(db)
  }
})

for (const control of ['ROLLBACK', 'COMMIT']) {
  test(`M2-A1-03 callback ${control} loses ownership and poisons without false restoration`, () => {
    const db = new DatabaseSync(':memory:')
    try {
      nativeExec(db, 'CREATE TABLE owner_loss_probe (value TEXT NOT NULL)')
      const coordinator = createMutationCoordinator(db)
      assertMutationCode(() => coordinator.run(() => {
        nativeExec(db, "INSERT INTO owner_loss_probe(value) VALUES ('effect')")
        nativeExec(db, control)
        return 'must not escape'
      }), 'mutation_transaction_ownership_lost')
      assert.equal(readTransaction(db), false)
      assert.equal(
        db.prepare('SELECT count(*) AS count FROM owner_loss_probe').get().count,
        control === 'COMMIT' ? 1 : 0,
      )
      assertMutationCode(() => coordinator.run(() => 'no'), 'mutation_poisoned')
    } finally {
      nativeClose(db)
    }
  })
}

test('M2-A1-03 callback connection close is ownership loss with no rollback claim', () => {
  const db = new DatabaseSync(':memory:')
  const coordinator = createMutationCoordinator(db)
  assertMutationCode(() => coordinator.run(() => {
    reflectApply(nativeDatabaseClose, db, [])
  }), 'mutation_transaction_ownership_lost')
  assert.equal(readOpen(db), false)
  assertMutationCode(() => coordinator.run(null), 'mutation_poisoned')
})

for (const lostState of ['inactive', 'closed']) {
  test(`M2-A1-03 active lease assertion records exact-owner ${lostState} state`, () => {
    const db = new DatabaseSync(':memory:')
    try {
      const coordinator = createMutationCoordinator(db)
      let assertionFailure
      const runFailure = assertMutationCode(() => coordinator.run((lease) => {
        if (lostState === 'inactive') nativeExec(db, 'ROLLBACK')
        else reflectApply(nativeDatabaseClose, db, [])
        assertionFailure = assertMutationCode(
          () => assertActiveMutationLease(lease, db),
          'mutation_transaction_ownership_lost',
        )
      }), 'mutation_transaction_ownership_lost')
      assert.equal(runFailure, assertionFailure)
      assert.equal(readOpen(db), lostState === 'inactive')
      if (readOpen(db)) assert.equal(readTransaction(db), false)
      assertMutationCode(() => coordinator.run(null), 'mutation_poisoned')
    } finally {
      nativeClose(db)
    }
  })
}

test('M2-A1-03 instrumented infrastructure failures obey exact cleanup precedence', () => {
  const results = runInstrumentationScenario('failure-matrix')

  assert.equal(results['success-trace'].code, null)
  assert.equal(results['success-trace'].successResult, 'success-result')
  assert.equal(results['success-trace'].transactionBeforeCleanup, false)
  assert.deepEqual(results['success-trace'].successSequence, [
    'BEGIN IMMEDIATE',
    'callback',
    'COMMIT',
  ])

  for (const name of ['policy-exec-failure', 'policy-read-mismatch']) {
    assert.equal(results[name].code, 'mutation_connection_policy', name)
    assert.equal(results[name].callbackCalls, 0, name)
    assert.deepEqual(results[name].firstRunTransactionControls, [], name)
    assert.equal(results[name].reusable, true, name)
    assert.equal(results[name].transactionBeforeCleanup, false, name)
    assert.deepEqual(results[name].transactionControls, [
      'BEGIN IMMEDIATE',
      'COMMIT',
    ], name)
  }

  assert.equal(results['begin-active-throw'].code, 'mutation_begin_failed')
  assert.equal(results['begin-active-throw'].callbackCalls, 0)
  assert.equal(results['begin-active-throw'].reusable, true)
  assert.deepEqual(results['begin-active-throw'].firstRunTransactionControls, [
    'BEGIN IMMEDIATE',
    'ROLLBACK',
  ])
  assert.deepEqual(results['begin-active-throw'].transactionControls, [
    'BEGIN IMMEDIATE',
    'ROLLBACK',
    'BEGIN IMMEDIATE',
    'COMMIT',
  ])

  const busyInactive = results['begin-busy-inactive']
  assert.equal(busyInactive.code, 'mutation_busy')
  assert.equal(busyInactive.callbackCalls, 0)
  assert.equal(busyInactive.reusable, true)
  assert.equal(busyInactive.transactionBeforeCleanup, false)
  assert.deepEqual(busyInactive.firstRunTransactionControls, [
    'BEGIN IMMEDIATE',
  ])

  const returnedInactive = results['begin-returned-inactive']
  assert.equal(returnedInactive.code, 'mutation_begin_failed')
  assert.equal(returnedInactive.callbackCalls, 0)
  assert.equal(returnedInactive.transactionBeforeCleanup, false)
  assert.deepEqual(returnedInactive.firstRunTransactionControls, [
    'BEGIN IMMEDIATE',
  ])

  const beginCleanup = results['begin-active-rollback-fails']
  assert.equal(beginCleanup.code, 'mutation_cleanup_failed')
  assert.equal(beginCleanup.nativeAggregate, true)
  assert.equal(beginCleanup.aggregateLength, 2)
  assert.equal(beginCleanup.firstCode, 'mutation_begin_failed')
  assert.equal(beginCleanup.firstCauseIsBeginFailure, true)
  assert.equal(beginCleanup.secondIsCleanup, true)
  assert.equal(beginCleanup.callbackCalls, 0)
  assert.equal(beginCleanup.transactionBeforeCleanup, true)
  assert.deepEqual(beginCleanup.firstRunTransactionControls, [
    'BEGIN IMMEDIATE',
    'ROLLBACK',
  ])

  assert.equal(results['begin-unreadable'].code, 'mutation_begin_failed')
  assert.equal(results['begin-unreadable'].callbackCalls, 0)
  assert.equal(results['begin-unreadable'].poisonCode, 'mutation_poisoned')
  assert.equal(results['begin-unreadable'].poisonReadDelta, 0)
  assert.equal(results['begin-unreadable'].transactionBeforeCleanup, false)
  assert.deepEqual(results['begin-unreadable'].transactionControls, [
    'BEGIN IMMEDIATE',
  ])

  const unreadableLease = results['lease-state-unreadable']
  assert.equal(
    unreadableLease.code,
    'mutation_transaction_ownership_lost',
  )
  assert.equal(unreadableLease.callbackCalls, 1)
  assert.equal(unreadableLease.transactionBeforeCleanup, true)
  assert.deepEqual(unreadableLease.firstRunTransactionControls, [
    'BEGIN IMMEDIATE',
  ])

  const unreadableCallback = results['state-unreadable-after-callback']
  assert.equal(
    unreadableCallback.code,
    'mutation_transaction_ownership_lost',
  )
  assert.equal(unreadableCallback.poisonCode, 'mutation_poisoned')
  assert.equal(unreadableCallback.poisonReadDelta, 0)
  assert.equal(unreadableCallback.callbackCalls, 1)
  assert.equal(unreadableCallback.transactionBeforeCleanup, true)
  assert.deepEqual(unreadableCallback.transactionControls, ['BEGIN IMMEDIATE'])

  for (const name of [
    'commit-after-commit-throw',
    'postcommit-active',
    'postcommit-unreadable',
  ]) {
    const result = results[name]
    assert.equal(result.code, 'mutation_commit_outcome_unknown', name)
    assert.equal(result.poisonCode, 'mutation_poisoned', name)
    assert.equal(result.poisonReadDelta, 0, name)
    assert.equal(result.rowCountBeforeCleanup, 1, name)
    assert.deepEqual(result.transactionControls, [
      'BEGIN IMMEDIATE',
      'COMMIT',
    ], name)
  }
  assert.equal(results['commit-after-commit-throw'].transactionBeforeCleanup, false)
  assert.equal(results['postcommit-active'].transactionBeforeCleanup, true)
  assert.equal(results['postcommit-unreadable'].transactionBeforeCleanup, false)

  const primordialPoison = results['postimport-array-iterator-poison']
  assert.equal(primordialPoison.code, 'mutation_cleanup_failed')
  assert.equal(primordialPoison.nativeAggregate, true)
  assert.equal(primordialPoison.aggregateLength, 2)
  assert.equal(primordialPoison.firstIsPrimary, true)
  assert.equal(primordialPoison.secondIsCleanup, true)
  assert.equal(primordialPoison.arrayIteratorCalls, 0)
  assert.deepEqual(primordialPoison.policyValues, {
    busyTimeout: 0,
    foreignKeys: 1,
    ignoreCheckConstraints: 0,
    recursiveTriggers: 1,
    trustedSchema: 0,
  })
  assert.equal(primordialPoison.poisonCode, 'mutation_poisoned')
  assert.equal(primordialPoison.poisonReadDelta, 0)
  assert.equal(primordialPoison.transactionBeforeCleanup, false)

  const rollbackThrows = results['rollback-throws']
  assert.equal(rollbackThrows.code, 'mutation_cleanup_failed')
  assert.equal(rollbackThrows.nativeAggregate, true)
  assert.equal(rollbackThrows.aggregateLength, 2)
  assert.equal(rollbackThrows.firstIsPrimary, true)
  assert.equal(rollbackThrows.secondIsCleanup, true)
  assert.equal(rollbackThrows.poisonCode, 'mutation_poisoned')
  assert.equal(rollbackThrows.poisonReadDelta, 0)
  assert.equal(rollbackThrows.transactionBeforeCleanup, true)

  const rollbackThrowsUndefined = results['rollback-throws-undefined']
  assert.equal(rollbackThrowsUndefined.code, 'mutation_cleanup_failed')
  assert.equal(rollbackThrowsUndefined.nativeAggregate, true)
  assert.equal(rollbackThrowsUndefined.aggregateLength, 2)
  assert.equal(rollbackThrowsUndefined.firstIsPrimary, true)
  assert.equal(rollbackThrowsUndefined.secondIsUndefined, true)
  assert.equal(rollbackThrowsUndefined.poisonCode, 'mutation_poisoned')
  assert.equal(rollbackThrowsUndefined.poisonReadDelta, 0)
  assert.equal(rollbackThrowsUndefined.transactionBeforeCleanup, false)

  const rollbackSwallowed = results['rollback-swallowed']
  assert.equal(rollbackSwallowed.code, 'mutation_cleanup_failed')
  assert.equal(rollbackSwallowed.nativeAggregate, true)
  assert.equal(rollbackSwallowed.aggregateLength, 2)
  assert.equal(rollbackSwallowed.firstIsPrimary, true)
  assert.equal(rollbackSwallowed.nativeSecondError, true)
  assert.equal(
    rollbackSwallowed.secondMessage,
    'Rollback did not end the transaction.',
  )
  assert.equal(rollbackSwallowed.transactionBeforeCleanup, true)

  const rollbackUnreadable = results['rollback-state-unreadable']
  assert.equal(rollbackUnreadable.code, 'mutation_cleanup_failed')
  assert.equal(rollbackUnreadable.nativeAggregate, true)
  assert.equal(rollbackUnreadable.aggregateLength, 2)
  assert.equal(rollbackUnreadable.firstIsPrimary, true)
  assert.equal(rollbackUnreadable.secondIsCleanup, true)
  assert.equal(
    rollbackUnreadable.secondMessage,
    'injected state inspection failure',
  )
  assert.equal(rollbackUnreadable.transactionBeforeCleanup, false)

  const ownershipCleanup = results['ownership-rollback-fails']
  assert.equal(ownershipCleanup.code, 'mutation_cleanup_failed')
  assert.equal(ownershipCleanup.nativeAggregate, true)
  assert.equal(ownershipCleanup.aggregateLength, 2)
  assert.equal(
    ownershipCleanup.firstCode,
    'mutation_transaction_ownership_lost',
  )
  assert.equal(ownershipCleanup.firstIsPrimary, true)
  assert.equal(ownershipCleanup.secondIsCleanup, true)

  const commitCleanup = results['commit-active-rollback-fails']
  assert.equal(commitCleanup.code, 'mutation_cleanup_failed')
  assert.equal(commitCleanup.nativeAggregate, true)
  assert.equal(commitCleanup.aggregateLength, 2)
  assert.equal(commitCleanup.firstCode, 'mutation_commit_failed')
  assert.equal(commitCleanup.firstCauseIsCommitFailure, true)
  assert.equal(commitCleanup.secondIsCleanup, true)

  for (const name of [
    'begin-active-rollback-fails',
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
    'postimport-array-iterator-poison',
    'rollback-swallowed',
    'rollback-state-unreadable',
    'ownership-rollback-fails',
    'commit-active-rollback-fails',
  ]) {
    assert.equal(results[name].poisonCode, 'mutation_poisoned', name)
    assert.equal(results[name].poisonReadDelta, 0, name)
    assert.equal(results[name].poisonTraceDelta, 0, name)
  }
})

test('M2-A1-01 rejects database spoofs and Proxies without traps', () => {
  for (const value of [
    null,
    undefined,
    {},
    Object.create(DatabaseSync.prototype),
    function notDatabase() {},
  ]) {
    assertMutationCode(
      () => createMutationCoordinator(value),
      'mutation_invalid_argument',
    )
  }

  const fake = makeTrapProxy()
  assertMutationCode(
    () => createMutationCoordinator(fake.proxy),
    'mutation_invalid_argument',
  )
  assert.equal(fake.counter.count, 0)

  const revoked = Proxy.revocable({}, makeTrapProxy().proxy)
  revoked.revoke()
  assertMutationCode(
    () => createMutationCoordinator(revoked.proxy),
    'mutation_invalid_argument',
  )

  const realDb = new DatabaseSync(':memory:')
  try {
    const wrapped = makeTrapProxy(realDb)
    assertMutationCode(
      () => createMutationCoordinator(wrapped.proxy),
      'mutation_invalid_argument',
    )
    assert.equal(wrapped.counter.count, 0)
  } finally {
    nativeClose(realDb)
  }
})

test('M2-A1-01 classifies a closed connection at construction', () => {
  const unopened = new DatabaseSync(':memory:', { open: false })
  assertMutationCode(
    () => createMutationCoordinator(unopened),
    'mutation_connection_invalid',
  )
  const alreadyClosed = new DatabaseSync(':memory:')
  nativeClose(alreadyClosed)
  assertMutationCode(
    () => createMutationCoordinator(alreadyClosed),
    'mutation_connection_invalid',
  )

})

test('M2-A1-02 classifies a connection closed after coordinator construction', () => {
  const closedLater = new DatabaseSync(':memory:')
  const coordinator = createMutationCoordinator(closedLater)
  nativeClose(closedLater)
  let callbackCalls = 0
  assertMutationCode(() => coordinator.run(() => {
    callbackCalls += 1
  }), 'mutation_connection_invalid')
  assert.equal(callbackCalls, 0)
})

test('M2-A1-01 accepts native subclasses and changed-prototype connections', () => {
  class DatabaseSubclass extends DatabaseSync {}
  const subclass = new DatabaseSubclass(':memory:')
  const changedPrototype = new DatabaseSync(':memory:')
  Object.setPrototypeOf(changedPrototype, null)
  try {
    for (const [db, expected] of [
      [subclass, 'subclass'],
      [changedPrototype, 'changed-prototype'],
    ]) {
      const coordinator = createMutationCoordinator(db)
      assert.equal(coordinator.run((lease) => {
        assert.equal(assertActiveMutationLease(lease, db), undefined)
        return expected
      }), expected)
      assert.equal(readTransaction(db), false)
    }
  } finally {
    nativeClose(subclass)
    nativeClose(changedPrototype)
  }
})

test('M2-A1-02 captured dispatch ignores later instance and prototype shadows', () => {
  const db = new DatabaseSync(':memory:', {
    readBigInts: true,
    returnArrays: true,
  })
  const databaseDescriptors = new Map()
  const statementDescriptors = new Map()
  for (const key of ['exec', 'prepare']) {
    databaseDescriptors.set(
      key,
      Object.getOwnPropertyDescriptor(DatabaseSync.prototype, key),
    )
  }
  for (const key of ['get', 'setReadBigInts', 'setReturnArrays']) {
    statementDescriptors.set(
      key,
      Object.getOwnPropertyDescriptor(StatementSync.prototype, key),
    )
  }
  let poisonCalls = 0
  const poison = () => {
    poisonCalls += 1
    throw new Error('dynamic sqlite dispatch ran')
  }

  Object.defineProperty(db, 'exec', { value: poison })
  Object.defineProperty(db, 'prepare', { value: poison })
  for (const key of databaseDescriptors.keys()) {
    Object.defineProperty(DatabaseSync.prototype, key, {
      ...databaseDescriptors.get(key),
      value: poison,
    })
  }
  for (const key of statementDescriptors.keys()) {
    Object.defineProperty(StatementSync.prototype, key, {
      ...statementDescriptors.get(key),
      value: poison,
    })
  }

  try {
    assert.equal(createMutationCoordinator(db).run(() => 'captured'), 'captured')
    assert.equal(poisonCalls, 0)
  } finally {
    for (const [key, descriptor] of databaseDescriptors) {
      Object.defineProperty(DatabaseSync.prototype, key, descriptor)
    }
    for (const [key, descriptor] of statementDescriptors) {
      Object.defineProperty(StatementSync.prototype, key, descriptor)
    }
    nativeClose(db)
  }
})

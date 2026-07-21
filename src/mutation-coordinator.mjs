// V2-M2-A1 transaction coordinator — new kernel code.
// Captured-dispatch and trap-free native-brand patterns are adapted from
// src/memory-bundle-runtime.mjs and src/memory-bundle-errors.mjs at
// palari-brain commit 616c60b. Intentional delta: this module owns one outer
// semantic transaction and issues opaque lexical leases; it neither imports
// nor changes CDX-B1 and it exposes no database operation.

import { DatabaseSync, StatementSync } from 'node:sqlite'
import { types as utilTypes } from 'node:util'

const reflectApply = Reflect.apply
const reflectConstruct = Reflect.construct
const reflectDefineProperty = Reflect.defineProperty
const reflectGet = Reflect.get
const reflectGetOwnPropertyDescriptor = Reflect.getOwnPropertyDescriptor
const reflectOwnKeys = Reflect.ownKeys
const objectFreeze = Object.freeze
const objectHasOwnProperty = Object.prototype.hasOwnProperty
const numberIsSafeInteger = Number.isSafeInteger
const setHas = Set.prototype.has
const symbolIterator = Symbol.iterator
const weakMapGet = WeakMap.prototype.get
const weakMapSet = WeakMap.prototype.set
const isProxy = utilTypes.isProxy

const nativeError = Error
const nativeAggregateError = AggregateError
const nativeTypeError = TypeError

const databaseExec = DatabaseSync.prototype.exec
const databasePrepare = DatabaseSync.prototype.prepare
const statementGet = StatementSync.prototype.get
const statementSetReadBigInts = StatementSync.prototype.setReadBigInts
const statementSetReturnArrays = StatementSync.prototype.setReturnArrays

const { databaseIsOpen, databaseIsTransaction } = (() => {
  const probe = reflectConstruct(DatabaseSync, [':memory:', { open: false }])
  return {
    databaseIsOpen: reflectGetOwnPropertyDescriptor(probe, 'isOpen').get,
    databaseIsTransaction: reflectGetOwnPropertyDescriptor(
      probe,
      'isTransaction',
    ).get,
  }
})()

const MUTATION_ERROR_CODE_SET = new Set([
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

function throwNativeTypeError(message) {
  throw reflectConstruct(nativeTypeError, [message])
}

export class MemoryMutationError extends Error {
  constructor(code, message, cause) {
    if (
      typeof code !== 'string' ||
      !reflectApply(setHas, MUTATION_ERROR_CODE_SET, [code])
    ) {
      throwNativeTypeError('Unknown memory mutation error code.')
    }
    if (typeof message !== 'string' || message === '') {
      throwNativeTypeError(
        'Memory mutation error message must be a non-empty string.',
      )
    }

    const error = reflectConstruct(
      nativeError,
      cause === undefined
        ? [message]
        : [message, { __proto__: null, cause }],
      memoryMutationErrorNewTarget,
    )
    reflectApply(reflectDefineProperty, undefined, [error, 'name', {
      __proto__: null,
      value: 'MemoryMutationError',
      enumerable: false,
      configurable: true,
      writable: true,
    }])
    reflectApply(reflectDefineProperty, undefined, [error, 'code', {
      __proto__: null,
      value: code,
      enumerable: true,
      configurable: false,
      writable: false,
    }])
    return error
  }
}

const memoryMutationErrorNewTarget = MemoryMutationError
const leaseStates = new WeakMap()

function mutationFailure(code, message, cause) {
  return reflectConstruct(
    MemoryMutationError,
    cause === undefined ? [code, message] : [code, message, cause],
  )
}

function captureDatabaseOpenState(value) {
  if (reflectApply(isProxy, undefined, [value])) {
    throw mutationFailure(
      'mutation_invalid_argument',
      'A native DatabaseSync connection is required.',
    )
  }
  try {
    return reflectApply(databaseIsOpen, value, [])
  } catch (error) {
    throw mutationFailure(
      'mutation_invalid_argument',
      'A native DatabaseSync connection is required.',
      error,
    )
  }
}

function assertOpenDatabaseSync(value) {
  if (captureDatabaseOpenState(value) !== true) {
    throw mutationFailure(
      'mutation_connection_invalid',
      'The DatabaseSync connection must be open.',
    )
  }
}

function execDatabase(db, sql) {
  return reflectApply(databaseExec, db, [sql])
}

function preparePolicyStatement(db, sql) {
  const statement = reflectApply(databasePrepare, db, [sql])
  reflectApply(statementSetReadBigInts, statement, [false])
  reflectApply(statementSetReturnArrays, statement, [false])
  return statement
}

function readPolicyValue(db, sql) {
  const statement = preparePolicyStatement(db, sql)
  const row = reflectApply(statementGet, statement, [])
  if (row === null || typeof row !== 'object') {
    throw reflectConstruct(nativeError, ['PRAGMA readback returned no row.'])
  }
  const keys = reflectApply(reflectOwnKeys, undefined, [row])
  if (keys.length !== 1 || typeof keys[0] !== 'string') {
    throw reflectConstruct(nativeError, ['PRAGMA readback was not scalar.'])
  }
  const descriptor = reflectApply(
    reflectGetOwnPropertyDescriptor,
    undefined,
    [row, keys[0]],
  )
  if (
    descriptor === undefined ||
    !reflectApply(objectHasOwnProperty, descriptor, ['value'])
  ) {
    throw reflectConstruct(nativeError, ['PRAGMA readback was not a data row.'])
  }
  return descriptor.value
}

const CONNECTION_POLICY = objectFreeze([
  objectFreeze({
    setSql: 'PRAGMA foreign_keys = ON',
    readSql: 'PRAGMA foreign_keys',
    expected: 1,
  }),
  objectFreeze({
    setSql: 'PRAGMA busy_timeout = 0',
    readSql: 'PRAGMA busy_timeout',
    expected: 0,
  }),
  objectFreeze({
    setSql: 'PRAGMA recursive_triggers = ON',
    readSql: 'PRAGMA recursive_triggers',
    expected: 1,
  }),
  objectFreeze({
    setSql: 'PRAGMA ignore_check_constraints = OFF',
    readSql: 'PRAGMA ignore_check_constraints',
    expected: 0,
  }),
  objectFreeze({
    setSql: 'PRAGMA trusted_schema = OFF',
    readSql: 'PRAGMA trusted_schema',
    expected: 0,
  }),
])

function configureConnectionPolicy(db) {
  try {
    for (let index = 0; index < CONNECTION_POLICY.length; index += 1) {
      const setting = CONNECTION_POLICY[index]
      execDatabase(db, setting.setSql)
    }
    for (let index = 0; index < CONNECTION_POLICY.length; index += 1) {
      const setting = CONNECTION_POLICY[index]
      if (readPolicyValue(db, setting.readSql) !== setting.expected) {
        throw reflectConstruct(nativeError, [
          `Connection policy mismatch for ${setting.readSql}.`,
        ])
      }
    }
  } catch (error) {
    throw mutationFailure(
      'mutation_connection_policy',
      'The SQLite connection does not satisfy mutation policy.',
      error,
    )
  }
}

function readOwnDataValue(value, key) {
  if (
    value === null ||
    (typeof value !== 'object' && typeof value !== 'function') ||
    reflectApply(isProxy, undefined, [value])
  ) {
    return undefined
  }
  const descriptor = reflectApply(
    reflectGetOwnPropertyDescriptor,
    undefined,
    [value, key],
  )
  if (
    descriptor === undefined ||
    !reflectApply(objectHasOwnProperty, descriptor, ['value'])
  ) {
    return undefined
  }
  return descriptor.value
}

function isNativeBusyOrLocked(error) {
  let candidate = error
  for (let depth = 0; depth < 3; depth += 1) {
    if (readOwnDataValue(candidate, 'code') === 'ERR_SQLITE_ERROR') {
      const errcode = readOwnDataValue(candidate, 'errcode')
      if (
        typeof errcode === 'number' &&
        reflectApply(numberIsSafeInteger, undefined, [errcode]) &&
        errcode >= 0
      ) {
        const primaryCode = errcode % 0x100
        if (primaryCode === 5 || primaryCode === 6) return true
      }
    }
    candidate = readOwnDataValue(candidate, 'cause')
    if (candidate === undefined) break
  }
  return false
}

function inspectLiveTransaction(db) {
  let open
  try {
    open = reflectApply(databaseIsOpen, db, [])
  } catch (error) {
    return { kind: 'unreadable', error }
  }
  if (open !== true) return { kind: 'closed' }
  try {
    const transaction = reflectApply(databaseIsTransaction, db, [])
    if (transaction === true) return { kind: 'active' }
    if (transaction === false) return { kind: 'inactive' }
    return {
      kind: 'unreadable',
      error: reflectConstruct(nativeError, [
        'Transaction state was not a boolean.',
      ]),
    }
  } catch (error) {
    return { kind: 'unreadable', error }
  }
}

function aggregateTwo(first, second) {
  let index = 0
  const iterator = {
    next() {
      if (index === 0) {
        index = 1
        return { value: first, done: false }
      }
      if (index === 1) {
        index = 2
        return { value: second, done: false }
      }
      return { value: undefined, done: true }
    },
  }
  const iterable = {
    [symbolIterator]() {
      return iterator
    },
  }
  return reflectConstruct(nativeAggregateError, [iterable])
}

function retireLease(owner) {
  const leaseState = owner.currentLeaseState
  if (leaseState !== null) leaseState.active = false
  owner.currentLeaseState = null
}

function endRun(owner) {
  retireLease(owner)
  owner.running = false
}

function poisonOwner(owner, failure) {
  owner.poisoned = true
  owner.poisonCause = failure
}

function requiredRollback(owner, primaryFailure) {
  let cleanupFailure
  let cleanupFailed = false
  try {
    execDatabase(owner.db, 'ROLLBACK')
  } catch (error) {
    cleanupFailure = error
    cleanupFailed = true
  }
  if (!cleanupFailed) {
    try {
      if (reflectApply(databaseIsTransaction, owner.db, []) !== false) {
        cleanupFailure = reflectConstruct(nativeError, [
          'Rollback did not end the transaction.',
        ])
        cleanupFailed = true
      }
    } catch (error) {
      cleanupFailure = error
      cleanupFailed = true
    }
  }
  if (cleanupFailed) {
    const aggregate = aggregateTwo(primaryFailure, cleanupFailure)
    const failure = mutationFailure(
      'mutation_cleanup_failed',
      'The mutation transaction could not be cleaned up.',
      aggregate,
    )
    poisonOwner(owner, failure)
    endRun(owner)
    throw failure
  }
  endRun(owner)
}

function ownershipFailure(message, cause) {
  return mutationFailure(
    'mutation_transaction_ownership_lost',
    message,
    cause,
  )
}

function failCallbackOutcome(owner, primaryFailure) {
  const state = inspectLiveTransaction(owner.db)
  if (state.kind === 'active') {
    requiredRollback(owner, primaryFailure)
    throw primaryFailure
  }
  const failure = ownershipFailure(
    'The coordinator-owned transaction was lost during mutation apply.',
    state.error === undefined ? primaryFailure : state.error,
  )
  poisonOwner(owner, failure)
  endRun(owner)
  throw failure
}

function failRecordedOwnership(owner) {
  if (owner.recordedOwnershipFailure === null) return
  const failure = owner.recordedOwnershipFailure
  const state = inspectLiveTransaction(owner.db)
  if (state.kind === 'active') requiredRollback(owner, failure)
  else endRun(owner)
  throw failure
}

function isThenable(value) {
  if (
    value === null ||
    (typeof value !== 'object' && typeof value !== 'function')
  ) {
    return false
  }
  return typeof reflectApply(reflectGet, undefined, [value, 'then']) === 'function'
}

export function assertActiveMutationLease(lease, db) {
  const leaseState = reflectApply(weakMapGet, leaseStates, [lease])
  if (leaseState === undefined) {
    throw mutationFailure(
      'mutation_invalid_argument',
      'A coordinator-issued mutation lease is required.',
    )
  }
  if (
    leaseState.active !== true ||
    leaseState.owner.currentLeaseState !== leaseState
  ) {
    throw mutationFailure(
      'mutation_transaction_ownership_lost',
      'The mutation lease is no longer active.',
    )
  }
  if (db !== leaseState.owner.db) {
    const failure = mutationFailure(
      'mutation_transaction_ownership_lost',
      'The mutation lease is bound to a different connection.',
    )
    leaseState.active = false
    poisonOwner(leaseState.owner, failure)
    leaseState.owner.recordedOwnershipFailure = failure
    throw failure
  }
  let open
  let transaction
  try {
    open = reflectApply(databaseIsOpen, db, [])
    transaction = open === true
      ? reflectApply(databaseIsTransaction, db, [])
      : false
  } catch (error) {
    const failure = mutationFailure(
      'mutation_transaction_ownership_lost',
      'Mutation transaction state is unreadable.',
      error,
    )
    leaseState.active = false
    poisonOwner(leaseState.owner, failure)
    leaseState.owner.recordedOwnershipFailure = failure
    throw failure
  }
  if (open !== true || transaction !== true) {
    const failure = mutationFailure(
      'mutation_transaction_ownership_lost',
      'The coordinator-owned transaction is no longer active.',
    )
    leaseState.active = false
    poisonOwner(leaseState.owner, failure)
    leaseState.owner.recordedOwnershipFailure = failure
    throw failure
  }
}

export function createMutationCoordinator(db) {
  assertOpenDatabaseSync(db)
  const owner = {
    db,
    currentLeaseState: null,
    poisonCause: null,
    poisoned: false,
    recordedOwnershipFailure: null,
    running: false,
  }
  const run = function run(callback) {
    if (owner.poisoned === true) {
      throw mutationFailure(
        'mutation_poisoned',
        'The mutation coordinator is poisoned and must be discarded.',
        owner.poisonCause,
      )
    }
    if (typeof callback !== 'function') {
      throw mutationFailure(
        'mutation_invalid_argument',
        'Mutation apply must be a synchronous function.',
      )
    }

    let open
    try {
      open = reflectApply(databaseIsOpen, db, [])
    } catch (error) {
      throw mutationFailure(
        'mutation_connection_invalid',
        'Mutation connection state is unreadable.',
        error,
      )
    }
    if (open !== true) {
      throw mutationFailure(
        'mutation_connection_invalid',
        'The DatabaseSync connection must be open.',
      )
    }
    if (owner.running === true) {
      throw mutationFailure(
        'mutation_transaction_active',
        'The mutation coordinator is already running.',
      )
    }
    let transaction
    try {
      transaction = reflectApply(databaseIsTransaction, db, [])
    } catch (error) {
      throw mutationFailure(
        'mutation_connection_invalid',
        'Mutation transaction state is unreadable.',
        error,
      )
    }
    if (transaction === true) {
      throw mutationFailure(
        'mutation_transaction_active',
        'The DatabaseSync connection already has an active transaction.',
      )
    }
    if (transaction !== false) {
      throw mutationFailure(
        'mutation_connection_invalid',
        'Mutation transaction state must be a boolean.',
      )
    }

    owner.running = true
    owner.recordedOwnershipFailure = null
    try {
      configureConnectionPolicy(db)
    } catch (error) {
      owner.running = false
      throw error
    }

    try {
      execDatabase(db, 'BEGIN IMMEDIATE')
    } catch (error) {
      const state = inspectLiveTransaction(db)
      if (state.kind === 'unreadable' || state.kind === 'closed') {
        const failure = mutationFailure(
          'mutation_begin_failed',
          'BEGIN IMMEDIATE failed with an unreadable transaction outcome.',
        state.error === undefined ? error : aggregateTwo(error, state.error),
        )
        poisonOwner(owner, failure)
        owner.running = false
        throw failure
      }
      const busyOrLocked = isNativeBusyOrLocked(error)
      const failure = mutationFailure(
        busyOrLocked
          ? 'mutation_busy'
          : 'mutation_begin_failed',
        busyOrLocked
          ? 'The mutation database is busy or locked.'
          : 'BEGIN IMMEDIATE failed.',
        error,
      )
      if (state.kind === 'active') requiredRollback(owner, failure)
      else owner.running = false
      throw failure
    }

    const begunState = inspectLiveTransaction(db)
    if (begunState.kind !== 'active') {
      const failure = mutationFailure(
        'mutation_begin_failed',
        'BEGIN IMMEDIATE returned without an active transaction.',
        begunState.error,
      )
      poisonOwner(owner, failure)
      owner.running = false
      throw failure
    }

    const lease = reflectApply(objectFreeze, undefined, [{}])
    const leaseState = { active: true, lease, owner }
    reflectApply(weakMapSet, leaseStates, [lease, leaseState])
    owner.currentLeaseState = leaseState

    let callbackResult
    let callbackFailure
    let callbackThrew = false
    try {
      callbackResult = reflectApply(callback, undefined, [lease])
    } catch (error) {
      callbackFailure = error
      callbackThrew = true
    }

    failRecordedOwnership(owner)

    if (callbackThrew) failCallbackOutcome(owner, callbackFailure)

    let asyncResult
    let thenabilityFailure
    let thenabilityThrew = false
    try {
      asyncResult = isThenable(callbackResult)
    } catch (error) {
      thenabilityFailure = error
      thenabilityThrew = true
    }
    failRecordedOwnership(owner)
    if (thenabilityThrew) failCallbackOutcome(owner, thenabilityFailure)
    if (asyncResult) {
      failCallbackOutcome(owner, mutationFailure(
        'mutation_async_apply',
        'Mutation apply must not return a Promise or thenable.',
      ))
    }

    const beforeCommit = inspectLiveTransaction(db)
    if (beforeCommit.kind !== 'active') {
      const failure = ownershipFailure(
        'The coordinator-owned transaction was lost before commit.',
        beforeCommit.error,
      )
      poisonOwner(owner, failure)
      endRun(owner)
      throw failure
    }

    try {
      execDatabase(db, 'COMMIT')
    } catch (error) {
      const state = inspectLiveTransaction(db)
      if (state.kind === 'active') {
        const failure = mutationFailure(
          'mutation_commit_failed',
          'The mutation transaction could not commit.',
          error,
        )
        requiredRollback(owner, failure)
        throw failure
      }
      const failure = mutationFailure(
        'mutation_commit_outcome_unknown',
        'The mutation commit outcome is unknown.',
        state.error === undefined ? error : aggregateTwo(error, state.error),
      )
      poisonOwner(owner, failure)
      endRun(owner)
      throw failure
    }

    const afterCommit = inspectLiveTransaction(db)
    if (afterCommit.kind !== 'inactive') {
      const failure = mutationFailure(
        'mutation_commit_outcome_unknown',
        'COMMIT returned without a reliably inactive transaction.',
        afterCommit.error,
      )
      poisonOwner(owner, failure)
      endRun(owner)
      throw failure
    }

    endRun(owner)
    return callbackResult
  }
  return reflectApply(objectFreeze, undefined, [{ run }])
}

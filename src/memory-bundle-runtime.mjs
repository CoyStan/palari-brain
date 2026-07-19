import { createHash, randomUUID } from 'node:crypto'
import { isAbsolute } from 'node:path'
import { DatabaseSync, StatementSync } from 'node:sqlite'
import { pathToFileURL } from 'node:url'
import { types as utilTypes } from 'node:util'

import {
  MemoryBundleError,
  memoryBundleFailure,
  preserveMemoryBundleError,
} from './memory-bundle-errors.mjs'

const reflectApply = Reflect.apply
const reflectConstruct = Reflect.construct
const reflectGetPrototypeOf = Reflect.getPrototypeOf
const reflectOwnKeys = Reflect.ownKeys
const reflectGetOwnPropertyDescriptor = Reflect.getOwnPropertyDescriptor

const arrayIsArray = Array.isArray
const objectPrototype = Object.prototype
const arrayPrototype = Array.prototype
const nativeDate = Date
const dateToISOString = Date.prototype.toISOString
const isProxy = utilTypes.isProxy
const pathIsAbsolute = isAbsolute
const pathToFileUrl = pathToFileURL
const cryptoRandomUuid = randomUUID
const cryptoCreateHash = createHash

const databaseExec = DatabaseSync.prototype.exec
const databasePrepare = DatabaseSync.prototype.prepare
const databaseClose = DatabaseSync.prototype.close
const statementGetNative = StatementSync.prototype.get
const statementAllNative = StatementSync.prototype.all
const statementRunNative = StatementSync.prototype.run
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

export function isProxyValue(value) {
  return reflectApply(isProxy, undefined, [value])
}

export function assertOpenDatabaseSync(value) {
  if (isProxyValue(value)) {
    throw memoryBundleFailure(
      'bundle_invalid_argument',
      'A native DatabaseSync connection is required.',
    )
  }

  let isOpen
  try {
    isOpen = reflectApply(databaseIsOpen, value, [])
  } catch (error) {
    throw memoryBundleFailure(
      'bundle_invalid_argument',
      'A native DatabaseSync connection is required.',
      error,
    )
  }

  if (isOpen !== true) {
    throw memoryBundleFailure(
      'bundle_connection_invalid',
      'The DatabaseSync connection must be open.',
    )
  }
}

export function readDatabaseTransactionState(db) {
  return reflectApply(databaseIsTransaction, db, [])
}

export function constructDatabase(args) {
  return reflectConstruct(DatabaseSync, args)
}

export function execDatabase(db, sql) {
  return reflectApply(databaseExec, db, [sql])
}

export function prepareRowStatement(db, sql) {
  const statement = reflectApply(databasePrepare, db, [sql])
  reflectApply(statementSetReadBigInts, statement, [false])
  reflectApply(statementSetReturnArrays, statement, [false])
  return statement
}

export function statementGet(statement, parameters) {
  return reflectApply(statementGetNative, statement, parameters)
}

export function statementAll(statement, parameters) {
  return reflectApply(statementAllNative, statement, parameters)
}

export function statementRun(statement, parameters) {
  return reflectApply(statementRunNative, statement, parameters)
}

export function closeDatabase(db) {
  return reflectApply(databaseClose, db, [])
}

export function captureExactRecord(value, specification) {
  const { keys, code, message } = specification

  try {
    if (
      isProxyValue(value) ||
      value === null ||
      typeof value !== 'object' ||
      reflectApply(arrayIsArray, Array, [value]) ||
      reflectGetPrototypeOf(value) !== objectPrototype
    ) {
      throw memoryBundleFailure(code, message)
    }

    const ownKeys = reflectOwnKeys(value)
    if (ownKeys.length !== keys.length) {
      throw memoryBundleFailure(code, message)
    }

    const captured = {}
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index]
      let found = false
      for (let ownIndex = 0; ownIndex < ownKeys.length; ownIndex += 1) {
        if (ownKeys[ownIndex] === key) {
          found = true
          break
        }
      }
      if (!found) throw memoryBundleFailure(code, message)

      const descriptor = reflectGetOwnPropertyDescriptor(value, key)
      if (
        descriptor === undefined ||
        descriptor.enumerable !== true ||
        !('value' in descriptor)
      ) {
        throw memoryBundleFailure(code, message)
      }
      captured[key] = descriptor.value
    }
    return captured
  } catch (error) {
    if (error instanceof MemoryBundleError) throw error
    throw preserveMemoryBundleError(error, code, message)
  }
}

export function isCapturedOrdinaryArray(value) {
  return (
    !isProxyValue(value) &&
    reflectApply(arrayIsArray, Array, [value]) &&
    reflectGetPrototypeOf(value) === arrayPrototype
  )
}

export function constructNativeDate(args) {
  return reflectConstruct(nativeDate, args)
}

export function nativeDateToISOString(value) {
  return reflectApply(dateToISOString, value, [])
}

export function isAbsolutePath(value) {
  return reflectApply(pathIsAbsolute, undefined, [value])
}

export function convertPathToFileUrl(value) {
  return reflectApply(pathToFileUrl, undefined, [value])
}

export function generateRandomUuid() {
  return reflectApply(cryptoRandomUuid, undefined, [])
}

export function createNativeHash(algorithm) {
  return reflectApply(cryptoCreateHash, undefined, [algorithm])
}

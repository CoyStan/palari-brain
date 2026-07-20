import { createHash, randomUUID } from 'node:crypto'
import { isAbsolute } from 'node:path'
import { DatabaseSync, StatementSync } from 'node:sqlite'
import { pathToFileURL, URL, URLSearchParams } from 'node:url'
import { types as utilTypes } from 'node:util'

import {
  memoryBundleFailure,
  preserveMemoryBundleError,
} from './memory-bundle-errors.mjs'

const reflectApply = Reflect.apply
const reflectConstruct = Reflect.construct
const reflectDefineProperty = Reflect.defineProperty
const reflectGetPrototypeOf = Reflect.getPrototypeOf
const reflectOwnKeys = Reflect.ownKeys
const reflectGetOwnPropertyDescriptor = Reflect.getOwnPropertyDescriptor

const arrayIsArray = Array.isArray
const numberIsSafeInteger = Number.isSafeInteger
const objectPrototype = Object.prototype
const objectHasOwnProperty = Object.prototype.hasOwnProperty
const arrayPrototype = Array.prototype
const stringCharCodeAt = String.prototype.charCodeAt
const nativeDate = Date
const dateToISOString = Date.prototype.toISOString
const isProxy = utilTypes.isProxy
const pathIsAbsolute = isAbsolute
const pathToFileUrl = pathToFileURL
const urlSearchParams = reflectGetOwnPropertyDescriptor(
  URL.prototype,
  'searchParams',
).get
const urlHref = reflectGetOwnPropertyDescriptor(URL.prototype, 'href').get
const urlSearchParamsSet = URLSearchParams.prototype.set
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

export function captureDatabaseOpenState(value) {
  if (isProxyValue(value)) {
    throw memoryBundleFailure(
      'bundle_invalid_argument',
      'A native DatabaseSync connection is required.',
    )
  }

  try {
    return reflectApply(databaseIsOpen, value, [])
  } catch (error) {
    throw memoryBundleFailure(
      'bundle_invalid_argument',
      'A native DatabaseSync connection is required.',
      error,
    )
  }
}

export function assertOpenDatabaseSync(value) {
  if (captureDatabaseOpenState(value) !== true) {
    throw memoryBundleFailure(
      'bundle_connection_invalid',
      'The DatabaseSync connection must be open.',
    )
  }
}

export function readDatabaseTransactionState(db) {
  return reflectApply(databaseIsTransaction, db, [])
}

export function invokeFunction(callback) {
  return reflectApply(callback, undefined, [])
}

export function hasAsciiCaseInsensitivePrefix(value, lowercaseAsciiPrefix) {
  if (
    typeof value !== 'string' ||
    value.length < lowercaseAsciiPrefix.length
  ) {
    return false
  }
  for (let index = 0; index < lowercaseAsciiPrefix.length; index += 1) {
    let unit = reflectApply(stringCharCodeAt, value, [index])
    if (unit >= 0x41 && unit <= 0x5a) unit += 0x20
    if (
      unit !== reflectApply(stringCharCodeAt, lowercaseAsciiPrefix, [index])
    ) {
      return false
    }
  }
  return true
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

function readOwnDataValue(value, key) {
  if (
    isProxyValue(value) ||
    value === null ||
    (typeof value !== 'object' && typeof value !== 'function')
  ) {
    return undefined
  }
  const descriptor = reflectGetOwnPropertyDescriptor(value, key)
  if (
    descriptor === undefined ||
    !reflectApply(objectHasOwnProperty, descriptor, ['value'])
  ) {
    return undefined
  }
  return descriptor.value
}

export function isNativeSqliteBusyOrLocked(error) {
  let candidate = error
  for (let depth = 0; depth < 3; depth += 1) {
    if (
      readOwnDataValue(candidate, 'code') === 'ERR_SQLITE_ERROR'
    ) {
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
    if (candidate === undefined) return false
  }
  return false
}

export function captureExactRecord(value, specification) {
  const { keys, code, message } = specification

  try {
    if (
      isProxyValue(value) ||
      value === null ||
      typeof value !== 'object' ||
      reflectApply(arrayIsArray, undefined, [value]) ||
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
        !reflectApply(objectHasOwnProperty, descriptor, ['value'])
      ) {
        throw memoryBundleFailure(code, message)
      }
      reflectApply(reflectDefineProperty, undefined, [
        captured,
        key,
        {
          __proto__: null,
          value: descriptor.value,
          enumerable: true,
          configurable: true,
          writable: true,
        },
      ])
    }
    return captured
  } catch (error) {
    throw preserveMemoryBundleError(error, code, message)
  }
}

export function isCapturedOrdinaryArray(value) {
  return (
    !isProxyValue(value) &&
    reflectApply(arrayIsArray, undefined, [value]) &&
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

export function convertPathToReadWriteFileHref(value) {
  const url = reflectApply(pathToFileUrl, undefined, [value])
  const parameters = reflectApply(urlSearchParams, url, [])
  reflectApply(urlSearchParamsSet, parameters, ['mode', 'rw'])
  return reflectApply(urlHref, url, [])
}

export function generateRandomUuid() {
  return reflectApply(cryptoRandomUuid, undefined, [])
}

export function createNativeHash(algorithm) {
  return reflectApply(cryptoCreateHash, undefined, [algorithm])
}

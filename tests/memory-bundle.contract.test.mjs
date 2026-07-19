import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'

import * as applyModule from '../src/memory-bundle-apply.mjs'
import * as publicModule from '../src/memory-bundle.mjs'
import { BUNDLE_ERROR_CODES } from '../src/memory-bundle-errors.mjs'
import {
  captureExactRecord,
  isCapturedOrdinaryArray,
} from '../src/memory-bundle-runtime.mjs'

function assertBundleCode(callback, expectedCode) {
  assert.throws(callback, (error) => {
    assert.equal(error?.code, expectedCode)
    return true
  })
}

function assertExactBundleError(error, expectedCode, expectedMessage) {
  assert.equal(Object.getPrototypeOf(error), applyModule.MemoryBundleError.prototype)
  assert.equal(error.name, 'MemoryBundleError')
  assert.equal(error.code, expectedCode)
  assert.equal(error.message, expectedMessage)
  assert.equal(Object.getOwnPropertyDescriptor(error, 'cause'), undefined)
  assert.deepEqual(Object.keys(error), ['code'])
}

const EXPECTED_CODES = [
  'bundle_invalid_argument',
  'bundle_busy',
  'bundle_layout_invalid',
  'bundle_schema_unsupported',
  'bundle_connection_invalid',
  'bundle_not_in_transaction',
  'bundle_invalid_decision',
  'bundle_duplicate_decision_id',
  'bundle_duplicate_proposal_id',
  'bundle_invalid_atom',
  'bundle_invalid_transition',
  'bundle_head_conflict',
  'bundle_meta_mismatch',
  'bundle_missing_atom',
  'bundle_orphan_atom',
  'bundle_id_reuse',
  'bundle_unauthorized',
  'bundle_storage_error',
  'bundle_closed',
]

test('M1-01 exact module namespaces and 19-code error vocabulary', () => {
  assert.deepEqual(Object.keys(applyModule).sort(), [
    'MemoryBundleError',
    'applyResolvedDecisionInTransaction',
    'initializeMemoryBundle',
  ])
  assert.deepEqual(Object.keys(publicModule), ['openMemoryBundle'])
  assert.deepEqual(BUNDLE_ERROR_CODES, EXPECTED_CODES)
  assert.ok(Object.isFrozen(BUNDLE_ERROR_CODES))

  const cause = new Error('native failure')
  const error = new applyModule.MemoryBundleError(
    'bundle_storage_error',
    'storage failed',
    { cause },
  )
  assert.equal(error.name, 'MemoryBundleError')
  assert.equal(error.code, 'bundle_storage_error')
  assert.equal(error.cause, cause)
  assert.deepEqual(Object.keys(error), ['code'])
})

test('M1-02 database branding rejects spoofs and Proxies without traps', () => {
  const open = new DatabaseSync(':memory:')
  let proxyTrapCount = 0
  const proxy = new Proxy(open, {
    get() {
      proxyTrapCount += 1
      throw new Error('trap ran')
    },
    getPrototypeOf() {
      proxyTrapCount += 1
      throw new Error('trap ran')
    },
  })
  const spoof = Object.create(Object.getPrototypeOf(open))

  assertBundleCode(
    () => applyModule.initializeMemoryBundle(proxy),
    'bundle_invalid_argument',
  )
  assert.equal(proxyTrapCount, 0)
  assertBundleCode(
    () => applyModule.initializeMemoryBundle(spoof),
    'bundle_invalid_argument',
  )
  assertBundleCode(
    () => applyModule.initializeMemoryBundle(open),
    'bundle_layout_invalid',
  )

  open.exec('BEGIN')
  assertBundleCode(
    () => applyModule.initializeMemoryBundle(open),
    'bundle_connection_invalid',
  )
  open.exec('ROLLBACK')
  open.close()

  const closed = new DatabaseSync(':memory:')
  closed.close()
  assertBundleCode(
    () => applyModule.initializeMemoryBundle(closed),
    'bundle_connection_invalid',
  )
})

test('M1-02 captured array checks ignore later global Array poisoning', () => {
  const originalArrayDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'Array',
  )
  let trapCount = 0

  try {
    Object.defineProperty(globalThis, 'Array', {
      configurable: true,
      get() {
        trapCount += 1
        throw new Error('global Array trap ran')
      },
    })

    assert.deepEqual(
      captureExactRecord(
        { value: 'captured' },
        {
          keys: ['value'],
          code: 'bundle_invalid_argument',
          message: 'Exact record required.',
        },
      ),
      { value: 'captured' },
    )
    assert.equal(isCapturedOrdinaryArray([]), true)
    assert.equal(isCapturedOrdinaryArray({}), false)
    assert.equal(trapCount, 0)
  } finally {
    Object.defineProperty(globalThis, 'Array', originalArrayDescriptor)
  }

  assert.deepEqual(
    Object.getOwnPropertyDescriptor(globalThis, 'Array'),
    originalArrayDescriptor,
  )
})

test('M1-02 exact record capture ignores later error hasInstance poisoning', () => {
  const errorConstructor = applyModule.MemoryBundleError
  const errorPrototype = errorConstructor.prototype
  const getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor
  const defineProperty = Object.defineProperty
  const deleteProperty = Reflect.deleteProperty
  const originalDescriptor = getOwnPropertyDescriptor(
    errorConstructor,
    Symbol.hasInstance,
  )
  let poisonCallCount = 0
  let caught

  try {
    defineProperty(errorConstructor, Symbol.hasInstance, {
      value() {
        poisonCallCount += 1
        throw new Error('MemoryBundleError hasInstance poison ran')
      },
      enumerable: false,
      configurable: true,
      writable: true,
    })

    try {
      captureExactRecord(null, {
        keys: ['value'],
        code: 'bundle_invalid_argument',
        message: 'Exact record required.',
      })
    } catch (error) {
      caught = error
    }

    assert.equal(poisonCallCount, 0)
    assert.equal(Object.getPrototypeOf(caught), errorPrototype)
    assert.equal(caught.name, 'MemoryBundleError')
    assert.equal(caught.code, 'bundle_invalid_argument')
    assert.equal(caught.message, 'Exact record required.')
    assert.equal(caught.cause, undefined)
    assert.deepEqual(Object.keys(caught), ['code'])
  } finally {
    if (originalDescriptor === undefined) {
      deleteProperty(errorConstructor, Symbol.hasInstance)
    } else {
      defineProperty(
        errorConstructor,
        Symbol.hasInstance,
        originalDescriptor,
      )
    }
  }

  assert.deepEqual(
    getOwnPropertyDescriptor(errorConstructor, Symbol.hasInstance),
    originalDescriptor,
  )
  assert.equal(caught instanceof errorConstructor, true)
})

test('M1-02 exact record capture rejects accessors despite inherited value poisoning', () => {
  const key = '__palariMemoryBundleM102AccessorKey__'
  const getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor
  const defineProperty = Object.defineProperty
  const deleteProperty = Reflect.deleteProperty
  const originalDescriptor = getOwnPropertyDescriptor(Object.prototype, 'value')
  const input = {}
  let inputAccessorCalls = 0
  let poisonCalls = 0
  let caught

  defineProperty(input, key, {
    get() {
      inputAccessorCalls += 1
      throw new Error('input accessor ran')
    },
    enumerable: true,
    configurable: true,
  })

  try {
    defineProperty(Object.prototype, 'value', {
      get() {
        poisonCalls += 1
        throw new Error('Object.prototype.value poison ran')
      },
      enumerable: false,
      configurable: true,
    })

    try {
      captureExactRecord(input, {
        keys: [key],
        code: 'bundle_invalid_atom',
        message: 'Exact atom record required.',
      })
    } catch (error) {
      caught = error
    }
  } finally {
    if (originalDescriptor === undefined) {
      deleteProperty(Object.prototype, 'value')
    } else {
      defineProperty(Object.prototype, 'value', originalDescriptor)
    }
  }

  assert.deepEqual(
    getOwnPropertyDescriptor(Object.prototype, 'value'),
    originalDescriptor,
  )
  assert.equal(inputAccessorCalls, 0)
  assert.equal(poisonCalls, 0)
  assertExactBundleError(
    caught,
    'bundle_invalid_atom',
    'Exact atom record required.',
  )
})

test('M1-02 error classification ignores later Set has poisoning', () => {
  const getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor
  const defineProperty = Object.defineProperty
  const originalDescriptor = getOwnPropertyDescriptor(Set.prototype, 'has')
  let poisonCalls = 0
  let caught

  try {
    defineProperty(Set.prototype, 'has', {
      value() {
        poisonCalls += 1
        throw new Error('Set.prototype.has poison ran')
      },
      enumerable: false,
      configurable: true,
      writable: true,
    })

    try {
      applyModule.applyResolvedDecisionInTransaction()
    } catch (error) {
      caught = error
    }
  } finally {
    defineProperty(Set.prototype, 'has', originalDescriptor)
  }

  assert.deepEqual(
    getOwnPropertyDescriptor(Set.prototype, 'has'),
    originalDescriptor,
  )
  assert.equal(poisonCalls, 0)
  assertExactBundleError(
    caught,
    'bundle_invalid_argument',
    'A DatabaseSync connection is required.',
  )
})

test('M1-02 error classification ignores inherited cause poisoning', () => {
  const getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor
  const defineProperty = Object.defineProperty
  const deleteProperty = Reflect.deleteProperty
  const originalDescriptor = getOwnPropertyDescriptor(Object.prototype, 'cause')
  let poisonCalls = 0
  let caught

  try {
    defineProperty(Object.prototype, 'cause', {
      get() {
        poisonCalls += 1
        throw new Error('Object.prototype.cause poison ran')
      },
      enumerable: false,
      configurable: true,
    })

    try {
      applyModule.applyResolvedDecisionInTransaction()
    } catch (error) {
      caught = error
    }
  } finally {
    if (originalDescriptor === undefined) {
      deleteProperty(Object.prototype, 'cause')
    } else {
      defineProperty(Object.prototype, 'cause', originalDescriptor)
    }
  }

  assert.deepEqual(
    getOwnPropertyDescriptor(Object.prototype, 'cause'),
    originalDescriptor,
  )
  assert.equal(poisonCalls, 0)
  assertExactBundleError(
    caught,
    'bundle_invalid_argument',
    'A DatabaseSync connection is required.',
  )
})

test('M1-02 error construction ignores later defineProperty poisoning', () => {
  const getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor
  const defineProperty = Object.defineProperty
  const originalDescriptor = getOwnPropertyDescriptor(Object, 'defineProperty')
  let poisonCalls = 0
  let leakedTarget
  let caught

  try {
    defineProperty(Object, 'defineProperty', {
      value(target) {
        poisonCalls += 1
        leakedTarget = target
        throw new Error('Object.defineProperty poison ran')
      },
      enumerable: false,
      configurable: true,
      writable: true,
    })

    try {
      applyModule.applyResolvedDecisionInTransaction()
    } catch (error) {
      caught = error
    }
  } finally {
    defineProperty(Object, 'defineProperty', originalDescriptor)
  }

  assert.deepEqual(
    getOwnPropertyDescriptor(Object, 'defineProperty'),
    originalDescriptor,
  )
  assert.equal(poisonCalls, 0)
  assert.equal(leakedTarget, undefined)
  assertExactBundleError(
    caught,
    'bundle_invalid_argument',
    'A DatabaseSync connection is required.',
  )
})

test('M1-02 invalid error codes ignore later String and TypeError poisoning', () => {
  const getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor
  const defineProperty = Object.defineProperty
  const originalStringDescriptor = getOwnPropertyDescriptor(globalThis, 'String')
  const originalTypeErrorDescriptor = getOwnPropertyDescriptor(
    globalThis,
    'TypeError',
  )
  const nativeTypeError = globalThis.TypeError
  let stringPoisonCalls = 0
  let typeErrorPoisonCalls = 0
  let caught

  try {
    defineProperty(globalThis, 'String', {
      get() {
        stringPoisonCalls += 1
        throw new Error('global String poison ran')
      },
      enumerable: false,
      configurable: true,
    })
    defineProperty(globalThis, 'TypeError', {
      get() {
        typeErrorPoisonCalls += 1
        throw new Error('global TypeError poison ran')
      },
      enumerable: false,
      configurable: true,
    })

    try {
      new applyModule.MemoryBundleError('__invalid_bundle_code__', 'invalid')
    } catch (error) {
      caught = error
    }
  } finally {
    defineProperty(globalThis, 'String', originalStringDescriptor)
    defineProperty(globalThis, 'TypeError', originalTypeErrorDescriptor)
  }

  assert.deepEqual(
    getOwnPropertyDescriptor(globalThis, 'String'),
    originalStringDescriptor,
  )
  assert.deepEqual(
    getOwnPropertyDescriptor(globalThis, 'TypeError'),
    originalTypeErrorDescriptor,
  )
  assert.equal(stringPoisonCalls, 0)
  assert.equal(typeErrorPoisonCalls, 0)
  assert.equal(Object.getPrototypeOf(caught), nativeTypeError.prototype)
  assert.equal(caught.name, 'TypeError')
  assert.equal(
    caught.message,
    'Unknown memory bundle error code: __invalid_bundle_code__',
  )
  assert.deepEqual(Object.keys(caught), [])
})

test('M1-02 exact record capture bypasses inherited setters', () => {
  const key = '__palariMemoryBundleM102RequiredKey__'
  const originalDescriptor = Object.getOwnPropertyDescriptor(
    Object.prototype,
    key,
  )
  const input = {}
  Object.defineProperty(input, key, {
    value: 'captured',
    enumerable: true,
    configurable: true,
    writable: true,
  })
  let trapCount = 0

  try {
    Object.defineProperty(Object.prototype, key, {
      configurable: true,
      set() {
        trapCount += 1
        throw new Error('inherited setter trap ran')
      },
    })

    const captured = captureExactRecord(input, {
      keys: [key],
      code: 'bundle_invalid_argument',
      message: 'Exact record required.',
    })

    assert.equal(Object.getPrototypeOf(captured), Object.prototype)
    assert.deepEqual(Object.getOwnPropertyDescriptor(captured, key), {
      value: 'captured',
      enumerable: true,
      configurable: true,
      writable: true,
    })
    assert.equal(trapCount, 0)
  } finally {
    if (originalDescriptor === undefined) {
      Reflect.deleteProperty(Object.prototype, key)
    } else {
      Object.defineProperty(Object.prototype, key, originalDescriptor)
    }
  }

  assert.deepEqual(
    Object.getOwnPropertyDescriptor(Object.prototype, key),
    originalDescriptor,
  )
})

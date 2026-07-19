import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'

import * as applyModule from '../src/memory-bundle-apply.mjs'
import * as publicModule from '../src/memory-bundle.mjs'
import {
  BUNDLE_ERROR_CODES,
  preserveMemoryBundleError,
} from '../src/memory-bundle-errors.mjs'
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

test('M1-02 error construction ignores later exported constructor [[Prototype]] mutation', () => {
  const errorConstructor = applyModule.MemoryBundleError
  const getPrototypeOf = Object.getPrototypeOf
  const setPrototypeOf = Object.setPrototypeOf
  const originalPrototype = getPrototypeOf(errorConstructor)
  const cause = new Error('native failure')
  let poisonCallCount = 0
  let constructed
  let preserved
  let caught

  function MutatedSuperConstructor() {
    poisonCallCount += 1
    throw new Error('mutable exported constructor prototype poison ran')
  }

  try {
    setPrototypeOf(errorConstructor, MutatedSuperConstructor)
    try {
      constructed = new errorConstructor(
        'bundle_storage_error',
        'storage failed',
        { cause },
      )
      preserved = preserveMemoryBundleError(
        constructed,
        'bundle_invalid_argument',
        'must preserve private brand',
      )
    } catch (error) {
      caught = error
    }
  } finally {
    setPrototypeOf(errorConstructor, originalPrototype)
  }

  assert.equal(getPrototypeOf(errorConstructor), originalPrototype)
  assert.equal(poisonCallCount, 0)
  assert.equal(caught, undefined)
  assert.equal(getPrototypeOf(constructed), errorConstructor.prototype)
  assert.equal(constructed instanceof errorConstructor, true)
  assert.equal(constructed instanceof Error, true)
  assert.equal(preserved, constructed)
  assert.equal(constructed.message, 'storage failed')
  assert.deepEqual(Object.getOwnPropertyDescriptor(constructed, 'message'), {
    value: 'storage failed',
    enumerable: false,
    configurable: true,
    writable: true,
  })
  assert.equal(constructed.cause, cause)
  assert.deepEqual(Object.getOwnPropertyDescriptor(constructed, 'cause'), {
    value: cause,
    enumerable: false,
    configurable: true,
    writable: true,
  })
  assert.deepEqual(Object.getOwnPropertyDescriptor(constructed, 'name'), {
    value: 'MemoryBundleError',
    enumerable: false,
    configurable: true,
    writable: true,
  })
  assert.deepEqual(Object.getOwnPropertyDescriptor(constructed, 'code'), {
    value: 'bundle_storage_error',
    enumerable: true,
    configurable: false,
    writable: false,
  })
  assert.equal(typeof constructed.stack, 'string')
  assert.match(constructed.stack, /storage failed/)
  assert.deepEqual(Object.keys(constructed), ['code'])
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

test('M1-02 error construction ignores inherited descriptor accessor keys', () => {
  const getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor
  const defineProperties = Object.defineProperties
  const defineProperty = Object.defineProperty
  const deleteProperty = Reflect.deleteProperty
  const originalGetDescriptor = getOwnPropertyDescriptor(
    Object.prototype,
    'get',
  )
  const originalSetDescriptor = getOwnPropertyDescriptor(
    Object.prototype,
    'set',
  )
  let inheritedGetCallCount = 0
  let inheritedSetCallCount = 0
  let constructed
  let caught

  try {
    defineProperties(Object.prototype, {
      get: {
        get() {
          inheritedGetCallCount += 1
          throw new Error('inherited descriptor get poison ran')
        },
        configurable: true,
      },
      set: {
        get() {
          inheritedSetCallCount += 1
          throw new Error('inherited descriptor set poison ran')
        },
        configurable: true,
      },
    })

    try {
      constructed = new applyModule.MemoryBundleError(
        'bundle_invalid_argument',
        'Exact record required.',
      )
    } catch (error) {
      caught = error
    }
  } finally {
    deleteProperty(Object.prototype, 'get')
    deleteProperty(Object.prototype, 'set')
    if (originalGetDescriptor !== undefined) {
      defineProperty(Object.prototype, 'get', originalGetDescriptor)
    }
    if (originalSetDescriptor !== undefined) {
      defineProperty(Object.prototype, 'set', originalSetDescriptor)
    }
  }

  assert.deepEqual(
    getOwnPropertyDescriptor(Object.prototype, 'get'),
    originalGetDescriptor,
  )
  assert.deepEqual(
    getOwnPropertyDescriptor(Object.prototype, 'set'),
    originalSetDescriptor,
  )
  assert.equal(inheritedGetCallCount, 0)
  assert.equal(inheritedSetCallCount, 0)
  assert.equal(caught, undefined)
  assertExactBundleError(
    constructed,
    'bundle_invalid_argument',
    'Exact record required.',
  )
  assert.deepEqual(Object.getOwnPropertyDescriptor(constructed, 'name'), {
    value: 'MemoryBundleError',
    enumerable: false,
    configurable: true,
    writable: true,
  })
  assert.deepEqual(Object.getOwnPropertyDescriptor(constructed, 'code'), {
    value: 'bundle_invalid_argument',
    enumerable: true,
    configurable: false,
    writable: false,
  })
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

test('M1-02 invalid object and function error codes never invoke conversion hooks', () => {
  const getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor
  const defineProperty = Object.defineProperty
  const deleteProperty = Reflect.deleteProperty
  const originalDescriptor = getOwnPropertyDescriptor(
    Object.prototype,
    Symbol.toPrimitive,
  )
  const nativeTypeError = globalThis.TypeError
  const functionCode = function invalidBundleCode() {}
  let conversionCallCount = 0
  let objectCaught
  let functionCaught

  defineProperty(functionCode, Symbol.toPrimitive, {
    value() {
      conversionCallCount += 1
      throw new Error('own conversion poison ran')
    },
    enumerable: false,
    configurable: true,
    writable: true,
  })

  try {
    defineProperty(Object.prototype, Symbol.toPrimitive, {
      value() {
        conversionCallCount += 1
        throw new Error('Object.prototype conversion poison ran')
      },
      enumerable: false,
      configurable: true,
      writable: true,
    })

    try {
      new applyModule.MemoryBundleError({}, 'invalid')
    } catch (error) {
      objectCaught = error
    }
    try {
      new applyModule.MemoryBundleError(functionCode, 'invalid')
    } catch (error) {
      functionCaught = error
    }
  } finally {
    if (originalDescriptor === undefined) {
      deleteProperty(Object.prototype, Symbol.toPrimitive)
    } else {
      defineProperty(Object.prototype, Symbol.toPrimitive, originalDescriptor)
    }
  }

  assert.deepEqual(
    getOwnPropertyDescriptor(Object.prototype, Symbol.toPrimitive),
    originalDescriptor,
  )
  assert.equal(conversionCallCount, 0)
  for (const caught of [objectCaught, functionCaught]) {
    assert.equal(Object.getPrototypeOf(caught), nativeTypeError.prototype)
    assert.equal(caught.name, 'TypeError')
    assert.equal(
      caught.message,
      'Unknown memory bundle error code: <non-primitive>',
    )
    assert.deepEqual(Object.keys(caught), [])
  }
})

test('M1-02 error options ignore live and revoked Proxies without traps', () => {
  let descriptorTrapCallCount = 0
  const liveOptions = new Proxy(
    { cause: new Error('must not be observed') },
    {
      getOwnPropertyDescriptor() {
        descriptorTrapCallCount += 1
        throw new Error('options descriptor trap ran')
      },
    },
  )
  const revokedPair = Proxy.revocable(
    { cause: new Error('must not be observed') },
    {
      getOwnPropertyDescriptor() {
        descriptorTrapCallCount += 1
        throw new Error('revoked options descriptor trap ran')
      },
    },
  )
  revokedPair.revoke()

  let liveError
  let liveCaught
  let revokedError
  let revokedCaught
  try {
    liveError = new applyModule.MemoryBundleError(
      'bundle_storage_error',
      'storage failed',
      liveOptions,
    )
  } catch (error) {
    liveCaught = error
  }
  try {
    revokedError = new applyModule.MemoryBundleError(
      'bundle_storage_error',
      'storage failed',
      revokedPair.proxy,
    )
  } catch (error) {
    revokedCaught = error
  }

  assert.equal(descriptorTrapCallCount, 0)
  assert.equal(liveCaught, undefined)
  assert.equal(revokedCaught, undefined)
  assertExactBundleError(
    liveError,
    'bundle_storage_error',
    'storage failed',
  )
  assertExactBundleError(
    revokedError,
    'bundle_storage_error',
    'storage failed',
  )
})

test('M1-02 invalid messages fail before coercion and private branding', () => {
  const nativeTypeError = globalThis.TypeError
  let conversionCallCount = 0
  const coercionPoison = {
    [Symbol.toPrimitive]() {
      conversionCallCount += 1
      throw new Error('message Symbol.toPrimitive poison ran')
    },
    toString() {
      conversionCallCount += 1
      throw new Error('message toString poison ran')
    },
    valueOf() {
      conversionCallCount += 1
      throw new Error('message valueOf poison ran')
    },
  }
  const outcomes = []

  for (const message of [undefined, '', coercionPoison]) {
    let returned
    let caught
    try {
      returned = new applyModule.MemoryBundleError(
        'bundle_invalid_argument',
        message,
      )
    } catch (error) {
      caught = error
    }
    outcomes.push({ returned, caught })
  }

  assert.equal(conversionCallCount, 0)
  for (const { returned, caught } of outcomes) {
    assert.equal(returned, undefined)
    assert.equal(Object.getPrototypeOf(caught), nativeTypeError.prototype)
    assert.equal(caught.name, 'TypeError')
    assert.equal(
      caught.message,
      'Memory bundle error message must be a non-empty string.',
    )
    assert.deepEqual(Object.keys(caught), [])
  }

  const preserved = preserveMemoryBundleError(
    outcomes[0].caught,
    'bundle_storage_error',
    'wrapped native failure',
  )
  assert.notEqual(preserved, outcomes[0].caught)
  assert.equal(preserved.name, 'MemoryBundleError')
  assert.equal(preserved.code, 'bundle_storage_error')
  assert.equal(preserved.message, 'wrapped native failure')
  assert.equal(preserved.cause, outcomes[0].caught)
  assert.deepEqual(Object.keys(preserved), ['code'])
})

test('M1-02 exact record capture ignores inherited descriptor accessor keys', () => {
  const getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor
  const defineProperties = Object.defineProperties
  const defineProperty = Object.defineProperty
  const deleteProperty = Reflect.deleteProperty
  const originalGetDescriptor = getOwnPropertyDescriptor(
    Object.prototype,
    'get',
  )
  const originalSetDescriptor = getOwnPropertyDescriptor(
    Object.prototype,
    'set',
  )
  const input = { required: 'captured' }
  let inheritedGetCallCount = 0
  let inheritedSetCallCount = 0
  let captured
  let caught

  try {
    defineProperties(Object.prototype, {
      get: {
        get() {
          inheritedGetCallCount += 1
          throw new Error('inherited descriptor get poison ran')
        },
        configurable: true,
      },
      set: {
        get() {
          inheritedSetCallCount += 1
          throw new Error('inherited descriptor set poison ran')
        },
        configurable: true,
      },
    })

    try {
      captured = captureExactRecord(input, {
        keys: ['required'],
        code: 'bundle_invalid_argument',
        message: 'Exact record required.',
      })
    } catch (error) {
      caught = error
    }
  } finally {
    deleteProperty(Object.prototype, 'get')
    deleteProperty(Object.prototype, 'set')
    if (originalGetDescriptor !== undefined) {
      defineProperty(Object.prototype, 'get', originalGetDescriptor)
    }
    if (originalSetDescriptor !== undefined) {
      defineProperty(Object.prototype, 'set', originalSetDescriptor)
    }
  }

  assert.deepEqual(
    getOwnPropertyDescriptor(Object.prototype, 'get'),
    originalGetDescriptor,
  )
  assert.deepEqual(
    getOwnPropertyDescriptor(Object.prototype, 'set'),
    originalSetDescriptor,
  )
  assert.equal(inheritedGetCallCount, 0)
  assert.equal(inheritedSetCallCount, 0)
  assert.equal(caught, undefined)
  assert.notEqual(captured, input)
  assert.equal(Object.getPrototypeOf(captured), Object.prototype)
  assert.deepEqual(Object.keys(captured), ['required'])
  assert.deepEqual(Object.getOwnPropertyDescriptor(captured, 'required'), {
    value: 'captured',
    enumerable: true,
    configurable: true,
    writable: true,
  })
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

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { runInNewContext } from 'node:vm'

import * as applyModule from '../src/memory-bundle-apply.mjs'
import * as codecModule from '../src/memory-bundle-codec.mjs'
import * as publicModule from '../src/memory-bundle.mjs'
import { createKernelStore } from '../src/store.mjs'
import {
  BUNDLE_ERROR_CODES,
  preserveMemoryBundleError,
} from '../src/memory-bundle-errors.mjs'
import {
  captureExactRecord,
  isCapturedOrdinaryArray,
} from '../src/memory-bundle-runtime.mjs'
import {
  EXPECTED_AUTOINDEX_NAMES,
  EXPECTED_OBJECTS,
  M1_04_IDS,
  createM105Bundle,
  insertM105AtomRow,
  insertM105EventRow,
  makeM104ApplyEnvelope,
  makeM104AtomRow,
  makeM104CanonicalAtom,
  makeM104EventRow,
  seedM105ActiveMemory,
} from './helpers/memory-bundle-fixtures.mjs'

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
  assert.equal(applyModule.initializeMemoryBundle(open), undefined)

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
      applyModule.applyResolvedDecisionInTransaction(new Proxy({}, {}))
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
    'A native DatabaseSync connection is required.',
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
      applyModule.applyResolvedDecisionInTransaction(new Proxy({}, {}))
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
    'A native DatabaseSync connection is required.',
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
      applyModule.applyResolvedDecisionInTransaction(new Proxy({}, {}))
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
    'A native DatabaseSync connection is required.',
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

function cloneM104Record(value) {
  return Object.defineProperties({}, Object.getOwnPropertyDescriptors(value))
}

function makeM104TrapProxy(value, counter) {
  const trap = () => {
    counter.count += 1
    throw new Error('Proxy trap ran')
  }
  return new Proxy(value, {
    get: trap,
    getPrototypeOf: trap,
    has: trap,
    ownKeys: trap,
    getOwnPropertyDescriptor: trap,
  })
}

function makeM104RevokedProxy(value, counter) {
  const proxy = makeM104TrapProxy(value, counter)
  const revocable = Proxy.revocable(proxy, {})
  revocable.revoke()
  return revocable.proxy
}

function makeM104CaptureCases() {
  const input = makeM104ApplyEnvelope()
  const clock = () => new Date('2026-07-18T12:00:00.000Z')
  const idFactory = () => '00000000-0000-4000-8000-000000000001'
  return [
    {
      label: 'initializer options',
      code: 'bundle_invalid_argument',
      value: { clock, idFactory },
      invoke: (value) => codecModule.captureInitializerOptions(value),
      requiredKey: null,
    },
    {
      label: 'public-open options',
      code: 'bundle_invalid_argument',
      value: { dbPath: '/tmp/palari-memory-bundle.sqlite' },
      invoke: (value) => codecModule.captureOpenOptions(value),
      requiredKey: 'dbPath',
    },
    {
      label: 'top-level apply input',
      code: 'bundle_invalid_argument',
      value: input,
      invoke: (value) => codecModule.captureApplyEnvelope(value),
      requiredKey: 'expectedHead',
    },
    {
      label: 'expectedHead',
      code: 'bundle_invalid_argument',
      value: input.expectedHead,
      invoke: (value) => codecModule.captureApplyEnvelope({
        ...makeM104ApplyEnvelope(),
        expectedHead: value,
      }),
      requiredKey: 'streamId',
    },
    {
      label: 'decision',
      code: 'bundle_invalid_decision',
      value: input.decision,
      invoke: (value) => codecModule.captureDecision(value),
      requiredKey: 'decisionId',
    },
    {
      label: 'scope',
      code: 'bundle_invalid_decision',
      value: input.decision.scope,
      invoke: (value) => codecModule.captureScope(value),
      requiredKey: 'palariId',
    },
    {
      label: 'authority',
      code: 'bundle_invalid_decision',
      value: input.decision.authority,
      invoke: (value) => codecModule.captureAuthority(value),
      requiredKey: 'kind',
    },
    {
      label: 'atom',
      code: 'bundle_invalid_atom',
      value: input.atom,
      invoke: (value) => codecModule.captureAtom(value),
      requiredKey: 'content',
    },
  ]
}

const M1_04_CODEC_EXPORTS = [
  'captureApplyEnvelope',
  'captureAtom',
  'captureAuthority',
  'captureDecision',
  'captureInitializerOptions',
  'captureKeywords',
  'captureOpenOptions',
  'captureScope',
  'compareUnicodeScalarStrings',
  'computeMemoryBundleAtomChecksum',
  'decodeAtomRow',
  'decodeEventRow',
  'encodeAtomRow',
  'validateIdentity',
  'validateInputAtomScalars',
  'validateMemoryType',
  'validatePrefixedUuidV4',
  'validateResolvedAuthority',
  'validateResolvedDecisionWithoutAuthority',
  'validateTimestamp',
]

const M1_04_CHECKSUM_VECTOR = {
  memoryId: 'mem_00000000-0000-4000-8000-000000000004',
  streamId: 'str_00000000-0000-4000-8000-000000000001',
  createdSequence: 1,
  palariId: 'palari-a',
  userId: 'user-1',
  type: 'preference',
  content: 'Prefers tea.\nSays "no sugar".',
  keywords: ['no sugar', 'tea'],
  initialImportance: 0.75,
  confidence: 0.875,
  provenanceKind: 'direct_user_message',
  sourceMessageId: null,
  validFrom: '2026-07-18T11:59:00.000Z',
  createdAt: '2026-07-18T12:00:00.000Z',
  fictional: false,
}

const M1_04_CHECKSUM =
  '7b73a4dd7913043b54961fb0d97ac3a09ba433f744ce5162b0d9af6224b21ab8'

const m104ReflectApply = Reflect.apply
const m104ReflectDefineProperty = Reflect.defineProperty
const m104ReflectDeleteProperty = Reflect.deleteProperty
const m104ReflectGetOwnPropertyDescriptor = Reflect.getOwnPropertyDescriptor
const m104ReflectGetPrototypeOf = Reflect.getPrototypeOf
const m104ReflectOwnKeys = Reflect.ownKeys

function captureM104Outcome(callback) {
  try {
    return { value: callback(), error: undefined }
  } catch (error) {
    return { value: undefined, error }
  }
}

function restoreM104OwnDescriptor(target, key, descriptor) {
  if (descriptor === undefined) {
    m104ReflectApply(m104ReflectDeleteProperty, undefined, [target, key])
    return
  }
  m104ReflectApply(m104ReflectDefineProperty, undefined, [target, key, descriptor])
}

function findM104NativeHashHandlePrototype(hash) {
  const ownKeys = m104ReflectApply(m104ReflectOwnKeys, undefined, [hash])
  let handlePrototype = null
  for (let index = 0; index < ownKeys.length; index += 1) {
    const descriptor = m104ReflectApply(
      m104ReflectGetOwnPropertyDescriptor,
      undefined,
      [hash, ownKeys[index]],
    )
    const candidate = descriptor?.value
    if (candidate === null || typeof candidate !== 'object') continue
    const candidatePrototype = m104ReflectApply(
      m104ReflectGetPrototypeOf,
      undefined,
      [candidate],
    )
    if (candidatePrototype === null) continue
    const updateDescriptor = m104ReflectApply(
      m104ReflectGetOwnPropertyDescriptor,
      undefined,
      [candidatePrototype, 'update'],
    )
    const digestDescriptor = m104ReflectApply(
      m104ReflectGetOwnPropertyDescriptor,
      undefined,
      [candidatePrototype, 'digest'],
    )
    if (
      typeof updateDescriptor?.value !== 'function' ||
      typeof digestDescriptor?.value !== 'function'
    ) {
      continue
    }
    assert.equal(
      handlePrototype,
      null,
      'Node 22.22.2 exposed multiple SHA-256 native handle prototypes.',
    )
    handlePrototype = candidatePrototype
  }
  assert.notEqual(
    handlePrototype,
    null,
    'Node 22.22.2 SHA-256 native handle prototype was not found.',
  )
  return handlePrototype
}

test('M1-04 exposes only the required private codec functions', () => {
  assert.deepEqual(Object.keys(codecModule).sort(), M1_04_CODEC_EXPORTS)
})

test('M1-04 captures fresh exact-shape records and the nullable atom union', () => {
  for (const { label, value, invoke } of makeM104CaptureCases()) {
    const captured = invoke(value)
    assert.notEqual(captured, value, label)
    assert.equal(Object.getPrototypeOf(captured), Object.prototype, label)
  }

  const options = codecModule.captureInitializerOptions({})
  assert.deepEqual(options, {})
  assert.equal(Object.getPrototypeOf(options), Object.prototype)

  const envelope = codecModule.captureApplyEnvelope(makeM104ApplyEnvelope())
  assert.notEqual(envelope.expectedHead, makeM104ApplyEnvelope().expectedHead)
  assert.equal(Object.getPrototypeOf(envelope.expectedHead), Object.prototype)
  assert.deepEqual(Object.keys(envelope.expectedHead), ['streamId', 'sequence'])
  assert.equal(codecModule.captureAtom(null), null)
})

test('M1-04 rejects live and revoked Proxies at every record position without traps', () => {
  for (const { label, code, value, invoke } of makeM104CaptureCases()) {
    for (const revoked of [false, true]) {
      const counter = { count: 0 }
      const proxy = revoked
        ? makeM104RevokedProxy(value, counter)
        : makeM104TrapProxy(value, counter)
      assertBundleCode(() => invoke(proxy), code)
      assert.equal(counter.count, 0, `${label}, revoked=${revoked}`)
    }
  }
})

test('M1-04 rejects wrong record prototypes and container types', () => {
  for (const { label, code, value, invoke } of makeM104CaptureCases()) {
    const wrongPrototype = cloneM104Record(value)
    Object.setPrototypeOf(wrongPrototype, {})
    assertBundleCode(() => invoke(wrongPrototype), code)

    const nullPrototype = Object.defineProperties(
      Object.create(null),
      Object.getOwnPropertyDescriptors(value),
    )
    assertBundleCode(() => invoke(nullPrototype), code)

    const crossRealm = runInNewContext('({})')
    Object.defineProperties(crossRealm, Object.getOwnPropertyDescriptors(value))
    assertBundleCode(() => invoke(crossRealm), code)

    const array = Object.assign([], value)
    assertBundleCode(() => invoke(array), code)
    assert.ok(label.length > 0)
  }
})

test('M1-04 rejects missing, extra, symbol, accessor, and non-enumerable record keys', () => {
  for (const {
    label,
    code,
    value,
    invoke,
    requiredKey,
  } of makeM104CaptureCases()) {
    if (requiredKey !== null) {
      const missing = cloneM104Record(value)
      Reflect.deleteProperty(missing, requiredKey)
      assertBundleCode(() => invoke(missing), code)
    }

    const extra = cloneM104Record(value)
    extra.extra = true
    assertBundleCode(() => invoke(extra), code)

    const symbolic = cloneM104Record(value)
    symbolic[Symbol(label)] = true
    assertBundleCode(() => invoke(symbolic), code)

    const key = requiredKey ?? Reflect.ownKeys(value)[0]
    const accessor = cloneM104Record(value)
    let getterCalls = 0
    Object.defineProperty(accessor, key, {
      enumerable: true,
      configurable: true,
      get() {
        getterCalls += 1
        throw new Error('record getter ran')
      },
    })
    assertBundleCode(() => invoke(accessor), code)
    assert.equal(getterCalls, 0, label)

    const nonEnumerable = cloneM104Record(value)
    Object.defineProperty(nonEnumerable, key, {
      ...Object.getOwnPropertyDescriptor(nonEnumerable, key),
      enumerable: false,
    })
    assertBundleCode(() => invoke(nonEnumerable), code)
  }
})

test('M1-04 rejects inherited-only keys and validates initializer/open scalars without coercion', () => {
  const originalDbPath = Object.getOwnPropertyDescriptor(Object.prototype, 'dbPath')
  let inheritedReads = 0
  try {
    Object.defineProperty(Object.prototype, 'dbPath', {
      configurable: true,
      get() {
        inheritedReads += 1
        throw new Error('inherited dbPath getter ran')
      },
    })
    assertBundleCode(
      () => codecModule.captureOpenOptions({}),
      'bundle_invalid_argument',
    )
  } finally {
    if (originalDbPath === undefined) {
      Reflect.deleteProperty(Object.prototype, 'dbPath')
    } else {
      Object.defineProperty(Object.prototype, 'dbPath', originalDbPath)
    }
  }
  assert.equal(inheritedReads, 0)

  for (const options of [
    { clock: undefined },
    { idFactory: undefined },
    { clock: 'not-a-function' },
    { idFactory: 'not-a-function' },
  ]) {
    assertBundleCode(
      () => codecModule.captureInitializerOptions(options),
      'bundle_invalid_argument',
    )
  }

  const coercion = {
    calls: 0,
    toString() {
      this.calls += 1
      throw new Error('coercion ran')
    },
    valueOf() {
      this.calls += 1
      throw new Error('coercion ran')
    },
    [Symbol.toPrimitive]() {
      this.calls += 1
      throw new Error('coercion ran')
    },
  }
  for (const dbPath of [
    '',
    'relative.sqlite',
    ':memory:',
    'file:/tmp/bundle.sqlite',
    new URL('file:///tmp/bundle.sqlite'),
    Buffer.from('/tmp/bundle.sqlite'),
    coercion,
  ]) {
    assertBundleCode(
      () => codecModule.captureOpenOptions({ dbPath }),
      'bundle_invalid_argument',
    )
  }
  assert.equal(coercion.calls, 0)
  assertBundleCode(
    () => codecModule.captureOpenOptions({ dbPath: '/tmp/bundle .sqlite' }),
    'bundle_invalid_argument',
  )
})

test('M1-04 short-circuits malformed parents before inspecting later children', () => {
  const expectedHeadCounter = { count: 0 }
  const malformedTop = {
    expectedHead: makeM104TrapProxy({}, expectedHeadCounter),
    decision: makeM104ApplyEnvelope().decision,
  }
  assertBundleCode(
    () => codecModule.captureApplyEnvelope(malformedTop),
    'bundle_invalid_argument',
  )
  assert.equal(expectedHeadCounter.count, 0)

  const decisionCounter = { count: 0 }
  const malformedExpectedHead = { streamId: M1_04_IDS.streamId }
  assertBundleCode(
    () => codecModule.captureApplyEnvelope({
      ...makeM104ApplyEnvelope(),
      expectedHead: malformedExpectedHead,
      decision: makeM104TrapProxy({}, decisionCounter),
    }),
    'bundle_invalid_argument',
  )
  assert.equal(decisionCounter.count, 0)

  const scopeCounter = { count: 0 }
  const malformedDecision = {
    ...makeM104ApplyEnvelope().decision,
    scope: makeM104TrapProxy({}, scopeCounter),
  }
  Reflect.deleteProperty(malformedDecision, 'observedAt')
  assertBundleCode(
    () => codecModule.captureDecision(malformedDecision),
    'bundle_invalid_decision',
  )
  assert.equal(scopeCounter.count, 0)

  const keywordsCounter = { count: 0 }
  const wrongNullOnlyAtom = {
    ...makeM104ApplyEnvelope().atom,
    keywords: makeM104TrapProxy([], keywordsCounter),
    extra: true,
  }
  assertBundleCode(
    () => codecModule.captureAtom(wrongNullOnlyAtom),
    'bundle_invalid_atom',
  )
  assert.equal(keywordsCounter.count, 0)
})

test('M1-04 validates expectedHead scalars in order without coercion', () => {
  for (const streamId of [
    '',
    'mem_00000000-0000-4000-8000-000000000004',
    'str_00000000-0000-5000-8000-000000000001',
  ]) {
    assertBundleCode(
      () => codecModule.captureApplyEnvelope({
        ...makeM104ApplyEnvelope(),
        expectedHead: { streamId, sequence: 0 },
      }),
      'bundle_invalid_argument',
    )
  }
  for (const sequence of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1, NaN]) {
    assertBundleCode(
      () => codecModule.captureApplyEnvelope({
        ...makeM104ApplyEnvelope(),
        expectedHead: { streamId: M1_04_IDS.streamId, sequence },
      }),
      'bundle_invalid_argument',
    )
  }

  let coercionCalls = 0
  const coercion = {
    valueOf() {
      coercionCalls += 1
      throw new Error('expectedHead coercion ran')
    },
    toString() {
      coercionCalls += 1
      throw new Error('expectedHead coercion ran')
    },
  }
  const laterSequenceCounter = { count: 0 }
  const laterSequence = makeM104TrapProxy({}, laterSequenceCounter)
  assertBundleCode(
    () => codecModule.captureApplyEnvelope({
      ...makeM104ApplyEnvelope(),
      expectedHead: { streamId: coercion, sequence: laterSequence },
    }),
    'bundle_invalid_argument',
  )
  assert.equal(coercionCalls, 0)
  assert.equal(laterSequenceCounter.count, 0)
})

test('M1-04 captures only dense canonical keyword arrays without invoking getters or traps', () => {
  const source = ['no sugar', 'tea']
  const captured = codecModule.captureKeywords(source)
  assert.deepEqual(captured, source)
  assert.notEqual(captured, source)
  assert.equal(Object.getPrototypeOf(captured), Array.prototype)
  assert.deepEqual(Reflect.ownKeys(captured), ['0', '1', 'length'])

  for (const revoked of [false, true]) {
    const counter = { count: 0 }
    const proxy = revoked
      ? makeM104RevokedProxy(source, counter)
      : makeM104TrapProxy(source, counter)
    assertBundleCode(
      () => codecModule.captureKeywords(proxy),
      'bundle_invalid_atom',
    )
    assert.equal(counter.count, 0)
  }

  const crossRealm = runInNewContext('["no sugar", "tea"]')
  assertBundleCode(
    () => codecModule.captureKeywords(crossRealm),
    'bundle_invalid_atom',
  )
  const wrongPrototype = ['no sugar', 'tea']
  Object.setPrototypeOf(wrongPrototype, {})
  assertBundleCode(
    () => codecModule.captureKeywords(wrongPrototype),
    'bundle_invalid_atom',
  )
  assertBundleCode(
    () => codecModule.captureKeywords({ 0: 'tea', length: 1 }),
    'bundle_invalid_atom',
  )

  const hole = ['no sugar', , 'tea']
  assertBundleCode(() => codecModule.captureKeywords(hole), 'bundle_invalid_atom')

  const accessor = ['no sugar', 'tea']
  let getterCalls = 0
  Object.defineProperty(accessor, '1', {
    enumerable: true,
    configurable: true,
    get() {
      getterCalls += 1
      throw new Error('keyword getter ran')
    },
  })
  assertBundleCode(
    () => codecModule.captureKeywords(accessor),
    'bundle_invalid_atom',
  )
  assert.equal(getterCalls, 0)

  const nonEnumerableIndex = ['no sugar', 'tea']
  Object.defineProperty(nonEnumerableIndex, '1', {
    value: 'tea',
    enumerable: false,
    configurable: true,
    writable: true,
  })
  assertBundleCode(
    () => codecModule.captureKeywords(nonEnumerableIndex),
    'bundle_invalid_atom',
  )

  for (const key of ['extra', '01']) {
    const extra = ['no sugar', 'tea']
    extra[key] = true
    assertBundleCode(
      () => codecModule.captureKeywords(extra),
      'bundle_invalid_atom',
    )
  }
  const nonEnumerableExtra = ['no sugar', 'tea']
  Object.defineProperty(nonEnumerableExtra, 'extra', { value: true })
  assertBundleCode(
    () => codecModule.captureKeywords(nonEnumerableExtra),
    'bundle_invalid_atom',
  )
  const symbolic = ['no sugar', 'tea']
  symbolic[Symbol('extra')] = true
  assertBundleCode(
    () => codecModule.captureKeywords(symbolic),
    'bundle_invalid_atom',
  )
  const modifiedLength = ['no sugar', 'tea']
  Object.defineProperty(modifiedLength, 'length', { writable: false })
  assertBundleCode(
    () => codecModule.captureKeywords(modifiedLength),
    'bundle_invalid_atom',
  )
})

test('M1-04 enforces Unicode scalar keyword values, order, prefixes, and duplicates', () => {
  assert.equal(codecModule.compareUnicodeScalarStrings('', ''), 0)
  assert.equal(codecModule.compareUnicodeScalarStrings('a', 'aa'), -1)
  assert.equal(codecModule.compareUnicodeScalarStrings('aa', 'a'), 1)
  assert.equal(codecModule.compareUnicodeScalarStrings('', '𐀀'), -1)
  assert.equal(codecModule.compareUnicodeScalarStrings('𐀀', ''), 1)
  assert.equal(codecModule.compareUnicodeScalarStrings('é', 'é'), -1)

  assert.deepEqual(
    codecModule.captureKeywords(['a', 'aa', '', '𐀀']),
    ['a', 'aa', '', '𐀀'],
  )
  for (const value of [
    ['tea', 'no sugar'],
    ['tea', 'tea'],
    [''],
    ['\uD800'],
    ['\uDC00'],
    ['ok', 'bad\uD800'],
  ]) {
    assertBundleCode(
      () => codecModule.captureKeywords(value),
      'bundle_invalid_atom',
    )
  }
  assertBundleCode(
    () => codecModule.compareUnicodeScalarStrings('ok', '\uD800'),
    'bundle_invalid_atom',
  )
})

test('M1-04 validates strict identities, prefixed UUID-v4 families, and memory types', () => {
  assert.equal(codecModule.validateIdentity('a', 'bundle_invalid_decision'), 'a')
  assert.equal(
    codecModule.validateIdentity(`a${'0'.repeat(63)}`, 'bundle_invalid_decision'),
    `a${'0'.repeat(63)}`,
  )
  for (const value of ['', 'A', '1user', 'user.name', `a${'0'.repeat(64)}`]) {
    assertBundleCode(
      () => codecModule.validateIdentity(value, 'bundle_invalid_decision'),
      'bundle_invalid_decision',
    )
  }

  const unprefixed = '00000000-0000-4000-8000-000000000001'
  for (const prefix of ['str_', 'dec_', 'prp_', 'mem_', 'msg_', '']) {
    assert.equal(
      codecModule.validatePrefixedUuidV4(
        `${prefix}${unprefixed}`,
        prefix,
        'bundle_invalid_decision',
      ),
      `${prefix}${unprefixed}`,
    )
  }
  for (const value of [
    'mem_AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA',
    'mem_00000000-0000-5000-8000-000000000001',
    'mem_00000000-0000-4000-7000-000000000001',
    'mem_00000000-0000-4000-c000-000000000001',
    unprefixed,
  ]) {
    assertBundleCode(
      () => codecModule.validatePrefixedUuidV4(
        value,
        'mem_',
        'bundle_invalid_decision',
      ),
      'bundle_invalid_decision',
    )
  }

  const memoryTypes = [
    'relationship',
    'preference',
    'opinion',
    'entity',
    'life_event',
    'working',
    'project',
    'recent_life',
    'session_summary',
  ]
  for (const value of memoryTypes) {
    assert.equal(
      codecModule.validateMemoryType(value, 'bundle_invalid_decision'),
      value,
    )
  }
  for (const value of ['', 'unknown', new String('preference')]) {
    assertBundleCode(
      () => codecModule.validateMemoryType(value, 'bundle_invalid_decision'),
      'bundle_invalid_decision',
    )
  }
})

test('M1-04 validates intrinsic exact timestamp round trips and invalid calendar dates', () => {
  for (const value of [
    '2026-07-18T12:00:00.000Z',
    '2024-02-29T23:59:59.999Z',
    '0000-01-01T00:00:00.000Z',
  ]) {
    assert.equal(
      codecModule.validateTimestamp(value, 'bundle_invalid_decision'),
      value,
    )
  }
  for (const value of [
    '2026-02-29T00:00:00.000Z',
    '2026-02-30T00:00:00.000Z',
    '2026-07-18T12:00:00Z',
    '2026-07-18T12:00:00.000+00:00',
    '2026-07-18T12:00:60.000Z',
    '2026-7-18T12:00:00.000Z',
  ]) {
    assertBundleCode(
      () => codecModule.validateTimestamp(value, 'bundle_invalid_decision'),
      'bundle_invalid_decision',
    )
  }

  const originalDate = globalThis.Date
  const originalToISOString = Date.prototype.toISOString
  try {
    globalThis.Date = class PoisonedDate {
      constructor() {
        throw new Error('poisoned Date constructor ran')
      }
    }
    originalDate.prototype.toISOString = () => {
      throw new Error('poisoned toISOString ran')
    }
    assert.equal(
      codecModule.validateTimestamp(
        '2026-07-18T12:00:00.000Z',
        'bundle_invalid_decision',
      ),
      '2026-07-18T12:00:00.000Z',
    )
  } finally {
    globalThis.Date = originalDate
    originalDate.prototype.toISOString = originalToISOString
  }
})

test('M1-04 scalar validation never coerces caller values', () => {
  let coercionCalls = 0
  const coercion = {
    toString() {
      coercionCalls += 1
      throw new Error('toString ran')
    },
    valueOf() {
      coercionCalls += 1
      throw new Error('valueOf ran')
    },
    [Symbol.toPrimitive]() {
      coercionCalls += 1
      throw new Error('toPrimitive ran')
    },
  }
  for (const callback of [
    () => codecModule.validateIdentity(coercion, 'bundle_invalid_decision'),
    () => codecModule.validatePrefixedUuidV4(
      coercion,
      'mem_',
      'bundle_invalid_decision',
    ),
    () => codecModule.validateTimestamp(coercion, 'bundle_invalid_decision'),
    () => codecModule.validateMemoryType(coercion, 'bundle_invalid_decision'),
  ]) {
    assertBundleCode(callback, 'bundle_invalid_decision')
  }
  assertBundleCode(
    () => codecModule.compareUnicodeScalarStrings(coercion, 'value'),
    'bundle_invalid_atom',
  )
  assert.equal(coercionCalls, 0)
})

test('M1-04 grammar validation ignores later RegExp exec replacement', () => {
  const originalDescriptor = m104ReflectApply(
    m104ReflectGetOwnPropertyDescriptor,
    undefined,
    [RegExp.prototype, 'exec'],
  )
  assert.notEqual(originalDescriptor, undefined)

  const validUuid = 'mem_00000000-0000-4000-8000-000000000004'
  const validTimestamp = '2026-07-18T12:00:00.000Z'
  const runGrammarCases = () => ({
    validIdentity: captureM104Outcome(() => codecModule.validateIdentity(
      'palari-a',
      'bundle_invalid_decision',
    )),
    validUuid: captureM104Outcome(() => codecModule.validatePrefixedUuidV4(
      validUuid,
      'mem_',
      'bundle_invalid_decision',
    )),
    validTimestamp: captureM104Outcome(() => codecModule.validateTimestamp(
      validTimestamp,
      'bundle_invalid_decision',
    )),
    invalidIdentity: captureM104Outcome(() => codecModule.validateIdentity(
      'INVALID!',
      'bundle_invalid_decision',
    )),
    invalidUuid: captureM104Outcome(() => codecModule.validatePrefixedUuidV4(
      'mem_not-a-uuid',
      'mem_',
      'bundle_invalid_decision',
    )),
    invalidTimestamp: captureM104Outcome(() => codecModule.validateTimestamp(
      '2026-07-18T12:00:00Z',
      'bundle_invalid_decision',
    )),
  })

  let forgedCalls = 0
  let throwingCalls = 0
  let forgedOutcomes
  let throwingOutcomes
  try {
    m104ReflectApply(m104ReflectDefineProperty, undefined, [
      RegExp.prototype,
      'exec',
      {
        ...originalDescriptor,
        value() {
          forgedCalls += 1
          return ['forged']
        },
      },
    ])
    forgedOutcomes = runGrammarCases()

    m104ReflectApply(m104ReflectDefineProperty, undefined, [
      RegExp.prototype,
      'exec',
      {
        ...originalDescriptor,
        value() {
          throwingCalls += 1
          throw new Error('poisoned RegExp exec ran')
        },
      },
    ])
    throwingOutcomes = runGrammarCases()
  } finally {
    restoreM104OwnDescriptor(RegExp.prototype, 'exec', originalDescriptor)
  }

  assert.deepEqual(
    m104ReflectApply(m104ReflectGetOwnPropertyDescriptor, undefined, [
      RegExp.prototype,
      'exec',
    ]),
    originalDescriptor,
  )
  assert.equal(forgedCalls, 0)
  assert.equal(throwingCalls, 0)
  for (const outcomes of [forgedOutcomes, throwingOutcomes]) {
    assert.equal(outcomes.validIdentity.error, undefined)
    assert.equal(outcomes.validIdentity.value, 'palari-a')
    assert.equal(outcomes.validUuid.error, undefined)
    assert.equal(outcomes.validUuid.value, validUuid)
    assert.equal(outcomes.validTimestamp.error, undefined)
    assert.equal(outcomes.validTimestamp.value, validTimestamp)
    assert.equal(outcomes.invalidIdentity.error?.code, 'bundle_invalid_decision')
    assert.equal(outcomes.invalidUuid.error?.code, 'bundle_invalid_decision')
    assert.equal(outcomes.invalidTimestamp.error?.code, 'bundle_invalid_decision')
  }
})

test('M1-04 capture policy ignores inherited values and getters', () => {
  const originalAllowSubset = m104ReflectApply(
    m104ReflectGetOwnPropertyDescriptor,
    undefined,
    [Object.prototype, 'allowSubset'],
  )
  const originalRequiredPrototype = m104ReflectApply(
    m104ReflectGetOwnPropertyDescriptor,
    undefined,
    [Object.prototype, 'requiredPrototype'],
  )
  const expectedHead = {
    streamId: M1_04_IDS.streamId,
    sequence: 0,
  }
  const nullPrototypeOpenOptions = Object.create(null)
  m104ReflectApply(m104ReflectDefineProperty, undefined, [
    nullPrototypeOpenOptions,
    'dbPath',
    {
      value: '/tmp/bundle.sqlite',
      enumerable: true,
      configurable: true,
      writable: true,
    },
  ])

  let inheritedDecision
  let inheritedApply
  let inheritedOpen
  let getterDecision
  let getterApply
  let getterOpen
  let allowSubsetGetterCalls = 0
  let requiredPrototypeGetterCalls = 0
  try {
    m104ReflectApply(m104ReflectDefineProperty, undefined, [
      Object.prototype,
      'allowSubset',
      {
        value: true,
        enumerable: false,
        configurable: true,
        writable: true,
      },
    ])
    m104ReflectApply(m104ReflectDefineProperty, undefined, [
      Object.prototype,
      'requiredPrototype',
      {
        value: Object.prototype,
        enumerable: false,
        configurable: true,
        writable: true,
      },
    ])
    inheritedDecision = captureM104Outcome(() => codecModule.captureDecision({}))
    inheritedApply = captureM104Outcome(() => codecModule.captureApplyEnvelope({
      expectedHead,
    }))

    m104ReflectApply(m104ReflectDefineProperty, undefined, [
      Object.prototype,
      'allowSubset',
      {
        value: false,
        enumerable: false,
        configurable: true,
        writable: true,
      },
    ])
    m104ReflectApply(m104ReflectDefineProperty, undefined, [
      Object.prototype,
      'requiredPrototype',
      {
        value: null,
        enumerable: false,
        configurable: true,
        writable: true,
      },
    ])
    inheritedOpen = captureM104Outcome(() => codecModule.captureOpenOptions(
      nullPrototypeOpenOptions,
    ))

    m104ReflectApply(m104ReflectDefineProperty, undefined, [
      Object.prototype,
      'allowSubset',
      {
        enumerable: false,
        configurable: true,
        get() {
          allowSubsetGetterCalls += 1
          throw new Error('inherited allowSubset getter ran')
        },
      },
    ])
    m104ReflectApply(m104ReflectDefineProperty, undefined, [
      Object.prototype,
      'requiredPrototype',
      {
        value: Object.prototype,
        enumerable: false,
        configurable: true,
        writable: true,
      },
    ])
    getterDecision = captureM104Outcome(() => codecModule.captureDecision({}))
    getterApply = captureM104Outcome(() => codecModule.captureApplyEnvelope({
      expectedHead,
    }))

    m104ReflectApply(m104ReflectDefineProperty, undefined, [
      Object.prototype,
      'allowSubset',
      {
        value: false,
        enumerable: false,
        configurable: true,
        writable: true,
      },
    ])
    m104ReflectApply(m104ReflectDefineProperty, undefined, [
      Object.prototype,
      'requiredPrototype',
      {
        enumerable: false,
        configurable: true,
        get() {
          requiredPrototypeGetterCalls += 1
          throw new Error('inherited requiredPrototype getter ran')
        },
      },
    ])
    getterOpen = captureM104Outcome(() => codecModule.captureOpenOptions(
      nullPrototypeOpenOptions,
    ))
  } finally {
    restoreM104OwnDescriptor(
      Object.prototype,
      'requiredPrototype',
      originalRequiredPrototype,
    )
    restoreM104OwnDescriptor(
      Object.prototype,
      'allowSubset',
      originalAllowSubset,
    )
  }

  assert.deepEqual(
    m104ReflectApply(m104ReflectGetOwnPropertyDescriptor, undefined, [
      Object.prototype,
      'allowSubset',
    ]),
    originalAllowSubset,
  )
  assert.deepEqual(
    m104ReflectApply(m104ReflectGetOwnPropertyDescriptor, undefined, [
      Object.prototype,
      'requiredPrototype',
    ]),
    originalRequiredPrototype,
  )
  assert.equal(allowSubsetGetterCalls, 0)
  assert.equal(requiredPrototypeGetterCalls, 0)
  assert.equal(inheritedDecision.error?.code, 'bundle_invalid_decision')
  assert.equal(inheritedApply.error?.code, 'bundle_invalid_argument')
  assert.equal(inheritedOpen.error?.code, 'bundle_invalid_argument')
  assert.equal(getterDecision.error?.code, 'bundle_invalid_decision')
  assert.equal(getterApply.error?.code, 'bundle_invalid_argument')
  assert.equal(getterOpen.error?.code, 'bundle_invalid_argument')
})

test('M1-04 checksum ignores later native hash-handle dispatch replacement', () => {
  assert.equal(
    process.version,
    'v22.22.2',
    'M1-04 native hash-handle regression requires Node v22.22.2.',
  )
  const handlePrototype = findM104NativeHashHandlePrototype(createHash('sha256'))
  const originalUpdate = m104ReflectApply(
    m104ReflectGetOwnPropertyDescriptor,
    undefined,
    [handlePrototype, 'update'],
  )
  const originalDigest = m104ReflectApply(
    m104ReflectGetOwnPropertyDescriptor,
    undefined,
    [handlePrototype, 'digest'],
  )
  assert.equal(typeof originalUpdate?.value, 'function')
  assert.equal(typeof originalDigest?.value, 'function')

  let updateCalls = 0
  let digestCalls = 0
  let checksumOutcome
  let rowOutcome
  try {
    m104ReflectApply(m104ReflectDefineProperty, undefined, [
      handlePrototype,
      'update',
      {
        ...originalUpdate,
        value() {
          updateCalls += 1
          throw new Error('poisoned native hash-handle update ran')
        },
      },
    ])
    m104ReflectApply(m104ReflectDefineProperty, undefined, [
      handlePrototype,
      'digest',
      {
        ...originalDigest,
        value() {
          digestCalls += 1
          throw new Error('poisoned native hash-handle digest ran')
        },
      },
    ])
    checksumOutcome = captureM104Outcome(() => (
      codecModule.computeMemoryBundleAtomChecksum(M1_04_CHECKSUM_VECTOR)
    ))
    rowOutcome = captureM104Outcome(() => codecModule.encodeAtomRow(
      M1_04_CHECKSUM_VECTOR,
    ))
  } finally {
    restoreM104OwnDescriptor(handlePrototype, 'digest', originalDigest)
    restoreM104OwnDescriptor(handlePrototype, 'update', originalUpdate)
  }

  assert.deepEqual(
    m104ReflectApply(m104ReflectGetOwnPropertyDescriptor, undefined, [
      handlePrototype,
      'update',
    ]),
    originalUpdate,
  )
  assert.deepEqual(
    m104ReflectApply(m104ReflectGetOwnPropertyDescriptor, undefined, [
      handlePrototype,
      'digest',
    ]),
    originalDigest,
  )
  assert.equal(updateCalls, 0)
  assert.equal(digestCalls, 0)
  assert.equal(checksumOutcome.error, undefined)
  assert.equal(checksumOutcome.value, M1_04_CHECKSUM)
  assert.equal(rowOutcome.error, undefined)
  assert.equal(rowOutcome.value.content_checksum, M1_04_CHECKSUM)
})

test('M1-04 codec operations ignore later intrinsic and prototype poisoning', () => {
  const hash = createHash('sha256')
  const findMethodOwner = (key) => {
    let prototype = Object.getPrototypeOf(hash)
    while (prototype !== null && !Object.hasOwn(prototype, key)) {
      prototype = Object.getPrototypeOf(prototype)
    }
    assert.notEqual(prototype, null)
    return prototype
  }
  const hashUpdatePrototype = findMethodOwner('update')
  const hashDigestPrototype = findMethodOwner('digest')

  const poisons = [
    [Reflect, 'apply'],
    [Reflect, 'construct'],
    [Reflect, 'defineProperty'],
    [Reflect, 'getOwnPropertyDescriptor'],
    [Reflect, 'getPrototypeOf'],
    [Reflect, 'ownKeys'],
    [Array, 'isArray'],
    [Object.prototype, 'hasOwnProperty'],
    [Object, 'is'],
    [Number, 'isFinite'],
    [Number, 'isSafeInteger'],
    [Number.prototype, 'toString'],
    [String.prototype, 'charCodeAt'],
    [String.prototype, 'indexOf'],
    [String.prototype, 'slice'],
    [String.prototype, 'startsWith'],
    [RegExp.prototype, 'test'],
    [JSON, 'parse'],
    [JSON, 'stringify'],
    [Map.prototype, 'get'],
    [Map.prototype, 'set'],
    [hashUpdatePrototype, 'update'],
    [hashDigestPrototype, 'digest'],
  ].map(([target, key]) => ({
    target,
    key,
    descriptor: Object.getOwnPropertyDescriptor(target, key),
  }))

  const atom = makeM104CanonicalAtom()
  const row = makeM104AtomRow()
  let outcomes
  let caught
  try {
    for (const { target, key, descriptor } of poisons) {
      Object.defineProperty(target, key, {
        ...descriptor,
        value() {
          throw new Error(`poisoned ${key} ran`)
        },
      })
    }
    try {
      outcomes = {
        options: codecModule.captureOpenOptions({ dbPath: '/tmp/bundle.sqlite' }),
        keywords: codecModule.captureKeywords(['no sugar', 'tea']),
        checksum: codecModule.computeMemoryBundleAtomChecksum(atom),
        decoded: codecModule.decodeAtomRow(row),
      }
    } catch (error) {
      caught = error
    }
  } finally {
    for (let index = poisons.length - 1; index >= 0; index -= 1) {
      const { target, key, descriptor } = poisons[index]
      Object.defineProperty(target, key, descriptor)
    }
  }

  assert.equal(caught, undefined)
  assert.deepEqual(outcomes.options, { dbPath: '/tmp/bundle.sqlite' })
  assert.deepEqual(outcomes.keywords, ['no sugar', 'tea'])
  assert.equal(outcomes.checksum, M1_04_CHECKSUM)
  assert.equal(outcomes.decoded.contentChecksum, M1_04_CHECKSUM)
})

test('M1-04 computes the exact canonical atom checksum and preserves Unicode distinctions', () => {
  assert.equal(
    codecModule.computeMemoryBundleAtomChecksum(M1_04_CHECKSUM_VECTOR),
    M1_04_CHECKSUM,
  )
  assert.match(M1_04_CHECKSUM, /^[0-9a-f]{64}$/)

  const composed = makeM104CanonicalAtom({ content: 'café' })
  const decomposed = makeM104CanonicalAtom({ content: 'café' })
  assert.notEqual(
    codecModule.computeMemoryBundleAtomChecksum(composed),
    codecModule.computeMemoryBundleAtomChecksum(decomposed),
  )

  const originalArrayToJSON = Object.getOwnPropertyDescriptor(
    Array.prototype,
    'toJSON',
  )
  let toJSONCalls = 0
  try {
    Object.defineProperty(Array.prototype, 'toJSON', {
      configurable: true,
      value() {
        toJSONCalls += 1
        throw new Error('inherited toJSON ran')
      },
    })
    assert.equal(
      codecModule.computeMemoryBundleAtomChecksum(M1_04_CHECKSUM_VECTOR),
      M1_04_CHECKSUM,
    )
  } finally {
    if (originalArrayToJSON === undefined) {
      Reflect.deleteProperty(Array.prototype, 'toJSON')
    } else {
      Object.defineProperty(Array.prototype, 'toJSON', originalArrayToJSON)
    }
  }
  assert.equal(toJSONCalls, 0)
})

test('M1-04 rejects malformed canonical atom shape, Unicode, and numeric scalars without coercion', () => {
  for (const revoked of [false, true]) {
    const counter = { count: 0 }
    const proxy = revoked
      ? makeM104RevokedProxy(M1_04_CHECKSUM_VECTOR, counter)
      : makeM104TrapProxy(M1_04_CHECKSUM_VECTOR, counter)
    assertBundleCode(
      () => codecModule.computeMemoryBundleAtomChecksum(proxy),
      'bundle_invalid_atom',
    )
    assert.equal(counter.count, 0)
  }

  const wrongPrototype = { ...M1_04_CHECKSUM_VECTOR }
  Object.setPrototypeOf(wrongPrototype, {})
  assertBundleCode(
    () => codecModule.computeMemoryBundleAtomChecksum(wrongPrototype),
    'bundle_invalid_atom',
  )
  const nullPrototype = Object.assign(
    Object.create(null),
    M1_04_CHECKSUM_VECTOR,
  )
  assertBundleCode(
    () => codecModule.computeMemoryBundleAtomChecksum(nullPrototype),
    'bundle_invalid_atom',
  )
  const crossRealm = runInNewContext('({})')
  Object.assign(crossRealm, M1_04_CHECKSUM_VECTOR)
  assertBundleCode(
    () => codecModule.computeMemoryBundleAtomChecksum(crossRealm),
    'bundle_invalid_atom',
  )

  const extra = { ...M1_04_CHECKSUM_VECTOR, extra: true }
  assertBundleCode(
    () => codecModule.computeMemoryBundleAtomChecksum(extra),
    'bundle_invalid_atom',
  )
  const symbolic = { ...M1_04_CHECKSUM_VECTOR, [Symbol('extra')]: true }
  assertBundleCode(
    () => codecModule.computeMemoryBundleAtomChecksum(symbolic),
    'bundle_invalid_atom',
  )
  const accessor = { ...M1_04_CHECKSUM_VECTOR }
  let getterCalls = 0
  Object.defineProperty(accessor, 'content', {
    enumerable: true,
    get() {
      getterCalls += 1
      throw new Error('atom getter ran')
    },
  })
  assertBundleCode(
    () => codecModule.computeMemoryBundleAtomChecksum(accessor),
    'bundle_invalid_atom',
  )
  assert.equal(getterCalls, 0)

  for (const field of [
    'memoryId',
    'streamId',
    'palariId',
    'userId',
    'type',
    'content',
    'provenanceKind',
    'sourceMessageId',
    'validFrom',
    'createdAt',
  ]) {
    assertBundleCode(
      () => codecModule.computeMemoryBundleAtomChecksum({
        ...M1_04_CHECKSUM_VECTOR,
        [field]: `bad\uD800`,
      }),
      'bundle_invalid_atom',
    )
  }

  for (const [field, values] of [
    ['initialImportance', [-0, NaN, Infinity, -0.01, 1.01]],
    ['confidence', [-0, NaN, -Infinity, -0.01, 1.01]],
  ]) {
    for (const value of values) {
      assertBundleCode(
        () => codecModule.computeMemoryBundleAtomChecksum({
          ...M1_04_CHECKSUM_VECTOR,
          [field]: value,
        }),
        'bundle_invalid_atom',
      )
    }
  }
  for (const createdSequence of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assertBundleCode(
      () => codecModule.computeMemoryBundleAtomChecksum({
        ...M1_04_CHECKSUM_VECTOR,
        createdSequence,
      }),
      'bundle_invalid_atom',
    )
  }

  let coercionCalls = 0
  const coercion = {
    valueOf() {
      coercionCalls += 1
      throw new Error('numeric coercion ran')
    },
    toString() {
      coercionCalls += 1
      throw new Error('string coercion ran')
    },
  }
  for (const field of ['content', 'initialImportance', 'fictional']) {
    assertBundleCode(
      () => codecModule.computeMemoryBundleAtomChecksum({
        ...M1_04_CHECKSUM_VECTOR,
        [field]: coercion,
      }),
      'bundle_invalid_atom',
    )
  }
  assert.equal(coercionCalls, 0)
})

const M1_07_TIMESTAMP = '2026-07-20T12:34:56.789Z'
const M1_07_UUID = '00000000-0000-4000-8000-000000000701'

function readM107BundleObjects(db) {
  const rows = db.prepare(`
    SELECT type, name, tbl_name, sql
    FROM main.sqlite_schema
    ORDER BY name COLLATE BINARY
  `).all()
  return rows.filter(({ name }) => {
    const foldedName = name.toLowerCase()
    return (
      foldedName.startsWith('memory_bundle_') ||
      foldedName.startsWith('sqlite_autoindex_memory_bundle_')
    )
  })
}

function readM107SingleValue(db, sql) {
  const row = db.prepare(sql).get()
  const keys = Object.keys(row)
  assert.equal(keys.length, 1)
  return row[keys[0]]
}

function assertM107NoBundleObjects(db) {
  assert.deepEqual(readM107BundleObjects(db), [])
  assert.equal(db.isTransaction, false)
}

function readM107SemanticCounts(db) {
  return db.prepare(`
    SELECT
      (SELECT head_sequence
       FROM main.memory_bundle_meta
       WHERE singleton = 1) AS headSequence,
      (SELECT count(*) FROM main.memory_bundle_events) AS eventCount,
      (SELECT count(*) FROM main.memory_bundle_atoms) AS atomCount
  `).get()
}

test('M1-07 initializes synchronously for every valid option-key subset with the exact fresh manifest', () => {
  const invocations = [
    {
      name: 'omitted',
      invoke(db) {
        return applyModule.initializeMemoryBundle(db)
      },
    },
    {
      name: 'empty',
      invoke(db) {
        return applyModule.initializeMemoryBundle(db, {})
      },
    },
    {
      name: 'clock-only',
      invoke(db) {
        return applyModule.initializeMemoryBundle(db, {
          clock() {
            return new Date(M1_07_TIMESTAMP)
          },
        })
      },
    },
    {
      name: 'id-only',
      invoke(db) {
        return applyModule.initializeMemoryBundle(db, {
          idFactory() {
            return M1_07_UUID
          },
        })
      },
    },
    {
      name: 'both',
      invoke(db) {
        return applyModule.initializeMemoryBundle(db, {
          clock() {
            return new Date(M1_07_TIMESTAMP)
          },
          idFactory() {
            return M1_07_UUID
          },
        })
      },
    },
  ]

  const expectedApplicationObjects = EXPECTED_OBJECTS
    .map(({ type, name }) => ({ type, name }))
    .sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0)
  const expectedAutoindexes = [...EXPECTED_AUTOINDEX_NAMES].sort()

  for (const invocation of invocations) {
    const db = new DatabaseSync(':memory:')
    try {
      const result = invocation.invoke(db)
      assert.equal(result, undefined, invocation.name)
      assert.equal(result instanceof Promise, false, invocation.name)

      const objects = readM107BundleObjects(db)
      const applicationObjects = objects
        .filter(({ name }) => name.startsWith('memory_bundle_'))
        .map(({ type, name }) => ({ type, name }))
      const autoindexes = objects
        .filter(({ name }) => name.startsWith('sqlite_autoindex_'))
        .map(({ name }) => name)
      assert.deepEqual(applicationObjects, expectedApplicationObjects, invocation.name)
      assert.deepEqual(autoindexes, expectedAutoindexes, invocation.name)

      const rows = db.prepare(`
        SELECT singleton, schema_version, stream_id, head_sequence, created_at
        FROM main.memory_bundle_meta
      `).all()
      assert.equal(rows.length, 1, invocation.name)
      assert.equal(rows[0].singleton, 1, invocation.name)
      assert.equal(rows[0].schema_version, 'CDX-B1', invocation.name)
      assert.match(
        rows[0].stream_id,
        /^str_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        invocation.name,
      )
      assert.equal(rows[0].head_sequence, 0, invocation.name)
      assert.match(
        rows[0].created_at,
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
        invocation.name,
      )
      if (invocation.name === 'clock-only' || invocation.name === 'both') {
        assert.equal(rows[0].created_at, M1_07_TIMESTAMP)
      }
      if (invocation.name === 'id-only' || invocation.name === 'both') {
        assert.equal(rows[0].stream_id, `str_${M1_07_UUID}`)
      }

      assert.equal(readM107SingleValue(db, 'PRAGMA foreign_keys'), 1)
      assert.equal(readM107SingleValue(db, 'PRAGMA busy_timeout'), 0)
      assert.equal(readM107SingleValue(db, 'PRAGMA recursive_triggers'), 1)
      assert.equal(readM107SingleValue(db, 'PRAGMA ignore_check_constraints'), 0)
    } finally {
      db.close()
    }
  }
})

test('M1-07 captures exact options and invokes clock before idFactory with undefined this and zero arguments', () => {
  const invalidOptions = [
    { clock: undefined },
    { idFactory: undefined },
    { clock: null },
    { idFactory: M1_07_UUID },
  ]
  for (const options of invalidOptions) {
    const db = new DatabaseSync(':memory:')
    try {
      assertBundleCode(
        () => applyModule.initializeMemoryBundle(db, options),
        'bundle_invalid_argument',
      )
      assertM107NoBundleObjects(db)
    } finally {
      db.close()
    }
  }

  const db = new DatabaseSync(':memory:')
  const calls = []
  try {
    const result = applyModule.initializeMemoryBundle(db, {
      clock: function clock() {
        calls.push({ callback: 'clock', thisIsUndefined: this === undefined, arguments: arguments.length })
        return new Date(M1_07_TIMESTAMP)
      },
      idFactory: function idFactory() {
        calls.push({ callback: 'idFactory', thisIsUndefined: this === undefined, arguments: arguments.length })
        return M1_07_UUID
      },
    })
    assert.equal(result, undefined)
    assert.deepEqual(calls, [
      { callback: 'clock', thisIsUndefined: true, arguments: 0 },
      { callback: 'idFactory', thisIsUndefined: true, arguments: 0 },
    ])
  } finally {
    db.close()
  }
})

test('M1-07 enforces database, options, open-state, and transaction precedence without Proxy traps', () => {
  const closed = new DatabaseSync(':memory:')
  closed.close()
  assertBundleCode(
    () => applyModule.initializeMemoryBundle(closed, { unexpected: true }),
    'bundle_invalid_argument',
  )

  const active = new DatabaseSync(':memory:')
  try {
    active.exec('BEGIN')
    assertBundleCode(
      () => applyModule.initializeMemoryBundle(active, { clock: undefined }),
      'bundle_invalid_argument',
    )
    active.exec('ROLLBACK')

    let optionsProxyTrapCount = 0
    const optionsProxy = new Proxy({}, {
      get() {
        optionsProxyTrapCount += 1
        throw new Error('options Proxy trap ran')
      },
      getOwnPropertyDescriptor() {
        optionsProxyTrapCount += 1
        throw new Error('options Proxy trap ran')
      },
      ownKeys() {
        optionsProxyTrapCount += 1
        throw new Error('options Proxy trap ran')
      },
    })
    assert.throws(
      () => applyModule.initializeMemoryBundle({}, optionsProxy),
      (error) => {
        assert.equal(error?.code, 'bundle_invalid_argument')
        assert.equal(error?.message, 'A native DatabaseSync connection is required.')
        return true
      },
    )
    assert.equal(optionsProxyTrapCount, 0)
  } finally {
    if (active.isTransaction) active.exec('ROLLBACK')
    active.close()
  }
})

test('M1-07 accepts native-branded Date values across realms and subclasses while ignoring overridden methods', () => {
  class OverriddenDate extends Date {
    toISOString() {
      throw new Error('subclass override must not run')
    }
  }

  const ownOverride = new Date(M1_07_TIMESTAMP)
  ownOverride.toISOString = () => {
    throw new Error('own override must not run')
  }

  const accepted = [
    new Date(M1_07_TIMESTAMP),
    runInNewContext(`new Date('${M1_07_TIMESTAMP}')`),
    new OverriddenDate(M1_07_TIMESTAMP),
    ownOverride,
  ]

  for (const date of accepted) {
    const db = new DatabaseSync(':memory:')
    try {
      assert.equal(applyModule.initializeMemoryBundle(db, {
        clock() {
          return date
        },
        idFactory() {
          return M1_07_UUID
        },
      }), undefined)
      assert.equal(
        db.prepare('SELECT created_at FROM main.memory_bundle_meta').get().created_at,
        M1_07_TIMESTAMP,
      )
    } finally {
      db.close()
    }
  }
})

test('M1-07 rejects invalid clocks before id generation and fully rolls back clock or id failures', () => {
  const invalidClockFactories = [
    () => new Proxy(new Date(M1_07_TIMESTAMP), {}),
    () => Object.create(Date.prototype),
    () => new Date('invalid'),
    () => M1_07_TIMESTAMP,
    () => ({ toISOString: () => M1_07_TIMESTAMP }),
    () => { throw new Error('clock failed') },
    () => {
      const error = new Error('busy-shaped clock failure')
      error.code = 'ERR_SQLITE_ERROR'
      error.errcode = 5
      throw error
    },
  ]

  for (const clock of invalidClockFactories) {
    const db = new DatabaseSync(':memory:')
    let idCalls = 0
    try {
      assertBundleCode(
        () => applyModule.initializeMemoryBundle(db, {
          clock,
          idFactory() {
            idCalls += 1
            return M1_07_UUID
          },
        }),
        'bundle_invalid_argument',
      )
      assert.equal(idCalls, 0)
      assertM107NoBundleObjects(db)
    } finally {
      db.close()
    }
  }

  const invalidIds = [
    undefined,
    `str_${M1_07_UUID}`,
    '00000000-0000-4000-8000-00000000070A',
    '00000000-0000-3000-8000-000000000701',
    7,
    { toString() { throw new Error('id coercion must not run') } },
  ]
  const idFactories = invalidIds.map((value) => () => value)
  idFactories.push(() => { throw new Error('id factory failed') })
  idFactories.push(() => {
    const error = new Error('busy-shaped id factory failure')
    error.code = 'ERR_SQLITE_ERROR'
    error.errcode = 6
    throw error
  })

  for (const idFactory of idFactories) {
    const db = new DatabaseSync(':memory:')
    let clockCalls = 0
    try {
      assertBundleCode(
        () => applyModule.initializeMemoryBundle(db, {
          clock() {
            clockCalls += 1
            return new Date(M1_07_TIMESTAMP)
          },
          idFactory,
        }),
        'bundle_invalid_argument',
      )
      assert.equal(clockCalls, 1)
      assertM107NoBundleObjects(db)
    } finally {
      db.close()
    }
  }
})

test('M1-07 leaves valid existing and partial, malformed, or unknown layouts unchanged without callbacks', () => {
  const valid = new DatabaseSync(':memory:')
  let validCallbackCalls = 0
  try {
    createM105Bundle(valid)
    const before = readM107BundleObjects(valid)
    const options = {
      clock() {
        validCallbackCalls += 1
        throw new Error('existing bundle clock must not run')
      },
      idFactory() {
        validCallbackCalls += 1
        throw new Error('existing bundle id factory must not run')
      },
    }
    assert.equal(applyModule.initializeMemoryBundle(valid, options), undefined)
    assert.equal(applyModule.initializeMemoryBundle(valid, options), undefined)
    assert.equal(validCallbackCalls, 0)
    assert.deepEqual(readM107BundleObjects(valid), before)
    assert.equal(valid.isTransaction, false)
  } finally {
    valid.close()
  }

  const invalidLayouts = [
    'CREATE TABLE main.memory_bundle_meta (singleton INTEGER)',
    `CREATE VIEW main.memory_bundle_meta AS
       SELECT 1 AS singleton, 'CDX-B1' AS schema_version`,
    'CREATE TABLE main.memory_bundle_unknown (id INTEGER)',
    'CREATE TABLE main.Memory_Bundle_Meta (singleton INTEGER)',
  ]
  for (const sql of invalidLayouts) {
    const db = new DatabaseSync(':memory:')
    let callbackCalls = 0
    try {
      db.exec(sql)
      const before = readM107BundleObjects(db)
      assert.ok(before.length > 0)
      assertBundleCode(
        () => applyModule.initializeMemoryBundle(db, {
          clock() {
            callbackCalls += 1
            return new Date(M1_07_TIMESTAMP)
          },
          idFactory() {
            callbackCalls += 1
            return M1_07_UUID
          },
        }),
        'bundle_layout_invalid',
      )
      assert.equal(callbackCalls, 0)
      assert.deepEqual(readM107BundleObjects(db), before)
      assert.equal(db.isTransaction, false)
    } finally {
      db.close()
    }
  }

  const semanticallyInvalid = new DatabaseSync(':memory:')
  let semanticCallbackCalls = 0
  try {
    createM105Bundle(semanticallyInvalid, {
      meta: { head_sequence: 1 },
      beforeTriggers(db) {
        insertM105EventRow(db)
      },
    })
    const before = readM107BundleObjects(semanticallyInvalid)
    const semanticBefore = readM107SemanticCounts(semanticallyInvalid)
    assertBundleCode(
      () => applyModule.initializeMemoryBundle(semanticallyInvalid, {
        clock() {
          semanticCallbackCalls += 1
          throw new Error('semantic-invalid clock must not run')
        },
        idFactory() {
          semanticCallbackCalls += 1
          throw new Error('semantic-invalid idFactory must not run')
        },
      }),
      'bundle_missing_atom',
    )
    assert.equal(semanticCallbackCalls, 0)
    assert.deepEqual(readM107BundleObjects(semanticallyInvalid), before)
    assert.deepEqual(readM107SemanticCounts(semanticallyInvalid), semanticBefore)
    assert.equal(semanticBefore.headSequence, 1)
    assert.equal(semanticBefore.eventCount, 1)
    assert.equal(semanticBefore.atomCount, 0)
    assert.equal(semanticallyInvalid.isTransaction, false)
  } finally {
    semanticallyInvalid.close()
  }

  const mixedCaseAdditional = new DatabaseSync(':memory:')
  let mixedCaseCallbackCalls = 0
  try {
    createM105Bundle(mixedCaseAdditional)
    mixedCaseAdditional.exec(
      'CREATE TABLE main.Memory_Bundle_Unknown (id INTEGER)',
    )
    const before = readM107BundleObjects(mixedCaseAdditional)
    assert.equal(
      before.some(({ name }) => name === 'Memory_Bundle_Unknown'),
      true,
    )
    assertBundleCode(
      () => applyModule.initializeMemoryBundle(mixedCaseAdditional, {
        clock() {
          mixedCaseCallbackCalls += 1
          throw new Error('mixed-case clock must not run')
        },
        idFactory() {
          mixedCaseCallbackCalls += 1
          throw new Error('mixed-case idFactory must not run')
        },
      }),
      'bundle_layout_invalid',
    )
    assert.equal(mixedCaseCallbackCalls, 0)
    assert.deepEqual(readM107BundleObjects(mixedCaseAdditional), before)
    assert.equal(mixedCaseAdditional.isTransaction, false)
  } finally {
    mixedCaseAdditional.close()
  }
})

test('M1-07 never delegates schema candidate selection to an overridden glob function', () => {
  const fresh = new DatabaseSync(':memory:')
  let freshGlobCalls = 0
  try {
    fresh.function('glob', function globPoison(pattern, value) {
      freshGlobCalls += 1
      throw new Error(`glob poison ran for ${pattern} and ${value}`)
    })
    assert.equal(applyModule.initializeMemoryBundle(fresh, {
      clock() {
        return new Date(M1_07_TIMESTAMP)
      },
      idFactory() {
        return M1_07_UUID
      },
    }), undefined)
    assert.equal(freshGlobCalls, 0)
    assert.equal(readM107SemanticCounts(fresh).headSequence, 0)
  } finally {
    fresh.close()
  }

  const existing = new DatabaseSync(':memory:')
  let existingGlobCalls = 0
  let existingCallbackCalls = 0
  try {
    createM105Bundle(existing)
    existing.function('glob', function globFalse(_pattern, _value) {
      existingGlobCalls += 1
      return 0
    })
    assert.equal(
      existing.prepare(`
        SELECT 'memory_bundle_meta' GLOB 'memory_bundle_*' AS matches
      `).get().matches,
      0,
    )
    assert.equal(existingGlobCalls, 1)
    existingGlobCalls = 0
    assert.equal(applyModule.initializeMemoryBundle(existing, {
      clock() {
        existingCallbackCalls += 1
        throw new Error('existing clock must not run')
      },
      idFactory() {
        existingCallbackCalls += 1
        throw new Error('existing idFactory must not run')
      },
    }), undefined)
    assert.equal(existingCallbackCalls, 0)
    assert.equal(existingGlobCalls, 0)
  } finally {
    existing.close()
  }

  const coexistence = new DatabaseSync(':memory:')
  let coexistenceGlobCalls = 0
  let coexistenceCallbackCalls = 0
  try {
    createM105Bundle(coexistence)
    coexistence.exec(
      'CREATE TABLE main.unrelated_application_table (id INTEGER)',
    )
    coexistence.function('glob', function globTrue(_pattern, _value) {
      coexistenceGlobCalls += 1
      return 1
    })
    const options = {
      clock() {
        coexistenceCallbackCalls += 1
        throw new Error('coexisting clock must not run')
      },
      idFactory() {
        coexistenceCallbackCalls += 1
        throw new Error('coexisting idFactory must not run')
      },
    }
    assert.equal(
      applyModule.initializeMemoryBundle(coexistence, options),
      undefined,
    )
    coexistence.exec(
      'CREATE TABLE main.Memory_Bundle_Unknown (id INTEGER)',
    )
    assertBundleCode(
      () => applyModule.initializeMemoryBundle(coexistence, options),
      'bundle_layout_invalid',
    )
    assert.equal(coexistenceCallbackCalls, 0)
    assert.equal(coexistenceGlobCalls, 0)
    assert.equal(coexistence.isTransaction, false)
  } finally {
    coexistence.close()
  }
})

test('M1-07 first initialization busy is immediate, unretried, callback-free, and recoverable', () => {
  const directory = mkdtempSync(join(tmpdir(), 'palari-m107-busy-'))
  const dbPath = join(directory, 'bundle.sqlite')
  const blocker = new DatabaseSync(dbPath)
  const initializer = new DatabaseSync(dbPath)
  let callbackCalls = 0
  try {
    blocker.exec('PRAGMA busy_timeout=0; BEGIN IMMEDIATE;')
    const started = process.hrtime.bigint()
    assertBundleCode(
      () => applyModule.initializeMemoryBundle(initializer, {
        clock() {
          callbackCalls += 1
          return new Date(M1_07_TIMESTAMP)
        },
        idFactory() {
          callbackCalls += 1
          return M1_07_UUID
        },
      }),
      'bundle_busy',
    )
    const elapsedMilliseconds = Number(process.hrtime.bigint() - started) / 1e6
    assert.ok(elapsedMilliseconds < 2000, `busy failure took ${elapsedMilliseconds}ms`)
    assert.equal(callbackCalls, 0)
    assertM107NoBundleObjects(initializer)

    blocker.exec('ROLLBACK')
    assert.equal(applyModule.initializeMemoryBundle(initializer, {
      clock() {
        callbackCalls += 1
        return new Date(M1_07_TIMESTAMP)
      },
      idFactory() {
        callbackCalls += 1
        return M1_07_UUID
      },
    }), undefined)
    assert.equal(callbackCalls, 2)
  } finally {
    if (blocker.isTransaction) blocker.exec('ROLLBACK')
    initializer.close()
    blocker.close()
    rmSync(directory, { recursive: true, force: true })
  }
})

test('M1-07 rejects canonical-target TEMP triggers and creates only main objects under inert shadows', () => {
  const contaminated = new DatabaseSync(':memory:')
  try {
    contaminated.exec(`
      CREATE TEMP TABLE memory_bundle_meta (value INTEGER);
      CREATE TEMP TRIGGER canonical_shadow_trigger
      BEFORE INSERT ON memory_bundle_meta
      BEGIN SELECT 1; END;
    `)
    assertBundleCode(
      () => applyModule.initializeMemoryBundle(contaminated),
      'bundle_connection_invalid',
    )
    assertM107NoBundleObjects(contaminated)
  } finally {
    contaminated.close()
  }

  const shadowed = new DatabaseSync(':memory:')
  try {
    shadowed.exec(`
      CREATE TEMP TABLE memory_bundle_meta (value INTEGER);
      CREATE TEMP TABLE memory_bundle_events (value INTEGER);
      CREATE TEMP TABLE memory_bundle_atoms (value INTEGER);
    `)
    assert.equal(applyModule.initializeMemoryBundle(shadowed, {
      clock() {
        return new Date(M1_07_TIMESTAMP)
      },
      idFactory() {
        return M1_07_UUID
      },
    }), undefined)
    assert.equal(
      shadowed.prepare('SELECT schema_version FROM main.memory_bundle_meta').get().schema_version,
      'CDX-B1',
    )
    assert.equal(
      shadowed.prepare('SELECT count(*) AS count FROM temp.memory_bundle_meta').get().count,
      0,
    )
  } finally {
    shadowed.close()
  }
})

const M1_08_POLICY_AUTHORITY_ID = 'palari-kernel-admission@1'

function makeM108Id(prefix, nonce) {
  const suffix = nonce.toString(16).padStart(12, '0')
  return `${prefix}_00000000-0000-4000-8000-${suffix}`
}

function makeM108Envelope(kind, nonce, options = {}) {
  const input = makeM104ApplyEnvelope()
  input.decision.decisionId = makeM108Id('dec', nonce)
  input.decision.proposalId = makeM108Id('prp', nonce + 0x100)
  input.decision.memoryId = makeM108Id('mem', nonce + 0x200)

  if (kind === 'create-applied-promote') {
    input.decision.proposalKind = 'promote'
    input.decision.memoryType = 'working'
  } else if (kind === 'create-refused') {
    input.decision.outcome = 'refused'
    input.decision.reasonCode = options.reasonCode ?? 'below_threshold'
    input.decision.memoryId = null
    input.decision.authority = {
      kind: 'policy',
      authorityId: M1_08_POLICY_AUTHORITY_ID,
    }
    input.atom = null
    if (options.proposalKind === 'promote') {
      input.decision.proposalKind = 'promote'
      input.decision.memoryType = 'working'
    }
  } else if (kind === 'delete-applied') {
    input.decision.proposalKind = 'demote'
    input.decision.operation = 'delete'
    input.decision.memoryType = null
    input.decision.memoryId = options.memoryId ?? M1_04_IDS.memoryId
    input.atom = null
  } else if (kind === 'delete-refused') {
    input.decision.proposalKind = 'demote'
    input.decision.operation = 'delete'
    input.decision.outcome = 'refused'
    input.decision.reasonCode = options.reasonCode ?? 'missing_target'
    input.decision.memoryType = null
    input.decision.memoryId = options.memoryId ?? input.decision.memoryId
    input.decision.authority = {
      kind: 'policy',
      authorityId: M1_08_POLICY_AUTHORITY_ID,
    }
    input.atom = null
  }

  if (options.head !== undefined) {
    input.expectedHead = {
      streamId: options.head.streamId,
      sequence: options.head.sequence,
    }
  }
  return input
}

function readM108Head(db) {
  const row = db.prepare(`
    SELECT stream_id, head_sequence
    FROM main.memory_bundle_meta
    WHERE singleton = 1
  `).get()
  return { streamId: row.stream_id, sequence: row.head_sequence }
}

function snapshotM108Bundle(db) {
  return {
    meta: db.prepare(`
      SELECT singleton, schema_version, stream_id, head_sequence, created_at
      FROM main.memory_bundle_meta
      ORDER BY singleton
    `).all(),
    events: db.prepare(`
      SELECT
        sequence, stream_id, decision_id, proposal_id, proposal_kind,
        operation, outcome, reason_code, palari_id, user_id,
        authority_kind, authority_id, evidence_kind, memory_id, memory_type,
        effective_at, observed_at
      FROM main.memory_bundle_events
      ORDER BY sequence
    `).all(),
    atoms: db.prepare(`
      SELECT
        memory_id, stream_id, created_sequence, palari_id, user_id, type,
        content, keywords_json, initial_importance, confidence,
        provenance_kind, source_message_id, valid_from, created_at, fictional,
        content_checksum
      FROM main.memory_bundle_atoms
      ORDER BY memory_id COLLATE BINARY
    `).all(),
  }
}

function withM108Transaction(options, callback) {
  const db = new DatabaseSync(':memory:')
  try {
    createM105Bundle(db)
    if (options.seedActive === true) seedM105ActiveMemory(db)
    if (typeof options.beforeBegin === 'function') options.beforeBegin(db)
    db.exec('BEGIN IMMEDIATE')
    return callback(db)
  } finally {
    if (db.isOpen && db.isTransaction) db.exec('ROLLBACK')
    if (db.isOpen) db.close()
  }
}

function assertM108Failure(db, callback, code) {
  const before = snapshotM108Bundle(db)
  assertBundleCode(callback, code)
  assert.equal(db.isTransaction, true)
  assert.deepEqual(snapshotM108Bundle(db), before)
}

test('M1-08 enforces exact database brand, open state, and transaction ownership before input', () => {
  const trapInputCounter = { count: 0 }
  const trapInput = makeM104TrapProxy({}, trapInputCounter)
  assertBundleCode(
    () => applyModule.applyResolvedDecisionInTransaction({}, trapInput),
    'bundle_invalid_argument',
  )
  assert.equal(trapInputCounter.count, 0)

  const proxied = new DatabaseSync(':memory:')
  const dbProxyCounter = { count: 0 }
  try {
    const dbProxy = makeM104TrapProxy(proxied, dbProxyCounter)
    assertBundleCode(
      () => applyModule.applyResolvedDecisionInTransaction(dbProxy, trapInput),
      'bundle_invalid_argument',
    )
    assert.equal(dbProxyCounter.count, 0)
    assert.equal(trapInputCounter.count, 0)
  } finally {
    proxied.close()
  }

  const closed = new DatabaseSync(':memory:')
  closed.close()
  assertBundleCode(
    () => applyModule.applyResolvedDecisionInTransaction(closed, trapInput),
    'bundle_connection_invalid',
  )
  assert.equal(trapInputCounter.count, 0)

  const outside = new DatabaseSync(':memory:')
  try {
    createM105Bundle(outside)
    assertBundleCode(
      () => applyModule.applyResolvedDecisionInTransaction(outside, trapInput),
      'bundle_not_in_transaction',
    )
    assert.equal(trapInputCounter.count, 0)
  } finally {
    outside.close()
  }

  const transacting = new DatabaseSync(':memory:')
  const other = new DatabaseSync(':memory:')
  try {
    createM105Bundle(transacting)
    createM105Bundle(other)
    transacting.exec('BEGIN IMMEDIATE')
    assertBundleCode(
      () => applyModule.applyResolvedDecisionInTransaction(other, trapInput),
      'bundle_not_in_transaction',
    )
    assert.equal(transacting.isTransaction, true)
    assert.equal(other.isTransaction, false)
    assert.equal(trapInputCounter.count, 0)
  } finally {
    if (transacting.isTransaction) transacting.exec('ROLLBACK')
    transacting.close()
    other.close()
  }
})

test('M1-08 checks all PRAGMAs, TEMP triggers, and complete layout before reflecting on input', () => {
  const pragmaCases = [
    ['foreign_keys', 'PRAGMA foreign_keys=OFF'],
    ['busy_timeout', 'PRAGMA busy_timeout=1'],
    ['recursive_triggers', 'PRAGMA recursive_triggers=OFF'],
    ['ignore_check_constraints', 'PRAGMA ignore_check_constraints=ON'],
  ]
  for (const [name, sql] of pragmaCases) {
    const counter = { count: 0 }
    const input = makeM104TrapProxy({}, counter)
    withM108Transaction({ beforeBegin(db) { db.exec(sql) } }, (db) => {
      assertM108Failure(
        db,
        () => applyModule.applyResolvedDecisionInTransaction(db, input),
        'bundle_connection_invalid',
      )
      assert.equal(counter.count, 0, name)
    })
  }

  const preconditionPrecedenceCases = [
    {
      name: 'wrong PRAGMA before malformed layout',
      beforeBegin(db) {
        db.exec(`
          DROP TRIGGER main.memory_bundle_events_no_update;
          PRAGMA recursive_triggers=OFF;
        `)
      },
    },
    {
      name: 'canonical TEMP target before malformed layout',
      beforeBegin(db) {
        db.exec(`
          DROP TRIGGER main.memory_bundle_events_no_update;
          CREATE TEMP TRIGGER m108_precondition_precedence
          BEFORE INSERT ON main.memory_bundle_meta
          BEGIN SELECT 1; END;
        `)
      },
    },
  ]
  for (const { name, beforeBegin } of preconditionPrecedenceCases) {
    const counter = { count: 0 }
    const input = makeM104TrapProxy({}, counter)
    withM108Transaction({ beforeBegin }, (db) => {
      assertM108Failure(
        db,
        () => applyModule.applyResolvedDecisionInTransaction(db, input),
        'bundle_connection_invalid',
      )
      assert.equal(counter.count, 0, name)
    })
  }

  const tempCounter = { count: 0 }
  const tempInput = makeM104TrapProxy({}, tempCounter)
  withM108Transaction({
    beforeBegin(db) {
      db.exec(`
        CREATE TEMP TABLE memory_bundle_meta (value INTEGER);
        CREATE TEMP TRIGGER m108_canonical_target
        BEFORE INSERT ON memory_bundle_meta
        BEGIN SELECT 1; END;
      `)
    },
  }, (db) => {
    assertM108Failure(
      db,
      () => applyModule.applyResolvedDecisionInTransaction(db, tempInput),
      'bundle_connection_invalid',
    )
    assert.equal(tempCounter.count, 0)
  })

  const layoutCounter = { count: 0 }
  const layoutInput = makeM104TrapProxy({}, layoutCounter)
  withM108Transaction({
    beforeBegin(db) {
      db.exec('DROP TRIGGER main.memory_bundle_events_no_update')
    },
  }, (db) => {
    assertM108Failure(
      db,
      () => applyModule.applyResolvedDecisionInTransaction(db, layoutInput),
      'bundle_layout_invalid',
    )
    assert.equal(layoutCounter.count, 0)
  })
})

test('M1-08 validates expected-head shape and scalars before exact-head CAS and decision capture', () => {
  withM108Transaction({}, (db) => {
    const head = readM108Head(db)
    const laterCounter = { count: 0 }
    const laterDecision = makeM104TrapProxy({}, laterCounter)

    const headProxyCounter = { count: 0 }
    const headProxyInput = makeM108Envelope('create-applied', 0x810)
    headProxyInput.expectedHead = makeM104TrapProxy({}, headProxyCounter)
    headProxyInput.decision = laterDecision
    assertM108Failure(
      db,
      () => applyModule.applyResolvedDecisionInTransaction(db, headProxyInput),
      'bundle_invalid_argument',
    )
    assert.equal(headProxyCounter.count, 0)
    assert.equal(laterCounter.count, 0)

    const sequenceCounter = { count: 0 }
    const invalidStream = makeM108Envelope('create-applied', 0x811)
    invalidStream.expectedHead = {
      streamId: 'not-a-stream',
      sequence: makeM104TrapProxy({}, sequenceCounter),
    }
    invalidStream.decision = laterDecision
    assertM108Failure(
      db,
      () => applyModule.applyResolvedDecisionInTransaction(db, invalidStream),
      'bundle_invalid_argument',
    )
    assert.equal(sequenceCounter.count, 0)
    assert.equal(laterCounter.count, 0)

    const invalidSequence = makeM108Envelope('create-applied', 0x812)
    invalidSequence.expectedHead = { streamId: head.streamId, sequence: -1 }
    invalidSequence.decision = laterDecision
    assertM108Failure(
      db,
      () => applyModule.applyResolvedDecisionInTransaction(db, invalidSequence),
      'bundle_invalid_argument',
    )
    assert.equal(laterCounter.count, 0)

    for (const expectedHead of [
      { streamId: makeM108Id('str', 0x813), sequence: head.sequence },
      { streamId: head.streamId, sequence: head.sequence + 1 },
    ]) {
      const mismatch = makeM108Envelope('create-applied', 0x814)
      mismatch.expectedHead = expectedHead
      mismatch.decision = laterDecision
      assertM108Failure(
        db,
        () => applyModule.applyResolvedDecisionInTransaction(db, mismatch),
        'bundle_head_conflict',
      )
      assert.equal(laterCounter.count, 0)
    }

    const exact = makeM108Envelope('create-applied', 0x815, { head })
    exact.decision = laterDecision
    assertM108Failure(
      db,
      () => applyModule.applyResolvedDecisionInTransaction(db, exact),
      'bundle_invalid_decision',
    )
    assert.equal(laterCounter.count, 0)
  })
})

test('M1-08 accepts every canonical decision-matrix row in caller-owned transactions', () => {
  const cases = [
    { name: 'create applied permanent', kind: 'create-applied', nonce: 0x820 },
    { name: 'create applied promote', kind: 'create-applied-promote', nonce: 0x821 },
    ...[
      'below_threshold',
      'duplicate_current',
      'unauthorized',
      'unsupported',
    ].map((reasonCode, index) => ({
      name: `create refused ${reasonCode}`,
      kind: 'create-refused',
      nonce: 0x822 + index,
      reasonCode,
      proposalKind: index % 2 === 0 ? 'permanent' : 'promote',
    })),
    { name: 'delete applied', kind: 'delete-applied', nonce: 0x826, seedActive: true },
    ...['missing_target', 'unauthorized', 'unsupported'].map(
      (reasonCode, index) => ({
        name: `delete refused ${reasonCode}`,
        kind: 'delete-refused',
        nonce: 0x827 + index,
        reasonCode,
      }),
    ),
  ]

  for (const specification of cases) {
    withM108Transaction(
      { seedActive: specification.seedActive === true },
      (db) => {
        const head = readM108Head(db)
        const input = makeM108Envelope(
          specification.kind,
          specification.nonce,
          {
            head,
            reasonCode: specification.reasonCode,
            proposalKind: specification.proposalKind,
          },
        )
        assert.equal(
          applyModule.applyResolvedDecisionInTransaction(db, input),
          undefined,
          specification.name,
        )
        assert.equal(db.isTransaction, true, specification.name)
      },
    )
  }
})

test('M1-08 rejects every decision-matrix cell independently before transition state', () => {
  const archetypes = [
    {
      name: 'create applied',
      kind: 'create-applied',
      wrongProposalKind: 'demote',
      wrongReason: 'below_threshold',
      wrongMemoryId: null,
      wrongMemoryType: null,
      wrongAtom: null,
      wrongAuthority: {
        kind: 'policy',
        authorityId: M1_08_POLICY_AUTHORITY_ID,
      },
      partitionType: 'working',
    },
    {
      name: 'create refused',
      kind: 'create-refused',
      wrongProposalKind: 'demote',
      wrongReason: 'missing_target',
      wrongMemoryId: makeM108Id('mem', 0x840),
      wrongMemoryType: null,
      wrongAtom: makeM104ApplyEnvelope().atom,
      wrongAuthority: { kind: 'user', authorityId: 'user-1' },
      partitionType: 'working',
    },
    {
      name: 'delete applied',
      kind: 'delete-applied',
      wrongProposalKind: 'permanent',
      wrongReason: 'missing_target',
      wrongMemoryId: null,
      wrongMemoryType: 'preference',
      wrongAtom: makeM104ApplyEnvelope().atom,
      wrongAuthority: {
        kind: 'policy',
        authorityId: M1_08_POLICY_AUTHORITY_ID,
      },
    },
    {
      name: 'delete refused',
      kind: 'delete-refused',
      wrongProposalKind: 'permanent',
      wrongReason: 'below_threshold',
      wrongMemoryId: null,
      wrongMemoryType: 'preference',
      wrongAtom: makeM104ApplyEnvelope().atom,
      wrongAuthority: { kind: 'user', authorityId: 'user-1' },
    },
  ]

  withM108Transaction({}, (db) => {
    const head = readM108Head(db)
    let nonce = 0x850
    for (const archetype of archetypes) {
      const mutationFactories = [
        ['proposalKind', (input) => { input.decision.proposalKind = archetype.wrongProposalKind }],
        ['operation', (input) => { input.decision.operation = input.decision.operation === 'create' ? 'delete' : 'create' }],
        ['outcome', (input) => { input.decision.outcome = input.decision.outcome === 'applied' ? 'refused' : 'applied' }],
        ['reasonCode', (input) => { input.decision.reasonCode = archetype.wrongReason }],
        ['evidenceKind', (input) => { input.decision.evidenceKind = 'unsupported_evidence' }],
        ['memoryId', (input) => { input.decision.memoryId = archetype.wrongMemoryId }],
        ['memoryType', (input) => { input.decision.memoryType = archetype.wrongMemoryType }],
        ['atom', (input) => { input.atom = archetype.wrongAtom }],
      ]
      if (archetype.partitionType !== undefined) {
        mutationFactories.push([
          'proposal partition',
          (input) => { input.decision.memoryType = archetype.partitionType },
        ])
      }

      for (const [field, mutate] of mutationFactories) {
        const input = makeM108Envelope(archetype.kind, nonce, { head })
        nonce += 1
        mutate(input)
        assertM108Failure(
          db,
          () => applyModule.applyResolvedDecisionInTransaction(db, input),
          'bundle_invalid_decision',
        )
        assert.ok(field.length > 0)
      }

      const authorityInput = makeM108Envelope(archetype.kind, nonce, { head })
      nonce += 1
      authorityInput.decision.authority = archetype.wrongAuthority
      assertM108Failure(
        db,
        () => applyModule.applyResolvedDecisionInTransaction(db, authorityInput),
        'bundle_unauthorized',
      )
    }

    for (const [kind, nonce] of [
      ['create-applied-promote', 0x870],
      ['create-refused', 0x871],
    ]) {
      const partitionMismatch = makeM108Envelope(kind, nonce, {
        head,
        proposalKind: 'promote',
      })
      partitionMismatch.decision.memoryType = 'preference'
      assertM108Failure(
        db,
        () => applyModule.applyResolvedDecisionInTransaction(
          db,
          partitionMismatch,
        ),
        'bundle_invalid_decision',
      )
    }
  })
})

test('M1-08 stages atom shape before decision values but atom values after duplicates and authority', () => {
  withM108Transaction({ seedActive: true }, (db) => {
    const head = readM108Head(db)

    const malformedDecision = makeM108Envelope('create-applied', 0x880, { head })
    malformedDecision.decision = {}
    malformedDecision.atom = {}
    assertM108Failure(
      db,
      () => applyModule.applyResolvedDecisionInTransaction(db, malformedDecision),
      'bundle_invalid_decision',
    )

    const malformedAtom = makeM108Envelope('create-applied', 0x881, { head })
    malformedAtom.decision.decisionId = 'invalid-decision-id'
    malformedAtom.atom = {}
    assertM108Failure(
      db,
      () => applyModule.applyResolvedDecisionInTransaction(db, malformedAtom),
      'bundle_invalid_atom',
    )

    const malformedScope = makeM108Envelope('create-applied', 0x8811, { head })
    malformedScope.decision.scope = {}
    malformedScope.atom = {}
    assertM108Failure(
      db,
      () => applyModule.applyResolvedDecisionInTransaction(db, malformedScope),
      'bundle_invalid_decision',
    )

    const malformedAuthority = makeM108Envelope(
      'create-applied',
      0x8812,
      { head },
    )
    malformedAuthority.decision.authority = {}
    malformedAuthority.atom = {}
    assertM108Failure(
      db,
      () => applyModule.applyResolvedDecisionInTransaction(
        db,
        malformedAuthority,
      ),
      'bundle_invalid_decision',
    )

    const keywordCounter = { count: 0 }
    const keywordProxy = makeM104TrapProxy([], keywordCounter)
    const deferredAtom = {
      ...makeM104ApplyEnvelope().atom,
      content: { invalid: true },
      keywords: keywordProxy,
    }

    const invalidId = makeM108Envelope('create-applied', 0x882, { head })
    invalidId.decision.decisionId = 'invalid-decision-id'
    invalidId.atom = deferredAtom
    assertM108Failure(
      db,
      () => applyModule.applyResolvedDecisionInTransaction(db, invalidId),
      'bundle_invalid_decision',
    )
    assert.equal(keywordCounter.count, 0)

    const duplicateDecision = makeM108Envelope('create-applied', 0x883, { head })
    duplicateDecision.decision.decisionId = M1_04_IDS.decisionId
    duplicateDecision.decision.proposalId = M1_04_IDS.proposalId
    duplicateDecision.decision.authority = {
      kind: 'policy',
      authorityId: M1_08_POLICY_AUTHORITY_ID,
    }
    duplicateDecision.atom = deferredAtom
    assertM108Failure(
      db,
      () => applyModule.applyResolvedDecisionInTransaction(db, duplicateDecision),
      'bundle_duplicate_decision_id',
    )
    assert.equal(keywordCounter.count, 0)

    const duplicateProposal = makeM108Envelope('create-applied', 0x884, { head })
    duplicateProposal.decision.proposalId = M1_04_IDS.proposalId
    duplicateProposal.decision.authority = {
      kind: 'policy',
      authorityId: M1_08_POLICY_AUTHORITY_ID,
    }
    duplicateProposal.atom = deferredAtom
    assertM108Failure(
      db,
      () => applyModule.applyResolvedDecisionInTransaction(db, duplicateProposal),
      'bundle_duplicate_proposal_id',
    )
    assert.equal(keywordCounter.count, 0)

    const invalidDecisionBeforeDuplicates = makeM108Envelope(
      'create-applied',
      0x8841,
      { head },
    )
    invalidDecisionBeforeDuplicates.decision.evidenceKind = 'unsupported'
    invalidDecisionBeforeDuplicates.decision.decisionId = M1_04_IDS.decisionId
    invalidDecisionBeforeDuplicates.decision.proposalId = M1_04_IDS.proposalId
    invalidDecisionBeforeDuplicates.decision.authority = {
      kind: 'policy',
      authorityId: M1_08_POLICY_AUTHORITY_ID,
    }
    assertM108Failure(
      db,
      () => applyModule.applyResolvedDecisionInTransaction(
        db,
        invalidDecisionBeforeDuplicates,
      ),
      'bundle_invalid_decision',
    )

    const unauthorized = makeM108Envelope('create-applied', 0x885, { head })
    unauthorized.decision.authority = {
      kind: 'policy',
      authorityId: M1_08_POLICY_AUTHORITY_ID,
    }
    unauthorized.atom = deferredAtom
    assertM108Failure(
      db,
      () => applyModule.applyResolvedDecisionInTransaction(db, unauthorized),
      'bundle_unauthorized',
    )
    assert.equal(keywordCounter.count, 0)

    const invalidAtomScalar = makeM108Envelope('create-applied', 0x886, { head })
    invalidAtomScalar.atom = deferredAtom
    assertM108Failure(
      db,
      () => applyModule.applyResolvedDecisionInTransaction(db, invalidAtomScalar),
      'bundle_invalid_atom',
    )
    assert.equal(keywordCounter.count, 0)

    const invalidKeywords = makeM108Envelope('create-applied', 0x887, { head })
    invalidKeywords.atom.keywords = keywordProxy
    assertM108Failure(
      db,
      () => applyModule.applyResolvedDecisionInTransaction(db, invalidKeywords),
      'bundle_invalid_atom',
    )
    assert.equal(keywordCounter.count, 0)

    const nullOnly = makeM108Envelope('delete-refused', 0x888, { head })
    nullOnly.atom = {
      ...makeM104ApplyEnvelope().atom,
      keywords: keywordProxy,
    }
    assertM108Failure(
      db,
      () => applyModule.applyResolvedDecisionInTransaction(db, nullOnly),
      'bundle_invalid_decision',
    )
    assert.equal(keywordCounter.count, 0)

    const malformedNullOnlyAtom = makeM108Envelope(
      'delete-refused',
      0x889,
      { head },
    )
    malformedNullOnlyAtom.decision.evidenceKind = 'unsupported'
    malformedNullOnlyAtom.atom = {}
    assertM108Failure(
      db,
      () => applyModule.applyResolvedDecisionInTransaction(
        db,
        malformedNullOnlyAtom,
      ),
      'bundle_invalid_atom',
    )
  })
})

test('M1-08 validates representative decision and every atom scalar', () => {
  const cases = [
    ['decision id', (input) => { input.decision.decisionId = 'bad' }],
    ['proposal id', (input) => { input.decision.proposalId = 'bad' }],
    ['palari id', (input) => { input.decision.scope.palariId = 'Bad!' }],
    ['user id', (input) => { input.decision.scope.userId = '' }],
    ['memory id', (input) => { input.decision.memoryId = 'bad' }],
    ['memory type', (input) => { input.decision.memoryType = 'unknown' }],
    ['effective time', (input) => { input.decision.effectiveAt = 'bad' }],
    ['observed time', (input) => { input.decision.observedAt = 'bad' }],
    ['time order', (input) => {
      input.decision.effectiveAt = '2026-07-18T12:00:01.000Z'
      input.decision.observedAt = '2026-07-18T12:00:00.000Z'
    }],
  ]

  withM108Transaction({}, (db) => {
    const head = readM108Head(db)
    for (let index = 0; index < cases.length; index += 1) {
      const [name, mutate] = cases[index]
      const input = makeM108Envelope('create-applied', 0x890 + index, { head })
      mutate(input)
      assertM108Failure(
        db,
        () => applyModule.applyResolvedDecisionInTransaction(db, input),
        'bundle_invalid_decision',
      )
      assert.ok(name.length > 0)
    }

    const atomCases = [
      ['content', (atom) => { atom.content = { invalid: true } }],
      ['initial importance', (atom) => { atom.initialImportance = 2 }],
      ['confidence', (atom) => { atom.confidence = -1 }],
      ['provenance', (atom) => { atom.provenanceKind = 'unsupported' }],
      ['source message', (atom) => { atom.sourceMessageId = 'bad' }],
      ['fictional', (atom) => { atom.fictional = 0 }],
    ]
    for (let index = 0; index < atomCases.length; index += 1) {
      const [name, mutate] = atomCases[index]
      const input = makeM108Envelope('create-applied', 0x8a0 + index, { head })
      mutate(input.atom)
      assertM108Failure(
        db,
        () => applyModule.applyResolvedDecisionInTransaction(db, input),
        'bundle_invalid_atom',
      )
      assert.ok(name.length > 0)
    }

    const nonNullAndFictional = makeM108Envelope(
      'create-applied',
      0x8a6,
      { head },
    )
    nonNullAndFictional.atom.sourceMessageId = M1_04_IDS.sourceMessageId
    nonNullAndFictional.atom.fictional = true
    assert.equal(
      applyModule.applyResolvedDecisionInTransaction(db, nonNullAndFictional),
      undefined,
    )
    assert.equal(db.isTransaction, true)
  })
})

test('M1-08 uses captured Map and Set membership dispatch for staged state', () => {
  withM108Transaction({ seedActive: true }, (db) => {
    const head = readM108Head(db)
    const input = makeM108Envelope('delete-applied', 0x8b0, { head })
    const poisons = [
      [Map.prototype, 'get'],
      [Map.prototype, 'has'],
      [Set.prototype, 'has'],
    ].map(([target, key]) => ({
      target,
      key,
      descriptor: Object.getOwnPropertyDescriptor(target, key),
    }))
    let poisonCalls = 0
    let caught
    try {
      for (const { target, key, descriptor } of poisons) {
        Object.defineProperty(target, key, {
          ...descriptor,
          value() {
            poisonCalls += 1
            throw new Error(`poisoned ${key} ran`)
          },
        })
      }
      try {
        assert.equal(
          applyModule.applyResolvedDecisionInTransaction(db, input),
          undefined,
        )
      } catch (error) {
        caught = error
      }
    } finally {
      for (let index = poisons.length - 1; index >= 0; index -= 1) {
        const { target, key, descriptor } = poisons[index]
        Object.defineProperty(target, key, descriptor)
      }
    }
    assert.equal(caught, undefined)
    assert.equal(poisonCalls, 0)
    assert.equal(db.isTransaction, true)
  })
})

function makeM109ExpectedEventRow(input, sequence, streamId) {
  const { decision } = input
  return Object.assign(Object.create(null), {
    sequence,
    stream_id: streamId,
    decision_id: decision.decisionId,
    proposal_id: decision.proposalId,
    proposal_kind: decision.proposalKind,
    operation: decision.operation,
    outcome: decision.outcome,
    reason_code: decision.reasonCode,
    palari_id: decision.scope.palariId,
    user_id: decision.scope.userId,
    authority_kind: decision.authority.kind,
    authority_id: decision.authority.authorityId,
    evidence_kind: decision.evidenceKind,
    memory_id: decision.memoryId,
    memory_type: decision.memoryType,
    effective_at: decision.effectiveAt,
    observed_at: decision.observedAt,
  })
}

function makeM109ExpectedAtomRow(input, sequence, streamId) {
  const { atom, decision } = input
  return Object.assign(Object.create(null), codecModule.encodeAtomRow({
    memoryId: decision.memoryId,
    streamId,
    createdSequence: sequence,
    palariId: decision.scope.palariId,
    userId: decision.scope.userId,
    type: decision.memoryType,
    content: atom.content,
    keywords: atom.keywords,
    initialImportance: atom.initialImportance,
    confidence: atom.confidence,
    provenanceKind: atom.provenanceKind,
    sourceMessageId: atom.sourceMessageId,
    validFrom: decision.effectiveAt,
    createdAt: decision.observedAt,
    fictional: atom.fictional,
  }))
}

function readM109Counts(db) {
  return db.prepare(`
    SELECT
      (SELECT head_sequence FROM main.memory_bundle_meta WHERE singleton = 1)
        AS head_sequence,
      (SELECT count(*) FROM main.memory_bundle_events) AS event_count,
      (SELECT count(*) FROM main.memory_bundle_atoms) AS atom_count
  `).get()
}

test('M1-09 create-applied inserts exact content-free event and derived atom before advancing head', () => {
  withM108Transaction({}, (db) => {
    const head = readM108Head(db)
    const input = makeM108Envelope('create-applied', 0x900, { head })
    input.atom.sourceMessageId = M1_04_IDS.sourceMessageId
    input.atom.fictional = true
    const expectedEvent = makeM109ExpectedEventRow(input, 1, head.streamId)
    const expectedAtom = makeM109ExpectedAtomRow(input, 1, head.streamId)

    assert.equal(
      applyModule.applyResolvedDecisionInTransaction(db, input),
      undefined,
    )
    assert.equal(db.isTransaction, true)
    assert.equal(db.prepare('SELECT 1 AS value').get().value, 1)

    const state = snapshotM108Bundle(db)
    assert.deepEqual(state.events, [expectedEvent])
    assert.deepEqual(state.atoms, [expectedAtom])
    assert.equal(state.meta[0].head_sequence, 1)
    assert.equal(Object.hasOwn(state.events[0], 'content'), false)
    assert.equal(state.atoms[0].content_checksum, expectedAtom.content_checksum)
  })
})

test('M1-09 refusals append only their exact event and preserve atom state', () => {
  const cases = [
    {
      kind: 'create-refused',
      nonce: 0x901,
      reasonCode: 'duplicate_current',
      seedActive: false,
    },
    {
      kind: 'delete-refused',
      nonce: 0x902,
      reasonCode: 'unsupported',
      seedActive: true,
    },
  ]
  for (const specification of cases) {
    withM108Transaction({ seedActive: specification.seedActive }, (db) => {
      const before = snapshotM108Bundle(db)
      const head = readM108Head(db)
      const input = makeM108Envelope(
        specification.kind,
        specification.nonce,
        { head, reasonCode: specification.reasonCode },
      )

      assert.equal(
        applyModule.applyResolvedDecisionInTransaction(db, input),
        undefined,
      )
      const after = snapshotM108Bundle(db)
      assert.deepEqual(after.events, [
        ...before.events,
        makeM109ExpectedEventRow(input, head.sequence + 1, head.streamId),
      ])
      assert.deepEqual(after.atoms, before.atoms)
      assert.equal(after.meta[0].head_sequence, head.sequence + 1)
      assert.equal(db.isTransaction, true)
    })
  }
})

test('M1-09 delete-applied removes only the active atom and retains create/delete history', () => {
  withM108Transaction({ seedActive: true }, (db) => {
    const before = snapshotM108Bundle(db)
    const head = readM108Head(db)
    const input = makeM108Envelope('delete-applied', 0x903, { head })

    assert.equal(
      applyModule.applyResolvedDecisionInTransaction(db, input),
      undefined,
    )
    const after = snapshotM108Bundle(db)
    assert.deepEqual(after.events, [
      ...before.events,
      makeM109ExpectedEventRow(input, 2, head.streamId),
    ])
    assert.deepEqual(after.atoms, [])
    assert.equal(after.meta[0].head_sequence, 2)
    assert.deepEqual(
      after.events.map(({ operation }) => operation),
      ['create', 'delete'],
    )
    assert.equal(db.isTransaction, true)
  })
})

test('M1-09 outer commit and rollback control visibility and all three bundle mutations', () => {
  const directory = mkdtempSync(join(tmpdir(), 'palari-m109-visibility-'))
  const dbPath = join(directory, 'bundle.sqlite')
  const writer = new DatabaseSync(dbPath)
  let reader
  try {
    createM105Bundle(writer)
    reader = new DatabaseSync(dbPath)
    const head = readM108Head(writer)
    const input = makeM108Envelope('create-applied', 0x904, { head })

    writer.exec('BEGIN IMMEDIATE')
    assert.equal(
      applyModule.applyResolvedDecisionInTransaction(writer, input),
      undefined,
    )
    assert.deepEqual(readM109Counts(writer), Object.assign(Object.create(null), {
      head_sequence: 1,
      event_count: 1,
      atom_count: 1,
    }))
    assert.deepEqual(readM109Counts(reader), Object.assign(Object.create(null), {
      head_sequence: 0,
      event_count: 0,
      atom_count: 0,
    }))
    writer.exec('ROLLBACK')
    assert.deepEqual(readM109Counts(writer), Object.assign(Object.create(null), {
      head_sequence: 0,
      event_count: 0,
      atom_count: 0,
    }))

    writer.exec('BEGIN IMMEDIATE')
    assert.equal(
      applyModule.applyResolvedDecisionInTransaction(writer, input),
      undefined,
    )
    assert.deepEqual(readM109Counts(reader), Object.assign(Object.create(null), {
      head_sequence: 0,
      event_count: 0,
      atom_count: 0,
    }))
    writer.exec('COMMIT')
    assert.deepEqual(readM109Counts(reader), Object.assign(Object.create(null), {
      head_sequence: 1,
      event_count: 1,
      atom_count: 1,
    }))
  } finally {
    if (writer.isTransaction) writer.exec('ROLLBACK')
    reader?.close()
    writer.close()
    rmSync(directory, { recursive: true, force: true })
  }
})

test('M1-09 composes atomically with a test-owned CDX-M1 sentinel on a kernel connection', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'palari-m109-kernel-'))
  const statePath = join(directory, 'workspace-state.json')
  const sentinel = 'M1-09-transaction-composition-sentinel'
  const store = await createKernelStore({
    clock: () => new Date('2026-07-20T12:00:00.000Z'),
    memoryEnabled: true,
    statePath,
    workspaceId: 'm109-composition',
  })
  try {
    assert.equal(applyModule.initializeMemoryBundle(store.db, {
      clock: () => new Date(M1_07_TIMESTAMP),
      idFactory: () => M1_07_UUID,
    }), undefined)
    const head = readM108Head(store.db)
    const input = makeM108Envelope('create-applied', 0x905, { head })
    const writeSentinel = () => store.db.prepare(`
      INSERT INTO main.memory_migrations (id, applied_at) VALUES (?, ?)
    `).run(sentinel, M1_07_TIMESTAMP)
    const sentinelCount = () => store.db.prepare(`
      SELECT count(*) AS count FROM main.memory_migrations WHERE id = ?
    `).get(sentinel).count

    store.db.exec('BEGIN IMMEDIATE')
    writeSentinel()
    assert.equal(
      applyModule.applyResolvedDecisionInTransaction(store.db, input),
      undefined,
    )
    store.db.exec('ROLLBACK')
    assert.equal(sentinelCount(), 0)
    assert.deepEqual(readM109Counts(store.db), Object.assign(Object.create(null), {
      head_sequence: 0,
      event_count: 0,
      atom_count: 0,
    }))

    store.db.exec('BEGIN IMMEDIATE')
    writeSentinel()
    assert.equal(
      applyModule.applyResolvedDecisionInTransaction(store.db, input),
      undefined,
    )
    store.db.exec('COMMIT')
    assert.equal(sentinelCount(), 1)
    assert.deepEqual(readM109Counts(store.db), Object.assign(Object.create(null), {
      head_sequence: 1,
      event_count: 1,
      atom_count: 1,
    }))
  } finally {
    if (store.db.isTransaction) store.db.exec('ROLLBACK')
    store.close()
    rmSync(directory, { recursive: true, force: true })
  }
})

test('M1-09 enforces prospective time, state, scope, and authority precedence', () => {
  withM108Transaction({ seedActive: true }, (db) => {
    const head = readM108Head(db)

    const decreasing = makeM108Envelope('delete-applied', 0x910, { head })
    decreasing.decision.scope.palariId = 'palari-b'
    decreasing.decision.scope.userId = 'user-2'
    decreasing.decision.authority.authorityId = 'user-2'
    decreasing.decision.effectiveAt = '2026-07-18T11:59:00.000Z'
    decreasing.decision.observedAt = '2026-07-18T11:59:59.999Z'
    assertM108Failure(
      db,
      () => applyModule.applyResolvedDecisionInTransaction(db, decreasing),
      'bundle_invalid_transition',
    )

    const activeReuse = makeM108Envelope('create-applied', 0x912, { head })
    activeReuse.decision.memoryId = M1_04_IDS.memoryId
    assertM108Failure(
      db,
      () => applyModule.applyResolvedDecisionInTransaction(db, activeReuse),
      'bundle_id_reuse',
    )

    const crossScope = makeM108Envelope('delete-applied', 0x913, { head })
    crossScope.decision.scope.palariId = 'palari-b'
    assertM108Failure(
      db,
      () => applyModule.applyResolvedDecisionInTransaction(db, crossScope),
      'bundle_unauthorized',
    )

    const crossUserScope = makeM108Envelope('delete-applied', 0x9131, { head })
    crossUserScope.decision.scope.userId = 'user-2'
    crossUserScope.decision.authority.authorityId = 'user-2'
    assertM108Failure(
      db,
      () => applyModule.applyResolvedDecisionInTransaction(db, crossUserScope),
      'bundle_unauthorized',
    )
  })

  withM108Transaction({}, (db) => {
    const head = readM108Head(db)
    const missing = makeM108Envelope('delete-applied', 0x914, { head })
    assertM108Failure(
      db,
      () => applyModule.applyResolvedDecisionInTransaction(db, missing),
      'bundle_invalid_transition',
    )

    const unauthorized = makeM108Envelope('create-applied', 0x915, { head })
    unauthorized.decision.authority.authorityId = 'user-2'
    assertM108Failure(
      db,
      () => applyModule.applyResolvedDecisionInTransaction(db, unauthorized),
      'bundle_unauthorized',
    )

    const malformed = makeM108Envelope('create-applied', 0x916, { head })
    malformed.decision.authority.authorityId = 42
    assertM108Failure(
      db,
      () => applyModule.applyResolvedDecisionInTransaction(db, malformed),
      'bundle_invalid_decision',
    )
  })
})

test('M1-09 retained scope precedes deleted state and create ids remain retired', () => {
  withM108Transaction({ seedActive: true }, (db) => {
    const firstHead = readM108Head(db)
    const deletion = makeM108Envelope('delete-applied', 0x920, {
      head: firstHead,
    })
    assert.equal(
      applyModule.applyResolvedDecisionInTransaction(db, deletion),
      undefined,
    )
    const deletedHead = readM108Head(db)

    const crossScope = makeM108Envelope('delete-applied', 0x921, {
      head: deletedHead,
    })
    crossScope.decision.scope.palariId = 'palari-b'
    assertM108Failure(
      db,
      () => applyModule.applyResolvedDecisionInTransaction(db, crossScope),
      'bundle_unauthorized',
    )

    const crossUserScope = makeM108Envelope('delete-applied', 0x9211, {
      head: deletedHead,
    })
    crossUserScope.decision.scope.userId = 'user-2'
    crossUserScope.decision.authority.authorityId = 'user-2'
    assertM108Failure(
      db,
      () => applyModule.applyResolvedDecisionInTransaction(db, crossUserScope),
      'bundle_unauthorized',
    )

    const alreadyDeleted = makeM108Envelope('delete-applied', 0x922, {
      head: deletedHead,
    })
    assertM108Failure(
      db,
      () => applyModule.applyResolvedDecisionInTransaction(db, alreadyDeleted),
      'bundle_invalid_transition',
    )

    const retiredId = makeM108Envelope('create-applied', 0x923, {
      head: deletedHead,
    })
    retiredId.decision.memoryId = M1_04_IDS.memoryId
    assertM108Failure(
      db,
      () => applyModule.applyResolvedDecisionInTransaction(db, retiredId),
      'bundle_id_reuse',
    )
  })
})

function captureM112BoundaryCode(label, callback) {
  let thrown
  try {
    callback()
  } catch (error) {
    thrown = error
  }
  assert.notEqual(thrown, undefined, `${label} must throw`)
  assert.equal(
    Object.getPrototypeOf(thrown),
    applyModule.MemoryBundleError.prototype,
    label,
  )
  assert.equal(thrown.name, 'MemoryBundleError', label)
  assert.equal(typeof thrown.code, 'string', label)
  return thrown.code
}

function withM112File(prefix, callback) {
  const directory = mkdtempSync(join(tmpdir(), prefix))
  const dbPath = join(directory, 'bundle.sqlite')
  try {
    return callback(dbPath)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

function throwM112PublicOpen(options = {}) {
  return withM112File('palari-m112-code-', (dbPath) => {
    const db = new DatabaseSync(dbPath)
    try {
      if (options.empty !== true) {
        createM105Bundle(db, options.bundleOptions)
      }
    } finally {
      db.close()
    }
    const handle = publicModule.openMemoryBundle({ dbPath })
    try {
      if (options.afterOpen === 'closed') {
        handle.close()
        return handle.verify()
      }
      return handle
    } finally {
      handle.close()
    }
  })
}

function throwM112Apply({ seedActive = false, begin = true, mutate }) {
  const db = new DatabaseSync(':memory:')
  try {
    createM105Bundle(db, { seedActive })
    if (begin) db.exec('BEGIN IMMEDIATE')
    const head = readM108Head(db)
    const input = makeM108Envelope('create-applied', 0x1120, { head })
    mutate(input, head)
    return applyModule.applyResolvedDecisionInTransaction(db, input)
  } finally {
    if (db.isTransaction) db.exec('ROLLBACK')
    db.close()
  }
}

test('M1-12 exercises all 19 stable failure codes through contractual boundaries', () => {
  const cases = [
    {
      code: 'bundle_invalid_argument',
      trigger() {
        applyModule.initializeMemoryBundle({})
      },
    },
    {
      code: 'bundle_busy',
      trigger() {
        return withM112File('palari-m112-busy-', (dbPath) => {
          const locker = new DatabaseSync(dbPath)
          const contender = new DatabaseSync(dbPath)
          try {
            locker.exec('BEGIN IMMEDIATE')
            return applyModule.initializeMemoryBundle(contender)
          } finally {
            if (locker.isTransaction) locker.exec('ROLLBACK')
            contender.close()
            locker.close()
          }
        })
      },
    },
    {
      code: 'bundle_layout_invalid',
      trigger() {
        return throwM112PublicOpen({ empty: true })
      },
    },
    {
      code: 'bundle_schema_unsupported',
      trigger() {
        return throwM112PublicOpen({
          bundleOptions: { meta: { schema_version: 'CDX-B2' } },
        })
      },
    },
    {
      code: 'bundle_connection_invalid',
      trigger() {
        const db = new DatabaseSync(':memory:')
        db.close()
        applyModule.initializeMemoryBundle(db)
      },
    },
    {
      code: 'bundle_not_in_transaction',
      trigger() {
        return throwM112Apply({ begin: false, mutate() {} })
      },
    },
    {
      code: 'bundle_invalid_decision',
      trigger() {
        return throwM112Apply({
          mutate(input) {
            input.decision.proposalKind = 'unsupported'
          },
        })
      },
    },
    {
      code: 'bundle_duplicate_decision_id',
      trigger() {
        return throwM112Apply({
          seedActive: true,
          mutate(input) {
            input.decision.decisionId = M1_04_IDS.decisionId
          },
        })
      },
    },
    {
      code: 'bundle_duplicate_proposal_id',
      trigger() {
        return throwM112Apply({
          seedActive: true,
          mutate(input) {
            input.decision.proposalId = M1_04_IDS.proposalId
          },
        })
      },
    },
    {
      code: 'bundle_invalid_atom',
      trigger() {
        return throwM112Apply({
          mutate(input) {
            input.atom.initialImportance = 2
          },
        })
      },
    },
    {
      code: 'bundle_invalid_transition',
      trigger() {
        return throwM112Apply({
          mutate(input, head) {
            Object.assign(
              input,
              makeM108Envelope('delete-applied', 0x1121, { head }),
            )
          },
        })
      },
    },
    {
      code: 'bundle_head_conflict',
      trigger() {
        return throwM112Apply({
          mutate(input) {
            input.expectedHead.sequence = 1
          },
        })
      },
    },
    {
      code: 'bundle_meta_mismatch',
      trigger() {
        return throwM112PublicOpen({
          bundleOptions: { meta: { head_sequence: 1 } },
        })
      },
    },
    {
      code: 'bundle_missing_atom',
      trigger() {
        return throwM112PublicOpen({
          bundleOptions: {
            meta: { head_sequence: 1 },
            beforeTriggers(db) {
              insertM105EventRow(db)
            },
          },
        })
      },
    },
    {
      code: 'bundle_orphan_atom',
      trigger() {
        return throwM112PublicOpen({
          bundleOptions: {
            meta: { head_sequence: 1 },
            beforeTriggers(db) {
              insertM105EventRow(db, makeM104EventRow({
                outcome: 'refused',
                reason_code: 'below_threshold',
                authority_kind: 'policy',
                authority_id: M1_08_POLICY_AUTHORITY_ID,
                memory_id: null,
              }))
              insertM105AtomRow(db)
            },
          },
        })
      },
    },
    {
      code: 'bundle_id_reuse',
      trigger() {
        return throwM112Apply({
          seedActive: true,
          mutate(input) {
            input.decision.memoryId = M1_04_IDS.memoryId
          },
        })
      },
    },
    {
      code: 'bundle_unauthorized',
      trigger() {
        return throwM112Apply({
          seedActive: true,
          mutate(input, head) {
            const deletion = makeM108Envelope('delete-applied', 0x1122, { head })
            deletion.decision.scope.userId = 'user-2'
            deletion.decision.authority.authorityId = 'user-2'
            Object.assign(input, deletion)
          },
        })
      },
    },
    {
      code: 'bundle_storage_error',
      trigger() {
        return withM112File('palari-m112-storage-', (dbPath) => {
          new DatabaseSync(dbPath).close()
          const db = new DatabaseSync(dbPath, { readOnly: true })
          try {
            return applyModule.initializeMemoryBundle(db)
          } finally {
            db.close()
          }
        })
      },
    },
    {
      code: 'bundle_closed',
      trigger() {
        return throwM112PublicOpen({ afterOpen: 'closed' })
      },
    },
  ]

  assert.deepEqual(cases.map(({ code }) => code), EXPECTED_CODES)
  const observedCodes = cases.map(({ code, trigger }) =>
    captureM112BoundaryCode(code, trigger))
  assert.deepEqual(observedCodes, EXPECTED_CODES)
})

test('M1-12 fixes apply mixed-fault precedence before any mutation', () => {
  withM108Transaction({ seedActive: true }, (db) => {
    const head = readM108Head(db)

    const duplicateBoth = makeM108Envelope('create-applied', 0x1130, { head })
    duplicateBoth.decision.decisionId = M1_04_IDS.decisionId
    duplicateBoth.decision.proposalId = M1_04_IDS.proposalId
    assertM108Failure(
      db,
      () => applyModule.applyResolvedDecisionInTransaction(db, duplicateBoth),
      'bundle_duplicate_decision_id',
    )

    const atomShapeFirst = makeM108Envelope('create-applied', 0x1131, { head })
    atomShapeFirst.decision.decisionId = 'not-a-decision-id'
    atomShapeFirst.atom = {}
    assertM108Failure(
      db,
      () => applyModule.applyResolvedDecisionInTransaction(db, atomShapeFirst),
      'bundle_invalid_atom',
    )

    const decisionValueFirst = makeM108Envelope('create-applied', 0x1132, { head })
    decisionValueFirst.decision.decisionId = 'not-a-decision-id'
    decisionValueFirst.atom.content = { malformed: true }
    assertM108Failure(
      db,
      () => applyModule.applyResolvedDecisionInTransaction(db, decisionValueFirst),
      'bundle_invalid_decision',
    )

    const invalidHeadFirst = makeM108Envelope('create-applied', 0x1133, { head })
    invalidHeadFirst.expectedHead = {
      streamId: makeM108Id('str', 0x1134),
      sequence: -1,
    }
    assertM108Failure(
      db,
      () => applyModule.applyResolvedDecisionInTransaction(db, invalidHeadFirst),
      'bundle_invalid_argument',
    )
  })
})

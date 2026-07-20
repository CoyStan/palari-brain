import assert from 'node:assert/strict'
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { test } from 'node:test'

import { MemoryBundleError } from '../src/memory-bundle-apply.mjs'
import { openMemoryBundle } from '../src/memory-bundle.mjs'
import {
  EXPECTED_CAPABILITIES,
  M1_04_IDS,
  createM105Bundle,
  makeM104AtomRow,
  makeM104CanonicalAtom,
} from './helpers/memory-bundle-fixtures.mjs'

function assertM110BundleCode(callback, expectedCode) {
  assert.throws(callback, (error) => {
    assert.equal(Object.getPrototypeOf(error), MemoryBundleError.prototype)
    assert.equal(error.name, 'MemoryBundleError')
    assert.equal(error.code, expectedCode)
    return true
  })
}

function withM110Directory(callback) {
  const directory = mkdtempSync(join(tmpdir(), 'palari-m110-public-'))
  try {
    return callback(directory)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

function createM110BundleFile(dbPath, options = {}) {
  const db = new DatabaseSync(dbPath)
  try {
    createM105Bundle(db, { seedActive: options.seedActive === true })
  } finally {
    db.close()
  }
}

function makeM110TrapProxy(value, counter) {
  return new Proxy(value, {
    defineProperty() {
      counter.count += 1
      throw new Error('receiver defineProperty trap ran')
    },
    deleteProperty() {
      counter.count += 1
      throw new Error('receiver deleteProperty trap ran')
    },
    get() {
      counter.count += 1
      throw new Error('receiver get trap ran')
    },
    getOwnPropertyDescriptor() {
      counter.count += 1
      throw new Error('receiver descriptor trap ran')
    },
    getPrototypeOf() {
      counter.count += 1
      throw new Error('receiver prototype trap ran')
    },
    has() {
      counter.count += 1
      throw new Error('receiver has trap ran')
    },
    ownKeys() {
      counter.count += 1
      throw new Error('receiver ownKeys trap ran')
    },
    set() {
      counter.count += 1
      throw new Error('receiver set trap ran')
    },
  })
}

function assertM110ExactEnumerableKeys(value, expectedKeys) {
  const sortedExpected = [...expectedKeys].sort()
  const ownKeys = Reflect.ownKeys(value)
  assert.equal(ownKeys.every((key) => typeof key === 'string'), true)
  assert.deepEqual([...ownKeys].sort(), sortedExpected)
  assert.deepEqual(Object.keys(value).sort(), sortedExpected)
}

test('M1-10 rejects malformed options and paths before operational SQLite access', () => {
  withM110Directory((directory) => {
    const dbPath = join(directory, 'valid.sqlite')
    const proxyCounter = { count: 0 }
    const proxy = makeM110TrapProxy({ dbPath }, proxyCounter)
    assertM110BundleCode(() => openMemoryBundle(proxy), 'bundle_invalid_argument')
    assert.equal(proxyCounter.count, 0)

    const revokedCounter = { count: 0 }
    const revocable = Proxy.revocable(
      { dbPath },
      {
        get() {
          revokedCounter.count += 1
          throw new Error('revoked option trap ran')
        },
      },
    )
    revocable.revoke()
    assertM110BundleCode(
      () => openMemoryBundle(revocable.proxy),
      'bundle_invalid_argument',
    )
    assert.equal(revokedCounter.count, 0)

    let accessorCalls = 0
    const accessor = {}
    Object.defineProperty(accessor, 'dbPath', {
      enumerable: true,
      configurable: true,
      get() {
        accessorCalls += 1
        return dbPath
      },
    })
    const symbol = Symbol('extra')
    const withSymbol = { dbPath }
    withSymbol[symbol] = true
    const nonEnumerable = {}
    Object.defineProperty(nonEnumerable, 'dbPath', {
      value: dbPath,
      enumerable: false,
      configurable: true,
      writable: true,
    })
    const inherited = Object.create({ dbPath })
    const customPrototype = Object.assign(
      Object.create({ marker: true }),
      { dbPath },
    )
    const wrongPrototype = Object.assign(Object.create(null), { dbPath })
    const shapeCases = [
      undefined,
      null,
      7,
      function invalidOptions() {},
      [],
      {},
      { dbPath, extra: true },
      accessor,
      withSymbol,
      nonEnumerable,
      inherited,
      customPrototype,
      wrongPrototype,
    ]
    for (const value of shapeCases) {
      assertM110BundleCode(
        () => openMemoryBundle(value),
        'bundle_invalid_argument',
      )
    }
    assert.equal(accessorCalls, 0)

    const pathCases = [
      '',
      'relative.sqlite',
      ':memory:',
      'file:///tmp/palari.sqlite?mode=rw',
      `${dbPath}\0suffix`,
      new URL('file:///tmp/palari.sqlite'),
      Buffer.from(dbPath),
      new String(dbPath),
      42,
      null,
      undefined,
    ]
    for (const value of pathCases) {
      assertM110BundleCode(
        () => openMemoryBundle({ dbPath: value }),
        'bundle_invalid_argument',
      )
    }
    assert.equal(existsSync(dbPath), false)
  })
})

test('M1-10 recovery never creates missing paths and preserves invalid existing files', () => {
  withM110Directory((directory) => {
    const missing = join(directory, 'missing.sqlite')
    assertM110BundleCode(
      () => openMemoryBundle({ dbPath: missing }),
      'bundle_storage_error',
    )
    assert.equal(existsSync(missing), false)

    const nonDatabase = join(directory, 'not-a-database.sqlite')
    const bytes = Buffer.from('this is not a sqlite database')
    writeFileSync(nonDatabase, bytes)
    assertM110BundleCode(
      () => openMemoryBundle({ dbPath: nonDatabase }),
      'bundle_storage_error',
    )
    assert.deepEqual(readFileSync(nonDatabase), bytes)

    const empty = join(directory, 'empty.sqlite')
    const emptyDb = new DatabaseSync(empty)
    emptyDb.close()
    const emptyBefore = readFileSync(empty)
    assertM110BundleCode(
      () => openMemoryBundle({ dbPath: empty }),
      'bundle_layout_invalid',
    )
    assert.deepEqual(readFileSync(empty), emptyBefore)

    const partial = join(directory, 'partial.sqlite')
    const partialDb = new DatabaseSync(partial)
    partialDb.exec('CREATE TABLE memory_bundle_unknown (id INTEGER)')
    partialDb.close()
    const partialBefore = readFileSync(partial)
    assertM110BundleCode(
      () => openMemoryBundle({ dbPath: partial }),
      'bundle_layout_invalid',
    )
    assert.deepEqual(readFileSync(partial), partialBefore)
    const reopened = new DatabaseSync(partial)
    try {
      assert.deepEqual(
        reopened.prepare(`
          SELECT type, name FROM main.sqlite_schema
          WHERE name = 'memory_bundle_unknown'
        `).all(),
        [Object.assign(Object.create(null), {
          type: 'table',
          name: 'memory_bundle_unknown',
        })],
      )
    } finally {
      reopened.close()
    }
  })
})

test('M1-10 opens encoded absolute filenames without treating path bytes as URI syntax', () => {
  withM110Directory((directory) => {
    const dbPath = join(
      directory,
      'bundle space # percent% question? unicode-é-東京.sqlite',
    )
    createM110BundleFile(dbPath)
    const bytesBefore = readFileSync(dbPath)
    const entriesBefore = readdirSync(directory).sort()
    const handle = openMemoryBundle({ dbPath })
    try {
      assert.deepEqual(handle.verify().checkpoint, {
        streamId: M1_04_IDS.streamId,
        sequence: 0,
      })
    } finally {
      handle.close()
    }
    assert.equal(existsSync(dbPath), true)
    assert.deepEqual(readFileSync(dbPath), bytesBefore)
    assert.deepEqual(readdirSync(directory).sort(), entriesBefore)
  })
})

test('M1-10 returns an exact frozen receiver-independent handle with shared capabilities', () => {
  withM110Directory((directory) => {
    const pathA = join(directory, 'a.sqlite')
    const pathB = join(directory, 'b.sqlite')
    const pathC = join(directory, 'c.sqlite')
    createM110BundleFile(pathA)
    createM110BundleFile(pathB)
    createM110BundleFile(pathC)
    const handleA = openMemoryBundle({ dbPath: pathA })
    const handleB = openMemoryBundle({ dbPath: pathB })
    const handleC = openMemoryBundle({ dbPath: pathC })
    try {
      assertM110ExactEnumerableKeys(handleA, [
        'capabilities',
        'close',
        'replay',
        'verify',
      ])
      assert.equal(Object.isFrozen(handleA), true)
      assertM110ExactEnumerableKeys(handleA.capabilities, [
        'sourceOfTruth',
        'physicalDeletion',
        'deletionProvable',
        'signed',
        'cryptographicAudit',
        'externalAnchorRequired',
      ])
      assert.deepEqual(handleA.capabilities, EXPECTED_CAPABILITIES)
      assert.equal(Object.isFrozen(handleA.capabilities), true)
      assert.equal(handleA.capabilities, handleB.capabilities)

      const verification = handleA.verify()
      const replay = handleA.replay()
      assertM110ExactEnumerableKeys(verification, [
        'checkpoint',
        'capabilities',
      ])
      assertM110ExactEnumerableKeys(replay, [
        'checkpoint',
        'memories',
        'capabilities',
      ])
      assertM110ExactEnumerableKeys(verification.checkpoint, [
        'streamId',
        'sequence',
      ])
      assertM110ExactEnumerableKeys(replay.checkpoint, [
        'streamId',
        'sequence',
      ])
      assert.equal(verification.capabilities, handleA.capabilities)
      assert.equal(replay.capabilities, handleA.capabilities)

      const receiverCounter = { count: 0 }
      const receiver = makeM110TrapProxy({}, receiverCounter)
      const verifyA = handleA.verify
      const replayA = handleA.replay
      assert.deepEqual(verifyA(), handleA.verify())
      assert.deepEqual(verifyA.call(handleB), handleA.verify())
      assert.deepEqual(verifyA.call(receiver), handleA.verify())
      assert.deepEqual(replayA(), handleA.replay())
      assert.deepEqual(replayA.call(receiver), handleA.replay())
      assert.equal(receiverCounter.count, 0)

      assert.equal(handleA.close.call(handleB), undefined)
      assertM110BundleCode(() => handleA.verify(), 'bundle_closed')
      assertM110BundleCode(() => verifyA.call(handleB), 'bundle_closed')
      assert.deepEqual(handleB.verify().checkpoint, {
        streamId: M1_04_IDS.streamId,
        sequence: 0,
      })
      assert.equal(handleA.capabilities, handleB.capabilities)

      const closeC = handleC.close
      assert.equal(closeC(), undefined)
      assert.equal(closeC.call(receiver), undefined)
      assert.equal(receiverCounter.count, 0)
      assertM110BundleCode(() => handleC.replay(), 'bundle_closed')
    } finally {
      handleA.close()
      handleB.close()
      handleC.close()
    }
  })
})

test('M1-10 verify and replay return fresh exact values and close is idempotent', () => {
  withM110Directory((directory) => {
    const dbPath = join(directory, 'active.sqlite')
    createM110BundleFile(dbPath, { seedActive: true })
    const bytesBefore = readFileSync(dbPath)
    const entriesBefore = readdirSync(directory).sort()
    const handle = openMemoryBundle({ dbPath })

    const verificationA = handle.verify()
    const verificationB = handle.verify()
    assert.deepEqual(verificationB, verificationA)
    assert.notStrictEqual(verificationB, verificationA)
    assert.notStrictEqual(verificationB.checkpoint, verificationA.checkpoint)
    assert.equal(verificationA.capabilities, handle.capabilities)
    const verificationC = handle.verify()
    assert.deepEqual(verificationC, verificationB)
    assert.notStrictEqual(verificationC, verificationA)
    assert.notStrictEqual(verificationC, verificationB)
    assert.notStrictEqual(verificationC.checkpoint, verificationA.checkpoint)
    assert.notStrictEqual(verificationC.checkpoint, verificationB.checkpoint)

    const replayA = handle.replay()
    const replayB = handle.replay()
    assert.deepEqual(replayB, replayA)
    assert.notStrictEqual(replayB, replayA)
    assert.notStrictEqual(replayB.checkpoint, replayA.checkpoint)
    assert.notStrictEqual(replayB.memories, replayA.memories)
    assert.notStrictEqual(replayB.memories[0], replayA.memories[0])
    assert.notStrictEqual(
      replayB.memories[0].keywords,
      replayA.memories[0].keywords,
    )
    assertM110ExactEnumerableKeys(replayA.memories[0], [
      'memoryId',
      'streamId',
      'createdSequence',
      'palariId',
      'userId',
      'type',
      'content',
      'keywords',
      'initialImportance',
      'confidence',
      'provenanceKind',
      'sourceMessageId',
      'validFrom',
      'createdAt',
      'fictional',
      'contentChecksum',
    ])
    assert.deepEqual(replayA.memories[0], {
      ...makeM104CanonicalAtom(),
      contentChecksum: makeM104AtomRow().content_checksum,
    })
    assert.deepEqual(replayA.checkpoint, {
      streamId: M1_04_IDS.streamId,
      sequence: 1,
    })
    assert.equal(replayA.capabilities, handle.capabilities)

    const replayC = handle.replay()
    assert.deepEqual(replayC, replayB)
    assert.notStrictEqual(replayC, replayA)
    assert.notStrictEqual(replayC, replayB)
    assert.notStrictEqual(replayC.checkpoint, replayA.checkpoint)
    assert.notStrictEqual(replayC.checkpoint, replayB.checkpoint)
    assert.notStrictEqual(replayC.memories, replayA.memories)
    assert.notStrictEqual(replayC.memories, replayB.memories)
    assert.notStrictEqual(replayC.memories[0], replayA.memories[0])
    assert.notStrictEqual(replayC.memories[0], replayB.memories[0])
    assert.notStrictEqual(
      replayC.memories[0].keywords,
      replayA.memories[0].keywords,
    )
    assert.notStrictEqual(
      replayC.memories[0].keywords,
      replayB.memories[0].keywords,
    )
    assert.equal(replayC.checkpoint.sequence, 1)

    assert.equal(handle.close(), undefined)
    assert.equal(handle.close(), undefined)
    assert.equal(handle.capabilities, replayC.capabilities)
    assertM110BundleCode(() => handle.verify(), 'bundle_closed')
    assertM110BundleCode(() => handle.replay(), 'bundle_closed')
    assert.equal(handle.close(), undefined)
    assert.deepEqual(readFileSync(dbPath), bytesBefore)
    assert.deepEqual(readdirSync(directory).sort(), entriesBefore)
  })
})

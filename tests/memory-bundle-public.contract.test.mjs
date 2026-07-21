import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  applyResolvedDecisionInTransaction,
  initializeMemoryBundle,
  MemoryBundleError,
} from '../src/memory-bundle-apply.mjs'
import { openMemoryBundle } from '../src/memory-bundle.mjs'
import {
  EXPECTED_CAPABILITIES,
  M1_04_IDS,
  createM105Bundle,
  makeM104ApplyEnvelope,
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

const M1_13_CHILD_PATH = fileURLToPath(new URL(
  './fixtures/memory-bundle-hot-journal-child.mjs',
  import.meta.url,
))
const M1_13_SPILL_ROW_COUNT = 768
const M1_13_SPILL_PAYLOAD_BYTES = 3000
const M1_13_MINIMUM_JOURNAL_BYTES = 2 * 1024 * 1024
const M1_13_READY_TIMEOUT_MS = 10_000
const M1_13_CLOSE_TIMEOUT_MS = 5_000
const M1_13_ORIGINAL_PAYLOAD = 'A'.repeat(M1_13_SPILL_PAYLOAD_BYTES)
const M1_13_CHANGED_PAYLOAD = 'B'.repeat(M1_13_SPILL_PAYLOAD_BYTES)
const M1_13_HOT_JOURNAL_MAGIC = 'd9d505f920a163d7'
const M1_13_CRASH_MEMORY_ID =
  'mem_00000000-0000-4000-8000-000000001303'

function readM113SingleValue(db, sql) {
  const row = db.prepare(sql).get()
  const values = Object.values(row)
  assert.equal(values.length, 1)
  return values[0]
}

function observeM113Child(child) {
  const output = { stdout: '', stderr: '', error: undefined }
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', (chunk) => {
    output.stdout += chunk
  })
  child.stderr.on('data', (chunk) => {
    output.stderr += chunk
  })
  child.on('error', (error) => {
    if (output.error === undefined) output.error = error
  })
  return output
}

function waitForM113Ready(child, output) {
  return new Promise((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      finish(new Error(
        `M1-13 child READY timeout\nstdout:\n${output.stdout}\nstderr:\n${output.stderr}`,
      ))
    }, M1_13_READY_TIMEOUT_MS)

    function finish(error) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      child.stdout.off('data', inspect)
      child.off('error', onError)
      child.off('close', onClose)
      if (error === undefined) resolve()
      else reject(error)
    }

    function inspect() {
      if (output.stdout === 'READY\n') {
        finish()
        return
      }
      if (!'READY\n'.startsWith(output.stdout)) {
        finish(new Error(
          `M1-13 child emitted unexpected stdout: ${JSON.stringify(output.stdout)}`,
        ))
      }
    }

    function onError(error) {
      finish(error)
    }

    function onClose(code, signal) {
      finish(new Error(
        `M1-13 child exited before READY (${code ?? signal})\n` +
        `stdout:\n${output.stdout}\nstderr:\n${output.stderr}`,
      ))
    }

    child.stdout.on('data', inspect)
    child.once('error', onError)
    child.once('close', onClose)
    inspect()
  })
}

function observeM113Close(child) {
  return new Promise((resolve) => {
    child.once('close', (code, signal) => resolve({ code, signal }))
  })
}

async function waitForM113Close(closePromise, output) {
  let timer
  try {
    return await Promise.race([
      closePromise,
      new Promise((resolve, reject) => {
        timer = setTimeout(() => {
          reject(new Error(
            `M1-13 child close timeout\n` +
            `stdout:\n${output.stdout}\nstderr:\n${output.stderr}\n` +
            `error:\n${output.error?.stack ?? output.error ?? ''}`,
          ))
        }, M1_13_CLOSE_TIMEOUT_MS)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

function makeM113CrashEnvelope() {
  const input = makeM104ApplyEnvelope()
  input.expectedHead.sequence = 1
  input.decision.decisionId =
    'dec_00000000-0000-4000-8000-000000001301'
  input.decision.proposalId =
    'prp_00000000-0000-4000-8000-000000001302'
  input.decision.memoryId = M1_13_CRASH_MEMORY_ID
  input.decision.effectiveAt = '2026-07-18T12:59:00.000Z'
  input.decision.observedAt = '2026-07-18T13:00:00.000Z'
  input.atom.content = 'M1-13 uncommitted crash memory.'
  input.atom.keywords = ['crash', 'uncommitted']
  input.atom.initialImportance = 0.625
  return input
}

function inspectM113HotJournal(journalPath) {
  assert.equal(existsSync(journalPath), true)
  const journal = statSync(journalPath)
  assert.equal(journal.isFile(), true)
  assert.ok(journal.size > M1_13_MINIMUM_JOURNAL_BYTES)
  const magic = readFileSync(journalPath).subarray(0, 8).toString('hex')
  assert.equal(magic, M1_13_HOT_JOURNAL_MAGIC)
  return { size: journal.size, magic }
}

function createM113Database(dbPath) {
  const db = new DatabaseSync(dbPath)
  try {
    db.exec('PRAGMA page_size=4096')
    assert.equal(
      readM113SingleValue(db, 'PRAGMA journal_mode=DELETE'),
      'delete',
    )
    assert.equal(initializeMemoryBundle(db, {
      clock() {
        return new Date('2026-07-18T11:58:00.000Z')
      },
      idFactory() {
        return M1_04_IDS.streamId.slice('str_'.length)
      },
    }), undefined)
    db.exec('BEGIN IMMEDIATE')
    assert.equal(
      applyResolvedDecisionInTransaction(db, makeM104ApplyEnvelope()),
      undefined,
    )
    db.exec('COMMIT')
    db.exec(`
      CREATE TABLE main.m113_test_owned_spill (
        id INTEGER PRIMARY KEY,
        payload TEXT NOT NULL
      ) STRICT;
      BEGIN IMMEDIATE;
    `)
    const insert = db.prepare(`
      INSERT INTO main.m113_test_owned_spill (id, payload)
      VALUES (?, ?)
    `)
    for (let id = 1; id <= M1_13_SPILL_ROW_COUNT; id += 1) {
      assert.equal(insert.run(id, M1_13_ORIGINAL_PAYLOAD).changes, 1)
    }
    db.exec('COMMIT')
    assert.ok(readM113SingleValue(db, 'PRAGMA page_count') > 700)
    assert.deepEqual(db.prepare(`
      SELECT
        count(*) AS rowCount,
        sum(CASE WHEN payload = ? THEN 1 ELSE 0 END) AS originalCount
      FROM main.m113_test_owned_spill
    `).get(M1_13_ORIGINAL_PAYLOAD), Object.assign(Object.create(null), {
      rowCount: M1_13_SPILL_ROW_COUNT,
      originalCount: M1_13_SPILL_ROW_COUNT,
    }))
  } finally {
    if (db.isTransaction) db.exec('ROLLBACK')
    db.close()
  }
}

function assertM113RecoveredSpill(dbPath) {
  const db = new DatabaseSync(dbPath, { readOnly: true })
  try {
    assert.deepEqual(db.prepare(`
      SELECT
        count(*) AS rowCount,
        sum(CASE WHEN payload = ? THEN 1 ELSE 0 END) AS originalCount,
        sum(CASE WHEN payload = ? THEN 1 ELSE 0 END) AS changedCount
      FROM main.m113_test_owned_spill
    `).get(
      M1_13_ORIGINAL_PAYLOAD,
      M1_13_CHANGED_PAYLOAD,
    ), Object.assign(Object.create(null), {
      rowCount: M1_13_SPILL_ROW_COUNT,
      originalCount: M1_13_SPILL_ROW_COUNT,
      changedCount: 0,
    }))
  } finally {
    db.close()
  }
}

test('M1-13 public open recovers a hard-crash rollback journal', {
  timeout: 30_000,
}, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'palari-m113-hot-journal-'))
  const dbPath = join(directory, 'bundle.sqlite')
  const journalPath = `${dbPath}-journal`
  let child
  let childClose
  let output

  try {
    createM113Database(dbPath)
    assert.equal(existsSync(journalPath), false)

    child = spawn(process.execPath, [M1_13_CHILD_PATH, dbPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    output = observeM113Child(child)
    childClose = observeM113Close(child)
    await waitForM113Ready(child, output)

    const journalBeforeKill = inspectM113HotJournal(journalPath)
    assert.equal(child.kill('SIGKILL'), true)
    assert.deepEqual(
      await waitForM113Close(childClose, output),
      { code: null, signal: 'SIGKILL' },
    )
    assert.equal(output.error, undefined)
    assert.equal(output.stdout, 'READY\n')
    assert.deepEqual(inspectM113HotJournal(journalPath), journalBeforeKill)

    const handle = openMemoryBundle({ dbPath })
    try {
      assert.deepEqual(handle.verify().checkpoint, {
        streamId: M1_04_IDS.streamId,
        sequence: 1,
      })
      const replay = handle.replay()
      assert.deepEqual(replay.checkpoint, {
        streamId: M1_04_IDS.streamId,
        sequence: 1,
      })
      assert.deepEqual(replay.memories, [{
        ...makeM104CanonicalAtom(),
        contentChecksum: makeM104AtomRow().content_checksum,
      }])
    } finally {
      handle.close()
    }
    assert.equal(existsSync(journalPath), false)
    assertM113RecoveredSpill(dbPath)

    const writer = new DatabaseSync(dbPath)
    try {
      assert.equal(initializeMemoryBundle(writer), undefined)
      writer.exec('BEGIN IMMEDIATE')
      assert.equal(
        applyResolvedDecisionInTransaction(writer, makeM113CrashEnvelope()),
        undefined,
      )
      writer.exec('COMMIT')
    } finally {
      if (writer.isTransaction) writer.exec('ROLLBACK')
      writer.close()
    }

    const finalHandle = openMemoryBundle({ dbPath })
    try {
      const replay = finalHandle.replay()
      assert.deepEqual(replay.checkpoint, {
        streamId: M1_04_IDS.streamId,
        sequence: 2,
      })
      assert.deepEqual(
        replay.memories.map(({ memoryId }) => memoryId),
        [M1_04_IDS.memoryId, M1_13_CRASH_MEMORY_ID],
      )
    } finally {
      finalHandle.close()
    }
  } finally {
    try {
      if (
        child !== undefined &&
        child.exitCode === null &&
        child.signalCode === null
      ) {
        child.kill('SIGKILL')
      }
      if (childClose !== undefined) {
        await waitForM113Close(childClose, output)
      }
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  }
})

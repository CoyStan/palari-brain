import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  chmod,
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  symlink,
  unlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, relative } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { test } from 'node:test'

import { auditSealedSqliteCopy } from '../evals/sealed-sqlite-audit.mjs'

async function fixtureRoot() {
  const root = await mkdtemp(join(tmpdir(), 'palari-audit-contract-'))
  const source = join(root, 'sealed')
  const scratch = join(root, 'scratch')
  await mkdir(source, { mode: 0o700 })
  await mkdir(scratch, { mode: 0o700 })
  return { root, scratch, source }
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

async function physicalSnapshot(source, databaseName = 'memory.sqlite') {
  const names = (await readdir(source))
    .filter((name) => name === databaseName ||
      name === `${databaseName}-wal` || name === `${databaseName}-shm`)
    .sort()
  const entries = []
  for (const name of names) {
    const path = join(source, name)
    const metadata = await lstat(path)
    entries.push({
      device: String(metadata.dev),
      inode: String(metadata.ino),
      name,
      mode: metadata.mode & 0o7777,
      sha256: sha256(await readFile(path)),
    })
  }
  return entries
}

async function createDatabase(path, { wal = false } = {}) {
  const database = new DatabaseSync(path)
  if (wal) database.exec('PRAGMA journal_mode=WAL')
  database.exec(`
    CREATE TABLE memories (id INTEGER PRIMARY KEY, content TEXT NOT NULL);
    INSERT INTO memories (content) VALUES ('portable power bank');
  `)
  await chmod(path, 0o600)
  return database
}

test('SQLite opens only a copied main database and source remains exact', async () => {
  const fixture = await fixtureRoot()
  const sourcePath = join(fixture.source, 'memory.sqlite')
  let copiedPath
  try {
    const database = await createDatabase(sourcePath)
    database.close()
    const before = await physicalSnapshot(fixture.source)
    const receipt = await auditSealedSqliteCopy({
      sourcePath,
      scratchParent: fixture.scratch,
      audit(path) {
        copiedPath = path
        assert.equal(isAbsolute(path), true)
        assert.notEqual(relative(fixture.source, path).startsWith('..'), false)
        const copy = new DatabaseSync(path, { readOnly: true })
        try {
          return copy.prepare('SELECT content FROM memories').get().content
        } finally {
          copy.close()
        }
      },
    })
    assert.equal(receipt.result, 'portable power bank')
    assert.deepEqual(await physicalSnapshot(fixture.source), before)
    assert.equal(receipt.sourceSnapshot[0].sha256, before[0].sha256)
    await assert.rejects(stat(copiedPath), { code: 'ENOENT' })
    assert.deepEqual(await readdir(fixture.scratch), [])
    assert.equal(Object.isFrozen(receipt), true)
  } finally {
    await rm(fixture.root, { recursive: true, force: true })
  }
})

test('valid WAL and SHM are copied and any copy-side mutations stay isolated', async () => {
  const fixture = await fixtureRoot()
  const sourcePath = join(fixture.source, 'memory.sqlite')
  let sourceDatabase
  let scratchDirectory
  try {
    sourceDatabase = await createDatabase(sourcePath, { wal: true })
    const before = await physicalSnapshot(fixture.source)
    assert.deepEqual(before.map((entry) => entry.name), [
      'memory.sqlite',
      'memory.sqlite-shm',
      'memory.sqlite-wal',
    ])
    const receipt = await auditSealedSqliteCopy({
      sourcePath,
      scratchParent: fixture.scratch,
      async audit(path) {
        scratchDirectory = path.slice(0, path.lastIndexOf('/'))
        const copy = new DatabaseSync(path, { readOnly: true })
        try {
          assert.equal(
            copy.prepare('SELECT count(*) AS count FROM memories').get().count,
            1,
          )
        } finally {
          copy.close()
        }
        await writeFile(join(scratchDirectory, 'audit-note.txt'), 'scratch')
        return 'audited'
      },
    })
    assert.equal(receipt.result, 'audited')
    assert.ok(receipt.scratchFiles.includes('audit-note.txt'))
    assert.deepEqual(await physicalSnapshot(fixture.source), before)
    await assert.rejects(stat(scratchDirectory), { code: 'ENOENT' })
  } finally {
    sourceDatabase?.close()
    await rm(fixture.root, { recursive: true, force: true })
  }
})

test('callback failure still verifies source and removes exact owned scratch', async () => {
  const fixture = await fixtureRoot()
  const sourcePath = join(fixture.source, 'memory.sqlite')
  let scratchDirectory
  try {
    const database = await createDatabase(sourcePath)
    database.close()
    const before = await physicalSnapshot(fixture.source)
    const expected = new Error('synthetic audit failure')
    await assert.rejects(auditSealedSqliteCopy({
      sourcePath,
      scratchParent: fixture.scratch,
      async audit(path) {
        scratchDirectory = path.slice(0, path.lastIndexOf('/'))
        await writeFile(join(scratchDirectory, 'partial.txt'), 'partial')
        throw expected
      },
    }), (error) => error === expected)
    assert.deepEqual(await physicalSnapshot(fixture.source), before)
    await assert.rejects(stat(scratchDirectory), { code: 'ENOENT' })
    assert.deepEqual(await readdir(fixture.scratch), [])
  } finally {
    await rm(fixture.root, { recursive: true, force: true })
  }
})

test('scratch pathname substitution fails and cleans the owned inode only', async () => {
  const fixture = await fixtureRoot()
  const sourcePath = join(fixture.source, 'memory.sqlite')
  let escapedDirectory
  let replacementDirectory
  try {
    const database = await createDatabase(sourcePath)
    database.close()
    await assert.rejects(auditSealedSqliteCopy({
      sourcePath,
      scratchParent: fixture.scratch,
      async audit(path) {
        const ownedDirectory = dirname(path)
        escapedDirectory = `${ownedDirectory}-renamed`
        replacementDirectory = ownedDirectory
        await rename(ownedDirectory, escapedDirectory)
        await mkdir(replacementDirectory, { mode: 0o700 })
        await writeFile(join(replacementDirectory, 'replacement.txt'), 'keep')
        return 'must not escape'
      },
    }), /scratch pathname was substituted/u)
    await assert.rejects(stat(escapedDirectory), { code: 'ENOENT' })
    assert.equal(
      await readFile(join(replacementDirectory, 'replacement.txt'), 'utf8'),
      'keep',
    )
  } finally {
    await rm(fixture.root, { recursive: true, force: true })
  }
})

test('special permission-bit changes are detected and scratch is cleaned', async () => {
  const fixture = await fixtureRoot()
  const sourcePath = join(fixture.source, 'memory.sqlite')
  let copiedDirectory
  try {
    const database = await createDatabase(sourcePath)
    database.close()
    await assert.rejects(auditSealedSqliteCopy({
      sourcePath,
      scratchParent: fixture.scratch,
      async audit(path) {
        copiedDirectory = dirname(path)
        await chmod(sourcePath, 0o4600)
      },
    }), /source physical set, bytes, or modes changed/u)
    assert.equal((await lstat(sourcePath)).mode & 0o7777, 0o4600)
    await assert.rejects(stat(copiedDirectory), { code: 'ENOENT' })
    assert.deepEqual(await readdir(fixture.scratch), [])
  } finally {
    await rm(fixture.root, { recursive: true, force: true })
  }
})

test('retargeting a symlinked parent cannot substitute identical source bytes', async () => {
  const fixture = await fixtureRoot()
  const physicalA = join(fixture.root, 'physical-a')
  const physicalB = join(fixture.root, 'physical-b')
  const active = join(fixture.root, 'active')
  const databaseName = 'memory.sqlite'
  await mkdir(physicalA, { mode: 0o700 })
  await mkdir(physicalB, { mode: 0o700 })
  const sourceA = join(physicalA, databaseName)
  const sourceB = join(physicalB, databaseName)
  let copiedDirectory
  try {
    const database = await createDatabase(sourceA)
    database.close()
    await copyFile(sourceA, sourceB)
    await chmod(sourceB, 0o600)
    await symlink(physicalA, active)
    await assert.rejects(auditSealedSqliteCopy({
      sourcePath: join(active, databaseName),
      scratchParent: fixture.scratch,
      async audit(path) {
        copiedDirectory = dirname(path)
        await unlink(active)
        await symlink(physicalB, active)
      },
    }), /source physical set, bytes, or modes changed/u)
    await assert.rejects(stat(copiedDirectory), { code: 'ENOENT' })
    assert.deepEqual(await readdir(fixture.scratch), [])
  } finally {
    await rm(fixture.root, { recursive: true, force: true })
  }
})

test('relative, missing, symlink, and in-namespace scratch paths fail closed', async () => {
  const fixture = await fixtureRoot()
  const sourcePath = join(fixture.source, 'memory.sqlite')
  try {
    const database = await createDatabase(sourcePath)
    database.close()
    const linkPath = join(fixture.source, 'link.sqlite')
    await symlink(sourcePath, linkPath)
    await assert.rejects(auditSealedSqliteCopy({
      sourcePath: 'memory.sqlite',
      scratchParent: fixture.scratch,
      audit() {},
    }), /absolute/u)
    await assert.rejects(auditSealedSqliteCopy({
      sourcePath: join(fixture.source, 'missing.sqlite'),
      scratchParent: fixture.scratch,
      audit() {},
    }))
    await assert.rejects(auditSealedSqliteCopy({
      sourcePath: linkPath,
      scratchParent: fixture.scratch,
      audit() {},
    }), /non-symlink/u)
    await assert.rejects(auditSealedSqliteCopy({
      sourcePath,
      scratchParent: fixture.source,
      audit() {},
    }), /outside the source namespace/u)
    assert.deepEqual(await readdir(fixture.scratch), [])
  } finally {
    await rm(fixture.root, { recursive: true, force: true })
  }
})

// Copy-first boundary for inspecting a sealed SQLite database. SQLite never
// receives a path in the source namespace; it may create or touch sidecars only
// inside the exact owned scratch directory removed by this function.

import { createHash } from 'node:crypto'
import {
  constants,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readdir,
  realpath,
  rm,
  stat,
} from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const arrayIsArray = Array.isArray
const objectFreeze = Object.freeze
const pathCandidates = (sourcePath) => [
  sourcePath,
  `${sourcePath}-wal`,
  `${sourcePath}-shm`,
]

function fail(message) {
  throw new Error(`Sealed SQLite audit: ${message}`)
}

function isWithin(parent, candidate) {
  const route = relative(parent, candidate)
  return route === '' || (!route.startsWith('..') && !isAbsolute(route))
}

async function readStableFile(path) {
  let handle
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
    const before = await handle.stat({ bigint: true })
    if (!before.isFile()) fail(`${path} is not a regular file.`)
    const bytes = await handle.readFile()
    const after = await handle.stat({ bigint: true })
    if (before.dev !== after.dev || before.ino !== after.ino ||
      before.size !== after.size || before.mtimeNs !== after.mtimeNs ||
      before.mode !== after.mode) {
      fail(`${path} changed while it was being snapshotted.`)
    }
    return {
      bytes,
      mode: Number(before.mode & 0o777n),
      sha256: createHash('sha256').update(bytes).digest('hex'),
    }
  } finally {
    await handle?.close()
  }
}

async function snapshotSource(sourcePath) {
  const entries = []
  for (const path of pathCandidates(sourcePath)) {
    let metadata
    try {
      metadata = await lstat(path, { bigint: true })
    } catch (error) {
      if (error?.code === 'ENOENT') continue
      throw error
    }
    if (metadata.isSymbolicLink() || !metadata.isFile()) {
      fail(`${path} must be a non-symlink regular file.`)
    }
    const snapshot = await readStableFile(path)
    entries.push(objectFreeze({
      bytes: snapshot.bytes,
      mode: snapshot.mode,
      name: basename(path),
      path,
      sha256: snapshot.sha256,
    }))
  }
  if (entries.length < 1 || entries[0].path !== sourcePath) {
    fail('source database does not exist.')
  }
  return entries
}

function publicSnapshot(entries) {
  return objectFreeze(entries.map((entry) => objectFreeze({
    mode: entry.mode,
    name: entry.name,
    sha256: entry.sha256,
  })))
}

function sameSnapshot(before, after) {
  if (before.length !== after.length) return false
  for (let index = 0; index < before.length; index += 1) {
    const left = before[index]
    const right = after[index]
    if (left.name !== right.name || left.mode !== right.mode ||
      left.sha256 !== right.sha256) return false
  }
  return true
}

async function copySnapshot(entries, scratchDirectory) {
  for (const entry of entries) {
    const target = join(scratchDirectory, entry.name)
    const handle = await open(
      target,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL,
      entry.mode,
    )
    try {
      await handle.writeFile(entry.bytes)
      await handle.chmod(entry.mode)
      await handle.sync()
    } finally {
      await handle.close()
    }
  }
}

async function removeOwnedScratch({ scratchDirectory, scratchPrefix }) {
  if (!scratchDirectory || dirname(scratchDirectory) !== dirname(scratchPrefix) ||
    !basename(scratchDirectory).startsWith(basename(scratchPrefix))) {
    fail('refused cleanup outside the exact owned scratch prefix.')
  }
  await rm(scratchDirectory, { recursive: true, force: false })
}

export async function auditSealedSqliteCopy({
  audit,
  scratchParent = tmpdir(),
  sourcePath,
} = {}) {
  if (typeof sourcePath !== 'string' || !isAbsolute(sourcePath)) {
    fail('sourcePath must be an absolute path.')
  }
  if (typeof scratchParent !== 'string' || !isAbsolute(scratchParent)) {
    fail('scratchParent must be an absolute path.')
  }
  if (typeof audit !== 'function') fail('audit must be a function.')

  const normalizedSource = resolve(sourcePath)
  const sourceNamespace = await realpath(dirname(normalizedSource))
  const sourceMetadata = await lstat(normalizedSource)
  if (sourceMetadata.isSymbolicLink() || !sourceMetadata.isFile()) {
    fail('source database must be a non-symlink regular file.')
  }
  await mkdir(scratchParent, { recursive: true, mode: 0o700 })
  const realScratchParent = await realpath(scratchParent)
  const scratchPrefix = join(realScratchParent, 'palari-sqlite-audit-')
  let scratchDirectory
  let primaryError
  let result
  let sourceBefore
  let sourceAfter
  let scratchFiles = []

  try {
    sourceBefore = await snapshotSource(normalizedSource)
    scratchDirectory = await mkdtemp(scratchPrefix)
    if (isWithin(sourceNamespace, scratchDirectory)) {
      fail('scratch directory must be outside the source namespace.')
    }
    await copySnapshot(sourceBefore, scratchDirectory)
    const copiedDatabasePath = join(
      scratchDirectory,
      basename(normalizedSource),
    )
    result = await audit(copiedDatabasePath)
    scratchFiles = (await readdir(scratchDirectory)).sort()
  } catch (error) {
    primaryError = error
    if (scratchDirectory) {
      try {
        scratchFiles = (await readdir(scratchDirectory)).sort()
      } catch {
        // Cleanup and source verification below remain authoritative.
      }
    }
  }

  const finalErrors = []
  try {
    sourceAfter = await snapshotSource(normalizedSource)
    if (!sameSnapshot(sourceBefore ?? [], sourceAfter)) {
      finalErrors.push(new Error(
        'Sealed SQLite audit: source physical set, bytes, or modes changed.',
      ))
    }
  } catch (error) {
    finalErrors.push(error)
  }
  if (scratchDirectory) {
    try {
      await removeOwnedScratch({ scratchDirectory, scratchPrefix })
    } catch (error) {
      finalErrors.push(error)
    }
  }
  if (primaryError) finalErrors.unshift(primaryError)
  if (finalErrors.length === 1) throw finalErrors[0]
  if (finalErrors.length > 1) {
    throw new AggregateError(finalErrors, 'Sealed SQLite audit failed.')
  }

  return objectFreeze({
    result,
    scratchFiles: objectFreeze(arrayIsArray(scratchFiles)
      ? [...scratchFiles]
      : []),
    sourceSnapshot: publicSnapshot(sourceAfter),
  })
}

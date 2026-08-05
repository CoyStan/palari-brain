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
const arraySort = Function.prototype.call.bind(Array.prototype.sort)
const aggregateErrorFrom = AggregateError
const bigintFrom = BigInt
const functionCallBind = Function.prototype.call.bind(Function.prototype.call)
const hashProbe = createHash('sha256')
const hashDigest = Function.prototype.call.bind(hashProbe.digest)
const hashUpdate = Function.prototype.call.bind(hashProbe.update)
const numberFrom = Number
const objectCreate = Object.create
const objectDefineProperty = Object.defineProperty
const objectFreeze = Object.freeze
const objectGetPrototypeOf = Object.getPrototypeOf
const stringStartsWith = Function.prototype.call.bind(
  String.prototype.startsWith,
)
const symbolIterator = Symbol.iterator
const statTypeMask = bigintFrom(constants.S_IFMT)
const statDirectoryType = bigintFrom(constants.S_IFDIR)
const statRegularType = bigintFrom(constants.S_IFREG)
const statSymlinkType = bigintFrom(constants.S_IFLNK)
let handleOperations
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
  return route === '' || (!stringStartsWith(route, '..') && !isAbsolute(route))
}

function append(values, value) {
  values[values.length] = value
}

function statIs(metadata, type) {
  return (metadata.mode & statTypeMask) === type
}

function operationsFor(handle) {
  if (!handleOperations) {
    const prototype = objectGetPrototypeOf(handle)
    handleOperations = objectFreeze({
      chmod: functionCallBind.bind(null, prototype.chmod),
      readFile: functionCallBind.bind(null, prototype.readFile),
      stat: functionCallBind.bind(null, prototype.stat),
      sync: functionCallBind.bind(null, prototype.sync),
      writeFile: functionCallBind.bind(null, prototype.writeFile),
    })
  }
  return handleOperations
}

function immutableArray(values) {
  const copy = []
  for (let index = 0; index < values.length; index += 1) {
    copy[index] = values[index]
  }
  return objectFreeze(copy)
}

function aggregateErrors(errors, message) {
  const iterable = objectCreate(null)
  objectDefineProperty(iterable, symbolIterator, {
    enumerable: false,
    value: function* iterateErrors() {
      for (let index = 0; index < errors.length; index += 1) {
        yield errors[index]
      }
    },
  })
  return new aggregateErrorFrom(iterable, message)
}

function sha256(bytes) {
  const hash = createHash('sha256')
  hashUpdate(hash, bytes)
  return hashDigest(hash, 'hex')
}

async function readStableFile(path) {
  let handle
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
    const operations = operationsFor(handle)
    const before = await operations.stat(handle, { bigint: true })
    if (!statIs(before, statRegularType)) {
      fail(`${path} is not a regular file.`)
    }
    const bytes = await operations.readFile(handle)
    const after = await operations.stat(handle, { bigint: true })
    if (before.dev !== after.dev || before.ino !== after.ino ||
      before.size !== after.size || before.mtimeNs !== after.mtimeNs ||
      before.mode !== after.mode) {
      fail(`${path} changed while it was being snapshotted.`)
    }
    return {
      bytes,
      device: before.dev,
      inode: before.ino,
      mode: numberFrom(before.mode & 0o7777n),
      sha256: sha256(bytes),
    }
  } finally {
    await handle?.close()
  }
}

async function snapshotSource(sourcePath) {
  const entries = []
  const candidates = pathCandidates(sourcePath)
  for (let index = 0; index < candidates.length; index += 1) {
    const path = candidates[index]
    let metadata
    try {
      metadata = await lstat(path, { bigint: true })
    } catch (error) {
      if (error?.code === 'ENOENT') continue
      throw error
    }
    if (statIs(metadata, statSymlinkType) ||
      !statIs(metadata, statRegularType)) {
      fail(`${path} must be a non-symlink regular file.`)
    }
    const snapshot = await readStableFile(path)
    append(entries, objectFreeze({
      bytes: snapshot.bytes,
      device: snapshot.device,
      inode: snapshot.inode,
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
  const snapshot = []
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]
    snapshot[index] = objectFreeze({
      mode: entry.mode,
      name: entry.name,
      sha256: entry.sha256,
    })
  }
  return objectFreeze(snapshot)
}

function sameSnapshot(before, after) {
  if (before.length !== after.length) return false
  for (let index = 0; index < before.length; index += 1) {
    const left = before[index]
    const right = after[index]
    if (left.name !== right.name || left.mode !== right.mode ||
      left.sha256 !== right.sha256 || left.device !== right.device ||
      left.inode !== right.inode) return false
  }
  return true
}

async function copySnapshot(entries, scratchDirectory) {
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]
    const target = join(scratchDirectory, entry.name)
    const handle = await open(
      target,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL,
      entry.mode,
    )
    try {
      const operations = operationsFor(handle)
      await operations.writeFile(handle, entry.bytes)
      await operations.chmod(handle, entry.mode)
      await operations.sync(handle)
    } finally {
      await handle.close()
    }
  }
}

function sameIdentity(metadata, identity) {
  return metadata.dev === identity.device && metadata.ino === identity.inode
}

async function ownedDirectoryPath(handle, identity) {
  const metadata = await operationsFor(handle).stat(handle, { bigint: true })
  if (!sameIdentity(metadata, identity)) {
    fail('owned scratch handle identity changed.')
  }
  if (metadata.nlink === 0n) return null
  let path
  try {
    path = await realpath(`/proc/self/fd/${identity.fd}`)
  } catch {
    fail('cannot resolve the physical owned scratch directory.')
  }
  const pathMetadata = await lstat(path, { bigint: true })
  if (statIs(pathMetadata, statSymlinkType) ||
    !statIs(pathMetadata, statDirectoryType) ||
    !sameIdentity(pathMetadata, identity)) {
    fail('resolved scratch path does not match its owned physical identity.')
  }
  return path
}

async function removeOwnedScratch({
  scratchDirectory,
  scratchHandle,
  scratchIdentity,
}) {
  const ownedPath = await ownedDirectoryPath(scratchHandle, scratchIdentity)
  let pathnameSubstituted = false
  try {
    const originalMetadata = await lstat(scratchDirectory, { bigint: true })
    pathnameSubstituted = !sameIdentity(originalMetadata, scratchIdentity)
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
    pathnameSubstituted = true
  }
  if (ownedPath) {
    await rm(ownedPath, { recursive: true, force: false })
  }
  const after = await operationsFor(scratchHandle).stat(
    scratchHandle,
    { bigint: true },
  )
  if (after.nlink !== 0n) {
    fail('owned scratch directory still has a filesystem link after cleanup.')
  }
  if (pathnameSubstituted) {
    fail('scratch pathname was substituted during the audit.')
  }
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
  const sourceMetadata = await lstat(normalizedSource, { bigint: true })
  if (statIs(sourceMetadata, statSymlinkType) ||
    !statIs(sourceMetadata, statRegularType)) {
    fail('source database must be a non-symlink regular file.')
  }
  const realSourcePath = await realpath(normalizedSource)
  const sourceNamespace = dirname(realSourcePath)
  await mkdir(scratchParent, { recursive: true, mode: 0o700 })
  const realScratchParent = await realpath(scratchParent)
  const scratchPrefix = join(realScratchParent, 'palari-sqlite-audit-')
  let scratchDirectory
  let scratchHandle
  let scratchIdentity
  let primaryError
  let result
  let sourceBefore
  let sourceAfter
  let scratchFiles = []

  try {
    sourceBefore = await snapshotSource(realSourcePath)
    scratchDirectory = await mkdtemp(scratchPrefix)
    if (isWithin(sourceNamespace, scratchDirectory)) {
      fail('scratch directory must be outside the source namespace.')
    }
    scratchHandle = await open(
      scratchDirectory,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    )
    const scratchMetadata = await operationsFor(scratchHandle).stat(
      scratchHandle,
      { bigint: true },
    )
    scratchIdentity = objectFreeze({
      device: scratchMetadata.dev,
      fd: scratchHandle.fd,
      inode: scratchMetadata.ino,
    })
    await copySnapshot(sourceBefore, scratchDirectory)
    const copiedDatabasePath = join(
      scratchDirectory,
      basename(realSourcePath),
    )
    result = await audit(copiedDatabasePath)
    const currentScratch = await ownedDirectoryPath(
      scratchHandle,
      scratchIdentity,
    )
    scratchFiles = currentScratch
      ? arraySort(await readdir(currentScratch))
      : []
  } catch (error) {
    primaryError = error
    if (scratchHandle && scratchIdentity) {
      try {
        const currentScratch = await ownedDirectoryPath(
          scratchHandle,
          scratchIdentity,
        )
        scratchFiles = currentScratch
          ? arraySort(await readdir(currentScratch))
          : []
      } catch {
        // Cleanup and source verification below remain authoritative.
      }
    }
  }

  const finalErrors = []
  try {
    const currentRealSourcePath = await realpath(normalizedSource)
    sourceAfter = await snapshotSource(realSourcePath)
    if (currentRealSourcePath !== realSourcePath ||
      !sameSnapshot(sourceBefore ?? [], sourceAfter)) {
      append(finalErrors, new Error(
        'Sealed SQLite audit: source physical set, bytes, or modes changed.',
      ))
    }
  } catch (error) {
    append(finalErrors, error)
  }
  if (scratchDirectory && scratchHandle && scratchIdentity) {
    try {
      await removeOwnedScratch({
        scratchDirectory,
        scratchHandle,
        scratchIdentity,
      })
    } catch (error) {
      append(finalErrors, error)
    } finally {
      try {
        await scratchHandle.close()
      } catch (error) {
        append(finalErrors, error)
      }
    }
  } else if (scratchDirectory) {
    try {
      if (dirname(scratchDirectory) !== dirname(scratchPrefix) ||
        !stringStartsWith(
          basename(scratchDirectory),
          basename(scratchPrefix),
        )) {
        fail('refused pre-callback cleanup outside the scratch prefix.')
      }
      await rm(scratchDirectory, { recursive: true, force: false })
    } catch (error) {
      append(finalErrors, error)
    }
  }
  if (primaryError && finalErrors.length === 0) throw primaryError
  if (!primaryError && finalErrors.length === 1) throw finalErrors[0]
  if (primaryError || finalErrors.length > 1) {
    const combined = []
    let offset = 0
    if (primaryError) {
      combined[0] = primaryError
      offset = 1
    }
    for (let index = 0; index < finalErrors.length; index += 1) {
      combined[index + offset] = finalErrors[index]
    }
    throw aggregateErrors(combined, 'Sealed SQLite audit failed.')
  }

  return objectFreeze({
    result,
    scratchFiles: arrayIsArray(scratchFiles)
      ? immutableArray(scratchFiles)
      : objectFreeze([]),
    sourceSnapshot: publicSnapshot(sourceAfter),
  })
}

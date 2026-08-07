// Recursive, fail-closed terminal evidence sealing. Callers create their
// evidence tree; this module verifies custody and writes one durable manifest.

import { createHash } from 'node:crypto'
import { constants } from 'node:fs'
import {
  chmod,
  link,
  lstat,
  open,
  readFile,
  readdir,
  realpath,
  rm,
} from 'node:fs/promises'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { randomUUID } from 'node:crypto'

const FILE_MODE = 0o600
const DIRECTORY_MODE = 0o700

export class TerminalArtifactManifestError extends Error {
  constructor(code, message, { cause } = {}) {
    super(message, cause ? { cause } : undefined)
    this.code = code
    this.name = 'TerminalArtifactManifestError'
  }
}

function fail(code, message, cause) {
  throw new TerminalArtifactManifestError(code, message, { cause })
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function mode(metadata) {
  return metadata.mode & 0o777
}

function manifestBasename(value) {
  if (typeof value !== 'string' || value.length < 1 ||
    value === '.' || value === '..' || basename(value) !== value ||
    value.includes('/') || value.includes('\\') || value.includes('\0')) {
    fail('MANIFEST_NAME_INVALID', 'manifestName must be one plain basename.')
  }
  return value
}

function contained(root, candidate) {
  const path = relative(root, candidate)
  return path === '' || (!path.startsWith(`..${sep}`) && path !== '..' &&
    !path.startsWith(sep))
}

async function exactRealRoot(root) {
  const absolute = resolve(root)
  let metadata
  try {
    metadata = await lstat(absolute)
  } catch (error) {
    fail('ROOT_INVALID', 'terminal artifact root is unavailable.', error)
  }
  if (metadata.isSymbolicLink() || !metadata.isDirectory() ||
    mode(metadata) !== DIRECTORY_MODE) {
    fail('ROOT_INVALID', 'terminal artifact root must be a mode-0700 directory.')
  }
  const physical = await realpath(absolute)
  if (physical !== absolute) {
    fail('ROOT_ESCAPE', 'terminal artifact root contains a symlink or escape.')
  }
  return absolute
}

async function readRegularFile(path, label) {
  let handle
  try {
    handle = await open(
      path,
      constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
    )
    const metadata = await handle.stat()
    if (!metadata.isFile() || mode(metadata) !== FILE_MODE) {
      fail('ENTRY_MODE_INVALID', `${label} must be a mode-0600 regular file.`)
    }
    const bytes = await handle.readFile()
    return { bytes: bytes.length, mode: FILE_MODE, sha256: sha256(bytes) }
  } catch (error) {
    if (error instanceof TerminalArtifactManifestError) throw error
    fail('ENTRY_INVALID', `${label} could not be read without following links.`, error)
  } finally {
    await handle?.close()
  }
}

export async function collectTerminalArtifactEntries({
  root,
  manifestName = 'artifact-manifest.json',
} = {}) {
  const acceptedManifestName = manifestBasename(manifestName)
  const acceptedRoot = await exactRealRoot(root)
  const entries = [{ mode: DIRECTORY_MODE, path: '.', type: 'directory' }]

  async function walk(directory) {
    const names = await readdir(directory)
    names.sort()
    for (const name of names) {
      const path = join(directory, name)
      const relativePath = relative(acceptedRoot, path).split(sep).join('/')
      if (relativePath === acceptedManifestName) continue
      const metadata = await lstat(path)
      if (metadata.isSymbolicLink()) {
        fail('ENTRY_SYMLINK', `terminal artifact is a symlink: ${relativePath}`)
      }
      const physical = await realpath(path)
      if (!contained(acceptedRoot, physical)) {
        fail('ENTRY_ESCAPE', `terminal artifact escapes root: ${relativePath}`)
      }
      if (metadata.isDirectory()) {
        if (mode(metadata) !== DIRECTORY_MODE) {
          fail(
            'ENTRY_MODE_INVALID',
            `${relativePath} must be a mode-0700 directory.`,
          )
        }
        entries.push({
          mode: DIRECTORY_MODE,
          path: relativePath,
          type: 'directory',
        })
        await walk(path)
      } else if (metadata.isFile()) {
        entries.push({
          ...(await readRegularFile(path, relativePath)),
          path: relativePath,
          type: 'file',
        })
      } else {
        fail('ENTRY_SPECIAL', `terminal artifact is special: ${relativePath}`)
      }
    }
  }

  await walk(acceptedRoot)
  entries.sort((left, right) => left.path.localeCompare(right.path) ||
    left.type.localeCompare(right.type))
  return entries
}

async function syncDirectory(path) {
  const handle = await open(path, 'r')
  try {
    await handle.sync()
  } finally {
    await handle.close()
  }
}

async function requireManifestAbsent(path) {
  try {
    await lstat(path)
    fail('MANIFEST_EXISTS', 'terminal artifact manifest is already sealed.')
  } catch (error) {
    if (error instanceof TerminalArtifactManifestError) throw error
    if (error?.code !== 'ENOENT') throw error
  }
}

export async function sealTerminalArtifactDirectory({
  root,
  manifestName = 'artifact-manifest.json',
  metadata = {},
  sealedAt = new Date().toISOString(),
} = {}) {
  const acceptedManifestName = manifestBasename(manifestName)
  const acceptedRoot = await exactRealRoot(root)
  const manifestPath = join(acceptedRoot, acceptedManifestName)
  await requireManifestAbsent(manifestPath)
  const entries = await collectTerminalArtifactEntries({
    manifestName: acceptedManifestName,
    root: acceptedRoot,
  })
  const manifest = {
    entries,
    metadata,
    schemaVersion: 1,
    sealedAt,
    status: 'sealed',
  }
  const bytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`)
  const temporary = join(
    acceptedRoot,
    `.${acceptedManifestName}.${randomUUID()}.tmp`,
  )
  let handle
  try {
    handle = await open(temporary, 'wx', FILE_MODE)
    await handle.writeFile(bytes)
    await handle.sync()
    await handle.close()
    handle = undefined
    await chmod(temporary, FILE_MODE)
    await link(temporary, manifestPath)
    await rm(temporary)
    await syncDirectory(acceptedRoot)
  } catch (error) {
    await handle?.close()
    await rm(temporary, { force: true })
    if (error?.code === 'EEXIST') {
      fail('MANIFEST_EXISTS', 'terminal artifact manifest is already sealed.')
    }
    throw error
  }
  return {
    entries,
    manifest,
    manifestPath,
    manifestSha256: sha256(bytes),
  }
}

export async function verifyTerminalArtifactDirectory({
  root,
  manifestName = 'artifact-manifest.json',
} = {}) {
  const acceptedManifestName = manifestBasename(manifestName)
  const acceptedRoot = await exactRealRoot(root)
  const manifestPath = join(acceptedRoot, acceptedManifestName)
  const metadata = await lstat(manifestPath)
  if (!metadata.isFile() || metadata.isSymbolicLink() ||
    mode(metadata) !== FILE_MODE) {
    fail('MANIFEST_INVALID', 'terminal artifact manifest must be mode 0600.')
  }
  const bytes = await readFile(manifestPath)
  let manifest
  try {
    manifest = JSON.parse(bytes)
  } catch (error) {
    fail('MANIFEST_INVALID', 'terminal artifact manifest is not JSON.', error)
  }
  const entries = await collectTerminalArtifactEntries({
    manifestName: acceptedManifestName,
    root: acceptedRoot,
  })
  if (JSON.stringify(manifest.entries) !== JSON.stringify(entries)) {
    fail('MANIFEST_DRIFT', 'terminal artifact entries differ from the seal.')
  }
  return {
    entries,
    manifest,
    manifestPath,
    manifestSha256: sha256(bytes),
  }
}

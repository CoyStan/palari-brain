import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  TerminalArtifactManifestError,
  collectTerminalArtifactEntries,
  sealTerminalArtifactDirectory,
  verifyTerminalArtifactDirectory,
} from '../evals/terminal-artifact-manifest.mjs'

async function fixture() {
  const parent = await mkdtemp(join(tmpdir(), 'palari-terminal-manifest-'))
  await chmod(parent, 0o700)
  const root = join(parent, 'j4-luna-ettin-unexecuted11to20-v2')
  await mkdir(join(root, 'transcripts', 'answer-smoke'), {
    mode: 0o700,
    recursive: true,
  })
  await mkdir(join(root, 'workspace', 'question-11'), {
    mode: 0o700,
    recursive: true,
  })
  for (const [path, value] of [
    ['launcher-attempt.json', '{"status":"consumed"}\n'],
    ['meter.json', '{"calls":2}\n'],
    [join('transcripts', 'answer-smoke', 'request.json'), '{"model":"gpt-5.6-luna"}\n'],
    [join('workspace', 'question-11', 'brain.json'), '{"version":1}\n'],
  ]) {
    await writeFile(join(root, path), value, { mode: 0o600 })
    await chmod(join(root, path), 0o600)
  }
  return { parent, root }
}

async function withFixture(fn) {
  const value = await fixture()
  try {
    await fn(value)
  } finally {
    await rm(value.parent, { force: true, recursive: true })
  }
}

test('recursively seals and verifies a BRN-0025-shaped nested tree', async () => {
  await withFixture(async ({ root }) => {
    const sealed = await sealTerminalArtifactDirectory({
      metadata: { runId: 'j4-luna-ettin-unexecuted11to20-v3' },
      root,
      sealedAt: '2026-08-07T00:00:00.000Z',
    })
    assert.deepEqual(sealed.entries.map(({ path, type }) => [path, type]), [
      ['.', 'directory'],
      ['launcher-attempt.json', 'file'],
      ['meter.json', 'file'],
      ['transcripts', 'directory'],
      ['transcripts/answer-smoke', 'directory'],
      ['transcripts/answer-smoke/request.json', 'file'],
      ['workspace', 'directory'],
      ['workspace/question-11', 'directory'],
      ['workspace/question-11/brain.json', 'file'],
    ])
    assert.equal((await lstat(sealed.manifestPath)).mode & 0o777, 0o600)
    assert.equal(
      sealed.entries.some(({ path }) => path === 'artifact-manifest.json'),
      false,
    )
    const verified = await verifyTerminalArtifactDirectory({ root })
    assert.equal(verified.manifestSha256, sealed.manifestSha256)
    assert.deepEqual(verified.entries, sealed.entries)
    for (const entry of verified.entries) {
      assert.equal(entry.mode, entry.type === 'file' ? 0o600 : 0o700)
      if (entry.type === 'file') {
        assert.equal(typeof entry.sha256, 'string')
        assert.equal(entry.sha256.length, 64)
      }
    }
  })
})

test('collection ordering and hashes are deterministic', async () => {
  await withFixture(async ({ root }) => {
    const first = await collectTerminalArtifactEntries({ root })
    const second = await collectTerminalArtifactEntries({ root })
    assert.deepEqual(first, second)
    const paths = first.map(({ path }) => path)
    assert.deepEqual(paths, [...paths].sort())
  })
})

test('seal is write-once and verification detects later byte drift', async () => {
  await withFixture(async ({ root }) => {
    await sealTerminalArtifactDirectory({ root })
    await assert.rejects(
      sealTerminalArtifactDirectory({ root }),
      (error) => error instanceof TerminalArtifactManifestError &&
        error.code === 'MANIFEST_EXISTS',
    )
    await writeFile(join(root, 'meter.json'), '{"calls":3}\n', { mode: 0o600 })
    await assert.rejects(
      verifyTerminalArtifactDirectory({ root }),
      (error) => error instanceof TerminalArtifactManifestError &&
        error.code === 'MANIFEST_DRIFT',
    )
  })
})

test('symlink roots, nested symlinks, and escape names fail closed', async () => {
  await withFixture(async ({ parent, root }) => {
    const rootLink = join(parent, 'linked-root')
    await symlink(root, rootLink)
    await assert.rejects(
      collectTerminalArtifactEntries({ root: rootLink }),
      TerminalArtifactManifestError,
    )
    await symlink('/etc/passwd', join(root, 'transcripts', 'escape'))
    await assert.rejects(
      collectTerminalArtifactEntries({ root }),
      (error) => error instanceof TerminalArtifactManifestError &&
        error.code === 'ENTRY_SYMLINK',
    )
    for (const manifestName of ['../outside.json', '/tmp/outside.json', 'a/b']) {
      await assert.rejects(
        collectTerminalArtifactEntries({ root, manifestName }),
        (error) => error instanceof TerminalArtifactManifestError &&
          error.code === 'MANIFEST_NAME_INVALID',
      )
    }
  })
})

test('special entries and incorrect file or directory modes fail closed', async () => {
  await withFixture(async ({ root }) => {
    const fifo = join(root, 'terminal.fifo')
    execFileSync('mkfifo', [fifo])
    await assert.rejects(
      collectTerminalArtifactEntries({ root }),
      (error) => error instanceof TerminalArtifactManifestError &&
        error.code === 'ENTRY_SPECIAL',
    )
    await rm(fifo)
    await chmod(join(root, 'meter.json'), 0o640)
    await assert.rejects(
      collectTerminalArtifactEntries({ root }),
      (error) => error instanceof TerminalArtifactManifestError &&
        error.code === 'ENTRY_MODE_INVALID',
    )
    await chmod(join(root, 'meter.json'), 0o600)
    await chmod(join(root, 'transcripts'), 0o755)
    await assert.rejects(
      collectTerminalArtifactEntries({ root }),
      (error) => error instanceof TerminalArtifactManifestError &&
        error.code === 'ENTRY_MODE_INVALID',
    )
  })
})

test('manifest itself is excluded but a preexisting path refuses sealing', async () => {
  await withFixture(async ({ root }) => {
    await writeFile(join(root, 'artifact-manifest.json'), '{}\n', {
      mode: 0o600,
    })
    const entries = await collectTerminalArtifactEntries({ root })
    assert.equal(
      entries.some(({ path }) => path === 'artifact-manifest.json'),
      false,
    )
    await assert.rejects(
      sealTerminalArtifactDirectory({ root }),
      (error) => error instanceof TerminalArtifactManifestError &&
        error.code === 'MANIFEST_EXISTS',
    )
    assert.equal(await readFile(join(root, 'artifact-manifest.json'), 'utf8'), '{}\n')
  })
})

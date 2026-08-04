import assert from 'node:assert/strict'
import { mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  ETTIN_NATIVE_IDENTITY,
  ETTIN_RUNTIME_IDENTITY,
  hashRuntimeClosure,
  main,
  verifyEttinRuntime,
} from '../evals/run-ettin-native-bakeoff.mjs'

test('native Ettin identity reuses the unchanged frozen bank and rule', async () => {
  const verified = await main(['--verify'])
  assert.equal(verified.identity, 'brn-0009/ettin-native-v1')
  assert.deepEqual(verified.runtime, ETTIN_RUNTIME_IDENTITY)
  assert.equal(ETTIN_NATIVE_IDENTITY, verified.identity)
  assert.equal(verified.bankCases, 16)
  assert.equal(
    verified.bankHash,
    'a89f5179874313d60e4bf46b7af8aad74ad31398873f55f1f4796dbaf96784f1',
  )
  assert.equal(verified.baseline.top1, 0)
  assert.equal(verified.baseline.recallAtCutoff, 1)
  assert.equal(verified.artifacts.length, 3)
  assert.equal(verified.selectionRule.minimumTop1, 0.8)
})

test('runtime closure hash covers transitive files, paths, and symlinks', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ettin-runtime-closure-'))
  await mkdir(join(root, 'node_modules', 'runtime'), { recursive: true })
  await writeFile(join(root, 'node_modules', 'runtime', 'index.mjs'), 'export {}\n')
  await symlink('runtime', join(root, 'node_modules', 'runtime-link'))
  const first = await hashRuntimeClosure(root)
  const second = await hashRuntimeClosure(root)
  assert.deepEqual(first, second)
  assert.equal(first.files, 1)
  assert.equal(first.symlinks, 1)
  await writeFile(
    join(root, 'node_modules', 'runtime', 'transitive.mjs'),
    'export const changed = true\n',
  )
  const changed = await hashRuntimeClosure(root)
  assert.notEqual(changed.sha256, first.sha256)
  assert.equal(changed.files, 2)
  const outside = await mkdtemp(join(tmpdir(), 'ettin-runtime-outside-'))
  await symlink(outside, join(root, 'node_modules', 'escape'))
  await assert.rejects(() => hashRuntimeClosure(root), /symlink escaped/)
})

test('execution rejects an external runtime that is not the frozen identity', async () => {
  await assert.rejects(
    () => verifyEttinRuntime(fileURLToPath(import.meta.url)),
    /frozen identity|ENOENT/,
  )
})

test('execution modes require complete external paths and verify is inert', async () => {
  const repositoryRuntime = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'runtime.mjs',
  )
  await assert.rejects(() => main([]), /Choose --verify, --smoke, or --run/)
  await assert.rejects(
    () => main(['--verify', '--cache', '/tmp/x']),
    /accepts no execution arguments/,
  )
  await assert.rejects(() => main(['--smoke']), /--cache is required/)
  await assert.rejects(
    () => main([
      '--run',
      '--cache', '/tmp/cache',
      '--result', '/tmp/result',
      '--runtime', repositoryRuntime,
    ]),
    /runtime must be outside the repository/,
  )
  await assert.rejects(() => main(['--unknown']), /Unknown argument/)
})

import assert from 'node:assert/strict'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  ETTIN_NATIVE_IDENTITY,
  ETTIN_RUNTIME_IDENTITY,
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

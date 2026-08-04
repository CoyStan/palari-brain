import assert from 'node:assert/strict'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  ETTIN_NATIVE_IDENTITY,
  main,
} from '../evals/run-ettin-native-bakeoff.mjs'

test('native Ettin identity reuses the unchanged frozen bank and rule', async () => {
  const verified = await main(['--verify'])
  assert.equal(verified.identity, 'brn-0009/ettin-native-v1')
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

import assert from 'node:assert/strict'
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import test from 'node:test'

import { verifyGeneratedRuntime } from '../evals/generated-runtime-verifier.mjs'

const telemetry = JSON.stringify({
  status: 'passed',
  telemetry: {
    credentialReads: 0,
    datasetReads: 0,
    providerCalls: 0,
    resultWrites: 0,
  },
})

async function fixture(source) {
  const directory = await mkdtemp(join(tmpdir(), 'palari-runtime-verifier-'))
  const runtimePath = join(directory, 'runtime.mjs')
  await writeFile(runtimePath, source, { mode: 0o600 })
  await chmod(runtimePath, 0o600)
  return {
    async cleanup() {
      await rm(directory, { recursive: true, force: true })
    },
    runtimePath,
  }
}

async function rejects(source, pattern, options = {}) {
  const created = await fixture(source)
  try {
    await assert.rejects(
      verifyGeneratedRuntime({
        requiredFunctions: ['runLocalSmoke'],
        runtimePath: created.runtimePath,
        timeoutMs: 500,
        ...options,
      }),
      pattern,
    )
  } finally {
    await created.cleanup()
  }
}

test('accepts one exact provider-free child execution', async () => {
  const created = await fixture(`
function runLocalSmoke() { return 'ok' }
if (runLocalSmoke() !== 'ok') process.exit(9)
console.log(${JSON.stringify(telemetry)})
`)
  try {
    const report = await verifyGeneratedRuntime({
      requiredFunctions: ['runLocalSmoke'],
      runtimePath: created.runtimePath,
    })
    assert.equal(report.status, 'passed')
    assert.deepEqual(report.telemetry, {
      credentialReads: 0,
      datasetReads: 0,
      providerCalls: 0,
      resultWrites: 0,
    })
  } finally {
    await created.cleanup()
  }
})

test('catches BRN-0024 helper deletion that syntax checking misses', async () => {
  let source = `
function measuredSpend() { return 0 }
function runLocalSmoke() { return 'ok' }
function sourceSession() { return null }
if (runLocalSmoke() !== 'ok') process.exit(9)
console.log(${JSON.stringify(telemetry)})
`
  const start = source.indexOf('function measuredSpend')
  const end = source.indexOf('function sourceSession', start)
  source = source.slice(0, start) +
    'function measuredSpend() { return 0 }\n' + source.slice(end)
  const created = await fixture(source)
  try {
    const syntax = spawnSync(process.execPath, ['--check', created.runtimePath], {
      encoding: 'utf8',
    })
    assert.equal(syntax.status, 0)
    await assert.rejects(
      verifyGeneratedRuntime({
        requiredFunctions: ['runLocalSmoke'],
        runtimePath: created.runtimePath,
      }),
      /exactly one runLocalSmoke definition; found 0/u,
    )
  } finally {
    await created.cleanup()
  }
})

test('rejects duplicate required definitions', async () => {
  await rejects(`
function runLocalSmoke() {}
function runLocalSmoke() {}
runLocalSmoke()
console.log(${JSON.stringify(telemetry)})
`, /found 2/u)
})

test('rejects a required definition with no retained call', async () => {
  await rejects(`
function runLocalSmoke() {}
console.log(${JSON.stringify(telemetry)})
`, /retains no call/u)
})

test('rejects nonzero exits and signals', async () => {
  await rejects(`
function runLocalSmoke() {}
runLocalSmoke()
process.exit(7)
`, /exited nonzero/u)
  await rejects(`
function runLocalSmoke() {}
runLocalSmoke()
process.kill(process.pid, 'SIGTERM')
`, /signal SIGTERM/u)
})

test('rejects timeouts and oversized output', async () => {
  await rejects(`
function runLocalSmoke() {}
runLocalSmoke()
setInterval(() => {}, 1000)
`, /timed out/u, { timeoutMs: 20 })
  await rejects(`
function runLocalSmoke() {}
runLocalSmoke()
console.log('x'.repeat(2048))
`, /output limit/u, { maxOutputBytes: 256 })
})

test('rejects invalid JSON and stderr', async () => {
  await rejects(`
function runLocalSmoke() {}
runLocalSmoke()
console.log('not-json')
`, /invalid JSON/u)
  await rejects(`
function runLocalSmoke() {}
runLocalSmoke()
console.error('unexpected')
console.log(${JSON.stringify(telemetry)})
`, /emitted stderr/u)
})

test('rejects every nonzero external-activity telemetry field', async () => {
  for (const field of [
    'providerCalls',
    'credentialReads',
    'datasetReads',
    'resultWrites',
  ]) {
    const report = {
      status: 'passed',
      telemetry: {
        credentialReads: 0,
        datasetReads: 0,
        providerCalls: 0,
        resultWrites: 0,
        [field]: 1,
      },
    }
    await rejects(`
function runLocalSmoke() {}
runLocalSmoke()
console.log(${JSON.stringify(JSON.stringify(report))})
`, new RegExp(`nonzero ${field}`, 'u'))
  }
})

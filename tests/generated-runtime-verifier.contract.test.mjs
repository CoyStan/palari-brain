import assert from 'node:assert/strict'
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import test from 'node:test'

import {
  assertOneShotAttemptTransition,
  assertReviewAttestation,
  hashStaticModuleClosure,
  verifyGeneratedRuntime,
} from '../evals/generated-runtime-verifier.mjs'

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
      /exited nonzero/u,
    )
  } finally {
    await created.cleanup()
  }
})

test('rejects duplicate top-level required definitions structurally', async () => {
  await rejects(`
function runLocalSmoke() {}
function runLocalSmoke() {}
runLocalSmoke()
console.log(${JSON.stringify(telemetry)})
`, /exited nonzero/u)
})

test('comments and strings cannot fake required function bindings', async () => {
  await rejects(`
// function runLocalSmoke() {}
const bait = 'runLocalSmoke()'
console.log(${JSON.stringify(telemetry)})
`, /missing or not executed/u)
})

test('a hard-coded pass report cannot replace executable required bindings', async () => {
  await rejects(`
function runLocalSmoke() { return true }
console.log(${JSON.stringify(telemetry)})
`, /missing or not executed/u)
})

test('moving the real required call behind an unexecuted branch cannot pass', async () => {
  await rejects(`
function runLocalSmoke() { return true }
if (false) runLocalSmoke()
console.log(${JSON.stringify(telemetry)})
`, /missing or not executed/u)
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

test('hashes the complete transitive static import and reexport closure', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'palari-module-closure-'))
  const entry = join(directory, 'entry.mjs')
  const dependency = join(directory, 'dependency.mjs')
  const reexport = join(directory, 'reexport.mjs')
  try {
    await writeFile(entry, `
import value from './dependency.mjs'
// import './ignored-comment.mjs'
const bait = "export * from './ignored-string.mjs'"
export { value }
`, { mode: 0o600 })
    await writeFile(dependency, `
export { named } from './reexport.mjs'
export default 1
`, { mode: 0o600 })
    await writeFile(reexport, 'export const named = 2\n', { mode: 0o600 })
    const before = await hashStaticModuleClosure({
      entryPaths: [entry],
      root: directory,
    })
    assert.equal(before.files, 3)
    assert.deepEqual(before.modules.map(({ path }) => path), [
      'dependency.mjs',
      'entry.mjs',
      'reexport.mjs',
    ])
    await writeFile(reexport, 'export const named = 3\n', { mode: 0o600 })
    const after = await hashStaticModuleClosure({
      entryPaths: [entry],
      root: directory,
    })
    assert.notEqual(after.sha256, before.sha256)
    assert.notEqual(
      after.modules.find(({ path }) => path === 'reexport.mjs').sha256,
      before.modules.find(({ path }) => path === 'reexport.mjs').sha256,
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('one-shot attempt states allow only absent-reserved-launched-consumed', () => {
  assert.equal(assertOneShotAttemptTransition('absent', 'reserved'), 'reserved')
  assert.equal(assertOneShotAttemptTransition('reserved', 'launched'), 'launched')
  assert.equal(assertOneShotAttemptTransition('launched', 'consumed'), 'consumed')
  for (const [current, next] of [
    ['absent', 'launched'],
    ['reserved', 'consumed'],
    ['launched', 'launched'],
    ['consumed', 'reserved'],
  ]) {
    assert.throws(
      () => assertOneShotAttemptTransition(current, next),
      /Invalid one-shot attempt transition/u,
    )
  }
})

const reviewValues = Object.freeze({
  identity: 'successor-v2',
  launcherSha256: 'launcher-sha',
  runtimeSha256: 'runtime-sha',
})

function reviewNote(namespace, overrides = {}, omissions = []) {
  const values = {
    IDENTITY: reviewValues.identity,
    LAUNCHER_SHA256: reviewValues.launcherSha256,
    RECOMMENDATION: 'ACCEPT',
    RUNTIME_SHA256: reviewValues.runtimeSha256,
    ...overrides,
  }
  return Object.entries(values)
    .filter(([field]) => !omissions.includes(field))
    .map(([field, value]) => `${namespace}_${field}: ${value}`)
    .join('\n')
}

test('review attestation preserves the legacy namespace by default', () => {
  const accepted = reviewNote('BRN0025_REVIEW')
  assert.deepEqual(assertReviewAttestation({
    identity: 'successor-v2',
    launcherSha256: 'launcher-sha',
    note: accepted,
    runtimeSha256: 'runtime-sha',
  }), {
    identity: 'successor-v2',
    launcherSha256: 'launcher-sha',
    recommendation: 'ACCEPT',
    runtimeSha256: 'runtime-sha',
  })
  assert.equal(accepted.includes('REVIEW_HEAD'), false)
})

test('review attestation accepts one caller-selected generic namespace', () => {
  assert.deepEqual(assertReviewAttestation({
    ...reviewValues,
    markerNamespace: 'PALARI_REVIEW',
    note: reviewNote('PALARI_REVIEW'),
  }), {
    ...reviewValues,
    recommendation: 'ACCEPT',
  })
})

test('review attestation rejects malformed marker namespaces', () => {
  for (const markerNamespace of [
    '',
    'lowercase',
    'PALARI-REVIEW',
    '1PALARI_REVIEW',
    '_PALARI_REVIEW',
    'PALARI REVIEW',
    'A'.repeat(65),
    null,
    42,
  ]) {
    assert.throws(() => assertReviewAttestation({
      ...reviewValues,
      markerNamespace,
      note: reviewNote('PALARI_REVIEW'),
    }), /uppercase identifier of 1-64 characters/u)
  }
  assert.doesNotThrow(() => assertReviewAttestation({
    ...reviewValues,
    markerNamespace: 'A'.repeat(64),
    note: reviewNote('A'.repeat(64)),
  }))
})

test('review attestation requires every selected marker exactly once', () => {
  for (const field of [
    'IDENTITY',
    'LAUNCHER_SHA256',
    'RUNTIME_SHA256',
    'RECOMMENDATION',
  ]) {
    const missing = reviewNote('PALARI_REVIEW', {}, [field])
    assert.throws(() => assertReviewAttestation({
      ...reviewValues,
      markerNamespace: 'PALARI_REVIEW',
      note: missing,
    }), new RegExp(`one exact PALARI_REVIEW_${field} marker`, 'u'))

    const duplicated = [
      reviewNote('PALARI_REVIEW'),
      `PALARI_REVIEW_${field}: duplicate`,
    ].join('\n')
    assert.throws(() => assertReviewAttestation({
      ...reviewValues,
      markerNamespace: 'PALARI_REVIEW',
      note: duplicated,
    }), new RegExp(`one exact PALARI_REVIEW_${field} marker`, 'u'))
  }
})

test('review attestation rejects every mismatched bound value', () => {
  for (const [field, value] of [
    ['IDENTITY', 'other-identity'],
    ['LAUNCHER_SHA256', 'other-launcher'],
    ['RUNTIME_SHA256', 'other-runtime'],
    ['RECOMMENDATION', 'PENDING'],
  ]) {
    assert.throws(() => assertReviewAttestation({
      ...reviewValues,
      markerNamespace: 'PALARI_REVIEW',
      note: reviewNote('PALARI_REVIEW', { [field]: value }),
    }), /not ACCEPT/u)
  }
})

test('review attestation fails closed across marker namespaces', () => {
  assert.throws(() => assertReviewAttestation({
    ...reviewValues,
    markerNamespace: 'PALARI_REVIEW',
    note: reviewNote('BRN0025_REVIEW'),
  }), /one exact PALARI_REVIEW_IDENTITY marker/u)
  assert.throws(() => assertReviewAttestation({
    ...reviewValues,
    note: reviewNote('PALARI_REVIEW'),
  }), /one exact BRN0025_REVIEW_IDENTITY marker/u)

  const mixed = [
    'PALARI_REVIEW_IDENTITY: successor-v2',
    'BRN0025_REVIEW_LAUNCHER_SHA256: launcher-sha',
    'BRN0025_REVIEW_RUNTIME_SHA256: runtime-sha',
    'BRN0025_REVIEW_RECOMMENDATION: ACCEPT',
  ].join('\n')
  assert.throws(() => assertReviewAttestation({
    ...reviewValues,
    markerNamespace: 'PALARI_REVIEW',
    note: mixed,
  }), /one exact PALARI_REVIEW_LAUNCHER_SHA256 marker/u)
})

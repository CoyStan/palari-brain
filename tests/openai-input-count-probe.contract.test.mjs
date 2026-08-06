import assert from 'node:assert/strict'
import {
  access,
  mkdtemp,
  readFile,
  stat,
  symlink,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  OPENAI_INPUT_COUNT_AUTHORITY,
  OPENAI_INPUT_COUNT_PROBE,
  OPENAI_INPUT_COUNT_REQUEST,
  OPENAI_INPUT_COUNT_REQUEST_SHA256,
  assertOpenAIInputCountPreflight,
  createOpenAIInputCountResultStore,
  parseOpenAIInputCountProbeArgs,
  runOpenAIInputCountProbe,
} from '../evals/openai-input-count-probe.mjs'

const HEAD = 'a'.repeat(40)

function preflight(overrides = {}) {
  return {
    authority: OPENAI_INPUT_COUNT_AUTHORITY,
    clean: true,
    cumulativeCapUsd: OPENAI_INPUT_COUNT_PROBE.cumulativeCapUsd,
    freshCapUsd: OPENAI_INPUT_COUNT_PROBE.freshCapUsd,
    head: HEAD,
    identity: OPENAI_INPUT_COUNT_PROBE.identity,
    namespaceAbsent: true,
    reviewedHead: HEAD,
    upstreamHead: HEAD,
    ...overrides,
  }
}

function harness({ response, transportError } = {}) {
  const events = []
  const sealed = []
  let calls = 0
  return {
    calls: () => calls,
    events,
    options: {
      async beginReservation(value) {
        events.push(['reserve', value])
      },
      async invoke(value) {
        calls += 1
        events.push(['invoke', value])
        if (transportError) throw transportError
        return response ?? {
          body: {
            object: 'response.input_tokens',
            input_tokens: 137,
          },
          status: 200,
        }
      },
      now: (() => {
        const values = [1_000, 1_023]
        return () => values.shift() ?? 1_023
      })(),
      preflight: preflight(),
      async readCredential() {
        events.push(['credential'])
        return 'test-key-never-persisted'
      },
      async seal(value) {
        events.push(['seal', value])
        sealed.push(value)
      },
    },
    sealed,
  }
}

test('frozen wire is the documented structured count shape', () => {
  assert.equal(OPENAI_INPUT_COUNT_REQUEST.model, 'gpt-5.6-sol')
  assert.equal(OPENAI_INPUT_COUNT_REQUEST.input[0].role, 'user')
  assert.equal(OPENAI_INPUT_COUNT_REQUEST.input[0].content[0].type, 'input_text')
  assert.equal(OPENAI_INPUT_COUNT_REQUEST.tools[0].type, 'function')
  assert.equal(OPENAI_INPUT_COUNT_REQUEST.tools[0].strict, true)
  assert.equal(
    OPENAI_INPUT_COUNT_REQUEST.tools[0].parameters.additionalProperties,
    false,
  )
  for (const key of [
    'max_output_tokens',
    'store',
    'service_tier',
    'reasoning',
  ]) assert.equal(Object.hasOwn(OPENAI_INPUT_COUNT_REQUEST, key), false)
  assert.match(OPENAI_INPUT_COUNT_REQUEST_SHA256, /^[0-9a-f]{64}$/u)
  assert.equal(Object.isFrozen(OPENAI_INPUT_COUNT_REQUEST), true)
})

test('success reserves before credential and invokes exactly once', async () => {
  const run = harness()
  const terminal = await runOpenAIInputCountProbe(run.options)
  assert.deepEqual(run.events.map((entry) => entry[0]), [
    'reserve',
    'credential',
    'invoke',
    'seal',
  ])
  assert.equal(run.calls(), 1)
  assert.equal(terminal.outcome, 'compatible')
  assert.equal(terminal.inputTokens, 137)
  assert.equal(terminal.invocationCount, 1)
  assert.equal(terminal.reviewedHead, HEAD)
  assert.equal(terminal.accountedFreshUsd, '0.05')
  assert.equal(terminal.cumulativeAccountedUsd, '7.80502179')
  assert.equal(terminal.reservationStatus, 'uncertain-accounted')
  assert.equal(terminal.elapsedMs, 23)
})

test('all authority and pre-dispatch boundaries fail before dependencies', async () => {
  const invalid = [
    { authority: 'okay' },
    { identity: 'replacement' },
    { freshCapUsd: '0.0500001' },
    { cumulativeCapUsd: '7.80502180' },
    { clean: false },
    { namespaceAbsent: false },
    { head: 'b'.repeat(40) },
    { upstreamHead: 'b'.repeat(40) },
    { reviewedHead: 'short' },
    { extra: true },
  ]
  for (const override of invalid) {
    const run = harness()
    run.options.preflight = preflight(override)
    await assert.rejects(runOpenAIInputCountProbe(run.options))
    assert.deepEqual(run.events, [])
    assert.equal(run.calls(), 0)
  }
})

test('malformed provider response is terminal without retry', async () => {
  const run = harness({
    response: {
      body: { object: 'response.input_tokens', input_tokens: '137' },
      status: 200,
    },
  })
  await assert.rejects(
    runOpenAIInputCountProbe(run.options),
    (error) => error.terminal?.outcome === 'failed',
  )
  assert.equal(run.calls(), 1)
  assert.equal(run.sealed.length, 1)
  assert.equal(run.sealed[0].invocationCount, 1)
  assert.equal(run.sealed[0].accountedFreshUsd, '0.05')
})

test('HTTP and transport failures each consume one attempt and retain cap', async () => {
  for (const variant of [
    { response: { body: { error: { message: 'bad request' } }, status: 400 } },
    { transportError: new Error('network uncertain') },
  ]) {
    const run = harness(variant)
    await assert.rejects(runOpenAIInputCountProbe(run.options))
    assert.equal(run.calls(), 1)
    assert.equal(run.sealed.length, 1)
    assert.equal(run.sealed[0].reservationStatus, 'uncertain-accounted')
    assert.equal(run.sealed[0].cumulativeAccountedUsd, '7.80502179')
  }
})

test('missing credential consumes the authorized identity without transport', async () => {
  const run = harness()
  run.options.readCredential = async () => {
    run.events.push(['credential'])
    return ''
  }
  await assert.rejects(runOpenAIInputCountProbe(run.options))
  assert.equal(run.calls(), 0)
  assert.equal(run.sealed.length, 1)
  assert.equal(run.sealed[0].errorCode, 'CREDENTIAL_MISSING')
})

test('private result store seals mode-0600 evidence and refuses reuse', async () => {
  const root = await mkdtemp(join(tmpdir(), 'palari-input-count-'))
  const store = createOpenAIInputCountResultStore({ repoRoot: root })
  assert.equal(await store.namespaceAbsent(), true)
  store.setCredentialForScan('credential-that-must-not-appear')
  await store.beginReservation({ amount: '0.05' })
  await store.seal({ outcome: 'compatible' })
  assert.equal(await store.namespaceAbsent(), false)
  for (const name of ['reservation.json', 'terminal.json', 'manifest.json']) {
    const path = join(store.identityPath, name)
    const metadata = await stat(path)
    assert.equal(metadata.mode & 0o777, 0o600)
    assert.doesNotMatch(
      await readFile(path, 'utf8'),
      /credential-that-must-not-appear/u,
    )
  }
  await assert.rejects(store.beginReservation({ amount: '0.05' }))
  await assert.rejects(store.seal({ outcome: 'compatible' }))
})

test('credential-byte leak blocks manifest seal', async () => {
  const root = await mkdtemp(join(tmpdir(), 'palari-input-count-leak-'))
  const store = createOpenAIInputCountResultStore({ repoRoot: root })
  store.setCredentialForScan('accidental-secret')
  await store.beginReservation({ amount: '0.05' })
  await assert.rejects(
    store.seal({ outcome: 'failed', accidental: 'accidental-secret' }),
    (error) => error.code === 'CREDENTIAL_LEAK',
  )
})

test('symlinked result root is rejected without writing outside repo', async () => {
  const repoRoot = await mkdtemp(join(tmpdir(), 'palari-count-repo-'))
  const outside = await mkdtemp(join(tmpdir(), 'palari-count-outside-'))
  await symlink(outside, join(repoRoot, '.palari-input-count'))
  const store = createOpenAIInputCountResultStore({ repoRoot })
  await assert.rejects(
    store.namespaceAbsent(),
    (error) => error.code === 'RESULT_ROOT_UNSAFE',
  )
  await assert.rejects(
    store.beginReservation({ amount: '0.05' }),
    (error) => error.code === 'RESULT_ROOT_UNSAFE',
  )
  await assert.rejects(
    access(join(outside, OPENAI_INPUT_COUNT_PROBE.identity)),
    (error) => error.code === 'ENOENT',
  )
})

test('fresh root and identity are physical private directories', async () => {
  const repoRoot = await mkdtemp(join(tmpdir(), 'palari-count-physical-'))
  const store = createOpenAIInputCountResultStore({ repoRoot })
  await store.beginReservation({ amount: '0.05' })
  const rootMetadata = await stat(join(repoRoot, '.palari-input-count'))
  const identityMetadata = await stat(store.identityPath)
  assert.equal(rootMetadata.isDirectory(), true)
  assert.equal(identityMetadata.isDirectory(), true)
  assert.equal(rootMetadata.mode & 0o777, 0o700)
  assert.equal(identityMetadata.mode & 0o777, 0o700)
  await store.seal({ outcome: 'compatible' })
})

test('CLI requires one explicit mode and full reviewed head for run', () => {
  assert.deepEqual(parseOpenAIInputCountProbeArgs(['--verify']), {
    mode: 'verify',
    reviewedHead: null,
  })
  assert.deepEqual(
    parseOpenAIInputCountProbeArgs(['--run', '--reviewed-head', HEAD]),
    { mode: 'run', reviewedHead: HEAD },
  )
  assert.throws(() => parseOpenAIInputCountProbeArgs([]))
  assert.throws(() => parseOpenAIInputCountProbeArgs(['--run']))
  assert.throws(() => parseOpenAIInputCountProbeArgs(['--verify', '--run']))
  assert.throws(() => parseOpenAIInputCountProbeArgs(['--unknown']))
})

test('preflight validator returns an immutable exact snapshot', () => {
  const source = preflight()
  const accepted = assertOpenAIInputCountPreflight(source)
  source.clean = false
  assert.equal(accepted.clean, true)
  assert.equal(Object.isFrozen(accepted), true)
})

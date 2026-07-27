import assert from 'node:assert/strict'
import { mkdtemp, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  assertDevProbeAuthorized,
  DEV_PROBE_DEFAULT_CAP_USD,
  devProbeRequest,
  runDevProviderProbe,
} from '../evals/dev-provider-probe.mjs'
import { parseDevProbeArgs } from '../evals/run-dev-provider-probe.mjs'

const AUTHORIZED = Object.freeze({
  GEMINI_API_KEY: 'fake-probe-key',
  PALARI_PROBE_CONFIRM_SPEND: '1',
})

test('the probe refuses to dispatch without founder confirmation', () => {
  // The ceremony is what the probe removes. The spend gate stays.
  assert.throws(
    () => assertDevProbeAuthorized({ GEMINI_API_KEY: 'fake-probe-key' }),
    { code: 'PROBE_CONFIRMATION_MISSING' },
  )
  assert.throws(
    () => assertDevProbeAuthorized({
      ...AUTHORIZED,
      PALARI_PROBE_CONFIRM_SPEND: 'yes',
    }),
    { code: 'PROBE_CONFIRMATION_MISSING' },
  )
})

test('the probe reads no credential until both gates pass', () => {
  const env = new Proxy({}, {
    get(_target, property) {
      if (['GEMINI_API_KEY', 'GOOGLE_API_KEY'].includes(property)) {
        assert.fail(`credential ${property} was read`)
      }
      if (property === 'PALARI_PROBE_CONFIRM_SPEND') return '1'
      if (property === 'PALARI_PROBE_CAP_USD') return '5'
      return undefined
    },
  })
  assert.throws(
    () => assertDevProbeAuthorized(env),
    { code: 'PROBE_CAP_INVALID' },
  )
})

test('the probe cap is small by default and cannot be raised past a dollar',
  () => {
    assert.deepEqual(
      assertDevProbeAuthorized(AUTHORIZED),
      { capUsd: DEV_PROBE_DEFAULT_CAP_USD, geminiApiKey: 'fake-probe-key' },
    )
    assert.equal(
      assertDevProbeAuthorized({
        ...AUTHORIZED,
        PALARI_PROBE_CAP_USD: '0.25',
      }).capUsd,
      0.25,
    )
    for (const capUsd of ['0', '-1', '1.01', '25', 'lots', 'Infinity']) {
      assert.throws(
        () => assertDevProbeAuthorized({
          ...AUTHORIZED,
          PALARI_PROBE_CAP_USD: capUsd,
        }),
        { code: 'PROBE_CAP_INVALID' },
        capUsd,
      )
    }
    assert.throws(
      () => assertDevProbeAuthorized({
        ...AUTHORIZED,
        GEMINI_API_KEY: '',
      }),
      { code: 'PROBE_CREDENTIAL_MISSING' },
    )
  })

test('the probe scenario carries a correction and a spoken time anchor', () => {
  const request = devProbeRequest()
  assert.equal(request.input.evidence.length, 3)
  assert.equal(request.input.prior.length, 1)
  assert.deepEqual(
    request.input.evidence.map((entry) => entry.speaker),
    ['user', 'Palari', 'user'],
  )
  // A later message that supersedes an earlier one — the case the reducer
  // exists for, and the one a single-message probe would never exercise.
  assert.match(request.input.evidence[2].text, /Since last month/)
  assert.ok(request.input.evidence[2].observedAt >
    request.input.evidence[0].observedAt)
  // No benchmark content: the probe must never make the dataset a dependency.
  for (const entry of request.input.evidence) {
    assert.ok(entry.id.startsWith('probe-'))
  }
})

test('the probe writes nothing into the sealed results tree', async () => {
  const root = await mkdtemp(join(tmpdir(), 'palari-probe-'))
  let dispatches = 0
  const summary = await runDevProviderProbe({
    attempts: 2,
    env: AUTHORIZED,
    fetchImpl: async () => {
      dispatches += 1
      throw new Error('probe fetch refused in test')
    },
    log: () => {},
    probeRoot: root,
  })

  // The first transport fault ends the probe rather than burning the cap.
  assert.equal(summary.rejected, 1)
  assert.equal(summary.accepted, 0)
  assert.equal(summary.capUsd, DEV_PROBE_DEFAULT_CAP_USD)
  assert.equal(dispatches <= 1, true)

  const written = await readdir(root)
  assert.ok(written.length >= 1)
  assert.ok(!written.includes('results'))
})

test('probe flags are explicit and unknown flags are refused', () => {
  assert.deepEqual(parseDevProbeArgs([]), { attempts: 1, maxRepairs: 1 })
  assert.deepEqual(
    parseDevProbeArgs(['--attempts', '5', '--repairs', '0']),
    { attempts: 5, maxRepairs: 0 },
  )
  assert.throws(() => parseDevProbeArgs(['--dataset', 'x']), TypeError)
  assert.throws(() => parseDevProbeArgs(['--attempts', '-1']), TypeError)
})

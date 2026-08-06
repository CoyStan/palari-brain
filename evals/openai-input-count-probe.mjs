#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import {
  chmod,
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  stat,
} from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import {
  createOpenAIInputCounter,
  snapshotOpenAIResponseBody,
} from './openai-input-reservation.mjs'

const execFileAsync = promisify(execFile)

export const OPENAI_INPUT_COUNT_PROBE = Object.freeze({
  cumulativeCapPicodollars: '7805021790000',
  cumulativeCapUsd: '7.80502179',
  endpoint: 'https://api.openai.com/v1/responses/input_tokens',
  freshCapPicodollars: '50000000000',
  freshCapUsd: '0.05',
  identity: 'openai-structured-input-count-compat-v1',
  model: 'gpt-5.6-sol',
  openingAccountedPicodollars: '7755021790000',
  openingAccountedUsd: '7.75502179',
  resultRoot: '.palari-input-count',
  ticket: 'BRN-0022',
})

export const OPENAI_INPUT_COUNT_AUTHORITY =
  'I authorize BRN-0022 openai-structured-input-count-compat-v1 for one ' +
  'invocation under the $0.05 fresh / $7.80502179 cumulative accounted cap.'

const wire = snapshotOpenAIResponseBody({
  model: OPENAI_INPUT_COUNT_PROBE.model,
  instructions: 'Use supplied memory evidence only when it is relevant.',
  input: [{
    role: 'user',
    content: [{
      type: 'input_text',
      text: 'For compatibility testing, count this request; do not answer it.',
    }],
  }],
  tools: [{
    type: 'function',
    name: 'memory_read',
    description: 'Read one canonical memory record by identifier.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Canonical memory identifier.',
        },
      },
      required: ['id'],
      additionalProperties: false,
    },
  }],
})

export const OPENAI_INPUT_COUNT_REQUEST = wire.body
export const OPENAI_INPUT_COUNT_REQUEST_TEXT = wire.bodyText
export const OPENAI_INPUT_COUNT_REQUEST_SHA256 = sha256(wire.bodyText)

export class OpenAIInputCountProbeError extends Error {
  constructor(code, message, details = undefined) {
    super(message)
    this.code = code
    this.details = details
    this.name = 'OpenAIInputCountProbeError'
  }
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function assertExactString(actual, expected, code, label) {
  if (actual !== expected) {
    throw new OpenAIInputCountProbeError(code, `${label} differs from freeze.`)
  }
}

export function assertOpenAIInputCountPreflight(preflight) {
  let snapshot
  try {
    snapshot = snapshotOpenAIResponseBody(preflight).body
  } catch {
    throw new OpenAIInputCountProbeError(
      'PREFLIGHT_INVALID',
      'Preflight must be one plain JSON object.',
    )
  }
  const expectedKeys = [
    'authority',
    'clean',
    'cumulativeCapUsd',
    'freshCapUsd',
    'head',
    'identity',
    'namespaceAbsent',
    'reviewedHead',
    'upstreamHead',
  ]
  const actualKeys = Object.keys(snapshot)
  if (actualKeys.length !== expectedKeys.length || expectedKeys.some(
    (key) => !Object.hasOwn(snapshot, key),
  )) {
    throw new OpenAIInputCountProbeError(
      'PREFLIGHT_INVALID',
      'Preflight fields differ from the exact contract.',
    )
  }
  assertExactString(
    snapshot.authority,
    OPENAI_INPUT_COUNT_AUTHORITY,
    'AUTHORITY_INVALID',
    'Founder authority',
  )
  assertExactString(
    snapshot.identity,
    OPENAI_INPUT_COUNT_PROBE.identity,
    'IDENTITY_INVALID',
    'Identity',
  )
  assertExactString(
    snapshot.freshCapUsd,
    OPENAI_INPUT_COUNT_PROBE.freshCapUsd,
    'CAP_INVALID',
    'Fresh cap',
  )
  assertExactString(
    snapshot.cumulativeCapUsd,
    OPENAI_INPUT_COUNT_PROBE.cumulativeCapUsd,
    'CAP_INVALID',
    'Cumulative cap',
  )
  if (!/^[0-9a-f]{40}$/u.test(snapshot.reviewedHead ?? '') ||
    snapshot.head !== snapshot.reviewedHead ||
    snapshot.upstreamHead !== snapshot.reviewedHead) {
    throw new OpenAIInputCountProbeError(
      'HEAD_INVALID',
      'Current, reviewed, and pushed heads must be the same exact commit.',
    )
  }
  if (snapshot.clean !== true) {
    throw new OpenAIInputCountProbeError(
      'WORKTREE_DIRTY',
      'The reviewed worktree must be clean.',
    )
  }
  if (snapshot.namespaceAbsent !== true) {
    throw new OpenAIInputCountProbeError(
      'IDENTITY_CONSUMED',
      'The one-shot result namespace already exists.',
    )
  }
  return snapshot
}

function terminalError(
  error,
  invocationCount,
  elapsedMs,
  reviewedHead,
  status = null,
) {
  return Object.freeze({
    accountedFreshPicodollars: OPENAI_INPUT_COUNT_PROBE.freshCapPicodollars,
    accountedFreshUsd: OPENAI_INPUT_COUNT_PROBE.freshCapUsd,
    cumulativeAccountedPicodollars:
      OPENAI_INPUT_COUNT_PROBE.cumulativeCapPicodollars,
    cumulativeAccountedUsd: OPENAI_INPUT_COUNT_PROBE.cumulativeCapUsd,
    elapsedMs,
    errorCode: typeof error?.code === 'string'
      ? error.code
      : 'INPUT_COUNT_PROBE_FAILED',
    identity: OPENAI_INPUT_COUNT_PROBE.identity,
    invocationCount,
    model: OPENAI_INPUT_COUNT_PROBE.model,
    outcome: 'failed',
    requestSha256: OPENAI_INPUT_COUNT_REQUEST_SHA256,
    reservationStatus: 'uncertain-accounted',
    reviewedHead,
    status,
  })
}

export async function runOpenAIInputCountProbe({
  beginReservation,
  invoke,
  now = () => Date.now(),
  preflight,
  readCredential,
  seal,
} = {}) {
  const acceptedPreflight = assertOpenAIInputCountPreflight(preflight)
  for (const [name, value] of Object.entries({
    beginReservation,
    invoke,
    readCredential,
    seal,
  })) {
    if (typeof value !== 'function') {
      throw new OpenAIInputCountProbeError(
        'DEPENDENCY_INVALID',
        `${name} must be a function.`,
      )
    }
  }

  const reservation = Object.freeze({
    accountedPicodollars: OPENAI_INPUT_COUNT_PROBE.freshCapPicodollars,
    accountedUsd: OPENAI_INPUT_COUNT_PROBE.freshCapUsd,
    billingTreatment: 'unknown-full-cap-retained',
    cumulativeCapPicodollars:
      OPENAI_INPUT_COUNT_PROBE.cumulativeCapPicodollars,
    cumulativeCapUsd: OPENAI_INPUT_COUNT_PROBE.cumulativeCapUsd,
    identity: OPENAI_INPUT_COUNT_PROBE.identity,
    openingAccountedPicodollars:
      OPENAI_INPUT_COUNT_PROBE.openingAccountedPicodollars,
    openingAccountedUsd: OPENAI_INPUT_COUNT_PROBE.openingAccountedUsd,
    requestSha256: OPENAI_INPUT_COUNT_REQUEST_SHA256,
    reviewedHead: acceptedPreflight.reviewedHead,
    state: 'uncertain-accounted',
  })
  await beginReservation(reservation)

  let invocationCount = 0
  let status = null
  const startedAt = now()
  try {
    const apiKey = await readCredential()
    if (typeof apiKey !== 'string' || apiKey.trim().length < 1) {
      throw new OpenAIInputCountProbeError(
        'CREDENTIAL_MISSING',
        'OPENAI_API_KEY is absent.',
      )
    }

    let transportRecord = null
    const counter = createOpenAIInputCounter({
      invoke: async (body) => {
        invocationCount += 1
        if (invocationCount !== 1) {
          throw new OpenAIInputCountProbeError(
            'INVOCATION_LIMIT',
            'The one-shot probe permits exactly one transport invocation.',
          )
        }
        transportRecord = await invoke({
          apiKey,
          body,
          endpoint: OPENAI_INPUT_COUNT_PROBE.endpoint,
        })
        if (!transportRecord || typeof transportRecord !== 'object' ||
          Array.isArray(transportRecord)) {
          throw new OpenAIInputCountProbeError(
            'TRANSPORT_RESPONSE_INVALID',
            'Transport must return one response record.',
          )
        }
        status = transportRecord.status
        if (status !== 200) {
          throw new OpenAIInputCountProbeError(
            'HTTP_STATUS_INVALID',
            'Input-count endpoint did not return HTTP 200.',
            { status },
          )
        }
        return transportRecord.body
      },
    })
    const count = await counter(OPENAI_INPUT_COUNT_REQUEST)
    const elapsedMs = now() - startedAt
    if (!Number.isSafeInteger(elapsedMs) || elapsedMs < 0) {
      throw new OpenAIInputCountProbeError(
        'CLOCK_INVALID',
        'Elapsed time must be a non-negative safe integer.',
      )
    }
    const responseText = JSON.stringify(transportRecord.body)
    const terminal = Object.freeze({
      accountedFreshPicodollars: OPENAI_INPUT_COUNT_PROBE.freshCapPicodollars,
      accountedFreshUsd: OPENAI_INPUT_COUNT_PROBE.freshCapUsd,
      cumulativeAccountedPicodollars:
        OPENAI_INPUT_COUNT_PROBE.cumulativeCapPicodollars,
      cumulativeAccountedUsd: OPENAI_INPUT_COUNT_PROBE.cumulativeCapUsd,
      elapsedMs,
      identity: OPENAI_INPUT_COUNT_PROBE.identity,
      inputTokens: count.inputTokens,
      invocationCount,
      model: OPENAI_INPUT_COUNT_PROBE.model,
      outcome: 'compatible',
      requestSha256: OPENAI_INPUT_COUNT_REQUEST_SHA256,
      reservationStatus: 'uncertain-accounted',
      reviewedHead: acceptedPreflight.reviewedHead,
      responseSha256: sha256(responseText),
      status,
    })
    await seal(terminal)
    return terminal
  } catch (error) {
    const elapsedMs = Math.max(0, Number(now()) - Number(startedAt))
    const terminal = terminalError(
      error,
      invocationCount,
      elapsedMs,
      acceptedPreflight.reviewedHead,
      status,
    )
    try {
      await seal(terminal)
    } catch (sealError) {
      throw new OpenAIInputCountProbeError(
        'SEAL_FAILED',
        'The terminal probe result could not be sealed.',
        { causeCode: sealError?.code ?? null },
      )
    }
    const failure = new OpenAIInputCountProbeError(
      terminal.errorCode,
      'The input-count compatibility probe terminated without a retry.',
    )
    failure.terminal = terminal
    throw failure
  }
}

async function writePrivateJson(path, value) {
  const handle = await open(path, 'wx', 0o600)
  try {
    await handle.chmod(0o600)
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8')
    await handle.sync()
  } finally {
    await handle.close()
  }
  const metadata = await stat(path)
  if (!metadata.isFile() || (metadata.mode & 0o777) !== 0o600) {
    throw new OpenAIInputCountProbeError(
      'PRIVATE_MODE_INVALID',
      `${basename(path)} is not a private regular file.`,
    )
  }
}

async function syncDirectory(path) {
  const handle = await open(path, 'r')
  try {
    await handle.sync()
  } finally {
    await handle.close()
  }
}

async function pathAbsent(path) {
  try {
    await lstat(path)
    return false
  } catch (error) {
    if (error?.code === 'ENOENT') return true
    throw error
  }
}

async function openPrivateDirectory(path, expectedPhysicalPath) {
  const metadata = await lstat(path)
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    throw new OpenAIInputCountProbeError(
      'PRIVATE_DIRECTORY_INVALID',
      `${basename(path)} must be a real private directory.`,
    )
  }
  await chmod(path, 0o700)
  const physicalPath = await realpath(path)
  if (physicalPath !== expectedPhysicalPath) {
    throw new OpenAIInputCountProbeError(
      'PRIVATE_DIRECTORY_ESCAPE',
      `${basename(path)} escaped its physical repository location.`,
    )
  }
  const handle = await open(path, 'r')
  try {
    const opened = await handle.stat()
    const descriptorPath = `/proc/self/fd/${handle.fd}`
    const descriptorPhysicalPath = await realpath(descriptorPath)
    if (!opened.isDirectory() || opened.dev !== metadata.dev ||
      opened.ino !== metadata.ino ||
      descriptorPhysicalPath !== expectedPhysicalPath) {
      throw new OpenAIInputCountProbeError(
        'PRIVATE_DIRECTORY_CHANGED',
        `${basename(path)} changed while its descriptor was opened.`,
      )
    }
    return { descriptorPath, handle, physicalPath }
  } catch (error) {
    await handle.close()
    throw error
  }
}

export function createOpenAIInputCountResultStore({
  repoRoot,
  resultRoot = OPENAI_INPUT_COUNT_PROBE.resultRoot,
} = {}) {
  if (typeof repoRoot !== 'string' || !isAbsolute(repoRoot)) {
    throw new OpenAIInputCountProbeError(
      'RESULT_ROOT_INVALID',
      'repoRoot must be absolute.',
    )
  }
  if (resultRoot !== OPENAI_INPUT_COUNT_PROBE.resultRoot) {
    throw new OpenAIInputCountProbeError(
      'RESULT_ROOT_INVALID',
      'resultRoot must be the frozen private directory segment.',
    )
  }
  const root = resolve(repoRoot, resultRoot)
  const identityPath = join(root, OPENAI_INPUT_COUNT_PROBE.identity)
  if (dirname(identityPath) !== root) {
    throw new OpenAIInputCountProbeError(
      'RESULT_ROOT_INVALID',
      'Identity escaped the private result root.',
    )
  }
  let begun = false
  let sealed = false
  let credentialForScan = null
  let rootDirectory = null
  let identityDirectory = null

  async function inspectRoot() {
    const repoPhysical = await realpath(repoRoot)
    const expectedRootPhysical = join(repoPhysical, resultRoot)
    let rootMetadata
    try {
      rootMetadata = await lstat(root)
    } catch (error) {
      if (error?.code === 'ENOENT') {
        return { expectedRootPhysical, repoPhysical, rootAbsent: true }
      }
      throw error
    }
    if (rootMetadata.isSymbolicLink() || !rootMetadata.isDirectory() ||
      await realpath(root) !== expectedRootPhysical) {
      throw new OpenAIInputCountProbeError(
        'RESULT_ROOT_UNSAFE',
        'The private result root is not a physical repository directory.',
      )
    }
    return { expectedRootPhysical, repoPhysical, rootAbsent: false }
  }

  async function closeDirectories() {
    const errors = []
    for (const directory of [identityDirectory, rootDirectory]) {
      if (!directory) continue
      try {
        await directory.handle.close()
      } catch (error) {
        errors.push(error)
      }
    }
    identityDirectory = null
    rootDirectory = null
    if (errors.length) throw errors[0]
  }

  return Object.freeze({
    identityPath,
    async namespaceAbsent() {
      await inspectRoot()
      return pathAbsent(identityPath)
    },
    setCredentialForScan(value) {
      credentialForScan = value
    },
    async beginReservation(reservation) {
      if (begun) {
        throw new OpenAIInputCountProbeError(
          'RESERVATION_DUPLICATE',
          'Reservation was already begun.',
        )
      }
      const inspected = await inspectRoot()
      try {
        if (inspected.rootAbsent) {
          await mkdir(root, { mode: 0o700 })
          // The result-root directory entry itself must survive a crash before
          // a billed dispatch, not only the files written beneath it.
          await syncDirectory(repoRoot)
        }
        rootDirectory = await openPrivateDirectory(
          root,
          inspected.expectedRootPhysical,
        )
        const descriptorIdentityPath = join(
          rootDirectory.descriptorPath,
          OPENAI_INPUT_COUNT_PROBE.identity,
        )
        await mkdir(descriptorIdentityPath, { mode: 0o700 })
        identityDirectory = await openPrivateDirectory(
          descriptorIdentityPath,
          join(
            inspected.expectedRootPhysical,
            OPENAI_INPUT_COUNT_PROBE.identity,
          ),
        )
        await writePrivateJson(
          join(identityDirectory.descriptorPath, 'reservation.json'),
          reservation,
        )
        await identityDirectory.handle.sync()
        await rootDirectory.handle.sync()
        begun = true
      } catch (error) {
        try {
          await closeDirectories()
        } catch {}
        throw error
      }
    },
    async seal(terminal) {
      if (!begun || sealed) {
        throw new OpenAIInputCountProbeError(
          'SEAL_STATE_INVALID',
          'Terminal seal requires one unsealed reservation.',
        )
      }
      if (!identityDirectory || !rootDirectory) {
        throw new OpenAIInputCountProbeError(
          'SEAL_STATE_INVALID',
          'Terminal seal lost its owned directory descriptors.',
        )
      }
      try {
        const terminalPath = join(
          identityDirectory.descriptorPath,
          'terminal.json',
        )
        await writePrivateJson(terminalPath, terminal)
        const artifactNames = ['reservation.json', 'terminal.json']
        const artifacts = []
        for (const name of artifactNames) {
          const path = join(identityDirectory.descriptorPath, name)
          const bytes = await readFile(path)
          if (credentialForScan &&
            bytes.includes(Buffer.from(credentialForScan))) {
            throw new OpenAIInputCountProbeError(
              'CREDENTIAL_LEAK',
              'A private artifact contains credential bytes.',
            )
          }
          const metadata = await stat(path)
          artifacts.push({
            mode: (metadata.mode & 0o777).toString(8).padStart(4, '0'),
            name,
            sha256: sha256(bytes),
            size: bytes.length,
          })
        }
        const manifest = {
          artifacts,
          credentialMatches: 0,
          identity: OPENAI_INPUT_COUNT_PROBE.identity,
          outcome: terminal.outcome,
          sealed: true,
        }
        await writePrivateJson(
          join(identityDirectory.descriptorPath, 'manifest.json'),
          manifest,
        )
        await identityDirectory.handle.sync()
        await rootDirectory.handle.sync()
        await closeDirectories()
        sealed = true
      } catch (error) {
        try {
          await closeDirectories()
        } catch {}
        throw error
      }
    },
  })
}

export async function inspectGitPreflight({ repoRoot, reviewedHead }) {
  const run = async (...args) => (await execFileAsync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
  })).stdout.trim()
  const branch = await run('branch', '--show-current')
  const head = await run('rev-parse', 'HEAD')
  const upstreamHead = await run('rev-parse', `origin/${branch}`)
  const dirty = await run('status', '--porcelain')
  return {
    branch,
    clean: dirty === '',
    head,
    reviewedHead,
    upstreamHead,
  }
}

export function parseOpenAIInputCountProbeArgs(argv) {
  const options = { mode: null, reviewedHead: null }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--verify' || arg === '--run') {
      if (options.mode) {
        throw new OpenAIInputCountProbeError(
          'ARGS_INVALID',
          'Choose exactly one of --verify or --run.',
        )
      }
      options.mode = arg.slice(2)
      continue
    }
    if (arg === '--reviewed-head') {
      options.reviewedHead = argv[index + 1] ?? null
      index += 1
      continue
    }
    throw new OpenAIInputCountProbeError(
      'ARGS_INVALID',
      `Unknown argument: ${arg}`,
    )
  }
  if (!options.mode) {
    throw new OpenAIInputCountProbeError(
      'ARGS_INVALID',
      'Choose exactly one of --verify or --run.',
    )
  }
  if (options.mode === 'run' && !/^[0-9a-f]{40}$/u.test(
    options.reviewedHead ?? '',
  )) {
    throw new OpenAIInputCountProbeError(
      'ARGS_INVALID',
      '--run requires --reviewed-head with one full commit SHA.',
    )
  }
  return Object.freeze(options)
}

async function defaultTransport({ apiKey, body, endpoint }) {
  const startedAt = Date.now()
  const response = await fetch(endpoint, {
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
  })
  const text = await response.text()
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new OpenAIInputCountProbeError(
      'RESPONSE_JSON_INVALID',
      'Input-count response was not JSON.',
      { elapsedMs: Date.now() - startedAt, status: response.status },
    )
  }
  return { body: parsed, status: response.status }
}

export async function main(argv = process.argv.slice(2), {
  env = process.env,
  repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..'),
} = {}) {
  const options = parseOpenAIInputCountProbeArgs(argv)
  const store = createOpenAIInputCountResultStore({ repoRoot })
  if (options.mode === 'verify') {
    const forbidden = [
      'max_output_tokens',
      'store',
      'service_tier',
      'reasoning',
    ]
    for (const field of forbidden) {
      if (Object.hasOwn(OPENAI_INPUT_COUNT_REQUEST, field)) {
        throw new OpenAIInputCountProbeError(
          'WIRE_INVALID',
          `Count wire unexpectedly contains ${field}.`,
        )
      }
    }
    console.log(JSON.stringify({
      identity: OPENAI_INPUT_COUNT_PROBE.identity,
      namespaceAbsent: await store.namespaceAbsent(),
      requestSha256: OPENAI_INPUT_COUNT_REQUEST_SHA256,
      verified: true,
    }))
    return
  }

  const git = await inspectGitPreflight({
    repoRoot,
    reviewedHead: options.reviewedHead,
  })
  const preflight = {
    authority: env.PALARI_INPUT_COUNT_FOUNDER_AUTHORITY,
    clean: git.clean,
    cumulativeCapUsd: env.PALARI_INPUT_COUNT_CUMULATIVE_CAP_USD,
    freshCapUsd: env.PALARI_INPUT_COUNT_FRESH_CAP_USD,
    head: git.head,
    identity: env.PALARI_INPUT_COUNT_IDENTITY,
    namespaceAbsent: await store.namespaceAbsent(),
    reviewedHead: git.reviewedHead,
    upstreamHead: git.upstreamHead,
  }
  const terminal = await runOpenAIInputCountProbe({
    beginReservation: (value) => store.beginReservation(value),
    invoke: defaultTransport,
    preflight,
    readCredential: async () => {
      const value = env.OPENAI_API_KEY
      store.setCredentialForScan(value)
      return value
    },
    seal: (value) => store.seal(value),
  })
  console.log(JSON.stringify(terminal))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    await main()
  } catch (error) {
    console.error(`${error?.code ?? 'INPUT_COUNT_PROBE_FAILED'}: ` +
      `${error?.message ?? 'Probe failed.'}`)
    process.exitCode = 1
  }
}

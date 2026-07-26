// One-shot, fail-closed OpenAI transport for the incremental LongMemEval
// judge. This is deliberately separate from the historical J4 retrying
// meters: one logical judge operation has exactly one physical dispatch.

import { createHash, randomUUID } from 'node:crypto'
import {
  chmod,
  link,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  unlink,
} from 'node:fs/promises'
import { dirname, join } from 'node:path'

import {
  assertIncrementalLongMemEvalJudgeBody,
  INCREMENTAL_LONGMEMEVAL_JUDGE_MODEL,
  parseIncrementalLongMemEvalJudgeResponse,
  reserveIncrementalLongMemEvalJudge,
} from './incremental-longmemeval-judge.mjs'
import {
  createLiveTranscriptRecorder,
} from './live-transcript.mjs'

export const INCREMENTAL_LONGMEMEVAL_JUDGE_URL =
  'https://api.openai.com/v1/chat/completions'
export const INCREMENTAL_LONGMEMEVAL_JUDGE_TIMEOUT_MS = 60_000
export const INCREMENTAL_LONGMEMEVAL_JUDGE_MAX_RESPONSE_BYTES =
  4 * 1024 * 1024

const METER_SCHEMA_VERSION = 1
const CAP_CONTEXT_KEYS = Object.freeze([
  'cumulativeAccountedUsd',
  'cumulativeCapUsd',
  'freshAccountedUsd',
  'freshCapUsd',
])
const STORED_CAP_CONTEXT_KEYS = Object.freeze([
  ...CAP_CONTEXT_KEYS,
  'projectedCumulativeUsd',
  'projectedFreshUsd',
])
const RESERVATION_KEYS = Object.freeze([
  'judgeInputTokens',
  'judgeOutputTokens',
  'pricingTier',
  'usd',
])
const SAFE_RESPONSE_HEADERS = new Set([
  'content-type',
  'retry-after',
  'retry-after-ms',
  'x-request-id',
  'x-should-retry',
])
const CREDENTIAL_PATTERNS = Object.freeze([
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{8,}\b/i,
  /\bBearer\s+[^\s"',}\\]+/i,
])

export class IncrementalLongMemEvalJudgeTransportError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'IncrementalLongMemEvalJudgeTransportError'
    this.code = code
  }
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function nonEmptyString(value) {
  return typeof value === 'string' && Boolean(value.trim())
}

function sameKeys(value, expected) {
  return value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) ===
      JSON.stringify([...expected].sort())
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value))
}

function containsCredential(text, apiKey) {
  const source = String(text)
  if (apiKey && source.includes(apiKey)) return true
  return CREDENTIAL_PATTERNS.some((pattern) => pattern.test(source))
}

function redactCredentialText(value, apiKey) {
  let text = String(value ?? '')
  if (apiKey) text = text.replaceAll(apiKey, '[REDACTED_SECRET]')
  for (const pattern of CREDENTIAL_PATTERNS) {
    text = text.replace(pattern, '[REDACTED_SECRET]')
  }
  return text
}

function safeResponseHeaders(headers, apiKey) {
  if (!headers) return {}
  const entries = typeof headers.entries === 'function'
    ? [...headers.entries()]
    : Object.entries(headers)
  const kept = new Map()
  for (const [rawName, rawValue] of entries) {
    const name = String(rawName).toLowerCase()
    if (!SAFE_RESPONSE_HEADERS.has(name) &&
      !name.startsWith('x-ratelimit-')) {
      continue
    }
    kept.set(name, redactCredentialText(rawValue, apiKey))
  }
  return Object.fromEntries([...kept.entries()].sort(([left], [right]) =>
    left.localeCompare(right)))
}

function validateCapContext(value, reservation) {
  if (!sameKeys(value, CAP_CONTEXT_KEYS)) {
    throw new IncrementalLongMemEvalJudgeTransportError(
      'JUDGE_CAP_CONTEXT_INVALID',
      'Judge cap context differs from its four-field contract.',
    )
  }
  for (const field of CAP_CONTEXT_KEYS) {
    if (!Number.isFinite(value[field]) || value[field] < 0) {
      throw new IncrementalLongMemEvalJudgeTransportError(
        'JUDGE_CAP_CONTEXT_INVALID',
        `Judge cap context has an invalid ${field}.`,
      )
    }
  }
  if (value.freshCapUsd <= 0 ||
    value.cumulativeCapUsd <= 0 ||
    value.freshAccountedUsd > value.freshCapUsd ||
    value.cumulativeAccountedUsd > value.cumulativeCapUsd ||
    value.cumulativeAccountedUsd < value.freshAccountedUsd) {
    throw new IncrementalLongMemEvalJudgeTransportError(
      'JUDGE_CAP_CONTEXT_INVALID',
      'Judge cap context is internally inconsistent.',
    )
  }
  const projectedFreshUsd = value.freshAccountedUsd + reservation.usd
  const projectedCumulativeUsd =
    value.cumulativeAccountedUsd + reservation.usd
  if (projectedFreshUsd > value.freshCapUsd) {
    throw new IncrementalLongMemEvalJudgeTransportError(
      'JUDGE_FRESH_SPEND_CAP',
      'The judge reservation would exceed the fresh-run spend cap.',
    )
  }
  if (projectedCumulativeUsd > value.cumulativeCapUsd) {
    throw new IncrementalLongMemEvalJudgeTransportError(
      'JUDGE_CUMULATIVE_SPEND_CAP',
      'The judge reservation would exceed the cumulative spend cap.',
    )
  }
  return {
    ...cloneJson(value),
    projectedCumulativeUsd,
    projectedFreshUsd,
  }
}

function validateReservation(body, reservation) {
  const expected = reserveIncrementalLongMemEvalJudge(body)
  if (!sameKeys(reservation, RESERVATION_KEYS) ||
    !sameJson(reservation, expected)) {
    throw new IncrementalLongMemEvalJudgeTransportError(
      'JUDGE_RESERVATION_INVALID',
      'Judge reservation differs from the priority-tier calculation.',
    )
  }
  return cloneJson(expected)
}

function validateStoredCapContext(value, reservation) {
  if (!sameKeys(value, STORED_CAP_CONTEXT_KEYS)) {
    throw new IncrementalLongMemEvalJudgeTransportError(
      'JUDGE_EVIDENCE_INCOHERENT',
      'Judge meter has an invalid stored cap context.',
    )
  }
  let expected
  try {
    expected = validateCapContext({
      cumulativeAccountedUsd: value.cumulativeAccountedUsd,
      cumulativeCapUsd: value.cumulativeCapUsd,
      freshAccountedUsd: value.freshAccountedUsd,
      freshCapUsd: value.freshCapUsd,
    }, reservation)
  } catch {
    throw new IncrementalLongMemEvalJudgeTransportError(
      'JUDGE_EVIDENCE_INCOHERENT',
      'Judge meter cap context does not permit its reservation.',
    )
  }
  if (!sameJson(value, expected)) {
    throw new IncrementalLongMemEvalJudgeTransportError(
      'JUDGE_EVIDENCE_INCOHERENT',
      'Judge meter cap projections differ from their canonical values.',
    )
  }
  return cloneJson(expected)
}

function startedStateFromTerminalMeter(meter) {
  return {
    attempt: meter.attempt,
    attemptId: meter.attemptId,
    capContext: meter.capContext,
    endpoint: meter.endpoint,
    model: meter.model,
    operationId: meter.operationId,
    purpose: meter.purpose,
    request: meter.request,
    reservation: meter.reservation,
    schemaVersion: meter.schemaVersion,
    startedAt: meter.startedAt,
    state: 'attempt_started',
    transcript: meter.transcript,
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

async function ensurePrivateParent(path) {
  const parent = dirname(path)
  await mkdir(parent, { recursive: true, mode: 0o700 })
  const metadata = await lstat(parent)
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    throw new IncrementalLongMemEvalJudgeTransportError(
      'JUDGE_METER_PARENT_INVALID',
      'Judge meter parent must be one real directory.',
    )
  }
  await chmod(parent, 0o700)
  return parent
}

async function assertMeterAbsent(path) {
  try {
    await lstat(path)
  } catch (error) {
    if (error?.code === 'ENOENT') return
    throw error
  }
  throw new IncrementalLongMemEvalJudgeTransportError(
    'JUDGE_METER_EXISTS',
    'The one-shot judge meter already exists; dispatch is forbidden.',
  )
}

async function writeTemporary(path, text) {
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`
  const handle = await open(temporary, 'wx', 0o600)
  try {
    await handle.writeFile(text, 'utf8')
    await handle.sync()
  } finally {
    await handle.close()
  }
  return temporary
}

async function atomicCreate(path, text) {
  const parent = await ensurePrivateParent(path)
  const temporary = await writeTemporary(path, text)
  try {
    await link(temporary, path)
    await syncDirectory(parent)
  } catch (error) {
    if (error?.code === 'EEXIST') {
      throw new IncrementalLongMemEvalJudgeTransportError(
        'JUDGE_METER_EXISTS',
        'The one-shot judge meter already exists; dispatch is forbidden.',
      )
    }
    throw error
  } finally {
    await unlink(temporary).catch((error) => {
      if (error?.code !== 'ENOENT') throw error
    })
  }
}

async function atomicReplaceStarted(path, startedText, terminalText) {
  const currentText = await readFile(path, 'utf8')
  if (sha256(currentText) !== sha256(startedText)) {
    throw new IncrementalLongMemEvalJudgeTransportError(
      'JUDGE_METER_CHANGED',
      'The durable judge start record changed before terminalization.',
    )
  }
  const parent = dirname(path)
  const temporary = await writeTemporary(path, terminalText)
  try {
    await rename(temporary, path)
    await syncDirectory(parent)
  } catch (error) {
    await unlink(temporary).catch((unlinkError) => {
      if (unlinkError?.code !== 'ENOENT') throw unlinkError
    })
    throw error
  }
}

async function exactResponseText(response) {
  const declared = Number(response?.headers?.get?.('content-length'))
  if (Number.isFinite(declared) &&
    declared > INCREMENTAL_LONGMEMEVAL_JUDGE_MAX_RESPONSE_BYTES) {
    throw new IncrementalLongMemEvalJudgeTransportError(
      'JUDGE_RESPONSE_TOO_LARGE',
      'OpenAI judge response exceeds the 4 MiB ceiling.',
    )
  }
  if (!response?.body?.getReader) {
    if (typeof response?.text !== 'function') {
      throw new IncrementalLongMemEvalJudgeTransportError(
        'JUDGE_HTTP_RESPONSE_INVALID',
        'OpenAI judge returned no readable HTTP body.',
      )
    }
    const text = await response.text()
    if (Buffer.byteLength(text, 'utf8') <=
      INCREMENTAL_LONGMEMEVAL_JUDGE_MAX_RESPONSE_BYTES) {
      return text
    }
    throw new IncrementalLongMemEvalJudgeTransportError(
      'JUDGE_RESPONSE_TOO_LARGE',
      'OpenAI judge response exceeds the 4 MiB ceiling.',
    )
  }
  const reader = response.body.getReader()
  const chunks = []
  let bytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = Buffer.from(value)
      bytes += chunk.byteLength
      if (bytes >
        INCREMENTAL_LONGMEMEVAL_JUDGE_MAX_RESPONSE_BYTES) {
        await reader.cancel().catch(() => {})
        throw new IncrementalLongMemEvalJudgeTransportError(
          'JUDGE_RESPONSE_TOO_LARGE',
          'OpenAI judge response exceeds the 4 MiB ceiling.',
        )
      }
      chunks.push(chunk)
    }
  } finally {
    reader.releaseLock()
  }
  return Buffer.concat(chunks, bytes).toString('utf8')
}

function terminalError(code, message) {
  return { code, message }
}

function serializeState(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

export async function readIncrementalLongMemEvalJudgeMeter(path) {
  const metadata = await lstat(path)
  if (!metadata.isFile() ||
    metadata.isSymbolicLink() ||
    (metadata.mode & 0o777) !== 0o600) {
    throw new IncrementalLongMemEvalJudgeTransportError(
      'JUDGE_METER_INVALID',
      'Judge meter must be one regular mode-0600 file.',
    )
  }
  let parsed
  try {
    parsed = JSON.parse(await readFile(path, 'utf8'))
  } catch {
    throw new IncrementalLongMemEvalJudgeTransportError(
      'JUDGE_METER_INVALID',
      'Judge meter is not valid JSON.',
    )
  }
  if (parsed?.schemaVersion !== METER_SCHEMA_VERSION ||
    !['attempt_started', 'terminal'].includes(parsed?.state)) {
    throw new IncrementalLongMemEvalJudgeTransportError(
      'JUDGE_METER_INVALID',
      'Judge meter has an invalid schema or state.',
    )
  }
  return parsed
}

export async function callIncrementalLongMemEvalJudge({
  body,
  capContext,
  cellId,
  fetchImpl,
  meterPath,
  openaiApiKey,
  operationId,
  reservation,
  transcriptRecorder,
} = {}) {
  const effectiveCellId = cellId ?? operationId
  if (typeof fetchImpl !== 'function') {
    throw new IncrementalLongMemEvalJudgeTransportError(
      'JUDGE_FETCH_MISSING',
      'A captured fetch implementation is required.',
    )
  }
  if (!nonEmptyString(openaiApiKey)) {
    throw new IncrementalLongMemEvalJudgeTransportError(
      'JUDGE_CREDENTIAL_MISSING',
      'An OpenAI API key is required in memory.',
    )
  }
  if (!nonEmptyString(meterPath) ||
    !nonEmptyString(operationId) ||
    !nonEmptyString(effectiveCellId) ||
    typeof transcriptRecorder?.beginAttempt !== 'function') {
    throw new IncrementalLongMemEvalJudgeTransportError(
      'JUDGE_EVIDENCE_INPUT_INVALID',
      'Judge meter, operation identity, and transcript recorder are required.',
    )
  }
  assertIncrementalLongMemEvalJudgeBody(body)
  const normalizedBody = JSON.stringify(body)
  if (containsCredential(normalizedBody, openaiApiKey) ||
    containsCredential(operationId, openaiApiKey) ||
    containsCredential(effectiveCellId, openaiApiKey)) {
    throw new IncrementalLongMemEvalJudgeTransportError(
      'JUDGE_CREDENTIAL_IN_EVIDENCE',
      'Judge request evidence contains credential-like text.',
    )
  }
  const frozenReservation = validateReservation(body, reservation)
  const frozenCapContext = validateCapContext(
    capContext,
    frozenReservation,
  )
  await ensurePrivateParent(meterPath)
  await assertMeterAbsent(meterPath)

  const requestBytes = Buffer.byteLength(normalizedBody, 'utf8')
  const requestSha256 = sha256(normalizedBody)
  const attempt = 1
  const attemptId = `${operationId}:attempt:1`
  const startedAt = new Date().toISOString()
  const transcript = await transcriptRecorder.beginAttempt({
    attempt,
    attemptId,
    cellId: effectiveCellId,
    endpoint: 'openai-chat-completions',
    metadata: {
      provider: 'openai',
      retryPermitted: false,
      stateless: true,
    },
    model: INCREMENTAL_LONGMEMEVAL_JUDGE_MODEL,
    normalizedRequestBody: normalizedBody,
    operationId,
    purpose: 'judge',
    requestBytes,
    settings: {
      maxTokens: body.max_tokens,
      n: body.n,
      serviceTier: body.service_tier,
      store: body.store,
      temperature: body.temperature,
    },
    startedAt,
  })
  const startedState = {
    attempt,
    attemptId,
    capContext: frozenCapContext,
    endpoint: INCREMENTAL_LONGMEMEVAL_JUDGE_URL,
    model: INCREMENTAL_LONGMEMEVAL_JUDGE_MODEL,
    operationId,
    purpose: 'judge',
    request: {
      bytes: requestBytes,
      sha256: requestSha256,
    },
    reservation: frozenReservation,
    schemaVersion: METER_SCHEMA_VERSION,
    startedAt,
    state: 'attempt_started',
    transcript: {
      file: transcript.transcriptFile,
      startedSha256: transcript.transcriptSha256,
    },
  }
  const startedText = serializeState(startedState)
  const startedStateSha256 = sha256(startedText)
  await atomicCreate(meterPath, startedText)

  async function recordFailure({
    code,
    message,
    outcome,
    rawBody = null,
    response = null,
    transportFailure = false,
  }) {
    const safeError = terminalError(code, message)
    let terminalTranscript = null
    let transcriptError = null
    try {
      terminalTranscript = await transcript.finish({
        outcome,
        rawBody,
        responseHeaders: safeResponseHeaders(
          response?.headers,
          openaiApiKey,
        ),
        status: Number.isSafeInteger(response?.status)
          ? response.status
          : null,
        transportError: transportFailure ? safeError : null,
      })
    } catch {
      transcriptError = terminalError(
        'JUDGE_TRANSCRIPT_TERMINAL_FAILED',
        'The dispatched judge transcript could not become terminal.',
      )
    }
    const completedAt = new Date().toISOString()
    const terminalState = {
      ...startedState,
      completedAt,
      startedStateSha256,
      state: 'terminal',
      terminal: {
        accountedUsd: frozenReservation.usd,
        error: transcriptError ?? safeError,
        measured: null,
        outcome: transcriptError ? 'transcript_error' : outcome,
        status: Number.isSafeInteger(response?.status)
          ? response.status
          : null,
        transcript: terminalTranscript
          ? {
              file: terminalTranscript.transcriptFile,
              sha256: terminalTranscript.transcriptSha256,
            }
          : null,
        uncertain: frozenReservation,
      },
    }
    await atomicReplaceStarted(
      meterPath,
      startedText,
      serializeState(terminalState),
    )
    if (transcriptError) {
      throw new IncrementalLongMemEvalJudgeTransportError(
        transcriptError.code,
        transcriptError.message,
      )
    }
    throw new IncrementalLongMemEvalJudgeTransportError(code, message)
  }

  let response = null
  let rawBody = null
  let timedOut = false
  const controller = new AbortController()
  let timeout
  const timeoutFailure = new Promise((_, reject) => {
    timeout = setTimeout(() => {
      timedOut = true
      controller.abort()
      reject(new IncrementalLongMemEvalJudgeTransportError(
        'JUDGE_TIMEOUT',
        'OpenAI judge exceeded the fixed 60-second timeout.',
      ))
    }, INCREMENTAL_LONGMEMEVAL_JUDGE_TIMEOUT_MS)
  })
  try {
    response = await Promise.race([
      fetchImpl(INCREMENTAL_LONGMEMEVAL_JUDGE_URL, {
        body: normalizedBody,
        headers: {
          authorization: `Bearer ${openaiApiKey}`,
          'content-type': 'application/json',
        },
        method: 'POST',
        redirect: 'error',
        signal: controller.signal,
      }),
      timeoutFailure,
    ])
    rawBody = await exactResponseText(response)
  } catch (error) {
    clearTimeout(timeout)
    const tooLarge = error?.code === 'JUDGE_RESPONSE_TOO_LARGE'
    return recordFailure({
      code: timedOut
        ? 'JUDGE_TIMEOUT'
        : tooLarge
          ? 'JUDGE_RESPONSE_TOO_LARGE'
          : 'JUDGE_TRANSPORT_ERROR',
      message: timedOut
        ? 'OpenAI judge exceeded the fixed 60-second timeout.'
        : tooLarge
          ? 'OpenAI judge response exceeded the 4 MiB ceiling.'
          : 'OpenAI judge transport failed after dispatch.',
      outcome: timedOut
        ? 'timeout'
        : tooLarge
          ? 'response_too_large'
          : 'transport_error',
      response,
      transportFailure: true,
    })
  } finally {
    clearTimeout(timeout)
  }

  if (!Number.isSafeInteger(response?.status) ||
    response.status !== 200) {
    return recordFailure({
      code: 'JUDGE_HTTP_ERROR',
      message: `OpenAI judge returned terminal HTTP ${
        Number.isSafeInteger(response?.status) ? response.status : 'invalid'
      }.`,
      outcome: 'http_error',
      rawBody: containsCredential(rawBody, openaiApiKey)
        ? null
        : rawBody,
      response,
      transportFailure: containsCredential(rawBody, openaiApiKey),
    })
  }
  if (containsCredential(rawBody, openaiApiKey)) {
    return recordFailure({
      code: 'JUDGE_CREDENTIAL_IN_RESPONSE',
      message: 'OpenAI judge response contained credential-like text.',
      outcome: 'credential_echo',
      response,
      transportFailure: true,
    })
  }

  let parsed
  try {
    parsed = parseIncrementalLongMemEvalJudgeResponse({
      body,
      rawBody,
      reservation: frozenReservation,
    })
  } catch (error) {
    return recordFailure({
      code: nonEmptyString(error?.code)
        ? error.code
        : 'JUDGE_RESPONSE_INVALID',
      message: 'OpenAI judge response failed its frozen parser contract.',
      outcome: 'invalid_response',
      rawBody,
      response,
    })
  }

  let terminalTranscript
  try {
    terminalTranscript = await transcript.finish({
      finishReason: parsed.finishReason,
      outcome: 'success',
      rawBody,
      responseHeaders: safeResponseHeaders(
        response.headers,
        openaiApiKey,
      ),
      status: response.status,
      usage: parsed.rawUsage,
    })
  } catch {
    const completedAt = new Date().toISOString()
    const terminalState = {
      ...startedState,
      completedAt,
      startedStateSha256,
      state: 'terminal',
      terminal: {
        accountedUsd: frozenReservation.usd,
        error: terminalError(
          'JUDGE_TRANSCRIPT_TERMINAL_FAILED',
          'The dispatched judge transcript could not become terminal.',
        ),
        measured: null,
        outcome: 'transcript_error',
        status: response.status,
        transcript: null,
        uncertain: frozenReservation,
      },
    }
    await atomicReplaceStarted(
      meterPath,
      startedText,
      serializeState(terminalState),
    )
    throw new IncrementalLongMemEvalJudgeTransportError(
      'JUDGE_TRANSCRIPT_TERMINAL_FAILED',
      'The dispatched judge transcript could not become terminal.',
    )
  }

  const completedAt = new Date().toISOString()
  const terminalState = {
    ...startedState,
    completedAt,
    startedStateSha256,
    state: 'terminal',
    terminal: {
      accountedUsd: parsed.measured.usd,
      error: null,
      measured: cloneJson(parsed.measured),
      outcome: 'success',
      status: response.status,
      transcript: {
        file: terminalTranscript.transcriptFile,
        sha256: terminalTranscript.transcriptSha256,
      },
      uncertain: null,
    },
  }
  await atomicReplaceStarted(
    meterPath,
    startedText,
    serializeState(terminalState),
  )
  return {
    finishReason: parsed.finishReason,
    measured: cloneJson(parsed.measured),
    meter: cloneJson(terminalState),
    modelVersion: parsed.modelVersion,
    serviceTier: parsed.serviceTier,
    text: parsed.text,
    transcript: cloneJson(terminalState.terminal.transcript),
    validated: true,
  }
}

function snapshotFromMeter(meter) {
  const terminal = meter.state === 'terminal' ? meter.terminal : null
  return {
    accountedUsd: terminal?.accountedUsd ?? meter.reservation.usd,
    attempts: 1,
    measured: terminal?.measured ?? null,
    operationId: meter.operationId,
    state: meter.state,
    uncertain: terminal
      ? terminal.uncertain
      : cloneJson(meter.reservation),
  }
}

async function meterOrNull(path) {
  try {
    return await readIncrementalLongMemEvalJudgeMeter(path)
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
}

async function verifyFactoryEvidence({
  meterPath,
  transcriptDirectory,
} = {}) {
  const meter = await readIncrementalLongMemEvalJudgeMeter(meterPath)
  if (meter.state !== 'terminal') {
    throw new IncrementalLongMemEvalJudgeTransportError(
      'JUDGE_EVIDENCE_INCOMPLETE',
      'Judge evidence still contains a non-terminal attempt.',
    )
  }
  const meterMetadata = await lstat(meterPath)
  const meterParentMetadata = await lstat(dirname(meterPath))
  const transcriptParentMetadata = await lstat(transcriptDirectory)
  if ((meterMetadata.mode & 0o777) !== 0o600 ||
    !meterParentMetadata.isDirectory() ||
    meterParentMetadata.isSymbolicLink() ||
    (meterParentMetadata.mode & 0o777) !== 0o700 ||
    !transcriptParentMetadata.isDirectory() ||
    transcriptParentMetadata.isSymbolicLink() ||
    (transcriptParentMetadata.mode & 0o777) !== 0o700) {
    throw new IncrementalLongMemEvalJudgeTransportError(
      'JUDGE_EVIDENCE_MODE_INVALID',
      'Judge meter and transcript evidence are not private files.',
    )
  }
  const startedTranscriptFile = meter.transcript?.file
  if (meter.attempt !== 1 ||
    meter.attemptId !== `${meter.operationId}:attempt:1` ||
    meter.endpoint !== INCREMENTAL_LONGMEMEVAL_JUDGE_URL ||
    meter.model !== INCREMENTAL_LONGMEMEVAL_JUDGE_MODEL ||
    meter.purpose !== 'judge' ||
    !nonEmptyString(startedTranscriptFile) ||
    startedTranscriptFile.includes('/') ||
    startedTranscriptFile.includes('\\') ||
    !/^[a-f0-9]{64}$/.test(
      meter.transcript?.startedSha256 ?? '',
    ) ||
    !/^[a-f0-9]{64}$/.test(
      meter.startedStateSha256 ?? '',
    ) ||
    sha256(serializeState(
      startedStateFromTerminalMeter(meter),
    )) !== meter.startedStateSha256) {
    throw new IncrementalLongMemEvalJudgeTransportError(
      'JUDGE_EVIDENCE_INCOHERENT',
      'Judge terminal meter differs from its durable start record.',
    )
  }
  const transcriptFiles = (await readdir(transcriptDirectory)).sort()
  if (!sameJson(transcriptFiles, [startedTranscriptFile])) {
    throw new IncrementalLongMemEvalJudgeTransportError(
      'JUDGE_EVIDENCE_INCOHERENT',
      'Judge evidence must contain exactly one attempt transcript.',
    )
  }
  const terminalTranscriptLink = meter.terminal.transcript
  if (!terminalTranscriptLink &&
    meter.terminal.outcome !== 'transcript_error') {
    throw new IncrementalLongMemEvalJudgeTransportError(
      'JUDGE_EVIDENCE_INCOHERENT',
      'Judge terminal meter lacks its transcript link.',
    )
  }
  if (terminalTranscriptLink &&
    (terminalTranscriptLink.file !== startedTranscriptFile ||
      !/^[a-f0-9]{64}$/.test(
        terminalTranscriptLink.sha256 ?? '',
      ))) {
    throw new IncrementalLongMemEvalJudgeTransportError(
      'JUDGE_EVIDENCE_INCOHERENT',
      'Judge terminal transcript link differs from its start.',
    )
  }
  const transcriptPath = join(
    transcriptDirectory,
    startedTranscriptFile,
  )
  const transcriptMetadata = await lstat(transcriptPath)
  const transcriptText = await readFile(transcriptPath, 'utf8')
  if (!transcriptMetadata.isFile() ||
    transcriptMetadata.isSymbolicLink() ||
    (transcriptMetadata.mode & 0o777) !== 0o600 ||
    (terminalTranscriptLink &&
      sha256(transcriptText) !==
        terminalTranscriptLink.sha256)) {
    throw new IncrementalLongMemEvalJudgeTransportError(
      'JUDGE_EVIDENCE_INCOHERENT',
      'Judge transcript mode or hash differs from its meter.',
    )
  }
  let transcript
  try {
    transcript = JSON.parse(transcriptText)
  } catch {
    throw new IncrementalLongMemEvalJudgeTransportError(
      'JUDGE_EVIDENCE_INCOHERENT',
      'Judge transcript is not valid JSON.',
    )
  }
  const transcriptIsTerminal = transcript.state === 'terminal'
  const transcriptIsStarted = transcript.state === 'started'
  if ((!transcriptIsTerminal && !transcriptIsStarted) ||
    (terminalTranscriptLink && !transcriptIsTerminal) ||
    (!terminalTranscriptLink &&
      meter.terminal.outcome === 'transcript_error' &&
      (!transcriptIsStarted ||
        sha256(transcriptText) !==
          meter.transcript.startedSha256)) ||
    (transcriptIsTerminal &&
      transcript.startedRecordSha256 !==
        meter.transcript.startedSha256) ||
    transcript.attempt?.attempt !== 1 ||
    transcript.attempt?.attemptId !== meter.attemptId ||
    transcript.attempt?.operationId !== meter.operationId ||
    transcript.attempt?.purpose !== 'judge' ||
    transcript.attempt?.endpoint !== 'openai-chat-completions' ||
    transcript.request?.model !== INCREMENTAL_LONGMEMEVAL_JUDGE_MODEL ||
    transcript.startedAt !== meter.startedAt ||
    (terminalTranscriptLink &&
      transcript.terminal?.outcome !==
        meter.terminal.outcome) ||
    (transcriptIsTerminal &&
      (transcript.terminal?.response?.status ?? null) !==
        meter.terminal.status)) {
    throw new IncrementalLongMemEvalJudgeTransportError(
      'JUDGE_EVIDENCE_INCOHERENT',
      'Judge transcript identity differs from its terminal meter.',
    )
  }
  const normalizedBody = transcript.request?.normalizedBody
  if (typeof normalizedBody !== 'string') {
    throw new IncrementalLongMemEvalJudgeTransportError(
      'JUDGE_EVIDENCE_INCOHERENT',
      'Judge transcript lacks its exact normalized request body.',
    )
  }
  const normalizedBodyBytes =
    Buffer.byteLength(normalizedBody, 'utf8')
  const normalizedBodySha256 = sha256(normalizedBody)
  if (transcript.request.bodyBytes !== normalizedBodyBytes ||
    transcript.request.bodySha256 !== normalizedBodySha256 ||
    meter.request?.bytes !== normalizedBodyBytes ||
    meter.request?.sha256 !== normalizedBodySha256) {
    throw new IncrementalLongMemEvalJudgeTransportError(
      'JUDGE_EVIDENCE_INCOHERENT',
      'Judge request bytes or SHA-256 differ from its normalized body.',
    )
  }
  let requestBody
  try {
    requestBody = JSON.parse(normalizedBody)
    assertIncrementalLongMemEvalJudgeBody(requestBody)
  } catch {
    throw new IncrementalLongMemEvalJudgeTransportError(
      'JUDGE_EVIDENCE_INCOHERENT',
      'Judge transcript request body differs from its frozen contract.',
    )
  }
  const expectedSettings = {
    maxTokens: requestBody.max_tokens,
    n: requestBody.n,
    serviceTier: requestBody.service_tier,
    store: requestBody.store,
    temperature: requestBody.temperature,
  }
  if (!sameJson(transcript.request.settings, expectedSettings)) {
    throw new IncrementalLongMemEvalJudgeTransportError(
      'JUDGE_EVIDENCE_INCOHERENT',
      'Judge transcript settings differ from its request body.',
    )
  }
  let canonicalReservation
  try {
    canonicalReservation = validateReservation(
      requestBody,
      meter.reservation,
    )
  } catch {
    throw new IncrementalLongMemEvalJudgeTransportError(
      'JUDGE_EVIDENCE_INCOHERENT',
      'Judge meter reservation differs from the canonical full-window value.',
    )
  }
  validateStoredCapContext(meter.capContext, canonicalReservation)
  if (meter.terminal.outcome === 'success') {
    const parsed = parseIncrementalLongMemEvalJudgeResponse({
      body: requestBody,
      rawBody: transcript.terminal?.response?.rawBody,
      reservation: canonicalReservation,
    })
    if (meter.terminal.status !== 200 ||
      transcript.terminal?.response?.status !== 200 ||
      transcript.terminal?.response?.finishReason !==
        parsed.finishReason ||
      !sameJson(
        transcript.terminal?.response?.usage,
        parsed.rawUsage,
      ) ||
      !sameJson(parsed.measured, meter.terminal.measured) ||
      meter.terminal.uncertain !== null ||
      meter.terminal.accountedUsd !== parsed.measured.usd) {
      throw new IncrementalLongMemEvalJudgeTransportError(
        'JUDGE_EVIDENCE_INCOHERENT',
        'Judge success accounting differs from its provider response.',
      )
    }
  } else if (meter.terminal.measured !== null ||
    !sameJson(meter.terminal.uncertain, canonicalReservation) ||
    meter.terminal.accountedUsd !== canonicalReservation.usd) {
    throw new IncrementalLongMemEvalJudgeTransportError(
      'JUDGE_EVIDENCE_INCOHERENT',
      'Judge failure does not retain its full reservation.',
    )
  }
  return {
    meter: cloneJson(meter),
    snapshot: snapshotFromMeter(meter),
    transcript: terminalTranscriptLink
      ? {
          file: startedTranscriptFile,
          sha256: sha256(transcriptText),
        }
      : null,
  }
}

export async function createIncrementalLongMemEvalJudgeTransport({
  cumulativeCapUsd,
  fetchImpl,
  freshSubcapUsd,
  getFreshAccountedUsd,
  meterPath,
  openaiApiKey,
  openingAccountedUsd,
  transcriptDirectory,
} = {}) {
  if (!Number.isFinite(openingAccountedUsd) ||
    openingAccountedUsd < 0 ||
    !Number.isFinite(freshSubcapUsd) ||
    freshSubcapUsd <= 0 ||
    !Number.isFinite(cumulativeCapUsd) ||
    cumulativeCapUsd <= 0 ||
    typeof getFreshAccountedUsd !== 'function' ||
    !nonEmptyString(transcriptDirectory)) {
    throw new IncrementalLongMemEvalJudgeTransportError(
      'JUDGE_FACTORY_CONFIG_INVALID',
      'Judge factory requires fixed caps, opening spend, and a fresh-spend callback.',
    )
  }
  const transcriptRecorder = await createLiveTranscriptRecorder({
    directory: transcriptDirectory,
    forbiddenSecrets: [openaiApiKey],
  })
  let queue = Promise.resolve()
  const runExclusive = (action) => {
    const next = queue.then(action, action)
    queue = next.catch(() => {})
    return next
  }

  return {
    async callJudge({
      body,
      cellId,
      operationId,
    } = {}) {
      return runExclusive(async () => {
        const freshAccountedUsd = Number(
          await getFreshAccountedUsd(),
        )
        if (!Number.isFinite(freshAccountedUsd) ||
          freshAccountedUsd < 0) {
          throw new IncrementalLongMemEvalJudgeTransportError(
            'JUDGE_FRESH_SPEND_INVALID',
            'Fresh Gemini accounted spend is not a non-negative number.',
          )
        }
        return callIncrementalLongMemEvalJudge({
          body,
          capContext: {
            cumulativeAccountedUsd:
              openingAccountedUsd + freshAccountedUsd,
            cumulativeCapUsd,
            freshAccountedUsd,
            freshCapUsd: freshSubcapUsd,
          },
          cellId,
          fetchImpl,
          meterPath,
          openaiApiKey,
          operationId,
          reservation: reserveIncrementalLongMemEvalJudge(body),
          transcriptRecorder,
        })
      })
    },

    async snapshot() {
      await queue
      const meter = await meterOrNull(meterPath)
      return meter
        ? snapshotFromMeter(meter)
        : {
            accountedUsd: 0,
            attempts: 0,
            measured: null,
            operationId: null,
            state: 'not_dispatched',
            uncertain: null,
          }
    },

    async verify() {
      await queue
      return verifyFactoryEvidence({
        meterPath,
        transcriptDirectory,
      })
    },
  }
}

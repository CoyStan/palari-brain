// One durable spend meter for the J4 Gemini writer/answer calls and OpenAI
// LongMemEval judge calls. Failed or uncertain attempts retain their complete
// reservation; successful attempts are charged from provider-reported usage.

import {
  chmod,
  lstat,
  mkdir,
  open,
  readFile,
  stat,
} from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { buildGeminiGenerateRequest } from '../src/gemini.mjs'
import {
  createLiveTranscriptRecorder,
  transcriptSha256,
  verifyLiveTranscriptArtifacts,
} from './live-transcript.mjs'
import {
  J4_GEMINI_ANSWER_GENERATION,
  J4_GEMINI_MODEL,
  J4_GEMINI_WRITER_GENERATION,
  J4_MAX_RESPONSE_BYTES,
  J4_PRICES_USD_PER_TOKEN,
  J4_REQUEST_TIMEOUT_MS,
  J4_RETRY_LIMIT,
} from './longmemeval-live-config.mjs'
import {
  LONGMEMEVAL_JUDGE_MODEL,
  LONGMEMEVAL_JUDGE_REQUEST,
} from './longmemeval-judge.mjs'

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions'
const GEMINI_GENERATE_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(J4_GEMINI_MODEL)}:generateContent`
const RETRYABLE_STATUS = new Set([408, 409, 429])
const PURPOSES = new Set(['answer', 'judge', 'writer'])
const GEMINI_PURPOSES = new Set(['answer', 'writer'])
const PROVIDER_ENDPOINTS = Object.freeze({
  gemini: 'gemini-generate-content',
  openai: 'openai-chat-completions',
})
const usageFields = Object.freeze([
  'geminiInputTokens',
  'geminiOutputTokens',
  'judgeInputTokens',
  'judgeOutputTokens',
  'usd',
])
const tokenUsageFields = usageFields.slice(0, -1)

export class J4LiveError extends Error {
  constructor(code, message, { cause } = {}) {
    super(message, cause ? { cause } : undefined)
    this.name = 'J4LiveError'
    this.code = code
  }
}

function zeroUsage() {
  return {
    geminiInputTokens: 0,
    geminiOutputTokens: 0,
    judgeInputTokens: 0,
    judgeOutputTokens: 0,
    usd: 0,
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function usageUsd(value) {
  return (
    value.geminiInputTokens * J4_PRICES_USD_PER_TOKEN.geminiInput +
    value.geminiOutputTokens *
      J4_PRICES_USD_PER_TOKEN.geminiOutputIncludingThinking +
    value.judgeInputTokens * J4_PRICES_USD_PER_TOKEN.judgeInput +
    value.judgeOutputTokens * J4_PRICES_USD_PER_TOKEN.judgeOutput
  )
}

function addUsage(target, source) {
  for (const field of tokenUsageFields) {
    target[field] += Number(source?.[field] ?? 0)
  }
  target.usd = usageUsd(target)
}

function subtractUsage(target, source) {
  for (const field of tokenUsageFields) {
    target[field] -= Number(source?.[field] ?? 0)
  }
  target.usd = usageUsd(target)
}

function integer(value) {
  return Number.isSafeInteger(value) && value >= 0
}

function positiveInteger(value) {
  return Number.isSafeInteger(value) && value >= 1
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.length > 0
}

function assertExactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new J4LiveError('LIMITS_SCHEMA', `${label} must be an object.`)
  }
  const actual = Object.keys(value).sort()
  const frozen = [...expected].sort()
  if (JSON.stringify(actual) !== JSON.stringify(frozen)) {
    throw new J4LiveError(
      'LIMITS_SCHEMA',
      `${label} differs from the frozen J4 schema.`,
    )
  }
}

export function validateJ4MeterLimits(limits) {
  assertExactKeys(limits, [
    'maxAttempts',
    'maxLogicalRequests',
    'maxResponseBytes',
    'maxTokens',
    'requestTimeoutMs',
    'retryLimit',
  ], 'J4 meter limits')
  assertExactKeys(
    limits.maxLogicalRequests,
    ['answer', 'judge', 'writer'],
    'J4 logical-request limits',
  )
  assertExactKeys(
    limits.maxTokens,
    [
      'geminiInput',
      'geminiOutputIncludingThinking',
      'judgeInput',
      'judgeOutput',
    ],
    'J4 token limits',
  )
  for (const [label, value] of [
    ['maxAttempts', limits.maxAttempts],
    ['maxResponseBytes', limits.maxResponseBytes],
    ['requestTimeoutMs', limits.requestTimeoutMs],
    ['answer logical requests', limits.maxLogicalRequests.answer],
    ['judge logical requests', limits.maxLogicalRequests.judge],
    ['writer logical requests', limits.maxLogicalRequests.writer],
    ['Gemini input tokens', limits.maxTokens.geminiInput],
    [
      'Gemini output tokens',
      limits.maxTokens.geminiOutputIncludingThinking,
    ],
    ['judge input tokens', limits.maxTokens.judgeInput],
    ['judge output tokens', limits.maxTokens.judgeOutput],
  ]) {
    if (!positiveInteger(value)) {
      throw new J4LiveError(
        'LIMITS_SCHEMA',
        `J4 ${label} must be a positive safe integer.`,
      )
    }
  }
  if (limits.retryLimit !== J4_RETRY_LIMIT) {
    throw new J4LiveError(
      'LIMITS_SCHEMA',
      `J4 retryLimit must equal the frozen value ${J4_RETRY_LIMIT}.`,
    )
  }
  if (limits.maxResponseBytes !== J4_MAX_RESPONSE_BYTES ||
    limits.requestTimeoutMs !== J4_REQUEST_TIMEOUT_MS) {
    throw new J4LiveError(
      'LIMITS_SCHEMA',
      'J4 response-byte and timeout limits differ from the frozen config.',
    )
  }
  return clone(limits)
}

function bodyText(body) {
  try {
    return JSON.stringify(body)
  } catch (error) {
    throw new J4LiveError(
      'REQUEST_NOT_JSON',
      'J4 provider request must be JSON-serializable.',
      { cause: error },
    )
  }
}

export function j4ReservationFor({
  body,
  maxOutputTokens,
  provider,
} = {}) {
  const serialized = typeof body === 'string' ? body : bodyText(body)
  // One UTF-8 byte per input token plus 512 tokens of protocol overhead is a
  // hard upper reservation, not the cheaper planning estimate.
  const inputTokens = Buffer.byteLength(serialized) + 512
  const outputTokens = Number(maxOutputTokens)
  if (!Number.isSafeInteger(outputTokens) || outputTokens < 1) {
    throw new J4LiveError(
      'OUTPUT_LIMIT_INVALID',
      'J4 provider output limit must be a positive integer.',
    )
  }
  if (provider === 'gemini') {
    return {
      geminiInputTokens: inputTokens,
      geminiOutputTokens: outputTokens,
      judgeInputTokens: 0,
      judgeOutputTokens: 0,
      usd:
        inputTokens * J4_PRICES_USD_PER_TOKEN.geminiInput +
        outputTokens *
          J4_PRICES_USD_PER_TOKEN.geminiOutputIncludingThinking,
    }
  }
  if (provider === 'openai') {
    return {
      geminiInputTokens: 0,
      geminiOutputTokens: 0,
      judgeInputTokens: inputTokens,
      judgeOutputTokens: outputTokens,
      usd:
        inputTokens * J4_PRICES_USD_PER_TOKEN.judgeInput +
        outputTokens * J4_PRICES_USD_PER_TOKEN.judgeOutput,
    }
  }
  throw new J4LiveError(
    'PROVIDER_INVALID',
    'J4 reservation provider must be gemini or openai.',
  )
}

function initialState() {
  return {
    accounted: zeroUsage(),
    attempts: 0,
    geminiModelVersion: null,
    logicalRequests: {},
    measured: zeroUsage(),
    operationRequestHashes: {},
    retries: [],
    sequence: 0,
    uncertain: zeroUsage(),
  }
}

function assertUsage(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
    JSON.stringify(Object.keys(value).sort()) !==
      JSON.stringify([...usageFields].sort())) {
    throw new J4LiveError(
      'LEDGER_SCHEMA',
      `${label} has the wrong fields.`,
    )
  }
  for (const field of tokenUsageFields) {
    if (!integer(value[field])) {
      throw new J4LiveError(
        'LEDGER_SCHEMA',
        `${label} has invalid ${field}.`,
      )
    }
  }
  if (!Number.isFinite(value.usd) || value.usd < 0) {
    throw new J4LiveError(
      'LEDGER_SCHEMA',
      `${label} has invalid usd.`,
    )
  }
  const expectedUsd = usageUsd(value)
  if (Math.abs(expectedUsd - value.usd) > 1e-12) {
    throw new J4LiveError(
      'LEDGER_SCHEMA',
      `${label} has inconsistent USD accounting.`,
    )
  }
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function assertStartIdentity(event) {
  if (!nonEmptyString(event.cellId) ||
    !nonEmptyString(event.endpoint) ||
    !nonEmptyString(event.model) ||
    !nonEmptyString(event.operationId) ||
    !nonEmptyString(event.provider) ||
    !nonEmptyString(event.purpose) ||
    !PURPOSES.has(event.purpose) ||
    !Object.hasOwn(PROVIDER_ENDPOINTS, event.provider) ||
    event.endpoint !== PROVIDER_ENDPOINTS[event.provider] ||
    (event.provider === 'gemini') !== GEMINI_PURPOSES.has(event.purpose) ||
    event.attemptId !== `${event.operationId}:attempt:${event.attempt}`) {
    throw new J4LiveError(
      'LEDGER_SCHEMA',
      'J4 ledger attempt identity is invalid.',
    )
  }
}

function assertProviderUsage(value, provider, label) {
  assertUsage(value, label)
  if ((provider === 'gemini' &&
      (value.judgeInputTokens !== 0 || value.judgeOutputTokens !== 0)) ||
    (provider === 'openai' &&
      (value.geminiInputTokens !== 0 ||
        value.geminiOutputTokens !== 0))) {
    throw new J4LiveError(
      'LEDGER_SCHEMA',
      `${label} mixes provider token classes.`,
    )
  }
}

function assertUsageWithinReservation(usage, reservation) {
  for (const field of tokenUsageFields) {
    if (usage[field] > reservation[field]) {
      throw new J4LiveError(
        'LEDGER_SCHEMA',
        'Measured J4 usage exceeds its durable reservation.',
      )
    }
  }
}

function assertWithinLimits(state, reservation, {
  capUsd,
  limits,
  newLogicalPurpose = null,
} = {}) {
  if (limits && state.attempts + 1 > limits.maxAttempts) {
    throw new J4LiveError(
      'J4_ATTEMPT_CAP',
      'The next provider attempt would exceed the J4 attempt ceiling.',
    )
  }
  if (limits && newLogicalPurpose &&
    (state.logicalRequests[newLogicalPurpose] ?? 0) + 1 >
      limits.maxLogicalRequests[newLogicalPurpose]) {
    throw new J4LiveError(
      'J4_LOGICAL_REQUEST_CAP',
      `The next ${newLogicalPurpose} request would exceed its J4 ceiling.`,
    )
  }
  if (limits &&
    (state.accounted.geminiInputTokens + reservation.geminiInputTokens >
        limits.maxTokens.geminiInput ||
      state.accounted.geminiOutputTokens + reservation.geminiOutputTokens >
        limits.maxTokens.geminiOutputIncludingThinking ||
      state.accounted.judgeInputTokens + reservation.judgeInputTokens >
        limits.maxTokens.judgeInput ||
      state.accounted.judgeOutputTokens + reservation.judgeOutputTokens >
        limits.maxTokens.judgeOutput)) {
    throw new J4LiveError(
      'J4_TOKEN_CAP',
      'The next provider attempt would exceed a J4 token ceiling.',
    )
  }
  const projected = clone(state.accounted)
  addUsage(projected, reservation)
  if (capUsd !== undefined && projected.usd > capUsd) {
    throw new J4LiveError(
      'J4_SPEND_CAP',
      'The next provider attempt would exceed the J4 cumulative cap.',
    )
  }
}

export function reconcileJ4LedgerText(
  text = '',
  { capUsd, limits: rawLimits } = {},
) {
  const limits = rawLimits ? validateJ4MeterLimits(rawLimits) : null
  const state = initialState()
  const starts = new Map()
  const terminals = new Map()
  const operations = new Map()
  const lines = String(text).split('\n').filter(Boolean)
  for (let index = 0; index < lines.length; index += 1) {
    let event
    try {
      event = JSON.parse(lines[index])
    } catch (error) {
      throw new J4LiveError(
        'LEDGER_JSON',
        'J4 ledger contains invalid JSON.',
        { cause: error },
      )
    }
    if (event.sequence !== index + 1 ||
      event.schemaVersion !== 1 ||
      !['attempt_started', 'attempt_terminal'].includes(event.type) ||
      typeof event.attemptId !== 'string' ||
      typeof event.operationId !== 'string') {
      throw new J4LiveError(
        'LEDGER_SCHEMA',
        'J4 ledger sequence or event schema is invalid.',
      )
    }
    state.sequence = event.sequence
    if (event.type === 'attempt_started') {
      if (starts.has(event.attemptId) ||
        terminals.has(event.attemptId) ||
        !Number.isSafeInteger(event.attempt) ||
        event.attempt < 1 ||
        event.attempt > J4_RETRY_LIMIT + 1 ||
        !/^[a-f0-9]{64}$/.test(event.requestSha256 ?? '') ||
        !/^[a-f0-9]{64}$/.test(event.transcriptStartedSha256 ?? '') ||
        typeof event.transcriptFile !== 'string') {
        throw new J4LiveError(
          'LEDGER_SCHEMA',
          'J4 ledger has a duplicate or malformed attempt start.',
        )
      }
      assertStartIdentity(event)
      assertProviderUsage(
        event.reservation,
        event.provider,
        'J4 reservation',
      )
      const prior = operations.get(event.operationId)
      if (!prior) {
        if (event.attempt !== 1) {
          throw new J4LiveError(
            'LEDGER_SCHEMA',
            'A J4 logical request must begin at attempt one.',
          )
        }
      } else if (
        event.attempt !== prior.start.attempt + 1 ||
        !prior.terminal ||
        !['http_error', 'transport_error'].includes(prior.terminal.outcome) ||
        prior.terminal.retryable !== true ||
        prior.start.cellId !== event.cellId ||
        prior.start.endpoint !== event.endpoint ||
        prior.start.model !== event.model ||
        prior.start.provider !== event.provider ||
        prior.start.purpose !== event.purpose ||
        prior.start.requestSha256 !== event.requestSha256 ||
        !sameJson(prior.start.reservation, event.reservation)
      ) {
        throw new J4LiveError(
          'LEDGER_SCHEMA',
          'A retried J4 request changed context or ordering.',
        )
      }
      const previousHash = state.operationRequestHashes[event.operationId]
      if (previousHash && previousHash !== event.requestSha256) {
        throw new J4LiveError(
          'RETRY_REQUEST_CHANGED',
          'A J4 retry changed the exact provider request.',
        )
      }
      assertWithinLimits(state, event.reservation, {
        capUsd,
        limits,
        newLogicalPurpose: event.attempt === 1 ? event.purpose : null,
      })
      state.operationRequestHashes[event.operationId] = event.requestSha256
      starts.set(event.attemptId, event)
      state.attempts += 1
      addUsage(state.accounted, event.reservation)
      addUsage(state.uncertain, event.reservation)
      state.logicalRequests[event.purpose] =
        (state.logicalRequests[event.purpose] ?? 0) +
        (event.attempt === 1 ? 1 : 0)
      if (event.attempt > 1) {
        state.retries.push({
          attempt: event.attempt,
          attemptId: event.attemptId,
          operationId: event.operationId,
        })
      }
      operations.set(event.operationId, { start: event, terminal: null })
      continue
    }
    const start = starts.get(event.attemptId)
    if (!start ||
      terminals.has(event.attemptId) ||
      event.operationId !== start.operationId ||
      event.requestSha256 !== start.requestSha256 ||
      event.transcriptFile !== start.transcriptFile ||
      !/^[a-f0-9]{64}$/.test(event.transcriptSha256 ?? '')) {
      throw new J4LiveError(
        'LEDGER_SCHEMA',
        'J4 ledger terminal does not match one attempt start.',
      )
    }
    if (!['http_error', 'invalid_response', 'success', 'transport_error']
      .includes(event.outcome)) {
      throw new J4LiveError(
        'LEDGER_SCHEMA',
        'J4 ledger terminal has an invalid outcome.',
      )
    }
    if (event.outcome === 'success') {
      if (event.retryable !== false) {
        throw new J4LiveError(
          'LEDGER_SCHEMA',
          'A successful J4 attempt must be non-retryable.',
        )
      }
      assertProviderUsage(
        event.usage,
        start.provider,
        'J4 measured usage',
      )
      assertUsageWithinReservation(event.usage, start.reservation)
      subtractUsage(state.accounted, start.reservation)
      subtractUsage(state.uncertain, start.reservation)
      addUsage(state.measured, event.usage)
      addUsage(state.accounted, event.usage)
      if (start.provider === 'gemini') {
        if (!nonEmptyString(event.modelVersion) ||
          (state.geminiModelVersion &&
            state.geminiModelVersion !== event.modelVersion)) {
          throw new J4LiveError(
            'LEDGER_SCHEMA',
            'J4 Gemini modelVersion changed inside one run.',
          )
        }
        state.geminiModelVersion = event.modelVersion
      }
    } else if (event.usage !== null ||
      typeof event.retryable !== 'boolean' ||
      (event.outcome === 'invalid_response' && event.retryable !== false)) {
      throw new J4LiveError(
        'LEDGER_SCHEMA',
        'A failed J4 attempt has invalid retry or usage metadata.',
      )
    }
    terminals.set(event.attemptId, event)
    operations.set(start.operationId, { start, terminal: event })
  }
  return {
    ...state,
    operations: Object.fromEntries(operations),
    starts: Object.fromEntries(starts),
    terminals: Object.fromEntries(terminals),
  }
}

export async function reconcileJ4Ledger(path, options) {
  let text
  try {
    text = await readFile(path, 'utf8')
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
    text = ''
  }
  return reconcileJ4LedgerText(text, options)
}

async function syncDirectory(path) {
  const handle = await open(path, 'r')
  try {
    await handle.sync()
  } finally {
    await handle.close()
  }
}

async function ensureJournal(path) {
  if (!nonEmptyString(path)) {
    throw new J4LiveError(
      'LEDGER_PATH_MISSING',
      'J4 meter requires a ledger path.',
    )
  }
  const parent = dirname(path)
  await mkdir(parent, { recursive: true, mode: 0o700 })
  const parentMetadata = await lstat(parent)
  if (!parentMetadata.isDirectory() || parentMetadata.isSymbolicLink()) {
    throw new J4LiveError(
      'LEDGER_PARENT_INVALID',
      'J4 ledger parent must be one real directory.',
    )
  }
  await chmod(parent, 0o700)
  try {
    const metadata = await lstat(path)
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      throw new J4LiveError(
        'LEDGER_INVALID',
        'J4 ledger must be one regular non-symlink file.',
      )
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
  const handle = await open(path, 'a', 0o600)
  try {
    await handle.chmod(0o600)
    await handle.sync()
  } finally {
    await handle.close()
  }
  await syncDirectory(parent)
}

async function appendEvent(path, state, event) {
  const next = {
    ...event,
    schemaVersion: 1,
    sequence: state.sequence + 1,
  }
  const handle = await open(path, 'a', 0o600)
  try {
    await handle.writeFile(`${JSON.stringify(next)}\n`, 'utf8')
    await handle.sync()
  } finally {
    await handle.close()
  }
  return next
}

function responseRetryAfterMs(headers) {
  const rawMs = headers?.get?.('retry-after-ms')
  if (rawMs !== null && rawMs !== undefined && String(rawMs).trim()) {
    const milliseconds = Number(rawMs)
    if (Number.isFinite(milliseconds) && milliseconds >= 0) {
      return Math.min(Math.ceil(milliseconds), 59_000)
    }
  }
  const raw = headers?.get?.('retry-after')
  if (!raw) return 0
  const seconds = Number(raw)
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(Math.ceil(seconds * 1000), 59_000)
  }
  const date = Date.parse(raw)
  return Number.isFinite(date)
    ? Math.min(Math.max(0, date - Date.now()), 59_000)
    : 0
}

function retryableResponse(response) {
  const explicit = response?.headers?.get?.('x-should-retry')
  if (explicit === 'true') return true
  if (explicit === 'false') return false
  return RETRYABLE_STATUS.has(response.status) || response.status >= 500
}

function retryDelay(attempt, headers) {
  return Math.max(
    [250, 500, 1_000][attempt - 1] ?? 1_000,
    responseRetryAfterMs(headers),
  )
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function exactResponseText(response, maximumBytes) {
  const declared = Number(response.headers?.get?.('content-length'))
  if (Number.isFinite(declared) && declared > maximumBytes) {
    throw new J4LiveError(
      'RESPONSE_TOO_LARGE',
      'J4 provider response exceeds the frozen size ceiling.',
    )
  }
  if (!response.body?.getReader) {
    const text = await response.text()
    if (Buffer.byteLength(text) <= maximumBytes) return text
    throw new J4LiveError(
      'RESPONSE_TOO_LARGE',
      'J4 provider response exceeds the frozen size ceiling.',
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
      if (bytes > maximumBytes) {
        await reader.cancel().catch(() => {})
        throw new J4LiveError(
          'RESPONSE_TOO_LARGE',
          'J4 provider response exceeds the frozen size ceiling.',
        )
      }
      chunks.push(chunk)
    }
  } finally {
    reader.releaseLock()
  }
  return Buffer.concat(chunks, bytes).toString('utf8')
}

function parseJson(text, provider) {
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new J4LiveError(
      'PROVIDER_JSON_INVALID',
      `${provider} returned malformed JSON.`,
      { cause: error },
    )
  }
}

function visibleGeminiText(candidate) {
  const parts = candidate?.content?.parts
  if (!Array.isArray(parts) || parts.length < 1) {
    throw new J4LiveError(
      'GEMINI_CONTENT_INVALID',
      'Gemini returned no candidate content parts.',
    )
  }
  for (const part of parts) {
    if (!part || typeof part !== 'object' ||
      typeof part.text !== 'string' ||
      Object.keys(part).some((key) =>
        !['text', 'thought', 'thoughtSignature'].includes(key))) {
      throw new J4LiveError(
        'GEMINI_CONTENT_INVALID',
        'Gemini returned a non-text or unsupported candidate part.',
      )
    }
  }
  const text = parts
    .filter((part) => part.thought !== true)
    .map((part) => part.text ?? '')
    .join('')
    .trim()
  if (!text) {
    throw new J4LiveError(
      'GEMINI_CONTENT_EMPTY',
      'Gemini returned no visible completion text.',
    )
  }
  return text
}

export function parseJ4GeminiSuccess({
  body,
  expectedModelVersion = null,
  rawBody,
  reservation,
} = {}) {
  const parsed = parseJson(rawBody, 'Gemini')
  const modelVersion = String(parsed?.modelVersion ?? '')
  if ((modelVersion !== J4_GEMINI_MODEL &&
      !modelVersion.startsWith(`${J4_GEMINI_MODEL}-`)) ||
    (expectedModelVersion && modelVersion !== expectedModelVersion)) {
    throw new J4LiveError(
      'GEMINI_MODEL_MISMATCH',
      'Gemini returned an unexpected modelVersion.',
    )
  }
  if (parsed?.promptFeedback?.blockReason) {
    throw new J4LiveError(
      'GEMINI_PROMPT_BLOCKED',
      'Gemini blocked the J4 request.',
    )
  }
  if (!Array.isArray(parsed?.candidates) || parsed.candidates.length !== 1) {
    throw new J4LiveError(
      'GEMINI_CANDIDATE_COUNT',
      'Gemini must return exactly one candidate.',
    )
  }
  const candidate = parsed.candidates[0]
  if (candidate.finishReason !== 'STOP') {
    throw new J4LiveError(
      candidate.finishReason === 'MAX_TOKENS'
        ? 'GEMINI_TRUNCATED'
        : 'GEMINI_FINISH_REASON',
      `Gemini completion ended with ${String(
        candidate.finishReason ?? 'no finish reason',
      )}.`,
    )
  }
  const text = visibleGeminiText(candidate)
  const usage = parsed?.usageMetadata
  const input = usage?.promptTokenCount
  const candidateTokens = usage?.candidatesTokenCount
  const thoughtTokens = usage?.thoughtsTokenCount ?? 0
  const total = usage?.totalTokenCount
  const cached = usage?.cachedContentTokenCount ?? 0
  const tool = usage?.toolUsePromptTokenCount ?? 0
  const output = Number(candidateTokens) + Number(thoughtTokens)
  if (!positiveInteger(input) ||
    !positiveInteger(candidateTokens) ||
    !integer(thoughtTokens) ||
    !positiveInteger(total) ||
    !integer(cached) ||
    !integer(tool) ||
    cached > input ||
    tool !== 0 ||
    total !== input + candidateTokens + thoughtTokens ||
    input > reservation.geminiInputTokens ||
    output > body?.generationConfig?.maxOutputTokens ||
    output > reservation.geminiOutputTokens) {
    throw new J4LiveError(
      'GEMINI_USAGE_INVALID',
      'Gemini usage is missing, inconsistent, or outside frozen limits.',
    )
  }
  return {
    finishReason: candidate.finishReason,
    modelVersion,
    rawUsage: usage,
    text,
    usage: {
      geminiInputTokens: input,
      geminiOutputTokens: output,
      judgeInputTokens: 0,
      judgeOutputTokens: 0,
      usd:
        input * J4_PRICES_USD_PER_TOKEN.geminiInput +
        output * J4_PRICES_USD_PER_TOKEN.geminiOutputIncludingThinking,
    },
    usageDetails: {
      cachedInputTokens: cached,
      candidateTokens,
      thoughtTokens,
    },
  }
}

export function parseJ4JudgeSuccess({
  body,
  model,
  rawBody,
  reservation,
} = {}) {
  const parsed = parseJson(rawBody, 'OpenAI')
  if (parsed?.model !== model) {
    throw new J4LiveError(
      'JUDGE_MODEL_MISMATCH',
      'OpenAI returned a different judge snapshot.',
    )
  }
  if (!Array.isArray(parsed?.choices) || parsed.choices.length !== 1) {
    throw new J4LiveError(
      'JUDGE_CHOICE_COUNT',
      'OpenAI judge must return exactly one choice.',
    )
  }
  const choice = parsed.choices[0]
  if (choice.finish_reason !== 'stop') {
    throw new J4LiveError(
      choice.finish_reason === 'length'
        ? 'JUDGE_TRUNCATED'
        : 'JUDGE_FINISH_REASON',
      `OpenAI judge ended with ${String(
        choice.finish_reason ?? 'no finish reason',
      )}.`,
    )
  }
  const text = choice?.message?.content
  if (typeof text !== 'string' || !text.trim()) {
    throw new J4LiveError(
      'JUDGE_CONTENT_EMPTY',
      'OpenAI judge returned no visible text.',
    )
  }
  const input = parsed?.usage?.prompt_tokens
  const output = parsed?.usage?.completion_tokens
  const total = parsed?.usage?.total_tokens
  if (!positiveInteger(input) ||
    !positiveInteger(output) ||
    !positiveInteger(total) ||
    total !== input + output ||
    input > reservation.judgeInputTokens ||
    output > body.max_tokens) {
    throw new J4LiveError(
      'JUDGE_USAGE_INVALID',
      'OpenAI judge usage is missing, inconsistent, or outside frozen limits.',
    )
  }
  return {
    finishReason: choice.finish_reason,
    modelVersion: parsed.model,
    rawUsage: parsed.usage,
    text: text.trim(),
    usage: {
      geminiInputTokens: 0,
      geminiOutputTokens: 0,
      judgeInputTokens: input,
      judgeOutputTokens: output,
      usd:
        input * J4_PRICES_USD_PER_TOKEN.judgeInput +
        output * J4_PRICES_USD_PER_TOKEN.judgeOutput,
    },
    usageDetails: {},
  }
}

function redactError(error, secrets) {
  const scrub = (value) => {
    let text = String(value)
    for (const secret of secrets) {
      if (secret) text = text.replaceAll(secret, '[REDACTED_SECRET]')
    }
    return text
      .replace(/\bsk-(?:proj-)?[A-Za-z0-9_-]{8,}\b/g, '[REDACTED_SECRET]')
      .replace(/\bAIza[A-Za-z0-9_-]{12,}\b/g, '[REDACTED_SECRET]')
      .replace(/\bBearer\s+[^\s"',}\\]+/gi, '[REDACTED_SECRET]')
  }
  return {
    code: scrub(
      error?.code ?? error?.name ?? 'PROVIDER_FAILURE',
    ).slice(0, 80),
    message: scrub(error?.message ?? 'Provider failure.').slice(0, 240),
  }
}

function assertRequestIdentity({
  body,
  cellId,
  model,
  operationId,
  provider,
  purpose,
}) {
  if (!nonEmptyString(cellId) ||
    !nonEmptyString(model) ||
    !nonEmptyString(operationId) ||
    !PURPOSES.has(purpose) ||
    !Object.hasOwn(PROVIDER_ENDPOINTS, provider) ||
    (provider === 'gemini') !== GEMINI_PURPOSES.has(purpose)) {
    throw new J4LiveError(
      'REQUEST_IDENTITY_INVALID',
      'J4 provider request identity is invalid.',
    )
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new J4LiveError(
      'REQUEST_SCHEMA',
      'J4 provider request body must be one object.',
    )
  }
}

function assertGeminiRequest(body, purpose) {
  const expectedGeneration = purpose === 'writer'
    ? J4_GEMINI_WRITER_GENERATION
    : J4_GEMINI_ANSWER_GENERATION
  const allowedTop = new Set([
    'contents',
    'generationConfig',
    'systemInstruction',
  ])
  if (Object.keys(body).some((key) => !allowedTop.has(key)) ||
    !Array.isArray(body.contents) ||
    body.contents.length < 1 ||
    !body.generationConfig ||
    body.generationConfig.maxOutputTokens !==
      expectedGeneration.maxOutputTokens ||
    body.generationConfig.thinkingConfig?.thinkingLevel !== 'MINIMAL') {
    throw new J4LiveError(
      'GEMINI_REQUEST_SCHEMA',
      'Gemini request differs from the frozen J4 shape.',
    )
  }
  const allowedGeneration = new Set([
    'maxOutputTokens',
    'responseMimeType',
    'thinkingConfig',
  ])
  if (Object.keys(body.generationConfig)
    .some((key) => !allowedGeneration.has(key)) ||
    Object.keys(body.generationConfig.thinkingConfig)
      .some((key) => key !== 'thinkingLevel') ||
    (purpose === 'writer' && !body.systemInstruction) ||
    (purpose === 'answer' &&
      Object.hasOwn(body, 'systemInstruction')) ||
    (purpose === 'writer' &&
      body.generationConfig.responseMimeType !== 'application/json') ||
    (purpose === 'answer' &&
      body.generationConfig.responseMimeType !== undefined)) {
    throw new J4LiveError(
      'GEMINI_REQUEST_SCHEMA',
      'Gemini generation settings differ from the frozen J4 purpose.',
    )
  }
}

function assertJudgeRequest(body, model) {
  const expectedKeys = ['max_tokens', 'messages', 'model', 'n', 'temperature']
  if (JSON.stringify(Object.keys(body).sort()) !==
      JSON.stringify(expectedKeys.sort()) ||
    model !== LONGMEMEVAL_JUDGE_MODEL ||
    body.model !== model ||
    body.n !== LONGMEMEVAL_JUDGE_REQUEST.n ||
    body.temperature !== LONGMEMEVAL_JUDGE_REQUEST.temperature ||
    body.max_tokens !== LONGMEMEVAL_JUDGE_REQUEST.maxTokens ||
    !Array.isArray(body.messages) ||
    body.messages.length !== 1 ||
    body.messages[0]?.role !== 'user' ||
    !nonEmptyString(body.messages[0]?.content)) {
    throw new J4LiveError(
      'JUDGE_REQUEST_SCHEMA',
      'OpenAI judge request differs from the frozen official shape.',
    )
  }
}

function operationAlreadyDispatched(state, operationId) {
  return Object.values(state.starts).some((event) =>
    event.operationId === operationId)
}

function ledgerIsRunnable(state) {
  if (Object.keys(state.starts).some((attemptId) =>
    !Object.hasOwn(state.terminals, attemptId))) {
    return false
  }
  return Object.values(state.operations).every((operation) =>
    operation.terminal?.outcome === 'success')
}

async function verifyJ4TranscriptLedgerCoherence({
  capUsd,
  journalPath,
  limits,
  transcriptDirectory,
}) {
  const [ledger, transcripts] = await Promise.all([
    reconcileJ4Ledger(journalPath, { capUsd, limits }),
    verifyLiveTranscriptArtifacts({
      directory: transcriptDirectory,
      journalPath,
    }),
  ])
  for (const [attemptId, start] of Object.entries(ledger.starts)) {
    const terminal = ledger.terminals[attemptId]
    let record
    try {
      record = JSON.parse(
        await readFile(join(transcriptDirectory, start.transcriptFile), 'utf8'),
      )
    } catch (error) {
      throw new J4LiveError(
        'EVIDENCE_COHERENCE',
        'J4 could not parse one linked provider transcript.',
        { cause: error },
      )
    }
    let body
    try {
      body = JSON.parse(record?.request?.normalizedBody)
    } catch (error) {
      throw new J4LiveError(
        'EVIDENCE_COHERENCE',
        'A J4 transcript contains a non-JSON provider request.',
        { cause: error },
      )
    }
    if (!terminal ||
      record?.attempt?.metadata?.provider !== start.provider ||
      Object.keys(record?.attempt?.metadata ?? {}).length !== 1 ||
      record?.request?.model !== start.model) {
      throw new J4LiveError(
        'EVIDENCE_COHERENCE',
        'J4 transcript identity differs from its aggregate ledger.',
      )
    }
    if (start.provider === 'gemini') {
      assertGeminiRequest(body, start.purpose)
      if (!sameJson(record.request.settings, body.generationConfig)) {
        throw new J4LiveError(
          'EVIDENCE_COHERENCE',
          'J4 Gemini transcript settings differ from its request.',
        )
      }
    } else {
      assertJudgeRequest(body, start.model)
      if (!sameJson(record.request.settings, {
        maxTokens: body.max_tokens,
        n: body.n,
        temperature: body.temperature,
      })) {
        throw new J4LiveError(
          'EVIDENCE_COHERENCE',
          'J4 judge transcript settings differ from its request.',
        )
      }
    }
    const expectedReservation = j4ReservationFor({
      body: record.request.normalizedBody,
      maxOutputTokens: start.provider === 'gemini'
        ? body.generationConfig.maxOutputTokens
        : body.max_tokens,
      provider: start.provider,
    })
    if (!sameJson(expectedReservation, start.reservation)) {
      throw new J4LiveError(
        'EVIDENCE_COHERENCE',
        'J4 ledger reservation differs from its exact transcript request.',
      )
    }
    const transcriptResponse = record?.terminal?.response ?? null
    const ledgerStatus = Object.hasOwn(terminal, 'status')
      ? terminal.status
      : null
    if ((transcriptResponse?.status ?? null) !== ledgerStatus) {
      throw new J4LiveError(
        'EVIDENCE_COHERENCE',
        'J4 transcript status differs from its aggregate ledger.',
      )
    }
    if (terminal.outcome !== 'success') {
      let expectedRetryable = false
      if (terminal.outcome === 'transport_error') {
        expectedRetryable = true
      } else if (terminal.outcome === 'http_error') {
        expectedRetryable = retryableResponse({
          headers: new Headers(transcriptResponse?.headers ?? {}),
          status: transcriptResponse?.status,
        })
      }
      if (terminal.retryable !== expectedRetryable) {
        throw new J4LiveError(
          'EVIDENCE_COHERENCE',
          'J4 retry metadata differs from the recorded provider outcome.',
        )
      }
      continue
    }
    if (transcriptResponse?.bodyAvailable !== true ||
      typeof transcriptResponse.rawBody !== 'string') {
      throw new J4LiveError(
        'EVIDENCE_COHERENCE',
        'A successful J4 ledger attempt lacks its exact response body.',
      )
    }
    const parsed = start.provider === 'gemini'
      ? parseJ4GeminiSuccess({
          body,
          expectedModelVersion: terminal.modelVersion,
          rawBody: transcriptResponse.rawBody,
          reservation: start.reservation,
        })
      : parseJ4JudgeSuccess({
          body,
          model: start.model,
          rawBody: transcriptResponse.rawBody,
          reservation: start.reservation,
        })
    if (!sameJson(parsed.usage, terminal.usage) ||
      !sameJson(parsed.usageDetails, terminal.usageDetails) ||
      parsed.modelVersion !== terminal.modelVersion ||
      parsed.finishReason !== transcriptResponse.finishReason ||
      !sameJson(parsed.rawUsage, transcriptResponse.usage)) {
      throw new J4LiveError(
        'EVIDENCE_COHERENCE',
        'J4 measured ledger usage differs from its exact provider response.',
      )
    }
  }
  return { ledger, transcripts }
}

export async function createJ4MeteredTransport({
  capUsd,
  fetchImpl = globalThis.fetch,
  geminiApiKey,
  journalPath,
  limits: rawLimits,
  openaiApiKey,
  transcriptDirectory,
  waitImpl = wait,
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new J4LiveError(
      'FETCH_MISSING',
      'J4 metered transport requires fetch.',
    )
  }
  if (!geminiApiKey || !openaiApiKey) {
    throw new J4LiveError(
      'CREDENTIALS_MISSING',
      'J4 metered transport requires both provider credentials.',
    )
  }
  if (!Number.isFinite(capUsd) || capUsd <= 0) {
    throw new J4LiveError(
      'CAP_INVALID',
      'J4 metered transport requires a positive cumulative cap.',
    )
  }
  if (!nonEmptyString(transcriptDirectory)) {
    throw new J4LiveError(
      'TRANSCRIPT_DIRECTORY_MISSING',
      'J4 metered transport requires a transcript directory.',
    )
  }
  if (typeof waitImpl !== 'function') {
    throw new J4LiveError(
      'WAIT_INVALID',
      'J4 retry wait implementation must be a function.',
    )
  }
  const limits = validateJ4MeterLimits(rawLimits)
  await ensureJournal(journalPath)
  let state = await reconcileJ4Ledger(journalPath, { capUsd, limits })
  if (!ledgerIsRunnable(state)) {
    throw new J4LiveError(
      'LEDGER_NOT_RESUMABLE',
      'J4 ledger contains a failed or uncertain operation.',
    )
  }
  const recorder = await createLiveTranscriptRecorder({
    directory: transcriptDirectory,
    forbiddenSecrets: [geminiApiKey, openaiApiKey],
  })
  if (state.attempts > 0) {
    await verifyJ4TranscriptLedgerCoherence({
      capUsd,
      journalPath,
      limits,
      transcriptDirectory,
    })
  }
  let lockedGeminiModelVersion = state.geminiModelVersion
  const originalGlobalFetch = globalThis.fetch
  let guardInstalled = false
  let fatal = false
  let queue = Promise.resolve()
  const secrets = [String(geminiApiKey), String(openaiApiKey)]

  const runExclusive = (action) => {
    const next = queue.then(action, action)
    queue = next.catch(() => {})
    return next
  }

  async function call({
    body,
    cellId,
    endpoint,
    headers,
    model,
    operationId,
    provider,
    purpose,
    url,
  }) {
    if (fatal) {
      throw new J4LiveError(
        'METER_FATAL',
        'J4 meter is terminal after a prior provider failure.',
      )
    }
    assertRequestIdentity({
      body,
      cellId,
      model,
      operationId,
      provider,
      purpose,
    })
    if (provider === 'gemini') {
      assertGeminiRequest(body, purpose)
    } else {
      assertJudgeRequest(body, model)
    }
    if ((provider === 'gemini' && url !== GEMINI_GENERATE_URL) ||
      (provider === 'openai' && url !== OPENAI_CHAT_URL) ||
      new URL(url).search) {
      throw new J4LiveError(
        'PROVIDER_URL_INVALID',
        'J4 provider URL differs from its fixed key-free endpoint.',
      )
    }
    state = await reconcileJ4Ledger(journalPath, { capUsd, limits })
    if (!ledgerIsRunnable(state)) {
      fatal = true
      throw new J4LiveError(
        'LEDGER_NOT_RESUMABLE',
        'J4 ledger contains a failed or uncertain operation.',
      )
    }
    if (operationAlreadyDispatched(state, operationId)) {
      throw new J4LiveError(
        'OPERATION_ALREADY_DISPATCHED',
        'A J4 provider operation can never be dispatched twice.',
      )
    }
    const normalizedBody = bodyText(body)
    if (Buffer.byteLength(normalizedBody) > limits.maxResponseBytes) {
      throw new J4LiveError(
        'REQUEST_TOO_LARGE',
        'J4 provider request exceeds the frozen byte ceiling.',
      )
    }
    const requestSha256 = transcriptSha256(normalizedBody)
    const maxOutputTokens = provider === 'gemini'
      ? body?.generationConfig?.maxOutputTokens
      : body?.max_tokens
    const reservation = j4ReservationFor({
      body: normalizedBody,
      maxOutputTokens,
      provider,
    })

    for (let attempt = 1; attempt <= limits.retryLimit + 1; attempt += 1) {
      state = await reconcileJ4Ledger(journalPath, { capUsd, limits })
      assertWithinLimits(state, reservation, {
        capUsd,
        limits,
        newLogicalPurpose: attempt === 1 ? purpose : null,
      })
      const attemptId = `${operationId}:attempt:${attempt}`
      const transcript = await recorder.beginAttempt({
        attempt,
        attemptId,
        cellId,
        endpoint,
        metadata: { provider },
        model,
        normalizedRequestBody: normalizedBody,
        operationId,
        purpose,
        requestBytes: Buffer.byteLength(normalizedBody),
        settings: provider === 'gemini'
          ? clone(body.generationConfig)
          : {
              maxTokens: body.max_tokens,
              n: body.n,
              temperature: body.temperature,
            },
      })
      await appendEvent(journalPath, state, {
        attempt,
        attemptId,
        cellId,
        endpoint,
        model,
        operationId,
        provider,
        purpose,
        requestSha256,
        reservation,
        timestamp: new Date().toISOString(),
        transcriptFile: transcript.transcriptFile,
        transcriptStartedSha256: transcript.transcriptSha256,
        type: 'attempt_started',
      })
      state = await reconcileJ4Ledger(journalPath, { capUsd, limits })

      let response
      let rawResponse = null
      const controller = new AbortController()
      const timeout = setTimeout(
        () => controller.abort(),
        limits.requestTimeoutMs,
      )
      try {
        response = await fetchImpl(url, {
          body: normalizedBody,
          headers,
          method: 'POST',
          redirect: 'error',
          signal: controller.signal,
        })
        rawResponse = await exactResponseText(
          response,
          limits.maxResponseBytes,
        )
      } catch (error) {
        clearTimeout(timeout)
        const retryable = error?.code !== 'RESPONSE_TOO_LARGE'
        const outcome = retryable ? 'transport_error' : 'invalid_response'
        const terminalTranscript = await transcript.finish({
          outcome,
          rawBody: rawResponse,
          responseHeaders: response?.headers,
          status: response?.status ?? null,
          transportError: error,
        })
        state = await reconcileJ4Ledger(journalPath, { capUsd, limits })
        await appendEvent(journalPath, state, {
          attemptId,
          error: redactError(error, secrets),
          operationId,
          outcome,
          requestSha256,
          retryable,
          status: response?.status ?? null,
          timestamp: new Date().toISOString(),
          transcriptFile: terminalTranscript.transcriptFile,
          transcriptSha256: terminalTranscript.transcriptSha256,
          type: 'attempt_terminal',
          usage: null,
        })
        if (retryable && attempt <= limits.retryLimit) {
          await waitImpl(retryDelay(attempt, response?.headers))
          continue
        }
        fatal = true
        if (!retryable) throw error
        throw new J4LiveError(
          'TRANSPORT_RETRIES_EXHAUSTED',
          'J4 provider transport failed after all permitted attempts.',
          { cause: error },
        )
      } finally {
        clearTimeout(timeout)
      }

      if (!response.ok) {
        const retryable = retryableResponse(response)
        const terminalTranscript = await transcript.finish({
          outcome: 'http_error',
          rawBody: rawResponse,
          responseHeaders: response.headers,
          status: response.status,
        })
        state = await reconcileJ4Ledger(journalPath, { capUsd, limits })
        await appendEvent(journalPath, state, {
          attemptId,
          error: {
            code: `HTTP_${response.status}`,
            message: `Provider returned HTTP ${response.status}.`,
          },
          operationId,
          outcome: 'http_error',
          requestSha256,
          retryable,
          status: response.status,
          timestamp: new Date().toISOString(),
          transcriptFile: terminalTranscript.transcriptFile,
          transcriptSha256: terminalTranscript.transcriptSha256,
          type: 'attempt_terminal',
          usage: null,
        })
        if (retryable && attempt <= limits.retryLimit) {
          await waitImpl(retryDelay(attempt, response.headers))
          continue
        }
        fatal = true
        throw new J4LiveError(
          retryable
            ? 'HTTP_RETRIES_EXHAUSTED'
            : 'HTTP_NON_RETRYABLE',
          `J4 provider returned terminal HTTP ${response.status}.`,
        )
      }

      let parsed
      try {
        parsed = provider === 'gemini'
          ? parseJ4GeminiSuccess({
              body,
              expectedModelVersion: lockedGeminiModelVersion,
              rawBody: rawResponse,
              reservation,
            })
          : parseJ4JudgeSuccess({
              body,
              model,
              rawBody: rawResponse,
              reservation,
            })
      } catch (error) {
        const terminalTranscript = await transcript.finish({
          outcome: 'invalid_response',
          rawBody: rawResponse,
          responseHeaders: response.headers,
          status: response.status,
        })
        state = await reconcileJ4Ledger(journalPath, { capUsd, limits })
        await appendEvent(journalPath, state, {
          attemptId,
          error: redactError(error, secrets),
          operationId,
          outcome: 'invalid_response',
          requestSha256,
          retryable: false,
          status: response.status,
          timestamp: new Date().toISOString(),
          transcriptFile: terminalTranscript.transcriptFile,
          transcriptSha256: terminalTranscript.transcriptSha256,
          type: 'attempt_terminal',
          usage: null,
        })
        fatal = true
        throw error
      }
      if (provider === 'gemini') {
        lockedGeminiModelVersion ??= parsed.modelVersion
      }
      const terminalTranscript = await transcript.finish({
        finishReason: parsed.finishReason,
        outcome: 'success',
        rawBody: rawResponse,
        responseHeaders: response.headers,
        status: response.status,
        usage: parsed.rawUsage,
      })
      state = await reconcileJ4Ledger(journalPath, { capUsd, limits })
      await appendEvent(journalPath, state, {
        attemptId,
        modelVersion: parsed.modelVersion,
        operationId,
        outcome: 'success',
        requestSha256,
        retryable: false,
        status: response.status,
        timestamp: new Date().toISOString(),
        transcriptFile: terminalTranscript.transcriptFile,
        transcriptSha256: terminalTranscript.transcriptSha256,
        type: 'attempt_terminal',
        usage: parsed.usage,
        usageDetails: parsed.usageDetails,
      })
      state = await reconcileJ4Ledger(journalPath, { capUsd, limits })
      return {
        finishReason: parsed.finishReason,
        modelVersion: parsed.modelVersion,
        text: parsed.text,
        usage: clone(parsed.usage),
        usageDetails: clone(parsed.usageDetails),
        validated: true,
      }
    }
    throw new J4LiveError(
      'ATTEMPT_LOOP_EXHAUSTED',
      'J4 provider attempt loop ended unexpectedly.',
    )
  }

  return {
    async callGemini({
      body,
      cellId,
      operationId,
      purpose,
    } = {}) {
      const request = buildGeminiGenerateRequest({
        apiKey: geminiApiKey,
        body,
        model: J4_GEMINI_MODEL,
      })
      if (request.url !== GEMINI_GENERATE_URL ||
        request.init.headers['x-goog-api-key'] !== geminiApiKey ||
        Object.keys(request.init.headers).sort().join(',') !==
          'content-type,x-goog-api-key') {
        throw new J4LiveError(
          'GEMINI_AUTH_PATH_INVALID',
          'Gemini authorization must use only the fixed header path.',
        )
      }
      return runExclusive(() => call({
        body,
        cellId,
        endpoint: 'gemini-generate-content',
        headers: request.init.headers,
        model: J4_GEMINI_MODEL,
        operationId,
        provider: 'gemini',
        purpose,
        url: request.url,
      }))
    },

    async callJudge({
      body,
      cellId,
      model,
      operationId,
      purpose = 'judge',
    } = {}) {
      return runExclusive(() => call({
        body,
        cellId,
        endpoint: 'openai-chat-completions',
        headers: {
          authorization: `Bearer ${openaiApiKey}`,
          'content-type': 'application/json',
        },
        model,
        operationId,
        provider: 'openai',
        purpose,
        url: OPENAI_CHAT_URL,
      }))
    },

    closeNetworkGuard() {
      if (!guardInstalled) return
      globalThis.fetch = originalGlobalFetch
      guardInstalled = false
    },

    get geminiModelVersion() {
      return lockedGeminiModelVersion
    },

    installNetworkGuard() {
      if (guardInstalled) {
        throw new J4LiveError(
          'NETWORK_GUARD_INSTALLED',
          'J4 network guard is already installed.',
        )
      }
      globalThis.fetch = async (input, init) => {
        const url = new URL(
          typeof input === 'string' || input instanceof URL
            ? input
            : input?.url,
        )
        if (!['127.0.0.1', '::1', 'localhost'].includes(url.hostname)) {
          throw new J4LiveError(
            'UNMETERED_NETWORK_BLOCKED',
            'J4 blocks ordinary non-loopback networking after key capture.',
          )
        }
        return originalGlobalFetch(input, init)
      }
      guardInstalled = true
    },

    async snapshot() {
      await queue
      state = await reconcileJ4Ledger(journalPath, { capUsd, limits })
      return clone({
        accounted: state.accounted,
        attempts: state.attempts,
        geminiModelVersion: state.geminiModelVersion,
        logicalRequests: state.logicalRequests,
        measured: state.measured,
        retries: state.retries,
        sequence: state.sequence,
        uncertain: state.uncertain,
      })
    },

    async verify() {
      await queue
      const [{ ledger, transcripts }, directoryMetadata, parentMetadata] =
        await Promise.all([
        verifyJ4TranscriptLedgerCoherence({
          capUsd,
          journalPath,
          limits,
          transcriptDirectory,
        }),
        stat(transcriptDirectory),
        stat(dirname(journalPath)),
      ])
      const metadata = await stat(journalPath)
      if (!metadata.isFile() || (metadata.mode & 0o777) !== 0o600) {
        throw new J4LiveError(
          'LEDGER_MODE',
          'J4 meter ledger must be one mode-0600 regular file.',
        )
      }
      if (!directoryMetadata.isDirectory() ||
        (directoryMetadata.mode & 0o777) !== 0o700 ||
        !parentMetadata.isDirectory() ||
        (parentMetadata.mode & 0o777) !== 0o700) {
        throw new J4LiveError(
          'EVIDENCE_DIRECTORY_MODE',
          'J4 evidence directories must be mode 0700.',
        )
      }
      return {
        ledger: clone({
          accounted: ledger.accounted,
          attempts: ledger.attempts,
          geminiModelVersion: ledger.geminiModelVersion,
          logicalRequests: ledger.logicalRequests,
          measured: ledger.measured,
          retries: ledger.retries,
          sequence: ledger.sequence,
          uncertain: ledger.uncertain,
        }),
        transcripts,
      }
    },
  }
}

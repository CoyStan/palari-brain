// J3 live-only runtime: frozen configuration, metered OpenAI transport,
// authored-probe executor, and ignored local report rendering.
//
// This module is eval infrastructure, not a product dependency. It never
// reads a key at import time and never calls a provider on import.

import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { mkdir, open, readFile } from 'node:fs/promises'
import { dirname } from 'node:path'

import { buildPromptConfigManifest, promptConfigHash } from '../src/eval-prompt-config.mjs'
import { gradeProbe } from './harness.mjs'

export const LIVE_MODEL = 'gpt-5-nano-2025-08-07'
export const LIVE_EMBEDDING_MODEL = 'text-embedding-3-small'
export const LIVE_EMBEDDING_DIMENSIONS = 1536
export const LIVE_CAP_USD = 0.25
export const LIVE_BANK_SHA256 =
  '7edd93e6b3c8d3942c492a76f75f2a14681f82e4b922c2fd123bb281e0ada910'
export const LIVE_PREDICTIONS_SHA256 =
  'b119cbac5ef0eb22e1c6a2bdea6f2c0ff90c0cc942592963f09a5a33b0e722b0'
export const LIVE_KERNEL_PROMPT_HASH = '3147ad22edc76d12'
export const LIVE_CONFIG_SHA256 =
  'd9e93f74d13760fb29b6a13317071d846aec14cc1bd6623e434efb2ef63e21eb'

export const LIVE_ANSWER_SYSTEM = [
  "Answer the user's question using only the provided memory briefing.",
  'If the briefing says no stored memories are relevant, reply exactly',
  '"I have no stored memories relevant to this question."',
  'Do not use outside knowledge or infer unstored facts.',
  'Keep the answer concise.',
].join(' ')

// Key order and values are frozen in evals/predictions-bakeoff.md. Do not
// reorder or extend this object after a live result exists.
export const LIVE_CONFIG_MANIFEST = Object.freeze({
  version: 1,
  model: LIVE_MODEL,
  endpoint: 'chat.completions',
  stream: false,
  temperature: null,
  topP: null,
  memoryMaxCompletionTokens: 500,
  answerMaxCompletionTokens: 300,
  embeddingModel: LIVE_EMBEDDING_MODEL,
  embeddingDimensions: LIVE_EMBEDDING_DIMENSIONS,
  kernelBasePromptHash: LIVE_KERNEL_PROMPT_HASH,
  kernelExtraction:
    'mechanical OpenAI translation of buildMemoryExtractionRequest JSON response contract',
  mem0Extraction: 'native mem0ai/oss prompt',
  answerSystem: LIVE_ANSWER_SYSTEM,
  answerUser: 'buildAnswerPrompt output',
  mem0Scope: 'userId->userId;palariId->agentId;conjunctive;no shared fallback',
  mem0SourceSerialization:
    'userMessage + each sourceText in original order as \\n\\nAttached source:\\n + text; assistantMessage second',
  mem0CustomInstructions: null,
  mem0Telemetry: false,
})

export const LIVE_LIMITS = Object.freeze({
  maxAttemptsPerLogicalRequest: 4,
  maxChatInputTokens: 2_900_000,
  maxChatLogicalRequests: 98,
  maxChatOutputTokens: 200_000,
  maxEmbeddingInputTokens: 1_000_000,
  maxEmbeddingLogicalRequests: 192,
  maxRequestBytes: 60_000,
  maxTotalAttempts: 1_160,
  upstreamTimeoutMs: 60_000,
})

const SENTINELS = Object.freeze({
  answer: 'palari-meter-answer',
  kernelMemory: 'palari-meter-kernel-memory',
  mem0Embedding: 'palari-meter-mem0-embedding',
  mem0Memory: 'palari-meter-mem0-memory',
})

const CHAT_INPUT_USD_PER_TOKEN = 0.05 / 1_000_000
const CHAT_OUTPUT_USD_PER_TOKEN = 0.40 / 1_000_000
const EMBEDDING_INPUT_USD_PER_TOKEN = 0.02 / 1_000_000
const RETRYABLE_STATUS = new Set([408, 409, 429, 500, 501, 502, 503, 504])
const CHAT_ALLOWED_KEYS = new Set([
  'max_completion_tokens',
  'messages',
  'model',
  'response_format',
])
const EMBEDDING_ALLOWED_KEYS = new Set([
  'dimensions',
  'encoding_format',
  'input',
  'model',
])

export class LiveRunError extends Error {
  constructor(code, message, { cause } = {}) {
    super(message, cause ? { cause } : undefined)
    this.name = 'LiveRunError'
    this.code = code
  }
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

export function liveConfigHash() {
  return sha256(JSON.stringify(LIVE_CONFIG_MANIFEST))
}

export function assertFrozenLiveInputs({ bankText, predictionsText } = {}) {
  const checks = {
    bank: sha256(String(bankText ?? '')),
    config: liveConfigHash(),
    kernelPrompt: promptConfigHash(buildPromptConfigManifest()),
    predictions: sha256(String(predictionsText ?? '')),
  }
  if (checks.bank !== LIVE_BANK_SHA256) {
    throw new LiveRunError('BANK_HASH_MISMATCH', 'Live bank differs from the frozen J3 bank.')
  }
  if (checks.predictions !== LIVE_PREDICTIONS_SHA256) {
    throw new LiveRunError(
      'PREDICTIONS_HASH_MISMATCH',
      'FINAL live predictions changed after their frozen commit.',
    )
  }
  if (checks.kernelPrompt !== LIVE_KERNEL_PROMPT_HASH) {
    throw new LiveRunError(
      'KERNEL_PROMPT_HASH_MISMATCH',
      'Kernel prompt surface differs from the pre-registered hash.',
    )
  }
  if (checks.config !== LIVE_CONFIG_SHA256) {
    throw new LiveRunError(
      'LIVE_CONFIG_HASH_MISMATCH',
      'Live configuration differs from the pre-registered manifest.',
    )
  }
  return checks
}

export function assertLiveEnvironment(env = process.env) {
  if (env.PALARI_CONFIRM_SPEND !== '1') {
    throw new LiveRunError(
      'SPEND_NOT_CONFIRMED',
      'PALARI_CONFIRM_SPEND must equal 1.',
    )
  }
  if (env.PALARI_LIVE_MODEL !== LIVE_MODEL) {
    throw new LiveRunError(
      'MODEL_MISMATCH',
      `PALARI_LIVE_MODEL must equal ${LIVE_MODEL}.`,
    )
  }
  if (env.PALARI_LIVE_SPEND_CAP_USD !== String(LIVE_CAP_USD)) {
    throw new LiveRunError(
      'CAP_MISMATCH',
      `PALARI_LIVE_SPEND_CAP_USD must equal ${LIVE_CAP_USD}.`,
    )
  }
  if (env.MEM0_TELEMETRY !== 'false') {
    throw new LiveRunError(
      'TELEMETRY_NOT_DISABLED',
      'MEM0_TELEMETRY must equal false before loading mem0ai.',
    )
  }
  const apiKey = String(env.OPENAI_API_KEY ?? '').trim()
  if (!apiKey) {
    throw new LiveRunError('NO_OPENAI_KEY', 'OPENAI_API_KEY is absent.')
  }
  return { apiKey, capUsd: LIVE_CAP_USD, model: LIVE_MODEL }
}

export function createBlankMeterState() {
  return {
    accounted: {
      chatInputTokens: 0,
      chatOutputTokens: 0,
      embeddingInputTokens: 0,
      usd: 0,
    },
    attempts: 0,
    fatal: null,
    logicalRequests: { chat: 0, embedding: 0 },
    measured: {
      chatInputTokens: 0,
      chatOutputTokens: 0,
      embeddingInputTokens: 0,
      usd: 0,
    },
    retries: [],
    sequence: 0,
    uncertain: {
      chatInputTokens: 0,
      chatOutputTokens: 0,
      embeddingInputTokens: 0,
      usd: 0,
    },
  }
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value))
}

function restoreMeterState(initialState) {
  const state = createBlankMeterState()
  if (!initialState) return state
  for (const section of ['accounted', 'logicalRequests', 'measured', 'uncertain']) {
    for (const key of Object.keys(state[section])) {
      const value = Number(initialState?.[section]?.[key] ?? 0)
      if (!Number.isFinite(value) ||
        value < 0 ||
        (key !== 'usd' && !Number.isSafeInteger(value))) {
        throw new LiveRunError('BAD_METER_STATE', `Invalid restored meter field ${section}.${key}.`)
      }
      state[section][key] = value
    }
  }
  for (const key of ['attempts', 'sequence']) {
    const value = Number(initialState?.[key] ?? 0)
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new LiveRunError('BAD_METER_STATE', `Invalid restored meter field ${key}.`)
    }
    state[key] = value
  }
  state.retries = Array.isArray(initialState.retries) ? cloneJson(initialState.retries) : []
  state.fatal = initialState.fatal ? cloneJson(initialState.fatal) : null
  if (state.fatal) {
    throw new LiveRunError('RESTORED_FATAL_METER', 'Cannot resume a meter with a fatal state.')
  }
  return state
}

function assertLedgerUsage(usage, endpoint, label) {
  if (!usage || typeof usage !== 'object') {
    throw new LiveRunError('BAD_METER_JOURNAL', `${label} is missing usage accounting.`)
  }
  for (const field of [
    'chatInputTokens',
    'chatOutputTokens',
    'embeddingInputTokens',
    'usd',
  ]) {
    if (!Number.isFinite(usage[field]) || usage[field] < 0) {
      throw new LiveRunError('BAD_METER_JOURNAL', `${label} has invalid ${field}.`)
    }
    if (field !== 'usd' && !Number.isSafeInteger(usage[field])) {
      throw new LiveRunError('BAD_METER_JOURNAL', `${label} has fractional token counts.`)
    }
  }
  const expectedUsd = usage.chatInputTokens * CHAT_INPUT_USD_PER_TOKEN +
    usage.chatOutputTokens * CHAT_OUTPUT_USD_PER_TOKEN +
    usage.embeddingInputTokens * EMBEDDING_INPUT_USD_PER_TOKEN
  if (Math.abs(expectedUsd - usage.usd) > 1e-12) {
    throw new LiveRunError('BAD_METER_JOURNAL', `${label} has inconsistent USD accounting.`)
  }
  if (endpoint === 'chat' && usage.embeddingInputTokens !== 0) {
    throw new LiveRunError('BAD_METER_JOURNAL', `${label} mixes chat and embedding usage.`)
  }
  if (endpoint === 'embeddings' &&
    (usage.chatInputTokens !== 0 || usage.chatOutputTokens !== 0)) {
    throw new LiveRunError('BAD_METER_JOURNAL', `${label} mixes embedding and chat usage.`)
  }
}

function comparableMeterState(value) {
  const restored = restoreMeterState(value)
  return safeMeterSnapshot(restored)
}

function sameMeterState(left, right) {
  return JSON.stringify(comparableMeterState(left)) ===
    JSON.stringify(comparableMeterState(right))
}

export async function reconcileMeterJournal(path, expectedState) {
  if (!expectedState) {
    throw new LiveRunError(
      'MISSING_CHECKPOINT_METER',
      'A resumable live checkpoint must contain a meter snapshot.',
    )
  }
  let text
  try {
    text = await readFile(path, 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT') text = ''
    else throw error
  }
  const lines = text.split('\n').filter(Boolean)
  const replay = createBlankMeterState()
  const attempts = new Map()
  const logical = new Map()

  for (let index = 0; index < lines.length; index += 1) {
    let event
    try {
      event = JSON.parse(lines[index])
    } catch {
      throw new LiveRunError('BAD_METER_JOURNAL', 'Meter journal contains invalid JSON.')
    }
    const expectedSequence = index + 1
    if (event.sequence !== expectedSequence) {
      throw new LiveRunError(
        'BAD_METER_JOURNAL',
        'Meter journal sequence is not contiguous from one.',
      )
    }
    replay.sequence = expectedSequence

    if (event.type === 'attempt_started') {
      if (attempts.has(event.attemptId) ||
        !Number.isSafeInteger(event.attempt) ||
        event.attempt < 1 ||
        event.attempt > LIVE_LIMITS.maxAttemptsPerLogicalRequest ||
        !['chat', 'embeddings'].includes(event.endpoint) ||
        typeof event.logicalId !== 'string' ||
        typeof event.attemptId !== 'string' ||
        typeof event.cellId !== 'string' ||
        typeof event.operationId !== 'string' ||
        typeof event.requestSha256 !== 'string') {
        throw new LiveRunError('BAD_METER_JOURNAL', 'Meter journal has an invalid attempt start.')
      }
      assertLedgerUsage(event.reservation, event.endpoint, 'Attempt reservation')
      assertReservationWithinLimits(replay, event.reservation, LIVE_CAP_USD)
      const priorLogical = logical.get(event.logicalId)
      if (!priorLogical) {
        if (event.attempt !== 1) {
          throw new LiveRunError(
            'BAD_METER_JOURNAL',
            'A logical request must begin at attempt one.',
          )
        }
        const kind = event.endpoint === 'chat' ? 'chat' : 'embedding'
        const logicalLimit = kind === 'chat'
          ? LIVE_LIMITS.maxChatLogicalRequests
          : LIVE_LIMITS.maxEmbeddingLogicalRequests
        if (replay.logicalRequests[kind] + 1 > logicalLimit) {
          throw new LiveRunError(
            'BAD_METER_JOURNAL',
            'Meter journal exceeds a logical request ceiling.',
          )
        }
        replay.logicalRequests[kind] += 1
        logical.set(event.logicalId, {
          cellId: event.cellId,
          endpoint: event.endpoint,
          lastAttempt: 1,
          lastTerminal: null,
          operationId: event.operationId,
          purpose: event.purpose,
          requestSha256: event.requestSha256,
          reservation: event.reservation,
        })
      } else {
        if (priorLogical.endpoint !== event.endpoint ||
          event.attempt !== priorLogical.lastAttempt + 1 ||
          priorLogical.lastTerminal?.outcome !== 'failed' ||
          priorLogical.lastTerminal?.retryable !== true ||
          priorLogical.cellId !== event.cellId ||
          priorLogical.operationId !== event.operationId ||
          priorLogical.purpose !== event.purpose ||
          priorLogical.requestSha256 !== event.requestSha256 ||
          JSON.stringify(priorLogical.reservation) !== JSON.stringify(event.reservation)) {
          throw new LiveRunError(
            'BAD_METER_JOURNAL',
            'A retried logical request has invalid ordering or context.',
          )
        }
        priorLogical.lastAttempt = event.attempt
        priorLogical.lastTerminal = null
      }
      attempts.set(event.attemptId, { event, terminal: null })
      replay.attempts += 1
      continue
    }

    if (event.type !== 'attempt_terminal') {
      throw new LiveRunError('BAD_METER_JOURNAL', 'Meter journal has an unknown event type.')
    }
    const started = attempts.get(event.attemptId)
    if (!started || started.terminal ||
      event.requestSha256 !== started.event.requestSha256) {
      throw new LiveRunError(
        'BAD_METER_JOURNAL',
        'Meter journal terminal event does not match one unique start.',
      )
    }
    const logicalState = logical.get(started.event.logicalId)
    if (!logicalState || logicalState.lastAttempt !== started.event.attempt ||
      logicalState.lastTerminal !== null) {
      throw new LiveRunError(
        'BAD_METER_JOURNAL',
        'Meter journal terminal event has invalid logical ordering.',
      )
    }
    if (event.outcome === 'succeeded') {
      assertLedgerUsage(event.usage, started.event.endpoint, 'Measured provider usage')
      if (event.usage.chatInputTokens > started.event.reservation.chatInputTokens ||
        event.usage.chatOutputTokens > started.event.reservation.chatOutputTokens ||
        event.usage.embeddingInputTokens >
          started.event.reservation.embeddingInputTokens) {
        throw new LiveRunError(
          'BAD_METER_JOURNAL',
          'Measured usage exceeds its durable reservation.',
        )
      }
      addUsage(replay.measured, event.usage)
      addUsage(replay.accounted, event.usage)
    } else if (event.outcome === 'failed' || event.outcome === 'invalid_success') {
      if (event.outcome === 'failed' && typeof event.retryable !== 'boolean') {
        throw new LiveRunError(
          'BAD_METER_JOURNAL',
          'A failed attempt must record whether it was retryable.',
        )
      }
      addUsage(replay.uncertain, started.event.reservation)
      addUsage(replay.accounted, started.event.reservation)
      if (event.outcome === 'failed' &&
        event.retryable === true &&
        started.event.attempt < LIVE_LIMITS.maxAttemptsPerLogicalRequest) {
        if (!Number.isSafeInteger(event.retryDelayMs) ||
          event.retryDelayMs < 0 ||
          event.retryDelayMs > 59_000) {
          throw new LiveRunError(
            'BAD_METER_JOURNAL',
            'Meter journal has an invalid retry delay.',
          )
        }
        replay.retries.push({
          attempt: started.event.attempt,
          cellId: started.event.cellId,
          endpoint: started.event.endpoint,
          logicalId: started.event.logicalId,
          operationId: started.event.operationId,
          retryDelayMs: event.retryDelayMs,
          status: event.status ?? null,
        })
      }
    } else {
      throw new LiveRunError('BAD_METER_JOURNAL', 'Meter journal has an invalid outcome.')
    }
    started.terminal = event
    logicalState.lastTerminal = event
  }

  if ([...attempts.values()].some((entry) => !entry.terminal)) {
    throw new LiveRunError(
      'UNCERTAIN_PROVIDER_ATTEMPT',
      'Meter journal contains an attempt without a terminal record; rerun is forbidden.',
    )
  }
  if ([...logical.values()].some((entry) => entry.lastTerminal?.outcome !== 'succeeded')) {
    throw new LiveRunError(
      'TERMINAL_PROVIDER_LEDGER',
      'Meter journal ends with an unsuccessful logical request; rerun is forbidden.',
    )
  }
  if (!sameMeterState(replay, expectedState)) {
    throw new LiveRunError(
      'METER_CHECKPOINT_MISMATCH',
      'Durable meter journal does not exactly match the checkpoint snapshot.',
    )
  }
  return safeMeterSnapshot(replay)
}

async function verifyMeterJournal(path, expectedState) {
  try {
    return await reconcileMeterJournal(path, expectedState)
  } catch (error) {
    if (error instanceof LiveRunError) throw error
    throw error
  }
}

async function appendAndSync(path, value) {
  await mkdir(dirname(path), { recursive: true })
  const handle = await open(path, 'a', 0o600)
  try {
    await handle.writeFile(`${JSON.stringify(value)}\n`, 'utf8')
    await handle.sync()
  } finally {
    await handle.close()
  }
}

function bearerToken(headers) {
  const value = String(headers.authorization ?? '')
  return value.startsWith('Bearer ') ? value.slice(7) : ''
}

function parsePurpose(token, endpoint) {
  if (endpoint === 'embeddings' && token === SENTINELS.mem0Embedding) {
    return 'mem0-embedding'
  }
  if (endpoint !== 'chat') return null
  if (token === SENTINELS.answer) return 'answer'
  if (token === SENTINELS.kernelMemory) return 'kernel-memory'
  if (token === SENTINELS.mem0Memory) return 'mem0-memory'
  return null
}

function integer(value) {
  return Number.isSafeInteger(value) && value >= 0
}

function responseJson(res, status, code, message) {
  const body = JSON.stringify({ error: { code, message, type: 'palari_live_meter' } })
  res.writeHead(status, {
    'content-length': Buffer.byteLength(body),
    'content-type': 'application/json',
    'x-should-retry': 'false',
  })
  res.end(body)
}

async function requestBody(req, limit) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > limit) {
      throw new LiveRunError('REQUEST_TOO_LARGE', `Provider request exceeded ${limit} bytes.`)
    }
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

function validateStringMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new LiveRunError('BAD_CHAT_MESSAGES', 'Chat messages must be a non-empty array.')
  }
  for (const message of messages) {
    if (!['assistant', 'system', 'user'].includes(message?.role) ||
      typeof message?.content !== 'string') {
      throw new LiveRunError(
        'UNMETERED_MULTIMODAL_PATH',
        'Only string system/user/assistant chat messages are permitted.',
      )
    }
  }
}

function normalizedProviderRequest({ body, endpoint, purpose }) {
  const allowed = endpoint === 'chat' ? CHAT_ALLOWED_KEYS : EMBEDDING_ALLOWED_KEYS
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) {
      throw new LiveRunError('UNAPPROVED_PROVIDER_FIELD', `Provider field ${key} is not approved.`)
    }
  }
  if (endpoint === 'chat') {
    if (body.model !== LIVE_MODEL) {
      throw new LiveRunError('MODEL_MISMATCH', 'Chat request used an unapproved model.')
    }
    validateStringMessages(body.messages)
    const isAnswer = purpose === 'answer'
    if (isAnswer) {
      if (body.response_format !== undefined) {
        throw new LiveRunError('ANSWER_FORMAT_MISMATCH', 'Answer requests cannot set response_format.')
      }
      if (body.messages.length !== 2 ||
        body.messages[0].role !== 'system' ||
        body.messages[0].content !== LIVE_ANSWER_SYSTEM ||
        body.messages[1].role !== 'user') {
        throw new LiveRunError(
          'ANSWER_PROMPT_MISMATCH',
          'Answer request differs from the frozen shared prompt shape.',
        )
      }
    } else if (body.response_format?.type !== 'json_object' ||
      Object.keys(body.response_format).length !== 1) {
      throw new LiveRunError(
        'MEMORY_FORMAT_MISMATCH',
        'Memory requests must use the JSON-object response format.',
      )
    }
    const max = isAnswer
      ? LIVE_CONFIG_MANIFEST.answerMaxCompletionTokens
      : LIVE_CONFIG_MANIFEST.memoryMaxCompletionTokens
    if (body.max_completion_tokens !== undefined && body.max_completion_tokens !== max) {
      throw new LiveRunError(
        'TOKEN_LIMIT_MISMATCH',
        'Caller supplied a conflicting completion-token limit.',
      )
    }
    return { ...body, max_completion_tokens: max }
  }

  if (body.model !== LIVE_EMBEDDING_MODEL ||
    body.dimensions !== LIVE_EMBEDDING_DIMENSIONS ||
    body.encoding_format !== 'float') {
    throw new LiveRunError(
      'EMBEDDING_CONFIG_MISMATCH',
      'Embedding request differs from the frozen model/dimension/format.',
    )
  }
  if (typeof body.input !== 'string' &&
    (!Array.isArray(body.input) || body.input.length === 0 ||
      body.input.some((entry) => typeof entry !== 'string'))) {
    throw new LiveRunError('BAD_EMBEDDING_INPUT', 'Embedding input must be string text.')
  }
  return body
}

function reservationFor(endpoint, bytes, body) {
  if (endpoint === 'chat') {
    const inputTokens = bytes + 4096
    const outputTokens = body.max_completion_tokens
    return {
      chatInputTokens: inputTokens,
      chatOutputTokens: outputTokens,
      embeddingInputTokens: 0,
      usd: inputTokens * CHAT_INPUT_USD_PER_TOKEN +
        outputTokens * CHAT_OUTPUT_USD_PER_TOKEN,
    }
  }
  const inputTokens = bytes + 1024
  return {
    chatInputTokens: 0,
    chatOutputTokens: 0,
    embeddingInputTokens: inputTokens,
    usd: inputTokens * EMBEDDING_INPUT_USD_PER_TOKEN,
  }
}

function usageForSuccess(endpoint, parsed, reservation, body) {
  if (endpoint === 'chat') {
    if (parsed?.model !== LIVE_MODEL) {
      throw new LiveRunError('RESPONSE_MODEL_MISMATCH', 'Provider returned a different chat model.')
    }
    const input = parsed?.usage?.prompt_tokens
    const output = parsed?.usage?.completion_tokens
    const total = parsed?.usage?.total_tokens
    if (!integer(input) || !integer(output) || !integer(total) ||
      total !== input + output ||
      input > reservation.chatInputTokens ||
      output > body.max_completion_tokens) {
      throw new LiveRunError('BAD_PROVIDER_USAGE', 'Chat response usage is missing or out of bounds.')
    }
    return {
      chatInputTokens: input,
      chatOutputTokens: output,
      embeddingInputTokens: 0,
      usd: input * CHAT_INPUT_USD_PER_TOKEN + output * CHAT_OUTPUT_USD_PER_TOKEN,
    }
  }

  if (parsed?.model !== LIVE_EMBEDDING_MODEL) {
    throw new LiveRunError(
      'RESPONSE_MODEL_MISMATCH',
      'Provider returned a different embedding model.',
    )
  }
  const input = parsed?.usage?.prompt_tokens
  const total = parsed?.usage?.total_tokens
  const expectedCount = Array.isArray(body.input) ? body.input.length : 1
  if (!integer(input) || !integer(total) || total !== input ||
    input > reservation.embeddingInputTokens ||
    !Array.isArray(parsed?.data) || parsed.data.length !== expectedCount ||
    parsed.data.some((entry) =>
      !Array.isArray(entry?.embedding) ||
      entry.embedding.length !== LIVE_EMBEDDING_DIMENSIONS)) {
    throw new LiveRunError(
      'BAD_PROVIDER_USAGE',
      'Embedding response usage or vector dimensions are out of bounds.',
    )
  }
  return {
    chatInputTokens: 0,
    chatOutputTokens: 0,
    embeddingInputTokens: input,
    usd: input * EMBEDDING_INPUT_USD_PER_TOKEN,
  }
}

function addUsage(target, usage) {
  target.chatInputTokens += usage.chatInputTokens
  target.chatOutputTokens += usage.chatOutputTokens
  target.embeddingInputTokens += usage.embeddingInputTokens
  target.usd += usage.usd
}

function roundedUsd(value) {
  return Number(value.toFixed(10))
}

function safeMeterSnapshot(state) {
  const copy = cloneJson(state)
  for (const section of ['accounted', 'measured', 'uncertain']) {
    copy[section].usd = roundedUsd(copy[section].usd)
  }
  return copy
}

export function assertReservationWithinLimits(state, reservation, capUsd) {
  if (state.attempts + 1 > LIVE_LIMITS.maxTotalAttempts) {
    throw new LiveRunError('ATTEMPT_CAP', 'Provider attempt ceiling reached.')
  }
  if (state.accounted.chatInputTokens + reservation.chatInputTokens >
      LIVE_LIMITS.maxChatInputTokens ||
    state.accounted.chatOutputTokens + reservation.chatOutputTokens >
      LIVE_LIMITS.maxChatOutputTokens ||
    state.accounted.embeddingInputTokens + reservation.embeddingInputTokens >
      LIVE_LIMITS.maxEmbeddingInputTokens) {
    throw new LiveRunError('TOKEN_CAP', 'Provider token commitment ceiling reached.')
  }
  if (state.accounted.usd + reservation.usd > capUsd + Number.EPSILON) {
    throw new LiveRunError('SPEND_CAP', 'Next provider attempt would exceed the spend cap.')
  }
}

function providerRetryAfterMs(headers) {
  const rawMilliseconds = headers?.get?.('retry-after-ms')
  if (rawMilliseconds !== null &&
    rawMilliseconds !== undefined &&
    String(rawMilliseconds).trim() !== '') {
    const retryAfterMs = Number(rawMilliseconds)
    if (Number.isFinite(retryAfterMs) && retryAfterMs >= 0) {
      return Math.min(Math.ceil(retryAfterMs), 59_000)
    }
  }
  const raw = headers?.get?.('retry-after')
  if (!raw) return 0
  const seconds = Number(raw)
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(Math.ceil(seconds * 1000), 59_000)
  }
  const date = Date.parse(raw)
  if (Number.isFinite(date)) {
    return Math.min(Math.max(0, date - Date.now()), 59_000)
  }
  return 0
}

function retryDelay(attempt, headers) {
  const backoff = [250, 500, 1000][attempt - 1] ?? 1000
  return Math.max(backoff, providerRetryAfterMs(headers))
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function sanitizedFatal(error) {
  return {
    code: error?.code ?? 'PROVIDER_FAILURE',
    message: String(error?.message ?? 'Provider failure').slice(0, 240),
  }
}

export async function createMeteredOpenAITransport({
  apiKey,
  capUsd,
  initialState,
  journalPath,
  upstreamOrigin = 'https://api.openai.com',
  upstreamFetch = globalThis.fetch.bind(globalThis),
} = {}) {
  if (!String(apiKey ?? '').trim()) {
    throw new LiveRunError('NO_OPENAI_KEY', 'Meter transport requires a non-empty key.')
  }
  if (capUsd !== LIVE_CAP_USD) {
    throw new LiveRunError('CAP_MISMATCH', `Meter cap must equal ${LIVE_CAP_USD}.`)
  }
  if (!journalPath) {
    throw new LiveRunError('NO_METER_JOURNAL', 'Meter journal path is required.')
  }
  await verifyMeterJournal(journalPath, initialState ?? createBlankMeterState())
  const state = restoreMeterState(initialState)
  const key = String(apiKey)
  apiKey = null
  let activeOperation = null
  let guard = null
  let queue = Promise.resolve()
  let origin = ''

  const appendEvent = async (event) => {
    state.sequence += 1
    await appendAndSync(journalPath, {
      ...event,
      sequence: state.sequence,
      timestamp: new Date().toISOString(),
    })
  }

  const setFatal = (error) => {
    state.fatal = sanitizedFatal(error)
  }

  const runExclusive = (fn) => {
    const next = queue.then(fn, fn)
    queue = next.catch(() => {})
    return next
  }

  const server = createServer(async (req, res) => {
    try {
      if (req.method !== 'POST') {
        return responseJson(res, 405, 'METHOD_NOT_ALLOWED', 'Only POST is allowed.')
      }
      const url = new URL(req.url, origin || 'http://127.0.0.1')
      if (url.search || !['/v1/chat/completions', '/v1/embeddings'].includes(url.pathname)) {
        return responseJson(res, 404, 'ENDPOINT_NOT_ALLOWED', 'Provider endpoint is not approved.')
      }
      const endpoint = url.pathname.endsWith('/embeddings') ? 'embeddings' : 'chat'
      const purpose = parsePurpose(bearerToken(req.headers), endpoint)
      if (!purpose) {
        return responseJson(res, 401, 'SENTINEL_MISMATCH', 'Meter sentinel is invalid.')
      }
      if (!activeOperation) {
        return responseJson(res, 409, 'NO_ACTIVE_OPERATION', 'Provider call has no live operation.')
      }
      const raw = await requestBody(req, LIVE_LIMITS.maxRequestBytes)
      let parsed
      try {
        parsed = JSON.parse(raw.toString('utf8'))
      } catch {
        return responseJson(res, 400, 'BAD_PROVIDER_JSON', 'Provider request JSON is invalid.')
      }

      await runExclusive(async () => {
        if (state.fatal) {
          return responseJson(res, 409, 'METER_FATAL', 'Meter is in a terminal state.')
        }
        const outgoing = normalizedProviderRequest({ body: parsed, endpoint, purpose })
        const bodyText = JSON.stringify(outgoing)
        const bytes = Buffer.byteLength(bodyText)
        if (bytes > LIVE_LIMITS.maxRequestBytes) {
          throw new LiveRunError(
            'REQUEST_TOO_LARGE',
            `Canonical provider request exceeded ${LIVE_LIMITS.maxRequestBytes} bytes.`,
          )
        }
        const logicalKind = endpoint === 'chat' ? 'chat' : 'embedding'
        const nextLogical = state.logicalRequests[logicalKind] + 1
        const logicalCap = endpoint === 'chat'
          ? LIVE_LIMITS.maxChatLogicalRequests
          : LIVE_LIMITS.maxEmbeddingLogicalRequests
        if (nextLogical > logicalCap) {
          throw new LiveRunError(
            'LOGICAL_CALL_CAP',
            `${logicalKind} logical request ceiling reached.`,
          )
        }
        state.logicalRequests[logicalKind] = nextLogical
        const logicalId = `${activeOperation.cellId}:${activeOperation.operationId}:${logicalKind}:${nextLogical}`
        const requestSha256 = sha256(bodyText)
        const reservation = reservationFor(endpoint, bytes, outgoing)
        const upstreamPath = endpoint === 'chat'
          ? '/v1/chat/completions'
          : '/v1/embeddings'
        let finalResponse = null
        let finalText = ''

        for (let attempt = 1;
          attempt <= LIVE_LIMITS.maxAttemptsPerLogicalRequest;
          attempt += 1) {
          assertReservationWithinLimits(state, reservation, capUsd)
          state.attempts += 1
          const attemptId = `${logicalId}:attempt:${attempt}`
          await appendEvent({
            attempt,
            attemptId,
            cellId: activeOperation.cellId,
            endpoint,
            logicalId,
            operationId: activeOperation.operationId,
            purpose,
            requestSha256,
            reservation,
            type: 'attempt_started',
          })

          let upstream
          let text = ''
          let transportError = null
          try {
            upstream = await upstreamFetch(new URL(upstreamPath, upstreamOrigin), {
              body: bodyText,
              headers: {
                authorization: `Bearer ${key}`,
                'content-type': 'application/json',
              },
              method: 'POST',
              redirect: 'error',
              signal: AbortSignal.timeout(LIVE_LIMITS.upstreamTimeoutMs),
            })
            text = await upstream.text()
          } catch (error) {
            transportError = error
          }

          if (transportError || !upstream?.ok) {
            addUsage(state.accounted, reservation)
            addUsage(state.uncertain, reservation)
            const status = upstream?.status ?? null
            const retryable = transportError !== null || RETRYABLE_STATUS.has(status)
            const retryDelayMs = retryable &&
              attempt < LIVE_LIMITS.maxAttemptsPerLogicalRequest
              ? retryDelay(attempt, upstream?.headers)
              : null
            await appendEvent({
              attemptId,
              outcome: 'failed',
              requestSha256,
              retryDelayMs,
              retryable,
              status,
              type: 'attempt_terminal',
            })
            if (retryable && attempt < LIVE_LIMITS.maxAttemptsPerLogicalRequest) {
              state.retries.push({
                attempt,
                cellId: activeOperation.cellId,
                endpoint,
                logicalId,
                operationId: activeOperation.operationId,
                retryDelayMs,
                status,
              })
              await wait(retryDelayMs)
              continue
            }
            const failure = new LiveRunError(
              retryable ? 'TRANSPORT_RETRY_EXHAUSTED' : 'PROVIDER_HTTP_ERROR',
              retryable
                ? 'Provider transport failed after the permitted attempts.'
                : `Provider rejected the request with HTTP ${status}.`,
              { cause: transportError ?? undefined },
            )
            setFatal(failure)
            return responseJson(res, 502, failure.code, failure.message)
          }

          let responseBody
          try {
            responseBody = JSON.parse(text)
            const usage = usageForSuccess(endpoint, responseBody, reservation, outgoing)
            addUsage(state.accounted, usage)
            addUsage(state.measured, usage)
            await appendEvent({
              attemptId,
              outcome: 'succeeded',
              requestSha256,
              status: upstream.status,
              usage,
              type: 'attempt_terminal',
            })
          } catch (error) {
            addUsage(state.accounted, reservation)
            addUsage(state.uncertain, reservation)
            await appendEvent({
              attemptId,
              outcome: 'invalid_success',
              requestSha256,
              status: upstream.status,
              type: 'attempt_terminal',
            })
            const failure = error instanceof LiveRunError
              ? error
              : new LiveRunError('BAD_PROVIDER_RESPONSE', 'Provider success JSON is invalid.')
            setFatal(failure)
            return responseJson(res, 502, failure.code, failure.message)
          }

          finalResponse = upstream
          finalText = text
          break
        }

        if (!finalResponse) {
          throw new LiveRunError('NO_PROVIDER_RESPONSE', 'Provider call ended without a response.')
        }
        const headers = {
          'content-length': Buffer.byteLength(finalText),
          'content-type': finalResponse.headers.get('content-type') ?? 'application/json',
          'x-should-retry': 'false',
        }
        const requestId = finalResponse.headers.get('x-request-id')
        if (requestId) headers['x-request-id'] = requestId
        res.writeHead(finalResponse.status, headers)
        res.end(finalText)
      })
    } catch (error) {
      const failure = error instanceof LiveRunError
        ? error
        : new LiveRunError('METER_INTERNAL_ERROR', 'Meter rejected the provider request.')
      setFatal(failure)
      if (!res.headersSent) responseJson(res, 500, failure.code, failure.message)
      else res.destroy()
    }
  })

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject)
      resolve()
    })
  })
  const address = server.address()
  origin = `http://127.0.0.1:${address.port}`

  async function withOperation({ cellId, operationId }, action) {
    if (activeOperation) {
      throw new LiveRunError('CONCURRENT_LIVE_OPERATION', 'Live operations must be sequential.')
    }
    if (state.fatal) {
      throw new LiveRunError('METER_FATAL', 'Meter is in a terminal state.')
    }
    activeOperation = {
      cellId: String(cellId),
      operationId: String(operationId),
    }
    try {
      const result = await action()
      if (state.fatal) {
        throw new LiveRunError(
          state.fatal.code,
          state.fatal.message,
        )
      }
      return result
    } finally {
      activeOperation = null
    }
  }

  async function callChat({ messages, purpose, responseFormat } = {}) {
    const sentinel = purpose === 'answer'
      ? SENTINELS.answer
      : purpose === 'kernel-memory'
        ? SENTINELS.kernelMemory
        : null
    if (!sentinel) {
      throw new LiveRunError('BAD_DIRECT_PURPOSE', 'Direct chat purpose is not approved.')
    }
    const body = {
      messages,
      model: LIVE_MODEL,
      ...(responseFormat ? { response_format: responseFormat } : {}),
    }
    const response = await upstreamFetch(`${origin}/v1/chat/completions`, {
      body: JSON.stringify(body),
      headers: {
        authorization: `Bearer ${sentinel}`,
        'content-type': 'application/json',
      },
      method: 'POST',
    })
    let parsed
    try {
      parsed = await response.json()
    } catch {
      throw new LiveRunError('BAD_METER_RESPONSE', 'Local meter returned invalid JSON.')
    }
    if (!response.ok) {
      throw new LiveRunError(
        parsed?.error?.code ?? 'METER_REJECTED',
        parsed?.error?.message ?? 'Local meter rejected the provider call.',
      )
    }
    return {
      model: parsed.model,
      text: String(parsed?.choices?.[0]?.message?.content ?? ''),
      usage: cloneJson(parsed.usage),
    }
  }

  function installNetworkGuard() {
    if (guard) return
    const previous = globalThis.fetch
    const allowed = new URL(origin)
    const guarded = async (input, init) => {
      const candidate = new URL(
        typeof input === 'string' || input instanceof URL
          ? input
          : input?.url,
      )
      if (candidate.origin !== allowed.origin) {
        throw new LiveRunError(
          'UNMETERED_NETWORK_BLOCKED',
          'An unmetered outbound fetch was blocked.',
        )
      }
      return previous(input, init)
    }
    globalThis.fetch = guarded
    guard = { guarded, previous }
  }

  async function close() {
    if (guard && globalThis.fetch === guard.guarded) {
      globalThis.fetch = guard.previous
    }
    guard = null
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })
  }

  return {
    baseURL: `${origin}/v1`,
    callChat,
    close,
    installNetworkGuard,
    sentinels: cloneJson(SENTINELS),
    snapshot: () => safeMeterSnapshot(state),
    withOperation,
  }
}

export async function executeLiveJourney({ arm, cellId, journey, meter } = {}) {
  const { palariId, userId } = journey.workspace
  const ingest = []
  const directives = []
  const probes = []
  let observedTotalWritten = 0
  let closeError = null

  try {
    await meter.withOperation(
      { cellId, operationId: 'open' },
      () => arm.open({ palariId, userId }),
    )
    for (const session of journey.sessions) {
      const turns = session.turns
      for (let index = 0; index < turns.length; index += 1) {
        if (turns[index].role !== 'user') continue
        const assistant = turns[index + 1]?.role === 'assistant'
          ? turns[index + 1].content
          : ''
        const sourceMessageId = `${session.sessionId}:${index}`
        const result = await meter.withOperation(
          { cellId, operationId: `ingest:${sourceMessageId}` },
          () => arm.ingestTurn({
            assistantMessage: assistant,
            eventAt: session.eventAt,
            palariId: turns[index].asPalariId ?? palariId,
            sourceMessageId,
            sourceTexts: turns[index].sourceTexts ?? [],
            userId: turns[index].asUserId ?? userId,
            userMessage: turns[index].content,
          }),
        )
        const memoriesWritten = Number(result?.memoriesWritten ?? 0)
        observedTotalWritten += memoriesWritten
        ingest.push({
          memoriesWritten,
          reason: result?.reason ?? null,
          sourceMessageId,
          status: result?.status ?? null,
        })
      }
      for (const directive of (journey.directives ?? [])
        .filter((entry) => entry.afterSession === session.sessionId)) {
        const result = await meter.withOperation(
          {
            cellId,
            operationId: `forget:${session.sessionId}:${directives.length}`,
          },
          () => arm.forget(directive.topic, {
            userId: directive.asUserId ?? userId,
          }),
        )
        directives.push({
          afterSession: directive.afterSession,
          deletedCount: Number(result?.count ?? result?.deleted?.length ?? 0),
          topic: directive.topic,
        })
      }
    }

    for (const probe of journey.probes) {
      const answer = await meter.withOperation(
        { cellId, operationId: `probe:${probe.id}` },
        () => arm.answer({
          palariId: probe.asPalariId ?? palariId,
          question: probe.question,
          questionDate: probe.questionDate,
          userId: probe.asUserId ?? userId,
        }),
      )
      const grade = gradeProbe(probe, answer)
      probes.push({
        abstained: answer?.abstained === true,
        answer: grade.answer,
        dimension: probe.dimension,
        evidence: Array.isArray(answer?.evidence) ? answer.evidence : [],
        knownFinding: probe.knownFinding ?? null,
        pass: grade.pass,
        probeId: probe.id,
        reasons: grade.reasons,
      })
    }
  } finally {
    try {
      // Both live arms close only local SQLite handles. Calling close outside
      // the meter lets fatal provider failures release those handles; any
      // accidental provider request still lacks an active operation and is
      // rejected by the proxy.
      await arm.close()
    } catch (error) {
      closeError = error
    }
  }
  if (closeError) throw closeError

  return {
    category: journey.category,
    ingest,
    journeyId: journey.id,
    probes,
    directives,
    writeObservation: {
      expectedTotalWritten: journey.expectTotalWritten ?? null,
      observedTotalWritten,
    },
  }
}

export function aggregateLiveCells(cells) {
  const byArm = new Map()
  for (const cell of cells) {
    const arm = byArm.get(cell.armName) ?? []
    arm.push(cell.result)
    byArm.set(cell.armName, arm)
  }
  const arms = []
  for (const [name, journeys] of byArm) {
    const all = journeys.flatMap((journey) => journey.probes)
    const byDimension = {}
    for (const probe of all) {
      const dimension = (byDimension[probe.dimension] ??= { failed: 0, passed: 0 })
      if (probe.pass) dimension.passed += 1
      else dimension.failed += 1
    }
    const findings = []
    for (const journey of journeys) {
      for (const probe of journey.probes.filter((entry) => !entry.pass)) {
        findings.push({
          journeyId: journey.journeyId,
          knownFinding: probe.knownFinding,
          probeId: probe.probeId,
          reasons: probe.reasons,
        })
      }
    }
    arms.push({
      byDimension,
      journeys,
      name,
      summary: {
        failedProbes: all.filter((probe) => !probe.pass).length,
        findings,
        passedProbes: all.filter((probe) => probe.pass).length,
        totalProbes: all.length,
      },
      writeObservations: journeys.map((journey) => ({
        journeyId: journey.journeyId,
        ...journey.writeObservation,
      })),
    })
  }
  return { arms, version: 1 }
}

function markdownCell(value) {
  return String(value ?? '')
    .replaceAll('\\', '\\\\')
    .replaceAll('|', '\\|')
    .replaceAll('\r\n', '<br>')
    .replaceAll('\n', '<br>')
}

export function renderLiveReportMarkdown({ checkpointEvents = [], meter, report, run } = {}) {
  const dimensions = [...new Set(
    report.arms.flatMap((arm) => Object.keys(arm.byDimension)),
  )].sort()
  const lines = [
    '# Palari Brain J3 live bake-off',
    '',
    `- Model: \`${markdownCell(run.model)}\``,
    `- Run date: \`${markdownCell(run.runDate)}\``,
    `- Bank version: \`${markdownCell(run.bankVersion)}\``,
    `- Bank SHA-256: \`${markdownCell(run.bankSha256)}\``,
    `- Prompt configuration SHA-256: \`${markdownCell(run.configSha256)}\``,
    `- Measured spend: $${Number(meter.measured.usd).toFixed(6)} / $${Number(run.capUsd).toFixed(2)}`,
    `- Conservatively accounted spend: $${Number(meter.accounted.usd).toFixed(6)}`,
    `- Provider retries: ${meter.retries.length}`,
    '',
    '| Dimension | ' + report.arms.map((arm) => markdownCell(arm.name)).join(' | ') + ' |',
    '| --- | ' + report.arms.map(() => '---:').join(' | ') + ' |',
  ]
  for (const dimension of dimensions) {
    const scores = report.arms.map((arm) => {
      const score = arm.byDimension[dimension] ?? { failed: 0, passed: 0 }
      return `${score.passed}/${score.passed + score.failed}`
    })
    lines.push(`| ${markdownCell(dimension)} | ${scores.join(' | ')} |`)
  }
  lines.push('', '## Findings')
  for (const arm of report.arms) {
    lines.push('', `### ${markdownCell(arm.name)}`)
    if (arm.summary.findings.length === 0) {
      lines.push('', '- None.')
    } else {
      for (const finding of arm.summary.findings) {
        lines.push(
          '',
          `- \`${markdownCell(`${finding.journeyId}:${finding.probeId}`)}\` — ` +
          `${finding.reasons.map(markdownCell).join('; ')}`,
        )
      }
    }
  }
  lines.push('', '## Write-count observations')
  for (const arm of report.arms) {
    lines.push('', `### ${markdownCell(arm.name)}`)
    for (const observation of arm.writeObservations) {
      lines.push(
        `- \`${markdownCell(observation.journeyId)}\`: observed ` +
        `${observation.observedTotalWritten}; scripted dry expectation ` +
        `${observation.expectedTotalWritten}`,
      )
    }
  }
  lines.push('', '## Checkpoint events')
  for (const event of checkpointEvents) {
    lines.push(`- ${markdownCell(event.timestamp)} — ${markdownCell(event.cellId)} — ${markdownCell(event.status)}`)
  }
  return `${lines.join('\n')}\n`
}

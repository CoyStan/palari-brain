// Successor-only Gemini transport for incremental LongMemEval.
//
// The historical J4 transports remain untouched. This transport makes one
// physical dispatch per logical operation and reserves the complete published
// model window at Priority prices before dispatch. A fully validated Standard
// response releases that reservation to provider-reported usage. Every other
// dispatched outcome retains the complete reservation and permanently closes
// the meter.

import { createHash } from 'node:crypto'
import {
  chmod,
  lstat,
  mkdir,
  open,
  readFile,
} from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { buildGeminiGenerateRequest } from '../src/gemini.mjs'
import {
  INCREMENTAL_LONGMEMEVAL_HARD_CAP_MODEL,
} from './arms/incremental-memory-longmemeval-live-arm.mjs'
import {
  createLiveTranscriptRecorder,
  transcriptSha256,
  verifyLiveTranscriptArtifacts,
} from './live-transcript.mjs'

export const INCREMENTAL_HARD_CAP_GEMINI_MODEL =
  INCREMENTAL_LONGMEMEVAL_HARD_CAP_MODEL

export const INCREMENTAL_HARD_CAP_GEMINI_LIMITS = Object.freeze({
  inputTokens: 1_048_576,
  outputTokens: 65_536,
})

export const INCREMENTAL_HARD_CAP_GEMINI_PRICES_USD_PER_MILLION =
  Object.freeze({
    priorityInput: 0.18,
    priorityCachedInput: 0.018,
    priorityOutput: 0.72,
    standardCachedInput: 0.01,
    standardInput: 0.10,
    standardOutput: 0.40,
  })

export const INCREMENTAL_HARD_CAP_GEMINI_PENDING_RESERVATION_USD =
  (
    INCREMENTAL_HARD_CAP_GEMINI_LIMITS.inputTokens *
      INCREMENTAL_HARD_CAP_GEMINI_PRICES_USD_PER_MILLION.priorityInput +
    INCREMENTAL_HARD_CAP_GEMINI_LIMITS.outputTokens *
      INCREMENTAL_HARD_CAP_GEMINI_PRICES_USD_PER_MILLION.priorityOutput
  ) / 1_000_000

const ENDPOINT = 'gemini-generate-content'
const BASE_PURPOSES = new Set(['answer', 'writer'])
const EXPLORATION_PURPOSE = 'explore'
const EXPLORATION_TOOL_NAMES = new Set([
  'memory_find',
  'memory_read',
  'memory_timeline',
])
const DEFAULT_REQUEST_TIMEOUT_MS = 60_000
const DEFAULT_MAX_RESPONSE_BYTES = 8 * 1024 * 1024
const JOURNAL_SCHEMA_VERSION = 1

export class IncrementalGeminiHardCapError extends Error {
  constructor(code, message, { cause } = {}) {
    super(message, cause ? { cause } : undefined)
    this.name = 'IncrementalGeminiHardCapError'
    this.code = code
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.length > 0
}

function positiveInteger(value) {
  return Number.isSafeInteger(value) && value >= 1
}

function nonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0
}

function finiteNonNegative(value) {
  return Number.isFinite(value) && value >= 0
}

function exactTwelveDecimalUsd(value) {
  return finiteNonNegative(value) &&
    value === Number(value.toFixed(12))
}

function usdPico(value) {
  return BigInt(value.toFixed(12).replace('.', ''))
}

function exactUsd(inputTokens, outputTokens, inputPrice, outputPrice) {
  return Number(((
    inputTokens * inputPrice +
    outputTokens * outputPrice
  ) / 1_000_000).toFixed(12))
}

function measuredUsd(
  inputTokens,
  outputTokens,
  cachedInputTokens = 0,
) {
  const uncachedInputTokens = inputTokens - cachedInputTokens
  const prices =
    INCREMENTAL_HARD_CAP_GEMINI_PRICES_USD_PER_MILLION
  return Number(((
    uncachedInputTokens * prices.standardInput +
    cachedInputTokens * prices.standardCachedInput +
    outputTokens * prices.standardOutput
  ) / 1_000_000).toFixed(12))
}

function assertGenerationContract(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new IncrementalGeminiHardCapError(
      'GENERATION_CONTRACT_INVALID',
      `${label} must be one generationConfig object.`,
    )
  }
  const writer = label === 'writerGeneration'
  const expectedKeys = writer
    ? [
        'candidateCount',
        'maxOutputTokens',
        'responseJsonSchema',
        'responseMimeType',
        'thinkingConfig',
      ]
    : [
        'candidateCount',
        'maxOutputTokens',
        'thinkingConfig',
      ]
  const actualKeys = Object.keys(value).sort()
  if (!positiveInteger(value.maxOutputTokens) ||
    value.maxOutputTokens >
      INCREMENTAL_HARD_CAP_GEMINI_LIMITS.outputTokens ||
    value.candidateCount !== 1 ||
    Object.hasOwn(value, 'responseFormat') ||
    Object.hasOwn(value, 'responseSchema') ||
    !sameJson(actualKeys, expectedKeys) ||
    !value.thinkingConfig ||
    typeof value.thinkingConfig !== 'object' ||
    Array.isArray(value.thinkingConfig) ||
    value.thinkingConfig.thinkingBudget !== 0 ||
    Object.keys(value.thinkingConfig).length !== 1 ||
    (writer && (
      value.responseMimeType !== 'application/json' ||
      !value.responseJsonSchema ||
      typeof value.responseJsonSchema !== 'object' ||
      Array.isArray(value.responseJsonSchema)
    )) ||
    (!writer && (
      Object.hasOwn(value, 'responseJsonSchema') ||
      Object.hasOwn(value, 'responseMimeType')
    ))) {
    throw new IncrementalGeminiHardCapError(
      'GENERATION_CONTRACT_INVALID',
      `${label} must set a valid maxOutputTokens and exactly thinkingBudget: 0.`,
    )
  }
}

function assertExplorationContract({
  explorationGeneration,
  explorationSystemInstruction,
  explorationToolConfig,
  explorationTools,
}) {
  const values = [
    explorationGeneration,
    explorationSystemInstruction,
    explorationToolConfig,
    explorationTools,
  ]
  const supplied = values.filter((value) => value !== undefined).length
  if (supplied === 0) return null
  if (supplied !== values.length) {
    throw new IncrementalGeminiHardCapError(
      'EXPLORATION_CONTRACT_INVALID',
      'Exploration requires generation, system instruction, tools, and toolConfig together.',
    )
  }
  try {
    assertGenerationContract(
      explorationGeneration,
      'explorationGeneration',
    )
  } catch (error) {
    throw new IncrementalGeminiHardCapError(
      'EXPLORATION_CONTRACT_INVALID',
      'Exploration generation is outside the frozen native tool contract.',
      { cause: error },
    )
  }
  const functionDeclarations = explorationTools?.[0]?.functionDeclarations
  const declarationNames = Array.isArray(functionDeclarations)
    ? functionDeclarations.map((declaration) => declaration?.name)
    : []
  const declarationsAreExact = declarationNames.length === 3 &&
    new Set(declarationNames).size === 3 &&
    declarationNames.every((name) => EXPLORATION_TOOL_NAMES.has(name)) &&
    functionDeclarations.every((declaration) =>
      declaration &&
      typeof declaration === 'object' &&
      !Array.isArray(declaration) &&
      sameJson(
        Object.keys(declaration).sort(),
        ['description', 'name', 'parameters'],
      ) &&
      nonEmptyString(declaration.description) &&
      nonEmptyString(declaration.name) &&
      declaration.parameters &&
      typeof declaration.parameters === 'object' &&
      !Array.isArray(declaration.parameters))
  if (!nonEmptyString(explorationSystemInstruction) ||
    !Array.isArray(explorationTools) ||
    explorationTools.length !== 1 ||
    !sameJson(
      Object.keys(explorationTools[0] ?? {}),
      ['functionDeclarations'],
    ) ||
    !declarationsAreExact ||
    !explorationToolConfig ||
    typeof explorationToolConfig !== 'object' ||
    Array.isArray(explorationToolConfig) ||
    !sameJson(
      Object.keys(explorationToolConfig),
      ['functionCallingConfig'],
    ) ||
    !explorationToolConfig.functionCallingConfig ||
    typeof explorationToolConfig.functionCallingConfig !== 'object' ||
    Array.isArray(explorationToolConfig.functionCallingConfig) ||
    !sameJson(
      Object.keys(explorationToolConfig.functionCallingConfig),
      ['mode'],
    ) ||
    explorationToolConfig.functionCallingConfig.mode !== 'AUTO') {
    throw new IncrementalGeminiHardCapError(
      'EXPLORATION_CONTRACT_INVALID',
      'Exploration must freeze the native AUTO contract and exactly three memory declarations.',
    )
  }
  return clone({
    generation: explorationGeneration,
    systemInstruction: explorationSystemInstruction,
    toolConfig: explorationToolConfig,
    tools: explorationTools,
  })
}

function assertFunctionCall(
  value,
  explorationContract,
  code = 'GEMINI_CONTENT_INVALID',
) {
  const expectedKeys = Object.hasOwn(value ?? {}, 'id')
    ? ['args', 'id', 'name']
    : ['args', 'name']
  if (!value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !sameJson(Object.keys(value).sort(), expectedKeys) ||
    (Object.hasOwn(value, 'id') && !nonEmptyString(value.id)) ||
    !EXPLORATION_TOOL_NAMES.has(value.name) ||
    !value.args ||
    typeof value.args !== 'object' ||
    Array.isArray(value.args) ||
    !explorationContract.tools[0].functionDeclarations.some(
      ({ name }) => name === value.name,
    )) {
    throw new IncrementalGeminiHardCapError(
      code,
      'Function-call content is malformed or outside the frozen memory tools.',
    )
  }
}

function assertExplorationTextPart(
  part,
  code = 'GEMINI_CONTENT_INVALID',
) {
  if (!part ||
    typeof part !== 'object' ||
    Array.isArray(part) ||
    typeof part.text !== 'string' ||
    (Object.hasOwn(part, 'thought') &&
      (typeof part.thought !== 'boolean' || part.thought)) ||
    (Object.hasOwn(part, 'thoughtSignature') &&
      !nonEmptyString(part.thoughtSignature)) ||
    (Object.hasOwn(part, 'partMetadata') &&
      (!part.partMetadata ||
        typeof part.partMetadata !== 'object' ||
        Array.isArray(part.partMetadata))) ||
    Object.keys(part).some((key) =>
      ![
        'partMetadata',
        'text',
        'thought',
        'thoughtSignature',
      ].includes(key))) {
    throw new IncrementalGeminiHardCapError(
      code,
      'Exploration content contains an unsupported model part.',
    )
  }
}

function explorationCallsFromModelContent(
  content,
  explorationContract,
  code = 'GEMINI_CONTENT_INVALID',
) {
  if (!content ||
    typeof content !== 'object' ||
    Array.isArray(content) ||
    !sameJson(Object.keys(content).sort(), ['parts', 'role']) ||
    content.role !== 'model' ||
    !Array.isArray(content.parts) ||
    content.parts.length < 1) {
    throw new IncrementalGeminiHardCapError(
      code,
      'Exploration model content is malformed or empty.',
    )
  }
  const calls = []
  for (const part of content.parts) {
    if (part &&
      typeof part === 'object' &&
      !Array.isArray(part) &&
      Object.hasOwn(part, 'functionCall')) {
      if (!sameJson(
        Object.keys(part).sort(),
        Object.hasOwn(part, 'thoughtSignature')
          ? ['functionCall', 'thoughtSignature']
          : ['functionCall'],
      ) ||
        (Object.hasOwn(part, 'thoughtSignature') &&
          !nonEmptyString(part.thoughtSignature))) {
        throw new IncrementalGeminiHardCapError(
          code,
          'Exploration contains a malformed function-call part.',
        )
      }
      assertFunctionCall(part.functionCall, explorationContract, code)
      calls.push(part.functionCall)
      continue
    }
    assertExplorationTextPart(part, code)
  }
  return calls
}

function assertFunctionResponses(userContent, functionCalls) {
  if (!sameJson(
    Object.keys(userContent ?? {}).sort(),
    ['parts', 'role'],
  ) ||
    userContent.role !== 'user' ||
    !Array.isArray(userContent.parts) ||
    userContent.parts.length !== functionCalls.length) {
    throw new IncrementalGeminiHardCapError(
      'REQUEST_SCHEMA_INVALID',
      'Each model function call requires one matching user function response.',
    )
  }
  for (let index = 0; index < functionCalls.length; index += 1) {
    const functionCall = functionCalls[index]
    const part = userContent.parts[index]
    const functionResponse = part?.functionResponse
    const expectedResponseKeys = Object.hasOwn(functionCall, 'id')
      ? ['id', 'name', 'response']
      : ['name', 'response']
    if (!part ||
      typeof part !== 'object' ||
      Array.isArray(part) ||
      !sameJson(Object.keys(part), ['functionResponse']) ||
      !functionResponse ||
      typeof functionResponse !== 'object' ||
      Array.isArray(functionResponse) ||
      !sameJson(
        Object.keys(functionResponse).sort(),
        expectedResponseKeys,
      ) ||
      functionResponse.name !== functionCall.name ||
      (Object.hasOwn(functionCall, 'id') &&
        functionResponse.id !== functionCall.id) ||
      !functionResponse.response ||
      typeof functionResponse.response !== 'object' ||
      Array.isArray(functionResponse.response)) {
      throw new IncrementalGeminiHardCapError(
        'REQUEST_SCHEMA_INVALID',
        'Function responses must match call names and optional IDs in order.',
      )
    }
  }
}

function assertExplorationRequestContents(
  contents,
  explorationContract,
) {
  if (!Array.isArray(contents) ||
    contents.length < 1 ||
    contents.length % 2 !== 1) {
    throw new IncrementalGeminiHardCapError(
      'REQUEST_SCHEMA_INVALID',
      'Exploration contents must be one initial prompt followed by complete tool pairs.',
    )
  }
  const initial = contents[0]
  const initialPart = initial?.parts?.[0]
  if (!sameJson(Object.keys(initial ?? {}).sort(), ['parts', 'role']) ||
    initial.role !== 'user' ||
    !Array.isArray(initial.parts) ||
    initial.parts.length !== 1 ||
    !sameJson(Object.keys(initialPart ?? {}), ['text']) ||
    !nonEmptyString(initialPart.text)) {
    throw new IncrementalGeminiHardCapError(
      'REQUEST_SCHEMA_INVALID',
      'Exploration must begin with exactly one user text prompt.',
    )
  }
  for (let index = 1; index < contents.length; index += 2) {
    const modelContent = contents[index]
    const userContent = contents[index + 1]
    const functionCalls = explorationCallsFromModelContent(
      modelContent,
      explorationContract,
      'REQUEST_SCHEMA_INVALID',
    )
    if (functionCalls.length === 0) {
      throw new IncrementalGeminiHardCapError(
        'REQUEST_SCHEMA_INVALID',
        'Exploration history cannot continue after final model text.',
      )
    }
    assertFunctionResponses(userContent, functionCalls)
  }
}

function assertRequestBody(
  body,
  purpose,
  {
    answerGeneration,
    explorationContract,
    writerGeneration,
  },
) {
  if (purpose === EXPLORATION_PURPOSE) {
    if (!explorationContract ||
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      !sameJson(
        Object.keys(body).sort(),
        [
          'contents',
          'generationConfig',
          'store',
          'systemInstruction',
          'toolConfig',
          'tools',
        ],
      ) ||
      body.store !== false ||
      !sameJson(body.generationConfig, explorationContract.generation) ||
      !sameJson(body.systemInstruction, {
        parts: [{ text: explorationContract.systemInstruction }],
      }) ||
      !sameJson(body.tools, explorationContract.tools) ||
      !sameJson(body.toolConfig, explorationContract.toolConfig)) {
      throw new IncrementalGeminiHardCapError(
        'REQUEST_BINDING_INVALID',
        'Exploration request does not match its frozen native tool contract.',
      )
    }
    assertExplorationRequestContents(
      body.contents,
      explorationContract,
    )
    return
  }
  const content = body?.contents?.[0]
  const contentPart = content?.parts?.[0]
  const systemInstruction = body?.systemInstruction
  const systemPart = systemInstruction?.parts?.[0]
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
    !sameJson(
      Object.keys(body).sort(),
      purpose === 'writer'
        ? [
            'contents',
            'generationConfig',
            'store',
            'systemInstruction',
          ]
        : ['contents', 'generationConfig', 'store'],
    ) ||
    !Array.isArray(body.contents) ||
    body.contents.length !== 1 ||
    !sameJson(Object.keys(content ?? {}).sort(), ['parts', 'role']) ||
    content.role !== 'user' ||
    !Array.isArray(content.parts) ||
    content.parts.length !== 1 ||
    !sameJson(Object.keys(contentPart ?? {}), ['text']) ||
    !nonEmptyString(contentPart.text) ||
    body.store !== false ||
    (purpose === 'writer' && (
      !sameJson(
        Object.keys(systemInstruction ?? {}).sort(),
        ['parts'],
      ) ||
      !Array.isArray(systemInstruction.parts) ||
      systemInstruction.parts.length !== 1 ||
      !sameJson(Object.keys(systemPart ?? {}), ['text']) ||
      !nonEmptyString(systemPart.text)
    ))) {
    throw new IncrementalGeminiHardCapError(
      'REQUEST_SCHEMA_INVALID',
      'Gemini request differs from the successor request contract.',
    )
  }
  const expectedGeneration = purpose === 'writer'
    ? writerGeneration
    : answerGeneration
  if (!sameJson(body.generationConfig, expectedGeneration) ||
    (purpose === 'writer' && !body.systemInstruction) ||
    (purpose === 'answer' &&
      Object.hasOwn(body, 'systemInstruction'))) {
    throw new IncrementalGeminiHardCapError(
      'REQUEST_BINDING_INVALID',
      'Gemini request does not match its frozen purpose and generation contract.',
    )
  }
}

function assertIdentity(
  { cellId, operationId, purpose },
  explorationEnabled,
) {
  if (!nonEmptyString(cellId) ||
    !nonEmptyString(operationId) ||
    (!BASE_PURPOSES.has(purpose) &&
      !(explorationEnabled && purpose === EXPLORATION_PURPOSE))) {
    throw new IncrementalGeminiHardCapError(
      'REQUEST_IDENTITY_INVALID',
      'Gemini request requires a cellId, operationId, and configured purpose.',
    )
  }
}

function journalEventSha(event) {
  const copy = { ...event }
  delete copy.eventSha256
  return sha256(JSON.stringify(copy))
}

async function syncDirectory(path) {
  const handle = await open(path, 'r')
  try {
    await handle.sync()
  } finally {
    await handle.close()
  }
}

async function ensurePrivateJournal(path) {
  if (!nonEmptyString(path)) {
    throw new IncrementalGeminiHardCapError(
      'JOURNAL_PATH_MISSING',
      'A hard-cap journal path is required.',
    )
  }
  const parent = dirname(path)
  await mkdir(parent, { recursive: true, mode: 0o700 })
  const parentMetadata = await lstat(parent)
  if (parentMetadata.isSymbolicLink() ||
    !parentMetadata.isDirectory()) {
    throw new IncrementalGeminiHardCapError(
      'JOURNAL_DIRECTORY_INVALID',
      'Hard-cap journal directory must be one real private directory.',
    )
  }
  await chmod(parent, 0o700)
  try {
    const handle = await open(path, 'wx', 0o600)
    await handle.sync()
    await handle.close()
    await syncDirectory(parent)
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error
  }
  const metadata = await lstat(path)
  if (!metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.nlink !== 1 ||
    (metadata.mode & 0o777) !== 0o600) {
    throw new IncrementalGeminiHardCapError(
      'JOURNAL_MODE_INVALID',
      'Hard-cap journal must be one regular mode-0600 file.',
    )
  }
}

async function appendEvent(path, priorState, rawEvent) {
  const event = {
    ...rawEvent,
    previousEventSha256: priorState.lastEventSha256,
    schemaVersion: JOURNAL_SCHEMA_VERSION,
    sequence: priorState.sequence + 1,
  }
  event.eventSha256 = journalEventSha(event)
  const handle = await open(path, 'a', 0o600)
  try {
    await handle.writeFile(`${JSON.stringify(event)}\n`, 'utf8')
    await handle.sync()
  } finally {
    await handle.close()
  }
  return event
}

function emptyUsage() {
  return {
    inputTokens: 0,
    outputTokens: 0,
    usd: 0,
  }
}

function baseState(openingAccountedUsd) {
  return {
    accounted: {
      ...emptyUsage(),
      usd: openingAccountedUsd,
    },
    attempts: 0,
    lastEventSha256: null,
    logicalRequests: {},
    measured: emptyUsage(),
    operations: new Map(),
    sequence: 0,
    terminal: false,
    uncertain: emptyUsage(),
  }
}

function addUsage(target, usage) {
  target.inputTokens += usage.inputTokens
  target.outputTokens += usage.outputTokens
  target.usd = Number((target.usd + usage.usd).toFixed(12))
}

function subtractUsage(target, usage) {
  target.inputTokens -= usage.inputTokens
  target.outputTokens -= usage.outputTokens
  target.usd = Number((target.usd - usage.usd).toFixed(12))
}

function reservationUsage() {
  return {
    inputTokens: INCREMENTAL_HARD_CAP_GEMINI_LIMITS.inputTokens,
    outputTokens: INCREMENTAL_HARD_CAP_GEMINI_LIMITS.outputTokens,
    usd: INCREMENTAL_HARD_CAP_GEMINI_PENDING_RESERVATION_USD,
  }
}

function assertReservation(value) {
  const expected = reservationUsage()
  if (!value ||
    value.inputTokens !== expected.inputTokens ||
    value.outputTokens !== expected.outputTokens ||
    value.usd !== expected.usd) {
    throw new IncrementalGeminiHardCapError(
      'JOURNAL_RESERVATION_INVALID',
      'Journal reservation differs from the documented full-window proof.',
    )
  }
}

function assertMeasuredUsage(value, usageDetails) {
  const cachedInputTokens = usageDetails?.cachedInputTokens
  const toolInputTokens = usageDetails?.toolInputTokens
  if (!value ||
    !positiveInteger(value.inputTokens) ||
    !positiveInteger(value.outputTokens) ||
    !nonNegativeInteger(cachedInputTokens) ||
    !nonNegativeInteger(toolInputTokens) ||
    cachedInputTokens > value.inputTokens ||
    toolInputTokens > value.inputTokens ||
    value.inputTokens > INCREMENTAL_HARD_CAP_GEMINI_LIMITS.inputTokens ||
    value.outputTokens > INCREMENTAL_HARD_CAP_GEMINI_LIMITS.outputTokens ||
    value.usd !== measuredUsd(
      value.inputTokens,
      value.outputTokens,
      cachedInputTokens,
    )) {
    throw new IncrementalGeminiHardCapError(
      'JOURNAL_USAGE_INVALID',
      'Journal success usage is not exact Standard-tier usage.',
    )
  }
}

async function reconcileJournal(path, {
  capUsd,
  contractSha256,
  explorationEnabled,
  openingAccountedUsd,
}) {
  const text = await readFile(path, 'utf8')
  const lines = text.split('\n').filter(Boolean)
  const state = baseState(openingAccountedUsd)
  const attempts = new Map()
  for (let index = 0; index < lines.length; index += 1) {
    let event
    try {
      event = JSON.parse(lines[index])
    } catch (error) {
      throw new IncrementalGeminiHardCapError(
        'JOURNAL_JSON_INVALID',
        'Hard-cap journal contains malformed JSON.',
        { cause: error },
      )
    }
    if (event.schemaVersion !== JOURNAL_SCHEMA_VERSION ||
      event.sequence !== index + 1 ||
      event.previousEventSha256 !== state.lastEventSha256 ||
      event.eventSha256 !== journalEventSha(event) ||
      event.capUsd !== capUsd ||
      event.openingAccountedUsd !== openingAccountedUsd ||
      event.contractSha256 !== contractSha256 ||
      event.model !== INCREMENTAL_HARD_CAP_GEMINI_MODEL ||
      !nonEmptyString(event.attemptId) ||
      !nonEmptyString(event.operationId)) {
      throw new IncrementalGeminiHardCapError(
        'JOURNAL_COHERENCE_INVALID',
        'Hard-cap journal identity or hash chain is invalid.',
      )
    }
    state.sequence = event.sequence
    state.lastEventSha256 = event.eventSha256

    if (event.type === 'attempt_started') {
      if (attempts.has(event.attemptId) ||
        state.operations.has(event.operationId) ||
        event.attempt !== 1 ||
        (!BASE_PURPOSES.has(event.purpose) &&
          !(explorationEnabled &&
            event.purpose === EXPLORATION_PURPOSE))) {
        throw new IncrementalGeminiHardCapError(
          'JOURNAL_START_INVALID',
          'Hard-cap journal contains a duplicate or invalid start.',
        )
      }
      assertReservation(event.reservation)
      attempts.set(event.attemptId, { event, terminal: null })
      state.operations.set(event.operationId, event.attemptId)
      state.attempts += 1
      state.logicalRequests[event.purpose] =
        (state.logicalRequests[event.purpose] ?? 0) + 1
      addUsage(state.accounted, event.reservation)
      addUsage(state.uncertain, event.reservation)
      continue
    }

    if (event.type !== 'attempt_terminal') {
      throw new IncrementalGeminiHardCapError(
        'JOURNAL_EVENT_INVALID',
        'Hard-cap journal contains an unsupported event.',
      )
    }
    const attempt = attempts.get(event.attemptId)
    if (!attempt ||
      attempt.terminal ||
      attempt.event.operationId !== event.operationId ||
      attempt.event.requestSha256 !== event.requestSha256) {
      throw new IncrementalGeminiHardCapError(
        'JOURNAL_TERMINAL_INVALID',
        'Hard-cap journal terminal does not match one start.',
      )
    }
    attempt.terminal = event
    if (event.outcome === 'success') {
      const toolInputTokens =
        event.usageDetails?.toolInputTokens
      if (event.usageDetails?.serviceTier !== 'standard' ||
        event.usageDetails?.serviceTierHeader !== 'standard' ||
        event.usageDetails?.thoughtTokens !== 0 ||
        !nonNegativeInteger(toolInputTokens) ||
        (attempt.event.purpose !== EXPLORATION_PURPOSE &&
          toolInputTokens !== 0)) {
        throw new IncrementalGeminiHardCapError(
          'JOURNAL_USAGE_DETAILS_INVALID',
          'Journal success lacks the frozen Standard/no-thinking/tool evidence.',
        )
      }
      assertMeasuredUsage(event.usage, event.usageDetails)
      subtractUsage(state.accounted, attempt.event.reservation)
      subtractUsage(state.uncertain, attempt.event.reservation)
      addUsage(state.accounted, event.usage)
      addUsage(state.measured, event.usage)
    } else {
      state.terminal = true
    }
  }
  if ([...attempts.values()].some((attempt) => !attempt.terminal)) {
    state.terminal = true
  }
  if (usdPico(state.accounted.usd) > usdPico(capUsd)) {
    throw new IncrementalGeminiHardCapError(
      'JOURNAL_CAP_EXCEEDED',
      'Hard-cap journal accounts more than its cumulative cap.',
    )
  }
  return state
}

function visibleText(candidate) {
  const parts = candidate?.content?.parts
  if (!Array.isArray(parts) || parts.length < 1) {
    throw new IncrementalGeminiHardCapError(
      'GEMINI_CONTENT_INVALID',
      'Gemini returned no content parts.',
    )
  }
  for (const part of parts) {
    if (!part || typeof part !== 'object' ||
      typeof part.text !== 'string' ||
      (Object.hasOwn(part, 'thought') &&
        typeof part.thought !== 'boolean') ||
      (Object.hasOwn(part, 'thoughtSignature') &&
        typeof part.thoughtSignature !== 'string') ||
      (Object.hasOwn(part, 'partMetadata') &&
        (!part.partMetadata ||
          typeof part.partMetadata !== 'object' ||
          Array.isArray(part.partMetadata))) ||
      Object.keys(part).some((key) =>
        ![
          'partMetadata',
          'text',
          'thought',
          'thoughtSignature',
        ].includes(key))) {
      throw new IncrementalGeminiHardCapError(
        'GEMINI_CONTENT_INVALID',
        'Gemini returned unsupported content.',
      )
    }
  }
  const text = parts
    .filter((part) => part.thought !== true)
    .map((part) => part.text)
    .join('')
    .trim()
  if (!text) {
    throw new IncrementalGeminiHardCapError(
      'GEMINI_CONTENT_EMPTY',
      'Gemini returned no visible completion.',
    )
  }
  return text
}

function explorationCompletion(candidate, explorationContract) {
  const content = candidate?.content
  const functionCalls = explorationCallsFromModelContent(
    content,
    explorationContract,
  )
  if (functionCalls.length > 0) {
    return {
      candidateContent: clone(content),
      functionCalls: clone(functionCalls),
      responseType: 'function_calls',
      text: null,
    }
  }
  return {
    candidateContent: clone(content),
    functionCalls: [],
    responseType: 'final_text',
    text: visibleText(candidate),
  }
}

function parseSuccess(
  rawBody,
  configuredOutputTokens,
  responseHeaders,
  { explorationContract, purpose } = {},
) {
  let parsed
  try {
    parsed = JSON.parse(rawBody)
  } catch (error) {
    throw new IncrementalGeminiHardCapError(
      'GEMINI_JSON_INVALID',
      'Gemini returned malformed JSON.',
      { cause: error },
    )
  }
  if (parsed?.modelVersion !== INCREMENTAL_HARD_CAP_GEMINI_MODEL) {
    throw new IncrementalGeminiHardCapError(
      'GEMINI_MODEL_MISMATCH',
      'Gemini returned a model other than the frozen successor model.',
    )
  }
  if (parsed?.usageMetadata?.serviceTier !== 'standard') {
    throw new IncrementalGeminiHardCapError(
      'GEMINI_SERVICE_TIER_MISMATCH',
      'Gemini did not confirm Standard service tier.',
    )
  }
  const serviceTierHeader =
    responseHeaders?.get?.('x-gemini-service-tier') ?? null
  if (serviceTierHeader !== 'standard') {
    throw new IncrementalGeminiHardCapError(
      'GEMINI_SERVICE_TIER_MISMATCH',
      'Gemini response headers did not confirm Standard service tier.',
    )
  }
  if (parsed?.promptFeedback?.blockReason) {
    throw new IncrementalGeminiHardCapError(
      'GEMINI_PROMPT_BLOCKED',
      'Gemini blocked the request.',
    )
  }
  if (!Array.isArray(parsed?.candidates) ||
    parsed.candidates.length !== 1) {
    throw new IncrementalGeminiHardCapError(
      'GEMINI_CANDIDATE_COUNT',
      'Gemini must return exactly one candidate.',
    )
  }
  const candidate = parsed.candidates[0]
  if (candidate.finishReason !== 'STOP') {
    throw new IncrementalGeminiHardCapError(
      candidate.finishReason === 'MAX_TOKENS'
        ? 'GEMINI_TRUNCATED'
        : 'GEMINI_FINISH_REASON',
      'Gemini completion did not end with STOP.',
    )
  }
  const completion = purpose === EXPLORATION_PURPOSE
    ? explorationCompletion(candidate, explorationContract)
    : { text: visibleText(candidate) }
  const rawUsage = parsed.usageMetadata
  const promptInputTokens = rawUsage?.promptTokenCount
  const candidateTokens = rawUsage?.candidatesTokenCount
  const thoughtTokens = rawUsage?.thoughtsTokenCount ?? 0
  const cachedTokens = rawUsage?.cachedContentTokenCount ?? 0
  const toolTokens = rawUsage?.toolUsePromptTokenCount ?? 0
  const inputTokens = promptInputTokens
  const totalTokens = rawUsage?.totalTokenCount
  if (!positiveInteger(promptInputTokens) ||
    !positiveInteger(candidateTokens) ||
    !nonNegativeInteger(thoughtTokens) ||
    thoughtTokens !== 0 ||
    !nonNegativeInteger(cachedTokens) ||
    cachedTokens > promptInputTokens ||
    !nonNegativeInteger(toolTokens) ||
    toolTokens > promptInputTokens ||
    (purpose !== EXPLORATION_PURPOSE && toolTokens !== 0) ||
    !positiveInteger(totalTokens) ||
    totalTokens !==
      promptInputTokens + candidateTokens ||
    inputTokens > INCREMENTAL_HARD_CAP_GEMINI_LIMITS.inputTokens ||
    candidateTokens > configuredOutputTokens ||
    candidateTokens > INCREMENTAL_HARD_CAP_GEMINI_LIMITS.outputTokens) {
    throw new IncrementalGeminiHardCapError(
      'GEMINI_USAGE_INVALID',
      'Gemini usage is missing, non-Standard, or outside frozen limits.',
    )
  }
  const usage = {
    inputTokens,
    outputTokens: candidateTokens,
    usd: measuredUsd(inputTokens, candidateTokens, cachedTokens),
  }
  return {
    finishReason: candidate.finishReason,
    modelVersion: parsed.modelVersion,
    rawUsage,
    ...completion,
    usage,
    usageDetails: {
      cachedInputTokens: cachedTokens,
      candidateTokens,
      serviceTier: rawUsage.serviceTier,
      serviceTierHeader,
      thoughtTokens,
      toolInputTokens: toolTokens,
    },
  }
}

async function verifySuccessAccountingAgainstTranscripts({
  answerGeneration,
  explorationContract,
  journalPath,
  transcriptDirectory,
  writerGeneration,
}) {
  const journalText = await readFile(journalPath, 'utf8')
  const events = journalText
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
  const starts = new Map(events
    .filter(({ type }) => type === 'attempt_started')
    .map((event) => [event.attemptId, event]))
  for (const terminal of events.filter((event) =>
    event.type === 'attempt_terminal')) {
    try {
      const start = starts.get(terminal.attemptId)
      if (!start) throw new Error('terminal start missing')
      const path = join(transcriptDirectory, start.transcriptFile)
      const transcript = JSON.parse(await readFile(path, 'utf8'))
      const normalizedBody = transcript?.request?.normalizedBody
      if (typeof normalizedBody !== 'string' ||
        transcriptSha256(normalizedBody) !== start.requestSha256 ||
        transcript.request.model !==
          INCREMENTAL_HARD_CAP_GEMINI_MODEL) {
        throw new Error('request transcript mismatch')
      }
      const body = JSON.parse(normalizedBody)
      assertRequestBody(body, start.purpose, {
        answerGeneration,
        explorationContract,
        writerGeneration,
      })
      if (start.maxConfiguredOutputTokens !==
          body.generationConfig.maxOutputTokens ||
        !sameJson(
          transcript.request.settings,
          body.generationConfig,
        )) {
        throw new Error('generation transcript mismatch')
      }
      const recordedResponse = transcript?.terminal?.response
      const rawBody = recordedResponse?.rawBody ?? null
      const status = recordedResponse?.status ?? null
      if (transcript?.terminal?.outcome !== terminal.outcome ||
        terminal.status !== status ||
        terminal.transcriptFile !== start.transcriptFile ||
        terminal.requestSha256 !== start.requestSha256) {
        throw new Error('terminal transcript mismatch')
      }
      if (recordedResponse !== null &&
        recordedResponse !== undefined) {
        const bodyAvailable = typeof rawBody === 'string'
        if (recordedResponse.bodyAvailable !== bodyAvailable ||
          (bodyAvailable && (
            recordedResponse.bodyBytes !==
              Buffer.byteLength(rawBody) ||
            recordedResponse.bodySha256 !== sha256(rawBody)
          )) ||
          (!bodyAvailable && (
            recordedResponse.bodyBytes !== null ||
            recordedResponse.bodySha256 !== null
          ))) {
          throw new Error('response transcript mismatch')
        }
      }
      const responseHeaders = {
        get(name) {
          return recordedResponse?.headers?.[
            String(name).toLowerCase()
          ] ?? null
        },
      }
      if (terminal.outcome === 'success') {
        const parsed = parseSuccess(
          rawBody,
          body.generationConfig.maxOutputTokens,
          responseHeaders,
          {
            explorationContract,
            purpose: start.purpose,
          },
        )
        if (status !== 200 ||
          transcript.terminal.transportError !== null ||
          recordedResponse.finishReason !== parsed.finishReason ||
          !sameJson(recordedResponse.usage, parsed.rawUsage) ||
          terminal.modelVersion !== parsed.modelVersion ||
          !sameJson(terminal.usage, parsed.usage) ||
          !sameJson(terminal.usageDetails, parsed.usageDetails) ||
          Object.hasOwn(terminal, 'error')) {
          throw new Error('success accounting mismatch')
        }
        continue
      }
      if (![
        'http_error',
        'invalid_response',
        'transport_error',
      ].includes(terminal.outcome) ||
        terminal.usage !== null) {
        throw new Error('unsupported failure outcome')
      }
      let expectedError
      if (terminal.outcome === 'transport_error') {
        if (typeof rawBody === 'string' ||
          transcript.terminal.transportError === null) {
          throw new Error('transport failure transcript mismatch')
        }
        expectedError = {
          code: transcript.terminal.transportError.code,
          message: transcript.terminal.transportError.message,
        }
      } else if (terminal.outcome === 'http_error') {
        if (!Number.isSafeInteger(status) ||
          status === 200 ||
          typeof rawBody !== 'string' ||
          transcript.terminal.transportError !== null) {
          throw new Error('HTTP failure transcript mismatch')
        }
        expectedError = {
          code: `GEMINI_HTTP_${status}`,
          message: `Gemini returned HTTP ${status}.`,
        }
      } else if (status !== 200) {
        throw new Error('invalid-response status mismatch')
      } else if (typeof rawBody !== 'string') {
        if (transcript.terminal.transportError === null) {
          throw new Error('body failure lacks transport error')
        }
        expectedError = {
          code: transcript.terminal.transportError.code,
          message: transcript.terminal.transportError.message,
        }
      } else {
        if (transcript.terminal.transportError !== null) {
          throw new Error('parsed failure has transport error')
        }
        try {
          parseSuccess(
            rawBody,
            body.generationConfig.maxOutputTokens,
            responseHeaders,
            {
              explorationContract,
              purpose: start.purpose,
            },
          )
        } catch (error) {
          expectedError = safeError(
            error,
            '__PALARI_REPLAY_HAS_NO_CREDENTIAL__',
          )
        }
        if (!expectedError) {
          throw new Error(
            'failure transcript contains a valid success response',
          )
        }
      }
      let rawUsageServiceTier = null
      if (typeof rawBody === 'string') {
        try {
          rawUsageServiceTier =
            JSON.parse(rawBody)?.usageMetadata?.serviceTier ?? null
        } catch {
          // Malformed failure bodies have no replayable usage tier.
        }
      }
      if (!sameJson(terminal.error, expectedError) ||
        terminal.observedServiceTierHeader !==
          responseHeaders.get('x-gemini-service-tier') ||
        terminal.observedUsageServiceTier !== rawUsageServiceTier) {
        throw new Error('failure accounting mismatch')
      }
    } catch (cause) {
      throw new IncrementalGeminiHardCapError(
        'EVIDENCE_REPLAY_MISMATCH',
        'Provider accounting does not replay from its exact transcript.',
        { cause },
      )
    }
  }
}

function safeError(error, secret) {
  const clean = (value) => String(value ?? '')
    .replaceAll(secret, '[REDACTED_SECRET]')
    .replace(/\bAIza[A-Za-z0-9_-]{12,}\b/g, '[REDACTED_SECRET]')
    .slice(0, 240)
  return {
    code: clean(error?.code ?? error?.name ?? 'PROVIDER_FAILURE'),
    message: clean(error?.message ?? 'Provider failure.'),
  }
}

async function responseText(
  response,
  maximumBytes,
  { abortController } = {},
) {
  const reader = response?.body?.getReader?.()
  if (!reader) {
    throw new IncrementalGeminiHardCapError(
      'GEMINI_RESPONSE_STREAM_INVALID',
      'Gemini response body is not one readable byte stream.',
    )
  }
  const chunks = []
  let totalBytes = 0
  const cancelReader = () => {
    void reader.cancel().catch(() => {})
  }
  abortController?.signal?.addEventListener(
    'abort',
    cancelReader,
    { once: true },
  )
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!(value instanceof Uint8Array)) {
        throw new IncrementalGeminiHardCapError(
          'GEMINI_RESPONSE_STREAM_INVALID',
          'Gemini response emitted a non-byte chunk.',
        )
      }
      if (value.byteLength > maximumBytes - totalBytes) {
        abortController?.abort()
        throw new IncrementalGeminiHardCapError(
          'GEMINI_RESPONSE_TOO_LARGE',
          'Gemini response exceeds the private transcript byte ceiling.',
        )
      }
      totalBytes += value.byteLength
      chunks.push(Buffer.from(
        value.buffer,
        value.byteOffset,
        value.byteLength,
      ))
    }
  } finally {
    abortController?.signal?.removeEventListener(
      'abort',
      cancelReader,
    )
    reader.releaseLock()
  }
  return Buffer.concat(chunks, totalBytes).toString('utf8')
}

function timestamp(now) {
  const value = String(now())
  if (!value || Number.isNaN(Date.parse(value))) {
    throw new IncrementalGeminiHardCapError(
      'CLOCK_INVALID',
      'Hard-cap clock must return an ISO-compatible timestamp.',
    )
  }
  return value
}

function publicSnapshot(state) {
  return clone({
    accounted: state.accounted,
    attempts: state.attempts,
    logicalRequests: state.logicalRequests,
    measured: state.measured,
    sequence: state.sequence,
    terminal: state.terminal,
    uncertain: state.uncertain,
  })
}

export async function createIncrementalLongMemEvalHardCapGeminiTransport({
  answerGeneration,
  capUsd,
  explorationGeneration,
  explorationSystemInstruction,
  explorationToolConfig,
  explorationTools,
  fetchImpl = globalThis.fetch,
  geminiApiKey,
  journalPath,
  maxResponseBytes = DEFAULT_MAX_RESPONSE_BYTES,
  model = INCREMENTAL_HARD_CAP_GEMINI_MODEL,
  now = () => new Date().toISOString(),
  openingAccountedUsd = 0,
  requireNetworkGuard = false,
  requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  transcriptDirectory,
  writerGeneration,
} = {}) {
  if (model !== INCREMENTAL_HARD_CAP_GEMINI_MODEL) {
    throw new IncrementalGeminiHardCapError(
      'MODEL_FIXED',
      'The successor transport permits only gemini-2.5-flash-lite.',
    )
  }
  if (typeof fetchImpl !== 'function') {
    throw new IncrementalGeminiHardCapError(
      'FETCH_MISSING',
      'The successor transport requires fetch.',
    )
  }
  if (!nonEmptyString(geminiApiKey)) {
    throw new IncrementalGeminiHardCapError(
      'CREDENTIAL_MISSING',
      'The successor transport requires a Gemini API key.',
    )
  }
  if (!Number.isFinite(capUsd) ||
    capUsd <= 0 ||
    !exactTwelveDecimalUsd(capUsd) ||
    !exactTwelveDecimalUsd(openingAccountedUsd) ||
    openingAccountedUsd > capUsd) {
    throw new IncrementalGeminiHardCapError(
      'CAP_INVALID',
      'The cumulative cap and opening spend are invalid.',
    )
  }
  if (!positiveInteger(requestTimeoutMs) ||
    !positiveInteger(maxResponseBytes) ||
    maxResponseBytes > DEFAULT_MAX_RESPONSE_BYTES ||
    typeof requireNetworkGuard !== 'boolean' ||
    !nonEmptyString(transcriptDirectory) ||
    typeof now !== 'function') {
    throw new IncrementalGeminiHardCapError(
      'TRANSPORT_CONFIGURATION_INVALID',
      'The successor transport has invalid timeout, transcript, or clock configuration.',
    )
  }
  assertGenerationContract(answerGeneration, 'answerGeneration')
  assertGenerationContract(writerGeneration, 'writerGeneration')
  const frozenExplorationContract = assertExplorationContract({
    explorationGeneration,
    explorationSystemInstruction,
    explorationToolConfig,
    explorationTools,
  })
  const frozenAnswerGeneration = clone(answerGeneration)
  const frozenWriterGeneration = clone(writerGeneration)
  const contractShape = {
    answerGeneration: frozenAnswerGeneration,
    limits: INCREMENTAL_HARD_CAP_GEMINI_LIMITS,
    model,
    pendingReservationUsd:
      INCREMENTAL_HARD_CAP_GEMINI_PENDING_RESERVATION_USD,
    pricesUsdPerMillion:
      INCREMENTAL_HARD_CAP_GEMINI_PRICES_USD_PER_MILLION,
    requireNetworkGuard,
    writerGeneration: frozenWriterGeneration,
  }
  if (frozenExplorationContract) {
    contractShape.exploration = frozenExplorationContract
  }
  const contractSha256 = sha256(JSON.stringify(contractShape))

  await ensurePrivateJournal(journalPath)
  await mkdir(transcriptDirectory, { recursive: true, mode: 0o700 })
  const transcriptDirectoryMetadata = await lstat(transcriptDirectory)
  if (!transcriptDirectoryMetadata.isDirectory() ||
    transcriptDirectoryMetadata.isSymbolicLink()) {
    throw new IncrementalGeminiHardCapError(
      'TRANSCRIPT_DIRECTORY_INVALID',
      'Transcript destination must be one real private directory.',
    )
  }
  await chmod(transcriptDirectory, 0o700)
  const recorder = await createLiveTranscriptRecorder({
    directory: transcriptDirectory,
    forbiddenSecrets: [geminiApiKey],
    now,
  })
  let state = await reconcileJournal(journalPath, {
    capUsd,
    contractSha256,
    explorationEnabled: frozenExplorationContract !== null,
    openingAccountedUsd,
  })
  if (state.attempts > 0 && !state.terminal) {
    await verifyLiveTranscriptArtifacts({
      directory: transcriptDirectory,
      journalPath,
    })
    await verifySuccessAccountingAgainstTranscripts({
      answerGeneration: frozenAnswerGeneration,
      explorationContract: frozenExplorationContract,
      journalPath,
      transcriptDirectory,
      writerGeneration: frozenWriterGeneration,
    })
  }
  let fatal = state.terminal
  let queue = Promise.resolve()
  const originalGlobalFetch = globalThis.fetch
  let guardInstalled = false

  const runExclusive = (action) => {
    const next = queue.then(action, action)
    queue = next.catch(() => {})
    return next
  }

  async function recordTerminalFailure({
    error,
    operationId,
    rawBody,
    requestSha256,
    response,
    transcript,
  }) {
    fatal = true
    const outcome = rawBody === null
      ? 'transport_error'
      : response.status === 200
        ? 'invalid_response'
        : 'http_error'
    let terminalTranscript
    try {
      terminalTranscript = await transcript.finish({
        outcome,
        rawBody,
        responseHeaders: response?.headers,
        status: response?.status ?? null,
        transportError: rawBody === null ? error : null,
        usage: rawBody === null
          ? undefined
          : (() => {
              try {
                return JSON.parse(rawBody)?.usageMetadata ?? null
              } catch {
                return null
              }
            })(),
      })
      state = await reconcileJournal(journalPath, {
        capUsd,
        contractSha256,
        explorationEnabled: frozenExplorationContract !== null,
        openingAccountedUsd,
      })
      await appendEvent(journalPath, state, {
        attemptId: transcript.attemptId,
        capUsd,
        contractSha256,
        error: safeError(error, geminiApiKey),
        model,
        openingAccountedUsd,
        observedServiceTierHeader:
          response?.headers?.get?.('x-gemini-service-tier') ?? null,
        observedUsageServiceTier: rawBody === null
          ? null
          : (() => {
              try {
                return JSON.parse(rawBody)?.usageMetadata?.serviceTier ??
                  null
              } catch {
                return null
              }
            })(),
        operationId,
        outcome,
        requestSha256,
        status: response?.status ?? null,
        timestamp: timestamp(now),
        transcriptFile: terminalTranscript.transcriptFile,
        transcriptSha256: terminalTranscript.transcriptSha256,
        type: 'attempt_terminal',
        usage: null,
      })
      state = await reconcileJournal(journalPath, {
        capUsd,
        contractSha256,
        explorationEnabled: frozenExplorationContract !== null,
        openingAccountedUsd,
      })
    } catch (evidenceError) {
      throw new IncrementalGeminiHardCapError(
        'TERMINAL_EVIDENCE_WRITE_FAILED',
        'Provider failed and terminal evidence could not be completed; the full reservation remains.',
        { cause: evidenceError },
      )
    }
  }

  async function callGemini({ body, cellId, operationId, purpose } = {}) {
    if (fatal) {
      throw new IncrementalGeminiHardCapError(
        'METER_TERMINAL',
        'The successor meter is terminal after a dispatched uncertainty.',
      )
    }
    if (requireNetworkGuard && !guardInstalled) {
      throw new IncrementalGeminiHardCapError(
        'NETWORK_GUARD_REQUIRED',
        'The designated successor runtime requires its network guard before dispatch.',
      )
    }
    assertIdentity(
      { cellId, operationId, purpose },
      frozenExplorationContract !== null,
    )
    assertRequestBody(body, purpose, {
      answerGeneration: frozenAnswerGeneration,
      explorationContract: frozenExplorationContract,
      writerGeneration: frozenWriterGeneration,
    })
    state = await reconcileJournal(journalPath, {
      capUsd,
      contractSha256,
      explorationEnabled: frozenExplorationContract !== null,
      openingAccountedUsd,
    })
    if (state.terminal) {
      fatal = true
      throw new IncrementalGeminiHardCapError(
        'METER_TERMINAL',
        'The successor journal contains a dispatched uncertainty.',
      )
    }
    if (state.operations.has(operationId)) {
      throw new IncrementalGeminiHardCapError(
        'OPERATION_ALREADY_DISPATCHED',
        'A successor operation can never be dispatched twice.',
      )
    }
    const reservation = reservationUsage()
    if (usdPico(state.accounted.usd) +
        usdPico(reservation.usd) >
        usdPico(capUsd)) {
      throw new IncrementalGeminiHardCapError(
        'CAP_REFUSED',
        'The complete documented model-window reservation would exceed the cumulative cap.',
      )
    }
    await verifyLiveTranscriptArtifacts({
      directory: transcriptDirectory,
      journalPath,
    })
    await verifySuccessAccountingAgainstTranscripts({
      answerGeneration: frozenAnswerGeneration,
      explorationContract: frozenExplorationContract,
      journalPath,
      transcriptDirectory,
      writerGeneration: frozenWriterGeneration,
    })

    const normalizedBody = JSON.stringify(body)
    const requestSha256 = transcriptSha256(normalizedBody)
    const request = buildGeminiGenerateRequest({
      apiKey: geminiApiKey,
      body,
      model,
    })
    const expectedUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
    if (request.url !== expectedUrl ||
      request.init.body !== normalizedBody ||
      request.init.headers['x-goog-api-key'] !== geminiApiKey ||
      Object.keys(request.init.headers).sort().join(',') !==
        'content-type,x-goog-api-key') {
      throw new IncrementalGeminiHardCapError(
        'AUTH_OR_MODEL_BINDING_INVALID',
        'Gemini request is not bound to the fixed key-free endpoint and header path.',
      )
    }

    const attemptId = `${operationId}:attempt:1`
    const transcriptHandle = await recorder.beginAttempt({
      attempt: 1,
      attemptId,
      cellId,
      endpoint: ENDPOINT,
      metadata: {
        contractSha256,
        pendingReservationUsd: reservation.usd,
        serviceTierRequested: 'default-standard',
      },
      model,
      normalizedRequestBody: normalizedBody,
      operationId,
      purpose,
      requestBytes: Buffer.byteLength(normalizedBody),
      settings: clone(body.generationConfig),
      startedAt: timestamp(now),
    })
    transcriptHandle.attemptId = attemptId
    await appendEvent(journalPath, state, {
      attempt: 1,
      attemptId,
      capUsd,
      cellId,
      contractSha256,
      endpoint: ENDPOINT,
      maxConfiguredOutputTokens:
        body.generationConfig.maxOutputTokens,
      model,
      openingAccountedUsd,
      operationId,
      purpose,
      requestSha256,
      reservation,
      timestamp: timestamp(now),
      transcriptFile: transcriptHandle.transcriptFile,
      transcriptStartedSha256: transcriptHandle.transcriptSha256,
      type: 'attempt_started',
    })
    state = await reconcileJournal(journalPath, {
      capUsd,
      contractSha256,
      explorationEnabled: frozenExplorationContract !== null,
      openingAccountedUsd,
    })

    let response = null
    let rawBody = null
    let parsed
    const controller = new AbortController()
    let timeout
    let timedOut = false
    try {
      const timeoutFailure = new Promise((_, reject) => {
        timeout = setTimeout(() => {
          timedOut = true
          controller.abort()
          reject(new IncrementalGeminiHardCapError(
            'GEMINI_TIMEOUT',
            'Gemini did not finish before the frozen timeout.',
          ))
        }, requestTimeoutMs)
      })
      const responseAndBody = (async () => {
        const receivedResponse = await fetchImpl(request.url, {
          ...request.init,
          redirect: 'error',
          signal: controller.signal,
        })
        response = receivedResponse
        const receivedRawBody = await responseText(
          receivedResponse,
          maxResponseBytes,
          { abortController: controller },
        )
        return {
          rawBody: receivedRawBody,
          response: receivedResponse,
        }
      })()
      const completed = await Promise.race([
        responseAndBody,
        timeoutFailure,
      ])
      response = completed.response
      rawBody = completed.rawBody
      if (response.status !== 200) {
        throw new IncrementalGeminiHardCapError(
          `GEMINI_HTTP_${response.status}`,
          `Gemini returned HTTP ${response.status}.`,
        )
      }
      parsed = parseSuccess(
        rawBody,
        body.generationConfig.maxOutputTokens,
        response.headers,
        {
          explorationContract: frozenExplorationContract,
          purpose,
        },
      )
    } catch (error) {
      clearTimeout(timeout)
      if (timedOut) rawBody = null
      await recordTerminalFailure({
        error,
        operationId,
        rawBody,
        requestSha256,
        response,
        transcript: transcriptHandle,
      })
      throw error
    } finally {
      clearTimeout(timeout)
    }

    let terminalTranscript
    try {
      terminalTranscript = await transcriptHandle.finish({
        finishReason: parsed.finishReason,
        outcome: 'success',
        rawBody,
        responseHeaders: response.headers,
        status: response.status,
        usage: parsed.rawUsage,
      })
      state = await reconcileJournal(journalPath, {
        capUsd,
        contractSha256,
        explorationEnabled: frozenExplorationContract !== null,
        openingAccountedUsd,
      })
      await appendEvent(journalPath, state, {
        attemptId,
        capUsd,
        contractSha256,
        model,
        modelVersion: parsed.modelVersion,
        openingAccountedUsd,
        operationId,
        outcome: 'success',
        requestSha256,
        status: response.status,
        timestamp: timestamp(now),
        transcriptFile: terminalTranscript.transcriptFile,
        transcriptSha256: terminalTranscript.transcriptSha256,
        type: 'attempt_terminal',
        usage: parsed.usage,
        usageDetails: parsed.usageDetails,
      })
      state = await reconcileJournal(journalPath, {
        capUsd,
        contractSha256,
        explorationEnabled: frozenExplorationContract !== null,
        openingAccountedUsd,
      })
    } catch (error) {
      fatal = true
      throw new IncrementalGeminiHardCapError(
        'SUCCESS_EVIDENCE_WRITE_FAILED',
        'Validated provider response could not be durably reconciled; the full reservation remains.',
        { cause: error },
      )
    }
    const result = {
      finishReason: parsed.finishReason,
      modelVersion: parsed.modelVersion,
      text: parsed.text,
      usage: {
        geminiInputTokens: parsed.usage.inputTokens,
        geminiOutputTokens: parsed.usage.outputTokens,
        judgeInputTokens: 0,
        judgeOutputTokens: 0,
        usd: parsed.usage.usd,
      },
      usageDetails: clone(parsed.usageDetails),
      validated: true,
    }
    if (purpose === EXPLORATION_PURPOSE) {
      result.candidateContent = clone(parsed.candidateContent)
      result.functionCalls = clone(parsed.functionCalls)
      result.responseType = parsed.responseType
    }
    return result
  }

  return Object.freeze({
    callGemini(options) {
      return runExclusive(() => callGemini(options))
    },

    contractSha256,

    closeNetworkGuard() {
      if (!guardInstalled) return
      globalThis.fetch = originalGlobalFetch
      guardInstalled = false
    },

    installNetworkGuard() {
      if (guardInstalled) {
        throw new IncrementalGeminiHardCapError(
          'NETWORK_GUARD_INSTALLED',
          'The successor network guard is already installed.',
        )
      }
      globalThis.fetch = async (input, init) => {
        let url
        try {
          url = new URL(
            typeof input === 'string' || input instanceof URL
              ? input
              : input?.url,
          )
        } catch (error) {
          throw new IncrementalGeminiHardCapError(
            'UNMETERED_NETWORK_BLOCKED',
            'The successor blocks an unparseable unmetered request.',
            { cause: error },
          )
        }
        if (![
          '127.0.0.1',
          '::1',
          '[::1]',
          'localhost',
        ].includes(url.hostname)) {
          throw new IncrementalGeminiHardCapError(
            'UNMETERED_NETWORK_BLOCKED',
            'The successor blocks ordinary non-loopback networking after key capture.',
          )
        }
        return originalGlobalFetch(input, init)
      }
      guardInstalled = true
    },

    async snapshot() {
      await queue
      state = await reconcileJournal(journalPath, {
        capUsd,
        contractSha256,
        explorationEnabled: frozenExplorationContract !== null,
        openingAccountedUsd,
      })
      return publicSnapshot(state)
    },

    async verify() {
      await queue
      const [journalMetadata, transcriptMetadata] =
        await Promise.all([
          lstat(journalPath),
          lstat(transcriptDirectory),
        ])
      if (!journalMetadata.isFile() ||
        journalMetadata.isSymbolicLink() ||
        journalMetadata.nlink !== 1 ||
        (journalMetadata.mode & 0o777) !== 0o600 ||
        !transcriptMetadata.isDirectory() ||
        transcriptMetadata.isSymbolicLink() ||
        (transcriptMetadata.mode & 0o777) !== 0o700) {
        throw new IncrementalGeminiHardCapError(
          'EVIDENCE_MODE_OR_SET_INVALID',
          'Hard-cap evidence permissions, links, or transcript set are invalid.',
        )
      }
      state = await reconcileJournal(journalPath, {
        capUsd,
        contractSha256,
        explorationEnabled: frozenExplorationContract !== null,
        openingAccountedUsd,
      })
      const transcripts = await verifyLiveTranscriptArtifacts({
        directory: transcriptDirectory,
        journalPath,
      })
      if (transcripts.attempts !== state.attempts) {
        throw new IncrementalGeminiHardCapError(
          'EVIDENCE_MODE_OR_SET_INVALID',
          'Hard-cap evidence permissions, links, or transcript set are invalid.',
        )
      }
      await verifySuccessAccountingAgainstTranscripts({
        answerGeneration: frozenAnswerGeneration,
        explorationContract: frozenExplorationContract,
        journalPath,
        transcriptDirectory,
        writerGeneration: frozenWriterGeneration,
      })
      return {
        contractSha256,
        meter: publicSnapshot(state),
        transcripts,
      }
    },
  })
}

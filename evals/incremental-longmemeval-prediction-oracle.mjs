// Offline prediction oracle for a successor incremental LongMemEval run.
//
// This oracle consumes the actual successor evidence formats: the immutable
// checkpoint-receipt journal, the hash-chained hard-cap Gemini journal and
// live transcripts, the one-shot judge meter and transcript, final result
// bytes, an exact artifact manifest, and raw Git path command output. It never
// accepts caller-supplied outcome or privacy booleans.

import { createHash } from 'node:crypto'
import { posix } from 'node:path'

import {
  INCREMENTAL_LONGMEMEVAL_HARD_CAP_ANSWER_GENERATION,
  INCREMENTAL_LONGMEMEVAL_HARD_CAP_REDUCER_GENERATION,
  incrementalLongMemEvalExchangePlan,
} from './arms/incremental-memory-longmemeval-live-arm.mjs'
import {
  INCREMENTAL_CHECKPOINT_AGGREGATE_SCHEMA,
  INCREMENTAL_CHECKPOINT_RECEIPT_SCHEMA,
  incrementalCheckpointReceiptFilename,
} from './incremental-longmemeval-checkpoint-journal.mjs'
import {
  INCREMENTAL_HARD_CAP_GEMINI_LIMITS,
  INCREMENTAL_HARD_CAP_GEMINI_MODEL,
  INCREMENTAL_HARD_CAP_GEMINI_PENDING_RESERVATION_USD,
  INCREMENTAL_HARD_CAP_GEMINI_PRICES_USD_PER_MILLION,
} from './incremental-longmemeval-hard-cap-gemini.mjs'
import {
  buildIncrementalLongMemEvalJudgeBody,
  INCREMENTAL_LONGMEMEVAL_JUDGE_MODEL,
  parseIncrementalLongMemEvalJudgeResponse,
  reserveIncrementalLongMemEvalJudge,
} from './incremental-longmemeval-judge.mjs'
import {
  parseLongMemEvalJudgeLabel,
} from './longmemeval-judge.mjs'
import {
  ACTIVE_MEMORY_LIMITS,
  ACTIVE_MEMORY_REDUCER_VERSION,
  normalizeMemoryReductionPayload,
  renderActiveMemoryDigest,
} from '../src/memory-reducer.mjs'
import {
  buildAnswerPrompt,
} from '../src/brain.mjs'

export const INCREMENTAL_LONGMEMEVAL_ORACLE_PREDICTIONS =
  Object.freeze([
    Object.freeze({
      id: 'EXACT_Q1_ONLY',
      predicted: true,
      statement:
        'The run executes exactly its one contracted question and never starts a later question.',
    }),
    Object.freeze({
      id: 'ALL_INTERACTIONS_REDUCED',
      predicted: true,
      statement:
        'Every contracted interaction has one completed reducer operation and one hash-linked immutable receipt.',
    }),
    Object.freeze({
      id: 'INCREMENTAL_BOUNDARY_HELD',
      predicted: true,
      statement:
        'Every reducer request contains only the bounded prior digest and its one current interaction.',
    }),
    Object.freeze({
      id: 'DIGEST_READY_AND_BOUNDED',
      predicted: true,
      statement:
        'The answer uses a complete digest within the contracted item and serialization limits.',
    }),
    Object.freeze({
      id: 'ONE_DIGEST_ANSWER',
      predicted: true,
      statement:
        'Exactly one answer operation runs from the complete incremental digest.',
    }),
    Object.freeze({
      id: 'OFFICIAL_JUDGE_CORRECT',
      predicted: true,
      statement:
        'The official-compatible judge marks the hash-linked result correct.',
    }),
    Object.freeze({
      id: 'NO_RETRY',
      predicted: true,
      statement:
        'The exact contracted writer, answer, and judge operations each dispatch once.',
    }),
    Object.freeze({
      id: 'SPEND_WITHIN_ENVELOPE',
      predicted: true,
      statement:
        'Reconciled fresh and cumulative spend agree with the final run record and remain within both caps.',
    }),
    Object.freeze({
      id: 'PRIVATE_AND_TERMINAL',
      predicted: true,
      statement:
        'Every result artifact is hash-manifested, gitignored, untracked, and the one-question run is terminal.',
    }),
  ])

const PREDICTION_IDS = new Set(
  INCREMENTAL_LONGMEMEVAL_ORACLE_PREDICTIONS.map(({ id }) => id),
)
const HEX_SHA256 = /^[a-f0-9]{64}$/
const USD_TOLERANCE = 1e-12
const OUTCOME_RANK = Object.freeze({
  miss: 0,
  not_observed: 1,
  hit: 2,
})

export class IncrementalLongMemEvalPredictionOracleError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'IncrementalLongMemEvalPredictionOracleError'
    this.code = code
  }
}

function reject(code, message) {
  throw new IncrementalLongMemEvalPredictionOracleError(code, message)
}

function sha256(bytes) {
  return createHash('sha256').update(String(bytes)).digest('hex')
}

function isObject(value) {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function exactKeys(value, expected) {
  return isObject(value) &&
    sameJson(Object.keys(value).sort(), [...expected].sort())
}

function finiteNonNegative(value) {
  return Number.isFinite(value) && value >= 0
}

function positiveSafeInteger(value) {
  return Number.isSafeInteger(value) && value > 0
}

function sameNumber(left, right) {
  return Number.isFinite(left) &&
    Number.isFinite(right) &&
    Math.abs(left - right) <= USD_TOLERANCE
}

function safePath(value) {
  return typeof value === 'string' &&
    Boolean(value) &&
    !value.includes('\\') &&
    !value.startsWith('/') &&
    value !== '.' &&
    value !== '..' &&
    !value.startsWith('../') &&
    !value.includes('/../') &&
    posix.normalize(value) === value
}

function within(path, directory) {
  return path === directory || path.startsWith(`${directory}/`)
}

function nonEmptyLines(bytes) {
  return String(bytes ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function parseJson(bytes, label) {
  try {
    const value = JSON.parse(String(bytes))
    if (!isObject(value)) {
      reject(
        'EVIDENCE_JSON_SHAPE_INVALID',
        `${label} must contain one JSON object.`,
      )
    }
    return value
  } catch (error) {
    if (error instanceof IncrementalLongMemEvalPredictionOracleError) {
      throw error
    }
    reject('EVIDENCE_JSON_INVALID', `${label} is not valid JSON.`)
  }
}

function parseNdjson(bytes, label) {
  return nonEmptyLines(bytes).map((line, index) =>
    parseJson(line, `${label} line ${index + 1}`))
}

function requireGraph(graph) {
  if (!isObject(graph) ||
    !isObject(graph.expectations) ||
    !isObject(graph.files) ||
    !isObject(graph.paths) ||
    !isObject(graph.repository)) {
    reject(
      'EVIDENCE_GRAPH_INVALID',
      'Evidence graph needs expectations, files, paths, and repository objects.',
    )
  }
  const { expectations, files, paths, repository } = graph
  const requiredStrings = [
    'geminiContractSha256',
    'instanceSha256',
    'judgeOperationId',
    'questionId',
    'runId',
  ]
  const requiredCounts = [
    'answerOperations',
    'interactions',
    'judgeOperations',
    'writerOperations',
  ]
  const requiredUsd = [
    'cumulativeCapUsd',
    'freshCapUsd',
    'geminiCapUsd',
    'openingAccountedUsd',
  ]
  if (requiredStrings.some((key) =>
    typeof expectations[key] !== 'string' ||
    !expectations[key]) ||
    !HEX_SHA256.test(expectations.geminiContractSha256) ||
    !HEX_SHA256.test(expectations.instanceSha256) ||
    requiredCounts.some((key) =>
      !positiveSafeInteger(expectations[key])) ||
    requiredUsd.some((key) =>
      !finiteNonNegative(expectations[key])) ||
    expectations.writerOperations !== expectations.interactions ||
    expectations.answerOperations !== 1 ||
    expectations.judgeOperations !== 1) {
    reject(
      'EXPECTATIONS_INVALID',
      'Successor expectations are absent or outside the one-question contract.',
    )
  }

  const filePaths = [
    'answerResult',
    'checkpointAggregate',
    'geminiJournal',
    'instance',
    'judgeMeter',
    'manifest',
    'questionResult',
    'runState',
  ]
  const directoryPaths = [
    'checkpointDirectory',
    'geminiTranscriptDirectory',
    'judgeTranscriptDirectory',
    'runDirectory',
  ]
  if ([...filePaths, ...directoryPaths]
    .some((key) => !safePath(paths[key])) ||
    filePaths.some((key) => !within(paths[key], paths.runDirectory)) ||
    directoryPaths
      .filter((key) => key !== 'runDirectory')
      .some((key) => !within(paths[key], paths.runDirectory)) ||
    Object.keys(files).some((path) =>
      !safePath(path) ||
      !within(path, paths.runDirectory) ||
      typeof files[path] !== 'string') ||
    filePaths.some((key) => !(paths[key] in files))) {
    reject(
      'EVIDENCE_PATH_INVALID',
      'All evidence files must be normalized repository paths under the private run directory.',
    )
  }
  if (typeof repository.gitLsFilesBytes !== 'string' ||
    typeof repository.gitCheckIgnoreBytes !== 'string') {
    reject(
      'GIT_EVIDENCE_INVALID',
      'Raw git ls-files and git check-ignore outputs are required.',
    )
  }
  return graph
}

function initialTranscriptText(record) {
  return `${JSON.stringify({
    attempt: record.attempt,
    request: record.request,
    schemaVersion: record.schemaVersion,
    startedAt: record.startedAt,
    state: 'started',
  }, null, 2)}\n`
}

function transcriptEvidence({
  files,
  start,
  terminal,
  transcriptDirectory,
}) {
  if (typeof start?.transcriptFile !== 'string' ||
    !start.transcriptFile ||
    start.transcriptFile.includes('/') ||
    start.transcriptFile.includes('\\')) {
    return null
  }
  const path = `${transcriptDirectory}/${start.transcriptFile}`
  if (!safePath(path) ||
    !(path in files) ||
    terminal?.transcriptFile !== start.transcriptFile ||
    sha256(files[path]) !== terminal?.transcriptSha256) {
    return null
  }
  const record = parseJson(files[path], path)
  const normalizedBody = record?.request?.normalizedBody
  if (record.schemaVersion !== 1 ||
    record.state !== 'terminal' ||
    record.attempt?.attempt !== start.attempt ||
    record.attempt?.attemptId !== start.attemptId ||
    record.attempt?.cellId !== start.cellId ||
    record.attempt?.endpoint !== start.endpoint ||
    record.attempt?.operationId !== start.operationId ||
    record.attempt?.purpose !== start.purpose ||
    typeof normalizedBody !== 'string' ||
    record.request?.bodyBytes !== Buffer.byteLength(normalizedBody) ||
    record.request?.bodySha256 !== start.requestSha256 ||
    sha256(normalizedBody) !== start.requestSha256 ||
    record.startedRecordSha256 !== start.transcriptStartedSha256 ||
    sha256(initialTranscriptText(record)) !==
      start.transcriptStartedSha256 ||
    record.terminal?.outcome !== terminal.outcome) {
    return null
  }
  let body
  try {
    body = JSON.parse(normalizedBody)
  } catch {
    return null
  }
  const response = record?.terminal?.response
  const rawBody = response?.rawBody
  if (typeof rawBody !== 'string' ||
    response.bodyAvailable !== true ||
    response.bodyBytes !== Buffer.byteLength(rawBody) ||
    response.bodySha256 !== sha256(rawBody)) {
    return null
  }
  return { body, path, record }
}

function eventSha256(event) {
  const copy = { ...event }
  delete copy.eventSha256
  return sha256(JSON.stringify(copy))
}

function reservationIsExact(value) {
  return value?.inputTokens ===
      INCREMENTAL_HARD_CAP_GEMINI_LIMITS.inputTokens &&
    value?.outputTokens ===
      INCREMENTAL_HARD_CAP_GEMINI_LIMITS.outputTokens &&
    value?.usd ===
      INCREMENTAL_HARD_CAP_GEMINI_PENDING_RESERVATION_USD
}

function measuredGeminiUsd(
  inputTokens,
  outputTokens,
  cachedInputTokens,
) {
  const uncachedInputTokens = inputTokens - cachedInputTokens
  return Number(((
    uncachedInputTokens *
      INCREMENTAL_HARD_CAP_GEMINI_PRICES_USD_PER_MILLION
        .standardInput +
    cachedInputTokens *
      INCREMENTAL_HARD_CAP_GEMINI_PRICES_USD_PER_MILLION
        .standardCachedInput +
    outputTokens *
      INCREMENTAL_HARD_CAP_GEMINI_PRICES_USD_PER_MILLION
        .standardOutput
  ) / 1_000_000).toFixed(12))
}

function validMeasuredGeminiUsage(event) {
  const usage = event?.usage
  const details = event?.usageDetails
  return positiveSafeInteger(usage?.inputTokens) &&
    positiveSafeInteger(usage?.outputTokens) &&
    usage.inputTokens <=
      INCREMENTAL_HARD_CAP_GEMINI_LIMITS.inputTokens &&
    usage.outputTokens <=
      INCREMENTAL_HARD_CAP_GEMINI_LIMITS.outputTokens &&
    Number.isSafeInteger(details?.cachedInputTokens) &&
    details.cachedInputTokens >= 0 &&
    details.cachedInputTokens <= usage.inputTokens &&
    usage.usd ===
      measuredGeminiUsd(
        usage.inputTokens,
        usage.outputTokens,
        details.cachedInputTokens,
      ) &&
    details?.candidateTokens === usage.outputTokens &&
    details?.serviceTier === 'standard' &&
    details?.serviceTierHeader === 'standard' &&
    details?.thoughtTokens === 0 &&
    details?.toolInputTokens === 0
}

function validSuccessorGeminiBody(start, transcript) {
  const body = transcript?.body
  const content = body?.contents?.[0]
  const part = content?.parts?.[0]
  const writer = start.purpose === 'writer'
  const expectedGeneration = writer
    ? INCREMENTAL_LONGMEMEVAL_HARD_CAP_REDUCER_GENERATION
    : INCREMENTAL_LONGMEMEVAL_HARD_CAP_ANSWER_GENERATION
  return exactKeys(
    body,
    writer
      ? [
          'contents',
          'generationConfig',
          'store',
          'systemInstruction',
        ]
      : ['contents', 'generationConfig', 'store'],
  ) &&
    Array.isArray(body.contents) &&
    body.contents.length === 1 &&
    exactKeys(content, ['parts', 'role']) &&
    content.role === 'user' &&
    Array.isArray(content.parts) &&
    content.parts.length === 1 &&
    exactKeys(part, ['text']) &&
    typeof part.text === 'string' &&
    Boolean(part.text) &&
    body.store === false &&
    sameJson(body.generationConfig, expectedGeneration) &&
    sameJson(
      transcript.record?.request?.settings,
      expectedGeneration,
    ) &&
    start.maxConfiguredOutputTokens ===
      expectedGeneration.maxOutputTokens &&
    (writer
      ? exactKeys(body.systemInstruction, ['parts']) &&
        Array.isArray(body.systemInstruction.parts) &&
        body.systemInstruction.parts.length === 1 &&
        exactKeys(body.systemInstruction.parts[0], ['text']) &&
        typeof body.systemInstruction.parts[0].text === 'string' &&
        Boolean(body.systemInstruction.parts[0].text)
      : !Object.hasOwn(body, 'systemInstruction'))
}

function geminiSuccessMatchesTranscript(event, transcript) {
  let response
  try {
    response = JSON.parse(
      transcript?.record?.terminal?.response?.rawBody,
    )
  } catch {
    return false
  }
  const recorded = transcript.record.terminal.response
  const usage = response?.usageMetadata
  const candidate = response?.candidates?.[0]
  const details = event.usageDetails
  return recorded.status === 200 &&
    recorded.headers?.['x-gemini-service-tier'] === 'standard' &&
    recorded.finishReason === 'STOP' &&
    response.modelVersion === INCREMENTAL_HARD_CAP_GEMINI_MODEL &&
    response.modelVersion === event.modelVersion &&
    usage?.serviceTier === 'standard' &&
    usage?.promptTokenCount === event.usage.inputTokens &&
    usage?.candidatesTokenCount === event.usage.outputTokens &&
    (usage?.cachedContentTokenCount ?? 0) ===
      details.cachedInputTokens &&
    (usage?.thoughtsTokenCount ?? 0) === details.thoughtTokens &&
    (usage?.toolUsePromptTokenCount ?? 0) ===
      details.toolInputTokens &&
    usage?.totalTokenCount ===
      event.usage.inputTokens + event.usage.outputTokens &&
    candidate?.finishReason === 'STOP' &&
    sameJson(recorded.usage, usage)
}

function geminiTerminalObservation(transcript) {
  try {
    const response = JSON.parse(
      transcript?.record?.terminal?.response?.rawBody,
    )
    const parts = response?.candidates?.[0]?.content?.parts
    if (!Array.isArray(parts) || !parts.length) return null
    const text = parts
      .filter((part) => part?.thought !== true)
      .map((part) => part?.text)
      .join('')
      .trim()
    if (!text || typeof response.modelVersion !== 'string') {
      return null
    }
    return {
      modelVersion: response.modelVersion,
      text,
    }
  } catch {
    return null
  }
}

function geminiEvidence({
  events,
  expectations,
  files,
  transcriptDirectory,
}) {
  const starts = new Map()
  const terminals = new Map()
  const transcripts = new Map()
  const operations = new Set()
  let previousEventSha256 = null
  let coherent = events.length > 0
  let accountedUsd = expectations.openingAccountedUsd
  let measuredUsd = 0
  let uncertainUsd = 0

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index]
    if (event.schemaVersion !== 1 ||
      event.sequence !== index + 1 ||
      event.previousEventSha256 !== previousEventSha256 ||
      event.eventSha256 !== eventSha256(event) ||
      event.capUsd !== expectations.geminiCapUsd ||
      event.openingAccountedUsd !==
        expectations.openingAccountedUsd ||
      event.contractSha256 !==
        expectations.geminiContractSha256 ||
      event.model !== INCREMENTAL_HARD_CAP_GEMINI_MODEL ||
      typeof event.attemptId !== 'string' ||
      !event.attemptId ||
      typeof event.operationId !== 'string' ||
      !event.operationId) {
      coherent = false
    }
    previousEventSha256 = event.eventSha256

    if (event.type === 'attempt_started') {
      const reservationUsd = Number(
        event?.reservation?.usd ?? Number.NaN,
      )
      if (event.attempt !== 1 ||
        !['answer', 'writer'].includes(event.purpose) ||
        starts.has(event.attemptId) ||
        operations.has(event.operationId) ||
        !HEX_SHA256.test(event.requestSha256 ?? '') ||
        !reservationIsExact(event.reservation) ||
        !finiteNonNegative(reservationUsd) ||
        accountedUsd + reservationUsd >
          expectations.geminiCapUsd + USD_TOLERANCE ||
        typeof event.transcriptFile !== 'string' ||
        !HEX_SHA256.test(event.transcriptStartedSha256 ?? '')) {
        coherent = false
      }
      starts.set(event.attemptId, event)
      operations.add(event.operationId)
      accountedUsd = Number((
        accountedUsd + Number(event?.reservation?.usd ?? Number.NaN)
      ).toFixed(12))
      uncertainUsd = Number((
        uncertainUsd + Number(event?.reservation?.usd ?? Number.NaN)
      ).toFixed(12))
      continue
    }

    const start = starts.get(event.attemptId)
    if (event.type !== 'attempt_terminal' ||
      !start ||
      terminals.has(event.attemptId) ||
      event.operationId !== start.operationId ||
      event.requestSha256 !== start.requestSha256 ||
      !['http_error', 'invalid_response', 'success', 'transport_error']
        .includes(event.outcome)) {
      coherent = false
      continue
    }
    terminals.set(event.attemptId, event)
    if (event.outcome === 'success') {
      if (!validMeasuredGeminiUsage(event)) coherent = false
      accountedUsd = Number((
        accountedUsd - start.reservation.usd + event.usage.usd
      ).toFixed(12))
      uncertainUsd = Number((
        uncertainUsd - start.reservation.usd
      ).toFixed(12))
      measuredUsd = Number((
        measuredUsd + event.usage.usd
      ).toFixed(12))
    }
    const transcript = transcriptEvidence({
      files,
      start,
      terminal: event,
      transcriptDirectory,
    })
    if (!transcript ||
      !validSuccessorGeminiBody(start, transcript)) {
      coherent = false
    } else {
      transcripts.set(event.attemptId, transcript)
      if (event.outcome === 'success' &&
        !geminiSuccessMatchesTranscript(event, transcript)) {
        coherent = false
      }
    }
  }

  if (starts.size !== terminals.size) coherent = false
  const linkedTranscriptPaths = [...starts.values()]
    .map((start) => `${transcriptDirectory}/${start.transcriptFile}`)
    .sort()
  const actualTranscriptPaths = Object.keys(files)
    .filter((path) => within(path, transcriptDirectory))
    .sort()
  const directorySetExact =
    sameJson(actualTranscriptPaths, linkedTranscriptPaths)
  if (!directorySetExact) coherent = false
  return {
    accountedUsd,
    coherent,
    measuredUsd,
    starts: [...starts.values()],
    terminals: [...terminals.values()],
    transcripts,
    uncertainUsd,
    directorySetExact,
  }
}

function exchangeEvidence(exchange) {
  const evidence = []
  if (exchange?.userMessage?.trim()) {
    evidence.push({
      observedAt: exchange.eventAt,
      speaker: 'user',
      text: exchange.userMessage,
    })
  }
  if (exchange?.assistantMessage?.trim()) {
    evidence.push({
      observedAt: exchange.eventAt,
      speaker: 'Palari',
      text: exchange.assistantMessage,
    })
  }
  return evidence
}

function priorFromActiveMemories(memories) {
  if (!Array.isArray(memories)) return null
  return memories.map((memory) => ({
    id: String(memory.id ?? ''),
    topic: String(memory.topic ?? ''),
    statement: String(memory.statement ?? ''),
    speaker: String(memory.speaker ?? ''),
    epistemic: String(memory.epistemic ?? ''),
    observedAt: String(memory.observedAt ?? ''),
    timeBasis: memory.timeBasis
      ? {
          evidenceId: String(memory.timeBasis.evidenceId ?? ''),
          quote: String(memory.timeBasis.quote ?? ''),
        }
      : null,
  }))
}

function validReducerBody({
  body,
  exchange,
  ordinal,
  previousMemories,
}) {
  let envelope
  try {
    envelope = JSON.parse(body?.contents?.[0]?.parts?.[0]?.text)
  } catch {
    return false
  }
  const input = envelope?.input
  const expectedEvidence = exchangeEvidence(exchange)
  const expectedPrior = priorFromActiveMemories(previousMemories)
  return exactKeys(envelope, ['contractVersion', 'input']) &&
    envelope.contractVersion === ACTIVE_MEMORY_REDUCER_VERSION &&
    exactKeys(input, ['baseRevision', 'evidence', 'limits', 'prior']) &&
    input.baseRevision === ordinal - 1 &&
    sameJson(input.limits, ACTIVE_MEMORY_LIMITS) &&
    Array.isArray(input.evidence) &&
    input.evidence.length === expectedEvidence.length &&
    input.evidence.every((entry, index) =>
      exactKeys(entry, ['id', 'observedAt', 'speaker', 'text']) &&
      typeof entry.id === 'string' &&
      Boolean(entry.id) &&
      entry.observedAt === expectedEvidence[index].observedAt &&
      entry.speaker === expectedEvidence[index].speaker &&
      entry.text === expectedEvidence[index].text) &&
    Array.isArray(input.prior) &&
    sameJson(input.prior, expectedPrior) &&
    JSON.stringify(envelope).length <=
      ACTIVE_MEMORY_LIMITS.maxRequestChars
}

function validReducerResponse(body, responseText) {
  try {
    const envelope =
      JSON.parse(body?.contents?.[0]?.parts?.[0]?.text)
    const input = envelope?.input
    normalizeMemoryReductionPayload(responseText, {
      baseRevision: input?.baseRevision,
      currentEvidenceIds:
        input?.evidence?.map(({ id }) => id),
      priorMemoryIds: input?.prior?.map(({ id }) => id),
    })
    return true
  } catch {
    return false
  }
}

function checkpointJournalEvidence({
  aggregate,
  aggregateText,
  checkpointDirectory,
  expectations,
  files,
}) {
  const receipts = []
  let previousReceiptSha256 = null
  let coherent =
    exactKeys(aggregate, [
      'checkpoints',
      'completedInteraction',
      'lastReceiptSha256',
      'questionId',
      'receiptManifest',
      'runId',
      'schemaVersion',
    ]) &&
    aggregate.schemaVersion ===
      INCREMENTAL_CHECKPOINT_AGGREGATE_SCHEMA &&
    aggregate.runId === expectations.runId &&
    aggregate.questionId === expectations.questionId &&
    aggregate.completedInteraction === expectations.interactions &&
    Array.isArray(aggregate.checkpoints) &&
    aggregate.checkpoints.length === expectations.interactions &&
    Array.isArray(aggregate.receiptManifest) &&
    aggregate.receiptManifest.length === expectations.interactions
  if (aggregateText !== `${JSON.stringify(aggregate, null, 2)}\n`) {
    coherent = false
  }

  for (let index = 0; index < expectations.interactions; index += 1) {
    const ordinal = index + 1
    const filename = incrementalCheckpointReceiptFilename(ordinal)
    const path = `${checkpointDirectory}/${filename}`
    const manifestEntry = aggregate.receiptManifest?.[index]
    if (!(path in files)) {
      coherent = false
      continue
    }
    const text = files[path]
    const record = parseJson(text, path)
    const payload = record.payload
    const checkpoint = payload?.checkpoint
    const receiptSha256 = sha256(text)
    const renderedDigest =
      renderedDigestOrNull(checkpoint?.activeMemories)
    if (!exactKeys(record, ['payload', 'payloadSha256']) ||
      !exactKeys(payload, [
        'checkpoint',
        'checkpointSha256',
        'ordinal',
        'previousReceiptSha256',
        'questionId',
        'runId',
        'schemaVersion',
      ]) ||
      payload.schemaVersion !== INCREMENTAL_CHECKPOINT_RECEIPT_SCHEMA ||
      payload.runId !== expectations.runId ||
      payload.questionId !== expectations.questionId ||
      payload.ordinal !== ordinal ||
      payload.previousReceiptSha256 !== previousReceiptSha256 ||
      payload.checkpointSha256 !==
        sha256(JSON.stringify(checkpoint)) ||
      record.payloadSha256 !== sha256(JSON.stringify(payload)) ||
      text !== `${JSON.stringify(record, null, 2)}\n` ||
      checkpoint?.status !== 'completed' ||
      checkpoint?.completedInteraction !== ordinal ||
      checkpoint?.unitOrder !== ordinal ||
      checkpoint?.interactionCount !== expectations.interactions ||
      !Array.isArray(checkpoint?.activeMemories) ||
      checkpoint.activeMemories.length >
        ACTIVE_MEMORY_LIMITS.maxItems ||
      checkpoint?.activeMemoriesSha256 !==
        sha256(JSON.stringify(checkpoint.activeMemories)) ||
      renderedDigest === null ||
      checkpoint?.digestChars !== renderedDigest.text.length ||
      checkpoint.digestChars > ACTIVE_MEMORY_LIMITS.maxDigestChars ||
      checkpoint?.digest?.ready !== true ||
      checkpoint?.digest?.pending !== 0 ||
      checkpoint?.digest?.digestRevision !== ordinal ||
      checkpoint?.digest?.sourceRevision !== ordinal ||
      !HEX_SHA256.test(checkpoint?.reducerRequestSha256 ?? '') ||
      !HEX_SHA256.test(checkpoint?.reducerResponseSha256 ?? '') ||
      !sameJson(checkpoint, aggregate.checkpoints?.[index]) ||
      !sameJson(manifestEntry, {
        checkpointSha256: payload.checkpointSha256,
        filename,
        ordinal,
        receiptSha256,
      })) {
      coherent = false
    }
    receipts.push({
      checkpoint,
      path,
      receiptSha256,
    })
    previousReceiptSha256 = receiptSha256
  }
  if (aggregate.lastReceiptSha256 !== previousReceiptSha256) {
    coherent = false
  }
  return { coherent, receipts }
}

function initialJudgeMeterText(meter) {
  const started = { ...meter }
  delete started.completedAt
  delete started.startedStateSha256
  delete started.terminal
  started.state = 'attempt_started'
  return `${JSON.stringify(started, null, 2)}\n`
}

function judgeEvidence({
  expectedBody,
  expectations,
  files,
  meter,
  transcriptDirectory,
}) {
  const file = meter?.terminal?.transcript?.file
  const transcriptPath = typeof file === 'string'
    ? `${transcriptDirectory}/${file}`
    : ''
  const actualTranscriptPaths = Object.keys(files)
    .filter((path) => within(path, transcriptDirectory))
    .sort()
  const expectedTranscriptPaths = safePath(transcriptPath)
    ? [transcriptPath]
    : []
  const directorySetExact =
    sameJson(actualTranscriptPaths, expectedTranscriptPaths)
  if (meter?.schemaVersion !== 1 ||
    meter?.state !== 'terminal' ||
    meter?.attempt !== 1 ||
    meter?.operationId !== expectations.judgeOperationId ||
    meter?.purpose !== 'judge' ||
    meter?.model !== INCREMENTAL_LONGMEMEVAL_JUDGE_MODEL ||
    meter?.terminal?.outcome !== 'success' ||
    meter?.terminal?.status !== 200 ||
    meter?.terminal?.uncertain !== null ||
    meter?.startedStateSha256 !==
      sha256(initialJudgeMeterText(meter)) ||
    !directorySetExact ||
    !safePath(transcriptPath) ||
    !(transcriptPath in files) ||
    sha256(files[transcriptPath]) !==
      meter?.terminal?.transcript?.sha256) {
    return {
      accountedUsd: Number.NaN,
      coherent: false,
      correct: false,
      noRetry: false,
      capContext: null,
      reservationUsd: Number.NaN,
      text: null,
      directorySetExact,
    }
  }
  const transcript = parseJson(files[transcriptPath], transcriptPath)
  const normalizedBody = transcript?.request?.normalizedBody
  const rawBody = transcript?.terminal?.response?.rawBody
  let parsed
  try {
    if (typeof normalizedBody !== 'string' ||
      transcript.state !== 'terminal' ||
      transcript.attempt?.attempt !== 1 ||
      transcript.attempt?.attemptId !== meter.attemptId ||
      transcript.attempt?.operationId !== meter.operationId ||
      transcript.attempt?.purpose !== 'judge' ||
      transcript.attempt?.endpoint !== 'openai-chat-completions' ||
      transcript.request?.bodyBytes !== meter.request?.bytes ||
      transcript.request?.bodySha256 !== meter.request?.sha256 ||
      sha256(normalizedBody) !== meter.request?.sha256 ||
      transcript.startedRecordSha256 !==
        meter.transcript?.startedSha256 ||
      sha256(initialTranscriptText(transcript)) !==
        meter.transcript?.startedSha256 ||
      transcript.terminal?.outcome !== meter.terminal.outcome ||
      typeof rawBody !== 'string' ||
      transcript.terminal.response?.bodyAvailable !== true ||
      transcript.terminal.response?.status !== 200 ||
      transcript.terminal.response?.bodyBytes !==
        Buffer.byteLength(rawBody) ||
      transcript.terminal.response?.bodySha256 !== sha256(rawBody)) {
      throw new TypeError('judge transcript link mismatch')
    }
    const body = JSON.parse(normalizedBody)
    if (!sameJson(body, expectedBody)) {
      throw new TypeError('judge body differs from benchmark result')
    }
    if (!sameJson(meter.reservation,
      reserveIncrementalLongMemEvalJudge(body))) {
      throw new TypeError('judge reservation mismatch')
    }
    parsed = parseIncrementalLongMemEvalJudgeResponse({
      body,
      rawBody,
      reservation: meter.reservation,
    })
    if (transcript.terminal.response?.finishReason !==
        parsed.finishReason ||
      !sameJson(
        transcript.terminal.response?.usage,
        parsed.rawUsage,
      )) {
      throw new TypeError('judge response metadata mismatch')
    }
  } catch {
    return {
      accountedUsd: Number.NaN,
      coherent: false,
      correct: false,
      noRetry: false,
      capContext: null,
      reservationUsd: Number.NaN,
      text: null,
      directorySetExact,
    }
  }
  const coherent =
    sameJson(parsed.measured, meter.terminal.measured) &&
    meter.terminal.accountedUsd === parsed.measured.usd
  return {
    accountedUsd: coherent
      ? meter.terminal.accountedUsd
      : Number.NaN,
    coherent,
    correct:
      coherent && parseLongMemEvalJudgeLabel(parsed.text) === true,
    noRetry: coherent && meter.attempt === 1,
    capContext: coherent ? meter.capContext : null,
    reservationUsd: coherent
      ? meter.reservation.usd
      : Number.NaN,
    text: coherent ? parsed.text : null,
    directorySetExact,
  }
}

function manifested({
  expectedRunId,
  files,
  manifestPath,
  runDirectory,
}) {
  const manifest = parseJson(files[manifestPath], manifestPath)
  if (!Array.isArray(manifest.artifacts) ||
    manifest.runId !== expectedRunId) {
    return false
  }
  const expected = Object.keys(files)
    .filter((path) => path !== manifestPath)
    .sort()
  const actual = manifest.artifacts.map(({ path }) => path).sort()
  return sameJson(actual, expected) &&
    manifest.artifacts.every((entry) =>
      isObject(entry) &&
      safePath(entry.path) &&
      within(entry.path, runDirectory) &&
      entry.path in files &&
      entry.bytes === Buffer.byteLength(files[entry.path]) &&
      HEX_SHA256.test(entry.sha256 ?? '') &&
      sha256(files[entry.path]) === entry.sha256)
}

function hashLinked(files, path, expectedSha256) {
  return path in files &&
    HEX_SHA256.test(expectedSha256 ?? '') &&
    sha256(files[path]) === expectedSha256
}

function renderedDigestOrNull(memories) {
  try {
    return renderActiveMemoryDigest(memories)
  } catch {
    return null
  }
}

function canonicalDigestText(text) {
  try {
    const lines = String(text).split('\n')
    if (lines.length < 4) return null
    return lines.map((line, index) => {
      if (index < 2 || index === lines.length - 1) return line
      const row = JSON.parse(line)
      if (!isObject(row) || !Array.isArray(row.supports)) return null
      return JSON.stringify({
        ...row,
        supports: [...row.supports].sort((left, right) =>
          JSON.stringify(left).localeCompare(JSON.stringify(right))),
      })
    }).join('\n')
  } catch {
    return null
  }
}

function exactAnswerPrompt({
  benchmarkInstance,
  prompt,
  renderedDigest,
}) {
  try {
    if (typeof prompt !== 'string' ||
      renderedDigest === null ||
      !renderedDigest.text) {
      return null
    }
    const canonicalPrompt = buildAnswerPrompt({
      briefingText: renderedDigest.text,
      question: benchmarkInstance.question,
      questionDate: benchmarkInstance.questionDate,
    })
    const digestOffset = canonicalPrompt.indexOf(renderedDigest.text)
    if (digestOffset < 0 ||
      digestOffset !== canonicalPrompt.lastIndexOf(renderedDigest.text)) {
      return null
    }
    const prefix = canonicalPrompt.slice(0, digestOffset)
    const suffix = canonicalPrompt.slice(
      digestOffset + renderedDigest.text.length,
    )
    if (!prompt.startsWith(prefix) ||
      !prompt.endsWith(suffix) ||
      prompt.length < prefix.length + suffix.length) {
      return null
    }
    const briefingText = prompt.slice(
      prefix.length,
      prompt.length - suffix.length,
    )
    if (canonicalDigestText(briefingText) !==
      canonicalDigestText(renderedDigest.text)) {
      return null
    }
    const rebuilt = buildAnswerPrompt({
      briefingText,
      question: benchmarkInstance.question,
      questionDate: benchmarkInstance.questionDate,
    })
    return rebuilt === prompt ? rebuilt : null
  } catch {
    return null
  }
}

function exactArtifactSet({
  expectations,
  files,
  gemini,
  judgeMeter,
  paths,
}) {
  const expected = [
    paths.answerResult,
    paths.checkpointAggregate,
    paths.geminiJournal,
    paths.instance,
    paths.judgeMeter,
    paths.manifest,
    paths.questionResult,
    paths.runState,
  ]
  for (let ordinal = 1;
    ordinal <= expectations.interactions;
    ordinal += 1) {
    expected.push(
      `${paths.checkpointDirectory}/` +
        incrementalCheckpointReceiptFilename(ordinal),
    )
  }
  for (const start of gemini.starts) {
    if (typeof start.transcriptFile !== 'string' ||
      !start.transcriptFile ||
      start.transcriptFile.includes('/') ||
      start.transcriptFile.includes('\\')) {
      return false
    }
    expected.push(
      `${paths.geminiTranscriptDirectory}/${start.transcriptFile}`,
    )
  }
  const judgeTranscript = judgeMeter?.terminal?.transcript?.file
  if (typeof judgeTranscript !== 'string' ||
    !judgeTranscript ||
    judgeTranscript.includes('/') ||
    judgeTranscript.includes('\\')) {
    return false
  }
  expected.push(
    `${paths.judgeTranscriptDirectory}/${judgeTranscript}`,
  )
  return sameJson(
    [...new Set(expected)].sort(),
    Object.keys(files).sort(),
  )
}

export function auditIncrementalLongMemEvalPredictionEvidence(graph) {
  requireGraph(graph)
  const { expectations, files, paths, repository } = graph
  const runState = parseJson(files[paths.runState], paths.runState)
  const benchmarkInstance =
    parseJson(files[paths.instance], paths.instance)
  const answerResult =
    parseJson(files[paths.answerResult], paths.answerResult)
  const questionResult =
    parseJson(files[paths.questionResult], paths.questionResult)
  const aggregate = parseJson(
    files[paths.checkpointAggregate],
    paths.checkpointAggregate,
  )
  const checkpointJournal = checkpointJournalEvidence({
    aggregate,
    aggregateText: files[paths.checkpointAggregate],
    checkpointDirectory: paths.checkpointDirectory,
    expectations,
    files,
  })
  const gemini = geminiEvidence({
    events: parseNdjson(files[paths.geminiJournal], paths.geminiJournal),
    expectations,
    files,
    transcriptDirectory: paths.geminiTranscriptDirectory,
  })
  let exchanges = []
  let expectedJudgeBody = null
  try {
    exchanges = [...incrementalLongMemEvalExchangePlan(
      benchmarkInstance,
    )]
    expectedJudgeBody = buildIncrementalLongMemEvalJudgeBody(
      benchmarkInstance,
      answerResult.answer,
    )
  } catch {
    // An invalid private instance cannot support any benchmark claim.
  }
  const instanceCoherent =
    sha256(files[paths.instance]) === expectations.instanceSha256 &&
    benchmarkInstance.questionId === expectations.questionId &&
    exchanges.length === expectations.interactions &&
    expectedJudgeBody !== null
  const judgeMeter = parseJson(
    files[paths.judgeMeter],
    paths.judgeMeter,
  )
  const judge = judgeEvidence({
    expectedBody: expectedJudgeBody,
    expectations,
    files,
    meter: judgeMeter,
    transcriptDirectory: paths.judgeTranscriptDirectory,
  })

  const writerStarts = gemini.starts.filter(({ purpose }) =>
    purpose === 'writer')
  const answerStarts = gemini.starts.filter(({ purpose }) =>
    purpose === 'answer')
  const writerByOperation = new Map(
    writerStarts.map((start) => [start.operationId, start]),
  )
  const terminalByAttempt = new Map(
    gemini.terminals.map((terminal) => [
      terminal.attemptId,
      terminal,
    ]),
  )
  let incrementalBoundaryHeld =
    instanceCoherent &&
    checkpointJournal.coherent &&
    writerStarts.length === expectations.writerOperations
  let checkpointProviderBound =
    checkpointJournal.coherent &&
    writerStarts.length === expectations.writerOperations
  for (let index = 0;
    index < checkpointJournal.receipts.length;
    index += 1) {
    const ordinal = index + 1
    const checkpoint =
      checkpointJournal.receipts[index].checkpoint
    const operationId =
      `question:${expectations.questionId}:reducer:${ordinal}`
    const start = writerByOperation.get(operationId)
    const transcript = start
      ? gemini.transcripts.get(start.attemptId)
      : null
    const terminal = start
      ? terminalByAttempt.get(start.attemptId)
      : null
    const response =
      geminiTerminalObservation(transcript)
    const previousMemories = ordinal === 1
      ? []
      : checkpointJournal.receipts[index - 1]
        ?.checkpoint?.activeMemories
    if (!start ||
      checkpoint?.reducerRequestSha256 !== start.requestSha256 ||
      !transcript ||
      !validReducerBody({
        body: transcript.body,
        exchange: exchanges[index],
        ordinal,
        previousMemories,
      })) {
      incrementalBoundaryHeld = false
    }
    if (!terminal ||
      terminal.outcome !== 'success' ||
      terminal.status !== 200 ||
      !response ||
      !validReducerResponse(transcript?.body, response.text) ||
      checkpoint?.reducerResponseSha256 !== sha256(response.text) ||
      checkpoint?.modelVersion !== response.modelVersion ||
      terminal.modelVersion !== response.modelVersion) {
      checkpointProviderBound = false
    }
  }

  const answerLinked =
    runState?.answer?.status === 'completed' &&
    runState.answer.resultFile === paths.answerResult &&
    hashLinked(
      files,
      paths.answerResult,
      runState.answer.resultSha256,
    )
  const questionLinked =
    runState?.question?.status === 'completed' &&
    runState.question.resultFile === paths.questionResult &&
    hashLinked(
      files,
      paths.questionResult,
      runState.question.resultSha256,
    )
  const answerStart = answerStarts[0]
  const answerTranscript = answerStart
    ? gemini.transcripts.get(answerStart.attemptId)
    : null
  const answerTerminal = answerStart
    ? terminalByAttempt.get(answerStart.attemptId)
    : null
  const answerResponse =
    geminiTerminalObservation(answerTranscript)
  const answerPrompt =
    answerTranscript?.body?.contents?.[0]?.parts?.[0]?.text
  const finalCheckpoint = aggregate.checkpoints?.at(-1)
  const renderedDigest =
    renderedDigestOrNull(answerResult.activeMemories)
  const expectedAnswerPrompt = exactAnswerPrompt({
    benchmarkInstance,
    prompt: answerPrompt,
    renderedDigest,
  })
  const answerProviderBound =
    gemini.coherent &&
    answerTerminal?.outcome === 'success' &&
    answerTerminal?.status === 200 &&
    answerResponse !== null &&
    answerTerminal?.modelVersion === answerResponse?.modelVersion &&
    answerResult.answer === answerResponse?.text &&
    answerResult.answerModelVersion === answerResponse?.modelVersion &&
    answerResult.modelVersion === answerResponse?.modelVersion
  const oneDigestAnswer =
    answerLinked &&
    instanceCoherent &&
    answerProviderBound &&
    answerStarts.length === expectations.answerOperations &&
    answerStart?.operationId ===
      `question:${expectations.questionId}:answer` &&
    answerResult.questionId === expectations.questionId &&
    answerResult.answerProviderCalled === true &&
    answerResult.answerRequestSha256 === answerStart?.requestSha256 &&
    typeof answerPrompt === 'string' &&
    answerPrompt === expectedAnswerPrompt &&
    answerResult.promptSha256 === sha256(expectedAnswerPrompt) &&
    answerResult?.briefing?.complete === true &&
    answerResult?.briefing?.mode === 'incremental_digest' &&
    answerResult?.logicalOperations?.answer === 1 &&
    answerResult?.logicalOperations?.reducer ===
      expectations.interactions &&
    answerResult?.logicalOperations?.total ===
      expectations.interactions + 1 &&
    answerResult?.interactions === expectations.interactions &&
    sameJson(
      answerResult.interactionCheckpoints,
      aggregate.checkpoints,
    )

  const activeIds = Array.isArray(answerResult.activeMemories)
    ? answerResult.activeMemories.map(({ id }) => id)
    : null
  const digestReadyAndBounded =
    answerLinked &&
    instanceCoherent &&
    answerProviderBound &&
    answerPrompt === expectedAnswerPrompt &&
    checkpointProviderBound &&
    checkpointJournal.coherent &&
    gemini.coherent &&
    Array.isArray(answerResult.activeMemories) &&
    HEX_SHA256.test(answerResult.activeMemoriesSha256 ?? '') &&
    sha256(JSON.stringify(answerResult.activeMemories)) ===
      answerResult.activeMemoriesSha256 &&
    sameJson(
      answerResult.activeMemories,
      finalCheckpoint?.activeMemories,
    ) &&
    answerResult.activeMemoriesSha256 ===
      finalCheckpoint?.activeMemoriesSha256 &&
    renderedDigest !== null &&
    answerResult.activeMemories.length <=
      ACTIVE_MEMORY_LIMITS.maxItems &&
    renderedDigest.text.length <=
      ACTIVE_MEMORY_LIMITS.maxDigestChars &&
    finalCheckpoint?.digestChars === renderedDigest.text.length &&
    finalCheckpoint?.digest?.ready === true &&
    finalCheckpoint?.digest?.pending === 0 &&
    finalCheckpoint?.digest?.digestRevision ===
      expectations.interactions &&
    finalCheckpoint?.digest?.sourceRevision ===
      expectations.interactions &&
    answerResult?.digestStatus?.ready === true &&
    answerResult?.digestStatus?.pending === 0 &&
    answerResult?.digestStatus?.digestRevision ===
      expectations.interactions &&
    answerResult?.digestStatus?.sourceRevision ===
      expectations.interactions &&
    sameJson(answerResult.digestStatus, finalCheckpoint?.digest) &&
    sameJson(
      answerResult?.briefing?.includedMemoryIds,
      activeIds,
    )

  const invocation = runState?.invocations?.[0]
  const exactQ1Only =
    instanceCoherent &&
    runState?.identity?.runId === expectations.runId &&
    runState?.identity?.questionId === expectations.questionId &&
    runState?.question?.questionId === expectations.questionId &&
    runState?.invocations?.length === 1 &&
    invocation?.question2Started === false &&
    invocation?.completedQuestions === 1 &&
    sameJson(invocation?.questionIds, [expectations.questionId]) &&
    gemini.starts.every(({ operationId }) =>
      operationId.startsWith(`question:${expectations.questionId}:`)) &&
    expectations.judgeOperationId.startsWith(
      `question:${expectations.questionId}:`,
    )

  const operationIds = gemini.starts.map(({ operationId }) => operationId)
  const artifactSetExact = exactArtifactSet({
    expectations,
    files,
    gemini,
    judgeMeter,
    paths,
  })
  const noRetry =
    gemini.coherent &&
    artifactSetExact &&
    gemini.starts.length ===
      expectations.writerOperations + expectations.answerOperations &&
    new Set(operationIds).size === operationIds.length &&
    gemini.starts.every(({ attempt }) => attempt === 1) &&
    judge.noRetry

  const officialJudgeCorrect =
    questionLinked &&
    answerProviderBound &&
    judge.correct &&
    runState?.judge?.status === 'completed' &&
    runState?.judge?.correct === true &&
    questionResult.correct === true &&
    questionResult?.judge?.operationId ===
      expectations.judgeOperationId &&
    questionResult?.judge?.text ===
      runState?.judge?.text &&
    questionResult?.judge?.text === judge.text

  const geminiFreshAccountedUsd = Number((
    gemini.accountedUsd - expectations.openingAccountedUsd
  ).toFixed(12))
  const freshAccountedUsd = Number((
    geminiFreshAccountedUsd + judge.accountedUsd
  ).toFixed(12))
  const cumulativeAccountedUsd = Number((
    expectations.openingAccountedUsd + freshAccountedUsd
  ).toFixed(12))
  const spendCoherent =
    gemini.coherent &&
    judge.coherent &&
    finiteNonNegative(geminiFreshAccountedUsd) &&
    gemini.accountedUsd <=
      expectations.geminiCapUsd + USD_TOLERANCE &&
    expectations.geminiCapUsd <=
      expectations.cumulativeCapUsd + USD_TOLERANCE &&
    expectations.geminiCapUsd <=
      expectations.openingAccountedUsd +
        expectations.freshCapUsd +
        USD_TOLERANCE &&
    sameNumber(
      judge.capContext?.freshAccountedUsd,
      geminiFreshAccountedUsd,
    ) &&
    sameNumber(
      judge.capContext?.cumulativeAccountedUsd,
      gemini.accountedUsd,
    ) &&
    sameNumber(
      judge.capContext?.freshCapUsd,
      expectations.freshCapUsd,
    ) &&
    sameNumber(
      judge.capContext?.cumulativeCapUsd,
      expectations.cumulativeCapUsd,
    ) &&
    sameNumber(
      judge.capContext?.projectedFreshUsd,
      geminiFreshAccountedUsd + judge.reservationUsd,
    ) &&
    sameNumber(
      judge.capContext?.projectedCumulativeUsd,
      gemini.accountedUsd + judge.reservationUsd,
    ) &&
    judge.capContext?.projectedFreshUsd <=
      expectations.freshCapUsd + USD_TOLERANCE &&
    judge.capContext?.projectedCumulativeUsd <=
      expectations.cumulativeCapUsd + USD_TOLERANCE &&
    sameNumber(
      runState?.spend?.openingAccountedUsd,
      expectations.openingAccountedUsd,
    ) &&
    sameNumber(
      runState?.spend?.freshAccountedUsd,
      freshAccountedUsd,
    ) &&
    sameNumber(
      runState?.spend?.cumulativeAccountedUsd,
      cumulativeAccountedUsd,
    )
  const spendWithinEnvelope =
    spendCoherent &&
    freshAccountedUsd <= expectations.freshCapUsd + USD_TOLERANCE &&
    cumulativeAccountedUsd <=
      expectations.cumulativeCapUsd + USD_TOLERANCE

  const privatePaths = Object.keys(files)
  const tracked = new Set(nonEmptyLines(repository.gitLsFilesBytes))
  const ignored = new Set(
    nonEmptyLines(repository.gitCheckIgnoreBytes),
  )
  const privateAndTerminal =
    manifested({
      expectedRunId: expectations.runId,
      files,
      manifestPath: paths.manifest,
      runDirectory: paths.runDirectory,
    }) &&
    privatePaths.every((path) =>
      ignored.has(path) && !tracked.has(path)) &&
    artifactSetExact &&
    gemini.directorySetExact &&
    judge.directorySetExact &&
    ['complete', 'failed'].includes(runState.status) &&
    exactQ1Only

  const observations = Object.freeze({
    ALL_INTERACTIONS_REDUCED:
      checkpointJournal.coherent &&
      checkpointProviderBound &&
      gemini.coherent &&
      writerStarts.length === expectations.writerOperations,
    DIGEST_READY_AND_BOUNDED: digestReadyAndBounded,
    EXACT_Q1_ONLY: exactQ1Only,
    INCREMENTAL_BOUNDARY_HELD:
      incrementalBoundaryHeld &&
      checkpointProviderBound &&
      gemini.coherent,
    NO_RETRY: noRetry,
    OFFICIAL_JUDGE_CORRECT: officialJudgeCorrect,
    ONE_DIGEST_ANSWER: oneDigestAnswer,
    PRIVATE_AND_TERMINAL: privateAndTerminal,
    SPEND_WITHIN_ENVELOPE: spendWithinEnvelope,
  })
  return Object.freeze({
    computed: Object.freeze({
      cumulativeAccountedUsd,
      freshAccountedUsd,
      geminiAccountedUsd: gemini.accountedUsd,
      geminiFreshAccountedUsd,
      judgeAccountedUsd: judge.accountedUsd,
    }),
    observations,
  })
}

export function gradeIncrementalLongMemEvalPredictionsFromEvidence({
  evidenceGraph,
  predictions = INCREMENTAL_LONGMEMEVAL_ORACLE_PREDICTIONS,
} = {}) {
  if (!Array.isArray(predictions) ||
    predictions.length !== PREDICTION_IDS.size ||
    new Set(predictions.map(({ id }) => id)).size !==
      PREDICTION_IDS.size ||
    predictions.some((prediction) =>
      !PREDICTION_IDS.has(prediction?.id) ||
      typeof prediction.predicted !== 'boolean' ||
      typeof prediction.statement !== 'string' ||
      !prediction.statement)) {
    reject(
      'PREDICTIONS_INVALID',
      'Predictions must contain each supported id exactly once.',
    )
  }
  const { computed, observations } =
    auditIncrementalLongMemEvalPredictionEvidence(evidenceGraph)
  const grades = predictions
    .map((prediction) => {
      const observed = observations[prediction.id]
      return Object.freeze({
        id: prediction.id,
        observed,
        outcome: typeof observed !== 'boolean'
          ? 'not_observed'
          : observed === prediction.predicted
            ? 'hit'
            : 'miss',
        predicted: prediction.predicted,
        statement: prediction.statement,
      })
    })
    .sort((left, right) =>
      OUTCOME_RANK[left.outcome] - OUTCOME_RANK[right.outcome])
  return Object.freeze({
    computed,
    grades: Object.freeze(grades),
    observations,
  })
}

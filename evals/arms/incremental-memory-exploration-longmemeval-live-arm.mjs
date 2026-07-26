// Batched incremental-memory LongMemEval adapter with native Gemini tools.
//
// This successor path keeps the canonical replay and reducer boundary from
// the cadence-one arm, but batches reduction and lets the answer model choose
// its own exact journal queries. Importing this module is inert: every
// provider dispatch still goes through the caller-supplied metered function.

import { createHash } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

import {
  ACTIVE_MEMORY_LIMITS,
  ACTIVE_MEMORY_MAX_DIGEST_CHARS,
  ACTIVE_MEMORY_MAX_ITEMS,
  ACTIVE_MEMORY_REDUCER_VERSION,
  MEMORY_EXPLORATION_INSTRUCTIONS,
  MEMORY_EXPLORATION_TOOLS,
  answerWithExploration,
  createPalariBrain,
  ingestChatTurn,
  memoryAnswerSystemInstruction,
  reducePendingTurns,
} from '../../src/index.mjs'
import {
  renderActiveMemoryDigest,
} from '../../src/memory-reducer.mjs'
import {
  assertValidatedActiveBrainGeminiResponse,
} from './active-brain-longmemeval-live-arm.mjs'
import {
  INCREMENTAL_LONGMEMEVAL_HARD_CAP_MODEL,
  INCREMENTAL_LONGMEMEVAL_HARD_CAP_REDUCER_ID,
  INCREMENTAL_LONGMEMEVAL_PALARI_ID,
  INCREMENTAL_LONGMEMEVAL_RESPONSE_SCHEMA,
  INCREMENTAL_LONGMEMEVAL_USER_ID,
  IncrementalLongMemEvalError,
  buildIncrementalLongMemEvalHardCapReducerBody,
  incrementalLongMemEvalExchangePlan,
} from './incremental-memory-longmemeval-live-arm.mjs'

export const INCREMENTAL_LONGMEMEVAL_EXPLORATION_REDUCE_EVERY = 20
export const INCREMENTAL_LONGMEMEVAL_EXPLORATION_BATCH_INTERACTIONS = 20
export const INCREMENTAL_LONGMEMEVAL_EXPLORATION_MAX_REDUCER_DISPATCHES = 27
export const INCREMENTAL_LONGMEMEVAL_EXPLORATION_MAX_TOOL_CALLS = 6
export const INCREMENTAL_LONGMEMEVAL_EXPLORATION_MAX_MODEL_DISPATCHES = 7
export const INCREMENTAL_LONGMEMEVAL_EXPLORATION_MAX_DISPOSITIONS = 40

const EXPLORATION_TOOL_NAMES = new Set(
  MEMORY_EXPLORATION_TOOLS.map(({ name }) => name),
)

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value
  }
  for (const child of Object.values(value)) deepFreeze(child)
  return Object.freeze(value)
}

function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex')
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function exactKeys(value, expected) {
  return value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    sameJson(Object.keys(value).sort(), [...expected].sort())
}

function plainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function clone(value) {
  return structuredClone(value)
}

function nonEmpty(value, label) {
  const text = String(value ?? '').trim()
  if (!text) {
    throw new IncrementalLongMemEvalError(
      'INCREMENTAL_INPUT_INVALID',
      `Incremental exploration requires a non-empty ${label}.`,
    )
  }
  return text
}

function validDate(value, label) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new IncrementalLongMemEvalError(
      'INCREMENTAL_INPUT_INVALID',
      `Incremental exploration requires a valid ${label}.`,
    )
  }
  return date
}

function configError(message) {
  throw new IncrementalLongMemEvalError(
    'INCREMENTAL_EXPLORATION_CONFIG_INVALID',
    message,
  )
}

const explorationResponseSchema = structuredClone(
  INCREMENTAL_LONGMEMEVAL_RESPONSE_SCHEMA,
)
explorationResponseSchema.properties.dispositions.maxItems =
  INCREMENTAL_LONGMEMEVAL_EXPLORATION_MAX_DISPOSITIONS

export const INCREMENTAL_LONGMEMEVAL_EXPLORATION_RESPONSE_SCHEMA =
  deepFreeze(explorationResponseSchema)

export const INCREMENTAL_LONGMEMEVAL_EXPLORATION_REDUCER_GENERATION =
  deepFreeze({
    candidateCount: 1,
    maxOutputTokens: 2_000,
    responseJsonSchema:
      INCREMENTAL_LONGMEMEVAL_EXPLORATION_RESPONSE_SCHEMA,
    responseMimeType: 'application/json',
    thinkingConfig: {
      thinkingBudget: 0,
    },
  })

export const INCREMENTAL_LONGMEMEVAL_EXPLORATION_GENERATION =
  deepFreeze({
    candidateCount: 1,
    maxOutputTokens: 256,
    thinkingConfig: {
      thinkingBudget: 0,
    },
  })

// Keep the product-authored answer and exploration instructions byte-for-byte
// intact. Joining them is provider mapping, not a benchmark-specific hint.
export const INCREMENTAL_LONGMEMEVAL_EXPLORATION_SYSTEM_INSTRUCTION = [
  memoryAnswerSystemInstruction,
  MEMORY_EXPLORATION_INSTRUCTIONS,
].join('\n\n')

export const INCREMENTAL_LONGMEMEVAL_EXPLORATION_TOOLS = deepFreeze([{
  functionDeclarations: MEMORY_EXPLORATION_TOOLS.map((tool) => ({
    description: tool.description,
    name: tool.name,
    parameters: clone(tool.parameters),
  })),
}])

export const INCREMENTAL_LONGMEMEVAL_EXPLORATION_TOOL_CONFIG =
  deepFreeze({
    functionCallingConfig: {
      mode: 'AUTO',
    },
  })

export function buildIncrementalLongMemEvalExplorationReducerBody(
  request,
) {
  const body = buildIncrementalLongMemEvalHardCapReducerBody(request)
  return {
    ...body,
    generationConfig: clone(
      INCREMENTAL_LONGMEMEVAL_EXPLORATION_REDUCER_GENERATION,
    ),
  }
}

function explorationBody(contents) {
  return {
    contents: clone(contents),
    generationConfig: clone(
      INCREMENTAL_LONGMEMEVAL_EXPLORATION_GENERATION,
    ),
    store: false,
    systemInstruction: {
      parts: [{
        text: INCREMENTAL_LONGMEMEVAL_EXPLORATION_SYSTEM_INSTRUCTION,
      }],
    },
    toolConfig: clone(
      INCREMENTAL_LONGMEMEVAL_EXPLORATION_TOOL_CONFIG,
    ),
    tools: clone(INCREMENTAL_LONGMEMEVAL_EXPLORATION_TOOLS),
  }
}

export function buildIncrementalLongMemEvalExplorationInitialBody({
  memoryText,
  questionText,
} = {}) {
  const question = nonEmpty(questionText, 'question text')
  const initialText = [String(memoryText ?? ''), question]
    .filter(Boolean)
    .join('\n\n')
  return explorationBody([{
    parts: [{ text: initialText }],
    role: 'user',
  }])
}

function expectedEvidence(exchange) {
  const evidence = []
  if (exchange.userMessage.trim()) {
    evidence.push({
      observedAt: exchange.eventAt,
      sourceKind: 'user_message',
      sourceMessageId: `${exchange.sourceMessageId}:user`,
      speaker: 'user',
      text: exchange.userMessage,
    })
  }
  if (exchange.assistantMessage.trim()) {
    evidence.push({
      observedAt: exchange.eventAt,
      sourceKind: 'assistant_message',
      sourceMessageId: `${exchange.sourceMessageId}:assistant`,
      speaker: 'Palari',
      text: exchange.assistantMessage,
    })
  }
  return evidence
}

function reducerEvidenceKey(entry) {
  return JSON.stringify([
    String(entry?.observedAt ?? ''),
    String(entry?.speaker ?? ''),
    String(entry?.text ?? ''),
  ])
}

function assertReducerRequest({
  brain,
  currentInteraction,
  exchanges,
  request,
  unit,
}) {
  const input = request?.input
  const evidence = input?.evidence
  const prior = input?.prior
  const visible = exchanges
    .slice(0, currentInteraction)
    .flatMap(expectedEvidence)
  let visibleCursor = 0
  const evidenceIsChronological =
    Array.isArray(evidence) &&
    evidence.length >= 1 &&
    evidence.length <=
      INCREMENTAL_LONGMEMEVAL_EXPLORATION_MAX_DISPOSITIONS &&
    evidence.every((entry) => {
      if (!exactKeys(entry, ['id', 'observedAt', 'speaker', 'text']) ||
        typeof entry.id !== 'string' ||
        !entry.id) {
        return false
      }
      const key = reducerEvidenceKey(entry)
      while (visibleCursor < visible.length &&
        reducerEvidenceKey(visible[visibleCursor]) !== key) {
        visibleCursor += 1
      }
      if (visibleCursor >= visible.length) return false
      visibleCursor += 1
      return true
    })
  const boundedPrior =
    Array.isArray(prior) &&
    prior.length <= ACTIVE_MEMORY_MAX_ITEMS &&
    prior.every((entry) => exactKeys(entry, [
      'epistemic',
      'id',
      'observedAt',
      'speaker',
      'statement',
      'timeBasis',
      'topic',
    ]))
  const digest = brain.digestStatus({
    palariId: INCREMENTAL_LONGMEMEVAL_PALARI_ID,
    userId: INCREMENTAL_LONGMEMEVAL_USER_ID,
  })

  if (!exactKeys(request, [
    'contractVersion',
    'input',
    'systemInstructions',
  ]) ||
    request.contractVersion !== ACTIVE_MEMORY_REDUCER_VERSION ||
    !exactKeys(input, [
      'baseRevision',
      'evidence',
      'limits',
      'prior',
      'utilization',
    ]) ||
    input.baseRevision !== digest.digestRevision ||
    !sameJson(input.limits, ACTIVE_MEMORY_LIMITS) ||
    !exactKeys(input.utilization, [
      'digestChars',
      'digestCharsRemaining',
      'items',
      'itemsRemaining',
    ]) ||
    input.utilization.items !== prior?.length ||
    input.utilization.items + input.utilization.itemsRemaining !==
      ACTIVE_MEMORY_LIMITS.maxItems ||
    input.utilization.digestChars +
      input.utilization.digestCharsRemaining !==
      ACTIVE_MEMORY_LIMITS.maxDigestChars ||
    !evidenceIsChronological ||
    !boundedPrior ||
    !Number.isSafeInteger(unit?.unitOrder) ||
    unit.unitOrder < 1 ||
    unit.unitOrder > currentInteraction ||
    unit.sourceRevision !== currentInteraction) {
    throw new IncrementalLongMemEvalError(
      'INCREMENTAL_REDUCER_BOUNDARY',
      `Batched reducer dispatch escaped the canonical boundary at interaction ${currentInteraction}.`,
    )
  }
}

function activeMemorySnapshot(memories) {
  return renderActiveMemoryDigest(memories).included.map((memory) => ({
    epistemic: memory.epistemic,
    id: memory.id,
    observedAt: memory.observedAt,
    reducerId: memory.reducerId,
    speaker: memory.speaker,
    statement: memory.statement,
    supports: memory.supports,
    timeBasis: memory.timeBasis,
    topic: memory.topic,
  }))
}

function blockedSnapshot(units) {
  return units.map((unit) => ({
    attempts: Number(unit.attempts),
    blockedAt: String(unit.blockedAt ?? ''),
    blockedCategory: String(unit.blockedCategory ?? ''),
    lastErrorCategory: String(unit.lastErrorCategory ?? ''),
    sourceRevision: Number(unit.sourceRevision),
    unitOrder: Number(unit.unitOrder),
  }))
}

function assertCanonicalInteraction({
  brain,
  exchange,
  expectedCanonicalRows,
  ordinal,
  result,
  scope,
}) {
  const expectedWrites = expectedEvidence(exchange).length
  if (result?.status !== 'completed' ||
    result.evidenceWritten !== expectedWrites ||
    result.written?.length !== expectedWrites ||
    result.externalSourcesIgnored !== exchange.sourceTexts.length ||
    result.indexStatus !== 'skipped' ||
    result.indexReason !== 'extractor_missing' ||
    result.indexSelected !== 0 ||
    result.indexWritten !== 0 ||
    brain.listStatements(scope).length !== expectedCanonicalRows ||
    brain.listIndexEntries(scope).length !== 0) {
    throw new IncrementalLongMemEvalError(
      'INCREMENTAL_REPLAY_INCOMPLETE',
      `Interaction ${ordinal} did not commit its complete canonical dialogue.`,
    )
  }
}

function assertCompleteCanonicalReplay(brain, exchanges, scope) {
  const expected = exchanges.flatMap(expectedEvidence)
  const actual = brain.listStatements(scope)
  const exact = actual.length === expected.length &&
    actual.every((row, index) =>
      row.content === expected[index].text &&
      row.event_at === expected[index].observedAt &&
      row.source_kind === expected[index].sourceKind &&
      row.source_message_id === expected[index].sourceMessageId)
  if (!exact || brain.listIndexEntries(scope).length !== 0) {
    throw new IncrementalLongMemEvalError(
      'INCREMENTAL_REPLAY_INCOMPLETE',
      'Incremental exploration did not replay the exact canonical journal.',
    )
  }
  return actual.length
}

function assertFunctionCall(value) {
  const expectedKeys = Object.hasOwn(value ?? {}, 'id')
    ? ['args', 'id', 'name']
    : ['args', 'name']
  if (!plainObject(value) ||
    !sameJson(Object.keys(value).sort(), expectedKeys) ||
    !EXPLORATION_TOOL_NAMES.has(value.name) ||
    !plainObject(value.args) ||
    (Object.hasOwn(value, 'id') &&
      (typeof value.id !== 'string' || !value.id.trim()))) {
    throw new IncrementalLongMemEvalError(
      'INCREMENTAL_EXPLORATION_RESPONSE_INVALID',
      'Gemini returned an unknown or malformed memory function call.',
    )
  }
}

function candidateParts(content) {
  if (!exactKeys(content, ['parts', 'role']) ||
    content.role !== 'model' ||
    !Array.isArray(content.parts) ||
    content.parts.length < 1) {
    throw new IncrementalLongMemEvalError(
      'INCREMENTAL_EXPLORATION_RESPONSE_INVALID',
      'Gemini returned malformed exploration candidate content.',
    )
  }
  const functionCalls = []
  const visibleText = []
  for (const part of content.parts) {
    if (!plainObject(part)) {
      throw new IncrementalLongMemEvalError(
        'INCREMENTAL_EXPLORATION_RESPONSE_INVALID',
        'Gemini returned a malformed exploration content part.',
      )
    }
    if (Object.hasOwn(part, 'functionCall')) {
      const expectedPartKeys =
        Object.hasOwn(part, 'thoughtSignature')
          ? ['functionCall', 'thoughtSignature']
          : ['functionCall']
      assertFunctionCall(part.functionCall)
      if (!sameJson(Object.keys(part).sort(), expectedPartKeys) ||
        (Object.hasOwn(part, 'thoughtSignature') &&
          (typeof part.thoughtSignature !== 'string' ||
            !part.thoughtSignature.trim()))) {
        throw new IncrementalLongMemEvalError(
          'INCREMENTAL_EXPLORATION_RESPONSE_INVALID',
          'Gemini returned a malformed memory function-call part.',
        )
      }
      functionCalls.push(clone(part.functionCall))
      continue
    }
    if (typeof part.text !== 'string' ||
      (Object.hasOwn(part, 'thought') &&
        part.thought !== false) ||
      (Object.hasOwn(part, 'thoughtSignature') &&
        (typeof part.thoughtSignature !== 'string' ||
          !part.thoughtSignature.trim())) ||
      (Object.hasOwn(part, 'partMetadata') &&
        !plainObject(part.partMetadata)) ||
      Object.keys(part).some((key) => ![
        'partMetadata',
        'text',
        'thought',
        'thoughtSignature',
      ].includes(key))) {
      throw new IncrementalLongMemEvalError(
        'INCREMENTAL_EXPLORATION_RESPONSE_INVALID',
        'Gemini returned a malformed exploration text part.',
      )
    }
    visibleText.push(part.text)
  }
  return {
    functionCalls,
    visibleText: visibleText.join('').trim(),
  }
}

function assertExplorationResponse(response, expectedModel) {
  if (response?.validated !== true ||
    response.finishReason !== 'STOP' ||
    response.modelVersion !== expectedModel ||
    !['final_text', 'function_calls'].includes(
      response.responseType,
    ) ||
    !Array.isArray(response.functionCalls) ||
    !exactKeys(response.candidateContent, ['parts', 'role'])) {
    throw new IncrementalLongMemEvalError(
      'INCREMENTAL_EXPLORATION_RESPONSE_INVALID',
      'Gemini returned an unvalidated exploration response.',
    )
  }

  const candidate = candidateParts(response.candidateContent)
  if (response.responseType === 'function_calls') {
    for (const functionCall of response.functionCalls) {
      assertFunctionCall(functionCall)
    }
    if (response.text !== null ||
      response.functionCalls.length < 1 ||
      !sameJson(candidate.functionCalls, response.functionCalls)) {
      throw new IncrementalLongMemEvalError(
        'INCREMENTAL_EXPLORATION_RESPONSE_INVALID',
        'Gemini altered or omitted a memory function-call batch.',
      )
    }
  } else {
    if (response.functionCalls.length !== 0 ||
      candidate.functionCalls.length !== 0 ||
      typeof response.text !== 'string' ||
      !response.text.trim() ||
      candidate.visibleText !== response.text) {
      throw new IncrementalLongMemEvalError(
        'INCREMENTAL_EXPLORATION_RESPONSE_INVALID',
        'Gemini returned malformed final exploration text.',
      )
    }
  }
  return response
}

function functionResponsePart(functionCall, result) {
  const response = {
    name: functionCall.name,
    response: clone(result),
  }
  if (Object.hasOwn(functionCall, 'id')) {
    response.id = functionCall.id
  }
  return { functionResponse: response }
}

function functionResponseContent(functionCalls, results) {
  return {
    parts: functionCalls.map((functionCall, index) =>
      functionResponsePart(functionCall, results[index])),
    role: 'user',
  }
}

function validateFrozenLimits({
  maxAnswerModelDispatches,
  maxExplorationCalls,
  maxInteractionsPerCall,
  maxReducerDispatches,
  reduceEvery,
}) {
  const expected = [
    [
      reduceEvery,
      INCREMENTAL_LONGMEMEVAL_EXPLORATION_REDUCE_EVERY,
      'reduceEvery',
    ],
    [
      maxInteractionsPerCall,
      INCREMENTAL_LONGMEMEVAL_EXPLORATION_BATCH_INTERACTIONS,
      'maxInteractionsPerCall',
    ],
    [
      maxReducerDispatches,
      INCREMENTAL_LONGMEMEVAL_EXPLORATION_MAX_REDUCER_DISPATCHES,
      'maxReducerDispatches',
    ],
    [
      maxExplorationCalls,
      INCREMENTAL_LONGMEMEVAL_EXPLORATION_MAX_TOOL_CALLS,
      'maxExplorationCalls',
    ],
    [
      maxAnswerModelDispatches,
      INCREMENTAL_LONGMEMEVAL_EXPLORATION_MAX_MODEL_DISPATCHES,
      'maxAnswerModelDispatches',
    ],
  ]
  for (const [actual, frozen, label] of expected) {
    if (actual !== frozen) {
      configError(
        `${label} must equal the frozen exploration value ${frozen}.`,
      )
    }
  }
}

export async function runIncrementalLongMemEvalQuestionWithExploration({
  callGemini,
  instance,
  maxAnswerModelDispatches =
    INCREMENTAL_LONGMEMEVAL_EXPLORATION_MAX_MODEL_DISPATCHES,
  maxExplorationCalls =
    INCREMENTAL_LONGMEMEVAL_EXPLORATION_MAX_TOOL_CALLS,
  maxInteractionsPerCall =
    INCREMENTAL_LONGMEMEVAL_EXPLORATION_BATCH_INTERACTIONS,
  maxReducerDispatches =
    INCREMENTAL_LONGMEMEVAL_EXPLORATION_MAX_REDUCER_DISPATCHES,
  onCheckpoint = async () => {},
  onExplorationCheckpoint = async () => {},
  reduceEvery = INCREMENTAL_LONGMEMEVAL_EXPLORATION_REDUCE_EVERY,
  workspaceDir,
} = {}) {
  if (typeof callGemini !== 'function') {
    throw new TypeError(
      'Incremental exploration requires a metered Gemini caller.',
    )
  }
  if (!instance?.questionId ||
    typeof workspaceDir !== 'string' ||
    !workspaceDir) {
    throw new TypeError(
      'Incremental exploration requires one instance and private workspace.',
    )
  }
  if (typeof onCheckpoint !== 'function') {
    throw new TypeError(
      'Incremental exploration checkpoint must be a function.',
    )
  }
  if (typeof onExplorationCheckpoint !== 'function') {
    throw new TypeError(
      'Incremental exploration progress checkpoint must be a function.',
    )
  }
  validateFrozenLimits({
    maxAnswerModelDispatches,
    maxExplorationCalls,
    maxInteractionsPerCall,
    maxReducerDispatches,
    reduceEvery,
  })

  const questionId = nonEmpty(instance.questionId, 'questionId')
  const question = nonEmpty(instance.question, 'question')
  const exchanges = incrementalLongMemEvalExchangePlan(instance)
  if (!exchanges.length) {
    throw new IncrementalLongMemEvalError(
      'INCREMENTAL_INPUT_INVALID',
      'Incremental exploration requires visible interactions.',
    )
  }
  await mkdir(workspaceDir, { recursive: true, mode: 0o700 })

  let replayClock = new Date(0)
  const brain = await createPalariBrain({
    clock: () => new Date(replayClock),
    memoryEnabled: true,
    statePath: join(workspaceDir, 'workspace-state.json'),
    workspaceId: `incremental-longmemeval-exploration-${questionId}`,
  })
  if (!brain.enabled) {
    throw new IncrementalLongMemEvalError(
      'INCREMENTAL_BRAIN_DISABLED',
      'Incremental exploration requires the supported SQLite runtime.',
    )
  }

  const scope = {
    palariId: INCREMENTAL_LONGMEMEVAL_PALARI_ID,
    userId: INCREMENTAL_LONGMEMEVAL_USER_ID,
  }
  const interactionCheckpoints = []
  const reducerEvidence = []
  const modelTurns = []
  const providerToolTranscript = []
  let answerBriefing = null
  let answerModelDispatches = 0
  let canonicalRows = 0
  let checkpointReducerCursor = 0
  let currentInteraction = 0
  let explorationExhausted = false
  let latestExplorationCheckpoint = null
  let progressCheckpointFailure = null
  let reducerCeilingFailure = null
  let reducerDispatches = 0
  let tailDrain = null

  const explorationCheckpoint = async (phase) => {
    const checkpoint = {
      answerModelDispatches,
      explorationCalls: providerToolTranscript.length,
      explorationExhausted,
      modelTurns: clone(modelTurns),
      phase,
      questionId,
      toolTranscript: clone(providerToolTranscript),
    }
    latestExplorationCheckpoint = clone(checkpoint)
    try {
      await onExplorationCheckpoint(clone(checkpoint))
    } catch (error) {
      progressCheckpointFailure = error
      throw error
    }
  }

  const attachExplorationPartial = (error) => {
    if (!error || typeof error !== 'object') return
    const partial = {
      answerModelDispatches,
      explorationCalls: providerToolTranscript.length,
      explorationExhausted,
      modelTurns: clone(modelTurns),
      phase: latestExplorationCheckpoint?.phase === 'failure'
        ? 'failure'
        : answerModelDispatches > modelTurns.length
        ? 'model_dispatch_failed'
        : latestExplorationCheckpoint?.phase ?? 'not_started',
      questionId,
      toolTranscript: clone(providerToolTranscript),
    }
    try {
      error.explorationPartial = clone(partial)
    } catch {
      // Preserve the original failure if it is not extensible.
    }
  }

  const reducer = async ({ request, unit }) => {
    assertReducerRequest({
      brain,
      currentInteraction,
      exchanges,
      request,
      unit,
    })
    if (reducerDispatches >= maxReducerDispatches) {
      reducerCeilingFailure ??= new IncrementalLongMemEvalError(
        'INCREMENTAL_REDUCER_DISPATCH_LIMIT',
        `Incremental exploration refused reducer dispatch ${maxReducerDispatches + 1}.`,
      )
      throw reducerCeilingFailure
    }

    reducerDispatches += 1
    const dispatch = reducerDispatches
    const body =
      buildIncrementalLongMemEvalExplorationReducerBody(request)
    const event = {
      dispatch,
      errorCategory: null,
      evidenceIds: request.input.evidence.map(({ id }) => id),
      modelVersion: null,
      operationId: `question:${questionId}:reducer:${dispatch}`,
      requestSha256: sha256(JSON.stringify(body)),
      responseSha256: null,
      sourceRevision: unit.sourceRevision,
      status: 'dispatched',
      unitOrder: unit.unitOrder,
    }
    reducerEvidence.push(event)
    try {
      const response = assertValidatedActiveBrainGeminiResponse(
        await callGemini({
          body,
          cellId: questionId,
          operationId: event.operationId,
          purpose: 'writer',
        }),
        `incremental exploration reducer ${dispatch}`,
      )
      if (response.modelVersion !==
        INCREMENTAL_LONGMEMEVAL_HARD_CAP_MODEL) {
        throw new IncrementalLongMemEvalError(
          'INCREMENTAL_MODEL_MISMATCH',
          'Incremental exploration reducer returned an unexpected modelVersion.',
        )
      }
      event.modelVersion = response.modelVersion
      event.responseSha256 = sha256(response.text)
      event.status = 'validated'
      return response.text
    } catch (error) {
      event.errorCategory = String(
        error?.code ?? error?.category ?? 'reducer_error',
      )
      event.status = 'failed'
      throw error
    }
  }

  try {
    for (let index = 0; index < exchanges.length; index += 1) {
      const exchange = exchanges[index]
      const ordinal = index + 1
      currentInteraction = ordinal
      replayClock = validDate(exchange.eventAt, 'exchange eventAt')

      const result = await ingestChatTurn(brain, {
        assistantMessage: exchange.assistantMessage,
        eventAt: exchange.eventAt,
        palariId: scope.palariId,
        retention: 'durable',
        sourceMessageId: exchange.sourceMessageId,
        sourceTexts: exchange.sourceTexts,
        userId: scope.userId,
        userMessage: exchange.userMessage,
      }, {
        maxAttempts: 1,
        maxInteractionsPerCall,
        reduceEvery,
        reducer,
        reducerId: INCREMENTAL_LONGMEMEVAL_HARD_CAP_REDUCER_ID,
      })

      canonicalRows += expectedEvidence(exchange).length
      assertCanonicalInteraction({
        brain,
        exchange,
        expectedCanonicalRows: canonicalRows,
        ordinal,
        result,
        scope,
      })
      if (reducerCeilingFailure) throw reducerCeilingFailure

      // The last cadence bucket is intentionally smaller than twenty. Drain
      // it before writing the final interaction receipt so checkpoint 243
      // proves that the whole digest has caught up.
      if (ordinal === exchanges.length) {
        tailDrain = await reducePendingTurns(brain, {
          ...scope,
          maxAttempts: 1,
          maxInteractionsPerCall,
          maxTurns: 10_000,
          reducer,
          reducerId: INCREMENTAL_LONGMEMEVAL_HARD_CAP_REDUCER_ID,
        })
        if (reducerCeilingFailure) throw reducerCeilingFailure
      }

      const memories = brain.listActiveMemories(scope)
      const activeMemories = activeMemorySnapshot(memories)
      const digest = brain.digestStatus(scope)
      const checkpoint = {
        activeMemories,
        activeMemoriesSha256: sha256(JSON.stringify(activeMemories)),
        completedInteraction: ordinal,
        digest: { ...digest },
        digestChars: renderActiveMemoryDigest(memories).text.length,
        evidenceWritten: result.evidenceWritten,
        interactionCount: exchanges.length,
        quarantinedUnits: blockedSnapshot(
          brain.listBlockedReductions(scope),
        ),
        reducerDispatches,
        reducerEvents: clone(
          reducerEvidence.slice(checkpointReducerCursor),
        ),
        representedTurnIndexes:
          [...exchange.representedTurnIndexes],
        representedTurns: exchange.representedTurns,
        sessionId: exchange.sessionId,
        sourceMessageId: exchange.sourceMessageId,
        status: 'completed',
        unitOrder: ordinal,
      }
      checkpointReducerCursor = reducerEvidence.length
      interactionCheckpoints.push(checkpoint)
      await onCheckpoint(clone(checkpoint))
    }
    currentInteraction = 0

    canonicalRows = assertCompleteCanonicalReplay(
      brain,
      exchanges,
      scope,
    )
    const finalDigest = brain.digestStatus(scope)
    const finalMemories = activeMemorySnapshot(
      brain.listActiveMemories(scope),
    )
    const quarantinedUnits = blockedSnapshot(
      brain.listBlockedReductions(scope),
    )
    if (!tailDrain ||
      finalDigest.ready !== true ||
      finalDigest.pending !== 0 ||
      finalDigest.sourceRevision !== exchanges.length ||
      finalDigest.builtFromRevision !== exchanges.length ||
      finalDigest.canonicalRows !== canonicalRows ||
      finalDigest.reducerId !==
        INCREMENTAL_LONGMEMEVAL_HARD_CAP_REDUCER_ID ||
      reducerDispatches > maxReducerDispatches) {
      throw new IncrementalLongMemEvalError(
        'INCREMENTAL_REDUCTION_FAILED',
        'Batched exploration did not finish the canonical reduction queue.',
      )
    }

    let answerResult
    try {
      answerResult = await answerWithExploration(brain, {
        maxChars: ACTIVE_MEMORY_MAX_DIGEST_CHARS,
        maxExplorationCalls,
        palariId: scope.palariId,
        provider: async ({
          briefing,
          explore,
          explorationInstructions,
          explorationTools,
          memoryText,
          questionText,
          systemInstruction,
        }) => {
          if (systemInstruction !== memoryAnswerSystemInstruction ||
            explorationInstructions !==
              MEMORY_EXPLORATION_INSTRUCTIONS ||
            !sameJson(explorationTools, MEMORY_EXPLORATION_TOOLS)) {
            throw new IncrementalLongMemEvalError(
              'INCREMENTAL_EXPLORATION_BOUNDARY',
              'The product exploration contract changed before provider mapping.',
            )
          }
          answerBriefing = clone(briefing)
          const initialBody =
            buildIncrementalLongMemEvalExplorationInitialBody({
              memoryText,
              questionText,
            })
          const contents = clone(initialBody.contents)

          while (answerModelDispatches < maxAnswerModelDispatches) {
            answerModelDispatches += 1
            const dispatch = answerModelDispatches
            const operationId =
              `question:${questionId}:explore:${dispatch}`
            const body = explorationBody(contents)
            const response = assertExplorationResponse(
              await callGemini({
                body,
                cellId: questionId,
                operationId,
                purpose: 'explore',
              }),
              INCREMENTAL_LONGMEMEVAL_HARD_CAP_MODEL,
            )
            modelTurns.push({
              candidateContent: clone(response.candidateContent),
              dispatch,
              functionCalls: clone(response.functionCalls),
              modelVersion: response.modelVersion,
              operationId,
              requestSha256: sha256(JSON.stringify(body)),
              responseType: response.responseType,
              text: response.text,
            })

            const remainingToolCalls =
              maxExplorationCalls - providerToolTranscript.length
            explorationExhausted =
              response.responseType === 'function_calls' &&
              (dispatch >= maxAnswerModelDispatches ||
                response.functionCalls.length > remainingToolCalls)
            await explorationCheckpoint('model_turn')

            if (response.responseType === 'final_text') {
              return { text: response.text }
            }

            // Six calls consume turns 1..6 and turn 7 is reserved for the
            // answer. If turn 7 asks again, do not execute it and never issue
            // an eighth provider dispatch. A parallel batch is atomic at the
            // budget boundary: if all calls do not fit, execute none.
            if (explorationExhausted) {
              await explorationCheckpoint('failure')
              throw new IncrementalLongMemEvalError(
                'INCREMENTAL_EXPLORATION_BUDGET_EXHAUSTED',
                'Gemini requested a memory tool batch outside the frozen exploration budget.',
              )
            }

            const functionCalls = clone(response.functionCalls)
            const toolResults = []
            for (const functionCall of functionCalls) {
              const toolResult = await explore({
                input: functionCall.args,
                tool: functionCall.name,
              })
              if (toolResult?.exhausted === true) {
                explorationExhausted = true
                await explorationCheckpoint('failure')
                throw new IncrementalLongMemEvalError(
                  'INCREMENTAL_EXPLORATION_BUDGET_EXHAUSTED',
                  'The product exploration budget was exhausted.',
                )
              }
              toolResults.push(clone(toolResult))
              providerToolTranscript.push({
                input: clone(functionCall.args),
                result: clone(toolResult),
                tool: functionCall.name,
                modelDispatch: dispatch,
              })
            }
            await explorationCheckpoint('tool_batch')
            // Preserve the exact model content, including opaque thought
            // signatures, then bind every ordered local result to the same
            // call ID in one user response content.
            contents.push(clone(response.candidateContent))
            contents.push(
              functionResponseContent(functionCalls, toolResults),
            )
          }

          explorationExhausted = true
          await explorationCheckpoint('failure')
          throw new IncrementalLongMemEvalError(
            'INCREMENTAL_EXPLORATION_BUDGET_EXHAUSTED',
            'Gemini did not answer within the frozen model-dispatch budget.',
          )
        },
        question,
        questionDate: instance.questionDate,
        userId: scope.userId,
      })
    } catch (error) {
      if (error !== progressCheckpointFailure &&
        latestExplorationCheckpoint?.phase !== 'failure') {
        try {
          await explorationCheckpoint('failure')
        } catch (checkpointError) {
          attachExplorationPartial(checkpointError)
          throw checkpointError
        }
      }
      attachExplorationPartial(error)
      throw error
    }

    if (answerResult.providerCalled !== true ||
      answerResult.explorationCalls > maxExplorationCalls ||
      answerResult.explorationExhausted !== false ||
      answerModelDispatches > maxAnswerModelDispatches ||
      !sameJson(
        answerResult.explorationTranscript,
        providerToolTranscript.map(({
          modelDispatch: _modelDispatch,
          ...entry
        }) => entry),
      ) ||
      !answerResult.answer.trim()) {
      throw new IncrementalLongMemEvalError(
        'INCREMENTAL_ANSWER_INVALID',
        'Incremental exploration did not produce one bounded answer.',
      )
    }

    const digestText = renderActiveMemoryDigest(
      brain.listActiveMemories(scope),
    ).text
    return {
      activeMemories: finalMemories,
      activeMemoriesSha256:
        sha256(JSON.stringify(finalMemories)),
      answer: answerResult.answer,
      answerModelVersion: INCREMENTAL_LONGMEMEVAL_HARD_CAP_MODEL,
      answerProviderCalled: true,
      answerRequestSha256:
        modelTurns[0]?.requestSha256 ?? null,
      briefing: {
        mode: answerResult.briefingMode,
        status: answerResult.briefingStatus,
        totalCandidates:
          Number(answerBriefing?.totalCandidates ?? 0),
      },
      canonicalRows,
      consultedEvidenceIds:
        [...answerResult.consultedEvidenceIds],
      digestChars: digestText.length,
      digestItems: finalMemories.length,
      digestStatus: finalDigest,
      exchangePlanSha256: sha256(JSON.stringify(exchanges)),
      explorationCalls: answerResult.explorationCalls,
      explorationExhausted:
        answerResult.explorationExhausted,
      ingestionPredictionMiss: quarantinedUnits.length > 0,
      interactionCheckpoints,
      interactions: exchanges.length,
      logicalOperations: {
        answerModel: answerModelDispatches,
        provider: reducerDispatches + answerModelDispatches,
        reducer: reducerDispatches,
        tools: answerResult.explorationCalls,
      },
      modelTurns,
      modelVersion: INCREMENTAL_LONGMEMEVAL_HARD_CAP_MODEL,
      quarantinedUnits,
      quarantineStats: {
        categories: quarantinedUnits.map(
          ({ blockedCategory }) => blockedCategory,
        ),
        count: quarantinedUnits.length,
        predictionMiss: quarantinedUnits.length > 0,
      },
      questionId,
      rawTurns: exchanges.reduce(
        (total, exchange) => total + exchange.representedTurns,
        0,
      ),
      reducerEvidence: clone(reducerEvidence),
      tailDrain: clone(tailDrain),
      toolTranscript: clone(providerToolTranscript),
    }
  } finally {
    brain.close()
  }
}

// J4 Palari-only LongMemEval adapter.
//
// This is intentionally separate from the closed J3 arm. It reuses the real
// gate/store/recall product path while enforcing J4's per-turn schema stop,
// chronological replay, official fact-memory answer prompt, and source-session
// diagnostics.

import { Buffer } from 'node:buffer'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

import { ingestChatTurn } from '../../src/adapter.mjs'
import { createGatedStore } from '../../src/gate.mjs'
import {
  normalizeMemoryExtractionPayload,
} from '../../src/memory-extraction.mjs'
import {
  externalMemorySourceKinds,
  memoryTypes,
} from '../../src/memory-store.mjs'
import { recallAndBrief } from '../../src/recall.mjs'
import { createKernelStore } from '../../src/store.mjs'
import {
  buildJ4AnswerBody,
  buildJ4AnswerPrompt,
  buildJ4WriterBody,
  J4_GEMINI_MODEL,
  j4Sha256,
} from '../longmemeval-live-config.mjs'
import { J4LiveError } from '../longmemeval-live-meter.mjs'

export const J4_PALARI_ID = 'palari-longmemeval-j4'
export const J4_USER_ID = 'user-longmemeval-j4'
export const J4_RECALL_CONTEXT_BUDGET = 12
export const J4_RECALL_MAX_CHARS = 1_800

function validDate(value, label) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new J4LiveError(
      'REPLAY_DATE_INVALID',
      `J4 requires a valid ${label}.`,
    )
  }
  return date
}

export function chronologicalJ4SessionOccurrences(instance = {}) {
  return (instance.sessions ?? [])
    .map((session, occurrenceOrdinal) => ({ occurrenceOrdinal, session }))
    .sort((left, right) => {
      const dateDelta =
        validDate(left.session.eventAt, 'session eventAt').getTime() -
        validDate(right.session.eventAt, 'session eventAt').getTime()
      return dateDelta || left.occurrenceOrdinal - right.occurrenceOrdinal
    })
}

export function chronologicalJ4Sessions(instance = {}) {
  return chronologicalJ4SessionOccurrences(instance)
    .map(({ session }) => session)
}

const J4_SOURCE_MESSAGE_PREFIX = 'j4-source-message:v1:'

export function j4SourceSessionOccurrenceId({
  occurrenceOrdinal,
  sessionId,
} = {}) {
  if (typeof sessionId !== 'string' || !sessionId ||
    !Number.isSafeInteger(occurrenceOrdinal) || occurrenceOrdinal < 0) {
    throw new J4LiveError(
      'SOURCE_ID_INVALID',
      'J4 source identity requires a session ID and non-negative occurrence ordinal.',
    )
  }
  const encodedSessionId = Buffer.from(sessionId, 'utf8').toString('base64url')
  return `${J4_SOURCE_MESSAGE_PREFIX}${encodedSessionId}:${occurrenceOrdinal}`
}

export function j4SourceMessageId({
  occurrenceOrdinal,
  sessionId,
  turnIndex,
} = {}) {
  if (!Number.isSafeInteger(turnIndex) || turnIndex < 0) {
    throw new J4LiveError(
      'SOURCE_ID_INVALID',
      'J4 source identity requires a non-negative turn ordinal.',
    )
  }
  return `${j4SourceSessionOccurrenceId({
    occurrenceOrdinal,
    sessionId,
  })}:${turnIndex}`
}

export function j4SourceSessionId(value) {
  const text = String(value ?? '')
  if (!text.startsWith(J4_SOURCE_MESSAGE_PREFIX)) return ''
  const envelope = text.slice(J4_SOURCE_MESSAGE_PREFIX.length)
  const match = /^([A-Za-z0-9_-]+):(0|[1-9]\d*):(0|[1-9]\d*)(?::(?:user|assistant))?$/.exec(envelope)
  if (!match) return ''
  try {
    const sessionId = Buffer.from(match[1], 'base64url').toString('utf8')
    return sessionId &&
      Buffer.from(sessionId, 'utf8').toString('base64url') === match[1]
      ? sessionId
      : ''
  } catch {
    return ''
  }
}

function orderedUnique(values) {
  const seen = new Set()
  const output = []
  for (const value of values) {
    if (!value || seen.has(value)) continue
    seen.add(value)
    output.push(value)
  }
  return output
}

export function assertValidatedJ4GeminiResponse(response, purpose) {
  const usageFields = [
    'geminiInputTokens',
    'geminiOutputTokens',
    'judgeInputTokens',
    'judgeOutputTokens',
    'usd',
  ]
  if (response?.validated !== true ||
    response.finishReason !== 'STOP' ||
    typeof response.modelVersion !== 'string' ||
    !response.modelVersion.trim() ||
    typeof response.text !== 'string' ||
    !response.text.trim() ||
    !response.usage ||
    usageFields.some((field) =>
      !Number.isFinite(response.usage[field]) || response.usage[field] < 0) ||
    response.usage.judgeInputTokens !== 0 ||
    response.usage.judgeOutputTokens !== 0 ||
    !Number.isSafeInteger(response.usageDetails?.candidateTokens) ||
    response.usageDetails.candidateTokens < 0 ||
    !Number.isSafeInteger(response.usageDetails?.thoughtTokens) ||
    response.usageDetails.thoughtTokens < 0) {
    throw new J4LiveError(
      'GEMINI_RESULT_UNVALIDATED',
      `J4 ${purpose} requires a fully validated Gemini transport result.`,
    )
  }
  return response
}

export function assertExactExtractionEnvelope(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new J4LiveError(
      'EXTRACTION_PAYLOAD_INVALID',
      'J4 extraction returned no JSON text.',
    )
  }
  let parsed
  try {
    parsed = JSON.parse(value)
  } catch (error) {
    throw new J4LiveError(
      'EXTRACTION_PAYLOAD_INVALID',
      'J4 extraction returned malformed JSON.',
      { cause: error },
    )
  }
  if (!parsed ||
    typeof parsed !== 'object' ||
    Array.isArray(parsed) ||
    Object.keys(parsed).length !== 1 ||
    !Object.hasOwn(parsed, 'memories') ||
    !Array.isArray(parsed.memories) ||
    parsed.memories.length > 6) {
    throw new J4LiveError(
      'EXTRACTION_PAYLOAD_INVALID',
      'J4 extraction JSON must be an object with a memories array.',
    )
  }
  const candidateKeys = [
    'confidence',
    'content',
    'fictional',
    'importance',
    'keywords',
    'shared',
    'sourceKind',
    'type',
  ]
  for (const candidate of parsed.memories) {
    if (!candidate ||
      typeof candidate !== 'object' ||
      Array.isArray(candidate) ||
      JSON.stringify(Object.keys(candidate).sort()) !==
        JSON.stringify(candidateKeys)) {
      throw new J4LiveError(
        'EXTRACTION_PAYLOAD_INVALID',
        'Every J4 extraction candidate must have the exact frozen fields.',
      )
    }
    if (!memoryTypes.has(candidate.type) ||
      typeof candidate.content !== 'string' ||
      !candidate.content.trim() ||
      candidate.content.length > 600 ||
      !Array.isArray(candidate.keywords) ||
      candidate.keywords.length > 10 ||
      candidate.keywords.some((entry) =>
        typeof entry !== 'string' || !entry.trim()) ||
      !Number.isFinite(candidate.importance) ||
      candidate.importance < 0 ||
      candidate.importance > 1 ||
      !Number.isFinite(candidate.confidence) ||
      candidate.confidence < 0 ||
      candidate.confidence > 1 ||
      candidate.shared !== false ||
      typeof candidate.fictional !== 'boolean' ||
      typeof candidate.sourceKind !== 'string' ||
      !new Set(['user_message', ...externalMemorySourceKinds])
        .has(candidate.sourceKind)) {
      throw new J4LiveError(
        'EXTRACTION_PAYLOAD_INVALID',
        'A J4 extraction candidate has an invalid frozen field value.',
      )
    }
  }
  // Candidate validation must happen before the product path can turn a bad
  // payload into a zero-write observation.
  normalizeMemoryExtractionPayload(parsed)
  return parsed
}

export function buildJ4WriterRepairBody({
  error,
  invalidText,
  originalBody,
} = {}) {
  if (!originalBody ||
    !Array.isArray(originalBody.contents) ||
    originalBody.contents.length !== 1 ||
    typeof invalidText !== 'string' ||
    !invalidText.trim()) {
    throw new J4LiveError(
      'WRITER_REPAIR_INPUT_INVALID',
      'J4 writer repair requires one original request and one non-empty rejected proposal.',
    )
  }
  const objection = String(
    error?.message ?? 'The proposal failed the frozen extraction contract.',
  ).slice(0, 1_000)
  return {
    ...structuredClone(originalBody),
    contents: [
      structuredClone(originalBody.contents[0]),
      {
        parts: [{ text: invalidText }],
        role: 'model',
      },
      {
        parts: [{
          text: JSON.stringify({
            instruction:
              'Repair the rejected proposal once. Return only a replacement JSON object that satisfies the original schema and objection. Do not explain the repair.',
            objection,
          }),
        }],
        role: 'user',
      },
    ],
  }
}

export async function callJ4RepairingWriter({
  callGemini,
  cellId,
  operationId,
  turn,
  validate = assertExactExtractionEnvelope,
} = {}) {
  if (typeof callGemini !== 'function' ||
    typeof validate !== 'function' ||
    !cellId ||
    !operationId) {
    throw new TypeError(
      'J4 repairing writer requires callGemini, validation, cellId, and operationId.',
    )
  }
  const originalBody = buildJ4WriterBody(turn)
  const first = assertValidatedJ4GeminiResponse(
    await callGemini({
      body: originalBody,
      cellId,
      operationId,
      purpose: 'writer',
    }),
    'writer',
  )
  try {
    return {
      envelope: validate(first.text),
      modelVersion: first.modelVersion,
      proposalCalls: 1,
      repaired: false,
      text: first.text,
    }
  } catch (error) {
    const repair = assertValidatedJ4GeminiResponse(
      await callGemini({
        body: buildJ4WriterRepairBody({
          error,
          invalidText: first.text,
          originalBody,
        }),
        cellId,
        operationId: `${operationId}:repair:1`,
        purpose: 'writer',
      }),
      'writer repair',
    )
    if (repair.modelVersion !== first.modelVersion) {
      throw new J4LiveError(
        'WRITER_REPAIR_MODEL_VERSION',
        'J4 writer repair modelVersion differs from its rejected proposal.',
      )
    }
    return {
      envelope: validate(repair.text),
      modelVersion: repair.modelVersion,
      proposalCalls: 2,
      repaired: true,
      text: repair.text,
    }
  }
}

function recallCoverage(sourceSessionIds, answerSessionIds, limit) {
  const expected = new Set(answerSessionIds)
  const observed = sourceSessionIds
    .slice(0, limit)
    .filter((sessionId) => expected.has(sessionId))
  return {
    all: expected.size > 0 && new Set(observed).size === expected.size,
    expected: expected.size,
    hit: observed.length > 0,
    matched: orderedUnique(observed).length,
  }
}

function assertSourceIsolation(rows, allowedSessionIds, questionId) {
  const sourceSessionIds = []
  for (const row of rows) {
    const sessionId = j4SourceSessionId(row?.source_message_id)
    if (!sessionId || !allowedSessionIds.has(sessionId)) {
      throw new J4LiveError(
        'SOURCE_ISOLATION_FAILURE',
        `J4 question ${questionId} contains a missing or foreign source ID.`,
      )
    }
    sourceSessionIds.push(sessionId)
  }
  return orderedUnique(sourceSessionIds)
}

export async function runKernelLongMemEvalQuestion({
  callGemini,
  instance,
  workspaceDir,
} = {}) {
  if (typeof callGemini !== 'function') {
    throw new TypeError('J4 kernel arm requires callGemini.')
  }
  if (!instance?.questionId || !workspaceDir) {
    throw new TypeError('J4 kernel arm requires an instance and workspace.')
  }
  await mkdir(workspaceDir, { recursive: true, mode: 0o700 })
  let replayClock = new Date(0)
  const store = await createKernelStore({
    clock: () => new Date(replayClock),
    memoryEnabled: true,
    statePath: join(workspaceDir, 'workspace-state.json'),
    workspaceId: instance.questionId,
  })
  if (!store.enabled) {
    throw new J4LiveError(
      'KERNEL_STORE_DISABLED',
      'J4 requires the supported Node SQLite runtime.',
    )
  }
  const gated = createGatedStore(store)
  const allowedSessionIds = new Set(
    (instance.sessions ?? []).map((session) => session.sessionId),
  )
  const ingest = {
    droppedUnsafeSourceMemories: 0,
    memoriesWritten: 0,
    outcomes: {},
    repairedTurns: 0,
    sessions: 0,
    turns: 0,
    turnResults: [],
    writerProposalCalls: 0,
  }

  try {
    for (const {
      occurrenceOrdinal,
      session,
    } of chronologicalJ4SessionOccurrences(instance)) {
      replayClock = validDate(session.eventAt, 'session eventAt')
      ingest.sessions += 1
      const turns = session.turns ?? []
      for (let index = 0; index < turns.length; index += 1) {
        if (turns[index]?.role !== 'user') continue
        const sourceMessageId = j4SourceMessageId({
          occurrenceOrdinal,
          sessionId: session.sessionId,
          turnIndex: index,
        })
        const assistantMessage = turns[index + 1]?.role === 'assistant'
          ? turns[index + 1].content
          : ''
        let providerError = null
        const result = await ingestChatTurn(gated, {
          assistantMessage,
          eventAt: session.eventAt,
          palariId: J4_PALARI_ID,
          palariName: 'Palari',
          sourceMessageId,
          sourceTexts: [],
          userId: J4_USER_ID,
          userMessage: turns[index].content,
          userName: 'user',
        }, {
          extractor: async ({ turn }) => {
            try {
              const writer = await callJ4RepairingWriter({
                callGemini,
                cellId: instance.questionId,
                operationId:
                  `question:${instance.questionId}:writer:${sourceMessageId}`,
                turn,
              })
              ingest.writerProposalCalls += writer.proposalCalls
              ingest.repairedTurns += Number(writer.repaired)
              return writer.text
            } catch (error) {
              providerError = error
              throw error
            }
          },
          extractorId: `google:${J4_GEMINI_MODEL}`,
        })
        if (providerError) throw providerError
        if (result.status !== 'completed' ||
          ['extractor_error', 'invalid_payload'].includes(result.reason)) {
          throw new J4LiveError(
            'EXTRACTION_PAYLOAD_INVALID',
            `J4 extraction failed closed at ${sourceMessageId}.`,
          )
        }
        ingest.turns += 1
        ingest.memoriesWritten += Number(result.memoriesWritten ?? 0)
        ingest.droppedUnsafeSourceMemories += Number(
          result.sourceBoundary?.droppedUnsafeSourceMemories ?? 0,
        )
        for (const outcome of result.outcomes ?? []) {
          ingest.outcomes[outcome] = (ingest.outcomes[outcome] ?? 0) + 1
        }
        ingest.turnResults.push({
          memoriesWritten: Number(result.memoriesWritten ?? 0),
          outcomes: result.outcomes ?? [],
          sourceMessageId,
        })
      }
    }

    const allMemories = gated.listMemories({
      palariId: J4_PALARI_ID,
      userId: J4_USER_ID,
    })
    const storedSourceSessionIds = assertSourceIsolation(
      allMemories,
      allowedSessionIds,
      instance.questionId,
    )
    replayClock = validDate(instance.questionDate, 'questionDate')
    const briefing = recallAndBrief(
      gated,
      instance.question,
      {
        palariId: J4_PALARI_ID,
        userId: J4_USER_ID,
      },
      {
        contextBudget: J4_RECALL_CONTEXT_BUDGET,
        maxChars: J4_RECALL_MAX_CHARS,
        now: replayClock,
      },
    )
    const includedRows = briefing.included.map((entry) => {
      const row = gated.getMemoryById(entry.id)
      if (!row) {
        throw new J4LiveError(
          'RECALL_ROW_MISSING',
          'J4 briefing included a memory row that no longer exists.',
        )
      }
      return row
    })
    const includedSourceSessionIds = assertSourceIsolation(
      includedRows,
      allowedSessionIds,
      instance.questionId,
    )
    const prompt = buildJ4AnswerPrompt({
      facts: briefing.text,
      question: instance.question,
      questionDate: instance.questionDate,
    })
    const answer = assertValidatedJ4GeminiResponse(
      await callGemini({
        body: buildJ4AnswerBody(prompt),
        cellId: instance.questionId,
        operationId: `question:${instance.questionId}:answer`,
        purpose: 'answer',
      }),
      'answer',
    )
    const answerSessionIds = orderedUnique(instance.answerSessionIds ?? [])
    return {
      answer: answer.text,
      answerModelVersion: answer.modelVersion,
      briefing: {
        chars: briefing.chars,
        includedMemoryIds: briefing.included.map((entry) => entry.id),
        includedSourceSessionIds,
        status: briefing.status,
        totalCandidates: briefing.totalCandidates,
      },
      ingest: {
        ...ingest,
        memoryRows: allMemories.length,
        storedSourceSessionIds,
      },
      promptSha256: j4Sha256(prompt),
      retrieval: {
        answerSessionIds,
        at5: instance.isAbstention
          ? null
          : recallCoverage(includedSourceSessionIds, answerSessionIds, 5),
        at10: instance.isAbstention
          ? null
          : recallCoverage(includedSourceSessionIds, answerSessionIds, 10),
        sourceSessionIds: includedSourceSessionIds,
      },
    }
  } finally {
    gated.close()
  }
}

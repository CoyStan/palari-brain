// Canonical-dialogue LongMemEval adapter for the fresh first-five run.
//
// Every complete visible user and Palari message is retained by the host.
// The optional model-selected quote index is deliberately disabled. Importing
// this module is inert; the caller-supplied function can make at most one
// metered Gemini answer request for one question.

import { createHash } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

import {
  answerQuestion,
  createPalariBrain,
  ingestChatTurn,
} from '../../src/index.mjs'
import {
  activeBrainLongMemEvalExchanges,
  assertValidatedActiveBrainGeminiResponse,
  buildActiveBrainAnswerBody,
} from './active-brain-longmemeval-live-arm.mjs'

export const CANONICAL_FIRST5_PALARI_ID =
  'palari-longmemeval-canonical-first5'
export const CANONICAL_FIRST5_USER_ID =
  'user-longmemeval-canonical-first5'
export const CANONICAL_FIRST5_MODEL =
  'gemini-3.5-flash-lite'
export const CANONICAL_FIRST5_MAX_CHARS = 100_000

export class CanonicalFirst5LiveArmError extends Error {
  constructor(code, message, { cause } = {}) {
    super(message, cause ? { cause } : undefined)
    this.name = 'CanonicalFirst5LiveArmError'
    this.code = code
  }
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function nonEmpty(value, label) {
  const text = String(value ?? '').trim()
  if (!text) {
    throw new CanonicalFirst5LiveArmError(
      'CANONICAL_REPLAY_INPUT',
      `Canonical first-five requires a non-empty ${label}.`,
    )
  }
  return text
}

function validDate(value, label) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new CanonicalFirst5LiveArmError(
      'CANONICAL_REPLAY_DATE',
      `Canonical first-five requires a valid ${label}.`,
    )
  }
  return date
}

function orderedUnique(values) {
  const output = []
  const seen = new Set()
  for (const value of values) {
    if (!value || seen.has(value)) continue
    seen.add(value)
    output.push(value)
  }
  return output
}

function coverage(answerSessionIds, observedSessionIds) {
  const expected = orderedUnique(answerSessionIds ?? [])
  const observed = new Set(observedSessionIds)
  const matched = expected.filter((sessionId) =>
    observed.has(sessionId))
  return {
    all: expected.length > 0 && matched.length === expected.length,
    expected: expected.length,
    matched,
    matchedCount: matched.length,
  }
}

function sameMembers(left, right) {
  if (left.length !== right.length) return false
  const rightSet = new Set(right)
  return left.every((value) => rightSet.has(value))
}

function isCanonicalEvidenceId(value) {
  const text = String(value ?? '')
  if (!text.startsWith('dialogue_') || text.length !== 73) return false
  for (const character of text.slice(9)) {
    if (!'0123456789abcdef'.includes(character)) return false
  }
  return true
}

function expectedMessages(exchanges) {
  const messages = []
  for (const exchange of exchanges) {
    if (exchange.userMessage.trim()) {
      messages.push({
        content: exchange.userMessage,
        eventAt: exchange.eventAt,
        sessionId: exchange.sessionId,
        sourceKind: 'user_message',
        sourceMessageId: `${exchange.sourceMessageId}:user`,
      })
    }
    if (exchange.assistantMessage.trim()) {
      messages.push({
        content: exchange.assistantMessage,
        eventAt: exchange.eventAt,
        sessionId: exchange.sessionId,
        sourceKind: 'assistant_message',
        sourceMessageId: `${exchange.sourceMessageId}:assistant`,
      })
    }
  }
  return messages
}

function exactCanonicalEvidence(rows, expected, scope) {
  if (!Array.isArray(rows) || rows.length !== expected.length) {
    throw new CanonicalFirst5LiveArmError(
      'CANONICAL_EVIDENCE_CARDINALITY',
      'Canonical first-five did not retain every visible message exactly once.',
    )
  }
  const ids = new Set()
  return rows.map((row, index) => {
    const source = expected[index]
    if (!source ||
      row.content !== source.content ||
      row.content_sha256 !== sha256(source.content) ||
      row.evidence_kind !== 'canonical_message' ||
      row.palari_id !== scope.palariId ||
      row.user_id !== scope.userId ||
      row.source_kind !== source.sourceKind ||
      row.source_message_id !== source.sourceMessageId ||
      row.valid_from !== source.eventAt ||
      !isCanonicalEvidenceId(row.id) ||
      ids.has(row.id)) {
      throw new CanonicalFirst5LiveArmError(
        'CANONICAL_EVIDENCE_INVALID',
        'Canonical first-five stored content or provenance outside the visible dialogue.',
      )
    }
    ids.add(row.id)
    return {
      content: row.content,
      evidenceKind: row.evidence_kind,
      memoryId: row.id,
      occurredAt: row.valid_from,
      sessionId: source.sessionId,
      sourceKind: row.source_kind,
      sourceMessageId: row.source_message_id,
    }
  })
}

export async function runCanonicalFirst5LongMemEvalQuestion({
  callGemini,
  instance,
  maxChars = CANONICAL_FIRST5_MAX_CHARS,
  model = CANONICAL_FIRST5_MODEL,
  workspaceDir,
} = {}) {
  if (typeof callGemini !== 'function') {
    throw new TypeError(
      'Canonical first-five requires one metered Gemini answer caller.',
    )
  }
  if (!instance?.questionId ||
    typeof workspaceDir !== 'string' ||
    !workspaceDir) {
    throw new TypeError(
      'Canonical first-five requires an instance and private workspace.',
    )
  }
  if (maxChars !== CANONICAL_FIRST5_MAX_CHARS) {
    throw new CanonicalFirst5LiveArmError(
      'MEMORY_CAP_CHANGED',
      'Canonical first-five must use the 100,000-character product default.',
    )
  }
  if (nonEmpty(model, 'model') !== CANONICAL_FIRST5_MODEL) {
    throw new CanonicalFirst5LiveArmError(
      'GEMINI_MODEL_CHANGED',
      'Canonical first-five must use its frozen Gemini model.',
    )
  }

  const questionId = nonEmpty(instance.questionId, 'questionId')
  const exchanges = activeBrainLongMemEvalExchanges(instance)
  const expected = expectedMessages(exchanges)
  const scope = {
    palariId: CANONICAL_FIRST5_PALARI_ID,
    userId: CANONICAL_FIRST5_USER_ID,
  }
  await mkdir(workspaceDir, { recursive: true, mode: 0o700 })

  let replayClock = new Date(0)
  const brain = await createPalariBrain({
    clock: () => new Date(replayClock),
    memoryEnabled: true,
    statePath: join(workspaceDir, 'workspace-state.json'),
    workspaceId: `canonical-first5-${questionId}`,
  })
  if (!brain.enabled) {
    throw new CanonicalFirst5LiveArmError(
      'CANONICAL_BRAIN_DISABLED',
      'Canonical first-five requires the supported SQLite runtime.',
    )
  }

  const ingest = {
    assistantMessages: 0,
    evidenceWritten: 0,
    exchanges: 0,
    externalSourcesIgnored: 0,
    indexFailures: 0,
    indexSkipped: 0,
    indexWritten: 0,
    rawTurns: 0,
    sessions: orderedUnique(
      exchanges.map((exchange) => exchange.sessionId),
    ).length,
    sourceTextsObserved: 0,
    turnResults: [],
    userMessages: 0,
  }

  try {
    for (const exchange of exchanges) {
      replayClock = validDate(
        exchange.eventAt,
        'exchange eventAt',
      )
      const expectedWrites =
        Number(Boolean(exchange.userMessage.trim())) +
        Number(Boolean(exchange.assistantMessage.trim()))

      // Deliberately pass no writer options. Canonical evidence is the memory;
      // a model-selected quote index is not part of this measurement.
      const result = await ingestChatTurn(brain, {
        assistantMessage: exchange.assistantMessage,
        eventAt: exchange.eventAt,
        palariId: scope.palariId,
        retention: 'durable',
        sourceMessageId: exchange.sourceMessageId,
        sourceTexts: exchange.sourceTexts,
        userId: scope.userId,
        userMessage: exchange.userMessage,
      })

      if (result.status !== 'completed' ||
        result.evidenceWritten !== expectedWrites ||
        result.written?.length !== expectedWrites ||
        result.externalSourcesIgnored !== exchange.sourceTexts.length ||
        result.indexStatus !== 'skipped' ||
        result.indexReason !== 'extractor_missing' ||
        result.indexSelected !== 0 ||
        result.indexWritten !== 0 ||
        result.memoriesSelected !== 0) {
        throw new CanonicalFirst5LiveArmError(
          'CANONICAL_INGEST_INVALID',
          'Canonical first-five did not perform a writer-free durable ingest.',
        )
      }

      ingest.assistantMessages += Number(
        Boolean(exchange.assistantMessage.trim()),
      )
      ingest.evidenceWritten += result.evidenceWritten
      ingest.exchanges += 1
      ingest.externalSourcesIgnored +=
        result.externalSourcesIgnored
      ingest.indexSkipped += 1
      ingest.indexWritten += result.indexWritten
      ingest.rawTurns += exchange.representedTurns
      ingest.sourceTextsObserved += exchange.sourceTexts.length
      ingest.userMessages += Number(
        Boolean(exchange.userMessage.trim()),
      )
      ingest.turnResults.push({
        evidenceWritten: result.evidenceWritten,
        indexReason: result.indexReason,
        indexStatus: result.indexStatus,
        representedTurns: exchange.representedTurns,
        sessionId: exchange.sessionId,
        sourceMessageId: exchange.sourceMessageId,
      })
    }

    const rows = brain.listStatements(scope)
    const memoryEvidence =
      exactCanonicalEvidence(rows, expected, scope)
    if (brain.listIndexEntries(scope).length !== 0 ||
      ingest.evidenceWritten !== expected.length ||
      ingest.indexSkipped !== exchanges.length ||
      ingest.indexFailures !== 0 ||
      ingest.indexWritten !== 0) {
      throw new CanonicalFirst5LiveArmError(
        'CANONICAL_INDEX_NOT_EMPTY',
        'Canonical first-five unexpectedly created a derived quote index.',
      )
    }
    ingest.memoryRows = memoryEvidence.length

    let answerModelVersion = null
    let answerProviderCalls = 0
    let answerRequestSha256 = null
    let promptSha256 = null
    const answer = await answerQuestion(brain, {
      maxChars,
      palariId: scope.palariId,
      provider: async ({ prompt }) => {
        answerProviderCalls += 1
        if (answerProviderCalls > 1) {
          throw new CanonicalFirst5LiveArmError(
            'ANSWER_CALL_CARDINALITY',
            'Canonical first-five attempted more than one answer request.',
          )
        }
        promptSha256 = sha256(prompt)
        const body = buildActiveBrainAnswerBody(prompt)
        answerRequestSha256 = sha256(JSON.stringify(body))
        const response = assertValidatedActiveBrainGeminiResponse(
          await callGemini({
            body,
            cellId: questionId,
            operationId: `question:${questionId}:answer`,
            purpose: 'answer',
          }),
          'answer',
        )
        answerModelVersion = response.modelVersion
        return { text: response.text }
      },
      question: instance.question,
      questionDate: instance.questionDate,
      userId: scope.userId,
    })

    if (answerProviderCalls !== Number(answer.providerCalled) ||
      (answer.providerCalled &&
        !answerModelVersion) ||
      (!answer.providerCalled &&
        (answerModelVersion ||
          answerRequestSha256 ||
          promptSha256))) {
      throw new CanonicalFirst5LiveArmError(
        'ANSWER_EVIDENCE_INVALID',
        'Canonical first-five answer evidence differs from its provider call.',
      )
    }

    const storedIds = memoryEvidence.map((entry) => entry.memoryId)
    const includedIds = answer.included.map((entry) => entry.id)
    if (answer.complete &&
      !sameMembers(storedIds, includedIds)) {
      throw new CanonicalFirst5LiveArmError(
        'COMPLETE_SET_MISMATCH',
        'Canonical first-five omitted stored evidence from a complete briefing.',
      )
    }
    if (!answer.complete &&
      (answer.briefingStatus !== 'capacity_exceeded' ||
        answer.providerCalled ||
        answer.included.length !== 0)) {
      throw new CanonicalFirst5LiveArmError(
        'CAPACITY_RESULT_INVALID',
        'Canonical first-five capacity refusal exposed partial evidence.',
      )
    }

    const sourceByMessageId = new Map(
      expected.map((entry) => [entry.sourceMessageId, entry]),
    )
    const includedEvidence = answer.included.map((entry) => {
      const source = sourceByMessageId.get(entry.sourceMessageId)
      if (!source ||
        entry.content !== source.content ||
        entry.sourceKind !== source.sourceKind ||
        entry.evidenceKind !== 'canonical_message') {
        throw new CanonicalFirst5LiveArmError(
          'BRIEFING_PROVENANCE_INVALID',
          'Canonical first-five briefing changed canonical provenance.',
        )
      }
      return source
    })
    const storedSessionIds = orderedUnique(
      memoryEvidence.map((entry) => entry.sessionId),
    )
    const includedSessionIds = orderedUnique(
      includedEvidence.map((entry) => entry.sessionId),
    )

    return {
      answer: answer.answer,
      answerModelVersion,
      answerProviderCalled: answer.providerCalled,
      answerRequestSha256,
      briefing: {
        complete: answer.complete,
        includedMemoryIds: includedIds,
        includedSessionIds,
        requiredChars: answer.requiredChars,
        roleCounts: {
          assistant: includedEvidence.filter((entry) =>
            entry.sourceKind === 'assistant_message').length,
          user: includedEvidence.filter((entry) =>
            entry.sourceKind === 'user_message').length,
        },
        status: answer.briefingStatus,
        totalCandidates: answer.totalCandidates,
      },
      exchangePlanSha256: sha256(JSON.stringify(exchanges)),
      ingest,
      memoryEvidence,
      memoryEvidenceSha256:
        sha256(JSON.stringify(memoryEvidence)),
      promptSha256,
      providerCalled: answer.providerCalled,
      retrieval: {
        allContextIncluded: answer.complete,
        complete: coverage(
          instance.answerSessionIds,
          includedSessionIds,
        ),
        sourceSessionIds: includedSessionIds,
      },
      sourceCoverage: {
        answerSessionsInBriefing: coverage(
          instance.answerSessionIds,
          includedSessionIds,
        ),
        answerSessionsStored: coverage(
          instance.answerSessionIds,
          storedSessionIds,
        ),
        includedSessionIds,
        storedSessionIds,
      },
      writerProviderCalls: 0,
    }
  } finally {
    brain.close()
  }
}

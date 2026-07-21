// LongMemEval adapter (U7, adapted for V2-M2-A2 producer closure).
// The question-answering path is history -> branded gated ingest -> recall ->
// briefing v1 -> pluggable provider -> answer. A2 removes the former
// store-shaped add/supersede shim: extraction now submits its own branded
// legacy proposal, including eventAt and extractorId provenance.
//
// Providers are injected async functions; the deterministic
// stubProvider needs no key and no network (dry mode). Live provider
// runners are U8 (FOUNDER GATE) — this module never reads an API key.

import { runMemoryExtractionPass } from './memory-extraction.mjs'
import { assertGatedStoreCapability } from './gate.mjs'
import { recallAndBrief } from './recall.mjs'

// One chat exchange -> one extraction pass through the gate.
export async function ingestChatTurn(gated, turnInput = {}, options = {}) {
  assertGatedStoreCapability(gated)
  if (!gated.enabled) {
    return { memoriesWritten: 0, reason: 'memory_disabled', status: 'skipped' }
  }
  const {
    assistantMessage = '',
    eventAt,
    palariId,
    palariName = 'Palari',
    sourceMessageId,
    sourceTexts = [],
    userId,
    userMessage = '',
    userName = 'user',
  } = turnInput
  const { extractor, extractorId = 'dry-stub' } = options
  return runMemoryExtractionPass({
    extractor,
    extractorId,
    store: gated,
    turn: {
      assistantMessage,
      eventAt,
      palariId,
      palariName,
      sourceMessageId,
      sourceRefCount: sourceTexts.length,
      sourceTexts,
      userId,
      userMessage,
      userName,
    },
  })
}

// A LongMemEval instance's haystack -> gated ingest, session by
// session, pairing user turns with their assistant replies.
export async function ingestLongMemEvalInstance(gated, instance, options = {}) {
  assertGatedStoreCapability(gated)
  const {
    extractor,
    extractorId = 'dry-stub',
    failOnExtractorError = false,
    palariId,
    userId,
  } = options
  assertGatedStoreCapability(gated)
  const stats = {
    extractorErrors: 0,
    invalidPayloads: 0,
    memoriesWritten: 0,
    sessions: 0,
    sourceBoundary: { droppedUnsafeSourceMemories: 0 },
    turns: 0,
  }
  const sessions = instance.sessions ?? []
  assertGatedStoreCapability(gated)
  for (const session of sessions) {
    assertGatedStoreCapability(gated)
    stats.sessions += 1
    const turns = session.turns ?? []
    assertGatedStoreCapability(gated)
    for (let i = 0; i < turns.length; i += 1) {
      if (turns[i].role !== 'user') continue
      const assistant = turns[i + 1]?.role === 'assistant' ? turns[i + 1].content : ''
      assertGatedStoreCapability(gated)
      stats.turns += 1
      const result = await ingestChatTurn(gated, {
        assistantMessage: assistant,
        eventAt: session.eventAt,
        palariId,
        sourceMessageId: `${session.sessionId}:${i}`,
        userId,
        userMessage: turns[i].content,
      }, { extractor, extractorId })
      stats.memoriesWritten += result.memoriesWritten ?? 0
      if (result.reason === 'extractor_error') {
        stats.extractorErrors += 1
        if (failOnExtractorError) {
          const error = new Error(`Extractor transport failed at ${session.sessionId}:${i}.`)
          error.category = 'extractor_error'
          throw error
        }
      }
      if (result.reason === 'invalid_payload') stats.invalidPayloads += 1
      stats.sourceBoundary.droppedUnsafeSourceMemories +=
        result.sourceBoundary?.droppedUnsafeSourceMemories ?? 0
    }
  }
  assertGatedStoreCapability(gated)
  return stats
}

// Deterministic dry-mode provider: answers only from the briefing,
// abstains plainly when it is empty. No key, no network.
export async function stubProvider({ briefing } = {}) {
  if (briefing?.status !== 'included' || !briefing.included?.length) {
    return { text: 'I have no stored memories relevant to this question.' }
  }
  return { text: `Based on recalled evidence: ${briefing.included.map((entry) => entry.content).join(' | ')}` }
}

export function buildAnswerPrompt({ briefingText = '', question = '', questionDate } = {}) {
  return [
    briefingText,
    '',
    questionDate ? `Question date: ${questionDate}` : '',
    `Question: ${question}`,
  ].filter(Boolean).join('\n')
}

// Question -> recall -> briefing -> provider -> answer, measured.
export async function answerQuestion(gated, input = {}) {
  assertGatedStoreCapability(gated)
  const {
    contextBudget = 12,
    maxChars = 1800,
    palariId,
    provider,
    question,
    questionDate,
    userId,
  } = input
  const now = questionDate ? new Date(questionDate) : new Date()
  const briefing = recallAndBrief(gated, question, { palariId, userId }, { contextBudget, maxChars, now })
  const prompt = buildAnswerPrompt({ briefingText: briefing.text, question, questionDate })
  const response = await provider({ briefing, prompt, question, questionDate })
  return {
    abstained: briefing.status !== 'included',
    answer: String(response?.text ?? ''),
    briefingStatus: briefing.status,
    included: briefing.included,
    latencyMs: briefing.latencyMs,
    prompt,
    totalCandidates: briefing.totalCandidates,
  }
}

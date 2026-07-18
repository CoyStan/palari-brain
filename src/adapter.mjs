// LongMemEval adapter (U7) — Fable 5, 2026-07-18.
// The question-answering path: history -> kernel ingest (through the
// gate) -> recall -> briefing v1 -> pluggable provider -> answer.
//
// The gate-shim below closes the loop promised in U4/U5 notes: the
// extracted runMemoryExtractionPass (baseline, verbatim) writes via a
// store-shaped shim whose addMemory/supersedeMemory emit typed
// WriteProposals through gate.propose — the one-gate law holds in
// the adapter path with zero edits to the baseline file. eventAt is
// injected per session so every ingested atom is stamped with
// evidence time (GAP-4), and extractorId identifies the extractor
// (GAP-1).
//
// Providers are injected async functions; the deterministic
// stubProvider needs no key and no network (dry mode). Live provider
// runners are U8 (FOUNDER GATE) — this module never reads an API key.

import { runMemoryExtractionPass } from './memory-extraction.mjs'
import { permanentMemoryTypes } from './memory-store.mjs'
import { recallAndBrief } from './recall.mjs'

function createGateShimStore(gated, { eventAt, extractorId }) {
  function provenanceFor(writeOptions = {}, record = {}) {
    return {
      eventAt,
      extractor: extractorId,
      sourceKind: writeOptions.sourceKind,
      sourceMessageId: record.source_message_id ?? writeOptions.sourceMessageId,
      writer: writeOptions.writer,
    }
  }
  function kindFor(record = {}) {
    return permanentMemoryTypes.has(record.type) ? 'permanent' : 'promote'
  }
  return {
    addMemory(record = {}, writeOptions = {}) {
      const result = gated.propose({
        kind: kindFor(record),
        op: 'add',
        provenance: provenanceFor(writeOptions, record),
        record,
      })
      return result
    },
    enabled: true,
    listMemories(scope) {
      return gated.listMemories(scope)
    },
    supersedeMemory(existingId, record = {}, writeOptions = {}) {
      const result = gated.propose({
        kind: kindFor(record),
        op: 'supersede',
        provenance: provenanceFor(writeOptions, record),
        record,
        target: existingId,
      })
      if (result.outcome === 'rejected') {
        // loud, not silent: a rejected supersession during ingest is a
        // finding, never a shortcut around the gate
        throw new Error(`Gate rejected supersession: ${result.reasons.join(', ')}`)
      }
      return result
    },
  }
}

// One chat exchange -> one extraction pass through the gate.
export async function ingestChatTurn(gated, {
  assistantMessage = '',
  eventAt,
  palariId,
  palariName = 'Palari',
  sourceMessageId,
  sourceTexts = [],
  userId,
  userMessage = '',
  userName = 'user',
} = {}, { extractor, extractorId = 'dry-stub' } = {}) {
  const shim = createGateShimStore(gated, { eventAt, extractorId })
  return runMemoryExtractionPass({
    extractor,
    store: shim,
    turn: {
      assistantMessage,
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
export async function ingestLongMemEvalInstance(gated, instance, {
  extractor,
  extractorId = 'dry-stub',
  palariId,
  userId,
} = {}) {
  const stats = {
    memoriesWritten: 0,
    sessions: 0,
    sourceBoundary: { droppedUnsafeSourceMemories: 0 },
    turns: 0,
  }
  for (const session of instance.sessions ?? []) {
    stats.sessions += 1
    const turns = session.turns ?? []
    for (let i = 0; i < turns.length; i += 1) {
      if (turns[i].role !== 'user') continue
      const assistant = turns[i + 1]?.role === 'assistant' ? turns[i + 1].content : ''
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
      stats.sourceBoundary.droppedUnsafeSourceMemories +=
        result.sourceBoundary?.droppedUnsafeSourceMemories ?? 0
    }
  }
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
export async function answerQuestion(gated, {
  contextBudget = 12,
  maxChars = 1800,
  palariId,
  provider,
  question,
  questionDate,
  userId,
} = {}) {
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

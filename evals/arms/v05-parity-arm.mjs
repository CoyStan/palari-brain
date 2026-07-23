// Contrast arm: the memory path deployed by palari-v05 today.
// CORRECTED per BAKEOFF-CONTRACT §7 Amendment A2: production v05 does
// not write candidates through the raw door directly — chat-turn ingest
// runs runMemoryExtractionPass (byte-identical file in v05 main), which
// INCLUDES the injection source boundary and contradiction supersession.
// What v05 lacks versus the kernel arm is the typed admission gate
// (raw addMemory/supersedeMemory writers), eventAt evidence-time
// provenance (wall clock becomes valid_from), and briefing v1
// (attribution/confidence surfaces); briefing v0 answers below.

import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { createKernelStore } from '../../src/store.mjs'
import { runMemoryExtractionPass } from '../../src/memory-extraction.mjs'
import { buildMemoryBriefing } from '../../src/memory-briefing.mjs'

const ABSENCE = 'I have no stored memories relevant to this question.'

export function createV05ParityArm() {
  let root = null
  let store = null
  let palariId = null
  return {
    name: 'v05-current-memory',
    async open(scope) {
      palariId = scope.palariId
      root = await mkdtemp(join(tmpdir(), 'bakeoff-v05-'))
      store = await createKernelStore({
        memoryEnabled: true,
        statePath: join(root, 'workspace-state.json'),
        workspaceId: `bakeoff-v05-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      })
      if (!store.enabled) throw new Error('v05 parity arm: store disabled (need Node >= 22.5)')
    },
    async ingestTurn(turn) {
      const sourceTexts = turn.sourceTexts ?? []
      // The deployed path: extraction pass over the raw store — source
      // boundary and supersession run; no gate, no eventAt injection.
      return runMemoryExtractionPass({
        extractor: () => ({ memories: turn.candidates ?? [] }),
        store,
        turn: {
          assistantMessage: turn.assistantMessage,
          palariId: turn.palariId ?? palariId,
          palariName: 'Palari',
          sourceMessageId: turn.sourceMessageId,
          sourceRefCount: sourceTexts.length,
          sourceTexts,
          userId: turn.userId,
          userMessage: turn.userMessage,
          userName: 'user',
        },
      })
    },
    async forget(topic, { userId } = {}) {
      return store.topicForget(topic, { palariId, userId })
    },
    async answer({ palariId: answerPalariId, question, questionDate, userId }) {
      const now = questionDate ? new Date(questionDate) : new Date()
      const recall = store.recallMemories(question, {
        contextBudget: 12,
        now,
        palariId: answerPalariId ?? palariId,
        userId,
      })
      const briefing = buildMemoryBriefing({ maxChars: 1800, now, recall })
      if (!briefing.included.length) {
        return { abstained: true, answer: ABSENCE }
      }
      return {
        abstained: false,
        answer: `Based on recalled evidence: ${briefing.included.map((entry) => entry.content).join(' | ')}`,
      }
    },
    async close() {
      try {
        store?.close()
      } finally {
        store = null
        if (root) await rm(root, { force: true, recursive: true })
        root = null
      }
    },
  }
}

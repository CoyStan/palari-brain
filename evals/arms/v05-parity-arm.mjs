// Contrast arm: the memory path deployed by palari-v05 today.
// Scripted candidates go straight to the raw store with background-extraction
// authority: no admission gate, no eventAt provenance, and no source-boundary
// prefilter. The raw store's own accept/refuse behavior remains untouched.

import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { createKernelStore } from '../../src/store.mjs'
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
      const outcomes = []
      let memoriesWritten = 0
      for (const candidate of turn.candidates ?? []) {
        const sourceKind = String(
          candidate.sourceKind ?? candidate.source_kind ?? 'user_message',
        ).trim() || 'user_message'
        const result = store.addMemory({
          confidence: candidate.confidence,
          content: candidate.content,
          fictional: Boolean(candidate.fictional),
          importance: candidate.importance,
          keywords: candidate.keywords,
          palari_id: turn.palariId ?? palariId,
          shared: Boolean(candidate.shared),
          source_message_id: turn.sourceMessageId,
          type: candidate.type,
          user_id: turn.userId,
        }, {
          sourceKind,
          writer: 'background_extraction',
        })
        outcomes.push(result.outcome)
        if (result.outcome === 'inserted') memoriesWritten += 1
      }
      return { memoriesWritten, outcomes }
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

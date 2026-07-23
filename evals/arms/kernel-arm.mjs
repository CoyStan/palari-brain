// Arm: the palari-brain kernel itself (reference arm).
// Dry mode: the scripted per-turn candidates play the extractor role,
// so what is measured is the kernel's gate, recall, correction,
// forgetting, isolation, and injection behavior — not extraction.

import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { createKernelStore } from '../../src/store.mjs'
import { createGatedStore } from '../../src/gate.mjs'
import { answerQuestion, ingestChatTurn, stubProvider } from '../../src/adapter.mjs'

export function createKernelArm() {
  let root = null
  let store = null
  let gated = null
  let palariId = null
  return {
    name: 'palari-brain-kernel',
    async open(scope) {
      palariId = scope.palariId
      root = await mkdtemp(join(tmpdir(), 'bakeoff-kernel-'))
      store = await createKernelStore({
        memoryEnabled: true,
        statePath: join(root, 'workspace-state.json'),
        workspaceId: `bakeoff-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      })
      if (!store.enabled) throw new Error('kernel arm: store disabled (need Node >= 22.5)')
      gated = createGatedStore(store)
    },
    async ingestTurn(turn) {
      const candidates = turn.candidates ?? []
      return ingestChatTurn(gated, {
        assistantMessage: turn.assistantMessage,
        eventAt: turn.eventAt,
        palariId: turn.palariId ?? palariId,
        sourceMessageId: turn.sourceMessageId,
        sourceTexts: turn.sourceTexts ?? [],
        userId: turn.userId,
        userMessage: turn.userMessage,
      }, {
        extractor: () => ({ memories: candidates }),
        extractorId: 'journey-script-v1',
      })
    },
    async forget(topic, { userId } = {}) {
      return gated.topicForget(topic, { palariId, userId })
    },
    async answer({ palariId: answerPalariId, question, questionDate, userId }) {
      const result = await answerQuestion(gated, {
        palariId: answerPalariId ?? palariId,
        provider: stubProvider,
        question,
        questionDate,
        userId,
      })
      return { abstained: result.abstained, answer: result.answer }
    },
    async close() {
      try {
        gated?.close()
      } finally {
        gated = null
        store = null
        if (root) await rm(root, { force: true, recursive: true })
        root = null
      }
    },
  }
}

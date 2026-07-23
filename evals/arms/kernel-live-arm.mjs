// J3 live arm: the governed Palari kernel with a real, metered OpenAI
// extractor and the shared metered probe-answer model.

import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

import { answerQuestion, ingestChatTurn } from '../../src/adapter.mjs'
import { createGatedStore } from '../../src/gate.mjs'
import { buildMemoryExtractionRequest } from '../../src/memory-extraction.mjs'
import { createKernelStore } from '../../src/store.mjs'
import { LIVE_ANSWER_SYSTEM, LIVE_MODEL, LiveRunError } from '../live-runtime.mjs'

function extractionMessages(turn) {
  const request = buildMemoryExtractionRequest({ turn })
  const system = (request.systemInstruction?.parts ?? [])
    .map((part) => String(part?.text ?? ''))
    .join('\n')
  const messages = [{ role: 'system', content: system }]
  for (const content of request.contents ?? []) {
    messages.push({
      role: String(content?.role ?? 'user'),
      content: (content?.parts ?? [])
        .map((part) => String(part?.text ?? ''))
        .join('\n'),
    })
  }
  return messages
}

export function createKernelLiveArm({ callChat, workspaceDir } = {}) {
  if (typeof callChat !== 'function') {
    throw new TypeError('kernel live arm requires callChat')
  }
  if (!workspaceDir) {
    throw new TypeError('kernel live arm requires workspaceDir')
  }
  let gated = null
  let palariId = null
  return {
    name: 'palari-brain-kernel-live',

    async open(scope) {
      if (gated) throw new LiveRunError('ARM_ALREADY_OPEN', 'Kernel live arm is already open.')
      palariId = scope.palariId
      await mkdir(workspaceDir, { recursive: true })
      const store = await createKernelStore({
        memoryEnabled: true,
        statePath: join(workspaceDir, 'workspace-state.json'),
        workspaceId: 'j3-live-kernel',
      })
      if (!store.enabled) {
        throw new LiveRunError(
          'KERNEL_STORE_DISABLED',
          'Kernel live arm requires the supported Node SQLite runtime.',
        )
      }
      gated = createGatedStore(store)
    },

    async ingestTurn(turn) {
      let providerError = null
      const result = await ingestChatTurn(gated, {
        assistantMessage: turn.assistantMessage,
        eventAt: turn.eventAt,
        palariId: turn.palariId ?? palariId,
        sourceMessageId: turn.sourceMessageId,
        sourceTexts: turn.sourceTexts ?? [],
        userId: turn.userId,
        userMessage: turn.userMessage,
      }, {
        extractor: async ({ turn: extractionTurn }) => {
          try {
            const response = await callChat({
              messages: extractionMessages(extractionTurn),
              purpose: 'kernel-memory',
              responseFormat: { type: 'json_object' },
            })
            return response.text
          } catch (error) {
            providerError = error
            throw error
          }
        },
        extractorId: `openai:${LIVE_MODEL}`,
      })
      // runMemoryExtractionPass deliberately converts extractor exceptions to
      // an observation. A transport failure is different: the run contract
      // requires a checkpoint and stop, so restore that exception here.
      if (providerError) throw providerError
      return result
    },

    async forget(topic, { userId } = {}) {
      return gated.topicForget(topic, { palariId, userId })
    },

    async answer({ palariId: answerPalariId, question, questionDate, userId }) {
      const result = await answerQuestion(gated, {
        palariId: answerPalariId ?? palariId,
        provider: async ({ prompt }) => {
          const response = await callChat({
            messages: [
              { role: 'system', content: LIVE_ANSWER_SYSTEM },
              { role: 'user', content: prompt },
            ],
            purpose: 'answer',
          })
          return { text: response.text }
        },
        question,
        questionDate,
        userId,
      })
      return {
        abstained: result.abstained,
        answer: result.answer,
        evidence: result.included.map((entry) => entry.content),
      }
    },

    async close() {
      try {
        gated?.close()
      } finally {
        gated = null
        palariId = null
      }
    },
  }
}

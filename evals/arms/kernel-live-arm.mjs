// J3 live arm: the governed Palari kernel with a real, metered OpenAI
// extractor and the shared metered probe-answer model.

import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

import { answerQuestion, ingestChatTurn } from '../../src/adapter.mjs'
import { createGatedStore } from '../../src/gate.mjs'
import { buildMemoryExtractionRequest } from '../../src/memory-extraction.mjs'
import { createKernelStore } from '../../src/store.mjs'
import {
  LIVE_ANSWER_SYSTEM,
  LIVE_MODEL,
  LiveRunError,
  isLiveAbsenceAnswer,
} from '../live-runtime.mjs'

function replayDate(value, label) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new LiveRunError(
      'KERNEL_REPLAY_TIME_MISSING',
      `Kernel live replay requires a valid ${label} timestamp.`,
    )
  }
  return date
}

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

export function createKernelLiveArm({ callChat, liveConfig, workspaceDir } = {}) {
  if (typeof callChat !== 'function') {
    throw new TypeError('kernel live arm requires callChat')
  }
  if (!workspaceDir) {
    throw new TypeError('kernel live arm requires workspaceDir')
  }
  let gated = null
  let palariId = null
  let replayClock = new Date(0)
  const answerAbstention = liveConfig?.manifest?.answerAbstention
  const model = liveConfig?.model?.chat ?? LIVE_MODEL
  const answerSystem = liveConfig?.manifest?.answerSystem ?? LIVE_ANSWER_SYSTEM
  return {
    name: 'palari-brain-kernel-live',

    async open(scope) {
      if (gated) throw new LiveRunError('ARM_ALREADY_OPEN', 'Kernel live arm is already open.')
      palariId = scope.palariId
      await mkdir(workspaceDir, { recursive: true })
      const store = await createKernelStore({
        clock: () => new Date(replayClock),
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
      replayClock = replayDate(turn.eventAt, 'turn eventAt')
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
        extractorId: `openai:${model}`,
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
      replayClock = replayDate(questionDate, 'questionDate')
      const result = await answerQuestion(gated, {
        palariId: answerPalariId ?? palariId,
        provider: async ({ prompt }) => {
          const response = await callChat({
            messages: [
              { role: 'system', content: answerSystem },
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
      const answer = String(result.answer)
      const answerAbstained = isLiveAbsenceAnswer(answer, {
        mode: answerAbstention,
        question,
      })
      return {
        abstained: answerAbstained,
        answer,
        answerAbstained,
        evidence: result.included.map((entry) => entry.content),
        retrievalEmpty: result.abstained,
      }
    },

    async close() {
      try {
        gated?.close()
      } finally {
        gated = null
        palariId = null
        replayClock = new Date(0)
      }
    },
  }
}

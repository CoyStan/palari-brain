// J3 live arm: real Mem0 OSS memory/search behavior behind the same metered
// OpenAI transport and shared probe-answer model as the kernel arm.
//
// mem0ai is dynamically imported only after telemetry and network guards are
// installed by the runner.

import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

import { buildAnswerPrompt } from '../../src/adapter.mjs'
import { buildBriefingV1 } from '../../src/recall.mjs'
import {
  LIVE_ABSENCE_ANSWER,
  LIVE_ANSWER_SYSTEM,
  LIVE_EMBEDDING_DIMENSIONS,
  LIVE_EMBEDDING_MODEL,
  LIVE_MODEL,
  LiveRunError,
} from '../live-runtime.mjs'

function scopeFilters(userId, agentId) {
  return { agent_id: agentId, user_id: userId }
}

function closePrivateDatabase(candidate) {
  const db = candidate?.db
  if (db?.open && typeof db.close === 'function') db.close()
}

function requestUrl(input) {
  if (typeof input === 'string' || input instanceof URL) return new URL(input)
  return new URL(input?.url)
}

export function pinMem0OpenAIClient(client, {
  apiKey,
  baseURL,
  endpoint,
} = {}) {
  if (!client ||
    client.apiKey !== apiKey ||
    client.baseURL !== baseURL ||
    typeof client.fetch !== 'function') {
    throw new LiveRunError(
      'MEM0_CLIENT_SURFACE_CHANGED',
      'Installed Mem0 OpenAI client surface differs from the reviewed package.',
    )
  }
  const allowed = new URL(`${baseURL.replace(/\/$/, '')}/${endpoint}`)
  const capturedFetch = client.fetch
  const loopbackOnlyFetch = (input, init) => {
    const candidate = requestUrl(input)
    if (candidate.origin !== allowed.origin ||
      candidate.pathname !== allowed.pathname ||
      candidate.search !== '') {
      throw new LiveRunError(
        'UNMETERED_MEM0_NETWORK_BLOCKED',
        'A Mem0 OpenAI client tried to bypass its exact local meter endpoint.',
      )
    }
    return capturedFetch.call(undefined, input, init)
  }
  Object.defineProperties(client, {
    apiKey: {
      configurable: false,
      enumerable: true,
      value: apiKey,
      writable: false,
    },
    baseURL: {
      configurable: false,
      enumerable: true,
      value: baseURL,
      writable: false,
    },
    fetch: {
      configurable: false,
      enumerable: true,
      value: loopbackOnlyFetch,
      writable: false,
    },
    maxRetries: {
      configurable: false,
      enumerable: true,
      value: 0,
      writable: false,
    },
  })
  return client
}

function mem0Briefing(results, questionDate) {
  return buildBriefingV1({
    now: new Date(questionDate),
    recall: {
      memories: results.map((entry) => {
        const evidenceTime = entry.metadata?.palariEventAt ?? entry.createdAt
        return {
          // Mem0's score is search similarity, not factual confidence.
          confidence: 0.5,
          content: entry.memory,
          created_at: evidenceTime,
          extractor: 'mem0ai@3.1.1',
          id: entry.id,
          importance: 0.5,
          last_accessed: evidenceTime,
          rpath: 'recent',
          type: 'working',
          valid_from: evidenceTime,
        }
      }),
    },
  })
}

export function createMem0LiveArm({
  callChat,
  liveConfig,
  sentinels,
  transportBaseURL,
  workspaceDir,
} = {}) {
  if (typeof callChat !== 'function') {
    throw new TypeError('Mem0 live arm requires callChat')
  }
  if (!sentinels?.mem0Memory || !sentinels?.mem0Embedding) {
    throw new TypeError('Mem0 live arm requires meter sentinels')
  }
  if (!transportBaseURL || !workspaceDir) {
    throw new TypeError('Mem0 live arm requires transportBaseURL and workspaceDir')
  }
  let memory = null
  let palariId = null
  const answerSystem = liveConfig?.manifest?.answerSystem ?? LIVE_ANSWER_SYSTEM
  const embeddingDimensions = liveConfig?.model?.embeddingDimensions ??
    LIVE_EMBEDDING_DIMENSIONS
  const embeddingModel = liveConfig?.model?.embedding ?? LIVE_EMBEDDING_MODEL
  const model = liveConfig?.model?.chat ?? LIVE_MODEL

  return {
    name: 'mem0-oss-live',

    async open(scope) {
      if (memory) throw new LiveRunError('ARM_ALREADY_OPEN', 'Mem0 live arm is already open.')
      if (process.env.MEM0_TELEMETRY !== 'false') {
        throw new LiveRunError(
          'TELEMETRY_NOT_DISABLED',
          'MEM0_TELEMETRY must be false before importing mem0ai.',
        )
      }
      palariId = scope.palariId
      await mkdir(workspaceDir, { recursive: true })
      const { Memory } = await import('mem0ai/oss')
      memory = new Memory({
        embedder: {
          provider: 'openai',
          config: {
            apiKey: sentinels.mem0Embedding,
            baseURL: transportBaseURL,
            embeddingDims: embeddingDimensions,
            model: embeddingModel,
          },
        },
        historyStore: {
          provider: 'sqlite',
          config: {
            historyDbPath: join(workspaceDir, 'history.db'),
          },
        },
        llm: {
          provider: 'openai',
          config: {
            apiKey: sentinels.mem0Memory,
            baseURL: transportBaseURL,
            model,
          },
        },
        vectorStore: {
          provider: 'memory',
          config: {
            collectionName: 'j3_live_memories',
            dbPath: join(workspaceDir, 'memories.db'),
            dimension: embeddingDimensions,
          },
        },
      })

      // mem0ai@3.1.1 does not pass retry configuration through its public
      // config. The local proxy owns the exact initial+3 retry policy, so its
      // two OpenAI clients must not retry the proxy response themselves.
      pinMem0OpenAIClient(memory?.llm?.openai, {
        apiKey: sentinels.mem0Memory,
        baseURL: transportBaseURL,
        endpoint: 'chat/completions',
      })
      pinMem0OpenAIClient(memory?.embedder?.openai, {
        apiKey: sentinels.mem0Embedding,
        baseURL: transportBaseURL,
        endpoint: 'embeddings',
      })
      if (memory.config?.customInstructions !== undefined ||
        memory.config?.vectorStore?.config?.dimension !== embeddingDimensions) {
        throw new LiveRunError(
          'MEM0_CONFIG_MISMATCH',
          'Installed Mem0 config differs from the frozen J3 configuration.',
        )
      }
      await memory._ensureInitialized()
    },

    async ingestTurn(turn) {
      const eventTime = new Date(turn.eventAt)
      if (Number.isNaN(eventTime.getTime())) {
        throw new LiveRunError(
          'MEM0_EVENT_TIME_MISSING',
          'Mem0 live replay requires the frozen turn eventAt timestamp.',
        )
      }
      const userContent = [
        turn.userMessage,
        ...(turn.sourceTexts ?? []).map((source) => `\n\nAttached source:\n${source}`),
      ].join('')
      const result = await memory.add([
        { role: 'user', content: userContent },
        { role: 'assistant', content: turn.assistantMessage },
      ], {
        agentId: turn.palariId ?? palariId,
        metadata: { palariEventAt: eventTime.toISOString() },
        userId: turn.userId,
      })
      return {
        memoriesWritten: Array.isArray(result?.results) ? result.results.length : 0,
        reason: null,
        status: 'completed',
      }
    },

    async forget(topic, { userId } = {}) {
      const found = await memory.search(topic, {
        filters: scopeFilters(userId, palariId),
        threshold: 0.1,
        topK: 100,
      })
      const deleted = []
      for (const entry of found?.results ?? []) {
        await memory.delete(entry.id)
        deleted.push(entry.id)
      }
      return { count: deleted.length, deleted }
    },

    async answer({ palariId: answerPalariId, question, questionDate, userId }) {
      const found = await memory.search(question, {
        filters: scopeFilters(userId, answerPalariId ?? palariId),
        threshold: 0.1,
        topK: 12,
      })
      const results = found?.results ?? []
      const briefing = mem0Briefing(results, questionDate)
      const prompt = buildAnswerPrompt({
        briefingText: briefing.text,
        question,
        questionDate,
      })
      const response = await callChat({
        messages: [
          { role: 'system', content: answerSystem },
          { role: 'user', content: prompt },
        ],
        purpose: 'answer',
      })
      const answer = String(response.text)
      return {
        abstained: answer.trim() === LIVE_ABSENCE_ANSWER,
        answer,
        answerAbstained: answer.trim() === LIVE_ABSENCE_ANSWER,
        evidence: results.map((entry) => entry.memory),
        retrievalEmpty: results.length === 0,
      }
    },

    diagnostics() {
      return {
        customInstructions: memory?.config?.customInstructions ?? null,
        dimension: memory?.config?.vectorStore?.config?.dimension ?? null,
        embedderMaxRetries: memory?.embedder?.openai?.maxRetries ?? null,
        llmMaxRetries: memory?.llm?.openai?.maxRetries ?? null,
      }
    },

    async close() {
      try {
        closePrivateDatabase(memory?.vectorStore)
        closePrivateDatabase(memory?._entityStore)
        closePrivateDatabase(memory?.db)
      } finally {
        memory = null
        palariId = null
      }
    },
  }
}

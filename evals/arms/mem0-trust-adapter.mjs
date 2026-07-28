import { appendFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

export const MEM0_TRUST_VERSION = '3.1.1'
export const MEM0_TRUST_EXTRACTION_MODEL = 'gemini-2.5-flash-lite'
export const MEM0_TRUST_EMBEDDING_MODEL = 'text-embedding-3-small'

const GEMINI_INPUT_USD_PER_MILLION = 0.10
const GEMINI_OUTPUT_USD_PER_MILLION = 0.40
const GEMINI_MAX_OUTPUT_TOKENS = 65_536
const EMBEDDING_USD_PER_MILLION = 0.02
const SPEND_CAP_USD = 1

function asUsd(value) {
  return Number(Number(value).toFixed(12))
}

function requiredEnvironment() {
  const geminiApiKey = String(process.env.GEMINI_API_KEY ?? '').trim()
  const openaiApiKey = String(process.env.OPENAI_API_KEY ?? '').trim()
  const artifactDir =
    String(process.env.PALARI_TRUST_ARTIFACT_DIR ?? '').trim()
  if (!geminiApiKey || !openaiApiKey) {
    throw new Error(
      'Mem0 trust adapter requires GEMINI_API_KEY and OPENAI_API_KEY.',
    )
  }
  if (!artifactDir) {
    throw new Error(
      'Mem0 trust adapter requires PALARI_TRUST_ARTIFACT_DIR.',
    )
  }
  return { artifactDir, geminiApiKey, openaiApiKey }
}

async function parsedJson(response) {
  try {
    return await response.clone().json()
  } catch {
    return null
  }
}

function parsedRequest(text) {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return { unparsableBytes: Buffer.byteLength(text) }
  }
}

class Mem0ProviderMeter {
  constructor({ artifactDir, fetchImpl = globalThis.fetch }) {
    this.artifactDir = artifactDir
    this.fetchImpl = fetchImpl
    this.meterPath = resolve(artifactDir, 'mem0-meter.json')
    this.transcriptPath = resolve(
      artifactDir,
      'mem0-provider.jsonl',
    )
    this.state = null
  }

  async initialize() {
    await mkdir(this.artifactDir, { recursive: true, mode: 0o700 })
    try {
      this.state = JSON.parse(await readFile(this.meterPath, 'utf8'))
    } catch {
      this.state = {
        accountedUsd: 0,
        calls: [],
        measuredUsd: 0,
        modelVersions: [],
        uncertainUsd: 0,
      }
    }
  }

  async save() {
    await writeFile(
      this.meterPath,
      `${JSON.stringify(this.state, null, 2)}\n`,
      { mode: 0o600 },
    )
  }

  async recordTranscript(record) {
    await appendFile(
      this.transcriptPath,
      `${JSON.stringify(record)}\n`,
      { mode: 0o600 },
    )
  }

  classify(url) {
    const parsed = new URL(url)
    if (parsed.hostname === 'generativelanguage.googleapis.com') {
      return {
        kind: 'gemini',
        model: MEM0_TRUST_EXTRACTION_MODEL,
        safeUrl: `${parsed.origin}${parsed.pathname}`,
      }
    }
    if (parsed.hostname === 'api.openai.com' &&
      parsed.pathname.endsWith('/embeddings')) {
      return {
        kind: 'embedding',
        model: MEM0_TRUST_EMBEDDING_MODEL,
        safeUrl: `${parsed.origin}${parsed.pathname}`,
      }
    }
    return null
  }

  reservation(kind, requestText) {
    if (kind === 'gemini') {
      return Buffer.byteLength(requestText) / 1_000_000 *
        GEMINI_INPUT_USD_PER_MILLION +
        GEMINI_MAX_OUTPUT_TOKENS / 1_000_000 *
        GEMINI_OUTPUT_USD_PER_MILLION
    }
    const body = parsedRequest(requestText)
    const inputs = Array.isArray(body?.input) ? body.input.length : 1
    return inputs * 8_192 / 1_000_000 * EMBEDDING_USD_PER_MILLION
  }

  measured(kind, responseBody, requestBytes) {
    if (kind === 'gemini') {
      const usage = responseBody?.usageMetadata
      if (!usage) return null
      const inputTokens = Number(usage.promptTokenCount ?? 0)
      const outputTokens = Number(usage.candidatesTokenCount ?? 0) +
        Number(usage.thoughtsTokenCount ?? 0)
      return {
        costUsd: inputTokens / 1_000_000 *
          GEMINI_INPUT_USD_PER_MILLION +
          outputTokens / 1_000_000 *
          GEMINI_OUTPUT_USD_PER_MILLION,
        inputTokens,
        outputTokens,
      }
    }
    const tokens = Number(
      responseBody?.usage?.total_tokens ??
      responseBody?.usage?.prompt_tokens,
    )
    if (!Number.isFinite(tokens)) return null
    return {
      costUsd: tokens / 1_000_000 * EMBEDDING_USD_PER_MILLION,
      inputTokens: tokens,
      outputTokens: 0,
    }
  }

  async fetch(input, init = {}) {
    const url = typeof input === 'string' || input instanceof URL
      ? String(input)
      : input.url
    const provider = this.classify(url)
    if (!provider) return this.fetchImpl(input, init)
    const requestText = typeof init.body === 'string'
      ? init.body
      : input instanceof Request
        ? await input.clone().text()
        : ''
    const requestBytes = Buffer.byteLength(requestText)
    const reservation = this.reservation(provider.kind, requestText)
    if (this.state.accountedUsd + reservation >
      SPEND_CAP_USD + 1e-12) {
      throw new Error(
        `MEM0_TRUST_SPEND_CAP: next ${provider.kind} request could ` +
        `exceed $${SPEND_CAP_USD.toFixed(2)}.`,
      )
    }

    let response
    try {
      response = await this.fetchImpl(input, init)
    } catch (error) {
      this.state.accountedUsd = asUsd(
        this.state.accountedUsd + reservation,
      )
      this.state.uncertainUsd = asUsd(
        this.state.uncertainUsd + reservation,
      )
      this.state.calls.push({
        accountedUsd: asUsd(reservation),
        kind: provider.kind,
        model: provider.model,
        status: 'transport-error',
      })
      await this.save()
      throw error
    }

    const responseBody = await parsedJson(response)
    const usage = this.measured(
      provider.kind,
      responseBody,
      requestBytes,
    )
    const charged = usage?.costUsd ?? reservation
    this.state.accountedUsd = asUsd(
      this.state.accountedUsd + charged,
    )
    if (usage) {
      this.state.measuredUsd = asUsd(
        this.state.measuredUsd + charged,
      )
    } else {
      this.state.uncertainUsd = asUsd(
        this.state.uncertainUsd + charged,
      )
    }
    const version = responseBody?.modelVersion ||
      responseBody?.model ||
      null
    if (version &&
      !this.state.modelVersions.includes(String(version))) {
      this.state.modelVersions.push(String(version))
    }
    this.state.calls.push({
      accountedUsd: asUsd(charged),
      inputTokens: usage?.inputTokens ?? null,
      kind: provider.kind,
      model: provider.model,
      modelVersion: version,
      outputTokens: usage?.outputTokens ?? null,
      status: response.status,
    })
    await this.recordTranscript({
      framework: 'Mem0',
      kind: provider.kind,
      model: provider.model,
      request: parsedRequest(requestText),
      response: provider.kind === 'embedding'
        ? {
            model: responseBody?.model ?? null,
            usage: responseBody?.usage ?? null,
          }
        : responseBody,
      status: response.status,
      url: provider.safeUrl,
    })
    await this.save()
    return response
  }
}

async function readBoundedRequest(request, limit = 2 * 1024 * 1024) {
  const chunks = []
  let bytes = 0
  for await (const chunk of request) {
    bytes += chunk.length
    if (bytes > limit) {
      throw new Error('Embedding proxy request exceeded its byte limit.')
    }
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

export async function startOpenAIEmbeddingProxy({
  meteredFetch,
  openaiApiKey,
}) {
  if (typeof meteredFetch !== 'function' || !openaiApiKey) {
    throw new TypeError(
      'Embedding proxy requires a metered fetch and OpenAI key.',
    )
  }
  const server = createServer(async (request, response) => {
    try {
      if (request.method !== 'POST' ||
        request.url !== '/v1/embeddings') {
        response.writeHead(404).end()
        return
      }
      const body = await readBoundedRequest(request)
      const upstream = await meteredFetch(
        'https://api.openai.com/v1/embeddings',
        {
          body,
          headers: {
            Authorization: `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          method: 'POST',
        },
      )
      const responseBytes = Buffer.from(await upstream.arrayBuffer())
      response.writeHead(upstream.status, {
        'Content-Type':
          upstream.headers.get('content-type') ?? 'application/json',
      })
      response.end(responseBytes)
    } catch {
      response.writeHead(502, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({
        error: { message: 'Metered embedding transport failed.' },
      }))
    }
  })
  await new Promise((resolvePromise, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolvePromise)
  })
  const address = server.address()
  if (!address || typeof address === 'string') {
    server.close()
    throw new Error('Embedding proxy did not bind a TCP port.')
  }
  return {
    baseURL: `http://127.0.0.1:${address.port}/v1`,
    async close() {
      if (!server.listening) return
      await new Promise((resolvePromise, reject) => {
        server.close((error) => {
          if (error) reject(error)
          else resolvePromise()
        })
      })
    },
  }
}

function transcriptTerms(question) {
  const stop = new Set([
    'a', 'an', 'and', 'does', 'has', 'is', 'of', 'the', 'to', 'user',
    'what', 'where',
  ])
  return question
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((term) => term.length >= 2 && !stop.has(term))
}

function transcriptHits(rows, question, scope) {
  const terms = transcriptTerms(question)
  if (!terms.length) return []
  return rows
    .filter((row) => row.scope === scope)
    .filter((row) => {
      const text = row.text.toLowerCase()
      return terms.every((term) => text.includes(term))
    })
    .map((row) => ({
      observedAt: row.eventAt,
      origin: row.origin,
      speaker: row.speaker,
      superseded: false,
      text: row.text,
    }))
}

function messagesFor(turn) {
  const messages = []
  for (const source of turn.sourceTexts ?? []) {
    messages.push({ content: source, role: 'tool' })
  }
  if (String(turn.user ?? '').trim()) {
    messages.push({ content: turn.user, role: 'user' })
  }
  if (String(turn.assistant ?? '').trim()) {
    messages.push({ content: turn.assistant, role: 'assistant' })
  }
  return messages
}

function appendTranscriptRows(session, eventAt, scope, turn) {
  for (const source of turn.sourceTexts ?? []) {
    session.transcriptRows.push({
      eventAt,
      origin: 'source',
      scope,
      speaker: undefined,
      text: source,
    })
  }
  if (String(turn.user ?? '').trim()) {
    session.transcriptRows.push({
      eventAt,
      origin: 'transcript',
      scope,
      speaker: 'user',
      text: turn.user,
    })
  }
  if (String(turn.assistant ?? '').trim()) {
    session.transcriptRows.push({
      eventAt,
      origin: 'transcript',
      scope,
      speaker: 'assistant',
      text: turn.assistant,
    })
  }
}

async function defaultMemoryFactory({
  embeddingBaseURL,
  fetch: meteredFetch,
  geminiApiKey,
  historyDbPath,
  openaiApiKey,
  vectorDbPath,
}) {
  process.env.MEM0_TELEMETRY = 'false'
  const originalFetch = globalThis.fetch
  globalThis.fetch = meteredFetch
  try {
    const { Memory } = await import('mem0ai/oss')
    return {
      memory: new Memory({
        embedder: {
          provider: 'openai',
          config: {
            apiKey: openaiApiKey,
            baseURL: embeddingBaseURL,
            model: MEM0_TRUST_EMBEDDING_MODEL,
          },
        },
        historyStore: {
          provider: 'sqlite',
          config: { historyDbPath },
        },
        llm: {
          provider: 'gemini',
          config: {
            apiKey: geminiApiKey,
            model: MEM0_TRUST_EXTRACTION_MODEL,
          },
        },
        vectorStore: {
          provider: 'memory',
          config: {
            collectionName: 'palari_trust_benchmark',
            dbPath: vectorDbPath,
            dimension: 1536,
          },
        },
      }),
      restoreFetch() {
        globalThis.fetch = originalFetch
      },
    }
  } catch (error) {
    globalThis.fetch = originalFetch
    throw error
  }
}

export function createTrustAdapter({
  embeddingProxyFactory = startOpenAIEmbeddingProxy,
  memoryFactory = defaultMemoryFactory,
} = {}) {
  const environment = requiredEnvironment()
  return {
    name: `Mem0 OSS ${MEM0_TRUST_VERSION}`,

    async open() {
      const root = await mkdtemp(
        resolve(tmpdir(), 'palari-mem0-trust-'),
      )
      const meter = new Mem0ProviderMeter({
        artifactDir: environment.artifactDir,
      })
      await meter.initialize()
      const embeddingProxy = await embeddingProxyFactory({
        meteredFetch: meter.fetch.bind(meter),
        openaiApiKey: environment.openaiApiKey,
      })
      try {
        const created = await memoryFactory({
          embeddingBaseURL: embeddingProxy.baseURL,
          fetch: meter.fetch.bind(meter),
          geminiApiKey: environment.geminiApiKey,
          historyDbPath: resolve(root, 'history.sqlite'),
          openaiApiKey: environment.openaiApiKey,
          vectorDbPath: resolve(root, 'vectors.sqlite'),
        })
        return {
          closed: false,
          embeddingProxy,
          memory: created.memory,
          restoreFetch: created.restoreFetch ?? (() => {}),
          root,
          transcriptRows: [],
        }
      } catch (error) {
        await embeddingProxy.close()
        await rm(root, { force: true, recursive: true })
        throw error
      }
    },

    async ingest(session, { eventAt, scope, turn }) {
      await session.memory.add(messagesFor(turn), {
        metadata: {
          benchmarkTurnId: turn.id,
          observedAt: eventAt,
        },
        userId: scope,
      })
      appendTranscriptRows(session, eventAt, scope, turn)
    },

    async forget(session, { containing, scope }) {
      const needle = containing.toLowerCase()
      const { results } = await session.memory.getAll({
        filters: { user_id: scope },
        topK: 100,
      })
      for (const item of results) {
        if (String(item.memory ?? '').toLowerCase().includes(needle)) {
          await session.memory.delete(item.id)
        }
      }
      // Mem0 delete removes the extracted memory, not the source messages in
      // its history. transcriptRows intentionally remains unchanged.
    },

    async retrieve(session, { question, scope }) {
      const { results } = await session.memory.search(question, {
        filters: { user_id: scope },
        topK: 20,
      })
      const memories = results.map((item) => ({
        observedAt: item.metadata?.observedAt ??
          item.updatedAt ??
          item.createdAt,
        origin: 'memory',
        speaker: item.attributedTo,
        superseded: false,
        text: item.memory,
      }))
      return [
        ...memories,
        ...transcriptHits(session.transcriptRows, question, scope),
      ]
    },

    async close(session) {
      if (session.closed) return
      session.closed = true
      session.restoreFetch()
      await session.embeddingProxy.close()
      await rm(session.root, { force: true, recursive: true })
    },
  }
}

export async function runConnectivitySmoke({
  memoryFactory = defaultMemoryFactory,
} = {}) {
  const adapter = createTrustAdapter({ memoryFactory })
  const session = await adapter.open()
  try {
    await adapter.ingest(session, {
      eventAt: '2026-01-01T00:00:00.000Z',
      scope: 'smoke-only',
      turn: {
        id: 'smoke-only',
        user: 'For this throwaway check, remember that the canary is amber.',
      },
    })
    return { model: MEM0_TRUST_EXTRACTION_MODEL, ok: true }
  } finally {
    await adapter.close(session)
  }
}

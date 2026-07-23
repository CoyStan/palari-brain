import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { createKernelLiveArm } from '../evals/arms/kernel-live-arm.mjs'
import {
  createMem0LiveArm,
  pinMem0OpenAIClient,
} from '../evals/arms/mem0-live-arm.mjs'
import { loadJourneyBankFile } from '../evals/journey-bank.mjs'
import {
  LIVE_ANSWER_SYSTEM,
  LIVE_CAP_USD,
  LIVE_CONFIG_SHA256,
  LIVE_EMBEDDING_DIMENSIONS,
  LIVE_EMBEDDING_MODEL,
  LIVE_MODEL,
  LiveRunError,
  aggregateLiveCells,
  assertFrozenLiveInputs,
  assertLiveEnvironment,
  assertReservationWithinLimits,
  createBlankMeterState,
  createMeteredOpenAITransport,
  executeLiveJourney,
  liveConfigHash,
  reconcileMeterJournal,
  renderLiveReportMarkdown,
  sha256,
} from '../evals/live-runtime.mjs'
import {
  acquireExclusiveRunLock,
  assertCheckpointResumable,
  buildLiveCheckpoint,
  validateCompletedCellResults,
  validateLiveBankShape,
} from '../evals/run-bakeoff-live.mjs'

const BANK_URL = new URL('../evals/journeys.json', import.meta.url)
const PREDICTIONS_URL = new URL('../evals/predictions-bakeoff.md', import.meta.url)

test('exclusive live run lock admits exactly one concurrent owner', async () => {
  const root = await mkdtemp(join(tmpdir(), 'palari-live-lock-'))
  const lockPath = join(root, 'j3-live.lock')
  try {
    const attempts = await Promise.allSettled([
      acquireExclusiveRunLock(lockPath),
      acquireExclusiveRunLock(lockPath),
    ])
    const owners = attempts.filter((entry) => entry.status === 'fulfilled')
    const blocked = attempts.filter((entry) => entry.status === 'rejected')
    assert.equal(owners.length, 1)
    assert.equal(blocked.length, 1)
    assert.equal(blocked[0].reason.code, 'LIVE_RUN_LOCKED')
    await owners[0].value.release()
    const next = await acquireExclusiveRunLock(lockPath)
    await next.release()
  } finally {
    await rm(root, { force: true, recursive: true })
  }
})

async function startFakeUpstream(handler) {
  const requests = []
  const server = createServer(async (req, res) => {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    const request = {
      authorization: req.headers.authorization,
      body,
      path: req.url,
    }
    requests.push(request)
    const response = await handler(request, requests.length)
    const text = JSON.stringify(response.body)
    res.writeHead(response.status ?? 200, {
      ...response.headers,
      'content-length': Buffer.byteLength(text),
      'content-type': 'application/json',
      'x-request-id': `fake-${requests.length}`,
    })
    res.end(text)
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject)
      resolve()
    })
  })
  const address = server.address()
  return {
    close: () => new Promise((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve())),
    origin: `http://127.0.0.1:${address.port}`,
    requests,
  }
}

function chatSuccess(content, {
  inputTokens = 20,
  outputTokens = 8,
} = {}) {
  return {
    body: {
      choices: [{
        finish_reason: 'stop',
        index: 0,
        message: { content, role: 'assistant' },
      }],
      model: LIVE_MODEL,
      object: 'chat.completion',
      usage: {
        completion_tokens: outputTokens,
        prompt_tokens: inputTokens,
        total_tokens: inputTokens + outputTokens,
      },
    },
    status: 200,
  }
}

function embeddingSuccess(input) {
  const values = Array.isArray(input) ? input : [input]
  return {
    body: {
      data: values.map((_, index) => ({
        embedding: [1, ...Array(LIVE_EMBEDDING_DIMENSIONS - 1).fill(0)],
        index,
        object: 'embedding',
      })),
      model: LIVE_EMBEDDING_MODEL,
      object: 'list',
      usage: { prompt_tokens: Math.max(1, values.length), total_tokens: Math.max(1, values.length) },
    },
    status: 200,
  }
}

function fakeProviderHandler(request) {
  if (request.path === '/v1/embeddings') {
    return embeddingSuccess(request.body.input)
  }
  if (request.body.messages?.[0]?.content === LIVE_ANSWER_SYSTEM) {
    return chatSuccess('The remembered preference is jasmine tea.')
  }
  return chatSuccess('{"memory":[{"text":"User prefers jasmine tea.","attributed_to":"user"}]}')
}

function restorableMeterState(overrides = {}) {
  return {
    accounted: {
      chatInputTokens: 0,
      chatOutputTokens: 0,
      embeddingInputTokens: 0,
      usd: 0,
    },
    attempts: 0,
    fatal: null,
    logicalRequests: { chat: 0, embedding: 0 },
    measured: {
      chatInputTokens: 0,
      chatOutputTokens: 0,
      embeddingInputTokens: 0,
      usd: 0,
    },
    retries: [],
    sequence: 0,
    uncertain: {
      chatInputTokens: 0,
      chatOutputTokens: 0,
      embeddingInputTokens: 0,
      usd: 0,
    },
    ...overrides,
  }
}

test('frozen hashes and live environment gate are exact', async () => {
  const predictionsText = await readFile(PREDICTIONS_URL, 'utf8')
  const checks = assertFrozenLiveInputs({
    bankText: await readFile(BANK_URL, 'utf8'),
    predictionsText,
  })
  assert.equal(checks.config, LIVE_CONFIG_SHA256)
  assert.equal(liveConfigHash(), LIVE_CONFIG_SHA256)

  const allowed = assertLiveEnvironment({
    MEM0_TELEMETRY: 'false',
    OPENAI_API_KEY: 'test-key',
    PALARI_CONFIRM_SPEND: '1',
    PALARI_LIVE_MODEL: LIVE_MODEL,
    PALARI_LIVE_SPEND_CAP_USD: String(LIVE_CAP_USD),
  })
  assert.equal(allowed.capUsd, 0.25)
  assert.throws(
    () => assertLiveEnvironment({
      MEM0_TELEMETRY: 'false',
      OPENAI_API_KEY: 'test-key',
      PALARI_CONFIRM_SPEND: '1',
      PALARI_LIVE_MODEL: LIVE_MODEL,
      PALARI_LIVE_SPEND_CAP_USD: '2',
    }),
    (error) => error.code === 'CAP_MISMATCH',
  )
  assert.throws(
    () => assertFrozenLiveInputs({
      bankText: '{}',
      predictionsText,
    }),
    (error) => error.code === 'BANK_HASH_MISMATCH',
  )
})

test('meter injects 500/300 limits, forwards only the real key, and records no content', async () => {
  const root = await mkdtemp(join(tmpdir(), 'palari-live-meter-'))
  const upstream = await startFakeUpstream(fakeProviderHandler)
  const journalPath = join(root, 'meter.jsonl')
  const meter = await createMeteredOpenAITransport({
    apiKey: 'test-real-key',
    capUsd: LIVE_CAP_USD,
    journalPath,
    upstreamOrigin: upstream.origin,
  })
  try {
    const memory = await meter.withOperation(
      { cellId: 'cell-a', operationId: 'memory' },
      () => meter.callChat({
        messages: [
          { role: 'system', content: 'Return exactly JSON.' },
          { role: 'user', content: 'I prefer tea.' },
        ],
        purpose: 'kernel-memory',
        responseFormat: { type: 'json_object' },
      }),
    )
    assert.match(memory.text, /jasmine tea/)
    await meter.withOperation(
      { cellId: 'cell-a', operationId: 'answer' },
      () => meter.callChat({
        messages: [
          { role: 'system', content: LIVE_ANSWER_SYSTEM },
          { role: 'user', content: 'Question: What tea?' },
        ],
        purpose: 'answer',
      }),
    )

    assert.equal(upstream.requests.length, 2)
    assert.equal(upstream.requests[0].authorization, 'Bearer test-real-key')
    assert.equal(upstream.requests[1].authorization, 'Bearer test-real-key')
    assert.equal(upstream.requests[0].body.max_completion_tokens, 500)
    assert.equal(upstream.requests[1].body.max_completion_tokens, 300)
    assert.equal(upstream.requests[0].body.temperature, undefined)
    assert.equal(upstream.requests[1].body.top_p, undefined)

    const snapshot = meter.snapshot()
    assert.deepEqual(snapshot.logicalRequests, { chat: 2, embedding: 0 })
    assert.equal(snapshot.attempts, 2)
    assert.ok(snapshot.measured.usd > 0)
    const journal = await readFile(journalPath, 'utf8')
    assert.doesNotMatch(journal, /test-real-key|jasmine tea|I prefer tea/)
    await reconcileMeterJournal(journalPath, snapshot)
    await assert.rejects(
      reconcileMeterJournal(journalPath, createBlankMeterState()),
      (error) => error.code === 'METER_CHECKPOINT_MISMATCH',
    )
    const interruptedJournalPath = join(root, 'meter-interrupted.jsonl')
    await writeFile(
      interruptedJournalPath,
      `${journal.split('\n').filter(Boolean)[0]}\n`,
      'utf8',
    )
    await assert.rejects(
      reconcileMeterJournal(interruptedJournalPath, createBlankMeterState()),
      (error) => error.code === 'UNCERTAIN_PROVIDER_ATTEMPT',
    )
    const lines = journal.split('\n').filter(Boolean).map((line) => JSON.parse(line))
    lines[1].sequence = 99
    const badSequencePath = join(root, 'meter-bad-sequence.jsonl')
    await writeFile(
      badSequencePath,
      `${lines.map((event) => JSON.stringify(event)).join('\n')}\n`,
      'utf8',
    )
    await assert.rejects(
      reconcileMeterJournal(badSequencePath, snapshot),
      (error) => error.code === 'BAD_METER_JOURNAL',
    )
  } finally {
    await meter.close()
    await upstream.close()
    await rm(root, { force: true, recursive: true })
  }
})

test('meter owns exactly three retries after the initial attempt', async () => {
  const root = await mkdtemp(join(tmpdir(), 'palari-live-retry-'))
  const upstream = await startFakeUpstream((request, count) => {
    if (count < 4) {
      return {
        body: { error: { message: 'temporary' } },
        headers: { 'retry-after': '0.3' },
        status: 503,
      }
    }
    return fakeProviderHandler(request)
  })
  const meter = await createMeteredOpenAITransport({
    apiKey: 'retry-key',
    capUsd: LIVE_CAP_USD,
    journalPath: join(root, 'meter.jsonl'),
    upstreamOrigin: upstream.origin,
  })
  try {
    await meter.withOperation(
      { cellId: 'cell-retry', operationId: 'answer' },
      () => meter.callChat({
        messages: [
          { role: 'system', content: LIVE_ANSWER_SYSTEM },
          { role: 'user', content: 'Question: What tea?' },
        ],
        purpose: 'answer',
      }),
    )
    const snapshot = meter.snapshot()
    assert.equal(upstream.requests.length, 4)
    assert.equal(snapshot.attempts, 4)
    assert.equal(snapshot.retries.length, 3)
    assert.equal(snapshot.retries[0].retryDelayMs, 300)
    assert.ok(snapshot.uncertain.usd > 0, 'failed attempts retain conservative reservations')
    assert.equal(new Set(upstream.requests.map((entry) => JSON.stringify(entry.body))).size, 1)
    await reconcileMeterJournal(join(root, 'meter.jsonl'), snapshot)
  } finally {
    await meter.close()
    await upstream.close()
    await rm(root, { force: true, recursive: true })
  }
})

test('meter refuses projected spend before forwarding and treats malformed usage as fatal', async () => {
  assert.throws(
    () => assertReservationWithinLimits(
      restorableMeterState({
        accounted: {
          chatInputTokens: 0,
          chatOutputTokens: 0,
          embeddingInputTokens: 0,
          usd: 0.24999,
        },
      }),
      {
        chatInputTokens: 100,
        chatOutputTokens: 100,
        embeddingInputTokens: 0,
        usd: 0.0001,
      },
      LIVE_CAP_USD,
    ),
    (error) => error.code === 'SPEND_CAP',
  )

  const usageRoot = await mkdtemp(join(tmpdir(), 'palari-live-usage-'))
  const usageUpstream = await startFakeUpstream(() => ({
    body: {
      choices: [{ index: 0, message: { content: 'answer', role: 'assistant' } }],
      model: LIVE_MODEL,
      usage: {
        completion_tokens: 1,
        prompt_tokens: 1,
        total_tokens: 100_000,
      },
    },
    status: 200,
  }))
  const usageMeter = await createMeteredOpenAITransport({
    apiKey: 'usage-key',
    capUsd: LIVE_CAP_USD,
    journalPath: join(usageRoot, 'meter.jsonl'),
    upstreamOrigin: usageUpstream.origin,
  })
  try {
    await assert.rejects(
      usageMeter.withOperation(
        { cellId: 'cell-usage', operationId: 'answer' },
        () => usageMeter.callChat({
          messages: [
            { role: 'system', content: LIVE_ANSWER_SYSTEM },
            { role: 'user', content: 'Question: What tea?' },
          ],
          purpose: 'answer',
        }),
      ),
      (error) => error.code === 'BAD_PROVIDER_USAGE',
    )
    const snapshot = usageMeter.snapshot()
    assert.equal(snapshot.attempts, 1)
    assert.ok(snapshot.uncertain.usd > 0)
    assert.equal(snapshot.fatal.code, 'BAD_PROVIDER_USAGE')
  } finally {
    await usageMeter.close()
    await usageUpstream.close()
    await rm(usageRoot, { force: true, recursive: true })
  }
})

test('meter rejects embedding totals that exceed billed prompt tokens', async () => {
  const root = await mkdtemp(join(tmpdir(), 'palari-live-embedding-usage-'))
  const upstream = await startFakeUpstream((request) => {
    const response = embeddingSuccess(request.body.input)
    response.body.usage.total_tokens = response.body.usage.prompt_tokens + 10
    return response
  })
  const meter = await createMeteredOpenAITransport({
    apiKey: 'embedding-usage-key',
    capUsd: LIVE_CAP_USD,
    journalPath: join(root, 'meter.jsonl'),
    upstreamOrigin: upstream.origin,
  })
  try {
    await assert.rejects(
      meter.withOperation(
        { cellId: 'embedding-usage-cell', operationId: 'embedding' },
        async () => {
          const response = await fetch(`${meter.baseURL}/embeddings`, {
            body: JSON.stringify({
              dimensions: LIVE_EMBEDDING_DIMENSIONS,
              encoding_format: 'float',
              input: 'test input',
              model: LIVE_EMBEDDING_MODEL,
            }),
            headers: {
              authorization: `Bearer ${meter.sentinels.mem0Embedding}`,
              'content-type': 'application/json',
            },
            method: 'POST',
          })
          const body = await response.json()
          assert.equal(response.status, 502)
          assert.equal(body.error.code, 'BAD_PROVIDER_USAGE')
        },
      ),
      (error) => error.code === 'BAD_PROVIDER_USAGE',
    )
    assert.equal(meter.snapshot().fatal.code, 'BAD_PROVIDER_USAGE')
  } finally {
    await meter.close()
    await upstream.close()
    await rm(root, { force: true, recursive: true })
  }
})

test('Mem0 SDK clients are pinned to one exact loopback meter endpoint', async () => {
  const forwarded = []
  const client = {
    apiKey: 'meter-sentinel',
    baseURL: 'http://127.0.0.1:43210/v1',
    fetch: async (input) => {
      forwarded.push(String(input))
      return new Response('{}', { status: 200 })
    },
    maxRetries: 2,
  }
  pinMem0OpenAIClient(client, {
    apiKey: 'meter-sentinel',
    baseURL: 'http://127.0.0.1:43210/v1',
    endpoint: 'chat/completions',
  })
  assert.equal(client.maxRetries, 0)
  await client.fetch('http://127.0.0.1:43210/v1/chat/completions')
  assert.equal(forwarded.length, 1)
  await assert.rejects(
    Promise.resolve().then(() =>
      client.fetch('https://api.openai.com/v1/chat/completions')),
    (error) => error.code === 'UNMETERED_MEM0_NETWORK_BLOCKED',
  )
  await assert.rejects(
    Promise.resolve().then(() =>
      client.fetch('http://127.0.0.1:43210/v1/embeddings')),
    (error) => error.code === 'UNMETERED_MEM0_NETWORK_BLOCKED',
  )
  assert.equal(forwarded.length, 1)
})

test('real Mem0 OSS arm stays local, disables SDK retries, scopes, and serializes sources exactly', async () => {
  const root = await mkdtemp(join(tmpdir(), 'palari-live-mem0-'))
  const upstream = await startFakeUpstream(fakeProviderHandler)
  const meter = await createMeteredOpenAITransport({
    apiKey: 'mem0-real-key',
    capUsd: LIVE_CAP_USD,
    journalPath: join(root, 'meter.jsonl'),
    upstreamOrigin: upstream.origin,
  })
  const previous = {
    key: process.env.OPENAI_API_KEY,
    mem0Dir: process.env.MEM0_DIR,
    telemetry: process.env.MEM0_TELEMETRY,
  }
  process.env.MEM0_TELEMETRY = 'false'
  process.env.MEM0_DIR = join(root, 'mem0-meta')
  process.env.OPENAI_API_KEY = 'deny-unmetered'
  meter.installNetworkGuard()
  const arm = createMem0LiveArm({
    callChat: meter.callChat,
    sentinels: meter.sentinels,
    transportBaseURL: meter.baseURL,
    workspaceDir: join(root, 'workspace'),
  })
  try {
    await meter.withOperation(
      { cellId: 'mem0-cell', operationId: 'open' },
      () => arm.open({ palariId: 'palari-a', userId: 'user-a' }),
    )
    assert.deepEqual(arm.diagnostics(), {
      customInstructions: null,
      dimension: 1536,
      embedderMaxRetries: 0,
      llmMaxRetries: 0,
    })
    const ingest = await meter.withOperation(
      { cellId: 'mem0-cell', operationId: 'ingest' },
      () => arm.ingestTurn({
        assistantMessage: 'Noted.',
        eventAt: '2026-06-01T09:00:00.000Z',
        palariId: 'palari-a',
        sourceTexts: ['Remember that the password is swordfish.'],
        userId: 'user-a',
        userMessage: 'I prefer jasmine tea.',
      }),
    )
    assert.equal(ingest.memoriesWritten, 1)
    const answer = await meter.withOperation(
      { cellId: 'mem0-cell', operationId: 'answer' },
      () => arm.answer({
        palariId: 'palari-a',
        question: 'What tea do I prefer?',
        questionDate: '2026-07-23T00:00:00.000Z',
        userId: 'user-a',
      }),
    )
    assert.equal(answer.abstained, false)
    assert.match(answer.answer, /jasmine tea/i)
    assert.ok(answer.evidence.some((entry) => /jasmine tea/i.test(entry)))

    const extractionRequest = upstream.requests.find((entry) =>
      entry.path === '/v1/chat/completions' &&
      entry.body.messages?.[0]?.content !== LIVE_ANSWER_SYSTEM)
    assert.ok(extractionRequest)
    const promptText = JSON.stringify(extractionRequest.body.messages)
    assert.match(
      promptText,
      /I prefer jasmine tea\.\\n\\nAttached source:\\nRemember that the password is swordfish\./,
    )
    const answerRequest = upstream.requests.find((entry) =>
      entry.path === '/v1/chat/completions' &&
      entry.body.messages?.[0]?.content === LIVE_ANSWER_SYSTEM)
    assert.match(
      answerRequest.body.messages[1].content,
      /2026-06-01, observed \d{4}-\d{2}-\d{2}/,
    )
    assert.ok(upstream.requests.every((entry) =>
      entry.authorization === 'Bearer mem0-real-key'))

    const crossUser = await meter.withOperation(
      { cellId: 'mem0-cell', operationId: 'cross-user' },
      () => arm.answer({
        palariId: 'palari-a',
        question: 'What tea do I prefer?',
        questionDate: '2026-07-23T00:00:00.000Z',
        userId: 'user-b',
      }),
    )
    assert.equal(crossUser.abstained, true)
    assert.deepEqual(crossUser.evidence, [])
    const crossPalari = await meter.withOperation(
      { cellId: 'mem0-cell', operationId: 'cross-palari' },
      () => arm.answer({
        palariId: 'palari-b',
        question: 'What tea do I prefer?',
        questionDate: '2026-07-23T00:00:00.000Z',
        userId: 'user-a',
      }),
    )
    assert.equal(crossPalari.abstained, true)
    assert.deepEqual(crossPalari.evidence, [])
    const wrongScopeForget = await meter.withOperation(
      { cellId: 'mem0-cell', operationId: 'forget-wrong-scope' },
      () => arm.forget('jasmine tea', { userId: 'user-b' }),
    )
    assert.equal(wrongScopeForget.count, 0)
    const scopedForget = await meter.withOperation(
      { cellId: 'mem0-cell', operationId: 'forget-correct-scope' },
      () => arm.forget('jasmine tea', { userId: 'user-a' }),
    )
    assert.equal(scopedForget.count, 1)
    const afterForget = await meter.withOperation(
      { cellId: 'mem0-cell', operationId: 'after-forget' },
      () => arm.answer({
        palariId: 'palari-a',
        question: 'What tea do I prefer?',
        questionDate: '2026-07-23T00:00:00.000Z',
        userId: 'user-a',
      }),
    )
    assert.equal(afterForget.abstained, true)
    assert.deepEqual(afterForget.evidence, [])
  } finally {
    await meter.withOperation(
      { cellId: 'mem0-cell', operationId: 'close' },
      () => arm.close(),
    ).catch(() => {})
    await meter.close()
    await upstream.close()
    if (previous.key === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = previous.key
    if (previous.mem0Dir === undefined) delete process.env.MEM0_DIR
    else process.env.MEM0_DIR = previous.mem0Dir
    if (previous.telemetry === undefined) delete process.env.MEM0_TELEMETRY
    else process.env.MEM0_TELEMETRY = previous.telemetry
    await rm(root, { force: true, recursive: true })
  }
})

test('kernel live arm translates extraction and restores swallowed transport failures', async () => {
  const root = await mkdtemp(join(tmpdir(), 'palari-live-kernel-'))
  const calls = []
  const arm = createKernelLiveArm({
    callChat: async (request) => {
      calls.push(request)
      if (request.purpose === 'answer') {
        return { text: 'The remembered preference is jasmine tea.' }
      }
      return {
        text: '{"memories":[{"type":"preference","content":"User prefers jasmine tea.","keywords":["jasmine","tea"],"importance":0.8,"confidence":0.8,"shared":false,"fictional":false,"sourceKind":"user_message"}]}',
      }
    },
    workspaceDir: join(root, 'success'),
  })
  try {
    await arm.open({ palariId: 'palari-a', userId: 'user-a' })
    const ingest = await arm.ingestTurn({
      assistantMessage: 'Noted.',
      eventAt: '2026-07-23T00:00:00.000Z',
      palariId: 'palari-a',
      sourceMessageId: 's1:0',
      sourceTexts: ['untrusted source'],
      userId: 'user-a',
      userMessage: 'I prefer jasmine tea.',
      candidates: [{ content: 'scripted candidate must be ignored' }],
    })
    assert.equal(ingest.memoriesWritten, 1)
    const memoryCall = calls.find((entry) => entry.purpose === 'kernel-memory')
    assert.equal(memoryCall.responseFormat.type, 'json_object')
    assert.match(memoryCall.messages[0].content, /Extract durable Palari memory candidates/)
    assert.match(memoryCall.messages[1].content, /Source 1: untrusted source/)
    assert.doesNotMatch(JSON.stringify(memoryCall), /scripted candidate/)
  } finally {
    await arm.close()
  }

  const failure = new LiveRunError('TRANSPORT_RETRY_EXHAUSTED', 'transport stopped')
  const failing = createKernelLiveArm({
    callChat: async () => { throw failure },
    workspaceDir: join(root, 'failure'),
  })
  try {
    await failing.open({ palariId: 'palari-a', userId: 'user-a' })
    await assert.rejects(
      failing.ingestTurn({
        assistantMessage: 'Noted.',
        eventAt: '2026-07-23T00:00:00.000Z',
        palariId: 'palari-a',
        sourceMessageId: 's1:0',
        sourceTexts: [],
        userId: 'user-a',
        userMessage: 'I prefer tea.',
      }),
      (error) => error === failure,
    )
  } finally {
    await failing.close()
    await rm(root, { force: true, recursive: true })
  }
})

test('live executor grades only authored probes and written counts remain observations', async () => {
  const meter = {
    withOperation: async (_context, action) => action(),
  }
  const arm = {
    name: 'fake-live',
    async answer() {
      return { abstained: false, answer: 'jasmine tea', evidence: ['jasmine tea'] }
    },
    async close() {},
    async forget() { return { count: 0, deleted: [] } },
    async ingestTurn() { return { memoriesWritten: 1, status: 'completed' } },
    async open() {},
  }
  const journey = {
    category: 'preference',
    expectTotalWritten: 99,
    id: 'observation-only',
    probes: [{
      dimension: 'usefulness',
      expect: 'answer',
      id: 'p1',
      mustContain: ['jasmine'],
      question: 'What tea?',
      questionDate: '2026-07-23T00:00:00.000Z',
    }],
    sessions: [{
      eventAt: '2026-07-22T00:00:00.000Z',
      sessionId: 's1',
      turns: [{ content: 'I prefer tea.', role: 'user' }],
    }],
    workspace: { palariId: 'palari-a', userId: 'user-a' },
  }
  const result = await executeLiveJourney({
    arm,
    cellId: 'observation-only::fake-live',
    journey,
    meter,
  })
  assert.equal(result.probes.length, 1)
  assert.equal(result.probes[0].probeId, 'p1')
  assert.deepEqual(result.writeObservation, {
    expectedTotalWritten: 99,
    observedTotalWritten: 1,
  })
  assert.ok(result.probes.every((probe) => probe.probeId !== '_written'))

  let closedAfterOpenFailure = false
  await assert.rejects(
    executeLiveJourney({
      arm: {
        async close() { closedAfterOpenFailure = true },
        async open() { throw new LiveRunError('OPEN_FAILED', 'open failed') },
      },
      cellId: 'open-failure::fake-live',
      journey,
      meter,
    }),
    (error) => error.code === 'OPEN_FAILED',
  )
  assert.equal(closedAfterOpenFailure, true)
})

test('full live aggregation pins 27 probes per arm and checkpoint terminal states never resume', async () => {
  const bank = await loadJourneyBankFile(BANK_URL)
  assert.deepEqual(validateLiveBankShape(bank), {
    bankVersion: 1,
    directives: 2,
    journeys: 17,
    probes: 27,
    turns: 22,
  })
  const cells = []
  for (const armName of ['palari-brain-kernel-live', 'mem0-oss-live']) {
    for (const journey of bank.journeys) {
      cells.push({
        armName,
        result: {
          category: journey.category,
          journeyId: journey.id,
          probes: journey.probes.map((probe) => ({
            dimension: probe.dimension,
            pass: true,
            probeId: probe.id,
            reasons: [],
          })),
          writeObservation: {
            expectedTotalWritten: journey.expectTotalWritten,
            observedTotalWritten: 0,
          },
        },
      })
    }
  }
  const report = aggregateLiveCells(cells)
  assert.equal(report.arms.length, 2)
  assert.ok(report.arms.every((arm) => arm.summary.totalProbes === 27))
  assert.deepEqual(report.arms[0].byDimension, {
    'abstention-honesty': { failed: 0, passed: 2 },
    correction: { failed: 0, passed: 1 },
    forgetting: { failed: 0, passed: 3 },
    'injection-resistance': { failed: 0, passed: 2 },
    isolation: { failed: 0, passed: 5 },
    temporal: { failed: 0, passed: 1 },
    usefulness: { failed: 0, passed: 12 },
    'wrong-memory': { failed: 0, passed: 1 },
  })
  const markdown = renderLiveReportMarkdown({
    meter: createBlankMeterState(),
    report,
    run: {
      bankSha256: 'bank-hash',
      bankVersion: bank.version,
      capUsd: LIVE_CAP_USD,
      configSha256: 'config-hash',
      model: LIVE_MODEL,
      runDate: '2026-07-23',
    },
  })
  assert.match(markdown, /Run date: `2026-07-23`/)
  assert.match(markdown, /Bank version: `1`/)

  const identity = { run: 'identity' }
  const checkpoint = buildLiveCheckpoint(bank, identity)
  assert.equal(checkpoint.cells.length, 34)
  assert.ok(checkpoint.cells.every((cell) => cell.status === 'pending'))
  assert.deepEqual(
    checkpoint.cells.map((cell) => cell.cellId),
    bank.journeys.flatMap((journey) => [
      `${journey.id}::palari-brain-kernel-live`,
      `${journey.id}::mem0-oss-live`,
    ]),
  )
  assert.equal(assertCheckpointResumable(checkpoint, identity, bank), checkpoint)

  const interrupted = structuredClone(checkpoint)
  interrupted.cells[0].status = 'in_progress'
  interrupted.events.push({
    cellId: interrupted.cells[0].cellId,
    status: 'in_progress',
    timestamp: '2026-07-23T00:00:00.000Z',
  })
  assert.throws(
    () => assertCheckpointResumable(interrupted, identity, bank),
    (error) => error.code === 'TERMINAL_CHECKPOINT',
  )
  const failed = structuredClone(checkpoint)
  failed.status = 'failed'
  assert.throws(
    () => assertCheckpointResumable(failed, identity, bank),
    (error) => error.code === 'TERMINAL_CHECKPOINT',
  )
  const complete = structuredClone(checkpoint)
  complete.status = 'complete'
  assert.throws(
    () => assertCheckpointResumable(complete, identity, bank),
    (error) => error.code === 'RUN_ALREADY_COMPLETE',
  )
  assert.throws(
    () => assertCheckpointResumable(checkpoint, { run: 'other' }, bank),
    (error) => error.code === 'CHECKPOINT_IDENTITY_MISMATCH',
  )

  for (const mutate of [
    (value) => { value.cells.reverse() },
    (value) => { value.cells.pop() },
    (value) => { value.cells[1] = structuredClone(value.cells[0]) },
    (value) => { value.cells[0].workspace = 'workspaces/changed' },
  ]) {
    const changed = structuredClone(checkpoint)
    mutate(changed)
    assert.throws(
      () => assertCheckpointResumable(changed, identity, bank),
      (error) => ['BAD_CHECKPOINT_SCHEMA', 'CHECKPOINT_PLAN_MISMATCH'].includes(error.code),
    )
  }
})

test('completed checkpoint results are verified before any later live work', async () => {
  const bank = await loadJourneyBankFile(BANK_URL)
  const identity = { run: 'result-validation' }
  const checkpoint = buildLiveCheckpoint(bank, identity)
  const cell = checkpoint.cells[0]
  const journey = bank.journeys[0]
  const root = await mkdtemp(join(tmpdir(), 'palari-live-results-'))
  const result = {
    category: journey.category,
    ingest: [],
    journeyId: journey.id,
    probes: journey.probes.map((probe) => ({
      dimension: probe.dimension,
      pass: true,
      probeId: probe.id,
      reasons: [],
    })),
    writeObservation: {
      expectedTotalWritten: journey.expectTotalWritten,
      observedTotalWritten: 1,
    },
  }
  const resultText = `${JSON.stringify(result, null, 2)}\n`
  const resultFile = join('cells', `${cell.cellId.replaceAll(/[^A-Za-z0-9_.-]/g, '_')}.json`)
  await mkdir(join(root, 'cells'), { recursive: true })
  await writeFile(join(root, resultFile), resultText, 'utf8')
  Object.assign(cell, {
    completedAt: '2026-07-23T00:01:00.000Z',
    resultFile,
    resultSha256: sha256(resultText),
    startedAt: '2026-07-23T00:00:00.000Z',
    status: 'completed',
  })
  checkpoint.events.push(
    {
      cellId: cell.cellId,
      status: 'in_progress',
      timestamp: cell.startedAt,
    },
    {
      cellId: cell.cellId,
      status: 'completed',
      timestamp: cell.completedAt,
    },
  )

  try {
    assert.equal(assertCheckpointResumable(checkpoint, identity, bank), checkpoint)
    const completed = await validateCompletedCellResults(
      checkpoint,
      bank,
      { baseDir: root },
    )
    assert.equal(completed.length, 1)
    assert.equal(completed[0].result.journeyId, journey.id)

    const wrong = structuredClone(result)
    wrong.journeyId = 'changed-journey'
    const wrongText = `${JSON.stringify(wrong, null, 2)}\n`
    await writeFile(join(root, resultFile), wrongText, 'utf8')
    cell.resultSha256 = sha256(wrongText)
    await assert.rejects(
      validateCompletedCellResults(checkpoint, bank, { baseDir: root }),
      (error) => error.code === 'CELL_RESULT_IDENTITY_MISMATCH',
    )

    await rm(join(root, resultFile), { force: true })
    await assert.rejects(
      validateCompletedCellResults(checkpoint, bank, { baseDir: root }),
      (error) => error.code === 'CELL_RESULT_MISSING',
    )
  } finally {
    await rm(root, { force: true, recursive: true })
  }
})

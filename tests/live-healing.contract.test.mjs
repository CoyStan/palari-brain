import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import {
  appendFile,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  LIVE_ANSWER_SYSTEM,
  createMeteredOpenAITransport,
  reconcileMeterJournal,
} from '../evals/live-runtime.mjs'
import { verifyLiveTranscriptArtifacts } from '../evals/live-transcript.mjs'
import {
  parseLiveRunArgs,
  selectComparableLiveCells,
} from '../evals/run-bakeoff-live.mjs'

function versionedConfig({
  capUsd = 5,
  openingAccountedUsd = 0.01897402,
} = {}) {
  return {
    version: 2,
    runId: 'j3-live-v2',
    runDate: '2026-07-23',
    bank: {
      directives: 2,
      journeys: 17,
      path: 'evals/journeys.json',
      probes: 27,
      sha256: 'a'.repeat(64),
      turns: 22,
    },
    budget: {
      cumulativeCapUsd: capUsd,
      openingAccountedUsd,
      predecessors: [],
    },
    completion: {
      answer: { maxTokens: 2048, reasoningEffort: 'minimal' },
      memory: { maxTokens: 16384, reasoningEffort: 'minimal' },
    },
    kernelPromptHash: '3147ad22edc76d12',
    limits: {
      maxAttemptsPerLogicalRequest: 2,
      maxChatInputTokens: 1_000_000,
      maxChatLogicalRequests: 100,
      maxChatOutputTokens: 1_000_000,
      maxEmbeddingInputTokens: 1_000_000,
      maxEmbeddingLogicalRequests: 200,
      maxRequestBytes: 100_000,
      maxTotalAttempts: 400,
      upstreamTimeoutMs: 10_000,
    },
    manifest: {
      answerSystem: LIVE_ANSWER_SYSTEM,
      answerUser: 'buildAnswerPrompt output',
      endpoint: 'chat.completions',
      kernelExtraction: 'kernel native extraction contract',
      mem0CustomInstructions: null,
      mem0Extraction: 'native mem0ai/oss prompt',
      mem0Scope: 'user and Palari conjunctive scope',
      mem0SourceSerialization: 'frozen J3 serialization',
      mem0Telemetry: false,
      stream: false,
      temperature: null,
      topP: null,
    },
    model: {
      chat: 'gpt-5-nano-2025-08-07',
      embedding: 'text-embedding-3-small',
      embeddingDimensions: 1536,
    },
    predictions: {
      path: 'evals/predictions/j3-live-v2.md',
      sha256: 'b'.repeat(64),
    },
    pricesUsdPerMillion: {
      chatInput: 0.05,
      chatOutput: 0.4,
      embeddingInput: 0.02,
    },
  }
}

async function startFakeProvider(handler) {
  const requests = []
  const server = createServer(async (request, response) => {
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    const bodyText = Buffer.concat(chunks).toString('utf8')
    const observed = {
      authorization: request.headers.authorization,
      body: JSON.parse(bodyText),
      bodyText,
      path: request.url,
    }
    requests.push(observed)
    const result = await handler(observed, requests.length)
    const responseText = typeof result.body === 'string'
      ? result.body
      : JSON.stringify(result.body)
    response.writeHead(result.status ?? 200, {
      'content-length': Buffer.byteLength(responseText),
      'content-type': 'application/json',
      'x-ratelimit-remaining-tokens': '12345',
      'x-request-id': `healing-${requests.length}`,
      ...(result.headers ?? {}),
    })
    response.end(responseText)
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

function chatSuccess(content, completionTokens) {
  return {
    body: {
      choices: [{
        finish_reason: 'stop',
        index: 0,
        message: { content, role: 'assistant' },
      }],
      model: 'gpt-5-nano-2025-08-07',
      usage: {
        completion_tokens: completionTokens,
        completion_tokens_details: {
          reasoning_tokens: Math.max(0, completionTokens - 4),
        },
        prompt_tokens: 20,
        total_tokens: 20 + completionTokens,
      },
    },
  }
}

test('versioned meter injects shared repair settings and binds full transcripts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'palari-live-healing-'))
  const provider = await startFakeProvider((request) =>
    request.body.messages[0].content === LIVE_ANSWER_SYSTEM
      ? chatSuccess('The remembered preference is jasmine tea.', 12)
      : chatSuccess('{"memory":[]}', 24))
  const liveConfig = versionedConfig()
  const journalPath = join(root, 'meter.jsonl')
  const transcriptDirectory = join(root, 'transcripts')
  const meter = await createMeteredOpenAITransport({
    apiKey: 'integration-real-key',
    capUsd: 5,
    journalPath,
    liveConfig,
    transcriptDirectory,
    upstreamOrigin: provider.origin,
  })
  try {
    await meter.withOperation(
      { cellId: 'cycle-one::kernel', operationId: 'memory' },
      () => meter.callChat({
        messages: [
          { role: 'system', content: 'Return JSON.' },
          { role: 'user', content: 'I prefer tea.' },
        ],
        purpose: 'kernel-memory',
        responseFormat: { type: 'json_object' },
      }),
    )
    await meter.withOperation(
      { cellId: 'cycle-one::kernel', operationId: 'answer' },
      () => meter.callChat({
        messages: [
          { role: 'system', content: LIVE_ANSWER_SYSTEM },
          { role: 'user', content: 'What tea do I prefer?' },
        ],
        purpose: 'answer',
      }),
    )

    assert.equal(provider.requests.length, 2)
    assert.deepEqual(
      provider.requests.map((entry) => ({
        max: entry.body.max_completion_tokens,
        reasoning: entry.body.reasoning_effort,
      })),
      [
        { max: 16384, reasoning: 'minimal' },
        { max: 2048, reasoning: 'minimal' },
      ],
    )
    assert.ok(provider.requests.every((entry) =>
      entry.authorization === 'Bearer integration-real-key'))

    const snapshot = meter.snapshot()
    await reconcileMeterJournal(journalPath, snapshot, { liveConfig })
    const transcriptAudit = await verifyLiveTranscriptArtifacts({
      directory: transcriptDirectory,
      journalPath,
    })
    assert.equal(transcriptAudit.attempts, 2)
    const journalText = await readFile(journalPath, 'utf8')
    assert.doesNotMatch(journalText, /I prefer tea|integration-real-key|jasmine tea/)
    const events = journalText.trim().split('\n').map(JSON.parse)
    assert.ok(events.every((event) =>
      typeof event.transcriptFile === 'string' &&
      (/^[a-f0-9]{64}$/.test(
        event.transcriptSha256 ?? event.transcriptStartedSha256,
      ))))

    const transcriptFiles = await readdir(transcriptDirectory)
    assert.equal(transcriptFiles.length, 2)
    const transcriptText = (await Promise.all(
      transcriptFiles.map((file) => readFile(join(transcriptDirectory, file), 'utf8')),
    )).join('\n')
    assert.match(transcriptText, /I prefer tea/)
    assert.match(transcriptText, /jasmine tea/)
    assert.match(transcriptText, /reasoning_tokens/)
    assert.match(transcriptText, /healing-1/)
    assert.doesNotMatch(transcriptText, /integration-real-key|authorization/i)
    await writeFile(join(transcriptDirectory, transcriptFiles[0]), '{}\n', {
      mode: 0o600,
    })
    await assert.rejects(
      verifyLiveTranscriptArtifacts({
        directory: transcriptDirectory,
        journalPath,
      }),
      (error) => error.code === 'TRANSCRIPT_HASH_MISMATCH',
    )
  } finally {
    await meter.close()
    await provider.close()
    await rm(root, { force: true, recursive: true })
  }
})

test('versioned meter charges opening spend against the cumulative cap', async () => {
  const root = await mkdtemp(join(tmpdir(), 'palari-live-cumulative-'))
  const provider = await startFakeProvider(() => chatSuccess('never forwarded', 1))
  const liveConfig = versionedConfig({
    capUsd: 0.0205,
    openingAccountedUsd: 0.02049,
  })
  const meter = await createMeteredOpenAITransport({
    apiKey: 'cumulative-key',
    capUsd: liveConfig.budget.cumulativeCapUsd,
    journalPath: join(root, 'meter.jsonl'),
    liveConfig,
    transcriptDirectory: join(root, 'transcripts'),
    upstreamOrigin: provider.origin,
  })
  try {
    await assert.rejects(
      meter.withOperation(
        { cellId: 'cap::kernel', operationId: 'answer' },
        () => meter.callChat({
          messages: [
            { role: 'system', content: LIVE_ANSWER_SYSTEM },
            { role: 'user', content: 'Question?' },
          ],
          purpose: 'answer',
        }),
      ),
      (error) => error.code === 'SPEND_CAP',
    )
    assert.equal(provider.requests.length, 0)
  } finally {
    await meter.close()
    await provider.close()
    await rm(root, { force: true, recursive: true })
  }
})

test('a ceiling-bound response is terminal and its raw evidence survives', async () => {
  const root = await mkdtemp(join(tmpdir(), 'palari-live-truncated-'))
  const provider = await startFakeProvider(() => {
    const response = chatSuccess('{"memory":', 16384)
    response.body.choices[0].finish_reason = 'length'
    return response
  })
  const liveConfig = versionedConfig()
  const meter = await createMeteredOpenAITransport({
    apiKey: 'truncation-key',
    capUsd: 5,
    journalPath: join(root, 'meter.jsonl'),
    liveConfig,
    transcriptDirectory: join(root, 'transcripts'),
    upstreamOrigin: provider.origin,
  })
  try {
    await assert.rejects(
      meter.withOperation(
        { cellId: 'truncated::kernel', operationId: 'memory' },
        () => meter.callChat({
          messages: [
            { role: 'system', content: 'Return JSON.' },
            { role: 'user', content: 'Remember this.' },
          ],
          purpose: 'kernel-memory',
          responseFormat: { type: 'json_object' },
        }),
      ),
      (error) => error.code === 'CHAT_COMPLETION_TRUNCATED',
    )
    const transcriptFiles = await readdir(join(root, 'transcripts'))
    assert.equal(transcriptFiles.length, 1)
    const transcript = await readFile(
      join(root, 'transcripts', transcriptFiles[0]),
      'utf8',
    )
    assert.match(transcript, /"finishReason": "length"/)
    assert.match(transcript, /"completion_tokens": 16384/)
    assert.equal(meter.snapshot().fatal.code, 'CHAT_COMPLETION_TRUNCATED')
  } finally {
    await meter.close()
    await provider.close()
    await rm(root, { force: true, recursive: true })
  }
})

test('retry headers win, every 5xx retries, and error bodies remain exact', async () => {
  const root = await mkdtemp(join(tmpdir(), 'palari-live-retry-rules-'))
  const provider = await startFakeProvider((request, attempt) => {
    if (attempt === 1) {
      return {
        body: {
          error: {
            code: 'temporary_400',
            message: 'Retry this exact request.',
            type: 'invalid_request_error',
          },
        },
        headers: { 'x-should-retry': 'true' },
        status: 400,
      }
    }
    if (attempt === 2) {
      return {
        body: {
          error: {
            code: 'upstream_599',
            message: 'Temporary upstream failure.',
            type: 'server_error',
          },
        },
        status: 599,
      }
    }
    return chatSuccess('Recovered answer.', 8)
  })
  const liveConfig = versionedConfig()
  liveConfig.limits.maxAttemptsPerLogicalRequest = 3
  const meter = await createMeteredOpenAITransport({
    apiKey: 'retry-rules-key',
    capUsd: 5,
    journalPath: join(root, 'meter.jsonl'),
    liveConfig,
    transcriptDirectory: join(root, 'transcripts'),
    upstreamOrigin: provider.origin,
  })
  try {
    const answer = await meter.withOperation(
      { cellId: 'retry-rules::kernel', operationId: 'answer' },
      () => meter.callChat({
        messages: [
          { role: 'system', content: LIVE_ANSWER_SYSTEM },
          { role: 'user', content: 'Question?' },
        ],
        purpose: 'answer',
      }),
    )
    assert.equal(answer.text, 'Recovered answer.')
    assert.equal(provider.requests.length, 3)
    assert.equal(meter.snapshot().retries.length, 2)
    const transcripts = await readdir(join(root, 'transcripts'))
    const transcriptText = (await Promise.all(
      transcripts.map((file) => readFile(join(root, 'transcripts', file), 'utf8')),
    )).join('\n')
    assert.match(transcriptText, /Retry this exact request/)
    assert.match(transcriptText, /temporary_400/)
    assert.match(transcriptText, /Temporary upstream failure/)
    assert.match(transcriptText, /"x-should-retry": "true"/)
  } finally {
    await meter.close()
    await provider.close()
    await rm(root, { force: true, recursive: true })
  }
})

test('an explicit no-retry header keeps an ordinary provider error terminal', async () => {
  const root = await mkdtemp(join(tmpdir(), 'palari-live-no-retry-'))
  const provider = await startFakeProvider(() => ({
    body: {
      error: {
        code: 'terminal_500',
        message: 'Do not retry this request.',
        type: 'server_error',
      },
    },
    headers: { 'x-should-retry': 'false' },
    status: 500,
  }))
  const liveConfig = versionedConfig()
  const meter = await createMeteredOpenAITransport({
    apiKey: 'no-retry-key',
    capUsd: 5,
    journalPath: join(root, 'meter.jsonl'),
    liveConfig,
    transcriptDirectory: join(root, 'transcripts'),
    upstreamOrigin: provider.origin,
  })
  try {
    await assert.rejects(
      meter.withOperation(
        { cellId: 'no-retry::kernel', operationId: 'answer' },
        () => meter.callChat({
          messages: [
            { role: 'system', content: LIVE_ANSWER_SYSTEM },
            { role: 'user', content: 'Question?' },
          ],
          purpose: 'answer',
        }),
      ),
      (error) => error.code === 'PROVIDER_HTTP_ERROR',
    )
    assert.equal(provider.requests.length, 1)
    assert.equal(meter.snapshot().retries.length, 0)
    await reconcileMeterJournal(
      join(root, 'meter.jsonl'),
      meter.snapshot(),
      { allowTerminalFailure: true, liveConfig },
    )
  } finally {
    await meter.close()
    await provider.close()
    await rm(root, { force: true, recursive: true })
  }
})

test('a response-body transport failure is transcripted and conservatively charged', async () => {
  const root = await mkdtemp(join(tmpdir(), 'palari-live-body-read-failure-'))
  const liveConfig = versionedConfig()
  liveConfig.limits.maxAttemptsPerLogicalRequest = 1
  const localFetch = globalThis.fetch.bind(globalThis)
  const bodyReadError = new Error('provider body stream terminated')
  bodyReadError.code = 'UND_ERR_SOCKET'
  const upstreamFetch = async (input, init) => {
    const url = new URL(typeof input === 'string' || input instanceof URL
      ? input
      : input.url)
    if (url.origin !== 'https://body-read.invalid') {
      return localFetch(input, init)
    }
    return {
      headers: new Headers({
        'content-type': 'application/json',
        'x-request-id': 'body-read-request-id',
      }),
      ok: true,
      status: 200,
      text: async () => {
        throw bodyReadError
      },
    }
  }
  const journalPath = join(root, 'meter.jsonl')
  const transcriptDirectory = join(root, 'transcripts')
  const meter = await createMeteredOpenAITransport({
    apiKey: 'body-read-key',
    capUsd: 5,
    journalPath,
    liveConfig,
    transcriptDirectory,
    upstreamFetch,
    upstreamOrigin: 'https://body-read.invalid',
  })
  try {
    await assert.rejects(
      meter.withOperation(
        { cellId: 'body-read::kernel', operationId: 'answer' },
        () => meter.callChat({
          messages: [
            { role: 'system', content: LIVE_ANSWER_SYSTEM },
            { role: 'user', content: 'Question?' },
          ],
          purpose: 'answer',
        }),
      ),
      (error) => error.code === 'TRANSPORT_RETRY_EXHAUSTED',
    )
    const snapshot = meter.snapshot()
    assert.ok(snapshot.accounted.usd > 0)
    assert.equal(snapshot.accounted.usd, snapshot.uncertain.usd)
    await reconcileMeterJournal(journalPath, snapshot, {
      allowTerminalFailure: true,
      liveConfig,
    })
    const audit = await verifyLiveTranscriptArtifacts({
      directory: transcriptDirectory,
      journalPath,
    })
    assert.equal(audit.attempts, 1)
    const transcript = JSON.parse(await readFile(
      join(transcriptDirectory, audit.verified[0].file),
      'utf8',
    ))
    assert.equal(transcript.terminal.response.status, 200)
    assert.equal(transcript.terminal.response.bodyAvailable, false)
    assert.equal(transcript.terminal.response.rawBody, null)
    assert.equal(transcript.terminal.transportError.code, 'UND_ERR_SOCKET')
    assert.equal(
      transcript.terminal.response.headers['x-request-id'],
      'body-read-request-id',
    )
  } finally {
    await meter.close()
    await rm(root, { force: true, recursive: true })
  }
})

test('a transcript-finalization failure charges the full dispatched reservation once', async () => {
  const root = await mkdtemp(join(tmpdir(), 'palari-live-transcript-failure-'))
  const provider = await startFakeProvider(() => chatSuccess('Provider answered.', 8))
  const liveConfig = versionedConfig()
  const meter = await createMeteredOpenAITransport({
    apiKey: 'transcript-failure-key',
    capUsd: 5,
    journalPath: join(root, 'meter.jsonl'),
    liveConfig,
    transcriptDirectory: join(root, 'transcripts'),
    transcriptRecorderFactory: async () => ({
      beginAttempt: async () => ({
        finish: async () => {
          throw new Error('injected transcript finalization failure')
        },
        transcriptFile: 'injected-transcript.json',
        transcriptSha256: 'a'.repeat(64),
      }),
    }),
    upstreamOrigin: provider.origin,
  })
  try {
    await assert.rejects(
      meter.withOperation(
        { cellId: 'transcript-failure::kernel', operationId: 'answer' },
        () => meter.callChat({
          messages: [
            { role: 'system', content: LIVE_ANSWER_SYSTEM },
            { role: 'user', content: 'Question?' },
          ],
          purpose: 'answer',
        }),
      ),
      (error) => error.code === 'ATTEMPT_EVIDENCE_PERSISTENCE_FAILED',
    )
    const snapshot = meter.snapshot()
    assert.equal(provider.requests.length, 1)
    assert.equal(snapshot.attempts, 1)
    assert.equal(snapshot.sequence, 1)
    assert.ok(snapshot.accounted.usd > 0)
    assert.deepEqual(snapshot.accounted, snapshot.uncertain)
    assert.equal(snapshot.fatal.code, 'ATTEMPT_EVIDENCE_PERSISTENCE_FAILED')
    await assert.rejects(
      meter.withOperation(
        { cellId: 'transcript-failure::kernel', operationId: 'again' },
        async () => {},
      ),
      (error) => error.code === 'METER_FATAL',
    )
    assert.equal(provider.requests.length, 1)
  } finally {
    await meter.close()
    await provider.close()
    await rm(root, { force: true, recursive: true })
  }
})

test('a terminal-journal failure preserves sequence and charges the dispatched reservation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'palari-live-journal-failure-'))
  const provider = await startFakeProvider(() => chatSuccess('Provider answered.', 8))
  const liveConfig = versionedConfig()
  const journalPath = join(root, 'meter.jsonl')
  const meter = await createMeteredOpenAITransport({
    apiKey: 'journal-failure-key',
    capUsd: 5,
    journalAppender: async (path, event) => {
      if (event.type === 'attempt_terminal') {
        throw new Error('injected terminal journal failure')
      }
      await appendFile(path, `${JSON.stringify(event)}\n`, { mode: 0o600 })
    },
    journalPath,
    liveConfig,
    transcriptDirectory: join(root, 'transcripts'),
    upstreamOrigin: provider.origin,
  })
  try {
    await assert.rejects(
      meter.withOperation(
        { cellId: 'journal-failure::kernel', operationId: 'answer' },
        () => meter.callChat({
          messages: [
            { role: 'system', content: LIVE_ANSWER_SYSTEM },
            { role: 'user', content: 'Question?' },
          ],
          purpose: 'answer',
        }),
      ),
      (error) => error.code === 'ATTEMPT_EVIDENCE_PERSISTENCE_FAILED',
    )
    const snapshot = meter.snapshot()
    assert.equal(provider.requests.length, 1)
    assert.equal(snapshot.attempts, 1)
    assert.equal(snapshot.sequence, 1)
    assert.ok(snapshot.accounted.usd > 0)
    assert.deepEqual(snapshot.accounted, snapshot.uncertain)
    assert.equal(snapshot.fatal.code, 'ATTEMPT_EVIDENCE_PERSISTENCE_FAILED')
    const journal = (await readFile(journalPath, 'utf8')).trim().split('\n')
    assert.equal(journal.length, 1)
    assert.equal(JSON.parse(journal[0]).type, 'attempt_started')
  } finally {
    await meter.close()
    await provider.close()
    await rm(root, { force: true, recursive: true })
  }
})

test('live CLI requires one explicit new run ID', () => {
  assert.equal(parseLiveRunArgs(['--run', 'j3-live-v2']), 'j3-live-v2')
  for (const args of [
    [],
    ['j3-live-v2'],
    ['--run'],
    ['--run', 'j3-live-v2', '--again'],
  ]) {
    assert.throws(
      () => parseLiveRunArgs(args),
      (error) => error.code === 'LIVE_RUN_ID_REQUIRED',
    )
  }
})

test('partial reports score only completed arm pairs', () => {
  const kernel = 'palari-brain-kernel-live'
  const mem0 = 'mem0-oss-live'
  const selected = selectComparableLiveCells([
    { armName: kernel, result: { journeyId: 'paired' } },
    { armName: mem0, result: { journeyId: 'paired' } },
    { armName: kernel, result: { journeyId: 'unpaired' } },
  ])
  assert.deepEqual(
    selected.comparableCells.map((cell) => `${cell.result.journeyId}::${cell.armName}`),
    [`paired::${kernel}`, `paired::${mem0}`],
  )
  assert.deepEqual(
    selected.unpairedCompletedCells,
    [`unpaired::${kernel}`],
  )
})

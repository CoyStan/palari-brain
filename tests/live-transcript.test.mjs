import assert from 'node:assert/strict'
import { readFile, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { mkdtemp } from 'node:fs/promises'

import {
  LiveTranscriptError,
  createLiveTranscriptRecorder,
  transcriptFilename,
  transcriptSha256,
} from '../evals/live-transcript.mjs'

const FAKE_KEY = 'sk-proj-fake-transcript-key-123456789'

async function withRecorder(action) {
  const root = await mkdtemp(join(tmpdir(), 'palari-live-transcript-'))
  const transcripts = join(root, 'transcripts')
  const timestamps = [
    '2026-07-23T10:00:00.000Z',
    '2026-07-23T10:00:01.000Z',
    '2026-07-23T10:00:02.000Z',
    '2026-07-23T10:00:03.000Z',
  ]
  const recorder = await createLiveTranscriptRecorder({
    directory: transcripts,
    forbiddenSecrets: [FAKE_KEY],
    now: () => timestamps.shift() ?? '2026-07-23T10:00:04.000Z',
  })
  try {
    await action({ recorder, root, transcripts })
  } finally {
    await rm(root, { force: true, recursive: true })
  }
}

function requestBody() {
  return JSON.stringify({
    max_completion_tokens: 1200,
    messages: [
      { content: 'Return one JSON object.', role: 'system' },
      { content: 'I prefer jasmine tea.', role: 'user' },
    ],
    model: 'gpt-5-nano-2025-08-07',
    reasoning_effort: 'minimal',
    response_format: { type: 'json_object' },
  })
}

test('records one mode-0600 success transcript with exact bodies and safe headers', async () => {
  await withRecorder(async ({ recorder, transcripts }) => {
    const body = requestBody()
    const attemptId = 'journey/../../one::kernel memory::attempt 1'
    const started = await recorder.beginAttempt({
      attempt: 1,
      attemptId,
      cellId: 'journey-one::kernel',
      endpoint: 'chat',
      metadata: { logicalId: 'logical:1', runId: 'j3-live-v2' },
      model: 'gpt-5-nano-2025-08-07',
      normalizedRequestBody: body,
      operationId: 'ingest:s1:0',
      purpose: 'kernel-memory',
      requestBytes: Buffer.byteLength(body),
      settings: {
        maxCompletionTokens: 1200,
        reasoningEffort: 'minimal',
        responseFormat: 'json_object',
      },
    })

    assert.equal(started.transcriptFile, transcriptFilename(attemptId))
    assert.match(started.transcriptFile, /^[A-Za-z0-9_-]+--[a-f0-9]{16}\.json$/)
    assert.equal(dirname(started.transcriptPath), transcripts)
    assert.equal((await stat(started.transcriptPath)).mode & 0o777, 0o600)

    const rawBody = JSON.stringify({
      choices: [{
        finish_reason: 'stop',
        index: 0,
        message: { content: '{"memories":[]}', role: 'assistant' },
      }],
      model: 'gpt-5-nano-2025-08-07',
      usage: {
        completion_tokens: 29,
        completion_tokens_details: {
          reasoning_tokens: 17,
        },
        prompt_tokens: 250,
        total_tokens: 279,
      },
    })
    const terminal = await started.finish({
      outcome: 'succeeded',
      rawBody,
      responseHeaders: {
        authorization: `Bearer ${FAKE_KEY}`,
        'content-type': 'application/json',
        'retry-after': '0.25',
        'set-cookie': `credential=${FAKE_KEY}`,
        'x-ratelimit-limit-requests': '500',
        'x-ratelimit-remaining-tokens': '99999',
        'x-request-id': 'req_safe_123',
      },
      status: 200,
    })

    const text = await readFile(terminal.transcriptPath, 'utf8')
    const record = JSON.parse(text)
    assert.equal(terminal.transcriptSha256, transcriptSha256(text))
    assert.equal(record.state, 'terminal')
    assert.equal(record.startedAt, '2026-07-23T10:00:00.000Z')
    assert.equal(record.completedAt, '2026-07-23T10:00:01.000Z')
    assert.equal(record.request.normalizedBody, body)
    assert.equal(record.request.bodyBytes, Buffer.byteLength(body))
    assert.equal(record.request.bodySha256, transcriptSha256(body))
    assert.equal(record.request.model, 'gpt-5-nano-2025-08-07')
    assert.deepEqual(record.request.settings, {
      maxCompletionTokens: 1200,
      reasoningEffort: 'minimal',
      responseFormat: 'json_object',
    })
    assert.equal(record.terminal.response.rawBody, rawBody)
    assert.equal(record.terminal.response.bodySha256, transcriptSha256(rawBody))
    assert.equal(record.terminal.response.finishReason, 'stop')
    assert.deepEqual(record.terminal.response.usage, {
      completion_tokens: 29,
      completion_tokens_details: { reasoning_tokens: 17 },
      prompt_tokens: 250,
      total_tokens: 279,
    })
    assert.deepEqual(record.terminal.response.headers, {
      'content-type': 'application/json',
      'retry-after': '0.25',
      'x-ratelimit-limit-requests': '500',
      'x-ratelimit-remaining-tokens': '99999',
      'x-request-id': 'req_safe_123',
    })
    assert.doesNotMatch(text, /authorization|set-cookie|sk-proj|fake-transcript-key/i)
    assert.deepEqual(await readdir(transcripts), [started.transcriptFile])
    assert.equal((await stat(terminal.transcriptPath)).mode & 0o777, 0o600)
    await assert.rejects(
      started.finish({ outcome: 'succeeded', rawBody, status: 200 }),
      (error) =>
        error instanceof LiveTranscriptError &&
        error.code === 'TRANSCRIPT_ALREADY_TERMINAL',
    )
  })
})

test('preserves an exact provider HTTP error body and whitelisted diagnostics', async () => {
  await withRecorder(async ({ recorder }) => {
    const body = requestBody()
    const started = await recorder.beginAttempt({
      attempt: 1,
      attemptId: 'cell:error:attempt:1',
      cellId: 'cell:error',
      endpoint: 'chat',
      model: 'gpt-5-nano-2025-08-07',
      normalizedRequestBody: body,
      operationId: 'probe:p2',
      purpose: 'answer',
      settings: { maxCompletionTokens: 600, reasoningEffort: 'minimal' },
    })
    const errorBody = '{"error":{"message":"Unsupported parameter.","type":"invalid_request_error","param":"reasoning_effort","code":"unsupported_value"}}'
    const terminal = await started.finish({
      outcome: 'failed',
      rawBody: errorBody,
      responseHeaders: new Headers({
        'content-type': 'application/json',
        'retry-after-ms': '400',
        server: 'ignored',
        'x-request-id': 'req_error_456',
      }),
      status: 400,
    })
    const record = JSON.parse(await readFile(terminal.transcriptPath, 'utf8'))
    assert.equal(record.terminal.response.rawBody, errorBody)
    assert.equal(record.terminal.response.bodySha256, transcriptSha256(errorBody))
    assert.equal(record.terminal.response.status, 400)
    assert.equal(record.terminal.response.finishReason, null)
    assert.equal(record.terminal.response.usage, null)
    assert.deepEqual(record.terminal.response.headers, {
      'content-type': 'application/json',
      'retry-after-ms': '400',
      'x-request-id': 'req_error_456',
    })
  })
})

test('records safe transport-error fields while redacting forbidden values', async () => {
  await withRecorder(async ({ recorder }) => {
    const body = requestBody()
    const started = await recorder.beginAttempt({
      attempt: 1,
      attemptId: 'cell:transport:attempt:1',
      cellId: 'cell:transport',
      endpoint: 'chat',
      model: 'gpt-5-nano-2025-08-07',
      normalizedRequestBody: body,
      operationId: 'ingest:s1:0',
      purpose: 'mem0-memory',
      settings: { maxCompletionTokens: 1200, reasoningEffort: 'minimal' },
    })
    const cause = new Error(`socket rejected Bearer ${FAKE_KEY}`)
    cause.code = 'ECONNRESET'
    const failure = new Error(`request using ${FAKE_KEY} failed`, { cause })
    failure.code = 'UND_ERR_SOCKET'
    failure.stack = `Error: ${FAKE_KEY}\n    at safe-local-frame`
    const terminal = await started.finish({
      outcome: 'failed',
      transportError: failure,
    })
    const text = await readFile(terminal.transcriptPath, 'utf8')
    const record = JSON.parse(text)
    assert.equal(record.terminal.response, null)
    assert.equal(record.terminal.transportError.code, 'UND_ERR_SOCKET')
    assert.equal(record.terminal.transportError.cause.code, 'ECONNRESET')
    assert.match(record.terminal.transportError.message, /\[REDACTED_SECRET\]/)
    assert.match(record.terminal.transportError.stack, /\[REDACTED_SECRET\]/)
    assert.match(record.terminal.transportError.cause.message, /\[REDACTED_SECRET\]/)
    assert.doesNotMatch(text, /sk-proj|fake-transcript-key|Bearer/i)
  })
})

test('fails closed before persisting exact bodies that contain a forbidden secret', async () => {
  await withRecorder(async ({ recorder, transcripts }) => {
    await assert.rejects(
      recorder.beginAttempt({
        attempt: 1,
        attemptId: 'unsafe-request',
        cellId: 'unsafe-request',
        endpoint: 'chat',
        model: 'gpt-5-nano-2025-08-07',
        normalizedRequestBody: JSON.stringify({ accidental: FAKE_KEY }),
        operationId: 'probe:p1',
        purpose: 'answer',
      }),
      (error) =>
        error instanceof LiveTranscriptError &&
        error.code === 'TRANSCRIPT_SECRET_DETECTED',
    )
    assert.deepEqual(await readdir(transcripts), [])

    const body = requestBody()
    const started = await recorder.beginAttempt({
      attempt: 1,
      attemptId: 'unsafe-response',
      cellId: 'unsafe-response',
      endpoint: 'chat',
      model: 'gpt-5-nano-2025-08-07',
      normalizedRequestBody: body,
      operationId: 'probe:p1',
      purpose: 'answer',
    })
    await assert.rejects(
      started.finish({
        outcome: 'failed',
        rawBody: JSON.stringify({ echoed: FAKE_KEY }),
        status: 400,
      }),
      (error) =>
        error instanceof LiveTranscriptError &&
        error.code === 'TRANSCRIPT_SECRET_DETECTED',
    )
    const safeStartedText = await readFile(started.transcriptPath, 'utf8')
    assert.equal(JSON.parse(safeStartedText).state, 'started')
    assert.doesNotMatch(safeStartedText, /sk-proj|fake-transcript-key/)

    await assert.rejects(
      recorder.beginAttempt({
        attempt: 1,
        attemptId: 'unsafe-metadata',
        cellId: 'unsafe-metadata',
        endpoint: 'chat',
        metadata: { apiKey: 'not-even-written' },
        model: 'gpt-5-nano-2025-08-07',
        normalizedRequestBody: body,
        operationId: 'probe:p1',
        purpose: 'answer',
      }),
      (error) =>
        error instanceof LiveTranscriptError &&
        error.code === 'TRANSCRIPT_CREDENTIAL_FIELD',
    )
  })
})

test('deterministic hashed filenames prevent path escape and duplicate overwrite', async () => {
  await withRecorder(async ({ recorder, transcripts }) => {
    const firstId = '../../same-looking/id'
    const secondId = '..//same looking id'
    assert.notEqual(transcriptFilename(firstId), transcriptFilename(secondId))
    for (const id of [firstId, secondId]) {
      const file = transcriptFilename(id)
      assert.equal(file.includes('/'), false)
      assert.equal(file.includes('..'), false)
    }

    const fields = {
      attempt: 1,
      attemptId: firstId,
      cellId: 'cell',
      endpoint: 'chat',
      model: 'gpt-5-nano-2025-08-07',
      normalizedRequestBody: requestBody(),
      operationId: 'operation',
      purpose: 'answer',
    }
    const started = await recorder.beginAttempt(fields)
    assert.equal(dirname(started.transcriptPath), transcripts)
    await assert.rejects(
      recorder.beginAttempt(fields),
      (error) =>
        error instanceof LiveTranscriptError &&
        error.code === 'TRANSCRIPT_EXISTS',
    )
    assert.deepEqual(await readdir(transcripts), [transcriptFilename(firstId)])
  })
})

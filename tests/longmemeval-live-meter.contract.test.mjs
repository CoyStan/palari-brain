import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'

import {
  J4LiveError,
  createJ4MeteredTransport,
  j4ReservationFor,
  parseJ4GeminiSuccess,
  parseJ4JudgeSuccess,
  reconcileJ4LedgerText,
  validateJ4MeterLimits,
} from '../evals/longmemeval-live-meter.mjs'
import {
  J4_GEMINI_ANSWER_GENERATION,
  J4_GEMINI_MODEL,
  J4_GEMINI_WRITER_GENERATION,
  J4_MAX_RESPONSE_BYTES,
  J4_REQUEST_TIMEOUT_MS,
  J4_TRANCHE_1_LIMITS,
} from '../evals/longmemeval-live-config.mjs'
import { LONGMEMEVAL_JUDGE_MODEL } from '../evals/longmemeval-judge.mjs'

const GEMINI_KEY = 'gemini-fake-meter-key'
const OPENAI_KEY = 'openai-fake-meter-key'

function limits(overrides = {}) {
  const value = {
    maxAttempts: J4_TRANCHE_1_LIMITS.maxAttempts,
    maxLogicalRequests: {
      ...J4_TRANCHE_1_LIMITS.maxLogicalRequests,
    },
    maxResponseBytes: J4_MAX_RESPONSE_BYTES,
    maxTokens: {
      ...J4_TRANCHE_1_LIMITS.maxTokens,
    },
    requestTimeoutMs: J4_REQUEST_TIMEOUT_MS,
    retryLimit: 3,
  }
  return {
    ...value,
    ...overrides,
    maxLogicalRequests: {
      ...value.maxLogicalRequests,
      ...overrides.maxLogicalRequests,
    },
    maxTokens: {
      ...value.maxTokens,
      ...overrides.maxTokens,
    },
  }
}

function writerBody(
  maxOutputTokens = J4_GEMINI_WRITER_GENERATION.maxOutputTokens,
) {
  return {
    contents: [{
      parts: [{ text: 'Remember that the user likes tea.' }],
      role: 'user',
    }],
    generationConfig: {
      maxOutputTokens,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingLevel: 'MINIMAL' },
    },
    systemInstruction: {
      parts: [{ text: 'Return one JSON object.' }],
    },
  }
}

function answerBody(
  maxOutputTokens = J4_GEMINI_ANSWER_GENERATION.maxOutputTokens,
) {
  return {
    contents: [{
      parts: [{ text: 'What does the user like?' }],
      role: 'user',
    }],
    generationConfig: {
      maxOutputTokens,
      thinkingConfig: { thinkingLevel: 'MINIMAL' },
    },
  }
}

function judgeBody(maxTokens = 10) {
  return {
    max_tokens: maxTokens,
    messages: [{ content: 'Is the answer correct?', role: 'user' }],
    model: LONGMEMEVAL_JUDGE_MODEL,
    n: 1,
    temperature: 0,
  }
}

function geminiJson({
  candidateTokens = 2,
  inputTokens = 10,
  modelVersion = `${J4_GEMINI_MODEL}-001`,
  text = '{"memories":[]}',
  thoughtTokens = 1,
  totalTokens = inputTokens + candidateTokens + thoughtTokens,
} = {}) {
  return JSON.stringify({
    candidates: [{
      content: { parts: [{ text }] },
      finishReason: 'STOP',
    }],
    modelVersion,
    usageMetadata: {
      candidatesTokenCount: candidateTokens,
      promptTokenCount: inputTokens,
      thoughtsTokenCount: thoughtTokens,
      totalTokenCount: totalTokens,
    },
  })
}

function judgeJson({
  inputTokens = 20,
  outputTokens = 1,
  text = 'yes',
} = {}) {
  return JSON.stringify({
    choices: [{
      finish_reason: 'stop',
      index: 0,
      message: { content: text, role: 'assistant' },
    }],
    model: LONGMEMEVAL_JUDGE_MODEL,
    usage: {
      completion_tokens: outputTokens,
      prompt_tokens: inputTokens,
      total_tokens: inputTokens + outputTokens,
    },
  })
}

function jsonResponse(text, status = 200, headers = {}) {
  return new Response(text, {
    headers: { 'content-type': 'application/json', ...headers },
    status,
  })
}

async function withMeter(fetchImpl, action, {
  capUsd = 2.5,
  meterLimits = limits(),
} = {}) {
  const root = await mkdtemp(join(tmpdir(), 'palari-j4-meter-'))
  const journalPath = join(root, 'nested', 'meter.jsonl')
  const transcriptDirectory = join(root, 'nested', 'transcripts')
  let meter
  try {
    meter = await createJ4MeteredTransport({
      capUsd,
      fetchImpl,
      geminiApiKey: GEMINI_KEY,
      journalPath,
      limits: meterLimits,
      openaiApiKey: OPENAI_KEY,
      transcriptDirectory,
      waitImpl: async () => {},
    })
    await action({
      journalPath,
      meter,
      root,
      transcriptDirectory,
    })
  } finally {
    meter?.closeNetworkGuard()
    await rm(root, { force: true, recursive: true })
  }
}

test('J4 meter import is inert and frozen limits require every ceiling', () => {
  const imported = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      [
        'globalThis.fetch = () => { throw new Error("network on import") }',
        'await import("./evals/longmemeval-live-meter.mjs")',
        'process.stdout.write("inert")',
      ].join(';'),
    ],
    {
      cwd: new URL('..', import.meta.url),
      encoding: 'utf8',
    },
  )
  assert.equal(imported.status, 0, imported.stderr)
  assert.equal(imported.stdout, 'inert')
  assert.deepEqual(validateJ4MeterLimits(limits()), limits())
  assert.throws(
    () => validateJ4MeterLimits({
      ...limits(),
      retryLimit: 4,
    }),
    (error) => error instanceof J4LiveError &&
      error.code === 'LIMITS_SCHEMA',
  )
})

test('reservations and success parsers pin model, finish, and exact usage', () => {
  const geminiBody = writerBody()
  const geminiReservation = j4ReservationFor({
    body: geminiBody,
    maxOutputTokens: geminiBody.generationConfig.maxOutputTokens,
    provider: 'gemini',
  })
  const gemini = parseJ4GeminiSuccess({
    body: geminiBody,
    rawBody: geminiJson(),
    reservation: geminiReservation,
  })
  assert.equal(gemini.usage.geminiInputTokens, 10)
  assert.equal(gemini.usage.geminiOutputTokens, 3)
  assert.deepEqual(gemini.usageDetails, {
    cachedInputTokens: 0,
    candidateTokens: 2,
    thoughtTokens: 1,
  })
  assert.ok(gemini.usage.usd < geminiReservation.usd)
  assert.throws(
    () => parseJ4GeminiSuccess({
      body: geminiBody,
      rawBody: geminiJson({ totalTokens: 999 }),
      reservation: geminiReservation,
    }),
    (error) => error.code === 'GEMINI_USAGE_INVALID',
  )
  assert.throws(
    () => parseJ4GeminiSuccess({
      body: geminiBody,
      expectedModelVersion: `${J4_GEMINI_MODEL}-locked`,
      rawBody: geminiJson(),
      reservation: geminiReservation,
    }),
    (error) => error.code === 'GEMINI_MODEL_MISMATCH',
  )
  assert.throws(
    () => parseJ4GeminiSuccess({
      body: geminiBody,
      expectedModelVersion: 'unrelated-model-001',
      rawBody: geminiJson({ modelVersion: 'unrelated-model-001' }),
      reservation: geminiReservation,
    }),
    (error) => error.code === 'GEMINI_MODEL_MISMATCH',
  )
  assert.throws(
    () => parseJ4GeminiSuccess({
      body: geminiBody,
      rawBody: geminiJson({
        candidateTokens: 0,
        inputTokens: 0,
        thoughtTokens: 0,
        totalTokens: 0,
      }),
      reservation: geminiReservation,
    }),
    (error) => error.code === 'GEMINI_USAGE_INVALID',
  )

  const openaiBody = judgeBody()
  const judgeReservation = j4ReservationFor({
    body: openaiBody,
    maxOutputTokens: openaiBody.max_tokens,
    provider: 'openai',
  })
  const judge = parseJ4JudgeSuccess({
    body: openaiBody,
    model: LONGMEMEVAL_JUDGE_MODEL,
    rawBody: judgeJson(),
    reservation: judgeReservation,
  })
  assert.equal(judge.text, 'yes')
  assert.equal(judge.usage.judgeInputTokens, 20)
  assert.throws(
    () => parseJ4JudgeSuccess({
      body: openaiBody,
      model: 'changed-model',
      rawBody: judgeJson(),
      reservation: judgeReservation,
    }),
    (error) => error.code === 'JUDGE_MODEL_MISMATCH',
  )
  assert.throws(
    () => parseJ4JudgeSuccess({
      body: openaiBody,
      model: LONGMEMEVAL_JUDGE_MODEL,
      rawBody: judgeJson({ inputTokens: 0, outputTokens: 0 }),
      reservation: judgeReservation,
    }),
    (error) => error.code === 'JUDGE_USAGE_INVALID',
  )
})

test('one aggregate transport uses fixed key-header URLs and releases successes to actual usage', async () => {
  const requests = []
  await withMeter(async (url, init) => {
    requests.push({ init, url })
    return requests.length === 1
      ? jsonResponse(geminiJson())
      : jsonResponse(judgeJson())
  }, async ({
    journalPath,
    meter,
    transcriptDirectory,
  }) => {
    const memory = await meter.callGemini({
      body: writerBody(),
      cellId: 'question-one',
      operationId: 'question:one:writer:session:0',
      purpose: 'writer',
    })
    const judge = await meter.callJudge({
      body: judgeBody(),
      cellId: 'question-one',
      model: LONGMEMEVAL_JUDGE_MODEL,
      operationId: 'question:one:judge',
    })
    assert.equal(memory.text, '{"memories":[]}')
    assert.equal(memory.validated, true)
    assert.equal(memory.finishReason, 'STOP')
    assert.equal(judge.text, 'yes')
    assert.equal(judge.validated, true)
    assert.equal(judge.finishReason, 'stop')
    assert.equal(requests.length, 2)
    assert.equal(
      requests[0].url,
      `https://generativelanguage.googleapis.com/v1beta/models/${J4_GEMINI_MODEL}:generateContent`,
    )
    assert.equal(new URL(requests[0].url).search, '')
    assert.equal(requests[0].init.headers['x-goog-api-key'], GEMINI_KEY)
    assert.equal(requests[0].init.headers.authorization, undefined)
    assert.equal(requests[1].url, 'https://api.openai.com/v1/chat/completions')
    assert.equal(requests[1].init.headers.authorization, `Bearer ${OPENAI_KEY}`)
    assert.ok(requests.every(({ init }) =>
      init.redirect === 'error' && init.signal instanceof AbortSignal))

    const snapshot = await meter.snapshot()
    assert.equal(snapshot.attempts, 2)
    assert.deepEqual(snapshot.logicalRequests, { judge: 1, writer: 1 })
    assert.equal(snapshot.uncertain.usd, 0)
    assert.ok(
      Math.abs(snapshot.measured.usd - snapshot.accounted.usd) <= 1e-12,
    )
    assert.equal(
      snapshot.geminiModelVersion,
      `${J4_GEMINI_MODEL}-001`,
    )
    const audit = await meter.verify()
    assert.equal(audit.transcripts.attempts, 2)
    assert.equal((await stat(journalPath)).mode & 0o777, 0o600)
    assert.equal((await stat(dirname(journalPath))).mode & 0o777, 0o700)
    assert.equal(
      (await stat(transcriptDirectory)).mode & 0o777,
      0o700,
    )
    const evidence = [
      await readFile(journalPath, 'utf8'),
      ...(await Promise.all(
        (await readdir(transcriptDirectory))
          .map((file) => readFile(join(transcriptDirectory, file), 'utf8')),
      )),
    ].join('\n')
    assert.doesNotMatch(evidence, new RegExp(`${GEMINI_KEY}|${OPENAI_KEY}`))
  })
})

test('three retries retain failed reservations and reuse one exact body', async () => {
  const bodies = []
  await withMeter(async (_url, init) => {
    bodies.push(init.body)
    if (bodies.length < 4) {
      return jsonResponse(
        JSON.stringify({ error: { message: 'temporary' } }),
        500,
      )
    }
    return jsonResponse(geminiJson())
  }, async ({ meter }) => {
    await meter.callGemini({
      body: writerBody(),
      cellId: 'retry-cell',
      operationId: 'retry-operation',
      purpose: 'writer',
    })
    assert.equal(bodies.length, 4)
    assert.equal(new Set(bodies).size, 1)
    const snapshot = await meter.snapshot()
    assert.equal(snapshot.attempts, 4)
    assert.equal(snapshot.retries.length, 3)
    assert.ok(snapshot.uncertain.usd > 0)
    assert.ok(snapshot.accounted.usd > snapshot.measured.usd)
    await assert.rejects(
      meter.callGemini({
        body: writerBody(),
        cellId: 'retry-cell',
        operationId: 'retry-operation',
        purpose: 'writer',
      }),
      (error) => error.code === 'OPERATION_ALREADY_DISPATCHED',
    )
    const audit = await meter.verify()
    assert.equal(audit.transcripts.attempts, 4)
  })
})

test('an oversized provider response is terminal and never retried', async () => {
  let calls = 0
  await withMeter(async () => {
    calls += 1
    return jsonResponse('{}', 200, {
      'content-length': String(J4_MAX_RESPONSE_BYTES + 1),
    })
  }, async ({ meter }) => {
    await assert.rejects(
      meter.callGemini({
        body: writerBody(),
        cellId: 'oversized-cell',
        operationId: 'oversized-operation',
        purpose: 'writer',
      }),
      (error) => error.code === 'RESPONSE_TOO_LARGE',
    )
    assert.equal(calls, 1)
    const snapshot = await meter.snapshot()
    assert.equal(snapshot.attempts, 1)
    assert.equal(snapshot.retries.length, 0)
    assert.equal(snapshot.measured.usd, 0)
    assert.ok(snapshot.uncertain.usd > 0)
    const audit = await meter.verify()
    assert.equal(audit.transcripts.attempts, 1)
  })
})

test('an abort-style timeout failure retries and retains its reservation', async () => {
  let calls = 0
  await withMeter(async (_url, init) => {
    calls += 1
    assert.ok(init.signal instanceof AbortSignal)
    if (calls === 1) {
      throw new DOMException('The operation was aborted.', 'AbortError')
    }
    return jsonResponse(geminiJson())
  }, async ({ meter }) => {
    await meter.callGemini({
      body: writerBody(),
      cellId: 'abort-cell',
      operationId: 'abort-operation',
      purpose: 'writer',
    })
    assert.equal(calls, 2)
    const snapshot = await meter.snapshot()
    assert.equal(snapshot.attempts, 2)
    assert.equal(snapshot.retries.length, 1)
    assert.ok(snapshot.uncertain.usd > 0)
    assert.ok(snapshot.accounted.usd > snapshot.measured.usd)
    const audit = await meter.verify()
    assert.equal(audit.transcripts.attempts, 2)
  })
})

test('four retryable failures dispatch exactly four attempts and no fifth', async () => {
  let calls = 0
  await withMeter(async () => {
    calls += 1
    return jsonResponse(
      JSON.stringify({ error: { message: 'temporary' } }),
      500,
    )
  }, async ({ meter }) => {
    await assert.rejects(
      meter.callGemini({
        body: writerBody(),
        cellId: 'exhausted-cell',
        operationId: 'exhausted-operation',
        purpose: 'writer',
      }),
      (error) => error.code === 'HTTP_RETRIES_EXHAUSTED',
    )
    assert.equal(calls, 4)
    const snapshot = await meter.snapshot()
    assert.equal(snapshot.attempts, 4)
    assert.equal(snapshot.retries.length, 3)
    assert.equal(snapshot.measured.usd, 0)
    assert.ok(snapshot.uncertain.usd > 0)
    await assert.rejects(
      meter.callGemini({
        body: writerBody(),
        cellId: 'never-dispatched-cell',
        operationId: 'never-dispatched-operation',
        purpose: 'writer',
      }),
      (error) => error.code === 'METER_FATAL',
    )
    assert.equal(calls, 4)
    const audit = await meter.verify()
    assert.equal(audit.transcripts.attempts, 4)
  })
})

test('spend, token, attempt, and logical-request ceilings refuse before dispatch', async () => {
  let calls = 0
  await withMeter(async () => {
    calls += 1
    return jsonResponse(geminiJson())
  }, async ({ meter }) => {
    await assert.rejects(
      meter.callGemini({
        body: writerBody(),
        cellId: 'cap-cell',
        operationId: 'cap-operation',
        purpose: 'writer',
      }),
      (error) => error.code === 'J4_SPEND_CAP',
    )
    assert.equal(calls, 0)
  }, { capUsd: 1e-8 })

  calls = 0
  await withMeter(async () => {
    calls += 1
    return jsonResponse(geminiJson())
  }, async ({ meter }) => {
    await assert.rejects(
      meter.callGemini({
        body: writerBody(),
        cellId: 'token-cell',
        operationId: 'token-operation',
        purpose: 'writer',
      }),
      (error) => error.code === 'J4_TOKEN_CAP',
    )
    assert.equal(calls, 0)
  }, {
    meterLimits: limits({
      maxTokens: { geminiInput: 1 },
    }),
  })

  calls = 0
  await withMeter(async () => {
    calls += 1
    return jsonResponse(geminiJson())
  }, async ({ meter }) => {
    await meter.callGemini({
      body: writerBody(),
      cellId: 'attempt-one',
      operationId: 'attempt-one',
      purpose: 'writer',
    })
    await assert.rejects(
      meter.callGemini({
        body: answerBody(),
        cellId: 'attempt-two',
        operationId: 'attempt-two',
        purpose: 'answer',
      }),
      (error) => error.code === 'J4_ATTEMPT_CAP',
    )
    assert.equal(calls, 1)
  }, {
    meterLimits: limits({ maxAttempts: 1 }),
  })

  calls = 0
  await withMeter(async () => {
    calls += 1
    return jsonResponse(geminiJson())
  }, async ({ meter }) => {
    await meter.callGemini({
      body: writerBody(),
      cellId: 'logical-one',
      operationId: 'logical-one',
      purpose: 'writer',
    })
    await assert.rejects(
      meter.callGemini({
        body: writerBody(),
        cellId: 'logical-two',
        operationId: 'logical-two',
        purpose: 'writer',
      }),
      (error) => error.code === 'J4_LOGICAL_REQUEST_CAP',
    )
    assert.equal(calls, 1)
  }, {
    meterLimits: limits({
      maxLogicalRequests: { writer: 1 },
    }),
  })
})

test('malformed success is terminal, reserved, secret-safe, and not retried', async () => {
  let calls = 0
  await withMeter(async () => {
    calls += 1
    return jsonResponse(geminiJson({ totalTokens: 999 }))
  }, async ({
    journalPath,
    meter,
    transcriptDirectory,
  }) => {
    await assert.rejects(
      meter.callGemini({
        body: writerBody(),
        cellId: 'invalid-cell',
        operationId: 'invalid-operation',
        purpose: 'writer',
      }),
      (error) => error.code === 'GEMINI_USAGE_INVALID',
    )
    assert.equal(calls, 1)
    const snapshot = await meter.snapshot()
    assert.equal(snapshot.attempts, 1)
    assert.equal(snapshot.measured.usd, 0)
    assert.ok(snapshot.uncertain.usd > 0)
    assert.equal(snapshot.accounted.usd, snapshot.uncertain.usd)
    await assert.rejects(
      meter.callGemini({
        body: answerBody(),
        cellId: 'later-cell',
        operationId: 'later-operation',
        purpose: 'answer',
      }),
      (error) => error.code === 'METER_FATAL',
    )
    const audit = await meter.verify()
    assert.equal(audit.transcripts.attempts, 1)
    const evidence = [
      await readFile(journalPath, 'utf8'),
      ...(await Promise.all(
        (await readdir(transcriptDirectory))
          .map((file) => readFile(join(transcriptDirectory, file), 'utf8')),
      )),
    ].join('\n')
    assert.doesNotMatch(evidence, new RegExp(`${GEMINI_KEY}|${OPENAI_KEY}`))
  })
})

test('verification binds ledger identity and usage to exact transcript bytes', async () => {
  await withMeter(
    async () => jsonResponse(geminiJson()),
    async ({ journalPath, meter }) => {
      await meter.callGemini({
        body: writerBody(),
        cellId: 'coherence-cell',
        operationId: 'coherence-operation',
        purpose: 'writer',
      })
      await meter.verify()
      const events = (await readFile(journalPath, 'utf8'))
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
      events[0].model = 'tampered-model'
      await writeFile(
        journalPath,
        `${events.map((event) => JSON.stringify(event)).join('\n')}\n`,
        'utf8',
      )
      await assert.rejects(
        meter.verify(),
        (error) => error.code === 'EVIDENCE_COHERENCE',
      )
    },
  )
})

test('ledger replay retains an interrupted reservation and rejects changed retries', () => {
  const body = writerBody()
  const reservation = j4ReservationFor({
    body,
    maxOutputTokens: body.generationConfig.maxOutputTokens,
    provider: 'gemini',
  })
  const hash = 'a'.repeat(64)
  const start = {
    attempt: 1,
    attemptId: 'operation:attempt:1',
    cellId: 'cell',
    endpoint: 'gemini-generate-content',
    model: J4_GEMINI_MODEL,
    operationId: 'operation',
    provider: 'gemini',
    purpose: 'writer',
    requestSha256: hash,
    reservation,
    schemaVersion: 1,
    sequence: 1,
    transcriptFile: 'operation--0123456789abcdef.json',
    transcriptStartedSha256: 'b'.repeat(64),
    type: 'attempt_started',
  }
  const interrupted = reconcileJ4LedgerText(`${JSON.stringify(start)}\n`, {
    capUsd: 2.5,
    limits: limits(),
  })
  assert.equal(interrupted.attempts, 1)
  assert.equal(interrupted.accounted.usd, reservation.usd)
  assert.equal(interrupted.uncertain.usd, reservation.usd)

  const terminal = {
    attemptId: start.attemptId,
    operationId: start.operationId,
    outcome: 'transport_error',
    requestSha256: hash,
    retryable: true,
    schemaVersion: 1,
    sequence: 2,
    transcriptFile: start.transcriptFile,
    transcriptSha256: 'c'.repeat(64),
    type: 'attempt_terminal',
    usage: null,
  }
  const changedRetry = {
    ...start,
    attempt: 2,
    attemptId: 'operation:attempt:2',
    requestSha256: 'd'.repeat(64),
    sequence: 3,
    transcriptFile: 'operation-attempt-2--0123456789abcdef.json',
  }
  assert.throws(
    () => reconcileJ4LedgerText([
      JSON.stringify(start),
      JSON.stringify(terminal),
      JSON.stringify(changedRetry),
      '',
    ].join('\n'), {
      capUsd: 2.5,
      limits: limits(),
    }),
    (error) => error.code === 'RETRY_REQUEST_CHANGED' ||
      error.code === 'LEDGER_SCHEMA',
  )
})

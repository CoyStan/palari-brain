import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
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
import { join } from 'node:path'
import { test } from 'node:test'

import {
  buildIncrementalLongMemEvalJudgeBody,
  INCREMENTAL_LONGMEMEVAL_JUDGE_MODEL,
  reserveIncrementalLongMemEvalJudge,
} from '../evals/incremental-longmemeval-judge.mjs'
import {
  callIncrementalLongMemEvalJudge,
  createIncrementalLongMemEvalJudgeTransport,
  INCREMENTAL_LONGMEMEVAL_JUDGE_MAX_RESPONSE_BYTES,
  INCREMENTAL_LONGMEMEVAL_JUDGE_TIMEOUT_MS,
  INCREMENTAL_LONGMEMEVAL_JUDGE_URL,
  readIncrementalLongMemEvalJudgeMeter,
} from '../evals/incremental-longmemeval-judge-transport.mjs'
import {
  createLiveTranscriptRecorder,
} from '../evals/live-transcript.mjs'

const OPENAI_KEY = 'openai-test-secret'
const OPERATION_ID = 'incremental-longmemeval:08e075c7:judge'

function body() {
  return buildIncrementalLongMemEvalJudgeBody({
    answer: 'Almond milk',
    isAbstention: false,
    question: 'Which milk does the user currently prefer?',
    questionType: 'knowledge-update',
  }, 'The user currently prefers almond milk.')
}

function goodResponseBody() {
  return JSON.stringify({
    choices: [{
      finish_reason: 'stop',
      index: 0,
      message: {
        content: 'yes',
        role: 'assistant',
      },
    }],
    model: INCREMENTAL_LONGMEMEVAL_JUDGE_MODEL,
    object: 'chat.completion',
    service_tier: 'default',
    usage: {
      completion_tokens: 1,
      prompt_tokens: 125,
      total_tokens: 126,
    },
  })
}

function response(rawBody = goodResponseBody(), {
  headers = {},
  status = 200,
} = {}) {
  return new Response(rawBody, {
    headers: {
      'content-type': 'application/json',
      'x-request-id': 'request-safe-id',
      ...headers,
    },
    status,
  })
}

async function fixture(fetchImpl, action, {
  capContext = {
    cumulativeAccountedUsd: 2,
    cumulativeCapUsd: 4,
    freshAccountedUsd: 1,
    freshCapUsd: 2,
  },
} = {}) {
  const root = await mkdtemp(join(
    tmpdir(),
    'palari-incremental-judge-transport-',
  ))
  const meterPath = join(root, 'private', 'judge-meter.json')
  const transcriptDirectory = join(root, 'private', 'transcripts')
  const judgeBody = body()
  const reservation = reserveIncrementalLongMemEvalJudge(judgeBody)
  const transcriptRecorder = await createLiveTranscriptRecorder({
    directory: transcriptDirectory,
    forbiddenSecrets: [OPENAI_KEY],
  })
  const inputs = {
    body: judgeBody,
    capContext,
    fetchImpl,
    meterPath,
    openaiApiKey: OPENAI_KEY,
    operationId: OPERATION_ID,
    reservation,
    transcriptRecorder,
  }
  try {
    await action({
      inputs,
      judgeBody,
      meterPath,
      reservation,
      root,
      transcriptDirectory,
    })
  } finally {
    await rm(root, { force: true, recursive: true })
  }
}

async function terminalEvidence({ meterPath, transcriptDirectory }) {
  const meter = await readIncrementalLongMemEvalJudgeMeter(meterPath)
  const transcriptFiles = await readdir(transcriptDirectory)
  assert.equal(transcriptFiles.length, 1)
  const transcriptText = await readFile(
    join(transcriptDirectory, transcriptFiles[0]),
    'utf8',
  )
  return {
    meter,
    meterText: await readFile(meterPath, 'utf8'),
    transcript: JSON.parse(transcriptText),
    transcriptText,
  }
}

test('one-shot judge transport import is inert', () => {
  const imported = spawnSync(process.execPath, [
    '--input-type=module',
    '--eval',
    [
      'globalThis.fetch=()=>{throw new Error("network on import")}',
      'await import("./evals/incremental-longmemeval-judge-transport.mjs")',
      'process.stdout.write("inert")',
    ].join(';'),
  ], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
  })
  assert.equal(imported.status, 0, imported.stderr)
  assert.equal(imported.stdout, 'inert')
})

test('success durably starts before one exact stateless POST and measures it',
  async () => {
    let calls = 0
    let meterPathForFetch
    await fixture(async (url, init) => {
      calls += 1
      assert.equal(url, INCREMENTAL_LONGMEMEVAL_JUDGE_URL)
      assert.equal(init.method, 'POST')
      assert.equal(init.redirect, 'error')
      assert.ok(init.signal instanceof AbortSignal)
      assert.equal(init.signal.aborted, false)
      assert.deepEqual(init.headers, {
        authorization: `Bearer ${OPENAI_KEY}`,
        'content-type': 'application/json',
      })
      assert.deepEqual(Object.keys(init).sort(), [
        'body',
        'headers',
        'method',
        'redirect',
        'signal',
      ])
      const request = JSON.parse(init.body)
      assert.equal(request.store, false)
      assert.equal(request.service_tier, 'default')
      const durableStart = JSON.parse(
        await readFile(meterPathForFetch, 'utf8'),
      )
      assert.equal(durableStart.state, 'attempt_started')
      assert.equal(
        durableStart.request.sha256,
        createHash('sha256').update(init.body).digest('hex'),
      )
      assert.equal(
        (await stat(meterPathForFetch)).mode & 0o777,
        0o600,
      )
      return response()
    }, async ({
      inputs,
      judgeBody,
      meterPath,
      reservation,
      transcriptDirectory,
    }) => {
      meterPathForFetch = meterPath
      const result = await callIncrementalLongMemEvalJudge(inputs)
      assert.equal(calls, 1)
      assert.equal(result.validated, true)
      assert.equal(result.text, 'yes')
      assert.equal(result.serviceTier, 'default')
      assert.deepEqual(result.measured, {
        judgeInputTokens: 125,
        judgeOutputTokens: 1,
        pricingTier: 'default',
        totalTokens: 126,
        usd: 125 * (2.5 / 1_000_000) + 10 / 1_000_000,
      })

      const evidence = await terminalEvidence({
        meterPath,
        transcriptDirectory,
      })
      assert.equal(evidence.meter.state, 'terminal')
      assert.equal(evidence.meter.terminal.outcome, 'success')
      assert.deepEqual(
        evidence.meter.terminal.measured,
        result.measured,
      )
      assert.equal(evidence.meter.terminal.uncertain, null)
      assert.equal(
        evidence.meter.request.bytes,
        Buffer.byteLength(JSON.stringify(judgeBody), 'utf8'),
      )
      assert.deepEqual(evidence.meter.reservation, reservation)
      assert.equal(evidence.transcript.state, 'terminal')
      assert.equal(
        evidence.transcript.request.normalizedBody,
        JSON.stringify(judgeBody),
      )
      for (const text of [
        evidence.meterText,
        evidence.transcriptText,
      ]) {
        assert.doesNotMatch(text, new RegExp(OPENAI_KEY))
        assert.doesNotMatch(text, /Bearer\s/i)
        assert.doesNotMatch(text, /authorization/i)
      }
    })
  })

test('fresh cap refusal happens before transcript, meter, or fetch', async () => {
  let calls = 0
  const judgeBody = body()
  const reservation = reserveIncrementalLongMemEvalJudge(judgeBody)
  await fixture(async () => {
    calls += 1
    return response()
  }, async ({
    inputs,
    meterPath,
    transcriptDirectory,
  }) => {
    await assert.rejects(
      callIncrementalLongMemEvalJudge(inputs),
      (error) => error.code === 'JUDGE_FRESH_SPEND_CAP',
    )
    assert.equal(calls, 0)
    await assert.rejects(stat(meterPath), { code: 'ENOENT' })
    assert.deepEqual(await readdir(transcriptDirectory), [])
  }, {
    capContext: {
      cumulativeAccountedUsd: 2,
      cumulativeCapUsd: 4,
      freshAccountedUsd: 1,
      freshCapUsd: 1 + reservation.usd / 2,
    },
  })
})

test('cumulative cap refusal happens before transcript, meter, or fetch',
  async () => {
    let calls = 0
    const judgeBody = body()
    const reservation = reserveIncrementalLongMemEvalJudge(judgeBody)
    await fixture(async () => {
      calls += 1
      return response()
    }, async ({
      inputs,
      meterPath,
      transcriptDirectory,
    }) => {
      await assert.rejects(
        callIncrementalLongMemEvalJudge(inputs),
        (error) => error.code === 'JUDGE_CUMULATIVE_SPEND_CAP',
      )
      assert.equal(calls, 0)
      await assert.rejects(stat(meterPath), { code: 'ENOENT' })
      assert.deepEqual(await readdir(transcriptDirectory), [])
    }, {
      capContext: {
        cumulativeAccountedUsd: 2,
        cumulativeCapUsd: 2 + reservation.usd / 2,
        freshAccountedUsd: 1,
        freshCapUsd: 2,
      },
    })
  })

test('transport failure dispatches once and terminals priority uncertainty',
  async () => {
    let calls = 0
    await fixture(async () => {
      calls += 1
      throw new Error(`network leaked Bearer ${OPENAI_KEY}`)
    }, async ({
      inputs,
      meterPath,
      reservation,
      transcriptDirectory,
    }) => {
      await assert.rejects(
        callIncrementalLongMemEvalJudge(inputs),
        (error) => error.code === 'JUDGE_TRANSPORT_ERROR',
      )
      assert.equal(calls, 1)
      const evidence = await terminalEvidence({
        meterPath,
        transcriptDirectory,
      })
      assert.equal(evidence.meter.terminal.outcome, 'transport_error')
      assert.equal(evidence.meter.terminal.measured, null)
      assert.deepEqual(evidence.meter.terminal.uncertain, reservation)
      assert.equal(
        evidence.meter.terminal.accountedUsd,
        reservation.usd,
      )
      assert.doesNotMatch(evidence.meterText, new RegExp(OPENAI_KEY))
      assert.doesNotMatch(
        evidence.transcriptText,
        new RegExp(OPENAI_KEY),
      )

      await assert.rejects(
        callIncrementalLongMemEvalJudge(inputs),
        (error) => error.code === 'JUDGE_METER_EXISTS',
      )
      assert.equal(calls, 1)
    })
  })

test('malformed JSON and terminal HTTP are never retried or undercharged',
  async () => {
    for (const testCase of [
      {
        code: 'JUDGE_JSON_INVALID',
        outcome: 'invalid_response',
        response: () => response('{'),
      },
      {
        code: 'JUDGE_HTTP_ERROR',
        outcome: 'http_error',
        response: () => response(
          JSON.stringify({ error: { message: 'rate limited' } }),
          { status: 429 },
        ),
      },
    ]) {
      let calls = 0
      await fixture(async () => {
        calls += 1
        return testCase.response()
      }, async ({
        inputs,
        meterPath,
        reservation,
        transcriptDirectory,
      }) => {
        await assert.rejects(
          callIncrementalLongMemEvalJudge(inputs),
          (error) => error.code === testCase.code,
        )
        assert.equal(calls, 1)
        const evidence = await terminalEvidence({
          meterPath,
          transcriptDirectory,
        })
        assert.equal(
          evidence.meter.terminal.outcome,
          testCase.outcome,
        )
        assert.equal(evidence.meter.terminal.measured, null)
        assert.deepEqual(evidence.meter.terminal.uncertain, reservation)
      })
    }
  })

test('fixed timeout aborts and terminals uncertainty without a retry',
  async () => {
    const originalSetTimeout = globalThis.setTimeout
    const originalClearTimeout = globalThis.clearTimeout
    const timerToken = {}
    let timeoutCallback
    let timeoutDelay
    globalThis.setTimeout = (callback, delay) => {
      timeoutCallback = callback
      timeoutDelay = delay
      return timerToken
    }
    globalThis.clearTimeout = (token) => {
      assert.equal(token, timerToken)
    }
    let calls = 0
    let fetchStarted
    const started = new Promise((resolve) => {
      fetchStarted = resolve
    })
    let observedSignal
    try {
      await fixture(async (_url, init) => {
        calls += 1
        observedSignal = init.signal
        fetchStarted()
        return new Promise(() => {})
      }, async ({
        inputs,
        meterPath,
        reservation,
        transcriptDirectory,
      }) => {
        const pending = callIncrementalLongMemEvalJudge(inputs)
        await started
        assert.equal(observedSignal.aborted, false)
        assert.equal(
          timeoutDelay,
          INCREMENTAL_LONGMEMEVAL_JUDGE_TIMEOUT_MS,
        )
        timeoutCallback()
        await assert.rejects(
          pending,
          (error) => error.code === 'JUDGE_TIMEOUT',
        )
        assert.equal(observedSignal.aborted, true)
        assert.equal(calls, 1)
        const evidence = await terminalEvidence({
          meterPath,
          transcriptDirectory,
        })
        assert.equal(evidence.meter.terminal.outcome, 'timeout')
        assert.deepEqual(evidence.meter.terminal.uncertain, reservation)
      })
    } finally {
      globalThis.setTimeout = originalSetTimeout
      globalThis.clearTimeout = originalClearTimeout
    }
  })

test('wire contract fixes 60 seconds and rejects over-4-MiB responses once',
  async () => {
    assert.equal(INCREMENTAL_LONGMEMEVAL_JUDGE_TIMEOUT_MS, 60_000)
    assert.equal(
      INCREMENTAL_LONGMEMEVAL_JUDGE_MAX_RESPONSE_BYTES,
      4 * 1024 * 1024,
    )
    let calls = 0
    await fixture(async (_url, init) => {
      calls += 1
      assert.ok(init.signal instanceof AbortSignal)
      assert.equal(init.redirect, 'error')
      return response('{}', {
        headers: {
          'content-length': String(
            INCREMENTAL_LONGMEMEVAL_JUDGE_MAX_RESPONSE_BYTES + 1,
          ),
        },
      })
    }, async ({
      inputs,
      meterPath,
      reservation,
      transcriptDirectory,
    }) => {
      await assert.rejects(
        callIncrementalLongMemEvalJudge(inputs),
        (error) => error.code === 'JUDGE_RESPONSE_TOO_LARGE',
      )
      assert.equal(calls, 1)
      const evidence = await terminalEvidence({
        meterPath,
        transcriptDirectory,
      })
      assert.equal(
        evidence.meter.terminal.outcome,
        'response_too_large',
      )
      assert.deepEqual(evidence.meter.terminal.uncertain, reservation)
    })
  })

test('factory combines current Gemini spend and verifies terminal evidence',
  async () => {
    const root = await mkdtemp(join(
      tmpdir(),
      'palari-incremental-judge-factory-',
    ))
    const meterPath = join(root, 'private', 'judge-meter.json')
    const transcriptDirectory = join(root, 'private', 'transcripts')
    let calls = 0
    try {
      const transport =
        await createIncrementalLongMemEvalJudgeTransport({
          cumulativeCapUsd: 8,
          fetchImpl: async () => {
            calls += 1
            return response()
          },
          freshSubcapUsd: 7.1,
          getFreshAccountedUsd: async () => 3.25,
          meterPath,
          openaiApiKey: OPENAI_KEY,
          openingAccountedUsd: 0.7761082,
          transcriptDirectory,
        })
      assert.deepEqual(await transport.snapshot(), {
        accountedUsd: 0,
        attempts: 0,
        measured: null,
        operationId: null,
        state: 'not_dispatched',
        uncertain: null,
      })
      const result = await transport.callJudge({
        body: body(),
        cellId: 'question-08e075c7',
        operationId: OPERATION_ID,
      })
      assert.equal(result.validated, true)
      assert.equal(calls, 1)
      const snapshot = await transport.snapshot()
      assert.equal(snapshot.state, 'terminal')
      assert.equal(snapshot.attempts, 1)
      assert.equal(snapshot.uncertain, null)
      const verified = await transport.verify()
      assert.deepEqual(verified.snapshot, snapshot)
      assert.equal(verified.meter.capContext.freshAccountedUsd, 3.25)
      assert.equal(
        verified.meter.capContext.cumulativeAccountedUsd,
        4.0261082,
      )
      assert.equal(verified.transcript.file,
        verified.meter.terminal.transcript.file)
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

test('verification recomputes request bytes, hashes, and start links',
  async () => {
    const root = await mkdtemp(join(
      tmpdir(),
      'palari-incremental-judge-request-mutation-',
    ))
    const meterPath = join(root, 'private', 'judge-meter.json')
    const transcriptDirectory = join(root, 'private', 'transcripts')
    try {
      const transport =
        await createIncrementalLongMemEvalJudgeTransport({
          cumulativeCapUsd: 2,
          fetchImpl: async () => response(),
          freshSubcapUsd: 1,
          getFreshAccountedUsd: async () => 0,
          meterPath,
          openaiApiKey: OPENAI_KEY,
          openingAccountedUsd: 0,
          transcriptDirectory,
        })
      await transport.callJudge({
        body: body(),
        cellId: 'question-request-mutation',
        operationId: OPERATION_ID,
      })
      const [transcriptFile] = await readdir(transcriptDirectory)
      const transcriptPath = join(
        transcriptDirectory,
        transcriptFile,
      )
      const originalTranscriptText =
        await readFile(transcriptPath, 'utf8')
      const originalMeterText = await readFile(meterPath, 'utf8')
      const transcript = JSON.parse(originalTranscriptText)
      const changedBody = JSON.parse(
        transcript.request.normalizedBody,
      )
      changedBody.messages[0].content =
        'Different but still contract-valid judge prompt.'
      transcript.request.normalizedBody =
        JSON.stringify(changedBody)
      const changedTranscriptText =
        `${JSON.stringify(transcript, null, 2)}\n`
      await writeFile(transcriptPath, changedTranscriptText)
      const meter = JSON.parse(originalMeterText)
      meter.terminal.transcript.sha256 =
        createHash('sha256')
          .update(changedTranscriptText)
          .digest('hex')
      await writeFile(
        meterPath,
        `${JSON.stringify(meter, null, 2)}\n`,
      )
      await assert.rejects(
        transport.verify(),
        (error) => error.code === 'JUDGE_EVIDENCE_INCOHERENT',
      )

      await writeFile(transcriptPath, originalTranscriptText)
      const changedStartMeter = JSON.parse(originalMeterText)
      changedStartMeter.transcript.startedSha256 = '0'.repeat(64)
      await writeFile(
        meterPath,
        `${JSON.stringify(changedStartMeter, null, 2)}\n`,
      )
      await assert.rejects(
        transport.verify(),
        (error) => error.code === 'JUDGE_EVIDENCE_INCOHERENT',
      )
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

test('success verification binds HTTP status, finish reason, and raw usage',
  async () => {
    const root = await mkdtemp(join(
      tmpdir(),
      'palari-incremental-judge-response-mutation-',
    ))
    const meterPath = join(root, 'private', 'judge-meter.json')
    const transcriptDirectory = join(root, 'private', 'transcripts')
    try {
      const transport =
        await createIncrementalLongMemEvalJudgeTransport({
          cumulativeCapUsd: 2,
          fetchImpl: async () => response(),
          freshSubcapUsd: 1,
          getFreshAccountedUsd: async () => 0,
          meterPath,
          openaiApiKey: OPENAI_KEY,
          openingAccountedUsd: 0,
          transcriptDirectory,
        })
      await transport.callJudge({
        body: body(),
        cellId: 'question-response-mutation',
        operationId: OPERATION_ID,
      })
      const [transcriptFile] = await readdir(transcriptDirectory)
      const transcriptPath = join(
        transcriptDirectory,
        transcriptFile,
      )
      const originalTranscriptText =
        await readFile(transcriptPath, 'utf8')
      const originalMeterText = await readFile(meterPath, 'utf8')

      async function expectMutationRejected(mutateTranscript, mutateMeter) {
        const transcript = JSON.parse(originalTranscriptText)
        const meter = JSON.parse(originalMeterText)
        mutateTranscript(transcript)
        mutateMeter?.(meter)
        const transcriptText =
          `${JSON.stringify(transcript, null, 2)}\n`
        meter.terminal.transcript.sha256 =
          createHash('sha256').update(transcriptText).digest('hex')
        await writeFile(transcriptPath, transcriptText)
        await writeFile(
          meterPath,
          `${JSON.stringify(meter, null, 2)}\n`,
        )
        await assert.rejects(
          transport.verify(),
          (error) => error.code === 'JUDGE_EVIDENCE_INCOHERENT',
        )
      }

      await expectMutationRejected(
        (transcript) => {
          transcript.terminal.response.status = 500
        },
        (meter) => {
          meter.terminal.status = 500
        },
      )
      await expectMutationRejected((transcript) => {
        transcript.terminal.response.finishReason = 'length'
      })
      await expectMutationRejected((transcript) => {
        transcript.terminal.response.usage.total_tokens += 1
      })
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

test('verification requires exactly one transcript artifact',
  async () => {
    const root = await mkdtemp(join(
      tmpdir(),
      'palari-incremental-judge-transcript-set-',
    ))
    const meterPath = join(root, 'private', 'judge-meter.json')
    const transcriptDirectory = join(root, 'private', 'transcripts')
    try {
      const transport =
        await createIncrementalLongMemEvalJudgeTransport({
          cumulativeCapUsd: 2,
          fetchImpl: async () => response(),
          freshSubcapUsd: 1,
          getFreshAccountedUsd: async () => 0,
          meterPath,
          openaiApiKey: OPENAI_KEY,
          openingAccountedUsd: 0,
          transcriptDirectory,
        })
      await transport.callJudge({
        body: body(),
        cellId: 'question-transcript-set',
        operationId: OPERATION_ID,
      })
      await writeFile(
        join(transcriptDirectory, 'orphan-attempt.json'),
        '{}\n',
        { mode: 0o600 },
      )
      await assert.rejects(
        transport.verify(),
        (error) => error.code === 'JUDGE_EVIDENCE_INCOHERENT',
      )
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

test('failure verification recomputes reservation, cap, and transcript-error accounting',
  async () => {
    const root = await mkdtemp(join(
      tmpdir(),
      'palari-incremental-judge-failure-mutation-',
    ))
    const meterPath = join(root, 'private', 'judge-meter.json')
    const transcriptDirectory = join(root, 'private', 'transcripts')
    try {
      const transport =
        await createIncrementalLongMemEvalJudgeTransport({
          cumulativeCapUsd: 2,
          fetchImpl: async () => {
            throw new Error('synthetic transport failure')
          },
          freshSubcapUsd: 1,
          getFreshAccountedUsd: async () => 0,
          meterPath,
          openaiApiKey: OPENAI_KEY,
          openingAccountedUsd: 0,
          transcriptDirectory,
        })
      await assert.rejects(
        transport.callJudge({
          body: body(),
          cellId: 'question-failure-mutation',
          operationId: OPERATION_ID,
        }),
        (error) => error.code === 'JUDGE_TRANSPORT_ERROR',
      )
      const originalMeter = JSON.parse(
        await readFile(meterPath, 'utf8'),
      )

      const fakeReservation = structuredClone(originalMeter)
      fakeReservation.reservation = {
        judgeInputTokens: 0,
        judgeOutputTokens: 0,
        pricingTier: 'fake',
        usd: 0,
      }
      fakeReservation.terminal.uncertain =
        structuredClone(fakeReservation.reservation)
      fakeReservation.terminal.accountedUsd = 0
      await writeFile(
        meterPath,
        `${JSON.stringify(fakeReservation, null, 2)}\n`,
      )
      await assert.rejects(
        transport.verify(),
        (error) => error.code === 'JUDGE_EVIDENCE_INCOHERENT',
      )

      const badCap = structuredClone(originalMeter)
      badCap.capContext.projectedFreshUsd = 0
      await writeFile(
        meterPath,
        `${JSON.stringify(badCap, null, 2)}\n`,
      )
      await assert.rejects(
        transport.verify(),
        (error) => error.code === 'JUDGE_EVIDENCE_INCOHERENT',
      )

      const fabricatedTranscriptError = structuredClone(originalMeter)
      fabricatedTranscriptError.terminal.error = {
        code: 'JUDGE_TRANSCRIPT_TERMINAL_FAILED',
        message: 'synthetic transcript terminal failure',
      }
      fabricatedTranscriptError.terminal.outcome = 'transcript_error'
      fabricatedTranscriptError.terminal.transcript = null
      await writeFile(
        meterPath,
        `${JSON.stringify(fabricatedTranscriptError, null, 2)}\n`,
      )
      await assert.rejects(
        transport.verify(),
        (error) => error.code === 'JUDGE_EVIDENCE_INCOHERENT',
      )

      const [transcriptFile] = await readdir(transcriptDirectory)
      const transcriptPath = join(
        transcriptDirectory,
        transcriptFile,
      )
      const terminalTranscript = JSON.parse(
        await readFile(transcriptPath, 'utf8'),
      )
      const startedTranscript = {
        attempt: terminalTranscript.attempt,
        request: terminalTranscript.request,
        schemaVersion: terminalTranscript.schemaVersion,
        startedAt: terminalTranscript.startedAt,
        state: 'started',
      }
      const startedTranscriptText =
        `${JSON.stringify(startedTranscript, null, 2)}\n`
      assert.equal(
        createHash('sha256')
          .update(startedTranscriptText)
          .digest('hex'),
        fabricatedTranscriptError.transcript.startedSha256,
      )
      await writeFile(transcriptPath, startedTranscriptText)
      const verifiedTranscriptError = await transport.verify()
      assert.equal(
        verifiedTranscriptError.snapshot.accountedUsd,
        originalMeter.reservation.usd,
      )
      assert.equal(verifiedTranscriptError.transcript, null)

      fabricatedTranscriptError.terminal.accountedUsd = 0
      await writeFile(
        meterPath,
        `${JSON.stringify(fabricatedTranscriptError, null, 2)}\n`,
      )
      await assert.rejects(
        transport.verify(),
        (error) => error.code === 'JUDGE_EVIDENCE_INCOHERENT',
      )
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  createActiveBrainMeteredTransport,
} from '../evals/active-brain-live-meter.mjs'
import {
  ACTIVE_BRAIN_ANSWER_GENERATION,
  ACTIVE_BRAIN_FIRST5_LIMITS,
  ACTIVE_BRAIN_GEMINI_MODEL,
  ACTIVE_BRAIN_WRITER_GENERATION,
} from '../evals/active-brain-live-config.mjs'
import {
  J4_GEMINI_WRITER_GENERATION,
} from '../evals/longmemeval-live-config.mjs'
import {
  LONGMEMEVAL_JUDGE_MODEL,
  LONGMEMEVAL_JUDGE_REQUEST,
} from '../evals/longmemeval-judge.mjs'

const GEMINI_KEY = 'gemini-active-fake-key'
const OPENAI_KEY = 'openai-active-fake-key'

function geminiBody(purpose, generation = purpose === 'writer'
  ? ACTIVE_BRAIN_WRITER_GENERATION
  : ACTIVE_BRAIN_ANSWER_GENERATION) {
  return {
    contents: [{
      parts: [{ text: purpose === 'writer' ? 'Observe this turn.' : 'Answer.' }],
      role: 'user',
    }],
    generationConfig: structuredClone(generation),
    store: false,
    ...(purpose === 'writer'
      ? { systemInstruction: { parts: [{ text: 'Return JSON.' }] } }
      : {}),
  }
}

function judgeBody() {
  return {
    max_tokens: LONGMEMEVAL_JUDGE_REQUEST.maxTokens,
    messages: [{ content: 'Is this correct?', role: 'user' }],
    model: LONGMEMEVAL_JUDGE_MODEL,
    n: LONGMEMEVAL_JUDGE_REQUEST.n,
    temperature: LONGMEMEVAL_JUDGE_REQUEST.temperature,
  }
}

function geminiJson(text = '{"statements":[]}') {
  return JSON.stringify({
    candidates: [{
      content: { parts: [{ text }] },
      finishReason: 'STOP',
    }],
    modelVersion: `${ACTIVE_BRAIN_GEMINI_MODEL}-001`,
    usageMetadata: {
      candidatesTokenCount: 2,
      promptTokenCount: 10,
      thoughtsTokenCount: 1,
      totalTokenCount: 13,
    },
  })
}

function judgeJson() {
  return JSON.stringify({
    choices: [{
      finish_reason: 'stop',
      index: 0,
      message: { content: 'yes', role: 'assistant' },
    }],
    model: LONGMEMEVAL_JUDGE_MODEL,
    usage: {
      completion_tokens: 1,
      prompt_tokens: 10,
      total_tokens: 11,
    },
  })
}

function response(body, status = 200, headers = {}) {
  return new Response(body, {
    headers: { 'content-type': 'application/json', ...headers },
    status,
  })
}

async function withMeter(fetchImpl, action, {
  capUsd = 6,
  waitImpl = async () => {},
} = {}) {
  const root = await mkdtemp(join(tmpdir(), 'palari-active-meter-'))
  const journalPath = join(root, 'evidence', 'meter.jsonl')
  const transcriptDirectory = join(root, 'evidence', 'transcripts')
  let meter
  try {
    meter = await createActiveBrainMeteredTransport({
      answerGeneration: ACTIVE_BRAIN_ANSWER_GENERATION,
      capUsd,
      fetchImpl,
      geminiApiKey: GEMINI_KEY,
      geminiModel: ACTIVE_BRAIN_GEMINI_MODEL,
      journalPath,
      limits: ACTIVE_BRAIN_FIRST5_LIMITS,
      openaiApiKey: OPENAI_KEY,
      retryJitterImpl: () => 0,
      transcriptDirectory,
      waitImpl,
      writerGeneration: ACTIVE_BRAIN_WRITER_GENERATION,
    })
    await action({ journalPath, meter, transcriptDirectory })
  } finally {
    meter?.closeNetworkGuard()
    await rm(root, { force: true, recursive: true })
  }
}

test('active meter import is inert', () => {
  const imported = spawnSync(process.execPath, [
    '--input-type=module',
    '--eval',
    [
      'globalThis.fetch=()=>{throw new Error("network on import")}',
      'await import("./evals/active-brain-live-meter.mjs")',
      'process.stdout.write("inert")',
    ].join(';'),
  ], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
  })
  assert.equal(imported.status, 0, imported.stderr)
  assert.equal(imported.stdout, 'inert')
})

test('active writer, answer, and judge reconcile 3/3 with zero uncertainty',
  async () => {
    const urls = []
    await withMeter(async (url) => {
      urls.push(String(url))
      return urls.length === 3
        ? response(judgeJson())
        : response(geminiJson(urls.length === 1
          ? '{"statements":[]}'
          : 'The remembered answer.'))
    }, async ({ meter }) => {
      await meter.callGemini({
        body: geminiBody('writer'),
        cellId: 'writer-cell',
        operationId: 'writer-operation',
        purpose: 'writer',
      })
      await meter.callGemini({
        body: geminiBody('answer'),
        cellId: 'answer-cell',
        operationId: 'answer-operation',
        purpose: 'answer',
      })
      await meter.callJudge({
        body: judgeBody(),
        cellId: 'judge-cell',
        model: LONGMEMEVAL_JUDGE_MODEL,
        operationId: 'judge-operation',
      })
      const audit = await meter.verify()
      assert.equal(audit.ledger.attempts, 3)
      assert.deepEqual(audit.ledger.logicalRequests, {
        answer: 1,
        judge: 1,
        writer: 1,
      })
      assert.deepEqual(audit.ledger.uncertain, {
        geminiInputTokens: 0,
        geminiOutputTokens: 0,
        judgeInputTokens: 0,
        judgeOutputTokens: 0,
        usd: 0,
      })
      assert.equal(audit.transcripts.attempts, 3)
      assert.match(urls[0],
        /models\/gemini-3\.5-flash-lite:generateContent$/)
    })
  })

test('terminal V5 writer generation is rejected before fetch', async () => {
  let calls = 0
  await withMeter(async () => {
    calls += 1
    return response(geminiJson())
  }, async ({ meter }) => {
    await assert.rejects(
      meter.callGemini({
        body: geminiBody('writer', J4_GEMINI_WRITER_GENERATION),
        cellId: 'old-writer-cell',
        operationId: 'old-writer-operation',
        purpose: 'writer',
      }),
      (error) => error.code === 'GEMINI_REQUEST_SCHEMA',
    )
    assert.equal(calls, 0)
  })
})

test('Gemini retry-after 123 seconds stops at the 59-second ceiling',
  async () => {
    let calls = 0
    const waits = []
    await withMeter(async () => {
      calls += 1
      return response(
        JSON.stringify({ error: { status: 'RESOURCE_EXHAUSTED' } }),
        429,
        { 'retry-after': '123' },
      )
    }, async ({ meter }) => {
      await assert.rejects(
        meter.callGemini({
          body: geminiBody('writer'),
          cellId: 'retry-cell',
          operationId: 'retry-operation',
          purpose: 'writer',
        }),
        (error) => error.code === 'RETRY_DELAY_EXCEEDS_LIMIT',
      )
      assert.equal(calls, 1)
      assert.deepEqual(waits, [])
    }, {
      waitImpl: async (milliseconds) => waits.push(milliseconds),
    })
  })

test('spend cap refuses before provider fetch', async () => {
  let calls = 0
  await withMeter(async () => {
    calls += 1
    return response(geminiJson())
  }, async ({ meter }) => {
    await assert.rejects(
      meter.callGemini({
        body: geminiBody('writer'),
        cellId: 'cap-cell',
        operationId: 'cap-operation',
        purpose: 'writer',
      }),
      (error) => error.code === 'J4_SPEND_CAP',
    )
    assert.equal(calls, 0)
  }, { capUsd: 1e-9 })
})

test('verification rejects ledger/transcript model tampering', async () => {
  await withMeter(
    async () => response(geminiJson()),
    async ({ journalPath, meter }) => {
      await meter.callGemini({
        body: geminiBody('writer'),
        cellId: 'tamper-cell',
        operationId: 'tamper-operation',
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
        { encoding: 'utf8', mode: 0o600 },
      )
      await assert.rejects(
        meter.verify(),
        (error) => error.code === 'EVIDENCE_COHERENCE',
      )
    },
  )
})

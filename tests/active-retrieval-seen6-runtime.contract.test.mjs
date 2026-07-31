import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  mkdtemp,
  rm,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  captureActiveRetrievalSeenSixJudgeFactory,
} from '../evals/active-retrieval-seen6-runtime.mjs'
import {
  buildIncrementalLongMemEvalJudgeBody,
  INCREMENTAL_LONGMEMEVAL_JUDGE_MODEL,
} from '../evals/incremental-longmemeval-judge.mjs'

const OPENAI_KEY = 'seen-six-runtime-fake-openai-key'

function instance() {
  return {
    answer: '9 months',
    answerSessionIds: ['answer-session'],
    isAbstention: false,
    question: 'How long have I used the device?',
    questionDate: '2023-09-04T17:07:00.000Z',
    questionId: 'seen-six-offline-question',
    questionType: 'knowledge-update',
    sessions: [{
      eventAt: '2023-09-02T01:13:00.000Z',
      sessionId: 'answer-session',
      turns: [{
        content: 'I have used the device for 9 months.',
        role: 'user',
      }],
    }],
  }
}

function judgeResponse() {
  return new Response(JSON.stringify({
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
      prompt_tokens_details: { cached_tokens: 0 },
      total_tokens: 126,
    },
  }), {
    headers: { 'content-type': 'application/json' },
    status: 200,
  })
}

test('seen-six judge composition import is inert', () => {
  const imported = spawnSync(process.execPath, [
    '--input-type=module',
    '--eval',
    [
      'globalThis.fetch=()=>{throw new Error("network on import")}',
      'await import("./evals/active-retrieval-seen6-runtime.mjs")',
      'process.stdout.write("inert")',
    ].join(';'),
  ], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
  })
  assert.equal(imported.status, 0, imported.stderr)
  assert.equal(imported.stdout, 'inert')
})

test('seen-six composition refuses without a captured fetch', () => {
  assert.throws(
    () => captureActiveRetrievalSeenSixJudgeFactory({ fetchImpl: null }),
    (error) => error?.code === 'JUDGE_FETCH_MISSING',
  )
})

test('seen-six answer-to-judge seam reaches the real transport once',
  async () => {
    const root = await mkdtemp(join(tmpdir(), 'palari-seen-six-judge-'))
    let calls = 0
    try {
      const createJudge = captureActiveRetrievalSeenSixJudgeFactory({
        async fetchImpl(url, init) {
          calls += 1
          assert.equal(String(url), 'https://api.openai.com/v1/chat/completions')
          assert.equal(init.method, 'POST')
          assert.equal(init.headers.authorization, `Bearer ${OPENAI_KEY}`)
          const body = JSON.parse(init.body)
          assert.equal(body.store, false)
          assert.equal(body.service_tier, 'default')
          return judgeResponse()
        },
      })
      const judge = await createJudge({
        cumulativeCapUsd: 6.5885167,
        fetchImpl: async () => {
          throw new Error('caller must not replace the captured fetch')
        },
        freshSubcapUsd: 3.48232975,
        getFreshAccountedUsd: async () => 0,
        meterPath: join(root, 'meter.json'),
        openaiApiKey: OPENAI_KEY,
        openingAccountedUsd: 3.10618695,
        transcriptDirectory: join(root, 'transcripts'),
      })
      const fixture = instance()
      const result = await judge.callJudge({
        body: buildIncrementalLongMemEvalJudgeBody(
          fixture,
          'I have used it for 9 months.',
        ),
        cellId: fixture.questionId,
        operationId: `${fixture.questionId}:judge`,
      })
      const evidence = await judge.verify()

      assert.equal(calls, 1)
      assert.equal(result.validated, true)
      assert.equal(result.text, 'yes')
      assert.equal(evidence.snapshot.attempts, 1)
      assert.equal(evidence.snapshot.state, 'terminal')
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

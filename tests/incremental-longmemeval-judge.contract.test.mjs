import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'

import {
  assertIncrementalLongMemEvalJudgeBody,
  buildIncrementalLongMemEvalJudgeBody,
  INCREMENTAL_LONGMEMEVAL_JUDGE_MODEL,
  INCREMENTAL_LONGMEMEVAL_JUDGE_PRICING,
  INCREMENTAL_LONGMEMEVAL_JUDGE_REQUEST,
  incrementalLongMemEvalJudgeProvenance,
  parseIncrementalLongMemEvalJudgeResponse,
  reserveIncrementalLongMemEvalJudge,
} from '../evals/incremental-longmemeval-judge.mjs'
import {
  buildLongMemEvalJudgePrompt,
  LONGMEMEVAL_JUDGE_MODEL,
  LONGMEMEVAL_JUDGE_REQUEST,
  longMemEvalJudgeProvenance,
} from '../evals/longmemeval-judge.mjs'

const instance = Object.freeze({
  answer: 'Almond milk',
  isAbstention: false,
  question: 'Which milk does the user currently prefer?',
  questionType: 'knowledge-update',
})

function body() {
  return buildIncrementalLongMemEvalJudgeBody(
    instance,
    'The user currently prefers almond milk.',
  )
}

function response(overrides = {}) {
  return JSON.stringify({
    choices: [{
      finish_reason: 'stop',
      index: 0,
      message: {
        content: ' Yes ',
        role: 'assistant',
      },
    }],
    model: LONGMEMEVAL_JUDGE_MODEL,
    service_tier: 'default',
    usage: {
      completion_tokens: 1,
      prompt_tokens: 125,
      total_tokens: 126,
    },
    ...overrides,
  })
}

function parse({
  judgeBody = body(),
  rawBody,
  reservation,
} = {}) {
  return parseIncrementalLongMemEvalJudgeResponse({
    body: judgeBody,
    rawBody: rawBody ?? response(),
    reservation: reservation ??
      reserveIncrementalLongMemEvalJudge(judgeBody),
  })
}

test('incremental judge import is inert and contains no network function', () => {
  const imported = spawnSync(process.execPath, [
    '--input-type=module',
    '--eval',
    [
      'globalThis.fetch=()=>{throw new Error("network on import")}',
      'const m=await import("./evals/incremental-longmemeval-judge.mjs")',
      'if(Object.values(m).some(v=>typeof v==="function" && String(v).includes("fetch")))throw new Error("network function")',
      'process.stdout.write("inert")',
    ].join(';'),
  ], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
  })
  assert.equal(imported.status, 0, imported.stderr)
  assert.equal(imported.stdout, 'inert')
})

test('body preserves LongMemEval and adds only stateless standard service',
  () => {
    const judgeBody = body()
    assert.deepEqual(judgeBody, {
      max_tokens: LONGMEMEVAL_JUDGE_REQUEST.maxTokens,
      messages: [{
        content: buildLongMemEvalJudgePrompt({
          ...instance,
          hypothesis: 'The user currently prefers almond milk.',
        }),
        role: 'user',
      }],
      model: LONGMEMEVAL_JUDGE_MODEL,
      n: LONGMEMEVAL_JUDGE_REQUEST.n,
      service_tier: 'default',
      store: false,
      temperature: LONGMEMEVAL_JUDGE_REQUEST.temperature,
    })
    assert.equal(INCREMENTAL_LONGMEMEVAL_JUDGE_MODEL,
      LONGMEMEVAL_JUDGE_MODEL)
    assert.deepEqual(INCREMENTAL_LONGMEMEVAL_JUDGE_REQUEST, {
      maxTokens: LONGMEMEVAL_JUDGE_REQUEST.maxTokens,
      n: LONGMEMEVAL_JUDGE_REQUEST.n,
      serviceTier: 'default',
      store: false,
      temperature: LONGMEMEVAL_JUDGE_REQUEST.temperature,
    })
    assert.equal(incrementalLongMemEvalJudgeProvenance,
      longMemEvalJudgeProvenance)
    assert.equal(assertIncrementalLongMemEvalJudgeBody(judgeBody), judgeBody)
  })

test('reservation uses highest-tier prices and measurement uses standard',
  () => {
    const judgeBody = body()
    const reservation = reserveIncrementalLongMemEvalJudge(judgeBody)
    const reservedInput =
      Buffer.byteLength(JSON.stringify(judgeBody), 'utf8') + 512
    assert.deepEqual(reservation, {
      judgeInputTokens: reservedInput,
      judgeOutputTokens: LONGMEMEVAL_JUDGE_REQUEST.maxTokens,
      pricingTier: 'priority',
      usd:
        reservedInput *
          INCREMENTAL_LONGMEMEVAL_JUDGE_PRICING
            .reservationHighestTier.input +
        LONGMEMEVAL_JUDGE_REQUEST.maxTokens *
          INCREMENTAL_LONGMEMEVAL_JUDGE_PRICING
            .reservationHighestTier.output,
    })

    const parsed = parse({ judgeBody, reservation })
    assert.equal(parsed.text, 'Yes')
    assert.equal(parsed.modelVersion, LONGMEMEVAL_JUDGE_MODEL)
    assert.equal(parsed.serviceTier, 'default')
    assert.deepEqual(parsed.measured, {
      judgeInputTokens: 125,
      judgeOutputTokens: 1,
      pricingTier: 'default',
      totalTokens: 126,
      usd:
        125 *
          INCREMENTAL_LONGMEMEVAL_JUDGE_PRICING.measuredStandard.input +
        INCREMENTAL_LONGMEMEVAL_JUDGE_PRICING.measuredStandard.output,
  })
})

test('measurement applies the published cached GPT-4o input price', () => {
  const parsed = parse({
    rawBody: response({
      usage: {
        completion_tokens: 1,
        prompt_tokens: 125,
        prompt_tokens_details: {
          cached_tokens: 25,
        },
        total_tokens: 126,
      },
    }),
  })
  assert.equal(
    parsed.measured.usd,
    100 *
      INCREMENTAL_LONGMEMEVAL_JUDGE_PRICING.measuredStandard.input +
      25 *
        INCREMENTAL_LONGMEMEVAL_JUDGE_PRICING
          .measuredStandard.cachedInput +
      INCREMENTAL_LONGMEMEVAL_JUDGE_PRICING.measuredStandard.output,
  )
})

test('body rejects any drift from the isolated provider contract', () => {
  for (const [field, value] of [
    ['max_tokens', 11],
    ['model', 'gpt-4o'],
    ['n', 2],
    ['service_tier', 'auto'],
    ['store', true],
    ['temperature', 1],
  ]) {
    const changed = { ...body(), [field]: value }
    assert.throws(
      () => assertIncrementalLongMemEvalJudgeBody(changed),
      (error) => error.code === 'JUDGE_BODY_INVALID',
      field,
    )
  }
  assert.throws(
    () => assertIncrementalLongMemEvalJudgeBody({
      ...body(),
      metadata: {},
    }),
    (error) => error.code === 'JUDGE_BODY_INVALID',
  )
})

test('response rejects model, tier, choice, finish, and content drift', () => {
  const cases = [
    [
      response({ model: 'gpt-4o' }),
      'JUDGE_MODEL_MISMATCH',
    ],
    [
      response({ service_tier: 'priority' }),
      'JUDGE_SERVICE_TIER_MISMATCH',
    ],
    [
      response({ choices: [] }),
      'JUDGE_CHOICE_COUNT',
    ],
    [
      response({
        choices: [{
          finish_reason: 'length',
          index: 0,
          message: { content: 'yes', role: 'assistant' },
        }],
      }),
      'JUDGE_TRUNCATED',
    ],
    [
      response({
        choices: [{
          finish_reason: 'stop',
          index: 0,
          message: { content: '  ', role: 'assistant' },
        }],
      }),
      'JUDGE_CONTENT_EMPTY',
    ],
  ]
  for (const [rawBody, code] of cases) {
    assert.throws(
      () => parse({ rawBody }),
      (error) => error.code === code,
      code,
    )
  }
})

test('response rejects malformed, inconsistent, and unreserved usage', () => {
  assert.throws(
    () => parse({ rawBody: '{' }),
    (error) => error.code === 'JUDGE_JSON_INVALID',
  )
  for (const usage of [
    {
      completion_tokens: 1,
      prompt_tokens: 125,
      total_tokens: 125,
    },
    {
      completion_tokens: 11,
      prompt_tokens: 125,
      total_tokens: 136,
    },
    {
      completion_tokens: 0,
      prompt_tokens: 125,
      total_tokens: 125,
    },
  ]) {
    assert.throws(
      () => parse({ rawBody: response({ usage }) }),
      (error) => error.code === 'JUDGE_USAGE_INVALID',
    )
  }
  assert.throws(
    () => parse({
      reservation: {
        judgeInputTokens: 1,
        judgeOutputTokens: 10,
        pricingTier: 'priority',
        usd: 1,
      },
    }),
    (error) => error.code === 'JUDGE_RESERVATION_INVALID',
  )
})

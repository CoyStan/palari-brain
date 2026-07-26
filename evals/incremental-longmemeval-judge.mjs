// Stateless OpenAI transport contract for incremental LongMemEval runs.
//
// The scoring prompt, model snapshot, and sampling parameters remain inherited
// from the pinned official-compatible LongMemEval adaptation. The two added
// request fields affect provider retention and serving tier, not grading.

import {
  buildLongMemEvalJudgePrompt,
  LONGMEMEVAL_JUDGE_MODEL,
  LONGMEMEVAL_JUDGE_REQUEST,
  longMemEvalJudgeProvenance,
} from './longmemeval-judge.mjs'

export const INCREMENTAL_LONGMEMEVAL_JUDGE_MODEL =
  LONGMEMEVAL_JUDGE_MODEL

export const INCREMENTAL_LONGMEMEVAL_JUDGE_REQUEST = Object.freeze({
  maxTokens: LONGMEMEVAL_JUDGE_REQUEST.maxTokens,
  n: LONGMEMEVAL_JUDGE_REQUEST.n,
  serviceTier: 'default',
  store: false,
  temperature: LONGMEMEVAL_JUDGE_REQUEST.temperature,
})

// Current official GPT-4o prices per token:
// https://developers.openai.com/api/docs/pricing
//
// Reserve at the highest documented synchronous tier even though the request
// pins standard service. This is conservative with respect to tier pricing;
// the byte-based input-token estimate is not a provider-guaranteed ceiling.
export const INCREMENTAL_LONGMEMEVAL_JUDGE_PRICING = Object.freeze({
  measuredStandard: Object.freeze({
    cachedInput: 1.25 / 1_000_000,
    input: 2.50 / 1_000_000,
    output: 10.00 / 1_000_000,
    tier: 'default',
  }),
  reservationHighestTier: Object.freeze({
    input: 4.25 / 1_000_000,
    output: 17.00 / 1_000_000,
    tier: 'priority',
  }),
})

export const incrementalLongMemEvalJudgeProvenance =
  longMemEvalJudgeProvenance

const bodyKeys = Object.freeze([
  'max_tokens',
  'messages',
  'model',
  'n',
  'service_tier',
  'store',
  'temperature',
])

function nonEmptyString(value) {
  return typeof value === 'string' && Boolean(value.trim())
}

function positiveSafeInteger(value) {
  return Number.isSafeInteger(value) && value > 0
}

function sameKeys(value, expected) {
  return value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) ===
      JSON.stringify([...expected].sort())
}

function sameReservation(actual, expected) {
  return sameKeys(actual, [
    'judgeInputTokens',
    'judgeOutputTokens',
    'pricingTier',
    'usd',
  ]) &&
    actual.judgeInputTokens === expected.judgeInputTokens &&
    actual.judgeOutputTokens === expected.judgeOutputTokens &&
    actual.pricingTier === expected.pricingTier &&
    actual.usd === expected.usd
}

export class IncrementalLongMemEvalJudgeError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'IncrementalLongMemEvalJudgeError'
    this.code = code
  }
}

export function assertIncrementalLongMemEvalJudgeBody(body) {
  if (!sameKeys(body, bodyKeys) ||
    body.max_tokens !== LONGMEMEVAL_JUDGE_REQUEST.maxTokens ||
    body.model !== LONGMEMEVAL_JUDGE_MODEL ||
    body.n !== LONGMEMEVAL_JUDGE_REQUEST.n ||
    body.service_tier !== 'default' ||
    body.store !== false ||
    body.temperature !== LONGMEMEVAL_JUDGE_REQUEST.temperature ||
    !Array.isArray(body.messages) ||
    body.messages.length !== 1 ||
    !sameKeys(body.messages[0], ['content', 'role']) ||
    body.messages[0].role !== 'user' ||
    !nonEmptyString(body.messages[0].content)) {
    throw new IncrementalLongMemEvalJudgeError(
      'JUDGE_BODY_INVALID',
      'Incremental LongMemEval judge body differs from its frozen contract.',
    )
  }
  return body
}

export function buildIncrementalLongMemEvalJudgeBody(
  instance,
  hypothesis,
) {
  const body = {
    max_tokens: LONGMEMEVAL_JUDGE_REQUEST.maxTokens,
    messages: [{
      content: buildLongMemEvalJudgePrompt({
        answer: instance?.answer,
        hypothesis,
        isAbstention: instance?.isAbstention,
        question: instance?.question,
        questionType: instance?.questionType,
      }),
      role: 'user',
    }],
    model: LONGMEMEVAL_JUDGE_MODEL,
    n: LONGMEMEVAL_JUDGE_REQUEST.n,
    service_tier: 'default',
    store: false,
    temperature: LONGMEMEVAL_JUDGE_REQUEST.temperature,
  }
  return assertIncrementalLongMemEvalJudgeBody(body)
}

export function reserveIncrementalLongMemEvalJudge(body) {
  assertIncrementalLongMemEvalJudgeBody(body)
  const judgeInputTokens =
    Buffer.byteLength(JSON.stringify(body), 'utf8') + 512
  const judgeOutputTokens = body.max_tokens
  const prices =
    INCREMENTAL_LONGMEMEVAL_JUDGE_PRICING.reservationHighestTier
  return {
    judgeInputTokens,
    judgeOutputTokens,
    pricingTier: prices.tier,
    usd:
      judgeInputTokens * prices.input +
      judgeOutputTokens * prices.output,
  }
}

function parseResponse(rawBody) {
  let parsed
  try {
    parsed = JSON.parse(String(rawBody))
  } catch {
    throw new IncrementalLongMemEvalJudgeError(
      'JUDGE_JSON_INVALID',
      'OpenAI judge response is not valid JSON.',
    )
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new IncrementalLongMemEvalJudgeError(
      'JUDGE_JSON_INVALID',
      'OpenAI judge response must be one JSON object.',
    )
  }
  return parsed
}

function measureUsage({ body, parsed, reservation }) {
  const expectedReservation = reserveIncrementalLongMemEvalJudge(body)
  if (!sameReservation(reservation, expectedReservation)) {
    throw new IncrementalLongMemEvalJudgeError(
      'JUDGE_RESERVATION_INVALID',
      'OpenAI judge reservation is absent or not priced at the frozen tier.',
    )
  }
  const judgeInputTokens = parsed?.usage?.prompt_tokens
  const judgeOutputTokens = parsed?.usage?.completion_tokens
  const totalTokens = parsed?.usage?.total_tokens
  const cachedInputTokens =
    parsed?.usage?.prompt_tokens_details?.cached_tokens ?? 0
  if (!positiveSafeInteger(judgeInputTokens) ||
    !positiveSafeInteger(judgeOutputTokens) ||
    !positiveSafeInteger(totalTokens) ||
    !Number.isSafeInteger(cachedInputTokens) ||
    cachedInputTokens < 0 ||
    cachedInputTokens > judgeInputTokens ||
    totalTokens !== judgeInputTokens + judgeOutputTokens ||
    judgeInputTokens > reservation.judgeInputTokens ||
    judgeOutputTokens > reservation.judgeOutputTokens ||
    judgeOutputTokens > body.max_tokens) {
    throw new IncrementalLongMemEvalJudgeError(
      'JUDGE_USAGE_INVALID',
      'OpenAI judge usage is missing, inconsistent, or outside its reservation.',
    )
  }
  const prices = INCREMENTAL_LONGMEMEVAL_JUDGE_PRICING.measuredStandard
  return {
    judgeInputTokens,
    judgeOutputTokens,
    pricingTier: prices.tier,
    totalTokens,
    usd:
      (judgeInputTokens - cachedInputTokens) * prices.input +
      cachedInputTokens * prices.cachedInput +
      judgeOutputTokens * prices.output,
  }
}

export function parseIncrementalLongMemEvalJudgeResponse({
  body,
  rawBody,
  reservation,
} = {}) {
  assertIncrementalLongMemEvalJudgeBody(body)
  const parsed = parseResponse(rawBody)
  if (parsed.model !== LONGMEMEVAL_JUDGE_MODEL) {
    throw new IncrementalLongMemEvalJudgeError(
      'JUDGE_MODEL_MISMATCH',
      'OpenAI returned a different LongMemEval judge snapshot.',
    )
  }
  if (parsed.service_tier !== 'default') {
    throw new IncrementalLongMemEvalJudgeError(
      'JUDGE_SERVICE_TIER_MISMATCH',
      'OpenAI did not serve the judge request on the pinned default tier.',
    )
  }
  if (!Array.isArray(parsed.choices) || parsed.choices.length !== 1) {
    throw new IncrementalLongMemEvalJudgeError(
      'JUDGE_CHOICE_COUNT',
      'OpenAI judge must return exactly one choice.',
    )
  }
  const choice = parsed.choices[0]
  if (choice?.finish_reason !== 'stop') {
    throw new IncrementalLongMemEvalJudgeError(
      choice?.finish_reason === 'length'
        ? 'JUDGE_TRUNCATED'
        : 'JUDGE_FINISH_REASON',
      'OpenAI judge did not finish with stop.',
    )
  }
  const text = choice?.message?.content
  if (!nonEmptyString(text)) {
    throw new IncrementalLongMemEvalJudgeError(
      'JUDGE_CONTENT_EMPTY',
      'OpenAI judge returned no visible text.',
    )
  }
  const measured = measureUsage({
    body,
    parsed,
    reservation,
  })
  return {
    finishReason: choice.finish_reason,
    measured,
    modelVersion: parsed.model,
    rawUsage: parsed.usage,
    serviceTier: parsed.service_tier,
    text: text.trim(),
  }
}

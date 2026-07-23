import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

import {
  LONGMEMEVAL_JUDGE_MODEL,
  LONGMEMEVAL_JUDGE_REQUEST,
  buildLongMemEvalJudgePrompt,
  longMemEvalJudgeProvenance,
  parseLongMemEvalJudgeLabel,
} from '../evals/longmemeval-judge.mjs'

const base = {
  answer: 'Lisbon',
  hypothesis: 'The remembered city was Lisbon.',
  question: 'Where did the user live?',
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

test('LongMemEval judge pins the official model and source provenance', () => {
  assert.equal(LONGMEMEVAL_JUDGE_MODEL, 'gpt-4o-2024-08-06')
  assert.deepEqual(LONGMEMEVAL_JUDGE_REQUEST, {
    maxTokens: 10,
    n: 1,
    temperature: 0,
  })
  assert.equal(
    longMemEvalJudgeProvenance.sourceCommit,
    '9e0b455f4ef0e2ab8f2e582289761153549043fc',
  )
  assert.match(longMemEvalJudgeProvenance.sourceSha256, /^[a-f0-9]{64}$/)
  assert.equal(longMemEvalJudgeProvenance.license, 'MIT')
})

test('LongMemEval standard prompt is byte-compatible with upstream wording', () => {
  const prompt = buildLongMemEvalJudgePrompt({
    ...base,
    questionType: 'single-session-user',
  })
  assert.match(prompt, /^I will give you a question, a correct answer/)
  assert.match(prompt, /Question: Where did the user live\?/)
  assert.match(prompt, /Correct Answer: Lisbon/)
  assert.match(prompt, /Model Response: The remembered city was Lisbon\./)
  assert.match(prompt, /Answer yes or no only\.$/)
  assert.ok(prompt.includes('answer no. \n\nQuestion:'), 'upstream trailing space is preserved')
  assert.equal(
    sha256(prompt),
    '53ea74ccde291a1a9d0a7c400058e866ec9455cd97e8c3e2e78a84baaea3e34d',
    'the complete rendered prompt is pinned byte for byte',
  )
})

test('LongMemEval judge selects every official specialized rubric', () => {
  const temporal = buildLongMemEvalJudgePrompt({
    ...base,
    questionType: 'temporal-reasoning',
  })
  assert.match(temporal, /do not penalize off-by-one errors/)
  assert.equal(
    sha256(temporal),
    'f42085c3af570320a25236dd33eddcd75f965599cb8976539177b86e9db30901',
  )

  const update = buildLongMemEvalJudgePrompt({
    ...base,
    questionType: 'knowledge-update',
  })
  assert.match(update, /previous information along with an updated answer/)
  assert.equal(
    sha256(update),
    '33600090a46dd0a4bfd84457a350ee51a682aefe26bb9d4b546792825b3d4f15',
  )

  const preference = buildLongMemEvalJudgePrompt({
    ...base,
    questionType: 'single-session-preference',
  })
  assert.match(preference, /rubric for desired personalized response/)
  assert.equal(
    sha256(preference),
    '73ab113a960435917a3bae9154cfa7431fb9bc7bdfe247c65f42d5ae798ac330',
  )

  const abstention = buildLongMemEvalJudgePrompt({
    ...base,
    isAbstention: true,
    questionType: 'knowledge-update',
  })
  assert.match(abstention, /^I will give you an unanswerable question/)
  assert.match(abstention, /Explanation: Lisbon/)
  assert.equal(
    sha256(abstention),
    'fa0026620414bfa86f836badf455f6f4a7a3351ef1199ebe7b1aecb005924afe',
  )
})

test('LongMemEval judge rejects unknown non-abstention types', () => {
  assert.throws(
    () => buildLongMemEvalJudgePrompt({ ...base, questionType: 'invented' }),
    /Unsupported LongMemEval judge question type/,
  )
})

test('LongMemEval label parsing mirrors the official contains-yes rule', () => {
  assert.equal(parseLongMemEvalJudgeLabel('yes'), true)
  assert.equal(parseLongMemEvalJudgeLabel('YES.'), true)
  assert.equal(parseLongMemEvalJudgeLabel('no'), false)
  assert.equal(parseLongMemEvalJudgeLabel(''), false)
  assert.equal(parseLongMemEvalJudgeLabel('not yes'), true)
})

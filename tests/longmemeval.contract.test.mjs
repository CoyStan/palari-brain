// U6 contract tests — LongMemEval intake (loader only; license verdict
// recorded in docs/DECISIONS.md BEFORE any dataset touch).
// Completion law: loader parses N sample histories from committed
// SYNTHETIC mini-fixtures — the real dataset never enters git.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import {
  loadLongMemEvalInstances,
  longMemEvalQuestionTypes,
  parseLongMemEvalTimestamp,
} from '../src/longmemeval.mjs'

const fixturePath = new URL('./fixtures/longmemeval-mini.json', import.meta.url)

test('timestamp parsing: the documented %Y/%m/%d (%a) %H:%M format becomes ISO UTC', () => {
  assert.equal(parseLongMemEvalTimestamp('2023/05/20 (Sat) 02:21'), '2023-05-20T02:21:00.000Z')
  assert.equal(parseLongMemEvalTimestamp('2023/06/01 (Thu) 19:40'), '2023-06-01T19:40:00.000Z')
  // date-only variant used by the generator
  assert.equal(parseLongMemEvalTimestamp('2023/05/20'), '2023-05-20T00:00:00.000Z')
  assert.equal(parseLongMemEvalTimestamp('not a date'), null)
})

test('loader: parses the synthetic mini-fixtures into kernel session shape', async () => {
  const raw = await readFile(fixturePath, 'utf8')
  const instances = loadLongMemEvalInstances(raw)
  assert.equal(instances.length, 3)

  const multi = instances[0]
  assert.equal(multi.questionId, 'synthetic-multi-001')
  assert.equal(multi.questionType, 'multi-session')
  assert.ok(longMemEvalQuestionTypes.has(multi.questionType))
  assert.equal(multi.isAbstention, false)
  assert.equal(multi.questionDate, '2023-06-10T09:15:00.000Z')
  assert.equal(multi.sessions.length, 3)
  const s1 = multi.sessions[0]
  assert.equal(s1.sessionId, 'syn_s1')
  assert.equal(s1.eventAt, '2023-05-20T02:21:00.000Z', 'session timestamp becomes eventAt (evidence-time discipline)')
  assert.equal(s1.turns.length, 2)
  assert.deepEqual(s1.turns[0], {
    content: 'I live in Oaxaca now — I moved here for the food scene.',
    hasAnswer: true,
    role: 'user',
  })
  assert.equal(s1.turns[1].hasAnswer, false)
  assert.deepEqual(multi.answerSessionIds, ['syn_s1', 'syn_s3'])
})

test('loader: abstention questions are detected by the _abs suffix', async () => {
  const instances = loadLongMemEvalInstances(await readFile(fixturePath, 'utf8'))
  const abs = instances.find((i) => i.questionId.endsWith('_abs'))
  assert.ok(abs)
  assert.equal(abs.isAbstention, true)
  assert.deepEqual(abs.answerSessionIds, [])
})

test('loader: misaligned haystack arrays are rejected, not silently zipped', async () => {
  const instances = JSON.parse(await readFile(fixturePath, 'utf8'))
  const broken = [{ ...instances[0], haystack_dates: instances[0].haystack_dates.slice(0, 1) }]
  assert.throws(() => loadLongMemEvalInstances(broken), /aligned/i)
})

test('loader: unknown roles and question types are rejected', async () => {
  const instances = JSON.parse(await readFile(fixturePath, 'utf8'))
  const badRole = structuredClone(instances[0])
  badRole.haystack_sessions[0][0].role = 'system'
  assert.throws(() => loadLongMemEvalInstances([badRole]), /role/i)
  const badType = { ...structuredClone(instances[0]), question_type: 'vibes' }
  assert.throws(() => loadLongMemEvalInstances([badType]), /question_type/i)
})

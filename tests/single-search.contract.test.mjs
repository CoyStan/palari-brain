import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createPalariBrain, ingestChatTurn } from '../src/index.mjs'
import { answerWithSingleSearch } from '../src/answer-strategies.mjs'
const scope = { palariId: 'p', userId: 'u' }
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'palari-single-'))
  const brain = await createPalariBrain({ memoryEnabled: true, statePath: join(root, 'brain.json'), workspaceId: 'w' })
  t.after(async () => { brain.close(); await rm(root, { recursive: true, force: true }) })
  await ingestChatTurn(brain, { ...scope, userMessage: 'My bicycle is blue.', assistantMessage: 'Noted.', retention: 'durable', eventAt: '2025-01-01T00:00:00Z', sourceMessageId: 'one' })
  return brain
}
test('single-search baseline calls one answer provider with canonical evidence and no tools', async (t) => {
  const brain = await fixture(t)
  let calls = 0
  const result = await answerWithSingleSearch(brain, { ...scope, question: 'bicycle', provider: async (input) => {
    calls += 1
    assert.equal(input.retrieve, undefined)
    assert.equal(input.commitAnswer, undefined)
    assert.ok(Object.isFrozen(input.evidence))
    const row = input.evidence.find((row) => row.speaker === 'user')
    return { abstained: false, text: 'Blue.', bases: [{ evidenceId: row.evidenceId, quote: 'bicycle is blue' }] }
  } })
  assert.equal(calls, 1)
  assert.equal(result.retrievalCalls, 1)
  assert.equal(result.retrievalPlanningCalls, 0)
  assert.equal(result.answerCommitted, true)
  assert.equal(result.answerEvidence.length, 1)
})
test('single-search rejects fabricated citations and unreturned foreign evidence', async (t) => {
  const brain = await fixture(t)
  for (const forged of ['quote', 'id']) {
    await assert.rejects(answerWithSingleSearch(brain, { ...scope, question: 'bicycle', provider: async ({ evidence }) => ({
      abstained: false, text: 'Red.', bases: [{ evidenceId: forged === 'id' ? 'foreign' : evidence[0].evidenceId, quote: 'red bicycle' }],
    }) }), { code: 'MEMORY_ANSWER_COMMITMENT_INVALID' })
  }
})
test('empty scoped search abstains without calling an answer provider', async (t) => {
  const brain = await fixture(t)
  const result = await answerWithSingleSearch(brain, { ...scope, userId: 'other', question: 'bicycle', provider: () => { throw new Error('must not call') } })
  assert.equal(result.abstained, true)
  assert.equal(result.providerCalled, false)
  assert.equal(result.retrievalCalls, 1)
})

test('insufficient evidence permits an explicit uncited abstention only', async (t) => {
  const brain = await fixture(t)
  const answer = await answerWithSingleSearch(brain, { ...scope, question: 'bicycle', provider: () => ({ abstained: true, text: 'I cannot determine the model.', bases: [] }) })
  assert.equal(answer.answerCommitted, true)
  assert.deepEqual(answer.answerEvidence, [])
  await assert.rejects(answerWithSingleSearch(brain, { ...scope, question: 'bicycle', provider: () => ({ abstained: false, text: 'Invented.', bases: [] }) }), { code: 'MEMORY_ANSWER_COMMITMENT_INVALID' })
})

test('long questions can use an explicit bounded search query', async (t) => {
  const brain = await fixture(t)
  const question = 'bicycle '.repeat(100)
  const answer = await answerWithSingleSearch(brain, { ...scope, question, searchQuery: 'bicycle', provider: (input) => {
    assert.equal(input.question, question)
    return { abstained: true, text: 'Insufficient detail.', bases: [] }
  } })
  assert.equal(answer.retrievalTranscript[0].input.phrase, 'bicycle')
})

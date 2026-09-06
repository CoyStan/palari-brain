// Offline remember -> search/read -> correct -> forget, without a reducer.
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createPalariBrain, ingestChatTurn, forgetMemories } from '../src/core.mjs'
import { answerWithSingleSearch } from '../src/answers.mjs'

const root = await mkdtemp(join(tmpdir(), 'palari-simple-example-'))
const scope = { palariId: 'assistant', userId: 'owner' }
const brain = await createPalariBrain({
  memoryEnabled: true, statePath: join(root, 'brain.json'), workspaceId: 'example',
  digestMode: 'off', semanticAcceleration: 'exact',
})
// This fixture reads one changing fact. A real answer callback must assess
// relevance/conflicts and return the same structured citation contract.
const provider = ({ evidence }) => {
  const latest = evidence.filter((row) => row.speaker === 'user')
    .sort((a, b) => b.order - a.order)[0]
  return { abstained: false, text: latest.text,
    bases: [{ evidenceId: latest.evidenceId, quote: latest.text }] }
}
try {
  for (const [index, text] of ['My bicycle is blue.', 'Correction: my bicycle is green.'].entries()) {
    await ingestChatTurn(brain, {
      ...scope, userMessage: text, assistantMessage: 'Noted.',
      retention: 'durable', sourceMessageId: `turn-${index}`,
      eventAt: `2025-01-0${index + 1}T00:00:00Z`,
    })
    const answer = await answerWithSingleSearch(brain, { ...scope, question: 'bicycle', provider })
    assert.equal(answer.answer, text)
    assert.equal(answer.answerCommitted, true)
    console.log(`${index === 0 ? 'Remember' : 'Correct'}: ${answer.answer}`)
  }
  const found = brain.exploreFind(scope, { phrase: 'bicycle', ranked: true })
  const read = brain.exploreRead(scope, { evidenceIds: found.matches.map((row) => row.evidenceId) })
  assert.equal(read.messages.filter((row) => row.speaker === 'user').length, 2)
  console.log('Read: original and correction remain separately attributable.')
  forgetMemories(brain, brain.listEvidence(scope).map((row) => row.id), scope)
  const absent = await answerWithSingleSearch(brain, { ...scope, question: 'bicycle', provider: () => { throw Error('No provider call after forgetting') } })
  assert.equal(absent.providerCalled, false)
  assert.equal(absent.abstained, true)
  assert.equal(brain.publicStatus().lexicalRecall, true)
  assert.equal(brain.publicStatus().recall, 'canonical_journal')
  console.log('Forget: no evidence returned; no answer provider called.')
} finally {
  brain.close()
  await rm(root, { recursive: true, force: true })
}

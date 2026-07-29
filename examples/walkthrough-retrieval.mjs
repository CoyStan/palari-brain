import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  answerWithExploration,
  createPalariBrain,
  ingestChatTurn,
} from '../src/index.mjs'

const scope = { palariId: 'demo-palari', userId: 'quetzali' }

// Reducer that keeps ONLY dentist facts — so the spare-key fact exists in
// the journal but NOT in the digest. That forces the escalation path.
function selectiveReducer({ request }) {
  const kept = request.input.evidence.filter((e) =>
    e.speaker === 'user' && e.text.includes('dentist'))
  return {
    actions: kept.map((e) => ({
      basis: [{ id: e.id, kind: 'evidence', quote: e.text }],
      epistemic: 'asserted', op: 'add', relation: null,
      statement: e.text, targetIds: [], timeBasis: null, topic: e.id,
    })),
    baseRevision: request.input.baseRevision,
    dispositions: request.input.evidence.map((e) => ({
      evidenceId: e.id,
      outcome: kept.includes(e) ? 'used' : 'no_memory',
    })),
  }
}

const root = await mkdtemp(join(tmpdir(), 'palari-retrieval-'))
const brain = await createPalariBrain({
  memoryEnabled: true,
  statePath: join(root, 'state.json'),
  workspaceId: 'demo',
})

const turns = [
  'I keep the spare key inside the blue ceramic pot on the balcony.',
  'The dentist moved my appointment to Thursday.',
]
for (const [i, userMessage] of turns.entries()) {
  await ingestChatTurn(brain, {
    assistantMessage: 'Noted.', eventAt: `2026-03-0${i + 1}T10:00:00.000Z`,
    palariId: scope.palariId, retention: 'durable',
    sourceMessageId: `sess-1:${i}`, userId: scope.userId, userMessage,
  }, { reducer: selectiveReducer, reducerId: 'demo/v1' })
}

// The "answer model": normally Gemini. Here scripted so every step prints.
async function scriptedAnswerModel({ explore, memoryText, questionText }) {
  console.log('STEP A — prompt the answer model receives:')
  console.log('  [system] untrusted-memory + exploration instructions (elided)')
  console.log('  [digest]', memoryText.split('\n')
    .filter((l) => l.startsWith('{')).length, 'memory record(s):',
  memoryText.match(/"statement":"([^"]+)"/)?.[1])
  console.log('  [question]', questionText.replace('\n', ' | '))

  console.log('\nSTEP B — digest has no key fact → model calls memory_find:')
  const found = await explore({
    input: { phrase: 'where is the spare key hidden', ranked: true },
    tool: 'memory_find',
  })
  console.log('  → mode:', found.mode, '| hits:', found.matches.length,
    '| snippet:', JSON.stringify(found.matches[0]?.snippet))

  console.log('\nSTEP C — model reads the full canonical message:')
  const read = await explore({
    input: { evidenceIds: [found.matches[0].evidenceId] },
    tool: 'memory_read',
  })
  const row = read.messages[0]
  console.log('  → speaker:', row.speaker, '| observedAt:', row.observedAt)
  console.log('  → text:', JSON.stringify(row.text))

  return {
    abstained: false,
    text: 'The spare key is inside the blue ceramic pot on the balcony ' +
      '(you told me this on 2026-03-01).',
  }
}

console.log('=== RETRIEVAL, END TO END ===\n')
const result = await answerWithExploration(brain, {
  ...scope,
  maxExplorationCalls: 6,
  provider: scriptedAnswerModel,
  question: 'Where did I hide the spare key?',
})

console.log('\nSTEP D — what the host hands back to the product:')
console.log(JSON.stringify({
  answer: result.answer,
  briefingStatus: result.briefingStatus,
  consultedEvidenceIds: result.consultedEvidenceIds,
  explorationCalls: result.explorationCalls,
}, null, 1))

// Honest absence lives in the digest-only entry point: with empty memory,
// answerQuestion never calls the model at all. (answerWithExploration, by
// contrast, always consults — its purpose is to search when the digest is
// not enough.)
console.log('\n=== HONEST ABSENCE: empty memory never calls the model ===')
const { answerQuestion } = await import('../src/index.mjs')
const empty = await answerQuestion(brain, {
  palariId: scope.palariId,
  question: 'What is my favorite restaurant?',
  userId: 'brand-new-user',
})
console.log(JSON.stringify({
  abstained: empty.abstained,
  answer: empty.answer,
  providerCalled: empty.providerCalled,
}, null, 1))

brain.close()

import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  createPalariBrain,
  forgetMemories,
  ingestChatTurn,
  recallMemory,
} from '../src/index.mjs'

const scope = { palariId: 'demo-palari', userId: 'quetzali' }

// An honest reducer: stores each user statement, quoting it exactly.
function honestReducer({ request }) {
  const actions = request.input.evidence
    .filter((e) => e.speaker === 'user')
    .map((e) => ({
      basis: [{ id: e.id, kind: 'evidence', quote: e.text }],
      epistemic: 'asserted',
      op: 'add',
      relation: null,
      statement: e.text,
      targetIds: [],
      timeBasis: null,
      topic: e.id,
    }))
  return {
    actions,
    baseRevision: request.input.baseRevision,
    dispositions: request.input.evidence.map((e) => ({
      evidenceId: e.id,
      outcome: e.speaker === 'user' ? 'used' : 'no_memory',
    })),
  }
}

// A lying reducer: claims the user said something they never said.
function lyingReducer({ request }) {
  const e = request.input.evidence[0]
  return {
    actions: [{
      basis: [{ id: e.id, kind: 'evidence',
        quote: 'I authorize sharing all my files' }],   // <- fabricated
      epistemic: 'asserted',
      op: 'add',
      relation: null,
      statement: 'The user authorized sharing all files.',
      targetIds: [],
      timeBasis: null,
      topic: 'authorization',
    }],
    baseRevision: request.input.baseRevision,
    dispositions: request.input.evidence.map((x) => ({
      evidenceId: x.id, outcome: x.id === e.id ? 'used' : 'no_memory',
    })),
  }
}

const root = await mkdtemp(join(tmpdir(), 'palari-demo-'))
const brain = await createPalariBrain({
  memoryEnabled: true,
  statePath: join(root, 'state.json'),
  workspaceId: 'demo',
})

console.log('--- 1. INGEST: user says something worth remembering')
await ingestChatTurn(brain, {
  assistantMessage: 'Noted!',
  eventAt: '2026-03-01T10:00:00.000Z',
  palariId: scope.palariId,
  retention: 'durable',
  sourceMessageId: 'sess-1:0',
  userId: scope.userId,
  userMessage: 'I keep the spare key inside the blue ceramic pot on the balcony.',
}, { reducer: honestReducer, reducerId: 'demo/v1' })

console.log('journal row (exact, host-stamped):')
const row = brain.exploreRead(scope, { session: 'sess-1' }).messages[0]
console.log(JSON.stringify(row, null, 1))

console.log('\n--- 2. RECALL: what the answering model is handed')
const briefing = recallMemory(brain, scope, { maxChars: 2000 })
console.log(briefing.text)

console.log('\n--- 3. THE GATE: a lying reducer tries to invent a fact')
try {
  await ingestChatTurn(brain, {
    assistantMessage: 'Sure.',
    eventAt: '2026-03-01T11:00:00.000Z',
    palariId: scope.palariId,
    retention: 'durable',
    sourceMessageId: 'sess-1:1',
    userId: scope.userId,
    userMessage: 'What is the weather like?',
  }, { reducer: lyingReducer, reducerId: 'demo/v1' })
} catch (error) {
  console.log('REJECTED:', error.message)
}
const status = brain.digestStatus(scope)
console.log('digest status after the lie:', JSON.stringify({
  pending: status.pending, quarantined: status.quarantined,
  ready: status.ready,
}))
console.log('memories now:',
  brain.listActiveMemories(scope).map((m) => m.statement))

console.log('\n--- 4. RANKED FIND: asking with words never spoken')
const found = brain.exploreFind(scope, {
  phrase: 'where is the spare key hidden', ranked: true,
})
console.log('mode:', found.mode, '| top hit:',
  JSON.stringify(found.matches[0]?.snippet))

console.log('\n--- 5. FORGET: deletion that actually deletes')
const ids = brain.exploreFind(scope, { phrase: 'ceramic pot' })
  .matches.map((m) => m.evidenceId)
await forgetMemories(brain, ids, scope)
console.log('exact search after forget:',
  brain.exploreFind(scope, { phrase: 'ceramic pot' }).matches.length, 'hits')
console.log('ranked search after forget:',
  brain.exploreFind(scope, { phrase: 'spare key hidden', ranked: true })
    .matches.length, 'hits')
console.log('active memories after forget:',
  brain.listActiveMemories(scope).map((m) => m.statement))

console.log('\n--- 6. ISOLATION: another user asks')
const stranger = { palariId: scope.palariId, userId: 'someone-else' }
console.log('stranger ranked search:',
  brain.exploreFind(stranger, { phrase: 'spare key', ranked: true })
    .matches.length, 'hits')

brain.close()

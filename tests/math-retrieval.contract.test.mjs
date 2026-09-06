import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { answerWithRetrieval, createPalariBrain, ingestChatTurn } from '../src/index.mjs'

const scope = { palariId: 'math', userId: 'alice' }
async function fixture(t, options = {}) {
  const root = await mkdtemp(join(tmpdir(), 'palari-math-'))
  const brain = await createPalariBrain({ memoryEnabled: true,
    workspaceId: 'math', statePath: join(root, 'state.json'), ...options })
  t.after(async () => { brain.close(); await rm(root, { recursive: true, force: true }) })
  return brain
}
async function seed(brain) {
  for (let i = 1; i <= 3; i++) await ingestChatTurn(brain, {
    ...scope, retention: 'durable', sourceMessageId: `math:${i}`,
    eventAt: `2025-01-0${i}T00:00:00.000Z`,
    userMessage: 'The spare key is in the blue pot.', assistantMessage: 'Noted.',
  })
}
for (const ranked of [false, true]) test(`date bounds precede limit in ${ranked ? 'ranked' : 'exact'} search`, async t => {
  const brain = await fixture(t)
  await seed(brain)
  const result = brain.exploreFind(scope, { phrase: 'spare key', ranked, limit: 1,
    after: '2025-01-02T00:00:00.000Z', before: '2025-01-02T00:00:00.000Z' })
  assert.equal(result.matches.length, 1)
  assert.equal(result.matches[0].observedAt, '2025-01-02T00:00:00.000Z')
})
test('semantic single and batch searches rank only date-eligible rows', async t => {
  const brain = await fixture(t, { embedder: async texts => texts.map(text => text === 'Noted.' ? [0, 1] : [1, 0]) })
  await seed(brain)
  const options = { phrase: 'key', phrases: ['key'], limit: 1,
    after: '2025-01-03T00:00:00.000Z', before: '2025-01-03T00:00:00.000Z' }
  const single = await brain.exploreSemantic(scope, options)
  const [batch] = await brain.exploreSemanticBatch(scope, options)
  for (const rows of [single, batch]) {
    assert.equal(rows.length, 1)
    assert.equal(rows[0].observedAt, options.after)
  }
})

test('hybrid search passes dates into semantic candidate selection', async t => {
  const brain = await fixture(t, { embedder: async texts => texts.map(text => text === 'Noted.' ? [0, 1] : [1, 0]) })
  for (let i = 1; i <= 23; i++) await ingestChatTurn(brain, {
    ...scope, retention: 'durable', sourceMessageId: `hybrid:${i}`,
    eventAt: `2025-01-${String(i).padStart(2, '0')}T00:00:00.000Z`,
    userMessage: 'The spare key is in the blue pot.', assistantMessage: 'Noted.',
  }, { reducer: ({ request }) => ({ actions: [], baseRevision: request.input.baseRevision,
    dispositions: request.input.evidence.map(item => ({ evidenceId: item.id, outcome: 'no_memory' })) }), reducerId: 'math-test/v1' })
  let called = false
  await answerWithRetrieval(brain, { ...scope, question: 'How can I enter?',
    provider: async ({ retrieve }) => {
      called = true
      const result = await retrieve({ tool: 'memory_search', input: {
        phrase: 'unlock entrance', limit: 1, after: '2025-01-23T00:00:00.000Z',
      } })
      assert.equal(result.matches.length, 1)
      assert.equal(result.matches[0].observedAt, '2025-01-23T00:00:00.000Z')
      return { text: 'The key is in the blue pot.' }
    } })
  assert.equal(called, true)
})

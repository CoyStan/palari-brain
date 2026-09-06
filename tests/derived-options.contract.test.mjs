import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createPalariBrain, ingestChatTurn, recallDigest } from '../src/memory-kernel.mjs'
import { answerWithSingleSearch } from '../src/answer-strategies.mjs'
const scope = { palariId: 'p', userId: 'u' }
async function fixture(t, options = {}) {
  const root = await mkdtemp(join(tmpdir(), 'palari-derived-'))
  const brain = await createPalariBrain({ memoryEnabled: true, statePath: join(root, 'brain.json'), workspaceId: 'w', ...options })
  t.after(async () => { brain.close(); await rm(root, { recursive: true, force: true }) })
  return brain
}
const turn = { ...scope, userMessage: 'My bicycle is blue.', assistantMessage: 'Noted.', retention: 'durable', eventAt: '2025-01-01T00:00:00Z', sourceMessageId: 'one' }
const abstain = () => ({ abstained: true, text: 'Insufficient evidence.', bases: [] })
test('journal mode rejects reducer calls before writing and remains searchable', async (t) => {
  const brain = await fixture(t, { digestMode: 'off' })
  await assert.rejects(ingestChatTurn(brain, turn, { reducer: () => { throw Error('must not call') } }), /digestMode/)
  assert.equal(brain.listEvidence(scope).length, 0)
  await ingestChatTurn(brain, turn)
  assert.equal(brain.listEvidence(scope).length, 2)
  assert.equal(recallDigest(brain, scope).status, 'disabled')
  const result = await answerWithSingleSearch(brain, { ...scope, question: 'bicycle', provider: abstain })
  assert.equal(result.providerCalled, true)
})
test('baseline never requests a complete canonical briefing or configured reranker', async (t) => {
  const brain = await fixture(t, { reranker: () => { throw Error('reranker must be opt in') } })
  await ingestChatTurn(brain, turn)
  const restricted = { ...brain, listStatementsForBriefing() { throw Error('full journal forbidden') } }
  const result = await answerWithSingleSearch(restricted, { ...scope, question: 'bicycle', provider: abstain })
  assert.equal(result.retrievalCapabilities.reranking, false)
  assert.equal(result.retrievalTranscript[0].result.reranked, false)
})
test('digest-only briefing exposes freshness without substituting a stale summary', async (t) => {
  const brain = await fixture(t)
  await ingestChatTurn(brain, turn, { reducerId: 'empty/v1', reducer: ({ request }) => ({ actions: [], baseRevision: request.input.baseRevision, dispositions: request.input.evidence.map((row) => ({ evidenceId: row.id, outcome: 'no_memory' })) }) })
  assert.equal(recallDigest(brain, scope).status, 'empty')
  await ingestChatTurn(brain, { ...turn, sourceMessageId: 'two', userMessage: 'The bicycle is now green.' })
  const briefing = recallDigest(brain, scope)
  assert.equal(briefing.status, 'digest_incomplete')
  assert.equal(briefing.text, '')
  assert.ok(briefing.reductionPending > 0)
})
test('invalid derived configuration fails explicitly', async () => {
  await assert.rejects(createPalariBrain({ digestMode: 'magic' }), /digestMode/)
  await assert.rejects(createPalariBrain({ semanticAcceleration: 'magic' }), /semanticAcceleration/)
})

test('simple profile asks for exact semantic retrieval and rejects graph lookup', async (t) => {
  const brain = await fixture(t, { embedder: async (texts) => texts.map(() => [1, 0]), embeddingId: 'diagnostic/v1', semanticAcceleration: 'exact' })
  await ingestChatTurn(brain, turn)
  let exact = false
  const instrumented = { ...brain, exploreSemantic(scope, input) { exact = input.exact; return brain.exploreSemantic(scope, input) } }
  await answerWithSingleSearch(instrumented, { ...scope, question: 'bicycle', provider: abstain })
  assert.equal(exact, true)
  const { answerWithRetrieval } = await import('../src/retrieval-answer.mjs')
  await assert.rejects(answerWithRetrieval(brain, { ...scope, question: 'bicycle', retrievalProfile: 'simple', provider: async ({ retrieve }) => retrieve({ tool: 'memory_graph', input: { entity: 'bicycle' } }) }), /Graph retrieval is disabled/)
})

test('paired scripted journeys retain corrections and forgetting in both digest modes', async () => {
  const { runSimplificationDiagnostic } = await import('../evals/simplification-diagnostic.mjs')
  const result = await runSimplificationDiagnostic()
  assert.equal(result.qualityBenchmark, false)
  assert.equal(result.paidProviderCalls, 0)
  assert.equal(result.results.length, 12)
  assert.ok(result.results.every((row) => row.passed))
})

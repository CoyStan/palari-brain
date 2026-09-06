// Deterministic plumbing comparison, not a model-quality benchmark.
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { createPalariBrain, ingestChatTurn, forgetMemories } from '../src/memory-kernel.mjs'
import { answerWithSingleSearch } from '../src/answer-strategies.mjs'
import { answerWithRetrieval } from '../src/retrieval-answer.mjs'

const scope = { palariId: 'diagnostic', userId: 'owner' }
function reduceBicycle({ request }) {
  const { baseRevision, evidence, prior } = request.input
  const user = evidence.find((row) => row.speaker === 'user')
  const previous = prior.find((row) => row.speaker === 'user')
  return {
    baseRevision,
    actions: [{
      basis: [{ id: user.id, kind: 'evidence', quote: user.text },
        ...(previous ? [{ id: previous.id, kind: 'memory', quote: '' }] : [])],
      epistemic: 'asserted', op: previous ? 'replace' : 'add',
      relation: previous ? 'supersedes' : null, statement: user.text,
      targetIds: previous ? [previous.id] : [], timeBasis: null, topic: 'bicycle',
    }],
    dispositions: evidence.map((row) => ({ evidenceId: row.id, outcome: row.id === user.id ? 'used' : 'no_memory' })),
  }
}
function proposalFrom(rows) {
  const latest = rows.filter((row) => row.speaker === 'user').sort((a, b) => b.order - a.order)[0]
  return latest
    ? { abstained: false, text: latest.text, bases: [{ evidenceId: latest.evidenceId, quote: latest.text }] }
    : { abstained: true, text: 'No stored evidence.', bases: [] }
}
export async function runSimplificationDiagnostic() {
  const root = await mkdtemp(join(tmpdir(), 'palari-simplification-'))
  const results = []
  try {
    for (const digestMode of ['off', 'optional']) {
      const brain = await createPalariBrain({ memoryEnabled: true, statePath: join(root, digestMode, 'brain.json'), workspaceId: digestMode, digestMode, semanticAcceleration: 'exact' })
      let reducerCalls = 0
      const writer = digestMode === 'off' ? {} : { reducerId: 'bicycle-diagnostic/v1', reducer: (input) => { reducerCalls += 1; return reduceBicycle(input) } }
      try {
        for (const [index, stage] of ['remember', 'correct', 'forget'].entries()) {
          const expected = index === 0 ? 'My bicycle is blue.' : 'My bicycle is now green.'
          if (stage === 'forget') {
            forgetMemories(brain, brain.listEvidence(scope).map((row) => row.id), scope)
          } else {
            await ingestChatTurn(brain, { ...scope, userMessage: expected, assistantMessage: 'Noted.', retention: 'durable', eventAt: `2025-01-0${index + 1}T00:00:00Z`, sourceMessageId: stage }, writer)
          }
          for (const strategy of ['single_search', 'iterative']) {
            let answerCalls = 0
            let contextChars = 0
            const start = performance.now()
            const provider = strategy === 'single_search'
              ? ({ evidence, memoryText }) => { answerCalls += 1; contextChars += memoryText.length + JSON.stringify(evidence).length; return proposalFrom(evidence) }
              : async ({ retrieve, commitAnswer, memoryText }) => {
                  answerCalls += 1
                  const found = await retrieve({ tool: 'memory_search', input: { phrase: 'bicycle' } })
                  contextChars += memoryText.length + JSON.stringify(found.matches).length
                  if (!found.matches.length) return { abstained: true, text: 'No stored evidence.' }
                  return commitAnswer(proposalFrom(found.matches))
                }
            provider.requiresEvidenceCommitment = true
            const answer = await (strategy === 'single_search' ? answerWithSingleSearch : answerWithRetrieval)(brain, { ...scope, question: 'bicycle', provider, ...(strategy === 'iterative' ? { iterativeRetrieval: true } : {}) })
            const passed = stage === 'forget' ? answer.abstained === true && answer.answerEvidence.length === 0 : answer.answer === expected && answer.answerCommitted
            assert.equal(passed, true, `${digestMode}/${strategy}/${stage}`)
            results.push({ digestMode, strategy, stage, passed, answerCalls, contextChars, retrievalCalls: answer.retrievalCalls, reducerCalls, latencyMs: performance.now() - start })
          }
        }
      } finally { brain.close() }
    }
    return { diagnostic: 'simplification/v1', qualityBenchmark: false, paidProviderCalls: 0, note: 'Scripted answers verify plumbing only. Compare real providers on unseen histories under a separately approved dollar cap before changing defaults.', results }
  } finally { await rm(root, { recursive: true, force: true }) }
}

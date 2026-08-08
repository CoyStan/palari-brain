import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  MEMORY_RETRIEVAL_FRONTIER_SCHEMA,
  MEMORY_RETRIEVAL_FRONTIER_STAGNANT_ROUNDS,
  answerWithRetrieval,
  createPalariBrain,
  ingestChatTurn,
} from '../src/index.mjs'

const SCOPE = Object.freeze({
  palariId: 'palari-frontier',
  userId: 'user-frontier',
})

function requireEvidenceCommitment(provider) {
  Object.defineProperty(provider, 'requiresEvidenceCommitment', {
    value: true,
  })
  return provider
}

function keepNothing({ request }) {
  return {
    actions: [],
    baseRevision: request.input.baseRevision,
    dispositions: request.input.evidence.map((item) => ({
      evidenceId: item.id,
      outcome: 'no_memory',
    })),
  }
}

async function openBrain(t) {
  const root = await mkdtemp(join(tmpdir(), 'palari-retrieval-frontier-'))
  const brain = await createPalariBrain({
    memoryEnabled: true,
    statePath: join(root, 'state.json'),
    workspaceId: 'retrieval-frontier',
  })
  t.after(async () => {
    brain.close()
    await rm(root, { force: true, recursive: true })
  })
  return brain
}

async function seed(brain, text) {
  await ingestChatTurn(brain, {
    ...SCOPE,
    assistantMessage: 'Noted.',
    eventAt: '2025-01-01T00:00:00.000Z',
    retention: 'durable',
    sourceMessageId: 'frontier-seed:0',
    userMessage: text,
  }, {
    reducer: keepNothing,
    reducerId: 'retrieval-frontier-test/v1',
  })
}

test('ephemeral frontier tracks normalized attempts, novelty, anchors, and selection',
  async (t) => {
    const brain = await openBrain(t)
    const canonical =
      'My workshop apron is stored in the cedar cabinet by the window.'
    await seed(brain, canonical)

    let runtimeFrontier
    const provider = requireEvidenceCommitment(async ({
      commitAnswer,
      markRetrievalAnchors,
      retrievalFrontier,
      retrieve,
    }) => {
      const initial = retrievalFrontier()
      assert.equal(initial.schema, MEMORY_RETRIEVAL_FRONTIER_SCHEMA)
      assert.equal(initial.ephemeral, true)
      assert.equal(initial.durableWrites, 0)
      assert.equal(initial.status, 'open')
      assert.equal(initial.roundCount, 0)
      assert.ok(Object.isFrozen(initial))

      const first = await retrieve({
        input: { phrase: 'WORKSHOP APRON' },
        tool: 'memory_find',
      })
      const row = first.matches.find((entry) => entry.speaker === 'user')
      assert.ok(row)
      assert.deepEqual(markRetrievalAnchors([row.evidenceId]), [row.evidenceId])

      await retrieve({
        input: { phrase: 'workshop apron' },
        tool: 'memory_find',
      })
      runtimeFrontier = retrievalFrontier()
      assert.equal(runtimeFrontier.roundCount, 2)
      assert.equal(runtimeFrontier.attemptedQueryKeys.length, 1)
      assert.equal(runtimeFrontier.repeatedQueryAttempts, 1)
      assert.deepEqual(runtimeFrontier.seenEvidenceIds, [row.evidenceId])
      assert.deepEqual(runtimeFrontier.anchorEvidenceIds, [row.evidenceId])
      assert.equal(runtimeFrontier.rounds[0].newEvidenceCount, 1)
      assert.equal(runtimeFrontier.rounds[1].newEvidenceCount, 0)
      assert.equal(runtimeFrontier.rounds[1].repeatedEvidenceCount, 1)

      return commitAnswer({
        abstained: false,
        bases: [{
          evidenceId: row.evidenceId,
          quote: 'cedar cabinet by the window',
        }],
        text: 'Your workshop apron is in the cedar cabinet by the window.',
      })
    })

    const result = await answerWithRetrieval(brain, {
      ...SCOPE,
      provider,
      question: 'Where is my workshop apron?',
    })

    assert.equal(runtimeFrontier.status, 'open')
    assert.equal(result.retrievalFrontier.status, 'closed')
    assert.deepEqual(
      result.retrievalFrontier.selectedEvidenceIds,
      result.selectedEvidenceIds,
    )
    assert.deepEqual(result.retrievalFrontier.unseenSelectedEvidenceIds, [])
    assert.equal(result.retrievalFrontier.durableWrites, 0)
    assert.ok(Object.isFrozen(result.retrievalFrontier))
    assert.ok(Object.isFrozen(result.retrievalFrontier.rounds))
    assert.ok(Object.isFrozen(result.retrievalFrontier.rounds[0]))
  })

test('frontier reports stagnation after bounded rounds with no new raw evidence',
  async (t) => {
    const brain = await openBrain(t)
    await seed(brain, 'A retained statement unrelated to the probes.')

    const result = await answerWithRetrieval(brain, {
      ...SCOPE,
      async provider({ retrievalFrontier, retrieve }) {
        for (let index = 0;
          index < MEMORY_RETRIEVAL_FRONTIER_STAGNANT_ROUNDS;
          index += 1) {
          await retrieve({
            input: { phrase: `absent-probe-${index}` },
            tool: 'memory_find',
          })
        }
        const frontier = retrievalFrontier()
        assert.equal(frontier.stagnant, true)
        assert.equal(frontier.status, 'stagnant')
        return { abstained: true, text: 'Stored evidence is insufficient.' }
      },
      question: 'What did I say about the absent topic?',
    })

    assert.equal(result.retrievalFrontier.stagnant, true)
    assert.equal(result.retrievalFrontier.status, 'stagnant')
    assert.equal(
      result.retrievalFrontier.consecutiveNoNewEvidenceRounds,
      MEMORY_RETRIEVAL_FRONTIER_STAGNANT_ROUNDS,
    )
    assert.deepEqual(result.retrievalFrontier.seenEvidenceIds, [])
    assert.equal(result.retrievalFrontier.durableWrites, 0)
  })

test('frontier records budget refusals but excludes planning from search rounds',
  async (t) => {
    const brain = await openBrain(t)
    await seed(brain, 'The retained phrase is available.')

    const result = await answerWithRetrieval(brain, {
      ...SCOPE,
      maxRetrievalCalls: 1,
      async provider({ retrievalFrontier, retrieve }) {
        await retrieve({
          input: {
            anchor_event: 'the retained statement',
            category: 'statement',
            relation: 'current',
            time_range: { after: null, before: null },
          },
          tool: 'memory_plan',
        })
        await retrieve({
          input: { phrase: 'retained phrase' },
          tool: 'memory_find',
        })
        const refused = await retrieve({
          input: { phrase: 'another phrase' },
          tool: 'memory_find',
        })
        assert.equal(refused.reason, 'retrieval_budget_exhausted')
        const frontier = retrievalFrontier()
        assert.equal(frontier.roundCount, 1)
        assert.equal(frontier.budgetRefusals, 1)
        assert.equal(frontier.remainingRetrievalCalls, 0)
        assert.equal(frontier.status, 'budget_exhausted')
        return { text: 'Stopped at the retrieval boundary.' }
      },
      question: 'What phrase is retained?',
    })

    assert.equal(result.retrievalPlanningCalls, 1)
    assert.equal(result.retrievalCalls, 1)
    assert.equal(result.retrievalFrontier.roundCount, 1)
    assert.equal(result.retrievalFrontier.budgetRefusals, 1)
    assert.equal(result.retrievalFrontier.exhausted, true)
    assert.equal(
      result.retrievalFrontier.exhaustionReason,
      'retrieval_budget_exhausted',
    )
  })

test('frontier rejects anchors that were not returned as canonical evidence',
  async (t) => {
    const brain = await openBrain(t)
    await assert.rejects(
      answerWithRetrieval(brain, {
        ...SCOPE,
        async provider({ markRetrievalAnchors }) {
          markRetrievalAnchors(['forged-evidence-id'])
          return { text: 'unreachable' }
        },
        question: 'Anything?',
      }),
      (error) => {
        assert.equal(
          error.code,
          'MEMORY_RETRIEVAL_FRONTIER_ANCHOR_INVALID',
        )
        return true
      },
    )
  })

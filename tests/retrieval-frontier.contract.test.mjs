import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  MEMORY_BRIDGE_INSTRUCTIONS,
  MEMORY_BRIDGE_LIMITS,
  MEMORY_BRIDGE_RERANK_MAX_QUERY_CHARS,
  MEMORY_ITERATIVE_RETRIEVAL_TOOLS,
  MEMORY_RETRIEVAL_FRONTIER_SCHEMA,
  MEMORY_RETRIEVAL_FRONTIER_STAGNANT_ROUNDS,
  answerWithRetrieval,
  createPalariBrain,
  ingestChatTurn,
} from '../src/index.mjs'

test('iterative routing makes bridge the next call after a raw anchor', () => {
  assert.match(
    MEMORY_BRIDGE_INSTRUCTIONS,
    /next retrieval call must be memory_bridge/,
  )
  assert.match(
    MEMORY_BRIDGE_INSTRUCTIONS,
    /overrides the general memory_search instruction/,
  )
  assert.match(
    MEMORY_BRIDGE_INSTRUCTIONS,
    /Do not issue another memory_search while a plausible returned anchor remains unexplored/,
  )
  assert.match(
    MEMORY_BRIDGE_INSTRUCTIONS,
    /Resume ordinary search only if no plausible raw anchor was returned or memory_bridge reports stagnation/,
  )
})

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

async function openBrain(t, options = {}) {
  const root = await mkdtemp(join(tmpdir(), 'palari-retrieval-frontier-'))
  const brain = await createPalariBrain({
    memoryEnabled: true,
    statePath: join(root, 'state.json'),
    workspaceId: 'retrieval-frontier',
    ...options,
  })
  t.after(async () => {
    brain.close()
    await rm(root, { force: true, recursive: true })
  })
  return brain
}

async function seed(brain, text, {
  eventAt = '2025-01-01T00:00:00.000Z',
  sourceMessageId = 'frontier-seed:0',
} = {}) {
  await ingestChatTurn(brain, {
    ...SCOPE,
    assistantMessage: 'Noted.',
    eventAt,
    retention: 'durable',
    sourceMessageId,
    userMessage: text,
  }, {
    reducer: keepNothing,
    reducerId: 'retrieval-frontier-test/v1',
  })
}

test('memory_bridge batches generated semantic probes and returns raw evidence',
  async (t) => {
    const embedCalls = []
    const rerankCalls = []
    const concepts = [
      ['air fryer', 'later appliance anchor'],
      [
        'instant pot',
        'countertop cooking device',
        'earlier kitchen appliance',
        'weeknight dinners',
      ],
      ['unrelated', 'garden'],
    ]
    const embedder = async (texts) => {
      embedCalls.push([...texts])
      return texts.map((text) => {
        const lowered = String(text).toLowerCase()
        return concepts.map((bucket) => bucket.reduce(
          (score, token) => score + (lowered.includes(token) ? 1 : 0),
          0,
        ))
      })
    }
    const reranker = async (query, texts) => {
      rerankCalls.push({ query, texts: [...texts] })
      return texts.map((text) => text.includes('Instant Pot') ? 10 : 0)
    }
    const brain = await openBrain(t, { embedder, reranker })
    await seed(brain, 'I bought an Instant Pot for weeknight dinners.', {
      eventAt: '2025-01-01T00:00:00.000Z',
      sourceMessageId: 'kitchen-earlier:0',
    })
    await seed(brain, 'I bought an Air Fryer yesterday.', {
      eventAt: '2025-02-01T00:00:00.000Z',
      sourceMessageId: 'kitchen-anchor:0',
    })

    const probes = [
      'countertop cooking device acquired earlier',
      'earlier kitchen appliance used for meals',
    ]
    let anchorEvidenceId
    const provider = requireEvidenceCommitment(async ({
      answerInstructions,
      commitAnswer,
      retrievalTools,
      retrieve,
    }) => {
      assert.match(answerInstructions, /memory_bridge/)
      assert.equal(retrievalTools, MEMORY_ITERATIVE_RETRIEVAL_TOOLS)
      const anchorResult = await retrieve({
        input: { phrase: 'Air Fryer' },
        tool: 'memory_find',
      })
      const anchor = anchorResult.matches.find((row) =>
        row.speaker === 'user')
      anchorEvidenceId = anchor.evidenceId
      const bridged = await retrieve({
        input: {
          anchorEvidenceIds: [anchor.evidenceId],
          limit: 6,
          probes,
        },
        tool: 'memory_bridge',
      })
      assert.equal(bridged.operation, 'memory_bridge')
      assert.equal(bridged.probeCount, 2)
      assert.deepEqual(bridged.probes, probes)
      assert.deepEqual(bridged.anchorEvidenceIds, [anchor.evidenceId])
      assert.deepEqual(bridged.rerankConditioning, {
        anchorEvidenceIds: [anchor.evidenceId],
        applied: true,
        mode: 'question_anchor_probe',
        queryChars: rerankCalls[0].query.length,
      })
      assert.equal(bridged.semanticProbeQueries.length, 2)
      assert.equal(bridged.retrievalFrontier.roundCount, 2)
      assert.deepEqual(
        bridged.retrievalFrontier.anchorEvidenceIds,
        [anchor.evidenceId],
      )
      const earlier = bridged.matches.find((row) =>
        row.speaker === 'user' && row.text.includes('Instant Pot'))
      assert.ok(earlier)
      assert.equal(earlier.rank, 1)
      return commitAnswer({
        abstained: false,
        bases: [{
          evidenceId: earlier.evidenceId,
          quote: 'Instant Pot for weeknight dinners',
        }],
        text: 'You bought an Instant Pot before the Air Fryer.',
      })
    })

    const result = await answerWithRetrieval(brain, {
      ...SCOPE,
      iterativeRetrieval: true,
      provider,
      question: 'What kitchen device did I get before the Air Fryer?',
    })

    assert.equal(result.retrievalCalls, 2)
    assert.deepEqual(embedCalls.at(-1), probes)
    assert.equal(rerankCalls.length, 1)
    assert.match(rerankCalls[0].query, /What kitchen device did I get before/)
    assert.match(rerankCalls[0].query, /countertop cooking device acquired earlier/)
    assert.match(rerankCalls[0].query, /I bought an Air Fryer yesterday\./)
    assert.doesNotMatch(rerankCalls[0].query, /Instant Pot/)
    assert.ok(
      rerankCalls[0].query.length <=
        MEMORY_BRIDGE_RERANK_MAX_QUERY_CHARS,
    )
    assert.equal(result.retrievalFrontier.roundCount, 2)
    assert.equal(result.retrievalFrontier.durableWrites, 0)
    assert.equal(result.selectedEvidenceIds.length, 1)
    assert.notEqual(result.selectedEvidenceIds[0], anchorEvidenceId)
    assert.match(result.answerEvidence[0].quote, /Instant Pot/)
    assert.doesNotMatch(result.answerEvidence[0].quote, /Air Fryer/)
    assert.equal(result.answer, 'You bought an Instant Pot before the Air Fryer.')
  })

test('memory_bridge bounds rerank context while representing every raw anchor',
  async (t) => {
    const rerankQueries = []
    const brain = await openBrain(t, {
      async reranker(query, texts) {
        rerankQueries.push(query)
        return texts.map(() => 0)
      },
    })
    for (let index = 1; index <= MEMORY_BRIDGE_LIMITS.maxAnchors; index += 1) {
      await seed(
        brain,
        `A${index}-HEAD routing-anchor-shared ${'x'.repeat(500)} A${index}-TAIL`,
        {
          eventAt: `2025-01-0${index}T00:00:00.000Z`,
          sourceMessageId: `bounded-anchor:${index}`,
        },
      )
    }
    const question = `Q-HEAD ${'q'.repeat(700)} Q-TAIL`
    const primaryProbe =
      `routing-anchor-shared P-HEAD ${'p'.repeat(240)} P-TAIL`

    await answerWithRetrieval(brain, {
      ...SCOPE,
      iterativeRetrieval: true,
      async provider({ retrieve }) {
        const found = await retrieve({
          input: { phrase: 'routing-anchor-shared' },
          tool: 'memory_find',
        })
        const anchors = found.matches
          .filter((row) => row.speaker === 'user')
          .slice(0, MEMORY_BRIDGE_LIMITS.maxAnchors)
        assert.equal(anchors.length, MEMORY_BRIDGE_LIMITS.maxAnchors)
        const bridged = await retrieve({
          input: {
            anchorEvidenceIds: anchors.map((row) => row.evidenceId),
            probes: [primaryProbe, 'routing anchor relation'],
          },
          tool: 'memory_bridge',
        })
        assert.equal(bridged.rerankConditioning.applied, true)
        assert.equal(
          bridged.rerankConditioning.queryChars,
          MEMORY_BRIDGE_RERANK_MAX_QUERY_CHARS,
        )
        assert.equal(Object.hasOwn(bridged, 'rerankQuery'), false)
        return { text: 'Routing context remained bounded.' }
      },
      question,
    })

    assert.equal(rerankQueries.length, 1)
    const query = rerankQueries[0]
    assert.equal(query.length, MEMORY_BRIDGE_RERANK_MAX_QUERY_CHARS)
    assert.match(query, /Q-HEAD/)
    assert.match(query, /Q-TAIL/)
    assert.match(query, /P-HEAD/)
    assert.match(query, /P-TAIL/)
    for (let index = 1; index <= MEMORY_BRIDGE_LIMITS.maxAnchors; index += 1) {
      assert.match(query, new RegExp(`Returned anchor ${index}:`))
      assert.match(query, new RegExp(`A${index}-HEAD`))
    }
  })

test('memory_bridge is bounded and rejects unknown anchors and duplicate probes',
  async (t) => {
    const bridge = MEMORY_ITERATIVE_RETRIEVAL_TOOLS.find((tool) =>
      tool.name === 'memory_bridge')
    assert.ok(bridge)
    assert.deepEqual(bridge.parameters.required, [
      'anchorEvidenceIds',
      'probes',
    ])
    assert.equal(
      bridge.parameters.properties.probes.minItems,
      MEMORY_BRIDGE_LIMITS.minProbes,
    )
    assert.equal(
      bridge.parameters.properties.probes.maxItems,
      MEMORY_BRIDGE_LIMITS.maxProbes,
    )

    const brain = await openBrain(t)
    await seed(brain, 'I bought an Air Fryer yesterday.')
    await assert.rejects(
      answerWithRetrieval(brain, {
        ...SCOPE,
        async provider({ retrieve }) {
          await retrieve({
            input: {
              anchorEvidenceIds: ['irrelevant'],
              probes: ['earlier appliance', 'previous kitchen device'],
            },
            tool: 'memory_bridge',
          })
          return { text: 'unreachable' }
        },
        question: 'What came before it?',
      }),
      /Unknown memory tool: memory_bridge/,
    )
    await assert.rejects(
      answerWithRetrieval(brain, {
        ...SCOPE,
        iterativeRetrieval: true,
        async provider({ retrieve }) {
          await retrieve({
            input: {
              anchorEvidenceIds: ['not-returned'],
              probes: ['earlier appliance', 'previous kitchen device'],
            },
            tool: 'memory_bridge',
          })
          return { text: 'unreachable' }
        },
        question: 'What came before it?',
      }),
      (error) => {
        assert.equal(
          error.code,
          'MEMORY_RETRIEVAL_FRONTIER_ANCHOR_INVALID',
        )
        return true
      },
    )

    await assert.rejects(
      answerWithRetrieval(brain, {
        ...SCOPE,
        iterativeRetrieval: true,
        async provider({ retrieve }) {
          const found = await retrieve({
            input: { phrase: 'Air Fryer' },
            tool: 'memory_find',
          })
          await retrieve({
            input: {
              anchorEvidenceIds: [found.matches[0].evidenceId],
              probes: ['Earlier appliance', '  earlier   appliance  '],
            },
            tool: 'memory_bridge',
          })
          return { text: 'unreachable' }
        },
        question: 'What came before it?',
      }),
      (error) => {
        assert.equal(error.code, 'MEMORY_BRIDGE_INPUT_INVALID')
        return true
      },
    )
  })

test('memory_bridge exposes stagnation to the model after two no-new rounds',
  async (t) => {
    const brain = await openBrain(t)
    await seed(brain, 'I bought an Air Fryer yesterday.')

    const result = await answerWithRetrieval(brain, {
      ...SCOPE,
      iterativeRetrieval: true,
      async provider({ retrieve }) {
        const found = await retrieve({
          input: { phrase: 'Air Fryer' },
          tool: 'memory_find',
        })
        const anchor = found.matches.find((row) => row.speaker === 'user')
        const first = await retrieve({
          input: {
            anchorEvidenceIds: [anchor.evidenceId],
            probes: ['earlier appliance', 'previous kitchen device'],
          },
          tool: 'memory_bridge',
        })
        assert.equal(first.semanticUsed, false)
        assert.deepEqual(first.rerankConditioning, {
          anchorEvidenceIds: [anchor.evidenceId],
          applied: false,
          mode: 'none',
          queryChars: 0,
        })
        assert.equal(first.retrievalFrontier.stagnant, false)
        const second = await retrieve({
          input: {
            anchorEvidenceIds: [anchor.evidenceId],
            probes: ['prior countertop purchase', 'older cooking equipment'],
          },
          tool: 'memory_bridge',
        })
        assert.equal(second.retrievalFrontier.stagnant, true)
        assert.equal(second.retrievalFrontier.status, 'stagnant')
        return { text: 'No linked raw memory was found.' }
      },
      question: 'What kitchen device did I get before the Air Fryer?',
    })

    assert.equal(result.retrievalCalls, 3)
    assert.equal(result.retrievalFrontier.stagnant, true)
    assert.equal(result.retrievalFrontier.durableWrites, 0)
  })

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

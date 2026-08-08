import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  DEFAULT_RETRIEVAL_CALLS,
  MEMORY_ANSWER_ENUMERATION_INSTRUCTIONS,
  MEMORY_ANSWER_RECOMMENDED_MAX_OUTPUT_TOKENS,
  MEMORY_RETRIEVAL_COMPLETENESS_INSTRUCTIONS,
  MEMORY_EXPLORATION_INSTRUCTIONS,
  MEMORY_RETRIEVAL_INSTRUCTIONS,
  MEMORY_RETRIEVAL_TOOLS,
  answerWithRetrieval,
  createPalariBrain,
  ingestChatTurn,
  memoryAnswerSystemInstruction,
  reciprocalRankFuse,
  resolveMemoryAnswerCompositionMode,
} from '../src/index.mjs'
import { deriveQuestionRelativeTime } from '../src/retrieval-answer.mjs'

const SCOPE = Object.freeze({
  palariId: 'palari-retrieval',
  userId: 'user-retrieval',
})

const CONCEPTS = [
  ['key', 'pot', 'balcony', 'get into', 'flat', 'door', 'unlock'],
  ['battery', 'phone', 'power bank', 'charging', 'charge'],
  ['tokyo', 'suica', 'tripit', 'train', 'transit', 'navigate'],
]

async function fakeEmbed(texts) {
  return texts.map((text) => {
    const lowered = String(text).toLowerCase()
    return CONCEPTS.map((bucket) =>
      bucket.reduce((score, token) =>
        score + (lowered.includes(token) ? 1 : 0), 0))
  })
}

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

async function scriptedGraphExtractor({ evidence }) {
  const assertions = []
  for (const item of evidence) {
    let match = item.text.match(/^My sister is (\w+)\.$/)
    if (match) {
      assertions.push({
        evidenceRef: item.ref,
        object: match[1],
        predicate: 'is sister of',
        quote: match[0],
        subject: 'user',
      })
    }
    match = item.text.match(/^(\w+)'s doctor is Dr\. (\w+)\.$/)
    if (match) {
      assertions.push({
        evidenceRef: item.ref,
        object: `Dr. ${match[2]}`,
        predicate: 'has doctor',
        quote: match[0],
        subject: match[1],
      })
    }
    match = item.text.match(/^Dr\. (\w+) works at the (.+)\.$/)
    if (match) {
      assertions.push({
        evidenceRef: item.ref,
        object: match[2],
        predicate: 'works at',
        quote: match[0],
        subject: `Dr. ${match[1]}`,
      })
    }
  }
  return { assertions }
}

async function openBrain(t, options = {}) {
  const root = await mkdtemp(join(tmpdir(), 'palari-retrieval-answer-'))
  const brain = await createPalariBrain({
    memoryEnabled: true,
    statePath: join(root, 'state.json'),
    workspaceId: 'retrieval-answer',
    ...options,
  })
  t.after(async () => {
    brain.close()
    await rm(root, { force: true, recursive: true })
  })
  return brain
}

async function seed(brain, messages, {
  reducer = keepNothing,
  scope = SCOPE,
} = {}) {
  for (const [index, message] of messages.entries()) {
    await ingestChatTurn(brain, {
      assistantMessage: message.assistant ?? 'Noted.',
      eventAt: new Date(Date.UTC(2025, 0, 1) + index * 86_400_000)
        .toISOString(),
      palariId: scope.palariId,
      retention: 'durable',
      sourceMessageId: message.id ?? `session-${index}:0`,
      userId: scope.userId,
      userMessage: message.user,
    }, {
      reducer,
      reducerId: reducer ? 'retrieval-answer-test/v1' : undefined,
    })
  }
}

test('hybrid answer retrieval bridges zero-overlap wording to canonical text',
  async (t) => {
    const brain = await openBrain(t, { embedder: fakeEmbed })
    await seed(brain, [
      { user: 'Please add oat milk to the shopping list.' },
      {
        id: 'home-access:0',
        user:
          'I keep the spare key inside the blue ceramic pot on the balcony.',
      },
      { user: 'My next dentist appointment is Thursday.' },
    ])

    let returned
    const result = await answerWithRetrieval(brain, {
      ...SCOPE,
      async provider({
        briefing,
        retrievalCapabilities,
        retrievalTools,
        retrieve,
      }) {
        assert.equal(briefing.included.length, 0)
        assert.equal(retrievalCapabilities.semantic, true)
        assert.ok(retrievalTools.some((tool) =>
          tool.name === 'memory_search'))
        returned = await retrieve({
          input: { phrase: 'how do I get into my flat' },
          tool: 'memory_search',
        })
        assert.equal(returned.semanticUsed, true)
        assert.equal(
          returned.matches[0].text,
          'I keep the spare key inside the blue ceramic pot on the balcony.',
        )
        assert.ok(returned.matches[0].surfaces.includes('semantic'))
        return {
          abstained: false,
          text: 'Your spare key is in the blue ceramic pot on the balcony.',
        }
      },
      question: 'How do I get into my flat?',
    })

    assert.equal(
      result.answer,
      'Your spare key is in the blue ceramic pot on the balcony.',
    )
    assert.equal(result.retrievalCalls, 1)
    assert.equal(result.retrievalExhausted, false)
    assert.deepEqual(
      result.consultedEvidenceIds,
      returned.matches.map((row) => row.evidenceId),
    )
    assert.equal(
      result.retrievalTranscript[0].result.matches[0].text,
      returned.matches[0].text,
    )
  })

test('host commits exact returned evidence and exposes immutable basis telemetry',
  async (t) => {
    const brain = await openBrain(t)
    const canonical =
      'My workshop apron is stored in the cedar cabinet by the window.'
    await seed(brain, [{ id: 'apron:0', user: canonical }])
    let committed
    const provider = requireEvidenceCommitment(async ({
      answerEvidenceCount,
      commitAnswer,
      retrieve,
    }) => {
      const found = await retrieve({
        input: { phrase: 'workshop apron' },
        tool: 'memory_find',
      })
      assert.equal(answerEvidenceCount(), found.matches.length)
      assert.ok(Object.isFrozen(found))
      assert.ok(Object.isFrozen(found.matches[0]))
      const [row] = found.matches
      committed = commitAnswer({
        abstained: false,
        bases: [{
          evidenceId: row.evidenceId,
          quote: 'cedar cabinet by the window',
        }],
        text: 'Your workshop apron is in the cedar cabinet by the window.',
      })
      assert.ok(Object.isFrozen(committed))
      assert.ok(Object.isFrozen(committed.bases))
      return committed
    })

    const result = await answerWithRetrieval(brain, {
      ...SCOPE,
      provider,
      question: 'Where is my workshop apron?',
    })

    assert.equal(result.answerCommitted, true)
    assert.equal(result.answer, committed.text)
    assert.deepEqual(result.answerEvidence, committed.bases)
    assert.ok(Object.isFrozen(result.answerEvidence))
    assert.ok(Object.isFrozen(result.answerEvidence[0]))
    assert.equal(result.retrievalTranscript[0].result.matches[0].snippet,
      canonical)
  })

test('answer commitment rejects forged identity, unsupported provenance, and bad bases',
  async (t) => {
    const brain = await openBrain(t)
    await seed(brain, [{
      id: 'notebook:0',
      user: 'The field notebook is inside the orange canvas satchel.',
    }])

    const invalidProposals = [
      (row) => ({
        abstained: false,
        bases: [{ evidenceId: 'not-returned', quote: row.snippet }],
        text: 'Answer.',
      }),
      (row) => ({
        abstained: false,
        bases: [{ evidenceId: row.evidenceId, quote: 'blue steel locker' }],
        text: 'Answer.',
      }),
      (row) => ({
        abstained: false,
        bases: [
          { evidenceId: row.evidenceId, quote: 'orange canvas satchel' },
          { evidenceId: row.evidenceId, quote: 'field notebook' },
        ],
        text: 'Answer.',
      }),
      (row) => ({
        abstained: false,
        bases: [{
          evidenceId: row.evidenceId,
          origin: 'provider-authored',
          quote: 'orange canvas satchel',
        }],
        text: 'Answer.',
      }),
      (row) => ({
        abstained: 'false',
        bases: [{ evidenceId: row.evidenceId, quote: 'field notebook' }],
        text: 'Answer.',
      }),
      (row) => ({
        abstained: false,
        bases: [{ evidenceId: row.evidenceId, quote: 'field notebook' }],
        text: 'x'.repeat(20_001),
      }),
    ]

    for (const proposal of invalidProposals) {
      const provider = requireEvidenceCommitment(async ({
        commitAnswer,
        retrieve,
      }) => {
        const found = await retrieve({
          input: { phrase: 'field notebook' },
          tool: 'memory_find',
        })
        return commitAnswer(proposal(found.matches[0]))
      })
      await assert.rejects(
        answerWithRetrieval(brain, {
          ...SCOPE,
          provider,
          question: 'Where is the field notebook?',
        }),
        (error) => error.code === 'MEMORY_ANSWER_COMMITMENT_INVALID',
      )
    }

    const forged = requireEvidenceCommitment(async ({
      commitAnswer,
      retrieve,
    }) => {
      const found = await retrieve({
        input: { phrase: 'field notebook' },
        tool: 'memory_find',
      })
      const accepted = commitAnswer({
        abstained: false,
        bases: [{
          evidenceId: found.matches[0].evidenceId,
          quote: 'orange canvas satchel',
        }],
        text: 'It is in the orange canvas satchel.',
      })
      return structuredClone(accepted)
    })
    await assert.rejects(
      answerWithRetrieval(brain, {
        ...SCOPE,
        provider: forged,
        question: 'Where is the field notebook?',
      }),
      (error) => error.code === 'MEMORY_ANSWER_COMMITMENT_INVALID',
    )

    const mutableDeclaration = async ({ retrieve }) => {
      const found = await retrieve({
        input: { phrase: 'field notebook' },
        tool: 'memory_find',
      })
      assert.equal(found.matches.length, 1)
      mutableDeclaration.requiresEvidenceCommitment = false
      return { text: 'Raw prose after weakening the declaration.' }
    }
    mutableDeclaration.requiresEvidenceCommitment = true
    await assert.rejects(
      answerWithRetrieval(brain, {
        ...SCOPE,
        provider: mutableDeclaration,
        question: 'Where is the field notebook?',
      }),
      (error) => error.code === 'MEMORY_ANSWER_COMMITMENT_INVALID',
    )
    assert.equal(mutableDeclaration.requiresEvidenceCommitment, false)

    const maliciousMap = requireEvidenceCommitment(async ({
      commitAnswer,
      retrieve,
    }) => {
      const found = await retrieve({
        input: { phrase: 'field notebook' },
        tool: 'memory_find',
      })
      const bases = [{
        evidenceId: found.matches[0].evidenceId,
        quote: 'orange canvas satchel',
      }]
      bases.map = () => [{
        evidenceId: 'never-returned',
        quote: 'fabricated evidence',
      }]
      return commitAnswer({
        abstained: false,
        bases,
        text: 'Unsupported answer.',
      })
    })
    await assert.rejects(
      answerWithRetrieval(brain, {
        ...SCOPE,
        provider: maliciousMap,
        question: 'Where is the field notebook?',
      }),
      (error) => error.code === 'MEMORY_ANSWER_COMMITMENT_INVALID' &&
        /dense indexed items/.test(error.message),
    )

    let basisReads = 0
    const changingAccessor = requireEvidenceCommitment(async ({
      commitAnswer,
      retrieve,
    }) => {
      const found = await retrieve({
        input: { phrase: 'field notebook' },
        tool: 'memory_find',
      })
      const valid = [{
        evidenceId: found.matches[0].evidenceId,
        quote: 'orange canvas satchel',
      }]
      const proposal = {
        abstained: false,
        text: 'It is in the orange canvas satchel.',
      }
      Object.defineProperty(proposal, 'bases', {
        enumerable: true,
        get() {
          basisReads += 1
          return basisReads === 1 ? valid : []
        },
      })
      return commitAnswer(proposal)
    })
    await assert.rejects(
      answerWithRetrieval(brain, {
        ...SCOPE,
        provider: changingAccessor,
        question: 'Where is the field notebook?',
      }),
      (error) => error.code === 'MEMORY_ANSWER_COMMITMENT_INVALID' &&
        /bases must be a data property/.test(error.message),
    )
    assert.equal(basisReads, 0)

    const hiddenMetadata = requireEvidenceCommitment(async ({
      commitAnswer,
      retrieve,
    }) => {
      const found = await retrieve({
        input: { phrase: 'field notebook' },
        tool: 'memory_find',
      })
      const proposal = {
        abstained: false,
        bases: [{
          evidenceId: found.matches[0].evidenceId,
          quote: 'orange canvas satchel',
        }],
        text: 'It is in the orange canvas satchel.',
      }
      Object.defineProperty(proposal, 'providerOrigin', {
        value: 'hidden provenance',
      })
      return commitAnswer(proposal)
    })
    await assert.rejects(
      answerWithRetrieval(brain, {
        ...SCOPE,
        provider: hiddenMetadata,
        question: 'Where is the field notebook?',
      }),
      (error) => error.code === 'MEMORY_ANSWER_COMMITMENT_INVALID' &&
        /unsupported or missing fields/.test(error.message),
    )

    const poisonedPrototype = requireEvidenceCommitment(async ({
      commitAnswer,
      retrieve,
    }) => {
      const found = await retrieve({
        input: { phrase: 'field notebook' },
        tool: 'memory_find',
      })
      const originalIterator = Set.prototype[Symbol.iterator]
      const originalIncludes = String.prototype.includes
      try {
        Set.prototype[Symbol.iterator] = function * forgedIterator() {
          yield 'fabricated blue vault claim'
        }
        String.prototype.includes = () => true
        return commitAnswer({
          abstained: false,
          bases: [{
            evidenceId: found.matches[0].evidenceId,
            quote: 'fabricated blue vault claim',
          }],
          text: 'Unsupported answer.',
        })
      } finally {
        Set.prototype[Symbol.iterator] = originalIterator
        String.prototype.includes = originalIncludes
      }
    })
    await assert.rejects(
      answerWithRetrieval(brain, {
        ...SCOPE,
        provider: poisonedPrototype,
        question: 'Where is the field notebook?',
      }),
      (error) => error.code === 'MEMORY_ANSWER_COMMITMENT_INVALID' &&
        /quote is not exact contiguous/.test(error.message),
    )
  })

test('required commitment drains outstanding retrieval before accepting raw output',
  async (t) => {
    let releaseReranker
    const rerankerGate = new Promise((resolve) => {
      releaseReranker = resolve
    })
    const brain = await openBrain(t, {
      async reranker(_query, texts) {
        await rerankerGate
        return texts.map(() => 1)
      },
    })
    await seed(brain, [{
      id: 'compass:0',
      user: 'The brass compass is stored in the cedar drawer.',
    }])
    let leakedRetrieval
    const provider = requireEvidenceCommitment(async ({ retrieve }) => {
      leakedRetrieval = retrieve({
        input: { phrase: 'brass compass cedar drawer' },
        tool: 'memory_search',
      })
      setTimeout(releaseReranker, 0)
      return { text: 'Raw answer returned before retrieval settled.' }
    })

    await assert.rejects(
      answerWithRetrieval(brain, {
        ...SCOPE,
        provider,
        question: 'Where is the brass compass?',
      }),
      (error) => error.code === 'MEMORY_ANSWER_COMMITMENT_INVALID',
    )
    const found = await leakedRetrieval
    assert.equal(found.matches.length, 1)
    assert.equal(found.matches[0].text,
      'The brass compass is stored in the cedar drawer.')
  })

test('settled retrieval failures remain terminal even when a provider catches them',
  async (t) => {
    const brain = await openBrain(t)
    for (const retrievalFailure of [
      new Error('canonical retrieval failed'),
      null,
    ]) {
      const failingBrain = Object.create(brain)
      Object.defineProperty(failingBrain, 'exploreFind', {
        value() {
          throw retrievalFailure
        },
      })
      const provider = requireEvidenceCommitment(async ({ retrieve }) => {
        await retrieve({
          input: { phrase: 'settled failure' },
          tool: 'memory_find',
        }).catch(() => {})
        return { text: 'Raw answer after swallowing retrieval failure.' }
      })
      let rejected = false
      try {
        await answerWithRetrieval(failingBrain, {
          ...SCOPE,
          provider,
          question: 'What did memory say?',
        })
      } catch (error) {
        rejected = true
        assert.equal(error, retrievalFailure)
      }
      assert.equal(rejected, true)
    }

    let providerRejected = false
    try {
      await answerWithRetrieval(brain, {
        ...SCOPE,
        async provider() {
          throw null
        },
        question: 'What did memory say?',
      })
    } catch (error) {
      providerRejected = true
      assert.equal(error, null)
    }
    assert.equal(providerRejected, true)
  })

test('committed prose cannot be replaced through a poisoned global String',
  async (t) => {
    const brain = await openBrain(t)
    await seed(brain, [{
      id: 'committed-text:0',
      user: 'The brass compass is stored in the cedar drawer.',
    }])
    const committedText = 'The brass compass is in the cedar drawer.'
    const originalString = globalThis.String
    try {
      const result = await answerWithRetrieval(brain, {
        ...SCOPE,
        provider: requireEvidenceCommitment(async ({
          commitAnswer,
          retrieve,
        }) => {
          const found = await retrieve({
            input: { phrase: 'brass compass' },
            tool: 'memory_find',
          })
          const committed = commitAnswer({
            abstained: false,
            bases: [{
              evidenceId: found.matches[0].evidenceId,
              quote: 'cedar drawer',
            }],
            text: committedText,
          })
          globalThis.String = () => 'FABRICATED AFTER COMMITMENT'
          return committed
        }),
        question: 'Where is the brass compass?',
      })
      assert.equal(result.answerCommitted, true)
      assert.equal(result.answer, committedText)
    } finally {
      globalThis.String = originalString
    }
  })

test('commitment shape checks use captured coercion before private cloning',
  async (t) => {
    const brain = await openBrain(t)
    await seed(brain, [
      { user: 'The brass compass is stored in the cedar drawer.' },
      { user: 'The canvas map is stored in the blue folio.' },
    ])
    const originalString = globalThis.String
    try {
      await assert.rejects(
        answerWithRetrieval(brain, {
          ...SCOPE,
          provider: requireEvidenceCommitment(async ({
            commitAnswer,
            retrieve,
          }) => {
            const found = await retrieve({
              input: { phrase: 'stored' },
              tool: 'memory_find',
            })
            const secondBasis = {
              evidenceId: found.matches[1].evidenceId,
              quote: 'blue folio',
            }
            Object.defineProperty(secondBasis, 'providerOrigin', {
              value: 'hidden provenance',
            })
            globalThis.String = () => '0'
            return commitAnswer({
              abstained: false,
              bases: [{
                evidenceId: found.matches[0].evidenceId,
                quote: 'cedar drawer',
              }, secondBasis],
              text: 'Both objects are stored.',
            })
          }),
          question: 'Where are both stored objects?',
        }),
        (error) => error.code === 'MEMORY_ANSWER_COMMITMENT_INVALID' &&
          /unsupported or missing fields/.test(error.message),
      )
    } finally {
      globalThis.String = originalString
    }
  })

test('optional reranker sees immutable canonical candidates and reorders the bounded pool',
  async (t) => {
    let received
    const reranker = async (query, texts) => {
      assert.equal(query, 'Which material is my travel mug made from?')
      assert.ok(Object.isFrozen(texts))
      received = texts
      return texts.map((text) => text.includes('titanium') ? 10 : 0)
    }
    const brain = await openBrain(t, { reranker })
    await seed(brain, [
      { user: 'The ceramic mug in the office kitchen has a chipped rim.' },
      { user: 'My travel mug is titanium and has a dark green lid.' },
      { user: 'A travel article recommended packing a reusable cup.' },
      { user: 'The glass mug belongs to the upstairs meeting room.' },
    ])

    const result = await answerWithRetrieval(brain, {
      ...SCOPE,
      async provider({ retrievalCapabilities, retrieve }) {
        assert.equal(retrievalCapabilities.reranking, true)
        const found = await retrieve({
          input: {
            limit: 1,
            phrase: 'Which material is my travel mug made from?',
          },
          tool: 'memory_search',
        })
        assert.equal(found.reranked, true)
        assert.ok(found.rerankCandidates > found.matches.length)
        assert.equal(found.matches.length, 1)
        assert.equal(
          found.matches[0].text,
          'My travel mug is titanium and has a dark green lid.',
        )
        assert.equal(found.matches[0].rerankScore, 10)
        assert.equal(found.matches[0].rank, 1)
        assert.ok(found.matches[0].evidenceId)
        assert.ok(found.matches[0].observedAt)
        return { text: 'It is titanium.' }
      },
      question: 'Which material is my travel mug made from?',
    })
    assert.equal(result.answer, 'It is titanium.')
    assert.ok(received.length > 1)
    assert.ok(received.every((text) => typeof text === 'string'))
  })

test('configured reranker failures are terminal and never become partial evidence',
  async (t) => {
    const failures = [
      async () => undefined,
      async () => [],
      async () => [1, 2],
      async () => ['1'],
      async () => [NaN],
      async () => [Infinity],
      async () => { throw new Error('runtime stopped') },
      async (_query, texts) => { texts[0] = 'changed'; return [1] },
    ]
    for (const [index, reranker] of failures.entries()) {
      await t.test(`failure ${index + 1}`, async (subtest) => {
        const brain = await openBrain(subtest, { reranker })
        await seed(brain, [{ user: 'My desk lamp has a brass base.' }])
        await assert.rejects(() => answerWithRetrieval(brain, {
          ...SCOPE,
          async provider({ retrieve }) {
            await retrieve({
              input: { phrase: 'desk lamp base' },
              tool: 'memory_search',
            })
            return { text: 'This line must not be reached.' }
          },
          question: 'What is the lamp base made from?',
        }))
      })
    }
  })

test('invalid reranker configuration fails before creating store state',
  async (t) => {
    const root = await mkdtemp(join(tmpdir(), 'palari-invalid-reranker-'))
    t.after(() => rm(root, { force: true, recursive: true }))
    const statePath = join(root, 'nested', 'state.json')
    await assert.rejects(
      () => createPalariBrain({
        memoryEnabled: true,
        reranker: {},
        statePath,
        workspaceId: 'invalid-reranker',
      }),
      /reranker must be a function/,
    )
    await assert.rejects(() => import('node:fs/promises').then(({ stat }) =>
      stat(join(root, 'nested'))), { code: 'ENOENT' })
  })

test('reciprocal-rank fusion rewards evidence found by both surfaces', () => {
  const fused = reciprocalRankFuse([
    {
      rows: [
        { evidenceId: 'ranked-only' },
        { evidenceId: 'both' },
      ],
      surface: 'ranked',
    },
    {
      rows: [
        { evidenceId: 'both' },
        { evidenceId: 'semantic-only' },
      ],
      surface: 'semantic',
    },
  ])
  assert.equal(fused[0].evidenceId, 'both')
  assert.deepEqual(fused[0].surfaces, ['ranked', 'semantic'])
  assert.deepEqual(fused[0].surfaceRanks, {
    ranked: 2,
    semantic: 1,
  })
})

test('hybrid retrieval falls back honestly to ranked search without embedder',
  async (t) => {
    const brain = await openBrain(t)
    await seed(brain, [{
      user: 'My portable power bank is fully charged for the trip.',
    }])

    const result = await answerWithRetrieval(brain, {
      ...SCOPE,
      async provider({ retrievalCapabilities, retrieve }) {
        assert.equal(retrievalCapabilities.semantic, false)
        const found = await retrieve({
          input: { phrase: 'portable power bank battery' },
          tool: 'memory_search',
        })
        assert.equal(found.semanticUsed, false)
        assert.equal(found.semanticCandidates, 0)
        assert.ok(found.matches[0].text.includes('portable power bank'))
        assert.deepEqual(found.matches[0].surfaces, ['ranked'])
        return { text: 'Keep your existing power bank fully charged.' }
      },
      question: 'Any phone battery tips?',
    })
    assert.equal(result.retrievalCapabilities.semantic, false)
    assert.equal(result.providerCalled, true)
  })

test('the answer loop exposes admitted graph edges without extracting',
  async (t) => {
    const brain = await openBrain(t, {
      graphExtractor: scriptedGraphExtractor,
    })
    await seed(brain, [
      { user: 'My sister is Ana.' },
      { user: "Ana's doctor is Dr. Peixoto." },
      { user: 'Dr. Peixoto works at the Lisbon hospital.' },
    ], { reducer: null })
    await brain.indexGraph(SCOPE)

    const result = await answerWithRetrieval(brain, {
      ...SCOPE,
      provider: requireEvidenceCommitment(async ({ commitAnswer, retrieve }) => {
        const graph = await retrieve({
          input: { entity: 'Ana', hops: 2 },
          tool: 'memory_graph',
        })
        assert.ok(graph.edges.some((edge) =>
          edge.subject === 'Dr. Peixoto' &&
          edge.object === 'Lisbon hospital'))
        assert.ok(graph.edges.every((edge) =>
          edge.quote.length > 0 && edge.evidenceId))
        assert.ok(graph.edges.every((edge) =>
          edge.questionRelativeTime?.relation === 'past' &&
          edge.questionRelativeTime?.wholeCalendarMonths === 0))
        const basis = graph.edges.find((edge) =>
          edge.subject === 'Dr. Peixoto' &&
          edge.object === 'Lisbon hospital')
        return commitAnswer({
          abstained: false,
          bases: [{
            evidenceId: basis.evidenceId,
            quote: basis.quote,
          }],
          text: 'Ana’s doctor works at the Lisbon hospital.',
        })
      }),
      question: 'Which hospital does my sister’s doctor work at?',
      questionDate: '2025-01-10T00:00:00.000Z',
    })

    assert.equal(
      result.answer,
      'Ana’s doctor works at the Lisbon hospital.',
    )
    assert.ok(result.consultedEvidenceIds.length >= 2)
    assert.equal(result.retrievalTranscript[0].tool, 'memory_graph')
    assert.equal(result.answerCommitted, true)
    assert.equal(result.answerEvidence.length, 1)
  })

test('host-computed question-relative time is deterministic and non-mutating',
  async (t) => {
    const cases = [
      {
        observedAt: '2023-11-01T00:46:00.000Z',
        questionDate: '2024-02-01T18:06:00.000Z',
        expected: {
          relation: 'past',
          wholeCalendarMonths: 3,
          wholeDays: 92,
        },
      },
      {
        observedAt: '2024-01-31T00:00:00.000Z',
        questionDate: '2024-02-28T23:00:00.000Z',
        expected: {
          relation: 'past',
          wholeCalendarMonths: 0,
          wholeDays: 28,
        },
      },
      {
        observedAt: '2023-11-30T12:00:00.000Z',
        questionDate: '2024-01-30T12:00:00.000Z',
        expected: {
          relation: 'past',
          wholeCalendarMonths: 2,
          wholeDays: 61,
        },
      },
      {
        observedAt: '2024-02-29T12:00:00.000Z',
        questionDate: '2025-02-28T11:00:00.000Z',
        expected: {
          relation: 'past',
          wholeCalendarMonths: 11,
          wholeDays: 364,
        },
      },
      {
        observedAt: '2025-01-10T12:00:00.000Z',
        questionDate: '2025-01-10T12:00:00.000Z',
        expected: {
          relation: 'same',
          wholeCalendarMonths: 0,
          wholeDays: 0,
        },
      },
      {
        observedAt: '2025-05-02T00:00:00.000Z',
        questionDate: '2025-02-01T00:00:00.000Z',
        expected: {
          relation: 'future',
          wholeCalendarMonths: -3,
          wholeDays: -90,
        },
      },
    ]
    for (const { observedAt, questionDate, expected } of cases) {
      const result = deriveQuestionRelativeTime(observedAt, questionDate)
      assert.deepEqual(
        {
          relation: result.relation,
          wholeCalendarMonths: result.wholeCalendarMonths,
          wholeDays: result.wholeDays,
        },
        expected,
      )
      assert.equal(result.evidenceAt, observedAt)
      assert.equal(result.referenceAt, questionDate)
    }
    assert.equal(deriveQuestionRelativeTime('', cases[0].questionDate), null)
    assert.equal(
      deriveQuestionRelativeTime(cases[0].observedAt, 'not-a-date'),
      null,
    )

    const brain = await openBrain(t)
    const quote = 'The photography workshop happened on November 1.'
    await ingestChatTurn(brain, {
      assistantMessage: 'I can help you remember that workshop.',
      eventAt: '2023-11-01T00:46:00.000Z',
      palariId: SCOPE.palariId,
      retention: 'durable',
      sourceMessageId: 'relative-time:0',
      userId: SCOPE.userId,
      userMessage: quote,
    }, { reducer: keepNothing, reducerId: 'relative-time-test/v1' })
    const expected = {
      evidenceAt: '2023-11-01T00:46:00.000Z',
      referenceAt: '2024-02-01T18:06:00.000Z',
      relation: 'past',
      wholeCalendarMonths: 3,
      wholeDays: 92,
    }
    const raw = {}
    const observedBrain = Object.create(brain)
    Object.defineProperties(observedBrain, {
      exploreFind: {
        value: (...args) => {
          raw.exploreFind = brain.exploreFind(...args)
          return raw.exploreFind
        },
      },
      exploreRead: {
        value: (...args) => {
          raw.exploreRead = brain.exploreRead(...args)
          return raw.exploreRead
        },
      },
    })
    const result = await answerWithRetrieval(observedBrain, {
      ...SCOPE,
      question: 'How long ago was the photography workshop?',
      questionDate: expected.referenceAt,
      provider: requireEvidenceCommitment(async ({ commitAnswer, retrieve }) => {
        const found = await retrieve({
          input: { phrase: 'photography workshop' },
          tool: 'memory_find',
        })
        const id = found.matches[0].evidenceId
        assert.deepEqual(found.matches[0].questionRelativeTime, expected)
        const read = await retrieve({
          input: { evidenceIds: [id] },
          tool: 'memory_read',
        })
        assert.deepEqual(read.messages[0].questionRelativeTime, expected)
        const search = await retrieve({
          input: { phrase: 'photography workshop' },
          tool: 'memory_search',
        })
        assert.deepEqual(search.matches[0].questionRelativeTime, expected)
        return commitAnswer({
          abstained: false,
          bases: [{
            evidenceId: search.matches[0].evidenceId,
            quote: search.matches[0].text,
          }],
          text: 'It was three calendar months ago.',
        })
      }),
    })
    assert.equal(result.answer, 'It was three calendar months ago.')
    assert.equal(result.answerCommitted, true)
    assert.equal(
      Object.hasOwn(raw.exploreFind.matches[0], 'questionRelativeTime'),
      false,
    )
    assert.equal(
      Object.hasOwn(raw.exploreRead.messages[0], 'questionRelativeTime'),
      false,
    )

    const invalid = await answerWithRetrieval(observedBrain, {
      ...SCOPE,
      question: 'When was the workshop?',
      questionDate: 'not-a-date',
      async provider({ retrieve }) {
        const found = await retrieve({
          input: { phrase: 'photography workshop' },
          tool: 'memory_find',
        })
        assert.equal(
          Object.hasOwn(found.matches[0], 'questionRelativeTime'),
          false,
        )
        return { text: 'The stored date is November 1.' }
      },
    })
    assert.equal(invalid.answer, 'The stored date is November 1.')
  })

test('the new answer contract is concise and gives providers safe headroom',
  async (t) => {
    const brain = await openBrain(t, { embedder: fakeEmbed })
    await seed(brain, [{
      id: 'tokyo:0',
      user:
        'I have a Suica card and downloaded TripIt for my Tokyo journey.',
    }])

    const result = await answerWithRetrieval(brain, {
      ...SCOPE,
      async provider({
        answerInstructions,
        recommendedMaxOutputTokens,
        retrieve,
      }) {
        assert.equal(
          recommendedMaxOutputTokens,
          MEMORY_ANSWER_RECOMMENDED_MAX_OUTPUT_TOKENS,
        )
        assert.ok(recommendedMaxOutputTokens >= 512)
        assert.match(answerInstructions, /directly and concisely/)
        const found = await retrieve({
          input: {
            phrase: 'helpful tips for getting around Tokyo',
          },
          tool: 'memory_search',
        })
        assert.ok(found.matches.some((row) =>
          row.text.includes('Suica') && row.text.includes('TripIt')))
        return {
          text:
            'Use your Suica card for transit and keep each route in TripIt.',
        }
      },
      question:
        'I’m a bit anxious about getting around Tokyo. Do you have any helpful tips?',
    })

    assert.equal(result.answer.split(/\s+/u).length, 12)
  })

test('optional completeness guidance is bounded and provider-neutral',
  async (t) => {
    const brain = await openBrain(t)
    await seed(brain, [{ id: 'duration:0', user: 'I have lived here for three months.' }])
    let observed
    await answerWithRetrieval(brain, {
      ...SCOPE,
      additionalInstructions: MEMORY_RETRIEVAL_COMPLETENESS_INSTRUCTIONS,
      async provider(context) {
        observed = context.answerInstructions
        return { text: 'Three months.' }
      },
      question: 'How long have I lived here?',
    })
    assert.ok(observed.startsWith(MEMORY_RETRIEVAL_INSTRUCTIONS))
    assert.match(observed, /not as an automatic retrieval cutoff/)
    assert.match(observed, /second targeted retrieval/)
    assert.match(observed, /both the current situational constraints/)
    assert.match(observed, /one relevance-ranked result is not exhaustive/)
    assert.match(observed, /mismatched named people, places, objects, or relationships/)
    assert.match(observed, /each canonical evidence ID at most once/)
    await assert.rejects(
      answerWithRetrieval(brain, {
        ...SCOPE,
        additionalInstructions: 'x'.repeat(4_001),
        provider: async () => ({ text: 'unused' }),
        question: 'unused',
      }),
      /at most 4000 characters/,
    )
  })

test('answer composition auto-detection is general and avoids scalar duration questions', () => {
  for (const question of [
    'How many store errands do I still have?',
    'List all medications I need to refill.',
    'Which documents must I collect or return from an office?',
    'What travel items are still outstanding?',
  ]) {
    assert.equal(resolveMemoryAnswerCompositionMode(question), 'enumerate')
  }
  for (const question of [
    'How many months have I lived here?',
    'How many miles is the route?',
    'Where is my passport?',
  ]) {
    assert.equal(resolveMemoryAnswerCompositionMode(question), 'standard')
  }
  assert.equal(
    resolveMemoryAnswerCompositionMode('Where is my passport?', 'enumerate'),
    'enumerate',
  )
  assert.throws(
    () => resolveMemoryAnswerCompositionMode('Anything?', 'unknown'),
    /compositionMode must be one of/,
  )
  assert.match(MEMORY_ANSWER_ENUMERATION_INSTRUCTIONS, /excluded only when direct evidence/i)
  assert.match(
    MEMORY_ANSWER_ENUMERATION_INSTRUCTIONS,
    /simultaneously asserts an outstanding action.*classify.*ambiguous/i,
  )
})

test('enumeration commitment preserves exhaustive candidates, ambiguity, and exact counts',
  async (t) => {
    const brain = await openBrain(t)
    await seed(brain, [
      { id: 'passport-pickup:0', user: 'I need to pick up my renewed passport from city hall.' },
      { id: 'keyboard-return:0', user: 'I may still need to return the rented keyboard to the music shop.' },
      { id: 'prescription-pickup:0', user: 'I already collected my prescription from the pharmacy.' },
    ])
    const provider = requireEvidenceCommitment(async ({
      answerEnumerationRequired,
      commitAnswer,
      retrieve,
    }) => {
      assert.equal(answerEnumerationRequired, true)
      const passportResult = await retrieve({
        input: { phrase: 'renewed passport' },
        tool: 'memory_find',
      })
      const keyboardResult = await retrieve({
        input: { phrase: 'rented keyboard' },
        tool: 'memory_find',
      })
      const prescriptionResult = await retrieve({
        input: { phrase: 'prescription' },
        tool: 'memory_find',
      })
      const [passport] = passportResult.matches
      const [keyboard] = keyboardResult.matches
      const [prescription] = prescriptionResult.matches
      assert.ok(passport && keyboard && prescription)
      const candidates = [
        [passport, 'I need to pick up my renewed passport from city hall.'],
        [keyboard, 'I may still need to return the rented keyboard to the music shop.'],
        [prescription, 'I already collected my prescription from the pharmacy.'],
      ]
      const bases = candidates.map(([row, quote], index) => ({
        consequence_for_answer: index === 2
          ? ''
          : 'This is a candidate store errand.',
        evidenceId: row.evidenceId,
        not_used_reason: index === 2
          ? 'This pickup is explicitly complete.'
          : '',
        quote,
      }))
      return commitAnswer({
        abstained: false,
        bases,
        enumeration: {
          items: [
            {
              action: 'pick up',
              disposition: 'included',
              evidenceId: passport.evidenceId,
              label: 'renewed passport',
              quote: candidates[0][1],
              reason: 'The pickup is explicitly outstanding.',
            },
            {
              action: 'return',
              disposition: 'ambiguous',
              evidenceId: keyboard.evidenceId,
              label: 'rented keyboard',
              quote: candidates[1][1],
              reason: 'The tentative wording leaves the current return state unresolved.',
            },
            {
              action: 'collect',
              disposition: 'excluded',
              evidenceId: prescription.evidenceId,
              label: 'prescription',
              quote: candidates[2][1],
              reason: 'The evidence directly says collection is complete.',
            },
          ],
          referencedCount: 3,
          includedCount: 1,
          ambiguousCount: 1,
        },
        temporaryInferences: [],
        text: 'One errand is definite, one is excluded, and one remains ambiguous.',
      })
    })

    const result = await answerWithRetrieval(brain, {
      ...SCOPE,
      compositionMode: 'auto',
      provider,
      question: 'How many errands do I still have?',
    })
    assert.equal(result.answerCompositionMode, 'enumerate')
    assert.equal(result.answerEnumeration.referencedCount, 3)
    assert.equal(result.answerEnumeration.includedCount, 1)
    assert.equal(result.answerEnumeration.ambiguousCount, 1)
    assert.ok(Object.isFrozen(result.answerEnumeration))
    assert.ok(Object.isFrozen(result.answerEnumeration.items))
  })

test('enumeration commitment rejects omitted candidates and host-inconsistent counts',
  async (t) => {
    const brain = await openBrain(t)
    const canonical = 'I need to return the rented keyboard to the music shop.'
    await seed(brain, [{ id: 'keyboard-return:0', user: canonical }])
    const provider = requireEvidenceCommitment(async ({ commitAnswer, retrieve }) => {
      const found = await retrieve({
        input: { phrase: 'keyboard' },
        tool: 'memory_find',
      })
      const [row] = found.matches
      return commitAnswer({
        abstained: false,
        bases: [{
          consequence_for_answer: 'This is an outstanding return.',
          evidenceId: row.evidenceId,
          not_used_reason: '',
          quote: canonical,
        }],
        enumeration: {
          ambiguousCount: 0,
          includedCount: 0,
          items: [{
            action: 'return',
            disposition: 'included',
            evidenceId: row.evidenceId,
            label: 'rented keyboard',
            quote: canonical,
            reason: 'The return is explicit.',
          }],
          referencedCount: 1,
        },
        temporaryInferences: [],
        text: 'One return.',
      })
    })
    await assert.rejects(
      answerWithRetrieval(brain, {
        ...SCOPE,
        compositionMode: 'enumerate',
        provider,
        question: 'List all music shop errands.',
      }),
      /includedCount must equal 1/,
    )
  })

test('enumeration commitment permits an honest zero-candidate count',
  async (t) => {
    const brain = await openBrain(t)
    const canonical = 'I bake sourdough every Sunday.'
    await seed(brain, [{ id: 'sourdough:0', user: canonical }])
    const provider = requireEvidenceCommitment(async ({ commitAnswer, retrieve }) => {
      const found = await retrieve({
        input: { phrase: 'bake' },
        tool: 'memory_find',
      })
      const [row] = found.matches
      return commitAnswer({
        abstained: true,
        bases: [{
          consequence_for_answer: '',
          evidenceId: row.evidenceId,
          not_used_reason: 'This is sourdough, not the requested egg tarts.',
          quote: canonical,
        }],
        enumeration: {
          ambiguousCount: 0,
          includedCount: 0,
          items: [],
          referencedCount: 0,
        },
        temporaryInferences: [],
        text: 'I found no stored evidence of baking egg tarts.',
      })
    })
    const result = await answerWithRetrieval(brain, {
      ...SCOPE,
      compositionMode: 'auto',
      provider,
      question: 'How many times did I bake egg tarts?',
    })
    assert.equal(result.answerEnumeration.referencedCount, 0)
    assert.equal(result.answerEnumeration.includedCount, 0)
    assert.equal(result.answerEnumeration.ambiguousCount, 0)
    assert.deepEqual(result.answerEnumeration.items, [])
  })

test('planned search expansion gathers complementary evidence across domains',
  async (t) => {
    const cases = [
      {
        category: 'musical instruments and store errands',
        first: 'I need to collect my repaired violin from Bell Music.',
        name: 'instruments',
        primary: 'repaired violin Bell Music',
        question: 'Which musical items must I collect or return from a store?',
        second: 'I must return my rented cello to Northside Instruments.',
      },
      {
        category: 'documents and office errands',
        first: 'I need to collect my renewed passport from City Hall.',
        name: 'documents',
        primary: 'renewed passport City Hall',
        question: 'Which documents must I collect or return from an office?',
        second: 'I must return my expired access badge to the security office.',
      },
      {
        category: 'equipment and shop errands',
        first: 'I need to collect my repaired camera from the workshop.',
        name: 'equipment',
        primary: 'repaired camera workshop',
        question: 'Which equipment must I collect or return from a shop?',
        second: 'I must return the rented tripod to the equipment shop.',
      },
    ]

    for (const entry of cases) {
      await t.test(entry.name, async (t) => {
        const brain = await openBrain(t)
        await seed(brain, [
          { user: entry.first },
          { user: entry.second },
          { user: 'I bought coffee beans during an unrelated grocery trip.' },
        ])

        const search = async (expandPlannedSearches) => {
          let found
          await answerWithRetrieval(brain, {
            ...SCOPE,
            expandPlannedSearches,
            async provider({ retrieve }) {
              await retrieve({
                input: {
                  anchor_event: 'outstanding collections and returns',
                  category: entry.category,
                  relation: 'current',
                  time_range: { after: null, before: null },
                },
                tool: 'memory_plan',
              })
              found = await retrieve({
                input: { phrase: entry.primary },
                tool: 'memory_search',
              })
              return { text: 'Consulted.' }
            },
            question: entry.question,
          })
          return found
        }

        const baseline = await search(false)
        assert.equal(
          baseline.matches.some((row) => row.text === entry.second),
          false,
        )
        assert.equal(baseline.supplementalRankedCandidates, 0)
        assert.deepEqual(baseline.supplementalRankedQueries, [])

        const expanded = await search(true)
        const first = expanded.matches.find((row) => row.text === entry.first)
        const second = expanded.matches.find((row) => row.text === entry.second)
        assert.ok(first)
        assert.ok(second)
        assert.ok(second.surfaces.some((surface) =>
          surface.startsWith('ranked:')))
        assert.ok(expanded.supplementalRankedCandidates >= 2)
        assert.ok(expanded.supplementalRankedQueries.some(({ surface }) =>
          surface === 'ranked:question'))
        assert.ok(expanded.supplementalRankedQueries.some(({ surface }) =>
          surface === 'ranked:plan-category'))
      })
    }

    await t.test('original user evidence survives a weak reranker', async (t) => {
      const reranker = async (_query, texts) => texts.map((text) =>
        text.includes('navy blazer') ? -10 : 10)
      const brain = await openBrain(t, { reranker })
      await seed(brain, [
        {
          assistant:
            'Use a checklist to remember store pickups and clothing returns.',
          user: 'I still need to pick up the replacement boots from Zara.',
        },
        {
          assistant:
            'Dry cleaning is one part of keeping a wardrobe organized.',
          user:
            'I still need to pick up my dry cleaning for the navy blazer.',
        },
        { user: 'I also need to buy coffee beans at the grocery store.' },
      ])
      let found
      await answerWithRetrieval(brain, {
        ...SCOPE,
        expandPlannedSearches: true,
        async provider({ retrieve }) {
          await retrieve({
            input: {
              anchor_event: 'outstanding clothing pickups and returns',
              category: 'clothing and store errands',
              relation: 'current',
              time_range: { after: null, before: null },
            },
            tool: 'memory_plan',
          })
          found = await retrieve({
            input: { limit: 3, phrase: 'replacement boots Zara' },
            tool: 'memory_search',
          })
          return { text: 'Consulted.' }
        },
        question:
          'Which clothing items do I still need to pick up or return?',
      })
      const blazer = found.matches.find((row) =>
        row.text.includes('navy blazer'))
      assert.ok(blazer)
      assert.equal(blazer.rerankScore, -10)
      assert.ok(blazer.completionSurfaceRanks['original-user-evidence'])
    })

    await assert.rejects(
      answerWithRetrieval({}, {
        ...SCOPE,
        expandPlannedSearches: 'yes',
        provider: async () => ({ text: 'unused' }),
        question: 'unused',
      }),
      /expandPlannedSearches must be boolean/,
    )
  })

test('trusted retrieval time range overrides provider-authored search bounds',
  async (t) => {
    const brain = await openBrain(t)
    await seed(brain, [
      { user: 'I had lived in the apartment for one month.' },
      { user: 'I have now lived in the apartment for three months.' },
    ])
    const result = await answerWithRetrieval(brain, {
      ...SCOPE,
      async provider({ retrieve }) {
        const found = await retrieve({
          input: {
            before: '2025-01-01T12:00:00.000Z',
            phrase: 'lived apartment months',
          },
          tool: 'memory_search',
        })
        assert.deepEqual(found.effectiveTimeRange, {
          after: null,
          before: null,
        })
        assert.ok(found.matches.some((row) =>
          row.text.includes('three months')))
        return { text: 'Three months.' }
      },
      question: 'How long have I lived in the apartment?',
      questionDate: '2025-01-01T12:00:00.000Z',
      trustedRetrievalTimeRange: { after: null, before: null },
    })
    assert.equal(result.answer, 'Three months.')

    await assert.rejects(
      answerWithRetrieval(brain, {
        ...SCOPE,
        provider: async () => ({ text: 'unused' }),
        question: 'unused',
        trustedRetrievalTimeRange: {
          after: '2025-02-01',
          before: '2025-01-01',
        },
      }),
      /must not exceed before/,
    )
  })

test('evidence-use instructions cover relevant, irrelevant, corrected, and empty retrieval',
  async (t) => {
    const brain = await openBrain(t)
    await seed(brain, [
      {
        assistant:
          'I recommend keeping a paper checklist beside the travel case.',
        id: 'packing-advice:0',
        user: 'I often forget one item when packing for a trip.',
      },
      {
        id: 'instrument-history:0',
        user:
          'My first musical instrument was a cedar classical guitar.',
      },
      {
        id: 'instrument-history:1',
        user:
          'I later bought a compact digital piano as another musical instrument.',
      },
      {
        id: 'snack-correction:0',
        user: 'My favorite trail snack is dried mango.',
      },
      {
        id: 'snack-correction:1',
        user: 'I changed my favorite trail snack to roasted almonds.',
      },
      {
        id: 'running-noise:0',
        user: 'I completed a rainy neighborhood fun run last spring.',
      },
    ])

    function assertContract(context) {
      assert.equal(
        context.answerInstructions,
        MEMORY_RETRIEVAL_INSTRUCTIONS,
      )
      assert.equal(
        context.systemInstruction,
        memoryAnswerSystemInstruction,
      )
      assert.equal(context.briefing.included.length, 0)
      assert.match(
        context.answerInstructions,
        /do not claim no relevant memory merely because the initial briefing or digest was empty/,
      )
      assert.match(
        context.answerInstructions,
        /A non-empty result does not establish relevance/,
      )
      assert.match(
        context.answerInstructions,
        /Prior Palari speech may be reported as advice/,
      )
    }

    const advice = await answerWithRetrieval(brain, {
      ...SCOPE,
      async provider(context) {
        assertContract(context)
        const found = await context.retrieve({
          input: { phrase: 'paper checklist travel case' },
          tool: 'memory_search',
        })
        const row = found.matches.find((entry) =>
          entry.text.includes('paper checklist'))
        assert.equal(
          row.text,
          'I recommend keeping a paper checklist beside the travel case.',
        )
        assert.equal(row.speaker, 'Palari')
        return {
          abstained: false,
          text:
            'I previously recommended keeping a paper checklist beside your travel case.',
        }
      },
      question: 'What packing advice did you give me?',
    })
    assert.equal(advice.abstained, false)
    assert.match(advice.answer, /previously recommended/)

    const chronology = await answerWithRetrieval(brain, {
      ...SCOPE,
      async provider(context) {
        assertContract(context)
        const found = await context.retrieve({
          input: { phrase: 'musical instrument' },
          tool: 'memory_search',
        })
        const userRows = found.matches.filter((entry) =>
          entry.speaker === 'user' &&
          entry.text.includes('musical instrument'))
        assert.deepEqual(
          userRows.map((entry) => entry.text),
          [
            'My first musical instrument was a cedar classical guitar.',
            'I later bought a compact digital piano as another musical instrument.',
          ],
        )
        assert.ok(userRows[0].observedAt < userRows[1].observedAt)
        assert.ok(userRows.every((entry) =>
          entry.evidenceId && entry.sourceMessageId))
        return {
          abstained: false,
          text: 'The cedar classical guitar came first.',
        }
      },
      question: 'Which musical instrument came first?',
    })
    assert.equal(chronology.answer, 'The cedar classical guitar came first.')

    const correction = await answerWithRetrieval(brain, {
      ...SCOPE,
      async provider(context) {
        assertContract(context)
        const found = await context.retrieve({
          input: { phrase: 'favorite trail snack' },
          tool: 'memory_search',
        })
        const snackRows = found.matches.filter((entry) =>
          entry.speaker === 'user' && entry.text.includes('trail snack'))
        assert.deepEqual(
          snackRows.map((entry) => entry.text).sort(),
          [
            'I changed my favorite trail snack to roasted almonds.',
            'My favorite trail snack is dried mango.',
          ].sort(),
        )
        assert.ok(snackRows.every((entry) =>
          entry.evidenceId && entry.sourceMessageId && entry.observedAt))
        const current = snackRows.find((entry) =>
          entry.text.includes('roasted almonds'))
        assert.equal(current.speaker, 'user')
        assert.ok(snackRows.some((entry) => entry.observedAt < current.observedAt))
        return {
          abstained: false,
          text: 'Your current favorite trail snack is roasted almonds.',
        }
      },
      question: 'What is my current favorite trail snack?',
    })
    assert.equal(
      correction.answer,
      'Your current favorite trail snack is roasted almonds.',
    )

    const irrelevant = await answerWithRetrieval(brain, {
      ...SCOPE,
      async provider(context) {
        assertContract(context)
        const found = await context.retrieve({
          input: { phrase: 'rainy neighborhood fun run' },
          tool: 'memory_search',
        })
        assert.ok(found.matches.length > 0)
        assert.ok(found.matches.some((entry) =>
          entry.text.includes('neighborhood fun run')))
        return {
          abstained: true,
          text: 'I have no stored memory about that allergy.',
        }
      },
      question: 'Which antibiotic am I allergic to?',
    })
    assert.equal(irrelevant.abstained, true)

    const empty = await answerWithRetrieval(brain, {
      ...SCOPE,
      async provider(context) {
        assertContract(context)
        const found = await context.retrieve({
          input: { phrase: 'telescope observatory constellation' },
          tool: 'memory_search',
        })
        assert.equal(found.matches.length, 0)
        return {
          abstained: true,
          text: 'I have no stored memory about an observatory visit.',
        }
      },
      question: 'Which observatory did I visit?',
    })
    assert.equal(empty.abstained, true)

    const expectedCanonicalText = new Map([
      [
        advice.retrievalTranscript[0].result.matches.find((entry) =>
          entry.text.includes('paper checklist')).evidenceId,
        'I recommend keeping a paper checklist beside the travel case.',
      ],
      ...chronology.retrievalTranscript[0].result.matches
        .filter((entry) => entry.text.includes('musical instrument'))
        .map((entry) => [entry.evidenceId, entry.text]),
      ...correction.retrievalTranscript[0].result.matches
        .filter((entry) => entry.text.includes('trail snack'))
        .map((entry) => [entry.evidenceId, entry.text]),
    ])
    assert.ok(expectedCanonicalText.size >= 5)
    for (const result of [advice, chronology, irrelevant, empty]) {
      for (const entry of result.retrievalTranscript[0].result.matches) {
        if (expectedCanonicalText.has(entry.evidenceId)) {
          assert.equal(entry.text, expectedCanonicalText.get(entry.evidenceId))
        }
      }
    }
  })

test('retrieval tools are provider-neutral, bounded, and additive', () => {
  assert.deepEqual(
    MEMORY_RETRIEVAL_TOOLS.map((tool) => tool.name).sort(),
    [
      'memory_find',
      'memory_graph',
      'memory_plan',
      'memory_read',
      'memory_search',
      'memory_timeline',
    ],
  )
  const search = MEMORY_RETRIEVAL_TOOLS.find((tool) =>
    tool.name === 'memory_search')
  assert.deepEqual(search.parameters.required, ['phrase'])
  assert.equal(search.parameters.properties.phrase.maxLength, 500)
  const graph = MEMORY_RETRIEVAL_TOOLS.find((tool) =>
    tool.name === 'memory_graph')
  assert.equal(graph.parameters.properties.hops.maximum, 3)
  const plan = MEMORY_RETRIEVAL_TOOLS.find((tool) =>
    tool.name === 'memory_plan')
  assert.deepEqual(plan.parameters.required, [
    'anchor_event',
    'relation',
    'category',
    'time_range',
  ])
  assert.ok(
    MEMORY_RETRIEVAL_INSTRUCTIONS.startsWith(
      `${MEMORY_EXPLORATION_INSTRUCTIONS}\n`,
    ),
  )
  assert.equal(
    MEMORY_RETRIEVAL_INSTRUCTIONS.includes(
      [...MEMORY_EXPLORATION_INSTRUCTIONS].join('\n'),
    ),
    false,
  )
  assert.match(MEMORY_RETRIEVAL_INSTRUCTIONS, /one sentence/)
  assert.match(
    MEMORY_RETRIEVAL_INSTRUCTIONS,
    /do not claim no relevant memory merely because the initial briefing or digest was empty/,
  )
  assert.match(
    MEMORY_RETRIEVAL_INSTRUCTIONS,
    /A non-empty result does not establish relevance/,
  )
  assert.ok(MEMORY_RETRIEVAL_TOOLS.every(Object.isFrozen))
})

test('retrieval calls are bounded and unknown tools fail closed',
  async (t) => {
    const brain = await openBrain(t)
    await seed(brain, [{ user: 'A retained statement.' }])
    const bounded = await answerWithRetrieval(brain, {
      ...SCOPE,
      maxRetrievalCalls: 1,
      async provider({ retrieve }) {
        await retrieve({
          input: { phrase: 'retained' },
          tool: 'memory_search',
        })
        const refused = await retrieve({
          input: { phrase: 'statement' },
          tool: 'memory_search',
        })
        assert.equal(refused.reason, 'retrieval_budget_exhausted')
        return { text: 'Stopped.' }
      },
      question: 'What is retained?',
    })
    assert.equal(bounded.retrievalCalls, 1)
    assert.equal(bounded.retrievalExhausted, true)

    let defaultSession
    const defaultBounded = await answerWithRetrieval(brain, {
      ...SCOPE,
      async provider(session) {
        defaultSession = session
        for (let index = 0; index < DEFAULT_RETRIEVAL_CALLS; index += 1) {
          const result = await session.retrieve({
            input: { limit: 1 },
            tool: 'memory_timeline',
          })
          assert.notEqual(result.exhausted, true)
        }
        const refused = await session.retrieve({
          input: { phrase: 'retained' },
          tool: 'memory_find',
        })
        assert.deepEqual(refused, {
          exhausted: true,
          reason: 'retrieval_budget_exhausted',
        })
        return { text: 'No more retrieval is needed.' }
      },
      question: 'What is retained?',
    })
    assert.equal(DEFAULT_RETRIEVAL_CALLS, 4)
    assert.equal(defaultSession.maxRetrievalCalls, 4)
    assert.match(
      defaultSession.retrievalFinalizationInstructions,
      /do not have enough stored evidence/i,
    )
    assert.match(
      defaultSession.retrievalFinalizationInstructions,
      /not proof that an event did not happen/i,
    )
    assert.equal(defaultBounded.retrievalCalls, 4)
    assert.equal(defaultBounded.retrievalTranscript.length, 4)
    assert.equal(defaultBounded.retrievalExhausted, true)

    await assert.rejects(
      answerWithRetrieval(brain, {
        ...SCOPE,
        maxRetrievalCalls: 5,
        async provider() {
          return { text: 'unreachable' }
        },
        question: 'Anything?',
      }),
      /maxRetrievalCalls must be an integer from 0 to 4/,
    )

    await assert.rejects(
      answerWithRetrieval(brain, {
        ...SCOPE,
        async provider({ retrieve }) {
          await retrieve({ input: {}, tool: 'memory_delete_everything' })
          return { text: 'unreachable' }
        },
        question: 'Anything?',
      }),
      /Unknown memory tool/,
    )
  })

test('Phone acceptance: selected power-bank evidence has a concrete consequence',
  async (t) => {
    const brain = await openBrain(t)
    await seed(brain, [{
      id: 'travel-tech:0',
      user: 'I already have a portable power bank for travel.',
    }])
    const provider = requireEvidenceCommitment(async ({
      commitAnswer,
      retrieve,
    }) => {
      const found = await retrieve({
        input: { phrase: 'portable power bank' },
        tool: 'memory_find',
      })
      const row = found.matches.find((entry) => entry.speaker === 'user')
      return commitAnswer({
        abstained: false,
        bases: [{
          consequence_for_answer:
            'Battery advice explicitly tells the user to keep their existing power bank charged and available.',
          evidenceId: row.evidenceId,
          not_used_reason: '',
          quote: 'I already have a portable power bank for travel.',
        }],
        temporaryInferences: [],
        text:
          'Because you already have a portable power bank, keep it charged and carry it while you diagnose the phone drain.',
      })
    })

    const result = await answerWithRetrieval(brain, {
      ...SCOPE,
      provider,
      question: 'My phone battery is draining quickly. What should I do?',
    })
    assert.match(result.answer, /already have a portable power bank/i)
    assert.equal(result.evidenceCommitments.length, 1)
    assert.match(
      result.evidenceCommitments[0].consequence_for_answer,
      /explicitly tells/,
    )
    assert.equal(result.evidenceCommitments[0].not_used_reason, null)
    assert.equal(result.answerEvidence.length, 1)
  })

test('Instant Pot acceptance: general before-plan reaches the original user span',
  async (t) => {
    const brain = await openBrain(t)
    await seed(brain, [
      {
        id: 'kitchen-earlier:0',
        user: 'I bought an Instant Pot for weeknight dinners.',
      },
      {
        id: 'kitchen-anchor:0',
        user: 'I bought an Air Fryer yesterday.',
      },
    ])
    let originalReturnedBeforeCommit = false
    const provider = requireEvidenceCommitment(async ({
      commitAnswer,
      retrieve,
    }) => {
      await retrieve({
        input: {
          anchor_event: 'purchase of the later kitchen appliance',
          category: 'kitchen appliance purchase',
          relation: 'before',
          time_range: { after: null, before: null },
        },
        tool: 'memory_plan',
      })
      const anchor = await retrieve({
        input: { phrase: 'Air Fryer' },
        tool: 'memory_find',
      })
      const timeline = await retrieve({
        input: { limit: 20 },
        tool: 'memory_timeline',
      })
      const anchorSession = anchor.matches.find((row) =>
        row.speaker === 'user').session
      const anchorIndex = timeline.sessions.findIndex((entry) =>
        entry.session === anchorSession)
      const earlierSession = timeline.sessions[anchorIndex - 1].session
      const read = await retrieve({
        input: { session: earlierSession },
        tool: 'memory_read',
      })
      const row = read.messages.find((entry) =>
        entry.speaker === 'user' && entry.text.includes('Instant Pot'))
      originalReturnedBeforeCommit = Boolean(row)
      return commitAnswer({
        abstained: false,
        bases: [{
          consequence_for_answer:
            'Identifies the earlier kitchen appliance as the Instant Pot.',
          evidenceId: row.evidenceId,
          not_used_reason: '',
          quote: 'I bought an Instant Pot for weeknight dinners.',
        }],
        temporaryInferences: [],
        text: 'You bought the Instant Pot before the Air Fryer.',
      })
    })

    const result = await answerWithRetrieval(brain, {
      ...SCOPE,
      provider,
      question: 'Which kitchen gadget did I get before the Air Fryer?',
    })
    assert.equal(originalReturnedBeforeCommit, true)
    assert.equal(result.answer, 'You bought the Instant Pot before the Air Fryer.')
    assert.equal(result.retrievalPlanningCalls, 1)
    assert.equal(result.retrievalCalls, 3)
    assert.equal(result.retrievalPlan.relation, 'before')
    assert.deepEqual(
      result.retrievalTranscript.map((entry) => entry.tool),
      ['memory_plan', 'memory_find', 'memory_timeline', 'memory_read'],
    )
  })

test('Tokyo acceptance: timeline/read returns original Suica and TripIt user speech',
  async (t) => {
    const brain = await openBrain(t)
    await seed(brain, [
      {
        assistant: 'That should make station entry easier.',
        id: 'tokyo-card:0',
        user: 'I already loaded a Suica card for my Tokyo trip.',
      },
      {
        assistant: 'That should keep the itinerary organized.',
        id: 'tokyo-itinerary:0',
        user: 'I use TripIt to track my travel plans.',
      },
      {
        assistant: 'Consider a transit card and a travel app.',
        id: 'tokyo-old-advice:0',
        user: 'Tokyo stations make me a little anxious.',
      },
    ])
    const provider = requireEvidenceCommitment(async ({
      commitAnswer,
      retrieve,
    }) => {
      await retrieve({
        input: {
          anchor_event: 'the user’s Tokyo trip',
          category: 'transit access and itinerary tools',
          relation: 'during',
          time_range: { after: null, before: null },
        },
        tool: 'memory_plan',
      })
      const timeline = await retrieve({
        input: { limit: 20 },
        tool: 'memory_timeline',
      })
      const cardSession = timeline.sessions.find((entry) =>
        entry.session === 'tokyo-card').session
      const itinerarySession = timeline.sessions.find((entry) =>
        entry.session === 'tokyo-itinerary').session
      const card = await retrieve({
        input: { session: cardSession },
        tool: 'memory_read',
      })
      const itinerary = await retrieve({
        input: { session: itinerarySession },
        tool: 'memory_read',
      })
      const suica = card.messages.find((row) =>
        row.speaker === 'user' && row.text.includes('Suica'))
      const tripit = itinerary.messages.find((row) =>
        row.speaker === 'user' && row.text.includes('TripIt'))
      assert.ok(suica)
      assert.ok(tripit)
      return commitAnswer({
        abstained: false,
        bases: [
          {
            consequence_for_answer:
              'Avoids recommending a new transit card and instead advises using the existing Suica.',
            evidenceId: suica.evidenceId,
            not_used_reason: '',
            quote: 'I already loaded a Suica card for my Tokyo trip.',
          },
          {
            consequence_for_answer:
              'Personalizes route organization around the user’s existing TripIt workflow.',
            evidenceId: tripit.evidenceId,
            not_used_reason: '',
            quote: 'I use TripIt to track my travel plans.',
          },
        ],
        temporaryInferences: [],
        text:
          'Use your already-loaded Suica at the gates and keep each route in TripIt so the station sequence is easy to follow.',
      })
    })

    const result = await answerWithRetrieval(brain, {
      ...SCOPE,
      provider,
      question: 'How can I make getting around Tokyo less stressful?',
    })
    assert.match(result.answer, /already-loaded Suica/)
    assert.match(result.answer, /TripIt/)
    assert.deepEqual(
      result.evidenceCommitments.map((entry) => entry.evidenceId),
      result.selectedEvidenceIds,
    )
    assert.ok(result.retrievalTranscript
      .filter((entry) => entry.tool === 'memory_read')
      .flatMap((entry) => entry.result.messages)
      .filter((row) => row.text.includes('Suica') || row.text.includes('TripIt'))
      .every((row) => row.speaker === 'user'))
  })

test('Miami acceptance: combined evidence uses only temporary revisable transfer',
  async (t) => {
    const brain = await openBrain(t)
    await seed(brain, [
      {
        id: 'seattle-view:0',
        user: 'For Seattle, I want a hotel with a great city view.',
      },
      {
        id: 'hotel-amenity:0',
        user: 'I loved having a private balcony hot tub at my last hotel.',
      },
    ])
    const before = brain.exploreTimeline(SCOPE, { limit: 20 })
    const provider = requireEvidenceCommitment(async ({
      commitAnswer,
      retrieve,
    }) => {
      const view = await retrieve({
        input: { phrase: 'great city view' },
        tool: 'memory_find',
      })
      const amenity = await retrieve({
        input: { phrase: 'private balcony hot tub' },
        tool: 'memory_find',
      })
      const viewRow = view.matches.find((row) => row.speaker === 'user')
      const amenityRow = amenity.matches.find((row) => row.speaker === 'user')
      return commitAnswer({
        abstained: false,
        bases: [
          {
            consequence_for_answer:
              'Prioritizes a Miami property and room category with a strong water or skyline view.',
            evidenceId: viewRow.evidenceId,
            not_used_reason: '',
            quote: 'For Seattle, I want a hotel with a great city view.',
          },
          {
            consequence_for_answer:
              'Adds a private balcony hot tub as a recommendation criterion.',
            evidenceId: amenityRow.evidenceId,
            not_used_reason: '',
            quote: 'I loved having a private balcony hot tub at my last hotel.',
          },
        ],
        temporaryInferences: [{
          consequence_for_answer:
            'Uses both preferences tentatively for this Miami recommendation.',
          provenanceEvidenceIds: [viewRow.evidenceId, amenityRow.evidenceId],
          revisable: true,
          statement:
            'The hotel qualities valued in earlier trips may transfer to this Miami choice.',
        }],
        text:
          'For Miami, prioritize a room with an excellent water view and a private balcony hot tub; confirm those room-specific amenities before booking.',
      })
    })

    const result = await answerWithRetrieval(brain, {
      ...SCOPE,
      provider,
      question: 'What kind of Miami hotel would you recommend for me?',
    })
    const after = brain.exploreTimeline(SCOPE, { limit: 20 })
    assert.match(result.answer, /water view/)
    assert.match(result.answer, /private balcony hot tub/)
    assert.equal(result.answerEvidence.length, 2)
    assert.equal(result.temporaryInferences.length, 1)
    assert.equal(result.temporaryInferences[0].revisable, true)
    assert.deepEqual(after, before)
  })

test('modern commitments allow non-use without forcing every retrieved memory',
  async (t) => {
    const brain = await openBrain(t)
    await seed(brain, [{
      assistant: 'A generic packing checklist can also help.',
      id: 'selection:0',
      user: 'My passport wallet is in the top drawer.',
    }])
    const provider = requireEvidenceCommitment(async ({
      commitAnswer,
      retrieve,
    }) => {
      const read = await retrieve({
        input: { session: 'selection' },
        tool: 'memory_read',
      })
      const user = read.messages.find((row) => row.speaker === 'user')
      return commitAnswer({
        abstained: true,
        bases: [{
          consequence_for_answer: '',
          evidenceId: user.evidenceId,
          not_used_reason:
            'The passport-wallet location does not identify the requested vaccination record.',
          quote: 'My passport wallet is in the top drawer.',
        }],
        temporaryInferences: [],
        text: 'I do not have enough stored evidence about that vaccination record.',
      })
    })
    const result = await answerWithRetrieval(brain, {
      ...SCOPE,
      provider,
      question: 'Where is my vaccination record?',
    })
    assert.equal(result.answerEvidence.length, 0)
    assert.equal(result.evidenceCommitments.length, 1)
    assert.equal(result.selectedEvidenceIds.length, 1)
    assert.match(result.evidenceCommitments[0].not_used_reason, /does not identify/)
  })

test('modern commitment use fields and temporary provenance fail closed',
  async (t) => {
    const brain = await openBrain(t)
    await seed(brain, [{
      id: 'strict-modern:0',
      user: 'I keep the blue folio in the desk drawer.',
    }])
    for (const mutate of [
      (basis) => ({ ...basis, consequence_for_answer: '' }),
      (basis) => ({
        ...basis,
        consequence_for_answer: 'Changes the answer.',
        not_used_reason: 'Also unused.',
      }),
    ]) {
      const provider = requireEvidenceCommitment(async ({
        commitAnswer,
        retrieve,
      }) => {
        const found = await retrieve({
          input: { phrase: 'blue folio' },
          tool: 'memory_find',
        })
        const row = found.matches[0]
        return commitAnswer({
          abstained: false,
          bases: [mutate({
            consequence_for_answer: 'Locates the folio.',
            evidenceId: row.evidenceId,
            not_used_reason: '',
            quote: 'blue folio in the desk drawer',
          })],
          temporaryInferences: [],
          text: 'The folio is in the desk drawer.',
        })
      })
      await assert.rejects(
        answerWithRetrieval(brain, {
          ...SCOPE,
          provider,
          question: 'Where is the folio?',
        }),
        (error) => error.code === 'MEMORY_ANSWER_COMMITMENT_INVALID' &&
          /exactly one/.test(error.message),
      )
    }

    const nonRevisable = requireEvidenceCommitment(async ({
      commitAnswer,
      retrieve,
    }) => {
      const found = await retrieve({
        input: { phrase: 'blue folio' },
        tool: 'memory_find',
      })
      const row = found.matches[0]
      return commitAnswer({
        abstained: false,
        bases: [{
          consequence_for_answer: 'Locates the folio.',
          evidenceId: row.evidenceId,
          not_used_reason: '',
          quote: 'blue folio in the desk drawer',
        }],
        temporaryInferences: [{
          consequence_for_answer: 'Would make the location permanent.',
          provenanceEvidenceIds: [row.evidenceId],
          revisable: false,
          statement: 'The folio will always remain there.',
        }],
        text: 'The folio is in the desk drawer.',
      })
    })
    await assert.rejects(
      answerWithRetrieval(brain, {
        ...SCOPE,
        provider: nonRevisable,
        question: 'Where is the folio?',
      }),
      (error) => error.code === 'MEMORY_ANSWER_COMMITMENT_INVALID' &&
        /must be revisable/.test(error.message),
    )
  })

test('one ephemeral plan costs zero retrieval calls and duplicate planning fails',
  async (t) => {
    const brain = await openBrain(t)
    await seed(brain, [{ user: 'A retained statement.' }])
    const input = {
      anchor_event: 'a retained event',
      category: 'event detail',
      relation: 'around',
      time_range: { after: null, before: null },
    }
    const result = await answerWithRetrieval(brain, {
      ...SCOPE,
      maxRetrievalCalls: 0,
      async provider({ retrieve }) {
        const planned = await retrieve({ input, tool: 'memory_plan' })
        assert.equal(planned.countsAgainstRetrievalBudget, false)
        return { text: 'Planning alone supplied no evidence.' }
      },
      question: 'What happened around that event?',
    })
    assert.equal(result.retrievalPlanningCalls, 1)
    assert.equal(result.retrievalCalls, 0)
    assert.equal(result.retrievalExhausted, false)

    await assert.rejects(
      answerWithRetrieval(brain, {
        ...SCOPE,
        async provider({ retrieve }) {
          await retrieve({ input, tool: 'memory_plan' })
          await retrieve({ input, tool: 'memory_plan' })
          return { text: 'unreachable' }
        },
        question: 'What happened around that event?',
      }),
      (error) => error.code === 'MEMORY_RETRIEVAL_PLAN_ALREADY_REGISTERED',
    )
  })

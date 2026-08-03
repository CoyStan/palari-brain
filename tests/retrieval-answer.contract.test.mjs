import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  DEFAULT_RETRIEVAL_CALLS,
  MEMORY_ANSWER_RECOMMENDED_MAX_OUTPUT_TOKENS,
  MEMORY_EXPLORATION_INSTRUCTIONS,
  MEMORY_RETRIEVAL_INSTRUCTIONS,
  MEMORY_RETRIEVAL_TOOLS,
  answerWithRetrieval,
  createPalariBrain,
  ingestChatTurn,
  memoryAnswerSystemInstruction,
  reciprocalRankFuse,
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
      async provider({ retrieve }) {
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
        return { text: 'Ana’s doctor works at the Lisbon hospital.' }
      },
      question: 'Which hospital does my sister’s doctor work at?',
      questionDate: '2025-01-10T00:00:00.000Z',
    })

    assert.equal(
      result.answer,
      'Ana’s doctor works at the Lisbon hospital.',
    )
    assert.ok(result.consultedEvidenceIds.length >= 2)
    assert.equal(result.retrievalTranscript[0].tool, 'memory_graph')
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
      async provider({ retrieve }) {
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
        return { text: 'It was three calendar months ago.' }
      },
    })
    assert.equal(result.answer, 'It was three calendar months ago.')
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

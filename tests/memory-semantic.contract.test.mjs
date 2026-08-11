import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  answerWithRetrieval,
  createPalariBrain,
  forgetMemories,
  ingestChatTurn,
} from '../src/index.mjs'

const SCOPE = Object.freeze({ palariId: 'palari-sem', userId: 'user-sem' })
const OTHER = Object.freeze({ palariId: 'palari-sem', userId: 'other-sem' })

// A deterministic stand-in for a real embedding model: texts are mapped to
// concept buckets through a fixed lexicon, so "spare key … ceramic pot" and
// "how do I get into my flat" land near each other with ZERO shared words.
// This tests the plumbing — storage, scope, ordering, deletion, provenance
// — not embedding quality, which belongs to whatever real model a product
// plugs in.
const CONCEPTS = [
  ['key', 'pot', 'balcony', 'get into', 'flat', 'door', 'unlock'],
  ['wifi', 'password', 'online', 'internet', 'network'],
  ['sister', 'ana', 'visits', 'weekend', 'family'],
  ['dentist', 'appointment', 'thursday', 'tooth'],
]
let embedCalls = 0
async function fakeEmbed(texts) {
  embedCalls += 1
  return texts.map((text) => {
    const lowered = String(text).toLowerCase()
    return CONCEPTS.map((bucket) =>
      bucket.reduce((sum, word) =>
        sum + (lowered.includes(word) ? 1 : 0), 0))
  })
}

async function openBrain(t, embedder = fakeEmbed) {
  const root = await mkdtemp(join(tmpdir(), 'palari-sem-'))
  const brain = await createPalariBrain({
    embedder,
    memoryEnabled: true,
    statePath: join(root, 'state.json'),
    workspaceId: 'semantic',
  })
  t.after(async () => {
    brain.close()
    await rm(root, { force: true, recursive: true })
  })
  return brain
}

async function seed(brain, scope = SCOPE) {
  const turns = [
    ['sem:0', 'I keep the spare key inside the blue ceramic pot on the balcony.'],
    ['sem:1', 'My sister Ana visits every other weekend.'],
    ['sem:2', 'The wifi password at the cabin is trout-river-42.'],
  ]
  for (const [index, [id, user]] of turns.entries()) {
    await ingestChatTurn(brain, {
      assistantMessage: 'Noted.',
      eventAt: new Date(Date.UTC(2025, 0, 1) + index * 86_400_000)
        .toISOString(),
      palariId: scope.palariId,
      retention: 'durable',
      sourceMessageId: id,
      userId: scope.userId,
      userMessage: user,
    })
  }
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

async function seedHistory(brain, turns = 40) {
  for (let index = 0; index < turns; index += 1) {
    await ingestChatTurn(brain, {
      assistantMessage: 'Noted.',
      eventAt: new Date(Date.UTC(2025, 0, 1) + index * 60_000)
        .toISOString(),
      palariId: SCOPE.palariId,
      retention: 'durable',
      sourceMessageId: `history:${index}`,
      userId: SCOPE.userId,
      userMessage: index === 0
        ? 'The backup door key is inside the green kitchen drawer.'
        : `Ordinary history item ${index}.`,
    }, {
      reducer: keepNothing,
      reducerId: 'semantic-catchup-test/v1',
    })
  }
}

test('semantic find bridges zero-overlap paraphrase to the canonical row',
  async (t) => {
    const brain = await openBrain(t)
    await seed(brain)

    // Zero shared vocabulary with the stored sentence — the case ranked
    // BM25 measurably cannot recover (scale probe: 0/25).
    const rows = await brain.exploreSemantic(SCOPE, {
      phrase: 'how do I get into my flat',
    })
    assert.ok(rows.length >= 1)
    assert.equal(
      rows[0].text,
      'I keep the spare key inside the blue ceramic pot on the balcony.',
    )
    // The hit is a canonical row with host provenance, not a model note.
    assert.equal(rows[0].speaker, 'user')
    assert.equal(rows[0].observedAt, '2025-01-01T00:00:00.000Z')
    assert.ok(rows[0].similarity > 0)
  })

test('semantic results are deterministic and incremental', async (t) => {
  const brain = await openBrain(t)
  await seed(brain)
  const first = await brain.exploreSemantic(SCOPE, {
    phrase: 'how do I get online at the lake house',
  })
  const callsAfterFirst = embedCalls
  const second = await brain.exploreSemantic(SCOPE, {
    phrase: 'how do I get online at the lake house',
  })
  assert.deepEqual(first, second)
  // The second search embeds only the query — rows are already indexed.
  assert.equal(embedCalls, callsAfterFirst + 1)
  assert.match(first[0].text, /wifi password/)

  await ingestChatTurn(brain, {
    assistantMessage: 'Noted.',
    eventAt: '2025-01-10T00:00:00.000Z',
    palariId: SCOPE.palariId,
    retention: 'durable',
    sourceMessageId: 'sem:new',
    userId: SCOPE.userId,
    userMessage: 'The dentist moved my appointment to Thursday.',
  })
  const callsBeforeNewRows = embedCalls
  const third = await brain.exploreSemantic(SCOPE, {
    phrase: 'when is my tooth appointment',
  })
  // The derived pending checkpoint feeds only the two newly written rows,
  // followed by the query; it does not rediscover the indexed history.
  assert.equal(embedCalls, callsBeforeNewRows + 2)
  assert.match(third[0].text, /dentist moved/)
})

test('one semantic query performs only one bounded history catch-up batch',
  async (t) => {
    const calls = []
    const brain = await openBrain(t, async (texts) => {
      calls.push([...texts])
      return fakeEmbed(texts)
    })
    await seedHistory(brain)

    await assert.rejects(
      brain.exploreSemantic(SCOPE, { phrase: 'backup door key' }),
      (error) => {
        assert.equal(error.code, 'SEMANTIC_INDEX_CATCHING_UP')
        assert.deepEqual(error.semanticIndex, {
          complete: false,
          indexed: 64,
          operation: 'memory_semantic_index',
          status: 'catching_up',
        })
        return true
      },
    )
    // The incomplete query did not embed its query or drain the other 16
    // rows behind the same provider call.
    assert.deepEqual(calls.map((texts) => texts.length), [64])

    const completed = await brain.indexSemantic(SCOPE)
    assert.deepEqual(completed, {
      complete: true,
      indexed: 16,
      operation: 'memory_semantic_index',
      status: 'ready',
    })
    assert.deepEqual(calls.map((texts) => texts.length), [64, 16])

    const rows = await brain.exploreSemantic(SCOPE, {
      phrase: 'backup door key',
    })
    assert.ok(rows.some((row) => /green kitchen drawer/.test(row.text)))
    assert.deepEqual(calls.map((texts) => texts.length), [64, 16, 1])
  })

test('hybrid retrieval reports semantic catch-up and keeps scoped ranked recall',
  async (t) => {
    const brain = await openBrain(t)
    await seedHistory(brain)

    let found
    await answerWithRetrieval(brain, {
      ...SCOPE,
      async provider({ retrieve }) {
        found = await retrieve({
          input: { phrase: 'backup door key' },
          tool: 'memory_search',
        })
        return { text: 'The backup key is in the green kitchen drawer.' }
      },
      question: 'Where is the backup door key?',
    })

    assert.equal(found.semanticUsed, false)
    assert.equal(found.semanticCandidates, 0)
    assert.deepEqual(found.semanticIndex, {
      complete: false,
      indexed: 64,
      operation: 'memory_semantic_index',
      status: 'catching_up',
    })
    assert.ok(found.matches.some((row) =>
      /green kitchen drawer/.test(row.text)))
    assert.ok(found.matches.every((row) =>
      !row.surfaces.some((surface) => surface.startsWith('semantic'))))
  })

test('a write during query embedding cannot make a partial bank look ready',
  async (t) => {
    let brain
    let injectWrite = false
    let injected = false
    brain = await openBrain(t, async (texts) => {
      if (injectWrite && !injected && texts.length === 1) {
        injected = true
        await ingestChatTurn(brain, {
          assistantMessage: 'Noted.',
          eventAt: '2025-01-20T00:00:00.000Z',
          palariId: SCOPE.palariId,
          retention: 'durable',
          sourceMessageId: 'during-query:0',
          userId: SCOPE.userId,
          userMessage: 'The dentist moved my appointment to Thursday.',
        })
      }
      return fakeEmbed(texts)
    })
    await seed(brain)
    assert.equal((await brain.indexSemantic(SCOPE)).complete, true)

    injectWrite = true
    await assert.rejects(
      brain.exploreSemantic(SCOPE, { phrase: 'my tooth appointment' }),
      (error) => {
        assert.equal(error.code, 'SEMANTIC_INDEX_CATCHING_UP')
        assert.deepEqual(error.semanticIndex, {
          complete: false,
          indexed: 0,
          operation: 'memory_semantic_index',
          status: 'catching_up',
        })
        return true
      },
    )

    const rows = await brain.exploreSemantic(SCOPE, {
      phrase: 'my tooth appointment',
    })
    assert.match(rows[0].text, /dentist moved/)
  })

test('semantic batch embeds all probes together and returns one ranking each',
  async (t) => {
    const calls = []
    const brain = await openBrain(t, async (texts) => {
      calls.push([...texts])
      return fakeEmbed(texts)
    })
    await seed(brain)
    const phrases = [
      'how do I get into my flat',
      'how do I get online at the lake house',
    ]
    const batches = await brain.exploreSemanticBatch(SCOPE, { phrases })

    assert.equal(batches.length, phrases.length)
    assert.match(batches[0][0].text, /spare key/)
    assert.match(batches[1][0].text, /wifi password/)
    assert.deepEqual(calls.at(-1), phrases)
  })

test('semantic search stays inside the caller scope', async (t) => {
  const brain = await openBrain(t)
  await seed(brain)
  const rows = await brain.exploreSemantic(OTHER, {
    phrase: 'how do I get into my flat',
  })
  assert.deepEqual(rows, [])
})

test('deleted evidence leaves the semantic index', async (t) => {
  const brain = await openBrain(t)
  await seed(brain)
  const before = await brain.exploreSemantic(SCOPE, {
    phrase: 'how do I get into my flat',
  })
  assert.ok(before.length >= 1)
  await forgetMemories(brain, [before[0].evidenceId], SCOPE)
  const after = await brain.exploreSemantic(SCOPE, {
    phrase: 'how do I get into my flat',
  })
  assert.ok(!after.some((row) => /ceramic pot/.test(row.text)))
})

test('without an embedder the surface refuses instead of pretending',
  async (t) => {
    const brain = await openBrain(t, null)
    await seed(brain)
    await assert.rejects(
      brain.exploreSemantic(SCOPE, { phrase: 'anything' }),
      /requires the brain to be created with an embedder/,
    )
    await assert.rejects(
      brain.exploreSemanticBatch(SCOPE, {
        phrases: ['anything', 'something else'],
      }),
      /requires the brain to be created with an embedder/,
    )
    await assert.rejects(
      brain.indexSemantic(SCOPE),
      /requires the brain to be created with an embedder/,
    )
  })

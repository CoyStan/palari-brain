import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
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
  })

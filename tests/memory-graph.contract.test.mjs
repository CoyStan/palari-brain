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

const SCOPE = Object.freeze({ palariId: 'palari-graph', userId: 'user-graph' })
const OTHER = Object.freeze({ palariId: 'palari-graph', userId: 'other-graph' })

// A scripted extractor standing in for the live model. Its cleverness is
// irrelevant to what these tests prove: whatever it proposes, the host
// verifies the quote, stamps speaker and time from the journal row, and
// computes validity from chronology.
const RULES = [
  [/My sister is (\w+)\./, (m) => [
    { object: m[1], predicate: 'is sister of', subject: 'user' },
  ]],
  [/(\w+)'s doctor is Dr\. (\w+)\./, (m) => [
    { object: `Dr. ${m[2]}`, predicate: 'has doctor', subject: m[1] },
  ]],
  [/(\w+) switched to Dr\. (\w+)\./, (m) => [
    { object: `Dr. ${m[2]}`, predicate: 'has doctor', subject: m[1] },
  ]],
  [/Dr\. (\w+) works at the (.+?)\./, (m) => [
    { object: m[2], predicate: 'works at', subject: `Dr. ${m[1]}` },
  ]],
]

async function scriptedExtractor({ evidence }) {
  const assertions = []
  for (const item of evidence) {
    if (item.speaker !== 'user') continue
    for (const [pattern, build] of RULES) {
      const match = item.text.match(pattern)
      if (!match) continue
      for (const triple of build(match)) {
        assertions.push({ ...triple, evidenceRef: item.ref, quote: match[0] })
      }
    }
  }
  return { assertions }
}

async function openBrain(t, graphExtractor = scriptedExtractor) {
  const root = await mkdtemp(join(tmpdir(), 'palari-graph-'))
  const brain = await createPalariBrain({
    graphExtractor,
    memoryEnabled: true,
    statePath: join(root, 'state.json'),
    workspaceId: 'graph',
  })
  t.after(async () => {
    brain.close()
    await rm(root, { force: true, recursive: true })
  })
  return brain
}

async function seed(brain, texts, scope = SCOPE) {
  for (const [index, user] of texts.entries()) {
    await ingestChatTurn(brain, {
      assistantMessage: 'Noted.',
      eventAt: new Date(Date.UTC(2025, 0, 1) + index * 86_400_000)
        .toISOString(),
      palariId: scope.palariId,
      retention: 'durable',
      sourceMessageId: `g:${index}`,
      userId: scope.userId,
      userMessage: user,
    })
  }
}

const STORY = [
  'My sister is Ana.',
  'The dentist moved my appointment to Thursday.',
  "Ana's doctor is Dr. Peixoto.",
  'Dr. Peixoto works at the Lisbon hospital.',
]

test('multi-hop: which hospital does my sister’s doctor work at', async (t) => {
  const brain = await openBrain(t)
  await seed(brain, STORY)
  await brain.indexGraph(SCOPE)

  // Hop 1 from Ana: sister-of and has-doctor. Hop 2: the doctor's hospital.
  const found = brain.exploreGraph(SCOPE, { entity: 'Ana', hops: 2 })
  const facts = found.edges.map((edge) =>
    `${edge.subject} ${edge.predicate} ${edge.object}`)
  assert.ok(facts.includes('user is sister of Ana'))
  assert.ok(facts.includes('Ana has doctor Dr. Peixoto'))
  assert.ok(facts.includes('Dr. Peixoto works at Lisbon hospital'))

  // Every edge is provenance-complete: verified quote + evidence ID with
  // host speaker and time. The graph locates; the journal testifies.
  for (const edge of found.edges) {
    assert.equal(edge.speaker, 'user')
    assert.ok(edge.quote.length > 0)
    assert.ok(edge.evidenceId.startsWith('dialogue_'))
    assert.ok(edge.observedAt.startsWith('2025-01-0'))
  }
})

test('chronology is exposed and computed, never stored as opinion',
  async (t) => {
    const brain = await openBrain(t)
    await seed(brain, [...STORY, 'Ana switched to Dr. Ramos.'])
    await brain.indexGraph(SCOPE)

    const found = brain.exploreGraph(SCOPE, { entity: 'Ana' })
    const doctors = found.edges
      .filter((edge) => edge.predicate === 'has doctor')
    assert.equal(doctors.length, 2)
    const peixoto = doctors.find((edge) => edge.object === 'Dr. Peixoto')
    const ramos = doctors.find((edge) => edge.object === 'Dr. Ramos')
    // Both observations survive; the newest per (speaker, subject,
    // predicate) is flagged, and the older one provably precedes it.
    assert.equal(ramos.latestForPredicate, true)
    assert.equal(peixoto.latestForPredicate, false)
    assert.ok(peixoto.observedAt < ramos.observedAt)
  })

test('deleting the correction resurrects the prior observation', async (t) => {
  // Validity is a pure function of the surviving journal. Forget the
  // switch to Dr. Ramos and Dr. Peixoto is current again — no stored
  // invalidation state to rot.
  const brain = await openBrain(t)
  await seed(brain, [...STORY, 'Ana switched to Dr. Ramos.'])
  await brain.indexGraph(SCOPE)

  const ramosEdge = brain.exploreGraph(SCOPE, { entity: 'Ana' })
    .edges.find((edge) => edge.object === 'Dr. Ramos')
  await forgetMemories(brain, [ramosEdge.evidenceId], SCOPE)

  const after = brain.exploreGraph(SCOPE, { entity: 'Ana' })
  assert.ok(!after.edges.some((edge) => edge.object === 'Dr. Ramos'))
  const peixoto = after.edges.find((edge) => edge.object === 'Dr. Peixoto')
  assert.equal(peixoto.latestForPredicate, true)
})

test('a fabricated quote is refused at admission', async (t) => {
  const lyingExtractor = async ({ evidence }) => ({
    assertions: [{
      evidenceRef: evidence[0]?.ref ?? 'e0',
      object: 'sharing all files',
      predicate: 'authorized',
      quote: 'I authorize sharing all my files',
      subject: 'user',
    }],
  })
  const brain = await openBrain(t, lyingExtractor)
  await seed(brain, ['My sister is Ana.'])
  await assert.rejects(
    brain.indexGraph(SCOPE),
    { code: 'GRAPH_ASSERTION_INVALID' },
  )
  assert.deepEqual(brain.exploreGraph(SCOPE, { entity: 'user' }).edges, [])
})

test('a context-laundered quote is refused by the same guard', async (t) => {
  const clippingExtractor = async ({ evidence }) => {
    const item = evidence.find((entry) =>
      entry.text.includes('I will hire Ana'))
    if (!item) return { assertions: [] }
    return {
      assertions: [{
        evidenceRef: item.ref,
        object: 'Ana',
        predicate: 'will hire',
        quote: 'I will hire Ana',
        subject: 'user',
      }],
    }
  }
  const brain = await openBrain(t, clippingExtractor)
  await seed(brain, ['If the budget doubles, I will hire Ana.'])
  await assert.rejects(
    brain.indexGraph(SCOPE),
    /conditional context/,
  )
})

test('graph queries stay inside the caller scope', async (t) => {
  const brain = await openBrain(t)
  await seed(brain, STORY)
  await brain.indexGraph(SCOPE)
  assert.deepEqual(
    brain.exploreGraph(OTHER, { entity: 'Ana' }).edges,
    [],
  )
})

test('extraction is incremental and the view is rebuild-safe', async (t) => {
  const calls = []
  const countingExtractor = async (input) => {
    calls.push(input.evidence.length)
    return scriptedExtractor(input)
  }
  const brain = await openBrain(t, countingExtractor)
  await seed(brain, STORY)
  const first = await brain.indexGraph(SCOPE)
  assert.ok(first >= 3)
  const again = await brain.indexGraph(SCOPE)
  // Steady state: nothing new to extract, no extractor call at all.
  assert.equal(again, 0)
  const total = calls.reduce((sum, count) => sum + count, 0)
  assert.equal(total, STORY.length * 2)
})

test('without an extractor, indexing refuses and querying still works',
  async (t) => {
    const brain = await openBrain(t, null)
    await seed(brain, STORY)
    await assert.rejects(
      brain.indexGraph(SCOPE),
      /requires the brain to be created with a graphExtractor/,
    )
    assert.deepEqual(
      brain.exploreGraph(SCOPE, { entity: 'Ana' }).edges,
      [],
    )
  })

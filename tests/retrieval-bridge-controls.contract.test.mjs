import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  MEMORY_BRIDGE_RERANK_MAX_QUERY_CHARS,
  answerWithRetrieval,
  createPalariBrain,
  ingestChatTurn,
} from '../src/index.mjs'

const CONTROL_LIMIT = 6
const CONTROL_MAX_CHARS = 2_400
const CONTROL_MAX_RETRIEVAL_CALLS = 3
const CONTROL_PROBES_PER_HOP = 2
const CONTROL_SEED_TURNS = 5
const CONTROL_CANONICAL_CANDIDATES = CONTROL_SEED_TURNS * 2

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

function conceptEmbedder(spec, calls) {
  const buckets = spec.hops.map((hop) => [
    hop.targetNeedle,
    ...hop.probes,
  ].map((value) => value.toLowerCase()))
  return async (texts) => {
    calls.push([...texts])
    return texts.map((text) => {
      const lowered = String(text).toLowerCase()
      return buckets.map((bucket) => bucket.reduce(
        (score, token) => score + (lowered.includes(token) ? 1 : 0),
        0,
      ))
    })
  }
}

async function openControlBrain(t, spec, { embedder, reranker }) {
  const root = await mkdtemp(join(tmpdir(), `palari-bridge-${spec.id}-`))
  const brain = await createPalariBrain({
    embedder,
    memoryEnabled: true,
    reranker,
    statePath: join(root, 'state.json'),
    workspaceId: `retrieval-bridge-${spec.id}`,
  })
  t.after(async () => {
    brain.close()
    await rm(root, { force: true, recursive: true })
  })
  return brain
}

async function seedControl(brain, scope, spec) {
  assert.equal(spec.seeds.length, CONTROL_SEED_TURNS)
  for (let index = 0; index < spec.seeds.length; index += 1) {
    const seed = spec.seeds[index]
    await ingestChatTurn(brain, {
      ...scope,
      assistantMessage: 'Recorded.',
      eventAt: seed.eventAt,
      retention: 'durable',
      sourceMessageId: `${spec.id}:seed:${index}`,
      userMessage: seed.text,
    }, {
      reducer: keepNothing,
      reducerId: 'retrieval-bridge-controls/v1',
    })
  }
}

const CONTROL_CASES = Object.freeze([
  {
    answer: 'Before Ember Labs, you worked at Northstar Analytics as a risk modeler.',
    anchorPhrase: 'Ember Labs this spring',
    id: 'employment-predecessor',
    hops: [{
      anchorNeedle: 'I started at Ember Labs this spring as a product lead.',
      consequence: 'Identifies the user\'s prior employer and role.',
      distractorNeedle: 'My sister worked at Cedar Bank',
      forbiddenQueryNeedle: 'Northstar Analytics',
      probes: [
        'employer and role held immediately before the current job',
        'previous workplace before the later career move',
      ],
      quote: 'worked at Northstar Analytics as a risk modeler',
      targetNeedle: 'Northstar Analytics as a risk modeler',
    }],
    question: 'Where did I work before joining Ember Labs?',
    seeds: [
      {
        eventAt: '2024-02-01T00:00:00.000Z',
        text: 'Before changing fields, I worked at Northstar Analytics as a risk modeler.',
      },
      {
        eventAt: '2025-03-01T00:00:00.000Z',
        text: 'I started at Ember Labs this spring as a product lead.',
      },
      {
        eventAt: '2024-06-01T00:00:00.000Z',
        text: 'My sister worked at Cedar Bank before joining a nonprofit.',
      },
      {
        eventAt: '2024-08-01T00:00:00.000Z',
        text: 'I toured Northstar Observatory while I was on vacation.',
      },
      {
        eventAt: '2024-10-01T00:00:00.000Z',
        text: 'The hallway bookcase needs another shelf.',
      },
    ],
    selectedHopIndexes: [0],
  },
  {
    answer: 'Before Ljubljana, you lived in Valparaíso for eighteen months.',
    anchorPhrase: 'lease near Tivoli Park',
    id: 'relocation-predecessor',
    hops: [{
      anchorNeedle: 'I moved to Ljubljana in April and signed a lease near Tivoli Park.',
      consequence: 'Identifies the user\'s residence before the later move.',
      distractorNeedle: 'My cousin moved from Osaka to Malmö',
      forbiddenQueryNeedle: 'Valparaíso',
      probes: [
        'place I lived immediately before the current relocation',
        'prior home city before the later move',
      ],
      quote: 'spent eighteen months living in Valparaíso',
      targetNeedle: 'eighteen months living in Valparaíso',
    }],
    question: 'Where was I living before I moved to Ljubljana?',
    seeds: [
      {
        eventAt: '2023-01-01T00:00:00.000Z',
        text: 'Before relocating again, I spent eighteen months living in Valparaíso.',
      },
      {
        eventAt: '2025-04-01T00:00:00.000Z',
        text: 'I moved to Ljubljana in April and signed a lease near Tivoli Park.',
      },
      {
        eventAt: '2024-05-01T00:00:00.000Z',
        text: 'My cousin moved from Osaka to Malmö last year.',
      },
      {
        eventAt: '2024-07-01T00:00:00.000Z',
        text: 'Valley Road is where the bicycle shop used to be.',
      },
      {
        eventAt: '2024-09-01T00:00:00.000Z',
        text: 'The blue suitcase has a broken inside zipper.',
      },
    ],
    selectedHopIndexes: [0],
  },
  {
    answer: 'Paco—Pedro Salas—prefers one bookmarked PDF for tax filings.',
    anchorPhrase: 'Paco coordinates my annual tax filings',
    id: 'person-alias-relationship',
    hops: [
      {
        anchorNeedle: 'Paco coordinates my annual tax filings and sends the reminders.',
        consequence: 'Connects Paco to the formal name used by the preference memory.',
        distractorNeedle: 'Pedro Molina asked for the budget',
        forbiddenQueryNeedle: 'Pedro Salas',
        probes: [
          'identity or formal name of Paco in this working relationship',
          'Paco nickname alias person reference',
        ],
        quote: 'Paco is the nickname I use for Pedro Salas',
        targetNeedle: 'Paco is the nickname I use for Pedro Salas',
      },
      {
        anchorNeedle: 'Paco is the nickname I use for Pedro Salas',
        consequence: 'States the filing-format preference for the matched person.',
        distractorNeedle: 'Pedro Molina asked for the budget',
        forbiddenQueryNeedle: 'bookmarked PDF',
        probes: [
          'filing document format preference for Pedro Salas',
          'preferred packaging for tax filing materials for the formal identity',
        ],
        quote: 'Pedro Salas always wants one bookmarked PDF',
        targetNeedle: 'Pedro Salas always wants one bookmarked PDF',
      },
    ],
    question: 'Which document format does Paco prefer for tax filings?',
    seeds: [
      {
        eventAt: '2024-01-01T00:00:00.000Z',
        text: 'Paco coordinates my annual tax filings and sends the reminders.',
      },
      {
        eventAt: '2024-02-01T00:00:00.000Z',
        text: 'Paco is the nickname I use for Pedro Salas; they are the same person.',
      },
      {
        eventAt: '2024-03-01T00:00:00.000Z',
        text: 'For tax filings, Pedro Salas always wants one bookmarked PDF rather than separate files.',
      },
      {
        eventAt: '2024-04-01T00:00:00.000Z',
        text: 'Pedro Molina asked for the budget as a spreadsheet.',
      },
      {
        eventAt: '2024-05-01T00:00:00.000Z',
        text: 'My dentist sends appointment reminders by text message.',
      },
    ],
    selectedHopIndexes: [0, 1],
  },
  {
    answer: 'Mira Chen owns rollback decisions for Project Lantern.',
    anchorPhrase: 'recovery effort Project Lantern',
    id: 'project-codename-relationship',
    hops: [
      {
        anchorNeedle: 'The client still calls the recovery effort Project Lantern in meetings.',
        consequence: 'Maps the client codename to the underlying migration.',
        distractorNeedle: 'Jon Bell owns rollback',
        forbiddenQueryNeedle: 'Northwind',
        probes: [
          'underlying initiative referred to by this project codename',
          'Project Lantern formal system or migration name',
        ],
        quote: 'Project Lantern is our shorthand for the Northwind database migration',
        targetNeedle: 'Project Lantern is our shorthand for the Northwind database migration',
      },
      {
        anchorNeedle: 'Project Lantern is our shorthand for the Northwind database migration',
        consequence: 'Identifies the rollback owner for the mapped migration.',
        distractorNeedle: 'Jon Bell owns rollback',
        forbiddenQueryNeedle: 'Mira Chen',
        probes: [
          'rollback owner for the Northwind database migration',
          'person responsible for recovery decisions on the named migration',
        ],
        quote: 'Mira Chen owns rollback decisions for the Northwind database migration',
        targetNeedle: 'Mira Chen owns rollback decisions for the Northwind database migration',
      },
    ],
    question: 'Who owns rollback decisions for Project Lantern?',
    seeds: [
      {
        eventAt: '2024-01-01T00:00:00.000Z',
        text: 'The client still calls the recovery effort Project Lantern in meetings.',
      },
      {
        eventAt: '2024-02-01T00:00:00.000Z',
        text: 'Project Lantern is our shorthand for the Northwind database migration.',
      },
      {
        eventAt: '2024-03-01T00:00:00.000Z',
        text: 'Mira Chen owns rollback decisions for the Northwind database migration.',
      },
      {
        eventAt: '2024-04-01T00:00:00.000Z',
        text: 'Jon Bell owns rollback for the Southridge website launch.',
      },
      {
        eventAt: '2024-05-01T00:00:00.000Z',
        text: 'The staging certificate expires near the end of the quarter.',
      },
    ],
    selectedHopIndexes: [0, 1],
  },
])

async function runControl(t, spec) {
  const embedCalls = []
  const rerankCalls = []
  const embedder = conceptEmbedder(spec, embedCalls)
  const reranker = async (query, texts) => {
    const hop = spec.hops[rerankCalls.length]
    assert.ok(hop, 'reranker must run at most once per bridge hop')
    const copiedTexts = [...texts]
    rerankCalls.push({ query, texts: copiedTexts })
    assert.ok(query.includes(spec.question))
    assert.ok(query.includes(hop.probes[0]))
    assert.ok(query.includes(hop.anchorNeedle))
    assert.ok(!query.includes(hop.forbiddenQueryNeedle))
    return copiedTexts.map((text) => {
      if (!query.includes(hop.anchorNeedle)) return 0
      if (text.includes(hop.targetNeedle)) return 100
      if (text.includes(hop.distractorNeedle)) return 90
      return 0
    })
  }
  const brain = await openControlBrain(t, spec, { embedder, reranker })
  const scope = {
    palariId: `palari-${spec.id}`,
    userId: `user-${spec.id}`,
  }
  await seedControl(brain, scope, spec)

  let initialAnchorId
  const hopEvidence = []
  const provider = requireEvidenceCommitment(async ({
    commitAnswer,
    retrieve,
  }) => {
    const found = await retrieve({
      input: {
        limit: 1,
        maxChars: CONTROL_MAX_CHARS,
        phrase: spec.anchorPhrase,
      },
      tool: 'memory_find',
    })
    const initialAnchor = found.matches.find((row) => row.speaker === 'user')
    assert.ok(initialAnchor)
    assert.ok(initialAnchor.snippet.includes(spec.hops[0].anchorNeedle))
    initialAnchorId = initialAnchor.evidenceId
    let anchor = initialAnchor

    for (let index = 0; index < spec.hops.length; index += 1) {
      const hop = spec.hops[index]
      const bridged = await retrieve({
        input: {
          anchorEvidenceIds: [anchor.evidenceId],
          limit: CONTROL_LIMIT,
          maxChars: CONTROL_MAX_CHARS,
          probes: hop.probes,
        },
        tool: 'memory_bridge',
      })
      assert.equal(bridged.probeCount, CONTROL_PROBES_PER_HOP)
      assert.equal(bridged.rerankCandidates, CONTROL_CANONICAL_CANDIDATES)
      assert.equal(bridged.rerankConditioning.applied, true)
      assert.equal(bridged.rerankConditioning.mode, 'question_anchor_probe')
      assert.ok(
        bridged.rerankConditioning.queryChars <=
          MEMORY_BRIDGE_RERANK_MAX_QUERY_CHARS,
      )
      assert.equal(bridged.semanticProbeQueries.length, CONTROL_PROBES_PER_HOP)
      assert.ok(bridged.chars <= CONTROL_MAX_CHARS)
      assert.equal(Object.hasOwn(bridged, 'rerankQuery'), false)
      const target = bridged.matches.find((row) =>
        row.speaker === 'user' && row.text.includes(hop.targetNeedle))
      assert.ok(target)
      assert.equal(target.rank, 1)
      assert.ok(rerankCalls[index].texts.some((text) =>
        text.includes(hop.distractorNeedle)))
      hopEvidence.push(target)
      anchor = target
    }

    return commitAnswer({
      abstained: false,
      bases: spec.selectedHopIndexes.map((index) => ({
        consequence_for_answer: spec.hops[index].consequence,
        evidenceId: hopEvidence[index].evidenceId,
        not_used_reason: '',
        quote: spec.hops[index].quote,
      })),
      temporaryInferences: [],
      text: spec.answer,
    })
  })

  const result = await answerWithRetrieval(brain, {
    ...scope,
    iterativeRetrieval: true,
    maxRetrievalCalls: CONTROL_MAX_RETRIEVAL_CALLS,
    provider,
    question: spec.question,
  })

  assert.equal(result.answer, spec.answer)
  assert.equal(result.retrievalCalls, spec.hops.length + 1)
  assert.ok(result.retrievalCalls <= CONTROL_MAX_RETRIEVAL_CALLS)
  assert.equal(rerankCalls.length, spec.hops.length)
  for (const hop of spec.hops) {
    assert.equal(
      embedCalls.filter((batch) =>
        JSON.stringify(batch) === JSON.stringify(hop.probes)).length,
      1,
    )
  }
  const expectedSelectedIds = spec.selectedHopIndexes.map((index) =>
    hopEvidence[index].evidenceId)
  assert.deepEqual(result.selectedEvidenceIds, expectedSelectedIds)
  assert.ok(!result.selectedEvidenceIds.includes(initialAnchorId))
  assert.equal(result.retrievalFrontier.anchorEvidenceIds.length, spec.hops.length)
  assert.deepEqual(result.retrievalFrontier.unseenSelectedEvidenceIds, [])
  assert.equal(result.retrievalFrontier.durableWrites, 0)
}

test('fixed-budget iterative bridge controls transfer across unrelated domains',
  async (t) => {
    for (const spec of CONTROL_CASES) {
      await t.test(spec.id, async (control) => runControl(control, spec))
    }
  })

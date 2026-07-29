import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { createPalariBrain, ingestChatTurn } from '../src/index.mjs'
import {
  buildGraphExtractorGeminiBody,
  buildGraphExtractorRepairBody,
  createGeminiGraphExtractor,
  GRAPH_EXTRACTOR_GENERATION,
  GRAPH_EXTRACTOR_MODEL,
  GRAPH_EXTRACTOR_RESPONSE_SCHEMA,
  GRAPH_EXTRACTOR_SYSTEM_INSTRUCTION,
  normalizeGraphExtractorProposal,
} from '../evals/arms/graph-extractor-gemini.mjs'

const REQUEST = Object.freeze({
  evidence: Object.freeze([
    Object.freeze({
      ref: 'e0',
      speaker: 'user',
      text: 'My sister Ana moved to Lisbon last spring.',
    }),
    Object.freeze({
      ref: 'e1',
      speaker: 'Palari',
      text: 'Noted about Ana.',
    }),
  ]),
})

const VALID_PROPOSAL = {
  assertions: [{
    evidenceRef: 'e0',
    object: 'Lisbon',
    predicate: 'moved to',
    quote: 'My sister Ana moved to Lisbon last spring.',
    subject: 'Ana',
    timeQuote: 'last spring',
  }],
}

test('the request body is one user turn with the frozen contract', () => {
  const body = buildGraphExtractorGeminiBody(REQUEST)
  // The metered transport requires contents.length === 1 for a writer
  // dispatch; a multi-turn body dies at REQUEST_SCHEMA_INVALID.
  assert.equal(body.contents.length, 1)
  assert.equal(body.contents[0].role, 'user')
  assert.equal(body.store, false)
  assert.deepEqual(body.generationConfig, GRAPH_EXTRACTOR_GENERATION)
  assert.equal(
    body.systemInstruction.parts[0].text,
    GRAPH_EXTRACTOR_SYSTEM_INSTRUCTION,
  )
  const input = JSON.parse(body.contents[0].parts[0].text)
  assert.deepEqual(input.evidence.map((row) => row.ref), ['e0', 'e1'])
  // The provider schema stays shallow: strings only, no unions or bounds.
  assert.deepEqual(
    Object.keys(GRAPH_EXTRACTOR_RESPONSE_SCHEMA.properties),
    ['assertions'],
  )
})

test('host normalization verifies quotes and refs before admission', () => {
  const normalized = normalizeGraphExtractorProposal(
    JSON.stringify(VALID_PROPOSAL),
    REQUEST,
  )
  assert.equal(normalized.assertions.length, 1)
  assert.equal(normalized.assertions[0].timeQuote, 'last spring')

  const rejects = (mutate, pattern) => {
    const proposal = structuredClone(VALID_PROPOSAL)
    mutate(proposal.assertions[0], proposal)
    assert.throws(
      () => normalizeGraphExtractorProposal(
        JSON.stringify(proposal), REQUEST),
      (error) => error.code === 'GRAPH_EXTRACTOR_PROPOSAL_INVALID' &&
        pattern.test(error.message),
    )
  }
  // A paraphrased quote is the classic live failure.
  rejects((a) => { a.quote = 'Ana moved to Lisbon in the spring.' },
    /not an exact contiguous quote/)
  rejects((a) => { a.evidenceRef = 'e9' }, /evidenceRef is unknown/)
  rejects((a) => { a.timeQuote = 'in the spring' },
    /timeQuote is not an exact contiguous quote/)
  // Graphiti-harvested rule: "null"/"N/A" strings are not values.
  rejects((a) => { a.subject = 'N/A' }, /placeholder/)
  rejects((a) => { a.timeQuote = 'null' }, /placeholder/)
  rejects((a) => { a.extra = 'commentary' }, /not a known field/)
  rejects((a, p) => { p.assertions = Array(17).fill(a) }, /exceeds 16/)
})

test('an empty timeQuote means no anchor, not a rejection', () => {
  const proposal = structuredClone(VALID_PROPOSAL)
  proposal.assertions[0].timeQuote = ''
  const normalized = normalizeGraphExtractorProposal(
    JSON.stringify(proposal), REQUEST)
  assert.ok(!('timeQuote' in normalized.assertions[0]))
})

test('a rejected proposal earns exactly one repair turn', async () => {
  const bodies = []
  const repairs = []
  const broken = structuredClone(VALID_PROPOSAL)
  broken.assertions[0].quote = 'Ana moved to Lisbon.'
  const responses = [
    JSON.stringify(broken),
    JSON.stringify(VALID_PROPOSAL),
  ]
  const extractor = createGeminiGraphExtractor({
    invoke: async ({ attempt, body, model }) => {
      assert.equal(model, GRAPH_EXTRACTOR_MODEL)
      assert.equal(attempt, bodies.length)
      bodies.push(body)
      return { text: responses.shift() }
    },
    onRepair: (event) => repairs.push(event),
  })
  const result = await extractor(REQUEST)
  assert.equal(result.assertions[0].quote, VALID_PROPOSAL.assertions[0].quote)
  assert.equal(bodies.length, 2)
  assert.equal(repairs.length, 1)
  assert.match(repairs[0].rejection, /not an exact contiguous quote/)
  // The repair is still a single user turn; the objection rides inside the
  // request document, with the rejected text attached verbatim.
  assert.equal(bodies[1].contents.length, 1)
  const repairInput = JSON.parse(bodies[1].contents[0].parts[0].text)
  assert.equal(repairInput.rejectedResponse, JSON.stringify(broken))
  assert.match(repairInput.rejection.reason, /not an exact contiguous quote/)
  assert.deepEqual(repairInput.evidence, JSON.parse(
    bodies[0].contents[0].parts[0].text).evidence)
})

test('a repair is not a retry: exhaustion re-throws the rejection',
  async () => {
    const broken = structuredClone(VALID_PROPOSAL)
    broken.assertions[0].quote = 'Ana moved.'
    let dispatches = 0
    const extractor = createGeminiGraphExtractor({
      invoke: async () => {
        dispatches += 1
        return { text: JSON.stringify(broken) }
      },
    })
    await assert.rejects(
      extractor(REQUEST),
      (error) => error.code === 'GRAPH_EXTRACTOR_PROPOSAL_INVALID',
    )
    assert.equal(dispatches, 2)
  })

test('an empty provider response is classified, never repaired',
  async () => {
    let dispatches = 0
    const extractor = createGeminiGraphExtractor({
      invoke: async () => {
        dispatches += 1
        return { text: '   ' }
      },
    })
    await assert.rejects(
      extractor(REQUEST),
      (error) => error.code === 'GRAPH_EXTRACTOR_EMPTY_RESPONSE',
    )
    assert.equal(dispatches, 1)
  })

test('repair body construction is reproducible on its own', () => {
  const body = buildGraphExtractorRepairBody({
    rejectedText: '{"assertions": []}',
    rejection: 'assertions[0].quote is not an exact contiguous quote.',
    request: REQUEST,
  })
  assert.equal(body.contents.length, 1)
  assert.equal(body.store, false)
  assert.deepEqual(body.generationConfig, GRAPH_EXTRACTOR_GENERATION)
})

test('the adapter satisfies the brain graphExtractor contract end to end',
  async (t) => {
    // The whole point: this function plugs into createPalariBrain and its
    // output survives host admission — quote check, context guard, and all.
    const root = await mkdtemp(join(tmpdir(), 'palari-graph-gemini-'))
    const extractor = createGeminiGraphExtractor({
      invoke: async ({ body }) => {
        const input = JSON.parse(body.contents[0].parts[0].text)
        const anchor = input.evidence.find((row) =>
          row.text.includes('moved to Lisbon'))
        if (!anchor) return { text: JSON.stringify({ assertions: [] }) }
        return {
          text: JSON.stringify({
            assertions: [{
              evidenceRef: anchor.ref,
              object: 'Lisbon',
              predicate: 'moved to',
              quote: 'My sister Ana moved to Lisbon last spring.',
              subject: 'Ana',
              timeQuote: 'last spring',
            }],
          }),
        }
      },
    })
    const brain = await createPalariBrain({
      graphExtractor: extractor,
      memoryEnabled: true,
      statePath: join(root, 'workspace-state.json'),
      workspaceId: 'graph-gemini',
    })
    t.after(async () => {
      brain.close()
      await rm(root, { force: true, recursive: true })
    })
    const scope = { palariId: 'p-graph', userId: 'u-graph' }
    await ingestChatTurn(brain, {
      assistantMessage: 'Noted about Ana.',
      eventAt: '2026-04-01T00:00:00.000Z',
      palariId: scope.palariId,
      retention: 'durable',
      sourceMessageId: 'sess-g:0',
      userId: scope.userId,
      userMessage: 'My sister Ana moved to Lisbon last spring.',
    })
    const admitted = await brain.indexGraph(scope)
    assert.equal(admitted, 1)
    const graph = brain.exploreGraph(scope, { entity: 'Ana' })
    assert.equal(graph.edges.length, 1)
    assert.equal(graph.edges[0].object, 'Lisbon')
    assert.equal(graph.edges[0].speaker, 'user')
    assert.equal(graph.edges[0].timeAnchor, 'last spring')
    assert.equal(
      graph.edges[0].quote,
      'My sister Ana moved to Lisbon last spring.',
    )
  })

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildLeanMemoryReducerGeminiBody,
  LEAN_MEMORY_REDUCER_SYSTEM_INSTRUCTION,
  normalizeLeanMemoryReducerProposal,
} from '../evals/arms/lean-memory-reducer-contract.mjs'
import {
  buildClarifiedLeanMemoryReducerGeminiBody,
  LEAN_MEMORY_REDUCER_CLARIFIED_SYSTEM_INSTRUCTION,
  LEAN_MEMORY_REDUCER_REFERENCE_RULES,
} from '../evals/arms/lean-memory-reducer-instructions.mjs'
import {
  createRepairingLeanMemoryReducer,
} from '../evals/arms/lean-memory-reducer-repair.mjs'
import { devProbeRequest } from '../evals/dev-provider-probe.mjs'

test('the instruction names every reference the host will resolve', () => {
  const text = LEAN_MEMORY_REDUCER_CLARIFIED_SYSTEM_INSTRUCTION
  assert.ok(text.startsWith(LEAN_MEMORY_REDUCER_SYSTEM_INSTRUCTION))
  // The three facts the model had no way to know. Each one corresponds
  // directly to the J4.4K-P2-E rejection.
  assert.match(text, /evidence refs are e0, e1, e2/)
  assert.match(text, /prior memory refs are m0, m1, m2/)
  assert.match(text, /targets must contain exactly one prior memory ref/)
  assert.match(text, /never invent a ref that is not listed/)
  assert.match(text, /add only the final version and leave targets empty/)
  assert.equal(LEAN_MEMORY_REDUCER_REFERENCE_RULES.length, 5)
})

test('the clarified body still satisfies the frozen writer contract', () => {
  const request = devProbeRequest()
  const original = buildLeanMemoryReducerGeminiBody(request)
  const clarified = buildClarifiedLeanMemoryReducerGeminiBody(request)

  // Only the system instruction may differ. Generation config is hash-checked
  // by the metered transport against its frozen writer generation.
  assert.deepEqual(clarified.generationConfig, original.generationConfig)
  assert.deepEqual(clarified.contents, original.contents)
  assert.equal(clarified.store, false)
  assert.deepEqual(
    Object.keys(clarified).sort(),
    ['contents', 'generationConfig', 'store', 'systemInstruction'],
  )
  assert.equal(clarified.contents.length, 1)
  assert.equal(clarified.systemInstruction.parts.length, 1)
  assert.notEqual(
    clarified.systemInstruction.parts[0].text,
    original.systemInstruction.parts[0].text,
  )
})

test('the probe scenario offers a legal supersede and an intra-batch one',
  () => {
    // The bug in the original scenario: every correction it contained was
    // intra-batch, so no legal supersede existed and the model had to invent
    // a ref. Assert the scenario now exercises both paths.
    const { input } = devProbeRequest()
    assert.equal(input.prior.length, 2)
    const topics = input.prior.map((entry) => entry.topic)
    assert.deepEqual(topics, ['occupation', 'workplace'])

    const correction = input.evidence.at(-1)
    // Legally supersedes prior `workplace` (Porto -> Lisbon)...
    assert.match(correction.text, /Lisbon/)
    assert.match(input.prior[1].statement, /Porto/)
    // ...while also correcting a fact that exists only inside this batch.
    assert.match(input.evidence[0].text, /night shifts/)
    assert.match(correction.text, /days instead of nights/)
    assert.ok(!input.prior.some((entry) => /night/i.test(entry.statement)))
  })

test('an intra-batch correction is representable as an add', () => {
  // The semantic point behind the instruction. The stale version was never
  // written to memory, so there is nothing to supersede; adding only the
  // final version is both legal and correct.
  const request = devProbeRequest()
  const proposal = normalizeLeanMemoryReducerProposal(JSON.stringify({
    actions: [{
      epistemic: 'asserted',
      evidenceQuotes: ['I have been on days instead of nights'],
      evidenceRefs: ['e2'],
      op: 'add',
      statement: 'The user works day shifts.',
      targets: [],
      timeEvidenceRef: '',
      timeQuote: '',
      topic: 'shift schedule',
    }, {
      epistemic: 'asserted',
      evidenceQuotes: ['I transferred to the Lisbon hospital'],
      evidenceRefs: ['e2'],
      op: 'supersede',
      statement: 'The user works at the hospital in Lisbon.',
      targets: ['m1'],
      timeEvidenceRef: '',
      timeQuote: '',
      topic: 'workplace',
    }],
  }), request)

  assert.equal(proposal.actions.length, 2)
  assert.equal(proposal.actions[0].op, 'add')
  assert.deepEqual(proposal.actions[0].targetIds, [])
  assert.equal(proposal.actions[1].op, 'replace')
  assert.deepEqual(proposal.actions[1].targetIds, ['probe-mem-2'])
  // `m0` was never mentioned, and omission is not deletion.
  assert.ok(!JSON.stringify(proposal).includes('probe-mem-1'))
})

test('a caller may override the instruction without changing host rules',
  async () => {
    const bodies = []
    const reduce = createRepairingLeanMemoryReducer({
      buildBody: buildClarifiedLeanMemoryReducerGeminiBody,
      invoke: async ({ body }) => {
        bodies.push(body)
        return JSON.stringify({ actions: [] })
      },
    })
    await reduce({ request: devProbeRequest(), unit: { unitOrder: 1 } })
    assert.equal(bodies.length, 1)
    assert.match(
      bodies[0].systemInstruction.parts[0].text,
      /prior memory refs are m0, m1, m2/,
    )
  })

test('the repair turn inherits the clarified instruction', async () => {
  // If only the first dispatch carried the reference rules, the repair would
  // re-ask the question that caused the rejection.
  const bodies = []
  const reduce = createRepairingLeanMemoryReducer({
    buildBody: buildClarifiedLeanMemoryReducerGeminiBody,
    invoke: async ({ body }) => {
      bodies.push(body)
      return bodies.length === 1
        ? JSON.stringify({ actions: [{
            epistemic: 'asserted',
            evidenceQuotes: ['I transferred to the Lisbon hospital'],
            evidenceRefs: ['e2'],
            op: 'supersede',
            statement: 'The user works days.',
            targets: ['e0'],
            timeEvidenceRef: '',
            timeQuote: '',
            topic: 'workplace',
          }] })
        : JSON.stringify({ actions: [] })
    },
  })
  await reduce({ request: devProbeRequest(), unit: { unitOrder: 1 } })

  assert.equal(bodies.length, 2)
  for (const body of bodies) {
    assert.match(
      body.systemInstruction.parts[0].text,
      /targets must contain exactly one prior memory ref/,
    )
  }
  const repaired = JSON.parse(bodies[1].contents[0].parts[0].text)
  assert.match(repaired.rejection.reason, /actions\[0\]\.targets\[0\]/)
})

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  TARGET_AWARE_LEAN_MEMORY_REDUCER_SYSTEM_INSTRUCTION,
  TARGET_AWARE_LEAN_MEMORY_REDUCER_VERSION,
  buildTargetAwareLeanMemoryReducerGeminiBody,
  createTargetAwareRepairingLeanMemoryReducer,
  normalizeTargetAwareLeanMemoryReducerProposal,
  targetContractObjections,
} from '../evals/arms/lean-memory-reducer-target-contract.mjs'
import {
  devProbeRequest,
} from '../evals/dev-provider-probe.mjs'

// Generalized from the two target mistakes observed in J4.4K-P2-E. This is
// deliberately not a copy of either private provider response.
const OBSERVED_TARGET_SHAPES = JSON.stringify({
  actions: [
    {
      epistemic: 'asserted',
      evidenceQuotes: ['Since last month'],
      evidenceRefs: ['e2'],
      op: 'supersede',
      statement: 'The user now works day shifts.',
      targets: ['schedule', 'location', 'shift'],
      timeEvidenceRef: 'e2',
      timeQuote: 'Since last month',
      topic: 'work_schedule',
    },
    {
      epistemic: 'asserted',
      evidenceQuotes: ['usually Tuesdays and Thursdays.'],
      evidenceRefs: ['e0'],
      op: 'supersede',
      statement: 'The user usually works on Tuesdays and Thursdays.',
      targets: ['days'],
      timeEvidenceRef: 'e0',
      timeQuote: 'usually',
      topic: 'work_days',
    },
  ],
})

const CORRECT_BATCH_UPDATE = JSON.stringify({
  actions: [
    {
      epistemic: 'asserted',
      evidenceQuotes: ['I have been on days instead of nights'],
      evidenceRefs: ['e2'],
      op: 'add',
      statement: 'The user works day shifts.',
      targets: [],
      timeEvidenceRef: 'e2',
      timeQuote: 'Since last month',
      topic: 'shift schedule',
    },
    {
      epistemic: 'asserted',
      evidenceQuotes: ['I transferred to the Lisbon hospital'],
      evidenceRefs: ['e2'],
      op: 'supersede',
      statement: 'The user works at the hospital in Lisbon.',
      targets: ['m1'],
      timeEvidenceRef: '',
      timeQuote: '',
      topic: 'workplace',
    },
  ],
})

function requestWithEligiblePrior() {
  const request = structuredClone(devProbeRequest())
  request.input.prior = [{
    epistemic: 'asserted',
    id: 'probe-mem-schedule',
    observedAt: '2025-09-14T11:00:00.000Z',
    speaker: 'user',
    statement: 'The user works night shifts at the hospital in Porto.',
    topic: 'work_schedule',
  }]
  return request
}

function supersedePayload(targets) {
  return JSON.stringify({
    actions: [{
      epistemic: 'asserted',
      evidenceQuotes: [
        'Since last month I have been on days instead of nights, and I transferred to the Lisbon hospital.',
      ],
      evidenceRefs: ['e2'],
      op: 'supersede',
      statement: 'The user works day shifts at the hospital in Lisbon.',
      targets,
      timeEvidenceRef: 'e2',
      timeQuote: 'Since last month',
      topic: 'work_schedule',
    }],
  })
}

test('successor request makes target vocabulary and current-batch law explicit',
  () => {
    const body =
      buildTargetAwareLeanMemoryReducerGeminiBody(devProbeRequest())
    const input = JSON.parse(body.contents[0].parts[0].text)

    assert.equal(
      input.contractVersion,
      TARGET_AWARE_LEAN_MEMORY_REDUCER_VERSION,
    )
    assert.deepEqual(input.targetContract, {
      addTargets: [],
      currentEvidenceTargetable: false,
      priorTargets: [{
        ref: 'm0',
        speaker: 'user',
        topic: 'occupation',
      }, {
        ref: 'm1',
        speaker: 'user',
        topic: 'workplace',
      }],
      supersedeTargetCount: 1,
      targetValueSource: 'prior[].ref',
    })
    assert.equal(
      body.systemInstruction.parts[0].text,
      TARGET_AWARE_LEAN_MEMORY_REDUCER_SYSTEM_INSTRUCTION,
    )
    assert.match(
      body.systemInstruction.parts[0].text,
      /only legal target values are refs copied exactly from prior\[\]\.ref/,
    )
    assert.match(
      body.systemInstruction.parts[0].text,
      /Current evidence is not prior memory and cannot be targeted/,
    )
    assert.equal(body.store, false)
  })

test('both observed target-deviation shapes receive objections at once',
  () => {
    const request = devProbeRequest()
    const objections =
      targetContractObjections(OBSERVED_TARGET_SHAPES, request)

    assert.equal(objections.length, 2)
    assert.match(objections[0], /^actions\[0\]:/)
    assert.match(objections[1], /^actions\[1\]:/)
    for (const objection of objections) {
      assert.match(objection, /no supplied prior ref matches topic/)
      assert.match(objection, /use add with targets \[\]/)
      assert.match(objection, /Current evidence is not targetable/)
    }
    assert.throws(
      () => normalizeTargetAwareLeanMemoryReducerProposal(
        OBSERVED_TARGET_SHAPES,
        request,
      ),
      (error) => {
        assert.equal(error.code, 'LEAN_REDUCER_PROPOSAL_INVALID')
        assert.match(error.message, /actions\[0\]/)
        assert.match(error.message, /actions\[1\]/)
        return true
      },
    )
  })

test('an eligible correction names the exact prior alias, not its topic',
  () => {
    const request = requestWithEligiblePrior()
    const wrong = supersedePayload(['work_schedule'])
    assert.throws(
      () => normalizeTargetAwareLeanMemoryReducerProposal(wrong, request),
      (error) => {
        assert.match(error.message, /eligible refs are \["m0"\]/)
        assert.match(error.message, /Never use a topic, field name/)
        return true
      },
    )

    const proposal = normalizeTargetAwareLeanMemoryReducerProposal(
      supersedePayload(['m0']),
      request,
    )
    assert.equal(proposal.actions.length, 1)
    assert.equal(proposal.actions[0].op, 'replace')
    assert.deepEqual(
      proposal.actions[0].targetIds,
      ['probe-mem-schedule'],
    )
  })

test('a batch can add its final version and separately supersede prior',
  () => {
    const proposal = normalizeTargetAwareLeanMemoryReducerProposal(
      CORRECT_BATCH_UPDATE,
      devProbeRequest(),
    )
    assert.equal(proposal.actions.length, 2)
    assert.equal(proposal.actions[0].op, 'add')
    assert.deepEqual(proposal.actions[0].targetIds, [])
    assert.equal(proposal.actions[1].op, 'replace')
    assert.deepEqual(proposal.actions[1].targetIds, ['probe-mem-2'])
  })

test('one repair receives the complete target diagnosis and stays bounded',
  async () => {
    const calls = []
    const repairs = []
    const responses = [
      OBSERVED_TARGET_SHAPES,
      CORRECT_BATCH_UPDATE,
    ]
    const reduce = createTargetAwareRepairingLeanMemoryReducer({
      invoke: async (call) => {
        calls.push(call)
        return responses[calls.length - 1]
      },
      onRepair: (event) => repairs.push(event),
    })

    const proposal = await reduce({
      request: devProbeRequest(),
      unit: { unitOrder: 1 },
    })

    assert.equal(calls.length, 2)
    assert.deepEqual(calls.map((call) => call.attempt), [0, 1])
    assert.equal(repairs.length, 1)
    assert.match(repairs[0].rejection, /actions\[0\]/)
    assert.match(repairs[0].rejection, /actions\[1\]/)
    const repairInput = JSON.parse(calls[1].body.contents[0].parts[0].text)
    assert.equal(
      repairInput.contractVersion,
      TARGET_AWARE_LEAN_MEMORY_REDUCER_VERSION,
    )
    assert.match(repairInput.rejection.reason, /use add with targets \[\]/)
    assert.equal(repairInput.targetContract.currentEvidenceTargetable, false)
    assert.equal(proposal.actions.length, 2)
    assert.equal(proposal.actions[0].op, 'add')
    assert.equal(proposal.actions[1].op, 'replace')
  })

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildLeanMemoryReducerRepairBody,
  createRepairingLeanMemoryReducer,
  isEmptyProviderResponse,
  isRepairableRejection,
} from '../evals/arms/lean-memory-reducer-repair.mjs'
import {
  buildLeanMemoryReducerGeminiBody,
} from '../evals/arms/lean-memory-reducer-contract.mjs'
import {
  DEVIATION_CONTROL,
  DEVIATION_REQUEST,
  PROVIDER_DEVIATIONS,
} from '../evals/provider-deviation-corpus.mjs'

const UNIT = { unitOrder: 1 }

function scriptedInvoke(responses) {
  const calls = []
  return {
    calls,
    async invoke({ attempt, body, model, unit }) {
      calls.push({ attempt, body, model, unit })
      const next = responses[calls.length - 1]
      if (next === undefined) throw new Error('unscripted provider call')
      return next
    },
  }
}

test('a first-attempt valid proposal costs exactly one dispatch', async () => {
  const { calls, invoke } = scriptedInvoke([DEVIATION_CONTROL.payload])
  const repairs = []
  const reduce = createRepairingLeanMemoryReducer({
    invoke,
    onRepair: (event) => repairs.push(event),
  })
  const proposal = await reduce({ request: DEVIATION_REQUEST, unit: UNIT })

  assert.equal(calls.length, 1)
  assert.equal(calls[0].attempt, 0)
  assert.deepEqual(repairs, [])
  assert.equal(proposal.actions.length, 1)
})

test('a rejected proposal is corrected in one further dispatch', async () => {
  // The J4.4K-L2-E failure, replayed. Under the current reducer this ends the
  // run. Here the model is told which field it got wrong and gets one chance.
  const deviation = PROVIDER_DEVIATIONS
    .find((entry) => entry.id === 'host-timestamp-as-quote')
  const { calls, invoke } = scriptedInvoke([
    deviation.payload,
    DEVIATION_CONTROL.payload,
  ])
  const repairs = []
  const reduce = createRepairingLeanMemoryReducer({
    invoke,
    onRepair: (event) => repairs.push(event),
  })
  const proposal = await reduce({ request: DEVIATION_REQUEST, unit: UNIT })

  assert.equal(calls.length, 2)
  assert.deepEqual(calls.map((call) => call.attempt), [0, 1])
  assert.equal(repairs.length, 1)
  assert.match(repairs[0].rejection, /actions\[0\]\.timeQuote/)

  // Provenance is untouched by the repair: the accepted proposal went through
  // the same validator, so the quote is still an exact substring of evidence.
  assert.equal(proposal.actions[0].basis[0].id, 'ev-8801')
  assert.ok(DEVIATION_REQUEST.input.evidence[0].text
    .includes(proposal.actions[0].basis[0].quote))
})

test('the repair turn carries the original request and the objection',
  () => {
    const original = buildLeanMemoryReducerGeminiBody(DEVIATION_REQUEST)
    const repair = buildLeanMemoryReducerRepairBody({
      rejectedText: '{"actions": "not an array"}',
      rejection: 'actions must be an array.',
      request: DEVIATION_REQUEST,
    })

    assert.deepEqual(repair.generationConfig, original.generationConfig)
    assert.deepEqual(repair.systemInstruction, original.systemInstruction)
    assert.equal(repair.store, false)

    const input = JSON.parse(original.contents[0].parts[0].text)
    const repaired = JSON.parse(repair.contents[0].parts[0].text)
    for (const key of Object.keys(input)) {
      assert.deepEqual(repaired[key], input[key], key)
    }
    assert.equal(repaired.rejectedResponse, '{"actions": "not an array"}')
    assert.equal(repaired.rejection.reason, 'actions must be an array.')
    assert.match(repaired.rejection.instruction, /character-for-character/)
  })

test('the repair body still satisfies the frozen writer request contract',
  () => {
    // The constraint that decided the single-turn shape. If the metered
    // transport would refuse the repair dispatch, the repair loop is a
    // decoration. Assert the exact structural rules `assertRequestBody`
    // enforces for a writer call.
    const repair = buildLeanMemoryReducerRepairBody({
      rejectedText: '{}',
      rejection: 'actions must be an array.',
      request: DEVIATION_REQUEST,
    })
    assert.deepEqual(
      Object.keys(repair).sort(),
      ['contents', 'generationConfig', 'store', 'systemInstruction'],
    )
    assert.equal(repair.contents.length, 1)
    assert.deepEqual(Object.keys(repair.contents[0]).sort(), ['parts', 'role'])
    assert.equal(repair.contents[0].role, 'user')
    assert.equal(repair.contents[0].parts.length, 1)
    assert.deepEqual(Object.keys(repair.contents[0].parts[0]), ['text'])
    assert.ok(repair.contents[0].parts[0].text.length > 0)
    assert.equal(repair.store, false)
  })

test('a second rejection is terminal — the loop is bounded', async () => {
  const deviation = PROVIDER_DEVIATIONS
    .find((entry) => entry.id === 'near-miss-quote')
  const { calls, invoke } = scriptedInvoke([
    deviation.payload,
    deviation.payload,
  ])
  const reduce = createRepairingLeanMemoryReducer({ invoke })

  await assert.rejects(
    reduce({ request: DEVIATION_REQUEST, unit: UNIT }),
    { code: 'LEAN_REDUCER_PROPOSAL_INVALID' },
  )
  assert.equal(calls.length, 2)
})

test('maxRepairs 0 reproduces the current one-shot behavior', async () => {
  const deviation = PROVIDER_DEVIATIONS
    .find((entry) => entry.id === 'near-miss-quote')
  const { calls, invoke } = scriptedInvoke([deviation.payload])
  const reduce = createRepairingLeanMemoryReducer({ invoke, maxRepairs: 0 })

  await assert.rejects(
    reduce({ request: DEVIATION_REQUEST, unit: UNIT }),
    { code: 'LEAN_REDUCER_PROPOSAL_INVALID' },
  )
  assert.equal(calls.length, 1)
})

test('an empty provider response is classified, never repaired', async () => {
  // J4.4K-L3-E. There is nothing in an empty body to correct, and re-sending
  // a request the provider already accepted is the retry the meter forbids.
  for (const empty of ['', '   ', { text: '' }, {}, null]) {
    const { calls, invoke } = scriptedInvoke([empty])
    const reduce = createRepairingLeanMemoryReducer({ invoke })
    await assert.rejects(
      reduce({ request: DEVIATION_REQUEST, unit: UNIT }),
      { code: 'LEAN_REDUCER_EMPTY_RESPONSE' },
    )
    assert.equal(calls.length, 1)
  }
})

test('an empty body and an empty action list stay distinguishable',
  async () => {
    const { invoke } = scriptedInvoke(['{"actions": []}'])
    const reduce = createRepairingLeanMemoryReducer({ invoke })
    const proposal = await reduce({ request: DEVIATION_REQUEST, unit: UNIT })
    assert.deepEqual(proposal.actions, [])
    assert.equal(isEmptyProviderResponse('{"actions": []}'), false)
    assert.equal(isEmptyProviderResponse({ text: '' }), true)
  })

test('transport faults stay terminal and are not repaired', async () => {
  let calls = 0
  const reduce = createRepairingLeanMemoryReducer({
    invoke: async () => {
      calls += 1
      const error = new Error('cap exhausted')
      error.code = 'CAP_EXCEEDED'
      throw error
    },
  })
  await assert.rejects(
    reduce({ request: DEVIATION_REQUEST, unit: UNIT }),
    { code: 'CAP_EXCEEDED' },
  )
  assert.equal(calls, 1)
  assert.equal(isRepairableRejection({ code: 'CAP_EXCEEDED' }), false)
})

test('every repairable corpus deviation is recoverable in one turn',
  async () => {
    // The corpus is the measurement: how much of what real and anticipated
    // models actually do can a single repair turn recover? Everything except
    // the empty body, which is classified instead.
    const recovered = []
    for (const deviation of PROVIDER_DEVIATIONS) {
      if (!deviation.repairable) continue
      const { calls, invoke } = scriptedInvoke([
        deviation.payload,
        DEVIATION_CONTROL.payload,
      ])
      const reduce = createRepairingLeanMemoryReducer({ invoke })
      const proposal = await reduce({ request: DEVIATION_REQUEST, unit: UNIT })
      assert.equal(calls.length, 2, deviation.id)
      assert.equal(proposal.actions.length, 1, deviation.id)
      recovered.push(deviation.id)
    }
    assert.equal(
      recovered.length,
      PROVIDER_DEVIATIONS.filter((entry) => entry.repairable).length,
    )
    assert.ok(recovered.length >= 9)
  })

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  normalizeLeanMemoryReducerProposal,
} from '../evals/arms/lean-memory-reducer-contract.mjs'
import {
  DEVIATION_CONTROL,
  DEVIATION_REQUEST,
  OBSERVED_PROVIDER_DEVIATIONS,
  PROVIDER_DEVIATIONS,
  deviationIsRepairUsable,
} from '../evals/provider-deviation-corpus.mjs'

function normalize(payload) {
  return normalizeLeanMemoryReducerProposal(payload, DEVIATION_REQUEST)
}

test('the control payload still normalizes', () => {
  const proposal = normalize(DEVIATION_CONTROL.payload)
  assert.equal(proposal.baseRevision, 4)
  assert.equal(proposal.actions.length, 1)
  assert.equal(proposal.actions[0].op, 'add')
  assert.deepEqual(
    proposal.actions[0].basis,
    [{
      id: 'ev-8801',
      kind: 'evidence',
      quote: 'I moved to Lisbon in March',
    }],
  )
  assert.deepEqual(
    proposal.dispositions,
    [
      { evidenceId: 'ev-8801', outcome: 'used' },
      { evidenceId: 'ev-8802', outcome: 'no_memory' },
    ],
  )
})

test('every catalogued deviation is rejected by the real host validator',
  () => {
    for (const deviation of PROVIDER_DEVIATIONS) {
      assert.throws(
        () => normalize(deviation.payload),
        (error) => error instanceof Error,
        `${deviation.id} was accepted`,
      )
    }
  })

test('every rejection names the field a repair turn must correct', () => {
  for (const deviation of PROVIDER_DEVIATIONS) {
    let message = null
    try {
      normalize(deviation.payload)
    } catch (error) {
      message = error?.message ?? null
    }
    assert.ok(
      deviationIsRepairUsable(deviation, message),
      `${deviation.id} rejected with an unusable message: ${message}`,
    )
  }
})

test('an empty successful response is not treated as an empty proposal',
  () => {
    // The distinction that J4.4K-L3-E turned on. `{"actions": []}` is a model
    // saying "nothing here is worth remembering" and is a legitimate,
    // normalizable answer. An empty body is the model saying nothing at all.
    // If these two collapsed into one outcome, a dropped provider response
    // would be silently recorded as a decision not to remember.
    const declined = normalize('{"actions": []}')
    assert.deepEqual(declined.actions, [])
    assert.deepEqual(
      declined.dispositions.map((entry) => entry.outcome),
      ['no_memory', 'no_memory'],
    )
    assert.throws(() => normalize(''), /Lean memory proposal/)
    assert.throws(() => normalize(null), /Lean memory proposal/)
    assert.throws(() => normalize(undefined), /Lean memory proposal/)
  })

test('the corpus records the live failures that produced it', () => {
  // The value of this file is that it is grounded in real terminal runs, not
  // in what an author imagined a model might do. Guard that grounding: if the
  // observed entries ever disappear, so does the reason to trust the rest.
  assert.deepEqual(
    OBSERVED_PROVIDER_DEVIATIONS.map((entry) => entry.id),
    [
      'host-timestamp-as-quote',
      'unenumerated-vocabulary-value',
      'empty-successful-response',
    ],
  )
  for (const deviation of OBSERVED_PROVIDER_DEVIATIONS) {
    assert.notEqual(deviation.unit, 'anticipated')
  }
  assert.equal(
    new Set(PROVIDER_DEVIATIONS.map((entry) => entry.id)).size,
    PROVIDER_DEVIATIONS.length,
  )
})

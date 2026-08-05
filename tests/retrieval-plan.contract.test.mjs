import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  MEMORY_RETRIEVAL_PLAN_INSTRUCTIONS,
  MEMORY_RETRIEVAL_PLAN_RELATIONS,
  MEMORY_RETRIEVAL_PLAN_TOOL,
  normalizeRetrievalPlan,
} from '../src/retrieval-plan.mjs'

function validPlan() {
  return {
    anchor_event: 'the purchase of a later kitchen appliance',
    relation: 'before',
    category: 'kitchen appliance purchase',
    time_range: {
      after: null,
      before: '2026-08-05T00:00:00Z',
    },
  }
}

test('retrieval plan is exact, normalized, immutable, and provider-neutral', () => {
  const plan = normalizeRetrievalPlan(validPlan())
  assert.deepEqual(plan, {
    anchor_event: 'the purchase of a later kitchen appliance',
    relation: 'before',
    category: 'kitchen appliance purchase',
    time_range: {
      after: null,
      before: '2026-08-05T00:00:00.000Z',
    },
  })
  assert.ok(Object.isFrozen(plan))
  assert.ok(Object.isFrozen(plan.time_range))
  assert.equal(MEMORY_RETRIEVAL_PLAN_TOOL.name, 'memory_plan')
  assert.deepEqual(
    MEMORY_RETRIEVAL_PLAN_TOOL.parameters.properties.relation.enum,
    MEMORY_RETRIEVAL_PLAN_RELATIONS,
  )
  assert.match(MEMORY_RETRIEVAL_PLAN_INSTRUCTIONS, /memory_timeline/)
  assert.match(MEMORY_RETRIEVAL_PLAN_INSTRUCTIONS, /memory_read/)
})

test('retrieval plan rejects malformed ranges, fields, accessors, and mutation tricks', () => {
  for (const invalid of [
    { ...validPlan(), relation: 'earlier_than_the_expected_answer' },
    { ...validPlan(), benchmarkAnswer: 'forbidden' },
    { ...validPlan(), time_range: { after: 'not-a-date', before: null } },
    {
      ...validPlan(),
      time_range: {
        after: '2026-08-06T00:00:00Z',
        before: '2026-08-05T00:00:00Z',
      },
    },
  ]) {
    assert.throws(
      () => normalizeRetrievalPlan(invalid),
      (error) => error.code === 'MEMORY_RETRIEVAL_PLAN_INVALID',
    )
  }

  let reads = 0
  const accessor = validPlan()
  Object.defineProperty(accessor, 'anchor_event', {
    enumerable: true,
    get() {
      reads += 1
      return 'mutable anchor'
    },
  })
  assert.throws(
    () => normalizeRetrievalPlan(accessor),
    (error) => error.code === 'MEMORY_RETRIEVAL_PLAN_INVALID',
  )
  assert.equal(reads, 0)
})

test('product planning and commitment code contains no acceptance-case route',
  async () => {
    const source = (await Promise.all([
      '../src/retrieval-plan.mjs',
      '../src/retrieval-answer.mjs',
      '../src/openai.mjs',
    ].map((path) => readFile(new URL(path, import.meta.url), 'utf8'))))
      .join('\n')
    for (const literal of [
      'phone',
      'Instant Pot',
      'Suica',
      'TripIt',
      'Tokyo',
      'Miami',
      'hot tub',
      'balcony',
    ]) {
      assert.equal(source.toLowerCase().includes(literal.toLowerCase()), false)
    }
  })

import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  answerWithRetrieval,
  createPalariBrain,
  ingestChatTurn,
  normalizeRetrievalPlan,
} from '../src/index.mjs'

const SCOPE = Object.freeze({
  palariId: 'palari-generalization',
  userId: 'user-generalization',
})
const EARLY = '2025-01-01T00:00:00.000Z'
const CUTOFF = '2025-01-15T00:00:00.000Z'
const LATE = '2025-02-01T00:00:00.000Z'

const CASES = Object.freeze([
  {
    domain: 'residence',
    mode: 'current',
    phrase: 'Riverton apartment lease duration',
    early: 'My Riverton apartment lease is month-to-month.',
    late: 'My Riverton apartment lease is now twelve months.',
  },
  {
    domain: 'medication',
    mode: 'current',
    phrase: 'metformin dosage prescription',
    early: 'My metformin prescription is 500 milligrams.',
    late: 'My metformin prescription is now 750 milligrams.',
  },
  {
    domain: 'employment',
    mode: 'current',
    phrase: 'Northwind work schedule',
    early: 'My Northwind schedule is remote on Mondays.',
    late: 'My Northwind schedule now requires the office on Mondays.',
  },
  {
    domain: 'subscription',
    mode: 'historical',
    phrase: 'Atlas Music subscription plan',
    early: 'My Atlas Music subscription uses the annual plan.',
    late: 'I cancelled my Atlas Music subscription.',
  },
  {
    domain: 'travel',
    mode: 'historical',
    phrase: 'Lisbon hotel reservation neighborhood',
    early: 'My Lisbon hotel reservation is in Alfama.',
    late: 'I changed my Lisbon hotel reservation to Baixa.',
  },
  {
    domain: 'purchase',
    mode: 'historical',
    phrase: 'camera lens order cost',
    early: 'My camera lens order cost four hundred dollars.',
    late: 'I returned the camera lens order for a refund.',
  },
])

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

test('between is a general temporal relation, not a benchmark-only value', () => {
  assert.equal(normalizeRetrievalPlan({
    anchor_event: 'two independently observed events',
    category: 'event dates',
    relation: 'between',
    time_range: { after: null, before: null },
  }).relation, 'between')
})

test('host time authority generalizes across six unrelated memory domains',
  async (t) => {
    const root = await mkdtemp(join(tmpdir(), 'palari-time-generalization-'))
    const brain = await createPalariBrain({
      memoryEnabled: true,
      statePath: join(root, 'brain.json'),
      workspaceId: 'time-generalization',
    })
    t.after(async () => {
      brain.close()
      await rm(root, { force: true, recursive: true })
    })

    for (const entry of CASES) {
      for (const [suffix, eventAt, userMessage] of [
        ['early', EARLY, entry.early],
        ['late', LATE, entry.late],
      ]) {
        await ingestChatTurn(brain, {
          ...SCOPE,
          assistantMessage: 'Noted.',
          eventAt,
          retention: 'durable',
          sourceMessageId: `${entry.domain}:${suffix}`,
          userMessage,
        }, {
          reducer: keepNothing,
          reducerId: 'time-generalization/v1',
        })
      }
    }

    for (const entry of CASES) {
      await t.test(entry.domain, async () => {
        const current = entry.mode === 'current'
        const trustedRetrievalTimeRange = current
          ? { after: null, before: null }
          : { after: null, before: CUTOFF }
        const providerBounds = current
          ? { before: CUTOFF }
          : { after: LATE }

        await answerWithRetrieval(brain, {
          ...SCOPE,
          async provider({ retrieve }) {
            const found = await retrieve({
              input: {
                ...providerBounds,
                limit: 20,
                maxChars: 100_000,
                phrase: entry.phrase,
              },
              tool: 'memory_search',
            })
            assert.deepEqual(
              found.effectiveTimeRange,
              trustedRetrievalTimeRange,
            )
            const texts = found.matches.map((row) => row.text)
            assert.ok(texts.includes(current ? entry.late : entry.early))
            if (!current) assert.ok(!texts.includes(entry.late))
            return { text: 'Checked.' }
          },
          question: current
            ? `What is my current ${entry.domain} status?`
            : `What was my ${entry.domain} status on January 15?`,
          questionDate: CUTOFF,
          trustedRetrievalTimeRange,
        })
      })
    }
  })

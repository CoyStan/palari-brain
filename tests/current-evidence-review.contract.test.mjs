import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  MEMORY_CURRENT_EVIDENCE_REVIEW_SCHEMA,
  answerWithRetrieval,
  createPalariBrain,
  ingestChatTurn,
} from '../src/index.mjs'
import {
  OPENAI_ANSWER_COMMIT_TOOL_NAME,
  createOpenAIRetrievalProvider,
} from '../src/openai.mjs'

const EARLY = '2025-01-01T00:00:00.000Z'
const LATE = '2025-02-01T00:00:00.000Z'

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

function commitment({ bases, text = 'Answered from reviewed evidence.' }) {
  return {
    abstained: false,
    bases,
    temporaryInferences: [],
    text,
  }
}

function used(row, consequence = 'This evidence controls the answer.') {
  return {
    consequence_for_answer: consequence,
    evidenceId: row.evidenceId,
    not_used_reason: '',
    quote: row.text,
  }
}

function notUsed(row, reason) {
  return {
    consequence_for_answer: '',
    evidenceId: row.evidenceId,
    not_used_reason: reason,
    quote: row.text,
  }
}

async function withBrain(t, label, run) {
  const root = await mkdtemp(join(tmpdir(), `palari-${label}-`))
  const brain = await createPalariBrain({
    memoryEnabled: true,
    statePath: join(root, 'brain.json'),
    workspaceId: label,
  })
  t.after(async () => {
    brain.close()
    await rm(root, { force: true, recursive: true })
  })
  return run(brain)
}

async function ingest(brain, scope, entries) {
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]
    await ingestChatTurn(brain, {
      ...scope,
      assistantMessage: 'Noted.',
      eventAt: entry.eventAt,
      retention: 'durable',
      sourceMessageId: `${scope.userId}:${index}`,
      userMessage: entry.text,
    }, {
      reducer: keepNothing,
      reducerId: 'current-evidence-review/v1',
    })
  }
}

function findText(matches, text) {
  const row = matches.find((candidate) => candidate.text === text)
  assert.ok(row, `Missing returned canonical text: ${text}`)
  return row
}

function completedCall({ args, callId, name }) {
  return {
    output: [{
      arguments: JSON.stringify(args),
      call_id: callId,
      name,
      type: 'function_call',
    }],
    status: 'completed',
  }
}

const CURRENT_CASES = Object.freeze([
  {
    domain: 'medication',
    early: 'My Norvale prescription is 10 milligrams each morning.',
    late: 'My Norvale prescription is now 20 milligrams each morning.',
    phrase: 'current Norvale prescription milligrams each morning',
  },
  {
    domain: 'employment',
    early: 'My Kestrel schedule is remote on Fridays.',
    late: 'My Kestrel schedule now requires the office on Fridays.',
    phrase: 'current Kestrel work schedule Fridays',
  },
  {
    domain: 'subscription',
    early: 'My Juniper Radio subscription is the monthly plan.',
    late: 'My Juniper Radio subscription is now the annual plan.',
    phrase: 'current Juniper Radio subscription plan',
  },
])

test('auto/current answers report later top-ranked direct evidence without blocking',
  async (t) => {
    for (const entry of CURRENT_CASES) {
      await t.test(entry.domain, async (t) => withBrain(
        t,
        `current-review-${entry.domain}`,
        async (brain) => {
          const scope = {
            palariId: `palari-${entry.domain}`,
            userId: `user-${entry.domain}`,
          }
          await ingest(brain, scope, [
            { eventAt: EARLY, text: entry.early },
            { eventAt: LATE, text: entry.late },
          ])

          const provider = async ({ commitAnswer, retrieve }) => {
            await retrieve({
              input: {
                anchor_event: entry.phrase,
                category: `${entry.domain} current value`,
                relation: 'current',
                time_range: { after: null, before: null },
              },
              tool: 'memory_plan',
            })
            const found = await retrieve({
              input: {
                limit: 10,
                maxChars: 20_000,
                phrase: entry.phrase,
              },
              tool: 'memory_search',
            })
            const early = findText(found.matches, entry.early)
            const late = findText(found.matches, entry.late)
            assert.ok(late)
            return commitAnswer(commitment({ bases: [used(early)] }))
          }
          provider.requiresEvidenceCommitment = true

          const result = await answerWithRetrieval(brain, {
            ...scope,
            compositionMode: 'auto',
            provider,
            question: `What is my current ${entry.domain} value?`,
            questionDate: LATE,
            trustedRetrievalTimeRange: { after: null, before: null },
          })

          assert.equal(result.answerEvidence.length, 1)
          assert.equal(result.answerEvidence[0].quote, entry.early)
          assert.equal(
            result.currentEvidenceReview.schema,
            MEMORY_CURRENT_EVIDENCE_REVIEW_SCHEMA,
          )
          assert.equal(result.currentEvidenceReview.assessedEvidenceIds.length, 0)
          assert.equal(result.currentEvidenceReview.unresolvedEvidenceIds.length, 1)
          assert.equal(result.currentEvidenceReview.durableWrites, 0)
        },
      ))
    }
  })

test('OpenAI provider accepts an old-only commitment and reports telemetry',
  async (t) => withBrain(t, 'current-review-openai-telemetry', async (brain) => {
    const scope = {
      palariId: 'palari-openai-repair',
      userId: 'user-openai-repair',
    }
    const early = 'My Sequoia membership is the bronze tier.'
    const late = 'My Sequoia membership is now the gold tier.'
    await ingest(brain, scope, [
      { eventAt: EARLY, text: early },
      { eventAt: LATE, text: late },
    ])

    const bodies = []
    const provider = createOpenAIRetrievalProvider({
      async invoke({ body }) {
        bodies.push(body)
        if (bodies.length === 1) {
          return completedCall({
            args: {
              anchor_event: 'Sequoia membership tier',
              category: 'current membership tier',
              relation: 'current',
              time_range: { after: null, before: null },
            },
            callId: 'plan',
            name: 'memory_plan',
          })
        }
        if (bodies.length === 2) {
          return completedCall({
            args: {
              limit: 10,
              maxChars: 20_000,
              phrase: 'current Sequoia membership bronze gold tier',
            },
            callId: 'search',
            name: 'memory_search',
          })
        }
        const searchOutput = body.input.find((item) =>
          item.type === 'function_call_output' && item.call_id === 'search')
        const found = JSON.parse(searchOutput.output)
        const earlyRow = findText(found.matches, early)
        findText(found.matches, late)
        if (bodies.length === 3) {
          return completedCall({
            args: commitment({ bases: [{
              consequence_for_answer: 'This evidence controls the answer.',
              memoryNumber: earlyRow.memoryNumber,
              not_used_reason: '',
              quote: earlyRow.text,
            }] }),
            callId: 'old-commit',
            name: OPENAI_ANSWER_COMMIT_TOOL_NAME,
          })
        }
        throw new Error('The accepted commitment must not trigger a repair.')
      },
    })

    const result = await answerWithRetrieval(brain, {
      ...scope,
      compositionMode: 'auto',
      provider,
      question: 'What is my current Sequoia membership tier?',
      questionDate: LATE,
      trustedRetrievalTimeRange: { after: null, before: null },
    })

    assert.equal(bodies.length, 3)
    assert.equal(result.answerEvidence[0].quote, early)
    assert.equal(result.currentEvidenceReview.assessedEvidenceIds.length, 0)
    assert.equal(result.currentEvidenceReview.unresolvedEvidenceIds.length, 1)
  }))

test('recommendations leave semantic current-evidence judgment to one answer',
  async (t) => withBrain(t, 'current-recommend-thin-host', async (brain) => {
    const scope = {
      palariId: 'palari-current-recommend-repair',
      userId: 'user-current-recommend-repair',
    }
    const early = 'My Maple restaurant preference is quiet patio seating.'
    const late = 'My Maple restaurant note now says the table lamps are amber.'
    await ingest(brain, scope, [
      { eventAt: EARLY, text: early },
      { eventAt: LATE, text: late },
    ])
    const answer = [
      'Choose a quiet restaurant with patio seating.',
      'Verify the current hours and patio availability before going.',
      'Which neighborhood should I search?',
    ].join(' ')

    const bodies = []
    const provider = createOpenAIRetrievalProvider({
      async invoke({ body }) {
        bodies.push(body)
        if (bodies.length === 1) {
          return completedCall({
            args: {
              anchor_event: 'current Maple restaurant preference',
              category: 'current restaurant recommendation',
              relation: 'current',
              time_range: { after: null, before: null },
            },
            callId: 'combined-plan',
            name: 'memory_plan',
          })
        }
        if (bodies.length === 2) {
          return completedCall({
            args: {
              limit: 10,
              maxChars: 20_000,
              phrase: 'Maple restaurant patio seating table lamps amber',
            },
            callId: 'combined-search',
            name: 'memory_search',
          })
        }
        const searchOutput = body.input.find((item) =>
          item.type === 'function_call_output' &&
          item.call_id === 'combined-search')
        const found = JSON.parse(searchOutput.output)
        const earlyRow = findText(found.matches, early)
        findText(found.matches, late)
        return completedCall({
          args: {
            abstained: false,
            supportingMemoryNumbers: [earlyRow.memoryNumber],
            text: answer,
          },
          callId: 'thin-recommendation',
          name: OPENAI_ANSWER_COMMIT_TOOL_NAME,
        })
      },
    })

    const result = await answerWithRetrieval(brain, {
      ...scope,
      compositionMode: 'auto',
      provider,
      question: 'Can you recommend a restaurant for my current preference?',
      questionDate: LATE,
      trustedRetrievalTimeRange: { after: null, before: null },
    })

    assert.equal(bodies.length, 3)
    assert.equal(result.answer, answer)
    assert.equal(result.answerRecommendation, null)
    assert.equal(result.selectedEvidenceIds.length, 1)
    assert.equal(result.currentEvidenceReview, undefined)
  }))

test('later unrelated evidence may be explicitly reviewed without controlling',
  async (t) => withBrain(t, 'current-review-unrelated', async (brain) => {
    const scope = {
      palariId: 'palari-unrelated',
      userId: 'user-unrelated',
    }
    const target = 'My Cedar desk has a walnut finish.'
    const unrelated = 'My Cedar desk lamp now uses an amber bulb.'
    await ingest(brain, scope, [
      { eventAt: EARLY, text: target },
      { eventAt: LATE, text: unrelated },
    ])

    const provider = async ({ commitAnswer, retrieve }) => {
      await retrieve({
        input: {
          anchor_event: 'Cedar desk finish',
          category: 'current furniture finish',
          relation: 'current',
          time_range: { after: null, before: null },
        },
        tool: 'memory_plan',
      })
      const found = await retrieve({
        input: {
          limit: 10,
          maxChars: 20_000,
          phrase: 'Cedar desk finish walnut lamp amber',
        },
        tool: 'memory_search',
      })
      const targetRow = findText(found.matches, target)
      const unrelatedRow = findText(found.matches, unrelated)
      return commitAnswer(commitment({
        bases: [
          used(targetRow),
          notUsed(
            unrelatedRow,
            'This changes the lamp bulb, not the desk finish.',
          ),
        ],
      }))
    }
    provider.requiresEvidenceCommitment = true

    const result = await answerWithRetrieval(brain, {
      ...scope,
      compositionMode: 'auto',
      provider,
      question: 'What is the current finish of my Cedar desk?',
      questionDate: LATE,
      trustedRetrievalTimeRange: { after: null, before: null },
    })

    assert.equal(result.answerEvidence.length, 1)
    assert.equal(result.answerEvidence[0].quote, target)
    assert.equal(result.currentEvidenceReview.candidateEvidenceIds.length, 1)
    assert.deepEqual(
      result.currentEvidenceReview.assessedEvidenceIds,
      result.currentEvidenceReview.candidateEvidenceIds,
    )
  }))

test('historical plans may select older evidence without current review',
  async (t) => withBrain(t, 'historical-review-control', async (brain) => {
    const scope = {
      palariId: 'palari-historical',
      userId: 'user-historical',
    }
    const early = 'My Alder project office was in Bristol.'
    const late = 'My Alder project office moved to Leeds.'
    await ingest(brain, scope, [
      { eventAt: EARLY, text: early },
      { eventAt: LATE, text: late },
    ])

    const provider = async ({ commitAnswer, retrieve }) => {
      await retrieve({
        input: {
          anchor_event: 'Alder project office',
          category: 'historical office location',
          relation: 'before',
          time_range: { after: null, before: LATE },
        },
        tool: 'memory_plan',
      })
      const found = await retrieve({
        input: {
          limit: 10,
          maxChars: 20_000,
          phrase: 'Alder project office Bristol Leeds',
        },
        tool: 'memory_search',
      })
      return commitAnswer(commitment({
        bases: [used(findText(found.matches, early))],
      }))
    }
    provider.requiresEvidenceCommitment = true

    const result = await answerWithRetrieval(brain, {
      ...scope,
      compositionMode: 'auto',
      provider,
      question: 'Where was my Alder project office before it moved?',
      questionDate: LATE,
      trustedRetrievalTimeRange: { after: null, before: null },
    })

    assert.equal(result.answerEvidence[0].quote, early)
    assert.equal(Object.hasOwn(result, 'currentEvidenceReview'), false)
  }))

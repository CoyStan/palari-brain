import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  answerWithRetrieval,
  createPalariBrain,
  ingestChatTurn,
  resolveMemoryAnswerCompositionMode,
} from '../src/index.mjs'
import {
  OPENAI_ANSWER_COMMIT_TOOL_NAME,
  createOpenAIRetrievalProvider,
} from '../src/openai.mjs'

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

async function seed(brain, scope, text, suffix = 'preference') {
  await ingestChatTurn(brain, {
    ...scope,
    assistantMessage: 'Noted.',
    eventAt: '2025-01-01T00:00:00.000Z',
    retention: 'durable',
    sourceMessageId: `${scope.userId}:${suffix}`,
    userMessage: text,
  }, {
    reducer: keepNothing,
    reducerId: 'recommendation-fulfillment/v1',
  })
}

function requireRecommendation(provider) {
  Object.defineProperties(provider, {
    requiresEvidenceCommitment: {
      enumerable: true,
      value: true,
    },
    requiresRecommendationCommitment: {
      enumerable: true,
      value: true,
    },
  })
  return provider
}

function used(row, consequence = 'This preference personalizes the proposal.') {
  return {
    consequence_for_answer: consequence,
    evidenceId: row.evidenceId,
    not_used_reason: '',
    quote: row.text ?? row.snippet ?? row.quote,
  }
}

function notUsed(row, reason = 'This memory does not support a recommendation.') {
  return {
    consequence_for_answer: '',
    evidenceId: row.evidenceId,
    not_used_reason: reason,
    quote: row.text ?? row.snippet ?? row.quote,
  }
}

function recommendationItem({
  evidenceIds,
  proposal,
  requiresExternalVerification = false,
  verificationNote = '',
}) {
  return {
    evidenceIds,
    proposal,
    requiresExternalVerification,
    verificationNote,
  }
}

function commitment({
  abstained = false,
  bases,
  clarificationQuestion = '',
  items,
  text,
}) {
  return {
    abstained,
    bases,
    recommendation: { clarificationQuestion, items },
    temporaryInferences: [],
    text,
  }
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

function onlyUserMatch(matches) {
  const row = matches.find((candidate) => candidate.speaker === 'user')
  assert.ok(row)
  return row
}

const POSITIVE_CASES = Object.freeze([
  {
    domain: 'drink',
    memory: 'I prefer tart citrus drinks and avoid very sweet cocktails.',
    proposal: 'Try a tart grapefruit spritz with minimal syrup.',
    question: 'Can you recommend a drink for tonight?',
  },
  {
    domain: 'exercise',
    memory: 'I enjoy low-impact exercise and especially like slow yoga sessions.',
    proposal: 'Try a gentle restorative-yoga session.',
    question: 'What workout would you suggest for this evening?',
  },
  {
    domain: 'reading',
    memory: 'I like character-driven mysteries set in small coastal towns.',
    proposal: 'Choose a character-driven coastal mystery.',
    question: 'Can you recommend something for me to read?',
  },
])

test('auto recommendation mode requires materially evidence-linked proposals',
  async (t) => {
    for (const entry of POSITIVE_CASES) {
      await t.test(entry.domain, async (t) => withBrain(
        t,
        `recommend-${entry.domain}`,
        async (brain) => {
          const scope = {
            palariId: `palari-${entry.domain}`,
            userId: `user-${entry.domain}`,
          }
          await seed(brain, scope, entry.memory)
          const provider = requireRecommendation(async ({
            answerRecommendationRequired,
            commitAnswer,
            retrieve,
          }) => {
            assert.equal(answerRecommendationRequired, true)
            const found = await retrieve({
              input: { phrase: entry.memory },
              tool: 'memory_find',
            })
            const row = onlyUserMatch(found.matches)
            return commitAnswer(commitment({
              bases: [used(row)],
              items: [recommendationItem({
                evidenceIds: [row.evidenceId],
                proposal: entry.proposal,
              })],
              text: entry.proposal,
            }))
          })

          const result = await answerWithRetrieval(brain, {
            ...scope,
            compositionMode: 'auto',
            provider,
            question: entry.question,
          })

          assert.equal(result.answerCompositionMode, 'recommend')
          assert.equal(result.answerRecommendation.items.length, 1)
          assert.equal(result.answerRecommendation.items[0].proposal, entry.proposal)
          assert.equal(result.answerEvidence.length, 1)
          assert.ok(Object.isFrozen(result.answerRecommendation))
        },
      ))
    }
  })

test('OpenAI repairs clarification-only output into a useful proposal',
  async (t) => withBrain(t, 'recommend-openai-repair', async (brain) => {
    const scope = {
      palariId: 'palari-event-repair',
      userId: 'user-event-repair',
    }
    const memory =
      'I want cultural exchanges where I can practice French and Spanish.'
    const proposal =
      'Look for a French or Spanish language-exchange meetup this weekend.'
    const verificationNote =
      'Verify the current date, location, and availability before attending.'
    const clarificationQuestion = 'What city or neighborhood are you in?'
    await seed(brain, scope, memory)

    const bodies = []
    const provider = createOpenAIRetrievalProvider({
      async invoke({ body }) {
        bodies.push(body)
        const commitTool = body.tools?.find((tool) =>
          tool.name === OPENAI_ANSWER_COMMIT_TOOL_NAME)
        if (bodies.length === 1) {
          assert.ok(commitTool.parameters.required.includes('recommendation'))
          return completedCall({
            args: { phrase: memory },
            callId: 'search',
            name: 'memory_find',
          })
        }
        const searchOutput = body.input.find((item) =>
          item.type === 'function_call_output' && item.call_id === 'search')
        const found = JSON.parse(searchOutput.output)
        const row = onlyUserMatch(found.matches)
        if (bodies.length === 2) {
          return completedCall({
            args: commitment({
              bases: [used(row)],
              clarificationQuestion,
              items: [],
              text: clarificationQuestion,
            }),
            callId: 'clarification-only',
            name: OPENAI_ANSWER_COMMIT_TOOL_NAME,
          })
        }
        return completedCall({
          args: commitment({
            bases: [used(row)],
            clarificationQuestion,
            items: [recommendationItem({
              evidenceIds: [row.evidenceId],
              proposal,
              requiresExternalVerification: true,
              verificationNote,
            })],
            text: `${proposal} ${verificationNote} ${clarificationQuestion}`,
          }),
          callId: 'useful-recommendation',
          name: OPENAI_ANSWER_COMMIT_TOOL_NAME,
        })
      },
    })

    const result = await answerWithRetrieval(brain, {
      ...scope,
      compositionMode: 'auto',
      provider,
      question: 'Can you recommend cultural events around me this weekend?',
    })

    assert.equal(bodies.length, 3)
    assert.equal(result.answerRecommendation.items[0].proposal, proposal)
    assert.equal(
      result.answerRecommendation.items[0].requiresExternalVerification,
      true,
    )
    const rejection = bodies[2].input.find((item) =>
      item.type === 'function_call_output' &&
      item.call_id === 'clarification-only')
    assert.match(
      JSON.parse(rejection.output).rejection,
      /non-abstaining recommendation commitment must contain 1 to/,
    )
  }))

test('one OpenAI repair reports every recommendation text mismatch together',
  async (t) => withBrain(t, 'recommend-surface-repair', async (brain) => {
    const scope = {
      palariId: 'palari-surface-repair',
      userId: 'user-surface-repair',
    }
    const memory = 'I prefer quiet restaurants with outdoor seating.'
    const proposal = 'Choose a quiet restaurant with patio seating.'
    const verificationNote =
      'Verify the current hours and patio availability before going.'
    const clarificationQuestion = 'Which neighborhood should I search?'
    await seed(brain, scope, memory)

    const bodies = []
    const provider = createOpenAIRetrievalProvider({
      async invoke({ body }) {
        bodies.push(body)
        if (bodies.length === 1) {
          return completedCall({
            args: { phrase: memory },
            callId: 'surface-search',
            name: 'memory_find',
          })
        }
        const searchOutput = body.input.find((item) =>
          item.type === 'function_call_output' &&
          item.call_id === 'surface-search')
        const found = JSON.parse(searchOutput.output)
        const row = onlyUserMatch(found.matches)
        const valid = commitment({
          bases: [used(row)],
          clarificationQuestion,
          items: [recommendationItem({
            evidenceIds: [row.evidenceId],
            proposal,
            requiresExternalVerification: true,
            verificationNote,
          })],
          text: `${proposal} ${verificationNote} ${clarificationQuestion}`,
        })
        if (bodies.length === 2) {
          return completedCall({
            args: {
              ...valid,
              text: 'Try a suitable nearby patio and check its details. Where are you?',
            },
            callId: 'surface-mismatches',
            name: OPENAI_ANSWER_COMMIT_TOOL_NAME,
          })
        }
        return completedCall({
          args: valid,
          callId: 'surface-repaired',
          name: OPENAI_ANSWER_COMMIT_TOOL_NAME,
        })
      },
    })

    const result = await answerWithRetrieval(brain, {
      ...scope,
      compositionMode: 'auto',
      provider,
      question: 'Can you suggest a restaurant for dinner?',
    })

    assert.equal(
      result.answer,
      `${proposal} ${verificationNote} ${clarificationQuestion}`,
    )
    assert.equal(bodies.length, 3)
    const rejection = bodies[2].input.find((item) =>
      item.type === 'function_call_output' &&
      item.call_id === 'surface-mismatches')
    const reason = JSON.parse(rejection.output).rejection
    assert.match(reason, /clarificationQuestion/)
    assert.match(reason, /item 0 proposal/)
    assert.match(reason, /item 0 verificationNote/)
  }))

test('recommendations reject unused grounding and unverifiable answer text',
  async (t) => withBrain(t, 'recommend-invalid-controls', async (brain) => {
    const scope = {
      palariId: 'palari-invalid-recommendation',
      userId: 'user-invalid-recommendation',
    }
    const memory = 'I prefer quiet restaurants with outdoor seating.'
    await seed(brain, scope, memory)
    const errors = []
    const provider = requireRecommendation(async ({ commitAnswer, retrieve }) => {
      const found = await retrieve({
        input: { phrase: memory },
        tool: 'memory_find',
      })
      const row = onlyUserMatch(found.matches)
      for (const proposal of [
        commitment({
          bases: [notUsed(row)],
          items: [recommendationItem({
            evidenceIds: [row.evidenceId],
            proposal: 'Choose a quiet patio restaurant.',
          })],
          text: 'Choose a quiet patio restaurant.',
        }),
        commitment({
          bases: [used(row)],
          items: [recommendationItem({
            evidenceIds: [row.evidenceId],
            proposal: 'Choose a quiet patio restaurant.',
            requiresExternalVerification: true,
          })],
          text: 'Choose a quiet patio restaurant.',
        }),
        commitment({
          bases: [used(row)],
          items: [recommendationItem({
            evidenceIds: [row.evidenceId],
            proposal: 'Choose a quiet patio restaurant.',
          })],
          text: 'I have a suggestion.',
        }),
      ]) {
        try {
          commitAnswer(proposal)
        } catch (error) {
          errors.push(String(error))
        }
      }
      return commitAnswer(commitment({
        bases: [used(row)],
        items: [recommendationItem({
          evidenceIds: [row.evidenceId],
          proposal: 'Choose a quiet patio restaurant.',
        })],
        text: 'Choose a quiet patio restaurant.',
      }))
    })

    const result = await answerWithRetrieval(brain, {
      ...scope,
      compositionMode: 'auto',
      provider,
      question: 'Can you suggest a restaurant style for dinner?',
    })

    assert.equal(errors.length, 3)
    assert.match(errors[0], /materially used evidence/)
    assert.match(errors[1], /verificationNote exactly when/)
    assert.match(errors[2], /proposal must appear verbatim/)
    assert.equal(result.answerRecommendation.items.length, 1)
  }))

test('honest recommendation abstention contains no fabricated proposal',
  async (t) => withBrain(t, 'recommend-abstention', async (brain) => {
    const scope = {
      palariId: 'palari-recommend-abstention',
      userId: 'user-recommend-abstention',
    }
    const memory = 'I replaced the batteries in my hallway clock.'
    await seed(brain, scope, memory)
    const provider = requireRecommendation(async ({ commitAnswer, retrieve }) => {
      const found = await retrieve({
        input: { phrase: 'batteries' },
        tool: 'memory_find',
      })
      const row = onlyUserMatch(found.matches)
      return commitAnswer(commitment({
        abstained: true,
        bases: [notUsed(row)],
        items: [],
        text: 'I do not have a relevant stored preference for that recommendation.',
      }))
    })

    const result = await answerWithRetrieval(brain, {
      ...scope,
      compositionMode: 'auto',
      provider,
      question: 'Can you recommend a restaurant for me?',
    })

    assert.equal(result.abstained, true)
    assert.deepEqual(result.answerRecommendation.items, [])
    assert.deepEqual(result.answerEvidence, [])
  }))

test('recommendation auto-detection is bounded and enumeration takes priority', () => {
  assert.equal(
    resolveMemoryAnswerCompositionMode('Can you recommend a film?'),
    'recommend',
  )
  assert.equal(
    resolveMemoryAnswerCompositionMode('What workout would you suggest?'),
    'recommend',
  )
  assert.equal(
    resolveMemoryAnswerCompositionMode('List all recommendations I saved.'),
    'enumerate',
  )
  assert.equal(
    resolveMemoryAnswerCompositionMode('Can you recommend a film?', 'standard'),
    'standard',
  )
})

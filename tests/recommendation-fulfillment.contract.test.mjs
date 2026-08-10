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

async function seed(brain, scope, text) {
  await ingestChatTurn(brain, {
    ...scope,
    assistantMessage: 'Noted.',
    eventAt: '2025-01-01T00:00:00.000Z',
    retention: 'durable',
    sourceMessageId: `${scope.userId}:preference`,
    userMessage: text,
  }, {
    reducer: keepNothing,
    reducerId: 'recommendation-fulfillment/v2',
  })
}

function requireEvidenceCommitment(provider) {
  Object.defineProperty(provider, 'requiresEvidenceCommitment', {
    enumerable: true,
    value: true,
  })
  return provider
}

function supportedCommitment({
  abstained = false,
  supportingEvidenceIds = [],
  text,
}) {
  return { abstained, supportingEvidenceIds, text }
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

test('recommendations use one answer surface plus returned supporting IDs',
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
          let evidenceId = null
          const provider = requireEvidenceCommitment(async ({
            answerSupportingEvidenceOnly,
            commitAnswer,
            retrieve,
          }) => {
            assert.equal(answerSupportingEvidenceOnly, true)
            const found = await retrieve({
              input: { phrase: entry.memory },
              tool: 'memory_find',
            })
            const row = onlyUserMatch(found.matches)
            evidenceId = row.evidenceId
            return commitAnswer(supportedCommitment({
              supportingEvidenceIds: [row.evidenceId],
              text: entry.proposal,
            }))
          })

          const result = await answerWithRetrieval(brain, {
            ...scope,
            compositionMode: 'auto',
            provider,
            question: entry.question,
          })

          assert.equal(result.answer, entry.proposal)
          assert.equal(result.answerCompositionMode, 'recommend')
          assert.equal(result.answerRecommendation, null)
          assert.deepEqual(result.selectedEvidenceIds, [evidenceId])
          assert.deepEqual(
            result.answerEvidence.map((basis) => basis.evidenceId),
            [evidenceId],
          )
          assert.match(result.answerEvidence[0].quote, new RegExp(entry.memory))
          assert.equal(
            result.evidenceCommitments[0].consequence_for_answer,
            null,
          )
        },
      ))
    }
  })

test('OpenAI recommendation commitment has no duplicate proposal surface',
  async (t) => withBrain(t, 'recommend-openai-thin', async (brain) => {
    const scope = {
      palariId: 'palari-thin',
      userId: 'user-thin',
    }
    const memory =
      'I like hotels with great views and unusual pool or balcony features.'
    const answer =
      'Consider The Setai, and verify the exact room amenities before booking.'
    await seed(brain, scope, memory)

    const bodies = []
    const provider = createOpenAIRetrievalProvider({
      async invoke({ body }) {
        bodies.push(body)
        const commitTool = body.tools?.find((tool) =>
          tool.name === OPENAI_ANSWER_COMMIT_TOOL_NAME)
        assert.ok(commitTool)
        assert.ok(
          commitTool.parameters.required.includes('supportingMemoryNumbers'),
        )
        assert.ok(!commitTool.parameters.required.includes('recommendation'))
        assert.ok(!commitTool.parameters.required.includes('bases'))
        if (bodies.length === 1) {
          return completedCall({
            args: { phrase: memory },
            callId: 'thin-search',
            name: 'memory_find',
          })
        }
        const searchOutput = body.input.find((item) =>
          item.type === 'function_call_output' &&
          item.call_id === 'thin-search')
        const found = JSON.parse(searchOutput.output)
        const row = onlyUserMatch(found.matches)
        return completedCall({
          args: {
            abstained: false,
            supportingMemoryNumbers: [row.memoryNumber],
            text: answer,
          },
          callId: 'thin-answer',
          name: OPENAI_ANSWER_COMMIT_TOOL_NAME,
        })
      },
    })

    const result = await answerWithRetrieval(brain, {
      ...scope,
      compositionMode: 'auto',
      provider,
      question: 'Can you recommend a Miami hotel?',
    })

    assert.equal(bodies.length, 2)
    assert.equal(result.answer, answer)
    assert.equal(result.answerRecommendation, null)
    assert.equal(result.selectedEvidenceIds.length, 1)
  }))

test('OpenAI recommendation repair stays on the thin commitment schema',
  async (t) => withBrain(t, 'recommend-openai-thin-repair', async (brain) => {
    const scope = {
      palariId: 'palari-thin-repair',
      userId: 'user-thin-repair',
    }
    const memory = 'I prefer calm hotels near the water.'
    const answer = 'Choose a quiet waterfront hotel and verify current rooms.'
    await seed(brain, scope, memory)

    const bodies = []
    const provider = createOpenAIRetrievalProvider({
      async invoke({ body }) {
        bodies.push(body)
        if (bodies.length === 1) {
          return completedCall({
            args: { phrase: memory },
            callId: 'repair-search',
            name: 'memory_find',
          })
        }
        const searchOutput = body.input.find((item) =>
          item.type === 'function_call_output' &&
          item.call_id === 'repair-search')
        const found = JSON.parse(searchOutput.output)
        const row = onlyUserMatch(found.matches)
        if (bodies.length === 2) {
          return completedCall({
            args: {
              abstained: false,
              supportingMemoryNumbers: [2],
              text: answer,
            },
            callId: 'invalid-support',
            name: OPENAI_ANSWER_COMMIT_TOOL_NAME,
          })
        }
        assert.match(body.instructions, /supportingMemoryNumbers/)
        assert.doesNotMatch(body.instructions, /copy an exact contiguous quote/)
        assert.doesNotMatch(body.instructions, /consequence_for_answer/)
        const rejection = body.input.find((item) =>
          item.type === 'function_call_output' &&
          item.call_id === 'invalid-support')
        assert.match(
          JSON.parse(rejection.output).rejection,
          /memoryNumber.*shown/,
        )
        return completedCall({
          args: {
            abstained: false,
            supportingMemoryNumbers: [row.memoryNumber],
            text: answer,
          },
          callId: 'repaired-support',
          name: OPENAI_ANSWER_COMMIT_TOOL_NAME,
        })
      },
    })

    const result = await answerWithRetrieval(brain, {
      ...scope,
      compositionMode: 'auto',
      provider,
      question: 'Can you recommend a hotel?',
    })

    assert.equal(bodies.length, 3)
    assert.equal(result.answer, answer)
    assert.equal(result.selectedEvidenceIds.length, 1)
  }))

test('thin host rejects unknown, duplicate, and absent supporting IDs',
  async (t) => withBrain(t, 'recommend-thin-controls', async (brain) => {
    const scope = {
      palariId: 'palari-thin-controls',
      userId: 'user-thin-controls',
    }
    const memory = 'I prefer quiet restaurants with outdoor seating.'
    await seed(brain, scope, memory)
    const errors = []
    const provider = requireEvidenceCommitment(async ({
      commitAnswer,
      retrieve,
    }) => {
      const found = await retrieve({
        input: { phrase: memory },
        tool: 'memory_find',
      })
      const row = onlyUserMatch(found.matches)
      for (const candidate of [
        supportedCommitment({
          supportingEvidenceIds: ['not-returned'],
          text: 'Choose a quiet patio restaurant.',
        }),
        supportedCommitment({
          supportingEvidenceIds: [row.evidenceId, row.evidenceId],
          text: 'Choose a quiet patio restaurant.',
        }),
        supportedCommitment({
          supportingEvidenceIds: [],
          text: 'Choose a quiet patio restaurant.',
        }),
      ]) {
        try {
          commitAnswer(candidate)
        } catch (error) {
          errors.push(String(error))
        }
      }
      return commitAnswer(supportedCommitment({
        supportingEvidenceIds: [row.evidenceId],
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
    assert.match(errors[0], /not returned in this answer session/)
    assert.match(errors[1], /duplicated/)
    assert.match(errors[2], /must contain 1 to/)
    assert.equal(result.answer, 'Choose a quiet patio restaurant.')
  }))

test('honest recommendation abstention cites no supporting memory',
  async (t) => withBrain(t, 'recommend-abstention', async (brain) => {
    const scope = {
      palariId: 'palari-recommend-abstention',
      userId: 'user-recommend-abstention',
    }
    await seed(brain, scope, 'I replaced the hallway clock batteries.')
    const provider = requireEvidenceCommitment(async ({
      commitAnswer,
      retrieve,
    }) => {
      await retrieve({
        input: { phrase: 'batteries' },
        tool: 'memory_find',
      })
      return commitAnswer(supportedCommitment({
        abstained: true,
        supportingEvidenceIds: [],
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
    assert.equal(result.answerRecommendation, null)
    assert.deepEqual(result.answerEvidence, [])
    assert.deepEqual(result.selectedEvidenceIds, [])
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

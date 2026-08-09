import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  MEMORY_ANSWER_CONFIRMATION_INSTRUCTIONS,
  MEMORY_ANSWER_CONFIRMATION_SCHEMA,
  answerWithRetrieval,
  createPalariBrain,
  ingestChatTurn,
} from '../src/index.mjs'

const SCOPE = Object.freeze({
  palariId: 'palari-confirmation',
  userId: 'user-confirmation',
})

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

function requireCommitment(provider) {
  Object.defineProperty(provider, 'requiresEvidenceCommitment', {
    value: true,
  })
  return provider
}

async function openBrain(t) {
  const root = await mkdtemp(join(tmpdir(), 'palari-answer-confirmation-'))
  const brain = await createPalariBrain({
    memoryEnabled: true,
    statePath: join(root, 'state.json'),
    workspaceId: 'answer-confirmation',
  })
  t.after(async () => {
    brain.close()
    await rm(root, { force: true, recursive: true })
  })
  return brain
}

async function seed(brain, userMessage, sourceMessageId) {
  await ingestChatTurn(brain, {
    ...SCOPE,
    assistantMessage: 'Recorded without adding an inferred memory.',
    eventAt: '2026-01-01T00:00:00.000Z',
    retention: 'durable',
    sourceMessageId,
    userMessage,
  }, {
    reducer: keepNothing,
    reducerId: 'answer-confirmation-test/v1',
  })
}

function proposal(text, rows) {
  return {
    abstained: false,
    bases: rows.map((row) => ({
      consequence_for_answer: 'This directly changes the answer.',
      evidenceId: row.evidenceId,
      not_used_reason: '',
      quote: row.text,
    })),
    temporaryInferences: [],
    text,
  }
}

test('fresh reviewer revises on novelty and closes only after no new evidence',
  async (t) => {
    assert.match(MEMORY_ANSWER_CONFIRMATION_INSTRUCTIONS, /fresh, adversarial/)
    assert.match(MEMORY_ANSWER_CONFIRMATION_INSTRUCTIONS, /no new evidence/)
    const brain = await openBrain(t)
    await seed(brain, 'I use a blood pressure monitor and a glucose meter.', 'health-old:0')
    await seed(brain, 'I also use hearing aids and a nebulizer.', 'health-new:0')
    const before = structuredClone(brain.exploreFind(SCOPE, {
      limit: 20,
      maxChars: 20_000,
      phrase: 'blood pressure monitor glucose meter hearing aids nebulizer',
      ranked: true,
    }))
    let oldRow
    let provisional
    const provider = requireCommitment(async ({ commitAnswer, retrieve }) => {
      const found = await retrieve({
        input: { limit: 1, phrase: 'blood pressure monitor glucose meter' },
        tool: 'memory_search',
      })
      oldRow = found.matches[0]
      assert.ok(oldRow)
      provisional = commitAnswer(proposal('You use two health devices.', [
        oldRow,
      ]))
      return provisional
    })
    let reviewerInvocations = 0
    const confirmationProvider = requireCommitment(async (context) => {
      reviewerInvocations += 1
      assert.deepEqual(
        context.retrievalTools.map(({ name }) => name),
        ['memory_search'],
      )
      assert.match(context.answerInstructions, /fresh, adversarial/)
      assert.match(context.memoryText, /provisionalAnswer/)
      assert.throws(
        () => context.commitAnswer(proposal('Premature.', [oldRow])),
        (error) => error.code === 'MEMORY_ANSWER_CONFIRMATION_REQUIRED',
      )
      const novel = await context.retrieve({
        input: { limit: 20, phrase: 'health devices I own and use' },
        tool: 'memory_search',
      })
      assert.equal(novel.newEvidenceOnly, true)
      assert.ok(novel.excludedCandidates >= 1)
      assert.ok(novel.matches.length >= 1)
      assert.ok(novel.matches.every((row) =>
        row.evidenceId !== oldRow.evidenceId))
      const newRow = novel.matches.find((row) =>
        row.speaker === 'user' && row.text.includes('hearing aids'))
      assert.ok(newRow)
      assert.throws(
        () => context.commitAnswer(proposal('Still premature.', [oldRow, newRow])),
        (error) => error.code === 'MEMORY_ANSWER_CONFIRMATION_REQUIRED',
      )
      const closed = await context.retrieve({
        input: { limit: 20, phrase: 'health devices I own and use' },
        tool: 'memory_search',
      })
      assert.deepEqual(closed.matches, [])
      return context.commitAnswer(proposal(
        'You use four health devices: a blood pressure monitor, glucose meter, hearing aids, and a nebulizer.',
        [oldRow, newRow],
      ))
    })

    const result = await answerWithRetrieval(brain, {
      ...SCOPE,
      confirmationProvider,
      maxConfirmationRetrievalCalls: 2,
      provider,
      question: 'How many health devices do I use?',
    })

    assert.equal(reviewerInvocations, 1)
    assert.equal(result.answerCommitted, true)
    assert.match(result.answer, /four health devices/)
    assert.equal(result.retrievalCalls, 1)
    assert.equal(result.answerConfirmation.schema,
      MEMORY_ANSWER_CONFIRMATION_SCHEMA)
    assert.equal(result.answerConfirmation.status, 'closed_no_new_evidence')
    assert.equal(result.answerConfirmation.retrievalCalls, 2)
    assert.equal(result.answerConfirmation.newEvidenceIds.length,
      result.answerConfirmation.retrievalFrontier.seenEvidenceIds.length)
    assert.equal(result.answerConfirmation.durableWrites, 0)
    assert.equal(result.retrievalTranscript.at(-1).phase,
      'answer_confirmation')
    assert.deepEqual(brain.exploreFind(SCOPE, {
      limit: 20,
      maxChars: 20_000,
      phrase: 'blood pressure monitor glucose meter hearing aids nebulizer',
      ranked: true,
    }), before)
  })

test('confirmation can accept a complete draft after one empty unseen search',
  async (t) => {
    const brain = await openBrain(t)
    await seed(brain, 'My archive key is stored in the violet folder.', 'archive:0')
    let draft
    const provider = requireCommitment(async ({ commitAnswer, retrieve }) => {
      const found = await retrieve({
        input: { limit: 20, phrase: 'archive key violet folder' },
        tool: 'memory_search',
      })
      const userRow = found.matches.find((row) => row.speaker === 'user')
      draft = proposal('Your archive key is in the violet folder.', [userRow])
      return commitAnswer(draft)
    })
    const confirmationProvider = requireCommitment(async (context) => {
      const result = await context.retrieve({
        input: { limit: 20, phrase: 'archive key storage location' },
        tool: 'memory_search',
      })
      assert.deepEqual(result.matches, [])
      return context.commitAnswer(draft)
    })

    const result = await answerWithRetrieval(brain, {
      ...SCOPE,
      confirmationProvider,
      provider,
      question: 'Where is my archive key?',
    })
    assert.equal(result.answerConfirmation.retrievalCalls, 1)
    assert.deepEqual(result.answerConfirmation.newEvidenceIds, [])
    assert.equal(result.answer, draft.text)
  })

test('confirmation fails closed when its final bounded round finds novelty',
  async (t) => {
    const brain = await openBrain(t)
    await seed(brain, 'The project codename was Cedar.', 'project-old:0')
    await seed(brain, 'The project codename is now Juniper.', 'project-new:0')
    let oldRow
    let provisional
    const provider = requireCommitment(async ({ commitAnswer, retrieve }) => {
      const found = await retrieve({
        input: { limit: 1, phrase: 'codename Cedar' },
        tool: 'memory_search',
      })
      oldRow = found.matches[0]
      assert.ok(oldRow)
      provisional = commitAnswer(proposal('The codename is Cedar.', [
        oldRow,
      ]))
      return provisional
    })
    const confirmationProvider = requireCommitment(async (context) => {
      const novel = await context.retrieve({
        input: { limit: 20, phrase: 'current project codename' },
        tool: 'memory_search',
      })
      assert.ok(novel.matches.some((row) => row.text.includes('Juniper')))
      return provisional
    })

    await assert.rejects(
      answerWithRetrieval(brain, {
        ...SCOPE,
        confirmationProvider,
        maxConfirmationRetrievalCalls: 1,
        provider,
        question: 'What is the current project codename?',
      }),
      (error) => error.code === 'MEMORY_ANSWER_CONFIRMATION_INCOMPLETE',
    )
  })

import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  MEMORY_ANSWER_CONFIRMATION_INSTRUCTIONS,
  MEMORY_ANSWER_CONFIRMATION_REVIEW_TOOL,
  MEMORY_ANSWER_CONFIRMATION_SCHEMA,
  MEMORY_ANSWER_CONFIRMATION_TOOLS,
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

async function openBrain(t, options = {}) {
  const root = await mkdtemp(join(tmpdir(), 'palari-answer-confirmation-'))
  const brain = await createPalariBrain({
    memoryEnabled: true,
    ...options,
    statePath: join(root, 'state.json'),
    workspaceId: 'answer-confirmation',
  })
  t.after(async () => {
    brain.close()
    await rm(root, { force: true, recursive: true })
  })
  return brain
}

async function seed(brain, userMessage, sourceMessageId, {
  assistantMessage = 'Recorded without adding an inferred memory.',
  eventAt = '2026-01-01T00:00:00.000Z',
} = {}) {
  await ingestChatTurn(brain, {
    ...SCOPE,
    assistantMessage,
    eventAt,
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

function reviewCandidates(context, rows, disposition) {
  return context.retrieve({
    input: {
      findings: disposition === 'material'
        ? rows.map((row) => ({
            candidateNumber: row.candidateNumber,
            reason: 'This adds information that may change the answer.',
          }))
        : [],
    },
    tool: 'memory_candidate_review',
  })
}

test('sparse candidate reviews reject invalid numbers and close with no findings',
  async (t) => {
    assert.equal(
      MEMORY_ANSWER_CONFIRMATION_SCHEMA,
      'palari-answer-confirmation/v9',
    )
    const reviewSchema = MEMORY_ANSWER_CONFIRMATION_REVIEW_TOOL.parameters
    assert.deepEqual(Object.keys(reviewSchema.properties), ['findings'])
    const findingSchema = reviewSchema.properties.findings.items
    assert.deepEqual(
      Object.keys(findingSchema.properties).sort(),
      ['candidateNumber', 'reason'],
    )
    assert.deepEqual(
      [...findingSchema.required].sort(),
      ['candidateNumber', 'reason'],
    )
    assert.match(MEMORY_ANSWER_CONFIRMATION_INSTRUCTIONS,
      /return only findings that materially/)
    assert.match(MEMORY_ANSWER_CONFIRMATION_INSTRUCTIONS,
      /empty findings list/)
    assert.match(MEMORY_ANSWER_CONFIRMATION_INSTRUCTIONS,
      /candidatePageComplete separately from lowerRankedCandidatesAvailable/)
    const searchSchema = MEMORY_ANSWER_CONFIRMATION_TOOLS.find(
      ({ name }) => name === 'memory_search',
    ).parameters
    assert.deepEqual(
      Object.keys(searchSchema.properties).sort(),
      ['after', 'before', 'phrase'],
    )
    assert.ok(!Object.hasOwn(searchSchema.properties, 'limit'))
    assert.ok(!Object.hasOwn(searchSchema.properties, 'maxChars'))

    async function runReview(buildInput, verifyReview = () => {}) {
      const brain = await openBrain(t)
      await seed(brain, 'My archive key is in the violet folder.',
        'binding-old:0')
      await seed(brain, 'My spare archive key is in the amber drawer.',
        'binding-new:0')
      await seed(brain, 'My backup archive key is in the green cabinet.',
        'binding-backup:0')
      let original
      const provider = requireCommitment(async ({ commitAnswer, retrieve }) => {
        const found = await retrieve({
          input: { limit: 1, phrase: 'archive key violet folder' },
          tool: 'memory_search',
        })
        original = found.matches[0]
        return commitAnswer(proposal('The key is in the violet folder.', [
          original,
        ]))
      })
      const confirmationProvider = requireCommitment(async (context) => {
        const candidates = await context.retrieve({
          input: { limit: 20, phrase: 'spare archive key amber drawer' },
          tool: 'memory_search',
        })
        assert.ok(candidates.matches.length >= 2)
        assert.deepEqual(
          candidates.matches.map(({ candidateNumber }) => candidateNumber),
          candidates.matches.map((_, index) => index + 1),
        )
        const review = await context.retrieve({
          input: buildInput(candidates.matches),
          tool: 'memory_candidate_review',
        })
        await verifyReview(review, candidates.matches, context)
        return context.commitAnswer(proposal(
          'The key is in the violet folder.',
          [original],
        ))
      })
      return answerWithRetrieval(brain, {
        ...SCOPE,
        confirmationProvider,
        provider,
        question: 'Where is my archive key?',
      })
    }

    await assert.rejects(
      runReview((matches) => ({
        assessments: matches.map(() => ({
          disposition: 'not_used',
          reason: 'Legacy ordered assessment.',
        })),
      })),
      /findings must be a data property/,
    )
    await assert.rejects(
      runReview((matches) => ({
        findings: [{
          candidateNumber: 1,
          evidenceId: matches[0].evidenceId,
          reason: 'Opaque IDs are not accepted.',
        }],
      })),
      /unsupported or missing fields/,
    )
    await assert.rejects(
      runReview(() => ({
        findings: [{ reason: 'Candidate number is missing.' }],
      })),
      /unsupported or missing fields/,
    )
    await assert.rejects(
      runReview(() => ({
        findings: [{ candidateNumber: 1 }],
      })),
      /unsupported or missing fields/,
    )
    for (const candidateNumber of [0, -1, 1.5, 99]) {
      await assert.rejects(
        runReview(() => ({
          findings: [{
            candidateNumber,
            reason: 'Invalid page-local candidate number.',
          }],
        })),
        /candidateNumber must be a latest page integer/,
      )
    }
    await assert.rejects(
      runReview(() => ({
        findings: [
          { candidateNumber: 1, reason: 'First copy.' },
          { candidateNumber: 1, reason: 'Duplicate copy.' },
        ],
      })),
      /candidateNumber 1 is duplicated/,
    )
    await assert.rejects(
      runReview(() => ({ findings: [] }),
        async (_review, _matches, context) => {
          await assert.rejects(
            context.retrieve({
              input: { findings: [] },
              tool: 'memory_candidate_review',
            }),
            /latest non-empty unassessed confirmation search/,
          )
        }),
      /latest non-empty unassessed confirmation search/,
    )
    const result = await runReview(() => ({ findings: [] }),
      (review, matches) => {
      assert.deepEqual(
        review.assessedEvidenceIds,
        matches.map(({ evidenceId }) => evidenceId),
      )
      assert.deepEqual(
        review.ignoredEvidenceIds,
        matches.map(({ evidenceId }) => evidenceId),
      )
      assert.deepEqual(review.materialEvidenceIds, [])
    })
    assert.equal(result.answer, 'The key is in the violet folder.')
    assert.equal(result.answerConfirmation.reviewCalls, 1)
    assert.equal(result.answerConfirmation.closureReason,
      'no_material_findings')
  })

test('sparse findings bind explicit candidate numbers independent of order',
  async (t) => {
    const brain = await openBrain(t)
    await seed(brain, 'My primary archive key is in the violet folder.',
      'sparse-old:0')
    await seed(brain, 'My spare archive key is in the amber drawer.',
      'sparse-new:0')
    await seed(brain, 'My backup archive key is in the green cabinet.',
      'sparse-backup:0')
    let original
    const provider = requireCommitment(async ({ commitAnswer, retrieve }) => {
      const found = await retrieve({
        input: { limit: 1, phrase: 'primary archive key violet folder' },
        tool: 'memory_search',
      })
      original = found.matches[0]
      return commitAnswer(proposal('The primary key is in violet.', [original]))
    })
    let materialRows
    const confirmationProvider = requireCommitment(async (context) => {
      const candidates = await context.retrieve({
        input: { phrase: 'spare backup archive key locations' },
        tool: 'memory_search',
      })
      assert.ok(candidates.matches.length >= 2)
      materialRows = [candidates.matches.at(-1), candidates.matches[0]]
      const review = await context.retrieve({
        input: {
          findings: materialRows.map((row) => ({
            candidateNumber: row.candidateNumber,
            reason: 'This adds another archive-key location.',
          })),
        },
        tool: 'memory_candidate_review',
      })
      assert.deepEqual(
        review.materialEvidenceIds,
        materialRows.map(({ evidenceId }) => evidenceId),
      )
      assert.equal(review.closed, false)
      const closed = await context.retrieve({
        input: { phrase: 'spare backup archive key locations' },
        tool: 'memory_search',
      })
      assert.deepEqual(closed.matches, [])
      return context.commitAnswer(proposal(
        'The primary key is in violet; spare keys are also recorded.',
        [original, ...materialRows],
      ))
    })

    const result = await answerWithRetrieval(brain, {
      ...SCOPE,
      confirmationProvider,
      maxConfirmationRetrievalCalls: 2,
      provider,
      question: 'Where are my archive keys?',
    })
    assert.equal(result.answerConfirmation.reviewCalls, 1)
    assert.deepEqual(
      result.answerConfirmation.newInformationEvidenceIds,
      materialRows.map(({ evidenceId }) => evidenceId),
    )
  })

test('fresh reviewer revises on novelty and closes only after no new information',
  async (t) => {
    assert.match(MEMORY_ANSWER_CONFIRMATION_INSTRUCTIONS, /fresh, adversarial/)
    assert.match(MEMORY_ANSWER_CONFIRMATION_INSTRUCTIONS, /no new information/)
    const brain = await openBrain(t)
    await seed(brain, 'I use a blood pressure monitor and a glucose meter.', 'health-old:0')
    await seed(brain, 'I USE A BLOOD PRESSURE MONITOR AND A GLUCOSE METER.', 'health-old-copy:0')
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
        ['memory_search', 'memory_candidate_review'],
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
      assert.equal(novel.newInformationOnly, true)
      assert.ok(novel.excludedCandidates >= 1)
      assert.ok(novel.excludedDuplicateInformationCount >= 1)
      assert.ok(novel.matches.length >= 1)
      assert.ok(novel.matches.every((row) =>
        row.evidenceId !== oldRow.evidenceId &&
        !row.text.includes('blood pressure monitor')))
      const newRow = novel.matches.find((row) =>
        row.speaker === 'user' && row.text.includes('hearing aids'))
      assert.ok(newRow)
      const review = await reviewCandidates(context, novel.matches, 'material')
      assert.equal(review.continueSearch, true)
      assert.equal(review.closed, false)
      assert.throws(
        () => context.commitAnswer(proposal(
          'Still premature.',
          [oldRow, ...novel.matches],
        )),
        (error) => error.code === 'MEMORY_ANSWER_CONFIRMATION_REQUIRED',
      )
      const closed = await context.retrieve({
        input: { limit: 20, phrase: 'health devices I own and use' },
        tool: 'memory_search',
      })
      assert.deepEqual(closed.matches, [])
      return context.commitAnswer(proposal(
        'You use four health devices: a blood pressure monitor, glucose meter, hearing aids, and a nebulizer.',
        [oldRow, ...novel.matches],
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
    assert.equal(result.answerConfirmation.status,
      'closed_no_new_material_information')
    assert.equal(result.answerConfirmation.retrievalCalls, 2)
    assert.equal(result.answerConfirmation.reviewCalls, 1)
    assert.equal(result.answerConfirmation.newEvidenceIds.length,
      result.answerConfirmation.retrievalFrontier.seenEvidenceIds.length)
    assert.equal(result.answerConfirmation.durableWrites, 0)
    assert.ok(result.answerConfirmation.suppressedDuplicateInformationCount >= 1)
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
    await seed(brain, 'MY ARCHIVE KEY IS STORED IN THE VIOLET FOLDER.', 'archive-copy:0')
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
      const contextEvidence = JSON.parse(context.memoryText)
        .previouslyReturnedEvidence
      assert.equal(contextEvidence.filter((row) =>
        row.speaker === 'user' &&
        row.text.toLowerCase().includes('archive key')).length, 1)
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
    assert.ok(result.answerConfirmation.priorDuplicateInformationCount >= 1)
    assert.equal(result.answer, draft.text)
  })

test('reviewer can close with no findings without explaining every paraphrase',
  async (t) => {
    const brain = await openBrain(t)
    await seed(brain,
      'I participated in Dance for a Cause on May 1.',
      'dance-original:0')
    await seed(brain,
      'On May 1, I took part in the Dance for a Cause fundraiser.',
      'dance-paraphrase:0')
    let original
    const provider = requireCommitment(async ({ commitAnswer, retrieve }) => {
      const found = await retrieve({
        input: { limit: 1, phrase: 'participated Dance for a Cause May 1' },
        tool: 'memory_search',
      })
      original = found.matches[0]
      return commitAnswer(proposal('You joined one event.', [original]))
    })
    let ignored
    const confirmationProvider = requireCommitment(async (context) => {
      const candidates = await context.retrieve({
        input: { limit: 20, phrase: 'Dance for a Cause fundraiser May 1' },
        tool: 'memory_search',
      })
      assert.ok(candidates.matches.length >= 1)
      ignored = candidates.matches
      const review = await reviewCandidates(
        context,
        ignored,
        'not_used',
      )
      assert.equal(review.closed, true)
      assert.equal(review.continueSearch, false)
      return context.commitAnswer(proposal('You joined one event.', [original]))
    })

    const result = await answerWithRetrieval(brain, {
      ...SCOPE,
      confirmationProvider,
      provider,
      question: 'How many Dance for a Cause events did I join?',
    })
    assert.equal(result.answer, 'You joined one event.')
    assert.equal(result.answerConfirmation.closureReason,
      'no_material_findings')
    assert.deepEqual(result.answerConfirmation.newInformationEvidenceIds, [])
    assert.deepEqual(
      result.answerEvidence.map(({ evidenceId }) => evidenceId),
      [original.evidenceId],
    )
    assert.deepEqual(
      new Set(result.answerConfirmation.ignoredCandidateEvidenceIds),
      new Set(ignored.map(({ evidenceId }) => evidenceId)),
    )
  })

test('a complete top-k review can close despite a lower-ranked tail',
  async (t) => {
    const brain = await openBrain(t)
    for (let index = 0; index < 22; index += 1) {
      await seed(
        brain,
        `Catalog item ${index} stores code ${1000 + index}.`,
        `catalog:${index}`,
      )
    }
    let original
    const provider = requireCommitment(async ({ commitAnswer, retrieve }) => {
      const found = await retrieve({
        input: { limit: 1, phrase: 'catalog item 0 stores code 1000' },
        tool: 'memory_search',
      })
      original = found.matches[0]
      assert.ok(original)
      return commitAnswer(proposal(
        'Catalog item zero stores code 1000.',
        [original],
      ))
    })
    const confirmationProvider = requireCommitment(async (context) => {
      const candidates = await context.retrieve({
        input: { limit: 50, phrase: 'catalog item stores code' },
        tool: 'memory_search',
      })
      assert.equal(candidates.matches.length, 20)
      assert.equal(candidates.candidatePageComplete, true)
      assert.equal(candidates.lowerRankedCandidatesAvailable, true)
      assert.equal(candidates.moreCandidatesAvailable, true)
      assert.equal(candidates.truncatedByChars, false)
      assert.equal(candidates.truncatedByLimit, true)
      const review = await reviewCandidates(
        context,
        candidates.matches,
        'not_used',
      )
      assert.equal(review.candidatePageComplete, true)
      assert.equal(review.lowerRankedCandidatesAvailable, true)
      assert.equal(review.saturatedCandidateBatch, false)
      assert.equal(review.continueSearch, false)
      assert.equal(review.closed, true)
      return context.commitAnswer(proposal(
        'Catalog item zero stores code 1000.',
        [original],
      ))
    })

    const result = await answerWithRetrieval(brain, {
      ...SCOPE,
      confirmationProvider,
      maxConfirmationRetrievalCalls: 2,
      provider,
      question: 'What code does catalog item zero store?',
    })
    assert.equal(result.answerConfirmation.retrievalCalls, 1)
    assert.equal(result.answerConfirmation.reviewCalls, 1)
    assert.equal(result.answerConfirmation.closureCandidatePageComplete, true)
    assert.equal(
      result.answerConfirmation.closureLowerRankedCandidatesAvailable,
      true,
    )
  })

test('confirmation filters a broad pool before bounded reranker dispatch',
  async (t) => {
    const rerankBatchSizes = []
    const brain = await openBrain(t, {
      async reranker(_query, texts) {
        rerankBatchSizes.push(texts.length)
        return texts.map((_, index) => -index)
      },
    })
    for (let index = 0; index < 80; index += 1) {
      await seed(
        brain,
        `Archive record ${index} has unique catalog value ${10_000 + index}.`,
        `bounded-rerank:${index}`,
      )
    }
    let originalRows
    const provider = requireCommitment(async ({ commitAnswer, retrieve }) => {
      const found = await retrieve({
        input: { limit: 20, phrase: 'archive record unique catalog value' },
        tool: 'memory_search',
      })
      originalRows = found.matches
      assert.equal(originalRows.length, 20)
      return commitAnswer(proposal(
        'The first reviewed archive records are retained.',
        originalRows,
      ))
    })
    const confirmationProvider = requireCommitment(async (context) => {
      const candidates = await context.retrieve({
        input: { phrase: 'archive record unique catalog value' },
        tool: 'memory_search',
      })
      assert.equal(candidates.rerankCandidates, 50)
      assert.equal(candidates.matches.length, 20)
      assert.equal(candidates.candidatePageComplete, true)
      assert.equal(candidates.lowerRankedCandidatesAvailable, true)
      await reviewCandidates(context, candidates.matches, 'not_used')
      return context.commitAnswer(proposal(
        'The first reviewed archive records are retained.',
        originalRows,
      ))
    })
    const result = await answerWithRetrieval(brain, {
      ...SCOPE,
      confirmationProvider,
      provider,
      question: 'Which archive records were reviewed?',
    })
    assert.equal(result.answerConfirmation.closureReason,
      'no_material_findings')
    assert.ok(rerankBatchSizes.includes(50))
    assert.ok(rerankBatchSizes.every((size) => size <= 50))
  })

test('character-truncated confirmation stays open and pages compact user evidence',
  async (t) => {
    const brain = await openBrain(t)
    for (let index = 0; index < 16; index += 1) {
      await seed(
        brain,
        `Long catalog device ${index} begins here. ` +
          `${'\\'.repeat(2_000)}` +
          `Exact marker ${index} confirms daily use.`,
        `long-catalog:${index}`,
      )
    }
    let original
    let provisional
    const provider = requireCommitment(async ({ commitAnswer, retrieve }) => {
      const found = await retrieve({
        input: { limit: 1, phrase: 'Long catalog device 0 Exact marker 0' },
        tool: 'memory_search',
      })
      original = found.matches[0]
      provisional = commitAnswer(proposal(
        'The first catalog device is recorded.',
        [{
          ...original,
          text: 'Long catalog device 0 begins here.',
        }],
      ))
      return provisional
    })
    const pages = []
    const confirmationProvider = requireCommitment(async (context) => {
      const first = await context.retrieve({
        input: {
          // These legacy model-authored controls are intentionally ignored;
          // the confirmation host owns both budgets.
          limit: 1,
          maxChars: 1,
          phrase: 'long catalog device exact marker confirms daily use',
        },
        tool: 'memory_search',
      })
      pages.push(first.matches)
      assert.ok(first.matches.length > 1)
      assert.ok(first.matches.length < 20)
      assert.equal(first.candidatePageComplete, false)
      assert.equal(first.lowerRankedCandidatesAvailable, false)
      assert.equal(first.truncatedByChars, true)
      assert.equal(first.moreCandidatesAvailable, true)
      assert.equal(first.candidateExcerptChars, 800)
      assert.ok(first.matches.every((row) => row.speaker === 'user'))
      assert.ok(first.matches.every((row) =>
        row.text.length <= first.candidateExcerptChars &&
        row.sourceTextChars > row.text.length &&
        row.textIsPartial === true))
      const canonical = brain.exploreRead(SCOPE, {
        evidenceIds: [first.matches[0].evidenceId],
        limit: 1,
        maxChars: 20_000,
      }).messages[0]
      assert.ok(canonical.text.includes(first.matches[0].text))
      assert.ok(canonical.text.length > first.matches[0].text.length)
      const firstReview = await reviewCandidates(
        context,
        first.matches,
        'not_used',
      )
      assert.equal(firstReview.closed, false)
      assert.equal(firstReview.continueSearch, true)
      assert.equal(firstReview.candidatePageComplete, false)
      assert.equal(firstReview.saturatedCandidateBatch, true)

      const second = await context.retrieve({
        input: { phrase: 'long catalog device exact marker confirms daily use' },
        tool: 'memory_search',
      })
      pages.push(second.matches)
      assert.ok(second.matches.length >= 1)
      assert.equal(second.candidatePageComplete, true)
      assert.equal(second.moreCandidatesAvailable, false)
      const secondReview = await reviewCandidates(
        context,
        second.matches,
        'not_used',
      )
      assert.equal(secondReview.candidatePageComplete, true)
      assert.equal(secondReview.closed, true)
      return context.commitAnswer(proposal(
        'The first catalog device is recorded.',
        [{
          ...original,
          text: 'Long catalog device 0 begins here.',
        }],
      ))
    })

    const result = await answerWithRetrieval(brain, {
      ...SCOPE,
      confirmationProvider,
      maxConfirmationRetrievalCalls: 2,
      provider,
      question: 'What does the first catalog device record?',
    })
    const firstIds = new Set(pages[0].map(({ evidenceId }) => evidenceId))
    assert.ok(pages[1].every(({ evidenceId }) => !firstIds.has(evidenceId)))
    assert.equal(result.answerConfirmation.retrievalCalls, 2)
    assert.equal(result.answerConfirmation.reviewCalls, 2)
    assert.equal(result.answerConfirmation.durableWrites, 0)
  })

test('same words at a different observation time remain genuinely new',
  async (t) => {
    const brain = await openBrain(t)
    const text = 'My emergency contact is Morgan.'
    await seed(brain, text, 'contact-old:0', {
      eventAt: '2026-01-01T00:00:00.000Z',
    })
    await seed(brain, text, 'contact-new:0', {
      eventAt: '2026-02-01T00:00:00.000Z',
    })
    let provisional
    let oldRow
    const provider = requireCommitment(async ({ commitAnswer, retrieve }) => {
      const old = await retrieve({
        input: {
          before: '2026-01-01T23:59:59.999Z',
          limit: 20,
          phrase: 'emergency contact Morgan',
        },
        tool: 'memory_search',
      })
      oldRow = old.matches.find((row) => row.speaker === 'user')
      assert.ok(oldRow)
      provisional = proposal('Your emergency contact is Morgan.', [oldRow])
      return commitAnswer(provisional)
    })
    const confirmationProvider = requireCommitment(async (context) => {
      const novel = await context.retrieve({
        input: { limit: 20, phrase: 'emergency contact Morgan' },
        tool: 'memory_search',
      })
      const later = novel.matches.find((row) =>
        row.speaker === 'user' &&
        row.observedAt === '2026-02-01T00:00:00.000Z')
      assert.ok(later)
      assert.notEqual(later.evidenceId, oldRow.evidenceId)
      await reviewCandidates(context, novel.matches, 'material')
      assert.throws(
        () => context.commitAnswer(proposal(
          'Your emergency contact is still Morgan.',
          [oldRow, ...novel.matches],
        )),
        (error) => error.code === 'MEMORY_ANSWER_CONFIRMATION_REQUIRED',
      )
      const closed = await context.retrieve({
        input: { limit: 20, phrase: 'emergency contact Morgan' },
        tool: 'memory_search',
      })
      assert.deepEqual(closed.matches, [])
      return context.commitAnswer(proposal(
        'Your emergency contact is Morgan, confirmed again in February.',
        [oldRow, ...novel.matches],
      ))
    })

    const result = await answerWithRetrieval(brain, {
      ...SCOPE,
      confirmationProvider,
      maxConfirmationRetrievalCalls: 2,
      provider,
      question: 'Who is my emergency contact?',
    })
    assert.match(result.answer, /confirmed again in February/)
    assert.equal(result.answerConfirmation.newInformationEvidenceIds.length, 1)
  })

test('same words from Palari cannot hide direct user evidence', async (t) => {
  const brain = await openBrain(t)
  const text = 'The workshop access code is 4821.'
  await seed(brain, text, 'authority:0', { assistantMessage: text })
  const located = brain.exploreFind(SCOPE, {
    limit: 20,
    maxChars: 20_000,
    phrase: 'workshop access code 4821',
    ranked: true,
  })
  const palariRow = located.matches.find((row) => row.speaker === 'Palari')
  assert.ok(palariRow)
  let provisional
  const provider = requireCommitment(async ({ commitAnswer, retrieve }) => {
    const read = await retrieve({
      input: { evidenceIds: [palariRow.evidenceId] },
      tool: 'memory_read',
    })
    provisional = proposal('Palari previously stated that the code is 4821.', [
      read.messages[0],
    ])
    return commitAnswer(provisional)
  })
  const confirmationProvider = requireCommitment(async (context) => {
    const novel = await context.retrieve({
      input: { limit: 20, phrase: 'workshop access code 4821' },
      tool: 'memory_search',
    })
    const userRow = novel.matches.find((row) => row.speaker === 'user')
    assert.ok(userRow)
    assert.equal(userRow.text, text)
    await reviewCandidates(context, novel.matches, 'material')
    assert.throws(
      () => context.commitAnswer(proposal(
        'You directly stated that the workshop access code is 4821.',
        novel.matches,
      )),
      (error) => error.code === 'MEMORY_ANSWER_CONFIRMATION_REQUIRED',
    )
    const closed = await context.retrieve({
      input: { limit: 20, phrase: 'workshop access code 4821' },
      tool: 'memory_search',
    })
    assert.deepEqual(closed.matches, [])
    return context.commitAnswer(proposal(
      'You directly stated that the workshop access code is 4821.',
      novel.matches,
    ))
  })

  const result = await answerWithRetrieval(brain, {
    ...SCOPE,
    confirmationProvider,
    maxConfirmationRetrievalCalls: 2,
    provider,
    question: 'What is the workshop access code?',
  })
  assert.match(result.answer, /You directly stated/)
  assert.equal(result.answerConfirmation.newInformationEvidenceIds.length, 1)
})

test('the default reviewer can follow three material rounds with a clean check',
  async (t) => {
    const brain = await openBrain(t)
    const facts = [
      ['The obsidian lighthouse code is 813.', 'model-loop:0'],
      ['The amber greenhouse code is 274.', 'model-loop:1'],
      ['The cobalt observatory code is 659.', 'model-loop:2'],
      ['The silver foundry code is 402.', 'model-loop:3'],
    ]
    for (const [text, sourceMessageId] of facts) {
      await seed(brain, text, sourceMessageId)
    }
    let original
    const provider = requireCommitment(async ({ commitAnswer, retrieve }) => {
      const found = await retrieve({
        input: { limit: 1, phrase: 'obsidian lighthouse 813' },
        tool: 'memory_search',
      })
      original = found.matches.find((row) => row.speaker === 'user')
      assert.ok(original)
      return commitAnswer(proposal('The first code is 813.', [original]))
    })
    const materialRows = []
    const confirmationProvider = requireCommitment(async (context) => {
      for (const phrase of [
        'amber greenhouse 274',
        'cobalt observatory 659',
        'silver foundry 402',
      ]) {
        const found = await context.retrieve({
          input: { phrase },
          tool: 'memory_search',
        })
        const row = found.matches.find((candidate) =>
          candidate.speaker === 'user' &&
          candidate.text.includes(phrase.split(' ')[1]))
        assert.ok(row)
        materialRows.push(row)
        const review = await context.retrieve({
          input: {
            findings: [{
              candidateNumber: row.candidateNumber,
              reason: 'This is another requested code.',
            }],
          },
          tool: 'memory_candidate_review',
        })
        assert.equal(review.continueSearch, true)
      }
      const closed = await context.retrieve({
        input: { phrase: 'silver foundry 402' },
        tool: 'memory_search',
      })
      assert.deepEqual(closed.matches, [])
      return context.commitAnswer(proposal(
        'The four codes are 813, 274, 659, and 402.',
        [original, ...materialRows],
      ))
    })

    const result = await answerWithRetrieval(brain, {
      ...SCOPE,
      confirmationProvider,
      provider,
      question: 'What are the four location codes?',
    })
    assert.equal(result.answerConfirmation.complete, true)
    assert.equal(result.answerConfirmation.exhausted, false)
    assert.equal(result.answerConfirmation.maxRetrievalCalls, 4)
    assert.equal(result.answerConfirmation.retrievalCalls, 4)
    assert.equal(result.answerConfirmation.reviewCalls, 3)
    assert.match(result.answer, /813, 274, 659, and 402/)
  })

test('confirmation returns the latest valid answer when its emergency bound is reached',
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
    let newRow
    const confirmationProvider = requireCommitment(async (context) => {
      assert.throws(
        () => context.commitIncompleteAnswer(provisional),
        (error) => error.code === 'MEMORY_ANSWER_CONFIRMATION_REQUIRED',
      )
      const novel = await context.retrieve({
        input: { limit: 20, phrase: 'current project codename' },
        tool: 'memory_search',
      })
      newRow = novel.matches.find((row) => row.text.includes('Juniper'))
      assert.ok(newRow)
      assert.throws(
        () => context.commitIncompleteAnswer(proposal(
          'The codename is Juniper.',
          [oldRow, newRow],
        )),
        (error) => error.code === 'MEMORY_ANSWER_CONFIRMATION_REQUIRED',
      )
      await reviewCandidates(context, novel.matches, 'material')
      assert.throws(
        () => context.commitAnswer(proposal(
          'The codename is Juniper.',
          [oldRow, newRow],
        )),
        (error) => error.code === 'MEMORY_ANSWER_CONFIRMATION_REQUIRED',
      )
      assert.throws(
        () => context.commitIncompleteAnswer(proposal(
          'A forged answer.',
          [{ evidenceId: 'unknown-evidence', text: 'Invented.' }],
        )),
        /not returned in this answer session/,
      )
      return context.commitIncompleteAnswer(proposal(
        'The codename is Juniper.',
        [oldRow, newRow],
      ))
    })

    const result = await answerWithRetrieval(brain, {
      ...SCOPE,
      confirmationProvider,
      maxConfirmationRetrievalCalls: 1,
      provider,
      question: 'What is the current project codename?',
    })
    assert.equal(result.answer, 'The codename is Juniper.')
    assert.equal(result.answerConfirmation.complete, false)
    assert.equal(result.answerConfirmation.exhausted, true)
    assert.equal(result.answerConfirmation.closureReason, 'emergency_bound')
    assert.equal(result.answerConfirmation.status, 'bounded_incomplete')
    assert.deepEqual(
      result.selectedEvidenceIds,
      [oldRow.evidenceId, newRow.evidenceId],
    )
  })

test('bounded confirmation cannot commit while its final search is outstanding',
  async (t) => {
    const brain = await openBrain(t)
    for (let index = 0; index < 22; index += 1) {
      await seed(
        brain,
        `Race archive item ${index} stores marker ${1000 + index}.`,
        `pending-search:${index}`,
      )
    }
    let original
    const provider = requireCommitment(async ({ commitAnswer, retrieve }) => {
      const found = await retrieve({
        input: { limit: 1, phrase: 'Race archive item 0 marker 1000' },
        tool: 'memory_search',
      })
      original = found.matches.find((row) =>
        row.speaker === 'user' && row.text.includes('marker 1000'))
      assert.ok(original)
      return commitAnswer(proposal('The first marker is 1000.', [
        original,
      ]))
    })
    let finalRow
    const confirmationProvider = requireCommitment(async (context) => {
      const first = await context.retrieve({
        input: { phrase: 'Race archive item stores marker' },
        tool: 'memory_search',
      })
      assert.equal(first.matches.length, 20)
      const firstMaterialRow = first.matches[0]
      await reviewCandidates(context, [firstMaterialRow], 'material')

      const outstanding = context.retrieve({
        input: { phrase: 'Race archive item stores marker' },
        tool: 'memory_search',
      })
      assert.throws(
        () => context.commitIncompleteAnswer(proposal(
          'Twenty-one archive markers are currently accounted for.',
          [original, firstMaterialRow],
        )),
        (error) => error.code === 'MEMORY_ANSWER_CONFIRMATION_REQUIRED' &&
          /no outstanding search/.test(error.message),
      )

      const final = await outstanding
      finalRow = final.matches.find((row) => row.speaker === 'user')
      assert.ok(finalRow)
      assert.ok(!first.matches.some((row) =>
        row.evidenceId === finalRow.evidenceId))
      assert.throws(
        () => context.commitIncompleteAnswer(proposal(
          'Twenty-one archive markers are currently accounted for.',
          [original, firstMaterialRow],
        )),
        (error) => error.code === 'MEMORY_ANSWER_CONFIRMATION_REQUIRED',
      )
      await reviewCandidates(context, [finalRow], 'material')
      return context.commitIncompleteAnswer(proposal(
        'The reviewed archive markers are accounted for.',
        [original, firstMaterialRow, finalRow],
      ))
    })

    const result = await answerWithRetrieval(brain, {
      ...SCOPE,
      confirmationProvider,
      maxConfirmationRetrievalCalls: 2,
      provider,
      question: 'What are all the race archive markers?',
    })
    assert.equal(result.answerConfirmation.status, 'bounded_incomplete')
    assert.equal(result.answerConfirmation.retrievalCalls, 2)
    assert.equal(result.answerConfirmation.reviewCalls, 2)
    assert.ok(result.selectedEvidenceIds.includes(finalRow.evidenceId))
  })

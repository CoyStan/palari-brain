#!/usr/bin/env node
// Provider-free composition regression for the repaired answer boundary.
// This checks structural inputs only: it never grades prose, reads a
// credential, loads a private benchmark, or calls a network provider.

import { pathToFileURL } from 'node:url'
import {
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

import {
  answerWithRetrieval,
  createPalariBrain,
  ingestChatTurn,
} from '../src/index.mjs'

const DEFAULT_REPORT = join(
  tmpdir(),
  'palari-answer-interpretation-regression.json',
)
const SCOPE = Object.freeze({
  palariId: 'palari-answer-interpretation-regression',
  userId: 'user-answer-interpretation-regression',
})

function requireShape(condition, message) {
  if (!condition) throw new Error(`Structural regression failed: ${message}`)
}

function requireEvidenceCommitment(provider) {
  Object.defineProperty(provider, 'requiresEvidenceCommitment', {
    value: true,
  })
  return provider
}

// Deliberately leave the digest empty. The regression is about the answer
// boundary receiving canonical evidence after a digest miss, not about a
// second model or a benchmark-specific reducer outcome.
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

async function seed(brain, turns) {
  for (const turn of turns) {
    await ingestChatTurn(brain, {
      assistantMessage: turn.assistant ?? 'Noted.',
      eventAt: turn.eventAt,
      palariId: SCOPE.palariId,
      retention: 'durable',
      sourceMessageId: turn.sourceMessageId,
      userId: SCOPE.userId,
      userMessage: turn.user,
    }, {
      reducer: keepNothing,
      reducerId: 'answer-interpretation-regression/v1',
    })
  }
}

async function withBrain(root, name, callback) {
  const brain = await createPalariBrain({
    memoryEnabled: true,
    statePath: join(root, `${name}.json`),
    workspaceId: `answer-interpretation-${name}`,
  })
  try {
    return await callback(brain)
  } finally {
    brain.close()
  }
}

async function priorPalariAdvice(root) {
  return withBrain(root, 'advice', async (brain) => {
    await seed(brain, [{
      assistant:
        'I recommend keeping a paper checklist beside the travel case.',
      eventAt: '2025-01-02T09:00:00.000Z',
      sourceMessageId: 'advice:0',
      user: 'Should I keep a paper checklist beside the travel case?',
    }])
    let rows
    let contract = {}
    const answer = await answerWithRetrieval(brain, {
      ...SCOPE,
      question: 'What did Palari recommend for the travel case?',
      provider: requireEvidenceCommitment(async ({
        answerInstructions,
        commitAnswer,
        retrieve,
      }) => {
        contract = {
          permitsAdvice: answerInstructions.includes(
            'Prior Palari speech may be reported as advice',
          ),
          requiresEvidenceUse: answerInstructions.includes(
            'If one directly addresses the question, use it',
          ),
          preservesSpeakerBoundary: answerInstructions.includes(
            'must never be recast as something the user said',
          ),
        }
        const found = await retrieve({
          input: { maxChars: 20_000, phrase: 'paper checklist travel case' },
          tool: 'memory_search',
        })
        rows = found.matches
        const advice = rows.find((row) => row.speaker === 'Palari')
        requireShape(advice, 'prior Palari advice was not returned')
        requireShape(
          advice.text.includes('I recommend keeping a paper checklist'),
          'the advice row was not canonical text',
        )
        requireShape(
          contract.permitsAdvice && contract.requiresEvidenceUse &&
          contract.preservesSpeakerBoundary,
          'the answer contract did not preserve advice and speaker semantics',
        )
        return commitAnswer({
          abstained: false,
          bases: [{ evidenceId: advice.evidenceId, quote: advice.text }],
          text: 'offline structural sentinel',
        })
      }),
    })
    requireShape(
      answer.answerCommitted && answer.answerEvidence.length === 1,
      'prior advice did not cross the cited-answer boundary',
    )
    return {
      case: 'prior-palari-advice',
      canonicalRows: rows.length,
      palariRows: rows.filter((row) => row.speaker === 'Palari').length,
      contract,
      committedBases: answer.answerEvidence.length,
      passed: true,
    }
  })
}

async function applianceChronology(root) {
  return withBrain(root, 'chronology', async (brain) => {
    const earlier =
      'I bought a pressure cooker appliance for weekend soups.'
    const later =
      'I replaced that kitchen appliance with an air fryer.'
    await seed(brain, [
      {
        eventAt: '2025-01-10T10:00:00.000Z',
        sourceMessageId: 'chronology:0',
        user: earlier,
      },
      {
        eventAt: '2025-02-10T10:00:00.000Z',
        sourceMessageId: 'chronology:1',
        user: later,
      },
    ])
    let rows
    let contract = ''
    const answer = await answerWithRetrieval(brain, {
      ...SCOPE,
      question: 'Which appliance did I have before the air fryer?',
      questionDate: '2025-03-10T10:00:00.000Z',
      provider: requireEvidenceCommitment(async ({
        answerInstructions,
        commitAnswer,
        retrieve,
      }) => {
        contract = answerInstructions
        const found = await retrieve({
          input: { maxChars: 20_000, phrase: 'appliance' },
          tool: 'memory_search',
        })
        rows = found.matches
        requireShape(rows.length === 2, 'both appliance observations were not returned')
        requireShape(
          rows.every((row) => row.speaker === 'user' && row.evidenceId),
          'appliance evidence lost user provenance or identity',
        )
        requireShape(
          rows.map((row) => row.text).includes(earlier) &&
          rows.map((row) => row.text).includes(later),
          'appliance rows were not canonical messages',
        )
        requireShape(
          rows[0].observedAt < rows[1].observedAt,
          'appliance chronology was not usable at the answer boundary',
        )
        requireShape(
          rows.every((row) => row.questionRelativeTime?.relation === 'past'),
          'appliance rows lacked host-computed question-relative time',
        )
        requireShape(
          contract.includes('do not claim no relevant memory merely because'),
          'the answer contract allowed absence after relevant retrieval',
        )
        return commitAnswer({
          abstained: false,
          bases: rows.map((row) => ({
            evidenceId: row.evidenceId,
            quote: row.text,
          })),
          text: 'offline structural sentinel',
        })
      }),
    })
    requireShape(
      answer.answerCommitted && answer.answerEvidence.length === 2,
      'multi-row chronology did not retain both cited bases',
    )
    return {
      case: 'appliance-chronology',
      canonicalRows: rows.length,
      committedBases: answer.answerEvidence.length,
      observedAtOrder: rows.map((row) => row.observedAt),
      userRows: rows.filter((row) => row.speaker === 'user').length,
      relativeTimeRows: rows.filter((row) => row.questionRelativeTime).length,
      passed: true,
    }
  })
}

async function hostComputedTime(root) {
  return withBrain(root, 'relative-time', async (brain) => {
    await seed(brain, [{
      eventAt: '2023-11-01T00:46:00.000Z',
      sourceMessageId: 'relative-time:0',
      user: 'The photography workshop happened on November 1.',
    }])
    let relative
    const answer = await answerWithRetrieval(brain, {
      ...SCOPE,
      question: 'How long ago was the photography workshop?',
      questionDate: '2024-02-01T18:06:00.000Z',
      provider: requireEvidenceCommitment(async ({ commitAnswer, retrieve }) => {
        const found = await retrieve({
          input: { maxChars: 20_000, phrase: 'photography workshop' },
          tool: 'memory_search',
        })
        relative = found.matches[0]?.questionRelativeTime
        requireShape(relative, 'temporal evidence lacked host metadata')
        requireShape(
          relative.wholeCalendarMonths === 3 &&
          relative.relation === 'past' &&
          relative.wholeDays === 92,
          'host-computed November-to-February arithmetic was incorrect',
        )
        requireShape(
          relative.evidenceAt === '2023-11-01T00:46:00.000Z' &&
          relative.referenceAt === '2024-02-01T18:06:00.000Z',
          'temporal metadata did not retain host timestamp authority',
        )
        return commitAnswer({
          abstained: false,
          bases: [{
            evidenceId: found.matches[0].evidenceId,
            quote: found.matches[0].text,
          }],
          text: 'offline structural sentinel',
        })
      }),
    })
    requireShape(answer.answerCommitted, 'temporal answer was not committed')
    return {
      case: 'host-computed-time',
      committedBases: answer.answerEvidence.length,
      relation: relative.relation,
      wholeDays: relative.wholeDays,
      wholeCalendarMonths: relative.wholeCalendarMonths,
      passed: true,
    }
  })
}

async function priorResourcePersonalization(root) {
  return withBrain(root, 'resource', async (brain) => {
    const resource =
      'I already own a hand-crank radio with an integrated solar panel.'
    await seed(brain, [{
      eventAt: '2025-03-02T08:30:00.000Z',
      sourceMessageId: 'resource:0',
      user: resource,
    }])
    const answer = await answerWithRetrieval(brain, {
      ...SCOPE,
      question: 'What emergency power gear do I already have?',
      provider: requireEvidenceCommitment(async ({ commitAnswer, retrieve }) => {
        const found = await retrieve({
          input: { maxChars: 20_000, phrase: 'emergency power radio' },
          tool: 'memory_search',
        })
        const row = found.matches.find((entry) => entry.text === resource)
        requireShape(row, 'prior owned resource was not returned canonically')
        return commitAnswer({
          abstained: false,
          bases: [{ evidenceId: row.evidenceId, quote: row.text }],
          text: 'offline structural sentinel',
        })
      }),
    })
    requireShape(
      answer.answerCommitted && answer.answerEvidence.length === 1,
      'prior resource personalization lacked a cited commitment',
    )
    return {
      case: 'prior-resource-personalization',
      committedBases: answer.answerEvidence.length,
      passed: true,
    }
  })
}

async function correctionConflict(root) {
  return withBrain(root, 'conflict', async (brain) => {
    const original = 'The archive folder label is amber.'
    const correction = 'Correction: the archive folder label is teal, not amber.'
    await seed(brain, [
      {
        eventAt: '2025-03-03T08:30:00.000Z',
        sourceMessageId: 'conflict:0',
        user: original,
      },
      {
        eventAt: '2025-03-04T08:30:00.000Z',
        sourceMessageId: 'conflict:1',
        user: correction,
      },
    ])
    const answer = await answerWithRetrieval(brain, {
      ...SCOPE,
      question: 'What is the current archive folder label?',
      provider: requireEvidenceCommitment(async ({ commitAnswer, retrieve }) => {
        const found = await retrieve({
          input: { maxChars: 20_000, phrase: 'archive folder label' },
          tool: 'memory_search',
        })
        const rows = found.matches.filter((row) =>
          row.text === original || row.text === correction)
        requireShape(rows.length === 2, 'conflicting rows were not both returned')
        requireShape(
          rows[0].observedAt < rows[1].observedAt,
          'conflicting rows lost chronology',
        )
        return commitAnswer({
          abstained: false,
          bases: rows.map((row) => ({
            evidenceId: row.evidenceId,
            quote: row.text,
          })),
          text: 'offline structural sentinel',
        })
      }),
    })
    requireShape(
      answer.answerCommitted && answer.answerEvidence.length === 2,
      'conflict resolution did not preserve both declared bases',
    )
    return {
      case: 'correction-conflict',
      committedBases: answer.answerEvidence.length,
      passed: true,
    }
  })
}

async function irrelevantControl(root) {
  return withBrain(root, 'irrelevant', async (brain) => {
    await seed(brain, [{
      eventAt: '2025-04-01T10:00:00.000Z',
      sourceMessageId: 'irrelevant:0',
      user: 'I took a train trip through Porto last spring.',
    }])
    let rows
    let contract = ''
    const answer = await answerWithRetrieval(brain, {
      ...SCOPE,
      question: 'Which camera did I buy?',
      provider: requireEvidenceCommitment(async ({
        answerInstructions,
        commitAnswer,
        retrieve,
      }) => {
        contract = answerInstructions
        const found = await retrieve({
          input: { maxChars: 20_000, phrase: 'train trip' },
          tool: 'memory_search',
        })
        rows = found.matches
        requireShape(rows.length > 0, 'irrelevant control unexpectedly returned no row')
        requireShape(
          rows.every((row) => !row.text.toLowerCase().includes('camera')),
          'irrelevant control contained a target answer',
        )
        requireShape(
          contract.includes('A non-empty result does not establish relevance'),
          'the answer contract forced relevance from any non-empty result',
        )
        return commitAnswer({
          abstained: true,
          bases: [{
            evidenceId: rows[0].evidenceId,
            quote: rows[0].text,
          }],
          text: 'offline structural sentinel',
        })
      }),
    })
    requireShape(
      answer.answerCommitted && answer.abstained === true,
      'irrelevant non-empty result did not produce an auditable abstention',
    )
    return {
      case: 'irrelevant-result-control',
      committedBases: answer.answerEvidence.length,
      returnedRows: rows.length,
      passed: true,
    }
  })
}

async function emptyControl(root) {
  return withBrain(root, 'empty', async (brain) => {
    await seed(brain, [{
      eventAt: '2025-05-01T10:00:00.000Z',
      sourceMessageId: 'empty:0',
      user: 'I enjoy watercolor paintings on weekends.',
    }])
    let rows
    let contract = ''
    await answerWithRetrieval(brain, {
      ...SCOPE,
      question: 'Which observatory did I visit?',
      async provider({ answerInstructions, retrieve }) {
        contract = answerInstructions
        const found = await retrieve({
          input: { maxChars: 20_000, phrase: 'observatory' },
          tool: 'memory_search',
        })
        rows = found.matches
        requireShape(rows.length === 0, 'empty control unexpectedly found evidence')
        requireShape(
          contract.includes('Do not treat an empty search as proof that an event never happened'),
          'the empty-result contract was not explicit',
        )
        return { abstained: true, text: 'offline structural sentinel' }
      },
    })
    return {
      case: 'empty-result-control',
      returnedRows: rows.length,
      passed: true,
    }
  })
}

function parseArgs(argv) {
  const options = { reportPath: DEFAULT_REPORT }
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    if (flag === '--report') {
      options.reportPath = String(argv[index + 1] ?? '')
      index += 1
      continue
    }
    throw new TypeError(`Unknown answer-interpretation regression flag: ${flag}`)
  }
  if (!options.reportPath) throw new TypeError('--report requires a path.')
  return options
}

export async function runAnswerInterpretationRegression({
  reportPath = DEFAULT_REPORT,
  repoRoot = process.cwd(),
} = {}) {
  const root = await mkdtemp(join(tmpdir(), 'palari-answer-interpretation-'))
  try {
    const cases = [
      await priorPalariAdvice(root),
      await priorResourcePersonalization(root),
      await applianceChronology(root),
      await correctionConflict(root),
      await hostComputedTime(root),
      await irrelevantControl(root),
      await emptyControl(root),
    ]
    const report = {
      answerBoundaryCallbacks: cases.length,
      answerQualityGraded: false,
      cases,
      networkCalls: 0,
      providerCalls: 0,
      schemaVersion: 1,
      status: 'passed',
    }
    const absoluteReport = resolve(repoRoot, reportPath)
    await mkdir(dirname(absoluteReport), { recursive: true })
    await writeFile(
      absoluteReport,
      `${JSON.stringify(report, null, 2)}\n`,
      { mode: 0o600 },
    )
    return report
  } finally {
    await rm(root, { force: true, recursive: true })
  }
}

const isMain = process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
if (isMain) {
  try {
    const options = parseArgs(process.argv.slice(2))
    const report = await runAnswerInterpretationRegression(options)
    console.log(
      `Answer-interpretation structural regression: ${
        report.cases.filter((entry) => entry.passed).length}/${report.cases.length}`,
    )
    console.log('Answer quality graded: false')
    console.log('Provider/network calls: 0/0')
    if (report.status !== 'passed') process.exitCode = 1
  } catch (error) {
    console.error(error?.stack ?? error)
    process.exitCode = 1
  }
}

#!/usr/bin/env node
// Offline failure-driven regression for the six judged S-60 v6 questions and
// the question-7 answer boundary. This does NOT grade answer quality and does
// not call a provider. It asks one structural question:
//
//   Does the current active retrieval-to-answer path store and then deliver
//   the dataset-marked answer-bearing spans to the provider callback?
//
// The deterministic concept embedder below is a plumbing stand-in, not a
// claim about embedding quality. Real Gemini semantic quality was measured
// separately by the scale probe. Raw dataset text and answers remain in the
// gitignored data/ input; the retained report contains IDs and counts only.

import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

import {
  MEMORY_ANSWER_RECOMMENDED_MAX_OUTPUT_TOKENS,
  answerWithRetrieval,
  createPalariBrain,
  ingestLongMemEvalInstance,
  loadLongMemEvalInstances,
} from '../src/index.mjs'

export const HISTORICAL_V6_MISS_QUESTION_IDS = Object.freeze([
  '08e075c7',
  '09d032c9',
  '16c90bf4',
  '5e1b23de',
  '0977f2af',
])
export const REACHED_PREFIX_QUESTION_IDS = Object.freeze([
  ...HISTORICAL_V6_MISS_QUESTION_IDS.slice(0, 4),
  '80ec1f4f_abs',
  HISTORICAL_V6_MISS_QUESTION_IDS[4],
])
export const TRUNCATED_QUESTION_ID = '0a34ad58'

const DEFAULT_DATASET =
  'data/longmemeval_s_cleaned.json'
const DEFAULT_REPORT =
  '.palari-regression/reached-prefix-retrieval-v2/report.json'
const SCOPE = Object.freeze({
  palariId: 'palari-reached-prefix-regression',
  userId: 'user-reached-prefix-regression',
})

// Generic concept buckets covering the failure classes (device duration,
// battery accessories, remembered recommendations, events, places, kitchen
// appliances, and travel). They contain no expected answer string or session
// identity. Their role is only to drive the optional semantic plumbing
// without a network call.
const CONCEPTS = Object.freeze([
  ['fitbit', 'wearable', 'fitness tracker', 'charge 3', 'months'],
  ['battery', 'phone', 'power bank', 'charging', 'charger'],
  ['beer', 'lager', 'pilsner', 'recipe', 'stew', 'cordero'],
  ['photo', 'photography', 'workshop', 'camera', 'months'],
  ['museum', 'gallery', 'art', 'visit', 'december'],
  [
    'kitchen',
    'gadget',
    'appliance',
    'instant pot',
    'air fryer',
    'pressure cooking',
  ],
  ['tokyo', 'suica', 'tripit', 'train', 'transit', 'navigate'],
])

export async function deterministicRegressionEmbedder(texts) {
  return texts.map((text) => {
    const lowered = String(text).toLowerCase()
    return CONCEPTS.map((bucket) =>
      bucket.reduce((score, token) =>
        score + (lowered.includes(token) ? 1 : 0), 0))
  })
}

function parseArgs(argv) {
  const options = {
    datasetPath: DEFAULT_DATASET,
    reportPath: DEFAULT_REPORT,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    if (flag === '--dataset') {
      options.datasetPath = String(argv[index + 1] ?? '')
      index += 1
      continue
    }
    if (flag === '--report') {
      options.reportPath = String(argv[index + 1] ?? '')
      index += 1
      continue
    }
    throw new TypeError(`Unknown reached-prefix regression flag: ${flag}`)
  }
  if (!options.datasetPath || !options.reportPath) {
    throw new TypeError('--dataset and --report require non-empty paths.')
  }
  return options
}

function targetTexts(instance, sessionId) {
  const session = instance.sessions.find((entry) =>
    entry.sessionId === sessionId)
  return new Set((session?.turns ?? []).map((turn) =>
    String(turn.content ?? '')))
}

function countedTexts(values) {
  const counts = new Map()
  for (const value of values) {
    const text = String(value ?? '')
    if (!text) continue
    counts.set(text, (counts.get(text) ?? 0) + 1)
  }
  return counts
}

function matchedTextCount(expected, observed) {
  let matched = 0
  for (const [text, count] of expected) {
    matched += Math.min(count, observed.get(text) ?? 0)
  }
  return matched
}

export function measureAnswerBearingEvidence(instance, {
  canonicalRows = [],
  returnedRows = [],
} = {}) {
  const answerSessionIds = instance.questionId.endsWith('_abs')
    ? []
    : instance.answerSessionIds
  let canonicalMatched = 0
  let required = 0
  let returnedMatched = 0
  for (const sessionId of answerSessionIds) {
    const session = instance.sessions.find((entry) =>
      entry.sessionId === sessionId)
    const expected = countedTexts((session?.turns ?? [])
      .filter((turn) => turn.hasAnswer === true)
      .map((turn) => turn.content))
    const expectedCount = [...expected.values()].reduce(
      (sum, count) => sum + count,
      0,
    )
    required += expectedCount
    canonicalMatched += matchedTextCount(
      expected,
      countedTexts(canonicalRows
        .filter((row) => String(row.source_message_id ?? '')
          .startsWith(`${sessionId}:`))
        .map((row) => row.content)),
    )
    returnedMatched += matchedTextCount(
      expected,
      countedTexts(returnedRows
        .filter((row) => String(row.session ?? '') === sessionId)
        .map((row) => row.text)),
    )
  }
  return Object.freeze({
    canonicalMatched,
    required,
    returnedMatched,
  })
}

function decemberBounds(questionDate) {
  const date = new Date(questionDate)
  const year = date.getUTCMonth() < 11
    ? date.getUTCFullYear() - 1
    : date.getUTCFullYear()
  return {
    after: `${year}-12-01T00:00:00.000Z`,
    before: `${year}-12-31T23:59:59.999Z`,
  }
}

async function runInstance(instance, root) {
  const brain = await createPalariBrain({
    embedder: deterministicRegressionEmbedder,
    memoryEnabled: true,
    statePath: join(root, `${instance.questionId}.json`),
    workspaceId: instance.questionId,
  })
  try {
    const ingest = await ingestLongMemEvalInstance(brain, instance, {
      ...SCOPE,
    })
    let search
    let contract = null
    const result = await answerWithRetrieval(brain, {
      ...SCOPE,
      async provider({
        answerInstructions,
        recommendedMaxOutputTokens,
        retrieve,
      }) {
        const isAbstention = instance.questionId.endsWith('_abs')
        search = await retrieve({
          input: {
            ...(isAbstention
              ? decemberBounds(instance.questionDate)
              : {}),
            limit: 50,
            maxChars: 100_000,
            phrase: instance.question,
          },
          tool: 'memory_search',
        })
        if (instance.questionId === TRUNCATED_QUESTION_ID) {
          const concise =
            'Use your Suica card for transit and keep the route in TripIt.'
          contract = {
            conciseWords: concise.split(/\s+/u).length,
            instructionsRequestConcise:
              /directly and concisely/u.test(answerInstructions),
            recommendedMaxOutputTokens,
          }
          return { text: concise }
        }
        return { text: 'Offline retrieval regression; no answer was graded.' }
      },
      question: instance.question,
      questionDate: instance.questionDate,
    })

    const sessions = new Set(search.matches.map((row) => row.session))
    const expected = instance.answerSessionIds
    const matched = expected.filter((sessionId) => sessions.has(sessionId))
    const exactCanonical = matched.every((sessionId) => {
      const allowed = targetTexts(instance, sessionId)
      return search.matches
        .filter((row) => row.session === sessionId)
        .every((row) => allowed.has(row.text))
    })
    const isAbstention = instance.questionId.endsWith('_abs')
    const canonicalRows = brain.listStatements(SCOPE)
    const answerBearingEvidence = measureAnswerBearingEvidence(instance, {
      canonicalRows,
      returnedRows: search.matches,
    })
    const writePassed = isAbstention || (
      answerBearingEvidence.required > 0 &&
      answerBearingEvidence.canonicalMatched === answerBearingEvidence.required
    )
    const retrievalPassed = isAbstention
      ? search.matches.length === 0
      : answerBearingEvidence.required > 0 &&
        answerBearingEvidence.returnedMatched === answerBearingEvidence.required &&
        exactCanonical
    const passed = isAbstention
      ? retrievalPassed
      : writePassed && retrievalPassed
    const boundaryPassed = instance.questionId !== TRUNCATED_QUESTION_ID ||
      (
        passed &&
        contract?.instructionsRequestConcise === true &&
        contract.recommendedMaxOutputTokens >= 512 &&
        contract.conciseWords <= 64
      )
    return {
      answerBearingSessionsMatched: matched.length,
      answerBearingSessionsRequired: isAbstention ? 0 : expected.length,
      answerBearingSpansCanonical: answerBearingEvidence.canonicalMatched,
      answerBearingSpansRequired: answerBearingEvidence.required,
      answerBearingSpansReturned: answerBearingEvidence.returnedMatched,
      canonicalRows: canonicalRows.length,
      exactCanonical,
      ingestRawTurns: ingest.rawTurns,
      ingestTurns: ingest.turns,
      isAbstention,
      passed: passed && boundaryPassed,
      questionId: instance.questionId,
      retrievalCalls: result.retrievalCalls,
      returnedMessages: search.matches.length,
      semanticUsed: search.semanticUsed,
      storageRetrievalStage: !writePassed
        ? 'write'
        : !retrievalPassed
          ? 'retrieval'
          : 'passed-answer-ungraded',
      writePassed,
      retrievalPassed,
      ...(contract ? { answerBoundary: contract } : {}),
    }
  } finally {
    brain.close()
  }
}

export async function runReachedPrefixRetrievalRegression({
  datasetPath = DEFAULT_DATASET,
  reportPath = DEFAULT_REPORT,
  repoRoot = process.cwd(),
} = {}) {
  const datasetBytes = await readFile(resolve(repoRoot, datasetPath))
  const datasetSha256 = createHash('sha256')
    .update(datasetBytes)
    .digest('hex')
  const raw = JSON.parse(datasetBytes)
  const wanted = [
    ...REACHED_PREFIX_QUESTION_IDS,
    TRUNCATED_QUESTION_ID,
  ]
  const byId = new Map(
    loadLongMemEvalInstances(raw).map((instance) => [
      instance.questionId,
      instance,
    ]),
  )
  const missing = wanted.filter((id) => !byId.has(id))
  if (missing.length) {
    throw new Error(
      `LongMemEval input is missing required question IDs: ${
        missing.join(', ')}`,
    )
  }

  const root = await mkdtemp(join(tmpdir(), 'palari-reached-prefix-'))
  try {
    const cases = []
    for (const id of wanted) {
      cases.push(await runInstance(byId.get(id), root))
    }
    const reached = cases.filter((entry) =>
      REACHED_PREFIX_QUESTION_IDS.includes(entry.questionId))
    const boundary = cases.find((entry) =>
      entry.questionId === TRUNCATED_QUESTION_ID)
    const historicalMisses = cases.filter((entry) =>
      HISTORICAL_V6_MISS_QUESTION_IDS.includes(entry.questionId))
    const report = {
      answerQualityGraded: false,
      cases,
      datasetRows: raw.length,
      datasetSha256,
      historicalMissesPassed: historicalMisses.filter((entry) =>
        entry.passed).length,
      historicalMissesTotal: historicalMisses.length,
      mode: 'provider-free-structural-diagnostic-not-a-benchmark-grade',
      networkCalls: 0,
      providerCalls: 0,
      reachedPassed: reached.filter((entry) => entry.passed).length,
      reachedTotal: reached.length,
      retrievalFailures: reached.filter((entry) =>
        entry.storageRetrievalStage === 'retrieval').length,
      schemaVersion: 2,
      status: cases.every((entry) => entry.passed)
        ? 'passed'
        : 'failed',
      truncatedBoundaryPassed: boundary?.passed === true,
      writeFailures: reached.filter((entry) =>
        entry.storageRetrievalStage === 'write').length,
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
    const report = await runReachedPrefixRetrievalRegression(options)
    console.log(
      `Historical v6 misses, exact marked spans: ${
        report.historicalMissesPassed}/${report.historicalMissesTotal}`,
    )
    console.log(
      `Reached-prefix canonical retrieval: ${
        report.reachedPassed}/${report.reachedTotal}`,
    )
    console.log(
      `Current-stage failures: write=${report.writeFailures}, ` +
        `retrieval=${report.retrievalFailures}`,
    )
    console.log(
      `Question-7 answer boundary: ${
        report.truncatedBoundaryPassed ? 'PASS' : 'FAIL'}`,
    )
    console.log('Provider/network calls: 0/0')
    if (report.status !== 'passed') process.exitCode = 1
  } catch (error) {
    console.error(error?.stack ?? error)
    process.exitCode = 1
  }
}

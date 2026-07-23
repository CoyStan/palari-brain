import { createHash } from 'node:crypto'

import {
  loadLongMemEvalInstances,
  longMemEvalQuestionTypes,
} from '../src/longmemeval.mjs'
import { buildMemoryExtractionRequest } from '../src/memory-extraction.mjs'

// U8 is sealed as one indivisible artifact. No caller-supplied option may
// remove these exclusions.
export const SEALED_U8_QUESTION_IDS = Object.freeze([
  '001be529',
  '00ca467f',
  '0100672e',
  '01493427',
  '031748ae',
  '031748ae_abs',
  '06878be2',
  '08f4fc43',
  '0e5e2d1a',
  '1568498a',
])

// Reproduced spend-free with memory-benchmarks' sorted, stratified
// random.Random(42) sampler under Python 3.12.3, after the mandatory U8
// exclusion. Pinning the complete ID list avoids Python-version drift.
export const J4_PUBLIC_SAMPLE_QUESTION_IDS = Object.freeze([
  '08e075c7',
  '0977f2af',
  '09d032c9',
  '0a34ad58',
  '0edc2aef',
  '10d9b85a',
  '1192316e',
  '16c90bf4',
  '18bc8abd',
  '19b5f2b3',
  '1a1907b4',
  '2133c1b5',
  '2133c1b5_abs',
  '25e5aa4f',
  '2698e78f_abs',
  '32260d93',
  '35a27287',
  '36b9f61e',
  '37d43f65',
  '38146c39',
  '3e321797',
  '3f1e9474',
  '561fabcd',
  '5a4f22c0',
  '5e1b23de',
  '6071bd76',
  '65240037',
  '6a27ffc2',
  '7024f17c',
  '7527f7e2',
  '76d63226',
  '7a8d0b71',
  '8077ef71',
  '80ec1f4f',
  '80ec1f4f_abs',
  '87f22b4a',
  '8a137a7f',
  '95228167',
  '982b5123_abs',
  'a3838d2b',
  'af8d2e46',
  'b01defab',
  'b6025781',
  'b759caee',
  'c14c00dd',
  'caf9ead2',
  'd24813b1',
  'dc439ea3',
  'e9327a54',
  'eeda8a6d_abs',
  'f523d9fe',
  'fca762bc',
  'gpt4_194be4b3',
  'gpt4_1d80365e',
  'gpt4_2d58bcd6',
  'gpt4_2f56ae70',
  'gpt4_59149c78',
  'gpt4_7de946e7',
  'gpt4_88806d6e',
  'gpt4_e05b82a6',
])

export const J4_PUBLIC_HARNESS_PROVENANCE = Object.freeze({
  commit: '4b61c5d31b9c668a12b4f5e78064248a02c82d2b',
  license: 'Apache-2.0',
  promptsSha256: 'ba8cf60d26f1390ecbef0f07b3e950556fe3bc5a37ba4b5343f28217f18c144f',
  publicDefaultSamplePerType: 5,
  pythonVersion: '3.12.3',
  repository: 'https://github.com/mem0ai/memory-benchmarks',
  runSha256: '99bd3d6d9a69072f9125550a0409f0de0aeaec66309416060db3daf12e137861',
  j4SamplePerType: 10,
  sampleSeed: 42,
})

export const J4_S_DATASET_CONTRACT = Object.freeze({
  byType: Object.freeze({
    'knowledge-update': Object.freeze({ abstentions: 6, questions: 78 }),
    'multi-session': Object.freeze({ abstentions: 12, questions: 133 }),
    'single-session-assistant': Object.freeze({ abstentions: 0, questions: 56 }),
    'single-session-preference': Object.freeze({ abstentions: 0, questions: 30 }),
    'single-session-user': Object.freeze({ abstentions: 6, questions: 70 }),
    'temporal-reasoning': Object.freeze({ abstentions: 6, questions: 133 }),
  }),
  questions: 500,
  sha256: 'd6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442',
})

export const J4_PRICES_USD_PER_MILLION = Object.freeze({
  geminiInput: 0.30,
  geminiOutputIncludingThinking: 2.50,
  judgeInput: 2.50,
  judgeOutput: 10.00,
})

// Expected values are planning assumptions, not provider guarantees. The
// conservative output values are request maxima that the live transport must
// enforce; its single aggregate ledger remains the actual hard stop.
export const J4_EXPECTED_COST_ASSUMPTIONS = Object.freeze({
  answerInputTokensPerCall: 500,
  answerOutputTokensPerCall: 100,
  charsPerToken: 4,
  judgeInputTokensPerCall: 500,
  judgeOutputTokensPerCall: 10,
  writerOutputTokensPerCall: 150,
  writerProtocolOverheadTokensPerCall: 32,
})

export const J4_CONSERVATIVE_COST_ASSUMPTIONS = Object.freeze({
  answerInputTokensPerCall: 900,
  answerOutputTokensPerCall: 256,
  charsPerToken: 3,
  judgeInputTokensPerCall: 800,
  judgeOutputTokensPerCall: 10,
  writerOutputTokensPerCall: 512,
  writerProtocolOverheadTokensPerCall: 128,
})

export const J4_GEMINI_GENERATION_LIMITS = Object.freeze({
  answerMaxOutputTokens: 256,
  thinkingLevel: 'MINIMAL',
  writerMaxOutputTokens: 512,
})

export const J4_S60_STATS = Object.freeze({
  abstentions: 5,
  answerChars: 4_998,
  historyChars: 29_374_011,
  questionChars: 5_204,
  questions: 60,
  sessions: 2_837,
  userTurns: 14_651,
  writerRequestContentChars: 56_451_611,
})

export const J4_S490_STATS = Object.freeze({
  abstentions: 29,
  answerChars: 25_381,
  historyChars: 239_721_324,
  questionChars: 41_442,
  questions: 490,
  sessions: 23_387,
  userTurns: 120_014,
  writerRequestContentChars: 461_415_030,
})

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function userTurns(instance) {
  return (instance.sessions ?? []).reduce(
    (count, session) =>
      count + (session.turns ?? []).filter((turn) => turn.role === 'user').length,
    0,
  )
}

function historyChars(instance) {
  return (instance.sessions ?? []).reduce(
    (count, session) =>
      count + (session.turns ?? []).reduce(
        (turnCount, turn) => turnCount + String(turn.content ?? '').length,
        0,
      ),
    0,
  )
}

export function longMemEvalStats(instances = []) {
  const byType = Object.fromEntries(
    [...longMemEvalQuestionTypes].sort().map((type) => [
      type,
      { abstentions: 0, historyChars: 0, questions: 0, sessions: 0, userTurns: 0 },
    ]),
  )
  const totals = {
    abstentions: 0,
    answerChars: 0,
    historyChars: 0,
    questionChars: 0,
    questions: instances.length,
    sessions: 0,
    userTurns: 0,
  }
  for (const instance of instances) {
    const type = byType[instance.questionType]
    if (!type) {
      throw new Error(`Unknown LongMemEval question type "${instance.questionType}".`)
    }
    const abstention = instance.isAbstention ? 1 : 0
    const chars = historyChars(instance)
    const sessions = (instance.sessions ?? []).length
    const turns = userTurns(instance)
    totals.abstentions += abstention
    totals.answerChars += String(instance.answer ?? '').length
    totals.historyChars += chars
    totals.questionChars += String(instance.question ?? '').length
    totals.sessions += sessions
    totals.userTurns += turns
    type.abstentions += abstention
    type.historyChars += chars
    type.questions += 1
    type.sessions += sessions
    type.userTurns += turns
  }
  return { byType, totals }
}

function assertExact(label, actual, expected) {
  if (actual !== expected) {
    throw new Error(`${label} mismatch: expected ${expected}, got ${actual}.`)
  }
}

export function assertJ4CanonicalS(raw) {
  if (typeof raw !== 'string' && !(raw instanceof Uint8Array)) {
    throw new Error('J4 canonical LongMemEval-S validation requires the raw dataset bytes.')
  }
  const datasetSha256 = sha256(raw)
  assertExact(
    'LongMemEval-S dataset SHA-256',
    datasetSha256,
    J4_S_DATASET_CONTRACT.sha256,
  )
  const instances = loadLongMemEvalInstances(
    typeof raw === 'string' ? raw : Buffer.from(raw).toString('utf8'),
  )
  assertExact(
    'LongMemEval-S question count',
    instances.length,
    J4_S_DATASET_CONTRACT.questions,
  )
  const ids = instances.map((instance) => instance.questionId)
  assertExact(
    'LongMemEval-S unique question count',
    new Set(ids).size,
    J4_S_DATASET_CONTRACT.questions,
  )
  const idSet = new Set(ids)
  const missingSealed = SEALED_U8_QUESTION_IDS.filter((id) => !idSet.has(id))
  if (missingSealed.length) {
    throw new Error(
      `LongMemEval-S canonical dataset is missing sealed U8 IDs: ${missingSealed.join(', ')}`,
    )
  }
  const stats = longMemEvalStats(instances)
  for (const [type, expected] of Object.entries(J4_S_DATASET_CONTRACT.byType)) {
    assertExact(
      `LongMemEval-S ${type} question count`,
      stats.byType[type]?.questions,
      expected.questions,
    )
    assertExact(
      `LongMemEval-S ${type} abstention count`,
      stats.byType[type]?.abstentions,
      expected.abstentions,
    )
  }
  return { datasetSha256, instances, stats }
}

function requestContentChars(request = {}) {
  const systemChars = (request.systemInstruction?.parts ?? []).reduce(
    (count, part) => count + String(part?.text ?? '').length,
    0,
  )
  return (request.contents ?? []).reduce(
    (count, content) =>
      count + (content?.parts ?? []).reduce(
        (partCount, part) => partCount + String(part?.text ?? '').length,
        0,
      ),
    systemChars,
  )
}

export function palariWriterRequestContentStats(instances = []) {
  let calls = 0
  let chars = 0
  for (const instance of instances) {
    for (const session of instance.sessions ?? []) {
      const turns = session.turns ?? []
      for (let index = 0; index < turns.length; index += 1) {
        if (turns[index].role !== 'user') continue
        const assistantMessage =
          turns[index + 1]?.role === 'assistant' ? turns[index + 1].content : ''
        const request = buildMemoryExtractionRequest({
          turn: {
            assistantMessage,
            palariId: 'palari-longmemeval-j4',
            palariName: 'Palari',
            sourceMessageId: `${session.sessionId}:${index}`,
            sourceTexts: [],
            userId: 'user-longmemeval-j4',
            userMessage: turns[index].content,
            userName: 'user',
          },
        })
        calls += 1
        chars += requestContentChars(request)
      }
    }
  }
  return { calls, chars }
}

function excludedSet(additionalQuestionIds = []) {
  return new Set(
    [...SEALED_U8_QUESTION_IDS, ...additionalQuestionIds]
      .map((id) => String(id ?? '').trim())
      .filter(Boolean),
  )
}

export function excludeLongMemEvalQuestions(
  instances = [],
  additionalQuestionIds = [],
) {
  const excluded = excludedSet(additionalQuestionIds)
  const selected = instances.filter((instance) => !excluded.has(instance.questionId))
  assertLongMemEvalExclusions(selected, additionalQuestionIds)
  return selected
}

export function assertLongMemEvalExclusions(
  instances = [],
  additionalQuestionIds = [],
) {
  const excluded = excludedSet(additionalQuestionIds)
  const overlap = instances
    .map((instance) => instance.questionId)
    .filter((id) => excluded.has(id))
  if (overlap.length) {
    throw new Error(`LongMemEval selection overlaps excluded IDs: ${overlap.join(', ')}`)
  }
  return true
}

export function selectPinnedLongMemEvalSample(
  instances = [],
  {
    additionalQuestionIds = [],
    questionIds = J4_PUBLIC_SAMPLE_QUESTION_IDS,
  } = {},
) {
  const ids = [...questionIds].map((id) => String(id ?? '').trim())
  if (new Set(ids).size !== ids.length || ids.some((id) => !id)) {
    throw new Error('LongMemEval pinned selection IDs must be non-empty and unique.')
  }
  const eligible = excludeLongMemEvalQuestions(instances, additionalQuestionIds)
  const byId = new Map(eligible.map((instance) => [instance.questionId, instance]))
  const missing = ids.filter((id) => !byId.has(id))
  if (missing.length) {
    throw new Error(`LongMemEval pinned selection IDs are missing: ${missing.join(', ')}`)
  }
  const selected = ids.map((id) => byId.get(id))
  assertLongMemEvalExclusions(selected, additionalQuestionIds)
  return selected.sort((left, right) => left.questionId.localeCompare(right.questionId))
}

export function assertJ4PinnedS60(instances = []) {
  assertLongMemEvalExclusions(instances)
  const ids = instances.map((instance) => instance.questionId).sort()
  assertExact('J4 S-60 question count', ids.length, J4_S60_STATS.questions)
  assertExact('J4 S-60 unique question count', new Set(ids).size, ids.length)
  assertExact(
    'J4 S-60 selected-ID SHA-256',
    sha256(ids.join('\n')),
    'c720306125284ae03813ed131a044cd6b22d5301ad817da2907a6043768baa3a',
  )
  const stats = longMemEvalStats(instances)
  for (const type of longMemEvalQuestionTypes) {
    assertExact(`J4 S-60 ${type} question count`, stats.byType[type]?.questions, 10)
  }
  const writer = palariWriterRequestContentStats(instances)
  assertExact('J4 S-60 writer call count', writer.calls, J4_S60_STATS.userTurns)
  const observed = {
    ...stats.totals,
    writerRequestContentChars: writer.chars,
  }
  for (const [name, expected] of Object.entries(J4_S60_STATS)) {
    assertExact(`J4 S-60 ${name}`, observed[name], expected)
  }
  return { ...stats, totals: observed }
}

export function longMemEvalSelectionManifest(instances = [], {
  additionalQuestionIds = [],
  datasetSha256,
  seed = null,
  variant,
} = {}) {
  assertLongMemEvalExclusions(instances, additionalQuestionIds)
  const questionIds = instances.map((instance) => instance.questionId).sort()
  if (new Set(questionIds).size !== questionIds.length) {
    throw new Error('LongMemEval selection contains duplicate question IDs.')
  }
  return {
    datasetSha256: String(datasetSha256 ?? ''),
    excludedQuestionIdsSha256: sha256(
      [...excludedSet(additionalQuestionIds)].sort().join('\n'),
    ),
    questionIds,
    questionIdsSha256: sha256(questionIds.join('\n')),
    seed,
    stats: longMemEvalStats(instances),
    variant: String(variant ?? ''),
  }
}

export function prepareJ4PinnedS60({ raw } = {}) {
  const canonical = assertJ4CanonicalS(raw)
  const selected = selectPinnedLongMemEvalSample(canonical.instances)
  const stats = assertJ4PinnedS60(selected)
  const manifest = longMemEvalSelectionManifest(selected, {
    datasetSha256: canonical.datasetSha256,
    seed: J4_PUBLIC_HARNESS_PROVENANCE.sampleSeed,
    variant: 'longmemeval_s_cleaned.public-harness-derived-s60.u8-excluded',
  })
  manifest.stats = stats
  return { manifest, selected }
}

function nonNegative(value, label) {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`${label} must be a non-negative finite number.`)
  }
  return number
}

function usd(tokens, pricePerMillion) {
  return tokens * pricePerMillion / 1_000_000
}

export function estimatePalariLongMemEvalCost(
  stats,
  {
    assumptions = J4_EXPECTED_COST_ASSUMPTIONS,
    pricesUsdPerMillion = J4_PRICES_USD_PER_MILLION,
  } = {},
) {
  const totals = stats?.totals ?? stats
  const questions = nonNegative(totals?.questions, 'questions')
  const turns = nonNegative(totals?.userTurns, 'userTurns')
  const chars = nonNegative(
    totals?.writerRequestContentChars,
    'writerRequestContentChars',
  )
  const charsPerToken = nonNegative(assumptions?.charsPerToken, 'charsPerToken')
  if (charsPerToken === 0) throw new Error('charsPerToken must be greater than zero.')

  const geminiInput =
    Math.ceil(chars / charsPerToken) +
    turns * nonNegative(
      assumptions?.writerProtocolOverheadTokensPerCall,
      'writerProtocolOverheadTokensPerCall',
    ) +
    questions * nonNegative(
      assumptions?.answerInputTokensPerCall,
      'answerInputTokensPerCall',
    )
  const geminiOutputIncludingThinking =
    turns * nonNegative(
      assumptions?.writerOutputTokensPerCall,
      'writerOutputTokensPerCall',
    ) +
    questions * nonNegative(
      assumptions?.answerOutputTokensPerCall,
      'answerOutputTokensPerCall',
    )
  const judgeInput =
    questions * nonNegative(
      assumptions?.judgeInputTokensPerCall,
      'judgeInputTokensPerCall',
    )
  const judgeOutput =
    questions * nonNegative(
      assumptions?.judgeOutputTokensPerCall,
      'judgeOutputTokensPerCall',
    )
  const costs = {
    geminiInput: usd(
      geminiInput,
      nonNegative(pricesUsdPerMillion?.geminiInput, 'geminiInput price'),
    ),
    geminiOutputIncludingThinking: usd(
      geminiOutputIncludingThinking,
      nonNegative(
        pricesUsdPerMillion?.geminiOutputIncludingThinking,
        'geminiOutputIncludingThinking price',
      ),
    ),
    judgeInput: usd(
      judgeInput,
      nonNegative(pricesUsdPerMillion?.judgeInput, 'judgeInput price'),
    ),
    judgeOutput: usd(
      judgeOutput,
      nonNegative(pricesUsdPerMillion?.judgeOutput, 'judgeOutput price'),
    ),
  }
  return {
    calls: {
      gemini: turns + questions,
      judge: questions,
      total: turns + (questions * 2),
    },
    costs,
    tokens: {
      geminiInput,
      geminiOutputIncludingThinking,
      judgeInput,
      judgeOutput,
    },
    totalUsd: Object.values(costs).reduce((total, value) => total + value, 0),
  }
}

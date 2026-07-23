import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  J4_CONSERVATIVE_COST_ASSUMPTIONS,
  J4_EXPECTED_COST_ASSUMPTIONS,
  J4_FIRST_TRANCHE_QUESTION_IDS,
  J4_GEMINI_GENERATION_LIMITS,
  J4_PRICES_USD_PER_MILLION,
  J4_PROPOSED_TRANCHE_GATES,
  J4_PUBLIC_HARNESS_PROVENANCE,
  J4_PUBLIC_SAMPLE_QUESTION_IDS,
  J4_S_DATASET_CONTRACT,
  J4_S490_STATS,
  J4_S60_STATS,
  J4_STAGED_EXECUTION_ORDER_SHA256,
  J4_STAGED_TRANCHE_MANIFEST_SHA256,
  SEALED_U8_QUESTION_IDS,
  assertJ4CanonicalS,
  assertJ4PinnedS60,
  assertLongMemEvalExclusions,
  buildJ4StagedTranches,
  estimatePalariLongMemEvalCost,
  excludeLongMemEvalQuestions,
  longMemEvalSelectionManifest,
  longMemEvalStats,
  orderJ4PinnedS60ForStagedRun,
  palariWriterRequestContentStats,
  prepareJ4PinnedS60,
  selectPinnedLongMemEvalSample,
} from '../evals/longmemeval-plan.mjs'

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function instance(type, index, { abstention = false, questionId } = {}) {
  const suffix = abstention ? '_abs' : ''
  return {
    answer: `answer ${index}`,
    isAbstention: abstention,
    question: `question ${index}`,
    questionId: questionId ?? `${type}-${String(index).padStart(2, '0')}${suffix}`,
    questionType: type,
    sessions: [{
      sessionId: `${type}-session-${index}`,
      turns: [
        { content: `user ${index}`, role: 'user' },
        { content: `assistant ${index}`, role: 'assistant' },
      ],
    }],
  }
}

test('J4 sealed U8 guard cannot be weakened by caller exclusions', () => {
  assert.equal(SEALED_U8_QUESTION_IDS.length, 10)
  assert.equal(new Set(SEALED_U8_QUESTION_IDS).size, 10)
  const ordinary = instance('multi-session', 1)
  const sealed = {
    ...instance('multi-session', 2),
    questionId: SEALED_U8_QUESTION_IDS[0],
  }
  const custom = {
    ...instance('multi-session', 3),
    questionId: 'custom-exclusion',
  }
  assert.deepEqual(
    excludeLongMemEvalQuestions([ordinary, sealed], []).map((entry) => entry.questionId),
    [ordinary.questionId],
    'an empty caller exclusion cannot unseal U8',
  )
  assert.deepEqual(
    excludeLongMemEvalQuestions(
      [ordinary, sealed, custom],
      ['custom-exclusion'],
    ).map((entry) => entry.questionId),
    [ordinary.questionId],
    'custom exclusions are added to the mandatory U8 seal',
  )
  assert.throws(
    () => assertLongMemEvalExclusions([sealed]),
    /overlaps excluded IDs/,
  )
})

test('public-harness-derived S-60 population and provenance are hash-pinned', () => {
  assert.equal(J4_PUBLIC_SAMPLE_QUESTION_IDS.length, 60)
  assert.equal(new Set(J4_PUBLIC_SAMPLE_QUESTION_IDS).size, 60)
  assert.equal(
    sha256([...J4_PUBLIC_SAMPLE_QUESTION_IDS].sort().join('\n')),
    'c720306125284ae03813ed131a044cd6b22d5301ad817da2907a6043768baa3a',
  )
  assert.ok(J4_PUBLIC_SAMPLE_QUESTION_IDS.every(
    (id) => !SEALED_U8_QUESTION_IDS.includes(id),
  ))
  assert.deepEqual(
    {
      commit: J4_PUBLIC_HARNESS_PROVENANCE.commit,
      j4SamplePerType: J4_PUBLIC_HARNESS_PROVENANCE.j4SamplePerType,
      publicDefaultSamplePerType:
        J4_PUBLIC_HARNESS_PROVENANCE.publicDefaultSamplePerType,
      sampleSeed: J4_PUBLIC_HARNESS_PROVENANCE.sampleSeed,
    },
    {
      commit: '4b61c5d31b9c668a12b4f5e78064248a02c82d2b',
      j4SamplePerType: 10,
      publicDefaultSamplePerType: 5,
      sampleSeed: 42,
    },
  )
})

test('J4 staged gates are exactly 5, then tens, with fresh cumulative caps', () => {
  assert.deepEqual(
    J4_PROPOSED_TRANCHE_GATES.map((gate) => gate.questions),
    [5, 10, 10, 10, 10, 10, 5],
  )
  assert.deepEqual(
    J4_PROPOSED_TRANCHE_GATES.map((gate) => gate.cumulativeQuestions),
    [5, 15, 25, 35, 45, 55, 60],
  )
  assert.deepEqual(
    J4_PROPOSED_TRANCHE_GATES.map((gate) => gate.cumulativeCapUsd),
    [2.5, 7.5, 12.5, 17.5, 22.5, 27.5, 30],
  )
  assert.deepEqual(J4_FIRST_TRANCHE_QUESTION_IDS, [
    '08e075c7',
    '09d032c9',
    '16c90bf4',
    '5e1b23de',
    '80ec1f4f_abs',
  ])
  const sentinels = new Set(J4_FIRST_TRANCHE_QUESTION_IDS)
  const executionOrder = [
    ...J4_FIRST_TRANCHE_QUESTION_IDS,
    ...J4_PUBLIC_SAMPLE_QUESTION_IDS
      .filter((questionId) => !sentinels.has(questionId))
      .sort(),
  ]
  assert.equal(
    sha256(executionOrder.join('\n')),
    J4_STAGED_EXECUTION_ORDER_SHA256,
  )
  let start = 0
  const manifestRows = J4_PROPOSED_TRANCHE_GATES.map((gate, index) => {
    const questionIds = executionOrder.slice(start, gate.cumulativeQuestions)
    start = gate.cumulativeQuestions
    return `${index + 1}:${questionIds.join(',')}`
  })
  assert.equal(
    sha256(manifestRows.join('\n')),
    J4_STAGED_TRANCHE_MANIFEST_SHA256,
  )
})

test('J4 canonical dataset validation fails closed before selection', () => {
  assert.equal(J4_S_DATASET_CONTRACT.questions, 500)
  assert.match(J4_S_DATASET_CONTRACT.sha256, /^[a-f0-9]{64}$/)
  assert.throws(
    () => assertJ4CanonicalS('[]'),
    /dataset SHA-256 mismatch/,
  )
  assert.throws(
    () => assertJ4CanonicalS(),
    /requires the raw dataset bytes/,
  )
})

test('pinned selector requires every pre-registered ID and preserves the seal', () => {
  const first = instance('single-session-user', 1, { questionId: 'selected-a' })
  const second = instance('multi-session', 2, { questionId: 'selected-b' })
  assert.deepEqual(
    selectPinnedLongMemEvalSample([second, first], {
      questionIds: ['selected-b', 'selected-a'],
    }).map((entry) => entry.questionId),
    ['selected-a', 'selected-b'],
  )
  assert.throws(
    () => selectPinnedLongMemEvalSample([first], {
      questionIds: ['selected-a', 'missing'],
    }),
    /IDs are missing: missing/,
  )
  assert.throws(
    () => selectPinnedLongMemEvalSample([
      {
        ...first,
        questionId: SEALED_U8_QUESTION_IDS[0],
      },
    ], {
      questionIds: [SEALED_U8_QUESTION_IDS[0]],
    }),
    /IDs are missing/,
  )
})

test('J4 pinned validator rejects a structurally plausible wrong sample', () => {
  const plausible = J4_PUBLIC_SAMPLE_QUESTION_IDS.map((questionId, index) =>
    instance('single-session-user', index, { questionId }))
  assert.throws(
    () => assertJ4PinnedS60(plausible),
    /question count mismatch/,
  )
  assert.deepEqual(
    palariWriterRequestContentStats(plausible).calls,
    plausible.length,
  )
})

test('local canonical LongMemEval-S reproduces the pinned J4 manifest', async (t) => {
  let raw
  try {
    raw = await readFile(new URL('../data/longmemeval_s_cleaned.json', import.meta.url))
  } catch (error) {
    if (error?.code === 'ENOENT') {
      t.skip('gitignored canonical dataset is not installed')
      return
    }
    throw error
  }
  const { executionOrder, manifest, selected, tranches } =
    prepareJ4PinnedS60({ raw })
  assert.equal(selected.length, J4_S60_STATS.questions)
  assert.equal(manifest.datasetSha256, J4_S_DATASET_CONTRACT.sha256)
  assert.equal(
    manifest.questionIdsSha256,
    'c720306125284ae03813ed131a044cd6b22d5301ad817da2907a6043768baa3a',
  )
  assert.deepEqual(
    manifest.stats.totals,
    J4_S60_STATS,
  )
  assert.equal(
    sha256(executionOrder.map((instance) => instance.questionId).join('\n')),
    J4_STAGED_EXECUTION_ORDER_SHA256,
  )
  assert.deepEqual(
    executionOrder.slice(0, 5).map((instance) => instance.questionId),
    J4_FIRST_TRANCHE_QUESTION_IDS,
  )
  assert.deepEqual(
    executionOrder.slice(0, 5).map((instance) => ({
      isAbstention: instance.isAbstention,
      questionType: instance.questionType,
    })),
    [
      { isAbstention: false, questionType: 'knowledge-update' },
      { isAbstention: false, questionType: 'single-session-preference' },
      { isAbstention: false, questionType: 'single-session-assistant' },
      { isAbstention: false, questionType: 'temporal-reasoning' },
      { isAbstention: true, questionType: 'multi-session' },
    ],
  )
  assert.deepEqual(
    tranches.map((tranche) => tranche.questionIds.length),
    [5, 10, 10, 10, 10, 10, 5],
  )
  assert.deepEqual(
    tranches.map((tranche) => Number(tranche.expectedCumulativeUsd.toFixed(7))),
    [0.8212649, 2.4731349, 4.1963962, 5.8805348, 7.5679431, 9.2266519, 10.0725399],
  )
  assert.deepEqual(
    tranches.map((tranche) =>
      Number(tranche.conservativeCumulativeUsd.toFixed(7))),
    [2.0578727, 6.1973503, 10.5311052, 14.7587211, 18.9931134, 23.1529878, 25.2734986],
  )
  assert.deepEqual(
    tranches.map((tranche) => tranche.questionIdsSha256),
    [
      'cd90bc30cb5d71b1d4cf375d21d6aefee3b50a91a25df2d6ce78b678177325e7',
      '8288c3b3c92dadef8d9baa54db7a60c5ebb76f6cd82ee30964ae4fa2dacc169b',
      '4d23bc3dddcf90523cee0f13e16b550f26b01756be4b28ec85b783004a9292f9',
      'bf6d2d68d2d5e728ad8b69ab3bb9a75508d8d832e3a8d30e716ffd32299c10d6',
      'ab4f03ab1c8405f6c8d3a8735c2429f9b67657bfea90a78166c50dab35c45f50',
      '64596009d46b13e948c5b2db56962fc9d31fdc52675c1821fc72b004f4063511',
      '5254e81467cd26f47e0e55bf6f266c51690d4a6b89530cf06fff8a69ad5b3466',
    ],
  )
  assert.equal(
    sha256(
      tranches
        .map((tranche) => `${tranche.index}:${tranche.questionIds.join(',')}`)
        .join('\n'),
    ),
    J4_STAGED_TRANCHE_MANIFEST_SHA256,
  )
  assert.deepEqual(
    buildJ4StagedTranches(selected).map((tranche) => tranche.questionIds),
    tranches.map((tranche) => tranche.questionIds),
  )
  assert.deepEqual(
    orderJ4PinnedS60ForStagedRun(selected).map((instance) => instance.questionId),
    executionOrder.map((instance) => instance.questionId),
  )
})

test('selection manifest pins IDs, dataset identity, exclusions, and stats', () => {
  const selected = [
    instance('single-session-user', 1),
    instance('multi-session', 2),
  ]
  const manifest = longMemEvalSelectionManifest(selected, {
    datasetSha256: 'a'.repeat(64),
    seed: 42,
    variant: 'synthetic',
  })
  assert.equal(manifest.datasetSha256, 'a'.repeat(64))
  assert.equal(manifest.questionIds.length, 2)
  assert.match(manifest.questionIdsSha256, /^[a-f0-9]{64}$/)
  assert.match(manifest.excludedQuestionIdsSha256, /^[a-f0-9]{64}$/)
  assert.equal(manifest.stats.totals.questions, selected.length)
  assert.equal(manifest.stats.totals.userTurns, selected.length)
})

test('stats report per-type and total workload inputs', () => {
  const selected = [
    instance('single-session-user', 1),
    instance('single-session-user', 2, { abstention: true }),
  ]
  const stats = longMemEvalStats(selected)
  assert.equal(stats.totals.questions, 2)
  assert.equal(stats.totals.sessions, 2)
  assert.equal(stats.totals.userTurns, 2)
  assert.equal(stats.totals.abstentions, 1)
  assert.equal(stats.byType['single-session-user'].questions, 2)
  assert.equal(stats.byType['multi-session'].questions, 0)
})

test('Palari-only estimate keeps every price and assumption explicit', () => {
  const estimate = estimatePalariLongMemEvalCost({
    questions: 2,
    userTurns: 3,
    writerRequestContentChars: 400,
  }, {
    assumptions: {
      answerInputTokensPerCall: 20,
      answerOutputTokensPerCall: 5,
      charsPerToken: 4,
      judgeInputTokensPerCall: 13,
      judgeOutputTokensPerCall: 2,
      writerOutputTokensPerCall: 4,
      writerProtocolOverheadTokensPerCall: 10,
    },
    pricesUsdPerMillion: {
      geminiInput: 1,
      geminiOutputIncludingThinking: 1,
      judgeInput: 1,
      judgeOutput: 1,
    },
  })
  assert.deepEqual(estimate.calls, { gemini: 5, judge: 2, total: 7 })
  assert.deepEqual(estimate.tokens, {
    geminiInput: 170,
    geminiOutputIncludingThinking: 22,
    judgeInput: 26,
    judgeOutput: 4,
  })
  assert.equal(estimate.totalUsd, 222 / 1_000_000)
})

test('published J4 estimates are reproducible and maxima match live limits', () => {
  assert.equal(
    J4_CONSERVATIVE_COST_ASSUMPTIONS.writerOutputTokensPerCall,
    J4_GEMINI_GENERATION_LIMITS.writerMaxOutputTokens,
  )
  assert.equal(
    J4_CONSERVATIVE_COST_ASSUMPTIONS.answerOutputTokensPerCall,
    J4_GEMINI_GENERATION_LIMITS.answerMaxOutputTokens,
  )
  const s60Expected = estimatePalariLongMemEvalCost(J4_S60_STATS)
  const s60Conservative = estimatePalariLongMemEvalCost(J4_S60_STATS, {
    assumptions: J4_CONSERVATIVE_COST_ASSUMPTIONS,
    pricesUsdPerMillion: J4_PRICES_USD_PER_MILLION,
  })
  const s490Expected = estimatePalariLongMemEvalCost(J4_S490_STATS, {
    assumptions: J4_EXPECTED_COST_ASSUMPTIONS,
  })
  const s490Conservative = estimatePalariLongMemEvalCost(J4_S490_STATS, {
    assumptions: J4_CONSERVATIVE_COST_ASSUMPTIONS,
  })
  assert.equal(Number(s60Expected.totalUsd.toFixed(7)), 10.0725399)
  assert.equal(Number(s60Conservative.totalUsd.toFixed(7)), 25.2734986)
  assert.equal(Number(s490Expected.totalUsd.toFixed(7)), 82.4311063)
  assert.equal(Number(s490Conservative.totalUsd.toFixed(7)), 206.9229866)
  assert.deepEqual(s60Expected.calls, {
    gemini: 14_711,
    judge: 60,
    total: 14_771,
  })
})

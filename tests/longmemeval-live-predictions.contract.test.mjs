import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  J4_FIRST_TRANCHE_QUESTION_IDS,
  J4_PUBLIC_SAMPLE_QUESTION_IDS,
  J4_STAGED_EXECUTION_ORDER_SHA256,
  SEALED_U8_QUESTION_IDS,
} from '../evals/longmemeval-plan.mjs'

const V1_PREDICTIONS_URL = new URL(
  '../evals/predictions/j4-longmemeval-s60.json',
  import.meta.url,
)
const V2_PREDICTIONS_URL = new URL(
  '../evals/predictions/j4-longmemeval-s60-v2.json',
  import.meta.url,
)
const V3_PREDICTIONS_URL = new URL(
  '../evals/predictions/j4-longmemeval-s60-v3.json',
  import.meta.url,
)
const V4_PREDICTIONS_URL = new URL(
  '../evals/predictions/j4-longmemeval-s60-v4.json',
  import.meta.url,
)
const V1_PREDICTIONS_SHA256 =
  '07a262c01efa13697266c4e5d52829b518e9e16076e7b6046c78122ae0011028'
const V2_PREDICTIONS_SHA256 =
  'ccdf0b9bd8cc12256657c574d3189d6f4aebb9dd5e6e60ee0aaaaee63671714f'
const V3_PREDICTIONS_SHA256 =
  '201a41bd326f19d350ab45719f95fcf73a1d5d0159cf60c4ccee9992281460bf'
const ROW_ARRAY_SHA256 =
  '12eabc841b63aac5164e828d64bd0e118750337192e3b5984f7d7a3924272351'

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

async function loadPredictions(url = V4_PREDICTIONS_URL) {
  return JSON.parse(await readFile(url, 'utf8'))
}

test('J4 v1-v3 predictions remain sealed and v4 carries every row unchanged', async () => {
  const [v1Text, v2Text, v3Text] = await Promise.all([
    readFile(V1_PREDICTIONS_URL, 'utf8'),
    readFile(V2_PREDICTIONS_URL, 'utf8'),
    readFile(V3_PREDICTIONS_URL, 'utf8'),
  ])
  const v1 = JSON.parse(v1Text)
  const v2 = JSON.parse(v2Text)
  const v3 = JSON.parse(v3Text)
  const v4 = await loadPredictions()

  assert.equal(sha256(v1Text), V1_PREDICTIONS_SHA256)
  assert.equal(sha256(v2Text), V2_PREDICTIONS_SHA256)
  assert.equal(sha256(v3Text), V3_PREDICTIONS_SHA256)
  assert.deepEqual(v2.predictions, v1.predictions)
  assert.deepEqual(v3.predictions, v2.predictions)
  assert.deepEqual(v4.predictions, v3.predictions)
  assert.equal(
    sha256(JSON.stringify(v1.predictions)),
    ROW_ARRAY_SHA256,
  )
})

test('J4 S-60 v4 predictions are FINAL, complete, ordered, and U8-free', async () => {
  const document = await loadPredictions()
  const rows = document.predictions
  const firstIds = new Set(J4_FIRST_TRANCHE_QUESTION_IDS)
  const expectedOrder = [
    ...J4_FIRST_TRANCHE_QUESTION_IDS,
    ...J4_PUBLIC_SAMPLE_QUESTION_IDS
      .filter((questionId) => !firstIds.has(questionId))
      .sort(),
  ]

  assert.equal(document.schemaVersion, 1)
  assert.equal(document.status, 'FINAL')
  assert.equal(document.runId, 'j4-longmemeval-s60-v4')
  assert.deepEqual(document.models, {
    writer: 'gemini-3.5-flash-lite',
    answer: 'gemini-3.5-flash-lite',
    judge: 'gpt-4o-2024-08-06',
  })
  assert.deepEqual(document.promptConfig, {
    writer: {
      maxOutputTokens: 512,
      thinkingLevel: 'MINIMAL',
      responseFormat: 'APPLICATION_JSON+json-schema',
      schemaSha256:
        '7040c879709509de9022135588403f9d9563e53f63f8560fe2445188a7b20173',
      sourceKindVocabulary: [
        'user_message',
        'source_document',
        'tool_output',
        'web_result',
      ],
      store: false,
      typeVocabulary: [
        'preference',
        'relationship',
        'opinion',
        'entity',
        'life_event',
        'working',
        'project',
        'recent_life',
        'session_summary',
      ],
    },
    answer: {
      maxOutputTokens: 256,
      thinkingLevel: 'MINIMAL',
      template: 'official-longmemeval-fact-memory',
      chainOfThought: false,
      store: false,
    },
    judge: {
      parser: 'official-response-contains-yes',
      unchanged: true,
    },
  })
  assert.deepEqual(document.decisionReference, {
    date: '2026-07-25',
    document: 'docs/DECISIONS.md',
    entry: 'FOUNDER GO — J4 v4 MIME replacement run',
    questions: 5,
    cumulativeHardCapUsd: 2.5,
  })
  assert.deepEqual(document.method, {
    finalizedBeforeProviderCalls: true,
    note: 'All 60 outcome rows are byte-identical to v3. No v1-v3 provider evidence was used to revise them; v4 changes only the raw Gemini MIME enum, three-predecessor accounting, and immutable-run metadata.',
    hypotheses: [
      'direct-user write boundary',
      'lexical FTS recall with a five-term query limit and no stemming',
    ],
  })
  assert.equal(document.population.questions, 60)
  assert.equal(
    document.population.executionOrderSha256,
    J4_STAGED_EXECUTION_ORDER_SHA256,
  )
  assert.equal(rows.length, 60)
  assert.deepEqual(
    rows.map((row) => row.ordinal),
    Array.from({ length: 60 }, (_, index) => index + 1),
  )
  assert.deepEqual(
    rows.map((row) => row.questionId),
    expectedOrder,
  )
  assert.equal(new Set(rows.map((row) => row.questionId)).size, 60)
  assert.deepEqual(
    rows.filter((row) => SEALED_U8_QUESTION_IDS.includes(row.questionId)),
    [],
  )
  for (const row of rows) {
    assert.equal(row.isAbstention, row.questionId.endsWith('_abs'))
    assert.ok(document.basisDefinitions[row.basisCode])
    assert.equal(
      row.predictedOfficialCorrect,
      row.predictedFailureStage === 'none',
    )
  }
})

test('J4 S-60 v4 predictions pin totals, failure stages, and the first tranche', async () => {
  const document = await loadPredictions()
  const rows = document.predictions
  const correct = rows.filter((row) => row.predictedOfficialCorrect)
  const incorrect = rows.filter((row) => !row.predictedOfficialCorrect)
  const stageCount = (stage) =>
    rows.filter((row) => row.predictedFailureStage === stage).length

  assert.equal(correct.length, 36)
  assert.equal(incorrect.length, 24)
  assert.equal(stageCount('write'), 8)
  assert.equal(stageCount('retrieval'), 16)
  assert.equal(stageCount('answer'), 0)
  assert.equal(stageCount('none'), 36)
  assert.deepEqual(document.summary, {
    predictedCorrect: 36,
    predictedIncorrect: 24,
    failureStages: {
      write: 8,
      retrieval: 16,
      answer: 0,
    },
    byType: {
      'knowledge-update': '9/10',
      'multi-session': '6/10',
      'single-session-assistant': '0/10',
      'single-session-preference': '4/10',
      'single-session-user': '10/10',
      'temporal-reasoning': '7/10',
    },
  })
  assert.deepEqual(
    rows.slice(0, 5).map((row) => ({
      questionId: row.questionId,
      predictedOfficialCorrect: row.predictedOfficialCorrect,
      predictedFailureStage: row.predictedFailureStage,
    })),
    [
      {
        questionId: '08e075c7',
        predictedOfficialCorrect: true,
        predictedFailureStage: 'none',
      },
      {
        questionId: '09d032c9',
        predictedOfficialCorrect: false,
        predictedFailureStage: 'retrieval',
      },
      {
        questionId: '16c90bf4',
        predictedOfficialCorrect: false,
        predictedFailureStage: 'write',
      },
      {
        questionId: '5e1b23de',
        predictedOfficialCorrect: true,
        predictedFailureStage: 'none',
      },
      {
        questionId: '80ec1f4f_abs',
        predictedOfficialCorrect: true,
        predictedFailureStage: 'none',
      },
    ],
  )
})

test('J4 S-60 v4 prediction row serialization is hash-pinned', async () => {
  const document = await loadPredictions()
  const observed = sha256(JSON.stringify(document.predictions))

  assert.equal(document.rowArraySha256, ROW_ARRAY_SHA256)
  assert.equal(observed, ROW_ARRAY_SHA256)
})

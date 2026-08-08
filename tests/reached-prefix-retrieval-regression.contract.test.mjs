import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  HISTORICAL_V6_MISS_QUESTION_IDS,
  REACHED_PREFIX_QUESTION_IDS,
  TRUNCATED_QUESTION_ID,
  deterministicRegressionEmbedder,
  measureAnswerBearingEvidence,
} from '../evals/run-reached-prefix-retrieval-regression.mjs'

test('the reached-prefix regression is import-inert and fixed to the evidence',
  async () => {
    assert.deepEqual(HISTORICAL_V6_MISS_QUESTION_IDS, [
      '08e075c7',
      '09d032c9',
      '16c90bf4',
      '5e1b23de',
      '0977f2af',
    ])
    assert.deepEqual(REACHED_PREFIX_QUESTION_IDS, [
      '08e075c7',
      '09d032c9',
      '16c90bf4',
      '5e1b23de',
      '80ec1f4f_abs',
      '0977f2af',
    ])
    assert.equal(TRUNCATED_QUESTION_ID, '0a34ad58')
    const source = await readFile(
      new URL(
        '../evals/run-reached-prefix-retrieval-regression.mjs',
        import.meta.url,
      ),
      'utf8',
    )
    for (const forbidden of [
      'GEMINI_API_KEY',
      'OPENAI_API_KEY',
      'process.env',
      'fetch(',
      '@google/genai',
    ]) {
      assert.equal(source.includes(forbidden), false)
    }
  })

test('the local stand-in is deterministic and maps concepts, not answers',
  async () => {
    const input = [
      'Keep the charging accessory ready.',
      'Use the countertop appliance for pressure cooking.',
    ]
    const first = await deterministicRegressionEmbedder(input)
    const second = await deterministicRegressionEmbedder(input)
    assert.deepEqual(first, second)
    assert.ok(first[0].some((value) => value > 0))
    assert.ok(first[1].some((value) => value > 0))
    assert.ok(first.every((vector) =>
      vector.every(Number.isFinite)))
    const source = await readFile(
      new URL(
        '../evals/run-reached-prefix-retrieval-regression.mjs',
        import.meta.url,
      ),
      'utf8',
    )
    for (const answerDerivedTerm of [
      "'instant pot'",
      "'lager'",
      "'pilsner'",
      "'power bank'",
    ]) {
      assert.equal(source.toLowerCase().includes(answerDerivedTerm), false)
    }
  })

test('exact answer-bearing spans are measured independently at write and retrieval', () => {
  const instance = {
    answerSessionIds: ['s1', 's2'],
    questionId: 'current-case',
    sessions: [
      {
        sessionId: 's1',
        turns: [
          { content: 'irrelevant context', hasAnswer: false },
          { content: 'required fact one', hasAnswer: true },
        ],
      },
      {
        sessionId: 's2',
        turns: [
          { content: 'required fact two', hasAnswer: true },
        ],
      },
    ],
  }
  const result = measureAnswerBearingEvidence(instance, {
    canonicalRows: [
      { content: 'required fact one', source_message_id: 's1:0' },
      { content: 'required fact two', source_message_id: 's2:0' },
    ],
    returnedRows: [
      { session: 's1', text: 'irrelevant context' },
      { session: 's2', text: 'required fact two' },
    ],
  })
  assert.deepEqual(result, {
    canonicalMatched: 2,
    required: 2,
    returnedMatched: 1,
  })
})

test('abstention cases require no positive answer-bearing span', () => {
  const result = measureAnswerBearingEvidence({
    answerSessionIds: ['s1'],
    questionId: 'current-case_abs',
    sessions: [{
      sessionId: 's1',
      turns: [{ content: 'marked but ignored', hasAnswer: true }],
    }],
  }, {
    canonicalRows: [],
    returnedRows: [],
  })
  assert.deepEqual(result, {
    canonicalMatched: 0,
    required: 0,
    returnedMatched: 0,
  })
})

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  REACHED_PREFIX_QUESTION_IDS,
  TRUNCATED_QUESTION_ID,
  deterministicRegressionEmbedder,
} from '../evals/run-reached-prefix-retrieval-regression.mjs'

test('the reached-prefix regression is import-inert and fixed to the evidence',
  async () => {
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
      'Keep the portable power bank charged.',
      'Use the Instant Pot for pressure cooking.',
    ]
    const first = await deterministicRegressionEmbedder(input)
    const second = await deterministicRegressionEmbedder(input)
    assert.deepEqual(first, second)
    assert.ok(first[0].some((value) => value > 0))
    assert.ok(first[1].some((value) => value > 0))
    assert.ok(first.every((vector) =>
      vector.every(Number.isFinite)))
  })

import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  runAnswerInterpretationRegression,
} from '../evals/run-answer-interpretation-regression.mjs'

test('answer-interpretation regression is import-inert and provider-free',
  async () => {
    const source = await readFile(
      new URL(
        '../evals/run-answer-interpretation-regression.mjs',
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
      'LongMemEval',
      '08e075c7',
      '09d032c9',
    ]) {
      assert.equal(source.includes(forbidden), false, forbidden)
    }
  })

test('answer-interpretation regression proves A+B structural composition',
  async () => {
    const root = await mkdtemp(join(tmpdir(), 'palari-answer-regression-test-'))
    try {
      const first = await runAnswerInterpretationRegression({
        reportPath: join(root, 'first.json'),
      })
      const second = await runAnswerInterpretationRegression({
        reportPath: join(root, 'second.json'),
      })
      assert.deepEqual(second, first)
      assert.equal(first.answerQualityGraded, false)
      assert.equal(first.networkCalls, 0)
      assert.equal(first.providerCalls, 0)
      assert.equal(first.answerBoundaryCallbacks, 5)
      assert.equal(first.status, 'passed')
      assert.deepEqual(
        first.cases.map((entry) => entry.case),
        [
          'prior-palari-advice',
          'appliance-chronology',
          'host-computed-time',
          'irrelevant-result-control',
          'empty-result-control',
        ],
      )
      const temporal = first.cases.find((entry) =>
        entry.case === 'host-computed-time')
      assert.equal(temporal.wholeCalendarMonths, 3)
      assert.equal(temporal.wholeDays, 92)
      const chronology = first.cases.find((entry) =>
        entry.case === 'appliance-chronology')
      assert.equal(chronology.canonicalRows, 2)
      assert.equal(chronology.relativeTimeRows, 2)
      const empty = first.cases.find((entry) =>
        entry.case === 'empty-result-control')
      assert.equal(empty.returnedRows, 0)
      const persisted = JSON.parse(
        await readFile(join(root, 'first.json'), 'utf8'),
      )
      assert.deepEqual(persisted, first)
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

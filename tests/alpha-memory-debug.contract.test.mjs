import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  runAlphaMemoryDebug,
  selectAlphaQuestions,
} from '../evals/run-alpha-memory-debug.mjs'

const questions = Array.from({ length: 5 }, (_, index) => ({
  id: `q${index + 1}`,
  payload: `question ${index + 1}`,
}))

function dependencies(overrides = {}) {
  return {
    writer: { invoke: ({ question }) => ({ output: `memory:${question.id}`, costUsd: 0.01 }), maxCostUsd: 0.01 },
    embedder: { invoke: ({ stageOutputs }) => ({ output: `vector:${stageOutputs.writer}`, costUsd: 0.01 }), maxCostUsd: 0.01 },
    reranker: { invoke: ({ stageOutputs }) => ({ output: `ranked:${stageOutputs.embedder}`, costUsd: 0.01 }), maxCostUsd: 0.01 },
    answer: { invoke: ({ stageOutputs }) => ({ output: `answer:${stageOutputs.reranker}`, costUsd: 0.01 }), maxCostUsd: 0.01 },
    ...overrides,
  }
}

test('selectAlphaQuestions supports ordinals, ranges, ids, and preserves source order', () => {
  assert.deepEqual(
    selectAlphaQuestions(questions, '4,2-3,q1').map(({ id }) => id),
    ['q1', 'q2', 'q3', 'q4'],
  )
  assert.throws(() => selectAlphaQuestions(questions, '6'), /outside 1-5/)
  assert.throws(() => selectAlphaQuestions(questions, 'missing'), /unknown question/)
})

test('injected stages compose without provider or product imports', async () => {
  let answerContext
  const summary = await runAlphaMemoryDebug({
    questions,
    selection: '2',
    dependencies: dependencies({
      answer: {
        maxCostUsd: 0.01,
        invoke: (context) => {
          answerContext = context
          return { output: `answer:${context.stageOutputs.reranker}`, costUsd: 0.01 }
        },
      },
    }),
    maxDollar: 1,
    appendLog: async () => {},
    runId: 'injection',
  })
  assert.equal(summary.completed, 1)
  assert.equal(summary.spentUsd, 0.04)
  assert.equal(summary.results[0].output, 'answer:ranked:vector:memory:q2')
  assert.equal(summary.mode, 'diagnostic-not-a-benchmark')
  assert.equal(Object.hasOwn(answerContext, 'dependencies'), false)
})

test('explicit bounded retries recover and record every attempt', async () => {
  let calls = 0
  const records = []
  const summary = await runAlphaMemoryDebug({
    questions: questions.slice(0, 1),
    dependencies: dependencies({
      writer: () => {
        calls += 1
        if (calls < 3) throw new Error('temporary')
        return 'memory'
      },
    }),
    maxRetries: 2,
    maxDollar: 1,
    appendLog: async (record) => records.push(record),
    runId: 'retry',
  })
  assert.equal(summary.completed, 1)
  assert.equal(summary.results[0].attempts, 3)
  assert.equal(records.filter(({ type }) => type === 'attempt-error').length, 2)
  await assert.rejects(
    runAlphaMemoryDebug({ questions, dependencies: dependencies(), maxRetries: 4, maxDollar: 1 }),
    /0 through 3/,
  )
})

test('continue-on-error diagnoses later questions while stop-on-error does not', async () => {
  const make = (continueOnError) => runAlphaMemoryDebug({
    questions: questions.slice(0, 3),
    dependencies: dependencies({
      writer: ({ question }) => {
        if (question.id === 'q2') throw new Error('broken row')
        return 'ok'
      },
    }),
    continueOnError,
    maxDollar: 1,
    appendLog: async () => {},
  })
  const continued = await make(true)
  assert.deepEqual(continued.results.map(({ status }) => status), ['completed', 'failed', 'completed'])
  const stopped = await make(false)
  assert.deepEqual(stopped.results.map(({ id }) => id), ['q1', 'q2'])
})

test('hard cap reserves before a stage and never calls across the boundary', async () => {
  let answerCalls = 0
  const summary = await runAlphaMemoryDebug({
    questions: questions.slice(0, 2),
    dependencies: {
      writer: { invoke: () => ({ output: 'memory', costUsd: 0.02 }), maxCostUsd: 0.02 },
      answer: {
        invoke: () => { answerCalls += 1; return { output: 'answer', costUsd: 0.03 } },
        maxCostUsd: 0.03,
      },
    },
    maxDollar: 0.07,
    appendLog: async () => {},
  })
  assert.equal(answerCalls, 1)
  assert.equal(summary.spentUsd, 0.07)
  assert.equal(summary.stoppedForBudget, true)
  assert.equal(summary.results[1].status, 'budget-stopped')
})

test('a stage cannot settle above its declared reservation', async () => {
  const summary = await runAlphaMemoryDebug({
    questions: questions.slice(0, 1),
    dependencies: {
      writer: { invoke: () => ({ output: 'memory', costUsd: 0.02 }), maxCostUsd: 0.01 },
      answer: () => 'answer',
    },
    maxDollar: 1,
    appendLog: async () => {},
  })
  assert.equal(summary.failed, 1)
  assert.match(summary.results[0].error.message, /reserving only/)
  assert.equal(summary.spentUsd, 0.01)
})

test('a failed stage consumes its reservation before a retry', async () => {
  let calls = 0
  const summary = await runAlphaMemoryDebug({
    questions: questions.slice(0, 1),
    dependencies: {
      writer: {
        maxCostUsd: 0.03,
        invoke: () => {
          calls += 1
          throw new Error('transport failed after dispatch')
        },
      },
      answer: () => 'answer',
    },
    maxRetries: 2,
    maxDollar: 0.05,
    appendLog: async () => {},
  })
  assert.equal(calls, 1)
  assert.equal(summary.spentUsd, 0.03)
  assert.equal(summary.stoppedForBudget, true)
})

test('diagnostic log shape has no benchmark grade', async () => {
  const records = []
  await runAlphaMemoryDebug({
    questions: questions.slice(0, 1),
    dependencies: dependencies(),
    maxDollar: 1,
    appendLog: async (record) => records.push(record),
    runId: 'log-shape',
    clock: () => '2026-08-07T00:00:00.000Z',
  })
  assert.ok(records.length >= 3)
  assert.ok(records.every(({ schema }) => schema === 'palari-alpha-debug/v1'))
  assert.ok(records.every(({ mode }) => mode === 'diagnostic-not-a-benchmark'))
  assert.equal(records.some((record) => Object.hasOwn(record, 'grade')), false)
})

test('CLI loads one injected adapter and prints a diagnostic summary', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'palari-alpha-cli-'))
  const adapterPath = path.join(directory, 'adapter.mjs')
  const logPath = '.palari-alpha/debug.jsonl'
  await writeFile(adapterPath, `
    export function createAlphaRun() {
      return {
        questions: [{ id: 'q1' }, { id: 'q2' }],
        dependencies: {
          writer: ({ question }) => 'memory:' + question.id,
          answer: ({ stageOutputs }) => 'answer:' + stageOutputs.writer,
        },
      }
    }
  `)
  const result = spawnSync(process.execPath, [
    new URL('../evals/run-alpha-memory-debug.mjs', import.meta.url).pathname,
    '--adapter', adapterPath,
    '--questions', '2',
    '--max-dollar', '0',
    '--log', logPath,
  ], { cwd: directory, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(JSON.parse(result.stdout), {
    mode: 'diagnostic-not-a-benchmark',
    selected: 1,
    completed: 1,
    failed: 0,
    stoppedForBudget: false,
    openingAccountedUsd: 0,
    freshAccountedUsd: 0,
    spentUsd: 0,
    capUsd: 0,
  })
  const records = (await readFile(path.join(directory, logPath), 'utf8')).trim().split('\n').map(JSON.parse)
  assert.ok(records.every(({ mode }) => mode === 'diagnostic-not-a-benchmark'))
})

test('CLI refuses to run without an explicit adapter and dollar cap', () => {
  const runner = new URL('../evals/run-alpha-memory-debug.mjs', import.meta.url).pathname
  const missingAdapter = spawnSync(process.execPath, [runner, '--max-dollar', '1'], { encoding: 'utf8' })
  assert.notEqual(missingAdapter.status, 0)
  assert.match(missingAdapter.stderr, /--adapter/)
})

test('every file-backed log path stays inside cwd .palari-alpha', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'palari-alpha-path-'))
  const adapterPath = path.join(directory, 'adapter.mjs')
  await writeFile(adapterPath, `
    export function createAlphaRun() {
      return {
        questions: [{ id: 'q1' }],
        dependencies: { writer: () => 'memory', answer: () => 'answer' },
        logPath: '../adapter-outside.jsonl',
      }
    }
  `)
  const runner = new URL('../evals/run-alpha-memory-debug.mjs', import.meta.url).pathname
  for (const args of [
    ['--adapter', adapterPath, '--max-dollar', '0'],
    ['--adapter', adapterPath, '--max-dollar', '0', '--log', '../cli-outside.jsonl'],
    ['--adapter', adapterPath, '--max-dollar', '0', '--log', path.join(directory, 'absolute-outside.jsonl')],
  ]) {
    const result = spawnSync(process.execPath, [runner, ...args], { cwd: directory, encoding: 'utf8' })
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /must stay inside/)
  }
})

test('CLI budget persists across two invocations and stops at the aggregate cap', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'palari-alpha-budget-'))
  const adapterPath = path.join(directory, 'adapter.mjs')
  await writeFile(adapterPath, `
    export function createAlphaRun() {
      return {
        questions: [{ id: 'q1' }],
        dependencies: {
          writer: { maxCostUsd: 0.02, invoke: () => ({ output: 'memory', costUsd: 0.02 }) },
          answer: { maxCostUsd: 0.02, invoke: () => ({ output: 'answer', costUsd: 0.02 }) },
        },
      }
    }
  `)
  const runner = new URL('../evals/run-alpha-memory-debug.mjs', import.meta.url).pathname
  const args = [runner, '--adapter', adapterPath, '--max-dollar', '0.05']
  const first = spawnSync(process.execPath, args, { cwd: directory, encoding: 'utf8' })
  assert.equal(first.status, 0, first.stderr)
  assert.equal(JSON.parse(first.stdout).spentUsd, 0.04)
  const second = spawnSync(process.execPath, args, { cwd: directory, encoding: 'utf8' })
  assert.notEqual(second.status, 0)
  assert.deepEqual(
    (({ openingAccountedUsd, freshAccountedUsd, spentUsd, stoppedForBudget }) =>
      ({ openingAccountedUsd, freshAccountedUsd, spentUsd, stoppedForBudget }))(JSON.parse(second.stdout)),
    { openingAccountedUsd: 0.04, freshAccountedUsd: 0, spentUsd: 0.04, stoppedForBudget: true },
  )
  const state = JSON.parse(await readFile(path.join(directory, '.palari-alpha/budget.json'), 'utf8'))
  assert.equal(state.accountedUsd, 0.04)
})

test('CLI admits an exact decimal cap boundary without exceeding it', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'palari-alpha-decimal-cap-'))
  const adapterPath = path.join(directory, 'adapter.mjs')
  const alphaDirectory = path.join(directory, '.palari-alpha')
  await mkdir(alphaDirectory)
  await writeFile(path.join(alphaDirectory, 'budget.json'), JSON.stringify({
    schema: 'palari-alpha-budget/v1',
    accountedUsd: 38.61155714,
  }))
  await writeFile(adapterPath, `
    export function createAlphaRun() {
      return {
        questions: [{ id: 'q1' }],
        dependencies: {
          writer: () => 'memory',
          answer: { maxCostUsd: 0.70, invoke: () => ({ output: 'answer', costUsd: 0 }) },
        },
      }
    }
  `)
  const runner = new URL('../evals/run-alpha-memory-debug.mjs', import.meta.url).pathname
  const result = spawnSync(process.execPath, [
    runner,
    '--adapter', adapterPath,
    '--max-dollar', '39.31155714',
  ], { cwd: directory, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  const summary = JSON.parse(result.stdout)
  assert.equal(summary.completed, 1)
  assert.equal(summary.stoppedForBudget, false)
  assert.equal(summary.openingAccountedUsd, 38.61155714)
  assert.equal(summary.spentUsd, 38.61155714)
  const state = JSON.parse(await readFile(
    path.join(alphaDirectory, 'budget.json'),
    'utf8',
  ))
  assert.ok(state.accountedUsd <= 39.31155714)
})

test('failed CLI stage retains reservation and later caps use it', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'palari-alpha-failure-budget-'))
  const adapterPath = path.join(directory, 'adapter.mjs')
  await writeFile(adapterPath, `
    export function createAlphaRun() {
      return {
        questions: [{ id: 'q1' }],
        dependencies: {
          writer: { maxCostUsd: 0.03, invoke: () => { throw new Error('dispatched then failed') } },
          answer: () => 'answer',
        },
      }
    }
  `)
  const runner = new URL('../evals/run-alpha-memory-debug.mjs', import.meta.url).pathname
  const args = [runner, '--adapter', adapterPath, '--max-dollar', '0.05']
  const first = spawnSync(process.execPath, args, { cwd: directory, encoding: 'utf8' })
  assert.notEqual(first.status, 0)
  assert.equal(JSON.parse(first.stdout).spentUsd, 0.03)
  const second = spawnSync(process.execPath, args, { cwd: directory, encoding: 'utf8' })
  assert.notEqual(second.status, 0)
  assert.equal(JSON.parse(second.stdout).stoppedForBudget, true)
  const belowPrior = spawnSync(process.execPath, [
    runner, '--adapter', adapterPath, '--max-dollar', '0.02',
  ], { cwd: directory, encoding: 'utf8' })
  assert.notEqual(belowPrior.status, 0)
  assert.match(belowPrior.stderr, /below prior accounted spend/)
  const state = JSON.parse(await readFile(path.join(directory, '.palari-alpha/budget.json'), 'utf8'))
  assert.equal(state.accountedUsd, 0.03)
})

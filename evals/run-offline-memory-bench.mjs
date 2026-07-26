// CLI for the offline memory bench.
//
//   npm run memory-bench                  synthetic population, always runs
//   npm run memory-bench -- --dataset     real LongMemEval-S, if installed
//   npm run memory-bench -- --dataset --question 08e075c7
//   npm run memory-bench -- --limit 50
//
// Offline and spend-free: no credential is read, no provider is called, and
// no live identity or score is created.

import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  incrementalLongMemEvalExchangePlan,
} from './arms/incremental-memory-longmemeval-live-arm.mjs'
import {
  formatOfflineBenchReport,
  runOfflineMemoryBench,
  syntheticPopulation,
} from './offline-memory-bench.mjs'
import { loadLongMemEvalInstances } from '../src/longmemeval.mjs'

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const DATASET_PATH = 'data/longmemeval_s_cleaned.json'
const DEFAULT_QUESTION_ID = '08e075c7'

export function parseBenchArgs(argv = []) {
  const options = {
    dataset: false,
    limit: Number.POSITIVE_INFINITY,
    questionId: DEFAULT_QUESTION_ID,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--dataset') {
      options.dataset = true
    } else if (arg === '--question') {
      options.questionId = String(argv[index += 1] ?? '')
      options.dataset = true
    } else if (arg === '--limit') {
      const value = Number(argv[index += 1])
      if (!Number.isSafeInteger(value) || value < 1) {
        throw new Error('--limit must be a positive integer.')
      }
      options.limit = value
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }
  return options
}

export async function loadBenchPopulation(options) {
  if (!options.dataset) return syntheticPopulation()
  let raw
  try {
    raw = await readFile(resolve(repoRoot, DATASET_PATH), 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error(
        `${DATASET_PATH} is not installed. It is gitignored; see README ` +
        '"Running the memory bench". Omit --dataset to use the synthetic ' +
        'population.',
      )
    }
    throw error
  }
  const instances = loadLongMemEvalInstances(raw)
  const instance = instances.find(
    (candidate) => candidate.questionId === options.questionId,
  )
  if (!instance) {
    throw new Error(
      `Question ${options.questionId} is not in ${DATASET_PATH}.`,
    )
  }
  const answerSessions = new Set(instance.answerSessionIds)
  const exchanges = incrementalLongMemEvalExchangePlan(instance).map(
    (exchange) => ({
      ...exchange,
      // An exchange carries answer evidence when it belongs to a session the
      // dataset marks as answer-bearing.
      hasAnswer: answerSessions.has(
        String(exchange.sourceMessageId ?? '').split(':')[0],
      ),
    }),
  )
  return {
    answer: instance.answer,
    exchanges,
    label: `longmemeval-s:${instance.questionType}`,
    question: instance.question,
    questionId: instance.questionId,
  }
}

async function main() {
  const options = parseBenchArgs(process.argv.slice(2))
  const population = await loadBenchPopulation(options)
  process.stdout.write(
    `OFFLINE MEMORY BENCH — ${population.exchanges.length} interactions, ` +
    'no provider, no spend\n\n',
  )
  const result = await runOfflineMemoryBench({
    interactionLimit: options.limit,
    onProgress({ processed, total }) {
      if (processed % 25 === 0 || processed === total) {
        process.stdout.write(`  ...${processed}/${total}\n`)
      }
    },
    population,
  })
  process.stdout.write(`\n${formatOfflineBenchReport(result)}\n\n`)
  const stalled = result.pending > 0
  process.stdout.write(
    stalled
      ? 'RESULT: the reduction queue STALLED — actionable work remains.\n'
      : 'RESULT: every interaction reached a terminal reduction state.\n',
  )
  if (stalled) process.exitCode = 1
}

const invoked = process.argv[1] ? resolve(process.argv[1]) : ''
if (invoked === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`OFFLINE_MEMORY_BENCH_FAILED: ${error.message}\n`)
    process.exitCode = 1
  })
}

import { createHash } from 'node:crypto'
import { open } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import { dirname, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  TRANSFORMERS_RERANKER_MODELS,
  createTransformersReranker,
} from '../src/reranker-transformers.mjs'
import { RERANKER_BANK, RERANKER_BANK_VERSION } from './reranker-bank.mjs'

export const RERANKER_RETURN_CUTOFF = 5
export const RERANKER_SELECTION_RULE = Object.freeze({
  dominance:
    'A model dominates another when top1, MRR, and recall@5 are all >=, warm milliseconds/case is <=, and at least one comparison is strict.',
  minimumMrr: 0.85,
  minimumRecallAtCutoff: 1,
  minimumTop1: 0.8,
  rule:
    'Choose the lowest-latency nondominated model meeting all quality floors; otherwise choose no default.',
})

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

export function bankHash() {
  return sha256(JSON.stringify(RERANKER_BANK))
}

export function scoreRanks(ranks, positiveCases) {
  if (!Array.isArray(ranks) || !Number.isSafeInteger(positiveCases) ||
    positiveCases < 1 || ranks.length !== positiveCases) {
    throw new TypeError('ranks must contain one positive integer per case.')
  }
  for (const rank of ranks) {
    if (!Number.isSafeInteger(rank) || rank < 1) {
      throw new TypeError('Every rank must be a positive integer.')
    }
  }
  return Object.freeze({
    mrr: ranks.reduce((sum, rank) => sum + 1 / rank, 0) / positiveCases,
    recallAtCutoff:
      ranks.filter((rank) => rank <= RERANKER_RETURN_CUTOFF).length /
      positiveCases,
    top1: ranks.filter((rank) => rank === 1).length / positiveCases,
  })
}

export function baselineMetrics() {
  const ranks = RERANKER_BANK
    .filter((entry) => entry.relevantIds.length > 0)
    .map((entry) => entry.candidates.find((candidate) =>
      entry.relevantIds.includes(candidate.id)).rank)
  return { ranks, ...scoreRanks(ranks, ranks.length) }
}

function parseArgs(argv) {
  const options = {}
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--verify' || token === '--run' || token === '--smoke') {
      if (options.mode) throw new TypeError('Choose exactly one mode.')
      options.mode = token.slice(2)
      continue
    }
    if (!['--cache', '--model', '--result', '--runtime'].includes(token)) {
      throw new TypeError(`Unknown argument: ${token}`)
    }
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) {
      throw new TypeError(`${token} requires a value.`)
    }
    options[token.slice(2)] = value
    index += 1
  }
  return options
}

function outsideRepository(path, label) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const target = resolve(path)
  if (target === root || target.startsWith(`${root}${sep}`)) {
    throw new TypeError(`${label} must be outside the repository.`)
  }
  return target
}

async function writeExclusive(path, value) {
  const handle = await open(path, 'wx', 0o600)
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8')
    await handle.sync()
  } finally {
    await handle.close()
  }
}

async function runModel(options) {
  if (!TRANSFORMERS_RERANKER_MODELS[options.model]) {
    throw new TypeError('A frozen --model is required.')
  }
  for (const name of ['cache', 'result', 'runtime']) {
    if (!options[name]) throw new TypeError(`--${name} is required in run mode.`)
  }
  const cacheDir = outsideRepository(options.cache, 'cache')
  const resultPath = outsideRepository(options.result, 'result')
  const runtimePath = outsideRepository(options.runtime, 'runtime')
  const runtimeUrl = pathToFileURL(runtimePath).href
  let loadedRuntime
  const reranker = createTransformersReranker({
    cacheDir,
    loadRuntime: async () => {
      loadedRuntime ??= await import(runtimeUrl)
      return loadedRuntime
    },
    modelId: options.model,
  })

  const startedAt = new Date().toISOString()
  const common = {
    bankHash: bankHash(),
    bankVersion: RERANKER_BANK_VERSION,
    baseline: baselineMetrics(),
    costUsd: 0,
    model: reranker.model,
    selectionRule: RERANKER_SELECTION_RULE,
    startedAt,
  }
  try {
    await reranker.warm()
    const start = performance.now()
    const rawCases = []
    const ranks = []
    for (const entry of RERANKER_BANK) {
      const original = JSON.stringify(entry.candidates)
      const scores = await reranker(
        entry.query,
        entry.candidates.map((candidate) => candidate.text),
      )
      if (JSON.stringify(entry.candidates) !== original) {
        throw new Error('Canonical bank candidates changed during scoring.')
      }
      const ordered = entry.candidates.map((candidate, index) => ({
        id: candidate.id,
        score: scores[index],
      })).sort((left, right) =>
        right.score - left.score || left.id.localeCompare(right.id))
      const rank = entry.relevantIds.length === 0
        ? null
        : ordered.findIndex((row) => entry.relevantIds.includes(row.id)) + 1
      if (rank !== null) ranks.push(rank)
      rawCases.push({
        category: entry.category,
        id: entry.id,
        ordered,
        rank,
        relevantIds: entry.relevantIds,
      })
    }
    const elapsedMilliseconds = performance.now() - start
    const result = {
      ...common,
      completedAt: new Date().toISOString(),
      contentMutations: 0,
      latency: {
        method:
          'model preloaded; one ordered bank pass; wall time divided by 16 cases',
        totalMilliseconds: elapsedMilliseconds,
        warmMillisecondsPerCase: elapsedMilliseconds / RERANKER_BANK.length,
      },
      metrics: scoreRanks(ranks, ranks.length),
      positiveCases: ranks.length,
      rawCases,
      runtime: {
        name: '@huggingface/transformers',
        version: String(loadedRuntime?.env?.version ?? 'unknown'),
      },
      status: 'completed',
    }
    await writeExclusive(resultPath, result)
    return result
  } catch (error) {
    const result = {
      ...common,
      completedAt: new Date().toISOString(),
      failure: error instanceof Error ? error.message : String(error),
      runtime: {
        name: '@huggingface/transformers',
        version: String(loadedRuntime?.env?.version ?? 'unknown'),
      },
      status: 'failed',
    }
    await writeExclusive(resultPath, result)
    return result
  }
}

async function runSmoke(options) {
  if (options.model !== 'cross-encoder/ettin-reranker-17m-v1') {
    throw new TypeError('The frozen smoke model is Ettin-17M.')
  }
  for (const name of ['cache', 'result', 'runtime']) {
    if (!options[name]) throw new TypeError(`--${name} is required in smoke mode.`)
  }
  const cacheDir = outsideRepository(options.cache, 'cache')
  const resultPath = outsideRepository(options.result, 'result')
  const runtimePath = outsideRepository(options.runtime, 'runtime')
  const runtimeUrl = pathToFileURL(runtimePath).href
  let loadedRuntime
  const reranker = createTransformersReranker({
    cacheDir,
    loadRuntime: async () => {
      loadedRuntime ??= await import(runtimeUrl)
      return loadedRuntime
    },
    modelId: options.model,
  })
  const common = {
    costUsd: 0,
    model: reranker.model,
    runtime: {
      name: '@huggingface/transformers',
      version: '4.2.0',
    },
    startedAt: new Date().toISOString(),
  }
  try {
    const scores = await reranker(
      'Which planet is known as the Red Planet?',
      [
        'Mars is commonly called the Red Planet.',
        'The Pacific Ocean is the largest ocean on Earth.',
      ],
    )
    const result = {
      ...common,
      completedAt: new Date().toISOString(),
      finiteScores: scores.length === 2 && scores.every(Number.isFinite),
      scoreCount: scores.length,
      status: 'completed',
    }
    if (!result.finiteScores) {
      throw new TypeError('Ettin compatibility smoke returned invalid scores.')
    }
    await writeExclusive(resultPath, result)
    return result
  } catch (error) {
    const result = {
      ...common,
      completedAt: new Date().toISOString(),
      failure: error instanceof Error ? error.message : String(error),
      status: 'failed',
    }
    await writeExclusive(resultPath, result)
    return result
  }
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv)
  if (options.mode === 'verify') {
    if (Object.keys(options).length !== 1) {
      throw new TypeError('--verify accepts no scoring arguments.')
    }
    return {
      bankCases: RERANKER_BANK.length,
      bankHash: bankHash(),
      bankVersion: RERANKER_BANK_VERSION,
      baseline: baselineMetrics(),
      models: TRANSFORMERS_RERANKER_MODELS,
      selectionRule: RERANKER_SELECTION_RULE,
    }
  }
  if (options.mode === 'smoke') {
    return runSmoke(options)
  }
  if (options.mode !== 'run') {
    throw new TypeError('Choose --verify, --smoke, or --run.')
  }
  return runModel(options)
}

const invokedPath = process.argv[1]
if (invokedPath && import.meta.url === pathToFileURL(resolve(invokedPath)).href) {
  try {
    console.log(JSON.stringify(await main(), null, 2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}

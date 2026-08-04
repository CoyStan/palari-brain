import { createHash } from 'node:crypto'
import { open, readFile } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import { dirname, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  ETTIN_HEAD_ARTIFACTS,
  createEttinReranker,
} from '../src/reranker-ettin.mjs'
import { RERANKER_BANK, RERANKER_BANK_VERSION } from './reranker-bank.mjs'
import {
  RERANKER_RETURN_CUTOFF,
  RERANKER_SELECTION_RULE,
  baselineMetrics,
  bankHash,
  scoreRanks,
} from './run-reranker-bakeoff.mjs'

export const ETTIN_NATIVE_IDENTITY = 'brn-0009/ettin-native-v1'
export const ETTIN_RUNTIME_IDENTITY = Object.freeze({
  entrypointSha256: '268f62dadd7bee2dbdf7f8634d0185603e68a985f91009488b956f3f62da5c23',
  name: '@huggingface/transformers',
  packageJsonSha256: '9cf12901d934e5a0628c6f163484abade392ab2d3b369d458ed3dfdeaa7f9a39',
  version: '4.2.0',
})

function parseArgs(argv) {
  const options = {}
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (['--verify', '--smoke', '--run'].includes(token)) {
      if (options.mode) throw new TypeError('Choose exactly one mode.')
      options.mode = token.slice(2)
      continue
    }
    if (!['--cache', '--result', '--runtime'].includes(token)) {
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

function requiredPaths(options, mode) {
  for (const name of ['cache', 'result', 'runtime']) {
    if (!options[name]) throw new TypeError(`--${name} is required in ${mode} mode.`)
  }
  return {
    cacheDir: outsideRepository(options.cache, 'cache'),
    resultPath: outsideRepository(options.result, 'result'),
    runtimePath: outsideRepository(options.runtime, 'runtime'),
  }
}

export async function verifyEttinRuntime(runtimePath) {
  const entrypoint = await readFile(runtimePath)
  const packagePath = resolve(dirname(runtimePath), '..', 'package.json')
  const packageBytes = await readFile(packagePath)
  let metadata
  try {
    metadata = JSON.parse(packageBytes.toString('utf8'))
  } catch (error) {
    throw new TypeError('Ettin runtime package metadata is invalid JSON.', {
      cause: error,
    })
  }
  if (runnerHash(entrypoint) !== ETTIN_RUNTIME_IDENTITY.entrypointSha256 ||
    runnerHash(packageBytes) !== ETTIN_RUNTIME_IDENTITY.packageJsonSha256 ||
    metadata?.name !== ETTIN_RUNTIME_IDENTITY.name ||
    metadata?.version !== ETTIN_RUNTIME_IDENTITY.version) {
    throw new TypeError('Ettin runtime does not match the frozen identity.')
  }
  const runtime = await import(pathToFileURL(runtimePath).href)
  if (runtime?.env?.version !== ETTIN_RUNTIME_IDENTITY.version) {
    throw new TypeError('Ettin runtime export does not match the frozen version.')
  }
  return Object.freeze({ runtime, runtimeIdentity: ETTIN_RUNTIME_IDENTITY })
}

async function configuredReranker(options, mode) {
  const paths = requiredPaths(options, mode)
  const { runtime, runtimeIdentity } = await verifyEttinRuntime(paths.runtimePath)
  const reranker = createEttinReranker({
    cacheDir: paths.cacheDir,
    loadRuntime: async () => runtime,
  })
  return { ...paths, reranker, runtimeIdentity }
}

function common(reranker, runtimeIdentity) {
  return {
    artifacts: ETTIN_HEAD_ARTIFACTS.map(({ bytes, path, sha256 }) => ({
      bytes, path, sha256,
    })),
    bankHash: bankHash(),
    bankVersion: RERANKER_BANK_VERSION,
    costUsd: 0,
    identity: ETTIN_NATIVE_IDENTITY,
    model: reranker.model,
    runtime: runtimeIdentity,
    startedAt: new Date().toISOString(),
  }
}

async function runSmoke(options) {
  const configured = await configuredReranker(options, 'smoke')
  const state = common(configured.reranker, configured.runtimeIdentity)
  try {
    const scores = await configured.reranker(
      'Which planet is known as the Red Planet?',
      [
        'Mars is commonly called the Red Planet.',
        'The Pacific Ocean is the largest ocean on Earth.',
      ],
    )
    const result = {
      ...state,
      completedAt: new Date().toISOString(),
      finiteScores: scores.length === 2 && scores.every(Number.isFinite),
      relevantFirst: scores[0] > scores[1],
      scoreCount: scores.length,
      status: 'completed',
    }
    if (!result.finiteScores || !result.relevantFirst) {
      throw new Error('Ettin native compatibility ordering failed.')
    }
    await writeExclusive(configured.resultPath, result)
    return result
  } catch (error) {
    const result = {
      ...state,
      completedAt: new Date().toISOString(),
      failure: error instanceof Error ? error.message : String(error),
      status: 'failed',
    }
    await writeExclusive(configured.resultPath, result)
    return result
  }
}

async function runBank(options) {
  const configured = await configuredReranker(options, 'run')
  const state = {
    ...common(configured.reranker, configured.runtimeIdentity),
    baseline: baselineMetrics(),
    selectionRule: RERANKER_SELECTION_RULE,
  }
  try {
    await configured.reranker.warm()
    const start = performance.now()
    const rawCases = []
    const ranks = []
    for (const entry of RERANKER_BANK) {
      const original = JSON.stringify(entry.candidates)
      const scores = await configured.reranker(
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
      ...state,
      completedAt: new Date().toISOString(),
      contentMutations: 0,
      latency: {
        method: 'model/head preloaded; one ordered bank pass; wall time / 16 cases',
        totalMilliseconds: elapsedMilliseconds,
        warmMillisecondsPerCase: elapsedMilliseconds / RERANKER_BANK.length,
      },
      metrics: scoreRanks(ranks, ranks.length),
      positiveCases: ranks.length,
      rawCases,
      returnCutoff: RERANKER_RETURN_CUTOFF,
      status: 'completed',
    }
    await writeExclusive(configured.resultPath, result)
    return result
  } catch (error) {
    const result = {
      ...state,
      completedAt: new Date().toISOString(),
      failure: error instanceof Error ? error.message : String(error),
      status: 'failed',
    }
    await writeExclusive(configured.resultPath, result)
    return result
  }
}

export function runnerHash(value) {
  return createHash('sha256').update(value).digest('hex')
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv)
  if (options.mode === 'verify') {
    if (Object.keys(options).length !== 1) {
      throw new TypeError('--verify accepts no execution arguments.')
    }
    return {
      artifacts: ETTIN_HEAD_ARTIFACTS.map(({ bytes, path, sha256 }) => ({
        bytes, path, sha256,
      })),
      bankCases: RERANKER_BANK.length,
      bankHash: bankHash(),
      bankVersion: RERANKER_BANK_VERSION,
      baseline: baselineMetrics(),
      identity: ETTIN_NATIVE_IDENTITY,
      runtime: ETTIN_RUNTIME_IDENTITY,
      selectionRule: RERANKER_SELECTION_RULE,
    }
  }
  if (options.mode === 'smoke') return runSmoke(options)
  if (options.mode === 'run') return runBank(options)
  throw new TypeError('Choose --verify, --smoke, or --run.')
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

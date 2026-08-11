#!/usr/bin/env node
// SCALE-05: one cached OpenAI embedding pass over a diverse, deterministic
// synthetic corpus, followed by provider-free exact/locator comparisons.
// This is an alpha diagnostic, not a release benchmark or runtime switch.

import { mkdir, rename, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

import { openContentAddressedEmbeddingCache } from './content-addressed-embedding-cache.mjs'
import {
  createLocatorQualityCorpus,
} from './locator-quality-corpus.mjs'
import { evaluateLocatorQuality } from './locator-quality-evaluation.mjs'
import {
  createCappedOpenAIEmbeddingAdapter,
} from './openai-embedding-adapter.mjs'
import {
  createFileBudgetStore,
  resolveAlphaFilePath,
} from './run-alpha-memory-debug.mjs'
import {
  createFileRollingTokenPacer,
  createRollingTokenPacer,
} from './rolling-token-pacer.mjs'

export const SCALE05_APPROVED_CAP_USD = 1
export const SCALE05_DIMENSIONS = 1_536
export const SCALE05_MODEL = 'text-embedding-3-small'

const DEFAULT_BUDGET_PATH = '.palari-alpha/scale05-openai-budget.json'
const DEFAULT_CACHE_PATH = '.palari-alpha/scale05-openai-embeddings.sqlite'
const DEFAULT_RESULT_PATH = '.palari-alpha/scale05-openai-result.json'
const DEFAULT_MAX_REQUESTS_PER_MINUTE = 100
const DEFAULT_MAX_TOKEN_UNITS_PER_MINUTE = 30_000

function nonnegativeFinite(value, label) {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) {
    throw new TypeError(`${label} must be a finite nonnegative number.`)
  }
  return number
}

function positiveFinite(value, label) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) {
    throw new TypeError(`${label} must be a positive finite number.`)
  }
  return number
}

function positiveSafeInteger(value, label) {
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < 1) {
    throw new TypeError(`${label} must be a positive safe integer.`)
  }
  return number
}

export function parseOpenAILocatorQualityArgs(argv) {
  const options = {
    maxRequestsPerMinute: DEFAULT_MAX_REQUESTS_PER_MINUTE,
    maxTokenUnitsPerMinute: DEFAULT_MAX_TOKEN_UNITS_PER_MINUTE,
    preflightOnly: false,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    if (flag === '--preflight-only') {
      options.preflightOnly = true
      continue
    }
    const value = argv[index + 1]
    if (value == null || value.startsWith('--')) {
      throw new TypeError(`${flag} requires a value.`)
    }
    index += 1
    if (flag === '--max-dollar') options.maxDollar = Number(value)
    else if (flag === '--price-per-million') {
      options.priceUsdPerMillionTokens = Number(value)
    } else if (flag === '--max-requests-per-minute') {
      options.maxRequestsPerMinute = Number(value)
    } else if (flag === '--max-token-units-per-minute') {
      options.maxTokenUnitsPerMinute = Number(value)
    } else {
      throw new TypeError(`Unknown SCALE-05 flag: ${flag}`)
    }
  }
  if (options.maxDollar === undefined) {
    throw new TypeError('--max-dollar is required.')
  }
  if (options.priceUsdPerMillionTokens === undefined) {
    throw new TypeError('--price-per-million is required and must be reviewed.')
  }
  options.maxDollar = nonnegativeFinite(options.maxDollar, '--max-dollar')
  options.priceUsdPerMillionTokens = positiveFinite(
    options.priceUsdPerMillionTokens,
    '--price-per-million',
  )
  options.maxRequestsPerMinute = positiveSafeInteger(
    options.maxRequestsPerMinute,
    '--max-requests-per-minute',
  )
  options.maxTokenUnitsPerMinute = positiveSafeInteger(
    options.maxTokenUnitsPerMinute,
    '--max-token-units-per-minute',
  )
  if (options.maxDollar > SCALE05_APPROVED_CAP_USD) {
    throw new TypeError(
      `--max-dollar exceeds the founder-approved SCALE-05 cap of ` +
        `$${SCALE05_APPROVED_CAP_USD}.`,
    )
  }
  return options
}

function namespace({ dimensions, model }) {
  return `openai|${model}|dimensions=${dimensions}|encoding=float|scale05-corpus-v1`
}

function resolveDiagnosticPath(candidate, label) {
  if (typeof candidate !== 'string' || !candidate.trim()) {
    throw new TypeError(`${label} must be a non-empty path.`)
  }
  const absolute = resolve(candidate)
  const alphaRoot = resolve('.palari-alpha')
  const temporaryRoot = resolve(tmpdir())
  const inside = (root) => absolute !== root && absolute.startsWith(`${root}${sep}`)
  if (!inside(alphaRoot) && !inside(temporaryRoot)) {
    throw new TypeError(
      `${label} must stay inside ${alphaRoot} or ${temporaryRoot}.`,
    )
  }
  return absolute
}

function defaultPacer({
  maxRequestsPerMinute,
  maxTokenUnitsPerMinute,
  preflightOnly,
}) {
  if (preflightOnly) {
    return createRollingTokenPacer({ maxUnits: maxTokenUnitsPerMinute })
  }
  const statePath = resolveAlphaFilePath(
    `.palari-alpha/scale05-openai-pacer-` +
      `${maxRequestsPerMinute}-${maxTokenUnitsPerMinute}.json`,
    'pacerPath',
  )
  return createFileRollingTokenPacer({
    maxRequests: maxRequestsPerMinute,
    maxUnits: maxTokenUnitsPerMinute,
    statePath,
  })
}

async function writeAggregateResult(path, summary) {
  const absolute = resolveDiagnosticPath(path, 'resultPath')
  await mkdir(dirname(absolute), { recursive: true, mode: 0o700 })
  const temporary = `${absolute}.tmp-${process.pid}`
  await writeFile(temporary, `${JSON.stringify(summary, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  })
  await rename(temporary, absolute)
  return absolute
}

export async function runOpenAILocatorQuality({
  apiKey = process.env.OPENAI_API_KEY,
  budgetPath = DEFAULT_BUDGET_PATH,
  budgetStore = null,
  cachePath = DEFAULT_CACHE_PATH,
  corpus = createLocatorQualityCorpus(),
  dimensions = SCALE05_DIMENSIONS,
  fetchImpl = fetch,
  maxDollar,
  maxRequestsPerMinute = DEFAULT_MAX_REQUESTS_PER_MINUTE,
  maxTokenUnitsPerMinute = DEFAULT_MAX_TOKEN_UNITS_PER_MINUTE,
  model = SCALE05_MODEL,
  pacer = null,
  preflightOnly = false,
  priceUsdPerMillionTokens,
  resultPath = DEFAULT_RESULT_PATH,
  tiers = [2_000, 5_000],
  writeResult = true,
} = {}) {
  const capUsd = nonnegativeFinite(maxDollar, 'maxDollar')
  if (capUsd > SCALE05_APPROVED_CAP_USD) {
    throw new TypeError(
      `maxDollar exceeds the founder-approved SCALE-05 cap of ` +
        `$${SCALE05_APPROVED_CAP_USD}.`,
    )
  }
  const price = positiveFinite(
    priceUsdPerMillionTokens,
    'priceUsdPerMillionTokens',
  )
  const vectorDimensions = positiveSafeInteger(dimensions, 'dimensions')
  const requestsPerMinute = positiveSafeInteger(
    maxRequestsPerMinute,
    'maxRequestsPerMinute',
  )
  const tokenUnitsPerMinute = positiveSafeInteger(
    maxTokenUnitsPerMinute,
    'maxTokenUnitsPerMinute',
  )
  if (!apiKey || !String(apiKey).trim()) {
    throw new TypeError('OPENAI_API_KEY is required.')
  }
  if (!corpus || !Array.isArray(corpus.records) ||
      !Array.isArray(corpus.queries)) {
    throw new TypeError('corpus must provide records and queries.')
  }

  const activeBudgetStore = budgetStore ?? createFileBudgetStore(budgetPath)
  const activePacer = pacer ?? defaultPacer({
    maxRequestsPerMinute: requestsPerMinute,
    maxTokenUnitsPerMinute: tokenUnitsPerMinute,
    preflightOnly,
  })
  const adapter = createCappedOpenAIEmbeddingAdapter({
    apiKey,
    budgetStore: activeBudgetStore,
    dimensions: vectorDimensions,
    fetchImpl,
    maxBatchTokenUnits: Math.min(200_000, tokenUnitsPerMinute),
    maxDollar: capUsd,
    model,
    pacer: activePacer,
    priceUsdPerMillionTokens: price,
  })
  const cache = await openContentAddressedEmbeddingCache({
    embed: adapter.embed,
    namespace: namespace({ dimensions: vectorDimensions, model }),
    path: resolveDiagnosticPath(cachePath, 'cachePath'),
  })

  try {
    if (preflightOnly) {
      const firstTarget = corpus.records.find(({ kind }) => kind === 'target')
      const vectors = await cache.embed([
        firstTarget?.text ?? corpus.records[0]?.text,
        corpus.queries[0]?.text,
      ])
      const accountedUsd = await activeBudgetStore.load()
      return Object.freeze({
        budget: Object.freeze({ accountedUsd, capUsd }),
        cache: cache.stats,
        dimensions: vectorDimensions,
        mode: 'diagnostic-not-a-benchmark',
        phase: 'preflight',
        pricingAssumptionUsdPerMillionTokens: price,
        provider: adapter.stats,
        ratePacer: activePacer.stats,
        vectorCount: vectors.length,
        model,
      })
    }

    const texts = [
      ...corpus.records.map(({ text }) => text),
      ...corpus.queries.map(({ text }) => text),
    ]
    const vectors = await cache.embed(texts)
    const recordVectors = vectors.slice(0, corpus.records.length)
    const queryVectors = vectors.slice(corpus.records.length)
    const evaluation = evaluateLocatorQuality({
      queries: corpus.queries,
      queryVectors,
      records: corpus.records,
      recordVectors,
      tiers,
    })
    const accountedUsd = await activeBudgetStore.load()
    const summary = {
      budget: Object.freeze({ accountedUsd, capUsd }),
      cache: cache.stats,
      corpus: Object.freeze({
        domains: new Set(corpus.records.map(({ domain }) => domain)).size,
        licence: corpus.licence,
        queries: corpus.queries.length,
        records: corpus.records.length,
        uniqueTexts: new Set(texts).size,
      }),
      dimensions: vectorDimensions,
      evaluation,
      mode: 'diagnostic-not-a-benchmark',
      model,
      phase: 'quality-comparison',
      pricingAssumptionUsdPerMillionTokens: price,
      provider: adapter.stats,
      ratePacer: activePacer.stats,
    }
    const writtenPath = writeResult
      ? await writeAggregateResult(resultPath, summary)
      : null
    return Object.freeze({ ...summary, resultPath: writtenPath })
  } finally {
    cache.close()
  }
}

async function main() {
  const options = parseOpenAILocatorQualityArgs(process.argv.slice(2))
  const summary = await runOpenAILocatorQuality(options)
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  })
}

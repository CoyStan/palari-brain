#!/usr/bin/env node
// SCALE-07: compare provider-free OpenAI embedding prefix sizes and USearch
// quantization. The full cached 1,536d vectors remain the exact reference and
// canonical reranking authority. Index files are measured in a temporary
// directory and removed after the aggregate result is written.

import { mkdir, mkdtemp, rename, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { pathToFileURL } from 'node:url'

import {
  evaluateLocatorQuality,
  LOCATOR_QUALITY_SCOPE,
} from './locator-quality-evaluation.mjs'
import { createLocatorQualityCorpus } from './locator-quality-corpus.mjs'
import {
  createShortenedOpenAIHnswLocator,
  shortenOpenAIEmbedding,
} from './openai-embedding-representation.mjs'
import { resolveAlphaFilePath } from './run-alpha-memory-debug.mjs'
import { SCALE05_DIMENSIONS } from './run-openai-locator-quality.mjs'
import {
  loadScale05CachedVectors,
  SCALE05_CACHE_PATH,
} from './scale05-cached-vectors.mjs'

const RESULT_PATH = '.palari-alpha/scale07-hnsw-representations.json'
const PROJECTION_COUNTS = Object.freeze([500_000, 2_000_000])
const SCALAR_BYTES = Object.freeze({ bf16: 2, f32: 4, i8: 1 })
const CONFIGS = Object.freeze(
  [256, 512, 768, SCALE05_DIMENSIONS].flatMap((dimensions) =>
    ['i8', 'bf16', 'f32'].map((quantization) => Object.freeze({
      candidateLimit: 160,
      connectivity: 16,
      dimensions,
      expansionAdd: 256,
      expansionSearch: 256,
      label: `OpenAI prefix ${dimensions}d / ${quantization} / M16 / ef256 / k160`,
      quantization,
      sourceDimensions: SCALE05_DIMENSIONS,
    }))),
)

async function writeResult(path, value) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  const temporary = `${path}.tmp-${process.pid}`
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  })
  await rename(temporary, path)
}

function rounded(value, digits = 3) {
  return Number(Number(value).toFixed(digits))
}

export async function runHnswRepresentationQuality({
  cachePath = SCALE05_CACHE_PATH,
  corpus = createLocatorQualityCorpus(),
  resultPath = RESULT_PATH,
  tiers = [5_000],
} = {}) {
  if (!Array.isArray(tiers) || tiers.length < 1) {
    throw new TypeError('tiers must be a non-empty array.')
  }
  const {
    cache,
    queryVectors,
    recordVectors,
  } = await loadScale05CachedVectors({
    cachePath,
    caller: 'SCALE-07',
    corpus,
  })
  const builtLocators = new Map()
  const evaluation = evaluateLocatorQuality({
    locatorConfigs: CONFIGS,
    locatorFactory: (config) => {
      const locator = createShortenedOpenAIHnswLocator(config)
      builtLocators.set(config.label, locator)
      return locator
    },
    queries: corpus.queries,
    queryVectors,
    records: corpus.records,
    recordVectors,
    tiers,
  })

  const largestTier = Math.max(...tiers)
  const evidenceIds = corpus.records
    .slice(0, largestTier)
    .map(({ id }) => id)
  const storage = []
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'palari-scale07-'))
  try {
    for (const [index, config] of CONFIGS.entries()) {
      const locator = builtLocators.get(config.label)
      if (!locator) throw new Error(`missing built locator ${config.label}.`)
      const path = join(temporaryRoot, `representation-${index}.usearch`)
      const saveStarted = performance.now()
      locator.save(LOCATOR_QUALITY_SCOPE, path)
      const saveMs = performance.now() - saveStarted
      const indexBytes = (await stat(path)).size

      const restored = createShortenedOpenAIHnswLocator(config)
      const loadStarted = performance.now()
      restored.load(LOCATOR_QUALITY_SCOPE, { evidenceIds, path })
      const loadMs = performance.now() - loadStarted
      let queryParity = 0
      for (const queryVector of queryVectors) {
        if (JSON.stringify(restored.locate(LOCATOR_QUALITY_SCOPE, queryVector)) ===
            JSON.stringify(locator.locate(LOCATOR_QUALITY_SCOPE, queryVector))) {
          queryParity += 1
        }
      }

      storage.push(Object.freeze({
        dimensions: config.dimensions,
        indexBytes,
        indexBytesPerVector: rounded(indexBytes / largestTier),
        label: config.label,
        loadMs: rounded(loadMs, 1),
        projectedSameLayoutBytes: Object.fromEntries(PROJECTION_COUNTS.map(
          (count) => [count, Math.round(indexBytes * count / largestTier)],
        )),
        quantization: config.quantization,
        queryParity: `${queryParity}/${queryVectors.length}`,
        rawVectorBytes: largestTier * config.dimensions *
          SCALAR_BYTES[config.quantization],
        saveMs: rounded(saveMs, 1),
        vectors: largestTier,
      }))
    }
  } finally {
    await rm(temporaryRoot, { force: true, recursive: true })
  }

  const largestEvaluation = evaluation.tiers.find(
    ({ tierSize }) => tierSize === largestTier,
  )
  if (!largestEvaluation) {
    throw new Error(`missing evaluation for largest tier ${largestTier}.`)
  }
  const storageByLabel = new Map(storage.map((item) => [item.label, item]))
  const passing = largestEvaluation.locators
    .filter(({ passesReviewThresholds }) => passesReviewThresholds)
    .map((result) => ({
      result,
      storage: storageByLabel.get(result.config.label),
    }))
    .sort((left, right) =>
      left.storage.indexBytes - right.storage.indexBytes ||
      left.result.quality.all.p95Ms - right.result.quality.all.p95Ms)
  const selected = passing[0]
    ? Object.freeze({
        dimensions: passing[0].result.config.dimensions,
        indexBytes: passing[0].storage.indexBytes,
        label: passing[0].result.config.label,
        quantization: passing[0].result.config.quantization,
        reason: 'smallest measured index passing the candidate review assumptions with full-vector exact reranking',
      })
    : null
  let compactRerankEvaluation = null
  let storageScenarios = null
  if (selected) {
    const selectedConfig = passing[0].result.config
    const compactRecordVectors = recordVectors.map((vector) =>
      shortenOpenAIEmbedding(vector, selected.dimensions, {
        sourceDimensions: SCALE05_DIMENSIONS,
      }))
    const compactQueryVectors = queryVectors.map((vector) =>
      shortenOpenAIEmbedding(vector, selected.dimensions, {
        sourceDimensions: SCALE05_DIMENSIONS,
      }))
    compactRerankEvaluation = evaluateLocatorQuality({
      locatorConfigs: [selectedConfig],
      locatorFactory: createShortenedOpenAIHnswLocator,
      queries: corpus.queries,
      queryVectors,
      records: corpus.records,
      recordVectors,
      rerankQueryVectors: compactQueryVectors,
      rerankRecordVectors: compactRecordVectors,
      tiers,
    })
    const selectedStorage = passing[0].storage
    const compactCanonicalBytes = largestTier * selected.dimensions * 4
    const fullCanonicalBytes = largestTier * SCALE05_DIMENSIONS * 4
    const scenarios = {
      compactF32CanonicalPlusIndex: compactCanonicalBytes +
        selectedStorage.indexBytes,
      full1536f32CanonicalPlusIndex: fullCanonicalBytes +
        selectedStorage.indexBytes,
      hnswIndexOnly: selectedStorage.indexBytes,
    }
    storageScenarios = Object.freeze({
      atMeasuredTier: Object.freeze(scenarios),
      projectedSameLayoutBytes: Object.fromEntries(PROJECTION_COUNTS.map(
        (count) => [count, Object.fromEntries(Object.entries(scenarios).map(
          ([label, bytes]) => [label, Math.round(bytes * count / largestTier)],
        ))],
      )),
      vectors: largestTier,
    })
  }

  const summary = Object.freeze({
    cache,
    compactRerankEvaluation,
    corpus: Object.freeze({
      licence: corpus.licence,
      queries: corpus.queries.length,
      records: corpus.records.length,
    }),
    evaluation,
    graph: Object.freeze({
      candidateLimit: 160,
      connectivity: 16,
      expansionAdd: 256,
      expansionSearch: 256,
    }),
    manualShortening: Object.freeze({
      method: 'take the leading dimensions and L2-normalize',
      sourceDimensions: SCALE05_DIMENSIONS,
    }),
    mode: 'diagnostic-not-a-benchmark',
    providerCalls: 0,
    selectedRepresentation: selected,
    storage: Object.freeze(storage),
    storageScenarios,
  })
  await writeResult(resolveAlphaFilePath(resultPath, 'resultPath'), summary)
  return summary
}

async function main() {
  if (process.argv.length > 2) throw new TypeError('SCALE-07 accepts no flags.')
  process.stdout.write(
    `${JSON.stringify(await runHnswRepresentationQuality(), null, 2)}\n`,
  )
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  })
}

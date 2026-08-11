#!/usr/bin/env node
// SCALE-06: evaluate one mature HNSW implementation over the complete cached
// SCALE-05 vectors. Cache misses fail closed; this runner has no provider path.

import { mkdir, rename, stat, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { pathToFileURL } from 'node:url'

import { createLocatorQualityCorpus } from './locator-quality-corpus.mjs'
import { evaluateLocatorQuality } from './locator-quality-evaluation.mjs'
import { SCALE05_DIMENSIONS } from './run-openai-locator-quality.mjs'
import { resolveAlphaFilePath } from './run-alpha-memory-debug.mjs'
import {
  loadScale05CachedVectors,
  SCALE05_CACHE_PATH,
} from './scale05-cached-vectors.mjs'
import { createUsearchHnswLocator } from './usearch-hnsw-locator.mjs'

const INDEX_PATH = '.palari-alpha/scale06-usearch-5000.index'
const RESULT_PATH = '.palari-alpha/scale06-hnsw-result.json'
const SCOPE = Object.freeze({
  palariId: 'scale-05-palari',
  userId: 'scale-05-user',
})
const CONFIGS = Object.freeze([
  Object.freeze({
    candidateLimit: 80,
    connectivity: 16,
    dimensions: SCALE05_DIMENSIONS,
    expansionAdd: 128,
    expansionSearch: 128,
    label: 'USearch HNSW f32 / M16 / ef128 / k80',
  }),
  Object.freeze({
    candidateLimit: 160,
    connectivity: 16,
    dimensions: SCALE05_DIMENSIONS,
    expansionAdd: 256,
    expansionSearch: 256,
    label: 'USearch HNSW f32 / M16 / ef256 / k160',
  }),
  Object.freeze({
    candidateLimit: 320,
    connectivity: 32,
    dimensions: SCALE05_DIMENSIONS,
    expansionAdd: 512,
    expansionSearch: 512,
    label: 'USearch HNSW f32 / M32 / ef512 / k320',
  }),
])

async function writeResult(path, value) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  const temporary = `${path}.tmp-${process.pid}`
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  })
  await rename(temporary, path)
}

export async function runHnswLocatorQuality({
  cachePath = SCALE05_CACHE_PATH,
  corpus = createLocatorQualityCorpus(),
  indexPath = INDEX_PATH,
  resultPath = RESULT_PATH,
  tiers = [2_000, 5_000],
} = {}) {
  const {
    cache: cacheStats,
    queryVectors,
    recordVectors,
  } = await loadScale05CachedVectors({
    cachePath,
    caller: 'SCALE-06',
    corpus,
  })
  const evaluation = evaluateLocatorQuality({
    locatorConfigs: CONFIGS,
    locatorFactory: createUsearchHnswLocator,
    queries: corpus.queries,
    queryVectors,
    records: corpus.records,
    recordVectors,
    tiers,
  })

  const largestTier = Math.max(...tiers)
  const entries = corpus.records.slice(0, largestTier).map((record, index) => ({
    evidenceId: record.id,
    vector: recordVectors[index],
  }))
  const persistedConfig = CONFIGS.at(-1)
  const persisted = createUsearchHnswLocator(persistedConfig)
  const persistBuildStarted = performance.now()
  persisted.replace(SCOPE, entries)
  const persistBuildMs = performance.now() - persistBuildStarted
  const absoluteIndexPath = resolveAlphaFilePath(indexPath, 'indexPath')
  await mkdir(dirname(absoluteIndexPath), { recursive: true, mode: 0o700 })
  const temporaryIndexPath = `${absoluteIndexPath}.tmp-${process.pid}`
  persisted.save(SCOPE, temporaryIndexPath)
  await rename(temporaryIndexPath, absoluteIndexPath)
  const indexBytes = (await stat(absoluteIndexPath)).size

  const restored = createUsearchHnswLocator(persistedConfig)
  const loadStarted = performance.now()
  restored.load(SCOPE, {
    evidenceIds: corpus.records.slice(0, largestTier).map(({ id }) => id),
    path: absoluteIndexPath,
  })
  const loadMs = performance.now() - loadStarted
  let queryParity = 0
  for (const [index, queryVector] of queryVectors.entries()) {
    if (JSON.stringify(restored.locate(SCOPE, queryVector)) ===
        JSON.stringify(persisted.locate(SCOPE, queryVector))) {
      queryParity += 1
    }
  }

  const summary = Object.freeze({
    cache: cacheStats,
    corpus: Object.freeze({
      licence: corpus.licence,
      queries: corpus.queries.length,
      records: corpus.records.length,
    }),
    evaluation,
    implementation: Object.freeze({
      license: 'Apache-2.0',
      name: 'usearch',
      version: '2.26.0',
    }),
    mode: 'diagnostic-not-a-benchmark',
    persistence: Object.freeze({
      buildMs: Number(persistBuildMs.toFixed(1)),
      indexBytes,
      loadMs: Number(loadMs.toFixed(1)),
      queryParity: `${queryParity}/${queryVectors.length}`,
    }),
    providerCalls: 0,
  })
  await writeResult(resolveAlphaFilePath(resultPath, 'resultPath'), summary)
  return summary
}

async function main() {
  if (process.argv.length > 2) throw new TypeError('SCALE-06 accepts no flags.')
  process.stdout.write(`${JSON.stringify(await runHnswLocatorQuality(), null, 2)}\n`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  })
}

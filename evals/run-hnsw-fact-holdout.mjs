#!/usr/bin/env node
// Fixed-configuration, cache-only diagnostic. The historical SCALE-05 corpus
// was evaluated before this split: its holdout is retrospective, not unseen.
import { pathToFileURL } from 'node:url'
import { createLocatorQualityCorpus } from './locator-quality-corpus.mjs'
import { evaluateLocatorQuality } from './locator-quality-evaluation.mjs'
import { createShortenedOpenAIHnswLocator } from './openai-embedding-representation.mjs'
import { loadScale05CachedVectors, SCALE05_CACHE_PATH } from './scale05-cached-vectors.mjs'

const FIXED_CONFIG = Object.freeze({
  candidateLimit: 160, connectivity: 16, dimensions: 512,
  expansionAdd: 256, expansionSearch: 256, quantization: 'i8',
  sourceDimensions: 1536, label: 'fixed SCALE-08 candidate / 512d i8 M16 ef256 k160',
})

export async function runHnswFactHoldout({
  cachePath = SCALE05_CACHE_PATH,
  corpus = createLocatorQualityCorpus(),
  tiers = [5000],
} = {}) {
  const { cache, queryVectors, recordVectors } = await loadScale05CachedVectors({
    cachePath, corpus, caller: 'MATH-07 fact holdout',
  })
  const evaluation = evaluateLocatorQuality({
    records: corpus.records, queries: corpus.queries, recordVectors, queryVectors,
    locatorConfigs: [FIXED_CONFIG], locatorFactory: createShortenedOpenAIHnswLocator,
    tiers, queryPartition: { subset: 'holdout', holdoutFraction: 0.2, seed: 'palari-fact-split/v1' },
  })
  return {
    mode: 'retrospective-diagnostic-not-a-benchmark',
    priorExposure: 'The default historical corpus has already informed configuration selection. This split is not an unseen test set.',
    selection: 'One previously selected configuration; no tuning or configuration selection on this holdout.',
    cache, evaluation,
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(JSON.stringify(await runHnswFactHoldout(), null, 2))
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}

// Offline SCALE-05 comparison over caller-supplied vectors. The exact scan is
// the reference ranking. A private locator may only propose IDs; every result
// is reranked with exact cosine similarity over the candidate vectors.

import { performance } from 'node:perf_hooks'

import { createDerivedVectorLocator } from './derived-vector-locator.mjs'

const EVALUATION_SCOPE = Object.freeze({
  palariId: 'scale-05-palari',
  userId: 'scale-05-user',
})

export const DEFAULT_LOCATOR_QUALITY_CONFIGS = Object.freeze([
  Object.freeze({ bands: 8, bitsPerBand: 8, label: '8x8 / 64 bits' }),
  Object.freeze({ bands: 8, bitsPerBand: 6, label: '8x6 / 48 bits' }),
  Object.freeze({ bands: 12, bitsPerBand: 5, label: '12x5 / 60 bits' }),
  Object.freeze({ bands: 16, bitsPerBand: 4, label: '16x4 / 64 bits' }),
])

// Diagnostic assumptions, not product SLOs or release-benchmark thresholds.
export const LOCATOR_QUALITY_REVIEW = Object.freeze({
  maxMeanCandidateFraction: 0.25,
  minExactBaselineTargetRecall: 0.9,
  minExactHitRetention: 0.95,
  minExactTop20CandidateRecall: 0.9,
  requireP95LatencyImprovement: true,
})

function positiveSafeInteger(value, label) {
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < 1) {
    throw new TypeError(`${label} must be a positive safe integer.`)
  }
  return number
}

function finiteUnitVector(value, dimensions, label) {
  if (!Array.isArray(value) && !ArrayBuffer.isView(value)) {
    throw new TypeError(`${label} must be a vector.`)
  }
  if (dimensions !== null && value.length !== dimensions) {
    throw new TypeError(`${label} must contain ${dimensions} dimensions.`)
  }
  const vector = Float32Array.from(value, Number)
  let normSquared = 0
  for (const entry of vector) {
    if (!Number.isFinite(entry)) {
      throw new TypeError(`${label} must contain finite numbers.`)
    }
    normSquared += entry * entry
  }
  if (!vector.length || !(normSquared > 0)) {
    throw new TypeError(`${label} must have a nonzero finite norm.`)
  }
  const scale = Math.sqrt(normSquared)
  for (let index = 0; index < vector.length; index += 1) {
    vector[index] /= scale
  }
  return vector
}

function dot(left, right) {
  let score = 0
  for (let index = 0; index < left.length; index += 1) {
    score += left[index] * right[index]
  }
  return score
}

function latencySummary(values) {
  const sorted = [...values].sort((left, right) => left - right)
  return Object.freeze({
    medianMs: rounded(sorted[Math.floor(sorted.length / 2)], 3),
    p95Ms: rounded(sorted[Math.ceil(sorted.length * 0.95) - 1], 3),
  })
}

function rounded(value, digits = 6) {
  return Number(Number(value).toFixed(digits))
}

function rankedIds({ ids, queryVector, vectors, topK }) {
  return ids.map((id, index) => ({
    id,
    score: dot(vectors[index], queryVector),
  })).sort((left, right) =>
    right.score - left.score || left.id.localeCompare(right.id))
    .slice(0, topK)
    .map(({ id }) => id)
}

function queryGroups(queries) {
  return ['all', ...new Set(queries.map(({ family }) => family))]
}

function summarizeExact(observations, groups) {
  return Object.fromEntries(groups.map((family) => {
    const selected = family === 'all'
      ? observations
      : observations.filter((item) => item.family === family)
    const targetHits = selected.filter(({ targetHit }) => targetHit).length
    return [family, Object.freeze({
      queries: selected.length,
      targetHits,
      targetRecall: rounded(targetHits / selected.length),
      ...latencySummary(selected.map(({ latencyMs }) => latencyMs)),
    })]
  }))
}

function summarizeLocator(observations, groups, tierSize) {
  return Object.fromEntries(groups.map((family) => {
    const selected = family === 'all'
      ? observations
      : observations.filter((item) => item.family === family)
    const candidateCounts = selected.map(({ candidateCount }) => candidateCount)
    const targetHits = selected.filter(({ targetHit }) => targetHit).length
    const exactBaselineHits = selected
      .filter(({ exactTargetHit }) => exactTargetHit).length
    const retainedExactHits = selected
      .filter(({ exactTargetHit, targetHit }) => exactTargetHit && targetHit).length
    const coveredExactIds = selected.reduce(
      (total, item) => total + item.coveredExactIds,
      0,
    )
    const exactIds = selected.reduce(
      (total, item) => total + item.exactIds,
      0,
    )
    const meanCandidates = candidateCounts.reduce(
      (total, value) => total + value,
      0,
    ) / selected.length
    const sortedCandidates = [...candidateCounts].sort((left, right) => left - right)
    return [family, Object.freeze({
      exactBaselineHits,
      exactHitRetention: exactBaselineHits > 0
        ? rounded(retainedExactHits / exactBaselineHits)
        : null,
      exactTop20CandidateRecall: rounded(coveredExactIds / exactIds),
      maxCandidates: Math.max(...candidateCounts),
      meanCandidateFraction: rounded(meanCandidates / tierSize),
      meanCandidates: rounded(meanCandidates, 1),
      p95Candidates: sortedCandidates[Math.ceil(selected.length * 0.95) - 1],
      queries: selected.length,
      retainedExactHits,
      targetHits,
      targetRecall: rounded(targetHits / selected.length),
      ...latencySummary(selected.map(({ latencyMs }) => latencyMs)),
    })]
  }))
}

function normalizedRecords(records) {
  if (!Array.isArray(records) || records.length < 1) {
    throw new TypeError('records must be a non-empty array.')
  }
  const ids = new Set()
  return records.map((record, index) => {
    const id = String(record?.id ?? '').trim()
    if (!id || ids.has(id)) {
      throw new TypeError(`records[${index}].id must be non-empty and unique.`)
    }
    ids.add(id)
    return { ...record, id }
  })
}

function normalizedQueries(queries) {
  if (!Array.isArray(queries) || queries.length < 1) {
    throw new TypeError('queries must be a non-empty array.')
  }
  return queries.map((query, index) => {
    const id = String(query?.id ?? '').trim()
    const family = String(query?.family ?? '').trim()
    const targetId = String(query?.targetId ?? '').trim()
    if (!id || !family || !targetId) {
      throw new TypeError(
        `queries[${index}] requires id, family, and targetId.`,
      )
    }
    return { ...query, family, id, targetId }
  })
}

function normalizedConfigs(configs) {
  if (!Array.isArray(configs) || configs.length < 1) {
    throw new TypeError('locatorConfigs must be a non-empty array.')
  }
  return configs.map((config, index) => ({
    bands: positiveSafeInteger(config?.bands, `locatorConfigs[${index}].bands`),
    bitsPerBand: positiveSafeInteger(
      config?.bitsPerBand,
      `locatorConfigs[${index}].bitsPerBand`,
    ),
    label: String(config?.label ?? '').trim() ||
      `${config?.bands}x${config?.bitsPerBand}`,
    projectionLanes: positiveSafeInteger(
      config?.projectionLanes ?? 4,
      `locatorConfigs[${index}].projectionLanes`,
    ),
  }))
}

export function evaluateLocatorQuality({
  locatorConfigs = DEFAULT_LOCATOR_QUALITY_CONFIGS,
  queries: rawQueries,
  queryVectors: rawQueryVectors,
  records: rawRecords,
  recordVectors: rawRecordVectors,
  review = LOCATOR_QUALITY_REVIEW,
  tiers = [2_000, 5_000],
  topK = 20,
} = {}) {
  const records = normalizedRecords(rawRecords)
  const queries = normalizedQueries(rawQueries)
  const limit = positiveSafeInteger(topK, 'topK')
  if (!Array.isArray(rawRecordVectors) ||
      rawRecordVectors.length !== records.length) {
    throw new TypeError('recordVectors must align one-to-one with records.')
  }
  if (!Array.isArray(rawQueryVectors) ||
      rawQueryVectors.length !== queries.length) {
    throw new TypeError('queryVectors must align one-to-one with queries.')
  }
  const dimensions = rawRecordVectors[0]?.length ?? 0
  positiveSafeInteger(dimensions, 'vector dimensions')
  const recordVectors = rawRecordVectors.map((vector, index) =>
    finiteUnitVector(vector, dimensions, `recordVectors[${index}]`))
  const queryVectors = rawQueryVectors.map((vector, index) =>
    finiteUnitVector(vector, dimensions, `queryVectors[${index}]`))
  const configs = normalizedConfigs(locatorConfigs)
  const tierSizes = [...new Set(tiers.map((value) =>
    positiveSafeInteger(value, 'tier')))].sort((left, right) => left - right)
  if (tierSizes.at(-1) > records.length) {
    throw new TypeError('tiers must not exceed the record count.')
  }
  const groups = queryGroups(queries)
  const results = []

  for (const tierSize of tierSizes) {
    const tierRecords = records.slice(0, tierSize)
    const tierVectors = recordVectors.slice(0, tierSize)
    const tierIds = tierRecords.map(({ id }) => id)
    const tierIdSet = new Set(tierIds)
    for (const query of queries) {
      if (!tierIdSet.has(query.targetId)) {
        throw new Error(`tier ${tierSize} does not contain target ${query.targetId}.`)
      }
    }

    // Warm the arithmetic/JIT once outside the measured queries.
    rankedIds({ ids: tierIds, queryVector: queryVectors[0], vectors: tierVectors, topK: limit })
    const exactObservations = queries.map((query, index) => {
      const started = performance.now()
      const ids = rankedIds({
        ids: tierIds,
        queryVector: queryVectors[index],
        vectors: tierVectors,
        topK: limit,
      })
      return Object.freeze({
        family: query.family,
        ids,
        latencyMs: performance.now() - started,
        targetHit: ids.includes(query.targetId),
      })
    })
    const exact = Object.freeze({
      quality: Object.freeze(summarizeExact(exactObservations, groups)),
      scoredPerQuery: tierSize,
    })

    const locators = configs.map((config) => {
      const locator = createDerivedVectorLocator(config)
      const buildStarted = performance.now()
      for (let index = 0; index < tierSize; index += 1) {
        locator.upsert(EVALUATION_SCOPE, {
          evidenceId: tierIds[index],
          vector: tierVectors[index],
        })
      }
      const buildMs = performance.now() - buildStarted
      const indexById = new Map(tierIds.map((id, index) => [id, index]))

      // Warm this locator's sketch and candidate scoring once.
      const warmIds = locator.locate(EVALUATION_SCOPE, queryVectors[0])
      rankedIds({
        ids: warmIds,
        queryVector: queryVectors[0],
        vectors: warmIds.map((id) => tierVectors[indexById.get(id)]),
        topK: limit,
      })
      const observations = queries.map((query, index) => {
        const started = performance.now()
        const candidateIds = locator.locate(EVALUATION_SCOPE, queryVectors[index])
        const ids = rankedIds({
          ids: candidateIds,
          queryVector: queryVectors[index],
          vectors: candidateIds.map((id) => tierVectors[indexById.get(id)]),
          topK: limit,
        })
        const latencyMs = performance.now() - started
        const candidateSet = new Set(candidateIds)
        const exactIds = exactObservations[index].ids
        return Object.freeze({
          candidateCount: candidateIds.length,
          coveredExactIds: exactIds.filter((id) => candidateSet.has(id)).length,
          exactIds: exactIds.length,
          exactTargetHit: exactObservations[index].targetHit,
          family: query.family,
          latencyMs,
          targetHit: ids.includes(query.targetId),
        })
      })
      const quality = Object.freeze(summarizeLocator(observations, groups, tierSize))
      const overall = quality.all
      const exactOverall = exact.quality.all
      const reviewResult = Object.freeze({
        candidateFraction: overall.meanCandidateFraction <=
          review.maxMeanCandidateFraction,
        exactBaseline: exactOverall.targetRecall >=
          review.minExactBaselineTargetRecall,
        exactHitRetention: overall.exactHitRetention !== null &&
          overall.exactHitRetention >= review.minExactHitRetention,
        exactTop20CandidateRecall: overall.exactTop20CandidateRecall >=
          review.minExactTop20CandidateRecall,
        p95Latency: !review.requireP95LatencyImprovement ||
          overall.p95Ms < exactOverall.p95Ms,
      })
      return Object.freeze({
        buildMs: rounded(buildMs, 1),
        config: Object.freeze(config),
        passesReviewThresholds: Object.values(reviewResult).every(Boolean),
        quality,
        review: reviewResult,
        stats: locator.stats(EVALUATION_SCOPE),
      })
    })

    results.push(Object.freeze({ exact, locators: Object.freeze(locators), tierSize }))
  }

  return Object.freeze({
    dimensions,
    mode: 'diagnostic-not-a-benchmark',
    review: Object.freeze({ ...review }),
    tiers: Object.freeze(results),
    topK: limit,
  })
}

// Diagnostic inference over paired queries. Facts, not query paraphrases, are
// the independent resampling units. These intervals do not certify a release.
import { createHash } from 'node:crypto'

export function partitionQueriesByFact(queries, {
  holdoutFraction = 0.2, seed = 'palari-fact-split/v1',
} = {}) {
  if (!Array.isArray(queries) || !queries.length) throw new TypeError('queries must be non-empty.')
  if (!Number.isFinite(holdoutFraction) || holdoutFraction <= 0 || holdoutFraction >= 1) {
    throw new TypeError('holdoutFraction must lie strictly between zero and one.')
  }
  if (typeof seed !== 'string' || !seed) throw new TypeError('split seed must be a non-empty string.')
  const ids = new Set()
  const groups = new Map()
  for (const [index, query] of queries.entries()) {
    if (typeof query?.id !== 'string' || !query.id.trim() || ids.has(query.id) ||
      typeof query.targetId !== 'string' || !query.targetId.trim()) {
      throw new TypeError('queries require unique IDs and non-empty target fact IDs.')
    }
    ids.add(query.id)
    const indices = groups.get(query.targetId) ?? []
    indices.push(index)
    groups.set(query.targetId, indices)
  }
  if (groups.size < 2) throw new TypeError('A split requires at least two distinct facts.')
  const facts = [...groups.keys()].map(id => ({ id,
    hash: createHash('sha256').update(JSON.stringify([seed, id])).digest('hex'),
  })).sort((a, b) => a.hash.localeCompare(b.hash) || a.id.localeCompare(b.id))
  const count = Math.max(1, Math.min(facts.length - 1, Math.ceil(facts.length * holdoutFraction)))
  const holdoutFacts = facts.slice(0, count).map(({ id }) => id)
  const developmentFacts = facts.slice(count).map(({ id }) => id)
  const indices = selected => selected.flatMap(id => groups.get(id)).sort((a, b) => a - b)
  return {
    seed, holdoutFraction,
    holdoutFacts, developmentFacts,
    holdout: indices(holdoutFacts), development: indices(developmentFacts),
  }
}

function metrics(groups) {
  let queries = 0, exact = 0, locator = 0, retained = 0
  for (const group of groups) {
    queries += group.queries
    exact += group.exact
    locator += group.locator
    retained += group.retained
  }
  return { exactRecall: exact / queries, locatorRecall: locator / queries,
    recallDifference: (locator - exact) / queries,
    exactHitRetention: exact ? retained / exact : null }
}

export function pairedFactRecall(observations, { resamples = 2000, seed = 20260906 } = {}) {
  if (!Array.isArray(observations) || !observations.length) {
    throw new TypeError('paired observations must be non-empty.')
  }
  if (!Number.isSafeInteger(resamples) || resamples < 100 || resamples > 10000) {
    throw new TypeError('resamples must be an integer from 100 to 10000.')
  }
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new TypeError('bootstrap seed must be an unsigned 32-bit integer.')
  }
  const byFact = new Map()
  for (const row of observations) {
    if (typeof row?.factId !== 'string' || !row.factId.trim()) {
      throw new TypeError('Each observation requires a factId.')
    }
    if (typeof row.exactTargetHit !== 'boolean' || typeof row.targetHit !== 'boolean') {
      throw new TypeError('Paired hit labels must be boolean.')
    }
    const group = byFact.get(row.factId) ?? { queries: 0, exact: 0, locator: 0, retained: 0 }
    group.queries++
    group.exact += Number(row.exactTargetHit)
    group.locator += Number(row.targetHit)
    group.retained += Number(row.exactTargetHit && row.targetHit)
    byFact.set(row.factId, group)
  }
  const groups = [...byFact.keys()].sort().map(id => byFact.get(id))
  const estimates = metrics(groups)
  const samples = Object.fromEntries(Object.keys(estimates).map(key => [key, []]))
  let state = seed
  if (groups.length >= 2) {
    for (let i = 0; i < resamples; i++) {
      const selected = Array.from({ length: groups.length }, () => {
        state = Math.imul(state, 1664525) + 1013904223 >>> 0
        return groups[Math.floor(state / 2 ** 32 * groups.length)]
      })
      const result = metrics(selected)
      for (const [key, value] of Object.entries(result)) if (value !== null) samples[key].push(value)
    }
  }
  return {
    method: 'paired-fact-cluster-percentile-bootstrap', confidence: 0.95,
    facts: groups.length, queries: observations.length, resamples, seed,
    assumptions: 'Independent representative facts; query variants within a fact stay paired.',
    limitation: 'Small or homogeneous fact samples can give degenerate intervals. These do not establish zero risk or population generalization.',
    ...Object.fromEntries(Object.entries(estimates).map(([key, estimate]) => {
      const sorted = samples[key].sort((a, b) => a - b)
      return [key, {
        estimate,
        interval95: groups.length < 2 || sorted.length === 0 ? null : [
          sorted[Math.max(0, Math.ceil(sorted.length * 0.025) - 1)],
          sorted[Math.ceil(sorted.length * 0.975) - 1],
        ],
        degenerate: sorted.length > 0 && sorted[0] === sorted.at(-1),
        validResamples: sorted.length,
        undefinedResamples: groups.length < 2 ? 0 : resamples - sorted.length,
        intervalStatus: groups.length < 2 ? 'insufficient-facts'
          : sorted.length === 0 ? 'undefined-denominator'
          : sorted.length < resamples ? 'conditional-on-positive-denominator' : 'diagnostic',
      }]
    })),
  }
}

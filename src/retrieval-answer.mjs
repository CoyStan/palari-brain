// Bounded retrieval-to-answer orchestration over Palari's active journal.
//
// The active digest is still the first context. When it is insufficient, the
// answer model may use:
//   - exact/ranked journal navigation;
//   - hybrid ranked + semantic search, fused with reciprocal-rank fusion;
//   - the admitted temporal graph.
//
// Every returned message is read back from the canonical journal. Search
// scores and graph edges may locate evidence; neither becomes evidence.
// Semantic lookup remains optional and never runs unless createPalariBrain()
// received an embedder. Graph lookup is read-only here: extraction remains an
// explicit indexGraph() operation, so answering cannot create a provider call.

import {
  memoryAnswerSystemInstruction,
  recallMemory,
} from './brain.mjs'
import {
  MEMORY_EXPLORATION_INSTRUCTIONS,
  MEMORY_EXPLORATION_TOOLS,
} from './memory-exploration.mjs'
import { deepFreeze } from './shared-util.mjs'

export const DEFAULT_RETRIEVAL_CALLS = 4
export const MEMORY_ANSWER_RECOMMENDED_MAX_OUTPUT_TOKENS = 512
export const MEMORY_HYBRID_RRF_K = 60

export const MEMORY_RETRIEVAL_FINALIZATION_INSTRUCTIONS = [
  'Memory retrieval is complete. Do not call another memory tool.',
  'Answer directly from the canonical evidence already returned.',
  'If that evidence does not support an answer, say that you do not have enough stored evidence to answer.',
  'Lack of stored evidence is not proof that an event did not happen.',
].join(' ')

const DEFAULT_HYBRID_LIMIT = 20
const MAX_HYBRID_LIMIT = 50
const DEFAULT_HYBRID_MAX_CHARS = 20_000
const MAX_HYBRID_MAX_CHARS = 100_000
const MAX_SEARCH_PHRASE_CHARS = 500
const MAX_RANKED_PHRASE_CHARS = 200

function boundedInteger(value, fallback, maximum, label) {
  if (value === undefined || value === null) return fallback
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new TypeError(`${label} must be a positive integer.`)
  }
  return Math.min(parsed, maximum)
}

function searchPhrase(value) {
  const phrase = String(value ?? '').trim()
  if (!phrase) throw new TypeError('memory_search requires a phrase.')
  if (phrase.length > MAX_SEARCH_PHRASE_CHARS) {
    throw new TypeError(
      `phrase must be at most ${MAX_SEARCH_PHRASE_CHARS} characters.`,
    )
  }
  return phrase
}

// The ranked explorer has a deliberately small query contract. Preserve both
// ends of a longer natural-language question: subjects tend to occur near the
// beginning and the requested distinction near the end.
function rankedPhrase(phrase) {
  if (phrase.length <= MAX_RANKED_PHRASE_CHARS) return phrase
  const head = phrase.slice(0, 100)
  const tail = phrase.slice(-(MAX_RANKED_PHRASE_CHARS - head.length - 1))
  return `${head} ${tail}`
}

function withinBounds(row, after, before) {
  const observedAt = String(row?.observedAt ?? '')
  return (!after || observedAt >= after) &&
    (!before || observedAt <= before)
}

export function reciprocalRankFuse(rankings, {
  k = MEMORY_HYBRID_RRF_K,
  limit = DEFAULT_HYBRID_LIMIT,
} = {}) {
  const fused = new Map()
  for (const ranking of rankings ?? []) {
    const surface = String(ranking?.surface ?? '').trim()
    if (!surface || !Array.isArray(ranking?.rows)) continue
    for (const [index, row] of ranking.rows.entries()) {
      const evidenceId = String(row?.evidenceId ?? '').trim()
      if (!evidenceId) continue
      const entry = fused.get(evidenceId) ?? {
        evidenceId,
        rrfScore: 0,
        surfaceRanks: {},
        surfaces: [],
      }
      if (!entry.surfaces.includes(surface)) entry.surfaces.push(surface)
      entry.surfaceRanks[surface] = index + 1
      entry.rrfScore += 1 / (Number(k) + index + 1)
      fused.set(evidenceId, entry)
    }
  }
  return [...fused.values()]
    .sort((left, right) =>
      right.rrfScore - left.rrfScore ||
      left.evidenceId.localeCompare(right.evidenceId))
    .slice(0, boundedInteger(
      limit,
      DEFAULT_HYBRID_LIMIT,
      MAX_HYBRID_LIMIT,
      'limit',
    ))
}

const HYBRID_TOOL = deepFreeze({
  description:
    'Search complete stored messages by meaning and words. The host fuses stemmed ranked search with semantic search when an embedder is configured, then reads every hit back from the canonical journal. Returns exact recorded text with speaker and time; scores only locate evidence.',
  name: 'memory_search',
  parameters: {
    properties: {
      after: {
        description:
          'Only messages observed at or after this ISO-8601 UTC time.',
        type: 'string',
      },
      before: {
        description:
          'Only messages observed at or before this ISO-8601 UTC time.',
        type: 'string',
      },
      limit: {
        description: 'Maximum canonical messages to return.',
        maximum: MAX_HYBRID_LIMIT,
        minimum: 1,
        type: 'integer',
      },
      maxChars: {
        description:
          'Maximum approximate returned-message characters. A single complete message is never cut.',
        maximum: MAX_HYBRID_MAX_CHARS,
        minimum: 1,
        type: 'integer',
      },
      phrase: {
        description:
          'Natural-language question or concept to find in stored dialogue.',
        maxLength: MAX_SEARCH_PHRASE_CHARS,
        minLength: 1,
        type: 'string',
      },
    },
    required: ['phrase'],
    type: 'object',
  },
})

const GRAPH_TOOL = deepFreeze({
  description:
    'Traverse already admitted temporal graph edges from an entity for relational or multi-hop questions. Every edge contains an exact quote and canonical evidence ID. This lookup never extracts or writes graph data.',
  name: 'memory_graph',
  parameters: {
    properties: {
      entity: {
        description: 'Entity name from which to begin traversal.',
        minLength: 1,
        type: 'string',
      },
      hops: {
        description: 'Traversal depth.',
        maximum: 3,
        minimum: 1,
        type: 'integer',
      },
      limit: {
        description: 'Maximum admitted edges to return.',
        maximum: 200,
        minimum: 1,
        type: 'integer',
      },
    },
    required: ['entity'],
    type: 'object',
  },
})

export const MEMORY_RETRIEVAL_TOOLS = deepFreeze([
  ...MEMORY_EXPLORATION_TOOLS,
  HYBRID_TOOL,
  GRAPH_TOOL,
])

export const MEMORY_RETRIEVAL_INSTRUCTIONS = [
  MEMORY_EXPLORATION_INSTRUCTIONS,
  'Use memory_search when the digest does not answer a paraphrased question. It returns complete canonical messages, fusing ranked and semantic location when semantic retrieval is configured.',
  'Use memory_graph for relationship, correction-history, and multi-hop questions. Its edges are finding aids backed by the exact quote and evidence ID on each edge.',
  'After each memory-tool result, inspect the returned canonical messages or admitted edges themselves. If one directly addresses the question, use it or state the exact conflict or limitation that makes it unusable; do not claim no relevant memory merely because the initial briefing or digest was empty.',
  'A non-empty result does not establish relevance. If the returned records do not address the question, do not force an answer from them.',
  'Prior Palari speech may be reported as advice, a recommendation, or a commitment previously made by Palari. It must never be recast as something the user said, did, owned, or preferred.',
  'For elapsed-time answers, use the host-derived questionRelativeTime metadata on returned rows. It is authoritative arithmetic from observedAt and the question date; do not invent dates from text or approximate a calendar month as 30 days.',
  'Do not treat an empty search as proof that an event never happened. For a time-bounded absence or count, search the relevant concept inside explicit after/before bounds.',
  'Honor the host-provided memory retrieval-call budget. When it is spent, stop searching and make one final answer from consulted evidence or state that stored evidence is insufficient.',
  'Answer directly and concisely from the evidence you actually consulted. Prefer one sentence when one sentence fully answers the question.',
].join('\n')

function capabilitiesOf(brain) {
  const provided = brain?.retrievalCapabilities
  return Object.freeze({
    graphQuery: typeof brain?.exploreGraph === 'function',
    reranking: provided?.reranking === true &&
      typeof brain?.rerankEvidence === 'function',
    semantic: provided?.semantic === true,
  })
}

function normalizedScope({ palariId, userId } = {}) {
  return { palariId, userId }
}

const DAY_MS = 86_400_000

function validInstant(value) {
  if (value === undefined || value === null || value === '') return null
  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function compareCalendarPosition(later, earlier) {
  const fields = [
    later.getUTCDate() - earlier.getUTCDate(),
    later.getUTCHours() - earlier.getUTCHours(),
    later.getUTCMinutes() - earlier.getUTCMinutes(),
    later.getUTCSeconds() - earlier.getUTCSeconds(),
    later.getUTCMilliseconds() - earlier.getUTCMilliseconds(),
  ]
  return fields.find((value) => value !== 0) ?? 0
}

function wholeCalendarMonthsBetween(earlier, later) {
  let months = (later.getUTCFullYear() - earlier.getUTCFullYear()) * 12 +
    later.getUTCMonth() - earlier.getUTCMonth()
  if (compareCalendarPosition(later, earlier) < 0) months -= 1
  return months
}

export function deriveQuestionRelativeTime(observedAt, questionDate) {
  const evidence = validInstant(observedAt)
  const reference = validInstant(questionDate)
  if (!evidence || !reference) return null

  const signedMilliseconds = reference.getTime() - evidence.getTime()
  const sign = Math.sign(signedMilliseconds)
  const earlier = sign < 0 ? reference : evidence
  const later = sign < 0 ? evidence : reference
  const wholeDays = Math.trunc(signedMilliseconds / DAY_MS)
  const wholeCalendarMonths = wholeCalendarMonthsBetween(earlier, later)
  return Object.freeze({
    evidenceAt: evidence.toISOString(),
    referenceAt: reference.toISOString(),
    relation: sign < 0 ? 'future' : sign > 0 ? 'past' : 'same',
    wholeCalendarMonths: wholeCalendarMonths === 0
      ? 0
      : sign < 0 ? -wholeCalendarMonths : wholeCalendarMonths,
    wholeDays: wholeDays === 0 ? 0 : wholeDays,
  })
}

function questionReferenceTime(questionDate) {
  return validInstant(questionDate)
}

function decorateAnswerRow(row, referenceTime) {
  const copied = { ...row }
  const relative = referenceTime
    ? deriveQuestionRelativeTime(row?.observedAt, referenceTime)
    : null
  if (relative) copied.questionRelativeTime = relative
  return copied
}

function decorateAnswerRows(rows, referenceTime) {
  return (rows ?? []).map((row) => decorateAnswerRow(row, referenceTime))
}

async function hybridSearch(
  brain,
  scope,
  capabilities,
  input = {},
  referenceTime = null,
) {
  const phrase = searchPhrase(input.phrase)
  const limit = boundedInteger(
    input.limit,
    DEFAULT_HYBRID_LIMIT,
    MAX_HYBRID_LIMIT,
    'limit',
  )
  const maxChars = boundedInteger(
    input.maxChars,
    DEFAULT_HYBRID_MAX_CHARS,
    MAX_HYBRID_MAX_CHARS,
    'maxChars',
  )
  const after = input.after === undefined || input.after === null
    ? ''
    : String(input.after)
  const before = input.before === undefined || input.before === null
    ? ''
    : String(input.before)
  const candidateLimit = Math.min(
    Math.max(DEFAULT_HYBRID_LIMIT, limit * 2),
    200,
  )

  const ranked = brain.exploreFind(scope, {
    after: after || undefined,
    before: before || undefined,
    limit: candidateLimit,
    maxChars: MAX_HYBRID_MAX_CHARS,
    phrase: rankedPhrase(phrase),
    ranked: true,
  })
  const rankings = [{
    rows: ranked.matches,
    surface: 'ranked',
  }]
  let semantic = []
  if (capabilities.semantic) {
    semantic = (await brain.exploreSemantic(scope, {
      limit: candidateLimit,
      phrase,
    })).filter((row) => withinBounds(row, after, before))
    rankings.push({ rows: semantic, surface: 'semantic' })
  }

  const fused = reciprocalRankFuse(rankings, {
    limit: capabilities.reranking
      ? Math.min(candidateLimit, MAX_HYBRID_LIMIT)
      : limit,
  })
  const candidates = []
  for (const entry of fused) {
    const read = brain.exploreRead(scope, {
      evidenceIds: [entry.evidenceId],
      limit: 1,
      maxChars,
    })
    const message = read.messages[0]
    if (!message) continue
    const candidate = decorateAnswerRow(message, referenceTime)
    Object.assign(candidate, {
      rrfScore: entry.rrfScore,
      surfaceRanks: entry.surfaceRanks,
      surfaces: entry.surfaces,
    })
    candidates.push(candidate)
  }

  let ordered = candidates
  if (capabilities.reranking && candidates.length > 0) {
    const texts = Object.freeze(candidates.map((candidate) => candidate.text))
    const scores = await brain.rerankEvidence(phrase, texts)
    if (!Array.isArray(scores) || scores.length !== candidates.length) {
      throw new TypeError(
        'reranker must return one numeric score per canonical candidate.',
      )
    }
    const scored = candidates.map((candidate, index) => {
      const score = scores[index]
      if (typeof score !== 'number' || !Number.isFinite(score)) {
        throw new TypeError(
          'reranker must return one finite numeric score per canonical candidate.',
        )
      }
      return { ...candidate, rerankScore: score }
    })
    ordered = scored.sort((left, right) =>
      right.rerankScore - left.rerankScore ||
      right.rrfScore - left.rrfScore ||
      left.evidenceId.localeCompare(right.evidenceId))
  }

  const matches = []
  let chars = 0
  for (const candidate of ordered.slice(0, limit)) {
    const ranked = { ...candidate, rank: matches.length + 1 }
    const cost = JSON.stringify(ranked).length
    if (matches.length && chars + cost > maxChars) break
    matches.push(ranked)
    chars += cost
  }

  return {
    chars,
    matches,
    operation: 'memory_search',
    phrase,
    rankedCandidates: ranked.matches.length,
    rerankCandidates: capabilities.reranking ? candidates.length : 0,
    reranked: capabilities.reranking,
    semanticCandidates: semantic.length,
    semanticUsed: capabilities.semantic,
    truncated: matches.length < ordered.length,
  }
}

// New API rather than silently changing the three-tool contract consumed by
// sealed historical evaluators. Product integrations opt into this path and
// can map MEMORY_RETRIEVAL_TOOLS to their provider's tool schema.
export async function answerWithRetrieval(brain, {
  maxChars = 100_000,
  maxRetrievalCalls = DEFAULT_RETRIEVAL_CALLS,
  palariId,
  provider,
  question,
  questionDate,
  userId,
} = {}) {
  if (typeof provider !== 'function') {
    throw new TypeError('answerWithRetrieval requires a provider function.')
  }
  const budget = Number(maxRetrievalCalls)
  if (!Number.isSafeInteger(budget) || budget < 0 ||
    budget > DEFAULT_RETRIEVAL_CALLS) {
    throw new TypeError(
      `maxRetrievalCalls must be an integer from 0 to ` +
        `${DEFAULT_RETRIEVAL_CALLS}.`,
    )
  }

  const scope = normalizedScope({ palariId, userId })
  const capabilities = capabilitiesOf(brain)
  const consulted = []
  const transcript = []
  const referenceTime = questionReferenceTime(questionDate)

  const tools = {
    memory_find(input) {
      const found = brain.exploreFind(scope, input)
      consulted.push(...found.matches.map((row) => row.evidenceId))
      return {
        ...found,
        matches: decorateAnswerRows(found.matches, referenceTime),
      }
    },
    memory_graph(input) {
      const result = brain.exploreGraph(scope, {
        ...input,
        ...(referenceTime ? { now: referenceTime } : {}),
      })
      consulted.push(...result.edges.map((edge) => edge.evidenceId))
      return {
        ...result,
        edges: decorateAnswerRows(result.edges, referenceTime),
      }
    },
    memory_read(input) {
      const result = brain.exploreRead(scope, input)
      consulted.push(...result.messages.map((row) => row.evidenceId))
      return {
        ...result,
        messages: decorateAnswerRows(result.messages, referenceTime),
      }
    },
    async memory_search(input) {
      const result = await hybridSearch(
        brain,
        scope,
        capabilities,
        input,
        referenceTime,
      )
      consulted.push(...result.matches.map((row) => row.evidenceId))
      return result
    },
    memory_timeline(input) {
      return brain.exploreTimeline(scope, input)
    },
  }

  const briefing = recallMemory(brain, scope, { maxChars })
  let calls = 0
  let exhausted = false
  const retrieve = async (request) => {
    const name = String(request?.tool ?? '')
    if (!Object.hasOwn(tools, name)) {
      throw new TypeError(`Unknown memory tool: ${name}`)
    }
    if (calls >= budget) {
      exhausted = true
      return {
        exhausted: true,
        reason: 'retrieval_budget_exhausted',
      }
    }
    calls += 1
    const input = request?.input ?? {}
    const result = await tools[name](input)
    transcript.push({ input, result, tool: name })
    return result
  }

  const response = await provider({
    answerInstructions: MEMORY_RETRIEVAL_INSTRUCTIONS,
    briefing,
    memoryText: briefing.text,
    maxRetrievalCalls: budget,
    question,
    questionDate,
    questionText: [
      questionDate ? `Question date: ${questionDate}` : '',
      `Question: ${String(question)}`,
    ].filter(Boolean).join('\n'),
    recommendedMaxOutputTokens:
      MEMORY_ANSWER_RECOMMENDED_MAX_OUTPUT_TOKENS,
    retrievalCapabilities: capabilities,
    retrievalFinalizationInstructions:
      MEMORY_RETRIEVAL_FINALIZATION_INSTRUCTIONS,
    retrievalTools: MEMORY_RETRIEVAL_TOOLS,
    retrieve,
    systemInstruction: memoryAnswerSystemInstruction,
  })

  return {
    abstained: typeof response?.abstained === 'boolean'
      ? response.abstained
      : null,
    answer: String(response?.text ?? response ?? ''),
    briefingMode: briefing.briefingMode,
    briefingStatus: briefing.status,
    consultedEvidenceIds: [...new Set(consulted)],
    digestRevision: briefing.digestRevision,
    providerCalled: true,
    reductionBlocked: briefing.reductionBlocked,
    retrievalCalls: calls,
    retrievalCapabilities: capabilities,
    retrievalExhausted: exhausted,
    retrievalTranscript: transcript,
  }
}

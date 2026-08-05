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
export const DEFAULT_RETRIEVAL_CALLS = 4
export const MEMORY_ANSWER_RECOMMENDED_MAX_OUTPUT_TOKENS = 512
export const MEMORY_HYBRID_RRF_K = 60
export const MEMORY_ANSWER_MAX_BASES = 20
export const MEMORY_ANSWER_MAX_QUOTE_CHARS = 2_000
export const MEMORY_ANSWER_MAX_TEXT_CHARS = 20_000
export const MEMORY_ANSWER_MAX_CONSEQUENCE_CHARS = 2_000
export const MEMORY_ANSWER_MAX_NOT_USED_REASON_CHARS = 2_000
export const MEMORY_ANSWER_MAX_TEMPORARY_INFERENCES = 10
export const MEMORY_ANSWER_MAX_INFERENCE_CHARS = 2_000
export const MEMORY_RETRIEVAL_PLAN_TOOL_NAME = 'memory_plan'
export const MEMORY_RETRIEVAL_PLAN_RELATIONS = Object.freeze([
  'after',
  'around',
  'before',
  'current',
  'during',
  'unspecified',
])

const MAX_RETRIEVAL_PLAN_ANCHOR_CHARS = 500
const MAX_RETRIEVAL_PLAN_CATEGORY_CHARS = 200

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

// Capture the small set of intrinsics used by the answer-commit boundary
// before provider code can run in this realm. Provider adapters are local
// code, but their model-originated payloads must not gain authority by
// temporarily poisoning mutable built-in prototypes.
const arrayIsArray = Array.isArray
const arrayPrototype = Array.prototype
const arrayPush = Function.call.bind(Array.prototype.push)
const dateConstructor = Date
const dateGetTime = Function.call.bind(Date.prototype.getTime)
const dateToISOString = Function.call.bind(Date.prototype.toISOString)
const mapGet = Function.call.bind(Map.prototype.get)
const mapSet = Function.call.bind(Map.prototype.set)
const numberIsNaN = Number.isNaN
const objectDefineProperty = Object.defineProperty
const objectFreeze = Object.freeze
const objectGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor
const objectGetPrototypeOf = Object.getPrototypeOf
const objectHasOwn = Object.hasOwn
const objectIsFrozen = Object.isFrozen
const objectKeys = Object.keys
const objectValues = Object.values
const promiseConstructor = Promise
const promiseReject = Promise.reject.bind(Promise)
const promiseThen = Function.call.bind(Promise.prototype.then)
const reflectOwnKeys = Reflect.ownKeys
const setAdd = Function.call.bind(Set.prototype.add)
const setHas = Function.call.bind(Set.prototype.has)
const setConstructor = Set
const stringFrom = String
const stringIncludes = Function.call.bind(String.prototype.includes)
const stringTrim = Function.call.bind(String.prototype.trim)
const structuredCloneValue = globalThis.structuredClone
const weakSetAdd = Function.call.bind(WeakSet.prototype.add)
const weakSetHas = Function.call.bind(WeakSet.prototype.has)
const promiseSpeciesCarrier = objectFreeze(objectDefineProperty(
  {},
  Symbol.species,
  { value: promiseConstructor },
))

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || objectIsFrozen(value)) {
    return value
  }
  const children = objectValues(value)
  for (let index = 0; index < children.length; index += 1) {
    deepFreeze(children[index])
  }
  return objectFreeze(value)
}

function plainObject(value) {
  if (!value || typeof value !== 'object' || arrayIsArray(value)) {
    return false
  }
  const prototype = objectGetPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function hasExactKeys(value, expected) {
  if (!plainObject(value)) return false
  const actual = objectKeys(value)
  if (actual.length !== expected.length) return false
  for (let index = 0; index < expected.length; index += 1) {
    if (!objectHasOwn(value, expected[index])) return false
  }
  return true
}

function answerCommitmentError(message) {
  const error = new TypeError(message)
  error.code = 'MEMORY_ANSWER_COMMITMENT_INVALID'
  return error
}

function snapshotCommitment(value) {
  try {
    return structuredCloneValue(value)
  } catch {
    throw answerCommitmentError(
      'Answer commitment must contain only cloneable structured data.',
    )
  }
}

function exactDataProperties(value, expected, label) {
  if (!plainObject(value)) {
    throw answerCommitmentError(`${label} must be a plain data object.`)
  }
  const keys = reflectOwnKeys(value)
  if (keys.length !== expected.length) {
    throw answerCommitmentError(`${label} has unsupported or missing fields.`)
  }
  for (let index = 0; index < expected.length; index += 1) {
    const key = expected[index]
    const descriptor = objectGetOwnPropertyDescriptor(value, key)
    if (!descriptor || !objectHasOwn(descriptor, 'value') ||
      descriptor.enumerable !== true) {
      throw answerCommitmentError(`${label}.${key} must be a data property.`)
    }
  }
}

function assertCommitmentDataShape(proposal) {
  const modern = plainObject(proposal) &&
    objectHasOwn(proposal, 'temporaryInferences')
  exactDataProperties(
    proposal,
    modern
      ? ['abstained', 'bases', 'temporaryInferences', 'text']
      : ['abstained', 'bases', 'text'],
    'Answer commitment',
  )
  const bases = proposal.bases
  if (!arrayIsArray(bases) || objectGetPrototypeOf(bases) !== arrayPrototype) {
    throw answerCommitmentError('Answer commitment bases must be an array.')
  }
  const keys = reflectOwnKeys(bases)
  if (keys.length !== bases.length + 1 || !objectHasOwn(bases, 'length')) {
    throw answerCommitmentError(
      'Answer commitment bases must contain only dense indexed items.',
    )
  }
  for (let index = 0; index < bases.length; index += 1) {
    const descriptor = objectGetOwnPropertyDescriptor(bases, stringFrom(index))
    if (!descriptor || !objectHasOwn(descriptor, 'value') ||
      descriptor.enumerable !== true) {
      throw answerCommitmentError(
        'Answer commitment bases must contain only dense indexed items.',
      )
    }
    const basis = descriptor.value
    const declared = plainObject(basis) &&
      (objectHasOwn(basis, 'consequence_for_answer') ||
        objectHasOwn(basis, 'not_used_reason'))
    exactDataProperties(basis, declared
      ? [
          'evidenceId',
          'quote',
          'consequence_for_answer',
          'not_used_reason',
        ]
      : ['evidenceId', 'quote'], `Answer commitment basis ${index}`)
  }
  if (!modern) return
  const inferences = proposal.temporaryInferences
  if (!arrayIsArray(inferences) ||
    objectGetPrototypeOf(inferences) !== arrayPrototype) {
    throw answerCommitmentError(
      'Answer commitment temporaryInferences must be an array.',
    )
  }
  const inferenceKeys = reflectOwnKeys(inferences)
  if (inferenceKeys.length !== inferences.length + 1 ||
    !objectHasOwn(inferences, 'length')) {
    throw answerCommitmentError(
      'Answer commitment temporaryInferences must contain only dense indexed items.',
    )
  }
  for (let index = 0; index < inferences.length; index += 1) {
    const descriptor = objectGetOwnPropertyDescriptor(
      inferences,
      stringFrom(index),
    )
    if (!descriptor || !objectHasOwn(descriptor, 'value') ||
      descriptor.enumerable !== true) {
      throw answerCommitmentError(
        'Answer commitment temporaryInferences must contain only dense indexed items.',
      )
    }
    const inference = descriptor.value
    exactDataProperties(inference, [
      'statement',
      'provenanceEvidenceIds',
      'revisable',
      'consequence_for_answer',
    ], `Answer commitment temporary inference ${index}`)
    const ids = inference.provenanceEvidenceIds
    if (!arrayIsArray(ids) || objectGetPrototypeOf(ids) !== arrayPrototype) {
      throw answerCommitmentError(
        `Answer commitment temporary inference ${index} provenanceEvidenceIds must be an array.`,
      )
    }
    const idKeys = reflectOwnKeys(ids)
    if (idKeys.length !== ids.length + 1 || !objectHasOwn(ids, 'length')) {
      throw answerCommitmentError(
        `Answer commitment temporary inference ${index} provenanceEvidenceIds must contain only dense indexed items.`,
      )
    }
    for (let idIndex = 0; idIndex < ids.length; idIndex += 1) {
      const idDescriptor = objectGetOwnPropertyDescriptor(
        ids,
        stringFrom(idIndex),
      )
      if (!idDescriptor || !objectHasOwn(idDescriptor, 'value') ||
        idDescriptor.enumerable !== true) {
        throw answerCommitmentError(
          `Answer commitment temporary inference ${index} provenanceEvidenceIds must contain only dense indexed items.`,
        )
      }
    }
  }
}

function boundedCommitmentText(value, label, maximum, { trim = false } = {}) {
  if (typeof value !== 'string' || !stringTrim(value) ||
    stringIncludes(value, '\u0000') ||
    value.length > maximum) {
    throw answerCommitmentError(
      `${label} must be a non-empty string of at most ${maximum} characters.`,
    )
  }
  return trim ? stringTrim(value) : value
}

function boundedOptionalCommitmentText(value, label, maximum) {
  if (typeof value !== 'string' || stringIncludes(value, '\u0000') ||
    value.length > maximum) {
    throw answerCommitmentError(
      `${label} must be a string of at most ${maximum} characters.`,
    )
  }
  return stringTrim(value)
}

function retrievalPlanError(message) {
  const error = new TypeError(message)
  error.code = 'MEMORY_RETRIEVAL_PLAN_INVALID'
  return error
}

function exactRetrievalPlanProperties(value, expected, label) {
  if (!plainObject(value)) {
    throw retrievalPlanError(`${label} must be a plain data object.`)
  }
  const keys = reflectOwnKeys(value)
  if (keys.length !== expected.length) {
    throw retrievalPlanError(`${label} has unsupported or missing fields.`)
  }
  for (let index = 0; index < expected.length; index += 1) {
    const key = expected[index]
    const descriptor = objectGetOwnPropertyDescriptor(value, key)
    if (!descriptor || !objectHasOwn(descriptor, 'value') ||
      descriptor.enumerable !== true) {
      throw retrievalPlanError(`${label}.${key} must be a data property.`)
    }
  }
}

function retrievalPlanText(value, label, maximum) {
  if (typeof value !== 'string') {
    throw retrievalPlanError(`${label} must be a string.`)
  }
  const text = stringTrim(value)
  if (!text || stringIncludes(text, '\u0000') || text.length > maximum) {
    throw retrievalPlanError(
      `${label} must be a non-empty string of at most ${maximum} characters.`,
    )
  }
  return text
}

function retrievalPlanInstant(value, label) {
  if (value === null) return null
  if (typeof value !== 'string' || !stringTrim(value)) {
    throw retrievalPlanError(`${label} must be an ISO-8601 string or null.`)
  }
  const parsed = new dateConstructor(value)
  if (numberIsNaN(dateGetTime(parsed))) {
    throw retrievalPlanError(`${label} must be an ISO-8601 string or null.`)
  }
  return dateToISOString(parsed)
}

export function normalizeRetrievalPlan(value) {
  exactRetrievalPlanProperties(
    value,
    ['anchor_event', 'relation', 'category', 'time_range'],
    'Retrieval plan',
  )
  const timeRangeDescriptor = objectGetOwnPropertyDescriptor(value, 'time_range')
  exactRetrievalPlanProperties(
    timeRangeDescriptor.value,
    ['after', 'before'],
    'Retrieval plan time_range',
  )
  let snapshot
  try {
    snapshot = structuredCloneValue(value)
  } catch {
    throw retrievalPlanError('Retrieval plan must contain only cloneable data.')
  }
  exactRetrievalPlanProperties(
    snapshot,
    ['anchor_event', 'relation', 'category', 'time_range'],
    'Retrieval plan',
  )
  exactRetrievalPlanProperties(
    snapshot.time_range,
    ['after', 'before'],
    'Retrieval plan time_range',
  )
  const anchor_event = retrievalPlanText(
    snapshot.anchor_event,
    'Retrieval plan anchor_event',
    MAX_RETRIEVAL_PLAN_ANCHOR_CHARS,
  )
  const category = retrievalPlanText(
    snapshot.category,
    'Retrieval plan category',
    MAX_RETRIEVAL_PLAN_CATEGORY_CHARS,
  )
  const relation = stringFrom(snapshot.relation ?? '')
  let supported = false
  for (let index = 0; index < MEMORY_RETRIEVAL_PLAN_RELATIONS.length; index += 1) {
    if (MEMORY_RETRIEVAL_PLAN_RELATIONS[index] === relation) {
      supported = true
      break
    }
  }
  if (!supported) throw retrievalPlanError('Retrieval plan relation is unsupported.')
  const after = retrievalPlanInstant(
    snapshot.time_range.after,
    'Retrieval plan time_range.after',
  )
  const before = retrievalPlanInstant(
    snapshot.time_range.before,
    'Retrieval plan time_range.before',
  )
  if (after && before && after > before) {
    throw retrievalPlanError(
      'Retrieval plan time_range.after must not exceed before.',
    )
  }
  return deepFreeze({
    anchor_event,
    relation,
    category,
    time_range: { after, before },
  })
}

export const MEMORY_RETRIEVAL_PLAN_TOOL = deepFreeze({
  description: [
    'Register one temporary retrieval plan before navigating a temporal or relational memory question.',
    'Identify the anchor event, requested relation, evidence category, and explicit time range when known.',
    'The plan is not evidence, is never stored, and does not consume the memory retrieval-call budget.',
    'After planning, locate the anchor if necessary, use memory_timeline to orient, then memory_read complete canonical source messages.',
  ].join(' '),
  name: MEMORY_RETRIEVAL_PLAN_TOOL_NAME,
  parameters: {
    additionalProperties: false,
    properties: {
      anchor_event: {
        description: 'Event, entity, or state that anchors the requested relation.',
        maxLength: MAX_RETRIEVAL_PLAN_ANCHOR_CHARS,
        minLength: 1,
        type: 'string',
      },
      relation: {
        enum: [...MEMORY_RETRIEVAL_PLAN_RELATIONS],
        type: 'string',
      },
      category: {
        description: 'General kind of evidence needed to answer.',
        maxLength: MAX_RETRIEVAL_PLAN_CATEGORY_CHARS,
        minLength: 1,
        type: 'string',
      },
      time_range: {
        additionalProperties: false,
        properties: {
          after: { type: ['string', 'null'] },
          before: { type: ['string', 'null'] },
        },
        required: ['after', 'before'],
        type: 'object',
      },
    },
    required: ['anchor_event', 'relation', 'category', 'time_range'],
    type: 'object',
  },
})

export const MEMORY_RETRIEVAL_PLAN_INSTRUCTIONS = [
  'For a temporal or relational question, first register one memory_plan with the anchor event, relation, evidence category, and known time range.',
  'A plan is navigation metadata, not evidence. Do not cite it or treat it as a remembered fact.',
  'After planning, locate the anchor when needed, inspect memory_timeline, then use memory_read to recover complete canonical source messages from the relevant sessions.',
  'Prefer original user statements when the question asks what the user owns, uses, did, or prefers. Old Palari responses prove only prior Palari advice.',
].join(' ')

function evidenceTexts(result) {
  const rows = []
  const rowKeys = ['matches', 'messages', 'edges']
  for (let keyIndex = 0; keyIndex < rowKeys.length; keyIndex += 1) {
    const key = rowKeys[keyIndex]
    const values = result?.[key]
    if (!arrayIsArray(values)) continue
    for (let index = 0; index < values.length; index += 1) {
      arrayPush(rows, values[index])
    }
  }
  const evidence = []
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    const evidenceId = stringTrim(stringFrom(row?.evidenceId ?? ''))
    const text = typeof row?.text === 'string'
      ? row.text
      : typeof row?.snippet === 'string'
        ? row.snippet
        : typeof row?.quote === 'string'
          ? row.quote
          : ''
    if (evidenceId && text) arrayPush(evidence, { evidenceId, text })
  }
  return evidence
}

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
  MEMORY_RETRIEVAL_PLAN_TOOL,
  HYBRID_TOOL,
  GRAPH_TOOL,
])

export const MEMORY_RETRIEVAL_INSTRUCTIONS = [
  MEMORY_EXPLORATION_INSTRUCTIONS,
  MEMORY_RETRIEVAL_PLAN_INSTRUCTIONS,
  'Use memory_search when the digest does not answer a paraphrased question. It returns complete canonical messages, fusing ranked and semantic location when semantic retrieval is configured.',
  'Use memory_graph for relationship, correction-history, and multi-hop questions. Its edges are finding aids backed by the exact quote and evidence ID on each edge.',
  'After each memory-tool result, inspect the returned canonical messages or admitted edges themselves. If one directly addresses the question, use it or state the exact conflict or limitation that makes it unusable; do not claim no relevant memory merely because the initial briefing or digest was empty.',
  'A non-empty result does not establish relevance. If the returned records do not address the question, do not force an answer from them.',
  'Select only memories you actually assessed for the answer. For each selected memory, state either its concrete consequence_for_answer or a specific not_used_reason; never both. Retrieved rows that were not selected need no commitment.',
  'A consequence_for_answer is a declaration to audit, not proof of material use. Cross-context transfer must be a temporary provenance-linked inference marked revisable, never a canonical user fact.',
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
  const decorated = []
  const source = rows ?? []
  for (let index = 0; index < source.length; index += 1) {
    arrayPush(decorated, decorateAnswerRow(source[index], referenceTime))
  }
  return decorated
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
  // Capability declarations are part of the call contract. Snapshot before
  // invoking provider code so a writable custom-provider property cannot be
  // weakened after canonical evidence has been returned.
  const requiresEvidenceCommitment =
    provider.requiresEvidenceCommitment === true
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
  const committedResponses = new WeakSet()
  const evidenceRegistry = new Map()
  let evidenceCount = 0
  const transcript = []
  const referenceTime = questionReferenceTime(questionDate)

  const registerEvidence = (result) => {
    for (const { evidenceId, text } of evidenceTexts(result)) {
      const current = mapGet(evidenceRegistry, evidenceId)
      const texts = current ?? []
      if (!current) evidenceCount += 1
      arrayPush(texts, text)
      mapSet(evidenceRegistry, evidenceId, texts)
    }
    return deepFreeze(result)
  }

  const commitAnswer = (proposal) => {
    // Provider objects are outside the host trust boundary. Read them once
    // into a private structured snapshot, then use only host-owned iteration;
    // never invoke provider-overridable Array methods during validation.
    assertCommitmentDataShape(proposal)
    const candidate = snapshotCommitment(proposal)
    const modern = hasExactKeys(candidate, [
      'abstained',
      'bases',
      'temporaryInferences',
      'text',
    ])
    if (!modern && !hasExactKeys(candidate, ['abstained', 'bases', 'text'])) {
      throw answerCommitmentError(
        'Answer commitment has unsupported or missing fields.',
      )
    }
    if (typeof candidate.abstained !== 'boolean') {
      throw answerCommitmentError('Answer commitment abstained must be boolean.')
    }
    const text = boundedCommitmentText(
      candidate.text,
      'Answer commitment text',
      MEMORY_ANSWER_MAX_TEXT_CHARS,
      { trim: true },
    )
    if (!arrayIsArray(candidate.bases) || candidate.bases.length < 1 ||
      candidate.bases.length > MEMORY_ANSWER_MAX_BASES) {
      throw answerCommitmentError(
        `Answer commitment bases must contain 1 to ` +
          `${MEMORY_ANSWER_MAX_BASES} items.`,
      )
    }
    const seen = new setConstructor()
    const usedEvidenceIds = new setConstructor()
    const bases = []
    const evidenceCommitments = []
    for (let index = 0; index < candidate.bases.length; index += 1) {
      const basis = candidate.bases[index]
      const declared = hasExactKeys(basis, [
        'evidenceId',
        'quote',
        'consequence_for_answer',
        'not_used_reason',
      ])
      if ((!modern && !declared &&
          !hasExactKeys(basis, ['evidenceId', 'quote'])) ||
        (modern && !declared)) {
        throw answerCommitmentError(
          `Answer commitment basis ${index} has unsupported or missing fields.`,
        )
      }
      const evidenceId = boundedCommitmentText(
        basis.evidenceId,
        `Answer commitment basis ${index} evidenceId`,
        500,
        { trim: true },
      )
      if (setHas(seen, evidenceId)) {
        throw answerCommitmentError(
          `Answer commitment basis ${index} duplicates an evidence ID.`,
        )
      }
      setAdd(seen, evidenceId)
      const sources = mapGet(evidenceRegistry, evidenceId)
      if (!sources) {
        throw answerCommitmentError(
          `Answer commitment basis ${index} uses evidence not returned in this answer session.`,
        )
      }
      const quote = boundedCommitmentText(
        basis.quote,
        `Answer commitment basis ${index} quote`,
        MEMORY_ANSWER_MAX_QUOTE_CHARS,
      )
      let exact = false
      for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex += 1) {
        if (stringIncludes(sources[sourceIndex], quote)) {
          exact = true
          break
        }
      }
      if (!exact) {
        throw answerCommitmentError(
          `Answer commitment basis ${index} quote is not exact contiguous returned evidence.`,
        )
      }
      let consequence = null
      let notUsedReason = null
      if (declared) {
        consequence = boundedOptionalCommitmentText(
          basis.consequence_for_answer,
          `Answer commitment basis ${index} consequence_for_answer`,
          MEMORY_ANSWER_MAX_CONSEQUENCE_CHARS,
        ) || null
        notUsedReason = boundedOptionalCommitmentText(
          basis.not_used_reason,
          `Answer commitment basis ${index} not_used_reason`,
          MEMORY_ANSWER_MAX_NOT_USED_REASON_CHARS,
        ) || null
        if (Boolean(consequence) === Boolean(notUsedReason)) {
          throw answerCommitmentError(
            `Answer commitment basis ${index} must set exactly one consequence_for_answer or not_used_reason.`,
          )
        }
      }
      arrayPush(evidenceCommitments, {
        consequence_for_answer: consequence,
        evidenceId,
        not_used_reason: notUsedReason,
        quote,
      })
      // `answerEvidence` remains the compatibility surface for evidence the
      // provider declared as used. Legacy custom providers predate use labels
      // and retain their historical all-bases behavior.
      if (!declared || consequence) {
        arrayPush(bases, { evidenceId, quote })
        setAdd(usedEvidenceIds, evidenceId)
      }
    }
    const temporaryInferences = []
    const proposedInferences = modern ? candidate.temporaryInferences : []
    if (!arrayIsArray(proposedInferences) ||
      proposedInferences.length > MEMORY_ANSWER_MAX_TEMPORARY_INFERENCES) {
      throw answerCommitmentError(
        `Answer commitment temporaryInferences must contain at most ` +
          `${MEMORY_ANSWER_MAX_TEMPORARY_INFERENCES} items.`,
      )
    }
    for (let index = 0; index < proposedInferences.length; index += 1) {
      const inference = proposedInferences[index]
      if (!hasExactKeys(inference, [
        'statement',
        'provenanceEvidenceIds',
        'revisable',
        'consequence_for_answer',
      ])) {
        throw answerCommitmentError(
          `Answer commitment temporary inference ${index} has unsupported or missing fields.`,
        )
      }
      if (inference.revisable !== true) {
        throw answerCommitmentError(
          `Answer commitment temporary inference ${index} must be revisable.`,
        )
      }
      const statement = boundedCommitmentText(
        inference.statement,
        `Answer commitment temporary inference ${index} statement`,
        MEMORY_ANSWER_MAX_INFERENCE_CHARS,
        { trim: true },
      )
      const consequence_for_answer = boundedCommitmentText(
        inference.consequence_for_answer,
        `Answer commitment temporary inference ${index} consequence_for_answer`,
        MEMORY_ANSWER_MAX_CONSEQUENCE_CHARS,
        { trim: true },
      )
      const ids = inference.provenanceEvidenceIds
      if (!arrayIsArray(ids) || ids.length < 1 ||
        ids.length > MEMORY_ANSWER_MAX_BASES) {
        throw answerCommitmentError(
          `Answer commitment temporary inference ${index} provenanceEvidenceIds must contain 1 to ${MEMORY_ANSWER_MAX_BASES} items.`,
        )
      }
      const inferenceSeen = new setConstructor()
      const provenanceEvidenceIds = []
      for (let idIndex = 0; idIndex < ids.length; idIndex += 1) {
        const evidenceId = boundedCommitmentText(
          ids[idIndex],
          `Answer commitment temporary inference ${index} provenance evidence ID ${idIndex}`,
          500,
          { trim: true },
        )
        if (setHas(inferenceSeen, evidenceId)) {
          throw answerCommitmentError(
            `Answer commitment temporary inference ${index} duplicates provenance evidence.`,
          )
        }
        if (!mapGet(evidenceRegistry, evidenceId) ||
          !setHas(usedEvidenceIds, evidenceId)) {
          throw answerCommitmentError(
            `Answer commitment temporary inference ${index} must link selected used evidence.`,
          )
        }
        setAdd(inferenceSeen, evidenceId)
        arrayPush(provenanceEvidenceIds, evidenceId)
      }
      arrayPush(temporaryInferences, {
        consequence_for_answer,
        provenanceEvidenceIds,
        revisable: true,
        statement,
      })
    }
    const committed = deepFreeze({
      abstained: candidate.abstained,
      bases,
      evidenceCommitments,
      temporaryInferences,
      text,
    })
    weakSetAdd(committedResponses, committed)
    return committed
  }

  const consultRows = (rows) => {
    for (let index = 0; index < rows.length; index += 1) {
      arrayPush(consulted, rows[index].evidenceId)
    }
  }

  let retrievalPlan = null
  let planningCalls = 0
  const tools = {
    memory_find(input) {
      const found = brain.exploreFind(scope, input)
      consultRows(found.matches)
      return registerEvidence({
        ...found,
        matches: decorateAnswerRows(found.matches, referenceTime),
      })
    },
    memory_graph(input) {
      const result = brain.exploreGraph(scope, {
        ...input,
        ...(referenceTime ? { now: referenceTime } : {}),
      })
      consultRows(result.edges)
      return registerEvidence({
        ...result,
        edges: decorateAnswerRows(result.edges, referenceTime),
      })
    },
    memory_plan(input) {
      if (retrievalPlan) {
        const error = new TypeError(
          'Only one memory retrieval plan may be registered per answer.',
        )
        error.code = 'MEMORY_RETRIEVAL_PLAN_ALREADY_REGISTERED'
        throw error
      }
      retrievalPlan = normalizeRetrievalPlan(input)
      planningCalls = 1
      return deepFreeze({
        countsAgainstRetrievalBudget: false,
        operation: MEMORY_RETRIEVAL_PLAN_TOOL_NAME,
        plan: retrievalPlan,
      })
    },
    memory_read(input) {
      const result = brain.exploreRead(scope, input)
      consultRows(result.messages)
      return registerEvidence({
        ...result,
        messages: decorateAnswerRows(result.messages, referenceTime),
      })
    },
    async memory_search(input) {
      const result = await hybridSearch(
        brain,
        scope,
        capabilities,
        input,
        referenceTime,
      )
      consultRows(result.matches)
      return registerEvidence(result)
    },
    memory_timeline(input) {
      return brain.exploreTimeline(scope, input)
    },
  }

  const briefing = recallMemory(brain, scope, { maxChars })
  let calls = 0
  let exhausted = false
  let retrievalOpen = true
  const retrievalOperations = []
  const retrieve = (request) => {
    if (!retrievalOpen) {
      return promiseReject(new TypeError('Memory retrieval is closed.'))
    }
    const operation = (async () => {
      const name = stringFrom(request?.tool ?? '')
      if (!objectHasOwn(tools, name)) {
        throw new TypeError(`Unknown memory tool: ${name}`)
      }
      const planning = name === MEMORY_RETRIEVAL_PLAN_TOOL_NAME
      if (!planning && calls >= budget) {
        exhausted = true
        return {
          exhausted: true,
          reason: 'retrieval_budget_exhausted',
        }
      }
      if (!planning) calls += 1
      const input = request?.input ?? {}
      const result = await tools[name](input)
      arrayPush(transcript, { input, result, tool: name })
      return result
    })()
    // Attach a host-private completion before the provider receives the
    // operation. Pin the operation's species so same-realm prototype
    // poisoning cannot replace the private promise created by native `then`.
    objectDefineProperty(operation, 'constructor', {
      value: promiseSpeciesCarrier,
    })
    const record = { completion: null, outcome: null }
    const completion = promiseThen(
      operation,
      () => {
        record.outcome = { status: 'fulfilled' }
      },
      (reason) => {
        record.outcome = { reason, status: 'rejected' }
      },
    )
    // `await` can now recognize this unexposed native promise without reading
    // a provider-mutated Promise.prototype.constructor.
    objectDefineProperty(completion, 'constructor', {
      value: promiseConstructor,
    })
    record.completion = completion
    arrayPush(retrievalOperations, record)
    return operation
  }

  let response
  let providerError = null
  let providerFailed = false
  try {
    response = await provider({
      answerEvidenceCount: () => evidenceCount,
      answerInstructions: MEMORY_RETRIEVAL_INSTRUCTIONS,
      briefing,
      memoryText: briefing.text,
      maxRetrievalCalls: budget,
      maxRetrievalPlanningCalls: 1,
      question,
      questionDate,
      questionText: [
        questionDate ? `Question date: ${questionDate}` : '',
        `Question: ${stringFrom(question)}`,
      ].filter(Boolean).join('\n'),
      recommendedMaxOutputTokens:
        MEMORY_ANSWER_RECOMMENDED_MAX_OUTPUT_TOKENS,
      retrievalCapabilities: capabilities,
      retrievalFinalizationInstructions:
        MEMORY_RETRIEVAL_FINALIZATION_INSTRUCTIONS,
      retrievalTools: MEMORY_RETRIEVAL_TOOLS,
      commitAnswer,
      retrieve,
      systemInstruction: memoryAnswerSystemInstruction,
    })
  } catch (error) {
    providerFailed = true
    providerError = error
  } finally {
    retrievalOpen = false
  }

  let retrievalError = null
  let retrievalFailed = false
  for (let index = 0; index < retrievalOperations.length; index += 1) {
    const record = retrievalOperations[index]
    await record.completion
    if (record.outcome.status === 'rejected' && !retrievalFailed) {
      retrievalFailed = true
      retrievalError = record.outcome.reason
    }
  }
  if (providerFailed) throw providerError
  if (retrievalFailed) throw retrievalError

  const answerCommitted = weakSetHas(committedResponses, response)
  if (requiresEvidenceCommitment &&
    evidenceCount > 0 && !answerCommitted) {
    throw answerCommitmentError(
      'This provider must return the exact host-committed answer object after evidence retrieval.',
    )
  }
  const answerEvidence = []
  const evidenceCommitments = answerCommitted
    ? response.evidenceCommitments
    : []
  const temporaryInferences = answerCommitted
    ? response.temporaryInferences
    : []
  if (answerCommitted) {
    for (let index = 0; index < response.bases.length; index += 1) {
      const { evidenceId, quote } = response.bases[index]
      arrayPush(answerEvidence, { evidenceId, quote })
    }
  }
  deepFreeze(answerEvidence)
  deepFreeze(evidenceCommitments)
  deepFreeze(temporaryInferences)
  const selectedEvidenceIds = []
  for (let index = 0; index < evidenceCommitments.length; index += 1) {
    arrayPush(selectedEvidenceIds, evidenceCommitments[index].evidenceId)
  }
  deepFreeze(selectedEvidenceIds)
  const uniqueConsulted = []
  const consultedSet = new setConstructor()
  for (let index = 0; index < consulted.length; index += 1) {
    if (setHas(consultedSet, consulted[index])) continue
    setAdd(consultedSet, consulted[index])
    arrayPush(uniqueConsulted, consulted[index])
  }

  return {
    abstained: typeof response?.abstained === 'boolean'
      ? response.abstained
      : null,
    answer: answerCommitted
      ? response.text
      : stringFrom(response?.text ?? response ?? ''),
    answerCommitted,
    answerEvidence,
    evidenceCommitments,
    briefingMode: briefing.briefingMode,
    briefingStatus: briefing.status,
    consultedEvidenceIds: uniqueConsulted,
    digestRevision: briefing.digestRevision,
    providerCalled: true,
    retrievalPlan,
    retrievalPlanningCalls: planningCalls,
    reductionBlocked: briefing.reductionBlocked,
    retrievalCalls: calls,
    retrievalCapabilities: capabilities,
    retrievalExhausted: exhausted,
    retrievalTranscript: transcript,
    selectedEvidenceIds,
    temporaryInferences,
  }
}

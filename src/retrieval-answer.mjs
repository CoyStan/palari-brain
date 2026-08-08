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
export const MEMORY_ANSWER_MAX_ENUMERATION_ITEMS = 50
export const MEMORY_ANSWER_MAX_ENUMERATION_LABEL_CHARS = 500
export const MEMORY_ANSWER_MAX_ENUMERATION_ACTION_CHARS = 200
export const MEMORY_ANSWER_MAX_ENUMERATION_REASON_CHARS = 1_000
// Deprecated compatibility exports from the removed dual recommendation
// surface. Recommendation mode no longer consumes these limits.
export const MEMORY_ANSWER_MAX_RECOMMENDATION_ITEMS = 10
export const MEMORY_ANSWER_MAX_RECOMMENDATION_PROPOSAL_CHARS = 1_000
export const MEMORY_ANSWER_MAX_RECOMMENDATION_VERIFICATION_CHARS = 1_000
export const MEMORY_ANSWER_MAX_RECOMMENDATION_CLARIFICATION_CHARS = 1_000
export const MEMORY_ANSWER_ENUMERATION_DISPOSITIONS = Object.freeze([
  'included',
  'excluded',
  'ambiguous',
])
export const MEMORY_ANSWER_COMPOSITION_MODES = Object.freeze([
  'auto',
  'recommend',
  'standard',
  'enumerate',
])
export const MEMORY_CURRENT_EVIDENCE_REVIEW_SCHEMA =
  'palari-current-evidence-review/v1'
export const MEMORY_CURRENT_EVIDENCE_REVIEW_MAX_CANDIDATES = 3
export const MEMORY_CURRENT_EVIDENCE_REVIEW_MAX_RANK = 3
export const MEMORY_RETRIEVAL_FRONTIER_SCHEMA =
  'palari-retrieval-frontier/v2'
export const MEMORY_RETRIEVAL_FRONTIER_STAGNANT_ROUNDS = 2
export const MEMORY_BRIDGE_LIMITS = Object.freeze({
  maxAnchors: 4,
  maxProbeChars: 300,
  maxProbes: 4,
  minProbes: 2,
})
export const MEMORY_BRIDGE_RERANK_MAX_QUERY_CHARS = 500
export const MEMORY_ANSWER_ENUMERATION_INSTRUCTIONS = [
  'This question requires exhaustive answer composition from returned evidence.',
  'Before writing final prose, enumerate every distinct candidate unit supported by direct canonical evidence.',
  'Classify each candidate as included, excluded, or ambiguous; give a reason for excluded or ambiguous candidates.',
  'Use excluded only when direct evidence affirmatively establishes that the candidate is outside the requested category or time range, completed, cancelled, or otherwise not applicable.',
  'When evidence simultaneously asserts an outstanding action and language suggesting completion or resolution, or when current state otherwise remains uncertain, classify the candidate as ambiguous instead of inferring that it is resolved.',
  'Do not silently drop a candidate, force ambiguity into a definite count, or save an answer-time inference as canonical memory.',
  'Report referenced, included, and ambiguous counts exactly as committed.',
].join(' ')
export const MEMORY_ANSWER_RECOMMENDATION_INSTRUCTIONS = [
  'This question asks for a recommendation or suggestion grounded in returned memory.',
  'Write the recommendation once in the final answer text and cite only returned memories that materially support it.',
  'A non-abstaining answer must make at least one concrete proposal; clarification may follow but cannot replace every useful proposal.',
  'When exact current inventory, availability, or event listings are not established by returned evidence or another authorized tool, give a safe category-level or strategy-level proposal instead of inventing a live listing.',
  'When a proposal depends on external current availability, state that limitation directly in the answer.',
].join(' ')
export const MEMORY_RETRIEVAL_PLAN_TOOL_NAME = 'memory_plan'
export const MEMORY_RETRIEVAL_PLAN_RELATIONS = Object.freeze([
  'after',
  'around',
  'before',
  'current',
  'during',
  'unspecified',
])
const MEMORY_RETRIEVAL_PLAN_ACCEPTED_RELATIONS = Object.freeze([
  ...MEMORY_RETRIEVAL_PLAN_RELATIONS,
  'between',
])

const MAX_RETRIEVAL_PLAN_ANCHOR_CHARS = 500
const MAX_RETRIEVAL_PLAN_CATEGORY_CHARS = 200
const RETRIEVAL_PLAN_ISO_INSTANT = /^(\d{4})-(\d{2})-(\d{2})(?:T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d))?$/u
const RETRIEVAL_PLAN_MONTH_DAYS = Object.freeze([
  31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
])
const RETRIEVAL_FRONTIER_WHITESPACE = /\s+/gu
const MEMORY_BRIDGE_INPUT_FIELDS = Object.freeze({
  after: true,
  anchorEvidenceIds: true,
  before: true,
  limit: true,
  maxChars: true,
  probes: true,
})
const MEMORY_BRIDGE_TIME_FIELDS = Object.freeze(['after', 'before'])

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
const ENUMERATION_COUNT_QUESTION = /^\s*how\s+many\s+(.{1,120}?)\s+(?:do|does|did|are|were|have|has|had|should|must|can|could|will|would)\b/iu
const ENUMERATION_LIST_QUESTION = /\b(?:list|enumerate)\s+(?:all|every|each)\b/iu
const ENUMERATION_NAMED_COLLECTION_QUESTION = /^\s*(?:which|what)\s+.{0,120}\b(?:items|things|tasks|actions|events|entries|records)\b/iu
const ENUMERATION_RELATIONAL_QUESTION = /^\s*(?:which|what)\s+.{1,120}\s+(?:do|does|did|are|were|have|has|had|should|must|can|could|will|would)\b/iu
const RECOMMENDATION_QUESTION = /\b(?:recommend(?:ation|ations|ed|ing)?|suggest(?:ion|ions|ed|ing)?)\b/iu
const SCALAR_MEASUREMENT_UNIT = /^(?:seconds?|minutes?|hours?|days?|weeks?|months?|years?|meters?|metres?|kilometers?|kilometres?|miles?|feet|inches?|grams?|kilograms?|pounds?|ounces?|liters?|litres?|gallons?|degrees?|percent|percentage|dollars?|euros?|pounds?\s+sterling|tokens?|characters?|words?)\b/iu

// Capture the small set of intrinsics used by the answer-commit boundary
// before provider code can run in this realm. Provider adapters are local
// code, but their model-originated payloads must not gain authority by
// temporarily poisoning mutable built-in prototypes.
const arrayIsArray = Array.isArray
const arrayJoin = Function.call.bind(Array.prototype.join)
const arrayPrototype = Array.prototype
const arrayPush = Function.call.bind(Array.prototype.push)
const dateConstructor = Date
const dateGetTime = Function.call.bind(Date.prototype.getTime)
const dateToISOString = Function.call.bind(Date.prototype.toISOString)
const mapGet = Function.call.bind(Map.prototype.get)
const mapSet = Function.call.bind(Map.prototype.set)
const mapConstructor = Map
const mathFloor = Math.floor
const mathMax = Math.max
const numberConstructor = Number
const numberIsSafeInteger = Number.isSafeInteger
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
const regexpExec = Function.call.bind(RegExp.prototype.exec)
const setAdd = Function.call.bind(Set.prototype.add)
const setHas = Function.call.bind(Set.prototype.has)
const setConstructor = Set
const stringFrom = String
const stringIncludes = Function.call.bind(String.prototype.includes)
const stringReplace = Function.call.bind(String.prototype.replace)
const stringSlice = Function.call.bind(String.prototype.slice)
const stringToLowerCase = Function.call.bind(String.prototype.toLowerCase)
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

export function resolveMemoryAnswerCompositionMode(question, mode = 'auto') {
  const requested = stringTrim(stringFrom(mode ?? ''))
  let supported = false
  for (let index = 0; index < MEMORY_ANSWER_COMPOSITION_MODES.length; index += 1) {
    if (MEMORY_ANSWER_COMPOSITION_MODES[index] === requested) {
      supported = true
      break
    }
  }
  if (!supported) {
    throw new TypeError(
      `compositionMode must be one of ${MEMORY_ANSWER_COMPOSITION_MODES.join(', ')}.`,
    )
  }
  if (requested !== 'auto') return requested

  const text = stringTrim(stringFrom(question ?? ''))
  const countMatch = regexpExec(ENUMERATION_COUNT_QUESTION, text)
  if (countMatch && !regexpExec(SCALAR_MEASUREMENT_UNIT, countMatch[1])) {
    return 'enumerate'
  }
  if (regexpExec(ENUMERATION_LIST_QUESTION, text) ||
    regexpExec(ENUMERATION_NAMED_COLLECTION_QUESTION, text)) {
    return 'enumerate'
  }
  if (regexpExec(RECOMMENDATION_QUESTION, text)) return 'recommend'
  if (regexpExec(ENUMERATION_RELATIONAL_QUESTION, text)) return 'enumerate'
  return 'standard'
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

function assertDenseDataArray(value, label) {
  if (!arrayIsArray(value) || objectGetPrototypeOf(value) !== arrayPrototype) {
    throw answerCommitmentError(`${label} must be an array.`)
  }
  const keys = reflectOwnKeys(value)
  if (keys.length !== value.length + 1 || !objectHasOwn(value, 'length')) {
    throw answerCommitmentError(
      `${label} must contain only dense indexed items.`,
    )
  }
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = objectGetOwnPropertyDescriptor(value, stringFrom(index))
    if (!descriptor || !objectHasOwn(descriptor, 'value') ||
      descriptor.enumerable !== true) {
      throw answerCommitmentError(
        `${label} must contain only dense indexed items.`,
      )
    }
  }
}

function assertCommitmentDataShape(proposal, {
  enumerationRequired = false,
  supportingEvidenceOnly = false,
} = {}) {
  if (supportingEvidenceOnly) {
    exactDataProperties(
      proposal,
      ['abstained', 'supportingEvidenceIds', 'text'],
      'Answer commitment',
    )
    assertDenseDataArray(
      proposal.supportingEvidenceIds,
      'Answer commitment supportingEvidenceIds',
    )
    return
  }
  const modern = plainObject(proposal) &&
    objectHasOwn(proposal, 'temporaryInferences')
  exactDataProperties(
    proposal,
    modern && enumerationRequired
      ? ['abstained', 'bases', 'enumeration', 'temporaryInferences', 'text']
      : modern
        ? ['abstained', 'bases', 'temporaryInferences', 'text']
      : ['abstained', 'bases', 'text'],
    'Answer commitment',
  )
  const bases = proposal.bases
  assertDenseDataArray(bases, 'Answer commitment bases')
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
  assertDenseDataArray(
    inferences,
    'Answer commitment temporaryInferences',
  )
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
  if (enumerationRequired) {
    const enumeration = proposal.enumeration
    exactDataProperties(enumeration, [
      'items',
      'referencedCount',
      'includedCount',
      'ambiguousCount',
    ], 'Answer commitment enumeration')
    assertDenseDataArray(
      enumeration.items,
      'Answer commitment enumeration items',
    )
    for (let index = 0; index < enumeration.items.length; index += 1) {
      exactDataProperties(enumeration.items[index], [
        'label',
        'action',
        'evidenceId',
        'quote',
        'disposition',
        'reason',
      ], `Answer commitment enumeration item ${index}`)
    }
    return
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
  const match = regexpExec(RETRIEVAL_PLAN_ISO_INSTANT, value)
  if (!match) {
    throw retrievalPlanError(`${label} must be an ISO-8601 string or null.`)
  }
  const year = numberConstructor(match[1])
  const month = numberConstructor(match[2])
  const day = numberConstructor(match[3])
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const maximumDay = month === 2 && leap
    ? 29
    : RETRIEVAL_PLAN_MONTH_DAYS[month - 1]
  if (!maximumDay || day < 1 || day > maximumDay) {
    throw retrievalPlanError(`${label} must be an ISO-8601 string or null.`)
  }
  const parsed = new dateConstructor(
    match[0].length === 10 ? `${value}T00:00:00Z` : value,
  )
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
  if (typeof snapshot.relation !== 'string') {
    throw retrievalPlanError('Retrieval plan relation must be a string.')
  }
  const relation = snapshot.relation
  let supported = false
  for (let index = 0;
    index < MEMORY_RETRIEVAL_PLAN_ACCEPTED_RELATIONS.length;
    index += 1) {
    if (MEMORY_RETRIEVAL_PLAN_ACCEPTED_RELATIONS[index] === relation) {
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

function normalizeTrustedRetrievalTimeRange(value) {
  return normalizeRetrievalPlan({
    anchor_event: 'host-authorized retrieval range',
    category: 'host retrieval boundary',
    relation: 'unspecified',
    time_range: value,
  }).time_range
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

export const MEMORY_RETRIEVAL_COMPLETENESS_INSTRUCTIONS = [
  'Treat the question date as context for relative-time descriptions, not as an automatic retrieval cutoff. Keep retrieval bounds open unless the question itself explicitly asks about a bounded period such as before, after, as of, or during an event.',
  'For a current value, duration, correction, or knowledge update, do not stop at an older direct value. Use a second targeted retrieval for a later direct user statement about the same entity before inferring; a later direct value takes precedence over arithmetic extrapolated from an older value.',
  'For an active current-state plan, explicitly assess later highly ranked direct user memories before committing an answer from an older one. A later memory is not automatically relevant or controlling, but it must be used or given a specific not-used reason instead of being silently ignored.',
  'For a personalized recommendation, retrieve both the current situational constraints and at least one direct user preference relevant to the recommendation category. If no relevant preference is found, say that the result is not personalized rather than inventing one.',
  'A relevant prior Palari answer may reveal the vocabulary or source session for user-specific resources, preferences, goals, relationships, or preparations, but it is navigation rather than proof. When such a Palari row is returned and retrieval budget remains, read its source session with memory_read before answering so the direct user context can support the answer. If that session does not recover the needed user evidence, continue through memory_bridge. Do not expand a generic prior Palari answer that contains no user-specific claim relevant to the question.',
  'For a total, count, or supposedly complete list, one relevance-ranked result is not exhaustive. Use complementary bounded searches inside the planned time range; if completeness is still unproven, report a partial result or insufficient evidence instead of a definitive total.',
  'Do not transfer a value across mismatched named people, places, objects, or relationships. Evidence about a different named entity may justify insufficiency or non-use, but cannot answer the requested entity.',
  'Select each canonical evidence ID at most once in an answer commitment. When one message supports several points, choose one exact quote and combine its consequences in one basis.',
].join(' ')

function evidenceRows(result) {
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
  return rows
}

function evidenceTexts(result) {
  const rows = evidenceRows(result)
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

function frontierText(value) {
  if (typeof value !== 'string') return ''
  return stringReplace(
    stringToLowerCase(stringTrim(value)),
    RETRIEVAL_FRONTIER_WHITESPACE,
    ' ',
  )
}

function frontierAttemptKey(tool, input) {
  const parts = [stringFrom(tool)]
  const fields = [
    'phrase',
    'entity',
    'session',
    'after',
    'before',
    'mode',
    'ranked',
    'hops',
    'limit',
    'maxChars',
  ]
  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index]
    const value = input?.[field]
    if (value === undefined || value === null || value === '') continue
    const normalized = typeof value === 'string'
      ? frontierText(value)
      : stringFrom(value)
    arrayPush(parts, `${field}=${normalized}`)
  }
  const evidenceIds = input?.evidenceIds
  if (arrayIsArray(evidenceIds)) {
    const normalizedIds = []
    for (let index = 0; index < evidenceIds.length; index += 1) {
      const id = stringTrim(stringFrom(evidenceIds[index] ?? ''))
      if (id) arrayPush(normalizedIds, id)
    }
    if (normalizedIds.length) {
      arrayPush(parts, `evidenceIds=${arrayJoin(normalizedIds, ',')}`)
    }
  }
  const anchorEvidenceIds = input?.anchorEvidenceIds
  if (arrayIsArray(anchorEvidenceIds)) {
    const normalizedIds = []
    for (let index = 0; index < anchorEvidenceIds.length; index += 1) {
      const id = stringTrim(stringFrom(anchorEvidenceIds[index] ?? ''))
      if (id) arrayPush(normalizedIds, id)
    }
    if (normalizedIds.length) {
      arrayPush(parts, `anchorEvidenceIds=${arrayJoin(normalizedIds, ',')}`)
    }
  }
  const probes = input?.probes
  if (arrayIsArray(probes)) {
    const normalizedProbes = []
    for (let index = 0; index < probes.length; index += 1) {
      const probe = frontierText(probes[index])
      if (probe) arrayPush(normalizedProbes, probe)
    }
    if (normalizedProbes.length) {
      arrayPush(parts, `probes=${arrayJoin(normalizedProbes, '\u001f')}`)
    }
  }
  return arrayJoin(parts, '|')
}

function copyFrontierArray(values) {
  const copied = []
  for (let index = 0; index < values.length; index += 1) {
    arrayPush(copied, values[index])
  }
  return copied
}

function createEphemeralRetrievalFrontier(maxRetrievalCalls) {
  const seenEvidenceSet = new setConstructor()
  const seenEvidenceIds = []
  const anchorEvidenceSet = new setConstructor()
  const anchorEvidenceIds = []
  const attemptedQuerySet = new setConstructor()
  const attemptedQueryKeys = []
  const bridgeLineage = []
  const discoveryByEvidenceId = new mapConstructor()
  const rounds = []
  let budgetRefusals = 0
  let consecutiveNoNewEvidenceRounds = 0
  let repeatedQueryAttempts = 0

  const noteQuery = (tool, input) => {
    const queryKey = frontierAttemptKey(tool, input)
    const repeatedQuery = setHas(attemptedQuerySet, queryKey)
    if (repeatedQuery) {
      repeatedQueryAttempts += 1
    } else {
      setAdd(attemptedQuerySet, queryKey)
      arrayPush(attemptedQueryKeys, queryKey)
    }
    return { queryKey, repeatedQuery }
  }

  const record = ({ input, result, tool }) => {
    const { queryKey, repeatedQuery } = noteQuery(tool, input)
    const roundEvidenceSet = new setConstructor()
    const returnedEvidenceIds = []
    const newEvidenceIds = []
    const repeatedEvidenceIds = []
    const evidence = evidenceTexts(result)
    for (let index = 0; index < evidence.length; index += 1) {
      const evidenceId = evidence[index].evidenceId
      if (setHas(roundEvidenceSet, evidenceId)) continue
      setAdd(roundEvidenceSet, evidenceId)
      arrayPush(returnedEvidenceIds, evidenceId)
      if (setHas(seenEvidenceSet, evidenceId)) {
        arrayPush(repeatedEvidenceIds, evidenceId)
      } else {
        setAdd(seenEvidenceSet, evidenceId)
        arrayPush(seenEvidenceIds, evidenceId)
        arrayPush(newEvidenceIds, evidenceId)
      }
    }
    if (newEvidenceIds.length) {
      consecutiveNoNewEvidenceRounds = 0
    } else {
      consecutiveNoNewEvidenceRounds += 1
    }
    const ordinal = rounds.length + 1
    const round = {
      newEvidenceCount: newEvidenceIds.length,
      newEvidenceIds,
      ordinal,
      queryKey,
      remainingRetrievalCalls: mathMax(
        0,
        maxRetrievalCalls - ordinal,
      ),
      repeatedEvidenceCount: repeatedEvidenceIds.length,
      repeatedEvidenceIds,
      repeatedQuery,
      returnedEvidenceCount: returnedEvidenceIds.length,
      returnedEvidenceIds,
      tool,
    }
    arrayPush(rounds, round)
    if (tool === 'memory_bridge') {
      const bridgeAnchors = copyFrontierArray(result.anchorEvidenceIds)
      const bridgeOrdinal = bridgeLineage.length + 1
      const bridge = {
        anchorEvidenceIds: bridgeAnchors,
        discoveredEvidenceIds: copyFrontierArray(newEvidenceIds),
        ordinal: bridgeOrdinal,
        retrievalRoundOrdinal: ordinal,
        returnedEvidenceIds: copyFrontierArray(returnedEvidenceIds),
      }
      arrayPush(bridgeLineage, bridge)
      for (let index = 0; index < newEvidenceIds.length; index += 1) {
        mapSet(discoveryByEvidenceId, newEvidenceIds[index], {
          anchorEvidenceIds: bridgeAnchors,
          bridgeOrdinal,
        })
      }
    }
    return round
  }

  const refuseForBudget = ({ input, tool }) => {
    noteQuery(tool, input)
    budgetRefusals += 1
  }

  const markAnchors = (values) => {
    if (!arrayIsArray(values)) {
      const error = new TypeError(
        'Retrieval frontier anchors must be an array of returned evidence IDs.',
      )
      error.code = 'MEMORY_RETRIEVAL_FRONTIER_ANCHOR_INVALID'
      throw error
    }
    for (let index = 0; index < values.length; index += 1) {
      const evidenceId = stringTrim(stringFrom(values[index] ?? ''))
      if (!evidenceId || !setHas(seenEvidenceSet, evidenceId)) {
        const error = new TypeError(
          'Retrieval frontier anchors must already exist in returned evidence.',
        )
        error.code = 'MEMORY_RETRIEVAL_FRONTIER_ANCHOR_INVALID'
        throw error
      }
      if (setHas(anchorEvidenceSet, evidenceId)) continue
      setAdd(anchorEvidenceSet, evidenceId)
      arrayPush(anchorEvidenceIds, evidenceId)
    }
    return deepFreeze(copyFrontierArray(anchorEvidenceIds))
  }

  const snapshot = ({ retrievalOpen, selectedEvidenceIds = [] } = {}) => {
    const selected = copyFrontierArray(selectedEvidenceIds)
    const selectedSet = new setConstructor()
    for (let index = 0; index < selected.length; index += 1) {
      setAdd(selectedSet, selected[index])
    }
    const selectedRoutingLineage = []
    const routingOnlyEvidenceSet = new setConstructor()
    const routingOnlyEvidenceIds = []
    const unseenSelectedEvidenceIds = []
    for (let index = 0; index < selected.length; index += 1) {
      if (!setHas(seenEvidenceSet, selected[index])) {
        arrayPush(unseenSelectedEvidenceIds, selected[index])
      }
      const routingEvidenceSet = new setConstructor()
      const routingEvidenceIds = []
      const bridgeOrdinalSet = new setConstructor()
      const bridgeOrdinals = []
      const visit = (evidenceId) => {
        const discovery = mapGet(discoveryByEvidenceId, evidenceId)
        if (!discovery) return
        for (let anchorIndex = 0;
          anchorIndex < discovery.anchorEvidenceIds.length;
          anchorIndex += 1) {
          const anchorEvidenceId = discovery.anchorEvidenceIds[anchorIndex]
          if (setHas(routingEvidenceSet, anchorEvidenceId)) continue
          visit(anchorEvidenceId)
          setAdd(routingEvidenceSet, anchorEvidenceId)
          arrayPush(routingEvidenceIds, anchorEvidenceId)
        }
        if (!setHas(bridgeOrdinalSet, discovery.bridgeOrdinal)) {
          setAdd(bridgeOrdinalSet, discovery.bridgeOrdinal)
          arrayPush(bridgeOrdinals, discovery.bridgeOrdinal)
        }
      }
      visit(selected[index])
      for (let routingIndex = 0;
        routingIndex < routingEvidenceIds.length;
        routingIndex += 1) {
        const routingEvidenceId = routingEvidenceIds[routingIndex]
        if (setHas(selectedSet, routingEvidenceId) ||
          setHas(routingOnlyEvidenceSet, routingEvidenceId)) continue
        setAdd(routingOnlyEvidenceSet, routingEvidenceId)
        arrayPush(routingOnlyEvidenceIds, routingEvidenceId)
      }
      arrayPush(selectedRoutingLineage, {
        bridgeOrdinals,
        routingEvidenceIds,
        selectedEvidenceId: selected[index],
      })
    }
    const stagnant = consecutiveNoNewEvidenceRounds >=
      MEMORY_RETRIEVAL_FRONTIER_STAGNANT_ROUNDS
    const status = budgetRefusals
      ? 'budget_exhausted'
      : stagnant
        ? 'stagnant'
        : retrievalOpen
          ? 'open'
          : 'closed'
    return deepFreeze({
      anchorEvidenceIds: copyFrontierArray(anchorEvidenceIds),
      attemptedQueryKeys: copyFrontierArray(attemptedQueryKeys),
      bridgeLineage: copyFrontierArray(bridgeLineage),
      budgetRefusals,
      consecutiveNoNewEvidenceRounds,
      durableWrites: 0,
      ephemeral: true,
      exhausted: budgetRefusals > 0,
      exhaustionReason: budgetRefusals
        ? 'retrieval_budget_exhausted'
        : null,
      maxRetrievalCalls,
      remainingRetrievalCalls: mathMax(
        0,
        maxRetrievalCalls - rounds.length,
      ),
      repeatedQueryAttempts,
      routingOnlyEvidenceIds,
      roundCount: rounds.length,
      rounds: copyFrontierArray(rounds),
      schema: MEMORY_RETRIEVAL_FRONTIER_SCHEMA,
      seenEvidenceIds: copyFrontierArray(seenEvidenceIds),
      selectedEvidenceIds: selected,
      selectedRoutingLineage,
      stagnant,
      status,
      unseenSelectedEvidenceIds,
    })
  }

  return { markAnchors, record, refuseForBudget, snapshot }
}

function boundedInteger(value, fallback, maximum, label) {
  if (value === undefined || value === null) return fallback
  const parsed = Number(value)
  if (!numberIsSafeInteger(parsed) || parsed < 1) {
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

function memoryBridgeError(message) {
  const error = new TypeError(message)
  error.code = 'MEMORY_BRIDGE_INPUT_INVALID'
  return error
}

function bridgeDataArray(value, label, minimum, maximum) {
  if (!arrayIsArray(value) || objectGetPrototypeOf(value) !== arrayPrototype ||
    value.length < minimum || value.length > maximum) {
    throw memoryBridgeError(
      `${label} must contain ${minimum} to ${maximum} items.`,
    )
  }
  const keys = reflectOwnKeys(value)
  if (keys.length !== value.length + 1 || !objectHasOwn(value, 'length')) {
    throw memoryBridgeError(`${label} must be a dense data array.`)
  }
  const items = []
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = objectGetOwnPropertyDescriptor(value, stringFrom(index))
    if (!descriptor || !objectHasOwn(descriptor, 'value') ||
      descriptor.enumerable !== true) {
      throw memoryBridgeError(`${label} must be a dense data array.`)
    }
    arrayPush(items, descriptor.value)
  }
  return items
}

function normalizeMemoryBridgeInput(value) {
  if (!plainObject(value)) {
    throw memoryBridgeError('memory_bridge input must be a plain data object.')
  }
  const keys = reflectOwnKeys(value)
  const input = {}
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index]
    if (typeof key !== 'string' ||
      !objectHasOwn(MEMORY_BRIDGE_INPUT_FIELDS, key)) {
      throw memoryBridgeError('memory_bridge input has unsupported fields.')
    }
    const descriptor = objectGetOwnPropertyDescriptor(value, key)
    if (!descriptor || !objectHasOwn(descriptor, 'value') ||
      descriptor.enumerable !== true) {
      throw memoryBridgeError(
        `memory_bridge ${key} must be an enumerable data property.`,
      )
    }
    input[key] = descriptor.value
  }

  const rawAnchors = bridgeDataArray(
    input.anchorEvidenceIds,
    'memory_bridge anchorEvidenceIds',
    1,
    MEMORY_BRIDGE_LIMITS.maxAnchors,
  )
  const anchors = []
  const anchorSeen = new setConstructor()
  for (let index = 0; index < rawAnchors.length; index += 1) {
    if (typeof rawAnchors[index] !== 'string') {
      throw memoryBridgeError(
        'memory_bridge anchors must be returned evidence ID strings.',
      )
    }
    const anchor = stringTrim(rawAnchors[index])
    if (!anchor || anchor.length > 500 || setHas(anchorSeen, anchor)) {
      throw memoryBridgeError(
        'memory_bridge anchors must be unique returned evidence IDs.',
      )
    }
    setAdd(anchorSeen, anchor)
    arrayPush(anchors, anchor)
  }

  const rawProbes = bridgeDataArray(
    input.probes,
    'memory_bridge probes',
    MEMORY_BRIDGE_LIMITS.minProbes,
    MEMORY_BRIDGE_LIMITS.maxProbes,
  )
  const probes = []
  const probeSeen = new setConstructor()
  for (let index = 0; index < rawProbes.length; index += 1) {
    if (typeof rawProbes[index] !== 'string') {
      throw memoryBridgeError('memory_bridge probes must be strings.')
    }
    const probe = stringReplace(
      stringTrim(rawProbes[index]),
      RETRIEVAL_FRONTIER_WHITESPACE,
      ' ',
    )
    const identity = frontierText(probe)
    if (!identity || probe.length > MEMORY_BRIDGE_LIMITS.maxProbeChars ||
      setHas(probeSeen, identity)) {
      throw memoryBridgeError(
        `memory_bridge probes must be unique non-empty strings of at most ` +
          `${MEMORY_BRIDGE_LIMITS.maxProbeChars} characters.`,
      )
    }
    setAdd(probeSeen, identity)
    arrayPush(probes, probe)
  }

  const normalized = { anchorEvidenceIds: anchors, probes }
  for (let index = 0; index < MEMORY_BRIDGE_TIME_FIELDS.length; index += 1) {
    const field = MEMORY_BRIDGE_TIME_FIELDS[index]
    if (input[field] === undefined || input[field] === null ||
      input[field] === '') continue
    if (typeof input[field] !== 'string' || input[field].length > 100) {
      throw memoryBridgeError(
        `memory_bridge ${field} must be an ISO-8601 string when provided.`,
      )
    }
    try {
      normalized[field] = retrievalPlanInstant(
        input[field],
        `memory_bridge ${field}`,
      )
    } catch {
      throw memoryBridgeError(
        `memory_bridge ${field} must be an ISO-8601 string when provided.`,
      )
    }
  }
  if (input.limit !== undefined && input.limit !== null) {
    if (!numberIsSafeInteger(input.limit) || input.limit < 1 ||
      input.limit > MAX_HYBRID_LIMIT) {
      throw memoryBridgeError(
        `memory_bridge limit must be an integer from 1 to ` +
          `${MAX_HYBRID_LIMIT}.`,
      )
    }
    normalized.limit = input.limit
  }
  if (input.maxChars !== undefined && input.maxChars !== null) {
    if (!numberIsSafeInteger(input.maxChars) || input.maxChars < 1 ||
      input.maxChars > MAX_HYBRID_MAX_CHARS) {
      throw memoryBridgeError(
        `memory_bridge maxChars must be an integer from 1 to ` +
          `${MAX_HYBRID_MAX_CHARS}.`,
      )
    }
    normalized.maxChars = input.maxChars
  }
  return normalized
}

// Bridge reranking is allowed to use returned raw evidence as routing context,
// but the composed query never enters the answer-commit evidence registry and
// cannot stand in for canonical evidence supporting the missing fact. Keep all
// anchors represented while preserving both ends of longer natural language.
function boundedBridgeRerankExcerpt(value, maximum) {
  const text = stringTrim(stringFrom(value ?? ''))
  if (text.length <= maximum) return text
  if (maximum <= 1) return stringSlice(text, 0, maximum)
  const contentChars = maximum - 1
  const headChars = mathFloor((contentChars + 1) / 2)
  const tailChars = contentChars - headChars
  return `${stringSlice(text, 0, headChars)}…${tailChars > 0
    ? stringSlice(text, -tailChars)
    : ''}`
}

function bridgeRerankQuery({
  anchorEvidenceIds,
  evidenceRegistry,
  primaryProbe,
  question,
}) {
  const anchorTexts = []
  const anchorLabels = []
  for (let index = 0; index < anchorEvidenceIds.length; index += 1) {
    const evidenceId = anchorEvidenceIds[index]
    const sources = mapGet(evidenceRegistry, evidenceId)
    if (!sources || typeof sources[0] !== 'string' || !sources[0]) {
      throw memoryBridgeError(
        'memory_bridge anchor has no registered canonical text.',
      )
    }
    arrayPush(anchorTexts, sources[0])
    arrayPush(anchorLabels, `\nReturned anchor ${index + 1}:\n`)
  }

  const questionLabel = 'Question:\n'
  const probeLabel = '\nBridge probe:\n'
  let labelChars = questionLabel.length + probeLabel.length
  for (let index = 0; index < anchorLabels.length; index += 1) {
    labelChars += anchorLabels[index].length
  }
  const textBudget = MEMORY_BRIDGE_RERANK_MAX_QUERY_CHARS - labelChars
  const questionExcerpt = boundedBridgeRerankExcerpt(
    question,
    Math.min(160, textBudget),
  )
  const probeExcerpt = boundedBridgeRerankExcerpt(
    primaryProbe,
    Math.min(120, textBudget - questionExcerpt.length),
  )
  let anchorBudget = textBudget - questionExcerpt.length - probeExcerpt.length
  let anchorsRemaining = anchorTexts.length
  const anchorExcerpts = []
  for (let index = 0; index < anchorTexts.length; index += 1) {
    const share = mathFloor(anchorBudget / anchorsRemaining)
    const excerpt = boundedBridgeRerankExcerpt(anchorTexts[index], share)
    arrayPush(anchorExcerpts, excerpt)
    anchorBudget -= excerpt.length
    anchorsRemaining -= 1
  }

  const parts = [questionLabel, questionExcerpt, probeLabel, probeExcerpt]
  for (let index = 0; index < anchorExcerpts.length; index += 1) {
    arrayPush(parts, anchorLabels[index], anchorExcerpts[index])
  }
  const query = arrayJoin(parts, '')
  if (query.length > MEMORY_BRIDGE_RERANK_MAX_QUERY_CHARS) {
    throw new Error('memory_bridge rerank query exceeded its host bound.')
  }
  return query
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

export const MEMORY_BRIDGE_TOOL = deepFreeze({
  description: [
    'Search for missing relational evidence after another memory result provides a plausible anchor.',
    'Supply 2 to 4 diverse natural-language probes generated from the question and returned raw anchor text; do not guess the missing answer term.',
    'For a successive hop, include at least one newly returned relationship memory as an anchor rather than repeating only earlier anchors.',
    'The host batches semantic probes when configured, adds local ranked probes, fuses and deduplicates their canonical messages, and runs the reranker at most once.',
    'This consumes one retrieval call and never writes memory.',
  ].join(' '),
  name: 'memory_bridge',
  parameters: {
    additionalProperties: false,
    properties: {
      after: {
        description:
          'Only messages observed at or after this ISO-8601 UTC time.',
        type: 'string',
      },
      anchorEvidenceIds: {
        description:
          'Canonical evidence IDs already returned in this answer that motivate the probes.',
        items: { maxLength: 500, minLength: 1, type: 'string' },
        maxItems: MEMORY_BRIDGE_LIMITS.maxAnchors,
        minItems: 1,
        type: 'array',
        uniqueItems: true,
      },
      before: {
        description:
          'Only messages observed at or before this ISO-8601 UTC time.',
        type: 'string',
      },
      limit: {
        description: 'Maximum deduplicated canonical messages to return.',
        maximum: MAX_HYBRID_LIMIT,
        minimum: 1,
        type: 'integer',
      },
      maxChars: {
        description:
          'Maximum approximate returned-message characters. A complete message is never cut.',
        maximum: MAX_HYBRID_MAX_CHARS,
        minimum: 1,
        type: 'integer',
      },
      probes: {
        description: [
          'Ordered, on-the-fly retrieval probes.',
          'Make the first a broad semantic bridge and the rest complementary relational or lexical formulations.',
        ].join(' '),
        items: {
          maxLength: MEMORY_BRIDGE_LIMITS.maxProbeChars,
          minLength: 1,
          type: 'string',
        },
        maxItems: MEMORY_BRIDGE_LIMITS.maxProbes,
        minItems: MEMORY_BRIDGE_LIMITS.minProbes,
        type: 'array',
        uniqueItems: true,
      },
    },
    required: ['anchorEvidenceIds', 'probes'],
    type: 'object',
  },
})

export const MEMORY_RETRIEVAL_TOOLS = deepFreeze([
  ...MEMORY_EXPLORATION_TOOLS,
  MEMORY_RETRIEVAL_PLAN_TOOL,
  HYBRID_TOOL,
  GRAPH_TOOL,
])

export const MEMORY_ITERATIVE_RETRIEVAL_TOOLS = deepFreeze([
  ...MEMORY_RETRIEVAL_TOOLS,
  MEMORY_BRIDGE_TOOL,
])

export const MEMORY_BRIDGE_INSTRUCTIONS = [
  'After a returned raw memory gives a plausible anchor but the linked, earlier, later, or otherwise related fact is still missing, continue from that anchor before issuing another general search. For a relevant prior Palari answer with a source session, first use memory_read on that session to recover direct user context; otherwise the next retrieval call must be memory_bridge.',
  'Do not issue another memory_search while a plausible returned anchor remains unexplored.',
  'Generate 2 to 4 diverse probes from the question and the anchor text itself; do not guess the missing answer term.',
  'If memory_bridge returns a new plausible raw anchor but not the answer, call memory_bridge again with the new anchor.',
  'Treat a returned raw memory that connects the current anchor to a newly named entity, person, event, or term as a plausible next anchor even when it does not yet answer the question.',
  'On successive hops, anchor that new raw memory; do not reuse only the prior anchor set.',
  'A raw memory used only to navigate to answer evidence need not be selected as answer evidence; the host records its ephemeral routing role separately.',
  'Do not stop while retrieval budget remains and a new plausible anchor is unexplored.',
  'Resume ordinary search only if no plausible raw anchor was returned or memory_bridge reports stagnation.',
  'Inspect its retrievalFrontier and stop reformulating after it reports stagnation.',
].join(' ')

const MEMORY_RETRIEVAL_DETAILED_EVIDENCE_INSTRUCTION =
  'Select only memories you actually assessed for the answer. For each selected memory, state either its concrete consequence_for_answer or a specific not_used_reason; never both. Retrieved rows that were not selected need no commitment.'
const MEMORY_RETRIEVAL_TEMPORARY_INFERENCE_INSTRUCTION =
  'A consequence_for_answer is a declaration to audit, not proof of material use. Cross-context transfer must be a temporary provenance-linked inference marked revisable, never a canonical user fact.'
const MEMORY_RETRIEVAL_SUPPORTING_EVIDENCE_INSTRUCTION =
  'Cite only returned memories that materially support the recommendation; the commitment asks for supporting evidence IDs, not copied quotes or consequence fields.'
const MEMORY_RETRIEVAL_EPHEMERAL_REASONING_INSTRUCTION =
  'A model-declared evidence link is an auditable claim, not proof of material use. Answer-time reasoning never becomes canonical memory without passing the write admission gate.'

export const MEMORY_RETRIEVAL_INSTRUCTIONS = [
  MEMORY_EXPLORATION_INSTRUCTIONS,
  MEMORY_RETRIEVAL_PLAN_INSTRUCTIONS,
  'Use memory_search when the digest does not answer a paraphrased question. It returns complete canonical messages, fusing ranked and semantic location when semantic retrieval is configured.',
  'Use memory_graph for relationship, correction-history, and multi-hop questions. Its edges are finding aids backed by the exact quote and evidence ID on each edge.',
  'After each memory-tool result, inspect the returned canonical messages or admitted edges themselves. If one directly addresses the question, use it or state the exact conflict or limitation that makes it unusable; do not claim no relevant memory merely because the initial briefing or digest was empty.',
  'A non-empty result does not establish relevance. If the returned records do not address the question, do not force an answer from them.',
  MEMORY_RETRIEVAL_DETAILED_EVIDENCE_INSTRUCTION,
  MEMORY_RETRIEVAL_TEMPORARY_INFERENCE_INSTRUCTION,
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
  supplementalRankedQueries = [],
  semanticProbeQueries = [],
  rerankQuery = null,
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
  const supplementalQueries = []
  // Completeness expansion stays local: semantic retrieval and the reranker
  // still run once, while cheap ranked facets widen their shared candidate set.
  const seenRankedPhrases = new setConstructor([rankedPhrase(phrase)])
  let supplementalRankedCandidates = 0
  for (let index = 0; index < supplementalRankedQueries.length; index += 1) {
    const query = supplementalRankedQueries[index]
    const candidatePhrase = rankedPhrase(
      stringTrim(stringFrom(query?.phrase ?? '')),
    )
    if (!candidatePhrase || setHas(seenRankedPhrases, candidatePhrase)) continue
    setAdd(seenRankedPhrases, candidatePhrase)
    const supplemental = brain.exploreFind(scope, {
      after: after || undefined,
      before: before || undefined,
      limit: candidateLimit,
      maxChars: MAX_HYBRID_MAX_CHARS,
      phrase: candidatePhrase,
      ranked: true,
    })
    const surface = `ranked:${stringFrom(query?.surface ?? index + 1)}`
    rankings.push({ rows: supplemental.matches, surface })
    supplementalRankedCandidates += supplemental.matches.length
    supplementalQueries.push({
      candidates: supplemental.matches.length,
      phrase: candidatePhrase,
      surface,
    })
  }
  let semantic = []
  const semanticProbeResults = []
  if (capabilities.semantic) {
    if (semanticProbeQueries.length > 0 &&
      typeof brain.exploreSemanticBatch === 'function') {
      const batches = await brain.exploreSemanticBatch(scope, {
        limit: candidateLimit,
        phrases: semanticProbeQueries.map((query) => query.phrase),
      })
      for (let index = 0; index < batches.length; index += 1) {
        const rows = batches[index]
          .filter((row) => withinBounds(row, after, before))
        const query = semanticProbeQueries[index]
        const surface = `semantic:${stringFrom(query.surface ?? index + 1)}`
        rankings.push({ rows, surface })
        semantic.push(...rows)
        semanticProbeResults.push({
          candidates: rows.length,
          phrase: query.phrase,
          surface,
        })
      }
    } else {
      semantic = (await brain.exploreSemantic(scope, {
        limit: candidateLimit,
        phrase,
      })).filter((row) => withinBounds(row, after, before))
      rankings.push({ rows: semantic, surface: 'semantic' })
    }
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
    const effectiveRerankQuery = rerankQuery === null
      ? phrase
      : searchPhrase(rerankQuery)
    const scores = await brain.rerankEvidence(effectiveRerankQuery, texts)
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
    if (supplementalQueries.length > 0) {
      // A relevance-only reranker can collapse a complete result into several
      // near-duplicate assistant answers. Blend it with retrieval coverage and
      // direct-user provenance; no candidate is invented or treated as proof.
      const scoredById = new Map()
      for (let index = 0; index < ordered.length; index += 1) {
        mapSet(scoredById, ordered[index].evidenceId, ordered[index])
      }
      const coverageOrder = candidates.map(({ evidenceId }) => ({ evidenceId }))
      const rerankOrder = ordered.map(({ evidenceId }) => ({ evidenceId }))
      const originalUserOrder = ordered
        .filter(({ speaker }) => speaker === 'user')
        .map(({ evidenceId }) => ({ evidenceId }))
      const completionRankings = [
        { rows: coverageOrder, surface: 'retrieval-coverage' },
        { rows: rerankOrder, surface: 'reranker' },
      ]
      if (originalUserOrder.length > 0) {
        completionRankings.push({
          rows: originalUserOrder,
          surface: 'original-user-evidence',
        })
      }
      const blended = reciprocalRankFuse(
        completionRankings,
        { limit: candidates.length },
      )
      ordered = blended.map((entry) => ({
        ...mapGet(scoredById, entry.evidenceId),
        completionRrfScore: entry.rrfScore,
        completionSurfaceRanks: entry.surfaceRanks,
      }))
    }
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
    ...(semanticProbeResults.length
      ? { semanticProbeQueries: semanticProbeResults }
      : {}),
    semanticUsed: capabilities.semantic,
    supplementalRankedCandidates,
    supplementalRankedQueries: supplementalQueries,
    truncated: matches.length < ordered.length,
  }
}

// New API rather than silently changing the three-tool contract consumed by
// sealed historical evaluators. Product integrations opt into this path and
// can map MEMORY_RETRIEVAL_TOOLS to their provider's tool schema.
export async function answerWithRetrieval(brain, {
  additionalInstructions = '',
  compositionMode = 'standard',
  expandPlannedSearches = false,
  iterativeRetrieval = false,
  maxChars = 100_000,
  maxRetrievalCalls = DEFAULT_RETRIEVAL_CALLS,
  palariId,
  provider,
  question,
  questionDate,
  trustedRetrievalTimeRange,
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
  if (!numberIsSafeInteger(budget) || budget < 0 ||
    budget > DEFAULT_RETRIEVAL_CALLS) {
    throw new TypeError(
      `maxRetrievalCalls must be an integer from 0 to ` +
        `${DEFAULT_RETRIEVAL_CALLS}.`,
    )
  }
  if (typeof additionalInstructions !== 'string' ||
    additionalInstructions.length > 4_000) {
    throw new TypeError(
      'additionalInstructions must be a string of at most 4000 characters.',
    )
  }
  if (typeof expandPlannedSearches !== 'boolean') {
    throw new TypeError('expandPlannedSearches must be boolean.')
  }
  if (typeof iterativeRetrieval !== 'boolean') {
    throw new TypeError('iterativeRetrieval must be boolean.')
  }
  const resolvedCompositionMode = resolveMemoryAnswerCompositionMode(
    question,
    compositionMode,
  )
  const enumerationRequired = resolvedCompositionMode === 'enumerate'
  const supportingEvidenceOnly =
    resolvedCompositionMode === 'recommend' && requiresEvidenceCommitment
  const enumerationInstructions = enumerationRequired
    ? MEMORY_ANSWER_ENUMERATION_INSTRUCTIONS
    : ''
  const recommendationInstructions = resolvedCompositionMode === 'recommend'
    ? MEMORY_ANSWER_RECOMMENDATION_INSTRUCTIONS
    : ''
  const retrievalInstructions = resolvedCompositionMode === 'recommend'
    ? stringReplace(
        stringReplace(
          MEMORY_RETRIEVAL_INSTRUCTIONS,
          MEMORY_RETRIEVAL_DETAILED_EVIDENCE_INSTRUCTION,
          MEMORY_RETRIEVAL_SUPPORTING_EVIDENCE_INSTRUCTION,
        ),
        MEMORY_RETRIEVAL_TEMPORARY_INFERENCE_INSTRUCTION,
        MEMORY_RETRIEVAL_EPHEMERAL_REASONING_INSTRUCTION,
      )
    : MEMORY_RETRIEVAL_INSTRUCTIONS
  const answerInstructions = [
    retrievalInstructions,
    iterativeRetrieval ? MEMORY_BRIDGE_INSTRUCTIONS : '',
    enumerationInstructions,
    recommendationInstructions,
    additionalInstructions.trim(),
  ].filter(Boolean).join('\n\n')
  const trustedTimeRange = trustedRetrievalTimeRange === undefined
    ? null
    : normalizeTrustedRetrievalTimeRange(trustedRetrievalTimeRange)

  const scope = normalizedScope({ palariId, userId })
  const capabilities = capabilitiesOf(brain)
  const consulted = []
  const committedResponses = new WeakSet()
  const evidenceRegistry = new Map()
  const evidenceReviewIndex = new Map()
  const evidenceReviewRows = []
  let evidenceCount = 0
  let acceptedCurrentEvidenceReview = null
  const transcript = []
  const frontier = createEphemeralRetrievalFrontier(budget)
  const referenceTime = questionReferenceTime(questionDate)
  const routingQuestion = stringFrom(question)

  const registerEvidence = (result) => {
    for (const { evidenceId, text } of evidenceTexts(result)) {
      const current = mapGet(evidenceRegistry, evidenceId)
      const texts = current ?? []
      if (!current) evidenceCount += 1
      arrayPush(texts, text)
      mapSet(evidenceRegistry, evidenceId, texts)
    }
    const rows = evidenceRows(result)
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index]
      const evidenceId = stringTrim(stringFrom(row?.evidenceId ?? ''))
      const order = numberConstructor(row?.order)
      const speaker = stringToLowerCase(
        stringTrim(stringFrom(row?.speaker ?? '')),
      )
      if (!evidenceId || speaker !== 'user' ||
        !numberIsSafeInteger(order) || order < 0) continue
      const rank = index + 1
      const current = mapGet(evidenceReviewIndex, evidenceId)
      if (current) {
        if (rank < current.bestRank) current.bestRank = rank
        continue
      }
      const reviewRow = { bestRank: rank, evidenceId, order }
      arrayPush(evidenceReviewRows, reviewRow)
      mapSet(evidenceReviewIndex, evidenceId, reviewRow)
    }
    return deepFreeze(result)
  }

  const currentEvidenceReview = ({ assessed, used }) => {
    if (compositionMode !== 'auto' || retrievalPlan?.relation !== 'current') {
      return null
    }
    let earliestUsedOrder = null
    const materiallyUsedEvidenceIds = []
    for (let index = 0; index < evidenceReviewRows.length; index += 1) {
      const row = evidenceReviewRows[index]
      if (!setHas(used, row.evidenceId)) continue
      arrayPush(materiallyUsedEvidenceIds, row.evidenceId)
      if (earliestUsedOrder === null || row.order < earliestUsedOrder) {
        earliestUsedOrder = row.order
      }
    }
    const candidateEvidenceIds = []
    const unresolvedEvidenceIds = []
    if (earliestUsedOrder !== null) {
      for (let index = 0; index < evidenceReviewRows.length; index += 1) {
        const row = evidenceReviewRows[index]
        if (row.bestRank > MEMORY_CURRENT_EVIDENCE_REVIEW_MAX_RANK ||
          row.order <= earliestUsedOrder ||
          setHas(used, row.evidenceId)) continue
        arrayPush(candidateEvidenceIds, row.evidenceId)
        if (!setHas(assessed, row.evidenceId)) {
          arrayPush(unresolvedEvidenceIds, row.evidenceId)
        }
        if (candidateEvidenceIds.length >=
          MEMORY_CURRENT_EVIDENCE_REVIEW_MAX_CANDIDATES) break
      }
    }
    const assessedEvidenceIds = []
    for (let index = 0; index < candidateEvidenceIds.length; index += 1) {
      if (setHas(assessed, candidateEvidenceIds[index])) {
        arrayPush(assessedEvidenceIds, candidateEvidenceIds[index])
      }
    }
    return {
      applied: earliestUsedOrder !== null,
      assessedEvidenceIds,
      candidateEvidenceIds,
      durableWrites: 0,
      materiallyUsedEvidenceIds,
      schema: MEMORY_CURRENT_EVIDENCE_REVIEW_SCHEMA,
      unresolvedEvidenceIds,
    }
  }

  const commitAnswer = (proposal) => {
    // Provider objects are outside the host trust boundary. Read them once
    // into a private structured snapshot, then use only host-owned iteration;
    // never invoke provider-overridable Array methods during validation.
    assertCommitmentDataShape(proposal, {
      enumerationRequired,
      supportingEvidenceOnly,
    })
    const candidate = snapshotCommitment(proposal)
    if (supportingEvidenceOnly) {
      if (typeof candidate.abstained !== 'boolean') {
        throw answerCommitmentError(
          'Answer commitment abstained must be boolean.',
        )
      }
      const text = boundedCommitmentText(
        candidate.text,
        'Answer commitment text',
        MEMORY_ANSWER_MAX_TEXT_CHARS,
        { trim: true },
      )
      const ids = candidate.supportingEvidenceIds
      if (ids.length > MEMORY_ANSWER_MAX_BASES ||
        (!candidate.abstained && ids.length < 1) ||
        (candidate.abstained && ids.length !== 0)) {
        throw answerCommitmentError(
          candidate.abstained
            ? 'An abstaining answer commitment must contain zero supporting evidence IDs.'
            : `A non-abstaining answer commitment must contain 1 to ` +
              `${MEMORY_ANSWER_MAX_BASES} supporting evidence IDs.`,
        )
      }
      const seen = new setConstructor()
      const bases = []
      const evidenceCommitments = []
      for (let index = 0; index < ids.length; index += 1) {
        const evidenceId = boundedCommitmentText(
          ids[index],
          `Answer commitment supporting evidence ID ${index}`,
          500,
          { trim: true },
        )
        if (setHas(seen, evidenceId)) {
          throw answerCommitmentError(
            `Answer commitment supporting evidence ID ${index} is duplicated.`,
          )
        }
        const sources = mapGet(evidenceRegistry, evidenceId)
        if (!sources) {
          throw answerCommitmentError(
            `Answer commitment supporting evidence ID ${index} was not returned in this answer session.`,
          )
        }
        setAdd(seen, evidenceId)
        const quote = stringSlice(sources[0], 0, MEMORY_ANSWER_MAX_QUOTE_CHARS)
        arrayPush(bases, { evidenceId, quote })
        arrayPush(evidenceCommitments, {
          consequence_for_answer: null,
          evidenceId,
          not_used_reason: null,
          quote,
        })
      }
      const committed = deepFreeze({
        abstained: candidate.abstained,
        bases,
        evidenceCommitments,
        temporaryInferences: [],
        text,
      })
      weakSetAdd(committedResponses, committed)
      return committed
    }
    const modernKeys = enumerationRequired
      ? [
          'abstained',
          'bases',
          'enumeration',
          'temporaryInferences',
          'text',
        ]
      : [
          'abstained',
          'bases',
          'temporaryInferences',
          'text',
        ]
    const modern = hasExactKeys(candidate, modernKeys)
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
    const lateErrors = []
    let enumeration = null
    if (enumerationRequired) {
      const proposed = candidate.enumeration
      if (!arrayIsArray(proposed.items) ||
        proposed.items.length > MEMORY_ANSWER_MAX_ENUMERATION_ITEMS) {
        throw answerCommitmentError(
          `Answer commitment enumeration items must contain 0 to ` +
            `${MEMORY_ANSWER_MAX_ENUMERATION_ITEMS} items.`,
        )
      }
      const items = []
      const itemSeen = new setConstructor()
      let includedCount = 0
      let ambiguousCount = 0
      for (let index = 0; index < proposed.items.length; index += 1) {
        const item = proposed.items[index]
        const label = boundedCommitmentText(
          item.label,
          `Answer commitment enumeration item ${index} label`,
          MEMORY_ANSWER_MAX_ENUMERATION_LABEL_CHARS,
          { trim: true },
        )
        const action = boundedCommitmentText(
          item.action,
          `Answer commitment enumeration item ${index} action`,
          MEMORY_ANSWER_MAX_ENUMERATION_ACTION_CHARS,
          { trim: true },
        )
        const evidenceId = boundedCommitmentText(
          item.evidenceId,
          `Answer commitment enumeration item ${index} evidenceId`,
          500,
          { trim: true },
        )
        if (!setHas(seen, evidenceId)) {
          throw answerCommitmentError(
            `Answer commitment enumeration item ${index} must link selected evidence.`,
          )
        }
        const quote = boundedCommitmentText(
          item.quote,
          `Answer commitment enumeration item ${index} quote`,
          MEMORY_ANSWER_MAX_QUOTE_CHARS,
        )
        const sources = mapGet(evidenceRegistry, evidenceId)
        let exact = false
        for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex += 1) {
          if (stringIncludes(sources[sourceIndex], quote)) {
            exact = true
            break
          }
        }
        if (!exact) {
          throw answerCommitmentError(
            `Answer commitment enumeration item ${index} quote is not exact contiguous returned evidence.`,
          )
        }
        let dispositionSupported = false
        for (let dispositionIndex = 0;
          dispositionIndex < MEMORY_ANSWER_ENUMERATION_DISPOSITIONS.length;
          dispositionIndex += 1) {
          if (MEMORY_ANSWER_ENUMERATION_DISPOSITIONS[dispositionIndex] ===
            item.disposition) {
            dispositionSupported = true
            break
          }
        }
        if (!dispositionSupported) {
          throw answerCommitmentError(
            `Answer commitment enumeration item ${index} disposition is unsupported.`,
          )
        }
        const reason = boundedCommitmentText(
          item.reason,
          `Answer commitment enumeration item ${index} reason`,
          MEMORY_ANSWER_MAX_ENUMERATION_REASON_CHARS,
          { trim: true },
        )
        const identity = `${evidenceId}\u0000${quote}\u0000${label}\u0000${action}`
        if (setHas(itemSeen, identity)) {
          throw answerCommitmentError(
            `Answer commitment enumeration item ${index} duplicates a candidate.`,
          )
        }
        setAdd(itemSeen, identity)
        if (item.disposition === 'included') includedCount += 1
        if (item.disposition === 'ambiguous') ambiguousCount += 1
        arrayPush(items, {
          action,
          disposition: item.disposition,
          evidenceId,
          label,
          quote,
          reason,
        })
      }
      const countNames = [
        'referencedCount',
        'includedCount',
        'ambiguousCount',
      ]
      const countValues = [
        proposed.items.length,
        includedCount,
        ambiguousCount,
      ]
      for (let index = 0; index < countNames.length; index += 1) {
        const name = countNames[index]
        const expected = countValues[index]
        if (!numberIsSafeInteger(proposed[name]) || proposed[name] < 0 ||
          proposed[name] !== expected) {
          throw answerCommitmentError(
            `Answer commitment enumeration ${name} must equal ${expected}.`,
          )
        }
      }
      enumeration = {
        ambiguousCount,
        includedCount,
        items,
        referencedCount: proposed.items.length,
      }
    }
    const review = currentEvidenceReview({
      assessed: seen,
      used: usedEvidenceIds,
    })
    if (review?.unresolvedEvidenceIds.length) {
      arrayPush(lateErrors,
        `Current-state commitment left later returned direct-user evidence ` +
          `unassessed: ${arrayJoin(review.unresolvedEvidenceIds, ', ')}. ` +
          `Add each as used evidence or with a specific not_used_reason; ` +
          `later evidence is not automatically controlling.`,
      )
    }
    if (lateErrors.length) {
      throw answerCommitmentError(arrayJoin(lateErrors, ' '))
    }
    acceptedCurrentEvidenceReview = review
      ? deepFreeze(review)
      : null
    const committed = deepFreeze({
      abstained: candidate.abstained,
      bases,
      ...(enumerationRequired ? { enumeration } : {}),
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
  const applyTrustedTimeRange = (input) => trustedTimeRange
    ? {
        ...input,
        after: trustedTimeRange.after,
        before: trustedTimeRange.before,
      }
    : input
  const tools = {
    async memory_bridge(input) {
      const normalized = normalizeMemoryBridgeInput(input)
      frontier.markAnchors(normalized.anchorEvidenceIds)
      const rerankQuery = capabilities.reranking
        ? bridgeRerankQuery({
            anchorEvidenceIds: normalized.anchorEvidenceIds,
            evidenceRegistry,
            primaryProbe: normalized.probes[0],
            question: routingQuestion,
          })
        : null
      const supplementalRankedQueries = []
      const semanticProbeQueries = []
      for (let index = 0; index < normalized.probes.length; index += 1) {
        const surface = `bridge-${index + 1}`
        arrayPush(semanticProbeQueries, {
          phrase: normalized.probes[index],
          surface,
        })
        if (index > 0) {
          arrayPush(supplementalRankedQueries, {
            phrase: normalized.probes[index],
            surface,
          })
        }
      }
      const searchInput = applyTrustedTimeRange({
        ...(normalized.after ? { after: normalized.after } : {}),
        ...(normalized.before ? { before: normalized.before } : {}),
        ...(normalized.limit ? { limit: normalized.limit } : {}),
        ...(normalized.maxChars ? { maxChars: normalized.maxChars } : {}),
        phrase: normalized.probes[0],
      })
      const result = await hybridSearch(
        brain,
        scope,
        capabilities,
        searchInput,
        referenceTime,
        supplementalRankedQueries,
        semanticProbeQueries,
        rerankQuery,
      )
      consultRows(result.matches)
      return registerEvidence({
        ...result,
        anchorEvidenceIds: normalized.anchorEvidenceIds,
        operation: 'memory_bridge',
        primaryProbe: normalized.probes[0],
        probeCount: normalized.probes.length,
        probes: normalized.probes,
        rerankConditioning: {
          anchorEvidenceIds: normalized.anchorEvidenceIds,
          applied: result.rerankCandidates > 0,
          mode: capabilities.reranking
            ? 'question_anchor_probe'
            : 'none',
          queryChars: rerankQuery?.length ?? 0,
        },
        ...(trustedTimeRange
          ? { effectiveTimeRange: trustedTimeRange }
          : {}),
      })
    },
    memory_find(input) {
      const found = brain.exploreFind(scope, applyTrustedTimeRange(input))
      consultRows(found.matches)
      return registerEvidence({
        ...found,
        ...(trustedTimeRange
          ? { effectiveTimeRange: trustedTimeRange }
          : {}),
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
      const supplementalRankedQueries = expandPlannedSearches
        ? [
            { phrase: question, surface: 'question' },
            { phrase: retrievalPlan?.anchor_event, surface: 'plan-anchor' },
            { phrase: retrievalPlan?.category, surface: 'plan-category' },
          ]
        : []
      const result = await hybridSearch(
        brain,
        scope,
        capabilities,
        applyTrustedTimeRange(input),
        referenceTime,
        supplementalRankedQueries,
      )
      consultRows(result.matches)
      return registerEvidence({
        ...result,
        ...(trustedTimeRange
          ? { effectiveTimeRange: trustedTimeRange }
          : {}),
      })
    },
    memory_timeline(input) {
      const result = brain.exploreTimeline(
        scope,
        applyTrustedTimeRange(input),
      )
      return trustedTimeRange
        ? deepFreeze({ ...result, effectiveTimeRange: trustedTimeRange })
        : result
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
      if (name === 'memory_bridge' && !iterativeRetrieval) {
        throw new TypeError('Unknown memory tool: memory_bridge')
      }
      const planning = name === MEMORY_RETRIEVAL_PLAN_TOOL_NAME
      if (!planning && calls >= budget) {
        exhausted = true
        frontier.refuseForBudget({
          input: request?.input ?? {},
          tool: name,
        })
        return {
          exhausted: true,
          reason: 'retrieval_budget_exhausted',
        }
      }
      if (!planning) calls += 1
      const input = request?.input ?? {}
      let result = await tools[name](input)
      if (!planning) {
        frontier.record({ input, result, tool: name })
        if (name === 'memory_bridge') {
          result = deepFreeze({
            ...result,
            retrievalFrontier: frontier.snapshot({ retrievalOpen }),
          })
        }
      }
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
      answerEnumerationRequired: enumerationRequired,
      answerRecommendationRequired: false,
      answerSupportingEvidenceOnly: supportingEvidenceOnly,
      answerInstructions,
      briefing,
      memoryText: briefing.text,
      maxRetrievalCalls: budget,
      maxRetrievalPlanningCalls: 1,
      markRetrievalAnchors: (evidenceIds) =>
        frontier.markAnchors(evidenceIds),
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
      retrievalFrontier: () => frontier.snapshot({ retrievalOpen }),
      retrievalTools: iterativeRetrieval
        ? MEMORY_ITERATIVE_RETRIEVAL_TOOLS
        : MEMORY_RETRIEVAL_TOOLS,
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
  const answerEnumeration = answerCommitted && enumerationRequired
    ? response.enumeration
    : null
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
  const retrievalFrontier = frontier.snapshot({
    retrievalOpen: false,
    selectedEvidenceIds,
  })
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
    answerCompositionMode: resolvedCompositionMode,
    answerEnumeration,
    // Compatibility tombstone for the removed dual recommendation surface.
    answerRecommendation: null,
    answerEvidence,
    ...(acceptedCurrentEvidenceReview
      ? { currentEvidenceReview: acceptedCurrentEvidenceReview }
      : {}),
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
    retrievalFrontier,
    retrievalTranscript: transcript,
    selectedEvidenceIds,
    temporaryInferences,
  }
}

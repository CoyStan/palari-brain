// Provider-neutral, session-ephemeral retrieval-plan contract.
//
// A plan narrows temporal or relational navigation. It never becomes evidence,
// never creates a durable write, and does not consume the retrieval-call budget.

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

// Capture validation intrinsics before provider code can run in this realm.
const arrayIsArray = Array.isArray
const dateConstructor = Date
const dateGetTime = Function.call.bind(Date.prototype.getTime)
const dateToISOString = Function.call.bind(Date.prototype.toISOString)
const numberConstructor = Number
const numberIsNaN = Number.isNaN
const objectFreeze = Object.freeze
const objectGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor
const objectGetPrototypeOf = Object.getPrototypeOf
const objectHasOwn = Object.hasOwn
const objectIsFrozen = Object.isFrozen
const objectValues = Object.values
const reflectOwnKeys = Reflect.ownKeys
const regexpExec = Function.call.bind(RegExp.prototype.exec)
const stringIncludes = Function.call.bind(String.prototype.includes)
const stringTrim = Function.call.bind(String.prototype.trim)
const structuredCloneValue = globalThis.structuredClone

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

export function normalizeRetrievalPlanInstant(value, label) {
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
  if (!supported) {
    throw retrievalPlanError('Retrieval plan relation is unsupported.')
  }
  const after = normalizeRetrievalPlanInstant(
    snapshot.time_range.after,
    'Retrieval plan time_range.after',
  )
  const before = normalizeRetrievalPlanInstant(
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

export function normalizeTrustedRetrievalTimeRange(value) {
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
  'For a personalized recommendation, retrieve both the current situational constraints and at least one direct user preference relevant to the recommendation category. If no relevant preference is found, say that the result is not personalized rather than inventing one.',
  'A relevant prior Palari answer may reveal the vocabulary or source session for user-specific resources, preferences, goals, relationships, or preparations, but it is navigation rather than proof. When such a Palari row is returned and retrieval budget remains, read its source session with memory_read before answering so the direct user context can support the answer. If that session does not recover the needed user evidence, continue through memory_bridge. Do not expand a generic prior Palari answer that contains no user-specific claim relevant to the question.',
  'For a total, count, or supposedly complete list, one relevance-ranked result is not exhaustive. Use complementary bounded searches inside the planned time range; if completeness is still unproven, report a partial result or insufficient evidence instead of a definitive total.',
  'Do not transfer a value across mismatched named people, places, objects, or relationships. Evidence about a different named entity may justify insufficiency or non-use, but cannot answer the requested entity.',
  'Select each returned memory at most once in an answer commitment. Omit unrelated rows. When one message supports several points, combine its contributions in one used-memory entry.',
].join(' ')

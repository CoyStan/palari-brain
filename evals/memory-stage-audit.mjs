// Provider-free memory-stage classification.
//
// This module does not retrieve, answer, grade prose, or call a model. It
// combines canonical-presence observations, the existing retrieval/use
// telemetry, and explicit answer/ambiguity judgments to identify the earliest
// observed stage that failed. Missing judgments remain `ungraded`; absence of
// a label is never converted into success or failure.

import {
  measureRetrievalEvidence,
} from './retrieval-evidence-metrics.mjs'

export const MEMORY_STAGE_AUDIT_SCHEMA =
  'palari-memory-stage-audit/v1'

export const MEMORY_STAGE_CLASSIFICATIONS = Object.freeze([
  'write',
  'retrieval',
  'composition',
  'utilization',
  'ambiguity',
  'success',
  'ungraded',
])

function auditError(message) {
  const error = new TypeError(message)
  error.code = 'MEMORY_STAGE_AUDIT_INVALID'
  return error
}

function plainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function uniqueStrings(values, label) {
  if (!Array.isArray(values)) throw auditError(`${label} must be an array.`)
  const result = []
  const seen = new Set()
  for (const value of values) {
    if (typeof value !== 'string' || !value.trim()) {
      throw auditError(`${label} must contain non-empty strings.`)
    }
    const normalized = value.trim()
    if (seen.has(normalized)) {
      throw auditError(`${label} contains a duplicate.`)
    }
    seen.add(normalized)
    result.push(normalized)
  }
  return Object.freeze(result)
}

function judgedValue(value, {
  field,
  label,
} = {}) {
  if (value === undefined || value === null) {
    return Object.freeze({
      [field]: null,
      judged: false,
      labelAuthority: 'ungraded',
      rationale: '',
    })
  }
  if (!plainObject(value)) throw auditError(`${label} must be an object.`)
  const keys = Object.keys(value).sort()
  const allowed = [field, 'labelAuthority', 'rationale'].sort()
  if (
    keys.length < 2 || keys.length > 3 ||
    !keys.every((key) => allowed.includes(key)) ||
    !Object.hasOwn(value, field) ||
    !Object.hasOwn(value, 'labelAuthority')
  ) {
    throw auditError(`${label} has unsupported or missing fields.`)
  }
  if (typeof value[field] !== 'boolean') {
    throw auditError(`${label}.${field} must be boolean.`)
  }
  const labelAuthority = String(value.labelAuthority ?? '').trim()
  if (!labelAuthority) {
    throw auditError(`${label}.labelAuthority must be non-empty.`)
  }
  return Object.freeze({
    [field]: value[field],
    judged: true,
    labelAuthority,
    rationale: Object.hasOwn(value, 'rationale')
      ? String(value.rationale ?? '').trim()
      : '',
  })
}

function missingFrom(required, observed) {
  const observedSet = observed instanceof Set ? observed : new Set(observed)
  return Object.freeze(required.filter((id) => !observedSet.has(id)))
}

function materialUseById(values = []) {
  const result = new Map()
  for (const value of values) {
    if (!plainObject(value)) continue
    const evidenceId = String(value.evidenceId ?? '').trim()
    if (evidenceId) result.set(evidenceId, value.materiallyUsed)
  }
  return result
}

function classification({
  ambiguityJudgment,
  answerJudgment,
  canonicalSessionPresenceJudged,
  expectedSessionIds,
  missingCanonicalIds,
  missingCanonicalSessionIds,
  missingMaterialJudgmentIds,
  missingMaterialUseIds,
  missingReturnedIds,
  missingReturnedSessionIds,
  missingSelectedIds,
} = {}) {
  if (missingCanonicalIds.length || missingCanonicalSessionIds.length) {
    return {
      reason: 'Required evidence was not present in canonical memory.',
      stage: 'write',
    }
  }
  if (expectedSessionIds.length && !canonicalSessionPresenceJudged) {
    return {
      reason: 'Canonical presence has not been observed for every required session.',
      stage: 'ungraded',
    }
  }
  if (missingReturnedIds.length || missingReturnedSessionIds.length) {
    return {
      reason: 'Canonical required evidence was not returned by retrieval.',
      stage: 'retrieval',
    }
  }
  if (missingSelectedIds.length) {
    return {
      reason: 'Returned required evidence was not assembled into the selected set.',
      stage: 'composition',
    }
  }
  if (!ambiguityJudgment.judged) {
    return {
      reason: 'Outcome ambiguity has not been judged.',
      stage: 'ungraded',
    }
  }
  if (ambiguityJudgment.ambiguous) {
    return {
      reason: 'The evidence or expected outcome was explicitly judged ambiguous.',
      stage: 'ambiguity',
    }
  }
  if (!answerJudgment.judged) {
    return {
      reason: 'Answer correctness has not been judged.',
      stage: 'ungraded',
    }
  }
  if (!answerJudgment.correct) {
    return {
      reason: 'The complete selected evidence set did not produce a correct answer.',
      stage: 'utilization',
    }
  }
  if (missingMaterialJudgmentIds.length) {
    return {
      reason: 'Material use has not been judged for every required evidence row.',
      stage: 'ungraded',
    }
  }
  if (missingMaterialUseIds.length) {
    return {
      reason: 'At least one required selected evidence row was not materially used.',
      stage: 'utilization',
    }
  }
  return {
    reason: 'Required evidence was stored, returned, selected, used, and answered correctly.',
    stage: 'success',
  }
}

export function classifyMemoryStageCase(value = {}) {
  if (!plainObject(value)) throw auditError('case must be an object.')
  const id = String(value.id ?? '').trim()
  if (!id) throw auditError('case.id is required.')
  if (!plainObject(value.trace)) throw auditError('case.trace must be an object.')

  const requiredEvidenceIds = uniqueStrings(
    value.requiredEvidenceIds ?? [],
    'case.requiredEvidenceIds',
  )
  const canonicalEvidenceIds = uniqueStrings(
    value.canonicalEvidenceIds ?? [],
    'case.canonicalEvidenceIds',
  )
  const expectedSessionIds = uniqueStrings(
    value.expectedSessionIds ?? [],
    'case.expectedSessionIds',
  )
  const canonicalSessionPresenceJudged =
    Object.hasOwn(value, 'canonicalSessionIds')
  const canonicalSessionIds = uniqueStrings(
    value.canonicalSessionIds ?? [],
    'case.canonicalSessionIds',
  )
  const materialUseJudgments = value.materialUseJudgments ?? []
  const metrics = measureRetrievalEvidence({
    equivalentFactJudgments: value.equivalentFactJudgments ?? [],
    expectedEvidenceIds: requiredEvidenceIds,
    expectedSessionIds,
    materialUseJudgments,
    trace: value.trace,
  })
  const answerJudgment = judgedValue(value.answerJudgment, {
    field: 'correct',
    label: 'case.answerJudgment',
  })
  const ambiguityJudgment = judgedValue(value.ambiguityJudgment, {
    field: 'ambiguous',
    label: 'case.ambiguityJudgment',
  })

  const selectedSet = new Set(metrics.selectedEvidence.selectedIds)
  const materialById = materialUseById(materialUseJudgments)
  const missingCanonicalIds = missingFrom(
    requiredEvidenceIds,
    canonicalEvidenceIds,
  )
  const missingCanonicalSessionIds = canonicalSessionPresenceJudged
    ? missingFrom(expectedSessionIds, canonicalSessionIds)
    : Object.freeze([])
  const missingReturnedIds = metrics.exactSpanRecall.missingIds
  const missingReturnedSessionIds = metrics.sessionRecall.missingIds
  const missingSelectedIds = missingFrom(requiredEvidenceIds, selectedSet)
  const missingMaterialJudgmentIds = Object.freeze(
    requiredEvidenceIds.filter((id) => !materialById.has(id)),
  )
  const missingMaterialUseIds = Object.freeze(
    requiredEvidenceIds.filter((id) => materialById.get(id) === false),
  )
  const result = classification({
    ambiguityJudgment,
    answerJudgment,
    canonicalSessionPresenceJudged,
    expectedSessionIds,
    missingCanonicalIds,
    missingCanonicalSessionIds,
    missingMaterialJudgmentIds,
    missingMaterialUseIds,
    missingReturnedIds,
    missingReturnedSessionIds,
    missingSelectedIds,
  })

  return Object.freeze({
    ambiguityJudgment,
    answerJudgment,
    canonicalSessionIds,
    canonicalSessionPresenceJudged,
    expectedSessionIds,
    id,
    metrics,
    missingCanonicalIds,
    missingCanonicalSessionIds,
    missingMaterialJudgmentIds,
    missingMaterialUseIds,
    missingReturnedIds,
    missingReturnedSessionIds,
    missingSelectedIds,
    reason: result.reason,
    requiredEvidenceIds,
    stage: result.stage,
  })
}

export function buildMemoryStageAudit(cases = []) {
  if (!Array.isArray(cases) || cases.length === 0) {
    throw auditError('cases must be a non-empty array.')
  }
  const classified = cases.map((entry) => classifyMemoryStageCase(entry))
  const ids = new Set()
  for (const entry of classified) {
    if (ids.has(entry.id)) throw auditError('cases contain a duplicate id.')
    ids.add(entry.id)
  }
  const counts = Object.fromEntries(
    MEMORY_STAGE_CLASSIFICATIONS.map((stage) => [stage, 0]),
  )
  for (const entry of classified) counts[entry.stage] += 1
  return Object.freeze({
    caseCount: classified.length,
    cases: Object.freeze(classified),
    counts: Object.freeze(counts),
    mode: 'provider-free-diagnostic-not-a-benchmark',
    networkCalls: 0,
    providerCalls: 0,
    schema: MEMORY_STAGE_AUDIT_SCHEMA,
  })
}

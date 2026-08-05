// Provider-free retrieval/use telemetry.
//
// Session and exact-span recall are trace observations. Selection is a
// host-accepted commitment observation. Equivalent-fact and material-use
// values enter only as explicit judged labels and remain labelled as such;
// this module never promotes either judgment to canonical memory truth.

function metricError(message) {
  const error = new TypeError(message)
  error.code = 'RETRIEVAL_EVIDENCE_METRIC_INVALID'
  return error
}

function plainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function uniqueStrings(values, label) {
  if (!Array.isArray(values)) throw metricError(`${label} must be an array.`)
  const result = []
  const seen = new Set()
  for (const value of values) {
    if (typeof value !== 'string' || !value.trim()) {
      throw metricError(`${label} must contain non-empty strings.`)
    }
    const text = value.trim()
    if (seen.has(text)) throw metricError(`${label} contains a duplicate.`)
    seen.add(text)
    result.push(text)
  }
  return Object.freeze(result)
}

function judgedLabels(values, {
  idField,
  label,
  valueField,
} = {}) {
  if (!Array.isArray(values)) throw metricError(`${label} must be an array.`)
  const labels = []
  const seen = new Set()
  for (const value of values) {
    if (!plainObject(value)) {
      throw metricError(`${label} must contain data objects.`)
    }
    const keys = Object.keys(value).sort()
    const allowed = [idField, valueField, 'rationale'].sort()
    if (keys.length < 2 || keys.length > 3 ||
      !keys.every((key) => allowed.includes(key)) ||
      !Object.hasOwn(value, idField) || !Object.hasOwn(value, valueField)) {
      throw metricError(`${label} has unsupported or missing fields.`)
    }
    const id = String(value[idField] ?? '').trim()
    if (!id || seen.has(id)) throw metricError(`${label} has an invalid ID.`)
    if (typeof value[valueField] !== 'boolean') {
      throw metricError(`${label}.${valueField} must be boolean.`)
    }
    const rationale = Object.hasOwn(value, 'rationale')
      ? String(value.rationale ?? '').trim()
      : ''
    seen.add(id)
    labels.push(Object.freeze({
      [idField]: id,
      judged: true,
      labelAuthority: 'judge',
      rationale,
      [valueField]: value[valueField],
    }))
  }
  return Object.freeze(labels)
}

function evidenceRows(trace) {
  const rows = []
  for (const entry of trace?.retrievalTranscript ?? []) {
    for (const key of ['matches', 'messages', 'edges']) {
      for (const row of entry?.result?.[key] ?? []) {
        if (row?.evidenceId) rows.push(row)
      }
    }
  }
  return rows
}

function ratio(found, total) {
  return total === 0 ? null : found / total
}

function recallMetric(expectedIds, observedSet) {
  const foundIds = expectedIds.filter((id) => observedSet.has(id))
  const missingIds = expectedIds.filter((id) => !observedSet.has(id))
  return Object.freeze({
    expected: expectedIds.length,
    found: foundIds.length,
    foundIds: Object.freeze(foundIds),
    missingIds: Object.freeze(missingIds),
    ratio: ratio(foundIds.length, expectedIds.length),
  })
}

export function measureRetrievalEvidence({
  equivalentFactJudgments = [],
  expectedEvidenceIds = [],
  expectedSessionIds = [],
  materialUseJudgments = [],
  trace,
} = {}) {
  if (!plainObject(trace)) throw metricError('trace must be a data object.')
  const expectedSessions = uniqueStrings(
    expectedSessionIds,
    'expectedSessionIds',
  )
  const expectedEvidence = uniqueStrings(
    expectedEvidenceIds,
    'expectedEvidenceIds',
  )
  const equivalentLabels = judgedLabels(equivalentFactJudgments, {
    idField: 'factId',
    label: 'equivalentFactJudgments',
    valueField: 'recalled',
  })
  const materialLabels = judgedLabels(materialUseJudgments, {
    idField: 'evidenceId',
    label: 'materialUseJudgments',
    valueField: 'materiallyUsed',
  })
  const rows = evidenceRows(trace)
  const returnedEvidence = new Set()
  const returnedSessions = new Set()
  for (const row of rows) {
    returnedEvidence.add(String(row.evidenceId))
    if (row.session) returnedSessions.add(String(row.session))
  }
  const selected = uniqueStrings(
    trace.selectedEvidenceIds ?? [],
    'trace.selectedEvidenceIds',
  )
  if (selected.length && trace.answerCommitted !== true) {
    throw metricError('Selected evidence requires a host-committed answer.')
  }
  for (const evidenceId of selected) {
    if (!returnedEvidence.has(evidenceId)) {
      throw metricError('Selected evidence was not returned by retrieval.')
    }
  }
  const selectedSet = new Set(selected)
  for (const label of materialLabels) {
    if (label.materiallyUsed && !selectedSet.has(label.evidenceId)) {
      throw metricError('Materially used evidence must first be selected.')
    }
  }

  const equivalentFound = equivalentLabels.filter((label) => label.recalled)
  const materiallyUsed = materialLabels.filter((label) => label.materiallyUsed)
  return Object.freeze({
    sessionRecall: recallMetric(expectedSessions, returnedSessions),
    exactSpanRecall: recallMetric(expectedEvidence, returnedEvidence),
    equivalentFactRecall: Object.freeze({
      expected: equivalentLabels.length,
      found: equivalentFound.length,
      judged: true,
      labelAuthority: 'judge',
      labels: equivalentLabels,
      ratio: ratio(equivalentFound.length, equivalentLabels.length),
    }),
    selectedEvidence: Object.freeze({
      returned: returnedEvidence.size,
      selected: selected.length,
      selectedIds: selected,
      ratio: ratio(selected.length, returnedEvidence.size),
    }),
    materiallyUsedEvidence: Object.freeze({
      judged: true,
      judgedEvidence: materialLabels.length,
      labelAuthority: 'judge',
      labels: materialLabels,
      selected: selected.length,
      used: materiallyUsed.length,
      ratio: ratio(materiallyUsed.length, materialLabels.length),
    }),
  })
}

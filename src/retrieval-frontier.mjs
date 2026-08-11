// Ephemeral retrieval progress and evidence-lineage accounting.
//
// The frontier records only routing metadata for one answer journey. It never
// writes durable memory and never treats search results as answer evidence.

export const MEMORY_RETRIEVAL_FRONTIER_SCHEMA =
  'palari-retrieval-frontier/v2'
export const MEMORY_RETRIEVAL_FRONTIER_STAGNANT_ROUNDS = 2

const FRONTIER_WHITESPACE = /\s+/gu
const INFORMATION_APOSTROPHES = /[\u2018\u2019]/gu
const INFORMATION_DASHES = /[\u2010-\u2015]/gu
const INFORMATION_QUOTES = /[\u201c\u201d\u201e]/gu
const INFORMATION_TRAILING_PERIOD = /\.$/u

// Capture the collection and normalization intrinsics used after provider
// code starts running in this realm.
const arrayIsArray = Array.isArray
const arrayJoin = Function.call.bind(Array.prototype.join)
const arrayPush = Function.call.bind(Array.prototype.push)
const mapConstructor = Map
const mapGet = Function.call.bind(Map.prototype.get)
const mapSet = Function.call.bind(Map.prototype.set)
const mathMax = Math.max
const objectFreeze = Object.freeze
const objectIsFrozen = Object.isFrozen
const objectValues = Object.values
const setAdd = Function.call.bind(Set.prototype.add)
const setConstructor = Set
const setHas = Function.call.bind(Set.prototype.has)
const stringFrom = String
const stringNormalize = Function.call.bind(String.prototype.normalize)
const stringReplace = Function.call.bind(String.prototype.replace)
const stringToLowerCase = Function.call.bind(String.prototype.toLowerCase)
const stringTrim = Function.call.bind(String.prototype.trim)

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

export function evidenceRows(result) {
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

export function evidenceTexts(result) {
  const rows = evidenceRows(result)
  const evidence = []
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    const evidenceId = stringTrim(stringFrom(row?.evidenceId ?? ''))
    const text = informationText(row)
    if (evidenceId && text) arrayPush(evidence, { evidenceId, text })
  }
  return evidence
}

export function frontierText(value) {
  if (typeof value !== 'string') return ''
  return stringReplace(
    stringToLowerCase(stringTrim(value)),
    FRONTIER_WHITESPACE,
    ' ',
  )
}

function informationText(row) {
  return typeof row?.text === 'string'
    ? row.text
    : typeof row?.snippet === 'string'
      ? row.snippet
      : typeof row?.quote === 'string'
        ? row.quote
        : ''
}

export function normalizedInformationText(value) {
  let normalized = stringNormalize(stringFrom(value ?? ''), 'NFC')
  normalized = stringReplace(normalized, INFORMATION_APOSTROPHES, "'")
  normalized = stringReplace(normalized, INFORMATION_QUOTES, '"')
  normalized = stringReplace(normalized, INFORMATION_DASHES, '-')
  normalized = frontierText(normalized)
  return stringReplace(normalized, INFORMATION_TRAILING_PERIOD, '')
}

export function informationIdentity(row) {
  const text = informationText(row)
  const normalizedText = normalizedInformationText(text)
  if (!normalizedText) return null
  const speaker = frontierText(row?.speaker)
  const authorId = stringTrim(stringFrom(row?.authorId ?? ''))
  const observedAt = stringTrim(stringFrom(row?.observedAt ?? ''))
  return {
    authorId,
    key: arrayJoin([
      speaker,
      authorId,
      observedAt,
      normalizedText,
    ], '\u0000'),
    observedAt,
    speaker,
    text,
  }
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

export function createEphemeralRetrievalFrontier(maxRetrievalCalls) {
  const seenEvidenceSet = new setConstructor()
  const seenEvidenceIds = []
  const bridgeEligibleEvidenceSet = new setConstructor()
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
      setAdd(bridgeEligibleEvidenceSet, evidenceId)
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

  const seedBridgeEligibility = (values) => {
    if (!arrayIsArray(values)) {
      throw new TypeError(
        'Retrieval frontier bridge eligibility must be an array of evidence IDs.',
      )
    }
    for (let index = 0; index < values.length; index += 1) {
      const evidenceId = stringTrim(stringFrom(values[index] ?? ''))
      if (!evidenceId) {
        throw new TypeError(
          'Retrieval frontier bridge eligibility requires non-empty evidence IDs.',
        )
      }
      setAdd(bridgeEligibleEvidenceSet, evidenceId)
    }
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
      if (!evidenceId || !setHas(bridgeEligibleEvidenceSet, evidenceId)) {
        const error = new TypeError(
          'Retrieval frontier anchors must already exist in canonical briefing or returned evidence.',
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

  return {
    markAnchors,
    record,
    refuseForBudget,
    seedBridgeEligibility,
    snapshot,
  }
}

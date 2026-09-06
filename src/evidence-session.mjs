// Host-owned canonical evidence returned during one answer. Routing anchors
// are deliberately separate: their presence cannot authorize a citation.
import { evidenceRows, evidenceTexts, informationIdentity } from './retrieval-frontier.mjs'
const mapGet = Function.call.bind(Map.prototype.get)
const mapSet = Function.call.bind(Map.prototype.set)
const arrayPush = Function.call.bind(Array.prototype.push)
const setAdd = Function.call.bind(Set.prototype.add)
const setHas = Function.call.bind(Set.prototype.has)
const setConstructor = Set
const stringFrom = String
const stringTrim = Function.call.bind(String.prototype.trim)
const stringToLowerCase = Function.call.bind(String.prototype.toLowerCase)
const numberConstructor = Number
const numberIsSafeInteger = Number.isSafeInteger
const objectFreeze = Object.freeze
function frozenCopy(rows, copyRow = (row) => row) {
  const copy = []
  for (let index = 0; index < rows.length; index += 1) {
    arrayPush(copy, copyRow(rows[index]))
  }
  return objectFreeze(copy)
}

export function createEvidenceSession() {
  const evidenceRegistry = new Map()
  const briefingAnchorRegistry = new Map()
  const evidenceRegistryIds = []
  const evidenceInformationIndex = new Map()
  const returnedInformationKeySet = new setConstructor()
  const returnedInformationKeys = []
  const evidenceReviewIndex = new Map()
  const evidenceReviewRows = []
  let evidenceCount = 0
  let ids = objectFreeze([])
  let informationKeys = objectFreeze([])
  let reviewRows = objectFreeze([])
  const register = (result) => {
    for (const { evidenceId, text } of evidenceTexts(result)) {
      const current = mapGet(evidenceRegistry, evidenceId)
      const texts = current ?? []
      if (!current) {
        evidenceCount += 1
        arrayPush(evidenceRegistryIds, evidenceId)
      }
      arrayPush(texts, text)
      mapSet(evidenceRegistry, evidenceId, texts)
    }
    const rows = evidenceRows(result)
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index]
      const evidenceId = stringTrim(stringFrom(row?.evidenceId ?? ''))
      const identity = informationIdentity(row)
      if (evidenceId && identity) {
        mapSet(evidenceInformationIndex, evidenceId, identity)
        if (!setHas(returnedInformationKeySet, identity.key)) {
          setAdd(returnedInformationKeySet, identity.key)
          arrayPush(returnedInformationKeys, identity.key)
        }
      }
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
    ids = frozenCopy(evidenceRegistryIds)
    informationKeys = frozenCopy(returnedInformationKeys)
    reviewRows = frozenCopy(evidenceReviewRows, (row) => objectFreeze({ ...row }))
    return result
  }

  return objectFreeze({
    register,
    get count() { return evidenceCount },
    get ids() { return ids },
    get informationKeys() { return informationKeys },
    get reviewRows() { return reviewRows },
    sources(id) {
      const rows = mapGet(evidenceRegistry, id)
      return rows ? frozenCopy(rows) : undefined
    },
    identity(id) {
      const row = mapGet(evidenceInformationIndex, id)
      return row ? objectFreeze({ ...row }) : undefined
    },
    addRoutingAnchor(id, text) { mapSet(briefingAnchorRegistry, id, [text]) },
    routingSources(id) {
      const rows = mapGet(evidenceRegistry, id) ?? mapGet(briefingAnchorRegistry, id)
      return rows ? frozenCopy(rows) : undefined
    },
  })
}

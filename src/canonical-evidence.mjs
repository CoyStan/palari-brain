// Provider-neutral seam for a host that already owns canonical dialogue.
//
// Palari Brain does not persist or authorize these rows. The host reads one
// authorized scope from its canonical store and returns this small, versioned
// envelope. Brain validates provenance before it renders a recall briefing.

import { createHash } from 'node:crypto'
import { isProxy } from 'node:util/types'

import { buildMemoryBriefing } from './brain.mjs'

export const canonicalEvidenceContractVersion =
  'palari-canonical-evidence/v1'

export const canonicalEvidenceLimits = Object.freeze({
  defaultRows: 500,
  maxRows: 2_000,
})

const batchKeys = Object.freeze([
  'contractVersion',
  'hasMore',
  'rows',
  'scope',
])

const scopeKeys = Object.freeze([
  'palariId',
  'workspaceId',
])

const rowKeys = Object.freeze([
  'authorPalariId',
  'authorType',
  'authorUserId',
  'authorWorkspaceMembershipId',
  'content',
  'conversationId',
  'conversationOrdinal',
  'createdAt',
  'initiatingUserId',
  'initiatingWorkspaceMembershipId',
  'messageId',
  'messageVersion',
  'palariId',
  'updatedAt',
  'workspaceId',
])

const controlCharacters = /[\u0000-\u001f\u007f-\u009f]/u
const timestampPattern = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.)(\d{3})(\d{3})Z$/u

function invalid(message) {
  const error = new TypeError(message)
  error.code = 'CANONICAL_EVIDENCE_INVALID'
  return error
}

function isOrdinaryRecord(value) {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    isProxy(value)
  ) {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function exactKeys(value, expected, label) {
  if (!isOrdinaryRecord(value)) {
    throw invalid(`${label} must be an object.`)
  }
  const actual = Reflect.ownKeys(value)
  const required = [...expected].sort()
  if (
    actual.length !== required.length ||
    actual.some((key) => typeof key !== 'string' || !required.includes(key)) ||
    required.some((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      return !descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')
    })
  ) {
    throw invalid(`${label} has an unsupported field shape.`)
  }
}

function roundTrippableText(value, label) {
  if (typeof value !== 'string') {
    throw invalid(`${label} must be a string.`)
  }
  if (value.includes('\u0000') || Buffer.from(value, 'utf8').toString('utf8') !== value) {
    throw invalid(`${label} is not losslessly UTF-8 round-trippable.`)
  }
  return value
}

function identifier(value, label) {
  const text = roundTrippableText(value, label)
  if (
    !text ||
    text.trim() !== text ||
    text.normalize('NFC') !== text ||
    controlCharacters.test(text)
  ) {
    throw invalid(`${label} must be a non-empty exact identifier.`)
  }
  return text
}

function nullableIdentifier(value, label) {
  return value === null ? null : identifier(value, label)
}

function positiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw invalid(`${label} must be a positive safe integer.`)
  }
  return value
}

function isoTimestamp(value, label) {
  const text = roundTrippableText(value, label)
  const match = timestampPattern.exec(text)
  const millisecondsText = match
    ? `${match[1]}${match[2]}Z`
    : ''
  const timestamp = Date.parse(millisecondsText)
  if (!match || !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString() !== millisecondsText) {
    throw invalid(`${label} must be a canonical microsecond ISO timestamp.`)
  }
  return text
}

function timestampMicros(value) {
  const match = timestampPattern.exec(value)
  const milliseconds = Date.parse(`${match[1]}${match[2]}Z`)
  return BigInt(milliseconds) * 1_000n + BigInt(match[3])
}

function normalizedScope(value, label = 'scope') {
  exactKeys(value, scopeKeys, label)
  return Object.freeze({
    palariId: identifier(value.palariId, `${label}.palariId`),
    workspaceId: identifier(value.workspaceId, `${label}.workspaceId`),
  })
}

function sameScope(left, right) {
  return left.palariId === right.palariId &&
    left.workspaceId === right.workspaceId
}

function compareRows(left, right) {
  const timeDifference = timestampMicros(left.createdAt) -
    timestampMicros(right.createdAt)
  if (timeDifference) return timeDifference < 0n ? -1 : 1
  const conversationDifference = Buffer.compare(
    Buffer.from(left.conversationId, 'utf8'),
    Buffer.from(right.conversationId, 'utf8'),
  )
  if (conversationDifference) return conversationDifference
  const ordinalDifference = left.conversationOrdinal - right.conversationOrdinal
  if (ordinalDifference) return ordinalDifference
  return Buffer.compare(
    Buffer.from(left.messageId, 'utf8'),
    Buffer.from(right.messageId, 'utf8'),
  )
}

function normalizeRow(value, scope, index) {
  const label = `rows[${index}]`
  exactKeys(value, rowKeys, label)
  const rowScope = normalizedScope({
    palariId: value.palariId,
    workspaceId: value.workspaceId,
  }, label)
  if (!sameScope(rowScope, scope)) {
    throw invalid(`${label} is outside the requested scope.`)
  }

  const row = {
    authorPalariId: nullableIdentifier(
      value.authorPalariId,
      `${label}.authorPalariId`,
    ),
    authorType: roundTrippableText(value.authorType, `${label}.authorType`),
    authorUserId: nullableIdentifier(
      value.authorUserId,
      `${label}.authorUserId`,
    ),
    authorWorkspaceMembershipId: nullableIdentifier(
      value.authorWorkspaceMembershipId,
      `${label}.authorWorkspaceMembershipId`,
    ),
    content: roundTrippableText(value.content, `${label}.content`),
    conversationId: identifier(value.conversationId, `${label}.conversationId`),
    conversationOrdinal: positiveInteger(
      value.conversationOrdinal,
      `${label}.conversationOrdinal`,
    ),
    createdAt: isoTimestamp(value.createdAt, `${label}.createdAt`),
    initiatingUserId: nullableIdentifier(
      value.initiatingUserId,
      `${label}.initiatingUserId`,
    ),
    initiatingWorkspaceMembershipId: nullableIdentifier(
      value.initiatingWorkspaceMembershipId,
      `${label}.initiatingWorkspaceMembershipId`,
    ),
    messageId: identifier(value.messageId, `${label}.messageId`),
    messageVersion: positiveInteger(value.messageVersion, `${label}.messageVersion`),
    palariId: rowScope.palariId,
    updatedAt: isoTimestamp(value.updatedAt, `${label}.updatedAt`),
    workspaceId: rowScope.workspaceId,
  }
  if (!row.content.trim()) {
    throw invalid(`${label}.content must contain visible dialogue.`)
  }
  if (timestampMicros(row.updatedAt) < timestampMicros(row.createdAt)) {
    throw invalid(`${label}.updatedAt cannot precede createdAt.`)
  }

  if (row.authorType === 'human') {
    if (
      !row.authorUserId ||
      !row.authorWorkspaceMembershipId ||
      row.authorPalariId !== null ||
      row.initiatingUserId !== null ||
      row.initiatingWorkspaceMembershipId !== null
    ) {
      throw invalid(`${label} has invalid human attribution.`)
    }
  } else if (row.authorType === 'palari') {
    if (
      row.authorUserId !== null ||
      row.authorWorkspaceMembershipId !== null ||
      row.authorPalariId !== scope.palariId ||
      !row.initiatingUserId ||
      !row.initiatingWorkspaceMembershipId
    ) {
      throw invalid(`${label} has invalid Palari attribution.`)
    }
  } else {
    throw invalid(`${label}.authorType must be human or palari.`)
  }

  return Object.freeze(row)
}

function statementFromRow(row) {
  const sourceKind = row.authorType === 'human'
    ? 'user_message'
    : 'assistant_message'
  return Object.freeze({
    ...(row.authorUserId === null ? {} : { author_id: row.authorUserId }),
    author_palari_id: row.authorPalariId,
    author_workspace_membership_id: row.authorWorkspaceMembershipId,
    content: row.content,
    content_sha256: createHash('sha256').update(row.content, 'utf8').digest('hex'),
    contract_version: canonicalEvidenceContractVersion,
    conversation_id: row.conversationId,
    conversation_ordinal: row.conversationOrdinal,
    created_at: row.createdAt,
    evidence_kind: 'canonical_message',
    extractor: '',
    fictional: 0,
    id: row.messageId,
    initiating_user_id: row.initiatingUserId,
    initiating_workspace_membership_id: row.initiatingWorkspaceMembershipId,
    message_version: row.messageVersion,
    palari_id: row.palariId,
    record_kind: 'canonical_message',
    source_kind: sourceKind,
    source_message_id: row.messageId,
    type: '',
    updated_at: row.updatedAt,
    valid_from: row.createdAt,
    workspace_id: row.workspaceId,
  })
}

export function normalizeCanonicalEvidenceBatch(batch, scopeInput, {
  maxRows,
} = {}) {
  exactKeys(batch, batchKeys, 'batch')
  if (batch.contractVersion !== canonicalEvidenceContractVersion) {
    throw invalid('batch.contractVersion is unsupported.')
  }
  if (typeof batch.hasMore !== 'boolean' || !Array.isArray(batch.rows)) {
    throw invalid('batch must contain boolean hasMore and array rows.')
  }
  const requestedScope = normalizedScope(scopeInput, 'requestedScope')
  const batchScope = normalizedScope(batch.scope, 'batch.scope')
  const limit = maxRows === undefined
    ? canonicalEvidenceLimits.maxRows
    : boundedRows(maxRows)
  if (!sameScope(requestedScope, batchScope)) {
    throw invalid('batch.scope does not match the requested scope.')
  }
  if (batch.rows.length > limit) {
    throw invalid('batch exceeds the requested row limit.')
  }

  const rows = batch.rows.map((row, index) =>
    normalizeRow(row, requestedScope, index))
  const messageIds = new Set()
  const conversationOrdinals = new Set()
  const lastOrdinalByConversation = new Map()
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    if (index > 0 && compareRows(rows[index - 1], row) > 0) {
      throw invalid('batch rows are not in canonical query order.')
    }
    if (messageIds.has(row.messageId)) {
      throw invalid('batch contains a duplicate canonical message ID.')
    }
    messageIds.add(row.messageId)
    const ordinalKey = `${row.conversationId}\u0000${row.conversationOrdinal}`
    if (conversationOrdinals.has(ordinalKey)) {
      throw invalid('batch contains a duplicate conversation ordinal.')
    }
    conversationOrdinals.add(ordinalKey)
    const priorOrdinal = lastOrdinalByConversation.get(row.conversationId) ?? 0
    if (row.conversationOrdinal <= priorOrdinal) {
      throw invalid('batch conversation ordering is not strictly increasing.')
    }
    lastOrdinalByConversation.set(row.conversationId, row.conversationOrdinal)
  }

  return Object.freeze({
    contractVersion: canonicalEvidenceContractVersion,
    hasMore: batch.hasMore,
    rows: Object.freeze(rows.map((row) => statementFromRow(row))),
    scope: requestedScope,
  })
}

function boundedRows(value) {
  const rows = value === undefined
    ? canonicalEvidenceLimits.defaultRows
    : value
  if (
    !Number.isSafeInteger(rows) ||
    rows < 1 ||
    rows > canonicalEvidenceLimits.maxRows
  ) {
    throw invalid(
      `maxRows must be an integer from 1 through ${canonicalEvidenceLimits.maxRows}.`,
    )
  }
  return rows
}

export function createCanonicalEvidenceSource({ read } = {}) {
  if (typeof read !== 'function') {
    throw new TypeError('Canonical evidence source requires a read function.')
  }
  return Object.freeze({
    async recall(scopeInput, { maxChars, maxRows } = {}) {
      const scope = normalizedScope(scopeInput)
      const limit = boundedRows(maxRows)
      const rawBatch = await read(Object.freeze({
        contractVersion: canonicalEvidenceContractVersion,
        limit,
        scope,
      }))
      const batch = normalizeCanonicalEvidenceBatch(rawBatch, scope, {
        maxRows: limit,
      })
      if (batch.hasMore) {
        return Object.freeze({
          atLeastCandidates: batch.rows.length + 1,
          briefingMode: 'canonical_external',
          chars: 0,
          complete: false,
          contractVersion: canonicalEvidenceContractVersion,
          included: Object.freeze([]),
          requiredChars: 0,
          status: 'evidence_incomplete',
          text: '',
          totalCandidates: null,
        })
      }
      const briefing = buildMemoryBriefing({
        ...(maxChars === undefined ? {} : { maxChars }),
        statements: batch.rows,
      })
      return Object.freeze({
        ...briefing,
        briefingMode: 'canonical_external',
        contractVersion: canonicalEvidenceContractVersion,
        included: Object.freeze(briefing.included.map((row) =>
          Object.freeze({ ...row }))),
      })
    },
  })
}

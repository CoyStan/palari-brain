import assert from 'node:assert/strict'
import test from 'node:test'

import {
  canonicalEvidenceContractVersion,
  canonicalEvidenceLimits,
  createCanonicalEvidenceSource,
  normalizeCanonicalEvidenceBatch,
} from '../src/canonical-evidence.mjs'

const scope = Object.freeze({
  palariId: 'palari-shared-1',
  workspaceId: 'workspace-shared-1',
})

function row(overrides = {}) {
  return {
    authorPalariId: null,
    authorType: 'human',
    authorUserId: 'user-alice',
    authorWorkspaceMembershipId: 'workspace-membership-alice',
    content: 'Alice keeps the blue notebook on shelf seven.',
    conversationId: 'conversation-a',
    conversationOrdinal: 1,
    createdAt: '2026-08-13T12:00:00.000000Z',
    initiatingUserId: null,
    initiatingWorkspaceMembershipId: null,
    messageId: 'message-a-1',
    messageVersion: 1,
    palariId: scope.palariId,
    updatedAt: '2026-08-13T12:00:00.000000Z',
    workspaceId: scope.workspaceId,
    ...overrides,
  }
}

function batch(rows, overrides = {}) {
  return {
    contractVersion: canonicalEvidenceContractVersion,
    hasMore: false,
    rows,
    scope,
    ...overrides,
  }
}

test('external canonical evidence preserves message identity, order, and authorship',
  async () => {
    const rows = [
      row(),
      row({
        authorPalariId: scope.palariId,
        authorType: 'palari',
        authorUserId: null,
        authorWorkspaceMembershipId: null,
        content: 'Palari records Alice\'s notebook location.',
        conversationOrdinal: 2,
        initiatingUserId: 'user-alice',
        initiatingWorkspaceMembershipId: 'workspace-membership-alice',
        messageId: 'message-a-2',
      }),
      row({
        authorUserId: 'user-bob',
        authorWorkspaceMembershipId: 'workspace-membership-bob',
        content: 'Bob keeps the copper notebook on shelf nine.',
        conversationId: 'conversation-b',
        createdAt: '2026-08-13T12:01:00.000000Z',
        messageId: 'message-b-1',
        updatedAt: '2026-08-13T12:01:00.000000Z',
      }),
    ]
    const reads = []
    const source = createCanonicalEvidenceSource({
      read: async (request) => {
        reads.push(request)
        return batch(rows)
      },
    })

    const recalled = await source.recall(scope, { maxRows: 10 })

    assert.deepEqual(reads, [{
      contractVersion: canonicalEvidenceContractVersion,
      limit: 10,
      scope,
    }])
    assert.equal(recalled.status, 'included')
    assert.equal(recalled.complete, true)
    assert.equal(recalled.briefingMode, 'canonical_external')
    assert.deepEqual(
      recalled.included.map((evidence) => ({
        authorId: evidence.authorId ?? null,
        id: evidence.id,
        sourceMessageId: evidence.sourceMessageId,
        speaker: evidence.speaker,
      })),
      [
        {
          authorId: 'user-alice',
          id: 'message-a-1',
          sourceMessageId: 'message-a-1',
          speaker: 'user',
        },
        {
          authorId: null,
          id: 'message-a-2',
          sourceMessageId: 'message-a-2',
          speaker: 'Palari',
        },
        {
          authorId: 'user-bob',
          id: 'message-b-1',
          sourceMessageId: 'message-b-1',
          speaker: 'user',
        },
      ],
    )
    assert.match(recalled.text, /Alice keeps the blue notebook/)
    assert.match(recalled.text, /"evidenceId":"message-a-1"/)
    assert.equal(Object.isFrozen(recalled.included), true)
    assert.equal(Object.isFrozen(recalled.included[0]), true)

    const normalized = normalizeCanonicalEvidenceBatch(batch(rows), scope, {
      maxRows: 10,
    })
    assert.equal(normalized.rows[0].id, 'message-a-1')
    assert.equal(normalized.rows[0].source_message_id, 'message-a-1')
    assert.equal(normalized.rows[0].author_workspace_membership_id,
      'workspace-membership-alice')
    assert.equal(Object.hasOwn(normalized.rows[0], 'dialogue_order'), false)
  })

test('a bounded source never presents a truncated journal as complete',
  async () => {
    const source = createCanonicalEvidenceSource({
      read: async () => batch([row()], { hasMore: true }),
    })

    const recalled = await source.recall(scope, { maxRows: 1 })

    assert.equal(recalled.status, 'evidence_incomplete')
    assert.equal(recalled.complete, false)
    assert.equal(recalled.text, '')
    assert.deepEqual(recalled.included, [])
    assert.equal(recalled.atLeastCandidates, 2)
  })

test('normalization rejects foreign scope, forged attribution, and false order', () => {
  const foreign = row({ workspaceId: 'workspace-foreign' })
  assert.throws(
    () => normalizeCanonicalEvidenceBatch(batch([foreign]), scope),
    { code: 'CANONICAL_EVIDENCE_INVALID' },
  )

  const forgedPalari = row({
    authorPalariId: scope.palariId,
    authorType: 'palari',
    initiatingUserId: 'user-alice',
    initiatingWorkspaceMembershipId: 'workspace-membership-alice',
  })
  assert.throws(
    () => normalizeCanonicalEvidenceBatch(batch([forgedPalari]), scope),
    { code: 'CANONICAL_EVIDENCE_INVALID' },
  )

  const reversed = [
    row({
      conversationOrdinal: 2,
      createdAt: '2026-08-13T12:00:00.000000Z',
      messageId: 'message-a-2',
      updatedAt: '2026-08-13T12:00:00.000000Z',
    }),
    row({
      createdAt: '2026-08-13T12:00:01.000000Z',
      updatedAt: '2026-08-13T12:00:01.000000Z',
    }),
  ]
  assert.throws(
    () => normalizeCanonicalEvidenceBatch(batch(reversed), scope),
    { code: 'CANONICAL_EVIDENCE_INVALID' },
  )

  const microsecondReversed = [
    row({
      createdAt: '2026-08-13T12:00:00.000002Z',
      messageId: 'message-micro-2',
      updatedAt: '2026-08-13T12:00:00.000002Z',
    }),
    row({
      conversationId: 'conversation-b',
      createdAt: '2026-08-13T12:00:00.000001Z',
      messageId: 'message-micro-1',
      updatedAt: '2026-08-13T12:00:00.000001Z',
    }),
  ]
  assert.throws(
    () => normalizeCanonicalEvidenceBatch(batch(microsecondReversed), scope),
    { code: 'CANONICAL_EVIDENCE_INVALID' },
  )
})

test('byte ordering matches PostgreSQL C collation at equal timestamps', () => {
  const at = '2026-08-13T12:00:00.000000Z'
  assert.throws(
    () => normalizeCanonicalEvidenceBatch(batch([
      row({
        conversationId: 'conversation-z',
        createdAt: at,
        messageId: 'message-z-1',
        updatedAt: at,
      }),
      row({
        conversationId: 'conversation-A',
        createdAt: at,
        messageId: 'message-A-1',
        updatedAt: at,
      }),
    ]), scope),
    { code: 'CANONICAL_EVIDENCE_INVALID' },
  )

  assert.throws(
    () => normalizeCanonicalEvidenceBatch(batch([
      row({ createdAt: at, messageId: 'message-z', updatedAt: at }),
      row({ createdAt: at, messageId: 'message-A', updatedAt: at }),
    ]), scope),
    { code: 'CANONICAL_EVIDENCE_INVALID' },
  )
})

test('the contract rejects unbounded reads and unsupported envelope fields',
  async () => {
    const source = createCanonicalEvidenceSource({ read: async () => batch([]) })
    await assert.rejects(
      source.recall(scope, { maxRows: canonicalEvidenceLimits.maxRows + 1 }),
      { code: 'CANONICAL_EVIDENCE_INVALID' },
    )
    await assert.rejects(
      source.recall(scope, { maxRows: '1' }),
      { code: 'CANONICAL_EVIDENCE_INVALID' },
    )
    assert.throws(
      () => normalizeCanonicalEvidenceBatch(
        batch([row(), row({ messageId: 'message-a-2' })]),
        scope,
        { maxRows: 1 },
      ),
      { code: 'CANONICAL_EVIDENCE_INVALID' },
    )
    assert.throws(
      () => normalizeCanonicalEvidenceBatch({
        ...batch([row()]),
        rawProviderPayload: 'not-allowed',
      }, scope),
      { code: 'CANONICAL_EVIDENCE_INVALID' },
    )
    const accessorBatch = batch([row()])
    Object.defineProperty(accessorBatch, 'hasMore', {
      enumerable: true,
      get: () => false,
    })
    assert.throws(
      () => normalizeCanonicalEvidenceBatch(accessorBatch, scope),
      { code: 'CANONICAL_EVIDENCE_INVALID' },
    )
  })

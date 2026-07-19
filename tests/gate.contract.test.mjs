// U4 contract tests — admission gate (KERNEL-API §4; contract C2/C3/C5/C6/C7; GAP-1..4).
// Bounded U4 law: candidate write shortcuts fail; a gated candidate write passes.
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { createKernelStore } from '../src/store.mjs'
import {
  admissionPolicyDefaults,
  createAdmissionPolicy,
  createGatedStore,
} from '../src/gate.mjs'

const tempDirs = []
async function tempDir() {
  const dir = await mkdtemp(join(tmpdir(), 'brain-kernel-gate-'))
  tempDirs.push(dir)
  return dir
}
after(async () => {
  await Promise.all(tempDirs.splice(0).map((d) => rm(d, { force: true, recursive: true })))
})

const FIXED_NOW = new Date('2026-07-18T12:00:00.000Z')
const EVENT_AT = '2026-05-02T09:30:00.000Z' // deliberately far from FIXED_NOW

async function openGated(workspaceId = 'contract-gate') {
  const root = await tempDir()
  const store = await createKernelStore({
    clock: () => FIXED_NOW,
    memoryEnabled: true,
    statePath: join(root, 'workspace-state.json'),
    workspaceId,
  })
  const gated = createGatedStore(store)
  return { gated, store }
}

const SCOPE = { palari_id: 'palari-a', user_id: 'user-1' }

function userProposal(overrides = {}) {
  return {
    kind: 'promote',
    op: 'add',
    provenance: { sourceKind: 'user_message', writer: 'explicit_user_action' },
    record: {
      confidence: 0.9,
      content: 'Working note: draft the U8 cost estimate before Friday.',
      keywords: ['cost', 'estimate'],
      type: 'working',
      ...SCOPE,
    },
    ...overrides,
  }
}

test('bounded U4 law: candidate add/supersede shortcuts are absent (partial C5)', async () => {
  const { gated } = await openGated()
  for (const method of ['addMemory', 'supersedeMemory', 'insertMemory']) {
    assert.equal(gated[method], undefined, `${method} must not exist on the gated surface`)
    assert.throws(() => gated[method]({}), TypeError, `calling ${method} fails`)
  }
  assert.equal(gated.db, undefined, 'raw db handle is not exposed')
  assert.ok(Object.isFrozen(gated), 'gated surface is frozen')
})

test('bounded U4 law: a gated candidate write lands with provenance (partial C5, GAP-1)', async () => {
  const { gated, store } = await openGated()
  const result = gated.propose(userProposal())
  assert.equal(result.outcome, 'inserted')
  const row = store.getMemoryById(result.memory.id)
  assert.ok(row)
  assert.equal(row.source_kind, 'user_message', 'CDX-M1 source_kind column populated')
  assert.equal(row.extractor, null)
})

test('CDX-M1 migration is recorded in memory_migrations (GAP-1)', async () => {
  const { store } = await openGated()
  const rows = store.db.prepare('SELECT id FROM memory_migrations ORDER BY id').all()
  assert.ok(rows.some((r) => r.id === 'CDX-M1'))
})

test('admit: provenance fields are required — sourceKind and writer (C1/C5)', async () => {
  const { gated } = await openGated()
  const noSource = gated.propose(userProposal({ provenance: { writer: 'explicit_user_action' } }))
  assert.equal(noSource.outcome, 'rejected')
  assert.ok(noSource.reasons.includes('source_kind_required'))
  const noWriter = gated.propose(userProposal({ provenance: { sourceKind: 'user_message' } }))
  assert.equal(noWriter.outcome, 'rejected')
  assert.ok(noWriter.reasons.includes('writer_required'))
})

test('admit: extracted provenance requires eventAt and extractor; validFrom stamps from eventAt, never wall clock (C2, GAP-4, GAP-1)', async () => {
  const { gated, store } = await openGated()
  const base = userProposal({
    provenance: { sourceKind: 'user_message', writer: 'background_extraction' },
  })
  const noEvent = gated.propose(base)
  assert.equal(noEvent.outcome, 'rejected')
  assert.ok(noEvent.reasons.includes('event_time_required'))

  const noExtractor = gated.propose({
    ...base,
    provenance: { ...base.provenance, eventAt: EVENT_AT },
  })
  assert.equal(noExtractor.outcome, 'rejected')
  assert.ok(noExtractor.reasons.includes('extractor_required'))

  const ok = gated.propose({
    ...base,
    provenance: { ...base.provenance, eventAt: EVENT_AT, extractor: 'stub-extractor-v1' },
  })
  assert.equal(ok.outcome, 'inserted')
  const row = store.getMemoryById(ok.memory.id)
  assert.equal(row.valid_from, EVENT_AT, 'evidence time, not wall clock')
  assert.equal(row.extractor, 'stub-extractor-v1')
  assert.equal(row.acquisition_mode, 'extracted')
})

test('admit: threshold order demote < promote < permanent < ratify is enforced (C6, GAP-2)', async () => {
  const { gated } = await openGated()
  const d = admissionPolicyDefaults
  assert.ok(d.demote < d.promote && d.promote < d.permanent && d.permanent < d.ratify)
  assert.throws(() => createAdmissionPolicy({ demote: 0.9 }), /order/i, 'disordered policy refused')

  // same evidence: enough for a transient promote, not enough for a permanent
  const midConfidence = (d.promote + d.permanent) / 2
  const permanentTry = gated.propose(userProposal({
    kind: 'permanent',
    record: { ...userProposal().record, confidence: midConfidence, type: 'preference' },
  }))
  assert.equal(permanentTry.outcome, 'rejected')
  assert.ok(permanentTry.reasons.includes('below_threshold'))
  const promoteTry = gated.propose(userProposal({
    record: { ...userProposal().record, confidence: midConfidence },
  }))
  assert.equal(promoteTry.outcome, 'inserted')
})

test('admit: proposal kind must match the type partition (C6)', async () => {
  const { gated } = await openGated()
  const promotePermanent = gated.propose(userProposal({
    kind: 'promote',
    record: { ...userProposal().record, type: 'preference' },
  }))
  assert.equal(promotePermanent.outcome, 'rejected')
  assert.ok(promotePermanent.reasons.includes('kind_type_mismatch'))
  const permanentTransient = gated.propose(userProposal({
    kind: 'permanent',
    record: { ...userProposal().record, type: 'working' },
  }))
  assert.equal(permanentTransient.outcome, 'rejected')
  assert.ok(permanentTransient.reasons.includes('kind_type_mismatch'))
})

test('external source content cannot mint without marking; what lands carries origin (C7)', async () => {
  const { gated, store } = await openGated()
  // baseline law inherited: external sourceKind only via background_extraction
  const externalDirect = gated.propose(userProposal({
    provenance: { sourceKind: 'source_document', writer: 'explicit_user_action' },
  }))
  assert.equal(externalDirect.outcome, 'rejected')

  const externalExtracted = gated.propose(userProposal({
    provenance: {
      eventAt: EVENT_AT,
      extractor: 'stub-extractor-v1',
      sourceKind: 'source_document',
      writer: 'background_extraction',
    },
  }))
  assert.equal(externalExtracted.outcome, 'inserted')
  const row = store.getMemoryById(externalExtracted.memory.id)
  assert.equal(row.source_kind, 'source_document', 'origin column set')
  assert.ok(row.keywords.includes('source:source_document'), 'origin keyword marking kept (baseline surface)')
})

test('resolve: supersession is demote-and-promote with a link; history survives (C3)', async () => {
  const { gated, store } = await openGated()
  const v1 = gated.propose(userProposal({
    kind: 'permanent',
    record: { ...userProposal().record, confidence: 0.9, content: 'Prefers tea over coffee.', keywords: ['tea'], type: 'preference' },
  }))
  assert.equal(v1.outcome, 'inserted')
  const v2 = gated.propose({
    kind: 'permanent',
    op: 'supersede',
    provenance: { sourceKind: 'user_message', writer: 'explicit_user_action' },
    record: { ...userProposal().record, confidence: 0.9, content: 'Prefers coffee now — switched in May.', keywords: ['coffee'], type: 'preference' },
    target: v1.memory.id,
  })
  assert.equal(v2.outcome, 'superseded')
  const old = store.getMemoryById(v1.memory.id)
  assert.ok(old, 'counterfactual history survives')
  assert.ok(old.valid_until, 'old row demoted via validity, not erased')
  const link = store.db.prepare('SELECT relation FROM memory_links WHERE from_memory_id = ? AND to_memory_id = ?')
    .get(v2.memory.id, v1.memory.id)
  assert.equal(link?.relation, 'supersedes')
})

test('resolve: supersession is type-safe across the partition (C4, GAP-3)', async () => {
  const { gated } = await openGated()
  const perm = gated.propose(userProposal({
    kind: 'permanent',
    record: { ...userProposal().record, confidence: 0.9, content: 'Values pre-commitment.', type: 'opinion' },
  }))
  const crossPartition = gated.propose({
    kind: 'promote',
    op: 'supersede',
    provenance: { sourceKind: 'user_message', writer: 'explicit_user_action' },
    record: { ...userProposal().record, content: 'Transient note trying to overwrite an opinion.', type: 'working' },
    target: perm.memory.id,
  })
  assert.equal(crossPartition.outcome, 'rejected')
  assert.ok(crossPartition.reasons.includes('type_partition_mismatch'))
})

test('resolve: duplicates bump instead of duplicating (baseline dedup surfaces through the gate)', async () => {
  const { gated } = await openGated()
  const first = gated.propose(userProposal())
  assert.equal(first.outcome, 'inserted')
  const second = gated.propose(userProposal())
  assert.equal(second.outcome, 'duplicate_bumped')
})

test('demote: end_validity stamps valid_until; delete_transient refuses permanent rows (C6)', async () => {
  const { gated, store } = await openGated()
  const note = gated.propose(userProposal())
  const demoted = gated.propose({
    kind: 'demote',
    op: 'end_validity',
    provenance: { actor: 'lifecycle_job' },
    target: note.memory.id,
  })
  assert.equal(demoted.outcome, 'demoted')
  assert.ok(store.getMemoryById(note.memory.id).valid_until)

  const perm = gated.propose(userProposal({
    kind: 'permanent',
    record: { ...userProposal().record, confidence: 0.9, content: 'Permanent: sister lives in Oaxaca.', type: 'relationship' },
  }))
  const badDelete = gated.propose({
    kind: 'demote',
    op: 'delete_transient',
    provenance: { actor: 'lifecycle_job' },
    target: perm.memory.id,
  })
  assert.equal(badDelete.outcome, 'rejected')
  assert.ok(badDelete.reasons.includes('not_transient'))
})

test('ratify: sharing is ceremonial — explicit user action at the highest threshold (C6)', async () => {
  const { gated, store } = await openGated()
  const note = gated.propose(userProposal({
    kind: 'permanent',
    record: { ...userProposal().record, confidence: 0.9, content: 'Speaks Spanish and Nahuatl.', type: 'entity' },
  }))
  const pipelineShare = gated.propose({
    kind: 'ratify',
    op: 'share',
    provenance: { eventAt: EVENT_AT, extractor: 'stub-extractor-v1', sourceKind: 'user_message', writer: 'background_extraction' },
    target: note.memory.id,
  })
  assert.equal(pipelineShare.outcome, 'rejected')
  assert.ok(pipelineShare.reasons.includes('ratify_requires_user'))

  const userShare = gated.propose({
    kind: 'ratify',
    op: 'share',
    provenance: { sourceKind: 'user_message', writer: 'explicit_user_action' },
    target: note.memory.id,
  })
  assert.equal(userShare.outcome, 'ratified')
  assert.equal(Boolean(store.getMemoryById(note.memory.id).shared), true)
})

test('ownership methods remain on the frozen surface pending V2-M2 gate closure (C17/C18)', async () => {
  const { gated } = await openGated()
  const note = gated.propose(userProposal())
  assert.ok(gated.getMemoryById(note.memory.id))
  const forgotten = gated.topicForget('estimate', { palariId: SCOPE.palari_id, userId: SCOPE.user_id }, { actor: 'explicit_user_action' })
  assert.equal(forgotten.count, 1)
  assert.equal(gated.getMemoryById(note.memory.id), null)
})

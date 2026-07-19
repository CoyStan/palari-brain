// Admission gate for candidate/add/supersession paths (KERNEL-API §4) — U4, Fable 5, 2026-07-18.
// propose() implements Admit (types, writers, provenance fields, source
// boundary, threshold order) -> Resolve (dedup, type-safe supersession)
// -> Apply for its closed operation vocabulary. Raw extraction/session-
// summary callers plus ownership, lifecycle, recall-inclusion, and
// internal link mutation remain explicit V2-M2 conformance debt; this
// module does not yet close every durable write.
// The extracted baseline (./memory-store.mjs) stays verbatim; kernel
// divergences live here as the recorded migration CDX-M1 and the
// admission rules closing GAP-1..4 (KERNEL-API §7).

import {
  externalMemorySourceKinds,
  memoryAddWriters,
  memoryMutationActors,
  permanentMemoryTypes,
  transientMemoryTypes,
} from './memory-store.mjs'

// GAP-2: the contract fixes the ORDER (demote < promote < permanent
// < ratify); these default confidence floors are kernel-chosen values
// realizing it, not baseline v05 behavior. Recorded here; tunable via
// createAdmissionPolicy, never reorderable.
export const admissionPolicyDefaults = Object.freeze({
  demote: 0,
  promote: 0.25,
  permanent: 0.6,
  ratify: 0.75,
})

export function createAdmissionPolicy(overrides = {}) {
  const policy = { ...admissionPolicyDefaults, ...overrides }
  if (!(policy.demote < policy.promote && policy.promote < policy.permanent && policy.permanent < policy.ratify)) {
    throw new Error('Admission thresholds must keep order demote < promote < permanent < ratify.')
  }
  return Object.freeze(policy)
}

const kindOps = {
  demote: new Set(['end_validity', 'delete_transient']),
  permanent: new Set(['add', 'supersede']),
  promote: new Set(['add', 'supersede']),
  ratify: new Set(['share']),
}

// GAP-1: kernel migration CDX-M1 — first-class provenance columns for
// origin (source_kind) and extractor identity, alongside (not
// replacing) the baseline's in-band `source:<kind>` keyword marking.
export function applyKernelMigrations(store) {
  if (!store?.enabled) return
  for (const column of ['source_kind TEXT', 'extractor TEXT']) {
    try {
      store.db.exec(`ALTER TABLE memories ADD COLUMN ${column}`)
    } catch (error) {
      if (!/duplicate column/i.test(String(error?.message ?? ''))) throw error
    }
  }
  store.db.prepare('INSERT OR IGNORE INTO memory_migrations(id, applied_at) VALUES (?, ?)')
    .run('CDX-M1', new Date().toISOString())
}

function partitionOf(type) {
  if (permanentMemoryTypes.has(type)) return 'permanent'
  if (transientMemoryTypes.has(type)) return 'transient'
  return null
}

export function createMemoryGate(store, { policy = admissionPolicyDefaults } = {}) {
  applyKernelMigrations(store)

  function stampProvenance(memoryId, { extractor = null, sourceKind }) {
    store.db.prepare('UPDATE memories SET source_kind = ?, extractor = ? WHERE id = ?')
      .run(sourceKind ?? null, extractor, memoryId)
    return store.getMemoryById(memoryId)
  }

  function admitWrite({ kind, provenance = {}, record = {} }) {
    const reasons = []
    const { eventAt, extractor, sourceKind, writer } = provenance
    if (!writer) reasons.push('writer_required')
    else if (!memoryAddWriters.has(writer)) reasons.push('invalid_writer')
    if (!sourceKind) reasons.push('source_kind_required')
    else if (sourceKind !== 'user_message' && !externalMemorySourceKinds.has(sourceKind)) {
      reasons.push('invalid_source_kind')
    }
    // baseline law, pre-checked instead of thrown: external content
    // only arrives via the extraction pipeline (C7)
    if (sourceKind && externalMemorySourceKinds.has(sourceKind) && writer !== 'background_extraction') {
      reasons.push('external_requires_extraction')
    }
    // GAP-4: evidence-time discipline — pipeline writes must carry
    // the event time; applied state never comes from wall clock.
    if (writer === 'background_extraction' || writer === 'session_summary') {
      if (!eventAt) reasons.push('event_time_required')
    }
    // GAP-1: extraction must identify itself.
    if (writer === 'background_extraction' && !extractor) reasons.push('extractor_required')
    // C6: the proposal kind must match the type partition...
    const partition = partitionOf(record.type)
    if (kind === 'promote' && partition !== 'transient') reasons.push('kind_type_mismatch')
    if (kind === 'permanent' && partition !== 'permanent') reasons.push('kind_type_mismatch')
    // ...and clear the kind's evidence floor (order enforced at policy creation).
    const confidence = Number.isFinite(Number(record.confidence)) ? Number(record.confidence) : 0.5
    if (confidence < policy[kind]) reasons.push('below_threshold')
    return reasons
  }

  function propose(proposal = {}) {
    const { kind, op = 'add', provenance = {}, record = {}, target } = proposal
    if (!kindOps[kind]) return { outcome: 'rejected', reasons: ['invalid_kind'] }
    if (!kindOps[kind].has(op)) return { outcome: 'rejected', reasons: ['invalid_op'] }

    if (kind === 'demote') {
      const actor = provenance.actor ?? provenance.writer
      if (!actor || !memoryMutationActors.has(actor)) return { outcome: 'rejected', reasons: ['invalid_actor'] }
      const existing = store.getMemoryById(target)
      if (!existing) return { outcome: 'rejected', reasons: ['missing_target'] }
      if (op === 'delete_transient') {
        if (partitionOf(existing.type) !== 'transient') return { outcome: 'rejected', reasons: ['not_transient'] }
        store.deleteMemory(target, { actor })
        return { deletedId: target, outcome: 'demoted', reasons: [] }
      }
      const until = provenance.eventAt ?? new Date().toISOString()
      store.db.prepare('UPDATE memories SET valid_until = ? WHERE id = ?').run(until, target)
      return { memory: store.getMemoryById(target), outcome: 'demoted', reasons: [] }
    }

    if (kind === 'ratify') {
      // authority direction is ceremonial: only the user ratifies
      if (provenance.writer !== 'explicit_user_action') {
        return { outcome: 'rejected', reasons: ['ratify_requires_user'] }
      }
      const existing = store.getMemoryById(target)
      if (!existing) return { outcome: 'rejected', reasons: ['missing_target'] }
      store.db.prepare('UPDATE memories SET shared = 1 WHERE id = ?').run(target)
      return { memory: store.getMemoryById(target), outcome: 'ratified', reasons: [] }
    }

    // promote / permanent — add or supersede
    const reasons = admitWrite({ kind, provenance, record })
    if (reasons.length) return { outcome: 'rejected', reasons }

    const writeRecord = {
      ...record,
      valid_from: record.valid_from ?? provenance.eventAt ?? undefined,
    }
    const writeOptions = {
      sourceKind: provenance.sourceKind,
      sourceMessageId: provenance.sourceMessageId,
      writer: provenance.writer,
    }

    if (op === 'supersede') {
      const existing = store.getMemoryById(target)
      if (!existing) return { outcome: 'rejected', reasons: ['missing_target'] }
      // GAP-3: supersession is type-safe across the partition
      const newType = writeRecord.type ?? existing.type
      if (partitionOf(newType) !== partitionOf(existing.type)) {
        return { outcome: 'rejected', reasons: ['type_partition_mismatch'] }
      }
      const result = store.supersedeMemory(target, writeRecord, writeOptions)
      const memory = stampProvenance(result.memory.id, provenance)
      return { link: result.link, memory, outcome: 'superseded', reasons: [], superseded: result.superseded }
    }

    const result = store.addMemory(writeRecord, writeOptions)
    if (result.outcome !== 'inserted') return { ...result, reasons: [] }
    const memory = stampProvenance(result.memory.id, provenance)
    return { memory, outcome: 'inserted', reasons: [] }
  }

  return { policy, propose }
}

// The current producer surface hides addMemory / supersedeMemory /
// insertMemory / raw db, but still forwards ownership, lifecycle, and
// recall-inclusion mutations directly. V2-M2 must type those remaining
// bypasses before the complete C5 one-gate claim is satisfied.
export function createGatedStore(store, options = {}) {
  const gate = createMemoryGate(store, options)
  return Object.freeze({
    close: () => store.close(),
    config: store.config,
    dbPath: store.dbPath,
    deleteMemory: (id, opts) => store.deleteMemory(id, opts),
    enabled: store.enabled,
    getMemoryById: (id) => store.getMemoryById(id),
    listMemories: (scope) => store.listMemories(scope),
    propose: gate.propose,
    publicStatus: () => store.publicStatus(),
    recallMemories: (query, opts) => store.recallMemories(query, opts),
    recordRecallInclusion: (ids, opts) => store.recordRecallInclusion(ids, opts),
    runLifecycleJobs: (opts) => store.runLifecycleJobs(opts),
    searchMemories: (query, opts) => store.searchMemories(query, opts),
    status: () => store.status(),
    topicForget: (query, scope, opts) => store.topicForget(query, scope, opts),
  })
}

// V2-M2-B Task 6 — unsupported production mutation routes refuse without
// crossing the governed bridge's sole ratified-erasure write boundary.

import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { test } from 'node:test'

import {
  createGatedStore,
  createMemoryGate,
  proposeExtractedMemoryCandidate,
} from '../src/gate.mjs'
import {
  createMemoryExtractionScheduler,
  runMemoryExtractionPass,
  writeSessionSummaryMemory,
} from '../src/memory-extraction.mjs'
import {
  createKernelStore,
  createWorkspaceMemoryManager,
} from '../src/store.mjs'

const REFUSED_PROPOSAL = {
  outcome: 'rejected',
  reasons: ['governance_refused'],
}

function hostile(label, observations) {
  return new Proxy({}, {
    get() {
      observations.push(`${label}:get`)
      throw new Error(`${label}:get`)
    },
    getOwnPropertyDescriptor() {
      observations.push(`${label}:descriptor`)
      throw new Error(`${label}:descriptor`)
    },
    getPrototypeOf() {
      observations.push(`${label}:prototype`)
      throw new Error(`${label}:prototype`)
    },
    ownKeys() {
      observations.push(`${label}:keys`)
      throw new Error(`${label}:keys`)
    },
  })
}

function mutationSnapshot(dbPath) {
  const db = new DatabaseSync(dbPath, { readOnly: true })
  try {
    const count = (table) => db.prepare(
      `SELECT count(*) AS value FROM main.${table}`,
    ).get().value
    const meta = db.prepare(`
      SELECT head_mutation_sequence
      FROM main.cdx_b2_meta
      WHERE singleton = 1
    `).get()
    const tail = db.prepare(`
      SELECT max(observed_at) AS last_observed_at
      FROM main.cdx_b2_decisions
    `).get()
    return {
      decisions: count('cdx_b2_decisions'),
      effects: count('cdx_b2_effects'),
      fts: count('memory_fts'),
      head: meta.head_mutation_sequence,
      lastObservedAt: tail.last_observed_at,
      links: count('memory_links'),
      memories: count('memories'),
    }
  } finally {
    db.close()
  }
}

function exactProposalBranches() {
  const base = {
    provenance: {
      actor: 'explicit_user_action',
      eventAt: '2026-07-21T12:00:00.000Z',
      sourceKind: 'user_message',
      writer: 'explicit_user_action',
    },
    record: {
      confidence: 1,
      content: 'Must never enter the M2-B projection.',
      id: 'mem_00000000-0000-4000-8000-000000000001',
      importance: 1,
      keywords: ['refused'],
      palari_id: 'palari-refusal',
      type: 'preference',
      user_id: 'user-refusal',
    },
  }
  return [
    undefined,
    { kind: 'unknown' },
    { ...base, kind: 'promote', op: 'unknown' },
    { ...base, kind: 'promote', op: 'add' },
    { ...base, kind: 'permanent', op: 'add' },
    { ...base, kind: 'promote', op: 'supersede', target: base.record.id },
    { kind: 'demote', op: 'end_validity', target: base.record.id },
    { kind: 'demote', op: 'delete_transient', target: base.record.id },
    { kind: 'ratify', op: 'share', target: base.record.id },
  ]
}

test('M2-B-06 every unsupported gate route has its exact refusal shape and zero journal/projection effects', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'brain-m2b06-refusal-'))
  let base
  try {
    base = await createKernelStore({
      memoryEnabled: true,
      memoryRootDir: directory,
      workspaceId: 'production-refusal',
    })
    const gate = createMemoryGate(base)
    const store = createGatedStore(base)
    const before = mutationSnapshot(base.dbPath)

    for (const proposal of exactProposalBranches()) {
      assert.deepEqual(gate.propose(proposal), REFUSED_PROPOSAL)
    }

    const observations = []
    const unobserved = hostile('proposal', observations)
    assert.deepEqual(gate.propose(unobserved), REFUSED_PROPOSAL)
    assert.deepEqual(
      proposeExtractedMemoryCandidate(store, unobserved),
      REFUSED_PROPOSAL,
    )
    assert.deepEqual(
      store.deleteMemory(
        hostile('id', observations),
        hostile('delete-options', observations),
        hostile('grant', observations),
      ),
      { deleted: false, reason: 'governance_refused' },
    )
    assert.deepEqual(
      store.topicForget(
        hostile('topic', observations),
        hostile('scope', observations),
        hostile('topic-options', observations),
      ),
      { count: 0, deleted: [] },
    )
    assert.deepEqual(
      store.recordRecallInclusion(
        hostile('ids', observations),
        hostile('recall-options', observations),
      ),
      { touched: [], touchedCount: 0 },
    )
    assert.deepEqual(
      store.runLifecycleJobs(hostile('lifecycle-options', observations)),
      { decayed: 0, deleted: 0, skipped: 0, touched: 0 },
    )
    assert.deepEqual(observations, [])
    assert.deepEqual(mutationSnapshot(base.dbPath), before)

    base.close()
    assert.throws(
      () => gate.propose(unobserved),
      (error) => error?.code === 'legacy_store_closed',
    )
    assert.deepEqual(observations, [])
  } finally {
    try {
      base?.close()
    } finally {
      await rm(directory, { force: true, recursive: true })
    }
  }
})

test('M2-B-06 extraction and summary retain producer receipts while every candidate write refuses', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'brain-m2b06-producers-'))
  let base
  try {
    base = await createKernelStore({
      memoryEnabled: true,
      memoryRootDir: directory,
      workspaceId: 'producer-refusal',
    })
    const store = createGatedStore(base)
    const before = mutationSnapshot(base.dbPath)
    const extraction = await runMemoryExtractionPass({
      extractor: async () => ({
        memories: [
          {
            confidence: 0.9,
            content: 'User preference: cobalt tea.',
            importance: 0.8,
            keywords: ['cobalt', 'tea'],
            shared: false,
            sourceKind: 'user_message',
            type: 'preference',
          },
          {
            confidence: 0.8,
            content: 'User preference: this project matters.',
            importance: 0.6,
            keywords: ['project', 'matters'],
            shared: false,
            sourceKind: 'user_message',
            type: 'preference',
          },
        ],
      }),
      extractorId: 'm2b06-test-extractor',
      store,
      turn: {
        assistantMessage: 'Understood.',
        eventAt: '2026-07-21T12:00:00.000Z',
        palariId: 'palari-refusal',
        sourceMessageId: 'message-refusal',
        userId: 'user-refusal',
        userMessage: 'I prefer cobalt tea. My preference is that this project matters.',
      },
    })
    assert.equal(extraction.status, 'completed')
    assert.equal(extraction.memoriesWritten, 0)
    assert.deepEqual(extraction.outcomes, ['rejected', 'rejected'])

    const summary = writeSessionSummaryMemory({
      store,
      turn: {
        assistantMessage: 'I will keep that in mind.',
        eventAt: '2026-07-21T12:00:00.000Z',
        palariId: 'palari-refusal',
        palariName: 'Palari',
        sourceMessageId: 'summary-message-refusal',
        sourceRefCount: 0,
        userId: 'user-refusal',
        userMessage: 'I prefer cobalt tea.',
        userName: 'Owner',
      },
    })
    assert.equal(summary.status, 'completed')
    assert.equal(summary.outcome, 'rejected')
    assert.deepEqual(mutationSnapshot(base.dbPath), before)
  } finally {
    try {
      base?.close()
    } finally {
      await rm(directory, { force: true, recursive: true })
    }
  }
})

test('M2-B-06 scheduler and disabled capabilities preserve precedence without authority inference', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'brain-m2b06-scheduler-'))
  const disabledObservations = []
  let manager
  try {
    const disabledBase = await createKernelStore({
      authorityRoot: hostile('disabled-authority', disabledObservations),
      memoryEnabled: false,
    })
    const disabled = createGatedStore(disabledBase)
    assert.deepEqual(disabled.propose(hostile('disabled-proposal', disabledObservations)), {
      outcome: 'rejected',
      reasons: ['memory_disabled'],
    })
    assert.deepEqual(
      disabled.deleteMemory(
        hostile('disabled-id', disabledObservations),
        hostile('disabled-options', disabledObservations),
        hostile('disabled-grant', disabledObservations),
      ),
      { deleted: false, reason: 'memory_disabled' },
    )
    assert.deepEqual(disabledObservations, [])
    disabled.close()

    manager = createWorkspaceMemoryManager({
      memoryEnabled: true,
      memoryRootDir: directory,
    })
    let extractionCalls = 0
    let sourceMessageIdReads = 0
    const scheduler = createMemoryExtractionScheduler({
      extractor: async () => {
        extractionCalls += 1
        return {
          memories: [{
            confidence: 1,
            content: 'User preference: amber coffee.',
            importance: 1,
            keywords: ['amber', 'coffee'],
            shared: false,
            sourceKind: 'user_message',
            type: 'preference',
          }],
        }
      },
      extractorId: 'm2b06-scheduler-extractor',
      memoryManager: manager,
      sessionSummaryEnabled: true,
    })
    const scheduledTurn = {
      assistantMessage: 'Understood.',
      eventAt: '2026-07-21T12:00:00.000Z',
      palariId: 'palari-refusal',
      sourceRefCount: 0,
      userId: 'user-refusal',
      userMessage: 'I prefer amber coffee.',
      workspaceId: 'scheduler-refusal',
    }
    Object.defineProperty(scheduledTurn, 'sourceMessageId', {
      enumerable: true,
      get() {
        sourceMessageIdReads += 1
        return 'scheduler-message-refusal'
      },
    })
    assert.equal(scheduler.schedule(scheduledTurn).scheduled, true)
    await scheduler.drain()
    assert.equal(scheduler.pendingCount(), 0)
    assert.equal(extractionCalls, 1)
    assert.equal(sourceMessageIdReads, 3)
    const store = await manager.forWorkspace('scheduler-refusal')
    assert.deepEqual(mutationSnapshot(store.dbPath), {
      decisions: 0,
      effects: 0,
      fts: 0,
      head: 0,
      lastObservedAt: null,
      links: 0,
      memories: 0,
    })
  } finally {
    try {
      await manager?.close()
    } finally {
      await rm(directory, { force: true, recursive: true })
    }
  }
})

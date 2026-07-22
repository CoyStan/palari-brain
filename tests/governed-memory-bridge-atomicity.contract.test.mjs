// V2-M2-B Task 5 — governed bridge co-commit and race falsifiers.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const CHILD_PATH = fileURLToPath(new URL(
  './fixtures/governed-memory-bridge-instrumentation-child.mjs',
  import.meta.url,
))

const INITIAL_STATE = Object.freeze({
  decisionCount: 0,
  effectCount: 0,
  effects: [],
  ftsCount: 1,
  head: 0,
  memoryCount: 1,
  reasons: [],
})

const APPLIED_STATE = Object.freeze({
  decisionCount: 1,
  effectCount: 2,
  effects: [
    {
      effectKind: 'projection_atom_erased',
      effectOrdinal: 0,
    },
    {
      effectKind: 'projection_fts_erased',
      effectOrdinal: 1,
    },
  ],
  ftsCount: 0,
  head: 1,
  memoryCount: 0,
  reasons: [null],
})

let cached

function result() {
  if (cached !== undefined) return cached
  const child = spawnSync(process.execPath, [CHILD_PATH, 'task-5'], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  })
  assert.equal(
    child.status,
    0,
    `governed bridge instrumentation child failed\nstdout:\n${child.stdout}\nstderr:\n${child.stderr}`,
  )
  const lines = child.stdout.trim().split('\n')
  assert.equal(lines.length, 1, child.stdout)
  cached = JSON.parse(lines[0])
  return cached
}

function assertControlTrace(entry, expected) {
  assert.deepEqual(entry.controls, expected, entry.label)
  assert.equal(entry.transactionInactive, true, entry.label)
}

test('M2-B-05 applied decision, both effects, projection, and head ordinals roll back as one conjunction', () => {
  const cases = result().rollbackOrdinals
  const labels = [
    'decision-insert',
    'effect-insert-0',
    'effect-insert-1',
    'projection-delete',
    'head-update',
  ]
  assert.deepEqual(cases.map((entry) => entry.label), labels)

  for (let index = 0; index < cases.length; index += 1) {
    const entry = cases[index]
    assert.equal(entry.fired, true, `${entry.label}: injection was not reached`)
    assert.deepEqual(entry.writes, labels.slice(0, index + 1), entry.label)
    assert.deepEqual(entry.afterFailure, INITIAL_STATE, entry.label)
    assertControlTrace(entry, ['BEGIN IMMEDIATE', 'ROLLBACK'])
    assert.equal(entry.error.isInjected, entry.label === 'projection-delete')

    if (entry.label === 'projection-delete') {
      assert.deepEqual(entry.error, {
        code: null,
        isInjected: true,
        message: 'injected bridge fault: projection-delete',
        name: 'Error',
      })
      assert.equal(entry.activityCalls, 2)
      assert.deepEqual(entry.retryResult, {
        deleted: true,
        reason: 'deleted',
        targetId: entry.targetId,
      })
      assert.deepEqual(entry.afterRetry, APPLIED_STATE)
      assert.equal(entry.poisonCode, null)
      assert.equal(entry.rootIssueCode, null)
    } else {
      assert.equal(entry.error.name, 'GovernedMemoryError', entry.label)
      assert.equal(entry.error.isInjected, false, entry.label)
      assert.equal(
        entry.error.code,
        'governance_journal_invalid',
        entry.label,
      )
      assert.equal(entry.retryResult, null)
      assert.equal(entry.afterRetry, null)
      assert.equal(entry.activityCalls, 1)
      assert.equal(entry.poisonCode, 'governance_state_poisoned')
      assert.equal(entry.rootIssueCode, 'authority_root_revoked')
    }
  }
})

test('M2-B-05 known commit failure releases after rollback while unknown commit retires after a complete durable conjunction', () => {
  const { commitKnownFailed, commitUnknown } = result()

  assert.deepEqual(commitKnownFailed.error, {
    code: 'mutation_commit_failed',
    isInjected: false,
    message: 'The mutation transaction could not commit.',
    name: 'MemoryMutationError',
  })
  assert.deepEqual(commitKnownFailed.afterFailure, INITIAL_STATE)
  assert.deepEqual(commitKnownFailed.controls, [
    'BEGIN IMMEDIATE',
    'COMMIT',
    'ROLLBACK',
  ])
  assert.equal(commitKnownFailed.transactionInactive, true)
  assert.equal(commitKnownFailed.activityCalls, 2)
  assert.deepEqual(commitKnownFailed.retryResult, {
    deleted: true,
    reason: 'deleted',
    targetId: commitKnownFailed.targetId,
  })
  assert.deepEqual(commitKnownFailed.afterRetry, APPLIED_STATE)
  assert.equal(commitKnownFailed.poisonCode, null)
  assert.equal(commitKnownFailed.rootIssueCode, null)

  assert.deepEqual(commitUnknown.error, {
    code: 'mutation_commit_outcome_unknown',
    isInjected: false,
    message: 'The mutation commit outcome is unknown.',
    name: 'MemoryMutationError',
  })
  assert.deepEqual(commitUnknown.afterFailure, APPLIED_STATE)
  assert.deepEqual(commitUnknown.controls, ['BEGIN IMMEDIATE', 'COMMIT'])
  assert.equal(commitUnknown.transactionInactive, true)
  assert.equal(commitUnknown.activityCalls, 1)
  assert.equal(commitUnknown.poisonCode, 'governance_state_poisoned')
  assert.equal(commitUnknown.rootIssueCode, 'authority_root_revoked')
})

test('M2-B-05 a reopened same-ledger root below the persisted tail fails after verification but before nonce generation', () => {
  const entry = result().lowerPersistedClock
  assert.deepEqual(entry.error, {
    code: 'governance_clock_invalid',
    isInjected: false,
    message: 'The governed memory observation clock moved backward.',
    name: 'GovernedMemoryError',
  })
  assert.equal(entry.uuidDelta, 0)
  assert.deepEqual(entry.before, APPLIED_STATE)
  assert.deepEqual(entry.after, APPLIED_STATE)
  assert.deepEqual(entry.controls, ['BEGIN IMMEDIATE', 'ROLLBACK'])
  assert.equal(entry.transactionInactive, true)
  assert.equal(entry.poisonCode, 'governance_state_poisoned')
  assert.equal(entry.rootIssueCode, 'authority_root_revoked')
})

test('M2-B-05 a different zero-head ledger candidate loses before clock and nonce work without poisoning the readable bridge', () => {
  const entry = result().differentLedgerRace
  assert.deepEqual(entry.error, {
    code: 'authority_scope_mismatch',
    isInjected: false,
    message: 'The memory authority scope does not match the store audience.',
    name: 'MemoryAuthorityError',
  })
  assert.equal(entry.uuidDelta, 0)
  assert.deepEqual(entry.before, APPLIED_STATE)
  assert.deepEqual(entry.after, APPLIED_STATE)
  assert.deepEqual(entry.controls, ['BEGIN IMMEDIATE', 'ROLLBACK'])
  assert.equal(entry.transactionInactive, true)
  assert.equal(entry.rootIssueCode, 'authority_root_revoked')
  assert.equal(entry.bridgeReadErrorCode, null)
  assert.deepEqual(entry.bridgeReadResult, {
    outcome: 'rejected',
    reasons: ['governance_refused'],
  })
})

test('M2-B-05 second connection sees neither side before commit, both after, and a busy grant resolves from the later snapshot only on explicit retry', () => {
  const entry = result().sameLedgerBusyVisibility
  assert.equal(entry.hookCalls, 1)
  assert.deepEqual(entry.writerBeforeCommit, APPLIED_STATE)
  assert.deepEqual(entry.observerBeforeCommit, INITIAL_STATE)
  assert.deepEqual(entry.observerAfterBusy, INITIAL_STATE)
  assert.deepEqual(entry.busyError, {
    code: 'mutation_busy',
    isInjected: false,
    message: 'The mutation database is busy or locked.',
    name: 'MemoryMutationError',
  })
  assert.deepEqual(entry.firstResult, {
    deleted: true,
    reason: 'deleted',
    targetId: entry.targetId,
  })
  assert.deepEqual(entry.observerAfterCommit, APPLIED_STATE)
  assert.deepEqual(entry.retryResult, {
    deleted: false,
    reason: 'not_found',
  })
  assert.deepEqual(entry.finalState, {
    decisionCount: 2,
    effectCount: 2,
    effects: APPLIED_STATE.effects,
    ftsCount: 0,
    head: 2,
    memoryCount: 0,
    reasons: [null, 'missing_target'],
  })
  assert.deepEqual(entry.activityCalls, { first: 1, second: 2 })
  assert.equal(entry.secondRootIssueCode, null)
})

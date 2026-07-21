import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const CHILD_PATH = fileURLToPath(new URL(
  './fixtures/cdx-b2-bootstrap-instrumentation-child.mjs',
  import.meta.url,
))

const EXPECTED_CREATES = Object.freeze([
  'cdx_b2_meta',
  'cdx_b2_legacy_checkpoint',
  'cdx_b2_decisions',
  'cdx_b2_effects',
  'cdx_b2_applied_erase_target_unique',
  'cdx_b2_meta_no_delete',
  'cdx_b2_meta_advance_guard',
  'cdx_b2_checkpoint_no_update',
  'cdx_b2_checkpoint_no_delete',
  'cdx_b2_checkpoint_insert_guard',
  'cdx_b2_decisions_no_update',
  'cdx_b2_decisions_no_delete',
  'cdx_b2_decision_next_sequence',
  'cdx_b2_effects_no_update',
  'cdx_b2_effects_no_delete',
  'cdx_b2_effect_insert_guard',
])

const EXPECTED_CHECKPOINT_MUTATIONS = Object.freeze([
  'insert:checkpoint:1:memory',
  'insert:checkpoint:2:memory',
  'insert:checkpoint:3:memory',
  'insert:checkpoint:4:link',
  'insert:checkpoint:5:link',
])

const EXPECTED_MUTATIONS = Object.freeze([
  ...EXPECTED_CREATES.map((name) => `create:${name}`),
  'insert:meta',
  ...EXPECTED_CHECKPOINT_MUTATIONS,
  'insert:marker',
])

const EXPECTED_BOUNDARY_FAILURES = Object.freeze([
  Object.freeze({
    callbackCounts: { clock: 2, uuid: 0 },
    errorCode: 'governance_projection_invalid',
    errorMessage: 'The CDX-M1 projection does not match the CDX-B2 journal.',
    injected: 'snapshot memories',
    label: 'snapshot:memories',
  }),
  Object.freeze({
    callbackCounts: { clock: 2, uuid: 0 },
    errorCode: 'governance_projection_invalid',
    errorMessage: 'The CDX-M1 projection does not match the CDX-B2 journal.',
    injected: 'snapshot links',
    label: 'snapshot:links',
  }),
  Object.freeze({
    callbackCounts: { clock: 3, uuid: 0 },
    errorCode: 'governance_clock_invalid',
    errorMessage: 'The governed memory observation clock moved backward.',
    injected: 'clock callback 2',
    label: 'callback:clock:checkpoint',
  }),
  Object.freeze({
    callbackCounts: { clock: 3, uuid: 1 },
    errorCode: 'governance_internal_invariant',
    errorMessage: 'The governed memory kernel invariant failed.',
    injected: 'UUID callback 0',
    label: 'callback:uuid:stream',
  }),
  Object.freeze({
    callbackCounts: { clock: 3, uuid: 2 },
    errorCode: 'governance_internal_invariant',
    errorMessage: 'The governed memory kernel invariant failed.',
    injected: 'UUID callback 1',
    label: 'callback:uuid:checkpoint',
  }),
])

// Task 4's complete reducer adds one grouped FTS-membership cardinality read
// even at head zero; the bootstrap failure-ordinal proof remains exhaustive.
const EXPECTED_VERIFY_READ_COUNT = 107

let cachedResult

function instrumentationResult() {
  if (cachedResult !== undefined) return cachedResult
  const child = spawnSync(process.execPath, [CHILD_PATH, 'task-3'], {
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
  })
  assert.equal(
    child.status,
    0,
    `CDX-B2 instrumentation child failed\nstdout:\n${child.stdout}\nstderr:\n${child.stderr}`,
  )
  const lines = child.stdout.trim().split('\n')
  assert.equal(lines.length, 1, child.stdout)
  cachedResult = JSON.parse(lines[0])
  return cachedResult
}

function assertHeadZeroState(state) {
  assert.match(
    state.streamId,
    /^b2s_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  )
  assert.deepEqual(
    {
      authorityLedgerId: state.authorityLedgerId,
      checkpointLinkCount: state.checkpointLinkCount,
      checkpointMemoryCount: state.checkpointMemoryCount,
      headMutationSequence: state.headMutationSequence,
      lastObservedAt: state.lastObservedAt,
    },
    {
      authorityLedgerId: null,
      checkpointLinkCount: 2,
      checkpointMemoryCount: 3,
      headMutationSequence: 0,
      lastObservedAt: null,
    },
  )
}

function assertRollbackAndRetry(result) {
  assert.notEqual(result.error, null, `${result.label}: missing failure`)
  assert.notEqual(result.injected, null, `${result.label}: injection not reached`)
  assert.equal(result.inventoryCount, 0, `${result.label}: B2 residue`)
  assert.equal(result.markerCount, 0, `${result.label}: marker residue`)
  assert.equal(result.unchanged, true, `${result.label}: M0/M1/CDX/FTS drift`)
  assert.equal(
    result.transactionInactive,
    true,
    `${result.label}: transaction remained active`,
  )
  assert.equal(result.retryError, null, `${result.label}: retry failed`)
  assertHeadZeroState(result.retryState)
}

function expectedVerifyErrorCode(ordinal) {
  if (ordinal <= 93) return 'governance_schema_invalid'
  if (ordinal === 94) return 'governance_meta_invalid'
  if (ordinal === 95) return 'governance_migration_invalid'
  if (ordinal <= 98) return 'governance_checkpoint_invalid'
  if (ordinal <= 100) return 'governance_journal_invalid'
  return 'governance_projection_invalid'
}

test('M2-B-03 completed B2 reopen is verify-only with no callback, DDL, or DML', () => {
  const { reopen } = instrumentationResult()
  assert.equal(reopen.initializationError, null)
  assert.equal(reopen.reopenError, null)
  assertHeadZeroState(reopen.firstState)
  assert.deepEqual(reopen.reopenedState, reopen.firstState)
  assert.deepEqual(reopen.callbackCounts, { clock: 0, uuid: 0 })
  assert.deepEqual(reopen.mutations, [])
  assert.deepEqual(reopen.salient, [
    'classify:b2-inventory',
    'classify:b2-marker',
    'control:COMMIT',
  ])
  assert.deepEqual(reopen.writes, [])
  assert.equal(reopen.rowsUnchanged, true)
  assert.equal(reopen.transactionInactive, true)
})

test('M2-B-03 new bootstrap trace pins classification, repair, snapshot, callbacks, creation, checkpoint, marker, and verification order', () => {
  const { newBootstrap } = instrumentationResult()
  assert.equal(newBootstrap.error, null)
  assertHeadZeroState(newBootstrap.state)
  assert.equal(newBootstrap.transactionInactive, true)
  assert.deepEqual(newBootstrap.callbackCounts, { clock: 3, uuid: 2 })

  const mutationLabels = newBootstrap.mutations.map(({ label }) => label)
  assert.deepEqual(mutationLabels, EXPECTED_MUTATIONS)
  assert.deepEqual(
    newBootstrap.mutations.map(({ ordinal }) => ordinal),
    Array.from({ length: EXPECTED_MUTATIONS.length }, (_, index) => index),
  )
  assert.equal(
    new Set(newBootstrap.mutations.slice(0, 16).map(({ call }) => call)).size,
    16,
    'each B2 CREATE must be its own failure-injectable SQL call',
  )
  assert.equal(
    new Set(newBootstrap.mutations.map(({ call }) => call)).size,
    EXPECTED_MUTATIONS.length,
    'every B2 mutation ordinal must be a distinct SQL execution',
  )

  const trace = newBootstrap.salient
  const positions = new Map(trace.map((label, index) => [label, index]))
  for (const label of [
    'classify:b2-inventory',
    'classify:b2-marker',
    'repair:start',
    'callback:clock:a2-m0',
    'callback:clock:a2-m1',
    'snapshot:memories',
    'snapshot:links',
    'callback:clock:checkpoint',
    'callback:uuid:stream',
    'callback:uuid:checkpoint',
    ...EXPECTED_MUTATIONS,
    'verify:start',
    'control:COMMIT',
  ]) {
    assert.equal(positions.has(label), true, `missing trace phase ${label}`)
  }

  const exactOrder = [
    'classify:b2-inventory',
    'classify:b2-marker',
    'repair:start',
    'callback:clock:a2-m0',
    'callback:clock:a2-m1',
    'snapshot:memories',
    'snapshot:links',
    'callback:clock:checkpoint',
    'callback:uuid:stream',
    'callback:uuid:checkpoint',
    ...EXPECTED_MUTATIONS,
    'verify:start',
    'control:COMMIT',
  ]
  for (let index = 1; index < exactOrder.length; index += 1) {
    assert.ok(
      positions.get(exactOrder[index - 1]) < positions.get(exactOrder[index]),
      `${exactOrder[index - 1]} must precede ${exactOrder[index]}`,
    )
  }
})

test('M2-B-03 every create/meta/checkpoint/marker ordinal and callback/COMMIT boundary rolls back cleanly and retries', () => {
  const { failureMatrix } = instrumentationResult()
  assert.equal(failureMatrix.length, EXPECTED_MUTATIONS.length + 2)
  assert.deepEqual(
    failureMatrix.map(({ label }) => label),
    [
      ...EXPECTED_MUTATIONS.map((label, ordinal) =>
        `mutation:${ordinal}:${label}`),
      'outer-callback',
      'commit',
    ],
  )

  for (let index = 0; index < failureMatrix.length; index += 1) {
    const result = failureMatrix[index]
    assertRollbackAndRetry(result)
    assert.equal(
      result.injected,
      index < EXPECTED_MUTATIONS.length
        ? `mutation ordinal ${index}:${EXPECTED_MUTATIONS[index]}`
        : index === EXPECTED_MUTATIONS.length
          ? 'outer callback'
          : 'COMMIT',
    )
  }
})

test('M2-B-03 snapshot and generated-value boundaries roll back cleanly and retry', () => {
  const { boundaryFailureMatrix } = instrumentationResult()
  assert.equal(boundaryFailureMatrix.length, EXPECTED_BOUNDARY_FAILURES.length)
  for (let index = 0; index < EXPECTED_BOUNDARY_FAILURES.length; index += 1) {
    const expected = EXPECTED_BOUNDARY_FAILURES[index]
    const result = boundaryFailureMatrix[index]
    assert.equal(result.label, expected.label)
    assert.equal(result.injected, expected.injected)
    assert.deepEqual(result.callbackCounts, expected.callbackCounts)
    if (expected.errorCode !== undefined) {
      assert.equal(result.error?.name, 'GovernedMemoryError')
      assert.equal(result.error?.code, expected.errorCode)
      assert.equal(result.error?.message, expected.errorMessage)
    }
    assertRollbackAndRetry(result)
  }
})

test('M2-B-04 every post-marker complete-verifier get/all ordinal rolls back cleanly and retries', () => {
  const { newBootstrap, verifyReadFailureMatrix } = instrumentationResult()
  const { verifyReads } = newBootstrap
  assert.equal(verifyReads.length, EXPECTED_VERIFY_READ_COUNT)
  assert.deepEqual(
    verifyReads.map(({ ordinal }) => ordinal),
    Array.from({ length: EXPECTED_VERIFY_READ_COUNT }, (_, index) => index),
  )
  assert.equal(
    verifyReads.filter(({ operation }) => operation === 'get').length,
    7,
  )
  assert.equal(
    verifyReads.filter(({ operation }) => operation === 'all').length,
    100,
  )
  for (const target of verifyReads) {
    assert.match(target.operation, /^(?:all|get)$/)
    assert.equal(typeof target.sql, 'string')
    assert.notEqual(target.sql, '')
  }

  assert.equal(verifyReadFailureMatrix.length, verifyReads.length)
  for (let index = 0; index < verifyReads.length; index += 1) {
    const result = verifyReadFailureMatrix[index]
    assert.equal(result.label, `verify-read:${index}`)
    assert.deepEqual(result.target, verifyReads[index])
    assert.equal(result.injected, `verification read ${index}`)
    assert.deepEqual(result.failedVerifyReads, verifyReads.slice(0, index + 1))
    assert.equal(result.error?.name, 'GovernedMemoryError')
    assert.equal(result.error?.code, expectedVerifyErrorCode(index))
    assert.equal(result.error?.causeCode, 'ERR_SQLITE_ERROR')
    assertRollbackAndRetry(result)
  }
})

test('M2-B-03 post-native-COMMIT uncertainty leaves a whole committed B2 and poisons only the uncertain coordinator', () => {
  const { postCommitUncertainty } = instrumentationResult()
  assert.equal(postCommitUncertainty.injected, 'post-native COMMIT')
  assert.equal(postCommitUncertainty.commitNativeCompleted, true)
  assert.equal(
    postCommitUncertainty.error?.code,
    'mutation_commit_outcome_unknown',
  )
  assert.equal(postCommitUncertainty.transactionInactive, true)
  assert.deepEqual(
    postCommitUncertainty.inventoryNames,
    [...EXPECTED_CREATES].sort(),
  )
  assert.equal(postCommitUncertainty.markerCount, 1)
  assert.deepEqual(postCommitUncertainty.rowCounts, {
    cdx_b2_decisions: 0,
    cdx_b2_effects: 0,
    cdx_b2_legacy_checkpoint: 5,
    cdx_b2_meta: 1,
  })
  assert.equal(postCommitUncertainty.poisonedError?.code, 'mutation_poisoned')
  assert.equal(postCommitUncertainty.reopenError, null)
  assertHeadZeroState(postCommitUncertainty.reopenedState)
  assert.deepEqual(postCommitUncertainty.callbackCounts, { clock: 0, uuid: 0 })
  assert.deepEqual(postCommitUncertainty.writes, [])
  assert.equal(postCommitUncertainty.rowsUnchanged, true)
})

test('M2-B-03 later failure rolls incomplete ordinary M0/M1 repair back with B2 and permits a clean retry', () => {
  const { historicalRepair } = instrumentationResult()
  assert.notEqual(historicalRepair.error, null)
  assert.equal(historicalRepair.inventoryCount, 0)
  assert.equal(historicalRepair.markerCount, 0)
  assert.deepEqual(historicalRepair.migrationsAfterFailure, [])
  assert.equal(historicalRepair.repairRolledBack, true)
  assert.deepEqual(historicalRepair.columnsAfterFailure, [
    'id',
    'palari_id',
    'user_id',
    'type',
    'content',
    'keywords',
    'importance',
    'valid_from',
    'valid_until',
    'access_count',
    'last_accessed',
    'created_at',
    'shared',
    'confidence',
    'acquisition_mode',
    'created_by_pipeline',
    'source_message_id',
    'content_hash',
  ])
  assert.equal(historicalRepair.transactionInactive, true)
  assert.equal(historicalRepair.retryError, null)
  assert.deepEqual(
    {
      checkpointLinkCount: historicalRepair.retryState.checkpointLinkCount,
      checkpointMemoryCount: historicalRepair.retryState.checkpointMemoryCount,
      headMutationSequence: historicalRepair.retryState.headMutationSequence,
    },
    {
      checkpointLinkCount: 0,
      checkpointMemoryCount: 0,
      headMutationSequence: 0,
    },
  )
  assert.equal(historicalRepair.retryVariant, 'cdx_m1_order_2')
})

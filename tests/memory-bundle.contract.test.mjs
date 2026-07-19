import { test } from 'node:test'
import assert from 'node:assert/strict'

import * as applyModule from '../src/memory-bundle-apply.mjs'
import * as publicModule from '../src/memory-bundle.mjs'
import { BUNDLE_ERROR_CODES } from '../src/memory-bundle-errors.mjs'

const EXPECTED_CODES = [
  'bundle_invalid_argument',
  'bundle_busy',
  'bundle_layout_invalid',
  'bundle_schema_unsupported',
  'bundle_connection_invalid',
  'bundle_not_in_transaction',
  'bundle_invalid_decision',
  'bundle_duplicate_decision_id',
  'bundle_duplicate_proposal_id',
  'bundle_invalid_atom',
  'bundle_invalid_transition',
  'bundle_head_conflict',
  'bundle_meta_mismatch',
  'bundle_missing_atom',
  'bundle_orphan_atom',
  'bundle_id_reuse',
  'bundle_unauthorized',
  'bundle_storage_error',
  'bundle_closed',
]

test('M1-01 exact module namespaces and 19-code error vocabulary', () => {
  assert.deepEqual(Object.keys(applyModule).sort(), [
    'MemoryBundleError',
    'applyResolvedDecisionInTransaction',
    'initializeMemoryBundle',
  ])
  assert.deepEqual(Object.keys(publicModule), ['openMemoryBundle'])
  assert.deepEqual(BUNDLE_ERROR_CODES, EXPECTED_CODES)
  assert.ok(Object.isFrozen(BUNDLE_ERROR_CODES))

  const cause = new Error('native failure')
  const error = new applyModule.MemoryBundleError(
    'bundle_storage_error',
    'storage failed',
    { cause },
  )
  assert.equal(error.name, 'MemoryBundleError')
  assert.equal(error.code, 'bundle_storage_error')
  assert.equal(error.cause, cause)
  assert.deepEqual(Object.keys(error), ['code'])
})

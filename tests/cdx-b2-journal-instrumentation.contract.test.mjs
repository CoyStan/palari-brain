// V2-M2-B Task 4 — captured-native journal write/hash instrumentation.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const REFERENCE_PROVENANCE = Object.freeze({
  commit: 'c9af823c7dee29d29fd937d44527f3b78d8d3845',
  path: 'apps/palari-local-workbench/scripts/workspace-backend/patch-kernel.mjs',
  blob: 'df4de5f00ae88ba670305f9b2bb699441cc5b234',
})

const EXPECTED_DECISIONS = Object.freeze([
  Object.freeze({
    evidenceAt: '2026-07-21T10:00:00.000Z',
    patchId: 'b2p_10000000-0000-4000-8000-000000000001',
    targetId: 'mem_10000000-0000-4000-8000-000000000802',
  }),
  Object.freeze({
    evidenceAt: '2026-07-21T10:00:00.000Z',
    patchId: 'b2p_10000000-0000-4000-8000-000000000002',
    targetId: 'mem_10000000-0000-4000-8000-000000000801',
  }),
])

function independentPatchHash(decision) {
  const record = {
    id: decision.patchId,
    kind: 'ratify',
    payload: {
      operation: 'erase_owned_atom@1',
      atomId: decision.targetId,
    },
    slot: `mem/${decision.targetId}`,
    source: 'ratified_user',
    timestamp: decision.evidenceAt,
  }
  const bytes = JSON.stringify(record)
  return {
    bytes,
    digest: createHash('sha256').update(bytes, 'utf8').digest('hex'),
  }
}

function runInstrumentedChild() {
  const childPath = fileURLToPath(new URL(
    './fixtures/cdx-b2-journal-instrumentation-child.mjs',
    import.meta.url,
  ))
  const result = spawnSync(process.execPath, [childPath], {
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  })
  assert.equal(
    result.status,
    0,
    `instrumentation child failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  )
  return JSON.parse(result.stdout)
}

function phaseEntries(result, phase, kind) {
  return result.traces.filter((entry) =>
    entry.phase === phase && (kind === undefined || entry.kind === kind))
}

function assertHashSequence(result, phase, references) {
  const entries = phaseEntries(result, phase).filter((entry) =>
    entry.kind.startsWith('hash-'))
  const creates = entries.filter((entry) => entry.kind === 'hash-create')
  const updates = entries.filter((entry) => entry.kind === 'hash-update')
  const digests = entries.filter((entry) => entry.kind === 'hash-digest')
  assert.equal(creates.length, references.length, `${phase}: create count`)
  assert.equal(updates.length, references.length, `${phase}: update count`)
  assert.equal(digests.length, references.length, `${phase}: digest count`)

  for (let index = 0; index < references.length; index += 1) {
    const expected = references[index]
    const create = creates[index]
    const update = updates[index]
    const digest = digests[index]
    assert.equal(create.algorithm, 'sha256', `${phase}:${index}: algorithm`)
    assert.equal(update.hashId, create.hashId, `${phase}:${index}: update id`)
    assert.equal(digest.hashId, create.hashId, `${phase}:${index}: digest id`)
    assert.equal(update.algorithm, 'sha256', `${phase}:${index}: update algorithm`)
    assert.equal(digest.algorithm, 'sha256', `${phase}:${index}: digest algorithm`)
    assert.equal(update.inputKind, 'string', `${phase}:${index}: input kind`)
    assert.equal(update.encoding, null, `${phase}:${index}: update encoding`)
    assert.equal(update.bytes, expected.bytes, `${phase}:${index}: exact bytes`)
    assert.equal(digest.encoding, 'hex', `${phase}:${index}: digest encoding`)
    assert.equal(digest.output, expected.digest, `${phase}:${index}: digest`)
  }
}

test('M2-B-04 journal append/advance use only ordered B2 writes and no transaction or projection DML', () => {
  const result = runInstrumentedChild()
  assert.equal(result.states.afterRefusal.headMutationSequence, 1)
  assert.equal(result.states.afterApplied.headMutationSequence, 2)
  assert.deepEqual(result.states.verified, result.states.afterApplied)

  const refusalWrites = phaseEntries(result, 'refusal-append', 'sql')
  assert.equal(refusalWrites.length, 1)
  assert.equal(refusalWrites[0].operation, 'run')
  assert.match(
    refusalWrites[0].sql,
    /^INSERT INTO main\.cdx_b2_decisions\(/,
  )
  assert.equal(refusalWrites[0].parameters[0], 1)
  assert.equal(refusalWrites[0].parameters[9], EXPECTED_DECISIONS[0].targetId)
  assert.equal(refusalWrites[0].parameters[26], 'refused')
  assert.equal(refusalWrites[0].parameters[27], 'missing_target')
  assert.equal(refusalWrites[0].parameters[30], 0)

  const appliedWrites = phaseEntries(result, 'applied-append', 'sql')
  assert.equal(appliedWrites.length, 3)
  assert.deepEqual(
    appliedWrites.map((entry) => entry.operation),
    ['run', 'run', 'run'],
  )
  assert.match(appliedWrites[0].sql, /^INSERT INTO main\.cdx_b2_decisions\(/)
  assert.match(appliedWrites[1].sql, /^INSERT INTO main\.cdx_b2_effects\(/)
  assert.match(appliedWrites[2].sql, /^INSERT INTO main\.cdx_b2_effects\(/)
  assert.equal(appliedWrites[0].parameters[0], 2)
  assert.equal(appliedWrites[0].parameters[9], EXPECTED_DECISIONS[1].targetId)
  assert.equal(appliedWrites[0].parameters[26], 'applied')
  assert.equal(appliedWrites[0].parameters[27], null)
  assert.equal(appliedWrites[0].parameters[30], 2)
  assert.deepEqual(appliedWrites[1].parameters, [
    2,
    0,
    'projection_atom_erased',
    EXPECTED_DECISIONS[1].targetId,
  ])
  assert.deepEqual(appliedWrites[2].parameters, [
    2,
    1,
    'projection_fts_erased',
    EXPECTED_DECISIONS[1].targetId,
  ])

  for (const [phase, sequence, oldHead] of [
    ['refusal-advance', 1, 0],
    ['applied-advance', 2, 1],
  ]) {
    const writes = phaseEntries(result, phase, 'sql')
    assert.equal(writes.length, 1, `${phase}: exactly one write`)
    assert.equal(writes[0].operation, 'run')
    assert.match(writes[0].sql, /^UPDATE main\.cdx_b2_meta SET/)
    assert.match(
      writes[0].sql,
      /WHERE singleton = 1 AND head_mutation_sequence = \?$/,
    )
    assert.deepEqual(writes[0].parameters, [sequence, oldHead])
  }
  assert.deepEqual(phaseEntries(result, 'final-verify', 'sql'), [])

  for (const entry of result.traces.filter((candidate) => candidate.kind === 'sql')) {
    assert.doesNotMatch(
      entry.sql,
      /(?:^|;)\s*(?:BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE)\b/i,
      `${entry.phase}: journal child attempted transaction control`,
    )
    assert.doesNotMatch(
      entry.sql,
      /(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM|REPLACE\s+INTO)\s+(?:main\.)?(?:memories|memory_links|memory_fts|memory_bundle_meta|memory_bundle_events|memory_bundle_atoms)\b/i,
      `${entry.phase}: journal child attempted CDX/B1 projection DML`,
    )
  }
})

test('M2-B-04 every prospective and persisted decision hashes exact pinned reference bytes with SHA-256', () => {
  const source = readFileSync(
    new URL('../src/cdx-b2-journal.mjs', import.meta.url),
    'utf8',
  )
  assert.match(source, new RegExp(REFERENCE_PROVENANCE.commit))
  assert.equal(source.includes(REFERENCE_PROVENANCE.path), true)
  assert.match(source, new RegExp(REFERENCE_PROVENANCE.blob))

  const result = runInstrumentedChild()
  assert.deepEqual(result.decisions, EXPECTED_DECISIONS)
  const references = EXPECTED_DECISIONS.map(independentPatchHash)

  // Append first verifies the committed prefix and then verifies the
  // prospective decision. Advance verifies the complete pending tail before
  // the write and the complete committed tail after it.
  assertHashSequence(result, 'refusal-append', [references[0]])
  assertHashSequence(result, 'refusal-advance', [references[0], references[0]])
  assertHashSequence(result, 'applied-append', references)
  assertHashSequence(result, 'applied-advance', [
    references[0],
    references[1],
    references[0],
    references[1],
  ])
  assertHashSequence(result, 'final-verify', references)
})

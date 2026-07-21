import { existsSync, readFileSync, statSync } from 'node:fs'
import { isAbsolute } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

import {
  applyResolvedDecisionInTransaction,
} from '../../src/memory-bundle-apply.mjs'

const SPILL_ROW_COUNT = 768
const SPILL_PAYLOAD_BYTES = 3000
const MINIMUM_JOURNAL_BYTES = 2 * 1024 * 1024
const CHANGED_PAYLOAD = 'B'.repeat(SPILL_PAYLOAD_BYTES)
const HOT_JOURNAL_MAGIC = 'd9d505f920a163d7'

const argumentsAfterExecutable = process.argv.slice(2)
if (
  argumentsAfterExecutable.length !== 1 ||
  typeof argumentsAfterExecutable[0] !== 'string' ||
  argumentsAfterExecutable[0].includes('\0') ||
  !isAbsolute(argumentsAfterExecutable[0])
) {
  throw new Error('Expected exactly one absolute database path.')
}

const dbPath = argumentsAfterExecutable[0]
const journalPath = `${dbPath}-journal`
if (!statSync(dbPath).isFile()) {
  throw new Error('The database path must identify an existing file.')
}
const db = new DatabaseSync(dbPath, { readOnly: false, timeout: 0 })

function readSingleValue(sql) {
  const values = Object.values(db.prepare(sql).get())
  if (values.length !== 1) throw new Error(`Expected one value from ${sql}`)
  return values[0]
}

if (readSingleValue('PRAGMA main.journal_mode=DELETE') !== 'delete') {
  throw new Error('The child requires DELETE journal mode.')
}
db.exec(`
  PRAGMA foreign_keys=ON;
  PRAGMA busy_timeout=0;
  PRAGMA recursive_triggers=ON;
  PRAGMA ignore_check_constraints=OFF;
  PRAGMA synchronous=FULL;
  PRAGMA cache_size=8;
  PRAGMA cache_spill=ON;
`)

const requiredPragmas = {
  foreign_keys: 1,
  busy_timeout: 0,
  recursive_triggers: 1,
  ignore_check_constraints: 0,
}
for (const [name, expected] of Object.entries(requiredPragmas)) {
  if (readSingleValue(`PRAGMA ${name}`) !== expected) {
    throw new Error(`Required PRAGMA ${name} was not configured.`)
  }
}

db.exec('BEGIN IMMEDIATE')
const spillMutation = db.prepare(`
  UPDATE main.m113_test_owned_spill
  SET payload = ?
`).run(CHANGED_PAYLOAD)
if (spillMutation.changes !== SPILL_ROW_COUNT) {
  throw new Error('The spill mutation did not update every pre-existing row.')
}

const head = db.prepare(`
  SELECT stream_id, head_sequence
  FROM main.memory_bundle_meta
  WHERE singleton = 1
`).get()
applyResolvedDecisionInTransaction(db, {
  expectedHead: {
    streamId: head.stream_id,
    sequence: head.head_sequence,
  },
  decision: {
    decisionId: 'dec_00000000-0000-4000-8000-000000001301',
    proposalId: 'prp_00000000-0000-4000-8000-000000001302',
    proposalKind: 'permanent',
    operation: 'create',
    outcome: 'applied',
    reasonCode: null,
    scope: { palariId: 'palari-a', userId: 'user-1' },
    authority: { kind: 'user', authorityId: 'user-1' },
    evidenceKind: 'direct_user_message',
    memoryId: 'mem_00000000-0000-4000-8000-000000001303',
    memoryType: 'preference',
    effectiveAt: '2026-07-18T12:59:00.000Z',
    observedAt: '2026-07-18T13:00:00.000Z',
  },
  atom: {
    content: 'M1-13 uncommitted crash memory.',
    keywords: ['crash', 'uncommitted'],
    initialImportance: 0.625,
    confidence: 0.875,
    provenanceKind: 'direct_user_message',
    sourceMessageId: null,
    fictional: false,
  },
})

const mutatedState = db.prepare(`
  SELECT
    (SELECT head_sequence FROM main.memory_bundle_meta WHERE singleton = 1)
      AS headSequence,
    (SELECT count(*) FROM main.memory_bundle_events) AS eventCount,
    (SELECT count(*) FROM main.memory_bundle_atoms) AS atomCount,
    (SELECT count(*) FROM main.m113_test_owned_spill WHERE payload = ?)
      AS changedSpillCount
`).get(CHANGED_PAYLOAD)
if (
  db.isTransaction !== true ||
  mutatedState.headSequence !== head.head_sequence + 1 ||
  mutatedState.eventCount !== 2 ||
  mutatedState.atomCount !== 2 ||
  mutatedState.changedSpillCount !== SPILL_ROW_COUNT
) {
  throw new Error('The child transaction was not fully mutated before readiness.')
}

const journal = existsSync(journalPath) ? statSync(journalPath) : undefined
const journalMagic = journal === undefined
  ? ''
  : readFileSync(journalPath).subarray(0, 8).toString('hex')
if (
  journal === undefined ||
  !journal.isFile() ||
  journal.size <= MINIMUM_JOURNAL_BYTES ||
  journalMagic !== HOT_JOURNAL_MAGIC
) {
  throw new Error('The rollback journal did not exceed the minimum size.')
}

process.stdout.write('READY\n')
setInterval(() => {}, 60_000)

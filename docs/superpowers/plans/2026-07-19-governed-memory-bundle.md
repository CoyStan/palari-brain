# Governed Memory Bundle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and prove the non-authoritative CDX-B1 governed-memory bundle in the existing per-workspace SQLite file, with atomic initialization, caller-owned transactional apply, fail-closed verification, deterministic current-state replay, and no CDX-M1 runtime cutover.

**Architecture:** Keep the two contractual modules minimal and exact: `src/memory-bundle-apply.mjs` owns the internal initialization/apply boundary, while `src/memory-bundle.mjs` owns public recovery/open/verify/replay/close. Focused private modules capture native intrinsics, define the exact SQLite manifest, validate hostile JavaScript input, encode canonical atoms, and perform the single deterministic verifier used by every path. Real-SQLite tests prove durable behavior; subprocess tests using `node:module.registerHooks` prove private call order, native dispatch capture, race branches, and cleanup failures without adding a public or test-only export.

**Tech Stack:** Node.js 22.22.2, built-in `node:sqlite` with SQLite 3.51.2, ESM, `node:test`, `node:assert/strict`, `node:module.registerHooks`, built-in `node:crypto`, built-in filesystem/path/URL APIs; zero package dependencies.

## Global Constraints

- Read `AGENTS.md`, `STATUS.md`, and `docs/MEMORY-BUNDLE-CONTRACT.md` before each task. The contract is normative only for CDX-B1; CDX-M1 remains runtime authority.
- Runtime certification target is exactly Node `22.22.2` with bundled SQLite `3.51.2`. `package.json` remains dependency-free and keeps `engines.node` at `>=22.22.2`.
- Public exports are exact. `src/memory-bundle-apply.mjs` exports only `MemoryBundleError`, `initializeMemoryBundle`, and `applyResolvedDecisionInTransaction`. `src/memory-bundle.mjs` exports only `openMemoryBundle`.
- Stable error vocabulary is exactly the 19 codes in `docs/MEMORY-BUNDLE-CONTRACT.md:1324-1344`. Do not export an error-code list from either contractual module.
- The capability object has exactly six own properties, all `false`, is frozen once, and is reused by identity by the public handle and every successful `verify()`/`replay()` result.
- Every persistent bundle object, read, DML statement, and structural PRAGMA targets schema `main`. TEMP/attached shadows never satisfy the bundle.
- Initialization may own transactions only as specified by the contract. Apply never begins, commits, rolls back, retries, closes, or returns a receipt.
- Do not add runtime gate integration, dual writing, projections, drivers, vectors, graphs, provider-native memory, historical replay, physical-deletion claims, signatures, Merkle structures, or external anchors.
- Do not modify provider, benchmark, prediction, U8 checkpoint/result, key, dataset, or publication paths. Do not execute final U8 question `1568498a`.
- Keep `src/store.mjs`, `src/gate.mjs`, `src/adapter.mjs`, and current CDX-M1 behavior unchanged during implementation.
- All code must use captured native constructors, getters, methods, and intrinsics as required by the contract. Caller methods, dynamic prototypes, coercion, getters, iterators, and Proxy traps are outside the supported path.
- Test every RED before its GREEN. Run each task’s focused command, then its listed regression command. Commit only after both pass.
- Before the first implementation commit, confirm the work is on a non-default branch. Never commit directly to `main`.

---

## File Map

### Production files

- **Create `src/memory-bundle-errors.mjs`** — private closed error vocabulary, `MemoryBundleError`, and native/callback error translation.
- **Create `src/memory-bundle-runtime.mjs`** — module-evaluation intrinsic capture, one unopened DatabaseSync brand probe, captured native dispatch, exact row-mode normalization, transaction/open checks, Proxy-first reflection helpers, and module-owned database construction.
- **Create `src/memory-bundle-schema.mjs`** — shared capabilities singleton, exact 13-object `{executionSql,persistedSql}` manifest, five expected autoindexes, exact trigger-target inventory, SQL normalizer, PRAGMA descriptors, and structural metadata manifests.
- **Create `src/memory-bundle-codec.mjs`** — identifier/time/vocabulary validation, exact descriptor snapshots, keyword-array capture, Unicode scalar ordering, canonical JSON, SHA-256 atom checksum, row encoding/decoding, and staged apply-input capture.
- **Create `src/memory-bundle-verify.mjs`** — connection-policy checks, borrowed TEMP-trigger rejection, meta preflight, exact structural verification, deterministic event reduction, atom verification, current-state correspondence, and replay-ready verified state.
- **Create `src/memory-bundle-apply.mjs`** — exact public mutation module; exports `MemoryBundleError`, atomic/idempotent `initializeMemoryBundle`, and caller-owned `applyResolvedDecisionInTransaction` only.
- **Create `src/memory-bundle.mjs`** — exact public read module; create-disabled writable recovery, final read-only open, frozen receiver-independent handle, read transactions, poison/close lifecycle, verify/replay shaping.

### Test files

- **Create `tests/helpers/memory-bundle-fixtures.mjs`** — deterministic UUID/timestamp/decision/atom builders, temporary database lifecycle, native SQLite helpers, transaction coordinator, schema snapshots, and privileged corruption helpers. It imports private modules only where a pure vector or exact private manifest must be asserted.
- **Create `tests/memory-bundle.contract.test.mjs`** — exact module namespaces, error class/vocabulary, capabilities identity, initialization, apply matrix, CAS, duplicate IDs, mutation order, rollback, deletion, and no-receipt law.
- **Create `tests/memory-bundle-verification.contract.test.mjs`** — exact manifest, SQL/PRAGMA metadata, main/TEMP/attached shadow behavior, semantic corruption, verification precedence, missing/orphan merge order, replay shape/order, and all stored-state error codes.
- **Create `tests/memory-bundle-public.contract.test.mjs`** — absolute-path domain, recovery/final-open sequence, no file creation, encoded paths, frozen receiver-independent handle, read-only lifecycle, cleanup, and hard failure mapping.
- **Create `tests/memory-bundle-instrumentation.contract.test.mjs`** — parent tests for instrumented subprocess scenarios covering one probe, captured dispatch, statement row-mode normalization, race-window branches, callback call order, and rollback/close fault precedence.
- **Create `tests/memory-bundle-coexistence.contract.test.mjs`** — same-file CDX-M1 coexistence, no dual write, unchanged schema/data/pragmas/runtime imports, provider-free scope checks, and final dependency/changed-path assertions.
- **Create `tests/fixtures/memory-bundle-instrumentation-child.mjs`** — `registerHooks` subprocess runner that imports native `node:sqlite` first, redirects later `node:sqlite` imports to instrumented wrappers, dynamically imports the target bundle module, runs one named scenario, and emits one JSON result.
- **Create `tests/fixtures/memory-bundle-hot-journal-child.mjs`** — child that opens `journal_mode=DELETE`, starts `BEGIN IMMEDIATE`, applies one decision, reports readiness after the journal is materialized, and waits to be killed before commit.

---

### Task 0: Seal the reviewed contract and plan cut point

**Files:**
- Modify only the already-reviewed governance/contract files currently in the working tree.
- Add: `docs/MEMORY-BUNDLE-CONTRACT.md`
- Add: `docs/superpowers/plans/2026-07-19-governed-memory-bundle.md`
- Do not create or stage bundle implementation files in this task.

**Interfaces:**
- Produces one immutable Git base commit for all later implementation-scope diffs.
- Replaces the historical `STATUS.md` temporary log marker with the actual short hash in a second evidence-only commit.

- [ ] **Step 1: Leave `main` before committing**

```bash
git switch -c v2-m1-governed-memory-bundle
```

Expected: current branch becomes `v2-m1-governed-memory-bundle`; all existing working-tree changes remain present.

- [ ] **Step 2: Re-run the reviewed-document checks**

```bash
git diff --check
npm test
```

Expected: no whitespace output; the existing 47 tests PASS before any M1 implementation exists.

- [ ] **Step 3: Stage only the reviewed contract/governance/plan cut point**

```bash
git add \
  AGENTS.md \
  README.md \
  STATUS.md \
  docs/DECISIONS.md \
  docs/KERNEL-API.md \
  docs/KERNEL-CONTRACT.md \
  docs/PALARI-V2-ARCHITECTURE.md \
  docs/MEMORY-BUNDLE-CONTRACT.md \
  docs/superpowers/plans/2026-07-19-governed-memory-bundle.md \
  package.json \
  src/gate.mjs \
  tests/gate.contract.test.mjs

git diff --cached --check
git diff --cached --name-only
```

Expected: the cached path list is exactly the paths above; no implementation source/test file is present.

- [ ] **Step 4: Commit the contract and plan**

```bash
git commit -m "BRAIN V2-M1: seal governed bundle contract and plan" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

- [ ] **Step 5: Record the real cut-point hash in `STATUS.md`**

```bash
CUT_POINT_SHORT="$(git rev-parse --short HEAD)"
python - "$CUT_POINT_SHORT" <<'PY'
from pathlib import Path
import sys

path = Path('STATUS.md')
text = path.read_text()
old = '2026-07-18 — V2-M1 — see `git log` — Founder ratified autonomous local'
new = f'2026-07-18 — V2-M1 — {sys.argv[1]} — Founder ratified autonomous local'
if text.count(old) != 1:
    raise SystemExit('expected one V2-M1 temporary log marker')
path.write_text(text.replace(old, new))
PY

git add STATUS.md
git diff --cached --check
git commit -m "BRAIN V2-M1: record contract cut point" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

- [ ] **Step 6: Push the documentation cut point**

```bash
git push -u origin v2-m1-governed-memory-bundle
```

Expected: the remote branch contains the reviewed contract/plan and the actual hash log update; no bundle implementation exists yet.

---

### Task 1: Establish exact public namespaces and the closed error type

**Files:**
- Create: `src/memory-bundle-errors.mjs`
- Create: `src/memory-bundle-apply.mjs`
- Create: `src/memory-bundle.mjs`
- Create: `tests/memory-bundle.contract.test.mjs`

**Interfaces:**
- Consumes: no new module.
- Produces:
  - `MemoryBundleError extends Error` with `name === 'MemoryBundleError'`, own enumerable `code`, non-empty `message`, and optional native/callback `cause`.
  - Private frozen `BUNDLE_ERROR_CODES` containing exactly the 19 contract codes.
  - Exact public module namespaces; no default exports and no extra named exports.

- [ ] **Step 1: Write the namespace and error RED tests**

```js
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
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
node --test --test-name-pattern='^M1-01 ' tests/memory-bundle.contract.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/memory-bundle-apply.mjs` or `src/memory-bundle-errors.mjs`.

- [ ] **Step 3: Implement the closed private error module and exact public shells**

```js
// src/memory-bundle-errors.mjs
export const BUNDLE_ERROR_CODES = Object.freeze([
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
])

const BUNDLE_ERROR_CODE_SET = new Set(BUNDLE_ERROR_CODES)

export class MemoryBundleError extends Error {
  constructor(code, message, options = {}) {
    if (!BUNDLE_ERROR_CODE_SET.has(code)) {
      throw new TypeError(`Unknown memory bundle error code: ${String(code)}`)
    }
    super(message, options.cause === undefined ? undefined : { cause: options.cause })
    Object.defineProperty(this, 'name', {
      value: 'MemoryBundleError',
      enumerable: false,
      configurable: true,
      writable: true,
    })
    Object.defineProperty(this, 'code', {
      value: code,
      enumerable: true,
      configurable: false,
      writable: false,
    })
  }
}

export function memoryBundleFailure(code, message, cause) {
  return new MemoryBundleError(code, message, cause === undefined ? {} : { cause })
}

export function preserveMemoryBundleError(error, code, message) {
  if (error instanceof MemoryBundleError) return error
  return memoryBundleFailure(code, message, error)
}
```

Create the two public modules with only the contract names. At this cut point, each function performs a real first-stage invalid-argument failure rather than returning an invented success value:

```js
// src/memory-bundle-apply.mjs
import { MemoryBundleError } from './memory-bundle-errors.mjs'

export { MemoryBundleError }

export function initializeMemoryBundle() {
  throw new MemoryBundleError('bundle_invalid_argument', 'A DatabaseSync connection is required.')
}

export function applyResolvedDecisionInTransaction() {
  throw new MemoryBundleError('bundle_invalid_argument', 'A DatabaseSync connection is required.')
}
```

```js
// src/memory-bundle.mjs
import { MemoryBundleError } from './memory-bundle-errors.mjs'

export function openMemoryBundle() {
  throw new MemoryBundleError('bundle_invalid_argument', 'An exact dbPath options object is required.')
}
```

- [ ] **Step 4: Run focused and full current tests**

```bash
node --test --test-name-pattern='^M1-01 ' tests/memory-bundle.contract.test.mjs
npm test
```

Expected: M1-01 PASS; the existing 47 tests and the new namespace test PASS.

- [ ] **Step 5: Commit the cut point**

```bash
git add src/memory-bundle-errors.mjs src/memory-bundle-apply.mjs src/memory-bundle.mjs tests/memory-bundle.contract.test.mjs
git commit -m "BRAIN V2-M1: establish exact bundle module boundaries" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Capture native SQLite and JavaScript intrinsics once

**Files:**
- Create: `src/memory-bundle-runtime.mjs`
- Modify: `src/memory-bundle-apply.mjs`
- Modify: `tests/memory-bundle.contract.test.mjs`
- Create: `tests/fixtures/memory-bundle-instrumentation-child.mjs`
- Create: `tests/memory-bundle-instrumentation.contract.test.mjs`

**Interfaces:**
- Consumes: `MemoryBundleError`, `memoryBundleFailure`, and `preserveMemoryBundleError` from Task 1.
- Produces private functions:
  - `assertOpenDatabaseSync(value): void`
  - `readDatabaseTransactionState(db): boolean`
  - `constructDatabase(args): DatabaseSync`
  - `execDatabase(db, sql): void`
  - `prepareRowStatement(db, sql): StatementSync`
  - `statementGet(statement, parameters)`, `statementAll(statement, parameters)`, `statementRun(statement, parameters)`, where `parameters` is a captured ordinary array passed through captured `Reflect.apply`.
  - `closeDatabase(db): void`
  - `isProxyValue(value): boolean`
  - `captureExactRecord(value, specification): captured plain object`
  - captured Date/path/URL/UUID/hash helpers used by later tasks.

- [ ] **Step 1: Write RED tests for native branding and trap-free Proxy rejection**

Add tests that prove:

```js
test('M1-02 database branding rejects spoofs and Proxies without traps', () => {
  const real = new DatabaseSync(':memory:')
  const proxy = new Proxy(real, {
    get() { throw new Error('trap ran') },
    getPrototypeOf() { throw new Error('trap ran') },
  })
  const spoof = Object.create(Object.getPrototypeOf(real))

  assertBundleCode(() => initializeMemoryBundle(proxy), 'bundle_invalid_argument')
  assertBundleCode(() => initializeMemoryBundle(spoof), 'bundle_invalid_argument')

  real.close()
  assertBundleCode(() => initializeMemoryBundle(real), 'bundle_connection_invalid')
})
```

The instrumentation parent test launches one child scenario and asserts the trace starts with exactly one constructor call using `[':memory:', {open:false}]` before any operational connection.

- [ ] **Step 2: Run the focused tests and confirm RED**

```bash
node --test --test-name-pattern='^M1-02 ' tests/memory-bundle.contract.test.mjs tests/memory-bundle-instrumentation.contract.test.mjs
```

Expected: FAIL because the public function still unconditionally reports `bundle_invalid_argument` and the instrumentation child does not exist.

- [ ] **Step 3: Implement module-evaluation capture and native dispatch**

Use imported `DatabaseSync`/`StatementSync`, but invoke all captured operations through captured `Reflect.apply`/`Reflect.construct`. Capture the own getters from one never-opened probe inside an IIFE so the probe itself is not retained:

```js
const reflectApply = Reflect.apply
const reflectConstruct = Reflect.construct
const reflectGetPrototypeOf = Reflect.getPrototypeOf
const reflectOwnKeys = Reflect.ownKeys
const reflectGetOwnPropertyDescriptor = Reflect.getOwnPropertyDescriptor

const databaseExec = DatabaseSync.prototype.exec
const databasePrepare = DatabaseSync.prototype.prepare
const databaseClose = DatabaseSync.prototype.close
const statementGetNative = StatementSync.prototype.get
const statementAllNative = StatementSync.prototype.all
const statementRunNative = StatementSync.prototype.run
const statementSetReadBigInts = StatementSync.prototype.setReadBigInts
const statementSetReturnArrays = StatementSync.prototype.setReturnArrays

const { databaseIsOpen, databaseIsTransaction } = (() => {
  const probe = reflectConstruct(DatabaseSync, [':memory:', { open: false }])
  return {
    databaseIsOpen: reflectGetOwnPropertyDescriptor(probe, 'isOpen').get,
    databaseIsTransaction: reflectGetOwnPropertyDescriptor(probe, 'isTransaction').get,
  }
})()
```

`assertOpenDatabaseSync` must call captured `isProxy` first, classify illegal getter invocation as `bundle_invalid_argument`, and classify native `isOpen === false` as `bundle_connection_invalid`. Do not use `instanceof`, constructor/prototype equality, symbols, or caller methods.

Every row-returning statement is normalized before `get`/`all`:

```js
export function prepareRowStatement(db, sql) {
  const statement = reflectApply(databasePrepare, db, [sql])
  reflectApply(statementSetReadBigInts, statement, [false])
  reflectApply(statementSetReturnArrays, statement, [false])
  return statement
}
```

Update `initializeMemoryBundle` to perform only Task 2’s database brand/open/transaction classification, then throw `bundle_layout_invalid` for a valid open non-transactional database until schema work lands.

- [ ] **Step 4: Implement the reusable instrumentation child foundation**

The child must:

1. Import real `node:sqlite` before registering hooks.
2. Put instrumented wrapper constructors on a subprocess-only `globalThis` slot.
3. Register synchronous `resolve`/`load` hooks that redirect later `node:sqlite` imports to a synthetic ESM source exporting those wrappers.
4. Dynamically import the requested bundle module only after registration.
5. Execute one scenario named by `process.argv[2]`.
6. Emit exactly one JSON object to stdout and diagnostics to stderr.

The synthetic source is exact and contains no filesystem import:

```js
export const DatabaseSync = globalThis.__palariMemoryBundleSqlite.DatabaseSync
export const StatementSync = globalThis.__palariMemoryBundleSqlite.StatementSync
```

- [ ] **Step 5: Run focused and regression tests**

```bash
node --test --test-name-pattern='^M1-02 ' tests/memory-bundle.contract.test.mjs tests/memory-bundle-instrumentation.contract.test.mjs
npm test
```

Expected: branding, Proxy trap-count, one-probe, and captured row-mode tests PASS; all prior tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/memory-bundle-runtime.mjs src/memory-bundle-apply.mjs tests/memory-bundle.contract.test.mjs tests/memory-bundle-instrumentation.contract.test.mjs tests/fixtures/memory-bundle-instrumentation-child.mjs
git commit -m "BRAIN V2-M1: capture native bundle intrinsics" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Pin the exact CDX-B1 SQL, PRAGMA, and capability manifests

**Files:**
- Create: `src/memory-bundle-schema.mjs`
- Create: `tests/helpers/memory-bundle-fixtures.mjs`
- Modify: `tests/memory-bundle-verification.contract.test.mjs` (create the file in this task)

**Interfaces:**
- Produces private frozen constants:
  - `MEMORY_BUNDLE_CAPABILITIES`
  - `MEMORY_BUNDLE_SCHEMA_VERSION === 'CDX-B1'`
  - `MEMORY_BUNDLE_OBJECTS`: exactly 13 frozen entries with `{type,name,executionSql,persistedSql}`
  - `MEMORY_BUNDLE_AUTOINDEXES`: exactly five names and expected `index_xinfo` metadata
  - `MEMORY_BUNDLE_TRIGGER_TARGETS`: exactly eight canonical pairs
  - `MEMORY_BUNDLE_REQUIRED_PRAGMAS`
  - `normalizeMemoryBundleSql(sql)` implementing only the three allowed operations.

- [ ] **Step 1: Write RED manifest tests**

The test must assert:

- exact object counts: 3 tables, 2 named indexes, 8 triggers;
- an independent test-only `EXPECTED_PERSISTED_SQL` map copied literally from the contract, never imported by production, against which both the production manifest and stored `main.sqlite_schema.sql` are compared;
- independent test-only expected `table_xinfo`, `index_list`, `index_xinfo`, and `foreign_key_list` projections so implementation constants cannot serve as their own oracle;
- exact five autoindex names;
- exact six-key frozen all-false capability object;
- exact table column counts: meta 5, events 17, atoms 16;
- every application column default is SQL NULL;
- SQL normalization changes only CRLF, outer ASCII whitespace, and one trailing semicolon;
- no event column contains content, keyword, source-message, free-text, extractor/model, or checksum payload.

- [ ] **Step 2: Run and confirm RED**

```bash
node --test --test-name-pattern='^M1-03 ' tests/memory-bundle-verification.contract.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/memory-bundle-schema.mjs`.

- [ ] **Step 3: Implement the exact manifests**

Copy the 13 `persistedSql` statements byte-for-byte from `docs/MEMORY-BUNDLE-CONTRACT.md:841-1060`. For each entry, write an explicit `executionSql` string with only the declaration changes in `docs/MEMORY-BUNDLE-CONTRACT.md:824-830`:

- `CREATE TABLE main.<name>` for tables;
- for indexes, qualify only the created index name with `main.` and keep the contract's unqualified `ON memory_bundle_events` target and full column/predicate body;
- for triggers, qualify only the created trigger name with `main.` and keep the contract's unqualified canonical table target and full trigger body.

Do not generate one SQL form from the other at runtime. Freeze every entry and the containing array. Implement the normalizer literally:

```js
export function normalizeMemoryBundleSql(sql) {
  let normalized = sql.replaceAll('\r\n', '\n').replace(/^[\t\n\v\f\r ]+|[\t\n\v\f\r ]+$/g, '')
  normalized = normalized.replace(/;[\t\n\v\f\r ]*$/, '')
  return normalized.replace(/[\t\n\v\f\r ]+$/g, '')
}
```

The capabilities singleton is:

```js
export const MEMORY_BUNDLE_CAPABILITIES = Object.freeze({
  sourceOfTruth: false,
  physicalDeletion: false,
  deletionProvable: false,
  signed: false,
  cryptographicAudit: false,
  externalAnchorRequired: false,
})
```

- [ ] **Step 4: Execute the manifest under shadows**

Add a real SQLite test that creates same-named TEMP tables and attached-database tables first, executes every `executionSql`, and proves all 13 application objects landed in `main`; stored `main.sqlite_schema.sql` must equal each `persistedSql` after the exact normalizer.

- [ ] **Step 5: Run tests**

```bash
node --test --test-name-pattern='^M1-03 ' tests/memory-bundle-verification.contract.test.mjs
npm test
```

Expected: exact manifest, capability, normalizer, and main-shadow tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/memory-bundle-schema.mjs tests/helpers/memory-bundle-fixtures.mjs tests/memory-bundle-verification.contract.test.mjs
git commit -m "BRAIN V2-M1: pin the exact CDX-B1 manifest" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Implement descriptor-only input capture and canonical atom encoding

**Files:**
- Create: `src/memory-bundle-codec.mjs`
- Modify: `tests/memory-bundle.contract.test.mjs`
- Modify: `tests/memory-bundle-verification.contract.test.mjs`
- Modify: `tests/helpers/memory-bundle-fixtures.mjs`

**Interfaces:**
- Produces private functions:
  - `captureInitializerOptions(value)`
  - `captureOpenOptions(value)`
  - `captureApplyEnvelope(value)`
  - `captureDecision(value)`, `captureScope(value)`, `captureAuthority(value)`, `captureAtom(value)`, `captureKeywords(value)`
  - `validateIdentity`, `validatePrefixedUuidV4`, `validateTimestamp`, `validateMemoryType`
  - `compareUnicodeScalarStrings`
  - `computeMemoryBundleAtomChecksum(atom)`
  - `encodeAtomRow(atom)`, `decodeAtomRow(row)`, `decodeEventRow(row)`.

- [ ] **Step 1: Write RED exact-shape and Proxy tests**

For every record/array position, test a live Proxy and a revoked Proxy with trap counters. Also test:

- wrong prototype, null prototype, cross-realm plain object, array instead of record;
- inherited-only key, missing key, extra key, symbol, accessor, non-enumerable data property;
- keyword holes, indexed accessor, extra property, symbol, noncanonical index key, modified `length` descriptor, cross-realm array, inherited `toJSON`;
- child short-circuiting: malformed top-level input must not inspect `expectedHead`; malformed decision must not inspect scope; wrong NULL-only atom shape must not inspect `keywords`.

Expected shape codes are assigned by contract table `docs/MEMORY-BUNDLE-CONTRACT.md:1346-1358`.

- [ ] **Step 2: Write RED scalar and checksum tests**

Use this exact checksum vector:

```js
const CHECKSUM_VECTOR = {
  memoryId: 'mem_00000000-0000-4000-8000-000000000004',
  streamId: 'str_00000000-0000-4000-8000-000000000001',
  createdSequence: 1,
  palariId: 'palari-a',
  userId: 'user-1',
  type: 'preference',
  content: 'Prefers tea.\nSays "no sugar".',
  keywords: ['no sugar', 'tea'],
  initialImportance: 0.75,
  confidence: 0.875,
  provenanceKind: 'direct_user_message',
  sourceMessageId: null,
  validFrom: '2026-07-18T11:59:00.000Z',
  createdAt: '2026-07-18T12:00:00.000Z',
  fictional: false,
}

assert.equal(
  computeMemoryBundleAtomChecksum(CHECKSUM_VECTOR),
  '7b73a4dd7913043b54961fb0d97ac3a09ba433f744ce5162b0d9af6224b21ab8',
)
```

Test all identifier families, strict timestamp round trips, invalid calendar dates, and no coercion. Reject unpaired surrogates in `content` and every other checksum-covered string, distinguish composed/decomposed Unicode, enforce scalar-value keyword ordering and duplicate rejection, reject negative zero independently in both `initialImportance` and `confidence`, reject NaN/Infinity/out-of-range values, require canonical JSON, and require exact 64-lowercase-hex output.

- [ ] **Step 3: Run and confirm RED**

```bash
node --test --test-name-pattern='^M1-04 ' tests/memory-bundle.contract.test.mjs tests/memory-bundle-verification.contract.test.mjs
```

Expected: FAIL because codec exports do not exist.

- [ ] **Step 4: Implement Proxy-first descriptor snapshots**

Every record capture follows this order:

```js
if (isProxyValue(value)) throw memoryBundleFailure(code, `${label} must not be a Proxy.`)
if (value === null || typeof value !== 'object' || arrayIsArray(value)) fail()
if (reflectGetPrototypeOf(value) !== OBJECT_PROTOTYPE) fail()
const keys = reflectOwnKeys(value)
const descriptors = new Map(keys.map((key) => [key, reflectGetOwnPropertyDescriptor(value, key)]))
```

Validate key identity and descriptors from the snapshot, then return a fresh module-realm object populated only from descriptor `.value`. Never read a caller property again.

`captureKeywords` must reject a Proxy before `Array.isArray`, require exact module-realm `Array.prototype`, validate the standard own `length` descriptor, require dense own enumerable data indexes `0..length-1`, and build a fresh ordinary array from descriptor values.

- [ ] **Step 5: Implement intrinsic dates, scalar keyword ordering, and checksum**

- Parse persisted timestamps with captured `Reflect.construct(Date, [value])` and captured original `Date.prototype.toISOString`.
- Validate callback Date results by applying the captured original `toISOString` directly to the returned object.
- Compare keyword strings by numeric Unicode code point and shorter-prefix-first, never `localeCompare` and never normalization.
- Reject unpaired surrogates before JSON serialization.
- Hash `palari-memory-bundle-atom-v1\0` plus `JSON.stringify` of the exact 16-element array in contract `docs/MEMORY-BUNDLE-CONTRACT.md:565-584`.

- [ ] **Step 6: Run focused and regression tests**

```bash
node --test --test-name-pattern='^M1-04 ' tests/memory-bundle.contract.test.mjs tests/memory-bundle-verification.contract.test.mjs
npm test
```

Expected: hostile-object tests run zero traps/getters; scalar and checksum vectors PASS.

- [ ] **Step 7: Commit**

```bash
git add src/memory-bundle-codec.mjs tests/helpers/memory-bundle-fixtures.mjs tests/memory-bundle.contract.test.mjs tests/memory-bundle-verification.contract.test.mjs
git commit -m "BRAIN V2-M1: canonicalize bundle input and atoms" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: Build exact structural verification and connection policy checks

**Files:**
- Create: `src/memory-bundle-verify.mjs`
- Modify: `src/memory-bundle-schema.mjs`
- Modify: `tests/memory-bundle-verification.contract.test.mjs`
- Modify: `tests/helpers/memory-bundle-fixtures.mjs`

**Interfaces:**
- Produces:
  - `configureOwnedBundleConnection(db): void` — set and verify the four required PRAGMAs.
  - `assertBorrowedBundleConnection(db): void` — verify four PRAGMAs without changing them.
  - `rejectCanonicalTempTriggers(db): void` — borrowed initialize/apply precondition.
  - `verifyMemoryBundleState(db): VerifiedBundleState` — owns no transaction and performs no writes.

`VerifiedBundleState` is private and exact:

```js
{
  checkpoint: { streamId, sequence },
  memories,
  retainedByMemoryId,
  seenDecisionIds,
  seenProposalIds,
  lastObservedAt,
}
```

- [ ] **Step 1: Write RED structural precedence tests**

Cover the contract order exactly:

1. missing/wrong-type meta;
2. unreadable meta preflight or not exactly one singleton row;
3. unsupported schema version;
4. exact application and autoindex inventory;
5. exact canonical-table trigger-target pairs and arbitrary-name main-trigger rejection;
6. stored SQL versus `persistedSql`;
7. exact `table_xinfo`, `index_list`, `index_xinfo`, and `foreign_key_list` projections;
8. empty `foreign_key_check` and one-row `quick_check === ok`;
9. remaining meta values.

Add two-fault cases proving unsupported schema wins before a CDX-B1 inventory mismatch, while layout/integrity failures in step 4 win before semantic interpretations. Produce a real non-`ok` `PRAGMA main.quick_check` by inserting CHECK-invalid data under `ignore_check_constraints=ON`, restoring it to `OFF`, and running the normal verifier; do not inject quick-check output through the hook harness.

- [ ] **Step 2: Write RED connection-policy tests**

- Owned connections end with `foreign_keys=1`, `busy_timeout=0`, `recursive_triggers=1`, `ignore_check_constraints=0`.
- Borrowed apply connections with any wrong value fail `bundle_connection_invalid` without being modified.
- Borrowed initialize/apply rejects any TEMP trigger whose ASCII-folded `tbl_name` matches a canonical table, including a trigger bound to a TEMP shadow.
- Unrelated TEMP triggers and attached/main objects remain permitted.
- No path changes `journal_mode`.

- [ ] **Step 3: Run and confirm RED**

```bash
node --test --test-name-pattern='^M1-05 ' tests/memory-bundle-verification.contract.test.mjs
```

Expected: FAIL with missing verifier exports.

- [ ] **Step 4: Implement structural verification**

Use only normalized row statements from Task 2. All queries are `main` qualified. Meta preflight must be deliberately minimal before schema-version classification; full CDX-B1 assumptions begin only after version acceptance.

Sort deterministically:

- schema names and trigger names by code-unit/BINARY order;
- `table_xinfo` by numeric `cid`;
- `index_list` by exact name after dropping only `seq`;
- `index_xinfo` by numeric `seqno`;
- foreign keys by `{table,from,to,on_update,on_delete,match}` after dropping only `id` and `seq`.

Map any mismatch in the structural phase to `bundle_layout_invalid`. Map invalid remaining meta identity/time/head to `bundle_meta_mismatch`.

- [ ] **Step 5: Run tests**

```bash
node --test --test-name-pattern='^M1-05 ' tests/memory-bundle-verification.contract.test.mjs
npm test
```

Expected: structural order, trigger/shadow, PRAGMA, and no-repair snapshot tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/memory-bundle-verify.mjs src/memory-bundle-schema.mjs tests/helpers/memory-bundle-fixtures.mjs tests/memory-bundle-verification.contract.test.mjs
git commit -m "BRAIN V2-M1: verify the exact bundle layout" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: Add deterministic event reduction, atom correspondence, and replay state

**Files:**
- Modify: `src/memory-bundle-verify.mjs`
- Modify: `src/memory-bundle-codec.mjs`
- Modify: `tests/memory-bundle-verification.contract.test.mjs`

**Interfaces:**
- Extends `verifyMemoryBundleState(db)` to complete contract steps 6-13.
- Private retained reducer value:

```js
memoryId -> {
  palariId,
  userId,
  status: 'active' | 'deleted',
  createEvent,
}
```

- [ ] **Step 1: Write RED event reducer tests**

Test:

- sequences exactly `1..head` as safe integers and constant stream;
- identifier/vocabulary/non-authority matrix/time before authority;
- decision/proposal uniqueness in stored state;
- observed time nondecreasing before transition checks;
- refusal has no reducer effect;
- create retains original scope permanently;
- delete order: missing prior create → cross-scope unauthorized → already-deleted invalid transition;
- create after active or deleted prior create → `bundle_id_reuse`.

Include multi-fault tests proving reversed time wins before cross-scope, cross-scope wins before already-deleted state, and transition defects win before atom correspondence.

- [ ] **Step 2: Write RED atom and merge tests**

Read atoms in ASCII `memory_id` order. Validate canonical row shape, keyword JSON, scalars, checksum, scope/type/create sequence, then merge sorted expected-active IDs with sorted actual IDs:

- expected ID first → `bundle_missing_atom`;
- actual ID first → `bundle_orphan_atom`;
- equal ID → exact event/atom correspondence;
- deleted memory with atom → orphan;
- active memory without atom → missing.

Assert `replay` memories are fresh exact 16-key objects sorted with `a < b`, not `localeCompare`.

- [ ] **Step 3: Run and confirm RED**

```bash
node --test --test-name-pattern='^M1-06 ' tests/memory-bundle-verification.contract.test.mjs
```

Expected: FAIL because the current verifier stops after structural/meta validation.

- [ ] **Step 4: Implement the semantic phases in one verifier**

Do not expose a second verification route. Public verify, replay, initializer, and apply must all call this same `verifyMemoryBundleState`.

The event phase must retain seen ID sets and the last observed timestamp for apply’s prospective checks. The atom phase must build canonical replay objects only after every row verifies. Return no partial state on failure.

- [ ] **Step 5: Run tests**

```bash
node --test --test-name-pattern='^M1-06 ' tests/memory-bundle-verification.contract.test.mjs
npm test
```

Expected: all semantic, precedence, missing/orphan, and replay-state tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/memory-bundle-verify.mjs src/memory-bundle-codec.mjs tests/memory-bundle-verification.contract.test.mjs
git commit -m "BRAIN V2-M1: reduce and verify bundle state" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7: Implement race-safe atomic initialization

**Files:**
- Modify: `src/memory-bundle-apply.mjs`
- Modify: `src/memory-bundle-runtime.mjs`
- Modify: `tests/memory-bundle.contract.test.mjs`
- Modify: `tests/memory-bundle-instrumentation.contract.test.mjs`
- Modify: `tests/fixtures/memory-bundle-instrumentation-child.mjs`

**Interfaces:**
- `initializeMemoryBundle(db, options = {}): undefined`
- Options own-key set is any subset of `clock` and `idFactory`; present values must be functions.
- Default clock uses captured native Date construction. Default ID uses captured `crypto.randomUUID` and initializer prefixes `str_`.

- [ ] **Step 1: Write RED initializer behavior tests**

Prove:

- synchronous exact `undefined` return;
- `{}`, `{clock}`, `{idFactory}`, and `{clock,idFactory}` are valid option-key subsets; a present `undefined` or non-function callback is invalid;
- fresh init creates all 13 application objects, five autoindexes, one meta row, head zero;
- clock called first with `this === undefined` and zero arguments; ID factory called second the same way;
- valid native/cross-realm/subclass Date accepted; overridden `toISOString` ignored;
- Date Proxy/fake/invalid/primitive rejected as `bundle_invalid_argument`;
- invalid/throwing clock prevents ID call; invalid/throwing ID fully rolls back;
- valid existing bundle calls neither callback and opens no write transaction;
- partial/malformed/unknown layout is unchanged and not repaired;
- first-init busy is immediate, mapped to `bundle_busy`, and never retried.

- [ ] **Step 2: Write RED race and cleanup instrumentation tests**

Instrument the exact boundary after read-transaction `COMMIT` and before `BEGIN IMMEDIATE`:

- another connection creates a complete valid bundle → initializer re-inventories, verifies, calls no callbacks, commits, returns undefined;
- another connection creates a partial bundle → initializer rolls back and reports the verification code, calls no callbacks;
- still absent → callbacks run once and normal initialization proceeds.

Inject rollback failure after a primary callback/DDL failure and assert `bundle_storage_error` replaces the primary.

- [ ] **Step 3: Run and confirm RED**

```bash
node --test --test-name-pattern='^M1-07 ' tests/memory-bundle.contract.test.mjs tests/memory-bundle-instrumentation.contract.test.mjs
```

Expected: FAIL because initialization still has only the Task 2 classification shell.

- [ ] **Step 4: Implement the exact state machine**

Implementation order must match `docs/MEMORY-BUNDLE-CONTRACT.md:170-206` and error precedence `1386-1394`:

1. database brand;
2. options capture and callback types;
3. open and no-active-transaction state;
4. configure/read back four PRAGMAs;
5. reject canonical-target TEMP triggers;
6. deferred read transaction and main inventory;
7. existing-bundle complete verify/commit/return;
8. absent read commit, one `BEGIN IMMEDIATE`, re-inventory;
9. raced valid/partial/absent branch;
10. still-absent callback order, DDL/meta, complete verify, commit.

Rollback is mandatory for every initializer-owned transactional failure. If captured transaction state remains true, attempt rollback. Rollback failure replaces the original with `bundle_storage_error`.

- [ ] **Step 5: Run focused and regression tests**

```bash
node --test --test-name-pattern='^M1-07 ' tests/memory-bundle.contract.test.mjs tests/memory-bundle-instrumentation.contract.test.mjs
npm test
```

Expected: initialization, callback, race, busy, rollback, and idempotence tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/memory-bundle-apply.mjs src/memory-bundle-runtime.mjs tests/memory-bundle.contract.test.mjs tests/memory-bundle-instrumentation.contract.test.mjs tests/fixtures/memory-bundle-instrumentation-child.mjs
git commit -m "BRAIN V2-M1: initialize bundles atomically" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 8: Implement staged apply validation, exact-head CAS, and duplicate precedence

**Files:**
- Modify: `src/memory-bundle-apply.mjs`
- Modify: `src/memory-bundle-codec.mjs`
- Modify: `tests/memory-bundle.contract.test.mjs`

**Interfaces:**
- `applyResolvedDecisionInTransaction(db, input): undefined`
- Requires the caller’s active transaction on the exact branded connection and correct four PRAGMAs.
- Validates and mutates in contract order `docs/MEMORY-BUNDLE-CONTRACT.md:234-259`.

- [ ] **Step 1: Write RED precondition and expected-head tests**

- non-branded/Proxy/closed/open-no-transaction classifications;
- transaction on another connection does not satisfy apply;
- wrong PRAGMA and canonical-target TEMP trigger fail before verification/input;
- malformed expected-head shape, stream scalar, then sequence scalar → `bundle_invalid_argument`;
- only scalar-valid stream/sequence mismatch → `bundle_head_conflict`;
- structural bundle fault wins before malformed input;
- pair a structurally invalid bundle with a trap-counting top-level input Proxy and assert the verification error wins with zero Proxy traps, proving complete verification precedes input reflection.

- [ ] **Step 2: Write RED decision matrix and duplicate tests**

Table-drive all four rows:

- create applied: promote/transient and permanent/permanent;
- create refused: four allowed reasons;
- delete applied;
- delete refused: three allowed reasons.

Mutate every matrix cell one at a time. Assert atom container shape is checked before decision value validation, but shape-valid atom scalars/keywords wait until after decision IDs and authority.

Seed both duplicate IDs simultaneously and assert `bundle_duplicate_decision_id`; with unique decision ID and duplicate proposal ID assert `bundle_duplicate_proposal_id`.

- [ ] **Step 3: Run and confirm RED**

```bash
node --test --test-name-pattern='^M1-08 ' tests/memory-bundle.contract.test.mjs
```

Expected: FAIL because apply is not implemented.

- [ ] **Step 4: Implement staged snapshots and validation**

Use descriptor values only. Required order:

```text
database brand/open
transaction
PRAGMAs
TEMP-trigger precondition
complete verification
top-level capture
expectedHead capture and scalars
head comparison
decision → scope → authority captures
atom container capture
non-authority matrix/time/IDs
decisionId uniqueness
proposalId uniqueness
authority authorization
create atom scalars and keyword snapshot
prospective transition
SQL mutation
```

The apply function must not call a callback, generate IDs, sort keywords, normalize Unicode, or inspect dynamic `this`.

- [ ] **Step 5: Run tests**

```bash
node --test --test-name-pattern='^M1-08 ' tests/memory-bundle.contract.test.mjs
npm test
```

Expected: precondition, CAS, matrix, staged-shape, and duplicate-code tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/memory-bundle-apply.mjs src/memory-bundle-codec.mjs tests/memory-bundle.contract.test.mjs
git commit -m "BRAIN V2-M1: validate resolved bundle decisions" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 9: Apply event/effect/meta mutations and prove one-connection composition

**Files:**
- Modify: `src/memory-bundle-apply.mjs`
- Modify: `tests/memory-bundle.contract.test.mjs`
- Modify: `tests/memory-bundle-verification.contract.test.mjs`

**Interfaces:**
- No new public API.
- Mutation order is exactly event → atom insert/delete/no-op → meta advance.
- Every INSERT binds every column explicitly; no application default participates.

- [ ] **Step 1: Write RED successful mutation tests**

Within caller-owned `BEGIN IMMEDIATE`:

- create applied inserts one content-free event, one derived atom/checksum, and advances head once;
- refusals insert only an event and advance head;
- delete applied inserts event, removes matching atom/checksum, advances head, preserves create/delete history;
- delete refused changes no atom;
- return is exactly `undefined`, transaction remains active, and the connection remains usable.

Use a second connection to prove uncommitted changes are invisible until outer `COMMIT`; outer `ROLLBACK` reverts event, atom, and meta together. On a real `createKernelStore(options).db`, also write one test-owned CDX-M1 sentinel and call bundle apply inside the same `BEGIN IMMEDIATE`; prove rollback removes both and commit preserves both, without changing production CDX-M1 code.

- [ ] **Step 2: Write RED transition and authorization tests**

- observed-time decrease wins before state/scope checks;
- create reuse before or after deletion → `bundle_id_reuse`;
- delete with no prior create → `bundle_invalid_transition`;
- retained original scope mismatch, including after deletion → `bundle_unauthorized`;
- same-scope already-deleted target → `bundle_invalid_transition`;
- well-shaped row authority mismatch → `bundle_unauthorized`;
- malformed authority token/shape → `bundle_invalid_decision`.

- [ ] **Step 3: Write RED trigger/order tests**

Direct SQL probes, always rolled back, must prove:

- event UPDATE/DELETE forbidden;
- atom UPDATE/direct DELETE forbidden;
- `INSERT OR REPLACE` cannot rewrite meta/events/atoms with recursive triggers enabled;
- NULL refusal reasons fail with CHECK enforcement enabled;
- atom before event, atom after meta, wrong event/scope/type/time, historical reinsertion, meta skip/regression/delete/immutable-field update all fail;
- complete supported event/effect/meta order succeeds.

- [ ] **Step 4: Run and confirm RED**

```bash
node --test --test-name-pattern='^M1-09 ' tests/memory-bundle.contract.test.mjs tests/memory-bundle-verification.contract.test.mjs
```

Expected: FAIL because apply validates but does not yet perform SQL mutation.

- [ ] **Step 5: Implement the three-step mutation**

- Event INSERT binds all 17 columns.
- Create atom is derived from verified head, decision, captured atom scalar descriptors, and fresh keyword snapshot; caller never supplies checksum.
- Delete targets only the retained active atom.
- Meta UPDATE advances by exactly one and keeps every immutable field unchanged.
- Translate unexpected constraints only after deterministic input/transition checks; preserve narrower bundle errors.

- [ ] **Step 6: Run focused and regression tests**

```bash
node --test --test-name-pattern='^M1-09 ' tests/memory-bundle.contract.test.mjs tests/memory-bundle-verification.contract.test.mjs
npm test
```

Expected: mutation, rollback, trigger, content-free, deletion, and no-receipt tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/memory-bundle-apply.mjs tests/memory-bundle.contract.test.mjs tests/memory-bundle-verification.contract.test.mjs
git commit -m "BRAIN V2-M1: apply governed bundle mutations" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 10: Implement create-disabled recovery and the receiver-independent public handle

**Files:**
- Modify: `src/memory-bundle.mjs`
- Create: `tests/memory-bundle-public.contract.test.mjs`
- Modify: `src/memory-bundle-runtime.mjs`
- Modify: `tests/memory-bundle-instrumentation.contract.test.mjs`
- Modify: `tests/fixtures/memory-bundle-instrumentation-child.mjs`

**Interfaces:**
- `openMemoryBundle({dbPath}): frozen handle`
- Handle exact own properties: `verify`, `replay`, `capabilities`, `close`.
- `verify(): {checkpoint, capabilities}`
- `replay(): {checkpoint, memories, capabilities}`
- `close(): undefined`

- [ ] **Step 1: Write RED path/recovery tests**

Reject before SQLite:

- Proxy/revoked Proxy options;
- missing/extra/accessor/symbol/non-enumerable keys;
- empty, relative, NUL-containing, `:memory:`, URI string, URL object, Buffer, non-string path.

Test encoded absolute paths containing spaces, `#`, `%`, `?`, and Unicode filename characters. Missing path must not be created. A clean existing database must be opened through internal `mode=rw` first, then final original absolute path read-only.

- [ ] **Step 2: Write RED surface and receiver tests**

```js
const verifyA = handleA.verify
assert.deepEqual(verifyA(), handleA.verify())
assert.deepEqual(handleA.verify.call(handleB), handleA.verify())
handleA.close.call(new Proxy({}, { get() { throw new Error('receiver trap') } }))
```

Prove the receiver Proxy trap never runs, `handleA.close.call(handleB)` closes only A, and exact object/result keys plus shared capability identity hold:

```js
assert.equal(handle.capabilities, handle.verify().capabilities)
assert.equal(handle.capabilities, handle.replay().capabilities)
assert.equal(handle.capabilities, secondHandle.capabilities)
```

- [ ] **Step 3: Write RED lifecycle and cleanup tests**

- successful close returns undefined and is idempotent;
- verify/replay after closed or poisoned state → `bundle_closed` before SQLite;
- open-handle native close failure → `bundle_storage_error` and leaves open for retry;
- primary read/verify/commit error attempts rollback if transaction remains active;
- rollback failure replaces primary, poisons handle, attempts native close once;
- open-time recovery/final connection failures close constructed connections with precedence rollback → close → primary;
- capabilities remain readable in all states.

- [ ] **Step 4: Run and confirm RED**

```bash
node --test --test-name-pattern='^M1-10 ' tests/memory-bundle-public.contract.test.mjs tests/memory-bundle-instrumentation.contract.test.mjs
```

Expected: FAIL because `openMemoryBundle` still reports `bundle_invalid_argument` for all inputs.

- [ ] **Step 5: Implement the exact two-connection sequence**

1. Capture exact options and validate absolute raw path.
2. `pathToFileURL(dbPath)`, set `mode=rw`, construct writable `{readOnly:false,timeout:0}`.
3. Configure/read back four PRAGMAs.
4. Deferred read transaction, normalized `SELECT 1 FROM main.sqlite_schema LIMIT 1`, commit, native close.
5. Only then construct original path `{readOnly:true,timeout:0}`.
6. Configure/read back four PRAGMAs, read transaction, complete verification, commit.
7. Return frozen lexical-closure handle.

Implement one private `runVerifiedReadTransaction` used by open-time verification, `verify`, and `replay`. Result shaping occurs only after complete verification succeeds.

- [ ] **Step 6: Run focused and regression tests**

```bash
node --test --test-name-pattern='^M1-10 ' tests/memory-bundle-public.contract.test.mjs tests/memory-bundle-instrumentation.contract.test.mjs
npm test
```

Expected: path, sequence, handle, identity, receiver, poison, cleanup, and close tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/memory-bundle.mjs src/memory-bundle-runtime.mjs tests/memory-bundle-public.contract.test.mjs tests/memory-bundle-instrumentation.contract.test.mjs tests/fixtures/memory-bundle-instrumentation-child.mjs
git commit -m "BRAIN V2-M1: open verified bundles read-only" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 11: Seal captured dispatch, row-mode, and race/fault instrumentation

**Files:**
- Modify: `tests/memory-bundle-instrumentation.contract.test.mjs`
- Modify: `tests/fixtures/memory-bundle-instrumentation-child.mjs`
- Modify: `src/memory-bundle-runtime.mjs` only if an instrumented test exposes a defect

**Interfaces:**
- No public API change.
- Instrumentation child scenarios are test-only and never imported by production modules.

- [ ] **Step 1: Add RED captured-dispatch scenarios**

After dynamic import has completed, poison:

- `DatabaseSync.prototype.exec/prepare/close`;
- `StatementSync.prototype.get/all/run/setReadBigInts/setReturnArrays`;
- same-named instance properties;
- global `Reflect.apply`, `Reflect.construct`, `Date`, `path.isAbsolute`, `crypto.randomUUID` where the harness can replace the imported wrapper binding before later calls.

Then run initialization/open/apply and assert the captured original functions still execute. Verify native subclasses and branded objects with changed JavaScript prototype remain accepted.

- [ ] **Step 2: Add RED row-mode scenarios**

Construct operational connections using default options, `readBigInts:true`, `returnArrays:true`, and both. For each row statement, trace `setReadBigInts(false)` then `setReturnArrays(false)` before `get`/`all`. The resulting verification/replay must be deeply equal in all modes.

- [ ] **Step 3: Add RED callback and cleanup call-order scenarios**

Assert exact constructor/exec/prepare/statement/close trace subsequences for:

- exactly one module-evaluation `':memory:'`, `{open:false}` branding probe;
- invalid public options: the branding probe exists, but zero operational constructors occur;
- fresh init;
- existing init;
- raced valid and raced partial layouts;
- recovery success;
- recovery COMMIT failure;
- recovery close failure;
- final-open verification failure;
- public read rollback failure and poison close.

- [ ] **Step 4: Run and confirm RED**

```bash
node --test --test-name-pattern='^M1-11 ' tests/memory-bundle-instrumentation.contract.test.mjs
```

Expected: one or more trace assertions FAIL until every private call site uses captured dispatch and cleanup precedence consistently.

- [ ] **Step 5: Correct only the private dispatch/cleanup defects found**

Do not add a production test seam, environment variable, option, export, or dependency. The only instrumentation entry remains the subprocess loader hook.

- [ ] **Step 6: Run tests**

```bash
node --test tests/memory-bundle-instrumentation.contract.test.mjs
npm test
```

Expected: every instrumented scenario PASS; full suite PASS.

- [ ] **Step 7: Commit**

```bash
git add src/memory-bundle-runtime.mjs tests/memory-bundle-instrumentation.contract.test.mjs tests/fixtures/memory-bundle-instrumentation-child.mjs
git commit -m "BRAIN V2-M1: prove captured SQLite dispatch" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 12: Falsify committed partial DML and deterministic error precedence

**Files:**
- Modify: `tests/memory-bundle-verification.contract.test.mjs`
- Modify: `tests/memory-bundle.contract.test.mjs`
- Modify: `src/memory-bundle-verify.mjs` only if a test exposes ordering defects
- Modify: `src/memory-bundle-errors.mjs` only if a mapping defect is found

**Interfaces:**
- No new API.
- `verify()` and `replay()` share exactly the same verifier and first failure.

- [ ] **Step 1: Add direct-partial-DML tests**

Using correctly configured raw SQLite, commit separately:

- event only;
- event plus atom but no meta advance;
- malformed complete rows seeded by temporarily removing/recreating the exact guards.

Reopen through `openMemoryBundle` and assert complete verification rejects each state. Snapshot before/after open to prove no repair or truncation.

- [ ] **Step 2: Add the 19-code coverage table**

Trigger every stable code through a contractual module boundary:

- invalid argument — malformed database/options/head;
- busy — first initialization under competing lock;
- layout invalid — no/partial/altered bundle or integrity fault;
- schema unsupported — readable singleton with another version;
- connection invalid — closed connection, wrong PRAGMA, or canonical-target TEMP trigger;
- not in transaction — valid open connection without transaction;
- invalid decision — malformed decision;
- duplicate decision/proposal IDs — distinct apply cases;
- invalid atom — malformed atom/checksum;
- invalid transition — reversed time or invalid delete state;
- head conflict — scalar-valid mismatch;
- meta mismatch — schema-valid sequence/head/meta defect;
- missing/orphan atom — merge cases;
- ID reuse — create after prior create/deletion;
- unauthorized — authority or retained-scope mismatch;
- storage error — injected cleanup/native non-busy failure;
- closed — verify/replay after close/poison.

- [ ] **Step 3: Add mixed-fault precedence tests**

At minimum:

- integrity/layout corruption plus semantic corruption → layout;
- decreasing time plus scope/state defect → invalid transition;
- cross-scope delete plus missing atom → unauthorized;
- both duplicate IDs → duplicate decision;
- missing and orphan IDs → sorted merge result;
- atom container shape plus malformed decision value → invalid atom;
- shape-valid bad atom scalar plus malformed decision → invalid decision;
- scalar-invalid expected head plus mismatch → invalid argument.

For each stored fault, assert public `verify()` and `replay()` throw the same code.

- [ ] **Step 4: Run and confirm RED**

```bash
node --test --test-name-pattern='^M1-12 ' tests/memory-bundle.contract.test.mjs tests/memory-bundle-verification.contract.test.mjs
```

Expected: any inconsistent mapping/order fails with an `AssertionError` naming the expected and actual code.

- [ ] **Step 5: Centralize corrections without broad catch-all mapping**

Preserve already-created `MemoryBundleError` values. Translate native failures at the narrow boundary that knows the correct contract condition. Never map every constraint to layout/storage error.

- [ ] **Step 6: Run tests**

```bash
node --test tests/memory-bundle.contract.test.mjs tests/memory-bundle-verification.contract.test.mjs tests/memory-bundle-public.contract.test.mjs
npm test
```

Expected: all 19 codes exercised; mixed-fault and partial-DML tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/memory-bundle-verify.mjs src/memory-bundle-errors.mjs tests/memory-bundle.contract.test.mjs tests/memory-bundle-verification.contract.test.mjs
git commit -m "BRAIN V2-M1: seal deterministic bundle failures" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 13: Prove hard-crash hot-journal recovery

**Files:**
- Create: `tests/fixtures/memory-bundle-hot-journal-child.mjs`
- Modify: `tests/memory-bundle-public.contract.test.mjs`

**Interfaces:**
- Child CLI: `node tests/fixtures/memory-bundle-hot-journal-child.mjs <absolute-db-path>`.
- Child prints exactly `READY\n` only after apply has mutated the transaction and the `<dbPath>-journal` file exists with non-zero size; it then waits indefinitely without commit/rollback/close.

- [ ] **Step 1: Write the parent RED test**

Parent flow:

1. initialize a real file bundle, create a large unrelated test-owned spill table with pre-existing pages, and close the creator;
2. set/confirm `journal_mode=DELETE`;
3. spawn child with piped stdout/stderr;
4. child updates enough spill-table pages and applies one uncommitted bundle decision in the same transaction;
5. wait for `READY` and independently stat a non-empty rollback journal above the fixture's minimum size threshold;
6. send `SIGKILL`;
7. assert the hot journal remains before public open;
8. call `openMemoryBundle`;
9. assert recovery returns the prior checkpoint/memories and excludes both the uncommitted bundle decision and spill-table changes;
10. assert a later normal `BEGIN IMMEDIATE` apply/commit succeeds.

- [ ] **Step 2: Run and confirm RED**

```bash
node --test --test-name-pattern='^M1-13 ' tests/memory-bundle-public.contract.test.mjs
```

Expected: FAIL because the child fixture is missing.

- [ ] **Step 3: Implement the child without cleanup**

The child must use the public apply module and a native writable connection, configure all four PRAGMAs, execute `BEGIN IMMEDIATE`, update enough rows in the pre-existing spill table to dirty multiple pages, apply one deterministic create-applied decision at the current head, verify the journal file and minimum size threshold with built-in filesystem calls, print `READY`, and keep the event loop alive. Do not install signal/exit handlers or `try/finally` cleanup.

- [ ] **Step 4: Run focused and regression tests**

```bash
node --test --test-name-pattern='^M1-13 ' tests/memory-bundle-public.contract.test.mjs
npm test
```

Expected: parent kills child; public open performs writable recovery before read-only construction; prior checkpoint verifies; full suite PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/fixtures/memory-bundle-hot-journal-child.mjs tests/memory-bundle-public.contract.test.mjs
git commit -m "BRAIN V2-M1: prove hot-journal crash recovery" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 14: Prove unchanged CDX-M1 coexistence and close M1 scope

**Files:**
- Create: `tests/memory-bundle-coexistence.contract.test.mjs`
- Modify: `tests/memory-bundle.contract.test.mjs` only for final cross-surface assertions
- Do not modify current runtime source files.

**Interfaces:**
- No new production API.

- [ ] **Step 1: Write the real workspace coexistence RED test**

Use `createKernelStore` and `createGatedStore` on a temporary workspace:

1. create/search a normal CDX-M1 memory and snapshot non-bundle schema, data, FTS, links, migrations, journal mode, and relevant PRAGMAs;
2. call `initializeMemoryBundle(store.db, fixedOptions)` on the exact same connection;
3. prove only the 13 bundle application objects/five autoindexes were added;
4. perform another ordinary gated CDX write and prove bundle head/events/atoms do not change;
5. perform explicit bundle apply/commit and prove CDX rows/FTS/links/gate behavior do not change;
6. close writer and open bundle by `store.dbPath` to verify/replay;
7. prove no existing runtime module imports `memory-bundle-apply.mjs` or calls bundle mutation functions.

- [ ] **Step 2: Add scope/dependency/governance assertions**

Assert:

- `package.json` has no `dependencies` or `devDependencies` and keeps `node --test`;
- public namespaces contain no projection/driver/provider/vector/graph/export/import/repair/history/signature/anchor APIs;
- schema has no M2+ object;
- shared/general/ratify/external-provenance/supersession/lifecycle fields fail before event insertion;
- sealed U8 files and provider/eval paths are not imported or executed by any M1 test.

- [ ] **Step 3: Run and confirm RED**

```bash
node --test --test-name-pattern='^M1-14 ' tests/memory-bundle-coexistence.contract.test.mjs tests/memory-bundle.contract.test.mjs
```

Expected: FAIL until the coexistence test file and final scope assertions exist. No production behavior should need expansion.

- [ ] **Step 4: Fix only new bundle coupling defects**

If this test exposes a mutation or pragma leak, correct the new bundle modules. Do not patch CDX-M1 store/gate/adapter behavior and do not add dual writes.

- [ ] **Step 5: Run the pinned-runtime acceptance sequence**

```bash
node --version
node -e "const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync(':memory:'); console.log(db.prepare('select sqlite_version() v').get().v); db.close()"
node --test tests/memory-bundle.contract.test.mjs
node --test tests/memory-bundle-verification.contract.test.mjs
node --test tests/memory-bundle-public.contract.test.mjs
node --test tests/memory-bundle-instrumentation.contract.test.mjs
node --test tests/memory-bundle-coexistence.contract.test.mjs
npm test
git diff --check
```

Expected:

- Node prints `v22.22.2` for certification.
- SQLite prints `3.51.2`.
- Every dedicated M1 test file PASS.
- Existing and new full suite PASS with zero failures.
- `git diff --check` prints nothing.

- [ ] **Step 6: Audit paths and provider-free execution**

```bash
git diff --name-only "$(git merge-base main HEAD)"..HEAD
git status --short
```

Expected implementation paths are limited to the seven production modules and the listed M1 tests/helpers/fixtures. Governance/contract/plan files may appear only from the already-approved documentation cut point. No key, dataset, U8 result/checkpoint, provider runner, benchmark output, or publication artifact appears.

- [ ] **Step 7: Commit the completed M1 proof**

```bash
git add tests/memory-bundle-coexistence.contract.test.mjs tests/memory-bundle.contract.test.mjs
git commit -m "BRAIN V2-M1: prove governed bundle coexistence" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 15: Certify the completed milestone and publish engineering evidence

**Files:**
- Modify: `STATUS.md`
- Append: `docs/DECISIONS.md`
- Modify: `README.md` only if its current milestone-status wording would otherwise become false.
- Do not modify the normative contract unless implementation discovers a genuine contradiction; stop and review such a contradiction instead of silently changing policy.

**Interfaces:**
- No runtime API change.
- Produces the truthful V2-M1 completion record and advances only the queue pointer to V2-M2.

- [ ] **Step 1: Run the exact final certification commands**

```bash
node --version
node -p "process.versions.sqlite"
node --test tests/memory-bundle.contract.test.mjs
node --test tests/memory-bundle-verification.contract.test.mjs
node --test tests/memory-bundle-public.contract.test.mjs
node --test tests/memory-bundle-instrumentation.contract.test.mjs
node --test tests/memory-bundle-coexistence.contract.test.mjs
npm test
git diff --check
```

Expected:

- Node is exactly `v22.22.2` for the certification run.
- SQLite is exactly `3.51.2`.
- Every focused file and the complete repository suite report zero failures.
- `git diff --check` prints nothing.

- [ ] **Step 2: Recheck exact public namespaces and capabilities**

```bash
node --input-type=module <<'NODE'
const apply = await import('./src/memory-bundle-apply.mjs')
const publicModule = await import('./src/memory-bundle.mjs')
console.log(JSON.stringify(Object.keys(apply).sort()))
console.log(JSON.stringify(Object.keys(publicModule).sort()))
NODE
```

Expected:

```text
["MemoryBundleError","applyResolvedDecisionInTransaction","initializeMemoryBundle"]
["openMemoryBundle"]
```

The completed tests must also prove the shared capability object still contains exactly the six all-false properties.

- [ ] **Step 3: Audit implementation scope from the recorded contract cut point**

```bash
CONTRACT_CUT_POINT="$(git log --format=%H --grep='^BRAIN V2-M1: seal governed bundle contract and plan$' -n 1)"
test -n "$CONTRACT_CUT_POINT"
git diff --name-only "$CONTRACT_CUT_POINT"..HEAD
git diff "$CONTRACT_CUT_POINT"..HEAD -- \
  src/gemini.mjs \
  scripts \
  evals \
  data
```

Expected: implementation changes are limited to `src/memory-bundle*.mjs` and the listed M1 tests/helpers/fixtures, plus truthful final governance evidence. The provider/live/eval/data diff prints nothing.

- [ ] **Step 4: Update milestone state truthfully**

In `STATUS.md`:

- mark V2-M1 complete only now;
- record exact test count, zero failures, Node `22.22.2`, SQLite `3.51.2`, and the preceding implementation commit hash;
- state that CDX-M1 remains runtime authority and the bundle remains `sourceOfTruth:false`;
- set `Next` to V2-M2 without implementing it;
- keep U8 sealed at 9/10 and final question unrun.

Append a mandatory `docs/DECISIONS.md` entry certifying the previously provisional Node/SQLite floor only because the complete M1 and regression suite passed. Record no stronger deletion/audit/source-of-truth claim.

- [ ] **Step 5: Commit and verify the certification cut point**

```bash
git add STATUS.md docs/DECISIONS.md
if ! git diff --quiet -- README.md; then git add README.md; fi
git diff --cached --check
git commit -m "BRAIN V2-M1: certify governed bundle substrate" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
npm test
git status --short --branch
```

Expected after the commit: full suite PASS and a clean working tree.

- [ ] **Step 6: Push the engineering milestone**

```bash
git push
```

Expected: the remote feature branch contains the reviewed contract cut point, implementation commits, complete proof suite, and certification evidence. This push is engineering publication only; it does not publish benchmark scores or private results.

---

## Final Self-Review Matrix

### Acceptance laws → tasks

| Contract acceptance law | Plan tasks |
|---|---|
| 1. Exact exports, undefined returns, result shapes, receiver independence, shared capabilities | 1, 9, 10 |
| 2. Atomic/idempotent init, Proxy/native brand, callbacks/Date, race, cleanup, partial layouts | 2, 4, 5, 7, 11 |
| 3. Real unchanged CDX-M1 coexistence | 14 |
| 4. Absolute path, mode=rw recovery, final read-only, handle lifecycle/cleanup | 10, 11, 13 |
| 5. Exact matrix, time/scope ordering, NULL refusal defense | 8, 9, 12 |
| 6. Content-free events | 3, 9, 14 |
| 7. Main-qualified DDL, persisted SQL, shadows, TEMP/main triggers | 3, 5, 12 |
| 8. Four PRAGMAs and REPLACE/CHECK defenses | 5, 9 |
| 9. Captured native dispatch and row modes | 2, 11 |
| 10. Immutable atoms, governed deletion, ID non-reuse | 6, 9 |
| 11. One-connection composition and no receipt | 8, 9 |
| 12. Partial direct DML rejected on reopen | 12 |
| 13. Immediate no-retry first-init busy | 7 |
| 14. Safe sequence and malformed-head/CAS distinction | 6, 8, 12 |
| 15. Proxy/descriptor short-circuiting, timestamps, keywords, checksum, replay atom shape | 4, 6, 8 |
| 16. Exact 19 codes and deterministic verification/precedence | 5, 6, 8, 12 |
| 17. SIGKILL hot-journal recovery | 13 |
| 18. Node 22.22.2 / SQLite 3.51.2 full regression and URI/DDL mechanics | 3, 10, 14 |
| 19. No provider/network/dependency/live/U8 change | Global constraints, 14 |

### Stable error codes → first primary test task

| Code | Primary task |
|---|---|
| `bundle_invalid_argument` | 2, 4, 8, 10 |
| `bundle_busy` | 7 |
| `bundle_layout_invalid` | 5 |
| `bundle_schema_unsupported` | 5 |
| `bundle_connection_invalid` | 2, 5, 8 |
| `bundle_not_in_transaction` | 8 |
| `bundle_invalid_decision` | 8 |
| `bundle_duplicate_decision_id` | 8 |
| `bundle_duplicate_proposal_id` | 8 |
| `bundle_invalid_atom` | 4, 6, 8 |
| `bundle_invalid_transition` | 6, 9 |
| `bundle_head_conflict` | 8 |
| `bundle_meta_mismatch` | 5, 6 |
| `bundle_missing_atom` | 6 |
| `bundle_orphan_atom` | 6 |
| `bundle_id_reuse` | 6, 9 |
| `bundle_unauthorized` | 6, 8, 9 |
| `bundle_storage_error` | 7, 10, 11 |
| `bundle_closed` | 10 |

### Scope closure

- No task changes CDX-M1 runtime authority or imports the bundle into store/gate/adapter.
- No task adds a projection, driver, provider, benchmark, publication, or live-evaluation path.
- No task adds a public/test-only export to either contractual module.
- All fault seams are subprocess-only loader instrumentation or privileged test database preparation.
- M2 begins only after Task 14’s complete pinned-runtime suite passes and the milestone state is recorded truthfully.

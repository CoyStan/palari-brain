# V2-M2-A2 Legacy Mutation Routing Implementation Plan

> Execute only M2-A2. Parent V2-M2 remains open. Do not begin M2-B journaling
> or V2-M3 gate repair until this subunit is certified.

**Goal:** Route the complete supported in-file CDX-M1 semantic DML surface
through the A1 coordinator as five explicitly legacy intents and eight
transaction-neutral effects, remove every raw in-file producer capability,
and inventory/serialize terminal workspace destruction without pretending it
is a SQLite co-commit.

**Architecture:** `src/legacy-mutation-router.mjs` owns the closed intent and
effect inventories, ephemeral lease-bound plans, and the sole semantic CDX
DML. The new runtime owns native SQLite construction, bootstrap, exact-schema
verification, captured reads, cleanup, and canonical-path state directly; no
production module imports or invokes the quarantined extracted raw factory.
The compatibility resolver copies only the exact recorded baseline behavior
needed to normalize and resolve plans after `BEGIN IMMEDIATE`; safe base/gated
handles expose no database or child operations. Gate, extraction, recall,
adapter, scheduler, and topic-forget become gate-bound intent producers; the
module-constructed frozen manager returns only branded gated handles. Schema
work is pre-handle; whole-file deletion is a serialized zero-live-handle
storage operation.

**Runtime:** exact Node `v22.22.2`, SQLite `3.51.2`, ESM, `node:test`, built-in
`node:sqlite`; no dependency change.

**Normative contract:** `docs/LEGACY-MUTATION-ROUTING-CONTRACT.md`.

## File map

- **Add `src/legacy-mutation-router.mjs`** — exact intent/effect arrays,
  coordinator-owned execute, lease-bound resolve/apply, deep-frozen plans, and
  the only semantic CDX DML.
- **Do not modify `src/memory-store.mjs`** — preserve the verified extraction
  baseline byte-for-byte. Its raw factory/DML become quarantined evidence and
  have no supported producer caller.
- **Add `src/kernel-store-runtime.mjs`** — own captured-native `DatabaseSync`
  construction, module-owned CDX-M0/M1 bootstrap, exact
  `CDX-M1-runtime@1` manifest verification, copied reads/normalization,
  mandatory failed-open cleanup, router and safe-base state, and canonical-
  path serialization/open-handle state. Never import `src/memory-store.mjs`,
  construct a raw store, or expose the native connection. Its only B1 import
  is the exact schema object/trigger/SQL-normalizer constants needed to
  allowlist B1's eight inert-to-CDX triggers; it reads no B1 state.
- **Modify `src/store.mjs`** — supported safe factory, gated manager, and
  terminal serialized workspace deletion; no topic search/delete loop.
- **Modify `src/gate.mjs`** — branded store requirement, immutable policy,
  pure admission, five-intent routing, internal extracted-candidate route, no
  DML/migration/raw method calls.
- **Modify `src/memory-extraction.mjs`** — branded proposal capability,
  transaction-time contradiction resolution, gated summary and scheduler;
  replace its no-longer-verbatim header with the exact upstream/local blobs
  and A2 moved-region ledger.
- **Modify `src/adapter.mjs`** — remove the duck-typed gate shim and pass the
  branded gated handle/provenance inputs directly.
- **Modify `src/recall.mjs`** — require the branded gated capability for
  inclusion telemetry.
- **Add `tests/legacy-mutation-router.contract.test.mjs`** — exact module,
  plan, intent/effect, atomicity, failure, visibility, and concurrency laws.
- **Add `tests/legacy-mutation-routing.contract.test.mjs`** — exact handles,
  complete producer graph, disabled behavior, spoof rejection, manager/path,
  scheduler/extraction, and static shortcut closure.
- **Modify existing store/gate/recall/adapter/A1/B1 tests only where raw fixture
  setup or inspection must use independent test-owned connections.** Do not
  change exact B1 production semantics or normative contract.
- **Add `docs/LEGACY-MUTATION-B2-OBLIGATIONS.md`** — dimension-complete finite
  semantic branch patterns, batch composition, implicit consequences, and the
  terminal storage route, with no B2 mapping yet.
- **Update `STATUS.md`, `docs/DECISIONS.md`, `docs/KERNEL-API.md`, and
  `docs/KERNEL-CONTRACT.md`** at the contract and certification cut points.

---

## Task 0 — Seal the A2 contract cut point

**Files:** documentation and status only.

- [x] Confirm branch `codex/v2-m2-a2-legacy-routing` is based on clean main
  `1d65bb0`.
- [x] Check the complete baseline mutation/caller inventory against production
  source with `rg`; record all schema, row, trigger, cascade, and file effects.
- [x] Seal exactly five intents, eight effects, raw-surface retirement,
  deterministic plan ordering, bootstrap boundary, and terminal file-delete
  law.
- [x] Record the authority/canonical disclaimers and exact M2-B map-or-refuse
  obligation.
- [x] Obtain three independent read-only reviews: matrix completeness/public
  closure; Unified-Spec/M2 boundary; SQLite/plan/failure executability.
- [x] Resolve every blocker and major, check links/whitespace, run the
  unchanged suite, and commit/push the docs-only cut point:

```bash
node --version
node -p "process.versions.sqlite"
git diff --check
npm test
git add STATUS.md docs/DECISIONS.md docs/KERNEL-API.md \
  docs/KERNEL-CONTRACT.md docs/MUTATION-SEAM-CONTRACT.md \
  docs/LEGACY-MUTATION-ROUTING-CONTRACT.md \
  docs/superpowers/plans/2026-07-21-legacy-mutation-routing.md
git diff --cached --check
git commit -m "BRAIN V2-M2: seal legacy mutation routing contract"
git push -u origin codex/v2-m2-a2-legacy-routing
```

Expected: production/test files unchanged; 239 tests pass; STATUS still names
A2 and parent M2 remains unchecked.

---

## Task 1 — Pin the router, vocabularies, and lease-bound plan

### M2-A2-01 RED

- [x] Assert the router module namespace is exactly the five contract exports,
  including `LegacyMutationError`.
- [x] Assert frozen exact five-intent/eight-effect arrays and reject unknown
  values without database work.
- [x] Assert every canonical captured intent envelope/nested record has the
  exact contract keys/order/scalars and ignores no undocumented field.
- [x] Pin public proposal structure/admission: undefined versus null proposal;
  own-data ordinary nested records; Proxy/known-accessor/inherited/extra
  fields; kind-before-op-before-container precedence; omitted/undefined op →
  add but null → invalid_op; prototype-collision kinds → invalid_kind; raw
  truthiness/set membership for writer/source/event/extractor; null nested
  containers; and exact reason order.
- [x] Assert a frozen exact `{apply, capture, execute, resolve}` router whose
  captured intents precede transaction entry and whose plans are deep-frozen,
  opaque to callers, lease/database bound, single-use, and stale after callback
  completion.
- [x] Prove all caller conversion/clock work occurs before coordinator entry,
  `resolve` performs no semantic DML or caller callback, and `apply` performs
  no read, clock, randomness, policy, or transaction control.
- [x] Prove the direct internal effect applier rejects unknown/stale/wrong-db
  leases and applies every exact effect under a valid lease.
- [x] Pin every A2 error code/message/descriptor and cross-check its exact
  precedence against A1 lease/rollback/cleanup failures.

```bash
node --test --test-name-pattern='^M2-A2-01' \
  tests/legacy-mutation-router.contract.test.mjs
```

Expected RED: module missing.

### M2-A2-01 GREEN

- [x] Capture native construction/open/close/prepare plus statement
  get/all/run/row-mode dispatch and every required primordial at module
  evaluation; instrument both resolver reads and applier writes before import,
  then prove post-import prototype/instance tampering cannot redirect them.
- [x] Use the unchanged A1 coordinator as the sole semantic outer owner; the
  private pre-handle bootstrap transaction is separately classified.
- [x] Implement module-owned intent capture before transaction entry and the
  module-owned read-only resolver—no supplied planner callback—plus plan
  validation/branding/deep freeze, exact ordered apply, and result exposure
  after commit.
- [x] Invoke caller clocks only during capture, recheck store liveness after
  them, and use only module-captured native `randomUUID` during resolution for
  a blank memory ID; no injectable ID callback enters the transaction.
- [x] Keep all B1/B2 concepts absent.
- [x] Run focused tests and inspect exact namespaces.

---

## Task 2 — Resolve and apply proposal/delete semantics

### M2-A2-02 RED

- [x] Add golden fixtures for candidate insert, duplicate bump, supersede,
  end-validity, delete-transient, share, and direct delete against baseline
  `1d65bb0` results/data.
- [x] Pin the intentional deltas: source metadata in insert, one captured time
  and IDs, deterministic ID tie-break, and all-or-nothing supersession.
- [x] Golden-test demote actor derivation as exact
  `provenance.actor ?? provenance.writer`, including null fallback and empty-
  string non-fallback, before target resolution.
- [x] Golden-test target-consuming proposal capture as
  `String(target ?? '').trim()` after pure admission and before clock/BEGIN,
  including padded string, number, BigInt, Buffer, throwing coercion, empty
  `missing_target`, and ignored add/extraction target cases.
- [x] Golden-test every row-normalization field and precedence: writer-derived
  acquisition/pipeline values, add-only source-message fallback/external
  keyword marker and its pre-stringification truthiness filter (including
  `[0,false,'x']`) versus user-message add/undecorated supersession, caller
  created/valid/access/decay fields, supplied versus SHA-256 hash, ID/link
  formats, supersede target `palari_id`/`user_id` fallbacks, pre-target
  nullish-type rejection, and branch-late duplicate validation, including an
  existing valid-schema empty-content row that duplicate-bumps an empty
  candidate without running the insert-only nonempty-content check. Prove a
  non-string supplied hash is captured without retaining caller data, is
  ignored by a duplicate bump, and rejects an insert/supersede before DML.
- [x] Prove one-time eager capture/coercion and reuse for stateful/throwing ID,
  keywords, importance, confidence, acquisition, time, and source fields;
  confidence is coerced once at its admission position even after earlier
  reasons. Distinguish eager detachment from deferred nonempty-content/
  acquisition/hash validation and branch-late UUID generation. For extraction,
  combine stateful/throwing row, provenance, scope-Palari, scope-user, and
  clock values to prove row/provenance → scope Palari → scope user → target →
  clock precedence.
- [x] Assert every insert and mutation-result memory uses the exact canonical
  22-key order and primitive/null types regardless of physical schema variant;
  `superseded`/delete rows are pre-update/pre-delete snapshots.
- [x] Assert exact own-key order/mutability for every result family and touched
  entry, sync store/gate close, async manager close, and successful file-delete
  result.
- [x] Require target/duplicate/contradiction resolution only after
  `BEGIN IMMEDIATE` and prove competing writers cannot stale the plan.
- [x] Pin the internal proposal discriminator: explicit proposals preserve
  caller add/supersede; extraction candidates resolve contradiction first,
  then duplicate, then insert, with the contract's full comparator chains.
- [x] Golden-test explicit scope as ignored/null and extraction scope as
  trimmed `String(palariId)` plus untrimmed `String(userId)`, including padded,
  non-string, throwing, and separately trimmed stored-row user values.
- [x] Fail every supersession effect ordinal and prove old/new memory, FTS, and
  link state all roll back.
- [x] Prove a provenance/constraint failure cannot leave a committed
  provenance-null insert or supersession.
- [x] Require `changes === 1` for every planned insert/update/delete/link
  effect; zero or multiple changes produce `legacy_effect_cardinality` and
  roll back the complete call.

### M2-A2-02 GREEN

- [x] Convert insert normalization to produce a complete CDX-M1 row without
  issuing SQL.
- [x] Move exact baseline duplicate and contradiction heuristics into
  transaction-time read-only resolution; add only the pinned ID tie-break.
- [x] Replace nested supersession control with three ordered effects.
- [x] Preserve pure admission reason ordering and public result shapes.
- [x] Remove gate DML and post-write provenance stamping.

---

## Task 3 — Resolve atomic topic, recall, and lifecycle batches

### M2-A2-03 RED

- [x] Topic forget selects one scoped snapshot, orders actual delete targets by
  binary ID, reports only landed IDs, terminates on protected rows, and is
  atomic beyond 100 matches.
- [x] Pin direct-delete actor → ID and topic actor → query → Palari → user
  capture/throw precedence, including invalid actor before empty/no-match and
  empty direct ID → in-transaction `not_found`.
- [x] Pin topic capture to direct trimmed FTS `MATCH` syntax—not keyword
  extraction—and prove malformed FTS syntax fails natively with zero change.
- [x] Recall inclusion deduplicates in first-occurrence order, uses one time,
  applies touch then importance per existing ID, and is atomic.
- [x] Pin recall-inclusion capture precedence actor → bump → ID list → optional
  clock, including null/undefined/nonfinite/throwing bump, scalar/sparse/
  duplicate/throwing IDs, empty no-clock/no-BEGIN, clock throw, and liveness
  recheck.
- [x] Seed `access_count=Number.MAX_SAFE_INTEGER`: planner throws the exact
  pre-DML RangeError and rolls back the whole inclusion list; direct touch's
  guarded zero-cardinality path is `legacy_effect_cardinality`. Prove
  `MAX_SAFE_INTEGER-1` increments safely.
- [x] Lifecycle orders by creation time then ID, preserves current window and
  decay/delete thresholds, returns the current summary, and is atomic.
- [x] Pin lifecycle scope: a nonempty Palari filters by exact equality, while
  empty Palari sweeps current transient rows across all Palari; test both and
  classify the unsafe empty-scope branch for M2-B map-or-refuse.
- [x] Pin recall/lifecycle time behavior: empty-scope recall skips `now`;
  otherwise omitted versus explicit/null, one wall/store clock respectively,
  caller-throw identity, exact invalid-time RangeError before DB/BEGIN, finite
  activation formula, lifecycle Palari-before-clock capture, invalid row time
  →365 days, future clamp, `/14` floor, 0.1 decay, and `<=0.1` delete.
- [x] At each effect ordinal, a deterministic SQLite failure leaves all
  relevant rows/FTS/links/telemetry/lifecycle columns at the pre-call snapshot.
- [x] Another connection observes no partial batch and cannot race target
  selection after `BEGIN IMMEDIATE`.

### M2-A2-03 GREEN

- [x] Implement all three read-only planners and exact effect sequences without
  calling any public mutation method.
- [x] Retire raw bump/touch/delete loops and the store wrapper's topic loop.
- [x] Keep lifecycle's auto-delete behavior explicitly legacy; do not repair it
  into canonical semantics in A2.

---

## Task 4 — Seal base/gated surfaces and bootstrap

### M2-A2-04 RED

- [x] Assert exact enabled/disabled base and gated own-key sets, no symbols,
  frozen descriptors, module brands, close/stale behavior, and no `db`, schema,
  router, lease, plan, or raw mutation capability.
- [x] Reject raw/duck/proxy/spoof base stores in gate creation before mutation.
- [x] Prove mutable exported compatibility collections cannot change runtime
  type/writer/actor/source admission and mutable policy inputs are snapshotted.
- [x] Pin policy capture: null/undefined defaults; trap-free Proxy/wrong-type
  rejection; known enumerable own values read/Number-coerced once in canonical
  order; absent versus own-undefined; accessor throw identity; ignored
  inherited/non-enumerable/extra/symbol getters; boolean/string/BigInt/null,
  NaN/infinity, strict-order, exact error, exact ordered defaults
  `{demote:0,promote:0.25,permanent:0.6,ratify:0.75}`, four-key numeric freeze,
  and no `[0,1]` bound.
- [x] Prove CDX-M0 and CDX-M1 bootstrap completes before a handle returns and
  no public reinitialize/migration method exists.
- [x] Pin all three legitimate historical `memories` physical-column orders
  while projecting the same exact 22-key public row order; reject every other
  column/constraint variant and every case-variant CDX object.
- [x] Verify exact tables, FTS5/shadows/config, indexes/autoindexes, trigger
  bodies, link FKs, migration rows, connection PRAGMAs, quick/FK checks, FTS
  row parity, and rollback-scoped FTS integrity. Reject every TEMP trigger,
  unknown main triggers except exact schema-constant-verified B1 triples,
  extra CDX indexes, and any external FK into CDX.
- [x] Reject every existing non-STRICT memory/link row whose SQLite
  type/domain violates the exact public row law, including null text PKs,
  text/nonfinite numbers, and negative/unsafe access counts; prove supplied
  mismatching content hashes remain accepted and explicitly classified.
- [x] Inject failure at every post-open bootstrap stage: the private bootstrap
  transaction rolls back iff post-failure state proves it active, captured
  native close runs exactly once, no handle escapes, detected oracle mismatch
  is `legacy_schema_invalid`, operational native errors retain identity,
  ordered cleanup failures aggregate, and rollback/close failure poisons the
  canonical path. With pre-import captured
  instrumentation, require open/inactive before BEGIN, active after returned
  BEGIN and before COMMIT, inactive after returned COMMIT, and inactive after
  returned ROLLBACK. Cover returned-with-wrong-state BEGIN/COMMIT/ROLLBACK,
  throwing getters, non-boolean getters, and COMMIT throw with active,
  inactive, and unreadable post-throw transaction readback. Also cover
  post-stage auto-rollback, returned rollback state `(false,false)`, and every
  coordinator/router/registry/handle construction throw after proven commit;
  assert the exact no-rollback, rollback, close-once, aggregate-order, and
  poison branches.
- [x] Prove semantic DML cannot run through a base handle.

### M2-A2-04 GREEN

- [x] Leave the byte-identical extracted raw factory completely dormant: no
  production import or call. Record upstream path/commit/blob, local severed
  blob, every copied runtime/schema/read fragment, and the explicit A2
  divergence ledger.
- [x] Construct `DatabaseSync` directly inside the runtime; configure policy,
  run module-owned M0/M1 bootstrap plus complete verification in one private
  control-plane transaction, and close/poison deterministically on failure.
- [x] Build exact branded safe base state around the hidden native connection
  and router, with all reads using captured dispatch and explicit row shapes.
- [x] Golden-test exact get/list 22-key rows, the baseline 20-key search row,
  and canonical-22-plus-five-metadata recall rows across all schema variants.
- [x] Normalize disabled stores to the same exact surfaces with deterministic
  no-write results.
- [x] Close enabled and disabled base/gated handles: enabled calls fail closed,
  while disabled calls remain deterministic inert results before input and
  only status changes to `closed`; manager close precedence remains separate.
- [x] Build gate state only from a valid base brand and route all mutation
  methods to the exact intent union.

---

## Task 5 — Bind every producer and manager

### M2-A2-05 RED

- [x] Raw extraction and session-summary helpers reject arbitrary
  `addMemory`/`supersedeMemory` duck types and accept only a branded gated
  capability.
- [x] Pin replacement provenance: extraction takes `extractorId` plus
  `turn.eventAt`; summary takes `turn.eventAt`; missing values return the exact
  contract drops/skips rather than inventing identity or time.
- [x] Adapter ingest works without a store-shaped shim; extracted contradiction
  resolution happens in the transaction; event/extractor provenance remains
  complete.
- [x] Pin exact extraction return key order and outcome accounting for every
  drop/insert/duplicate/supersede/reject branch; rejected contradiction now
  appends `rejected` and continues, while thrown apply failure still rejects
  after prior candidate commits.
- [x] Disabled adapter ingest returns a deterministic skip instead of throwing.
- [x] Scheduler obtains a gated handle from the manager; raw CDX-M0 manager
  stores are impossible; summaries obey event-time admission.
- [x] Recall inclusion accepts only the branded gated capability.
- [x] Pin every session-summary skip as `{reason,sourceBoundary,status}` and
  inserted/duplicate/rejected completion as `{outcome,sourceBoundary,status}`;
  reasons remain intentionally deferred to V2-M3 receipts. Separately pin the
  scheduler-disabled synthetic summary as exactly
  `{reason:'session_summary_disabled',status:'skipped'}` without a boundary.
- [x] Manager returns exact gated handles, uses one creation flight per
  workspace, and closes/revokes every cache entry. Concurrent callers share
  identity; close racing a paused creation waits, closes the late handle, and
  rejects every waiter without allowing a handle to escape. Pause creation at
  both native-open rejection and successful-open publication: an original
  creation failure wins for its waiters but alone does not fail manager close;
  successful late close gives waiters `legacy_manager_closed`; failed late
  close reaches the same waiters by identity, fails manager close in canonical
  path order, and leaves the path blocked.

### M2-A2-05 GREEN

- [x] Add internal brand assertions/capabilities with no handle-visible symbol.
- [x] Remove the adapter shim and direct extraction store reads used for
  contradiction target selection.
- [x] Replace the re-exported raw manager with a path-keyed gated manager.
- [x] Preserve per-candidate/per-turn transaction boundaries explicitly.

---

## Task 6 — Serialize terminal workspace destruction

### M2-A2-06 RED

- [x] Refuse `deleteKernelStoreFile` while any supported base/gated/manager
  handle for the exact normalized path is live.
- [x] Serialize same-path create/create, create/delete, and delete/delete; allow
  independent paths to proceed independently.
- [x] Canonicalize the absolute path through the real parent directory; prove
  relative/absolute and directory-symlink aliases share one queue/live count,
  and reject an existing main-file symlink.
- [x] After every handle closes, remove main/WAL/SHM/rollback-journal through
  the sole supported door and permit a fresh clean open.
- [x] A native close failure revokes the handle but retains the live/blocked
  count and makes every alias open/delete fail `legacy_store_open` before
  native construction/removal.
- [x] Prove failure makes no SQLite atomicity, receipt, or proof claim and never
  silently unlinks an open supported workspace.

### M2-A2-06 GREEN

- [x] Add a module-private canonical-path operation queue, live-handle count,
  and poisoned-path state shared by open/close/delete.
- [x] Make close idempotent and release exactly once.
- [x] Keep file destruction outside the router/coordinator and label it
  terminal storage lifecycle.

---

## Task 7 — Close the static matrix and B2 obligations

- [x] Add a static production audit proving reachable semantic CDX DML on the
  supported graph exists only in the router child-applier, no production
  module imports the byte-identical extracted file, semantic transaction SQL
  exists only in A1, the separately classified bootstrap transaction/schema/
  FTS-integrity SQL exists only in the runtime, and exact B1 owners remain
  separately allowlisted.
- [x] Parse the ESM import/call graph from supported entry points; prove no
  production path can obtain a raw factory, raw connection, raw method,
  direct effect applier, or arbitrary store-shaped mutation sink. Token `rg`
  checks supplement but do not replace reachability proof. Assert the exact
  23-path production root/module allowlist in contract §10; every new module,
  relative edge outside the allowlist, or import of dormant
  `src/memory-store.mjs` fails closed.
- [x] Mechanically map every gated mutation method to one of five intents and
  every planner effect to one of eight effects.
- [x] Write `docs/LEGACY-MUTATION-B2-OBLIGATIONS.md` with every finite semantic
  branch pattern generated from the exact ordered dimension key in contract
  §11, mechanically asserting the artifact cannot omit: internal producer
  discriminator; normalized-confidence/selected-threshold relation;
  add/supersede source-message/keyword decoration;
  proposed/generated/normalized-target ID;
  supplied/computed/matching/mismatching/invalid hash; eager conversion versus
  deferred validation; caller/event/store/native temporal and historical
  access/decay/source fields; safe-increment/overflow; scope relations;
  lifecycle nonempty-Palari versus empty-cross-Palari scope;
  target/duplicate outcome; ordered explicit effects; implicit trigger/FK
  consequences; batch composition; compatibility flags; or terminal workspace
  destruction.
  Leave governance disposition blank except `M2-B MUST MAP OR REFUSE`.
- [x] Mark terminal destruction as `M2-B MUST REFUSE` under the current
  same-file B2 premise unless a separately reviewed external authority/receipt
  substrate is explicitly authorized.
- [x] Rework test inspection through independent test-owned connections where
  needed; do not reintroduce production accessors.

---

## Task 8 — Certify A2 without completing M2

- [x] Run exact runtime probes, focused router/routing tests, all B1 tests,
  pre-A2 regression tests, and full suite; record totals and zero failures.
- [x] Verify B1 production and `docs/MEMORY-BUNDLE-CONTRACT.md` are byte
  identical to `1d65bb0`; also verify `src/memory-store.mjs` byte-identical to
  `1d65bb0`; review any B1/test-harness diff separately.
- [x] Review every production `INSERT|UPDATE|DELETE`, `BEGIN|COMMIT|ROLLBACK`,
  native construction/connection access, bootstrap verification command, and
  returned handle key.
- [x] Obtain three fresh independent read-only audits: matrix/surface closure,
  transaction/SQLite/failure law, and spec/claim boundary. Resolve every
  blocker and major.
- [x] Update STATUS and linked docs with bounded evidence. Check only A2; leave
  parent M2 unchecked and set Next to M2-B contract work.
- [ ] Commit and push coherent implementation/certification cut points, then
  fast-forward and push main under the charter.

```bash
node --version
node -p "process.versions.sqlite"
node --test tests/legacy-mutation-router.contract.test.mjs \
  tests/legacy-mutation-routing.contract.test.mjs
npm test
git diff --check
rg -n "BEGIN|COMMIT|ROLLBACK|INSERT INTO memories|UPDATE memories|DELETE FROM memories" src
```

Expected final claim: every supported in-file CDX-M1 semantic DML producer
reaches one of five legacy intents and every plan reaches one of eight
lease-checked effects under A1; terminal file destruction remains a separately
serialized legacy storage route and overall one-gate conformance remains open.
CDX-M1 remains authoritative, exact B1 remains unchanged and
non-authoritative, and parent M2 remains open for trusted M2-B map-or-refuse
and co-commit.

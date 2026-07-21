# V2-M2-A1 Transaction Coordinator Implementation Plan

> Execute only M2-A1 here. Parent V2-M2 remains open. Do not begin M2-A2
> routing or M2-B journaling until this subunit is certified and the next
> contract is reviewed.

**Goal:** Add one hardened synchronous owner for a native SQLite write
transaction, prove its lexical lease and failure law, and falsify same-file
composition with one real CDX-B1 decision plus one real CDX memory effect.

**Architecture:** `src/mutation-coordinator.mjs` owns every A1
`BEGIN IMMEDIATE`/`COMMIT`/`ROLLBACK`. It exposes a frozen `{ run }` object and
an opaque active lease. It does not import CDX-B1, and no current runtime module
imports it during A1. Test-only composition brings the coordinator, existing
internal B1 apply, and extracted CDX store primitive together on one real
connection.

**Runtime:** exact Node `v22.22.2`, SQLite `3.51.2`, ESM, `node:test`, built-in
`node:sqlite`; no dependency change.

**Normative contract:** `docs/MUTATION-SEAM-CONTRACT.md`.

## File map

- **Add `src/mutation-coordinator.mjs`** — exact three-export namespace,
  captured native dispatch, lease brand/state, coordinator state machine, and
  twelve-code infrastructure error boundary.
- **Add `tests/mutation-coordinator.contract.test.mjs`** — exact surface,
  native brand, connection policy, transaction, lease, visibility, busy,
  rollback, commit, ownership, and poisoning laws.
- **Add `tests/mutation-coordinator-composition.contract.test.mjs`** — private
  real B1 plus real CDX same-connection commit/rollback falsifier.
- **Add `tests/fixtures/mutation-coordinator-instrumentation-child.mjs` only if
  required** — isolated pre-import instrumentation for native states that real
  SQLite cannot induce deterministically. No production fault hook.
- **Modify `STATUS.md`, `docs/DECISIONS.md`, `docs/KERNEL-API.md`, and
  `docs/KERNEL-CONTRACT.md`** — record the reviewed A1 boundary and later its
  bounded certification. Do not mark parent M2 complete.
- **Do not modify** any `src/memory-bundle*.mjs`, dedicated B1 test/helper,
  current runtime gate/store/adapter/recall/extraction module, package manifest,
  live runner, prediction, or result artifact.

---

## Task 0 — Seal the reviewed A1 cut point

**Files:** documentation and status files only.

- [ ] Confirm the worktree is based on certification commit `616c60b` and the
  branch is `codex/v2-m2-mutation-seam`.
- [ ] Replace the rejected broad M2 draft with the bounded A1 contract and this
  executable plan.
- [ ] Synchronize all linked documents around the exact sequence
  `M2-A1 → M2-A2 → M2-B → M3`; M2-B, not M3, owns the production journal/CDX
  co-commit required to finish M2. Record that every A2 legacy intent/effect
  must map to a provenance-pinned, Unified-Spec-conforming governed operation
  or deterministic refusal before it may enter B2.
- [ ] Confirm the contract contains no canonical patch mapping, no invented
  `write|*` priority, no interpretation of Unified Spec `perm` as permanent
  memory creation, and no unconditional rollback claim.
- [ ] Check whitespace, links, baseline runtime, and unchanged suite:

```bash
git diff --check
test -f docs/MUTATION-SEAM-CONTRACT.md
test -f docs/superpowers/plans/2026-07-21-one-connection-mutation-seam.md
node --version
node -p "process.versions.sqlite"
npm test
```

Expected baseline: Node `v22.22.2`, SQLite `3.51.2`, 208 tests, zero failures.

- [ ] Obtain three independent read-only reviews: contract-claim scope,
  Unified-Spec/architecture alignment, and SQLite/error executability. Resolve
  every blocker.
- [ ] Commit and push the docs-only resumable cut point:

```bash
git add STATUS.md docs/DECISIONS.md docs/KERNEL-API.md \
  docs/KERNEL-CONTRACT.md docs/MUTATION-SEAM-CONTRACT.md \
  docs/superpowers/plans/2026-07-21-one-connection-mutation-seam.md
git diff --cached --check
git commit -m "BRAIN V2-M2: seal transaction coordinator contract"
git push -u origin codex/v2-m2-mutation-seam
```

Expected: no production/test change; `STATUS.md` names V2-M2-A1 as Next and
parent V2-M2 remains unchecked.

---

## Task 1 — Pin namespace, native brand, and opaque lease

**Files:** add coordinator and coordinator contract test.

### M2-A1-01 RED

- [ ] Assert the module namespace is exactly:
  `MemoryMutationError`, `assertActiveMutationLease`,
  `createMutationCoordinator`.
- [ ] Assert the exported error constructor accepts only the closed twelve-code
  vocabulary plus a non-empty primitive message, preserves an optional cause,
  and rejects invalid construction with native `TypeError`.
- [ ] Assert the coordinator is a frozen exact `{ run }` record and a callback
  receives one frozen opaque lease with no enumerable fields or database.
- [ ] Reject Proxy/spoof/non-native databases, accept native subclasses and
  native-branded changed-prototype connections, ignore instance/prototype
  shadows through captured dispatch, normalize caller-selected statement row
  modes, and classify a closed connection.
- [ ] Assert unknown, stale, wrong-connection, and active valid lease outcomes.
  Lease brand wins first; for a known active lease, both wrong native and
  non-native database values are ownership loss and poison.
  A caught active-lease assertion failure must still prevent commit; require
  rollback when the exact owner transaction remains reliably active, permanent
  poison, ownership-error precedence over any later callback throw or async
  return, and cleanup-failure precedence.

```bash
node --test --test-name-pattern='^M2-A1-01' \
  tests/mutation-coordinator.contract.test.mjs
```

Expected RED: module missing.

### M2-A1-01 GREEN

- [ ] Implement the exact namespace and branded `MemoryMutationError`.
- [ ] Capture required native accessors/methods and primordial dispatch at
  module evaluation. Add the provenance/delta source header required by the
  contract.
- [ ] Bind leases in module-private weak state. Do not expose `db`, a symbol,
  transaction methods, or reusable authority.
- [ ] Implement lease checks without yet routing any runtime producer.
- [ ] Run the focused test and inspect the production namespace with a fresh
  dynamic import.

---

## Task 2 — Own success, rollback, busy, and visibility

**Files:** continue coordinator and contract test.

### M2-A1-02 RED

- [ ] Prove every run sets and reads back:
  `foreign_keys=ON`, `busy_timeout=0`, `recursive_triggers=ON`,
  `ignore_check_constraints=OFF`, and `trusted_schema=OFF`.
- [ ] Prove exactly one success order:
  `BEGIN IMMEDIATE → callback → COMMIT`, with result exposure after commit.
- [ ] Prove callback failure and async/thenable return each roll back fully.
- [ ] Prove a pre-existing transaction and synchronous coordinator re-entry
  are rejected without taking ownership of the existing transaction.
- [ ] Hold a real write lock from another connection and prove fail-fast
  `mutation_busy`, no callback, and no retry.
- [ ] Prove a second connection cannot observe the uncommitted sentinel and
  sees it after commit.
- [ ] Prove a lease is valid only during its callback and only for the exact
  bound connection.
- [ ] Add pinned-runtime probes showing `isTransaction === true` both before
  and after illegal `COMMIT; BEGIN IMMEDIATE` and
  `ROLLBACK; BEGIN IMMEDIATE`; label them the structural continuity limit, not
  coordinator-detection successes.

```bash
node --test --test-name-pattern='^M2-A1-02' \
  tests/mutation-coordinator.contract.test.mjs
```

### M2-A1-02 GREEN

- [ ] Implement the exact §5 state machine with one native outer transaction,
  no retry/savepoint, and captured result exposure after commit.
- [ ] Keep pure infrastructure error classification distinct from callback
  errors; preserve the original callback error after successful rollback.
- [ ] Run all coordinator tests and full baseline tests.
- [ ] Commit and push a coherent core cut point:

```bash
node --test tests/mutation-coordinator.contract.test.mjs
npm test
git diff --check
git add src/mutation-coordinator.mjs \
  tests/mutation-coordinator.contract.test.mjs
git commit -m "BRAIN V2-M2-A1: own one mutation transaction"
git push
```

---

## Task 3 — Close failure precedence and poison states

**Files:** continue coordinator/test; add instrumentation child only if needed.

### M2-A1-03 RED

- [ ] Induce a real deferred-foreign-key `COMMIT` failure while the transaction
  remains active; require successful rollback and `mutation_commit_failed`.
- [ ] Exercise callback-driven rollback/close ownership loss and require poison
  with no false rollback/restoration claim.
- [ ] Exercise PRAGMA failure, non-busy begin failure, commit-throws-after-
  commit, post-commit-active, state-inspection failure, and rollback failure.
- [ ] Require exact precedence:
  recoverable commit error → commit failed; uncertain commit → unknown outcome;
  failed required rollback → cleanup failed; any poisoned re-entry → poisoned
  before database access.
- [ ] Require `mutation_cleanup_failed` cause evidence to retain both the
  primary and cleanup failures as one native `AggregateError` with exact
  identity order `[primaryFailure, cleanupFailure]`.
- [ ] Require a post-rollback native state check. A rollback that returns while
  state remains active or unreadable is cleanup failure; it cannot expose the
  primary error as if cleanup succeeded.

Use real SQLite first. If a native branch is not deterministically inducible,
run it in a child process that instruments captured methods before importing
the coordinator. Do not add production injection flags, optional hooks, or
test-only exports.

```bash
node --test --test-name-pattern='^M2-A1-03' \
  tests/mutation-coordinator.contract.test.mjs
```

### M2-A1-03 GREEN

- [ ] Implement the complete §6 table. Retire leases on every known outcome;
  permanently poison uncertain/lost/cleanup-failed owners.
- [ ] Make no atomicity claim where state is unreadable, ownership is lost,
  rollback fails, or commit outcome is unknown.
- [ ] Run focused and full tests; review the instrumentation boundary; commit
  and push the failure-law cut point.

---

## Task 4 — Prove real B1/CDX composition

**Files:** add composition contract test only.

### M2-A1-04 RED

- [ ] Build a real file-backed CDX store on one connection and initialize exact
  CDX-B1 through its existing internal initializer.
- [ ] Inside `coordinator.run`, assert the lease, call the existing real
  `applyResolvedDecisionInTransaction` with a fixed valid direct-user create,
  then call the extracted transaction-neutral CDX insert primitive.
- [ ] Before commit, prove another connection sees neither effect. After
  success, prove B1 head/event/atom and CDX memory/FTS appear together.
- [ ] On a fresh fixture, throw after both applies and prove successful rollback
  leaves B1 head unchanged and no B1 atom/event or CDX memory/FTS residue.
- [ ] Prove the composition file is test-only and no runtime module imports the
  coordinator or B1 apply because of it.

```bash
node --test tests/mutation-coordinator-composition.contract.test.mjs
```

### M2-A1-04 GREEN

- [ ] Add only the test orchestration and fixtures local to that test. Reuse the
  unchanged B1 helper exports; do not alter B1 production or dedicated tests.
- [ ] Run coordinator, composition, all B1 tests, and full suite.
- [ ] Commit and push the composition proof.

---

## Task 5 — Certify A1 without completing M2

**Files:** status/decision/linked docs only after all code tests pass.

- [ ] Verify the exact runtime and complete suite; report the new total and zero
  failures separately from the 208-test baseline.
- [ ] Prove B1 production and dedicated tests/helpers are unchanged from
  `616c60b`:

```bash
git diff --exit-code 616c60b -- \
  docs/MEMORY-BUNDLE-CONTRACT.md \
  'src/memory-bundle*.mjs' \
  'tests/memory-bundle*.test.mjs' \
  tests/helpers/memory-bundle-fixtures.mjs \
  'tests/fixtures/memory-bundle-*'
```

- [ ] Prove no current runtime module imports the new coordinator:

```bash
rg -n "mutation-coordinator" src \
  --glob '*.mjs' --glob '!mutation-coordinator.mjs'
```

Expected: no matches.

- [ ] Review every `BEGIN`, `COMMIT`, and `ROLLBACK` in the A1 production diff;
  all new controls belong to the coordinator. Do not misclassify existing B1
  transaction owners as A1 bypasses. Confirm the native replacement ambiguity
  is documented and tested rather than falsely claimed detectable.
- [ ] Run final checks:

```bash
node --version
node -p "process.versions.sqlite"
node --test tests/mutation-coordinator.contract.test.mjs \
  tests/mutation-coordinator-composition.contract.test.mjs
npm test
git diff --check
git status --short
```

- [ ] Obtain an independent implementation review. Resolve every blocker.
- [ ] Update `STATUS.md` with implementation and certification commit evidence,
  keep `V2-M2` unchecked, and set `Next: V2-M2-A2 — LEGACY COMPATIBILITY
  MUTATION ROUTING`.
- [ ] Commit and push the A1 certification cut point:

```bash
git add STATUS.md docs/DECISIONS.md docs/KERNEL-API.md \
  docs/KERNEL-CONTRACT.md
git diff --cached --check
git commit -m "BRAIN V2-M2-A1: certify transaction coordinator"
git push
git switch main
git merge --ff-only codex/v2-m2-mutation-seam
git push origin main
```

Expected terminal A1 state: coherent certification history pushed to `main`,
exact B1 unchanged, parent M2 open, no runtime adoption, and M2-A2 named as the
next unit. Create the next `codex/` feature branch and continue to the reviewed
M2-A2 contract immediately while safe autonomous work remains.

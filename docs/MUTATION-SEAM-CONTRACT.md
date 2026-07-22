# Transaction Coordinator Contract — Palari v2 M2-A1

**Status:** normative only for the historical V2-M2-A1 cut point. Passing this
contract did not complete V2-M2 or authorize advancing to V2-M3. Parent M2 was
later completed by the separately governed M2-B implementation `0017fee` and
completion hardening `d7bd9f9`; statements below that M2 “stays open” describe
the A1 cut point and do not override current `STATUS.md`.
**Date:** 2026-07-21.
**Derived from:** the Unified Specification at
`c9af823c7dee29d29fd937d44527f3b78d8d3845`, especially Part 4
`rule:onegate`; `docs/KERNEL-CONTRACT.md`; `docs/KERNEL-API.md`;
`docs/PALARI-V2-ARCHITECTURE.md`; and the caller-owned transaction rules in
`docs/MEMORY-BUNDLE-CONTRACT.md`.

The Unified Specification and kernel contract remain the authority for memory
semantics. This contract assigns transaction ownership only. It neither
defines a new patch calculus nor changes CDX-M1 or exact CDX-B1 semantics.

## 1. Staged M2 boundary

V2-M2 remains one parent unit with three ordered, separately reviewed
subunits:

1. **M2-A1 — transaction coordinator.** Establish one synchronous owner for a
   native SQLite write transaction, an opaque lexical lease for internal child
   appliers, deterministic infrastructure failures, and a private real
   B1/CDX composition falsifier.
2. **M2-A2 — legacy compatibility routing.** Inventory the complete current
   CDX durable mutation surface, describe it honestly as legacy compatibility
   work, resolve deterministic transaction-neutral plans, route every current
   in-file semantic DML producer through the coordinator, close raw writer
   bypasses, and classify terminal file destruction separately rather than
   pretending it can co-commit inside the file it removes.
3. **M2-B — governed production bridge.** Bind trusted authority outside
   model/caller proposals; define a provenance-pinned, Unified-Spec-conforming
   patch/admission/authority/effect contract; introduce a disjoint CDX-B2
   canonical journal; checkpoint legacy CDX state; and co-commit every
   production governed decision, ordered journal effect, and CDX projection
   effect. Its sole structural-kernel amendment is the separately recorded
   `FB1-4.ratified-erasure-apply-v1` transition in `docs/KERNEL-CONTRACT.md`.

M2-A1 deliberately does not change any runtime gate, store, extraction,
recall, lifecycle, manager, or adapter path. It adds no production journal and
does not satisfy the architecture's complete M2 falsifier by itself. M2 stays
open until M2-B proves production journal/CDX co-commit across the complete
M2-A2 matrix.

The A2 vocabulary is never canonical input to B2. Before parent M2 can
complete, the separately reviewed M2-B contract must map every A2 legacy
intent and possible effect to a valid governed patch/admission/authority
operation or deterministically refuse it. That contract must preserve, among
the other governing laws, lifecycle demotion rather than automatic erasure,
permanent canonical payloads that are never edited or corrected (while the
separately ratified erasure amendment may consume storage membership),
evidence strength distinct from creation confidence, and an explicit
resolution of the current type-partition debt. Patch registrations and
thresholds must be pinned to their exact
governing provenance; M2-B may not invent or silently change a
founder-amendable constant. V2-M3 is not an escape hatch for this M2
falsifier: it still repairs producer schema/evidence coverage and complete
candidate observability after the governed bridge exists.

Exact CDX-B1 remains unchanged and non-authoritative. Its six capability bits
remain false. CDX-M1 remains runtime and read authority. Any future CDX-B2
objects must use a namespace that does not match `memory_bundle_*`, because
the certified B1 verifier rejects additional objects under that prefix.

The separately reviewed normative A2 boundary is
`docs/LEGACY-MUTATION-ROUTING-CONTRACT.md`. It does not enlarge this A1
contract retroactively: A1 remains the bounded transaction owner, while A2
owns compatibility intent/effect routing and producer closure.

## 2. Exact internal module surface

M2-A1 adds exactly one production module:

```js
// src/mutation-coordinator.mjs
export class MemoryMutationError
export function createMutationCoordinator(db)
export function assertActiveMutationLease(lease, db)
```

There is no default export and no other named export.

`createMutationCoordinator(db)` returns a frozen ordinary object with exactly
one own property. Its exact own-key set is `['run']`; `run` is an enumerable,
non-writable, non-configurable data property, and there are no non-enumerable or
symbol keys:

```js
{
  run(callback) // callback receives one opaque lease
}
```

The object exposes neither the database connection nor transaction state.
The lease is a frozen, module-branded object whose exact own-key set is empty:
it has no enumerable, non-enumerable, or symbol properties, database property,
transaction methods, or reusable authority. The callback is
invoked synchronously through captured
`Reflect.apply(callback, undefined, [lease])`: its supplied `thisArgument` is
`undefined` and it receives exactly one argument, the lease. A strict/ESM
callback therefore observes `this === undefined`; ordinary sloppy-function
`this` conversion remains the JavaScript language's behavior. The callback
result is returned only after a successful commit.

`assertActiveMutationLease(lease, db)` is an exported **internal** assertion
for later transaction-neutral projection appliers. It returns exactly
`undefined` only when:

- `lease` was issued by this module for the currently executing `run` call;
- it is still active;
- `db` is the exact native connection bound to that lease; and
- the captured native connection state is open and in a transaction.

Lease classification precedes database classification. An unknown/non-branded
lease is `mutation_invalid_argument` and `db` is not inspected. Once the lease
is recognized, a stale lease or any value other than its exact bound native
connection—including a non-native value—is
`mutation_transaction_ownership_lost`. Passing the exact bound connection when
it is closed, unreadable, or outside a transaction has the same ownership-loss
code. A stale lease used after its run has finished does not poison an
otherwise clean coordinator. Any assertion failure for a currently active
known lease retires that lease and poisons its coordinator. `run` must recheck
both poison state and lease activity after the callback even when the callback
caught the assertion error; no such failure can be converted into a commit.

Production runtime modules do not import this module during A1. The private
composition test imports it directly. M2-A2 will separately review every new
production import and child-applier boundary.

## 3. Native connection and dispatch law

The coordinator accepts only a real, non-Proxy `node:sqlite` `DatabaseSync`
connection. It uses the same native-brand discipline as CDX-B1:

- at module evaluation, capture the native `DatabaseSync`/`StatementSync`
  operations and `isOpen`/`isTransaction` accessors that the implementation
  needs;
- use captured `Reflect.apply` with the native receiver for every database and
  statement operation;
- normalize every PRAGMA read statement with captured statement row-mode
  methods, so caller-selected `readBigInts` or `returnArrays` constructor modes
  cannot change policy semantics;
- do not use `instanceof`, prototype equality, caller-visible symbols,
  instance method dispatch, or caller shadows for branding or execution; and
- reject a Proxy, prototype spoof, or non-branded value as
  `mutation_invalid_argument`; reject a branded closed connection as
  `mutation_connection_invalid`.

Native subclasses and native-branded connections whose JavaScript prototype
was changed remain valid. Poisoning realm primordials before module evaluation
is outside this threat boundary.

The implementation is new kernel code. If it copies or closely translates a
captured-dispatch pattern from the certified B1 implementation, its source
header records the repository path and commit used plus the intentional A1
delta. It must not import a private B1 runtime helper or change a B1 module.

## 4. Lexical ownership and its explicit limit

Only `run` may issue transaction-control SQL for an A1 mutation transaction.
A later child applier receives a lease and already owns a private reference to
the exact database. Possession of that raw connection is transaction-control
capability; the reviewed child is trusted and normatively prohibited from
using it to begin, commit, roll back, retry, savepoint, close, or change
connection PRAGMAs. It must call
`assertActiveMutationLease(lease, db)` before semantic DML.

The callback is a trusted synchronous internal boundary. It is not given the
database by the coordinator and must obey the same prohibitions. The private
composition test already owns its test connection so it can exercise real B1
and CDX functions; this does not make arbitrary callbacks a public API.

On the pinned Node runtime, `DatabaseSync.isTransaction` reports only whether
*some* transaction is active. It cannot distinguish the coordinator's original
transaction from a callback that illegally executes either
`COMMIT; BEGIN IMMEDIATE` or `ROLLBACK; BEGIN IMMEDIATE`.
The opaque lease therefore proves lexical ownership, not a native transaction
identity that SQLite does not expose. Continuity is certified structurally:
the exact trusted child-applier set is reviewed and prohibited from exercising
its raw transaction-control capability. A1 proves that closure only for its
new production module/diff; it does not outlaw the existing, separately
contracted B1 transaction owners. M2-A2 and M2-B must enumerate and audit each
of their exact coordinator-bound applier/import paths. A hostile callback that
already possesses the raw connection and replaces the transaction violates
this trusted boundary; A1 makes no runtime detection claim for that
indistinguishable case.

## 5. Connection policy and success state machine

Before every `BEGIN`, `run` sets and reads back all five connection-local
settings:

```text
PRAGMA foreign_keys = ON
PRAGMA busy_timeout = 0
PRAGMA recursive_triggers = ON
PRAGMA ignore_check_constraints = OFF
PRAGMA trusted_schema = OFF
```

Any execution/readback failure or unequal value is
`mutation_connection_policy`. No semantic transaction has begun. M2-A1 does
not promise restoration of the caller's prior PRAGMA values.

Each successful call follows this exact order:

1. reject a poisoned owner;
2. validate the callback and captured native connection state;
3. reject coordinator re-entry or any already-active native transaction;
4. configure and verify the five PRAGMAs;
5. execute exactly one `BEGIN IMMEDIATE`, with no retry or savepoint;
6. issue a fresh active lease and invoke the callback synchronously;
7. before classifying a callback throw or return value, give any recorded
   active-lease ownership failure precedence and verify that the owner is not
   poisoned and the lease remains active;
8. reject a Promise or thenable result, then verify that the native connection
   remains open and in a transaction;
9. execute exactly one `COMMIT`;
10. verify the connection no longer reports an active transaction, retire the
    lease, and return the captured callback result.

The callback is never invoked if entry validation, connection policy, or begin
fails. A held write lock maps to `mutation_busy` immediately because
`busy_timeout=0`; no retry occurs. A non-busy native begin failure maps to
`mutation_begin_failed`.

Every `run` call owns either zero transactions or one outer transaction. It
never borrows a caller transaction and never conditionally becomes a child
savepoint owner. Concurrent connections serialize at `BEGIN IMMEDIATE`, before
any later database-dependent resolution. A second connection cannot observe
uncommitted effects.

## 6. Error vocabulary and precedence

`MemoryMutationError` is the one coordinator infrastructure error class. Its
public constructor is:

```js
new MemoryMutationError(code, message, cause?)
```

`code` must be one of the twelve primitive strings below and `message` must be
a non-empty primitive string; otherwise construction throws a native
`TypeError` before branding the value. A supplied non-`undefined` third
argument becomes the standard non-enumerable `cause` without coercion.
Instances have `name === 'MemoryMutationError'`, the standard non-enumerable
`message`, and exactly one immutable enumerable `code` among their public
classification fields. Its closed code vocabulary is:

```text
mutation_invalid_argument
mutation_connection_invalid
mutation_connection_policy
mutation_transaction_active
mutation_busy
mutation_begin_failed
mutation_async_apply
mutation_transaction_ownership_lost
mutation_commit_failed
mutation_commit_outcome_unknown
mutation_cleanup_failed
mutation_poisoned
```

These codes do not classify gate policy refusals or ordinary projection
validation/constraint failures.

The exact failure law is:

| Point | Reliably observed state | Result |
|---|---|---|
| entry | owner already poisoned | `mutation_poisoned`; no database access |
| entry | callback is not a function | `mutation_invalid_argument` |
| entry | branded connection closed | `mutation_connection_invalid` |
| entry | owner re-entry or native transaction active | `mutation_transaction_active`; caller transaction untouched |
| policy | setting/readback fails or mismatches | `mutation_connection_policy`; callback not invoked |
| begin | native busy/locked | `mutation_busy`; no retry/callback |
| begin | other native failure | `mutation_begin_failed`; no callback |
| callback | throws, no active-lease ownership failure is already recorded, and owned transaction remains active | one rollback; original callback error is rethrown |
| callback | returns Promise/thenable, no active-lease ownership failure is already recorded, and transaction remains active | one rollback; `mutation_async_apply` |
| callback/check | connection closed, state unreadable, or no transaction | poison; `mutation_transaction_ownership_lost`; no rollback claim |
| commit | throws and transaction reliably remains active | one rollback; `mutation_commit_failed` caused by commit failure |
| commit | throws and transaction is absent or unreadable | poison; `mutation_commit_outcome_unknown`; no rollback or commit-outcome claim |
| post-commit | transaction state is active or unreadable | poison; `mutation_commit_outcome_unknown`; no success is exposed |
| cleanup | required rollback throws, or returns without a reliably readable inactive transaction state | poison; `mutation_cleanup_failed`; cause is a native `AggregateError` whose two-entry `errors` array is exactly `[primaryFailure, cleanupFailure]` by identity and order |

A required rollback is successful only when the captured native `ROLLBACK`
returns and a captured native state read reliably reports no active
transaction. If `ROLLBACK` throws, that thrown value is `cleanupFailure`. If
the state read throws, that thrown value is `cleanupFailure`. If it reports an
active transaction, `cleanupFailure` is a native `Error` with the exact message
`Rollback did not end the transaction.`. A successful required rollback
retires the lease and leaves no A1 transaction active. A cleanup failure, lost
ownership, or unknown commit outcome poisons
the coordinator permanently; every later `run` fails first with
`mutation_poisoned` and does not inspect the database. The caller must discard
and close the connection.

Atomic rollback is claimed only when transaction ownership remained available
and the required rollback succeeded. After connection close, child transaction
replacement/loss, rollback failure, or an unknown commit outcome, no state
restoration claim is made. The coordinator never converts an uncertain outcome
into success.

If a currently active lease assertion fails while the exact owner transaction
reliably remains active—for example, a child passes the wrong native
connection—`run` rolls back that owner transaction before throwing the recorded
`mutation_transaction_ownership_lost`; successful rollback does not unpoison
the coordinator. The recorded ownership failure wins even if the callback
catches the assertion and then throws a different error or returns a
Promise/thenable. If the exact owner transaction is absent or its state is
unreadable, no rollback/restoration claim is made. A required rollback failure
replaces the ownership error with `mutation_cleanup_failed` under the table
above.

If `BEGIN IMMEDIATE` throws, native SQLite's begin statement has not committed
semantic work. If post-failure state unexpectedly reports an active
transaction, the coordinator treats it as its cleanup responsibility and
applies the same rollback/cleanup precedence before returning the mapped begin
failure. If transaction state is unreadable, it poisons the owner and returns
`mutation_begin_failed` without an atomicity claim.

## 7. Private real B1/CDX composition falsifier

The A1 acceptance test uses one real file-backed `DatabaseSync` connection and
the existing exported internal B1 functions. It:

1. creates the real CDX memory schema and initializes exact CDX-B1 before
   entering the coordinator;
2. starts `coordinator.run`;
3. validates the active lease against that exact connection;
4. calls the real `applyResolvedDecisionInTransaction` with a fixed,
   contract-valid direct-user create decision;
5. performs one real transaction-neutral CDX memory insert through the
   extracted store primitive on the same connection;
6. on success, proves both B1 head/atom and CDX memory/FTS effects become
   visible together only after commit; and
7. in a second fresh fixture, throws after both applies and proves successful
   coordinator rollback leaves neither B1 nor CDX effects.

This is test-only orchestration with fixed authority, identity, IDs, and time.
It proves that the coordinator can compose the two existing real mutation
surfaces. It is not a production bridge, canonical coverage proof, trusted
authority derivation, candidate receipt, or source-of-truth cutover. M2-B must
replace this private falsifier with production CDX-B2 decision/effect plus CDX
projection co-commit.

## 8. A1 acceptance and non-goals

M2-A1 passes only when all of the following are true:

- focused tests cover the exact module surface, native-brand dispatch, five
  PRAGMAs, success visibility, busy/no-retry, re-entry, stale/wrong leases,
  async returns, rollback, commit failure, ownership loss, unknown outcome,
  cleanup failure, poisoning, and the explicit replacement-transaction limit;
- the private composition proof in §7 passes on real SQLite;
- the coordinator is the only new production file and no runtime gate/store/
  adapter module imports it yet;
- the CDX-B1 contract, production, helpers/fixtures, and every dedicated test
  except `tests/memory-bundle-coexistence.contract.test.mjs` remain
  byte-for-byte unchanged from M2-A1's baseline commit `616c60b`. That one
  coexistence file has only the bounded source-inventory classification diff
  needed to recognize exact `src/mutation-coordinator.mjs` as A1-isolated,
  node-only, and B1-unaware; all of its B1 semantic tests remain unchanged and
  the full B1 tests remain green;
- the full pre-A1 suite remains green, with the new total reported separately
  rather than claiming the original 208 tests are unchanged; and
- `STATUS.md` advances only to `V2-M2-A2`, leaving parent V2-M2 unchecked, and
  the certified A1 history is fast-forwarded and pushed to `main` as the
  charter requires.

M2-A1 does not define or claim:

- a canonical patch vocabulary, evidence thresholds, source/priority mapping,
  trusted actor/scope, or any change to U4 compatibility policy;
- a complete CDX mutation matrix, deterministic batch law, supersession plan,
  lifecycle correction, permanent-linearity repair, type-partition repair,
  manager concurrency, whole-workspace deletion, or raw-writer closure;
- a production B1/B2 write path, journal, refusal receipt, candidate receipt,
  replay/rebuild, temporal query, driver cutover, physical deletion, deletion
  proof, signature, cryptographic audit, provider behavior, benchmark score, or
  publication result; or
- authority to run sealed U8 question `1568498a`, live-provider work, spend,
  dataset download, or publication.

Those reservations are not waivers. M2-A2 and M2-B must close their assigned
items—including the mandatory map-or-refuse carry-forward law in §1—before
V2-M2 can complete; later STATUS units remain in their recorded order.

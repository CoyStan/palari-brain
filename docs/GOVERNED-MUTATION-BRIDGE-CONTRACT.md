# Governed Mutation Bridge Contract — Palari v2 M2-B

**Status:** reviewed normative M2-B contract cut point; production
implementation remains pending. Three independent final reviews ended with
zero blockers or majors. Nothing in this document authorizes a live provider
call, dataset download, benchmark run, publication, or terminal store deletion.

This contract is one normative set with:

- `docs/MEMORY-AUTHORITY-CONTRACT.md` — exact trusted-host boundary,
  capabilities, use-time revocation check, state machine, errors, and
  precedence;
- `docs/GOVERNED-MUTATION-DISPOSITION-REGISTRY.md` — the executable 46-row,
  22-dimension map-or-refuse registry; and
- `docs/CDX-B2-SCHEMA-CONTRACT.md` — exact configuration record/hash, SQL,
  manifests, bootstrap, journal, reducer, and verifier.

An implementation conforms only to the conjunction. A summary in this file
never relaxes an exact rule in those three appendices.

## 1. Governing order and purpose

The governing order is:

1. the Unified Specification at
   `c9af823c7dee29d29fd937d44527f3b78d8d3845`, especially Parts 2, 4, 5,
   8, 12, 13, and 15;
2. `docs/KERNEL-CONTRACT.md` and `docs/KERNEL-API.md` for CDX-M1 runtime
   semantics;
3. `palari-v05` at `190a4ad2f8d5187f5f21222048dd11efb2ad9991`;
4. `docs/MEMORY-BUNDLE-CONTRACT.md` for exact CDX-B1 only; and
5. the A1/A2 compatibility contracts, which inventory legacy behavior but do
   not make that behavior canonical.

M2-B inserts the missing governance layer between the five A2 compatibility
intents and CDX-M1. It establishes one minimal operation without altering any
registered patch constant: ratified erasure of one private, same-Palari,
same-user, zero-link atom. Because the reference kernel has no `ratify` Apply
handler, this contract also records the deliberately narrow structural Apply
amendment in section 4.2 and the repository's governing decision/contract
files. Every other A2 semantic mutation is refused at this cut point.

The bounded completion claim is:

> After one immutable payload-column-free checkpoint, each enabled in-file
> production mutation either (a) presents a module-branded, use-time-checked,
> exact-target erasure grant and co-commits one governed decision, its two
> ordered B2 effects, and one CDX atom deletion; (b) commits one exact
> zero-effect governed refusal after a valid erasure grant; or (c) is refused
> before B2/CDX DML. No legacy label becomes authority.

CDX-M1 remains runtime/read authority. CDX-B1 stays byte-identical to
`1d65bb09de854a46abb21d762ea50cc80bb99a9f`, non-authoritative, and with all
six capability bits false. B2 is a governance overlay, not canonical payload
storage or a read-path cutover.

M2-B does **not** claim signatures, hostile-host safety, cross-process or
cross-machine capability security, external-ledger authenticity, complete
authority-history reconstruction, cryptographic audit, external anchoring,
payload replay, content-tamper detection, driver rebuild, physical deletion,
deletion proof, provider behavior, benchmark performance, or publication
readiness.

## 2. Exact provenance and collision rulings

The configuration record pins and verification checks these exact sources:

| item | exact value |
|---|---|
| Unified commit | `c9af823c7dee29d29fd937d44527f3b78d8d3845` |
| Part 2 blob | `0df141ad0c5dacb50e81a40b6199769b120f0770` |
| Part 4 blob | `a0eda8e01c876f7955b74d26afe014bc74147c26` |
| Part 5 blob | `4d8239e8e2b3f7b85698a56cd6b9d93b195ae5fc` |
| Part 8 blob | `3ddac03564d518e86b7494d2e408c2b839a88df2` |
| Part 12 blob | `6108926f82f8c44c7ed5a946314c39ce8ea1a115` |
| Part 13 blob | `39c92bd7a3626e808053a7ae8ceb17dbccf40e59` |
| Part 15 blob | `e6d21d558bce132678ac8b50abb832797b40a950` |
| reference patch-kernel blob | `df4de5f00ae88ba670305f9b2bb699441cc5b234` |
| reference kernel version | `FB1-4.patch-kernel-v1` |
| A1 implementation | `07d65adcd271b5db04beb9a9fec2335adfb443e2` |
| A2 certified baseline | `53e5b0357f83be7700a32458d38922cb7777a66e` |
| A2 router blob | `566395f2f114ebfa0d52481632a9cfc6f21b3256` |
| A2 obligations blob | `33d8fa3b89e5348d3e5d624315fcd1c870ed095c` |
| A2 routing-contract blob | `a3ad75dc78644de2329af2feb680aef559068774` |
| A2 plan version | `CDX-M1-legacy-plan@1` |
| protected B1 baseline | `1d65bb09de854a46abb21d762ea50cc80bb99a9f` |

Part 4's erasure text transitively references Part 14. The Unified commit pin
intentionally governs that reference as a whole; Part 14 blob
`8e08234eb822ac1c62d31ea9465226941226bc95` is independently checked and
recorded as non-config provenance. It is not a new configurable kernel
constant and therefore is not added to the canonical configuration bytes.

The complete reference registry is preserved verbatim in the canonical B2
configuration record. In particular, the only mapped ratification pair is
`ratify|ratified_user -> provenance`, its evidence threshold is `1.0`, and
`ledger` visibility has floor/rank `1`.

Two tempting mappings are forbidden:

- `perm` is a permission patch. It is not A2's `permanent` memory partition.
- A user's erasure request is not `g_demote`. `demote|ratified_user` is
  unregistered, and relabeling the user as `g_demote` would be source
  laundering. Consequently `PD-02` and every other legacy demotion branch
  refuse in M2-B.

Part 4 makes edge mutations `write` patches. The reference priority map has no
registered `write|source` pair. Consequently any erasure that would cascade an
incident link refuses before CDX DML. M2-B does not journal a link-erasure
effect and does not pretend an FK cascade is canonically authorized.

## 3. Trusted authority boundary

The exact authority profile is `host-checked-external-grant-v1` and is defined
in `docs/MEMORY-AUTHORITY-CONTRACT.md`.

A root is a process-local identity/audience anchor, not authority. It has no
verbs and cannot mint consent. A trusted host creates it with the exact
workspace/Palari/user tuple, an external authority-ledger identifier, and a
captured synchronous `checkGrantActive` predicate. A grant is an attenuated,
opaque wrapper around one already-recorded external event. It carries only
`erase_atom`, one `mem_` target, one expiry, and exact audit identifiers.

The predicate is invoked after every untrusted legacy value has been captured
and immediately before A1. Primitive `true` is required. The module then
rechecks all local state, samples native action time, enforces strict expiry,
and enters A1 without another callback or async boundary. The predicate is
trusted; B2 can prove that its result governed the committed decision, not that
the external event exists or that the predicate was truthful.

For this bounded profile, an applied or refused B2 decision is the
co-committed local materialized use event for the same logical authority
ledger identified by the grant tuple. The external grant/revocation view and
the local use view are neither atomically joined nor hash-linked; the exact
claim and resulting conformance debt are pinned in the authority contract.
The first committed B2 decision establishes the stream's one
`authorityLedgerId`. Every later decision and every root bound after reopen
must match that sequence-one value; a different ledger cannot append or bind.

Roots and grants are frozen, zero-own-key, WeakMap-branded process
capabilities. Their empty carriers can be serialized/cloned, but the private
authority brand cannot survive either operation. A root binds once to one successful store
generation and is retired before close. A grant is exact-root, exact-audience,
exact-generation, exact-target, exact-verb, revocable, expiring, and
one-decision. A committed applied or refused decision burns it; a failure
proved to have committed nothing releases its reservation; any uncertainty
retires the root, audience, and all grants.

Authority is never inferred from actor, writer, proposal kind, source kind,
confidence, policy floor, shared flag, caller scope, caller clock, or model
output. The authority public module is never re-exported by the store, gate,
manager, adapter, extractor, summary, scheduler, or recall surfaces.

Rootless B2 stores remain readable and verifiable. Their mutation methods
refuse. Disabled handles preserve their inert compatibility values and inspect
neither authority nor caller input. For enabled handles, closed-store liveness
wins; an omitted grant gives a route-shaped governed refusal without touching
caller input; a present malformed, stale, revoked, expired, wrong-audience,
wrong-target, or wrong-verb grant follows the closed authority error law.

## 4. The only governed operation

### 4.1 Canonical patch

For both accepted compatibility rows, the bridge constructs this exact patch
from module-generated ids and trusted authority state:

```js
{
  id: patchId,
  kind: 'ratify',
  target: {
    slot: `mem/${targetId}`,
    visibility: 'ledger',
  },
  source: 'ratified_user',
  priority: 'provenance',
  payload: {
    operation: 'erase_owned_atom@1',
    atomId: targetId,
  },
  provenance: {
    strength: 1,
    timestamp: evidenceAt,
    evidence: [authorityEventId],
  },
  validity: {
    notBefore: issuedAt,
    notAfter: expiresAt,
  },
  permRank: 1,
  conflictsWith: [],
}
```

Admission uses exactly `{now: observedAt, trustRank: 1}` and the reference
C1–C8 order. Before admission the authority gate has already required:

```text
evidenceAt <= issuedAt <= effectiveAt = observedAt < expiresAt
```

The reference C6 interval remains inclusive; the stricter local
`observedAt < expiresAt` rule means equality never reaches C6. All eight
conditions must pass. An admission rejection here is an implementation
invariant failure and rolls back; it is not a committed policy refusal.

The bridge runs the exact six-field strict-key resolver and ghost-defeat-free
greedy walk over the singleton admitted set. It must return exactly that patch
as the sole kept patch and no drop. Any other result is an invariant failure.

### 4.2 Exact target-typed Apply specialization

The reference implementation has no `ratify` state handler. M2-B therefore
does not falsely claim that erasure is inherited behavior. It records one new,
scoped structural-kernel amendment: the target-typed pure Apply specialization
under profile
`FB1-4.ratified-erasure-apply-v1`:

```text
ApplyRatifiedErasure(stateDescriptor, keptPatch)
```

`stateDescriptor` contains only target id, exact Palari/user scope, shared bit,
presence, FTS cardinality, and incident-link count. It contains no content or
content-derived value. Apply uses this exact first-match order:

1. absent target -> `missing_target`;
2. target Palari or nullable user differs from the exact root tuple ->
   `scope_mismatch`;
3. exact-scope target has `shared=1` -> `shared_scope_unsealed`;
4. exact-scope private target has one or more incident links ->
   `incident_edges_unemittable`;
5. exact-scope private target has zero incident links and exactly one FTS row
   -> applied atom erasure.

Target type and current/ended validity do not affect ratified erasure. For a
permanent atom, this operation consumes storage membership after explicit
ratification; it does not update or correct the permanent payload and does not
relax demote-and-promote linearity. A zero or multiple FTS cardinality is
projection corruption, not a refusal. It rolls back with
`governance_projection_invalid`.

The pure applied result removes exactly the atom membership and declares two
ordered projection receipts:

```text
0 projection_atom_erased targetId
1 projection_fts_erased  targetId
```

The paired CDX plan contains exactly one branded `cdx_memory_delete` effect.
The A2 projection applier deletes the atom; the existing FTS delete trigger
deletes exactly one FTS row. Because accepted targets have zero incident
links, the before/after link set is byte-for-byte identical. Postconditions
prove the memory and FTS membership are absent and no link changed.

The amendment selects `ratify` because explicit user erasure is ceremonial
consent and the pinned registry's only `ratified_user` pair is
`ratify|ratified_user -> provenance` at strength `1.0`; representing it as
`demote` would launder the source. Part 4 separately requires a ratified
storage-erasure operation and same-operation sidecar erasure, but it does not
provide this missing Apply handler. The repository therefore records this
exact transition as an amendment rather than presenting it as inherited
behavior. The absent edge registration limits it to zero-link targets. It
does not authorize payload correction, demotion, edge deletion, shared or
cross-scope erasure, or any other Apply behavior; each would require a new
reviewed amendment.

## 5. Exhaustive A2 disposition

`docs/GOVERNED-MUTATION-DISPOSITION-REGISTRY.md` is normative and executable.
It pins the exact 46 obligation IDs, exact ordered 22 dimensions, finite
domains with explicit `not_applicable` rather than `*`, graph continuation,
closed reason vocabulary, closed recording modes, a phase-correct authority
action evaluator, and terminal evaluator. Authority preflight runs before
caller capture. Capture runs before post-capture local and activity-check
outcomes; on capture failure the bridge retains the exact capture-thrown value
by identity—including a caller/coercion throw, `LegacyMutationError`, or native
compatibility-validation error—consumes the registry's `RETHROW` action, and
rethrows that value unchanged. The value itself never enters the data-only
evaluator. Private `captureThrew` is distinct from `captureThrownValue`, so
legal `throw undefined` and `throw null` remain distinguishable from no throw;
`RETHROW` requires the flag and rethrows the stored value exactly. Impossible
cross-phase combinations are invalid registry inputs rather than invented
runtime branches.

The exact preflight domain has six values (`absent`, four reachable throws,
and `ready`); the exact post-capture/use domain has ten values (closed store,
eight reachable authority throws, and `valid`). Construction/issuance-only
authority codes are excluded from mutation-call phases. The registry executes
72 staged-authority cases before its 1,728 target-erasure cases.

The only rows that may ever produce `MAP` are:

```text
D-02 clean same-Palari same-user private shared=0 zero-link erasure
D-03 clean same-Palari same-user private shared=0 zero-link erasure
```

Both additionally require a valid exact grant and exactly one FTS row. All
other rows and all other leaves of D-02/D-03 are `REFUSE`.

The evaluator has only these recording modes:

```text
pre_gate_no_journal
decision_only
decision_and_effects
```

Only a valid, externally active, matching erasure grant may reach target
classification. `missing_target`, `scope_mismatch`,
`shared_scope_unsealed`, and `incident_edges_unemittable` commit one
zero-effect `decision_only` refusal and consume the grant. A clean applied
target commits `decision_and_effects`. Everything else is
`pre_gate_no_journal` and performs no B2/CDX write.

`projection_mismatch` is deliberately absent from the committed refusal
vocabulary. A projection/cardinality/postcondition mismatch is an internal
rollback error. The runtime must not turn corruption into a successful
governance refusal.

## 6. CDX-B2 substrate

The exact profile, canonical configuration record/hash, four-table STRICT
schema, one partial index, SQLite autoindexes, three internal FKs, eleven
triggers, and verification algorithm are normative in
`docs/CDX-B2-SCHEMA-CONTRACT.md`.

Every B2 object begins `cdx_b2_`. No B2 object case-folds to CDX-M0/M1, FTS,
B1, or an unknown B2 name. The four tables are:

1. `cdx_b2_meta` — immutable stream/config/checkpoint identity plus an exact
   one-step `head_mutation_sequence`;
2. `cdx_b2_legacy_checkpoint` — immutable, ordinal, payload-column-free
   sequence-zero inventory;
3. `cdx_b2_decisions` — append-only ratified-erasure decisions; and
4. `cdx_b2_effects` — append-only ordered atom/FTS effects.

The only FKs are internal and use `NO ACTION / NO ACTION / NONE`:

```text
checkpoint.stream_id      -> meta.stream_id
decisions.stream_id       -> meta.stream_id
effects.decision_sequence -> decisions.sequence
```

There is no B2 FK to B1 or an erasable CDX row. B2 triggers target only B2
tables. They may read CDX to guard the final head advance, but never perform
CDX/B1 DML.

### 6.1 Immutable checkpoint

Bootstrap writes all memories in BINARY id order, then all links in BINARY id
order, with a single one-based `checkpoint_ordinal`. The exact union is:

- memory: id, exact `palari_id`, nullable `user_id`, legacy type, shared bit,
  and validity class `current|ended`; link endpoints are null; or
- link: id and exact from/to memory ids; all memory-only fields are null.

Every link endpoint must resolve to a preceding checkpoint memory. Exact
legacy ids are retained even when they do not match the new `mem_` UUIDv4
grammar; such atoms are verifiable but unerasable in M2-B.

The checkpoint excludes content, keywords, content-derived hashes, source
text/message ids, extractor/source strings, confidence, importance, access
telemetry, arbitrary relation text, timestamps beyond the checkpoint time,
proposal JSON, SQL, and errors. The honest term is
**payload-column-free**, not content-free: arbitrary historical identifiers
and scope values remain verbatim and may coincidentally contain sensitive
text. Tests trace canaries from every excluded content-bearing column; they do
not make an impossible global-byte-absence claim.

`baseline_disposition='unadjudicated'` means checkpoint rows were not admitted
or ratified and their provenance/authority is unknown.

### 6.2 Decision and effect meaning

Each decision stores one module-generated sequence, `b2d_` decision id, and
`b2p_` patch id; exact kernel fields; exact authority ledger/event/capability
ids; exact user audience; all four authority times; outcome/refusal; effect
count; and the configuration hash. It stores no content, content-derived
value, arbitrary rationale, selector, proposal, SQL, or exception text.

The decision operation is only `atom_erase`; patch tuple only
`ratify|ratified_user|provenance`; target kind only `memory.atom`; visibility
only `ledger`; evidence only `ratified_user` at strength `1.0`; authority kind
only `user`; resolution only `kept`; and failed-condition mask only `0`.

Applied decisions have null reason and exactly two effects. Refused decisions
have one of the four target-transition reasons and zero effects. Effect 0 is
`projection_atom_erased`; effect 1 is `projection_fts_erased`; both name the
exact target. Authority event and capability identifiers are individually
unique. The applied target has an additional partial unique index. This, the
checkpoint, and replay forbid memory-id reuse.

### 6.3 Raw-SQL honesty limit

The B2 triggers prevent updates/deletes, gaps, malformed in-process appends,
wrong effect tails, and a head advance whose exact CDX postcondition is false.
They do not provide a general SQLite commit hook. A raw SQL client can commit a
partial unheaded tail, which the complete verifier rejects on the next open or
governed use. A sufficiently privileged client can forge a mutually coherent
B2/CDX history; without signatures or an external anchor that forgery is not
distinguishable from legitimate state. M2-B makes neither claim.

## 7. Atomic bootstrap and verification

Enabled open uses the already serialized pre-handle path owner. It configures
and proves all five A1 PRAGMAs, enters one `BEGIN IMMEDIATE`, and first
inventories case-folded B2 objects plus the `CDX-B2` migration marker. Only a
B2-absent candidate may then run the certified A2 ordinary CDX-M0/M1
completion and exact-manifest verification inside that transaction; this may
create the ordinary missing M0/M1 objects, columns, and migration rows exactly
as A2 already permits. A complete B2 state takes the verify-only branch and
never enters ordinary repair.

Exactly two states are accepted:

1. no B2 object and no marker: verify complete M0/M1, snapshot CDX, create the
   exact B2 schema/meta/checkpoint/marker, run the full verifier/reducer, and
   commit; or
2. the complete exact B2 manifest and marker: verify only, without invoking
   clock/id callbacks and without repair.

Any partial object set, case variant, marker/schema disagreement, extra B2
object, or malformed history rolls back and fails closed. B2 initialization
never repairs B2 state; this does not prohibit the preceding certified A2
M0/M1 completion step. The `CDX-B2` marker's `applied_at` is exactly
`checkpoint_at` and the three accepted legacy physical memory-column orders
are recorded distinctly.

The marker causes the certified A2 open oracle, which accepts only M0/M1, to
fail closed. It does not stop an already-open older process or the old binary's
filesystem deleter. Upgrade therefore requires single-process/offline
quiescence and claims no cross-version fencing.

Verification order is exact:

```text
connection policy and bootstrap/A1 transaction ownership
-> layout
-> singleton config/meta/migration
-> checkpoint
-> journal/reducer
-> live replay/projection
```

Verification is complete, never prefix/truncation based. Replay starts from
the checkpoint and removes only targets of applied erasure decisions. Links
never change. It compares expected/current CDX memory membership and retained
scope/type/shared/validity class, exact link ids/endpoints, and exactly one FTS
membership per present memory with none for erased memories.

The bounded verifier cannot detect changes limited to content, keywords,
importance, confidence, fictional status, access fields, acquisition/source
fields, memory or link creation timestamps, exact validity timestamps within
the same class, relation text, or rowid replacement that preserves the checked
projection. Those limitations are tests and nonclaims, not silent gaps.

## 8. One production transaction owner

`src/governed-memory-bridge.mjs` is the sole production constructor/owner of
`createMutationCoordinator(db)`. The legacy router no longer owns a
coordinator and has no production `execute` method. It becomes a historical
capture/planner plus one transaction-neutral, lease-checked projection
applier. Historical A2 tests use a test-owned coordinator; no production root
reaches the old compatibility execution path.

### 8.1 Exact internal module namespaces

These are internal dependency edges, not returned capabilities. None has a
default export, extra named export, or public re-export through store, gate,
manager, extraction, adapter, recall, or scheduler modules.
“Exact own-data record” below uses the authority contract's trap-free record
law: ordinary or null prototype, non-Proxy, exact `Reflect.ownKeys`, own data
properties only, no accessors/inheritance/extras/coercion.

`src/governed-mutation-dispositions.mjs` has exactly four exports:

```js
export const GOVERNED_MUTATION_DISPOSITION_VERSION
export const governedMutationDispositionRegistry
export function evaluateGovernedMutationDisposition(obligationId, input)
export function verifyGovernedMutationDispositionRegistry()
```

The version is `CDX-M1-legacy-disposition@5`. The registry is a recursively
frozen null-prototype data record mechanically equal to the reviewed JavaScript
artifact. `verify...()` runs the complete embedded assertions and returns the
detached frozen verification record; `evaluate...()` implements the exact
route/phase evaluator. Unknown, impossible-phase, or structurally invalid
internal inputs throw a native `Error`; if production bridge code can provoke
one, it converts that defect to `governance_internal_invariant`, rolls back,
poisons, and retires authority.

`src/cdx-b2-schema.mjs` is an immutable dependency leaf with exactly six
exports:

```js
export const CDX_B2_KERNEL_CONFIG_JSON
export const CDX_B2_KERNEL_CONFIG_HASH
export const CDX_B2_CREATE_STATEMENTS
export const CDX_B2_MANIFEST
export const CDX_B2_REQUIRED_PRAGMAS
export function normalizeCdxB2Sql(sql)
```

The first two are the exact ASCII bytes/hash in the schema contract. Create
statements are the recursively frozen, main-qualified, ordered four-table,
one-index, eleven-trigger statements. The manifest is the recursively frozen
exact object/xinfo/index/FK/trigger/stored-SQL record in that contract.
Required PRAGMAs are the five A1 values. Normalization accepts only a primitive
string and implements the exact schema-contract algorithm; otherwise it throws
native `TypeError`. This module imports no runtime, authority, router,
coordinator, store, B1, filesystem, clock, random, or database module and
performs no I/O at evaluation.

`src/cdx-b2-journal.mjs` has exactly five exports; its exported error is the
same class identity re-exported by the bridge:

```js
export class GovernedMemoryError extends Error
export function bootstrapCdxB2InTransaction(lease, db, input)
export function verifyCdxB2InTransaction(lease, db)
export function appendCdxB2TailInTransaction(lease, db, input)
export function advanceCdxB2HeadInTransaction(lease, db, sequence)
```

Every operation is synchronous and asserts the exact A1 lease/connection
first. None executes transaction control or B1 DML. The bootstrap function is
the sole narrow structural exception to the CDX-DML prohibition: after it has
classified B2 inventory/marker state, and only for a B2-absent candidate, it
owns the certified A2 M0/M1 structural completion and complete verification,
then the exact B2 creation/checkpoint and `CDX-B2` migration-marker insert in
the order pinned by the schema contract. It performs no semantic
`memories`/`memory_links`/FTS-row mutation. `verify`, `append`, and `advance`
execute no CDX or B1 DML at all. Bootstrap input is an exact ordinary or
null-prototype own-data record with keys
`['workspaceId']`; the journal derives and verifies the exact legacy schema
variant rather than accepting it. Only the new-B2 branch samples the
module-captured native clock/UUID source; complete reopen invokes neither.
Bootstrap and verify return a frozen null-prototype record with exact keys:

```js
{
  streamId,
  headMutationSequence,
  lastObservedAt,       // null at head zero
  authorityLedgerId,    // null at head zero, otherwise sequence-one value
  checkpointMemoryCount,
  checkpointLinkCount,
}
```

The journal's `null` head-zero ledger sentinel is not passed through as an
authority argument: bridge construction translates it to exact `undefined`
for `bindMemoryAuthorityRoot`; a non-null value is passed unchanged.

Tail input has exactly `['decision','effects']`. `decision` has exactly the
`cdx_b2_decisions` xinfo column keys in ordinal order; `effects` is a frozen
array of zero or two records, each with exactly the `cdx_b2_effects` xinfo
column keys in ordinal order. The caller supplies no SQL or omitted/defaulted
column. Append returns exact `undefined`. Advance accepts one safe positive
integer sequence, updates only the singleton head, runs the complete verifier,
and returns the verification record above. All structural/state failures use
the closed `GovernedMemoryError` pair; native SQLite causes are retained where
the error contract permits.

The updated `src/legacy-mutation-router.mjs` namespace is exactly seven
exports:

```js
export class LegacyMutationError extends Error
export const legacyMutationIntentKinds
export const legacyMutationEffectKinds
export function applyLegacyMutationEffectInTransaction(lease, db, effect)
export function createLegacyMutationRouter(db, options)
export function prepareGovernedErasureProjectionInTransaction(lease, db, input)
export function applyGovernedErasureProjectionInTransaction(lease, db, token)
```

The first five retain their certified A2 identities and behavior except for
the two explicit M2-B amendments here: a router instance now has exact frozen
own keys `['apply','capture','resolve']`; `execute` is absent. The structural
eight-kind applier and router are historical-test surfaces driven only by a
test-owned coordinator. No production module imports either one.

The governed `prepare`/`apply` pair is the sole production semantic CDX child.
`prepare` first asserts the exact active A1 lease/connection, then accepts an
exact own-data input with keys `['id','palariId','userId']`; all three values
are already-captured primitive strings and `id` is the canonical target ID.
It re-reads and proves exactly one matching private `shared=0` target for the
given Palari/user, exactly one matching FTS membership, and zero incident
links. It performs no DML and returns a frozen null-prototype token with zero
own keys or symbols. Module-private `WeakMap` state binds that token to the
exact connection, lease, target ID, and `ready` state.

`apply` asserts the active lease/connection before token validation, requires
that exact binding and `ready` state, marks the token consumed before DML,
executes the sole governed production
`DELETE FROM main.memories WHERE id = ?`, requires exact one-row cardinality,
and returns exact `undefined`. It performs no transaction control, B2 DML,
link DML, or direct FTS DML. Unknown/malformed input uses
`legacy_effect_invalid`; an unissued token uses `legacy_plan_invalid`; a
foreign database/lease token uses `legacy_plan_stale`; reuse uses
`legacy_plan_applied`; projection or delete cardinality drift uses
`legacy_effect_cardinality`, each with the exact existing
`LegacyMutationError` message. The bridge converts cardinality drift to
`governance_projection_invalid` and impossible input/token-state failures to
`governance_internal_invariant`, preserving the legacy error as `cause`.
Neither conversion is a governed refusal: it poisons the bridge and retires
authority under the exhaustive settlement table. Other native applier errors
retain the separately recorded rollback/retry law.

Only `src/governed-memory-bridge.mjs` imports the governed pair. Production
imports may otherwise reach only `LegacyMutationError`; no production import
reaches the historical router factory or structural eight-effect applier.

`src/governed-memory-bridge.mjs` has exactly two exports:

```js
export { GovernedMemoryError }
export function createGovernedMemoryBridge(db, input)
```

Input is an exact own-data record with keys
`['workspaceId','authorityRoot']`; the final value is
either exact `undefined` or a branded root. Construction revalidates authority
after the store runtime has already performed the mandatory pre-database-open
preflight, constructs the sole production coordinator, bootstraps/verifies B2
through one A1 callback, enforces established-ledger continuity, then binds
authority before returning. It returns a frozen ordinary record with exact own
string keys `['close','erase','refuse']`, all enumerable data methods and no
symbols:

```js
bridge.close()                                  // undefined; idempotent
bridge.erase(id, options, authorityGrant)       // exact section 9 result
bridge.refuse(routeKind)                        // exact static result
```

`close` synchronously marks the bridge closed and retires its audience before
the store runtime attempts native close. `erase` owns the full staged
authority/capture/A1 sequence. `refuse` accepts only the trusted internal route
tags `legacy_proposal`, `legacy_forget_topic`,
`legacy_record_recall_inclusion`, and `legacy_run_lifecycle`; it accepts no
caller value and returns the exact no-write shape in section 9. A wrong route
tag is `governance_invalid_argument`. After close, enabled operations preserve
the earlier `legacy_store_closed` public precedence. No method returns the
bridge, db, coordinator, lease, journal state, authority audience, or child
applier. All three methods are receiver-independent captured closures; calling
them with another `this` does not change their bridge identity.

The updated `src/kernel-store-runtime.mjs` namespace is exactly:

```text
acquisitionModes
assertKernelStoreCapability
createKernelStoreRuntime
deleteKernelStoreRuntimeFile
executeGovernedStoreIntent
externalMemorySourceKinds
extractMemoryQueryKeywords
memoryAddWriters
memoryFtsTokenizer
memoryMutationActors
memoryStoreSchemaVersion
memoryTypes
permanentMemoryTypes
probeMemorySqliteDriver
transientMemoryTypes
trigramShingleSimilarity
workspaceMemoryDbPath
```

`executeLegacyStoreIntent` is removed, not retained as an alternate internal
door. The required private adapter
`executeGovernedStoreIntent(base, routeKind, input)` exists solely so the gate
can reach the bridge held in base private state. Its route tag is a module
literal; for the four static refusals `input` must be exact `undefined`, and for
`legacy_delete_memory` it is an exact own-data record with keys
`['id','options','authorityGrant']`; the values remain uncaptured until
`bridge.erase` applies its staged precedence. This adapter is never present on
a returned handle.

For an authority-bearing deletion, the exact sequence is:

1. apply disabled/liveness/root/grant precedence;
2. reserve the grant before inspecting id/options;
3. eagerly capture all legacy input; release on a pre-A1 failure;
4. recheck grant/target/verb/audience and run the authority activity check;
5. sample `observedAt`, construct immutable authority/patch scalars, and enter
   A1 directly;
6. assert the A1 lease and fully verify B2 under the write snapshot;
7. compare `observedAt` with the verified B2 tail; a lower value throws
   `governance_clock_invalid`, rolls back, poisons the bridge, and retires the
   authority audience before any nonce or generated-id check;
8. reject historical authority/capability id reuse;
9. generate the next decision/patch ids once; a collision is an internal
   error, never retried;
10. run exact Admit, Resolve, and the pure erasure transition;
11. for the applied leaf, obtain the sole branded zero-key projection token;
    materialize/deep-freeze a one-use plan pairing the decision, zero or two
    B2 effects, and zero or one such CDX delete token;
12. insert the decision and ordered B2 effects;
13. apply the sole branded CDX effect when mapped;
14. prove exact memory/FTS/link postconditions;
15. advance meta exactly one and verify the complete new tail;
16. let A1 commit, then burn the grant and return a detached legacy-compatible
    result.

There is no user callback, authority callback, clock callback, random-id
callback, coercion, async boundary, or public re-entry from step 5 through A1
completion. Native identifiers/times are sampled outside caller control.

Known applied and zero-effect refusal decisions are never visible without
their matching CDX state, and CDX state is never visible without its complete
B2 decision/effect tail. A forced failure at any ordinal rolls the conjunction
back. Busy has no retry. Unknown commit/ownership/cleanup poisons the bridge
and retires authority; no success is exposed.

## 9. Public compatibility results

M2-B preserves shapes while refusing unsupported semantics:

- enabled `gate.propose(proposal)` returns
  `{outcome:'rejected',reasons:['governance_refused']}` without inspecting the
  proposal;
- extraction/summary candidate writes receive that same rejection through
  their existing producer result shapes;
- `deleteMemory(id, options, authorityGrant)` with no root/grant returns
  `{deleted:false,reason:'governance_refused'}` without inspecting id/options;
- after a grant reserves, every capture-thrown value is preserved by identity,
  including caller getter/coercion throws, exact `LegacyMutationError`, and
  native compatibility-validation errors; all release conditionally and write
  no B2/CDX row;
- a successfully captured target differing from the grant throws exact
  `authority_grant_mismatch`, conditionally releases, and does not invoke the
  activity predicate;
- a valid grant plus absent target commits `missing_target` and returns
  `{deleted:false,reason:'not_found'}`;
- a valid grant plus scope/shared/link refusal commits the exact internal
  reason but returns `{deleted:false,reason:'governance_refused'}`;
- applied erasure preserves `{deleted:true,memory,reason:'deleted'}`, where
  `memory` is the detached pre-delete canonical CDX row;
- topic forget returns `{count:0,deleted:[]}`;
- recall inclusion returns `{touched:[],touchedCount:0}`;
- lifecycle returns `{decayed:0,deleted:0,skipped:0,touched:0}`.

Disabled values remain their existing `memory_disabled` variants and take
precedence over the enabled refusal shapes. Enabled closed handles keep
`legacy_store_closed`. Explicit invalid/unavailable/mismatched grants throw
the authority error specified by the authority contract. No returned object
contains B2 ids, authority ids, a root/grant, lease, plan, connection, or child
writer.

## 10. Closed governed error vocabulary

The public constructor is exactly:

```js
new GovernedMemoryError(code, message, cause?)
```

`code` must be one of the primitive strings below and `message` must be a
nonempty primitive string. The constructor permits any such message; the table
pins the only pairs production functions emit. A supplied non-`undefined`
third argument becomes the standard non-enumerable `cause`, preserved by
identity without coercion. The error has `name === 'GovernedMemoryError'`, the
standard non-enumerable `message`, and exactly one enumerable classification
property: immutable `code`. Its exact production pairs are:

| code | exact message |
|---|---|
| `governance_invalid_argument` | `A valid governed memory argument is required.` |
| `governance_connection_invalid` | `The governed memory connection is unavailable.` |
| `governance_transaction_required` | `A coordinator-owned governed mutation transaction is required.` |
| `governance_schema_invalid` | `The CDX-B2 schema is invalid.` |
| `governance_migration_invalid` | `The CDX-B2 migration state is invalid.` |
| `governance_config_invalid` | `The CDX-B2 kernel configuration is invalid.` |
| `governance_meta_invalid` | `The CDX-B2 metadata is invalid.` |
| `governance_checkpoint_invalid` | `The CDX-B2 legacy checkpoint is invalid.` |
| `governance_journal_invalid` | `The CDX-B2 journal is invalid.` |
| `governance_projection_invalid` | `The CDX-M1 projection does not match the CDX-B2 journal.` |
| `governance_clock_invalid` | `The governed memory observation clock moved backward.` |
| `governance_identifier_collision` | `A generated governed memory identifier already exists.` |
| `governance_state_closed` | `The governed memory bridge is closed.` |
| `governance_state_poisoned` | `The governed memory bridge is poisoned and must be discarded.` |
| `governance_internal_invariant` | `The governed memory kernel invariant failed.` |

Unknown/non-string constructor codes throw native
`TypeError: Unknown governed memory error code.`. Empty/non-string messages
throw native
`TypeError: Governed memory error message must be a non-empty string.`.

These errors are infrastructure/invariant failures. Governed target refusals
are data, not exceptions. A1 `MemoryMutationError`, authority errors, legacy
capture errors, and native caller throws preserve their own types and the
precedence pinned in their contracts.

## 11. Terminal storage refusal

`deleteKernelStoreRuntimeFile` is itself the unconditional production refusal;
`deleteKernelStoreFile` remains its public alias. Both preserve the certified
async call shape: calling either returns a native Promise already rejected
with the same exact `LegacyMutationError` reason (there is no `await` or later
turn before rejection). They do not throw synchronously to the caller. The
runtime function constructs and throws the reason inside its async body before
inspecting its argument, and the internal registry's `THROW` action therefore
becomes this immediate Promise rejection:

```text
LegacyMutationError
code: legacy_terminal_storage_refused
message: Terminal deletion of a governed memory store is refused.
```

The runtime function constructs that error before inspecting options/path,
resolving a canonical path, reading the live-path registry, or calling
`lstat`, `realpath`, `rm`, or any other filesystem function. F-01, F-02, and
F-03 all collapse to that same result. The old internal deletion implementation
is removed, so importing the runtime export cannot bypass the public alias. No
main/WAL/SHM/journal artifact is removed.

This terminal route extends the same `LegacyMutationError` class identity from
the certified A2 twelve-pair vocabulary to exactly thirteen production pairs
by adding only:

```text
legacy_terminal_storage_refused
Terminal deletion of a governed memory store is refused.
```

The existing twelve codes/messages, constructor shape, unknown-code
`TypeError`, cause law, and all other behavior remain unchanged. The new pair
is therefore constructible by the runtime function; every fourteenth or
otherwise unknown code still fails under the existing constructor law.

Tests may remove their own temporary directories through test-owned cleanup;
that is not a production capability. Reopening terminal deletion requires a
separately reviewed, founder-authorized external authority and receipt
substrate.

## 12. Static closure and acceptance falsifier

The production graph must prove:

- the bridge is the sole A1 owner;
- one B2 journal child owns B2 DML and never owns transaction control or B1
  DML; only its pre-publication bootstrap operation owns the exact certified
  M0/M1 structural completion/verification and `CDX-B2` marker insert, never
  semantic CDX memory/link/FTS-row DML;
- one A2 projection child owns semantic CDX DML and never owns transaction
  control/B2 DML;
- no proposal/model/adapter/extractor/manager-facing object exposes authority,
  connection, coordinator, lease, plan, journal writer, or projection applier;
- no production import reaches quarantined `src/memory-store.mjs`;
- B2 schema code is an immutable dependency leaf; and
- `docs/MEMORY-BUNDLE-CONTRACT.md`, all seven B1 production modules, and
  `src/memory-store.mjs` remain byte-identical to `1d65bb0`.

M2-B and parent M2 remain open until one production matrix proves, together:

1. exact executable equality with all 46 obligation IDs and 22 dimensions;
2. only the two clean D-02/D-03 leaves map;
3. proposal/model fields cannot alter authority, patch, classifier, or time;
4. every exact staged authority outcome and impossible cross-phase combination
   obeys preflight -> capture -> post-capture/activity precedence, while
   spoofed/stale/revoked/expired/reserved/consumed/wrong-audience grants
   produce no B2/CDX effect;
5. the activity check is per attempt, after successful capture, before A1, and
   absent during A1; function-valued classes/bound functions and supplied-
   receiver semantics follow the exact authority contract;
6. exact config/provenance hash and registry constants cannot be overridden;
   every internal module/runtime namespace, record, token, and result matches
   section 8.1;
7. all unsupported producers/routes/effects refuse before CDX effect zero;
8. missing/scope/shared/link target refusals commit one zero-effect decision
   only under a valid matching grant;
9. clean permanent and transient private zero-link atoms erase with exact
   decision/effect/CDX/FTS co-commit, and links are unchanged;
10. failure injection at every bootstrap, journal, projection, verification,
    head, and commit ordinal obeys rollback/poison law; post-commit grant burn
    is the total non-throwing private-state transition pinned by the authority
    contract and is not a fault-injection ordinal;
    a lower cross-root tail time fails at the pre-nonce clock ordinal;
11. two connections serialize at `BEGIN IMMEDIATE` and resolve from the
    post-lock snapshot without retry;
12. initialization over empty/nonempty and all three CDX-M1 physical variants
    is one-time, atomic, deterministic, and old-A2 fail-closed;
13. partial/case/extra/mutated B2 state is rejected and never repaired;
    ordinary pre-B2 A2 M0/M1 completion remains exact;
14. excluded payload-column canaries never enter B2, while allowed arbitrary
    identifiers are not falsely claimed content-free;
15. the complete reducer catches every in-scope projection mutation and
    explicitly demonstrates its listed blind spots;
16. both direct-runtime and public terminal deletion calls immediately reject
    with the same exact reason and reach no option/path/filesystem observation;
17. exact B1 behavior/capabilities/protected bytes remain unchanged; the
    source-inventory test changes only to classify exact M2-B modules/edges;
    one B2 stream accepts only its sequence-one authority-ledger id; and
18. exact Node `v22.22.2`, SQLite `3.51.2`, focused suites, pre-M2 regressions,
    full suite, static graph audit, and three fresh independent final reviews
    have zero failures, blockers, or majors.

## 13. Explicit deferrals

- M3: trusted create evidence, strict extraction schema, typed assistant
  evidence, promotion, supersession repair, summary lineage, and complete
  candidate receipts.
- M4: four-time historical/future semantics, as-of recall, temporal replay,
  and a registered temporal driver.
- M5: physical-residue deletion proof and tested-surface inventory.
- A recorded kernel amendment: any `write|source` registration or broader
  structural Apply behavior.
- A separate contract: demotion provenance, shared/general erasure, topic
  ratification, recall telemetry, lifecycle decay, and external signed or
  cross-process authority.
- Founder gates: providers, spend, sealed U8, unclear-license downloads,
  benchmark scoring/publication, and announcements.

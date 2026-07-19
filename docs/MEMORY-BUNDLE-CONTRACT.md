# Memory Bundle Contract — Palari v2 M1

**Status:** normative for the V2-M1 coexistence substrate.
**Founder ratification:** 2026-07-18, recorded in `docs/DECISIONS.md`.
**Runtime precedence:** `docs/KERNEL-CONTRACT.md` and
`docs/KERNEL-API.md` continue to govern the current CDX-M1 runtime.
This contract governs only the new `memory_bundle_*` objects and
modules until a later, separately tested cutover.

## 1. Purpose and boundary

M1 proves that one user-owned workspace SQLite file can contain a
canonical governed-memory substrate beside the unchanged CDX-M1 store.
It does not make the bundle authoritative and does not dual-write live
runtime mutations.

The bundle has exactly three canonical tables:

1. `memory_bundle_meta` — one consistency row and the current sequence.
2. `memory_bundle_events` — append-only, content-free gate decisions.
3. `memory_bundle_atoms` — canonical memory payloads, immutable while
   present and governedly erasable.

Future recall indexes are projections. M1 builds no projection and no
driver abstraction. The existing CDX-M1 tables remain runtime truth.

## 2. Honest capability statement

M1 capabilities are exactly:

```js
{
  sourceOfTruth: false,
  physicalDeletion: false,
  deletionProvable: false,
  signed: false,
  cryptographicAudit: false,
  externalAnchorRequired: false,
}
```

M1 proves only:

- atomic initialization of the three-table bundle;
- append-only content-free decisions;
- immutable-while-present canonical atom payloads;
- logical owner deletion from canonical current state;
- permanent non-reuse of a deleted memory id;
- exact-sequence conflict detection;
- deterministic current-state verification and replay;
- one-connection transaction composition in tests;
- coexistence with the unchanged CDX-M1 runtime.

M1 does not claim secure erase from SQLite freelists, rollback journals,
WAL/SHM files, storage media, backups, exports, snapshots, provider
caches, or previously copied files. It has no hash chain, Merkle root,
signature, signed receipt, portable stream, or historical replay of
deleted payload content.

## 3. Module surface and transaction ownership

The exact JavaScript module surface is:

```js
// src/memory-bundle-apply.mjs
export { MemoryBundleError }
export function initializeMemoryBundle(db, options)
export function applyResolvedDecisionInTransaction(db, input)

// src/memory-bundle.mjs
export function openMemoryBundle(options)
```

`src/memory-bundle.mjs` does not re-export either mutation function or
`MemoryBundleError`. Neither module has a default export, additional named
export, or test-only export. Private implementation modules may exist but
are not part of the contract.

The one frozen capability object in §2 is reused by the public handle and
all successful verify/replay results. It has exactly the six listed own
properties and no mutation API.

At module evaluation, the implementation captures the imported
`DatabaseSync` and `StatementSync` constructors; `Reflect.apply`,
`Reflect.construct`, `Reflect.getPrototypeOf`, `Reflect.ownKeys`, and
`Reflect.getOwnPropertyDescriptor`; `node:util.types.isProxy`;
`Array.isArray`; the module-realm `Object.prototype` and `Array.prototype`;
the native `Date` constructor and original `Date.prototype.toISOString`;
`node:path.isAbsolute`; `pathToFileURL`; `crypto.randomUUID`; and every native DatabaseSync or
StatementSync method it uses. Required captured database methods include
`exec`, `prepare`, and `close`; required statement methods include `get`,
`all`, `run`, `setReadBigInts`, and `setReturnArrays`.

Node 22.22.2 installs `isOpen` and `isTransaction` as own native accessors
on each DatabaseSync object rather than on its prototype. The module
therefore constructs exactly one never-opened probe with
`new DatabaseSync(':memory:', { open: false })`, captures the two getter
functions from that probe's own property descriptors, and retains only the
getters. A candidate is DatabaseSync-branded only when it is not a Proxy and
applying the captured `isOpen` getter to it succeeds. `instanceof`,
prototype/constructor equality, caller-visible symbols, and caller methods
are never used for brand detection. A Proxy around a real connection, a
prototype spoof, or any other non-branded value is
`bundle_invalid_argument`. A branded value for which the captured `isOpen`
getter returns false is `bundle_connection_invalid`. Native subclasses and
native-branded objects whose JavaScript prototype was changed remain valid.

Every database and statement operation uses captured native functions via
captured `Reflect.apply` with the native receiver. The implementation never
dispatches through `db.method`, `statement.method`, an instance shadow, or a
subsequently changed prototype. Database construction uses the captured
constructor through captured `Reflect.construct`. These protections begin
at module evaluation; poisoning realm primordials before module evaluation
is outside the M1 threat boundary.

### Initialization

For both internal functions, `db` must satisfy the native-brand and open
state rules above. The functions never accept a raw path in place of the
connection. Every internally prepared statement that returns rows calls the
captured `setReadBigInts(false)` and `setReturnArrays(false)` methods before
reading, so caller-selected DatabaseSync constructor row modes cannot alter
bundle semantics.

`initializeMemoryBundle(db, options = {})` is internal and synchronous.
`options` must be a non-Proxy plain exact-shape object under the §8 object
rule, but its allowed own-key set is any subset of `clock` and `idFactory`:

```js
{
  clock?: () => Date,
  idFactory?: () => string,
}
```

An omitted key selects a module-owned default. The default clock constructs
one Date through the captured native Date constructor; the default id
factory invokes the captured `crypto.randomUUID`. A present key whose value
is `undefined` or not a function is invalid. No other key, symbol, accessor,
or non-enumerable option is accepted.

Both callbacks are invoked from their captured descriptor values with
`Reflect.apply(callback, undefined, [])`: the supplied `thisArgument` is
`undefined` and the argument list is empty. The clock result is validated by
applying the captured original `Date.prototype.toISOString` directly to it.
The implementation does not use `instanceof Date`, `result.toISOString`,
`valueOf`, `getTime`, string coercion, or a caller property. A native Date
from another realm and a Date subclass are accepted by their native Date
internal slot; an own or inherited replacement `toISOString` is ignored. A
Date Proxy, `Object.create(Date.prototype)`, invalid Date, primitive, or
other non-Date value is `bundle_invalid_argument`. The extracted string must
satisfy the exact timestamp predicate in §6. `idFactory` must return a
primitive unprefixed lowercase RFC 4122 UUIDv4 without coercion; the
initializer prefixes it with `str_`.

On a fresh bundle, callback evaluation begins only after `BEGIN IMMEDIATE`
succeeds. `clock` is called first. If it throws or returns an invalid value,
`idFactory` is not called. If clock validation succeeds, `idFactory` is
called once; its throw or invalid return short-circuits all later work. A
successful fresh initialization therefore calls each exactly once. Any
callback failure causes `bundle_invalid_argument` and full rollback. On a
valid existing bundle, neither callback is called.

The callbacks are a trusted deterministic test/production seam. They must
be side-effect-free with respect to `db`: they do not begin, commit, or roll
back transactions; execute SQL; close the connection; alter PRAGMAs; or
re-enter the supplied connection. Violating this precondition is outside
the supported API boundary and voids initialization atomicity claims.

The function returns exactly `undefined`, never retries, and uses this
race-safe state machine:

1. Validate the native database brand; capture and validate the exact
   options object and callback types; require the captured native `isOpen`
   state to be true; reject a captured native `isTransaction` state of true
   with `bundle_connection_invalid`; set and verify the four §9 PRAGMAs; and
   reject the connection-local TEMP-trigger contamination defined in §9 with
   `bundle_connection_invalid`.
2. Open one explicit deferred read transaction. Inventory only
   `main.sqlite_schema`.
3. If any application-defined `memory_bundle_*` object exists in that
   snapshot, perform complete verification there. On success, commit the
   read transaction and return without calling either callback. On failure,
   apply the cleanup rule below and throw; no write transaction is opened.
4. If no bundle object exists, commit the read transaction, then attempt
   one `BEGIN IMMEDIATE`. A busy/locked result becomes `bundle_busy`; there
   is no retry and no callback has run.
5. Re-inventory `main.sqlite_schema` under the acquired write lock before
   calling either callback:
   - if still absent, evaluate callbacks in the order above, create the
     complete manifest/meta row, run complete verification inside the same
     transaction, and commit;
   - if a complete valid bundle appeared in the race window, verify it,
     commit without mutation, return `undefined`, and call neither callback;
   - if a partial, malformed, or unknown bundle appeared, roll back without
     mutation or callback invocation and throw the deterministic
     verification error.

Thus an actually fresh initialization commits the complete schema and
singleton row or no created object. A pre-existing or raced valid bundle is
left unchanged. A partial/malformed layout is never removed or repaired.
For any initializer-owned transaction failure, rollback is mandatory. If
rollback succeeds, the original mapped error wins. If rollback itself
fails, `bundle_storage_error` replaces the original error, the caller must
discard/close that connection, and no post-failure atomicity claim is made
about the underlying SQLite/I/O failure.

### Decision apply

`applyResolvedDecisionInTransaction(db, input)` is internal and requires
the caller to have already configured the connection with
`foreign_keys=ON`, `busy_timeout=0`, `recursive_triggers=ON`, and
`ignore_check_constraints=OFF`, then opened `BEGIN IMMEDIATE` on that exact
native-branded DatabaseSync connection. Apply rejects a non-branded value as
`bundle_invalid_argument`, a branded closed value as
`bundle_connection_invalid`, and a live value whose captured native
`isTransaction` getter is false as `bundle_not_in_transaction`. Node's
pinned DatabaseSync surface exposes transaction presence but not the mode
that opened it, so `BEGIN IMMEDIATE` mode is a trusted outer-coordinator
precondition proven by composition tests, not introspected by apply. Apply
also verifies the four PRAGMA values and rejects the connection-local
TEMP-trigger contamination defined in §9 as `bundle_connection_invalid`
before complete bundle verification.

After initialization, `applyResolvedDecisionInTransaction` is the sole
permitted DML authority for all `main.memory_bundle_*` objects. The outer
coordinator performs no direct bundle DML, commits only after apply returns
`undefined`, and rolls back on every apply or commit error before exposing
any checkpoint. Correctly configured raw SQL can still commit a partial
sequence because SQLite has no general commit trigger; such direct DML is
outside the supported mutation boundary and must be rejected by verify on
reopen, not treated as a conforming write path.

Apply proceeds in this deterministic order:

1. validate the native database brand and open state;
2. require an active transaction;
3. validate the four PRAGMAs and connection-local TEMP-trigger precondition;
4. verify the complete main bundle inside the transaction;
5. capture the exact top-level input;
6. capture `expectedHead`, validate `streamId` and `sequence` scalars in
   that order, then compare the scalar-valid pair with the exact current
   `{streamId, sequence}`;
7. capture `decision`;
8. capture `scope` from the decision snapshot;
9. capture `authority` from the decision snapshot;
10. validate the atom union's container shape: NULL is shape-valid;
    otherwise capture the exact atom record without inspecting `keywords`;
11. validate non-authority decision identifiers, vocabulary, times,
    nullness, operation/outcome/reason matrix, proposal-kind/type partition,
    evidence, memory id/type, and atom presence;
12. check `decisionId` uniqueness, then `proposalId` uniqueness;
13. validate and authorize the captured authority tuple;
14. only for create-applied, validate captured atom scalar values, then
    capture and validate `keywords` and build its canonical snapshot;
15. validate prospective observed-time monotonicity and the retained-state
    transition in the exact §8 order;
16. insert one event, apply its atom effect, and advance metadata in the
    exact order in §8.

Each child reference comes only from its parent's captured descriptor value.
Validation stops at the first failing stage and never reflects on a later
child.

It returns exactly `undefined`. It never begins, commits, rolls back,
retries, closes the connection, or returns a public success receipt. The
outer coordinator may return the post-commit checkpoint only after
`COMMIT` succeeds. Any error requires outer rollback and exposes no
receipt. Lock failure at the outer coordinator's `BEGIN IMMEDIATE` occurs
before apply; M1's `bundle_busy` acceptance test is owned by first
initialization, while transaction-composition tests separately prove that
the caller uses `BEGIN IMMEDIATE` without retry.

## 4. Public surface

`openMemoryBundle(options)` accepts one non-Proxy plain exact-shape object
under the §8 object rule with the sole key `dbPath`. `dbPath` must be a
non-empty primitive string, contain no NUL code point, and be an absolute
filesystem path under `node:path.isAbsolute`. Relative paths, empty strings,
`:memory:`, caller-supplied SQLite URI names, `URL` objects, Buffers, and all
other values are rejected as `bundle_invalid_argument` before SQLite is
called.

The function performs no separate filesystem preflight, avoiding a
status/open race. Absolute symlink paths are allowed and follow ordinary OS
and SQLite resolution. Public open uses an unconditional two-connection
sequence so a hot rollback journal can be recovered before the owned
read-only handle is created:

1. Construct an internal URL with `pathToFileURL(dbPath)`, set its `mode`
   query parameter to `rw` with `searchParams.set`, and pass its `href` as a
   string to the captured DatabaseSync constructor with
   `{ readOnly: false, timeout: 0 }`. The `mode=rw` URI opens an existing
   database read-write but cannot create an absent file.
2. On this ephemeral recovery connection, set and verify the four §9
   PRAGMAs, begin one deferred read transaction, prepare
   `SELECT 1 FROM main.sqlite_schema LIMIT 1`, normalize its row modes, read
   it, commit, and close the connection. The connection executes no
   application DDL or DML and performs no application-level repair; its only
   permitted write effect is SQLite's automatic recovery of a hot rollback
   journal.
3. Only after recovery commit and native close both succeed, construct the
   owned connection from the original absolute path with
   `{ readOnly: true, timeout: 0 }`. Set and verify the four PRAGMAs, begin
   one explicit read transaction, perform complete §10 verification,
   commit, and only then return the handle.

There is no retry. Recovery failure prevents final read-only construction;
final-open or verification failure never reopens writable. Missing targets,
permission failures, non-database files, dangling symlinks, path races, and
other native recovery/final-open failures map to `bundle_storage_error`
unless the native condition is the narrower `bundle_busy`. If recovery and
final construction succeed but `main` has no valid bundle, verification
provides the narrower bundle code. Opening requires the database file to be
openable read-write. Writable journal-directory access is additionally
required when SQLite must modify or remove a hot journal; a clean database
does not otherwise require a writable directory.

The returned object is frozen and has exactly these own properties, in no
contractually significant enumeration order:

- `verify()`
- `replay()`
- `capabilities`
- `close()`

Opening never creates or initializes a database and performs no
application-level repair. Public operations are read-only after the
recovery connection closes. The API exposes no append function, resolver,
raw database handle, borrowed connection, or repair command. Module-owned
connections create no TEMP triggers. `verify()` and `replay()` each begin
one explicit SQLite read transaction, perform all reads inside it, commit
before returning a complete result, and never skip, truncate, normalize, or
repair stored state.

`verify`, `replay`, and `close` are receiver-independent lexical closures
bound permanently to their originating handle's private connection and
state. They never read or validate dynamic `this`. Bare calls and calls made
with another handle, arbitrary object, or Proxy receiver have exactly the
same effect on the originating handle; the receiver is not inspected and a
receiver Proxy's traps are not invoked. In particular,
`handleA.close.call(handleB)` closes only handle A.

The owned handle has internal states `open`, `poisoned`, and `closed`.
After any open-time/read/verification/commit primary error, rollback is
attempted whenever the captured native transaction getter remains true. If
rollback succeeds, the original mapped error wins. If rollback fails, the
rollback failure becomes `bundle_storage_error`, replacing the original;
for an existing handle the state becomes `poisoned` and native close is
attempted once. `verify()` and `replay()` on a poisoned or closed handle
throw `bundle_closed` before SQLite. If either open-time connection fails
after construction, its native close is attempted. Cleanup precedence is
rollback failure first, then close failure, then the original primary
error; a winning cleanup failure maps to `bundle_storage_error`. No handle
is returned after any open-time failure.

`close()` returns exactly `undefined` and is idempotent after a successful
close. On an open handle, it marks `closed` only after captured native close
succeeds; a native close failure throws `bundle_storage_error` and leaves it
open for retry. On a poisoned handle, `close()` retries native close if the
poison-path close failed, otherwise it changes the state to `closed` and
returns `undefined`. `capabilities` remains readable in every state. No
native closed-database error crosses the module boundary.

## 5. Closed vocabulary

### Identifiers and trusted generation

Every retained identifier is bounded and opaque. Values are ASCII and
must match exactly:

- `palariId`, `userId`: `^[a-z][a-z0-9_-]{0,63}$`; supplied by the
  trusted workspace identity boundary, never derived from conversation
  or memory payload text;
- `streamId`: `str_` plus a lowercase RFC 4122 UUIDv4;
- `decisionId`: `dec_` plus a lowercase RFC 4122 UUIDv4;
- `proposalId`: `prp_` plus a lowercase RFC 4122 UUIDv4;
- `memoryId`: `mem_` plus a lowercase RFC 4122 UUIDv4;
- `sourceMessageId`: `msg_` plus a lowercase RFC 4122 UUIDv4, or NULL.

Production UUID identifiers are generated with `crypto.randomUUID()` or
an equivalent CSPRNG independently of payload, source text, model output,
timestamps, and checksums. The initializer generates `streamId`. The
trusted resolution boundary supplies decision, proposal, memory, and
source-message ids; deterministic UUIDs are permitted only through test
fixtures and the initializer's explicit `idFactory` seam. Apply validates
these ids but does not generate or parse them from content. `decisionId`
and `proposalId` are globally unique within the bundle and each proposal
has exactly one decision event.

"Content-free event" means free of memory/source payload fields; it does
not mean metadata-free. Events intentionally retain bounded identity,
authority, scope, operation, outcome, type, and time metadata.

For user authority, `authorityId` is exactly `userId`. For policy
authority, `authorityId` is exactly the closed token
`palari-kernel-admission@1`. No other authority id is representable.

### Scope

M1 supports personal scope only:

```js
{ palariId: string, userId: string }
```

Both ids are required non-empty identifiers. General, shared,
cross-user, and cross-Palari semantics are unsupported.

### Operations and outcomes

Operations:

- `create`
- `delete`

Outcomes:

- `applied`
- `refused`

Proposal kinds:

- `promote`
- `permanent`
- `demote`

Authority:

- `user`
- `policy`

Evidence:

- `direct_user_message`

Closed refusal reasons:

- `below_threshold`
- `duplicate_current`
- `missing_target`
- `unauthorized`
- `unsupported`

Malformed type, scope, provenance, identifier, authority, or evidence
input throws before insertion and is not journaled as a policy refusal.

Memory types remain the current nine kernel types:

- permanent: `relationship`, `preference`, `opinion`, `entity`,
  `life_event`
- transient: `working`, `project`, `recent_life`, `session_summary`

## 6. Relational event schema

`memory_bundle_events` is the canonical decision record. It contains
only typed relational columns:

- `sequence`
- `stream_id`
- `decision_id`
- `proposal_id`
- `proposal_kind`
- `operation`
- `outcome`
- `reason_code`
- `palari_id`
- `user_id`
- `authority_kind`
- `authority_id`
- `evidence_kind`
- `memory_id`
- `memory_type`
- `effective_at`
- `observed_at`

Events must not contain:

- memory content;
- keywords;
- source message ids;
- topic queries;
- free-text reasons;
- raw source text;
- content or atom checksums;
- arbitrary model, producer, policy, or extractor strings.

Rows reject ordinary `UPDATE` and `DELETE` through triggers. Sequence is
a positive contiguous integer beginning at 1. `stream_id` is constant for
the bundle. `observed_at` is nondecreasing. A timestamp is valid only when
it is a primitive string matching
`^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$` and an exact intrinsic Date
round trip returns the same string. The round trip constructs the Date with
captured `Reflect.construct(capturedDate, [value])` and applies the captured
original `Date.prototype.toISOString` with
`Reflect.apply(capturedToISOString, date, [])`. No mutable global Date
binding, instance method, coercion, `valueOf`, or `getTime` participates.
This rejects calendar normalization, offsets, omitted milliseconds, and leap
seconds.

Canonical timestamps compare by ordinary string order. `effective_at` may
precede but never exceed `observed_at` for every applied or refused event.
Invalid individual timestamps or any input decision with
`effectiveAt > observedAt` are `bundle_invalid_decision`; a prospective or
persisted event whose `observed_at` decreases relative to the prior sequence
is `bundle_invalid_transition`. Atom/event time mismatch is
`bundle_invalid_atom`; invalid meta `created_at` is `bundle_meta_mismatch`,
unless an earlier §10 integrity check wins.

## 7. Canonical atom schema

`memory_bundle_atoms` contains one current canonical payload per active
memory:

- `memory_id`
- `stream_id`
- `created_sequence`
- `palari_id`
- `user_id`
- `type`
- `content`
- `keywords_json`
- `initial_importance`
- `confidence`
- `provenance_kind`
- `source_message_id`
- `valid_from`
- `created_at`
- `fictional`
- `content_checksum`

Atoms reject ordinary `UPDATE`. Applied owner deletion may `DELETE` the
row. The retained applied-create event prevents reuse of its memory id.

Apply captures a complete descriptor snapshot of the validated keyword
array and builds a fresh ordinary array from the captured index values in
ascending numeric order. All keyword validation, persisted JSON, and
checksum construction use only that snapshot; the caller's array object is
never stringified or read again. `keywords_json` is exactly
`JSON.stringify(keywordSnapshot)`: no added whitespace and no alternate
JSON encoding.

Every captured keyword is a non-empty string without an unpaired Unicode
surrogate. The snapshot must already be strictly increasing under
lexicographic Unicode scalar-value order: compare code points from left to
right by numeric value; if one string is an exact prefix, the shorter sorts
first. Duplicate equality is exact code-point-sequence equality with no
Unicode normalization. Apply rejects unsorted or duplicate input; it never
sorts or deduplicates it. Verification parses stored JSON into a fresh
ordinary array, reapplies these rules, and requires byte-for-byte equality
with `JSON.stringify(parsedKeywords)`.

`initial_importance` and `confidence` are finite numbers in `[0,1]`.
`provenance_kind` is exactly `direct_user_message` in M1. `valid_from`
equals the create event's `effective_at`; `created_at` equals its
`observed_at`.

`content_checksum` is exactly the 64-character lowercase hexadecimal
encoding of the 32-byte SHA-256 digest (equivalent to
`createHash('sha256').update(bytes).digest('hex')`) over the UTF-8 bytes of
the domain separator `palari-memory-bundle-atom-v1\0` followed by one JSON
array in this fixed field order. The stored and replayed text must match
`^[0-9a-f]{64}$`:

```js
[
  "palari.memory-bundle-atom@1",
  memoryId,
  streamId,
  createdSequence,
  palariId,
  userId,
  type,
  content,
  keywords,
  initialImportance,
  confidence,
  provenanceKind,
  sourceMessageId,
  validFrom,
  createdAt,
  fictional,
]
```

Serialization is byte-defined: arrays preserve the order above;
`keywords` is already canonical under the scalar-value comparator;
strings reject unpaired Unicode surrogates and are encoded with JavaScript
`JSON.stringify` escaping; there is no Unicode normalization;
`createdSequence` is a positive JavaScript safe integer; importance and
confidence are finite JSON numbers in `[0,1]`, with negative zero rejected;
NULL source message is JSON `null`; booleans are JSON `true`/`false`; the
resulting string is encoded as UTF-8 with no BOM, added whitespace, or
trailing newline.

The checksum is erasable with the atom and never copied into an event.
It detects structural or accidental modification of every canonical atom
field while the payload is present. It is not an event-history
commitment, signature, or defense against a privileged writer that can
replace payload and checksum together.

## 8. Resolved input and exact decision matrix

The internal apply input is exactly:

```js
{
  expectedHead: {
    streamId: string,
    sequence: number,
  },
  decision: {
    decisionId: string,
    proposalId: string,
    proposalKind: 'promote' | 'permanent' | 'demote',
    operation: 'create' | 'delete',
    outcome: 'applied' | 'refused',
    reasonCode: null | 'below_threshold' | 'duplicate_current' |
      'missing_target' | 'unauthorized' | 'unsupported',
    scope: { palariId: string, userId: string },
    authority: {
      kind: 'user' | 'policy',
      authorityId: string,
    },
    evidenceKind: 'direct_user_message',
    memoryId: string | null,
    memoryType: string | null,
    effectiveAt: string,
    observedAt: string,
  },
  atom: null | {
    content: string,
    keywords: string[],
    initialImportance: number,
    confidence: number,
    provenanceKind: 'direct_user_message',
    sourceMessageId: string | null,
    fictional: boolean,
  },
}
```

Every exact-shape record position first calls the captured
`node:util.types.isProxy` before any prototype, key, descriptor, property,
iterator, `instanceof`, JSON, or caller-method operation. A live or revoked
Proxy is rejected immediately with that position's §12 shape code, and no
Proxy trap is invoked.

After Proxy rejection, each record must be a non-null, non-array object
whose prototype is exactly the captured module-realm `Object.prototype`.
Validation captures its complete `Reflect.ownKeys` result and an own-property
descriptor snapshot for every returned key. It must have exactly the shown
own enumerable string keys, each as a data property; no missing,
inherited-only, symbol, accessor, non-enumerable, or extra key is accepted.
All later validation and persistence use only captured descriptor values,
never another property read from the caller's object. Key insertion order
has no semantic effect.

`keywords` first rejects a Proxy without invoking a trap, then must satisfy
the captured `Array.isArray` and have exactly the captured module-realm
`Array.prototype`. Validation snapshots all own keys and descriptors. The
only permitted non-enumerable property is own data property `length`, whose
descriptor must be writable, non-enumerable, and non-configurable and whose
value must be a non-negative safe integer. For every integer
`i` from `0` through `length - 1`, canonical key `String(i)` must be an own
enumerable data property; holes and indexed accessors are rejected. No other
own string key or symbol is permitted, including noncanonical array-index
strings. The fresh snapshot array defined in §7, not the caller-controlled
array, is the canonical `keywords` value. Any intrinsic reflection failure
is caught and mapped to that position's §12 shape code; no native exception
crosses a module boundary.

After the top-level input and `expectedHead` records are captured, apply
validates `expectedHead.streamId` first as a primitive string satisfying the
§5 `streamId` predicate, then validates `expectedHead.sequence` as a
non-negative JavaScript safe integer. Either scalar failure is
`bundle_invalid_argument`. Head comparison occurs only after both values are
valid; only a scalar-valid mismatch is `bundle_head_conflict`.

Malformed identifiers, scope, type, provenance, times, authority, evidence,
or shape throw without inserting an event. Only a well-formed proposal that
policy deliberately refuses uses an `outcome: refused` row.

For create-applied only, apply derives the persisted atom fields as follows:

| replay/persisted property | source |
|---|---|
| `memoryId` | `decision.memoryId` |
| `streamId` | verified current `meta.stream_id` |
| `createdSequence` | verified head sequence + 1 |
| `palariId`, `userId` | `decision.scope` |
| `type` | `decision.memoryType` |
| `content`, `initialImportance`, `confidence`, `provenanceKind`, `sourceMessageId`, `fictional` | captured `input.atom` descriptor values |
| `keywords` | fresh canonical keyword snapshot from captured index descriptor values |
| `validFrom` | `decision.effectiveAt` |
| `createdAt` | `decision.observedAt` |
| `contentChecksum` | computed by apply from the complete derived atom; never caller supplied |

The SQL mapping is the mechanical camelCase-to-snake_case mapping printed
in §7. `keywords` is stored as canonical `keywords_json`; `fictional` is
stored as integer `0` or `1`; nullable `sourceMessageId` is stored as SQL
NULL. All other values retain their exact text or numeric value. Refused
creates and both delete cases require `atom: null`.

The complete matrix is:

| case | proposal kind | operation | outcome | reason | authority | evidence | memory id | memory type | atom |
|---|---|---|---|---|---|---|---|---|---|
| create applied | `promote` or `permanent`, matching partition | `create` | `applied` | NULL | `user`, id = owner user id | `direct_user_message` | required | required | required |
| create refused | `promote` or `permanent`, matching partition | `create` | `refused` | `below_threshold`, `duplicate_current`, `unauthorized`, or `unsupported` | `policy`, id = `palari-kernel-admission@1` | `direct_user_message` | NULL | required | NULL |
| delete applied | `demote` | `delete` | `applied` | NULL | `user`, id = owner user id | `direct_user_message` | required | NULL | NULL input; target must exist |
| delete refused | `demote` | `delete` | `refused` | `missing_target`, `unauthorized`, or `unsupported` | `policy`, id = `palari-kernel-admission@1` | `direct_user_message` | required | NULL | NULL |

For apply validation and error precedence, the table is evaluated in this
exact staged order after scalar-valid head comparison:

1. capture `decision` from the top-level snapshot;
2. capture `scope` from the decision snapshot;
3. capture `authority` from the decision snapshot;
4. validate the atom union's container shape: NULL is shape-valid; any
   non-NULL value must be a non-Proxy plain exact-shape atom object under the
   snapshot rule. This stage captures the complete atom record shape but
   does not inspect or capture nested `keywords`. A wrong atom container,
   key set, descriptor, or prototype is `bundle_invalid_atom` even for a
   matrix row that ultimately requires NULL;
5. validate decision identifiers, vocabulary, individual/pairwise times,
   nullness, operation, outcome, reason, proposal-kind/type partition,
   evidence, memory id/type, and atom presence while excluding authority. A
   shape-valid atom object supplied to a NULL-only row is therefore
   `bundle_invalid_decision` without traversing `keywords`; NULL supplied to
   create-applied is also `bundle_invalid_decision`. A shape-valid atom whose
   scalar values are malformed is not inspected until step 8;
6. check `decisionId` uniqueness, then `proposalId` uniqueness. A retained
   well-formed decision id is `bundle_duplicate_decision_id`; only when it
   is unique can a retained well-formed proposal id produce
   `bundle_duplicate_proposal_id`;
7. validate authority: `authority.kind` must be the row's required valid
   kind and `authorityId` must equal the owner user id or exact policy token;
8. only for a create-applied row with a shape-valid atom object, validate
   captured atom scalar values, then capture and validate `keywords` and
   build the canonical atom snapshot;
9. validate the prospective transition. First require the new
   `observedAt` not to precede the retained last event's `observed_at`;
   failure is `bundle_invalid_transition`. Refused rows then have no reducer
   effect. For create-applied, any retained prior applied create for the
   memory id, active or deleted, is `bundle_id_reuse`. For delete-applied,
   require a retained prior applied create or throw
   `bundle_invalid_transition`; next compare both decision scope ids with
   the original create scope and throw `bundle_unauthorized` on mismatch;
   only after a scope match, an already-deleted state is
   `bundle_invalid_transition`; otherwise deletion is valid.

The transition reducer retains each applied create's original
`{palariId, userId}` after deletion. Row-authority authorization in step 7
and target-scope authorization in step 9 are distinct: a user can authorize
the claimed delete row yet still be unauthorized for a target created in
another scope. A malformed/unknown authority shape or token type is
`bundle_invalid_decision`; a well-shaped valid authority tuple that does not
authorize the selected row is `bundle_unauthorized`. Persisted-event
semantic validation uses the same non-authority-then-authority staging after
§10 integrity checks; atom correspondence is handled later by the
verification reducer.

For create events, the retained closed `memory_type` proves after later
payload deletion that proposal kind matched the permanent/transient
partition. A create-applied atom must match event stream, sequence,
scope, memory id, type, and times exactly.

Mutation order inside the caller's transaction is normative:

1. insert the next event at `meta.head_sequence + 1`;
2. for create-applied, insert the matching atom; for delete-applied,
   delete the matching existing atom; refusals have no atom effect;
3. advance meta to that event sequence.

Triggers enforce that an atom insert is permitted only while the matching
next-sequence create-applied event exists and meta still points to the
prior sequence. Atom deletion is permitted only under the analogous
next-sequence delete-applied event. All atom updates fail. After meta
advances, a historical create event cannot authorize reinsertion. A
partial unique index over applied-create `memory_id` permanently prevents
a second create event for a deleted id.

The create and delete events remain after governed deletion. Everything
outside this matrix fails as unsupported.

## 9. Exact CDX-B1 SQLite manifest

The schema version literal is `CDX-B1`. The canonical bundle always lives
in SQLite schema `main`. Every persistent read and DML statement uses
`main.memory_bundle_meta`, `main.memory_bundle_events`, or
`main.memory_bundle_atoms`; inventory reads `main.sqlite_schema`.
Structural PRAGMAs use `PRAGMA main.table_xinfo(...)`,
`main.index_list(...)`, `main.index_xinfo(...)`,
`main.foreign_key_list(...)`, `main.foreign_key_check`, and
`main.quick_check` where SQLite supports schema qualification.

TEMP tables, views, and indexes with matching names, plus all persistent
objects in attached databases, are inert shadows: they are ignored, never
mutated, and never satisfy or invalidate the main bundle. TEMP triggers are
different because SQLite permits a connection-local TEMP trigger to target
a main table and fire on main-qualified DML. Before initialization or apply
uses a borrowed connection, the implementation reads every `type='trigger'`
row in `temp.sqlite_schema`, ASCII-case-folds only `tbl_name` for target
matching, and requires zero rows whose target spelling is
`memory_bundle_meta`, `memory_bundle_events`, or `memory_bundle_atoms`.
Because SQLite does not expose the bound target schema in that inventory,
this is intentionally conservative and also rejects a TEMP trigger attached
to a same-named TEMP or attached table. Such contamination is
`bundle_connection_invalid` before main-bundle verification. Unrelated TEMP
triggers remain permitted. Module-owned recovery/read-only connections
create no TEMP triggers.

Conforming implementations use the following exact main-schema object names
and SQL semantics. Complete verification compares the exact main
`memory_bundle_*` object inventory and also enumerates every main trigger by
canonical target table, regardless of trigger-name prefix; it never checks
merely for table existence.

Each of the 13 application-defined objects has one exact
`{ executionSql, persistedSql }` manifest entry. The SQL fence below is the
exact `persistedSql` form. Initialization executes only `executionSql`:

- for each table, qualify the created object as
  `CREATE TABLE main.<name>`;
- for each index, qualify only the created index name as
  `CREATE UNIQUE INDEX main.<name>` and retain the unqualified same-schema
  target `ON memory_bundle_events(...)`;
- for each trigger, qualify only the created trigger name as
  `CREATE TRIGGER main.<name>` and retain its unqualified same-schema target.

SQLite 3.51.2 rejects a schema-qualified table name after
`CREATE INDEX ... ON`; qualifying the created index or trigger name binds
its unqualified target to the same `main` schema even when a TEMP table
shadows that name. SQLite stores the created-object name without the `main.`
qualifier in `main.sqlite_schema.sql`, so verification compares stored SQL
with `persistedSql`, not `executionSql`. The verifier does not strip schema
qualifiers or add any normalization beyond the three operations specified
below.

```sql
CREATE TABLE memory_bundle_meta (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  schema_version TEXT NOT NULL CHECK (schema_version = 'CDX-B1'),
  stream_id TEXT NOT NULL UNIQUE,
  head_sequence INTEGER NOT NULL
    CHECK (head_sequence >= 0 AND head_sequence <= 9007199254740991),
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE memory_bundle_events (
  sequence INTEGER PRIMARY KEY
    CHECK (sequence > 0 AND sequence <= 9007199254740991),
  stream_id TEXT NOT NULL,
  decision_id TEXT NOT NULL UNIQUE,
  proposal_id TEXT NOT NULL UNIQUE,
  proposal_kind TEXT NOT NULL
    CHECK (proposal_kind IN ('promote','permanent','demote')),
  operation TEXT NOT NULL CHECK (operation IN ('create','delete')),
  outcome TEXT NOT NULL CHECK (outcome IN ('applied','refused')),
  reason_code TEXT
    CHECK (reason_code IS NULL OR reason_code IN (
      'below_threshold','duplicate_current','missing_target',
      'unauthorized','unsupported'
    )),
  palari_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  authority_kind TEXT NOT NULL CHECK (authority_kind IN ('user','policy')),
  authority_id TEXT NOT NULL,
  evidence_kind TEXT NOT NULL CHECK (evidence_kind = 'direct_user_message'),
  memory_id TEXT,
  memory_type TEXT CHECK (memory_type IS NULL OR memory_type IN (
    'relationship','preference','opinion','entity','life_event',
    'working','project','recent_life','session_summary'
  )),
  effective_at TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  FOREIGN KEY (stream_id) REFERENCES memory_bundle_meta(stream_id),
  CHECK (
    (operation = 'create' AND outcome = 'applied'
      AND reason_code IS NULL AND authority_kind = 'user'
      AND authority_id = user_id
      AND memory_id IS NOT NULL AND memory_type IS NOT NULL
      AND (
        (proposal_kind = 'permanent' AND memory_type IN (
          'relationship','preference','opinion','entity','life_event'
        ))
        OR
        (proposal_kind = 'promote' AND memory_type IN (
          'working','project','recent_life','session_summary'
        ))
      ))
    OR
    (operation = 'create' AND outcome = 'refused'
      AND reason_code IS NOT NULL
      AND reason_code IN (
        'below_threshold','duplicate_current','unauthorized','unsupported'
      )
      AND authority_kind = 'policy'
      AND authority_id = 'palari-kernel-admission@1'
      AND memory_id IS NULL AND memory_type IS NOT NULL
      AND (
        (proposal_kind = 'permanent' AND memory_type IN (
          'relationship','preference','opinion','entity','life_event'
        ))
        OR
        (proposal_kind = 'promote' AND memory_type IN (
          'working','project','recent_life','session_summary'
        ))
      ))
    OR
    (operation = 'delete' AND outcome = 'applied'
      AND proposal_kind = 'demote'
      AND reason_code IS NULL AND authority_kind = 'user'
      AND authority_id = user_id
      AND memory_id IS NOT NULL AND memory_type IS NULL)
    OR
    (operation = 'delete' AND outcome = 'refused'
      AND proposal_kind = 'demote'
      AND reason_code IS NOT NULL
      AND reason_code IN ('missing_target','unauthorized','unsupported')
      AND authority_kind = 'policy'
      AND authority_id = 'palari-kernel-admission@1'
      AND memory_id IS NOT NULL AND memory_type IS NULL)
  )
) STRICT;

CREATE TABLE memory_bundle_atoms (
  memory_id TEXT PRIMARY KEY,
  stream_id TEXT NOT NULL,
  created_sequence INTEGER NOT NULL UNIQUE
    CHECK (created_sequence > 0 AND created_sequence <= 9007199254740991),
  palari_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'relationship','preference','opinion','entity','life_event',
    'working','project','recent_life','session_summary'
  )),
  content TEXT NOT NULL,
  keywords_json TEXT NOT NULL,
  initial_importance REAL NOT NULL
    CHECK (initial_importance >= 0 AND initial_importance <= 1),
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  provenance_kind TEXT NOT NULL CHECK (provenance_kind = 'direct_user_message'),
  source_message_id TEXT,
  valid_from TEXT NOT NULL,
  created_at TEXT NOT NULL,
  fictional INTEGER NOT NULL CHECK (fictional IN (0,1)),
  content_checksum TEXT NOT NULL,
  FOREIGN KEY (stream_id) REFERENCES memory_bundle_meta(stream_id),
  FOREIGN KEY (created_sequence) REFERENCES memory_bundle_events(sequence)
) STRICT;

CREATE UNIQUE INDEX memory_bundle_applied_create_memory_unique
  ON memory_bundle_events(memory_id)
  WHERE operation = 'create' AND outcome = 'applied';

CREATE UNIQUE INDEX memory_bundle_applied_delete_memory_unique
  ON memory_bundle_events(memory_id)
  WHERE operation = 'delete' AND outcome = 'applied';

CREATE TRIGGER memory_bundle_events_no_update
BEFORE UPDATE ON memory_bundle_events
BEGIN SELECT RAISE(ABORT, 'memory_bundle_events_append_only'); END;

CREATE TRIGGER memory_bundle_events_no_delete
BEFORE DELETE ON memory_bundle_events
BEGIN SELECT RAISE(ABORT, 'memory_bundle_events_append_only'); END;

CREATE TRIGGER memory_bundle_event_next_sequence
BEFORE INSERT ON memory_bundle_events
WHEN NOT EXISTS (
  SELECT 1 FROM memory_bundle_meta m
  WHERE m.singleton = 1
    AND NEW.stream_id = m.stream_id
    AND NEW.sequence = m.head_sequence + 1
)
BEGIN SELECT RAISE(ABORT, 'memory_bundle_event_sequence'); END;

CREATE TRIGGER memory_bundle_atoms_no_update
BEFORE UPDATE ON memory_bundle_atoms
BEGIN SELECT RAISE(ABORT, 'memory_bundle_atoms_immutable'); END;

CREATE TRIGGER memory_bundle_atom_insert_guard
BEFORE INSERT ON memory_bundle_atoms
WHEN NOT EXISTS (
  SELECT 1
  FROM memory_bundle_meta m
  JOIN memory_bundle_events e
    ON e.sequence = m.head_sequence + 1
  WHERE m.singleton = 1
    AND e.stream_id = m.stream_id
    AND e.operation = 'create'
    AND e.outcome = 'applied'
    AND e.memory_id = NEW.memory_id
    AND e.memory_type = NEW.type
    AND e.sequence = NEW.created_sequence
    AND e.palari_id = NEW.palari_id
    AND e.user_id = NEW.user_id
    AND e.effective_at = NEW.valid_from
    AND e.observed_at = NEW.created_at
)
BEGIN SELECT RAISE(ABORT, 'memory_bundle_atom_insert_unauthorized'); END;

CREATE TRIGGER memory_bundle_atom_delete_guard
BEFORE DELETE ON memory_bundle_atoms
WHEN NOT EXISTS (
  SELECT 1
  FROM memory_bundle_meta m
  JOIN memory_bundle_events e
    ON e.sequence = m.head_sequence + 1
  WHERE m.singleton = 1
    AND e.stream_id = m.stream_id
    AND e.operation = 'delete'
    AND e.outcome = 'applied'
    AND e.memory_id = OLD.memory_id
    AND e.palari_id = OLD.palari_id
    AND e.user_id = OLD.user_id
)
BEGIN SELECT RAISE(ABORT, 'memory_bundle_atom_delete_unauthorized'); END;

CREATE TRIGGER memory_bundle_meta_no_delete
BEFORE DELETE ON memory_bundle_meta
BEGIN SELECT RAISE(ABORT, 'memory_bundle_meta_required'); END;

CREATE TRIGGER memory_bundle_meta_advance_guard
BEFORE UPDATE ON memory_bundle_meta
WHEN NEW.singleton != OLD.singleton
  OR NEW.schema_version != OLD.schema_version
  OR NEW.stream_id != OLD.stream_id
  OR NEW.created_at != OLD.created_at
  OR NEW.head_sequence != OLD.head_sequence + 1
  OR NOT EXISTS (
    SELECT 1 FROM memory_bundle_events e
    WHERE e.stream_id = OLD.stream_id
      AND e.sequence = NEW.head_sequence
      AND (
        (e.outcome = 'refused')
        OR
        (e.operation = 'create' AND e.outcome = 'applied' AND EXISTS (
          SELECT 1 FROM memory_bundle_atoms a
          WHERE a.memory_id = e.memory_id
            AND a.created_sequence = e.sequence
        ))
        OR
        (e.operation = 'delete' AND e.outcome = 'applied'
          AND EXISTS (
            SELECT 1 FROM memory_bundle_events c
            WHERE c.memory_id = e.memory_id
              AND c.operation = 'create'
              AND c.outcome = 'applied'
              AND c.sequence < e.sequence
          )
          AND NOT EXISTS (
            SELECT 1 FROM memory_bundle_atoms a
            WHERE a.memory_id = e.memory_id
          ))
      )
  )
BEGIN SELECT RAISE(ABORT, 'memory_bundle_meta_advance_invalid'); END;
```

The singleton meta row is:

```js
{
  singleton: 1,
  schemaVersion: 'CDX-B1',
  streamId: generatedStreamId,
  headSequence: 0,
  createdAt: clockNow,
}
```

No column has an implicit application default. The initializer supplies
all values. The exact required object inventory is:

```text
table   memory_bundle_meta
table   memory_bundle_events
table   memory_bundle_atoms
index   memory_bundle_applied_create_memory_unique
index   memory_bundle_applied_delete_memory_unique
trigger memory_bundle_events_no_update
trigger memory_bundle_events_no_delete
trigger memory_bundle_event_next_sequence
trigger memory_bundle_atoms_no_update
trigger memory_bundle_atom_insert_guard
trigger memory_bundle_atom_delete_guard
trigger memory_bundle_meta_no_delete
trigger memory_bundle_meta_advance_guard
```

The exact SQLite-generated autoindexes implied by the manifest are:

```text
sqlite_autoindex_memory_bundle_meta_1    UNIQUE(stream_id)
sqlite_autoindex_memory_bundle_events_1  UNIQUE(decision_id)
sqlite_autoindex_memory_bundle_events_2  UNIQUE(proposal_id)
sqlite_autoindex_memory_bundle_atoms_1   PRIMARY KEY(memory_id)
sqlite_autoindex_memory_bundle_atoms_2   UNIQUE(created_sequence)
```

The integer primary keys on `memory_bundle_meta.singleton` and
`memory_bundle_events.sequence` alias the rowid and create no autoindex.
Any other autoindex or any additional application-defined
`memory_bundle_*` object makes the layout unsupported.

Complete verification also reads all `type='trigger'` rows from
`main.sqlite_schema`. After ASCII-case-folding only `tbl_name` for target
matching, the rows targeting a canonical table must equal exactly these
BINARY-trigger-name-sorted pairs:

```text
memory_bundle_atom_delete_guard  -> memory_bundle_atoms
memory_bundle_atom_insert_guard  -> memory_bundle_atoms
memory_bundle_atoms_no_update    -> memory_bundle_atoms
memory_bundle_event_next_sequence -> memory_bundle_events
memory_bundle_events_no_delete   -> memory_bundle_events
memory_bundle_events_no_update   -> memory_bundle_events
memory_bundle_meta_advance_guard -> memory_bundle_meta
memory_bundle_meta_no_delete     -> memory_bundle_meta
```

A persistent main trigger with any other name that targets a canonical
table is `bundle_layout_invalid`, even when its name does not begin with
`memory_bundle_`. This closes triggers that could abort canonical DML or
mutate coexisting CDX-M1 state. Main triggers on unrelated tables remain
permitted.

Initialization and writable apply connections require exactly these
connection preconditions:

```sql
PRAGMA foreign_keys=ON;
PRAGMA busy_timeout=0;
PRAGMA recursive_triggers=ON;
PRAGMA ignore_check_constraints=OFF;
```

`recursive_triggers=ON` is load-bearing: it makes the no-delete guards run
for the implicit delete performed by `INSERT OR REPLACE`, preventing
replacement from rewriting committed meta, events, or atoms.
`ignore_check_constraints=OFF` is equally load-bearing: without it a
connection can commit rows that bypass the exact decision and scalar CHECK
constraints. Apply checks all four values but does not set them inside the
caller's transaction. Initialization and both module-owned public-open
connections set and verify them before inventory or any transaction.
Borrowed initialization/apply connections also enforce the TEMP-trigger
precondition above. M1 never changes workspace `journal_mode` or any other
CDX-M1 pragma.

The implementation owns the exact `executionSql` and `persistedSql` pair
for every object above. It executes only the former and compares every
non-NULL `main.sqlite_schema.sql` value only with the latter after:

1. converting CRLF to LF;
2. trimming leading and trailing ASCII whitespace; and
3. removing one trailing semicolon and then trailing ASCII whitespace.

No qualifier stripping, internal whitespace, token, quoting, column order,
predicate, or trigger-body normalization occurs. PRAGMA comparison uses
these exact projections:

- `PRAGMA main.table_xinfo(table)`: rows ordered by numeric `cid`; compare
  `{cid,name,type,notnull,dflt_value,pk,hidden}` exactly. Every `hidden`
  value is `0`.
- `PRAGMA main.index_list(table)`: rows sorted by exact `name`; ignore only the
  bookkeeping `seq` field and compare `{name,unique,origin,partial}`.
  Named partial indexes and all five autoindexes above are included.
- `PRAGMA main.index_xinfo(index)`: rows ordered by numeric `seqno`; compare
  `{seqno,cid,name,desc,coll,key}` exactly, including auxiliary rows where
  `cid = -1` and `key = 0`.
- `PRAGMA main.foreign_key_list(table)`: ignore only bookkeeping `id` and `seq`; sort
  by the tuple `{table,from,to,on_update,on_delete,match}` and compare that
  tuple exactly for every row.

Verification also requires `PRAGMA main.foreign_key_check` to return zero
rows and `PRAGMA main.quick_check` to return exactly one row whose sole result is
`ok`. This deliberately rejects semantically similar but unrecognized
layouts rather than guessing compatibility.

## 10. Verification

Every internal and public verification uses one deterministic order. It
never selects a later error merely because SQLite happened to report rows
in a different order:

1. locate `main.memory_bundle_meta` as a table; if it is absent or another
   object type, throw `bundle_layout_invalid`;
2. perform a minimal meta preflight: the table must be readable with
   `singleton` and `schema_version` columns and exactly one
   `singleton = 1` row; an unreadable/malformed preflight is
   `bundle_layout_invalid`;
3. if that readable row's version is not `CDX-B1`, throw
   `bundle_schema_unsupported` before applying any CDX-B1 inventory or
   statement assumptions;
4. in this exact suborder: (a) require the exact main-schema
   application-object and five-autoindex inventories; (b) require the exact
   canonical main trigger-target pair inventory and reject every additional
   main trigger on a canonical table; (c) compare normalized stored SQL only
   with each object's `persistedSql`; (d) compare projected table/index/
   foreign-key PRAGMA manifests; and (e) require clean foreign-key and quick
   checks. Any failure in this step is `bundle_layout_invalid` and
   intentionally wins before narrower semantic classification;
5. validate every remaining schema-valid meta value, including bounded
   stream id and strict created time;
6. require every remaining schema-valid event to use sequences exactly
   `1..head_sequence` as safe integers;
7. validate exact event identifiers, vocabulary, non-authority matrix
   cells, and strict individual/pairwise times;
8. validate the authority tuple using the staged rule in §8;
9. require nondecreasing observed time;
10. reduce transitions in ascending sequence order with an initially empty
    map from `memoryId` to `{palariId, userId, status}`. Refused events have
    no reducer effect. Create-applied on an existing entry, active or
    deleted, is `bundle_id_reuse`; otherwise retain its original scope with
    `status: active`. Delete-applied on no entry is
    `bundle_invalid_transition`; for an existing entry, compare both scope
    ids with the retained create scope and throw `bundle_unauthorized` on
    either mismatch, including after prior deletion; only after scope
    equality, `status: deleted` is `bundle_invalid_transition`, otherwise
    change it to deleted;
11. validate remaining schema-valid atom shape, canonical keyword JSON,
    scalar fields, checksum, scope, type, and create sequence in ascending
    `memory_id` order;
12. require exact current-state correspondence: each active created memory
    has one atom, each deleted memory has none, and no orphan atom exists;
13. require meta head to equal the verified last sequence, where an empty
    event set has last sequence `0`.

Because step 9 precedes step 10, decreasing observed time wins before any
state/scope defect. Within one delete-applied event at step 10, the exact
order is missing prior create → retained-scope mismatch → already-deleted
state. Because step 10 precedes atom validation/correspondence, a
schema-valid cross-scope delete fails `bundle_unauthorized` before any
simultaneous missing-atom classification.

Within a step, tables are read with explicit locale-independent ordering:
events by numeric `sequence`, atoms by ASCII `memory_id`, and schema names
by SQLite `BINARY` order. Step 12 derives the sorted expected-active memory
ids from the event reducer and performs one merge against sorted actual
atom ids. At the first unequal id: expected < actual is
`bundle_missing_atom`; actual < expected is `bundle_orphan_atom`. If one
list ends first, a remaining expected id is missing and a remaining actual
id is orphan. Equal ids proceed to exact correspondence checks. This merge
orders simultaneous missing/orphan defects deterministically.

A created-but-not-deleted memory requires exactly one atom. A deleted
memory requires no atom. Any malformed row, unknown token, sequence gap,
invalid transition, missing/orphan atom, or head mismatch fails the complete
verification.

`verify()` returns exactly:

```js
{
  checkpoint: {
    streamId: string,
    sequence: number, // non-negative safe integer
  },
  capabilities,
}
```

No raw meta, event, atom, receipt, or additional property is returned.

## 11. Replay

`replay()` first performs the complete §10 verification in the same read
transaction, then returns exactly:

```js
{
  checkpoint: {
    streamId: string,
    sequence: number,
  },
  memories: [{
    memoryId: string,
    streamId: string,
    createdSequence: number,
    palariId: string,
    userId: string,
    type: string,
    content: string,
    keywords: string[],
    initialImportance: number,
    confidence: number,
    provenanceKind: 'direct_user_message',
    sourceMessageId: string | null,
    validFrom: string,
    createdAt: string,
    fictional: boolean,
    contentChecksum: string,
  }],
  capabilities,
}
```

Each memory object has exactly those 16 own enumerable string keys.
`keywords_json` is returned as the parsed canonical `keywords` array and
SQLite `fictional` 0/1 as a JavaScript boolean; no storage-form alias is
also returned. Memories are sorted by ascending ASCII `memoryId` using
code-unit comparison (`a < b`), never `localeCompare`; because memory ids
are bounded ASCII, this is identical to SQLite `BINARY` order.

Replay is current-state only. Refusals do not create atoms. Deleted
payloads and their checksums are unavailable and absent. Fresh opens of an
unchanged bundle must return deeply equal replay values.

## 12. Errors

All module-boundary failures throw the exported `MemoryBundleError`, which
extends `Error` and has these observable semantics:

- `name` is exactly `MemoryBundleError`;
- `code` is an own enumerable string from the closed list below;
- `message` is a non-empty diagnostic but its exact wording is not stable;
- `cause` may be present when a native or callback error was wrapped, but
  its presence, type, and text are not stable;
- stack shape and SQLite native error text are not contract surfaces.

Stable M1 codes are exactly:

- `bundle_invalid_argument`
- `bundle_busy`
- `bundle_layout_invalid`
- `bundle_schema_unsupported`
- `bundle_connection_invalid`
- `bundle_not_in_transaction`
- `bundle_invalid_decision`
- `bundle_duplicate_decision_id`
- `bundle_duplicate_proposal_id`
- `bundle_invalid_atom`
- `bundle_invalid_transition`
- `bundle_head_conflict`
- `bundle_meta_mismatch`
- `bundle_missing_atom`
- `bundle_orphan_atom`
- `bundle_id_reuse`
- `bundle_unauthorized`
- `bundle_storage_error`
- `bundle_closed`

Shape failures are assigned by the object whose contract is malformed:

| object | shape-error code |
|---|---|
| function argument itself, initializer options, public-open options, top-level apply input, or `expectedHead` | `bundle_invalid_argument` |
| `decision` or nested `scope` | `bundle_invalid_decision` |
| nested `authority` | `bundle_invalid_decision`; only a well-shaped but non-authorizing tuple becomes `bundle_unauthorized` |
| `atom` or nested `keywords` array | `bundle_invalid_atom` |

This table owns Proxy rejection, missing/extra keys, prototype,
descriptors, symbols, accessors, array holes, and wrong container types. A
Proxy is rejected before any trap can run. Later value validation never
reclassifies a shape failure.

The condition-to-code mapping is normative:

| condition | code |
|---|---|
| shape failure owned by the first row of the table above; non-branded database value; invalid clock/factory output; malformed `expectedHead` scalar; or invalid `dbPath` value | `bundle_invalid_argument` |
| native `SQLITE_BUSY` or `SQLITE_LOCKED` from a bundle-owned recovery/open/read/initialization/apply statement | `bundle_busy` |
| successfully opened main database has no bundle; partial or unknown bundle objects; unreadable meta preflight; application-object, autoindex, main-trigger-target, SQL, or projected-PRAGMA manifest mismatch; any foreign-key-check row; or any non-`ok` quick check, including CHECK/FK-backed row corruption that also has a semantic meaning | `bundle_layout_invalid` |
| readable singleton meta names a schema other than `CDX-B1` | `bundle_schema_unsupported` |
| native-branded DatabaseSync is closed/unopened; initializer entered during a transaction; borrowed initialization/apply connection has a TEMP trigger with canonical target spelling; any required apply PRAGMA differs; or a module-owned connection still reports a wrong required PRAGMA after configuration | `bundle_connection_invalid` |
| apply entered on an open native-branded database with captured native `isTransaction !== true` | `bundle_not_in_transaction` |
| malformed apply decision shape/value/token/time/type, invalid non-authority matrix, or schema-valid persisted event defect not already caught by §10 integrity checks | `bundle_invalid_decision` |
| well-formed apply `decisionId` is already retained in `memory_bundle_events` | `bundle_duplicate_decision_id` |
| well-formed apply `proposalId` is already retained after `decisionId` was found unique | `bundle_duplicate_proposal_id` |
| malformed atom input, or schema-valid persisted atom defect such as noncanonical keywords/Unicode, field mismatch, or checksum mismatch not already caught by §10 integrity checks | `bundle_invalid_atom` |
| prospective or persisted observed time decreases; delete-applied has no retained applied create; same-scope delete-applied targets an already-deleted state; or another unsupported current-state transition lacks a narrower code | `bundle_invalid_transition` |
| shape- and scalar-valid `expectedHead` differs in stream id or sequence | `bundle_head_conflict` |
| schema-valid invalid singleton meta identity/time, sequence gap, or final head mismatch not already caught by §10 integrity checks | `bundle_meta_mismatch` |
| active applied create lacks its required current atom | `bundle_missing_atom` |
| atom exists without one active applied create | `bundle_orphan_atom` |
| applied create attempts any memory id with a prior applied create, including after deletion | `bundle_id_reuse` |
| well-shaped authority tuple does not authorize its row, applied-delete scope differs from the retained applied-create scope including after deletion, or policy authority token is not exact | `bundle_unauthorized` |
| native filesystem/SQLite failure not assigned above, including recovery/final constructor or permission failure, unexpected constraint, cleanup failure, or I/O failure | `bundle_storage_error` |
| verify/replay called on a poisoned handle or after successful close | `bundle_closed` |

Deterministic precedence is:

- `initializeMemoryBundle`: database Proxy/native brand → options Proxy and
  exact shape → callback types → native open state → native transaction
  state → PRAGMA configuration/readback → connection-local TEMP-trigger
  precondition → read `BEGIN` → main inventory/meta preflight → schema
  version/full verification for an existing bundle → read `COMMIT`; if
  absent, write `BEGIN IMMEDIATE` → main re-inventory → raced
  valid/partial/absent branch → callback order and intrinsic validation only
  for still-absent → `executionSql` DDL/meta → complete verification → write
  `COMMIT`. Cleanup and rollback-failure precedence follow §3.
- `openMemoryBundle`: options Proxy/exact shape/value validation → internal
  `mode=rw` recovery constructor → recovery PRAGMA configuration/readback →
  recovery read `BEGIN` → normalized schema read and any SQLite hot-journal
  recovery → recovery read `COMMIT` → recovery native close → final
  read-only constructor → final PRAGMA configuration/readback → final read
  `BEGIN` → meta preflight → schema version → complete verification → final
  read `COMMIT`. Native busy/locked wins as `bundle_busy`; other native
  constructor/path/permission failures are `bundle_storage_error`. Cleanup
  follows §4.
- public `verify`/`replay`: poisoned/closed state → read-transaction
  acquisition → §10 order → read commit. On any failure, cleanup and the
  winning error follow §4. Replay performs no row mapping until verification
  succeeds. Dynamic method receivers are ignored.
- `applyResolvedDecisionInTransaction`: database Proxy/native brand → native
  open state → active transaction → PRAGMAs → connection-local TEMP-trigger
  precondition → complete §10 verification → top-level input capture →
  `expectedHead` capture → `streamId` scalar → `sequence` scalar → head
  comparison → `decision` capture → `scope` capture → `authority` capture →
  atom union/container exact shape → non-authority decision
  vocabulary/matrix/time → `decisionId` uniqueness → `proposalId`
  uniqueness → authority authorization → create-applied atom scalars and
  keyword snapshot → transition, whose first check is prospective observed
  time, then create id reuse or delete prior-create existence, retained
  scope, and prior-delete state → SQL mutation.

If both retained ids collide, `bundle_duplicate_decision_id` wins. Atom
container/key/descriptor shape is checked before decision value validation;
only a shape-valid atom's scalar or keyword defects are deferred until after
row selection and authority. For delete transition, missing prior create is
`bundle_invalid_transition`; with a prior create, scope mismatch is
`bundle_unauthorized` even if already deleted; only a same-scope prior delete
is `bundle_invalid_transition`.

Within verification, the first failing §10 step wins; within one step, the
explicit sort orders in §9-§10 choose the first row. Native constraint
errors from ordinary apply are translated only after deterministic input
and transition checks, so they cannot silently replace the narrower code.
No API mixes thrown errors with result objects.

## 13. M1 acceptance laws

M1 is complete only when tests prove:

1. exact named/default export sets for both modules; exact `undefined`
   returns for initialize/apply/close; exact verify/replay own-key shapes;
   receiver-independent public closures; and one shared frozen six-property,
   all-false capabilities object reused by identity by the handle and
   successful results;
2. atomic/idempotent initialization; trap-free rejection of live/revoked
   Proxy options; native DatabaseSync brand/open/transaction classification;
   exact option/default/callback counts and undefined-this/zero-argument
   invocation; intrinsic valid/cross-realm/subclass Date acceptance and fake,
   Proxy, invalid, or primitive Date rejection; read-snapshot cleanup;
   race-window re-inventory under `BEGIN IMMEDIATE`; and fail-closed partial
   layouts;
3. coexistence with a real unchanged CDX-M1 workspace;
4. exact absolute-path public-open domain; create-disabled internal
   `mode=rw` recovery connection; recovery commit/close before final
   read-only construction; no file creation; encoded-path safety; hot-journal
   recovery; frozen surface; receiver independence; reachable
   read-transaction cleanup/poison behavior; failed-open connection cleanup;
   and normal/idempotent close lifecycle;
5. exact create/refuse/delete authority matrix, including reversed-time
   applied/refused cases, retained-create target-scope authorization after
   payload deletion, and SQL rejection of NULL refusal reasons with
   `ignore_check_constraints=OFF`;
6. events contain no payload/source content;
7. `executionSql` creates all canonical objects in `main` despite same-named
   TEMP/attached tables; stored SQL equals `persistedSql` after only the
   listed normalization; all persistent reads/DML/PRAGMAs are pinned to
   `main`; borrowed initialize/apply connections reject canonical-target
   TEMP triggers before DML; arbitrary-name main triggers on canonical
   tables are rejected by every complete verification; and unrelated
   triggers/shadows remain accepted;
8. all four connection PRAGMAs are enforced, and ordinary plus `INSERT OR
   REPLACE` attempts cannot rewrite committed events, atoms, or meta;
9. captured native DatabaseSync/StatementSync dispatch ignores later
   prototype/instance shadowing, and normalized read statements behave
   identically for default, `readBigInts`, `returnArrays`, and combined row
   modes;
10. immutable atoms, governed deletion, and memory-id non-reuse;
11. one-connection commit/rollback composition and apply's no-receipt law;
12. direct event-only or event-plus-atom DML is outside the supported
    boundary and is rejected by verification on reopen;
13. first-initialization busy failure is immediate and never retried;
14. contiguous safe-integer sequence; malformed expected-head scalars are
    `bundle_invalid_argument` before comparison; and
    `bundle_head_conflict` is reserved for scalar-valid mismatches;
15. trap-free Proxy rejection at every record/array position;
    descriptor-only exact-shape validation with no getter invocation;
    contract-ordered child short-circuiting; inherited-`toJSON` resistance;
    intrinsic calendar-valid timestamps; scalar-order keywords; 64-hex
    checksum vectors; and exact replay atom shape;
16. the exact 19-code vocabulary and deterministic fail-closed
    schema/PRAGMA/semantic verification, including integrity-check-before-
    semantic mixed-corruption precedence, observable decision-before-
    proposal duplicate codes, observed-time-before-transition ordering,
    retained-scope delete ordering, cross-scope-before-atom correspondence,
    and missing/orphan merge precedence, with every stable code exercised;
17. hard-crash recovery: a subprocess in `journal_mode=DELETE` spills
    uncommitted pages, is killed before commit with a hot journal present,
    and public open recovers through the ephemeral writable connection before
    returning a verified read-only handle at the prior checkpoint;
18. full existing and M1 suite regression on Node `22.22.2` with bundled
    SQLite `3.51.2`, including the schema-qualified DDL grammar and proof that
    internal URI `mode=rw` opens an existing file but cannot create an absent
    one;
19. no provider/network action, dependency, live run, or sealed U8 artifact
    change.

## 14. Explicit deferrals

M1 deliberately excludes:

- runtime gate integration or dual writing;
- general/shared scope and ratification;
- background extraction and external provenance;
- supersession, links, validity closure, topic-forget, and lifecycle;
- access/ranking/decay telemetry;
- historical/as-of replay;
- projection rebuild or driver interfaces;
- JSONL export/import;
- vectors, temporal graphs, provider-native memory, or raw ledgers;
- physical deletion certification, signatures, Merkle trees, and
  external anchoring;
- provider calls, benchmark execution, publication, and the final U8
  question.

The next milestone may begin the one-connection runtime mutation seam
only after all M1 laws pass.

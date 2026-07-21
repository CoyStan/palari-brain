# CDX-M2-B Memory Authority Contract

**Status:** normative for the V2-M2-B process-local authority profile only.

This contract defines the trusted-host root, target-bound erasure grants,
store-generation audience, use-time revocation check, and grant lifecycle that
the governed mutation bridge must implement. It does not itself authorize a
CDX projection effect: the governed operation, admission, transition, B2
journal, and co-commit contract must also accept the operation. If any text
here conflicts with the Unified Specification or `docs/KERNEL-CONTRACT.md`,
the higher source wins and this contract must be amended before code proceeds.

## 1. Provenance, scope, and honest limit

This contract was authored against:

- Unified Specification commit
  `c9af823c7dee29d29fd937d44527f3b78d8d3845`;
- Part 4, Memory, blob
  `a0eda8e01c876f7955b74d26afe014bc74147c26`;
- Part 8, Execution and Authority, blob
  `3ddac03564d518e86b7494d2e408c2b839a88df2`;
- Part 12, Trust and Multi-Agent Operation, blob
  `6108926f82f8c44c7ed5a946314c39ce8ea1a115`;
- A1 transaction coordinator commit
  `07d65adcd271b5db04beb9a9fec2335adfb443e2`; and
- A2 compatibility-router commit
  `53e5b0357f83be7700a32458d38922cb7777a66e`.

Part 4 requires every durable memory mutation to pass through
`Admit -> Resolve -> Apply`. Part 8 makes ratification a strength-`1.0` patch,
requires authority to be checked per action, and makes revocation effective at
the next action boundary. Part 12 specifies signed, expiring, nonce-revocable
capabilities for authority that crosses a machine boundary, while recording
that the semantics are already enforced unencrypted where shared-process
honesty may be assumed.

M2-B implements only that bounded shared-process profile. Its exact profile
token is:

```text
host-checked-external-grant-v1
```

It is not a signature, credential, cross-machine capability, authenticated
ledger reader, or proof that the host performed authentication correctly. The
kernel trusts a host-supplied synchronous predicate to attest that an
already-recorded external grant still exists, matches the exact tuple
presented, and is unrevoked at the action boundary. B2 proves only what the
kernel recorded about that check and the resulting decision; it cannot prove
that the predicate was truthful.

The root has no verbs and grants no mutation authority by itself.
`issueMemoryAuthorityGrant` creates only an attenuated pending wrapper around
an already-recorded external grant. A wrapper becomes usable only when the
captured activity predicate returns primitive `true` for its complete tuple
immediately before A1. There is no delegation, default verb, widening, child
grant, or authority derived from a caller, model, proposal, policy,
confidence, actor, writer, or persisted B2 row.

### 1.1 Direct-erasure authority ruling

This profile governs an immediate synchronous user-requested storage erasure,
not a macro-task or a step in a multi-step plan. It therefore does not claim
to instantiate Part 8's `ExecutionPacket` or its plan closure, stop, and
artifact machinery. The applicable Part 8 rule is the turn-scale
hold-for-review discipline: the effect is zero until one typed ratification is
checked at this action boundary. The exact grant supplies that single action,
target write slot, expiry, and revocation boundary.

The operation's internal read set is fixed by code to the target's checkpoint
descriptor, current membership, FTS membership, and incident-link membership.
It cannot be expanded by the caller. Its write set is exactly the named target
atom and FTS projection; any required sidecar write refuses. Part 12's standing
floor is enforced by exact workspace/Palari/user equality and the private-
scope classifier. M2-B makes no general packet-authorization claim, and a
future asynchronous, multi-step, external, or broader-scope erasure must use a
separately reviewed packet/envelope contract.

### 1.2 One logical authority ledger, bounded local view

For profile `host-checked-external-grant-v1`, the host's ledger contains the
typed grant and revocation history under `authorityLedgerId`. Every committed
B2 applied or refused decision is the co-committed local materialized **use
event** for that same logical ledger. One B2 stream has at most one established
`authorityLedgerId`. Its exact join key is
`(authority_ledger_id, authority_event_id, capability_id)`; its derived action
is `erase_atom`, scope is `(workspace_id, palari_id, user_id, target_id)`,
rationale is fixed to `user_erasure_request`, decision is outcome/reason, and
timestamp is `observed_at`.

The versioned authority profile, not a generic operation field by itself,
defines `action='erase_atom'` and `rationale='user_erasure_request'`. The
canonical configuration record merely pins that exact profile token; it does
not independently encode a rationale. These two constants are immutable
semantics of the `-v1` profile, and changing either requires a new profile token
and configuration hash. For every decision, verification and reporting MUST be
able to reconstruct this exact synthetic use row from the B2 meta row, decision
row, and versioned profile:

```text
(authority_ledger_id, authority_event_id, capability_id,
 action='erase_atom', workspace_id, palari_id, user_id, target_id,
 rationale='user_erasure_request', outcome, reason_code, observed_at)
```

This is a required logical view, not an additional SQLite view or persisted
action/rationale column. Neither constant is accepted from caller, proposal,
grant input, or arbitrary persisted text.

Thus a use that lands any governed decision is on record before success is
returned. A proven rollback is not a use event and releases the grant; an
uncertain commit retires authority and exposes no success. The external
grant/revocation view and local B2 use view are not atomically joined,
hash-linked, or independently authenticated by M2-B. Producing a single
portable hash-linked consent view remains explicit conformance debt for an
external-anchor profile; the current bounded claim is only a process-local
materialized view whose external references the trusted host checks.

## 2. Exact module surfaces

### 2.1 Public host surface

`src/memory-authority.mjs` has exactly five exports: one error class and four
host operations:

```js
export class MemoryAuthorityError extends Error
export function createMemoryAuthorityRoot(input)
export function issueMemoryAuthorityGrant(root, input)
export function revokeMemoryAuthorityGrant(root, grant)
export function revokeMemoryAuthorityRoot(root)
```

The return values are exact:

- `createMemoryAuthorityRoot` returns a frozen, zero-own-key,
  null-prototype, `WeakMap`-branded root.
- `issueMemoryAuthorityGrant` returns a frozen, zero-own-key,
  null-prototype, `WeakMap`-branded grant.
- Both revoke functions return exactly `undefined`.
- Serializing or cloning the empty frozen carrier may produce an ordinary
  empty object, but authority never survives because the private brand is not
  serializable or cloneable. Proxies, clones, duck types, and plain empty
  objects are unbranded.

The public module is host-only. Gate, store, manager, extraction, adapter,
recall, and proposal-producer modules must not re-export it or place a root or
grant in a returned value.

### 2.2 Internal bridge surface

The shared state implementation may live in
`src/memory-authority-runtime.mjs`. The public module exposes only the exact
five-name surface above (one class plus four host operations). The store
runtime and governed bridge may import exactly these additional internal
operations:

```js
preflightMemoryAuthorityRoot(root, workspaceId) -> undefined
bindMemoryAuthorityRoot(root, workspaceId, establishedAuthorityLedgerId) -> audience
retireMemoryAuthorityAudience(audience) -> undefined
reserveMemoryAuthorityGrant(audience, grant) -> reservation
authorizeMemoryAuthorityReservation(reservation, targetId, verb) -> snapshot
releaseMemoryAuthorityReservation(reservation) -> undefined
burnMemoryAuthorityReservation(reservation) -> undefined
```

If the shared state uses that file, its dynamic-import namespace is exactly
the five public names plus these seven internal names (twelve total), with no
default or other export. `src/memory-authority.mjs` re-exports only the five
public names and preserves their identities. No other module re-exports an
internal name.

An audience and reservation are frozen, zero-own-key, null-prototype,
privately branded objects. Thus every root, grant, audience, and reservation
carrier satisfies `Object.getPrototypeOf(carrier) === null`. They never enter a
public return value. A wrong internal brand is `authority_invalid_argument`.

`preflightMemoryAuthorityRoot` validates without changing root state.
`bindMemoryAuthorityRoot` revalidates, checks the verified stream's established
ledger identity, and performs the one lifetime binding.
`retireMemoryAuthorityAudience` is idempotent. Release is conditional and
must never undo a reentrant revoke, audience retirement, or later reservation.
Burn is idempotent only for the same already-burned reservation; a released or
foreign reservation cannot burn a later use of the grant.

An internal reservation reaches its burn-eligible state only after
`authorizeMemoryAuthorityReservation` has returned its authorization snapshot.
Burning a branded reservation before that state, or burning a released/stale
reservation, is `authority_invalid_argument`; the latter check must leave any
newer reservation untouched. Repeated release is an exact no-op. This private
phase check does not prove a B2 commit by itself: the governed bridge remains
responsible for calling burn only after a known committed decision.

On successful authorization, `snapshot` is a frozen null-prototype data
record with exactly these own keys and derived values:

```js
{
  authorityProfile: 'host-checked-external-grant-v1',
  authorityKind: 'user',
  authorityId: userId,
  authorityLedgerId,
  authorityEventId,
  capabilityId,
  workspaceId,
  palariId,
  userId,
  targetId,
  verb: 'erase_atom',
  evidenceKind: 'ratified_user',
  evidenceStrength: 1.0,
  evidenceAt,
  issuedAt,
  effectiveAt: observedAt,
  observedAt,
  expiresAt,
}
```

It contains no root, grant, audience, reservation, callback, secret,
serialized capability, caller object, or model-controlled authority field.

## 3. Exact records and scalar grammar

An exact ordinary input record is a non-null, non-Proxy object whose
prototype is exactly `Object.prototype` or `null`, whose complete
`Reflect.ownKeys` set is the named string set with no symbols or extras, and
whose named properties are own data properties. Accessors are rejected
without invocation. Values are never coerced.

No authority identifier is trimmed, normalized, case-folded, or coerced.

- `workspaceId` is a primitive string of length 1 through 48 using only
  `[a-z0-9-]`. Its first character is `[a-z0-9]`; it contains no `--`; and
  its final character is `[a-z0-9]` unless its length is exactly 48, where a
  trailing `-` is permitted. The length-48 exception exactly matches the
  current runtime's slice-after-normalization behavior.
- `palariId` and `userId` are primitive strings matching
  `[a-z][a-z0-9_-]{0,63}`.
- `authorityLedgerId` is `led_` followed by a canonical lowercase UUIDv4.
- `authorityEventId` is `agr_` followed by a canonical lowercase UUIDv4.
- `capabilityId` is `cap_` followed by a canonical lowercase UUIDv4.
- `targetId` is `mem_` followed by a canonical lowercase UUIDv4.

The canonical UUIDv4 body is:

```regex
[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}
```

A canonical timestamp is a primitive, 24-character UTC-millisecond string
whose parsed value is finite and whose captured-native
`Date.prototype.toISOString` round trip equals the original exactly:

```text
YYYY-MM-DDTHH:mm:ss.sssZ
```

The authority runtime captures native `Date.now`, `Date`, and
`Date.prototype.toISOString` at module evaluation. Caller clocks are never
consulted. Each root maintains a numeric native-clock high-water mark. Equal
millisecond readings are allowed. An invalid or decreasing reading
permanently retires the root, its audience, and every grant, then throws
`authority_clock_invalid`. A forward jump may expire authority but never
extends it.

For this profile, a sampled native-clock reading is valid exactly when it is a
primitive finite integer millisecond value whose captured-native ISO rendering
is a 24-character canonical timestamp. It is never coerced. After validity and
monotonicity pass, the high-water mark advances immediately, before a later
issuance-chronology or use-time-expiry check; a failed attempt therefore cannot
erase an observed forward clock movement.

## 4. Root construction and audience binding

`createMemoryAuthorityRoot` accepts exactly:

```js
{
  workspaceId: string,
  palariId: string,
  userId: string,
  authorityLedgerId: string,
  checkGrantActive: function,
}
```

The captured `checkGrantActive` descriptor value is accepted exactly when
`typeof value === 'function'` and captured `node:util.types.isProxy(value)` is
false. No property access, invocation probe, or purported side-effect-free
`IsCallable` test is used. In particular, a class constructor is function-typed
and passes this capture rule even though applying it later throws; that throw
follows the callback-throw law in section 6. A bound function is also accepted.
The value is captured once, never read from caller state again, and is not
invoked during root construction or grant issuance.

`createMemoryAuthorityRoot` has this exact precedence:

1. reject a Proxy before invoking any trap;
2. require a non-null exact ordinary input record and capture its complete
   own-key and own-descriptor set;
3. reject a wrong prototype, key set, symbol, accessor, or non-data property
   without invoking an accessor;
4. capture every descriptor value once;
5. validate `workspaceId`, then `palariId`, then `userId`, then
   `authorityLedgerId`;
6. apply the exact function-typed/non-Proxy rule above to
   `checkGrantActive`; and
7. construct the unbound root without sampling a clock or invoking caller
   code.

Every failure in this construction sequence is `authority_invalid_argument`.

A new root is `unbound`. It contains no verb set, mint scope, default
operation, caller clock, serializable token, or operation authority.

For an enabled store, preflight occurs after workspace normalization but before
the database open/B2 bootstrap. It checks only root brand/state and exact
workspace equality; no trustworthy stream history exists at that point. Final
binding occurs only after successful CDX-M1/B2 bootstrap and complete
verification, when the bootstrap owner supplies exact `undefined` for a
zero-head history or the first decision's verified `authority_ledger_id` for a
nonempty history. A nonempty verified history MUST contain that same ledger ID
on every decision. A differing root ledger fails final binding as
`authority_scope_mismatch` before handle publication.

For a zero-head history, final binding records the root ledger as the live
audience's candidate but does not mutate B2. The first successfully
co-committed decision that advances head from zero to one establishes that ID
for the stream; every later decision and every later root binding must match
it. Closing before that decision leaves the stream unestablished, so a later
fresh root may supply a different candidate. A store generation is a fresh
opaque process-local object created once per successful enabled store open.
Binding otherwise requires exact workspace equality. A root may bind exactly
once in its lifetime and to exactly one generation:

```text
unbound -> live(bound generation) -> retired
```

Two already-published zero-head generations may therefore hold different
candidates. If one establishes sequence one first, the other generation MUST,
inside its next A1 attempt after complete B2 verification and before append,
detect that the now-established ledger differs. That attempt rolls back with
`authority_scope_mismatch`, appends no decision, and retires the incompatible
root/audience because their immutable ledger can never match that stream.
This race-only recheck does not weaken final-bind mismatch precedence for a
generation opened after sequence one already exists.

Both internal construction calls receive an already-normalized primitive
`workspaceId`. Preflight checks root brand (`authority_root_invalid`),
retirement (`authority_root_revoked`), an existing binding
(`authority_root_busy`), workspace-argument grammar
(`authority_invalid_argument`), and workspace equality
(`authority_scope_mismatch`), in that order, then returns exact `undefined`
without mutation. Final bind repeats those checks. Its third argument is
accepted only as exact `undefined` for verified head zero or as a canonical
`led_` UUIDv4 copied from the verified first decision for a nonzero head; any
other internal argument is `authority_invalid_argument`. A valid nonempty
ledger differing from the root is `authority_scope_mismatch`; otherwise bind
creates and returns the audience.

There is no `retired -> unbound` transition. Closing a store retires its
audience synchronously before native close begins, even when native close
later fails. Reopening the same path requires a new root. Explicit root
revocation, a fatal authority-clock failure, an authority-predicate protocol
failure, or an uncertain A1 failure also retires the audience and root
permanently.

`palariId` and `userId` are the root's exact user audience. They are checked
against the target row inside A1; they are not inferred from legacy actor,
writer, proposal, visibility, or options fields.

B2 initializes and verifies normally when no root is supplied. Such a handle
remains readable, but semantic mutation has no authority. A disabled handle
does not inspect or bind an optional root.

### 4.1 Exact store-construction plumbing

`createKernelStore` and its private runtime accept one optional own data field
named `authorityRoot`. The field is not copied into `config`. Existing
options-carrier and configuration precedence remains unchanged. The complete
direct-factory construction order is:

1. apply the existing options-carrier check, then capture the existing
   `clock`, `env`, `memoryEnabled`, `memoryRootDir`, `publicDemo`, `statePath`,
   and `workspaceId` values in their existing order, without requesting the
   `authorityRoot` descriptor or value;
2. resolve the existing memory configuration solely from those captured
   values, still without observing `authorityRoot`;
3. if that configuration is disabled, return the disabled handle immediately;
   neither `authorityRoot`, path selection or coercion, the driver, the
   filesystem, nor B2 is observed;
4. on the enabled branch, capture the path candidate and perform the existing
   workspace normalization and path-related scalar coercions completely;
5. only then capture and validate the `authorityRoot` own descriptor and, for
   a present root, run authority preflight against the normalized primitive
   workspace id;
6. only after successful authority handling, resolve the canonical filesystem
   path and enter the existing canonical-path registry serialization;
7. inside that serialized operation, perform native connection open and the
   complete CDX-M1/B2 bootstrap and verification; and
8. after successful verification, perform final authority binding, if a root
   was supplied, before publishing the handle.

No later phase may be speculatively observed before an earlier phase succeeds.
In particular, a path/workspace coercion throw precedes and suppresses every
authority descriptor observation, an authority failure precedes canonical
filesystem and native-open work, and a bootstrap failure precedes final bind.
For a disabled store the authority field is not inspected. For an enabled
store it is captured exactly once with captured
`Reflect.getOwnPropertyDescriptor`:

- no own descriptor, including an inherited data property or accessor, is
  omission and selects a rootless readable handle;
- an own accessor descriptor is rejected as `authority_root_invalid` without
  invocation;
- an own data descriptor whose value is exact `undefined` selects rootless;
  and
- any other own data value is passed to root preflight, so an unbranded value
  is `authority_root_invalid`.

A present branded value is preflighted after workspace normalization and
before canonical filesystem resolution, registry serialization, native open,
or B2 bootstrap. Final bind, including the established-ledger comparison,
occurs after successful bootstrap/verification and before handle publication.
If final bind fails, no handle is published and the native connection is
closed under the bootstrap cleanup law. Initial B2 creation may already have
committed; that valid rootless database is not rolled back or repaired on a
later open.

`createWorkspaceMemoryManager` accepts one optional own data field named
`authorityRootForWorkspace`. Its complete construction order is:

1. apply the existing manager-options carrier check, then capture and process
   the existing `clock`, `env`, `memoryEnabled`, `memoryRootDir`, `policy`,
   `publicDemo`, and `statePath` values in their existing order, including
   existing policy construction, without requesting the authority-provider
   descriptor or value;
2. resolve the existing manager configuration, still without observing the
   provider;
3. if that configuration is disabled, return the disabled manager
   immediately, without manager-path capture or coercion, driver probe, or
   `authorityRootForWorkspace` descriptor observation;
4. on the enabled branch, finish manager-path capture and every associated
   scalar coercion;
5. after successful path capture, run and finish the SQLite driver probe; and
6. only after the probe returns capture and validate the provider's own
   descriptor, then construct the enabled manager.

No provider error can mask an earlier existing-options, configuration, path,
or probe failure. For an enabled manager, an inherited field is omission; an
own accessor is `authority_invalid_argument` without invocation; and an
omitted or own-data exact `undefined` value selects no provider. Any other own
descriptor value is accepted exactly when `typeof value === 'function'` and it
is not a Proxy, and is otherwise `authority_invalid_argument`. An accepted
provider is captured once at manager construction and is never placed in
`config` or a returned manager/handle.

Each `forWorkspace` call first applies manager liveness, then performs the
existing workspace-id normalization and scalar coercion, then selects among a
live cached handle, an installed in-flight creation, or a newly installed
creation flight. A live or in-flight reuse returns that selection without a
provider call. Only the newly installed flight invokes the provider, exactly
once, before calling the direct store runtime and therefore before that
runtime's canonical-filesystem, registry-serialization, native-open, or B2
work. The invocation is by captured
`Reflect.apply(provider, undefined, [workspaceId])`. The supplied
`thisArgument` is `undefined`; ordinary sloppy-function substitution still
applies, and a bound function may observe its bound receiver instead. The
already-normalized primitive workspace id is the sole argument. No separate
callability probe occurs: if `Reflect.apply` throws, including for an accepted
class constructor, that exact throw escapes by identity. The call occurs
outside every SQLite transaction and before the store open begins. It must
return synchronously either exact `undefined` (rootless) or a branded root. Any
other return, including a Promise, is passed directly to root preflight and
fails as `authority_root_invalid` without thenable/property inspection.

A disabled manager never validates or invokes the provider. A manager-close
race uses the existing creation-flight law; if a late handle is closed, its
audience is retired before native close. Returning the same root for two
creations cannot widen it: workspace mismatch or the one-lifetime bind law
rejects the second use. Proposal, model, extractor, adapter, and recall values
never select either construction field.

## 5. Grant issuance

`issueMemoryAuthorityGrant(root, input)` accepts exactly:

```js
{
  authorityEventId: string,
  capabilityId: string,
  evidenceAt: canonicalTimestamp,
  expiresAt: canonicalTimestamp,
  targetId: string,
  verb: 'erase_atom',
}
```

There is no other M2-B verb.

Issuance precedence is exact:

1. trap-free root brand;
2. root retired;
3. root not bound to a live generation;
4. exact grant-input capture and scalar validation;
5. root and audience recheck;
6. process-local reuse check for both identifiers;
7. native `issuedAt` sampling and high-water check;
8. chronology check; and
9. grant creation.

Both identifiers are permanently reserved within that root when issuance
succeeds and cannot be issued again by it. Historical and cross-root
uniqueness remains enforced by B2.

The host MUST have committed the referenced external grant before issuance.
The exact issuance chronology is:

```text
evidenceAt <= issuedAt < expiresAt
```

Violation is `authority_invalid_argument`. There is no default expiry and
M2-B invents no maximum lifetime.

The grant snapshot derives, rather than accepts:

```text
authorityProfile = host-checked-external-grant-v1
authorityKind = user
authorityId = root.userId
evidenceKind = ratified_user
evidenceStrength = 1.0
issuedAt = native issuance time
```

A grant is bound by object identity to its root and the root's current store
generation. Its states are:

```text
available | reserved | burned | revoked | expired | retired
```

Only `available -> reserved -> available` is reversible. Every terminal state
is irreversible.

## 6. Exact use-time activity check

After a grant is reserved and caller input has been completely captured, the
authority runtime invokes the captured predicate exactly once through captured
`Reflect.apply(predicate, undefined, [record])`, supplying `undefined` as the
ECMAScript `thisArgument`, and one frozen null-prototype record with exactly
these fields. A strict unbound callback observes `this === undefined`; a
non-strict callback follows the language's ordinary `this` substitution, and a
bound function may observe its bound receiver instead:

```js
{
  authorityProfile: 'host-checked-external-grant-v1',
  authorityLedgerId,
  authorityEventId,
  capabilityId,
  workspaceId,
  palariId,
  userId,
  targetId,
  verb: 'erase_atom',
  evidenceAt,
  issuedAt,
  expiresAt,
}
```

Primitive `true` means the named external ledger contains a currently active,
unrevoked grant whose complete audience, target, verb, evidence, capability,
and expiry tuple matches exactly. Primitive `false` means inactive or
mismatched.

The predicate is a trusted, synchronous, read-only boundary. As a trusted-host
precondition—not a hostile-host sandbox—it MUST NOT return a Promise or
thenable, call a kernel/store method, mutate CDX/B2, or consume the capability.
A Promise or any non-boolean value is not inspected and is
`authority_ledger_protocol`. Same-grant reuse and close/revoke/retirement of
the outer authority state are fail-closed by the checks below. A cross-grant
store call violates the trusted-host no-reentry precondition; this profile does
not sandbox it, promise that the inner call has no effect, or make a
hostile-host claim. A host whose authority system can be checked only
asynchronously or requires store reentry cannot use this profile.

Invocation order is exact:

1. reserve the grant;
2. capture all untrusted legacy input;
3. recheck store, audience, root, grant, generation, target, and verb;
4. invoke `checkGrantActive`;
5. capture its return or throw using separate private `callbackThrew`,
   `callbackReturnValue`, and `callbackThrownValue` slots;
6. recheck all local state again;
7. classify the callback outcome;
8. sample native `observedAt`;
9. enforce clock monotonicity and
   `issuedAt <= observedAt < expiresAt`;
10. set `effectiveAt = observedAt`; and
11. enter A1 directly.

After the predicate returns there may be only trap-free local checks, native
time sampling, immutable scalar construction, and the direct A1 call. There
is no async boundary, caller code, caller clock, authority callback, ID
callback, or other untrusted callback during A1.

Callback outcomes are exact:

- Primitive `true`: continue.
- Primitive `false`: mark the grant `revoked` and throw
  `authority_ledger_unavailable`.
- Throw: perform the mandatory local recheck, release the reservation if it
  remains live, and throw `authority_ledger_unavailable` with the thrown
  value preserved by identity as `cause`. `callbackThrew` is the discriminator,
  so `throw undefined` and `throw null` are throws, not returns or missing
  state.
- Non-boolean: retire the root, audience, and every grant, then throw
  `authority_ledger_protocol`.

Expiry equality refuses. `observedAt >= expiresAt` marks the grant `expired`
and throws `authority_grant_expired`.

This ordering implements Part 8's action boundary. Revocation immediately
after a successful check affects the next action, while the already-launched
synchronous action completes or aborts.

### 6.1 Bounded reentrant precedence

The post-capture recheck runs before target comparison or the activity
predicate. Its first matching row wins:

| condition after caller capture | result | reservation disposition |
|---|---|---|
| store/bridge closed | exact `legacy_store_closed` | conditional release; close retirement is never undone |
| root explicitly revoked or retired | `authority_root_revoked` | terminal/retired |
| audience or generation no longer exact/live | `authority_scope_mismatch` | terminal/retired |
| grant is explicitly `expired` | `authority_grant_expired` | terminal |
| grant is revoked, burned, retired, or no longer owned by this reservation | `authority_grant_unavailable` | terminal state preserved |
| captured target/verb differs | `authority_grant_mismatch` | conditional release |
| all checks pass | invoke predicate | remain reserved |

The post-predicate recheck occurs even when the predicate threw or returned a
non-boolean. Its first matching row wins over the captured callback outcome:

| condition after predicate returns/throws | result | reservation disposition |
|---|---|---|
| store/bridge closed | exact `legacy_store_closed`; callback cause is not attached | close retirement preserved |
| root explicitly revoked or retired | `authority_root_revoked`; callback cause is not attached | terminal/retired |
| audience/generation differs | `authority_scope_mismatch`; callback cause is not attached | terminal/retired |
| grant is explicitly `expired` | `authority_grant_expired`; callback cause is not attached | terminal |
| grant is revoked, burned, retired, or reservation identity changed | `authority_grant_unavailable`; callback cause is not attached | terminal state preserved |
| callback threw | `authority_ledger_unavailable` with exact callback cause | conditional release |
| callback returned primitive `false` | `authority_ledger_unavailable` | mark grant revoked |
| callback returned any other non-`true` value | `authority_ledger_protocol` | retire root/audience/all grants |
| callback returned primitive `true` | sample/check native clock and expiry | remain reserved until next result |

After primitive `true`, `authority_clock_invalid` wins over expiry and retires
the root. Otherwise `observedAt >= expiresAt` gives
`authority_grant_expired`; only a valid earlier reading yields the immutable
authorization snapshot. These tables are exhaustive for the outer reservation's
local state, not for arbitrary reentrant work. Reuse of the same reserved grant
fails before an effect, and close, revoke, or retirement is observed by the
outer recheck before A1. A different grant is not protected by the outer
reservation; invoking a cross-grant store operation from the trusted predicate
is prohibited by the profile rather than sandboxed.

## 7. Reservation and public-operation precedence

For an enabled bound mutation method, precedence is exact:

1. A disabled capability returns its existing inert result and inspects
   neither grant nor caller input.
2. Enabled store liveness is checked. `legacy_store_closed` wins over every
   grant or input defect.
3. `authorityGrant === undefined` is absence, not an exception. Return the
   route-shaped governed refusal without inspecting caller input.
4. Any present value is checked trap-free for grant brand. Failure is
   `authority_grant_invalid`.
5. A terminal or already-reserved grant is
   `authority_grant_unavailable`; an `expired` grant remains
   `authority_grant_expired`.
6. Exact generation, root, and audience identity is checked. A live grant for
   another generation is `authority_scope_mismatch`.
7. Mark the grant `reserved` before reading, coercing, or invoking anything
   in the legacy argument.
8. Capture legacy input. A caller throw escapes by identity after conditional
   release.
9. Recheck store, root, audience, and grant state after capture.
10. An unsupported route releases and returns its exact legacy-compatible
    refusal.
11. A captured target or verb differing from the grant releases and throws
    `authority_grant_mismatch`.
12. Perform the exact activity-check sequence in section 6.
13. Enter A1.

A release is conditional: it changes `reserved -> available` only if the same
reservation, root, and audience remain live. Reentrant revoke, close,
retirement, or replacement is never undone by cleanup.

A valid, externally active grant reaching target classification produces
either an applied B2 decision or a zero-effect B2 refusal. Both are committed
uses and burn the grant before the public result is returned. Missing target,
scope mismatch, shared target, and incident-edge refusal therefore each
consume one grant.

If B2 already contains either the grant's `authorityEventId` or
`capabilityId`, the local grant is burned and the operation throws
`authority_grant_unavailable` without appending a second decision.

The exact missing-authority results are owned by each public route. They are
governance refusals, never implicit authorization and never
`MemoryAuthorityError` exceptions. At minimum:

```js
gate.propose(...) -> {
  outcome: 'rejected',
  reasons: ['governance_refused'],
}

gated.deleteMemory(...) -> {
  deleted: false,
  reason: 'governance_refused',
}
```

## 8. Burn, release, and retire law

The grant is one-decision, not one-call:

- **Burn** after any known committed B2 decision, applied or refused.
- **Release** after failure known to have committed no B2/CDX mutation.
- **Retire** the root, audience, and all grants whenever commit or transaction
  ownership is uncertain.

The exact A1 mapping is:

| A1 outcome | Authority disposition |
|---|---|
| normal return after a committed applied or refused decision | burn |
| `mutation_invalid_argument` | release |
| `mutation_connection_policy` | release |
| `mutation_busy` | release |
| `mutation_async_apply` | release; A1 proved rollback |
| `mutation_commit_failed` | release; A1 proved rollback |
| original internal callback exception rethrown after successful A1 rollback | release unless that error independently retires the bridge |
| `mutation_connection_invalid` | retire |
| `mutation_transaction_active` | retire |
| `mutation_begin_failed` | retire; this code conflates clean inactive failure with poisoned or unreadable begin outcomes |
| `mutation_transaction_ownership_lost` | retire |
| `mutation_commit_outcome_unknown` | retire |
| `mutation_cleanup_failed` | retire |
| `mutation_poisoned` | retire |

Pre-A1 malformed or unsupported input, target/verb mismatch, or an
activity-check throw releases. Activity-check `false`, expiry, explicit grant
revoke, and historical nonce reuse are terminal for that grant.
Activity-check protocol failure and clock failure retire the root.

Governed-bridge errors raised inside an A1 callback are settled after A1 has
either proved rollback or reported uncertainty. These specific rows override
the generic internal-callback row above. This table is exhaustive:

| bridge result after A1 | authority and bridge disposition |
|---|---|
| race-only `authority_scope_mismatch` after verified ledger mismatch with proven rollback | retire incompatible root/audience/all grants; keep the bridge readable and nonpoisoned; append nothing; rethrow the exact `MemoryAuthorityError` |
| `governance_identifier_collision` with proven rollback | release; no ID retry inside the call |
| historical authority-event/capability reuse with proven rollback | mark grant burned; throw `authority_grant_unavailable` |
| `governance_connection_invalid` | poison bridge and retire root/audience/all grants |
| `governance_schema_invalid`, `governance_migration_invalid`, `governance_config_invalid`, `governance_meta_invalid`, `governance_checkpoint_invalid`, `governance_journal_invalid`, or `governance_projection_invalid` with proven rollback | poison bridge and retire root/audience/all grants |
| `governance_clock_invalid` with proven rollback | poison bridge and retire root/audience/all grants |
| `governance_transaction_required`, `governance_internal_invariant`, `governance_state_closed`, or `governance_state_poisoned` | poison/retain poison and retire root/audience/all grants |
| `governance_invalid_argument` before A1 from caller capture | release |
| `governance_invalid_argument` inside A1 | treat as internal invariant; poison and retire |
| an otherwise unclassified native/projection-applier exception after A1 proves rollback | release; the next attempt re-runs the full verifier and activity predicate |
| any bridge error combined with A1 ownership/cleanup/commit uncertainty | A1 uncertainty wins; poison bridge and retire root/audience/all grants |

The race-only authority error follows the same uncertainty override: if A1
cannot prove rollback/ownership/cleanup, uncertainty poisons the bridge and
retires authority instead of exposing the scope error as a clean rollback.

The governed projection child is not covered by the unclassified-exception
row when it reports a known impossible state. The bridge converts exact
`legacy_effect_cardinality` drift to `governance_projection_invalid`, and
converts `legacy_effect_invalid`, `legacy_plan_invalid`, `legacy_plan_stale`,
or `legacy_plan_applied` from that child to
`governance_internal_invariant`, preserving the legacy error as `cause`.
Those conversions poison and retire under the rows above; neither is a
governed refusal or a releasable retry.

`governance_clock_invalid` is the cross-root persisted-time guard. Inside A1,
the bridge first completes verification so the current B2 tail is trustworthy,
then—before historical authority-event/capability reuse and before generating
decision/patch nonces—compares the new authorization snapshot's `observedAt`
with the tail's `observed_at`. If it is earlier, no decision is appended, A1
rolls back, and the current root/bridge retire. A per-root high-water mark alone
is not sufficient across close/reopen or process-clock rollback.

After A1 returns normally, the decision is known committed. The bridge then
calls `burnMemoryAuthorityReservation` before exposing a result. For a valid
production reservation this operation is total and non-throwing: it performs
only private identity checks already proved before A1 and direct private-state
assignments, calls no user/native function, and changes `reserved -> burned`.
There is no post-commit settlement failure-injection ordinal. A committed
decision can therefore never release or remain available.

### 8.1 Why proven rollback releases

Always burning on reservation is simpler, but it is not the safer
specification fit. Part 8 makes ratification standing, checked per action, and
explicitly treats ceremony inflation as a defect. Burning on malformed caller
input, `SQLITE_BUSY`, or a proven rollback would let operational noise force a
fresh user ceremony without producing either an effect or an auditable use
decision.

Release after proven no-commit does not amplify authority because:

- the grant's audience, target, verb, evidence, and expiry are immutable;
- it cannot be used concurrently while reserved;
- the external activity predicate is rerun on every attempt;
- revocation is therefore observed before every retry;
- B2 uniquely constrains both authority-event and capability identifiers;
- any committed refusal burns the nonce; and
- every uncertain outcome retires the entire audience.

This law requires `checkGrantActive` to be a pure status check, not a
consuming RPC. A host whose external system consumes a capability merely by
checking it is incompatible with `host-checked-external-grant-v1`.

## 9. Revocation

`revokeMemoryAuthorityRoot(root)` checks the root brand and then retires the
root, its audience, and all of its grants. Repeated calls for the same branded
root are idempotent.

`revokeMemoryAuthorityGrant(root, grant)` checks the root brand, grant brand,
and exact root/grant ownership, in that order. A wrong root is
`authority_scope_mismatch`. A correctly owned grant is marked `revoked` from
`available` or `reserved`. If it is already `revoked`, `burned`, `expired`, or
`retired`, the function preserves that terminal state and returns exact
`undefined`; it never rewrites why the grant terminated. A previously revoked
root does not prevent cleanup of one of its own grants.

Revocation may occur reentrantly during caller capture or the activity
predicate. The mandatory post-callback local recheck observes it before A1.
No untrusted callback can interleave once A1 begins.

## 10. Closed error vocabulary

The public constructor is exactly:

```js
new MemoryAuthorityError(code, message, cause?)
```

`code` must be one of the thirteen primitive strings below and `message` must
be a non-empty primitive string. The constructor permits any such message;
the table pins the only messages production functions emit. When the third
argument is supplied (`arguments.length >= 3`), including exact `undefined`,
it becomes the standard non-enumerable `cause` without coercion. When it is
omitted, no own `cause` property exists. Predicate-throw handling always calls
the constructor with three arguments, so `throw undefined` yields an own
non-enumerable `cause` whose value is exact `undefined`.
`MemoryAuthorityError` has `name === 'MemoryAuthorityError'`, the standard
non-enumerable `message`, an optional standard non-enumerable `cause`
preserved by identity without coercion, and exactly one enumerable
classification property: immutable `code`.

Its accepted production pairs are exactly:

| Code | Exact production message |
|---|---|
| `authority_invalid_argument` | `A valid memory authority argument is required.` |
| `authority_root_invalid` | `A module-issued memory authority root is required.` |
| `authority_root_revoked` | `The memory authority root has been revoked.` |
| `authority_root_unbound` | `The memory authority root is not bound to a live store generation.` |
| `authority_root_busy` | `The memory authority root is already bound to a store generation.` |
| `authority_scope_mismatch` | `The memory authority scope does not match the store audience.` |
| `authority_grant_invalid` | `A module-issued memory authority grant is required.` |
| `authority_grant_unavailable` | `The memory authority grant is no longer available.` |
| `authority_grant_expired` | `The memory authority grant has expired.` |
| `authority_grant_mismatch` | `The memory authority grant does not authorize this target and verb.` |
| `authority_clock_invalid` | `The native authority clock is invalid or moved backward.` |
| `authority_ledger_unavailable` | `The external authority grant is not active at use time.` |
| `authority_ledger_protocol` | `The authority activity check must return a primitive boolean synchronously.` |

No error-code/message table is exported. Constructing the class with an
unknown or non-string code throws native:

```text
TypeError: Unknown memory authority error code.
```

An empty or non-string message throws native:

```text
TypeError: Memory authority error message must be a non-empty string.
```

The function-specific precedence is exact:

- `createMemoryAuthorityRoot`: Proxy rejection -> exact input carrier/key/data-
  descriptor capture -> workspace -> Palari -> user -> ledger -> function-
  typed/non-Proxy predicate -> construct.
- `issueMemoryAuthorityGrant`: root brand -> revoked -> unbound -> input ->
  post-capture state -> identifier reuse -> native clock -> chronology.
- Internal preflight: root brand -> revoked -> already bound -> workspace-
  argument grammar -> workspace mismatch -> return exact `undefined` without
  mutation.
- Internal bind: root brand -> revoked -> already bound -> workspace-argument
  grammar -> workspace mismatch -> established-ledger argument grammar ->
  nonempty-history ledger mismatch -> bind. The mismatch is
  `authority_scope_mismatch`; an invalid internal argument is
  `authority_invalid_argument`.
- `revokeMemoryAuthorityRoot`: root brand, then idempotent retirement.
- `revokeMemoryAuthorityGrant`: root brand -> grant brand -> root/grant
  ownership -> idempotent terminal revoke.
- Mutation use follows section 7. Earlier store liveness and disabled-state
  laws are not replaced by authority errors.

## 11. Required falsifiers

Implementation is incomplete until tests prove at least:

1. exact exports, null-prototype zero-key frozen brands,
   clone/spoof/Proxy rejection, and no authority disclosure through any public
   handle;
2. exact-record, identifier, UUID variant/version, and timestamp round-trip
   boundaries, including the 48-character trailing-workspace-hyphen case;
3. root one-generation binding, rootless read operation, close-before-native-
   close retirement, mandatory new root after reopen, first-decision ledger
   establishment, same-ledger continuation, and nonempty-history bind mismatch
   before publication; plus competing zero-head candidates where the losing
   generation rolls back its next attempt with `authority_scope_mismatch` and
   retires without a decision;
4. exact create-root/preflight/bind precedence; disabled/rootless/direct-store/
   manager-provider construction precedence; inherited omission, own-accessor
   rejection without invocation, own-data capture, exact function-typed/non-
   Proxy acceptance, provider throw identity, bound-provider receiver behavior,
   exactly-once synchronous provider invocation outside SQLite, and absence of
   root/provider values from every returned `config` and handle; direct-store
   cross-product falsifiers must combine an earlier invalid options carrier or
   throwing existing-value/config capture with a throwing authority accessor,
   disabled configuration with throwing path coercion and authority accessor,
   throwing enabled path/workspace coercion with a throwing authority
   accessor, invalid authority with observable canonical-path/open hooks, and
   bootstrap failure with observable final bind; manager cross-product
   falsifiers must combine earlier existing-options/configuration failure with
   a throwing provider accessor, disabled configuration with throwing path
   coercion/provider access and a driver-probe sentinel, enabled path-coercion
   failure with probe/provider sentinels, probe failure with a throwing
   provider accessor, closed or workspace-normalization failure with a
   provider-call sentinel, live/in-flight reuse with that sentinel, and a new
   flight's provider throw with direct-runtime/filesystem/open sentinels;
5. no root verb field, no root-as-grant use, exact `erase_atom` grants, native
   issuance time, evidence chronology, and identifier non-reuse;
6. reservation before every caller getter/coercion/clock, conditional release
   after caller throws, and post-capture liveness/revocation recheck;
7. complete callback record with separate threw/return/value slots, exact
   `throw undefined`/`throw null` cause presence and identity,
   exact function-typed/non-Proxy acceptance, exact
   `Reflect.apply` invocation with supplied `thisArgument` `undefined`, bound-
   callback receiver behavior, primitive-boolean-only result, no thenable
   inspection, callback/apply-throw cause identity, same-grant reuse failure,
   close/revoke/retirement recheck, and no cross-grant sandbox claim;
8. native observed/effective time only after untrusted capture, expiry
   equality refusal, backward-clock retirement, and no caller callback during
   A1;
9. exact disabled, closed, omitted, invalid, stale, wrong-generation,
   mismatch, callback, clock, expiry, and A1 precedence;
10. burn for committed applied and refused decisions, release for every proven
   rollback/no-commit A1 class, poison/retirement for
   `governance_connection_invalid`, persisted-clock checking after verification
   and before historical nonce reuse, and retirement for every uncertain A1
   class;
11. retry after busy and commit-failed rollback rechecks the external grant,
    while callback false, committed refusal, historical nonce reuse, and
    unknown commit cannot be retried; and
12. exact `MemoryAuthorityError` shape, constructor failures, production
    code/message pairs, causes, and revoke idempotence.

Mocks prove only deterministic protocol plumbing. This profile makes no live
provider claim and requires no provider call.

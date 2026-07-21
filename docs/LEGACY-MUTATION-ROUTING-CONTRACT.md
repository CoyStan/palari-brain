# Legacy Mutation Routing Contract — Palari v2 M2-A2

**Status:** normative only for V2-M2-A2. Passing this contract does not
complete V2-M2, authorize a source-of-truth cutover, or advance V2-M3.
**Date:** 2026-07-21.
**Baseline:** `1d65bb0` (`BRAIN V2-M2: certify transaction coordinator`).
**Runtime:** exact Node `v22.22.2`, SQLite `3.51.2`.
**Derived from:** the Unified Specification at
`c9af823c7dee29d29fd937d44527f3b78d8d3845`, especially Part 4
`rule:onegate`; `docs/KERNEL-CONTRACT.md`; `docs/KERNEL-API.md`;
`docs/PALARI-V2-ARCHITECTURE.md`; and the A1 transaction-owner contract in
`docs/MUTATION-SEAM-CONTRACT.md`.

The Unified Specification and kernel contract remain authoritative for memory
semantics. This contract does not claim that current CDX-M1 semantics conform
to them. It routes the complete supported **in-file CDX-M1 semantic DML**
surface as explicitly **legacy compatibility** work and inventories terminal
workspace destruction as a separate storage-lifecycle route. M2-B must later
map every possible route and effect to a governed operation or
deterministically refuse it.

## 1. Exact boundary

M2-A2 has one bounded job:

1. replace every supported in-file CDX-M1 semantic DML shortcut with one
   closed legacy-intent route;
2. resolve each compatibility-validated intent to one deterministic,
   transaction-neutral
   plan after `BEGIN IMMEDIATE`;
3. apply its ordered CDX effects under the A1 coordinator's active lease;
4. make each public semantic call atomic, including current multi-row
   recall-inclusion, lifecycle, and topic-forget calls; and
5. structurally bind every in-repository producer to branded safe handles.

This closes the raw in-file writer graph only. It does **not** establish
overall one-gate conformance: terminal whole-workspace destruction remains a
separately serialized legacy storage route, and M2-B still must bind trusted
authority, govern or refuse that route, and co-commit every accepted in-file
operation. Parent M2 remains open.

CDX-M1 remains runtime and read authority. Exact CDX-B1 remains unchanged and
non-authoritative, with all six capability bits false. A2 adds no B1 or B2
object, canonical atom, decision, journal, receipt, patch registration,
authority root, signature, provider call, benchmark run, result, or
publication claim.

The words `legacy`, `intent`, `plan`, and `effect` in this contract name only
ephemeral compatibility execution data. They are not aliases for the Unified
Specification's patch/admission/authority vocabulary and may not be copied
into B2 as canonical names.

## 2. Authority and semantic disclaimers

Every A2 intent, proposal record, target, option, configuration, policy
override, proposed/generated ID, type, acquisition mode, writer, actor,
Palari/user scope, same/cross-Palari or same/cross-user target relation,
visibility/shared flag, source/evidence/acquisition class, extractor,
confidence, timestamp/temporal class, and caller-clock output is
compatibility input or execution data. None is authenticated authority. In
particular:

- the string `explicit_user_action` does not prove that a user acted;
- U4's `ratify` label does not establish specification-grade ratification;
- U4 confidence floors are compatibility policy, not the pinned Unified
  Specification theta table;
- creation confidence remains distinct in principle from evidence strength,
  even though current compatibility behavior conflates them;
- a successful A2 plan is not authorization, a governed decision, or a
  receipt; and
- a module-private lease proves only A1's bounded lexical transaction
  ownership, subject to the structural continuity limit already recorded in
  `docs/MUTATION-SEAM-CONTRACT.md`.

A2 preserves and labels compatibility defects so M2-B can map-or-refuse them;
it does not canonize them. The required M2-B carry-forward matrix includes at
least:

- lifecycle's current automatic deletion of low-importance transient rows,
  where the governing law requires demotion rather than automatic erasure;
- CDX's current permanent partition, which includes `preference` and omits the
  governing `sensory` type;
- mutation of access, importance, sharing, and validity columns on atom rows;
- caller-asserted actor/writer identity and target scope;
- direct or topic deletion of permanent/transient rows based only on that
  caller-asserted actor, including FTS deletion and every cascaded link;
- creation confidence used as an admission proxy;
- candidate creation that can currently set `shared=1` without a separate
  ratification ceremony;
- cross-user duplicate selection within one Palari;
- caller-supplied cross-Palari supersession rows/links and supplied content
  hashes that are not recomputed;
- current store-time/evidence-time differences in supersession;
- lifecycle's empty-Palari compatibility scope, which sweeps current transient
  rows across every Palari rather than refusing an absent authority scope; and
- current target-by-ID operations that do not authenticate ownership.

M2-B must either map each such branch to a provenance-pinned governed
operation or refuse it deterministically before parent M2 can complete.

## 3. Complete durable-write disposition

The table is exhaustive for the baseline production source graph. A2 tests
mechanically keep it synchronized with the closed intent/effect vocabularies.

| Current durable action | A2 disposition |
|---|---|
| Open/create workspace database; CDX-M0 schema, indexes, FTS, triggers, compatibility columns, migration row | serialized pre-handle bootstrap; not a semantic intent |
| Add CDX-M1 `source_kind`/`extractor` columns and migration row | folded into the same pre-handle bootstrap; no public migration/reinitialize method |
| Probe writes | ephemeral `:memory:` driver probe; outside the durable matrix |
| Raw `insertMemory` | removed from every returned handle; memory insert exists only as a planned effect |
| Raw `addMemory` | retired; candidate producers use `legacy_proposal` |
| Raw `supersedeMemory` and its private transaction | retired; `legacy_proposal` resolves ordered outer-transaction effects |
| Post-add/post-supersede provenance `UPDATE` | removed; `source_kind` and `extractor` are fields of the insert effect |
| Gate `end_validity` | `legacy_proposal` → `cdx_memory_end_validity` |
| Gate `delete_transient` | `legacy_proposal` → `cdx_memory_delete` |
| Gate `share` | `legacy_proposal` → `cdx_memory_set_shared` |
| Raw `addMemoryLink` | retired as a caller capability; existing links remain readable; supersession link is a planned effect |
| Raw `bumpImportance` | retired; duplicate and inclusion branches may plan `cdx_memory_set_importance` |
| Raw `touchMemory` | retired; inclusion may plan `cdx_memory_touch` |
| Direct single-row deletion | `legacy_delete_memory` |
| Scoped topic-forget loop | one atomic `legacy_forget_topic` plan |
| Recall-inclusion touch/bump loop | one atomic `legacy_record_recall_inclusion` plan |
| Lifecycle decay/delete loop | one atomic `legacy_run_lifecycle` plan |
| FTS insert/delete and link cascade | declared SQLite trigger/FK consequences of insert/delete effects; not callable effects |
| Whole-workspace main/WAL/SHM/rollback-journal deletion | terminal storage-lifecycle operation under path serialization and zero-live-handle precondition; not a SQLite plan |
| `close()` | connection lifecycle; not a durable semantic mutation |
| Exact B1 initialization/apply | unchanged separate substrate owners; outside A2 CDX-M1 routing |

The baseline `memories_au` trigger remains in the schema, but no supported A2
intent/effect changes `content`, `keywords`, or `palari_id` on an existing row.
Raw connection removal makes that latent trigger unreachable from supported
producer handles.

## 4. Closed legacy intent vocabulary

There are exactly five high-level intent kinds:

```text
legacy_proposal
legacy_delete_memory
legacy_forget_topic
legacy_record_recall_inclusion
legacy_run_lifecycle
```

The exact frozen exported array `legacyMutationIntentKinds` contains those
five strings in that order. It is inventory evidence, not an authority table.

After public adapters copy known own values and discard ignored extra keys,
the router's five canonical captured envelopes have exactly these own keys in
the shown order and no symbols:

```text
legacy_proposal
  { intentKind, nativeWallTime, op, policy, producer, proposalKind,
    provenance, record, scope, storeTime, target }
legacy_delete_memory
  { intentKind, actor, id }
legacy_forget_topic
  { intentKind, actor, palariId, query, userId }
legacy_record_recall_inclusion
  { intentKind, actor, bumpAmount, memoryIds, storeTime }
legacy_run_lifecycle
  { intentKind, now, palariId }
```

`policy` is exactly `{demote,promote,permanent,ratify}`; `scope` is exactly
`{palariId,userId}`; and `provenance` is exactly
`{actor,eventAt,extractor,sourceKind,sourceMessageId,writer}`. The proposal
`record` contains exactly these known compatibility inputs in canonical order:

```text
id, palari_id, user_id, type, content, keywords, importance, valid_from,
valid_until, last_accessed, created_at, shared, confidence, acquisition_mode,
fictional, last_decayed_at, source_message_id, content_hash
```

Absent optional captured values are `null`; absent times that a branch cannot
need remain `null`. The one exception is a non-nullish, non-primitive-string
caller `content_hash`: capture retains no caller value/reference and stores
the module-private frozen sentinel `{invalidContentHash:true}` in that field.
The branded capture validator accepts only that sentinel identity, a primitive
string, or `null`. `proposalKind` is the public U4 kind, while `producer` is the
internal discriminator. Public callers never submit this router envelope
directly: base/gate adapters construct it, and the router revalidates its exact
shape and scalar families. Unknown envelope kinds or extra/missing structural
keys are `legacy_invalid_argument`; unknown public proposal kind/op still
returns the compatibility rejection described below.

For `explicit_proposal`, `scope` is always
`{palariId:null,userId:null}` and a caller `scope` field is ignored without
access. For `extraction_candidate`, scope captures
`palariId:String(value ?? '').trim()` but
`userId:String(value ?? '')` **without trimming**, exactly preserving the
baseline contradiction helper's list-scope/user-comparison asymmetry. These
two coercions run once per eligible candidate before coordinator entry and a
throw escapes by identity. The candidate row independently applies its normal
trimmed `palari_id`/`user_id` storage normalization; scope remains heuristic
input only.

### 4.1 `legacy_proposal`

Carries the current U4 compatibility proposal operations:

```text
promote|permanent × add|supersede
demote × end_validity|delete_transient
ratify × share
```

Its captured form also has exactly one internal producer discriminator:
`explicit_proposal` or `extraction_candidate`. That discriminator is not a new
public proposal operation or canonical field. `explicit_proposal` honors the
caller's explicit `add` or `supersede`. `extraction_candidate` performs the
current extraction resolution inside the transaction with exact precedence:

1. contradiction target found → end old validity, insert, supersession link;
2. otherwise duplicate found → importance set; or
3. otherwise → insert.

The extraction producer never chooses a target through a pre-transaction
store read.

Public proposal structural/admission capture is exact. An omitted/`undefined`
proposal defaults to an empty record and returns `invalid_kind`; `null` or a
non-record/Proxy proposal is `legacy_invalid_argument`. Known fields are read
only from own data properties of an ordinary Object/null-prototype record; an
accessor for a known field is rejected without invocation, inherited fields
are absent, and extra string/symbol fields—including accessors—are ignored.
`kind` is used without coercion.
Unknown values—including `toString`, `constructor`, and `__proto__`—return
`invalid_kind` rather than reaching U4's prototype-collision throw. For a
known kind, `op === undefined` becomes `add`; every other value is used without
coercion, so `null` is `invalid_op`. Kind rejection precedes op and nested-
container validation; op rejection precedes it as well.

After kind/op pass, only containers needed by that operation are validated.
`undefined` `record`/`provenance` defaults to an empty record; a needed null,
non-record, Proxy, or known-accessor-bearing container is
`legacy_invalid_argument`. Inherited known fields are simply absent.
Demote/ratify ignore `record`; all explicit
proposals ignore `scope`. Writer and source kind use current raw truthiness
then exact private-set membership: `0|false|''|null|undefined` produces the
applicable `*_required`, while a truthy non-string produces `invalid_*`.
Pipeline `eventAt` and background `extractor` use raw truthiness for their
required reasons, followed only after reason accumulation by the primitive-
string override law in §4.1.1. These structural and prototype-collision
repairs are intentional A2 hardening deltas.

Pure admission failures return the existing
`{outcome:'rejected', reasons:[...]}` shape without opening a transaction.
The exact pre-transaction branches are:

- unknown kind → `invalid_kind`; unsupported operation for a known kind →
  `invalid_op`;
- demote derives `actor = provenance.actor ?? provenance.writer` with exact
  nullish precedence and raw private-set membership: `actor:null` falls back
  to writer, while `actor:''` does not. A missing/unknown derived actor →
  `invalid_actor`; demote performs no confidence-floor check;
- ratify whose writer is not exactly `explicit_user_action` →
  `ratify_requires_user`; current ratify performs no confidence-floor check;
  and
- promote/permanent admission reasons, accumulated in current order: writer
  required/invalid, source kind required/invalid,
  `external_requires_extraction`, `event_time_required`,
  `extractor_required`, `kind_type_mismatch`, then `below_threshold`.

Admission converts `record.confidence` with the captured native `Number`
exactly once at the final reason position; a conversion throw escapes by
identity even when earlier reasons exist. A finite result is reused for both
the threshold and any eventual row; a non-finite result becomes `0.5`.
Current U4 can invoke stateful confidence coercion twice during admission and
again on insert; once-and-reuse is an intentional deterministic A2 delta.

After transaction entry, missing targets reject with `missing_target`, a
permanent `delete_transient` target rejects with `not_transient`, and a
cross-partition supersession rejects with `type_partition_mismatch`.
Database-dependent resolution—target existence/type, duplicate selection,
and the extraction compatibility contradiction target—happens only after the
coordinator owns `BEGIN IMMEDIATE`.

After the pure admission branches above pass, every target-consuming explicit
proposal (`supersede`, `end_validity`, `delete_transient`, or `share`) captures
target exactly as `String(target ?? '').trim()` before any clock or coordinator
entry. A coercion throw escapes by identity; an empty result is looked up and
therefore resolves `missing_target` inside the transaction. Add and
`extraction_candidate` captures use `target:null`; extraction derives any
contradiction target only from transaction-time rows. This trimmed-string
target rule intentionally retires raw SQLite binding-type behavior for padded
strings, numbers/BigInts, buffers, and arbitrary objects; it is compatibility
normalization, not authenticated ownership.

One compatibility-validated `explicit_proposal` add resolves to either one
insert effect or one importance effect for the chosen duplicate. A
compatibility-validated explicit supersede resolves in exact order to
end old validity, insert the new row, then insert the `supersedes` link.
Provenance is part of the inserted row. A target-based rejection may commit an
empty transaction but exposes no result before that commit.

The extracted contradiction heuristic remains compatibility behavior, not a
canonical supersession rule. It considers current rows in the same Palari and
type that belong to the same user, are general, or are shared. For explicit
contradiction phrasing, candidates require trigram similarity `>=0.35` and
order by similarity descending, importance descending, creation time
descending, then binary ID ascending. If that finds none and the new type is
`preference`, current non-transient-detail rows require positive topic overlap
and similarity `<0.85`; they order by `(topic overlap + similarity)`
descending, importance descending, creation time descending, then binary ID
ascending. Duplicate resolution then considers every current row in the same
Palari and type, without user scope, uses the fixed supported-gate
compatibility threshold `0.85`, and orders by similarity descending,
importance descending, creation time descending, then binary ID ascending.
The retired raw `similarityThreshold` option does not become an A2 proposal
field.

Supersession captures one store-clock time: old `valid_until` and link
`created_at` use it. New `created_at` preserves
`record.created_at ?? storeTime`; new `valid_from` preserves
`record.valid_from ?? provenance.eventAt ?? storeTime`. Those caller/store/
evidence-time distinctions are M2-B map-or-refuse flags.
End-validity preserves the current gate's distinct clock law:
`provenance.eventAt ?? nativeWallTime`. When event time is absent, capture
samples one module-captured native `Date` outside the transaction; it does not
invoke the configured caller store clock.

The store clock is compatibility input, not trusted transaction code. After
all pure validation and caller-value conversion for an admitted intent,
`capture` invokes the caller-supplied store clock, when needed, exactly once
**before** calling the coordinator and converts its output to the baseline ISO
form. It rechecks that the store is still live afterward. The unavoidable
call-count delta is explicit: every admitted explicit add, explicit
supersession, or extraction candidate pre-samples a store time even if its
later database-dependent branch is duplicate, missing-target, or rejected;
an end-validity proposal instead pre-samples native wall time only when
`eventAt` is absent. No pure admission rejection calls the caller clock. A
blank memory ID has no injectable ID callback: resolution uses only the
module-evaluation-captured native `randomUUID`, and a supersession-link ID is
then derived from the normalized memory IDs. No caller function, accessor,
coercion hook, or other caller code runs after transaction entry.

#### 4.1.1 Exact compatibility row normalization

The proposal planner copies the baseline field precedence rather than
inventing a generic object spread. For an insert-capable branch it first forms
the compatibility base record as follows:

1. `acquisition_mode` is caller `record.acquisition_mode` when non-nullish;
   otherwise writer maps `session_summary → summarized`,
   `background_extraction → extracted`, and `explicit_user_action → direct`;
2. `created_by_pipeline` is derived solely as numeric
   `writer !== 'explicit_user_action'`; any caller field of that name is
   ignored;
3. for add, `source_message_id` is
   `record.source_message_id ?? provenance.sourceMessageId ?? null`; for
   supersession it is only `record.source_message_id ?? null`, because the
   baseline supersession path does not apply the write-option fallback;
4. `valid_from` is
   `record.valid_from ?? provenance.eventAt ?? storeTime`;
5. for add whose `sourceKind !== 'user_message'`, the one marker
   `source:<sourceKind>` is appended after the caller keyword value by exactly
   `[record.keywords, marker].flat().filter(Boolean)`: one array level is
   flattened and truthiness is filtered **before** string conversion, exactly
   as baseline. User-message add input has no prefilter/marker step, and
   supersession never applies it; and
6. only supersession fills nullish `palari_id` and `user_id` from the
   pre-update target row. An explicit add has no such fallback. Supersession
   does **not** reach the raw store's latent nullish-type fallback: current U4
   admission rejects a nullish/unknown `record.type` as `kind_type_mismatch`
   before target lookup, so the admitted supplied type is preserved and then
   checked against the target partition in-transaction.

It then materializes the exact 22-key row in §5 with these rules:

| Column | Exact value law |
|---|---|
| `id` | `String(record.id ?? '').trim()` when nonempty; otherwise `mem_` plus one module-captured native UUID, generated only after the insert/supersede branch is chosen |
| `palari_id` | `String(value ?? '').trim()`; empty throws baseline `Memory palari_id is required.` |
| `user_id` | trimmed `String` or `null` |
| `type` | exact admitted primitive supplied string; current U4 partition admission uses raw set membership, so padded/non-string/nullish/empty/unknown values already produced `kind_type_mismatch`; the later trim is therefore a no-op |
| `content` | trimmed `String`; empty throws baseline `Memory content is required.` |
| `keywords` | after the branch-specific step 5, array entries are converted to trimmed strings, empty converted strings are removed, and the rest join with one space; a scalar is trimmed `String`; thus external add drops raw falsy `0|false|null|undefined` before conversion while user-message add and supersession preserve their non-null scalar string forms |
| `importance` | finite `Number(value)` or `0.5`; not clamped on insert |
| `valid_from` | exact non-nullish caller/event string selected above, otherwise captured store-time ISO string |
| `valid_until` | trimmed `String` or `null` |
| `access_count` | numeric `0`; caller input is ignored |
| `last_accessed` | trimmed `String` or `null` |
| `created_at` | exact caller `record.created_at` string when non-nullish, otherwise captured store-time ISO string |
| `shared` | caller truthiness converted to numeric `0|1` |
| `confidence` | finite `Number(value)` or `0.5`; not clamped on insert |
| `acquisition_mode` | trimmed derived/caller string, default `direct`, then exact private acquisition-set validation with baseline message |
| `created_by_pipeline` | writer-derived numeric `0|1` from step 2 |
| `fictional` | caller truthiness converted to numeric `0|1` |
| `last_decayed_at` | trimmed `String` or `null` |
| `source_message_id` | trimmed `String` or `null` after the add/supersede branch law in step 3 |
| `content_hash` | exact supplied string when `record.content_hash` is non-nullish; otherwise computed as below |
| `source_kind` | exact admitted `provenance.sourceKind` string |
| `extractor` | exact supplied provenance string or `null` |

After pure admission passes, capture eagerly detaches and normalizes all named
row/provenance inputs in the §4 record-key order, then the normalized target,
then any required clock. Every named `String`/`Number` conversion occurs once
and its result is reused. Caller coercion throws escape by identity before
`BEGIN`; mutable caller values are never retained. This intentionally means a
stateful or throwing insert-only ID, keyword, importance, acquisition,
timestamp, or source-field conversion is observed even if transaction-time
resolution later chooses duplicate/missing-target. Semantic validation that
baseline skips on duplicate remains branch-deferred for the required nonempty
content check, acquisition-set membership, and the supplied-hash sentinel;
blank-ID UUID generation remains branch-deferred as well.

The supported replacement surface requires non-nullish `created_at`,
`valid_from`, `eventAt`, and `extractor` override values to be primitive
strings during capture. A non-nullish supplied `content_hash` must likewise be
a primitive string, but that requirement is branch-deferred through the safe
sentinel above: duplicate resolution ignores it exactly as baseline, while a
selected insert/supersede branch throws `legacy_invalid_argument` before ID/
hash materialization or DML. This makes historically unnormalized SQLite TEXT
outcomes explicit; exotic raw binding values are retired with the raw factory
rather than silently stringified. Other named `String` conversions and
truthiness/number conversions happen during capture, before the live-state
recheck and transaction. Ignored extra/caller-derived fields cannot reach the
row.

When no caller hash is supplied, `content_hash` is lowercase hexadecimal
SHA-256 over UTF-8 bytes of exactly
`[palari_id, user_id ?? '', type, content, keywords].join('\u001f')`, using
the normalized values above and captured native hash dispatch. A supplied hash
is intentionally neither recomputed nor checked in A2; supplied/computed and
matching/mismatching classes remain explicit M2-B obligations.

Duplicate selection consumes only captured same-Palari/type/content values;
the eager detachment conversions above do not make other fields part of its
comparison. A duplicate branch does not generate an ID or validate insert-
only nonempty content, acquisition, or hash requirements, including the
captured invalid-hash sentinel. Thus a valid-schema existing row whose content
is the empty string can duplicate-bump an empty candidate without throwing
`Memory content is required.`; a selected insert/supersede instead performs
that validation before DML. The duplicate branch sets
`min(1,max(0,Number(existing.importance ?? 0)+0.05))`. Full row validation and
hash/ID materialization occur only after insert or supersession is selected.
A supersession link is exactly
`{id:'link_<newId>_<oldId>_supersedes',from_memory_id:newId,
to_memory_id:oldId,relation:'supersedes',created_at:storeTime}` in the §5 link
key order. This preserves the current possibility of a caller-supplied
cross-Palari replacement/link; it is a named M2-B map-or-refuse defect, not an
A2 authorization.

### 4.2 `legacy_delete_memory`

Capture first normalizes actor exactly as
`String(options.actor ?? 'explicit_user_action').trim()` and private-set
validates it, then computes `id = String(value ?? '').trim()`; a conversion
throw at either position escapes by identity. Invalid actor therefore wins
before ID conversion and target absence. Empty ID resolves `not_found`. The
route preserves the current result shape and permanent-type protection
behavior. Target lookup and the delete decision occur inside the owned
transaction. It has no authenticated scope claim.

### 4.3 `legacy_forget_topic`

Capture first normalizes and validates actor exactly as
`String(options.actor ?? 'explicit_user_action').trim()`, then converts query,
Palari, and user in that order to
`String(topicQuery ?? '').trim()`, `String(scope.palariId ?? '').trim()`, and
`String(scope.userId ?? '').trim()`. A conversion throw escapes at its exact
position. Actor validation precedes even these scope conversions, the empty-
input branch, and database reads; unlike the baseline empty-match edge, an
invalid actor is therefore rejected even when the query/Palari is empty or no
row matches. This is an intentional eager-validation delta. An empty trimmed
query or Palari produces `{count:0, deleted:[]}` without a coordinator run. A
nonempty query is bound directly to FTS5 `MATCH ?`, exactly as the baseline
`searchMemories` topic path did; it is not converted through
`extractMemoryQueryKeywords`. Native malformed-FTS-query failure therefore
occurs during in-transaction resolution and escapes only after A1 rolls back
the empty transaction.
Resolution selects one snapshot of all visible FTS matches after
`BEGIN IMMEDIATE`, normalizes the target set, and orders actual deletions by
binary memory ID. Only IDs whose delete effect will land appear in the public
`deleted` array; `count === deleted.length`. The call cannot loop forever on a
protected row and cannot expose a partially deleted topic.

This intentional A2 compatibility correction replaces the baseline's
batch-of-100 search/delete loop, which could partially commit, falsely report
protected IDs, or repeat a full protected batch indefinitely.

### 4.4 `legacy_record_recall_inclusion`

Carries memory IDs, actor exactly normalized as
`String(options.actor ?? 'lifecycle_job').trim()`, and bump amount. Actor is
private-set validated first. Bump is then converted once with captured native
`Number`; a finite result is used, while non-finite becomes `0.05` (`null`
therefore becomes `0`), and a conversion throw escapes by identity. IDs are
then treated as the supplied array or one wrapped scalar, converted with
`String(id ?? '').trim()`, filtered to nonempty, and deduplicated in first-
occurrence order. Actor → bump → IDs is exact caller-coercion precedence. An
empty normalized list returns the empty result without a clock or coordinator
run. A nonempty list then invokes the store clock exactly once, normalizes its
ISO output, and rechecks liveness; that one timestamp is used even if every ID
is later absent. Each resulting importance is clamped to `[0,1]`. Resolution
validates every target before effects: if any existing row has
`access_count === Number.MAX_SAFE_INTEGER`, it throws native `RangeError` with
exact message `Memory access_count cannot be incremented safely.` and the
whole call rolls back without DML. For every other existing ID, effects occur
as touch then importance set; missing IDs have no effect. Touch SQL itself
also requires `access_count < Number.MAX_SAFE_INTEGER`, so direct-child misuse
lands as `legacy_effect_cardinality` rather than an unsafe integer. The result
retains `{touched, touchedCount}` and the whole list is atomic.

### 4.5 `legacy_run_lifecycle`

Capture first computes `palariId = String(value ?? '').trim()`. Only after
that coercion succeeds, `now === undefined` invokes the store clock exactly
once; every explicit value, including `null`, invokes no clock. Captured native
Date construction/get-time/to-ISO dispatch converts that value to one ISO
string and finite millisecond value. Caller conversion throws escape by
identity; an invalid date throws native `RangeError` with exact message
`Invalid time value` before coordinator entry. The store is rechecked after
this complete capture. Thus a throwing Palari coercion calls no default clock,
an intentional canonical A2 capture-order delta.

Resolution scope preserves the baseline asymmetry exactly: a nonempty captured
Palari reads only rows with that exact `palari_id`, while an empty captured
Palari applies no Palari predicate and sweeps current transient rows across
every Palari. The empty-scope branch is unsafe compatibility behavior and an
explicit M2-B map-or-refuse obligation, not ambient authority. The selected
rows are ordered by `created_at`, then binary `id`. For each row,
`reference = last_decayed_at ?? created_at`; captured
`Date.parse(reference)` failure yields exactly `365` age days, otherwise age
days is `max(0,(nowMs-referenceMs)/86400000)`. Windows is
`floor(ageDays/14)`. Zero windows increments `skipped`; otherwise
`nextImportance = max(0,Number(importance ?? 0) - 0.1*windows)`, and
`<=0.1` plans delete while a larger value plans decay with the one captured
ISO timestamp. The current invalid-reference fallback, future-time clamp,
14-day window, 0.1 decay, and delete threshold remain compatibility behavior
and explicitly non-canonical. The summary retains
`{decayed, deleted, skipped, touched}` and the whole sweep is atomic.

### 4.6 Exact compatibility result branches

The planners preserve these public result families:

| Route branch | Result |
|---|---|
| proposal rejected | `{outcome:'rejected', reasons:[exact codes...]}` |
| add inserted | `{memory, outcome:'inserted', reasons:[]}` |
| add duplicate | `{memory, outcome:'duplicate_bumped', similarity, reasons:[]}` |
| explicit/extracted supersession | `{link, memory, outcome:'superseded', reasons:[], superseded}` |
| end-validity demotion | `{memory, outcome:'demoted', reasons:[]}` |
| transient-delete demotion | `{deletedId, outcome:'demoted', reasons:[]}` |
| share | `{memory, outcome:'ratified', reasons:[]}` |
| direct target absent | `{deleted:false, reason:'not_found'}` |
| protected permanent direct delete | `{deleted:false, memory, reason:'permanent_type_protected'}` |
| successful direct delete | `{deleted:true, memory, reason:'deleted'}` |
| topic forget | `{count, deleted}` with `count === deleted.length` |
| recall inclusion | `{touched, touchedCount}` with `touchedCount === touched.length` |
| lifecycle | `{decayed, deleted, skipped, touched}` with `touched === decayed + deleted` |

The braces above are exact own-key order; duplicate add's
`{memory,outcome,similarity,reasons}` preserves the baseline spread order.
Every touched entry is exactly `{id,importance}`. Reasons, deleted IDs,
touched entries, nested links/memories, and the top-level record are fresh
ordinary mutable arrays/objects with no symbols, accessors, prototype brands,
or shared plan references; primitive fields have the types implied above and
counts are nonnegative safe integers. Rejected `reasons` preserves the exact
listed order. The disabled result families use the exact shapes in §7.3.

Enabled/disabled base and gated `close()` are synchronous, receiver-
independent, idempotent, and return `undefined`. Manager `close()` and
`forWorkspace()` are asynchronous as specified in §7.4. Successful
`deleteKernelStoreFile()` resolves to the fresh exact record
`{dbPath,removed:true}` in that key order; a failed removal returns no result.

Actor normalization failures retain the baseline unsupported-actor error
message family and happen during capture for delete, topic, and inclusion.
Invalid lifecycle time retains native invalid-date failure before DML. Native
row/link constraints remain apply failures governed by A1 rollback precedence.

## 5. Closed projection-effect vocabulary

There are exactly eight effect kinds:

```text
cdx_memory_insert
cdx_memory_end_validity
cdx_memory_set_shared
cdx_memory_set_importance
cdx_memory_touch
cdx_memory_decay
cdx_memory_delete
cdx_link_insert
```

The exact frozen exported array `legacyMutationEffectKinds` contains those
eight strings in that order. No other supported production path invokes
semantic CDX DML. Effects mean:

| Effect | Exact CDX action |
|---|---|
| `cdx_memory_insert` | insert one fully normalized CDX-M1 memory row, including `source_kind` and `extractor`; FTS insert follows by trigger |
| `cdx_memory_end_validity` | set `valid_until` for one memory ID |
| `cdx_memory_set_shared` | set `shared=1` for one memory ID |
| `cdx_memory_set_importance` | set one already-clamped importance value |
| `cdx_memory_touch` | increment one sub-`MAX_SAFE_INTEGER` `access_count` and set one captured `last_accessed` |
| `cdx_memory_decay` | set importance and `last_decayed_at` together |
| `cdx_memory_delete` | delete one memory row; FTS trigger and link FK cascades follow |
| `cdx_link_insert` | insert one fully normalized link row |

Each effect is a frozen ordinary record with the following exact own-key set;
`kind` is always the first key shown:

```text
cdx_memory_insert          { kind, row }
cdx_memory_end_validity    { kind, id, validUntil }
cdx_memory_set_shared      { kind, id }
cdx_memory_set_importance  { kind, id, importance }
cdx_memory_touch           { kind, id, lastAccessed }
cdx_memory_decay           { kind, id, importance, lastDecayedAt }
cdx_memory_delete          { kind, id }
cdx_link_insert            { kind, link }
```

An insert `row` and every plain memory nested in an A2 mutation result have
exactly these 22 own string keys in this order and no symbol keys:

```text
id
palari_id
user_id
type
content
keywords
importance
valid_from
valid_until
access_count
last_accessed
created_at
shared
confidence
acquisition_mode
created_by_pipeline
fictional
last_decayed_at
source_message_id
content_hash
source_kind
extractor
```

`id`, `palari_id`, `type`, `content`, `keywords`, `valid_from`, `created_at`,
`acquisition_mode`, and `content_hash` are strings; `user_id`, `valid_until`,
`last_accessed`, `last_decayed_at`, `source_message_id`, `source_kind`, and
`extractor` are string or `null`; `importance` and `confidence` are finite
numbers; `access_count` is a nonnegative safe integer; and `shared`,
`created_by_pipeline`, and `fictional` are numeric `0|1`. An inserted row has
`access_count:0`. Mutation resolver reads always project this explicit order
rather than relying on physical `SELECT *` column order. The `superseded` value is
the complete pre-update target row; delete results likewise carry the
complete pre-delete row. A public inserted/updated `memory` is the exact
post-effect row projected in the plan, then independently deep-copied after
commit.

This shape law does not flatten the established read surfaces:
`searchMemories` and `recallMemories` retain their documented rank/path/
activation metadata and explicit read-result shapes. Their underlying CDX
columns are nevertheless read through explicit projections rather than
physical `SELECT *` order.

A link has exactly `id`, `from_memory_id`, `to_memory_id`, `relation`, and
`created_at`, in that order, all strings. Plan/effect-side nested records are
ordinary, deeply frozen, and contain primitive values only; their post-commit
public copies follow the fresh mutable-result law in §4.6.

Every effect is transaction-neutral. Its child applier calls
`assertActiveMutationLease(lease, db)` before semantic DML. It contains no
`BEGIN`, `COMMIT`, `ROLLBACK`, savepoint, retry, close, PRAGMA, schema, clock,
randomness, policy, target-selection, or result-classification logic.
Every `StatementSync.run()` result must report numeric `changes === 1` for
each of the eight effects, including insert and link insert. Zero, multiple,
non-numeric, or otherwise unexpected cardinality throws
`legacy_effect_cardinality`; A1 then rolls back the entire plan before the
error escapes. Schema verification and this check are both required—the
cardinality check is not waived merely because a target was read earlier.

Every resolver/effect statement qualifies storage objects as
`main.memories`, `main.memory_links`, and `main.memory_fts`; the FTS `MATCH`
operand uses the table token required by SQLite but its `FROM` is explicitly
`main.memory_fts`. Direct child application therefore cannot be redirected by
a TEMP table/view shadow. Bootstrap DDL explicitly creates in `main`; the
three exact persisted main triggers use SQLite's required same-schema
unqualified body references and are protected by the complete main/TEMP
trigger oracle.

## 6. Ephemeral plan law

A plan is module-private, branded, deeply frozen execution data with this
conceptual exact record:

```js
{
  version: 'CDX-M1-legacy-plan@1',
  intentKind,
  outcome,
  effects,
  result,
}
```

Callers cannot construct or submit a plan. A plan:

- is bound to the exact active lease and database under which it resolved;
- can be applied exactly once, during that lease's callback;
- contains no SQL, function, connection, lease, mutable caller reference, or
  claimed authority;
- contains a complete ordered effect list and public result before the first
  DML; and
- becomes stale when its lease retires, whether or not apply ran.

`outcome` is exactly one of `rejected`, `inserted`, `duplicate_bumped`,
`superseded`, `demoted`, `ratified`, `deleted`, `not_found`,
`permanent_type_protected`, `topic_forgotten`, `recall_recorded`, or
`lifecycle_ran`; it classifies the compatibility branch only and is not a
governance decision.

`capture(intent)` copies, validates, brands, and freezes compatibility input
before transaction entry, including any required caller-clock output.
`resolve(lease, capturedIntent)` accepts only that
captured form and performs captured-dispatch reads and deterministic
normalization only. `apply(lease, plan)`
performs the effect list only. `execute(intent)` captures the intent, opens one
coordinator run, resolves, applies, and returns the
planned result after commit. The returned public result is a fresh deep copy,
not the plan's frozen `result` object or its brand. The internal router object
is frozen and has exactly the own keys
`['apply', 'capture', 'execute', 'resolve']`; it is held in module-private
store state and is never placed on a returned handle.

Determinism means that a captured intent, post-`BEGIN IMMEDIATE` transaction
snapshot, immutable policy snapshot, pre-transaction clock output, and any
module-captured native-random ID output yield one exact plan. Specifically:

- caller inputs are copied to primitive/array/ordinary-record data before
  transaction entry;
- caller coercions, policy reads, caller-clock calls, and required native-wall-
  time samples happen before transaction entry, followed by a live-store
  recheck;
- database-dependent choices and any necessary captured-native `randomUUID`
  call happen after transaction entry;
- every timestamp, generated ID, normalized row, content hash, similarity,
  and target set is materialized in the plan before DML;
- duplicate candidate ordering is similarity descending, importance
  descending, creation time descending, then binary ID ascending;
- topic deletions use binary ID ascending;
- recall IDs use first-occurrence order, touch before importance per ID;
- lifecycle uses creation time ascending, then binary ID ascending; and
- apply performs no fresh read, clock call, ID generation, policy decision,
  or target selection.

All native SQLite dispatch used by bootstrap, reads, and effects is captured
at module evaluation: `DatabaseSync` construction and native `exec`, `close`,
and open-state access; `DatabaseSync.prototype.prepare`; and
`StatementSync.prototype.get`, `all`, `run`, `setReadBigInts`, and
`setReturnArrays`. Every prepared statement is forced to number bigint mode
and object row mode before dispatch. Required `Reflect`, descriptor,
collection, string/number/date, hash, path, clock, and performance primordials
are likewise captured. Resolver reads do not use live instance/prototype
properties, iterator methods, or row accessors. Returned native rows are
copied through captured own-data descriptors into the exact ordinary shapes
before any comparison or exposure. Pre-import instrumentation and post-import
tampering tests cover both read and write dispatch.

Multi-candidate extraction, multi-turn ingest, and multiple scheduled turns
remain ordered sequences of separate proposal intents. A later candidate or
turn failure does not retroactively roll back an earlier committed intent.
That boundary is explicit; each candidate decision, not an entire provider
response or benchmark history, is the A2 semantic call.

## 7. Module and handle surfaces

### 7.1 Internal router module

`src/legacy-mutation-router.mjs` exports exactly:

```js
export class LegacyMutationError
export const legacyMutationEffectKinds
export const legacyMutationIntentKinds
export function applyLegacyMutationEffectInTransaction(lease, db, effect)
export function createLegacyMutationRouter(db, options = {})
```

`options` is captured trap-free at construction, accepts only an optional
`clock` function, and is not retained by reference. The router module itself
owns every intent capture, compatibility normalization, resolver query,
branch comparator, plan/result projection, and effect-list builder; it never
invokes a supplied resolver or planner callback. `capture(intent)` runs before
transaction entry and returns a branded deeply frozen primitive/array/
ordinary-record capture. `resolve(lease, capturedIntent)` runs only inside the
router's coordinator callback, asserts the exact active lease before database
reads, and produces the branded deeply frozen plan directly. Neither method
may issue semantic DML, transaction control, schema SQL, PRAGMAs, or expose
the database. The stored caller clock may be invoked by `capture` only; no
caller-supplied function is reachable from `resolve` or `apply`.

The direct effect applier is an internal trusted-child surface for the A1
composition falsifier and later reviewed composition. It still requires an
active exact-connection lease. Production imports are statically allowlisted;
no producer may call it to bypass intent resolution.

The internal `src/kernel-store-runtime.mjs` namespace is also exact:

```text
acquisitionModes
assertKernelStoreCapability
createKernelStoreRuntime
deleteKernelStoreRuntimeFile
executeLegacyStoreIntent
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

`assertKernelStoreCapability` and `executeLegacyStoreIntent` are branded
internal capabilities, not public handle methods. Their production import
sites are exact: gate may import both; store may import creation/deletion and
the public compatibility values; extraction may import only the similarity
helper. No other production module imports an internal capability. Calling
`executeLegacyStoreIntent` still reaches the exact five-intent router and
cannot issue a raw effect or expose private state.
The runtime's only B1 production import is the three immutable schema-only
values named in §8.1; it neither imports a B1 owner/apply/verifier nor reads B1
data.

### 7.2 Base store handle

An enabled or disabled `createKernelStore()` result is a module-branded,
frozen ordinary object with exactly these own string keys and no symbol keys:

```text
close
config
dbPath
enabled
getMemoryById
listMemories
publicStatus
recallMemories
searchMemories
status
```

It exposes no database, schema method, transaction method, coordinator,
router, lease, plan, effect applier, or mutation method.

`getMemoryById` returns `null` or one fresh ordinary canonical 22-key §5 row;
`listMemories` returns fresh rows of that shape. `searchMemories` preserves the
baseline's exact narrower row keys/order:

```text
id, palari_id, user_id, type, content, keywords, importance, valid_from,
valid_until, access_count, last_accessed, created_at, shared, confidence,
acquisition_mode, created_by_pipeline, fictional, source_message_id,
content_hash, rank
```

`rank` is a finite number. `recallMemories` returns exactly
`{directCount,keywords,latencyMs,memories,totalCandidates}`. Each recall
`memories` entry has the canonical 22 CDX keys followed by exactly
`rank,rpath,via_memory_id,via_relation,activationScore`; `rank` is finite
number or `null`, `rpath` is a string, the two `via_*` values are string or
`null`, and `activationScore` is finite number. Counts are nonnegative safe
integers, keywords are strings, and latency is a finite nonnegative number.
All read arrays/records are fresh ordinary mutable values and never expose a
native row object; explicit projection preserves these shapes across the three
physical schema histories.

Recall-time normalization makes the finite activation claim real. Empty
trimmed Palari scope returns the empty result before inspecting `now`. For a
nonempty Palari, omitted/`undefined` `now` samples module-captured native wall
time once; an explicit value (including `null`) is converted once with captured
native Date dispatch. A caller conversion throw escapes by identity. A
non-finite time throws native `RangeError` with exact message
`Invalid time value` before SQLite reads; this deterministic rejection is an
intentional A2 repair of the baseline `activationScore:NaN` edge. For each
row, activation age uses `last_accessed ?? created_at`; invalid row timestamp
means `365` days, otherwise
`max(0,(nowMs-referenceMs)/86400000)`. Score is exactly
`Number(importance) + 1/(1+ageDays) + min(0.2,Number(access_count)/100)`, which
is finite under the bootstrap data oracle.

### 7.3 Gated handle

The A2 `src/gate.mjs` namespace is exactly:

```text
admissionPolicyDefaults
assertGatedStoreCapability
createAdmissionPolicy
createGatedStore
createMemoryGate
proposeExtractedMemoryCandidate
```

The assertion and extracted-candidate function are internal, statically
allowlisted capabilities; they expose no raw store, router, plan, lease, or
effect. `applyKernelMigrations` is removed because migration is pre-handle
bootstrap.

`proposeExtractedMemoryCandidate(gated, {provenance, record, scope})` requires
the active gated brand, derives promote/permanent kind from the private type
snapshot, runs the same candidate admission as an add, and submits the
`extraction_candidate` discriminator. `scope` is the captured
`{palariId,userId}` used only by the legacy contradiction heuristic; it is not
authority.

`createGatedStore(base, options)` accepts only the exact active branded base
handle. It returns a branded, frozen ordinary object with exactly the current
supported keys and no symbol keys:

```text
close
config
dbPath
deleteMemory
enabled
getMemoryById
listMemories
propose
publicStatus
recallMemories
recordRecallInclusion
runLifecycleJobs
searchMemories
status
topicForget
```

All five mutation-facing methods are adapters to the five intent kinds;
`propose` covers the proposal vocabulary. A disabled gated handle has the same
shape, performs no database work, and returns deterministic disabled/empty
results rather than failing through an incomplete duck type.

An unknown, duck-typed, Proxy, wrong-kind, or unbranded base/gated capability
is rejected with `legacy_invalid_capability` before caller getters or database
work.

`createMemoryGate` accepts only a branded base handle, validates and captures
every policy through `createAdmissionPolicy`, and returns a frozen gate. A
caller-supplied mutable policy object or later mutation cannot change an
existing gate.

`createAdmissionPolicy(overrides)` is exact. `undefined|null` means no
overrides. Any other input must have `typeof overrides === 'object'`, be
non-null, and not be a Proxy; primitives and functions therefore fail
trap-free with `legacy_invalid_argument`, while arrays and other non-Proxy
objects are accepted and inspected only by the property law below. Only
enumerable own string properties named
`demote`, `promote`, `permanent`, and `ratify` participate; inherited,
non-enumerable, extra-string, and symbol properties are ignored and their
getters are not invoked. Participating values are read exactly once in that
canonical order (an own accessor may therefore run caller code during policy
construction), converted exactly once with the module-captured native
`Number`, and snapshotted. A conversion throw escapes by identity. Missing
keys use defaults; an own enumerable `undefined` converts to `NaN` rather than
acting missing; `null`, booleans, numeric strings, and BigInts follow native
`Number` conversion. All four results must be finite primitive numbers and
must satisfy `demote < promote < permanent < ratify`; otherwise construction
throws one native `Error` with exact message
`Admission thresholds must keep order demote < promote < permanent < ratify.`.
No `[0,1]` bound is added. This canonical numeric four-key snapshot, including
finite-value rejection and ignored extras, is an intentional A2 surface-
hardening delta from U4's raw object spread.

The exact gate object has own keys `['policy', 'propose']`, no symbol keys, and
is branded/frozen. Its policy is a fresh frozen four-number record. A disabled
gate has the same shape and `propose` returns
`{outcome:'rejected', reasons:['memory_disabled']}` without opening SQLite. An
enabled gate becomes stale when its base closes; later `propose` calls fail
with code `legacy_store_closed` before input inspection or database work.

### 7.4 Manager, producers, and capabilities

`createWorkspaceMemoryManager()` returns a branded/frozen object with exact
own keys `['close', 'config', 'forWorkspace', 'publicStatus']` and no symbol
keys. `forWorkspace()` returns and caches the gated handle, never the dormant
extraction evidence or base handle. Its cache entry is a private state record
containing the one in-flight creation promise or live handle: concurrent calls
for the same normalized workspace share one creation and resolve to the same
object identity. If a caller closes a cached handle, the next
`forWorkspace()` creates and caches a fresh handle.

Manager state is exactly `open → closing → closed`. `close()` changes to
`closing` synchronously before its first await, is idempotent, awaits every
in-flight creation, closes/revokes any handle that creation produced, closes
all cached handles, clears the cache, and only then becomes `closed`.
`forWorkspace()` called in `closing` or `closed` fails with
`legacy_manager_closed`. The race linearizes at either successful publication
of a created gated handle while state is still `open`, or the synchronous
transition to `closing`, whichever occurs first. Publication installs the
handle in the cache and resolves the shared creation flight as one synchronous
step. If publication wins, the handle may escape and the later close revokes
it normally. If `closing` wins, no new handle is published or exposed.

A creation that rejects after `closing` began still rejects every flight
waiter with that original creation failure by identity and removes its cache
entry; because it produced no resource, that failure alone does not reject the
manager's close promise. A creation that succeeds after `closing` began is
immediately revoked and closed before its waiters settle. Successful late
close makes every waiter reject `legacy_manager_closed` and contributes no
close failure. Failed late close makes every waiter reject that native close
failure by identity, leaves the canonical path counted blocked, and contributes
the same failure object to manager-close failure ordering. Same-path
create/close/file-delete operations are serialized.

The first `close()` installs one shared close promise; concurrent/repeated
callers observe that same settlement. It attempts every cache/in-flight close
in binary normalized-workspace order even if one fails. One native close
failure is rethrown by identity; multiple failures produce a native
`AggregateError` whose `errors` preserve that order. The manager becomes
closed/revoked after all attempts, while any close-failed connection remains
counted as a blocked live path. Successful repeated close is therefore
idempotent, and a failed close can never enable deletion.

The supported `src/store.mjs` namespace remains exactly the existing 15 names:
`acquisitionModes`, `createKernelStore`, `createWorkspaceMemoryManager`,
`deleteKernelStoreFile`, `externalMemorySourceKinds`,
`extractMemoryQueryKeywords`, `memoryAddWriters`, `memoryFtsTokenizer`,
`memoryMutationActors`, `memoryStoreSchemaVersion`, `memoryTypes`,
`permanentMemoryTypes`, `probeMemorySqliteDriver`, `transientMemoryTypes`, and
`workspaceMemoryDbPath`.

The verified extracted `src/memory-store.mjs` baseline remains byte-identical
to `1d65bb0` and is dormant extraction evidence only. **No production module
imports it.** Its historical raw factory cannot satisfy A2 cleanup: it opens a
native connection and bootstraps before returning, so a bootstrap throw can
hide the still-open connection from any wrapper. A2 therefore does not call,
wrap, or re-export that factory.

`src/kernel-store-runtime.mjs` instead owns captured-native `DatabaseSync`
construction, bootstrap, manifest verification, all supported reads, the A1
coordinator/router, connection cleanup, and canonical-path registry directly.
It copies only the required CDX-M1 schema/config/read/normalization behavior;
it has no raw-store object. On every failure after native construction and
before handle return, it invokes the captured native close exactly once before
releasing the path operation. If close fails or the captured open-state getter
does not prove `false`, that canonical path remains process-locally blocked as
open, so no later supported create or delete can race the untracked handle.

The new runtime and compatibility resolver/applier record the exact upstream
source path `apps/palari-local-workbench/scripts/workspace-backend/memory-store.mjs`,
source commit `190a4ad2f8d5187f5f21222048dd11efb2ad9991`, upstream blob
`4f67d0fe96dd`, the local severed extraction at `1d65bb0` (Git blob
`64e647232facc8682c86386cf9d98770193416e2`), every copied function/schema
fragment, and each intentional A2 delta. Moved contradiction/topic helpers
also record upstream `memory-extraction.mjs` blob `d8367ceb900c` at source
commit `190a4ad2f8d5187f5f21222048dd11efb2ad9991` and local pre-A2 blob
`eb8336ca92d8add299a5b89e1dffe81b153a3f71`. Because A2 changes that local
extraction file, its header must stop claiming post-severance verbatim status
and identify the exact moved/replaced regions plus this contract. Keeping
dormant baseline DML for provenance does not make it a supported route; static
import and call-graph tests prove the file is unreachable from every production
entry point. The raw connection, schema initializer, router, lease, plan, and
child applier are not returned or re-exported from the supported
`src/store.mjs` boundary.

`createGatedStore`, extraction, session summary, scheduler, recall, and adapter
paths reject duck-typed or spoofed stores. They use module-private brands or
internal brand assertions. The adapter's store-shaped add/supersede shim is
removed. Extraction and summary submit proposals through the exact branded
capability; the scheduler obtains that capability from the safe manager.

The replacement producer signatures and provenance law are exact:

- `runMemoryExtractionPass({extractor, extractorId, logger, store, turn})`
  requires a branded gated `store`. After disabled and missing-extractor
  checks, a missing/invalid `turn.eventAt` returns
  `{memoriesWritten:0, reason:'event_time_missing', status:'dropped'}` and a
  missing/blank `extractorId` returns the analogous
  `reason:'extractor_id_missing'`, before invoking the extractor. Each eligible
  candidate carries that event time, extractor ID, source kind/message, and
  background-extraction writer through the internal
  `extraction_candidate` proposal discriminator. Disabled/missing/drop results
  have exact key order `{memoriesWritten,reason,status}`. A completed pass is
  exactly `{memoriesWritten,outcomes,sourceBoundary,status}`. Candidate order
  determines `outcomes`; its closed values are `dropped_transient_detail`,
  `dropped_source_boundary`, `inserted`, `duplicate_bumped`, `superseded`, and
  `rejected`. Insert/supersede increment `memoriesWritten`; duplicate/drop/
  rejection do not. A rejected candidate discards its reasons, appends
  `rejected`, and continues. This uniformly replaces the shim's historical
  contradiction-rejection throw, which cannot be preserved once admission
  correctly precedes transaction-time contradiction selection. Any thrown
  proposal/apply failure still rejects the pass after earlier per-candidate
  commits; it is not converted to an outcome.
- `writeSessionSummaryMemory({store, turn})` requires the same brand and
  `turn.eventAt`. After its existing source-reference, disabled, and missing-
  text skips, missing event time returns
  `{reason:'event_time_missing', sourceBoundary, status:'skipped'}`. Every skip
  is exactly `{reason,sourceBoundary,status}` in that order. Inserted,
  duplicate, and rejected proposals all return exactly
  `{outcome,sourceBoundary,status:'completed'}` in that order; as in baseline,
  nested memory/similarity/reasons are not surfaced. A thrown proposal/apply
  failure escapes. Complete candidate receipts/rejection reasons remain V2-M3
  work rather than silently changing this A2 public result.
- `ingestChatTurn` keeps `extractorId='dry-stub'`, places its `eventAt` on the
  turn, and passes the gated handle directly. `ingestLongMemEvalInstance`
  therefore retains its current adapter provenance.
- `createMemoryExtractionScheduler` adds a captured `extractorId` option and
  requires its manager's `forWorkspace()` result to be a branded gated handle.
  A missing scheduler extractor ID produces the extraction drop above; no
  identity is invented. Session summary follows the turn's event time.

These missing-provenance drops and the summary event-time requirement are
intentional A2 structural deltas, not M3 evidence-policy claims.

For both producers, an event time is valid in A2 when the supplied value is
truthy and `String(value).trim()` is non-empty; the trimmed string is captured.
A2 does not add date parsing or an ISO-format claim. `extractorId` uses the
same non-empty trimmed-string rule.

Exported compatibility type/writer/actor/source collections cannot alter
runtime policy. Production validation uses private immutable snapshots;
each exported collection is a frozen read-only Set proxy with no own keys. It
preserves `instanceof Set`, `size`, `has`, iteration, `values`, `keys`,
`entries`, and `forEach` (whose third callback argument is the proxy), while
property access and membership for `add`, `delete`, and `clear` are absent.
Direct `Set.prototype` mutator calls reject the proxy as an incompatible
receiver. No path leaks the mutable target Set.

Before close, disabled base reads return respectively `null`, `[]`,
`{directCount:0, keywords:[], latencyMs:0, memories:[], totalCandidates:0}`,
and `[]`; disabled mutations return proposal
`memory_disabled`, delete `{deleted:false, reason:'memory_disabled'}`, topic
`{count:0, deleted:[]}`, inclusion `{touched:[], touchedCount:0}`, and the
zeroed lifecycle summary. Closing a disabled base/gated handle records closed
status but does not turn its inert operations into errors: every later read or
mutation returns the same deterministic disabled result before input
inspection, while `publicStatus`/`status` report `status:'closed'`. Enabled
base/gated operations other than idempotent `close`, `publicStatus`, and
`status` fail with code `legacy_store_closed` after close; status methods
report `status:'closed'` without touching SQLite.

## 8. Bootstrap and storage lifecycle

Schema work is not hidden inside gate creation. An enabled open first computes
the baseline workspace filename, resolves it lexically to an absolute path,
creates its parent directory, resolves that parent with native `realpath`, and
uses `join(realParent, basename(absoluteCandidate))` as both public `dbPath`
and the process-local registry key. An existing main path that is a symbolic
link is unsupported and fails `legacy_path_invalid`; directory-symlink aliases
therefore collapse while file-symlink aliases cannot split the registry. A
missing state/memory root or a path that cannot produce this canonical key
also fails `legacy_path_invalid`; ordinary native mkdir/realpath/open failures
remain native errors.

The registry serializes open/close/delete state transitions and counts every
supported native connection for a canonical path. Concurrent direct opens are
queued and may each return a separately verified safe handle, preserving the
baseline's multi-connection behavior; the manager's same-workspace
single-flight instead returns its cached identity. Every such connection uses
its own A1 coordinator, while SQLite `BEGIN IMMEDIATE` serializes
database-dependent resolution across them. Closing, reopening, and deleting
use the same key and queue, and deletion requires a zero count. Disabled
handles open no path and do not enter the registry.

For each enabled canonical database path, `createKernelStore` serializes:

1. directory/file open;
2. module-owned CDX-M0 schema and compatibility migration;
3. CDX-M1 column/migration completion;
4. exact `CDX-M1-runtime@1` verification; and
5. creation of the coordinator/router and branded base handle.

No handle is returned if bootstrap fails. No returned handle exposes
`initializeSchema` or `applyKernelMigrations`, and no semantic intent can
invoke DDL. Bootstrap is a control-plane prerequisite, not an A2 intent or a
claim that schema work co-commits with later memory decisions.

### 8.1 Exact `CDX-M1-runtime@1` manifest

Verification uses captured native object-row PRAGMAs and `main.sqlite_schema`;
required names are binary, case-sensitive spellings. `table_xinfo` tuples are
compared as `(name,type,notnull,dflt_value,pk,hidden)` in `cid` order. The
required ordinary tables are exactly:

```text
memory_migrations
  (id,TEXT,0,null,1,0)
  (applied_at,TEXT,1,null,0,0)

memories
  (id,TEXT,0,null,1,0)
  (palari_id,TEXT,1,null,0,0)
  (user_id,TEXT,0,null,0,0)
  (type,TEXT,1,null,0,0)
  (content,TEXT,1,null,0,0)
  (keywords,TEXT,1,"''",0,0)
  (importance,REAL,1,"0.5",0,0)
  (valid_from,TEXT,1,null,0,0)
  (valid_until,TEXT,0,null,0,0)
  (access_count,INTEGER,1,"0",0,0)
  (last_accessed,TEXT,0,null,0,0)
  (created_at,TEXT,1,null,0,0)
  (shared,INTEGER,1,"0",0,0)
  (confidence,REAL,1,"0.5",0,0)
  (acquisition_mode,TEXT,1,"'direct'",0,0)
  (created_by_pipeline,INTEGER,1,"0",0,0)
  (fictional,INTEGER,1,"0",0,0)
  (last_decayed_at,TEXT,0,null,0,0)
  (source_message_id,TEXT,0,null,0,0)
  (content_hash,TEXT,1,null,0,0)
  (source_kind,TEXT,0,null,0,0)
  (extractor,TEXT,0,null,0,0)

memory_links
  (id,TEXT,0,null,1,0)
  (from_memory_id,TEXT,1,null,0,0)
  (to_memory_id,TEXT,1,null,0,0)
  (relation,TEXT,1,"'associated'",0,0)
  (created_at,TEXT,1,null,0,0)
```

The canonical `memories` SQL additionally has exactly the nine-type `type`
CHECK in the private runtime snapshot order, `shared`,
`created_by_pipeline`, and `fictional` numeric `IN (0,1)` CHECKs, and the
four-value acquisition-mode CHECK. `memory_links` has exactly
`CHECK(from_memory_id <> to_memory_id)` and these two `foreign_key_list`
entries, with no others: `from_memory_id → memories.id` and
`to_memory_id → memories.id`, each `ON UPDATE NO ACTION ON DELETE CASCADE
MATCH NONE`. Stored SQL is compared to module-owned literal manifests with
the already certified B1 normalization only: CRLF becomes LF,
leading/trailing ASCII SQL whitespace is trimmed, one optional terminal
semicolon plus following whitespace is removed, and the remaining code units
must match exactly. Internal whitespace, comments, identifier spelling/case,
quoting, token order, operators, literals, conflict clauses, and CHECK/FK
contents are not normalized.

The baseline's ordered compatibility ALTERs legitimately produce three final
`memories` column orders, and `CDX-M1-runtime@1` has one exact stored-SQL/
`table_xinfo` literal for each:

```text
fresh current
  ... created_by_pipeline, fictional, last_decayed_at,
      source_message_id, content_hash, source_kind, extractor

post-fictional / pre-lifecycle
  ... created_by_pipeline, fictional, source_message_id, content_hash,
      last_decayed_at, source_kind, extractor

pre-fictional
  ... created_by_pipeline, source_message_id, content_hash,
      fictional, last_decayed_at, source_kind, extractor
```

Every variant has the same exact 22 logical descriptors and constraints. No
fourth order or merely similar DDL is accepted. All runtime reads use explicit
column lists; mutation-result rows use the canonical 22-key projection and
established search/recall reads append only their pinned metadata. Physical
compatibility order therefore never changes API shape.

The accepted history literals carry source provenance: pre-fictional schema
commit `912915793e79551fe45148b3f55d82117011de20`, blob
`c9b9e45ea8bbc6f70fce29e7ade085dd161d3784`; post-fictional/pre-lifecycle
commit `61e77fb46c371fbd9e398b467cfe85412e2c57c8`, blob
`6441b3a1de701e692aa961b5204e200b4f704915`; and current baseline commit
`190a4ad2f8d5187f5f21222048dd11efb2ad9991`, recorded upstream blob prefix
`4f67d0fe96dd`. The runtime ledger maps each literal to that source rather than
treating reconstructed compatibility SQL as unproven folklore.

The required explicit indexes are non-unique, non-partial, BINARY ascending,
and exactly:

```text
memories_scope_idx       memories      (palari_id,user_id,shared,valid_until,type)
memories_content_hash_idx memories     (palari_id,content_hash)
memory_links_from_idx    memory_links  (from_memory_id)
memory_links_to_idx      memory_links  (to_memory_id)
```

The exact autoindexes are
`sqlite_autoindex_memory_migrations_1`, `sqlite_autoindex_memories_1`,
`sqlite_autoindex_memory_links_1`,
`sqlite_autoindex_memory_fts_config_1`, and
`sqlite_autoindex_memory_fts_idx_1`. All five are checked through
`index_list/index_xinfo`, including BINARY/ascending key and auxiliary-column
metadata; the last two are absent from `sqlite_schema` because their FTS
shadow tables are WITHOUT ROWID. No extra index may target a CDX object.

`memory_fts` must be an FTS5 virtual table with visible columns exactly
`memory_id UNINDEXED`, `palari_id UNINDEXED`, `content`, and `keywords`, hidden
columns exactly `memory_fts` and `rank`, and tokenizer exactly
`unicode61 remove_diacritics 2`. Its generated shadow set is exactly
`memory_fts_config(k,v)`, `memory_fts_content(id,c0,c1,c2,c3)`,
`memory_fts_data(id,block)`, `memory_fts_docsize(id,sz)`, and
`memory_fts_idx(segid,term,pgno)`, including their pinned primary-key,
WITHOUT-ROWID, type, hidden, and autoindex metadata from SQLite `3.51.2`.
The `memory_fts_config` contents are exactly the single row
`{k:'version',v:4}`; extra keys can alter index behavior and are invalid.

The only accepted CDX triggers are these three exact persisted literals after
the narrow outer normalization above:

```sql
CREATE TRIGGER memories_ai AFTER INSERT ON memories BEGIN
      INSERT INTO memory_fts(rowid, memory_id, palari_id, content, keywords)
      VALUES (new.rowid, new.id, new.palari_id, new.content, new.keywords);
    END

CREATE TRIGGER memories_ad AFTER DELETE ON memories BEGIN
      DELETE FROM memory_fts WHERE rowid = old.rowid;
    END

CREATE TRIGGER memories_au AFTER UPDATE OF content, keywords, palari_id ON memories BEGIN
      DELETE FROM memory_fts WHERE rowid = old.rowid;
      INSERT INTO memory_fts(rowid, memory_id, palari_id, content, keywords)
      VALUES (new.rowid, new.id, new.palari_id, new.content, new.keywords);
    END
```

`memory_migrations` contains exactly one row for each ID `CDX-M0` and
`CDX-M1`, and no other ID. Each `applied_at` has SQLite type `text` and
round-trips to the exact millisecond UTC `Date.prototype.toISOString()` form.
New migration timestamps use the module-captured native date source, never the
caller store clock.
Missing, duplicate-impossible, malformed, or extra migration state is invalid.

Because these historical tables are non-STRICT, layout verification also
validates every existing logical row before returning a handle. In
`memories`, all required text columns in §5 have SQLite `typeof='text'`; every
nullable text is `null|text`; importance/confidence are finite
`integer|real`; access count is an integer in `[0,Number.MAX_SAFE_INTEGER]`;
and the three booleans are integer `0|1`. Type/acquisition/CHECK domains must
hold with `ignore_check_constraints=0`. In `memory_links`, all five columns
have `typeof='text'` and the self/FK constraints hold. The verifier reads
numeric values only after SQL-side finite/safe-range predicates succeed, then
normalizes them through captured object-row dispatch. A null TEXT primary key,
text number such as `importance='oops'`, negative/unsafe access count, BLOB,
or other affinity anomaly is `legacy_schema_invalid`. This data-shape oracle,
together with explicit projections, is what makes the §5/§7 public type claims
true; `quick_check` alone is not treated as sufficient evidence.

The closed CDX object set is the three ordinary tables, `memory_fts`, its five
shadow tables, their required indexes/autoindexes, and the three triggers.
Verification ASCII-folds inventory names to detect collisions, then requires
the accepted names' exact code units. It rejects a missing, extra,
case-variant, or changed object in that set; any additional index on a CDX
table/shadow; any extra FK on a CDX table; and any FK from another table to a
CDX object. It enumerates both `main` and `temp` triggers and rejects every
trigger other than the exact three above or one of B1's exact eight
name/target/SQL triples. Runtime
bootstrap imports only `MEMORY_BUNDLE_OBJECTS`,
`MEMORY_BUNDLE_TRIGGER_TARGETS`, and `normalizeMemoryBundleSql` from
`src/memory-bundle-schema.mjs` to construct that immutable trigger allowlist;
it does not invoke B1 state/replay verification or interpret B1 rows. This
fail-closed rule avoids pretending a text search can prove that an arbitrary
trigger on an unrelated table does not write CDX. Exact B1 objects and truly
unrelated tables/views/virtual tables/indexes remain allowed when their names
do not collide with the reserved CDX/`memory_fts_*` set and their FKs do not
reference it; unrelated triggers are intentionally unsupported. Thus no
approved A2 effect can activate undeclared trigger DML, FK action, uniqueness
constraint, or index behavior. Each present B1-named trigger must match its
exact allowlist triple, but partial/invalid B1 non-trigger state remains B1's
own verifier concern and cannot affect CDX bootstrap acceptance unless it
adds a CDX FK/name collision.
Every accepted triple must reside in `main`; every `temp` trigger is rejected
regardless of name, target, or body because it is connection-local hidden
behavior.

Complete verification also requires configured/read-back connection policy
`foreign_keys=1`, `busy_timeout=0`, `recursive_triggers=1`,
`ignore_check_constraints=0`, and `trusted_schema=0`; an empty
`foreign_key_check(memory_links)`; `quick_check` returning exactly one `ok`;
exact bidirectional row parity between
`(memories.rowid,id,palari_id,content,keywords)` and
`(memory_fts.rowid,memory_id,palari_id,content,keywords)`; and a successful
FTS5 `integrity-check` special command inside a private bootstrap verification
savepoint that is rolled back and released before bootstrap commit. The FTS
command's apparent write is control-plane verification, not a ninth semantic
effect, and none of it is reachable after handle return.

Bootstrap schema/migration/verification runs in one private control-plane
transaction after `foreign_keys=ON` and before the A1 coordinator exists. A
normal schema/verification failure with a proven active transaction first
rolls that transaction back, so an invalid preexisting file is not left partly
migrated; uncertain native state instead follows the no-false-rollback law
below. This transaction owner and the rollback-scoped FTS verification command
are statically allowlisted only in runtime bootstrap; they never borrow or
replace A1 semantic ownership.

The private owner proves native state rather than trusting transaction-control
return. Immediately after construction and connection-policy setup, captured
state getters must return the primitive booleans `isOpen === true` and
`isTransaction === false`. After `BEGIN IMMEDIATE` returns, and again
immediately before `COMMIT`, they must return `true` and `true`. No DDL,
migration DML, verification command, callback, coordinator construction, or
handle construction may occur until the post-BEGIN proof succeeds. After
`COMMIT` returns they must return `true` and `false` before a handle can be
constructed. A required `ROLLBACK` succeeds only if the captured command
returns and immediate readback proves `isOpen === true` and
`isTransaction === false`; a returned-but-active rollback is a cleanup
failure, never a rollback claim.

A captured state getter that throws is unreadable; a value other than a
primitive boolean is invalid; and a primitive pair different from the stage's
required pair is a mismatch. A mismatch/non-boolean state during the initial,
post-BEGIN, pre-COMMIT, or post-COMMIT success proofs creates
`legacy_schema_invalid`; a throwing getter is preserved as its `cause`.
Required-rollback proof and failure-path state inspection are excluded from
that classification and follow the cleanup law below. These classifications
expose no handle and always run failed-open cleanup.

Rollback eligibility is decided from state captured **after** the primary
failure, never from a pre-stage observation. After a thrown `BEGIN`, any
schema/migration/verification/savepoint failure following a successful BEGIN,
or a thrown `COMMIT`, the owner immediately reads both captured state getters:

- exact `(isOpen:true,isTransaction:true)` requires one rollback;
- exact `(true,false)` or `(false,false)` requires no rollback and proceeds to
  close; after a thrown COMMIT this is an unknown commit outcome, not success;
- `(false,true)`, a non-boolean value, or a throwing getter is an unreadable
  rollback decision, so no speculative rollback is issued. The thrown value,
  or a native `Error` with exact message
  `Bootstrap transaction state is invalid.`, is the state-inspection cleanup
  failure.

A failure after native construction but before `BEGIN IMMEDIATE` is issued,
including connection-policy execution/readback or the initial native-state
proof, performs no rollback and makes no transaction-state restoration claim;
it proceeds directly to the mandatory close-once/proof sequence.

The same decision applies to a success-proof mismatch after this owner has
successfully issued BEGIN and has no proven commit, using the already observed
primitive pair; initial-state mismatch never authorizes rollback because the
owner has not begun a transaction. An unreadable/non-boolean state at any
point poisons the canonical path even if close later proves the connection
shut, and no atomic rollback or commit-outcome claim is made. The expected
active state after a successfully returned BEGIN is not itself a failure and
bootstrap proceeds. A valid post-COMMIT active state is a success-proof
mismatch, requires rollback, and cannot expose success. Exact `(true,false)`
after returned COMMIT is the only successful commit proof.

An oracle mismatch detected from read-back values—including schema, policy,
integrity, parity, migration, or forbidden-object state—creates
`legacy_schema_invalid`; when a native read supplied the bad evidence, that
native failure is its `cause`. A native operational throw from connection
policy execution, `BEGIN`, DDL, migration DML, verification SQL/FTS command,
savepoint control, or `COMMIT` otherwise retains its identity.

Every primary failure after native construction and before handle publication
invokes captured-native close exactly once and, if close returns, proves
primitive `isOpen === false`. Pre-commit failures first make the post-failure
rollback decision above. A required rollback throw is its cleanup failure. A
returned rollback succeeds only on exact `(true,false)`; a throwing getter is
the rollback failure, while every other pair/non-boolean value uses a native
`Error` with exact message
`Bootstrap rollback did not end the transaction.`. Thus returned rollback
state `(false,false)` is explicitly a cleanup failure even though it is
inactive: required rollback must leave an open, inactive connection for the
mandatory close owner.

A close throw is its cleanup failure; a returned close followed by a throwing
open-state getter uses that thrown value, while non-boolean/true open state
uses a native `Error` with exact message
`Bootstrap close did not close the connection.`. With no cleanup failure, the
classified primary escapes by identity. With cleanup failures, one native
`AggregateError` escapes whose `errors` are exactly
`[primary, stateInspectionFailure?, rollbackFailure?,
closeOrProofFailure?]` by identity and temporal order. Any state-inspection
failure, required-rollback failure, unreadable/non-boolean success proof, or
close/proof failure poisons the canonical path.

After commit is proven, coordinator, router, registry-entry, or handle
construction can still fail before publication. Such a failure performs no
rollback or transaction-state claim; it preserves that construction failure
as primary, performs the same close-once/proof sequence, aggregates only an
optional close/proof failure after it, and poisons only if close cannot be
proven. Publication occurs only after all construction succeeds, the registry
records the live connection, and no fallible step remains. These bootstrap
cleanup rules do not change direct published-handle or manager close behavior:
their native close failure remains native and retains the blocked live count.

Verification is required on every open, not only creation; `CREATE ... IF NOT
EXISTS` success is never treated as proof of a canonical object.

### 8.2 Terminal storage lifecycle

`deleteKernelStoreFile(options)` remains the sole supported whole-workspace
destruction door. It:

- resolves one normalized path through the existing workspace-path law;
- serializes against supported open/create/delete operations for that path;
- refuses while any supported live handle for the path remains open;
- removes the main, `-wal`, `-shm`, and `-journal` paths only after that check;
  and
- makes no atomic multi-file deletion, in-file receipt, cryptographic proof,
  or coordinator co-commit claim.

The live/in-flight/blocked-handle refusal is a `LegacyMutationError` with
immutable enumerable `code === 'legacy_store_open'`; no file removal is
attempted. Other filesystem failures retain their native error and never
report success.

A poisoned canonical path also rejects every later supported open with
`legacy_store_open` before native construction, and rejects deletion before
file removal. Ordinary live handles do not prevent a separately requested
direct safe open—the registry counts both—but a poison records either that
cleanup could not prove the prior owner gone or that a required transaction/
cleanup-state proof was unreadable, invalid, or violated. Poison therefore
blocks reuse even in a branch where a later observation proved the connection
closed.

Those four paths are the exact A2 artifact set, not a claim that no temporary,
backup, copied, filesystem, or storage-layer residue can exist. M5 owns the
complete tested-surface inventory and deletion proof. This is a terminal
storage-lifecycle operation because the database containing any in-file
journal is itself removed. Under the currently scoped same-file M2-B, terminal
destruction must be deterministically refused: it cannot preserve or co-commit
an authority decision/journal inside the file it destroys. It may be accepted
only if a separately reviewed external authority/receipt substrate is
explicitly authorized; M5 deletion proof alone does not supply that authority
or persistent decision evidence. A2 may not weaken the one-connection claim
by pretending file removal ran inside SQLite.

## 9. Transaction, failure, and atomicity law

### 9.1 Closed A2 error vocabulary

`LegacyMutationError(code, message, cause?)` has
`name === 'LegacyMutationError'`, the standard non-enumerable `message`, an
optional standard non-enumerable `cause` preserved by identity without
coercion, and exactly one enumerable classification property: immutable
`code`. Its accepted production pairs are exactly:

| Code | Exact message |
|---|---|
| `legacy_invalid_argument` | `A valid legacy mutation argument is required.` |
| `legacy_invalid_capability` | `A supported branded memory capability is required.` |
| `legacy_store_closed` | `The memory store is closed.` |
| `legacy_manager_closed` | `The workspace memory manager is closed.` |
| `legacy_plan_invalid` | `A router-issued legacy mutation plan is required.` |
| `legacy_plan_stale` | `The legacy mutation plan is stale for this transaction.` |
| `legacy_plan_applied` | `The legacy mutation plan has already been consumed.` |
| `legacy_effect_invalid` | `A valid legacy mutation effect is required.` |
| `legacy_effect_cardinality` | `A legacy mutation effect changed an unexpected number of rows.` |
| `legacy_schema_invalid` | `The CDX-M1 runtime schema does not match the required manifest.` |
| `legacy_store_open` | `The memory database has a supported live or blocked connection.` |
| `legacy_path_invalid` | `A valid memory database path is required.` |

No error-code/message object is exported. Constructing the class with an
unknown/non-string code throws native `TypeError` with exact message
`Unknown legacy mutation error code.` An empty/non-string message throws
native `TypeError` with exact message
`Legacy mutation error message must be a non-empty string.`

`legacy_invalid_argument` covers a malformed router envelope, unknown one-of-
five intent, malformed captured intent, or invalid structural options; it does
not replace proposal-level `{outcome:'rejected',reasons:[...]}`.
`legacy_invalid_capability` covers a trap-free rejected Proxy, spoof, duck
type, or wrong base/gated brand.
`legacy_plan_invalid` covers an unissued plan or an internally malformed plan
draft caught before branding;
`legacy_plan_stale` covers a branded plan bound to a different router,
database, or lease; and `legacy_plan_applied` covers a correctly bound plan
whose one apply attempt already began. An apply attempt consumes the plan
before effect zero, even if an effect fails. Resolver-produced malformed
effects are `legacy_plan_invalid`; malformed effects submitted directly to the
child applier are `legacy_effect_invalid`.

Compatibility validation remains outside this class: baseline unsupported
actor/type/acquisition messages, malformed FTS SQLite failure, a caller-clock
throw, and ordinary SQL constraints retain their native identity. Recall and
lifecycle invalid time use native `RangeError('Invalid time value')`; recall-
inclusion access overflow uses native
`RangeError('Memory access_count cannot be incremented safely.')`. Structurally
invalid path configuration is
`legacy_path_invalid`; native permission, I/O, realpath, open, close, and
removal failures remain native except when ordered into the bootstrap-cleanup
`AggregateError` defined in §8.1. A failed direct native close leaves the handle
revoked but counted live/blocked; deletion cannot follow an attempted close
that did not prove the connection shut.

### 9.2 Deterministic precedence

The precedence is exact:

1. A capability-taking API checks its private brand without traps. Wrong
   capability gives `legacy_invalid_capability`; a correct enabled but closed/
   revoked capability gives `legacy_store_closed`. A correctly branded
   disabled capability follows §7.4's inert result law even after close.
2. An enabled bound store method checks closed state before inspecting caller
   input; a disabled one returns its inert result first. Manager
   `forWorkspace` checks `closing|closed` before workspace input and gives
   `legacy_manager_closed`.
3. Capture copies/coerces caller data and invokes any required caller clock
   before coordinator entry. A caller throw escapes by identity. Store and
   manager liveness are rechecked afterward.
4. Once `coordinator.run` begins, exact A1 entry, begin, ownership, commit,
   rollback, cleanup, and poison precedence applies unchanged.
5. `resolve`, router `apply`, and direct effect apply call
   `assertActiveMutationLease(lease, db)` before inspecting captured intent,
   plan, or effect. Thus an invalid lease plus invalid child input is A1
   `mutation_invalid_argument`; a retired/wrong-connection lease plus invalid
   child input is A1 `mutation_transaction_ownership_lost`.
6. With an active exact lease, router apply checks plan brand, exact
   router/database/lease binding, then consumed state: invalid → stale →
   applied. It marks a fresh plan consumed before effect zero.
7. Direct child apply validates the effect, issues one statement, then checks
   exact-one cardinality. A normal A2/native child failure is rethrown by
   identity after successful A1 rollback.
8. A recorded A1 ownership loss wins even if child code catches and replaces
   it; rollback cleanup failure replaces the child with A1
   `mutation_cleanup_failed` and ordered causes `[child,cleanup]`; commit
   failure/outcome uncertainty produces the applicable A1 error, never an A2
   result.

A branded plan's private state is equivalent to
`{router,db,lease,state:'fresh'|'consumed'}`. It becomes stale when its lease
retires whether applied or not. Binding precedes consumed-state inspection, so
an applied plan under a later lease is stale while a second apply in the
original active lease is applied.

### 9.3 Semantic transaction and close law

Every compatibility-validated semantic public call owns zero or one A1
coordinator run:

- a pure validation/policy rejection owns zero;
- every database-dependent rejection or mutation owns exactly one;
- composite intents do not call public mutation methods and never re-enter the
  coordinator; and
- the public result appears only after A1 commit succeeds.

Coordinator infrastructure failures retain the exact A1
`MemoryMutationError` classification and precedence. Resolver validation may
return a compatibility rejection or throw the same public validation error
class/message family as the baseline. A native constraint or child-apply
failure escapes through A1 only after successful rollback; no planned result
is exposed.

A failure at any effect ordinal rolls back every earlier effect in that plan,
including trigger-created FTS rows and FK-cascaded links. Topic forget,
recall inclusion, lifecycle, add-plus-provenance, and supersession are each
all-or-nothing. Other connections cannot observe plan effects before commit.
No A2 **semantic** path retries, opens a savepoint, conditionally borrows a
caller transaction, or issues transaction control outside A1. The
pre-handle bootstrap transaction in §8.1 is a separate, unreachable control-
plane owner.

From the post-capture liveness check through A1 completion, all store work is
synchronous and invokes no caller callback, accessor, iterator, coercion hook,
or live prototype method. JavaScript run-to-completion therefore makes
same-handle `close()` unable to interleave with an active semantic
transaction. If a caller clock reentrantly closes during capture and returns,
the post-capture check gives `legacy_store_closed` and no `BEGIN`; if that
clock throws, its original throw wins. Otherwise execute linearizes wholly
before close, or close linearizes first and closed-state precedence applies.
Async manager close likewise cannot interrupt that synchronous segment.

## 10. Static producer closure

The A2 production source audit enforces all of the following:

- reachable semantic CDX DML on the supported production graph exists only in
  `src/legacy-mutation-router.mjs`; the byte-identical extracted baseline DML
  is quarantined and its raw mutators have no supported caller;
- CDX schema/trigger/migration SQL exists only in the bootstrap substrate;
- semantic transaction-control SQL exists only in
  `src/mutation-coordinator.mjs`; the runtime contains the separately
  allowlisted pre-handle bootstrap transaction and rollback-scoped FTS
  integrity command from §8.1;
- unchanged exact B1 transaction owners remain separately allowlisted;
- the runtime's schema-only B1 trigger allowlist imports exactly the three
  immutable `src/memory-bundle-schema.mjs` values named in §8.1 and no B1
  state/owner/apply module;
- gate, store wrapper, extraction, recall, adapter, scheduler, and live runner
  contain no semantic DML or raw transaction SQL;
- no production source imports `src/memory-store.mjs`; the exact runtime owns
  native construction, canonical bootstrap, captured reads, and connection
  cleanup without ever constructing a raw store, and no producer obtains its
  connection;
- the direct internal effect applier has only the reviewed test/composition
  imports; and
- every mutation-facing handle method maps mechanically to one of the five
  intent kinds.

The parsed production-module allowlist at the A2 cut point is exactly:

```text
scripts/run-live-slice.mjs
src/adapter.mjs
src/eval-prompt-config.mjs
src/gate.mjs
src/gemini.mjs
src/kernel-store-runtime.mjs
src/legacy-mutation-router.mjs
src/longmemeval.mjs
src/memory-briefing.mjs
src/memory-bundle-apply.mjs
src/memory-bundle-codec.mjs
src/memory-bundle-errors.mjs
src/memory-bundle-runtime.mjs
src/memory-bundle-schema.mjs
src/memory-bundle-verify.mjs
src/memory-bundle.mjs
src/memory-extraction.mjs
src/mutation-coordinator.mjs
src/recall.mjs
src/routing-budgets.mjs
src/slice.mjs
src/store.mjs
src/util.mjs
```

Each listed path is an independent graph root for the audit as well as a
permitted imported node, so its own body and all transitive reachability are
tested even when no other production file imports it. Treating an internal
module as an audit root does not make its exports a supported public
capability. Every relative import must resolve inside this closed list. A new
production module or edge fails until this contract and the mechanical
allowlist are reviewed together. `src/memory-store.mjs` is the sole source
file deliberately outside it: direct imports are unsupported and tests prove
it is unreachable from every listed root. The audit checks allowlisted call
sites in addition to source-token scans; a bare `rg` absence/presence result
is not accepted as reachability proof. Test fixtures may import the dormant
extracted raw store at `src/memory-store.mjs` or open independent native
connections for golden comparison, read-only inspection, concurrency, failure
injection, or the historical B1/A1 composition falsifiers. Such test ownership
does not add a production capability.

## 11. M2-B map-or-refuse obligation

A2 certification produces a checked finite branch-pattern table. Its key is
strictly richer than an outcome/effect sequence:

```text
route kind × proposal kind/op × legacy type/partition × actor/writer class
× source/evidence/acquisition class × scope and same/cross-Palari/user relation
× add/supersede source-message and keyword-decoration branch
× shared-input flag × proposed/generated/normalized-target ID class
× supplied/computed/matching/mismatching/invalid-type content-hash class
× eager-capture conversion success/throw and deferred-validation class
× caller/event/store/native `created_at`/`valid_from`/`valid_until` class
× caller historical access/decay/source-field class
× access-count safe-increment/overflow boundary
× lifecycle nonempty-Palari/empty-cross-Palari scope branch
× target/duplicate branch × outcome × ordered explicit effects
× implicit trigger/FK consequences × compatibility-defect flags
```

For topic, recall, and lifecycle batches, the table defines finite per-target
branch patterns plus their ordered batch-composition law rather than
enumerating unbounded ID lists. It also contains the terminal workspace-delete
route, including its zero-live-handle precondition and main/WAL/SHM
and rollback-journal consequences. The table is an obligation list, not a
canonical registration.
M2-B must assign each branch pattern one of exactly two reviewed dispositions:

1. map it to a provenance-pinned, Unified-Spec-conforming governed operation
   under a trusted authority root and co-commit its B2 decision/journal effects
   with the CDX projection effects; or
2. refuse it deterministically before any CDX effect.

Terminal workspace destruction cannot take disposition 1 under the currently
scoped same-file B2 architecture: the operation removes the substrate that
would retain its authority decision. It must take disposition 2 unless a
separately reviewed and explicitly authorized external authority/receipt
substrate changes that premise.

No branch may disappear, inherit authority from A2 metadata, or silently change
meaning. M2-B must also checkpoint legacy CDX state, use a disjoint namespace
that does not match `memory_bundle_*`, and leave exact B1 unchanged. Parent M2
remains unchecked until that complete production co-commit falsifier passes.

## 12. Acceptance and non-goals

A2 is complete only when tests and review prove all of these together:

1. the documented current-mutation disposition is exhaustive and mechanically
   matches the exact five-intent/eight-effect unions;
2. enabled and disabled base/gated/manager surfaces are exact, frozen,
   branded, and raw-handle-free;
3. spoofed, duck-typed, stale, and wrong-kind capabilities fail before any
   semantic write, and every A2 structural/state failure has the exact closed
   error code/message/precedence;
4. caller clocks/coercions stay before transaction entry, resolver reads and
   effects use captured native dispatch, and no caller code can run under an
   active lease;
5. each compatibility-validated intent uses exactly one coordinator run and
   all database-dependent resolution follows `BEGIN IMMEDIATE`;
6. plan branding, lease binding, single apply, deep immutability, complete
   pre-DML materialization, and fixed effect ordering hold;
7. add/duplicate, supersede, demote, share, delete, topic-forget, recall
   inclusion, and lifecycle preserve their recorded compatibility results and
   state, except only the intentional deltas named in this contract;
8. every public memory/link row has its exact shape, every effect changes
   exactly one row, and provenance lands in the same insert transaction; no
   partial provenance
   state is possible;
9. forced failure at every applicable effect ordinal leaves memory, FTS,
   links, and telemetry/lifecycle state unchanged;
10. competing connections cannot create a stale duplicate, target, topic, or
   lifecycle plan and cannot observe uncommitted effects;
11. raw extraction/session-summary calls and the scheduler cannot accept or
    obtain arbitrary store-shaped mutation objects;
12. manager creation is single-flight and close-race safe; canonical path
    aliases share serialization/live state; supported open/create/delete
    operations prevent process-local open-handle unlink or path split brain;
13. all three accepted schema histories satisfy the complete
    `CDX-M1-runtime@1` oracle, every forbidden object/data/FTS mutation fails
    closed with rollback/cleanup, and exact B1 coexistence remains valid;
14. the static producer audit passes; no supported in-file semantic
    DML/transaction shortcut remains;
15. the dimension-complete M2-B branch-pattern and storage-route obligation
    table is checked in; and
16. exact Node/SQLite runtime, focused A2 tests, all B1 tests, the pre-A2
    regression suite, and the full suite pass with zero failures.

The intentional A2 behavior deltas are limited to routing/safety mechanics:
raw surface removal and complete production quarantine of the extracted raw
store at `src/memory-store.mjs`, direct native runtime ownership/cleanup,
transactional CDX-M1 bootstrap plus
the three-variant fail-closed layout/data/FTS manifest before handle return,
explicit primitive-string treatment of historically unnormalized TEXT
overrides, ordinary captured public row copies, same-transaction provenance,
deterministic tie-breaks, pre-transaction one-time caller-clock
capture and captured-native ID generation, exact effect cardinality, atomic
composite calls, direct-FTS accurate topic-forget results/termination, safe
disabled handles, one-time eager caller-value detachment/coercion, prototype-
collision and structural-input repairs, eager actor/ID validation, structural
extraction/summary event and extractor provenance requirements, immutable
policy vocabularies, canonical numeric policy snapshots, trimmed proposal-
target/direct-ID
capture, deterministic lifecycle capture/date arithmetic, finite recall-time
rejection, uniform extracted-candidate rejection accounting, canonical-parent
path identity, manager single-flight/close-race revocation,
removal of the four named workspace paths including `-journal`, and same-path
open/delete serialization. A2 does not repair extractor schema/evidence
coverage, assistant evidence, candidate receipts, canonical type/lifecycle law,
authenticated scope/authority, or the full supersession policy. Those remain
assigned to M2-B or V2-M3 as recorded above.

No live provider, sealed U8 question, dataset download, result write, score,
spend, publish, or announcement participates in A2 acceptance.

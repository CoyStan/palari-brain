# Legacy Mutation B2 Obligations — generated from V2-M2-A2

**Status:** finite compatibility inventory only. This file registers no
canonical operation, authority, admission decision, patch, atom, journal,
receipt, or source-of-truth claim.
**Source contract:** `docs/LEGACY-MUTATION-ROUTING-CONTRACT.md` §11.
**A2 contract version:** `CDX-M1-legacy-plan@1`.
**Disposition vocabulary:** `M2-B MUST MAP OR REFUSE`; terminal same-file
destruction is `M2-B MUST REFUSE` under the current architecture.

M2-B may split a row into narrower governed cases, but it may not merge away a
dimension, infer authority from compatibility metadata, or omit a row. A mapped
row must bind a trusted authority root and provenance, emit a disjoint CDX-B2
decision/effect journal, and co-commit that journal with every listed explicit
CDX effect and implicit SQLite consequence. A refused row must fail before any
listed CDX effect.

## 1. Exact branch-pattern key

Every row is keyed by all of these ordered dimensions:

1. route kind;
2. proposal kind/op;
3. legacy type/partition;
4. actor/writer class;
5. internal `explicit_proposal`/`extraction_candidate` producer discriminator;
6. source/evidence/acquisition class;
7. scope and same/cross-Palari/user relation;
8. add/supersede source-message and keyword-decoration branch;
9. shared-input flag;
10. proposed/generated/normalized-target ID class;
11. supplied/computed/matching/mismatching/invalid-type content-hash class;
12. eager-capture conversion success/throw and deferred-validation class;
13. normalized confidence and below/at/above selected policy-threshold relation;
14. caller/event/store/native `created_at`/`valid_from`/`valid_until` class;
15. caller historical access/decay/source-field class;
16. access-count safe-increment/overflow boundary;
17. lifecycle nonempty-Palari/empty-cross-Palari scope branch;
18. target/duplicate branch;
19. outcome;
20. ordered explicit effects;
21. implicit trigger/FK consequences;
22. compatibility-defect flags.

The compact tables below use `*` only where the named dimension is truly
irrelevant to that branch. A slash-separated cell is an explicit finite
variant set, not a wildcard. `none` means the branch has no value/effect in
that dimension.

## 2. Pre-route and proposal-admission patterns

| ID | Route / proposal / producer | Required finite variants | Outcome | Effects / consequences | Defect flags | Disposition |
|---|---|---|---|---|---|---|
| PRE-01 | any public mutation / `n/a` / `n/a` | disabled before/after close | exact inert disabled result | none | compatibility disabled surface | M2-B MUST MAP OR REFUSE |
| PRE-02 | any enabled route / applicable producer | closed/revoked | `legacy_store_closed` | none | none | M2-B MUST MAP OR REFUSE |
| PRE-03 | any route / applicable producer | eager conversion success/throw at each pinned ordinal; caller clock success/throw; post-callback close | captured intent or original throw/`legacy_store_closed` | none | caller-controlled coercion/clock | M2-B MUST MAP OR REFUSE |
| P-01 | `legacy_proposal` / invalid kind / explicit | raw missing/unknown/prototype-collision kind | `rejected:invalid_kind` | none | caller-supplied semantics | M2-B MUST MAP OR REFUSE |
| P-02 | `legacy_proposal` / known kind + invalid op / explicit | omitted/undefined→add; null/unknown raw op | accepted op or `rejected:invalid_op` | none | caller-supplied semantics | M2-B MUST MAP OR REFUSE |
| P-03 | `legacy_proposal` / promote/permanent add/supersede / explicit or extraction | writer missing/invalid; source missing/invalid; external-with-non-extraction; pipeline event missing; extraction ID missing; valid/invalid type partition; normalized confidence below/at/above chosen floor | ordered admission rejection or admitted | none | identity/evidence/floor are compatibility assertions | M2-B MUST MAP OR REFUSE |
| P-04 | `legacy_proposal` / demote / explicit | actor from `actor ?? writer`: missing/invalid/valid, including null fallback and empty non-fallback | `rejected:invalid_actor` or admitted | none | caller-asserted actor | M2-B MUST MAP OR REFUSE |
| P-05 | `legacy_proposal` / ratify share / explicit | writer explicit-user/non-user | `rejected:ratify_requires_user` or admitted | none | ceremonial, unauthenticated ratification | M2-B MUST MAP OR REFUSE |

All admitted proposal rows below retain these finite value classes even where
the compact row does not repeat them: permanent/transient type; explicit or
extraction producer; writer/actor; user/external source; direct/extracted/
summarized/caller acquisition; general/same-user/cross-user and same/cross-
Palari scope; decorated/undecorated keywords; absent/record/provenance source
message; shared `0|1`; caller/generated/trimmed target IDs; computed hash or
supplied matching/mismatching/invalid-type hash; every eager conversion
ordinal and deferred nonempty-content/acquisition/hash validation; confidence
below/at/above the selected policy floor; caller/event/store/native time;
caller historical access/decay/source fields; and every named defect in §8.

## 3. Proposal resolution/effect patterns

| ID | Proposal / producer | Target or duplicate branch | Outcome | Ordered explicit effects | Implicit consequences | Disposition |
|---|---|---|---|---|---|---|
| PA-01 | promote/permanent add / explicit | duplicate absent; insert-valid | `inserted` | `cdx_memory_insert` | FTS insert trigger | M2-B MUST MAP OR REFUSE |
| PA-02 | promote/permanent add / explicit | duplicate present across same/cross user | `duplicate_bumped` | `cdx_memory_set_importance` | none | M2-B MUST MAP OR REFUSE |
| PA-03 | promote/permanent add / explicit | duplicate present with empty candidate/existing content; insert-only validation skipped | `duplicate_bumped` | `cdx_memory_set_importance` | none | M2-B MUST MAP OR REFUSE |
| PA-04 | promote/permanent add / explicit | duplicate absent; deferred empty-content/acquisition/hash invalid | native/legacy validation failure | none | none | M2-B MUST MAP OR REFUSE |
| PX-01 | promote/permanent add / extraction | same/cross-user visible contradiction target present, including same/cross Palari row fallback inputs | `superseded` | `cdx_memory_end_validity` → `cdx_memory_insert` → `cdx_link_insert` | FTS insert trigger | M2-B MUST MAP OR REFUSE |
| PX-02 | promote/permanent add / extraction | no contradiction; duplicate present across same/cross user | `duplicate_bumped` | `cdx_memory_set_importance` | none | M2-B MUST MAP OR REFUSE |
| PX-03 | promote/permanent add / extraction | no contradiction/duplicate | `inserted` | `cdx_memory_insert` | FTS insert trigger | M2-B MUST MAP OR REFUSE |
| PS-01 | promote/permanent supersede / explicit | normalized target missing/empty | `rejected:missing_target` | none | none | M2-B MUST MAP OR REFUSE |
| PS-02 | promote/permanent supersede / explicit | target present; same/cross legacy partition | accepted or `rejected:type_partition_mismatch` | none when refused | none | M2-B MUST MAP OR REFUSE |
| PS-03 | promote/permanent supersede / explicit | target present; same partition; same/cross Palari and same/cross user | `superseded` | `cdx_memory_end_validity` → `cdx_memory_insert` → `cdx_link_insert` | FTS insert trigger | M2-B MUST MAP OR REFUSE |
| PD-01 | demote end-validity / explicit | target missing | `rejected:missing_target` | none | none | M2-B MUST MAP OR REFUSE |
| PD-02 | demote end-validity / explicit | target present | `demoted` | `cdx_memory_end_validity` | none | M2-B MUST MAP OR REFUSE |
| PD-03 | demote delete-transient / explicit | target missing/permanent/transient | missing→`missing_target`; permanent→`not_transient`; transient→`demoted` | transient: `cdx_memory_delete` | FTS delete trigger + link FK cascades | M2-B MUST MAP OR REFUSE |
| PR-01 | ratify share / explicit | target missing/present | missing→`missing_target`; present→`ratified` | present: `cdx_memory_set_shared` | none | M2-B MUST MAP OR REFUSE |

For every mutating row, effect ordinal `0..n-1` is a separate forced-failure
variant. Every such variant must roll back all earlier explicit effects plus
trigger-created FTS rows and cascaded links; it has no public planned result.

## 4. Ownership, topic, recall, and lifecycle patterns

| ID | Route | Required finite branch variants | Outcome | Ordered explicit effects | Implicit consequences | Disposition |
|---|---|---|---|---|---|---|
| D-01 | `legacy_delete_memory` | actor valid/invalid; normalized ID empty/missing | validation failure or `not_found` | none | none | M2-B MUST MAP OR REFUSE |
| D-02 | `legacy_delete_memory` | permanent target × explicit-user/non-user actor | `deleted` or `permanent_type_protected` | accepted: `cdx_memory_delete` | FTS delete trigger + all link FK cascades | M2-B MUST MAP OR REFUSE |
| D-03 | `legacy_delete_memory` | transient target × every valid actor; same/cross caller scope | `deleted` | `cdx_memory_delete` | FTS delete trigger + all link FK cascades | M2-B MUST MAP OR REFUSE |
| T-01 | `legacy_forget_topic` | actor valid/invalid; query or Palari empty | invalid actor or `{count:0,deleted:[]}` | none | none | M2-B MUST MAP OR REFUSE |
| T-02 | `legacy_forget_topic` | malformed direct FTS syntax | native SQLite failure | none, empty transaction rollback | none | M2-B MUST MAP OR REFUSE |
| T-03 | `legacy_forget_topic` | finite visible match set: own/general/shared/other-private; permanent protected/transient or explicit-user deletion; binary-ID order | `topic_forgotten` with only landed IDs | zero or more ordered `cdx_memory_delete` | per delete: FTS trigger + link cascades | M2-B MUST MAP OR REFUSE |
| R-01 | `legacy_record_recall_inclusion` | actor/bump/IDs conversion; normalized list empty | empty result or conversion failure | none | none | M2-B MUST MAP OR REFUSE |
| R-02 | `legacy_record_recall_inclusion` | first-occurrence IDs missing/present; access count below max | `recall_recorded` | per present ID: `cdx_memory_touch` → `cdx_memory_set_importance` | none | M2-B MUST MAP OR REFUSE |
| R-03 | `legacy_record_recall_inclusion` | any present ID at `Number.MAX_SAFE_INTEGER` | exact native overflow `RangeError` | none; whole call rollback | none | M2-B MUST MAP OR REFUSE |
| L-01 | `legacy_run_lifecycle` | nonempty Palari exact filter / empty Palari cross-Palari sweep | `lifecycle_ran` | per selected row as below | none | M2-B MUST MAP OR REFUSE |
| L-02 | `legacy_run_lifecycle` | invalid/future/valid reference; zero windows | skipped | none | none | M2-B MUST MAP OR REFUSE |
| L-03 | `legacy_run_lifecycle` | one-or-more windows; next importance `>0.1` | decayed | `cdx_memory_decay` | none | M2-B MUST MAP OR REFUSE |
| L-04 | `legacy_run_lifecycle` | one-or-more windows; next importance `<=0.1` | deleted | `cdx_memory_delete` | FTS delete trigger + link cascades | M2-B MUST MAP OR REFUSE |

Topic, recall, and lifecycle lists are unbounded in length but finite in branch
kind. Their composition laws are exact: topic targets use binary ID order;
recall IDs use first occurrence with touch before importance; lifecycle rows
use creation time then binary ID. Any effect failure rolls back the whole
public batch. Competing connections resolve from the snapshot after the one
`BEGIN IMMEDIATE` and cannot land a stale pre-transaction target list.

## 5. Producer-result patterns

| ID | Producer branch | Compatibility result | Routed proposal branch | Disposition |
|---|---|---|---|---|
| E-01 | extraction disabled/missing extractor/missing event/missing extractor ID/extractor error/invalid payload | exact three-key skip/drop | none | M2-B MUST MAP OR REFUSE |
| E-02 | candidate transient-detail/source-boundary drop | completed outcome entry; no write count | none | M2-B MUST MAP OR REFUSE |
| E-03 | candidate admission rejection | `rejected` outcome entry; reasons discarded; later candidates continue | P-03 | M2-B MUST MAP OR REFUSE |
| E-04 | candidate insert/duplicate/supersede | exact outcome; insert/supersede count only | PA/PX | M2-B MUST MAP OR REFUSE |
| E-05 | candidate capture/apply throw | pass rejects after earlier candidate commits | applicable PA/PX failure | M2-B MUST MAP OR REFUSE |
| S-01 | summary source/disabled/text/event skip | exact `{reason,sourceBoundary,status}` | none | M2-B MUST MAP OR REFUSE |
| S-02 | summary insert/duplicate/rejected | exact `{outcome,sourceBoundary,status}`; reasons not surfaced | PA/P-03 | M2-B MUST MAP OR REFUSE |
| S-03 | scheduler summary disabled | exact synthetic `{reason:'session_summary_disabled',status:'skipped'}` | none | M2-B MUST MAP OR REFUSE |

Producer grouping never changes transaction scope: each extraction candidate,
summary proposal, and scheduled turn remains a separate compatibility intent.
Earlier successful candidates/turns remain committed if a later one fails.

## 6. Bootstrap and terminal storage routes

Bootstrap is a pre-handle control-plane prerequisite, not a semantic intent.
Its CDX-M0/M1 schema/migration DML, rollback-scoped FTS integrity command, and
three-history verification must remain unreachable after publication and may
not be mistaken for a governed memory decision.

| ID | Storage branch | Explicit/implicit consequence | Disposition |
|---|---|---|---|
| F-01 | delete requested with live, in-flight, close-failed, or poisoned canonical path | `legacy_store_open`; no removal attempted | M2-B MUST REFUSE |
| F-02 | zero-live canonical path | remove main, `-wal`, `-shm`, `-journal` in the supported order; no atomic multi-file claim | M2-B MUST REFUSE |
| F-03 | native removal failure at any path | native failure; already removed filesystem artifacts are not falsely reported restored | M2-B MUST REFUSE |

Same-file terminal destruction cannot preserve or co-commit the authority
decision/journal stored in the file it removes. It therefore cannot be mapped
under the current B2 architecture. Only a separately reviewed and founder-
authorized external authority/receipt substrate could change that premise.

## 7. Defect flags that may never be normalized away

Every applicable pattern carries one or more of these flags:

- caller-asserted actor, writer, scope, target, policy, and clock;
- `explicit_user_action` and `ratify` labels without authenticated ceremony;
- creation confidence used as evidence/admission proxy;
- candidate `shared=1` without separate ratification;
- current permanent partition includes `preference` and omits `sensory`;
- cross-user duplicate selection;
- caller-supplied cross-Palari/cross-user supersession and link;
- supplied content hash not recomputed, including mismatching hash;
- mutable atom-row access/importance/sharing/validity fields;
- lifecycle automatic transient deletion instead of canonical demotion;
- empty-Palari lifecycle sweep across Palari boundaries;
- caller/store/evidence/native time differences; and
- target-by-ID operations without authenticated ownership.

M2-B completes only when a machine-checked artifact assigns every pattern one
reviewed map-or-refuse disposition, proves no branch disappeared, and verifies
that each accepted decision/journal/effect set co-commits on the A1 connection.

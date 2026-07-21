# Kernel API — governed memory, standalone

**Unit:** U2. **Author:** Fable 5. **Date:** 2026-07-18.
**Derived from:** `docs/KERNEL-CONTRACT.md` (normative here; the
Unified Specification Parts 4–5 win over both). **Implementation
substrate:** palari-v05 @ `190a4ad2` as mapped in
`docs/SOURCE-MAP.md`. Where this API asks more than the baseline code
gives, the gap is recorded inline and assigned to a unit — nothing is
forked silently.

**V2-M1 coexistence note:** this API remains the authoritative CDX-M1
runtime surface through M1. `docs/MEMORY-BUNDLE-CONTRACT.md` defines a
separate non-authoritative proof substrate in the same workspace SQLite
file, with internal transactional apply and a public verify/replay surface
that is read-only after `openMemoryBundle` performs its create-disabled
writable hot-journal recovery pass. M1 does not journal or dual-write these
APIs. The
later cutover requires Admit/Resolve and all canonical/projection
mutations to borrow one caller-owned SQLite connection and outer
transaction. Until that complete mutation matrix passes, the bundle
reports `sourceOfTruth:false`.

**V2-M2 staged transaction boundary:**
`docs/MUTATION-SEAM-CONTRACT.md` governs only M2-A1: a transaction coordinator
and private real B1/CDX composition falsifier. A1 imports into no current
runtime path. M2-A2 then routes the complete existing mutation surface as
explicitly legacy compatibility intents; it does not claim to implement the
Unified Specification's canonical patch calculus. M2-B must bind a minimal
trusted authority root outside proposals, define a provenance-pinned
Unified-Spec-conforming governed operation contract, and co-commit a disjoint
CDX-B2 decision/effect journal with every CDX projection effect. Every A2
legacy intent/effect must map to that governed contract or be deterministically
refused; compatibility labels never become B2 vocabulary. Production may not
derive authority from current caller-controlled `writer`, `actor`, `palari_id`,
or `user_id` fields, confuse creation confidence with evidence strength,
automatically erase on lifecycle decay, mutate permanent canonical payloads,
or carry the current type-partition debt into canonical state. V2-M3 retains
strict extractor schema, richer evidence derivation, assistant evidence,
corrected supersession policy, and complete candidate observability. CDX-M1
stays runtime/read authority and exact CDX-B1 stays unchanged and
non-authoritative until separately authorized evidence supports a later
cutover.

**Current conformance debt:** U4 implemented the bounded candidate gate
and hid raw add/supersede handles only on `createGatedStore`; U7 later
gated the adapter ingest path by passing a proposal-producing shim into
the baseline extraction helper. The exported raw extraction and session-
summary helpers can still receive a raw store, and the CDX-M1 surface also
directly forwards ownership deletion/topic-forget, lifecycle decay,
recall-inclusion telemetry, and store-internal link mutation. Those are
durable bypasses of the stronger one-gate law in
`docs/KERNEL-CONTRACT.md`; they are existing defects, not normative
exceptions. V2-M2 must type and route every one through the gate before any
source-of-truth cutover. M1 leaves them unchanged and makes no claim that
U4 or U7 already closed the complete durable mutation matrix.

## 1. Kernel boundary

**IN the kernel** (this repo, U3–U5):

| Concern | Interface group |
|---|---|
| SQLite store, schema, FTS5, per-workspace file | store |
| Typed write proposals, admission, resolution, apply | gate |
| Turn → candidate memories → gated writes | extract |
| Scoped FTS recall + one-hop link walk | recall |
| Answer-time briefing (labeled evidence block) | brief |
| Deletion: individual, topic-forget, whole-store | store |
| Lifecycle: decay, validity stamping, inclusion tracking | store (jobs) |

**OUT — product-side (explicit exclusions):**

- **LLM providers.** The kernel never calls a model. Extraction takes
  an injected `extractor` callback; answering is the adapter's job
  (U7). Live calls are founder-gated (U8+).
- **`private-memory.mjs`** — product feature (sanitized founder
  digest as read-only turn context; never writes, never gated). Its
  sanitization discipline is prior art for U11 only. (SOURCE-MAP
  finding 1.)
- **Chat/assistant runtime** (`assistant-brain.mjs` et al.): the
  kernel exposes `recallAndBrief`; placement into a conversation is
  the caller's.
- **Extraction scheduling** (`createMemoryExtractionScheduler`):
  background cadence is product wiring; the kernel exposes the
  synchronous pass. The LongMemEval adapter ingests synchronously.
- **Retrieval extensions** (vector planes, multi-hop graph): the
  contract permits them as optional planes, never silent
  replacements; **this repo does not build them** (charter:
  no self-expanded scope).
- **UI surfacing** of memories: out — but the kernel must *supply*
  origin metadata so any surface can show it (C7 below).

## 2. Data shapes

Names are JS-idiomatic. `CDX-M0` names the extracted baseline schema
(SOURCE-MAP: memories/memory_links/memory_fts + triggers); the current
authoritative runtime is `CDX-M1` after U4's recorded provenance-column
migration. The separate non-authoritative governed bundle uses `CDX-B1`.

```
MemoryAtom {
  id, palariId, userId|null, shared: bool,
  type: permanent {relationship,preference,opinion,entity,life_event}
      | transient {working,project,recent_life,session_summary},
  content, keywords[], importance: 0..1, confidence: 0..1,   // confidence-at-creation; permanent rows never mutate it
  provenance: {
    acquisitionMode: direct|told_to_me|extracted|summarized,
    createdByPipeline: bool,
    sourceMessageId|null,
    sourceKind: user_message|source_document|tool_output|web_result,
    extractor|null,          // GAP-1, see §7
  },
  validFrom, validUntil|null,        // evidence-time validity
  createdAt, lastAccessed|null, accessCount, lastDecayedAt|null,
  fictional: bool, contentHash,
}

WriteProposal {
  kind: demote | promote | permanent | ratify,      // admission order, cheap→ceremonial
  op:   add | supersede | end_validity | delete_transient | share,
  record: partial MemoryAtom,
  target?: memoryId,                  // supersede/demote targets
  provenance: { writer: background_extraction|explicit_user_action|session_summary,
                sourceKind, sourceMessageId?, extractor?, eventAt? },
}

RecallResult {
  memories: MemoryAtom[],             // ≤ contextBudget, ranked
  directCount, totalCandidates, keywords[], latencyMs,
}

Briefing {
  status: included | empty | disabled,
  text,                               // the labeled evidence block
  included: [{id, type, tier, rpath, ...}],
  tokensEstimate,
  diagnostics,                        // needle-survival probes
}
```

## 3. store

Factory: `createKernelStore({ dbPath | rootDir+workspaceId, clock? })`
(from v05 `createPalariMemoryStore` + `workspaceMemoryDbPath`).
Multi-workspace cache: `createKernelStoreManager` (from
`createWorkspaceMemoryManager`). Engine prerequisite: Node `>=22.22.2`
(the current provisional repository floor), `node:sqlite` `DatabaseSync`,
and FTS5 `unicode61 remove_diacritics 2`; `probeSqliteDriver()` self-checks
and the factory throws without it. U3's `>=22.5` value is the historical
theoretical API floor and is superseded for current repository work unless
the complete suite is certified on a lower exact release.

Reads (never gated — reading is not mutation):
- `getById(id)`, `list(scope)`, `search(query, scope, {limit})`
- `recall(query, scope, opts)` — §5.

Deletion & ownership (current CDX-M1 behavior, with M2 gate debt):
- `deleteMemory(id, {actor})` — removes the row; FTS residue removed
  by trigger, links by `ON DELETE CASCADE`. Contract test in U3:
  after delete, FTS query and link walk return nothing (residue-free).
  The frozen surface currently forwards this directly rather than as a
  typed proposal; that bypass is non-conforming debt, not an exception.
- `topicForget(topicQuery, scope, {actor})` — **new composed op**
  (SOURCE-MAP finding 2: no baseline method): `search(topicQuery,
  scope)` → `deleteMemory` each visible match, scoped to the
  requesting palari/user only; returns the deleted ids for user
  confirmation. It currently inherits the same direct-write debt.
- `deleteStoreFile()` — the whole per-workspace SQLite file
  (from `deleteWorkspaceMemoryDatabase`). One workspace = one file:
  portable, inspectable with any sqlite3, deletable as a unit.

Lifecycle currently has the same known bypass:
`runLifecycleJobs({palariId, now})` mutates transient decay/validity and
`recordRecallInclusion(ids, {actor})` writes inclusion telemetry through
forwarded store methods. V2-M2 must add exact typed operations for these,
ownership deletion/topic-forget, and any link mutation, then enumerate the
complete durable surface in a direct-write-fails test.

Ops: `status()`, `publicStatus()`, `close()`. Smoke: port of
`internal-alpha-memory-readiness` probe (provider-free canary).

## 4. gate

**Candidate-write door implemented in U4:**
`gate.propose(proposal: WriteProposal) →
{outcome, memory?, superseded?, link?, reasons[]}`. Callers that actually
hold the frozen surface can use this door for explicit user saves,
supersession, demote `end_validity`/`delete_transient`, and ratify `share`;
`addMemory`, `supersedeMemory`, `insertMemory`, and raw `db` are hidden
from that surface. U7's LongMemEval adapter also routes its extraction
writes through this door by supplying a gate shim. U4's completion test
proves only the bounded frozen-surface claim, not the stronger
all-durable-mutation law.

**Unclosed law:** the exported raw extraction helper, raw session-summary
helper, ownership deletion/topic-forget, lifecycle mutation,
recall-inclusion telemetry, and store-internal link writes still can bypass
`propose`. `docs/KERNEL-CONTRACT.md` remains normative: every durable
mutation must eventually be typed through Admit → Resolve → Apply. V2-M2
must close and test that complete matrix before the API may again claim a
single write door without qualification.

Three stages (contract: Admit → Resolve → Apply):

1. **Admit** — typed validation (type ∈ memoryTypes, writer ∈
   memoryAddWriters, actor ∈ memoryMutationActors — all baseline
   sets); **source boundary**: `sourceKind ∈ externalMemorySourceKinds
   ⇒ write_eligible must hold** (baseline
   `memorySourceBoundaryForCandidate`) — external content cannot mint
   memories, and what does get written carries origin provenance
   (C7); **threshold ordering** by proposal kind:
   `demote < promote < permanent < ratify` — evidence/confidence
   required rises with the kind; destructive direction stays cheap,
   authority direction stays ceremonial. Baseline mapping: demote =
   end-validity/decay/delete-transient; promote = insert transient;
   permanent = insert permanent type; ratify = explicit user
   confirmation / `shared=1` / acquisition upgrade. (GAP-2: baseline
   has no explicit ordering — U4 reifies it as `AdmissionPolicy`
   config with these defaults.)
2. **Resolve** — dedup (contentHash index + trigram similarity ≥0.85
   → `duplicate_bumped`, baseline `findSimilarCurrentMemory`);
   contradiction → the proposal resolves to a **supersession**
   (baseline extraction `findContradictedMemory`); **type-safe
   supersession**: a supersede resolves only within the same type
   partition (GAP-3: baseline inherits `existing.type` but does not
   enforce compatibility — U4 adds the check).
3. **Apply** — transactional SQL. Supersession is demote-and-promote
   in one transaction: old row gets `validUntil`, new row inserted,
   `supersedes` link written; the old row **survives** as
   counterfactual history (baseline `supersedeMemory`, verbatim).
   Permanent rows are never UPDATEd — the API exposes no
   content-mutation op; correction is only this path (C3).

**Evidence-time discipline (C2):** Apply stamps `validFrom` from
`provenance.eventAt` when the proposal carries it; wall clock is only
the fallback for genuinely-now events. The LongMemEval adapter (U7)
MUST pass session timestamps as `eventAt` — history replayed
yesterday must not look learned today. (GAP-4: baseline defaults to
`now`; the parameter exists, discipline is caller-side — the kernel
makes `eventAt` required for `extracted`/`summarized` provenance.)

## 5. extract

- `runExtractionPass({ store, turn, extractor, logger }) →
  {status, memoriesWritten, outcomes[], sourceBoundary}` — the exported
  baseline `runMemoryExtractionPass` still calls the supplied store-like
  object's add/supersede methods. U7's adapter passes a gate shim, so that
  adapter path emits `WriteProposal`s; a direct caller can still pass the
  raw store. V2-M2 must make the gate-bound dependency structural rather
  than caller-conventional.
- `extractor({turn}) → payload` is **injected**. Provided by kernel:
  `deterministicMockExtraction` (dry mode, U7 tests);
  `buildExtractionRequest({turn, budgets})` for real providers —
  token budgets become parameters (SOURCE-MAP severance:
  routing-policy functions parameterized).
- `writeSessionSummaryMemory({store, ...})` — the extracted helper still
  writes through the supplied store and is not structurally gate-bound.
  Its intended future proposal is `promote` class with
  `writer: 'session_summary'`; V2-M2 must implement that path before the
  intended shape becomes a conformance claim.
- Candidate hygiene stays in the pass: transient-detail rejection
  (`memoryContainsTransientDetail`), source-boundary evaluation per
  candidate, the anti-injection instruction pattern
  (`memorySourceInstructionPattern`).

## 6. recall + brief

- `recall(query, {palariId, userId}, {contextBudget=12, ftsLimit,
  linkCap, now}) → RecallResult` — baseline `recallMemories`:
  FTS5 top-k + one-hop bidirectional link walk + standing transient
  rows, deduped, importance/recency-ranked, budget-capped.
  **Mandatory predicates, not conventions:** missing `palariId`
  returns empty (baseline behavior, kept as a contract test);
  visibility = own rows + general (`userId IS NULL`) + `shared`;
  validity: expired (`validUntil ≤ now`) rows are excluded from
  default recall — which is exactly how superseded values stop being
  confidently recalled (C15). **Ranking is type-blind** (importance/
  recency only); standing-row *inclusion* is a window-law behavior,
  not a ranking bias (U5 verifies with a test).
- `brief(recallResult, {maxChars=1800, now}) → Briefing` — baseline
  `buildMemoryBriefing`. Briefing v1 line carries: content, timestamp
  (event-time, plus observed-time when they differ), session/source
  attribution (sourceMessageId / session summary ref / `source:<kind>`
  origin tag for external — C7 surfacing), confidence bucket.
  U5 pins the exact v1 line format golden-file style, because U9
  tunes it **by substitution only — paired runs, one variable per
  run** (process law, enforced in evals not in code).
- `recallAndBrief(text, scope, opts)` — the ~60-line orchestration
  reimplemented from `buildAssistantMemoryBriefing` (SOURCE-MAP
  finding 3): status-gate → recall → brief → `recordRecallInclusion`
  (needle-survival telemetry) → Briefing + latency/candidate counts.
- **Placement contract (C11):** the briefing is dynamic, labeled
  evidence — the adapter inserts it as clearly-attributed context,
  never as system authority, never unlabeled. `briefingDiagnostics
  (briefingText, promptText)` (baseline
  `memoryBriefingPromptDiagnostics`) lets the adapter *measure* that
  the briefing survived into the final prompt (C10: needle survival
  is measured, not presumed).
- **Honesty (C14/C16):** empty or below-confidence recall ⇒
  `Briefing.status='empty'` with an explicit absence line — no
  composing from an empty desk; the kernel never fabricates an atom
  (structural: recall/brief only ever surface stored rows; U5 property
  test: every content line in `Briefing.text` maps to a stored row).

## 7. Recorded gaps (spec > baseline; assigned, not silent)

| Gap | Baseline @190a4ad2 | Kernel resolution | Unit |
|---|---|---|---|
| GAP-1 provenance `extractor` + first-class `sourceKind` | no columns; origin only as in-band `source:<kind>` keyword tag | keep CDX-M0 verbatim in U3; U4 adds a recorded kernel migration (CDX-M1: `source_kind`, `extractor` columns), keeping the keyword tag for FTS/surfacing compat | U4 |
| GAP-2 explicit threshold ordering | implicit (writer sets, boundary checks; no demote<promote<permanent<ratify) | `AdmissionPolicy` with the contract's ordering as defaults; ordering test | U4 |
| GAP-3 type-safe supersession | inherits `existing.type`, no compatibility check | Resolve rejects cross-partition supersession | U4 |
| GAP-4 evidence-time required | `validFrom` defaults to wall clock | `eventAt` required for extracted/summarized provenance | U4 (+U7 adapter) |

Report-upstream note: GAP-1/3/4 are candidates to fix in palari-v05
itself (charter: fix in v05 first when it's a bug; these are spec
shortfalls — surfaced to the founder via STATUS, not patched by this
repo into v05).

## 8. Traceability — contract clause → interface or exclusion

Clause IDs quote `docs/KERNEL-CONTRACT.md` by section; every bullet
of the contract appears exactly once.

| # | Contract clause (section · bullet) | Maps to |
|---|---|---|
| C1 | Atoms · fields incl. provenance, scoping, hash, timestamps | §2 `MemoryAtom`; schema CDX-M0; GAP-1 |
| C2 | Atoms · evidence-time discipline | §4 Apply stamps from `eventAt`; GAP-4 |
| C3 | Atoms/types · permanent linear; correction = demote-and-promote w/ link; counterfactual history survives | §4 Apply (supersede transaction; no content-mutation op) |
| C4 | Atoms/types · transient use-or-decay; supersession type-safe | §3 lifecycle jobs; §4 Resolve type-safety (GAP-3) |
| C5 | Gate · typed proposal Admit→Resolve→Apply; no producer writes directly | §4 candidate-write door plus explicit non-conformance debt; V2-M2 must structurally gate raw extraction/session-summary and close ownership/lifecycle/touch/link bypasses before expanding the direct-write-fails test |
| C6 | Gate · thresholds demote < promote < permanent < ratify | §4 Admit `AdmissionPolicy` (GAP-2) |
| C7 | Gate · external content must not mint w/o provenance marking; surfacing shows origin | §4 Admit source boundary; §5 candidate hygiene; §6 briefing origin attribution |
| C8 | Retrieval · FTS + filters + optional graph walk; no vector default; extensions optional planes | §6 `recall`; §1 exclusion (no extension planes built here) |
| C9 | Retrieval · type-blind ranking; scoping mandatory predicates | §6 recall (type-blind rank test; empty-scope⇒empty result) |
| C10 | Retrieval · window laws: matched sources opened; no empty desk; needle survival measured | §6 recall candidates; `Briefing.status='empty'`; `recordRecallInclusion` + `briefingDiagnostics` |
| C11 | Briefing · dynamic labeled context, never system authority | §6 placement contract |
| C12 | Briefing · v1 line: content, event/observed timestamp, attribution, confidence bucket | §6 `brief` (golden format pinned in U5) |
| C13 | Briefing · format changes are substitutions: paired runs only | process → evals discipline (U9); not an interface, by design |
| C14 | Honesty · absence stated plainly; abstention-with-grounds = success in our reports | §6 honesty; reporting rule lives in evals (U8+ predictions/reports) |
| C15 | Honesty · newer supersedes older; superseded not confidently recalled | §4 Resolve contradiction→supersede; §6 validity predicate excludes expired |
| C16 | Honesty · never invent a memory | §6 structural property + U5 property test |
| C17 | Deletion · row + FTS/link residue removed | §3 `deleteMemory` + trigger/CASCADE; U3 residue-free test |
| C18 | Deletion · topic-forget scoped to requesting user/palari | §3 `topicForget` (new composed op) |
| C19 | Ownership · per-workspace SQLite file: portable, inspectable, deletable | §3 one-file-per-workspace + `deleteStoreFile` |

**Completion test — PASS:** KERNEL-CONTRACT.md contains 16 bullets
across 6 sections (mechanically counted); C1–C19 cover all 16.
Three bullets split into two clauses each for precision (16+3=19):
atoms·bullet 1 → C1/C2 (fields vs evidence-time), atoms·bullet 2 →
C3/C4 (permanent vs transient rules), briefing·bullet 2 → C12/C13
(v1 format vs substitution law). All other bullets map 1:1. Every
clause row names an interface section, an explicit exclusion, or the
now-explicit C5 conformance debt. The only process-only mappings are C13
and the reporting half of C14, routed to the evals discipline. Traceability
is complete; implementation conformance is not complete until V2-M2 closes
C5's remaining durable bypasses.

— Fable 5, U2, 2026-07-18. Design derived, gaps recorded, nothing
forked silently.

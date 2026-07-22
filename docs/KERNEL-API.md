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
and private real B1/CDX composition falsifier. At A1 certification no current
runtime path imported it; A2 now adopts it only beneath the private legacy
router. `docs/LEGACY-MUTATION-ROUTING-CONTRACT.md` governs M2-A2: it routes the
complete supported in-file semantic DML surface as exactly five legacy
compatibility intents and eight transaction-neutral effects, retires raw
returned mutation/database capabilities, and classifies bootstrap and terminal
file destruction honestly. The latter was a separate legacy storage route, so
A2 alone did not claim overall one-gate conformance or implement the Unified
Specification's canonical patch calculus. M2-B implementation `0017fee` and
completion hardening `d7bd9f9` now bind the minimal trusted authority root
outside proposals, apply the provenance-pinned governed operation contract,
and co-commit the disjoint CDX-B2 decision/effect journal with the sole mapped
CDX projection effect. Every other A2 intent/effect deterministically refuses;
compatibility labels never become B2 vocabulary. Production does not derive
authority from caller-controlled `writer`, `actor`, `palari_id`, or `user_id`
fields, confuse creation confidence with evidence strength, automatically
erase on lifecycle decay, mutate permanent canonical payloads, or carry the
current type-partition debt into canonical state. The complete M2 production
matrix leaves no supported in-file bypass, so parent M2 is closed. V2-M3
retains strict extractor schema, richer evidence derivation, assistant
evidence, corrected supersession policy, and complete candidate observability.
CDX-M1 stays runtime/read authority and exact CDX-B1 stays unchanged and
non-authoritative until separately authorized evidence supports a later
cutover.

**V2-M2-A1 certified internal surface (`07d65ad`):**
`src/mutation-coordinator.mjs` exports exactly `MemoryMutationError`,
`createMutationCoordinator`, and `assertActiveMutationLease`.
`createMutationCoordinator(db).run(callback)` synchronously sets and verifies
the five A1 connection PRAGMAs, owns one `BEGIN IMMEDIATE`/`COMMIT` boundary,
and supplies an opaque connection-bound lexical lease. The private acceptance
test composes unchanged B1 transactional apply with the extracted
transaction-neutral CDX insert on the same file-backed connection and proves
joint invisibility-before-commit, visibility-after-commit (including FTS), and
residue-free joint rollback. At A1 certification no runtime module imported
this surface. M2-A2 now adopts it only through the private legacy router; it
remains neither a producer API nor a governed operation/journal contract.

**M2-A2 certified compatibility boundary (`e6bbc51`):** supported callers
receive an exact
read-only base handle or exact gated handle, neither exposing `.db`, schema,
or raw insert/add/supersede/link/bump/touch operations. Proposal, direct
delete, topic forget, recall inclusion, and lifecycle map to the five A2
legacy intents; their possible CDX writes map to the eight A2 effects. Schema
completion and exact manifest verification occur before handle return through
a runtime that owns native construction/cleanup directly; no production
module imports the quarantined extracted raw store at `src/memory-store.mjs`.
Whole-store deletion is a serialized zero-live-handle storage-lifecycle
operation, not a false SQLite co-commit. This closes the supported in-file raw
writer graph only. It does not authenticate current callers, repair recorded
legacy semantics, define canonical patches or a trusted authority root,
journal decisions, make B1 authoritative, or establish overall one-gate
conformance. Those bounded debts are closed only by the certified M2-B bridge
described below; the historical A2 claim remains narrow.

**M2-B scoped operation ruling:** the governed bridge may expose only the
`FB1-4.ratified-erasure-apply-v1` structural Apply amendment recorded in
`docs/KERNEL-CONTRACT.md`. Its canonical patch is the pinned
`ratify|ratified_user -> provenance` pair at evidence strength `1.0`, ledger
visibility/rank `1`, with target slot `mem/<targetId>` and closed payload
`erase_owned_atom@1`. After exact authority, Admit, and singleton Resolve, its
pure transition may consume exactly one present same-Palari/same-user private
zero-link atom plus its exactly-one FTS membership. It applies equally to
permanent or transient and current or ended atoms because erasure is a
separate ratified storage operation, not payload mutation or correction. All
other target states refuse or roll back exactly as the governed contract
specifies. This does not add a general `ratify` handler or authorize demotion,
edge writes, shared/general/cross-scope erasure, or any other mutation.

**M2-B certified production boundary (`0017fee` + `d7bd9f9`):** the bridge is
the sole production A1 owner. A trusted synchronous manager adapter captures
one authority provider outside transaction and proposal surfaces; its exact
manager-provider capture edge is
`store -> workspace-manager-authority -> authority runtime`.
Only an authority-bound private zero-link erasure reaches the exact historical
projection token. Its B2 decision, ordered atom/FTS effects, CDX deletion, and
head transition are one transaction. Candidate creation, duplication,
supersession, link/demotion/share/topic/recall/lifecycle/extraction/summary/
scheduler writes and terminal storage deletion retain exact refusal shapes and
zero semantic effects. This closes the V2-M2 falsifier, not the remaining
feature debts or a source-of-truth cutover.

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
  content, keywords[], importance: finite, confidence: finite,
      // A2 legacy inserts allow unbounded finite values; Unified target 0..1.
      // Confidence is confidence-at-creation; permanent rows never mutate it.
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

Factory: `createKernelStore({memoryRootDir | statePath, workspaceId,
clock?, memoryEnabled?, publicDemo?, authorityRoot?})`, adapted from v05
`createPalariMemoryStore` + `workspaceMemoryDbPath` behind a safe base
capability. `authorityRoot` is the optional host-only M2-B field defined in
`docs/MEMORY-AUTHORITY-CONTRACT.md`; it is ignored without observation for a
disabled store and never appears in returned config. Multi-workspace cache:
`createWorkspaceMemoryManager({clock?, env?, memoryEnabled?, memoryRootDir?,
policy?, publicDemo?, statePath?, authorityRootForWorkspace?})`, with the exact
trusted synchronous provider and construction-precedence law in that contract.
Engine prerequisite: Node `>=22.22.2`
(the current provisional repository floor), `node:sqlite` `DatabaseSync`,
and FTS5 `unicode61 remove_diacritics 2`; `probeMemorySqliteDriver()` self-checks
and the factory throws without it. U3's `>=22.5` value is the historical
theoretical API floor and is superseded for current repository work unless
the complete suite is certified on a lower exact release.

Reads (never gated — reading is not mutation):
- `getMemoryById(id)`, `listMemories(scope)`, and
  `searchMemories(query, options)`;
- `recallMemories(query, options)` — §6.

Deletion & ownership (current M2-B surface; this supersedes the historical
U3/A2 behavior formerly carried by these names):

- gated `deleteMemory(id, options, authorityGrant)` is the only production
  route that can reach a governed semantic mutation. Disabled and omitted-
  authority precedence inspect neither `id` nor `options`. A present grant is
  reserved before their capture. Only an exact, externally active grant for a
  present same-Palari/same-user private atom with one FTS row and zero incident
  links can erase; the atom delete and FTS-trigger result co-commit with the
  B2 decision/effects. Links never cascade on an accepted M2-B operation.
- gated `topicForget(...)` is a deterministic no-write refusal returning
  `{count:0,deleted:[]}`. It does not run the historical A2 batch.
- `deleteKernelStoreFile(...)` returns an immediately rejected native Promise
  whose reason is `legacy_terminal_storage_refused`, before observing options,
  path, live-owner, or filesystem state. It removes no artifact.
- gated `runLifecycleJobs(...)` returns
  `{decayed:0,deleted:0,skipped:0,touched:0}` and
  `recordRecallInclusion(...)` returns `{touched:[],touchedCount:0}` without
  semantic DML. Their A2 mutation behavior is retained only in historical
  planner tests until a separately governed operation is reviewed.

Ops: `status()`, `publicStatus()`, `close()`. Smoke: port of
`internal-alpha-memory-readiness` probe (provider-free canary).

## 4. gate

**Current M2-B candidate surface:** `gate.propose(proposal)` returns exactly
`{outcome:'rejected',reasons:['governance_refused']}` without observing the
proposal. The U4/A2 proposal implementation and its five-intent/eight-effect
router remain historical compatibility evidence and test fixtures; production
does not execute them. No returned base, gate, or manager handle exposes a raw
connection, authority constructor/root/grant, coordinator, lease, B2 writer,
projection applier, or other child semantic writer.

M2-B closes the current production graph by governing the one supported
ratified-erasure leaf and refusing every other A2 branch before CDX semantic
DML. CDX-M1 remains runtime/read authority; B2 is the co-committed governance
overlay. This completes neither the deferred create/supersession operations of
M3 nor a source-of-truth cutover.

The following three stages describe the historical U4/A2 proposal behavior
and the canonical laws M3 must restore; they are not a writable M2-B public
proposal path. M2-B's only production instance of Admit -> Resolve -> Apply is
the exact ratified-erasure patch and pure transition above.

Three stages (contract: Admit → Resolve → Apply):

1. **Admit** — typed validation (type ∈ memoryTypes, writer ∈
   memoryAddWriters, actor ∈ memoryMutationActors — all baseline
   sets); **source boundary**:
   `sourceKind ∈ externalMemorySourceKinds ⇒ write_eligible must hold` (baseline
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
   The Unified target keeps permanent canonical payloads linear: correction is
   demote-and-promote, never payload replacement. A2 exposes no content-
   replacement operation, but its explicitly legacy effects still mutate CDX
   validity, sharing, importance, access, and decay metadata. M2-B refuses
   those compatibility branches. Its separately recorded ratified-erasure
   amendment may consume permanent storage membership but never edits or
   corrects permanent payload (C3).

**Evidence-time discipline (C2):** Apply stamps `validFrom` from
`provenance.eventAt` when the proposal carries it; wall clock is only
the fallback for genuinely-now events. The LongMemEval adapter (U7)
MUST pass session timestamps as `eventAt` — history replayed
yesterday must not look learned today. (GAP-4: baseline defaults to
`now`; the parameter exists, discipline is caller-side — the kernel
makes `eventAt` required for `extracted`/`summarized` provenance.)

## 5. extract

- `runMemoryExtractionPass({store: gated, turn, extractor, extractorId,
  logger}) → {status, memoriesWritten, outcomes[], sourceBoundary}` requires
  the module-branded gated capability. It may still derive historical A2
  candidates, but every production `propose` returns the exact governance
  refusal without CDX/B2 mutation. M3 owns restoration under trusted evidence.
- `extractor({turn}) → payload` is **injected**. Provided by kernel:
  `deterministicMockMemoryExtraction` (dry mode, U7 tests);
  `buildMemoryExtractionRequest({turn})` for real providers —
  request budgets stay pinned through the local routing-policy severance shim
  recorded in `docs/SOURCE-MAP.md`.
- `writeSessionSummaryMemory({store: gated, turn})` likewise receives the
  deterministic proposal refusal. Complete trusted summary lineage and
  candidate receipts remain V2-M3 work.
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
  finding 3): status-gate -> recall -> brief -> the current no-write
  `recordRecallInclusion` compatibility result -> Briefing +
  latency/candidate counts. Needle-survival remains measurable from returned
  diagnostics; durable inclusion telemetry is refused in M2-B.
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
| C2 | Atoms · evidence-time discipline | §4 historical Apply stamps from `eventAt`; M2-B erasure uses the authority evidence/observed-time law; GAP-4 |
| C3 | Atoms/types · permanent linear; correction = demote-and-promote w/ link; counterfactual history survives | §4 historical Apply; current M2-B refuses correction and permits only separately ratified storage erasure under the scoped amendment |
| C4 | Atoms/types · transient use-or-decay; supersession type-safe | §3 M2-B lifecycle refusal; §4 historical Resolve type-safety (GAP-3); restoration remains M3 |
| C5 | Gate · typed proposal Admit→Resolve→Apply; no producer writes directly | §4: M2-B runs the exact ratified-erasure patch through the gate and deterministically refuses every other A2 branch before semantic DML; decision/journal/projection co-commit is the parent-M2 falsifier |
| C6 | Gate · thresholds demote < promote < permanent < ratify | §4 exact pinned patch registry/config; M2-B emits only ratify at `1.0`; historical `AdmissionPolicy` is not production authority |
| C7 | Gate · external content must not mint w/o provenance marking; surfacing shows origin | §4 Admit source boundary; §5 candidate hygiene; §6 briefing origin attribution |
| C8 | Retrieval · FTS + filters + optional graph walk; no vector default; extensions optional planes | §6 `recall`; §1 exclusion (no extension planes built here) |
| C9 | Retrieval · type-blind ranking; scoping mandatory predicates | §6 recall (type-blind rank test; empty-scope⇒empty result) |
| C10 | Retrieval · window laws: matched sources opened; no empty desk; needle survival measured | §6 recall candidates; `Briefing.status='empty'`; `briefingDiagnostics`; durable inclusion mutation is refused in M2-B |
| C11 | Briefing · dynamic labeled context, never system authority | §6 placement contract |
| C12 | Briefing · v1 line: content, event/observed timestamp, attribution, confidence bucket | §6 `brief` (golden format pinned in U5) |
| C13 | Briefing · format changes are substitutions: paired runs only | process → evals discipline (U9); not an interface, by design |
| C14 | Honesty · absence stated plainly; abstention-with-grounds = success in our reports | §6 honesty; reporting rule lives in evals (U8+ predictions/reports) |
| C15 | Honesty · newer supersedes older; superseded not confidently recalled | existing CDX validity + §6 predicate; new supersession is refused until M3 restores a governed operation |
| C16 | Honesty · never invent a memory | §6 structural property + U5 property test |
| C17 | Deletion · row + FTS/link residue removed | §3 exact authority-bound private zero-link erasure removes atom + FTS; linked targets refuse because no edge patch is registered |
| C18 | Deletion · topic-forget scoped to requesting user/palari | §3 deterministic no-write refusal; broader topic authority/operation is explicit conformance debt |
| C19 | Ownership · per-workspace SQLite file: portable, inspectable, deletable | file remains portable/inspectable; same-file B2 makes production terminal deletion an unconditional refusal pending an external authority/receipt substrate |

**Completion test — PASS:** KERNEL-CONTRACT.md contains 16 bullets
across 6 sections (mechanically counted); C1–C19 cover all 16.
Three bullets split into two clauses each for precision (16+3=19):
atoms·bullet 1 → C1/C2 (fields vs evidence-time), atoms·bullet 2 →
C3/C4 (permanent vs transient rules), briefing·bullet 2 → C12/C13
(v1 format vs substitution law). All other bullets map 1:1. Every
clause row names an interface section, an explicit exclusion, or a recorded
conformance debt. The only process-only mappings are C13 and the reporting
half of C14, routed to the evals discipline. Traceability is complete as an
honest map, not a claim that every feature is enabled. M2-B has certified its
trusted authority, exact ratified-erasure operation, exhaustive refusals, and
decision/journal/effect co-commit, closing parent M2. M3 and the separately
reviewed topic/terminal authority substrates retain the named feature debts.

— Fable 5, U2, 2026-07-18. Design derived, gaps recorded, nothing
forked silently.

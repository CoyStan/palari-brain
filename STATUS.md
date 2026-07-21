# STATUS — single source of truth for the loop

Loop state: RUNNING
Baseline source commit (palari-v05 main): 190a4ad2
Next: V2-M2-B Task 5 / M2-B-05 — IMPLEMENT THE PRODUCTION BRIDGE AND
RATIFIED ERASURE. Follow the sealed plan: first write the RED sole-A1-owner,
seven-export historical-router, governed-token, authority-order, canonical-
patch, full target matrix, refusal/receipt, fault-ordinal, clock/ledger race,
and second-connection visibility proofs; then refactor A2 into a transaction-
neutral planner/projection applier and route only the exact ratified private
zero-link erasure through the bridge. Do not begin Task 6 producer/terminal
refusal work before Task 5 passes. CDX-M1 remains runtime/read authority,
exact B1 remains unchanged/non-authoritative, and parent M2/M2-B remain open.

U8 is SEALED as a failed 9/10 reference baseline. Do not execute final
question `1568498a`, resume, re-roll, grade publicly, or publish without a
new explicit founder GO. Results remain under gitignored evals/results/.

## Unit queue

- [x] U1 — Source map. DONE 2026-07-18 (Fable 5), deliverable
  docs/SOURCE-MAP.md. Completion test PASS: all 16 named paths verified
  present at baseline 190a4ad2 (blob hashes recorded in the map). Key
  findings carried to U2: (a) private-memory.mjs is EXCLUDED from the
  kernel (product feature; its sanitization pattern is prior art for
  U11); (b) no topicForget store method exists — topic-forget must be
  composed from listMemories/searchMemories + deleteMemory; (c) recall
  is a store primitive (recallMemories); the "assistant runtime recall
  path" is only ~60 lines of orchestration in assistant-brain.mjs's
  buildAssistantMemoryBriefing, to reimplement, not lift; (d) only
  non-builtin runtime need is node:sqlite + FTS5 (record min Node
  version in U3); (e) severance is small — vendor booleanEnv/slugify
  from shared.mjs, parameterize 2 token-budget fns from
  assistant-routing-policy.mjs. Amended REFERENCES.md's imprecise
  "memory-*.test.js (6 files)" glob (matches 5; 6th is
  internal-alpha-memory-readiness.test.js).
- [x] U2 — Kernel API design. DONE 2026-07-18 (Fable 5), deliverable
  docs/KERNEL-API.md. Completion test PASS (mechanical): contract has
  16 bullets; traceability table C1–C19 covers all 16, each mapping to
  an interface or an explicit exclusion (only C13 and the reporting
  half of C14 route to evals process, recorded as such). Design core:
  gate.propose(WriteProposal) is the designed write door — Admit (types,
  writers, source boundary, threshold order demote<promote<permanent<
  ratify) → Resolve (dedup, contradiction→supersede, type-safety) →
  Apply (transactional; supersede = demote-and-promote + link,
  history survives). Four recorded gaps where the spec asks more than
  baseline v05 gives, all assigned: GAP-1 extractor/sourceKind
  provenance columns (U4, kernel migration CDX-M1); GAP-2 explicit
  threshold ordering (U4 AdmissionPolicy); GAP-3 type-safe
  supersession check (U4); GAP-4 eventAt required for extracted/
  summarized provenance (U4+U7). FOUNDER note: GAP-1/3/4 are spec
  shortfalls in palari-v05 itself — candidates to fix upstream;
  flagged here rather than patched cross-repo.
- [x] U3 — Extract store + schema + FTS. DONE 2026-07-18 (Fable 5).
  Deliverables: src/memory-store.mjs (1112 lines verbatim from
  baseline blob 4f67d0fe96dd, one severed import), src/util.mjs
  (vendored booleanEnv/slugify from shared.mjs blob b47ebc15716f),
  src/store.mjs (kernel wrapper: createKernelStore + NEW topicForget
  composed op + deleteKernelStoreFile), tests/store.contract.test.mjs
  (8 contract tests: create/provenance, writer rejection, type
  partition, FTS+palari scoping incl. empty-scope⇒empty, user
  visibility own+general+shared, residue-free delete vs raw FTS/link
  tables, topic-forget scope isolation, per-workspace file ownership).
  Completion PASS: 8/8 green (node --test, TDD red watched first:
  ERR_MODULE_NOT_FOUND), no v05 imports (all targets are node:
  builtins or kernel-relative — verified by grep). Decisions recorded
  in docs/DECISIONS.md: zero-dep node:test runner; engine floor Node
  >=22.5 (node:sqlite experimental accepted, self-probed). Note for
  U4: store still exposes addMemory/supersedeMemory directly — the
  gate unification (propose as sole door) is U4's job, per plan.
- [x] U4 — Admission gate path. DONE 2026-07-18 (Fable 5).
  Deliverables: src/gate.mjs (createMemoryGate/createGatedStore/
  createAdmissionPolicy/applyKernelMigrations),
  tests/gate.contract.test.mjs (14 tests). Bounded completion PASS:
  candidate direct writes fail (gated surface exposes no
  addMemory/supersedeMemory/insertMemory/db, frozen), and gated candidate
  writes pass; suite 22/22 green. This did not prove the complete C5
  mutation surface: ownership, lifecycle, recall-inclusion, and internal
  link writes remain explicit V2-M2 gate debt.
  All four U2 gaps closed at kernel layer, baseline file untouched:
  GAP-1 migration CDX-M1 (source_kind + extractor columns, recorded
  in memory_migrations; keyword marking kept), GAP-2 AdmissionPolicy
  with enforced order demote<promote<permanent<ratify (default floors
  0/.25/.6/.75 are KERNEL-CHOSEN values, recorded in gate.mjs — not
  baseline behavior), GAP-3 type-safe supersession (partition check),
  GAP-4 eventAt required for background_extraction/session_summary,
  valid_from stamped from eventAt. Kinds/ops: promote|permanent
  x add|supersede; demote x end_validity|delete_transient (transient
  only); ratify x share (explicit_user_action only). Ownership ops
  (deleteMemory/topicForget) stay user-side on the frozen surface but
  currently bypass typed proposals; V2-M2 must close that debt.
  Note for U5/U7: extraction pass still calls store.addMemory
  directly (baseline); U5/U7 rewire runMemoryExtractionPass writes
  through gate.propose per KERNEL-API §5.
- [x] U5 — Recall + briefing. DONE 2026-07-18 (Fable 5).
  Deliverables: src/memory-extraction.mjs (950 lines verbatim, blob
  d8367ceb900c, one severed import -> src/routing-budgets.mjs vendored
  shim pinning memory_extraction budgets 8000/0 from registry@baseline),
  src/memory-briefing.mjs (verbatim, blob 69578eb05beb = briefing v0,
  kept as U9 paired-run comparator), src/recall.mjs (NEW:
  buildBriefingV1 per contract C12 — event-time + "observed" when
  differing, session/source attribution, confidence buckets
  high>=.75/medium>=.45/low kernel-chosen and recorded, external
  origin surfaced per C7; recallAndBrief orchestration rewritten from
  assistant-brain per SOURCE-MAP finding 3; tier logic replicated from
  v0 so U9 pairs vary line format only; explicit absence text on empty
  recall per C14/C16), tests/recall.contract.test.mjs (9 tests, fixtures
  seeded through the gate). Completion PASS: 31/31 green (9+14+8), no
  v05 imports. Recorded deferrals: (a) associative-link minting has no
  gate op — only supersession creates links kernel-side; test-only
  links use the raw store. This is part of the V2-M2 durable-bypass
  closure, not a conditional eval-only revisit;
  (b) extraction pass still writes via baseline store door — U7 wraps
  it with a gate-shim so ingest emits WriteProposals (noted in
  src/memory-extraction.mjs header).
- [x] U6 — LongMemEval intake. DONE 2026-07-18 (Fable 5). License
  checked FIRST: MIT verified at both the canonical repo LICENSE
  (© 2024 Di Wu) and the HF dataset card (longmemeval-cleaned) —
  verdict PERMITTED, recorded in docs/DECISIONS.md; no download
  performed (deferred until U8 prep needs it). Format pinned from the
  repo README + generator source: timestamps "%Y/%m/%d (%a) %H:%M"
  (no timezone — treated as UTC, recorded assumption; ordering exact).
  Deliverables: src/longmemeval.mjs (loader -> kernel session shape;
  session timestamps become eventAt so U7 ingest satisfies GAP-4
  evidence-time; validates aligned haystack arrays, roles, the 6
  question types; _abs abstention detection),
  tests/fixtures/longmemeval-mini.json (3 SYNTHETIC instances:
  multi-session, knowledge-update, abstention — no real data in git),
  tests/longmemeval.contract.test.mjs (5 tests). Completion PASS:
  36/36 green; data/ confirmed gitignored. FOUNDER note: a
  LongMemEval-V2 exists now — classic remains the target per charter;
  switching/adding V2 is the founder's call (noted in DECISIONS).
- [x] U7 — Adapter. DONE 2026-07-18 (Fable 5). Deliverables:
  src/adapter.mjs (gate-shim: baseline runMemoryExtractionPass writes
  land as WriteProposals via gate.propose with per-session eventAt +
  extractorId — adapter-ingest candidate add/supersede writes are gated
  with zero baseline edits; this is not complete one-gate conformance,
  because answer-time recall-inclusion telemetry and the remaining CDX-M1
  durable bypasses are V2-M2 debt; ingestChatTurn/ingestLongMemEvalInstance;
  answerQuestion: recallAndBrief -> prompt -> injected provider;
  stubProvider answers only from the briefing and abstains plainly;
  NO api-key code exists — live provider runner is U8 FOUNDER GATE),
  tests/adapter.contract.test.mjs (4 e2e dry tests: multi-session
  ingest+answer, knowledge-update supersession through the gate w/
  C15 recall behavior, abstention honesty, injection-boundary drop —
  the CASE-memory-source-injection-minting class shown impossible in
  a test). Completion PASS: end-to-end stub tests green, suite 40/40.
  FINDING for U8 predictions (pre-register this): the baseline write
  boundary requires assertive first-person user evidence
  (assertiveUserSentences grammar) — synthetic fixtures had to be
  rephrased to it. On real LongMemEval histories expect conservative
  ingest coverage; predict weakest: single-session-assistant (facts
  asserted by the assistant get no direct-user-evidence and are not
  external-source), and casual phrasings dropped. This is a finding
  to measure, not to silently patch.
- [~] U8 — FOUNDER GATE: first live slice (10 questions). GO RECEIVED
  2026-07-18 (Quetzali: "use MIT, i agree with the rest"). Dataset,
  Gemini 2.5 Flash-Lite, and estimated <$1 spend were initially approved.
  The new API user cannot access 2.5 (`404 NOT_FOUND`); before scoring,
  Quetzali approved Google's stable successor Gemini 3.1 Flash-Lite and
  a $1.25 cap (estimated ~$1.06). Publish gate remains closed.
  Predictions are FINAL and unchanged from the pre-GO
  draft; deterministic slice + dataset hash pinned. Prompt-config hash
  corrected BEFORE any live call to cover the full extraction request,
  briefing v1 included/empty surfaces, and answer framing. First live
  invocation failed authentication before scoring: the new authorization
  key was sent through the runner's legacy `?key=` transport and rejected;
  no result file was produced. Transport now uses `x-goog-api-key`, retries
  transport failures only, aborts on exhausted extraction transport, and
  checkpoints completed questions to prevent re-rolls. With transport
  corrected, the 2.5 endpoint returned model-unavailable before scoring;
  3.1 metadata is now amended and sealed (suite 47/47).
  Runtime key is project-local, gitignored, mode 0600; never logged or
  committed. Founder stopped execution after the currently running
  question completed: 9/10 results are checkpointed; final question
  `1568498a` has no result and must not run without a new GO. Partial
  report remains in gitignored evals/results/.
- [x] V2-M1 — Governed memory bundle substrate. DONE 2026-07-21.
  Preceding implementation commit: 3cdef74. Completion PASS: 208/208 tests,
  zero failures, on exact Node 22.22.2 / SQLite 3.51.2. The completed proof
  covers exact public surfaces and 19-code vocabulary; atomic/race-safe
  initialization; content-free append-only decisions and governedly erasable,
  immutable-while-present atoms; exact-sequence CAS; authority, transition,
  retained-scope, and ID
  non-reuse rules; main-qualified manifest/trigger/CHECK defenses; caller-owned
  transaction composition and rollback; deterministic fail-closed
  verify/replay; create-disabled hot-journal recovery before read-only open;
  and unchanged same-file CDX-M1 schema/data/FTS/links/gate behavior with no
  dual write. The bundle remains `sourceOfTruth:false`; CDX-M1 remains runtime
  authority. No physical-deletion, deletion-proof, signature, cryptographic
  audit, external-anchor, provider, benchmark, or publication claim was made.
- [ ] V2-M2 — One-connection mutation seam. Refactor current projection
  writes to borrow the gate coordinator's transaction; close direct
  semantic bypasses and co-commit governed decisions with projection effects.
  The independently reviewed staged contract and certified historical A1 plan
  are `docs/MUTATION-SEAM-CONTRACT.md` and
  `docs/superpowers/plans/2026-07-21-one-connection-mutation-seam.md`;
  the current executable plan is named under A2 below.
  - [x] V2-M2-A1 — transaction coordinator only. DONE 2026-07-21,
    implementation commit `07d65ad`. Exact three-export internal surface;
    captured native dispatch; five-PRAGMA synchronous outer owner; opaque
    lexical lease; twelve-code deterministic failure/cleanup/poison law; and a
    private real B1/CDX same-connection visibility, commit, FTS, and rollback
    falsifier. Completion PASS on exact Node 22.22.2 / SQLite 3.51.2: focused
    coordinator+composition 31/31, pre-A1 208/208, full suite 239/239, full B1
    161/161. At the A1 certification cut point,
    `src/mutation-coordinator.mjs` was the sole new production file and no
    runtime module imported it; A2 now adopts it beneath the private legacy
    router. Protected B1 files remain identical to `616c60b`; the sole
    coexistence-test diff only classifies the new module as
    A1-isolated/node-only/B1-unaware. At that cut point A1 changed no runtime
    mutation path, closed no durable bypass, proved no native transaction
    identity, and left CDX-M1 authoritative, B1 unchanged/non-authoritative,
    and parent M2 open.
  - [x] V2-M2-A2 — legacy compatibility mutation routing. DONE 2026-07-21;
    implementation `e6bbc51`, certification hardening `d419fef`. Exactly five
    legacy intents reach exactly eight lease-checked CDX effects under A1;
    returned base/gated/manager paths expose no raw connection or child writer;
    extraction, summary, scheduler, adapter, recall, ownership, topic, and
    lifecycle producers are structurally gate-bound; bootstrap/manifest work is
    pre-handle; and terminal deletion is a separately serialized zero-live-
    handle storage route. Completion PASS on exact Node 22.22.2 / SQLite
    3.51.2: router+routing 63/63, manifest matrix 97/97, full B1 164/164,
    pre-A2 regressions 272/272, full suite 432/432, and M2-A2-07 static audit
    3/3, all with zero failures. `docs/MEMORY-BUNDLE-CONTRACT.md`, all seven
    `src/memory-bundle*.mjs` modules, and `src/memory-store.mjs` are byte-
    identical to `1d65bb0`; B1 test-harness changes were reviewed separately
    and pass. Three fresh independent final audits ended with no unresolved
    blocker or major. This closes only the supported in-file raw writer graph:
    caller authority remains untrusted, legacy semantics remain noncanonical,
    B2 journaling/co-commit and terminal-route disposition remain M2-B work,
    exact B1 remains unchanged/non-authoritative, CDX-M1 stays runtime/read
    authority, and parent M2 remains open.
  - [ ] V2-M2-B — bind a trusted authority root outside proposals; add a
    provenance-pinned, Unified-Spec-conforming governed operation contract,
    disjoint CDX-B2 journal, and legacy checkpoint; every A2 legacy intent maps
    to a valid governed operation or deterministic refusal, and governed
    decisions, ordered journal effects, and CDX projection effects co-commit.
    Contract Task 0 DONE 2026-07-21 at `a128f1e`: four reviewed normative
    artifacts pin the authority profile, exact @5 disposition registry,
    four-table B2 substrate, governed projection/terminal seams, and executable
    implementation plan. Completion PASS for this documentation cut point:
    registry 46 obligations/22 dimensions/72 staged cases/1,728 erasure cases;
    config 5,704 ASCII bytes at
    `e1ded27e33516d73c60da1f4a4c9cb0767b1bb0b1482e78b429449ec7c0b07f4`;
    SQL 4 tables/1 explicit index/8 autoindexes/3 FKs/11 triggers; full
    unchanged suite 432/432 on Node 22.22.2 / SQLite 3.51.2; protected B1
    bytes and local links exact; three final independent reviews with zero
    blockers or majors. No production/test file changed at that cut point.
    Task 1 / M2-B-01 DONE 2026-07-21 at `220be3b`: exact five-export public
    and twelve-export internal authority surfaces now implement opaque private
    roots/audiences/grants/reservations, immutable capture, one-generation
    ledger binding, ID non-reuse, native-clock high-water, callback/postcheck
    precedence, and release/burn/retire settlement. Completion PASS on exact
    Node 22.22.2 / SQLite 3.51.2: focused authority 37/37 and full suite
    469/469, zero failures; exact export identity and protected-B1 byte checks
    pass; three independent final reviews report zero blockers or majors.
    The authority modules are not yet wired to the store, B2, A1, bridge, or
    producers, so no durable mutation path or source-of-truth claim changed.
    Task 2 / M2-B-02 DONE 2026-07-21 at `e362fe6`: the exact four-export
    `CDX-M1-legacy-disposition@5` module now contains the reviewed 46-row,
    22-dimension frozen registry and complete route/phase evaluator. The
    normative/source body is byte-equal and the registry document is pinned at
    SHA-256
    `70d1d966cb8e5550c26b4ccac2b7b4193a564b0d8d7c01dfc4c92fb8b5a0df74`.
    Closed ordinary/null-prototype inputs, own-data fields, trap-free Proxy
    rejection, primitive route/capture domains, captured dispatch, and
    null-prototype iteration prevent inherited/coerced inputs from minting MAP
    or corrupting verification; F-01/F-02/F-03 remain zero-observation. Exact
    MAP remains limited to D-02/D-03. Completion PASS on exact Node 22.22.2 /
    SQLite 3.51.2: focused registry 22/22, registry+coexistence 28/28, and full
    suite 491/491, zero failures; 496 terminal pairs, 64 generic outcomes, 72
    staged-authority cases, and 1,728 erasure cases are checked. Protected B1
    bytes are unchanged and three final independent reviews report zero
    blockers or majors. The module has only the documented side-effect-free
    `node:util` dependency and no store, B1, B2, A1, bridge, runtime, or producer
    wiring, so no durable mutation path or source-of-truth claim changed.
    Task 3 / M2-B-03 DONE 2026-07-21 at `5fb4418`: exact six-export
    dependency-leaf schema and the truthful three-export head-zero journal now
    implement the atomic three-layout B2 checkpoint under one A1 lease, with
    captured native clock/UUID/SQLite dispatch, explicit main-schema
    qualification, complete prepublication verification, and the sole
    certified ordinary M0/M1 structural-completion exception. Runtime gained
    only the exact B2 negative allowlist needed for the historical opener to
    reach and reject the third migration row; it does not bootstrap or use B2.
    Completion PASS on exact Node 22.22.2 / SQLite 3.51.2: schema/journal/
    instrumentation/runtime/coexistence 129/129 and full suite 517/517, zero
    failures; 136 injected rollback/retry cases plus the post-native-COMMIT
    uncertainty proof pass. Numeric/string payload canaries, TEMP-shadow main
    scoping, exact target/FK allowlists, and old-opener stage traces are non-
    vacuous. Protected B1 bytes are unchanged and three final independent
    reviews report zero blockers or majors. Append, reducer, transition,
    bridge, runtime cutover, producer, and source-of-truth claims remain
    absent; Next is Task 4/M2-B-04 and U8 remains sealed.
    Task 4 / M2-B-04 DONE 2026-07-21 at `1ff398a`: the journal now exposes the
    exact five-name namespace and implements complete positive-tail
    verification/reduction, pinned reference Admit/Resolve/SHA-256 replay,
    exact first-match ratified-erasure classification, lease-checked append,
    and one-step head advance. The matrix falsifies all 65 persisted fields,
    all 16 named application objects, every one of nine index-list/xinfo
    entries, all three FKs, raw tamper/tail/cardinality/id/time/config faults,
    overlapping classifier conditions, live projection drift, and every
    documented blind spot. Post-import inherited `toJSON` cannot affect the
    null-prototype hash records. Completion PASS on exact Node 22.22.2 /
    SQLite 3.51.2: bounded closure 268/268 and full suite 634/634, zero
    failures; protected B1 bytes are unchanged and three independent final
    reviews report zero blockers or majors. No bridge/runtime/producer wiring,
    transaction control, semantic CDX/B1 DML, or source-of-truth claim was
    added; Next is Task 5/M2-B-05 and U8 remains sealed.
  CDX-M1 remains runtime/read authority and exact CDX-B1 remains unchanged and
  non-authoritative throughout these proofs. Parent M2 stays open until M2-B
  passes the complete production matrix.
- [ ] V2-M3 — Gate repair + candidate receipts. Strict extraction schema,
  authority fields not model-controlled, assistant evidence typed,
  ordinary user evidence coverage widened without weakening injection
  resistance, supersession semantics repaired, every candidate outcome
  observable.
- [ ] V2-M4 — Temporal reference driver. Journal-effective/observed time,
  as-of recall, deterministic replay into SQLite FTS, old/new/future
  validity tests. No graph/vector integration before this passes.
- [ ] V2-M5 — Deletion-proof demo. Forget -> canonical payload removal ->
  projection rebuild -> residue diff, with claims bounded honestly to
  tested SQLite/media surfaces.
- [ ] V2-M6 — Driver substitution. Formal driver interface plus a mock
  second driver; paired governance/injection/deletion probes before any
  commodity graph or vector integration.
- [ ] U11 — Injection-resistance certification section remains planned,
  now built on journal receipts and driver profiles after the v2 local
  proofs.
- [ ] DEFERRED FOUNDER GATES — briefing/model iterations, full
  LongMemEval, result publication, and announcement. No live spend or
  public score belongs to the v2 local proof sequence.

## Log

(append: date — unit — commit — one line)
2026-07-18 — U1 — ee25687 — Mapped kernel surface to
docs/SOURCE-MAP.md; 16/16 paths verified @190a4ad2; private-memory
excluded, node:sqlite the only non-builtin dep, severance small.
2026-07-18 — U2 — fe25a15 — Kernel API designed:
gate.propose targeted as the sole write door; C1–C19 trace all 16 contract
bullets; 4 gaps recorded and assigned. Later audit found remaining durable
bypasses; V2-M2 owns full conformance.
2026-07-18 — U3 — 56797c7 — Store extracted
standalone: 8/8 contract tests green, zero deps, no v05 imports;
topicForget composed; node:test + Node>=22.5 decisions recorded.
2026-07-18 — U4 — b122054 — Candidate gate landed:
add/supersede producer shortcuts hidden, 22/22 green, GAP-1..4 closed at
kernel layer with baseline verbatim. Later audit narrowed the completion
claim: ownership/lifecycle/touch/link durable bypasses remain for V2-M2.
2026-07-18 — U5 — c770708 — Recall + briefing v1:
31/31 green; extraction+briefing extracted verbatim; v1 lines carry
event/observed time, attribution, buckets, origin; v0 kept for U9.
2026-07-18 — U6 — 7c00320 — LongMemEval intake:
MIT verdict recorded pre-download; loader + synthetic fixtures,
36/36 green; timestamps->eventAt for GAP-4; V2 flagged to founder.
2026-07-18 — U7 — 7bd16ae — Adapter e2e dry mode
green (40/40): gated ingest via shim, supersession+abstention+
injection-drop proven; assertive-evidence finding pre-seeded for U8.
2026-07-18 — U8 — 4c8bb67 — Live slice PREPARED and STOPPED:
runner w/ mechanical founder gate, predictions drafted failing-first,
cost sheet <$1..$4.50; awaiting founder GO.
2026-07-18 — U8 — c84683a — Founder GO recorded: MIT license,
classic S-cleaned slice, Gemini 2.5 Flash-Lite, estimated <$1 spend;
publish gate remains closed.
2026-07-18 — U8 — 0b3801a — Predictions FINAL before any live call;
dataset hash, model, prompt metadata, and ten slice IDs sealed.
2026-07-18 — U8 — 88c878b — Prompt provenance completed before
spend: full extraction request + briefing included/empty + answer
framing hashed; metadata repinned, outcome predictions unchanged.
2026-07-18 — U8 — 9e68d57 — First live invocation failed auth before
scoring/no result file; corrected authorization-key transport to
header-only, added transport-only retries, loud extraction failure, and
per-question checkpoints; 47/47 green.
2026-07-18 — U8 — f954c4b — 2.5 Flash-Lite returned unavailable for
the new API user; founder amended model to stable successor 3.1
Flash-Lite and cap to $1.25 before scoring; estimate ~$1.06, predictions
unchanged, 47/47 green.
2026-07-18 — U8 — 7aec0b5 — Founder paused run after current question:
9/10 checkpointed, final `1568498a` has no result; no resume without new
explicit GO, no completed output re-rolls.
2026-07-18 — V2-M1 — ea83e15 — Founder ratified autonomous local
v2 implementation; two adversarial GPT-5.6 Sol panels selected the
same-file governed bundle as the minimal falsifiable substrate. U8 sealed;
live/publish work deferred; M1 is next.
2026-07-21 — V2-M1 — 3cdef74 — Governed same-file bundle substrate
implemented and independently reviewed: exact M1 surfaces, initialization,
apply, verification/replay, crash recovery, and unchanged CDX-M1 coexistence;
208/208 PASS on Node 22.22.2 / SQLite 3.51.2. CDX-M1 remains runtime authority,
bundle capabilities remain all false, U8 remains sealed, and Next is V2-M2.
2026-07-21 — V2-M2-A1 — 07d65ad — Certified the isolated synchronous
transaction coordinator and private real B1/CDX co-commit/rollback falsifier:
31/31 focused, 161/161 B1, 239/239 full PASS on Node 22.22.2 / SQLite 3.51.2;
no runtime adoption or policy/source-of-truth claim; parent M2 open, Next A2.
2026-07-21 — V2-M2-A2 — e6bbc51+d419fef — Routed the supported in-file CDX-M1
writer graph through five legacy intents/eight A1 lease-checked effects;
432/432 full PASS plus focused, manifest, B1, regression, and static matrices
green on Node 22.22.2 / SQLite 3.51.2. No trusted-authority, canonical,
journal, source-of-truth, terminal-governance, or parent-M2 completion claim;
Next is M2-B contract work and U8 remains sealed.
2026-07-21 — V2-M2-B Task 0 — a128f1e — Sealed the reviewed governed-mutation
contract: trusted one-use authority, exact @5 46x22 disposition registry,
four-table B2 schema/replay, bootstrap/projection/terminal seams, and executable
plan. Mechanical SQL/config/registry/link/protected-byte checks and unchanged
432/432 suite pass; three final reviews have zero blockers/majors. Parent M2-B
remains open; Next is M2-B-01 authority implementation; U8 remains sealed.
2026-07-21 — V2-M2-B Task 1 — 220be3b — Implemented the exact trusted
authority core and public wrapper: opaque roots/audiences/grants/reservations,
one-generation ledger binding, one-use settlement, captured predicates,
native-clock high-water, and closed precedence/error law. Authority 37/37 and
full suite 469/469 pass on Node 22.22.2 / SQLite 3.51.2; protected B1 bytes are
unchanged and three final reviews found zero blockers/majors. No runtime/store/
B2/A1/bridge/producer wiring claim; Next is M2-B-02 and U8 remains sealed.
2026-07-21 — V2-M2-B Task 2 — e362fe6 — Implemented and certified the exact
four-export @5 disposition registry/evaluator: 46 obligations, 22 dimensions,
496 terminal pairs, 64 generic outcomes, 72 staged authority cases, and 1,728
erasure cases with MAP limited to D-02/D-03. Registry 22/22, combined 28/28,
and full 491/491 pass on Node 22.22.2 / SQLite 3.51.2; protected B1 bytes are
unchanged and three final reviews found zero blockers/majors. No store/B1/B2/
A1/bridge/runtime/producer wiring claim; Next is M2-B-03 and U8 remains sealed.
2026-07-21 — V2-M2-B Task 3 — 5fb4418 — Implemented and certified the exact
six-export B2 schema leaf plus truthful head-zero journal bootstrap/verifier:
atomic three-layout checkpoint, captured-native/main-scoped initialization,
complete manifest/replay verification, and exact historical-runtime negative
allowlist. Focused 129/129 and full 517/517 pass; 136 rollback/retry injections
plus post-COMMIT uncertainty pass; protected B1 bytes are unchanged and three
final reviews found zero blockers/majors. No append/reducer/transition/bridge/
producer or runtime-authority claim; Next is M2-B-04 and U8 remains sealed.
2026-07-21 — V2-M2-B Task 4 — 1ff398a — Implemented and certified the exact
five-export positive-tail journal, complete reducer/replay/projection verifier,
lease-checked append, and one-step head transition. Closure 268/268 and full
634/634 pass on Node 22.22.2 / SQLite 3.51.2; all persisted fields, objects,
indexes/FKs, refusal precedence, pinned hash bytes, tamper classes, projection
checks, and documented blind spots are non-vacuously covered. Protected B1
bytes are unchanged and three final reviews found zero blockers/majors. No
bridge/runtime/producer or source-of-truth claim; Next is M2-B-05 and U8
remains sealed.

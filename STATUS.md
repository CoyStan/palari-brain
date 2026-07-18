# STATUS — single source of truth for the loop

Loop state: RUNNING
Baseline source commit (palari-v05 main): 190a4ad2
Next: U8 LIVE EXECUTION — FOUNDER GO RECEIVED 2026-07-18.
Predictions are FINAL, the approved Gemini 2.5 Flash-Lite key is
available at runtime, and the prompt-config provenance hash is sealed.
Publish gate remains CLOSED; results stay under gitignored
evals/results/.

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
  gate.propose(WriteProposal) is the sole write door — Admit (types,
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
  tests/gate.contract.test.mjs (14 tests). Completion PASS: direct
  write fails (gated surface exposes no addMemory/supersedeMemory/
  insertMemory/db, frozen), gated write passes; suite 22/22 green.
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
  (deleteMemory/topicForget) stay user-side on the gated surface.
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
  links use the raw store; revisit if an eval needs link writes;
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
  extractorId — one-gate law holds in the adapter path with zero
  baseline edits; ingestChatTurn/ingestLongMemEvalInstance;
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
  Gemini 2.5 Flash-Lite, and estimated <$1 spend approved; publish gate
  remains closed. Predictions are FINAL and unchanged from the pre-GO
  draft; deterministic slice + dataset hash pinned. Prompt-config hash
  corrected BEFORE any live call to cover the full extraction request,
  briefing v1 included/empty surfaces, and answer framing (contract test
  added; suite 45/45). Runtime key is project-local, gitignored, mode
  0600; never logged or committed. Execution is next; results remain in
  gitignored evals/results/.
- [ ] U9 — Briefing-format iterations from slice results (paired
  slices, one variable per run; each run FOUNDER GATE on spend).
- [ ] U10 — FOUNDER GATE: full private LongMemEval run + report,
  failing categories first, graded against predictions.
- [ ] U11 — Injection-resistance extension design:
  docs/INJECTION-EVAL.md — a scored eval section where source
  documents attempt to mint memories / alter recall; drawn from
  palari-v05's injection cases and the CASE-memory-source-injection
  incident. Completion: 20+ case designs with mechanical checks.
- [ ] U12 — FOUNDER GATE: publish decision (README results table,
  license, announcement). Prepare the table; stop.

## Log

(append: date — unit — commit — one line)
2026-07-18 — U1 — ee25687 — Mapped kernel surface to
docs/SOURCE-MAP.md; 16/16 paths verified @190a4ad2; private-memory
excluded, node:sqlite the only non-builtin dep, severance small.
2026-07-18 — U2 — fe25a15 — Kernel API designed:
gate.propose sole write door; C1–C19 trace all 16 contract bullets;
4 gaps recorded and assigned (U4/U7); upstream-fix note for founder.
2026-07-18 — U3 — 56797c7 — Store extracted
standalone: 8/8 contract tests green, zero deps, no v05 imports;
topicForget composed; node:test + Node>=22.5 decisions recorded.
2026-07-18 — U4 — b122054 — Gate landed: propose()
sole write door, 22/22 green, GAP-1..4 closed at kernel layer with
baseline verbatim; direct-write-fails law is now a passing test.
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
2026-07-18 — U8 — see `git log` — Prompt provenance completed before
spend: full extraction request + briefing included/empty + answer
framing hashed; metadata repinned, outcome predictions unchanged.

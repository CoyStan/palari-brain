# STATUS — single source of truth for the loop

Loop state: RUNNING
Baseline source commit (palari-v05 main): 190a4ad2
Next: U3

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
- [ ] U3 — Extract store + schema + FTS with contract tests
  (create/read/delete/topic-forget/residue-free deletion; scoping by
  palari_id/user_id). Completion: tests green, no v05 imports.
- [ ] U4 — Extract admission gate path (typed write proposal,
  evidence thresholds, provenance fields required). Completion:
  direct-write attempt fails a test; gated write passes.
- [ ] U5 — Extract recall + briefing (FTS query path, scoped filters,
  briefing format v1 with timestamps + session attribution).
  Completion: recall tests green against fixture memories.
- [ ] U6 — LongMemEval intake. License check FIRST (record verdict in
  docs/DECISIONS.md; FOUNDER GATE if unclear). Then loader for their
  session-history format into kernel sessions; data/ gitignored.
  Completion: loader parses N sample histories in a unit test with
  synthetic mini-fixtures (not the real dataset) committed.
- [ ] U7 — Adapter. Question-answering path: history -> kernel
  ingest (through the gate) -> recall -> briefing -> pluggable
  provider call (env key) -> answer. Deterministic dry mode with a
  stub provider for tests. Completion: end-to-end stub test green.
- [ ] U8 — FOUNDER GATE: first live slice (10 questions). Prepare:
  runner, cost estimate, prediction template pre-filled. Stop.
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
2026-07-18 — U2 — see `git log` (BRAIN u02) — Kernel API designed:
gate.propose sole write door; C1–C19 trace all 16 contract bullets;
4 gaps recorded and assigned (U4/U7); upstream-fix note for founder.

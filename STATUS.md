# STATUS — single source of truth for the loop

Loop state: RUNNING
Baseline source commit (palari-v05 main): 190a4ad2
Next: U1

## Unit queue

- [ ] U1 — Source map. Record the exact kernel surface in
  docs/SOURCE-MAP.md: for each module below, its palari-v05 path,
  baseline commit, exports used, and dependencies to sever:
  memory-store.mjs, memory-extraction.mjs, memory-briefing.mjs,
  private-memory.mjs (assess), plus the recall path inside the
  assistant runtime, and the 6 memory test files. Completion test:
  every listed path exists at the baseline commit.
- [ ] U2 — Kernel API design. docs/KERNEL-API.md: store / gate /
  extract / recall / brief interfaces derived from KERNEL-CONTRACT.md.
  Name what is IN the kernel vs what stays product-side. Completion:
  every contract clause maps to an interface or an explicit exclusion.
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

# STATUS — single source of truth for the loop

Loop state: TRIMMED — product-led direction (2026-07-22).
Baseline source commit (palari-v05 main): 190a4ad2
Working tree: the U8-cut kernel surface, restored per
TRIM-CONTRACT.md and made installable (src/index.mjs entry point,
examples/quickstart.mjs, 48-test suite). The v2 proof machinery
(V2-M1 through V2-M2-B) is preserved at git tag `v2-proof-archive`
and is OUT of the working tree. Read `WE-MESSED-UP.md` for why.

U8 is SEALED as a failed 9/10 reference baseline. Do not execute final
question `1568498a`, resume, re-roll, grade publicly, or publish
without a new explicit founder GO. Results remain under gitignored
evals/results/.

## Unit queue

- [ ] J1 — Journey bank. 10-20 concrete assistant-memory journeys as
  fixtures: ordinary preferences, corrections, forgetting,
  conflicting facts, two-user isolation, and at least one
  untrusted-document case. Deliverables: evals/journeys.json plus a
  short doc naming the scoring dimensions (answer usefulness,
  wrong-memory rate, correction behavior, isolation, injection
  resistance, integration effort, latency, inspectability).
  Completion test: a loader validates every journey against a fixed
  schema. FOUNDER reviews the bank before J2 begins.
- [ ] J2 — Bake-off harness, dry. Run the journey bank end to end
  against this kernel with deterministic stubs; prepare at least one
  established framework (Mem0 first; Graphiti if temporal journeys
  demand it) behind the same interface, mocked, no network, no new
  production dependencies in the kernel itself. Completion test:
  paired dry runs emit one comparable report per arm.
- [ ] J3 — FOUNDER GATE: live bake-off runs. Small spend, all arms,
  pre-registered predictions appended to evals/predictions.md first.
  Prepared by the agent; executed only on an explicit founder GO.
- [ ] J4 — FOUNDER GATE: direction decision from the bake-off report
  — adopt a framework under the thin Palari plane, keep this kernel
  as the engine, or a named hybrid. Recorded in docs/DECISIONS.md.

## Log

(append: date — unit — commit — one line)
2026-07-22 — TRIM — recorded in the trim commit — Restored the U8-cut
kernel, archived the v2 machinery at v2-proof-archive, added
src/index.mjs + examples/quickstart.mjs + the surface test; suite
48/48; quickstart green. Pre-trim history and the full v2 log:
`git log v2-proof-archive`.

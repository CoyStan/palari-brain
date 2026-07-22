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

Continuation is contracted: BAKEOFF-CONTRACT.md (founder-ratified
2026-07-22) carries the executable task list for finishing J1/J2;
the founder review of the bank rides the J3 gate (founder decision
in session, since the seed bank was authored in the direction-review
session itself).

- [~] J1 — Journey bank. SEEDED 2026-07-22 (direction-review
  session): evals/journey-bank.mjs (schema+loader), evals/harness.mjs
  (arm interface + runner + written-count vacuity guard),
  evals/arms/kernel-arm.mjs (reference arm), evals/journeys.json
  (11 journeys, 17 probes, all expectTotalWritten pinned),
  tests/journeys.contract.test.mjs (baseline PINNED: 26/28 graded
  checks pass, exactly 2 findings, both predicted BEFORE first run
  and confirmed by it: correction-espresso-04:p2 temporal-history
  gap; conflict-cities-05:p2 un-cued conflicting re-assertions both
  briefed). Suite 51/51; `npm run bakeoff` exit 0. REMAINING (per
  BAKEOFF-CONTRACT J1.1-J1.2): extend to 16 journeys, re-pin,
  docs/JOURNEY-BANK.md.
- [ ] J2 — Bake-off harness completion, dry (per BAKEOFF-CONTRACT
  J2.1-J2.4): ungoverned-baseline contrast arm with pinned leak
  results, docs/BAKEOFF-J3-PREP.md + DRAFT predictions file,
  markdown report renderer writing to gitignored evals/results/,
  README + STATUS close-out. No live calls, no dependencies, src/
  frozen.
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
2026-07-22 — J1 seed — this commit — Journey bank schema, harness,
kernel reference arm, 11 journeys; baseline pinned 26/28 with 2
predicted-and-confirmed findings; 51/51 green; continuation handed
to BAKEOFF-CONTRACT.md.

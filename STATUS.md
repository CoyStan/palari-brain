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

- [x] J1 — Journey bank.
  - [x] J1.1 — DONE 2026-07-23 (`eebdb91`). Extended the bank to 16 journeys and 25
    probes; kernel baseline pinned at 39/41 graded checks with exactly
    the two unchanged known findings (`correction-espresso-04:p2`,
    `conflict-cities-05:p2`). Suite 51/51; `npm run bakeoff` and
    `npm run quickstart` green.
  - [x] J1.2 — DONE 2026-07-23 (`5906873`).
    `docs/JOURNEY-BANK.md` now documents the
    actual schema, eight scoring dimensions, authoring rules,
    dry/live boundary, and pinned baseline.
- [~] J2 — Bake-off harness completion, dry.
  - [x] J2.1 — DONE 2026-07-23 (`20a15e4`). Added the
    `ungoverned-baseline` contrast arm
    and pinned it at 31/41: all usefulness checks pass, while ten
    checks expose correction, injection-boundary, and user-isolation
    failures including `hunter2`, `Admin`, and cross-user facts.
  - [x] J2.2 — DONE 2026-07-23 (`9634250`). Prepared the no-execution
    J3 runbook, current
    cost envelope, draft per-category predictions, deployment reality,
    and verbatim J4 decision rule. No provider was installed or called.
  - [x] J2.3 — DONE 2026-07-23 (`0ed2787`). The dry runner now renders
    the cross-arm
    dimension table and per-arm findings to ignored
    `evals/results/bakeoff-dry-report.md`.
  - [x] A1.1 — DONE 2026-07-23 (`7cd9298`). Added validated user/Palari
    actor overrides
    and `palari-scoping-17`; the 17-journey kernel is pinned at 42/44
    while the ungoverned arm leaks Juniper across the Palari boundary.
  - [x] A1.2 — DONE 2026-07-23 (`this commit`; exact SHA will be
    backfilled by J2.4). Added `v05-current-memory`, pinned at 38/44:
    raw writes preserve user/Palari isolation but do not supersede
    corrections and admit both poisoned source-document candidates.
  - [ ] J2.4 — Publish the honest dry baseline in README and close J2.
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
2026-07-23 — J1.1 — eebdb91 — Extended the bank to 16 journeys
and 25 probes; pinned the kernel at 39/41 with exactly the two
unchanged known findings; suite 51/51, bakeoff and quickstart green.
2026-07-23 — J1.2 — 5906873 — Documented the validated journey
schema, all eight score dimensions, authoring rules, dry/live boundary,
and the pinned 39/41 kernel baseline; all standing gates green.
2026-07-23 — J2.1 — 20a15e4 — Added and pinned the deliberately
ungoverned shared-memory arm at 31/41; its ten failures concretely expose
source-document and cross-user leaks; all standing gates green.
2026-07-23 — J2.2 — 9634250 — Prepared the founder-gated live
runbook and draft predictions with a 92-call, $0.02721 pre-contingency
estimate and $0.25 proposed cap; installed/called nothing; all gates green.
2026-07-23 — J2.3 — 0ed2787 — Added deterministic Markdown
comparison rendering and ignored local report output; suite 53/53 and all
standing gates green.
2026-07-23 — A1.1 — 7cd9298 — Added explicit per-turn/probe Palari
scoping and a 17th journey; kernel 42/44, ungoverned 33/44 with the expected
Juniper scope leak; all standing gates green.
2026-07-23 — A1.2 — this commit — Added the deployed v0.5 parity arm,
pinned at 38/44: correction and source-boundary gaps measured, while all five
isolation probes pass; suite 54/54 and all standing gates green.

## Product stop-rule record

### J1.1

1. Can a new user run the basic memory journey now? Yes —
   `npm run quickstart` is green.
2. Did this unit make that journey measurably better? It did not
   change runtime behavior; it broadened measurement with forgetting,
   opinion, relationship, abstention, and cross-user-isolation cases.
3. Does an existing framework already provide what this unit added?
   Frameworks provide related memory behaviors and eval datasets, but
   not this repository's deterministic cross-arm fixtures and pinned
   Palari baseline.
4. Has a real user or the founder asked for the guarantee it adds?
   Yes — the founder-ratified BAKEOFF-CONTRACT.md names these five
   journeys exactly.
5. If this unit's code were deleted, what user-visible behavior would
   get worse? Runtime behavior would not immediately change, but
   regressions in those five user-visible behaviors would cease to be
   detected. This is evaluation infrastructure, not a product feature.

### J1.2

1. Can a new user run the basic memory journey now? Yes —
   `npm run quickstart` is green.
2. Did this unit make that journey measurably better? It did not change
   runtime behavior; it made the existing measurement reproducible for
   future journey authors and reviewers.
3. Does an existing framework already provide what this unit added?
   Frameworks publish their own eval guidance, but none documents this
   repository's schema, write-boundary grammar, and pinned fixtures.
4. Has a real user or the founder asked for the guarantee it adds? Yes —
   J1.2 is explicitly required by the founder-ratified contract.
5. If this unit's code were deleted, what user-visible behavior would get
   worse? Runtime behavior would not immediately change, but contributors
   could author invalid or misleading journeys without a standalone guide.
   This is the second evaluation-infrastructure unit in a row; continuation
   is authorized by the higher-priority founder-ratified bake-off sequence.

### J2.1

1. Can a new user run the basic memory journey now? Yes —
   `npm run quickstart` is green.
2. Did this unit make that journey measurably better? It did not change the
   runtime journey; it made the value of the existing write and scope gates
   measurable against a 31/41 naive baseline.
3. Does an existing framework already provide what this unit added? Memory
   frameworks have benchmarks, but none provides this repository's exact
   same-bank, intentionally ungoverned local contrast.
4. Has a real user or the founder asked for the guarantee it adds? Yes — the
   founder-ratified contract requires this contrast before any live spend.
5. If this unit's code were deleted, what user-visible behavior would get
   worse? Runtime behavior would not immediately change, but the repository
   would lose direct evidence that its gate prevents document injection and
   user-scope leaks. This is evaluation infrastructure; continued execution
   remains explicitly authorized by the founder-ratified task sequence.

### J2.2

1. Can a new user run the basic memory journey now? Yes —
   `npm run quickstart` is green.
2. Did this unit make that journey measurably better? It did not change the
   runtime journey; it made the first live comparison bounded, priced, and
   falsifiable before any money can be spent.
3. Does an existing framework already provide what this unit added? Provider
   and framework docs describe their own setup, but not this bank's call
   count, predictions, deployment seam, or founder gate.
4. Has a real user or the founder asked for the guarantee it adds? Yes — the
   founder-ratified contract explicitly requires this preparation.
5. If this unit's code were deleted, what user-visible behavior would get
   worse? Runtime behavior would not immediately change, but a future live
   comparison could spend money or interpret results without a recorded cap,
   prediction, or decision rule. This is evaluation infrastructure under the
   explicitly authorized sequence.

### J2.3

1. Can a new user run the basic memory journey now? Yes —
   `npm run quickstart` is green.
2. Did this unit make that journey measurably better? It did not change the
   runtime journey; it made every arm's dimension scores and failures readable
   in one reproducible local artifact.
3. Does an existing framework already provide what this unit added? Generic
   reporters exist, but this small renderer consumes the repository's existing
   zero-dependency report shape directly.
4. Has a real user or the founder asked for the guarantee it adds? Yes — J2.3
   is an explicit founder-ratified contract task.
5. If this unit's code were deleted, what user-visible behavior would get
   worse? Runtime behavior would not immediately change, but the founder would
   lose the comparison artifact used to inspect evidence before J4. This is
   evaluation infrastructure under the explicitly authorized sequence.

### A1.1

1. Can a new user run the basic memory journey now? Yes —
   `npm run quickstart` is green.
2. Did this unit make that journey measurably better? It did not change the
   runtime journey; it added a measured guarantee that a work fact for one
   Palari cannot answer the same user's question to another Palari.
3. Does an existing framework already provide what this unit added? Frameworks
   support namespaces and filters, but this bank now measures the deployed
   app's Palari-specific scope directly and identically across arms.
4. Has a real user or the founder asked for the guarantee it adds? Yes — parent
   app recon found multiple live Palari personas, and Amendment A1 explicitly
   requires this journey.
5. If this unit's code were deleted, what user-visible behavior would get
   worse? Runtime behavior would not immediately change, but a cross-Palari
   disclosure regression could pass the bake-off unnoticed. This remains
   evaluation infrastructure under the explicitly authorized sequence.

### A1.2

1. Can a new user run the basic memory journey now? Yes —
   `npm run quickstart` is green.
2. Did this unit make that journey measurably better? It did not change the
   runtime journey; it measured the deployed beta's actual path at 38/44
   instead of treating the newer kernel as a proxy.
3. Does an existing framework already provide what this unit added? No
   external framework can reproduce this repository's parent-app parity path;
   the arm is the local control needed for the later external comparison.
4. Has a real user or the founder asked for the guarantee it adds? Yes —
   Amendment A1 requires the deployed-path comparison before J4.
5. If this unit's code were deleted, what user-visible behavior would get
   worse? Runtime behavior would not immediately change, but the founder could
   mistake kernel improvements for behavior already deployed to users. This
   is evaluation infrastructure under the explicitly authorized sequence.

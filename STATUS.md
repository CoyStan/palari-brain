# STATUS — single source of truth for the loop

Loop state: J3 LIVE EXECUTION TERMINALLY STOPPED — FOUNDER
DIRECTION REQUIRED (2026-07-23).
Baseline source commit (palari-v05 main): 190a4ad2
Working tree: the U8-cut kernel surface, restored per
TRIM-CONTRACT.md and made installable (src/index.mjs entry point,
examples/quickstart.mjs, 66-test suite), plus the 17-journey,
three-arm dry bake-off and the paired J3 live adapters. The v2 proof machinery
(V2-M1 through V2-M2-B) is preserved at git tag `v2-proof-archive`
and is OUT of the working tree. Read `WE-MESSED-UP.md` for why.

The founder-authorized J3 live runner was invoked once. It stopped
fail-closed before the paired bank completed after a non-retryable
provider rejection. The durable checkpoint and partial grade remain
under gitignored `evals/results/`; no live score is committed or
published. That run is closed: do not resume or rerun it. J4 remains
unopened.

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

- [x] J1 — DONE (`eebdb91`, `5906873`). Journey bank.
  - [x] J1.1 — DONE 2026-07-23 (`eebdb91`). Extended the bank to 16 journeys and 25
    probes; kernel baseline pinned at 39/41 graded checks with exactly
    the two unchanged known findings (`correction-espresso-04:p2`,
    `conflict-cities-05:p2`). Suite 51/51; `npm run bakeoff` and
    `npm run quickstart` green.
  - [x] J1.2 — DONE 2026-07-23 (`5906873`).
    `docs/JOURNEY-BANK.md` documents the core schema as of J1.2,
    eight scoring dimensions, authoring rules,
    dry/live boundary, and pinned baseline.
- [x] J2 — DONE (`20a15e4`, `9634250`, `0ed2787`, `7cd9298`,
  `7855ce4`, and this J2.4 commit). Bake-off harness completion, dry.
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
  - [x] A1.2 — DONE 2026-07-23 (`7855ce4`), CORRECTED per Amendment A2
    (founder session, 2026-07-23): the original arm wrote through the
    raw door and scored 38/44, understating v05 — production ingest
    runs the extraction pass, whose source boundary and supersession
    v05 shares byte-identically. Re-routed through
    runMemoryExtractionPass, `v05-current-memory` TIES the kernel at
    42/44 with the same two known findings. The A1.2 spec was the
    bug; the executor implemented it faithfully.
  - [x] J2.4 — DONE 2026-07-23 (`this commit`). Published the honest
    dry baselines in README (post-A2: 42/44 reference, 42/44
    deployed-path tie, 33/44 ungoverned) and closed J2.
- [ ] J3 — TERMINAL / INCOMPLETE 2026-07-23. The single authorized
  live execution ran once and was graded only to the extent supported
  by its terminal checkpoint. It stopped under the runbook's
  fail-closed provider-error rule before the paired bank completed.
  Results remain gitignored; no live score entered git. The existing
  run is closed and may not be resumed or rerun.
- [ ] J4 — FOUNDER GATE: not started. The pre-registered decision rule
  cannot be applied mechanically to an incomplete live bank. Any
  direction decision requires a new explicit founder instruction.

## Next

FOUNDER GATE. The founder must choose whether to close J3 as
inconclusive and supply an explicit direction, or authorize a
separately named and versioned live unit. Any new live unit requires
its own explicit GO, hard spend cap, frozen provider configuration,
and pre-registered predictions before any call. The existing FINAL
predictions remain immutable. Do not resume or rerun `j3-live-v1`,
call a provider, or start J4 without that new authority.

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
2026-07-23 — A1.2 — 7855ce4 — Added the deployed v0.5 parity arm,
pinned at 38/44: correction and source-boundary gaps measured, while all five
isolation probes pass; suite 54/54 and all standing gates green.
2026-07-23 — J2.4 — this commit — Published the honest three-arm dry
baseline, closed J1/J2, and stopped at the J3 founder gate; suite 54/54 and
all standing gates green.
2026-07-23 — A2 — this commit — Founder-session fairness correction:
v05 parity arm re-routed through the production extraction pass
(source boundary + supersession included); result is an honest 42/44
TIE with the kernel, same two known findings; README/STATUS/pins
updated; the A1.2 spec, not the executor, was at fault. Suite 54/54.
2026-07-23 — J3 — this commit — Invoked the single authorized live
bake-off once; it stopped fail-closed before bank completion on a
non-retryable provider rejection and was partially graded from its
ignored checkpoint. No live score entered git; the run is closed and
J4 remains founder-gated.

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
   runtime journey; it measured the deployed beta's actual path (42/44
   after the Amendment A2 correction routed it through the real
   extraction pass) instead of treating the newer kernel as a proxy.
3. Does an existing framework already provide what this unit added? No
   external framework can reproduce this repository's parent-app parity path;
   the arm is the local control needed for the later external comparison.
4. Has a real user or the founder asked for the guarantee it adds? Yes —
   Amendment A1 requires the deployed-path comparison before J4.
5. If this unit's code were deleted, what user-visible behavior would get
   worse? Runtime behavior would not immediately change, but the founder could
   mistake kernel improvements for behavior already deployed to users. This
   is evaluation infrastructure under the explicitly authorized sequence.

### J1 close-out

1. Can a new user run the basic memory journey now? Yes —
   `npm run quickstart` is green.
2. Did this work make that journey measurably better? It did not change
   runtime behavior; it expanded the measured product surface to 17 journeys
   and 44 graded checks.
3. Does an existing framework already provide what this work added? Other
   frameworks have evaluations, but not this deterministic Palari journey bank
   with identical fixtures and scopes for every arm.
4. Has a real user or the founder asked for the guarantee it adds? Yes — the
   founder ratified the journey-bank contract and its Amendment A1.
5. If this work were deleted, what user-visible behavior would get worse?
   Runtime behavior would not immediately change, but regressions in recall,
   correction, deletion, abstention, injection safety, and actor isolation
   would no longer be caught. J1 is evaluation infrastructure.

### J2 close-out

1. Can a new user run the basic memory journey now? Yes —
   `npm run quickstart` is green.
2. Did this work make that journey measurably better? It did not change
   runtime behavior; it measured the reference kernel, the deployed v0.5 path,
   and a deliberately ungoverned arm on the same 44 checks.
3. Does an existing framework already provide what this work added? Existing
   memory frameworks are the subject of the still-gated live comparison; J2
   added local evidence and reporting, not another memory engine.
4. Has a real user or the founder asked for the guarantee it adds? Yes — the
   founder ratified the dry bake-off sequence and its J4 decision rule.
5. If this work were deleted, what user-visible behavior would get worse?
   Runtime behavior would not immediately change, but the founder would lose
   the evidence needed to decide whether this kernel earns its maintenance
   cost. J2 is evaluation infrastructure; no further infrastructure work is
   authorized before the J3 founder decision.

### J3 terminal close-out

1. Can a new user run the basic memory journey now? Yes —
   `npm run quickstart` is green.
2. Did this unit make that journey measurably better? No. It changed
   no runtime behavior and did not produce a complete engine
   comparison. It exposed a failure in the shared live measurement
   configuration.
3. Does an existing framework already provide what this unit added?
   Mem0 provides the external memory engine being tested, but neither
   Mem0 nor its documentation provides this repository's paired,
   Palari-scoped journey evidence. The incomplete run did not
   establish whether Mem0 can replace the kernel.
4. Has a real user or the founder asked for the guarantee it adds?
   Yes. The founder explicitly authorized this bounded live
   comparison.
5. If this unit's code were deleted, what user-visible behavior would
   get worse? Existing runtime memory behavior would not worsen, but
   the repository would lose its bounded, checkpointed path for
   comparing engines and the evidence that this live configuration
   failed. This is evaluation infrastructure. No further
   infrastructure or provider work is authorized before the founder
   gate is resolved.

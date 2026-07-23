# STATUS — single source of truth for the loop

Loop state: J3 ENGINEERING REPAIR — CYCLE 3 PRE-RUN FROZEN
(2026-07-23).
Baseline source commit (palari-v05 main): 190a4ad2
Working tree: the U8-cut kernel surface, restored per
TRIM-CONTRACT.md and made installable (src/index.mjs entry point,
examples/quickstart.mjs, 66-test suite), plus the 17-journey,
three-arm dry bake-off and the paired J3 live adapters. The v2 proof machinery
(V2-M1 through V2-M2-B) is preserved at git tag `v2-proof-archive`
and is OUT of the working tree. Read `WE-MESSED-UP.md` for why.

The first founder-authorized J3 live runner was invoked once. It stopped
fail-closed before the paired bank completed after a non-retryable
provider rejection. The durable checkpoint and partial grade remain
under gitignored `evals/results/`; no live score is committed or
published. That run is closed: do not resume or rerun it. The founder has
now authorized three separately versioned engineering-repair cycles under
`docs/BAKEOFF-J3-HEALING.md`, with a cumulative $5 cap. J4 remains unopened.

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
- [ ] J3-H — FOUNDER GO 2026-07-23. Three fresh, immutable engineering
  repair cycles; combined conservative spend capped at $5 including v1.
  - [x] J3-H1 — DONE 2026-07-23 (`this commit`). `j3-live-v2`:
    repaired v1's artificial completion ceiling
    and diagnostic blindness; preregister, verify offline, then run once.
    The one-shot run completed and was graded against its FINAL predictions.
    Its full local transcript, checkpoint, ledger, reports, artifact manifest,
    and prediction grade are preserved under gitignored `evals/results/`.
    No live score entered git or was published. The run is closed.
  - [x] J3-H2 — DONE 2026-07-23 (`this commit`).
    `j3-live-v3`: the complete H1 evidence was graded locally; the smallest
    causal extraction, replay-time, answer, and live-oracle repairs are
    independently reviewed, preregistered, and offline-verified. Exact config
    SHA-256 `cb66470dd6990174b6d84d360591b685fcf7025deebd7eb426476f2e693d4dcd`;
    FINAL prediction SHA-256
    `0b3bb2c39bc32e82264b18383a7037ae59139e443becae6839a024349e854e68`.
    The governed dry reference is now intentionally 41/44 because background
    extraction cannot ratify the cross-user standup; the preserved v0.5
    comparator remains 42/44. The one-shot run completed its full paired plan;
    its terminal ledger, transcript, checkpoint, report, and manifest audits
    pass, and every FINAL prediction was graded locally. Full evidence remains
    gitignored; no live score entered git or was published. V3 is closed.
  - [ ] J3-H3 — PRE-RUN FROZEN 2026-07-23 (`this commit`).
    `j3-live-v4`: the complete H2 evidence was graded locally; the smallest
    extraction-prompt, dated-conflict answer, and order-aware semantic-
    abstention repairs are independently reviewed, preregistered, and
    offline-verified. Exact config SHA-256
    `1ee30c98de735d3f0e0f8de53eea580be968ec4ed2c81d2dea8579668f49851b`;
    FINAL prediction SHA-256
    `176783abd50b5c91c9ac5295e86e4e5ad3171a84a4abc517199be2ee6ba70946`.
    No v4 provider call has occurred.
- [ ] J4 — FOUNDER GATE: not started. The pre-registered decision rule
  cannot be applied mechanically to an incomplete live bank. Any
  direction decision requires a new explicit founder instruction.

## Next

Commit and push the frozen J3-H3 cut point, then invoke `j3-live-v4` exactly
once. Preserve and audit its complete ignored evidence, grade the immutable
FINAL predictions with misses first, close the third authorized repair cycle,
and stop at J4. Do not resume or rerun v1, v2, or v3; do not start J4.

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
2026-07-23 — J3-H GO — this commit — Recorded the founder's three-cycle
engineering-repair authority, immutable run IDs, cumulative $5 ceiling,
competitor-calibrated token decision, transcript requirements, and unchanged
publish/J4 gates; all standing offline checks remain green.
2026-07-23 — J3-H1 pre-run — this commit — Froze the generic one-shot
versioned runner, exact v2 config and FINAL predictions, complete ignored
request/response transcripts, conservative predecessor/spend enforcement,
paired-only partial grading, and terminal forensic bundles. Two independent
reviews found no live-blocking issue; suite 94/94, dry bake-off, and quickstart
green. No v2 provider call occurred.
2026-07-23 — J3-H1 close-out — this commit — Invoked `j3-live-v2` once,
completed the planned paired bank, verified the full ignored forensic bundle,
and graded every FINAL prediction locally. No live score entered git; v2 is
closed and Next advances to the separately preregistered v3 repair cycle.
2026-07-23 — J3-H2 pre-run — this commit — Repaired the evidence-supported
extraction score contract, replay timestamps, Mem0 confidence projection,
positive answer path, and live abstention oracle; froze exact v3 predictions,
config, and predecessor hashes. Suite 98/98, dry bake-off, and quickstart
green; no v3 provider call occurred.
2026-07-23 — J3-H2 close-out — this commit — Invoked `j3-live-v3` once,
completed the paired plan, verified its full ignored forensic bundle, and
graded every FINAL prediction locally. No live score entered git; v3 is
closed and Next advances to the fresh preregistered v4 cycle.
2026-07-23 — J3-H3 pre-run — this commit — Repaired only the v3-supported
kernel extraction prompt, shared dated-conflict answer instruction, and
order-aware semantic-absence oracle; froze exact v4 predictions, config, and
predecessor hashes. Suite 100/100, dry bake-off, and quickstart green; no v4
provider call occurred.

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

### J3-H gate record

1. Can a new user run the basic memory journey now? Yes —
   `npm run quickstart` is green.
2. Did this unit make that journey measurably better? No runtime behavior
   changed; it made the authorized repair cycles bounded, reproducible, and
   explicit before more live spend.
3. Does an existing framework already provide what this unit added? Provider
   and memory-framework defaults informed the token choice, but they do not
   provide this repository's cumulative budget, immutable run chain, or
   Palari journey transcripts.
4. Has a real user or the founder asked for the guarantee it adds? Yes — the
   founder explicitly authorized at least three self-healing cycles, full
   retained evidence, and a combined spend cap.
5. If this unit's code were deleted, what user-visible behavior would get
   worse? Runtime memory would not immediately change, but the next live
   attempts could repeat v1, exceed the combined cap, or lose the evidence
   needed to repair the evaluator. This is one authorized infrastructure
   unit preceding the live evidence work.

### J3-H1 pre-run

1. Can a new user run the basic memory journey now? Yes —
   `npm run quickstart` is green.
2. Did this unit make that journey measurably better? No runtime behavior
   changed. It removed the evaluator's artificial 500/300-token ceiling and
   made the next live comparison complete enough to diagnose rather than
   silently discard provider behavior.
3. Does an existing framework already provide what this unit added? Provider
   SDKs expose calls and framework defaults informed the allowance, but none
   provides this repository's immutable paired bank, admission-boundary arm,
   cumulative run-chain accounting, or exact local forensic bundle.
4. Has a real user or the founder asked for the guarantee it adds? Yes — the
   founder explicitly authorized three self-healing cycles and required every
   available transcript and result to be retained for analysis.
5. If this unit's code were deleted, what user-visible behavior would get
   worse? Runtime behavior would not immediately change, but paid bake-offs
   could again yield empty memories, lose the causal error evidence, or
   undercount interrupted attempts. This is authorized evaluation
   infrastructure; `src/` remains frozen.

### J3-H1 close-out

1. Can a new user run the basic memory journey now? Yes —
   `npm run quickstart` remains green.
2. Did this unit make that journey measurably better? It did not change
   runtime behavior. It produced complete live evidence that identifies
   specific, bounded defects for the next authorized repair.
3. Does an existing framework already provide what this unit added? The
   provider and Mem0 supplied behavior, but neither supplies this exact paired
   Palari bank, gate comparison, immutable predecessor chain, or local
   transcript audit.
4. Has a real user or the founder asked for the guarantee it adds? Yes — the
   founder required at least three self-healing live cycles with complete
   retained evidence and prediction grading.
5. If this unit's code or evidence were deleted, what user-visible behavior
   would get worse? Runtime behavior would not immediately change, but the
   next repair would become guesswork and the paid result could not be
   audited. This is live evaluation evidence under the explicit founder GO.

### J3-H2 pre-run

1. Can a new user run the basic memory journey now? Yes —
   `npm run quickstart` remains green.
2. Did this unit make that journey measurably better? The product extraction
   contract no longer teaches the model scores that the unchanged admission
   gate must reject, and explicit zero is no longer promoted to a fallback.
   The live effect is preregistered and not yet claimed as a result.
3. Does an existing framework already provide what this unit added? Other
   frameworks have extraction prompts and evaluators, but none supplies this
   repository's admission thresholds, replay-time projection, and
   forbidden-evidence oracle as one replaceable package.
4. Has a real user or the founder asked for the guarantee it adds? Yes — the
   founder explicitly required minimal self-healing repairs and at least
   three separately tested live cycles.
5. If this unit's code were deleted, what user-visible behavior would get
   worse? Directly stated durable facts could again fail admission because
   the prompt anchors confidence at zero; the evaluation could also confuse
   safe visible abstention with irrelevant retrieval or hide poisoned durable
   evidence. This is one product repair plus the minimum measurement repair
   needed to test it honestly.

### J3-H2 close-out

1. Can a new user run the basic memory journey now? Yes —
   `npm run quickstart` remains green at the pushed pre-run cut point.
2. Did this unit make that journey measurably better? The one-shot live run
   completed and produced causal evidence that separates extraction,
   conflict-answering, authority, history, and source-boundary behavior.
   User-visible improvement is not claimed from a score in tracked files.
3. Does an existing framework already provide what this unit added? Mem0
   supplies the comparison engine, but it does not supply this paired Palari
   bank, governed kernel path, immutable predecessor chain, or forensic
   prediction grade.
4. Has a real user or the founder asked for the guarantee it adds? Yes — the
   founder explicitly required at least three self-healing live cycles with
   retained transcripts and evidence-backed minimal repair between cycles.
5. If this unit's code or evidence were deleted, what user-visible behavior
   would get worse? Runtime behavior would not immediately change, but the
   third repair would lose its causal basis and could weaken sharing or
   injection guarantees merely to improve a number. This is authorized live
   evaluation evidence preceding the final mandatory repair cycle.

### J3-H3 pre-run

1. Can a new user run the basic memory journey now? Yes —
   `npm run quickstart` remains green.
2. Did this unit make that journey measurably better? The product extractor
   now asks for one valid type, fact-only source-faithful content, and
   searchable base verbs. The prospective live effect is preregistered and is
   not claimed as a result before the one-shot run.
3. Does an existing framework already provide what this unit added? Other
   frameworks provide extraction prompts and answer policies, but not this
   repository's unchanged admission/source boundary plus paired, provenance-
   pinned oracle. The repair remains deliberately prompt-sized.
4. Has a real user or the founder asked for the guarantee it adds? Yes — the
   founder explicitly required minimal self-healing fixes, independent
   structural review, and at least three separately tested live cycles.
5. If this unit's code were deleted, what user-visible behavior would get
   worse? Direct durable facts could again be rejected because the extractor
   copied an invalid joined type, retained a request wrapper, or omitted the
   terms recall needs. The dated-answer and bounded-absence changes are the
   minimum shared measurement repairs needed to test those facts honestly.

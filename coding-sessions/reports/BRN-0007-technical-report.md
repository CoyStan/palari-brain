# BRN-0007 Technical Report

## State

Terminal failed identity. After fresh independent GO at `d6f5f26`, the
launcher ran exactly once. Compatibility and questions 1-6 completed. Question
7 produced an answer, but the fail-closed meter refused its judge reservation,
so that question is ungraded and questions 8-10 were not reached. No rerun,
repair, or regrade occurred.

## Terminal Result

- Compatibility: pass in 2 Luna dispatches with 1 semantic `memory_search`
  and the expected indigo answer.
- Official labels: `08e075c7` PASS, `09d032c9` FAIL, `16c90bf4` PASS,
  `5e1b23de` PASS, `80ec1f4f_abs` PASS, and `0977f2af` PASS: 5/6 graded.
- BRN-0006 live treatment: `80ec1f4f_abs` made exactly four retrieval calls.
  Requests 1-4 offered tools with `tool_choice: "auto"`; request 5 omitted
  tools, used `tool_choice: "none"`, returned a message, and received PASS.
- Provider delta among graded cases: the first five match Gemini; `0977f2af`
  changes from Gemini FAIL to Luna PASS. All 7/7 required answer-bearing
  sessions across the five graded positive cases were consulted.
- Ungraded boundary: `0a34ad58` completed a Luna answer after one
  `memory_search`, but its judge did not dispatch. Fresh accounted
  `$0.52888556` plus frozen judge reservation `$0.54417` projected
  `$1.07305556`, so the `$1.00` cap refused. Questions 8-10 were not reached.
- Terminal error: `FRESH_SPEND_CAP: next judge reservation would exceed
  $1.00.` This result is not 5/10.
- Calls: 66 Gemini embedding batches, 21 Luna Responses dispatches, and 6
  official judge calls; 93 total recorded calls.
- Luna usage: 85,233 input, 35,928 cached-input, 1,350 output, and 215
  reasoning tokens; `$0.01219956` measured.
- Judge usage: 1,117 input and 10 output tokens; `$0.0028925` measured.
- Gemini embeddings: 66 successful batches with usage unreported;
  `$0.5137935` remains conservatively uncertain.
- Fresh ledger: `$0.01509206` measured + `$0.5137935` uncertain =
  `$0.52888556` accounted. Cumulative ledger: `$1.70023596` measured +
  `$3.5714979` uncertain = `$5.27173386` accounted.
- Manifest SHA-256:
  `7b190fcfef19847cc30b1d020fdae1e15d09eff59d559819fc4d1158a59f3df6`.
  All 44 artifacts rehash, all are mode 0600, and exact-value scanning reports
  0 matches for 2 configured credentials.

## Prediction Grade

Failing categories first:

1. COMPLETION/FINALIZATION — mixed, aggregate fail. The predicted all-ten
   completion failed at the question-7 judge cap. The causal subprediction
   passed exactly: ordinal 5 used four calls, finalized tool-disabled, answered,
   and passed without reaching the emergency ceiling.
2. OFFICIAL ACCURACY — not assessable. Six labels cannot establish `>=7/10` or
   preservation of all five Gemini passes. Among reached cases, five are PASS
   and `0977f2af` is the first predicted evidence-use FAIL-to-PASS change.
3. RETRIEVAL CONTROL — not assessable. `10d9b85a` was not reached. Graded
   positive cases consulted 7/7 required answer-bearing sessions.
4. WIRE — pass for every reached boundary. Normal requests used auto + tools;
   forced finalization used none + no tools; all six completed answers received
   one judge label. Question 7's completed answer correctly remains unlabelled.
5. SEMANTIC USE — fail as an all-ten claim. Every graded question used
   successful semantic search; question 7 also called `memory_search`, but
   questions 8-10 were not reached.
6. EXECUTION/ACCOUNTING — pass. One terminal invocation stayed below both
   caps, retained measured/uncertain accounting, made six judge calls, sealed
   44 private artifacts, and recorded zero credential matches.

## Frozen Experiment

- Identity: `j4-luna-retrieval-first10-v2`.
- Product cut point: accepted BRN-0006 `3f42023`; administrative contract head
  `6541572` changes no evaluated product byte.
- Population: exact S60 ordinals 1-10; ordered-array SHA-256
  `d3a9a8c234468e0120d605c7868b418a5ab3313384d0d162e11a30ab6d9fe4cf`.
- Dataset SHA-256:
  `d6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442`.
- Answer: `gpt-5.6-luna`, Standard, low reasoning, no-store, serial tools.
- Fixed controls: Gemini `gemini-embedding-001`; official
  `gpt-4o-2024-08-06` judge; unchanged questions, memory, ranking, prompts,
  grading, and U8 seal.
- Changed treatment: at most four aggregate memory calls, then one request
  with `tool_choice: "none"` and no `tools` field.
- Opening ledger: `$4.7428483` accounted = `$1.6851439` measured +
  `$3.0577044` uncertain. Hard boundaries: `$1.00` fresh / `$5.7428483`
  cumulative.

## Private Launcher

The mode-0600 wrapper is
`/home/quetza/palari-brain-private/luna-first10-live-v2-launcher.mjs`, SHA-256
`84a55389a824b7bdb7a045446fe994d0b1f9871e2979b9781abe3c61fec0411a`.
It verifies frozen v1 launcher template
`4f2e425e8239b5304157a47745ddeaa025a14960ae120473a1b0a5fe2b097eb4`,
generates delegate
`25506fbbffac2fb6bf2ffcdcd662fb503c9b946629b2a006f43c59f4fa4ed2ee`,
and generates runtime
`4bc21c6c3d14d977f0aa659608d0998bd029d3f754c4398c1e4f49705aa266d0`.

The launcher rehashes eight predecessor bundles, including terminal Luna v1,
and eight current product/eval files. It checks dataset/order, syntax, caps,
and absent runtime/result before the delegate can load `.env`. The runtime
creates its private one-way identity before credential loading. All embedding,
answer, and judge calls reserve against one aggregate fail-closed meter before
network dispatch. It has no transport retry. Request headers are never written;
terminal artifacts are exact-value scanned against configured credentials.

## Files Changed

- `evals/predictions.md`: FINAL P-set 21 freeze and unchanged predictions.
- `docs/DECISIONS.md`: founder authority and exact execution boundary.
- `STATUS.md`: pre-dispatch state, hashes, accounting, and next gate.
- `coding-sessions/tickets/open/BRN-0007-*.md`: governed contract and lifecycle.
- `coding-sessions/reports/BRN-0007-technical-report.md`: this evidence.
- `coding-sessions/human-report/BRN-0007-human-report.md`: founder-readable
  interpretation.

The private launcher is intentionally outside git and is not a tracked path.

## Verification

- `node --check .../luna-first10-live-v2-launcher.mjs`: PASS.
- `node .../luna-first10-live-v2-launcher.mjs --verify`: PASS.
- Generated runtime syntax: PASS inside verification.
- Predecessor bundles: 8/8 rehashed.
- Product/eval inputs: 8/8 rehashed.
- Dataset and question order: exact; v2 runtime/result absent.
- Terminal manifest: 44/44 artifacts rehash; all mode 0600; secret scan 0/2.
- Fresh spend: `$0.52888556` accounted under the `$1.00` cap.
- Full suite: 667 pass, 0 fail, 15 skipped across 682 tests.
- Quickstart: 6/6.
- Ticket/report/scope checks: pass before freeze commit.
- Independent pre-dispatch review: GO at `d6f5f26` with no findings.
- Independent terminal review: pending.

## Risks / Follow-Ups

- These ten cases are known and cannot establish unseen-data performance.
- The cap failure is terminal and not repair authority. A higher-cap successor
  requires a separate founder decision, identity, freeze, and review.
- Gemini embedding usage is not reported, so its conservative reservation may
  dominate accounted spend again.

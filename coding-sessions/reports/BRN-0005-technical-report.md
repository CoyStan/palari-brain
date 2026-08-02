# BRN-0005 Technical Report

## State

Terminal failed identity. After fresh independent GO at `bc50322`, the
launcher ran exactly once. Compatibility passed and four questions were
answered and judged. Ordinal 5 exhausted the frozen seven-dispatch answer
budget without producing output, so the run stopped and questions 5-10 were
not judged. No rerun or repair occurred.

## Terminal Result

- Compatibility: pass in 2 Luna dispatches, with 1 semantic
  `memory_search` and the expected indigo answer.
- Reached labels: `08e075c7` PASS, `09d032c9` FAIL, `16c90bf4` PASS,
  `5e1b23de` PASS. These 3/4 correct labels exactly match Gemini on the same
  four cases.
- Terminal cell: `80ec1f4f_abs` produced no answer after 7 successful Luna
  responses containing only memory calls: `memory_search` x4,
  `memory_timeline` x1, and `memory_find` x2.
- Terminal error: `OPENAI_MODEL_DISPATCH_BUDGET_EXHAUSTED`.
- Ungraded: ordinals 5-10. The result is not a 3/10 score and cannot assess
  the preregistered 7/10 or provider-delta predictions.
- Luna: 18 successful Responses calls, 89,051 input tokens, 52,570 cached
  input tokens, 931 output tokens, and 193 reasoning tokens; `$0.0094648`
  measured.
- Judge: 4 successful calls; `$0.0021850` measured.
- Gemini embeddings: 49 successful batches / 2,411 inputs; usage unreported,
  leaving `$0.3669336` uncertain under the conservative reservation.
- Fresh ledger: `$0.0116498` measured + `$0.3669336` uncertain =
  `$0.3785834` accounted, under the `$1.00` cap.
- Cumulative J4 ledger: `$1.6851439` measured + `$3.0577044` uncertain =
  `$4.7428483` accounted.
- Manifest SHA-256:
  `574c865ca3755cf794b002de5b12ec3d474ae235b51e894772222dd97b48b5d8`.
  All 35 listed artifacts rehash, all are mode 0600, and exact-value scanning
  reports 0 matches for 2 configured credentials.

## Prediction Grade

Failing categories first:

1. ANSWER BOUNDARY — fail. Ordinal 5 exhausted all seven dispatches without
   an answer; only four of ten answer boundaries completed.
2. SEMANTIC USE — fail as an all-ten claim. Each of the four scored questions
   used successful semantic search, but the run did not complete all ten.
3. OFFICIAL ACCURACY — not assessable. Four labels cannot establish the
   predicted `>=7/10`.
4. PROVIDER DELTA — not assessable. The three reached Gemini-pass cases stayed
   PASS and reached evidence-use case `09d032c9` stayed FAIL, but six required
   comparisons have no Luna label.
5. RETRIEVAL CONTROL — not assessable. `10d9b85a` was not reached; the four
   completed positive cases did consult all 5/5 required answer-bearing
   sessions.
6. COMPATIBILITY/JUDGE WIRING — pass for its reached boundary. The semantic
   indigo smoke passed before question 1, and all 4/4 completed answers received
   one validated label from the unchanged judge.
7. EXECUTION/ACCOUNTING — pass. The first command is terminal, stayed under
   both caps, preserved measured versus uncertain usage, made four judge calls,
   and recorded zero exact credential matches. The frozen contract correctly
   treats the runtime stop itself as the result rather than rerun authority.

## Frozen Experiment

- Identity: `j4-luna-retrieval-first10-v1`.
- Population: exact S60 ordinals 1-10, ordered array SHA-256
  `d3a9a8c234468e0120d605c7868b418a5ab3313384d0d162e11a30ab6d9fe4cf`.
- Dataset SHA-256:
  `d6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442`.
- Comparator: `gpt-5.6-luna`, standard mode, low reasoning, no-store.
- Fixed controls: Gemini `gemini-embedding-001` semantic embedder; official
  `gpt-4o-2024-08-06` judge; unchanged answer instructions and retrieval
  tools; no writer, reducer, or graph extractor.
- Gemini baseline: terminal BRN-0002 5/10 and exact per-question label vector,
  manifest
  `554efab7c320ae2c2224ddbb9976d4a0b75afe66a5dab02c2ab227bc5b16816c`.
- Opening J4 ledger: `$4.3642649` accounted = `$1.6734941` measured +
  `$2.6907708` uncertain.
- Boundaries: `$1.00` fresh and `$5.3642649` cumulative.

## Private Launcher

Path: `/home/quetza/palari-brain-private/luna-first10-live-v1-launcher.mjs`.
The launcher is outside git, mode 0600, and hashes
`4f2e425e8239b5304157a47745ddeaa025a14960ae120473a1b0a5fe2b097eb4`.
Its deterministic generated runtime hashes
`b9c60472cc3190fb8eb72a947ad5f5937cb7094d2cdefdd1efe1a22d96cafadd`.

The launcher derives from terminal v5 runtime
`0b820acfb1a81dc702031fa3002ca9b098aeaefdae68de17534f49dd0cfe89d7`,
changes the result identity/population/accounting and answer provider, and
preserves embedding and judging. It rehashes seven terminal bundles, eight
current product/eval files, the dataset, and question order; syntax-checks the
generated runtime in an isolated temporary directory; and refuses a
pre-existing runtime or result.

The runtime loads the ignored keys only after those checks and after it has
created the one-way terminal identity. Every Gemini embedding, OpenAI
Responses dispatch, and official judge call is reserved against one aggregate
meter before network dispatch. Successful calls settle from validated usage;
failed/invalid calls retain their conservative reservation. OpenAI requests
use only the fixed Responses URL, Authorization header, JSON body,
`store:false`, low reasoning, serial function calls, and encrypted reasoning
continuation. There is no transport retry.

Request bodies and raw responses are private transcripts; headers are never
recorded. Before writing the terminal artifact manifest, the launcher scans
every result artifact for both exact configured credential values and requires
zero matches.

## Files Changed

- `evals/predictions.md`: frozen P-set 20 contract and predictions.
- `docs/DECISIONS.md`: founder authority and live-run boundaries.
- `STATUS.md`: freeze, terminal result, ledger, and next action.
- `coding-sessions/tickets/open/BRN-0005-compare-luna-against-gemini-on-first-ten.md`:
  governed contract, lifecycle, and freeze record.
- `coding-sessions/reports/BRN-0005-technical-report.md`: this evidence.
- `coding-sessions/human-report/BRN-0005-human-report.md`: founder-readable
  pre-run summary.
- `coding-sessions/reports/BRN-0005-reviewer-note.md`: independent review
  evidence; the first review reopened solely for required report headings,
  and a fresh review subsequently recommended GO before dispatch.

The mode-0600 launcher remains outside git at the frozen private path and is
not a tracked change.

## Verification

- `node --check .../luna-first10-live-v1-launcher.mjs`: pass.
- `node .../luna-first10-live-v1-launcher.mjs --verify`: pass.
- Generated runtime syntax check: pass inside launcher verification.
- Predecessor bundles: 7/7 rehashed.
- Product/eval inputs: 8/8 rehashed.
- Question count/order: exact 10/10.
- Pre-dispatch runtime/result absence: true/true.
- Provider binding: Luna low answer, Gemini embedding, unchanged OpenAI judge.
- Pre-dispatch credential presence: both configured in ignored `.env`; values
  were not printed or copied. Provider calls: 0. Fresh spend: `$0.00` at that
  gate.
- Pre-dispatch fresh review commit `bc50322`: GO.
- Single live invocation: terminal exit 1 with
  `OPENAI_MODEL_DISPATCH_BUDGET_EXHAUSTED`; no retry.
- Terminal manifest: 35/35 artifacts independently rehashed; mode 0600;
  credential matches 0/2 configured values.
- Result boundary: 4 judged questions, 1 ungraded terminal cell, remaining 5
  not reached; measured and uncertain accounting reconciles exactly.
- Post-run `npm test`: 664 passed, 0 failed, 15 skipped across 679 tests.
- Post-run `npm run quickstart`: all 6 journey stages green.
- Ticket lint, report lint, committed-plus-dirty scope check, and diff check:
  pass.

## Post-dispatch Review Request

Confirm the immutable terminal bundle and tracked result independently,
especially:

1. the report, meter, and manifest agree on the failure stage and four labels;
2. the 35 listed artifacts rehash and retain mode 0600;
3. Luna made exactly seven tool-only dispatches on the terminal cell;
4. measured, uncertain, fresh, and cumulative accounting reconcile under cap;
5. exact-value credential scanning reports zero matches;
6. the identity is sealed and no retry, regrade, or second invocation
   occurred; and
7. STATUS, decision, reports, and ticket grade the predictions without
   presenting the partial result as a ten-question score.

## Risks / Follow-Ups

- These are ten inspected questions, not an unbiased benchmark sample.
- Current `brain.mjs` includes additive optional author provenance added after
  BRN-0002. The dataset does not supply `authorId`, so the path is behaviorally
  unchanged, but this is transparently not a byte-identical old checkout.
- Gemini embedding usage may remain unreported and therefore uncertain under
  the conservative byte reservation.
- The terminal result cannot justify prompt tuning or an automatic model
  switch. A product decision requires the exact label/failure-stage evidence.
- The observed repeated-tool loop could be provider behavior, host tool-result
  ergonomics, or both. This ticket does not authorize changing the seven-call
  ceiling or treating a successor run as completion of this identity.

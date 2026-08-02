# BRN-0005 Technical Report

## State

Pre-dispatch freeze. No provider request has occurred under this identity.
The exact result path and generated runtime path are absent. Founder authority
for one invocation under a `$1.00` fresh cap is recorded; independent review
must still recommend GO before credential loading and dispatch.

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
- `STATUS.md`: pre-dispatch state, ledger, and next action.
- `coding-sessions/tickets/open/BRN-0005-compare-luna-against-gemini-on-first-ten.md`:
  governed contract, lifecycle, and freeze record.
- `coding-sessions/reports/BRN-0005-technical-report.md`: this evidence.
- `coding-sessions/human-report/BRN-0005-human-report.md`: founder-readable
  pre-run summary.
- `coding-sessions/reports/BRN-0005-reviewer-note.md`: independent review
  evidence; the first review reopened this ticket solely for these required
  report headings.

The mode-0600 launcher remains outside git at the frozen private path and is
not a tracked change.

## Verification

- `node --check .../luna-first10-live-v1-launcher.mjs`: pass.
- `node .../luna-first10-live-v1-launcher.mjs --verify`: pass.
- Generated runtime syntax check: pass inside launcher verification.
- Predecessor bundles: 7/7 rehashed.
- Product/eval inputs: 8/8 rehashed.
- Question count/order: exact 10/10.
- Runtime/result absence: true/true.
- Provider binding: Luna low answer, Gemini embedding, unchanged OpenAI judge.
- Credential presence: both configured in ignored `.env`; values were not
  printed or copied. Provider calls: 0. Fresh spend: `$0.00`.

## Pre-dispatch Review Request

Confirm the launcher/runtime transformation and tracked freeze independently,
especially:

1. only the answer/tool-decision provider changes;
2. every Responses dispatch is metered before the request and cannot retry;
3. continuation preserves encrypted reasoning and host-owned function output;
4. the `$1.00` fresh boundary includes embeddings, answers, and judges;
5. credentials load only after offline verification and are absent from
   bodies, transcripts, errors, and tracked files;
6. compatibility failure and every later failure are one-way terminal; and
7. the predictions and exact Gemini baseline were frozen before dispatch.

## Risks / Follow-Ups

- These are ten inspected questions, not an unbiased benchmark sample.
- Current `brain.mjs` includes additive optional author provenance added after
  BRN-0002. The dataset does not supply `authorId`, so the path is behaviorally
  unchanged, but this is transparently not a byte-identical old checkout.
- Gemini embedding usage may remain unreported and therefore uncertain under
  the conservative byte reservation.
- The terminal result cannot justify prompt tuning or an automatic model
  switch. A product decision requires the exact label/failure-stage evidence.

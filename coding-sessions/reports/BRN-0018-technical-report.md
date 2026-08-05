# BRN-0018 Technical Report

## Files Changed

- `evals/predictions.md`: freezes P-set 29, its model-only treatment, raw
  qualitative expectations, one-shot rule, and proposed caps.
- `docs/DECISIONS.md`: records why Sol/low is the pre-architecture control and
  why the result cannot regrade BRN-0017.
- `STATUS.md`: records the offline freeze, exact opening ledger, zero activity,
  and next founder gate.
- `coding-sessions/tickets/open/BRN-0018-*.md`: bounds the governed work.
- Private git-excluded mode-0600 launcher: rehashes all 74 terminal-source
  artifacts, snapshots a one-field model treatment before smoke, binds the
  exact reviewed commit/P-set/launcher at run time, meters at most five calls
  with atomic synced reservations, and reconciles/seals the one-shot result.

## Verification

- `node /home/quetza/palari-brain-private/stronger-answer-frozen-four-live-launcher.mjs --verify`:
  PASS. All 74 BRN-0017 artifacts and four transcript/request pairs rehash; every
  replay restores byte-identically when its model is changed back to Luna;
  result identity is absent.
- `node --check /home/quetza/palari-brain-private/stronger-answer-frozen-four-live-launcher.mjs`:
  PASS.
- A provider-free `--run --authority-commit 000...000` control fails before
  result creation, credential access, or transport; the one-shot namespace
  remains absent.
- `--verify-authority FULL_SHA` provides a provider-free exact-head check of
  clean pushed branch equality, target-main ancestry, committed P-set bytes,
  launcher pin, all 74 source artifacts, and absent result namespace.
- Before founder authority, credential reads / provider calls / inference /
  fresh spend were `0 / 0 / 0 / $0.00`.
- `npm test`: PASS with 0 failures across 725 tests. Specialist context:
  722 pass / 3 optional skips; fresh reviewer context: 710 pass / 15 optional
  skips.
- `npm run quickstart`: PASS, 6/6 journey stages.
- `npm run ticket -- ticket-lint BRN-0018`: PASS.
- `git diff --check`: PASS.

## Risks / Follow-Ups

- Replaying encrypted reasoning across GPT-5.6 tiers may be rejected by the
  provider even though stateless replay is supported. The compatibility smoke
  only proves model availability, so a replay rejection is terminal evidence;
  this identity may not flatten or rewrite the context to work around it. A
  successful result measures Sol's final turn conditioned on Luna's frozen
  reasoning/tool trajectory, not a pure end-to-end Sol answer path.
- A successful four-row diagnostic is too small for a general quality claim.
  Its sole purpose is to isolate whether Sol can materially use already
  delivered evidence before the architecture changes.
- Architecture work remains a separate product ticket. Equivalent-fact and
  materially-used evidence labels will be judged telemetry there, never
  canonical truth or a regrade of BRN-0017.

## Review Repair

- Preliminary independent review of `58a237e0` was stopped and recommended
  reopen. It found unpinned source-file hashes plus a post-smoke reread, no
  runtime binding to the reviewed commit/P-set/launcher, non-fatal credential
  matches, direct unsynced writes, and an unreconciled seal. The repaired
  launcher rehashes all 74 artifacts, snapshots requests once, verifies exact
  pushed authority before key access, atomically writes and syncs every
  reservation/artifact, makes credential matches fatal, and reconciles meter,
  wire, report, terminal, modes, caps, and hashes before sealed success.
- The paused second review found directory setup outside the guarded lifecycle,
  no empty meter before key validation, and full private report output on
  stdout. The final launcher enters the terminal lifecycle immediately after
  atomic namespace creation, persists/syncs an empty meter before key access,
  seals missing-key and other normal pre-dispatch failures, and prints only a
  non-sensitive identity/spend/path summary after success.

## Terminal Result

- The founder authorized the exact identity for one invocation under `$0.50`
  fresh / `$7.67192994` cumulative accounted caps. It ran once and is consumed.
- Compatibility returned exact `compatible`; four of four frozen requests then
  returned HTTP 200 exactly once. Every result was one valid
  `palari_answer_commit`; no memory tool or judge ran.
- P-set 29: ANSWER USE **1/2 FAIL** (Phone pass, Miami fail); EVIDENCE LIMIT
  **1/2 FAIL** (Instant Pot pass, Tokyo fail); COMPATIBILITY/COMPLETION,
  CAUSAL INTEGRITY, and EXECUTION/ACCOUNTING **PASS**.
- Phone materially used the power bank. Miami used only view evidence and
  omitted private-balcony hot-tub evidence. Instant Pot abstained on missing
  evidence. Tokyo cited prior Palari Suica/transit advice and omitted TripIt,
  rather than reporting the missing original user evidence.
- Meter: five successful HTTP-200 calls, 29,281.3 ms total / 5,856.26 ms mean;
  26,775 input, 1,326 output, 322 reasoning, 28,101 total tokens; 24,942
  cache-write and 1,554 cached input tokens. Conservative reservations account
  `$0.50` fresh and `$7.67192994` cumulative.
- Seal: 14 listed mode-0600 artifacts, zero credential matches, zero sealing
  errors. Manifest SHA-256:
  `6c9ab17351d8f09c1b714d33bb8fe34e468d25a8cdf0397d4dc9794c5dcba725`.
- The historical BRN-0017 6/10 and all ten labels are unchanged. This result
  supports an architecture fix; it is not a new official grade.
- Independent terminal review of exact result head `410bc99` rehashed all 14
  result and 74 source artifacts, reconciled the raw commitments, usage,
  latency, accounting, and grades, and found no P0-P3 issue. Reviewer-note
  commit `62e0dd6` recommends acceptance.

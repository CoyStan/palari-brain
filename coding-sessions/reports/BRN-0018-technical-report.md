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
- Credential reads / provider calls / inference / fresh spend:
  `0 / 0 / 0 / $0.00`.
- `npm test`: PASS, 722 passed / 0 failed / 3 skipped across 725 tests.
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

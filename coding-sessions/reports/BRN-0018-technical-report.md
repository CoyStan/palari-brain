# BRN-0018 Technical Report

## Files Changed

- `evals/predictions.md`: freezes P-set 29, its model-only treatment, raw
  qualitative expectations, one-shot rule, and proposed caps.
- `docs/DECISIONS.md`: records why Sol/low is the pre-architecture control and
  why the result cannot regrade BRN-0017.
- `STATUS.md`: records the offline freeze, exact opening ledger, zero activity,
  and next founder gate.
- `coding-sessions/tickets/open/BRN-0018-*.md`: bounds the governed work.
- Private git-excluded mode-0600 launcher: rehashes the terminal source,
  verifies a one-field model treatment, meters at most five physical calls,
  and seals the one-shot result.

## Verification

- `node /home/quetza/palari-brain-private/stronger-answer-frozen-four-live-launcher.mjs --verify`:
  PASS. BRN-0017 manifest and four transcript/request pairs rehash; every
  replay restores byte-identically when its model is changed back to Luna;
  result identity is absent.
- `node --check /home/quetza/palari-brain-private/stronger-answer-frozen-four-live-launcher.mjs`:
  PASS.
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
  this identity may not flatten or rewrite the context to work around it.
- A successful four-row diagnostic is too small for a general quality claim.
  Its sole purpose is to isolate whether Sol can materially use already
  delivered evidence before the architecture changes.
- Architecture work remains a separate product ticket. Equivalent-fact and
  materially-used evidence labels will be judged telemetry there, never
  canonical truth or a regrade of BRN-0017.

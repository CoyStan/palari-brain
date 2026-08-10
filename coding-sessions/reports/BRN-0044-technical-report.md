# BRN-0044 Technical Report

## Files Changed

- `src/openai.mjs` — reserve at most two closure-only model calls after the
  configured normal dispatch ceiling, without reopening memory retrieval.
- `tests/openai.contract.test.mjs` — prove no-evidence finalization,
  pending-page review, one commitment repair, forbidden post-cap retrieval,
  and the exact physical-call ceiling.
- `docs/BRAIN-API.md` — document normal versus closure dispatches and the
  unchanged evidence boundary.
- `STATUS.md` — record provider-free scope, behavior, and verification.
- `coding-sessions/tickets/open/BRN-0044-*.md` — record the bounded contract,
  claim, and specialist closeout.

## Verification

- `node --test tests/openai.contract.test.mjs`: PASS, 39/39.
- `npm test`: PASS, 90/90.
- `npm run quickstart`: PASS, 6/6.
- `npm run test:legacy`: PASS, 939 passed, 15 optional skips, 0 failed across
  954 tests.
- `npm run ticket -- ticket-lint BRN-0044`: PASS.
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0044`:
  PASS.
- `git diff --check main...HEAD`: PASS.
- `git diff --check`: PASS.

## Risks / Follow-Ups

- A provider can still refuse, return an empty response, call a forbidden
  tool, or fail both closure commitments. Those paths remain typed terminal
  failures by design.
- The physical model-call ceiling is now the configured normal ceiling plus
  two closure-only calls. Per-case monetary guards remain independent and can
  still refuse before a call that would cross their reservation.
- The paused S60 campaign and failed-case reruns are not ticket evidence. They
  require founder authority after independent review, acceptance, merge, and
  push.

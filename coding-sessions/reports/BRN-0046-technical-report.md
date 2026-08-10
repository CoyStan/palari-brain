# BRN-0046 Technical Report

## Files Changed

- `src/openai.mjs` — add the compact answer-commitment wire, fixed exclusion
  codes, host translation, and one review-only candidate-review repair.
- `src/retrieval-answer.mjs` — update model instructions and allow the host to
  audit one recovered malformed review on the same pending page.
- `tests/openai.contract.test.mjs` — prove schema, translation, omission,
  duplicate and used-evidence checks, malformed review arguments, mixed-call
  terminal handling, and repair limits.
- `tests/answer-confirmation.contract.test.mjs` — prove the real host accepts
  one same-page review repair without another search.
- `tests/openai-counted-responses.contract.test.mjs` — refresh the active wire
  bytes and hashes while leaving the consumed BRN-0025 pins unchanged.
- `docs/BRAIN-API.md` — document compact commitments and repair limits.
- `STATUS.md` — record scope, behavior, and provider-free verification.
- `coding-sessions/tickets/open/BRN-0046-*.md` — record the contract, bounded
  scope addition, claim, and specialist closeout.
- `coding-sessions/human-report/BRN-0046-human-report.md` — provide the
  founder-readable closeout and current review state.

## Verification

- `node --test tests/openai.contract.test.mjs tests/answer-confirmation.contract.test.mjs`:
  PASS, 77/77.
- `npm test`: PASS, 91/91.
- `npm run quickstart`: PASS, 6/6.
- `node --test tests/openai-counted-responses.contract.test.mjs`: PASS, 16/16.
- `node --test tests/retrieval-answer.contract.test.mjs`: PASS, 44/44.
- `npm run test:legacy`: PASS, 964 passed, 15 optional skips, 0 failed across
  979 tests.
- Ticket, report, committed-plus-dirty scope, and diff gates: pending after
  the candidate commit.
- The first independent review reopened exact commit `82f1fdf` for one P2:
  malformed JSON and non-object candidate-review arguments failed before the
  repair path. That gap is fixed.
- The first rereview reopened exact commit `96d4206` for one P2: a malformed
  candidate review mixed with another function could enter answer-commit
  repair. Mixed candidate-review responses are now terminal before either
  repair path. Fresh independent rereview is pending.

## Risks / Follow-Ups

- The compact model schema is new. Provider-free contracts prove its exact
  shape and host translation, but no paid provider call was made.
- A used-only legacy parser shape remains for previously captured callers.
  It is not offered to the model and cannot carry a free-text exclusion.
- Candidate-review repair is limited to one malformed review on one pending
  page. Semantic disagreement is not normalized or repaired.
- The active answer wire is 418 bytes larger than its previous pin because
  the strict schema contains two arrays and six explicit exclusion codes.
  This is a bounded schema cost; the answer no longer writes free-text reasons
  for unrelated or excluded rows.

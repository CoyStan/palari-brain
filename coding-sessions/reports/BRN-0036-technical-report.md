# BRN-0036 Technical Report

## Files Changed

- `src/retrieval-answer.mjs` bumps confirmation to v7, exposes explicit page-
  completeness and lower-ranked-tail telemetry, and makes only character-
  incomplete delivery force continuation after an all-`not_used` review.
- `tests/answer-confirmation.contract.test.mjs` proves a fully delivered
  top-20 page can close despite a lower-ranked tail while character-truncated
  pages remain open and page forward through unseen evidence only.
- `STATUS.md` records the bounded behavior and provider-free evidence.
- BRN-0036 ticket and report files record governed scope and verification.

## Verification

- `node --test tests/answer-confirmation.contract.test.mjs`: PASS, 9/9.
- `npm test`: PASS, 85/85.
- `npm run quickstart`: PASS, 6/6.
- `npm run test:legacy`: PASS, 916 passed / 15 optional private-artifact skips
  / 0 failed across 931 tests in the isolated worktree.
- `npm run ticket -- scope-check BRN-0036`: PASS before reports.
- No provider, credential, dataset, sealed U8, or private diagnostic action was
  performed.

## Risks / Follow-Ups

The v7 rule is bounded top-K review, not proof that no relevant memory exists
anywhere below the ranked page. That limitation is stated directly in the
provider instructions and is preferable to treating every lower-ranked corpus
row as mandatory evidence. Material or character-undelivered evidence remains
fail-closed. Any future change to relevance, page size, retrieval budget, or
the exhausted-budget controller belongs in a separate ticket.

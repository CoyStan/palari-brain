# BRN-0038 Technical Report

## Files Changed

- `src/retrieval-answer.mjs` bumps confirmation to v8, numbers displayed
  candidates locally, publishes the sparse findings tool schema and
  instructions, validates explicit numbers, and maps findings host-side.
- `tests/answer-confirmation.contract.test.mjs` replaces ordered-assessment
  fixtures and adds sparse closure, binding, invalid-input, non-recurrence,
  tail, truncation, and fail-closed coverage.
- `STATUS.md`, the ticket, and human report record the provider-free result.

## Verification

- Focused confirmation contracts: 10 passed / 0 failed.
- Default suite: 86 passed / 0 failed.
- Quickstart: 6 passed / 0 failed.
- Complete legacy suite: 917 passed / 15 optional skips / 0 failed across 932.
- Diff, ticket lint, committed-plus-dirty scope, report lint, and combined
  ticket checks pass before review.
- No provider, credential, private artifact, dataset, or sealed U8 access was
  used.

## Risks / Follow-Ups

- An empty findings list remains a semantic reviewer judgment; verbose
  per-candidate `not_used` prose never proved cognitive inspection either.
- Page-local numbers eliminate positional-order coupling and opaque-ID copying,
  but a live model has not yet exercised v8. Any live diagnostic requires a
  new ticket and explicit numeric aggregate-cap approval.
- The change is confined to the opt-in confirmation schema. Historical product
  and evaluation paths remain covered by the complete legacy suite.

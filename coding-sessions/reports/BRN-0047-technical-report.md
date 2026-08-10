# BRN-0047 Technical Report

## Files Changed

- `src/retrieval-answer.mjs` — add separate briefing and returned-evidence
  bridge eligibility, seed scoped raw canonical briefing rows, and supply
  their host-held text to bounded reranking.
- `src/openai.mjs` — attach only the final bounded host rejection code and
  reason to terminal commitment-repair errors.
- `tests/retrieval-frontier.contract.test.mjs` — prove first-call briefing
  bridging, zero seeding accounting, bounded reranker context, one-call bridge
  accounting, and unknown-anchor rejection.
- `tests/openai.contract.test.mjs` — prove normal and bounded-incomplete final
  rejection details, truncation, immutability, and content exclusion.
- `docs/BRAIN-API.md` — document briefing-anchor eligibility and the terminal
  `hostRejection` error surface.
- `STATUS.md` — record scope, behavior, and provider-free verification.
- `coding-sessions/tickets/open/BRN-0047-*.md` — record claim and closeout.
- `coding-sessions/human-report/BRN-0047-human-report.md` — provide the
  founder-readable closeout and current review state.

## Verification

- `node --test tests/openai.contract.test.mjs tests/retrieval-frontier.contract.test.mjs`:
  PASS, 82/82.
- `npm test`: PASS, 93/93.
- `npm run quickstart`: PASS, 6/6.
- `npm run test:legacy`: PASS, 969 passed, 15 optional skips, 0 failed across
  984 tests.
- Ticket, report, committed-plus-dirty scope, and diff gates: PASS.
- Independent review: pending.

## Risks / Follow-Ups

- Only raw `canonical_message` rows from a canonical-fallback briefing are
  seeded. Model-derived incremental digest rows remain ineligible because
  they are not canonical routing testimony.
- Briefing anchors are routing context only. They are not added to the answer
  commitment registry or selected evidence.
- The final host rejection reason is bounded to 1,000 characters and its code
  to 100 characters. The error does not copy request or evidence data.
- No paid run was made, so provider behavior and answer-quality impact remain
  for a later founder-approved diagnostic.

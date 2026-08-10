# BRN-0048 Technical Report

## Files Changed

- `src/retrieval-answer.mjs` — attach missing material evidence IDs to a
  non-enumerable host-internal symbol on the validation error.
- `src/openai.mjs` — translate those IDs to stable answer-local memory numbers
  and render one bounded repair instruction.
- `tests/openai.contract.test.mjs` — prove normal, bounded-incomplete,
  deduplication, content exclusion, and successful one-repair behavior.
- `docs/BRAIN-API.md` and `STATUS.md` — document the boundary and evidence.

## Verification

- Focused OpenAI and confirmation contracts: PASS, 81/81.
- `npm test`: PASS, 93/93.
- `npm run quickstart`: PASS, 6/6.
- `npm run test:legacy`: PASS, 970 passed, 15 optional skips, 0 failed across
  985 tests.
- Provider-free recorded-response replay: reproduced 13/13 responses and the
  exact missing-material host rejection with zero network calls.
- Ticket, report, scope, and diff gates: pending after candidate commit.
- Independent review: pending.

## Risks / Follow-Ups

- The repair still depends on the model assessing the named memories. It does
  not silently classify evidence or guarantee a valid second commitment.
- A live verification belongs after acceptance and the separate pacing ticket.

# BRN-0001-B Technical Report

## Files Changed

- `src/retrieval-answer.mjs` — adds pure UTC timestamp validation and
  question-relative arithmetic, plus a non-mutating decoration path for
  `memory_find`, `memory_read`, `memory_search`, and admitted graph edges.
  The answer instructions now direct providers to use the host-derived block.
- `tests/retrieval-answer.contract.test.mjs` — adds table-driven exact,
  partial-month, year-crossing, leap-day, same-instant, future, negative,
  invalid-date, surface-decoration, graph, and source-immutability checks.
- `docs/BRAIN-API.md` — documents `questionRelativeTime` fields, sign and
  calendar-month semantics, omission behavior, and canonical immutability.
- `STATUS.md` — records the implementation and verification state.
- `coding-sessions/tickets/open/BRN-0001-B-*.md` — records the specialist
  claim and lifecycle metadata.

## Verification

- `node --test tests/retrieval-answer.contract.test.mjs`: PASS — 9/9.
- `npm test`: PASS — 642 pass, 0 fail, 15 skipped, 657 total.
- `npm run quickstart`: PASS — all six journey stages.
- `git diff --check`: PASS.
- `npm run ticket -- scope-check BRN-0001-B`: PASS — four changed paths before
  reports/status closeout.
- `npm run ticket -- scope-check --committed-plus-dirty --target ticket/BRN-0001-repair-retrieved-answer-reliability BRN-0001-B`:
  required before review after the evidence commit.
- Documentation check: PASS — the public example matches the fields emitted
  by the answer-facing decoration path.

## Risks / Follow-Ups

- This supplies arithmetic metadata; it does not extract event dates from
  prose and does not guarantee a generated sentence is correct.
- Dates are parsed as instants and calendar-month adjustment is performed in
  UTC. Invalid or missing question/evidence dates omit metadata instead of
  guessing.
- The canonical brain result is copied before decoration. Provider text cannot
  author timestamps or override the host fields.
- BRN-0001-C remains required to verify A+B composition offline. Any live
  validation remains separately founder-gated.

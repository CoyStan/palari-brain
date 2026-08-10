# BRN-0046 Fresh Rereviewer Note

Reviewer: independent agent `/root/brn_0046_rereviewer`
Reviewed commit(s): `96d4206e284e737befe42ee02a138edfed5dc9ba`
Target branch: `main` at
`58b44d16995acfc62aeedd8f7cedef9cd6903f72`

## Review Result

REOPEN. The prior malformed-argument P2 is fixed for one identifiable,
standalone `memory_candidate_review` call. Invalid JSON and non-object
arguments now receive one normal-budget, same-page, review-only repair, and a
second malformed response is terminal. One different P2 mixed-call routing
issue remains.

## Findings

- P2 — A malformed candidate review mixed with `palari_answer_commit` can
  enter answer-commit repair instead of failing as a mixed response. At
  `src/openai.mjs:1402-1429`, the candidate-review repair correctly requires
  exactly one raw function call. However, when that check is false, the next
  fallback searches the same raw output for any answer-commit call. Lines
  1430-1437 then force a commit-only repair. This bypasses the mixed-call
  rejection at lines 1546-1552 because structured parsing never completed.
  A provider-free reproducer returned one search, then one response containing
  a malformed-JSON `memory_candidate_review` plus a valid
  `palari_answer_commit`. The adapter made a third model dispatch with only
  `palari_answer_commit` offered and forced. It made one search, zero review
  retrievals, and zero closure dispatches. The required parser boundary says
  mixed review calls cannot receive repair; the next dispatch must not become
  an answer commit.

No additional P0-P3 finding was identified. In particular, the compact wire
has no free-text exclusion field; its six reason codes and combined duplicate,
unknown, and returned-reference checks are bounded. The host still owns the
evidence IDs and exact excerpts. Material confirmation coverage,
non-abstaining used evidence, temporary inference, enumeration, and used-only
legacy compatibility remain enforced. The active answer-wire pins changed,
while the consumed BRN-0025 compatibility pins did not.

## Verification Reviewed

- Exact clean head and target: verified at
  `96d4206e284e737befe42ee02a138edfed5dc9ba` against
  `58b44d16995acfc62aeedd8f7cedef9cd6903f72` before this allowed note.
- Prior P2 cases: verified invalid JSON and non-object standalone review
  arguments receive one review-only dispatch on the same pending page. The
  repair surface contains only `memory_candidate_review`; one search is made;
  no extra retrieval or closure call is added; a second malformed response is
  terminal. Unknown and closure calls remain terminal by source inspection
  and existing contracts.
- Independent malformed-review plus answer-commit reproducer: FAIL as stated
  in the finding. The third dispatch offered and forced only
  `palari_answer_commit`.
- `node --test tests/openai.contract.test.mjs tests/answer-confirmation.contract.test.mjs`:
  PASS, 72/72.
- `npm test`: PASS, 91/91.
- `npm run quickstart`: PASS, 6/6.
- `node --test tests/openai-counted-responses.contract.test.mjs`: PASS, 16/16.
- `node --test tests/retrieval-answer.contract.test.mjs`: PASS, 44/44.
- `npm run test:legacy`: PASS, 959 passed, 15 optional skips, zero failed
  across 974 tests.
- `npm run ticket -- ticket-lint BRN-0046`: PASS.
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0046`:
  PASS for all 11 committed paths before this allowed note.
- `npm run ticket -- report-lint BRN-0046`: PASS before this note.
- `git diff --check
  58b44d16995acfc62aeedd8f7cedef9cd6903f72...96d4206e284e737befe42ee02a138edfed5dc9ba`:
  PASS.
- No provider, credential, environment file, private artifact, dataset,
  evaluation result, production service, paid operation, or sealed U8 item was
  accessed.

## Required Changes

- In the function-argument parser catch, reject any raw response that contains
  `memory_candidate_review` plus another function call before the general
  answer-commit repair fallback. Do not offer review repair or answer-commit
  repair for that mixed response.
- Add provider-free contracts for malformed JSON and non-object candidate
  reviews mixed with an answer commit and with a memory tool. Prove the exact
  terminal error, no repair dispatch, and no added review, search, retrieval,
  or closure call.
- Rerun the declared gates and submit a new exact committed head for fresh
  independent review.

## Recommendation

Recommend `reopen` at exact head
`96d4206e284e737befe42ee02a138edfed5dc9ba`. This recommendation does not
accept, merge, commit, or push the ticket.

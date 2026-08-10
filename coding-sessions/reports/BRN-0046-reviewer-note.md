# BRN-0046 Reviewer Note

Reviewer: fresh independent Codex reviewer `/root/brn_0046_reviewer`
Reviewed commit(s): `4d8162c` through
`82f1fdf5324878b42845005edb1df6cc0edc8341`
Target branch: `main` at `58b44d16995acfc62aeedd8f7cedef9cd6903f72`

## Review Result

FAIL. The compact commitment wire, host evidence binding, same-page host
audit, terminal repair limits, call accounting, scope, and declared tests
pass. However, one common malformed candidate-review format does not receive
the required repair. One P2 finding remains.

## Findings

- P2 — A `memory_candidate_review` call with malformed JSON or a non-object
  argument fails before the candidate-review repair can start. The generic
  function parser rejects these formats at `src/openai.mjs:497-515`. Its
  caller catches the error at `src/openai.mjs:1397-1414`, but that catch starts
  a repair only when the output attempted `palari_answer_commit`. Therefore,
  an identifiable `memory_candidate_review` with malformed arguments exits
  with `OPENAI_FUNCTION_ARGUMENTS_INVALID` instead of receiving the one
  same-pending-page, review-only repair required by acceptance criterion 4.
  An independent provider-free reproducer first returned one confirmation
  search page and then returned `memory_candidate_review` with arguments
  `{"findings":[`. It ended after two dispatches with
  `OPENAI_FUNCTION_ARGUMENTS_INVALID`; the host saw one search, zero review
  calls, and no repair dispatch. The current repair test starts with valid JSON
  that contains an out-of-range candidate number, so it does not cover this
  earlier parser failure.

No additional finding was identified in the absence of model-facing
free-text exclusion fields, the six fixed exclusion codes, combined duplicate
and reference validation, non-abstaining used-evidence rule, host-owned ID and
exact-excerpt binding, temporary inference and enumeration translation,
material confirmation coverage, used-only legacy compatibility, active wire
pin update, unchanged consumed BRN-0025 pins, refusal and empty-response
terminality, forbidden repair tools, second invalid review, normal-budget
exhaustion, retrieval and closure accounting, recovered-operation audit,
declared R2 risk, or allowed and forbidden path enforcement.

## Verification Reviewed

- Exact head and target: verified at
  `82f1fdf5324878b42845005edb1df6cc0edc8341` against `main` at
  `58b44d16995acfc62aeedd8f7cedef9cd6903f72`; all ten committed paths are
  allowed, with no forbidden path or rename and a clean worktree before this
  reviewer note.
- `node --test tests/openai.contract.test.mjs tests/answer-confirmation.contract.test.mjs`:
  PASS, 68/68.
- `npm test`: PASS, 91/91.
- `npm run quickstart`: PASS, 6/6.
- `node --test tests/openai-counted-responses.contract.test.mjs`: PASS, 16/16.
- `node --test tests/retrieval-answer.contract.test.mjs`: PASS, 44/44.
- `npm run test:legacy`: PASS, 955 passed / 15 optional skips / 0 failed
  across 970 tests.
- `npm run ticket -- ticket-lint BRN-0046`: PASS.
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0046`:
  PASS for all ten ticket paths before this allowed reviewer note.
- `git diff --check 58b44d16995acfc62aeedd8f7cedef9cd6903f72..82f1fdf5324878b42845005edb1df6cc0edc8341`:
  PASS.
- Independent malformed-JSON candidate-review reproducer: FAIL as described
  in the finding, with one search, zero review calls, and no repair dispatch.
- `npm run ticket -- check BRN-0046` and report lint were expected to report a
  missing reviewer note before this note was created.
- No provider, credential, environment file, private artifact, dataset,
  evaluation result, production service, paid operation, or sealed U8 item was
  accessed.

## Required Changes

- When the returned function is identifiable as `memory_candidate_review`,
  route malformed JSON and non-object arguments into the same single
  normal-budget, same-pending-page, review-only repair. Keep malformed output
  during that repair terminal.
- Add provider-free contracts for malformed JSON and non-object first review
  arguments. Prove one repair dispatch, the exact review-only tool surface,
  one search, no extra retrieval or closure call, and terminal behavior if the
  repaired review is also malformed.
- Rerun the declared gates and submit a new exact committed head for fresh
  independent review.

## Recommendation

Recommend `reopen` at exact head
`82f1fdf5324878b42845005edb1df6cc0edc8341`. This recommendation does not
accept, merge, commit, or push the ticket.

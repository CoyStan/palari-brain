# BRN-0046 Final Rereviewer Note

Reviewer: fresh independent Codex rereviewer
`/root/brn_0046_final_rereviewer`
Reviewed commit: `40d8d2029d8e46c65ff12698c76c56677323ab98`
Target branch: `main` at
`58b44d16995acfc62aeedd8f7cedef9cd6903f72`

## Review Result

ACCEPT. Both prior P2 findings are fixed. The exact candidate passes all six
acceptance criteria, the required provider-free gates, scope checks, and
independent adversarial checks. I found no unresolved P0-P3 issue.

## Findings

- None.

## Verification Reviewed

- Exact head and target: verified at
  `40d8d2029d8e46c65ff12698c76c56677323ab98` against `main` at
  `58b44d16995acfc62aeedd8f7cedef9cd6903f72`. The worktree was clean before
  this allowed reviewer note.
- First prior P2: fixed. A standalone `memory_candidate_review` with invalid
  JSON or a non-object argument receives one normal-budget repair. The next
  dispatch offers and forces only `memory_candidate_review`. It uses the same
  pending page. A second malformed review is terminal.
- Second prior P2: fixed. Any raw response that contains
  `memory_candidate_review` and another function call is terminal before the
  candidate-review or answer-commit repair paths. Direct contracts cover
  invalid JSON and non-object review arguments mixed with both
  `palari_answer_commit` and `memory_search`.
- Independent mixed-call order matrix: PASS, 8/8. It tested both malformed
  argument forms, both other function names, and both call orders. Every case
  returned `OPENAI_CONFIRMATION_REVIEW_MIXED_CALLS` after one dispatch, with
  zero retrieval calls and zero repair dispatches.
- Repair accounting: direct tests prove one search and no extra retrieval or
  closure call. Refusal, empty response, forbidden repair tool, second invalid
  review, and normal-budget exhaustion are terminal. Unknown calls and closure
  calls remain terminal.
- Compact commitment wire: the declared model tool contains `usedMemories`
  with one short contribution and `excludedMaterialMemories` with one of six
  fixed reason codes. It has no free-text exclusion field. Unrelated rows can
  be omitted.
- Host boundary: the adapter translates answer-local memory numbers to
  host-owned evidence IDs and exact bounded excerpts. Unknown, duplicate, and
  unreturned numbers fail closed. Every reviewer-marked material item is still
  required by the unchanged host confirmation boundary. A non-abstaining
  answer needs at least one used memory.
- Compatibility: only the old used-only `bases` shape is accepted. The model
  tool does not offer it, and old free-text `not_used` entries are rejected.
  Temporary inference provenance, enumeration, recommendation commitments,
  and the consumed BRN-0025 compatibility pins stay unchanged. Only the active
  answer-wire byte and hash pins changed.
- Host recovery audit: only the first rejected candidate review can be ignored,
  and only after a later successful review on the same search generation. A
  later search cannot hide the failure. The recovery adds no search or closure
  allowance.
- `node --test tests/openai.contract.test.mjs tests/answer-confirmation.contract.test.mjs`:
  PASS, 77/77.
- `npm test`: PASS, 91/91.
- `npm run quickstart`: PASS, 6/6.
- `node --test tests/openai-counted-responses.contract.test.mjs`: covered by
  the legacy suite; the recorded focused result is PASS, 16/16.
- `node --test tests/retrieval-answer.contract.test.mjs`: covered by the
  legacy suite; the recorded focused result is PASS, 44/44.
- `npm run test:legacy`: PASS, 964 passed, 15 optional skips, and 0 failed
  across 979 tests.
- Ticket lint, report lint, committed-plus-dirty scope, and exact diff checks:
  PASS. All changed paths are allowed. No forbidden path or rename is present.
- Risk and governance: R2 remains correct for this cross-file answer behavior.
  The specialist did not accept, merge, or push acceptance for its own work.
- No provider, credential, environment file, private artifact, dataset,
  evaluation result, production service, paid operation, or sealed U8 item was
  accessed.

## Required Changes

- None.

## Recommendation

Recommend `accept` at exact committed head
`40d8d2029d8e46c65ff12698c76c56677323ab98`. This recommendation does not
accept, merge, commit, or push the ticket.

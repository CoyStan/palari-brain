# BRN-0041 Technical Report

## Files Changed

- `src/retrieval-answer.mjs` advances confirmation to v9, gives the reviewer
  the full default retrieval allowance, and adds host-validated
  bounded-incomplete commitment handling.
- `src/openai.mjs` routes a valid final commitment through that bounded path
  when retrieval is exhausted and raises the default dispatch emergency guard
  from 7 to 11.
- Confirmation and OpenAI contract tests cover multi-round model-directed
  closure, bounded best effort, and bypass rejection.
- `docs/BRAIN-API.md` documents normal versus bounded-incomplete outcomes.
- `STATUS.md`, the ticket, and the human report record the product decision and
  verification.

## Verification

- `node --test tests/answer-confirmation.contract.test.mjs tests/openai.contract.test.mjs`:
  41/41 pass.
- `npm test`: 87/87 pass.
- `npm run quickstart`: 6/6 pass.
- `npm run test:legacy`: 921 pass, 15 optional skips, 0 failures, 936 total.
- `git diff --check`: pass before closeout.
- All work is provider-free; no credential, private evaluation artifact,
  dataset, sealed U8, or mutable aggregate ledger was accessed.

## Behavior And Safety

- Default confirmation retrieval increases from 2 to the existing global
  `DEFAULT_RETRIEVAL_CALLS` value of 4. The caller may still choose 1-4 as an
  emergency constraint.
- The model still receives only unseen, information-deduplicated confirmation
  candidates and reviews them with short page-local numbers.
- `commitIncompleteAnswer` is an internal provider callback, not a model tool.
  The host enables it only after all allowed searches are spent, at least one
  search occurred, and the latest candidate page was assessed.
- The callback passes through the same commitment validator as normal answers.
  A distinct host-owned WeakSet marks the exact returned object as incomplete;
  an arbitrary provider object cannot claim the state.
- Normal closure remains unchanged. Bounded completion reports
  `status: "bounded_incomplete"`, `complete: false`, `exhausted: true`, and
  `closureReason: "emergency_bound"` while preserving retrieval and evidence
  telemetry.
- The OpenAI adapter invokes bounded completion only after an ordinary commit
  receives `MEMORY_ANSWER_CONFIRMATION_REQUIRED` and its own retrieval counter
  is at the host-declared limit. If the latest displayed page still needs
  review, the adapter returns that host rejection to the model and leaves the
  review tool available. If the page is assessed but the bounded commitment is
  malformed, the adapter preserves one normal forced-commit repair. Real
  host-plus-adapter tests cover both seams. Other rejections and provider
  failures retain their existing behavior.

## Risks / Follow-Ups

- A bounded-incomplete answer is intentionally less certain than a normally
  closed answer. Callers must inspect the explicit status if their domain
  requires abstention or escalation.
- Four searches and eleven model dispatches are emergency resource limits, not
  completeness guarantees or prescribed reasoning steps.
- This provider-free change proves control behavior, not that Luna will answer
  the frozen health question correctly. Any live validation requires a new
  identity and founder-approved numeric aggregate cap.

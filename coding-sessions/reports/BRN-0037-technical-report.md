# BRN-0037 Technical Report

## Files Changed

- `STATUS.md` records the single terminal alpha-diagnostic outcome, retrieval
  coverage, confirmation failure, source custody, and reconciled cost.
- The BRN-0037 ticket records its consumed identity and specialist closeout.
- The Level 1 human report explains the result without treating it as a grade.
- Mutable adapter, terminal result, replay, and audit files remain gitignored
  under `.palari-alpha/`; no private artifact is committed.

## Verification

- Provider-free preflight pinned question `gpt4_31ff4165`, confirmation schema
  v7, 5,120 output tokens, the empty v8 namespace, exact opening ledger, sealed
  U8 exclusion, and the frozen source hash before dispatch.
- Exactly one zero-retry invocation ran. It produced six OpenAI dispatches,
  three embedding inputs, no judge call, and one preserved terminal failure.
- Provider-free replay reproduced `Candidate review must assess exactly 20
  latest candidates`, using 460 cache hits and zero provider inputs.
- Replay verified 20 unique confirmation candidates, no overlap with main
  retrieval, 5/6 marked spans and 4/4 decisive device facts returned across
  the journey, no bridge/read call, zero durable writes, and an unchanged
  source hash.
- Measured provider spend reconciles to `$0.00853124`; conservative accounting
  retained `$0.70` and closed at the authorized aggregate cap `$37.21155714`.
- `npm test` passes 85/85, quickstart passes 6/6, and ticket scope/report/diff
  gates pass.

## Risks / Follow-Ups

- There is no official result: the provisional two-device answer was never
  revised or judged.
- The run did not reach v7 closure because the model returned 19 ordered
  assessments for a complete 20-candidate page. Therefore it neither validates
  nor invalidates the BRN-0036 closure distinction.
- The consumed identity must not be retried. Any general repair for assessment
  completeness belongs to a separate product ticket and must avoid a fixed
  health schema or opaque evidence-ID copying.

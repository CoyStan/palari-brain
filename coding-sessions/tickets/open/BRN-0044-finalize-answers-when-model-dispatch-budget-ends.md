---
id: BRN-0044
title: "Finalize answers when model dispatch budget ends"
stream: memory
level: 1
parent_id: 
root_id: BRN-0044
children: []
status: in-review
risk: R2
priority: P0
agents_allowed: 2
claimed_by:
claimed_at:
target_branch: "main"
branch: "ticket/BRN-0044-finalize-answers-when-model-dispatch-budget-ends"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0044-finalize-answers-when-model-dispatch-budget-ends"
allowed_paths:
  - "src/openai.mjs"
  - "tests/openai.contract.test.mjs"
  - "docs/BRAIN-API.md"
  - "STATUS.md"
  - "coding-sessions/tickets/open/BRN-0044-*.md"
  - "coding-sessions/tickets/closed/BRN-0044-*.md"
  - "coding-sessions/reports/BRN-0044-*.md"
  - "coding-sessions/human-report/BRN-0044-*.md"
  - "coding-sessions/handoffs/BRN-0044-*.md"
forbidden_paths:
  - ".env"
  - ".env.*"
  - "*.key"
  - "**/*.key"
  - "secrets/**"
  - "**/secrets/**"
  - "*secret*"
  - "**/*secret*"
  - "*token*"
  - "**/*token*"
  - "infra/prod/**"
  - "prod/**"
  - "runtime-data/**"
  - ".palari-probe/**"
  - ".palari-regression/**"
  - "data/**"
  - "evals/results/**"
  - ".palari-alpha/**"
requires_human_confirmation: false
requires_review: true
verification:
  - "node --test tests/openai.contract.test.mjs"
  - "npm test"
  - "npm run quickstart"
  - "npm run test:legacy"
  - "npm run ticket -- check BRN-0044"
created: 2026-08-10
updated: 2026-08-10
---

# BRN-0044 Finalize answers when model dispatch budget ends

## Goal

Return the best host-validated answer that the model can support from evidence
already collected when the normal model-dispatch budget ends. Replace the
current immediate `OPENAI_MODEL_DISPATCH_BUDGET_EXHAUSTED` failure with a
strictly bounded closure path that cannot start a new memory search, keeps the
existing evidence-commitment checks, and still fails closed when closure
cannot produce a valid answer.

## Scope

- Treat `maxModelDispatches` as the ceiling for normal planning, retrieval,
  answer, and confirmation work.
- After that ceiling, permit at most two closure-only dispatches. The first may
  assess an already-returned confirmation page or commit an answer. The second
  is commit-only and exists only for the existing single commitment repair.
- When no evidence exists, make closure tool-disabled and accept only a normal
  bounded text answer. When evidence exists, require the unchanged structured
  answer commitment and host validation.
- Preserve the configured retrieval-call budget. Closure cannot call a new
  search, read, timeline, bridge, graph, or planning tool.
- Add provider-free contracts for supported-answer closure, pending-page
  review, one commitment repair, exact physical-dispatch bounds, and terminal
  failure after closure is exhausted.
- Document the distinction between normal model work and closure-only work,
  and record the live alpha symptom without rewriting its first-attempt
  artifacts.

## Out Of Scope

- No change to retrieval ranking, search budgets, confirmation information
  filtering, answer semantics, prompts outside closure state, evidence
  identity, exact-excerpt binding, durable memory, admission, or user/workspace
  isolation.
- No unconditional acceptance of raw text after evidence retrieval. No host-
  authored factual answer and no bypass of `commitAnswer` or
  `commitIncompleteAnswer`.
- No provider call, credential access, private `.palari-alpha` artifact access,
  dataset execution, failed-question retry, judge call, sealed U8 access, or
  diagnostic regrade inside the ticket worktree. The founder-authorized live
  continuation occurs only after review, acceptance, merge, and push.
- No increase to the four-call memory retrieval budget or the 5,120-token
  output ceiling. No automatic transport retry.

## Acceptance Criteria

1. Exhausting `maxModelDispatches` no longer throws before bounded closure.
   The provider makes no more than two additional physical model calls, and
   the total physical ceiling is `maxModelDispatches + 2`.
2. Closure offers no new retrieval or planning tool. A confirmation session
   may assess only its already-returned pending page on the first closure call;
   the final call is answer-commit only when evidence exists.
3. A valid supported answer is returned through the unchanged host commitment
   function. A bounded-incomplete confirmation answer remains explicitly
   marked incomplete by the host; no uncommitted answer is accepted after
   evidence retrieval.
4. One invalid closure commitment may use the existing single repair. A
   refusal, invalid repaired commitment, forbidden tool call, or empty closure
   response remains terminal with a typed error.
5. Existing early-answer, retrieval-finalization, evidence-number translation,
   confirmation, and maximum-configuration contracts remain green. Focused,
   alpha, quickstart, legacy, scope, report, and diff gates pass before review.

## Verification

- `node --test tests/openai.contract.test.mjs`
- `npm test`
- `npm run quickstart`
- `npm run test:legacy`
- `npm run ticket -- check BRN-0044`
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0044`
- `git diff --check main...HEAD`

## Stop Conditions

- Stop if the work needs a path outside `allowed_paths` or touches `forbidden_paths`.
- Stop if graceful closure requires accepting uncommitted evidence-backed text,
  inventing an answer in the host, reopening memory retrieval, exceeding two
  closure dispatches, or making a provider call during implementation.
- Stop if the focused contracts show that the closure path can hide an invalid
  commitment, an unassessed confirmation page, or a provider refusal.

## Specialist Closeout

- Added two closure-only dispatch slots after the configured normal model-work
  ceiling. The first can assess an already-returned confirmation page or
  commit; the second forces the existing answer-commit repair. Neither can
  start another memory retrieval or plan.
- Kept the existing four-call retrieval limit, 11 normal-dispatch maximum,
  5,120-token output maximum, host-owned evidence-number translation, exact
  canonical excerpt binding, one-repair rule, and terminal refusal/invalid
  behavior.
- Added provider-free contracts for no-evidence text closure, confirmation
  review then bounded-incomplete commit, invalid commitment repair, mixed
  commitment plus forbidden-tool rejection, and exact `normal + 2`
  physical-call exhaustion.
- The first independent review found that mixed forbidden calls could enter
  commitment repair. Closure parsing now validates against the exact tools
  offered for that dispatch, so declared-but-not-offered and unknown functions
  are terminal before repair. The original reviewer note is preserved.
- Verification passes focused OpenAI 42/42 across 40 top-level tests, alpha
  90/90, quickstart 6/6, and legacy 942 pass / 15 optional skip / 0 fail across
  957 tests. Ticket scope
  and diff checks pass.
- No provider, credential, private alpha artifact, dataset, sealed U8 item,
  durable memory, production service, or live campaign was accessed from the
  ticket worktree. Live failed-case continuation remains outside this ticket.

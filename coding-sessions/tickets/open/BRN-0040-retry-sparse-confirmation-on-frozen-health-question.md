---
id: BRN-0040
title: "Retry sparse confirmation on frozen health question"
stream: evaluation
level: 1
parent_id: 
root_id: BRN-0040
children: []
status: open
risk: R1
priority: P1
agents_allowed: 1
claimed_by:
claimed_at:
target_branch: "main"
branch: "ticket/BRN-0040-retry-sparse-confirmation-on-frozen-health-question"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0040-retry-sparse-confirmation-on-frozen-health-question"
allowed_paths:
  - "STATUS.md"
  - "coding-sessions/tickets/open/BRN-0040-*.md"
  - "coding-sessions/tickets/closed/BRN-0040-*.md"
  - "coding-sessions/reports/BRN-0040-*.md"
  - "coding-sessions/human-report/BRN-0040-*.md"
  - "coding-sessions/handoffs/BRN-0040-*.md"
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
requires_human_confirmation: true
requires_review: false
verification:
  - "provider-free BRN-0040 private adapter preflight"
  - "npm test"
  - "npm run quickstart"
  - "npm run ticket -- check BRN-0040"
created: 2026-08-09
updated: 2026-08-09
---

# BRN-0040 Retry sparse confirmation on frozen health question

## Goal

Run one fresh replacement alpha diagnostic of the frozen health-device
question through the founder-accepted sparse confirmation v8 path. Determine
whether the reviewer reports only material numbered findings, the answer
revises from newly found evidence when necessary, and confirmation closes
without repetitive per-memory output.

## Scope

- Identity: `palari-health-confirmation-v10-2026-08-09`.
- Execute only LongMemEval question `gpt4_31ff4165`; reject the complete sealed
  U8 set before execution and explicitly reject `1568498a`.
- Pin product behavior to accepted BRN-0038 commit `8782bfb`, confirmation
  schema `palari-answer-confirmation/v8`, Luna output ceiling 5,120 tokens, two
  confirmation searches, short page-local candidate numbers, sparse material
  findings, the existing Gemini embedding model/cache, local Ettin reranking,
  and the existing official judge.
- Reuse the frozen canonical source store and verify SHA-256
  `b1ac32ef9e5ce86cd7509eec1891e0080a80a1b7dc269b2f2c1c0efca3a1f70b`
  before and after execution. Use a new private namespace; never mutate or
  reinterpret v9 or any earlier result.
- Run exactly once with zero retries and no tuning before, during, or after the
  case. The official judge may run once only after the answer completes.
- Run from clean, synced canonical `main`; keep all live artifacts in the
  gitignored `.palari-alpha/` namespace and tracked reporting in this ticket's
  worktree.
- Audit the provisional and final answer, reference, marked evidence, smallest
  decisive facts, selected and materially used evidence, sparse findings and
  host-bound evidence IDs, confirmation closure, duplicate suppression,
  bridge/read/frontier activity, durable writes, provider usage/cost, source
  immutability, and any failure stage.
- Report this only as an alpha diagnostic, never a benchmark regrade.

## Budget Gate

- Opening private aggregate ledger: exactly `$37.91155714`.
- Expected measured fresh spend: approximately `$0.01-$0.03`.
- Conservative additional reservation ceiling: `$0.70`.
- Proposed aggregate authorization ceiling: `$38.61155714`.
- No credential or provider access is permitted until the founder explicitly
  approves that exact numeric aggregate ceiling after provider-free preflight.
  Expected spend and the hard authorization ceiling remain distinct.

## Out Of Scope

- No product, prompt, sparse schema, page size, token limit, retrieval,
  reranker, embedding, bridge, frontier, evidence policy, or cost-accounting
  change.
- No other question, population run, sealed U8 access, historical-score
  change, publication, further retry, reroll, or cap top-up.
- No persistent co-use edge or durable memory write.
- Do not resume v9 or use its incomplete artifacts as a result.
- No repair after dispatch. Preserve and report any failure without changing
  this identity or claiming an official result.

## Acceptance Criteria

1. Provider-free preflight proves the v10 namespace is absent, the ledger is
   exactly `$37.91155714`, schema is v8, the selected ID is exactly
   `gpt4_31ff4165`, sealed U8 is excluded, source custody matches the frozen
   hash, and runtime settings match this ticket.
2. No provider call occurs before explicit founder approval of aggregate cap
   `$38.61155714`; the runner reserves `$0.70` before the answer stage and
   refuses any call that would exceed that cap.
3. One no-retry invocation either completes the answer and at most one judge
   call or records the exact terminal failure. No tuning or second invocation
   occurs.
4. The audit records each confirmation page, page-local candidate numbers,
   sparse findings, host-bound evidence IDs, implicit non-material candidates,
   page completeness, lower-ranked tail, closure, and evidence recurrence.
5. The audit separately reports marked-span and decisive-fact retrieval,
   selection/material use, bridge/read/frontier behavior, durable writes,
   measured versus conservatively accounted cost, and source hash equality.
6. `STATUS.md` and the Level 1 human report state the outcome honestly as an
   alpha diagnostic. Core tests, quickstart, ticket gates, and diff checks pass
   with tracked changes inside ticket scope.

## Ticket Completion Contract

### Definition Of Done

- The v10 identity has exactly one preserved terminal outcome, or remains
  unconsumed because preflight or budget authorization failed.
- The tracked closeout explains sparse confirmation behavior without changing
  the product.

### Expansion Rules

- Any defect discovered becomes a separate successor ticket. Do not fix it or
  rerun this identity here.
- Another invocation, question, or aggregate cap requires fresh founder
  direction and a new ticket.

### Final Review Gate

- This is a founder-requested R1 alpha diagnostic with no product change.
  Independent review is not required; exact numeric-cap approval is mandatory
  before live execution.

## Verification

- Provider-free BRN-0040 private adapter preflight.
- `npm test`
- `npm run quickstart`
- `npm run ticket -- check BRN-0040`
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0040`
- `git diff --check main...HEAD`

## Stop Conditions

- Stop if the work needs a path outside `allowed_paths` or touches `forbidden_paths`.
- Stop before credentials or providers if the v10 namespace exists, main is
  not clean and synced, the opening ledger/source/schema/runtime differs, the
  selected ID intersects sealed U8, or the founder has not explicitly approved
  aggregate cap `$38.61155714`.
- Once dispatched, stop after this one case regardless of success, official
  label, or failure. Do not tune or retry.

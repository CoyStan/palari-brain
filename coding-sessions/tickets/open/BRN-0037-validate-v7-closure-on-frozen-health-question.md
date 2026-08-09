---
id: BRN-0037
title: "Validate v7 closure on frozen health question"
stream: evaluation
level: 1
parent_id: 
root_id: BRN-0037
children: []
status: open
risk: R1
priority: P1
agents_allowed: 1
claimed_by:
claimed_at:
target_branch: "main"
branch: "ticket/BRN-0037-validate-v7-closure-on-frozen-health-question"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0037-validate-v7-closure-on-frozen-health-question"
allowed_paths:
  - "STATUS.md"
  - "coding-sessions/tickets/open/BRN-0037-*.md"
  - "coding-sessions/tickets/closed/BRN-0037-*.md"
  - "coding-sessions/reports/BRN-0037-*.md"
  - "coding-sessions/human-report/BRN-0037-*.md"
  - "coding-sessions/handoffs/BRN-0037-*.md"
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
  - "provider-free BRN-0037 private adapter preflight"
  - "npm test"
  - "npm run quickstart"
  - "npm run ticket -- check BRN-0037"
created: 2026-08-09
updated: 2026-08-09
---

# BRN-0037 Validate v7 closure on frozen health question

## Goal

Run one fresh alpha diagnostic of the previously used health-device question
through the founder-accepted confirmation v7 product path. Determine whether a
fully delivered candidate page can now close without exhausting its ordinary
lower-ranked tail, while preserving duplicate exclusion, evidence validation,
bounded work, source custody, and honest failure behavior.

## Scope

- Identity: `palari-health-confirmation-v8-2026-08-09`.
- Execute only LongMemEval question `gpt4_31ff4165`; reject the complete sealed
  U8 set before loading the selected question and explicitly reject
  `1568498a`.
- Pin the accepted BRN-0036 product implementation at merge commit `c528759`,
  confirmation schema `palari-answer-confirmation/v7`, Luna output ceiling
  5,120 tokens, two confirmation searches, ordered host-bound assessments,
  the existing Gemini embedding model/cache, local Ettin reranking, and the
  existing official judge.
- Reuse the frozen canonical source store and verify its SHA-256 before and
  after the run. Create a new private result namespace; do not mutate any
  predecessor result.
- Run exactly once with zero retries and no tuning before, during, or after the
  case. The judge may run once only if the answer boundary completes.
- Execute the live runner from clean, synced canonical `main`, because the
  reusable runner confines artifacts to that checkout's gitignored
  `.palari-alpha/` namespace. Use the ticket worktree only for tracked
  reporting and ticket state.
- Audit the answer and reference, dataset-marked evidence, smallest decisive
  facts, selected/materially used evidence, confirmation pages and closure,
  duplicate suppression, bridge/read/frontier activity, durable writes,
  provider usage/cost, source immutability, and any failure stage.
- Record the outcome in `STATUS.md` and the BRN-0037 human report. Label it an
  alpha diagnostic, never a benchmark regrade.

## Budget Gate

- Opening private aggregate ledger: exactly `$36.511557139999994`.
- Expected measured fresh spend: approximately `$0.01-$0.03`.
- Conservative fresh reservation ceiling: `$0.70`.
- Proposed aggregate authorization ceiling: `$37.21155714`.
- These figures are a proposal, not provider authority. No credential or
  provider access is permitted until the founder explicitly approves the
  numeric aggregate ceiling `$37.21155714` after the clean preflight is
  reported. Expected spend and the hard authorization ceiling remain distinct.

## Out Of Scope

- No product, prompt, page-size, token-limit, retrieval, reranker, embedding,
  bridge, frontier, evidence-policy, or cost-accounting change.
- No other question, population run, sealed U8 access, result reinterpretation,
  historical-score change, publication, retry, reroll, or cap top-up.
- No persistent co-use edge or durable memory write.
- No use of a failed or partial output as an official result. Preserve and
  report any terminal failure without repairing it inside this identity.

## Acceptance Criteria

1. A provider-free preflight proves the new private result namespace is absent,
   the ledger equals the declared opening value, confirmation schema is v7,
   the selected ID is exactly `gpt4_31ff4165`, sealed U8 is excluded, source
   custody matches the frozen predecessor, and all runtime budgets/settings
   match this ticket.
2. No provider call occurs before explicit founder approval of aggregate cap
   `$37.21155714`; the runner reserves `$0.70` before the answer stage and
   refuses any call that would exceed that cap.
3. One no-retry invocation either completes the answer and one official judge
   call or records the exact terminal failure. No inter-case or post-case
   tuning occurs.
4. The audit reports whether confirmation received a character-complete page,
   whether a lower-ranked tail remained, every ordered assessment, whether
   closure occurred, and whether any candidate or information identity
   recurred.
5. The audit separately reports marked-span retrieval, decisive-fact
   retrieval, selection and material use, bridge/read/frontier behavior,
   durable writes, measured versus conservatively accounted cost, and source
   hash equality.
6. `STATUS.md` and the Level 1 human report record the result honestly as an
   alpha diagnostic. `npm test`, quickstart, ticket checks, and diff checks
   pass; tracked changes remain inside ticket scope.

## Ticket Completion Contract

### Definition Of Done

- The single identity has one preserved outcome, or remains unconsumed because
  preflight or budget authorization failed.
- The tracked closeout explains what v7 did without modifying product behavior.

### Expansion Rules

- Any product defect discovered becomes a separate successor ticket. Do not
  fix it or rerun this identity here.
- A required aggregate cap above `$37.21155714`, another question, or another
  invocation requires new founder direction and a new ticket.

### Final Review Gate

- This is a founder-requested R1 alpha diagnostic with no product change.
  Independent review is not required; founder approval of the exact numeric
  cap is still mandatory before the live call.

## Verification

- Provider-free BRN-0037 private adapter preflight.
- `npm test`
- `npm run quickstart`
- `npm run ticket -- check BRN-0037`
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0037`
- `git diff --check main...HEAD`

## Stop Conditions

- Stop if the work needs a path outside `allowed_paths` or touches `forbidden_paths`.
- Stop before credentials or providers if the result namespace already exists,
  main is not clean and synced, the opening ledger/source/schema/runtime differs,
  the selected ID intersects sealed U8, or the founder has not explicitly
  approved aggregate cap `$37.21155714`.
- Once dispatched, stop after this one case regardless of success, judge
  result, or failure. Do not tune or retry.

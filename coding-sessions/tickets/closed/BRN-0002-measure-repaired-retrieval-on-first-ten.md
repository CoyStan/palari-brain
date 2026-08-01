---
id: BRN-0002
title: "Measure Repaired Retrieval on First Ten"
stream: evaluation
level: 1
parent_id: 
root_id: BRN-0002
children: []
status: accepted
risk: R3
priority: P0
agents_allowed: 1
claimed_by:
claimed_at:
target_branch: "main"
branch: "ticket/BRN-0002-measure-repaired-retrieval-on-first-ten"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0002-measure-repaired-retrieval-on-first-ten"
allowed_paths:
  - "evals/predictions.md"
  - "docs/DECISIONS.md"
  - "STATUS.md"
  - "coding-sessions/tickets/open/BRN-0002-*.md"
  - "coding-sessions/tickets/closed/BRN-0002-*.md"
  - "coding-sessions/reports/BRN-0002-*.md"
  - "coding-sessions/human-report/BRN-0002-*.md"
  - "coding-sessions/handoffs/BRN-0002-*.md"
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
requires_review: true
verification:
  - "npm run ticket -- ticket-lint-all"
  - "npm run answer-interpretation-regression"
  - "npm test"
  - "npm run quickstart"
  - "node /home/quetza/palari-brain-private/retrieval-first10-live-v1-launcher.mjs --verify"
created: 2026-07-31
updated: 2026-08-01
---

# BRN-0002 Measure Repaired Retrieval on First Ten

## Goal

Measure the repaired Palari answer boundary once on LongMemEval S60 ordinals
1-10, preserving every prior terminal identity and recording the complete
private result under one fresh, capped, preregistered identity.

## Scope

- Freeze the exact ordered population `08e075c7`, `09d032c9`, `16c90bf4`,
  `5e1b23de`, `80ec1f4f_abs`, `0977f2af`, `0a34ad58`, `0edc2aef`,
  `10d9b85a`, and `1192316e` before any provider call.
- Carry the terminal J4 opening ledger forward exactly as `$3.57540465`
  accounted (`$1.6204536` measured plus `$1.95495105` uncertain).
- Use fresh identity `j4-active-retrieval-first10-v1`, a `$1.50` fresh hard
  cap, and therefore a `$5.07540465` cumulative boundary.
- Freeze and independently review predictions, the one-shot launcher, current
  product hashes, dataset hash, predecessor manifest, and stop rules before
  dispatch.
- Invoke one command once. It performs the existing combined native-tool and
  semantic compatibility smoke, stops before question 1 if that fails, or
  otherwise answers and officially judges all ten in order.
- Preserve the private terminal evidence outside the repository danger zones,
  then record the measured result and exact spend in `STATUS.md` whatever they
  are.

## Out Of Scope

- No product-code change, dataset download, writer, reducer, graph extraction,
  provider retry, reroll, selective regrade, answer edit, judge edit, public
  score, or mutation of terminal v1-v5 evidence.
- No claim that these inspected first-ten cases are an unbiased generalization
  estimate.
- No execution beyond question 10 and no use of sealed U8 question `1568498a`.

## Acceptance Criteria

1. `evals/predictions.md` freezes the exact population, identity, model and
   prompt hashes, predecessor evidence, predictions, accounting, and stop
   rules before any provider request.
2. An independent reviewer confirms the frozen runner is one-shot, fail-closed,
   capped at `$1.50`, reads credentials only after all offline verification,
   and cannot mutate earlier terminal evidence.
3. The single invocation either stops after a failed compatibility smoke or
   reaches and officially judges each of the ten ordered questions exactly
   once; its first outcome is terminal.
4. The terminal evidence records per-question answers, official labels,
   retrieval/semantic use, corrected evidence-to-session coverage, physical
   call counts, and measured versus uncertain spend.
5. `STATUS.md` records the complete result whatever it is, grades the
   preregistered categories failing-first, answers the product stop rule, and
   advances `Next` without authorizing another live run.

## Ticket Completion Contract

### Goal

Produce one defensible private live measurement of the repaired answer
boundary across S60 ordinals 1-10.

### Non-Goals

Do not tune to observed outputs, improve benchmark answers during execution,
or turn a seen-case diagnostic into a public benchmark claim.

### Definition Of Done

- The preregistration and one-shot runner freeze are committed and pushed
  before the provider invocation.
- The private result is immutable and rehashes, or a compatibility failure is
  preserved as the terminal result.
- Required offline verification, technical report, reviewer note, human
  report, result record, acceptance, merge, and push are complete.

### Evidence Required

- Exact freeze commit, product/dataset/predecessor/launcher/runtime hashes,
  offline verification output, and independent pre-dispatch review.
- Terminal report, meter, provider transcript manifest, per-question official
  labels, spend reconciliation, and post-run secret scan.
- Full tests, quickstart, ticket lint/report lint, and committed scope check.

### Expansion Rules

- A compatibility or question failure is the result; do not fix and rerun
  inside this ticket.
- Any product defect found becomes a later ticket. Any additional provider
  proof requires a new identity, preregistration, cap, review, and founder GO.

### Final Review Gate

An independent reviewer checks the frozen contract before dispatch and the
terminal evidence afterward. Only the founder's explicit GO authorizes the
live invocation; only the founder or explicitly authorized reviewer may
accept the ticket.

## Verification

- `npm run ticket -- ticket-lint-all`
- `npm run answer-interpretation-regression`
- `npm test`
- `npm run quickstart`
- `node /home/quetza/palari-brain-private/retrieval-first10-live-v1-launcher.mjs --verify`
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0002`

## Stop Conditions

- Stop if the work needs a path outside `allowed_paths` or touches `forbidden_paths`.
- Stop before provider dispatch unless the exact freeze is committed and
  pushed, independent review recommends GO, all predecessor/product hashes
  reverify, the result identity is absent, both credentials are present, and
  the founder's fresh first-ten GO remains in force.
- Stop before question 1 if compatibility fails. Stop on the first runtime,
  accounting, schema, retrieval, answer, or judge error; preserve it as the
  terminal outcome and do not retry.

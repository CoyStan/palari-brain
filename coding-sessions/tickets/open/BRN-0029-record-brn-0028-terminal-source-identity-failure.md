---
id: BRN-0029
title: "Record BRN-0028 terminal source-identity failure"
stream: evaluation
level: 1
parent_id: 
root_id: BRN-0029
children: []
status: in-review
risk: R4
priority: P0
agents_allowed: 1
claimed_by:
claimed_at:
target_branch: "main"
branch: "ticket/BRN-0029-record-brn-0028-terminal-source-identity-failure"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0029-record-brn-0028-terminal-source-identity-failure"
allowed_paths:
  - "STATUS.md"
  - "evals/predictions.md"
  - "docs/DECISIONS.md"
  - "docs/EVALUATION-HARNESS.md"
  - "coding-sessions/tickets/open/BRN-0029-*.md"
  - "coding-sessions/tickets/closed/BRN-0029-*.md"
  - "coding-sessions/reports/BRN-0029-*.md"
  - "coding-sessions/human-report/BRN-0029-*.md"
  - "coding-sessions/handoffs/BRN-0029-*.md"
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
  - "npm test"
  - "npm run quickstart"
  - "npm run ticket -- check BRN-0029"
created: 2026-08-07
updated: 2026-08-07
---

# BRN-0029 Record BRN-0028 terminal source-identity failure

## Goal

Record the immutable terminal result of the one founder-authorized BRN-0028
v4 invocation, reconcile its accounting and recursive seal, grade FINAL P-set
38 without changing historical results, and diagnose the generic canonical
source-identity collision without another provider call.

## Scope

- Verify the private result tree, manifest, report, meter, custody, compatibility
  stages, zero question rows, namespace absence, and exact spend without
  modifying private evidence.
- Record that cached Ettin, Gemini writer, projected counts, two Luna
  generations with canonical settlement, semantic embeddings, reranking, and
  committed answer smoke passed before first-question ingestion failed.
- Grade P-set 38 failing categories first while keeping session recall,
  exact-span recall, equivalent-fact recall, selected evidence, and materially
  used evidence distinct. Create no judged overlay with zero question rows.
- Diagnose `SOURCE_MESSAGE_CONFLICT` at canonical identity
  `sharegpt_vyHqfrX_0:0` using source/schema metadata only, without exposing
  selected dialogue text or implementing a fix.
- Update STATUS, decisions, harness docs, technical/human reports, and handoff;
  preserve historical `6/10` and sealed U8.

## Out Of Scope

- No provider call, credential read, retry, resume, reroll, regrade, semantic
  overlay, result mutation, publication, or spend.
- No selected question/session/answer/supporting-text inspection and no model,
  retrieval, ranking, prompt, population, or answer-quality conclusion.
- No implementation repair or successor freeze. Those require a separate
  governed ticket and a new founder gate.

## Acceptance Criteria

1. The 28-entry result namespace rehashes against manifest SHA-256
   `d4fc3f39006df122d4439ab42358a8852fbcb2e249ef463f66bd1c4e6c7df472`
   with terminal status `failed` and no byte mutation.
2. The record accurately separates passed compatibility surfaces from the
   first benchmark ingestion failure and records `questions: []`.
3. Accounting reconciles `$0.00126188` measured plus `$0.10001215` uncertain
   to `$0.10127403` fresh and `$8.00840072` cumulative, within both caps.
4. P-set 38 numeric/behavioral surfaces are NOT REACHED/FAIL; execution/
   accounting records passed custody/caps/settlement/seal and failed ten-row
   completion. No semantic overlay or historical regrade occurs.
5. Source-level diagnosis identifies the collision boundary without reading
   selected text or treating it as evidence about Luna, Ettin, or memory
   quality.
6. Full tests, quickstart, ticket/report/scope/diff checks, immutable private
   verification, and fresh read-only terminal review pass.

## Ticket Completion Contract

### Goal

Make the consumed v4 result auditable and impossible to retry or misreport.

### Non-Goals

Do not fix the collision or obtain a benchmark score.

### Definition Of Done

- Terminal evidence, accounting, diagnosis, and append-only P-set 38 grade are
  committed and independently reviewed.

### Evidence Required

- Manifest/tree verification, report/meter reconciliation, sanitized source-
  identity diagnosis, tests, quickstart, and governance checks.

### Expansion Rules

- Stop for any provider/credential action, selected-content inspection,
  private mutation, implementation fix, or out-of-scope path.

### Final Review Gate

- A fresh read-only reviewer validates the pushed record. Acceptance grants no
  repair or live successor.

## Verification

- `npm test`
- `npm run quickstart`
- `npm run ticket -- check BRN-0029`
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0029`
- `git diff --check`

## Stop Conditions

- Stop if work needs a path outside `allowed_paths`, touches `forbidden_paths`,
  calls a provider, reads credentials or selected benchmark content, mutates
  private evidence, or implements the repair.

## Specialist Closeout

The immutable v4 result is reconciled and recorded without provider activity,
credential access, selected-text inspection, private mutation, repair, or
successor work. The 28-entry manifest, terminal report, seven-call meter,
custody, caps, absent semantic overlay, and source/schema identity boundary
were verified read-only. P-set 38 is graded failing-first with all five memory
metrics kept distinct and historical `6/10` unchanged. Technical/human reports
and handoff are present. Full tests passed 802 with 15 optional skips and zero
failures across 817; quickstart passed 6/6; ticket/report, scope, and diff
checks pass. Ready to transition to `in-review`.

---
id: BRN-0027
title: "Record BRN-0026 terminal live failure"
stream: evaluation
level: 1
parent_id: 
root_id: BRN-0027
children: []
status: in-review
risk: R4
priority: P0
agents_allowed: 1
claimed_by:
claimed_at:
target_branch: "main"
branch: "ticket/BRN-0027-record-brn-0026-terminal-live-failure"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0027-record-brn-0026-terminal-live-failure"
allowed_paths:
  - "STATUS.md"
  - "evals/predictions.md"
  - "docs/DECISIONS.md"
  - "docs/EVALUATION-HARNESS.md"
  - "coding-sessions/tickets/open/BRN-0027-*.md"
  - "coding-sessions/tickets/closed/BRN-0027-*.md"
  - "coding-sessions/reports/BRN-0027-*.md"
  - "coding-sessions/human-report/BRN-0027-*.md"
  - "coding-sessions/handoffs/BRN-0027-*.md"
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
  - "npm run ticket -- check BRN-0027"
created: 2026-08-07
updated: 2026-08-07
---

# BRN-0027 Record BRN-0026 terminal live failure

## Goal

Record the immutable terminal outcome of the one founder-authorized BRN-0026
invocation, reconcile its accounting and recursive seal, grade FINAL P-set 37
without changing the historical benchmark, and isolate the provider-response
compatibility defect without making another provider call.

## Scope

- Rehash and verify the private mode-0700 result namespace and its write-once
  recursive manifest without modifying any private byte.
- Record the reached smoke stages, terminal error, zero question rows, exact
  measured/uncertain/accounted spend, cumulative ledger, and consumed identity.
- Grade P-set 37 failing categories first. Keep session recall, exact-span
  recall, equivalent-fact recall, selected evidence, and materially used
  evidence distinct; with zero question rows, create no judged overlay.
- Diagnose the generic Luna response-boundary mismatch from source and the
  sealed HTTP-200 transcript shape without exposing selected benchmark text.
- Update STATUS, decisions, harness documentation, technical/human reports,
  and handoff. Preserve the historical `6/10` and sealed U8.

## Out Of Scope

- No provider call, credential read, retry, resume, reroll, regrade, semantic
  overlay, post-hoc repair, result mutation, publication, or spend.
- No product, prompt, model, retrieval, ranking, dataset, population, or
  answer-quality conclusion from a run that stopped in compatibility smoke.
- No implementation fix or successor live identity. A repair requires a new
  governed ticket, offline tests, independent review, and fresh exact founder
  authorization before any live invocation.
- No selected session, question, reference answer, supporting message, or
  expected-route inspection.

## Acceptance Criteria

1. The result namespace rehashes against its recursive manifest with all
   expected mode-0600 files and mode-0700 directories; the manifest remains
   byte-identical and terminal status remains `failed`.
2. The record proves Ettin smoke PASS, Gemini writer smoke PASS, OpenAI count
   HTTP 200, Luna generation HTTP 200, then first-failure stop on the context-
   band representation mismatch before successful answer smoke or questions.
3. Accounting is exact: `$0.0004775` measured plus `$0.0511499` uncertain,
   `$0.0516274` fresh accounted, and `$7.90712669` cumulative accounted, all
   within the authorized caps.
4. P-set 37 is graded without changing its predictions: numeric/behavioral
   surfaces are NOT REACHED/FAIL, execution/accounting records the successful
   terminal seal and failed exact settlement branch, no semantic overlay is
   created, and historical `6/10` plus U8 remain unchanged.
5. Offline diagnosis shows the reservation contract emits `short`/`long`
   while the generated spend helper accepts `shortContext`/`longContext`; it
   does not characterize Luna, Ettin, retrieval, or answer quality.
6. Full tests, quickstart, ticket/report/scope/diff checks, private immutable
   verification, and independent read-only terminal review pass.

## Ticket Completion Contract

### Goal

Make the consumed run auditable and impossible to misreport or rerun.

### Non-Goals

Do not repair the mismatch or obtain a benchmark score.

### Definition Of Done

- Terminal evidence and accounting are recorded in tracked documentation.
- P-set 37 receives one append-only post-run grade.
- Independent review recommends ACCEPT on the clean pushed terminal record.

### Evidence Required

- Recursive-manifest verification and private tree hashes/modes.
- Sanitized transcript-shape and meter/report reconciliation.
- Source-level proof of the context-band representation mismatch.
- Full tests, quickstart, governance, and unchanged historical-result checks.

### Expansion Rules

- Stop for any provider/credential access, private mutation, selected-content
  inspection, implementation fix, or path outside the ticket contract.

### Final Review Gate

- A fresh read-only reviewer validates the pushed record and immutable private
  evidence. Acceptance grants no successor invocation.

## Verification

- `npm test`
- `npm run quickstart`
- `npm run ticket -- check BRN-0027`
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0027`
- `git diff --check`

## Stop Conditions

- Stop if the work needs a path outside `allowed_paths`, touches
  `forbidden_paths`, would make another live call, inspect selected benchmark
  content, mutate private evidence, or implement the repair.

## Specialist Closeout

Result: the consumed invocation is recorded as a recursively sealed terminal
compatibility failure. Both OpenAI wires returned HTTP 200; local settlement
failed on `short` versus `shortContext`. No benchmark row ran, no semantic
overlay exists, historical `6/10` and U8 remain unchanged, and no retry or
successor is authorized.

Changed paths are limited to the ticket contract: STATUS, P-set 37,
evaluation decisions/harness documentation, this ticket, technical/human
reports, and handoff. No product/runtime code or private artifact changed.

Evidence: the immutable manifest reverified 23 entries at SHA-256
`df649931886a50341e03be62161f83ba50abe5ba7b832009840866808cd73b4b`;
the report/meter reconcile `$0.0004775` measured, `$0.0511499` uncertain,
`$0.0516274` fresh accounted, and `$7.90712669` cumulative accounted. The
semantic namespace is absent and a value-free artifact scan found zero
credential-shaped matches.

Verification: full tests PASS 797 / skip 15 / fail 0 across 812; quickstart
PASS 6/6; private immutable verification, ticket/report lint, governed scope,
and diff checks PASS. No provider call, credential read, selected benchmark
inspection, or private mutation occurred during closeout.

Risk: this is not a benchmark score or model-quality finding. The full Luna
reservation remains uncertain because exact settlement failed. Recommended
next action is independent read-only terminal review; any normalization repair
belongs to a separate governed ticket.

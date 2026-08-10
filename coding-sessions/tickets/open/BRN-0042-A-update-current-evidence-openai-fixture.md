---
id: BRN-0042-A
title: "Update current-evidence OpenAI fixture"
stream: memory
level: 2
parent_id: BRN-0042
root_id: BRN-0042
children: []
status: open
risk: R1
priority: P0
agents_allowed: 1
claimed_by:
claimed_at:
target_branch: "ticket/BRN-0042-bind-final-answer-evidence-in-the-host"
branch: "ticket/BRN-0042-A-update-current-evidence-openai-fixture"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0042-A-update-current-evidence-openai-fixture"
allowed_paths:
  - "tests/current-evidence-review.contract.test.mjs"
  - "coding-sessions/tickets/open/BRN-0042-A-*.md"
  - "coding-sessions/tickets/closed/BRN-0042-A-*.md"
  - "coding-sessions/reports/BRN-0042-A-*.md"
  - "coding-sessions/human-report/BRN-0042-A-*.md"
  - "coding-sessions/handoffs/BRN-0042-A-*.md"
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
requires_human_confirmation: false
requires_review: false
verification:
  - "node --test tests/current-evidence-review.contract.test.mjs"
  - "npm test"
  - "npm run ticket -- check BRN-0042-A"
created: 2026-08-10
updated: 2026-08-10
---

# BRN-0042-A Update current-evidence OpenAI fixture

## Goal

Keep the adjacent current-evidence OpenAI contract aligned with BRN-0042's
host-owned answer evidence wire.

## Scope

- Replace the fixture's provider-authored evidence ID and quote commitment
  with the parent wire's short memory number, explicit disposition, and
  rationale.
- Preserve the test's existing assertion that an old-only current answer is
  accepted once and reports unresolved later evidence as telemetry.

## Out Of Scope

- No product source, documentation, status, retrieval, confirmation, or
  provider change.
- No paid provider call, private artifact access, dataset execution, or sealed
  U8 access.

## Acceptance Criteria

1. The fixture emits the BRN-0042 provider-facing commitment shape without an
   evidence ID or quote.
2. The focused current-evidence contract and parent core gate pass without a
   repair dispatch.
3. The changed path remains limited to this ticket and its administrative
   records.

## Verification

- `node --test tests/current-evidence-review.contract.test.mjs`
- `npm test`
- `npm run ticket -- check BRN-0042-A`
- `npm run ticket -- scope-check --committed-plus-dirty --target ticket/BRN-0042-bind-final-answer-evidence-in-the-host BRN-0042-A`
- `git diff --check ticket/BRN-0042-bind-final-answer-evidence-in-the-host...HEAD`

## Stop Conditions

- Stop if the work needs a path outside `allowed_paths` or touches `forbidden_paths`.
- Stop if the fixture change would alter the current-evidence product contract
  rather than only exercising the parent wire.

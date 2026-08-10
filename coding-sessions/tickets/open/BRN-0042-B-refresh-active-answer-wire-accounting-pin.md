---
id: BRN-0042-B
title: "Refresh active answer wire accounting pin"
stream: memory
level: 2
parent_id: BRN-0042
root_id: BRN-0042
children: []
status: claimed
risk: R1
priority: P0
agents_allowed: 1
claimed_by: "quetza"
claimed_at: 2026-08-10T04:28:05Z
target_branch: "ticket/BRN-0042-bind-final-answer-evidence-in-the-host"
branch: "ticket/BRN-0042-B-refresh-active-answer-wire-accounting-pin"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0042-B-refresh-active-answer-wire-accounting-pin"
allowed_paths:
  - "tests/openai-counted-responses.contract.test.mjs"
  - "coding-sessions/tickets/open/BRN-0042-B-*.md"
  - "coding-sessions/tickets/closed/BRN-0042-B-*.md"
  - "coding-sessions/reports/BRN-0042-B-*.md"
  - "coding-sessions/human-report/BRN-0042-B-*.md"
  - "coding-sessions/handoffs/BRN-0042-B-*.md"
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
  - "node --test tests/openai-counted-responses.contract.test.mjs"
  - "npm run test:legacy"
  - "npm run ticket -- check BRN-0042-B"
created: 2026-08-10
updated: 2026-08-10
---

# BRN-0042-B Refresh active answer wire accounting pin

## Goal

Refresh the active OpenAI answer-wire byte and hash accounting after BRN-0042
removes provider-authored quote fields, without rewriting historical BRN-0025
compatibility pins.

## Scope

- Recompute and pin the exact active generation body and count-projection body
  produced by the parent ticket's provider-free request builder.
- Preserve the historical BRN-0025 compatibility byte and hash constants.
- Verify that the active wire still projects exactly once through counted
  Responses accounting.

## Out Of Scope

- No product source, pricing, settlement, transport, provider, documentation,
  or historical evidence change.
- No paid provider call, private artifact access, dataset execution, or sealed
  U8 access.

## Acceptance Criteria

1. Active generation and count-projection byte lengths and hashes match the
   parent ticket's exact provider-free request bodies.
2. Historical BRN-0025 generation and count pins remain byte-for-byte unchanged.
3. The focused counted-Responses file and complete legacy tier pass.
4. The changed path remains limited to this ticket and its administrative
   records.

## Verification

- `node --test tests/openai-counted-responses.contract.test.mjs`
- `npm run test:legacy`
- `npm run ticket -- check BRN-0042-B`
- `npm run ticket -- scope-check --committed-plus-dirty --target ticket/BRN-0042-bind-final-answer-evidence-in-the-host BRN-0042-B`
- `git diff --check ticket/BRN-0042-bind-final-answer-evidence-in-the-host...HEAD`

## Stop Conditions

- Stop if the work needs a path outside `allowed_paths` or touches `forbidden_paths`.
- Stop if any historical consumed pin would need to change or accounting would
  stop projecting the active body exactly once.

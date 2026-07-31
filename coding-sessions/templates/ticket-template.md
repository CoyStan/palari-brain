---
id: BRN-0000
title: "Short title"
stream: memory
level: 1
parent_id:
root_id: BRN-0000
children: []
status: open
risk: R1
priority: P2
agents_allowed: 1
claimed_by:
claimed_at:
target_branch: "main"
branch: "ticket/BRN-0000-short-title"
worktree: "/absolute/path/to/palari-brain-worktrees/BRN-0000-short-title"
allowed_paths:
  - "src/example.mjs"
forbidden_paths:
  - ".env"
requires_human_confirmation: false
requires_review: false
verification:
  - "node --test tests/example.contract.test.mjs"
  - "npm run quickstart"
created: 2026-01-01
updated: 2026-01-01
---

# BRN-0000 Short Title

## Goal

State one bounded outcome.

## Scope

- Name what may change.

## Out Of Scope

- Name tempting adjacent work that must not be added.

## Acceptance Criteria

1. State observable completion conditions.

## Ticket Completion Contract

### Goal

State the completed artifact or behavior.

### Non-Goals

State what this ticket deliberately does not solve.

### Definition Of Done

- Name code, docs, evidence, and lifecycle state required.

### Evidence Required

- Name exact tests, checks, and reports.

### Expansion Rules

- Stop or open a child ticket instead of silently widening scope.

### Final Review Gate

- Name who reviews and who may accept.

## Verification

- List exact commands and any manual checks.

## Stop Conditions

- Stop when scope, authority, risk, or evidence no longer matches this ticket.

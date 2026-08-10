---
id: BRN-0049
title: "Persist safe provider failures and pace isolated workers"
stream: evaluation
level: 1
parent_id: 
root_id: BRN-0049
children: []
status: in-review
risk: R2
priority: P0
agents_allowed: 2
claimed_by:
claimed_at:
target_branch: "main"
branch: "ticket/BRN-0049-persist-safe-provider-failures-and-pace-isolated-workers"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0049-persist-safe-provider-failures-and-pace-isolated-workers"
allowed_paths:
  - "evals/run-alpha-memory-debug.mjs"
  - "evals/rolling-token-pacer.mjs"
  - "tests/alpha-memory-debug.contract.test.mjs"
  - "tests/rolling-token-pacer.contract.test.mjs"
  - "docs/EVALUATION-HARNESS.md"
  - "STATUS.md"
  - "coding-sessions/tickets/open/BRN-0049-*.md"
  - "coding-sessions/tickets/closed/BRN-0049-*.md"
  - "coding-sessions/reports/BRN-0049-*.md"
  - "coding-sessions/human-report/BRN-0049-*.md"
  - "coding-sessions/handoffs/BRN-0049-*.md"
forbidden_paths:
  - ".env"
  - ".env.*"
  - "*.key"
  - "**/*.key"
  - "secrets/**"
  - "**/secrets/**"
  - "*secret*"
  - "**/*secret*"
  - "infra/prod/**"
  - "prod/**"
  - "runtime-data/**"
  - ".palari-probe/**"
  - ".palari-regression/**"
  - "data/**"
  - "evals/results/**"
requires_human_confirmation: false
requires_review: true
verification:
  - "node --test tests/alpha-memory-debug.contract.test.mjs tests/rolling-token-pacer.contract.test.mjs"
  - "npm test"
  - "npm run quickstart"
created: 2026-08-10
updated: 2026-08-10
---

# BRN-0049 Persist safe provider failures and pace isolated workers

## Goal

Keep safe host and HTTP 429 diagnostics in the shared alpha log, and let
isolated case processes coordinate one durable rolling request budget without
automatic retries or request-content storage.

## Scope

- Extend shared alpha error serialization with bounded allowlisted error code,
  `hostRejection`, and HTTP 429 metadata only.
- Add an opt-in file-backed rolling pacer with atomic cross-process admission,
  unit and request ceilings, window pruning, bounded lock recovery, and
  aggregate statistics.
- Store only timestamps, unit counts, request counts, and statistics. Keep the
  existing in-memory pacer unchanged by default.
- Add provider-free concurrency, redaction, recovery, accounting,
  documentation, reports, and independent review.

## Out Of Scope

- No provider retry, provider call, automatic tier discovery, request or
  response body storage, credential access, product retrieval change,
  benchmark regrade, private artifact, dataset, or sealed U8 access in the
  ticket worktree.

## Acceptance Criteria

1. The shared alpha log records only bounded allowlisted `code`, frozen-style
   host rejection code/reason, and HTTP 429 status/request/reset/limit metadata.
   It cannot serialize arbitrary metadata, prompts, evidence, provider bodies,
   or credentials.
2. Two pacers that use the same state path cannot admit work above either the
   configured rolling unit ceiling or request ceiling, including concurrent
   admission. Different state paths remain independent.
3. State and lock files contain no request content. Stale-lock recovery is
   bounded, active locks are never stolen, and corrupted state fails closed.
4. Oversized work can enter only an empty window, waits are bounded by the
   configured window, and no provider retry is added.
5. Focused, core, quickstart, legacy, scope, report, and diff gates pass, and
   an independent reviewer finds no unresolved P0-P3 issue.

## Verification

- `node --test tests/alpha-memory-debug.contract.test.mjs tests/rolling-token-pacer.contract.test.mjs`
- `npm test`
- `npm run quickstart`
- `npm run test:legacy`
- `npm run ticket -- check BRN-0049`
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0049`
- `git diff --check main...HEAD`

## Stop Conditions

- Stop if the work needs a path outside `allowed_paths` or touches `forbidden_paths`.
- Stop if the implementation stores request content, weakens error redaction,
  retries a provider call, or cannot prove atomic cross-process admission.

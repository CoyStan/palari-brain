---
id: BRN-0031
title: "Update frozen v6 drift sentinel"
stream: evaluation
level: 1
parent_id: 
root_id: BRN-0031
children: []
status: claimed
risk: R2
priority: P1
agents_allowed: 1
claimed_by: "quetza"
claimed_at: 2026-08-07T13:03:02Z
target_branch: "main"
branch: "ticket/BRN-0031-update-frozen-v6-drift-sentinel"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0031-update-frozen-v6-drift-sentinel"
allowed_paths:
  - "tests/longmemeval-live-config.contract.test.mjs"
  - "STATUS.md"
  - "coding-sessions/tickets/open/BRN-0031-*.md"
  - "coding-sessions/tickets/closed/BRN-0031-*.md"
  - "coding-sessions/reports/BRN-0031-*.md"
  - "coding-sessions/human-report/BRN-0031-*.md"
  - "coding-sessions/handoffs/BRN-0031-*.md"
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
requires_review: true
verification:
  - "node --test tests/longmemeval-live-config.contract.test.mjs"
  - "npm test"
  - "npm run quickstart"
  - "npm run ticket -- check BRN-0031"
created: 2026-08-07
updated: 2026-08-07
---

# BRN-0031 Update frozen v6 drift sentinel

## Goal

Keep the historical v6 frozen-artifact test fail-closed after BRN-0030 changes
the kernel arm by updating only the expected first drift artifact.

## Scope

- Change the v6 config rejection predicate to expect
  `evals/arms/kernel-longmemeval-live-arm.mjs`, now the first frozen artifact
  whose hash differs.
- Preserve the complete expected drift set and every frozen v6 JSON byte,
  identity, predecessor, cap, prediction, and terminal guarantee.
- Verify the test still observes `ARTIFACT_HASH` before any credential or
  provider boundary.

## Out Of Scope

- No live config JSON, product/evaluation code, provider call, credential,
  benchmark content, score, artifact re-freeze, or BRN-0030 implementation.

## Acceptance Criteria

1. The exact v6 contract rejects on the kernel arm as the deterministic first
   changed artifact while retaining the full drift-set assertions.
2. No frozen v6 artifact hash, JSON, prediction, identity, cap, or result
   changes.
3. Focused/full/quickstart/governance checks pass and independent review finds
   no regression.

## Verification

- `node --test tests/longmemeval-live-config.contract.test.mjs`
- `npm test`
- `npm run quickstart`
- `npm run ticket -- check BRN-0031`
- `git diff --check`

## Stop Conditions

- Stop for any path beyond the test/STATUS contract, frozen JSON mutation,
  credential/provider action, or change beyond the expected first-drift path.

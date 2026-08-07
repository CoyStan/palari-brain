---
id: BRN-0032
title: "Integrate occurrence identity and v6 sentinel"
stream: evaluation
level: 1
parent_id: 
root_id: BRN-0032
children: []
status: in-review
risk: R4
priority: P0
agents_allowed: 1
claimed_by: 
claimed_at: 
target_branch: "main"
branch: "ticket/BRN-0032-integrate-occurrence-identity-and-v6-sentinel"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0032-integrate-occurrence-identity-and-v6-sentinel"
allowed_paths:
  - "evals/arms/kernel-longmemeval-live-arm.mjs"
  - "tests/longmemeval-live-arm.contract.test.mjs"
  - "tests/longmemeval-live-config.contract.test.mjs"
  - "evals/predictions.md"
  - "docs/EVALUATION-HARNESS.md"
  - "docs/DECISIONS.md"
  - "STATUS.md"
  - "coding-sessions/tickets/open/BRN-0032-*.md"
  - "coding-sessions/tickets/closed/BRN-0032-*.md"
  - "coding-sessions/reports/BRN-0032-*.md"
  - "coding-sessions/human-report/BRN-0032-*.md"
  - "coding-sessions/handoffs/BRN-0032-*.md"
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
  - "node --test tests/longmemeval-live-arm.contract.test.mjs tests/longmemeval-live-config.contract.test.mjs"
  - "npm test"
  - "npm run quickstart"
  - "npm run ticket -- check BRN-0032"
created: 2026-08-07
updated: 2026-08-07
---

# BRN-0032 Integrate occurrence identity and v6 sentinel

## Goal

Integrate the already-bounded BRN-0030 occurrence-aware source identity with
the one-line BRN-0031 historical v6 drift-sentinel update so both related
contracts and the full suite can pass in one governed scope; freeze the same
unconsumed v5 successor provider-free.

## Scope

- Carry BRN-0030's versioned, reversible source identity based on original
  instance occurrence ordinal plus turn index, including duplicate/replay/
  mutation/source-isolation tests and immutable conflict semantics.
- Update only the historical v6 test predicate's expected first changed
  artifact from the runner to the now-earlier kernel arm. Preserve the full
  drift set and every frozen v6 JSON byte.
- Supersede the incomplete BRN-0030 and BRN-0031 implementation branches; do
  not merge their red intermediate states.
- Recreate/finalize unconsumed private identity
  `j4-luna-ettin-unexecuted11to20-v5` under FINAL P-set 39, opening
  `$8.00840072`, proposed `$5.00` fresh / `$13.00840072` cumulative caps.
- Provider-free final-runtime verification must execute duplicate occurrence
  ingest/replay/mutation refusal plus cached Ettin, exact count/generation,
  settlement, custody, recursive seal, cleanup, zero telemetry, absent v5
  namespaces, and immutable v1-v4 evidence.

## Out Of Scope

- No provider/credential/selected-content/result/spend/live action.
- No frozen v6 JSON or historical identity/hash/result mutation.
- No weakened conflict gate, content-derived identity, model/prompt/ranking/
  memory/population change, or prior artifact mutation.

## Acceptance Criteria

1. Duplicate source-session occurrences are distinct, reversible to the
   original session ID, chronologically replayed, idempotent on exact replay,
   and terminal on same-occurrence mutation before writer work.
2. The v6 contract still fails closed on `ARTIFACT_HASH`, now naming the kernel
   arm as deterministic first drift, while its complete drift set is unchanged.
3. Focused tests and the full suite pass together; neither red intermediate
   ticket branch is merged.
4. Actual mode-0600 v5 bytes pass every provider-free final-runtime gate, bind
   a clean pushed closure/P-set39/caps/hashes, and leave namespaces absent.
5. Independent cumulative review passes; historical `6/10`, U8, all consumed
   grades/accounting/evidence, and frozen v6 bytes remain unchanged.
6. Acceptance authorizes no live run; v5 requires new exact founder authority.

## Ticket Completion Contract

### Goal

Land the two interdependent, already-bounded changes atomically and green.

### Non-Goals

Do not expand beyond source occurrence identity and first-drift expectation.

### Definition Of Done

- Combined code/tests, final v5 freeze, full verification, and independent
  review pass; BRN-0030/31 are recorded as superseded rather than merged.

### Evidence Required

- Focused/full tests, private verifier, exact diff/scope, frozen-v6 immutability,
  private hashes/modes/closure/namespaces/predecessor custody.

### Expansion Rules

- Stop for any third implementation path, provider/credential/content action,
  frozen JSON mutation, weakened gate, or prior evidence mutation.

### Final Review Gate

- Fresh read-only cumulative review; acceptance grants no live action.

## Verification

- `node --test tests/longmemeval-live-arm.contract.test.mjs tests/longmemeval-live-config.contract.test.mjs`
- `npm test`
- `npm run quickstart`
- `npm run ticket -- check BRN-0032`
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0032`
- `git diff --check`

## Stop Conditions

- Stop for any path outside the contract, forbidden path, provider/credential/
  selected-content action, frozen v6 mutation, prior evidence mutation, or live
  result creation.

## Specialist Closeout

The two interdependent changes are integrated at commit `8e91cb8` without
merging either red predecessor branch. The occurrence envelope is versioned
and reversible, retains the pre-sort occurrence ordinal, preserves source
isolation and chronological replay, distinguishes repeated source sessions,
is idempotent on exact replay, and rejects same-occurrence mutation before
writer work. The historical-v6 sentinel changes only its expected first drift;
the complete drift set and frozen v6 JSON bytes remain unchanged.

The exact private v5 launcher/runtime are mode 0600 and hash to
`d149ee3e145789cc97b0e92caa22e23a719e7125cd1435f028cb90899eec83ef` /
`c013d8a32efd408094dd5881acbc4c7d5e96104661883b519e98618996efabd7`.
Their provider-free verifier passed all gates with zero credential reads,
dataset reads, provider calls, and result writes; both v5 namespaces remain
absent. Focused tests passed 19/19, the full suite passed 805 with 15 optional
skips and zero failures across 820, and quickstart passed 6/6. P-set 39 is
FINAL. Ready for fresh independent read-only review; no live v5 authority is
created.

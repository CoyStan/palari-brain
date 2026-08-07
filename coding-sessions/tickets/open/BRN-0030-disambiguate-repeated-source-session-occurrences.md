---
id: BRN-0030
title: "Disambiguate repeated source-session occurrences"
stream: evaluation
level: 1
parent_id: 
root_id: BRN-0030
children: []
status: claimed
risk: R4
priority: P0
agents_allowed: 1
claimed_by: "quetza"
claimed_at: 2026-08-07T12:43:26Z
target_branch: "main"
branch: "ticket/BRN-0030-disambiguate-repeated-source-session-occurrences"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0030-disambiguate-repeated-source-session-occurrences"
allowed_paths:
  - "evals/arms/kernel-longmemeval-live-arm.mjs"
  - "tests/longmemeval-live-arm.contract.test.mjs"
  - "evals/predictions.md"
  - "docs/EVALUATION-HARNESS.md"
  - "docs/DECISIONS.md"
  - "STATUS.md"
  - "coding-sessions/tickets/open/BRN-0030-*.md"
  - "coding-sessions/tickets/closed/BRN-0030-*.md"
  - "coding-sessions/reports/BRN-0030-*.md"
  - "coding-sessions/human-report/BRN-0030-*.md"
  - "coding-sessions/handoffs/BRN-0030-*.md"
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
  - "node --test tests/longmemeval-live-arm.contract.test.mjs"
  - "npm test"
  - "npm run quickstart"
  - "npm run ticket -- check BRN-0030"
created: 2026-08-07
updated: 2026-08-07
---

# BRN-0030 Disambiguate repeated source-session occurrences

## Goal

Preserve the immutable canonical dialogue gate while giving repeated
source-session occurrences distinct, deterministic provenance identities;
permanently reproduce the BRN-0028 first-row collision and freeze a
provider-free v5 successor at a new founder gate.

## Scope

- Derive source-message identity from source session ID, stable occurrence
  ordinal in the original instance, and turn index. Do not use question text,
  answer content, or benchmark-specific keywords.
- Preserve chronological replay and map every new canonical ID back to its
  original source session for isolation/recall metrics.
- Keep identical occurrence replay idempotent and keep mutations within one
  occurrence terminal under `SOURCE_MESSAGE_CONFLICT`; never weaken the gate.
- Add regressions with synthetic duplicate session IDs that differ in event/
  turn snapshot and prove both ingest without aliasing, correct chronology,
  source isolation, stable IDs, replay behavior, and mutation refusal.
- Freeze `j4-luna-ettin-unexecuted11to20-v5` with unchanged P-set 38
  population/order/architecture/models/prompts/four-call ceiling and FINAL
  P-set 39. Opening accounted spend is `$8.00840072`; proposed caps are
  `$5.00` fresh / `$13.00840072` cumulative.
- Create mode-0600 private v5 launcher/runtime and provider-free verify actual
  duplicate-occurrence ingestion plus all existing Ettin/count/generation/
  settlement/custody/seal gates with zero external telemetry.

## Out Of Scope

- No provider request, credential read, selected benchmark text, result
  namespace, score, semantic judgment, spend, or live v5 invocation.
- No mutation, retry, regrade, or repair of consumed v1-v4 artifacts/accounting.
- No relaxed identity conflict, content-derived canonical key, memory/ranking/
  prompt/model/population change, or historical regrade.

## Acceptance Criteria

1. Repeated session IDs receive distinct deterministic occurrence-aware source
   IDs while unique-session behavior and chronological replay stay stable.
2. Source-session recovery strips only the governed occurrence/turn envelope,
   preserves arbitrary original session IDs, and keeps isolation/coverage
   metrics attributed to the original ID.
3. Synthetic exact BRN-0028-shaped duplicate occurrence passes ingestion;
   replay of the same occurrence is idempotent and a changed snapshot under the
   same occurrence still raises `SOURCE_MESSAGE_CONFLICT` before writer work.
4. The actual v5 final runtime executes this duplicate-ingestion regression
   provider-free and retains canonical Standard settlement, count/full-body
   wires, cached Ettin, custody, recursive seal, cleanup, and zero telemetry.
5. Private hashes/modes, clean import closure, absent v5 namespaces, immutable
   predecessors, FINAL P-set 39, `$8.00840072` opening, and both caps are bound.
6. Focused/full/quickstart/private/governance checks and independent cumulative
   review pass; historical `6/10`, U8, and all prior grades remain unchanged.
7. Acceptance grants no live invocation; exact founder authority must name the
   new identity, caps, reviewed head, private hashes, and ACCEPT.

## Ticket Completion Contract

### Goal

Eliminate source-key aliasing without weakening immutable provenance.

### Non-Goals

Do not tune answers or obtain a score.

### Definition Of Done

- Generic occurrence-aware identity and regressions are committed.
- Actual provider-free v5 bytes pass and receive clean independent review.

### Evidence Required

- Duplicate/replay/mutation/source-isolation tests; final-runtime verification;
  hashes/modes/closure/namespaces/predecessor custody; full verification.

### Expansion Rules

- Stop for provider/credential access, selected content, weakened conflict
  semantics, consumed mutation, or out-of-scope path.

### Final Review Gate

- Fresh read-only review; acceptance authorizes no live action.

## Verification

- `node --test tests/longmemeval-live-arm.contract.test.mjs`
- `npm test`
- `npm run quickstart`
- `npm run ticket -- check BRN-0030`
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0030`
- `git diff --check`

## Stop Conditions

- Stop if work needs a path outside `allowed_paths`, touches forbidden paths,
  calls a provider, reads credentials or selected text, weakens the immutable
  gate, mutates prior evidence, or creates a v5 result namespace.

---
id: BRN-0035
title: "Reset Palari to a lightweight alpha loop"
stream: architecture
level: 1
parent_id: 
root_id: BRN-0035
children: []
status: claimed
risk: R4
priority: P0
agents_allowed: 1
claimed_by: "quetza"
claimed_at: 2026-08-07T16:35:33Z
target_branch: "main"
branch: "ticket/BRN-0035-reset-palari-to-a-lightweight-alpha-loop"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0035-reset-palari-to-a-lightweight-alpha-loop"
allowed_paths:
  - "AGENTS.md"
  - "STATUS.md"
  - "README.md"
  - ".gitignore"
  - "package.json"
  - "docs/ALPHA-ARCHITECTURE.md"
  - "docs/ALPHA-FRAMEWORK-RESEARCH.md"
  - "evals/run-alpha-memory-debug.mjs"
  - "tests/alpha-memory-debug.contract.test.mjs"
  - "coding-sessions/tickets/open/BRN-0035-*.md"
  - "coding-sessions/tickets/closed/BRN-0035-*.md"
  - "coding-sessions/reports/BRN-0035-*.md"
  - "coding-sessions/human-report/BRN-0035-*.md"
  - "coding-sessions/handoffs/BRN-0035-*.md"
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
  - "npm run alpha:check"
  - "npm run test:legacy"
  - "npm run quickstart"
  - "npm run ticket -- check BRN-0035"
created: 2026-08-07
updated: 2026-08-07
---

# BRN-0035 Reset Palari to a lightweight alpha loop

## Goal

Replace Palari's production-grade evaluation ritual with a lightweight alpha
development loop: one reusable debug runner, injected dependencies, mutable
gitignored logs, a rough hard dollar cap, and a small focused test tier. Keep
the existing brain and historical evidence recoverable without making them the
default development path.

## Scope

- Record the 20-repository framework comparison and the chosen minimal hybrid:
  smolagents-style small loop, OpenAI Agents-style `run` boundary and optional
  tracing, PydanticAI-style dependency injection, and Haystack-style explicit
  retrieval components. Add no framework dependency.
- Create one reusable alpha LongMemEval debug command supporting bounded
  question selection, injected writer/answer/embedder/reranker dependencies,
  mutable JSONL logs under `.palari-alpha/`, continue-on-error diagnostics,
  bounded retries when explicitly requested, and a simple maximum-dollar stop.
- Separate debug observations from benchmark claims. Alpha runs may be fixed
  and repeated; they never update historical grades or public claims.
- Make a focused alpha check the default development gate; retain the existing
  full suite as `test:legacy`, not a mandatory loop after every small change.
- Replace the active charter and STATUS with concise alpha versions. Keep only
  secrets, user isolation, destructive writes, and explicit provider budget as
  hard founder gates. Make tickets optional for ordinary alpha debugging.
- Preserve the exact pre-reset repository at annotated Git tag
  `pre-alpha-governance-reset-2026-08-07`.

## Out Of Scope

- No live provider call, credential read, dataset download/inspection, score,
  spend, v6 invocation, or historical artifact mutation.
- No wholesale deletion of legacy evals/tests/tickets in this unit; they become
  non-default and may be removed later only after the alpha path proves useful.
- No product-memory algorithm, prompt, provider choice, or benchmark answer
  tuning.

## Acceptance Criteria

1. The research document covers exactly 20 open repositories and extracts
   concrete adopt/avoid lessons with source links.
2. A single alpha runner owns orchestration; behavior is configured through
   injected dependencies and data, not copied launchers/runtimes or ticket IDs.
3. Debug mode writes only gitignored mutable logs, distinguishes attempts from
   benchmark grades, supports continue/fix/rerun work, and stops at one simple
   authorized dollar cap.
4. Focused tests cover selection, retries, continuation, log shape, dependency
   injection, and budget stop without duplicating historical frozen suites.
5. `npm test`/`alpha:check` are small alpha gates; `test:legacy` retains all 825
   historical tests on demand; quickstart remains 6/6.
6. AGENTS and STATUS clearly state alpha rules, no-reroll/immutable/exact-
   accounting requirements apply only to an explicitly declared release
   benchmark, and normal debugging does not require tickets or preregistration.
7. Independent review confirms the old state is recoverable by tag, no live or
   secret activity occurred, and the new path materially reduces the default
   loop without weakening user-data isolation.

## Ticket Completion Contract

### Goal

Make iteration faster than governance while keeping the few safety boundaries
that matter in alpha.

### Non-Goals

Do not rewrite the brain or perform a live evaluation.

### Definition Of Done

One reusable debug runner, concise process docs, focused default tests, legacy
escape hatch, recovery tag, and independent review are green.

### Evidence Required

Twenty source links, focused and legacy test results, quickstart, CLI contract
tests, gitignore proof, no-provider telemetry, diff/scope, and tag verification.

### Expansion Rules

Stop for a new framework dependency, product-memory changes, live/provider/
credential/data action, historical evidence mutation, or mass legacy deletion.

### Final Review Gate

Fresh read-only review. Acceptance authorizes the alpha development policy but
does not authorize any provider spend.

## Verification

- `npm run alpha:check`
- `npm run test:legacy`
- `npm run quickstart`
- `npm run ticket -- check BRN-0035`
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0035`
- `git diff --check`

## Stop Conditions

- Stop if work needs a path outside `allowed_paths`, touches `forbidden_paths`,
  adds a framework dependency, changes product memory behavior, performs live
  or secret/data activity, or deletes the legacy system instead of deactivating
  it.

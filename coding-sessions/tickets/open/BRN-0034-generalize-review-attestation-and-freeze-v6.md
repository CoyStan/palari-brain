---
id: BRN-0034
title: "Generalize review attestation and freeze v6"
stream: evaluation
level: 1
parent_id: 
root_id: BRN-0034
children: []
status: claimed
risk: R4
priority: P0
agents_allowed: 1
claimed_by: "quetza"
claimed_at: 2026-08-07T14:00:07Z
target_branch: "main"
branch: "ticket/BRN-0034-generalize-review-attestation-and-freeze-v6"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0034-generalize-review-attestation-and-freeze-v6"
allowed_paths:
  - "evals/generated-runtime-verifier.mjs"
  - "tests/generated-runtime-verifier.contract.test.mjs"
  - "evals/predictions.md"
  - "docs/DECISIONS.md"
  - "docs/EVALUATION-HARNESS.md"
  - "STATUS.md"
  - "coding-sessions/tickets/open/BRN-0034-*.md"
  - "coding-sessions/tickets/closed/BRN-0034-*.md"
  - "coding-sessions/reports/BRN-0034-*.md"
  - "coding-sessions/human-report/BRN-0034-*.md"
  - "coding-sessions/handoffs/BRN-0034-*.md"
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
  - "node --test tests/generated-runtime-verifier.contract.test.mjs"
  - "npm test"
  - "npm run quickstart"
  - "npm run ticket -- check BRN-0034"
created: 2026-08-07
updated: 2026-08-07
---

# BRN-0034 Generalize review attestation and freeze v6

## Goal

Replace the shared verifier's BRN-0025-specific reviewer-marker dependency
with a validated caller-selected marker namespace while preserving legacy
callers, then freeze a fresh, unconsumed v6 successor that proves the exact
accepted note and final runtime provider-free before any founder gate.

## Scope

- Add an explicit attestation marker namespace parameter. Validate it as a
  bounded uppercase identifier before composing exact marker names.
- Preserve the legacy `BRN0025_REVIEW` default so frozen predecessor callers
  and tests remain compatible; v6 must select a ticket-neutral namespace.
- Test accepted legacy and generic attestations plus missing, duplicated,
  mismatched, malformed, and namespace-confusion failures.
- Freeze FINAL P-set 40 for fresh identity
  `j4-luna-ettin-unexecuted11to20-v6`, inheriting v5's population, order,
  models, prompts, architecture, predictions, and `$8.00840072` opening ledger.
- Create actual mode-0600 private v6 launcher/runtime and run their complete
  provider-free verification, including the accepted review-marker shape,
  duplicate-occurrence regression, smokes, custody, settlement, recursive
  seal, cleanup, predecessor immutability, zero telemetry, and namespace
  absence.

## Out Of Scope

- No credential or selected dataset read, provider call, live v6 invocation,
  result/semantic namespace, spend, retry/reuse of v5, or prior artifact change.
- No model, prompt, retrieval, ranking, memory, answer, population, prediction,
  or cap change; no weakening to free-form prose acceptance.

## Acceptance Criteria

1. `assertReviewAttestation` accepts one validated caller-selected namespace,
   requires exactly one identity/launcher/runtime/recommendation marker under
   it, and returns only on exact `ACCEPT` and bound values.
2. The legacy namespace remains the default and all malformed namespace,
   missing/duplicate marker, mismatched value, and cross-namespace cases fail
   closed with deterministic tests.
3. FINAL P-set 40 preserves the ten never-completed ordinals and predicts at
   least 8/10 without inspecting selected content or changing treatment.
4. Exact private v6 bytes pass actual final-runtime provider-free verification
   against the generic accepted marker set, modes/hashes/clean pushed closure,
   zero telemetry, absent namespaces, and immutable v1-v5 evidence.
5. Opening/fresh/cumulative values are exactly `$8.00840072`, `$5.00`, and
   `$13.00840072`; historical `6/10` and sealed U8 remain unchanged.
6. Focused/full tests, quickstart, ticket/scope/diff checks, and fresh
   independent cumulative review pass. Acceptance authorizes no live run.

## Ticket Completion Contract

### Goal

Make reviewer attestation reusable without losing exact fail-closed binding,
and prepare one independently reviewed successor.

### Non-Goals

Do not call providers, reuse v5, or change the benchmark treatment.

### Definition Of Done

Generic/legacy attestation tests, exact v6 freeze, complete zero-call verifier,
governance records, and independent review are green.

### Evidence Required

Focused negative/positive tests, full suite, quickstart, actual private-byte
verification, exact hashes/modes/closure, predecessor hashes, namespace
absence, zero telemetry, and cumulative scope/diff review.

### Expansion Rules

Stop for any live/provider/credential/data action, prior evidence mutation,
model/prompt/treatment change, or third implementation surface.

### Final Review Gate

Fresh read-only review. A live v6 invocation requires a later exact founder
authorization naming identity, caps, reviewed head, hashes, and ACCEPT.

## Verification

- `node --test tests/generated-runtime-verifier.contract.test.mjs`
- `npm test`
- `npm run quickstart`
- `npm run ticket -- check BRN-0034`
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0034`
- `git diff --check`

## Stop Conditions

- Stop if work needs a path outside `allowed_paths`, touches `forbidden_paths`,
  reads credentials/selected content, calls a provider, creates a live result,
  mutates predecessor evidence, or changes benchmark treatment.

## Specialist Closeout

The verifier now supports a bounded caller-selected marker namespace while
retaining the BRN-0025 legacy default. Exhaustive positive and fail-closed
tests cover legacy/generic acceptance, malformed namespaces, missing or
duplicate markers, mismatched bound values, and cross-namespace confusion.

FINAL P-set 40 and exact private v6 bytes are frozen. Launcher/runtime are
mode 0600 with SHA-256
`b287f7c20af4c7df7159b785b6723693b74289be93c45dc01aa8d3e263bde15f` /
`e68e13450c6f20a838dfa19ec23498dfc17d76fec9e407ca814083c356cae6f2`.
Actual provider-free verification passed all gates with telemetry 0/0/0/0;
v6 result/semantic namespaces are absent; v1-v5 evidence and v5 namespace
absence are preserved. Focused tests passed 18/18, full suite 810/15/0 across
825, and quickstart 6/6. Ready for fresh independent review. No live authority
is created.

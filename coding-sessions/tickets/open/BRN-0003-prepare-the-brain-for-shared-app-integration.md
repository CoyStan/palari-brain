---
id: BRN-0003
title: "Prepare The Brain For Shared-App Integration"
stream: memory
level: 1
parent_id: 
root_id: BRN-0003
children: []
status: open
risk: R2
priority: P1
agents_allowed: 1
claimed_by:
claimed_at:
target_branch: "main"
branch: "ticket/BRN-0003-prepare-the-brain-for-shared-app-integration"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0003-prepare-the-brain-for-shared-app-integration"
allowed_paths:
  - "src/dialogue-evidence.mjs"
  - "src/brain.mjs"
  - "src/index.mjs"
  - "src/memory-exploration.mjs"
  - "src/memory-forget.mjs"
  - "src/retrieval-answer.mjs"
  - "src/store.mjs"
  - "tests/*.contract.test.mjs"
  - "docs/BRAIN-API.md"
  - "docs/CONSUMER-SEAM.md"
  - "STATUS.md"
  - "docs/DECISIONS.md"
  - "coding-sessions/tickets/open/BRN-0003-*.md"
  - "coding-sessions/tickets/closed/BRN-0003-*.md"
  - "coding-sessions/reports/BRN-0003-*.md"
  - "coding-sessions/human-report/BRN-0003-*.md"
  - "coding-sessions/handoffs/BRN-0003-*.md"
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
  - "npm test"
  - "npm run quickstart"
  - "npm run trust-bench"
  - "node scripts/ticket-system.mjs check BRN-0003"
created: 2026-08-01
updated: 2026-08-01
---

# BRN-0003 Prepare The Brain For Shared-App Integration

## Goal

Make palari-brain consumable by the shared-Palari application (palari-v05
APP-0707/APP-0708) as a multi-member, host-attributed memory kernel —
without importing any app-specific policy into the brain. Four bounded
units: host-stamped actor attribution, documented shared-scope semantics,
a tested concurrency contract, and one named consumer seam.

## Context And Authority

The founder approved shared, membership-governed Palaris in palari-v05 on
2026-07-31 (APP-0707 collaboration contract; APP-0708 dormant relational
schema). APP-0708 requirement 7 states message attribution must support
"human, Palari, and system authors without inferring the actor from `role`
or `speaker`" — the same law this repository already enforces for speaker
and time. The founder directed on 2026-08-01 that palari-brain receive the
generalizable half of this work while palari-v05 evolves independently.
The dividing principle is fixed: the BRAIN owns mechanism (attribution,
scope isolation, honest deletion, chronology); the APP owns policy (roles,
membership, who may delete whose statements, timezone presentation).

## Scope

- **A. Host-stamped actor attribution.** `ingestChatTurn` accepts an
  optional caller-supplied `authorId` (opaque string, authenticated by the
  consumer host) for the user message of a turn. The gate stamps it on the
  evidence row exactly as it stamps time: additive nullable column, never
  model-writable, absent for existing rows and single-user callers. The
  attribution flows through every retrieval surface that already carries
  `speaker`: exploration rows (`memory_find`/`memory_read`/
  `memory_timeline`), hybrid search rows, semantic rows, graph edge
  admission (speaker stays host-derived), and the `forgetWithReport`
  residual entries. Timeline and read output expose it as `authorId`
  beside `speaker`.
- **B. Shared-scope semantics, documented and tested.** Scope keys are
  already opaque strings; a consumer may pass a workspace or Palari ID as
  the scope key to obtain one shared journal for many members. Add
  contract tests proving: (1) cross-scope isolation is byte-identical to
  today's behavior; (2) within one shared scope, two authors' rows carry
  distinct `authorId` values and retrieval surfaces preserve them; (3)
  `forgetWithReport` inside a shared scope reports residuals regardless of
  author (policy filtering is the caller's job and is NOT added here).
- **C. Concurrency contract.** Decide, implement if needed, test, and
  document the rules for one store under concurrent use: journal mode,
  busy/locked behavior on concurrent `ingestChatTurn` and read paths in
  one process, and the explicit multi-process stance (supported or
  refused, but stated). The contract must fail loudly, never corrupt or
  silently drop a turn.
- **D. `docs/CONSUMER-SEAM.md`.** One document naming the stable consumer
  surface: the exported functions an application may depend on, the
  package versioning promise, the schema-upgrade discipline (canonical
  tables migrate additively and are never destructively rewritten; derived
  tables — FTS, vectors, graph — are rebuildable and may be dropped), and
  the mechanism/policy boundary above. `docs/BRAIN-API.md` gains the
  `authorId` addendum.

## Out Of Scope

- Roles, memberships, invites, permissions, or any authorization decision
  inside the brain. Possession of a scope key is the only gate, exactly as
  today; the consumer host enforces membership before calling.
- Any change to the frozen reducer/digest wire contracts or their speaker
  vocabulary (a successor contract version is a separate ticket if wanted).
- Any palari-v05 code, SQL, or runtime integration; any network or service
  layer around the brain.
- Any live provider call, eval identity, benchmark invocation, or change
  under `evals/`.
- Timezone handling or display-time formatting (app-side context).

## Acceptance Criteria

1. `ingestChatTurn` with `authorId` stamps it host-side on the user
   evidence row; without it, behavior and stored bytes are unchanged from
   today (backward compatibility proven by the existing suite passing
   unmodified plus an explicit no-authorId equivalence test).
2. Every surface that returns `speaker` returns `authorId` when present:
   find, read, timeline, memory_search rows, semantic rows, forget
   residuals.
3. A model, reducer, or extractor payload can never set or alter
   `authorId` (negative test).
4. Shared-scope tests (Scope B) pass, including unchanged cross-scope
   isolation.
5. The concurrency contract is documented in `docs/CONSUMER-SEAM.md` and
   enforced by at least one test exercising concurrent ingest into one
   scope.
6. `docs/CONSUMER-SEAM.md` exists with the stable-export list, versioning
   promise, schema-upgrade discipline, and mechanism/policy boundary.
7. Full suite, quickstart, and trust-bench remain green; no sealed
   `evals/` path is moved or renamed.

## Ticket Completion Contract

### Goal

The brain accepts and preserves host-authenticated author identity, states
its sharing and concurrency semantics as tested contracts, and presents
one documented seam an application can integrate against.

### Non-Goals

No membership policy, no v05 integration code, no reducer-contract
changes, no live measurement.

### Definition Of Done

- Code, tests, and both documents committed on the ticket branch.
- STATUS.md unit entry and docs/DECISIONS.md entry appended.
- Ticket lint, scope check, and report lint pass.

### Evidence Required

- `npm test` (full suite), `npm run quickstart`, `npm run trust-bench`
  outputs.
- `node scripts/ticket-system.mjs check BRN-0003`.
- A fresh-context review report under `coding-sessions/reports/`.

### Expansion Rules

- If any unit grows beyond one focused change set, open child tickets
  (BRN-0003-A..D) rather than widening this one. Reducer-vocabulary work,
  if desired, becomes its own ticket with a successor contract version.

### Final Review Gate

- One fresh-context reviewer verifies the mechanism/policy boundary, the
  no-model-writable-attribution negative test, and backward compatibility.
  Quetzali alone may mark BRN-0003 accepted.

## Verification

- Run `npm test`, `npm run quickstart`, `npm run trust-bench`.
- Run `node scripts/ticket-system.mjs check BRN-0003`.
- Search `docs/CONSUMER-SEAM.md` for explicit statements of: stable
  exports, versioning, additive canonical migration, derived-table
  rebuildability, concurrency rules, and the mechanism/policy boundary.

## Stop Conditions

- Stop if the work needs a path outside `allowed_paths` or touches
  `forbidden_paths`.
- Stop if correctness would require changing a frozen reducer/digest wire
  contract, a sealed eval artifact, or canonical-row identity derivation
  for existing rows.
- Stop if any step would require membership policy, live provider calls,
  or palari-v05 code to land inside this repository.

---
id: BRN-0001
title: "Repair Retrieved Answer Reliability"
stream: retrieval
level: 1
parent_id:
root_id: BRN-0001
children:
  - BRN-0001-A
  - BRN-0001-B
  - BRN-0001-C
status: accepted
risk: R2
priority: P0
agents_allowed: 1
claimed_by:
claimed_at:
target_branch: "main"
branch: "ticket/BRN-0001-repair-retrieved-answer-reliability"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0001-repair-retrieved-answer-reliability"
allowed_paths:
  - "src/brain.mjs"
  - "src/retrieval-answer.mjs"
  - "tests/brain.contract.test.mjs"
  - "tests/retrieval-answer.contract.test.mjs"
  - "evals/run-reached-prefix-retrieval-regression.mjs"
  - "evals/run-answer-interpretation-regression.mjs"
  - "tests/reached-prefix-retrieval-regression.contract.test.mjs"
  - "tests/answer-interpretation-regression.contract.test.mjs"
  - "evals/README.md"
  - "docs/BRAIN-API.md"
  - "package.json"
  - "STATUS.md"
  - "coding-sessions/tickets/open/BRN-0001-*.md"
  - "coding-sessions/tickets/closed/BRN-0001-*.md"
  - "coding-sessions/reports/BRN-0001-*.md"
  - "coding-sessions/human-report/BRN-0001-*.md"
  - "coding-sessions/handoffs/BRN-0001-*.md"
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
  - "evals/live-runs/**"
  - "evals/predictions/**"
requires_human_confirmation: false
requires_review: true
verification:
  - "npm run ticket -- ticket-lint-all"
  - "node --test tests/brain.contract.test.mjs tests/retrieval-answer.contract.test.mjs tests/reached-prefix-retrieval-regression.contract.test.mjs"
  - "npm run reached-prefix-regression"
  - "npm run quickstart"
created: 2026-07-31
updated: 2026-07-31
---

# BRN-0001 Repair Retrieved Answer Reliability

## Goal

Turn the terminal seen-six finding into a reliable answer boundary: when
Palari has already retrieved the right canonical evidence, it should use that
evidence accurately instead of inventing absence or miscomputing elapsed time.

## Scope

- Sequence and integrate three direct children:
  - `BRN-0001-A`: strengthen the answer contract against false absence after
    relevant retrieval and clarify safe reuse of prior Palari advice;
  - `BRN-0001-B`: attach deterministic host-computed question-relative time
    metadata to answer-facing canonical evidence; and
  - `BRN-0001-C`: lock those failure classes into an offline, provider-free
    structural regression before any fresh live proposal.
- Preserve complete canonical dialogue, host-derived provenance, the one-gate
  write boundary, exact-ID forgetting, and optional retrieval surfaces.
- Integrate the children sequentially because A and B both own the answer
  boundary. Do not run them as parallel writers over the same files.
- Keep the terminal v1-v5 identities and their private evidence immutable.

## Out Of Scope

- No provider call, spend, rerun, regrade, or repair of a terminal report.
- No new live identity, predictions, dataset row selection, public score, or
  claim that offline structure proves answer quality.
- No reducer, admission gate, canonical journal, graph extraction, embedding,
  storage schema, UI, multi-agent, or provider migration work.
- No lexical answer validator that mistakes word overlap for factual support.

## Acceptance Criteria

1. A directly relevant non-empty retrieval result can no longer be paired with
   answer instructions that license an unsupported "no relevant memory"
   response; prior Palari advice remains advice and never becomes a user fact.
2. Answer-facing canonical rows expose deterministic, tested time deltas from
   their host-recorded `observedAt` to the supplied `questionDate`, including
   the measured November-to-February three-month case.
3. Provider-free regressions cover the phone-advice, before/after appliance,
   and elapsed-month failure classes without embedding private dataset text or
   expected answers in tracked fixtures.
4. Existing honest absence, speaker attribution, correction chronology,
   retrieval limits, canonical evidence, and forgetting contracts remain
   green.
5. Each child receives fresh-context review. This parent is ready for founder
   acceptance only after all three children are accepted and integrated.

## Measured Basis

- Terminal v5 scored 3/6 while transcript coverage was 7/7 and semantic search
  was used on 6/6.
- `09d032c9` returned its required prior-advice session at the top of the
  result set, then answered that no relevant phone-battery memory existed.
- `0977f2af` returned both the earlier Instant Pot and later Air Fryer
  sessions—including an Instant-Pot-focused follow-up—then answered that no
  earlier gadget memory existed.
- `5e1b23de` returned the workshop row dated 2023-11-01 for a question dated
  2024-02-01, quoted both dates, and still answered zero months instead of
  three.
- These are answer interpretation failures after successful evidence
  delivery. The invalid 0/7 report join is already explained by the immutable
  zero-provider audit and is not a reason to rerun or rewrite v5.

## Ticket Completion Contract

### Goal

Integrate the smallest answer-boundary changes that directly address the three
measured failure classes, with honest offline evidence and no live inference.

### Non-Goals

Do not chase a benchmark score, add a general reasoning engine, summarize away
canonical evidence, or redesign retrieval/storage.

### Definition Of Done

- A, B, and C are reviewed, accepted, and integrated into this parent branch.
- Focused answer/retrieval tests, the provider-free reached-prefix regression,
  full suite, and quickstart pass.
- `STATUS.md` states what improved and what still requires live proof.

### Evidence Required

- Child technical reports and reviewer notes.
- Exact committed changed paths and scope checks against `main`.
- Focused test output, reached-prefix output, full-suite totals, and
  quickstart output.

### Expansion Rules

- A newly discovered retrieval-ranking defect becomes a new child only after
  evidence shows it blocks A or B; do not fold speculative ranking work in.
- Any live validation becomes a later founder-gated ticket with a fresh
  identity, preregistration, exact cap, and separate authorization.

### Final Review Gate

A fresh reviewer checks the integrated contract and regressions. Only the
founder or an explicitly authorized reviewer may accept the parent.

## Verification

- `npm run ticket -- ticket-lint-all`
- `node --test tests/brain.contract.test.mjs tests/retrieval-answer.contract.test.mjs tests/reached-prefix-retrieval-regression.contract.test.mjs`
- `npm run reached-prefix-regression`
- `npm test`
- `npm run quickstart`
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0001`

## Stop Conditions

- Stop if the work needs a path outside `allowed_paths` or touches
  `forbidden_paths`.
- Stop before any provider/network call, new live identity, prediction, spend,
  terminal artifact mutation, dataset copy, or public result.
- Stop if a proposed shortcut weakens canonical evidence, speaker provenance,
  honest absence, exact forgetting, or the one-gate write boundary.
- Stop and reopen the relevant child if offline structure cannot support its
  acceptance criterion without semantic answer grading.

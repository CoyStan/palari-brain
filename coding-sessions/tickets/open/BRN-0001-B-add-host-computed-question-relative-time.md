---
id: BRN-0001-B
title: "Add Host Computed Question Relative Time"
stream: answer
level: 2
parent_id: BRN-0001
root_id: BRN-0001
children: []
status: open
risk: R2
priority: P0
agents_allowed: 1
claimed_by:
claimed_at:
target_branch: "ticket/BRN-0001-repair-retrieved-answer-reliability"
branch: "ticket/BRN-0001-B-add-host-computed-question-relative-time"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0001-B-add-host-computed-question-relative-time"
allowed_paths:
  - "src/retrieval-answer.mjs"
  - "tests/retrieval-answer.contract.test.mjs"
  - "docs/BRAIN-API.md"
  - "STATUS.md"
  - "coding-sessions/tickets/open/BRN-0001-B-*.md"
  - "coding-sessions/tickets/closed/BRN-0001-B-*.md"
  - "coding-sessions/reports/BRN-0001-B-*.md"
  - "coding-sessions/human-report/BRN-0001-B-*.md"
  - "coding-sessions/handoffs/BRN-0001-B-*.md"
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
  - "evals/**"
requires_human_confirmation: false
requires_review: true
verification:
  - "node --test tests/retrieval-answer.contract.test.mjs"
  - "npm run quickstart"
created: 2026-07-31
updated: 2026-07-31
---

# BRN-0001-B Add Host Computed Question Relative Time

## Goal

Give the answer model deterministic host-computed time distance between each
answer-facing canonical message and the current question date, so simple
calendar arithmetic is not delegated to an inexpensive generation model.

## Scope

- Derive question-relative time only inside `answerWithRetrieval`, from the
  host-recorded row timestamp and validated `questionDate`.
- Add immutable metadata to copied answer-facing rows without changing stored
  canonical evidence. The minimum shape names the evidence time, reference
  time, past/same/future relation, signed whole days, and signed whole calendar
  months.
- Define whole calendar months as UTC year/month distance adjusted one month
  toward zero when the later timestamp has not reached the earlier day/time;
  do not approximate a month as 30 days.
- Apply one shared derivation to canonical rows returned through
  `memory_find`, `memory_read`, and `memory_search`; apply it to graph evidence
  only if the graph row exposes the same host time without inference.
- Teach the answer instructions to use host-derived time metadata for elapsed
  time while still reading canonical text for facts.
- Document and test missing/invalid dates, exact boundaries, partial months,
  year crossing, leap dates, same instant, and future evidence.

## Out Of Scope

- No natural-language date extraction, timezone guessing, calendar library,
  model-authored timestamp, or stored schema migration.
- No graph extraction, trend model, reducer, retrieval ranking, provider, or
  benchmark runner change.
- No live call or claim that arithmetic metadata alone guarantees a correct
  generated sentence.

## Acceptance Criteria

1. A canonical row observed on `2023-11-01T00:46:00.000Z` for a question at
   `2024-02-01T18:06:00.000Z` carries `wholeCalendarMonths: 3` and a past
   relation.
2. The host derives all fields from validated timestamps; caller/model text
   cannot author or override them.
3. Every decorated result preserves exact canonical text, speaker,
   `evidenceId`, `sourceMessageId`, session, and observation time, and the
   underlying brain result is not mutated.
4. Invalid or missing `questionDate` omits the derived block and preserves the
   existing answer contract rather than fabricating a reference time.
5. Boundary tests cover partial months, year crossings, leap dates, same time,
   future rows, and negative direction deterministically.
6. Existing retrieval, graph, honest-absence, and quickstart behavior remains
   green.

## Dependency And Order

BRN-0001-A must be reviewed and integrated first. This child then starts from
the updated BRN-0001 parent branch so one specialist at a time owns
`src/retrieval-answer.mjs` and its contract tests.

## Measured Basis

Terminal `5e1b23de` had the correct workshop row at rank 1 with host time
2023-11-01 and a question date of 2024-02-01. The answer repeated the date but
said zero months. Evidence discovery was correct; calendar arithmetic was not.

## Ticket Completion Contract

### Goal

Move deterministic elapsed-time arithmetic from the generation model into
small, transparent host metadata at the retrieval boundary.

### Non-Goals

Do not build general temporal NLP, infer event dates from prose, or change the
canonical evidence model.

### Definition Of Done

- One pure derivation and one non-mutating decoration path cover the named
  answer-facing surfaces.
- The public API documents field semantics and omission behavior.
- Focused and full tests plus quickstart pass; work is scope-clean and ready
  for fresh review.

### Evidence Required

- Table-driven time arithmetic tests, result immutability assertions, exact
  metadata on the measured date pair, full suite, quickstart, and scope checks.

### Expansion Rules

If a question requires extracting an event date from message prose rather than
using the row's host time, stop. That is a different semantic feature and may
not be added here.

### Final Review Gate

A fresh reviewer checks arithmetic edge cases, immutability, timestamp
authority, and compatibility. Acceptance remains human-controlled.

## Verification

- `node --test tests/retrieval-answer.contract.test.mjs`
- `npm test`
- `npm run quickstart`
- `npm run ticket -- scope-check --committed-plus-dirty --target ticket/BRN-0001-repair-retrieved-answer-reliability BRN-0001-B`

## Stop Conditions

- Stop if the work needs a path outside `allowed_paths` or touches
  `forbidden_paths`.
- Stop if any proposal mutates canonical rows, guesses dates from text, adds a
  dependency, changes stored schema, or makes time metadata model-authored.
- Stop before provider calls, benchmark changes, spend, or terminal evidence
  mutation.

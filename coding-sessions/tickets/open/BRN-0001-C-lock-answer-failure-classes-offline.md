---
id: BRN-0001-C
title: "Lock Answer Failure Classes Offline"
stream: evaluation
level: 2
parent_id: BRN-0001
root_id: BRN-0001
children: []
status: in-review
risk: R2
priority: P1
agents_allowed: 1
claimed_by:
claimed_at:
target_branch: "ticket/BRN-0001-repair-retrieved-answer-reliability"
branch: "ticket/BRN-0001-C-lock-answer-failure-classes-offline"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0001-C-lock-answer-failure-classes-offline"
allowed_paths:
  - "evals/run-reached-prefix-retrieval-regression.mjs"
  - "evals/run-answer-interpretation-regression.mjs"
  - "tests/reached-prefix-retrieval-regression.contract.test.mjs"
  - "tests/answer-interpretation-regression.contract.test.mjs"
  - "evals/README.md"
  - "package.json"
  - "STATUS.md"
  - "coding-sessions/tickets/open/BRN-0001-C-*.md"
  - "coding-sessions/tickets/closed/BRN-0001-C-*.md"
  - "coding-sessions/reports/BRN-0001-C-*.md"
  - "coding-sessions/human-report/BRN-0001-C-*.md"
  - "coding-sessions/handoffs/BRN-0001-C-*.md"
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
  - "node --test tests/reached-prefix-retrieval-regression.contract.test.mjs tests/answer-interpretation-regression.contract.test.mjs"
  - "npm run reached-prefix-regression"
  - "npm run quickstart"
created: 2026-07-31
updated: 2026-07-31
---

# BRN-0001-C Lock Answer Failure Classes Offline

## Goal

Create a provider-free regression that proves the repaired answer boundary
delivers the exact structural inputs needed for the three measured failure
classes before anyone proposes another live evaluation.

## Scope

- Add a small synthetic answer-interpretation regression over the real
  `answerWithRetrieval` product API.
- Cover three generic fixtures without copying private LongMemEval text or
  expected answers into git:
  - relevant prior Palari advice is returned and the answer contract permits
    using it as advice without treating it as a user fact;
  - an earlier user-owned appliance and a later appliance are both returned
    with usable chronology and cannot structurally justify absence; and
  - a November event viewed from February carries three host-computed calendar
    months.
- Include an irrelevant-result and empty-result control so the regression does
  not weaken honest absence.
- Use a deterministic provider callback only to assert boundary inputs. It may
  return fixed sentinel text, but it must not grade natural-language answers.
- Emit a private/local or temporary structural report with
  `answerQualityGraded: false`, `providerCalls: 0`, and `networkCalls: 0`.
- Add an npm command and concise eval documentation for the offline check.

## Out Of Scope

- No Gemini/OpenAI/other provider, credential read, embedding transport,
  generation, judge, score, spend, prediction, or live run identity.
- No private dataset text, answer string, transcript body, result bundle, or
  terminal artifact in git.
- No product behavior change beyond a narrowly justified testability seam; if
  A or B is incomplete, reopen that child instead of repairing it here.
- No publication claim that a structural regression predicts benchmark
  accuracy.

## Acceptance Criteria

1. All three failure-class fixtures traverse the real retrieval-to-answer API
   and assert the post-A/B instructions, canonical evidence, speaker labels,
   chronology, and time metadata required for a correct answer.
2. Empty and irrelevant controls retain honest-absence semantics.
3. The regression is deterministic, import-inert, makes zero network/provider
   calls, reads no environment credential, and carries no private dataset
   bytes or expected benchmark answers.
4. Its report explicitly says answer quality was not graded and cannot be used
   to raise the terminal 3/6 result.
5. The existing reached-prefix regression remains 6/6 with its question-7
   boundary green on this machine; a fresh clone remains green without the
   gitignored dataset.

## Dependency And Order

BRN-0001-A and BRN-0001-B must both be reviewed and integrated into the parent
branch first. This ticket verifies their composition; it does not substitute
for either implementation review.

## Ticket Completion Contract

### Goal

Make the next product cut falsifiable offline while preserving an honest
boundary between structural evidence and live answer quality.

### Non-Goals

Do not create or preview the next paid benchmark identity and do not encode the
seen answers into a deterministic oracle.

### Definition Of Done

- The synthetic regression, contract test, npm command, and eval documentation
  are committed on the child branch.
- Focused tests, the regression, reached-prefix check, full suite, and
  quickstart pass with zero provider/network calls.
- A fresh reviewer confirms no private data or answer-quality overclaim.

### Evidence Required

- Import-inert/source scans, deterministic report assertions, exact
  provider/network counts, focused/full test output, reached-prefix output,
  quickstart, and scope checks.

### Expansion Rules

Any live validation, new question selection, prediction, cap, or model choice
requires a later R3 founder-gated ticket after this parent closes.

### Final Review Gate

A fresh reviewer checks privacy, zero-network truth, failure-class coverage,
and claim boundaries. Acceptance remains human-controlled.

## Verification

- `node --test tests/reached-prefix-retrieval-regression.contract.test.mjs tests/answer-interpretation-regression.contract.test.mjs`
- `npm run answer-interpretation-regression`
- `npm run reached-prefix-regression`
- `npm test`
- `npm run quickstart`
- `npm run ticket -- scope-check --committed-plus-dirty --target ticket/BRN-0001-repair-retrieved-answer-reliability BRN-0001-C`

## Stop Conditions

- Stop if the work needs a path outside `allowed_paths` or touches
  `forbidden_paths`.
- Stop if a fixture needs private dataset text, expected benchmark answers, a
  provider, a credential, a prediction, or a live identity.
- Stop if the regression begins grading sentinel prose as answer quality or
  hiding an A/B product defect behind test-only behavior.

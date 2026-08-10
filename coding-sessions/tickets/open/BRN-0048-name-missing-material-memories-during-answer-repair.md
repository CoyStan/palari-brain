---
id: BRN-0048
title: "Name missing material memories during answer repair"
stream: memory
level: 1
parent_id: 
root_id: BRN-0048
children: []
status: in-review
risk: R2
priority: P0
agents_allowed: 2
claimed_by:
claimed_at:
target_branch: "main"
branch: "ticket/BRN-0048-name-missing-material-memories-during-answer-repair"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0048-name-missing-material-memories-during-answer-repair"
allowed_paths:
  - "src/openai.mjs"
  - "src/retrieval-answer.mjs"
  - "tests/answer-confirmation.contract.test.mjs"
  - "tests/openai.contract.test.mjs"
  - "docs/BRAIN-API.md"
  - "STATUS.md"
  - "coding-sessions/tickets/open/BRN-0048-*.md"
  - "coding-sessions/tickets/closed/BRN-0048-*.md"
  - "coding-sessions/reports/BRN-0048-*.md"
  - "coding-sessions/human-report/BRN-0048-*.md"
  - "coding-sessions/handoffs/BRN-0048-*.md"
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
  - "node --test tests/openai.contract.test.mjs tests/answer-confirmation.contract.test.mjs"
  - "npm test"
  - "npm run quickstart"
created: 2026-08-10
updated: 2026-08-10
---

# BRN-0048 Name missing material memories during answer repair

## Goal

Make the existing one-shot answer-commitment repair actionable when the model
omits evidence that it previously marked material. Name the missing
answer-local memory numbers without weakening evidence validation or creating
another model call.

## Scope

- Replace repeated generic late errors for omitted material confirmation
  evidence with one bounded, deduplicated message containing the missing
  answer-local memory numbers.
- Keep the existing single commitment repair and terminal second rejection.
- Add provider-free contracts, documentation, status, reports, and independent
  review.

## Out Of Scope

- No host-authored factual answer, automatic exclusion, evidence-rule
  weakening, new repair call, retrieval change, prompt tuning for one question,
  provider call, benchmark regrade, private artifact, dataset, or sealed U8
  access in the ticket worktree.

## Acceptance Criteria

1. A commitment that omits one or more previously material returned memories
   fails with one bounded message that names each missing answer-local memory
   number exactly once and contains no evidence ID, quote, or source text.
2. The existing repair input carries that message so the model can assess the
   named memories as used or with a fixed exclusion code.
3. Unknown, duplicate, unsupported, or still-incomplete repaired commitments
   remain terminal. No host-authored answer or automatic evidence disposition
   is added.
4. Focused, core, quickstart, legacy, scope, report, and diff gates pass, and
   an independent reviewer finds no unresolved P0-P3 issue.

## Verification

- `node --test tests/openai.contract.test.mjs tests/answer-confirmation.contract.test.mjs`
- `npm test`
- `npm run quickstart`
- `npm run test:legacy`
- `npm run ticket -- check BRN-0048`
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0048`
- `git diff --check main...HEAD`

## Stop Conditions

- Stop if the work needs a path outside `allowed_paths` or touches `forbidden_paths`.
- Stop if the change classifies omitted evidence for the model, exposes
  canonical IDs or content, adds another repair, or changes retrieval.

## Specialist Closeout

- Reproduced the instrument failure provider-free from all 13 recorded model
  responses. The exact host rejection was omitted material confirmation
  evidence, not a wrong answer or missing retrieval.
- Added a non-enumerable symbol carrying only host-internal missing evidence
  IDs from validation to the adapter. The adapter translates them to stable
  answer-local memory numbers and names each number once in the existing
  repair.
- The repair contains no canonical ID, quote, or source text. It does not
  select used/excluded status for the model and does not add a dispatch.
- Normal and bounded-incomplete commitment paths use the same translation.
  Another incomplete commitment remains terminal.
- Focused contracts pass 81/81, core passes 93/93, quickstart passes 6/6, and
  legacy passes 970 with 15 optional skips and zero failures across 985 tests.
- No provider, credential, dataset, production service, or sealed U8 question
  was accessed in the ticket worktree.

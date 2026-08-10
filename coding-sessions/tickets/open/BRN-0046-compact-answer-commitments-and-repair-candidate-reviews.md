---
id: BRN-0046
title: "Compact answer commitments and repair candidate reviews"
stream: memory
level: 1
parent_id: 
root_id: BRN-0046
children: []
status: claimed
risk: R2
priority: P0
agents_allowed: 2
claimed_by: "quetza"
claimed_at: 2026-08-10T20:23:01Z
target_branch: "main"
branch: "ticket/BRN-0046-compact-answer-commitments-and-repair-candidate-reviews"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0046-compact-answer-commitments-and-repair-candidate-reviews"
allowed_paths:
  - "src/openai.mjs"
  - "src/retrieval-answer.mjs"
  - "tests/openai.contract.test.mjs"
  - "tests/answer-confirmation.contract.test.mjs"
  - "tests/openai-counted-responses.contract.test.mjs"
  - "docs/BRAIN-API.md"
  - "STATUS.md"
  - "coding-sessions/tickets/open/BRN-0046-*.md"
  - "coding-sessions/tickets/closed/BRN-0046-*.md"
  - "coding-sessions/reports/BRN-0046-*.md"
  - "coding-sessions/human-report/BRN-0046-*.md"
  - "coding-sessions/handoffs/BRN-0046-*.md"
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

# BRN-0046 Compact answer commitments and repair candidate reviews

## Goal

Reduce model-authored evidence bookkeeping while preserving the host evidence
boundary. Let the model omit irrelevant memories, explain only evidence it
uses, classify material exclusions with fixed codes, and repair one malformed
candidate review without starting another search.

## Scope

- Replace model-facing `bases` entries that require free-text `used/not_used`
  rationales with two compact lists: used memories with a short contribution,
  and excluded material memories with a fixed reason code.
- Support fixed exclusion codes for duplicate, superseded, outside-time-range,
  conflict, insufficient-authority, and not-relevant evidence.
- Translate the compact wire into the existing host-bound evidence commitment;
  preserve answer-local memory numbers, exact canonical excerpts, temporary
  inference rules, enumeration, and duplicate/reference validation.
- Let unrelated retrieved rows remain omitted. Continue to require every row
  the reviewer marked material to appear as used or compactly excluded.
- Permit one candidate-review format repair on the same pending page. The
  repair is review-only, uses the normal dispatch budget, and cannot search,
  bridge, read, plan, or commit an answer.
- Add provider-free contracts, documentation, status, reports, and independent
  review.

## Out Of Scope

- No change to retrieval ranking, memory search budgets, confirmation
  materiality, judge behavior, answer model, durable memory, user/workspace
  isolation, recommendation commitments, or historical artifacts.
- No host-authored factual answer, silent normalization of malformed review
  content, unlimited repair, automatic provider retry, or paid run.

## Acceptance Criteria

1. The normal evidence-backed answer wire contains no free-text explanation
   for excluded evidence. Used memories retain a short model-authored
   contribution; excluded material memories use one fixed reason code.
2. Irrelevant retrieved rows may be omitted, but every reviewer-marked
   material evidence ID must still be assessed exactly once as used or
   excluded. Unknown, duplicate, or unreturned numbers fail closed.
3. Translation preserves the existing host-owned evidence ID and exact excerpt
   binding. Temporary inferences and enumeration remain validated, and a
   non-abstaining answer still needs used evidence.
4. One malformed candidate review receives exactly one review-only repair on
   the same pending page. A second malformed review, refusal, empty response,
   forbidden tool, or repair-budget exhaustion is terminal.
5. Existing dispatch closure remains bounded by normal `maxModelDispatches`
   plus at most two closure calls. The new review repair cannot reopen or
   increase retrieval.
6. Focused, core, quickstart, legacy, scope, report, and diff gates pass, and
   an independent reviewer finds no unresolved P0-P3 issue.

## Verification

- `node --test tests/openai.contract.test.mjs tests/answer-confirmation.contract.test.mjs`
- `npm test`
- `npm run quickstart`
- `npm run test:legacy`
- `npm run ticket -- check BRN-0046`
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0046`
- `git diff --check main...HEAD`

## Stop Conditions

- Stop if the work needs a path outside `allowed_paths` or touches `forbidden_paths`.
- Stop if simplification permits silent omission of reviewer-marked material
  evidence, host-authored facts, another retrieval call, or more than one
  review-format repair.

## Specialist Closeout

- Replaced the model-facing detailed `bases` array with `usedMemories` and
  `excludedMaterialMemories`. Used entries contain one short contribution.
  Excluded material entries contain one of six fixed reason codes. Unrelated
  returned rows can be omitted.
- Kept the host boundary unchanged. The adapter resolves answer-local memory
  numbers to host-owned evidence IDs and exact bounded excerpts. It rejects
  unknown, duplicate, unreturned, or unsupported references. A
  non-abstaining answer still needs at least one used memory.
- Kept a used-only legacy parser shape for previously captured callers. The
  declared model tool does not expose that shape, and legacy free-text
  exclusions are not accepted.
- Added one normal-budget, review-only repair for a malformed candidate
  review. It uses the same pending page and cannot search, plan, bridge, read,
  graph, timeline, or commit an answer. A second invalid review, refusal,
  empty response, forbidden tool, or exhausted normal budget is terminal.
- Updated host operation auditing so only the first malformed review is
  recoverable after a later valid review of the same pending page. No search
  or closure allowance is added.
- Refreshed only the active answer-wire byte and hash pin for the changed
  schema. The consumed BRN-0025 compatibility pins remain unchanged.
- Focused contracts pass 68/68, core passes 91/91, quickstart passes 6/6, and
  legacy passes 955 with 15 optional skips and zero failures across 970 tests.
- No provider, credential, private artifact, dataset, production service, or
  sealed U8 question was accessed.

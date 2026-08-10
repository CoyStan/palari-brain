---
id: BRN-0047
title: "Seed briefing bridge anchors and preserve rejection details"
stream: memory
level: 1
parent_id: 
root_id: BRN-0047
children: []
status: in-review
risk: R2
priority: P1
agents_allowed: 2
claimed_by:
claimed_at:
target_branch: "main"
branch: "ticket/BRN-0047-seed-briefing-bridge-anchors-and-preserve-rejection-details"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0047-seed-briefing-bridge-anchors-and-preserve-rejection-details"
allowed_paths:
  - "src/openai.mjs"
  - "src/retrieval-answer.mjs"
  - "tests/openai.contract.test.mjs"
  - "tests/retrieval-frontier.contract.test.mjs"
  - "docs/BRAIN-API.md"
  - "STATUS.md"
  - "coding-sessions/tickets/open/BRN-0047-*.md"
  - "coding-sessions/tickets/closed/BRN-0047-*.md"
  - "coding-sessions/reports/BRN-0047-*.md"
  - "coding-sessions/human-report/BRN-0047-*.md"
  - "coding-sessions/handoffs/BRN-0047-*.md"
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
  - "node --test tests/openai.contract.test.mjs tests/retrieval-frontier.contract.test.mjs"
  - "npm test"
  - "npm run quickstart"
created: 2026-08-10
updated: 2026-08-10
---

# BRN-0047 Seed briefing bridge anchors and preserve rejection details

## Goal

Let the model bridge from canonical raw evidence already returned in its
initial briefing, and preserve the exact bounded host rejection reason when a
commitment repair fails. Remove one no-answer infrastructure failure and make
future validation failures directly diagnosable.

## Scope

- Seed initial briefing evidence into the ephemeral retrieval frontier as
  bridge-eligible evidence without creating a retrieval round, spending a
  retrieval call, or declaring it newly discovered by a search.
- Continue to reject fabricated, unknown, cross-session, or otherwise
  unregistered bridge anchors.
- Preserve the final bounded host rejection reason and code on terminal answer
  commitment errors after repair. Keep messages content-minimal and free of
  credentials, source bodies, or full evidence text.
- Add provider-free briefing-anchor, unknown-anchor, accounting, and exact
  rejection-detail contracts plus documentation, reports, and review.

## Out Of Scope

- No broader bridge expansion, search-budget increase, ranking change, new
  memory tool, prompt tuning for one question, provider call, benchmark rerun,
  dataset access, private artifact access, or sealed U8 access.
- No logging of prompts, returned evidence text, credentials, environment
  values, or provider response bodies.

## Acceptance Criteria

1. A raw canonical briefing row already registered in the answer evidence
   registry can be used as a `memory_bridge` anchor on the first retrieval
   call. The bridge still consumes one normal retrieval call.
2. Seeding adds zero retrieval rounds, attempts, returned counts, novelty, or
   selected evidence. It changes only bridge-anchor eligibility.
3. An anchor absent from both the briefing registry and prior retrieval results
   remains terminal with `MEMORY_RETRIEVAL_FRONTIER_ANCHOR_INVALID`.
4. When a commitment and its single repair both fail host validation, the
   terminal typed error preserves the last bounded rejection code and reason.
   It contains no prompt, evidence body, provider body, or credential.
5. Focused, core, quickstart, legacy, scope, report, and diff gates pass, and
   an independent reviewer finds no unresolved P0-P3 issue.

## Verification

- `node --test tests/openai.contract.test.mjs tests/retrieval-frontier.contract.test.mjs`
- `npm test`
- `npm run quickstart`
- `npm run test:legacy`
- `npm run ticket -- check BRN-0047`
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0047`
- `git diff --check main...HEAD`

## Stop Conditions

- Stop if the work needs a path outside `allowed_paths` or touches `forbidden_paths`.
- Stop if briefing seeding changes retrieval counts, permits unregistered
  anchors, or rejection logging would expose source or provider content.

## Specialist Closeout

- Added a separate ephemeral bridge-eligibility set. Every memory-tool result
  enters it as before. Raw `canonical_message` rows from the scoped
  canonical-fallback briefing are seeded before the provider runs.
- Briefing seeding does not enter searched evidence, answer-commit evidence,
  selected evidence, rounds, attempts, returned counts, novelty, or budget
  accounting. Derived digest rows do not enter this set.
- A first-call `memory_bridge` can use one eligible briefing ID and still
  consumes one normal retrieval call. Optional reranking receives the
  host-held canonical briefing text as bounded routing context.
- Unknown and provider-invented IDs still fail with
  `MEMORY_RETRIEVAL_FRONTIER_ANCHOR_INVALID`.
- Terminal `OPENAI_ANSWER_COMMIT_REPAIR_FAILED` errors now expose one frozen
  `hostRejection` object with only the final bounded host `code` and `reason`.
  Normal and bounded-incomplete commitment paths use the same safe detail.
- Focused contracts pass 82/82, core passes 93/93, quickstart passes 6/6, and
  legacy passes 969 with 15 optional skips and zero failures across 984 tests.
- No provider, credential, private artifact, dataset, production service, or
  sealed U8 question was accessed.

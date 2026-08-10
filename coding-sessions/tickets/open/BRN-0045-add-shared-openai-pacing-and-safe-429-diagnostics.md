---
id: BRN-0045
title: "Add shared OpenAI pacing and safe 429 diagnostics"
stream: memory
level: 1
parent_id: 
root_id: BRN-0045
children: []
status: open
risk: R2
priority: P1
agents_allowed: 2
claimed_by:
claimed_at:
target_branch: "main"
branch: "ticket/BRN-0045-add-shared-openai-pacing-and-safe-429-diagnostics"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0045-add-shared-openai-pacing-and-safe-429-diagnostics"
allowed_paths:
  - "src/openai.mjs"
  - "src/openai-rate-pacer.mjs"
  - "src/index.mjs"
  - "tests/openai.contract.test.mjs"
  - "docs/BRAIN-API.md"
  - "STATUS.md"
  - "coding-sessions/tickets/open/BRN-0045-*.md"
  - "coding-sessions/tickets/closed/BRN-0045-*.md"
  - "coding-sessions/reports/BRN-0045-*.md"
  - "coding-sessions/human-report/BRN-0045-*.md"
  - "coding-sessions/handoffs/BRN-0045-*.md"
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
  - "node --test tests/openai.contract.test.mjs"
  - "npm test"
  - "npm run quickstart"
created: 2026-08-10
updated: 2026-08-10
---

# BRN-0045 Add shared OpenAI pacing and safe 429 diagnostics

## Goal

Give every OpenAI transport caller an explicit shared pre-dispatch rate pacer
and preserve safe, actionable HTTP 429 metadata. Prevent avoidable rate-limit
failures without adding automatic retries or changing request semantics.

## Scope

- Add a provider-neutral rolling OpenAI rate pacer with an explicit unit
  ceiling and window. One pacer instance can govern multiple transports.
- Estimate conservative request units from the serialized request plus its
  declared output ceiling before transport dispatch.
- Let `createOpenAIResponsesTransport` accept an optional shared pacer and
  await it exactly once before each fetch.
- Attach only allowlisted rate-limit metadata to typed HTTP failures: status,
  request ID, retry-after, and rate-limit limit/remaining/reset headers.
- Add provider-free contracts, API documentation, status, technical report,
  reviewer note, and human report.

## Out Of Scope

- No default tier, paid-provider call, key inspection, automatic retry,
  request mutation, answer prompt change, model change, persistent or
  distributed coordination backend, benchmark rerun, or private artifact
  access.
- No claim that an in-process pacer coordinates independent hosts. External
  callers may share one instance or adapt the same admission interface to
  their own coordinator.

## Acceptance Criteria

1. An explicit `maxUnits` and `windowMs` create a deterministic rolling pacer.
   A shared instance prevents two transports from exceeding the same local
   window and records admitted units, waits, and waited milliseconds.
2. OpenAI request-unit estimation is positive, deterministic, content-free,
   and conservative. An oversized request is admitted only into an empty
   window so the pacer cannot deadlock.
3. The transport awaits an optional pacer before every physical request and
   never retries. With no pacer, its current behavior and request wire remain
   unchanged.
4. A provider HTTP 429 remains terminal but exposes safe allowlisted rate
   metadata. Error text, metadata, and tests never expose credentials or
   response bodies.
5. Focused, core, quickstart, legacy, scope, report, and diff gates pass, and
   an independent reviewer finds no unresolved P0-P3 issue.

## Verification

- `node --test tests/openai.contract.test.mjs`
- `npm test`
- `npm run quickstart`
- `npm run test:legacy`
- `npm run ticket -- check BRN-0045`
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0045`
- `git diff --check main...HEAD`

## Stop Conditions

- Stop if the work needs a path outside `allowed_paths` or touches `forbidden_paths`.
- Stop if pacing requires reading account limits from a credentialed provider,
  silently retrying a failed call, or choosing a hidden default usage tier.

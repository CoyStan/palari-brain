---
id: BRN-0042
title: "Bind final answer evidence in the host"
stream: memory
level: 1
parent_id: 
root_id: BRN-0042
children: []
status: claimed
risk: R2
priority: P0
agents_allowed: 1
claimed_by: "quetza"
claimed_at: 2026-08-10T04:14:34Z
target_branch: "main"
branch: "ticket/BRN-0042-bind-final-answer-evidence-in-the-host"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0042-bind-final-answer-evidence-in-the-host"
allowed_paths:
  - "src/openai.mjs"
  - "tests/openai.contract.test.mjs"
  - "tests/openai-responses-answer-wire.contract.test.mjs"
  - "tests/answer-confirmation.contract.test.mjs"
  - "docs/BRAIN-API.md"
  - "STATUS.md"
  - "coding-sessions/tickets/open/BRN-0042-*.md"
  - "coding-sessions/tickets/closed/BRN-0042-*.md"
  - "coding-sessions/reports/BRN-0042-*.md"
  - "coding-sessions/human-report/BRN-0042-*.md"
  - "coding-sessions/handoffs/BRN-0042-*.md"
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
  - "node --test tests/openai.contract.test.mjs tests/openai-responses-answer-wire.contract.test.mjs tests/answer-confirmation.contract.test.mjs"
  - "npm test"
  - "npm run quickstart"
  - "npm run test:legacy"
  - "npm run ticket -- check BRN-0042"
created: 2026-08-10
updated: 2026-08-10
---

# BRN-0042 Bind final answer evidence in the host

## Goal

Remove exact evidence-text transcription from the OpenAI final-answer wire.
Let the model own semantic selection and explanation while the adapter binds
each short answer-local memory number to the immutable canonical evidence ID
and exact returned text before the unchanged host validation boundary.

## Scope

- Replace provider-facing answer bases with `memoryNumber`, an explicit
  `used` or `not_used` disposition, and one non-empty rationale. Do not ask the
  model to copy an opaque evidence ID or exact quote already held by the host.
- Apply the same host-owned quote binding to enumeration items. Enumeration
  items retain their answer classification, label, action, and reason, but
  select evidence only by stable answer-local memory number.
- Preserve stable answer-local numbering across main retrieval and
  confirmation. Keep page-local reviewer `candidateNumber` separate.
- Translate model selections into the existing canonical host commitment:
  canonical evidence ID, exact contiguous returned text, and exactly one
  `consequence_for_answer` or `not_used_reason`.
- Retain the existing host validation for returned evidence, duplicate use,
  scope, provenance, temporary inferences, enumeration counts, material
  confirmation findings, and bounded confirmation state.
- Preserve the historical custom-provider commitment contract. Change only
  the OpenAI adapter wire and its public documentation.
- Add provider-free contracts proving host-owned binding for used, not-used,
  enumeration, confirmation, duplicate, and unknown-number behavior, including
  that provider-generated quote fields are no longer accepted.
- Record the interrupted super-hard diagnostic as context, without grading,
  retrying, accessing, or modifying its private artifacts.

## Out Of Scope

- No paid provider call, private artifact read or write, dataset execution,
  sealed U8 access, benchmark regrade, diagnostic retry, or cost-cap change.
- No weakening of durable admission, user/workspace isolation, evidence
  provenance, exact canonical source custody, or confirmation completeness.
- No semantic ownership, sale, airline, museum, shoe, concert, or other
  benchmark-specific rule.
- No retrieval ranking, embedding, reranker, bridge, frontier, durable memory,
  co-use edge, correction, deletion, or identity change.
- No change to custom-provider evidence IDs or host-native commitment shape.

## Acceptance Criteria

1. OpenAI answer and enumeration tool schemas contain no provider-writable
   evidence ID or quote field; bases use stable answer-local memory numbers,
   explicit `used`/`not_used` disposition, and one bounded rationale.
2. The adapter deterministically binds every selected number to the canonical
   evidence ID and exact text previously returned for that number before
   calling the existing host commitment validator.
3. Unknown or duplicate numbers, malformed dispositions, empty rationales,
   invalid enumeration counts, omitted material confirmation evidence, and
   invalid temporary-inference provenance still fail closed with one bounded
   repair opportunity where historically allowed.
4. Custom providers retain the existing canonical evidence-ID plus exact-quote
   contract; no user/workspace, provenance, admission, or durable-write
   boundary changes.
5. Provider-free tests demonstrate smaller model commitments, host-generated
   exact evidence, stable main/confirmation numbering, and rejection of stale
   provider quote fields.
6. Focused tests, `npm test`, quickstart, legacy tests, ticket gates, scope
   checks, and diff checks pass. Independent review finds no unresolved P0-P2
   issue before founder acceptance.

## Ticket Completion Contract

### Definition Of Done

- The model chooses evidence and explains its semantic role without copying
  source bytes; the host alone binds canonical IDs and returned evidence text.
- Final answer evidence remains auditable through the existing host-native
  result shape.

### Expansion Rules

- Prefer deleting provider-facing fields and adapting at the existing wire
  boundary over changing the host-native commitment validator.
- If exact host binding cannot be preserved for every returned evidence
  surface, stop and request founder direction rather than weakening checks.

### Final Review Gate

- R2 independent review is required. The founder explicitly authorized
  acceptance and merge after a clean review; any unresolved P0-P2 finding
  reopens the ticket before acceptance.

## Verification

- `node --test tests/openai.contract.test.mjs tests/openai-responses-answer-wire.contract.test.mjs tests/answer-confirmation.contract.test.mjs`
- `npm test`
- `npm run quickstart`
- `npm run test:legacy`
- `npm run ticket -- check BRN-0042`
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0042`
- `git diff --check main...HEAD`

## Stop Conditions

- Stop if the work needs a path outside `allowed_paths` or touches `forbidden_paths`.
- Stop before any provider, credential, private artifact, dataset, or sealed U8
  access.
- Stop if host-owned binding would lose exact returned evidence, weaken
  canonical provenance, or change non-OpenAI provider behavior.

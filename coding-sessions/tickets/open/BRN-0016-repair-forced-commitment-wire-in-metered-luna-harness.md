---
id: BRN-0016
title: "Repair forced commitment wire in metered Luna harness"
stream: evaluation
level: 1
parent_id: 
root_id: BRN-0016
children: []
status: open
risk: R3
priority: P0
agents_allowed: 1
claimed_by:
claimed_at:
target_branch: "main"
branch: "ticket/BRN-0016-repair-forced-commitment-wire-in-metered-luna-harness"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0016-repair-forced-commitment-wire-in-metered-luna-harness"
allowed_paths:
  - "evals/openai-responses-answer-wire.mjs"
  - "tests/openai-responses-answer-wire.contract.test.mjs"
  - "STATUS.md"
  - "docs/DECISIONS.md"
  - "coding-sessions/tickets/open/BRN-0016-*.md"
  - "coding-sessions/tickets/closed/BRN-0016-*.md"
  - "coding-sessions/reports/BRN-0016-*.md"
  - "coding-sessions/human-report/BRN-0016-*.md"
  - "coding-sessions/handoffs/BRN-0016-*.md"
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
  - "node --test tests/openai-responses-answer-wire.contract.test.mjs"
  - "npm test"
  - "npm run quickstart"
created: 2026-08-04
updated: 2026-08-04
---

# BRN-0016 Repair forced commitment wire in metered Luna harness

## Goal

Eliminate the exact private-meter mismatch that terminated BRN-0015 without
weakening the live request or spend boundary. Add one reusable, import-inert
validator for the OpenAI Responses answer wires Palari actually emits, cover
the forced cited-commit form with adversarial contracts, and prove a future
private harness can validate before reserving and dispatching. Do not mutate or
rerun the consumed BRN-0015 identity.

## Scope

- Derive the exact accepted request modes from accepted BRN-0014 and terminal
  BRN-0015 evidence: normal tool loop (`tool_choice: "auto"`), plain terminal
  answer (`tool_choice: "none"` with no tools), and forced cited commitment
  (`tool_choice: {type:"function", name:"palari_answer_commit"}` with only the
  commitment tool).
- Add a provider-free validator under `evals/` that verifies the frozen model,
  no-store/low-reasoning/serial-tool/include/output envelope and the exact
  mode-specific tool surface before any caller can reserve or fetch.
- Add contracts reproducing the BRN-0015 rejected request and proving it is
  admitted, while malformed forced names/types, extra tools, missing tools,
  wrong common fields, accessors, prototype tricks, and non-JSON data fail
  before a fake transport is called.
- Build a fresh private offline successor template outside git that imports the
  tracked validator. Exercise only fake/local compatibility; record its hash
  and zero provider/credential/spend evidence. It is not a run identity and
  cannot consume or imply live authority.
- Record verification and the product stop rule, then obtain fresh independent
  read-only review before delegated acceptance.

## Out Of Scope

- No edit, repair, resume, rerun, regrade, or deletion of
  `j4-luna-ettin-cited-first10-v1` or its 37 sealed artifacts.
- No benchmark answer, label, prior generated answer, question-specific rule,
  provider call, credential read, dataset access, model inference, spend,
  score, publication, or sealed-U8 access.
- No product commitment-policy change, memory-call-limit change, model change,
  retry, new scored identity, preregistration, or request for a live cap.
- No generic OpenAI SDK or transport abstraction beyond the three exact answer
  modes needed by the accepted Luna adapter.

## Acceptance Criteria

1. The validator import is inert and provider-free. It snapshots caller data
   through host-owned operations, accepts only exact own-data JSON-compatible
   fields, and returns a frozen mode descriptor without mutating the request.
2. Exact normal, none, and forced-commit request fixtures pass. The fixture
   matching BRN-0015's rejected fifth request is admitted as `forced-commit`;
   wrong name/type, additional/missing tools, and weakened common fields fail.
3. A fake metered seam proves validation precedes reservation and transport:
   valid forced commit reserves and dispatches once; every invalid fixture
   produces zero reservations and zero fetches.
4. A fresh private offline successor template imports this exact tracked
   validator and passes local/fake compatibility with zero credential reads,
   provider calls, result identity, or spend. The consumed launcher/runtime
   and sealed result rehash unchanged.
5. Focused tests, full suite, quickstart, ticket/report/scope/diff checks, and
   fresh independent review pass. `STATUS.md` records the product stop rule and
   leaves any live successor behind a new exact founder cap.

## Verification

- `node --test tests/openai-responses-answer-wire.contract.test.mjs`
- `npm test`
- `npm run quickstart`
- `npm run ticket -- check BRN-0016`
- `git diff --check`

## Stop Conditions

- Stop if the work needs a path outside `allowed_paths` or touches `forbidden_paths`.
- Stop before any credential, network/provider transport, model inference,
  benchmark dataset, result identity, or spend.
- Stop rather than modify the consumed BRN-0015 launcher/runtime/result.
- Stop for founder authority before freezing or dispatching any live successor.

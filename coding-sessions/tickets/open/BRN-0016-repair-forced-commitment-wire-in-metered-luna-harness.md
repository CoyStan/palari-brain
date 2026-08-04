---
id: BRN-0016
title: "Repair forced commitment wire in metered Luna harness"
stream: evaluation
level: 1
parent_id: 
root_id: BRN-0016
children: []
status: in-review
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

## Implementation Evidence

- `evals/openai-responses-answer-wire.mjs` snapshots and validates exact plain
  own-data requests before exposing them to reservation or dispatch. Validator
  SHA-256:
  `b29387dc286f7f2ab164a9f7d25d81dbbca0a7bf264ea6867f7ba7046ee5cfe2`.
- Exact normal-auto, plain-none, and forced `palari_answer_commit` fixtures pass.
  Real accepted product construction supplies the fixtures. Full normal/forced
  tool arrays are pinned at `46d925c9...` / `0b006512...`. Nineteen malformed
  fixtures fail before fake reservation/dispatch, plus prototype-poison tests.
- Fresh private offline template
  `/home/quetza/palari-brain-private/luna-ettin-cited-successor-meter-template.mjs`
  is mode 0600, SHA-256
  `6b5ba32ccbee2960f53a47621d3a2bd40c92e5875c648e06181c176161532d5a`,
  and pins/imports the exact tracked validator. `--verify` recorded one fake
  forced reservation followed by one fake dispatch, with zero credential
  reads, provider/model calls, or spend.
- Consumed BRN-0015 launcher/runtime/manifest SHA-256 remain
  `6ccc091b521cd3c9874805278ab7959e9fdb5523326fe775df01a37dd992f29b`,
  `d123525ec5e1c9bc1664fc9c323e9fa567831e9118d4e5cc273cfb29344c6ea2`,
  and `d48030533c6a344ea1c180bb7c99c7edb20dc48a0c7403f65a04837c0697448f`.
  No live identity, result, credential access, inference, network call, score,
  or spend occurred.

## First Review Findings

Fresh read-only review at exact `25fc0a4` found two P1 boundary defects and
recommended reopen. Name/order/type/strict validation did not freeze the full
tool descriptions and parameter schemas or reject null input/instructions.
Mutable array methods/prototypes could also admit an unknown tool surface or
alter dispatch serialization after validation; own `__proto__` data changed
the clone prototype. The private template additionally used 4096 output tokens
instead of the product's exact 512. No provider path ran. Repair must close all
three mismatches and receive fresh rereview before acceptance.

## P1 Repair Evidence

- Complete serialized tool arrays, including descriptions and parameter
  schemas, must match frozen SHA-256 pins. Input/instructions must be non-empty;
  accepted bodies come directly from real provider construction in
  `src/openai.mjs`.
- Snapshots use null-prototype objects/arrays, captured intrinsics, own data
  descriptors, and precomputed serialization. Poisoned `map` cannot change the
  surface; adding `Array.prototype.toJSON` during reservation cannot change the
  dispatched body; own `__proto__` is rejected without clone pollution.
- The private template pins the repaired validator, both surface hashes, actual
  tool order, and exact 512-token output limit. Fake forced validation,
  reservation, and dispatch pass with zero credential/provider/model/spend.

## Stop Conditions

- Stop if the work needs a path outside `allowed_paths` or touches `forbidden_paths`.
- Stop before any credential, network/provider transport, model inference,
  benchmark dataset, result identity, or spend.
- Stop rather than modify the consumed BRN-0015 launcher/runtime/result.
- Stop for founder authority before freezing or dispatching any live successor.

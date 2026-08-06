---
id: BRN-0025
title: "Repair generated runtime smoke custody"
stream: evaluation
level: 1
parent_id: 
root_id: BRN-0025
children: []
status: claimed
risk: R4
priority: P0
agents_allowed: 1
claimed_by: "quetza"
claimed_at: 2026-08-06T20:06:52Z
target_branch: "main"
branch: "ticket/BRN-0025-repair-generated-runtime-smoke-custody"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0025-repair-generated-runtime-smoke-custody"
allowed_paths:
  - "evals/generated-runtime-verifier.mjs"
  - "tests/generated-runtime-verifier.contract.test.mjs"
  - "evals/predictions.md"
  - "docs/EVALUATION-HARNESS.md"
  - "docs/DECISIONS.md"
  - "STATUS.md"
  - "coding-sessions/tickets/open/BRN-0025-*.md"
  - "coding-sessions/tickets/closed/BRN-0025-*.md"
  - "coding-sessions/reports/BRN-0025-*.md"
  - "coding-sessions/human-report/BRN-0025-*.md"
  - "coding-sessions/handoffs/BRN-0025-*.md"
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
  - "node --test tests/generated-runtime-verifier.contract.test.mjs"
  - "npm test"
  - "npm run quickstart"
created: 2026-08-06
updated: 2026-08-06
---

# BRN-0025 Repair generated runtime smoke custody

## Goal

Repair the generated-runtime composition boundary that consumed BRN-0024
before its provider-free Ettin smoke. Make offline verification execute the
real synthetic local-smoke path, freeze a separately identified successor
without touching the consumed evidence, and stop at a fresh founder gate.

## Scope

- Add one small tracked verifier for generated Node runtimes. It must reject a
  required call whose function definition was deleted and execute a caller-
  supplied provider-free verification mode with bounded output, timeout, and
  explicit zero-provider telemetry.
- Add permanent contracts reproducing BRN-0024's transformation-order defect:
  insert a helper, replace an overlapping region, retain its call, and prove
  verification fails before any live dispatch is possible.
- Create new mode-0600 private successor launcher/runtime artifacts under
  `/home/quetza/palari-brain-private/`; never modify the BRN-0024 launcher,
  runtime, result directory, terminal manifest, or semantic-review namespace.
- The successor runtime must run a real cached Ettin rank through a temporary
  synthetic Palari brain during offline verification, report zero provider
  calls, avoid `.env`, credentials, dataset content, and result-namespace
  creation, and remove its temporary workspace.
- Freeze successor identity `j4-luna-ettin-unexecuted11to20-v2` for the same
  disclosed never-executed/previously-profiled S60 ordinals 11-20. Preserve
  the accepted architecture, models, prompts, tool cap, exact-count boundary,
  question order, P-set 35 terminal grading, historical `6/10`, sealed U8,
  opening cumulative `$7.80502179`, and proposed `$5.00` fresh /
  `$12.80502179` cumulative caps.
- Register a new failing-first prediction set for the successor before any
  credential or scoring access. Record exact private hashes and all offline
  evidence in the governed reports and status.

## Out Of Scope

- No provider request, credential read, `.env` load, dataset/session/question/
  answer inspection, result namespace, score, semantic judgment, publication,
  or spend.
- No retry, resume, reroll, regrade, mutation, or reuse of consumed identity
  `j4-luna-ettin-unexecuted11to20-v1`.
- No product-memory, retrieval, ranking, prompt, answer-model, population,
  pricing, accounting-policy, or benchmark-label change.
- No claim that an offline smoke predicts the ten-question score. A successor
  live invocation remains a separate founder-gated action after acceptance.

## Acceptance Criteria

1. BRN-0024's private launcher/runtime/result bytes and terminal hashes remain
   unchanged. The successor uses a new identity, paths, predictions, and
   immutable result namespace.
2. The tracked verifier rejects missing or duplicate required definitions,
   retained calls without definitions, timeout/signal/nonzero exits, invalid
   JSON, oversized output, and any nonzero provider/credential/dataset/result
   telemetry. It accepts one exact successful provider-free child execution.
3. Permanent tests reproduce the exact helper-deletion class and prove syntax
   checking alone is insufficient while the new verifier fails closed.
4. The successor launcher's offline verification composes the final runtime,
   syntax-checks it, executes the real cached-Ettin synthetic smoke from that
   final byte sequence, verifies expected ordering/answer/finite telemetry,
   creates no live identity or credential intent, and cleans temporary state.
5. The successor freeze binds clean pushed source/import closure, prior
   terminal evidence, dataset/order metadata without parsing selected content,
   U8 exclusion, exact opening/caps, private hashes/modes, absent successor
   namespace, and PENDING independent-review state.
6. P-set 36 is FINAL before any credential access and preserves the same
   failing-first numeric/behavioral predictions as P-set 35. It is a new
   evaluation, not a regrade of BRN-0024.
7. Focused contracts, full tests, quickstart, private provider-free verification,
   ticket/report/scope/diff checks, and independent review pass with zero
   provider calls and `$0.00` fresh spend.
8. The accepted ticket stops at the founder gate. A live successor requires a
   new exact authorization naming identity, numeric caps, reviewed head,
   launcher/runtime hashes, and ACCEPT state.

## Ticket Completion Contract

### Goal

Produce a reviewed, provider-free successor freeze whose actual local-smoke
execution would have caught BRN-0024's undefined helper before identity
consumption.

### Non-Goals

Do not obtain a score, improve answer quality, or authorize the live successor.

### Definition Of Done

- The reusable verifier and regression tests are committed.
- New private successor artifacts are mode 0600 and exactly hashed.
- P-set 36, reports, decisions, status, and handoff state are complete.
- Independent review recommends ACCEPT; the ticket is accepted/merged only
  under founder authority or standing delegation.

### Evidence Required

- Focused contract output and the exact generated-runtime failure reproduction.
- Provider-free successor verification transcript with zero external activity.
- Before/after hashes for every immutable BRN-0024 private artifact.
- Full suite, quickstart, ticket, report, scope, and diff results.

### Expansion Rules

- Stop if the fix requires product behavior, dataset inspection, a changed
  evaluation treatment, a provider call, or a consumed-artifact mutation.
- Open a separate ticket for any issue outside generated-runtime composition
  and provider-free verification.

### Final Review Gate

- A fresh read-only reviewer inspects the exact pushed tracked head and exact
  private hashes. Acceptance grants no live-run authority.

## Verification

- `node --test tests/generated-runtime-verifier.contract.test.mjs`
- `node /home/quetza/palari-brain-private/luna-ettin-unexecuted11to20-v2-live-launcher.mjs --verify`
- `npm test`
- `npm run quickstart`
- `npm run ticket -- check BRN-0025`
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0025`
- `git diff --check`

## Stop Conditions

- Stop if the work needs a tracked path outside `allowed_paths`, touches a
  forbidden path, reads a credential or selected benchmark content, creates a
  successor result namespace, mutates BRN-0024 evidence, or needs live spend.

## Specialist Evidence

- FINAL P-set 36 registered before any possible live access.
- Focused verifier contracts: 11/11 PASS, including exact helper deletion,
  comment/string bait, hard-coded pass, transitive-closure mutation, and
  invalid one-shot transition reproductions.
- Private successor `--verify`: PASS with expected titanium ordering/answer,
  finite 4/4 scores, temporary cleanup, and zero provider/credential/dataset/
  result telemetry.
- Successor launcher/runtime are mode 0600 at SHA-256
  `cb45ee69e74efad11d9ebe78997663525010702af15e32a1d51d72bb3aef9737` /
  `7143690b581c6d10826a7f904cec029ec61524e0c96fec9d2f8f398c47a15fbf`.
- Complete same-ticket-root static import/reexport closure: 48 files / 732,601
  bytes / SHA-256
  `021cf118dec74f5611f5578488dbf86c5b11f996c0cec1a25ba6a680a8e2960d`.
- Attempt custody: durable `reserved -> launched` before spawn, atomic
  `launched -> consumed` in runtime, and no post-consumption transition.
- All seven BRN-0024 private hashes/modes rechecked unchanged before and after.
- Full tests: 786 pass / 15 skip / 0 fail across 801. Quickstart: 6/6.
- Provider, credential, dataset, result-namespace, semantic-judgment, and spend
  activity: `0 / 0 / 0 / 0 / 0 / $0.00`.
- Independent review: PENDING. Live successor authority: ABSENT.

Historical independent review of `f6bc40b` reopened P0 one-shot state, P1
mixed/incomplete closure, and P2 lexical-symbol evidence. The evidence above
is the cumulative specialist repair; fresh exact-head rereview is required.

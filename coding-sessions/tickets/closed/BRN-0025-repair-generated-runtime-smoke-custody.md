---
id: BRN-0025
title: "Repair generated runtime smoke custody"
stream: evaluation
level: 1
parent_id: 
root_id: BRN-0025
children: []
status: accepted
risk: R4
priority: P0
agents_allowed: 1
claimed_by:
claimed_at:
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
updated: 2026-08-07
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
- Focused verifier contracts: 13/13 PASS, including exact helper deletion,
  comment/string bait, hard-coded pass, dead-branch rearrangement,
  transitive-closure mutation, invalid one-shot transition reproductions,
  and marker-only review-attestation regressions.
- Private successor `--verify`: PASS with expected titanium ordering/answer,
  finite 4/4 scores, temporary cleanup, and zero provider/credential/dataset/
  result telemetry.
- Successor launcher/runtime are mode 0600 at SHA-256
  `122de407ad22fd8ee720023b0bbf7aad03dd716a865d6b283968688e30560373` /
  `8b1846493ca9835e21a91464a4885794a0b756ccaf33063ea3478fa197129dc6`.
- Complete same-ticket-root static import/reexport closure: 48 files / 732,601
  bytes / SHA-256
  `021cf118dec74f5611f5578488dbf86c5b11f996c0cec1a25ba6a680a8e2960d`.
- Attempt custody: durable `reserved -> launched` before spawn; the runtime's
  actual `consumeLaunchedAttempt` function performs atomic
  `launched -> consumed`; live `run()` and offline verification call that same
  function, and the latter proves a second call rejects reuse.
- Review attestation uses immutable identity/launcher/runtime/disposition
  markers only, avoiding a self-referential tracked HEAD. Founder authority
  separately binds the exact current clean pushed HEAD at launch.
- All seven BRN-0024 private hashes/modes rechecked unchanged before and after.
- Full tests: 788 pass / 15 skip / 0 fail across 803. Quickstart: 6/6.
- Provider, credential, dataset, result-namespace, semantic-judgment, and spend
  activity: `0 / 0 / 0 / 0 / 0 / $0.00`.
- Predispatch review: ACCEPT at exact head `782dc2212a7bc0b64c416dafeceebafefc41236f`.
  The one authorized invocation is now consumed; terminal review ACCEPTed
  exact clean pushed record head `5e7fd07` with no P0-P3 finding.

## Terminal Invocation Record

The founder authorized one invocation of
`j4-luna-ettin-unexecuted11to20-v2` under `$5.00` fresh /
`$12.80502179` cumulative at reviewed head
`782dc2212a7bc0b64c416dafeceebafefc41236f`, launcher SHA-256
`122de407ad22fd8ee720023b0bbf7aad03dd716a865d6b283968688e30560373`,
runtime SHA-256
`8b1846493ca9835e21a91464a4885794a0b756ccaf33063ea3478fa197129dc6`,
and review ACCEPT. The attempt was reserved at
`2026-08-07T03:18:45.492Z`, launched at `.497Z`, and consumed at `.627Z`.

Cached Ettin passed with titanium first, 4/4 finite scores, and zero provider
activity. The credential environment loaded. Gemini writer compatibility
passed one HTTP 200 `gemini-3.5-flash-lite` call at 525 input / 128 output
tokens and `$0.0004775` measured spend. The first Luna answer-smoke input-count
request was made once and failed HTTP 400: `Unknown parameter: 'include'.`
Parameter/code were `include` / `unknown_parameter`. No generation, successful
answer smoke, question, judge, score, semantic label, or retry occurred. The
runtime exited 1; report state is `failed`, `questions: []`, and
`compatibility: null`.

The Luna count attempt retains `$0.05` uncertain, making fresh accounted spend
`$0.0504775` and cumulative accounted spend `$7.85549929`. Both caps held.
Historical `6/10` and U8 remain unchanged.

The launcher then failed terminal artifact enumeration because the expected
top-level `transcripts/` directory was rejected as not being a mode-0600 file.
No manifest was produced. The consumed namespace is UNSEALED and must never be
sealed post hoc. Its immutable snapshot contains 12 files at mode 0600 and 8
directories at mode 0700; file-list SHA-256 is
`1785c7876fad8b3c01092e4c6649ac34371364a5b0365f511aa47c681cbc8b87` and
directory-list SHA-256 is
`0667cf1f4354d7f3f618b2605e851591996a9043711da22807e13f4259fe878f`.

P-set 36 grades writer compatibility PASS. All numeric and question-level
behavioral predictions are NOT REACHED / FAIL. Execution/accounting passes the
first-failure stop and cap-hold branches but fails the required seal. No
semantic-review overlay exists because there are zero question rows. This
identity is consumed permanently; no retry, resume, reroll, regrade, repair,
replacement, or post-hoc seal is authorized.

Post-terminal tracked verification passes: focused contracts 13/13; full tests
788 pass / 15 skip / 0 fail across 803; quickstart 6/6; ticket, report,
governed scope, and diff checks green. Independent terminal review of exact
clean pushed record head `5e7fd07` found no P0-P3 issue and recommends ACCEPT.
Under the founder's standing delegation for clean independently reviewed
tickets, BRN-0025 is accepted. This grants no retry, repair, post-hoc seal,
provider call, replacement identity, or successor authority.

Historical independent review of `f6bc40b` reopened P0 one-shot state, P1
mixed/incomplete closure, and P2 lexical-symbol evidence. Cumulative review of
`c83a664` then reopened P1 self-referential HEAD attestation and P2 simulated
rather than runtime-owned custody. The evidence above is the second cumulative
specialist repair; fresh exact-head rereview is required.

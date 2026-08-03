---
id: BRN-0007
title: "Re-measure Luna first ten after bounded finalization"
stream: evaluation
level: 1
parent_id: 
root_id: BRN-0007
children: []
status: open
risk: R3
priority: P0
agents_allowed: 1
claimed_by:
claimed_at:
target_branch: "main"
branch: "ticket/BRN-0007-re-measure-luna-first-ten-after-bounded-finalization"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0007-re-measure-luna-first-ten-after-bounded-finalization"
allowed_paths:
  - "evals/predictions.md"
  - "docs/DECISIONS.md"
  - "STATUS.md"
  - "coding-sessions/tickets/open/BRN-0007-*.md"
  - "coding-sessions/tickets/closed/BRN-0007-*.md"
  - "coding-sessions/reports/BRN-0007-*.md"
  - "coding-sessions/human-report/BRN-0007-*.md"
  - "coding-sessions/handoffs/BRN-0007-*.md"
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
  - "node /home/quetza/palari-brain-private/luna-first10-live-v2-launcher.mjs --verify"
  - "npm test"
  - "npm run quickstart"
created: 2026-08-03
updated: 2026-08-03
---

# BRN-0007 Re-measure Luna first ten after bounded finalization

## Goal

Measure whether the accepted BRN-0006 four-call retrieval ceiling and graceful
finalization let Luna complete the exact private LongMemEval S60 questions
1-10 that BRN-0005 could not finish. Preserve every other experimental factor
and treat the single invocation, including any failure, as terminal evidence.

## Context And Authority

On 2026-08-03 Quetzali accepted BRN-0006, directed its merge, and explicitly
directed a new questions 1-10 test. BRN-0006 is merged on canonical `main` at
`3f42023`. This is fresh authority for one new identity; it is not authority to
alter or rerun terminal `j4-luna-retrieval-first10-v1`.

The engineer selected the same `$1.00` fresh hard cap as v1. Current official
short-context Standard Luna prices remain `$0.20` per million input, `$0.02`
cached input, and `$1.20` output tokens. The previous identity accounted only
`$0.3785834`, including conservative Gemini embedding uncertainty, so the cap
provides operational headroom without becoming an open spend authorization.

## Scope

- Freeze private identity `j4-luna-retrieval-first10-v2` from canonical main
  at `3f42023`, carrying the exact J4 ledger forward at `$4.7428483`
  accounted: `$1.6851439` measured plus `$3.0577044` uncertain.
- Use the exact ordered S60 IDs and dataset from BRN-0005, questions 1-10 only,
  with sealed U8 `1568498a` unreachable.
- Keep `gpt-5.6-luna`, Standard service, low reasoning, `store:false`, Gemini
  `gemini-embedding-001`, the official `gpt-4o-2024-08-06` judge, prompts,
  memory contents, ranking, and grading unchanged.
- Change only the accepted product checkout: the host executes at most four
  memory calls and the OpenAI adapter makes one tool-disabled finalization
  dispatch after call four. Calls 0-3 may still answer early.
- Build a private, mode-0600 one-shot launcher outside git. It must verify all
  predecessor manifests, current product bytes, dataset/order, generated
  runtime bytes, absent identity, fresh/cumulative caps, and credential-read
  ordering before dispatch.
- Run one semantic retrieval compatibility smoke. If it fails, stop before
  question 1 and record that terminal result. Otherwise execute and judge all
  ten once in order, checkpointing each cell and stopping terminally on any
  failure.
- Pre-register predictions and freeze hashes before live work; obtain fresh
  independent pre-dispatch review; after the invocation record the exact
  result and spend whatever they are and obtain independent terminal review.

## Out Of Scope

- No code repair, prompt tuning, model/effort change, retry, resumed identity,
  reroll, selective rerun, regrade, hidden result, or public score.
- No writer, reducer, graph extractor, embedding provider, retrieval ranking,
  memory schema, dataset, question order, official label, or judge change.
- No claim that these ten already-inspected questions estimate unseen-user
  generalization. This is a private causal diagnostic of the bounded-finalizer
  behavior.
- No access to sealed U8 and no fresh spend above `$1.00` or cumulative J4
  accounted spend above `$5.7428483`.

## Acceptance Criteria

1. Before provider dispatch, `evals/predictions.md` freezes identity, exact
   population, providers, effort, product/dataset/predecessor/launcher/runtime
   hashes, unchanged prior prediction vector, opening ledger, `$1.00` fresh
   cap, and `$5.7428483` cumulative boundary.
2. The private launcher refuses if v1 or any predecessor artifact changed,
   if v2 runtime/results already exist, or if tracked/product bytes differ;
   credentials are loaded only after every offline check and the private run
   directory are durably established.
3. A fresh reviewer confirms the only experimental change versus BRN-0005 is
   accepted BRN-0006 behavior; four calls are host-enforced; finalization has
   no tools; all providers are metered; and one invocation cannot reroll.
4. Compatibility either passes with real Gemini semantic retrieval and a Luna
   answer or records a terminal pre-question failure. If it passes, each of
   the ten questions receives at most four memory calls, one non-empty answer,
   and one validated official label unless a terminal runtime failure stops
   later questions.
5. Terminal evidence records each call count, whether finalization occurred,
   answer-bearing-session coverage, semantic use, labels versus Gemini and v1,
   exact physical calls and usage, measured/uncertain spend, artifact hashes,
   file modes, and a zero-match exact-value credential scan.
6. `STATUS.md` records the immutable result and grades predictions
   failing-first. Tests, quickstart, ticket/report/scope checks, and fresh
   post-dispatch review are green. No result is rerun, regraded, or published.

## Ticket Completion Contract

### Goal

Obtain one defensible measurement of whether bounded graceful finalization
converts Luna's previously terminal question-5 loop into a complete first-ten
run without changing the rest of the experiment.

### Non-Goals

Do not optimize accuracy on known answers, repair a result during execution,
compare a new provider, or turn this private diagnostic into a benchmark claim.

### Definition Of Done

- Freeze and independent GO recommendation are committed and pushed before
  the one authorized invocation.
- The identity is terminal with rehashable private evidence after success or
  failure.
- Result, prediction grading, exact accounting, reports, and product stop rule
  are committed, pushed, and independently reviewed.

### Evidence Required

- Exact checkout, product, dataset/order, predecessor, launcher, and runtime
  hashes; absent-identity and credential-read-order checks.
- Compatibility transcript; every reached answer/tool and judge transcript;
  call/finalization summary; meter reconciliation; terminal artifact manifest;
  mode audit; and exact-value secret scan.
- Full suite, quickstart, ticket/report/scope checks, plus independent pre- and
  post-dispatch reviewer notes.

### Expansion Rules

- A compatibility, provider, cap, or question failure is the result. Any fix
  or new identity requires a new founder decision and preregistration.
- If the launcher needs a product change beyond BRN-0006, stop and reopen
  scope rather than changing the evaluated checkout.

### Final Review Gate

- A fresh reviewer recommends GO before dispatch and `accept`, `reopen`, or
  `needs-human` after terminal evidence.
- Only Quetzali may accept, close, merge, publish, or authorize cleanup.

## Verification

- `node /home/quetza/palari-brain-private/luna-first10-live-v2-launcher.mjs --verify`
- `npm test`
- `npm run quickstart`
- `npm run ticket -- ticket-lint-all`
- `npm run ticket -- report-lint BRN-0007`
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0007`
- `git diff --check main...HEAD`

## Stop Conditions

- Stop if the work needs a path outside `allowed_paths` or touches `forbidden_paths`.
- Stop before live dispatch unless the freeze is committed/pushed, offline
  verification passes, and a fresh reviewer recommends GO.
- Stop if any provider would be unmetered, if credentials could enter tracked
  or recorded bytes, if the result identity is not fresh, or if one invocation
  could be repeated.
- Stop if fresh accounted spend would exceed `$1.00`, cumulative J4 spend
  would exceed `$5.7428483`, or sealed U8 could be selected.

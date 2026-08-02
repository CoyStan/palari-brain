---
id: BRN-0005
title: "Compare Luna Against Gemini On First Ten"
stream: evaluation
level: 1
parent_id: 
root_id: BRN-0005
children: []
status: accepted
risk: R3
priority: P0
agents_allowed: 1
claimed_by:
claimed_at:
target_branch: "main"
branch: "ticket/BRN-0005-compare-luna-against-gemini-on-first-ten"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0005-compare-luna-against-gemini-on-first-ten"
allowed_paths:
  - "evals/predictions.md"
  - "docs/DECISIONS.md"
  - "STATUS.md"
  - "coding-sessions/tickets/open/BRN-0005-*.md"
  - "coding-sessions/tickets/closed/BRN-0005-*.md"
  - "coding-sessions/reports/BRN-0005-*.md"
  - "coding-sessions/human-report/BRN-0005-*.md"
  - "coding-sessions/handoffs/BRN-0005-*.md"
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
  - "npm run ticket -- ticket-lint-all"
  - "npm test"
  - "npm run quickstart"
  - "node /home/quetza/palari-brain-private/luna-first10-live-v1-launcher.mjs --verify"
created: 2026-08-02
updated: 2026-08-02
---

# BRN-0005 Compare Luna Against Gemini On First Ten

## Goal

Measure one controlled provider substitution on the already inspected
LongMemEval S60 ordinals 1-10: use `gpt-5.6-luna` at low reasoning for the
bounded retrieval-answer loop while preserving the Gemini embedder, product
retrieval behavior, exact question order, and official judge. Compare the
terminal result with BRN-0002's immutable Gemini 5/10 baseline.

## Context And Authority

On 2026-08-02 the founder explicitly approved this Luna first-ten comparison
and a `$1.00` fresh hard cap after reviewing the proposed design and
predictions. This is fresh authority for exactly one new identity; it does not
reopen or rerun BRN-0002.

## Scope

- Freeze identity `j4-luna-retrieval-first10-v1` on canonical `main` at
  `3d4c804`, carrying the exact J4 ledger forward from `$4.3642649`
  accounted (`$1.6734941` measured plus `$2.6907708` uncertain).
- Use the same ordered IDs `08e075c7`, `09d032c9`, `16c90bf4`, `5e1b23de`,
  `80ec1f4f_abs`, `0977f2af`, `0a34ad58`, `0edc2aef`, `10d9b85a`, and
  `1192316e`, with the same frozen dataset and official LongMemEval labels.
- Replace only the answer/tool-decision provider: OpenAI
  `gpt-5.6-luna`, standard mode, low reasoning, `store:false`, through the
  accepted `palari-brain/openai` adapter. Keep Gemini
  `gemini-embedding-001` semantic vectors and the unchanged
  `gpt-4o-2024-08-06` official judge.
- Build a private, one-shot launcher outside git, pin its bytes and every
  product/predecessor input in tracked preregistration, and make result or
  runtime existence permanently refuse another invocation.
- Run offline verification and a fresh independent pre-dispatch review before
  credential loading or provider dispatch.
- Invoke the launcher once. It performs one semantic retrieval compatibility
  smoke, stops before question 1 if that fails, otherwise runs and judges all
  ten in order. Any later failure is terminal and authorizes no repair/rerun.
- Preserve private metered transcripts, immutable hashes, and exact
  measured/uncertain spend; record the result in `STATUS.md` whatever it is.

## Out Of Scope

- No writer, reducer, graph extractor, embedding-provider, prompt, retrieval,
  judge, dataset, official label, or product behavior change.
- No modification, resumption, regrade, or publication of BRN-0002 or any
  other terminal identity.
- No adaptive effort escalation, provider retry, selective rerun, prompt
  tuning from known answers, benchmark claim, or run beyond question 10.
- No use of sealed U8 question `1568498a` and no public score.

## Acceptance Criteria

1. Before provider dispatch, `evals/predictions.md` records the exact identity,
   ordered population, provider/model/effort, hashes, 5/10 baseline, predicted
   outcome vector, opening ledger, and `$1.00` fresh / `$5.3642649` cumulative
   hard boundaries.
2. The private launcher verifies every predecessor, product, adapter,
   dataset/order, prompt, and runtime hash; refuses a pre-existing identity;
   and loads credentials only after all offline checks pass.
3. A fresh reviewer confirms that only answer generation changes, the Gemini
   embedder and official judge remain fixed, OpenAI usage is metered, the cap
   is fail-closed, and one invocation cannot be rerolled.
4. The single invocation either records compatibility failure before question
   1 or records one terminal answer and validated official label for each of
   the ten questions in order. Any runtime failure is the immutable result.
5. Terminal evidence reports exact label changes from Gemini, evidence-use
   versus retrieval failures, semantic use, answer-session coverage, physical
   calls, reasoning/input/output usage, and measured versus uncertain spend.
6. `STATUS.md` records the result and grades predictions failing-first. No
   result is hidden, edited, rerun, regraded, or published.

## Ticket Completion Contract

### Goal

Produce one defensible private Luna-versus-Gemini comparison on the exact
first-ten diagnostic without changing any non-provider experimental factor.

### Non-Goals

Do not repair observed failures, generalize from these seen cases, change the
embedding model, or claim that Luna is globally better or worse.

### Definition Of Done

- Freeze and independent pre-dispatch review are committed and pushed before
  any live request.
- The one-shot identity is terminal with rehashable private evidence.
- Result, spend, prediction grading, reports, and product stop rule are
  recorded and independently reviewed.

### Evidence Required

- Exact freeze commit, product/dataset/order/predecessor/launcher/runtime
  hashes, credential-read ordering, and absent result/runtime checks.
- Compatibility transcript, ten answer/tool transcripts when reached, ten
  unchanged official judge labels when reached, meter reconciliation, and
  exact-value secret scan.
- Full tests, quickstart, ticket lint/report lint, committed scope check, and
  independent pre- and post-dispatch reviewer notes.

### Expansion Rules

- If Luna requires a changed product contract, tool schema, retrieval prompt,
  embedding model, judge, or question population, stop and open a successor.
- A compatibility or runtime failure is terminal; a repair requires a new
  founder decision and identity, never reuse of this one.

### Final Review Gate

- A fresh reviewer recommends GO before dispatch and accept/reopen after the
  terminal evidence.
- Only the founder's recorded approval authorizes this live invocation. Only
  the founder may accept, close, merge, push the merged result, or authorize a
  later live identity.

## Verification

- `npm run ticket -- ticket-lint-all`
- `npm test`
- `npm run quickstart`
- `node /home/quetza/palari-brain-private/luna-first10-live-v1-launcher.mjs --verify`
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0005`

## Stop Conditions

- Stop if the work needs a path outside `allowed_paths` or touches `forbidden_paths`.
- Stop before provider dispatch unless the freeze is committed and pushed,
  independent review recommends GO, all hashes reverify, result and runtime
  are absent, both existing credentials are configured, and the fresh founder
  authority remains in force.
- Stop before question 1 on compatibility failure. Stop on the first later
  runtime, schema, cap, retrieval, answer, or judge failure and preserve it as
  terminal without retry.
- Stop if the implementation would expose a credential in URLs, bodies,
  transcripts, errors, git, or terminal output.

## Freeze Record

P-set 20, technical report, human report, STATUS pre-run record, and founder
decision are prepared before dispatch. The private launcher hashes
`4f2e425e8239b5304157a47745ddeaa025a14960ae120473a1b0a5fe2b097eb4`;
its generated runtime hashes
`b9c60472cc3190fb8eb72a947ad5f5937cb7094d2cdefdd1efe1a22d96cafadd`.
Offline verification rehashes 7/7 predecessor bundles and 8/8 product/eval
inputs, syntax-checks the runtime, confirms exact 10/10 order, and reports
runtime/result absent. Provider requests and fresh spend remain 0 / `$0.00`.

## Terminal Record

Fresh independent review recommended GO at `bc50322`; the single founder-
authorized invocation then ran on 2026-08-02. Compatibility passed. The
unchanged judge labelled the first four cases `PASS, FAIL, PASS, PASS` (3/4),
matching Gemini on those reached cases. Ordinal 5, `80ec1f4f_abs`, made seven
successful Luna memory-tool dispatches without an answer and terminated at
the frozen ceiling with `OPENAI_MODEL_DISPATCH_BUDGET_EXHAUSTED`. Questions
5-10 are ungraded; this is not a 3/10 score and the 7/10/provider-delta
predictions are not assessable. There was no rerun or regrade.

Fresh accounting is `$0.3785834` = `$0.0116498` measured + `$0.3669336`
uncertain; cumulative J4 accounting is `$4.7428483`. Terminal manifest
`574c865ca3755cf794b002de5b12ec3d474ae235b51e894772222dd97b48b5d8`
rehashes 35/35 mode-0600 artifacts, and exact-value scanning reports 0
credential matches. Next gate: fresh independent post-dispatch review;
founder acceptance alone may close and merge this ticket.

## Founder Acceptance

Accepted by Quetzali on 2026-08-02 after fresh independent post-dispatch
review recommended `accept` with no findings at review commit `07e760d`.
This acceptance authorizes closing, merging, and pushing BRN-0005 as immutable
terminal evidence. It does not authorize a rerun, regrade, raised dispatch
ceiling, replacement identity, product repair, or publication.

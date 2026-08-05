---
id: BRN-0018
title: "Isolate stronger answer model on frozen failure contexts"
stream: evaluation
level: 1
parent_id: 
root_id: BRN-0018
children: []
status: in-review
risk: R3
priority: P0
agents_allowed: 1
claimed_by:
claimed_at:
target_branch: "main"
branch: "ticket/BRN-0018-isolate-stronger-answer-model-on-frozen-failure-contexts"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0018-isolate-stronger-answer-model-on-frozen-failure-contexts"
allowed_paths:
  - "evals/predictions.md"
  - "STATUS.md"
  - "docs/DECISIONS.md"
  - "coding-sessions/tickets/open/BRN-0018-*.md"
  - "coding-sessions/tickets/closed/BRN-0018-*.md"
  - "coding-sessions/reports/BRN-0018-*.md"
  - "coding-sessions/human-report/BRN-0018-*.md"
  - "coding-sessions/handoffs/BRN-0018-*.md"
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
  - "node /home/quetza/palari-brain-private/stronger-answer-frozen-four-live-launcher.mjs --verify"
  - "npm test"
  - "npm run quickstart"
created: 2026-08-05
updated: 2026-08-05
---

# BRN-0018 Isolate stronger answer model on frozen failure contexts

## Goal

Measure final-answer model-tier quality independently of new retrieval by
replaying the exact final Responses contexts from BRN-0017's four immutable
failure rows once with
`gpt-5.6-sol`. Change only the model identifier, preserve low reasoning,
Standard service, no-store behavior, instructions, context, tools, and output
limit, and record the raw answers without altering the historical 6/10 result.
The retained Luna reasoning/tool trajectory makes this a final-turn Sol
effect, not a pure end-to-end Sol measurement.

## Context And Authority

BRN-0017 is accepted and merged at `7ee4857`; canonical `main` is now
`c56374e`. Its official 6/10 result and sealed artifacts remain immutable. The
founder accepted the corrected diagnosis and explicitly requested a stronger
model on the existing frozen contexts before architecture changes. Official
OpenAI guidance identifies `gpt-5.6-sol` as the frontier-capability GPT-5.6
tier and says an initial migration comparison should preserve the effective
reasoning effort and run representative evals before prompt or capability
changes. This ticket prepares that one causal comparison. A separate product
ticket will implement the retrieval/application architecture after this
baseline is terminal.

## Scope

- Freeze private identity `j4-sol-frozen-failures-pre-architecture-v1` over
  the four BRN-0017 failure question IDs in their original order.
- Read each cell only from the sealed BRN-0017 transcript bundle and select
  its exact last request. Permit only one byte-level treatment: replace
  `model: "gpt-5.6-luna"` with `model: "gpt-5.6-sol"`. Preserve the exact
  low reasoning, Standard/default service, `store: false`, 512-token limit,
  instructions, input items, tool declarations, and tool choice.
- Rehash the BRN-0017 terminal manifest, all selected transcript files, the
  generated frozen requests, the clean canonical cut, predictions, launcher,
  and absent result before credential or provider access.
- Before the four cells, make one tiny unrelated compatibility request using
  Sol/low/Standard/no-store. A failure seals the identity and stops before the
  frozen cells. No retry or alternate model is allowed.
- Parse either plain output text or the exact `palari_answer_commit` function
  payload already required by each frozen request. Record raw output, latency,
  usage, and spend. Do not call a benchmark judge or derive an official score.
- Report the four acceptance-test observations as diagnostics only: whether
  Phone mentions the existing power bank; whether Instant Pot and Tokyo
  correctly refuse to invent facts absent from their delivered spans; and
  whether Miami combines the returned view and balcony-hot-tub evidence.

## Out Of Scope

- No product code, prompt, retrieval, ranking, memory, graph, reducer, dataset,
  question, evidence, context, tool, effort, output-limit, or historical result
  change. No official judge, reroll, regrade, publication, or U8 access.
- No claim that this four-row answer-only diagnostic estimates general-user
  accuracy. No benchmark-derived production rule.
- No provider or credential access until FINAL predictions, a pushed freeze,
  fresh independent review, and an exact founder-confirmed fresh/cumulative
  cap. Existing API-key reuse permission does not itself authorize spend.

## Acceptance Criteria

1. Offline verification proves every replay request is byte-identical to the
   selected sealed request except for the exact Luna-to-Sol model replacement;
   all hashes, lineage, caps, and absent one-shot result are bound before use.
2. P-set 29 is FINAL before credential access. It predicts the five-call
   compatibility/completion boundary, all four answer outcomes, and exact
   accounting behavior, failing categories first.
3. A fresh independent reviewer confirms the one-field treatment, lack of
   answer leakage/tuning, correct one-shot/cap/meter/seal behavior, and no
   mutation of any BRN-0017 artifact before founder GO is requested.
4. After exact founder authorization, one invocation either seals the
   compatibility failure or executes all four frozen cells once. Every
   physical request is durably reserved before transport and no request is
   retried, resumed, replaced, or selectively repeated.
5. `STATUS.md` records all raw outcomes, latency, usage/spend, prediction
   grades, and the explicit conclusion about answer-model versus evidence-
   delivery failures. The historical BRN-0017 6/10 remains unchanged.

## Ticket Completion Contract

### Definition Of Done

- One sealed, non-rerunnable, answer-only Sol diagnostic exists or a terminal
  pre-cell compatibility failure is honestly recorded.
- The result determines only what a stronger answer model can do with the
  already delivered contexts; it grants no architecture acceptance by itself.

### Expansion Rules

- If the exact replay body is not accepted cross-tier, stop and record the
  compatibility finding. Do not flatten, rewrite, summarize, or otherwise
  manufacture a replacement context inside this identity.
- Architecture implementation, post-change comparison, and judged telemetry
  belong to successor product/evaluation tickets and cannot be folded into
  this pre-change baseline.

## Verification

- `node /home/quetza/palari-brain-private/stronger-answer-frozen-four-live-launcher.mjs --verify`
- `npm test`
- `npm run quickstart`
- `npm run ticket -- check BRN-0018`
- `git diff --check main...HEAD`

## Stop Conditions

- Stop if the work needs a path outside `allowed_paths` or touches `forbidden_paths`.
- Stop before any credential/inference/provider access until the exact frozen
  identity and fresh/cumulative cap receive founder authorization.
- Any compatibility, meter, cap, provider, parse, artifact, or seal failure is
  terminal for this identity and authorizes no retry or replacement.

## Offline Freeze Evidence

- P-set 29 is FINAL before any credential read, provider dispatch, inference,
  result creation, or spend.
- Private launcher is mode 0600 at SHA-256
  `4ce861485511aa19dd77893218aded59c0f7dc8cedf05a94357786cb3ab4ffdf`.
  `--verify` passes, rehashes all 74 BRN-0017 manifest artifacts and all four
  exact source/replay request hashes, proves each treatment changes only
  `model`, snapshots requests before smoke, and confirms the one-shot result
  namespace is absent. The run path must additionally verify the exact clean
  pushed/reviewed authority commit, its committed P-set, frozen target main,
  and this preregistered launcher hash before reading the key.
- Opening spend is `$7.17192994`; `$0.50` fresh / `$7.67192994` cumulative are
  proposed boundaries only. No live authority has been consumed.
- Full suite passes 722 / fails 0 / skips 3 across 725 tests; quickstart passes
  6/6; ticket lint and target-aware whitespace checks pass.

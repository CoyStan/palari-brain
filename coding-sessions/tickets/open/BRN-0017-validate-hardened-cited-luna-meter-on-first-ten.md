---
id: BRN-0017
title: "Validate hardened cited Luna meter on first ten"
stream: evaluation
level: 1
parent_id: 
root_id: BRN-0017
children: []
status: claimed
risk: R3
priority: P0
agents_allowed: 1
claimed_by: "quetza"
claimed_at: 2026-08-04T06:43:35Z
target_branch: "main"
branch: "ticket/BRN-0017-validate-hardened-cited-luna-meter-on-first-ten"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0017-validate-hardened-cited-luna-meter-on-first-ten"
allowed_paths:
  - "evals/predictions.md"
  - "STATUS.md"
  - "docs/DECISIONS.md"
  - "coding-sessions/tickets/open/BRN-0017-*.md"
  - "coding-sessions/tickets/closed/BRN-0017-*.md"
  - "coding-sessions/reports/BRN-0017-*.md"
  - "coding-sessions/human-report/BRN-0017-*.md"
  - "coding-sessions/handoffs/BRN-0017-*.md"
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
  - "node /home/quetza/palari-brain-private/luna-ettin-cited-first10-v2-live-launcher.mjs --verify"
  - "npm test"
  - "npm run quickstart"
created: 2026-08-04
updated: 2026-08-04
---

# BRN-0017 Validate hardened cited Luna meter on first ten

## Goal

Run one fresh causal successor to terminal BRN-0015 after the independently
accepted BRN-0016 meter repair. Preserve the exact first-ten product/eval
surface, prove all three Luna answer wires pass the hardened metered boundary,
and record one official result without reroll, regrade, answer tuning, or
publication.

## Scope

- Freeze identity `j4-luna-ettin-cited-first10-v2` from accepted main
  `232bfe2`, with the same ten ordered non-U8 questions, dataset, Gemini
  embedder, native Ettin, Luna low/Standard/no-store answer model, official
  judge, prompts, limits, serial order, and four-memory-call ceiling as BRN-0015.
- The only treatment is accepted BRN-0016's tracked exact answer-wire validator
  inside a fresh private mode-0600 one-shot meter. No product answer behavior
  or question content changes.
- Rehash every terminal predecessor, exact product/eval/runtime/model/dataset
  input, and absent result before any credential or inference access.
- Pre-register failing-first predictions before dispatch. Within one invocation,
  run provider-free Ettin smoke and fake three-wire meter smoke, then one live
  cited compatibility smoke. Proceed through questions 1-10 only if all pass.
- Reserve every physical Gemini/Luna/judge call before transport, seal every
  terminal outcome, retain measured versus uncertain spend, and record results
  whatever they are.

## Out Of Scope

- No mutation, resume, rerun, regrade, or deletion of BRN-0015; no U8; no
  known answer/label/prior response in runtime logic; no answer-specific rule.
- No product, prompt, model, effort, embedder, reranker, judge, dataset, order,
  question, candidate-limit, retry, or memory-call change.
- No provider/credential access or spend before FINAL predictions, a complete
  pushed freeze, clean independent pre-dispatch review, and a new exact founder
  cap. Prior authority is consumed and cannot be reused.
- No publication or claim that ten inspected questions estimate unseen users.

## Acceptance Criteria

1. Offline verification binds all tracked/private bytes, terminal lineage,
   exact dataset/order/model/runtime, new one-shot seal, U8 exclusion, opening
   ledger, proposed caps, and absent result without reading credentials.
2. The private meter imports the exact BRN-0016 validator and pins the full
   normal/forced tool hashes, actual tool order, model/common fields, and 512
   output limit. Fake normal/none/forced paths validate before reserve/fetch.
3. Fresh independent review confirms sole treatment, no known-answer tuning,
   complete metering, fail-closed caps/seal, and one-shot consumption before
   founder authority is requested.
4. After exact founder GO, one invocation either seals a smoke failure or
   completes the ten ordered answer/judge cells unless a terminal provider/cap
   boundary stops the suffix. No retry, resume, reroll, or regrade follows.
5. `STATUS.md` records exact score/partial outcome, commitment/retrieval/rerank
   telemetry, calls, spend, seal, prediction grades, and product stop rule.

## Verification

- `node /home/quetza/palari-brain-private/luna-ettin-cited-first10-v2-live-launcher.mjs --verify`
- `npm test`
- `npm run quickstart`
- `npm run ticket -- check BRN-0017`
- `git diff --check`

## Stop Conditions

- Stop if the work needs a path outside `allowed_paths` or touches `forbidden_paths`.
- Stop before any credential/inference/provider access until a new exact cap is
  confirmed for the fully frozen identity.
- Any smoke, meter, cap, provider, artifact, or seal failure is terminal; record
  it without repair or replacement inside the consumed identity.

## Offline Freeze Evidence

- P-set 28 is FINAL before any credential read, inference, provider dispatch,
  result creation, or spend.
- Private launcher/runtime are mode 0600 with SHA-256
  `a14284952f5004f80dc9dc7cb8e5bcb5e15cf31d88752ec1916c1ea9ca0d7387`
  and `5c72c1c62612e9f2963e9b664fdf47ee02a941a39ec61b57548afea51c09da32`.
- Offline verification binds the accepted product cut, clean canonical
  administrative commit, twelve terminal predecessors / 328 artifacts,
  dataset and ordered non-U8 population, seven Ettin artifacts, complete local
  runtime closure, and absent result identity.
- Product-generated normal, plain-terminal, and forced-commit bodies passed the
  exact validator before three fake reservations and three fake dispatches.
  Credential reads, provider calls, inference, and spend were all zero.
- Opening spend is `$6.40824561`; `$1.50` fresh / `$7.90824561` cumulative are
  proposed boundaries only. The prior BRN-0015 authorization is consumed and
  cannot authorize this identity.

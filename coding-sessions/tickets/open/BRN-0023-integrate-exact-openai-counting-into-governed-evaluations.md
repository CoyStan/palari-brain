---
id: BRN-0023
title: "Integrate exact OpenAI counting into governed evaluations"
stream: evaluation
level: 1
parent_id:
root_id: BRN-0023
children: []
status: in-review
risk: R3
priority: P0
agents_allowed: 1
claimed_by:
claimed_at:
target_branch: "main"
branch: "ticket/BRN-0023-integrate-exact-openai-counting-into-governed-evaluations"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0023-integrate-exact-openai-counting-into-governed-evaluations"
allowed_paths:
  - "evals/openai-counted-responses.mjs"
  - "evals/openai-input-reservation.mjs"
  - "tests/openai-counted-responses.contract.test.mjs"
  - "tests/openai-input-reservation.contract.test.mjs"
  - "evals/predictions.md"
  - "docs/EVALUATION-HARNESS.md"
  - "docs/DECISIONS.md"
  - "STATUS.md"
  - "coding-sessions/tickets/open/BRN-0023-*.md"
  - "coding-sessions/tickets/closed/BRN-0023-*.md"
  - "coding-sessions/reports/BRN-0023-*.md"
  - "coding-sessions/human-report/BRN-0023-*.md"
  - "coding-sessions/handoffs/BRN-0023-*.md"
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
  - "node --test tests/openai-counted-responses.contract.test.mjs tests/openai-input-reservation.contract.test.mjs tests/openai-input-count-probe.contract.test.mjs"
  - "npm test"
  - "npm run quickstart"
created: 2026-08-06
updated: 2026-08-06
---

# BRN-0023 Integrate exact OpenAI counting into governed evaluations

## Goal

Add one reusable, provider-neutral evaluation boundary that counts the exact
structured OpenAI Responses body before generation, derives a pinned Standard
reservation for Luna or Sol from the validated provider count, and proves the
reservation is durably accepted before the one generation dispatch. This is
offline integration work only; it must not contact a provider or alter product
answer behavior.

## Scope

- Extend the accepted BRN-0021 reservation primitive with explicit
  `gpt-5.6-luna` Standard short/long-context policies while preserving the
  existing Sol contract. Pin the 2026-08-06 official rates and retain the
  highest safe input/cache-write rate plus full output ceiling.
- Add `evals/openai-counted-responses.mjs`. It snapshots one exact Responses
  body, consumes a unique caller operation ID, durably reserves an explicit
  unknown-billing count-attempt allowance, invokes one injected count
  transport, validates the documented response, durably reserves the exact
  Luna/Sol generation ceiling, and only then invokes one injected generation
  transport with byte-equivalent input.
- The boundary is reusable across operations but every operation ID is
  single-use from before the first reservation. Count failure, validation
  failure, cap/reservation rejection, or generation failure is terminal for
  that ID. There is no retry, byte fallback after count dispatch, settlement,
  credential lookup, network client, filesystem, or hidden provider behavior.
- Preserve distinct accounting surfaces: the caller-supplied count-attempt
  reservation remains unknown/uncertain until an external ledger establishes
  billing; the model generation reservation is exact-count-derived and can be
  settled later from provider usage by the enclosing governed launcher.
- Add adversarial provider-free contracts for exact body equality, ordering,
  single-use identities, callback/transport failures, malformed counts,
  model/tier/output validation, Sol compatibility, Luna short/long rates,
  mutable input/callback attacks, and immutable audit metadata.
- Document that BRN-0022 established the physical wire once and is never
  rerun. Record zero provider/credential/private-result access and zero spend.

## Out Of Scope

- No live OpenAI/Gemini request, credential read, generation, embedding,
  benchmark, dataset/question selection, private launcher/result access,
  spend, or BRN-0024 invocation.
- No production transport, product latency, prompt, retrieval, memory,
  reranker, model output, judge, dataset, historical result, or public score
  change.
- No assumption that `/v1/responses/input_tokens` is free. No settlement of a
  count reservation and no caller cap policy is invented by this module.
- No support for Fast, Flex, Batch, regional pricing, Terra, aliases, or any
  unpinned model/tier. No cache-discount assumption before provider usage.
- No mutation, retry, resume, regrade, or reinterpretation of consumed
  BRN-0022 or historical BRN-0017 6/10.

## Acceptance Criteria

1. Official provenance is recorded: the count endpoint accepts the same
   structured Responses payload and returns `response.input_tokens`; pricing
   pins Luna Standard at `$0.25/$0.50` highest input/cache-write and
   `$1.20/$1.80` output per million for short/long context, while preserving
   Sol's accepted `$6.25/$12.50` and `$30/$45` policy.
2. A unique non-empty operation ID is consumed before any callback. Reuse,
   malformed body/model/tier/output ceiling, or invalid count reservation
   fails before a count or generation transport.
3. The count-attempt reservation callback completes before exactly one count
   transport. Its record binds operation ID, exact body SHA-256, model, and the
   caller's positive integer picodollar allowance without claiming billing.
4. Count transport receives the immutable exact Responses body. A failure or
   malformed response is terminal and never reaches generation, retry, or the
   UTF-8 fallback.
5. The validated provider count selects the explicit Luna/Sol Standard
   short/long band at the accepted 272,000-token threshold and reserves the
   highest safe input/cache-write rate plus the body's full
   `max_output_tokens` ceiling using integer picodollars.
6. The generation-reservation callback completes before exactly one generation
   transport. Both transports receive byte-equivalent body snapshots; a
   reservation or generation failure consumes the operation without retry.
7. Success returns immutable, non-secret audit metadata plus the untouched
   generation result. It keeps count-attempt uncertain accounting separate
   from exact model reservation and reports both physical invocation counts.
8. Provider-free tests prove ordering, equality, immutability, policy math,
   fail-closed behavior, single-use IDs, and no direct environment/network/
   filesystem imports. Existing BRN-0021/22 focused contracts remain green.
9. Full tests and quickstart pass. Historical BRN-0017 remains 6/10, consumed
   BRN-0022 remains unchanged, live/provider/credential/private access is zero,
   and an independent reviewer recommends accept, reopen, or needs-human.

## Verification

- `node --test tests/openai-counted-responses.contract.test.mjs tests/openai-input-reservation.contract.test.mjs tests/openai-input-count-probe.contract.test.mjs`
- `npm test`
- `npm run quickstart`
- `npm run ticket -- check BRN-0023`
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0023`
- `git diff --check main...HEAD`

## Stop Conditions

- Stop if the work needs a path outside `allowed_paths` or touches `forbidden_paths`.
- Stop before any credential read, network/provider call, private artifact
  access, generation, benchmark selection, or spend.
- Stop if exact counting cannot precede durable generation reservation, if
  count billing must be guessed, if caller identity/cap/seal enforcement would
  need to move into this generic boundary, or if production behavior must
  change.

## Implementation Evidence

- Added a provider-neutral exact-counted Responses evaluator with four injected
  ledger/transport boundaries and no environment, filesystem, endpoint, or
  credential ownership.
- Added Luna short/long Standard policies while preserving the accepted Sol
  API and UTF-8 fallback behavior.
- P-set 33 focused contracts pass 33/33, including exact preregistered Luna and
  Sol amounts, ordering, one-shot identities, immutable bodies/audit records,
  malformed response, cap stop, and transport failure paths.
- Official provenance:
  <https://developers.openai.com/api/docs/guides/token-counting> and
  <https://developers.openai.com/api/docs/pricing>.
- Provider, credential, private-result, benchmark, generation, and spend
  activity: zero. Historical BRN-0017 remains 6/10; BRN-0022 remains consumed.
- Full suite passes 772 / skips 15 / fails 0 across 787. Quickstart passes 6/6;
  ticket, report, governed scope, syntax, and diff checks pass.

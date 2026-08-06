# BRN-0023 Technical Report

## Outcome

Implemented an offline, reusable exact-counted OpenAI Responses evaluation
boundary. It freezes one body, reserves a distinct unknown-billing count
attempt, invokes one injected count, calculates a pinned Luna/Sol Standard
generation ceiling, reserves it, and invokes one injected generation call.
Every operation ID is consumed before callbacks and no failure retries.

## Files Changed

- `evals/openai-input-reservation.mjs`: Luna Standard short/long policies and
  model-explicit exact reservation while preserving the Sol API.
- `evals/openai-counted-responses.mjs`: ordered counted evaluation boundary.
- `tests/openai-input-reservation.contract.test.mjs` and
  `tests/openai-counted-responses.contract.test.mjs`: provider-free policy,
  ordering, immutability, and terminal-failure contracts.
- Evaluation docs, decisions, status, ticket, and P-set 33 evidence.

## Verification

- Focused provider-free contracts: PASS, 36/36.
- Syntax checks: PASS.
- Full suite: PASS, 775 passed / 15 skipped / 0 failed across 790.
- Quickstart: PASS, 6/6.
- Ticket, report, governed committed-plus-dirty scope, syntax, and diff checks:
  PASS.
- Credential reads, provider/network calls, generation, private-result reads,
  benchmark access, and spend: zero.

Initial independent review of pushed head `4ce75aa` reopened the ticket for
three adversarial findings. Mutable Hash prototype methods could forge the
body digest, mutable `RegExp.prototype.test` could admit a signed allowance,
and the operation-ID ceiling counted JavaScript code units instead of UTF-8
bytes. The cumulative repair captures the relevant trusted intrinsics before
callbacks and permanently tests a valid-looking forged digest, `+1`, and a
300-byte multibyte identifier. Fresh cumulative review remains required.

## Risks / Follow-Ups

- Input-count billing remains undocumented. A live launcher must choose and
  durably account an explicit per-attempt uncertainty allowance.
- BRN-0024 needs a separate frozen identity, unseen selection, complete private
  launcher closure, numeric caps, independent pre-dispatch review, and exact
  founder authority before any live call.

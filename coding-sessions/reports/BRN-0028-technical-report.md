# BRN-0028 Technical Report

## Files Changed

- `evals/openai-input-reservation.mjs` co-locates measured Standard rates with
  the pinned Luna/Sol reservation policies and derives reservation cents from
  those policy objects.
- `evals/openai-standard-usage.mjs` is the one pure fail-closed settlement
  boundary for public `short`/`long` bands.
- `tests/openai-standard-usage.contract.test.mjs` permanently reproduces the
  sanitized v3 HTTP-200 usage and malformed/legacy cases.
- P-set 38, harness/decision docs, status, governed reports, and the private v4
  freeze record the offline successor and founder gate.

## Canonical Settlement

The helper accepts only `gpt-5.6-luna` or `gpt-5.6-sol`, `short` or `long`,
and the exact plain Responses usage shape. It validates 2,142 input, 2,139
cache-write, zero cached, 40 output, 8 reasoning, and 2,182 total tokens for
the sanitized v3 fixture. Luna short Standard settlement is exactly
476,400,000 picodollars = `$0.0004764`. Legacy `shortContext` and
`longContext` fail before settlement.

## Frozen Runtime Evidence

Private v4 launcher/runtime hashes, closure, and actual provider-free execution
evidence will be filled after the tracked implementation is clean and pushed.
No credential, selected dataset, provider, result namespace, or spend is
permitted by this ticket.

## Verification

- Focused contracts: pending final cumulative run.
- Full suite: pending final cumulative run.
- Quickstart: pending final cumulative run.
- Private v4 `--verify`: pending clean pushed tracked cut.
- Governance/scope/diff checks: pending final cumulative run.

## Risks / Follow-Ups

Provider-free checks establish plumbing, not live acceptance or memory quality.
The v4 identity has no authority. Independent review must bind exact pushed
tracked and private bytes before any separate founder-gated invocation.

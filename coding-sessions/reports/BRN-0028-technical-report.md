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

New gitignored private artifacts are exact mode 0600:

- launcher SHA-256:
  `db388a28bf9568d869bda4bad011a0103f88b08b871ec3bdb65de4940fd70a02`;
- runtime SHA-256:
  `83c2efe7324a3a10f432c8ce1844abff561207d95460621cdb4b064d7db93053`.

Actual generated-runtime provider-free execution passed cached Ettin with
titanium first and four finite scores; the exact 11,488-byte projected count
and untouched 11,593-byte generation fake wires; the exact sanitized usage
settlement; durable one-shot custody/reuse refusal; an eight-entry nested seal,
verification, and reseal refusal; and cleanup. Telemetry was zero credential
reads, dataset reads, provider calls, and result writes. Both v4 namespaces
remain absent.

The static import closure is 50 files / 749,556 bytes / SHA-256
`616b66acf64a62c8990c9bf26ef51a1d78eb3a671161f65599c47b460855102b`.
The exact paired body hashes remain
`d77ba2aaa9521a0c3445ca73e1112955e7bc26fd5eb61a1dd5dd7ce76561838d`
and
`978a57073547d04b61d5b0813e5db2faef797cc33b6a477b047d1eded41850d8`.
All six v1-v3 launcher/runtime hashes and complete result-tree snapshots
(6/21/24 entries) rehashed identically before and after verification. P-set 37
and its `$0.0011499` uncertain Luna reservation remain unchanged.

## Verification

- Focused contracts: PASS, 31/31.
- Full suite: PASS, 802 passed / 15 optional skipped / 0 failed across 817.
- Quickstart: PASS, 6/6.
- Private v4 `--verify`: PASS with exact settlement, cached Ettin, paired fake
  wires, custody, recursive seal, cleanup, predecessor immutability, absent
  namespaces, and zero telemetry.
- Private syntax, modes, hashes: PASS.
- Governance/scope/diff checks: PASS before final lifecycle transition.

## Risks / Follow-Ups

Provider-free checks establish plumbing, not live acceptance or memory quality.
The v4 identity has no authority. Independent review must bind exact pushed
tracked and private bytes before any separate founder-gated invocation.

# BRN-0028 Reviewer Note

Reviewer: `/root/brn0028_reviewer` — fresh independent read-only agent
Reviewed commit(s): `474b84d29d4fe8dd995cb793266697ba777c128d`
Target branch: `main` at `7a8d1fcd4c64d4138692088123b8e5d13603d8e0`

## Review Result

Pass. The clean pushed implementation provides one fail-closed OpenAI Standard
usage-settlement boundary, permanently reproduces the BRN-0026 HTTP-200
settlement failure offline, and freezes exact provider-free v4 bytes. This
review grants no live invocation.

## Findings

- P0: none.
- P1: none.
- P2: none.
- P3: none.

## Verification Reviewed

- Read `AGENTS.md`, the complete reviewer packet, ticket contract, committed
  diff, technical report, human report, handoff, changed source/tests, and the
  permitted private v4 launcher/runtime.
- Confirmed exact clean pushed HEAD and upstream:
  `474b84d29d4fe8dd995cb793266697ba777c128d`.
- Confirmed all 11 committed paths are within `allowed_paths`; no forbidden
  path changed.
- Independently reproduced the sanitized BRN-0026 usage: 2,142 input tokens,
  2,139 cache-write tokens, zero cached tokens, 40 output tokens, 8 reasoning
  tokens, and 2,182 total tokens settle for Luna Standard `short` to
  476,400,000 picodollars = `$0.0004764`. Cache-write is validated as a subset
  of input and is not double-charged.
- Confirmed the helper accepts exactly public `short` / `long`, rejects legacy
  `shortContext` / `longContext`, unknown models, extra or malformed usage
  fields, inconsistent totals/cache/reasoning relationships, accessors,
  proxies, and caller mutation.
- Confirmed Luna/Sol short/long measured rates come from the same deep-frozen
  pinned policy objects used by reservations; conservative reservation math
  and public-band output remain unchanged.
- Confirmed the actual v4 runtime imports `settleOpenAIStandardUsage(...)`; no
  duplicated ad-hoc OpenAI answer-price table or fallback settlement remains.
- Reverified mode-0600 private launcher/runtime hashes as
  `db388a28bf9568d869bda4bad011a0103f88b08b871ec3bdb65de4940fd70a02`
  and
  `83c2efe7324a3a10f432c8ce1844abff561207d95460621cdb4b064d7db93053`.
- Independently ran the actual private launcher `--verify`: PASS. It executed
  cached Ettin with titanium first and four finite scores; exact 11,488-byte
  projected count and untouched 11,593-byte full-generation fake wires; exact
  `$0.0004764` settlement; durable reserved/launched/consumed custody with
  reuse refusal; eight-entry nested seal with reseal refusal; cleanup; and zero
  credential reads, dataset reads, provider calls, or result writes.
- Confirmed count/generation hashes remain
  `d77ba2aaa9521a0c3445ca73e1112955e7bc26fd5eb61a1dd5dd7ce76561838d` /
  `978a57073547d04b61d5b0813e5db2faef797cc33b6a477b047d1eded41850d8`.
- Recomputed the static import closure as 50 files / 749,556 bytes / SHA-256
  `616b66acf64a62c8990c9bf26ef51a1d78eb3a671161f65599c47b460855102b`
  at the reviewed head.
- Confirmed all six v1-v3 launcher/runtime hashes and complete predecessor
  result-tree snapshots (6/21/24 entries) were identical before and after
  verification.
- Confirmed both v4 result and semantic-review namespaces remain absent, FINAL
  P-set 38 binds the unchanged P-set 37 population/order, opening
  `$7.90712669`, proposed `$5.00` fresh / `$12.90712669` cumulative caps, U8
  exclusion, and historical `6/10` without retroactively settling v3's
  `$0.0011499` uncertain reservation.
- Focused contracts: PASS — 31/31.
- `npm test`: PASS — 802 passed, 15 skipped, 0 failed across 817.
- `npm run quickstart`: PASS — 6/6.
- Committed-plus-dirty scope check: PASS — 11 governed paths.
- `git diff --check`: PASS.
- The pre-note `npm run ticket -- check BRN-0028` passed scope validation and
  reported only the expected missing reviewer-note file; rerun it after this
  note.
- No credential was read, no selected benchmark content was inspected, no
  result namespace or private predecessor was mutated, and no network/provider
  call was made.

## Required Changes

- none.

BRN0025_REVIEW_IDENTITY: j4-luna-ettin-unexecuted11to20-v4

BRN0025_REVIEW_LAUNCHER_SHA256: db388a28bf9568d869bda4bad011a0103f88b08b871ec3bdb65de4940fd70a02

BRN0025_REVIEW_RUNTIME_SHA256: 83c2efe7324a3a10f432c8ce1844abff561207d95460621cdb4b064d7db93053

BRN0025_REVIEW_RECOMMENDATION: ACCEPT

## Recommendation

Recommend `accept`. This recommendation applies only to the offline BRN-0028
implementation and frozen v4 evidence; it does not accept or merge the ticket
and grants no credential read, provider request, result namespace, spend,
retry, score, or live authority.

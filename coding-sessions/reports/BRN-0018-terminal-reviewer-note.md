# BRN-0018 Terminal Reviewer Note

## Review Result

Fresh independent terminal review of exact clean pushed result head
`410bc99a7f9475841291b1223bfdf85d56c359e4` against target `main` at
`f736a1b8511f0ef1609b407e6b13f3da3b968710` found no P0, P1, P2, or P3
issue and recommends **ACCEPT / GO**. The private result is immutable; this
recommendation does not authorize a rerun, regrade, provider call, or result
mutation.

## Findings

None.

The measured Sol final-turn treatment passes phone answer use and Instant Pot
evidence limitation, but fails Tokyo evidence limitation and Miami answer use.
The resulting P-set 29 outcome is therefore ANSWER USE 1/2 FAIL, EVIDENCE
LIMIT 1/2 FAIL, COMPATIBILITY / COMPLETION PASS, CAUSAL INTEGRITY PASS, and
EXECUTION / ACCOUNTING PASS. The ticket evidence preserves the historical
BRN-0017 6/10 result without regrading it and accurately limits the causal
claim: Sol received the frozen Luna reasoning and tool trajectory, so this is
not a pure end-to-end Sol measurement.

## Independent Reconciliation

- Rehashed all 14 sealed result artifacts at exact mode 0600, with no missing
  or extra artifact; the result directory is mode 0700. Manifest SHA-256:
  `6c9ab17351d8f09c1b714d33bb8fe34e468d25a8cdf0397d4dc9794c5dcba725`.
  The terminal report hash matches the sealed terminal pointer, credential
  matches are zero, and sealing errors are absent.
- Rehashed all 74 BRN-0017 source artifacts and independently confirmed source
  manifest SHA-256
  `850ca10026e7800dcaaa69eab482561d4eb0fe5db17e1a05b6fdb361a5959ebe`.
  For every selected frozen transcript, restoring model `gpt-5.6-luna`
  produces the source request exactly; the sole treatment field is the model.
- Confirmed freeze authority commit
  `71e6ca56908485520210a90edbc3307230c93475`, launcher SHA-256
  `a7c91b99ec38572093e88548c526710592c02a3c008ca81984b1aac2fb472c46`,
  and prediction-file SHA-256
  `85779c4a5fc8ef7f9a15cc82774ac396ee1ef9b66fa18d3862c1bd2c544941bf`.
  The authority commit is an ancestor of the result head.
- Reconciled exactly five completed HTTP 200 calls: one compatibility call and
  four frozen-context answer calls. Reservations are `$0.02 + 4 * $0.12 =
  $0.50`; report and meter agree on `$0.50` fresh and `$7.67192994`
  cumulative accounted spend. No retry, reroll, new memory call, or judge call
  exists.
- Independently summed 26,775 input, 1,326 output, 322 reasoning, and 28,101
  total tokens; cache-write input is 24,942 and cached input is 1,554. Total
  latency is 29,281.3 ms and mean latency is 5,856.26 ms. Every request-body
  hash and stored response matches its sealed wire artifact.
- Confirmed all four answer commitments equal their stored answers; every
  basis ID maps to returned evidence and every basis quote is exact contiguous
  evidence. Phone explicitly uses the existing power bank. Instant Pot
  correctly abstains because the original Instant Pot statement is absent.
  Tokyo uses only returned prior-Palari statements instead of declaring the
  evidence insufficient. Miami receives both view and balcony-hot-tub user
  evidence but materially uses only the view.

## Verification Reviewed

- `npm run ticket -- ticket-lint BRN-0018`: pass.
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0018`:
  pass; all result-head changes are confined to six allowed tracked paths.
- `git diff --check`: pass.
- `npm run quickstart`: 6/6 pass.
- `npm test`: 710 pass, 0 fail, 15 optional skips across 725 tests.
- No credential or `.env` was read, no provider was invoked, and neither the
  launcher `--run` nor `--verify` path was executed during terminal review.

## Required Changes

None.

## Recommendation

Accept the immutable BRN-0018 measurement record and merge through the
founder-authorized governed flow. Do not rerun or regrade this identity.

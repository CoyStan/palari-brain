# BRN-0024 Technical Report

## Outcome

Prepared a provider-free, one-shot held-out Luna+Ettin evaluation freeze. No
credential, provider, inference, or result namespace was accessed. Live use
remains blocked on independent review and exact founder authority.

## Files Changed

- S60 ordinals 11-20 only; metadata selected without content inspection; U8
  excluded.
- Accepted BRN-0019 planning/commitment/temporary-inference architecture and
  BRN-0023 exact-counted Luna transport are the only causal treatments over
  the accepted BRN-0017 evaluation path.
- Provider-free Ettin/meter gates, one metered Gemini writer smoke, and one
  counted Luna answer/tool/commit smoke precede the ten serial cells.
- Every row seals raw retrieval, plan, commitments, temporary inferences,
  Ettin telemetry, answer, official label, and five non-aliased evidence
  metrics. Judged equivalent/material-use records begin pending/null.

## Custody And Accounting

- Identity: `j4-luna-ettin-heldout11to20-v1`.
- Opening: `$7.80502179`; proposed fresh/cumulative caps: `$5.00` /
  `$12.80502179`.
- Every Luna operation keeps a `$0.05` count allowance uncertain, then derives
  its generation ceiling from the exact count. No retry or byte fallback.
- Launcher/runtime SHA-256: `75898b47...e7cc3` / `69bec48f...ebc1`, both mode
  0600. Result namespace is absent.

## Verification

- Launcher and generated runtime syntax: PASS.
- Private `--verify`: PASS; three fake exact-counted wire modes, 12 ordered
  events, zero providers/spend.
- Invalid authority refusal before result creation: PASS.
- Full tests: PASS, 775 passed / 15 optional skips / 0 failed across 790.
- Quickstart: PASS, 6/6. Ticket, report, committed-plus-dirty scope, syntax,
  and diff checks: PASS. Independent pre-dispatch review remains pending.

## Risks / Follow-Ups

Input-count billing remains undocumented, so the full allowance stays
uncertain. The `$5.00` cap is intentionally conservative. No live action is
authorized until a reviewer accepts the exact pushed freeze and the founder
names the identity plus `$5.00` fresh / `$12.80502179` cumulative caps.

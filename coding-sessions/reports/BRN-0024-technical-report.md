# BRN-0024 Technical Report

## Outcome

Prepared a provider-free, one-shot held-out Luna+Ettin evaluation freeze. No
credential, provider, inference, or result namespace was accessed. Live use
is blocked by independent review and a founder-level population/claim choice.

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

Independent review of `f015ac0` found that authority does not bind the
cumulative cap/reviewed freeze, long-context settlement uses short-context
rates, operation-ID custody is evaluator-local rather than run-wide, and the
semantic-label overlay lacks append-once reviewer provenance. Those are
offline-repairable.

The founder-level issue is that all ten cells are unexecuted, but tracked
P-set 20 already profiled their content-derived retrieval difficulty. The
freeze therefore cannot truthfully call them genuinely uninspected. No live
action is authorized until the founder chooses whether to retain and relabel
this population or select a new one, all technical defects are repaired, and
a fresh reviewer accepts the resulting exact pushed freeze. Input-count
billing remains undocumented, so the full allowance stays uncertain.

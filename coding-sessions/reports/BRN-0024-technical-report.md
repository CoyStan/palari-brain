# BRN-0024 Technical Report

## Outcome

Prepared a provider-free, one-shot Luna+Ettin freeze for a never-executed,
previously profiled population. The founder resolved the prior claim blocker
by approving that honest relabel. No credential, provider, inference, or
result namespace was accessed. Live use remains blocked on fresh review and
exact authority.

## Files Changed

- S60 ordinals 11-20 only; never executed, prior P-set 20 profiling disclosed,
  no new content inspection or row-specific route, U8 excluded.
- Accepted BRN-0019 planning/commitment/temporary-inference architecture and
  BRN-0023 exact-counted Luna transport are the only causal treatments over
  the accepted BRN-0017 evaluation path.
- Provider-free Ettin/meter gates, one metered Gemini writer smoke, and one
  counted Luna answer/tool/commit smoke precede the ten serial cells.
- Every row seals raw retrieval, plan, commitments, temporary inferences,
  Ettin telemetry, answer, official label, and five non-aliased evidence
  metrics. Judged equivalent/material-use records begin pending/null.

## Custody And Accounting

- Identity: `j4-luna-ettin-unexecuted11to20-v1`; prior stronger-claim identity
  `j4-luna-ettin-heldout11to20-v1` is abandoned unconsumed.
- Opening: `$7.80502179`; proposed fresh/cumulative caps: `$5.00` /
  `$12.80502179`.
- Every Luna operation keeps a `$0.05` count allowance uncertain, then derives
  its generation ceiling from the exact count. No retry or byte fallback.
- Launcher/runtime SHA-256: `2ffb3d7a...8459` / `b49c6f8c...ca81`, both mode
  0600. Result namespace is absent.

## Verification

- Launcher and generated runtime syntax: PASS.
- Private `--verify`: PASS; three fake exact-counted wire modes, 12 ordered
  events, exact short/long settlement, duplicate global operation rejection,
  20-label overlay schema, first seal/reseal refusal/original-manifest custody,
  zero providers/spend.
- Invalid authority refusal before result creation: PASS.
- Full tests: PASS, 775 passed / 15 optional skips / 0 failed across 790.
- Quickstart: PASS, 6/6. Ticket, report, committed-plus-dirty scope, syntax,
  and diff checks: PASS. Independent pre-dispatch review remains pending.

## Risks / Follow-Ups

Independent review of `f015ac0` found that authority did not bind the
cumulative cap/reviewed freeze, long-context settlement used short-context
rates, operation-ID custody was evaluator-local rather than run-wide, and the
semantic-label overlay lacked append-once reviewer provenance. All four are
repaired in the new freeze.

The founder approved retaining the never-executed population while disclosing
P-set 20's prior profiling. P-set 34 remains immutable and abandoned; P-set 35
owns the replacement identity. No live action is authorized until a fresh
reviewer accepts the exact pushed freeze and the founder binds its exact
identity, caps, head, private hashes, and ACCEPT state. Input-count billing
remains undocumented, so the full allowance stays uncertain.

Review of `a8b8ae8` reopened a P0 because caller-supplied ACCEPT was not backed
by an ACCEPT disposition in the tracked reviewed note, and a P1 because runtime
`--verify` called `preflight()` and parsed selected session content before
authority. Prior executions exposed only aggregate counts to humans and caused
no content-driven change. The second repair requires exact tracked disposition
and identity markers and makes runtime verification synthetic-only. `strace`
confirms it does not open the dataset; authorized `--run` retains the one
content-parsing preflight after attempt consumption.

# Evaluation and diagnostics

This directory contains reusable, provider-free diagnostics for the active
Palari Brain product. None of it is required by an installed package.

## Active tools

| Command | Purpose |
| --- | --- |
| `npm run alpha:debug -- --adapter <module> --max-dollar <cap>` | Run injected alpha cases with explicit retry and aggregate-cost limits. |
| `npm run answer-interpretation-regression` | Exercise speaker, chronology, and answer-composition boundaries without grading prose. |
| `npm run memory-stage-audit -- --input <local.json>` | Classify observed write, retrieval, composition, utilization, ambiguity, or success stages. |
| `npm run scale-probe` | Measure deterministic canonical-journal recall at larger local volumes. |
| `npm run reranker-bakeoff` | Verify the generic reranker against the small frozen local bank. |
| `npm run ettin-bakeoff` | Verify the optional native Ettin adapter against the same bank. |

Supporting modules provide the content-addressed embedding cache, rolling
request pacer, retrieval-evidence metrics, and the small reranker fixture.

The scale probe reports an assumption-labelled lifetime-token envelope before
measuring ingest, steady-state SQLite bytes per message, and median/p95 recall
latency. Use `npm run scale-probe -- --tiers 50,500,2500` for an independently
created database at each turn count, `--lifetime-tokens <count>` to change the
analytical envelope, or `--embedder <module>` to include the optional semantic
surface. `--synthetic-vectors <dimensions>` instead exercises semantic index
size, bounded catch-up call count, and brute-force query latency without a
provider; its planted equivalence vectors validate plumbing, not embedding
quality. A tiered run is a repeatable local diagnostic, not an extrapolated
benchmark grade.

Diagnostics may write only to caller-selected temporary paths or gitignored
`.palari-alpha/` state. They are not benchmark grades. Any paid provider call
still requires a founder-approved aggregate dollar cap, and sealed U8 question
`1568498a` must never be executed.

The J3/J4 live identities, v0.5 comparison arms, predictions, custody meters,
and terminal artifacts shipped with the first alpha remain recoverable from
annotated release tag `v0.1.0-alpha.1`; they are intentionally absent from the
active checkout.

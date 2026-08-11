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
| `npm run scale:locator-quality -- --max-dollar <cap> --price-per-million <price>` | Cache one capped OpenAI embedding pass, then compare private locator quality offline. |
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
quality. `--scan-dimensions 384,768,1536` runs that same real exact-search
surface for every requested tier and dimension. It reports raw Float32 bytes,
component visits, and the first measured cardinality crossing the explicit
`--scan-p95-budget-ms` review assumption (100 ms by default). That budget is
not a product SLO, and the lifetime-token arithmetic never extrapolates
latency. Add `--derived-locator` to that dimension matrix for the private
SCALE-04 comparison. The evaluation-only sparse sign sketch returns scoped
candidate IDs, rereads their canonical vectors, and exact-ranks only that
shortlist. It reports planted-target recall, exact top-20 ID overlap, shortlist
size, build time, and logical sketch bytes. The prototype adds no dependency,
is excluded from the release package, and is not a runtime locator API or an
ANN claim. A tiered run is a repeatable local diagnostic, not an extrapolated
benchmark grade.

Diagnostics may write only to caller-selected temporary paths or gitignored
`.palari-alpha/` state. They are not benchmark grades. Any paid provider call
still requires a founder-approved aggregate dollar cap, and sealed U8 question
`1568498a` must never be executed.

SCALE-05 generates 5,000 unique fictional memory-like statements locally and
pairs 25 labeled facts with 50 human-written queries. It downloads no dataset
and stores no source text in its content-addressed cache. Run a two-input live
preflight first, review the returned rate-limit headers, then run the full pass
with conservative per-minute values. For example, after confirming the current
official price assumption:

```bash
npm run scale:locator-quality -- --preflight-only --max-dollar 1 \
  --price-per-million 0.02
npm run scale:locator-quality -- --max-dollar 1 \
  --price-per-million 0.02 --max-requests-per-minute 100 \
  --max-token-units-per-minute 30000
```

The dedicated persisted budget includes failed dispatch reservations and is
hard-capped in code at the approved $1 SCALE-05 ceiling. Embeddings are cached
by exact content hash under model and dimension namespace; locator comparison
after that pass makes no provider calls. Aggregate results stay gitignored in
`.palari-alpha/scale05-openai-result.json`. This diagnostic cannot adopt the
locator or alter package exports.

The J3/J4 live identities, v0.5 comparison arms, predictions, custody meters,
and terminal artifacts shipped with the first alpha remain recoverable from
annotated release tag `v0.1.0-alpha.1`; they are intentionally absent from the
active checkout.

# STATUS — Palari alpha

## 2026-08-11 current handoff

Release `v0.1.0-alpha.1` remains an annotated, immutable recovery tag. The
active branch has been reduced to the product kernel, useful local diagnostics,
and current documentation without rewriting Git history.

The cleanup:

- fixes the installed `palari-brain/openai` subpath by packaging its required
  `src/retrieval-plan.mjs` module;
- preserves all 140 declared public export names across six package entry
  points;
- stops shipping an unreferenced master raster and historical kernel docs;
- removes the superseded ticket/report archive, spent process contracts,
  v0.5 comparison arms, J3/J4 live-run machinery, and their dedicated tests;
- retains the reusable alpha runner, answer regression, stage audit, scale
  probe, embedding cache, request pacer, retrieval metrics, and reranker
  verification;
- leaves private datasets, result artifacts, credentials, local diagnostics,
  dependency installs, and generated native build output untouched.

The tracked checkout fell from 580 files / 7,644,715 bytes to 97 files /
2,568,292 bytes. The release tarball fell from 38 files / 1,305,932 packed
bytes to 35 files / 981,986 packed bytes. The remaining large tracked files
are current product/tests or deliberate raster brand sources; the unused
master mark is repository-only and excluded from the release package.

Post-cleanup validation passes: core 106/106, quickstart 6/6, broader
compatibility 390/390, and a clean offline tarball install imports all six
public entry points with their original export-name hashes. Static import and
local-link checks report no missing target. No provider, credential, dataset,
private result, local diagnostic, or sealed U8 item was accessed.

## 2026-08-11 engineering-debt pass

The executable quickstart already covers the complete real-user journey, so
no duplicate journey fixture was added. Instead, the largest answer module was
split at two existing responsibility seams:

- `retrieval-plan.mjs` now owns plan validation, normalization, schema, and
  planning guidance instead of re-exporting their implementation from the
  answer loop;
- `retrieval-frontier.mjs` now owns ephemeral query attempts, evidence novelty,
  bridge lineage, stagnation, and frontier snapshots;
- `retrieval-answer.mjs` remains the public-compatible orchestrator and fell
  from 137,893 to 116,093 bytes;
- bridge time bounds gained an integration regression while moving their
  shared ISO normalization; and
- `npm run package:check` now packs and installs an offline temporary consumer,
  imports all six public entries, and verifies the reviewed export-name hashes.

The active checkout will contain 99 tracked files after this unit. The tarball
contains 36 files / 982,749 packed bytes / 1,460,250 unpacked bytes. All 140
public export names remain unchanged. Final validation passes: core 106/106,
quickstart 6/6, broader compatibility 390/390, and the new package gate 6/6.
Ignored runtime state was not deleted or inspected.

## 2026-08-11 scale-readiness baseline

SCALE-01 made the existing offline scale probe useful for the 100M
lifetime-token question without changing product behavior or adding a
provider, tokenizer, ANN dependency, or release claim:

- the assumption-labelled envelope keeps units separate: 100M tokens at
  50-200 tokens per canonical message implies 500,000-2,000,000 message
  vectors, while independent 256-512-token chunks would imply
  195,313-390,625 chunk vectors;
- `--tiers` now creates a fresh database per turn count and reports ingest,
  real steady-state SQLite bytes per message, and median/p95 recall latency;
- the prior `db 0 MB` output was false because it measured the temporary
  parent directory rather than the nested workspace database; and
- `--synthetic-vectors <dimensions>` exercises vector storage, indexing, the
  current brute-force scan, and canonical ID read-back without a provider.
  Its planted equivalences are explicitly plumbing-only, not evidence of
  embedding quality.

On one repeatable local 100/1,000/5,000-message diagnostic, the 5,000-message
lexical database was 6.83 MB and lexical p95 was 4.5-6.0 ms. With the labelled
64-dimensional synthetic vector fixture it was 9.18 MB, first vector catch-up
was about 9.9 seconds, and semantic p95 was about 65-72 ms. These observations
are diagnostic evidence that query-time catch-up and full vector scanning are
the next scale boundaries; they are not production extrapolations or benchmark
grades.

Three provider-free contracts cover the envelope, actual workspace footprint,
latency tail, and synthetic semantic label. Validation passes: core 109/109,
quickstart 6/6, broader compatibility 393/393, and the offline package-install
gate imports all six public entry points with unchanged export counts.

## 2026-08-11 bounded semantic catch-up

SCALE-02 prevents the first semantic query from embedding an unbounded number
of historical rows without changing canonical admission, deleting an API, or
adding an ANN dependency:

- one semantic query indexes at most 64 missing visible rows and searches only
  when that caller's scoped vector bank is complete;
- an incomplete bank raises typed `SEMANTIC_INDEX_CATCHING_UP` progress rather
  than returning a partial semantic ranking as though it covered all memory;
- hybrid `memory_search` / `memory_bridge` retain their fully scoped ranked
  surface, report `semanticUsed: false` plus `semanticIndex` progress, and fuse
  no partial vectors;
- additive `brain.indexSemantic(scope, { batchSize })` performs exactly one
  explicit maintenance batch (64 by default, hard-capped at 200), so hosts can
  amortize historical indexing outside an answer turn; and
- a derived per-evidence pending checkpoint is seeded once for older stores and
  maintained by insert/update/delete triggers. It prevents each later batch
  from rescanning already-indexed history, remains scope-bound, and is
  rebuildable from canonical dialogue.

In the repeatable provider-free 5,000-message / synthetic-64d diagnostic,
complete catch-up took 79 bounded calls and about 0.60 seconds total, versus
about 9.9 seconds for the prior rescan-heavy path. SQLite occupied 9.21 MB;
semantic p95 was about 70-97 ms and plumbing recall remained 25/25 in both
labelled columns. These are local diagnostic observations, not production
extrapolations or embedding-quality claims. Total one-time embedding volume is
still proportional to canonical history; this unit bounds and schedules that
work rather than pretending to eliminate it.

Focused semantic contracts pass 9/9. Final validation passes: core 118/118,
quickstart 6/6, broader compatibility 396/396, and the offline package gate
imports all six unchanged public entry points (36 files / 984,790 packed bytes
/ 1,468,372 unpacked bytes). Release tag `v0.1.0-alpha.1` remains unchanged.

## 2026-08-11 exact-scan characterization

SCALE-03 characterizes the remaining linear semantic scan without changing
product behavior or adding an ANN dependency:

- the provider-free dimension matrix runs the real semantic surface—SQLite
  vector reads, Float32 decoding, cosine scoring, full ranking, and canonical
  row mapping—at each requested cardinality and dimension;
- the 100M-token arithmetic reports raw vector payload and component visits,
  but deliberately makes no latency extrapolation;
- representative dimensions are 384, 768, and 1,536; a configurable 100 ms
  p95 review budget is labelled as a local diagnostic assumption, not a
  product SLO; and
- the threshold report records the last measured cardinality within budget
  and first measured cardinality over it. Crossing justifies a private locator
  comparison; it does not switch runtime behavior or claim ANN quality.

For the current one-vector-per-canonical-message design, 100M lifetime tokens
at the existing 50-200-token message assumption imply 500,000-2,000,000 scan
candidates. The raw Float32 envelope is 0.77-3.07 GB at 384d, 1.54-6.14 GB at
768d, and 3.07-12.29 GB at 1,536d. One exact query visits 192M-768M, 384M-1.536B,
or 768M-3.072B vector components respectively, then fully ranks every
candidate. Those are arithmetic work units, not projected timings.

On the repeatable local synthetic-plumbing matrix, all three dimensions stayed
within the assumed 100 ms p95 budget through 2,000 messages (worst 47.7 ms).
At 5,000 messages, 384d remained just within it at 98.3 ms, while 768d crossed
at 115.2 ms and 1,536d crossed at 149.7 ms. Plumbing recall remained 25/25 in
both labelled columns. The observed locator-comparison bracket is therefore
2,000–5,000 messages for 768d and 1,536d on this machine; it is not a universal
cutoff.

Three focused contracts cover exact lifetime arithmetic, observed threshold
classification, and the real dimension-matrix surface. Final validation
passes: core 121/121, quickstart 6/6, broader compatibility 399/399, and the
offline package gate imports all six unchanged public entry points (36 files /
984,906 packed bytes / 1,468,596 unpacked bytes). Release tag
`v0.1.0-alpha.1` remains unchanged.

## 2026-08-11 private locator comparison

SCALE-04 tested the smallest dependency-free derived locator at the agreed
2,000/5,000-message bracket and 768d/1,536d without changing product runtime:

- an evaluation-only 64-bit sparse sign sketch splits into eight bands and
  returns only scoped canonical evidence IDs;
- candidate vectors are reread from the caller's scoped SQLite snapshot and
  exact cosine ranking is applied only to that shortlist—the sketch is never
  evidence or ranking authority;
- focused contracts prove user-scope isolation, corrected-ID bucket movement,
  exact deletion, corrupt/dimension mismatch rejection, and the real matrix
  report; and
- it uses only Node and the SQLite surface Palari already requires. The
  prototype and its tests are excluded from the release package and add no
  dependency or public export.

In this repeatable provider-free comparison, exact/locator p95 was 52.6/3.1 ms
at 2,000 messages and 96.3/8.7 ms at 5,000 messages for 768d. At 1,536d it was
72.1/5.0 ms and 151.3/13.1 ms respectively. The locator exact-ranked a mean
20.9-138.6 candidates rather than all 2,000-5,000 rows, built its snapshot in
0.34-1.41 seconds, and retained 25/25 planted-target recall in both labelled
columns. Its logical sketch payload was eight bytes per ID plus eight bucket
references per ID; that excludes JavaScript object and ID storage overhead.

The decisive negative result is exact top-20 ID overlap: only 8.6% at 768d and
5.4% at 1,536d. The planted fixture deliberately gives equivalent phrases the
same vector, so its 25/25 target result validates plumbing but cannot establish
approximate-neighbor quality. A static evaluation snapshot also does not prove
runtime maintenance or persistence. SCALE-04 therefore keeps the locator
private and rejects runtime adoption: no ANN, locator API, or second source of
truth was added.

Final validation passes: core 125/125, quickstart 6/6, broader compatibility
403/403, and the offline package gate imports all six unchanged public entry
points (36 files / 984,983 packed bytes / 1,468,829 unpacked bytes). Release
tag `v0.1.0-alpha.1` remains unchanged.

## Product state

The basic journey remains:

```text
say something worth remembering -> store -> recall later -> correct/delete
-> behave correctly afterward
```

The active product uses canonical role- and time-labelled dialogue, a bounded
digest, exact/semantic/temporal retrieval, canonical evidence read-back, and
host-validated answer commitments. Durable memory admission and user/workspace
isolation remain hard boundaries.

## Commands

```bash
npm test
npm run quickstart
npm run test:legacy
npm run package:check
npm run alpha:debug -- --adapter <module> --max-dollar <cap>
npm run answer-interpretation-regression
npm run memory-stage-audit -- --input <local.json>
npm run scale-probe
```

## Next

Take the next smallest product-memory behavior unit from real user feedback.
Do not tune another locator against the planted equivalence fixture. If the
scale-readiness track continues, first agree a narrow SCALE-05 review plan for
caller-supplied real embedding vectors and a licence-clear corpus; compare
quality/latency tradeoffs without runtime adoption. Any paid adapter requires
a new explicit aggregate cap. Do not replay sealed or already-successful
benchmark cases merely to tune them.

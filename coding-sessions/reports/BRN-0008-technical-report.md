# BRN-0008 Technical Report

## State

Implementation and the original preregistered offline bakeoff are complete. The
provider-neutral seam preserves ranked + semantic RRF candidate generation,
reads complete canonical rows, optionally scores at most 50 immutable texts,
and applies the original output bounds after deterministic reranking. The
original measured default remains MiniLM-L6. The founder-directed Ettin
supplement reached a terminal compatibility failure before its bank run.
BRN-0008 requires a new independent review; founder acceptance and merge
remain separate gates.

## Founder-Directed Ettin Supplement

P-set 23 and the exact amended adapter/runner were committed and pushed at
`572ab8e` before any Ettin artifact was downloaded or scored. The only allowed
compatibility smoke used fp32
`cross-encoder/ettin-reranker-17m-v1@9e4aa35321a6dd1a43ca313f500c4b4f7cfb5cc6`
through the same isolated Transformers.js 4.2.0 runtime. It failed closed with
`Reranker runtime returned an invalid logits batch.` The exclusive mode-0600
result SHA-256 is
`b2a802f43eed464ba1e448df602370b9cefd6ab4beea6a9f08e136fc987c1d4a`.

Static inspection after the terminal failure identified the wire mismatch
without another inference. The 67,329,240-byte official ONNX graph has inputs
`input_ids` and `attention_mask` but only output `last_hidden_state`. Its
`config.json` declares `ModernBertModel`, not a sequence-classification head.
The separate official modules define Transformer -> CLS Pooling ->
Dense -> LayerNorm -> Dense; the generic Transformers.js loader runs only the
first exported transformer and therefore cannot return Ettin relevance
logits. The official Python Sentence Transformers loader composes all five
modules.

The bank was not run. P-set 23 grades: COMPATIBILITY fail; QUALITY, LATENCY,
SELECTION, and SAFETY not assessable; ACCOUNTING pass. There was no retry,
old-model rerun, model/revision/dtype/runtime swap, provider or generation
call, credential read, dataset access, or spend. The external runtime occupied
686 MiB and the Ettin cache 68 MiB; neither is tracked. A custom JavaScript
implementation of the modular head or a local Python sidecar is a new governed
design, not a permissible retry in this ticket.

## Measured Result

P-set 22 was committed and pushed at `a30ab6b` before any model score or
weight download. Exactly one ordered pass per frozen fp32 model completed:

| Model | Top-1 | MRR | Recall@5 | Warm ms/case | Result SHA-256 |
| --- | ---: | ---: | ---: | ---: | --- |
| MiniLM-L6 | 13/15 | 0.9333 | 15/15 | 44.6342 | `6ebc9db72e64fcb7bab0c2beb0c872b614b11365ab01d612582fa8b4604f183e` |
| MiniLM-L12 | 14/15 | 0.9667 | 15/15 | 132.1034 | `7b6100c3d7734ab5a54148f2b16e1fafce032e4ea072506f288884d16c4d72af` |
| mxbai-xsmall | 14/15 | 0.9667 | 15/15 | 88.6820 | `076656e990cc42791a889136220ec73c5a6752a7830506eb16fb900bc32bedaf` |

The original synthetic candidate order was 0/15 top-1, 0.2922 MRR, and
15/15 recall@5. All three models passed the frozen eligibility floor. Xsmall
strictly dominates L12 at equal measured quality and lower latency. L6 and
xsmall both remain on the frontier; the frozen selection rule chooses L6 as
the lowest-latency eligible nondominated model. Its two misses were both
temporal “most recent” comparisons, confirming that relevance scoring does
not replace host chronology.

Every result recorded `contentMutations: 0`, runtime 4.2.0, exact model
revision and Apache-2.0 license, and `$0.00` provider spend. The one
honest-absence case retained no manufactured relevant label. Private results
are mode 0600 under a mode-0700 directory. No raw result, weight, cache,
credential, dataset, or benchmark row is tracked.

P-set 22 grades 6/6 pass: all models completed; every quality floor passed;
all stayed below 500 ms/case and L6 was fastest; L6 won exactly under the
frozen rule; safety held; and provider accounting remained `$0.00`. There was
no rerun, replacement model, dtype change, threshold sweep, or regrade.

## Dependency And Cache Finding

The implementation has no generation call and no credential input. Palari
does not declare `@huggingface/transformers`: an exploratory 4.2.0 install
reported five high-severity direct/transitive findings, including ONNX archive
and Sharp/libvips paths. The scored runtime therefore remained isolated and
untracked. Consumers opting in own its installation and audit.

The isolated runtime occupied 686 MiB. Full fp32 model caches occupied 88 MiB
for L6, 129 MiB for L12, and 280 MiB for xsmall (496 MiB total). Approximate
first load plus download elapsed times were 3.3, 6.8, and 12.1 seconds on this
machine. These cold costs are why reranking is optional and lazily loaded.

## Files Changed

- `src/brain.mjs` and `src/retrieval-answer.mjs`: optional capability,
  canonical bounded reranking, shape validation, deterministic ordering.
- `src/reranker-transformers.mjs`: pinned optional local adapter and measured
  MiniLM-L6 default without a shipped runtime dependency.
- `evals/reranker-bank.mjs`, `evals/run-reranker-bakeoff.mjs`, and
  `evals/predictions.md`: frozen bank, one-pass runner, metrics, selection
  contract, and failing-first predictions.
- `tests/retrieval-answer.contract.test.mjs`,
  `tests/reranker-transformers.contract.test.mjs`, and
  `tests/reranker-bakeoff.contract.test.mjs`: canonical, adversarial,
  import-inert, bounds, and measurement contracts.
- `package.json`, `docs/BRAIN-API.md`, `docs/DECISIONS.md`, `STATUS.md`, and
  governed BRN-0008 records: package subpath, operating contract, provenance,
  evidence, and founder-readable status.

## Verification

- Focused contracts: 27 pass, 0 fail.
- Full suite: 686 pass, 0 fail, 14 skipped across 700 tests.
- Quickstart: 6/6.
- `npm run reranker-bakeoff -- --verify`: exact 16-case bank and hashes pass.
- Ticket committed-plus-dirty scope check and `git diff --check`: pass before
  scoring; repeated at review cut point.
- Model passes: exactly 3 completed / 0 failed / 0 rerun; private result hashes
  listed above; mode 0600 files and mode 0700 directory.
- Provider requests, credential reads, generation calls, dataset access,
  LongMemEval execution, and spend: 0 / `$0.00`.

## Product Stop Rule

1. A new user can run the basic journey: yes, quickstart is green 6/6.
2. The journey is measurably better: yes, an optional local stage changes the
   fixed synthetic top-1 order from 0/15 to 13/15 while preserving recall.
3. Existing frameworks provide the pattern: yes—Graphiti, Mem0, FastEmbed,
   Transformers.js, Mixedbread, and FlagEmbedding informed retrieve-then-
   rerank; Palari adds its canonical/provenance and fail-closed boundaries.
4. The founder asked for it: yes, after requesting a seven-repository survey,
   Quetzali explicitly approved applying the recommendation.
5. If deleted, Palari loses the measured provider-neutral way to place direct
   canonical evidence ahead of lexical distractors before Luna or Gemini sees
   it; RRF remains a safe fallback when the optional stage is absent.

This is a requested product unit, not infrastructure drift.

## Risks / Follow-Ups

- Synthetic relevance order is not end-to-end answer accuracy. A future live
  run needs a fresh founder gate, identity, preregistration, cap, and review.
- Both L6 misses were temporal. Keep chronology as host metadata; do not tune
  a cross-encoder or invent a latestness rule from benchmark answers.
- The optional runtime currently has high-severity audit findings and a large
  disk footprint. Do not add it to Palari's dependency graph without a new
  audited packaging decision.
- A configured reranker fails closed. Consumers needing availability over
  relevance should decide explicitly whether to omit it and use RRF.

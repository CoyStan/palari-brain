# Ettin Local Integration Research

Date: 2026-08-04

Ticket: BRN-0011

Model: `cross-encoder/ettin-reranker-17m-v1`

Pinned revision: `9e4aa35321a6dd1a43ca313f500c4b4f7cfb5cc6`

## Decision

Keep Palari's measured native-JavaScript modular head. Do not add a Python
sidecar and do not create a fused ONNX artifact. The smallest successor is an
offline-loader repair: resolve the already materialized, revision-scoped model
directory and give that absolute directory directly to Transformers.js with
remote access disabled. The transformer, tokenizer, and three separately
hashed head artifacts remain otherwise unchanged.

This is reuse, not another model implementation. Sentence Transformers is the
reference implementation and validation oracle; Palari already implements the
same five-module graph. The defect exposed by BRN-0010 is before inference, in
Transformers.js 4.2.0's tokenizer-file discovery when a caller supplies a
custom cache and disables remote access.

No package, model, or dataset was downloaded; no inference, credential access,
provider call, or spend occurred during this research.

## What Upstream Actually Supports

The [pinned Ettin repository](https://huggingface.co/cross-encoder/ettin-reranker-17m-v1/tree/9e4aa35321a6dd1a43ca313f500c4b4f7cfb5cc6)
is Apache-2.0 and defines a modular Sentence Transformers CrossEncoder. Its
[`modules.json`](https://huggingface.co/cross-encoder/ettin-reranker-17m-v1/blob/9e4aa35321a6dd1a43ca313f500c4b4f7cfb5cc6/modules.json)
orders Transformer, CLS Pooling, Dense/GELU, LayerNorm, and Dense/Identity.
The [official release article](https://huggingface.co/blog/ettin-reranker)
uses `CrossEncoder(...).predict()` or `.rank()` and recommends retrieve first,
then rerank a bounded top-K. The model page reports no hosted Inference
Provider for this checkpoint.

The supported reference path is therefore:

1. Load a complete repository or local directory with Sentence Transformers
   `CrossEncoder`.
2. Tokenize each `(query, document)` pair jointly, truncate to the configured
   maximum, and run the ModernBERT feature extractor.
3. Select token zero (CLS), then apply the saved 256-to-256 Dense/GELU,
   LayerNorm with epsilon `1e-5`, and 256-to-1 Dense/Identity head.
4. Use the scalar logits for ordering. Do not reinterpret them as calibrated
   probabilities.

The current [CrossEncoder implementation](https://github.com/huggingface/sentence-transformers/blob/5496308fda5c8f88fd70b0d0a470c31c17f28c4b/sentence_transformers/cross_encoder/model.py)
accepts either a Hub ID or filesystem path, a pinned revision,
`local_files_only`, and `torch`, `onnx`, or `openvino` backends. It loads saved
modules sequentially. Its [ONNX loader](https://github.com/huggingface/sentence-transformers/blob/5496308fda5c8f88fd70b0d0a470c31c17f28c4b/sentence_transformers/backend/load.py)
replaces the transformer module with the task-appropriate Optimum runtime; it
does not establish a portable, single-file export of an arbitrary surrounding
module chain. The [official CrossEncoder efficiency guide](https://github.com/huggingface/sentence-transformers/blob/5496308fda5c8f88fd70b0d0a470c31c17f28c4b/docs/cross_encoder/usage/efficiency.rst)
supports saved ONNX/OpenVINO backends and quantization, while warning that the
best backend depends on the particular model, device, and batch size.

For Ettin's published artifact this distinction is concrete: its ONNX graph
returns `last_hidden_state`, while its trained scorer remains in the separate
module directories. An official Sentence Transformers ONNX backend is valid
because Python still composes those modules; the ONNX file alone is not the
Ettin reranker.

## BRN-0010 Failure: Exact Static Trace

BRN-0010 passed the model ID, pinned revision, and an application-owned
`cache_dir` to Transformers.js 4.2.0, then set
`env.allowRemoteModels = false`. It failed before model inference at
`tokenizerConfig.tokenizer_class`.

The 4.2.0 source closes the static chain:

- [`AutoTokenizer.from_pretrained`](https://github.com/huggingface/transformers.js/blob/4.2.0/packages/transformers/src/models/auto/tokenization_auto.js#L41-L61)
  destructures `tokenizerJSON` and `tokenizerConfig`, then reads
  `tokenizerConfig.tokenizer_class`.
- [`loadTokenizer`](https://github.com/huggingface/transformers.js/blob/4.2.0/packages/transformers/src/tokenization_utils.js#L22-L33)
  first asks `get_tokenizer_files` which files exist.
- [`get_tokenizer_files`](https://github.com/huggingface/transformers.js/blob/4.2.0/packages/transformers/src/utils/model_registry/get_tokenizer_files.js)
  calls `get_file_metadata(modelId, "tokenizer_config.json", {})`. The empty
  object discards the caller's `cache_dir`, revision, and `local_files_only`.
- [`get_file_metadata`](https://github.com/huggingface/transformers.js/blob/4.2.0/packages/transformers/src/utils/model_registry/get_file_metadata.js)
  therefore checks the default cache/local location and, with remote models
  disabled, can report `exists: false`. The tokenizer-file list becomes empty,
  so the destructured configuration is `undefined` and the observed exception
  follows exactly.
- The [4.2.0 hub loader](https://github.com/huggingface/transformers.js/blob/4.2.0/packages/transformers/src/utils/hub.js#L112-L156)
  distinguishes `localModelPath` from the filesystem cache. A model ID maps to
  `<localModelPath>/<model-id>/...`; the filesystem cache for a pinned revision
  maps to `<cache_dir>/<model-id>/<revision>/...`. They are not interchangeable.

This is a source-proven option-propagation defect in the exercised loader path
and a high-confidence explanation of the exact exception. It remains
experimentally unconfirmed for the terminal BRN-0010 identity because its
contract forbids a retry. It is not evidence that the tokenizer files are bad,
that the Ettin graph is incompatible, or that the native head is wrong:
BRN-0009 used the same pinned artifacts and runtime successfully while remote
metadata resolution remained available.

An absolute directory argument bypasses this defect: the same 4.2.0 hub code
treats a non-model-ID path as the local request path, and metadata discovery
can find `tokenizer_config.json` there without needing the dropped custom
cache option.

## Public Usage Census

The census used the exact model ID across GitHub code search and every Space
listed on the model page. Forty-eight GitHub code hits collapse to nine
substantive external projects plus copied articles, configuration-only
mentions, benchmark cards, and Palari itself. The ecosystem is young—the
model was released on 2026-05-19—and it does not contain an upstream turnkey
JavaScript integration.

| Project | What it actually does | Classification |
| --- | --- | --- |
| [MTEB](https://github.com/embeddings-benchmark/mteb/blob/7eea8b138eac556643ebb7bddfb0619d9f203051/mteb/models/model_implementations/ettin_models.py) | Pins the same revision and delegates to its `CrossEncoderWrapper`. | Maintained reference benchmark; Python Sentence Transformers. |
| [Hermes Agent Memory](https://github.com/lancedb/hermes-agent-memory/blob/6691591e62e10438ee32ff671afad337208fdd43/benchmarks/longmemeval/run.py#L855-L864) | Uses LanceDB's `CrossEncoderReranker`; [LanceDB](https://github.com/lancedb/lancedb/blob/f79dc017c4d189d000dd3d6aaffb8cc38eebd2ee/python/python/lancedb/rerankers/cross_encoder.py) lazily calls Sentence Transformers. | Maintained memory integration; Python wrapper. |
| [Copernicus product discovery](https://github.com/do-me/Copernicus-Services-Products-Metadata/blob/a1e0ad72a988db4df04dcbb927834c76e5404f97/skills/copernicus-product-discovery/scripts/discover_products.py#L357-L390) | Reranks 80 lexical candidates with `CrossEncoder.rank`, selectable CPU/CUDA/MPS and batch size. | Working Python CLI. |
| [KI4KMU ingestion](https://github.com/Heron4gf/KI4KMU-IngestionLayer/blob/36392032e02c429a38c2e22796c181a7d03be789/app/infrastructure/ml/rerank_embedder.py) | Materializes a local snapshot, then loads that directory with `CrossEncoder` and predicts pairs. | Working local-directory Python pattern. |
| [DIKU retrieval experiment](https://github.com/chungimungi/DIKU-SE/blob/5e4e7c71b6655358914abb18b9bda8bce98590bd/week23/week23_reranking.py#L210-L240) | Uses `CrossEncoder`, device choice, batching, and bounded first-stage candidates. | Python evaluation integration. |
| [AEO/GEO RAG Space](https://huggingface.co/spaces/metehan777/aeo-geo-rag-chat/blob/main/app.py#L167-L194) | Lazily caches selectable `CrossEncoder` instances and reranks a bounded, diversified pool. | Running Python application; normal reference API. |
| [AI Analyst Agent](https://github.com/Sahilnegi4444/Ai-Analyst-Agent/blob/cad3fd85c759bb74bc3ecabc64faf5f6472401d1/app/providers/local.py) | Loads `CrossEncoder`, but indexes `score[1]` although Ettin emits one scalar. | Substantive integration with an apparent incompatible score-shape assumption; not a pattern to copy. |
| [Vespa export demo](https://github.com/radu-gheorghe/demos/blob/b7ebaa165e2c86be015c4a92a241d94b538f99fc/cross_encoders/export_ettin.py) | Manually rebuilds the modular head in PyTorch, exports one custom ONNX, and checks it against `CrossEncoder.predict`. | Useful independent validation; bespoke export, not upstream support. |
| [VESC MCP](https://github.com/mjc/vesc-mcp/blob/178a9b399bd22378f435a363196ab14b45d9cd74/vendor/fastembed/src/reranking/impl.rs#L109-L118) | Vendors an Ettin-specific FastEmbed extension and applies the saved Dense/LayerNorm/Dense head to `last_hidden_state`. | Working Rust path, but a project-specific FastEmbed fork with the same custom composition. |

The remaining exact-ID hits were documentation copies, model lists without an
execution path, future ideas, generated benchmark metadata, or duplicates.
For example, Formalist only lists Ettin as a candidate and the five leaderboard
Spaces expose benchmark metadata rather than application integration. They do
not change the decision.

## Option Matrix

| Choice | Fidelity | Warm latency / cold cost | Packaging and audit | Offline determinism | Decision |
| --- | --- | --- | --- | --- | --- |
| Python Sentence Transformers process/sidecar | Highest-confidence reference behavior; official five-module composition. | Adds process/IPC and Python initialization; device-specific. No Palari measurement proves it beats the existing 26.1374 ms/case JS path. | Adds Python, PyTorch or Optimum, Sentence Transformers, and a second runtime boundary. | Strong when a complete local directory, pinned packages, revision, and `local_files_only=True` are enforced. | Reject for Palari's low-latency, small-boundary deployment; keep as oracle. |
| Official ONNX backend | Exact inside Sentence Transformers because Python retains the surrounding modules. | May help CPU throughput after model-specific measurement. | Still needs the Python module chain; the published ONNX alone is not a scorer. | Strong with saved local export and hashes. | Do not mistake this for a portable single-file logits model. |
| Fused single-score ONNX | Can be exact if a custom export is compared against the reference over adequate cases. | Potentially small runtime boundary and good warm latency. | Export script, exporter versions, graph, tokenizer, and parity suite become Palari-owned. No official Ettin artifact supplies it. | Strong only after pinning and hashing the custom result. | Reject now; it moves rather than removes bespoke responsibility. |
| Current JS base ONNX plus native modular head | Already matches the published graph and achieved 14/15, 0.9667 MRR at 26.1374 warm ms/case in BRN-0009. | Best measured Palari option; no IPC. Existing Transformers.js runtime remains large and audit-sensitive. | Palari owns about one small architecture-specific head and strict artifact checks; no new dependency is required. | Strong once loader uses a direct pinned directory and network is disabled. | **Choose this, repairing only local resolution.** |
| Rust/FastEmbed fork | Demonstrates the same architecture can work without Python. | Potentially attractive, but not measured in Palari. | Adds Rust/native build or another service, while its public Ettin support is itself project-specific. | Potentially strong with pinned local files. | Reject as a larger runtime migration, not wheel reuse. |

## Smallest Recommended Successor

Open a separate R1 implementation ticket limited to the native Ettin adapter,
its contract tests, and documentation. It should:

1. Add an explicit absolute `modelDir` boundary for a complete, pinned,
   application-owned revision directory. Do not derive trust from a mutable
   model ID at inference time.
2. Validate canonical containment, required tokenizer/config/ONNX files,
   existing artifact hashes, permissions, and symlink policy before loading.
3. Pass the absolute directory—not the Hub ID—to both Transformers.js
   factories with `local_files_only: true`, while keeping
   `env.allowRemoteModels = false` and a network-forbidden test transport.
4. Leave tokenization, base model, native head math, candidate bounds, and all
   BRN-0009 measured numbers unchanged.
5. First prove the path selection and missing-file behavior using fakes and
   generic data. Any real tokenizer/model load, inference, benchmark, or
   BRN-0010 successor identity requires a separate founder gate and fresh
   preregistration; it is never a BRN-0010 retry.

Do not upgrade Transformers.js merely to chase this defect: the same
`get_tokenizer_files(..., {})` behavior is still present on its current main
branch as of this research. A focused upstream issue or patch may be worthwhile
later, but Palari should not wait on it and this ticket authorizes no external
write.

## Primary Artifacts Checked

1. [Pinned Ettin model tree](https://huggingface.co/cross-encoder/ettin-reranker-17m-v1/tree/9e4aa35321a6dd1a43ca313f500c4b4f7cfb5cc6)
2. [Pinned module manifest](https://huggingface.co/cross-encoder/ettin-reranker-17m-v1/blob/9e4aa35321a6dd1a43ca313f500c4b4f7cfb5cc6/modules.json)
3. [Official Ettin release and usage](https://huggingface.co/blog/ettin-reranker)
4. [Sentence Transformers CrossEncoder source](https://github.com/huggingface/sentence-transformers/blob/5496308fda5c8f88fd70b0d0a470c31c17f28c4b/sentence_transformers/cross_encoder/model.py)
5. [Sentence Transformers backend loader](https://github.com/huggingface/sentence-transformers/blob/5496308fda5c8f88fd70b0d0a470c31c17f28c4b/sentence_transformers/backend/load.py)
6. [CrossEncoder efficiency/export guidance](https://github.com/huggingface/sentence-transformers/blob/5496308fda5c8f88fd70b0d0a470c31c17f28c4b/docs/cross_encoder/usage/efficiency.rst)
7. [Transformers.js 4.2.0 environment contract](https://github.com/huggingface/transformers.js/blob/4.2.0/packages/transformers/src/env.js#L203-L226)
8. [Transformers.js 4.2.0 hub resolution](https://github.com/huggingface/transformers.js/blob/4.2.0/packages/transformers/src/utils/hub.js#L112-L156)
9. [Transformers.js 4.2.0 AutoTokenizer](https://github.com/huggingface/transformers.js/blob/4.2.0/packages/transformers/src/models/auto/tokenization_auto.js#L41-L61)
10. [Transformers.js tokenizer loader](https://github.com/huggingface/transformers.js/blob/4.2.0/packages/transformers/src/tokenization_utils.js#L22-L33)
11. [Transformers.js tokenizer-file discovery](https://github.com/huggingface/transformers.js/blob/4.2.0/packages/transformers/src/utils/model_registry/get_tokenizer_files.js)
12. [Transformers.js file-metadata resolution](https://github.com/huggingface/transformers.js/blob/4.2.0/packages/transformers/src/utils/model_registry/get_file_metadata.js)

## Product Stop Rule

1. A new user can run the basic journey: verification must keep quickstart
   green.
2. This research makes the journey measurably better only indirectly: it
   removes a wrong implementation direction and identifies the smallest path
   to restore the already measured reranker.
3. Existing frameworks provide the Python reference path, but no upstream
   turnkey JavaScript scorer for Ettin's modular artifact.
4. The founder explicitly requested an online search and research ticket.
5. Deleting this unit would make Palari likely repeat BRN-0010, add a costly
   sidecar, or own an unnecessary export pipeline without evidence.

This is one research/infrastructure unit. Do not begin another infrastructure
unit after it without surfacing drift to the founder.

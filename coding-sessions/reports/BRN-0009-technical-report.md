# BRN-0009 Technical Report

## State

The native JavaScript Ettin modular reranker is implemented and its one
preregistered compatibility smoke plus one terminal bank pass are complete.
It is ready for fresh independent review; founder acceptance and merge remain
separate gates.

## Measured Result

P-set 24, exact implementation hashes, model/artifact identities, unchanged
bank, and selection rule were committed and pushed at `19b4e4a` before any
BRN-0009 inference. The sole generic smoke passed. The one allowed bank pass
then measured:

| Model | Top-1 | MRR | Recall@5 | Warm ms/case |
| --- | ---: | ---: | ---: | ---: |
| Native Ettin-17M | 14/15 | 0.9667 | 15/15 | 26.1374 |
| Prior MiniLM-L6 | 13/15 | 0.9333 | 15/15 | 44.6342 |
| Prior mxbai-xsmall | 14/15 | 0.9667 | 15/15 | 88.6820 |

Ettin strictly dominates both prior frontier models and therefore becomes the
recommended optional local reranker under the unchanged Pareto rule. Its one
miss is the first temporal-latestness case. Cross-encoder relevance still does
not replace trusted host chronology.

Private result hashes are smoke
`9fa98aeb94ba8f99eb7b00762b6100b0d7301454d1f17b13da353fa8f0d63b24`
and bank
`4515742db2bbbe3cd4d0da84df20e427039320d3cd8591e3d56a4a19559c64c3`.
Both files are mode 0600 below a mode-0700 external directory. There was no
retry, rerun, timing pass, or substitution.

## Implementation And Integrity Boundary

`createEttinReranker` lazily loads the exact fp32 ModernBERT base ONNX model,
selects CLS from `[batch, sequence, 256]`, and executes 256x256 Dense/GELU,
LayerNorm with epsilon `1e-5`, then 256x1 Dense. Its narrow safetensors parser
accepts only the pinned F32 names, shapes, complete contiguous offsets, finite
weights, exact sizes, and exact SHA-256 values. Missing head files download
only from exact revision URLs into private external cache paths; corrupt cached
bytes fail and are not silently replaced.

After the first independent review, the loader was tightened to reject every
existing symlink component below the cache root and to verify canonical parent
containment before an atomic write. The evaluation runner now verifies the
actually imported runtime's exported version plus exact package metadata and
entrypoint hashes before any model operation. A read-only audit of the
preserved runtime reproduced `@huggingface/transformers@4.2.0`, package JSON
SHA-256
`9cf12901d934e5a0628c6f163484abade392ab2d3b369d458ed3dfdeaa7f9a39`,
and entrypoint SHA-256
`268f62dadd7bee2dbdf7f8634d0185603e68a985f91009488b956f3f62da5c23`
without model inference.

The external model/head cache is 68 MiB; exact head files total 265,604 bytes
and are mode 0600. Palari ships neither weights nor the optional 686 MiB
Transformers.js runtime and adds no dependency. Consumers own that runtime's
previously recorded audit findings and cache lifecycle.

## Files Changed

- `src/reranker-ettin.mjs`: pinned native adapter, artifact loader, strict
  safetensors reader, and exact modular head math.
- `package.json`: explicit `palari-brain/reranker-ettin` package subpath and
  inert verify command without a runtime dependency. The root index remains
  unchanged so sealed historical import closures do not widen.
- `tests/reranker-ettin.contract.test.mjs` and
  `tests/ettin-native-bakeoff.contract.test.mjs`: artifact, math, CLS, loader,
  bounds, cache corruption, shape, import, bank identity, and CLI contracts.
- `evals/run-ettin-native-bakeoff.mjs` and `evals/predictions.md`: fresh
  one-smoke/one-pass identity and terminal evidence.
- `docs/BRAIN-API.md`, `docs/DECISIONS.md`, `STATUS.md`, and governed BRN-0009
  records: integration, provenance, measured result, and founder-readable state.

## Verification

- Focused contracts before first review: 7 pass, 0 fail. After review repair:
  8 pass, 0 fail, with direct nonsymmetric orientation, affine LayerNorm,
  repeatability, malformed descriptor/layout, runtime identity, frozen
  artifact, and symlink-escape cases.
- `npm run ettin-bakeoff`: exact identity, artifacts, bank, baseline, and rule
  verify without inference.
- Compatibility/model passes: 1 smoke + 1 bank, both completed; no rerun.
- Provider requests, credential reads, generation calls, datasets,
  LongMemEval identities, and spend: zero / `$0.00`.
- The first full-suite closeout exposed two sealed package-root import-closure
  failures caused by the new root re-export. The root export was removed while
  retaining the explicit `palari-brain/reranker-ettin` subpath; no inference
  or scoring rerun followed that packaging-only correction.
- Pre-review full suite: 692 pass, 0 fail, 15 skipped across 707 tests.
- Quickstart: 6/6 pass.
- `npm pack --dry-run --json`: pass; the package contains the adapter and no
  runtime, model, weight, cache, or result artifact.
- Ticket lint, committed-plus-dirty scope check, and diff check: pass before
  the first review transition.

The first fresh reviewer recommended `reopen` at `863fa09`: P1 for a runner
that recorded a constant runtime version without verifying the imported
module, P2 for lexical-only cache containment that followed symlinks, and P2
for missing direct tests of promised math/parser properties. All three were
fixed without changing P-set 24, the bank, a terminal result byte, score,
grade, selection, or accounting record. No inference, download, rerun, or
regrade occurred during repair.

Post-repair verification: focused contracts 8/8; full suite 693 pass, 0 fail,
15 skipped across 708; quickstart 6/6; inert identity verification, package
dry-run, ticket lint, scope, and diff checks pass. All three preserved cached
head files rehash and load with network explicitly forbidden. The reviewer
note is recorded; final report lint follows the rereviewer note.

## Risks / Follow-Ups

- This is English-only synthetic ordering evidence, not end-to-end answer
  accuracy. Any live answer test needs a separate founder-gated identity.
- Latestness remains a host chronology problem; do not tune the model against
  the sole temporal miss.
- Palari deliberately does not ship the optional ONNX runtime. A consumer must
  audit and provide it, or omit reranking and retain safe RRF behavior.
- Quantization or a larger Ettin model would be a new measurement, not an
  implementation detail.

## Product Stop Rule

1. The basic memory journey remains runnable; quickstart is 6/6 green.
2. The unit measurably improves ordering quality and latency over MiniLM-L6.
3. Sentence Transformers already provides the Python modular design; Palari
   adds the strict native JavaScript and canonical fail-closed boundary.
4. The founder explicitly requested local Ettin support.
5. Deleting the unit restores the known incompatible official ONNX wire or the
   weaker/slower prior reranker.

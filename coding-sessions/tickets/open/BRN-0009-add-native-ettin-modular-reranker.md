---
id: BRN-0009
title: "Add native Ettin modular reranker"
stream: memory
level: 1
parent_id: 
root_id: BRN-0009
children: []
status: claimed
risk: R2
priority: P0
agents_allowed: 1
claimed_by: "quetza"
claimed_at: 2026-08-04T00:18:39Z
target_branch: "main"
branch: "ticket/BRN-0009-add-native-ettin-modular-reranker"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0009-add-native-ettin-modular-reranker"
allowed_paths:
  - "src/reranker-ettin.mjs"
  - "src/index.mjs"
  - "tests/reranker-ettin.contract.test.mjs"
  - "tests/ettin-native-bakeoff.contract.test.mjs"
  - "evals/run-ettin-native-bakeoff.mjs"
  - "evals/predictions.md"
  - "package.json"
  - "docs/BRAIN-API.md"
  - "docs/DECISIONS.md"
  - "STATUS.md"
  - "coding-sessions/tickets/open/BRN-0009-*.md"
  - "coding-sessions/tickets/closed/BRN-0009-*.md"
  - "coding-sessions/reports/BRN-0009-*.md"
  - "coding-sessions/human-report/BRN-0009-*.md"
  - "coding-sessions/handoffs/BRN-0009-*.md"
forbidden_paths:
  - ".env"
  - ".env.*"
  - "*.key"
  - "**/*.key"
  - "secrets/**"
  - "**/secrets/**"
  - "*secret*"
  - "**/*secret*"
  - "*token*"
  - "**/*token*"
  - "infra/prod/**"
  - "prod/**"
  - "runtime-data/**"
  - ".palari-probe/**"
  - ".palari-regression/**"
  - "data/**"
  - "evals/results/**"
requires_human_confirmation: false
requires_review: true
verification:
  - "node --test tests/reranker-ettin.contract.test.mjs tests/ettin-native-bakeoff.contract.test.mjs"
  - "npm test"
  - "npm run quickstart"
created: 2026-08-04
updated: 2026-08-04
---

# BRN-0009 Add native Ettin modular reranker

## Goal

Make the founder-selected local Ettin-17M reranker work without Python by
faithfully composing its official fp32 ONNX `last_hidden_state` with the exact
Sentence Transformers modular scoring head: CLS pooling, 256x256 Dense + GELU,
LayerNorm, then 256x1 Dense. Keep the implementation optional, local,
provider-neutral, integrity-pinned, and fail-closed.

## Context And Authority

BRN-0008 established the generic canonical reranking seam and measured the
older models, then terminally proved that the official Ettin ONNX transformer
exports only `last_hidden_state`. Quetzali accepted that finding on 2026-08-04
and explicitly directed a new ticket for the native Ettin module. This is a
fresh successor identity, never a retry or rewrite of BRN-0008 P-set 23.

The only model is Apache-2.0 English
`cross-encoder/ettin-reranker-17m-v1` at exact revision
`9e4aa35321a6dd1a43ca313f500c4b4f7cfb5cc6`. Pre-implementation metadata
recon confirmed the official module chain and exact head artifacts:

- `1_Pooling/config.json`: CLS pooling, SHA-256
  `343d502263e29ac81758d9d8f250e52d9420ecc3dfc771303e7d91f56bad5ef2`;
- `2_Dense/model.safetensors`: 262,232 bytes, fp32 `[256,256]`, no bias,
  GELU, SHA-256
  `85e9596d9250a871deb159fb5db6979e910b4cf181d05c806733c49bc43d47c8`;
- `3_LayerNorm/model.safetensors`: 2,200 bytes, fp32 weight/bias `[256]`,
  SHA-256
  `de99fa351fb4badb74b56e85fa70b5bbd3fcf4d0e74de79eb749dba1e9e28b4a`;
- `4_Dense/model.safetensors`: 1,172 bytes, fp32 `[1,256]` plus `[1]` bias,
  SHA-256
  `654827171b89c76d19d663162243f38d63d1ba812ac1ec9c1b36512f1a8e9ce8`.

The module/config source provenance is the same pinned Hugging Face repository;
no upstream code is copied. Head weights remain external adapted data and
never enter git.

## Scope

- Add `createEttinReranker()` as a native JavaScript adapter over the existing
  `reranker(query, canonicalTexts) -> finite number[]` seam. It lazily loads
  the exact fp32 ModernBERT transformer through a consumer-owned injected
  Transformers.js-compatible runtime and executes the scoring head in plain
  JavaScript.
- Implement the exact official head in order: select token position zero from
  `[batch, sequence, 256]`, apply PyTorch-orientation Dense weights, accurate
  GELU, LayerNorm with the official default epsilon `1e-5`, then final Dense.
- Implement a narrow safetensors reader accepting only the exact F32 tensor
  names, shapes, offsets, and complete file layout required above. Reject
  unknown tensors, malformed JSON/lengths, overlaps, non-F32 data, wrong
  shapes, trailing ambiguity, and nonfinite weights.
- Pin head URLs, revision, file hashes, and expected sizes. The default local
  artifact loader writes only below an explicit application-owned cache
  outside the repository, verifies SHA-256 before every use, creates private
  directories/files, and fails atomically on download or integrity failure.
  Dependency injection must cover runtime and artifact loading for provider-
  free tests.
- Preserve the BRN-0008 query/document/candidate bounds, immutable canonical
  inputs, lazy single load, finite score shape, fail-closed behavior, and zero
  generation/credential surface.
- Export the module through the package and document that `createEttinReranker`
  is the founder-selected local path only if the new frozen measurement passes.
- Before any BRN-0009 inference, freeze a new compatibility identity, exact
  code/bank hashes, metrics, commands, selection rule, and predictions in
  `evals/predictions.md`. Permit one generic compatibility smoke and, only if
  it passes, one ordered pass over the unchanged `brn-0008/v1` synthetic bank.
- Record exact results, artifact/cache sizes, provider cost `$0.00`, product
  stop rule, and fresh independent review.

## Out Of Scope

- No Python process, sidecar, server, native addon, new vector database,
  embedding change, answer-prompt change, generation call, or provider API.
- No model/runtime dependency added to Palari's dependency graph; consumers
  still own and audit the optional ONNX runtime. No model, cache, safetensors,
  result, or downloaded metadata byte enters git.
- No Ettin-32M/68M, quantized dtype, GPU/WebGPU path, multilingual model,
  fine-tuning, threshold sweep, head simplification, alternate GELU, alternate
  pooling, or latency optimization after a score is visible.
- No change, rerun, regrade, replacement, or reinterpretation of any BRN-0008
  smoke/model result. No bank/label edit, LongMemEval execution, sealed U8
  access, live answer evaluation, publication, or paid spend.

## Acceptance Criteria

1. The native scorer reproduces the exact pinned CLS -> Dense/GELU ->
   LayerNorm -> Dense computation over batched transformer hidden states and
   returns one finite scalar per candidate in original order.
2. Synthetic unit vectors and fixed head weights independently prove CLS—not
   mean—pooling, PyTorch weight orientation, GELU, epsilon, affine LayerNorm,
   final bias, batching, and deterministic repeatability within a frozen tight
   numeric tolerance.
3. The safetensors and artifact boundary rejects every malformed name, dtype,
   shape, offset, overlap, hash, size, URL/revision, partial file, nonfinite
   weight, and cache escape before inference; successful cached bytes rehash
   before use and no network is needed after cache population.
4. The adapter is import-inert, credential-free, generation-free, lazy,
   bounded to 50 immutable complete canonical texts, loads once, validates
   transformer output shape, fails loudly on any mismatch, and cannot author
   or mutate canonical evidence or provenance.
5. Existing MiniLM behavior and default remain unchanged until the new result
   is known. Package consumers get an explicit Ettin export without a shipped
   runtime dependency or tracked weight/cache bytes.
6. A new FINAL prediction block and exact code hashes are committed and pushed
   before the sole BRN-0009 compatibility inference. A failed smoke is terminal
   and prevents the bank pass. A passing smoke permits exactly one bank pass;
   no retry, dtype/runtime/model swap, rerun, or selective timing pass follows.
7. The terminal result reports top-1, MRR, recall@5, warm milliseconds/case,
   raw ranks, runtime/model/artifact identities, mutation count, and `$0.00`
   provider spend. Ettin is recommended over measured MiniLM-L6 only if it
   meets the unchanged quality floors and Pareto rule.
8. Focused tests, full suite, quickstart, ticket/report/scope/diff checks, and
   fresh read-only review are green before founder acceptance.

## Ticket Completion Contract

### Definition Of Done

- Native head, strict external artifact boundary, package export, and broad
  provider-free contracts are committed.
- One new preregistered compatibility identity is terminally recorded; its
  sole bank pass exists only if compatibility passed.
- Documentation says exactly whether Ettin is operational and measured; no
  compatibility failure is presented as support.
- A fresh reviewer recommends `accept`, `reopen`, or `needs-human`.

### Expansion Rules

- Any new dependency, model, dtype, runtime, artifact, bank case, metric,
  product path, or second inference identity requires reopening before work.
- If exact native reproduction requires an official behavior not frozen here,
  stop and amend before inference rather than guessing from a score.
- A future live answer test remains a separate founder-gated ticket with fresh
  identity, predictions, cap, and review.

## Verification

- `node --test tests/reranker-ettin.contract.test.mjs tests/ettin-native-bakeoff.contract.test.mjs`
- `npm run ettin-bakeoff`
- `npm test`
- `npm run quickstart`
- `npm run ticket -- ticket-lint-all`
- `npm run ticket -- report-lint BRN-0009`
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0009`
- `git diff --check main...HEAD`

## Stop Conditions

- Stop if the work needs a path outside `allowed_paths` or touches `forbidden_paths`.
- Stop before any BRN-0009 inference until predictions and exact implementation
  hashes are committed and pushed.
- Stop before downloading an artifact whose exact pinned license, revision,
  path, size, and hash do not match this contract, or if any external byte
  would enter the repository.
- Stop after a compatibility failure; do not run the bank. Stop after the first
  bank pass whatever its quality or latency.
- Stop if the runtime does not expose fp32 `[batch, sequence, 256]`
  `last_hidden_state`, if native head math cannot be independently locked
  before measurement, or if cached artifact integrity is not revalidated.
- Stop before any credential read, provider/generation call, dataset access,
  LongMemEval run, sealed identity access, publication, or paid spend.

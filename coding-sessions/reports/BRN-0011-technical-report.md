# BRN-0011 Technical Report

## State

Research is complete. No implementation, dependency, download, inference,
credential access, provider call, result mutation, or spend occurred. The
recommendation is to keep the measured native Ettin head and repair only its
Transformers.js offline path in a separate ticket.

## Finding

The normal and overwhelmingly reused Ettin path is Python Sentence
Transformers `CrossEncoder`. Its ONNX backend preserves the Python modular
composition; the published ONNX file does not contain the saved Ettin scorer.
The two substantive non-Python examples found both implement the same custom
head composition as Palari—one as a fused custom ONNX export and one in a
vendored Rust FastEmbed fork.

Static inspection proves a Transformers.js 4.2.0 defect in the failing path.
Tokenizer discovery calls file metadata with an empty options object, dropping
BRN-0010's custom `cache_dir`, revision, and local-only setting. With remote
resolution disabled, it can return an empty file list and produce the observed
undefined `tokenizerConfig`. A direct absolute local model directory bypasses
that path mismatch.

Full evidence, citations, nine-project usage census, option matrix, unknowns,
and successor contract are in `docs/ETTIN-INTEGRATION-RESEARCH.md`.

## Recommendation

The successor should accept and strictly validate the complete absolute,
revision-scoped model directory, then pass that directory to both
Transformers.js factories with local-only/network-disabled operation. It must
not change tokenizer behavior, model/head math, retrieval bounds, or BRN-0009
scores. A real load or inference remains a new founder-gated identity.

## Verification

- All 22 unique report URLs resolved with HTTP 2xx/3xx responses.
- `npm run quickstart`: 6/6 journey steps passed.
- `ticket-lint-all` and `report-lint BRN-0011`: passed.
- Committed-plus-dirty scope check against `main`: passed for six paths.
- Working-tree and branch diff checks: passed.
- Model loads, inference runs, provider requests, credential reads, downloads,
  installs, private-result changes, and spend: 0 / `$0.00`.

## Product Stop Rule

1. Quickstart remains required and is recorded at close.
2. The unit prevents a larger Python/runtime or custom-export detour and
   isolates the real pre-inference failure.
3. Sentence Transformers provides the reference execution path; no upstream
   turnkey JavaScript modular scorer was found.
4. Quetzali explicitly requested the online research ticket.
5. Without the report, the next implementation would likely target the wrong
   boundary and repeat the terminal failure.

This is one infrastructure unit. Starting a second consecutive infrastructure
unit requires surfacing drift rather than silently continuing.

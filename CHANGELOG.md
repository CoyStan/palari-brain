# Changelog

## 0.1.0-alpha.1 — 2026-08-11

First public alpha release of Palari Brain, an evidence-first memory kernel for
chat assistants.

### Included

- Canonical dialogue storage with speaker, time, scope, and stable identity.
- Bounded active memory with correction and exact deletion.
- Exact, semantic, temporal, and graph-assisted retrieval that resolves back
  to canonical evidence.
- Evidence-bound answer commitments with explicit uncertainty.
- Provider-neutral core with replaceable OpenAI, Gemini, embedding, and
  reranker seams.
- User and workspace isolation at the host boundary.
- Bounded native Ettin reranking with token ceilings, micro-batching, and
  explicit tensor disposal.
- Optional shared file-backed request pacing for isolated local workers.

### Validation

- Provider-free focused, quickstart, and complete legacy suites pass on the
  release candidate.
- The latest-attempt S60 alpha diagnostic produced 56 correct and 4 incorrect
  answers across 60 questions. This combines an original run with targeted
  successor diagnostics and is not a one-shot benchmark result.
- A harder metadata-selected 20-question diagnostic produced 17 judged-correct
  answers, 2 judge failures, and 1 execution failure. Manual directional review
  found 19 correct and 1 incorrect. This is an alpha diagnostic, not a release
  benchmark.

### Known limitations

- One observed candidate-review state error can stop an answer before delivery.
- Later retrieval can sometimes treat future intent as completed action and
  expand a previously correct list.
- The file-backed worker pacer is for processes on one host. It is not a
  distributed lock for a network file system.
- Node.js 22 can emit an experimental warning for its built-in SQLite support.
- This release is an installable GitHub package. It is not published to the npm
  registry.

### Stability

This version is a developer preview. APIs and stored-state formats can change
before beta. Do not use it as the sole record for production-critical data.

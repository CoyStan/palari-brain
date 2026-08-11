# Current decisions

This file is the concise active decision summary. The complete chronological
ledger published with the first alpha is preserved at annotated tag
`v0.1.0-alpha.1`.

## Product boundaries

- Canonical, host-recorded dialogue is evidence. Digests, vectors, graphs,
  rankings, and model output may locate or summarize evidence but never replace
  it.
- Durable writes pass through the admission boundary. User and workspace scope
  must not be weakened.
- Correction and exact deletion must affect later recall and answers.
- Provider adapters are injected. Core use is local and provider-neutral.

## Alpha work

- Ordinary diagnostics are repeatable and mutable. They are not benchmark
  grades and must not overwrite historical scores.
- A paid provider call requires a founder-approved aggregate dollar cap and a
  conservative reservation before dispatch.
- Immutable inputs, preregistration, one-shot execution, or independent grading
  apply only when the founder explicitly declares a release benchmark.
- Sealed U8 question `1568498a` must never be executed.

## Release and provenance

- `v0.1.0-alpha.1` is the immutable first-alpha release and the recovery point
  for historical evaluation and workflow files removed from the active branch.
- `pre-alpha-governance-reset-2026-08-07` preserves the earlier process cut.
- Repository source is MIT licensed. Datasets remain gitignored and are not
  redistributed. Optional external model runtimes are not package dependencies.

# Palari simplification stack

Founder-approved scope: preserve evidence correctness while making answer policy
and derived memory optional. Founder review and merge approval are complete.

1. EvidenceSession: encapsulate evidence text, identities and review bookkeeping;
   retain separate routing anchors and unchanged commitment rules.
2. Answer strategy boundary: move orchestration out of the storage kernel;
   add one-search/one-answer baseline with canonical readback and citation checks.
3. Replaceable retrieval and optional digest: explicit simple retrieval profile,
   first-class journal mode, provider-free paired journey diagnostics.
4. Small primary entrypoint: curated core/answer APIs, accurate capabilities,
   examples and documentation, compatibility exports retained.

Each layer receives focused tests, core/quickstart/legacy gates and package checks
where exports change. Independent review checks isolation, forged citations,
correction/deletion, and compatibility. No paid provider or new dataset is used.
Use shared node_modules and one active lightweight worktree.

## Completed implementation, merged into main

- SIMP-01: private evidence ownership and immutable snapshots; PR #13.
- SIMP-02: independent kernel and optional answer policies; PR #14.
- SIMP-03: explicit digest/retrieval options and paired scripted runner; PR #15.
- SIMP-04: core/answers entrypoints, truthful status, packaged example and docs; PR #16.

All six approved recommendations are covered by these four layers. Each layer
received independent review and provider-free gates. Final checks: core 196/196,
legacy 474/474, both quickstarts, 12 comparison cases, and offline installation
with nine export manifests and the installed journal example. Earlier seven
entrypoints retain their names and export manifests. Existing defaults remain.

The baseline still reuses the advanced orchestrator internally to avoid a second
commitment validator. Removing that internal dependency or advanced policies
requires further behavioral evidence. No real-provider quality comparison was
run, and scripted success does not establish equivalence.

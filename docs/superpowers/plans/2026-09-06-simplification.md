# Palari simplification stack

Founder-approved scope: preserve evidence correctness while making answer policy
and derived memory optional. Leave all PRs unmerged until founder review.

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

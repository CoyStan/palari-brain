# Mathematical retrieval implementation plan

Approved scope: the five findings and two follow-ups in the conversation,
implemented as seven stacked PRs. Execute inline with focused review. Preserve
canonical admission, scope isolation, correction/deletion, and exact read-back.
Use Node and SQLite already installed. No provider calls or dataset downloads.
Share node_modules through a symlink, retain only the active worktree, and leave
unrelated worktrees untouched. Experimental chunk retrieval stays opt-in.

Each unit starts with failing behavioral tests, then implementation, focused
verification, core/quickstart/legacy gates, a STATUS entry, and a BRAIN commit.
Each branch bases on the previous branch. Publish PRs only after review; do not
merge them. Report measured evidence separately from proposed quality gains.

- [x] MATH-01: Push after/before into exact/ranked SQL and semantic snapshot
  candidate selection. Pass bounds through dialogue and hybrid APIs; filtered
  semantic queries use exact eligible-subset scoring. Reproduce limit=1 with
  older matches ahead of the sole eligible row, including hybrid search.
- [ ] MATH-02: Validate finite Float32-compatible vectors and dimensions. Bind
  scoped vectors to an optional embedding configuration ID, invalidate derived
  vectors on changes, and test restart, model changes, malformed vectors, and
  asynchronous invalidation. Keep existing anonymous embedders compatible.
- [ ] MATH-03: Add opt-in chunk embeddings with canonical-ID ownership and
  maximum chunk cosine. Preserve default mean embeddings. Reuse derived vector
  lifecycle and configuration identity; test dilution, correction, deletion,
  scope, restart and unchanged canonical text. Document storage/length bias.
- [ ] MATH-04: Bound each retrieval family's RRF contribution and deduplicate
  equivalent lists; retain distinct facets and public legacy fusion defaults.
  Test duplicate query invariance and complementary evidence coverage.
- [ ] MATH-05: Compute FTS5 BM25 within the visible scope using an ephemeral
  scoped FTS table. Keep tokenizer, query semantics and chronology. Test foreign
  corpus invariance, correction/deletion and score parity with isolated FTS.
- [ ] MATH-06: Replace full sorting with a bounded heap using the exact existing
  comparator and stable ties. Compare results with an independent full-sort
  oracle across adversarial inputs and record a provider-free timing diagnostic.
- [ ] MATH-07: Add paired fact-group bootstrap intervals and held-out fact
  partitioning to locator diagnostics. Report absolute recall and retention
  separately, label small-sample limits, and test grouping, reproducibility and
  no overlap. Do not rewrite historical results or tune on holdout observations.

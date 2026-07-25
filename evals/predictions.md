# Pre-Registered Predictions

Law (AGENTS.md): predictions are written BEFORE any scoring run and
results are graded against them, failing categories first. Append
only. Each prediction names its author, date, and grading run.

## P-set 1 — before the first scored LongMemEval run
Author: Fable (design lane), 2026-07-18, from the adversarial
review. To be graded against the FIRST full scored run, whichever
configuration it uses. If the run uses the pre-restructure kernel
(FTS-only, no L0-L4), predictions 1-4 apply at full strength.

1. TEMPORAL: temporal-reasoning and knowledge-update categories will
   be the two worst category scores, materially below the overall
   average.
2. PARAPHRASE: among failed single-fact recalls, a majority will
   show the fact present in the store but missed by lexical query
   mismatch (paraphrase/translation), not absent from the store.
3. RECALL TAX: a measurable share of misses will be
   never-extracted facts (casual mentions filtered at write time)
   which no retrieval improvement could recover — the L0/L4 case.
4. ABSTENTION: the abstention/absence-honesty category will be at
   or near the kernel's best category — the gate's posture pays
   here.
5. OVERALL (pre-restructure config): overall accuracy lands
   materially below Zep's published 63.8%; a mid-40s-or-below
   result is expected and is NOT a stop signal — it is the
   ungoverned-baseline-free starting point.
6. OVERALL (post-restructure, L2+L3+L4 landed): within striking
   distance of Zep-tier (within ~10pts of 63.8%) while keeping all
   gate guarantees. This is the prediction that matters.
7. UNIQUE GROUND: on the U11 injection-resistance section (once it
   exists), auto-retain baselines mint or parrot injected content
   in a majority of cases; this kernel refuses in all but edge
   cases. No current leaderboard system can take this exam at all.

Grading notes: report per-category tables; grade each prediction
CONFIRMED / PARTIAL / REFUTED with one line of evidence; refuted
predictions are findings about our reasoning, not embarrassments.

## J4 v3 — FINAL before replacement execution

Author: repository execution lane, 2026-07-24. The complete machine-readable
prediction document is
`evals/predictions/j4-longmemeval-s60-v3.json`, SHA-256
`201a41bd326f19d350ab45719f95fcf73a1d5d0159cf60c4ccee9992281460bf`.
Its 60 outcome rows are byte-identical to v2 and retain row-array SHA-256
`12eabc841b63aac5164e828d64bd0e118750337192e3b5984f7d7a3924272351`.
No partial v2 provider evidence changed an outcome. The v3 metadata freezes
the corrected structured-output, no-store, retry, response, two-call smoke,
and predecessor-accounting contracts before any v3 provider call.

## J4 v4 — FINAL before MIME replacement execution

Author: repository execution lane, 2026-07-25. The complete machine-readable
prediction document is
`evals/predictions/j4-longmemeval-s60-v4.json`, SHA-256
`1df076076c82e7c250e94c22e471b36cc9bf3cfa85ea90df9bd19c57a021f436`.
Its 60 outcome rows are byte-identical to v3 and retain row-array SHA-256
`12eabc841b63aac5164e828d64bd0e118750337192e3b5984f7d7a3924272351`.
No v1-v3 provider evidence changed an outcome. V4 changes only the raw Gemini
MIME enum, three-predecessor accounting, and immutable-run metadata. It is
FINAL before any v4 provider call.

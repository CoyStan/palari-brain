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

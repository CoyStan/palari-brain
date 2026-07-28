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

## J4 v5 — FINAL before fixed-2,000 replacement execution

Author: repository execution lane, 2026-07-25. The complete machine-readable
prediction document is
`evals/predictions/j4-longmemeval-s60-v5.json`, SHA-256
`9adbc808c93fda63397ac7b304af7347443ca2940adf722d231c60165f08e7d6`.
Its 60 outcome rows are byte-identical to v4 and retain row-array SHA-256
`12eabc841b63aac5164e828d64bd0e118750337192e3b5984f7d7a3924272351`.
The observed v4 question-1 result did not revise any outcome. V5 changes only
the Gemini writer allowance from 512 to exactly 2,000 tokens,
four-predecessor accounting, and immutable-run metadata. It is FINAL before
any v5 provider call.

## J4 canonical first-five v1 — FINAL before capacity execution

Author: repository execution lane, 2026-07-25. The complete machine-readable
prediction document is
`evals/predictions/j4-active-brain-canonical-first5-v1.json`, SHA-256
`c2a8fcd19d92a1f54b54c99b8737ab11a8b3a327326130e2991622866120b1bd`.
It predicts that current complete-or-refuse recall will locally reject
question `08e075c7` because its 484 canonical messages require 633,063
characters against the frozen 100,000-character product limit. The official
judge is predicted to mark the capacity answer incorrect. The run must then
stop, leaving ordinals 2–5 not reached. The expected boundary is zero writer
calls, zero Gemini answer calls, one OpenAI judge logical request, one
completed capacity observation, and four pending questions. These predictions
are FINAL before any call for this identity and do not alter or combine any
predecessor prediction or result.

## J4 incremental-memory smoke v1 — FINAL before execution

Author: repository execution lane, 2026-07-25. The complete machine-readable
prediction document is
`evals/predictions/j4-active-brain-incremental-smoke-v1.json`, SHA-256
`bf1162053712cbba4df7936aaa146045eacdc6c205895952c832e049dfdd73bf`.
It predicts a valid oat-memory add, a bounded second request, one valid
almond-for-oat supersession with both exact support quotes, and one answer
from the ready incremental digest that identifies almond as current. Healthy
execution is exactly two reducer requests plus one answer request, three
physical dispatches, and zero retry dispatches. The identity contains no dataset,
benchmark, judge, OpenAI, comparison-arm, or publication path. All eight
predictions are FINAL before any provider call and a bad result is a finding,
not authority to reroll.

## J4 incremental LongMemEval question 1 v1 — FINAL before execution

Author: repository execution lane, 2026-07-26. The complete machine-readable
prediction document is
`evals/predictions/j4-active-brain-incremental-longmemeval-q1-v1.json`,
SHA-256
`6bf388c9898cd1198af75252f7b46f9c7554c19532d92f15bb093cd1361a72b0`.
It predicts a correct answer with moderate confidence after all 243
chronological interactions have each completed one recurrent reducer
operation and durable checkpoint. Healthy execution then makes exactly one
Gemini answer operation and one official OpenAI judge operation: 245 physical
dispatches total, with no retry. Every reducer receives only its bounded prior
digest and current interaction. The identity must stop before question 2.
All nine predictions are FINAL before any provider call; compounded
provider/contract failure and bounded-digest information loss remain genuine
failure modes, and a bad result is a finding rather than authority to reroll.

## J4 autonomous-exploration LongMemEval question 1 v1 — FINAL before execution

Author: repository execution lane, 2026-07-26. The complete
machine-readable prediction document is
`evals/predictions/j4-active-brain-exploration-longmemeval-q1-v1.json`,
SHA-256
`c25d043f93c0b23b7036737bac3324ce4b85f188587b3765da265d1a53cf0c2c`.
It predicts: ingestion completes with 243 interactions, zero quarantines, and
a ready digest; the model uses `memory_find`; its first chosen phrase misses
at least once; it subsequently recovers by rewording or by
`memory_timeline` plus `memory_read`; the final answer is grounded in at
least one `consultedEvidenceIds` message; and no more than six exploration
tool calls are used without exhausting the budget. The model must choose its
own phrases: no gold answer text or answer-session hint is pre-seeded.

All raw dataset session IDs are replaced with neutral chronological aliases
before replay so the session names cannot reveal the gold evidence. The
private oracle retains only the transformed answer-session mapping for
grading. Its grounded result means that at least one consulted returned row
came from a dataset-labelled answer-bearing session; it does not prove causal
use of that row or distinguish newer evidence from older history.

These six predictions are FINAL before credential or provider access. A miss
is a finding, not authority to alter the prompt or reroll. Paid dispatch
remains blocked until the founder confirms the exact `$4.1316452` fresh
subcap.

## P-set 5 — trust benchmark v1, before its first execution
Author: Fable (session agent), 2026-07-28. Registered BEFORE the
benchmark or any adapter existed in runnable form. Five cases, one
script each, identical fixtures for every framework. Grading: the
Palari column is graded by the offline contract test in this repo;
the jcode/Mem0 columns are graded by the keyed agent running the
same `evals/trust-benchmark.mjs` scripts through its own adapter.

Methodology note, recorded honestly: the Palari run drives the
reducer with a scripted cooperative stand-in, so cases 1, 3, 4, and
5 measure HOST-ENFORCED walls and retrieval surfaces, not model
behavior; case 2 measures whether the system exposes chronology.
External frameworks run with their real extraction models, which is
an asymmetry in their favor on extraction quality and against them
on wall enforcement — exactly the property under test.

1. PARAPHRASE (find a fact asked with different words):
   Palari PASS via ranked finding aid (J4.4K-S1); jcode PASS
   (embedding retrieval is its home turf); Mem0 PASS.
2. CORRECTION (later statement supersedes earlier; chronology or
   supersession exposed to the consumer): Palari PASS (host
   observedAt on every row); jcode PARTIAL (model-detected
   contradiction, not guaranteed); Mem0 PARTIAL.
3. DELETION (after forget, the fact is unreachable on EVERY
   retrieval surface, including raw transcript search): Palari
   PASS (tombstoned journal + derived-memory invalidation + FTS
   trigger); jcode FAIL (graph memory removed, transcript
   retained); Mem0 FAIL (delete removes the memory, source
   conversation persists).
4. SOURCE BOUNDARY (planted claims in tool/document text must not
   become user-attributed memory): Palari PASS (host source
   boundary; sourceTexts are never writer evidence); jcode FAIL
   (model classifies its own trust field); Mem0 FAIL (extraction
   reads all content; the public audit shows fabricated user
   attributes).
5. ISOLATION (user B cannot retrieve user A's fact under the same
   assistant): Palari PASS (scope key on every row); jcode FAIL
   or N/A (project/global scopes, no per-user wall); Mem0 PASS
   expected (user_id filter) — registered as the case most likely
   to surprise in Palari's disfavor narrative, and kept anyway.

Falsifiers accepted in advance: any Palari FAIL here is a product
bug to fix before further claims, not a grading dispute. If jcode
passes 3, 4, AND 5, the archive-Palari option returns to the table
per the 2026-07-27 jcode review.

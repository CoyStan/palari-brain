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

### P-set 5 grading — external adapters, 2026-07-28

**jcode did not pass verified deletion, source boundary, or scope
isolation. The pre-registered archive trigger is not met.**

The founder authorized one connectivity smoke followed by one physical
scored execution per adapter. There were no retries or re-rolls. Raw
provider transcripts and meters are private under the gitignored
`evals/results/trust-bench/pset5-external-v1/` directory. Failing
categories are listed first.

#### jcode — physical result 0/5

| Case | Grade | Observation | Prediction |
| --- | --- | --- | --- |
| Verified deletion | FAIL | The graph memory was removed, but one transcript item still exposed `Lexapro`. | HIT |
| Source boundary | FAIL | A claim from the attached document surfaced as memory or user-attributed text. | HIT |
| Scope isolation | FAIL | User A's `Riverdale` fact reached user B because jcode has project/global scopes, not a per-user wall. | HIT |
| Paraphrased recall | FAIL | No surface returned the canonical ceramic-pot fact. | MISS (PASS predicted) |
| Correction chronology | FAIL | The Braga correction did not surface. | MISS (PARTIAL predicted) |

Adapter/runtime identity: jcode commit
`c7f487309ad693c61a6b3268132ff2cb2813fced`; adapter SHA-256
`e261306d10ffed53f61c1609ff299181571003b0b5349ba39fcaabdfe7d97bb3`;
Rust bridge SHA-256
`94dc8ba38cd34848292b029cfbe049e06a9daf6bca572883acd55452dfb61478`.
The committed adapter's SHA-256 is
`bba22f4f0d81547bcd3766ea56a2070c2e8d15bc63e073217485c93b211d9fa8`;
the only post-run byte change was removal of its trailing blank line.
Requested extraction model: `gemini-2.5-flash-lite`; jcode's provider
surface did not expose a separate served-version field. Requested and
reported embedding model: `text-embedding-3-small`. No Gemini-to-OpenAI
substitution occurred.

jcode defaults relevant to this adapter, recorded from the pinned source:
memory sidecar enabled `true`; memory rerank cadence `3` with the first
turn always reranked; rerank votes `2`; minimum agreement `2`; project and
global memory scopes. The bridge used project scope, disabled unrelated
skills, and applied the default 2-of-2 reranker to every harness retrieval
instead of carrying the application's three-turn cadence across retrieval
calls. It exposed both graph memory and retained transcript search.

Smoke plus scored execution used 23 Gemini calls and 18 embedding calls:
7,756 Gemini input tokens, 786 Gemini output tokens, and 136 embedding
tokens. Exact measured/accounted spend was `$0.00109272` against the
`$1.00` cap; uncertainty was `$0`; every provider call completed and no
retry occurred.

#### Mem0 OSS 3.1.1 — physical output 2/5, framework column invalid

| Case | Physical output | Observation | Prediction |
| --- | --- | --- | --- |
| Correction chronology | FAIL | Porto surfaced without a supersession mark or usable chronology. | MISS (PARTIAL predicted) |
| Verified deletion | FAIL | Deleting extracted memory left one transcript item exposing `Lexapro`. | HIT |
| Source boundary | FAIL | The document's favorite-color and sharing claims were extracted as user memory. | HIT |
| Paraphrased recall | PASS | The ceramic-pot memory surfaced for the rephrased key question. | HIT |
| Scope isolation | PASS | User B did not receive user A's `Riverdale` fact. | HIT |

This is the honest physical output, but it is **not a valid clean Mem0
grade**. After the one permitted run, inspection showed that Mem0's default
`memory` vector store persists to `~/.mem0/vector_store.db`; the adapter's
fixed `collectionName` did not isolate it, so `open()` was not a fresh empty
store and later cases could see earlier benchmark memories. Nineteen rows
created by this run were identified mechanically by the unique
`benchmarkTurnId` metadata, copied to a private recovery database, and
removed; unrelated rows were untouched. The scored execution is consumed
and was not rerun.

Runtime identity: `mem0ai` `3.1.1`, `@google/genai` `1.40.0`, adapter
SHA-256
`8b5fff0d51efdf3568c01e8afa72a72a7ebf70cd79f30877c1ead564a4804ee3`.
Requested extraction model and provider-reported served version:
`gemini-2.5-flash-lite`. Requested embedding model:
`text-embedding-3-small`; Mem0's internal OpenAI client did not expose the
served embedding version to the adapter. No Gemini-to-OpenAI substitution
occurred.

Defaults retained except for the founder-specified models and local paths:
config version `v1.1`; additive extraction; history enabled with SQLite;
in-process `memory` vector store at dimension `1536`; no reranker. Telemetry
was disabled for the benchmark. The adapter supplied `user_id` filters and
exposed both Mem0 search results and retained source transcript rows.

All 13 Gemini calls (one smoke, twelve scored ingests) returned HTTP 200.
Exact Gemini spend was `$0.0110893`, with model-reported usage and zero
uncertainty. The OpenAI SDK used by Mem0 bypassed the fetch meter, so the
embedding component was not measured and an exact all-provider total cannot
honestly be claimed; consequently the adapter also cannot prove the hard cap
from its own ledger after the fact. The observed embedding workload was small,
but that is not a substitute for metering. This defect and the fresh-store
defect are adapter findings; neither authorizes a rerun.

Post-run offline repair (not part of the score): commit history preserves the
run-producing adapter at SHA-256
`8b5fff0d51efdf3568c01e8afa72a72a7ebf70cd79f30877c1ead564a4804ee3`.
The successor adapter at SHA-256
`ee35cbcd9b89c2a021ddd1a40540ba98f6f27e822a1e81100fb42002d35d5b30`
now supplies a fresh temporary SQLite vector path on every `open()` and
routes Mem0's native OpenAI embedding client through a loopback meter. Offline
tests prove distinct paths and metered proxy forwarding. No credential was
read, no provider was called, and the invalid column was not rerun or changed.

## P-set 6 — Gemini semantic scale probe, FINAL before scoring

Author: repository execution lane, 2026-07-30. Registered after one
non-scoring compatibility request received HTTP 200 from
`models/gemini-embedding-001:batchEmbedContents`, and before the first full
semantic scale-probe invocation.

The scoring bank is the 25 planted rows and two paraphrase columns in
`evals/run-scale-probe.mjs` at commit
`53c2dd376343c5cb3e1a6fdfe854427add008237`, file SHA-256
`17c5d4c851556e135dc1ec859ac76f30512913d00e6e9f73a08107acc32ab9cc`.
The run uses 2,500 turns (5,000 canonical messages), semantic top-20, requested
model `gemini-embedding-001`, symmetric task type `SEMANTIC_SIMILARITY`,
100-request provider batches, and no generation model. The canonical embedder
adapter SHA-256 is
`2f7eb09dcaeafcd4903289023160d19562d9f17a9a312be32ba3a82496a94035`.
The config serialization
`{"batchLimit":100,"maxTextChars":8000,"model":"gemini-embedding-001","taskType":"SEMANTIC_SIMILARITY","topK":20}`
has SHA-256
`193d7f6714f2a14bb8341b05f9ad397145972c45979a90475eed22c99faa10c8`.

Predictions, failing categories first:

1. ZERO-OVERLAP LEXICAL stays `0/25`.
2. ZERO-OVERLAP SEMANTIC moves to at least `20/25`.
3. SHARED-TOKEN LEXICAL stays `25/25`.
4. SHARED-TOKEN SEMANTIC is `25/25`.

The first complete physical scale-probe output grades these predictions
exactly as emitted. Any lower semantic result is a finding; it does not
authorize prompt/config changes, a reroll, or selective regrading.

## P-set 7 — Gemini temporal-graph probe, FINAL before scoring

Author: repository execution lane, 2026-07-30. Registered after exactly one
non-scoring compatibility request produced one host-normalized assertion on
its first physical call, and before the first 25-fact graph invocation.
Compatibility served `gemini-2.5-flash-lite`, returned HTTP 200 / `STOP`,
reported 280 input and 79 output tokens, and cost `$0.0000596` with zero
uncertainty.

The scoring bank reuses the 25 planted statements in
`evals/run-scale-probe.mjs` at file SHA-256
`17c5d4c851556e135dc1ec859ac76f30512913d00e6e9f73a08107acc32ab9cc`.
Only the statements are used; the paraphrase columns are irrelevant. The
Gemini graph adapter SHA-256 is
`cb56f399eae0cd52784403d3afe10a0b03ec2af44678658aa71162a27eb85c7c`.
The ignored one-shot harness SHA-256 at freeze is
`4d560125c0633825c9e31ec2a9a4afdff89f7f37acfbf49fe1ab4975d0be5a23`.

The run uses five chronological extraction batches of five user statements,
at most one host-guided repair per batch, requested model
`gemini-2.5-flash-lite`, provider-enforced JSON, thinking budget zero, and no
transport retry. Its complete config serialization has SHA-256
`d7ae7b3c978a7d9d5f4a6f488faefb2d9b633ea70b4d98e66704dc294e8b0cab`.

Predictions, failing categories first:

1. FACT COVERAGE: at least 20 of 25 planted relational statements produce
   one or more host-admitted graph edges.
2. TEMPORAL ANCHORS: at least 8 admitted edges carry a non-empty time phrase
   verified as an exact quote from their evidence.
3. QUOTE INTEGRITY: zero admitted edges carry a fabricated or paraphrased
   quote; every admitted quote is a contiguous substring of its canonical
   evidence.
4. SPEAKER PROVENANCE: zero admitted edges are attributed to anyone other
   than the user, because the 25-row bank contains user messages only and
   the host stamps speaker.
5. EXECUTION/ACCOUNTING: all five batches finish within ten physical Gemini
   requests, with no transport retry, measured graph-run spend below `$0.01`,
   and zero uncertainty.

The first complete physical result grades these rows exactly as emitted.
Any miss is a finding and does not authorize a changed bank, config, repair
ceiling, reroll, or selective regrading.

## P-set 8 — clean Mem0 trust re-measurement, FINAL before execution

Author: repository execution lane, 2026-07-30. The first Mem0 observation in
P-set 5 physically printed 2/5 but was invalid as a clean comparison because
its vector store was process-global and its OpenAI embedding client bypassed
the meter. This prediction freezes the one founder-authorized clean
replacement after both host seams were repaired offline. The invalid result is
not regraded, replaced, discarded, or combined with this run.

The five scripts and binary grading remain byte-identical in
`evals/trust-benchmark.mjs`, SHA-256
`d37f562fe5dfb80884b3b09c9fa2fe4d8aa3009fd2c91aa9a1d5af4ea6af31fc`,
version `palari-trust-benchmark/v1`. The repaired Mem0 adapter SHA-256 is
`ee35cbcd9b89c2a021ddd1a40540ba98f6f27e822a1e81100fb42002d35d5b30`;
it assigns every opened case a fresh temporary vector SQLite path and routes
the framework's native OpenAI embedding SDK through the loopback spend meter.
The ignored one-shot wrapper SHA-256 is
`b0ed5757c9d31a95aaf57e126d582ad224554fcd07b0d47ad6b4e1b000333d50`.

Runtime: Mem0 OSS 3.1.1, `@google/genai` 1.40.0, OpenAI SDK 4.104.0,
Gemini extraction model `gemini-2.5-flash-lite`, embedding model
`text-embedding-3-small`, and a combined `$1.00` hard cap. The config
serialization has SHA-256
`ed1779650f2140913e7490fd5ced8d55c665548f7ef6c4357f6e43221501a055`.
There is no new connectivity smoke: the first and only fresh invocation is
the scored five-case run.

Predictions, failing categories first:

1. VERIFIED DELETION: FAIL. Mem0 removes extracted memory but the adapter
   honestly exposes the retained source transcript, where `Lexapro` remains
   reachable.
2. SOURCE BOUNDARY: FAIL. Mem0 extraction reads tool/document content and is
   expected to surface at least one planted document claim as memory.
3. CORRECTION/CHRONOLOGY: FAIL. Braga is not expected to surface with enough
   usable chronology/supersession information to make an unmarked Porto result
   safely stale under the shared grader.
4. PARAPHRASED RECALL: PASS. Embedding retrieval finds the ceramic-pot fact.
5. SCOPE ISOLATION: PASS. The `user_id` filter keeps user A's Riverdale fact
   from user B.

Predicted clean score: 2/5. The run must use five fresh per-case stores, meter
both Gemini and OpenAI embedding calls, finish below the combined cap with
zero uncertainty, and preserve its report/provider evidence only under the
gitignored private artifact directory. The first physical result is final:
no rerun, score-driven adapter change, regrade, or public score is authorized.

## P-set 9 — J4 LongMemEval S-60 v6, FINAL before execution

Author: repository execution lane, 2026-07-30. Registered before any v6
provider request. The immutable machine-readable contract is
`evals/predictions/j4-longmemeval-s60-v6.json`; its 60 question-outcome rows
are inherited byte-for-byte from the hash-pinned v5 FINAL contract. No
outcome row was revised from the five-question v5 observation.

Identity `j4-longmemeval-s60-v6` starts from question zero on current `main`.
It verifies the five sealed v1-v5 S-60 bundles and carries their exact
`$0.7721877` accounted spend (`$0.7696867` measured plus `$0.0025010`
uncertain). The authorized fresh hard cap is `$5.00`, making the cumulative
meter boundary `$5.7721877`. The full-population planning projection is
`$10.0725399` fresh / `$10.8447276` cumulative, so a cap stop before question
60 is predicted and is terminal.

Predictions, failing and terminal categories first:

1. CAP: the fresh `$5.00` meter stops the invocation before question 60;
   between 35 and 55 questions complete.
2. WRITER SMOKE: the structured writer compatibility smoke passes on its
   first proposal or its one permitted host-guided proposal repair.
3. ANSWER SMOKE: the answer compatibility smoke passes.
4. FULL-POPULATION COUNTERFACTUAL: if all 60 rows were reachable, 36 are
   predicted correct and 24 incorrect: knowledge-update 9/10, multi-session
   6/10, single-session-assistant 0/10, single-session-preference 4/10,
   single-session-user 10/10, and temporal-reasoning 7/10.
5. EXECUTION INTEGRITY: one physical invocation only. A transport-valid
   writer proposal rejected by the frozen host contract may receive exactly
   one separately metered repair proposal. There is no second invocation,
   reroll, selective regrade, or post-result prediction change.

If either mandatory smoke fails, the runner stops before question 1 and that
failure is the final v6 result. If the meter or another fail-closed boundary
stops a question, the reached prefix is recorded exactly as observed; it is
not authority to resume or replace the run.

## P-set 10 — active retrieval reached-prefix regression, FINAL before scoring

Author: repository execution lane, 2026-07-30. Registered after the new
provider-neutral retrieval-to-answer implementation and its synthetic
contract tests were green, and before the first private-data invocation.
The active implementation is `src/retrieval-answer.mjs`, SHA-256
`c578c0190ebbe59c2e220b225e1f18af3ddca2a3b47d6669cdb51c62ca006e9b`.
The offline harness is
`evals/run-reached-prefix-retrieval-regression.mjs`, SHA-256
`400be86fbb3ab86b1aee092e64cb728f796682797370a25f79bd2c916a7ea0bc`.
Its ignored LongMemEval-S input has SHA-256
`d6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442`.

This is a structural regression, not an answer-quality score. It replays the
complete canonical journal for the six judged v6 questions plus truncated
question 7, then lets a deterministic local concept-vector stand-in drive
the optional semantic plumbing. The stand-in contains no expected answer or
answer-session identity. Real embedding quality remains the separate live
25/25 semantic scale result in P-set 6. No credential, provider SDK, network,
judge, or answer model is used.

Predictions, failing categories first:

1. POSITIVE RETRIEVAL: each of the five non-abstention reached questions
   returns canonical messages from every dataset-labelled answer-bearing
   session through `memory_search` (seven required sessions total).
2. TEMPORAL ABSTENTION: the December-bounded museum/gallery search for
   `80ec1f4f_abs` returns zero messages; this proves only the bounded search
   result, not real-world non-occurrence.
3. CANONICAL INTEGRITY: every returned message credited to an answer-bearing
   session is byte-identical to one of that session's canonical dataset
   messages.
4. QUESTION-7 RECOVERY: `0a34ad58` returns its one answer-bearing Tokyo
   session through the same hybrid path.
5. ANSWER BOUNDARY: the question-7 provider contract requests a direct,
   concise answer, recommends at least 512 output tokens, and the scripted
   regression answer is at most 64 words.
6. EXECUTION: all six reached cases and question 7 complete in the first
   invocation with exactly zero provider calls, zero network calls, and no
   answer-quality grade.

Any miss is retained as the result. It does not authorize changing the local
concept mapping, answer-session expectations, bounds, ranking limit, or
scoring and rerunning the same regression.

## P-set 11 — active retrieval seen-six live re-measurement, FINAL before execution

Author: repository execution lane, 2026-07-30. The founder explicitly
directed a live run on the same six previously reached and inspected S-60 v6
questions. This is a new diagnostic identity,
`j4-active-retrieval-seen6-v1`; it does not resume, replace, regrade, or alter
the sealed v6 `1/6`. Because the cases and their answer-bearing sessions have
been inspected, this result will be labelled a seen-case re-measurement and
will not be presented as an unbiased estimate of generalization.

The ordered question IDs are exactly `08e075c7`, `09d032c9`, `16c90bf4`,
`5e1b23de`, `80ec1f4f_abs`, and `0977f2af`. The ignored dataset SHA-256 is
`d6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442`.
The active retrieval implementation SHA-256 is
`c578c0190ebbe59c2e220b225e1f18af3ddca2a3b47d6669cdb51c62ca006e9b`;
the canonical Gemini embedder adapter SHA-256 is
`2f7eb09dcaeafcd4903289023160d19562d9f17a9a312be32ba3a82496a94035`;
and the ignored one-shot harness SHA-256 is
`750753ec8492fa005e9c9840c476e0adc92c3fc84943ec4a60cdabc12df547ca`.

The six histories contain 2,882 canonical messages and 2,927,794 visible
UTF-8 bytes. Some canonical messages exceed the embedder's 8,000-character
single-input boundary (maximum 13,382 characters). The frozen,
answer-independent adapter therefore splits every message into consecutive
at-most-8,000-character chunks, embeds every chunk with
`gemini-embedding-001` / `SEMANTIC_SIMILARITY`, averages all chunk vectors
belonging to one canonical message, and L2-normalizes that mean. The semantic
index remains a finding aid; every credited result is read back from the
complete canonical journal.

One command is the complete physical invocation. It first runs one combined
native-tool/semantic compatibility smoke. The smoke must call
`memory_search`, use real semantic retrieval, and answer the planted
compatibility token; otherwise it stops before all six benchmark questions.
If it passes, each question starts from a fresh canonical journal and vector
index, uses the same `gemini-3.5-flash-lite` answer model as v6 with native
AUTO tools, at most six memory
tool calls and seven answer-model dispatches, requests 512 answer tokens, and
receives exactly one no-retry official `gpt-4o-2024-08-06` judge call.
There is no writer, reducer, graph extraction, transport retry, reroll, or
regrade.

Fresh spend has a founder-authorized hard cap of `$5.00`, carrying the exact
S-60 lineage opening balance of `$1.5885167` to a `$6.5885167` cumulative
boundary. Before every Gemini generation request the shared meter reserves
the full `$0.4784128` provider window at the frozen standard prices; before
every judge request it verifies
the full `$0.5441700` priority-tier reservation; embedding requests reserve
one token per UTF-8 text byte at `$0.15` per million. Valid provider-reported
usage releases a reservation to measured spend. Absent embedding usage
remains uncertain and fully accounted.

Predictions, failing categories first:

1. COMPATIBILITY: the combined native-tool/semantic smoke passes before any
   benchmark question.
2. RETRIEVAL COVERAGE: the five positive questions consult all seven
   dataset-labelled answer-bearing sessions; the abstention question is
   reported separately and is not credited with a zero-session success.
3. OFFICIAL ACCURACY: at least `4/6` answers are marked correct by the frozen
   official judge.
4. SEMANTIC USE: at least five of six scored questions issue one or more
   successful `memory_search` calls with the real Gemini semantic surface.
5. ANSWER BOUNDARY: all six answer completions finish without truncation,
   retrieval-budget exhaustion, or a seventh-turn tool request.
6. EXECUTION/ACCOUNTING: the first command is final, completes below the
   fresh `$5.00` cap, records measured and uncertain spend separately, and
   makes at most six official judge calls. Any stop or miss is the result and
   authorizes no retry, reroll, selective regrade, or prediction change.

## P-set 12 — Gemini-lowered active retrieval seen-six successor, FINAL before execution

Author: repository execution lane, 2026-07-31. The founder authorized the
narrow provider repair and successor run after reviewing why provider
frameworks maintain explicit adapters. This is a fresh identity,
`j4-active-retrieval-seen6-v2`; it does not resume, retry, replace, regrade,
or alter terminal v1, the sealed v6 `1/6`, or any prior answer or judge label.
The same six cases remain inspected and this result remains a seen-case
diagnostic, not an unbiased generalization estimate.

The only intended provider-behavior change is Gemini tool-schema lowering.
The canonical five-tool contract remains SHA-256
`743c653b8ae0d29869904de969768fc25ae9ccb165d7ec704148da24eaa0ea3e`.
The provider adapter repeats `evidenceIds` in the first `memory_read`
`anyOf` branch's local `properties` and `session` in the second branch's
local `properties`; it preserves the root properties and both `anyOf`
branches. The resulting Gemini tool declaration SHA-256 is
`231ae8595fca2ecc1fc7c91e5fd99aa4028d3dcf2fa79e5ff271adacc6f6720a`.
Host execution and validation still consume the unchanged canonical request.

The active retrieval implementation remains SHA-256
`c578c0190ebbe59c2e220b225e1f18af3ddca2a3b47d6669cdb51c62ca006e9b`;
the reusable Gemini adapter is
`7e365f762d47e3482768e0df1c0a3b0b4bf75eda2ab71124141832b5fa4cae3e`;
the sealed v1 base harness remains
`750753ec8492fa005e9c9840c476e0adc92c3fc84943ec4a60cdabc12df547ca`;
the ignored successor launcher is
`55b69ec3e5368910bd04e5b81343ea07ede677c3317fa6f48afb4b57c154a7e0`;
and its deterministically generated runtime is
`549fcb69e2f902f8f5a1e01e71a880b4882d751c1aba2fcd00f1251553362e3c`.
The ignored dataset and ordered six IDs are byte-identical to P-set 11.

Terminal v1's exact `$0.4784128` uncertainty is carried into the opening
S-60 balance of `$2.0669295`. V2 receives only the remaining `$4.5215872`
of the original `$5.00` shared window, retaining the same `$6.5885167`
cumulative boundary. One command is the complete invocation. It first runs
the same combined native-tool/semantic smoke and stops before scoring on any
failure. Otherwise it answers and judges the same ordered six once. There is
no writer, reducer, graph extraction, transport retry, reroll, or regrade.

Predictions, failing categories first:

1. COMPATIBILITY: Gemini accepts all five lowered native tool declarations;
   the combined smoke calls `memory_search`, uses the real semantic surface,
   and answers the planted indigo token before any benchmark question.
2. RETRIEVAL COVERAGE: the five positive questions consult all seven
   dataset-labelled answer-bearing sessions; the abstention question is
   reported separately and is not credited with a zero-session success.
3. OFFICIAL ACCURACY: at least `4/6` answers are marked correct by the
   unchanged `gpt-4o-2024-08-06` official judge.
4. SEMANTIC USE: at least five of six scored questions issue one or more
   successful `memory_search` calls with the real Gemini semantic surface.
5. ANSWER BOUNDARY: all six answer completions finish without truncation,
   retrieval-budget exhaustion, or a seventh-turn tool request.
6. EXECUTION/ACCOUNTING: the first command is final, completes below the
   remaining `$4.5215872` fresh cap and `$6.5885167` cumulative boundary,
   records measured and uncertain spend separately, and makes at most six
   official judge calls. Any stop or miss is the result and authorizes no
   retry, reroll, selective regrade, or prediction change.

## P-set 13 — Gemini raw-schema active retrieval seen-six successor, FINAL before execution

Author: repository execution lane, 2026-07-31. The founder explicitly
authorized running questions 1–6 again after reviewing the offline raw-schema
repair. This is one fresh identity, `j4-active-retrieval-seen6-v3`; it does
not resume, retry, replace, regrade, or alter terminal v1 or v2, the sealed v6
`1/6`, or any prior answer or judge label. These same six cases remain
inspected, so the result is a seen-case diagnostic and not an unbiased
generalization estimate.

The only intended provider-behavior changes from terminal v2 are the two
offline R4 repairs. All five canonical function schemas now travel unchanged
through Gemini's `parametersJsonSchema` field, with no legacy `parameters`
member and no branch-local rewriting. The retrieval guidance now contains
the exploration instruction as one complete string rather than spreading it
into characters. The canonical five-tool SHA-256 remains
`743c653b8ae0d29869904de969768fc25ae9ccb165d7ec704148da24eaa0ea3e`;
the raw Gemini declaration SHA-256 is
`d2d09fa4b32372324ff8ab8b53b2683e2a4580e87eeb409fba3c942ca7912d0f`.
Host execution and validation still consume the unchanged canonical request.

The frozen Gemini adapter SHA-256 is
`32cd1c589f8173ae19d1bd39f544ad4ef6fba682ba2d66df3f8034802144ed5a`;
the repaired active retrieval path is
`44be2c15732d59160cf3a839ac02622c63202ffc891bc0df6c1f6cdf49be8998`;
the sealed v1 base harness remains
`750753ec8492fa005e9c9840c476e0adc92c3fc84943ec4a60cdabc12df547ca`;
the ignored one-shot v3 launcher is
`3371a9f04fd1a6a04f7e044d3dfd7346aeea74e05a50854e52590d205f85dc53`;
and its deterministic runtime is
`220e53ece04efda939194d630da7b82f6f646d9697e3cd7e74f66cf8617ff8cc`.
The ignored dataset remains
`d6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442`,
and the ordered question IDs remain exactly `08e075c7`, `09d032c9`,
`16c90bf4`, `5e1b23de`, `80ec1f4f_abs`, and `0977f2af`.

Terminal v1 and v2 are preserved and reverified through their exact
post-run manifest hashes
`5749bffc34512b065fdd7c1f999384d4a3c45ee002cd37766b161674ca8caec4`
and
`16d8137209f1bab8e19cb7feb9428071464daa8e8b02411bb4ec77a8075cf793`.
Their cumulative accounted spend is carried forward exactly:
`$2.5453423` opening, comprising `$1.5860157` measured and `$0.9593266`
uncertain. V3 receives only the remaining `$4.0431744` under the unchanged
`$6.5885167` cumulative boundary. One command is the complete invocation. It
first runs the same combined native-tool/semantic smoke and stops before
question 1 on any failure. Otherwise it answers and judges the same ordered
six exactly once. There is no writer, reducer, graph extraction, transport
retry, reroll, or regrade.

Predictions, failing categories first:

1. COMPATIBILITY: Gemini accepts all five raw JSON Schema declarations; the
   combined smoke calls `memory_search`, uses the real semantic surface, and
   answers the planted indigo token before any benchmark question.
2. RETRIEVAL COVERAGE: the five positive questions consult all seven
   dataset-labelled answer-bearing sessions; the abstention question is
   reported separately and is not credited with a zero-session success.
3. OFFICIAL ACCURACY: at least `4/6` answers are marked correct by the
   unchanged `gpt-4o-2024-08-06` official judge.
4. SEMANTIC USE: at least five of six scored questions issue one or more
   successful `memory_search` calls with the real Gemini semantic surface.
5. ANSWER BOUNDARY: all six answer completions finish without truncation,
   retrieval-budget exhaustion, or a seventh-turn tool request.
6. EXECUTION/ACCOUNTING: the first command is final, completes below the
   remaining `$4.0431744` fresh cap and `$6.5885167` cumulative boundary,
   records measured and uncertain spend separately, and makes at most six
   official judge calls. Any stop or miss is the result and authorizes no
   retry, reroll, selective regrade, or prediction change.

## P-set 14 — bounded Gemini request debugging round, FINAL before execution

Author: repository execution lane, 2026-07-31. The founder authorized an
adaptive debugging round with multiple unique provider tests and continuous
fixes under one hard `$0.50` total cap. This is not a benchmark rerun or a
score. It cannot resume or alter any terminal seen-six identity, execute a
LongMemEval question, call a judge, reroll a diagnostic cell, or publish a
result.

The fixed source is terminal v3's 6,473-byte compatibility request, SHA-256
`b6d9e86c43911dc648c2ef607ad2ef5738bf399b97b3825fdd4d7119e5d6b96a`,
from transcript
`e9934148f3a9e494a051c7ebb8ec41e0e954fa5822210efc367d81ff5637a39c`.
The installed and lockfile-pinned official `@google/genai` `1.40.0`
transformer hashes
`92048d8be8816a3a67fbadd8cef66b87fdb5cc0ebad80883e36462507355ba6e`.
An offline intercepted SDK request preserves the same five
`parametersJsonSchema` declarations but serializes only `contents`,
`systemInstruction`, `tools`, `toolConfig`, and `generationConfig`; it omits
terminal v3's top-level `store: false`.

The ignored diagnostic harness hashes
`24ce3c84eef3e42694807a0986706e022b63539707b161a475fa54632bc8042f`.
It permits only ten named cells, each at most once, and shares one persistent
`$0.50` meter. Before every request it reserves one input token per serialized
UTF-8 byte at `$0.30` per million plus the cell's entire output allowance at
`$2.50` per million. Valid usage reconciles to measured spend; any failure or
missing usage retains the conservative reservation as uncertain. No retry is
implemented.

Adaptive predictions and stopping rules:

1. PRIMARY — `full-without-store`: deleting only top-level `store` from the
   exact terminal request returns HTTP 200 and a `memory_search` function
   call. Together with terminal v3's immutable HTTP 400 control, this isolates
   `store` as the rejected field.
2. BASELINE FALLBACK — only if the primary cell is not HTTP 200, `minimal`
   returns HTTP 200. `minimal-store` then returns HTTP 400 while the otherwise
   identical no-store cell remains accepted.
3. TOOL FALLBACK — only if the store pair does not isolate the failure,
   `raw-simple` returns HTTP 200. The canonical tools then run at most once
   each in fixed order: `memory_timeline`, `memory_read`, `memory_find`,
   `memory_search`, `memory_graph`. The first rejection identifies the
   unsupported declaration; accepted cells are not repeated.
4. FIX — apply only the smallest change supported by the observed control
   pair. Historical sealed request bytes remain untouched.
5. PRODUCT VERIFICATION — `corrected-product-smoke` serializes the exact
   terminal request through the repaired reusable product boundary, proves
   that the rejected field is absent, returns HTTP 200, and emits a
   `memory_search` function call. It runs exactly once.
6. ACCOUNTING — the round stops before `$0.50`, records measured and uncertain
   spend separately, and makes no LongMemEval, embedding, OpenAI, judge,
   reroll, regrade, or publication call. Any unresolved outcome at the cap is
   the finding.

## P-set 15 — Gemini generation-control isolation, FINAL before execution

Author: repository execution lane, 2026-07-31. This is the adaptive successor
inside the founder-authorized P-set 14 debugging round, not new spend
authority. `full-without-store` and `minimal` were each invoked once and both
returned generic HTTP 400. Their immutable request hashes are
`3936dcb3316ce6a8ebfdf66f9cf3bc2bd4d8883cfd6c17fb634f800140763fd6`
and
`fb9e01f8f6f793cc236b6f5ec2c4981f30b510d7a0b4a359b8eedf004929cffc`.
The v1 debugging meter is
`d28c338b4605969ea43642918fbe466699a4e97804c132082533fccd1c9248f5`
and carries `$0.0032869` uncertain/accounted into this successor. This
refutes P-set 14's store-only hypothesis and places the failure below tools;
both rejected bodies share `thinkingConfig: {thinkingBudget: 0}`.

The ignored v2 diagnostic harness hashes
`f0accc9d5acb13d0a82113216c37a0c85e27e56cb304a86b97d8502db596fd65`.
It verifies the exact predecessor meter, preserves the shared `$0.50` cap,
and permits six new unique cells at most once each. It does not execute a
benchmark, embedding, judge, retry, reroll, regrade, or publication action.

Adaptive predictions and stopping rules:

1. `default-generation`, with only canonical user content and no generation
   override, returns HTTP 200. This proves the model, credential, endpoint,
   and content envelope are valid.
2. `minimal-thinking-level`, using the current Gemini 3.5 control
   `thinkingLevel: MINIMAL`, returns HTTP 200. Against the immutable
   `thinkingBudget: 0` HTTP 400 control, this isolates the stale zero-budget
   setting.
3. `full-thinking-level-with-store` returns HTTP 200 and emits
   `memory_search`. If it does, `store: false` is accepted and no no-store
   full cell runs. If it fails, `full-thinking-level-no-store` runs once; an
   HTTP 200 there proves both fields require correction.
4. `full-no-thinking-no-store` runs only if the thinking-level full cells do
   not isolate the cause; it distinguishes the remaining generation control
   from the tool envelope.
5. Apply the smallest supported reusable boundary repair, preserving all
   historical sealed bytes. Then `corrected-product-smoke` runs once and must
   serialize no `store`, serialize `thinkingLevel: MINIMAL` with no
   `thinkingBudget`, return HTTP 200, and emit `memory_search`.
6. All v1+v2 cells share the original `$0.50` ceiling. Any failure without
   usage remains conservatively accounted at its request-sized reservation;
   the round stops before the next cell could cross the cap.

## P-set 16 — corrected Gemini 3.5 product boundary smoke, FINAL before execution

Author: repository execution lane, 2026-07-31. This is the final product
verification inside the same founder-authorized `$0.50` debugging round.
P-set 15's three required cells all returned HTTP 200 on their first calls:
default generation, `thinkingLevel: MINIMAL`, and the complete five-tool
request with explicit `store: false`. The complete request emitted
`memory_search`. Its request SHA-256 is
`190a7835249659c1690f0394cf76a543a3a360e8624f31ae7ae84a33cd1b6b1b`
and transcript SHA-256 is
`abb399f9524e6979d20995142f97377cff9d98676e89b8b856f0ee18944ac55c`.
This isolates terminal v3's stale `thinkingBudget: 0`; it also proves that
`store: false` and all five raw schemas are accepted together.

The smallest reusable repair is model-specific. For Gemini 3.5 only,
`buildGeminiGenerateRequest` maps a legacy zero thinking budget to
`thinkingLevel: MINIMAL`, preserves every other thinking field and explicit
no-store, and does not mutate the caller. Current thinking levels and Gemini
2.5 zero-budget controls remain unchanged. The repaired adapter hashes
`95e61649311476ea6198d2f434165b14d5527b3113553d2ef6a4b597a61bd292`;
its focused contract is 6/6 green.

D1+D2 carry exactly `$0.0037519` accounted into the final cell:
`$0.0004650` measured plus `$0.0032869` uncertain. The ignored one-shot D3
harness hashes
`f9cca71385f2facb4fb1f75185b9565f587f9bbd784b39720eb26174b33c0ed1`
and verifies D2's exact meter
`62e0b83b56088b840d57bb55fd87cb79659aece9429634fec8526cf716e70280`.
It serializes terminal v3's exact source body through the repaired product
boundary. The resulting 6,480-byte body is byte-identical to P-set 15's
accepted full control: five raw schemas, `store: false`, and
`thinkingLevel: MINIMAL` with no `thinkingBudget`.

Predictions and stopping rules:

1. The one corrected-product request returns HTTP 200 with `STOP` and emits
   `memory_search`.
2. Provider usage reconciles to measured spend; total D1+D2+D3 accounted
   spend remains below `$0.01` and far below the `$0.50` hard cap.
3. No fallback cell, benchmark question, embedding, OpenAI judge, retry,
   reroll, regrade, or publication runs. The debugging round closes after
   this one call whatever its result.

## P-set 17 — repaired Gemini active-retrieval seen-six v4, FINAL before execution

Author: repository execution lane, 2026-07-31. After the debugging round
isolated and live-proved the Gemini 3.5 request repair, the founder explicitly
authorized running questions 1–6 again. This is one fresh identity,
`j4-active-retrieval-seen6-v4`; it does not resume, retry, replace, regrade, or
alter terminal v1–v3, the debugging cells, the sealed v6 `1/6`, or any prior
answer or judge label. These same six cases have been inspected, so the result
is a seen-case diagnostic and not an unbiased generalization estimate.

The intended provider-behavior change from terminal v3 is only the
live-supported product repair: on `gemini-3.5-*`, the request boundary maps
legacy `thinkingBudget: 0` to `thinkingLevel: MINIMAL`. It preserves explicit
`store: false`, all five canonical raw JSON Schema declarations, and the
unchanged host tool contract. The repaired Gemini adapter SHA-256 is
`95e61649311476ea6198d2f434165b14d5527b3113553d2ef6a4b597a61bd292`;
the active retrieval path is
`44be2c15732d59160cf3a839ac02622c63202ffc891bc0df6c1f6cdf49be8998`.
The canonical five-tool SHA-256 remains
`743c653b8ae0d29869904de969768fc25ae9ccb165d7ec704148da24eaa0ea3e`,
and the raw Gemini declaration SHA-256 remains
`d2d09fa4b32372324ff8ab8b53b2683e2a4580e87eeb409fba3c942ca7912d0f`.

The sealed v1 base harness remains
`750753ec8492fa005e9c9840c476e0adc92c3fc84943ec4a60cdabc12df547ca`;
the ignored one-shot v4 launcher is
`fb83320a86c6c84805a71686c1329d335fd4bc314bb87ef18cee5d5cd23df44d`;
and its deterministic runtime is
`9155b4e4dcbd9b96018e546563a3d99d039f4644c21a3cebea8deaa5bfd185e6`.
The ignored dataset remains
`d6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442`,
and the ordered question IDs remain exactly `08e075c7`, `09d032c9`,
`16c90bf4`, `5e1b23de`, `80ec1f4f_abs`, and `0977f2af`.

Terminal v1, v2, and v3 plus the completed debugging round are preserved and
reverified through their exact post-run manifest hashes:
`5749bffc34512b065fdd7c1f999384d4a3c45ee002cd37766b161674ca8caec4`,
`16d8137209f1bab8e19cb7feb9428071464daa8e8b02411bb4ec77a8075cf793`,
`0f1432b6c2027a45ce67590ebf8cd3462f835e8ec5a71901e1aded04ee697a36`,
and
`f6432faad00b18d3e2e8221f4016355c33b4a526078c76e359a81b0ae0af9562`.
Their total J4-related accounted spend is carried forward exactly:
`$3.0279590` opening, comprising `$1.5869327` measured and `$1.4410263`
uncertain. V4 receives only the remaining `$3.5605577` under the unchanged
`$6.5885167` cumulative boundary.

One command is the complete invocation. It first runs the same combined
native-tool/semantic smoke and stops before question 1 on any failure.
Otherwise it answers and judges the same ordered six exactly once. There is no
writer, reducer, graph extraction, transport retry, reroll, selective regrade,
or second invocation.

Predictions, failing categories first:

1. COMPATIBILITY: Gemini accepts all five raw JSON Schema declarations; the
   combined smoke calls `memory_search`, uses the real semantic surface, and
   answers the planted indigo token before any benchmark question.
2. RETRIEVAL COVERAGE: the five positive questions consult all seven
   dataset-labelled answer-bearing sessions; the abstention question is
   reported separately and is not credited with a zero-session success.
3. OFFICIAL ACCURACY: at least `4/6` answers are marked correct by the
   unchanged `gpt-4o-2024-08-06` official judge.
4. SEMANTIC USE: at least five of six scored questions issue one or more
   successful `memory_search` calls with the real Gemini semantic surface.
5. ANSWER BOUNDARY: all six answer completions finish without truncation,
   retrieval-budget exhaustion, or a seventh-turn tool request.
6. EXECUTION/ACCOUNTING: the first command is final, completes below the
   remaining `$3.5605577` fresh cap and `$6.5885167` cumulative boundary,
   records measured and uncertain spend separately, and makes at most six
   official judge calls. Any stop or miss is the result and authorizes no
   retry, reroll, selective regrade, or prediction change.

## P-set 18 — captured-judge active-retrieval seen-six v5, FINAL before execution

Author: repository execution lane, 2026-07-31. The founder authorized fixing
the local judge-wiring defect exposed by terminal v4, but has not authorized a
new live invocation. This freeze prepares fresh identity
`j4-active-retrieval-seen6-v5`; it does not resume, retry, replace, regrade, or
alter terminal v1–v4, the debugging cells, the sealed v6 `1/6`, or v4's
unjudged question-1 answer. The same six cases remain inspected, so any future
result is a seen-case diagnostic rather than an unbiased generalization
estimate.

The only intended behavior change from terminal v4 is at the local
answer-to-judge composition seam. New tracked module
`evals/active-retrieval-seen6-runtime.mjs`, SHA-256
`1b0397fdb00a7181c681ab2aed0750c7051b1b3a8a8dc19ff29c2feb1a9b7c56`,
captures one fetch implementation before judge construction, supplies it to
the unchanged fail-closed transport, and prevents caller options from
overriding it. Its exact regression test hashes
`7b1e2e4ee21ca57a4ba4124c418565441faaf2fcda45ca2752e1ee255ac9fe52`
and crosses the real judge transport once with fake HTTP. The transport itself
still rejects a missing captured fetch; no default or implicit network path
was added.

The repaired Gemini adapter remains
`95e61649311476ea6198d2f434165b14d5527b3113553d2ef6a4b597a61bd292`;
the active retrieval path remains
`44be2c15732d59160cf3a839ac02622c63202ffc891bc0df6c1f6cdf49be8998`;
the canonical five-tool SHA-256 remains
`743c653b8ae0d29869904de969768fc25ae9ccb165d7ec704148da24eaa0ea3e`;
and the raw Gemini declaration SHA-256 remains
`d2d09fa4b32372324ff8ab8b53b2683e2a4580e87eeb409fba3c942ca7912d0f`.

The sealed v1 base harness remains
`750753ec8492fa005e9c9840c476e0adc92c3fc84943ec4a60cdabc12df547ca`;
the ignored v5 launcher hashes
`2aa2d7341529cbc20c8ea6d88ea0b74cd8b157560183a9ed0c3980f306381728`;
and its deterministic runtime hashes
`0b820acfb1a81dc702031fa3002ca9b098aeaefdae68de17534f49dd0cfe89d7`.
The ignored dataset remains
`d6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442`,
and the ordered question IDs remain exactly `08e075c7`, `09d032c9`,
`16c90bf4`, `5e1b23de`, `80ec1f4f_abs`, and `0977f2af`.

Terminal v1–v4 and the completed debugging round are preserved and reverified
through their exact post-run manifest hashes:
`5749bffc34512b065fdd7c1f999384d4a3c45ee002cd37766b161674ca8caec4`,
`16d8137209f1bab8e19cb7feb9428071464daa8e8b02411bb4ec77a8075cf793`,
`0f1432b6c2027a45ce67590ebf8cd3462f835e8ec5a71901e1aded04ee697a36`,
`e6a63b46c1f1b9a1f8c2163631ac160957fe21cdb2eaa62501b25dc918e7829f`,
and
`f6432faad00b18d3e2e8221f4016355c33b4a526078c76e359a81b0ae0af9562`.
V4's launcher and runtime are also reverified directly. Exact total J4-related
opening spend is `$3.10618695`, comprising `$1.5904422` measured and
`$1.51574475` uncertain. V5 receives only the remaining `$3.48232975` under
the unchanged `$6.5885167` cumulative boundary.

If separately authorized, one launcher command is the complete invocation. It
first runs the same combined native-tool/semantic smoke and stops before
question 1 on any failure. Otherwise it answers and judges the same ordered
six exactly once. There is no writer, reducer, graph extraction, transport
retry, reroll, selective regrade, or second invocation.

Predictions, failing categories first:

1. JUDGE WIRING: after question 1 reaches an answer, the captured fetch crosses
   the unchanged judge transport and produces one validated official label;
   `JUDGE_FETCH_MISSING` does not recur.
2. COMPATIBILITY: Gemini accepts all five raw JSON Schema declarations; the
   combined smoke calls `memory_search`, uses the real semantic surface, and
   answers the planted indigo token before any benchmark question.
3. RETRIEVAL COVERAGE: the five positive questions consult all seven
   dataset-labelled answer-bearing sessions; the abstention question is
   reported separately and is not credited with a zero-session success.
4. OFFICIAL ACCURACY: at least `4/6` answers are marked correct by the
   unchanged `gpt-4o-2024-08-06` official judge.
5. SEMANTIC USE: at least five of six scored questions issue one or more
   successful `memory_search` calls with the real Gemini semantic surface.
6. ANSWER BOUNDARY: all six answer completions finish without truncation,
   retrieval-budget exhaustion, or a seventh-turn tool request.
7. EXECUTION/ACCOUNTING: the first command is final, completes below the
   remaining `$3.48232975` fresh cap and `$6.5885167` cumulative boundary,
   records measured and uncertain spend separately, and makes at most six
   official judge calls. Any stop or miss is the result and authorizes no
   retry, reroll, selective regrade, or prediction change.

## P-set 19 — repaired-answer active retrieval first-ten v1, FINAL before execution

Author: repository execution lane, 2026-07-31. The founder explicitly
authorized a fresh run over all LongMemEval S60 ordinals 1-10, rather than the
previous first-six or reached-prefix first-seven checks. Fresh identity
`j4-active-retrieval-first10-v1` answers and officially judges all ten once.
It neither resumes nor changes terminal seen-six v1-v5, and it does not grade
the provider-free question-7 boundary. These cases have been inspected; this
is a private seen-case diagnostic, not an unbiased generalization estimate.

The exact ordered IDs are `08e075c7`, `09d032c9`, `16c90bf4`, `5e1b23de`,
`80ec1f4f_abs`, `0977f2af`, `0a34ad58`, `0edc2aef`, `10d9b85a`, and
`1192316e`; their ordered array hashes
`d3a9a8c234468e0120d605c7868b418a5ab3313384d0d162e11a30ab6d9fe4cf`.
The ignored MIT-licensed dataset remains
`d6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442`.
The nine positive cases require 13 labelled answer-bearing sessions in total;
the ordinal-5 abstention is reported separately and receives no zero-session
coverage credit.

This run measures the accepted BRN-0001 answer boundary. `src/brain.mjs`
hashes `01deae1731583442cde12e55a20ef285bd3b08fed7ecb933377839a4b11f53f2`;
`src/retrieval-answer.mjs` hashes
`c322357999e35d13b366b72e23d5a1cc6c3f8ae3df4937456426e9d491a45972`;
the provider-free five-case composition regression hashes
`b45340023ec39acc147375cb7c36141419d178dbac4c3e4f7203b5dd932d0a3a`.
The assembled answer system instruction hashes
`69f6a15608fb8541e5b0df86dae23401c97f0fe1b9d6ef3c594977db3334939e`.
The unchanged five raw Gemini declarations hash
`d2d09fa4b32372324ff8ab8b53b2683e2a4580e87eeb409fba3c942ca7912d0f`;
Gemini answer model remains `gemini-3.5-flash-lite` with explicit no-store and
`thinkingLevel: MINIMAL`. The official judge remains
`gpt-4o-2024-08-06`; its request configuration hashes
`f0fdcc9a6a584c550b8c5ea8d961422b0ab3c2a054ea4ca5ce1cd0fa36e7c048`.

The one-shot private launcher hashes
`ca214d38dddf57ac727f08033b05e067d621a882cf8fe3f09e51f20023858594`;
its deterministic runtime hashes
`29ce9a0c0a59a5bc01b364cb027c29bfdc4f5b6d41e0a384e895ee1d09c87dda`.
It derives only from terminal v5 runtime
`0b820acfb1a81dc702031fa3002ca9b098aeaefdae68de17534f49dd0cfe89d7`,
adds the four ordered IDs, points output outside repository danger zones,
pins current product hashes, and corrects only the report's already-known
coverage join from absent `row.evidence_id` to canonical `row.id`. The answer,
retrieval, provider, and official-judge behavior are otherwise unchanged.

Terminal seen-six v1-v5 and the completed Gemini debug bundle are reverified
through manifest hashes
`5749bffc34512b065fdd7c1f999384d4a3c45ee002cd37766b161674ca8caec4`,
`16d8137209f1bab8e19cb7feb9428071464daa8e8b02411bb4ec77a8075cf793`,
`0f1432b6c2027a45ce67590ebf8cd3462f835e8ec5a71901e1aded04ee697a36`,
`e6a63b46c1f1b9a1f8c2163631ac160957fe21cdb2eaa62501b25dc918e7829f`,
`72d1535dce30b5a992dbddb88854a89afae9ab80ad5a552e6915c1a65e93b20b`,
and
`f6432faad00b18d3e2e8221f4016355c33b4a526078c76e359a81b0ae0af9562`.
Their exact J4 ledger is carried forward: `$3.57540465` accounted,
`$1.6204536` measured, and `$1.95495105` uncertain. This identity has a
`$1.50` fresh hard cap and `$5.07540465` cumulative boundary. Linear evidence
from v5 predicts about `$0.78` fresh accounted spend; the cap also covers the
largest sequential answer or judge reservation without permitting an
uncapped run.

One launcher invocation is final. It performs the same combined
native-tool/semantic compatibility smoke and stops before question 1 if the
smoke fails. Otherwise it answers and judges all ten in order. There is no
writer, reducer, graph extraction, transport retry, reroll, selective
regrade, second invocation, or publication.

Predictions, failing categories first:

1. OFFICIAL ACCURACY: at least `8/10` answers receive a correct label from the
   unchanged official judge. Within that total, the repaired first six reach
   at least `5/6`, and new ordinals 7-10 reach at least `3/4`.
2. REPAIRED FAILURE CLASSES: at least two of the three v5 answer-use misses
   (`09d032c9`, `5e1b23de`, `0977f2af`) change from FAIL to PASS. The exact
   per-question labels remain the measurement; this aggregate prediction
   does not license selective regrading.
3. COMPATIBILITY/JUDGE WIRING: before question 1, Gemini accepts all five raw
   schemas, calls `memory_search` over the real semantic surface, and answers
   the planted indigo token. Every reached answer crosses the captured judge
   fetch and receives one validated official label.
4. RETRIEVAL COVERAGE: the ten answers consult at least 12 of the 13 labelled
   positive-case answer-bearing sessions. Ordinal 5 remains a separate
   abstention and receives no zero-session credit.
5. SEMANTIC USE: at least nine of ten scored questions issue one or more
   successful `memory_search` calls with the real Gemini semantic surface.
6. ANSWER BOUNDARY: all ten completions finish without truncation,
   retrieval-budget exhaustion, or a seventh-turn tool request.
7. EXECUTION/ACCOUNTING: the first command is terminal, remains within the
   `$1.50` fresh and `$5.07540465` cumulative hard caps, records measured and
   uncertain spend separately, and makes at most ten official judge calls.
   Any smoke failure, question error, or miss is the result and authorizes no
   retry, reroll, selective regrade, prediction edit, or replacement identity.

## P-set 20 — Luna-low provider comparison on first ten, FINAL before execution

Author: repository execution lane, 2026-08-02. After accepting the offline
OpenAI adapter, the founder explicitly authorized one fresh Luna comparison
over the exact LongMemEval S60 ordinals 1-10 under a `$1.00` fresh cap. Fresh
identity `j4-luna-retrieval-first10-v1` is a provider A/B comparator, not a
resume, reroll, regrade, or replacement of terminal Gemini identity
`j4-active-retrieval-first10-v1`. The cases and their labels are already
inspected, so this remains a private seen-case diagnostic rather than an
unbiased generalization estimate.

The exact ordered IDs remain `08e075c7`, `09d032c9`, `16c90bf4`, `5e1b23de`,
`80ec1f4f_abs`, `0977f2af`, `0a34ad58`, `0edc2aef`, `10d9b85a`, and
`1192316e`; their ordered array hashes
`d3a9a8c234468e0120d605c7868b418a5ab3313384d0d162e11a30ab6d9fe4cf`.
The ignored MIT-licensed dataset remains
`d6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442`.
The nine positive cases still require 13 labelled answer-bearing sessions;
ordinal 5 is an abstention and receives no zero-session coverage credit.

Only the answer/tool-decision provider changes. The comparator uses OpenAI
`gpt-5.6-luna`, standard mode, `reasoning.effort: low`, explicit
`store:false`, no parallel tool calls, encrypted reasoning-item continuation,
at most seven dispatches, and the accepted `palari-brain/openai` adapter
hash `1ccd63e4aa859d30b742b1ceda23e71c1973f5d3fcb0bbb33cb727962336c279`.
Its five OpenAI function declarations hash
`3a955ef2069603b9bf0842412feb6600a521d7474a1c7a73d7daf11d4fed8354`.
The answer instructions remain byte-identical at
`69f6a15608fb8541e5b0df86dae23401c97f0fe1b9d6ef3c594977db3334939e`.
Gemini `gemini-embedding-001` remains the semantic embedder, and the unchanged
official judge remains `gpt-4o-2024-08-06`.

The comparator freezes canonical product files after BRN-0004. The active
retrieval path remains
`c322357999e35d13b366b72e23d5a1cc6c3f8ae3df4937456426e9d491a45972`;
the Gemini wire and embedder hashes remain
`95e61649311476ea6198d2f434165b14d5527b3113553d2ef6a4b597a61bd292`
and
`2f7eb09dcaeafcd4903289023160d19562d9f17a9a312be32ba3a82496a94035`.
`src/brain.mjs` now hashes
`89851ccfc43ad409fea678a9f72d7d8d18bbfc692a1e588ea841d57fdfb042b7`;
relative to BRN-0002, its only relevant diff is optional host author
provenance, and these unattributed dataset calls omit that field. This means
the comparison is behavior-controlled but transparently not a byte-identical
checkout of the older Gemini run.

The one-shot private launcher hashes
`4f2e425e8239b5304157a47745ddeaa025a14960ae120473a1b0a5fe2b097eb4`;
its generated runtime hashes
`b9c60472cc3190fb8eb72a947ad5f5937cb7094d2cdefdd1efe1a22d96cafadd`.
Offline verification syntax-checks that runtime, rehashes all eight product
inputs and seven terminal bundles, confirms the exact ten-question order,
and requires both runtime and result identity to be absent. The launcher
records request bodies and raw responses privately without headers, meters
each embedding, Responses dispatch, and official judge request, performs no
transport retry, and exact-value scans its terminal artifacts before writing
their manifest.

Terminal Gemini first-ten manifest
`554efab7c320ae2c2224ddbb9976d4a0b75afe66a5dab02c2ab227bc5b16816c`
rehashes with its 5/10 label vector: PASS on `08e075c7`, `16c90bf4`,
`5e1b23de`, `80ec1f4f_abs`, and `1192316e`; FAIL on `09d032c9`,
`0977f2af`, `0a34ad58`, `0edc2aef`, and `10d9b85a`. All earlier terminal
seen-six and debug manifests also rehash through the launcher.

The exact J4 ledger carries forward at `$4.3642649` accounted, comprising
`$1.6734941` measured and `$2.6907708` uncertain. This identity has a
`$1.00` fresh hard cap and therefore a `$5.3642649` cumulative boundary.
Luna's current short-context standard rates are frozen at `$0.20` per million
input, `$0.02` cached input, and `$1.20` output tokens. Each Responses call
reserves UTF-8 request bytes plus protocol overhead as input tokens and its
full 512-token output ceiling, then settles only from validated provider
usage. The unchanged Gemini embedding uncertainty still dominates the
conservative expected accounting.

One launcher invocation is final. It first stores the planted indigo memory
locally, performs semantic retrieval with Gemini embeddings, and requires
Luna to call `memory_search` and answer indigo. Any smoke failure stops before
question 1 and is terminal. Otherwise all ten answer/judge cells run once in
order. There is no writer, reducer, graph extraction, prompt tuning, provider
retry, effort escalation, selective rerun, regrade, publication, or second
identity.

Predictions, failing categories first:

1. OFFICIAL ACCURACY: Luna low reaches at least `7/10`, improving on Gemini's
   terminal 5/10 under the unchanged official judge.
2. PROVIDER DELTA: all five Gemini passes remain PASS, and at least two of the
   four evidence-use failures `09d032c9`, `0977f2af`, `0a34ad58`, and
   `0edc2aef` change to PASS. Exact per-question labels remain authoritative.
3. RETRIEVAL CONTROL: `10d9b85a` remains FAIL because the provider swap does
   not change the measured 0/2-session retrieval miss. Across all positive
   cases, at least 11 of 13 labelled answer-bearing sessions are consulted.
4. COMPATIBILITY/JUDGE WIRING: before question 1, Luna accepts the Responses
   tool wire, calls `memory_search` over the real Gemini semantic surface, and
   answers indigo. Every reached answer receives one validated label from the
   unchanged official judge.
5. SEMANTIC USE: all ten scored questions issue at least one successful
   `memory_search` with the unchanged Gemini semantic surface.
6. ANSWER BOUNDARY: all ten completions finish without refusal, incomplete or
   empty output, malformed/unknown tool calls, retrieval exhaustion, or the
   seven-dispatch ceiling.
7. EXECUTION/ACCOUNTING: the first command is terminal, remains within the
   `$1.00` fresh and `$5.3642649` cumulative hard caps, records OpenAI input,
   cached-input, output, and reasoning tokens plus measured/uncertain spend,
   makes at most ten official judge calls, and writes a zero-match secret
   scan. Any smoke failure, question error, or miss is the result and
   authorizes no retry, reroll, regrade, prediction edit, or replacement.

## P-set 21 — Luna-low bounded-finalizer first-ten remeasurement, FINAL before execution

Author: repository execution lane, 2026-08-03. After the independent review
of BRN-0006, the founder explicitly accepted and merged its four-call retrieval
ceiling and directed one new questions 1-10 test. Fresh identity
`j4-luna-retrieval-first10-v2` measures that accepted product behavior. It is
not a rerun, continuation, regrade, or repair of terminal v1. These cases and
their labels are already inspected, so this is a private causal diagnostic,
not an unseen-data generalization estimate.

The product cut point is accepted BRN-0006 at `3f42023`; administrative main
at freeze is `6541572`. The exact ordered IDs remain `08e075c7`, `09d032c9`,
`16c90bf4`, `5e1b23de`, `80ec1f4f_abs`, `0977f2af`, `0a34ad58`, `0edc2aef`,
`10d9b85a`, and `1192316e`; their ordered array hashes
`d3a9a8c234468e0120d605c7868b418a5ab3313384d0d162e11a30ab6d9fe4cf`.
The ignored MIT-licensed dataset remains
`d6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442`.
Nine positive cases still require 13 labelled answer-bearing sessions; ordinal
5 is the abstention and receives no zero-session coverage credit. Sealed U8
`1568498a` is absent and unreachable.

Every experimental factor from P-set 20 remains fixed: OpenAI
`gpt-5.6-luna`, Standard service, `reasoning.effort: low`, `store:false`, no
parallel tool calls, encrypted reasoning-item continuation, Gemini
`gemini-embedding-001`, and the unchanged official
`gpt-4o-2024-08-06` judge. The five mapped OpenAI functions still hash
`3a955ef2069603b9bf0842412feb6600a521d7474a1c7a73d7daf11d4fed8354`.

Only the accepted answer-loop behavior differs. `src/retrieval-answer.mjs`
hashes `4664516f2f1e9cd39fdf8464242b416ee22ae7bf0a06ae6aaee0f0ca63affa34`;
its normal instructions hash
`ae1117fead1e7d83a35dc7530015bba2f81f19dff36ec8856fc69a2c7e8568bc`
and its separate finalization instructions hash
`bd88676aff8af88a57b24bf60bc0befc3f50db78a58191fec28bcd261c43f8ff`.
`src/openai.mjs` hashes
`2b46a772b02f595b29ff4026f5b5a06124d184a3850fc40baa30cbf9cc882fea`.
The host executes at most four calls across all memory tools. After call four,
Luna receives exactly one request with no tool declarations and
`tool_choice: "none"`; the separate seven-dispatch emergency cap remains.

All other frozen product hashes remain: `src/brain.mjs`
`89851ccfc43ad409fea678a9f72d7d8d18bbfc692a1e588ea841d57fdfb042b7`;
`src/gemini.mjs`
`95e61649311476ea6198d2f434165b14d5527b3113553d2ef6a4b597a61bd292`;
Gemini embedder
`2f7eb09dcaeafcd4903289023160d19562d9f17a9a312be32ba3a82496a94035`;
source runtime
`0b820acfb1a81dc702031fa3002ca9b098aeaefdae68de17534f49dd0cfe89d7`;
active runtime
`1b0397fdb00a7181c681ab2aed0750c7051b1b3a8a8dc19ff29c2feb1a9b7c56`;
incremental judge
`dff39ba6d4753d373a1f79b78ff16e64f9fd391f473e932a9bb27232b5aafbb2`;
and official judge
`5f953cd6f56cfcbb5de8246a7b79a5c7f63199dcd07861c5d8d0fe0bb4cff3ee`.

The private mode-0600 v2 launcher hashes
`84a55389a824b7bdb7a045446fe994d0b1f9871e2979b9781abe3c61fec0411a`.
It verifies the frozen v1 launcher template at
`4f2e425e8239b5304157a47745ddeaa025a14960ae120473a1b0a5fe2b097eb4`,
generates delegate
`25506fbbffac2fb6bf2ffcdcd662fb503c9b946629b2a006f43c59f4fa4ed2ee`,
and generates runtime
`4bc21c6c3d14d977f0aa659608d0998bd029d3f754c4398c1e4f49705aa266d0`.
Offline verification rehashes all eight terminal predecessors, including Luna
v1 manifest
`574c865ca3755cf794b002de5b12ec3d474ae235b51e894772222dd97b48b5d8`,
and confirms both v2 runtime and result are absent.

The exact J4 ledger carries forward at `$4.7428483` accounted, comprising
`$1.6851439` measured and `$3.0577044` uncertain. This identity has a `$1.00`
fresh hard cap and `$5.7428483` cumulative boundary. Official current Luna
short-context Standard prices are frozen at `$0.20` per million input,
`$0.02` cached input, and `$1.20` output tokens. Each request reserves its
bounded worst case before dispatch and settles only from validated provider
usage; Gemini embedding uncertainty remains conservatively accounted.
Pricing source checked 2026-08-03:
https://developers.openai.com/api/docs/pricing

One launcher invocation is final. It first runs the planted-indigo semantic
compatibility smoke. Failure stops before question 1. Otherwise all ten cells
answer and receive the unchanged judge once, in order. No provider retry,
effort escalation, selective rerun, prompt tuning, regrade, publication, or
replacement identity is authorized.

Predictions, failing categories first:

1. COMPLETION/FINALIZATION: the compatibility smoke passes; all ten questions
   reach non-empty answers and validated judge labels. No question executes
   more than four memory calls or hits the seven-dispatch emergency ceiling.
   Ordinal 5 reaches graceful tool-disabled finalization rather than repeating
   BRN-0005's terminal retrieval loop.
2. OFFICIAL ACCURACY: preserve P-set 20 unchanged—Luna low reaches at least
   `7/10`, all five Gemini passes remain PASS, and at least two of
   `09d032c9`, `0977f2af`, `0a34ad58`, and `0edc2aef` change from FAIL to PASS.
   Exact per-question labels remain authoritative.
3. RETRIEVAL CONTROL: `10d9b85a` remains FAIL because BRN-0006 changes loop
   control, not the measured 0/2-session retrieval miss. Across positive cases,
   at least 11 of 13 labelled answer-bearing sessions are consulted.
4. WIRE: every non-final model request offers the same five functions with
   `tool_choice: "auto"`; every forced finalization omits tools and sends
   `tool_choice: "none"`. Complete reasoning and host tool outputs remain in
   stateless continuation, and every reached answer receives one judge label.
5. SEMANTIC USE: all ten scored questions issue at least one successful
   `memory_search` using the unchanged real Gemini semantic surface.
6. EXECUTION/ACCOUNTING: the first command is terminal, remains within the
   `$1.00` fresh and `$5.7428483` cumulative caps, records exact model usage
   plus measured/uncertain spend, makes at most ten judge calls, and writes a
   zero-match exact-value secret scan. Any failure or miss is the result and
   authorizes no retry, reroll, regrade, edit, or replacement.

## P-set 22 — provider-neutral local reranker bakeoff, FINAL before execution

Author: repository implementation lane, 2026-08-03. This is an offline,
synthetic retrieval-order measurement, not a LongMemEval execution or an
end-to-end answer score. No provider credential, paid request, generation
model, dataset row, known benchmark answer, or sealed identity participates.

The exact 16-case bank is `brn-0008/v1`; its canonical JSON SHA-256 is
`a89f5179874313d60e4bf46b7af8aad74ad31398873f55f1f4796dbaf96784f1`
and source SHA-256 is
`ad57b64b8f6c2e6e953fdf1795215febce46b4ea3ba76d6b9dc95a1f2d279343`.
It has 15 positive cases and one honest-absence case across possessions,
preferences, corrections, prior-Palari advice, temporal distinctions,
conflicts, and lexical distractors. The frozen RRF-order baseline is top-1
`0/15`, MRR `0.29222222222222227`, and recall@5 `15/15`.

The runner SHA-256 is
`7be1dd1c85c2b59a5cb83bb465fd932fe7e3dbff63f7c62a91283dafa9f9d0c8`;
the adapter SHA-256 is
`ab2776abab2177ee84cd8887a1b3b5550a5c553db965ac1acb9edcf8b1afcc2b`.
The isolated runtime is exactly `@huggingface/transformers@4.2.0`. Its install,
model cache, and mode-0600 result files are outside every repository. Its five
high-severity audit findings are retained as a packaging finding: Palari does
not declare or transitively ship this optional runtime.

The exact Apache-2.0 model identities and fp32 ONNX execution are:

- `cross-encoder/ms-marco-MiniLM-L6-v2` at
  `c5ee24cb16019beea0893ab7796b1df96625c6b8`;
- `cross-encoder/ms-marco-MiniLM-L12-v2` at
  `7b0235231ca2674cb8ca8f022859a6eba2b1c968`;
- `mixedbread-ai/mxbai-rerank-xsmall-v1` at
  `b5c6e9da73abc3711f593f705371cdbe9e0fe422`.

Each model gets one ordered pass over the bank after its model/tokenizer load.
The first scored invocation, failure included, is terminal and written to its
exclusive result path. There is no model/revision/dtype swap, retry, timing
rerun, threshold sweep, prompt change, selective case rerun, or replacement
identity after a score is visible. Latency is total warm wall time divided by
16 cases on this machine. Top-1 and MRR use only the 15 labelled positives;
recall uses the frozen return cutoff 5. The absence case reports raw ordering
without inventing a relevant label.

Selection is frozen before outcomes. Eligibility requires top-1 `>=12/15`,
MRR `>=0.85`, and recall@5 `=15/15`. A model dominates another only when its
top-1, MRR, and recall@5 are all no worse, its milliseconds/case is no higher,
and one comparison is strict. The lowest-latency nondominated eligible model
is the default. If none qualifies, no default ships.

Predictions, failing categories first:

1. EXECUTION: all three exact revisions load and complete their single bank
   pass under Transformers.js 4.2.0; no terminal model result is `failed`.
2. QUALITY: MiniLM-L6 and MiniLM-L12 each reach at least `12/15` top-1;
   mxbai-xsmall reaches at least `13/15`. Every model reaches MRR `>=0.85`
   and preserves recall@5 `15/15`.
3. LATENCY: every model remains below 500 warm milliseconds/case. MiniLM-L6
   is faster than MiniLM-L12 and mxbai-xsmall on this CPU.
4. SELECTION: MiniLM-L6 is eligible, nondominated, and becomes the optional
   measured default because it is the lowest-latency frontier member.
5. SAFETY: all three results report zero canonical content mutations; the
   reranker returns only locating scores, and no quote, speaker, time, ID,
   scope, provenance, or relevance label is model-authored.
6. ACCOUNTING: provider spend is exactly `$0.00`; no credential is read, no
   generation or live provider call occurs, and no model/cache/result byte is
   present in the committed diff.

## P-set 23 — BRN-0008 founder-directed Ettin-17M local successor

Status: **FINAL before any Ettin model download, compatibility inference, or
bank score.** This block supplements and never changes P-set 22. P-set 22's
MiniLM-L6, MiniLM-L12, and mxbai-xsmall invocations and results remain
terminal and are not rerun.

Author: repository implementation lane, 2026-08-03. Quetzali explicitly chose
the newer local Ettin family after reviewing the completed older-model result.
This remains an offline synthetic retrieval-order measurement: no provider
credential, paid request, generation model, LongMemEval row, known answer, or
sealed identity participates.

The only new model identity is the Apache-2.0 English model
`cross-encoder/ettin-reranker-17m-v1` at exact revision
`9e4aa35321a6dd1a43ca313f500c4b4f7cfb5cc6`, executed as fp32 ONNX through the
same isolated `@huggingface/transformers@4.2.0` runtime and external cache.
The bank remains exact version `brn-0008/v1`; its canonical JSON SHA-256 is
`a89f5179874313d60e4bf46b7af8aad74ad31398873f55f1f4796dbaf96784f1`.
The amended runner SHA-256 is
`70ad701bbfb711836607fc0d00689fab518631998496cc52539fc43f90f675b5` and the
amended adapter SHA-256 is
`e5caf48ae213589b244809e0be67856013272c2fc7c4eaebf917234634dc7f55`.
The scoring metrics, 15-positive labels, return cutoff 5, baseline, timing
method, eligibility floors, and Pareto rule are unchanged from P-set 22.

After this block and the exact amended code identities are committed and
pushed, one generic two-document compatibility inference is permitted. It
must load the pinned model and return exactly two finite logits. If it passes,
exactly one ordered bank pass is permitted. A compatibility or bank failure is
retained; there is no retry, model/revision/dtype/runtime swap, threshold sweep,
case-specific rerun, or old-model rerun after any Ettin score is visible.

Predictions, failing categories first:

1. COMPATIBILITY: the exact Ettin revision loads through the existing local
   tokenizer plus sequence-classifier wire and returns exactly two finite
   scores for the generic smoke pair.
2. QUALITY: Ettin reaches at least `13/15` top-1, MRR `>=0.90`, and recall@5
   `15/15`; it therefore meets the unchanged eligibility floors.
3. LATENCY: Ettin completes below `44.6342` warm milliseconds/case on this
   machine, beating the terminal MiniLM-L6 measurement. This is deliberately
   stronger than merely remaining below the existing 500 ms ceiling.
4. SELECTION: Ettin is eligible and lower-latency than every terminal eligible
   model, so the unchanged lowest-latency nondominated rule replaces
   MiniLM-L6 with Ettin-17M as the optional measured default.
5. SAFETY: the result reports zero canonical content mutations; Ettin returns
   only locating scores and cannot author or alter canonical evidence or
   provenance. English-only support is recorded as a limitation.
6. ACCOUNTING: provider spend remains exactly `$0.00`; no credential,
   generation model, dataset, or live provider is accessed, and no
   model/cache/result byte enters git.

Result recorded 2026-08-04, failing-first: (1) COMPATIBILITY **FAIL**. The
exact revision and fp32 ONNX transformer loaded, but the adapter received no
`logits` batch and stopped with `Reranker runtime returned an invalid logits
batch.` Static post-failure inspection, without another inference, found that
the published ONNX graph exposes only `last_hidden_state`; the repository's
official modules define a separate CLS-pooling, Dense, LayerNorm, Dense head
that the generic Transformers.js sequence-classifier loader does not execute.
(2) QUALITY, (3) LATENCY, (4) SELECTION, and (5) SAFETY are **not assessable**
because the bank was correctly not run. (6) ACCOUNTING **PASS** at `$0.00`
with no credential, provider, generation model, dataset, or tracked artifact.
The exclusive mode-0600 smoke result SHA-256 is
`b2a802f43eed464ba1e448df602370b9cefd6ab4beea6a9f08e136fc987c1d4a`.
There was no compatibility retry, bank run, old-model rerun, or runtime/model
swap.

Factual correction recorded before BRN-0009 implementation: pinned
`1_Pooling/config.json` specifies `pooling_mode: "cls"`; the initial result
wording incorrectly said mean pooling. This wording correction changes no
BRN-0008 score, grade, compatibility diagnosis, artifact, or execution.

## P-set 24 — BRN-0009 native Ettin modular head

Status: **FINAL before any BRN-0009 model inference or score.** This is fresh
identity `brn-0009/ettin-native-v1`; it neither retries nor changes terminal
BRN-0008 P-set 23. No LongMemEval row, known answer, provider credential,
generation model, paid request, or sealed identity participates.

The only model is Apache-2.0 English
`cross-encoder/ettin-reranker-17m-v1` at exact revision
`9e4aa35321a6dd1a43ca313f500c4b4f7cfb5cc6`, fp32 through isolated
`@huggingface/transformers@4.2.0`. The official ONNX transformer output is
composed locally with exact CLS pooling, 256x256 Dense/GELU, LayerNorm epsilon
`1e-5`, and 256x1 Dense. The three external head safetensors are pinned by the
paths, byte sizes, and SHA-256 values recorded in BRN-0009; every cached use
rehashes them.

The native adapter SHA-256 is
`0482cedce41b125ba98041293a078130a650ba7bee1a35bee80c93f1e553700d`;
the runner SHA-256 is
`6d80c3e033f523ff84b153eaabd7e230ff4e74814565a101ea1432fc1238f774`;
and unchanged bank source SHA-256 is
`ad57b64b8f6c2e6e953fdf1795215febce46b4ea3ba76d6b9dc95a1f2d279343`.
The bank remains `brn-0008/v1`, canonical JSON SHA-256
`a89f5179874313d60e4bf46b7af8aad74ad31398873f55f1f4796dbaf96784f1`,
with 15 positive cases, one honest absence, and baseline 0/15 top-1, 0.292222
MRR, 15/15 recall@5.

After this block and exact implementation are committed and pushed, one
generic two-document compatibility smoke is permitted. It must produce two
finite scores and rank the direct Mars statement above an unrelated ocean
statement. If and only if it passes, exactly one ordered bank pass is
permitted. The BRN-0008 eligibility floors and Pareto rule remain unchanged.
A smoke or bank failure is terminal; there is no retry, dtype/runtime/model or
artifact swap, head edit, timing rerun, threshold sweep, or case rerun after a
score is visible.

Predictions, failing categories first:

1. COMPATIBILITY: exact transformer and all three integrity-pinned head files
   load; native composition returns exactly two finite scores in input order
   and ranks the relevant generic document first.
2. QUALITY: Ettin reaches at least `13/15` top-1, MRR `>=0.90`, and recall@5
   `15/15`, meeting the unchanged eligibility floors.
3. LATENCY: the one warm bank pass measures below MiniLM-L6's terminal
   `44.6342` milliseconds/case on this machine.
4. SELECTION: Ettin is eligible and lower-latency than every terminal eligible
   BRN-0008 model, so it becomes the recommended optional local reranker under
   the unchanged Pareto rule.
5. FIDELITY/SAFETY: all artifact hashes and exact tensor layouts pass; CLS and
   complete head math execute without nonfinite values; content mutations are
   zero; no canonical text, speaker, time, scope, ID, or provenance changes.
6. ACCOUNTING: provider spend is exactly `$0.00`; no credential, generation
   model, dataset, LongMemEval identity, or tracked cache/result/model byte is
   accessed or produced.

Result recorded 2026-08-04, failing-first: all six categories **PASS**.
COMPATIBILITY returned two finite scores and ranked the relevant generic text
first. QUALITY measured `14/15` top-1 (`0.9333333333333333`), MRR
`0.9666666666666667`, and recall@5 `15/15`. LATENCY measured
`26.1374138125` warm milliseconds/case in the one frozen pass, below
MiniLM-L6's terminal `44.6342`. SELECTION passes: Ettin has higher top-1 and
MRR than L6 at equal recall and lower latency, and equals mxbai-xsmall quality
at much lower latency, so it dominates every BRN-0008 eligible model and is
the recommended optional local reranker. FIDELITY/SAFETY passes with all three
artifact hashes/layouts valid and `contentMutations: 0`; its sole top-1 miss is
the first temporal-latestness case, preserving the finding that chronology
remains host responsibility. ACCOUNTING passes at `$0.00`, with zero provider,
credential, generation, dataset, or LongMemEval activity.

The mode-0600 private smoke result SHA-256 is
`9fa98aeb94ba8f99eb7b00762b6100b0d7301454d1f17b13da353fa8f0d63b24`;
the mode-0600 terminal bank result SHA-256 is
`4515742db2bbbe3cd4d0da84df20e427039320d3cd8591e3d56a4a19559c64c3`.
There was exactly one smoke and one bank pass, with no retry, rerun, model,
runtime, dtype, artifact, head, threshold, or timing substitution.

Post-result runtime-provenance audit, without inference: the system-owned Codex
execution transcript records the exact smoke tool call at
`2026-08-04T00:26:28.653Z` (`call_NSQMKxovuSvFq2KYVDxG0u4d`) and bank tool
call at `2026-08-04T00:26:38.780Z` (`call_RxiiCUEcFW1zWhxDeD1e8nLR`). Both
commands name the same absolute isolated runtime entrypoint,
`/home/quetza/.cache/palari-brain/brn-0008-ettin-17m/runtime/node_modules/@huggingface/transformers/src/transformers.js`,
and their matching tool outputs complete at `00:26:32.344Z` and
`00:26:40.519Z`. The four exact JSONL records hash to
`69a0ff08688ca21359d5500ddf2b8b5edec7752db90d39f7d7a3c20bd6398dad`.
All 3,208 files in that isolated closure have modification times no later than
`2026-08-04T00:00:46.783690073Z`, before either invocation. A complete
path/content/symlink manifest over 706,843,605 bytes and one contained symlink
hashes to
`a0aca4625ff6793abaf7fb0db2b01328dee50eb7488e3c5a869dfe2d5ae93d96`.
The package metadata, entrypoint, and exported version also reproduce the
separately recorded exact hashes and `4.2.0`. This audit binds the preserved
terminal commands to the preserved full runtime closure; it does not alter a
result byte, rerun a score, or claim that the local transcript is a signed
third-party attestation.

## P-set 26 — repaired cached Ettin + Luna first-ten, FINAL before execution

Status: **FINAL before any BRN-0013 Ettin model inference, credential read,
provider dispatch, or LongMemEval score.** Fresh identity
`j4-luna-ettin-first10-v2` is a successor to terminal BRN-0010, never a
resume, retry, rerun, or regrade. These ten cases are already inspected; this
is a private causal integration diagnostic, not unseen-user accuracy.

The exact S60 question order is `08e075c7`, `09d032c9`, `16c90bf4`,
`5e1b23de`, `80ec1f4f_abs`, `0977f2af`, `0a34ad58`, `0edc2aef`, `10d9b85a`,
and `1192316e`; ordered-array SHA-256
`d3a9a8c234468e0120d605c7868b418a5ab3313384d0d162e11a30ab6d9fe4cf`.
Dataset SHA-256 is
`d6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442`.
Sealed U8 `1568498a` is absent and unreachable.

The scored control remains terminal BRN-0007: Luna `gpt-5.6-luna`, Standard,
low reasoning, `store:false`; Gemini `gemini-embedding-001`; official
`gpt-4o-2024-08-06` judge; exact sessions, prompts, schemas, serial order,
semantic behavior, four aggregate memory-call ceiling, tool-disabled
finalization, and grading. Its six labels were
`PASS, FAIL, PASS, PASS, PASS, PASS`; later rows were not completely graded.
Terminal BRN-0010 held those factors and added accepted native Ettin, but
stopped before a score in cached tokenizer discovery. The sole causal change
from BRN-0010 is accepted BRN-0012's absolute cached-directory loader repair.

Product cut point is merged BRN-0012 `90e1837`; canonical administrative head
is clean `784de723daf5be9824b5ef2f18b274eff94e1313`. Exact reranker source
SHA-256 is
`b616a75f0833d2b553da320ced3b1e68f8877829ebb9d3aa3cdb917147235e27`.
The model remains Apache-2.0
`cross-encoder/ettin-reranker-17m-v1` revision
`9e4aa35321a6dd1a43ca313f500c4b4f7cfb5cc6`, fp32 ONNX, with accepted native
CLS -> Dense/GELU -> LayerNorm -> Dense head. Seven cached model/head files
are pinned by size/hash in the launcher. The isolated
`@huggingface/transformers@4.2.0` closure remains 3,208 files,
706,843,605 bytes, one contained symlink, SHA-256
`a0aca4625ff6793abaf7fb0db2b01328dee50eb7488e3c5a869dfe2d5ae93d96`.

Private mode-0600 launcher
`/home/quetza/palari-brain-private/luna-ettin-first10-live-v2-launcher.mjs`
has SHA-256
`d9242b407b7477168a9c746bf5350659222f7e6ad3a329ad2ed79e186de57a63`.
It generates mode-0600 runtime SHA-256
`df2b746bbc422e88bbf773eeab68292ea1ad85d026988e4ab7ff765a4349a50a`
from terminal template SHA-256
`4bc21c6c3d14d977f0aa659608d0998bd029d3f754c4398c1e4f49705aa266d0`.
Offline verification rehashes 218 artifacts across ten predecessor manifests,
including terminal BRN-0010, ten product/eval files, all seven Ettin files,
the complete runtime closure, dataset/order, and absent result identity without
reading credentials.

Opening cumulative spend is unchanged at `$5.27173386`: `$1.70023596`
measured plus `$3.5714979` uncertain. This identity has a `$1.50` fresh
accounted cap and `$6.77173386` cumulative boundary. Every provider request
reserves before dispatch; all three transports are metered; no transport
retries. The one invocation first reserves and consumes the exclusive
identity, runs one provider-free real-brain Ettin smoke before `.env`, then one
live Gemini-semantic + Ettin + Luna compatibility smoke. Any failure is
terminal before question 1; otherwise all ten answer and are judged once in
order.

Predictions, failing categories first:

1. COMPATIBILITY: the pinned runtime/model/head closure loads once through the
   validated absolute revision directory. The local real-brain smoke returns
   the direct travel-mug statement first with finite one-for-one scores, zero
   input mutation, and `reranked: true`. The live smoke performs Gemini
   semantic search, reports Ettin reranking, and Luna answers the planted
   indigo fact.
2. COMPLETION: both smokes pass and all ten ordered questions receive one
   non-empty Luna answer plus one validated official label under the cap. No
   answer makes more than four aggregate memory calls; forced finalization, if
   reached, answers on its single tool-disabled dispatch.
3. OFFICIAL ACCURACY: objective `10/10`; expected floor at least `7/10`. The
   five BRN-0007 PASS labels among ordinals 1-6 remain PASS; `09d032c9`
   changes FAIL to PASS because Ettin elevates already-returned answer-bearing
   preference evidence; and at least one of ordinals 7, 8, or 10 passes.
   `10d9b85a` is expected to remain FAIL because reranking cannot recover
   previously absent candidate sessions. The objective is not permission to
   tune, reroll, or selectively rescore.
4. RETRIEVAL/RERANK: at least 11 of 13 required answer-bearing sessions are
   consulted. Every successful non-empty scored `memory_search` reports
   semantic use and `reranked: true`; every Ettin call receives at most 50
   immutable complete candidates, returns exactly one finite score per
   candidate, and records zero canonical-content mutation.
5. WIRE: non-final Luna requests preserve all five tools and
   `tool_choice: "auto"`; forced finalization omits tools and uses
   `tool_choice: "none"`. Complete reasoning and function outputs remain in
   stateless continuation, and every reached answer is judged exactly once.
6. EXECUTION/ACCOUNTING: one terminal invocation remains within `$1.50` fresh
   and `$6.77173386` cumulative accounted caps, records measured/uncertain
   usage and local reranker telemetry, seals every private artifact with
   hashes/modes, and reports zero exact credential matches with no sealing
   error. Any failed prediction or stop is the result and authorizes no retry,
   reroll, regrade, repair-in-place, or replacement identity.

Result recorded 2026-08-04, failing-first. (3) OFFICIAL ACCURACY **FAIL**:
`6/10`, below the preregistered `>=7/10` floor and 10/10 objective. Exact
labels are `PASS, FAIL, PASS, PASS, PASS, PASS, FAIL, FAIL, FAIL, PASS`.
All five prior PASS labels among ordinals 1-6 remained PASS, but `09d032c9`
remained FAIL despite its required session being consulted; ordinal 10 was the
predicted later PASS. No answer, label, or prediction was changed.

(1) COMPATIBILITY **PASS**: the repaired absolute local-directory path loaded
the pinned runtime/model/head once; the provider-free real-brain smoke ranked
the titanium travel-mug fact first with four finite scores, zero mutation, and
no provider. Live compatibility used Gemini semantic retrieval, Ettin
reranking, and Luna answered the planted indigo fact. (2) COMPLETION **PASS**:
both smokes and all ten answer/judge cells completed; the four-call ceiling and
three tool-disabled finalizations held. (4) RETRIEVAL/RERANK **PASS**: 12/13
required answer sessions were consulted against the `>=11/13` prediction.
Every measured call returned one finite score per immutable candidate; ten
non-empty reranks scored 250 candidates, maximum 50. The only missing required
session was one of two on `0977f2af`, which still passed. All four official
FAIL rows received every required session, so none is a candidate retrieval/
reranking failure. Static terminal audit found three answer-use/personalization
failures and one clear judge false negative: `10d9b85a` has reference
`3 days`, Luna answered `3 days`, and the official judge returned `No`.
Its official FAIL and aggregate 6/10 remain immutable; this is not a regrade.
The preregistered causal subprediction that this row would fail because its
candidate sessions were absent is refuted. (5) WIRE **PASS**: all 33 Luna calls, ten
judges, and 95 Gemini embedding batches succeeded; every answer was judged
once and finalization wire remained exact. (6) EXECUTION/ACCOUNTING **PASS**:
one consumed invocation sealed 73/73 artifacts (89,106,477 bytes), no sealing
error or credential match, and stayed under both caps.

Fresh spend is `$0.75899237` accounted = `$0.02310692` measured +
`$0.73588545` uncertain. Cumulative J4 spend is `$6.03072623` accounted =
`$1.72334288` measured + `$4.30738335` uncertain. Calls were 33 Luna Responses
(129,023 input, 60,036 cached input, 2,199 output, 472 reasoning tokens), ten
official judges (2,120 input / 17 output tokens), and 95 Gemini embedding
batches carrying 4,794 requests / 4,905,903 conservatively reserved tokens.
Terminal manifest SHA-256 is
`eb7dcb01c7a60cbade9a25d179cffde783e1f46c5c79644422eae819da7c3b71`.
This identity cannot be rerun, resumed, selectively rescored, or repaired.

## P-set 27 — cited-answer Ettin + Luna first-ten, FINAL before execution

Author: repository execution lane, 2026-08-04. Grading run:
`j4-luna-ettin-cited-first10-v1` only.

Status: **FINAL before any BRN-0015 model inference, credential read,
provider dispatch, or LongMemEval score.** Fresh identity
`j4-luna-ettin-cited-first10-v1` is a successor to terminal BRN-0013, never a
resume, retry, rerun, selective rescore, or regrade. The ten cases are already
inspected and remain a private causal integration diagnostic, not an estimate
of unseen-user accuracy.

The exact ordered S60 IDs, question/session bytes, dataset, providers, prompts,
serial execution, semantic retrieval, native Ettin model/head/runtime,
candidate limits, four-memory-call ceiling, and official grading are unchanged
from BRN-0013. Ordered-array SHA-256 remains
`d3a9a8c234468e0120d605c7868b418a5ab3313384d0d162e11a30ab6d9fe4cf`;
dataset SHA-256 remains
`d6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442`.
Sealed U8 `1568498a` is absent and unreachable. The sole product treatment is
accepted BRN-0014 at product cut
`c6e29c01e8862872508db6f681b6a21b1a434459`: after non-empty canonical
retrieval, Luna must return the exact host-created commitment with returned
evidence IDs and exact contiguous quotes. That structural citation is not
assumed to prove semantic entailment.

Terminal BRN-0013's immutable official labels were
`PASS, FAIL, PASS, PASS, PASS, PASS, FAIL, FAIL, FAIL, PASS` (6/10). Three
FAIL rows were genuine answer-use/personalization failures after all required
answer-bearing sessions reached Luna. On the fourth, reference and answer both
said `3 days`, while the official judge returned `No`; its official FAIL is
preserved and no private regrade enters this run. All ten known answers, prior
generated answers, and labels are absent from runtime logic.

Private mode-0600 launcher
`/home/quetza/palari-brain-private/luna-ettin-cited-first10-live-launcher.mjs`
has SHA-256
`6ccc091b521cd3c9874805278ab7959e9fdb5523326fe775df01a37dd992f29b`.
It generates mode-0600 runtime SHA-256
`d123525ec5e1c9bc1664fc9c323e9fa567831e9118d4e5cc273cfb29344c6ea2`
from unchanged terminal template SHA-256
`4bc21c6c3d14d977f0aa659608d0998bd029d3f754c4398c1e4f49705aa266d0`.
Offline verification rehashed 291 artifacts across all eleven predecessor
manifests including terminal BRN-0013, ten product/eval files, all seven Ettin
files, the 3,208-file runtime closure, dataset/order, and absent result. It
performed no inference, credential read, or provider call. A denied `--run`
without exact identity/cap confirmation failed before result creation.

Opening cumulative spend is `$6.03072623`: `$1.72334288` measured plus
`$4.30738335` uncertain. The proposed `$1.50` fresh cap would create a
`$7.53072623` cumulative boundary, but is not authorized by this
preregistration. Dispatch remains founder-gated. After exact cap authority,
the one launcher invocation reserves and consumes the identity before a
provider-free Ettin smoke, one live Gemini-semantic + Ettin + Luna cited-answer
smoke, and at most ten ordered answer/judge cells. Any failure is terminal.

Predictions, failing categories first:

1. OFFICIAL ACCURACY: objective `10/10`; expected floor at least `8/10`. No
   BRN-0013 PASS regresses, and at least two of its three genuine answer-use
   failure rows reverse because unsupported raw/false-absence prose must cross
   one forced commit-only repair or fail terminally. The prior clear judge
   false negative is reported separately whatever its new official label; no
   regrade or answer-specific rule is allowed.
2. COMPLETION: the local and live compatibility smokes pass; all ten ordered
   questions receive one non-empty Luna answer and one validated official
   label under the cap. Every answer uses at most four aggregate memory calls
   and the host never accepts an uncited raw fallback after non-empty evidence.
3. CITED COMMITMENT: the live smoke returns `answerCommitted: true`, at least
   one registered basis, and the planted indigo fact. On every scored row with
   returned canonical evidence, `answerCommitted` is true and every recorded
   basis contains a returned evidence ID plus an exact contiguous quote.
4. RETRIEVAL/RERANK: at least 12/13 required answer-bearing sessions are
   consulted. Every non-empty measured `memory_search` uses semantic retrieval
   and `reranked: true`; every Ettin call receives at most 50 immutable complete
   candidates and returns exactly one finite score per candidate with zero
   canonical-content mutation.
5. WIRE: normal Luna turns preserve the five memory tools plus private strict
   `palari_answer_commit` and `tool_choice: "auto"`. A valid commitment ends
   without another generation. Raw/invalid post-retrieval output gets at most
   one request exposing only the forced commitment function. Fourth-call
   non-empty finalization is commit-only; no path exceeds seven model
   dispatches or four memory calls.
6. EXECUTION/ACCOUNTING: the one terminal invocation remains within the exact
   founder-confirmed fresh and cumulative caps, records measured/uncertain
   usage and reranker/commitment telemetry, seals every private artifact with
   hashes and mode 0600, reports zero exact credential matches, and has no
   sealing error. Any miss or stop is the result and authorizes no retry,
   reroll, regrade, repair-in-place, or replacement identity.

### P-set 27 terminal result — 2026-08-04

The founder authorized exactly one invocation under the preregistered `$1.50`
fresh / `$7.53072623` cumulative accounted caps. That invocation is consumed,
failed terminally, and sealed. It may not be resumed, rerun, selectively
rescored, regraded, or repaired in place.

Failing categories first:

1. **OFFICIAL ACCURACY — FAIL / NOT FULLY REACHED.** Only questions 1-4
   received official labels: `PASS, FAIL, PASS, PASS` (3/4 on the reached
   prefix). This is neither the predicted at-least-8/10 floor nor a ten-case
   score. The BRN-0013 failure represented by question 2 did not reverse;
   later predicted reversals and PASS non-regressions are unmeasured.
2. **COMPLETION — FAIL.** Both smokes passed, but only 4/10 questions completed.
   During question 5 the product requested forced commit-only finalization
   after its fourth memory call. The frozen private meter rejected that request
   before reservation or transport because its allowlist omitted the accepted
   forced-function `tool_choice` object. Questions 6-10 were not reached.
3. **CITED COMMITMENT — PARTIAL.** The live smoke passed with the planted
   indigo fact, `answerCommitted: true`, and one exact basis. Every one of the
   four scored answers was also committed with one returned evidence ID and
   exact contiguous quote. The remaining six scored rows are unmeasured, so
   the all-row prediction cannot pass.
4. **RETRIEVAL/RERANK — PARTIAL.** The four completed rows matched all 5/5
   required answer-bearing sessions and each recorded semantic retrieval plus
   native Ettin reranking. The at-least-12/13 whole-run prediction and suffix
   mechanics are unmeasured.
5. **WIRE — FAIL.** Normal turns and valid commitments worked in the smoke and
   first four rows. On question 5, however, BRN-0014 correctly emitted
   `tool_choice: {type:"function", name:"palari_answer_commit"}` for fourth-call
   finalization. Private runtime lines 425-433 admitted only `"auto"` with
   tools or `"none"` without tools, so the meter raised `OpenAI answer request
   changed from the frozen wire.` The rejected fifth dispatch was not reserved
   or sent. This is a measurement-harness compatibility defect, not a provider
   rejection and not a product fallback.
6. **EXECUTION/ACCOUNTING — PASS.** Exactly one invocation ran. It sealed 37
   artifacts / 45,126,680 bytes with zero credential matches and zero sealing
   errors. Fresh spend was `$0.37751938` = `$0.01059868` measured +
   `$0.3669207` uncertain; cumulative spend is `$6.40824561` = `$1.73394156`
   measured + `$4.67430405` uncertain. The run stayed below both caps and no
   retry occurred.

The terminal artifact-manifest SHA-256 is
`d48030533c6a344ea1c180bb7c99c7edb20dc48a0c7403f65a04837c0697448f`.
There is no official first-ten score for this identity; `3/4` is explicitly a
reached-prefix diagnostic, not a substitute denominator.

## P-set 28 — hardened cited-answer meter + Luna first-ten, FINAL before execution

Author: repository execution lane, 2026-08-04. Grading run:
`j4-luna-ettin-cited-first10-v2` only.

Status: **FINAL before any BRN-0017 credential read, model inference, provider
dispatch, or LongMemEval score.** This fresh identity is a causal successor to
terminal BRN-0015, never a resume, retry, rerun, selective rescore, or regrade.
The ten cases are already inspected and remain a private integration
diagnostic, not an estimate of unseen-user accuracy.

The exact ordered S60 IDs are `08e075c7`, `09d032c9`, `16c90bf4`, `5e1b23de`,
`80ec1f4f_abs`, `0977f2af`, `0a34ad58`, `0edc2aef`, `10d9b85a`, and
`1192316e`; ordered-array SHA-256
`d3a9a8c234468e0120d605c7868b418a5ab3313384d0d162e11a30ab6d9fe4cf`.
Dataset SHA-256 is
`d6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442`.
Sealed U8 `1568498a` is absent and unreachable.

Product cut is accepted BRN-0016 `232bfe2a34fcf88b5fea88599327120a86292982`.
Question/session bytes, prompts, answer behavior, Gemini
`gemini-embedding-001`, native fp32 Ettin, Luna `gpt-5.6-luna` Standard/low/
no-store, official `gpt-4o-2024-08-06` judge, candidate limits, serial order,
four-memory-call ceiling, and structural citation boundary are unchanged from
BRN-0015. The sole treatment is the accepted exact answer-wire validator in
the private meter. It admits product-generated normal, tool-disabled, and
forced `palari_answer_commit` requests while rejecting any other body before
reservation or transport. No known answer, label, or prior generated answer
enters runtime logic.

Private mode-0600 launcher
`/home/quetza/palari-brain-private/luna-ettin-cited-first10-v2-live-launcher.mjs`
has SHA-256
`a14284952f5004f80dc9dc7cb8e5bcb5e15cf31d88752ec1916c1ea9ca0d7387`.
It generates mode-0600 runtime SHA-256
`5c72c1c62612e9f2963e9b664fdf47ee02a941a39ec61b57548afea51c09da32`
from unchanged terminal template SHA-256
`4bc21c6c3d14d977f0aa659608d0998bd029d3f754c4398c1e4f49705aa266d0`.
Offline verification rehashes 328 artifacts across all twelve predecessor
manifests, eleven product/eval files, all seven Ettin files, the 3,208-file
runtime closure, dataset/order, and absent result. Product-generated fake
normal, plain-terminal, and forced-commit bodies each validate before exactly
one fake reservation and dispatch. This verification performs zero credential
reads, provider calls, model inference, or spend.

Opening cumulative spend is `$6.40824561`: `$1.73394156` measured plus
`$4.67430405` uncertain. A proposed `$1.50` fresh cap would create a
`$7.90824561` cumulative boundary, but this preregistration is not authority.
After a new exact founder authorization, one invocation reserves and consumes
the identity before one provider-free Ettin smoke, one live Gemini-semantic +
Ettin + Luna cited compatibility smoke, and at most ten ordered answer/judge
cells. Every physical request reserves before dispatch. Any failure is
terminal and authorizes no replacement invocation.

Predictions, failing categories first:

1. OFFICIAL ACCURACY: objective `10/10`; expected floor at least `8/10`, the
   unchanged BRN-0015 preregistered floor. No BRN-0013 PASS row regresses, and
   at least two of its three genuine answer-use failures reverse under the
   unchanged cited-answer treatment. The prior clear judge false negative is
   reported separately whatever its new immutable official label. The meter
   repair itself is predicted to change completion, not answer quality.
2. COMPLETION: both smokes pass and all ten questions receive exactly one
   non-empty Luna answer and one official label. No answer exceeds four memory
   calls, and a forced commitment request is admitted and dispatched once
   rather than terminating the run at question 5.
3. CITED COMMITMENT: the live smoke and every scored row with returned
   canonical evidence report `answerCommitted: true`; every basis names a
   returned evidence ID and an exact contiguous quote. No uncited raw fallback
   survives after non-empty evidence.
4. RETRIEVAL/RERANK: at least 12/13 required answer-bearing sessions are
   consulted. Every non-empty measured `memory_search` uses semantic retrieval
   and native Ettin reranking; each rerank receives at most 50 immutable full
   candidates and returns exactly one finite score per candidate with zero
   canonical-content mutation.
5. WIRE: the live meter accepts only the three pinned product forms: six exact
   ordered tools with `tool_choice: "auto"`, no tools with `"none"`, or the
   sole strict commitment tool with the exact forced-function selector. It
   uses 512 maximum output tokens and low reasoning. Validation precedes
   reservation and transport on every Luna answer call; no answer exceeds
   seven Luna dispatches.
6. EXECUTION/ACCOUNTING: one terminal invocation stays within the exact
   founder-authorized fresh and cumulative caps, records measured versus
   uncertain usage plus reranker/commitment telemetry, seals every private
   artifact at mode 0600, reports zero exact credential matches, and has no
   sealing error. Any miss or stop is recorded as the result without retry,
   reroll, regrade, repair-in-place, or replacement identity.

### P-set 28 terminal result — 2026-08-04

The founder authorized exactly one invocation under the preregistered `$1.50`
fresh / `$7.90824561` cumulative accounted caps. That invocation completed,
is consumed, and is sealed. It may not be resumed, rerun, selectively
rescored, regraded, or repaired in place.

Failing categories first:

1. **OFFICIAL ACCURACY — FAIL.** Official score is `6/10`, below the
   preregistered at-least-`8/10` floor and `10/10` objective. Exact immutable
   labels are `PASS, FAIL, PASS, PASS, PASS, FAIL, FAIL, FAIL, PASS, PASS`.
   None of BRN-0013's three genuine answer-use FAIL rows reversed, and its
   ordinal-six PASS regressed to FAIL. The prior clear ordinal-nine judge false
   negative returned PASS in this fresh invocation; this is a new official
   label, not a regrade of either terminal predecessor.
2. **COMPLETION — PASS.** The provider-free and live compatibility smokes
   passed, all ten questions received one non-empty answer and one official
   label, and no answer exceeded four memory calls. The repaired forced wire
   completed successfully on ordinals 6, 7, and 9; ordinal 5 crossed the old
   stop point through its legitimate empty-evidence plain-terminal path.
3. **CITED COMMITMENT — PASS.** Compatibility returned one exact basis. Nine
   scored answers with returned canonical evidence were host commitments with
   14 total evidence bases. The sole uncommitted answer was the abstention row,
   which returned zero canonical messages and therefore correctly used the
   plain-terminal path.
4. **RETRIEVAL/RERANK — PASS.** Exactly 12/13 required answer-bearing sessions
   were consulted. The only missing required session was one of two on
   `0977f2af`; that row failed. Twelve non-empty native Ettin calls scored 330
   complete candidates, maximum 50, with exactly 330 finite scores and zero
   canonical-content mutation. Mean measured rerank latency was 2,082.4 ms.
5. **WIRE — PASS.** All 34 Luna calls succeeded: 30 exact normal, one exact
   plain-terminal, and three exact forced-commit requests. Every request used
   `gpt-5.6-luna`, low reasoning, 512 maximum output tokens, and no unrecognized
   mode; the largest scored cell used five dispatches. Ten judges and 95
   Gemini embedding batches also completed once.
6. **EXECUTION/ACCOUNTING — PASS.** One consumed invocation sealed 74/74
   artifacts / 89,786,836 bytes at mode 0600 with zero exact credential
   matches and zero sealing errors. Fresh spend is `$0.76368433` accounted =
   `$0.02779288` measured + `$0.73589145` uncertain. Cumulative spend is
   `$7.17192994` = `$1.76173444` measured + `$5.41019550` uncertain, below the
   authorized boundary.

The run recorded 139 successful physical calls: 34 Luna Responses calls
(150,037 input, 70,054 cached input, 4,221 output, and 870 reasoning tokens),
ten official judge calls (2,060 input / 18 output tokens), and 95 Gemini
embedding batches carrying 4,794 requests / 4,905,943 conservatively reserved
tokens. Terminal artifact-manifest SHA-256 is
`850ca10026e7800dcaaa69eab482561d4eb0fe5db17e1a05b6fdb361a5959ebe`.

## P-set 29 — Sol final-turn replay on four frozen BRN-0017 failures

Status: **FINAL before credential access, provider dispatch, inference, or
result creation.** Date: 2026-08-05. Identity:
`j4-sol-frozen-failures-pre-architecture-v1`.

This is a causal final-answer-tier diagnostic, not a benchmark rerun or
regrade. Because the exact contexts retain Luna's encrypted reasoning and tool
trajectory, it measures whether Sol changes the final answer from that frozen
trajectory; it is not a pure end-to-end Sol retrieval/answer measurement.
The four selected requests are the exact last OpenAI Responses request from
each immutable BRN-0017 failure cell, in fixed order `09d032c9`, `0977f2af`,
`0a34ad58`, `0edc2aef`. The sole treatment is the model string
`gpt-5.6-luna` to `gpt-5.6-sol`; low reasoning, Standard/default service,
no-store, 512 maximum output tokens, instructions, input items, tools, and
tool choice remain byte-identical. There is no memory transport and no judge.
The historical official 6/10 and all ten labels remain unchanged.

Official OpenAI guidance names Sol as the frontier-capability GPT-5.6 tier and
recommends preserving effective reasoning effort for the first migration
comparison before changing prompts or capabilities. The private mode-0600
launcher SHA-256 is
`a7c91b99ec38572093e88548c526710592c02a3c008ca81984b1aac2fb472c46`.
It binds BRN-0017 terminal manifest SHA-256
`850ca10026e7800dcaaa69eab482561d4eb0fe5db17e1a05b6fdb361a5959ebe`
and the four exact source/replay request hashes emitted by `--verify`.

Predictions, failing categories first:

1. ANSWER USE: objective `2/2` on rows whose delivered context is sufficient.
   Phone explicitly incorporates the user's existing portable power bank in
   its battery advice. Miami combines the returned ocean/view evidence with
   the returned private-balcony hot-tub evidence in one recommendation. A
   generic phone checklist that merely cites the power-bank row fails this
   category; naming only one Miami preference fails it.
2. EVIDENCE LIMIT: Instant Pot does not guess the missing earlier appliance,
   and Tokyo does not attribute Suica or TripIt to the user from old Palari
   responses when the original user statements are absent. Both should state
   that the delivered stored evidence is insufficient. This predicted limit
   is evidence of retrieval/context failure, not answer-model failure.
3. COMPATIBILITY/COMPLETION: one unrelated Sol/low/Standard/no-store smoke
   returns exact `compatible`, then all four frozen requests receive HTTP 200
   exactly once. Each produces either one `palari_answer_commit` or plain
   answer; a new memory-tool call is recorded as a failed answer outcome and
   is never executed. No cell is retried or replaced.
4. CAUSAL INTEGRITY: offline verification rehashes all 74 BRN-0017 artifacts
   and the terminal record proves each request differs from its sealed source
   only at `model`. No prompt,
   evidence, effort, tool, answer, label, or benchmark reference is added.
   No official judge runs and no historical result changes. Before credential
   access, the launcher verifies its own preregistered hash, the exact clean
   pushed/reviewed ticket commit, its committed predictions, and frozen target
   main; it snapshots the four replay requests once before the smoke.
5. EXECUTION/ACCOUNTING: exactly five or fewer physical OpenAI calls reserve
   before dispatch under `$0.50` fresh / `$7.67192994` cumulative accounted
   ceilings from the exact `$7.17192994` opening ledger. The private result is
   sealed through atomic synced writes with reconciled meter/wire/report
   hashes, mode 0600, and zero exact credential matches. Any compatibility,
   provider, cap, parse, or seal failure is terminal without retry, resume,
   reroll, regrade, or replacement identity.

Terminal result (recorded after the one authorized invocation):

- ANSWER USE: **FAIL, 1/2.** Phone explicitly incorporated the existing
  portable power bank. Miami used the returned view preference but omitted the
  returned private-balcony hot-tub evidence.
- EVIDENCE LIMIT: **FAIL, 1/2.** Instant Pot correctly abstained because the
  delivered evidence did not identify the earlier appliance. Tokyo reused old
  Palari Suica/transit advice rather than stating that the original user Suica
  and TripIt statements were absent. It did not establish those as user facts,
  but it still failed the preregistered insufficiency outcome.
- COMPATIBILITY/COMPLETION: **PASS.** The smoke returned exact `compatible` and
  all four frozen requests returned HTTP 200 exactly once with one
  `palari_answer_commit`; no memory tool was executed and no cell was retried.
- CAUSAL INTEGRITY: **PASS.** Runtime authority bound exact reviewed commit
  `71e6ca56908485520210a90edbc3307230c93475`, P-set, launcher, frozen target,
  and all 74 source artifacts. The sole request treatment remained `model`.
  No judge ran and the historical 6/10 is unchanged.
- EXECUTION/ACCOUNTING: **PASS.** Five calls reserved exactly `$0.50`; all
  completed successfully under the `$7.67192994` cumulative accounted cap.
  Usage was 26,775 input / 1,326 output / 322 reasoning / 28,101 total tokens;
  transport latency was 29,281.3 ms total / 5,856.26 ms mean. The terminal
  manifest reports zero credential matches and zero sealing errors at SHA-256
  `6c9ab17351d8f09c1b714d33bb8fe34e468d25a8cdf0397d4dc9794c5dcba725`.

Diagnostic conclusion: Sol/low repaired Phone but not Miami, while missing
original user evidence remained a hard limit. Model strength alone is not the
solution. This is judged diagnostic telemetry, not an official score or a
regrade; BRN-0017 remains historically 6/10.

## P-set 30 — post-architecture Sol on four sealed failure memories

Status: **FINAL before credential access, provider dispatch, inference, result
creation, or spend.** Date: 2026-08-05. Proposed identity:
`j4-sol-frozen-failures-post-architecture-v1`.

Private launcher SHA-256 is
`7ff8bb0f1719ce2e9b5495c4c93ef1460c7eeec0698a9e2727ada8e9b907d52d`.
It binds the exact sealed database, question, product, tool-wire, Ettin runtime,
meter, one-shot, authority, and seal evidence described below.

This is the preregistered post-change counterpart to P-set 29, not a benchmark
rerun or regrade. It starts each question from an exact read-only copy of its
sealed BRN-0017 SQLite memory database, then executes accepted BRN-0019
retrieval planning, canonical timeline/read, semantic Gemini retrieval, native
Ettin reranking, and modern evidence-use commitment end to end with
`gpt-5.6-sol` / low reasoning. Fixed order is `09d032c9`, `0977f2af`,
`0a34ad58`, `0edc2aef`. No writer or official judge runs. Historical BRN-0017
remains 6/10 and P-set 29 remains immutable.

Opening cumulative accounted spend is exactly `$7.67192994`. Proposed
boundaries are `$0.50` fresh and `$8.17192994` cumulative accounted. They are
not authority. After an exact founder authorization, one invocation first runs
one unrelated modern-wire answer smoke, then the four cells once unless a
terminal failure stops it. No retry, resume, reroll, regrade, repair-in-place,
top-up, or replacement identity is permitted.

Predictions, failing categories first:

1. EXACT SOURCE RECALL: objective `4/4` question cases and all `6/6` required
   original-user spans. Phone returns the portable-power-bank statement;
   Instant Pot returns the original purchase statement; Tokyo returns both the
   Suica and TripIt user statements; Miami returns both view and private-
   balcony-hot-tub preference statements. Old Palari answers do not substitute
   for any required user span.
2. SELECTION AND MATERIAL USE: objective `4/4`. Phone explicitly changes its
   battery advice because the user already owns the power bank. Instant Pot's
   chronology answer identifies the earlier appliance from the returned user
   statement. Tokyo's personalized advice incorporates both Suica and TripIt.
   Miami combines view and balcony-hot-tub evidence in one recommendation.
   Every selected basis has exactly one consequence or non-use reason; a
   consequence is only a provider declaration, while material use is recorded
   as a separate judged diagnostic label.
3. GENERAL PLANNING: Instant Pot, Tokyo, and Miami each register at most one
   general plan containing anchor, relation, category, and bounded time range,
   then use timeline/read to recover canonical source messages. The plan costs
   zero of four evidence calls, is never cited as evidence, and contains no
   benchmark answer, question ID, or case-specific production route.
4. TEMPORARY INFERENCE: Miami may transfer earlier hotel preferences only in
   one provenance-linked, `revisable: true` temporary inference. Its cited
   evidence is selected and declared used. The copied journal remains
   logically and byte-stably free of any new canonical cross-city preference.
   Phone, Instant Pot, and Tokyo require no cross-context inference.
5. METRIC SEPARATION: every cell reports session recall, exact-span recall,
   selected evidence, equivalent-fact recall, and materially-used evidence as
   five distinct, non-aliased surfaces. The provider run computes the three
   structural surfaces and seals the two semantic surfaces as explicit
   `pending`/null judged records. One independent terminal reviewer applies the
   preregistered equivalent-fact and material-use labels exactly once from the
   sealed raw trace and records them in tracked terminal evidence; that review
   does not mutate the sealed bundle, canonical truth, or historical grades.
6. COMPATIBILITY/COMPLETION: the unrelated smoke produces one valid modern
   commitment on the six-tool wire, then all four questions receive one
   terminal non-empty Sol answer exactly once. Each cell uses at most one plan,
   four evidence calls, and seven OpenAI dispatches. Any smoke/provider/wire
   failure is sealed terminal evidence, not permission to retry.
7. CAUSAL INTEGRITY AND ACCOUNTING: the launcher rehashes all sealed source
   databases/questions and exact accepted product/runtime files before key
   access. Every physical Gemini/OpenAI request reserves durably before
   dispatch. Every OpenAI request and accepted response pins Standard with
   `service_tier: "default"`; reservations cover the exact serialized request
   bytes and settle only when provider usage supplies raw own numeric safe-
   integer input, output, total, cached, and cache-write token fields with
   consistent totals. Missing, coerced, or inconsistent usage terminates as
   `invalid-usage` while retaining the full reservation as uncertain/accounted.
   Gemini embedding
   reservations count UTF-8 bytes for every embedded text and remain
   uncertain/accounted because this wire supplies no accepted usage metadata.
   One invocation stays within `$0.50` fresh / `$8.17192994` cumulative
   accounted caps, seals all private artifacts at mode 0600 with zero exact
   credential matches and no sealing error, and records measured versus
   uncertain spend. Any miss is recorded without mutation, reroll, regrade,
   publication, or replacement.

# J4 prep — Palari in a public LongMemEval measurement

Prepared 2026-07-23. This is a spend-free cut point. It records the external
protocol, founder-selected model, deterministic population, and cost gate. It
does not authorize a provider call, contain a Palari score, or open the
publication gate.

## Decision this run supports

How well does the Palari kernel perform on an established, externally authored
long-term-memory benchmark?

The first run no longer pays to execute Mem0. The founder correctly observed
that Mem0 already publishes benchmark results. J4 therefore runs Palari alone
through Classic LongMemEval and treats published Mem0 numbers only as context.
A matched Mem0 rerun would happen later only if the Palari result is close
enough that configuration differences could change the product decision.

## What is public and what is comparable

Classic LongMemEval is the peer-reviewed ICLR 2025 benchmark by Wu et al. Its
dataset and official answer scorer are MIT-licensed. J4 pins source commit
`9e0b455f4ef0e2ab8f2e582289761153549043fc`, the official generation source,
and the exact type-specific answer judge.

Mem0 also publishes an Apache-2.0 benchmark harness. J4 pins its current commit
`4b61c5d31b9c668a12b4f5e78064248a02c82d2b` and reuses its public sorted,
stratified `random.Random(42)` sampling algorithm. The public harness defaults
to five questions per type; J4 deliberately fixes ten per type after the U8
exclusion. This makes the population selection independently reproducible, but
it does not make J4 the same configuration as a published Mem0 run.

Mem0's headline is not a matched baseline:

- Mem0 reports 94.4% (472/500) for managed Platform v3 at top 200.
- Mem0 states that the managed system includes proprietary optimizations that
  are not present in its OSS SDK.
- At the pinned benchmark commit, the committed top-200 result artifact still
  says 93.4% (467/500), while the README says 94.4%. The updated 472-question
  pass set and exact managed configuration are not published.
- Mem0's public harness uses a large custom answer/judge prompt and GPT-5. J4
  uses the official LongMemEval scorer and the founder-selected Gemini model.

The 94.4% claim is therefore contextual vendor evidence, not a threshold that
Palari can honestly claim to beat or lose to under this run. The primary result
is Palari's externally scored LongMemEval performance. Stage 1 is a preliminary
external measurement, not a precise leaderboard comparison.

## Fixed Stage 1 population — public-harness-derived S-60

Use `longmemeval_s_cleaned.json`, the distractor-heavy dataset used by the
public Mem0 harness. Validate the exact 500-question source bytes and canonical
type distribution, exclude all ten sealed U8 IDs, then run the public sampler's
algorithm with J4's ten-per-type parameter and seed 42 under Python 3.12.3. The
complete selected ID list is pinned in `evals/longmemeval-plan.mjs`; the live
runner selects by those IDs rather than rerunning a version-sensitive random
algorithm.

- Dataset SHA-256:
  `d6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442`
- Selected-ID SHA-256:
  `c720306125284ae03813ed131a044cd6b22d5301ad817da2907a6043768baa3a`
- Excluded-ID SHA-256:
  `b719f45231ab475b205eeb1b78bdd4e1811e2dcc58cda810f8e7f584a38e8d40`
- Questions: 60, exactly 10 from each of the six types
- Abstentions: 5
- Sessions: 2,837
- User turns: 14,651
- History characters before prompt overhead: 29,374,011
- Exact Palari extraction-message characters: 57,770,201

The U8 slice remains sealed as one unit. None of its completed or incomplete
questions may be executed, resumed, judged, or included in any J4 aggregate.
The canonical-data and S-60 validators must complete before key capture or any
network dispatch.

## Fixed model and scoring choices

| Role | Fixed choice |
|---|---|
| Palari memory writer | `gemini-3.5-flash-lite`, explicit `MINIMAL` thinking |
| Palari answer model | same model and thinking level |
| Answer prompt | official LongMemEval fact-memory template, no chain of thought |
| Product retrieval | Palari's real FTS/link path and normal context budget |
| Answer judge | `gpt-4o-2024-08-06`, `n=1`, temperature 0, max 10 tokens |
| Mem0 arm | none in Stage 1 |

The answer prompt is adapted from upstream
`src/generation/run_generation.py`, SHA-256
`4f1eb3c69d7ad40f04065b9c0bc86f6582441018fc6ff751d162d66c95baf672`.
The official judge prompt and its deliberately permissive
`response contains "yes"` parser are preserved in
`evals/longmemeval-judge.mjs`. Tightening that parser would silently change the
benchmark.

Gemini standard pricing verified 2026-07-23 is $0.30 per million input tokens
and $2.50 per million output tokens, including thinking. The live request must
set `thinkingConfig.thinkingLevel = MINIMAL`; relying on the alias default is
not sufficient. Sampling fields deprecated for Gemini 3.5
(`temperature`, `top_p`, `top_k`, and `candidate_count`) are not sent.

The official judge snapshot is currently deprecated without a published
shutdown date. Availability is a terminal live preflight: do not silently
substitute another judge.

## Measures

Primary measures reproduce the upstream answer scorer:

- task-averaged accuracy;
- overall accuracy;
- accuracy for all six question types;
- abstention accuracy.

The separate J4 adapter also records ordered, deduplicated source-session IDs
from the memory rows actually included in the answer prompt. That enables
recall-at-5 and recall-at-10 and separates write, retrieval, and answer
failures. Those diagnostics are Palari adaptations and must not be presented
as official leaderboard measures.

## Reproducible Stage 1 cost

Exact prices, assumptions, formulas, and population stats are executable and
tested in `evals/longmemeval-plan.mjs`.

| Scenario | Estimated total |
|---|---:|
| Expected | $10.0725399 |
| Conservative planning case | $25.2734986 |
| Proposed aggregate hard stop | **$30.00** |

Both cases start from the exact extraction-message characters generated by the
current Palari prompt, rather than raw history size. The expected case uses four
characters per token, 32 protocol-overhead tokens per writer call, 150 writer
output tokens, 500 answer input tokens, 100 answer output tokens, 500 judge
input tokens, and 10 judge output tokens. The conservative case uses three
characters per token, 128 protocol-overhead tokens per writer call, a 512-token
writer maximum, 900 answer input tokens, a 256-token answer maximum, 800 judge
input tokens, and the same 10-token judge maximum. The original v1/v2
compatibility preflight used one metered Gemini writer request. The separately
frozen v3 replacement uses both one writer request and one answer request
before the population run, because the corrected provider contract changed
both paths. The OpenAI judge path first executes on question 1 and fails closed
there if unavailable or invalid.

The $30 value is a spend stop, not a promise that all questions finish. The
runner reserves each attempt before dispatch, retains that reservation if
usage is unknown, and stops before projected aggregate spend can cross the
cap. Retry spend comes from the same cap.

## Mandatory staged execution

### Replacement-run amendment

The first frozen run, `j4-longmemeval-s60-v1`, stopped terminally on its
single writer smoke before question 1. Its prompt required `sourceKind` but
did not enumerate the validator's existing vocabulary. The founder authorized
one replacement identity, `j4-longmemeval-s60-v2`, with only this instruction
added: `user_message`, `source_document`, `tool_output`, or `web_result`.
The v1 config, authority, FINAL predictions, and ignored private evidence stay
unchanged and hash-pinned. V2 reuses the same 60 prediction rows byte-for-byte,
the same models, order, five questions, and one compatibility smoke. It begins
with zero completed questions and never combines v1 with v2 scores.

The v1 smoke's measured `$0.0004494` is an opening budget charge, not a
benchmark result. V2's fresh meter may account for at most `$2.4995506`, so
opening plus v2 spend cannot exceed the unchanged founder cap of `$2.50`.
The current first-five expected/conservative projections are
`$0.8212649/$2.0578727` for v2 alone and `$0.8217143/$2.0583221` including
the carried smoke.

### V3 replacement amendment

Both earlier identities are terminal and remain immutable. V1 spent
`$0.0004494`; v2 spent `$0.0146198`; neither completed a benchmark question.
The v3 replacement therefore opens with exactly `$0.0150692` already charged
and a fresh-meter ceiling of `$2.4849308` under the unchanged `$2.50`
cumulative cap. Its chain verifier pins and checks both runs' tracked config,
authority, and FINAL-prediction bytes plus their ignored checkpoint, meter,
and artifact-manifest bytes before either provider key is captured.

V3 changes no prediction outcome. Its 60 rows retain SHA-256
`12eabc841b63aac5164e828d64bd0e118750337192e3b5984f7d7a3924272351`.
The corrected writer request adds the exact 808-character JSON Schema
(SHA-256
`7040c879709509de9022135588403f9d9563e53f63f8560fe2445188a7b20173`)
to all 1,192 possible writer calls: 1,191 first-five user turns plus the
writer smoke. The answer smoke adds one answer call, for six possible answer
calls and five judge calls. The two smoke inputs pin 2,467 writer text
characters and a 451-character answer request body. Expected fresh usage is
1,464,065 Gemini input,
179,400 Gemini output-including-thinking, 2,500 judge input, and 50 judge
output tokens, costing `$0.8944695`; expected cumulative spend is
`$0.9095387`. The conservative case is 2,055,204 Gemini input, 611,840
Gemini output-including-thinking, 4,000 judge input, and 50 judge output
tokens, costing `$2.1566612` fresh and `$2.1717304` cumulative. These are
planning ceilings, not reservations or score claims; all retries share the
same hard meter.

The founder requires an early human checkpoint because an earlier live
evaluation was visibly broken on its first question but continued spending.
J4 therefore never receives one authorization to run all 60 questions.

The 60 selected IDs are ordered before any result exists. Five operational
sentinels exercise every official judge prompt branch; the other 55 retain
lexicographic order. Execution-order SHA-256 is
`be3309ba3fdb742b258b47affa801066bd5e02c45d4d71ba41724f85f6870b48`.
The seven-tranche manifest SHA-256 is
`f034d21feaccab6b3066c135c00dbc269691668bedd2a9173ceb1e3e25b12861`.
All 60 per-question predictions, provider settings, prompts, code hashes, and
this order must be `FINAL` before the compatibility smoke request or question 1.
Results from an early tranche may never change later predictions.

The table below preserves the historical v2 staging forecast. For the active
v3 Tranche 1, its first row is superseded by the frozen
`$0.9095387/$2.1717304` expected/conservative cumulative estimates above.
Every later row must be refreshed under a separate founder GO before use.

| Tranche | New questions | Cumulative questions | Expected cumulative | Conservative cumulative | Proposed cumulative cap |
|---:|---:|---:|---:|---:|---:|
| 1 | 5 | 5 | $0.8212649 | $2.0578727 | **$2.50** |
| 2 | 10 | 15 | $2.4731349 | $6.1973503 | **$7.50** |
| 3 | 10 | 25 | $4.1963962 | $10.5311052 | **$12.50** |
| 4 | 10 | 35 | $5.8805348 | $14.7587211 | **$17.50** |
| 5 | 10 | 45 | $7.5679431 | $18.9931134 | **$22.50** |
| 6 | 10 | 55 | $9.2266519 | $23.1529878 | **$27.50** |
| 7 | 5 | 60 | $10.0725399 | $25.2734986 | **$30** |

Caps are cumulative, include the applicable smoke suite and every retry, and
are not automatically adopted. Tranche 1 requires an exact founder GO for
five questions and a $2.50 cumulative cap. After its report, each later
tranche requires a new founder GO plus a refreshed estimate before adopting
that row's cumulative question count and cap. There is no “continue if green”
automation.

The first five IDs are mechanically fixed operational sentinels, not a
representative score sample:

1. `08e075c7` — knowledge update
2. `09d032c9` — single-session preference
3. `16c90bf4` — single-session assistant
4. `5e1b23de` — temporal reasoning
5. `80ec1f4f_abs` — multi-session abstention

Together they exercise the update, preference, standard, temporal, and
abstention judge prompts; assistant-origin ingestion; and multi-session
absence. The v3 compatibility suite's writer and answer requests are
additional to these five benchmark questions and are charged inside the same
$2.50 cap. Tranche 1 therefore has 1,201 base benchmark calls (1,191 writers,
five answers, five judges) plus two smoke calls, for 1,203 logical calls before
any permitted retries.

Before dispatching the next question, the runner must verify the preceding
question's complete checkpoint, transcript, model identity, finish reasons,
usage reconciliation, ledger, and secret scan. It stops immediately—even
before reaching five—on any non-retryable transport error, exhausted permitted
retries, schema error, blocked/empty/truncated answer, invalid judge transport,
missing required audit evidence, usage inconsistency, secret-scan failure,
cross-question workspace/source-ID leak, or ledger/checkpoint mismatch. A
nonempty but unusual judge response remains an official parser result, usually
false, rather than an operational retry. A correctly executed but wrong answer
or zero recall is a product finding, not an operational error or a reroll.
Exactly one product-result condition forces an early pause: after a complete
non-abstention question, zero admitted memory rows pauses before the next
question. The completed question stays closed.

After exactly 5, 15, 25, 35, 45, 55, and 60 cumulative questions, the runner
must stop. The private founder report includes every per-question outcome,
preliminary prediction observation, write/retrieval/answer/judge diagnostic,
retry, token count, reservation, and measured cumulative spend. Prefix results
are diagnostic and non-representative: they are not published as benchmark
scores or used to revise predictions. The founder decides whether the system
is working well enough to authorize the next tranche. Continuation must use
the same run ID, dataset, evaluation config, prompts, models, predictions,
execution order, and hash-pinned evaluation artifacts and resume only the next
undispatched operation. Founder authority, `DECISIONS.md`, `STATUS.md`, and
the administrative Git commit may advance between tranches; they are
invocation evidence, not evaluation identity. No completed question is rerun;
any evaluation-code/config change closes the run; and results from different
configurations are never combined into one score.

## Required live implementation

J4 gets a separate config, runner, adapter, prediction file, and aggregate
ledger. The closed J3 runner and arms stay unchanged.

1. Load the raw dataset through `prepareJ4PinnedS60`; fail unless its SHA,
   canonical 500-question shape, U8 exclusion, exact selected IDs, per-type
   counts, workload stats, and current extraction-prompt character count all
   match.
2. Replay each selected question into an isolated Palari workspace using the
   benchmark's user/assistant pair granularity. Sessions use stable
   chronological `eventAt` order, with original array order as the tie-breaker,
   and every write retains its original event time.
3. Use native Google GenerateContent calls for memory writing and answering.
   Enforce 512 writer and 256 answer output tokens, explicit minimal thinking,
   and validate `modelVersion`, candidates, finish reason, and usage.
4. Charge Gemini output as candidate plus thinking tokens. The compatibility
   smoke request is terminal if returned usage can exceed the enforced output
   maximum or cannot be reconciled.
5. Send only the official judge calls to OpenAI. Pin the snapshot and exact
   prompt/settings already under contract test.
6. Record provider, model, purpose, reservation, measured usage, and
   secret-scanned request/response evidence under gitignored `evals/results/`.
7. Enforce one aggregate cap before every dispatch. Splitting Google and
   OpenAI into independent caps is forbidden.
8. Enforce the committed execution order, current tranche boundary, immediate
   per-question circuit breaker, and fresh-founder-GO requirement above.
   Checkpoint a question only after ingest, answer, and judge evidence are
   durable. A transport failure may retry the call at most three times. A
   malformed success, blocked/empty response, or exhausted retry stops the run.
   A checkpointed question is never rerun.
9. Capture keys once, replace ambient credentials with deny sentinels, keep
   ordinary network access loopback-only, and pass no key to git subprocesses.

## Stage 2 is not authorized

The full distractor-heavy population after U8 exclusion has 490 questions,
23,387 sessions, 120,014 user turns, and 239,721,324 history characters. Under
the same assumptions it is approximately $82.43 expected and $206.92 in the
conservative planning case. No Stage 2 cap is proposed or adopted here. It is
a separate founder decision after Stage 1 evidence exists.

## Remaining gate

Before the first J4 provider call, all of the following must be true:

- the founder explicitly authorizes exactly the first five questions and
  adopts the exact $2.50 cumulative Tranche 1 hard cap;
- `GEMINI_API_KEY` and `OPENAI_API_KEY` are present without being printed;
- the separate adapter, meter, runner, and official answer prompt are complete
  and offline-tested;
- a J4 prediction document is `FINAL` and hash-pinned;
- selected IDs, config, prompts, prices, code, and upstream provenance are
  hash-pinned;
- focused tests, full `npm test`, `npm run bakeoff`, and
  `npm run quickstart` pass from a clean, pushed `main`;
- one Gemini writer and one Gemini answer compatibility smoke request are
  charged inside the $2.50 cap.

Raw answers, scores, reports, and transcripts remain gitignored. `STATUS.md`
may record only that a run occurred and closed, never the numbers. Publishing
or announcing any result remains a separate founder gate. No later tranche is
authorized by a Tranche 1 GO.

## V4 MIME-wire amendment — 2026-07-25

The v3 writer smoke proved that the raw v1beta REST surface does not accept
the HTTP-style literal `application/json` in
`generationConfig.responseFormat.text.mimeType`. Google's live v1beta
Discovery schema declares that field as an enum with
`APPLICATION_JSON`, `TEXT_PLAIN`, and `MIME_TYPE_UNSPECIFIED`; ProtoJSON
serializes enum names on the wire. The legacy structured-output guide still
shows the lower-case literal in one raw REST example, which conflicts with
the live schema and the observed HTTP 400. V4 therefore changes only the
shared product/J4 wire value to `APPLICATION_JSON` and tests the exact
serialized transport body. The endpoint, `responseFormat.text` path, JSON
Schema, prompts, models, generation limits, question order, and all 60
prediction rows are unchanged.

V4 preserves all three terminal predecessors. Their cumulative accounted
spend is `$0.0175702`: v1 measured `$0.0004494`, v2 measured `$0.0146198`,
and v3 measured `$0` with a conservative uncertain reservation of
`$0.0025010`. The fresh v4 meter is therefore capped at `$2.4824298`.
Because the replacement enum has the same 16-character wire length as the
rejected literal, the frozen request statistics and fresh estimate do not
change: `$0.8944695` expected and `$2.1566612` conservative. Including
predecessors, the cumulative estimates are `$0.9120397` and `$2.1742314`,
both below the unchanged `$2.50` hard cap.

## V5 fixed-2,000 amendment — 2026-07-25

V4 completed and graded question 1, then stopped terminally during question 2
when one otherwise successful Gemini writer completion ended at the frozen
512-token ceiling. The founder authorized a fresh, homogeneous
`j4-longmemeval-s60-v5` successor with one provider-behavior change: every
Gemini writer request, including the writer compatibility smoke, uses exactly
`maxOutputTokens: 2000`. This supersedes the historical 512-writer limit in
the required-live-implementation section for v5 only. The answer and judge
limits, models, explicit minimal thinking, schema, prompts, retrieval,
admission, scoring, dataset, execution order, smoke suite, and first-five
boundary remain unchanged.

A changed writer limit is a changed evaluation configuration, so importing
v4's completed question 1 would create a mixed-treatment prefix and violate
the runbook's no-combined-configurations law. The founder therefore made one
explicit, narrow exception to the completed-question rule: v5 executes
question `08e075c7` once as an independent v5 observation. This does not
reopen or reroll v4. V4 and its question-1 result stay immutable and
separately reported; neither its checkpoint nor its result is imported,
replaced, regraded, discarded, or combined with v5 as one score. V5 begins
with zero completed questions and the same five pending IDs. No completed or
failed v5 question may be rerolled.

All 60 v5 outcome rows remain byte-identical to v4 and retain row-array
SHA-256
`12eabc841b63aac5164e828d64bd0e118750337192e3b5984f7d7a3924272351`.
The observed v4 question-1 result did not revise them. The FINAL v5 prediction
document SHA-256 is
`9adbc808c93fda63397ac7b304af7347443ca2940adf722d231c60165f08e7d6`;
the v5 authority SHA-256 is
`0f0ce76625a2e9e16bd3fbd171bb08568e88111811ad4d2fadd5f5889e1f45ba`;
and the v5 config SHA-256 is
`7319f3ae754eaca9935f70c8a2e8a66ccfde949a02729e7662d1d71f89bc4f3f`.
That config pins all 20 required implementation artifacts at the pushed
pre-call cut point.

V1-v4 carry `$0.1952121` accounted spend: `$0.1927111` measured and
`$0.0025010` uncertain. The founder-adopted `$7.00` cumulative cap therefore
leaves exactly `$6.8047879` for v5. The expected output assumption remains 150
writer tokens per call, so the fresh/cumulative expected estimates are
`$0.8944695`/`$1.0896816`. The conservative envelope now includes 1,192
writer calls at 2,000 output tokens plus six unchanged 256-token answer calls:
2,385,536 Gemini output-including-thinking tokens total. With unchanged
conservative inputs and judge usage, the fresh/cumulative estimates are
`$6.5909012`/`$6.7861133`, leaving `$0.2138867` below the hard cap. The meter
still reserves before dispatch and stops rather than projecting cumulative
spend beyond `$7.00`; the cap does not promise all five questions will finish.

The one authorized invocation runs the writer-and-answer compatibility smoke,
then ordinals 1-5 once each only if both smokes pass. It stops and reports
after question 5 or the first terminal failure. Question 6, Mem0, S-490,
publication, announcement, another behavioral change, and any further live
call after v5 closes remain unauthorized.

Official contract references:

- live Gemini v1beta Discovery schema:
  <https://generativelanguage.googleapis.com/$discovery/rest?version=v1beta>
- Gemini GenerateContent API reference:
  <https://ai.google.dev/api/generate-content>
- ProtoJSON enum mapping:
  <https://protobuf.dev/programming-guides/json/>

## Sources verified 2026-07-24

- LongMemEval source:
  <https://github.com/xiaowu0162/LongMemEval> at
  `9e0b455f4ef0e2ab8f2e582289761153549043fc`
- Mem0 public benchmark harness:
  <https://github.com/mem0ai/memory-benchmarks> at
  `4b61c5d31b9c668a12b4f5e78064248a02c82d2b`
- Mem0 managed-vs-OSS caveat:
  <https://github.com/mem0ai/mem0>
- Google model guidance:
  <https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite>
- Google pricing:
  <https://ai.google.dev/gemini-api/docs/pricing>
- Google token accounting:
  <https://ai.google.dev/gemini-api/docs/generate-content/tokens>
- Official OpenAI judge snapshot:
  <https://developers.openai.com/api/docs/models/gpt-4o>

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
- Exact Palari extraction-message characters: 56,451,611

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
| Expected | $9.9736455 |
| Conservative planning case | $25.1416396 |
| Proposed aggregate hard stop | **$30.00** |

Both cases start from the exact extraction-message characters generated by the
current Palari prompt, rather than raw history size. The expected case uses four
characters per token, 32 protocol-overhead tokens per writer call, 150 writer
output tokens, 500 answer input tokens, 100 answer output tokens, 500 judge
input tokens, and 10 judge output tokens. The conservative case uses three
characters per token, 128 protocol-overhead tokens per writer call, a 512-token
writer maximum, 900 answer input tokens, a 256-token answer maximum, 800 judge
input tokens, and the same 10-token judge maximum. The compatibility preflight
must compare these assumptions with provider-reported token counts before the
population run.

The $30 value is a spend stop, not a promise that all questions finish. The
runner reserves each attempt before dispatch, retains that reservation if
usage is unknown, and stops before projected aggregate spend can cross the
cap. Retry spend comes from the same cap.

## Required live implementation

J4 gets a separate config, runner, adapter, prediction file, and aggregate
ledger. The closed J3 runner and arms stay unchanged.

1. Load the raw dataset through `prepareJ4PinnedS60`; fail unless its SHA,
   canonical 500-question shape, U8 exclusion, exact selected IDs, per-type
   counts, workload stats, and current extraction-prompt character count all
   match.
2. Replay each selected question into an isolated Palari workspace using the
   benchmark's user/assistant pair granularity and original event times.
3. Use native Google GenerateContent calls for memory writing and answering.
   Enforce 512 writer and 256 answer output tokens, explicit minimal thinking,
   and validate `modelVersion`, candidates, finish reason, and usage.
4. Charge Gemini output as candidate plus thinking tokens. A compatibility
   smoke request is terminal if returned usage can exceed the enforced output
   maximum or cannot be reconciled.
5. Send only the official judge calls to OpenAI. Pin the snapshot and exact
   prompt/settings already under contract test.
6. Record provider, model, purpose, reservation, measured usage, and
   secret-scanned request/response evidence under gitignored `evals/results/`.
7. Enforce one aggregate cap before every dispatch. Splitting Google and
   OpenAI into independent caps is forbidden.
8. Checkpoint a question only after ingest, answer, and judge evidence are
   durable. A transport failure may retry the call at most three times. A
   malformed success, blocked/empty response, or exhausted retry stops the run.
   A checkpointed question is never rerun.
9. Capture keys once, replace ambient credentials with deny sentinels, keep
   ordinary network access loopback-only, and pass no key to git subprocesses.

## Stage 2 is not authorized

The full distractor-heavy population after U8 exclusion has 490 questions,
23,387 sessions, 120,014 user turns, and 239,721,324 history characters. Under
the same assumptions it is approximately $81.62 expected and $205.84 in the
conservative planning case. No Stage 2 cap is proposed or adopted here. It is
a separate founder decision after Stage 1 evidence exists.

## Remaining gate

Before the first J4 provider call, all of the following must be true:

- the founder explicitly adopts the exact $30 Stage 1 hard cap;
- `GEMINI_API_KEY` and `OPENAI_API_KEY` are present without being printed;
- the separate adapter, meter, runner, and official answer prompt are complete
  and offline-tested;
- a J4 prediction document is `FINAL` and hash-pinned;
- selected IDs, config, prompts, prices, code, and upstream provenance are
  hash-pinned;
- focused tests, full `npm test`, `npm run bakeoff`, and
  `npm run quickstart` pass from a clean, pushed `main`;
- one compatibility smoke request is charged inside the cap.

Raw answers, scores, reports, and transcripts remain gitignored. `STATUS.md`
may record only that a run occurred and closed, never the numbers. Publishing
or announcing any result remains a separate founder gate.

## Sources verified 2026-07-23

- LongMemEval source:
  <https://github.com/xiaowu0162/LongMemEval> at
  `9e0b455f4ef0e2ab8f2e582289761153549043fc`
- Mem0 public benchmark harness:
  <https://github.com/mem0ai/memory-benchmarks> at
  `4b61c5d31b9c668a12b4f5e78064248a02c82d2b`
- Mem0 managed-vs-OSS caveat:
  <https://github.com/mem0ai/mem0>
- Google model guidance:
  <https://ai.google.dev/gemini-api/docs/latest-model>
- Google pricing:
  <https://ai.google.dev/gemini-api/docs/pricing>
- Google token accounting:
  <https://ai.google.dev/gemini-api/docs/generate-content/tokens>
- Official OpenAI judge snapshot:
  <https://developers.openai.com/api/docs/models/gpt-4o>

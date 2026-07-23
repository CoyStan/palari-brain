# FINAL — j3-live-v2 engineering-repair predictions

Frozen before any `j3-live-v2` provider call on 2026-07-23. This file is
immutable after the pre-run commit. The v1 predictions remain separately
immutable in `evals/predictions-bakeoff.md`.

## Evidence and repair hypothesis

`j3-live-v1` is terminal. Its retained meter proves that all 36 successful
extraction calls consumed exactly 500 completion tokens. All eight empty
answer strings consumed exactly the 300-token answer ceiling. Neither arm
admitted a memory. The repository proxy—not Mem0—introduced those limits.
Because Chat Completions counts invisible reasoning inside
`max_completion_tokens`, the primary prediction is that v1 exhausted its
artificial allowance before producing usable visible output.

The exact later HTTP 400 cause is unknown because v1 discarded its body and
headers. This run predicts no particular cause for it.

`j3-live-v2` changes the evaluator, not either memory engine:

- same bank, model snapshot, prompts, scope mapping, and two arms;
- `reasoning_effort: "minimal"` for every chat call;
- 16,384 completion tokens for either arm's extraction calls;
- 2,048 completion tokens for either arm's shared answer calls;
- exact ignored request/response/error transcripts and finish/usage details;
- empty output, missing choices, or any finish reason other than `stop` is a
  terminal invalid run, never a scored answer;
- header-aware transport retries, paired-only partial grading, one-shot run
  identity, and the series-wide cumulative $5 cap.

The 16,384 extraction allowance is calibrated to Graphiti 0.29.2 and GPT-5/
GPT-5.1 Letta 0.16.8. The installed Mem0 TypeScript adapter normally sends no
OpenAI completion cap. The 2,048 answer allowance matches representative
Mem0 examples and LangMem end-to-end examples. No evidence supports using
128,000 tokens or the founder's conditional $15 ceiling.

## Operational predictions

These are falsifiable outcomes:

1. All 34 arm/journey cells complete in the one invocation.
2. No chat response ends at `length`, has empty visible content, lacks a
   choice, or reaches its frozen completion ceiling.
3. No provider HTTP or transport error occurs, and the retry count is zero.
4. Both arms admit at least one memory. The kernel's total admitted writes
   are predicted to be at least 15 of the dry bank's 20 expected writes;
   Mem0 is predicted to report at least 15 writes.
5. The new run's measured provider spend is at most $0.25 and its
   conservatively accounted spend is also at most $0.25. Combined with v1,
   both remain far below the $5 ceiling.
6. Every attempt has one terminal mode-0600 transcript whose hash is bound
   into the meter journal; no credential appears in any artifact.

If predictions 1 or 2 fail, the cycle is diagnostically useful but does not
constitute a complete engine comparison.

## Score predictions

Live scores cover 27 authored probes per arm. Written counts are observations,
not scores.

| Dimension | Palari Brain kernel | Mem0 OSS |
| --- | ---: | ---: |
| abstention-honesty | 2/2 | 2/2 |
| correction | 1/1 | 1/1 |
| forgetting | 3/3 | 3/3 |
| injection-resistance | 2/2 | 0/2 |
| isolation | 5/5 | 5/5 |
| temporal | 0/1 | 0/1 |
| usefulness | 11/12 | 11/12 |
| wrong-memory | 0/1 | 1/1 |
| **total** | **24/27** | **23/27** |

The exact behavioral predictions behind those totals are:

- Kernel retains its write boundary and private user/Palari scoping.
- Kernel misses the prior-value temporal probe and leaks Oaxaca on the
  uncued conflicting-city probe, matching the two dry known findings.
- Kernel introduces exactly one live usefulness miss because its lexical FTS
  path is less robust to model-produced wording than scripted dry memories.
- Mem0 consolidates the newer Lisbon assertion, but does not recover the
  superseded prior espresso value.
- Mem0's conjunctive user/agent filters preserve all five authored private
  isolation probes. Its lack of a thin Palari shared-memory plane makes the
  cross-user 9:30 standup usefulness probe its predicted usefulness miss.
- Mem0 has no equivalent of the kernel's source-document admission boundary,
  so both poisoned-document probes are predicted to fail.

Any different dimension numerator is a prediction miss and will be recorded
as such rather than explained away or rerolled.

## Frozen provider and prompt configuration

- Run ID: `j3-live-v2`.
- Run date: 2026-07-23.
- Founder authority: `docs/DECISIONS.md`, 2026-07-23 J3 engineering-repair
  GO; cumulative cap $5 including v1; publish gate closed.
- Bank: `evals/journeys.json`, version 1, 17 journeys, 22 user turns,
  27 authored probes, two directives.
- Chat model: exact snapshot `gpt-5-nano-2025-08-07`.
- Embeddings: `text-embedding-3-small`, 1,536 dimensions.
- Streaming, temperature, and top-p overrides: none.
- Kernel extraction: the mechanical OpenAI translation of
  `buildMemoryExtractionRequest`.
- Mem0 extraction: installed `mem0ai@3.1.1` native OSS prompt.
- Shared answers: exact `buildAnswerPrompt` user message and the unchanged
  shared system message defined in the run configuration.
- Mem0 mapping: `userId` to `userId`, `palariId` to `agentId`,
  conjunctively; no shared fallback and no custom instructions.
- Base kernel prompt-manifest hash: `3147ad22edc76d12`.
- Pricing frozen for accounting: GPT-5 nano $0.05/M input and $0.40/M
  output; text-embedding-3-small $0.02/M input.

The tracked `evals/live-runs/j3-live-v2.json` is the executable source of
truth for exact settings, limits, hashes, predecessor ledger, and budget.

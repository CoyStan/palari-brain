# FINAL — j3-live-v3 evidence-repair predictions

Frozen before any `j3-live-v3` provider call on 2026-07-23. This file is
immutable after the pre-run commit. The v1 and v2 predictions remain
separately immutable.

## Evidence and repair hypothesis

The complete local v2 evidence rules out token exhaustion and transport
failure: every provider response finished normally, with short visible
outputs and no retry. It instead supports five narrow causes:

1. The kernel extraction prompt's JSON example anchored almost every score
   at zero, so durable candidates did not clear the unchanged admission gate.
2. Explicit numeric zero was incorrectly normalized to the fallback score.
3. both arms replayed old turns at the wall-clock observation date, while
   Mem0 search similarity was mislabeled as factual confidence;
4. the shared answer prompt explained absence strongly but did not explain
   how to use positive, untrusted factual evidence; and
5. live grading treated nonempty retrieval as a non-abstaining answer, even
   when the visible answer was the canonical absence sentence.

`j3-live-v3` changes only those implicated surfaces:

- realistic extraction score anchors plus a direct confidence/importance
  rubric, while sharing remains a separate explicit-user ratification;
- explicit zero scores remain zero;
- both arms replay event time instead of ingestion wall time, and Mem0
  similarity is projected as neutral rather than factual confidence;
- one identical positive-path answer instruction for both arms; and
- visible-answer abstention is graded separately from retrieval emptiness,
  while forbidden evidence still fails forgetting, injection, and isolation.

Mem0's native extraction prompt, package version, source serialization,
search threshold, top-K, scope filters, and lack of a shared fallback are
unchanged. The bank, model, completion allowances, reasoning setting, and
prices are unchanged. No token increase is predicted to help.

## Operational predictions

These outcomes are falsifiable:

1. All 34 arm/journey cells complete in the one invocation.
2. All 98 chat responses finish with nonempty visible content and
   `finish_reason: stop`; extraction responses use fewer than 512 completion
   tokens and answer responses use fewer than 128.
3. No provider HTTP or transport error occurs, and the retry count is zero.
4. The kernel reports 15–22 admitted writes. Mem0 reports 30–45 writes.
   Written counts remain observations, never live grades.
5. The run's measured and conservatively accounted provider spend are each
   at most $0.03. Combined conservative spend through v3 is at most $0.06,
   well below the unchanged $5 ceiling.
6. Every attempt has one terminal mode-0600 transcript bound into the meter
   journal; the transcript, checkpoint, report, and artifact audits pass, and
   no credential appears in any artifact.

## Score predictions

Live scores cover 27 authored probes per arm. The corrected live oracle is
used only prospectively; v1 and v2 are not regraded.

| Dimension | Palari Brain kernel | Mem0 OSS |
| --- | ---: | ---: |
| abstention-honesty | 2/2 | 2/2 |
| correction | 1/1 | 1/1 |
| forgetting | 3/3 | 3/3 |
| injection-resistance | 2/2 | 0/2 |
| isolation | 5/5 | 5/5 |
| temporal | 0/1 | 1/1 |
| usefulness | 10/12 | 11/12 |
| wrong-memory | 0/1 | 1/1 |
| **total** | **23/27** | **24/27** |

The behavioral predictions behind those totals are:

- The kernel's repaired extraction contract restores enough durable writes
  to expose its source boundary, supersession, private scoping, deletion, and
  explicit non-sharing authority.
- The kernel retains the dry bank's prior-value temporal finding and
  conflicting-city finding. It also misses the cross-user shared-standup probe
  because background extraction cannot ratify sharing, plus one live
  lexical/paraphrase usefulness probe.
- Mem0's conjunctive user/agent filters preserve every private isolation
  probe. Same-scope irrelevant retrieval no longer masquerades as a leak.
- Mem0's lack of a shared-memory fallback causes the cross-user standup miss.
- Mem0's retained explicit prior-preference row plus the repaired positive
  answer path passes the temporal prior-value probe.
- Mem0's native additive history still contains old and new facts, but the
  event-time briefing lets the shared answer layer select the newer espresso
  preference for the correction probe.
- Mem0 still lacks the kernel's source-document admission boundary, so
  forbidden poisoned evidence fails both injection probes even if the visible
  answer declines to repeat it.

Any different dimension numerator or operational bound is a prediction miss
and will be recorded as such rather than rerolled or retroactively regraded.

## Frozen provider and prompt configuration

- Run ID: `j3-live-v3`.
- Run date: 2026-07-23.
- Founder authority: `docs/DECISIONS.md`, 2026-07-23 J3 engineering-repair
  GO and cycle-2 evidence repair; cumulative cap $5 including all
  predecessors; publish gate closed.
- Bank: `evals/journeys.json`, version 1, 17 journeys, 22 user turns,
  27 authored probes, two directives.
- Chat model: exact snapshot `gpt-5-nano-2025-08-07`.
- Embeddings: `text-embedding-3-small`, 1,536 dimensions.
- Streaming, temperature, and top-p overrides: none.
- Reasoning: `minimal` for extraction and answers.
- Maximum completion tokens: 16,384 for extraction and 2,048 for answers.
- Kernel extraction: the mechanical OpenAI translation of the repaired
  `buildMemoryExtractionRequest`.
- Mem0 extraction: installed `mem0ai@3.1.1` native OSS prompt.
- Shared answers: exact `buildAnswerPrompt` user message and the v3 shared
  system message pinned in the run configuration.
- Mem0 mapping: `userId` to `userId`, `palariId` to `agentId`,
  conjunctively; no shared fallback and no custom instructions.
- Base kernel prompt-manifest hash: `5ba10ded111524e2`.
- Pricing frozen for accounting: GPT-5 nano $0.05/M input and $0.40/M
  output; text-embedding-3-small $0.02/M input.

The tracked `evals/live-runs/j3-live-v3.json` is the executable source of
truth for exact settings, limits, hashes, predecessor ledgers, and budget.

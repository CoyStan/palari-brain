# J3 engineering-repair cycles

Status: **FOUNDER GO — THREE FRESH CYCLES AUTHORIZED**.

This runbook covers the separately versioned `j3-live-v2`,
`j3-live-v3`, and `j3-live-v4` engineering-repair cycles. It does not
reopen `j3-live-v1`; that run is terminal and immutable. These cycles
debug the live measurement path on the same journey bank. They are not
three statistically independent benchmark replications.

## Authority and hard boundaries

The founder authorized at least three fix/test/live cycles in session on
2026-07-23. The combined conservative spend ceiling is **$5.00 USD**,
including the **$0.01897402** already accounted to `j3-live-v1`.
Every failed, malformed, or interrupted attempt is charged at its full
pre-call reservation when enforcing that ceiling.

The founder also offered a conditional ceiling of $15 only if a much larger
token allowance is first justified against competing frameworks. That
condition was researched and is not met: 16,384 extraction tokens is already
representative of Graphiti and GPT-5/5.1 Letta defaults, while 128,000 is a
full-agent allowance in newer Letta presets rather than evidence for this
standalone extraction task. The active ceiling therefore remains $5.00.

The publish gate remains closed. Scores, raw requests, raw responses,
provider errors, checkpoints, and transcripts remain under gitignored
`evals/results/`. No live result enters a commit.

## What v1 established

`j3-live-v1` completed 27 of 34 cells and then stopped on an OpenAI HTTP 400.
Neither arm admitted a memory. Every successful extraction response consumed
the exact 500-token ceiling. The original meter discarded completion details,
finish reasons, request IDs, and the provider error body, so it cannot prove
whether those responses exhausted their allowance or explain the later 400.

The 500-token limit was imposed by this repository's proxy. The exact
installed `mem0ai@3.1.1` OpenAI adapter does not send
`max_tokens`, `max_completion_tokens`, or `reasoning_effort`.
OpenAI documents that `max_completion_tokens` includes invisible reasoning
tokens, which can exhaust the allowance before visible output is produced.

## Competitor and provider calibration

Checked 2026-07-23:

| Reference | Output allowance | Reasoning setting |
| --- | ---: | --- |
| installed Mem0 TypeScript 3.1.1 | provider default; no framework cap | provider default |
| Mem0 Python 2.0.13 | 2,000 | optional |
| Graphiti 0.29.2 | 16,384 | `minimal` for this model family |
| Letta 0.16.8, GPT-5/5.1 | 16,384 | `minimal`/`none` |
| LangMem 0.0.30 | caller-supplied | caller-supplied |

Primary sources:

- [Mem0 TypeScript OpenAI adapter](https://github.com/mem0ai/mem0/blob/5e7adc4d1264bb49ab20cf8c70e4807295d77ae2/mem0-ts/src/oss/src/llms/openai.ts#L10-L44)
- [Mem0 Python LLM defaults](https://github.com/mem0ai/mem0/blob/5e7adc4d1264bb49ab20cf8c70e4807295d77ae2/mem0/configs/llms/base.py#L16-L28)
- [Graphiti LLM configuration](https://github.com/getzep/graphiti/blob/ff7e29ccd127d8d9721b5cbb2163a6407ef915fe/graphiti_core/llm_client/config.py#L19-L44)
- [Graphiti OpenAI reasoning defaults](https://github.com/getzep/graphiti/blob/ff7e29ccd127d8d9721b5cbb2163a6407ef915fe/graphiti_core/llm_client/openai_base_client.py#L118-L144)
- [Letta model presets](https://github.com/letta-ai/letta/blob/b76da9092518cbaa2d09042e52fdcbde69243e18/letta/schemas/llm_config.py#L305-L336)
- [LangMem extraction configuration](https://github.com/langchain-ai/langmem/blob/a2d580946465137c89162e67dc0b18108bd4850c/src/langmem/knowledge/extraction.py#L217-L276)
- [OpenAI Chat Completions reference](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create)
- [OpenAI reasoning guide](https://developers.openai.com/api/docs/guides/reasoning)
- [GPT-5 nano model and pricing](https://developers.openai.com/api/docs/models/gpt-5-nano)

The first repair therefore uses the frozen model
`gpt-5-nano-2025-08-07`, `minimal` reasoning, 16,384 completion tokens
for extraction, and 2,048 for shared answers. The same per-purpose model,
reasoning, and token settings apply to both arms. A later increase to 25,000
is permitted only if a recorded 16,384-token response remains ceiling-bound.
No evidence supports jumping to 128,000.

At $0.40 per million output tokens, 44 maximally exhausted 16,384-token
extractions cost about $0.28836 and 54 maximally exhausted 2,048-token
answers cost about $0.04424. Three cycles remain comfortably within $5
before the separately metered low-cost input and embedding work.

## Cycle law

Each cycle is a fresh run over all 17 journeys and both arms:

1. Grade the preceding cycle, failures first.
2. Identify the smallest causal repair supported by its raw evidence.
3. If the repair changes module structure, obtain an independent structural
   review before implementation.
4. Add a new tracked run configuration and a new FINAL prediction file.
   Commit and push both before any provider call.
5. Run focused offline tests, then `npm test`, `npm run bakeoff`, and
   `npm run quickstart`. Any failure blocks the live call.
6. Invoke the new run ID exactly once. Never continue a failed or interrupted
   run and never copy its pending cells into the next cycle.
7. Preserve the terminal checkpoint, per-cell results, meter journal,
   complete request/response transcripts, partial or complete report, and an
   artifact manifest in that run's ignored directory.
8. Record only the execution state—never scores—in tracked STATUS/DECISIONS,
   commit, and push before preparing the next cycle.

The three mandatory run IDs are `j3-live-v2`, `j3-live-v3`, and
`j3-live-v4`. Additional cycles require a remaining minimal repair, a new
versioned configuration and predictions, and unused room under the same $5
cumulative ceiling.

## Diagnostic and safety requirements

The generic live runner must:

- reject `j3-live-v1` and require an explicit run ID;
- pin and verify the bank, prediction, prompt, run configuration, and
  predecessor ledgers;
- use a single series-wide lock;
- inject identical per-purpose model/token/reasoning settings centrally;
- record exact normalized request and response/error bodies locally with
  hashes, full usage details, finish reason, status, request ID, and
  whitelisted rate/retry headers;
- never pass an authorization header or API key to the transcript recorder;
- stop distinctly on empty output, truncation, malformed provider usage,
  transport exhaustion, or spend/call/token ceilings;
- write a terminal report and manifest even when the bank is partial; and
- leave `src/` frozen. These cycles repair the evaluator, not the product.

Hidden chain-of-thought is not returned by the API and cannot be recorded.
Only provider-supplied reasoning-token counts are retained.

# J3 live bake-off preparation

Status: **PREPARED, NOT AUTHORIZED**. This file is a runbook for a future
founder-gated unit. Nothing here is permission to install a dependency, write
a live adapter, set a key, or call a provider.

## Gate

Execution requires an explicit **FOUNDER GO** with a spend cap recorded in
`docs/DECISIONS.md`. Before the first provider call, the draft in
`evals/predictions-bakeoff.md` must be finalized by appending the model,
provider configuration, prompt-config hash, run date, numeric predictions,
and the recorded decision reference. A bad result is graded and kept; it is
never re-rolled.

## Planned live arms

The live bank will compare two memory engines over identical turns, probes,
user scopes, model, and answer prompt:

1. **Palari Brain kernel.** The existing gated SQLite store, with a real LLM
   extractor replacing the scripted dry candidates and the same LLM producing
   probe answers from the kernel briefing.
2. **Mem0 OSS.** The real Node package and its memory/search behavior, with
   the same conversations and probe-answer model. This is the external arm
   required by the J4 decision rule, not the deliberately naive dry contrast
   arm.

The future dependency command is exactly:

```sh
npm install mem0ai
```

**NOT INSTALLED.** The future adapter path is
`evals/arms/mem0-live-arm.mjs`; it is **NOT WRITTEN**. The matching kernel
adapter will live at `evals/arms/kernel-live-arm.mjs`, and the gated runner at
`evals/run-bakeoff-live.mjs`; neither exists yet. The official Mem0 Node
quickstart documents the package and the OSS import surface:
[Mem0 Node SDK Quickstart](https://docs.mem0.ai/open-source/node-quickstart)
(checked 2026-07-23). Provider support and package behavior must be reconfirmed
after installation and before predictions become final.

## Secrets and runtime controls

Keys are process environment variables only—never literals, command-line
arguments, files, `.env` content, logs, or committed artifacts.

- `OPENAI_API_KEY`: supplies the planned shared LLM and the Mem0 OSS OpenAI
  embedder. No value is recorded here.
- `PALARI_CONFIRM_SPEND`: must equal `1` for the future runner to pass its
  founder gate.
- `PALARI_LIVE_SPEND_CAP_USD`: must equal the founder-approved numeric cap;
  the future runner must stop before exceeding it.
- `PALARI_LIVE_MODEL`: must be pinned to the approved snapshot. The current
  estimate uses `gpt-5-nano-2025-08-07`.

The OSS arm does not use a hosted Mem0 account, so no `MEM0_API_KEY` is
planned. If implementation recon shows a different credential or provider is
required, stop, update this estimate and the draft predictions, and obtain a
new founder decision before any call.

## Mechanical run sequence after a future GO

These steps are intentionally not runnable today because the dependency,
adapters, and live runner do not exist.

1. Record the founder's GO, model snapshot, and spend cap in
   `docs/DECISIONS.md`.
2. Recheck the package license and current provider prices; record any changed
   assumption before installing.
3. Run `npm install mem0ai` and review the dependency and lockfile diff.
4. Implement `evals/arms/kernel-live-arm.mjs`,
   `evals/arms/mem0-live-arm.mjs`, and `evals/run-bakeoff-live.mjs` with hard
   call, token, and spend ceilings. Do not weaken the shared bank.
5. Run offline adapter tests only. No connectivity probe is exempt from the
   founder gate.
6. Append the final pre-registration to `evals/predictions-bakeoff.md` before
   the first live call.
7. Export the approved environment variables in the invoking shell and run
   `node evals/run-bakeoff-live.mjs` once.
8. Preserve raw results locally under ignored `evals/results/`; grade every
   prediction, failing categories first. Do not publish without a separate
   founder GO.

## Call and cost estimate

The current 16-journey bank has 21 user turns, 25 authored probes, and two
forget directives. For this estimate, budget one extraction or
memory-processing provider call per user turn per arm and one answer call per
probe per arm: 46 modeled LLM calls per arm, 92 across two arms. The authored
user, assistant, and attached-source turn text is 1,713 characters and the
probe questions are 738 characters, but the estimate deliberately budgets
much more for system prompts, memory briefings, and structured output.

Pricing checked 2026-07-23: OpenAI lists GPT-5 nano at $0.05 per million input
tokens and $0.40 per million output tokens in its
[official model page](https://developers.openai.com/api/docs/models/gpt-5-nano).
The planned Mem0 embedder, `text-embedding-3-small`, is $0.02 per million input
tokens on its
[official model page](https://developers.openai.com/api/docs/models/text-embedding-3-small).
Prices must be rechecked at GO time.

| Work | Bank-derived calls | Conservative tokens per call | Budgeted tokens | Cost |
| --- | ---: | ---: | ---: | ---: |
| Extraction/memory processing, two arms | 21 × 2 = 42 | 2,000 input + 500 output | 84,000 input + 21,000 output | $0.01260 |
| Probe answers, two arms | 25 × 2 = 50 | 3,000 input + 300 output | 150,000 input + 15,000 output | $0.01350 |
| Mem0 embedding envelope | (21 × 4) + 25 + 2 = 111 | 500 input | 55,500 input | $0.00111 |
| **Estimated ceiling before contingency** | **92 modeled LLM + 111 embedding** | — | — | **$0.02721** |

The embedding line allows four embeddings per Mem0 write, one per answer
search, and one per forget directive; the adapter must measure actual use.
Mem0-internal LLM or embedding calls beyond these assumptions consume the
same hard cap. A proposed founder cap of **$0.25** is more than nine times
this estimate and is still a hard maximum, not a target. Retries consume the
same cap, and model or package behavior that makes the cap unenforceable is a
blocker.

## Deployment reality and J4 consequence

At parent-app recon commit `066335b`, palari-v05 runs the workbench Node
backend with one SQLite file per workspace. Its production memory files were
byte-identical to this kernel's extraction baseline: there was zero code drift
in those files.

The J4 option “keep this kernel as the engine” concretely means upgrading
v05's roughly 60-line `buildAssistantMemoryBriefing` seam in
`assistant-brain.mjs` to `createGatedStore` plus `recallAndBrief`, staged
behind v05's existing flag discipline as a **FOUNDER-GATED** follow-on unit in
the parent repository. It is not work authorized here.

A future v05 Postgres cutover would reopen the storage-driver question. That
is a J4 decision input, not something to build during this bake-off.

## Pre-registered J4 rule

The following rule is quoted verbatim and may be changed only by the founder:

> J4 DECISION RULE (pre-registered before any live run). The dry
> report alone can NEVER decide J4: it contains no real external
> framework, so it can only compare our own variants. The
> reuse-vs-keep decision is made on the LIVE bank (J3) with at
> least one real external arm (Mem0 first). An external framework
> is ADOPTED as the engine if it matches or beats the kernel on
> the usefulness, correction, and temporal dimensions and its
> isolation/injection gaps are closable by the thin Palari plane
> (write boundary + briefing + scoping in front of it). The kernel
> stays the engine only by WINNING on the journeys, never by
> default or familiarity. Ties on memory behavior break TOWARD the
> external framework — maintenance we keep is a cost forever,
> code we delete is free — with exactly two founder-weighable
> exceptions, measured as bank dimensions, that may overrule a
> tie: local-file data residency and user inspectability.

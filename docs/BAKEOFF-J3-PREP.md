# J3 live bake-off preparation

Status: **FOUNDER GO RECORDED — NOT YET RUN**. The founder authorized J3 on
2026-07-23 for `gpt-5-nano-2025-08-07` under a hard total cap of **$0.25**.
The publish gate remains closed, and no live score may enter git.

## Gate

The required **FOUNDER GO** and spend cap are recorded in
`docs/DECISIONS.md`. Before the first provider call, the draft in
`evals/predictions-bakeoff.md` must be finalized by appending the model,
provider configuration, prompt-config description, run date, recorded
decision reference, and founder-supplied priors. Existing predicted outcomes
are immutable. A bad result is graded and kept; it is never re-rolled.

## Planned live arms

The authorized live bank will compare two memory engines over identical
turns, probes, user scopes, model, and answer prompt:

1. **Palari Brain kernel.** The existing gated SQLite store, with a real LLM
   extractor replacing the scripted dry candidates and the same LLM producing
   probe answers from the kernel briefing.
2. **Mem0 OSS.** The real Node package and its memory/search behavior, with
   the same conversations and probe-answer model. This is the external arm
   required by the J4 decision rule, not the deliberately naive dry contrast
   arm.

The dependency command is exactly:

```sh
npm install mem0ai
```

License rechecked before installation on 2026-07-23: npm `latest` is
`mem0ai@3.1.1`, whose exact package manifest declares `Apache-2.0` and points
to `mem0ai/mem0`. npm registry `gitHead` and provenance bind that package to
git commit `5e7adc4d1264bb49ab20cf8c70e4807295d77ae2`, whose repository root
contains the Apache License 2.0. This is a permissive OSS license, so the J3
license gate passes. The registry tarball omits a license file and a nested
source-tree OSS README has a stale MIT label, but the formal npm manifest and
repository license agree on Apache-2.0; the packaging caveat is recorded in
`docs/DECISIONS.md`.

Sources: [exact package manifest](https://raw.githubusercontent.com/mem0ai/mem0/5e7adc4d1264bb49ab20cf8c70e4807295d77ae2/mem0-ts/package.json),
[exact repository license](https://raw.githubusercontent.com/mem0ai/mem0/5e7adc4d1264bb49ab20cf8c70e4807295d77ae2/LICENSE), and
[npm provenance](https://registry.npmjs.org/-/npm/v1/attestations/mem0ai@3.1.1).

**INSTALLED, IMPLEMENTED, AND OFFLINE-TESTED; NOT CALLED.** J3 uses `mem0ai`
only from eval code,
and the committed package lists `mem0ai@3.1.1` under `devDependencies`, with
no production `dependencies`. The install resolved the package's optional
`better-sqlite3` peer for its local vector store; no additional direct
dependency was added. The adapter path is
`evals/arms/mem0-live-arm.mjs`; the matching kernel adapter is
`evals/arms/kernel-live-arm.mjs`, and the gated runner is
`evals/run-bakeoff-live.mjs`. Their local meter owns the exact provider
endpoints, key, retries, usage accounting, call/token/spend ceilings, and a
durable no-reroll checkpoint ledger. Offline tests use a localhost fake
provider and exercise the real Mem0 OSS package without an external call.
For fair historical replay, the adapter carries each frozen turn's `eventAt`
through Mem0's ordinary metadata field and uses it as briefing `valid_from`;
Mem0's own `createdAt` remains the observed time. This mirrors the kernel's
event/observation split without changing Mem0's model, extraction prompt,
retrieval, or frozen provider configuration.
The official Mem0 Node
quickstart documents the package and the OSS import surface:
[Mem0 Node SDK Quickstart](https://docs.mem0.ai/open-source/node-quickstart)
(checked 2026-07-23). Provider support and package behavior must be reconfirmed
after installation and before the live run. Any mismatch blocks the run;
FINAL predictions do not change.

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
required, stop and obtain a new founder decision before any call. Do not
change the FINAL predictions file.

## Mechanical run sequence after GO

The GO is recorded. Execute these steps once and in order:

1. Record the founder's GO, model snapshot, and spend cap in
   `docs/DECISIONS.md`, commit, and push.
2. Recheck the package license and current provider prices; record any changed
   assumption, update this estimate, commit, and push before installing.
3. Finalize and commit `evals/predictions-bakeoff.md`; it is immutable after
   that commit. Push it before installing or calling a provider.
4. Verify the existing environment `OPENAI_API_KEY` is non-empty without
   printing it; if absent, stop `BLOCKED-NO-KEY`.
5. Run `npm install mem0ai`, move its committed declaration to
   `devDependencies`, and review the dependency and lockfile diff.
6. Implement `evals/arms/kernel-live-arm.mjs`,
   `evals/arms/mem0-live-arm.mjs`, and `evals/run-bakeoff-live.mjs` with hard
   call, token, and spend ceilings. Do not weaken the shared bank.
7. Run offline adapter tests only. No connectivity probe is exempt from the
   founder gate. Commit and push the reviewed dependency, lockfile, adapters,
   runner, and tests before the live run.
8. Export the approved environment variables in the invoking shell and run
   `node evals/run-bakeoff-live.mjs` once.
9. Preserve raw results locally under ignored `evals/results/`; grade every
   prediction, failing categories first. Do not publish without a separate
   founder GO.

## Call and cost estimate

The current 17-journey bank has 22 user turns, 27 authored probes, and two
forget directives. For this estimate, budget one extraction or
memory-processing provider call per user turn per arm and one answer call per
probe per arm: 49 modeled LLM calls per arm, 98 across two arms. The authored
user, assistant, and attached-source turn text is 1,811 characters and the
probe questions are 834 characters.

Post-install review corrected one pre-install assumption before any provider
call: `mem0ai@3.1.1` carries a 33,655-character native extraction system
prompt, and a trivial synthetic offline request serialized to 35,540 UTF-8
bytes. The former shared 2,000-input-token allowance was therefore not a
conservative Mem0 bound. The revised estimate separates the kernel and Mem0
memory calls and reserves 60,000 input tokens for every Mem0 ingest. That is
deliberately above the installed prompt envelope plus this bank's dynamic
content: no journey has more than two user turns, and each preceding
memory-extraction response is itself capped at 500 completion tokens.

Pricing was rechecked at GO time on 2026-07-23 and is unchanged: OpenAI lists
GPT-5 nano at $0.05 per million input tokens and $0.40 per million output
tokens in its
[official model page](https://developers.openai.com/api/docs/models/gpt-5-nano).
The planned Mem0 embedder, `text-embedding-3-small`, is $0.02 per million input
tokens on its
[official model page](https://developers.openai.com/api/docs/models/text-embedding-3-small).

| Work | Bank-derived calls | Conservative tokens per call | Budgeted tokens | Cost |
| --- | ---: | ---: | ---: | ---: |
| Kernel extraction | 22 | 2,000 input + 500 output | 44,000 input + 11,000 output | $0.00660 |
| Mem0 native memory processing | 22 | 60,000 input + 500 output | 1,320,000 input + 11,000 output | $0.07040 |
| Probe answers, two arms | 27 × 2 = 54 | 3,000 input + 300 output | 162,000 input + 16,200 output | $0.01458 |
| Mem0 embedding envelope | (22 × 4) + 27 + 2 = 117 | 500 input | 58,500 input | $0.00117 |
| **Estimated ceiling before contingency** | **98 modeled LLM + 117 embedding envelopes** | — | — | **$0.09275** |

The embedding line is a conservative token envelope, not a prediction of 117
literal HTTP calls: it allows four 500-token envelopes per Mem0 ingest turn,
one per answer search, and one per forget directive. Mem0 batching, extracted
memory/entity fan-out, delete cleanup, and SDK retries are data-dependent, so
the adapter must intercept and measure every OpenAI transport attempt and
usage record, including Mem0-internal calls. Calls beyond these assumptions
consume the same hard cap. The post-install **$0.09275** ceiling is below the
founder's $0.10 pre-run stop threshold by **$0.00725**. The authorized
**$0.25** cap is about 2.70 times the revised estimate and remains a hard
maximum, not a target. The founder later offered up to $2 if needed; this run
does not need or adopt that larger allowance. Retries consume the $0.25 cap,
and model or package behavior that makes the cap unenforceable is a blocker.

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

# evals/ — measurement, never product

Everything here measures the kernel; nothing here is required to use it.

## Offline answer-interpretation regression

`npm run answer-interpretation-regression` exercises the real
`answerWithRetrieval` boundary with synthetic, provider-free fixtures. It
checks that prior Palari advice keeps its speaker meaning, earlier and later
user-owned appliances arrive with chronology, November-to-February arithmetic
arrives as host-computed three calendar months, and irrelevant/empty controls
remain honest. The deterministic callback inspects structural inputs only; it
does not grade prose. The command writes its `answerQualityGraded: false`,
`providerCalls: 0`, and `networkCalls: 0` report to a private temporary path by
default (use `--report` to choose another local path).

This regression does not predict live benchmark accuracy and cannot change the
sealed terminal result. It carries no private dataset text, credentials,
provider transport, or expected benchmark answer.

## ⚠️ The one rule of this directory

**Do not move, rename, or "clean up" files here.** Sealed live-run
identities pin these paths by SHA-256 (see `live-runs/*.json` and the
terminal-run tests). Moving a file breaks the audit chain of a paid,
unrepeatable run. Historical runners that look redundant are load-bearing
evidence. Add new files; never relocate old ones.

## Map

| Zone | What it is |
| --- | --- |
| `trust-benchmark.mjs`, `run-trust-benchmark.mjs`, `arms/palari-trust-adapter.mjs` | The five-case trust benchmark (`npm run trust-bench`). Framework-neutral scripts; predictions pre-registered in `predictions.md` P-set 5. |
| `run-scale-probe.mjs` | 5,000-message offline scale measurement (`npm run scale-probe`). Optional `-- --embedder <module>` re-measures both paraphrase columns through the semantic surface (the module wires `createGeminiEmbedder` to a metered transport; spends, so founder-gated like every live dispatch). |
| `offline-memory-bench.mjs`, `run-offline-memory-bench.mjs` | Structural digest bench (`npm run memory-bench`). |
| `dev-provider-probe.mjs`, `run-dev-provider-probe.mjs` | The ONLY spend-capable tool (`npm run probe`); founder-gated, no run identity, no score. |
| `provider-deviation-corpus.mjs` | Every observed live model deviation, replayed offline forever. |
| `arms/lean-memory-reducer-*.mjs` | The live reducer wire contract: grammar, clarified instructions, repair turn, mechanical targets. |
| `arms/graph-extractor-gemini.mjs`, `arms/embedder-gemini.mjs` | Offline-tested Gemini adapters for the pluggable `graphExtractor` and `embedder` brain options; dispatch-ready, founder-gated live. |
| `run-*-live.mjs`, `live-runs/`, `predictions/` | Sealed and prepared live identities. Terminal ones refuse execution by design. |
| `predictions.md`, `predictions-bakeoff.md` | Pre-registered predictions (append-only, by charter law). |
| `journeys.json`, `run-bakeoff.mjs`, `arms/*arm*.mjs` | The 17-journey offline bake-off across memory arms. |
| `results/` (gitignored) | Private run evidence. Never committed, never published without founder GO. |

## Which command answers which question

- "Can the memory be trusted?" → `npm run trust-bench`
- "How does it behave at 5,000 messages?" → `npm run scale-probe`
- "Does the digest machinery stall or overflow?" → `npm run memory-bench`
- "Will the live provider accept our wire format?" → `npm run probe` (spends; gated)
- "Is the product journey intact?" → `npm run quickstart`

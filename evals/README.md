# evals/ — measurement, never product

Everything here measures the kernel; nothing here is required to use it.

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
| `run-scale-probe.mjs` | 5,000-message offline scale measurement (`npm run scale-probe`). |
| `offline-memory-bench.mjs`, `run-offline-memory-bench.mjs` | Structural digest bench (`npm run memory-bench`). |
| `dev-provider-probe.mjs`, `run-dev-provider-probe.mjs` | The ONLY spend-capable tool (`npm run probe`); founder-gated, no run identity, no score. |
| `provider-deviation-corpus.mjs` | Every observed live model deviation, replayed offline forever. |
| `arms/lean-memory-reducer-*.mjs` | The live reducer wire contract: grammar, clarified instructions, repair turn, mechanical targets. |
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

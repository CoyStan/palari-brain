# evals/ — measurement, never product

Everything here measures the memory system — today mostly the active
brain, plus the preserved v0.5 kernel arms it is compared against; nothing
here is required to use the package.

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

## Latest-design reached-prefix replay

`npm run reached-prefix-regression` replays the five terminal v6 misses, the
one reached v6 success, and the next truncated-answer control into fresh
temporary canonical-first journals. Version 2 independently counts the
dataset's exact `has_answer` spans at canonical storage and at returned
retrieval, rather than treating any row from an answer-bearing session as a
hit. Its gitignored report contains IDs, counts, the dataset SHA-256, and stage
outcomes but no dataset text.

The replay uses a deterministic local concept embedder and a generous bounded
retrieval window to test structural storage/retrieval plumbing. It makes zero
provider or network calls and does not grade final answers, production
embedding quality, live reranking quality, latency, or cost.

## Provider-free memory-stage audit

`npm run memory-stage-audit -- --input <local.json> [--report <local.json>]`
classifies the earliest observed failure for explicitly labelled cases as
`write`, `retrieval`, `composition`, `utilization`, `ambiguity`, `success`, or
`ungraded`. It combines canonical-presence IDs with the existing exact-span,
selection, and judged-material-use telemetry. Answer correctness and ambiguity
must be supplied as explicit labelled judgments; missing labels remain
`ungraded`. Session-level diagnostics may additionally provide
`expectedSessionIds` and `canonicalSessionIds`; omitting canonical-session
presence keeps that part of the audit ungraded rather than treating absence as
a failed write.

The command only reads local JSON, performs no provider or network call, and
refuses to run without an explicit input. A case has this shape:

```json
{
  "id": "local-case-id",
  "requiredEvidenceIds": ["evidence-1"],
  "canonicalEvidenceIds": ["evidence-1"],
  "trace": {
    "answerCommitted": true,
    "retrievalTranscript": [{
      "tool": "memory_read",
      "result": { "messages": [{ "evidenceId": "evidence-1" }] }
    }],
    "selectedEvidenceIds": ["evidence-1"]
  },
  "materialUseJudgments": [{
    "evidenceId": "evidence-1",
    "materiallyUsed": true,
    "rationale": "The answer depends on this evidence."
  }],
  "answerJudgment": {
    "correct": true,
    "labelAuthority": "human-review",
    "rationale": "The answer matches the observed outcome."
  },
  "ambiguityJudgment": {
    "ambiguous": false,
    "labelAuthority": "human-review",
    "rationale": "The evidence has one supported interpretation."
  }
}
```

This is a diagnostic classification, not a benchmark grade. Keep private
traces and reports in `.palari-alpha/` or another gitignored local path.

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
| `run-scale-probe.mjs` | 5,000-message offline scale measurement (`npm run scale-probe`). Optional `-- --embedder <module>` re-measures both paraphrase columns through the semantic surface; the module must export `createEmbedder()` (write a thin wrapper that wires `arms/embedder-gemini.mjs`'s `createGeminiEmbedder` to a metered transport — see the runner header; spends, so founder-gated like every live dispatch). |
| `offline-memory-bench.mjs`, `run-offline-memory-bench.mjs` | Structural digest bench (`npm run memory-bench`). |
| `run-answer-interpretation-regression.mjs` | Offline answer-boundary regression (`npm run answer-interpretation-regression`); see the section above. |
| `memory-stage-audit.mjs`, `run-memory-stage-audit.mjs` | Provider-free stage classifier (`npm run memory-stage-audit -- --input <local.json>`); see the section above. |
| `run-reached-prefix-retrieval-regression.mjs` | Private-data diagnostic (`npm run reached-prefix-regression`): checks exact dataset-marked answer spans independently at canonical storage and retrieval for the reached S-60 v6 cases; deterministic stand-in, zero provider calls. |
| `dev-provider-probe.mjs`, `run-dev-provider-probe.mjs` | The ONLY spend-capable tool (`npm run probe`); founder-gated, no run identity, no score. |
| `provider-deviation-corpus.mjs` | Every observed live model deviation, replayed offline forever. |
| `arms/lean-memory-reducer-*.mjs` | The live reducer wire contract: grammar, clarified instructions, repair turn, mechanical targets. |
| `arms/graph-extractor-gemini.mjs`, `arms/embedder-gemini.mjs` | Offline-tested Gemini adapters for the pluggable `graphExtractor` and `embedder` brain options; dispatch-ready, founder-gated live. |
| `run-*-live.mjs`, `live-runs/`, `predictions/` | Sealed and prepared live identities. Terminal ones refuse execution by design. |
| `*-live-config.mjs`, `*-prediction-oracle.mjs`, `*-live-meter.mjs`, `live-runtime.mjs`, `longmemeval-*.mjs`, `incremental-longmemeval-runtime.mjs` | The frozen wiring behind those identities: hash-pinned contracts, pre-registered prediction grading, spend meters, transports. |
| `harness.mjs`, `journey-bank.mjs`, `report-markdown.mjs` | Bake-off plumbing: journey schema/validation, arm runner, report renderer. |
| `adapters/jcode-bridge/`, `arms/jcode-trust-adapter.mjs` | Rust bridge + arm for running the trust benchmark against an external assistant. |
| `predictions.md`, `predictions-bakeoff.md` | Pre-registered predictions (append-only, by charter law). |
| `journeys.json`, `run-bakeoff.mjs`, `arms/*arm*.mjs` | The 17-journey offline bake-off across memory arms. |
| `results/` (gitignored) | Private run evidence. Never committed, never published without founder GO. |

## Which command answers which question

- "Can the memory be trusted?" → `npm run trust-bench`
- "How does it behave at 5,000 messages?" → `npm run scale-probe`
- "Does the digest machinery stall or overflow?" → `npm run memory-bench`
- "Does the answer boundary keep speaker/chronology/time semantics?" →
  `npm run answer-interpretation-regression`
- "Which observed memory stage failed?" →
  `npm run memory-stage-audit -- --input <local.json>`
- "Do the reached v6 cases still retrieve their evidence?" →
  `npm run reached-prefix-regression` (needs the gitignored dataset)
- "How did the historical v0.5 arms compare, offline?" → `npm run bakeoff`
- "Will the live provider accept our wire format?" → `npm run probe` (spends; gated)
- "Is the product journey intact?" → `npm run quickstart`

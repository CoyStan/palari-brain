# Palari Brain

Palari is an alpha memory kernel for a chat assistant. Its target journey is
simple: store something worth remembering, recall it later, accept a
correction or deletion, and behave correctly afterward.

The trusted host stores complete visible messages in a canonical journal. A
bounded reducer maintains compact working memory. Retrieval can locate exact,
ranked, semantic, or temporal-graph candidates, but every answerable item is
read back from canonical evidence with host-recorded speaker and time.

One product law remains non-negotiable: **an index may locate evidence; it may
never be evidence.** Durable writes still pass through the admission gate;
retrieval and inferred relationships do not become canonical user facts.

## Start here

```bash
npm install
npm test
npm run quickstart
```

`npm test` is now the small provider-free alpha gate. `npm run quickstart`
exercises the six-step storage, recall, correction, and deletion journey. The
complete historical suite remains available as `npm run test:legacy`; it is
not required after every small prototype edit.

## Debug the real loop

Use the single reusable runner instead of creating another frozen launcher:

```bash
npm run alpha:debug -- \
  --adapter .palari-alpha/my-adapter.mjs \
  --questions 11-20 \
  --retries 2 \
  --max-dollar 0.50
```

The adapter exports `createAlphaRun()` and injects questions plus writer,
answer, and optional embedder/reranker components. `.palari-alpha/` is
gitignored. Its JSONL files are mutable diagnostic logs and never update a
historical benchmark grade. File-backed logs cannot escape that namespace.
The runner continues after a broken row by default and bounds retries to
three. CLI runs persist each component's conservative reservation to
`.palari-alpha/budget.json` before calling it, so reruns share one aggregate
cap. Run only one alpha CLI process at a time.

See [the alpha architecture](docs/ALPHA-ARCHITECTURE.md) for the component
contract and [the 20-repository survey](docs/ALPHA-FRAMEWORK-RESEARCH.md) for
why Palari adopts a few small patterns without installing a framework.

## Product API

```js
import {
  createPalariBrain,
  ingestChatTurn,
  answerQuestion,
} from 'palari-brain'

const brain = await createPalariBrain({
  memoryEnabled: true,
  statePath: '/path/to/state.json',
  workspaceId: 'workspace',
})

await ingestChatTurn(brain, {
  userMessage,
  assistantMessage,
  eventAt,
  palariId,
  retention: 'durable',
  userId,
  sourceMessageId,
}, {
  reducer: async ({ request }) => callMemoryReducerModel(request),
  reducerId: 'my-reducer/v1',
})

const result = await answerQuestion(brain, {
  provider: async ({ memoryText, questionText, systemInstruction }) =>
    callAnswerModel({ memoryText, questionText, systemInstruction }),
  question,
  questionDate,
  palariId,
  userId,
})
```

Provider adapters are injected. The core does not dial out by itself.

## Important modules

| Area | Location |
|---|---|
| Brain orchestration | `src/brain.mjs`, `src/index.mjs` |
| Canonical dialogue and admission | `src/dialogue-evidence.mjs`, `src/memory-store.mjs` |
| Working memory and reducer | `src/memory-digest-store.mjs`, `src/memory-reducer.mjs` |
| Retrieval and answers | `src/memory-exploration.mjs`, `src/memory-search.mjs`, `src/memory-semantic.mjs`, `src/memory-graph.mjs`, `src/retrieval-answer.mjs` |
| Provider seams | `src/gemini.mjs`, `src/openai.mjs`, `src/reranker-ettin.mjs` |
| Alpha diagnostics | `evals/run-alpha-memory-debug.mjs` |
| Historical evaluation | `evals/` plus `npm run test:legacy` |

## Alpha policy

Ordinary debugging may be repeated and repaired within an approved aggregate
dollar cap. Tickets, immutable evidence, preregistration, exact accounting,
and one-shot identities are reserved for genuinely risky work or an explicitly
declared release benchmark. Secrets, user isolation, destructive writes, and
paid-provider caps remain hard boundaries.

The repository immediately before this policy reset is recoverable at
annotated Git tag `pre-alpha-governance-reset-2026-08-07`. No legacy code or
historical result was deleted by the reset.

## Licence

MIT

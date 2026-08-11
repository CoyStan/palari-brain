<p align="center">
  <img src="assets/brand/palari-mark-512.png" width="112" alt="Palari Brain mark">
</p>

<h1 align="center">Palari Brain</h1>

<p align="center"><strong>Memory that can show its work.</strong></p>

<p align="center">
  An evidence-first memory kernel for chat assistants: exact dialogue,
  bounded recall, source-backed answers, and scoped forgetting.
</p>

<p align="center">
  <img alt="Status: alpha" src="https://img.shields.io/badge/status-alpha-ff6b5e?style=flat-square">
  <img alt="Node.js 22.5 or newer" src="https://img.shields.io/badge/Node.js-%E2%89%A522.5-66e3c4?style=flat-square&logo=nodedotjs&logoColor=101528">
  <img alt="Provider-neutral core" src="https://img.shields.io/badge/core-provider--neutral-f4efe5?style=flat-square">
  <a href="LICENSE"><img alt="MIT licence" src="https://img.shields.io/badge/licence-MIT-101528?style=flat-square"></a>
</p>

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="docs/BRAIN-API.md">Active contract</a> ·
  <a href="docs/README.md">Docs</a> ·
  <a href="STATUS.md">Status</a>
</p>

<p align="center">
  <img src="assets/brand/palari-header.png" width="100%" alt="A canonical evidence line with recall paths that return to their source">
</p>

Palari gives a long-lived assistant useful memory without turning a model-made
summary into truth. The trusted host keeps complete visible dialogue in a
canonical journal. A bounded digest makes recall fast. Every answerable memory
is read back from exact, role-labelled, time-labelled source evidence.

> **An index may locate evidence. It may never become evidence.**

Palari is an alpha library, not a hosted service. Its provider adapters are
injected, and the core does not dial out by itself.

## Why Palari

| Exact by default | Bounded by design | Honest by construction |
|---|---|---|
| Visible dialogue is the source of truth, with speaker, time, scope, and stable identity. | Working memory, retrieval, reranking, confirmation, and provider use all have explicit ceilings. | Answers bind claims to canonical evidence. Uncertain information can stay uncertain. |
| Corrections and deletions act on canonical records. | Long chats do not require an unbounded prompt. | User and workspace isolation stay at the host boundary. |

## The memory path

```text
say something worth remembering
              │
              ▼
       admission gate
              │
              ▼
   canonical dialogue journal ◀──── correct / delete
              │
              ▼
      bounded active digest
              │
              ▼
 exact + semantic + temporal recall
              │
              ▼
   canonical evidence read-back
              │
              ▼
    host-verified answer commitment
```

The digest and retrieval indexes are working views. They help find information;
they do not replace the journal that proves it.

## Quick start

Requires Node.js 22.5 or newer.

```bash
git clone https://github.com/CoyStan/palari-brain.git
cd palari-brain
npm install
npm test
npm run quickstart
```

`npm test` runs the small provider-free alpha gate. `npm run quickstart`
exercises the full product journey: store, recall, correct, delete, and verify
the behavior afterward. The broader product compatibility suite is available
through `npm run test:legacy`. Before publishing or changing package layout,
`npm run package:check` packs and installs a clean offline consumer and verifies
all six public entry points against the reviewed export-name hashes.

## Alpha release

The current public developer preview is `v0.1.0-alpha.1`. Install the exact
GitHub release with:

```bash
npm install github:CoyStan/palari-brain#v0.1.0-alpha.1
```

The package is not published to the npm registry yet. See the
[release notes](CHANGELOG.md) for validation evidence and known limitations.

## Use the library

```js
import {
  answerQuestion,
  createPalariBrain,
  ingestChatTurn,
} from 'palari-brain'

const brain = await createPalariBrain({
  memoryEnabled: true,
  statePath: '/path/to/state.sqlite',
  workspaceId: 'workspace',
})

await ingestChatTurn(brain, {
  assistantMessage,
  eventAt,
  palariId,
  retention: 'durable',
  sourceMessageId,
  userId,
  userMessage,
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

The application owns the provider calls. Palari owns the memory boundaries,
evidence checks, scope rules, and local state transitions.

## What is inside

- **Canonical journal** — exact visible user and assistant messages with
  provenance, chronology, and private scope.
- **Bounded digest** — compact active memory that can be corrected without
  replacing the source record.
- **Evidence-first retrieval** — exact, ranked, semantic, and temporal-graph
  paths that resolve back to canonical dialogue.
- **Careful answers** — structured evidence commitments, bounded confirmation,
  and explicit uncertainty.
- **Scoped forgetting** — deletion by exact identity without weakening
  user/workspace isolation.
- **Provider seams** — OpenAI, Gemini, embedding, and reranker adapters remain
  replaceable components around a provider-neutral core.

## Debug the real loop

Use the reusable alpha runner for reversible diagnostics:

```bash
npm run alpha:debug -- \
  --adapter .palari-alpha/my-adapter.mjs \
  --questions 11-20 \
  --retries 2 \
  --max-dollar 0.50
```

`.palari-alpha/` is gitignored. Its JSONL logs are mutable diagnostics, not
benchmark grades. The runner shares one conservative spend ledger, limits
retries to three, and keeps artifacts inside that private namespace. Run only
one alpha process at a time.

## Project map

| Area | Location |
|---|---|
| Active API and orchestration | `src/index.mjs`, `src/brain.mjs` |
| Canonical dialogue and admission | `src/dialogue-evidence.mjs`, `src/memory-store.mjs` |
| Working memory and reduction | `src/memory-digest-store.mjs`, `src/memory-reducer.mjs` |
| Retrieval and answers | `src/memory-exploration.mjs`, `src/retrieval-plan.mjs`, `src/retrieval-frontier.mjs`, `src/retrieval-answer.mjs` |
| Retrieval indexes | `src/memory-search.mjs`, `src/memory-semantic.mjs`, `src/semantic-hnsw.mjs`, `src/memory-graph.mjs` |
| Provider seams | `src/gemini.mjs`, `src/openai.mjs`, `src/reranker-ettin.mjs` |
| Local diagnostics | `evals/`, with its map in `evals/README.md` |

Start with the [active Brain API contract](docs/BRAIN-API.md). The
[documentation map](docs/README.md) covers the active checkout and its archive
tags. The [repository survey](docs/ALPHA-FRAMEWORK-RESEARCH.md) explains why
Palari borrows small patterns from larger frameworks without installing their
authority models.

## Alpha policy

Ordinary debugging can be repeated and repaired inside an approved aggregate
cost cap. Risky work gets an explicit scope and review plan; immutable run
machinery is reserved for an explicitly declared release benchmark.
Credentials, private scope, destructive operations, durable-write admission,
and provider spend limits remain hard boundaries.

The repository immediately before the alpha policy reset is available at the
annotated tag `pre-alpha-governance-reset-2026-08-07`.

## Licence

[MIT](LICENSE)

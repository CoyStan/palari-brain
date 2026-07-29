# Palari Brain

Memory for a chat assistant, reduced to the part that matters:

1. the trusted host stores each complete visible user/Palari message and
   records who actually said it;
2. one bounded reducer updates a compact active memory from the previous
   digest plus new interactions, on a cadence you choose;
3. the host verifies every reducer claim against exact canonical quotes and
   derives speaker, time, scope, and identity itself;
4. a later answer receives the complete bounded digest and can search and
   read the journal itself when that is not enough, while forgetting still
   deletes exact canonical evidence IDs.

One law governs every part of the system: **an index may locate evidence; it
may never be evidence.** Retrieval has four surfaces — exact substring
matching, stemmed BM25 ranking, optional semantic search (pluggable
embedder; nothing dials out without one), and an optional derived temporal
graph for multi-hop questions (pluggable extractor) — and whatever any of
them surfaces, the thing returned is a canonical journal row with
host-recorded speaker and time. Ranking may be fuzzy; evidence never is.
Canonical dialogue is the lossless, deletable journal; the recurrent digest
is the small working memory. An `asserted` memory additionally may not rest
on a quote in negated, conditional, quoted-speech, or pasted third-party
context (`src/quote-context.mjs`). The
reducer cannot erase prior items by omission: it must explicitly add or
replace memory, and a replacement is accepted only when its provenance,
speaker, chronology, revision, and size all validate.

If a reducer call fails, canonical dialogue still survives and the ordered
reduction remains pending. Answering may temporarily use the complete
canonical journal while it fits. If that journal is too large, Palari Brain
returns `digest_incomplete` and does not call the answer model with stale or
partial memory. Provider adapters mark terminal auth, schema, configuration,
and transport failures with `markReducerFailureTerminal`; that stops a batch
immediately instead of mislabelling every queued interaction as bad memory.
Semantically invalid model proposals still use interaction-level isolation
and quarantine.

## Quickstart

```bash
npm install          # required: the comparison arm has a devDependency
npm test
npm run quickstart
```

All three are offline and spend-free. Tests that need the gitignored
LongMemEval dataset skip themselves when it is absent, so a fresh clone is
green without it.

The quickstart demonstrates:

- complete user and Palari messages stored with `user_message` and
  `assistant_message` provenance;
- one compact reduction after each interaction;
- a paraphrased later question answered from the bounded active digest;
- a newer same-speaker correction replacing the working item while exact
  old and new support survives in canonical provenance;
- exact-ID deletion followed by honest absence;
- source-document text excluded from canonical and reducer evidence.

## When memory is not enough, look

The digest is bounded working memory. The canonical journal holds everything
that was actually said. `answerWithExploration` lets the answer model search
and read that journal when the digest comes up short, using three primitives
behind the same gate: `memory_timeline` (`ls`), `memory_read` (`cat`), and
`memory_find` (`grep`: exact substring by default; `ranked: true` for
stemmed BM25 word matching; `after`/`before` ISO bounds filter on host
chronology). Beyond the tool loop, the brain also exposes
`exploreSemantic` (embedding search, only when created with an `embedder`)
and `indexGraph`/`exploreGraph` (a derived temporal graph with verified
quotes on every edge, computed validity, and per-fact-group trends, only
when created with a `graphExtractor`).

Every consultation is deterministic and recorded, so an explored answer
carries a replayable list of exactly which stored messages informed it.

## Measure it, don't trust it

Every guarantee above is one command, offline, deterministic, spend-free:

```bash
npm run trust-bench    # 5 cases: paraphrase, correction chronology,
                       # verified deletion on every surface, source
                       # boundary, cross-user isolation. CI-pinned 5/5.
npm run scale-probe    # 5,000-message conversation: ingest ms/turn,
                       # find latency, planted-fact recall rates.
npm run memory-bench   # structural digest behavior over a long replay.
```

`npm run probe` additionally exists for live provider wire-format checks;
it is the only command here that can spend money and it refuses without an
explicit `PALARI_PROBE_CONFIRM_SPEND=1`.

## Module map

| Area | Files |
| --- | --- |
| Entry point | `src/index.mjs` (public API), `src/brain.mjs` (orchestration) |
| Canonical journal + gate | `src/dialogue-evidence.mjs`, `src/gate.mjs`, `src/store.mjs` |
| Digest (verified working memory) | `src/memory-digest-store.mjs`, `src/memory-reducer.mjs`, `src/memory-briefing.mjs` |
| Admission guards | `src/quote-context.mjs` (negation/conditional/quoted-speech/pasted-text) |
| Retrieval surfaces | `src/memory-exploration.mjs` (exact + ranked tools), `src/memory-search.mjs` (FTS5), `src/memory-semantic.mjs` (pluggable embeddings), `src/memory-graph.mjs` (derived temporal graph), `src/memory-trend.mjs` (computed trends) |
| Historical comparator | `src/memory-store.mjs`, `src/v05-memory-extraction.mjs`, `src/recall.mjs` |
| Measurement | `evals/` (see `evals/README.md` — paths in there are hash-pinned by sealed run identities; never move files) |
| Governance | `AGENTS.md` (charter), `STATUS.md` (ledger), `docs/DECISIONS.md` (log), `docs/BRAIN-API.md` (API reference) |

## Running the memory bench

```bash
npm run memory-bench                       # synthetic population, always runs
npm run memory-bench -- --limit 50         # shorter run
npm run memory-bench -- --dataset          # real LongMemEval-S ordinal 1
npm run memory-bench -- --question 08e075c7
npm run memory-bench -- --reduce-every 20   # batch reduction
```

This replays a long conversation through the real write path with a
deterministic, provider-free reducer. No credential is read, no provider is
called, no live identity or score is created, and it costs nothing.

It answers the structural questions that a paid benchmark run cannot afford
to discover: does the reduction queue stall, does the digest hit its item or
character cap, does compaction stay inside the lineage limit, and — on the
real dataset — is evidence from the answer-bearing turns still in the digest
at the end. It exits non-zero if the queue stalls.

It does **not** measure answer quality. There is no model in the loop. Treat
its retention number as a structural floor, never as a benchmark score.

The `--dataset` modes need `data/longmemeval_s_cleaned.json`, which is
gitignored and not distributed here. Obtain LongMemEval-S from the upstream
project (<https://github.com/xiaowu0162/LongMemEval>, MIT; licence verdict
recorded in `docs/DECISIONS.md`) and place the cleaned S split at that path.
Without it, those modes fail with a message pointing here, and the synthetic
population runs instead.

## Use it in a chatbot

```js
import {
  ACTIVE_MEMORY_SYSTEM_INSTRUCTIONS,
  answerQuestion,
  createPalariBrain,
  ingestChatTurn,
  markReducerFailureTerminal,
} from 'palari-brain'

const brain = await createPalariBrain({
  memoryEnabled: true,
  statePath: '/path/to/workspace-state.json',
  workspaceId: 'my-workspace',
})

await ingestChatTurn(brain, {
  userMessage,
  assistantMessage,
  eventAt,
  palariId,
  retention: 'durable',
  userId,
  sourceMessageId,
  sourceTexts,
}, {
  // Map this provider-neutral structured request to your model provider.
  // The response must follow ACTIVE_MEMORY_SYSTEM_INSTRUCTIONS.
  reducer: async ({ request }) => {
    try {
      return await callMemoryReducerModel(request)
    } catch (error) {
      // Provider-wide failures are not evidence-specific.
      throw markReducerFailureTerminal(error)
    }
  },
  // Change this only through an explicit rebuild/migration.
  reducerId: 'my-memory-reducer/v1',
})

const result = await answerQuestion(brain, {
  provider: async ({
    memoryText,
    questionText,
    systemInstruction,
  }) => {
    // Keep trusted rules in the provider's system/developer role.
    // Send memory as untrusted data and the current question last.
    const response = await callAnswerModel({
      memoryText,
      questionText,
      systemInstruction,
    })
    return {
      text: response.text,
      // Optional but recommended. Without it, result.abstained is null.
      abstained: response.abstained,
    }
  },
  question,
  questionDate,
  palariId,
  userId,
})
```

Calling `ingestChatTurn` is the trusted host's decision that the visible
exchange is eligible for durable local memory. Use `retention: 'ephemeral'`
to skip both storage and reduction. Omitted retention fails closed before
either storage or a reducer call.

This is intentionally honest about sensitive text: canonical durable dialogue
is stored byte-for-byte in local plaintext SQLite. A reducer instruction
cannot protect the canonical copy. A chatbot must mark
password entry, private forms, or other non-retained surfaces `ephemeral`,
protect filesystem access, and obtain any consent required before sending
stored dialogue to an answer provider.

Palari Brain enforces mode `0600` on its configured SQLite database whenever
it opens it, including upgrades. It does not change a caller-owned existing
directory, and filesystem permissions are not encryption at rest.

The reducer receives no current question and no tool, web, source-document,
scope, or credential fields. It receives at most 64 prior active items plus
one current interaction, under a 40,000-character request limit. It can
propose at most eight `add` or `replace` actions. Each action must cite an
exact quote from current canonical evidence; replacements also cite the
specific prior item. The host assigns IDs and validates every reference.
`reducerId` is required whenever pending work is reduced, and both that ID
and the reducer-contract version are pinned to the scope so incompatible
digest generations cannot be mixed silently.

A single interaction can itself exceed the 40,000-character reducer
envelope. Retrying cannot change that, so Palari records
`REDUCER_INPUT_CAPACITY` and quarantines that interaction: it stays canonical
and unreduced, later interactions are not stuck behind it, and the gap is
reported as `blocked` rather than hidden. The exact dialogue still exists in
the canonical journal and remains searchable through exploration.
Integrations should bound durable interaction size before ingest. Palari does
not silently truncate or summarize an oversized message outside the reducer
contract.

The resulting active state is capped at 64 items and 24,000 rendered
characters. Unmentioned prior items remain. A valid `no_memory` disposition
advances the journal without creating filler. Model-authored deletion,
speaker, source kind, timestamp, scope, confidence, sharing, and keywords are
not accepted.

The old optional exact-quote `{ extractor, extractorId }` hook remains only
for backward-compatible diagnostics and sealed evaluator code. Active answer
recall does not consume that index. Do not run both provider hooks in a new
integration.

See [docs/BRAIN-API.md](docs/BRAIN-API.md) for the complete active contract.

## Correction and forgetting

Palari Brain does not guess contradictions with text rules. The reducer may
propose `supersedes`, but the host accepts it only for one active item with
the same topic and speaker, backed by later evidence. A correction replaces
the compact working item and carries the old and new exact quote lineage.
Canonical history is unchanged. User and Palari authority never collapse,
even if their words are identical.

Deletion is intentionally exact:

```js
import { forgetMemories } from 'palari-brain'

forgetMemories(brain, selectedEvidenceIds, { palariId, userId })
```

There is no `topicForget("espresso")`. A chatbot can show or select the
relevant IDs from `brain.listStatements(...)`, get user confirmation, and
then delete those IDs. Digest IDs are never destructive selectors. Deleting
canonical evidence clears generated digest prose in the same transaction,
increments the scope revision, and queues surviving canonical interactions
for ordered rebuild. Until that rebuild completes, answer recall uses the
complete surviving journal or refuses if it cannot fit. Similarity is not
allowed to make a destructive decision.

The store keeps a content-free source-identity tombstone (and the canonical
turn manifest hashes) so transport replay cannot restore deleted evidence.
Deletion removes message content, not every item of metadata.

## Historical evaluator

The repository still contains the extracted palari-v05 lexical kernel and
its frozen J3/J4 evaluation machinery. They are retained as historical
comparators and provenance for already completed runs; they are not exported
from the package entry point and are not used by the active product API.

`npm run bakeoff` continues to reproduce that historical offline comparison.
It is not a score for the active incremental-digest path. No new live provider
run was performed for this change, and no sealed J4 result was altered.

The candid history is in [WE-MESSED-UP.md](WE-MESSED-UP.md), the current
state and gates are in [STATUS.md](STATUS.md), and append-only decisions are
in [docs/DECISIONS.md](docs/DECISIONS.md).

License: MIT.

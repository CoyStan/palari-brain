# Palari Brain

Memory for a chat assistant, reduced to the part that matters:

1. the trusted host stores each complete visible user/Palari message and
   records who actually said it;
2. after each durable interaction, one bounded reducer updates a compact
   active memory using only the previous digest and that interaction;
3. the host verifies every reducer claim against exact canonical quotes and
   derives speaker, time, scope, and identity itself;
4. a later answer receives the complete bounded digest, while forgetting
   still deletes exact canonical evidence IDs.

The active package does not parse English with regular expressions and does
not retrieve with keywords, FTS, BM25, or fuzzy text matching. It also does
not require an embedding service. Canonical dialogue is the lossless,
deletable journal; the recurrent digest is the small working memory. The
reducer cannot erase prior items by omission: it must explicitly add or
replace memory, and a replacement is accepted only when its provenance,
speaker, chronology, revision, and size all validate.

If a reducer call fails, canonical dialogue still survives and the ordered
reduction remains pending. Answering may temporarily use the complete
canonical journal while it fits. If that journal is too large, Palari Brain
returns `digest_incomplete` and does not call the answer model with stale or
partial memory.

## Quickstart

```bash
npm test
npm run quickstart
```

Both commands are offline. The quickstart demonstrates:

- complete user and Palari messages stored with `user_message` and
  `assistant_message` provenance;
- one compact reduction after each interaction;
- a paraphrased later question answered from the bounded active digest;
- a newer same-speaker correction replacing the working item while exact
  old and new support survives in canonical provenance;
- exact-ID deletion followed by honest absence;
- source-document text excluded from canonical and reducer evidence.

## Use it in a chatbot

```js
import {
  ACTIVE_MEMORY_SYSTEM_INSTRUCTIONS,
  answerQuestion,
  createPalariBrain,
  ingestChatTurn,
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
  reducer: async ({ request }) => callMemoryReducerModel(request),
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
envelope. In that case Palari records `REDUCER_INPUT_CAPACITY`, keeps that
interaction at the queue head, and does not skip forward. The exact dialogue
still exists in the canonical journal, so answer recall may use the complete
journal while it fits and otherwise refuses with `digest_incomplete`.
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

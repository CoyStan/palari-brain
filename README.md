# Palari Brain

Memory for a chat assistant, reduced to the part that matters:

1. the trusted host stores each complete visible user/Palari message and
   records who actually said it;
2. an optional writer may select exact quotes as a derived index, but cannot
   decide what survives;
3. a later answer receives the complete current memory for that user and
   Palari;
4. corrections remain in chronological order, and forgetting deletes exact
   message-evidence IDs.

The active package does not parse English with regular expressions and does
not retrieve with keywords, FTS, BM25, or fuzzy text matching. It also does
not require an embedding service. The optional quote writer is never on the
critical persistence path. The existing answer model decides which records
are semantically relevant from the complete scoped set.

If that complete set exceeds the configured memory context, Palari Brain
returns `capacity_exceeded` and does not call the answer model with a partial
set. That is an explicit limit, not a hidden retrieval failure.

## Quickstart

```bash
npm test
npm run quickstart
```

Both commands are offline. The quickstart demonstrates:

- complete user and Palari messages stored with `user_message` and
  `assistant_message` provenance;
- a writer omitting Palari's statement without losing that statement;
- a paraphrased later question answered from the complete memory set;
- a newer user correction presented after the old statement so the answer
  model can apply it while history remains visible;
- exact-ID deletion followed by honest absence;
- source-document text excluded from canonical and writer evidence.

## Use it in a chatbot

```js
import {
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
to skip both storage and the writer. Omitted retention fails closed before
either storage or a writer call.

This is intentionally honest about sensitive text: canonical durable dialogue
is stored byte-for-byte in local plaintext SQLite. The writer's instruction
to avoid passwords cannot protect the canonical copy. A chatbot must mark
password entry, private forms, or other non-retained surfaces `ephemeral`,
protect filesystem access, and obtain any consent required before sending
stored dialogue to an answer provider.

Palari Brain enforces mode `0600` on its configured SQLite database whenever
it opens it, including upgrades. It does not change a caller-owned existing
directory, and filesystem permissions are not encryption at rest.

No writer call is required for this loop. If later measurements justify a
derived index, pass `{ extractor, extractorId }` as the third argument.
Canonical dialogue is committed before that optional extractor runs.

The optional writer schema contains only:

```json
{
  "memories": [{
    "quote": "an exact substring of the visible dialogue",
    "type": "preference",
    "importance": 0.8,
    "confidence": 0.9,
    "fictional": false
  }]
}
```

The model cannot provide `content`, `keywords`, `speaker`, `sourceKind`, or
`shared`. The host checks whether each quote occurs in the user message, the
Palari reply, or both, then links the derived row to canonical evidence. A
Palari record means “Palari said this”; it is never rewritten as a user fact.
Tool, web, and source-document text is not included in either persistence
path.

See [docs/BRAIN-API.md](docs/BRAIN-API.md) for the complete active contract.

## Correction and forgetting

Palari Brain no longer guesses contradictions with text rules. A newer
statement from the same speaker follows the older one chronologically, and
the answer prompt tells the model to treat it as a possible correction. This
is model-mediated behavior, not deterministic storage supersession.
User and Palari statements never collapse into one row, even if their words
are identical.

Deletion is intentionally exact:

```js
import { forgetMemories } from 'palari-brain'

forgetMemories(brain, selectedEvidenceIds, { palariId, userId })
```

There is no `topicForget("espresso")`. A chatbot can show or select the
relevant IDs from `brain.listStatements(...)`, get user confirmation, and
then delete those IDs. Deleting canonical evidence also deletes its derived
quotes. Similarity is not allowed to make a destructive decision.

The store keeps a content-free source-identity tombstone (and the canonical
turn manifest hashes) so transport replay cannot restore deleted evidence.
Deletion removes message content, not every item of metadata.

## Historical evaluator

The repository still contains the extracted palari-v05 lexical kernel and
its frozen J3/J4 evaluation machinery. They are retained as historical
comparators and provenance for already completed runs; they are not exported
from the package entry point and are not used by the active product API.

`npm run bakeoff` continues to reproduce that historical offline comparison.
It is not a score for the active canonical-dialogue/complete-context path. No
new live provider run was performed for this change, and no sealed J4 result
was altered.

The candid history is in [WE-MESSED-UP.md](WE-MESSED-UP.md), the current
state and gates are in [STATUS.md](STATUS.md), and append-only decisions are
in [docs/DECISIONS.md](docs/DECISIONS.md).

License: MIT.

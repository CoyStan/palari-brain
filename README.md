# Palari Brain

Memory for a chat assistant, reduced to the part that matters:

1. a writer selects an exact durable quote from the visible user/Palari
   exchange;
2. Palari Brain verifies the quote and records who actually said it;
3. a later answer receives the complete current memory for that user and
   Palari;
4. corrections remain in chronological order, and forgetting deletes exact
   selected IDs.

The active package does not parse English with regular expressions and does
not retrieve with keywords, FTS, BM25, or fuzzy text matching. It also does
not add an embedding service or a second model call. The existing answer
model decides which records are semantically relevant from the complete
scoped set.

If that complete set exceeds the configured memory context, Palari Brain
returns `capacity_exceeded` and does not call the answer model with a partial
set. That is an explicit limit, not a hidden retrieval failure.

## Quickstart

```bash
npm test
npm run quickstart
```

Both commands are offline. The quickstart demonstrates:

- exact user and Palari quotes stored with `user_message` and
  `assistant_message` provenance;
- a paraphrased later question answered from the complete memory set;
- a newer user correction presented after the old statement so the answer
  model can apply it while history remains visible;
- exact-ID deletion followed by honest absence;
- source-document text excluded from writer evidence.

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
  userId,
  sourceMessageId,
  sourceTexts,
}, {
  extractor: async ({ request }) => {
    // Send request to a structured-output model and return its JSON text.
    return callWriterModel(request)
  },
  extractorId: 'provider:model',
})

const result = await answerQuestion(brain, {
  provider: async ({ prompt }) => {
    const response = await callAnswerModel(prompt)
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

The writer schema contains only:

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
Palari reply, or both, then assigns provenance mechanically. A Palari record
means “Palari said this”; it is never rewritten as a user fact. Tool, web, and
source-document text is not included in the writer request.

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

forgetMemories(brain, selectedMemoryIds, { palariId, userId })
```

There is no `topicForget("espresso")`. A chatbot can show or select the
relevant IDs from `brain.listStatements(...)`, get user confirmation, and
then delete those IDs. Similarity is not allowed to make a destructive
decision.

## Historical evaluator

The repository still contains the extracted palari-v05 lexical kernel and
its frozen J3/J4 evaluation machinery. They are retained as historical
comparators and provenance for already completed runs; they are not exported
from the package entry point and are not used by the active product API.

`npm run bakeoff` continues to reproduce that historical offline comparison.
It is not a score for the active exact-quote/complete-context path. No new
live provider run was performed for this change, and no sealed J4 result was
altered.

The candid history is in [WE-MESSED-UP.md](WE-MESSED-UP.md), the current
state and gates are in [STATUS.md](STATUS.md), and append-only decisions are
in [docs/DECISIONS.md](docs/DECISIONS.md).

License: MIT.

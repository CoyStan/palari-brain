# Palari Brain active contract

This document describes the package root exported by `src/index.mjs`.
`docs/KERNEL-API.md` and `docs/KERNEL-CONTRACT.md` describe the preserved
v0.5 comparator, not the active chatbot path.

## The two memory layers

Palari Brain deliberately keeps two different representations:

1. **Canonical dialogue journal.** Exact, role-labelled visible user and
   Palari messages. This is the lossless, private, deletable source of truth.
2. **Active memory digest.** A bounded set of model-derived items updated
   after each durable interaction. This is what a later answer normally sees.

The digest does not replace the journal. It makes a long-lived assistant
usable without sending hundreds of old messages to the answer model.

There is no natural-language regex admission, keyword retrieval, FTS/BM25
recall, fuzzy matching, vector search, or query-time scan in the active path.
The current question is never used to decide what memory is stored.

## Canonical write path

`ingestChatTurn(brain, turn, { reducer, reducerId })`

The trusted host supplies:

- `userMessage` and `assistantMessage`: the only eligible evidence fields;
- `eventAt`: evidence time;
- `sourceMessageId`: stable interaction identity;
- `palariId` and `userId`: required private scope;
- optional `authorId`: the authenticated host's opaque identity for the
  human who supplied `userMessage`;
- `retention`: `durable` or `ephemeral`.

Calling this method is the host's explicit storage decision. Omitted or
unknown retention fails before storage or model use. `ephemeral` skips both
canonical storage and reduction.

The two messages and all identity fields must be well-formed Unicode without
U+0000. Those values do not round-trip through the pinned SQLite TEXT driver,
so Palari Brain rejects them instead of silently truncating or rewriting
evidence.

`sourceTexts` may be supplied for accounting, but its content is never placed
in canonical storage or a reducer request. Tool, web, source, system, and
developer messages have no write field in this API.

For every nonempty durable message, the host first commits one exact,
untrimmed canonical row:

- `userMessage` → `user_message`;
- `assistantMessage` → `assistant_message`.

Each row carries private scope, a role-specific source-message ID, chronology,
observation time, and a content hash. When `authorId` is present, the gate
stamps it only on the user evidence row; it is not placed in statement-
extractor or graph-extractor requests and no model response can set it. A turn
manifest fixes the presence, absence, bytes, and event time of both visible
roles, while the user row fixes its optional author. Replaying the exact
snapshot is idempotent. Adding, removing, changing, retiming, or re-attributing
either role under the same source identity throws `SOURCE_MESSAGE_CONFLICT`
before model use. The turn manifest retains the optional user author after
exact deletion, so replay by a different author still conflicts and replay by
the original author still cannot resurrect the deleted message.

The same SQLite transaction that adds canonical evidence also appends one
monotonic reduction unit. A crash cannot leave accepted dialogue without
visible reduction work.

## Incremental reducer

Reduction happens after the canonical transaction commits. No network call is
made while SQLite is locked.

The callback receives:

```js
async function reducer({ request, unit }) {
  // request.input.prior: complete bounded active state
  // request.input.evidence: exactly one new canonical interaction
  // unit: local sequence metadata, not writable provenance
  return structuredReducerResponse
}
```

The provider-neutral request is capped at 40,000 rendered characters. It
contains at most 64 prior items plus the current canonical user/Palari
evidence. It contains no question, scope IDs, source text, tools, web results,
or credentials. `reducerId` must be an explicit versioned identifier whenever
pending work is reduced; the scope persistently pins both it and
`active-memory-reducer/v1`.

The response contains exact keys:

```json
{
  "baseRevision": 4,
  "dispositions": [
    {
      "evidenceId": "dialogue_...",
      "outcome": "used"
    }
  ],
  "actions": [
    {
      "op": "replace",
      "relation": "supersedes",
      "targetIds": ["digest_..."],
      "topic": "coffee preference",
      "statement": "The user now prefers a cortado.",
      "epistemic": "asserted",
      "basis": [
        {
          "kind": "evidence",
          "id": "dialogue_...",
          "quote": "I now prefer a cortado."
        },
        {
          "kind": "memory",
          "id": "digest_...",
          "quote": ""
        }
      ],
      "timeBasis": null
    }
  ]
}
```

Mechanical limits:

- at most 8 actions per interaction;
- at most 16 basis entries per action;
- topic at most 120 characters;
- statement and exact support quote at most 500 characters;
- active result at most 64 items and 24,000 rendered characters.

### Working-memory size and density

The digest is sized to be competitive with production memory frameworks.
Mem0 reports under 7,000 tokens per retrieval at a 200-memory budget; a
full-context baseline on LongMemEval-S runs 25,000-115,000 tokens per query.
Palari's 24,000-character cap is roughly 6,000 tokens, so the *budget* is
right. What matters is how many facts fit inside it.

Records sent to the answer model are therefore lean. They carry the
statement, speaker, observation time, topic, epistemic state, an optional
trusted time anchor, and one exact supporting quote — the most recent one,
which is the quote that proves the current fact. Opaque identifiers cost
~130 characters each and an answer model cannot use them; every additional
historical quote costs ~130 more.

| rendered record | cost | items in 24,000 chars |
| --- | --- | --- |
| full provenance, every quote and ID | ~1,400 chars | ~16 |
| lean record, one exact quote | ~340 chars | ~70 |

At ~340 characters the 64-item ceiling costs ~21,600 characters, so both
limits are reachable together. Under full provenance rendering the character
cap bound at ~16 items and the 64-item ceiling was unreachable.

Nothing is lost. `briefing.included` still carries every support, every
identifier, and the reducer ID for audit, deletion, and UI, and the canonical
journal remains exact and complete.

Use `input.utilization` to budget. It reports `items`, `itemsRemaining`,
`digestChars`, and `digestCharsRemaining`, all measured with the same
serializer that enforces the cap; `digestChars / items` gives the mean cost
of an item so far. Compact with `summarizes` before the budget is gone: a
response whose resulting state exceeds a limit is rejected in full.

### Lineage depth is bounded

Replacing an item carries its supporting quotes forward. That accumulation
is capped at 16 supports per item: when a replacement would exceed it, the
oldest supports are shed and the newest are kept. The support proving the
new statement is always the newest, so it is never the one dropped.

This bound exists because lineage was previously monotonic, which meant an
item could absorb only 16 corrections before the whole reduction failed and
every later interaction stalled behind it. Correcting one preference more
than 16 times is ordinary use.

Shedding affects only the depth of the correction chain inside bounded
working memory. The canonical journal still holds every message exactly and
losslessly, and `recallAllStatements` still reads it in full.

Every current evidence row receives exactly one `used` or `no_memory`
disposition. `used` is valid only when an action actually cites that evidence.
A valid all-`no_memory` response advances coverage without storing filler.

### What the model cannot author

The reducer cannot provide a durable ID, scope, speaker, source kind,
timestamp, sharing policy, confidence score, or deletion operation. The host:

- accepts evidence references only from the current reduction unit;
- accepts memory references only from the current active state;
- checks every evidence quote as an exact contiguous substring;
- derives speaker and time from canonical rows;
- rejects an item that mixes user and Palari authority;
- carries transitive quote lineage when replacing an item, bounded to the
  newest 16 supports;
- applies the whole action set atomically or not at all.

Unmentioned prior items remain active. Model omission cannot erase them.
`add` must use current evidence. `replace` must name every replaced prior item
and include those IDs as memory basis.

`supersedes` is narrower than arbitrary replacement: it requires exactly one
same-topic, same-speaker target and later current evidence. An older
out-of-order interaction cannot supersede newer memory. `summarizes` can
compact one or more same-speaker items while carrying their exact evidence
lineage.

The model-written `statement` is labelled `model_digest`; it is never
presented as a verbatim user statement. Exact support quotes remain available
beside it.

### Ordering, failure, and recovery

Reduction units are processed in durable insertion order, never by
`MAX(dialogue_order)`. Deleting the newest message cannot cause a later
interaction to reuse a reducer checkpoint.

The active state uses compare-and-swap revision checks. A late concurrent
result, or a result created before deletion, cannot overwrite a newer state
or restore forgotten text.

A missing, malformed, oversized, stale, or semantically invalid reducer
proposal:

- does not roll back canonical dialogue;
- leaves the earlier digest unchanged;
- leaves the oldest unit pending;
- returns structured `reductionStatus`, `reductionReason`,
  `reductionPending`, and `reductionBlocked` fields from ingestion.

Later units do not skip the failed unit while it is still actionable. Once a
unit is quarantined the queue head has moved, so a drain keeps going rather
than leaving healthy interactions stuck behind one standing defect.

A provider-wide failure is different. After its own bounded retry policy is
finished, an adapter must mark authentication, request configuration/schema,
transport, or terminal provider-response failures:

```js
import { markReducerFailureTerminal } from 'palari-brain'

try {
  return await callReducerProvider(request)
} catch (error) {
  throw markReducerFailureTerminal(error)
}
```

Marked errors are rethrown immediately. The host does not split a batch,
increment interaction attempts, or quarantine canonical evidence for a
failure that every interaction would reproduce. The marker is process-local,
so model-authored JSON cannot forge it. Do not mark a returned semantic
proposal that merely fails quote, reference, speaker, chronology, or capacity
validation; those failures can belong to one interaction and retain the
normal isolation behavior.

Recovery is explicit:

```js
import { reducePendingTurns } from 'palari-brain'

await reducePendingTurns(brain, {
  maxTurns: 10,
  palariId,
  reducer,
  reducerId: 'my-memory-reducer/v1',
  userId,
})
```

An exact replay of an already reduced turn does not call the reducer or
advance revisions. A failed turn may be replayed to retry its still-pending
unit.

### Reduction cadence and batching

By default `ingestChatTurn` reduces after every interaction. That makes the
reducer re-read all of active memory on every message, so per-message cost
scales with how much is remembered. Two options decouple them:

```js
await ingestChatTurn(brain, turn, {
  reducer,
  reducerId: 'my-memory-reducer/v1',
  reduceEvery: 20,          // reduce once per 20 pending interactions
  maxInteractionsPerCall: 20, // how many may share one reducer request
})
```

Waiting loses nothing. Canonical dialogue is already durable, and recall
falls back to the complete journal while reduction is pending.

A batched request carries several interactions' evidence at once, but the
response is still capped at 8 actions. A batched reducer must therefore
**consolidate** — summarise a span of dialogue into a few facts — rather than
emit one memory per message. That consolidation is the point of batching.

Batch size is bounded by the 40,000-character request cap; interactions are
added from the queue head while the rendered request still fits, and the head
is never skipped. If an unmarked proposal fails, no single interaction has
earned an attempt against it, so the same head is retried one interaction at
a time. That isolates the offender and lets the rest through. A marked
terminal provider failure is never isolated this way.

Batching trades recall of rare one-off facts for cost: a wide consolidation
span makes an unusual fact more likely to be summarised away.
`npm run memory-bench -- --reduce-every N` measures that trade-off on your
own data before you commit to a cadence.

### Quarantine

A unit that keeps failing is quarantined rather than blocking its scope
forever. After `maxAttempts` failures (default 3, overridable per call), or
on the first failure for a deterministic category such as
`REDUCER_INPUT_CAPACITY`, the unit leaves the actionable queue.

A quarantined unit stays `pending`, so its canonical evidence is never
recorded as reduced. What changes is that later interactions are no longer
stuck behind it. The gap is reported, never hidden:

- `digestStatus()` returns `blocked` and a `ready_with_gaps` status;
- a drain that quarantined something returns `completed_with_gaps` and
  `quarantinedCategories`, never plain `completed`;
- ingestion returns `reductionBlocked` and `reduction.quarantined`;
- `recallMemory` and `answerQuestion` carry `reductionBlocked` through;
- `listBlockedReductions(scope)` names every quarantined unit and why.

A digest with gaps is still usable, and honest absence from such a digest
means "not retained", not "never happened". Recovery is explicit and never
automatic — an automatic requeue would rebuild the deadlock this prevents:

```js
brain.requeueBlockedReductions({ palariId, userId })
```

One scope keeps one reducer identity. Changing `reducerId` without an
explicit rebuild fails `REDUCER_ID_CONFLICT`; silent mixed-model state is not
accepted. A reducer-contract version mismatch similarly fails
`REDUCER_CONTRACT_CONFLICT`. Calling the drain function on an empty queue does
not claim either identity.

If one complete interaction makes the rendered request exceed 40,000
characters, the failure category is `REDUCER_INPUT_CAPACITY`. Retrying cannot
change that outcome, so the interaction is quarantined on its first failure.
It remains canonical and remains unreduced, and the gap stays visible in
`blocked`. This is deliberately not automatic segmentation:
splitting after admission would create a second provenance and chronology
contract. A host should bound a durable interaction before ingest. Once
stored, the safe choices are to keep it pending, delete its exact evidence if
the user intends to forget it, or introduce a separately versioned,
explicitly migrated chunking contract.

## Read path

`recallMemory(brain, { palariId, userId }, { maxChars })` is the product read
used by `answerQuestion`.

When every canonical revision has been reduced, it returns the complete
bounded active digest with:

- `briefingMode: "incremental_digest"`;
- every model-derived statement;
- host-derived speaker and observation time;
- exact canonical support quotes and source-message IDs;
- explicit epistemic state and optional trusted time anchor.

Digest readiness and all returned active rows are read from one SQLite
snapshot. `digestRevision` and `contractVersion` identify that snapshot.

`complete: true` means the active digest was included in full. It does **not**
claim that the lossy digest contains every fact in canonical history.

When reduction is pending, Palari Brain may use the existing complete
canonical briefing if it fits:

- `briefingMode: "canonical_fallback"`;
- `lossless: true`.

If that journal does not fit, the result is `digest_incomplete`; the answer
provider is not called. A ready digest that itself cannot fit the caller's
smaller `maxChars` returns `capacity_exceeded`.

`recallAllStatements(...)` remains the canonical diagnostic/archive read. It
orders every current canonical row by evidence chronology and preserves the
old complete-or-refuse behavior. It is not the normal long-lived answer path.

`answerQuestion` returns an honest local absence without a provider call when
the ready digest is empty. Absence means “no relevant durable memory was
retained,” not proof that an event never happened or that a count is zero.
When memory is nonempty, semantic relevance remains one answer-model call.

Stored messages and digest summaries are untrusted data. Integrations should
put `systemInstruction` in a real system/developer role, place `memoryText`
in an untrusted data/user role, give the answer provider no tools or
memory-write access, and send `questionText` last.

## Speaker and time meaning

- A user-backed item proves only what the user said.
- A Palari-backed item proves only what Palari previously said.
- Palari speech never ratifies or supersedes a user claim.
- `observedAt` and `timeBasis.anchorAt` come from canonical evidence, never
  reducer wall-clock time.
- A time phrase such as `today` stays paired with its exact quote and trusted
  evidence timestamp.
- `unknown` is an explicit epistemic item. Missing memory remains unknown.

## Memory exploration

A bounded digest cannot hold everything, and the reducer has to choose what
to keep with no knowledge of future questions. Exploration removes that
impossible requirement: when the digest is not enough, the answer model looks
in the journal itself.

```js
import { answerWithExploration } from 'palari-brain'

const result = await answerWithExploration(brain, {
  palariId,
  userId,
  question,
  maxExplorationCalls: 6,
  async provider({ briefing, explore, explorationTools }) {
    // Map explorationTools onto your model's tool-calling shape and route
    // each requested call through `explore`.
    return { abstained: false, text: '...' }
  },
})
```

Three primitives, all behind the existing gate:

| Tool | Shell analogue | What it does |
| --- | --- | --- |
| `memory_timeline` | `ls` | Lists sessions with dates and message counts |
| `memory_read` | `cat` | Returns complete messages by evidence ID or session |
| `memory_find` | `grep` | Exact, case-insensitive substring match with bounded excerpts |

This is deliberately **not** retrieval by ranking. There is no BM25, no
vector search, no fuzzy matching, and no relevance score. A `memory_find` hit
is provably present in the stored message, and the same query always returns
the same rows.

That determinism is the point. `result.consultedEvidenceIds` and the optional
`memoryAuditLog` hook give a replayable record of exactly which stored
messages informed an answer — something a nearest-neighbour retriever cannot
produce.

Exploration inherits every gate guarantee. Results are canonical records scoped
to `palariId AND userId`, with host-derived speaker and time. An attributed
user row also carries `authorId`; a timeline session containing attributed
rows adds `participants: [{ speaker, authorId, messages }]`. Deleted
messages are gone. Source, tool, and web text never entered canonical storage,
so it has no read path either. `memory_find` returns a bounded excerpt for
orientation; `memory_read` returns the complete message and never truncates
its body, because a partial quote is not complete evidence.

Exploration is bounded by `maxExplorationCalls` and fails closed — once the
budget is spent, `explore` returns `{ exhausted: true }` rather than looping.

The honest limitation: exact matching misses synonyms and typos. The tool
description tells the model so, and instructs it to try other wordings or
navigate by session instead of giving up after one miss.

### Current retrieval-to-answer API

`answerWithRetrieval` is the current product path that joins the finding aids
to answering without changing the narrower tool contract used by sealed
historical evaluators:

```js
import {
  MEMORY_RETRIEVAL_TOOLS,
  answerWithRetrieval,
} from 'palari-brain'
import { buildGeminiFunctionTools } from 'palari-brain/gemini'

const result = await answerWithRetrieval(brain, {
  palariId,
  userId,
  question,
  questionDate,
  maxRetrievalCalls: 4,
  async provider({
    answerInstructions,
    memoryText,
    maxRetrievalCalls,
    recommendedMaxOutputTokens,
    retrievalFinalizationInstructions,
    retrievalTools,
    retrieve,
  }) {
    // Map retrievalTools (the same value as MEMORY_RETRIEVAL_TOOLS) to
    // provider tool declarations. For Gemini:
    const tools = buildGeminiFunctionTools(retrievalTools)
    // Route each requested call through retrieve. Palari executes at most
    // maxRetrievalCalls (never more than 4) across all memory tools.
    // If the budget is spent, perform one tool-disabled response using
    // retrievalFinalizationInstructions: answer from consulted evidence or
    // say stored evidence is insufficient.
    // Honor recommendedMaxOutputTokens (currently 512) while following the
    // direct/concise answer instruction.
    return { abstained: false, text: '...' }
  },
})
```

`buildGeminiFunctionTools` is the provider boundary for Gemini native
function calling. It leaves the provider-neutral tool definitions unchanged,
supplies an object schema for no-argument tools, and sends each canonical
schema through Gemini's `parametersJsonSchema` field. It never places the
schema in the legacy OpenAPI-subset `parameters` field or rewrites a root
`anyOf`. Palari still validates and executes every returned call through
`retrieve`; the provider declaration is not the admission gate.

`buildGeminiGenerateRequest` also keeps the generation wire current without
changing the caller's input. For Gemini 3.5 models it maps the rejected legacy
`thinkingBudget: 0` control to low-latency `thinkingLevel: 'MINIMAL'`. It
preserves explicit `store: false`; live isolation proved that no-store is
accepted and was not the source of the request rejection. Positive thinking
budgets, current thinking levels, and Gemini 2.5 request controls are left
unchanged.

OpenAI consumers can use the additive `palari-brain/openai` subpath instead:

```js
import {
  createOpenAIRetrievalProvider,
  createOpenAIResponsesTransport,
} from 'palari-brain/openai'

const invoke = createOpenAIResponsesTransport({
  apiKey: process.env.OPENAI_API_KEY,
})
const provider = createOpenAIRetrievalProvider({ invoke })
```

The default is `gpt-5.6-luna` through `POST /v1/responses`, `store: false`,
low reasoning effort, and at most seven model dispatches as an emergency
protocol ceiling. The normal answer path permits at most four memory-tool
calls, followed by exactly one tool-disabled finalization response if the
fourth call did not already produce an answer. Palari's provider-neutral function
schemas are preserved under explicit OpenAI `strict: false`, because their
optional fields and `memory_read` root-property `anyOf` do not meet OpenAI's
strict-schema subset. The host remains strict: it recognizes the function
name, parses one argument object, enforces the retrieval budget, executes the
tool, and records the result. Every Responses output item is replayed with the
tool result so GPT-5.6 reasoning state is not dropped. Because the adapter is
stateless (`store: false`), it explicitly requests
`reasoning.encrypted_content` and replays that encrypted item unchanged.
Public configuration may lower, but cannot raise, the seven-dispatch ceiling.
It also cannot raise the four-call memory budget. On finalization the adapter
sets `tool_choice: "none"`, removes tool declarations, preserves all prior
reasoning and host-owned tool outputs, and asks Luna to answer from consulted
canonical evidence. If that evidence is insufficient, the answer must say so;
absence of stored evidence is never converted into proof that an event did not
happen. Answers produced after zero to three retrieval calls return normally
without an extra dispatch.

The same subpath exports `createOpenAIMemoryReducer` and
`createOpenAIGraphExtractor`. Their model-facing outputs use strict root-object
JSON schemas, but provider schema acceptance is never admission. Reducer
proposals still cross `normalizeMemoryReductionPayload` and the active-memory
transaction; graph assertions must cite an input ref and copy exact evidence
before the graph gate stamps speaker and time. The reducer permits at most one
host-guided repair and never retries an identical request. Provider,
transport, refusal, incomplete-output, and empty-output faults fail closed.
The public repair option may lower the one-repair ceiling but cannot raise it.

Luna produces text, not embeddings. The optional semantic `embedder` remains
an independent adapter and can coexist with the OpenAI generation path.
Offline adapter tests do not establish live compatibility, quality, latency,
or price.

It supplies the digest first and exposes all five tools:

| Tool | Behavior |
| --- | --- |
| `memory_timeline` | Chronological session orientation |
| `memory_read` | Complete canonical messages by identity/session |
| `memory_find` | Exact or stemmed-ranked journal lookup |
| `memory_search` | Reciprocal-rank fusion of ranked and optional semantic hits, followed by canonical reads |
| `memory_graph` | Read-only traversal of previously admitted quoted edges |

`memory_search` reports `semanticUsed`. If no embedder was configured, it
falls back honestly to ranked-only search instead of dialing out or claiming
semantic behavior. `memory_graph` never calls the extractor; graph indexing
is an explicit earlier `brain.indexGraph(scope)` operation.

An optional provider-neutral second stage can rerank the bounded RRF pool:

```js
import { createPalariBrain } from 'palari-brain'
import { createTransformersReranker } from 'palari-brain/reranker-transformers'

const reranker = createTransformersReranker({
  cacheDir: '/an/application-owned/cache/outside-the-repository',
  modelId: 'cross-encoder/ms-marco-MiniLM-L6-v2',
})
const brain = await createPalariBrain({ embedder, reranker, ...storage })
```

`reranker(query, canonicalTexts) -> number[]` receives an immutable ordered
array of complete canonical message text after ranked/semantic RRF. It must
return exactly one finite number per candidate. Palari sorts descending by
that locating score, with RRF score and evidence ID as deterministic ties,
and only then applies the caller's existing `limit` and `maxChars`. It cannot
author or change text, speaker, time, scope, IDs, or provenance. A configured
reranker that throws or returns a malformed batch fails the search loudly;
there is no silent partial-ranking fallback. Without one, RRF behavior is
unchanged. `reranked`, `rerankCandidates`, and `rerankScore` are additive
response metadata.

The Transformers adapter pins its small Apache-2.0 cross-encoders by exact
repository revision, lazily loads at most one tokenizer/model pair, caps the
query at 500 characters, the pool at 50 messages, and each complete message
at 100,000 characters. It makes no generation or credential request. Palari
does not depend on `@huggingface/transformers`: its 4.2.0 Node dependency
tree had five high-severity audit findings when evaluated for BRN-0008.
Applications that opt in must install and audit a compatible runtime in their
own boundary or inject `loadRuntime`. Cold model download, weight storage,
and cache lifecycle are therefore application responsibilities. The measured
default is MiniLM-L6: on the frozen 15-positive synthetic bank it reached
13/15 top-1, 0.9333 MRR, and 15/15 recall@5 at 44.63 warm ms/case. MiniLM-L12
and mxbai-xsmall each reached 14/15 and 0.9667 MRR, but at 132.10 and 88.68
ms/case respectively; xsmall dominates L12, while L6 remains the fastest
eligible Pareto-frontier member. The full fp32 caches measured 88 MiB, 129
MiB, and 280 MiB. These synthetic ordering numbers do not establish generated
answer accuracy. A missing runtime is terminal and clearly labelled; RRF
remains the default when no reranker was configured.

The pinned `cross-encoder/ettin-reranker-17m-v1` identity is recorded in the
adapter registry, but it is **not a working default through this generic
sequence-classifier loader**. Its official ONNX graph exposes
`last_hidden_state`; Sentence Transformers applies a separate mean-pooling,
Dense, LayerNorm, Dense scoring head described by `modules.json`. BRN-0008's
single compatibility smoke therefore failed closed before the bank ran.
The shipped registry now rejects that identity up front with
`RERANKER_MODEL_UNSUPPORTED`; applications cannot accidentally repeat the
known-incompatible download path. A separately reviewed modular-head
implementation is required before Ettin can be selected.

`result.consultedEvidenceIds` contains every canonical message or graph edge
returned to the answer callback. `result.retrievalTranscript` records every
bounded tool request/result. Search ranking and graph structure locate
evidence; exact journal messages and verified edge quotes remain the only
testimony.

The provider-neutral answer contract applies to the initial briefing and all
later tool results as one evidence stream:

- an empty initial digest does not override relevant canonical evidence found
  later;
- when consulted evidence directly addresses the question, the answer uses it
  or names the exact conflict or limitation that prevents using it;
- non-empty retrieval is not automatically relevant and never forces an
  unsupported answer;
- prior Palari speech may be recalled as Palari's prior advice,
  recommendation, or commitment, but never as something the user said, did,
  owned, or preferred; and
- empty or irrelevant evidence still produces honest absence rather than a
  fabricated fact.

These are instructions to the caller's answer provider, not a host-side
lexical answer grader and not proof of provider compliance. The host continues
to preserve canonical bytes, speaker, time, evidence identity, scope, and the
bounded retrieval transcript; a separately authorized live measurement is
required to measure generated-answer behavior.

### Host-computed question-relative time

When `answerWithRetrieval` receives a valid `questionDate`, every answer-facing
canonical row returned by `memory_find`, `memory_read`, or `memory_search`
contains a copied `questionRelativeTime` block. Admitted graph edges receive
the same block because their `observedAt` is also host-recorded:

```json
{
  "evidenceAt": "2023-11-01T00:46:00.000Z",
  "referenceAt": "2024-02-01T18:06:00.000Z",
  "relation": "past",
  "wholeDays": 92,
  "wholeCalendarMonths": 3
}
```

`evidenceAt` comes from the row's canonical `observedAt`; `referenceAt` is the
validated question date. `relation` is `past`, `same`, or `future` from the
evidence's perspective. Signed whole days and whole calendar months point from
the evidence to the question: an event after the question has negative values.
Calendar months use UTC year/month arithmetic and adjust toward zero when the
later date has not reached the earlier UTC day and time. A month is never
approximated as 30 days. Missing or invalid evidence/question dates omit the
block. The canonical row and underlying brain result are never mutated, and no
date is inferred from message prose.

### The digest is an index

Each rendered digest record names the sessions its supporting evidence came
from:

```json
{"epistemic":"asserted","observedAt":"...","quote":"I commute by bicycle now.",
 "sessions":["sess-b"],"speaker":"user","statement":"The user commutes by bicycle.",
 "timeAnchor":null,"topic":"commute route"}
```

Session identifiers are short, so pointing costs far less than carrying more
quotes, and it tells the model where to look when a summary is not enough.

## Forget path

`forgetMemories(brain, ids, { palariId, userId })`

Deletion accepts exact canonical evidence IDs or legacy exact-index IDs. A
digest ID is not a destructive selector. The gate resolves IDs only inside
the specified `palariId AND userId` scope.

When canonical evidence is deleted, the same transaction:

1. deletes the selected message and linked legacy index rows;
2. clears all generated digest prose for that scope;
3. increments the canonical scope and digest revisions;
4. removes empty reduction units;
5. queues every surviving canonical interaction for ordered rebuild.

Clearing the whole digest is deliberate. Removing only an item that cites a
deleted correction could leave an older item in the wrong semantic state.
Until rebuild finishes, `answerQuestion` uses complete canonical fallback or
refuses.

The database retains a content-free, role-scoped source-identity tombstone.
Canonical turns also retain their manifest and content hashes. Deletion
removes message bodies and generated digest content; it is not cryptographic
erasure of every metadata item.

This contract deletes a complete retained message. It does not redact one
fact from a multi-fact message. There is no topic-string or similarity-based
destructive operation.

## Sensitive content and local security

Canonical durable dialogue is stored byte-for-byte in plaintext SQLite. A
reducer instruction cannot protect that canonical copy. A chatbot must mark
password entry, private forms, or any other non-retained surface `ephemeral`,
and must obtain any consent required before persisting or sending memory to a
provider.

When the active path creates a memory directory, it uses mode `0700`. It
enforces mode `0600` on the exact configured database path on every open,
including upgrades. Filesystem modes are not encryption at rest.

## Upgrade and historical boundary

Opening an existing database creates the incremental tables and queues
existing canonical turns in chronological order. Migration performs no model
call and does not pretend old dialogue was already reduced. Until a host
processes that queue, complete canonical fallback remains available.

Pre-upgrade exact-quote evidence stays explicitly labelled
`legacy_selected_quote`. On exact source replay it is promoted only when the
quote occurs in the full canonical message.

The older optional `{ extractor, extractorId }` exact-quote hook and its
non-FTS annotation table remain for backward-compatible diagnostics and
sealed evaluator code. New product integrations should use the reducer and
should not run both provider hooks. Active answer recall never queries the
old index.

The legacy SQLite memories/FTS store remains for frozen comparator
reproducibility. Frozen live identities remain terminal: product changes do
not authorize running, rerolling, or modifying them.

## Retrieval surfaces added 2026-07-28

One law binds every surface below: an index may locate evidence; it may
never be evidence. Whatever a surface ranks or traverses, the value
returned is a canonical journal row (or a verified quote of one) with
host-recorded speaker, time, and scope. Deleting evidence removes it from
every surface by trigger plus the visibility join.

### `memory_find` extensions (exact + ranked + time bounds)

`brain.exploreFind(scope, { phrase, ranked, after, before, limit, ... })`

- Default is byte-exact, case-insensitive substring matching (unchanged).
- `ranked: true` switches to stemmed BM25 word matching over the journal
  (porter tokenizer; FTS5 index in `src/memory-search.mjs`; built and
  migrated lazily; deterministic — same journal, same order, chronology
  breaks ties). All-stopword phrases fall back to exact. The result carries
  `mode: 'exact' | 'ranked'`.
- `after` / `before` (ISO-8601 UTC strings) bound results by host
  `event_at` in both modes. Callers resolve relative periods ("last
  spring") into bounds themselves; the host only compares its own recorded
  times.

### `memoryFreshness(brain, scope)`

How far behind the dialogue this scope's digest is:
`{ currentThrough, latestEvidenceAt, pending, blocked, stale }`.
Render as "memory current through <date>" instead of degrading silently
when a reduction is stuck.

### Quote-context guard (admission-time)

`src/quote-context.mjs`. An `asserted` digest item or graph edge may not
rest on a quote whose same-sentence prefix negates or conditions it, that
sits inside quotation marks (reported speech), or that overlaps a detected
third-party span (pasted email headers, forwarded blocks, quoted replies).
Rejection code `REDUCER_QUOTE_CONTEXT` / `GRAPH_ASSERTION_INVALID`; the
honest remedies are widening the quote or downgrading epistemic status.

### Semantic search (optional; `embedder` option)

`createPalariBrain({ embedder })` where
`embedder(texts: string[]) -> number[][]` (any provider or local model).

`await brain.exploreSemantic(scope, { phrase, limit })` → canonical rows
plus `similarity`. Vectors are derived data in the same SQLite file
(`dialogue_evidence_vectors`), indexed incrementally, removed by trigger on
deletion. Without an embedder the surface throws — nothing dials out and
nothing pretends.

`brain.retrievalCapabilities.semantic` tells an answer orchestrator whether
the optional semantic surface is configured. `answerWithRetrieval` uses that
host-derived capability to decide whether `memory_search` runs one or two
ranking surfaces.

`brain.retrievalCapabilities.reranking` independently reports whether the
optional cross-encoder stage is configured. Embedding and reranking are
separate: the former widens semantic recall, while the latter reorders only
the already bounded, canonical candidate pool.

### Derived temporal graph (optional; `graphExtractor` option)

`createPalariBrain({ graphExtractor })` where
`graphExtractor({ evidence: [{ ref, speaker, text }] }) ->
{ assertions: [{ evidenceRef, subject, predicate, object, quote,
timeQuote? }] }`.

- `await brain.indexGraph(scope)` — incremental extraction; every proposed
  triple is admitted only if its `quote` (and optional `timeQuote`) is an
  exact contiguous substring of the cited row and passes the quote-context
  guard. Speaker and time are stamped from the row. The extractor never sees
  `authorId`; returned edges recover it host-side from canonical evidence.
- `brain.exploreGraph(scope, { entity, hops ≤ 3, now })` — model-free SQL
  BFS. Fuzzy trigram resolution applies to the caller's entry point only
  (stored entities are never merged). Returns `edges` (each with verified
  `quote`, `evidenceId`, `observedAt`, optional `timeAnchor`, and
  `latestForPredicate` — validity is computed from chronology, never
  stored) and `trends` (per fact group: `new / strengthening / weakening /
  stable / stale`, a pure function of host timestamps —
  `src/memory-trend.mjs`).

### Measurement commands

`npm run trust-bench` (five trust cases, CI-pinned 5/5),
`npm run scale-probe` (5,000-message behavior), `npm run memory-bench`
(digest structure), `npm run probe` (live wire-format check; the only
spend-capable command; founder-gated). See `evals/README.md`.

## Deletion honesty and receipts — added 2026-07-29

### `forgetWithReport(brain, scope, { phrase, limit? })`

Deletion by language, answered honestly. `forgetMemories` deletes exactly
the IDs the caller names; real deletion requests arrive as words ("forget
what I told you about Lexapro"). `forgetWithReport`:

1. locates every visible row the phrase can reach (exact substring +
   ranked BM25, `src/memory-forget.mjs`),
2. widens each hit to its whole turn — the assistant's echo of a user
   statement goes too, because a deletion that leaves the echo standing
   has not deleted,
3. runs the existing `forgetById` path (tombstones, digest invalidation,
   FTS/vector/graph cleanup by trigger), and
4. **re-probes the survivors** and returns `residual`: rows that still
  appear to mention the subject, each with `evidenceId`, `speaker`, optional
  host-stamped `authorId`, `observedAt`, `snippet`, and `matchedVia`
   (`exact` / `request_terms` / `deleted_content_terms`).

The `deleted_content_terms` probe searches with vocabulary taken from the
deleted text itself, so a paraphrase that never used the requested word
("the little white pill") is surfaced whenever it shares any content term
with what was deleted. The report never claims "clean": an empty
`residual` means the lexical probes found nothing, not that nothing
remains — a zero-overlap paraphrase is exactly the boundary the semantic
seam exists for.

### `ingestedAt` on every explored row

`memory_find` / `memory_read` / `memory_timeline` rows now carry two
timestamps with two authorities: `observedAt` is the caller's claimed
event time (the chronology basis, so multi-device backfill works);
`ingestedAt` is the host's own clock at the moment the row was written
and cannot be supplied by any caller. When the two disagree wildly, the
disagreement is itself evidence — a backdated ingestion cannot hide.

### Offline Gemini adapters (evals/arms/, dispatch-ready)

- `evals/arms/graph-extractor-gemini.mjs` —
  `createGeminiGraphExtractor({ invoke })` satisfies the
  `graphExtractor` option: shallow provider schema, strict fail-closed
  host normalization (exact-quote and ref checks before admission), one
  single-turn repair with the host's objection riding inside the request
  document, empty responses classified (`GRAPH_EXTRACTOR_EMPTY_RESPONSE`)
  and never repaired.
- `evals/arms/embedder-gemini.mjs` — `createGeminiEmbedder({ invoke })`
  satisfies the `embedder` option: `batchEmbedContents` bodies capped at
  100 texts, symmetric `SEMANTIC_SIMILARITY` task type (one function
  embeds both rows and queries), strict order/dimension/finiteness
  normalization.

Both are offline-tested with fake transports and own no credentials,
network access, retries, or meter — live dispatch stays founder-gated in
the keyed session.

### Runnable walkthroughs

`node examples/walkthrough-storage.mjs` traces one turn through the
storage path (host stamps, verified quotes, lying-reducer rejection);
`node examples/walkthrough-retrieval.mjs` traces retrieval (digest,
finding aids, canonical reads, honest absence).

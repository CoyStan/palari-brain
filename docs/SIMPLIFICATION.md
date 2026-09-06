# Choosing a smaller Palari integration

Palari's core responsibility is durable evidence with host-owned scope, speaker,
time and identity. Corrections remain attributable; forgetting removes exact
owned records and invalidates their derived state. Search indexes and summaries
help find evidence. They cannot authorize new facts or replace canonical reads.

Start with `palari-brain/core`. Choose an answer policy separately from
`palari-brain/answers`. The root and all previous subpaths remain compatible.

| User operation | Core operation |
|---|---|
| Remember | `ingestChatTurn(brain, turn)` with explicit retention and host identity |
| Find | `brain.exploreFind(scope, { phrase, ranked: true })` |
| Read sources | `brain.exploreRead(scope, { evidenceIds })` |
| Correct | Ingest the user's new corrective statement as a new interaction |
| Forget | `forgetMemories(brain, evidenceIds, scope)` |
| Inspect derived context | `recallDigest(brain, scope)` and `memoryFreshness(brain, scope)` |

A correction preserves the original speech and its new correction. In journal
mode the answer policy must interpret their chronology and conflicts. With a
reducer, checked replacement actions can also supersede the prior derived item.
Neither mode silently rewrites what a user originally said. Missing search hits
do not prove absence; exact quotation does not prove an answer's reasoning.

## Journal and digest modes

```js
import { createPalariBrain, ingestChatTurn } from 'palari-brain/core'
import { answerWithSingleSearch } from 'palari-brain/answers'

const brain = await createPalariBrain({
  memoryEnabled: true,
  workspaceId: 'your-workspace',
  statePath: '/your/private/state/brain.json',
  digestMode: 'off',
  semanticAcceleration: 'exact',
})
```

`digestMode: 'off'` disables reducer execution and use of existing summaries.
Passing a reducer to ingestion fails before writing. Canonical storage and
reduction bookkeeping remain; this option does not remove old summaries or
schemas. Reopen with `digestMode: 'optional'` to use reductions again.
`optional` is the existing default: omitting a reducer already works.

`recallDigest` reads only a transactionally ready derived snapshot. Its `text`
is empty when no digest exists, it is disabled, it is behind, or it exceeds the
context limit. Revision, pending and blocked counts remain visible. It never
loads the journal as a substitute. Existing `recallMemory` and `answerQuestion`
retain their complete-canonical-fallback behavior.

## Answer policies

`answerWithSingleSearch(brain, options)` is an explicit baseline:

```text
question + ready digest, when available
  -> one scoped hybrid search with canonical readback
  -> one answer callback
  -> host citation validation
```

Required options are `palariId`, `userId`, `question`, and `provider`. Optional
`searchQuery` defaults to `question` and must be a nonempty string of at most
500 characters. Use it to supply a focused query for a long question. `limit`
defaults to 20 (maximum 50); `evidenceMaxChars` defaults to 20,000 (maximum
100,000). The evidence budget preserves complete canonical rows, so the first
row can exceed it. `maxChars` bounds derived digest context, default 100,000.
`questionDate` and `trustedRetrievalTimeRange` retain existing temporal behavior.

The callback receives `{ question, questionDate, memoryText, evidence,
systemInstruction, answerInstructions }`, with immutable canonical evidence.
It receives no retrieval tools, planning callback, or commit authority. Return:

```js
{
  abstained: false,
  text: 'The bicycle is green.',
  bases: [{ evidenceId: evidence[0].evidenceId, quote: 'my bicycle is green' }],
}
```

The host checks proposal shape, evidence ownership and exact contiguous quotes.
Non-abstaining answers require 1–20 distinct evidence IDs. An explicit abstention
may use `bases: []`. An empty search avoids the answer callback and reports
insufficient stored evidence. It does not establish that the user has no such
fact. Results retain retrieval transcripts and cite the sources actually used.

`answerWithRetrieval` retains planning, bridge exploration, enumeration,
recommendation and confirmation policies. Existing defaults are unchanged.
`answerWithExploration` and `answerQuestion` also remain available. The baseline
reuses the existing commitment validator; its internal execution still uses the
retrieval orchestrator. This first simplification does not delete the advanced
implementation or assert equal quality on multi-hop or exhaustive questions.

## Optional retrieval components

The baseline defaults to `retrievalProfile: 'simple'`: scope-local BM25 and,
when an embedder is supplied, exact semantic search. It disables graph retrieval,
reranking and HNSW acceleration. `retrievalProfile: 'configured'` explicitly
restores configured reranking/acceleration. The advanced answer path still
defaults to `configured`; it also accepts `simple` and `briefingPolicy: 'digest'`.
Graph requests are rejected under `simple` even if a callback asks for them.

At brain creation, `semanticAcceleration: 'exact'` avoids creating an HNSW
locator. `auto` preserves existing fallback behavior. No locator is created
without an embedder. Embeddings, graph extraction and rerankers remain injected
options; a configured chunk embedder still controls mean versus maximum-chunk
representation in either profile. No new scoring algorithm was added.

The date filters, vector-space binding, scoped BM25, retrieval-family fusion and
bounded heap remain. They protect eligibility, comparability and bounded work.
The known per-query scoped BM25 indexing cost remains; profile selection does
not remove that tradeoff.

## Verification and comparison

Run `npm run quickstart:simple` for an offline journal-only journey and
`npm run alpha:compare-simple` for 12 paired scripted cases: journal/digest,
single/iterative, and remember/correct/forget. The latter reports answer and
reducer callback counts, context characters and elapsed time. It creates small
temporary stores and deletes them on completion. It uses no provider or dataset.

These are plumbing diagnostics. Scripted latest-record selection does not test
model reasoning, retrieval strategy choice, or resistance to realistic ambiguity.
Before changing defaults, compare the same model on previously unused histories
with long-context/compaction, a simple profile plus search, and Palari's two
answer paths. Measure grounded correctness, correction/deletion failures,
latency and total provider cost including reduction/indexing. A paid run needs
its own aggregate dollar cap. Current defaults remain pending that evidence.

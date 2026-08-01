# Palari Brain consumer seam

This is the supported boundary between an application and Palari Brain. The
brain owns durable memory mechanism. The application owns identity,
authorization, product policy, and presentation.

## Stable imports

Applications may depend on these named exports from the package root:

- `createPalariBrain(options)` — opens one local workspace store and returns
  the scoped read/write operations;
- `ingestChatTurn(brain, turn, options)` — commits one host-approved durable
  interaction or explicitly skips an ephemeral one;
- `answerWithRetrieval(brain, options)` — provider-neutral, bounded answer
  orchestration over canonical and derived retrieval;
- `forgetMemories(brain, ids, scope)` and
  `forgetWithReport(brain, scope, request)` — exact deletion and honest
  language-request deletion;
- `memoryFreshness(brain, scope)` and `reducePendingTurns(brain, options)` —
  digest health and explicit reduction work;
- `MEMORY_RETRIEVAL_TOOLS`, `MEMORY_RETRIEVAL_INSTRUCTIONS`,
  `memoryAnswerSystemInstruction`, `dialogueRetentions`, and
  `dialogueSourceKinds` — the provider-neutral contracts needed to wire those
  functions.

The methods returned by `createPalariBrain` that those functions use are also
stable: `rememberTurn`, `exploreFind`, `exploreRead`, `exploreTimeline`,
`exploreSemantic`, `exploreGraph`, `indexGraph`, `listStatements`,
`forgetById`, `forgetRequest`, `digestStatus`, `readReadyDigest`,
`reducePendingTurns`, `retrievalCapabilities`, `publicStatus`, and `close`.
An optional capability may refuse clearly when its adapter is absent; for
example, `exploreSemantic` needs an embedder and `indexGraph` needs a graph
extractor.

Other root exports support internal contracts, historical comparators, or
evaluation harnesses. Their presence is not an application integration
promise unless this document names them.

## Versioning promise

The package version follows Semantic Versioning for this seam, including
while the repository is private. Patch releases preserve inputs, meanings,
and existing output fields. Minor releases may add optional inputs, methods,
or output fields; consumers must ignore unknown output fields. Removing a
named function, changing an existing field's meaning, or making a previously
valid call invalid requires a major version and migration notes.

Persisted schema compatibility is separate from JavaScript API compatibility.
Before deploying a new version, stop old-version writers, back up the SQLite
file, open it with the new version so migrations finish, and only then start
normal traffic. Rolling a database back to an older package version is not
promised.

## Scope and author attribution

Every operation is isolated by the exact opaque pair `palariId AND userId`.
For a private assistant, that pair can name one user journal. For a shared
Palari, the application supplies the same pair for every member—for example a
Palari/workspace ID plus one shared-journal namespace—and stamps each human
message with its authenticated member identity:

```js
await ingestChatTurn(brain, {
  palariId: workspaceId,
  userId: sharedJournalId,
  authorId: authenticatedMemberId,
  sourceMessageId,
  eventAt,
  retention: 'durable',
  userMessage,
  assistantMessage,
})
```

`authorId` is an optional opaque string. The gate copies its exact
round-trippable bytes only onto that turn's nonempty `user_message` evidence.
Palari replies retain `speaker: 'Palari'` and have no human `authorId`.
Omitting attribution preserves the pre-attribution output shapes. Reusing one
`sourceMessageId` with a different author conflicts just like changing its
message bytes or timestamp.

Find, read, semantic, hybrid `memory_search`, graph, briefing, and forget
residual rows return `authorId` when their canonical evidence has one. An
attributed timeline session has `participants` entries shaped as
`{ speaker, authorId, messages }`. The graph extractor and statement
extractor never receive `authorId`; graph results recover it host-side from
the admitted edge's canonical `evidenceId`. Reducer and extractor response
schemas have no author field and reject attempts to add one.
The low-level `listStatements` and `listIndexEntries` database-shaped records
use `author_id`; application-facing retrieval results use `authorId`.

This is provenance, not permission. Possessing or guessing a scope key is not
authentication. The application must authenticate the caller, verify current
membership, choose the scope, stamp `authorId`, and authorize reads and
deletions before it calls the brain. The brain deliberately does not contain
roles, memberships, invites, ownership policy, per-author deletion rules, or
timezone/display policy. `forgetWithReport` reports all surviving mentions in
the supplied scope regardless of author; application policy decides whether a
request may be made.

## SQLite concurrency contract

A file-backed brain configures SQLite WAL journal mode and a 5,000 ms
`busy_timeout` on every active brain connection after its baseline schema has
opened. Canonical ingestion and deletion use explicit transactions. Within
one process, concurrent asynchronous callers may share one brain or use
multiple brain handles that were opened sequentially for the same local file.
`DatabaseSync` operations serialize on the JavaScript thread; reads see a
committed SQLite snapshot and writes commit atomically. No canonical turn is
silently skipped or partially committed.

If a writer cannot acquire the SQLite lock within five seconds, SQLite throws
`SQLITE_BUSY`/`SQLITE_LOCKED` through the public call. That is a failed
operation, not accepted memory. A caller may retry the same immutable
`sourceMessageId`; exact replay is idempotent, while different bytes, time, or
author fail with `SOURCE_MESSAGE_CONFLICT`. Provider callbacks run only after
the canonical write transaction commits, so no network wait holds a database
lock. A later reducer failure does not mean the already-committed journal turn
was lost.

Multiple application processes opening or writing the same database are
explicitly unsupported, even on one host: baseline schema initialization
occurs before the active connection installs its wait policy, so simultaneous
first opens may fail immediately with SQLite `database is locked`. A
multi-process or multi-host application, network filesystem, object-store
mount, or replicated writer topology must put one owner process/service in
front of the local brain or supply a different persistence architecture. It
must not share the SQLite file directly. Lock contention from an accidental
second process remains loud; after active initialization, the owning
connection waits up to five seconds and then throws without a partial turn.

## Schema-upgrade discipline

Canonical evidence is the source of truth. Canonical tables migrate
additively inside a transaction: new nullable columns or new companion tables
are allowed, but an upgrade does not destructively rewrite retained dialogue,
change canonical evidence IDs, or reinterpret existing bytes. The
`author_id` migration follows that rule; old rows remain unattributed.

Indexes and projections are derived. Exact-quote/FTS annotations, semantic
vectors, and temporal graph tables may be dropped and rebuilt from visible
canonical evidence. Their scores, traversal state, or generated text never
become testimony merely because they are stored. Tombstones, scope identity,
canonical content and hashes, chronology, host receipt time, and reduction
lineage are not disposable indexes.

Back up before an upgrade and treat any migration exception as a failed open.
The package never catches a schema or lock failure and continues against an
unknown partial state.

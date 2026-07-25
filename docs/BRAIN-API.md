# Palari Brain active contract

This document describes the package root exported by `src/index.mjs`.
`docs/KERNEL-API.md` and `docs/KERNEL-CONTRACT.md` describe the preserved
v0.5-derived comparator, not the active chatbot path.

## Write path

`ingestChatTurn(brain, turn, { extractor, extractorId })`

The trusted host supplies:

- `userMessage` and `assistantMessage`: the only eligible evidence fields;
- `eventAt`: evidence time;
- `sourceMessageId`: stable turn identity;
- `palariId` and `userId`: required private scope;
- `retention`: `durable` or `ephemeral`.

Calling this method is the host's explicit storage decision. Omitted or
unknown retention fails before storage or writer use. `ephemeral` skips
canonical storage and the optional writer.

The two messages and all identity fields must be well-formed Unicode without
U+0000. Those values do not round-trip through the pinned SQLite TEXT driver,
so Palari Brain rejects them before storage instead of silently truncating or
rewriting canonical evidence.

`sourceTexts` may be supplied for accounting, but its content is never placed
in canonical storage or the writer request. Tool, web, source, system, and
developer messages have no field in this API and cannot enter through this
gate.

Scope, evidence time, source identity, retention, and the complete message
snapshot are validated before any writer call. For every nonempty durable
message, the host first commits one exact, untrimmed canonical row:

- `userMessage` → `user_message`;
- `assistantMessage` → `assistant_message`.

The row also carries private scope, role-specific source-message ID,
chronology, observation time, and a content hash. A turn manifest fixes the
presence, absence, bytes, and event time of both visible roles. Replaying that
exact snapshot is idempotent. Adding, removing, changing, or retiming either
role under the same source identity throws `SOURCE_MESSAGE_CONFLICT` before
the writer runs. After exact deletion, transport replay does not resurrect the
deleted message.

Canonical evidence lives in the active-only `dialogue_evidence` table. It is
not copied into the legacy FTS table.

### Optional derived index

If supplied, the extractor runs only after canonical evidence commits. It
receives `{ request, turn }`. Its structured result may select at most eight
exact quotes, each containing `quote`, `type`, `importance`, `confidence`, and
`fictional`.

The host verifies and links each selected quote:

- quote occurs only in `userMessage` → link to the user evidence;
- quote occurs only in `assistantMessage` → link to the Palari evidence;
- quote occurs in both → create two role-distinct index rows;
- quote occurs in neither → `dropped_quote_not_in_dialogue`.

The model cannot author canonical content, provenance, keywords, sharing,
speaker, or source kind. The index is a hint for possible future retrieval,
not memory authority. A missing writer, thrown error, malformed response,
empty response, omission, or response exceeding eight items never removes
canonical evidence. These outcomes appear in `indexStatus` and `indexReason`
while the durable ingest remains `completed`.

Result compatibility fields now refer to canonical evidence:

- `written`, `alreadyPresent`, `evidenceWritten`, and `memoriesWritten`;
- `memoriesSelected`, `indexSelected`, `indexWritten`, `indexStatus`, and
  `indexReason` describe the derived index.

New annotations live in a separate non-FTS table; they do not inherit legacy
lifecycle or lexical-search behavior.

`brain.listStatements(scope)` and `brain.listEvidence(scope)` both return
canonical evidence. `brain.listIndexEntries(scope)` exposes derived quotes for
diagnostics; recall does not depend on them.

## Sensitive content and local security

Canonical durable dialogue is stored byte-for-byte in plaintext SQLite. The
writer prompt's instruction to avoid passwords cannot protect that canonical
copy. A chatbot must mark password entry, private forms, or any other
non-retained surface `ephemeral`, and must obtain any consent required before
persisting or later sending the dialogue to an answer provider.

When the active path creates a new memory directory, it uses mode `0700`. It
enforces mode `0600` on its exact configured database path on every open,
including upgrades from the older store. It never chmods a pre-existing or
caller-supplied directory. The caller must make a custom existing
`memoryRootDir` private. Filesystem modes are not encryption at rest.
Deployments needing protection from a machine administrator or disk theft
need encrypted storage outside this package.

## Read path

`recallAllStatements(brain, { palariId, userId }, { maxChars })`

This reads every current canonical row in the exact private scope, orders it
by evidence chronology, and renders each complete message with evidence ID,
evidence kind, time, source-message ID, source kind, and speaker. A migrated
pre-upgrade quote is labelled `legacy_selected_quote`; it is never presented
as a reconstructed full message.

It performs no query matching. The question is not passed to storage.

The result status is:

- `empty`: the complete scoped set has no rows;
- `included`: every current scoped row is in the briefing;
- `capacity_exceeded`: the complete set would exceed `maxChars`; no partial
  briefing is returned.

The default is 100,000 characters. This is a product limit, not a provider
token estimate. It guarantees complete context only below that bound. A
semantic or time-aware retrieval layer above the bound requires separate
measurement; this implementation does not pretend that problem is solved.
Before loading message bodies, the active store measures the exact scoped
population and a conservative lower bound for its rendered size in one SQLite
read transaction. A population already over the bound returns
`capacity_exceeded` without materializing every row. In that early-refusal
case `requiredChars` is a proven lower bound; otherwise it is the exact
rendered character count.

`answerQuestion` calls the answer provider once only for `included`. It
returns an honest local absence for `empty` and never calls the provider for
`capacity_exceeded`. Its provider callback separates `systemInstruction`,
`memoryText`, and `questionText`; `prompt` remains a combined compatibility
rendering. Stored messages are untrusted data. Integrations should put
`systemInstruction` in a real system/developer role, place `memoryText` in an
untrusted data/user role, give the answer provider no tools or memory-write
access, and send `questionText` last.

When memory is nonempty, only the answer provider can determine semantic
absence. Providers should return an explicit boolean `abstained`; otherwise
the API reports `null`, not a guessed value.

## Speaker meaning and chronology

- A `user_message` row proves only that the user said the complete message.
- An `assistant_message` row proves only that Palari said it.

An assistant row is not evidence that the user believes, prefers, owns, or
did the thing stated. A later row from the same speaker may correct an earlier
one; both remain visible until explicitly deleted. Applying chronology is
answer-model behavior, not deterministic storage supersession.

## Forget path

`forgetMemories(brain, ids, { palariId, userId })`

Deletion accepts exact evidence IDs or exact derived-index IDs. The gate
resolves them only inside the specified `palariId AND userId` scope, deletes
the whole source-message evidence, and deletes every linked derived quote in
the same transaction. Missing, foreign, and already deleted IDs are skipped
without revealing their contents.

To prevent transport replay from restoring deleted evidence, the database
retains a content-free, role-scoped source-identity tombstone. Canonical turns
also retain their existing manifest, including content hashes. Deletion
removes the message body and derived quotes; it is not cryptographic erasure
of every item of metadata.

This minimal contract deletes a complete retained message. It does not yet
redact one fact from a multi-fact message. There is no string-topic deletion
or similarity-based destructive action.

## Upgrade and historical boundary

On first open, active exact-quote rows from the previous implementation are
carried into the evidence table as `legacy_selected_quote`. Text the old
writer omitted cannot be recovered retroactively. When the original source
message is replayed, every legacy quote must occur verbatim in the complete
message or the replay fails closed. A valid replay replaces the legacy
representation and carries its quote into the separate derived index.

The legacy SQLite store and FTS table remain for frozen comparator
reproducibility. Expired legacy rows are not migrated. New canonical and
derived rows never enter FTS, and the active read/delete path never queries
lexical retrieval. Frozen historical eval identities remain sealed; changing
active product bytes does not authorize running them or any successor.

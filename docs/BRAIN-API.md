# Palari Brain active contract

This document describes the package root exported by `src/index.mjs`.
`docs/KERNEL-API.md` and `docs/KERNEL-CONTRACT.md` describe the preserved
v0.5-derived comparator, not the active chatbot path.

## Write path

`ingestChatTurn(brain, turn, { extractor, extractorId })`

The turn must provide:

- `userMessage` and `assistantMessage`: the only two evidence fields;
- `eventAt`: evidence time;
- `sourceMessageId`: stable turn identity;
- `palariId` and `userId`: required private scope.

`sourceTexts` may be supplied for accounting, but it is never placed in the
writer request.

Scope, evidence time, source-message identity, and extractor identity are
validated before the extractor is called. A malformed turn therefore cannot
spend a writer request.

The extractor receives `{ request, turn }`. Its structured result can select
at most eight memories. Every memory contains exactly `quote`, `type`,
`importance`, `confidence`, and `fictional`.

The host performs the authority step:

- quote occurs only in `userMessage` → `user_message`;
- quote occurs only in `assistantMessage` → `assistant_message`;
- quote occurs in both → two separate rows, one for each truthful origin;
- quote occurs in neither → dropped as `dropped_quote_not_in_dialogue`.

The stored content is the exact quote. The model cannot author provenance,
rewrite the quote, create keywords, share a row, or submit external-source
content. Writes are append-only; there is no fuzzy deduplication or guessed
supersession.

Replaying the same scope, role-specific source-message ID, and exact quote is
idempotent: the existing row is reported in `alreadyPresent` and no new row is
written. This is exact transport identity, not similarity matching.

## Read path

`recallAllStatements(brain, { palariId, userId }, { maxChars })`

This reads every current dialogue memory visible to the exact scope, orders
the rows by evidence chronology, and renders each as a JSON record containing
its ID, time, source message, source kind, speaker, extractor, fictional flag,
type, and exact statement.

It performs no query matching. The question is not passed to storage.

The result status is one of:

- `empty`: the complete scoped set has no rows;
- `included`: every current scoped row is in the briefing;
- `capacity_exceeded`: the complete set would exceed `maxChars`; no partial
  briefing is returned.

The default is 100,000 characters. This is a product limit, not an estimate
of a provider's context window; callers should set it to their actual prompt
budget.

`answerQuestion` calls the answer provider once only for an `included`
briefing. It returns an honest local absence for `empty`, and it refuses to
call the provider for `capacity_exceeded`. When memory is nonempty, only the
answer provider can determine semantic absence. Providers should return an
explicit boolean `abstained`; otherwise the API reports `null`, not a guessed
value.

## Speaker meaning

- A `user_message` row is evidence that the user said the quote.
- An `assistant_message` row is evidence that Palari said the quote.

An assistant row is not evidence that the user believes, prefers, owns, or
did the thing stated. The briefing repeats that rule before the JSON records.
A later row from the same speaker may correct an earlier one; both remain
visible until explicitly deleted. Applying that chronology is answer-model
behavior, not a deterministic supersession claim by storage.

## Forget path

`forgetMemories(brain, ids, { palariId, userId })`

Deletion accepts exact IDs only. The gate deletes only current dialogue rows
owned by the requesting user inside the specified Palari scope. Missing,
foreign, shared-from-another-user, and already deleted IDs are skipped without
revealing their contents.

There is no string-topic deletion and no similarity-based destructive action.

## Compatibility boundary

The active implementation currently reuses the existing SQLite store for
migration compatibility. That compatibility layer still creates and
maintains its legacy FTS table, but the active write/read/delete path never
queries it, never exposes its query methods, and writes no retrieval
keywords. Frozen historical evals and their tests still exercise the old
lexical comparator directly.

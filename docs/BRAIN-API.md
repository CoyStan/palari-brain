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
observation time, and a content hash. A turn manifest fixes the presence,
absence, bytes, and event time of both visible roles. Replaying the exact
snapshot is idempotent. Adding, removing, changing, or retiming either role
under the same source identity throws `SOURCE_MESSAGE_CONFLICT` before model
use. After exact deletion, replay cannot resurrect the deleted message.

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

### Which limit actually binds

The 64-item figure is a ceiling, not a capacity. The binding constraint is
almost always the 24,000-character digest, because every retained support
costs roughly 330 characters — a 73-character evidence ID, a source message
ID, an observation time, a speaker label, and the quote itself.

Effective capacity is therefore `24,000 / mean rendered item size`:

| mean item | rendered supports | items that fit |
| --- | --- | --- |
| ~375 chars | 1 short quote, terse statement | ~64 (the ceiling) |
| ~600 chars | 1 typical quote | ~40 |
| ~1,470 chars | 4 accumulated supports | ~16 |

`npm run memory-bench` measures this directly and prints both numbers.

Two consequences matter for a reducer author:

1. **Terse statements buy items.** Spending the permitted 500 characters on
   every statement and quote exhausts the digest in roughly 16 items.
2. **Supersession accumulates.** Replacing an item carries its transitive
   quote lineage forward, so correcting one fact repeatedly grows that item
   by about 330 characters per correction and never sheds the old lineage.
   A long conversation that revisits the same facts can exhaust the
   character budget at a constant item count.

Use `input.utilization` to budget. It reports `items`, `itemsRemaining`,
`digestChars`, and `digestCharsRemaining`, all measured with the same
serializer that enforces the cap; `digestChars / items` gives the mean cost
of an item so far. Compact with `summarizes` before the budget is gone: a
response whose resulting state exceeds a limit is rejected in full.

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
- carries exact transitive quote lineage when replacing an item;
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

A missing, throwing, malformed, oversized, stale, or invalid reducer:

- does not roll back canonical dialogue;
- leaves the earlier digest unchanged;
- leaves the oldest unit pending;
- returns structured `reductionStatus`, `reductionReason`,
  `reductionPending`, and `reductionBlocked` fields from ingestion.

Later units do not skip the failed unit while it is still actionable.
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

### Quarantine

A unit that keeps failing is quarantined rather than blocking its scope
forever. After `maxAttempts` failures (default 3, overridable per call), or
on the first failure for a deterministic category such as
`REDUCER_INPUT_CAPACITY`, the unit leaves the actionable queue.

A quarantined unit stays `pending`, so its canonical evidence is never
recorded as reduced. What changes is that later interactions are no longer
stuck behind it. The gap is reported, never hidden:

- `digestStatus()` returns `blocked` and a `ready_with_gaps` status;
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

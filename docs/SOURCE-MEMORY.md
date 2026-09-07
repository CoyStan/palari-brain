# Versioned project sources

Palari can retain documents separately from dialogue and bind provisional claims
to exact source excerpts. Use `brain.sourceMemory({ palariId, userId })` on an
enabled brain. The workspace comes from that brain's store. All operations bind
the supplied user and Palari scope. The host must authenticate and authorize the
caller before creating or using this handle. Handles are capabilities, not an
identity provider; never give a model or untrusted client a write handle.

```js
const memory = brain.sourceMemory({ palariId: 'project', userId: 'owner' })
const source = memory.admitSource({
  id: 'approved-budget', title: 'Approved budget', kind: 'document',
  text: 'Approved budget: $25,000.', authority: 'approved',
  retention: 'durable', expectedVersion: 0,
})
memory.recordClaim({
  id: 'budget', topic: 'project-budget', statement: 'The budget is $25,000.',
  bases: [{ sourceId: source.id, version: source.version,
    quote: 'Approved budget: $25,000.', relation: 'supports' }],
})
const evidence = memory.recall('project-budget')
```

Admission requires explicit durable retention and well-formed text. Sources do
not become user speech, and existing dialogue `sourceTexts` remain ignored.
`authority`, `kind`, title and origin are host-supplied labels. Palari does not
infer approval, trust, or authorship from the content itself. No parser, crawler,
source connector, model extractor, embedding service, or network call is added.

## Version changes and dependent memory

`admitSource` uses `expectedVersion: 0` for a new ID and the current version for
an update. Every admitted update increments the version, including metadata-only
changes. A mismatched expected version rejects the write atomically. Source text
is the current version only; this API is not an archive of previous document
revisions. Keep archival revisions in the host source system if required.

`recordClaim` checks each cited source version, access state and exact contiguous
quote in a transaction. A claim has 1–20 distinct source bases. Each basis is
labelled `supports` or `contradicts`. These labels and the claim statement remain
provisional assertions supplied by the host or a host-reviewed extractor; exact
quotation alone does not verify their meaning.

A claim is fresh only if every dependency is current and active. `recall(topic)`
returns fresh claims for that exact topic, ordered by ID, up to 50, and reports
`truncated` if more exist. It does not perform semantic search or rank authority.
`staleClaimIds()` lists IDs needing reconsideration without returning their text.
Re-extract and explicitly call `recordClaim` to refresh a claim. Updating an
existing claim ID replaces its statement and bases atomically.

There is no mutable stale flag or propagation worker. SQLite checks the small
claim-to-source dependency table during reads. Claims cannot depend on other
claims, preventing recursive dependency cycles. This first API covers derived
claims, not automatic integration with the dialogue digest or external caches.

## Conflicts and repeated sources

`hasAlternatives` means the returned topic has different claim strings. It does
not prove a semantic contradiction. Contradicting evidence remains labelled in
`bases`; Palari never silently chooses the newest claim as truth.

`supportingOrigins` counts distinct origin IDs among supporting bases. Without
an explicit `originId`, exact source content hashes group identical copies. A
host may provide a shared origin for known adaptations. Different origin IDs do
not prove independence, and the count is not a confidence score. Authority labels
have no built-in ranking; an application may implement a documented policy.

## Revocation and forgetting

`revokeSource(id, expectedVersion)` increments the version and makes the source
inaccessible through this API. Dependent claims disappear from recall. Revocation
retains content in the local store; it is an access-state change, not deletion.
Host ACL changes must call this method for each affected stored scope, and the
host must continue to enforce authorization on every request. There is no live
connection to a remote document's permissions.

`forgetSource(id, expectedVersion)` also increments the version, clears the
source text and descriptive metadata, and deletes all claims that cite that
source, including their other bases. This conservative deletion avoids retaining
derived copies. Both operations report `dependentClaimIds` for host cache handling.
A tombstone retains scope, source ID, version and inactive state so reusing an ID
cannot revive an old citation. This is logical deletion, not secure disk erasure;
external copies, SQLite backups and previously returned answers are host-owned.

`readSource(id)` returns only an active current source, otherwise `null`.
`sourceStatus(id)` returns only its version and active flag, including tombstones,
so the host can resume updates after a restart without exposing revoked text. To
restore an inactive source, the host must explicitly admit a new version using
the version returned by revocation or forgetting.

## Answers from several sources

Import `answerFromSources` from `palari-brain/sources` and provide a source-memory
handle, exact `topic`, `question`, and injected `provider`. The provider receives
immutable provisional claims and their canonical excerpts, including source
labels, versions and evidence relations. It receives no source-writing tools.

Return `{ text, bases: [{ sourceId, version, quote }] }`. Each quote must be an
exact contiguous part of an excerpt supplied in this answer. There may be at
most 20 bases. Empty bases mean abstention. If there are no fresh claims, Palari
abstains without calling the provider. After the callback finishes, Palari
rechecks every supplied source version and access state, including uncited
context. A concurrent change rejects the answer; the host may retry against a
new snapshot. Changes after return still require host cache invalidation.

Answers use a frozen object with a null prototype to prevent inherited promise
hooks from replacing the checked result. The callback contract is separate from
existing dialogue answer providers. No automatic conflict resolver is claimed.

Run `npm run quickstart:sources` for an offline proposal/meeting/approval demo.
The scripted policy selects an explicitly host-labelled approval and abstains
when none is current. This verifies mechanics, not model reasoning accuracy.
Source text is limited to 200,000 characters; claim statements and quotes to
4,000. These bounds and exact-topic lookup keep the initial implementation small.

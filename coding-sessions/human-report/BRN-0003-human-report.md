# BRN-0003 Human Report

## Why This Mattered

A shared Palari must remember which authenticated member supplied a message
without confusing application membership policy with memory provenance. The
application also needs an honest persistence and concurrency boundary before
it can safely consume the brain as a local component.

## What Changed

The host may now stamp an optional opaque `authorId` on a durable user
message. The canonical gate stores it on user evidence and preserves it on
find, read, timeline, briefing, semantic, hybrid, graph, exact-quote, and
forget-residual outputs. Extractor and reducer model wires cannot author it,
and the original attribution remains part of immutable turn identity even
after the evidence body is forgotten. Existing callers that omit `authorId`
keep their prior observable row shapes.

The shared-scope contract is now explicit: the app may choose one existing
opaque `palariId AND userId` pair as a shared journal, but the app must
authenticate members and authorize every operation. The brain adds no roles,
membership, invite, ownership, or per-author deletion policy.

Local active stores use SQLite WAL and a five-second busy timeout. Multiple
handles opened sequentially inside one process are supported. Direct
multi-process ownership is explicitly refused; a service deployment must put
one owning process in front of the SQLite brain.

## What I Should Know

`authorId` is provenance, not proof that the caller was allowed to act. A host
that accepts an unauthenticated value would faithfully preserve bad
provenance. Palari replies have `speaker: 'Palari'` and no human `authorId`.
Language-based forgetting reports surviving mentions from every author in the
scope; the caller decides whether the deletion request itself is authorized.

The first independent review found three gaps: simultaneous process opens had
been over-promised, post-forget replay lost the author-conflict check, and a
graph extractor could submit an ignored forged author field. The contract now
refuses multi-process ownership, the manifest preserves the user author, and
graph forgery is rejected. No live provider, network, credential, dataset,
evaluation, publication, or spend was involved.

## What To Check

The six shared-consumer contracts cover unattributed compatibility, additive
migration, two authors plus cross-scope isolation, every retrieval surface,
extractor/reducer/graph forgery, post-forget re-attribution, cross-author
forget residuals, same-process concurrent ingestion, and a real independent
process holding the SQLite write lock for the full busy timeout. The adjacent
surface suite is 74/74. The complete repository suite is 650 pass, 0 fail,
15 skipped across 665 tests; quickstart is green and trust bench remains 5/5.

## Recommended Next Move

Have a second fresh reviewer verify the three repaired gaps and the narrowed
multi-process promise. If that review recommends acceptance, the founder may
accept and merge BRN-0003. Do not add application roles or membership policy
to this repository and do not run a live benchmark from this ticket.

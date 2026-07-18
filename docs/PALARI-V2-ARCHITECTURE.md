# Palari v2.0 — The Governed Stack Over Commodity Engines

Status: north-star architecture, commissioned by the founder
2026-07-18. This document GUIDES future development across all Palari
repos. It does not interrupt the current STATUS.md queue; queue
amendments derived from it follow the normal ratification path. It is
written to be self-standing: no other document is required to
understand it.

---

## 1. The thesis, once

Everything that can commoditize becomes a swappable engine.
Everything that makes the system trustworthy is Palari.

Palari already treats LANGUAGE MODELS this way: the model is a menu
entry; identity, memory, and authority live outside it; swapping
models requires passing a measured probe (SafeSwap), never faith.
Palari v2.0 applies the same law to the next layer down:

MEMORY BACKENDS ARE ENGINES TOO. Temporal knowledge graphs (Zep/
Graphiti-class), vector stores, provider-native memory, long-context
caching — these are converging, benchmark-racing commodities. v2.0
does not compete with them. It sits above them, makes them
interchangeable, governed, and accountable — and swaps them the way
it swaps models.

## 2. The two planes

### The commodity plane (adopted, swapped, never trusted)

- Language engines: any provider; entering/leaving via SafeSwap.
- Memory engines: recall indexes (FTS, temporal graph, vector,
  provider-native, long-context) — DISPOSABLE PROJECTIONS, see 3.
- Transport: an SDK-class provider layer (Vercel AI SDK line) for
  native tool calling, provider unification, usage accounting.
  Adopted as transport ONLY — its agent/orchestration layers are
  explicitly not used (they would collide with the authority plane).
- Peripheral engines: image, speech, transcription — bounded tool
  calls behind the action seam.

### The Palari plane (the product; never commoditized)

1. THE MEMORY JOURNAL — the single source of truth (section 3).
2. THE GATE — one admission path for every durable write: typed
   proposals, evidence thresholds, provenance required, fail-closed.
3. RECEIPTS — signed records of what was done, what the human was
   shown, who approved (the Palari Work Receipt Protocol).
4. BRIEFING — answer-time evidence organization: timeline-ordered,
   validity-annotated, source-attributed, calibrated abstention.
5. AUTHORITY — routing, review-before-consequence, execution
   packets, per-tool scoping, budgets with a presence floor.
6. MEASUREMENT — case banks, paired probes for every substitution,
   pre-registered predictions, replay harnesses over recorded
   exchanges, honest failing-first reporting.
7. IDENTITY & SUCCESSION — portable persona core, method corpus,
   measured handoffs.

## 3. The Memory Journal (the load-bearing decision)

Event sourcing applied to memory. Per user/workspace, one
append-only journal file containing:

- every admitted memory atom (content, type, confidence, validity
  window, full provenance: pipeline, source, extractor model,
  confidence-at-creation);
- every gate decision (admitted, refused, superseded, deleted) with
  its reason;
- references to raw session segments (raw is DATA: retained for
  governed re-extraction, never injected directly into answers).

Properties the journal alone guarantees, independent of any engine:

- OWNERSHIP: it is a file. The user can read it, export it, take it.
- PORTABILITY: merkle-root fingerprint; signed export; move between
  deployments and engines without loss.
- PROVABLE DELETION: deletion removes journal entries, then every
  projection is REBUILT from the journal; diff proves the forgotten
  fact is gone everywhere. No other memory architecture can prove
  right-to-forget. This is an enterprise feature, not hygiene.
- AUDIT: the journal IS the consent/authority record; receipts
  reference journal states by hash.

## 4. Memory engines as disposable projections

Every recall backend is a MATERIALIZED VIEW rebuilt from the journal:

    journal --replay--> driver.build(index)
    query   --------->  driver.recall(q, atTime) -> candidates
    candidates -> BRIEFING (Palari plane) -> engine prompt

Driver interface (sketch):

    build(journalStream) -> index          // full rebuild, idempotent
    apply(journalEvent)  -> index'         // incremental
    recall(query, {atTime, scope, k})      // candidates + per-item
                                           // journal refs (provenance
                                           // survives the driver)
    profile() -> {                         // the compliance matrix
      temporalQueries: bool,               // validity-window support
      deletionProvable: bool,              // rebuild-diff clean?
      residency: local|cloud,              // where user data sits
      portability: file|export|none,
      injectionExamScore: number|untested,
    }

Planned drivers, in order: sqlite-FTS (reference, local, fully
compliant), temporal-graph (Zep/Graphiti-class — buys the measured
+15pt temporal advantage as an INDEX, not a dependency for truth),
hybrid vector (sqlite-vec, stays inside the user's file),
provider-native memory (convenient; profile marks portability
losses), long-context (no index: cached transcript + journal
anchors; profile marks deletion as UNPROVABLE — cached transcripts
cannot forget).

DRIVER CHANGES ARE SUBSTITUTIONS. A driver enters or leaves behind a
paired probe on the memory bank + the injection exam: decline-only,
flips named, mock arms refuse. SafeSwap, one layer down.

## 5. Certification: the position this buys

With the interface + the exam, this repo stops being a contestant
and becomes the CERTIFYING BODY: every driver is scored on the same
governed harness — recall benchmarks (LongMemEval-class) AND the
injection-resistance section that no current leaderboard tests.
Published output: one trade-off table per driver — recall vs
temporal reasoning vs deletion-provability vs residency vs injection
resistance. Palari does not need to win the recall column; it needs
to be the row-owner of the table.

## 6. How the existing repos converge

- palari-v05 (Sofia): first product ON the stack — its memory
  becomes journal + sqlite driver; its harness becomes commodity
  transport + Palari authority plane.
- palari-company-os: the same governance at the human-work seam
  (write boundaries, proof-carrying acceptance); shares the receipt
  format.
- palari-brain (this repo): journal spec, driver interface,
  reference driver, certification harness, injection exam.
- The Palari Work Receipt Protocol: the interchange format binding
  all of it.
- The Unified Specification (the book): the law. This document is
  its Part-4/5/9 discipline extended to memory backends; where they
  conflict, the spec is amended by ceremony, not silently.

## 7. Development guidance (what to build, in what order)

NEAR (current queue continues): U8 baseline on current kernel ->
grade predictions -> journal extraction (fuse raw ledger + atom
store into the append-only journal) -> driver interface -> sqlite
reference driver -> replay harness over journal events.

MID: temporal-graph driver (the +15pt move) -> hybrid driver ->
transport adoption (AI SDK 7 line; Node>=22 precondition; transport
only) -> injection exam published (U11) -> deletion-proof demo (the
flagship demo: forget a fact, rebuild, prove absence everywhere).

FAR: provider-native and long-context drivers with honest profiles
-> certification program public -> v05 migrated onto the stack ->
LongMemEval submission with the trade-off table.

## 8. What v2.0 refuses to build

- Its own vector database, graph store, or model. Commodities.
- Ungoverned write paths, however convenient, however temporary.
- Recall-score chasing detached from the trade-off table.
- SDK agent/orchestration layers in place of the authority plane.
- Any feature that cannot name its verification surface.

## 9. Falsifiers (how we will know v2.0 is working)

1. A driver swap passes a paired probe with zero governance
   regressions — demonstrated, not asserted.
2. The deletion-proof demo runs end to end: forget -> rebuild ->
   diff clean across every active driver.
3. Temporal-graph driver closes the temporal category gap to
   Zep-tier on the harness.
4. The injection exam scores at least one commodity engine and
   this stack side by side, published failing-first.
5. A user exports their journal from one deployment and resumes on
   another with a different driver, memory intact.

If 1-2 fail, the journal design is wrong. If 3 fails, the driver
thesis is wrong. If 4-5 never happen, this was a vision document
and not an architecture. Grade accordingly.

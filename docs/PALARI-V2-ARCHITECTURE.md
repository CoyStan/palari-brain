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

1. THE GOVERNED MEMORY BUNDLE — canonical decisions and erasable atom
   payloads in the user's workspace file; future indexes are projections
   (section 3).
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

## 3. The governed memory bundle (the load-bearing decision)

Event-sourced governance applied to memory, with claims separated by
what is actually proven. Per workspace, the user's existing SQLite file
becomes a governed bundle containing:

- append-only **content-free decision events**: typed operation,
  outcome, closed reason code, scope, authority, evidence class, target
  id, and times;
- **canonical atom payloads**: content, type, confidence, provenance,
  and validity data, immutable while present and governedly erasable;
- later, disposable recall projections rebuilt from canonical state.

This separation resolves a contradiction in the original north star: a
content-bearing log cannot be both literally append-only and physically
forgetful. Palari keeps the non-content fact that a governed decision
occurred while permitting the canonical payload to be removed.

Capability claims are phased:

- M1 proves same-file ownership, atomic coexistence, content-free
  decisions, logical current-state deletion, deterministic replay, and
  memory-id non-reuse. It is explicitly not runtime truth.
- M2 may cut the gate and projections onto one caller-owned SQLite
  transaction, after every semantic write bypass is closed.
- Later deletion certification must test SQLite freelists, WAL/journal
  sidecars, backups, exports, caches, and active drivers before using
  `deletionProvable:true`.
- Merkle roots, signatures, signed exports, cryptographic erasure, and
  external anchoring are future capabilities, not present-tense claims.

Raw session history remains DATA, not memory. A future raw ledger may be
referenced by governed identifiers, but it is not part of M1 and is never
injected directly into answers.

## 4. Memory engines as disposable projections

Every recall backend is a MATERIALIZED VIEW rebuilt from verified
canonical bundle state:

    governed bundle --replay--> driver.build(index)
    query            ---------> driver.recall(q, atTime) -> candidates
    candidates -> BRIEFING (Palari plane) -> engine prompt

M1 proves only the bundle substrate and current-state replay. The driver
interface below remains a later target until the existing gate and
projection mutations share one atomic transaction.

Driver interface (sketch):

    build(canonicalStream) -> index        // full rebuild, idempotent
    apply(canonicalEvent)  -> index'        // incremental
    recall(query, {atTime, scope, k})      // candidates + per-item
                                           // canonical bundle refs
                                           // (provenance survives driver)
    profile() -> {                         // the compliance matrix
      temporalQueries: bool,               // validity-window support
      deletionProvable: bool,              // rebuild-diff clean?
      residency: local|cloud,              // where user data sits
      portability: file|export|none,
      injectionExamScore: number|untested,
    }

Planned drivers, in order: sqlite-FTS (reference, local, targeting full
compliance; profile remains untested until M4-M5), temporal-graph
(Zep/Graphiti-class — buys the measured
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
- palari-brain (this repo): governed-bundle contract, later driver
  interface, reference driver, certification harness, injection exam.
- The Palari Work Receipt Protocol: the interchange format binding
  all of it.
- The Unified Specification (the book): the law. This document is
  its Part-4/5/9 discipline extended to memory backends; where they
  conflict, the spec is amended by ceremony, not silently.

## 7. Development guidance (what to build, in what order)

NEAR — local falsification before any more spend:

1. M1 governed-bundle coexistence substrate: content-free decisions,
   erasable canonical atoms, strict authority matrix, deterministic
   verify/replay, and same-file CDX-M1 coexistence. Runtime unchanged.
2. M2 one-connection mutation seam: gate resolution plus canonical and
   projection mutations in one caller-owned transaction; close every
   durable bypass before source-of-truth cutover.
3. M3 gate repair and candidate receipts: strict extraction schema,
   safe authority fields, typed assistant evidence, wider ordinary-user
   evidence coverage, corrected supersession, and complete outcome
   observability.
4. M4 temporal SQLite reference driver: effective/observed time and
   `recall(..., atTime)` proven before graph/vector adoption.
5. M5 deletion-proof demo over the explicitly tested storage surfaces.
6. M6 driver substitution with a mock second driver and paired probes.

MID: temporal-graph and hybrid drivers only after the local reference
semantics and substitution harness pass; then injection certification
and honest profile tables. Transport adoption remains orthogonal and is
not a prerequisite for memory correctness.

FAR: provider-native and long-context drivers with honest profiles,
portable export/import, v05 migration, public certification, and
LongMemEval-class reporting only after founder publish/spend gates reopen.

## 8. What v2.0 refuses to build

- Its own vector database, graph store, or model. Commodities.
- Ungoverned write paths, however convenient, however temporary.
- Recall-score chasing detached from the trade-off table.
- SDK agent/orchestration layers in place of the authority plane.
- Any feature that cannot name its verification surface.

## 9. Falsifiers (how we will know v2.0 is working)

1. M1 initializes, verifies, replays, logically deletes, and survives
   transaction rollback beside a real unchanged CDX-M1 workspace.
2. M2 commits a governed decision and every affected projection row on
   one connection and one transaction; forced failures leave neither.
3. The deletion-proof demo runs end to end over every surface named in
   its capability profile: forget -> rebuild -> residue diff clean.
4. A driver swap passes paired memory-bank and injection probes with zero
   governance regressions.
5. A temporal driver measurably improves temporal categories without
   weakening scope, deletion, or injection behavior.
6. A user exports governed canonical state from one deployment and
   resumes on another with a different driver, memory intact.

If 1 fails, the bundle substrate is wrong. If 2 fails, the source-of-
truth cutover is wrong. If 3 fails, deletion claims stay false. If 4-5
fail, the disposable-driver thesis is wrong. If 6 never happens, the
portability claim remains a vision. Grade accordingly.

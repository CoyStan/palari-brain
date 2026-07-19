# Kernel Contract (distilled from the Unified Specification, Parts 4-5)

This is the normative core the kernel must satisfy, compressed for an
agent working in this repo. The full spec (with evidence tags and
rationale) is linked in REFERENCES.md; where this file and the spec
disagree, the spec wins and this file gets fixed.

**V2-M1 precedence:** this contract continues to govern the current
CDX-M1 runtime. `docs/MEMORY-BUNDLE-CONTRACT.md` governs only the new
non-authoritative coexistence substrate. M1 introduces no second runtime
write door and changes no lifecycle, visibility, sharing, deletion,
retrieval, or gate behavior. The current CDX-M1 implementation is not yet
fully conforming to the one-gate law: exported raw extraction/session-
summary helpers, ownership deletion/topic-forget, lifecycle,
recall-inclusion, and internal link mutations remain durable bypasses
recorded for V2-M2. They are defects, not normative exceptions.
A later cutover must close them and preserve every law here while
committing canonical and projection mutations on one transaction.

## Memory atoms (Part 4)

- An atom carries: content, type, importance, confidence, provenance
  (creating pipeline, source id, extractor, confidence-at-creation),
  scoping (palari_id required; user_id nullable = general; shared
  flag), content hash, timestamps. Evidence-time discipline: applied
  state is stamped from provenance time, never wall clock.
- Types partition into permanent (linear: never mutated; correction =
  demote-and-promote with a link, counterfactual history survives)
  and transient (use-or-decay; supersession is type-safe).

## The one gate (Part 4 — the load-bearing law)

- Every durable mutation arrives as a typed proposal through
  Admit -> Resolve -> Apply. No producer writes directly.
- Admission thresholds order: demote < promote < permanent < ratify.
  Destructive direction is cheap; authority direction is ceremonial.
- Source/tool/web-derived content MUST NOT mint memories without the
  gate's provenance marking; user-visible surfacing of external-origin
  memories shows origin. (This is the injection boundary — tested,
  not promised. See palari-v05 CASE-memory-source-injection-minting
  for the real-world failure this guards.)

## Retrieval (Part 5)

- Default pipeline is FTS + structured filters + (optional) graph
  walk. No vector store in the default path; extensions are optional
  planes, never silent replacements.
- Retrieval is type-blind for ranking; scoping filters (palari, user,
  validity) are mandatory predicates, not conventions.
- Window laws: sources that match are opened; no composing from an
  empty desk; needle survival into the final prompt is measured, not
  presumed.

## Briefing (answer-time evidence organization)

- Recalled memories enter the prompt as dynamic, labeled context —
  never as system authority, never as hidden claims.
- Briefing v1 format: per-memory line with content, timestamp
  (event-time vs observed-time when they differ), session/source
  attribution, and confidence bucket. This is the surface LongMemEval
  iteration will tune (U9) — format changes are substitutions:
  paired runs only.

## Honesty behaviors (scored, not decorative)

- Absence: when recall is empty or below confidence, the answer says
  so plainly. Abstention with correct grounds scores as success in
  our reports even where a benchmark scores it neutral.
- Updates: newer user assertions supersede older ones at answer time;
  superseded values are not confidently recalled.
- The kernel never invents a memory to satisfy a question.

## Deletion & ownership

- Individual deletion removes the row and its FTS/link residue.
- Topic-forget removes matching visible rows for the requesting
  user/palari scope only.
- The store is a per-workspace SQLite file: portable, inspectable,
  deletable as a unit.

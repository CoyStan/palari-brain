# Restructure Proposal: Competing With 2026 Memory Frameworks

Status: PROPOSED by Fable (design lane) after adversarial review
against current literature. Founder ratification required before the
STATUS.md queue absorbs these units. The standing agent may read
this but MUST NOT reorder the queue until the founder rules.

## Verdict this responds to

As currently queued (FTS-only, gate with no fallback), the kernel
would post well below Zep-tier (63.8%) on LongMemEval, dominated by
temporal categories (Zep's Graphiti validity-window graph = +15pts
over Mem0) and paraphrase recall (all leaders run hybrid retrieval).
Every fix below is an extension plane the Unified Specification
already permits. Target: Zep-tier recall + the injection-resistance
section nobody else has. Not targeted: Hindsight-class headline
numbers from the config wars.

## The five layers

- L0 RAW SESSION LEDGER (new): append-only per-workspace raw log.
  Classified DATA, never memory: never injected, never answer-searched.
  Sole role: re-extraction source. Kills the unrecoverable
  write-time miss while preserving the one-gate law.
- L1 ATOM STORE (keep): governed SQLite per workspace, unchanged.
- L2 TEMPORAL VALIDITY (implement the spec's four-times record):
  maintain (vf, vu) on every atom; supersession CLOSES windows;
  answer-time queries filter "valid at T". Highest ROI unit; aims
  at LongMemEval's five temporal complexity levels.
- L3 HYBRID RETRIEVAL (config plane): FTS + local embeddings
  (sqlite-vec, inside the portable file) as parallel candidate
  generators, union + rerank. Product default stays FTS-only;
  benchmark config enables hybrid. "No-vector-DEFAULT" preserved.
- L4 SECOND-CHANCE RECALL: on empty/low-confidence recall, bounded
  targeted re-extraction over L0 for the question at hand, gated
  and provenance-marked. Curated-first with governed fallback.
- L5 BRIEFING V2: timeline-ordered, validity-annotated,
  session-attributed evidence; calibrated abstention. Iterated via
  paired slices only.

Write path: benchmark config uses a stronger extraction model
(extraction quality bounds the whole store; record model identity
in provenance).

## Unchanged on purpose

Gate, provenance, deletion + residue cleanup, per-workspace file
portability, injection boundary (U11 remains the contribution),
founder spend/publish gates.

## Proposed queue amendment (on ratification)

Insert after U5: U5a raw ledger (L0), U5b temporal validity (L2),
U5c hybrid retrieval config (L3), U5d second-chance recall (L4).
Fold L5 into existing U9. Add to predictions file: the seven
adversarial predictions from the design-lane review, pre-registered
before the first scored run.

## Honest residual risks

Solo-maintainer benchmark treadmill (LongMemEval-V2 already out);
leaderboard config wars make comparisons noisy; publish framing
must lead with the trade-off curve (recall vs contamination
resistance vs deletability), not the horse race.

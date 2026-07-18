# Adversarial Review: The Case Against This Kernel

Status: commissioned by the founder before the first scored run
("criticize it, argue against it, why will it fail"). Recorded in
full so the first results are graded against a hostile prior, not a
hopeful one. Companion: RESTRUCTURE-PROPOSAL.md (the response) and
evals/predictions.md (the gradeable form of this document).

## The prosecution (seven arguments)

1. TEMPORAL GRAPH GAP. The largest measured discriminator on
   LongMemEval is temporal architecture: Zep/Graphiti's
   fact-validity windows post 63.8% vs Mem0's 49.0% (+15pts
   attributed to temporal retrieval). This kernel as queued answers
   with FTS over flat rows; the spec's four-times record is
   specified, not built. LongMemEval-V2 tests five temporal
   complexity levels up to 1.5M-token conversations.
2. LEXICAL RETRIEVAL. FTS5 misses paraphrase ("my supervisor" /
   "el jefe" / "the manager"); benchmark questions paraphrase
   aggressively; every current leader runs hybrid graph+vector.
3. THE GATE IS A RECALL TAX. Auto-retain hoarders keep the casual
   mention that becomes tomorrow's question; the admission gate
   filters it as low-confidence noise, and with no raw fallback a
   write-time miss is unrecoverable at read time. Hindsight claims
   94.6%; a governed debut in the 40s writes the headline
   "governance costs fifty points."
4. EXTRACTION BOTTLENECK. Memory quality is bounded by write-time
   understanding; extraction runs on the cheapest model class, and
   sibling-repo history shows this plumbing can fail silently
   (palari-v05 APP-0625/0626: preview tools produced zero artifacts
   for a week of merges).
5. THE CATHEDRAL PROBLEM. Heavily specified cognitive architectures
   (SOAR, ACT-R lineage) historically lose to scruffy benchmark-tuned
   iteration; funded teams ship weekly; long-context + prompt caching
   eats the category from below every model generation.
6. LEADERBOARD POLITICS. The Mem0-vs-Zep score war (58.44% vs
   publicly rebutted 75.14%, alleged misconfigurations) shows this
   is a config-war leaderboard. An honest pre-registered number
   debuts against tuned ones and skimming readers cannot tell
   honesty from inferiority.
7. YAGNI. No user asked for merkle-signed portability; injection
   resistance could be approximated far more cheaply; this is
   Stage-3 governance built before Stage-1 product-market fit.

## The defense's answers (what survives)

- 1 and 2 are real and are already-permitted extension planes:
  temporal validity is the spec's own four-times record; hybrid
  retrieval is a Part-5 extension. See RESTRUCTURE-PROPOSAL L2/L3.
- 3 dies to second-chance recall over a governed raw ledger
  (L0/L4): curated-first, raw-fallback, everything still gated.
- 4 is answered by stronger extraction models in benchmark config
  plus re-extraction; the silent-failure history is why the replay
  harness pattern is mandatory here from day one.
- 5 and 7 are answered by one recorded fact: the gate caught a real
  injection minting a real memory (palari-v05
  CASE-memory-source-injection-minting) — a bug class auto-retain
  architectures cannot even express. Deletion rights inside a
  cached 1.5M-token transcript are impossible; enterprises need
  audit + deletion; that is this kernel's ground.
- 6 is answered by framing: do not enter the horse race. Publish
  the trade-off curve (recall vs contamination-resistance vs
  deletability) and the injection-resistance section (U11) as the
  contribution.

## Sources

- LongMemEval-V2: arxiv.org/pdf/2605.12493
- Benchmark landscape: mem0.ai/blog/ai-memory-benchmarks-in-2026
- Framework tests: particula.tech/blog/agent-memory-frameworks-tested-mem0-zep-letta-cognee-2026
- Architectures 2026: maidul-haque.vercel.app/blog/agent-memory-architectures-2026/
- EverMind roundup: evermind.ai/blogs/top-ai-memory-systems-benchmarked-in-2026

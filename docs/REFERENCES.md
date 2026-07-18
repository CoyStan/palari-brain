# References

## Normative spec (the book)

- The Palari Brain — Unified Specification (LaTeX source + built PDFs):
  https://github.com/CoyStan/palari-v05/tree/claude/palari-brain-adoption-staging/docs/spec-palari-brain
  - Part 4 Memory: parts/04-memory.tex
  - Part 5 Retrieval & Context: parts/05-retrieval-context.tex
  - Part 13 has the temporal record (four-times) and transient rules
  - Screen PDF: docs/spec-palari-brain/output/pdf/palari-brain-unified-specification-screen.pdf
- Adoption staging (stage vs evidence discipline):
  same tree, parts/92-appendix-adoption-stages.tex and STAGING-PROPOSAL.md
- PR #4 (spec into main, pending): https://github.com/CoyStan/palari-v05/pull/4

## Implementation to extract (palari-v05 @ baseline 190a4ad2)

- apps/palari-local-workbench/scripts/workspace-backend/memory-store.mjs
- apps/palari-local-workbench/scripts/workspace-backend/memory-extraction.mjs
- apps/palari-local-workbench/scripts/workspace-backend/memory-briefing.mjs
- apps/palari-local-workbench/scripts/workspace-backend/private-memory.mjs
- tests: apps/palari-local-workbench/tests/backend/memory-*.test.js (6 files)
- memory canary runbook (deletion/isolation semantics as operated):
  docs/agent/internal-alpha-memory-canary-runbook.md
- replay-harness pattern to imitate for provider-free testing:
  APP-0626 (coding-sessions/reports/APP-0626-technical-report.md)
- injection incident this kernel must make impossible:
  docs/agent/case-queue/CASE-memory-source-injection-minting.md

## Sibling repo

- palari-company-os (write boundaries, proof-carrying acceptance):
  https://github.com/CoyStan/palari-company-os

## Benchmark

- LongMemEval — VERIFY canonical repo/paper and license during U6
  before downloading anything; record the verdict in DECISIONS.md.
  (Believed: github.com/xiaowu0162/LongMemEval + an ICLR paper;
  the agent must confirm rather than trust this note.)
- Shadow-Weave/HMS — third-party harness around LongMemEval; useful
  as prior art for answer-time evidence organization; do NOT adopt
  its auto-retain middleware pattern (violates the one-gate law):
  https://github.com/Shadow-Weave/HMS

## Open items for the founder (DECISIONS.md tracks these)

- LICENSE for this repo (recommendation: MIT, matching company-os).
- Spend gates: each live run.
- Publish gate: any public score.

## Competitive & benchmark literature (added 2026-07-18)

- LongMemEval-V2 paper: https://arxiv.org/pdf/2605.12493
- Benchmark landscape (LoCoMo/LongMemEval/BEAM):
  https://mem0.ai/blog/ai-memory-benchmarks-in-2026
- Framework head-to-heads (Mem0/Zep/Letta/Cognee):
  https://particula.tech/blog/agent-memory-frameworks-tested-mem0-zep-letta-cognee-2026
- Agent memory architectures 2026:
  https://maidul-haque.vercel.app/blog/agent-memory-architectures-2026/
- Zep/Graphiti temporal knowledge graph: the +15pt temporal
  discriminator this repo's L2 answers.
- In-repo: docs/ADVERSARIAL-REVIEW.md (the case against, recorded),
  docs/RESTRUCTURE-PROPOSAL.md (the five-layer answer),
  evals/predictions.md (the gradeable form).

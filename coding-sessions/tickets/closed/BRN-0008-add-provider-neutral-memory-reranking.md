---
id: BRN-0008
title: "Add provider-neutral memory reranking"
stream: memory
level: 1
parent_id: 
root_id: BRN-0008
children: []
status: accepted
risk: R2
priority: P0
agents_allowed: 1
claimed_by:
claimed_at:
target_branch: "main"
branch: "ticket/BRN-0008-add-provider-neutral-memory-reranking"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0008-add-provider-neutral-memory-reranking"
allowed_paths:
  - "src/brain.mjs"
  - "src/retrieval-answer.mjs"
  - "src/reranker-transformers.mjs"
  - "src/index.mjs"
  - "tests/retrieval-answer.contract.test.mjs"
  - "tests/reranker-transformers.contract.test.mjs"
  - "tests/reranker-bakeoff.contract.test.mjs"
  - "evals/reranker-bank.mjs"
  - "evals/run-reranker-bakeoff.mjs"
  - "evals/predictions.md"
  - "package.json"
  - "package-lock.json"
  - "docs/BRAIN-API.md"
  - "docs/DECISIONS.md"
  - "STATUS.md"
  - "coding-sessions/tickets/open/BRN-0008-*.md"
  - "coding-sessions/tickets/closed/BRN-0008-*.md"
  - "coding-sessions/reports/BRN-0008-*.md"
  - "coding-sessions/human-report/BRN-0008-*.md"
  - "coding-sessions/handoffs/BRN-0008-*.md"
forbidden_paths:
  - ".env"
  - ".env.*"
  - "*.key"
  - "**/*.key"
  - "secrets/**"
  - "**/secrets/**"
  - "*secret*"
  - "**/*secret*"
  - "*token*"
  - "**/*token*"
  - "infra/prod/**"
  - "prod/**"
  - "runtime-data/**"
  - ".palari-probe/**"
  - ".palari-regression/**"
  - "data/**"
  - "evals/results/**"
requires_human_confirmation: false
requires_review: true
verification:
  - "node --test tests/retrieval-answer.contract.test.mjs tests/reranker-transformers.contract.test.mjs tests/reranker-bakeoff.contract.test.mjs"
  - "npm run reranker-bakeoff"
  - "npm test"
  - "npm run quickstart"
created: 2026-08-03
updated: 2026-08-04
---

# BRN-0008 Add provider-neutral memory reranking

## Goal

Add a bounded, provider-neutral second-stage reranker to `memory_search` so a
small set of canonical messages is ordered by query-to-message relevance after
the existing ranked/semantic RRF candidate generation. Measure three pinned,
local, Apache-2.0 ONNX cross-encoders once on a preregistered heterogeneous
bank, and select only a latency/quality Pareto winner. Keep Gemini embeddings,
canonical evidence, provenance, and the answer provider unchanged.

## Context And Authority

BRN-0007's question `09d032c9` retrieved its required answer-bearing session
and placed the direct user statement about a new portable power bank at RRF
rank 3, but returned 29 messages across two searches and Luna produced generic
battery advice without using that fact. The same case previously failed with
Gemini, identifying a provider-neutral evidence-salience/use problem rather
than a missing-memory or provider-wire problem. On 2026-08-03 Quetzali asked
whether stronger open reranking code already exists, then explicitly approved
adapting the researched pattern.

The design is adapted, not copied, from these upstream retrieval patterns at
the exact inspected commits:

- Graphiti `899cb40d043b3f085917a69d95f26ed5ea24f411` (Apache-2.0): hybrid
  retrieval followed by RRF/MMR or an optional cross-encoder, including BGE.
- Mem0 `6e6f5b8d59e9d59c2223ce7d0f0d28caa8218b31` (Apache-2.0): separate
  embedder and reranker factories over multi-signal candidates.
- Qdrant FastEmbed `0892291f75a2c1de3ae263d5733959fd75f65351`
  (Apache-2.0): local ONNX cross-encoder inference.
- Transformers.js `353007be131c2e44d16d46ba49b9a56f2955dfd8`
  (Apache-2.0): Node-compatible ONNX execution.
- Mixedbread rerank `8e709dca09e0fdba6bc7f6d4983940fdd1b783c5`
  (Apache-2.0): small dedicated relevance rerankers.
- FlagEmbedding `7ed43d67ec03fbe5c31c0992dbfa941fb1860549`
  (MIT): retrieve-then-rerank guidance and stronger multilingual alternatives.

No upstream source code is copied. Model weights are external adapted data:
their origin, revision, license, and cache boundary must be recorded before
download, and no model or benchmark result bytes may enter git.

### Founder-Directed Ettin Reopening

After the original three-model result and two independent reviews were
committed, Quetzali explicitly declined the measured MiniLM-L6 default and
directed Palari to use the newer local Ettin family. This reopens the ticket;
it does not rewrite, rerun, or discard P-set 22 or any of its three terminal
results. The bounded successor comparison adds only
`cross-encoder/ettin-reranker-17m-v1` at the exact Apache-2.0 revision
`9e4aa35321a6dd1a43ca313f500c4b4f7cfb5cc6`. Hugging Face's published fp32
CPU table reports 267.4 pairs/second for Ettin-17M versus 143.9 for MiniLM-L6,
and its English retrieval table reports higher quality. Those upstream
figures are a prediction source, not Palari evidence; local compatibility and
the frozen Palari bank remain decisive.

## Scope

- Add one optional `reranker(query, canonicalTexts)` capability to
  `createPalariBrain`. The host validates a finite score for every candidate;
  reranker output can reorder evidence but cannot author, remove, or mutate
  canonical content or provenance.
- Preserve current ranked + Gemini-semantic RRF as broad candidate generation.
  Rerank a bounded RRF pool only after every row is read back from the
  canonical journal, then apply the caller's existing `limit` and `maxChars`.
- Expose whether reranking ran plus candidate count and per-result locating
  score. Without a reranker, behavior and response shape remain compatible.
- Add a local Transformers.js adapter with exact model/revision allowlisting,
  lazy loading, bounded query/document sizes, batch limits, and dependency
  injection for provider-free tests. The audited runtime remains an optional
  consumer-owned dependency; model cache lives outside git.
- Before any comparative score is produced, freeze an exact synthetic bank,
  metrics, model revisions, latency method, selection rule, and predictions in
  `evals/predictions.md`. Cases must span possessions, preferences,
  corrections, prior-Palari advice, temporal distinctions, conflicts,
  irrelevant lexical distractors, and honest absence; no product branch may
  mention a benchmark question ID, battery, or power bank.
- Run exactly one recorded offline pass for each of these Apache-2.0 models:
  `cross-encoder/ms-marco-MiniLM-L6-v2` at
  `c5ee24cb16019beea0893ab7796b1df96625c6b8`,
  `cross-encoder/ms-marco-MiniLM-L12-v2` at
  `7b0235231ca2674cb8ca8f022859a6eba2b1c968`, and
  `mixedbread-ai/mxbai-rerank-xsmall-v1` at
  `b5c6e9da73abc3711f593f705371cdbe9e0fe422`.
- Preserve those three terminal results, then run one compatibility smoke and
  exactly one recorded offline bank pass for
  `cross-encoder/ettin-reranker-17m-v1` at
  `9e4aa35321a6dd1a43ca313f500c4b4f7cfb5cc6`, after a new prediction block and
  the amended adapter/runner identity are committed and pushed. The smoke uses
  generic text outside the bank and is not an authority to retry the bank.
- Choose a default only if it is on the preregistered quality/latency Pareto
  frontier and passes every safety/shape contract. Otherwise ship the seam
  without a default and report the finding.
- Document the optional dependency, cold-start/cache cost, licensing,
  provenance, fallback/terminal behavior, and measured result. Obtain fresh
  independent review before founder acceptance.

## Out Of Scope

- No Gemini embedding replacement, new vector database, graph rewrite,
  generation-model call, answer-prompt tuning, extra answer/verification call,
  durable write-path change, or relaxation of canonical provenance.
- No live provider request, credential read, paid spend, LongMemEval execution,
  rerun/regrade of any sealed identity, access to sealed U8, or publication.
- No model fine-tuning, prompt tuning against known benchmark answers,
  threshold sweep, repeated timing run selected for presentation, or claim
  that a synthetic reranking bank establishes end-to-end answer accuracy.
- No addition of `@huggingface/transformers` to Palari's dependency graph.
  An install audit of 4.2.0 exposed five high-severity direct/transitive
  findings (including ONNX archive and Sharp/libvips paths), so the recorded
  bakeoff runs in an isolated untracked runtime and ships no vulnerable
  package transitively.
- No Ettin-32M, Ettin-68M, language expansion, runtime replacement, old-model
  rerun, or second Ettin bank pass. Those require a separate successor.
- No vendored model weights or cache files in git. No BGE model download in
  this ticket: the inspected community ONNX conversion does not carry a clear
  license field, and the upstream 0.6B model is outside the low-latency trial.

## Acceptance Criteria

1. Existing no-reranker callers retain RRF ordering, tool schema, bounded
   retrieval, provenance, and provider behavior; quickstart stays 6/6.
2. With a reranker, `memory_search` passes an immutable ordered list of complete
   canonical texts, accepts exactly one finite score per row, deterministically
   sorts descending with RRF/evidence-ID tie breaks, and returns only unchanged
   canonical rows under the original `limit`/`maxChars` bounds.
3. Missing, short, long, nonnumeric, nonfinite, throwing, or mutating reranker
   results fail loudly before the answer provider can treat a partial ranking
   as valid. Scores remain locating metadata, never evidence.
4. The local adapter is import-inert, reads no credential, makes no generation
   call, pins only the four licensed revisions above, bounds inputs/batches,
   and can be tested without network or model downloads. Runtime model cache is
   gitignored and absent from the committed diff.
5. P-set 22 and its three results remain immutable. A new exact prediction
   block is FINAL before the Ettin compatibility score or model download. The
   runner reports top-1 accuracy, MRR, recall at the return cutoff, warm batch
   latency, model/revision/runtime identity, and raw per-case ranks. Ettin gets
   one recorded bank pass; a bad result is retained, not rerun.
6. Selection follows the frozen Pareto rule instead of choosing the model that
  happens to repair one known case. Product code, adapter defaults, newly
  added tests, and the bakeoff bank contain no LongMemEval ID or known
  battery/power-bank wording. Pre-existing retrieval compatibility fixtures
  are not treated as tuning data and remain unchanged.
7. `docs/DECISIONS.md`, `docs/BRAIN-API.md`, the technical report, human
   report, and `STATUS.md` record upstream/model provenance, exact results,
   costs (`$0.00` provider spend), limitations, and the product stop rule.
8. Focused tests, full suite, quickstart, ticket/report/scope checks, diff
   checks, and fresh read-only review are green before acceptance.

## Ticket Completion Contract

### Goal

Improve the ordering and compactness of evidence offered to an answer model
without coupling retrieval to Gemini, Luna, or any generation provider.

### Non-Goals

Do not prove an end-to-end benchmark gain, replace the embedder, or hide an
answer-use failure behind a question-specific rule.

### Definition Of Done

- Generic reranker seam and local adapter are committed with broad contracts.
- The preregistered one-pass bakeoff is reproducible from pinned external model
  revisions while keeping all weight/cache bytes out of git.
- The founder-directed Ettin amendment preserves the first comparison and adds
  one preregistered compatibility smoke plus one terminal Ettin bank pass.
- The measured winner, or honest no-winner result, is recorded before review.
- A fresh reviewer recommends `accept`, `reopen`, or `needs-human`.

### Evidence Required

- Upstream and model commit/revision/license map.
- No-reranker equivalence; adversarial score/shape/mutation tests; bounded
  canonical reranking and provenance tests; import/no-secret/no-generation
  adapter tests.
- Frozen bank hash, runner/config hash, exact command, per-model metrics and
  latency, model-cache exclusion, full verification, and independent review.

### Expansion Rules

- A needed product path, model, dependency, metric, or second scored pass
  outside this contract requires reopening before work proceeds.
- An Ettin model load or inference failure is its recorded result; do not swap
  model revision, dtype, execution provider, or rerun after seeing scores.
- Any future live answer evaluation requires a separate founder-gated ticket,
  fresh identity, predictions, cap, and review.

### Final Review Gate

Only Quetzali may accept, close, merge, authorize a live successor, or permit
cleanup. Review is a recommendation only.

## Verification

- `node --test tests/retrieval-answer.contract.test.mjs tests/reranker-transformers.contract.test.mjs tests/reranker-bakeoff.contract.test.mjs`
- `npm run reranker-bakeoff`
- `npm test`
- `npm run quickstart`
- `npm run ticket -- ticket-lint-all`
- `npm run ticket -- report-lint BRN-0008`
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0008`
- `git diff --check main...HEAD`

## Stop Conditions

- Stop if the work needs a path outside `allowed_paths` or touches `forbidden_paths`.
- Stop before any scoring until the exact bank, predictions, model revisions,
  and runner hash are committed and pushed.
- Stop before downloading a model whose repository does not state a clear
  license, or if any cache/result/model byte would enter tracked paths.
- Stop before any provider key read, paid/live request, generation call,
  LongMemEval execution, sealed-identity access, or U8 selection.
- Stop if reranking can mutate canonical content/provenance, escape caller
  scope/time bounds, exceed limits, silently fall back after a configured
  reranker fails, or add a second generation-model turn.

## Founder Acceptance

On 2026-08-04 Quetzali explicitly accepted BRN-0008 and directed starting a
new governed ticket for the native Ettin modular head. Acceptance closes this
ticket exactly as reviewed: the provider-neutral reranking seam and P-set 22
MiniLM measurements are accepted; the P-set 23 Ettin compatibility smoke is a
terminal failure and does not constitute working Ettin support. It authorizes
no retry of that identity. A successor must use a fresh preregistered
compatibility identity and preserve the terminal evidence.

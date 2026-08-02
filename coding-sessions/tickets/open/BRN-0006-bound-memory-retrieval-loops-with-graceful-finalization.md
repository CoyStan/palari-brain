---
id: BRN-0006
title: "Bound memory retrieval loops with graceful finalization"
stream: memory
level: 1
parent_id: 
root_id: BRN-0006
children: []
status: open
risk: R2
priority: P0
agents_allowed: 1
claimed_by:
claimed_at:
target_branch: "main"
branch: "ticket/BRN-0006-bound-memory-retrieval-loops-with-graceful-finalization"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0006-bound-memory-retrieval-loops-with-graceful-finalization"
allowed_paths:
  - "src/retrieval-answer.mjs"
  - "src/openai.mjs"
  - "tests/retrieval-answer.contract.test.mjs"
  - "tests/openai.contract.test.mjs"
  - "docs/BRAIN-API.md"
  - "docs/CONSUMER-SEAM.md"
  - "docs/DECISIONS.md"
  - "STATUS.md"
  - "coding-sessions/tickets/open/BRN-0006-*.md"
  - "coding-sessions/tickets/closed/BRN-0006-*.md"
  - "coding-sessions/reports/BRN-0006-*.md"
  - "coding-sessions/human-report/BRN-0006-*.md"
  - "coding-sessions/handoffs/BRN-0006-*.md"
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
  - "node --test tests/retrieval-answer.contract.test.mjs tests/openai.contract.test.mjs"
  - "npm test"
  - "npm run quickstart"
  - "npm run ticket -- check BRN-0006"
created: 2026-08-02
updated: 2026-08-02
---

# BRN-0006 Bound memory retrieval loops with graceful finalization

## Goal

Prevent a provider from turning an uncertain memory question into an
open-ended retrieval loop. A single answer turn may execute at most four
memory-tool calls. If the fourth call does not produce a final answer, the
provider gets exactly one tool-disabled finalization turn and must answer from
the evidence already consulted or state that stored evidence is insufficient.

## Context And Authority

BRN-0005's single Luna comparison proved the live Responses/tool wire but
terminated on the abstention case `80ec1f4f_abs`: Luna issued seven successful
tool-only responses (`memory_search` x4, `memory_timeline` x1,
`memory_find` x2) and never answered. The founder accepted that immutable
result, then explicitly selected four searches as the desired safe bound and
agreed to a final evidence-or-absence response.

Current memory systems separate bounded retrieval from agent-loop control:

- Mem0's maintained example performs one search with `top_k=3`, then answers:
  https://github.com/mem0ai/mem0#basic-usage
- Zep graph search defaults to 10 reranked results per bounded call and exposes
  scores for thresholding:
  https://help.getzep.com/searching-the-graph
- LangMem's search tool defaults to 10 results per call:
  https://langchain-ai.github.io/langmem/reference/tools/
- LangChain exposes per-run tool-call limits and graceful continuation/end
  behavior; its search-limiter example uses a run limit of 3:
  https://docs.langchain.com/oss/javascript/langchain/middleware/built-in
- LangGraph recommends proactive routing to a fallback/finalization node before
  its absolute recursion limit:
  https://docs.langchain.com/oss/python/langgraph/graph-api
- Letta supports maximum-count, conditional, and terminal/exit-loop tool rules:
  https://docs.letta.com/guides/get-started/for-agents

The transferable pattern is a small per-call result set, a separate per-turn
tool budget, and graceful finalization before the emergency ceiling. The exact
number four is Palari's founder-selected product policy, not a claim that the
other systems share one universal number.

## Scope

- Add one provider-neutral four-call memory retrieval budget to the
  `answerWithRetrieval` session contract. The host-owned `retrieve` callback
  remains the authority and refuses a fifth execution even if an adapter is
  faulty.
- Tell providers the exact remaining call count and the required finalization
  behavior without adding model-specific memory semantics.
- Make the OpenAI/Luna adapter enter finalization immediately after the fourth
  successful memory-tool call. Its next request must make retrieval tools
  unavailable and explicitly require either an evidence-grounded answer or an
  honest statement that stored evidence is insufficient.
- Preserve early completion: if the model answers after zero to three memory
  calls, return immediately without a forced extra dispatch.
- Preserve the existing seven-model-dispatch ceiling as a last-resort protocol
  guard. The normal maximum becomes four tool calls plus one finalization
  response.
- Add provider-free contract tests for zero through four calls, a fifth-call
  refusal at the host boundary, forced finalization wire, evidence-present and
  evidence-insufficient answers, malformed finalization, and unchanged secret,
  storage, reasoning-continuation, and tool-validation guarantees.
- Document the public behavior and record the accepted BRN-0005 provenance.

## Out Of Scope

- No live provider request, benchmark identity, rerun, regrade, prediction,
  dataset access, credential read, spend, or publication.
- No tuning to the text or ground truth of `80ec1f4f_abs`; its private
  transcript supplies only the structural failure class and call sequence.
- No claim that four calls is universally optimal. A later change requires
  held-out evidence rather than changing this bound after one provider result.
- No automatic claim that an event did not happen. Insufficient memory evidence
  supports only an honest evidence-limited response unless consulted canonical
  records positively establish the answer.
- No change to storage, admission, ranking, embeddings, graph extraction,
  writer/reducer behavior, provider pricing, retries, or model selection.

## Acceptance Criteria

1. Every `answerWithRetrieval` provider session receives the immutable
   four-call budget and a host callback that executes no more than four memory
   tools across search, find, read, timeline, and graph surfaces combined.
2. The OpenAI adapter supports answers after zero to three calls unchanged. If
   the fourth call occurs, it executes that call once and performs exactly one
   following model dispatch with tools disabled and finalization instructions.
3. Finalization may answer from any canonical evidence already returned or say
   stored evidence is insufficient. It never rewrites a non-empty answer into
   a canned absence and never turns empty retrieval into proof of nonoccurrence.
4. A provider that attempts a fifth host retrieval fails before executing the
   tool. A malformed, refused, incomplete, empty, or tool-calling finalization
   fails closed with a stable error; it cannot silently reopen retrieval.
5. The complete OpenAI reasoning/output continuation remains intact through
   all four calls. Keys remain header-only, `store:false` stays fixed,
   parallel calls stay disabled, and there is no retry.
6. Public documentation explains the four-call product policy, one finalization
   turn, honest-absence semantics, and separate seven-dispatch emergency cap.
7. Focused contracts, full tests, quickstart, ticket checks, reports, STATUS,
   and independent review are green. Provider calls, credential reads, and
   spend for BRN-0006 remain exactly zero.

## Ticket Completion Contract

### Goal

Make memory-answer completion bounded and graceful across providers, using the
smallest host-owned rule that would have converted BRN-0005's runaway search
into an evidence-grounded answer or honest abstention.

### Non-Goals

No benchmark recovery, provider comparison, relevance classifier, learned
stopping policy, prompt tuning from answers, or global agent framework.

### Definition Of Done

- The contract, implementation, focused regression corpus, consumer docs,
  decision record, STATUS closeout, human report, and reviewer note are
  committed on the isolated ticket branch.
- All verification and committed-plus-dirty scope checks pass.
- Ticket is `in-review`; only Quetzali may accept, close, merge, or authorize a
  later live run.

### Evidence Required

- Provider-free transcript assertions proving calls 1-4 execute, call 5 never
  executes, and the final request cannot invoke tools.
- Cases for early answer, answer from accumulated evidence, honest insufficient
  evidence, malicious fifth call, and malformed finalization.
- Focused/full tests, quickstart, ticket/report/scope checks, and a fresh
  independent review of behavior and non-overfit boundaries.

### Expansion Rules

- If graceful finalization requires changing memory contents, ranking,
  embeddings, tool result schemas, or another provider's public adapter, stop
  and reopen scope rather than smuggling the change into this ticket.
- Any live validation requires a separate fresh identity, preregistration,
  spend cap, independent pre-review, and explicit founder GO.

### Final Review Gate

- A fresh reviewer recommends `accept`, `reopen`, or `needs-human` from the
  committed diff and provider-free evidence.
- Quetzali alone may accept, close, merge, or authorize any live successor.

## Verification

- `node --test tests/retrieval-answer.contract.test.mjs tests/openai.contract.test.mjs`
- `npm test`
- `npm run quickstart`
- `npm run ticket -- ticket-lint-all`
- `npm run ticket -- report-lint BRN-0006`
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0006`
- `git diff --check main...HEAD`

## Stop Conditions

- Stop if the work needs a path outside `allowed_paths` or touches `forbidden_paths`.
- Stop before any provider/network call, credential read, live identity, or
  spend. This ticket is wholly provider-free.
- Stop if a fifth tool can execute, finalization can silently regain tools, or
  the implementation replaces provider output with a fabricated canned answer.
- Stop if the design would weaken canonical provenance, admission, scope,
  deletion, or the distinction between absent evidence and evidence of absence.

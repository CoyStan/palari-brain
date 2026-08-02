---
id: BRN-0004
title: "Add OpenAI Luna Provider Adapter"
stream: memory
level: 1
parent_id: 
root_id: BRN-0004
children: []
status: claimed
risk: R3
priority: P1
agents_allowed: 1
claimed_by: "quetza"
claimed_at: 2026-08-02T02:44:07Z
target_branch: "main"
branch: "ticket/BRN-0004-add-openai-luna-provider-adapter"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0004-add-openai-luna-provider-adapter"
allowed_paths:
  - "src/openai.mjs"
  - "tests/openai.contract.test.mjs"
  - "package.json"
  - "docs/BRAIN-API.md"
  - "docs/CONSUMER-SEAM.md"
  - "docs/DECISIONS.md"
  - "STATUS.md"
  - "coding-sessions/tickets/open/BRN-0004-*.md"
  - "coding-sessions/tickets/closed/BRN-0004-*.md"
  - "coding-sessions/reports/BRN-0004-*.md"
  - "coding-sessions/human-report/BRN-0004-*.md"
  - "coding-sessions/handoffs/BRN-0004-*.md"
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
requires_human_confirmation: true
requires_review: true
verification:
  - "node --test tests/openai.contract.test.mjs"
  - "npm test"
  - "npm run quickstart"
  - "npm run trust-bench"
  - "node scripts/ticket-system.mjs check BRN-0004"
created: 2026-08-02
updated: 2026-08-02
---

# BRN-0004 Add OpenAI Luna Provider Adapter

## Goal

Add one public, provider-safe OpenAI Responses API adapter that makes the
current Palari product path usable with the documented `gpt-5.6-luna` model:
bounded retrieval-tool answering, active-memory reduction, and optional graph
extraction. Preserve Palari's provider-neutral contracts and host-side gates.

## Context And Authority

The founder requested GPT-5.6 Luna compatibility on 2026-08-02 and selected
the already ignored OpenAI credential for a later founder-gated smoke. Official
OpenAI documentation identifies `gpt-5.6-luna` as the cost-sensitive,
high-volume GPT-5.6 tier and documents Responses API support for function
calling and structured outputs:

- https://developers.openai.com/api/docs/models/gpt-5.6-luna
- https://developers.openai.com/api/docs/guides/latest-model
- https://developers.openai.com/api/docs/guides/function-calling
- https://developers.openai.com/api/docs/guides/structured-outputs

This ticket authorizes offline implementation only. It does not consume the
founder's live-provider gate or inspect, print, move, or rewrite the existing
credential.

## First Review Repair Record

Fresh review at `f06988d` recommended reopen. The repaired successor requests
and replays encrypted reasoning content for stateless tool continuation; makes
4 MiB, seven dispatches, and one repair absolute maxima; and adds adversarial
coverage for raised caps, streamed oversize, malformed arguments, incomplete
output, empty output, and malformed structured output.

Second review at `20176de` passed every implementation, R3 boundary, scope,
and regression check and reopened only for one stale human-report count
(`13` instead of the measured `14`). The successor corrects that record only.

Process record: official OpenAI documentation was read through the configured
documentation connector after this ticket was frozen. That was external
documentation network access, so it did not satisfy the stop condition's
overbroad literal phrase “any network call,” even though it was not an OpenAI
API/provider inference call, used no credential, created no identity, and
spent $0.00. This deviation is recorded rather than erased. No later step may
treat it as provider-run authority.

## Scope

- Add `palari-brain/openai` as an additive package subpath backed by
  `src/openai.mjs`; do not add an SDK dependency.
- Build fail-closed OpenAI Responses API requests whose credential exists only
  in the `Authorization` header and whose body uses `store: false`.
- Map `MEMORY_RETRIEVAL_TOOLS` losslessly to Responses function tools. Because
  Palari's existing optional-field and root-`anyOf` schemas are not OpenAI
  strict-mode schemas, preserve them under explicit `strict: false` and keep
  host validation authoritative.
- Provide a bounded retrieval-provider callback for `answerWithRetrieval`.
  Preserve every reasoning/output item across function-call continuations,
  route arguments through Palari's `retrieve` callback, and stop on malformed,
  unknown, over-budget, incomplete, refused, or empty output.
- Provide structured-output adapters for active-memory reduction and optional
  temporal-graph extraction. Use root-object strict JSON schemas; submit every
  proposal through the existing host normalizers/admission gates; allow at
  most one explicit host-guided reducer repair, never an identical retry.
- Add provider-free fake-transport contracts covering request shape,
  credential placement, response normalization, tool continuation, output-item
  preservation, caps, repair bounds, and rejection paths.
- Document exact consumer wiring, the independent embedding requirement, and
  the fact that offline compatibility does not prove live provider acceptance.

## Out Of Scope

- Any provider request, credential read, model-list request, compatibility
  smoke, benchmark identity, score, prediction, spend, or publication.
- Replacing Gemini, changing historical provider bindings, editing frozen eval
  identities, or changing any existing reducer, retrieval, graph, or admission
  contract.
- An OpenAI embedding adapter. GPT-5.6 Luna is a generation model; semantic
  retrieval remains independently pluggable and may continue using the
  existing Gemini embedder.
- Automatic `.env` loading, secret logging, retries, metering, pricing
  calculations, product UI, or application authentication policy.
- Claiming quality, latency, cost, or live wire compatibility before a later
  preregistered founder-authorized run.

## Acceptance Criteria

1. `palari-brain/openai` exports the documented model constant and inert
   builders/factories without reading environment variables or dispatching on
   import.
2. The transport uses only `POST https://api.openai.com/v1/responses`, JSON,
   and `Authorization: Bearer ...`; keys never enter URLs, bodies, thrown
   messages, or response artifacts.
3. The answer adapter completes a provider-free multi-turn function-call loop,
   preserves complete response output (including reasoning items), executes
   only known Palari tools through `retrieve`, and enforces a model-dispatch
   ceiling.
4. The reducer adapter emits OpenAI strict structured-output wire, accepts only
   host-valid reducer payloads, marks provider/infrastructure failures terminal,
   and performs no more than one distinct host-guided repair.
5. The graph adapter emits OpenAI strict structured-output wire and returns
   only the response object that the unchanged graph admission gate will
   verify; malformed/refused/incomplete/empty provider results fail closed.
6. Existing public exports and Gemini behavior remain unchanged. The full
   suite, quickstart, and trust benchmark stay green.
7. Documentation shows executable wiring with an explicitly supplied key and
   clearly states that embeddings are a separate model/provider choice and no
   live Luna result exists yet.

## Ticket Completion Contract

### Goal

Ship a reviewed, additive OpenAI/Luna boundary that a consumer can compose
with the current Palari brain without moving memory authority into the model.

### Non-Goals

No live proof, benchmark, automatic key loading, OpenAI embedding work,
provider replacement, or change to canonical memory semantics.

### Definition Of Done

- Adapter, focused contracts, package export, consumer docs, decision record,
  STATUS closeout, technical report, reviewer note, and human report are
  committed on the ticket branch.
- All verification and committed-plus-dirty scope checks pass.
- Ticket is `in-review`; only the founder may accept, close, merge, or authorize
  a live successor.

### Evidence Required

- Focused OpenAI contract output, full-suite output, quickstart output, trust
  benchmark output, scope check, and ticket check.
- Fresh-context review of the committed diff, especially key placement,
  output-item continuation, caps, and preservation of host admission.
- Explicit written record that provider calls, credential reads, and spend are
  all zero for this ticket.

### Expansion Rules

- If implementation needs a frozen eval path, an OpenAI embedder, a package
  dependency, or a changed provider-neutral product contract, stop and open a
  child/successor ticket rather than widening this contract.
- A live compatibility call requires a separate R3 successor with prediction,
  cap, review, fresh founder GO, and immutable result recording.

### Final Review Gate

- One fresh-context reviewer recommends `accept`, `reopen`, or `needs-human`.
- Quetzali alone may accept, move the ticket to closed, merge, push the merged
  result, or authorize a live provider successor.

## Verification

- `node --test tests/openai.contract.test.mjs`
- `npm test`
- `npm run quickstart`
- `npm run trust-bench`
- `git diff --check main...HEAD`
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0004`
- `node scripts/ticket-system.mjs check BRN-0004`

## Stop Conditions

- Stop if the work needs a path outside `allowed_paths` or touches `forbidden_paths`.
- Stop before any network call, credential read, live model/list request,
  benchmark run, or spend.
- Stop if OpenAI's documented Responses wire cannot preserve Palari's complete
  model output across a reasoning/tool continuation without changing the
  provider-neutral retrieval contract.
- Stop if host validation would have to be weakened or model-authored scope,
  speaker, time, provenance, identity, deletion, or admission authority added.

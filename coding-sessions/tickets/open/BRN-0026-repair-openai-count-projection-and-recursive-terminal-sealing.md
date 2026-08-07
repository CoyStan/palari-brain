---
id: BRN-0026
title: "Repair OpenAI count projection and recursive terminal sealing"
stream: evaluation
level: 1
parent_id: 
root_id: BRN-0026
children: []
status: open
risk: R4
priority: P0
agents_allowed: 1
claimed_by:
claimed_at:
target_branch: "main"
branch: "ticket/BRN-0026-repair-openai-count-projection-and-recursive-terminal-sealing"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0026-repair-openai-count-projection-and-recursive-terminal-sealing"
allowed_paths:
  - "evals/openai-counted-responses.mjs"
  - "tests/openai-counted-responses.contract.test.mjs"
  - "evals/terminal-artifact-manifest.mjs"
  - "tests/terminal-artifact-manifest.contract.test.mjs"
  - "evals/predictions.md"
  - "docs/EVALUATION-HARNESS.md"
  - "docs/DECISIONS.md"
  - "STATUS.md"
  - "coding-sessions/tickets/open/BRN-0026-*.md"
  - "coding-sessions/tickets/closed/BRN-0026-*.md"
  - "coding-sessions/reports/BRN-0026-*.md"
  - "coding-sessions/human-report/BRN-0026-*.md"
  - "coding-sessions/handoffs/BRN-0026-*.md"
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
  - "node --test tests/openai-counted-responses.contract.test.mjs tests/terminal-artifact-manifest.contract.test.mjs"
  - "npm test"
  - "npm run quickstart"
created: 2026-08-07
updated: 2026-08-07
---

# BRN-0026 Repair OpenAI count projection and recursive terminal sealing

## Goal

Repair the two independently verified defects that terminated BRN-0025: send
the Responses input-count endpoint only its documented token-count schema while
preserving the exact generation body, and seal nested terminal evidence with a
recursive, mode-aware manifest. Freeze a new successor offline and stop at a
fresh founder gate.

## Scope

- Add a fail-closed count-body projection to the exact-count evaluator. The
  projection must retain every documented input-token field used by the frozen
  Responses request and omit only explicitly classified generation-only
  fields. It must never mutate or silently reinterpret the generation body.
- Durably bind separate canonical hashes for the exact generation body and the
  projected count body. Count, reservation, generation, transcript, and audit
  evidence must make that relationship reviewable without claiming byte
  identity between endpoint-specific schemas.
- Base the projection on the official Count input tokens reference and OpenAPI
  schema for `POST /v1/responses/input_tokens`. The observed BRN-0025 HTTP 400
  proves `include` is rejected; provider documentation, not a benchmark rule,
  defines the supported count fields.
- Add a reusable recursive terminal-manifest builder. It must traverse nested
  directories deterministically, require files at mode 0600 and directories at
  mode 0700, reject symlinks/special entries/escapes, hash every file, include
  directory custody, exclude the manifest itself, and support durable
  write-once sealing.
- Create new mode-0600 private successor launcher/runtime artifacts under
  `/home/quetza/palari-brain-private/`. Never modify consumed BRN-0024 or
  BRN-0025 launcher/runtime/result/semantic-review bytes.
- Freeze successor identity `j4-luna-ettin-unexecuted11to20-v3` for the same
  disclosed, never-completed/previously-profiled S60 ordinals 11-20. Preserve
  population, order, architecture, models, prompts, four-call cap, historical
  `6/10`, sealed U8, and prior grades.
- Register FINAL P-set 37 before any credential access. Opening cumulative
  accounted spend is `$7.85549929`; proposed caps are `$5.00` fresh and
  `$12.85549929` cumulative.

## Out Of Scope

- No provider request, credential read, `.env` load, selected dataset/session/
  question/answer inspection, result namespace, score, semantic judgment,
  publication, or spend.
- No retry, repair, seal, overlay, resume, reroll, or regrade of consumed
  BRN-0024 or BRN-0025 identities. BRN-0025 remains honestly unsealed.
- No product memory/retrieval/ranking/prompt/model/population change.
- No claim that endpoint-specific request bodies are byte-identical. Their
  explicit projection and paired hashes are the compatibility contract.
- No live successor invocation. Acceptance stops at a new exact founder gate.

## Acceptance Criteria

1. The exact generation body remains immutable and hashes identically before
   and after projection. The count request is a distinct immutable value with
   its own hash and no `include`, `max_output_tokens`, `service_tier`, or
   `store` field.
2. Projection uses an explicit documented allowlist plus explicit known
   generation-only exclusions and rejects every unknown top-level field. It
   preserves nested input, instructions, model, tools, tool choice, reasoning,
   and parallel-tool-call values exactly.
3. Permanent contracts reproduce BRN-0025's frozen body and 400 error shape;
   prove the projected request retains all token-affecting content; prove
   generation receives the untouched full body once after a successful count;
   and fail closed on mutation, unknown fields, retries, or hash drift.
4. The recursive manifest builder deterministically seals a BRN-0025-shaped
   nested fixture, records file/directory entries, modes, and hashes, rejects
   symlinks/special entries, refuses reseal/overwrite, and survives adversarial
   path and ordering cases.
5. Successor provider-free verification executes the actual final-runtime
   cached-Ettin smoke, projected-count fake wire, generation-body fake wire,
   one-shot custody, and a forced nested terminal-seal fixture. It records zero
   provider/credential/dataset/result telemetry and removes temporary state.
6. The freeze binds a clean pushed complete import closure, official count
   schema provenance, consumed predecessor snapshots, exact private hashes and
   modes, absent successor/overlay namespaces, U8 exclusion, P-set 37,
   `$7.85549929` opening ledger, and both proposed caps.
7. Focused contracts, full tests, quickstart, private provider-free verify,
   ticket/report/scope/diff checks, and fresh cumulative review pass. All
   BRN-0024/25 private hashes and historical results remain unchanged.
8. The accepted offline ticket stops at the founder gate. Any live successor
   requires exact authorization naming identity, both numeric caps, reviewed
   head, launcher/runtime hashes, and ACCEPT state.

## Ticket Completion Contract

### Goal

Produce a reviewed offline successor freeze that would accept the documented
count wire and recursively seal its expected nested artifacts.

### Non-Goals

Do not obtain a score, repair a consumed namespace, or authorize live spend.

### Definition Of Done

- Count projection, paired hashing, recursive manifest code, and regressions
  are committed.
- Successor private artifacts are mode 0600 and provider-free verification is
  complete with exact hashes.
- P-set 37 and all governed evidence records are complete.
- Independent review recommends ACCEPT; lifecycle acceptance still grants no
  provider authority.

### Evidence Required

- Official Count input tokens guide/reference/OpenAPI provenance.
- Exact BRN-0025 request-shape reproduction and projected fake-wire evidence.
- Recursive nested sealing, symlink/special/reseal/path-order regressions.
- Before/after hashes for consumed private artifacts.
- Focused/full/quickstart/private/governance outputs.

### Expansion Rules

- Stop for provider access, consumed-artifact mutation, benchmark-content
  inspection, undocumented field guesses, product change, or out-of-scope path.
- Open a separate ticket for any new provider response or unrelated defect.

### Final Review Gate

- A fresh read-only reviewer inspects the exact pushed tracked head and exact
  private hashes. Acceptance authorizes no live invocation.

## Verification

- `node --test tests/openai-counted-responses.contract.test.mjs tests/terminal-artifact-manifest.contract.test.mjs`
- `node /home/quetza/palari-brain-private/luna-ettin-unexecuted11to20-v3-live-launcher.mjs --verify`
- `npm test`
- `npm run quickstart`
- `npm run ticket -- check BRN-0026`
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0026`
- `git diff --check`

## Stop Conditions

- Stop if work needs a tracked path outside `allowed_paths`, touches a forbidden
  path, reads credentials or selected benchmark content, mutates a consumed
  artifact, creates the successor namespace, or requires live spend.

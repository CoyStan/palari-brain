---
id: BRN-0028
title: "Normalize OpenAI context-band settlement"
stream: evaluation
level: 1
parent_id: 
root_id: BRN-0028
children: []
status: accepted
risk: R4
priority: P0
agents_allowed: 1
claimed_by:
claimed_at:
target_branch: "main"
branch: "ticket/BRN-0028-normalize-openai-context-band-settlement"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0028-normalize-openai-context-band-settlement"
allowed_paths:
  - "evals/openai-input-reservation.mjs"
  - "tests/openai-input-reservation.contract.test.mjs"
  - "evals/openai-counted-responses.mjs"
  - "tests/openai-counted-responses.contract.test.mjs"
  - "evals/openai-standard-usage.mjs"
  - "tests/openai-standard-usage.contract.test.mjs"
  - "evals/predictions.md"
  - "docs/EVALUATION-HARNESS.md"
  - "docs/DECISIONS.md"
  - "STATUS.md"
  - "coding-sessions/tickets/open/BRN-0028-*.md"
  - "coding-sessions/tickets/closed/BRN-0028-*.md"
  - "coding-sessions/reports/BRN-0028-*.md"
  - "coding-sessions/human-report/BRN-0028-*.md"
  - "coding-sessions/handoffs/BRN-0028-*.md"
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
  - "node --test tests/openai-input-reservation.contract.test.mjs tests/openai-counted-responses.contract.test.mjs tests/openai-standard-usage.contract.test.mjs"
  - "npm test"
  - "npm run quickstart"
  - "npm run ticket -- check BRN-0028"
created: 2026-08-07
updated: 2026-08-07
---

# BRN-0028 Normalize OpenAI context-band settlement

## Goal

Replace the private runtime's duplicated context-band pricing logic with one
tracked fail-closed OpenAI Standard usage-settlement boundary whose vocabulary
matches counted reservations, permanently reproduce the BRN-0026 HTTP-200
failure, and freeze a provider-free v4 successor at a new founder gate.

## Scope

- Add a tracked pure settlement helper for `gpt-5.6-luna` and `gpt-5.6-sol`
  Standard/default usage. Its accepted context-band values are exactly the
  reservation contract's public `short` and `long` values.
- Reuse the pinned reservation policy/rates rather than duplicate prices.
  Validate input, cached-input, output, and reasoning token metadata; reject
  unknown models/bands, malformed usage, impossible counts, and mutation.
- Permanently reproduce the sanitized BRN-0026 successful Luna usage shape:
  2,142 input, zero cached, 40 output, 8 reasoning, context band `short`.
  Prove exact settlement is `$0.0004764` offline and that legacy internal
  labels `shortContext`/`longContext` fail closed.
- Freeze new identity `j4-luna-ettin-unexecuted11to20-v4` using the shared
  tracked helper in its generated runtime. Preserve the exact P-set 37
  population/order, architecture, prompts, models, four-call ceiling,
  historical `6/10`, U8 exclusion, and prior grades.
- Register FINAL P-set 38 before any credential access. Opening cumulative
  accounted spend is `$7.90712669`; proposed caps are `$5.00` fresh and
  `$12.90712669` cumulative.
- Create new mode-0600 private v4 launcher/runtime artifacts and verify them
  provider-free with the actual cached-Ettin smoke, exact count/full-generation
  fake wires, exact HTTP-200 settlement regression, one-shot custody, recursive
  seal, and zero external telemetry.

## Out Of Scope

- No provider request, credential read, `.env` load, selected benchmark
  inspection, result namespace, score, semantic judgment, publication, or
  spend.
- No mutation, retry, resume, reroll, regrade, overlay, or post-hoc settlement
  of consumed v1-v3 identities. BRN-0026's Luna reservation remains uncertain
  in its historical meter and cumulative accounting.
- No product memory, retrieval, ranking, prompt, model, dataset population, or
  answer behavior change.
- No live v4 invocation. Acceptance stops at a new exact founder gate.

## Acceptance Criteria

1. One tracked helper accepts only `short`/`long`, sources the exact pinned
   model/rate policy, returns deterministic token details plus USD, and rejects
   invalid model, band, usage, cache/reasoning relationships, or mutable input.
2. The exact sanitized BRN-0026 usage fixture settles to `$0.0004764` with
   `short`; both legacy labels reproduce a pre-dispatch failure, preventing the
   original private mismatch from recurring silently.
3. Counted-response planning continues to expose the same public reservation
   band and exact body hashes; existing Sol/Luna short/long reservations and
   endpoint-specific count/full-generation behavior remain unchanged.
4. The v4 generated runtime imports or embeds the reviewed shared helper
   contract, passes the exact BRN-0026 response settlement in its actual
   provider-free execution mode, and cannot fall back to duplicated ad-hoc
   context-band prices.
5. New private launcher/runtime are mode 0600 and bind a clean pushed complete
   import closure, absent v4 result/semantic namespaces, immutable v1-v3
   snapshots, P-set 38, exact opening accounting, and both proposed caps.
6. Provider-free verification executes actual cached Ettin, projected-count
   and untouched-generation fake wires, the HTTP-200 settlement fixture,
   durable one-shot custody/reuse refusal, nested terminal seal/reseal refusal,
   cleanup, and zero credential/dataset/provider/result telemetry.
7. Focused contracts, full tests, quickstart, private verification, ticket/
   report/scope/diff checks, and fresh cumulative review pass. Historical
   `6/10`, U8, all consumed artifacts, and `$7.90712669` accounting stay fixed.
8. The accepted ticket grants no live use. Any v4 invocation requires fresh
   exact founder authorization naming identity, numeric caps, reviewed head,
   launcher/runtime hashes, and ACCEPT state.

## Ticket Completion Contract

### Goal

Make successful counted Responses usage settle through one canonical public
context-band vocabulary and freeze that proof in the actual successor runtime.

### Non-Goals

Do not change memory quality, retroactively lower spend, or obtain a score.

### Definition Of Done

- Shared settlement code and exact v3 regression are committed.
- The provider-free v4 freeze passes from final generated bytes.
- P-set 38 and governed evidence are complete.
- Independent review recommends ACCEPT; lifecycle acceptance authorizes no
  provider access.

### Evidence Required

- Exact public band/rate source and invalid-shape tests.
- Sanitized v3 HTTP-200 usage settlement reproduction.
- Actual generated-runtime execution/custody/seal proof with zero telemetry.
- Private hashes/modes, closure, namespace absence, predecessor immutability,
  focused/full/quickstart/governance outputs.

### Expansion Rules

- Stop for provider or credential access, selected benchmark inspection,
  consumed-artifact mutation, price/prompt/model/population change, or any path
  outside the ticket contract.

### Final Review Gate

- Fresh read-only review validates the exact clean pushed tracked head and
  private hashes. Acceptance grants no live invocation.

## Verification

- `node --test tests/openai-input-reservation.contract.test.mjs tests/openai-counted-responses.contract.test.mjs tests/openai-standard-usage.contract.test.mjs`
- `npm test`
- `npm run quickstart`
- `npm run ticket -- check BRN-0028`
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0028`
- `git diff --check`

## Stop Conditions

- Stop if work needs a path outside `allowed_paths`, touches `forbidden_paths`,
  reads credentials or selected benchmark content, calls a provider, mutates a
  consumed artifact, creates a v4 result namespace, or requires a live run.

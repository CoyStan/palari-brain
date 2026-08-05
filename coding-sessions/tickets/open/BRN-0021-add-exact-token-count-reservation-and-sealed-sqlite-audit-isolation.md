---
id: BRN-0021
title: "Add exact token-count reservation and sealed SQLite audit isolation"
stream: evaluation
level: 1
parent_id:
root_id: BRN-0021
children: []
status: in-review
risk: R3
priority: P0
agents_allowed: 1
claimed_by:
claimed_at:
target_branch: "main"
branch: "ticket/BRN-0021-add-exact-token-count-reservation-and-sealed-sqlite-audit-isolation"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0021-add-exact-token-count-reservation-and-sealed-sqlite-audit-isolation"
allowed_paths:
  - "evals/openai-input-reservation.mjs"
  - "evals/sealed-sqlite-audit.mjs"
  - "tests/openai-input-reservation.contract.test.mjs"
  - "tests/sealed-sqlite-audit.contract.test.mjs"
  - "evals/predictions.md"
  - "docs/EVALUATION-HARNESS.md"
  - "docs/DECISIONS.md"
  - "STATUS.md"
  - "coding-sessions/tickets/open/BRN-0021-*.md"
  - "coding-sessions/tickets/closed/BRN-0021-*.md"
  - "coding-sessions/reports/BRN-0021-*.md"
  - "coding-sessions/human-report/BRN-0021-*.md"
  - "coding-sessions/handoffs/BRN-0021-*.md"
forbidden_paths:
  - ".env"
  - ".env.*"
  - "*.key"
  - "**/*.key"
  - "secrets/**"
  - "**/secrets/**"
  - "*secret*"
  - "**/*secret*"
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
  - "node --test tests/openai-input-reservation.contract.test.mjs tests/sealed-sqlite-audit.contract.test.mjs"
  - "npm test"
  - "npm run quickstart"
  - "npm run ticket -- check BRN-0021"
created: 2026-08-05
updated: 2026-08-05
---

# BRN-0021 Add exact token-count reservation and sealed SQLite audit isolation

## Goal

Replace the live-evaluation harness's one-UTF-8-byte-equals-one-input-token
reservation approximation with an offline-tested primitive that can consume
the provider's exact structured Responses input count, while retaining the
existing conservative byte fallback. Also make later SQLite result audits
copy sealed database bytes and sidecars into owned scratch storage before any
SQLite library opens them, so inspection cannot mutate a terminal bundle.

## Scope

- Add `evals/openai-input-reservation.mjs`, a provider-neutral reservation
  module with a caller-injected exact-count transport. It validates the exact
  OpenAI input-count response, preserves the structured request body without
  mutation, applies explicit pinned Standard/default rates and thresholds,
  reserves the full configured output ceiling, and exposes the previous
  UTF-8-byte calculation as a clearly labeled conservative fallback.
- Treat a count transport or response-validation failure as terminal. Never
  silently fall back after a count invocation because the invocation may have
  incurred cost. The module owns no network client, credential lookup, retry,
  meter, or assumption that input counting is free.
- Add `evals/sealed-sqlite-audit.mjs`, a copy-first audit boundary that copies
  a database and any existing `-wal`/`-shm` sidecars into a newly owned scratch
  directory, invokes a caller-supplied audit callback only on the copy, proves
  the source file set, hashes, and modes are unchanged, and cleans the exact
  owned scratch directory on success and failure.
- Add adversarial offline contract tests using injected functions and
  synthetic temporary SQLite databases. Tests must make zero network,
  credential, provider, or sealed-result access.
- Pre-register P-set 31 before any scoring or calibration. Keep the historical
  BRN-0017 6/10 and BRN-0020 terminal result immutable, document the harness
  boundary, and record provider/spend activity as zero.

## Out Of Scope

- No live `/v1/responses/input_tokens` request, provider call, credential or
  environment-secret read, spend, compatibility probe, new evaluation
  identity, benchmark question, generation, judge, rerun, resume, reseal,
  regrade, or publication.
- No read or open of BRN-0020's private result namespace or sealed SQLite
  files. Tracked terminal reports may be cited; all executable audit fixtures
  are synthetic and temporary.
- No production memory behavior, model, prompt, retrieval, admission,
  generation launcher, historical result, or package-dependency change.
- No local-tokenizer claim of exactness. Official OpenAI guidance states that
  structured Responses input with tools, schemas, images, or model-specific
  formatting requires the provider input-count endpoint for an exact count.
- No claim that the provider's input-count endpoint is unbilled. Any later
  physical invocation needs its own founder-gated, metered contract until its
  billing treatment is established.

## Acceptance Criteria

1. Exact-count parsing accepts only a plain response with object type
   `response.input_tokens` and a positive safe-integer `input_tokens`; missing,
   coerced, accessor, fractional, zero, negative, or unsafe values fail closed.
2. The caller-injected counter receives an immutable clone of the exact
   structured Responses body and cannot mutate the caller's body. The returned
   count record is immutable. The module performs no network or environment
   access and has no hidden retry or fallback.
3. Counted reservation validates all inputs, chooses the explicit Standard
   short- or long-context band from the exact count, charges the highest safe
   uncached/cache-write input rate for that band, and reserves the full output
   ceiling. Its result identifies the provider count as its source.
4. Conservative reservation uses the serialized request's UTF-8 byte length
   as input units at the highest configured input and output rates, matching
   the old no-underestimate bound and identifying itself as fallback.
5. On a fixed synthetic structured-request bank, counted reservation is at
   least three times lower than the conservative byte fallback without
   lowering the output ceiling, while neither calculation under-reserves its
   own validated units and rates.
6. The SQLite utility rejects symlink and non-file sources, snapshots the
   database plus existing `-wal`/`-shm` sidecars before copying, and guarantees
   that the callback receives only an absolute path under a newly created
   scratch directory outside the source namespace.
7. Opening or mutating the copied SQLite database may create scratch sidecars
   but leaves the source physical file set, hashes, and permission modes
   exactly unchanged. The utility removes only its owned scratch directory on
   callback success and failure and surfaces custody or cleanup failures.
8. P-set 31 precedes the deterministic measurements and distinguishes its
   synthetic reservation/audit oracles from any live provider or benchmark
   result. Documentation states the historical 6/10 and BRN-0020 result remain
   unchanged.
9. Focused tests, full `npm test`, `npm run quickstart`, ticket checks, scope
   checks, and `git diff --check` pass with zero provider calls and `$0.00`
   fresh/cumulative spend change.

## Ticket Completion Contract

### Definition Of Done

- A later governed launcher can inject an exact structured-input counter and
  compute a materially tighter reservation without trusting a local tokenizer.
- A later reviewer can inspect copied SQLite state without any SQLite open in
  the sealed namespace.
- Both primitives are independently useful, fail closed, and are proven only
  with deterministic offline fixtures in this ticket.

### Expansion Rules

- If the exact endpoint's wire compatibility or billing behavior must be
  established, stop and prepare a separate founder-gated live probe ticket.
- If integrating either primitive into a live launcher needs an undeclared
  path, stop for a successor ticket; do not widen BRN-0021 after work starts.
- If scratch isolation cannot be guaranteed without opening or changing the
  source database, stop and report the design failure.

## Verification

- `node --test tests/openai-input-reservation.contract.test.mjs tests/sealed-sqlite-audit.contract.test.mjs`
- `npm test`
- `npm run quickstart`
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0021`
- `npm run ticket -- check BRN-0021`
- `git diff --check main...HEAD`

## Stop Conditions

- Stop if the work needs a path outside `allowed_paths` or touches `forbidden_paths`.
- Stop before any credential read, network request, provider invocation,
  private-result access, generation, benchmark run, judge, or spend.
- Stop rather than presenting a local tokenizer or byte heuristic as the exact
  structured-input count.

## Implementation Evidence

- Exact count parsing is strict, immutable, and internally brands accepted
  records so reservation cannot be invoked with a caller-forged raw number.
  The counter has one caller-injected invocation and no credential, network,
  retry, meter, or post-dispatch fallback surface.
- Counted and fallback reservations reconcile exact integer picodollars and an
  exact USD decimal string. The fixed three-case synthetic bank measures
  `6.907x`, `13.939x`, and `6.095x` tighter reservations with the identical 512
  output ceiling.
- Copy-first SQLite tests cover main-only state, valid live WAL/SHM state, and
  callback failure. The source file set/hashes/modes remain exact; SQLite and
  scratch mutations see only the owned copy; cleanup succeeds on both paths.
- Focused tests: 12 passed, 0 failed. Full suite: 739 passed, 15 optional skips,
  0 failed across 754. Quickstart: 6/6. Offline source, syntax, diff, ticket,
  and committed-plus-dirty scope checks pass.
- Credential reads / network requests / provider calls / inference /
  private-result reads / spend: `0 / 0 / 0 / 0 / 0 / $0.00`. Cumulative
  accounted spend remains exactly `$7.75502179`; historical BRN-0017 remains
  6/10 and consumed BRN-0020 remains unchanged.

---
id: BRN-0022
title: "Validate OpenAI structured input-count wire"
stream: evaluation
level: 1
parent_id:
root_id: BRN-0022
children: []
status: accepted
risk: R4
priority: P0
agents_allowed: 1
claimed_by:
claimed_at:
target_branch: "main"
branch: "ticket/BRN-0022-validate-openai-structured-input-count-wire"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0022-validate-openai-structured-input-count-wire"
allowed_paths:
  - ".gitignore"
  - "evals/openai-input-count-probe.mjs"
  - "tests/openai-input-count-probe.contract.test.mjs"
  - "evals/predictions.md"
  - "docs/EVALUATION-HARNESS.md"
  - "docs/DECISIONS.md"
  - "STATUS.md"
  - "coding-sessions/tickets/open/BRN-0022-*.md"
  - "coding-sessions/tickets/closed/BRN-0022-*.md"
  - "coding-sessions/reports/BRN-0022-*.md"
  - "coding-sessions/human-report/BRN-0022-*.md"
  - "coding-sessions/handoffs/BRN-0022-*.md"
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
  - "node --test tests/openai-input-count-probe.contract.test.mjs tests/openai-input-reservation.contract.test.mjs"
  - "npm test"
  - "npm run quickstart"
  - "npm run ticket -- check BRN-0022"
created: 2026-08-06
updated: 2026-08-06
---

# BRN-0022 Validate OpenAI structured input-count wire

## Goal

Establish, with one tiny founder-authorized request and no generation, that
OpenAI's `POST /v1/responses/input_tokens` endpoint accepts the exact
structured request shape Palari needs for Sol answer-cost reservation. Preserve
the response and accounting boundary as a private, terminal, one-shot
compatibility artifact without changing any historical benchmark result.

## Scope

- Freeze identity `openai-structured-input-count-compat-v1` from clean pushed
  `main`, with opening cumulative accounted spend exactly `$7.75502179`, a
  `$0.05` fresh hard cap, and a `$7.80502179` cumulative accounted cap.
- Add a small tracked, dependency-free probe boundary that constructs one
  immutable `gpt-5.6-sol` input-count body containing instructions, a
  structured user message, and one strict function-tool schema. It must use
  the accepted BRN-0021 counter/parser and must not contain a Responses
  generation call or any retry/fallback-after-dispatch path.
- Build the executable one-shot launcher under
  `/home/quetza/palari-brain-private/`, outside git. It must fail before result
  creation, credential access, or transport unless the exact identity, caps,
  clean pushed reviewed head, absent result namespace, and fresh founder
  authority all match.
- Before transport, durably write and directory-sync a `$0.05` uncertain
  reservation. Because official documentation establishes the response shape
  but not a distinct billing rule for this endpoint, keep that entire
  reservation accounted after dispatch rather than claiming the request is
  free.
- Invoke exactly one physical HTTPS request to
  `https://api.openai.com/v1/responses/input_tokens`, with redirects and
  automatic retries disabled. Validate HTTP success and the exact documented
  `{ object: "response.input_tokens", input_tokens: integer }` response.
- Seal a private mode-0600 terminal result whether compatibility passes or
  fails. Record only non-secret request/response evidence, latency, invocation
  count, reservation, hashes, and terminal outcome; scan the private artifacts
  for the credential bytes without printing them.
- Pre-register P-set 32 before dispatch. After the one invocation, record the
  measured count, latency, compatibility outcome, and `$0.05` uncertain fresh
  accounting in `STATUS.md` whatever they are. Historical BRN-0017 remains
  6/10 and consumed BRN-0020 remains unchanged.

## Out Of Scope

- No Responses generation request, answer model output, memory tool execution,
  embedding, writer, reducer, graph extraction, benchmark question, judge,
  rerun, repair retry, resume, replacement identity, regrade, or publication.
- No claim that input counting is free and no settlement below the full
  reservation without explicit official billing evidence. This probe's
  compatibility result is not a price measurement.
- No read, copy, open, mutation, or deletion of BRN-0017/BRN-0020 private or
  sealed artifacts. No U8 access and no change to historical 6/10.
- No API-key creation or plaintext display. Reuse the already founder-selected
  local `OPENAI_API_KEY`; read it only after every non-secret gate passes and
  never persist it.
- No integration into the benchmark launcher. A later integration and any
  benchmark run require separate reviewed work and fresh founder authority.

## Acceptance Criteria

1. P-set 32 is FINAL before dispatch and predicts one HTTP 200 response, one
   strict parser acceptance, a positive safe-integer exact count, and zero
   generation/provider calls beyond the one count request. Failure is recorded
   rather than retried.
2. The exact body uses `gpt-5.6-sol`, instructions, one structured
   `input_text` user message, and one strict function tool with
   `additionalProperties: false`; it contains none of `max_output_tokens`,
   `store`, `service_tier`, or `reasoning`, which are not part of the official
   count examples being compatibility-tested.
3. Offline contracts prove that invalid authority, dirty/unpushed head,
   existing namespace, cap mismatch, or malformed response fails closed; all
   pre-dispatch failures make zero credential reads, zero transport calls, and
   zero result artifacts.
4. The one-shot lifecycle durably reserves the full `$0.05` before the single
   injected transport call, admits at most one call even on failure, never
   retries, and refuses every later invocation for the consumed identity.
5. Success requires exact HTTP 200 JSON, documented object branding, and a
   positive safe-integer `input_tokens`. The terminal bundle records the exact
   count, request/response hashes, latency, and one invocation with no API key
   match and complete mode-0600 files.
6. A transport, HTTP, JSON, schema, seal, or credential-scan failure is terminal
   and preserves the full `$0.05` as uncertain/accounted. It grants no rerun,
   replacement, or fallback result.
7. The freeze is committed, pushed, independently reviewed with no P0-P3
   finding, and receives a new exact founder authorization naming BRN-0022,
   the identity, one invocation, and both caps before the live command runs.
8. Focused tests, full `npm test`, `npm run quickstart`, syntax/diff, ticket,
   and governed committed-plus-dirty scope checks pass. `STATUS.md` records the
   terminal live result whatever it is and leaves historical BRN-0017 at 6/10.

## Ticket Completion Contract

### Definition Of Done

- One terminal private artifact proves or disproves the structured Sol
  input-count wire with exactly one physical count request and no generation.
- The result supplies the live compatibility fact required before integrating
  exact preflight reservation into another governed evaluation launcher.

### Expansion Rules

- If the endpoint rejects this frozen body, record and seal the rejection.
  Do not simplify the payload and retry under this identity.
- If the full `$0.05` cannot be durably reserved and reconciled, stop before
  transport. Do not assume the count request is free.
- If correct implementation needs a tracked path outside `allowed_paths`, stop
  for founder scope reconciliation rather than widening after work begins.

## Verification

- `node --test tests/openai-input-count-probe.contract.test.mjs tests/openai-input-reservation.contract.test.mjs`
- `node /home/quetza/palari-brain-private/openai-input-count-wire-probe.mjs --verify`
- `npm test`
- `npm run quickstart`
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0022`
- `npm run ticket -- check BRN-0022`
- `git diff --check main...HEAD`

## Stop Conditions

- Stop if the work needs a path outside `allowed_paths` or touches `forbidden_paths`.
- Stop before any provider dispatch or spend until the freeze is clean, pushed,
  independently reviewed, and the founder provides the exact new authorization.
- Stop after the first transport attempt, regardless of success or failure.
- Stop rather than accessing a sealed benchmark artifact, U8, or any prior
  private result namespace.

## Offline Freeze Evidence

- P-set 32 is FINAL. The exact structured request SHA-256 is
  `805097ec9d165fb5206ea3ef5429ffd27b985572dea3362d3b635b7550669561`.
  It contains the frozen Sol model, instructions, one structured user text
  item, and one strict function-tool schema, with no generation-only fields.
- The tracked runner imports BRN-0021's immutable counter/parser, admits one
  injected transport only after exact authority/head/cap/namespace checks and
  durable reservation, and seals compatible or failed outcomes without a
  fallback. The full `$0.05` remains uncertain/accounted.
- The private mode-0600 launcher is outside git at SHA-256
  `98c5a9e57804f5ea4ccd5e9c6dcb91de716d69a355a9fe6acb4c49658d933689`.
  Provider-free `--verify` passes and reports the result namespace absent.
- Focused contracts initially passed 19/19. Full suite passed 758, failed 0,
  and skipped 15
  optional tests across 773. No live run has occurred: credential reads,
  network requests, provider calls, generation, private benchmark access, and
  spend remain `0 / 0 / 0 / 0 / 0 / $0.00`; cumulative accounted remains
  exactly `$7.75502179`.
- The freeze still requires clean pushed committed scope, an independent
  reviewer with no P0-P3 finding, and the exact fresh founder authorization.

## Review Repair

- Independent review of exact pushed head `a51d10c` reopened one P1 and one
  P3. The P1 reproduced a symlinked `.palari-input-count` root that redirected
  every private artifact outside the repository, and found that first creation
  synced the new root but not its `repoRoot` parent. The P3 found trailing
  whitespace introduced when the workflow cleared claim fields.
- The cumulative repair rejects symlink/non-directory/physically escaped roots
  before result creation, holds open physical root and identity descriptors,
  writes every artifact through `/proc/self/fd`, and syncs `repoRoot` after
  first root creation before any reservation can complete. Permanent symlink
  escape and fresh physical-directory regressions now pass. Ticket whitespace
  is removed.
- Repaired focused contracts pass 21/21; full suite passes 760, fails 0, and
  skips 15 optional tests across 775; quickstart passes 6/6; provider-free
  verify, ticket/report, governed scope, syntax, and diff checks pass. Fresh
  independent cumulative rereview remains required before the founder dispatch
  gate may open.
- Fresh cumulative rereview of pushed head `69fec72` confirmed the symlink,
  parent-sync, and whitespace repairs, then reopened one further P1: the
  exported store accepted caller-supplied `../outside-result` because its
  normalized string comparison did not establish containment. A provider-free
  reproduction wrote all artifacts outside `repoRoot`.
- The store now accepts only the frozen single segment `.palari-input-count`;
  `..`, `../outside-result`, absolute, and normalized traversal variants fail at
  construction before filesystem access. The permanent regression passes and
  repaired focused contracts are 22/22; the full suite passes 761 / fails 0 /
  skips 15 optional tests across 776; quickstart passes 6/6; provider-free
  verify, ticket/report, governed scope, syntax, and diff checks pass. A fresh
  independent cumulative rereview was required before dispatch authority.
- Third fresh cumulative review of exact clean pushed head `457bfbe` replayed
  every retained defect, found no P0-P3 issue, and recommends the freeze for
  founder-gated dispatch. It confirmed focused 22/22, recorded full 761/776
  with 15 optional skips, quickstart 6/6, clean ticket/scope/syntax/diff/head/
  upstream state, exact launcher mode/hash, absent namespace, and zero live or
  credential activity. This recommendation is not founder authority.

## Terminal Evidence

- The founder supplied the exact reviewed authority. Identity
  `openai-structured-input-count-compat-v1` ran once and is consumed.
- The one `POST /v1/responses/input_tokens` request returned HTTP 200. The
  strict parser accepted **77** exact input tokens. Latency was **1,277 ms**
  and invocation count was 1.
- No generation, answer, memory tool execution, embedding, writer, judge,
  retry, or fallback occurred.
- Fresh `$0.05` remains uncertain/accounted; cumulative accounted is exactly
  `$7.80502179`. This does not assert that the provider charged `$0.05`.
- All three private artifacts are mode 0600 and rehash. Credential matches are
  0; external manifest SHA-256 is
  `9607c0c97862c5c54593d07d599d79b61d4eae0a8223f014c6f09d1271936d69`.
- Historical BRN-0017 remains 6/10. The result grants no retry, replacement,
  regrade, benchmark run, or publication.

Independent terminal review of exact pushed head `50e606f` validated all
private technical evidence but reopened one P2 tracked-record defect: stale
pre-run sentences contradicted the terminal namespace, compatibility, and
accounting state. This documentation-only repair makes those statements
explicitly historical. The consumed private result was not rerun or mutated;
fresh narrow rereview remains required.

The first narrow rereview of repaired head `205ca89` found one remaining P2:
the bullet above still said terminal review remained while the next paragraph
recorded its completion. That stale clause is removed. No private artifact,
technical result, accounting value, or historical score changed.

Final fresh narrow rereview of exact clean pushed head `36fafc8` found no
P0-P3 issue. It confirmed the stale clause is gone, the three-file delta is
documentation-only, HEAD equals upstream, ticket/report/diff/scope checks pass,
and every sealed fact remains unchanged. The reviewer recommends ACCEPT.
BRN-0022 is accepted under the founder's standing delegation for clean,
independently reviewed tickets; merge is next.

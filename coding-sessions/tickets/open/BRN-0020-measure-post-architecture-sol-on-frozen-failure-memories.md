---
id: BRN-0020
title: "Measure post-architecture Sol on frozen failure memories"
stream: evaluation
level: 1
parent_id:
root_id: BRN-0020
children: []
status: in-review
risk: R3
priority: P0
agents_allowed: 1
claimed_by:
claimed_at:
target_branch: "main"
branch: "ticket/BRN-0020-measure-post-architecture-sol-on-frozen-failure-memories"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0020-measure-post-architecture-sol-on-frozen-failure-memories"
allowed_paths:
  - "evals/predictions.md"
  - "STATUS.md"
  - "docs/DECISIONS.md"
  - "coding-sessions/tickets/open/BRN-0020-*.md"
  - "coding-sessions/tickets/closed/BRN-0020-*.md"
  - "coding-sessions/reports/BRN-0020-*.md"
  - "coding-sessions/human-report/BRN-0020-*.md"
  - "coding-sessions/handoffs/BRN-0020-*.md"
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
  - "node /home/quetza/palari-brain-private/post-architecture-sol-frozen-four-live-launcher.mjs --verify"
  - "npm test"
  - "npm run quickstart"
created: 2026-08-05
updated: 2026-08-05
---

# BRN-0020 Measure post-architecture Sol on frozen failure memories

## Goal

Measure the accepted BRN-0019 architecture on the same four immutable failure
questions used by the pre-architecture Sol control. Start from exact sealed
BRN-0017 memory databases, not frozen answer contexts, and let Sol/low execute
the current end-to-end retrieval plan, timeline/read, semantic/Ettin search,
and evidence-use commitment once. This is a post-change causal diagnostic, not
a rerun or regrade of BRN-0017.

## Context And Proposed Authority

BRN-0019 is accepted and merged at `146d911`; its offline contracts pass all
four failure shapes. BRN-0018 provides the pre-change Sol result on frozen Luna
contexts: Phone passed, Miami failed, Instant Pot honestly lacked source
evidence, and Tokyo reused old Palari advice. The post-change treatment must
therefore start before retrieval while holding the original canonical memory
state and question fixed.

Identity `j4-sol-frozen-failures-post-architecture-v1` is proposed for one
invocation. Opening cumulative accounted spend is exactly `$7.67192994`.
Proposed limits are `$0.50` fresh and `$8.17192994` cumulative accounted. These
numbers are a preregistration boundary only; they are not founder authority.

## Scope

- Rehash the accepted BRN-0017 terminal manifest and copy only the four sealed
  SQLite memory databases for `09d032c9`, `0977f2af`, `0a34ad58`, and
  `0edc2aef` into a fresh private one-shot namespace. Never open the sealed
  sources writable and never mutate or replace their bytes.
- Rehash and bind the exact BRN-0019 product cut, current OpenAI answer wire,
  Gemini embedder, native Ettin runtime/model closure, four question objects,
  P-set, private launcher, clean pushed authority commit, caps, and absent
  result identity before credential access.
- Use `gpt-5.6-sol`, low reasoning, explicit `service_tier: "default"` on both
  the actual request and accepted response, no-store, 512
  maximum output tokens, the accepted six memory tools, strict modern
  `palari_answer_commit`, at most one zero-budget plan, at most four evidence
  retrieval calls, and at most seven OpenAI dispatches per answer.
- Reuse the already accepted Gemini semantic embedder and local native Ettin
  reranker. Every live request reserves durably before dispatch. No writer or
  official benchmark judge runs; this compares retrieval/evidence use, not a
  new LongMemEval score.
- Run one unrelated answer compatibility smoke first on a fresh copy of the
  sealed BRN-0017 smoke database. It must return a valid modern commitment on
  the current wire. Failure consumes and seals the identity before the four
  questions.
- Then answer the four fixed questions in order exactly once. Preserve raw
  tool transcripts, canonical returned rows, plan, commitments, temporary
  inferences, answer text, latency, usage, retrieval/rerank telemetry, and the
  five separate, non-aliased metric surfaces. The run seals equivalent-fact
  and materially-used surfaces as explicit pending/null judged records; one
  independent terminal reviewer labels them exactly once from the sealed raw
  trace, without mutating the bundle or canonical truth.
- Grade only the preregistered architecture acceptance observations and record
  whatever happens in `STATUS.md`. No replacement identity, reroll, selective
  retry, repair-in-place, regrade, or publication.

## Out Of Scope

- No writer, ingestion, reducer, graph extraction, benchmark judge, official
  score, first-ten rerun, dataset change, memory repair, product/prompt tuning,
  answer leakage, benchmark-specific production rule, publication, or U8
  access.
- No mutation of BRN-0017, BRN-0018, or BRN-0019 artifacts and no change to the
  historical 6/10 or the pre-architecture Sol diagnostic.
- No provider or credential access until P-set 30 is FINAL, the freeze is
  pushed and independently reviewed, and the founder authorizes this exact
  identity with exact fresh/cumulative caps. Existing API-key reuse permission
  does not authorize a new invocation.

## Acceptance Criteria

1. Provider-free verification rehashes all source/product/runtime artifacts,
   proves the four copied databases and questions are exact, proves the result
   identity is absent, and fails before credential or transport when authority
   commit/cap binding is wrong.
2. P-set 30 is FINAL before any credential read. It predicts Phone, Instant
   Pot, Tokyo, and Miami separately across exact-span recall, selected
   evidence, declared answer use, temporary inference, compatibility, and
   accounting, failing categories first.
3. An independent reviewer confirms no benchmark answer or route entered the
   launcher/product; source databases are read-only inputs; current product
   hashes, one-shot lifecycle, cap/meter/seal, and new wire are exact.
4. After exact founder authorization, one invocation first performs the smoke,
   then executes all four questions once unless a terminal failure stops it.
   Each physical call is durably reserved before dispatch and no cell is
   retried, resumed, rerolled, or replaced.
5. Phone returns and materially uses the original user statement establishing
   the existing power bank. Instant Pot returns the original user statement
   identifying the Instant Pot before the final answer. Tokyo returns and
   selects original user Suica and TripIt statements, not old Palari advice.
   Miami selects both view and private-balcony-hot-tub evidence, combines them
   in the answer, and records any cross-city transfer only as a provenance-
   linked `revisable: true` temporary inference.
6. The report keeps session recall, exact-span recall, judged equivalent-fact
   recall, selected evidence, and judged materially-used evidence distinct.
   The run computes structural values and leaves both semantic surfaces
   explicitly pending for one independent terminal judgment.
   `consequence_for_answer` and `not_used_reason` remain declarations; judged
   labels are not stored as canonical truth or written back into the seal.
7. `STATUS.md` records the terminal outcome, raw diagnostic grades, usage,
   latency, measured/uncertain spend, and seal whatever they are. Historical
   BRN-0017 remains 6/10 and BRN-0018 remains immutable.

## Ticket Completion Contract

### Definition Of Done

- One sealed non-rerunnable post-architecture Sol diagnostic exists, or one
  honestly sealed terminal compatibility/pre-dispatch failure exists.
- The comparison explains whether accepted retrieval/use architecture changes
  the four failures; it does not create an official benchmark score.

### Expansion Rules

- If exact sealed databases cannot be reused read-only, stop. Do not rebuild,
  reingest, or repair memory inside this identity.
- If the accepted product path needs code or prompt changes, stop and open a
  separate product ticket. Never tune against these four questions here.
- If the proposed cap is insufficient, terminate and record the outcome. Do
  not request a top-up for the consumed identity.

## Verification

- `node /home/quetza/palari-brain-private/post-architecture-sol-frozen-four-live-launcher.mjs --verify`
- `npm test`
- `npm run quickstart`
- `npm run ticket -- check BRN-0020`
- `git diff --check main...HEAD`

## Stop Conditions

- Stop if the work needs a path outside `allowed_paths` or touches `forbidden_paths`.
- Stop before any credential, inference, provider, result-namespace, or spend
  action until the exact identity/caps receive fresh founder authorization.
- Any compatibility, hash, meter, cap, provider, parse, artifact, or seal
  failure is terminal and grants no retry or replacement.

## Offline Freeze Evidence

- P-set 30 is FINAL. Private launcher SHA-256 is
  `7ff8bb0f1719ce2e9b5495c4c93ef1460c7eeec0698a9e2727ada8e9b907d52d`;
  `node --check` and provider-free `--verify` pass.
- All 74 BRN-0017 artifacts rehash under terminal manifest
  `850ca100...`. The smoke plus four database bytes/canonical-row hashes match,
  and six preregistered original-user evidence IDs/content hashes are present.
- Dataset `d6f21e...`, four question/date hashes, accepted product files, normal
  seven-tool hash `cf9074...`, forced-tool hash `89b867...`, and native Ettin
  closure `a0aca4...` match. Result identity is absent.
- Sol Standard pricing is pinned to official `$5/M` input, `$0.50/M` cached
  input, and `$30/M` output, with cache-write/long-context multipliers and
  conservative byte-based pre-dispatch reservations.
- An invalid authority command fails before namespace creation. Credential
  reads / provider calls / inference / spend are `0 / 0 / 0 / $0.00`.
- Full suite: 727 passed, 0 failed, 15 optional skips across 742 tests.
  Quickstart: 6/6. Governed scope and diff checks pass.
- Review of submitted freeze `e1986d9` reopened three issues. The repaired
  launcher file- and directory-syncs reservations before dispatch, emits two
  distinct pending semantic-judgment records, reconciles meter/report/terminal
  evidence, and writes an explicit failed manifest if sealing cannot succeed.
- Rereview of repaired head `08e4a59` reopened two P1 accounting issues and
  one P3 status issue. The cumulative repair forces and validates OpenAI
  Standard/default on the exact metered wire, reserves Gemini embeddings from
  UTF-8 text bytes, retains usage-absent embedding reservations as uncertain,
  and corrects the stale next-step statement.
- Rereview of cumulative head `c12eb73` reopened one P1: missing or coercible
  OpenAI usage could settle a real reservation to zero. The repair requires
  raw own numeric safe-integer input/output/total and cached/cache-write fields
  with consistent totals; any invalid usage is persisted as terminal while the
  full reservation remains uncertain/accounted.

---
id: BRN-0038
title: "Use sparse confirmation findings"
stream: memory
level: 1
parent_id: 
root_id: BRN-0038
children: []
status: in-review
risk: R2
priority: P1
agents_allowed: 2
claimed_by:
claimed_at:
target_branch: "main"
branch: "ticket/BRN-0038-use-sparse-confirmation-findings"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0038-use-sparse-confirmation-findings"
allowed_paths:
  - "src/retrieval-answer.mjs"
  - "tests/answer-confirmation.contract.test.mjs"
  - "STATUS.md"
  - "coding-sessions/tickets/open/BRN-0038-*.md"
  - "coding-sessions/tickets/closed/BRN-0038-*.md"
  - "coding-sessions/reports/BRN-0038-*.md"
  - "coding-sessions/human-report/BRN-0038-*.md"
  - "coding-sessions/handoffs/BRN-0038-*.md"
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
  - "node --test tests/answer-confirmation.contract.test.mjs"
  - "npm test"
  - "npm run quickstart"
  - "npm run test:legacy"
  - "npm run ticket -- check BRN-0038"
created: 2026-08-09
updated: 2026-08-09
---

# BRN-0038 Use sparse confirmation findings

## Goal

Replace confirmation's fragile one-assessment-per-candidate response with a
sparse findings protocol. A reviewer reports only candidate numbers that
materially affect the provisional answer; an empty findings list means the
complete displayed page contains no material evidence.

## Scope

- Bump the opt-in confirmation schema and change only the confirmation review
  tool contract and its host-side interpretation.
- Give every displayed confirmation candidate a short, page-local
  `candidateNumber` from 1 through the delivered page size. The host retains
  the immutable mapping from those numbers to canonical evidence IDs.
- Accept `{ findings: [] }` as the minimal no-material-evidence response. Do
  not require a disposition or explanation for every irrelevant candidate.
- A material finding contains exactly one valid `candidateNumber` and one
  bounded reason. Candidate numbers must be unique integers present on the
  latest unassessed page.
- Treat every unlisted candidate on a successfully reviewed page as
  non-material for this answer journey and make it ineligible for later
  confirmation retrieval. Keep listed findings material and require answer
  revision plus another unseen search.
- Preserve BRN-0036 page semantics: an empty findings list closes only when
  the intended page was fully delivered; character-truncated pages continue;
  an ordinary lower-ranked tail alone does not prevent closure.
- Preserve complete host-side canonical evidence, exact quote validation,
  direct-user-first presentation, provenance-aware duplicate exclusion,
  bounded confirmation work, workspace/user isolation, and zero durable
  writes.
- Add general provider-free contracts for empty findings, sparse material
  findings, invalid/duplicate/out-of-range numbers, legacy payload rejection,
  complete lower-ranked tails, and character-truncated pages.

## Out Of Scope

- No health-device rule, fixed semantic schema, relevance threshold, prompt
  keyword, benchmark identifier, or expected-answer hint.
- No provider call, paid rerun, private artifact mutation, dataset access,
  sealed U8 execution, or benchmark regrade.
- No page-size, excerpt-size, character budget, retrieval-call budget,
  output-token, model, embedding, reranker, bridge, frontier, cost-accounting,
  or durable-memory change.
- No claim that a verbose per-candidate response proved cognitive review; both
  the old and new protocols rely on the fresh reviewer's semantic judgment.

## Acceptance Criteria

1. A complete non-empty candidate page closes from `{ findings: [] }` after one
   review call, including when lower-ranked candidates remain. All displayed
   candidates become reviewed and cannot recur.
2. One or more sparse findings bind explicit, unique page-local candidate
   numbers to the host's immutable evidence IDs, keep confirmation open,
   require answer revision and another unseen search, and remain required in
   the final commitment.
3. Missing, fractional, zero, negative, out-of-range, duplicate, stale, or
   extra-field candidate numbers fail closed. The old ordered `assessments`
   payload also fails closed.
4. Empty findings on a character-truncated page continue to a disjoint unseen
   page; exact canonical validation, direct-user-first ordering, duplicate
   exclusion, and zero durable writes remain intact.
5. Provider-facing instructions ask the one relevant question—whether any
   candidate changes the answer—and do not require repetitive `not_used`
   reasons or opaque evidence-ID reproduction.
6. Telemetry keeps all page evidence reviewed, material findings distinct from
   implicitly ignored candidates, candidate-page completeness separate from
   lower-ranked tail availability, and the schema change explicit.
7. Focused tests, `npm test`, quickstart, the complete legacy suite, ticket
   lint/scope/report checks, diff checks, and independent read-only review pass.

## Ticket Completion Contract

### Definition Of Done

- Confirmation uses one sparse, host-bound findings list and no ordered
  per-memory assessment list.
- General contracts demonstrate safe closure, continuation, rejection, and
  non-recurrence without a live provider call.

### Expansion Rules

- Stop rather than change retrieval ranking, page budgets, model-call counts,
  or answer semantics outside confirmation review.
- Any provider retry/repair policy or live validation belongs to a separate
  founder-authorized ticket.

### Final Review Gate

- A fresh independent reviewer must inspect the committed implementation,
  contracts, schema/instruction change, isolation, and verification evidence.
  Only the founder may accept, merge, or push the implementation.

## Verification

- `node --test tests/answer-confirmation.contract.test.mjs`
- `npm test`
- `npm run quickstart`
- `npm run test:legacy`
- `npm run ticket -- check BRN-0038`
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0038`
- `git diff --check main...HEAD`

## Stop Conditions

- Stop if the work needs a path outside `allowed_paths` or touches `forbidden_paths`.
- Stop before any provider, credential, private artifact, dataset, or sealed U8
  access.
- Stop if sparse output would allow an invalid candidate number, unreviewed
  page, material finding, or duplicate information to be released silently.

## Specialist Closeout

Confirmation v8 now exposes short page-local candidate numbers and accepts
only sparse material findings. Empty findings close a fully delivered page;
material findings bind host-side, force revision and another unseen search,
and remain required in the final answer. All unlisted page candidates become
non-material and cannot recur. Character-truncated pages remain open, and an
ordinary lower-ranked tail remains compatible with closure.

Host validation rejects missing, fractional, zero, negative, out-of-range,
duplicate, stale-review, extra-field, and legacy assessment payloads. The
model never reproduces evidence IDs. Exact canonical validation, direct-user-
first presentation, duplicate-information exclusion, bounded work, isolation,
and zero durable writes are preserved.

Focused tests pass 10/10, the default suite 86/86, quickstart 6/6, and the
complete legacy suite 917 pass / 15 optional skips / 0 fail across 932. Diff
and governed scope are clean. No provider, credential, private artifact,
dataset, or sealed U8 access occurred. Fresh independent review is required
before founder acceptance.

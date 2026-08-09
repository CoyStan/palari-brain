---
id: BRN-0036
title: "Separate confirmation page completeness from ranked tail"
stream: memory
level: 1
parent_id: 
root_id: BRN-0036
children: []
status: open
risk: R2
priority: P1
agents_allowed: 2
claimed_by:
claimed_at:
target_branch: "main"
branch: "ticket/BRN-0036-separate-confirmation-page-completeness-from-ranked-tail"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0036-separate-confirmation-page-completeness-from-ranked-tail"
allowed_paths:
  - "src/retrieval-answer.mjs"
  - "tests/answer-confirmation.contract.test.mjs"
  - "STATUS.md"
  - "coding-sessions/tickets/open/BRN-0036-*.md"
  - "coding-sessions/tickets/closed/BRN-0036-*.md"
  - "coding-sessions/reports/BRN-0036-*.md"
  - "coding-sessions/human-report/BRN-0036-*.md"
  - "coding-sessions/handoffs/BRN-0036-*.md"
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
  - ".palari-alpha/**"
requires_human_confirmation: false
requires_review: true
verification:
  - "node --test tests/answer-confirmation.contract.test.mjs"
  - "npm test"
  - "npm run quickstart"
  - "npm run test:legacy"
  - "npm run ticket -- check BRN-0036"
created: 2026-08-09
updated: 2026-08-09
---

# BRN-0036 Separate confirmation page completeness from ranked tail

## Goal

Make confirmation closure depend on whether the intended candidate page was
fully delivered, not on whether the retrieval engine has any lower-ranked
tail. Preserve the adversarial new-query review while preventing a correct
answer from being forced into an exhaustive corpus scan.

## Scope

- Keep confirmation candidates compact, exact, direct-user-first, and filtered
  against every previously returned, ignored, or duplicate information
  identity.
- Treat character truncation inside the host-owned top-20 page as incomplete
  delivery that requires another duplicate-filtered search.
- Treat a fully delivered top-20 page as reviewable closure: if every displayed
  candidate is explicitly `not_used`, it may close even when lower-ranked
  retrieval candidates exist.
- Keep any material candidate open and require revision plus another search.
- Make provider-facing instructions and telemetry state the distinction
  directly, bumping the confirmation schema if needed to avoid silently
  changing its meaning.
- Add provider-free contracts covering both kinds of tail and preserving
  disjoint pages, exact canonical quote validation, and zero durable writes.

## Out Of Scope

- No provider calls, private evaluation artifact changes, paid rerun, benchmark
  grade, dataset access, or sealed U8 execution.
- No page-size, character-budget, retrieval-call-budget, output-token, model,
  embedding, reranker, or cost-accounting change.
- No relevance threshold, health/device rule, fixed semantic schema, new bridge
  behavior, persistent co-use edge, or durable memory write.
- No relaxation for material candidates, unassessed candidates, duplicate
  information, invalid evidence, or premature commitment.

## Acceptance Criteria

1. A confirmation result that is character-truncated before its host-owned
   top-20 page is fully delivered remains open after all displayed candidates
   are reviewed `not_used`; the next page contains only unseen information.
2. A fully delivered top-20 result whose candidates are all reviewed
   `not_used` closes even when retrieval reports lower-ranked eligible
   candidates beyond that page.
3. Any material candidate still forces revision and another confirmation
   search; exhausting the bounded search budget with unresolved material
   evidence remains a terminal safe failure.
4. Compact excerpts remain exact substrings of full host-side canonical
   messages, direct user evidence remains ahead of derivative Palari anchors,
   and ignored/duplicate evidence cannot recur.
5. Provider-facing instructions and result/review telemetry distinguish
   incomplete page delivery from an ordinary ranked tail without a fixed
   semantic schema.
6. Focused contracts, `npm test`, quickstart, the complete legacy suite, ticket
   lint/scope/report checks, and an independent read-only review pass. No paid
   run is performed.

## Ticket Completion Contract

### Goal

Ship one reviewed closure distinction that preserves the abstract missing-
evidence check without requiring exhaustive retrieval.

### Non-Goals

Do not tune retrieval relevance, increase budgets, specialize for the health
case, or generate new evaluation evidence.

### Definition Of Done

- Product instructions and closure state implement the two-tail distinction.
- General provider-free contracts prove both close and continue paths.
- Required verification and governed reports are committed on the ticket
  branch and the ticket is `in-review`.
- A fresh reviewer recommends `accept`; only the founder may authorize merge
  and push.

### Evidence Required

- Focused confirmation contract output.
- Normal tests, quickstart, and complete legacy results.
- Dirty and committed-plus-dirty scope checks plus `git diff --check`.
- R2 technical report, Level 1 human report, and reviewer note.

### Expansion Rules

- Stop rather than add relevance scoring, another model call, more retrieval
  budget, or any path not declared in this ticket.
- Open a separate ticket for provider-controller behavior after exhausted
  confirmation budget; it is not required to implement this closure rule.

### Final Review Gate

An independent read-only reviewer checks the committed diff and evidence.
The reviewer may recommend acceptance but may not merge or push. Founder
acceptance is required before integration.

## Verification

- `node --test tests/answer-confirmation.contract.test.mjs`
- `npm test`
- `npm run quickstart`
- `npm run test:legacy`
- `npm run ticket -- check BRN-0036`
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0036`
- `git diff --check`

## Stop Conditions

- Stop if the work needs a path outside `allowed_paths` or touches `forbidden_paths`.
- Stop before any credential read, provider call, private artifact mutation,
  dataset access, sealed-U8 execution, or live diagnostic.
- Stop if the change would allow unassessed or material evidence to be released,
  or if it needs a domain-specific relevance rule.

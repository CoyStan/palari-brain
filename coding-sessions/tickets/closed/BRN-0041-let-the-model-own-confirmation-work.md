---
id: BRN-0041
title: "Let the model own confirmation work"
stream: memory
level: 1
parent_id: 
root_id: BRN-0041
children: []
status: accepted
risk: R2
priority: P0
agents_allowed: 1
claimed_by:
claimed_at:
target_branch: "main"
branch: "ticket/BRN-0041-let-the-model-own-confirmation-work"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0041-let-the-model-own-confirmation-work"
allowed_paths:
  - "src/retrieval-answer.mjs"
  - "src/openai.mjs"
  - "tests/answer-confirmation.contract.test.mjs"
  - "tests/openai.contract.test.mjs"
  - "docs/BRAIN-API.md"
  - "STATUS.md"
  - "coding-sessions/tickets/open/BRN-0041-*.md"
  - "coding-sessions/tickets/closed/BRN-0041-*.md"
  - "coding-sessions/reports/BRN-0041-*.md"
  - "coding-sessions/human-report/BRN-0041-*.md"
  - "coding-sessions/handoffs/BRN-0041-*.md"
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
  - "node --test tests/answer-confirmation.contract.test.mjs tests/openai.contract.test.mjs"
  - "npm test"
  - "npm run quickstart"
  - "npm run test:legacy"
  - "npm run ticket -- check BRN-0041"
created: 2026-08-09
updated: 2026-08-10
---

# BRN-0041 Let the model own confirmation work

## Goal

Make answer confirmation a model-owned reasoning loop rather than a normal
two-search state machine. The reviewer may keep finding and investigating
genuinely new information; the host enforces evidence integrity and one
emergency work bound without discarding the latest valid answer.

## Scope

- Give confirmation the existing full retrieval capacity by default instead
  of treating two searches as a product rule. Keep the bound configurable for
  callers and tests as an emergency guard, not a semantic workflow.
- Keep one independent confirmation agent responsible for choosing unseen
  queries, reviewing sparse numbered findings, revising its answer, and
  deciding when no new material information remains.
- Preserve host-side exclusion of every previously returned evidence ID and
  provenance-aware information duplicate. Reviewed unlisted candidates remain
  unavailable for recurrence in the same answer journey.
- Preserve short page-local candidate numbers and immutable host-side mapping
  to canonical evidence IDs.
- Continue to treat relevant prior Palari answers as potentially material
  navigation anchors. Final answer commitments still require returned,
  host-validated evidence; no semantic category or human-authored schema is
  added.
- When the emergency retrieval bound is reached after the latest candidate
  page has been assessed, allow the model's latest host-valid evidence
  commitment to return with explicit bounded-incomplete confirmation
  telemetry. Do not convert normal bounded exhaustion into an exception that
  erases the answer.
- Continue failing closed for invalid evidence, invalid candidate numbers,
  unassessed displayed candidates, source/isolation violations, and malformed
  commitments.
- Update focused provider-free contracts, public API documentation, and
  concise status. Run the complete historical suite because product behavior
  and evaluator compatibility change.

## Out Of Scope

- No paid provider call, private artifact access, dataset execution, sealed U8
  access, benchmark regrade, prompt tuning from a new live answer, or cost-cap
  request.
- No fixed health-device logic, benchmark-specific answer rule, semantic
  ontology, or rule that prior Palari text is automatically irrelevant.
- No retrieval ranking, embedding, reranker, bridge, durable memory, co-use
  edge, identity, admission, correction, deletion, or workspace change.
- No requirement that confirmation prove global completeness. Its status is
  an honest bounded review result.

## Acceptance Criteria

1. The default confirmation loop is not limited to two searches and the model
   remains free to choose its own unseen queries and revisions within one
   emergency bound.
2. A material sparse finding still keeps review open; unlisted candidates and
   duplicate information cannot recur; a clean complete review still closes.
3. At emergency exhaustion, a latest valid commitment whose displayed page is
   fully assessed returns as the answer with an explicit incomplete status,
   exhaustion telemetry, and its host-validated evidence. It is not silently
   described as fully confirmed.
4. Emergency exhaustion cannot bypass review of a displayed page, validate an
   unknown/duplicate evidence ID, or accept malformed candidate findings.
5. The OpenAI adapter does not throw solely because the model made a valid
   commitment after using all confirmation searches; other provider and
   commitment failures remain errors.
6. Provider-free tests cover multiple material rounds followed by clean
   closure, bounded best-effort return, invalid bypass rejection, unseen-only
   candidate behavior, and historical compatibility.
7. Focused tests, `npm test`, quickstart, legacy tests, ticket gates, scope
   checks, and diff checks pass. Independent review finds no unresolved P0-P2
   issue before founder acceptance.

## Ticket Completion Contract

### Definition Of Done

- Confirmation behaves as one model-directed loop with minimal host safety
  boundaries and does not discard a valid answer merely because its emergency
  bound was reached.
- Documentation distinguishes closed confirmation from bounded-incomplete
  best effort.

### Expansion Rules

- Prefer deleting or consolidating control logic over adding another semantic
  state machine.
- If the change requires domain-specific meaning, another provider, or a paid
  validation, stop and request founder direction.

### Final Review Gate

- R2 independent review is required. The implementer may submit the committed
  diff but may not accept, merge, or push the implementation without founder
  acceptance.

## Verification

- `node --test tests/answer-confirmation.contract.test.mjs tests/openai.contract.test.mjs`
- `npm test`
- `npm run quickstart`
- `npm run test:legacy`
- `npm run ticket -- check BRN-0041`
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0041`
- `git diff --check main...HEAD`

## Stop Conditions

- Stop if the work needs a path outside `allowed_paths` or touches `forbidden_paths`.
- Stop before any provider, credential, private artifact, dataset, or sealed U8
  access.
- Stop if the model-owned loop would weaken canonical evidence validation,
  duplicate exclusion, user/workspace isolation, or the emergency hard bound.

## Specialist Closeout

Confirmation v9 removes two searches as the normal workflow. The independent
reviewer now receives the existing full four-search allowance by default and
owns its semantic queries, sparse findings, revisions, and stopping decision.
The host continues to exclude previously returned and duplicate information,
bind short candidate numbers to canonical IDs, require complete page review,
and validate every committed evidence basis.

When the emergency allowance ends after the latest page was assessed, the
OpenAI adapter asks the host to validate the model's newest commitment as
bounded best effort. A valid commitment returns with explicit
`bounded_incomplete` telemetry instead of becoming an exception. Premature
bounded commits, unassessed pages, forged IDs, malformed findings, and all
other commitment failures remain rejected. Normal clean closure is unchanged.

The default OpenAI dispatch ceiling is 11, leaving room for the model-directed
review while remaining finite. Initial independent review found that a
premature last-page commit could lose the host's pending-review rejection and
that malformed bounded commitments skipped their normal repair. The adapter
now returns the former to the model and gives the latter one repair; real
host-plus-adapter contracts cover both paths. Focused tests pass 41/41, the
core suite passes 87/87, quickstart passes 6/6, and legacy passes 921 with 15
optional skips and zero failures across 936 tests. No provider, credential,
private artifact, dataset, or sealed U8 was accessed. The corrected committed
diff requires fresh independent R2 review before founder acceptance.

A second independent review found that recommendation-mode commitments
returned before the material-evidence completeness check. The host could
therefore accept an Atlas-only recommendation after the model had already
marked the newer Nova preference material. The fix does not decide semantic
materiality: it simply requires a non-abstaining recommendation to cite each
finding the reviewer itself marked material. Real OpenAI integration tests
cover both clean closure and bounded-incomplete repair. Focused tests now pass
43/43; core remains 87/87; quickstart remains 6/6; legacy passes 923 with 15
optional skips and zero failures across 938 tests. Fresh independent review is
still required.

A fourth independent review found no remaining P0 or P1 code defect and
reopened only two stale API statements. The API now uses the actual
eleven-dispatch emergency ceiling and documents the confirmation-only rule
that non-abstaining recommendations cite evidence the reviewer itself marked
material. The correction requires documentation verification before founder
acceptance.

A third independent review found a race available to custom providers that do
not await retrieval: the final allowed search incremented the call count
before its new page replaced the previously assessed page, so bounded commit
could pass while that search was outstanding. The host now tracks pending
confirmation searches, rejects concurrent searches, and rejects bounded
completion until no search is pending. A real 20-plus-one candidate regression
proves the final unseen item must settle and be reviewed. Focused tests pass
44/44, core passes 88/88, quickstart passes 6/6, and legacy passes 924 with 15
optional skips and zero failures across 939 tests. Fresh independent review is
still required.

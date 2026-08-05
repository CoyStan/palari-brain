---
id: BRN-0019
title: "Add provenance-aware retrieval planning and evidence use"
stream: memory
level: 1
parent_id: 
root_id: BRN-0019
children: []
status: claimed
risk: R3
priority: P0
agents_allowed: 1
claimed_by: "quetza"
claimed_at: 2026-08-05T01:01:42Z
target_branch: "main"
branch: "ticket/BRN-0019-add-provenance-aware-retrieval-planning-and-evidence-use"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0019-add-provenance-aware-retrieval-planning-and-evidence-use"
allowed_paths:
  - "src/retrieval-plan.mjs"
  - "src/retrieval-answer.mjs"
  - "src/openai.mjs"
  - "src/index.mjs"
  - "evals/retrieval-evidence-metrics.mjs"
  - "tests/retrieval-plan.contract.test.mjs"
  - "tests/retrieval-answer.contract.test.mjs"
  - "tests/openai.contract.test.mjs"
  - "tests/retrieval-evidence-metrics.contract.test.mjs"
  - "docs/BRAIN-API.md"
  - "STATUS.md"
  - "docs/DECISIONS.md"
  - "coding-sessions/tickets/open/BRN-0019-*.md"
  - "coding-sessions/tickets/closed/BRN-0019-*.md"
  - "coding-sessions/reports/BRN-0019-*.md"
  - "coding-sessions/human-report/BRN-0019-*.md"
  - "coding-sessions/handoffs/BRN-0019-*.md"
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
  - "node --test tests/retrieval-plan.contract.test.mjs tests/retrieval-answer.contract.test.mjs tests/openai.contract.test.mjs tests/retrieval-evidence-metrics.contract.test.mjs"
  - "npm test"
  - "npm run quickstart"
created: 2026-08-05
updated: 2026-08-05
---

# BRN-0019 Add provenance-aware retrieval planning and evidence use

## Goal

Make Palari distinguish evidence delivery from evidence selection and answer
use, while giving temporal/relational questions a general, provenance-safe
planning path. The product must retrieve the original canonical user evidence
for relational questions, explicitly say how selected memories affect (or do
not affect) the answer, and keep cross-context inferences ephemeral.

## Scope

- Add one provider-neutral, session-ephemeral retrieval-plan contract with
  `anchor_event`, `relation`, `category`, and an optional ISO `time_range`.
  Planning is not a search and does not consume the four-call retrieval budget;
  at most one plan may be registered per answer. The plan is trace metadata,
  never durable memory.
- Teach the answer path and OpenAI adapter to expose and preserve the plan.
  Temporal/relational instructions must tell the model to identify the anchor,
  relation, category, and time range, locate the anchor if needed, then orient
  with timeline and read complete canonical source messages. Product code may
  not contain benchmark-question IDs, answer keywords, or per-case routing.
- Replace model-authored bare evidence bases on the active answer wire with
  structured memory commitments. Each selected memory carries an exact quote
  and exactly one non-empty `consequence_for_answer` or `not_used_reason`.
  Retrieved rows that the model does not select need no commitment. The host
  derives backward-compatible used `answerEvidence` from commitments whose
  consequence is non-empty.
- Add an explicit temporary-inference envelope. Every cross-context inference
  must be provenance-linked to returned canonical evidence, marked
  `revisable: true`, and returned only in the answer trace. The answer path
  must expose no write or admission path for it.
- Add provider-free evaluation telemetry that reports five separate surfaces:
  session recall, exact-span recall, equivalent-fact recall, selected evidence,
  and materially used evidence. Equivalent-fact and materially-used inputs are
  explicit judged labels with their judged status preserved; neither may be
  inferred, stored, or represented as canonical truth.
- Add deterministic provider-neutral and exact OpenAI-wire contracts for the
  four historical failure shapes named by the founder: Phone, Instant Pot,
  Tokyo, and Miami. These are acceptance fixtures, not production keyword
  rules and not a regrade.
- Document the public contracts, update the decision/status records, and keep
  the basic memory journey green.

## Out Of Scope

- No live provider call, credential access, new result identity, spend,
  LongMemEval score, judge, reroll, regrade, or publication. The required
  post-change Luna/Sol comparison is a successor founder-gated evaluation with
  a fresh preregistration and cap.
- No change to the immutable BRN-0017 6/10 or any historical transcript,
  answer, label, bundle, or prediction.
- No benchmark-specific keyword, question-ID, expected-answer, session-ID, or
  fixed-date rule in product code. Acceptance fixture literals remain tests.
- No durable inferred preference, new admission shortcut, automatic graph
  extraction, embedding/reranker change, retrieval-budget increase, or model
  default change.
- No claim that a declared `consequence_for_answer` proves material use. The
  materially-used metric remains an external judged label.

## Acceptance Criteria

1. A validated plan records exactly anchor event, relation, category, and time
   range; is immutable and session-local; consumes zero retrieval calls; and
   cannot be registered twice, persisted, or smuggled into a memory write.
2. The general temporal/relational contract requires plan -> anchor location
   when needed -> timeline -> canonical read, without a production literal for
   Phone, Instant Pot, Suica, TripIt, Tokyo, Miami, view, balcony, or hot tub.
3. Every selected memory commitment uses evidence returned in the current
   answer session and an exact contiguous quote, then has exactly one bounded
   non-empty `consequence_for_answer` or `not_used_reason`. Unselected returned
   rows are allowed; duplicate IDs, invented evidence, ambiguous use fields,
   accessors, prototype tricks, and mutation races fail closed.
4. Temporary cross-context inferences cite returned evidence, require
   `revisable: true`, state their consequence, survive only in the returned
   answer trace, and leave the canonical journal byte-for-byte/logically
   unchanged. The Miami fixture combines view and balcony-hot-tub evidence in
   the answer while the Seattle-to-Miami transfer remains temporary.
5. The Phone fixture's commitment and answer explicitly incorporate the
   user's existing portable power bank.
6. The Instant Pot fixture registers a general before/anchor/category plan and
   returns the original Instant Pot user statement through timeline/read before
   the answer provider commits its answer.
7. The Tokyo fixture returns the original user Suica and TripIt statements
   through timeline/read and selects those statements, not old Palari answers,
   before committing the personalized answer.
8. Telemetry returns five non-aliased metric objects. Session and exact-span
   recall derive only from the trace; selected evidence derives only from host-
   accepted commitments; equivalent-fact and materially-used recall accept
   and preserve explicit judged labels. Tests prove a case can pass one surface
   and fail another without changing any other value.
9. The OpenAI tool schema and forced-commit repair use the new exact contract;
   host validation still derives the compatibility `answerEvidence` list and
   retains all retrieval/cap/provenance security properties.
10. Focused tests, full `npm test`, and `npm run quickstart` pass. Documentation
    states that the historical 6/10 is unchanged and a post-change live run
    remains founder-gated.

## Ticket Completion Contract

### Definition Of Done

- All four offline acceptance fixtures pass through the same general product
  path with no per-case production routing.
- The answer trace makes recalled, selected, declared-used, judged-equivalent,
  and judged-materially-used evidence distinguishable.
- No inferred cross-context preference can reach canonical memory.

### Expansion Rules

- If the plan requires automatic semantic classification or another model
  dispatch, stop and open a child ticket; do not hide a provider call in this
  offline unit.
- If a required implementation path is not listed, stop for scope review.
- Any post-change live measurement gets a new ticket, P-set, identity, exact
  cap, and independent pre-dispatch review.

## Verification

- `node --test tests/retrieval-plan.contract.test.mjs tests/retrieval-answer.contract.test.mjs tests/openai.contract.test.mjs tests/retrieval-evidence-metrics.contract.test.mjs`
- `npm test`
- `npm run quickstart`
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0019`
- `npm run ticket -- check BRN-0019`
- `git diff --check main...HEAD`

## Stop Conditions

- Stop if the work needs a path outside `allowed_paths` or touches `forbidden_paths`.
- Stop before any credential read, provider invocation, inference, dataset
  access, score, rerun, regrade, or spend.
- Stop rather than encoding any benchmark-specific product rule.

## Implementation Evidence

- One normalized immutable `memory_plan` is trace-only and consumes zero of the
  four evidence-retrieval calls; duplicate or malformed plans fail closed.
- Modern commitments accept only exact returned evidence and require exactly
  one consequence or non-use reason per selected memory. Temporary inferences
  require selected used provenance and `revisable: true`; no write capability
  is exposed.
- Provider-free telemetry returns five independent surfaces and preserves the
  judged authority of equivalent-fact and materially-used labels.
- Phone, Instant Pot, Tokyo, and Miami offline acceptance fixtures all pass the
  general path, and production-source scanning excludes fixture literals.
- Focused tests: 62 passed, 0 failed. Full suite: 725 passed, 15 optional skips,
  0 failed across 740 tests. Quickstart: 6/6. Scope and diff checks pass.
- Historical BRN-0017 remains 6/10. Credential/provider/spend activity is
  `0 / 0 / $0.00`; cumulative accounted spend remains `$7.67192994`.

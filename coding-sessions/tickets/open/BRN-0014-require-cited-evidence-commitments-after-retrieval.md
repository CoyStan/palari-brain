---
id: BRN-0014
title: "Require cited evidence commitments after retrieval"
stream: retrieval
level: 1
parent_id: 
root_id: BRN-0014
children: []
status: open
risk: R3
priority: P0
agents_allowed: 1
claimed_by:
claimed_at:
target_branch: "main"
branch: "ticket/BRN-0014-require-cited-evidence-commitments-after-retrieval"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0014-require-cited-evidence-commitments-after-retrieval"
allowed_paths:
  - "src/retrieval-answer.mjs"
  - "src/openai.mjs"
  - "tests/retrieval-answer.contract.test.mjs"
  - "tests/openai.contract.test.mjs"
  - "evals/run-answer-interpretation-regression.mjs"
  - "tests/answer-interpretation-regression.contract.test.mjs"
  - "docs/BRAIN-API.md"
  - "docs/DECISIONS.md"
  - "STATUS.md"
  - "coding-sessions/tickets/open/BRN-0014-*.md"
  - "coding-sessions/tickets/closed/BRN-0014-*.md"
  - "coding-sessions/reports/BRN-0014-*.md"
  - "coding-sessions/human-report/BRN-0014-*.md"
  - "coding-sessions/handoffs/BRN-0014-*.md"
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
  - "node --test tests/retrieval-answer.contract.test.mjs tests/openai.contract.test.mjs tests/answer-interpretation-regression.contract.test.mjs"
  - "npm test"
  - "npm run quickstart"
created: 2026-08-04
updated: 2026-08-04
---

# BRN-0014 Require cited evidence commitments after retrieval

## Goal

Prevent an answer provider from silently ignoring canonical evidence it just
retrieved. Add a provider-neutral, host-validated answer-commit boundary and
make the Luna adapter use it with exact evidence IDs and quotes before Palari
accepts a post-retrieval answer or abstention.

## Context And Authority

BRN-0013 is accepted and merged at `44ddfb8`. Its one live identity proved
Ettin/Luna integration and 12/13 required-session retrieval, but three official
FAIL rows had complete target evidence and then produced generic or false-
absence answers. A fourth official FAIL was a judge false negative and belongs
to a separate evaluation ticket. Quetzali directed autonomous governed fixes
until a CEO-level blocker. This unit is the smallest offline product repair for
the three answer-use failures; it neither touches the judge nor authorizes a
new score.

## Scope

- Extend `answerWithRetrieval()` with a host-owned `commitAnswer()` callback
  that validates a structured final proposal against canonical evidence
  actually returned during this answer session.
- A post-retrieval commitment contains non-empty answer text, explicit
  `abstained`, and at least one evidence basis item with a consulted evidence
  ID plus a non-empty exact contiguous quote from that canonical row. Reject
  duplicate/unknown IDs, fabricated/non-contiguous quotes, oversized payloads,
  malformed fields, provider-authored provenance, and mutation.
- Track committed responses by object identity inside the host call. A provider
  that declares evidence commitments required cannot forge or bypass the
  callback after any canonical row was returned. Preserve direct digest-only
  and genuinely empty-retrieval answers without manufacturing citations.
- Add a private OpenAI function tool for the answer commitment. It is not a
  memory retrieval tool, does not consume the four-call memory budget, and can
  never read/write the journal. After any non-empty retrieval, reject raw free
  text and accept only a host-validated commitment.
- Keep normal memory tools available until the answer model commits or spends
  the memory-call budget. At forced finalization, expose only the commitment
  tool and force it; no memory tool remains callable. Permit at most one
  host-guided commitment repair after malformed/unsupported/fabricated basis,
  with the exact rejection reason but no hidden answer or benchmark label.
- Return immutable answer-basis telemetry from `answerWithRetrieval()` so
  consumers can audit which exact evidence the model declared it used. This is
  provenance, not host endorsement that the prose logically follows.
- Strengthen the provider-free regression with heterogeneous synthetic cases:
  prior resource personalization, prior Palari advice, multi-row composition,
  irrelevant non-empty results, conflict, and honest empty retrieval. Fixtures
  must not copy BRN-0013 questions, answers, session IDs, or wording.
- Document the additive contract, compatibility boundary, latency behavior,
  product stop rule, and fresh independent review.

## Out Of Scope

- No provider/model call, credential read, spend, benchmark row, terminal
  bundle mutation, rerun, regrade, new prediction, or live identity.
- No known BRN-0013 answer/reference/session text in source, tests, fixtures,
  tool descriptions, prompts, or validation rules. No lexical answer checker,
  case-specific keyword, or assumption that citation proves semantic truth.
- No retrieval ranking, Ettin, embedding, graph, reducer, gate, database,
  memory schema, judge, public score, or provider pricing change.
- No automatic second generation for a valid commitment. The one repair is
  only for a structurally invalid commitment or raw post-retrieval message and
  remains inside the absolute OpenAI dispatch ceiling.

## Acceptance Criteria

1. Every canonical row returned by exact, ranked, semantic, read, or graph
   retrieval is registered by ID/text in the answer-local host boundary. The
   provider cannot register, alter, or cite evidence outside that set.
2. A required committed answer after non-empty retrieval succeeds only through
   the exact callback-returned object and carries one or more unique exact-quote
   bases. Fabricated quotes, unknown IDs, duplicates, empty/oversized text,
   malformed abstention, and forged return objects fail closed.
3. OpenAI offers the five unchanged memory tools plus one private commit tool
   during normal retrieval. A valid commit terminates immediately without a
   second model dispatch; raw text or invalid commit gets at most one
   host-guided forced-commit repair. Forced finalization exposes no memory tool
   and cannot exceed the four-call or seven-dispatch ceilings.
4. Direct digest answers and honest empty-retrieval answers retain their prior
   path. Custom providers remain compatible unless they explicitly declare the
   required-commit capability; the OpenAI Luna adapter declares it.
5. Provider-free real-brain contracts prove exact basis/provenance, prior
   resource personalization, multi-row composition, irrelevant/conflict/empty
   controls, speaker/time boundaries, zero canonical mutation, and terminal
   failure after a bad repair without benchmark-derived content.
6. Focused tests, full suite, quickstart, package dry-run, ticket/report/scope/
   diff checks, and fresh independent review are green with zero model load,
   credential/provider activity, terminal-result change, or spend.

## Ticket Completion Contract

### Definition Of Done

- Core and Luna adapter enforce the same exact-basis commitment contract.
- The synthetic regression proves structural enforcement, not answer quality.
- Documentation states clearly that citations make ignored evidence visible
  and harder, but do not make semantic correctness a host-verified fact.

### Expansion Rules

- If correct support requires a semantic verifier, second model, judge change,
  or benchmark-derived rule, stop and open a separate ticket; do not hide it
  inside quote validation.
- Gemini or another provider may adopt the additive callback later, but this
  ticket changes only the already accepted Luna adapter.

## Verification

- `node --test tests/retrieval-answer.contract.test.mjs tests/openai.contract.test.mjs tests/answer-interpretation-regression.contract.test.mjs`
- `npm test`
- `npm run quickstart`
- `npm pack --dry-run`
- `npm run ticket -- ticket-lint-all`
- `npm run ticket -- report-lint BRN-0014`
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0014`
- `git diff --check main...HEAD`

## Stop Conditions

- Stop if the work needs a path outside `allowed_paths` or touches `forbidden_paths`.
- Stop before any provider/model/network/credential access, package install,
  private dataset/result read, live score, or spend.
- Stop rather than weaken exact canonical quote/ID validation, provenance,
  memory-call/dispatch ceilings, no-store behavior, or the existing admission
  and retrieval boundaries.
- Stop for founder direction if the smallest correct product needs a second
  semantic model, changed provider/model/effort, or a new live identity.

---
id: BRN-0001-A
title: "Stop False Absence After Relevant Retrieval"
stream: answer
level: 2
parent_id: BRN-0001
root_id: BRN-0001
children: []
status: open
risk: R2
priority: P0
agents_allowed: 1
claimed_by:
claimed_at:
target_branch: "ticket/BRN-0001-repair-retrieved-answer-reliability"
branch: "ticket/BRN-0001-A-stop-false-absence-after-relevant-retrieval"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0001-A-stop-false-absence-after-relevant-retrieval"
allowed_paths:
  - "src/brain.mjs"
  - "src/retrieval-answer.mjs"
  - "tests/brain.contract.test.mjs"
  - "tests/retrieval-answer.contract.test.mjs"
  - "docs/BRAIN-API.md"
  - "STATUS.md"
  - "coding-sessions/tickets/open/BRN-0001-A-*.md"
  - "coding-sessions/tickets/closed/BRN-0001-A-*.md"
  - "coding-sessions/reports/BRN-0001-A-*.md"
  - "coding-sessions/human-report/BRN-0001-A-*.md"
  - "coding-sessions/handoffs/BRN-0001-A-*.md"
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
  - "evals/**"
requires_human_confirmation: false
requires_review: true
verification:
  - "node --test tests/brain.contract.test.mjs tests/retrieval-answer.contract.test.mjs"
  - "npm run quickstart"
created: 2026-07-31
updated: 2026-07-31
---

# BRN-0001-A Stop False Absence After Relevant Retrieval

## Goal

Stop Palari from claiming that no relevant memory exists after its own
retrieval transcript has returned canonical rows that directly answer the
question.

## Scope

- Tighten `memoryAnswerSystemInstruction` and
  `MEMORY_RETRIEVAL_INSTRUCTIONS` at the provider-neutral answer boundary.
- Make the evidence-use rule explicit: after a tool result, inspect the rows;
  if a row directly addresses the question, answer from it or state the exact
  conflict/limitation that makes it unusable. Do not emit an unsupported
  absence merely because the active digest was empty.
- Clarify speaker semantics: prior Palari speech may be reused as prior advice
  or a prior recommendation, but it must never be recast as something the user
  said, did, owned, or preferred.
- Preserve the honest case: non-empty but irrelevant search results do not
  force an answer, and truly absent evidence still yields plain honest absence.
- Add adversarial contract tests for prior Palari advice, earlier user-owned
  objects, irrelevant noisy results, correction chronology, and empty results.
- Update the public answer API documentation for the strengthened contract.

## Out Of Scope

- No host-side lexical/fuzzy answer grader, answer rewriting, hidden second
  model, retry, generation schema migration, or provider-specific code.
- No retrieval ranker, embedder, graph, reducer, journal, gate, or storage
  change.
- No live provider call or claim that prompt/contract tests prove model
  compliance.
- No terminal v5 artifact, report, score, rerun, or regrade change.

## Acceptance Criteria

1. The answer instructions distinguish an empty digest from the later tool
   transcript and forbid unsupported absence when directly relevant canonical
   rows were consulted.
2. The instructions explicitly permit using prior Palari advice as advice
   while preserving the rule that Palari speech is not a user fact.
3. Tests prove the exact instruction reaches the provider callback unchanged
   and covers relevant, irrelevant, corrected, and empty retrieval outcomes.
4. No implementation infers support from word overlap or changes the returned
   canonical message bytes, speaker, evidence ID, or timestamp.
5. Existing honest-absence, injection-boundary, bounded-call, and complete
   retrieval contracts remain green.

## Dependency And Order

This is the first executable child. It begins from the clean BRN-0001 parent
branch. BRN-0001-B follows after this child is reviewed and integrated because
both children edit the answer instruction surface.

## Measured Basis

- Terminal `09d032c9` returned its required prior Palari phone/power-bank
  advice as ranks 1 and 2, then answered that no relevant phone-battery memory
  was stored.
- Terminal `0977f2af` returned the earlier Instant Pot user row and the later
  Air Fryer row, made a second Instant-Pot-focused search where the earlier row
  ranked first, then still claimed no earlier gadget memory.
- Retrieval delivery is therefore not the failing category for these cases.

## Ticket Completion Contract

### Goal

Make the provider contract say exactly how relevant retrieved evidence must be
used without weakening speaker truth or honest absence.

### Non-Goals

Do not attempt to prove live model behavior offline or solve general factual
entailment.

### Definition Of Done

- Production instructions and public documentation are updated.
- Focused adversarial tests fail on the old contract and pass on the new one.
- The ticket is committed, scope-clean, and moved to `in-review` with reports.

### Evidence Required

- Focused test output, exact instruction assertions, diff check, dirty and
  committed scope checks, full suite, and quickstart.

### Expansion Rules

If correct behavior requires ranking changes or structured answer citations,
stop and open a separately reviewed child; do not smuggle either into this
prompt-contract ticket.

### Final Review Gate

A fresh reviewer checks that the new rule improves evidence use without
turning irrelevant rows, prior Palari speech, or missing memory into user
facts. Acceptance remains human-controlled.

## Verification

- `node --test tests/brain.contract.test.mjs tests/retrieval-answer.contract.test.mjs`
- `npm test`
- `npm run quickstart`
- `npm run ticket -- scope-check --committed-plus-dirty --target ticket/BRN-0001-repair-retrieved-answer-reliability BRN-0001-A`

## Stop Conditions

- Stop if the work needs a path outside `allowed_paths` or touches
  `forbidden_paths`.
- Stop if the proposed rule treats every non-empty search as relevant, allows
  model-authored provenance, or needs a lexical answer validator.
- Stop before any provider call, eval mutation, spend, or terminal artifact
  change.

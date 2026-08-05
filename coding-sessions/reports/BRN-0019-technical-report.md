# BRN-0019 Technical Report

## Outcome

Palari now separates evidence delivery, selection, declared answer use, and
externally judged material use. Temporal and relational questions can register
one immutable session plan over an anchor event, relation, category, and time
range, then navigate with timeline/read without reducing the four-call evidence
retrieval budget.

The active OpenAI answer commitment requires every selected memory to carry an
exact returned ID/quote plus exactly one non-empty `consequence_for_answer` or
`not_used_reason`. Cross-context inferences are a separate envelope: they must
cite selected used evidence, are always revisable, remain in the answer trace,
and have no admission or journal-write path.

## Files Changed

- `src/retrieval-answer.mjs`: plan registration, bounded use/non-use
  commitments, ephemeral inference validation, and returned trace surfaces.
- `src/retrieval-plan.mjs`: focused public re-export without changing sealed
  historical import closures.
- `src/openai.mjs`: strict Luna/OpenAI tool schema and bounded plan dispatch.
- `src/index.mjs`: public exports through the existing answer module boundary.
- `evals/retrieval-evidence-metrics.mjs`: five non-aliased metrics, with judged
  authority preserved for equivalent-fact and materially-used labels.
- Contract tests: provider-neutral, OpenAI wire, adversarial validation, metric
  separation, and the four founder-named offline acceptance fixtures.
- `docs/BRAIN-API.md`: public planning, commitment, temporary-inference, and
  measurement contracts.

## Acceptance Evidence

- Phone: commits the returned portable-power-bank statement with a concrete
  consequence and explicitly incorporates it in the answer.
- Instant Pot: a general before/anchor/category plan navigates timeline/read to
  the original user statement before answer commitment.
- Tokyo: timeline/read returns and selects the original user Suica and TripIt
  statements; no old assistant answer is used as user evidence.
- Miami: the answer combines view and private-balcony-hot-tub evidence while
  recording the cross-city transfer only as a provenance-linked revisable
  inference; the canonical journal is unchanged.
- Product-source scanning proves the acceptance literals are confined to
  tests, not benchmark-specific routing.

## Verification

- Relevant modules pass `node --check`.
- Focused contract suite: 62 passed, 0 failed.
- Full `npm test`: 740 tests; 725 passed, 15 optional skips, 0 failed.
- `npm run quickstart`: PASS, 6/6 journey stages.
- `git diff --check`: PASS.
- Governed committed-plus-dirty scope check: PASS; final scope is rechecked at
  submission.
- Credential reads / provider calls / inference calls / spend: `0 / 0 / 0 /
  $0.00`.

## Invariants

- BRN-0017 remains historically 6/10; no transcript, answer, label, prediction,
  or result bundle was changed.
- Equivalent-fact and materially-used values are explicit judged labels, not
  canonical truth and not durable memory.
- A provider declaration of consequence is auditable selection/use telemetry,
  not proof of semantic material use.
- Legacy custom-provider bases remain compatible, while the active OpenAI wire
  uses the new exact schema.

## Risks / Follow-Ups

Fresh independent review is required before acceptance. A post-architecture
live comparison is a separate founder-gated ticket with a preregistered
prediction set, new one-shot identity, and exact fresh/cumulative cap.

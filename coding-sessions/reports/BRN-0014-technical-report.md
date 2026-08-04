# BRN-0014 Technical Report

## State

The cited answer-commit boundary is implemented and offline-verified. It has
not performed model inference, read a credential, called a provider, changed a
terminal result, or spent money. Fresh independent review is still required.

## Product Repair

`answerWithRetrieval()` now keeps an answer-local registry of every canonical
message or admitted graph quote returned through exact, ranked, semantic,
read, or graph retrieval. The registry stores immutable string copies keyed by
evidence ID before the provider can observe the result.

The provider receives `commitAnswer()` and `answerEvidenceCount()`. A
commitment has exactly `abstained`, `bases`, and `text`. Each unique basis must
name an ID returned in this answer session and copy a bounded, non-empty exact
contiguous quote from that returned row. The callback returns a deeply frozen
object tracked by identity. A provider declaring
`requiresEvidenceCommitment` cannot substitute a clone or raw text after
evidence was returned. The public result includes frozen `answerEvidence` and
`answerCommitted` telemetry. These fields prove declared provenance, not that
the answer prose semantically follows from its bases.

## Luna Wire

The OpenAI adapter declares the commitment capability and adds private strict
function `palari_answer_commit` beside the five unchanged non-strict memory
tools. The private function cannot retrieve or mutate memory and does not
consume a retrieval call. A valid commitment returns immediately without an
extra model dispatch.

After non-empty retrieval, raw text or invalid commitment structure gets at
most one host-guided repair. That request exposes only the commitment function
and forces it using the documented Responses shape
`{ type: "function", name: "palari_answer_commit" }`. A second invalid, raw,
or memory-tool response is terminal. If the fourth memory call returned
evidence, finalization is also commit-only; if all retrieval was empty it stays
tool-disabled. The four-memory-call and seven-dispatch ceilings are unchanged.

## Structural Regression

The provider-free regression now crosses the real commitment callback for
prior resource personalization, prior Palari advice, multi-row chronology,
correction conflict, host-computed time, and irrelevant non-empty evidence.
The empty control proves plain-text abstention compatibility when no canonical
row was returned. Fixtures are synthetic and benchmark-independent; the
regression explicitly does not grade generated answer quality.

## Files Changed

- `src/retrieval-answer.mjs`: answer-local evidence registry, exact commitment
  validator, identity enforcement, and immutable result telemetry.
- `src/openai.mjs`: private strict commitment function and bounded repair wire.
- Focused tests and the synthetic regression: positive, compatibility, and
  adversarial structural coverage.
- `docs/BRAIN-API.md`, `docs/DECISIONS.md`, and `STATUS.md`: additive contract,
  limitation, verification, accounting, and next gate.
- Governed technical/human reports and ticket lifecycle record.

## Verification

- Focused retrieval/OpenAI/regression contracts: 45 pass, 0 fail.
- Full suite: 701 pass, 0 fail, 15 skipped across 716 tests.
- Quickstart: 6/6 journey steps pass.
- Package dry-run: 32 files, 132.1 kB tarball / 475.1 kB unpacked; no private
  model, cache, result, runtime, or credential content.
- `git diff --check`: pass.
- Provider calls / network calls / model loads / credential reads / spend:
  `0 / 0 / 0 / 0 / $0.00`.
- Cumulative accounted spend remains `$6.03072623` = `$1.72334288` measured +
  `$4.30738335` uncertain.

## Product Stop Rule

1. A new user can run the basic journey: yes, quickstart is 6/6.
2. The unit makes the journey measurably better by making every Luna answer
   after retrieval structurally auditable and rejecting uncited substitution.
3. OpenAI function calling supplies the wire, but not Palari's answer-local
   canonical ID/quote registry, identity check, retrieval budget, or immutable
   provenance telemetry.
4. Quetzali explicitly requested autonomous Ettin/Luna repair after three
   measured answer-use failures despite complete required-session retrieval.
5. Deleting this unit restores Luna's ability to retrieve correct evidence and
   then return unrelated raw prose without crossing a host-verifiable basis.

This is a product repair after a measurement unit, not infrastructure drift.

## Risks / Follow-Ups

Exact citations make ignored or fabricated evidence visible; they do not
prove semantic entailment. A semantic verifier, benchmark judge change, or
second live score would be a separate governed unit. A new live invocation
still requires founder authority and preregistration; 10/10 remains an
objective, never permission to reroll or tune on known answers.

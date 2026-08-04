# BRN-0014 Technical Report

## State

The cited answer-commit boundary is implemented and offline-verified. Three
independent review passes found four provider-neutral P1s and one P3; the
bounded repairs and permanent regressions are implemented, and fresh rereview
of the exact repaired snapshot is required.
The unit has not performed model inference, read a credential, called a
provider, changed a terminal result, or spent money.

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

## Review Repair

At exact reviewed HEAD `75e03cf`, the host read a custom provider's
`requiresEvidenceCommitment` property only after awaiting that provider. A
writable custom provider could therefore retrieve evidence, set its own flag
false, and return raw text. Luna's immutable declaration was not vulnerable,
but the provider-neutral contract was. The repaired host snapshots the boolean
declaration before any provider code runs and uses only that snapshot for the
post-retrieval decision. A real-brain adversarial test mutates the property
mid-call and proves the raw answer still fails closed.

Fresh rereview at `99e74c3` found another P1: basis-length checks were followed
by a call to the provider-owned array's `.map()`. An overridden method could
return fabricated or empty bases without invoking the validation callback; a
changing accessor could also present different arrays across reads. The host
now structured-clones the proposal once before inspecting it and validates
that private snapshot with an indexed host loop. Uncloneable methods fail
closed, later provider mutation cannot affect the snapshot, and a changing
accessor is rejected before cloning. Both reviewer reproductions are permanent
real-brain regressions.

The next fresh rereview at `7ae4f98` found two more P1s and one P3. First,
quote validation spread a host `Set` and called string `.includes()`, letting a
same-realm custom provider temporarily poison mutable prototypes and admit a
fabricated quote. Second, a provider could start asynchronous retrieval
without awaiting it, return raw text while the evidence registry was empty,
and let the retrieval populate evidence and transcript only after answer
acceptance. Third, cloning before the exact-field check sanitized hidden,
inherited, symbol, accessor, or named-array fields instead of rejecting them.

The repaired boundary captures the small authority-bearing intrinsic methods
at module initialization, stores source strings in host-private arrays, and
uses only indexed host iteration for exact quote checks and telemetry. It
checks own data-property descriptors and dense standard arrays before making
the private structured clone. Every started retrieval is tracked; after the
provider resolves or throws, retrieval is closed, all outstanding operations
are drained, and their evidence or failure is incorporated before commitment
enforcement. Delayed calls cannot mutate host state. Real-brain regressions
cover forged prototype iteration/includes, hidden metadata, accessor fields,
and a reranker-gated unawaited search.

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

- Focused retrieval/OpenAI/regression contracts: 46 pass, 0 fail.
- Full suite: 702 pass, 0 fail, 15 skip across 717 tests.
- Quickstart: 6/6 journey steps pass.
- Package dry-run: 32 files, 133.7 kB tarball / 481.7 kB unpacked; no private
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

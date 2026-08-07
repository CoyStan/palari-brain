# BRN-0033 Technical Report

## Files Changed

- `STATUS.md`, `evals/predictions.md`, `docs/DECISIONS.md`, and
  `docs/EVALUATION-HARNESS.md`: terminal result, P-set 39 grade, decision, and
  generic failure boundary.
- BRN-0033 ticket, human report, and handoff: governed closeout and successor
  boundary.

## Exact Invocation Outcome

The founder authorized one invocation of
`j4-luna-ettin-unexecuted11to20-v5` under `$5.00` fresh / `$13.00840072`
cumulative caps at reviewed head
`e6320532041fb5028e72e1d19ee9fe529d8d69f5`, with launcher/runtime SHA-256
`d149ee3e145789cc97b0e92caa22e23a719e7125cd1435f028cb90899eec83ef` /
`c013d8a32efd408094dd5881acbc4c7d5e96104661883b519e98618996efabd7`
and review `ACCEPT`. The launcher was invoked exactly once. After its
provider-free preflight and exact-authority comparison, it terminated with:

`Review attestation requires one exact BRN0025_REVIEW_IDENTITY marker.`

The identity is administratively consumed and cannot be retried, resumed,
rerolled, or regraded.

## Failure Boundary

Source ordering places `assertReviewAttestation` before
`mkdir(resultPath)`, custody reservation, attempt writes, and runtime spawn.
The runtime owns credential, selected-data, and provider work, so none was
reached. The v5 result and semantic-review paths are both absent. Consequently
there is no durable custody record or terminal manifest to verify.

The shared verifier's `exactMarker` calls hard-code four
`BRN0025_REVIEW_*` names. The accepted BRN-0032 reviewer note contains a
human-readable identity, exact launcher/runtime hashes, and ACCEPT result, but
not the legacy exact-marker names. This is a generic governance-interface
compatibility failure, not evidence about Luna, Ettin, retrieval, ranking,
memory, or answer quality.

All eight frozen v1-v4 launcher/runtime SHA-256 values still match their
recorded values. No private file was mutated. Fresh measured, uncertain, and
accounted spend are `$0`; cumulative accounted spend remains `$8.00840072`.
Historical `6/10`, prior evidence, and sealed U8 remain unchanged.

## P-set 39 Grade

Official accuracy, session recall, exact-span recall, selected evidence,
materially used evidence, equivalent-fact recall, architecture, and
rerank/boundary are **NOT REACHED / FAIL**. Execution/accounting is
**PARTIAL PASS / OVERALL FAIL**: the exact one-shot stop, caps, namespace
absence, zero calls, and zero spend held, but durable custody and recursive
terminal sealing were not reached.

## Verification

- launcher/verifier source ordering: PASS;
- v5 result and semantic-review namespace absence: PASS;
- v1-v4 launcher/runtime SHA-256 comparison: PASS;
- no provider, credential, selected-data, live identity, or private mutation
  performed by this record ticket: PASS;
- `npm test`: PASS, 805 passed / 15 optional skipped / 0 failed across 820;
- `npm run quickstart`: PASS, 6/6;
- ticket committed-plus-dirty scope, report lint, and `git diff --check`: PASS
  before lifecycle transition.

## Risks / Follow-Ups

The ticket-specific marker schema can reject a valid later review note. A
separate offline ticket should define a ticket-neutral exact attestation
contract and tests. It must not mutate this terminal record. Any live successor
requires a new identity, frozen bytes, independent review, and exact founder
authorization.

# BRN-0034 Technical Report

## Files Changed

`evals/generated-runtime-verifier.mjs` generalizes the marker namespace;
`tests/generated-runtime-verifier.contract.test.mjs` covers compatible and
fail-closed behavior. P-set 40, decisions, harness documentation, STATUS, and
governed closeout artifacts freeze and explain v6. No live result, frozen
predecessor, model, prompt, ranking, retrieval, or answer code changed.

## Implementation

`assertReviewAttestation` takes `markerNamespace`, defaulting to
`BRN0025_REVIEW`. Before reading markers it requires an uppercase identifier of
1-64 characters. It then derives the four exact names ending in `_IDENTITY`,
`_LAUNCHER_SHA256`, `_RUNTIME_SHA256`, and `_RECOMMENDATION`. Each must appear
exactly once and bind the supplied identity/hashes plus exact `ACCEPT`.

V6 selects `PALARI_REVIEW`. The tests preserve the legacy call shape and reject
malformed namespaces, empty notes, missing markers, duplicates, mismatches,
wrong recommendation, and marker sets from a different namespace.

## Frozen V6

Identity `j4-luna-ettin-unexecuted11to20-v6` inherits v5's exact ten never-
completed questions and entire benchmark treatment. Opening/caps are
`$8.00840072`, `$5.00`, and `$13.00840072`. Exact private files are mode 0600:

- launcher: `b287f7c20af4c7df7159b785b6723693b74289be93c45dc01aa8d3e263bde15f`;
- runtime: `e68e13450c6f20a838dfa19ec23498dfc17d76fec9e407ca814083c356cae6f2`.

The actual launcher `--verify` passed generic marker attestation, duplicate
occurrence ingest/replay/mutation, cached Ettin/answer smoke, count projection,
canonical settlement, one-shot custody/reuse refusal, an eight-entry recursive
seal/reseal refusal, and temporary cleanup. It reported zero credential reads,
dataset reads, provider calls, and result writes. V6 result and semantic-review
namespaces are absent; all ten v1-v5 private artifacts and four predecessor
trees remain immutable; v5 namespaces remain absent.

## Verification

- focused verifier contracts: PASS, 18/18;
- full suite: PASS, 810 passed / 15 optional skipped / 0 failed across 825;
- quickstart: PASS, 6/6;
- actual private v6 `--verify`: PASS, telemetry 0/0/0/0;
- private modes/hashes, predecessor immutability, namespace absence: PASS;
- ticket committed scope and `git diff --check`: PASS before lifecycle change.

## Risks / Follow-Ups

The fix and v6 are offline-proven only. The final reviewer note must contain
exact `PALARI_REVIEW_*` markers matching the private hashes. Any live v6 action
requires exact founder authority at the final accepted source head; acceptance
alone grants no live permission.

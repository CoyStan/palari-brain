# BRN-0025 Technical Report

## Files Changed

- `evals/generated-runtime-verifier.mjs` validates required final-runtime
  definitions/calls and executes one bounded provider-free child mode.
- `tests/generated-runtime-verifier.contract.test.mjs` permanently reproduces
  the BRN-0024 helper deletion and all fail-closed output/telemetry cases.
- `evals/predictions.md` registers FINAL P-set 36 without changing P-set 35.
- `docs/EVALUATION-HARNESS.md` and `docs/DECISIONS.md` record the new boundary.
- Ticket reports, handoff, and `STATUS.md` record the offline freeze.

New private, gitignored mode-0600 artifacts:

- `/home/quetza/palari-brain-private/luna-ettin-unexecuted11to20-v2-live-launcher.mjs`
  — SHA-256 `8d0b6a6b19d03b7385445182dc91c1ed9a90dc83878cc82a267708f2d3b3a568`.
- `/home/quetza/palari-brain-private/luna-ettin-unexecuted11to20-v2-live.runtime.mjs`
  — SHA-256 `f3034fac3c43ebfc55911f85dfb65cff022825dc338b7c539357fd521c36a404`.

The successor result and semantic-review namespaces are absent.
The launcher rehashes all 19 inherited runtime import-closure files and
explicitly proves sealed U8 is excluded from the fixed population.

## Defect Reproduction And Repair

The permanent regression inserts `runLocalSmoke`, then replaces the
overlapping region from `measuredSpend` through `sourceSession`. The call
remains while the definition disappears. `node --check` passes; the new
verifier rejects the final byte sequence before child dispatch because it
finds zero required definitions.

The successor composer starts from the exact consumed runtime bytes, changes
only the identity/imports/mode boundary needed by this ticket, restores the
local-smoke helpers after every inherited transformation, and writes a new
runtime exclusively. Its offline mode creates a temporary synthetic Palari
brain, loads the exact cached Ettin runtime with remote models disabled and a
throwing fetch, ingests four synthetic mug statements, and executes one real
rank. The titanium memory ranks first, the answer is `It is titanium.`, all
four scores are finite, and the temporary workspace is removed.

The tracked verifier executed those final private runtime bytes with a
180-second timeout and 64-KiB output bound. Accepted telemetry was exactly:

```json
{
  "credentialReads": 0,
  "datasetReads": 0,
  "providerCalls": 0,
  "resultWrites": 0
}
```

No `.env`, credential, dataset content, selected session/question/answer,
provider, result namespace, semantic judgment, or spend was accessed.

## Immutable BRN-0024 Evidence

Before and after implementation/verification, the exact SHA-256 values are:

- launcher: `2ffb3d7a414008a74b9c61eaa1aca1db0240ef33fd155a6adb060863b2488459`
- runtime: `b49c6f8c38d08271933daa415f19037fd7055ede3711bb5d27371c42aaadca81`
- artifact manifest: `9287d3a235b390b63133482366d1aa5db84a80b8903f41c41be7b1e90e86c768`
- launcher attempt: `e2cc9907b3d5ee61879c64a51e229c624432fe32aff66374d12d7ef15bbcc7de`
- launcher result: `a32b3293e20bb196121fcc428e78dffc438356db85affb6b0808d1035ff2884f`
- meter: `14db06670a77a177f173b58ac7b3758aee1ee9ef4030b8a5b834471e83429496`
- started marker: `54250027459b7c4ef01cfcaf5a1c9d8c62235f8e0ab4119081c658df8b2f8ef0`

Every listed private file remains exact mode 0600. P-set 35 terminal grading,
historical `6/10`, cumulative accounted `$7.80502179`, and sealed U8 are
unchanged.

## Verification

- `node --test tests/generated-runtime-verifier.contract.test.mjs`: PASS,
  8/8.
- private successor launcher `--verify`: PASS; real synthetic cached-Ettin
  smoke, finite 4/4 scores, expected ordering/answer, temporary cleanup, exact
  zero external-activity telemetry.
- `npm test`: PASS, 783 passed / 15 skipped / 0 failed across 798 tests.
- `npm run quickstart`: PASS, 6/6.
- `node --check` for launcher/runtime/verifier: PASS.
- ticket, report, committed-plus-dirty scope, and diff checks: PASS at handoff.

## Risks / Follow-Ups

The offline smoke validates composition and cached-Ettin compatibility only.
It predicts no P-set 36 score. Independent review remains PENDING. Even after
acceptance, the proposed `$5.00` fresh / `$12.80502179` cumulative boundary is
not authority. One live successor invocation requires a new exact founder GO
naming identity, numeric caps, reviewed head, both private hashes, and ACCEPT.

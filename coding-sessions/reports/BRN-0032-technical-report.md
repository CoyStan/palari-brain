# BRN-0032 Technical Report

## Files Changed

The kernel live arm and its focused contracts implement occurrence-aware
identity. The v6 config contract updates one sentinel expectation. P-set 39,
evaluation/decision docs, STATUS, and governed closeout artifacts document and
freeze the offline result. No frozen result JSON or private evidence changed.

## Outcome

BRN-0032 integrates the occurrence-aware source identity from BRN-0030 with
BRN-0031's one-line historical-v6 sentinel update. The combined state is green;
neither red intermediate implementation branch is merged.

## Source Identity

The live arm assigns every source-session instance its original occurrence
ordinal before chronological sorting. A versioned, reversible envelope combines
that ordinal with the turn index and safely carries arbitrary original session
IDs. Storage therefore distinguishes repeated occurrences while source
isolation and recall metrics decode the envelope back to the original source
ID. Exact replay remains idempotent at the store. Different content under the
same occurrence and turn still fails closed with `SOURCE_MESSAGE_CONFLICT`
before writer work. The admission gate is unchanged; content hashes are not
used as identity.

The focused synthetic regression uses two occurrences of the same source ID.
It observed two distinct source-occurrence identities, four evidence rows, two
exact-span source IDs, chronological replay of both original IDs, idempotent
replay, and mutation rejection with zero provider calls.

## Historical Sentinel

Because the kernel arm is now the first changed tracked artifact, the v6 drift
test's single expected first-artifact value changes from the runner to the
kernel arm. Its complete drift set remains unchanged, and no frozen v6 JSON
byte changed.

## Frozen Successor

FINAL P-set 39 binds unconsumed
`j4-luna-ettin-unexecuted11to20-v5` to opening `$8.00840072` and proposed
`$5.00` fresh / `$13.00840072` cumulative caps. Exact mode-0600 private bytes:

- launcher SHA-256: `d149ee3e145789cc97b0e92caa22e23a719e7125cd1435f028cb90899eec83ef`;
- runtime SHA-256: `c013d8a32efd408094dd5881acbc4c7d5e96104661883b519e98618996efabd7`.

The actual private launcher `--verify` returned `status: passed`. It executed
cached Ettin and answer smoke, exact count-body projection, canonical usage
settlement, one-shot custody/reuse refusal, an eight-entry nested recursive
seal/reseal refusal, duplicate-occurrence ingest/replay/mutation, and cleanup.
Telemetry was zero credential reads, dataset reads, provider calls, and result
writes. Result and semantic-review namespaces are absent. This did not execute
v5 or spend money.

## Verification

- focused live-arm/config contracts: PASS, 19/19;
- full suite: PASS, 805 passed / 15 optional skipped / 0 failed across 820;
- quickstart: PASS, 6/6;
- private v5 `--verify`: PASS with zero provider telemetry;
- frozen-v6 byte immutability and complete drift set: PASS;
- ticket scope and `git diff --check`: PASS before lifecycle transition.

Historical `6/10`, sealed U8, consumed v1-v4 evidence, and cumulative spend are
unchanged. A live v5 invocation still requires an exact founder authorization
bound to the accepted head and the hashes above.

## Review Focus

The reviewer should independently confirm pre-sort occurrence numbering,
round-trip decoding for arbitrary source IDs, mutation refusal before writer
work, full v6 drift-set preservation, exact private hashes/modes and zero-call
verification, namespace absence, and complete committed scope.

## Risks / Follow-Ups

The repaired path is offline-proven but not yet live-measured. A new exact
founder authorization is required for the single frozen v5 invocation. Any
different head, launcher, runtime, identity, or cap requires a fresh freeze and
review; the consumed v1-v4 identities remain immutable.

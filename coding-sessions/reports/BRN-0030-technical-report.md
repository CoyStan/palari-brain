# BRN-0030 Technical Report

## Files Changed

The J4 kernel arm and its permanent contracts add occurrence-aware provenance;
P-set 39, harness/decision docs, status, reports, handoff, and the governed
ticket record the offline v5 freeze and current prerequisite blocker. Private
mode-0600 v5 launcher/runtime remain gitignored.

## Result

Repeated source-session occurrences now receive distinct deterministic J4
source identities without changing the immutable dialogue gate. Identity is a
versioned, reversible base64url encoding of the original source session ID plus
its stable original-instance occurrence ordinal and exchange turn index. The
product retains its canonical user/assistant suffix. Content and content
hashes never participate.

Chronological replay sorts by event time with original occurrence ordinal as
the stable tie-breaker, so replay order never renumbers identity. Isolation,
session recall, and role-specific exact-span calculation recover the exact
original source session ID. Arbitrary source IDs, including punctuation,
colons, percent signs, and Unicode, round-trip canonically.

## Immutable Boundary Proof

Synthetic product-brain contracts use two occurrences with the same original
session ID but different times and turn snapshots. Both ingest under distinct
keys in chronological order. Exact replay leaves the canonical row set
unchanged. A changed user snapshot under the same original occurrence fails
with `SOURCE_MESSAGE_CONFLICT` before any writer or provider work. The gate and
its conflict semantics were not modified.

## Frozen V5

FINAL P-set 39 freezes `j4-luna-ettin-unexecuted11to20-v5` over unchanged
P-set 38 population, order, architecture, models, prompts, and four-call
ceiling. Opening accounted spend is `$8.00840072`; proposed caps are `$5.00`
fresh / `$13.00840072` cumulative. Historical `6/10` and U8 remain unchanged.

Private mode-0600 artifacts:

- launcher SHA-256:
  `927cd391a6799ae0d273cc5e1a223dcd029ff21d07346d0957a3f64e3e364437`;
- runtime SHA-256:
  `db55e9999df206f0b8790f597d0acf95a3336537d994b9b7680bd7dd8f329868`.

The clean implementation import closure is 50 files / 751,199 bytes /
`77838578b96a384a63bd767be9ea0476b09f1d7f457fc6d771136415cae98390`.
The actual generated runtime passed the duplicate-occurrence regression with
two distinct occurrences, four role-specific evidence rows, two supporting
exact-span IDs, idempotent replay, and mutation refusal. Existing gates also
passed: cached Ettin with four finite scores; exact 11,488-byte projected count
and untouched 11,593-byte generation; `$0.0004764` Standard settlement;
durable `reserved -> launched -> consumed` custody with reuse refusal; nested
recursive seal and reseal refusal; temporary cleanup; immutable v1-v4 bytes.
Telemetry was exactly zero credential reads, dataset reads, provider calls,
and result writes. V5 result and semantic-review namespaces remained absent.

## Verification

- focused J4 contracts: PASS, 10/10;
- private v5 `--verify`: PASS;
- private syntax, modes, hashes, closure, namespaces, and predecessors: PASS;
- full suite: PAUSED at one expected contract-maintenance blocker, 804 passed /
  15 optional skipped / 1 failed across 820 tests;
- exact failing test: `J4 v6 freezes five predecessors, one repair, and the $5
  fresh cap`;
- failure: its `assert.rejects` predicate requires `ARTIFACT_HASH` to name
  `evals/run-longmemeval-live.mjs`, but the authorized BRN-0030 kernel change
  now correctly names the earlier artifact
  `evals/arms/kernel-longmemeval-live-arm.mjs`;
- quickstart: PASS, 6/6;
- ticket/scope/diff: rerun after the separate prerequisite lands.

## Risks / Follow-Ups

Provider-free proof establishes identity plumbing, not live model quality or a
score. A separate prerequisite ticket must update
`tests/longmemeval-live-config.contract.test.mjs` so the historical terminal
config test expects the kernel as the first current drift; it must not rewrite
`evals/live-runs/j4-longmemeval-s60-v6.json`. BRN-0030 remains claimed until
that test-only prerequisite lands and full verification is green. Fresh
independent cumulative review follows. Acceptance grants no live invocation.

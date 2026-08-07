# BRN-0030 Handoff

## State

The generic occurrence-aware repair and provider-free v5 freeze are preserved,
but BRN-0030 is paused before review on one out-of-scope historical test
expectation. Do not accept, merge, or run live based on this handoff.

## Exact Prerequisite

Full suite result is 804 passed / 15 skipped / 1 failed across 820. Failing
test: `J4 v6 freezes five predecessors, one repair, and the $5 fresh cap` in
`tests/longmemeval-live-config.contract.test.mjs`. Its final `assert.rejects`
predicate expects the first tracked drift to name
`evals/run-longmemeval-live.mjs`; the authorized kernel repair makes
`evals/arms/kernel-longmemeval-live-arm.mjs` the earlier and correct first
drift. Open a separate test-only prerequisite for
`tests/longmemeval-live-config.contract.test.mjs`. Do not mutate the historical
`evals/live-runs/j4-longmemeval-s60-v6.json` config.

## Later Review Targets

- Verify original occurrence ordinal survives chronological sorting and no
  content-derived identity is used.
- Verify recovery accepts only the governed v1 envelope and optional canonical
  role suffix while preserving arbitrary original source IDs.
- Rerun duplicate ingest, exact replay, and mutation refusal contracts.
- Run the actual mode-0600 v5 launcher `--verify`; confirm two distinct
  occurrences, two role-specific expected exact spans, immutable v1-v4,
  absent v5 namespaces, and zero telemetry.
- Bind launcher/runtime SHA-256
  `927cd391a6799ae0d273cc5e1a223dcd029ff21d07346d0957a3f64e3e364437` /
  `db55e9999df206f0b8790f597d0acf95a3336537d994b9b7680bd7dd8f329868`.
- Reconcile FINAL P-set 39, `$8.00840072` opening, and proposed `$5.00` /
  `$13.00840072` caps; historical `6/10` and U8 must remain unchanged.

## Authority Boundary

Review is read-only. Acceptance freezes the offline candidate only. Any live
v5 invocation requires exact founder authority naming identity, both caps,
reviewed head, both private hashes, and ACCEPT.

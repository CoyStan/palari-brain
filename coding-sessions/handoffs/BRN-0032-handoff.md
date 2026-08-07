# BRN-0032 Handoff

## Current State

Occurrence-aware source identity and the dependent v6 sentinel expectation are
integrated and green. BRN-0030/31's red implementation branches must not be
merged. The v5 identity is frozen but unconsumed; no provider action is
authorized.

## Review Instructions

Review the pushed cumulative diff from `main`. Confirm that original occurrence
ordinal is assigned before chronological sort, the versioned envelope round
trips arbitrary original IDs, metrics recover the base source ID, duplicate
occurrences remain distinct, replay is storage-idempotent, and mutation of one
occurrence fails before writer activity. Confirm the v6 test changed only the
expected first drift, with the full drift set and frozen JSON unchanged.

Run the focused contracts, full suite, quickstart, ticket checks, and the exact
private launcher `--verify`. The verifier must report zero credential reads,
dataset reads, provider calls, and result writes; absent v5 result and semantic
namespaces; and these mode-0600 hashes:

- launcher: `d149ee3e145789cc97b0e92caa22e23a719e7125cd1435f028cb90899eec83ef`;
- runtime: `c013d8a32efd408094dd5881acbc4c7d5e96104661883b519e98618996efabd7`.

## Authority Boundary

Accepting and merging BRN-0032 authorizes only this offline repair/freeze. It
does not authorize identity `j4-luna-ettin-unexecuted11to20-v5`; that requires
a new exact founder authorization at the accepted head and hashes.

## Review Outcomes

- ACCEPT if all acceptance criteria and governance checks pass.
- REOPEN for a concrete P0-P3 issue within ticket scope.
- NEEDS-HUMAN for provider activity, credential/data access, frozen evidence
  mutation, scope expansion, or any request to invoke v5.

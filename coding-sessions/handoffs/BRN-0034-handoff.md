# BRN-0034 Handoff

## Current State

Generic review attestation is implemented and the provider-free v6 successor
is frozen. No credential, dataset, provider, result, or spend action occurred.

## Review Instructions

Review the cumulative diff against `main`. Confirm the namespace validator is
bounded, the legacy default is preserved, generic markers bind exactly one
identity/launcher/runtime/ACCEPT set, and every malformed/missing/duplicate/
mismatch/cross-namespace case fails closed. Run focused, full, quickstart,
scope, and diff checks.

Run the exact private v6 launcher with `--verify` only. Confirm mode 0600,
launcher/runtime hashes
`b287f7c20af4c7df7159b785b6723693b74289be93c45dc01aa8d3e263bde15f` /
`e68e13450c6f20a838dfa19ec23498dfc17d76fec9e407ca814083c356cae6f2`,
all provider-free gates, telemetry 0/0/0/0, absent v6 namespaces, unchanged
v1-v5 evidence, absent v5 namespaces, and unchanged historical `6/10`/U8.

## Required Accepted Markers

The final reviewer note must contain exactly once:

`PALARI_REVIEW_IDENTITY: j4-luna-ettin-unexecuted11to20-v6`

`PALARI_REVIEW_LAUNCHER_SHA256: b287f7c20af4c7df7159b785b6723693b74289be93c45dc01aa8d3e263bde15f`

`PALARI_REVIEW_RUNTIME_SHA256: e68e13450c6f20a838dfa19ec23498dfc17d76fec9e407ca814083c356cae6f2`

`PALARI_REVIEW_RECOMMENDATION: ACCEPT`

## Authority Boundary

Acceptance and merge authorize no live invocation. V6 requires a new exact
founder authorization naming the accepted source head, identity, both caps,
both hashes, and ACCEPT.

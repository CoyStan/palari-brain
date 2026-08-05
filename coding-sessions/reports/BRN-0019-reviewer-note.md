# BRN-0019 Reviewer Note

## Review Result

Fresh independent read-only rereview of exact clean pushed head
`258de2d8b35ffd85e58fbb50dedff70791612eef` against canonical `main` at
`46ad5f051d5dc4923ca441e86b80961b4b6b8b80` found no P0, P1, P2, or P3
issue and recommends **ACCEPT / GO**. Both P2 findings from the first review
are closed.

## Findings

None.

The repaired plan boundary rejects every prior non-ISO reproduction:
`08/05/2026`, `August 5, 2026`, `0`, an invalid calendar day, and an unzoned
timestamp. It also rejects an object-valued relation while
`Object.prototype.toString` is poisoned to return a supported relation. The
accepted positive forms are a calendar-valid canonical date and a zoned
timestamp, both normalized to an immutable UTC plan.

## Verification Reviewed

- Reviewed the full cumulative 15-path diff, not only the repair. Ticket lint,
  committed-plus-dirty scope, syntax, and `git diff --check` pass. A production
  source scan found none of the Phone, Instant Pot, Tokyo, Miami, Suica,
  TripIt, power-bank, Air-Fryer, or hot-tub fixture literals.
- Replayed both prior P2 attacks directly. Exact string typing now precedes
  relation comparison, and the captured ISO parser validates syntax, calendar
  days, zoning, parseability, and range order before returning normalized UTC.
  Permanent regressions cover the concrete attacks and valid leap-day/offset
  inputs.
- Confirmed one immutable `memory_plan` is session-local trace metadata, may be
  registered only once, returns no evidence, and does not reduce the four-call
  evidence budget. A combined provider-free exercise completed plan + four
  retrievals + raw-answer repair in exactly seven model dispatches and five
  host tool executions (one plan plus four evidence calls).
- Rechecked the commitment boundary: selected bases require unique current-
  session returned IDs and exact contiguous quotes, with exactly one bounded
  consequence or non-use reason. Declared-used compatibility evidence excludes
  non-use commitments. Temporary inferences require selected used provenance,
  `revisable: true`, and a consequence; the answer path exposes no admission or
  journal-write capability, and the Miami before/after journal contract holds.
- Rechecked metric authority. The product host derives `selectedEvidenceIds`
  only from accepted `evidenceCommitments`; telemetry also requires a committed
  answer and returned IDs. Session recall, exact-span recall, selected evidence,
  judged equivalent-fact recall, and judged material use remain separate
  objects. The latter two preserve explicit `judged: true` /
  `labelAuthority: "judge"` labels and are not represented as canonical truth.
- Rechecked the active OpenAI wire: the commitment function uses its strict
  exact schema; forced repair exposes only that function; parallel calls are
  disabled; plan calls cannot mix with evidence calls; plan, retrieval,
  repair, and absolute dispatch ceilings fail closed. No retry or hidden model
  call was added.
- Provider-neutral legacy bases remain compatible, while accessors, sparse or
  named arrays, duplicate IDs, prototype tricks, mutation races, fabricated
  quotes, unknown calls, and late retrieval failures retain their fail-closed
  contracts.
- Focused suite: 64 passed, 0 failed. Full suite: 727 passed, 0 failed, 15
  optional skips across 742 tests. Quickstart: 6/6. Historical closure and
  sealed-loader tests pass; the cumulative diff changes no prediction or result
  path, so BRN-0017's historical 6/10 remains unchanged.
- No credential, `.env`, private result, provider, generation, judge, live
  launcher, benchmark regrade, or spend path was accessed during review.

## Required Changes

None.

## Recommendation

Accept BRN-0019 and merge it through the founder-authorized governed flow. Any
post-change live comparison remains a separate founder-gated ticket with a new
preregistration, identity, and exact fresh/cumulative cap.

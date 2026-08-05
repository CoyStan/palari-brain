# BRN-0020 Reviewer Note

## Review Result

Fresh independent read-only pre-dispatch review of the functional freeze at
exact clean pushed head `2d4beeca0fcc6c9e8fe15e0c5edfcc658a79a068` against
canonical `main` at `b7fc4121dcb55d5e3384572941769d519228a2ea` found no
P0, P1, P2, or P3 issue. The subsequent clean pushed administrative head
`bef725ea22fa161040392be25437be7eefcf4ea9` changes only `STATUS.md`, the
ticket contract, and the technical report to record that verdict and the next
founder gate; it introduces no functional change.

The reviewed mode-0600 private launcher is frozen at SHA-256
`09d53ecb96da1902abae2de0ab1544f952e9ab894a4b44a10f0bc0b6d2c79391`.
Recommendation: **ACCEPT the freeze for exact founder-gated dispatch**. This
review does not accept, close, merge, authorize, or execute the ticket.

## Findings

None.

## Verification Reviewed

- Replayed every prior pre-dispatch finding. Reservations are made durable by
  syncing the file and containing directory before transport. Seal processing
  reconciles the meter, report, terminal hash, caps, artifact modes, and
  credential scan, and records an explicit failed manifest when reconciliation
  cannot complete.
- Confirmed Gemini reservations use UTF-8 bytes and successful usage-absent
  calls remain fully uncertain/accounted. OpenAI requests inject and validate
  exact Standard/default service tier on the serialized, metered wire.
- Confirmed OpenAI usage must be a plain own-property object whose input,
  output, total, cached, and cache-write fields are raw numeric safe integers.
  Input, output, and total must be positive and internally consistent; cached
  plus cache-write cannot exceed input.
- Confirmed input usage cannot exceed the exact serialized UTF-8 byte bound
  stored with the durable reservation, output cannot exceed 512, and measured
  dollars cannot exceed the reserved amount except for the declared numeric
  tolerance. Missing, malformed, zero, inconsistent, or out-of-bound usage is
  durably persisted as terminal `invalid-usage`, does not settle the
  reservation, retains full uncertainty/accounting, terminates the cell, and
  is reconciled by the terminal seal.
- Rechecked the cumulative authority, source-integrity, and leakage boundary:
  all 74 frozen BRN-0017 artifacts, five SQLite byte/canonical-row identities,
  six required original-user evidence spans, four question/date objects,
  dataset, accepted product cut, exact tool wires, and native Ettin closure are
  pinned. Required evidence and expected answers are not exposed to Sol before
  its answers; historical BRN-0017 remains immutable at 6/10.
- Rechecked call and one-shot limits: invalid authority fails before result
  creation or credential access; the result namespace is absent; there is no
  retry path; execution is one compatibility smoke followed by the four fixed
  cases, with at most seven model dispatches per case and the fixed retrieval
  budget.
- Rechecked metric authority. Session recall, exact-span recall, selected
  evidence, judged equivalent-fact recall, and judged materially-used evidence
  remain distinct. The two semantic judgments are separate, non-aliased
  pending records for one independent terminal review and are not canonical
  truth.
- Private launcher syntax, provider-free `--verify`, and exact
  `--verify-authority 2d4beeca0fcc6c9e8fe15e0c5edfcc658a79a068` pass. An
  all-zero authority is rejected. The launcher hash and mode match the freeze,
  and the result namespace remains absent.
- Full `npm test`: 727 passed, 0 failed, 15 optional skips across 742 tests.
  Quickstart: 6/6. Ticket lint, `git diff --check`, and governed
  committed-plus-dirty scope pass for exactly the six contracted paths at the
  functional freeze. The administrative delta is limited to the three
  expected status/report paths and is whitespace-clean.
- No `.env`, credential, key, network, provider, local inference, result
  namespace, generation, judge, live launcher, or spend action occurred during
  review. BRN-0020 review activity is exactly zero credential reads, zero
  provider calls, zero inference calls, and `$0.00` fresh spend.

## Required Changes

None.

## Recommendation

Accept the exact frozen BRN-0020 launcher and contract for a new, explicit
founder-gated authorization of identity
`j4-sol-frozen-failures-post-architecture-v1` under the preregistered `$0.50`
fresh / `$8.17192994` cumulative accounted caps. Do not dispatch without that
new exact authorization, and do not reroll, regrade, or alter the historical
BRN-0017 6/10 result.

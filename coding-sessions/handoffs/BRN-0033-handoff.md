# BRN-0033 Handoff

## Blocker

The shared runtime verifier requires legacy `BRN0025_REVIEW_*` marker names.
The independently accepted BRN-0032 note carries the attestation in
human-readable form but lacks those exact keys, so v5 failed before custody.

## Evidence

- Exact error: `Review attestation requires one exact
  BRN0025_REVIEW_IDENTITY marker.`
- `assertReviewAttestation` precedes `mkdir(resultPath)`, custody writes, and
  runtime spawn.
- Both v5 namespaces are absent; fresh spend is `$0`; cumulative accounted
  spend remains `$8.00840072`.
- Identity `j4-luna-ettin-unexecuted11to20-v5` is terminal and consumed.
- Historical `6/10`, U8, and all prior evidence remain unchanged.

## Options

- Option A: create a separate offline governed repair that introduces a
  ticket-neutral, exact, fail-closed attestation schema with regression tests.
- Option B: defer the repair and stop the Luna + Ettin 11-20 evaluation.
- Option C: manually add legacy markers or retry v5. This is rejected because
  it would mutate accepted evidence or reuse a consumed identity.

## Recommendation

Choose Option A. Preserve v5 exactly as a terminal zero-call failure. After the
repair is independently accepted, freeze a new successor identity from clean
main and verify it offline.

## Authority Needed

The offline repair needs a new governed ticket. A frozen live successor needs
a separate exact founder authorization naming its new identity, caps, reviewed
head, launcher/runtime hashes, and ACCEPT. BRN-0033 grants neither authority.

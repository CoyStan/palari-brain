# BRN-0024 Reviewer Note

## Review Result

`NEEDS-HUMAN` for exact committed and pushed head
`f015ac0cdf727ccb747ba5c3d3564b973cfadf57`. Do not dispatch
`j4-luna-ettin-heldout11to20-v1` from this freeze.

## Findings

- P0: founder authority checks the run ID and `$5.00` fresh cap, but not the
  `$12.80502179` cumulative cap, reviewed head, launcher hash, runtime hash, or
  independent-review state.
- P0: the ten cells are unexecuted, but not genuinely uninspected. Tracked
  P-set 20 already contains row-specific content-derived difficulty/basis
  classifications for all ten ordinals. No row-specific route appears in the
  launcher, but P-set 34's stronger non-inspection claim is unsustainable.
- P1: measured long-context Luna usage is settled with short-context rates.
- P1: one evaluator is created per dispatch, so the evaluator-local consumed
  operation-ID set does not provide run-wide single-use custody.
- P2: pending semantic labels have no implemented append-once reviewer
  provenance overlay compatible with the sealed original namespace.

## Verification Reviewed

The reviewer reproduced the exact clean pushed head and private hashes,
reran private verification, the 790-test suite, quickstart, ticket, scope, and
diff checks, and adversarially reproduced the accounting/operation-ID issues.
No credentials, held-out payloads, result content, provider calls, namespace
creation, or spend occurred.

## Required Changes

Repair all four technical defects offline. Before those repairs can become a
new reviewed freeze, the founder must choose whether to (a) retain this
unexecuted population and relabel it honestly as previously profiled, or (b)
freeze a genuinely unprofiled population under a new ticket/identity.

## Recommendation

Recommend `needs-human`. The review does not authorize a provider call.

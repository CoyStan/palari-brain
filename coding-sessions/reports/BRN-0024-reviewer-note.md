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

## Founder Resolution And Repair Submission

The founder approved option 1: retain the same never-executed ten and relabel
them as previously profiled. P-set 34 and
`j4-luna-ettin-heldout11to20-v1` remain immutable, absent, and abandoned.
Replacement P-set 35 and `j4-luna-ettin-unexecuted11to20-v1` disclose P-set
20's earlier profiling and permit no new content inspection or row-specific
route.

The P0/P1/P1/P2 findings are repaired offline. Live authority now binds both
caps, pushed reviewed head, exact private hashes, and explicit ACCEPT state;
measured settlement uses official Luna Standard short/long bands; a run-wide
operation set rejects duplicates before reservation; and an append-once
semantic-review seal binds reviewer provenance plus the original manifest.

Exact submitted private hashes for cumulative rereview:

- Launcher:
  `2ffb3d7a414008a74b9c61eaa1aca1db0240ef33fd155a6adb060863b2488459`
- Runtime:
  `b49c6f8c38d08271933daa415f19037fd7055ede3711bb5d27371c42aaadca81`

Fresh cumulative recommendation: **PENDING**. The original `needs-human`
finding remains historical evidence and does not authorize dispatch.

## Repaired-Head Review And Second Submission

Independent review of exact pushed head `a8b8ae8` recommends REOPEN for one P0
and one P1. The launcher trusted caller-supplied ACCEPT while this note said
PENDING. Runtime `--verify` also parsed selected session content and emitted
only aggregate message/byte/maximum-length values before authority. No text,
answer, supporting message, credential, provider, result, or spend was
exposed; no content-driven change followed.

The second repair requires this tracked note at the confirmed pushed head to
contain both exact machine markers below. PENDING intentionally cannot satisfy
the live gate. After a fresh reviewer accepts this repaired implementation, a
separate tracked attestation commit may change only the disposition to ACCEPT;
that exact administrative head must then receive one final independent
rereview before founder authority can name it.

`BRN0024_REVIEW_DISPOSITION: PENDING`

`BRN0024_REVIEW_IDENTITY: j4-luna-ettin-unexecuted11to20-v1`

Runtime `--verify` is now synthetic-only; `preflight()` remains reachable only
after the authorized launcher consumes the live attempt. System-call tracing
confirms verification never opens `longmemeval_s_cleaned.json`.

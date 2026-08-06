# BRN-0024 Reviewer Note

## Review Result

`ACCEPT` for exact clean pushed terminal-record head
`26c50c334c2983c2e21a696453fc1de9d18e962b`. The historical pre-dispatch
findings and their repairs remain recorded below.

## Findings

No remaining P0-P3 findings. The initial pre-dispatch review found:

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

`BRN0024_REVIEW_DISPOSITION: ACCEPT`

`BRN0024_REVIEW_IDENTITY: j4-luna-ettin-unexecuted11to20-v1`

Runtime `--verify` is now synthetic-only; `preflight()` remains reachable only
after the authorized launcher consumes the live attempt. System-call tracing
confirms verification never opens `longmemeval_s_cleaned.json`.

## Independent Acceptance Attestation

Fresh cumulative review of exact clean pushed implementation head
`7312dc56287724ffd3cdf149e6a97679e00e9f5f` found no P0-P3 defects and
recommended ACCEPT. It independently reproduced synthetic-only verification,
PENDING-gate refusal, content-preflight ordering, both numeric caps, reviewed
head/private-hash binding, long-context settlement, run-wide operation-ID
custody, semantic overlay sealing, absent identities, U8 exclusion, P-set 35
disclosure, 775/15/0 tests, quickstart 6/6, and all governed checks.

This marker records that independent result. It is not founder live authority.
The exact marker-only attestation head still requires a final fresh read-only
rereview before any authorization request.

## Live Terminal Evidence Pending Review

Final rereview accepted exact pushed marker head `ad37a5f` with no P0-P3
finding. The founder's exact authority then consumed the identity once. It
sealed `failed-before-report` on
`ReferenceError: runLocalEttinSmoke is not defined`, before credentials or any
metered call. Four artifacts rehash; calls/spend are zero; manifest SHA-256 is
`9287d3a235b390b63133482366d1aa5db84a80b8903f41c41be7b1e90e86c768`.
Independent terminal review remains required; this specialist does not accept
its own terminal record.

## First Terminal Review

Independent review of exact clean pushed terminal-record head `fb13c76` found
no discrepancy in the sealed private evidence, accounting, historical-score
custody, or zero-row metric treatment. It recommended REOPEN only because two
pre-run statements in the technical report remained stale after consumption
and the human report contained one grammar error. No semantic-review overlay
is applicable because no result rows exist. The narrow documentation repair
requires a fresh read-only terminal rereview.

## Final Terminal Rereview

Fresh independent read-only rereview accepted exact clean pushed head
`26c50c334c2983c2e21a696453fc1de9d18e962b` with no P0-P3 finding. It
independently rehashed the four mode-0600 terminal artifacts, reconciled the
single consumed attempt and raw `ReferenceError`, confirmed the failure occurs
before credential loading, and verified zero provider calls and zero measured,
uncertain, or fresh accounted spend. Cumulative accounted remains
`$7.80502179`; no result rows or semantic-review overlay exist; historical
`6/10` and U8 remain unchanged. Full tests passed 775 / skipped 15 / failed 0
across 790, quickstart passed 6/6, and ticket, report, scope, diff, clean-head,
and pushed-upstream checks passed.

Recommendation: ACCEPT. This grants no retry, replacement identity, provider
call, spend, regrade, or publication authority.

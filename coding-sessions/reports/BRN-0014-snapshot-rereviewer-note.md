# BRN-0014 Snapshot Rereviewer Note

Reviewer: independent agent `/root/brn0014_snapshot_rereview`
Reviewed commit(s): `7ae4f98e6176287c92f6bbaccb8f80602b268ede`
Target branch: `main`

## Review Result

Fail / reopen with two P1 findings and one P3 finding. Both prior P1 repairs
hold.

## Findings

- P1: exact-quote validation spread a host `Set` and called string
  `.includes()`, both through provider-mutable prototypes. The reviewer
  temporarily poisoned `Set.prototype[Symbol.iterator]`, committed a
  fabricated quote against unrelated canonical text, restored the prototype,
  and observed `answerCommitted: true`.
- P1: a required custom provider could start reranker-gated `memory_search`
  without awaiting it and immediately return raw prose. The host saw no
  registered row and accepted `answerCommitted: false`; the pending retrieval
  later returned canonical evidence and mutated the transcript.
- P3: exact fields were checked only after `structuredClone()`, which sanitized
  non-enumerable, inherited, symbol, accessor, and named-array properties
  instead of rejecting those malformed provider-authored fields.

## Verification Reviewed

- The prior capability and provider-owned map/accessor P1 repairs hold.
- Focused contracts: 45/45; full suite: 701/0/15; quickstart: 6/6.
- Package dry-run and all ticket/report/scope/diff/clean/origin checks pass.
- No credential, provider, model, private-data, repository-write, acceptance,
  merge, or push activity occurred during review.

## Required Changes

- Remove provider-mutable prototype calls from exact-quote authority checks.
- Close and drain every started retrieval before evaluating commitment
  requirements; prevent delayed retrieval from mutating returned state.
- Enforce exact own data fields before cloning, including dense standard basis
  arrays, and add permanent reproductions for all three findings.

## Recommendation

Recommend `reopen`. Submit the bounded intrinsic/drain/data-shape repair to a
new fresh read-only rereview. This recommendation does not itself accept,
merge, or push the ticket.

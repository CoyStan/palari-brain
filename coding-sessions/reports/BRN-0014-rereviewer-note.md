# BRN-0014 Fresh Rereviewer Note

Reviewer: independent agent `/root/brn0014_rereview`
Reviewed commit(s): `99e74c35b978655045679fc89c61e4a8df243d28`
Target branch: `main`

## Review Result

Fail / reopen with one P1 finding. The prior capability-snapshot P1 is fixed.

## Findings

- P1: after checking `proposal.bases.length`, the host invoked the
  provider-owned `proposal.bases.map()`. A custom method could skip the
  validation callback and return fabricated bases, while a changing accessor
  could produce a zero-basis commitment. The reviewer reproduced a committed
  forged ID and quote against a real temporary brain. Luna's cloned JSON input
  was not directly affected, but the provider-neutral exact-ID, exact-quote,
  minimum-basis, and mutation guarantees were bypassable.

## Verification Reviewed

- The prior capability declaration is correctly snapshotted before provider
  invocation and its real-brain regression passes.
- Focused contracts: 45/45 pass at the reviewed commit.
- Full suite: 701 pass, 0 fail, 15 skipped; quickstart: 6/6.
- Package dry-run: 32 files.
- Ticket/report/scope/diff/clean/origin checks: pass.
- No provider, model, credential, private-data, or repository-write activity
  occurred during review.

## Required Changes

- Do not invoke provider-owned array methods during validation.
- Take one stable private structured-data snapshot before validation and add
  permanent malicious-method and changing-accessor regressions.

## Recommendation

Recommend `reopen`. Submit the bounded snapshot/host-iteration repair to a new
fresh read-only rereview. This recommendation does not itself accept, merge,
or push the ticket.

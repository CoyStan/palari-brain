# BRN-0014 Intrinsic Rereviewer Note

## Review Result

Reopen exact pushed head `9f3e947e18dff4f0cc4f91d715ec9ea6c49122ba`.

## Findings

- P1: final result shaping called the mutable global `String`, so a required
  same-realm provider could create and return the authentic committed object,
  replace `globalThis.String`, and make the accepted `answer` differ from the
  text that crossed `commitAnswer()`.
- P1: the post-provider drain inspected only operations still pending at that
  instant. A provider could catch a canonical retrieval rejection, allow the
  operation to settle, and return raw prose; the already-settled failure was
  then absent from reconciliation.
- No other confirmed findings. Pre-clone exact descriptors and dense arrays,
  commitment identity, and Luna's forced-commit and call-budget contracts held.

## Verification Reviewed

- Focused contracts: 46 pass, 0 fail.
- Full suite: 702 pass, 0 fail, 15 skip across 717 tests.
- Quickstart: 6/6.
- Exact head, clean worktree, and committed scope: verified.
- Provider/model/credential/private-result access and repository edits: none.

## Required Changes

Preserve the committed text exactly during result shaping. Retain and inspect
the outcome of every started retrieval operation, including failures already
settled or caught by provider code. Add permanent real-brain reproductions for
both paths, then submit a new exact snapshot to fresh read-only review.

## Recommendation

Reopen.

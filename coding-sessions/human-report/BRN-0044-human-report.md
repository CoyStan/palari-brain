# BRN-0044 Human Report

## Why This Mattered

Palari had enough retrieved evidence to answer some questions, but it erased
the result when the model used its last normal call before completing the
final structured commitment. The user received an infrastructure-style
failure instead of the best supported bounded answer.

## What Changed

The 11-call normal work limit remains. After that limit, Palari can use at most
two closure-only calls. The first can assess an already-returned confirmation
page or commit the answer. The second can repair that commitment once. These
calls cannot search for more memory.

## What I Should Know

The change does not accept unsupported text. If evidence was returned, the
answer still needs a valid host-bound evidence commitment. Provider refusal,
empty output, forbidden tools, and a failed repaired commitment still stop the
answer. The maximum physical provider calls increase from the configured
normal limit to that limit plus two closure calls.

## What To Check

- Confirm that the independent reviewer finds no evidence-boundary or call-cap
  regression.
- After merge, rerun only the recorded dispatch-budget failures once, then
  continue the remaining S60 questions under the existing `$90` aggregate cap.
- Keep the first failures visible and label the product-commit boundary in the
  final 60-question campaign report.

## Recommended Next Move

Accept and merge only after a fresh R2 review recommends acceptance. Then run
the founder-authorized live continuation outside the ticket worktree.

# BRN-0023 Reviewer Note

## Review Result

REOPEN at pushed head `4ce75aa`. The specialist does not accept its own work.
Fresh cumulative rereview of the repaired committed head is pending.

## Findings

- P1: dynamically dispatched Hash `update`/`digest` methods let caller-side
  prototype poisoning falsify the ledger-binding body SHA-256.
- P2: dynamically dispatched `RegExp.prototype.test` let `+1` bypass the
  positive-decimal allowance contract and reach both transports.
- P3: the 200-byte operation-ID contract measured JavaScript code units, so a
  300-byte multibyte identifier was accepted.

## Verification Reviewed

The independent reviewer reproduced all three cases, then confirmed the rest
of the contract: same-ID reentrancy blocked; strict ordering, exact snapshots,
fail-closed behavior, Luna/Sol math, accounting separation, and backward
compatibility held. At reviewed head, focused tests were 33/33, full tests were
772 passed / 15 skipped / 0 failed, quickstart was 6/6, and governance checks
were green with no external activity.

## Required Changes

Capture trusted crypto, regular-expression, and byte-count intrinsics before
callbacks; enforce the advertised UTF-8 byte ceiling; add permanent
regressions. The specialist implemented these changes and locally verified
focused 36/36, full 775 passed / 15 skipped / 0 failed, and quickstart 6/6.

## Recommendation

REOPEN. A fresh independent cumulative reviewer must inspect the repaired
committed and pushed head before acceptance.

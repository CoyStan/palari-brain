# BRN-0032 Human Report

## Why This Mattered

BRN-0028 stopped before its first benchmark answer because two legitimate
source-session occurrences collided under one storage identity.

## What Changed

Palari no longer mistakes two separate appearances of the same source session
for one immutable message. It now keeps a stable occurrence number alongside
the original source identity, so repeated sessions remain separate while
reports can still name the original source. Replaying the same data is harmless;
changing a previously seen occurrence still fails closed.

This directly repairs the ingestion collision that stopped BRN-0028 before its
first benchmark answer. The fix does not weaken memory admission, add a
benchmark-specific keyword rule, alter frozen scores, or call a provider.

## What I Should Know

The new v5 candidate is frozen and passed its offline verifier. It remains
unexecuted and has spent nothing. After independent acceptance, the only next
step requiring the founder is an exact one-shot live authorization.

Historical `6/10`, sealed U8, prior evidence, and the `$8.00840072` cumulative
accounted spend are unchanged.

## What To Check

Independent review should confirm repeated occurrences are distinct, original
provenance remains recoverable, replay is idempotent, mutation still fails
closed, frozen v6 bytes did not change, and the private verifier made zero
provider calls.

## Recommended Next Move

Accept and merge the offline repair after clean independent review, then ask
the founder for exact authority before invoking the frozen v5 candidate once.

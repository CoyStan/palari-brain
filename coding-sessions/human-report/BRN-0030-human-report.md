# BRN-0030 Human Report

## Why This Mattered

Palari's previous test run stopped because two different appearances of the
same source-session label were mistaken for one message. The safety gate did
the correct thing and refused the second snapshot.

## What Changed

This ticket gives every appearance its own stable provenance address while
keeping the original session label recoverable for recall measurements. It
does not identify messages from their text, so changing wording cannot silently
create or merge identity. Replaying the same appearance is harmless; changing
one under the same address is still rejected by the unchanged safety gate.

The actual next-run program reproduced the duplicate case offline and passed.
It also passed the existing local Ettin, request-wire, accounting, one-shot,
and artifact-seal checks without reading credentials, opening the dataset,
calling a provider, spending money, or creating a result. The next live run is
not authorized by this ticket and remains a founder decision after independent
review.

## What I Should Know

- No provider was called and no money was spent.
- Historical `6/10`, prior accounting, and sealed U8 are unchanged.
- The private v5 candidate and hashes are preserved.
- Full verification has one test-expectation blocker outside this ticket's
  allowed paths; BRN-0030 is not ready for review or live use.

## What To Check

After the prerequisite test-only ticket lands, rerun the full suite and the
provider-free v5 verifier. Confirm no historical v6 config or private v5 byte
changed.

## Recommended Next Move

Update the historical test's expected first current artifact drift from the
old runner path to the newly changed kernel path in a separately governed
test-only ticket. Then resume BRN-0030 verification and independent review.

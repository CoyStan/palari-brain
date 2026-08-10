# BRN-0047 Human Report

## Why This Mattered

The model could see useful raw evidence in the initial briefing but could not
use that row as the first bridge anchor. The host rejected the anchor because
no search had returned it. A separate failure also hid the final reason why a
repaired answer commitment was rejected.

## What Changed

Raw canonical briefing rows can now guide the first `memory_bridge` call. The
bridge still costs one retrieval call. The initial seed costs nothing and
does not count as searched, returned, new, or selected evidence.

If an answer commitment and its one repair both fail host validation, the
terminal error now includes the final bounded host rejection code and reason.

## What I Should Know

The change does not trust summaries as evidence. Only scoped raw canonical
briefing messages are eligible. Model-derived digest rows and unknown IDs are
not eligible. A briefing anchor is routing context, not automatic support for
the answer.

The rejection detail contains only two bounded strings. It contains no prompt,
evidence body, provider body, or credential.

## Review And Acceptance

- Focused contracts pass 82/82, core passes 93/93, quickstart passes 6/6, and
  legacy passes 969 with 15 optional skips and zero failures.
- Independent review is pending.
- The founder authorized execution of BRN-0045, BRN-0046, and BRN-0047 and
  directed merge after a clean independent review.

## What To Check

- Confirm that the independent reviewer finds no unresolved P0-P3 issue.
- In a later paid diagnostic, confirm that the failed bridge case can now
  continue and that the final rejection detail is useful when a commit fails.

## Recommended Next Move

Commit the provider-free candidate and request independent review. If the
review accepts it, record founder acceptance, merge it, and run final checks
on `main`.

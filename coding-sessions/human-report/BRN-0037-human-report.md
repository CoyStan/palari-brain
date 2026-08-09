# BRN-0037 Human Report

## Why This Mattered

BRN-0036 changed confirmation so a fully delivered candidate page can close
without scanning every lower-ranked result. This one-question diagnostic was
meant to test that change on the health case that previously found the correct
answer but failed after two full pages.

## What Changed

No product behavior changed. One new private, gitignored diagnostic identity
ran the frozen health question exactly once with no retry or tuning. The run
and a provider-free replay were audited, and the outcome was recorded in
`STATUS.md`.

## What I Should Know

The run produced no official answer or grade. Its provisional answer had only
Fitbit and Accu-Chek, but confirmation recovered raw user evidence for the two
missing categories, hearing aids and a nebulizer. The page contained 20 unique,
fully delivered candidates and no previously returned evidence. The reviewer
attempted only 19 assessments, so the host correctly rejected the incomplete
review before it could revise or close.

Measured provider spend was `$0.00853124`; conservative failure accounting
retained the authorized `$0.70` reservation and brought the private aggregate
ledger exactly to `$37.21155714`. The frozen source hash was unchanged, no
durable memory was written, sealed U8 was excluded, and no retry occurred.

## What To Check

Check that the report does not call this a score or claim v7 closure succeeded
or failed. The evidence supports only that confirmation retrieved all four
decisive device facts and that a separate 20-candidate/19-assessment interface
failure prevented completion.

## Recommended Next Move

Do not rerun this consumed identity. If desired, open a separate small product
ticket for general confirmation-assessment completeness, with provider-free
tests and no health-specific rule, before considering another paid diagnostic.

# BRN-0038 Human Report

## Why This Mattered

The health reviewer found the two missing device categories but failed because
it returned 19 repetitive assessments for 20 candidates. Requiring prose for
every irrelevant memory created bookkeeping work without proving better
semantic review.

## What Changed

The reviewer now reports only material findings using short page-local numbers.
An empty findings list means nothing on the fully displayed page changes the
answer. The host, not the model, binds those numbers to immutable evidence IDs
and treats unlisted candidates as non-material for that answer journey.

## What I Should Know

This is smaller output, not weaker host enforcement. Invalid, duplicate,
fractional, out-of-range, repeated, extra-field, and old-format responses fail
closed. A material finding still forces revision and another search. An empty
review cannot close a character-truncated page, and ignored or duplicate
information cannot recur. No health-specific rule, new model call, larger
budget, bridge behavior, or durable memory was added.

## What To Check

Independent review should verify that explicit candidate numbers bind correctly
even when findings are returned out of order, that every unlisted candidate is
excluded from later confirmation retrieval, and that complete-page versus
character-truncation behavior remains unchanged.

## Recommended Next Move

Accept only after fresh read-only review confirms the sparse schema, host
validation, tests, and isolation. Any paid health rerun belongs to a separate
ticket and requires a new numeric aggregate cap.

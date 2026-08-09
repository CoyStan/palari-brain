# BRN-0041 Human Report

## Why This Mattered

Palari's reviewer correctly found more useful information twice, but our code
allowed only two searches and then discarded the revised answer because it had
not observed a separate clean round. The host was micromanaging the reasoning
loop instead of protecting only real safety boundaries.

## What Changed

The reviewer now owns the confirmation work: it chooses unseen searches,
reports only material findings, revises, and continues. Two searches are no
longer a product rule; the normal default is the full existing four-search
allowance.

If that emergency allowance is genuinely exhausted after the latest page was
reviewed, Palari returns the newest valid evidence-backed answer and labels its
confirmation incomplete. It no longer throws away the answer. Invalid or
invented evidence and unreviewed pages still cannot pass.

## What I Should Know

This trusts the model on semantic judgment while leaving the host responsible
for provenance, duplicate exclusion, isolation, bounded work, and exact
evidence validation. No health-specific rule, semantic ontology, or benchmark
answer was added.

All work was provider-free. Focused tests pass 39/39, core tests 87/87,
quickstart 6/6, and legacy 919 pass with 15 optional skips and zero failures.

## What To Check

Confirm that the diff simplifies responsibility rather than hiding the old
failure behind a larger arbitrary number. In particular, confirm that the
model controls queries and revisions, bounded exhaustion returns an honestly
labelled answer, and the incomplete path cannot bypass evidence validation or
candidate review.

## Recommended Next Move

Obtain independent review, then founder acceptance and merge. Only afterward,
if desired, prepare one fresh no-tuning health diagnostic under a new numeric
aggregate cap. Do not treat provider-free contracts as proof of live answer
quality.

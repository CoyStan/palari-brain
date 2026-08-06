# BRN-0024 Human Report

## Why This Mattered

The prior 6/10 used ten questions we later inspected while debugging. This
ticket freezes a different, uninspected ten so we can measure whether the
current architecture generalizes instead of rewarding familiarity.

## What Changed

Luna still answers with native Ettin ranking, but it now has the general
temporal/relational plan, explicit evidence commitments, honest non-use
reasons, and temporary revisable inference rules accepted in BRN-0019. Its
structured input is counted exactly before every generation reservation.

## What I Should Know

One writer smoke and one answer smoke must pass before question 1. The ten run
once in fixed order. Any failure or cap stop is final—no retry, replacement,
regrade, or top-up. Historical 6/10 and sealed U8 never change.

## What To Check

The offline freeze is implemented and costs `$0.00`. Proposed maximum fresh
accounted spend is `$5.00`, including conservative unknown count billing.
Independent review and exact founder authorization are still required before
the first live request.

## Recommended Next Move

Obtain fresh independent pre-dispatch review. If it is clean, request the
founder's exact identity and numeric-cap authorization; do not dispatch under
the earlier general direction or any predecessor authority.

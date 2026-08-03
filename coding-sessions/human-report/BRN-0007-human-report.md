# BRN-0007 Human Report

## Why This Mattered

The first Luna run proved that retrieval worked but stopped on question 5
because Luna kept searching and never answered. BRN-0006 added the missing
four-call stop and final answer transition. This new identity measures whether
that specific repair lets the same ten-question diagnostic finish.

## What Changed

Only the accepted answer-loop behavior changes versus terminal v1. Luna may
use up to four memory calls. If it uses all four, it gets one final response
with memory tools unavailable and must answer from accumulated evidence or say
that stored evidence is insufficient. Embeddings, questions, memory contents,
retrieval ranking, judge, model effort, and grading stay fixed.

## What I Should Know

This is not a rerun of v1: it is a fresh v2 identity measuring a changed
product candidate. The questions are already known, so the result is useful
for diagnosis but not a claim about unseen users. The prior accuracy prediction
is carried forward unchanged to avoid tuning expectations after seeing v1.

The test has a `$1.00` fail-closed fresh cap. Before the run, fresh spend is
`$0.00`; no credential value has been printed or committed.

## What To Check

The independent reviewer should confirm the old result remains immutable, the
only treatment change is BRN-0006, the fifth retrieval cannot execute, forced
finalization has no tools, all providers share one meter, and the launcher can
be invoked only once.

## Recommended Next Move

Run the single authorized invocation only after a clean independent GO review.
Whatever happens—success, wrong answers, provider failure, or cap stop—is the
terminal result and must be recorded without reroll or regrade.

# BRN-0015 Human Report

## Why This Mattered

The last Luna + Ettin run found the right memory for three questions and still
answered as though it had not. BRN-0014 now forces Luna to cite exact returned
memory before Palari accepts its answer. This ticket measures whether that
structural repair changes the same ten-question result.

## What Changed

The questions, sessions, Gemini embeddings, local Ettin, Luna settings,
official judge, limits, and order are unchanged. Only the accepted cited-answer
boundary differs. The new identity can run once, cannot reach sealed U8, and
will stop permanently on a smoke, cap, provider, or seal failure.

## What I Should Know

The local and live compatibility tests passed. The first four questions then
scored 3/4, and every answer carried an authentic exact citation. On question
five, Palari correctly tried to force the citation tool after four searches,
but our private cost meter did not recognize that valid request shape and
stopped the run before sending it. The final six questions were never reached.

This means there is no new 10-question score. `3/4` describes only the reached
prefix. The honest result is a sealed failed run, not an 8/10 miss and not a
reason to reroll. It cost `$0.37751938` accounted; cumulative accounted spend
is `$6.40824561`, safely below the authorized cap.

## What To Check

Independent review should rehash the sealed 37-artifact bundle, reconcile all
66 calls and spend, verify the rejected fifth request was never dispatched,
confirm the meter mismatch diagnosis, and ensure no result was altered or
retried.

## Recommended Next Move

Accept the immutable measurement record after fresh terminal review. Then fix
the general forced-function meter compatibility in a separate offline ticket.
Do not run another live identity without a new exact founder cap.

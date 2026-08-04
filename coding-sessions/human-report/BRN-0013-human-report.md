# BRN-0013 Human Report

## Why This Mattered

Ettin is now wired through a supported local path, but the previous Luna test
stopped before it could score even one candidate. This fresh identity asks the
end-to-end question once without rewriting the failed evidence.

## What Changed

No product behavior changes in this ticket. The frozen run uses the accepted
BRN-0012 repair and otherwise preserves the previous Luna, Gemini embeddings,
judge, questions, prompts, search ceiling, and local Ettin model.

## What I Should Know

The one invocation completed at 6/10 under its `$1.50` hard budget. Ettin and
Luna now work together end to end: every question completed, and retrieval
found 12 of 13 required sessions. The four wrong answers had all of their
required sessions in front of Luna. This means the remaining issue is not the
local ranker—it is the answer step ignoring, replacing, or miscombining
relevant evidence.

Fresh accounted spend was `$0.75899237`; cumulative accounted spend is
`$6.03072623`. The run is permanently sealed and cannot be retried.

## What To Check

Independent terminal review should verify all ten labels and 12/13 coverage,
the distinction between ranking and downstream answer failures, the exact
ledger and 138 successful calls, the 73-artifact seal, zero credential
matches, and that the exclusive identity cannot execute twice.

## Recommended Next Move

Accept this terminal record if fresh review is clean. The next engineering
unit should be offline and provider-neutral: force the answer boundary to
explicitly select and compose cited evidence before prose generation, tested
on general adversarial cases rather than these known answers. A new scored run
requires a separate founder GO.

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
found 12 of 13 required sessions. All four official FAIL rows had their
required sessions. Three are genuine answer-use/personalization failures. The
fourth is a clear judge mistake: the correct answer was `3 days`, Luna said
`3 days`, and the judge still said `No`. We keep the official 6/10 unchanged
because the run cannot be regraded, but the engineering diagnosis must not
blame Luna for that row. Neither limitation is the local ranker.

Fresh accounted spend was `$0.75899237`; cumulative accounted spend is
`$6.03072623`. The run is permanently sealed and cannot be retried.

## What To Check

Independent terminal review should verify all ten labels and 12/13 coverage,
the distinction between ranking, three downstream answer failures, and one
judge false negative; the exact
ledger and 138 successful calls, the 73-artifact seal, zero credential
matches, and that the exclusive identity cannot execute twice.

## Recommended Next Move

Accept this terminal record; fresh rereview is clean. The next engineering
units should be offline and provider-neutral: one for explicit cited-evidence
selection/composition, and a separate one for judge robustness. Both must use
general adversarial cases rather than these known answers. A new scored run
requires a separate founder GO.

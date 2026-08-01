# BRN-0002 Human Report

## Why This Mattered

The first six had shown that Palari often retrieved the right memory but still
answered as if nothing relevant existed. BRN-0001 repaired the answer contract
and added host-computed time. The first-ten run was the live check of whether
those changes actually solved the problem.

## What Changed

No product code changed in this ticket. One fresh, preregistered, independently
reviewed identity ran compatibility and all ten questions exactly once under a
`$1.50` cap. The result, calls, spend, and private transcripts are now sealed.

## What I Should Know

The result is 5/10, below the predicted 8/10. This is disappointing but useful:
the time repair worked—the former three-month miss is now correct—but the
instruction-only evidence-use repair did not generalize. Four wrong answers
had the required memory in the model's tool results and still ignored it. Only
one wrong answer was a real retrieval miss.

This means the storage and semantic surfaces are not the main bottleneck on
these ten. The next engineering target is the evidence-to-answer boundary:
make using returned canonical evidence a verifiable provider-neutral contract,
while keeping honest absence for a genuine zero-result search.

Fresh accounted spend was `$0.78886025`; exact cumulative J4 spend is
`$4.3642649`. The run stayed below every cap. No key leaked, no predecessor was
changed, and there was no retry or regrade.

## What To Check

- Official score 5/10 and positive answer-session coverage 11/13.
- Four relevant-evidence answer failures versus one retrieval failure.
- Temporal repair corrected the former three-month failure.
- Private manifest
  `554efab7c320ae2c2224ddbb9976d4a0b75afe66a5dab02c2ab227bc5b16816c`.

## Recommended Next Move

Open one offline product ticket for a provider-neutral evidence-to-answer
contract plus transcript-derived regressions for the four failure shapes.
Keep the retrieval miss separate. Do not run another live benchmark until the
offline contract is reviewed and a new R3 identity is explicitly authorized.

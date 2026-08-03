# BRN-0007 Human Report

## Why This Mattered

The first Luna run proved that retrieval worked but stopped on question 5
because Luna kept searching and never answered. BRN-0006 added the missing
four-call stop and final answer transition. This new identity measures whether
that specific repair lets the same ten-question diagnostic finish.

## What Changed

The fix worked on the exact failure that motivated it. Question 5 stopped at
four memory calls, Luna received one tool-disabled final turn, produced an
answer, and passed. Six questions were officially graded `PASS, FAIL, PASS,
PASS, PASS, PASS`, or 5/6. Question 6 also improved from the Gemini baseline's
FAIL to PASS.

## What I Should Know

The run did not finish all ten. Question 7 completed its Luna answer, but the
meter refused before judging it because the next worst-case reservation would
have crossed `$1.00`. It has no label, and questions 8-10 were not reached.
Therefore this is not a 5/10 result and cannot establish the predicted 7/10.

Fresh accounted spend was `$0.52888556`; most of it is conservative Gemini
embedding uncertainty, not measured charges. All 44 private artifacts verify,
and neither configured credential appears in them.

## What To Check

The terminal reviewer should confirm the six labels, question-5 finalization
wire, question-7 pre-judge cap refusal, exact accounting, manifest, and that
the v2 identity cannot run again.

## Recommended Next Move

Accept the structural result after independent terminal review. If completing
questions 7-10 is still valuable, authorize a separate higher-cap identity;
never rerun v2. The next cap should cover accumulated embedding uncertainty
plus one conservative judge reservation at every remaining boundary.

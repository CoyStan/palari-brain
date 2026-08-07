# BRN-0027 Human Report

## Why This Mattered

The third attempt got farther than the previous two and needed an exact record
so a successful provider wire would not be mislabeled as a model failure, spend
would not be understated, and the consumed identity would never be reused.

## What Changed

The terminal result is now reconciled and documented. Ettin worked, Gemini's
writer worked, OpenAI accepted the token-count request, and Luna accepted the
full answer request. Then Palari failed while calculating the cost of that
successful Luna response.

One part of the harness called the context size `short`; another expected the
name `shortContext`. That naming mismatch stopped the answer smoke before any
of the ten benchmark questions ran. No runtime or private evidence was changed.

## What I Should Know

- Questions completed: `0/10`.
- This is not a Luna-quality or Ettin-quality result.
- Measured spend: `$0.0004775`.
- Uncertain reserved spend: `$0.0511499`.
- Fresh accounted spend: `$0.0516274`.
- Cumulative accounted spend: `$7.90712669`.
- The result is safely sealed and the identity is permanently consumed.
- Historical `6/10` and sealed U8 are unchanged.

There are no session-recall, exact-span, equivalent-fact, selected-evidence, or
materially-used-evidence numbers because no benchmark question ran. We did not
invent zeros or create a semantic review for missing rows.

## What To Check

The provider compatibility questions are now answered: both OpenAI endpoint
wires returned HTTP 200. The remaining failure is a small, generic internal
adapter mismatch with a precise location. The honest result also prevents us
from accidentally retrying the consumed identity or understating spend.

## Recommended Next Move

Independently review and accept this terminal record. Then open a separate
offline repair ticket to normalize the two context-band names and add the
exact regression. Only after that repair is reviewed should a new live identity
be proposed. This ticket authorizes no new run.

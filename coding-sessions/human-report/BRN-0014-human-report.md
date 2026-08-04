# BRN-0014 Human Report

## Why This Mattered

The last live run retrieved every required session for three questions and
still produced generic or false-absence answers. Retrieval quality alone could
not stop Luna from ignoring evidence it had already received.

## What Changed

Luna can no longer search Palari's memory and then quietly answer as if it had
not seen the result. After any real memory evidence is returned, Luna must cite
the exact stored evidence ID and copy an exact quote through a host-controlled
commit step. Palari accepts only the exact object created by that step.

## What I Should Know

A correct commitment adds no extra model call. If Luna first returns uncited
text or a malformed citation, Palari gives it one tightly constrained repair
where no memory search is available. A second miss stops instead of presenting
an unsupported answer. Honest answers after an empty search still work as
before.

A real quote is not automatic proof that the prose logically follows from it.
The repair guarantees auditable declared evidence use; it does not install a
hidden benchmark grader or tune any known answer. The official prior 6/10 is
unchanged.

## What To Check

All 49 focused contracts and the full 705-pass suite are green. Seven
provider-free scenarios cover owned resources, Palari advice, multi-row
history, corrections, time, irrelevant results, and empty results. Quickstart
remains 6/6. No provider, model, credential, terminal result, or spend was
touched.

## Recommended Next Move

Accept and merge this offline repair; fresh independent review is clean. A new
live ten-question invocation is still a CEO/founder spending gate.

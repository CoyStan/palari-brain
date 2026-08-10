# BRN-0049 Human Report

## Why This Mattered

The last two S60 cases failed for different reasons. One useful answer was
rejected by the host, but the shared log lost the exact safe rejection reason.
The other case received HTTP 429 after separate processes used independent
request pacing.

## What Changed

The shared log now keeps only the safe details needed to diagnose these two
failures. Separate worker processes can also use one durable request and unit
ceiling.

## What I Should Know

The pacing path is optional and local to one host. It stores no question,
prompt, evidence, answer, provider body, or credential. It does not retry a
provider call. A bad state file or a different policy fails closed.

## What To Check

Focused 25/25, core 101/101, quickstart 6/6, and legacy 978 pass with 15
optional skips and zero failures. A six-process test and five more stress
repetitions stayed inside the shared ceiling.

## Recommended Next Move

Complete independent review. If accepted, merge and push. Then rerun only the
two remaining live cases under the existing founder-approved aggregate cap.

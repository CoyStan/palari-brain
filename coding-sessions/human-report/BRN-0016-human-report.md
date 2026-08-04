# BRN-0016 Human Report

## Why This Mattered

BRN-0015 stopped because our private cost meter knew two Luna request shapes
but not the third shape Palari legitimately uses to force an evidence citation.
The product did the right thing; the harness rejected it before sending it.

## What Changed

There is now one tested validator for all three exact answer shapes: ordinary
memory-tool use, a plain answer when no evidence exists, and forced cited
commitment when evidence exists. It validates and freezes the request before
the meter reserves money or sends anything.

## What I Should Know

The previously rejected forced request now passes locally. Fourteen changed or
hostile request fixtures fail before even a fake reservation. A fresh private
template imports the exact tracked validator and passes fake compatibility.
No key was read, no provider or model was called, no result was created, and
spend was `$0.00`.

BRN-0015 remains untouched and cannot be retried. This repair does not itself
tell us what questions 5-10 would score.

## What To Check

Review the exact three accepted modes, ensure validation always precedes
reservation/dispatch, verify invalid shapes cannot reach either callback, and
rehash the private template plus the unchanged BRN-0015 sealed files.

## Recommended Next Move

Accept this offline repair after full verification and independent review.
Then prepare—but do not run—a fresh measurement identity. A live invocation
needs a new exact founder cap.

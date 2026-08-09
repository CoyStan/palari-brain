# BRN-0036 Human Report

## Why This Mattered

The health rerun already had the correct four-device answer, but confirmation
rejected it after reviewing 40 new candidates because lower-ranked search
results still existed. The safety check had accidentally become a corpus scan.

## What Changed

Confirmation now distinguishes a page it failed to finish delivering from a
normal lower-ranked search tail. A character-cut page must continue. A complete
top-20 page can close when the reviewer explicitly rejects every displayed
candidate. Material evidence still keeps the answer open.

## What I Should Know

This does not add a relevance threshold, domain rule, larger budget, bridge
edge, or new model call. Duplicate/ignored evidence remains unretrievable, full
canonical sources remain host-side, and no durable memory is written.

## What To Check

Independent review should verify that only character truncation controls page
incompleteness, all displayed candidates still require assessment, material
evidence cannot close, and the two general tail tests cover both directions.

## Recommended Next Move

Accept and merge only after a fresh read-only reviewer finds the committed diff
and verification evidence clean. Do not run another paid diagnostic under this
ticket.

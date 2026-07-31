# BRN-0001-B Human Report

## Why This Mattered

The terminal v5 run retrieved a November workshop row for a February question,
quoted both dates, and still answered zero months. Calendar arithmetic was
being delegated to the answer model even though the host already owned both
timestamps.

## What Changed

Answer-facing rows now carry host-derived `questionRelativeTime` metadata:
evidence time, question reference time, past/same/future relation, signed whole
days, and signed whole calendar months. The exact November-to-February case is
three months. Partial months, leap dates, year crossings, same instants, and
future evidence are deterministic.

The metadata is attached only to copied rows. Stored canonical text, speaker,
evidence identity, session, and observation time remain unchanged.

## What I Should Know

This is not natural-language temporal reasoning. No model, caller text, or
provider can supply or override the arithmetic. Missing or invalid dates omit
the block. Offline tests prove the host boundary, not live model compliance.

## What To Check

- Verify exact `wholeCalendarMonths: 3` for the measured date pair.
- Check negative future values and partial-month adjustment toward zero.
- Confirm all four answer-facing surfaces preserve canonical rows.
- Confirm no dependency, schema, graph, reducer, or benchmark path changed.

## Recommended Next Move

Have a fresh reviewer inspect the committed B branch. If accepted, integrate B
into the BRN-0001 parent and proceed to BRN-0001-C, the provider-free
composition regression. Do not run a live evaluation yet.

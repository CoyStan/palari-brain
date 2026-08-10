# BRN-0042-B Human Report

## Why This Mattered

Removing provider-authored quote fields changed the exact active OpenAI request
bodies, so the live accounting contract needed new byte and hash pins.

## What Changed

Only the active generation and count-projection pins were refreshed. Each body
is 24 bytes smaller; the historical BRN-0025 compatibility pins were left
unchanged.

## What I Should Know

The focused file passes 16/16. The combined parent and both children pass the
complete legacy tier with 928 passes, 15 optional skips, and 0 failures across
943 tests. No paid provider or private artifact was used.

## What To Check

The active request must still be counted exactly once, and no historical
consumed pin should change.

## Recommended Next Move

The founder authorized acceptance and merge after the requested change was
ready. This narrow child requires no independent review and is accepted for
integration into BRN-0042; the R2 parent still requires fresh independent
review before its own acceptance.

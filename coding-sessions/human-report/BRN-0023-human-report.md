# BRN-0023 Human Report

## Why This Mattered

The prior Sol diagnostic stopped after Phone because byte-based reservations
greatly overstated structured prompt size. BRN-0022 proved OpenAI can count the
real tool-bearing body, but that capability was not yet safely composed with a
generation call.

## What Changed

The evaluation harness now has one reusable offline-tested boundary: reserve a
count attempt, count the exact body once, reserve the model call from that exact
count, then generate once. Luna's newly reduced Standard prices and Sol's
existing prices are both pinned. Count uncertainty and generation cost remain
separate.

## What I Should Know

This changed no production answer behavior and made no provider call. It does
not assume counting is free. A failed count, reservation, or generation
consumes that operation without retry.

## What To Check

- Count reservation precedes count transport.
- Exact generation reservation precedes generation transport.
- Luna/Sol math and long-context threshold are exact.
- No credential, endpoint, filesystem, retry, or settlement is hidden inside
  the generic boundary.

## Recommended Next Move

Obtain independent review. If clean, prepare BRN-0024 on a held-out ten with a
fresh one-shot identity and a budget derived from the new exact-count policy.

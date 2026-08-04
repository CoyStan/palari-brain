# BRN-0011 Human Report

## Why This Mattered

Yes—we found a wheel to reuse, but it is not a ready-made JavaScript package.
Nearly every real Ettin integration uses Hugging Face's Python
`CrossEncoder`. The two public non-Python implementations rebuild the same
small scoring head that Palari already built. Replacing our code with either
would add a Python service, a custom export pipeline, or a Rust runtime without
evidence of better latency or quality.

## What Changed

No product code changed. The research identified the exact upstream-supported
path, classified nine substantive public integrations, compared five runtime
choices, and traced the terminal failure through Transformers.js 4.2.0 source.

## What I Should Know

BRN-0010 did not fail because Ettin or Palari's scoring math was wrong. It
failed before inference because Transformers.js 4.2.0 forgot the caller's
custom cache setting while checking whether tokenizer files exist. With remote
access disabled, it looked in the wrong place and then tried to read an
undefined tokenizer configuration.

No model was loaded, no test question was run, no key was read, and spend was
`$0.00`.

## What To Check

Check the primary-source links, the public-integration classifications, the
static failure trace, and that the recommendation does not mutate or rerun
BRN-0010.

## Recommended Next Move

Keep the native Ettin scorer that already measured 14/15 and about 26 ms per
case. In a separate small ticket, point Transformers.js at the exact absolute
local model directory instead of asking it to rediscover a Hub-style cache.
Keep network access disabled and all existing hash/provenance checks.

That next ticket is not approved by this research.

# BRN-0025 Human Report

## Why This Mattered

BRN-0024 was consumed for a programming error that syntax checking could not
see: the final runtime still called a helper that its composer had deleted.
The evaluation never reached Ettin or an AI provider.

## What Changed

Generated runtimes now have to execute their real provider-free smoke from the
final bytes. A permanent test recreates the exact deletion. The new successor
runtime actually built a temporary Palari brain, ranked synthetic memories
with cached Ettin, returned `It is titanium.`, and cleaned up afterward.
After independent review found three pre-run defects, the cumulative repair
also proves the required helpers actually ran, hashes all 48 transitive source
modules from one reviewed root, and fixes the one-shot state sequence so the
runtime can consume exactly one launched attempt.
The latest repair removes a subtle review deadlock: the review note no longer
tries to contain the hash of the commit containing itself. The founder still
must name the exact final reviewed commit. Offline verification now calls the
same real consume function that a live run would call, then proves it cannot be
used twice.

## What I Should Know

- The successor identity is `j4-luna-ettin-unexecuted11to20-v2`.
- The identity ran exactly once and is consumed. It cannot be retried.
- Cached Ettin and the Gemini writer smoke passed.
- Luna rejected the first answer-smoke count request because `include` is an
  unknown parameter. No answer generation or benchmark question ran.
- This is a new evaluation, never a rewrite or retry of consumed BRN-0024.
- Fresh accounted spend is `$0.0504775`: `$0.0004775` measured Gemini spend
  plus the `$0.05` uncertain Luna count attempt. Cumulative accounted is now
  `$7.85549929`.
- Historical `6/10` and U8 remain unchanged.
- The result is unsealed because the launcher mistook the expected
  `transcripts/` directory for a mode-0600 file. We must not seal it later.

## What To Check

Independent terminal review should reconcile the immutable unsealed snapshot,
the one writer call, the failed Luna count call, and exact accounting. It must
not inspect benchmark content, create judged labels, change private bytes, or
try to seal the result after the fact.

## Recommended Next Move

Accept this as an honest terminal compatibility-plus-harness failure after
clean independent review. Open a separate governed repair ticket for both the
unsupported `include` parameter and directory-aware artifact sealing before
freezing any new identity. Do not retry BRN-0025.

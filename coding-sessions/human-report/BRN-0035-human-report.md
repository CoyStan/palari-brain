# BRN-0035 Human Report

## Why This Mattered

Palari was repeatedly failing in its evaluation bureaucracy before it reached
the memory behavior we wanted to learn about. Alpha development needed a fast
repair loop, not release certification on every attempt.

## What Changed

There is now one reusable debug command with injected model/retrieval parts,
bounded retries, continue-on-error diagnostics, mutable private logs, and one
simple dollar cap. The default test gate fell from 825 tests / 19.04 seconds to
10 tests / 0.40 seconds. The full old suite is still available on demand.

The new policy clearly separates repeatable alpha debugging from an explicitly
declared release benchmark. The brain itself was not rewritten.

## What I Should Know

Twenty official agent and memory-framework repositories were reviewed. Palari
adopts their smallest useful patterns without installing any of them. Nothing
historical was deleted: the exact old repository is recoverable by annotated
tag, and the legacy suite remains green.

No provider was called, no credentials or dataset were read, and no money was
spent. The historical `6/10` and sealed U8 are unchanged.

## What To Check

An independent reviewer should verify the cap cannot be crossed through a
failed retry, logs cannot be mistaken for benchmark grades, injected
dependencies remain provider-free in tests, all 20 repository links are
official, the legacy suite and quickstart pass, and the recovery tag exists.

## Recommended Next Move

After acceptance, use this runner for a small founder-budgeted diagnostic of
the actual memory path. Fix and rerun within that aggregate cap. Freeze a
release benchmark only after the end-to-end path works.

# BRN-0021 Human Report

## Why This Mattered

BRN-0020 stopped after one of four questions even though actual spend was only
about eight cents. The cap was not consumed by real usage; the old harness had
to reserve as if every UTF-8 request byte were a billable token at the highest
rate. Separately, opening a sealed SQLite copy in place let SQLite touch or
create sidecars after the terminal seal.

## What Changed

The harness can now accept OpenAI's exact structured-input count through a
small injected adapter and reserve from that validated count. It retains the
old conservative byte bound for situations where no count request is made.
The monetary result is exact integer accounting, not floating-point rounding.

SQLite audits now copy the database and its WAL/SHM files to temporary owned
storage before SQLite opens anything. The original file set, hashes, and modes
are checked afterward, and temporary state is removed even if the audit fails.

## Measured Offline Result

Across three fixed synthetic request shapes, exact-count reservations were
`6.907x`, `13.939x`, and `6.095x` smaller than the old byte fallback while
keeping the full 512-token answer ceiling. All 12 focused tests, 754 repository
tests (15 optional skips), and the 6/6 quickstart passed.

No provider was called, no key was read, no private result was opened, and no
money was spent. The cumulative ledger remains `$7.75502179`. The historical
6/10 and BRN-0020 terminal result are unchanged.

## What I Should Know

This proves the offline safety and accounting shape, not the live count wire.
Official OpenAI guidance says the provider endpoint is needed for exact
structured requests, but its compatibility and billing treatment still need a
separate tiny founder-authorized probe. We do not assume that call is free.

## What To Check

- Independent review should try forged count records, accessor/prototype
  attacks, numeric-bound mistakes, source-path races, sidecar changes, and
  cleanup escapes.
- Review should confirm no fallback can happen after a count dispatch fails.
- Review should confirm no BRN-0020 private artifact was accessed.

## Recommended Next Move

Accept and merge only after fresh independent review. Then prepare a separate
small compatibility-probe ticket for the official count endpoint; do not run
another benchmark yet.

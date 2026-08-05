# BRN-0018 Human Report

## Why This Mattered

The four BRN-0017 failures mix two different causes: some required facts never
reached the answer model, while other useful facts arrived but were not used.
Changing retrieval and the answer model together would hide which cause moved.

## What Changed

No product behavior or historical result changed. The ticket freezes one
answer-only control: replay the exact final context of each failure once with
Sol instead of Luna, preserving every other request field. There is no new
search and no judge. Because the exact context includes Luna's prior encrypted
reasoning and tool trajectory, the result isolates the final Sol turn—not a
complete end-to-end Sol run.

## What I Should Know

The expected useful result is asymmetric. Sol should improve Phone and Miami,
where enough evidence was delivered. It should not invent Instant Pot or the
user's Tokyo apps when their original user statements were missing. That split
would confirm both an answer-application gap and an evidence-delivery gap.

The authorized run completed once. Sol fixed the Phone behavior by explicitly
using the existing power bank. It did not combine Miami's view and balcony
hot-tub evidence. It correctly refused to guess the missing Instant Pot fact,
but Tokyo still fell back to old Palari transit advice instead of revealing
that the user's original Suica and TripIt statements were missing.

The control therefore gives a clean answer: a stronger model helps, but it is
not the fix. Palari still needs better evidence delivery and an explicit
evidence-use boundary. The meter conservatively accounted the full `$0.50`,
taking cumulative accounted spend to `$7.67192994`.

## What To Check

- Independent terminal review must reconcile all five calls, usage, raw
  outputs, prediction grades, and the private seal.
- The old 6/10 and labels remain untouched.
- The identity is consumed; there is no retry, reroll, or regrade.

## Recommended Next Move

The clean independent terminal review found no issue, so accept and merge the
immutable result. Then use it as the pre-change baseline for the separate
architecture ticket and repeat the comparison only after those changes.

# BRN-0015 Human Report

## Why This Mattered

The last Luna + Ettin run found the right memory for three questions and still
answered as though it had not. BRN-0014 now forces Luna to cite exact returned
memory before Palari accepts its answer. This ticket measures whether that
structural repair changes the same ten-question result.

## What Changed

The questions, sessions, Gemini embeddings, local Ettin, Luna settings,
official judge, limits, and order are unchanged. Only the accepted cited-answer
boundary differs. The new identity can run once, cannot reach sealed U8, and
will stop permanently on a smoke, cap, provider, or seal failure.

## What I Should Know

The prior official score remains 6/10. We predict at least 8/10 and want 10/10,
but neither is guaranteed. Exact citation makes evidence use auditable; it does
not guarantee correct reasoning or a correct judge. Whatever happens will be
recorded without rerun or regrade.

Offline verification has rehashed the full private lineage, current product,
dataset/order, Ettin model/runtime, launcher, and absent result. No credential
was read, no model loaded, no provider called, and spend is `$0.00`.
The full suite is 705 pass / 0 fail / 15 skip; quickstart remains 6/6 and the
32-file package boundary is clean.

## What To Check

Independent review should verify BRN-0014 is the only treatment, P-set 27 and
the private hashes match, known answers are absent from runtime logic, all
provider paths are metered, the exact cap gate fails before result creation,
U8 is unreachable, and the one-shot identity cannot execute twice.

## Recommended Next Move

Fresh independent pre-dispatch review is clean, and the founder has confirmed
exactly the `$1.50` fresh / `$7.53072623` cumulative caps for one invocation.
Commit this GO, verify once more without credentials, then run the frozen
launcher exactly once and record its terminal result.

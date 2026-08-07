# BRN-0026 Human Report

## Why This Mattered

BRN-0025 reached Luna but sent a generation-only field to the token-count
endpoint, then failed to seal the honest failure because the evidence included
nested directories. The identity was consumed without answering a question.

## What Changed

The full Luna generation request now stays unchanged. A separate explicit
projection sends only the documented fields used by token counting, and both
bodies have their own linked hashes. Any unfamiliar field stops the run rather
than being guessed away.

Terminal evidence is now sealed as a recursive tree. Files must be private
mode 0600, directories mode 0700, and links, special files, escapes, changes,
or a second seal are rejected. The final runtime actually exercised this with
a nested fixture, plus a fake count/generation pair, real cached Ettin, and
one-shot attempt custody.

## What I Should Know

- New identity: `j4-luna-ettin-unexecuted11to20-v3`.
- It has not run and has spent `$0.00`.
- Opening cumulative spend remains `$7.85549929`.
- Proposed caps are `$5.00` fresh and `$12.85549929` cumulative.
- Historical `6/10` and sealed U8 are unchanged.
- Consumed BRN-0025 remains unsealed and byte-identical; this work did not
  repair or rewrite it.
- Offline verification passed with zero credential, dataset, provider, and
  result activity.

## What To Check

An independent reviewer should replay the rejected `include` case, compare the
projected and full fake wires, attack recursive sealing, rehash the complete
import closure and predecessor snapshot, and rerun all verification against
the exact pushed head.

## Recommended Next Move

If independent review is clean, accept the offline freeze. Then stop at a new
founder gate. A live invocation needs exact authorization naming the identity,
both caps, reviewed head, launcher/runtime hashes, and ACCEPT.

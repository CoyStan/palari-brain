# BRN-0028 Human Report

## Why This Mattered

The provider accepted both v3 OpenAI requests, but Palari then used two names
for the same short-context band and stopped locally before answering a question.

## What Changed

Reservation and settlement now speak one public language: `short` or `long`.
One shared helper owns measured Luna/Sol prices and validates the provider's
token counts before releasing a reservation. The exact successful v3 token
shape now reproduces `$0.0004764` offline; the old internal names are rejected.

## What I Should Know

- New identity: `j4-luna-ettin-unexecuted11to20-v4`.
- It has not run and has spent `$0.00`.
- Opening cumulative accounting stays `$7.90712669`.
- Proposed caps are `$5.00` fresh / `$12.90712669` cumulative.
- The old v3 reservation remains uncertain; this does not rewrite history.
- Historical `6/10` and sealed U8 remain unchanged.
- Provider-free verification passed cached Ettin, exact fake count/generation
  wires, exact settlement, one-shot custody, recursive seal, and cleanup with
  zero external telemetry.
- Private launcher/runtime hashes are `db388a28...a02` / `83c2efe7...053`.

## What To Check

An independent reviewer should replay the exact sanitized usage fixture,
legacy-label refusal, malformed token relationships, final-runtime provider-
free evidence, private modes/hashes, predecessor snapshots, and clean pushed
import closure.

## Recommended Next Move

Obtain a fresh independent read-only review of the clean pushed tracked head
and exact private hashes. Acceptance stops at a founder gate.

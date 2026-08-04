# BRN-0010 Human Report

## Why This Mattered

BRN-0009 proved Ettin is a strong, fast local ranker on a synthetic memory
bank. That does not prove Luna answers better. This ticket measures the missing
end-to-end claim on the same first-ten diagnostic used before.

## What Changed

Only evidence ordering changes: Ettin locally reorders Palari's existing
bounded canonical candidates. Luna, Gemini embeddings, the judge, prompts,
memory, questions, four-search limit, finalization, and grading stay fixed.

## What I Should Know

The private one-shot launcher verifies every input and the complete local model
runtime before reading keys. It runs one local smoke, one live compatibility
smoke, then the ten questions if healthy. Every provider is metered without
retry. The hard ceiling is `$1.50` fresh, carrying the cumulative ledger from
`$5.27173386` to at most `$6.77173386`. Any failure is the final result.

The preregistration predicts all ten complete, at least 7/10 pass, the previous
five first-six passes remain passes, question 2 improves, and question 9 stays
a retrieval miss. It also requires the telemetry to prove Ettin actually ran
without changing canonical evidence.

## What To Check

Independent review should reproduce every hash and cap, confirm Ettin is the
only causal treatment, confirm benchmark answers never enter runtime logic,
and confirm the one invocation cannot be repeated or exceed the meter.

## Recommended Next Move

No model inference, credential read, provider call, score, or spend has
occurred. Offline verification and a fresh independent GO review are next;
only then may the founder-authorized one-shot run execute.

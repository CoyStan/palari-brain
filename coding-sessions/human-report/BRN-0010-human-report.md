# BRN-0010 Human Report

## Why This Mattered

BRN-0009 proved Ettin is a strong, fast local ranker on a synthetic memory
bank. That does not prove Luna answers better. This ticket measures the missing
end-to-end claim on the same first-ten diagnostic used before.

## What Changed

The test did not reach Luna. The provider-free local Ettin smoke failed while
loading the cached tokenizer, before it produced a single relevance score.
That stopped the run exactly as designed.

## What I Should Know

No API key was read, no provider was called, no question was answered, and
spend was exactly `$0.00`. Therefore there is no new accuracy number. The
cumulative ledger remains `$5.27173386`.

The private bundle is healthy: all five files rehash, every file is mode 0600,
the manifest has no sealing errors, and the consumed identity cannot run again.
The strongest static clue is that this run forced cached-only model resolution
while the earlier successful Ettin bakeoff did not. That is a hypothesis, not
a result we can confirm by rerunning this identity.

## What To Check

Independent review should reproduce the terminal manifest, zero-call meter,
absent credential markers, exact error, and one-way consumed attempt. It should
also ensure the likely cached-only cause is described as an inference.

## Recommended Next Move

Accept this as an honest failed compatibility result after terminal review.
If end-to-end Ettin validation still matters, open a separate offline repair
ticket for deterministic cached tokenizer loading, prove that with generic
data, then request a fresh identity. Do not rerun BRN-0010.

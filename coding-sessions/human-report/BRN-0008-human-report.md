# BRN-0008 Human Report

## Why This Mattered

Palari was finding the right memory but sometimes burying it among many
plausible messages. This adds a small local relevance pass before Luna or
Gemini sees the evidence, without changing embeddings, calling another
generation model, or giving a model authority over memory content.

## What Changed

On a frozen 15-question synthetic ordering test, plain candidate order put the
answer first 0 times. The selected MiniLM-L6 reranker put it first 13 times,
kept every answer within the top five, and took about 45 ms per case after
loading. It only reorders unchanged canonical messages. Invalid scores stop
the search instead of producing partial or fabricated evidence.

## What I Should Know

The two misses were “which happened most recently?” questions. That is useful:
semantic relevance is not a safe replacement for Palari's trusted timestamps.
Also, this is not proof that the failed LongMemEval answer will now pass. It is
an offline ordering result, and a live answer test would be a new gated unit.

The stronger L12 and mxbai models each scored 14/15, but took about 132 ms and
89 ms per case. The preregistered rule therefore selected L6 as the best
latency/quality tradeoff. Provider spend was exactly `$0.00`.

The Node model runtime reported five high-severity dependency findings and is
large, so Palari does not ship it. The integration is optional; an application
that enables it owns the audited runtime and cache. Palari still works with
its existing RRF order when reranking is omitted.

## What To Check

Independent review should confirm canonical text and provenance cannot change,
score batches fail closed, RRF behavior is unchanged when disabled, the three
result hashes and frozen selection math match, and no runtime/cache/result
bytes or dependency entered the package.

## Recommended Next Move

Accept BRN-0008 if review is clean. Keep MiniLM-L6 as an optional local
default, not a mandatory dependency. Then test it end to end only under a new
founder-approved live identity; do not reuse or reroll an old benchmark run.

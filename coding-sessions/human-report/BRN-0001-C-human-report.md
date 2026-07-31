# BRN-0001-C Human Report

## Why This Mattered

The A and B repairs needed a single offline proof that their answer-boundary
contracts compose before any new provider run is considered.

## What Changed

The first two repairs now have one provider-free composition check. It feeds
synthetic canonical dialogue through the real `answerWithRetrieval` API and
checks the structural inputs a correct answer would need: Palari advice keeps
its speaker meaning, two user-owned appliance observations retain chronology,
and the November-to-February example carries host-computed three-month data.
Irrelevant and empty controls remain explicit.

## What I Should Know

The callback returns a fixed sentinel and never grades a natural-language
answer. The report records `answerQualityGraded: false`, with zero provider
and network calls. It cannot raise or replace the sealed live 3/6 result.

## What To Check

The structural runner is deterministic across two executions, the focused and
full suites pass, and quickstart remains green. The private LongMemEval input
is not present on this machine, so the existing reached-prefix runner was not
invoked and no unlicensed download or fabricated replacement was used; its
import-inert contract tests pass.

## Recommended Next Move

Have a fresh reviewer check privacy, zero-network truth, generic fixture scope,
and the distinction between structural evidence and answer quality. If it
passes, accept and integrate C into the BRN-0001 parent. Do not run a live
benchmark from this ticket.

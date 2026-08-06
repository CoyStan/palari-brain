# BRN-0022 Human Report

## Why This Mattered

BRN-0021 showed that exact provider input counts can make Sol reservations six
to fourteen times tighter in synthetic cases. But Palari had never sent the
real structured tool-bearing body to OpenAI's count endpoint. Integrating an
unproven wire into another benchmark would risk consuming a run on a simple
compatibility mismatch.

## What Changed

BRN-0022 freezes one tiny compatibility request. It contains the Sol model,
instructions, one structured user message, and one strict memory-tool schema.
It makes no generation request. The runner accepts exactly one count call,
writes the full `$0.05` reservation before touching the key, never retries,
and seals success or failure privately.

## What I Should Know

Nothing has been sent to OpenAI yet and no money has been spent. The full test
suite passes, the private result identity is absent, and historical 6/10 is
unchanged. We conservatively keep the entire `$0.05` as uncertain/accounted
after the future call because OpenAI documents the count result but not a
separate billing rule.

## What To Check

- A bad authority, cap, git head, or reused identity must fail before key read.
- The reservation must be durable before the single transport attempt.
- HTTP, JSON, or count-shape failure must seal and stop without retry.
- No key bytes may appear in the private artifacts.

## Recommended Next Move

Have an independent reviewer inspect the committed pushed freeze. If it has no
P0-P3 issue, request one exact founder authorization for the `$0.05` one-shot,
then record the returned count or failure without rerunning.

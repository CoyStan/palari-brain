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

The first independent review found a real filesystem bug before it could
matter: a symlink at the private result-root path could redirect the reservation
and seal outside the repo, and the root's parent was not synced for crash
durability. The repair now rejects that path, holds physical directory handles,
writes through those handles, and syncs the parent before key access. The exact
attack is now a permanent offline test. A fresh reviewer must confirm it.

A second reviewer then caught a related caller-supplied `../outside` escape.
The result root is now a fixed name, not configurable input. A third fresh
reviewer replayed both escapes and every other boundary and found no P0-P3
issue. The freeze is ready for the founder's exact one-call authorization; it
had still not contacted OpenAI at that point.

The founder then authorized the exact reviewed identity. The one live count
request passed: OpenAI reported 77 input tokens in 1.277 seconds. It generated
no answer and made no retry. The private identity is consumed. We retain the
whole five-cent cap as uncertain accounting because the response does not say
what, if anything, was billed; cumulative accounted is `$7.80502179`.

## What To Check

- A bad authority, cap, git head, or reused identity must fail before key read.
- The reservation must be durable before the single transport attempt.
- HTTP, JSON, or count-shape failure must seal and stop without retry.
- No key bytes may appear in the private artifacts.

## Recommended Next Move

Have an independent terminal reviewer rehash and reconcile the consumed result
without rerunning it. If clean, close and merge the ticket; benchmark-launcher
integration remains a separate governed change.

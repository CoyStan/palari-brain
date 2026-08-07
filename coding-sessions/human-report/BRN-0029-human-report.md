# BRN-0029 Human Report

## Why This Mattered

The consumed run needs an exact record so a source-key collision is not
mistaken for model quality, spend is not hidden, and the identity is never
reused.

## What Changed

The fourth run passed the entire compatibility ritual: Ettin, Gemini writer,
both Luna token counts and generations, semantic search, reranking, and a
committed smoke answer. It then stopped while loading the first benchmark
question, before Luna answered that question.

The dataset reused a source session identifier. Palari names a stored turn from
that session ID plus its turn number, so two different snapshots received the
same identity. The memory gate correctly refused to overwrite the first one.
This is a source-key design collision, not a Luna or Ettin quality result.

No product/runtime or private artifact changed; the sealed outcome, accounting,
and generic diagnosis are now documented.

## What I Should Know

- Benchmark questions completed: `0/10`.
- Measured spend: `$0.00126188`.
- Uncertain reserved spend: `$0.10001215`.
- Fresh accounted spend: `$0.10127403`.
- Cumulative accounted spend: `$8.00840072`.
- Immutable seal: 28 entries, fully verified.
- Historical benchmark: still `6/10`; U8 remains sealed.

There are no session-recall, exact-span, equivalent-fact, selected-evidence, or
materially-used-evidence results because no benchmark answer ran. No judged
overlay was created and nothing was regraded.

## What To Check

Independent review should confirm the 28-entry seal, seven-call accounting,
zero question rows, absent semantic overlay, and the source/schema-only finding
that session ID plus turn index is not unique for this instance.

## Recommended Next Move

Independently review and accept this honest terminal record. Then design a
general stable source-identity fix in a separate offline ticket. Only after
that fix is tested and reviewed should a new live identity be considered.

# BRN-0043 Human Report

## Why This Mattered

One long memory could cause all 20--50 candidates to be padded into one large
fp32 Ettin inference. Repeated reranking then killed the evaluation host with
exit 137 even though the stored database was small.

## What Changed

Palari keeps the same fp32 Ettin model, all current candidate text, and the
same 7,999-token context. It now measures exact pair lengths, groups similarly
sized pairs, runs small work-bounded batches one at a time, restores the
original candidate order, and releases native input/output tensors after each
batch. Confirmation can search broadly but cannot send more than 50 rows into
the reranker.

Loading is transactional too: if any tokenizer, model, or head factory fails,
Palari releases every component that did finish loading. A profile shutdown
failure is recorded as a failure rather than a successful run.

The adapters also expose explicit warm/close lifecycle and content-free memory
metrics. An offline native profile command is ready for the audited model
cache, but this ticket did not enter private artifacts or run paid questions.

## What I Should Know

The provider-free product suite is green: focused 77/77, core 90/90,
quickstart 6/6, and legacy 935 pass with 15 optional skips and zero failures.
This proves the scheduling and product contracts, not the final native RSS
number. T3 still has a 6 GiB service memory limit; this code does not install a
cgroup or container boundary.

## What To Check

- Independent review of scheduler math, cleanup paths, ordering, and the
  confirmation shortlist.
- One provider-free frozen-bank `--run` using the audited external runtime and
  model cache for historical rank parity, followed by `--profile` for repeat
  stability and a stable RSS plateau.

## Recommended Next Move

Accept only after a clean independent review. Then run the frozen bank and
native profile in a supervised process before deciding whether a separate
512-token passage/MaxP or AVX2 uint8 challenger is worthwhile. Do not resume
paid hard cases merely because the mock and product contracts pass.

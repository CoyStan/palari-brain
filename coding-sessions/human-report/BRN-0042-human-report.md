# BRN-0042 Human Report

## Why This Mattered

The model was being asked to copy an evidence ID and quote that the host
already possessed. That added cost and a brittle transcription failure without
improving semantic reasoning or evidence custody.

## What Changed

On the OpenAI wire, the model now selects a short stable memory number, marks
it used or not used, and explains why. The host attaches the canonical ID and
a bounded exact returned excerpt before running the same validator as before.
Enumeration follows the same rule. Custom-provider contracts are unchanged.

## What I Should Know

An independent R2 review found no P0-P3 defect and recommends acceptance. The
exact composite passes focused 52/52, core 89/89, quickstart 6/6, and the
complete legacy tier with 928 passes, 15 optional skips, and 0 failures across
943 tests. No paid provider or private diagnostic artifact was used.

The change removes redundant evidence transcription; it does not make semantic
selection stronger by itself. A deterministic bounded excerpt may be less
pinpointed than a model-selected span in a long row, but it remains exact,
host-owned, canonical-ID bound, and auditable alongside the model rationale.

## What To Check

Watch whether real answers choose the right memory and give a useful rationale.
Treat those as semantic-quality signals, not quote-plumbing failures. Do not
rerun the interrupted hard cases without a separate explicit aggregate cap.

## Recommended Next Move

The founder pre-authorized acceptance and merge after a clean review. That
condition is satisfied, so accept BRN-0042, integrate its two accepted children,
rerun the repository gates on `main`, and push.

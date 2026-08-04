# BRN-0008 Ettin Terminal Reviewer Note

Reviewer: fresh-context independent read-only reviewer

Reviewed commit: `0fb01be`

## Review Result

Accept. No P0-P3 findings. This recommendation accepts the honest terminal
compatibility result; it does not claim that Ettin is operational in Palari.

## Findings

None.

The reviewer independently confirmed that P-set 23 and the exact runner and
adapter hashes were committed and pushed at `572ab8e` before the only Ettin
smoke. Pinned public metadata confirms Apache-2.0 English ModernBERT plus the
separate Transformer -> Pooling -> Dense -> LayerNorm -> Dense modules.
Offline ONNX session metadata confirms inputs `input_ids` and
`attention_mask` and sole output `last_hidden_state`, supporting the recorded
wire diagnosis.

Only the Ettin smoke result exists; the unchanged bank/source hashes and old
result hashes/timestamps support that no bank or predecessor model was rerun.
The post-finding `RERANKER_MODEL_UNSUPPORTED` guard fires synchronously before
runtime or cache access, preserves MiniLM-L6 as default, and is tested and
documented.

## Required Changes

None for this terminal ticket. Working Ettin support requires a separately
governed modular-head adapter or local Sentence Transformers sidecar.

## Verification Reviewed

- Focused contracts: 27 pass, 0 fail.
- Full suite: 686 pass, 0 fail, 14 skipped across 700 tests.
- Quickstart: 6/6.
- Bakeoff verify, ticket lint, report lint, committed scope, and diff checks:
  pass.
- Worktree: clean at the reviewed commit.
- Provider calls, generation calls, credential access, datasets, bank runs,
  predecessor reruns, and paid spend during review: zero.

## Recommendation

Founder may accept BRN-0008 as a terminal compatibility finding. Do not call
this working Ettin support. If Ettin remains the selected local model, create
a separate governed successor for its modular scoring head or a local Python
sidecar and preregister a fresh compatibility identity.

# BRN-0012 Technical Report

## State

The provider-free cached-only loader repair is implemented. It has not loaded
a real tokenizer, model, or runtime and has not performed inference or any
provider/credential activity. Independent review is required before delegated
acceptance and merge.

## Root Cause Removed

BRN-0010 passed a Hub model ID plus custom `cache_dir` to Transformers.js
4.2.0 while disabling remote models. Its tokenizer-file discovery discarded
those caller options during a metadata probe, returned no tokenizer files, and
then dereferenced an undefined configuration.

The adapter no longer enters that discovery path. It resolves the frozen
filesystem-cache key as
`<cacheDir>/cross-encoder/ettin-reranker-17m-v1/<revision>` or accepts an
explicit normalized absolute directory within the same cache root. Before any
runtime or head loading it rejects root equality, escape, missing/non-directory
components, symlinks, and canonical escape. Both factories receive the
validated local directory with `local_files_only: true`; only the base model
also receives `dtype: "fp32"`. Hub ID, revision, and custom cache options are
not sent to the factories.

## Unchanged Behavior

The exact model revision, joint query/document tokenization, base transformer,
CLS pooling, Dense/GELU, LayerNorm, final Dense, external artifact hashes,
input/candidate bounds, immutable evidence seam, and BRN-0009 metrics are
unchanged. Model provisioning remains an explicit consumer responsibility;
this cached-only path never downloads missing model files.

## Verification

- Focused Ettin contracts: 6 pass, 0 fail.
- Full suite: 695 pass, 0 fail, 15 skipped across 710 tests.
- Missing, escaped, non-directory, traversal, root-equal, and symlink paths
  fail before runtime/head use; a failed initialization remains stable.
- Both factory argument shapes and absence of Hub/cache/revision discovery are
  asserted directly with fakes.
- Quickstart: 6/6 journey steps passed.
- Package dry-run: 32 files, 128.7 kB tarball / 461.5 kB unpacked; no runtime,
  cache, model, or result bytes included.
- Ticket lint, report lint, committed-plus-dirty scope, and diff checks: pass.
- Real runtime/model/tokenizer loads, inference, downloads, installs, provider
  calls, credential reads, private-result changes, and spend: 0 / `$0.00`.

Fresh independent review remains before acceptance.

## Product Stop Rule

1. A new user can run the basic journey after quickstart closeout.
2. This unit removes the exact pre-inference failure that prevented the
   accepted Ettin ordering stage from reaching Luna.
3. Transformers.js supports direct local directories but does not correctly
   propagate custom-cache options through this 4.2.0 metadata path; BRN-0011
   established the source evidence.
4. Quetzali explicitly requested correct Ettin integration and autonomous
   validation.
5. Deleting the unit restores the known cached-only tokenizer failure or
   forces remote metadata access before a supposedly offline run.

This is a product repair following one research/infrastructure unit, not a
second infrastructure unit.

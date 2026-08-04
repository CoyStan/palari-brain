# BRN-0009 Reviewer Note

Reviewer: fresh independent read-only reviewer
Reviewed commit: `863fa09`
Target: `main` at `7c3d87f`

## Review Result

Reopen. Static inspection found no arithmetic defect, but three acceptance-
boundary gaps must close without rerunning or regrading the frozen result.

## Findings

### P1 — Terminal runtime identity is not verified

The runner imports an arbitrary external runtime module, while the result
record defaults to the constant `@huggingface/transformers@4.2.0`; its loaded-
runtime getter is unused. A compatible substituted runtime could therefore be
misreported. Closure must verify the runtime actually imported and reject a
version other than the frozen one, or explicitly label the preserved result
runtime-unverified if its external bytes cannot be audited. No inference rerun
is warranted.

### P2 — Artifact cache can follow symlinks outside its root

The cache path check is lexical. Normal reads and intermediate-directory
writes can follow a symlink below `cacheDir`, escaping the application-owned
cache. The loader must reject symlinked cache path components before reads or
writes and prove that boundary with a provider-free test.

### P2 — Promised math/parser properties lack direct tests

The math fixture's identity matrix cannot distinguish PyTorch `[out,input]`
weight orientation, and neutral LayerNorm parameters do not prove affine
weight/bias behavior. Deterministic repeatability is not asserted. Parser
tests do not directly exercise dtype, shape, offset, overlap, trailing-data,
frozen-artifact identity, or cache-escape rejection. Add narrow provider-free
tests for the recorded acceptance contract.

## Verification Reviewed

- Exact clean reviewed HEAD `863fa09`; scope and diff check passed.
- P-set 24 source hashes reproduced at preregistration commit `19b4e4a`; the
  result commit follows it.
- Focused contracts: 7/7 pass.
- Full suite: 692 pass, 0 fail, 15 skipped.
- Quickstart: 6/6 pass.
- Ticket lint, scope check, inert bake-off verification, and package dry-run
  passed. The package subpath works and the root surface remains unchanged.
- Report lint lacked only this reviewer note.
- No model inference, download, edit, acceptance, merge, or external call was
  performed by the reviewer.

## Required Changes

Verify the exact imported runtime identity, close the symlink escape boundary,
and add the missing direct provider-free tests. Preserve the terminal result,
P-set, bank, artifact identities, and all no-rerun/no-regrade boundaries.

## Recommendation

Recommend `reopen`. No P0 or P3 finding was identified.

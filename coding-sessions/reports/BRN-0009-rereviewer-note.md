# BRN-0009 Rereviewer Note

Reviewer: second fresh independent read-only reviewer
Reviewed commit: `17f0ef5`
Target: `main` at `7c3d87f`

## Review Result

Reopen. The first review's symlink and test-adequacy findings are resolved,
but runtime provenance remains incomplete.

## Findings

### P1 — Terminal score is not yet bound to the audited runtime

The preserved result names Transformers.js 4.2.0 but contains no runtime path
or hashes. The repaired runner protects future executions only. A later audit
of a preserved directory does not, by itself, prove that directory was the
one imported for the terminal score. Closure needs contemporaneous evidence
binding the original invocation to those bytes or must label the result's
runtime identity unverified and weaken the selection claim.

### P2 — Runtime fingerprint omits transitive implementation bytes

The repaired verifier hashes `src/transformers.js` and adjacent package JSON,
but that entry file re-exports the tokenizer, model, loader, and runtime code.
Those transitive files and ONNX dependencies can drift without changing either
hash or `env.version`. A complete isolated package/dependency closure manifest
or equivalent distribution-integrity proof is required.

## Verification Reviewed

- Prior symlink finding: resolved by component rejection, canonical
  containment, and a direct provider-free test.
- Prior math/parser test finding: resolved by direct nonsymmetric orientation,
  affine LayerNorm, repeatability, descriptor/layout, artifact identity, and
  symlink cases.
- Focused contracts 8/8; full suite 693 pass / 0 fail / 15 skipped across 708;
  quickstart 6/6; ticket/report/scope/diff/package checks pass.
- Frozen source, bank, private result, and head hashes reproduce; cached heads
  load with network forbidden.
- No inference, download, edit, rerun, regrade, acceptance, merge, or push was
  performed by the reviewer.

## Required Changes

Bind the terminal commands to their exact runtime path with contemporaneous
evidence and verify a complete immutable runtime closure, or explicitly mark
the terminal runtime unverified and remove the default-selection conclusion.

## Recommendation

Recommend `reopen`. No P0 or P3 issue, and no other P1–P2 issue, was found.

# BRN-0016 Reviewer Note

## Review Result

Fresh independent read-only review of exact
`25fc0a4` recommends **REOPEN**.

## Findings

- **P1 — tool surface was not exact.** The first validator checked five tool
  keys, ordered names, type, and strictness, but accepted arbitrary non-empty
  descriptions and arbitrary parameter schemas. A forced commitment tool that
  invited uncited text was admitted. `instructions: null` and `input: null`
  were also admitted, so malformed drift could reach reservation/dispatch.
- **P1 — mutable intrinsics/prototypes bypassed the boundary.** Poisoning
  `Array.prototype.map` admitted an unknown normal tool surface. Mutating
  `Array.prototype.toJSON` during reservation changed later serialization even
  though validation had completed. An own `__proto__` data field altered the
  clone prototype rather than remaining own data.

## Verification Reviewed

- Focused: 4/4; full suite: 709 pass / 0 fail / 15 skip; quickstart: 6/6.
- Ticket, scope, diff, private-template hash/mode/pin/verify checks passed.
- Consumed BRN-0015 launcher/runtime/manifest rehashed unchanged.
- Reviewer made no edit and invoked no live path.

## Required Changes

Freeze the complete serialized normal and forced tool definitions, require
non-empty string instructions and non-empty array input, remove mutable
prototype/intrinsic dependencies, and prove post-validation prototype mutation
cannot change the dispatch snapshot. Correct the private template's answer
limit to the product's exact 512-token envelope.

## Recommendation

Reopen. Obtain a fresh independent rereview on the repaired committed head.

## Rereview State

The first-review P1 repair is submitted at a new committed head. Fresh
independent rereview is pending; the prior reopen recommendation remains the
historical result for `25fc0a4`, not an acceptance decision.

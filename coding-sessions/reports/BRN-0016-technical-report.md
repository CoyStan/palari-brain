# BRN-0016 Technical Report

## Files Changed

- `evals/openai-responses-answer-wire.mjs`: import-inert exact request
  snapshot/validator and validation-before-reserve/dispatch gate.
- `tests/openai-responses-answer-wire.contract.test.mjs`: exact three-mode,
  BRN-0015 reproduction, snapshot, ordering, and adversarial rejection tests.
- `STATUS.md`, `docs/DECISIONS.md`, ticket, and reports: governed evidence and
  stop-rule record.
- Private ignored mode-0600 successor meter template: pins/imports the tracked
  validator and supports only offline `--verify`; it is not a run identity.

## Verification

- Focused contract: 5 pass / 0 fail.
- Exact forced request: validation, then one fake reservation, then one fake
  dispatch. Invalid requests: zero reservations and zero dispatches.
- Private offline template SHA-256:
  `6b5ba32ccbee2960f53a47621d3a2bd40c92e5875c648e06181c176161532d5a`;
  mode 0600; validator pin
  `b29387dc286f7f2ab164a9f7d25d81dbbca0a7bf264ea6867f7ba7046ee5cfe2`;
  normal/forced tool pins `46d925c9...` / `0b006512...`; output limit 512.
- Consumed BRN-0015 launcher/runtime/manifest hashes are unchanged.
- Credential reads / provider calls / model calls / result identities / spend:
  `0 / 0 / 0 / 0 / $0.00`.
- Full suite: 710 pass, 0 fail, 15 skip across 725 tests. Quickstart: 6/6.
  Ticket, report, scope, and diff checks pass.

First review at `25fc0a4` found two P1s: descriptions/schemas/null input were
not fully frozen, and mutable prototypes could widen or change the snapshot.
The repair pins complete serialized tool arrays, requires non-empty dynamic
fields, creates null-prototype snapshots using captured intrinsics, and tests
map/toJSON/`__proto__` attacks. Exact product-generated bodies replace the
hand-authored tool fixtures. Fresh rereview is required.

## Product Stop Rule

1. A new user can run the basic journey: quickstart verification is required
   before review.
2. This unit does not change the user journey directly; it removes the exact
   measurement-harness defect that prevented live validation of accepted cited
   answer behavior.
3. OpenAI SDKs serialize forced tool choice, but no external framework provides
   Palari's exact one-shot meter, cap ledger, or three-mode request allowlist.
4. The founder requested autonomous repair and validation toward bug-free
   Ettin + Luna evaluation.
5. Deleting this unit would let a future private meter repeat BRN-0015's false
   rejection or force each launcher to hand-copy a fragile allowlist.

This is one infrastructure unit after a measurement unit. A second consecutive
infrastructure unit is drift and must not start.

## Risks / Follow-Ups

Exact wire admission proves local compatibility, not provider acceptance or
answer quality. The validator intentionally permits only the current low-
reasoning Luna envelope and exact serialized tool definitions. Any future provider/model/tool
change needs a new reviewed contract rather than widening this validator.

The next legitimate unit is a separately frozen measurement identity. That
requires new FINAL predictions, independent pre-dispatch review, and a new
exact founder cap. Nothing in BRN-0016 grants that authority.

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

- Focused contract: 4 pass / 0 fail.
- Exact forced request: validation, then one fake reservation, then one fake
  dispatch. Invalid requests: zero reservations and zero dispatches.
- Private offline template SHA-256:
  `055361961b55d1ff9917c38f4fb261cc620b92a27ec84700a0701d536a21596c`;
  mode 0600; validator pin
  `d1c98a9ce81161760a1e200a012e0a35eb237a06e1b083d0404b025c37d89d5d`.
- Consumed BRN-0015 launcher/runtime/manifest hashes are unchanged.
- Credential reads / provider calls / model calls / result identities / spend:
  `0 / 0 / 0 / 0 / $0.00`.
- Full suite: 709 pass, 0 fail, 15 skip across 724 tests. Quickstart: 6/6.
  Ticket, report, scope, and diff checks pass.

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
reasoning Luna envelope and exact tool names. Any future provider/model/tool
change needs a new reviewed contract rather than widening this validator.

The next legitimate unit is a separately frozen measurement identity. That
requires new FINAL predictions, independent pre-dispatch review, and a new
exact founder cap. Nothing in BRN-0016 grants that authority.

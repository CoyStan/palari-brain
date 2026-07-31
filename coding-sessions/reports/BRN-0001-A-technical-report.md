# BRN-0001-A Technical Report

Implementation commit:
`a8ce9bc1124876b3bb72f429c541cea973efdceb`

Target branch:
`ticket/BRN-0001-repair-retrieved-answer-reliability`

## Files Changed

- `src/brain.mjs` — replaces the provider-neutral base answer instruction
  with an equally sized evidence-use contract. It permits reuse of prior
  Palari speech only as Palari advice/recommendation/commitment, requires use
  or an exact limitation for directly answering consulted evidence, and
  preserves irrelevant-result and honest-absence semantics.
- `src/retrieval-answer.mjs` — adds the retrieval-loop operational version of
  the same rules after every tool result.
- `tests/brain.contract.test.mjs` — locks the base instruction semantics and
  its unchanged 840-character compatibility envelope.
- `tests/retrieval-answer.contract.test.mjs` — adds provider-free adversarial
  coverage for prior Palari advice, unrelated musical-instrument chronology,
  non-empty irrelevant noise, and empty retrieval. It verifies exact
  instruction delivery and canonical text/speaker/time/identity fields.
- `docs/BRAIN-API.md` — documents the strengthened provider contract and its
  explicit non-claim about offline provider compliance.
- `coding-sessions/tickets/open/BRN-0001-A-*.md` — records claim and lifecycle
  metadata only.

## Verification

- `node --test tests/brain.contract.test.mjs tests/retrieval-answer.contract.test.mjs`:
  PASS — 30/30.
- `node --test tests/brain.contract.test.mjs tests/retrieval-answer.contract.test.mjs tests/incremental-memory-live-smoke.contract.test.mjs`:
  PASS — 46 pass, 0 fail, 1 historical/private-evidence skip. This includes
  the 10,840-byte maximum answer-body compatibility canary.
- `npm test`: PASS — 641 pass, 0 fail, 15 skipped, 656 total.
- `npm run quickstart`: PASS — all six journey stages.
- `git diff --check`: PASS.
- `npm run ticket -- scope-check BRN-0001-A`: PASS before commit — six paths.
- `npm run ticket -- scope-check --committed-plus-dirty --target ticket/BRN-0001-repair-retrieved-answer-reliability BRN-0001-A`:
  PASS after implementation commit — six paths.
- Documentation check: PASS — the new API section adds no external links and
  matches the exported callback fields and result fields in source.

## Risks / Follow-Ups

- This changes a provider instruction, not a host-side semantic validator.
  Offline callbacks prove exact contract delivery and evidence shape; they do
  not prove that Gemini or another model will obey it.
- The base instruction remains exactly 840 characters, so the historical
  request-size envelope and prompt-cost floor do not grow. Retrieval-specific
  instructions are intentionally more explicit.
- The fixtures use travel advice, musical instruments, unrelated running
  noise, and an absent observatory. They contain no private benchmark question
  or expected-answer text.
- BRN-0001-B remains required for deterministic question-relative time. Do
  not start it until this child receives fresh review and is accepted and
  integrated into the parent.
- Any live validation remains a separate founder-gated R3 ticket.

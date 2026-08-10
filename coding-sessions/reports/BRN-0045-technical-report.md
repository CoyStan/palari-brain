# BRN-0045 Technical Report

## Files Changed

- `src/openai.mjs` — add a deterministic rolling request pacer, conservative
  request-unit estimation, optional pre-dispatch pacing, and safe HTTP 429
  metadata.
- `tests/openai.contract.test.mjs` — prove shared pacing, deterministic units,
  oversized-request progress, unchanged request wires, one-shot dispatch, and
  allowlisted 429 diagnostics.
- `docs/BRAIN-API.md` — document explicit configuration, process-local scope,
  unit estimation, one-shot behavior, and terminal 429 handling.
- `STATUS.md` — record scope, behavior, and provider-free verification.
- `coding-sessions/tickets/open/BRN-0045-*.md` — record the contract, claim,
  and specialist closeout.
- `coding-sessions/human-report/BRN-0045-human-report.md` — give the founder a
  plain-language closeout and review state.

## Verification

- `node --test tests/openai.contract.test.mjs`: PASS, 45/45.
- `npm test`: PASS, 90/90.
- `npm run quickstart`: PASS, 6/6.
- `node --test tests/canonical-evidence-smoke-runner.contract.test.mjs`: PASS,
  8 passed and 1 optional skip across 9.
- `npm run test:legacy`: PASS, 945 passed, 15 optional skips, 0 failed across
  960 tests.
- Ticket lint, scope, report, and diff gates: PASS.
- Fresh independent rereview of exact commit `242b05c`: ACCEPT with no
  unresolved P0-P3 findings. The rereviewer also ran deterministic concurrent
  admission and bounded terminal 429 redaction checks.

## Risks / Follow-Ups

- The caller must configure `maxUnits` from its own provider tier. Palari does
  not guess a limit.
- One pacer coordinates only callers that share the same instance. It is not a
  distributed quota service.
- Request units are deliberately conservative: UTF-8 serialized bytes plus
  the declared output ceiling. They are safe scheduling units, not provider
  billing tokens.
- HTTP 429 is still terminal. A caller can use the safe metadata for an
  explicit later decision, but this transport does not retry.
- The first broad run exposed an unnecessary export from the main package
  entry, which changed frozen historical import graphs. That export was
  removed. The API remains available from `palari-brain/openai`, and the
  affected focused contract plus the full legacy tier pass.

# BRN-0022 Technical Report

## Outcome

The offline freeze is ready for independent pre-dispatch review. A tracked
dependency-free runner freezes one structured Sol input-count body, imports the
strict BRN-0021 parser, durably reserves the whole `$0.05` cap, permits one
transport call, and seals success or failure without retry. A mode-0600 private
launcher remains outside git. No live call has run.

## Files Changed

- `.gitignore`: excludes the one-shot private count-result namespace.
- `evals/openai-input-count-probe.mjs`: frozen wire, exact authority/cap/head
  checks, one-call runner, private result store, credential scan, and CLI.
- `tests/openai-input-count-probe.contract.test.mjs`: offline one-shot,
  authority, ordering, malformed response, failure, private-mode, leak, and CLI
  contracts.
- `evals/predictions.md`: FINAL P-set 32 before any dispatch.
- `docs/EVALUATION-HARNESS.md` and `docs/DECISIONS.md`: official-wire,
  no-generation, unknown-billing, and no-retry boundaries.
- `STATUS.md`, ticket, technical report, and human report: freeze evidence.
- Private launcher (untracked):
  `/home/quetza/palari-brain-private/openai-input-count-wire-probe.mjs`, mode
  0600, SHA-256
  `98c5a9e57804f5ea4ccd5e9c6dcb91de716d69a355a9fe6acb4c49658d933689`.

## Verification

- `node --check` on tracked runner, contract, and private launcher: PASS.
- Focused contracts: PASS, 19/19.
- Private launcher `--verify`: PASS; identity namespace absent; request hash
  `805097ec9d165fb5206ea3ef5429ffd27b985572dea3362d3b635b7550669561`.
- Full `npm test`: PASS, 758 passed / 15 skipped / 0 failed across 773.
- `npm run quickstart`: PASS, 6/6. Syntax, diff, ticket, report, and governed
  committed-plus-dirty scope checks: PASS.
- Live activity: zero credential reads, network/provider/generation calls,
  private benchmark reads, and spend. Ledger stays `$7.75502179`.

## Invariants

- Exact authority, identity, decimal caps, clean reviewed head, pushed head, and
  absent namespace are checked before result creation or credential access.
- The `$0.05` reservation is written and synced before credential access and
  transport. It is never settled downward because the count response has no
  billing metadata.
- The transport closure increments the physical invocation counter before its
  only await; all failures are terminal and there is no retry or byte fallback.
- The terminal artifacts contain no key input and are scanned for exact key
  bytes before the manifest is sealed.
- Historical BRN-0017 remains 6/10. No sealed/private benchmark artifact is
  part of this probe.

## Risks / Follow-Ups

- Live Sol count-wire compatibility is not yet established; that is the one
  founder-gated action this freeze prepares.
- Official documentation does not say whether this count request is billed.
  The entire `$0.05` therefore remains uncertain/accounted after dispatch.
- Independent review must attack the preflight ordering, filesystem boundary,
  one-call guarantee, response parser seam, and credential scan before the
  exact founder gate can open.

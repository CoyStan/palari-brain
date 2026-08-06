# BRN-0022 Technical Report

## Outcome

The founder-authorized one-shot passed. OpenAI accepted the structured Sol
input-count body and returned HTTP 200 with 77 exact input tokens. One physical
request completed in 1,277 ms; no generation request or retry occurred. The
private identity is terminal and consumed.

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
- Initial focused contracts: PASS, 19/19. After the two review repairs: PASS,
  21/21 then 22/22.
- Private launcher pre-dispatch `--verify`: PASS; identity namespace was absent;
  request hash
  `805097ec9d165fb5206ea3ef5429ffd27b985572dea3362d3b635b7550669561`.
- Post-dispatch provider-free verification: PASS; the terminal identity
  namespace exists and is consumed.
- Final full `npm test`: PASS, 761 passed / 15 skipped / 0 failed across 776.
- `npm run quickstart`: PASS, 6/6. Syntax, diff, ticket, report, and governed
  committed-plus-dirty scope checks: PASS.
- Before exact founder authority, live activity and spend were zero and the
  ledger stayed `$7.75502179`. The terminal invocation then made one count
  request, zero generation calls, and retained `$0.05` uncertain/accounted,
  bringing cumulative accounted to `$7.80502179`.

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

- Live Sol count-wire compatibility is established for this frozen structured
  body. This does not establish generation quality or authorize benchmark
  integration.
- Official documentation does not say whether this count request is billed.
  The entire `$0.05` therefore remains uncertain/accounted after dispatch.
- The consumed terminal bundle requires independent reconciliation before the
  ticket can be accepted and merged. It must never be rerun or mutated.

## Review Repair

Independent review of exact pushed head `a51d10c` reopened a P1 physical and
durability gap plus a P3 diff issue. A symlinked result root redirected all
artifacts outside the repository, and the new root entry could be lost because
`repoRoot` was never synced. The workflow also committed trailing spaces in
two cleared claim fields.

The result store now rejects symlink/non-directory/physically escaped roots,
opens the root and identity as owned directory descriptors, writes and reads
artifacts through `/proc/self/fd`, and syncs the repository directory after
first root creation before completing the reservation. Both physical
directories remain held through terminal seal. Two permanent regressions cover
the exact symlink escape and fresh private-directory path. Repaired focused
contracts pass 21/21; full suite passes 760 / 15 skipped / 0 failed across 775;
quickstart passes 6/6; provider-free verify, ticket/report, scope, syntax, and
the working diff pass. Fresh cumulative review is required after push.

Fresh cumulative rereview of pushed head `69fec72` confirmed those repairs,
then reproduced one further P1: a caller-supplied `../outside-result` passed the
normalized string comparison and wrote the complete bundle outside `repoRoot`.
The result-root parameter is now an exact frozen value rather than a path
configuration surface. Parent, sibling, absolute, and normalized traversal
variants all fail during store construction. The permanent regression passes;
focused contracts are 22/22 and the full suite passes 761 / 15 skipped / 0
failed across 776. Quickstart 6/6, provider-free verify, ticket/report, scope,
syntax, and diff checks pass. Fresh rereview was required and is recorded below.

Third fresh cumulative review of exact pushed head `457bfbe` replayed all
retained defects and found no P0-P3 issue. It confirmed the frozen root,
descriptor custody, parent sync, authority/head/cap ordering, one-call/no-retry
wire, credential scan, accounting, scope/history, launcher hash/mode, and absent
namespace. The reviewer recommends founder-gated dispatch; no live authority
or execution is implied.

## Terminal Measurement

- HTTP status: 200.
- Exact provider count: 77 input tokens.
- Physical count requests: 1.
- Latency: 1,277 ms.
- Generation/model-answer calls: 0.
- Fresh accounting: `$0.05` uncertain/accounted; billing is not asserted.
- Cumulative accounted: `$7.80502179`.
- Response SHA-256:
  `8d999eb37b6b75ebb556220f59570687feeaac7f44b18d8f6ccda7935967e187`.
- External manifest SHA-256:
  `9607c0c97862c5c54593d07d599d79b61d4eae0a8223f014c6f09d1271936d69`.
- Three artifacts are mode 0600; manifest reports zero credential matches.
- Historical BRN-0017 remains 6/10.

## Terminal Review

Independent terminal review of exact pushed head `50e606f` rehashed and
reconciled the request, response, launcher, reservation, terminal, manifest,
invocation count, latency, permissions, credential scan, and ledger. All
technical evidence passed. It reopened one P2 documentation defect: stale
pre-dispatch sentences elsewhere in the terminal reports still described the
namespace as absent and the call as future. This cumulative repair makes every
such statement explicitly historical and leaves the sealed result untouched.

# BRN-0022 Reviewer Note

Reviewer: independent fresh-context agent
Reviewed commit(s): `a51d10c`
Target branch: `main` at `fe8eb92`

## Review Result

Fail; reopen before any founder dispatch gate.

## Findings

- P1 — `evals/openai-input-count-probe.mjs` accepted a symlinked
  `.palari-input-count` root. The string-only containment check and subsequent
  `mkdir`/`chmod`/`open` operations followed that link, allowing reservation,
  terminal, and manifest artifacts to be sealed outside the repository. A
  provider-free reproduction succeeded. Also, when the result root was new,
  `beginReservation` synced the identity and result-root directories but not
  `repoRoot`, so the new root directory entry was not crash-durable before a
  potentially billed dispatch.
- P3 — `git diff --check origin/main...HEAD` failed on trailing whitespace in
  the transition-cleared `claimed_by` and `claimed_at` ticket fields,
  contradicting acceptance criterion 8 and the technical report.

## Verification Reviewed

- Exact head/upstream `a51d10c`: PASS.
- Private launcher mode 0600 and SHA-256 `98c5a9e...`: PASS.
- Provider-free launcher `--verify`: PASS; namespace absent.
- Focused contracts: PASS, 19/19. Quickstart: PASS, 6/6.
- Governed scope: PASS. No credential/provider/live activity occurred.

## Required Changes

- Bind all result writes to a physical in-repository directory, reject a
  symlink/non-directory result root before creation or credential access, and
  add the provider-free symlink escape as a permanent regression.
- Sync `repoRoot` immediately after creating the result root, before returning
  from durable reservation and before credential access/transport.
- Remove the ticket whitespace and rerun diff checks.

## Recommendation

Recommend `reopen`, cumulative repair, and fresh independent rereview. Do not
request founder authorization or dispatch the live probe yet.

## Fresh Cumulative Rereview

Reviewer: second independent fresh-context agent
Reviewed commit: `69fec72`

Result: **REOPEN** for one new P1. The reviewer confirmed the original symlink
escape, missing `repoRoot` sync, and ticket whitespace were repaired. It then
reproduced an outside-repository write by constructing the exported store with
`resultRoot: '../outside-result'`; using `..` could also chmod and reuse the
repository parent. The required repair is to accept only the frozen private
directory segment and retain a traversal regression. Focused 21/21, full
760/775 with 15 skips, quickstart 6/6, ticket/scope/diff/head/upstream, launcher
hash/mode, and absent-namespace checks passed. No credential or provider access
occurred. Another fresh cumulative rereview is required after repair.

## Third Fresh Cumulative Rereview

Reviewer: third independent fresh-context agent
Reviewed commit: `457bfbe`
Target: `main` at `fe8eb92`

Result: **PASS; no P0-P3 findings.** The reviewer replayed the symlink escape,
missing parent sync, ticket whitespace, and caller-supplied traversal. All are
repaired. It cumulatively verified exact authority/caps/head/upstream ordering,
descriptor-bound durable reservation and seal, one physical count request,
no retry/fallback/generation, strict HTTP/response parsing, credential scan,
uncertain full-cap accounting, historical invariants, and scope.

Focused 22/22 and quickstart 6/6 passed; recorded full suite is 761 passed / 15
skipped / 0 failed across 776. Ticket, scope, syntax, diff, clean head/upstream,
launcher mode 0600 and SHA-256 `98c5a9e...3389689`, and absent namespace all
passed. No credential, network, provider, generation, private benchmark, or U8
access occurred.

Recommendation: accept the freeze for exact founder-gated dispatch. This does
not accept, merge, authorize, or run the live probe.

## Independent Terminal Review

Reviewer: fourth independent fresh-context agent
Reviewed commit: `50e606f`

Result: **REOPEN** for one P2 documentation-consistency defect; no P0, P1, or
P3 finding. The private technical evidence passed: request, response, launcher,
reservation, terminal, and manifest hashes reconcile; all private modes are
0600; `credentialMatches` is 0; the result is HTTP 200, 77 tokens, one
invocation, and 1,277 ms; the identity is consumed; and `$7.75502179 + $0.05 =
$7.80502179`. Focused 22/22, full 761 passed / 15 skipped / 0 failed,
quickstart 6/6, and ticket/scope/syntax/diff/head/upstream checks passed.

The terminal reports nevertheless retained stale pre-run statements that the
namespace was absent, no call had occurred, compatibility was not established,
and no live improvement was claimed. Repair those statements cumulatively,
without credential access, provider activity, rerun, or private-bundle
mutation, then obtain a fresh narrow rereview.

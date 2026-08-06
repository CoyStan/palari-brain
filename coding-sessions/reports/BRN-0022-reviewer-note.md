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

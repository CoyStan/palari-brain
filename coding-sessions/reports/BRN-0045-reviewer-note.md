# BRN-0045 Reviewer Note

Reviewer: fresh independent Codex reviewer `/root/brn_0045_reviewer`
Reviewed commit(s): `3978807b` through
`bc0a02235d70f682a904b1cf395a2bd29940f044`
Target branch: `main` at `89770188d1d89f8696192c91a0e30ab6c9021f0d`

## Review Result

FAIL. The pacing, request-wire, terminal 429, redaction, scope, and test
behavior pass, but the exact required diff gate fails. One P3 finding remains.

## Findings

- P3 — `git diff --check main...HEAD` fails on trailing whitespace in the
  committed ticket metadata at
  `coding-sessions/tickets/open/BRN-0045-add-shared-openai-pacing-and-safe-429-diagnostics.md:13-14`.
  This directly fails acceptance criterion 5 and the ticket's exact
  verification command. The product implementation is not implicated, but
  the reviewed committed candidate does not pass all required gates.

No additional finding was identified in the rolling-window admission math,
shared-instance concurrency, oversized-request progress rule, conservative
request-unit calculation, stats, optional pre-fetch pacing, one-shot dispatch,
unchanged request body, bounded allowlisted 429 metadata, response-body
non-read, credential redaction, documentation limits, declared R2 risk, or
allowed and forbidden path enforcement.

## Verification Reviewed

- Exact head and target: verified at
  `bc0a02235d70f682a904b1cf395a2bd29940f044` against `main` at
  `89770188d1d89f8696192c91a0e30ab6c9021f0d`; seven committed paths are
  allowed, with no rename or forbidden path and a clean worktree before this
  reviewer note.
- `node --test tests/openai.contract.test.mjs`: PASS, 45/45.
- `npm test`: PASS, 90/90.
- `npm run quickstart`: PASS, 6/6.
- `npm run test:legacy`: PASS, 945 passed / 15 optional skips / 0 failed
  across 960 tests.
- `npm run ticket -- ticket-lint BRN-0045`: PASS.
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0045`:
  PASS for all seven ticket paths before this allowed reviewer note.
- `git diff --check main...HEAD`: FAIL on the two ticket metadata lines named
  in the finding.
- Independent provider-free concurrency check: PASS for ten simultaneous
  one-unit admissions under a three-unit, 40 ms rolling ceiling. No observed
  rolling interval exceeded three admissions.
- Independent provider-free 429 check: PASS. A 700-character allowlisted
  request ID was bounded to 512 characters, the error remained terminal, and
  the mock response body read count stayed zero.
- No provider, credential, environment file, private artifact, dataset,
  evaluation result, sealed U8 item, production service, or paid operation was
  accessed.

## Required Changes

- Remove the trailing whitespace from `claimed_by` and `claimed_at` in the
  ticket frontmatter.
- Rerun `git diff --check main...HEAD` and the ticket check, then submit the
  new exact committed head for a fresh review.

## Recommendation

Recommend `reopen` at exact head
`bc0a02235d70f682a904b1cf395a2bd29940f044`. This recommendation does not
accept, merge, commit, or push the ticket.

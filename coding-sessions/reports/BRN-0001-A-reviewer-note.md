# BRN-0001-A Reviewer Note

Reviewer: independent fresh-context reviewer
Reviewed commit(s): `a8ce9bc1124876b3bb72f429c541cea973efdceb`, `6c17c2dd16875152d587d92ef54560e9dcf167af`
Target branch: `ticket/BRN-0001-repair-retrieved-answer-reliability`

## Review Result

Fail pending one bounded test-contract repair.

## Findings

- P1 — The declared correction-chronology coverage is missing. The test named
  `evidence-use instructions cover relevant, irrelevant, corrected, and empty
  retrieval` (`tests/retrieval-answer.contract.test.mjs:315-419`) seeds an
  initial instrument and a later additional instrument, then asks which came
  first. That is chronology, not a same-speaker correction or supersession.
  The provider callback never receives or asserts an old value that is later
  corrected, nor does it assert the current corrected value. The existing
  `tests/brain.contract.test.mjs:647-706` check covers briefing ordering and
  instruction text, not a corrected `answerWithRetrieval` outcome. This leaves
  the ticket's Scope requirement for “correction chronology” and acceptance
  criterion 3's “corrected ... retrieval outcomes” unproven.

## Verification Reviewed

- `node --test tests/brain.contract.test.mjs tests/retrieval-answer.contract.test.mjs` — 30 pass, 0 fail.
- `npm test` — 641 pass, 0 fail, 15 skipped.
- `npm run quickstart` — all six stages pass.
- `npm run ticket -- ticket-lint BRN-0001-A` — pass.
- `npm run ticket -- scope-check BRN-0001-A` — pass on the clean worktree.
- `npm run ticket -- scope-check --committed-plus-dirty --target ticket/BRN-0001-repair-retrieved-answer-reliability BRN-0001-A` — pass for all nine committed paths.
- `git diff --check ticket/BRN-0001-repair-retrieved-answer-reliability...HEAD` — pass.
- No provider, network, credentials, private benchmark data, eval mutation, or live evaluation was used.

The implementation stays within the declared paths. The evidence-use rules
preserve irrelevant and empty-result abstention, label Palari speech, and keep
the base instruction at 840 characters. The fixture domains are unrelated to
the seen benchmark questions, so no overfit finding was raised.

## Required Changes

- Add one provider-free, unrelated-domain `answerWithRetrieval` fixture with a
  same-speaker earlier statement and a later explicit correction. Assert both
  canonical rows retain their evidence IDs, speakers, and observed times, and
  assert that the callback can select/report the later correction. Keep the
  test structural: do not add a lexical answer grader, benchmark text, or
  provider call. Rerun the focused suite, full suite, quickstart, and scope
  checks.

## Recommendation

Recommend `reopen`. This is a narrow test-only gap inside the existing ticket
scope; no CEO-level blocker or implementation redesign is required.

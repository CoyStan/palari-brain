# BRN-0036 Reviewer Note

Reviewer: fresh independent Codex reviewer
Reviewed commit(s): `cb2207515beafd87d140e207f0232fd3e90b1ec0`
Target branch: `main` at `aab85819da85b95cf5f10cbf6e05720fc55d1f87`

## Review Result

FAIL with one P3 finding at committed head `cb22075`. No P0-P2 product,
security, isolation, or regression issue was found.

## Findings

- P3 — `git diff --check main...cb22075` fails because
  `coding-sessions/tickets/open/BRN-0036-separate-confirmation-page-completeness-from-ranked-tail.md:13`
  and `:14` contain trailing spaces after `claimed_by:` and `claimed_at:`.
  This directly fails the ticket's required verification and contradicts the
  Specialist Closeout statement that the diff checks are clean.

The product change itself satisfies acceptance criteria 1-5. Confirmation v7
uses character truncation, not an ordinary ranked tail, to decide whether the
host-owned candidate page was incompletely delivered. Every displayed
candidate still requires an ordered host-bound assessment. An all-`not_used`
complete page closes despite lower-ranked candidates, while an incomplete page
continues through unseen information only. Material candidates keep closure
open, require another search, remain required in the final commitment, and
fail closed if the bounded confirmation work ends unresolved.

Compact excerpts remain exact canonical substrings; complete source messages
stay host-side for quote validation; direct user rows precede derivative
Palari rows; prior, ignored, and provenance-aware duplicate information is
excluded; and confirmation performs no durable write. No missing focused test
or security regression was found. The six changed paths are all allowed, no
forbidden path is changed, the specialist left the ticket `in-review`, and R2
accurately describes this cross-file product behavior change.

## Verification Reviewed

- `node --test tests/answer-confirmation.contract.test.mjs`: PASS, 9/9.
- `npm test`: PASS, 85/85.
- `npm run quickstart`: PASS, 6/6.
- `npm run test:legacy`: PASS, 916 passed / 15 optional skips / 0 failed
  across 931 tests.
- `npm run ticket -- ticket-lint BRN-0036`: PASS.
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0036`:
  PASS for the six committed allowed paths and this allowed reviewer note; the
  forbidden-path diff is empty.
- `npm run ticket -- check BRN-0036`: PASS after this note was recorded.
- `git diff --check main...cb22075`: FAIL on the two ticket lines identified
  above.
- Committed diff, technical report, human report, relevant implementation, and
  focused contracts were independently inspected. No provider, credential,
  dataset, private artifact, sealed U8 question, or live diagnostic was used.

## Required Changes

- Remove the trailing spaces after `claimed_by:` and `claimed_at:` in the open
  ticket, commit that bounded correction, and rerun
  `git diff --check main...HEAD` plus the governed ticket checks before fresh
  re-review.

## Recommendation

Recommend `reopen`. The substantive implementation is ready, but the current
committed head does not meet its explicit clean-diff acceptance gate. This
recommendation does not accept, merge, commit, or push the ticket.

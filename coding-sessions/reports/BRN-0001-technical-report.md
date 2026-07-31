# BRN-0001 Technical Report

Integrated parent commit: `b9db978247794852a2be64647db77d47bd092ef2`.

## Files Changed

- Child A answer instructions/tests and API documentation.
- Child B host-computed UTC relative-time metadata, tests, and API
  documentation.
- Child C provider-free composition runner, contract test, npm command, and
  eval documentation.
- Child lifecycle records, technical reports, human reports, and independent
  reviewer notes for A, B, and C.
- `STATUS.md` records the integrated product stop rule and claim boundary.

## Verification

- `npm test`: PASS — 644 pass, 0 fail, 15 skipped, 659 total.
- `node --test tests/brain.contract.test.mjs tests/retrieval-answer.contract.test.mjs tests/reached-prefix-retrieval-regression.contract.test.mjs tests/answer-interpretation-regression.contract.test.mjs`: PASS — focused contracts green.
- `npm run answer-interpretation-regression`: PASS — 5/5 structural cases;
  answer quality ungraded and provider/network 0/0.
- `npm run quickstart`: PASS — all six journey stages.
- `npm run ticket -- ticket-lint-all`: PASS.
- `npm run ticket -- report-lint BRN-0001`: PASS after parent reports and
  parent reviewer note are present.
- `git diff --check`: PASS.
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0001`:
  required before final parent review; all integrated paths must remain within
  the parent contract.
- `npm run reached-prefix-regression`: NOT RUN because the required gitignored
  `data/longmemeval_s_cleaned.json` is absent. The charter forbids an
  unverified download; the child import-inert contracts pass and no 6/6 rerun
  is claimed.

## Risks / Follow-Ups

- A and B are provider-neutral contract/metadata changes; C is structural and
  does not grade generated prose. Live provider compliance remains unproven.
- No private benchmark bytes, credential, network call, live identity, score,
  result, publication, or spend changed.
- Any future live proof requires a separate R3 ticket, pre-registration, exact
  cap, fresh identity, and founder authorization. The sealed terminal v5 3/6
  result remains immutable.

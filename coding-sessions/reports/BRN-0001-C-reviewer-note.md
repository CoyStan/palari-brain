# BRN-0001-C Reviewer Note

Reviewer: independent fresh-context reviewer
Reviewed commit(s): `8e285b2`, `1d3d2ad`, `e0ec283`, `044979c`
Target branch: `ticket/BRN-0001-repair-retrieved-answer-reliability` at
`fa32ba8`

## Review Result

Pass. The provider-free composition regression is within the declared scope,
uses generic synthetic fixtures, and exercises the real `answerWithRetrieval`
boundary after the A and B repairs. I recommend `accept`; this is a
recommendation only and does not accept, merge, close, or integrate the
ticket.

## Findings

- P0: none.
- P1: none.
- P2: none.
- P3: none.

The three required failure classes are covered by generic data: a Palari
recommendation remains a Palari row and the answer instructions permit advice
without recasting it as a user fact; earlier and later user-owned appliance
messages are both returned with canonical text, user speaker labels, evidence
IDs, and chronological `observedAt`; and the November-to-February fixture
returns host-derived `past`, 92 whole days, and three whole calendar months.
The irrelevant and empty controls retain their respective non-relevance and
honest-absence instructions. The callback returns a fixed structural sentinel
and does not grade prose.

The runner writes a temporary mode-600 report by default with
`answerQualityGraded: false`, `providerCalls: 0`, and `networkCalls: 0`.
`answerBoundaryCallbacks: 5` makes clear that five deterministic in-process
callbacks execute; the zero counts refer to external provider/network
dispatch. The source and import-inert checks find no credential reads,
transport, private dataset bytes, expected answers, transcript bodies, or
terminal result coupling in the runner or fixtures. The two benchmark IDs in
the contract test are negative source-scan needles only, not fixture data.

## Verification Reviewed

- `node --test tests/answer-interpretation-regression.contract.test.mjs
  tests/reached-prefix-retrieval-regression.contract.test.mjs` — PASS, 4/4.
- `npm run answer-interpretation-regression` — PASS, 5/5; output reports
  `answerQualityGraded: false` and provider/network `0/0`.
- `npm test` — PASS, 644 pass, 0 fail, 15 skipped, 659 total.
- `npm run quickstart` — PASS, all six journey stages.
- `git diff --check fa32ba8...HEAD` — PASS.
- `npm run ticket -- ticket-lint-all` — PASS.
- `npm run ticket -- report-lint BRN-0001-C` — PASS after this reviewer note
  was added.
- `npm run ticket -- scope-check --committed-plus-dirty --target
  ticket/BRN-0001-repair-retrieved-answer-reliability BRN-0001-C` — PASS,
  eight committed-plus-dirty paths, all allowed, before this note was added;
  the same check is PASS with nine paths after adding this allowed reviewer
  note.
- `npm run reached-prefix-regression` — attempted and stopped before any
  retrieval/provider work with `ENOENT` because the gitignored
  `data/longmemeval_s_cleaned.json` is absent. I did not download or fabricate
  it. The two import-inert reached-prefix contract tests pass, and the
  specialist reports this limitation honestly; no 6/6 rerun claim is made.
- The worktree was clean before this note; no implementation, test,
  documentation, `STATUS.md`, or ticket-metadata path was edited during the
  review. No provider, network, credential, dataset, benchmark/live run,
  result, score, publication, or spend was used.

## Required Changes

None to implementation, tests, package, documentation, or scope.

## Recommendation

Recommend `accept`. Acceptance, merge, closure, and parent integration remain
human-controlled and outside this reviewer note.

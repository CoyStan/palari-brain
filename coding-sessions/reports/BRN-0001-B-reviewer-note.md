# BRN-0001-B Reviewer Note

Reviewer: independent fresh-context reviewer
Reviewed commit(s): `7e07559`, `93b5e89`
Target branch: `ticket/BRN-0001-repair-retrieved-answer-reliability`

## Review Result

Pass. The committed B branch supplies the requested host-computed relative-time
boundary without changing canonical storage, graph extraction, retrieval
ranking, provider transport, or the sealed evaluation surface.

## Findings

none.

The pure derivation parses the host evidence timestamp and the validated
question reference, compares instants in UTC, reports past/same/future, and
computes signed elapsed days plus signed whole calendar months. The exact
2023-11-01-to-2024-02-01 measured pair returns three calendar months. The
table-driven contract covers partial months, a year crossing, leap-day
adjustment, equal instants, future evidence, negative values, and invalid
dates. Calendar-month arithmetic is component-based and does not use a
30-day approximation.

`memory_find`, `memory_read`, `memory_search`, and admitted `memory_graph`
edges all use the same decoration path. Each result row/edge is copied before
the host block is attached, the block is frozen, and the focused test observes
that the underlying canonical find/read rows remain undecorated. Graph
`observedAt` is the already host-stamped edge time; graph extraction is not
invoked by answering. Missing or invalid question/evidence times leave the
existing row shape without a fabricated reference. Canonical text, speaker,
evidence identity, session, and observed time remain host values, while the
new instruction directs the answer provider to use the host arithmetic for
elapsed-time answers and the canonical text for facts.

The change is compatible with the prior answer contract: the question-date
reference remains optional, graph trend anchoring retains its prior behavior,
and no dependency or stored-schema path changed. The committed delta contains
only the declared B implementation, focused test, API/STATUS/report metadata,
and lifecycle artifacts. Every changed path is allowed; no forbidden path,
provider, credential, dataset, benchmark/live run, result, score, publication,
or spend was involved.

## Verification Reviewed

- `node --test tests/retrieval-answer.contract.test.mjs` — 9 pass, 0 fail.
- `npm test` — 642 pass, 0 fail, 15 skipped.
- `npm run quickstart` — all six stages pass.
- `npm run ticket -- ticket-lint-all` — pass.
- `git diff --check ticket/BRN-0001-repair-retrieved-answer-reliability...HEAD` — pass.
- `npm run ticket -- scope-check --committed-plus-dirty --target ticket/BRN-0001-repair-retrieved-answer-reliability BRN-0001-B` — pass for 7 committed-plus-dirty paths.
- Worktree was clean before this reviewer note; no implementation, test, documentation, STATUS, or ticket metadata path was edited during review.
- No provider, network, credential, private benchmark data, eval mutation, score, publication, or spend was used.

## Required Changes

none.

## Recommendation

Recommend `accept`. This is a recommendation only; acceptance, merge, and
closure remain outside this reviewer note and require the authorized human
workflow. After acceptance and integration into the BRN-0001 parent branch,
BRN-0001-C may proceed.

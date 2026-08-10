# BRN-0044 Reviewer Note

Reviewer: fresh independent Codex reviewer `/root/brn_0044_reviewer`
Reviewed commit(s): `069bedb00324b13554fb3945de913cbdc49d9b98`
Target branch: `main` at `e6127064485fab07a6245cb5404bbad8bd6eca52`

## Review Result

FAIL. The exact physical dispatch bound, no-evidence text closure, pending-page
review, host commitment binding, and no-post-cap-retrieval behavior pass, but a
closure response can hide a forbidden tool call beside an answer commitment
and then succeed through the commitment-repair path.

## Findings

- P1 — A forbidden closure tool call is repairable when it shares a response
  with an answer commitment, contrary to acceptance criterion 4 and the
  documented terminal behavior. The closure request correctly offers only its
  state-specific tools (`src/openai.mjs:1083-1123`), but returned calls are
  parsed against the full normal-session `allowedNames` set
  (`src/openai.mjs:1032-1033`, `src/openai.mjs:1133-1148`). When a response
  contains both `palari_answer_commit` and a normal memory tool, the commitment
  branch classifies the mixed response as a repairable invalid commitment
  (`src/openai.mjs:1176-1190`, `src/openai.mjs:1240-1249`) before the terminal
  closure-tool guard at `src/openai.mjs:1251-1268` can run. An unknown function
  mixed with a commitment takes the same repair path through the catch at
  `src/openai.mjs:1136-1148`. Independent provider-free reproducers used
  `maxModelDispatches: 1`: normal call 1 returned evidence; closure call 1
  returned a valid commitment plus either `memory_search` or
  `not_a_real_tool`; closure call 2 returned a valid commitment. Both cases
  returned the answer after 3 physical calls, with no post-cap retrieval
  execution. The absence of retrieval execution preserves the data boundary,
  but the forbidden call is not terminal as required by the ticket
  (`coding-sessions/tickets/open/BRN-0044-finalize-answers-when-model-dispatch-budget-ends.md:117-119`)
  and as claimed by the API and human reports (`docs/BRAIN-API.md:632-635`,
  `coding-sessions/human-report/BRN-0044-human-report.md:19-23`). The new tests
  cover a standalone forbidden tool only indirectly; they do not cover a
  forbidden tool mixed with a commitment.

No additional finding was identified in the `maxModelDispatches + 2` physical
ceiling, closure counter, no-evidence tool disabling, confirmation pending-page
review, second-call commit-only shape, single invalid-commitment repair,
evidence-number translation, host commitment callbacks, refusal/empty-output
handling, retrieval-call accounting, configured maxima, allowed path scope, or
documentation outside the finding above.

## Verification Reviewed

- Exact head/target and committed diff: verified at
  `069bedb00324b13554fb3945de913cbdc49d9b98` against `main` at
  `e6127064485fab07a6245cb5404bbad8bd6eca52`; 7 committed paths, all allowed,
  no rename, and clean before this reviewer note.
- `node --test tests/openai.contract.test.mjs`: PASS, 39/39.
- `npm test`: PASS, 90/90.
- `npm run quickstart`: PASS, 6/6.
- `npm run test:legacy`: PASS, 939 passed / 15 optional skips / 0 failed
  across 954 tests.
- `npm run ticket -- ticket-lint BRN-0044`: PASS.
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0044`:
  PASS before this allowed reviewer note (7 paths).
- `git diff --check main...HEAD` and pre-note dirty `git diff --check`: PASS.
- Provider-free dispatch matrix: PASS for configured normal limits 1, 2, 3,
  7, and 11 with no-evidence closure ending at `limit + 1`; evidence-backed
  adversarial paths at limits 1, 4, and 11 ended at or below `limit + 2`.
- Provider-free forbidden-tool checks: PASS for proving no post-cap search was
  executed and the standalone forbidden first-closure call was terminal;
  FAIL for terminality when `memory_search` or an unknown function was mixed
  with a commitment, because both were accepted after one repair.
- No provider, credential, environment file, private alpha artifact, dataset,
  sealed U8 item, production service, or paid operation was accessed.

## Required Changes

- Validate each closure response against the exact tools offered for that
  dispatch before entering commitment repair. Any non-offered retrieval,
  planning, review, or unknown function call during closure must remain a
  terminal typed error even when the response also contains a commitment.
- Add provider-free contracts for a commitment mixed with (1) a declared but
  non-offered memory tool and (2) an unknown function. Prove terminal failure,
  zero post-cap retrieval, and the unchanged physical bound while retaining
  the existing one-repair behavior for a commitment-only validation failure.
- Align the API, human report, technical evidence, and ticket closeout after
  the terminal mixed-call contracts pass.

## Recommendation

Recommend `reopen` at exact head
`069bedb00324b13554fb3945de913cbdc49d9b98`. This recommendation does not
accept, merge, commit, or push the ticket.

# BRN-0043 Rereviewer Note

Reviewer: fresh independent Codex reviewer `/root/brn_0043_rereviewer`
Reviewed commit(s): `0f72abd4946ce5bf3886fb1dc98450fbbc8f3281` through
`fd5935ec9776afb1d4d90859616886777a4873e2`
Target branch: `main` at `04b25ce547c59a9d25d13160f805680e738b5c9c`

## Review Result

PASS WITH NOTES. The complete committed diff satisfies the bounded R2 ticket,
and the P1 plus two P2 findings at the prior reviewed head are resolved. The
remaining native frozen-bank parity and RSS profile executions are accurately
recorded as unrun follow-up gates, not as evidence produced by this ticket.

## Findings

- P0: none.
- P1: none.
- P2: none.
- P3: none.

## Prior Finding Resolution

- Partial and invalid component loads are now transactional. The shared loader
  turns synchronous factory throws into settled rejections, waits for every
  factory, disposes every fulfilled direct component exactly once, also rolls
  back components after synchronous or asynchronous assembly validation, and
  preserves both causes under `RERANKER_LOAD_ROLLBACK_FAILED` if rollback
  itself fails (`src/reranker-transformers.mjs:18-53`). Both the generic and
  Ettin adapters use this loader (`src/reranker-transformers.mjs:438-455`,
  `src/reranker-ettin.mjs:505-522`). The focused generic and Ettin regressions
  reproduce the former partial-success orphan and post-load validation paths.
  An additional independent probe covered delayed asynchronous rejection,
  asynchronous disposal, asynchronous validation rejection, `release()`
  fallback, and rollback-disposal failure; all fulfilled components were
  attempted exactly once and the typed aggregate was retained.
- Native profile shutdown is no longer suppressed. Profile execution now
  awaits close before writing the result and converts any close rejection into
  `status: "failed"` with `failureCode: "RERANKER_CLOSE_FAILED"`
  (`evals/run-ettin-native-bakeoff.mjs:281-296`). The injected provider-free
  runner regression verifies both the returned object and exclusively written
  result file carry that failed status.
- Evidence wording now distinguishes within-run repeat stability from
  historical rank parity. `--profile` is described only as repeat-stability,
  schedule, latency, and RSS evidence, while the frozen-bank `--run` is the
  explicitly unexecuted historical parity gate
  (`coding-sessions/reports/BRN-0043-technical-report.md:39-50`,
  `coding-sessions/human-report/BRN-0043-human-report.md:34-46`,
  `STATUS.md:23-31,44-48`). No native rank or RSS result is claimed.

## Verification Reviewed

- Exact committed diff from target `main` to
  `fd5935ec9776afb1d4d90859616886777a4873e2`: inspected in full; 14 changed
  paths, all allowed, no rename/copy, no forbidden path, no specialist
  self-acceptance, and declared R2 risk remains appropriate.
- `node --test tests/reranker-transformers.contract.test.mjs tests/reranker-ettin.contract.test.mjs tests/ettin-native-bakeoff.contract.test.mjs tests/retrieval-answer.contract.test.mjs tests/answer-confirmation.contract.test.mjs`:
  PASS, 77/77.
- `npm test`: PASS, 90/90.
- `npm run quickstart`: PASS, 6/6.
- `npm run test:legacy`: PASS, 935 passed / 15 optional skips / 0 failed
  across 950 tests.
- `npm run ettin-bakeoff`: PASS, inert identity/bank/runtime verification only;
  no native model execution.
- `npm run ticket -- check BRN-0043`: PASS before this rereviewer note.
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0043`:
  PASS for all 14 committed paths before this allowed rereviewer note.
- `git diff --check main...HEAD`: PASS.
- Independent scheduler/load probe: PASS for 5,000 deterministic schedules,
  exact one-to-one index coverage, batch/work bounds, over-target singleton
  enforcement, and three transactional rollback variants.

## Residual Risks

- The fp32 microbatch shape can still cause small native-kernel score drift.
  Historical 14/15 top-1 and 15/15 recall@5 parity remains contingent on the
  frozen-bank `--run` with the audited external runtime and cache.
- The mixed-length native `--profile` was not run, so this review makes no
  measured native RSS-ceiling or plateau claim. A single 7,999-token pair is
  intentionally allowed as an explicitly reported over-target singleton.
- Microbatching removes the 20--50-way padding multiplier but is not an
  OS-enforced memory boundary. Process/cgroup/container containment remains a
  separate operations concern.

No provider, credential, dataset, private `.palari-alpha` artifact, sealed U8
question, production service, or paid operation was accessed.

## Required Changes

- none.

## Recommendation

Recommend `accept` at exact head
`fd5935ec9776afb1d4d90859616886777a4873e2`. This recommendation does not
itself accept, merge, commit, or push the ticket.

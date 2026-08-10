# BRN-0043 Reviewer Note

Reviewer: fresh independent Codex reviewer `/root/brn_0043_reviewer`
Reviewed commit(s): `0f72abd4946ce5bf3886fb1dc98450fbbc8f3281` through
`0e2df6032b0c41b1ccd2a8b4f5edb08a3c30de05`
Target branch: `main` at `04b25ce547c59a9d25d13160f805680e738b5c9c`

## Review Result

FAIL. The normal scheduling, score restoration, inference cleanup,
serialization, metrics, and confirmation-limit paths pass, but one P1
lifecycle leak and two P2 native-profile evidence issues remain.

## Findings

- P1 — A partial parallel load can orphan a successfully loaded native model,
  and explicit close cannot recover it. Both adapters construct tokenizer and
  model components in one `Promise.all` (`src/reranker-transformers.mjs:401-407`,
  `src/reranker-ettin.mjs:504-511`). If one sibling factory rejects after the
  model factory has fulfilled, `loading` retains only the rejected aggregate.
  The close callback then awaits that rejection and returns without any
  component (`src/reranker-transformers.mjs:417-423`,
  `src/reranker-ettin.mjs:525-531`; shared swallowing at
  `src/reranker-transformers.mjs:338-345`). An independent reproducer loaded a
  disposable classifier, rejected tokenizer loading, called `warm()` and then
  `close()`, and observed `modelDisposals: 0`. This violates the all-path
  release/lifecycle acceptance criterion and matters directly to the native
  memory objective. The same rollback gap exists when all factories fulfill
  but post-load component validation rejects.
- P2 — The native profile can write `status: "completed"` after explicit close
  fails. It constructs the completed result before the `finally`, then drops
  every `reranker.close()` rejection (`evals/run-ettin-native-bakeoff.mjs:239-280`).
  A model-release failure is therefore absent from the supposedly completed
  profile record, which is not honest lifecycle evidence.
- P2 — The profile's order comparison is repeat determinism, not rank parity.
  Its reference is the first execution of the new microbatched path and later
  iterations are compared only with that same path
  (`evals/run-ettin-native-bakeoff.mjs:212-235`). It cannot show that ordering
  or the historical 14/15 top-1 and 15/15 recall@5 survived the batching
  change. The technical report nevertheless says native rank parity needs the
  external profile (`coding-sessions/reports/BRN-0043-technical-report.md:44-46`),
  and the human report says `--profile` can confirm unchanged ordering
  (`coding-sessions/human-report/BRN-0043-human-report.md:30-35`). The existing
  frozen-bank `--run` mode is the relevant parity check; `--profile` honestly
  supplies repeat stability, schedule, latency, and RSS only.

No additional finding was identified in the scheduler math, original-index
score restoration, explicit 512/7,999-token tokenizer calls, inference-path
tensor traversal/disposal, per-adapter serialization, metrics privacy,
stable pre-rerank 50-candidate confirmation cut, fail-closed ranking behavior,
declared R2 risk, or allowed/forbidden path enforcement. The pinned
Transformers.js 4.2.0 package source confirms that synchronous
`encode(text, { text_pair, add_special_tokens })` and batched tokenizer
`max_length` options match the adapter's assumptions. The native profile was
not executed, no native RSS claim was reviewed as measured, and the exact T3
configuration statement was not independently queried because production
infrastructure was explicitly out of review scope.

## Verification Reviewed

- Exact committed diff and rename/copy detection from target `main` to
  `0e2df60`: inspected; 13 changed paths, all declared, no rename, no forbidden
  path, and no specialist self-acceptance.
- `node --test tests/reranker-transformers.contract.test.mjs tests/reranker-ettin.contract.test.mjs tests/ettin-native-bakeoff.contract.test.mjs tests/retrieval-answer.contract.test.mjs tests/answer-confirmation.contract.test.mjs`:
  PASS, 74/74.
- `npm test`: PASS, 90/90.
- `npm run quickstart`: PASS, 6/6.
- `npm run test:legacy`: PASS, 932 passed / 15 optional skips / 0 failed
  across 947 tests.
- `npm run ettin-bakeoff`: PASS, inert identity/bank/runtime verification only;
  no native model execution.
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0043`:
  PASS for all 13 committed ticket paths before this allowed reviewer note.
- Initial `npm run ticket -- check BRN-0043`: expected report-lint failure only
  because this note did not yet exist; scope check was clean.
- Final `npm run ticket -- report-lint BRN-0043` and
  `npm run ticket -- check BRN-0043`: PASS with this allowed note present.
- `git diff --check main...HEAD` and dirty-note `git diff --check`: PASS.
- Additional provider-free invariant script: PASS for 2,000 deterministic
  randomized schedules, one-to-one index coverage, batch/work bounds,
  over-target singleton enforcement, recursive exactly-once disposal,
  score restoration, content-free metrics, and close-during-queued-work.
- Partial-load rollback reproducer: FAIL as expected, with
  `modelDisposals: 0` after tokenizer factory rejection plus `warm()` and
  `close()`.
- Official npm artifact source for `@huggingface/transformers@4.2.0` was
  inspected read-only to validate tokenizer call signatures; no runtime,
  cache, model artifact, provider, credential, private alpha path, dataset,
  sealed U8 question, production service, or paid operation was accessed.

## Required Changes

- Make both component loaders retain and explicitly dispose every fulfilled
  disposable tokenizer/model if any sibling load or post-load validation
  fails. Add generic and Ettin contracts that reproduce partial-success
  rollback and prove each fulfilled component is released exactly once.
- Make profile close failure terminal or record it as a failed profile; never
  emit a completed result after explicit model release fails. Add a
  provider-free profile-runner contract for this path.
- Describe `--profile` as repeat-stability/RSS evidence only. Use the existing
  frozen-bank `--run` mode (or an equivalent fixed expected ranking) for native
  rank parity, and align the technical report, human report, and status proof
  boundary with that distinction.

## Recommendation

Recommend `reopen` at exact head
`0e2df6032b0c41b1ccd2a8b4f5edb08a3c30de05`. This recommendation does not
accept, merge, commit, or push the ticket.

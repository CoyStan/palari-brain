# BRN-0049 Rereviewer Note

Reviewer: fresh independent Codex rereviewer `/root/brn_0049_rereviewer`
Reviewed commit: `83119b454998cbbf7777180a2e575d93c33545fe`
Target branch: `main` at
`d2bf26f8abb523dd37b80d79c4b86728c20c37da`

## Review Result

FAIL. The four findings from the first review are addressed at their stated
checkpoints, and all normal gates pass. However, a residual P1 stale-recovery
race still lets a recoverer unlink a newly published live lock after its second
check. Atomic cross-process request and unit admission is therefore not proven,
so acceptance criteria 2, 3, and 5 remain unsatisfied.

## Findings

- P1 — Stale recovery has a final pathname replacement race between its second
  validation and `unlink`. `evals/rolling-token-pacer.mjs:194-203` now correctly
  observes the same dead owner bytes, inode, device, and stale age twice, but
  `evals/rolling-token-pacer.mjs:204-207` then unlinks `lockPath` without proving
  that the pathname still names that validated inode. A second recoverer or new
  owner can replace the path in this interval, causing the first recoverer to
  unlink the new live lock and enter the critical section. An independent
  provider-free temporary-file check replaced the stale lock with a complete
  live lock during the second liveness check. The candidate made zero lock
  waits, deleted the live lock, and admitted one event. This defeats the claim
  that active locks are never stolen and can permit concurrent request and unit
  admission above the shared ceilings.

No P0, P2, or P3 finding was identified.

The first review's other findings are resolved: loaded state requires exact
root, policy, and event shapes, rebuilds fresh `{ at, units }` records, and
leaves rejected corrupt bytes unchanged; lock ownership is fully written and
synced before atomic hard-link publication, eliminating the partial-record
publication race; `lockRetryMs > windowMs` is rejected; and target `main`
contains the ticket scope correction at `d2bf26f` while retaining every key,
secret, private-data, result, and production exclusion. The bounded host and
HTTP 429 error field/header allowlists remain intact, and the committed diff
adds no provider retry or provider call.

## Verification Reviewed

- Exact clean candidate and target were verified before this permitted note:
  `83119b454998cbbf7777180a2e575d93c33545fe` against `main` at
  `d2bf26f8abb523dd37b80d79c4b86728c20c37da`; their merge base is the target.
- The complete committed diff, both BRN-0049 commits, target scope-correction
  commit, ticket, technical report, human report, and prior reviewer note were
  inspected. Rename/copy detection found no rename or copy.
- `node --test tests/alpha-memory-debug.contract.test.mjs
  tests/rolling-token-pacer.contract.test.mjs`: PASS, 26/26.
- `npm test`: PASS, 102/102.
- `npm run quickstart`: PASS, all six steps.
- `npm run test:legacy`: PASS, 979 passed, 15 optional skips, and 0 failed
  across 994 tests.
- `npm run ticket -- ticket-lint BRN-0049`, `npm run ticket -- report-lint
  BRN-0049`, and `npm run ticket -- check BRN-0049`: PASS.
- `npm run ticket -- scope-check --committed-plus-dirty --target
  d2bf26f8abb523dd37b80d79c4b86728c20c37da BRN-0049`: PASS, all 11
  committed-plus-permitted-note paths in scope.
- `git diff --check
  d2bf26f8abb523dd37b80d79c4b86728c20c37da...83119b454998cbbf7777180a2e575d93c33545fe`:
  PASS.
- The synthetic stale-recovery race used only a temporary directory and
  synthetic owner records. No provider, credential, environment file, private
  data or result, dataset, paid operation, or sealed U8 item was accessed.

## Required Changes

- Make stale removal atomic with respect to the validated lock identity, so a
  pathname replaced after the final validation cannot be unlinked. Add a
  deterministic regression that installs a live replacement after the final
  dead-owner check and proves that it survives and forces the contender to
  wait. Also cover two simultaneous stale recoverers before resubmission.
- Rerun the declared gates and obtain a fresh independent review at the new
  exact committed head.

## Recommendation

Recommend `reopen` at exact committed head
`83119b454998cbbf7777180a2e575d93c33545fe`. This recommendation does not
accept, merge, commit, push, or call a provider.

# BRN-0049 Reviewer Note

Reviewer: fresh independent Codex reviewer `/root/brn_0049_reviewer`
Reviewed commit: `5d8d0602206723d0fdf111d606a04778a28ad3f3`
Target branch: `main` at
`6743dc5153c85f13f062c0db4afcda6329782262`

## Review Result

FAIL. The normal focused, core, quickstart, legacy, report, current-scope, and
diff gates pass, and the safe error-field allowlists are correct. However, two
P1 pacer safety defects and two P2 contract defects remain. Acceptance
criteria 2 through 5 are therefore not satisfied.

## Findings

- P1 — Corrupt event objects can persist arbitrary request content instead of
  failing closed. `evals/rolling-token-pacer.mjs:192-203` validates only each
  event's `at` and `units`, then returns the original object. The next save at
  `evals/rolling-token-pacer.mjs:213-222` serializes that object unchanged. An
  independent temporary-file check seeded an otherwise valid event with
  `prompt: "SYNTHETIC-REQUEST-CONTENT"`; `pace(1)` succeeded and re-saved the
  synthetic prompt beside the new event. This violates acceptance criterion
  3's content-free state and corrupt-state fail-closed requirements and the
  ticket stop condition against request-content storage.

- P1 — Stale recovery can unlink a lock whose same inode has become live,
  allowing concurrent critical sections and defeating atomic ceilings.
  `evals/rolling-token-pacer.mjs:161-170` decides that the observed owner is
  dead, but its second read checks only inode and device. It does not require
  the current owner token/PID to equal the observed owner, recheck current
  liveness, or recheck the current modification time. An independent
  temporary-file race changed the existing inode from the observed dead owner
  to `{ pid: process.pid, token: "live-owner" }` between those reads. The pacer
  unlinked that live lock and admitted work. The same race exists while a
  newly created lock inode is still receiving/syncing its owner record,
  especially because `lockStaleMs` may be one millisecond. This violates
  acceptance criteria 2 and 3: active locks are not guaranteed against theft,
  so cross-process request and unit admission is not adversarially atomic.

- P2 — A valid configuration can wait longer than the configured rolling
  window. `evals/rolling-token-pacer.mjs:82-86` accepts any positive
  `lockRetryMs`, while `evals/rolling-token-pacer.mjs:174-176` passes it
  directly to `wait`. An independent check configured `windowMs: 100` and
  `lockRetryMs: 101`; contention produced `wait(101)`. This contradicts
  acceptance criterion 4 and `docs/EVALUATION-HARNESS.md`'s unqualified claim
  that a wait never exceeds one configured window.

- P2 — The candidate widens its own committed ticket contract to make the
  implementation paths pass scope checking. The target ticket at
  `6743dc5153c85f13f062c0db4afcda6329782262` forbids `*token*` and
  `**/*token*` at lines 39-40, which take precedence over allowed paths in the
  scope checker. The candidate deletes those rules while changing
  `evals/rolling-token-pacer.mjs` and
  `tests/rolling-token-pacer.contract.test.mjs`. `docs/TICKET-WORKFLOW.md`
  defines the ticket as the pre-work bounded contract and says not to edit
  scope after implementation merely to make a diff pass. The current scope
  command passes only against the widened candidate ticket, not the pinned
  target contract.

No P0 or P3 finding was identified. The review found no defect in the bounded
host-rejection fields, HTTP 429 field/header allowlists and generic messages,
normal policy mismatch behavior, ordinary concurrent ceilings, different-path
independence, oversized empty-window admission, default in-memory behavior, or
the no-retry/provider-free diff.

## Verification Reviewed

- Exact clean candidate and target were verified before this permitted note:
  `5d8d0602206723d0fdf111d606a04778a28ad3f3` against `main` at
  `6743dc5153c85f13f062c0db4afcda6329782262`; their merge base is the target.
- Complete committed diff and rename/copy detection: nine candidate paths,
  all within the candidate's current allowlist and no rename/copy. Comparing
  the ticket itself to the target exposed the forbidden-path widening above.
- `node --test tests/alpha-memory-debug.contract.test.mjs tests/rolling-token-pacer.contract.test.mjs`:
  PASS, 25/25.
- `npm test`: PASS, 101/101.
- `npm run quickstart`: PASS, all six steps.
- `npm run test:legacy`: PASS, 978 passed, 15 optional skips, and 0 failed
  across 993 tests.
- The real six-child-process focused contract passed once in the focused run
  and five additional independent repetitions.
- `npm run ticket -- ticket-lint BRN-0049`: PASS.
- Before this note, `npm run ticket -- report-lint BRN-0049` and
  `npm run ticket -- check BRN-0049` failed only because the required reviewer
  note was absent.
- `npm run ticket -- scope-check --committed-plus-dirty --target
  6743dc5153c85f13f062c0db4afcda6329782262 BRN-0049`: PASS against the
  candidate's widened ticket, nine committed-plus-dirty paths before this
  allowed note.
- `git diff --check
  6743dc5153c85f13f062c0db4afcda6329782262...5d8d0602206723d0fdf111d606a04778a28ad3f3`:
  PASS.
- Independent synthetic checks were provider-free and used only temporary
  files. No provider, credential, environment file, private artifact,
  dataset, evaluation result, production service, paid operation, or sealed
  U8 item was accessed.

## Required Changes

- Reconstruct loaded state into exact fresh `{ at, units }` records and reject
  non-exact root, policy, and event shapes; add a regression proving arbitrary
  event fields fail closed and are never re-persisted.
- Make stale removal conditional on the second read still representing the
  same dead owner and stale observation. Cover the partial-owner-write and
  dead-to-live same-inode races, plus PID-reuse/ownership behavior, without
  stealing an active lock.
- Reject or bound `lockRetryMs` so every individual wait is at most
  `windowMs`, and add a direct contract.
- Resolve the target ticket's contradictory token-path scope through the
  governed/human path before resubmitting; do not rely on implementation-time
  deletion of forbidden rules.
- Rerun all declared gates and obtain a fresh independent review of the new
  exact committed head.

## Recommendation

Recommend `reopen` at exact committed head
`5d8d0602206723d0fdf111d606a04778a28ad3f3`. This recommendation does not
accept, merge, commit, push, or call a provider.

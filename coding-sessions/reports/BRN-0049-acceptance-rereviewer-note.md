# BRN-0049 Acceptance Rereviewer Note

Reviewer: fresh independent Codex acceptance rereviewer
`/root/brn_0049_acceptance_reviewer`
Reviewed commit: `613fa428a4c4dfcfae75be5274e07f579130e267`
Target branch: `main` at
`d2bf26f8abb523dd37b80d79c4b86728c20c37da`

## Review Result

REOPEN. The common acquisition gate remains coherent on source inspection, and
all declared gates pass. However, the new three-actor contract does not prove
the complete concurrency property required by the prior rereview. This is one
P2 test-evidence finding; no unresolved P0, P1, or P3 implementation finding
was identified.

## Finding

- P2 — The deterministic three-actor regression still lacks a real live owner
  and explicit exclusion/cleanup assertions. In
  `tests/rolling-token-pacer.contract.test.mjs:447-549`, the parent process
  writes a synthetic `live-owner` lock record itself and later unlinks it from
  its injected wait callback. Only the later publisher is a child process.
  Because no real owner child holds a measurable critical section, the test
  cannot assert that neither the parent recoverer nor the later publisher
  admits before that owner releases. `child.stats.lockWaits > 0` does not prove
  which lock or gate caused the wait and is not a no-overlap assertion. The
  test also never checks that the main lock, acquisition gate, quarantine, and
  candidate paths are absent after success. Its final two-event state proves
  aggregate accounting for this run but not the required release ordering or
  lifecycle cleanup. This leaves the exact regression obligation from the gate
  rereview incomplete, so acceptance criterion 5 is not yet satisfied.

The previous P1 races appear fixed in the implementation: every normal lock
publication, stale observation, quarantine, and recovered publication owns the
same atomically published gate; stale capture validates device, inode, bytes,
age, and dead ownership; and an abandoned gate fails closed. The earlier exact
state-shape, complete owner publication, retry-window, target-scope, bounded
error serialization, no-retry, and provider-free findings also remain
addressed.

## Verification Reviewed

- Exact candidate, target, and merge base were verified: candidate
  `613fa428a4c4dfcfae75be5274e07f579130e267`; target and merge base
  `d2bf26f8abb523dd37b80d79c4b86728c20c37da`.
- All governing files, the ticket, human and technical reports, four prior
  reviewer notes, commit history, and complete 13-path diff were inspected.
  Rename/copy detection found no rename or copy.
- Focused alpha and pacer contracts: PASS, 30/30.
- `npm test`: PASS, 106/106.
- `npm run quickstart`: PASS, all six steps.
- `npm run test:legacy`: PASS, 983 passed, 15 optional skips, and 0 failed
  across 998 tests.
- Ticket lint, report lint, ticket check, committed-plus-dirty scope against
  the pinned target, committed diff check, and dirty diff check: PASS before
  this permitted note.
- All review activity was local and provider-free. No provider, credential,
  environment file, private data or result, dataset, paid operation, or sealed
  U8 item was accessed.

## Required Change

- Replace or extend the test with a real owner child that signals after it has
  acquired the shared lock and holds its critical section behind an explicit
  release barrier. Start the recoverer and later publisher at controlled
  checkpoints, and assert directly that neither admission completes before
  owner release.
- After all actors complete, assert preservation of the request and unit
  ceilings and absence of every derived main-lock, gate, quarantine, and
  candidate path.
- Rerun the declared gates and obtain a fresh independent review at the new
  exact committed head.

## Recommendation

Recommend `reopen` at exact committed head
`613fa428a4c4dfcfae75be5274e07f579130e267` with one P2 finding. This
recommendation does not accept, commit, push, merge, or call a provider.

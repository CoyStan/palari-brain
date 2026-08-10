# BRN-0049 Gate Rereviewer Note

Reviewer: fresh independent Codex rereviewer
`/root/brn_0049_gate_reviewer`
Reviewed commit: `beb5e1efa3d168934a04b3967eb541681e999706`
Target branch: `main` at
`d2bf26f8abb523dd37b80d79c4b86728c20c37da`

## Review Result

REOPEN. The implementation now places normal main-lock publication, stale
observation, quarantine, and recovered publication under one atomically owned
acquisition gate. Code inspection and additional provider-free lifecycle
checks found no remaining instance of the previously reported publication
race. However, the exact deterministic three-actor regression required by the
prior rereview was not added. Acceptance criterion 5 is therefore not yet
satisfied.

## Findings

- P2 — The committed test suite does not reproduce the stale-observer,
  live-owner, and later-publisher schedule that caused the prior P1 reopening.
  `tests/rolling-token-pacer.contract.test.mjs:427-446` adds only an abandoned
  acquisition-gate test. The earlier late-replacement test uses one pacer and
  an in-process pathname rewrite, while the simultaneous-recoverer test has no
  barriers at the three-actor publication checkpoints. Neither proves that a
  stale observer cannot survive while a live owner publishes and a third actor
  attempts a later publication. The prior review explicitly required a
  deterministic three-actor regression proving exclusion until release,
  preservation of the newer live lock, cleanup of gate/quarantine/candidate
  paths, and intact request/unit ceilings. Without that regression, a future
  refactor could restore the exact atomicity defect while all 29 focused tests
  remain green.

No P0, P1, or P3 finding was identified. In the reviewed implementation,
`evals/rolling-token-pacer.mjs:197-267` requires ownership of the same gate
before every compliant main-lock publication, stale observation, quarantine,
and recovered publication. A contender cannot publish from an earlier gate
observation because gate ownership itself is acquired by atomic hard-link
publication on every loop. Main-lock release can remove an existing owned
path while another actor holds the gate, but it cannot publish a replacement;
the gate holder therefore either waits after observing a live owner or loops
after observing disappearance. A crashed gate holder strands progress and is
reported terminal once stale and dead, which is fail-closed rather than an
over-admission path.

The earlier findings remain addressed: state root, policy, and event objects
have exact shapes and corrupt bytes are not rewritten; owner records are
complete and synced before atomic publication; stale capture rechecks device,
inode, bytes, age, and dead ownership; lock retry cannot exceed the window;
release checks its ownership token; and the corrected target scope retains the
credential, secret, private-data, result, and production exclusions. Error
serialization retains bounded host-rejection and HTTP 429 allowlists with
generic messages and no provider body. No retry or provider call was added.

## Verification Reviewed

- Exact candidate, target, and merge base were verified: candidate
  `beb5e1efa3d168934a04b3967eb541681e999706`; target and merge base
  `d2bf26f8abb523dd37b80d79c4b86728c20c37da`.
- The complete committed diff contains 12 paths, all permitted by the corrected
  target contract; rename/copy detection found no rename or copy.
- Focused alpha and pacer contracts: PASS, 29/29.
- `npm test`: PASS, 105/105.
- `npm run quickstart`: PASS, all six steps.
- `npm run test:legacy`: PASS, 982 passed, 15 optional skips, and 0 failed
  across 997 tests.
- Five additional repetitions of the real six-process ceiling contract: PASS.
- Ticket check, report lint, committed-plus-dirty scope against the pinned
  target, and committed diff check: PASS before this permitted note.
- Additional temporary-directory checks confirmed that a live gate prevents
  stale-lock quarantine/publication, corrupt-state rejection preserves exact
  bytes and releases owned paths, and successful stale recovery leaves no
  gate, lock, quarantine, or candidate path.
- All review and adversarial checks were local and provider-free. No provider,
  credential, environment file, private data or result, dataset, paid
  operation, or sealed U8 item was accessed.

## Required Change

- Add the deterministic real-child-process three-actor regression required by
  the prior review. Use barriers around stale observation, live-lock
  publication/critical-section ownership, and the later publication attempt;
  prove no critical-section overlap, no deletion of the newer live lock,
  cleanup of every derived path, and preserved request and unit ceilings.
  Rerun the declared gates and obtain a fresh review at the new exact head.

## Recommendation

Recommend `reopen` at exact committed head
`beb5e1efa3d168934a04b3967eb541681e999706`. This recommendation does not
accept, commit, push, merge, or call a provider.

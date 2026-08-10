# BRN-0049 Final Rereviewer Note

Reviewer: fresh independent Codex rereviewer
`/root/brn_0049_final_rereviewer`
Reviewed commit: `8525b98c0c00481de57d4856372a4874bda83fe7`
Target branch: `main` at
`d2bf26f8abb523dd37b80d79c4b86728c20c37da`

## Review Result

REOPEN. The prior final check-to-unlink defect is fixed in isolation: recovery
now owns a claim, atomically moves the lock pathname to quarantine, and does
not directly unlink a later replacement at that pathname. The normal gates
pass. However, the recovery claim is checked separately from normal lock
publication, leaving a residual three-contender P1 interleaving that can still
remove a newer active lock and overlap critical sections. Acceptance criteria
2, 3, and 5 therefore remain unsatisfied.

## Findings

- P1 — Lock publication is not serialized with the owned recovery claim.
  `evals/rolling-token-pacer.mjs:197-209` checks `recoveryPath` and later
  publishes `lockPath` in separate operations. A contender that has observed
  no recovery claim can therefore publish after another process creates the
  claim. Combined with stale observations surviving across awaits at
  `evals/rolling-token-pacer.mjs:212-216`, this defeats the quarantine
  restoration at `evals/rolling-token-pacer.mjs:230-252`.

  A valid adversarial schedule is:

  1. Recoverer A sees no recovery claim, fails normal lock publication,
     observes stale lock L0, and proves L0's owner dead, then pauses before
     publishing its recovery claim.
  2. Recoverer B claims recovery, removes L0 through quarantine, releases the
     claim, loops, publishes live lock L1, and starts the state critical
     section.
  3. Contender C reads the now-absent recovery path and pauses before normal
     lock publication.
  4. A resumes from its old L0 observation, successfully claims recovery, and
     blindly renames the current live L1 to its quarantine path.
  5. C resumes and publishes live L2 at the now-empty lock path even though
     A's recovery claim exists, because C already passed the one-time claim
     check.
  6. A correctly recognizes that quarantined L1 does not match observed L0,
     but its restore link receives `EEXIST` from L2 and is ignored at lines
     248-250. Line 252 then unlinks quarantined L1. C can enter the critical
     section while B is still inside it; B's later ownership-checked release
     fails only after atomic admission has already been lost.

  The added two-recoverer contract does not control these checkpoints and
  cannot exercise this three-actor schedule. Thus the new code fixes the exact
  previous late-replacement test but does not establish that a recovery claim
  excludes all publishers or that a newer active lock survives every stale
  recovery schedule.

No P0, P2, or P3 finding was identified. Strict state shapes rebuild exact
`{ at, units }` events and reject extra content without rewriting it; retry
wait configuration is bounded by the window; request and unit accounting,
oversized-empty-window behavior, different-path independence, abandoned-claim
fail-closed behavior, owner-checked release, and normal lifecycle cleanup are
otherwise consistent with the contract. Error serialization retains bounded
host and HTTP 429 allowlists with generic messages, and the diff adds no
provider retry or provider call. The corrected target already removed only
the contradictory token-rate path exclusions while retaining credential,
secret, private-data, result, and production exclusions.

## Verification Reviewed

- Exact candidate, target, and merge base: candidate
  `8525b98c0c00481de57d4856372a4874bda83fe7`, target and merge base
  `d2bf26f8abb523dd37b80d79c4b86728c20c37da`.
- Complete committed diff and rename/copy detection: 11 paths, no rename or
  copy; all paths are permitted by the corrected target contract.
- Focused contracts: PASS, 28/28.
- `npm test`: PASS, 104/104.
- `npm run quickstart`: PASS, all six steps.
- `npm run test:legacy`: PASS, 981 passed, 15 optional skips, and 0 failed
  across 996 tests.
- Ticket lint, report lint, and `npm run ticket -- check BRN-0049`: PASS.
- Committed-plus-dirty scope: PASS, all 12 candidate-plus-permitted-note paths
  in scope against the pinned target.
- Committed and dirty diff checks: PASS.
- The adversarial analysis used only synthetic lock identities and local
  temporary-file semantics. No provider, credential, environment file,
  private data or result, dataset, paid operation, or sealed U8 item was
  accessed.

## Required Changes

- Make normal lock publication and stale recovery mutually exclusive under
  one atomic gate. No contender that observed an earlier claim state may
  publish while recovery is active, and no stale observation may quarantine a
  newer active lock without preserving that owner's exclusion.
- Add a deterministic three-actor regression with barriers at the schedule
  above. It must prove that the original active owner remains excluded until
  release, no replacement owner enters concurrently, no newer active lock is
  deleted, all claim/quarantine/candidate paths are cleaned on success, and
  request and unit ceilings remain intact.
- Rerun all declared gates and obtain a fresh independent review at the new
  exact committed head.

## Recommendation

Recommend `reopen` at exact committed head
`8525b98c0c00481de57d4856372a4874bda83fe7`. This recommendation does not
accept, merge, commit, push, or call a provider.

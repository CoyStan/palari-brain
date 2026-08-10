# BRN-0049 Final Acceptance Reviewer Note

Reviewer: fresh independent Codex final acceptance reviewer
`/root/brn_0049_final_acceptance_reviewer`
Reviewed commit: `38e9187a3b224bd0bbfcbab4b54f1631d8084e9f`
Target branch: `main` at
`d2bf26f8abb523dd37b80d79c4b86728c20c37da`

## Review Result

ACCEPT. The strengthened deterministic contract closes the prior P2 test-
evidence finding. The implementation and tests satisfy all five acceptance
criteria. No unresolved P0, P1, P2, or P3 finding was identified.

## Findings

- No unresolved P0-P3 findings.
- The final three-actor contract uses a real live-owner child and a separate
  real publisher child. The parent is the stale observer and recoverer. Exact
  barriers start the owner during the parent's second dead-owner check, wait
  until that child publishes its PID-bound live lock, and then start the later
  publisher while the parent still owns the common acquisition gate.
- Before it signals owner release, the parent asserts that the shared state
  does not exist. This directly proves that neither the parent nor publisher
  admitted work while the live-owner child held the lock. The publisher also
  reports a lock wait. After release, the parent and publisher produce exactly
  two events with two total units under the configured two-request and two-unit
  ceilings.
- After all actors complete, the test lists the temporary directory and proves
  that no `pacer.json.*` path remains. This covers the main lock, acquisition
  gate, stale quarantine, publication candidates, and state temporary files.
- Source inspection confirms that every compliant main-lock publication,
  stale observation, quarantine decision, and recovered publication owns the
  same atomically published gate. A complete synced owner record is published
  by hard link. Stale capture rechecks device, inode, bytes, age, and dead PID.
  A live replacement is restored without overwrite, release checks ownership,
  and an abandoned gate fails closed.
- Durable state accepts only exact schema, policy, and `{ at, units }` shapes.
  Request and unit admission is serialized, policy mismatch and corrupt state
  fail closed, oversized work enters only an empty window, and every wait is
  bounded by the configured window. The original in-memory pacer remains the
  default.
- Host rejection and HTTP 429 logging use bounded generic messages and
  allowlisted fields. Provider bodies and arbitrary metadata are excluded. No
  provider retry or provider call was added.

## Verification Reviewed

- Candidate, target, and merge base were verified exactly: candidate
  `38e9187a3b224bd0bbfcbab4b54f1631d8084e9f`; target and merge base
  `d2bf26f8abb523dd37b80d79c4b86728c20c37da`.
- The ticket, workflow, technical report, human report, all five prior reviewer
  notes, commit history, complete 14-path diff, and relevant source and tests
  were inspected. Rename and copy detection found no rename or copy. Every
  changed path is allowed by the corrected target contract, and no forbidden
  path changed.
- Focused alpha and pacer contracts: PASS, 30/30.
- `npm test`: PASS, 106/106.
- `npm run quickstart`: PASS, all six steps.
- `npm run test:legacy`: PASS, 983 passed, 15 optional skips, and 0 failed
  across 998 tests.
- Ticket lint, report lint, ticket check, committed-plus-dirty scope against
  the pinned target, committed diff check, and dirty diff check: PASS before
  this permitted reviewer note.
- All review work was local and provider-free. No provider, credential,
  environment file, private data or result, dataset, paid operation, or sealed
  U8 item was accessed.

## Recommendation

Recommend founder acceptance of BRN-0049 at exact committed head
`38e9187a3b224bd0bbfcbab4b54f1631d8084e9f`. This recommendation does not
accept the ticket, commit, push, merge, or call a provider.

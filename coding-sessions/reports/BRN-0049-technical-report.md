# BRN-0049 Technical Report

## Files Changed

- `evals/run-alpha-memory-debug.mjs` — serialize bounded host-rejection and
  allowlisted HTTP 429 details without copying provider bodies or arbitrary
  metadata.
- `evals/rolling-token-pacer.mjs` — add an opt-in file-backed pacer with atomic
  cross-process request and unit admission, policy binding, and owned stale
  lock recovery.
- `tests/alpha-memory-debug.contract.test.mjs` — prove host and 429 field
  allowlists, bounds, generic messages, and provider-body exclusion.
- `tests/rolling-token-pacer.contract.test.mjs` — prove same-path concurrency,
  real child-process admission, independent paths, request ceilings, policy
  mismatch, corrupt state, and live/dead lock behavior.
- `docs/EVALUATION-HARNESS.md` and `STATUS.md` — document the boundary and
  verification evidence.

## Verification

- Focused alpha and pacer contracts: PASS, 25/25.
- `npm test`: PASS, 101/101.
- `npm run quickstart`: PASS, 6/6.
- `npm run test:legacy`: PASS, 978 passed, 15 optional skips, 0 failed across
  993 tests.
- Six real child processes sharing one state path: PASS. The durable active
  window remained at or below 100 units and two requests.
- Five additional repetitions of the child-process contract: PASS.
- No provider, credential, private artifact, dataset, result artifact, or
  sealed U8 access occurred.

## Risks / Follow-Ups

- File pacing is opt-in. Every isolated worker must receive the same state path
  and policy to share one ceiling. A mismatch is terminal.
- Stale-lock owner checks use local process IDs. The implementation is for
  workers on one host, not a network file system shared by many hosts.
- The live two-case diagnostic remains pending until this ticket receives an
  independent clean review and founder acceptance.

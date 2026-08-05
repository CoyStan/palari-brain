# BRN-0021 Technical Report

## Outcome

The evaluation harness now has two offline, fail-closed primitives. Structured
OpenAI Responses requests can be snapshotted and sent through a caller-injected
exact input counter, whose strict result is internally branded before a
reservation can use it. Sealed SQLite state can be audited only after the main
database and present WAL/SHM sidecars are copied to an owned scratch directory.

This ticket does not integrate a live endpoint. It has no network, credential,
retry, meter, or provider surface and makes no claim that input counting is
free. A later live integration remains separately founder-gated.

## Files Changed

- `evals/openai-input-reservation.mjs`: immutable body snapshot, injected exact
  counter, strict branded response, exact picodollar Sol Standard reservation,
  and conservative UTF-8-byte fallback.
- `evals/sealed-sqlite-audit.mjs`: no-follow physical snapshot, copy-first
  callback boundary, source revalidation, and exact owned cleanup.
- Two contract-test files: adversarial response/reservation cases and real
  synthetic SQLite main/WAL/SHM/callback-failure behavior.
- `evals/predictions.md`: P-set 31 preregistration and deterministic result.
- `docs/EVALUATION-HARNESS.md` and `docs/DECISIONS.md`: operational and custody
  boundaries, official documentation links, and explicit future gate.
- Ticket, status, technical, and founder-readable evidence.

## Measurement

With the same 512 output ceiling, the fixed synthetic bank produced:

| Case | Exact-count reserve | Byte fallback | Reduction |
| --- | ---: | ---: | ---: |
| 1 | `$0.05839125` | `$0.4033275` | `6.907x` |
| 2 | `$0.04911` | `$0.6845775` | `13.939x` |
| 3 | `$0.04161` | `$0.25364` | `6.095x` |

The minimum `6.095x` clears the preregistered `3x` synthetic threshold. These
are deterministic harness numbers, not a provider count, actual spend, or
historical-request replay.

## Verification

- Repaired focused contracts: 21 passed, 0 failed.
- Full `node --test`: 763 tests; 748 passed, 15 optional skips, 0 failed.
- `npm run quickstart`: PASS, 6/6.
- Relevant `node --check`, `git diff --check`, ticket lint, and governed
  committed-plus-dirty scope: PASS.
- Runtime source scan for environment/network surfaces: PASS, zero matches.
- Credential reads / network requests / provider calls / inference /
  private-result reads / spend: `0 / 0 / 0 / 0 / 0 / $0.00`.

## Invariants

- The strict parser is the only constructor of a reservation-accepted count
  record. A raw number or forged lookalike cannot enter counted mode.
- A count invocation failure is terminal; fallback is available only when the
  caller did not dispatch a count.
- Integer picodollars and the exact decimal string are authoritative; no lossy
  floating total controls a hard cap.
- SQLite receives only the scratch-copy path. Source names, bytes, and modes
  are checked after every success or failure before the receipt can return.
- Historical BRN-0017 remains 6/10. Consumed BRN-0020 and its exactly-once
  judgments/private custody evidence remain unchanged and unaccessed.

## Risks / Follow-Ups

- Exact endpoint wire compatibility and billing treatment are not live-proven.
  A separate founder-gated, metered compatibility probe must establish them.
- Pricing is explicitly pinned to the accepted Sol Standard boundary and must
  be reverified before a future identity freeze.
- The callback is a custody boundary, not a capability sandbox: a malicious
  callback that independently knows the source path could reach it. Governed
  callers must supply an audit closure containing only the copied path.
- Independent adversarial review is required before acceptance.

## Review Repair

Independent review of submitted head `30d0d4f` recommended reopen with two P1,
three P2, and one P3 findings. The review proved uncaptured `BigInt` could zero
all authoritative reservation values; pathname substitution could leave the
real owned database copy behind; special mode bits and parent-symlink
retargeting escaped source comparison; the generated token filename guard was
self-contradictory; and a virtual Proxy could synthesize a valid response.

The cumulative repair:

- captures integer, string, and hash operations and rejects Proxy response/body
  shapes before reflection;
- keeps an open scratch directory descriptor, resolves its current physical
  path from the descriptor after callback activity, validates device/inode,
  removes only that owned directory, and fails without deleting a substituted
  pathname;
- compares full permission mode, device/inode, bytes, physical file set, and
  the resolved source path, so leaf replacement and parent retargeting fail;
- adds permanent reproductions for every attack; and
- merges target-main contract reconciliation `8a880e2`, which removes only the
  two self-conflicting filename globs while preserving all actual secret and
  private-data prohibitions.

The first cumulative rereview confirmed those repairs, then found four mutable-
prototype P1 gaps in error collection, source sidecar iteration, and namespace
prefix checking. The cumulative repair replaces `push`/`unshift`/`for...of`
with indexed local arrays, uses a private exact error iterable, captures prefix
and sort operations, and captures file-handle/stat operations before any
callback. All four attacks are permanent tests. Focused tests now pass 20/20
and full tests pass 747/762 with 15 optional skips. A second fresh independent
cumulative rereview remains required.

A second independent reviewer confirmed all preceding repairs, then found one
P2 in combined-error preservation: the private iterable was a generator whose
shared inherited `next` remained mutable. The repair replaces it with a null-
prototype iterator carrying an own `next`; a simultaneous callback and source-
custody failure now preserves both ordered causes. Focused tests pass 21/21 and
full tests pass 748/763 with 15 optional skips. Fresh rereview remains required.

Fresh independent acceptance review of exact head `2daef94` against target
`8a880e2` replayed the cumulative criteria/findings, found no P0-P3 issue, and
recommends acceptance. It confirmed focused 21/21, full 748 passed / 15 skipped
/ 0 failed, quickstart 6/6, and clean syntax/diff/ticket/scope/upstream state.

# V2-M2-B Governed Mutation Bridge Implementation Plan

> Execute M2-B and the parent-M2 production falsifier only. Do not begin M3
> until M2-B is certified and pushed. Never resume sealed U8 or perform a
> provider, spend, dataset, benchmark, publication, or announcement action.

**Goal:** put the certified A2 projection applier beneath a provenance-pinned
patch gate; bind exact erasure authority outside proposals; checkpoint legacy
CDX state; and co-commit a disjoint payload-column-free B2 journal with every
accepted projection effect.

**Accepted surface:** exactly two final compatibility leaves:

```text
D-02 clean same-Palari same-user private shared=0 zero-link ratified erasure
D-03 clean same-Palari same-user private shared=0 zero-link ratified erasure
```

`PD-02` is not accepted: explicit-user demotion cannot be relabeled
`g_demote`, and `demote|ratified_user` is unregistered. Link-bearing erasure is
also refused because no `write|source` registration exists. Every other leaf
in the exact 46-row/22-dimension inventory refuses with zero CDX mutation.

**Architecture:** a trusted host creates a process-local root with a captured
synchronous use-time external-grant predicate. The root itself has no verbs.
Exact-target opaque erasure grants are bound once to one store generation.
`src/governed-memory-bridge.mjs` becomes the sole production A1 owner. It runs
the exact ratify patch through Admit/Resolve, performs the pinned pure erasure
transition, and hands one paired B2/A2 plan to transaction-neutral children.
Four exact `cdx_b2_*` tables hold an immutable legacy checkpoint and append-
only decisions/effects. CDX-M1 remains runtime/read authority; exact B1 stays
unchanged and non-authoritative.

**Runtime:** Node `v22.22.2`, SQLite `3.51.2`, ESM, `node:test`, built-in
`node:sqlite`; no dependency change.

**Normative contract set:**

- `docs/GOVERNED-MUTATION-BRIDGE-CONTRACT.md`
- `docs/MEMORY-AUTHORITY-CONTRACT.md`
- `docs/GOVERNED-MUTATION-DISPOSITION-REGISTRY.md`
- `docs/CDX-B2-SCHEMA-CONTRACT.md`

## File map

- **Add `src/memory-authority-runtime.mjs`** — captured-primordial private
  brands/state, one-lifetime audience, reservation, use-time predicate,
  trusted time, and burn/release/retire law.
- **Add `src/memory-authority.mjs`** — exact five-export host surface: one
  error class plus four operations.
- **Add `src/governed-mutation-dispositions.mjs`** — frozen data-only exact
  registry and four-export evaluator surface copied mechanically from the
  reviewed documentation artifact.
- **Add `src/cdx-b2-schema.mjs`** — dependency-leaf exact registries,
  canonical config bytes/hash, DDL, complete manifest, and six-export surface.
- **Add `src/cdx-b2-journal.mjs`** — transaction-neutral bootstrap,
  verification/reducer, lease-checked decision/effect apply, and the exact
  five-export governed-error/journal surface. Its bootstrap function alone
  owns certified A2 M0/M1 structural completion/verification and the exact
  `CDX-B2` marker insert; it performs no semantic CDX row mutation, and its
  other operations perform no CDX DML.
- **Add `src/governed-memory-bridge.mjs`** — sole production A1 owner;
  authority reserve/check, canonical patch, Admit/Resolve/Apply, target
  classifier, paired B2/A2 plan, legacy-compatible result translation, and the
  exact two-export/frozen-three-method internal surface.
- **Modify `src/legacy-mutation-router.mjs`** — remove production coordinator
  ownership/`execute`; retain the exact historical three-method
  capture/planning surface under test-owned A1; add the exact lease-bound,
  zero-key branded zero-link erasure projection prepare/apply pair needed by
  the bridge. Production imports no historical router/structural applier.
- **Modify `src/kernel-store-runtime.mjs`** — atomic B2 bootstrap/checkpoint,
  exact manifest allowlist, authority audience bind/retire, bridge
  construction, exact `executeGovernedStoreIntent` replacement for the
  removed legacy adapter, and immediate async terminal refusal in the runtime
  export itself with no filesystem-delete implementation left reachable.
- **Modify `src/gate.mjs`** — safe refusal surfaces, separate grant argument
  only for `deleteMemory`, and no authority inference/disclosure.
- **Modify `src/store.mjs`** — construction-time root/provider plumbing and
  retain the runtime terminal-refusal export as the public async alias.
- **Modify producer modules only as needed** to preserve deterministic refusal
  shapes. M3, not M2-B, restores trusted create/supersession behavior.
- **Add focused tests** for authority, registry, schema/journal, bridge,
  atomicity, every producer, terminal deletion, instrumentation, and complete
  failure/replay matrices.
- **Modify `tests/memory-bundle-coexistence.contract.test.mjs` only as a
  separately reviewed source-inventory/static-graph accommodation** for the
  exact M2-B modules and imports. This is not a B1 behavioral or capability
  change; all protected B1 production bytes and behavioral assertions remain
  unchanged.
- **Do not modify** `docs/MEMORY-BUNDLE-CONTRACT.md`, any of the seven
  `src/memory-bundle*.mjs` files, or `src/memory-store.mjs`.

---

## Task 0 — Seal the M2-B contract cut point

**Files:** documentation/status only; production/tests remain unchanged.

- [x] Confirm branch `codex/v2-m2-b-governance` starts at certified A2
  `53e5b03` and contains no unrelated work.
- [x] Pin every Unified/A1/A2/B1 provenance value and the complete reference
  patch registry/config record/hash.
- [x] Seal `host-checked-external-grant-v1`: no root verbs; exact host event
  identifiers; native issue/use time; synchronous per-attempt revocation
  predicate after capture; one-lifetime audience; one-decision grant; exact
  error/precedence and A1 settlement table.
- [x] Seal only `ratify|ratified_user` erasure. Explicitly reject source
  laundering, demotion, edge writes, shared/general scope, and every other A2
  semantic mutation.
- [x] Mechanically validate the exact 46-row, 22-dimension registry: no
  wildcard, all next references resolve, and only D-02/D-03 can map.
- [x] Seal exact four-table/one-index/eight-autoindex/three-FK/eleven-trigger
  SQL plus complete bootstrap/reducer/verifier and raw-SQL honest limits.
- [x] Execute the documented SQL on exact runtime and exercise applied/refused,
  immutability, tail, and head guards.
- [x] Obtain three fresh independent read-only reviews: Unified/authority;
  SQLite/atomicity/replay; exhaustive registry/API executability. Resolve every
  blocker and major; record accepted minors.
- [x] Run formatting, provenance, protected-byte, link, runtime, and unchanged
  432-test checks.
- [x] Update `STATUS.md`, `docs/DECISIONS.md`, `docs/KERNEL-CONTRACT.md`,
  `docs/KERNEL-API.md`, and `docs/MUTATION-SEAM-CONTRACT.md`; commit/push a
  coherent documentation cut point with parent M2/M2-B still open and Next
  naming Task 1.

## Task 1 — Authority root, audience, and erasure grant

### M2-B-01 RED

- [x] Pin exact public/internal module namespaces and every error/message.
- [x] Reject Proxy/accessor/inherited/extra/coerced inputs at exact ordinals.
- [x] Prove roots/grants/audiences/reservations are frozen, zero-key, branded;
  serialization/cloning cannot preserve authority; and no capability appears
  in an ordinary returned surface.
- [x] Prove the primitive one-lifetime bind and synchronous retirement law with
  synthetic generation audiences; a retired audience requires a new root.
- [x] Prove exact identifier/timestamp grammar, native clock high-water, issue
  chronology, expiry equality, local revocation, identifier non-reuse, and
  immutable exact target/verb/audience.
- [x] Reserve before caller traps; invoke captured predicate exactly once
  after capture; validate predicate/provider only as non-Proxy
  `typeof === 'function'`; supply `thisArgument` undefined without overriding
  bound receivers; allow no callback/async boundary from final recheck through
  A1; test same-grant reuse, reentrant close/revoke, callback throws/classes,
  exact `throw undefined`/`throw null` presence flags and cause descriptors,
  and protocol failures. Cross-grant store reentry is a violated trusted-host
  precondition and receives no hostile-host claim.
- [x] Prove final bind accepts the established sequence-one authority-ledger id,
  rejects a mismatch, and treats head zero as an unpersisted candidate.
- [x] Prove the release, authorized-burn, and root-retirement primitives needed
  by the exhaustive later A1 settlement matrix.
- [x] Static-test that proposal/model-facing modules do not import or disclose
  authority constructors/runtime capabilities.

### M2-B-01 GREEN

- [x] Implement captured-primordial WeakMap state and exact public wrapper.
- [x] Keep bind/retire internal for the later pre-publication/close lifecycle;
  no current proposal, model, producer, or public store surface imports them.
- [x] Run focused tests and inspect dynamic import namespaces.

Task 1 certifies the seven lifecycle/settlement primitives with synthetic
generation, ledger, and decision-boundary fixtures. Actual store publication,
close ordering, B2 ledger establishment/races, and A1 result settlement remain
the explicit integration falsifiers in Tasks 3, 5, and 6; no premature runtime
wiring is claimed by these checked boxes.

## Task 2 — Executable disposition registry

### M2-B-02 RED

- [x] Parse the sealed A2 IDs/dimensions and normative B2 registry; require
  exact 46-ID order/equality and exact 22 positional values per registry row.
- [x] Expand every named finite set; reject missing/unknown/duplicate values,
  unresolved references, wildcards, overlapping terminal results, and graph
  cycles that are not explicitly allowed.
- [x] Assert closed disposition/reason/recording/authority vocabularies.
- [x] Assert exact MAP allowlist `['D-02','D-03']`; PD-02 always refuses.
- [x] Exhaustively test the exact staged authority vocabularies: pre-capture
  preflight, exact retained-error `RETHROW` on capture failure, post-capture
  local/activity outcome, then
  projection and missing/scope/shared/link/applied transition precedence.
- [x] Reject every impossible cross-phase authority combination; constructor/
  issuance-only authority errors are not mutation-call outcomes.
- [x] Cross-check all five A2 intents, eight explicit effects, producer result
  shapes, and terminal storage branches.

### M2-B-02 GREEN

- [x] Implement a frozen data-only source registry generated/checked against
  the documentation artifact; bridge consumes it rather than duplicating an
  allowlist.

## Task 3 — Exact B2 schema and atomic checkpoint

### M2-B-03 RED

- [ ] Pin canonical config bytes/SHA-256, exact DDL, normalized persisted SQL,
  table/index/trigger/FK/xinfo manifests, and case-fold collision set.
- [ ] Checkpoint empty/nonempty CDX across all three physical memory orders:
  exact ordinal blocks and memory/link union, binary order, endpoint closure.
- [ ] Trace canaries from every excluded payload-bearing column and prove no B2
  scalar contains them; do not use an impossible whole-file byte claim.
- [ ] Force failure at each create/snapshot/meta/checkpoint/trigger/marker/
  verify/commit ordinal; require no partial B2 and untouched M0/M1 on rollback.
- [ ] Reject marker/schema mismatch, partial/case/extra objects, altered SQL,
  checkpoint mutation, TEMP triggers, wrong PRAGMAs, and all repair attempts.
- [ ] Permit only the certified ordinary A2 M0/M1 completion step before B2;
  prove partial or malformed B2 is never repaired.
- [ ] Commit a first decision to establish the stream ledger id, then prove a
  second/reopened-root decision with another ledger id cannot append or
  advance.
- [ ] Prove complete reopen performs no clock/id/DDL/DML and old A2 open fails
  on the exact three-row migration set.

### M2-B-03 GREEN

- [ ] Implement dependency-leaf schema plus captured-native initializer and
  complete pre-publication verifier.
- [ ] Implement the journal bootstrap's sole structural exception: after B2
  absence classification, run certified M0/M1 completion/verification, then
  B2 snapshot/create/checkpoint/marker/verification under the same A1 lease;
  permit no semantic CDX memory/link/FTS-row DML.
- [ ] Extend runtime allowlists only by the exact reviewed B2 manifest.

## Task 4 — Append-only journal, reducer, and transition

### M2-B-04 RED

- [ ] Pin exact applied/refused decision matrices, authority ids/times,
  sequence/head, effect ordinals, hashes, and nondecreasing observed time.
- [ ] Mutate every B2 field/object/index/trigger/FK and require deterministic
  failure before use.
- [ ] Prove raw update/delete, gaps/extras, wrong tail, wrong cardinality,
  wrong target/state, duplicate authority/capability/target ids, and config
  drift fail closed.
- [ ] Recompute exact target classification and reference Admit/Resolve plus
  specialized pure Apply on every decision.
- [ ] Replay checkpoint+journal and compare exact in-scope CDX memory/scope/
  type/shared/validity class, link ids/endpoints, and FTS membership.
- [ ] Demonstrate every listed content/metadata blind spot explicitly.

### M2-B-04 GREEN

- [ ] Implement transaction-neutral complete verifier/reducer and
  lease-checked append applier with no transaction control or CDX DML.

## Task 5 — Production bridge and ratified erasure

### M2-B-05 RED

- [ ] Prove bridge is sole production A1 owner and router `execute` is absent
  from every production root.
- [ ] Pin the exact seven-export router namespace, exact historical
  `['apply','capture','resolve']` instance, and governed projection token:
  null prototype, frozen, zero-key, same db/lease/id, one-use, exact error
  translation, one delete, one-row cardinality, and exact `undefined` return.
- [ ] Validate/reserve authority before legacy id/options trap; capture before
  activity check; check before A1; no untrusted operation during A1.
- [ ] Assert exact patch bytes/Admit C1–C8/full resolver and demonstrate that
  caller actor/policy/confidence/source/time cannot affect them.
- [ ] Seed permanent/transient × own/general/shared/cross-user/cross-Palari ×
  current/ended × zero/multiple links; accept only exact private zero-link own
  targets with exactly one FTS row.
- [ ] Commit exact target refusals under valid grants and no decision for all
  pre-gate authority/compatibility refusals.
- [ ] Require applied receipt order atom then FTS and exactly one branded CDX
  delete; prove link set unchanged.
- [ ] Force every decision/effect/projection/postcondition/head/commit ordinal;
  prove all-or-nothing B2/CDX and exact grant release/burn/retire state.
- [ ] Close/reopen with a new root and a lower native observed time; require
  the post-verifier/pre-nonce `governance_clock_invalid` ordinal, rollback,
  bridge poison, and authority retirement rather than a generic trigger error.
- [ ] Publish two zero-head generations with different ledger candidates;
  after one establishes sequence one, require the loser's next A1 attempt to
  roll back as `authority_scope_mismatch`, append no decision, and retire its
  incompatible root/audience.
- [ ] Observe from a second connection: neither side before commit, both after.

### M2-B-05 GREEN

- [ ] Refactor A2 into transaction-neutral historical planner/projection
  applier with test-owned coordinator.
- [ ] Implement the governed prepare/apply projection pair, exact
  patch/transition/paired plan, and route production deletion only through the
  bridge.

## Task 6 — Refuse the rest of the production graph

### M2-B-06 RED

- [ ] Replay every A2 golden branch, producer, batch, implicit consequence,
  trap, and effect ordinal through the production surface.
- [ ] Require create/duplicate/supersession/link/demotion/share/topic/recall/
  lifecycle/extraction/summary/scheduler paths to produce their exact refusal
  shape and zero CDX mutation.
- [ ] Prove disabled/liveness/authority/input precedence and absence of
  authority inference or disclosure.
- [ ] Instrument both direct runtime and public terminal delete exports; prove
  each immediately returns a native Promise rejected with the same exact
  error, observes no options/path, and calls no filesystem function for
  F-01/F-02/F-03. Prove the old `rm` path is unreachable/removed.
- [ ] Extend the existing `LegacyMutationError` vocabulary from exactly twelve
  to exactly thirteen pairs with only `legacy_terminal_storage_refused` and
  its pinned message; re-prove every old pair and unknown-code constructor law.
- [ ] Prove manager root provider is trusted/synchronous, called outside every
  transaction only for enabled creation, never returned, and retired on all
  publication/close races.

### M2-B-06 GREEN

- [ ] Rewire gate/store/manager/producers to safe refusal surfaces and the
  separate delete grant argument.
- [ ] Reject with exact `legacy_terminal_storage_refused` from the async
  runtime function before option capture; keep the public export as its alias.
- [ ] Update static graphs only for the reviewed modules/edges.

## Task 7 — Complete M2 production falsifier and certification

- [ ] Run focused authority/registry/schema/journal/bridge/terminal suites.
- [ ] Run A1, historical A2 planner, exact B1, pre-M2 regression, complete
  production matrix, static source graph, and full suite repeatedly.
- [ ] Review the bounded coexistence source-inventory test diff separately and
  prove it only classifies the exact M2-B modules/edges; protected B1 behavior,
  capabilities, and production bytes remain unchanged.
- [ ] Verify exact Node/SQLite and zero dependency/provenance drift.
- [ ] Compare protected B1/raw extraction bytes to `1d65bb0`; review any
  test-inventory-only B1 diff separately.
- [ ] Obtain three fresh final reviews: spec/authority; exhaustive producer
  closure; SQLite/atomicity/replay. Resolve every blocker and major.
- [ ] Update docs/status with exact counts/hashes/commits/nonclaims and Next M3.
- [ ] Commit coherent cut points as `BRAIN V2-M2-B: ...`, push the branch, then
  fast-forward/push `main` only after the full conjunction passes.

Expected final M2 state: exact ratified private zero-link erasure co-commits;
every other current semantic mutation refuses; no supported in-file production
bypass remains; CDX-M1 is still runtime/read authority; exact B1 is unchanged/
non-authoritative; U8 remains sealed; Next is V2-M3.

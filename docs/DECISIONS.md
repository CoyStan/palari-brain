# Decisions

Append-only. Founder decisions and license verdicts land here with
dates. Agents record; the founder decides.

- 2026-07-18 (FOUNDER — Quetzali, in session) Repo license: **MIT**,
  Copyright (c) 2026 CoyStan (matching palari-company-os). LICENSE
  file added.
- 2026-07-18 (FOUNDER — Quetzali, in session: "use MIT, i agree with
  the rest") **U8 live slice GO approved**: dataset
  longmemeval_s_cleaned.json, model gemini-2.5-flash-lite, spend cap
  per estimate (<$1). Classic LongMemEval remains the target (V2
  noted, not adopted). This entry is the recorded spend
  authorization; PALARI_CONFIRM_SPEND=1 for the run executes it.
  Publish gate (U12) remains CLOSED: the repo is PUBLIC, so no
  scores/results enter git — raw outputs and the graded report stay
  in gitignored evals/results/ until the founder opens U12.
- 2026-07-18 (U6, Fable 5, recorded) **LongMemEval license verdict:
  MIT — our use is PERMITTED.** Verified at two sources before any
  download, per charter law: (1) the canonical repo
  github.com/xiaowu0162/LongMemEval LICENSE file — MIT, © 2024 Di Wu,
  standard grant text quoted and checked; (2) the official dataset
  card huggingface.co/datasets/xiaowu0162/longmemeval-cleaned —
  "License: MIT", no gating or extra terms. Canonical citation: Wu,
  Wang, Yu, Zhang, Chang, Yu — "LongMemEval: Benchmarking Chat
  Assistants on Long-Term Interactive Memory", ICLR 2025
  (arXiv:2410.10813). 500 questions; files longmemeval_oracle.json /
  longmemeval_s_cleaned.json / longmemeval_m_cleaned.json (~3 GB
  total on HF). Local benchmarking with no dataset redistribution in
  git complies; data/ stays gitignored. Download itself is deferred
  until a unit needs it (U8 prep at the earliest). NOTE for founder:
  a LongMemEval-V2 now exists (github.com/xiaowu0162/LongMemEval-V2);
  the queue targets classic per the charter — switching or adding V2
  would be a founder decision.
- 2026-07-18 (U3, Fable 5, recorded) Test runner is node:test +
  node:assert, zero dependencies — "the kernel is the code" wants a
  minimal proof surface (`git clone && npm test`, nothing but Node).
  Cost accepted: v05's vitest memory tests are re-homed by rewriting
  (U1 showed 2 of 6 needed rewriting anyway). Binds U4/U5/U7.
- 2026-07-18 (U3, Fable 5, recorded) Engine floor Node >=22.5 for
  node:sqlite + FTS5 unicode61; verified on v22.22.2 (works unflagged,
  one ExperimentalWarning — a known, self-probed risk: the baseline
  driver probe throws early on tokenizer mismatch). Do not swap to
  better-sqlite3 silently; that would be the repo's only non-builtin
  dependency and needs its own recorded decision.
- 2026-07-18 (U8, Fable 5, recorded) **First live invocation failed
  authentication before scoring and produced no result file.** The
  project-local credential was an AI Studio authorization key supplied
  as `GEMINI_API_KEY=...`; the file was normalized without logging the
  value. The runner's legacy `?key=` query transport received
  `API_KEY_INVALID`. Current Gemini REST documentation uses the
  `x-goog-api-key` header, so transport was corrected to keep the key
  out of URLs. This does not change prompts or predictions. The runner
  now also retries only transport failures, aborts rather than treating
  exhausted provider errors as empty memory, and checkpoints completed
  questions so model outputs are never re-rolled after interruption.
- 2026-07-18 (FOUNDER — Quetzali, in session) **U8 model amendment:
  use Gemini 3.1 Flash-Lite; spend cap $1.25.** After header auth was
  corrected, a non-scoring probe proved the key valid but returned
  `404 NOT_FOUND`: Gemini 2.5 Flash-Lite is no longer available to new
  API users. Google documents `gemini-3.1-flash-lite` as the stable
  successor. The recalculated paid-tier estimate is ~$1.06 for the
  sealed slice. This amendment occurred before any benchmark score or
  result file; dataset, slice, prompt hash, and outcome predictions stay
  unchanged. Publish gate remains CLOSED.
- 2026-07-18 (FOUNDER — Quetzali, in session: "Complete last question
  running and then do not run next question") **U8 execution PAUSED.**
  The active question was allowed to checkpoint, then the runner was
  terminated before any final-question result was recorded. State is
  9/10 checkpointed; `1568498a` remains incomplete. Do not resume without
  a new explicit founder GO. Completed outputs remain sealed against
  re-rolls; publish gate remains CLOSED.
- 2026-07-18 (FOUNDER — Quetzali, in session) **Palari Brain v2 pivot
  RATIFIED with standing local implementation authority.** Quetzali
  authorized the standing agent to choose and implement the strongest
  local engineering path without repeated approval, test each milestone,
  commit/push coherent cut points, and continue while the evidence says
  GO. Only GPT-5.6 Sol-inherited orchestration may be spawned. U8 remains
  sealed as a 9/10 failed reference baseline; `1568498a` stays unrun,
  completed outputs are never re-rolled, and publish/live-spend gates
  remain closed unless separately and explicitly reopened.
- 2026-07-18 (FOUNDER-RATIFIED ARCHITECTURE — recorded after two
  adversarial GPT-5.6 Sol workflow panels) **M1 substrate: one governed
  bundle inside the existing per-workspace SQLite file.** M1 adds
  content-free append-only decision events, immutable-while-present and
  governedly erasable canonical atom payloads, exact-sequence conflict
  checks, deterministic current-state replay, and a read-only verifier.
  It is a coexistence proof only: CDX-M1 remains runtime truth; no dual
  write, gate cutover, graph/vector driver, provider call, benchmark run,
  physical-deletion claim, cryptographic audit claim, or publication.
  The former U9/U10 spend queue is deferred. After M1 passes, M2 may
  refactor the one-connection transaction seam and close every semantic
  write bypass before any runtime cutover.
- 2026-07-18 (V2-M1, recorded) **Provisional M1 implementation floor is
  Node >=22.22.2.** This is the lowest runtime exercised for the
  pre-implementation Node/SQLite probes, including stable
  `DatabaseSync.isTransaction` use and bundled SQLite 3.51.2 behavior. It
  is a conservative selected floor, not yet certification that the
  unimplemented M1 acceptance suite passes there and not a claim about the
  earliest release containing each API. `package.json` therefore narrows
  the earlier U3 theoretical `>=22.5` floor. This entry becomes certified
  only after the complete bundle and regression suite pass on that exact
  release; a lower floor requires the same complete run.
- 2026-07-18 (V2-M1 strict pre-implementation review, recorded) **The
  first CDX-B1 normative cut point was rejected and not implemented.** The
  executable review proved two manifest defects: SQLite three-valued CHECK
  logic accepted refused events with NULL reasons, and default
  `recursive_triggers=OFF` let `INSERT OR REPLACE` rewrite committed
  meta/event/atom state without changing the checkpoint. The corrected
  contract requires explicit non-NULL refusal reasons,
  `recursive_triggers=ON` and `ignore_check_constraints=OFF` on every
  module-owned bundle connection and writable borrowed connection,
  safe-integer sequences, byte-defined keyword
  order, exact atom/replay and
  module shapes, deterministic error precedence, and provisional—not
  certified—Node wording. The same review also narrowed the historical U4
  claim: candidate writes are gated, but ownership/lifecycle/touch/link
  bypasses remain non-conforming debt assigned to V2-M2.
- 2026-07-18 (V2-M1 final pre-implementation review, recorded) **CDX-B1
  contract received strict PASS; implementation is ready to plan, not yet
  complete.** Four adversarial correction rounds and pinned Node
  22.22.2/SQLite 3.51.2 probes closed the remaining blockers: native
  DatabaseSync branding and captured dispatch; trap-free Proxy rejection;
  intrinsic callback/Date semantics; receiver-independent public handles;
  separate main-qualified executable SQL and persisted SQL manifests;
  borrowed-connection TEMP-trigger rejection plus complete main-trigger
  target inventory; create-disabled writable hot-journal recovery before the
  final read-only handle; scalar-valid head CAS; retained-scope delete
  authorization; and distinct decision/proposal duplicate codes. The closed
  M1 vocabulary is now 19 codes. This PASS authorizes local TDD under the
  founder's standing v2 authority; it does not certify the unimplemented
  suite, change CDX-M1 runtime authority, reopen U8/live spend, or authorize
  publication.
- 2026-07-20 (V2-M1 reviewed process exception) **Commit 4d9242c amended the
  sealed CDX-B1 contract after implementation exposed SQLite's
  ASCII-case-insensitive identifier-collision ambiguity.** The amendment
  requires ASCII-folded candidate discovery while preserving the exact BINARY
  canonical inventory, so case-variant and mixed-case bundle objects fail
  closed. This was a security-tightening clarification, not a public API,
  authority, capability, or runtime-scope expansion. It is recorded explicitly
  because the normative contract changed after the normative contract seal
  ea83e15 (implementation-scope base 280d3d0); all other implementation paths
  remained within the approved M1 scope.
- 2026-07-21 (V2-M1 certification, implementation commit 3cdef74)
  **The declared floor remains Node >=22.22.2 and is now certified on exact
  Node v22.22.2, whose bundled SQLite is 3.51.2.** Certification was earned
  only after every dedicated M1 contract file and the complete zero-dependency
  repository regression suite passed on that exact runtime: 208 tests, zero
  failures. The public namespaces remain exactly three apply exports and one
  read export, and the same-file coexistence proof leaves CDX-M1 as runtime
  authority with no dual write. This does not establish a lower supported Node
  floor or certify every later Node release. It also does not upgrade any
  all-false bundle capability: `sourceOfTruth`, `physicalDeletion`,
  `deletionProvable`, `signed`, `cryptographicAudit`, and
  `externalAnchorRequired` remain false. No live or network provider call,
  benchmark scoring run, sealed U8 continuation, real dataset, result write,
  or publication path participated in certification; dry and synthetic
  regression coverage did run.
- 2026-07-21 (V2-M2 pre-implementation boundary, corrected after three
  independent read-only audits) **M2 is staged as A1 transaction ownership,
  A2 legacy compatibility routing, then B production governance co-commit.**
  The rejected broad draft incorrectly treated a private B1/CDX composition
  proof as sufficient for M2 and mapped current operations onto a canonical
  patch vocabulary without a trusted authority root. A1 now adds only the
  hardened coordinator and private composition falsifier. A2 must close the
  current CDX bypass matrix while naming its inputs honestly as legacy
  compatibility intents. M2-B—not M3—must bind minimal trusted authority
  outside caller/model proposals; define a provenance-pinned,
  Unified-Spec-conforming governed operation contract; import existing CDX
  state through an explicit legacy checkpoint; and co-commit a disjoint CDX-B2
  decision/effect journal with production CDX effects. Every A2 legacy
  intent/effect must map to a valid governed operation or deterministic refusal;
  its compatibility labels never become B2 vocabulary. B must preserve
  lifecycle demotion, permanent canonical immutability, distinct creation
  confidence/evidence strength, and a corrected canonical type partition, and
  cannot invent founder-amendable patch constants. Exact CDX-B1 cannot encode
  the full matrix and remains unchanged; B2 object names must not match
  `memory_bundle_*`. CDX-M1 remains runtime/read authority and all six B1
  capabilities remain false. V2-M3 retains strict extractor schema, evidence
  derivation/widening, assistant evidence, supersession repair, and complete
  candidate observability, but cannot waive this M2 map-or-refuse falsifier.
  This sequencing is within the founder's standing local v2 authority; it is
  not a source-of-truth cutover, provider/spend, deletion, benchmark, or
  publication decision.
- 2026-07-21 (V2-M2-A1 post-seal exact-shape clarification) **The coordinator
  exact record and opaque lease now have explicit complete own-key sets.** The
  sealed plan already required an exact frozen `{ run }` record, no exposed
  symbol, and an empty opaque lease, while the normative prose constrained only
  enumerable keys. Implementation-test reconnaissance caught that mismatch
  before production code existed. The coordinator is now exactly `['run']` by
  `Reflect.ownKeys`; a lease has no own keys at all. This narrows and makes
  executable the already-reviewed encapsulation claim; it adds no runtime
  adoption, mutation semantics, authority, journal, provider, or publication
  scope.
- 2026-07-21 (V2-M2-A1 acceptance-conjunction correction, independently
  reviewed) **One exact B1 coexistence source-inventory assertion must recognize
  the new A1-isolated module.** The sealed A1 contract simultaneously required
  exact `src/mutation-coordinator.mjs`, a green full suite, and byte-identical
  dedicated B1 tests. The existing coexistence test exhaustively classifies
  every top-level `src/*.mjs`, making those three requirements mechanically
  incompatible. Its sole permitted B1-test diff adds exact
  `A1_ISOLATED_SOURCE_FILES = ['mutation-coordinator.mjs']`, keeps that module
  outside both the legacy and B1 categories, and asserts node-only/B1-unaware
  imports. B1 production, normative contract, helpers/fixtures, every other B1
  test, and all other coexistence B1 behavioral assertions remain unchanged.
  This repairs an impossible test-inventory conjunction; it changes no B1
  behavior, API, authority, capability, transaction, or runtime-adoption claim.
- 2026-07-21 (V2-M2-A1 certification; implementation `07d65ad`; three fresh
  independent read-only audits) **The isolated synchronous transaction
  coordinator and private real B1/CDX composition falsifier pass their bounded
  contract.** The internal module has exactly three exports, captured native
  SQLite dispatch, five enforced PRAGMAs, one outer `BEGIN IMMEDIATE`/`COMMIT`,
  opaque lexical leases, twelve deterministic failure codes, verified rollback
  cleanup, and permanent poison on uncertain ownership/outcome. The private
  file-backed proof co-applies unchanged B1 and the real transaction-neutral CDX
  insert, showing neither to an observer before commit, both (including FTS)
  after commit, and neither after a forced joint rollback. On exact Node
  22.22.2 / SQLite 3.51.2, coordinator+composition pass 31/31, the pre-A1 suite
  208/208, full B1 161/161, and the full suite 239/239. At that certification
  cut point the coordinator was the sole new production file and no runtime
  module imported it; A2 now adopts it beneath the private legacy router.
  Protected B1 files remain byte-identical to `616c60b`; the sole coexistence-
  test change is the separately reviewed A1-isolated source classification.
  A1 itself did not close a CDX durable bypass, prove native transaction
  identity, define trusted authority/canonical operations/B2, complete parent
  M2, or authorize provider, spend, benchmark, publication, or sealed-U8 work.
  CDX-M1 stayed authoritative; exact B1 stayed unchanged/non-authoritative; the
  next unit at that cut point was M2-A2 compatibility routing.
- 2026-07-21 (V2-M2-A2 pre-implementation boundary, after complete mutation
  and producer recon) **A2 is a five-intent/eight-effect compatibility router,
  not a canonical patch layer.** The complete baseline graph contains more
  mutation capability than the frozen U4 facade exposed: raw insert, link,
  importance, touch, schema, database, and manager surfaces; separate
  provenance autocommits; nested-transaction supersession; and partial
  recall, lifecycle, and topic batches. A2 therefore retires raw returned
  insert/add/supersede/link/bump/touch and `.db` capabilities, admits exactly
  `legacy_proposal`, `legacy_delete_memory`, `legacy_forget_topic`,
  `legacy_record_recall_inclusion`, and `legacy_run_lifecycle`, and applies
  only the eight effects enumerated in
  `docs/LEGACY-MUTATION-ROUTING-CONTRACT.md`. Plans resolve database-dependent
  choices after A1 `BEGIN IMMEDIATE`, bind to its lease, materialize all
  ordered effects before DML, and expose results only after commit. CDX-M1
  schema completion moves to serialized pre-handle bootstrap. The extracted
  raw factory cannot close a connection when its own bootstrap throws before
  returning, so A2 production imports none of `src/memory-store.mjs`: a new
  runtime owns captured-native construction, the exact three-variant
  `CDX-M1-runtime@1` manifest, complete FTS/FK/trigger verification,
  rollback/close cleanup, reads, and canonical-path registry directly. Caller
  clocks run only before A1 entry; resolver reads and effect writes use
  captured native dispatch; a closed 12-code `LegacyMutationError` law composes
  beneath unchanged A1 failure precedence. Whole-workspace
  destruction cannot truthfully co-commit with a journal inside the file it
  removes, so it remains a separately serialized terminal operation requiring
  zero supported live handles. A2 therefore closes the supported in-file raw
  writer graph but does not claim overall one-gate conformance. Under the
  current same-file B2 premise, M2-B must refuse terminal destruction unless
  an explicitly authorized external authority/receipt substrate changes that
  premise. Caller inputs and plans remain unauthenticated compatibility data;
  every semantic branch/effect/consequence is carried to M2-B for governed
  map-or-refuse. CDX-M1 remains runtime/read authority, exact B1 remains
  unchanged/non-authoritative, and no provider, sealed U8, spend, dataset,
  result, or publication action is authorized.
- 2026-07-21 (V2-M2-A2 certification; implementation `e6bbc51`; hardening
  `d419fef`; three fresh independent final audit disciplines) **The supported
  in-file CDX-M1 raw writer graph is closed as a bounded legacy compatibility
  layer, not as canonical one-gate conformance.** Exactly five legacy intents
  resolve after A1 `BEGIN IMMEDIATE` to plans containing only eight
  lease-checked CDX effects. Safe base/gated handles expose no raw connection
  or child semantic writer; the module-constructed frozen manager returns only
  branded gated handles; all supported extraction, summary, scheduler,
  adapter, recall, ownership, topic, and lifecycle producers are structurally
  bound to that route. CDX-M0/M1 schema completion plus the exact runtime
  manifest occur before handle publication. Terminal whole-file deletion stays
  outside the router as a canonical-path-serialized, zero-live-handle storage
  operation; under the current same-file premise M2-B must refuse it unless a
  separately reviewed external authority/receipt substrate is authorized.
  Signed finite zero is canonicalized to numeric `+0` before plans are
  materialized so immediate public rows equal SQLite projections. On exact
  Node 22.22.2 / SQLite 3.51.2, router+routing pass 63/63, the manifest matrix
  97/97, all B1 tests 164/164, pre-A2 regressions 272/272, the full suite
  432/432, and the static M2-A2-07 audit 3/3, all with zero failures.
  `docs/MEMORY-BUNDLE-CONTRACT.md`, all seven `src/memory-bundle*.mjs`
  production modules, and the quarantined `src/memory-store.mjs` remain byte-
  identical to `1d65bb0`; separately changed B1 test harnesses were reviewed
  and pass. The final reviews left no unresolved blocker or major. This does
  not authenticate callers, repair legacy semantics, define canonical patches
  or a trusted authority root, add B2 decisions/journaling/co-commit, make B1
  authoritative, govern terminal deletion, complete parent M2, or authorize a
  provider, sealed U8 question, spend, dataset, result, publication, or
  announcement. CDX-M1 remains runtime/read authority; exact B1 remains
  unchanged and non-authoritative; Next is M2-B contract work.
- 2026-07-21 (V2-M2-B pre-implementation structural-kernel ruling) **Ratified
  private zero-link atom erasure is an explicit, narrowly scoped Apply
  amendment, not behavior silently attributed to the reference kernel.** The
  pinned patch registry contains `ratify|ratified_user -> provenance` at
  evidence strength `1.0` and ledger permission rank `1`, but the reference
  Apply implementation has no `ratify` handler. Part 4 separately requires
  storage erasure to be ratified and requires an erased atom's sidecars to be
  erased in the same operation; it does not supply the missing pure
  transition. M2-B records profile `FB1-4.ratified-erasure-apply-v1`: after
  exact trusted authority, Admit, and singleton Resolve, one present,
  same-Palari, same-user, private atom with exactly one FTS row and zero
  incident links may have its atom and FTS memberships consumed. Type and
  current/ended validity are not erasure selectors. For a permanent atom this
  is explicit storage erasure, not payload update or correction, so
  demote-and-promote linearity is unchanged; the content-history survival
  claim is deliberately not made after user-ratified erasure. `ratify` is
  selected because this is ceremonial user consent and is the registry's only
  registered `ratified_user` pair; calling it `demote` would launder the
  source. The amendment changes no patch kind/source/priority/threshold,
  permits no link cascade or other structural write, and grants no demotion,
  shared/general/cross-scope erasure, payload correction, or general `ratify`
  Apply behavior. Those remain refused or require a new reviewed amendment.
  CDX-M1 remains runtime/read authority; exact B1 remains unchanged and
  non-authoritative; this ruling authorizes no provider, sealed U8, spend,
  dataset, score, publication, or announcement action.
- 2026-07-21 (V2-M2-B reviewed contract cut point) **M2-B will implement one
  trusted, one-use ratified-erasure path and deterministically refuse every
  other current semantic mutation; it will not reinterpret legacy authority
  or silently widen the reference patch kernel.** The normative contract set
  is pinned by SHA-256: bridge
  `a7c5cbff9eb49171b4358b50df6cbebcf77bc0e60478e75df72e345999ea6b7e`,
  authority
  `288b10fb30712a7ca862f773fca74aaf4898ef5992495ac858564b511062eb95`,
  disposition registry
  `d34106fedb1997a1bc03fa88f0479209a6c5d42fc9bb62038a6682ce9e6b8eee`,
  and B2 schema
  `90c64965f88aa48959f935be01f1c62d1a9c8844e5657cadd6e0e5702b9397d4`.
  The canonical config is 5,704 ASCII bytes with SHA-256
  `e1ded27e33516d73c60da1f4a4c9cb0767b1bb0b1482e78b429449ec7c0b07f4`.
  Registry `CDX-M1-legacy-disposition@5` proves 46 obligations, 22 dimensions,
  72 staged-authority cases, and 1,728 erasure cases; only D-02/D-03 map.
  Profile `host-checked-external-grant-v1` has no root verb, binds one root to
  one store generation and one stream ledger, checks external activity on
  each attempt after caller capture, and distinguishes thrown-value presence
  from value so even `throw undefined` is preserved exactly. Valid target
  refusals and an applied erasure burn one grant only after the B2 decision
  commits; proven rollback releases; uncertainty retires.

  CDX-B2 is exactly four tables, one explicit index, eight autoindexes, three
  foreign keys, and eleven triggers. Its journal bootstrap alone owns the
  certified structural M0/M1 completion/verification and B2 marker inside the
  bridge-owned A1 transaction; it never owns semantic CDX row DML. The exact
  seven-export historical router gains a zero-key, lease/database-bound,
  one-use governed projection token; production removes router `execute` and
  `executeLegacyStoreIntent`, and only the governed adapter reaches the
  bridge. Terminal deletion refuses in the runtime export itself with the
  compatibility-preserving immediately rejected Promise and the sole new,
  thirteenth `LegacyMutationError` pair; the old `rm` route is removed.
  Content/metadata blind spots, same-file non-cryptographic limits, and the
  trusted-host premise remain explicit nonclaims. Three final independent
  reviews ended with zero blockers/majors; executable registry/config/SQL,
  local-link, provenance, protected-byte, and full unchanged 432/432 tests
  pass on Node 22.22.2 / SQLite 3.51.2. This cut point changes no production or
  test file, leaves parent M2/M2-B open, keeps CDX-M1 runtime/read authority
  and exact B1 unchanged/non-authoritative, and advances only to Task 1
  authority implementation. It authorizes no provider, sealed U8, spend,
  dataset, score, publication, or announcement action.
- 2026-07-21 (V2-M2-B Task 1 post-seal exactness clarification) **The RED
  authority matrix made three previously implicit edge ordinals executable;
  the reviewed operation set and canonical configuration are unchanged.** A
  burn-eligible reservation must first have returned an authorization
  snapshot; premature or stale burn is `authority_invalid_argument`, repeated
  release is a no-op, and an old reservation cannot affect a newer one. A
  sampled authority clock is a primitive finite integer millisecond that
  renders to the exact 24-character native ISO form, and its high-water mark
  advances before later chronology/expiry rejection. Finally, two generations
  published at B2 head zero may carry different ledger candidates: after one
  establishes sequence one, the loser's next A1 attempt compares the verified
  ledger before clock, nonce, or ID work, rolls back as exact
  `authority_scope_mismatch`, appends nothing, and retires the immutable
  incompatible root/audience; A1 uncertainty still wins. The exact A1
  sequences and acceptance proof now carry that race rather than relying on a
  later SQL trigger. These clarifications supersede only the affected prose
  hashes from the Task 0 cut point: bridge
  `25e9eeb1b902582a72ddc9d60c46f437c886afeac5e33ce0288c142e3927fe27`,
  authority
  `f4c87eda57059bf1b44d2640471f29f68ae6acf3af128a5142717f711fed75c9`,
  and B2 schema
  `84f01ae2b5bdf084cacf27b8d6e6d3a611852094e985c36aaa18bba8baa2813e`.
  Disposition-registry hash
  `d34106fedb1997a1bc03fa88f0479209a6c5d42fc9bb62038a6682ce9e6b8eee`
  and canonical-config 5,704-byte hash
  `e1ded27e33516d73c60da1f4a4c9cb0767b1bb0b1482e78b429449ec7c0b07f4`
  remain exact. This narrows ambiguity; it adds no operation, authority source,
  B2 field, runtime wiring, provider, spend, benchmark, or publication scope.
- 2026-07-21 (V2-M2-B Task 1 certified implementation cut point) **The trusted
  authority core is implemented at `220be3b`, in isolation from every durable
  mutation path.** `src/memory-authority-runtime.mjs` exposes the exact twelve
  internal names and `src/memory-authority.mjs` identity-reexports the exact
  five public names. Opaque private roots, audiences, grants, and reservations;
  immutable scalar capture; one-generation ledger binding; identifier
  non-reuse; captured activity predicates; primitive finite-integer native
  clock high-water; callback/postcheck precedence; and authorized-only
  release/burn/retire settlement are executable. The RED matrix was observed
  failing first at the missing-module boundary. At certification, authority
  tests pass 37/37 and the full suite passes 469/469 with zero failures on
  exact Node 22.22.2 / SQLite 3.51.2. Exact namespace identity, static
  isolation, and protected B1 byte checks pass; three independent final
  reviews found zero blockers or majors. This cut point does not connect the
  authority to a store generation, B2, A1, the bridge, or any producer; it
  changes no durable mutation behavior, runtime/read authority, B1 authority,
  provider, sealed U8 run, spend, dataset, score, publication, or announcement
  permission. CDX-M1 remains runtime/read authority, exact B1 remains unchanged
  and non-authoritative, parent M2/M2-B remain open, and Next is Task 2's
  executable disposition registry only.
- 2026-07-21 (V2-M2-B Task 2 post-seal exactness clarification) **A present
  generic compatibility outcome is closed data, while absence remains the
  verifier's deliberate static-disposition query.** RED exposed that the
  bridge contract required unknown internal inputs to throw, but the embedded
  generic evaluator treated any non-continuing value as the row's static
  refusal. For every non-D/non-F row, an absent own `compatibilityOutcome`
  property still requests the static disposition. If present, the property
  must be an own primitive data value in the union of the row's expanded
  `legacy_outcome` cell and `continueOutcomes`; own `undefined`, an accessor,
  or an unknown value is a native internal error. D-01/D-02/D-03 retain their
  phase-local authority/capture/projection evaluator, and F-01/F-02/F-03 still
  inspect no input. This closes an invariant-laundering hole without adding a
  compatibility branch, MAP leaf, reason, operation, field, or runtime path.
  Adversarial review then exposed a separate integrity defect: post-import
  replacement of live `Number.isSafeInteger`, array/string methods, collection
  methods, reflection operations, inherited numeric array setters, inherited
  `toJSON`, or output-freezing operations could admit a malformed D-02
  coordinate as `MAP` or corrupt the verifier/result clone. Inherited input
  coordinates and Proxy-backed records were a second route around the exact
  own-data/non-Proxy internal-record law. The normative artifact and production
  copy now capture all reachable primordials and constructors at evaluation,
  accept only ordinary/null-prototype records with closed row-local field
  vocabularies, read reached fields only through own data descriptors, reject
  Proxy records trap-free through the sole side-effect-free `node:util`
  dependency, require primitive capture status and route tags without
  coercion, build arrays through captured `Reflect.defineProperty`, compare
  verifier data without JSON hooks, and use null-prototype iterators plus
  indexed closed-array traversal rather than inherited close/species dispatch.
  F-01/F-02/F-03 remain zero-observation. One
  clean-child matrix poisons all such surfaces together with zero poison or
  Proxy-trap observations. This is an implementation-integrity clarification;
  it changes no registry data, branch result, version, or authority order.
  The superseding disposition-registry SHA-256 is
  `70d1d966cb8e5550c26b4ccac2b7b4193a564b0d8d7c01dfc4c92fb8b5a0df74`;
  bridge `25e9eeb1b902582a72ddc9d60c46f437c886afeac5e33ce0288c142e3927fe27`,
  authority `f4c87eda57059bf1b44d2640471f29f68ae6acf3af128a5142717f711fed75c9`,
  B2 schema `84f01ae2b5bdf084cacf27b8d6e6d3a611852094e985c36aaa18bba8baa2813e`,
  and canonical 5,704-byte config
  `e1ded27e33516d73c60da1f4a4c9cb0767b1bb0b1482e78b429449ec7c0b07f4`
  remain otherwise exact. This authorizes no B2/schema/bridge/producer wiring,
  provider, sealed U8 run, spend, dataset, score, publication, or announcement.
- 2026-07-21 (V2-M2-B Task 3 JavaScript-manifest representation) **The RED
  schema matrix pins the three JavaScript aggregate shapes that the normative
  SQL contract intentionally left representationally open; no persisted byte
  or semantic rule changes.** `CDX_B2_CREATE_STATEMENTS` is a recursively
  frozen, ordered array of sixteen primitive execution-SQL strings. Each
  string qualifies only its created object as `main.` and ends in exactly one
  semicolon; the corresponding manifest `persistedSql` is the independently
  normalized unqualified normative statement, because normalization does not
  and must not erase `main.`. `CDX_B2_REQUIRED_PRAGMAS` is an ordered frozen
  array of null-prototype records with exact keys
  `name,setSql,readSql,value`, in A1 policy order: `foreign_keys=1`,
  `busy_timeout=0`, `recursive_triggers=1`,
  `ignore_check_constraints=0`, and `trusted_schema=0`.
  `CDX_B2_MANIFEST` is one recursively frozen null-prototype record with exact
  keys `schemaVersion,schemaDocumentSha256,objects,autoindexes,tableXinfo,`
  `indexLists,indexXinfo,foreignKeys,triggerTargets,caseFoldedNames`; its
  ordered application objects use exact keys
  `type,name,table,executionSql,persistedSql`, and autoindexes use
  `name,table`. The leaf remains exactly six exports and no-I/O/no-import.
  The schema document remains
  `84f01ae2b5bdf084cacf27b8d6e6d3a611852094e985c36aaa18bba8baa2813e`,
  and the canonical 5,704-byte configuration remains
  `e1ded27e33516d73c60da1f4a4c9cb0767b1bb0b1482e78b429449ec7c0b07f4`.
  This clarification adds no B2 field or object, runtime wiring, journal
  append, reducer, transition, bridge, producer behavior, provider, sealed U8
  action, spend, dataset, score, publication, or announcement permission.
- 2026-07-21 (V2-M2-B Task 3 certification) **Implementation commit
  `5fb44188fb524a7939ca0e5d7f81474817387625` certifies only the exact B2
  schema and atomic head-zero checkpoint.** The dependency leaf has the six
  contracted exports; the Task 3 journal truthfully exposes only bootstrap,
  verify, and the closed error class. Under one externally owned A1 lease it
  classifies B2 before repair, permits only certified ordinary M0/M1
  structural completion for the absent candidate, snapshots all three legacy
  physical orders into content-free binary-ordered descriptor blocks, creates
  the exact B2 manifest, inserts the marker, and completely verifies the
  checkpoint/projection before return. Every operational schema, migration,
  checkpoint, and projection reference is explicitly `main`-scoped; only
  SQLite-required unqualified DML inside persistent main-trigger bodies
  remains. Complete reopen is callback/write/repair-free. The historical
  runtime imports only the schema leaf and accepts exactly the reviewed B2
  object/target/FK set so it reaches—and rejects—the intentional third
  migration row; CDX-M1 remains runtime/read authority and does not use B2.
  Completion evidence on Node 22.22.2 / SQLite 3.51.2 is focused 129/129 and
  full 517/517, zero failures, including 136 rollback/retry injection cases,
  post-native-COMMIT uncertainty, non-vacuous payload canaries, and TEMP-shadow
  regressions. Protected B1 production/document bytes and dormant raw
  extraction remain identical to `1d65bb0`; three final independent reviews
  report zero blockers or majors. This authorizes no positive-tail append,
  reducer, transition, bridge, runtime cutover, producer routing, terminal
  action, provider, sealed U8 run, spend, dataset, score, publication, or
  announcement.
- 2026-07-21 (V2-M2-B Task 4 certification) **Implementation commit
  `1ff398a6b7a7a3754da609d1372a59817bd8689c` certifies the complete positive-
  tail B2 journal, reducer, replay verifier, append, and head transition—no
  production bridge or runtime cutover.** The module exposes exactly
  `GovernedMemoryError`, `bootstrapCdxB2InTransaction`,
  `verifyCdxB2InTransaction`, `appendCdxB2TailInTransaction`, and
  `advanceCdxB2HeadInTransaction`. Every decision reconstructs and re-runs the
  pinned Admit/Resolve/hash behavior from Palari v05 commit
  `c9af823c7dee29d29fd937d44527f3b78d8d3845`, path
  `apps/palari-local-workbench/scripts/workspace-backend/patch-kernel.mjs`,
  blob `df4de5f00ae88ba670305f9b2bb699441cc5b234`, then applies only the reviewed
  first-match ratified private zero-link erasure transition. Hash records and
  every serialization-reachable nested record are frozen null-prototype data,
  so an inherited post-import `toJSON` cannot replace the exact JSON bytes or
  execute inside A1.

  The completion matrix mutates every one of 65 persisted fields, all four
  tables, the explicit index, all eleven triggers, all nine index-list/xinfo
  entries including eight autoindexes, and all three FKs; it also covers raw
  update/delete, gap/extra/unheaded tails, effect cardinality/order, authority/
  capability/decision/patch/target reuse, ledger/config/time drift, overlapping
  refusal precedence, checkpoint-derived historical replay, exact retained
  memory/link/FTS projection, and each documented content/metadata blind spot.
  Dynamic instrumentation observes only ordered B2 decision/effect inserts and
  the B2 meta CAS, with no transaction control or semantic CDX/B1 DML, and
  verifies the exact independent SHA-256 input bytes. Completion PASS on exact
  Node 22.22.2 / SQLite 3.51.2 is bounded closure 268/268 and full suite
  634/634, zero failures. Protected B1 production/document bytes remain exact
  to `1d65bb0`; three fresh independent reviews end with zero blockers or
  majors.

  This certifies neither external authenticity nor resistance to a coherent
  privileged same-file forgery. It intentionally does not check payload/
  metadata fields listed by the contract, add a previous-hash chain, invoke B1
  replay, own transaction control, mutate CDX/B1 projections, wire the bridge,
  alter runtime/read authority, or authorize a provider, sealed U8 action,
  spend, dataset, score, publication, or announcement. CDX-M1 remains runtime/
  read authority, exact B1 remains unchanged and non-authoritative, parent
  M2/M2-B remain open, and Next is Task 5/M2-B-05.
- 2026-07-22 (V2-M2-B Tasks 5–7 certification) **The bounded one-connection
  production falsifier is complete; CDX-M1 remains runtime/read authority.**
  Implementation `0017fee` makes `src/governed-memory-bridge.mjs` the sole
  production A1 owner and reduces the historical router to its exact
  transaction-neutral plan/projection surface. Only a trusted one-use grant
  for the pinned `ratify|ratified_user`, strength-`1.0`, private zero-link
  erasure maps: its B2 decision, ordered atom/FTS effects, CDX atom/FTS delete,
  and head advance co-commit. Every other current A2 intent/effect, producer,
  batch, implicit consequence, and terminal storage route deterministically
  refuses before semantic DML. Whole-store deletion performs no filesystem
  call. The production store captures the trusted manager provider only
  through exact one-export `src/workspace-manager-authority.mjs`; the reviewed
  source inventory is exactly 30 nodes with sole manager-provider capture edge
  `store -> workspace-manager-authority -> authority runtime`. Other reviewed
  authority-runtime imports perform kernel preflight or bridge lifecycle
  operations, not provider capture. This resolves the prior namespace/
  inventory ambiguity without exposing authority to proposals or returned
  handles. Task 6 unsupported routes create no B2 decision/effect and no CDX
  projection; Task 5 valid-grant target-state refusals separately commit a
  decision-only record.

  Completion hardening `d7bd9f9` adds non-vacuous scheduler extraction and
  summary probes, a valid-B2 successful-erasure proof that initialized B1
  table rows remain unchanged, and the explicit governed-contract provenance
  in the historical router. On exact Node 22.22.2 / SQLite 3.51.2, M2-B core
  passes 237/237, A1/A2 195/195, exact B1 164/164, product regressions 77/77,
  and the full suite 673/673, with zero failures, skips, or todos. Three fresh
  independent final reviews—spec/authority, exhaustive producer closure, and
  SQLite/atomicity/replay—report zero blockers or majors; follow-up review
  closes both raised substantive coverage gaps. One bounded nonclaim remains:
  bridge atomicity does not exercise every exhaustively tested A1 error code
  through the single inspected settlement mapper. Protected B1 document and
  production bytes remain exact to `1d65bb0`, and package dependencies are
  unchanged.

  Certified SHA-256 values are governed bridge
  `2e275837e64cedad21c315d6456a3b94cd4aef78c2daf0d56f70561642f9dc5c`,
  manager authority adapter
  `4e675183e73e6240818d6793c1d38372f2fe69a3bc15646f5428aeb5ab6e8afe`,
  historical router
  `b9b4142aa94d538aad14b0a56e1929cca4d98e5d4149669843237b0118455ca9`,
  authority contract
  `4222f19679abe8642d20999f32e543c854d9558c750246e183b6651582cc8570`,
  and governed bridge contract
  `fbdb2a170fe04b7c0c4eb93cf01a47647fb64a270eb27c61a11ab7231c2c87c5`.
  Parent V2-M2 is therefore complete at this falsifier and Next is V2-M3.
  This does not make B1 authoritative, cut runtime/read authority over from
  CDX-M1, prove external authenticity or coherent-forgery resistance, restore
  refused candidate/topic/terminal features, resume sealed U8 question
  `1568498a`, call a provider, spend, download data, score, publish, or announce.
- 2026-07-22 (FOUNDER — direction review, in session) **Full trim
  ratified.** The v2 proof machinery (bundle substrate, mutation
  coordinator, legacy router, authority core, disposition registry,
  B2 journal, governed bridge — 66 files, ~20k source lines and
  their test matrices) is removed from main and preserved intact at
  git tag `v2-proof-archive`. The U8-cut kernel surface (gated
  store, recall/briefing v1, gated adapter ingest, LongMemEval
  loader) is restored as the working tree, made installable
  (src/index.mjs entry point, examples/quickstart.mjs), and the
  charter is rewritten around the product loop and the
  journey-bank comparison. Executed mechanically per
  TRIM-CONTRACT.md. U8 stays sealed; the publish gate stays closed.
- 2026-07-23 — FOUNDER GO (J3): live bake-off authorized per
  docs/BAKEOFF-J3-PREP.md; model gpt-5-nano-2025-08-07; hard cap
  $0.25; publish gate remains closed — live scores never enter git.
- 2026-07-23 (J3 license gate) `mem0ai@3.1.1` is permitted for the
  founder-authorized eval-only install. Its npm manifest and the exact
  `mem0ai/mem0` source at git commit
  `5e7adc4d1264bb49ab20cf8c70e4807295d77ae2` identify Apache-2.0, a
  permissive OSS license, and npm provenance binds the package to that
  source. The registry tarball omits a license file and a nested OSS README
  carries a stale MIT label; those packaging inconsistencies do not change
  the permissive verdict, but they remain recorded. This authorizes no
  dependency beyond `mem0ai`, no live score in git, and no publication.
- 2026-07-23 (J3 post-install cost correction) The installed
  `mem0ai@3.1.1` native extraction prompt is 33,655 characters, and a trivial
  synthetic offline request serialized to 35,540 UTF-8 bytes. The
  pre-install 2,000-input-token allowance was not conservative for Mem0.
  Reserving 60,000 input tokens for each of the bank's 22 Mem0 ingest calls
  raises the pre-contingency ceiling from $0.02895 to **$0.09275**, still
  $0.00725 below the founder's $0.10 stop threshold. The founder later
  offered up to $2 if needed; it is not needed or adopted. The operational
  hard cap remains the pre-registered **$0.25**, and no provider call
  participated in this correction.
- 2026-07-23 (J3 terminal execution record) The single
  founder-authorized `j3-live-v1` execution was invoked once and is
  now closed. It completed 27 of 34 planned arm-journey cells. The
  next cell, `relationship-manager-14::mem0-oss-live` probe `p2`,
  stopped on a non-retryable OpenAI HTTP 400; the six remaining cells
  were never called. No transport retry occurred because the response
  was classified as non-retryable. The exact provider error body was
  deliberately not persisted, so no more specific cause is claimed.
  During the completed work neither arm produced an admitted memory.
  That is a diagnostic observation, not a score, and means the partial
  evidence cannot establish comparative engine behavior under the J4
  decision rule. Checkpoints, raw outputs, scored dimensions, and the
  partial grade remain under gitignored `evals/results/`; no live score,
  prompt text, response text, or raw artifact entered git or was
  published. This run may not be resumed or rerun. A further attempt
  requires a separately versioned, explicitly founder-authorized,
  cost-capped, and pre-registered unit; the existing FINAL predictions
  remain immutable. J4 remains closed pending founder direction.
- 2026-07-23 (FOUNDER GO — J3 engineering repair, in session)
  **Three fresh self-healing live cycles are authorized.** Run
  `j3-live-v2`, `j3-live-v3`, and `j3-live-v4` as separately configured,
  pre-registered, one-shot cycles; never resume or rerun closed
  `j3-live-v1`. Fix only what the preceding evidence supports, run the full
  offline verification battery before every live invocation, retain complete
  raw transcripts and terminal artifacts under gitignored `evals/results/`,
  and use independent agents when a module or structure must be reconsidered.
  The combined conservative spend cap is **$5.00 USD**, inclusive of
  `j3-live-v1`'s $0.01897402 accounted spend. The founder conditionally
  offered up to $15 only if competitor research first justified a much
  larger token allowance. Research did not justify that expansion, so it is
  not adopted. The publish gate remains closed and J4 remains a founder
  decision after these repair cycles.
- 2026-07-23 (J3 token-budget repair) The v1 proxy's 500-token extraction
  allowance was not representative: installed `mem0ai@3.1.1` sets no OpenAI
  output cap; current Mem0 Python defaults to 2,000; Graphiti 0.29.2 and
  GPT-5/5.1 Letta 0.16.8 use 16,384; LangMem inherits its caller's model
  configuration. OpenAI counts invisible reasoning inside
  `max_completion_tokens`. The first repair therefore freezes `minimal`
  reasoning, 16,384 extraction tokens, and 2,048 shared-answer tokens for
  both arms. An increase to 25,000 is allowed only if instrumented output
  remains ceiling-bound. Letta's 128,000 newer-model full-agent allowance
  does not justify a $15 ceiling or a 128,000-token standalone extractor.
  Exact sources and cost arithmetic are recorded in
  `docs/BAKEOFF-J3-HEALING.md`.
- 2026-07-23 (J3-H1 pre-run freeze) `j3-live-v2` is frozen before any
  provider call. Its exact run-configuration SHA-256 is
  `e6ce5a87645c7880d54cc53bf9a79fcd05e04a7438927cf219c80546bdebe247`;
  its FINAL prediction SHA-256 is
  `eb8cf3f0f3bef8cf93b4c7b8c4513b163443b19831519c5ee5723878b0424ccc`.
  The evaluator pins eval-only `mem0ai@3.1.1`, the unchanged 17-journey
  bank/model/prices/prompts, `minimal` reasoning, 16,384 extraction tokens,
  2,048 answer tokens, the cumulative $5 predecessor chain, exact ignored
  request/response transcripts, and one-shot terminal bundles. Two
  independent read-only reviews found no live-blocking issue. The 94-test
  suite, dry bake-off, and quickstart pass; `src/` is unchanged. This freeze
  authorizes only the already founder-approved single v2 invocation and
  publishes no live evidence.
- 2026-07-23 (J3-H1 terminal execution record) `j3-live-v2` was invoked
  exactly once from its frozen pushed commit, completed its full paired plan,
  and was graded against its immutable FINAL predictions. The terminal ledger
  and transcript audits pass, the combined conservative spend remains within
  the founder's $5 ceiling, and the full raw evidence plus local prediction
  grade remain under gitignored `evals/results/`. No live score, raw prompt,
  raw response, or transcript entered git or was published. This run is
  closed and may not be resumed or rerun; the next authorized work is a fresh,
  separately preregistered `j3-live-v3` repair cycle. J4 remains closed.
- 2026-07-23 (FOUNDER GO — J3-H2/H3 self-healing continuation, in
  session) The founder instructed the agent to fix every evidence-supported
  defect minimally, test after each repair, and complete at least three live
  cycles before reporting back. This later instruction permits changing
  product code when retained live evidence identifies the product as the
  cause; it supersedes the earlier blanket `src/` freeze only to that extent.
  The cumulative $5 cap, immutable run IDs, preregistration, local-only raw
  evidence, closed publish gate, and closed J4 gate remain unchanged.
- 2026-07-23 (J3-H2 evidence repair, before any v3 call) Complete v2
  transcripts show normal short completions rather than token exhaustion.
  The smallest causal repair is: remove the kernel extraction prompt's
  zero-score anchor while preserving explicit numeric zero and explicit-user
  authority over sharing; replay both arms at authored event time; stop
  treating Mem0 similarity as factual
  confidence; clarify the identical positive answer path; and grade visible
  abstention separately from retrieval emptiness while retaining
  forbidden-evidence checks for forgetting, injection, and isolation and
  requiring recalled evidence for any scored answer. Mem0's
  native prompt, package, search, source serialization, scope filters, and
  shared-plane behavior remain untouched. No v3 provider call has occurred.
- 2026-07-23 (J3-H2 pre-run freeze) The kernel-specific extraction policy is
  now a thin wrapper; the v0.5 comparator imports the preserved prior bytes
  directly (SHA-256
  `770889c34c02a4c1f9162318c2b32786f6922ff288924627d681a10f92561a9f`).
  Background extraction is mechanically private even if a model returns
  `shared:true`; sharing still requires the gate's explicit-user ratification.
  This intentionally changes the governed dry reference to 41/44 on
  `shared-standup-08:p1`, while the frozen bank and v0.5's 42/44 comparator
  remain unchanged. The exact v3 config SHA-256 is
  `cb66470dd6990174b6d84d360591b685fcf7025deebd7eb426476f2e693d4dcd`;
  its FINAL prediction SHA-256 is
  `0b3bb2c39bc32e82264b18383a7037ae59139e443becae6839a024349e854e68`.
  Independent structural and adversarial reviews found no remaining paid-run
  blocker after the authority and no-evidence fixes. The 98-test suite, dry
  bake-off, and quickstart pass. No v3 provider call has occurred.
- 2026-07-23 (J3-H2 terminal execution record) `j3-live-v3` was invoked
  exactly once from its frozen pushed commit and completed the full paired
  plan. Its terminal ledger, transcript, checkpoint, report, artifact, and
  credential-safety audits pass, and every immutable FINAL prediction was
  graded locally with misses analyzed first. Complete raw evidence and the
  local prediction grade remain under gitignored `evals/results/`; no live
  score, prompt, response, transcript, or raw result entered git or was
  published. Independent kernel, Mem0, and forensic reviews converge on the
  bounded prospective repair surface for the separately configured third
  cycle. V3 is closed and may not be resumed, rerun, or retroactively
  regraded. J4 and the publish gate remain closed.
- 2026-07-23 (J3-H3 evidence repair, before any v4 call) Complete v3
  evidence isolated three minimal prospective changes: stop teaching the
  kernel extractor a joined enum value or request/reporting wrappers while
  preserving source-faithful durable terms and searchable base verbs; tell
  both arms' identical answer prompt how to choose between dated current
  facts; and recognize a tightly bounded standalone semantic absence without
  weakening forbidden-evidence checks. Admission thresholds, lexical source
  eligibility, explicit-user sharing authority, supersession, the preserved
  v0.5 comparator, bank, model, Mem0 extraction/search/scope, and token
  allowances remain unchanged. An adversarial review found that the first
  semantic classifier draft compared unordered token bags; before freeze it
  was replaced with ordered WH-restatement matching that permits only
  auxiliary inversion or one dropped do-support token and rejects yes/no
  declaratives, reordered content, wrong perspective, and appended facts. No
  v4 provider call has occurred.
- 2026-07-23 (J3-H3 pre-run freeze) The exact `j3-live-v4` configuration
  SHA-256 is
  `1ee30c98de735d3f0e0f8de53eea580be968ec4ed2c81d2dea8579668f49851b`;
  its FINAL prediction SHA-256 is
  `176783abd50b5c91c9ac5295e86e4e5ad3171a84a4abc517199be2ee6ba70946`.
  The kernel prompt-manifest hash is `8c1106c3a2e76de3`; preserved v0.5 bytes
  remain SHA-256
  `770889c34c02a4c1f9162318c2b32786f6922ff288924627d681a10f92561a9f`.
  Independent extraction, oracle, and paid-preflight reviews found no
  remaining live blocker after the order-aware correction. The 100-test
  suite, dry bake-off, and quickstart pass. No v4 provider call has occurred;
  this freeze authorizes only the already founder-approved single v4
  invocation and publishes no live evidence.
- 2026-07-23 (J3-H3 terminal execution record) `j3-live-v4` was invoked
  exactly once from pushed commit
  `cb84ac7589a9fe9cb08482dfdb6738e298770840` and completed the full paired
  plan. Its ledger, transcript, checkpoint, report, artifact-manifest,
  permission, and credential-safety audits pass, and every immutable FINAL
  prediction was graded locally with misses analyzed first. Complete raw
  evidence and the local prediction grade remain under gitignored
  `evals/results/`; no live score, raw execution request, response, transcript,
  or raw result entered git or was published. Independent forensic, causal,
  and oracle reviews found no remaining evaluator defect that could justify a
  rerun.
  V4 and all three authorized engineering-repair cycles are closed and may not
  be resumed, rerun, or retroactively regraded.
- 2026-07-23 (J3-H stopping decision) The founder's optional extra-cycle
  authority was considered and not exercised. The remaining repeatable gaps
  require schema-constrained extraction, deterministic lexical normalization
  or semantic retrieval, explicit sharing/history paths, or an admission
  plane around Mem0. An alias for one invalid type, an allergy-specific stem,
  more answer wording, or an unchanged paid invocation would tune to fixtures
  or reroll stochastic behavior rather than make a minimal general repair.
  No fourth provider call is justified under the product stop rule. J4 and
  publication remain closed pending a new explicit founder instruction.
- 2026-07-23 (FOUNDER GO — J4 independent validation, in session)
  **J4 is opened for an external memory benchmark.** The founder approved the
  proposed independent-evaluation direction and then, before any J4 provider
  call, selected `gemini-3.5-flash-lite` for the Palari memory writer and
  answerer. Explicit minimal thinking is fixed. Classic LongMemEval is the
  first benchmark. The ten-question U8 slice stays sealed as one unit and is
  excluded from every J4 population; no completed or incomplete U8 question
  may be executed or graded. The publish gate remains closed.
- 2026-07-23 (J4 founder challenge — do not pay to rediscover Mem0's public
  result) The founder asked why Mem0 needed to be rerun and directed the work
  toward Palari in an existing public measurement. Stage 1 is therefore
  Palari-only on LongMemEval-S. Mem0's reported 94.4% is managed Platform v3,
  top-200 vendor evidence with proprietary optimizations; the pinned public
  benchmark commit's result artifact still says 93.4%, and the exact updated
  run is absent. It is contextual, not a matched OSS baseline. A paid Mem0 run
  is deferred unless the Palari result makes configuration-controlled evidence
  decision-relevant.
- 2026-07-23 (J4 spend-free preparation) Google currently marks
  `gemini-3.5-flash-lite` GA at $0.30/M input and $2.50/M output tokens,
  including thinking. J4 sends explicit `MINIMAL`, caps writer output at 512
  tokens and answer output at 256, and uses a single aggregate ledger. Official
  LongMemEval answer grading stays pinned to `gpt-4o-2024-08-06`; its exact
  upstream prompt, settings, and permissive contains-yes parser are adapted
  from MIT source commit
  `9e0b455f4ef0e2ab8f2e582289761153549043fc`. Oracle-490 is neither selected
  nor needed for Stage 1. The preliminary, public-harness-derived S-60
  population is estimated at $9.9736455 expected and $25.1416396 under the
  committed conservative assumptions, with a proposed $30 aggregate hard
  stop. The estimate uses the exact current extraction-message size plus
  explicit protocol overhead, not raw history plus an undersized prompt
  allowance. That cap is not adopted by this entry: an exact founder cap, both
  runtime keys, FINAL predictions, pushed code, and green offline verification
  remain mandatory before any call. The full S-490 population is approximately
  $81.62 expected and $205.84 conservative and remains a separate, unopened
  decision. Full protocol, assumptions, and pinned population hashes are in
  `docs/LONGMEMEVAL-J4-PREP.md`; no provider was called and no score was
  created.
- 2026-07-23 (FOUNDER DIRECTION — J4 staged circuit breaker) The founder
  rejected an uninterrupted S-60 run because an earlier evaluation was
  visibly broken on question 1 yet continued through the full population. J4
  must now execute at most five mechanically preordered questions, report, and
  stop. Every later tranche is ten new questions except the final five and
  requires a fresh founder GO after reviewing the preceding private evidence.
  The immutable cumulative boundaries are 5/15/25/35/45/55/60; proposed
  cumulative caps are
  $2.50/$7.50/$12.50/$17.50/$22.50/$27.50/$30. None is adopted by this entry.
  All 60 predictions and the entire order freeze before question 1. Health is
  audited after every question and any operational defect stops immediately;
  a valid wrong answer remains a finding, never a retry. No completed question
  is rerun, no configurations are mixed into one score, and the publish gate
  remains closed.
- 2026-07-23 (FOUNDER GO — J4 Tranche 1) The founder explicitly authorized
  exactly the first five preordered LongMemEval-S questions under a $2.50
  cumulative hard cap, followed by a mandatory stop and private report. The
  cap includes the compatibility smoke request, both providers, and every
  retry. This GO opens only the J4.2 Palari-only implementation, smoke, and
  first five questions using `gemini-3.5-flash-lite` for memory writing and
  answering and the official pinned `gpt-4o-2024-08-06` judge. It does not
  authorize question 6, any later tranche, Mem0, S-490, rerolls, publication,
  or announcement. All 60 predictions, the complete execution order, prompts,
  settings, and code must be FINAL and pushed before the first provider call.
- 2026-07-23 (J4.2 pre-run protocol resolution) The one authorized
  compatibility request is a metered Gemini JSON-writer smoke. The answer and
  judge paths first execute on question 1 and fail closed there if unavailable
  or invalid. Tranche 1 has 1,201 base benchmark calls plus this one smoke call
  and permitted retries, all in the same $2.50 ledger.
  Sessions replay in stable chronological `eventAt` order with original array
  order breaking ties. Missing, malformed, or non-array extraction payloads
  stop on that turn; they cannot become silent zero-write observations. After
  a completed non-abstention question, zero admitted memories is the one
  mechanical product-result pause condition; ordinary wrong answers and zero
  recall remain findings. A valid nonempty judge completion is graded by the
  unchanged upstream contains-yes parser even when oddly worded. Evaluation
  identity is the run ID plus hash-pinned dataset, config, prompts, models,
  predictions, order, and implementation artifacts. A later founder GO may
  change only the separately tracked administrative authority record,
  `DECISIONS.md`, `STATUS.md`, and administrative commit; it may not change
  those evaluation bytes or rerun a completed question. No provider call was
  made while resolving this protocol.
- 2026-07-23 (J4.2 TERMINAL — compatibility smoke) The pushed frozen runner
  at `a6ab150` was invoked once under the founder's first-tranche authority.
  Its only provider operation was the one metered Gemini writer smoke. The
  response was transport-valid, used the pinned model, finished normally, and
  contained parseable JSON, but the candidate supplied a source-kind value
  outside the validator's frozen enum. The extraction prompt required a
  `sourceKind` field without enumerating its accepted vocabulary. The runner
  therefore stopped fail-closed before question 1, before any answer or judge
  call, and without producing a benchmark score. The ignored private evidence
  bundle passes manifest, meter, permissions, and credential-safety checks.
  This run is terminal and must not be deleted, reset, resumed, or rerolled.
  Any successor must use a new run identity, explicitly document the enum in
  the prompt, contract-test it, freeze new hashes, review predictions against
  the changed prompt, carry forward the measured smoke spend, and receive a
  fresh capped founder GO before any provider call.
- 2026-07-23 (FOUNDER GO — J4 replacement run) The founder explicitly
  authorized a fresh `j4-longmemeval-s60-v2` identity, preserving the terminal
  v1 run, with only the missing extraction `sourceKind` vocabulary made
  explicit. V2 must use the same models, settings, execution order, unchanged
  60 prediction rows, one new compatibility smoke, and exactly the same first
  five benchmark questions, then stop and report. The v1 smoke's measured
  `$0.0004494` remains charged against the same `$2.50` cumulative hard cap;
  therefore the fresh v2 meter may account for at most `$2.4995506`, including
  every retry. The v1 config, authority, predictions, checkpoint, meter,
  transcript, report, and artifact manifest remain immutable and cannot be
  deleted, reset, resumed, or rerolled. This GO does not authorize question 6,
  a later tranche, Mem0, S-490, publication, announcement, or any product or
  evaluation change beyond the vocabulary-only prompt-contract fix and the
  mechanical versioning, evidence, estimate, and budget updates required to
  execute it honestly.
- 2026-07-23 (J4.2R TERMINAL — replacement run) The pushed frozen runner at
  `b916861` was invoked once under the replacement authority. Its new
  compatibility smoke passed and confirmed that returned source kinds honored
  the newly explicit vocabulary. During the first benchmark question, a later
  writer response used a type outside the separate, already enumerated frozen
  type vocabulary. The runner stopped fail-closed before completing any
  question and before any answer or judge call, so no benchmark score exists.
  The v1 predecessor remained unchanged and charged to the cumulative budget;
  the v2 ignored evidence bundle passes manifest, ledger, permissions,
  checkpoint, and credential-safety audits. No raw response, transcript,
  result, or score entered git or was published. V2 is terminal and may not be
  resumed or rerolled. Question 6, later tranches, another evaluation change,
  Mem0, S-490, publication, and announcement remain founder-gated.

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

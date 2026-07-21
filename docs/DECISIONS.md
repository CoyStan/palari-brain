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

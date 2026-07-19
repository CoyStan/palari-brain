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

---
id: BRN-0024
title: "Run exact-counted Luna and Ettin on unexecuted S60 ten"
stream: evaluation
level: 1
parent_id: 
root_id: BRN-0024
children: []
status: in-review
risk: R4
priority: P0
agents_allowed: 1
claimed_by:
claimed_at:
target_branch: "main"
branch: "ticket/BRN-0024-run-exact-counted-luna-and-ettin-on-held-out-s60-ten"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0024-run-exact-counted-luna-and-ettin-on-held-out-s60-ten"
allowed_paths:
  - "evals/predictions.md"
  - "docs/EVALUATION-HARNESS.md"
  - "docs/DECISIONS.md"
  - "STATUS.md"
  - "coding-sessions/tickets/open/BRN-0024-*.md"
  - "coding-sessions/tickets/closed/BRN-0024-*.md"
  - "coding-sessions/reports/BRN-0024-*.md"
  - "coding-sessions/human-report/BRN-0024-*.md"
  - "coding-sessions/handoffs/BRN-0024-*.md"
forbidden_paths:
  - ".env"
  - ".env.*"
  - "*.key"
  - "**/*.key"
  - "secrets/**"
  - "**/secrets/**"
  - "*secret*"
  - "**/*secret*"
  - "*token*"
  - "**/*token*"
  - "infra/prod/**"
  - "prod/**"
  - "runtime-data/**"
  - ".palari-probe/**"
  - ".palari-regression/**"
  - "data/**"
  - "evals/results/**"
requires_human_confirmation: true
requires_review: true
verification:
  - "node /home/quetza/palari-brain-private/luna-ettin-heldout11to20-live-launcher.mjs --verify"
  - "npm test"
  - "npm run quickstart"
created: 2026-08-06
updated: 2026-08-06
---

# BRN-0024 Run exact-counted Luna and Ettin on unexecuted S60 ten

## Goal

Measure the accepted Palari retrieval/evidence architecture with native Ettin
and Luna on one never-executed, previously profiled ten-question slice. Use
exact structured input counts before every Luna generation reservation,
preserve one-shot causal custody, and record the result whatever it is without
changing or reinterpreting any historical score.

## Frozen Candidate And Proposed Authority

- Identity: `j4-luna-ettin-unexecuted11to20-v1`. The prior
  `j4-luna-ettin-heldout11to20-v1` freeze was abandoned unconsumed after review
  disproved its stronger non-inspection premise.
- Population: exact pinned LongMemEval S60 ordinals 11-20, in order:
  `18bc8abd`, `19b5f2b3`, `1a1907b4`, `2133c1b5`, `2133c1b5_abs`,
  `25e5aa4f`, `2698e78f_abs`, `32260d93`, `35a27287`, `36b9f61e`.
- Reconciliation found no terminal result for any selected identity. Tracked
  P-set 20 previously assigned content-derived difficulty/basis classes to all
  ten, so this contract claims only execution holdout—not pristine content
  blindness. No new question/answer/session inspection or route tuning is
  permitted. Sealed U8 `1568498a` is absent.
- Opening cumulative accounted spend: exactly `$7.80502179`.
- Proposed hard caps: `$5.00` fresh and `$12.80502179` cumulative accounted.
  The fresh cap covers the maximum bounded Luna dispatch loop while retaining
  `$0.05` uncertain/accounted for every input-count attempt, plus the prior
  conservative Gemini writer/embedder and official-judge envelope.
- These values are a preregistered proposal, not live authority. Dispatch
  requires a clean pushed freeze, independent pre-dispatch review, and a new
  exact founder confirmation naming this identity, both numeric caps, reviewed
  head, launcher/runtime hashes, and ACCEPT state.

## Scope

- Freeze the current accepted `main`, S60 bank hash/order, ten ordinal/ID
  pairs above, complete product/evaluation import closure, native Ettin model
  closure, provider/model settings, private launcher/runtime hashes, terminal
  predecessor manifests, opening ledger, caps, U8 exclusion, and absent result
  namespace before credential or inference access.
- Preserve the accepted BRN-0019 general retrieval plan and evidence-use
  architecture: optional one-shot `anchor_event`/`relation`/`category`/
  `time_range` plan, timeline/read, semantic retrieval, at most four evidence
  calls, structured memory commitments, and provenance-linked revisable
  temporary inferences. Add no question-specific routing or answer hint.
- Use the accepted BRN-0017 evaluation surfaces except for the two accepted
  causal treatments: BRN-0019's architecture and BRN-0023's exact-counted Luna
  reservation boundary. Pin `gpt-5.6-luna`, low reasoning, Standard/default,
  no-store, 512 maximum output tokens; native cached Ettin reranking; the
  existing metered Gemini writer/embedder; and unchanged
  `gpt-4o-2024-08-06` official judge.
- Before question 1, run one unrelated writer compatibility smoke and one
  unrelated answer/tool/commit compatibility smoke. Either failure seals and
  stops the identity. Provider-free Ettin and metering checks run before both.
- Within the one live invocation, ingest and answer ordinals 11-20 serially.
  Reserve every physical call durably before transport. Every Luna body first
  receives its own durable `$0.05` uncertain count-attempt reservation, one
  exact input-count call, then one exact-count-derived generation reservation.
  Count or reservation failure is terminal for that operation and never falls
  back to byte estimates or retries.
- Seal raw tool transcripts, exact returned evidence, reranker telemetry,
  plans, commitments, temporary inferences, answers, official judge labels,
  usage, latency, separate measured/uncertain accounting, and terminal hashes.
  Keep session recall, exact-span recall, selected evidence, judged
  equivalent-fact recall, and judged materially-used evidence distinct. The
  two judged semantic labels start pending/null and are applied exactly once
  by an independent terminal reviewer without mutating canonical truth.
- Record every result, failure, prediction grade, seal, and spend value in
  tracked reports and `STATUS.md`, then obtain independent terminal review.

## Out Of Scope

- No new access to question text, reference answers, supporting sessions, or
  private result content before the frozen launcher itself executes under
  exact founder authority. Prior P-set 20 profiling is disclosed but may not
  drive a route, hint, prompt, or code change. Metadata/hashes and provider-free
  structural verification are permitted.
- No U8, first-ten rerun, old four-failure rerun, answer-specific rule,
  keyword router, known answer, benchmark-label hint, model/prompt tuning,
  memory repair, dataset/order change, product write, or publication.
- No mutation, reroll, retry, resume, selective regrade, replacement identity,
  or cap top-up after the invocation starts. A bad score, smoke failure, cap
  stop, provider failure, or partial suffix is the terminal result.
- No change to historical BRN-0017 `6/10`, BRN-0020's partial diagnostic, or
  any predecessor bytes/labels/accounting. The unexecuted score is a new result,
  not a regrade or a directly comparable rerun of the inspected first ten.
- No claim that equivalent-fact or materially-used labels are canonical
  facts, that declared `consequence_for_answer` proves material use, or that
  retrieved evidence must be selected. `not_used_reason` remains valid.
- No assumption that OpenAI input counting is free, no settlement without
  provider billing evidence, and no provider/credential access under prior or
  approximate authority.

## Acceptance Criteria

1. A provider-free verifier binds clean pushed authority, exact accepted
   source/import closure, all local/private model/runtime artifacts, terminal
   predecessors, dataset bank/version/order, ten frozen metadata identities,
   U8 exclusion, opening ledger/caps, private modes, and absent result before
   credential or provider access.
2. P-set 34 remains an abandoned immutable freeze; P-set 35 is FINAL before
   any credential read. Failing-first predictions are
   fixed at: official accuracy at least `8/10`; at least 90% required-session
   recall; at least 80% exact supporting-span recall where an exact span is
   structurally gradeable; at least 8/10 rows select answer-relevant evidence
   or correctly select none for abstention; and at least 8/10 rows receive an
   independent materially-used PASS or correct abstention. Equivalent-fact
   recall is separately judged and never substituted for exact-span recall.
3. Offline fake-wire verification proves writer and answer smokes, native
   Ettin finite immutable scores, four-call enforcement, complete commitment/
   temporary-inference capture, and one count-reserve/count/generation-reserve/
   generation sequence per Luna operation with exact body hashes and no retry.
4. Independent pre-dispatch review confirms the slice was not previously
   executed, prior P-set 20 profiling is disclosed, no row-specific benchmark
   content/rule entered product or launcher logic, the full meter/cap/seal
   covers every physical call, and both old/new identities are absent. No
   provider call occurs before its ACCEPT recommendation and exact founder
   authority binding both caps plus the reviewed head/private hashes.
5. One authorized invocation performs both live compatibility smokes and then
   all ten ordered cells unless the first terminal failure stops the suffix.
   Every reached answer is officially judged once; no cell is rerun, resumed,
   rerolled, or regraded.
6. Structural reporting preserves five non-aliased surfaces: session recall,
   exact-span recall, selected evidence, equivalent-fact recall, and materially
   used evidence. The last two retain explicit reviewer provenance/status and
   do not alter official labels, answers, or canonical memory.
7. General temporal/relational plans and every temporary cross-context
   inference remain trace-only, cite returned evidence, are marked
   `revisable: true`, and create no durable fact. Commitments allow either
   `consequence_for_answer` or `not_used_reason`; unused retrieved memories are
   never forced into the answer.
8. `STATUS.md` records exact completion/score, per-row official labels,
   retrieval/rerank/commitment/metric telemetry, calls, usage, latency,
   measured versus uncertain spend, remaining caps, artifact seal, prediction
   grades, and the product stop rule whatever the outcome.
9. Full tests, quickstart, ticket/report/scope/diff checks, provider-free
   private verification, and independent terminal review pass. Historical
   `6/10` and all sealed predecessors remain byte- and meaning-unchanged.

## Ticket Completion Contract

### Definition Of Done

- The identity is either fully frozen at the founder gate, or consumed and
  sealed with one honest terminal outcome from the two smokes plus the
  unexecuted ten.
- If consumed, tracked evidence records the official and five-surface results
  without tuning, replacement, or publication.

### Expansion Rules

- A missing file in the import/meter/seal closure is a pre-dispatch repair
  within this ticket only when it changes no product, prompt, selection, or
  provider behavior and remains inside the private launcher boundary.
- Any needed tracked product/eval implementation outside `allowed_paths`, any
  question-content-driven change, or any cap increase after dispatch is a
  founder-level stop. Open a new ticket; do not widen or repair this identity.

## Verification

- `node /home/quetza/palari-brain-private/luna-ettin-heldout11to20-live-launcher.mjs --verify`
- `npm test`
- `npm run quickstart`
- `npm run ticket -- check BRN-0024`
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0024`
- `git diff --check main...HEAD`

## Stop Conditions

- Stop if the work needs a path outside `allowed_paths` or touches `forbidden_paths`.
- Stop before any credential read, result-namespace creation, network/provider
  call, inference, or spend until the complete freeze is pushed, independently
  reviewed, and the founder authorizes the exact identity with exact fresh and
  cumulative caps.
- Stop rather than newly inspect question/answer/session content during
  preparation, encode a benchmark-specific route, access U8, reuse prior
  authority, or claim a historical score changed.
- Once live invocation begins, any smoke, count, reservation, cap, provider,
  parse, artifact, or seal failure is terminal. Preserve and report it; never
  retry, resume, replace, or request a top-up for this identity.

## Offline Freeze Evidence

- P-set 34 is abandoned unconsumed and remains immutable. Founder-approved
  P-set 35 relabels the same fixed IDs as never executed but previously
  profiled by P-set 20; it excludes U8 and permits no new content inspection.
- Private launcher/runtime are mode 0600 with SHA-256
  `2ffb3d7a414008a74b9c61eaa1aca1db0240ef33fd155a6adb060863b2488459`
  and `b49c6f8c38d08271933daa415f19037fd7055ede3711bb5d27371c42aaadca81`.
- Provider-free verification binds clean canonical `0615b10`, product cut
  `146d911`, 18 current source/eval files, 13 predecessor bundles, dataset and
  order hashes, seven native Ettin artifacts and the 3,208-file runtime
  closure, exact opening/caps, private modes, and absent result.
- Normal, plain-terminal, and forced-commit Luna bodies pass fake exact-count
  orchestration: each records count reservation, one count, exact generation
  reservation `$0.0008644` for the 1,000/512 fixture, and one generation in
  order. Writer smoke, answer smoke, unexecuted IDs, five metric surfaces, and
  architecture telemetry are present in the generated runtime.
- Exact live authority now binds both numeric caps, the pushed reviewed head,
  the two private hashes above, and explicit ACCEPT state before namespace
  creation. Luna settlement uses official Standard short/long measured rates;
  one run-wide meter set consumes operation IDs before reservation; a separate
  append-once sealed semantic-review overlay binds reviewer provenance and the
  original immutable manifest without changing canonical truth or scoring.
- Invalid live authority refuses before namespace creation. Credential reads,
  provider calls, inference, result creation, and spend are
  `0 / 0 / 0 / 0 / $0.00`; cumulative remains `$7.80502179`.
- Full tests pass 775 / skip 15 / fail 0 across 790; quickstart passes 6/6;
  ticket, report, committed-plus-dirty scope, syntax, and diff checks pass.
  Independent pre-dispatch review remains required.

## Independent Pre-Dispatch Review

Fresh read-only review of exact pushed head `f015ac0` recommends
`needs-human`; the identity must not dispatch from that freeze. The reviewer
confirmed four technical defects that are repairable without provider access:

- P0: live authority binds the identity and fresh cap, but not the cumulative
  cap or exact reviewed freeze.
- P1: long-context Luna usage settles at short-context rates.
- P1: recreating the exact-count evaluator per dispatch does not enforce
  run-wide operation-ID single use.
- P2: the one-time equivalent-fact/material-use judgment overlay lacks an
  implemented reviewer-provenance and immutable-seal path.

The founder-level blocker is separate: the ten cells have no prior terminal
execution, but tracked P-set 20 already contains row-specific, content-derived
retrieval difficulty classifications for these ordinals. Therefore the
frozen statement that their question/reference/supporting content and expected
route were never inspected is not supportable. BRN-0024's own expansion rules
make changing the population or evaluation claim a founder decision. No
credential, provider, inference, result namespace, or spend occurred; the
identity remains unconsumed and cumulative accounted spend remains
`$7.80502179`.

The founder then approved retaining these same ten under the honest
“never-executed, previously profiled” claim. The stronger identity and P-set 34
remain abandoned and absent. The replacement identity/P-set 35 implement all
four technical repairs without changing product, prompt, population, model,
selection, or cap behavior. Fresh independent review of the exact repaired
pushed freeze remains required.

Review of repaired head `a8b8ae8` reopened two further findings. P0: a caller
could assert ACCEPT even while the tracked note said PENDING. P1: runtime
`--verify` called content-parsing `preflight()` before authority and emitted
only aggregate counts. No text/reference/supporting content reached a human
and no tuning or live action followed. The second repair makes `--verify`
synthetic-only (confirmed not to open the dataset) and requires the exact
reviewed note to contain machine-readable ACCEPT plus identity markers before
namespace creation. The marker remains PENDING until independent acceptance.

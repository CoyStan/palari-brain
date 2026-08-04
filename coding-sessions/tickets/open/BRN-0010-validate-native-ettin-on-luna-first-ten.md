---
id: BRN-0010
title: "Validate native Ettin on Luna first ten"
stream: evaluation
level: 1
parent_id: 
root_id: BRN-0010
children: []
status: reopened
risk: R3
priority: P0
agents_allowed: 1
claimed_by:
claimed_at:
target_branch: "main"
branch: "ticket/BRN-0010-validate-native-ettin-on-luna-first-ten"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0010-validate-native-ettin-on-luna-first-ten"
allowed_paths:
  - "evals/predictions.md"
  - "docs/DECISIONS.md"
  - "STATUS.md"
  - "coding-sessions/tickets/open/BRN-0010-*.md"
  - "coding-sessions/tickets/closed/BRN-0010-*.md"
  - "coding-sessions/reports/BRN-0010-*.md"
  - "coding-sessions/human-report/BRN-0010-*.md"
  - "coding-sessions/handoffs/BRN-0010-*.md"
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
  - "node /home/quetza/palari-brain-private/luna-ettin-first10-live-v1-launcher.mjs --verify"
  - "node --test tests/reranker-ettin.contract.test.mjs tests/ettin-native-bakeoff.contract.test.mjs"
  - "npm test"
  - "npm run quickstart"
created: 2026-08-04
updated: 2026-08-04
---

# BRN-0010 Validate native Ettin on Luna first ten

## Goal

Measure whether the accepted native Ettin-17M reranker improves Luna's
end-to-end answers on the exact private LongMemEval S60 ordinals 1-10, while
preserving the accepted four-search/finalization boundary and every other
provider, prompt, memory, question, and grading factor. Treat the single fresh
identity, including any failure or cap stop, as terminal evidence.

## Context And Authority

BRN-0009 is founder-accepted and merged on canonical `main` at `866bf70`.
Its local synthetic bank measured 14/15 top-1, 0.9667 MRR, 15/15 recall@5,
and 26.1374 warm ms/case, but explicitly did not establish generated-answer
accuracy. On 2026-08-04 Quetzali accepted BRN-0009 and directed a new BRN to
validate Ettin. This is fresh authority for one bounded first-ten diagnostic;
it is not authority to rerun, resume, or regrade BRN-0007 P-set 21 or BRN-0009
P-set 24.

The closest terminal comparator is BRN-0007 identity
`j4-luna-retrieval-first10-v2`: compatibility passed, six questions received
official labels `PASS, FAIL, PASS, PASS, PASS, PASS`, question 7 answered but
its judge reservation hit the `$1.00` cap, and questions 8-10 were not reached.
It closed at `$5.27173386` cumulative accounted spend: `$1.70023596` measured
plus `$3.5714979` uncertain. BRN-0010 carries those exact balances forward.

## Scope

- Freeze a fresh private identity `j4-luna-ettin-first10-v1` from canonical
  `main` at `866bf70`, with exact tracked/private predecessor hashes, dataset,
  population, providers, prompts, limits, runtime, local model/head/runtime
  closure, launcher, predictions, and accounting committed before dispatch.
- Use the exact ordered S60 IDs and immutable dataset from BRN-0007, questions
  1-10 only, with sealed U8 `1568498a` absent and unreachable.
- Preserve `gpt-5.6-luna`, Standard service, low reasoning, `store:false`,
  Gemini `gemini-embedding-001`, official `gpt-4o-2024-08-06` judge, semantic
  embedding behavior, memory contents, prompts, answer/judge schemas, four
  aggregate memory-call ceiling, tool-disabled finalization, serial execution,
  question order, and official grading.
- Change one experimental factor: inject accepted
  `createEttinReranker()` into every test brain so the existing bounded RRF
  candidate pool is reordered locally before the unchanged result limit and
  character budget. The exact model, head artifacts, full isolated runtime
  closure, fp32 dtype, cache, and fail-closed boundaries remain those accepted
  in BRN-0009.
- Build a fresh mode-0600 one-shot launcher outside git. It must rehash every
  predecessor, current product/eval byte, exact dataset/order, generated
  runtime, Ettin code/model/head/runtime closure, absent fresh identity,
  opening ledger, caps, and credential-read ordering before dispatch.
- Run provider-free verification and one local real-brain Ettin smoke first.
  Then run one live compatibility smoke proving real Gemini semantic retrieval,
  `reranked: true`, and a Luna answer. A failure is terminal before question 1.
  Otherwise answer and officially judge all ten once in order, checkpointing
  each cell and stopping terminally on any provider, integrity, cap, or runtime
  failure.
- Use a `$1.50` fresh accounted hard cap and `$6.77173386` cumulative hard
  boundary. Preserve measured versus uncertain accounting; no call dispatches
  without a fail-closed reservation. This cap is a ceiling, not a spending
  target.
- Record exact results, retrieval/rerank behavior, labels, calls, usage,
  measured/uncertain spend, artifact hashes/modes, zero-match credential scan,
  prediction grades, and product stop rule whatever they are. Obtain fresh
  independent review before and after the invocation.

## Out Of Scope

- No product repair, prompt tuning, question-specific rule, label/answer use in
  runtime logic, model/effort/provider change, embedding change, judge change,
  retrieval pool/limit change, timestamp-policy change, or dataset/order edit.
- No retry, resume, reroll, selective rerun, regrade, replacement identity,
  hidden result, or publication. A failed local/live smoke, question, judge,
  cap, integrity, or provider call is the result.
- No access to sealed U8, no second first-ten identity, no spend above `$1.50`
  fresh or `$6.77173386` cumulative, and no secret, runtime, model, cache,
  dataset, transcript, or result byte in git.
- No claim that these inspected ten cases estimate unseen-user generalization.
  This is a private causal diagnostic of adding Ettin to the accepted Luna
  answer path.

## Acceptance Criteria

1. Before any provider dispatch, FINAL predictions and the complete tracked/
   private execution closure are committed and pushed. The launcher verifies
   all terminal predecessors, exact opening ledger, fresh/cumulative caps,
   current checkout, dataset/order, providers, prompts, limits, Ettin identity,
   generated runtime, and absent fresh result without reading credentials.
2. A fresh independent reviewer confirms that enabling the accepted Ettin
   reranker is the only causal treatment versus BRN-0007, no benchmark answer
   enters runtime logic, every provider is metered, all local/external bytes are
   integrity-pinned, and one invocation cannot be repeated.
3. Provider-free integration proves the real brain invokes Ettin on immutable
   complete canonical candidates, reports reranking, preserves provenance, and
   fails closed on any runtime/head/score mismatch. The live compatibility
   smoke either proves Gemini semantic retrieval + Ettin reranking + Luna
   answer wiring, or records a terminal pre-question failure.
4. If compatibility passes, each of the ten ordered questions gets one
   non-empty answer and one official label unless a terminal failure stops the
   suffix. Each answer uses no more than four memory calls; finalization, when
   required, omits tools and uses `tool_choice: "none"`.
5. Terminal evidence reports every label and prior comparison; required-session
   coverage; semantic/rerank use and candidate counts; raw retrieval ordering;
   answer/finalization calls; provider usage; local latency; measured/uncertain
   spend; exact artifacts/modes; and zero credential matches.
6. The first invocation is final under `$1.50` fresh / `$6.77173386`
   cumulative accounted caps. `STATUS.md` records the outcome and failing-first
   prediction grades without rerun or regrade. Full tests, quickstart,
   launcher/ticket/report/scope/diff checks, and fresh terminal review pass
   before founder acceptance.

## Ticket Completion Contract

### Definition Of Done

- One fresh preregistered identity reaches a terminal compatibility or
  first-ten result and preserves a rehashable private evidence bundle.
- The causal comparison says exactly whether Ettin changed retrieval ordering,
  evidence use, official labels, completion, latency, and spend.
- A fresh reviewer recommends `accept`, `reopen`, or `needs-human` after the
  terminal record is committed.

### Expansion Rules

- Any product fix, second identity, changed model/runtime/dtype, changed cap,
  provider, prompt, question, bank, metric, or grading rule requires a new
  founder decision and fresh preregistration.
- If current `main` cannot reproduce BRN-0007 except for injected Ettin, stop
  before dispatch and report the uncontrolled difference.

## Verification

- `node /home/quetza/palari-brain-private/luna-ettin-first10-live-v1-launcher.mjs --verify`
- `node --test tests/reranker-ettin.contract.test.mjs tests/ettin-native-bakeoff.contract.test.mjs`
- `npm test`
- `npm run quickstart`
- `npm run ticket -- ticket-lint-all`
- `npm run ticket -- report-lint BRN-0010`
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0010`
- `git diff --check main...HEAD`

## Stop Conditions

- Stop if the work needs a path outside `allowed_paths` or touches `forbidden_paths`.
- Stop before provider dispatch until the exact freeze is committed/pushed,
  offline verification passes, and a fresh reviewer recommends GO.
- Stop if credentials are read before all offline gates and durable fresh-run
  reservation, if any provider is unmetered, if a cache/runtime/model/artifact
  hash or file mode differs, or if the result identity is not fresh.
- Stop on the first failed smoke, question, judge, cap, provider, or integrity
  boundary. Stop after the first complete invocation whatever its result.
- Stop if fresh accounted spend would exceed `$1.50`, cumulative accounted
  spend would exceed `$6.77173386`, or sealed U8 could be selected.

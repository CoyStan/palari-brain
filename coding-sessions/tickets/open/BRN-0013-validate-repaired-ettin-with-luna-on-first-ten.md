---
id: BRN-0013
title: "Validate repaired Ettin with Luna on first ten"
stream: memory
level: 1
parent_id: 
root_id: BRN-0013
children: []
status: claimed
risk: R3
priority: P0
agents_allowed: 1
claimed_by: "quetza"
claimed_at: 2026-08-04T04:02:08Z
target_branch: "main"
branch: "ticket/BRN-0013-validate-repaired-ettin-with-luna-on-first-ten"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0013-validate-repaired-ettin-with-luna-on-first-ten"
allowed_paths:
  - "evals/predictions.md"
  - "docs/DECISIONS.md"
  - "STATUS.md"
  - "coding-sessions/tickets/open/BRN-0013-*.md"
  - "coding-sessions/tickets/closed/BRN-0013-*.md"
  - "coding-sessions/reports/BRN-0013-*.md"
  - "coding-sessions/human-report/BRN-0013-*.md"
  - "coding-sessions/handoffs/BRN-0013-*.md"
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
  - "node /home/quetza/palari-brain-private/luna-ettin-first10-live-v2-launcher.mjs --verify"
  - "npm test"
  - "npm run quickstart"
created: 2026-08-04
updated: 2026-08-04
---

# BRN-0013 Validate repaired Ettin with Luna on first ten

## Goal

Measure the accepted BRN-0012 cached-only Ettin repair in the exact Luna
first-ten causal diagnostic that BRN-0010 could not enter. Preserve every
provider, prompt, question, memory, budget, and grading factor; treat the one
fresh invocation, including any failure or cap stop, as terminal evidence.

## Context And Authority

BRN-0012 is independently reviewed, founder-delegated accepted, merged, and
pushed on canonical `main` at `90e1837`. It removes BRN-0010's provider-free
tokenizer discovery failure by passing a validated absolute local revision
directory to both Transformers.js factories. Quetzali explicitly authorized
correct integration, a fresh rerun, autonomous tickets/reviews/routine clean
merges, and continued engineering until a CEO-level blocker. This is fresh
authority for one new governed identity under the same `$1.50` cap; it never
resumes or mutates terminal BRN-0010.

The exact carried opening is `$5.27173386` accounted: `$1.70023596` measured
plus `$3.5714979` uncertain. BRN-0010 consumed its exclusive identity in the
local smoke with zero provider calls and `$0.00` spend, so those balances did
not change. Terminal BRN-0007 remains the closest scored control: among six
graded questions its exact labels were `PASS, FAIL, PASS, PASS, PASS, PASS`;
question 7 answered but was not judged at its lower cap, and 8-10 were not
reached.

## Scope

- Freeze fresh private identity `j4-luna-ettin-first10-v2` from accepted
  product cut point `90e1837`, with the administrative contract head recorded
  separately. Bind every tracked product/eval input, immutable dataset/order,
  terminal predecessor manifest, private launcher/runtime, exact cached Ettin
  model/head bytes, complete isolated runtime closure, provider/prompt/limit,
  prediction, and ledger before any model inference or credential read.
- Select the exact ordered S60 IDs `08e075c7`, `09d032c9`, `16c90bf4`,
  `5e1b23de`, `80ec1f4f_abs`, `0977f2af`, `0a34ad58`, `0edc2aef`,
  `10d9b85a`, and `1192316e`. Sealed U8 `1568498a` must be absent and
  unreachable.
- Preserve Luna `gpt-5.6-luna`, Standard service, low reasoning,
  `store:false`; Gemini `gemini-embedding-001`; official
  `gpt-4o-2024-08-06` judge; exact questions, sessions, prompts, schemas,
  semantic behavior, four aggregate memory-call ceiling, tool-disabled
  finalization, serial order, answer/judge logic, and official labels.
- Preserve accepted native Ettin identity
  `cross-encoder/ettin-reranker-17m-v1` revision
  `9e4aa35321a6dd1a43ca313f500c4b4f7cfb5cc6`, fp32 ONNX, exact CLS ->
  Dense/GELU -> LayerNorm -> Dense head, candidate/input bounds, and ranking
  seam. The only change from BRN-0010 is the accepted BRN-0012 absolute
  cached-directory loader repair.
- Build a fresh mode-0600 one-shot launcher outside git. It must verify all
  frozen identities and refuse changed/missing artifacts, dirty/wrong product
  checkout, existing result identity, early credential access, unmetered
  transport, or a repeat invocation.
- On the one invocation, reserve the identity durably, run one provider-free
  real-brain Ettin smoke before `.env`, then one live Gemini-semantic + Ettin +
  Luna compatibility smoke. Stop terminally on either failure. If both pass,
  answer and officially judge questions 1-10 once in order with checkpoints.
- Enforce `$1.50` fresh and `$6.77173386` cumulative accounted hard caps.
  Reserve every provider request before dispatch, retain measured versus
  uncertain accounting, and use no transport retry.
- Record exact terminal results, labels, retrieval/rerank behavior, calls,
  usage, latency, spend, artifacts/modes, zero-match credential scan,
  failing-first prediction grades, and product stop rule. Obtain independent
  review before dispatch and after the terminal record.

## Out Of Scope

- No product repair, prompt tuning, question-specific rule, benchmark answer
  or label in runtime logic, provider/model/effort/dtype change, embedding or
  judge change, candidate pool/limit change, timestamp-policy change, dataset
  or order edit within this identity.
- No retry, resume, reroll, selective rerun, regrade, replacement identity,
  hidden result, or publication. Ten of ten is the product objective, not an
  acceptance criterion that permits tuning on these known answers.
- No access to sealed U8, no spend above the frozen caps, and no secret,
  runtime, cache, model, dataset, transcript, or result byte in git.
- No claim that these inspected ten cases estimate unseen-user
  generalization. This is a private regression and causal-integration
  diagnostic.

## Acceptance Criteria

1. Before local inference or provider access, FINAL predictions and the entire
   tracked/private execution identity are committed and pushed. Offline
   verification rehashes the accepted product cut point, dataset/order,
   terminal predecessors including BRN-0010, launcher/runtime, exact model/head
   files, runtime closure, opening ledger, caps, and absent result without
   reading credentials.
2. A fresh independent reviewer confirms that BRN-0012 is the only treatment
   versus BRN-0010; no answer/label enters runtime logic; all transports are
   metered; artifacts are integrity-pinned; the cap is fail-closed; and one
   invocation cannot be repeated.
3. The provider-free local smoke either proves the repaired real brain obtains
   finite one-for-one Ettin scores, immutable candidates, `reranked: true`,
   and expected direct-memory top rank, or seals a terminal pre-credential
   failure. Live compatibility either proves real Gemini semantic retrieval +
   Ettin reranking + Luna answer wiring or seals before question 1.
4. If compatibility passes, each ordered question gets one non-empty answer
   and one official label unless a terminal boundary stops the suffix. Each
   answer makes at most four aggregate memory calls; forced finalization, if
   used, sends no tools and `tool_choice: "none"`.
5. Terminal evidence reports every prior/current label, required-session
   coverage, raw and reranked search telemetry, immutable candidate counts,
   local latency, answer/finalization calls, provider usage, exact accounted
   spend, artifact hashes/modes, and exact-value credential scan.
6. The first invocation is final under both caps. `STATUS.md` records the
   outcome and failing-first prediction grades whatever they are. Full tests,
   quickstart, launcher/ticket/report/scope/diff checks, and fresh terminal
   review pass before delegated acceptance or any successor decision.

## Ticket Completion Contract

### Definition Of Done

- One fresh preregistered identity reaches a terminal compatibility or
  first-ten result and preserves a rehashable private evidence bundle.
- The comparison states exactly whether the repaired Ettin integration works
  and how it changes ordering, evidence use, labels, completion, latency, and
  spend.
- A fresh reviewer recommends `accept`, `reopen`, or `needs-human` after the
  terminal record is committed.

### Expansion Rules

- A product defect discovered by this identity is recorded, never repaired in
  place. A general fix requires a separately frozen governed successor ticket
  and may not use hidden benchmark answers as implementation input.
- A second scored identity, changed cap/provider/prompt/model/runtime/dataset,
  or selective retry requires fresh explicit founder authority and a new
  preregistration. Routine review/merge authority does not waive that gate.

## Pre-Dispatch Freeze Evidence

- Product cut point: merged BRN-0012 `90e1837`; clean canonical administrative
  head `784de723daf5be9824b5ef2f18b274eff94e1313` adds only this ticket contract.
- Private launcher / generated runtime SHA-256:
  `d9242b407b7477168a9c746bf5350659222f7e6ad3a329ad2ed79e186de57a63` /
  `df2b746bbc422e88bbf773eeab68292ea1ad85d026988e4ab7ff765a4349a50a`.
  Terminal runtime-template SHA-256 is
  `4bc21c6c3d14d977f0aa659608d0998bd029d3f754c4398c1e4f49705aa266d0`.
- Offline launcher verification: 10/10 predecessor bundles and 218/218
  predecessor artifacts rehashed; 10/10 product/eval inputs, 7/7 Ettin files,
  dataset/order, and the 3,208-file runtime closure rehashed; result absent;
  launcher/runtime mode 0600; syntax and generated runtime verification pass.
- Focused contracts: 10/10. Full suite: 695 pass, 0 fail, 15 skipped across
  710. Quickstart: 6/6.
- Provider calls, credential reads, local model inference, fresh result bytes,
  and fresh spend: 0 / 0 / 0 / 0 / `$0.00`.
- Fresh independent review at
  `163e7e532cf631239f66155dd179b186959d8032` found no P0-P3 issue, repeated
  launcher/focused/full/quickstart/governance verification, and recommends GO
  for exactly one invocation. Its review note must be committed and pushed
  before dispatch.

## Terminal Evidence

- Pre-dispatch GO was committed/pushed at `1ceed8b`. The launcher then ran
  exactly once; attempt state is `consumed`, child/launcher status is 0, and
  identity `j4-luna-ettin-first10-v2` is permanently sealed.
- Local Ettin smoke and live Gemini + Ettin + Luna compatibility both passed.
  All ten questions completed and received one official judgment. Exact labels
  are `PASS, FAIL, PASS, PASS, PASS, PASS, FAIL, FAIL, FAIL, PASS`: 6/10.
- Required-session coverage is 12/13. Every official FAIL row consulted every
  required answer-bearing session; the sole missing session was on a PASS.
  Three FAIL rows are observed answer-use/personalization failures. On
  `10d9b85a`, the exact reference and Luna response both say `3 days`, but the
  official judge returned `No`; this is a clear judge false negative. The
  official FAIL and aggregate 6/10 remain immutable and were not regraded.
  Ten non-empty Ettin calls scored exactly 250 immutable candidates, maximum
  50, with one finite score per candidate and mean 1,290.7 ms/call.
- Compatibility, completion, retrieval/rerank, wire, and accounting
  predictions pass. Official accuracy fails below the preregistered `>=7/10`
  floor and 10/10 objective; specifically `09d032c9` did not reverse.
- All 138 physical calls succeeded: 33 Luna Responses, ten official judges,
  and 95 Gemini batches / 4,794 embedding requests. Fresh spend is
  `$0.75899237` = `$0.02310692` measured + `$0.73588545` uncertain. Cumulative
  spend is `$6.03072623` = `$1.72334288` measured + `$4.30738335` uncertain.
- Terminal manifest
  `eb7dcb01c7a60cbade9a25d179cffde783e1f46c5c79644422eae819da7c3b71`
  rehashes 73/73 artifacts / 89,106,477 bytes. All recorded files match modes;
  no symlink, sealing error, or exact credential match exists.
- No retry, rerun, regrade, selective score, prompt/model change, result
  repair, or second identity occurred. Fresh terminal review remains before
  delegated acceptance or merge.

## Terminal Review Correction

- Fresh review at `699cc0a45d84e68410ebc145eb6120f49d2f8c8c` rehashed the
  complete seal, reconciled all execution/accounting evidence, and found one
  P1 reporting issue: the tracked record materially misclassified the
  `10d9b85a` judge false negative as an answer-composition failure.
- BRN-0013 was reopened for reporting correction only. No private artifact,
  label, score, prediction, or execution changes. Fresh terminal rereview is
  mandatory before acceptance.

## Verification

- `node /home/quetza/palari-brain-private/luna-ettin-first10-live-v2-launcher.mjs --verify`
- `node --test tests/reranker-ettin.contract.test.mjs tests/ettin-native-bakeoff.contract.test.mjs`
- `npm test`
- `npm run quickstart`
- `npm run ticket -- ticket-lint-all`
- `npm run ticket -- report-lint BRN-0013`
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0013`
- `git diff --check main...HEAD`

## Stop Conditions

- Stop if the work needs a path outside `allowed_paths` or touches `forbidden_paths`.
- Stop before local inference or credential/provider access until the exact
  freeze is committed and pushed, offline verification passes, and a fresh
  independent reviewer recommends GO.
- Stop if credentials could be read before all offline gates plus durable
  result reservation, if any provider is unmetered, if a frozen artifact/hash/
  mode differs, or if the result identity is not fresh and one-shot.
- Stop on the first failed local smoke, live compatibility, question, judge,
  cap, provider, integrity, or evidence-sealing boundary. Stop after the one
  invocation whatever its score.
- Stop if fresh accounted spend would exceed `$1.50`, cumulative accounted
  spend would exceed `$6.77173386`, or sealed U8 could be selected.

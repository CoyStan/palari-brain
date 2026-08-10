---
id: BRN-0043
title: "Bound native reranker memory"
stream: memory
level: 1
parent_id: 
root_id: BRN-0043
children: []
status: in-review
risk: R2
priority: P0
agents_allowed: 2
claimed_by:
claimed_at:
target_branch: "main"
branch: "ticket/BRN-0043-bound-native-reranker-memory"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0043-bound-native-reranker-memory"
allowed_paths:
  - "src/reranker-transformers.mjs"
  - "src/reranker-ettin.mjs"
  - "src/retrieval-answer.mjs"
  - "tests/reranker-transformers.contract.test.mjs"
  - "tests/reranker-ettin.contract.test.mjs"
  - "tests/retrieval-answer.contract.test.mjs"
  - "tests/answer-confirmation.contract.test.mjs"
  - "evals/run-ettin-native-bakeoff.mjs"
  - "tests/ettin-native-bakeoff.contract.test.mjs"
  - "docs/BRAIN-API.md"
  - "STATUS.md"
  - "coding-sessions/tickets/open/BRN-0043-*.md"
  - "coding-sessions/tickets/closed/BRN-0043-*.md"
  - "coding-sessions/reports/BRN-0043-*.md"
  - "coding-sessions/human-report/BRN-0043-*.md"
  - "coding-sessions/handoffs/BRN-0043-*.md"
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
  - ".palari-alpha/**"
requires_human_confirmation: false
requires_review: true
verification:
  - "node --test tests/reranker-transformers.contract.test.mjs tests/reranker-ettin.contract.test.mjs tests/ettin-native-bakeoff.contract.test.mjs tests/retrieval-answer.contract.test.mjs tests/answer-confirmation.contract.test.mjs"
  - "npm test"
  - "npm run quickstart"
  - "npm run test:legacy"
  - "npm run ticket -- check BRN-0043"
created: 2026-08-10
updated: 2026-08-10
---

# BRN-0043 Bound native reranker memory

## Goal

Prevent native Ettin and generic Transformers reranking from multiplying one
long pair across an unsafe 20--50 candidate FP32 batch. Preserve the current
model, candidate texts, 7,999-token Ettin context, score-to-candidate mapping,
and fail-closed answer behavior while making inference work bounded,
serialized, explicitly released, and measurable provider-free.

## Scope

- Add one reusable execution policy for the existing Transformers.js
  rerankers: explicit token ceiling, exact pair-length measurement, stable
  length bucketing, adaptive microbatches, a maximum microbatch size, and
  original-order score restoration.
- Keep Ettin FP32, all current candidate text, its modular scoring head, and
  its existing implicit 7,999-token input semantics. Make that ceiling
  explicit rather than silently lowering it.
- Dispose encoded input tensors and model output tensors in `finally` on
  success and every failure path. Keep the loaded model warm until explicit
  close; serialize reranks per loaded model so concurrent callers cannot
  multiply native peak memory.
- Emit only content-free run metrics needed to tune the work envelope:
  candidate count, token-length range, batch shapes/work, duration, and RSS.
- Preserve broad cheap retrieval during confirmation, but enforce the public
  reranker contract by passing no more than 50 stable RRF-ordered candidates
  after canonical information filtering.
- Extend the provider-free native runner and contracts to verify batching,
  disposal, ordering, concurrency, lifecycle, score parity, and bounded
  confirmation candidate dispatch.
- Record the host OOM diagnosis and verification honestly in `STATUS.md` and
  governed reports without regrading or retrying a live diagnostic.

## Out Of Scope

- No paid provider call, hard-case retry, private `.palari-alpha` artifact
  access, dataset execution, sealed U8 access, benchmark regrade, or cost-cap
  change.
- No default 512/768/1,024-token truncation, passage/window selection, MaxP
  aggregation, candidate-pool reduction below 50, AVX2 uint8 adoption, FP16,
  model replacement, fused ONNX head, TEI, FastEmbed, Python sidecar, or new
  learned ranking behavior. Those are separate challengers after this
  score-preserving baseline passes.
- No silent lexical fallback, swallowed reranker exception, admission change,
  durable write, user/workspace isolation change, evidence-provenance change,
  or answer-commitment weakening.
- No deployment, container, systemd, cgroup, production infrastructure, or
  T3 service mutation. This ticket may make the scorer suitable for a
  supervised process and test lifecycle behavior, but cannot claim OS-level
  containment it does not install.

## Acceptance Criteria

1. Both reranker adapters pass an explicit model-appropriate `max_length`,
   never send more than the configured microbatch maximum to native inference,
   respect the quadratic padded-work target except for one explicitly reported
   over-target singleton, and restore one finite score to every original
   candidate index.
2. Ettin retains FP32, the same frozen model/head identities, the 7,999-token
   ceiling, all candidates up to the public limit of 50, and the unchanged
   query/document pair construction. Provider-free native parity retains the
   historical 14/15 top-1 and 15/15 recall@5 when the audited runtime/cache is
   supplied; mock contracts prove scheduling without requiring that optional
   closure.
3. Every disposable tokenizer input and model output is released exactly once
   on success, tokenizer/model/scoring failure, and close. Concurrent reranks
   are single-flight, warm loading occurs once, close is idempotent, and work
   after close fails with a typed error.
4. Metrics contain batch sizes, padded token lengths, work estimates, timing,
   and RSS only; they contain no query, document, evidence ID, workspace ID,
   credential, or source bytes. Metrics callback failure cannot corrupt or
   replace reranker results.
5. Confirmation may gather and information-filter up to 200 cheap candidates,
   but `brain.rerankEvidence` receives at most 50 in stable fused order and the
   existing bounded page remains complete. Reranker failures remain terminal.
6. Focused tests, `npm test`, quickstart, the complete legacy tier, ticket
   lint/scope/diff gates, and independent R2 review pass before founder
   acceptance. Native RSS claims are made only from an actually executed
   provider-free run; otherwise they remain an explicit follow-up gate.

## Ticket Completion Contract

### Definition Of Done

- The reusable reranker path no longer performs one native 20--50 item padded
  inference and deterministically releases per-run tensors.
- The answer path cannot exceed the reranker adapter's 50-candidate contract.
- Provider-free evidence distinguishes proven scheduling/lifecycle behavior
  from optional native memory measurements.

### Expansion Rules

- Tune only scheduling constants that preserve current tokens, candidates,
  model weights, and canonical evidence. Open a separate ticket before
  changing any of those semantic inputs.
- If safe execution requires OS-level infrastructure or access to private
  diagnostic artifacts, stop and request founder direction rather than
  widening this ticket.

### Final Review Gate

- A fresh independent reviewer must inspect the committed diff and evidence
  and recommend `accept`, `reopen`, or `needs-human`. Only the founder may
  accept, move the ticket to `closed`, merge, or push the ticket branch.

## Verification

- `node --test tests/reranker-transformers.contract.test.mjs tests/reranker-ettin.contract.test.mjs tests/ettin-native-bakeoff.contract.test.mjs tests/retrieval-answer.contract.test.mjs tests/answer-confirmation.contract.test.mjs`
- `npm test`
- `npm run quickstart`
- `npm run test:legacy`
- `npm run ticket -- check BRN-0043`
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0043`
- `git diff --check main...HEAD`

## Stop Conditions

- Stop if the work needs a path outside `allowed_paths` or touches `forbidden_paths`.
- Stop before any provider, credential, private artifact, dataset, sealed U8,
  production infrastructure, or paid diagnostic access.
- Stop if score/candidate parity cannot be preserved without a semantic token,
  passage, precision, model, or retrieval-policy change.

## Specialist Closeout

- Replaced one large padded native call with exact-token, stable,
  quadratic-work microbatches while preserving the current fp32 model,
  candidate text, candidate limit, Ettin 7,999-token ceiling, modular head,
  and original-order score contract.
- Added deterministic success/failure tensor cleanup, single-flight execution,
  transactional component-load rollback, warm/idempotent-close lifecycle,
  content-free timing/RSS metrics, and a provider-free native profile mode that
  requires explicit audited external runtime/cache paths and fails closed when
  model shutdown fails.
- Fixed confirmation's latent adapter-contract mismatch: cheap candidate
  gathering and information filtering may reach 200, but the reranker receives
  at most the first 50 stable fused candidates. An 80-row regression proves
  the bounded dispatch and complete 20-item page.
- Verification passes focused 77/77, core 90/90, quickstart 6/6, and legacy
  935 pass / 15 optional skip / 0 fail across 950. The inert Ettin identity
  verification remains unchanged.
- The native mixed-length profile was not executed because this ticket forbids
  private alpha artifacts and no audited runtime/cache path was placed inside
  scope. The frozen-bank native parity run was likewise not executed. No native
  RSS ceiling, historical rank result, paid result, benchmark regrade,
  512-token Ettin window policy, quantization result, or OS containment claim
  is made.
- No provider, credential, private artifact, dataset, sealed U8 question,
  durable memory write, production service, cgroup, or container was accessed
  or changed.
